import * as THREE from "three";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TableControls } from "./TableControls";
import { dragRange, pickUiTarget, pointerEvent } from "./dom-pointer";
import { withoutWorldClipping } from "./overlay-material";
import { NativePointerBridge } from "./native-pointer-bridge";
import { isVisibleUi } from "./visibility";

export interface UiHit { point: THREE.Vector3; distance: number; x: number; y: number; target: HTMLElement }
// 1440p logical viewport, retaining the existing pixels-to-metres ratio.
export const UI_WIDTH = 4.8;
export const UI_HEIGHT = UI_WIDTH * 1440 / 2560;
export const UI_DISTANCE = 1.45;

/** One DOM owns both the native GPU pane and the wired development capture. */
export class HtmlUiPanel {
  private readonly controlsNode = document.createElement("div");
  private readonly controlsRoot: Root;
  readonly nativePointer: NativePointerBridge | null;
  private readonly matrix = new THREE.Matrix4();
  private readonly inverse = new THREE.Matrix4();
  private readonly cursors = new Map<XRInputSource, HTMLDivElement>();
  private readonly hovered = new Map<XRInputSource, UiHit>();
  private pressed: { source: XRInputSource; hit: UiHit; id: number; button: number; startX: number; startY: number; moved: boolean } | null = null;
  private grab: { source: XRInputSource; hand: THREE.Vector3; matrix: THREE.Matrix4 } | null = null;
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
    document.documentElement.classList.toggle("nh3d-xr-native-ui", native);
    document.body.append(this.controlsNode);
    this.controlsRoot = createRoot(this.controlsNode);
    this.controlsRoot.render(createElement(TableControls));
    this.nativePointer = native ? new NativePointerBridge() : null;
    this.canvas = native ? null : Object.assign(document.createElement("canvas"), { width: 2560, height: 1440 });
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
    this.grab = null;
    if (this.nativePointer) { this.nativePointer.recenter(anchor, heading); return; }
    this.matrix.compose(anchor, heading, new THREE.Vector3(1, 1, 1)).multiply(this.anchorOffset);
    this.inverse.copy(this.matrix).invert();
    if (this.mesh) this.matrix.decompose(this.mesh.position, this.mesh.quaternion, this.mesh.scale);
    this.ready = true;
  }
  setFirstPersonAnchor(anchor: THREE.Vector3, yaw: number, revision: number): void {
    if (this.nativePointer) { this.nativePointer.setFirstPersonAnchor(anchor, yaw, revision); return; }
    this.recenter(anchor, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  }
  beginGrab(source: XRInputSource, hand: THREE.Vector3): void {
    if (this.native || this.grab || this.pressed) return;
    this.grab = { source, hand: hand.clone(), matrix: this.matrix.clone() };
  }
  moveGrab(source: XRInputSource, hand: THREE.Vector3): void {
    if (this.grab?.source !== source) return;
    const position = new THREE.Vector3().setFromMatrixPosition(this.grab.matrix).add(hand.clone().sub(this.grab.hand));
    this.matrix.copy(this.grab.matrix).setPosition(position); this.inverse.copy(this.matrix).invert();
    if (this.mesh) this.matrix.decompose(this.mesh.position, this.mesh.quaternion, this.mesh.scale);
  }
  endGrab(source: XRInputSource): void { if (this.grab?.source === source) this.grab = null; }

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
    if (this.pressed?.source === source && !isVisibleUi(this.pressed.hit.target)) this.release(source, null, true);
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
      captured.moved ||= Math.hypot(point.x - captured.startX, point.y - captured.startY) > 10;
      if (captured.button === 0) dragRange(captured.hit.target, point.x);
    }
    const target = captured?.hit.target ?? hit?.target;
    if (target && point) pointerEvent(target, "move", point.x, point.y, id, !!captured, captured?.button ?? 0);
  }

  press(source: XRInputSource, hit: UiHit, id: number, button = 0): void {
    if (this.native) return;
    if (this.pressed) return;
    this.pressed = { source, hit, id, button, startX: hit.x, startY: hit.y, moved: false };
    pointerEvent(hit.target, "down", hit.x, hit.y, id, true, button);
    hit.target.focus({ preventScroll: true });
    if (button === 0) dragRange(hit.target, hit.x);
  }

  release(source: XRInputSource, hit: UiHit | null, cancel = false): void {
    if (this.pressed?.source !== source) return;
    const { hit: initial, id, button, moved } = this.pressed;
    this.pressed = null;
    pointerEvent(initial.target, cancel ? "cancel" : "up", initial.x, initial.y, id, false, button);
    if (!cancel && hit && (initial.target === hit.target || initial.target.contains(hit.target))) {
      if (button === 0) initial.target.click();
      else if (!moved) initial.target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: initial.x, clientY: initial.y }));
    }
  }

  forget(source: XRInputSource): void {
    this.endGrab(source);
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
          context.clearRect(0, 0, 2560, 1440); context.drawImage(bitmap, 0, 0, 2560, 1440);
          this.texture!.needsUpdate = true;
        }
        bitmap.close();
      }).catch((error) => console.warn(error)).finally(() => { this.pending = false; });
  }

  dispose(): void {
    document.documentElement.classList.remove("nh3d-xr-native-ui");
    this.controlsRoot.unmount(); this.controlsNode.remove();
    this.disposed = true;
    this.nativePointer?.dispose();
    for (const source of this.cursors.keys()) this.forget(source);
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    this.texture?.dispose();
  }
}
