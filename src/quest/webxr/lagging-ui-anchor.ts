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
  private readonly targetPosition = new THREE.Vector3();
  private targetYaw = 0;
  private time: number | null = null;
  reset(position: THREE.Vector3, yaw: number, time: number, keepHeight = false): void {
    const y = keepHeight ? this.position.y : position.y;
    this.position.copy(position); this.position.y = y;
    this.yaw = yaw; this.time = time; this.velocity.set(0, 0, 0); this.yawVelocity = 0;
    this.targetPosition.copy(this.position); this.targetYaw = yaw;
    this.turning = this.moving = false;
  }
  update(position: THREE.Vector3, yaw: number, time: number, snapYaw?: (yaw:number)=>number): void {
    if (this.time === null) { this.reset(position, snapYaw ? snapYaw(yaw) : yaw, time); return; }
    const dt = Math.min(.1, Math.max(0, (time - this.time) / 1000)); this.time = time;
    if (Math.abs(wrap(yaw - this.targetYaw)) >= 46 * Math.PI / 180 ||
        Math.hypot(position.x - this.targetPosition.x, position.z - this.targetPosition.z) > .2) {
      this.targetYaw = snapYaw ? snapYaw(yaw) : yaw; this.targetPosition.set(position.x, this.position.y, position.z);
      this.turning = this.moving = true;
    }
    if (this.turning) {
      if (snapYaw) { this.yaw=this.targetYaw; this.yawVelocity=0; this.turning=false; }
      else {
        [this.yaw, this.yawVelocity] = damp(this.yaw, this.yawVelocity, this.yaw + wrap(this.targetYaw - this.yaw), dt);
        this.yaw = wrap(this.yaw);
        if (Math.abs(wrap(this.targetYaw - this.yaw)) < .002 && Math.abs(this.yawVelocity) < .01) {
          this.yaw = this.targetYaw; this.yawVelocity = 0; this.turning = false;
        }
      }
    }
    if (this.moving) {
      [this.position.x, this.velocity.x] = damp(this.position.x, this.velocity.x, this.targetPosition.x, dt);
      [this.position.z, this.velocity.z] = damp(this.position.z, this.velocity.z, this.targetPosition.z, dt);
      if (Math.hypot(this.targetPosition.x - this.position.x, this.targetPosition.z - this.position.z) < .002 && this.velocity.length() < .01) {
        this.position.copy(this.targetPosition); this.velocity.set(0, 0, 0); this.moving = false;
      }
    }
  }
}
