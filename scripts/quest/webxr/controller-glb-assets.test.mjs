import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('bundled Touch Plus animation nodes match profile except the omitted left menu button',()=>{
 const root=new URL('../../../public/quest-controllers/meta-quest-touch-plus/',import.meta.url);
 const profile=JSON.parse(readFileSync(new URL('profile.json',root)));
 for(const hand of ['left','right']) {
  const bytes=readFileSync(new URL(hand+'.glb',root));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const names=new Set(json.nodes.map(node=>node.name));
  const missing=[];
  for(const component of Object.values(profile.layouts[hand].components)) for(const response of Object.values(component.visualResponses)) for(const key of ['valueNodeName','minNodeName','maxNodeName']) if(response[key]&&!names.has(response[key])) missing.push(response[key]);
  assert.deepEqual(missing,hand==='left'?['menu_pressed_value','menu_pressed_min','menu_pressed_max']:[]);
 }
});
