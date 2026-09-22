import * as THREE from "three";
import {expect,it} from "vitest";
import {bakeControllerOcclusion} from "./controller-occlusion";
it("leaves an exposed surface bright and darkens a nearby occluded surface",async()=>{
 const scene=new THREE.Group(),floor=new THREE.Mesh(new THREE.PlaneGeometry(.04,.04,2,2));scene.add(floor);
 await bakeControllerOcclusion(scene,new AbortController().signal);
 const bright=floor.geometry.getAttribute("color").getX(4);expect(bright).toBeCloseTo(1);
 const cover=new THREE.Mesh(new THREE.PlaneGeometry(.04,.04));cover.position.z=.003;scene.add(cover);
 await bakeControllerOcclusion(scene,new AbortController().signal);
 expect(floor.geometry.getAttribute("color").getX(4)).toBeLessThan(.8);
 expect(floor.geometry.getAttribute("color").getX(4)).toBeGreaterThanOrEqual(.5);
});
it("cancels before changing geometry and preserves existing tint and morph data",async()=>{
 const scene=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(.02,.02));scene.add(mesh);
 const original=mesh.geometry;original.setAttribute("color",new THREE.Float32BufferAttribute(Array(12).fill(.7),3));
 original.morphAttributes.position=[original.attributes.position.clone()];
 const abort=new AbortController();abort.abort();await expect(bakeControllerOcclusion(scene,abort.signal)).rejects.toThrow("cancelled");expect(mesh.geometry).toBe(original);
 await bakeControllerOcclusion(scene,new AbortController().signal);
 expect(mesh.geometry).not.toBe(original);expect(mesh.geometry.morphAttributes.position).toHaveLength(1);expect(mesh.geometry.attributes.color.getX(0)).toBeCloseTo(.7);
});

it("bakes the bundled articulated controller while preserving its animation geometry",async()=>{
  const {readFileSync}=await import("vitest").then(v=>v.vi.importActual<{readFileSync:(path:string)=>Uint8Array}>("node:fs"));
  const {GLTFLoader}=await import("three/examples/jsm/loaders/GLTFLoader.js");
  const bytes=readFileSync("quest/webxr/controllers/meta-touch-plus/articulated-source/right.glb");
  const loader=new GLTFLoader().register(()=>({name:"test-texture",loadTexture:async()=>new THREE.Texture()}));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,"");
  const before: THREE.BufferGeometry[]=[];gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)before.push((o as THREE.Mesh).geometry);});
  await bakeControllerOcclusion(gltf.scene,new AbortController().signal);
  let shaded=0,meshes=0;
  gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;meshes++;const color=mesh.geometry.attributes.color;expect(color).toBeDefined();for(let i=0;i<color.count;i++)if(color.getX(i)<.95)shaded++;});
  expect(meshes).toBe(before.length);expect(shaded).toBeGreaterThan(0);
});
