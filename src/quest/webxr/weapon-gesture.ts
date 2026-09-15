import * as THREE from "three";

/** One strike per deliberate motion; a quiet recovery is required to rearm. */
export class WeaponGesture {
  private previous: THREE.Vector3 | null = null;
  private time = 0;
  private travel = 0;
  private peak = 0;
  private started = 0;
  private spent = true;
  private quietSince = 0;
  private aim = new THREE.Vector3(0,0,-1);
  reset(): void { this.previous=null;this.spent=true;this.quietSince=0;this.started=0;this.travel=0;this.peak=0; }
  sample(position: THREE.Vector3, aim: THREE.Vector3, now: number, sensitivity: number, allowed: boolean): THREE.Vector3 | null {
    if (!allowed) { this.reset(); return null; }
    if (!this.previous) { this.previous=position.clone();this.time=now;return null; }
    const dt=(now-this.time)/1000, distance=position.distanceTo(this.previous);
    this.previous.copy(position);this.time=now;
    if (dt<=0 || dt>.15 || distance>.7) { this.reset(); return null; }
    const speed=distance/dt, threshold=1.4/Math.max(.5,Math.min(2.5,sensitivity));
    if (speed<.25) { if (!this.quietSince) this.quietSince=now; } else this.quietSince=0;
    if (this.spent) {
      if (this.quietSince && now-this.quietSince>=120) {this.spent=false;this.travel=0;this.peak=0;this.started=0;}
      return null;
    }
    if (!this.started) {
      if (speed<threshold) return null;
      this.started=now;this.aim.copy(aim);this.travel=0;this.peak=speed;
    }
    this.travel+=distance;this.peak=Math.max(this.peak,speed);
    if (now-this.started>650) {this.reset();return null;}
    const swipe=this.travel>=.22/Math.sqrt(sensitivity) && speed>=threshold*.6;
    const bonk=this.travel>=.08/Math.sqrt(sensitivity) && this.peak>=threshold && speed<.25 && !!this.quietSince && now-this.quietSince>=40;
    if (!swipe&&!bonk) return null;
    this.spent=true;this.quietSince=0;
    return this.aim.clone();
  }
}
