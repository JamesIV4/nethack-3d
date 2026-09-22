import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readGlb,bakeGlb} from './bake-controller-ao.mjs';
const root=new URL('../../../',import.meta.url);
for(const hand of ['left','right'])for(const runtime of [false,true])test(`offline AO preserves ${runtime?'runtime':'fallback'} ${hand} model contracts`,async()=>{
 const source=readFileSync(new URL(runtime?`quest/webxr/controllers/runtime-source/${hand}.glb`:`quest/webxr/controllers/meta-touch-plus/articulated-source/${hand}.glb`,root));
 const hash=createHash('sha256').update(source).digest('hex');
 const output=readFileSync(new URL(runtime?`public/quest-controllers/runtime/${hash}.glb`:`public/quest-controllers/meta-quest-touch-plus/${hand}.glb`,root));
 const original=readGlb(source),baked=readGlb(output);
 assert.deepEqual(baked.json.animations,original.json.animations);
 assert.deepEqual(baked.json.skins,original.json.skins);
 assert.deepEqual(baked.json.materials,original.json.materials);
 assert.deepEqual(baked.json.images,original.json.images);
 assert.deepEqual(baked.bin.subarray(0,original.bin.length),original.bin);
 const stripMeshes=nodes=>nodes.map(({mesh,...node})=>node);
 assert.deepEqual(stripMeshes(baked.json.nodes),stripMeshes(original.json.nodes));
 for(const node of baked.json.nodes)if(node.mesh!==undefined)for(const primitive of baked.json.meshes[node.mesh].primitives){
  assert.ok(primitive.attributes.COLOR_0!==undefined);const ao=baked.json.accessors[primitive.attributes.COLOR_0];assert.equal(ao.count,baked.json.accessors[primitive.attributes.POSITION].count);
 }
 assert.equal(baked.json.asset.extras.nh3dOcclusion.sourceSha256,hash);
 assert.deepEqual(await bakeGlb(source),output,'bake must reproduce the checked-in asset');
});
