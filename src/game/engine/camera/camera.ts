import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import {
  resolveTerminalPhysicalCellWidth,
  shouldShowTerminalGutterMinimap,
  snapTerminalCameraCenterToPixelGrid
} from "../../terminal/terminal-display";
import { nh3dFpsLookSensitivityMax, nh3dFpsLookSensitivityMin } from "../../ui-types";
import type { AimDirection } from "../shared/types";
import type { BloodParticles } from "../effects/blood-particles";
import type { DamageNumbers } from "../effects/damage-numbers";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { HeldWeapon } from "../rendering/held-weapon";
import type { Minimap } from "../ui/minimap";
import type { MouseInput } from "../input/mouse-input";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";

export interface CameraDependencies {
  readonly bloodParticles: Pick<
    BloodParticles,
    "damageParticles"
  >;
  readonly damageNumbers: Pick<
    DamageNumbers,
    "playerDamageNumberParticles"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
    | "updateDirectionPromptOverlayState"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "playMode"
  >;
  readonly heldWeapon: Pick<
    HeldWeapon,
    "applyFpsHeldWeaponSwayImpulse"
  >;
  readonly minimap: Pick<
    Minimap,
    "setTerminalGutterMinimapState"
  >;
  readonly mouseInput: Pick<
    MouseInput,
    "isMiddleMouseDown"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "getDirectionInputFromMapDelta"
    | "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "isFpsFarLookViewActive"
    | "positionCursor"
    | "positionCursorColumnHeight"
    | "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isAnyModalVisible"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
    | "refreshTerminalCellMaterialsForRasterScale"
    | "terminalCellAspect"
    | "terminalMapColumns"
    | "terminalMapRows"
    | "terminalRasterCellWidthPx"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "isVultureTilesActive"
    | "getWorldTileScaleX"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "schedulePendingTileFlush"
    | "pendingTileUpdates"
  >;
}

/** Camera ownership, smoothing, yaw snapping, player step motion and projection. */
export class Camera {
  constructor(private readonly dependencies: CameraDependencies) {}

  camera!: THREE.PerspectiveCamera;
  private readonly tileAspectCamera = new THREE.PerspectiveCamera();
  private readonly tileAspectLookTarget = new THREE.Vector3();


  // --- Terminal display mode ---
  // Simulated-terminal presentation: flat cells with runtime-exact glyphs and
  // colors, rendered through a dedicated top-down orthographic camera.
  terminalCamera: THREE.OrthographicCamera | null = null;

  // Camera distance at which the terminal view renders at its fitted scale.
  readonly terminalFitCameraDistance: number = 20;

  // Smallest readable cell width at Terminal's starting zoom. Small screens
  // begin in follow-scroll rather than shrinking below this size.
  readonly terminalMinCellPx: number = 14;

  // Explicit zooming can shrink cells further for a whole-level overview.
  readonly terminalZoomOutMinCellPx: number = 2;

  readonly terminalMaxCellPx: number = 96;

  readonly terminalMaxCameraDistance: number = 160;

  readonly positionCursorFarLookOrbitDistance: number = TILE_SIZE * 4.4;

  readonly positionCursorFarLookHeightBias: number = WALL_HEIGHT * 0.18;

  readonly positionCursorFarLookDefaultPitch: number = Math.PI / 4;

  readonly positionCursorFarLookFollowHalfLifeMs: number = 115;

  readonly positionCursorFarLookManualFollowHalfLifeMs: number = 34;

  readonly positionCursorFarLookManualOverrideWindowMs: number = 220;

  readonly positionCursorFarLookReturnHalfLifeMs: number = 52;

  readonly positionCursorFarLookLookSensitivityScale: number = 0.5;

  readonly positionCursorFarLookCornerRadius: number = TILE_SIZE * 0.14;

  readonly positionCursorFarLookFocusHeightRatio: number = 0.56;

  fpsPositionCursorCameraInitialized: boolean = false;

  fpsPositionCursorCameraCurrent: THREE.Vector3 = new THREE.Vector3();

  fpsPositionCursorLookCurrent: THREE.Vector3 = new THREE.Vector3();

  fpsPositionCursorManualOverrideUntilMs: number = 0;

  fpsPositionCursorEntryCameraYaw: number | null = null;

  fpsPositionCursorEntryCameraPitch: number | null = null;

  fpsPositionCursorOrbitYaw: number = 0;

  fpsPositionCursorOrbitPitch: number = 0;

  fpsPositionCursorReturnActive: boolean = false;

  readonly defaultFpsCameraFov = 62;

  readonly firstPersonEyeHeight = WALL_HEIGHT * 0.62;

  readonly firstPersonPitchMin = -Math.PI / 2 + 0.03;

  readonly firstPersonPitchMax = 1.18;

  readonly firstPersonMouseSensitivity = 0.0026;

  readonly fpsDiagonalAimBias = 0.035;

  fpsStepCameraActive: boolean = false;

  fpsStepCameraStartMs: number = 0;

  readonly fpsStepCameraBaseDurationMs: number = 92;

  readonly fpsStepCameraRunDurationMs: number = 46;

  readonly fpsStepCameraRunInputWindowMs: number = 220;

  readonly fpsStepCameraRapidDurationScale: number = 0.75;

  readonly fpsStepCameraMinDurationMs: number = 28;

  runtimeTravelStepDelayMs: number = 0;

  fpsStepCameraDurationMs: number = this.fpsStepCameraBaseDurationMs;

  lastSharedStepMotionStartedAtMs: number = 0;

  lastSharedStepMotionDurationMs: number =
    this.fpsStepCameraBaseDurationMs;

  readonly fpsAutoMoveDetectionWindowMs: number = 120;

  lastManualDirectionalInputAtMs: number = 0;

  lastRunLikeInputAtMs: number = 0;

  fpsAutoMoveDirection: { dx: number; dy: number } | null = null;

  fpsAutoTurnTargetYaw: number | null = null;

  readonly fpsAutoTurnSpeedRadPerSec: number = 8.8;

