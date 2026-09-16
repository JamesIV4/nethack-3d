import * as THREE from "three";
import { expect, it, vi } from "vitest";
vi.mock("../../state/gameStore",()=>({useGameStore:{getState:()=>({gameOver:{active:false},connectionState:"running",inventory:{visible:false}})}}));
vi.mock('./weapon-pose-defaults', () => ({ defaultWeaponPoses: { globalRotationDeg: { x: 0, y: 0, z: 0 }, tilesetRotationDeg: {}, sprites: {} } }));
import { ControllerWeapons } from "./controller-weapons";
import { normalizeWeaponPose, weaponLocalMatrix } from "./weapon-pose";
it("attaches independent equipped textures to both laser poses, refreshes equipment, and disposes resources",()=>{
 const root=new THREE.Group(), dispose=vi.fn();let leftEquipped=true,rightVersion=1;
 const provider={resolveFpsHeldWeaponTextureState:vi.fn((hand?:"left"|"right")=>hand==='left'&&!leftEquipped?null:{signature:hand==='left'?'left':'right'+rightVersion,tileIndex:1,sourceGlyph:1,tilesetPath:'test'}),createQuestWeaponTexture:vi.fn(()=>{const t=new THREE.Texture();t.addEventListener('dispose',dispose);return t}),measureTextureOpaqueAspectRatio:()=>.5};
 const weapons=new ControllerWeapons(root,provider),right={handedness:'right',gripSpace:{},targetRaySpace:{}} as XRInputSource,left={handedness:'left',gripSpace:{},targetRaySpace:{}} as XRInputSource;
 const frame={getPose:(space:XRSpace)=>({transform:{matrix:new THREE.Matrix4().makeTranslation(space===right.gripSpace||space===right.targetRaySpace? .3:-.3,1,-.5).elements}}),getViewerPose:()=>({transform:{position:{x:0,y:1.6,z:0}}})} as unknown as XRFrame;
 const reference={} as XRReferenceSpace, attack=vi.fn(),aim=new THREE.Vector3(0,0,-1);
 weapons.update(right,frame,reference,true,aim,true,1,attack);weapons.update(left,frame,reference,true,aim,true,1,attack);
 expect(root.children).toHaveLength(2);expect(root.children.every(o=>o.visible)).toBe(true);expect(provider.createQuestWeaponTexture).toHaveBeenCalledTimes(2);
 weapons.update(right,frame,reference,true,aim,true,20,attack);expect(provider.createQuestWeaponTexture).toHaveBeenCalledTimes(2);
 rightVersion++;weapons.update(right,frame,reference,true,aim,true,40,attack);expect(dispose).toHaveBeenCalledTimes(3);
 leftEquipped=false;weapons.update(left,frame,reference,true,aim,true,40,attack);expect(root.children.filter(o=>o.visible)).toHaveLength(1);
 weapons.reset(right);expect(root.children.every(o=>!o.visible)).toBe(true);expect(attack).not.toHaveBeenCalled();weapons.dispose();expect(root.children).toHaveLength(0);expect(dispose).toHaveBeenCalledTimes(3);
});

it("uses the preview's ray-relative transform even when the grip pose differs", () => {
 const source = { handedness: 'right', gripSpace: {}, targetRaySpace: {} } as XRInputSource;
 const root = new THREE.Group(), ray = new THREE.Matrix4().compose(new THREE.Vector3(.3, 1, -.5),
   new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .4), new THREE.Vector3(1, 1, 1));
 const grip = new THREE.Matrix4().makeTranslation(.2, .9, -.4);
 let tracked = true;
 const frame = { getPose: (space: XRSpace) => space === source.targetRaySpace && !tracked ? null :
   { transform: { matrix: (space === source.targetRaySpace ? ray : grip).elements } },
   getViewerPose: () => ({ transform: { position: { x: 0, y: 1.6, z: 0 } } }) } as unknown as XRFrame;
 const weapons = new ControllerWeapons(root, {
   resolveFpsHeldWeaponTextureState: () => ({ signature: 'sword', tileIndex: 1, sourceGlyph: 1, tilesetPath: 'test' }),
   createQuestWeaponTexture: () => new THREE.Texture(),
 });
 weapons.update(source, frame, {} as XRReferenceSpace, true, new THREE.Vector3(0, 0, -1), true, 1, vi.fn());
 const expected = ray.clone().multiply(weaponLocalMatrix(normalizeWeaponPose({}), 1));
 root.children[0].matrix.elements.forEach((value, index) => expect(value).toBeCloseTo(expected.elements[index]));
 tracked = false;
 weapons.update(source, frame, {} as XRReferenceSpace, true, new THREE.Vector3(0, 0, -1), true, 20, vi.fn());
 expect(root.children[0].visible).toBe(false);
 weapons.dispose();
});

it("keeps held weapon visuals but suppresses deliberate swings while attacks are disabled", () => {
 const root = new THREE.Group(), grip = new THREE.Matrix4().makeTranslation(.3, 1, -.5);
 const provider = { resolveFpsHeldWeaponTextureState: () => ({ signature: "sword", tileIndex: 1, sourceGlyph: 1, tilesetPath: "test" }),
   createQuestWeaponTexture: () => new THREE.Texture() };
 const weapons = new ControllerWeapons(root, provider), source = { handedness: "right", gripSpace: {}, targetRaySpace: {} } as XRInputSource;
 const frame = { getPose: () => ({ transform: { matrix: grip.elements } }),
   getViewerPose: () => ({ transform: { position: { x: 0, y: 1.6, z: 0 } } }) } as unknown as XRFrame;
 const attack = vi.fn(), aim = new THREE.Vector3(0, 0, -1), reference = {} as XRReferenceSpace;
 for (let i = 1; i <= 9; i++) weapons.update(source, frame, reference, true, aim, false, i * 20, attack);
 for (let i = 10; i <= 21; i++) { grip.elements[12] += .04; weapons.update(source, frame, reference, true, aim, false, i * 20, attack); }
 expect(root.children[0].visible).toBe(true);
 expect(attack).not.toHaveBeenCalled();
 weapons.dispose();
});
