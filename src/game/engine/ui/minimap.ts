import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import { classifyTileBehavior, getDefaultFloorGlyph } from "../../glyphs/behavior";
import {
  getTerminalColorHex,
  resolveTerminalCellPresentation,
  TERMINAL_BACKGROUND_HEX,
  TERMINAL_DEFAULT_FG_HEX
} from "../../terminal/terminal-display";
import type { TileBehaviorResult } from "../../glyphs";
import type { MinimapViewportRect, MinimapCellPresentation } from "../shared/types";
import {
  MINIMAP_WIDTH_TILES,
  MINIMAP_HEIGHT_TILES,
  MINIMAP_FLOOR_FOREGROUND_WEIGHT,
  MINIMAP_PLAYER_PULSE_PERIOD_MS,
  MINIMAP_PLAYER_PULSE_MIN_BRIGHTNESS,
  MINIMAP_NETHACK_3D_PALETTE
} from "../shared/constants";
import type { Camera } from "../camera/camera";
import type { ControllerGameplay } from "../input/controller-gameplay";
import type { DirectionPrompts } from "./direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { HeldWeaponAnimationDebug } from "../diagnostics/held-weapon-animation-debug";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { WorldClassification } from "../world/world-classification";

export interface MinimapDependencies {
  readonly camera: Pick<
    Camera,
    "camera"
    | "cameraDistance"
    | "cameraFollowCurrent"
    | "cameraFollowInitialized"
    | "cameraPanTargetX"
    | "cameraPanTargetY"
    | "cameraPanX"
    | "cameraPanY"
    | "cameraPitch"
    | "cameraYaw"
    | "isCameraCenteredOnPlayer"
    | "terminalCamera"
  >;
  readonly controllerGameplay: Pick<
    ControllerGameplay,
    "controllerMinimapExpanded"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly heldWeaponAnimationDebug: Pick<
    HeldWeaponAnimationDebug,
    "syncFpsHeldWeaponAnimationDebugPanelPosition"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "parseTileKey"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isAnyModalVisible"
    | "runtimeConnectionState"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
    | "terminalDesktopGutterActive"
    | "terminalGutterMinimapVisible"
    | "terminalRenderOptionStates"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "classifyTilePayload"
    | "getPlayerTileUnderlaySnapshotFromCache"
  >;
}

/** Minimap cells, rendering, viewport presentation, action rail overlap and pointer navigation. */
export class Minimap {
  constructor(private readonly dependencies: MinimapDependencies) {}

  minimapTrackedPlayerTileKey: string | null = null;

  minimapContainer: HTMLDivElement | null = null;

  minimapCanvasContext: CanvasRenderingContext2D | null = null;

  minimapViewportContext: CanvasRenderingContext2D | null = null;

  minimapCells: string[] = Array(
    MINIMAP_WIDTH_TILES * MINIMAP_HEIGHT_TILES,
  ).fill(MINIMAP_NETHACK_3D_PALETTE[0]);

  pendingMinimapCellUpdates: Map<number, string> = new Map();

  minimapFlushScheduled: boolean = false;

  minimapDragPointerId: number | null = null;

  minimapActionRailSyncRafId: number | null = null;

