import * as THREE from "three";

/** Freeze the board plane at press time so moving the view cannot feed back into the drag. */
export class TablePanGesture {
  private readonly toLogical = new THREE.Matrix4();
  private readonly toTracking = new THREE.Matrix4();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly start = new THREE.Vector3();
  private readonly previous = new THREE.Vector3();
  private active = false;
  private moved = false;

  begin(ray: THREE.Ray, trackingToLogical: THREE.Matrix4): void {
    this.cancel();
    this.toLogical.copy(trackingToLogical);
    this.toTracking.copy(trackingToLogical).invert();
    const point = this.point(ray);
    if (!point) return;
    this.start.copy(point); this.previous.copy(point); this.active = true;
  }
  private point(ray: THREE.Ray): THREE.Vector3 | null {
    const point = ray.clone().applyMatrix4(this.toLogical).intersectPlane(this.plane, new THREE.Vector3());
    return point && point.clone().applyMatrix4(this.toTracking).distanceTo(ray.origin) <= 100 ? point : null;
  }
  update(ray: THREE.Ray): THREE.Vector2 | null {
    if (!this.active) return null;
    const point = this.point(ray);
    if (!point) return null;
    const physicalDistance = point.clone().applyMatrix4(this.toTracking).distanceTo(this.start.clone().applyMatrix4(this.toTracking));
    if (!this.moved && physicalDistance < .015) return null;
    this.moved = true;
    const delta = new THREE.Vector2(point.x - this.previous.x, point.y - this.previous.y);
    this.previous.copy(point);
    return delta;
  }
  get dragged(): boolean { return this.moved; }
  cancel(): void { this.active = false; this.moved = false; }
}
