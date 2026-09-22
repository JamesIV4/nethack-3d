import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {bakeControllerOcclusion} from '../../../src/quest/webxr/controller-occlusion.ts';

export function readGlb(bytes) {
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw Error('Expected GLB 2');
  let json,bin;
  for(let at=12;at<bytes.length;){const length=bytes.readUInt32LE(at),type=bytes.readUInt32LE(at+4),data=bytes.subarray(at+8,at+8+length);if(type===0x4e4f534a)json=JSON.parse(data.toString());else if(type===0x004e4942)bin=data;else throw Error('Unknown GLB chunk');at+=8+length;}
  if(!json||!bin)throw Error('Missing GLB chunks');return {json,bin};
}
export function writeGlb(json,bin) {
  const text=Buffer.from(JSON.stringify(json)),jsonBytes=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(jsonBytes);
  const binary=Buffer.alloc(Math.ceil(bin.length/4)*4);bin.copy(binary);
  const result=Buffer.alloc(12+8+jsonBytes.length+8+binary.length);
  result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);
  result.writeUInt32LE(jsonBytes.length,12);result.writeUInt32LE(0x4e4f534a,16);jsonBytes.copy(result,20);
  const at=20+jsonBytes.length;result.writeUInt32LE(binary.length,at);result.writeUInt32LE(0x004e4942,at+4);binary.copy(result,at+8);return result;
}
export async function bakeGlb(bytes) {
  const {json,bin}=readGlb(bytes),geometryJson=structuredClone(json);
  if(json.buffers.length!==1||json.buffers[0].uri)throw Error('Expected a self-contained GLB');
  if(json.asset.extras?.nh3dOcclusion)throw Error('Refusing to bake an already baked asset');
  // Decode geometry only. Original textures/materials stay byte-for-byte in
  // the output, including KTX2 images, without requiring an image decoder.
  for(const mesh of geometryJson.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  geometryJson.materials=[];
  const loader=new GLTFLoader(),gltf=await loader.parseAsync(writeGlb(geometryJson,bin).buffer,'');
  const entries=[];
  gltf.scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const association=gltf.parser.associations.get(mesh);let node=mesh,nodeIndex;
    while(node&&nodeIndex===undefined){nodeIndex=gltf.parser.associations.get(node)?.nodes;node=node.parent;}
    if(nodeIndex===undefined||association?.meshes===undefined||association?.primitives===undefined)throw Error('Missing glTF mesh association');
    entries.push({mesh,nodeIndex,meshIndex:association.meshes,primitive:association.primitives});
  });
  await bakeControllerOcclusion(gltf.scene,new AbortController().signal);
  const chunks=[bin],copies=new Map();let length=bin.length;
  for(const entry of entries){
    const color=entry.mesh.geometry.getAttribute('color');if(!color)throw Error('AO was not baked');
    let index=copies.get(entry.nodeIndex);
    if(index===undefined){index=json.meshes.length;json.meshes.push(structuredClone(json.meshes[entry.meshIndex]));copies.set(entry.nodeIndex,index);json.nodes[entry.nodeIndex].mesh=index;}
    const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}
    const data=Buffer.alloc(color.count*color.itemSize*4);
    for(let i=0;i<color.count;i++)for(let c=0;c<color.itemSize;c++)data.writeFloatLE(color.getComponent(i,c),(i*color.itemSize+c)*4);
    const view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length,target:34962});
    const accessor=json.accessors.length;json.accessors.push({bufferView:view,componentType:5126,count:color.count,type:color.itemSize===4?'VEC4':'VEC3'});
    json.meshes[index].primitives[entry.primitive].attributes.COLOR_0=accessor;chunks.push(data);length+=data.length;
  }
  json.buffers[0].byteLength=length;
  json.asset.extras={...json.asset.extras,nh3dOcclusion:{version:1,rays:12,radiusMetres:.014,strength:.5,sourceSha256:createHash('sha256').update(bytes).digest('hex')}};
  return writeGlb(json,Buffer.concat(chunks));
}
async function main(){
  const root=fileURLToPath(new URL('../../../',import.meta.url)),manifest={version:1,runtime:{}};
  for(const hand of ['left','right'])for(const runtime of [false,true]){
    const input=path.join(root,runtime?`quest/webxr/controllers/runtime-source/${hand}.glb`:`quest/webxr/controllers/meta-touch-plus/articulated-source/${hand}.glb`);
    const bytes=readFileSync(input),hash=createHash('sha256').update(bytes).digest('hex');
    const url=runtime?`/quest-controllers/runtime/${hash}.glb`:`/quest-controllers/meta-quest-touch-plus/${hand}.glb`;
    const output=path.join(root,'public',url);mkdirSync(path.dirname(output),{recursive:true});const baked=await bakeGlb(bytes);writeFileSync(output,baked);
    if(runtime)manifest.runtime[hash]=url;
    console.log(`${runtime?'Runtime':'Fallback'} ${hand}: ${bytes.length} -> ${baked.length} bytes`);
  }
  writeFileSync(path.join(root,'public/quest-controllers/prebaked.json'),JSON.stringify(manifest,null,2)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
