import {ControllerWeapons, type QuestWeaponProvider} from "./controller-weapons";
import * as THREE from "three";
import { useGameStore } from "../../state/gameStore";
import { dispatchQuestKey } from "../native/bootstrap";
import { routeQuestCommand, type QuestNativeCommand, type QuestCommandResult } from "../native/input";
import type { HtmlUiPanel, UiHit } from "./html-ui-panel";
import type { BoardTilt } from "./board-tilt";
import { withoutWorldClipping } from "./overlay-material";
import { SnapTurnLatch, WorldClickGesture } from "./controller-gestures";
import { WorldRaycast } from "./world-raycast";

function command(value: QuestNativeCommand): QuestCommandResult {
  return routeQuestCommand(value, useGameStore.getState(), {
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
interface PointerState {
  source: XRInputSource; id: number; ray: THREE.Ray;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null;
  circle: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null;
  trigger: boolean; a: boolean; down: boolean; tracked: boolean;
  capture: "ui" | "tilt" | "world" | null;
  ui: UiHit | null; ring: THREE.Vector3 | null; world: THREE.Intersection | null;
  buttons: boolean[];
  gesture: WorldClickGesture;
  pressedTile: { x: number; y: number } | null;
  contextHeight: number;
  supportPoint?: THREE.Vector3;
}
export class WebXrControllerInput {
  private readonly pointers = new Map<XRInputSource, PointerState>();
  private nextId = 1;
  private nextMove = 0;
  private readonly snap = new SnapTurnLatch();
  private clock = 0;
  private readonly weapons?: ControllerWeapons;
  // One bounded record lets wired debugging distinguish a missing button from
  // a command rejected by an active prompt, without logging every XR frame.
  readonly diagnostics: { command: QuestNativeCommand; result: QuestCommandResult; time: number }[] = [];
  private command(value: QuestNativeCommand): void {
    this.diagnostics.push({ command: value, result: command(value), time: this.clock });
    if (this.diagnostics.length > 16) this.diagnostics.shift();
  }
  private readonly caster = new THREE.Raycaster();
  private readonly worldRaycast = new WorldRaycast();
  private readonly pickCamera = new THREE.PerspectiveCamera();
  private readonly inverse = new THREE.Matrix4();
  private readonly selectStart = (event: XRInputSourceEvent): void => {
    this.clock = performance.now();
    const state = this.state(event.inputSource);
    this.refresh(state, event.frame); state.trigger = true; this.pressState(state);
  };
  private readonly selectEnd = (event: XRInputSourceEvent): void => {
    this.clock = performance.now();
    const state = this.pointers.get(event.inputSource);
    if (state) { this.refresh(state, event.frame); state.trigger = false; this.pressState(state); }
  };
  constructor(private readonly session: XRSession, private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene, private readonly root: THREE.Group, private readonly tileSize: number,
    private readonly panel: () => HtmlUiPanel | null, private readonly tilt: BoardTilt,
    private readonly onSnapTurn: (direction: -1 | 1) => void = () => {}, weaponProvider?: QuestWeaponProvider) {
    // Paused: controller weapon visuals and swipe/bonk attacks. Keep the
    // implementation for a later revisit; saved settings cannot enable it.
    // if (weaponProvider) this.weapons = new ControllerWeapons(root, weaponProvider);
    if (!panel()?.native) {
      session.addEventListener("selectstart", this.selectStart);
      session.addEventListener("selectend", this.selectEnd);
    }
  }
  private state(source: XRInputSource): PointerState {
    let state = this.pointers.get(source);
    if (state) return state;
    const line = this.panel()?.native ? null : new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      withoutWorldClipping(new THREE.LineBasicMaterial({ color: 0x78d5ff, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false, toneMapped: false })));
    const circle = this.panel()?.native ? null : new THREE.Mesh(new THREE.RingGeometry(0.006, 0.01, 24),
      withoutWorldClipping(new THREE.MeshBasicMaterial({ color: 0x78d5ff, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false })));
    if (line && circle) {
      line.renderOrder = circle.renderOrder = 20000; line.frustumCulled = false;
      this.root.add(line, circle);
    }
    state = { source, id: this.nextId++, ray: new THREE.Ray(), line, circle, trigger: false, a: false,
      down: false, tracked: false, capture: null, ui: null, ring: null, world: null, buttons: [], gesture: new WorldClickGesture(), pressedTile: null, contextHeight: 0 };
    this.pointers.set(source, state);
    return state;
  }
  private refresh(state: PointerState, frame: XRFrame): void {
    const reference = this.renderer.xr.getReferenceSpace();
    const pose = reference && frame.getPose(state.source.targetRaySpace, reference);
    state.tracked = !!pose;
    if (state.line) state.line.visible = !!pose;
    if (state.circle) state.circle.visible = false;
    if (!pose) { this.cancel(state); return; }
    const transform = new THREE.Matrix4().fromArray(pose.transform.matrix);
    state.ray.origin.setFromMatrixPosition(transform);
    state.ray.direction.set(0, 0, -1).transformDirection(transform);
    state.ui = this.panel()?.hit(state.ray) ?? null;
    this.panel()?.hover(state.source, state.ui, state.ray, state.id);
    state.ring = state.ui ? null : this.tilt.hit(state.ray);
    this.tilt.hover(state.source, !!state.ring);
    if (state.capture === "tilt") this.tilt.move(state.source, state.ray);
    state.world = null; state.supportPoint = undefined;
    let point = state.ui?.point ?? state.ring;
    let normal = state.ray.direction.clone().negate();
    if (!point) {
      this.root.updateWorldMatrix(true, false);
      this.inverse.copy(this.root.matrixWorld).invert();
      const worldRay = state.ray.clone().applyMatrix4(this.root.matrixWorld);
      this.caster.ray.copy(worldRay);
      const tracked = this.renderer.xr.getCamera();
      tracked.matrixWorld.decompose(this.pickCamera.position, this.pickCamera.quaternion, new THREE.Vector3());
      this.pickCamera.updateMatrixWorld(true); this.caster.camera = this.pickCamera;
      state.world = this.worldRaycast.intersect(this.caster, this.scene, this.root, this.renderer.clippingPlanes);
      if (state.world) {
        point = state.world.point.clone().applyMatrix4(this.inverse);
        if (state.world.face) normal.copy(state.world.face.normal)
          .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(state.world.object.matrixWorld)).transformDirection(this.inverse);
      }
      const support = this.tilt.surfaceHit(state.ray);
      if (support && (!point || support.point.distanceToSquared(state.ray.origin) < point.distanceToSquared(state.ray.origin))) {
        point = support.point; normal = support.normal; state.world = null; state.supportPoint = this.scene.worldToLocal(support.point.clone().applyMatrix4(this.root.matrixWorld));
      }
    }
    const end = point ?? state.ray.at(5, new THREE.Vector3());
    this.panel()?.nativePointer?.hit(state.source.handedness, state.ray, point, normal, transform);
    if (!state.line || !state.circle) return;
    const positions = state.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, state.ray.origin.x, state.ray.origin.y, state.ray.origin.z);
    positions.setXYZ(1, end.x, end.y, end.z); positions.needsUpdate = true;
    state.circle.visible = !!point && !state.ui;
    if (point) {
      state.circle.position.copy(point).addScaledVector(normal, 0.001);
      state.circle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    }
  }
  private pressState(state: PointerState): void {
    const down = state.trigger || state.a;
    if (down === state.down) return;
    state.down = down;
    if (!down) {
      if (state.capture === "ui") this.panel()?.release(state.source, state.ui);
      if (state.capture === "tilt") this.tilt.end(state.source);
      if (state.capture === "world") {
        const click = state.gesture.release(this.clock);
        if (click) this.worldClick(state, click === "secondary");
      }
      state.capture = null; return;
    }
    if (!state.tracked) return;
    if (state.ui) { state.capture = "ui"; this.panel()?.press(state.source, state.ui, state.id); return; }
    // A world press has the same focus transition as clicking outside an HTML control.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (state.source.handedness === "left") { state.capture = "world"; return; }
    if (state.ring) { state.capture = "tilt"; this.tilt.begin(state.source, state.ray); return; }
    state.capture = "world";
    // A remains the normal confirm key when the UI or tilt handle does not own it.
    if (state.a && !state.trigger) { this.command({ type: "key", key: "Enter" }); return; }
    const hit = state.world;
    let tile: { x: number; y: number } | null = null;
    for (let object: THREE.Object3D | null = hit?.object ?? null; object; object = object.parent) {
      if (Number.isSafeInteger(object.userData.tileX) && Number.isSafeInteger(object.userData.tileY)) {
        tile = { x: object.userData.tileX as number, y: object.userData.tileY as number }; break;
      }
    }
    const logicalHit = hit ? this.scene.worldToLocal(hit.point.clone()) : null;
    if (logicalHit) tile ??= { x: Math.round(logicalHit.x / this.tileSize), y: Math.round(-logicalHit.y / this.tileSize) };
    if (!tile && state.supportPoint) tile = { x: Math.round(state.supportPoint.x / this.tileSize), y: Math.round(-state.supportPoint.y / this.tileSize) };
    state.pressedTile = tile;
    state.contextHeight = logicalHit?.z ?? 0;
    state.gesture.press(this.clock);
  }
  private worldClick(state: PointerState, secondary: boolean): void {
    if (!state.pressedTile && !secondary) return;
    if (secondary && state.pressedTile) this.panel()?.nativePointer?.setContextTarget(
      this.scene.localToWorld(new THREE.Vector3(state.pressedTile.x * this.tileSize, -state.pressedTile.y * this.tileSize, state.contextHeight)));
    this.command({ type: "tile", ...(state.pressedTile ?? { x: 0, y: 0 }), ...(secondary ? { secondary: true } : {}) });
  }
  update(time: number, forward: THREE.Vector3 | null): void {
    this.clock = time;
    const frame = this.renderer.xr.getFrame();
    if (this.session.visibilityState !== "visible" || !frame) {
      for (const state of this.pointers.values()) {
        this.cancel(state);
        if (state.line) state.line.visible = false;
        if (state.circle) state.circle.visible = false;
      }
      return;
    }
    const active = new Set(this.session.inputSources);
    const right = Array.from(active).find(source => source.handedness === "right");
    const game = useGameStore.getState();
    const turningAllowed = !!forward && !game.loadingVisible && !game.uiBlockingVisible && !game.textInput && !game.question && !game.infoMenu && !game.inventory.visible && !document.querySelector(".nh3d-dialog.is-visible,.nh3d-mobile-actions-sheet");
    const turn = this.snap.update(right?.gamepad?.axes[2] ?? right?.gamepad?.axes[0] ?? 0, turningAllowed);
    if (turn) this.onSnapTurn(turn);
    for (const [source, state] of this.pointers) if (!active.has(source)) this.remove(state);
    for (const source of this.session.inputSources) {
      const state = this.state(source);
      this.refresh(state, frame);
      const pad = source.gamepad;
      const buttons = pad?.buttons.map((button) => button.pressed) ?? [];
      const prior = state.buttons; state.buttons = buttons;
      // Keep the release state authoritative even if a runtime drops selectend.
      if (pad) state.trigger = !!buttons[0];
      state.a = source.handedness === "right" && !!buttons[4]; this.pressState(state);
      if (state.capture === "world" && state.down && state.gesture.update(time)) this.worldClick(state, true);
      const reference=this.renderer.xr.getReferenceSpace();
      const nativeUiBlocked=!!this.panel()?.native && source.gamepad?.buttons[1]?.pressed === true;
      if(reference)this.weapons?.update(source,frame,reference,!!forward,state.ray.direction,
        !!state.ui||!!state.ring||!!state.capture||nativeUiBlocked||buttons.some(b=>b)||!!document.querySelector("button:hover,input:hover,select:hover,[role=button]:hover")||!turningAllowed||!!document.querySelector(".nh3d-context-menu.is-visible"),time, aim=>{
          const gameAim=aim.transformDirection(this.root.matrix);
          const length=Math.hypot(gameAim.x,gameAim.y);
          if(length>.1)gameAim.divideScalar(length);else if(forward)gameAim.copy(forward).setZ(0).normalize();
          const direction=xrStickDirection(gameAim.x,-gameAim.y,null);
          if(direction&&(source.handedness==='left'||source.handedness==='right'))this.command({type:"attack",...direction,hand:source.handedness});
        });
      if (state.ui || state.capture === "ui" || state.capture === "tilt") continue;
      if (source.handedness === "left" && pad) {
        const direction = xrStickDirection(pad.axes[2] ?? pad.axes[0] ?? 0, pad.axes[3] ?? pad.axes[1] ?? 0, forward);
        if (direction && time >= this.nextMove) { this.command({ type: "move", ...direction, run: state.trigger }); this.nextMove = time + 180; }
        else if (!direction) this.nextMove = 0;
        if (buttons[4] && !prior[4]) this.command({ type: "inventory" });
      }
      if (source.handedness === "right" && buttons[5] && !prior[5]) this.command({ type: "key", key: "Escape" });
    }
  }
  private cancel(state: PointerState): void {
    this.panel()?.forget(state.source); this.tilt.end(state.source);
    state.gesture.cancel(); state.pressedTile = null; this.weapons?.reset(state.source);
    state.trigger = state.a = state.down = false; state.capture = null; state.ui = null; state.ring = null; state.world = null;
  }
  private remove(state: PointerState): void {
    this.cancel(state); this.weapons?.forget(state.source);
    if (state.line) { this.root.remove(state.line); state.line.geometry.dispose(); state.line.material.dispose(); }
    if (state.circle) { this.root.remove(state.circle); state.circle.geometry.dispose(); state.circle.material.dispose(); }
    this.pointers.delete(state.source);
  }
  dispose(): void {
    this.session.removeEventListener("selectstart", this.selectStart); this.session.removeEventListener("selectend", this.selectEnd);
    for (const state of this.pointers.values()) this.remove(state);
  }
}
