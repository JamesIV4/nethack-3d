import * as THREE from "three";
import type { Camera } from "../camera/camera";

export type FarLookCamera = Pick<Camera,
  "cameraYaw" | "cameraPitch" | "firstPersonEyeHeight" |
  "fpsPositionCursorCameraInitialized" | "fpsPositionCursorCameraCurrent" |
  "fpsPositionCursorLookCurrent" | "fpsPositionCursorReturnActive" |
  "fpsPositionCursorEntryCameraYaw" | "fpsPositionCursorEntryCameraPitch" |
  "positionCursorFarLookOrbitDistance" | "fpsPositionCursorOrbitYaw" |
  "fpsPositionCursorOrbitPitch" | "positionCursorFarLookDefaultPitch">;

/** Apply the desktop orbit to the tracking origin, leaving live head motion intact. */
export class XrFarLook {
  active = false;
  private selecting = false;
  private yaw = 0;
  private pitch = 0;
  private readonly position = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly worldPosition = new THREE.Vector3();
  private readonly offset = new THREE.Matrix4();

  reset(): void { this.active = false; this.selecting = false; }

  prepare(camera: FarLookCamera, selecting: boolean, player: THREE.Vector3): void {
    if (!selecting && !camera.fpsPositionCursorReturnActive) { this.reset(); return; }
    if (!this.active) {
      this.active = true;
      this.yaw = camera.fpsPositionCursorEntryCameraYaw ?? camera.cameraYaw;
      this.pitch = camera.fpsPositionCursorEntryCameraPitch ?? camera.cameraPitch;
      // The orbit position is opposite the nearest cardinal viewing direction.
      // Head pitch must not steepen the pullback or rotate the world.
      camera.fpsPositionCursorOrbitYaw = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2);
      camera.fpsPositionCursorOrbitPitch = camera.positionCursorFarLookDefaultPitch;
      this.forward.set(-Math.sin(this.yaw) * Math.cos(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch));
      this.position.copy(player).setZ(camera.firstPersonEyeHeight);
      this.look.copy(this.position).addScaledVector(this.forward, camera.positionCursorFarLookOrbitDistance);
    }
    // The shared animation must operate on a virtual eye, not a pose already
    // containing roomscale movement. PositionSelection seeds the return from
    // the rendered camera; replace that seed with our last virtual pose once.
    if ((selecting && !camera.fpsPositionCursorCameraInitialized) || (!selecting && this.selecting)) {
      camera.fpsPositionCursorCameraCurrent.copy(this.position);
      camera.fpsPositionCursorLookCurrent.copy(this.look);
      if (selecting) camera.fpsPositionCursorCameraInitialized = true;
    }
    this.selecting = selecting;
    // Do not feed the animated pitch or head motion back into the return target.
    camera.cameraYaw = this.yaw;
    camera.cameraPitch = this.pitch;
  }

  apply(camera: FarLookCamera, rig: THREE.Matrix4, scene: THREE.Matrix4, player: THREE.Vector3): void {
    if (!this.active) return;
    this.position.copy(camera.fpsPositionCursorCameraCurrent);
    this.look.copy(camera.fpsPositionCursorLookCurrent);
    this.eye.copy(player).setZ(camera.firstPersonEyeHeight).applyMatrix4(scene);
    // Translate the tracking origin only. Desktop lookAt would pitch the whole
    // dungeon under a headset; live tracking remains the sole view rotation.
    const position = this.worldPosition.copy(this.position).applyMatrix4(scene).sub(this.eye);
    this.offset.makeTranslation(position.x, position.y, position.z);
    rig.premultiply(this.offset);
  }
}
