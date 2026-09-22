import * as THREE from "three";
import { VisibleSpriteHits } from "../../game/engine/input/visible-sprite-hit";

/** Retain exact visible-world picking while bounding rays by the rendered board. */
export class WorldRaycast {
  private readonly spriteHits = new VisibleSpriteHits();
  private readonly targets: THREE.Object3D[] = [];
  private readonly intersections: THREE.Intersection[] = [];

  intersect(
    caster: THREE.Raycaster, scene: THREE.Scene,
    excludedRoot: THREE.Object3D, planes: readonly THREE.Plane[],
  ): THREE.Intersection | null {
    if (!scene.visible) return null;
    let near = caster.near, far = caster.far;
    for (const plane of planes) {
      const distance = plane.distanceToPoint(caster.ray.origin) + 1e-6;
      const slope = plane.normal.dot(caster.ray.direction);
      if (slope === 0) {
        if (distance < 0) return null;
      } else if (slope > 0) near = Math.max(near, -distance / slope);
      else far = Math.min(far, -distance / slope);
      if (near > far) return null;
    }
    this.targets.length = 0;
    this.intersections.length = 0;
    // Keep Three's bounding-volume traversal. A separate bounds pass over all
    // revealed tiles costs more than it saves for rays that reach the board.
    for (const child of scene.children) {
      if (child.visible && child !== excludedRoot) this.targets.push(child);
    }
    const originalNear = caster.near, originalFar = caster.far;
    try {
      caster.near = near; caster.far = far;
      caster.intersectObjects(this.targets, true, this.intersections);
      // Keep the original point-level test for tiles crossing the board edge.
      return this.intersections.find(hit => {
        for (let node: THREE.Object3D | null = hit.object; node; node = node.parent) if (!node.visible) return false;
        return planes.every(plane => plane.distanceToPoint(hit.point) >= 0) && this.spriteHits.accepts(hit);
      }) ?? null;
    } finally {
      caster.near = originalNear; caster.far = originalFar;
    }
  }
}
