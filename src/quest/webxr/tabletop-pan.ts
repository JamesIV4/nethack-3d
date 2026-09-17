import { CAMERA_FOLLOW_HALF_LIFE_MS, cameraFollowAlpha } from "../../game/engine/camera/camera-smoothing";
import * as THREE from "three";

/** Tracks the tabletop center using the shared cross-platform camera response. */
export class TabletopPan {
  readonly center = new THREE.Vector2();
  private lastTime: number | null = null;
  private initialized = false;

  constructor(readonly halfLifeMs = CAMERA_FOLLOW_HALF_LIFE_MS) {}

  reset(target?: { x: number; y: number }): void {
    this.lastTime = null;
    this.initialized = target !== undefined;
    if (target) this.center.set(target.x, target.y);
  }

  update(target: { x: number; y: number }, timeMs: number): THREE.Vector2 {
    if (!this.initialized || !Number.isFinite(timeMs)) {
      this.center.set(target.x, target.y);
      this.initialized = true;
      this.lastTime = Number.isFinite(timeMs) ? timeMs : null;
      return this.center;
    }
    const elapsedMs = Math.max(0, timeMs - (this.lastTime ?? timeMs));
    this.lastTime = timeMs;
    const alpha = cameraFollowAlpha(elapsedMs, this.halfLifeMs);
    this.center.lerp(target, alpha);
    return this.center;
  }
}
