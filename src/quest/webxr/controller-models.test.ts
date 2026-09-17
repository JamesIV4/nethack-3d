import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { ControllerModels } from "./controller-models";
import { profileControllerAnimation, runtimeControllerAnimation, stickBlend } from "./controller-model-animation";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LoadedController } from "./controller-model-loader";
afterEach(() => vi.unstubAllGlobals());
const pad = (value: number) => ({ buttons: Array.from({length:7}, () => ({value, pressed:value===1, touched:value>0})), axes:[0,0,0,0] }) as unknown as Gamepad;
it("runtime trigger interpolates and returns to neutral using Meta pose 16", async () => {
  const node = new THREE.Object3D(); const data = new Float32Array(41*3); data[16*3]=.01;
  const gltf = {parser:{json:{nodes:[{name:"trigger_front"}],animations:[{samplers:[{input:0,output:1}],channels:[{sampler:0,target:{node:0,path:"translation"}}]}]},getDependency:async (kind:string,index:number) => kind==="node" ? node : index===0 ? new THREE.BufferAttribute(new Float32Array(41),1) : new THREE.BufferAttribute(data,3)}} as unknown as GLTF;
  const animation = await runtimeControllerAnimation(gltf);
  animation.update(pad(.5)); expect(node.position.x).toBeCloseTo(.005);
  animation.update(pad(1)); expect(node.position.x).toBeCloseTo(.01);
  animation.update(undefined); expect(node.position.x).toBe(0);
});
it("thumbstick blending preserves neutral, cardinal and diagonal poses", () => {
  expect(stickBlend(0,0).wa).toBe(0);
  expect(stickBlend(0,1)).toEqual({a:0,b:1,wa:1,wb:0});
  expect(stickBlend(1,1)).toEqual({a:1,b:2,wa:1,wb:0});
  expect(stickBlend(.25,1)).toEqual({a:0,b:1,wa:.75,wb:.25});
});
function fixture(load = vi.fn(async ():Promise<LoadedController> => ({scene:new THREE.Group(),animation:{update:vi.fn(),channels:5},meshes:2,triangles:10,dispose:vi.fn()}))) {
  const renderer = {autoClear:true, clippingPlanes:[new THREE.Plane()], clearDepth:vi.fn(), render:vi.fn()};
  const loader={load,dispose:vi.fn()};
  const models=new ControllerModels(renderer as unknown as THREE.WebGLRenderer,loader,true);
  const source={handedness:"left",gripSpace:{},gamepad:pad(0)} as XRInputSource;
  const frame={getPose:vi.fn(() => ({transform:{matrix:new THREE.Matrix4().makeTranslation(1,2,3).elements}}))} as unknown as XRFrame;
  return {models,renderer,loader,source,frame,update:(time=0,sources=[source])=>models.update(frame,{} as XRReferenceSpace,sources,time)};
}
it("host failure still loads offline fallback, loss of tracking hides it, and render state is restored", async () => {
  vi.stubGlobal("fetch",vi.fn(async (_url:string,options?:RequestInit) => {if(options?.method==="HEAD") throw new Error("offline"); return new Response(new ArrayBuffer(8));}));
  const f=fixture(); f.update(); await vi.waitFor(()=>expect(f.models.diagnostics[0].source).toBe("fallback"));
  const clipping=f.renderer.clippingPlanes;
  f.renderer.render.mockImplementation((scene:THREE.Scene)=>{expect(scene.children[0].children[0].position.x).toBe(0);throw new Error("draw failed");});
  expect(()=>f.models.render(new THREE.Camera(),new THREE.Group())).toThrow("draw failed");
  expect(f.renderer.autoClear).toBe(true); expect(f.renderer.clippingPlanes).toBe(clipping);
  vi.mocked(f.frame.getPose).mockReturnValue(undefined); f.update(1); expect(f.models.diagnostics[0].tracked).toBe(false);
  f.update(2,[]); expect(f.models.diagnostics).toHaveLength(0); f.models.dispose(); expect(f.loader.dispose).toHaveBeenCalledOnce();
});
it("late model completion after session disposal cannot resurrect controller meshes", async () => {
  vi.stubGlobal("fetch",vi.fn(async ()=>new Response(new ArrayBuffer(8))));
  let finish!:(value:LoadedController)=>void;
  const f=fixture(vi.fn(()=>new Promise(resolve=>{finish=resolve;})));
  f.update(); await vi.waitFor(()=>expect(finish).toBeTypeOf("function")); f.models.dispose();
  const model={scene:new THREE.Group(),animation:{update:vi.fn(),channels:1},meshes:1,triangles:1,dispose:vi.fn()};
  finish(model); await vi.waitFor(()=>expect(model.dispose).toHaveBeenCalledOnce()); expect(f.models.diagnostics).toHaveLength(0);
});

