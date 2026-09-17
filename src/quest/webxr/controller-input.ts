import {ControllerWeapons, type QuestWeaponProvider} from "./controller-weapons";
import { createControllerLaser } from "./controller-laser";
import * as THREE from "three";
import { useGameStore } from "../../state/gameStore";
import { dispatchQuestKey } from "../native/bootstrap";
import { questDirectionKey, routeQuestCommand, type QuestNativeCommand, type QuestCommandResult } from "../native/input";
import { directionPromptOverlayPlayerTileUserData } from "../../game/DirectionPromptOverlay";
import { MINIMAP_HEIGHT_TILES, MINIMAP_WIDTH_TILES } from "../../game/engine/shared/constants";
import type { HtmlUiPanel, UiHit } from "./html-ui-panel";
import type { BoardTilt } from "./board-tilt";
import { withoutWorldClipping } from "./overlay-material";
import { SnapTurnLatch, WorldClickGesture } from "./controller-gestures";
import { WorldRaycast } from "./world-raycast";
import { TablePanGesture } from "./table-pan-gesture";
import type { TableMoveHandle } from "./table-move-handle";

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
  capture: "ui" | "tilt" | "world" | "table" | "direction" | null;
  ui: UiHit | null; ring: THREE.Vector3 | null; world: THREE.Intersection | null;
  buttons: boolean[];
  gesture: WorldClickGesture;
  pressedTile: { x: number; y: number } | null;
  contextPoint: THREE.Vector3 | null;
  directionInput: string | null; capturedDirectionInput: string | null;
  fpsVoidTargeting: boolean;
  voidDirection: {dx:number;dy:number} | null;
  voidTarget: boolean;
  grip: boolean; gripCapture: "ui" | "world" | "table" | null; primaryBlocked: boolean; gripBlocked: boolean;
  tableHandle: THREE.Vector3 | null; hand: THREE.Vector3;
  pan: TablePanGesture;
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
    private readonly onSnapTurn: (direction: -1 | 1) => void = () => {}, weaponProvider?: QuestWeaponProvider,
    private readonly onPan: (dx: number, dy: number) => void = () => {},
    private readonly tableMove?: TableMoveHandle,
    private readonly navigation?: { playerTile: () => {x:number;y:number}; direction: (dx:number,dy:number) => {dx:number;dy:number} | null }) {
    if (weaponProvider) this.weapons = new ControllerWeapons(root, weaponProvider);
    if (!panel()?.native) {
      session.addEventListener("selectstart", this.selectStart);
      session.addEventListener("selectend", this.selectEnd);
    }
  }
  private state(source: XRInputSource): PointerState {
    let state = this.pointers.get(source);
    if (state) return state;
    const line = this.panel()?.native ? null : createControllerLaser();
    const circle = this.panel()?.native ? null : new THREE.Mesh(new THREE.RingGeometry(0.006, 0.01, 24),
      withoutWorldClipping(new THREE.MeshBasicMaterial({ color: 0x78d5ff, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false })));
    if (line && circle) {
      line.renderOrder = circle.renderOrder = 20000; line.frustumCulled = false;
      this.root.add(line, circle);
    }
    state = { source, id: this.nextId++, ray: new THREE.Ray(), line, circle, trigger: false, a: false,
      down: false, tracked: false, capture: null, ui: null, ring: null, world: null, buttons: [], gesture: new WorldClickGesture(), pressedTile: null, contextPoint: null,
      directionInput: null, capturedDirectionInput: null, fpsVoidTargeting: false, voidDirection: null, voidTarget: false, grip: false, gripCapture: null, primaryBlocked: false, gripBlocked: false, pan: new TablePanGesture(), tableHandle: null, hand: new THREE.Vector3() };
    this.pointers.set(source, state);
    return state;
  }
  private refresh(state: PointerState, frame: XRFrame, fpsVoidTargeting = false): void {
    state.fpsVoidTargeting = fpsVoidTargeting;
    const reference = this.renderer.xr.getReferenceSpace();
    const pose = reference && frame.getPose(state.source.targetRaySpace, reference);
    state.tracked = !!pose;
    if (state.line) state.line.visible = !!pose;
    if (state.circle) state.circle.visible = false;
    if (!pose) { this.cancel(state); return; }
    const transform = new THREE.Matrix4().fromArray(pose.transform.matrix);
    const gripPose = state.source.gripSpace ? frame.getPose(state.source.gripSpace, reference!) : pose;
    state.hand.setFromMatrixPosition(gripPose ? new THREE.Matrix4().fromArray(gripPose.transform.matrix) : transform);
    if (state.capture === "table" || state.gripCapture === "table") this.tableMove?.move(state.source, state.hand);
    if (state.gripCapture === "ui") this.panel()?.moveGrab(state.source, state.hand);
    state.ray.origin.setFromMatrixPosition(transform);
    state.ray.direction.set(0, 0, -1).transformDirection(transform);
    state.ui = this.panel()?.hit(state.ray) ?? null;
    this.panel()?.hover(state.source, state.ui, state.ray, state.id);
    state.ring = state.ui ? null : this.tilt.hit(state.ray);
    state.tableHandle = state.ui ? null : this.tableMove?.hit(state.ray) ?? null;
    this.tableMove?.hover(state.source, !!state.tableHandle);
    this.tilt.hover(state.source, !!state.ring);
    if (state.capture === "tilt") this.tilt.move(state.source, state.ray);
    state.world = null; state.supportPoint = undefined;
    let point = state.ui?.point ?? state.tableHandle ?? state.ring;
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
    state.directionInput = this.resolveDirectionPromptRayInput(state);
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
    if (!down) state.primaryBlocked = false;
    if (state.grip || state.primaryBlocked) { state.down = down; return; }
    if (down === state.down) return;
    state.down = down;
    if (!down) {
      if (state.capture === "ui") this.panel()?.release(state.source, state.ui);
      if (state.capture === "tilt") this.tilt.end(state.source);
      if (state.capture === "table") this.tableMove?.end(state.source);
      if (state.capture === "direction" && state.capturedDirectionInput) this.command({ type: "direction", key: state.capturedDirectionInput });
      if (state.capture === "world") {
        const click = state.gesture.release(this.clock);
        if (click) this.worldClick(state, click === "secondary");
      }
      state.capture = null; state.capturedDirectionInput = null; return;
    }
    if (!state.tracked) return;
    if (state.ui) { state.capture = "ui"; this.panel()?.press(state.source, state.ui, state.id); return; }
    // Direction prompts own the primary trigger before world items, monsters,
    // walls, or ordinary tiles can turn it into a gameplay action.
    if (state.directionInput) { state.capture = "direction"; state.capturedDirectionInput = state.directionInput; return; }
    // A world press has the same focus transition as clicking outside an HTML control.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (state.source.handedness === "left") { state.capture = "world"; return; }
    if (state.tableHandle) { state.capture = "table"; this.tableMove?.begin(state.source, state.hand); return; }
    if (state.ring) { state.capture = "tilt"; this.tilt.begin(state.source, state.ray); return; }
    state.capture = "world";
    this.captureTile(state);
    state.gesture.press(this.clock, !state.a);
  }
  private captureTile(state: PointerState): void {
    const tile = this.getRayTile(state);
    state.pressedTile = tile?.tile ?? null;
    // Freeze the exact visible hit at press time, independently of the tile
    // owning a billboard and of later controller motion during a long press.
    state.contextPoint = state.world?.point.clone() ?? (state.supportPoint
      ? this.scene.localToWorld(state.supportPoint.clone())
      : tile ? this.scene.localToWorld(new THREE.Vector3(tile.tile.x * this.tileSize, -tile.tile.y * this.tileSize, tile.height)) : null);
    const player = this.navigation?.playerTile();
    state.voidTarget = !!tile?.empty && !!player;
    state.voidDirection = tile?.empty && player ? this.navigation!.direction(tile.tile.x-player.x,tile.tile.y-player.y) : null;
  }
  private getRayTile(state: PointerState): { tile: { x: number; y: number }; height: number; empty: boolean } | null {
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
    const empty = !tile && state.fpsVoidTargeting;
    if (empty) {
      // FPS has no tabletop tilt surface. Transform the tracking ray through
      // the game root, then resolve the logical z=0 map plane in X/Y.
      this.scene.updateWorldMatrix(true, false);
      const planeRay = state.ray.clone().applyMatrix4(this.root.matrixWorld)
        .applyMatrix4(this.scene.matrixWorld.clone().invert());
      if (Math.abs(planeRay.direction.z) > 0.00001) {
        const distance = -planeRay.origin.z / planeRay.direction.z;
        if (distance >= 0) {
          const point = planeRay.at(distance, new THREE.Vector3());
          const x = Math.round(point.x / this.tileSize), y = Math.round(-point.y / this.tileSize);
          if (x >= 0 && x < MINIMAP_WIDTH_TILES && y >= 0 && y < MINIMAP_HEIGHT_TILES) tile = { x, y };
        }
      }
      if (!tile && this.navigation) {
        const direction = this.navigation.direction(planeRay.direction.x,-planeRay.direction.y);
        const player = this.navigation.playerTile();
        if (direction) {
          const x=player.x+direction.dx, y=player.y+direction.dy;
          if (x>=0 && x<MINIMAP_WIDTH_TILES && y>=0 && y<MINIMAP_HEIGHT_TILES) tile={x,y};
        }
      }
    }
    return tile ? { tile, height: logicalHit?.z ?? 0, empty } : null;
  }
  private resolveDirectionPromptRayInput(state: PointerState): string | null {
    const game = useGameStore.getState();
    if (!game.directionQuestion) return null;
    for (let object: THREE.Object3D | null = state.world?.object ?? null; object; object = object.parent) {
      switch (object.userData.directionPromptOverlayButtonId) {
        case "northwest": return questDirectionKey(-1, -1, game.numberPadModeEnabled);
        case "north": return questDirectionKey(0, -1, game.numberPadModeEnabled);
        case "northeast": return questDirectionKey(1, -1, game.numberPadModeEnabled);
        case "west": return questDirectionKey(-1, 0, game.numberPadModeEnabled);
        case "self": return "s";
        case "east": return questDirectionKey(1, 0, game.numberPadModeEnabled);
        case "southwest": return questDirectionKey(-1, 1, game.numberPadModeEnabled);
        case "south": return questDirectionKey(0, 1, game.numberPadModeEnabled);
        case "southeast": return questDirectionKey(1, 1, game.numberPadModeEnabled);
        case "up": return "<";
        case "down": return ">";
      }
    }
    const target = this.getRayTile(state)?.tile;
    const player = this.navigation?.playerTile();
    const playerX = player?.x ?? this.scene.userData[directionPromptOverlayPlayerTileUserData.x];
    const playerY = player?.y ?? this.scene.userData[directionPromptOverlayPlayerTileUserData.y];
    if (!target || !Number.isSafeInteger(playerX) || !Number.isSafeInteger(playerY)) return null;
    const direction = this.navigation?.direction(target.x-playerX,target.y-playerY) ?? {dx:Math.sign(target.x-playerX),dy:Math.sign(target.y-playerY)};
    if (!direction.dx && !direction.dy) return "s";
    return questDirectionKey(direction.dx, direction.dy, game.numberPadModeEnabled);
  }
  private updateGrip(state: PointerState, down: boolean, tabletop: boolean): void {
    if (state.gripBlocked) { if (!down) state.gripBlocked = false; return; }
    const game = useGameStore.getState();
    const blocked = game.loadingVisible || game.uiBlockingVisible || game.textInput || game.question || game.directionQuestion || game.infoMenu || game.inventory.visible || game.newGamePrompt.visible || game.gameOver.active || game.connectionState !== "running" ||
      !!document.querySelector(".nh3d-dialog.is-visible,.nh3d-context-menu.is-visible,.nh3d-mobile-actions-sheet,.nh3d-wizard-commands-sheet.is-visible");
    if (down && !state.grip) {
      state.grip = true; state.primaryBlocked = true;
      if (state.capture === "ui") this.panel()?.release(state.source, null, true);
      if (state.capture === "tilt") this.tilt.end(state.source);
      if (state.capture === "table") this.tableMove?.end(state.source);
      state.capture = null; state.gesture.cancel();
      if (!state.tracked) return;
      if (state.ui) { state.gripCapture = "ui"; this.panel()?.beginGrab(state.source, state.hand); return; }
      if (!blocked && state.tableHandle) { state.gripCapture = "table"; this.tableMove?.begin(state.source, state.hand); return; }
      if (blocked || (tabletop && !state.world && !state.supportPoint)) return;
      state.gripCapture = "world";
      this.captureTile(state);
      if (tabletop) {
        const toLogical = this.scene.matrixWorld.clone().invert().multiply(this.root.matrixWorld);
        state.pan.begin(state.ray, toLogical);
      }
    }
    if (state.gripCapture === "world" && blocked) { state.gripCapture = null; state.pan.cancel(); }
    if ((down || state.grip) && state.gripCapture === "world" && tabletop) {
      const delta = state.pan.update(state.ray);
      if (delta) this.onPan(delta.x, delta.y);
    }
    if (!down && state.grip) {
      if (state.gripCapture === "ui") this.panel()?.endGrab(state.source);
      if (state.gripCapture === "table") this.tableMove?.end(state.source);
      if (state.gripCapture === "world" && !state.pan.dragged) this.worldClick(state, true);
      state.grip = false; state.gripCapture = null; state.pan.cancel();
    }
  }
  private worldClick(state: PointerState, secondary: boolean): void {
    if (!secondary && state.voidTarget) { if (state.voidDirection) this.command({type:"move",...state.voidDirection,run:true}); return; }
    if (!state.pressedTile) return;
    if (secondary && state.contextPoint) this.panel()?.nativePointer?.setContextTarget(state.contextPoint);
    this.command({ type: "tile", ...state.pressedTile, ...(secondary ? { secondary: true } : {}) });
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
      this.refresh(state, frame, Boolean(forward));
      const pad = source.gamepad;
      const buttons = pad?.buttons.map((button) => button.pressed) ?? [];
      const prior = state.buttons; state.buttons = buttons;
      // Keep the release state authoritative even if a runtime drops selectend.
      if (pad) state.trigger = !!buttons[0];
      state.a = source.handedness === "right" && !!buttons[4];
      this.updateGrip(state, !!buttons[1], !forward);
      this.pressState(state);
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
      if (state.grip || state.ui || state.capture === "ui" || state.capture === "tilt" || state.capture === "table" || state.capture === "direction") continue;
      if (source.handedness === "left" && pad) {
        const direction = xrStickDirection(pad.axes[2] ?? pad.axes[0] ?? 0, pad.axes[3] ?? pad.axes[1] ?? 0, forward);
        if (direction && time >= this.nextMove) { this.command({ type: "move", ...direction, run: state.trigger }); this.nextMove = time + 180; }
        else if (!direction) this.nextMove = 0;
        if (buttons[4] && !prior[4]) this.command({ type: "inventory" });
        if (buttons[5] && !prior[5]) this.command({ type: "search" });
      }
      if (source.handedness === "right" && buttons[5] && !prior[5]) this.command({ type: "key", key: "Escape" });
    }
  }
  private cancel(state: PointerState): void {
    this.panel()?.forget(state.source); this.tilt.end(state.source);
    this.panel()?.endGrab(state.source); this.tableMove?.end(state.source);
    state.gesture.cancel(); state.pressedTile = null; state.contextPoint = null; state.voidDirection = null; state.voidTarget = false; this.weapons?.reset(state.source);
    state.gripBlocked ||= state.grip;
    state.primaryBlocked ||= state.down || state.grip;
    state.grip = false; state.gripCapture = null; state.pan.cancel();
    state.trigger = state.a = state.down = false; state.capture = null; state.directionInput = state.capturedDirectionInput = null; state.ui = null; state.ring = null; state.world = null;
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
    this.weapons?.dispose();
  }
}
