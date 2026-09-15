import * as THREE from "three";
import { expect, it, vi } from "vitest";
vi.mock("../../state/gameStore",()=>({useGameStore:{getState:()=>({gameOver:{active:false},connectionState:"running",inventory:{visible:false}})}}));
import { ControllerWeapons } from "./controller-weapons";
it("attaches independent equipped textures to both grip poses, refreshes equipment, and disposes resources",()=>{
 const root=new THREE.Group(), dispose=vi.fn();let leftEquipped=true,rightVersion=1;
 const provider={resolveFpsHeldWeaponTextureState:vi.fn((hand?:"left"|"right")=>hand==='left'&&!leftEquipped?null:{signature:hand==='left'?'left':'right'+rightVersion,tileIndex:1,sourceGlyph:1}),createQuestWeaponTexture:vi.fn(()=>{const t=new THREE.Texture();t.addEventListener('dispose',dispose);return t}),measureTextureOpaqueAspectRatio:()=>.5};
 const weapons=new ControllerWeapons(root,provider),right={handedness:'right',gripSpace:{}} as XRInputSource,left={handedness:'left',gripSpace:{}} as XRInputSource;
 const frame={getPose:(space:XRSpace)=>({transform:{matrix:new THREE.Matrix4().makeTranslation(space===right.gripSpace? .3:-.3,1,-.5).elements}}),getViewerPose:()=>({transform:{position:{x:0,y:1.6,z:0}}})} as unknown as XRFrame;
 const reference={} as XRReferenceSpace, attack=vi.fn(),aim=new THREE.Vector3(0,0,-1);
 weapons.update(right,frame,reference,true,aim,true,1,attack);weapons.update(left,frame,reference,true,aim,true,1,attack);
 expect(root.children).toHaveLength(2);expect(root.children.every(o=>o.visible)).toBe(true);expect(provider.createQuestWeaponTexture).toHaveBeenCalledTimes(2);
 weapons.update(right,frame,reference,true,aim,true,20,attack);expect(provider.createQuestWeaponTexture).toHaveBeenCalledTimes(2);
 rightVersion++;weapons.update(right,frame,reference,true,aim,true,40,attack);expect(dispose).toHaveBeenCalledTimes(1);
 leftEquipped=false;weapons.update(left,frame,reference,true,aim,true,40,attack);expect(root.children[1].visible).toBe(false);expect(dispose).toHaveBeenCalledTimes(2);
 weapons.reset(right);expect(root.children[0].visible).toBe(false);expect(attack).not.toHaveBeenCalled();weapons.dispose();expect(root.children).toHaveLength(0);expect(dispose).toHaveBeenCalledTimes(3);
});
