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
  private rotation = 0;
  private returnRotation = 0;
  private returnDistance = 0;
  private readonly pivot = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0,0,1);

  reset(): void { this.active = false; this.selecting = false; this.rotation=0; this.returnRotation=0; }

  turn(camera: FarLookCamera, angle: number, cursor: {x:number;y:number}, tileSize: number): void {
    if (!this.active || !this.selecting) return;
    camera.fpsPositionCursorOrbitYaw += angle;
    this.rotation=Math.atan2(Math.sin(this.rotation-angle),Math.cos(this.rotation-angle));
    this.pivot.set(cursor.x*tileSize,-cursor.y*tileSize,0);
    camera.fpsPositionCursorCameraCurrent.sub(this.pivot).applyAxisAngle(this.axis,-angle).add(this.pivot);
    camera.fpsPositionCursorLookCurrent.sub(this.pivot).applyAxisAngle(this.axis,-angle).add(this.pivot);
    this.position.copy(camera.fpsPositionCursorCameraCurrent); this.look.copy(camera.fpsPositionCursorLookCurrent);
  }

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
    if (!selecting && this.selecting) {
      this.returnRotation=this.rotation;
      this.eye.copy(player).setZ(camera.firstPersonEyeHeight);
      this.returnDistance=this.position.distanceTo(this.eye);
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
    if (!this.selecting) {
      this.pivot.copy(player).setZ(camera.firstPersonEyeHeight);
      this.rotation=this.returnRotation*(this.returnDistance>1e-6 ? Math.min(1,this.position.distanceTo(this.pivot)/this.returnDistance) : 0);
    }
    // Orbit yaw follows RS around the selection column; never pitch/roll the
    // dungeon. Returning uses the same progress as the shared camera position.
    this.offset.makeRotationZ(this.rotation);
    const position = this.worldPosition.copy(this.position).applyMatrix4(scene).sub(this.eye.applyMatrix4(this.offset));
    this.offset.setPosition(position);
    rig.premultiply(this.offset);
  }
}
