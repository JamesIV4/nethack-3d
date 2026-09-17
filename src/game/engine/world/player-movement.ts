import type { TileBehaviorResult } from "../../glyphs";
import type { Camera } from "../camera/camera";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { EntityMovement } from "./entity-movement";
import type { FpsDiagnostics } from "../diagnostics/fps-diagnostics";
import type { LevelTerrainCache } from "./level-terrain-cache";
import type { MovementInput } from "../input/movement-input";
import type { InputCommands } from "../input/input-commands";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { RuntimeEntityTracking } from "./runtime-entity-tracking";
import type { TileRendering } from "../rendering/tile-rendering";

export interface PlayerMovementDependencies {
  readonly inputCommands: Pick<InputCommands, "clearRepeatableAction">;
  readonly camera: Pick<
    Camera,
    "beginFpsStepCameraTransition"
    | "fpsAutoMoveDetectionWindowMs"
    | "fpsStepCameraActive"
    | "fpsStepCameraRunInputWindowMs"
    | "fpsStepCameraTargetTile"
    | "lastManualDirectionalInputAtMs"
    | "lastRunLikeInputAtMs"
    | "normalModePlayerMoveCameraFollowActive"
    | "recenterCameraOnPlayerIfNeeded"
    | "reserveSharedStepMotionDurationMs"
    | "updateFpsCameraAutoTurnFromMovement"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityMovement: Pick<
    EntityMovement,
    "activeEntityMoveTransitions"
    | "startPlayerMoveTransition"
    | "tryStartProvisionalPlayerSwapTransitions"
  >;
  readonly fpsDiagnostics: Pick<
    FpsDiagnostics,
    "logAsciiPlayerTileDebug"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "getTileSnapshotFromStateCache"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "getMovementDeltaFromInput"
    | "isFpsMode"
    | "lastMovementInputAtMs"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "pendingStartupInventoryRefresh"
    | "pendingStartupInventoryRefreshEarliestAtMs"
    | "startupInventoryRefreshDelayMs"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "hasRuntimeTrackedPlayerEntitySupport"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
    | "updateTile"
  >;
}

/** Player position reconciliation, movement prediction and suppression of vacated player glyphs. */
export class PlayerMovement {
  constructor(private readonly dependencies: PlayerMovementDependencies) {}

  playerPos = { x: 0, y: 0 };

  hasSeenPlayerPosition: boolean = false;

  readonly fpsPlayerTrailSuppressionWindowMs: number = 450;

  readonly fpsPlayerTrailSuppressionMaxEntries: number = 8;

  fpsRecentPlayerTilesForSuppression: Array<{
    x: number;
    y: number;
    capturedAtMs: number;
  }> = [];

  hasPlayerMovedOnce: boolean = false;

  fpsLastPlayerMoveFromTile: { x: number; y: number } | null = null;

  readonly movementUnlockWindowMs: number = 5000;

  readonly fpsPredictedPlayerTileWindowMs: number = 220;

  readonly asciiPendingPlayerTileWindowMs: number = 220;

  fpsPredictedPlayerTile: {
    x: number;
    y: number;
    expiresAtMs: number;
  } | null = null;

  asciiPendingPlayerTile: {
    x: number;
    y: number;
    expiresAtMs: number;
  } | null = null;

  pruneFpsRecentPlayerTilesForSuppression(nowMs: number): void {
    if (this.fpsRecentPlayerTilesForSuppression.length === 0) {
      return;
    }
    const cutoffMs = nowMs - this.fpsPlayerTrailSuppressionWindowMs;
    this.fpsRecentPlayerTilesForSuppression =
      this.fpsRecentPlayerTilesForSuppression.filter(
        (entry) => entry.capturedAtMs >= cutoffMs,
      );
    const overflowCount =
      this.fpsRecentPlayerTilesForSuppression.length -
      this.fpsPlayerTrailSuppressionMaxEntries;
    if (overflowCount > 0) {
      this.fpsRecentPlayerTilesForSuppression.splice(0, overflowCount);
    }
  }

