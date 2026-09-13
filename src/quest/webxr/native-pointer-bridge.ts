import * as THREE from "three";
import { uiHitRectangles } from "./dom-pointer";

let nextAnchor = 0;
/** Sends UI regions and hit distances only. Wolvic owns pointer rendering and HTML input. */
export class NativePointerBridge {
  private revision = ++nextAnchor;
  private rects: number[] = [];
  private dirty = true;
  private pending = false;
  private disposed = false;
  private lastSend = -Infinity;
  private lastBody = "";
  private readonly hits = [-1, 0, 0, 1, -1, 0, 0, 1];
  private readonly abort = new AbortController();
  private readonly observer = new MutationObserver(() => { this.dirty = true; });
  private readonly resized = (): void => { this.dirty = true; };
  constructor() {
    this.observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    window.addEventListener("resize", this.resized, { signal: this.abort.signal });
    document.addEventListener("scroll", this.resized, { capture: true, signal: this.abort.signal });
  }
  recenter(): void { this.revision = ++nextAnchor; }
  hit(hand: XRHandedness, ray: THREE.Ray, point: THREE.Vector3 | null, normal: THREE.Vector3, aim: THREE.Matrix4): void {
    const index = hand === "left" ? 0 : hand === "right" ? 4 : -1;
    if (index < 0) return;
    const localNormal = normal.clone().transformDirection(aim.clone().invert());
    const distance = point ? point.distanceTo(ray.origin) : -1;
    this.hits[index] = Number.isFinite(distance) && distance >= 0 && distance <= 100 ? distance : -1;
    this.hits[index + 1] = localNormal.x; this.hits[index + 2] = localNormal.y; this.hits[index + 3] = localNormal.z;
  }
  forget(hand: XRHandedness): void { if (hand === "left") this.hits[0] = -1; if (hand === "right") this.hits[4] = -1; }
  update(time: number): void {
    if (this.pending || this.disposed || time - this.lastSend < 1000 / 30) return;
    if (this.dirty) { this.rects = uiHitRectangles(); this.dirty = false; }
    const body = JSON.stringify([this.revision, this.rects.length / 4, ...this.hits, ...this.rects]);
    if (body === this.lastBody) return;
    this.pending = true; this.lastSend = time;
    void fetch("/__xr/native-pointer", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: this.abort.signal })
      .then((response) => { if (!response.ok) throw new Error("Native pointer bridge: " + response.status); this.lastBody = body; })
      .catch((error) => { if (!this.disposed) console.warn(error); })
      .finally(() => { this.pending = false; });
  }
  dispose(): void { this.disposed = true; this.observer.disconnect(); this.abort.abort(); }
}
