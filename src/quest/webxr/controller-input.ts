import * as THREE from "three";
import { useGameStore } from "../../state/gameStore";
import { dispatchQuestKey } from "../native/bootstrap";
import { routeQuestCommand, type QuestNativeCommand } from "../native/input";
import type { WiredHtmlPanel } from "./wired-html-panel";

function command(value: QuestNativeCommand): void {
  routeQuestCommand(value, useGameStore.getState(), {
    hasBlockingOverlay: Boolean(document.querySelector(
      ".nh3d-dialog.is-visible:not(#direction-dialog):not(#inventory-dialog), .nh3d-mobile-actions-sheet, .nh3d-wizard-commands-sheet.is-visible",
    )),
    editableFocused: document.activeElement instanceof HTMLElement && document.activeElement.matches("input,textarea,select,[contenteditable=true]"),
    dispatchKey: dispatchQuestKey,
  });
}
export function xrStickDirection(x: number, y: number, forward: THREE.Vector3 | null): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 0.6) return null;
  const yaw = Math.atan2(x, -y);
  let dx = Math.sin(yaw), dy = -Math.cos(yaw);
  if (forward) {
    const length = Math.hypot(forward.x, forward.y);
    if (length > 0.01) {
      const fx = forward.x / length, fy = -forward.y / length;
      const right = dx, ahead = -dy;
      dx = -fy * right + fx * ahead; dy = fx * right + fy * ahead;
    }
  }
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
  return { dx: Math.round(Math.cos(angle)) as -1 | 0 | 1, dy: Math.round(Math.sin(angle)) as -1 | 0 | 1 };
}
export class WebXrControllerInput {
  private readonly previous = new Map<XRInputSource, boolean[]>();
  private nextMove = 0;
  private readonly rays: { controller: THREE.Group; line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> }[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly selectStart = (event: XRInputSourceEvent): void => {
    if (this.panel()?.selectStart(event)) return;
    const reference = this.renderer.xr.getReferenceSpace();
    const pose = reference && event.frame.getPose(event.inputSource.targetRaySpace, reference);
    if (!pose) return;
    this.matrix.fromArray(pose.transform.matrix).premultiply(this.root.matrixWorld);
    this.position.setFromMatrixPosition(this.matrix);
    this.rotation.setFromRotationMatrix(new THREE.Matrix4().extractRotation(this.matrix));
    this.direction.set(0, 0, -1).applyQuaternion(this.rotation);
    this.ray.set(this.position, this.direction);
    const roots = this.scene.children.filter((child) => child !== this.root);
    const hit = this.ray.intersectObjects(roots, true).find((entry) => {
      for (let parent: THREE.Object3D | null = entry.object; parent; parent = parent.parent) if (!parent.visible) return false;
      return this.renderer.clippingPlanes.every((plane) => plane.distanceToPoint(entry.point) >= 0);
    });
    if (!hit) return;
    let tile: { x: number; y: number } | null = null;
    for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) {
      if (Number.isSafeInteger(object.userData.tileX) && Number.isSafeInteger(object.userData.tileY)) {
        tile = { x: object.userData.tileX as number, y: object.userData.tileY as number }; break;
      }
    }
    tile ??= { x: Math.round(hit.point.x / this.tileSize), y: Math.round(-hit.point.y / this.tileSize) };
    command({ type: "tile", ...tile });
  };
  private readonly selectEnd = (event: XRInputSourceEvent): void => { this.panel()?.selectEnd(event); };
  constructor(
    private readonly session: XRSession, private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene, private readonly root: THREE.Group, private readonly tileSize: number,
    private readonly panel: () => WiredHtmlPanel | null,
  ) {
    if (panel()) for (let index = 0; index < 2; index++) {
      const controller = renderer.xr.getController(index);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(), new THREE.Vector3(0, 0, -3),
      ]), new THREE.LineBasicMaterial({ color: 0x78d5ff, transparent: true, opacity: 0.7 }));
      controller.add(line); root.add(controller); this.rays.push({ controller, line });
    }
    session.addEventListener("selectstart", this.selectStart);
    session.addEventListener("selectend", this.selectEnd);
  }
  update(time: number, forward: THREE.Vector3 | null): void {
    const frame = this.renderer.xr.getFrame();
    if (this.session.visibilityState !== "visible" || !frame) return;
    const active = new Set(this.session.inputSources);
    for (const source of this.previous.keys()) if (!active.has(source)) this.previous.delete(source);
    for (const source of this.session.inputSources) {
      const pad = source.gamepad;
      if (!pad) continue;
      const prior = this.previous.get(source) ?? [];
      const buttons = pad.buttons.map((button) => button.pressed);
      this.previous.set(source, buttons);
      if (this.panel()?.owns(source, frame)) continue;
      if (source.handedness === "left") {
        const direction = xrStickDirection(pad.axes[2] ?? pad.axes[0] ?? 0, pad.axes[3] ?? pad.axes[1] ?? 0, forward);
        if (direction && time >= this.nextMove) { command({ type: "move", ...direction }); this.nextMove = time + 180; }
        else if (!direction) this.nextMove = 0;
        if (buttons[4] && !prior[4]) command({ type: "inventory" });
      }
      if (source.handedness === "right") {
        if (buttons[4] && !prior[4]) command({ type: "key", key: "Enter" });
        if (buttons[5] && !prior[5]) command({ type: "key", key: "Escape" });
      }
    }
  }
  dispose(): void {
    this.session.removeEventListener("selectstart", this.selectStart);
    this.session.removeEventListener("selectend", this.selectEnd);
    this.previous.clear();
    for (const { controller, line } of this.rays) {
      this.root.remove(controller); controller.remove(line); line.geometry.dispose(); line.material.dispose();
    }
    this.rays.length = 0;
  }
}
