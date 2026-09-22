import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import type { Camera } from "../camera/camera";
import type { EngineMessages } from "../ui/engine-messages";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { InputCommands } from "./input-commands";
import type { MovementInput } from "./movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PointerLock } from "./pointer-lock";
import type { PointerTargeting } from "./pointer-targeting";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TileContextActions } from "../ui/tile-context-actions";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";

export interface PositionSelectionDependencies {
  readonly camera: Pick<
    Camera,
    "camera"
    | "cameraPitch"
    | "cameraYaw"
    | "fpsPositionCursorCameraCurrent"
    | "fpsPositionCursorCameraInitialized"
    | "fpsPositionCursorEntryCameraPitch"
    | "fpsPositionCursorEntryCameraYaw"
    | "fpsPositionCursorLookCurrent"
    | "fpsPositionCursorManualOverrideUntilMs"
    | "fpsPositionCursorOrbitPitch"
    | "fpsPositionCursorOrbitYaw"
    | "fpsPositionCursorReturnActive"
    | "maxCameraPitch"
    | "minCameraPitch"
    | "positionCursorFarLookCornerRadius"
    | "positionCursorFarLookDefaultPitch"
    | "positionCursorFarLookOrbitDistance"
    | "wrapAngle"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "logClickLookTileDebug"
  >;
  readonly engineState: Pick<
    EngineState,
    "uiAdapter"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "resolveStandardBillboardRenderOrder"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "numberPadModeEnabled"
    | "sendInput"
    | "sendInputSequence"
    | "sendMouseInput"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "getDirectionInputFromMapDelta"
    | "isFpsMode"
    | "mapDirectionalKeyFromNavigationInput"
    | "mapNumpadDigitToDirectionKey"
    | "tryResolveFpsPositionLookInput"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly pointerLock: Pick<
    PointerLock,
    "syncFpsPointerLockForUiState"
  >;
  readonly pointerTargeting: Pick<
    PointerTargeting,
    "getGridPositionFromClientCoordinates"
    | "resolvePointerTargetTileFromClientCoordinates"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "hideInfoMenuDialog"
    | "isInfoDialogVisible"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "fpsCrosshairGlancePending"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveRuntimeVersion"
    | "shouldUseVultureTiles"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "refreshCurrentPlayerTileVisualFromStateCache"
    | "requestPlayerTileRefresh"
  >;
}

/** Position selection state, cursor geometry, far-look pointer and keyboard routing. */
export class PositionSelection {
  constructor(private readonly dependencies: PositionSelectionDependencies) {}

  positionHideTimerId: number | null = null;

  positionInputModeActive: boolean = false;
  positionInputCameraSuppressed: boolean = false;

  /** Contextual Info selects a known tile; it is not an interactive camera mode. */
  suppressNextPositionCamera(): void { this.positionInputCameraSuppressed = true; }

  positionInputOrigin: string | null = null;

  positionCursor = { x: 0, y: 0 };

  hasRuntimePositionCursor: boolean = false;

  positionCursorOutline: THREE.Group | null = null;

  positionCursorColumnMaterial: THREE.MeshBasicMaterial | null = null;

  readonly positionCursorOutlineColorHex: number = 0xffe15a;

  readonly positionCursorOutlineInset: number = 0.05;

  readonly positionCursorColumnScale: number = 0.94;

  readonly positionCursorBottomOutlineThickness: number =
    TILE_SIZE * 0.05;

  readonly positionCursorBottomOutlineLiftZ: number = TILE_SIZE * 0.002;

  readonly positionCursorBottomOutlineGlowLiftZ: number =
    TILE_SIZE * 0.004;

  readonly positionCursorBottomOutlineOpacity: number = 0.54;

  readonly positionCursorGroundZ: number = 0.03;

  readonly positionCursorColumnHeight: number = WALL_HEIGHT * 1.42;

  getPositionCursorRoundedSquareCornerRadius(inset: number): number {
    const radius = TILE_SIZE / 2 - inset;
    const outerRadius = TILE_SIZE / 2 - this.positionCursorOutlineInset;
    const outerCornerRadius = Math.min(
      this.dependencies.camera.positionCursorFarLookCornerRadius,
      outerRadius * 0.64,
    );
    const insetDelta = Math.max(0, inset - this.positionCursorOutlineInset);
    return THREE.MathUtils.clamp(
      outerCornerRadius - insetDelta,
      0,
      radius * 0.64,
    );
  }

