import * as THREE from "three";

const followHalfLifeMs = 180;
const maxShiftXPx = 46;
const maxShiftYPx = 28;
const maxTiltDeg = 5.5;

export default class VrHudFollower {
  private readonly root: HTMLElement | null;
  private readonly forward = new THREE.Vector3();
  private initialized = false;
  private smoothedYaw = 0;
  private smoothedPitch = 0;

  constructor(root: HTMLElement | null) {
    this.root = root;
  }

  update(camera: THREE.Camera & THREE.Object3D, deltaSeconds: number): void {
    if (!this.root) {
      return;
    }

    camera.getWorldDirection(this.forward);
    const currentYaw = Math.atan2(-this.forward.x, -this.forward.z);
    const currentPitch = Math.asin(THREE.MathUtils.clamp(this.forward.y, -1, 1));
    if (!this.initialized) {
      this.initialized = true;
      this.smoothedYaw = currentYaw;
      this.smoothedPitch = currentPitch;
    }

    const alpha =
      1 - Math.exp((-Math.LN2 * deltaSeconds * 1000) / followHalfLifeMs);
    this.smoothedYaw = this.lerpAngle(this.smoothedYaw, currentYaw, alpha);
    this.smoothedPitch = THREE.MathUtils.lerp(
      this.smoothedPitch,
      currentPitch,
      alpha,
    );

    const yawDelta = this.wrapAngle(currentYaw - this.smoothedYaw);
    const pitchDelta = currentPitch - this.smoothedPitch;
    const shiftX = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(yawDelta) * 1.55,
      -maxShiftXPx,
      maxShiftXPx,
    );
    const shiftY = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(-pitchDelta) * 1.1,
      -maxShiftYPx,
      maxShiftYPx,
    );
    const tilt = THREE.MathUtils.clamp(shiftX * -0.1, -maxTiltDeg, maxTiltDeg);

    this.root.style.setProperty("--nh3d-vr-frame-shift-x", `${shiftX.toFixed(2)}px`);
    this.root.style.setProperty("--nh3d-vr-frame-shift-y", `${shiftY.toFixed(2)}px`);
    this.root.style.setProperty("--nh3d-vr-frame-tilt", `${tilt.toFixed(2)}deg`);
  }

  reset(): void {
    this.initialized = false;
    if (!this.root) {
      return;
    }
    this.root.style.setProperty("--nh3d-vr-frame-shift-x", "0px");
    this.root.style.setProperty("--nh3d-vr-frame-shift-y", "0px");
    this.root.style.setProperty("--nh3d-vr-frame-tilt", "0deg");
  }

  private lerpAngle(start: number, end: number, alpha: number): number {
    return start + this.wrapAngle(end - start) * alpha;
  }

  private wrapAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
}