  ensureMinimapOverlay(): void {
    if (this.minimapContainer && this.minimapCanvasContext) {
      return;
    }

    const container = document.createElement("div");
    container.className = "nh3d-minimap";
    container.setAttribute("aria-label", "Dungeon minimap");

    const mapCanvas = document.createElement("canvas");
    mapCanvas.className = "nh3d-minimap-canvas";
    mapCanvas.width = MINIMAP_WIDTH_TILES;
    mapCanvas.height = MINIMAP_HEIGHT_TILES;
    const mapContext = mapCanvas.getContext("2d");
    if (!mapContext) {
      return;
    }
    mapContext.imageSmoothingEnabled = false;
    container.appendChild(mapCanvas);

    const viewportCanvas = document.createElement("canvas");
    viewportCanvas.className = "nh3d-minimap-viewport";
    viewportCanvas.width = MINIMAP_WIDTH_TILES;
    viewportCanvas.height = MINIMAP_HEIGHT_TILES;
    const viewportContext = viewportCanvas.getContext("2d");
    if (!viewportContext) {
      return;
    }
    viewportContext.imageSmoothingEnabled = false;
    container.appendChild(viewportCanvas);

    container.addEventListener(
      "pointerdown",
      this.handleMinimapPointerDown.bind(this),
      false,
    );
    container.addEventListener(
      "pointermove",
      this.handleMinimapPointerMove.bind(this),
      false,
    );
    container.addEventListener(
      "pointerup",
      this.handleMinimapPointerUp.bind(this),
      false,
    );
    container.addEventListener(
      "pointercancel",
      this.handleMinimapPointerUp.bind(this),
      false,
    );
    container.addEventListener(
      "lostpointercapture",
      this.handleMinimapPointerUp.bind(this),
      false,
    );
    document.body.appendChild(container);

    this.minimapContainer = container;
    this.minimapCanvasContext = mapContext;
    this.minimapViewportContext = viewportContext;
    this.updateMinimapPresentation();
    this.resetMinimap();
    this.renderMinimapViewportOverlay();
  }

  resetMinimap(): void {
    const backgroundColor = this.resolveMinimapBackgroundColor();
    this.pendingMinimapCellUpdates.clear();
    this.minimapFlushScheduled = false;
    this.minimapCells.fill(backgroundColor);
    this.stopMinimapDrag();

    if (this.minimapCanvasContext) {
      this.minimapCanvasContext.clearRect(
        0,
        0,
        MINIMAP_WIDTH_TILES,
        MINIMAP_HEIGHT_TILES,
      );
      this.minimapCanvasContext.fillStyle = backgroundColor;
      this.minimapCanvasContext.fillRect(
        0,
        0,
        MINIMAP_WIDTH_TILES,
        MINIMAP_HEIGHT_TILES,
      );
    }
    if (this.minimapViewportContext) {
      this.minimapViewportContext.clearRect(
        0,
        0,
        MINIMAP_WIDTH_TILES,
        MINIMAP_HEIGHT_TILES,
      );
    }
  }

  updateMinimapVisibility(): void {
    if (!this.minimapContainer) {
      return;
    }

    const minimapRequested = this.dependencies.terminalRendering.terminalDesktopGutterActive
      ? this.dependencies.terminalRendering.terminalGutterMinimapVisible
      : this.dependencies.engineState.clientOptions.minimap;
    const visible =
      minimapRequested && this.dependencies.promptDialogs.runtimeConnectionState === "running";
    this.minimapContainer.style.display = visible ? "" : "none";
    this.minimapContainer.style.pointerEvents = visible ? "auto" : "none";
    this.minimapContainer.setAttribute(
      "aria-hidden",
      visible ? "false" : "true",
    );
    this.updateMinimapPresentation();
    if (!visible) {
      this.stopMinimapDrag();
      this.dependencies.heldWeaponAnimationDebug.syncFpsHeldWeaponAnimationDebugPanelPosition();
      return;
    }
    this.renderMinimapViewportOverlay();
    this.dependencies.heldWeaponAnimationDebug.syncFpsHeldWeaponAnimationDebugPanelPosition();
  }

  updateMinimapPresentation(): void {
    if (!this.minimapContainer) {
      return;
    }
    const fpsMode = this.dependencies.movementInput.isFpsMode();
    this.minimapContainer.classList.toggle("nh3d-minimap-fps", fpsMode);
    this.minimapContainer.classList.toggle(
      "nh3d-minimap-controller-expanded",
      this.dependencies.controllerGameplay.controllerMinimapExpanded,
    );
    this.scheduleMinimapActionRailOverlapSync();
    this.dependencies.heldWeaponAnimationDebug.syncFpsHeldWeaponAnimationDebugPanelPosition();
  }