it("profile animation moves axes without touch flags and tolerates the optional missing menu mesh", () => {
  const scene=new THREE.Group();
  for(const [name,x] of [["min",-1],["max",1],["value",0]] as const){const node=new THREE.Object3D();node.name=name;node.position.x=x;scene.add(node);}
  const response={componentProperty:"xAxis" as const,states:["touched","pressed"],valueNodeProperty:"transform" as const,valueNodeName:"value",minNodeName:"min",maxNodeName:"max"};
  const animation=profileControllerAnimation(scene,{layouts:{left:{components:{stick:{gamepadIndices:{xAxis:2,button:3},visualResponses:{axis:response,missing:{...response,valueNodeName:"missing-menu"}}}}}}},"left");
  expect(animation.channels).toBe(1);
  const input=pad(0); (input.axes as number[])[2]=1;animation.update(input);expect(scene.getObjectByName("value")!.position.x).toBe(1);
  animation.update(undefined);expect(scene.getObjectByName("value")!.position.x).toBe(0);
});
it("runtime model transport errors are retried and then replace the fallback", async () => {
  let downloads=0;
  vi.stubGlobal("fetch",vi.fn(async (url:string,options?:RequestInit)=>{
    if(url.startsWith("/__xr/")) {
      if(options?.method!=="HEAD" && downloads++===0) throw new Error("temporary connection failure");
      return new Response(new ArrayBuffer(8),{headers:{ETag:'"ready:1:1"'}});
    }
    return new Response(new ArrayBuffer(8));
  }));
  const f=fixture();f.update();await vi.waitFor(()=>expect(f.models.diagnostics[0].source).toBe("fallback"));
  f.update(2001);await vi.waitFor(()=>expect(f.models.diagnostics[0].source).toBe("runtime"));
  expect(downloads).toBe(2);f.models.dispose();
});

it("keeps loading grips empty, fades model and laser opacity together, and restarts after tracking loss", async () => {
  vi.stubGlobal("fetch",vi.fn(async ()=>new Response(new ArrayBuffer(8))));
  const material=new THREE.MeshBasicMaterial({opacity:.8});
  const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
  let finish!:(model:LoadedController)=>void;
  const f=fixture(vi.fn(()=>new Promise(resolve=>{finish=resolve;})));
  f.update();expect(f.models.opacity(f.source)).toBe(0);
  f.renderer.render.mockImplementation((root:THREE.Scene)=>{expect(root.children[0].children[0].children).toHaveLength(0);expect(root.children[0].children[0].visible).toBe(false);});
  f.models.render(new THREE.Camera(),new THREE.Group());
  await vi.waitFor(()=>expect(finish).toBeTypeOf("function"));
  finish({scene,animation:{update:vi.fn(),channels:1},meshes:1,triangles:12,dispose:vi.fn()});
  await vi.waitFor(()=>expect(f.models.diagnostics[0].source).toBe("fallback"));
  expect(material.opacity).toBe(0);f.update(1000);expect(f.models.opacity(f.source)).toBe(0);
  f.update(1125);expect(f.models.opacity(f.source)).toBe(.5);expect(material.opacity).toBeCloseTo(.4);
  f.update(1250);expect(f.models.opacity(f.source)).toBe(1);expect(material.opacity).toBe(.8);expect(material.transparent).toBe(false);
  const tracked=vi.mocked(f.frame.getPose).getMockImplementation()!;
  vi.mocked(f.frame.getPose).mockReturnValue(undefined);f.update(1300);expect(f.models.opacity(f.source)).toBe(0);
  vi.mocked(f.frame.getPose).mockImplementation(tracked);f.update(1400);expect(f.models.opacity(f.source)).toBe(0);
  f.models.dispose();material.dispose();
});
