import * as THREE from "three";
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Critically damped exponential response, with zero initial velocity. */
function damp(value: number, velocity: number, target: number, dt: number): [number, number] {
  const omega = 9, offset = value - target, step = (velocity + omega * offset) * dt, decay = Math.exp(-omega * dt);
  return [target + (offset + step) * decay, (velocity - omega * step) * decay];
}
export class LaggingUiAnchor {
  readonly position = new THREE.Vector3();
  yaw = 0;
  private velocity = new THREE.Vector3();
  private yawVelocity = 0;
  private turning = false;
  private moving = false;
  private time: number | null = null;
  reset(position: THREE.Vector3, yaw: number, time: number, keepHeight = false): void {
    const y = keepHeight ? this.position.y : position.y;
    this.position.copy(position); this.position.y = y;
    this.yaw = yaw; this.time = time; this.velocity.set(0, 0, 0); this.yawVelocity = 0;
    this.turning = this.moving = false;
  }
  update(position: THREE.Vector3, yaw: number, time: number): void {
    if (this.time === null) { this.reset(position, yaw, time); return; }
    const dt = Math.min(.1, Math.max(0, (time - this.time) / 1000)); this.time = time;
    const delta = wrap(yaw - this.yaw);
    if (Math.abs(delta) > THREE.MathUtils.degToRad(20)) this.turning = true;
    if (this.turning) {
      [this.yaw, this.yawVelocity] = damp(this.yaw, this.yawVelocity, this.yaw + delta, dt);
      this.yaw = wrap(this.yaw);
      if (Math.abs(wrap(yaw - this.yaw)) < .002 && Math.abs(this.yawVelocity) < .01) {
        this.yaw = yaw; this.yawVelocity = 0; this.turning = false;
      }
    }
    if (Math.hypot(position.x - this.position.x, position.z - this.position.z) > .2) this.moving = true;
    if (this.moving) {
      [this.position.x, this.velocity.x] = damp(this.position.x, this.velocity.x, position.x, dt);
      [this.position.z, this.velocity.z] = damp(this.position.z, this.velocity.z, position.z, dt);
      if (Math.hypot(position.x - this.position.x, position.z - this.position.z) < .002 && this.velocity.length() < .01) {
        this.position.x = position.x; this.position.z = position.z; this.velocity.set(0, 0, 0); this.moving = false;
      }
    }
  }
}