  setTerminalGutterMinimapState(
    gutterActive: boolean,
    minimapVisible: boolean,
  ): void {
    const normalizedGutterActive = Boolean(gutterActive);
    const normalizedVisible = normalizedGutterActive && Boolean(minimapVisible);
    const root = document.documentElement;
    const className = "nh3d-terminal-gutter-minimap-visible";
    if (
      this.dependencies.terminalRendering.terminalDesktopGutterActive === normalizedGutterActive &&
      this.dependencies.terminalRendering.terminalGutterMinimapVisible === normalizedVisible &&
      root.classList.contains(className) === normalizedVisible
    ) {
      return;
    }
    this.dependencies.terminalRendering.terminalDesktopGutterActive = normalizedGutterActive;
    this.dependencies.terminalRendering.terminalGutterMinimapVisible = normalizedVisible;
    root.classList.toggle(className, normalizedVisible);
    this.updateMinimapVisibility();
  }

  scheduleMinimapActionRailOverlapSync(): void {
    if (this.minimapActionRailSyncRafId !== null) {
      window.cancelAnimationFrame(this.minimapActionRailSyncRafId);
    }
    this.minimapActionRailSyncRafId = window.requestAnimationFrame(() => {
      this.minimapActionRailSyncRafId = null;
      this.syncMinimapActionRailOverlap();
    });
  }

  syncMinimapActionRailOverlap(): void {
    const minimap = this.minimapContainer;
    if (!minimap) {
      return;
    }

    const shouldConsiderActionRail =
      typeof window.matchMedia === "function" &&
      (window.matchMedia("(orientation: landscape) and (pointer: coarse)")
        .matches ||
        document.documentElement.classList.contains(
          "nh3d-force-touch-layout-landscape",
        ));
    if (
      !shouldConsiderActionRail ||
      minimap.style.display === "none" ||
      getComputedStyle(minimap).display === "none"
    ) {
      minimap.classList.remove("nh3d-minimap-avoid-action-rail");
      return;
    }

    const actionRail = document.querySelector<HTMLElement>(
      ".nh3d-mobile-bottom-bar",
    );
    if (!actionRail || getComputedStyle(actionRail).display === "none") {
      minimap.classList.remove("nh3d-minimap-avoid-action-rail");
      return;
    }

    const wasAvoidingRail = minimap.classList.contains(
      "nh3d-minimap-avoid-action-rail",
    );
    if (wasAvoidingRail) {
      minimap.classList.remove("nh3d-minimap-avoid-action-rail");
    }

    const minimapRect = minimap.getBoundingClientRect();
    const railRect = actionRail.getBoundingClientRect();
    const overlapPaddingPx = 6;
    const overlapsRail =
      minimapRect.width > 0 &&
      minimapRect.height > 0 &&
      railRect.width > 0 &&
      railRect.height > 0 &&
      minimapRect.right + overlapPaddingPx > railRect.left &&
      minimapRect.left < railRect.right &&
      minimapRect.bottom + overlapPaddingPx > railRect.top &&
      minimapRect.top < railRect.bottom;

    minimap.classList.toggle("nh3d-minimap-avoid-action-rail", overlapsRail);
  }