  rememberRecentFpsPlayerTileForSuppression(
    tileX: number,
    tileY: number,
    nowMs: number,
  ): void {
    this.pruneFpsRecentPlayerTilesForSuppression(nowMs);
    const existing = this.fpsRecentPlayerTilesForSuppression.find(
      (entry) => entry.x === tileX && entry.y === tileY,
    );
    if (existing) {
      existing.capturedAtMs = nowMs;
      return;
    }
    this.fpsRecentPlayerTilesForSuppression.push({
      x: tileX,
      y: tileY,
      capturedAtMs: nowMs,
    });
    const overflowCount =
      this.fpsRecentPlayerTilesForSuppression.length -
      this.fpsPlayerTrailSuppressionMaxEntries;
    if (overflowCount > 0) {
      this.fpsRecentPlayerTilesForSuppression.splice(0, overflowCount);
    }
  }

  shouldSuppressRecentPlayerTrailTileInFps(
    tileX: number,
    tileY: number,
    nowMs: number,
  ): boolean {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return false;
    }
    this.pruneFpsRecentPlayerTilesForSuppression(nowMs);
    return this.fpsRecentPlayerTilesForSuppression.some(
      (entry) => entry.x === tileX && entry.y === tileY,
    );
  }

  getFpsPlayerTileRelationFlags(
    tileX: number,
    tileY: number,
    nowMs: number,
    behavior: TileBehaviorResult | null = null,
  ): {
    isCurrentPlayerTile: boolean;
    isStepDestinationTile: boolean;
    isPredictedPlayerTile: boolean;
    isTrailSuppressedTile: boolean;
    isPlayerGlyph: boolean;
    isPlayerMaterial: boolean;
  } {
    const isPlayerGlyph = behavior?.isPlayerGlyph === true;
    const isPlayerMaterial = behavior?.materialKind === "player";
    if (!this.dependencies.movementInput.isFpsMode()) {
      return {
        isCurrentPlayerTile: false,
        isStepDestinationTile: false,
        isPredictedPlayerTile: false,
        isTrailSuppressedTile: false,
        isPlayerGlyph,
        isPlayerMaterial,
      };
    }

    const isCurrentPlayerTile =
      this.hasSeenPlayerPosition &&
      tileX === this.playerPos.x &&
      tileY === this.playerPos.y;
    const isStepDestinationTile =
      this.dependencies.camera.fpsStepCameraTargetTile !== null &&
      tileX === this.dependencies.camera.fpsStepCameraTargetTile.x &&
      tileY === this.dependencies.camera.fpsStepCameraTargetTile.y;
    const isPredictedPlayerTile = this.isFpsPredictedPlayerTile(
      tileX,
      tileY,
      nowMs,
    );
    const isTrailSuppressedTile = this.shouldSuppressRecentPlayerTrailTileInFps(
      tileX,
      tileY,
      nowMs,
    );
    return {
      isCurrentPlayerTile,
      isStepDestinationTile,
      isPredictedPlayerTile,
      isTrailSuppressedTile,
      isPlayerGlyph,
      isPlayerMaterial,
    };
  }

  setFpsPredictedPlayerTileFromMovementVector(
    originX: number,
    originY: number,
    dx: number,
    dy: number,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    if (
      (dx === 0 && dy === 0) ||
      !Number.isFinite(dx) ||
      !Number.isFinite(dy)
    ) {
      return;
    }
    this.fpsPredictedPlayerTile = {
      x: originX + dx,
      y: originY + dy,
      expiresAtMs: Date.now() + this.fpsPredictedPlayerTileWindowMs,
    };
  }

  setFpsPredictedPlayerTileFromMovementInput(input: string): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    const movement = this.dependencies.movementInput.getMovementDeltaFromInput(input);
    if (!movement) {
      return;
    }
    this.setFpsPredictedPlayerTileFromMovementVector(
      this.playerPos.x,
      this.playerPos.y,
      movement.dx,
      movement.dy,
    );
  }

  updateFpsPredictedPlayerTileFromMapCursorHint(
    cursorX: number,
    cursorY: number,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode() || this.dependencies.positionSelection.positionInputModeActive) {
      return;
    }
    if (this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) {
      return;
    }
    if (!this.hasSeenPlayerPosition) {
      return;
    }

    const nowMs = Date.now();
    const runLikeInputActive =
      nowMs - this.dependencies.camera.lastRunLikeInputAtMs <= this.dependencies.camera.fpsStepCameraRunInputWindowMs;
    const autoMoveLikely =
      nowMs - this.dependencies.camera.lastManualDirectionalInputAtMs >
      this.dependencies.camera.fpsAutoMoveDetectionWindowMs;
    if (!this.dependencies.camera.fpsStepCameraActive && !runLikeInputActive && !autoMoveLikely) {
      return;
    }
    const anchorTiles: Array<{ x: number; y: number }> = [
      { ...this.playerPos },
    ];
    if (this.fpsPredictedPlayerTile) {
      anchorTiles.push({
        x: this.fpsPredictedPlayerTile.x,
        y: this.fpsPredictedPlayerTile.y,
      });
    }
    if (this.dependencies.camera.fpsStepCameraTargetTile) {
      anchorTiles.push({ ...this.dependencies.camera.fpsStepCameraTargetTile });
    }
    if (!this.isMapCursorHintNearAnyAnchorTile(cursorX, cursorY, anchorTiles)) {
      return;
    }
    this.fpsPredictedPlayerTile = {
      x: cursorX,
      y: cursorY,
      expiresAtMs: nowMs + this.fpsPredictedPlayerTileWindowMs,
    };
  }

  isMapCursorHintNearAnyAnchorTile(
    cursorX: number,
    cursorY: number,
    anchors: Array<{ x: number; y: number }>,
  ): boolean {
    for (const anchor of anchors) {
      if (!anchor) {
        continue;
      }
      const dx = Math.abs(cursorX - anchor.x);
      const dy = Math.abs(cursorY - anchor.y);
      if (dx <= 1 && dy <= 1) {
        return true;
      }
    }
    return false;
  }

  getActiveAsciiPendingPlayerTile(
    nowMs: number,
  ): { x: number; y: number } | null {
    const pending = this.asciiPendingPlayerTile;
    if (!pending) {
      return null;
    }
    if (nowMs > pending.expiresAtMs) {
      this.asciiPendingPlayerTile = null;
      return null;
    }
    return { x: pending.x, y: pending.y };
  }

  updateAsciiPendingPlayerTileFromMapCursorHint(
    cursorX: number,
    cursorY: number,
  ): void {
    if (this.dependencies.movementInput.isFpsMode() || this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
      return;
    }
    if (this.dependencies.positionSelection.positionInputModeActive) {
      return;
    }
    if (!this.hasSeenPlayerPosition) {
      return;
    }

    this.asciiPendingPlayerTile = {
      x: cursorX,
      y: cursorY,
      expiresAtMs: Date.now() + this.asciiPendingPlayerTileWindowMs,
    };
    this.dependencies.fpsDiagnostics.logAsciiPlayerTileDebug(
      "pending_tile_from_map_cursor",
      cursorX,
      cursorY,
      {
        playerPos: { ...this.playerPos },
        hasSeenPlayerPosition: this.hasSeenPlayerPosition,
        pendingAsciiPlayerTile: this.asciiPendingPlayerTile,
      },
    );
  }

  isFpsPredictedPlayerTile(
    tileX: number,
    tileY: number,
    nowMs: number,
  ): boolean {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return false;
    }
    const predicted = this.fpsPredictedPlayerTile;
    if (!predicted) {
      return false;
    }
    if (nowMs > predicted.expiresAtMs) {
      this.fpsPredictedPlayerTile = null;
      return false;
    }
    return predicted.x === tileX && predicted.y === tileY;
  }

  refreshRecentFpsPlayerTrailTileVisual(
    tileX: number,
    tileY: number,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    const key = `${tileX},${tileY}`;
    const snapshot = this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
    if (snapshot) {
      this.dependencies.tileRendering.updateTile(
        tileX,
        tileY,
        snapshot.glyph,
        snapshot.char ?? undefined,
        typeof snapshot.color === "number" && Number.isFinite(snapshot.color)
          ? Math.trunc(snapshot.color)
          : undefined,
        {
          runtimeTileIndex:
            typeof snapshot.tileIndex === "number" &&
            Number.isFinite(snapshot.tileIndex)
              ? Math.trunc(snapshot.tileIndex)
              : undefined,
        },
      );
      return;
    }
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (!mesh) {
      return;
    }
    const sourceGlyph =
      typeof mesh.userData?.sourceGlyph === "number" &&
      Number.isFinite(mesh.userData.sourceGlyph)
        ? Math.trunc(mesh.userData.sourceGlyph)
        : null;
    if (sourceGlyph === null) {
      return;
    }
    const runtimeTileIndex =
      typeof mesh.userData?.tileIndex === "number" &&
      Number.isFinite(mesh.userData.tileIndex)
        ? Math.trunc(mesh.userData.tileIndex)
        : undefined;
    this.dependencies.tileRendering.updateTile(tileX, tileY, sourceGlyph, undefined, undefined, {
      runtimeTileIndex,
    });
  }

  recordPlayerMovement(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const moved = fromX !== toX || fromY !== toY;

    if (!this.hasSeenPlayerPosition) {
      this.hasSeenPlayerPosition = true;
      this.fpsLastPlayerMoveFromTile = null;
      if (this.dependencies.promptDialogs.pendingStartupInventoryRefresh) {
        this.dependencies.promptDialogs.pendingStartupInventoryRefreshEarliestAtMs = Math.max(
          this.dependencies.promptDialogs.pendingStartupInventoryRefreshEarliestAtMs,
          Date.now() + this.dependencies.promptDialogs.startupInventoryRefreshDelayMs,
        );
      }
      return;
    }

    if (moved) {
      this.dependencies.inputCommands.clearRepeatableAction();
      const stepDurationMs = this.dependencies.camera.reserveSharedStepMotionDurationMs();
      if (this.dependencies.movementInput.isFpsMode()) {
        const nowMs = Date.now();
        const moveDx = Math.sign(toX - fromX);
        const moveDy = Math.sign(toY - fromY);
        this.fpsLastPlayerMoveFromTile = { x: fromX, y: fromY };
        const autoMoveLikely =
          nowMs - this.dependencies.camera.lastManualDirectionalInputAtMs >
          this.dependencies.camera.fpsAutoMoveDetectionWindowMs;
        const runLikeInputActive =
          nowMs - this.dependencies.camera.lastRunLikeInputAtMs <=
          this.dependencies.camera.fpsStepCameraRunInputWindowMs;
        const shouldExtrapolateNextRunTile =
          runLikeInputActive || autoMoveLikely;
        this.dependencies.camera.beginFpsStepCameraTransition(
          fromX,
          fromY,
          toX,
          toY,
          stepDurationMs,
        );
        this.rememberRecentFpsPlayerTileForSuppression(fromX, fromY, nowMs);
        this.refreshRecentFpsPlayerTrailTileVisual(fromX, fromY);
        if (shouldExtrapolateNextRunTile) {
          this.setFpsPredictedPlayerTileFromMovementVector(
            toX,
            toY,
            moveDx,
            moveDy,
          );
        }
        this.dependencies.camera.updateFpsCameraAutoTurnFromMovement(
          moveDx,
          moveDy,
          autoMoveLikely,
        );
      } else {
        const startedProvisionalSwapTransition =
          this.dependencies.entityMovement.tryStartProvisionalPlayerSwapTransitions(
            fromX,
            fromY,
            toX,
            toY,
            stepDurationMs,
          );
        const usingTrackedPlayerMoveTransition =
          this.dependencies.runtimeEntityTracking.hasRuntimeTrackedPlayerEntitySupport() &&
          this.dependencies.entityMovement.activeEntityMoveTransitions.has("player");
        this.dependencies.camera.normalModePlayerMoveCameraFollowActive = true;
        if (
          !usingTrackedPlayerMoveTransition &&
          !startedProvisionalSwapTransition
        ) {
          this.dependencies.entityMovement.startPlayerMoveTransition(
            fromX,
            fromY,
            toX,
            toY,
            stepDurationMs,
          );
        }
        this.fpsLastPlayerMoveFromTile = null;
        this.dependencies.camera.recenterCameraOnPlayerIfNeeded();
      }
    }

    const hasRecentMovementInput =
      Date.now() - this.dependencies.movementInput.lastMovementInputAtMs <= this.movementUnlockWindowMs;

    if (!this.hasPlayerMovedOnce && moved && hasRecentMovementInput) {
      this.hasPlayerMovedOnce = true;
    }
  }
}
