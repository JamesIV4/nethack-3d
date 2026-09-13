import * as THREE from "three";
import { dragRange, pickUiTarget, pointerEvent } from "./dom-pointer";
import { withoutWorldClipping } from "./overlay-material";
import { NativePointerBridge } from "./native-pointer-bridge";

export interface UiHit { point: THREE.Vector3; distance: number; x: number; y: number; target: HTMLElement }
export const UI_WIDTH = 3;
export const UI_HEIGHT = UI_WIDTH * 1000 / 1600;
export const UI_DISTANCE = 1.45;

/** One DOM owns both the native GPU pane and the wired development capture. */
export class HtmlUiPanel {
  readonly nativePointer: NativePointerBridge | null;
  private readonly matrix = new THREE.Matrix4();
  private readonly inverse = new THREE.Matrix4();
  private readonly cursors = new Map<XRInputSource, HTMLDivElement>();
  private readonly hovered = new Map<XRInputSource, UiHit>();
  private pressed: { source: XRInputSource; hit: UiHit; id: number } | null = null;
  private ready = false;
  private disposed = false;
  private lastCapture = -Infinity;
  private pending = false;
  private readonly anchorOffset = new THREE.Matrix4().makeTranslation(0, -0.20, -UI_DISTANCE);
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly texture: THREE.CanvasTexture | null;
  private readonly token = new URLSearchParams(location.hash.slice(1)).get("token");

  constructor(private readonly root: THREE.Group, readonly native: boolean) {
    this.nativePointer = native ? new NativePointerBridge() : null;
    this.canvas = native ? null : Object.assign(document.createElement("canvas"), { width: 1600, height: 1000 });
    this.texture = this.canvas ? new THREE.CanvasTexture(this.canvas) : null;
    if (this.texture) {
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.minFilter = THREE.LinearFilter; this.texture.generateMipmaps = false;
    }
    this.mesh = this.texture ? new THREE.Mesh(new THREE.PlaneGeometry(UI_WIDTH, UI_HEIGHT),
      withoutWorldClipping(new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))) : null;
    if (this.mesh) { this.mesh.renderOrder = 10000; root.add(this.mesh); }
  }

  recenter(anchor: THREE.Vector3, heading: THREE.Quaternion): void {
    if (this.nativePointer) { this.nativePointer.recenter(); return; }
    this.matrix.compose(anchor, heading, new THREE.Vector3(1, 1, 1)).multiply(this.anchorOffset);
    this.inverse.copy(this.matrix).invert();
    if (this.mesh) this.matrix.decompose(this.mesh.position, this.mesh.quaternion, this.mesh.scale);
    this.ready = true;
  }

  private coordinates(ray: THREE.Ray, outside = false): Omit<UiHit, "target"> | null {
    if (!this.ready) return null;
    const local = ray.clone().applyMatrix4(this.inverse);
    if (local.direction.z >= -0.00001) return null;
    const t = -local.origin.z / local.direction.z;
    if (t < 0) return null;
    const point = local.at(t, new THREE.Vector3());
    if (!outside && (Math.abs(point.x) > UI_WIDTH / 2 || Math.abs(point.y) > UI_HEIGHT / 2)) return null;
    const x = (point.x / UI_WIDTH + 0.5) * innerWidth;
    const y = (0.5 - point.y / UI_HEIGHT) * innerHeight;
    point.applyMatrix4(this.matrix);
    return { point, distance: ray.origin.distanceTo(point), x, y };
  }

  hit(ray: THREE.Ray): UiHit | null {
    if (this.native) return null;
    const hit = this.coordinates(ray);
    const target = hit && pickUiTarget(hit.x, hit.y);
    return hit && target ? { ...hit, target } : null;
  }

  hover(source: XRInputSource, hit: UiHit | null, ray: THREE.Ray, id: number): void {
    if (this.native) return;
    let cursor = this.cursors.get(source);
    if (!cursor) {
      cursor = document.createElement("div"); cursor.className = "nh3d-xr-pointer";
      document.body.append(cursor); this.cursors.set(source, cursor);
    }
    const prior = this.hovered.get(source);
    if (prior?.target !== hit?.target) {
      if (prior) pointerEvent(prior.target, "out", prior.x, prior.y, id, false);
      if (hit) pointerEvent(hit.target, "over", hit.x, hit.y, id, false);
    }
    if (hit) this.hovered.set(source, hit); else this.hovered.delete(source);
    cursor.hidden = !hit;
    if (hit) { cursor.style.left = hit.x + "px"; cursor.style.top = hit.y + "px"; }
    const captured = this.pressed?.source === source ? this.pressed : null;
    const point = captured ? this.coordinates(ray, true) : hit;
    if (captured && point) {
      captured.hit = { ...point, target: captured.hit.target };
      dragRange(captured.hit.target, point.x);
    }
    const target = captured?.hit.target ?? hit?.target;
    if (target && point) pointerEvent(target, "move", point.x, point.y, id, !!captured);
  }

  press(source: XRInputSource, hit: UiHit, id: number): void {
    if (this.native) return;
    if (this.pressed) return;
    this.pressed = { source, hit, id };
    pointerEvent(hit.target, "down", hit.x, hit.y, id, true);
    hit.target.focus({ preventScroll: true });
    dragRange(hit.target, hit.x);
  }

  release(source: XRInputSource, hit: UiHit | null, cancel = false): void {
    if (this.pressed?.source !== source) return;
    const { hit: initial, id } = this.pressed;
    this.pressed = null;
    pointerEvent(initial.target, cancel ? "cancel" : "up", initial.x, initial.y, id, false);
    if (!cancel && hit && (initial.target === hit.target || initial.target.contains(hit.target))) initial.target.click();
  }

  forget(source: XRInputSource): void {
    this.nativePointer?.forget(source.handedness);
    this.release(source, null, true);
    this.cursors.get(source)?.remove(); this.cursors.delete(source); this.hovered.delete(source);
  }

  update(time: number): void {
    if (this.nativePointer) { this.nativePointer.update(time); return; }
    if (!this.canvas || this.pending || this.disposed || time - this.lastCapture < 100) return;
    this.pending = true; this.lastCapture = time;
    void fetch("/__xr/frame", { headers: { Authorization: "Bearer " + this.token }, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTML capture unavailable"); return response.blob(); })
      .then(createImageBitmap).then((bitmap) => {
        if (!this.disposed) {
          const context = this.canvas!.getContext("2d")!;
          context.clearRect(0, 0, 1600, 1000); context.drawImage(bitmap, 0, 0, 1600, 1000);
          this.texture!.needsUpdate = true;
        }
        bitmap.close();
      }).catch((error) => console.warn(error)).finally(() => { this.pending = false; });
  }

  dispose(): void {
    this.disposed = true;
    this.nativePointer?.dispose();
    for (const source of this.cursors.keys()) this.forget(source);
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    this.texture?.dispose();
  }
}