  isValidMinimapCoordinate(x: number, y: number): boolean {
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      x < MINIMAP_WIDTH_TILES &&
      y >= 0 &&
      y < MINIMAP_HEIGHT_TILES
    );
  }

  getMinimapCellIndex(x: number, y: number): number {
    return y * MINIMAP_WIDTH_TILES + x;
  }

  resolveMinimapPlayerTile(): { x: number; y: number } {
    const trackedPlayerTile = this.minimapTrackedPlayerTileKey
      ? this.dependencies.levelTerrainCache.parseTileKey(this.minimapTrackedPlayerTileKey)
      : null;
    if (
      trackedPlayerTile &&
      this.isValidMinimapCoordinate(trackedPlayerTile.x, trackedPlayerTile.y)
    ) {
      return trackedPlayerTile;
    }
    return this.dependencies.playerMovement.playerPos;
  }

  resolveMinimapBackgroundColor(): string {
    return this.dependencies.engineState.clientOptions.minimapColorMode === "terminal"
      ? TERMINAL_BACKGROUND_HEX
      : MINIMAP_NETHACK_3D_PALETTE[0];
  }

  resolveNh3dMinimapCellColor(
    behavior: TileBehaviorResult,
    isUndiscovered: boolean,
  ): string {
    if (behavior.isPlayerGlyph || behavior.materialKind === "player") {
      return MINIMAP_NETHACK_3D_PALETTE[12];
    }
    if (isUndiscovered) {
      return MINIMAP_NETHACK_3D_PALETTE[1];
    }

    switch (behavior.materialKind) {
      case "wall":
      case "dark_wall":
        return MINIMAP_NETHACK_3D_PALETTE[3];
      case "door":
        return MINIMAP_NETHACK_3D_PALETTE[4];
      case "water":
      case "fountain":
        return MINIMAP_NETHACK_3D_PALETTE[5];
      case "stairs_up":
      case "stairs_down":
        return MINIMAP_NETHACK_3D_PALETTE[6];
      case "trap":
      case "feature":
      case "effect_warning":
      case "effect_zap":
      case "effect_explode":
      case "effect_swallow":
        return MINIMAP_NETHACK_3D_PALETTE[7];
      case "item":
        return MINIMAP_NETHACK_3D_PALETTE[8];
      case "monster_hostile":
        return MINIMAP_NETHACK_3D_PALETTE[9];
      case "monster_friendly":
        return MINIMAP_NETHACK_3D_PALETTE[10];
      case "monster_neutral":
        return MINIMAP_NETHACK_3D_PALETTE[11];
      case "floor":
      case "dark":
      case "default":
      default:
        return MINIMAP_NETHACK_3D_PALETTE[2];
    }
  }

  resolveMinimapCellColor(
    behavior: TileBehaviorResult,
    isUndiscovered: boolean,
    presentation: MinimapCellPresentation = {},
  ): string {
    if (this.dependencies.engineState.clientOptions.minimapColorMode === "nethack-3d") {
      if (presentation.forcePlayer === true) {
        return MINIMAP_NETHACK_3D_PALETTE[12];
      }
      return this.resolveNh3dMinimapCellColor(behavior, isUndiscovered);
    }

    const backgroundHex =
      presentation.backgroundHex ?? TERMINAL_BACKGROUND_HEX;
    if (isUndiscovered) {
      return backgroundHex;
    }

    const displayChar = presentation.displayChar ?? behavior.glyphChar;
    if (!displayChar || displayChar.trim().length === 0) {
      return backgroundHex;
    }

    const foregroundHex =
      presentation.foregroundHex ??
      getTerminalColorHex(behavior.resolved.color);
    if (presentation.forcePlayer === true) {
      return presentation.inverse === true ? backgroundHex : foregroundHex;
    }
    // A one-pixel minimap cell cannot show both halves of reverse video.
    // Its colored background is the useful identifying color; choosing the
    // black foreground makes highlighted pets and piles disappear.
    if (presentation.inverse === true) {
      return backgroundHex;
    }
    if (
      behavior.materialKind !== "floor" &&
      behavior.materialKind !== "dark"
    ) {
      return foregroundHex;
    }

    const floorColor = new THREE.Color(foregroundHex);
    const backgroundColor = new THREE.Color(backgroundHex);
    floorColor.lerp(
      backgroundColor,
      1 - MINIMAP_FLOOR_FOREGROUND_WEIGHT,
    );
    return `#${floorColor.getHexString()}`;
  }

  queueMinimapTileUpdate(
    x: number,
    y: number,
    behavior: TileBehaviorResult,
    isUndiscovered: boolean,
    presentation: MinimapCellPresentation = {},
  ): void {
    const tileX = Math.trunc(x);
    const tileY = Math.trunc(y);
    if (!this.isValidMinimapCoordinate(tileX, tileY)) {
      return;
    }

    const index = this.getMinimapCellIndex(tileX, tileY);
    const cellColor = this.resolveMinimapCellColor(
      behavior,
      isUndiscovered,
      presentation,
    );
    const pending = this.pendingMinimapCellUpdates.get(index);
    if (pending === cellColor) {
      return;
    }
    if (
      !this.pendingMinimapCellUpdates.has(index) &&
      this.minimapCells[index] === cellColor
    ) {
      return;
    }

    this.pendingMinimapCellUpdates.set(index, cellColor);
    this.scheduleMinimapTileFlush();
  }

  scheduleMinimapTileFlush(): void {
    if (this.minimapFlushScheduled) {
      return;
    }
    this.minimapFlushScheduled = true;
    requestAnimationFrame(() => {
      this.minimapFlushScheduled = false;
      this.flushPendingMinimapTileUpdates();
    });
  }

  flushPendingMinimapTileUpdates(): void {
    if (!this.minimapCanvasContext || !this.pendingMinimapCellUpdates.size) {
      return;
    }

    for (const [
      index,
      cellColor,
    ] of this.pendingMinimapCellUpdates.entries()) {
      this.minimapCells[index] = cellColor;
      const x = index % MINIMAP_WIDTH_TILES;
      const y = Math.floor(index / MINIMAP_WIDTH_TILES);
      this.minimapCanvasContext.fillStyle = cellColor;
      this.minimapCanvasContext.fillRect(x, y, 1, 1);
    }
    this.pendingMinimapCellUpdates.clear();
  }

  computeMinimapViewportRect(): MinimapViewportRect {
    if (this.dependencies.terminalRendering.isTerminalDisplayMode() && this.dependencies.camera.terminalCamera) {
      const ortho = this.dependencies.camera.terminalCamera;
      const viewWidthTiles = THREE.MathUtils.clamp(
        (ortho.right - ortho.left) / TILE_SIZE,
        4,
        MINIMAP_WIDTH_TILES,
      );
      const viewHeightTiles = THREE.MathUtils.clamp(
        (ortho.top - ortho.bottom) / TILE_SIZE,
        3,
        MINIMAP_HEIGHT_TILES,
      );
      return {
        minX: ortho.position.x / TILE_SIZE - viewWidthTiles / 2,
        minY: -ortho.position.y / TILE_SIZE - viewHeightTiles / 2,
        width: viewWidthTiles,
        height: viewHeightTiles,
      };
    }
    const centerWorldX = this.dependencies.camera.cameraFollowInitialized
      ? this.dependencies.camera.cameraFollowCurrent.x
      : this.dependencies.playerMovement.playerPos.x * TILE_SIZE + this.dependencies.camera.cameraPanTargetX;
    const centerWorldY = this.dependencies.camera.cameraFollowInitialized
      ? this.dependencies.camera.cameraFollowCurrent.y
      : -this.dependencies.playerMovement.playerPos.y * TILE_SIZE + this.dependencies.camera.cameraPanTargetY;
    const centerTileX = centerWorldX / TILE_SIZE;
    const centerTileY = -centerWorldY / TILE_SIZE;

    const fovRadians = THREE.MathUtils.degToRad(this.dependencies.camera.camera.fov);
    const baseViewHeightWorld =
      2 * Math.tan(fovRadians / 2) * Math.max(1, this.dependencies.camera.cameraDistance);
    const baseViewWidthWorld =
      baseViewHeightWorld * Math.max(1, this.dependencies.camera.camera.aspect);
    const pitchScale = 1 / Math.max(0.45, Math.sin(this.dependencies.camera.cameraPitch));

    const viewWidthTiles = THREE.MathUtils.clamp(
      (baseViewWidthWorld * pitchScale) / TILE_SIZE,
      4,
      MINIMAP_WIDTH_TILES,
    );
    const viewHeightTiles = THREE.MathUtils.clamp(
      (baseViewHeightWorld * pitchScale) / TILE_SIZE,
      3,
      MINIMAP_HEIGHT_TILES,
    );

    return {
      minX: centerTileX - viewWidthTiles / 2,
      minY: centerTileY - viewHeightTiles / 2,
      width: viewWidthTiles,
      height: viewHeightTiles,
    };
  }

  renderMinimapViewportOverlay(timeMs: number = performance.now()): void {
    if (!this.minimapViewportContext) {
      return;
    }

    const viewport = this.computeMinimapViewportRect();
    const fpsMode = this.dependencies.movementInput.isFpsMode();

    const context = this.minimapViewportContext;
    context.clearRect(0, 0, MINIMAP_WIDTH_TILES, MINIMAP_HEIGHT_TILES);

    const drawMinX = THREE.MathUtils.clamp(
      viewport.minX,
      0,
      MINIMAP_WIDTH_TILES,
    );
    const drawMinY = THREE.MathUtils.clamp(
      viewport.minY,
      0,
      MINIMAP_HEIGHT_TILES,
    );
    const drawMaxX = THREE.MathUtils.clamp(
      viewport.minX + viewport.width,
      0,
      MINIMAP_WIDTH_TILES,
    );
    const drawMaxY = THREE.MathUtils.clamp(
      viewport.minY + viewport.height,
      0,
      MINIMAP_HEIGHT_TILES,
    );
    const drawWidth = Math.max(0, drawMaxX - drawMinX);
    const drawHeight = Math.max(0, drawMaxY - drawMinY);

    if (!fpsMode && drawWidth > 0 && drawHeight > 0) {
      context.fillStyle = "rgba(214, 233, 255, 0.08)";
      context.fillRect(drawMinX, drawMinY, drawWidth, drawHeight);

      context.strokeStyle = "rgba(214, 233, 255, 0.62)";
      context.lineWidth = 0.65;
      context.strokeRect(
        drawMinX + 0.325,
        drawMinY + 0.325,
        drawWidth,
        drawHeight,
      );
    }

    const minimapPlayerTile = this.resolveMinimapPlayerTile();
    if (
      this.isValidMinimapCoordinate(
        minimapPlayerTile.x,
        minimapPlayerTile.y,
      )
    ) {
      if (fpsMode) {
        const playerX = minimapPlayerTile.x + 0.5;
        const playerY = minimapPlayerTile.y + 0.5;
        const forwardX = -Math.sin(this.dependencies.camera.cameraYaw);
        const forwardY = Math.cos(this.dependencies.camera.cameraYaw);
        const facingAngle = Math.atan2(forwardY, forwardX);
        const verticalFovRadians = THREE.MathUtils.degToRad(this.dependencies.camera.camera.fov);
        const horizontalFovRadians =
          2 *
          Math.atan(
            Math.tan(verticalFovRadians * 0.5) *
              Math.max(0.1, this.dependencies.camera.camera.aspect),
          );
        // Keep cone angle matched to the actual rendered camera FOV.
        const halfConeRadians = horizontalFovRadians * 0.5;
        // Shrink the rendered cone footprint proportionally while preserving angle.
        const baseConeRangeTiles = THREE.MathUtils.clamp(
          8 + horizontalFovRadians * 3.4,
          8,
          15,
        );
        const coneRangeTiles = baseConeRangeTiles * 0.68;

        const leftAngle = facingAngle - halfConeRadians;
        const rightAngle = facingAngle + halfConeRadians;
        const leftX = playerX + Math.cos(leftAngle) * coneRangeTiles;
        const leftY = playerY + Math.sin(leftAngle) * coneRangeTiles;
        const rightX = playerX + Math.cos(rightAngle) * coneRangeTiles;
        const rightY = playerY + Math.sin(rightAngle) * coneRangeTiles;

        context.save();
        context.beginPath();
        context.moveTo(playerX, playerY);
        context.lineTo(leftX, leftY);
        context.lineTo(rightX, rightY);
        context.closePath();
        const coneFillStyle = "rgba(166, 219, 255, 0.11)";
        context.fillStyle = coneFillStyle;
        context.fill();
        // Blend the far edge with the fill so it reads as a cone, not a triangle.
        context.strokeStyle = coneFillStyle;
        context.lineWidth = 0.36;
        context.stroke();

        // Keep only subtle side boundaries from the origin.
        context.beginPath();
        context.moveTo(playerX, playerY);
        context.lineTo(leftX, leftY);
        context.moveTo(playerX, playerY);
        context.lineTo(rightX, rightY);
        context.strokeStyle = "rgba(216, 240, 255, 0.34)";
        context.lineWidth = 0.44;
        context.stroke();

        context.beginPath();
        context.arc(playerX, playerY, 0.48, 0, Math.PI * 2, false);
        context.fillStyle = "rgba(250, 252, 255, 0.96)";
        context.fill();
        context.lineWidth = 0.22;
        context.strokeStyle = "rgba(36, 53, 79, 0.92)";
        context.stroke();

        const rightXDir = -forwardY;
        const rightYDir = forwardX;
        const noseX = playerX + forwardX * 0.92;
        const noseY = playerY + forwardY * 0.92;
        const tailCenterX = playerX - forwardX * 0.3;
        const tailCenterY = playerY - forwardY * 0.3;
        const tailLeftX = tailCenterX + rightXDir * 0.28;
        const tailLeftY = tailCenterY + rightYDir * 0.28;
        const tailRightX = tailCenterX - rightXDir * 0.28;
        const tailRightY = tailCenterY - rightYDir * 0.28;
        context.beginPath();
        context.moveTo(noseX, noseY);
        context.lineTo(tailLeftX, tailLeftY);
        context.lineTo(tailRightX, tailRightY);
        context.closePath();
        context.fillStyle = "rgba(96, 173, 236, 0.95)";
        context.fill();
        context.restore();
        return;
      }

      const playerCellIndex = this.getMinimapCellIndex(
        minimapPlayerTile.x,
        minimapPlayerTile.y,
      );
      if (this.dependencies.engineState.clientOptions.minimapColorMode === "nethack-3d") {
        const pulseAmount = this.dependencies.engineState.clientOptions.disableAnimatedTransitions
          ? 1
          : (Math.sin(
                (timeMs / MINIMAP_PLAYER_PULSE_PERIOD_MS) * Math.PI * 2,
              ) +
              1) /
            2;
        const brightness = Math.round(
          MINIMAP_PLAYER_PULSE_MIN_BRIGHTNESS +
            (255 - MINIMAP_PLAYER_PULSE_MIN_BRIGHTNESS) * pulseAmount,
        );
        context.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      } else {
        context.fillStyle =
          this.pendingMinimapCellUpdates.get(playerCellIndex) ??
          this.minimapCells[playerCellIndex] ??
          TERMINAL_DEFAULT_FG_HEX;
      }
      // The overlay canvas is exactly one pixel per map cell. Fractional
      // bounds blend into the cells above, left, and above-left, producing a
      // false 2x2 brightness block around the player.
      context.fillRect(
        minimapPlayerTile.x,
        minimapPlayerTile.y,
        1,
        1,
      );
    }
  }

  getMinimapPointerTile(
    event: PointerEvent,
  ): { x: number; y: number } | null {
    if (!this.minimapContainer) {
      return null;
    }
    const rect = this.minimapContainer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const relativeX = (event.clientX - rect.left) / rect.width;
    const relativeY = (event.clientY - rect.top) / rect.height;
    if (
      !Number.isFinite(relativeX) ||
      !Number.isFinite(relativeY) ||
      relativeX < 0 ||
      relativeX > 1 ||
      relativeY < 0 ||
      relativeY > 1
    ) {
      return null;
    }

    return {
      x: relativeX * MINIMAP_WIDTH_TILES,
      y: relativeY * MINIMAP_HEIGHT_TILES,
    };
  }

  centerCameraOnMinimapTile(tileX: number, tileY: number): void {
    const clampedTileX = THREE.MathUtils.clamp(
      tileX,
      0,
      MINIMAP_WIDTH_TILES - 1,
    );
    const clampedTileY = THREE.MathUtils.clamp(
      tileY,
      0,
      MINIMAP_HEIGHT_TILES - 1,
    );

    const targetWorldX = clampedTileX * TILE_SIZE;
    const targetWorldY = -clampedTileY * TILE_SIZE;
    this.dependencies.camera.cameraPanTargetX = targetWorldX - this.dependencies.playerMovement.playerPos.x * TILE_SIZE;
    this.dependencies.camera.cameraPanTargetY = targetWorldY + this.dependencies.playerMovement.playerPos.y * TILE_SIZE;
    this.dependencies.camera.cameraPanX = this.dependencies.camera.cameraPanTargetX;
    this.dependencies.camera.cameraPanY = this.dependencies.camera.cameraPanTargetY;
    this.dependencies.camera.isCameraCenteredOnPlayer = false;
  }

  handleMinimapPointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (
      this.dependencies.promptDialogs.isAnyModalVisible() ||
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion
    ) {
      return;
    }

    const pointerTile = this.getMinimapPointerTile(event);
    if (!pointerTile) {
      return;
    }
    this.minimapDragPointerId = event.pointerId;
    this.centerCameraOnMinimapTile(pointerTile.x, pointerTile.y);
    if (this.minimapContainer) {
      this.minimapContainer.setPointerCapture(event.pointerId);
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  handleMinimapPointerMove(event: PointerEvent): void {
    if (this.minimapDragPointerId !== event.pointerId) {
      return;
    }

    const pointerTile = this.getMinimapPointerTile(event);
    if (!pointerTile) {
      return;
    }
    this.centerCameraOnMinimapTile(pointerTile.x, pointerTile.y);

    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  handleMinimapPointerUp(event: PointerEvent): void {
    if (
      this.minimapDragPointerId !== null &&
      this.minimapDragPointerId !== event.pointerId
    ) {
      return;
    }
    this.stopMinimapDrag();
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  stopMinimapDrag(): void {
    if (
      this.minimapContainer &&
      this.minimapDragPointerId !== null &&
      this.minimapContainer.hasPointerCapture(this.minimapDragPointerId)
    ) {
      this.minimapContainer.releasePointerCapture(this.minimapDragPointerId);
    }
    this.minimapDragPointerId = null;
  }

  restoreMinimapTileFromRememberedTerrain(tileKey: string): void {
    const tile = this.dependencies.levelTerrainCache.parseTileKey(tileKey);
    if (!tile) {
      return;
    }
    const snapshot = this.dependencies.worldClassification.getPlayerTileUnderlaySnapshotFromCache(tileKey);
    const fallbackGlyph = getDefaultFloorGlyph();
    const behavior = classifyTileBehavior({
      glyph: snapshot?.glyph ?? fallbackGlyph,
      runtimeChar: snapshot?.char ?? ".",
      runtimeColor:
        snapshot && typeof snapshot.color === "number" ? snapshot.color : null,
      runtimeTileIndex:
        snapshot && typeof snapshot.tileIndex === "number"
          ? snapshot.tileIndex
          : null,
      runtimeSymidx:
        snapshot && typeof snapshot.symidx === "number"
          ? snapshot.symidx
          : null,
      priorTerrain: snapshot,
    });
    this.queueMinimapTileUpdate(tile.x, tile.y, behavior, false, {
      foregroundHex: getTerminalColorHex(behavior.resolved.color),
      displayChar: snapshot?.char ?? behavior.glyphChar,
    });
  }

  queueRuntimeTrackedPlayerMinimapTile(tile: any): void {
    const behavior = this.dependencies.worldClassification.classifyTilePayload(tile);
    if (
      behavior === null ||
      typeof tile?.x !== "number" ||
      !Number.isFinite(tile.x) ||
      typeof tile?.y !== "number" ||
      !Number.isFinite(tile.y)
    ) {
      return;
    }
    const presentation = resolveTerminalCellPresentation({
      char: typeof tile.char === "string" ? tile.char : behavior.glyphChar,
      color:
        typeof tile.color === "number" ? tile.color : behavior.resolved.color,
      glyphFlags:
        typeof tile.glyphFlags === "number" ? tile.glyphFlags : null,
      optionStates: this.dependencies.terminalRendering.terminalRenderOptionStates,
    });
    this.queueMinimapTileUpdate(tile.x, tile.y, behavior, false, {
      foregroundHex: presentation.fgHex,
      backgroundHex: presentation.bgHex,
      displayChar: presentation.displayChar,
      inverse: presentation.inverse,
      forcePlayer: true,
    });
  }
}
