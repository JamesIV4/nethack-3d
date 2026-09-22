import {afterEach,expect,it,vi} from "vitest";
import {ControllerPrebakedModels} from "./controller-prebaked";
afterEach(()=>vi.unstubAllGlobals());
const source=new Uint8Array([1,2,3]).buffer;
async function hash(){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",source)),b=>b.toString(16).padStart(2,"0")).join("");}
function baked(sourceHash:string){const json=new TextEncoder().encode(JSON.stringify({asset:{extras:{nh3dOcclusion:{sourceSha256:sourceHash}}}})),bytes=new ArrayBuffer(20+json.length),view=new DataView(bytes);view.setUint32(0,0x46546c67,true);view.setUint32(12,json.length,true);view.setUint32(16,0x4e4f534a,true);new Uint8Array(bytes,20).set(json);return bytes;}
it("loads only the baked copy for the exact captured model",async()=>{
 const key=await hash(),expected=baked(key),url=`/quest-controllers/runtime/${key}.glb`;
 const fetch=vi.fn(async(path:string)=>path.endsWith('.json')?new Response(JSON.stringify({version:1,runtime:{[key]:url}})):new Response(expected));vi.stubGlobal('fetch',fetch);
 expect(await new ControllerPrebakedModels().resolve(source,new AbortController().signal)).toEqual(expected);expect(fetch).toHaveBeenLastCalledWith(url,expect.anything());
});
it("retains new system geometry without a bake or model substitution",async()=>{
 const fetch=vi.fn(async()=>new Response(JSON.stringify({version:1,runtime:{}})));vi.stubGlobal('fetch',fetch);
 const resolver=new ControllerPrebakedModels();expect(await resolver.resolve(source,new AbortController().signal)).toBe(source);await resolver.resolve(source,new AbortController().signal);expect(fetch).toHaveBeenCalledOnce();
});
it("ignores mismatched AO payloads and unavailable manifests",async()=>{
 const key=await hash();vi.stubGlobal('fetch',vi.fn(async(path:string)=>path.endsWith('.json')?new Response(JSON.stringify({version:1,runtime:{[key]:`/quest-controllers/runtime/${key}.glb`}})):new Response(baked('different-source'))));
 expect(await new ControllerPrebakedModels().resolve(source,new AbortController().signal)).toBe(source);
 vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline');}));expect(await new ControllerPrebakedModels().resolve(source,new AbortController().signal)).toBe(source);
});
