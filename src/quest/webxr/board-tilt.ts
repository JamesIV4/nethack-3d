import * as THREE from "three";
import { withoutWorldClipping } from "./overlay-material";

export const DEFAULT_BOARD_PITCH = Math.PI / 3;
export class BoardTilt {
  pitch = DEFAULT_BOARD_PITCH;
  private readonly handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 8, 36),
    withoutWorldClipping(new THREE.MeshBasicMaterial({ color: 0x78d5ff, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false, toneMapped: false })));
  private readonly plane = new THREE.Plane();
  private readonly surface = new THREE.Matrix4();
  private drag: { source: XRInputSource; inverse: THREE.Matrix4; angle: number; pitch: number } | null = null;
  private readonly hovered = new Set<XRInputSource>();
  private area = 1;

  constructor(private readonly root: THREE.Group) {
    this.handle.name = "Board pitch handle"; this.handle.renderOrder = 9999; this.handle.visible = false;
    root.add(this.handle);
  }
  place(center: THREE.Vector3, heading: THREE.Quaternion, visible: boolean, area = 1, scale = 1): void {
    this.area = area;
    this.handle.scale.setScalar(scale);
    this.handle.visible = visible;
    const boardRotation = heading.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch));
    this.handle.position.set(1.425 * area * scale, -0.025 * scale, 0).applyQuaternion(boardRotation).add(center);
    this.handle.quaternion.copy(boardRotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
    this.surface.compose(center, boardRotation, new THREE.Vector3(scale, scale, scale));
    if (!this.drag) this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0).applyQuaternion(heading), this.handle.position);
    if (!visible) this.cancel();
  }
  hit(ray: THREE.Ray): THREE.Vector3 | null {
    if (!this.handle.visible) return null;
    // Raycast in tracking metres, independently of the inverse game-camera scale.
    const transform = new THREE.Matrix4().compose(this.handle.position, this.handle.quaternion, this.handle.scale);
    const localRay = ray.clone().applyMatrix4(transform.clone().invert());
    const point = localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
    if (!point || Math.abs(Math.hypot(point.x, point.y) - 0.18) > 0.045) return null;
    return point.applyMatrix4(transform);
  }
  surfaceHit(ray: THREE.Ray): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    if (!this.handle.visible) return null;
    const local = ray.clone().applyMatrix4(this.surface.clone().invert());
    const point = local.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.002), new THREE.Vector3());
    if (!point || Math.abs(point.x) > 1.4 * this.area || Math.abs(point.z) > 0.95 * this.area) return null;
    return { point: point.applyMatrix4(this.surface), normal: new THREE.Vector3(0, 1, 0).transformDirection(this.surface) };
  }
  hover(source: XRInputSource, over: boolean): void {
    if (over) this.hovered.add(source); else this.hovered.delete(source);
    this.handle.material.opacity = this.drag || this.hovered.size ? 0.9 : 0.2;
  }
  begin(source: XRInputSource, ray: THREE.Ray): void {
    if (this.drag) return;
    const point = ray.intersectPlane(this.plane, new THREE.Vector3());
    if (point) {
      const inverse = new THREE.Matrix4().compose(this.handle.position, this.handle.quaternion, new THREE.Vector3(1, 1, 1)).invert();
      point.applyMatrix4(inverse);
      this.drag = { source, inverse, angle: Math.atan2(point.y, point.x), pitch: this.pitch };
    }
  }
  move(source: XRInputSource, ray: THREE.Ray): void {
    if (this.drag?.source !== source) return;
    const point = ray.intersectPlane(this.plane, new THREE.Vector3());
    if (point) {
      point.applyMatrix4(this.drag.inverse);
      const angle = Math.atan2(point.y, point.x);
      const delta = Math.atan2(Math.sin(angle - this.drag.angle), Math.cos(angle - this.drag.angle));
      this.pitch = THREE.MathUtils.clamp(this.pitch + delta, 0, Math.PI * 0.45);
      this.drag.angle = angle;
    }
  }
  end(source: XRInputSource): void { if (this.drag?.source === source) this.drag = null; this.hover(source, false); }
  cancel(): void { this.drag = null; this.hovered.clear(); this.handle.material.opacity = 0.2; }
  dispose(): void { this.cancel(); this.root.remove(this.handle); this.handle.geometry.dispose(); this.handle.material.dispose(); }
}