  fpsStepCameraFrom = new THREE.Vector3();

  fpsStepCameraTo = new THREE.Vector3();

  fpsStepCameraTargetTile: { x: number; y: number } | null = null;

  /** Samples the active FPS step without advancing its completion or tile-flush lifecycle. */
  sampleFpsStepCameraGroundPosition(target: THREE.Vector3, now: number = performance.now()): boolean {
    if (!this.fpsStepCameraActive) return false;
    const progress = THREE.MathUtils.clamp(
      (now - this.fpsStepCameraStartMs) / Math.max(1, this.fpsStepCameraDurationMs),
      0,
      1,
    );
    const eased = 1 - Math.pow(1 - progress, 3);
    target.set(
      THREE.MathUtils.lerp(this.fpsStepCameraFrom.x, this.fpsStepCameraTo.x, eased),
      THREE.MathUtils.lerp(this.fpsStepCameraFrom.y, this.fpsStepCameraTo.y, eased),
      0,
    );
    return true;
  }

  /** Recenter at the authoritative grid; let the normal camera frame finish/flush the step. */
  snapFpsStepToPlayer(): void {
    if (!this.fpsStepCameraActive) return;
    const player = this.dependencies.playerMovement.playerPos;
    this.fpsStepCameraTo.set(player.x * TILE_SIZE, -player.y * TILE_SIZE, this.firstPersonEyeHeight);
    this.fpsStepCameraFrom.copy(this.fpsStepCameraTo);
    this.fpsStepCameraStartMs = performance.now() - Math.max(1,this.fpsStepCameraDurationMs);
  }


  // Camera controls
  cameraDistance: number = 20;

  cameraPitch: number = Math.PI / 2 - 0.3;
 // Elevation above the board (0 = horizon)
  cameraYaw: number = 0;
 // Azimuth around the board (0 = facing north)
  readonly vultureIsometricYawOffset: number = -Math.PI / 4;

  readonly vultureIsometricPitch: number = THREE.MathUtils.degToRad(43);

  readonly minCameraPitch: number = 0.2;

  readonly maxCameraPitch: number = Math.PI / 2 - 0.01;

  readonly rotationSpeed: number = 0.01;

  readonly cameraYawSnapStepRadians: number = Math.PI / 4;

  readonly cameraYawSnapLerpSpeed: number = 10.5;

  readonly cameraYawSnapEpsilon: number = Math.PI / 1800;
 // 0.1 degrees
  cameraYawSnapTarget: number | null = null;

  minDistance: number = 5;

  maxDistance: number = 50;


  // Camera panning
  cameraPanX: number = 0;

  cameraPanY: number = 0;

  cameraPanTargetX: number = 0;

  cameraPanTargetY: number = 0;

  isCameraCenteredOnPlayer: boolean = true;

  // Manual overhead pan inertia only.
  readonly cameraPanHalfLifeMs: number = 135;

  // Idle overhead follow when centered on the player.
  cameraFollowHalfLifeMs: number = 85;

  // The single normal-mode player-move camera speed knob.
  normalModePlayerMoveCameraFollowHalfLifeMs: number = 150;

  cameraFollowInitialized: boolean = false;

  cameraFollowTarget = new THREE.Vector3();

  cameraFollowCurrent = new THREE.Vector3();

  normalModePlayerMoveCameraFollowActive: boolean = false;

  readonly normalModePlayerMoveCameraSettleDistanceSq: number =
    Math.pow(TILE_SIZE * 0.02, 2);

  // Used only when transitioning between play modes/camera presets, not for step movement.
  readonly playModeCameraTransitionHalfLifeMs: number = 120;

  playModeCameraTransitionActive: boolean = false;

  playModeCameraTransitionCurrentPosition = new THREE.Vector3();

  playModeCameraTransitionCurrentLookTarget = new THREE.Vector3();

  resolveFpsCameraFov(): number {
    const candidate =
      typeof this.dependencies.engineState.clientOptions.fpsFov === "number" &&
      Number.isFinite(this.dependencies.engineState.clientOptions.fpsFov)
        ? this.dependencies.engineState.clientOptions.fpsFov
        : this.defaultFpsCameraFov;
    return THREE.MathUtils.clamp(candidate, 45, 110);
  }

  syncCameraSmoothingCssVariablesFromCode(): void {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty(
      "--camera-follow-half-life-ms",
      `${this.cameraFollowHalfLifeMs}`,
    );
    rootStyle.setProperty(
      "--camera-normal-player-move-follow-half-life-ms",
      `${this.normalModePlayerMoveCameraFollowHalfLifeMs}`,
    );
  }

  applyStandardCameraPresetForTopDownModes(params?: {
    force?: boolean;
  }): void {
    if (this.dependencies.engineState.playMode === "fps" || this.dependencies.terminalRendering.isTerminalDisplayMode()) {
      return;
    }
    const nextDistance = 15;
    const nextPitch = THREE.MathUtils.clamp(
      Math.PI / 2 - 0.2,
      this.minCameraPitch,
      this.maxCameraPitch,
    );
    const nextYaw = Math.PI;
    if (
      !params?.force &&
      Math.abs(this.cameraDistance - nextDistance) < 0.0001 &&
      Math.abs(this.cameraPitch - nextPitch) < 0.0001 &&
      Math.abs(this.wrapAngle(this.cameraYaw - nextYaw)) < 0.0001
    ) {
      return;
    }
    this.cameraDistance = nextDistance;
    this.cameraPitch = nextPitch;
    this.cameraYaw = nextYaw;
  }

  applyVultureIsometricCameraPresetIfNeeded(params?: {
    force?: boolean;
  }): void {
    if (
      this.dependencies.engineState.playMode === "fps" ||
      !this.dependencies.tilesetAssets.isVultureTilesActive(this.dependencies.engineState.clientOptions)
    ) {
      return;
    }
    const nextPitch = THREE.MathUtils.clamp(
      this.vultureIsometricPitch,
      this.minCameraPitch,
      this.maxCameraPitch,
    );
    const nextYaw = this.wrapAngle(Math.PI + this.vultureIsometricYawOffset);
    if (
      !params?.force &&
      Math.abs(this.cameraPitch - nextPitch) < 0.0001 &&
      Math.abs(this.wrapAngle(this.cameraYaw - nextYaw)) < 0.0001
    ) {
      return;
    }
    this.cameraPitch = nextPitch;
    this.cameraYaw = nextYaw;
  }

