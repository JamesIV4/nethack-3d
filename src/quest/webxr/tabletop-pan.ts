import * as THREE from "three";

/**
 * Smooths only the logical center rendered by the tabletop rig. The flat
 * camera keeps its own pan behavior, while XR can give large table moves a
 * deliberate, physical feel.
 */
export class TabletopPan {
  readonly center = new THREE.Vector2();
  private lastTime: number | null = null;
  private initialized = false;

  constructor(readonly halfLifeMs = 500) {}

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
    const alpha = 1 - Math.exp((-Math.LN2 * elapsedMs) / this.halfLifeMs);
    this.center.lerp(target, alpha);
    return this.center;
  }
}
