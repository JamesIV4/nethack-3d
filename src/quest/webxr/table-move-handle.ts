import * as THREE from "three";
import { withoutWorldClipping } from "./overlay-material";

/** A physical handle moves the entire board in tracking space, independently of map panning. */
export class TableMoveHandle {
  readonly offset = new THREE.Vector3();
  private readonly handle = new THREE.Mesh(
    new THREE.CapsuleGeometry(.025, .5, 4, 12),
    withoutWorldClipping(new THREE.MeshBasicMaterial({ color: 0x78d5ff, transparent: true, opacity: .2, depthTest: false, depthWrite: false, toneMapped: false })),
  );
  private drag: { source: XRInputSource; hand: THREE.Vector3; offset: THREE.Vector3 } | null = null;
  private readonly hovered = new Set<XRInputSource>();
  constructor(private readonly root: THREE.Group) {
    this.handle.name = "Table position handle"; this.handle.visible = false; this.handle.renderOrder = 9999;
    root.add(this.handle);
  }
  place(center: THREE.Vector3, heading: THREE.Quaternion, pitch: number, visible: boolean, area = 1, scale = 1): void {
    this.handle.visible = visible;
    const rotation = heading.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), pitch));
    // In the gap between the near table edge and the HTML scale controls.
    this.handle.position.set(0, -.035 * scale, .99 * area * scale + .15 * scale).applyQuaternion(rotation).add(center);
    this.handle.quaternion.copy(heading).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI/2));
    if (!visible) this.cancel();
  }
  hit(ray: THREE.Ray): THREE.Vector3 | null {
    if (!this.handle.visible) return null;
    const matrix = new THREE.Matrix4().compose(this.handle.position, this.handle.quaternion, new THREE.Vector3(1,1,1));
    const point = ray.clone().applyMatrix4(matrix.clone().invert()).intersectBox(
      new THREE.Box3(new THREE.Vector3(-.045,-.295,-.045),new THREE.Vector3(.045,.295,.045)), new THREE.Vector3());
    return point?.applyMatrix4(matrix) ?? null;
  }
  hover(source: XRInputSource, over: boolean): void {
    if (over) this.hovered.add(source); else this.hovered.delete(source);
    this.handle.material.opacity = this.drag || this.hovered.size ? .9 : .2;
  }
  begin(source: XRInputSource, hand: THREE.Vector3): void {
    if (this.drag) return;
    this.drag = { source, hand: hand.clone(), offset: this.offset.clone() };
    this.hover(source, true);
  }
  move(source: XRInputSource, hand: THREE.Vector3): void {
    if (this.drag?.source !== source || !hand.toArray().every(Number.isFinite)) return;
    this.offset.copy(hand).sub(this.drag.hand).multiplyScalar(2).add(this.drag.offset);
  }
  end(source: XRInputSource): void { if (this.drag?.source === source) this.drag = null; this.hover(source, false); }
  cancel(): void { this.drag = null; this.hovered.clear(); this.handle.material.opacity = .2; }
  reset(): void { this.cancel(); this.offset.set(0,0,0); }
  dispose(): void { this.cancel(); this.root.remove(this.handle); this.handle.geometry.dispose(); this.handle.material.dispose(); }
}