  tracePositionCursorRoundedSquarePath(
    path: THREE.Path | THREE.Shape,
    inset: number,
  ): void {
    const radius = TILE_SIZE / 2 - inset;
    const cornerRadius = this.getPositionCursorRoundedSquareCornerRadius(inset);
    if (cornerRadius <= 0.0001) {
      path.moveTo(-radius, radius);
      path.lineTo(radius, radius);
      path.lineTo(radius, -radius);
      path.lineTo(-radius, -radius);
      path.lineTo(-radius, radius);
      path.closePath();
      return;
    }
    const inner = radius - cornerRadius;
    path.moveTo(-inner, radius);
    path.lineTo(inner, radius);
    path.absarc(inner, inner, cornerRadius, Math.PI / 2, 0, true);
    path.lineTo(radius, -inner);
    path.absarc(inner, -inner, cornerRadius, 0, -Math.PI / 2, true);
    path.lineTo(-inner, -radius);
    path.absarc(-inner, -inner, cornerRadius, -Math.PI / 2, -Math.PI, true);
    path.lineTo(-radius, inner);
    path.absarc(-inner, inner, cornerRadius, Math.PI, Math.PI / 2, true);
    path.closePath();
  }

  buildPositionCursorRoundedSquareShape(
    extraInset: number = 0,
  ): THREE.Shape {
    const shape = new THREE.Shape();
    this.tracePositionCursorRoundedSquarePath(
      shape,
      this.positionCursorOutlineInset + extraInset,
    );
    return shape;
  }

  buildPositionCursorBottomOutlineShape(
    extraInnerInset: number = 0,
  ): THREE.Shape {
    const outlineShape = this.buildPositionCursorRoundedSquareShape();
    const innerShape = this.buildPositionCursorRoundedSquareShape(
      this.positionCursorBottomOutlineThickness + extraInnerInset,
    );
    const innerHole = new THREE.Path(innerShape.getPoints(32).reverse());
    innerHole.closePath();
    outlineShape.holes.push(innerHole);
    return outlineShape;
  }

  buildPositionCursorBottomOutlineLoop(): THREE.LineLoop {
    const points = this.buildPositionCursorRoundedSquareShape()
      .getPoints(48)
      .map(
        (point) =>
          new THREE.Vector3(
            point.x,
            point.y,
            this.positionCursorBottomOutlineGlowLiftZ,
          ),
      );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.positionCursorOutlineColorHex,
      transparent: false,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const loop = new THREE.LineLoop(geometry, material);
    loop.renderOrder = 1002;
    return loop;
  }

