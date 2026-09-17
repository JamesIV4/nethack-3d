import * as THREE from "three";
import { uiHitRectangles } from "./dom-pointer";
import { tableUiPanes, type UiPane } from "./table-ui-layout";
import { getXrSettings } from "./settings";
import { hasWorldContextAnchor } from "./context-anchor";
import { SystemRecenter } from "./system-recenter";
import { recenterWebXr } from "./presentation";

let nextAnchor = 0;
/** Sends UI regions and hit distances only. Wolvic owns pointer rendering and HTML input. */
export class NativePointerBridge {
  private readonly systemRecenter = new SystemRecenter();
  private revision = ++nextAnchor;
  private rects: number[] = [];
  private panes: UiPane[] = [];
  private firstPerson = false;
  private pitch = Math.PI / 4;
  private boardY = -0.65;
  private anchor = [0, 1.6, 0, 0];
  private firstPersonAnchor = [0, 1.6, 0, 0, 0];
  setFirstPersonAnchor(position: THREE.Vector3, yaw: number, revision: number): void {
    this.firstPersonAnchor = [position.x, position.y, position.z, yaw, revision];
  }
  private contextPoint: THREE.Vector3 | null = null;
  private gameToTracking = new THREE.Matrix4();
  setContextTarget(point: THREE.Vector3): void { this.contextPoint = point; }
  setWorldTransform(matrix: THREE.Matrix4): void { this.gameToTracking.copy(matrix); }
  private controllerOpacity = 0;
  setControllerOpacity(left: number, right: number): void {
    const byte = (value: number) => Math.round(THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1) * 255);
    this.controllerOpacity = byte(left) | (byte(right) << 8);
  }
  private dirty = true;
  private pending = false;
  private disposed = false;
  private lastSend = -Infinity;
  private lastLayout = -Infinity;
  private lastBody = "";
  private readonly hits = [-1, 0, 0, 1, -1, 0, 0, 1];
  private readonly abort = new AbortController();
  private readonly observer = new MutationObserver(() => { this.dirty = true; });
  private readonly resized = (): void => { this.dirty = true; };
  constructor() {
    this.observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    this.observer.observe(document.documentElement, { attributes: true });
    window.addEventListener("resize", this.resized, { signal: this.abort.signal });
    document.addEventListener("scroll", this.resized, { capture: true, signal: this.abort.signal });
    for (const event of ["transitionend", "transitioncancel", "animationend", "animationcancel"]) {
      document.addEventListener(event, this.resized, { capture: true, signal: this.abort.signal });
    }
  }
  recenter(position: THREE.Vector3, heading: THREE.Quaternion): void {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(heading);
    this.anchor = [position.x, position.y, position.z, Math.atan2(-forward.x, -forward.z)];
    this.revision = ++nextAnchor;
  }
  setTablePose(center: THREE.Vector3, heading: THREE.Quaternion): void {
    // Reuse the host's anchor-relative board contract without limiting vertical placement.
    const origin = center.clone().sub(new THREE.Vector3(0,-.65,-1.55).applyQuaternion(heading));
    const forward = new THREE.Vector3(0,0,-1).applyQuaternion(heading);
    this.anchor = [origin.x, origin.y, origin.z, Math.atan2(-forward.x,-forward.z)];
  }
  setBoard(firstPerson: boolean, pitch: number, boardY: number): void {
    if (this.firstPerson !== firstPerson) this.dirty = true;
    this.firstPerson = firstPerson; this.pitch = pitch; this.boardY = boardY;
  }
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
    // CSS animation/ancestor clipping changes need not mutate the DOM.
    if (this.dirty || time-this.lastLayout >= 100) {
      this.rects = uiHitRectangles(); this.panes = tableUiPanes(this.firstPerson, this.rects);
      this.dirty = false; this.lastLayout = time;
    }
    const settings = getXrSettings();
    const context = !!this.contextPoint && hasWorldContextAnchor();
    const point = this.contextPoint?.clone().applyMatrix4(this.gameToTracking) ?? new THREE.Vector3();
    const body = JSON.stringify([this.revision, this.rects.length / 4, ...this.hits,
      this.firstPerson ? 1 : 0, this.pitch, this.boardY, this.panes.length, ...this.anchor,
      settings.area, settings.scale, context ? 1 : 0, ...point.toArray(), ...this.firstPersonAnchor, ...this.rects, ...this.panes.flat()]);
    // Keep a low-frequency heartbeat even when neither controller moves, so
    // the system Meta-button recenter can reach a stationary player.
    const snapshot = body + ":" + this.controllerOpacity;
    if (snapshot === this.lastBody && time - this.lastSend < 500) return;
    this.pending = true; this.lastSend = time;
    void fetch("/__xr/table-ui", { method: "POST", headers: { "Content-Type": "application/json", "X-NH3D-Controller-Opacity": String(this.controllerOpacity) }, body, signal: this.abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Native pointer bridge: " + response.status);
        if (this.disposed) return;
        this.lastBody = snapshot;
        if (this.systemRecenter.accept(response.headers.get("X-NH3D-Recenter"))) recenterWebXr();
      })
      .catch((error) => { if (!this.disposed) console.warn(error); })
      .finally(() => { this.pending = false; });
  }
  dispose(): void { this.disposed = true; this.observer.disconnect(); this.abort.abort(); }
}
