import * as THREE from "three";
import type { HeldWeapon } from "../../game/engine/rendering/held-weapon";
import { WeaponGesture } from "./weapon-gesture";
import { getXrSettings } from "./settings";
import { useGameStore } from "../../state/gameStore";

export type QuestWeaponProvider = Pick<HeldWeapon,"resolveFpsHeldWeaponTextureState"|"createQuestWeaponTexture"|"measureTextureOpaqueAspectRatio">;
interface Hand { mesh: THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>; signature: string; gesture: WeaponGesture }
export class ControllerWeapons {
  private hands=new Map<XRInputSource,Hand>();
  private nextAttack=0;
  constructor(private root: THREE.Group, private provider: QuestWeaponProvider) {}
  update(source: XRInputSource, frame: XRFrame, reference: XRReferenceSpace, firstPerson: boolean, aim: THREE.Vector3, blocked: boolean, now: number, attack:(aim: THREE.Vector3)=>void): void {
    if (source.handedness!=='left'&&source.handedness!=='right') return;
    let hand=this.hands.get(source);
    if(!hand){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1).translate(0,.5,0),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.03,side:THREE.DoubleSide,toneMapped:false}));mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;this.root.add(mesh);hand={mesh,signature:'',gesture:new WeaponGesture()};this.hands.set(source,hand);}
    const pose=source.gripSpace?frame.getPose(source.gripSpace,reference):null;
    const weapon=firstPerson?this.provider.resolveFpsHeldWeaponTextureState(source.handedness):null;
    hand.mesh.visible=!!pose&&!!weapon;
    if(!weapon){if(hand.mesh.material.map){hand.mesh.material.map.dispose();hand.mesh.material.map=null;hand.signature='';}hand.gesture.reset();return;}
    if(weapon.signature!==hand.signature){hand.mesh.material.map?.dispose();const map=this.provider.createQuestWeaponTexture(weapon);hand.mesh.material.map=map;hand.mesh.material.needsUpdate=true;hand.signature=weapon.signature;hand.mesh.userData.aspect=this.provider.measureTextureOpaqueAspectRatio(map);}
    if(!pose){hand.gesture.reset();return;}
    const grip=new THREE.Matrix4().fromArray(pose.transform.matrix);
    const local=new THREE.Matrix4().compose(new THREE.Vector3(0,0,-.04),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/3),new THREE.Vector3(.4*hand.mesh.userData.aspect,.4,1));
    hand.mesh.matrix.copy(grip).multiply(local);hand.mesh.matrixWorldNeedsUpdate=true;
    const tip=new THREE.Vector3(0,.08,-.28).applyMatrix4(grip);
    const head=frame.getViewerPose(reference)?.transform;
    const extended=!!head&&new THREE.Vector3().setFromMatrixPosition(grip).distanceTo(new THREE.Vector3(head.position.x,head.position.y,head.position.z))>.25;
    const state=useGameStore.getState(), settings=getXrSettings();
    const allowed=settings.swipeAttacks&&extended&&!blocked&&!state.gameOver.active&&state.connectionState==='running'&&!state.loadingVisible&&!state.uiBlockingVisible&&!state.inventory.visible&&!state.question&&!state.directionQuestion&&!state.textInput&&!state.infoMenu&&!state.positionInputActive;
    const gesture=hand.gesture.sample(tip,aim,now,settings.swipeSensitivity,allowed);
    if(gesture&&now>=this.nextAttack){this.nextAttack=now+350;attack(gesture);}
  }
  reset(source: XRInputSource): void { const hand=this.hands.get(source);if(hand){hand.gesture.reset();hand.mesh.visible=false;} }
  forget(source: XRInputSource): void {const hand=this.hands.get(source);if(!hand)return;this.root.remove(hand.mesh);hand.mesh.material.map?.dispose();hand.mesh.material.dispose();hand.mesh.geometry.dispose();this.hands.delete(source);}
  dispose(): void {for(const source of this.hands.keys())this.forget(source);}
}