  recenterCameraOnPlayerIfNeeded(): void {
    if (this.isCameraCenteredOnPlayer) {
      return;
    }
    this.cameraPanX = 0;
    this.cameraPanY = 0;
    this.cameraPanTargetX = 0;
    this.cameraPanTargetY = 0;
    this.isCameraCenteredOnPlayer = true;
  }

  updateCameraPanInertia(deltaSeconds: number): void {
    if (this.isCameraCenteredOnPlayer) {
      return;
    }
    const panDeltaX = this.cameraPanTargetX - this.cameraPanX;
    const panDeltaY = this.cameraPanTargetY - this.cameraPanY;
    if (Math.abs(panDeltaX) < 0.0001 && Math.abs(panDeltaY) < 0.0001) {
      return;
    }
    const alpha =
      1 -
      Math.exp((-Math.LN2 * deltaSeconds * 1000) / this.cameraPanHalfLifeMs);
    this.cameraPanX = THREE.MathUtils.lerp(
      this.cameraPanX,
      this.cameraPanTargetX,
      alpha,
    );
    this.cameraPanY = THREE.MathUtils.lerp(
      this.cameraPanY,
      this.cameraPanTargetY,
      alpha,
    );
  }

  projectWorldToScreen(
    worldX: number,
    worldY: number,
    worldZ: number,
  ): { x: number; y: number; visible: boolean } {
    const vector = new THREE.Vector3(worldX, worldY, worldZ);
    vector.project(this.getActiveCamera());

    if (
      !Number.isFinite(vector.x) ||
      !Number.isFinite(vector.y) ||
      !Number.isFinite(vector.z)
    ) {
      return { x: 0, y: 0, visible: false };
    }

    const canvasRect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
    const x = canvasRect.left + ((vector.x + 1) * canvasRect.width) / 2;
    const y = canvasRect.top + ((-vector.y + 1) * canvasRect.height) / 2;
    const visible = vector.z >= -1 && vector.z <= 1;
    return { x, y, visible };
  }

  resolveThirdPersonZoomFactor(): number {
    if (this.dependencies.movementInput.isFpsMode()) {
      return 1;
    }

    const zoomSpan = Math.max(0.001, this.maxDistance - this.minDistance);
    return THREE.MathUtils.clamp(
      (this.maxDistance - this.cameraDistance) / zoomSpan,
      0,
      1,
    );
  }

  panThirdPersonCameraByScreenDelta(
    deltaX: number,
    deltaY: number,
    panSpeed: number,
    directionMultiplier: number = this.dependencies.engineState.clientOptions.invertTouchPanningDirection
      ? -1
      : 1,
  ): void {
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);
    const rightX = -cosYaw;
    const rightY = sinYaw;
    const backwardX = sinYaw;
    const backwardY = cosYaw;