  patchPositionCursorColumnMaterial(
    material: THREE.MeshBasicMaterial,
  ): void {
    const columnHeight = this.positionCursorColumnHeight.toFixed(6);
    material.customProgramCacheKey = () =>
      `position_cursor_column_fade_v1_${columnHeight}`;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        varying float vPositionCursorOpacityFade;
        ${shader.vertexShader}
      `.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vPositionCursorOpacityFade = smoothstep(
          0.0,
          1.0,
          1.0 - clamp(transformed.z / ${columnHeight}, 0.0, 1.0)
        );`,
      );
      shader.fragmentShader = `
        varying float vPositionCursorOpacityFade;
        ${shader.fragmentShader}
      `.replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `vec4 diffuseColor = vec4( diffuse, opacity );
        diffuseColor.a *= clamp(vPositionCursorOpacityFade, 0.0, 1.0);`,
      );
    };
    material.needsUpdate = true;
  }

  ensurePositionCursorOutline(): THREE.Group {
    if (this.positionCursorOutline) {
      return this.positionCursorOutline;
    }

    const shape = this.buildPositionCursorRoundedSquareShape();
    const outlineRenderOrderBase = this.getPositionCursorOutlineRenderOrder();
    const bottomOutlineShape = this.buildPositionCursorBottomOutlineShape();
    const height = this.positionCursorColumnHeight;
    const group = new THREE.Group();
    const bottomOutlineGeometry = new THREE.ShapeGeometry(bottomOutlineShape);
    const columnGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 18,
      steps: 1,
    });
    const columnMaterial = new THREE.MeshBasicMaterial({
      color: this.positionCursorOutlineColorHex,
      transparent: true,
      opacity: 0.066,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.patchPositionCursorColumnMaterial(columnMaterial);
    const column = new THREE.Mesh(columnGeometry, columnMaterial);
    column.scale.set(
      this.positionCursorColumnScale,
      this.positionCursorColumnScale,
      1,
    );
    column.renderOrder = 1000;
    group.add(column);

    const bottomOutlineMaterial = new THREE.MeshBasicMaterial({
      color: this.positionCursorOutlineColorHex,
      transparent: true,
      opacity: this.positionCursorBottomOutlineOpacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const bottomOutline = new THREE.Mesh(
      bottomOutlineGeometry,
      bottomOutlineMaterial,
    );
    bottomOutline.position.z = this.positionCursorBottomOutlineGlowLiftZ;
    bottomOutline.scale.set(
      this.positionCursorColumnScale,
      this.positionCursorColumnScale,
      1,
    );
    bottomOutline.renderOrder = outlineRenderOrderBase + 0.1;
    group.add(bottomOutline);
    const bottomOutlineLoop = this.buildPositionCursorBottomOutlineLoop();
    bottomOutlineLoop.renderOrder = outlineRenderOrderBase + 0.15;
    const bottomOutlineLoopMaterial = bottomOutlineLoop.material;
    if (bottomOutlineLoopMaterial instanceof THREE.LineBasicMaterial) {
      bottomOutlineLoopMaterial.transparent = true;
      bottomOutlineLoopMaterial.opacity =
        this.positionCursorBottomOutlineOpacity;
      bottomOutlineLoopMaterial.depthTest = false;
      bottomOutlineLoopMaterial.depthWrite = false;
    }
    bottomOutlineLoop.position.z = this.positionCursorBottomOutlineLiftZ;
    bottomOutlineLoop.scale.set(
      this.positionCursorColumnScale,
      this.positionCursorColumnScale,
      1,
    );
    group.add(bottomOutlineLoop);

    group.visible = false;
    this.dependencies.renderPipeline.scene.add(group);
    this.positionCursorOutline = group;
    this.positionCursorColumnMaterial = columnMaterial;
    return group;
  }

  setPositionInputMode(
    active: boolean,
    origin: string | null = null,
  ): void {
    if (!active) {
      const returnCamera = this.positionInputModeActive && !this.positionInputCameraSuppressed;
      if (this.dependencies.tileContextActions.fpsCrosshairGlancePending?.sawPositionInput) {
        this.dependencies.tileContextActions.fpsCrosshairGlancePending.positionResolvedAtMs = Date.now();
      }
      if (this.positionHideTimerId !== null) {
        window.clearTimeout(this.positionHideTimerId);
        this.positionHideTimerId = null;
      }
      const currentLookDirection = this.dependencies.camera.camera.getWorldDirection(
        new THREE.Vector3(),
      );
      this.dependencies.camera.fpsPositionCursorCameraCurrent.copy(this.dependencies.camera.camera.position);
      this.dependencies.camera.fpsPositionCursorLookCurrent
        .copy(this.dependencies.camera.camera.position)
        .add(
          currentLookDirection.multiplyScalar(
            Math.max(TILE_SIZE * 2, this.dependencies.camera.positionCursorFarLookOrbitDistance),
          ),
        );
      this.positionInputModeActive = false;
      this.positionInputOrigin = null;
      this.dependencies.engineState.uiAdapter.setPositionInputActive(false);
      this.hasRuntimePositionCursor = false;
      this.dependencies.camera.fpsPositionCursorCameraInitialized = false;
      this.dependencies.camera.fpsPositionCursorManualOverrideUntilMs = 0;
      this.dependencies.camera.fpsPositionCursorReturnActive =
        returnCamera &&
        this.dependencies.camera.fpsPositionCursorEntryCameraYaw !== null &&
        this.dependencies.camera.fpsPositionCursorEntryCameraPitch !== null;
      this.dependencies.camera.fpsPositionCursorOrbitYaw = 0;
      this.dependencies.camera.fpsPositionCursorOrbitPitch = 0;
      this.positionInputCameraSuppressed = false;
      this.clearPositionCursor();
      this.dependencies.engineState.uiAdapter.setPositionRequest(null);
      this.dependencies.tileUpdates.refreshCurrentPlayerTileVisualFromStateCache();
      this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
      return;
    }

    if (this.positionInputModeActive === active) {
      this.positionInputOrigin = active ? origin : null;
      return;
    }

    if (this.positionHideTimerId !== null) {
      window.clearTimeout(this.positionHideTimerId);
      this.positionHideTimerId = null;
    }
    this.positionInputModeActive = true;
    this.positionInputOrigin = origin;
    this.positionInputCameraSuppressed ||= Boolean(this.dependencies.tileContextActions.fpsCrosshairGlancePending);
    this.dependencies.engineState.uiAdapter.setPositionInputActive(true, origin);
    if (this.positionInputCameraSuppressed) {
      if (this.dependencies.tileContextActions.fpsCrosshairGlancePending) this.dependencies.tileContextActions.fpsCrosshairGlancePending.sawPositionInput = true;
      this.dependencies.camera.fpsPositionCursorReturnActive = false;
      this.clearPositionCursor();
      return;
    }
    this.dependencies.camera.fpsPositionCursorCameraInitialized = false;
    this.dependencies.camera.fpsPositionCursorManualOverrideUntilMs = 0;
    this.dependencies.camera.fpsPositionCursorReturnActive = false;
    const entryCameraYaw = Number.isFinite(this.dependencies.camera.cameraYaw)
      ? this.dependencies.camera.wrapAngle(this.dependencies.camera.cameraYaw)
      : 0;
    const entryCameraPitch = Number.isFinite(this.dependencies.camera.cameraPitch)
      ? this.dependencies.camera.cameraPitch
      : this.dependencies.camera.positionCursorFarLookDefaultPitch;
    const initialOrbitPitch = Math.max(
      entryCameraPitch,
      this.dependencies.camera.positionCursorFarLookDefaultPitch,
    );
    this.dependencies.camera.fpsPositionCursorEntryCameraYaw = entryCameraYaw;
    this.dependencies.camera.fpsPositionCursorEntryCameraPitch = entryCameraPitch;
    this.dependencies.camera.fpsPositionCursorOrbitYaw = entryCameraYaw;
    this.dependencies.camera.fpsPositionCursorOrbitPitch = THREE.MathUtils.clamp(
      initialOrbitPitch,
      this.dependencies.camera.minCameraPitch,
      this.dependencies.camera.maxCameraPitch,
    );
    if (this.dependencies.tileContextActions.fpsCrosshairGlancePending) {
      this.dependencies.tileContextActions.fpsCrosshairGlancePending.sawPositionInput = true;
    }
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(false);

    // Preserve any cursor published before the active-state event arrives.
    if (!this.hasRuntimePositionCursor) {
      this.positionCursor = { ...this.dependencies.playerMovement.playerPos };
    }
    this.updatePositionCursorOutline();
    this.dependencies.tileUpdates.refreshCurrentPlayerTileVisualFromStateCache();
    if (this.dependencies.movementInput.isFpsMode()) {
      this.dependencies.tileUpdates.requestPlayerTileRefresh("fps-far-look-enter", {
        forceRuntime: true,
      });
    }
  }

  setPositionCursorPosition(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    this.positionCursor = { x, y };
    this.hasRuntimePositionCursor = true;
    if (this.positionInputModeActive) {
      this.updatePositionCursorOutline();
    }
  }

  updatePositionCursorOutline(): void {
    if (!this.positionInputModeActive || this.positionInputCameraSuppressed) {
      this.clearPositionCursor();
      return;
    }

    const outline = this.ensurePositionCursorOutline();
    const key = `${this.positionCursor.x},${this.positionCursor.y}`;
    const targetTileMesh = this.dependencies.tileRendering.tileMap.get(key);
    const height =
      targetTileMesh?.userData?.isWall === true
        ? Math.max(this.positionCursorColumnHeight, WALL_HEIGHT + 0.22)
        : this.positionCursorColumnHeight;
    const heightScale = height / this.positionCursorColumnHeight;
    outline.position.set(
      this.positionCursor.x * TILE_SIZE,
      -this.positionCursor.y * TILE_SIZE,
      this.positionCursorGroundZ,
    );
    outline.scale.set(1, 1, heightScale);
    outline.userData.heightScale = heightScale;
    outline.userData.tileX = this.positionCursor.x;
    outline.userData.tileY = this.positionCursor.y;
    outline.visible = true;
  }

  clearPositionCursor(): void {
    if (this.positionCursorOutline) {
      this.positionCursorOutline.visible = false;
    }
  }

  isFpsFarLookViewActive(): boolean {
    return this.dependencies.movementInput.isFpsMode() && this.positionInputModeActive && !this.positionInputCameraSuppressed;
  }

  updatePositionCursorPulse(timeMs: number): void {
    const outline = this.positionCursorOutline;
    if (!outline || !outline.visible) {
      return;
    }

    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 220);
    const radialScale = 1 + pulse * 0.045;
    const heightScale =
      typeof outline.userData.heightScale === "number" &&
      Number.isFinite(outline.userData.heightScale)
        ? outline.userData.heightScale
        : 1;
    outline.scale.set(radialScale, radialScale, heightScale);

    if (this.positionCursorColumnMaterial) {
      this.positionCursorColumnMaterial.opacity = 0.048 + pulse * 0.066;
    }
  }

  showPositionRequest(text: string): void {
    if (this.positionHideTimerId !== null) {
      window.clearTimeout(this.positionHideTimerId);
      this.positionHideTimerId = null;
    }

    this.dependencies.pointerLock.syncFpsPointerLockForUiState(false);
    this.dependencies.engineState.uiAdapter.setPositionRequest(text);
  }

  resolvePositionInputConfirmKey(event: KeyboardEvent): string | null {
    if (event.key === "Enter") {
      return "Enter";
    }
    if (
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space"
    ) {
      return ".";
    }
    if (
      event.key === "." ||
      event.key === "Decimal" ||
      event.code === "NumpadDecimal"
    ) {
      return ".";
    }
    if (
      this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem" &&
      this.positionInputOrigin === "legacy_cursor_prompt" &&
      event.key === ","
    ) {
      return ",";
    }
    if (event.key === "s" || event.key === "S") {
      return "s";
    }
    if (event.code === "Numpad5") {
      return this.dependencies.inputCommands.numberPadModeEnabled ? "5" : ".";
    }
    return null;
  }

  resolveTravelPositionShortcutKey(
    event: KeyboardEvent,
    priorityOnly: boolean = false,
  ): string | null {
    if (this.positionInputOrigin !== "travel") {
      return null;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return null;
    }
    if (typeof event.key !== "string" || event.key.length !== 1) {
      return null;
    }
    if (event.key === " ") {
      return null;
    }
    if (
      priorityOnly &&
      !/^[mMoOdDxXaAzZ@?$#!"*,;:<>\[\]{}()+=_\-|\\^~]$/.test(event.key)
    ) {
      return null;
    }
    return event.key;
  }

  tryResolvePositionInputMovementKey(
    event: KeyboardEvent,
  ): string | null {
    if (this.dependencies.movementInput.isFpsMode()) {
      return this.dependencies.movementInput.tryResolveFpsPositionLookInput(event.key, event.code);
    }

    const mappedNav = this.dependencies.movementInput.mapDirectionalKeyFromNavigationInput(event.key);
    if (mappedNav) {
      return mappedNav;
    }

    if (event.code.startsWith("Numpad") && /^[1-9]$/.test(event.key)) {
      return this.dependencies.movementInput.mapNumpadDigitToDirectionKey(event.key);
    }

    if (this.dependencies.inputCommands.numberPadModeEnabled && /^[1-9]$/.test(event.key)) {
      return event.key;
    }

    if (!this.dependencies.inputCommands.numberPadModeEnabled) {
      const lowerKey = event.key.toLowerCase();
      if ("hjklyubn".includes(lowerKey)) {
        return lowerKey;
      }
    }

    return null;
  }

  cancelPositionInputMode(reason: string = "unknown"): void {
    console.log(`Cancelling position input mode (${reason})`);
    this.dependencies.inputCommands.sendInput("Escape");
    if (this.dependencies.promptDialogs.isInfoDialogVisible) {
      this.dependencies.promptDialogs.hideInfoMenuDialog();
    }
    this.setPositionInputMode(false);
    if (this.positionHideTimerId !== null) {
      window.clearTimeout(this.positionHideTimerId);
      this.positionHideTimerId = null;
    }
    this.dependencies.engineState.uiAdapter.setPositionRequest(null);
  }

  isFarLookPositionInputMode(): boolean {
    return (
      this.positionInputModeActive && this.positionInputOrigin !== "travel"
    );
  }

  isPositionCursorAtTile(x: number, y: number): boolean {
    return (
      Number.isFinite(this.positionCursor.x) &&
      Number.isFinite(this.positionCursor.y) &&
      Math.trunc(this.positionCursor.x) === Math.trunc(x) &&
      Math.trunc(this.positionCursor.y) === Math.trunc(y)
    );
  }

  buildPositionCursorMovementInputSequence(
    targetX: number,
    targetY: number,
  ): string[] {
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return [];
    }
    if (
      !Number.isFinite(this.positionCursor.x) ||
      !Number.isFinite(this.positionCursor.y)
    ) {
      return [];
    }

    let cursorX = Math.trunc(this.positionCursor.x);
    let cursorY = Math.trunc(this.positionCursor.y);
    const destinationX = Math.trunc(targetX);
    const destinationY = Math.trunc(targetY);
    const inputs: string[] = [];
    const maxSteps = 256;

    while (
      (cursorX !== destinationX || cursorY !== destinationY) &&
      inputs.length < maxSteps
    ) {
      const stepX = Math.sign(destinationX - cursorX);
      const stepY = Math.sign(destinationY - cursorY);
      const input = this.dependencies.movementInput.getDirectionInputFromMapDelta(stepX, stepY);
      if (!input) {
        break;
      }
      inputs.push(input);
      cursorX += stepX;
      cursorY += stepY;
    }

    return cursorX === destinationX && cursorY === destinationY ? inputs : [];
  }

  getPositionInputPointerTarget(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const directTarget = this.dependencies.pointerTargeting.resolvePointerTargetTileFromClientCoordinates(
      clientX,
      clientY,
    );
    if (directTarget) {
      return directTarget;
    }

    const gridTarget = this.dependencies.pointerTargeting.getGridPositionFromClientCoordinates(
      clientX,
      clientY,
    );
    if (!gridTarget) {
      return null;
    }
    return {
      x: Math.round(gridTarget.x),
      y: Math.round(gridTarget.y),
    };
  }

  handleFarLookPositionPointerSelection(
    clientX: number,
    clientY: number,
    source: string,
  ): boolean {
    if (!this.isFarLookPositionInputMode()) {
      return false;
    }

    const target = this.getPositionInputPointerTarget(clientX, clientY);
    if (!target) {
      return false;
    }

    return this.handleFarLookPositionTileSelection(target.x, target.y, source);
  }

  /** Shared by screen pointers and a native Quest ray resolved to a map tile. */
  handleFarLookPositionTileSelection(x: number, y: number, source: string): boolean {
    if (!this.isFarLookPositionInputMode() || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    const target = { x, y };
    if (this.isPositionCursorAtTile(target.x, target.y)) {
      this.dependencies.engineMessages.logClickLookTileDebug(source, target.x, target.y);
      this.dependencies.inputCommands.sendMouseInput(target.x, target.y, 0);
      return true;
    }

    const movementInputs = this.buildPositionCursorMovementInputSequence(
      target.x,
      target.y,
    );
    this.setPositionCursorPosition(target.x, target.y);
    if (movementInputs.length > 0) {
      this.dependencies.inputCommands.sendInputSequence(movementInputs);
    }
    return true;
  }

  getPositionCursorOutlineRenderOrder(): number {
    return (
      this.dependencies.entityBillboards.resolveStandardBillboardRenderOrder(this.dependencies.tilesetAssets.shouldUseVultureTiles()) -
      0.2
    );
  }
}
