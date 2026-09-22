import * as THREE from "three";
import type { HeldWeapon } from "../../game/engine/rendering/held-weapon";
import { WeaponGesture } from "./weapon-gesture";
import { getXrSettings, WEBXR_WEAPON_ATTACKS_ENABLED } from "./settings";
import { getWeaponPose, weaponLocalMatrix, weaponPoseKey } from "./weapon-pose";
import { createWeaponVoxelMesh } from "./weapon-voxels";
import { useGameStore } from "../../state/gameStore";

export type QuestWeaponProvider = Pick<HeldWeapon, "resolveFpsHeldWeaponTextureState" | "createQuestWeaponTexture">;
interface Hand { mesh: THREE.InstancedMesh; signature: string; gesture: WeaponGesture; pixelSize: number }
export class ControllerWeapons {
  private hands = new Map<XRInputSource, Hand>();
  private nextAttack = 0;
  constructor(private root: THREE.Group, private provider: QuestWeaponProvider) {}
  update(source: XRInputSource, frame: XRFrame, reference: XRReferenceSpace, firstPerson: boolean,
    aim: THREE.Vector3, blocked: boolean, now: number, attack: (aim: THREE.Vector3) => void): void {
    if (source.handedness !== "left" && source.handedness !== "right") return;
    let hand = this.hands.get(source);
    if (!hand) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ toneMapped: false }), 0);
      mesh.userData.nh3dForeground = true;
      mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
      this.root.add(mesh);
      hand = { mesh, signature: "", gesture: new WeaponGesture(), pixelSize: 1 };
      this.hands.set(source, hand);
    }
    const pose = source.gripSpace ? frame.getPose(source.gripSpace, reference) : null;
    const rayPose = source.targetRaySpace ? frame.getPose(source.targetRaySpace, reference) : null;
    const weapon = firstPerson ? this.provider.resolveFpsHeldWeaponTextureState(source.handedness) : null;
    hand.mesh.visible = !!pose && !!rayPose && !!weapon;
    if (!weapon) {
      if (hand.signature) { this.replaceMesh(hand, new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ toneMapped: false }), 0)); hand.signature = ""; }
      hand.gesture.reset(); return;
    }
    if (weapon.signature !== hand.signature) {
      const map = this.provider.createQuestWeaponTexture(weapon);
      const voxel = createWeaponVoxelMesh(map);
      map.dispose();
      this.replaceMesh(hand, voxel.mesh);
      hand.pixelSize = voxel.pixelSize;
      hand.signature = weapon.signature;
    }
    if (!pose || !rayPose) { hand.gesture.reset(); return; }
    const grip = new THREE.Matrix4().fromArray(pose.transform.matrix);
    const key = weaponPoseKey(weapon.tilesetPath ?? "", weapon.tileIndex, weapon.sourceGlyph);
    hand.mesh.matrix.fromArray(rayPose.transform.matrix).multiply(weaponLocalMatrix(getWeaponPose(weapon.tilesetPath, key), hand.pixelSize));
    hand.mesh.matrixWorldNeedsUpdate = true;
    const tip = new THREE.Vector3(0, .08, -.28).applyMatrix4(grip);
    const head = frame.getViewerPose(reference)?.transform;
    const extended = !!head && new THREE.Vector3().setFromMatrixPosition(grip)
      .distanceTo(new THREE.Vector3(head.position.x, head.position.y, head.position.z)) > .25;
    const state = useGameStore.getState(), settings = getXrSettings();
    const allowed = WEBXR_WEAPON_ATTACKS_ENABLED && settings.swipeAttacks && extended && !blocked && !state.gameOver.active &&
      state.connectionState === "running" && !state.loadingVisible && !state.uiBlockingVisible &&
      !state.inventory.visible && !state.question && !state.directionQuestion && !state.textInput &&
      !state.infoMenu && !state.positionInputActive;
    const gesture = hand.gesture.sample(tip, aim, now, settings.swipeSensitivity, allowed);
    if (gesture && now >= this.nextAttack) { this.nextAttack = now + 350; attack(gesture); }
  }
  reset(source: XRInputSource): void { const hand = this.hands.get(source); if (hand) { hand.gesture.reset(); hand.mesh.visible = false; } }
  private replaceMesh(hand: Hand, mesh: THREE.InstancedMesh): void {
    const old = hand.mesh;
    this.root.remove(old);
    old.geometry.dispose(); (old.material as THREE.Material).dispose();
    old.dispose();
    mesh.userData.nh3dForeground = true;
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.visible = old.visible;
    this.root.add(mesh);
    hand.mesh = mesh;
  }
  forget(source: XRInputSource): void {
    const hand = this.hands.get(source); if (!hand) return;
    this.root.remove(hand.mesh); (hand.mesh.material as THREE.Material).dispose();
    hand.mesh.geometry.dispose(); hand.mesh.dispose(); this.hands.delete(source);
  }
  dispose(): void { for (const source of this.hands.keys()) this.forget(source); }
}