    this.cameraPanX +=
      (-deltaX * rightX - deltaY * backwardX) * panSpeed * directionMultiplier;
    this.cameraPanY +=
      (-deltaX * rightY - deltaY * backwardY) * panSpeed * directionMultiplier;
    this.cameraPanTargetX = this.cameraPanX;
    this.cameraPanTargetY = this.cameraPanY;
    this.isCameraCenteredOnPlayer = false;
  }

  getOverheadCameraFollowTargetWorldPosition(): {
    x: number;
    y: number;
  } {
    if (this.dependencies.positionSelection.positionInputModeActive) {
      return {
        x: this.dependencies.positionSelection.positionCursor.x * TILE_SIZE,
        y: -this.dependencies.positionSelection.positionCursor.y * TILE_SIZE,
      };
    }

    return {
      x: this.dependencies.playerMovement.playerPos.x * TILE_SIZE + this.cameraPanX,
      y: -this.dependencies.playerMovement.playerPos.y * TILE_SIZE + this.cameraPanY,
    };
  }

  updateFpsCameraAutoTurnFromMovement(
    moveDx: number,
    moveDy: number,
    autoMoveLikely: boolean,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    if (!autoMoveLikely) {
      this.fpsAutoMoveDirection = null;
      this.fpsAutoTurnTargetYaw = null;
      return;
    }
    if (moveDx === 0 && moveDy === 0) {
      return;
    }

    if (
      this.fpsAutoMoveDirection &&
      this.fpsAutoMoveDirection.dx === moveDx &&
      this.fpsAutoMoveDirection.dy === moveDy
    ) {
      return;
    }

    // Map movement deltas to the yaw convention used by FPS controls.
    const targetYaw = this.wrapAngle(Math.atan2(-moveDx, moveDy));
    this.fpsAutoTurnTargetYaw = targetYaw;
    this.fpsAutoMoveDirection = { dx: moveDx, dy: moveDy };
  }

  updateFpsAutoTurnYaw(deltaSeconds: number): void {
    if (!this.dependencies.movementInput.isFpsMode() || this.fpsAutoTurnTargetYaw === null) {
      return;
    }

    const delta = this.wrapAngle(this.fpsAutoTurnTargetYaw - this.cameraYaw);
    const maxStep = this.fpsAutoTurnSpeedRadPerSec * Math.max(0, deltaSeconds);
    if (Math.abs(delta) <= maxStep) {
      this.cameraYaw = this.fpsAutoTurnTargetYaw;
      this.fpsAutoTurnTargetYaw = null;
      return;
    }

    this.cameraYaw = this.wrapAngle(
      this.cameraYaw + Math.sign(delta) * maxStep,
    );
  }

  isCameraYawSnapEnabled(): boolean {
    return !this.dependencies.movementInput.isFpsMode() && this.dependencies.engineState.clientOptions.snapCameraYawToNearest45;
  }

  clearCameraYawSnapTarget(): void {
    this.cameraYawSnapTarget = null;
  }

  queueCameraYawSnapToNearest45(): void {
    if (!this.isCameraYawSnapEnabled()) {
      this.clearCameraYawSnapTarget();
      return;
    }
    if (!Number.isFinite(this.cameraYaw)) {
      this.cameraYaw = 0;
      this.clearCameraYawSnapTarget();
      return;
    }
    const normalizedYaw = this.wrapAngle(this.cameraYaw);
    const targetYaw = this.wrapAngle(
      Math.round(normalizedYaw / this.cameraYawSnapStepRadians) *
        this.cameraYawSnapStepRadians,
    );
    if (
      Math.abs(this.wrapAngle(targetYaw - normalizedYaw)) <=
      this.cameraYawSnapEpsilon
    ) {
      this.cameraYaw = targetYaw;
      this.clearCameraYawSnapTarget();
      return;
    }
    this.cameraYawSnapTarget = targetYaw;
  }

  updateQueuedCameraYawSnap(deltaSeconds: number): void {
    if (!this.isCameraYawSnapEnabled() || this.cameraYawSnapTarget === null) {
      return;
    }
    if (this.dependencies.mouseInput.isMiddleMouseDown) {
      return;
    }
    if (!Number.isFinite(this.cameraYaw)) {
      this.cameraYaw = 0;
      this.clearCameraYawSnapTarget();
      return;
    }
    const normalizedYaw = this.wrapAngle(this.cameraYaw);
    const targetYaw = this.cameraYawSnapTarget;
    const yawDelta = this.wrapAngle(targetYaw - normalizedYaw);
    const alpha = THREE.MathUtils.clamp(
      1 - Math.exp(-Math.max(0, deltaSeconds) * this.cameraYawSnapLerpSpeed),
      0,
      1,
    );
    const nextYaw = this.wrapAngle(normalizedYaw + yawDelta * alpha);
    if (
      Math.abs(this.wrapAngle(targetYaw - nextYaw)) <= this.cameraYawSnapEpsilon
    ) {
      this.cameraYaw = targetYaw;
      this.clearCameraYawSnapTarget();
      return;
    }
    this.cameraYaw = nextYaw;
  }

  computeSharedStepMotionDurationMs(
    now: number = performance.now(),
    nowMs: number = Date.now(),
  ): number {
    let nextDurationMs = this.fpsStepCameraBaseDurationMs;
    if (
      nowMs - this.lastRunLikeInputAtMs <=
      this.fpsStepCameraRunInputWindowMs
    ) {
      nextDurationMs = Math.min(
        nextDurationMs,
        this.fpsStepCameraRunDurationMs,
      );
    }
    if (this.lastSharedStepMotionStartedAtMs > 0) {
      const moveCadenceMs = now - this.lastSharedStepMotionStartedAtMs;
      if (
        moveCadenceMs > 0 &&
        moveCadenceMs < this.fpsStepCameraBaseDurationMs
      ) {
        const cadenceDurationMs = Math.max(
          this.fpsStepCameraMinDurationMs,
          moveCadenceMs * this.fpsStepCameraRapidDurationScale,
        );
        nextDurationMs = Math.min(nextDurationMs, cadenceDurationMs);
      }
    }
    return nextDurationMs;
  }

  reserveSharedStepMotionDurationMs(): number {
    const now = performance.now();
    const durationMs = this.computeSharedStepMotionDurationMs(now, Date.now());
    this.lastSharedStepMotionStartedAtMs = now;
    this.lastSharedStepMotionDurationMs = durationMs;
    return durationMs;
  }

  getPreferredEntityMoveDurationMs(): number {
    if (this.fpsStepCameraActive) {
      return this.fpsStepCameraDurationMs;
    }
    const now = performance.now();
    if (
      this.lastSharedStepMotionStartedAtMs > 0 &&
      now - this.lastSharedStepMotionStartedAtMs <=
        Math.max(220, this.lastSharedStepMotionDurationMs * 3)
    ) {
      return this.lastSharedStepMotionDurationMs;
    }
    return this.computeSharedStepMotionDurationMs(now, Date.now());
  }

  beginFpsStepCameraTransition(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }

    const fromEyeX = fromX * TILE_SIZE;
    const fromEyeY = -fromY * TILE_SIZE;
    const toEyeX = toX * TILE_SIZE;
    const toEyeY = -toY * TILE_SIZE;
    const now = performance.now();

    if (!this.fpsStepCameraActive) {
      this.fpsStepCameraFrom.set(fromEyeX, fromEyeY, this.firstPersonEyeHeight);
    } else {
      const progress = THREE.MathUtils.clamp(
        (now - this.fpsStepCameraStartMs) /
          Math.max(1, this.fpsStepCameraDurationMs),
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      this.fpsStepCameraFrom.lerp(this.fpsStepCameraTo, eased);
    }

    this.fpsStepCameraDurationMs = Math.max(
      this.fpsStepCameraMinDurationMs,
      Math.trunc(durationMs),
    );
    this.dependencies.heldWeapon.applyFpsHeldWeaponSwayImpulse(fromX, fromY, toX, toY);

    this.fpsStepCameraTo.set(toEyeX, toEyeY, this.firstPersonEyeHeight);
    this.fpsStepCameraTargetTile = { x: toX, y: toY };
    this.fpsStepCameraStartMs = now;
    this.fpsStepCameraActive = true;
  }

  resolveFpsLookSensitivityScale(axis: "x" | "y"): number {
    const rawValue =
      axis === "x"
        ? this.dependencies.engineState.clientOptions.fpsLookSensitivityX
        : this.dependencies.engineState.clientOptions.fpsLookSensitivityY;
    if (!Number.isFinite(rawValue)) {
      return 1;
    }
    return THREE.MathUtils.clamp(
      rawValue,
      nh3dFpsLookSensitivityMin,
      nh3dFpsLookSensitivityMax,
    );
  }

  applyFpsLookDelta(
    deltaX: number,
    deltaY: number,
    baseSensitivity: number,
  ): void {
    const farLookViewActive = this.dependencies.positionSelection.isFpsFarLookViewActive();
    if (farLookViewActive && this.dependencies.promptDialogs.isAnyModalVisible()) {
      return;
    }
    const farLookSensitivityScale = farLookViewActive
      ? this.positionCursorFarLookLookSensitivityScale
      : 1;
    const sensitivityX =
      baseSensitivity *
      this.resolveFpsLookSensitivityScale("x") *
      farLookSensitivityScale;
    const sensitivityY =
      baseSensitivity *
      this.resolveFpsLookSensitivityScale("y") *
      farLookSensitivityScale;
    const lookYDirection =
      (this.dependencies.engineState.clientOptions.invertLookYAxis ? -1 : 1) *
      (farLookViewActive ? -1 : 1);
    if (farLookViewActive) {
      this.fpsPositionCursorManualOverrideUntilMs =
        Date.now() + this.positionCursorFarLookManualOverrideWindowMs;
      this.fpsPositionCursorOrbitYaw = this.wrapAngle(
        this.fpsPositionCursorOrbitYaw + deltaX * sensitivityX,
      );
      this.fpsPositionCursorOrbitPitch = THREE.MathUtils.clamp(
        this.fpsPositionCursorOrbitPitch -
          deltaY * sensitivityY * lookYDirection,
        this.minCameraPitch,
        this.maxCameraPitch,
      );
      if (this.dependencies.directionPrompts.isInDirectionQuestion) {
        this.dependencies.directionPrompts.updateDirectionPromptOverlayState();
      }
      return;
    }
    this.cameraYaw = this.wrapAngle(this.cameraYaw + deltaX * sensitivityX);
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch - deltaY * sensitivityY * lookYDirection,
      this.firstPersonPitchMin,
      this.firstPersonPitchMax,
    );
    if (this.dependencies.directionPrompts.isInDirectionQuestion) {
      this.dependencies.directionPrompts.updateDirectionPromptOverlayState();
    }
  }

  getActiveFpsAimYaw(): number {
    if (this.dependencies.positionSelection.isFpsFarLookViewActive()) {
      return this.wrapAngle(this.fpsPositionCursorOrbitYaw);
    }
    return this.wrapAngle(this.cameraYaw);
  }

  getFpsAimDirectionFromCamera(): AimDirection | null {
    // FPS movement/fire should follow yaw, even when pitch is looking up/down.
    // Use a nearest-of-8-direction projection with a small diagonal bias so
    // diagonals are easier to target from mouselook.
    const aimYaw = this.getActiveFpsAimYaw();
    const mapForwardX = -Math.sin(aimYaw);
    const mapForwardY = Math.cos(aimYaw);
    const candidates = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: -1, dy: -1 },
    ];

    let bestCandidate = candidates[0];
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const lengthScale =
        candidate.dx !== 0 && candidate.dy !== 0 ? Math.SQRT1_2 : 1;
      const nx = candidate.dx * lengthScale;
      const ny = candidate.dy * lengthScale;
      const diagonalBoost =
        candidate.dx !== 0 && candidate.dy !== 0 ? this.fpsDiagonalAimBias : 0;
      const score = mapForwardX * nx + mapForwardY * ny + diagonalBoost;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    const input = this.dependencies.movementInput.getDirectionInputFromMapDelta(
      bestCandidate.dx,
      bestCandidate.dy,
    );
    if (!input) {
      return null;
    }
    return {
      dx: bestCandidate.dx,
      dy: bestCandidate.dy,
      input,
    };
  }

  ensureTerminalCamera(): THREE.OrthographicCamera {
    if (!this.terminalCamera) {
      this.terminalCamera = new THREE.OrthographicCamera(
        -1,
        1,
        1,
        -1,
        0.1,
        1000,
      );
      // Straight top-down: look down -Z with world +Y (map north) up.
      this.terminalCamera.up.set(0, 1, 0);
    }
    return this.terminalCamera;
  }

  getActiveCamera(): THREE.Camera {
    if (this.dependencies.terminalRendering.isTerminalDisplayMode() && this.terminalCamera) {
      return this.terminalCamera;
    }
    const scaleX = this.dependencies.tilesetAssets.getWorldTileScaleX();
    if (scaleX === 1) return this.camera;
    // Keep smoothing and movement in the logical grid. The rendered camera
    // uses rectangular world positions, with an orthonormal viewing basis.
    this.camera.updateMatrixWorld();
    const camera = this.tileAspectCamera;
    camera.copy(this.camera, false);
    this.camera.getWorldDirection(this.tileAspectLookTarget);
    this.tileAspectLookTarget.add(this.camera.position);
    this.tileAspectLookTarget.x *= scaleX;
    camera.position.x *= scaleX;
    camera.up.x *= scaleX;
    camera.up.normalize();
    camera.lookAt(this.tileAspectLookTarget);
    camera.updateMatrixWorld(true);
    return camera;
  }


  // Top-down orthographic terminal camera. The whole level is shown when it
  // fits the viewport at a readable cell size; otherwise the view follows
  // the player (or position cursor) with classic edge-clamped scrolling.
  updateTerminalCamera(deltaSeconds: number): void {
    const camera = this.ensureTerminalCamera();
    const drawingBufferSize = this.dependencies.renderPipeline.renderer.getDrawingBufferSize(
      new THREE.Vector2(),
    );
    const drawingBufferWidth = Math.max(1, Math.round(drawingBufferSize.x));
    const drawingBufferHeight = Math.max(1, Math.round(drawingBufferSize.y));
    const mapWorldWidth = this.dependencies.terminalRendering.terminalMapColumns * TILE_SIZE;
    const mapWorldHeight = this.dependencies.terminalRendering.terminalMapRows * TILE_SIZE;

    const zoomFactor =
      this.terminalFitCameraDistance / Math.max(1, this.cameraDistance);
    const cellScale = resolveTerminalPhysicalCellWidth({
      drawingBufferWidth,
      drawingBufferHeight,
      mapWorldWidth,
      mapWorldHeight,
      cellAspect: this.dependencies.terminalRendering.terminalCellAspect,
      zoomFactor,
      pixelRatio: this.dependencies.renderPipeline.renderer.getPixelRatio(),
      minCellCssPx: this.terminalMinCellPx,
      zoomOutMinCellCssPx: this.terminalZoomOutMinCellPx,
      maxCellCssPx: this.terminalMaxCellPx,
      containWholeLevel: zoomFactor <= 1,
    });
    if (cellScale !== this.dependencies.terminalRendering.terminalRasterCellWidthPx) {
      this.dependencies.terminalRendering.terminalRasterCellWidthPx = cellScale;
      this.dependencies.terminalRendering.refreshTerminalCellMaterialsForRasterScale();
    }

    const viewWorldWidth = drawingBufferWidth / cellScale;
    const viewWorldHeight =
      drawingBufferHeight / (cellScale * this.dependencies.terminalRendering.terminalCellAspect);
    const terminalDesktopGutterActive =
      document.documentElement.classList.contains(
        "nh3d-terminal-desktop-gutter",
      );
    this.dependencies.minimap.setTerminalGutterMinimapState(
      terminalDesktopGutterActive,
      shouldShowTerminalGutterMinimap({
        mapWorldWidth,
        mapWorldHeight,
        viewWorldWidth,
        viewWorldHeight,
        zoomFactor,
      }),
    );

    // Map bounds in world coordinates (tile y increases downward).
    const minWorldX = -TILE_SIZE / 2;
    const maxWorldX = minWorldX + mapWorldWidth;
    const maxWorldY = TILE_SIZE / 2;
    const minWorldY = maxWorldY - mapWorldHeight;

    const { x: targetX, y: targetY } =
      this.getOverheadCameraFollowTargetWorldPosition();
    this.cameraFollowTarget.set(targetX, targetY, 0);
    if (!this.cameraFollowInitialized) {
      this.cameraFollowCurrent.copy(this.cameraFollowTarget);
      this.cameraFollowInitialized = true;
    } else {
      const alpha =
        1 -
        Math.exp(
          (-Math.LN2 * deltaSeconds * 1000) / this.cameraFollowHalfLifeMs,
        );
      this.cameraFollowCurrent.lerp(this.cameraFollowTarget, alpha);
    }

    const unclippedCenterX =
      viewWorldWidth >= mapWorldWidth
        ? (minWorldX + maxWorldX) / 2
        : THREE.MathUtils.clamp(
            this.cameraFollowCurrent.x,
            minWorldX + viewWorldWidth / 2,
            maxWorldX - viewWorldWidth / 2,
          );
    const unclippedCenterY =
      viewWorldHeight >= mapWorldHeight
        ? (minWorldY + maxWorldY) / 2
        : THREE.MathUtils.clamp(
            this.cameraFollowCurrent.y,
            minWorldY + viewWorldHeight / 2,
            maxWorldY - viewWorldHeight / 2,
          );

    // Align the map's first tile boundary to a physical-pixel edge. Since the
    // cell size above is integral in physical pixels, every other boundary is
    // aligned as well, including on fractional-DPR monitors.
    const centerX = snapTerminalCameraCenterToPixelGrid({
      centerWorld: unclippedCenterX,
      referenceBoundaryWorld: minWorldX,
      drawingBufferPixels: drawingBufferWidth,
      pixelsPerWorldUnit: cellScale,
    });
    const centerY = snapTerminalCameraCenterToPixelGrid({
      centerWorld: unclippedCenterY,
      referenceBoundaryWorld: maxWorldY,
      drawingBufferPixels: drawingBufferHeight,
      pixelsPerWorldUnit: cellScale * this.dependencies.terminalRendering.terminalCellAspect,
    });

    camera.left = -viewWorldWidth / 2;
    camera.right = viewWorldWidth / 2;
    camera.top = viewWorldHeight / 2;
    camera.bottom = -viewWorldHeight / 2;
    camera.position.set(centerX, centerY, 100);
    camera.updateProjectionMatrix();
    camera.lookAt(centerX, centerY, 0);
  }


  // Compensate terminal projection and rectangular world scaling after the
  // effect update loops so damage numbers and blood mist keep their proportions.
  compensateTerminalWorldSpriteAspect(): void {
    const inverseAspect = this.dependencies.terminalRendering.isTerminalDisplayMode()
      ? 1 / this.dependencies.terminalRendering.terminalCellAspect : 1;
    const inverseWidth = 1 / this.dependencies.tilesetAssets.getWorldTileScaleX();
    if (inverseAspect === 1 && inverseWidth === 1) return;
    for (const particle of this.dependencies.damageNumbers.playerDamageNumberParticles) {
      particle.sprite.scale.y *= inverseAspect;
      particle.sprite.scale.x *= inverseWidth;
    }
    for (const particle of this.dependencies.bloodParticles.damageParticles) {
      const sprite = particle.sprite;
      if (sprite) {
        sprite.scale.y *= inverseAspect;
        sprite.scale.x *= inverseWidth;
      }
    }
  }

  updateCamera(deltaSeconds: number): void {
    if (this.dependencies.terminalRendering.isTerminalDisplayMode()) {
      this.updateTerminalCamera(deltaSeconds);
      return;
    }
    if (this.dependencies.movementInput.isFpsMode()) {
      const targetEyeX = this.dependencies.playerMovement.playerPos.x * TILE_SIZE;
      const targetEyeY = -this.dependencies.playerMovement.playerPos.y * TILE_SIZE;
      let eyeX = targetEyeX;
      let eyeY = targetEyeY;
      const eyeZ = this.firstPersonEyeHeight;

      if (!this.dependencies.positionSelection.positionInputModeActive) {
        this.updateFpsAutoTurnYaw(deltaSeconds);
      }
      if (
        !this.dependencies.positionSelection.positionInputModeActive &&
        this.fpsPositionCursorReturnActive &&
        this.fpsPositionCursorEntryCameraYaw !== null &&
        this.fpsPositionCursorEntryCameraPitch !== null
      ) {
        const targetYaw = this.cameraYaw;
        const targetPitch = this.cameraPitch;
        const desiredForwardX = -Math.sin(targetYaw) * Math.cos(targetPitch);
        const desiredForwardY = -Math.cos(targetYaw) * Math.cos(targetPitch);
        const desiredForwardZ = Math.sin(targetPitch);
        const desiredCameraPosition = new THREE.Vector3(
          targetEyeX,
          targetEyeY,
          eyeZ,
        );
        const desiredLookTarget = new THREE.Vector3(
          targetEyeX + desiredForwardX * (TILE_SIZE * 2.5),
          targetEyeY + desiredForwardY * (TILE_SIZE * 2.5),
          eyeZ + desiredForwardZ * (TILE_SIZE * 2.5),
        );
        const alpha =
          1 -
          Math.exp(
            (-Math.LN2 * deltaSeconds * 1000) /
              this.positionCursorFarLookReturnHalfLifeMs,
          );
        this.fpsPositionCursorCameraCurrent.lerp(desiredCameraPosition, alpha);
        this.fpsPositionCursorLookCurrent.lerp(desiredLookTarget, alpha);
        this.camera.position.copy(this.fpsPositionCursorCameraCurrent);
        this.camera.lookAt(this.fpsPositionCursorLookCurrent);
        if (
          this.fpsPositionCursorCameraCurrent.distanceToSquared(
            desiredCameraPosition,
          ) <= 0.0024 &&
          this.fpsPositionCursorLookCurrent.distanceToSquared(
            desiredLookTarget,
          ) <= 0.0048
        ) {
          this.fpsPositionCursorCameraCurrent.copy(desiredCameraPosition);
          this.fpsPositionCursorLookCurrent.copy(desiredLookTarget);
          this.camera.position.copy(desiredCameraPosition);
          this.camera.lookAt(desiredLookTarget);
          this.fpsPositionCursorReturnActive = false;
        }
        return;
      }
      if (this.playModeCameraTransitionActive) {
        const desiredForwardX =
          -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
        const desiredForwardY =
          -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
        const desiredForwardZ = Math.sin(this.cameraPitch);
        const desiredCameraPosition = new THREE.Vector3(
          targetEyeX,
          targetEyeY,
          eyeZ,
        );
        const desiredLookTarget = new THREE.Vector3(
          targetEyeX + desiredForwardX * (TILE_SIZE * 2.5),
          targetEyeY + desiredForwardY * (TILE_SIZE * 2.5),
          eyeZ + desiredForwardZ * (TILE_SIZE * 2.5),
        );
        const alpha =
          1 -
          Math.exp(
            (-Math.LN2 * deltaSeconds * 1000) /
              this.playModeCameraTransitionHalfLifeMs,
          );
        this.playModeCameraTransitionCurrentPosition.lerp(
          desiredCameraPosition,
          alpha,
        );
        this.playModeCameraTransitionCurrentLookTarget.lerp(
          desiredLookTarget,
          alpha,
        );
        this.camera.position.copy(this.playModeCameraTransitionCurrentPosition);
        this.camera.lookAt(this.playModeCameraTransitionCurrentLookTarget);
        if (
          this.playModeCameraTransitionCurrentPosition.distanceToSquared(
            desiredCameraPosition,
          ) <= 0.006 &&
          this.playModeCameraTransitionCurrentLookTarget.distanceToSquared(
            desiredLookTarget,
          ) <= 0.006
        ) {
          this.playModeCameraTransitionCurrentPosition.copy(
            desiredCameraPosition,
          );
          this.playModeCameraTransitionCurrentLookTarget.copy(
            desiredLookTarget,
          );
          this.playModeCameraTransitionActive = false;
        }
        return;
      }
      if (this.fpsStepCameraActive) {
        const progress = THREE.MathUtils.clamp(
          (performance.now() - this.fpsStepCameraStartMs) /
            Math.max(1, this.fpsStepCameraDurationMs),
          0,
          1,
        );
        const eased = 1 - Math.pow(1 - progress, 3);
        eyeX = THREE.MathUtils.lerp(
          this.fpsStepCameraFrom.x,
          this.fpsStepCameraTo.x,
          eased,
        );
        eyeY = THREE.MathUtils.lerp(
          this.fpsStepCameraFrom.y,
          this.fpsStepCameraTo.y,
          eased,
        );
        if (progress >= 1) {
          this.fpsStepCameraActive = false;
          this.fpsStepCameraTargetTile = null;
          this.fpsStepCameraFrom.set(targetEyeX, targetEyeY, eyeZ);
          this.fpsStepCameraTo.set(targetEyeX, targetEyeY, eyeZ);
          if (this.dependencies.tileUpdates.pendingTileUpdates.size > 0) {
            this.dependencies.tileUpdates.schedulePendingTileFlush();
          }
        }
      }

      if (this.dependencies.positionSelection.isFpsFarLookViewActive()) {
        const cursorWorldX = this.dependencies.positionSelection.positionCursor.x * TILE_SIZE;
        const cursorWorldY = -this.dependencies.positionSelection.positionCursor.y * TILE_SIZE;
        const cursorTile =
          this.dependencies.tileRendering.tileMap.get(
            `${this.dependencies.positionSelection.positionCursor.x},${this.dependencies.positionSelection.positionCursor.y}`,
          ) ?? null;
        const cursorHeight =
          cursorTile?.userData?.isWall === true
            ? Math.max(this.dependencies.positionSelection.positionCursorColumnHeight, WALL_HEIGHT + 0.22)
            : this.dependencies.positionSelection.positionCursorColumnHeight;
        const focusZ =
          cursorHeight * this.positionCursorFarLookFocusHeightRatio;
        const orbitYaw = this.fpsPositionCursorOrbitYaw;
        const effectivePitch = THREE.MathUtils.clamp(
          this.fpsPositionCursorOrbitPitch,
          this.minCameraPitch,
          this.maxCameraPitch,
        );
        const cosPitch = Math.cos(effectivePitch);
        const sinPitch = Math.sin(effectivePitch);
        const sinYaw = Math.sin(orbitYaw);
        const cosYaw = Math.cos(orbitYaw);
        const desiredCameraPosition = new THREE.Vector3(
          cursorWorldX +
            this.positionCursorFarLookOrbitDistance * cosPitch * sinYaw,
          cursorWorldY +
            this.positionCursorFarLookOrbitDistance * cosPitch * cosYaw,
          this.positionCursorFarLookHeightBias +
            this.positionCursorFarLookOrbitDistance * sinPitch,
        );
        const desiredLookTarget = new THREE.Vector3(
          cursorWorldX,
          cursorWorldY,
          focusZ,
        );
        if (!this.fpsPositionCursorCameraInitialized) {
          this.fpsPositionCursorCameraCurrent.copy(this.camera.position);
          const currentLookDirection = this.camera.getWorldDirection(
            new THREE.Vector3(),
          );
          this.fpsPositionCursorLookCurrent
            .copy(this.camera.position)
            .add(
              currentLookDirection.multiplyScalar(
                Math.max(
                  TILE_SIZE * 2,
                  this.positionCursorFarLookOrbitDistance,
                ),
              ),
            );
          this.fpsPositionCursorCameraInitialized = true;
        }
        const nowMs = Date.now();
        const manualOverrideActive =
          nowMs <= this.fpsPositionCursorManualOverrideUntilMs;
        const followHalfLifeMs = manualOverrideActive
          ? this.positionCursorFarLookManualFollowHalfLifeMs
          : this.positionCursorFarLookFollowHalfLifeMs;
        const alpha =
          1 - Math.exp((-Math.LN2 * deltaSeconds * 1000) / followHalfLifeMs);
        this.fpsPositionCursorCameraCurrent.lerp(desiredCameraPosition, alpha);
        this.fpsPositionCursorLookCurrent.lerp(desiredLookTarget, alpha);
        this.camera.position.copy(this.fpsPositionCursorCameraCurrent);
        this.camera.lookAt(this.fpsPositionCursorLookCurrent);
        return;
      }

      const forwardX = -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
      const forwardY = -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
      const forwardZ = Math.sin(this.cameraPitch);

      this.camera.position.set(eyeX, eyeY, eyeZ);
      this.camera.lookAt(eyeX + forwardX, eyeY + forwardY, eyeZ + forwardZ);
      return;
    }

    const { x: targetX, y: targetY } =
      this.getOverheadCameraFollowTargetWorldPosition();
    this.cameraFollowTarget.set(targetX, targetY, 0);
    const normalModePlayerMoveCameraFollowActive =
      this.normalModePlayerMoveCameraFollowActive &&
      this.isCameraCenteredOnPlayer &&
      !this.dependencies.positionSelection.positionInputModeActive;

    if (!this.cameraFollowInitialized) {
      this.cameraFollowCurrent.copy(this.cameraFollowTarget);
      this.cameraFollowInitialized = true;
    } else {
      // Exponential smoothing for camera follow: immediate movement with natural fade-out.
      const followHalfLifeMs = normalModePlayerMoveCameraFollowActive
        ? this.normalModePlayerMoveCameraFollowHalfLifeMs
        : this.cameraFollowHalfLifeMs;
      const alpha =
        1 - Math.exp((-Math.LN2 * deltaSeconds * 1000) / followHalfLifeMs);
      this.cameraFollowCurrent.lerp(this.cameraFollowTarget, alpha);
    }
    if (
      normalModePlayerMoveCameraFollowActive &&
      this.cameraFollowCurrent.distanceToSquared(this.cameraFollowTarget) <=
        this.normalModePlayerMoveCameraSettleDistanceSq
    ) {
      this.normalModePlayerMoveCameraFollowActive = false;
    }

    this.updateQueuedCameraYawSnap(deltaSeconds);

    const followX = this.cameraFollowCurrent.x;
    const followY = this.cameraFollowCurrent.y;

    // Use spherical coordinates for camera positioning
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const offsetX = this.cameraDistance * cosPitch * sinYaw;
    const offsetY = this.cameraDistance * cosPitch * cosYaw;
    const offsetZ = this.cameraDistance * sinPitch;
    const desiredCameraPosition = new THREE.Vector3(
      followX + offsetX,
      followY + offsetY,
      offsetZ,
    );
    const desiredLookTarget = new THREE.Vector3(followX, followY, 0);

    if (this.playModeCameraTransitionActive) {
      const alpha =
        1 -
        Math.exp(
          (-Math.LN2 * deltaSeconds * 1000) /
            this.playModeCameraTransitionHalfLifeMs,
        );
      this.playModeCameraTransitionCurrentPosition.lerp(
        desiredCameraPosition,
        alpha,
      );
      this.playModeCameraTransitionCurrentLookTarget.lerp(
        desiredLookTarget,
        alpha,
      );
      this.camera.position.copy(this.playModeCameraTransitionCurrentPosition);
      this.camera.lookAt(this.playModeCameraTransitionCurrentLookTarget);
      if (
        this.playModeCameraTransitionCurrentPosition.distanceToSquared(
          desiredCameraPosition,
        ) <= 0.006 &&
        this.playModeCameraTransitionCurrentLookTarget.distanceToSquared(
          desiredLookTarget,
        ) <= 0.006
      ) {
        this.playModeCameraTransitionCurrentPosition.copy(
          desiredCameraPosition,
        );
        this.playModeCameraTransitionCurrentLookTarget.copy(desiredLookTarget);
        this.playModeCameraTransitionActive = false;
      }
      return;
    }

    // Position camera relative to player (with panning offset)
    this.camera.position.copy(desiredCameraPosition);

    // Always look at the target position (player + pan offset)
    this.camera.lookAt(desiredLookTarget);
  }

  wrapAngle(angle: number): number {
    const twoPi = Math.PI * 2;
    angle = ((angle % twoPi) + twoPi) % twoPi;
    return angle > Math.PI ? angle - twoPi : angle;
  }
}
