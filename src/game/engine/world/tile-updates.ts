import type { TileBehaviorResult } from "../../glyphs";
import type { Camera } from "../camera/camera";
import type { DarkCorridorInference } from "./dark-corridor-inference";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { EntityMovement } from "./entity-movement";
import type { FpsDiagnostics } from "../diagnostics/fps-diagnostics";
import type { LevelTerrainCache } from "./level-terrain-cache";
import type { Minimap } from "../ui/minimap";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "./player-movement";
import type { PlayerStatus } from "../ui/player-status";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { RuntimeEntityTracking } from "./runtime-entity-tracking";
import type { TileRendering } from "../rendering/tile-rendering";
import type { VultureWalls } from "../rendering/vulture-walls";
import type { WorldClassification } from "./world-classification";

export interface TileUpdatesDependencies {
  readonly camera: Pick<
    Camera,
    "fpsStepCameraActive"
  >;
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "recordNewlyDiscoveredDarkCorridorTileForCurrentInput"
    | "requestInferredDarkCorridorWallReconcile"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "playMode"
    | "session"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "monsterBillboards"
    | "removeMonsterBillboard"
  >;
  readonly entityMovement: Pick<
    EntityMovement,
    "activeEntityMoveTransitions"
    | "deferredEntityVisualUpdatesByKey"
    | "isEntityVisualUpdateDeferred"
  >;
  readonly fpsDiagnostics: Pick<
    FpsDiagnostics,
    "logAsciiPlayerTileDebug"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "getTileSnapshotFromStateCache"
    | "lastKnownTerrain"
    | "parseTileStateSignature"
  >;
  readonly minimap: Pick<
    Minimap,
    "flushPendingMinimapTileUpdates"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "getDirectionVectorFromInput"
    | "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "getActiveAsciiPendingPlayerTile"
    | "getFpsPlayerTileRelationFlags"
    | "hasSeenPlayerPosition"
    | "playerPos"
  >;
  readonly playerStatus: Pick<
    PlayerStatus,
    "latestRuntimeGlobalsSnapshot"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "isFpsFarLookViewActive"
    | "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "infoMenuBlockingActive"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "finalizePendingRuntimeMonsterVacatedTracking"
    | "isRuntimeTrackedPlayerEntityId"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "updateTile"
  >;
  readonly vultureWalls: Pick<
    VultureWalls,
    "collectPendingVultureRoomDecorReconcileKeys"
    | "flushPendingVultureRoomDecorReconcile"
    | "flushPendingVultureWallMaterialRefreshes"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "classifyTilePayload"
    | "getFpsPlayerTileBillboardBehaviorFromCache"
    | "getPlayerTileUnderlaySnapshotFromCache"
    | "isAltarOrTombstoneLikeBehavior"
    | "isLootLikeBehavior"
    | "isMonsterLikeBehavior"
    | "seedFlatFeatureUnderPlayerCacheFromPreviousState"
    | "seedTerrainCacheFromSupersededPendingUpdate"
    | "shouldShowUnderPlayerFeaturesInOverheadTilesMode"
    | "shouldUseRaisedSpecialTileBillboardInTiles"
  >;
}

/** Runtime map update batching, deduplication, player tile refresh scheduling and retry ownership. */
export class TileUpdates {
  constructor(private readonly dependencies: TileUpdatesDependencies) {}

  pendingTileFlushQueue: any[] = [];

  pendingTileFlushQueueIndex: number = 0;

  tileRefreshRetryPlansByKey: Map<string, { timerIds: number[] }> =
    new Map();

  readonly tileFlushFrameBudgetMs: number = 5;

  readonly tileFlushMaxPerFrame: number = 72;

  tileStateCache: Map<string, string> = new Map();

  pendingTileUpdates: Map<string, any> = new Map();

  tileFlushScheduled: boolean = false;

  private corridorReconcileAfterTiles = false;

  pendingPlayerTileRefreshOnNextPosition: boolean = true;

  readonly tileRefreshRetryDelayMs: number = 120;

  readonly fpsCacheAssumptionRefreshCooldownMs: number = 280;

  fpsCacheAssumptionRefreshLastRequestedAtByKey: Map<string, number> =
    new Map();

  deferredPlayerTileRefreshReason: string | null = null;

  buildTileStateSignatureFromPayload(tile: {
    glyph: number;
    char?: string;
    color?: number;
    monsterId?: number;
    tileIndex?: number;
    symidx?: number;
    glyphFlags?: number | null;
    floorUnderlayGlyph?: number;
    floorUnderlayChar?: string;
    floorUnderlayColor?: number;
    floorUnderlayTileIndex?: number;
    floorUnderlaySymidx?: number;
  }): string {
    const encodedGlyphChar = encodeURIComponent(tile.char ?? "");
    const encodedFloorUnderlayChar = encodeURIComponent(
      tile.floorUnderlayChar ?? "",
    );
    const tileIndexPart =
      typeof tile.tileIndex === "number" ? Math.trunc(tile.tileIndex) : "";
    const symidxPart =
      typeof tile.symidx === "number" ? Math.trunc(tile.symidx) : "";
    const glyphFlagsPart =
      typeof tile.glyphFlags === "number" && Number.isFinite(tile.glyphFlags)
        ? Math.trunc(tile.glyphFlags)
        : "";
    const monsterIdPart =
      typeof tile.monsterId === "number" && Number.isFinite(tile.monsterId)
        ? Math.trunc(tile.monsterId)
        : "";
    const floorGlyphPart =
      typeof tile.floorUnderlayGlyph === "number"
        ? Math.trunc(tile.floorUnderlayGlyph)
        : "";
    const floorTileIndexPart =
      typeof tile.floorUnderlayTileIndex === "number"
        ? Math.trunc(tile.floorUnderlayTileIndex)
        : "";
    const floorColorPart =
      typeof tile.floorUnderlayColor === "number"
        ? Math.trunc(tile.floorUnderlayColor)
        : "";
    const floorSymidxPart =
      typeof tile.floorUnderlaySymidx === "number"
        ? Math.trunc(tile.floorUnderlaySymidx)
        : "";
    return `${tile.glyph}|${encodedGlyphChar}|${tile.color ?? ""}|mid:${monsterIdPart}|ti:${tileIndexPart}|si:${symidxPart}|gf:${glyphFlagsPart}|fg:${floorGlyphPart}|fc:${encodedFloorUnderlayChar}|fco:${floorColorPart}|fti:${floorTileIndexPart}|fsi:${floorSymidxPart}`;
  }

  refreshTilesFromStateCache(): void {
    const snapshots: Array<{
      x: number;
      y: number;
      glyph: number;
      char?: string;
      color?: number;
      tileIndex?: number;
      glyphFlags?: number;
    }> = [];
    for (const [key, signature] of this.tileStateCache.entries()) {
      const [rawX, rawY] = key.split(",");
      const x = Number.parseInt(rawX, 10);
      const y = Number.parseInt(rawY, 10);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      const parsed = this.dependencies.levelTerrainCache.parseTileStateSignature(signature);
      if (!parsed) {
        continue;
      }
      snapshots.push({
        x,
        y,
        glyph: parsed.glyph,
        char: parsed.char,
        color: parsed.color,
        tileIndex: parsed.tileIndex,
        glyphFlags: parsed.glyphFlags,
      });
    }

    for (const snapshot of snapshots) {
      this.dependencies.tileRendering.updateTile(
        snapshot.x,
        snapshot.y,
        snapshot.glyph,
        snapshot.char,
        snapshot.color,
        {
          runtimeTileIndex:
            typeof snapshot.tileIndex === "number"
              ? snapshot.tileIndex
              : undefined,
          runtimeGlyphFlags:
            typeof snapshot.glyphFlags === "number"
              ? snapshot.glyphFlags
              : undefined,
        },
      );
    }
    this.dependencies.vultureWalls.collectPendingVultureRoomDecorReconcileKeys(false);
    this.dependencies.vultureWalls.flushPendingVultureRoomDecorReconcile(true);
    this.dependencies.darkCorridorInference.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
  }

  enqueueTileUpdate(tile: any): void {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }

    const key = `${tile.x},${tile.y}`;
    const pendingTile = this.pendingTileUpdates.get(key);
    if (pendingTile) {
      this.dependencies.worldClassification.seedTerrainCacheFromSupersededPendingUpdate(key, pendingTile, tile);
    }
    this.pendingTileUpdates.set(key, tile);
    this.corridorReconcileAfterTiles = true;

    if (this.tileFlushScheduled) {
      return;
    }

    this.tileFlushScheduled = true;
    requestAnimationFrame(() => this.flushPendingTileUpdates(false));
  }

  processPendingTileUpdate(tile: any): void {
    const key = `${tile.x},${tile.y}`;
    this.dependencies.darkCorridorInference.recordNewlyDiscoveredDarkCorridorTileForCurrentInput(tile);
    const behavior = this.dependencies.worldClassification.classifyTilePayload(tile);
    const nowMs = Date.now();
    const isRuntimeTrackedPlayerTile = this.dependencies.runtimeEntityTracking.isRuntimeTrackedPlayerEntityId(
      tile.monsterId,
    );
    const isRuntimeTrackedPlayerTileInFps =
      this.dependencies.movementInput.isFpsMode() && isRuntimeTrackedPlayerTile;
    const tileRelation = this.dependencies.playerMovement.getFpsPlayerTileRelationFlags(
      tile.x,
      tile.y,
      nowMs,
      behavior,
    );
    const isLikelyPlayerGlyphTile =
      typeof tile?.char === "string"
        ? tile.char.trim() === "@"
        : behavior?.glyphChar === "@";
    const isOverheadPlayerTileNeedingUnderlaySeed =
      this.dependencies.worldClassification.shouldShowUnderPlayerFeaturesInOverheadTilesMode() &&
      behavior !== null &&
      (isRuntimeTrackedPlayerTile ||
        isLikelyPlayerGlyphTile ||
        (this.dependencies.playerMovement.hasSeenPlayerPosition &&
          tile.x === this.dependencies.playerMovement.playerPos.x &&
          tile.y === this.dependencies.playerMovement.playerPos.y));
    const isFpsPlayerTileNeedingUnderlaySeed =
      this.dependencies.movementInput.isFpsMode() &&
      behavior !== null &&
      (isRuntimeTrackedPlayerTileInFps ||
        tileRelation.isCurrentPlayerTile ||
        tileRelation.isStepDestinationTile ||
        tileRelation.isPredictedPlayerTile ||
        isLikelyPlayerGlyphTile);
    if (
      isFpsPlayerTileNeedingUnderlaySeed ||
      isOverheadPlayerTileNeedingUnderlaySeed
    ) {
      this.dependencies.worldClassification.seedFlatFeatureUnderPlayerCacheFromPreviousState(key);
    }
    const shouldSuppressRecentPreviousPlayerTileInFps =
      tileRelation.isTrailSuppressedTile &&
      (tileRelation.isPlayerGlyph ||
        tileRelation.isPlayerMaterial ||
        isRuntimeTrackedPlayerTileInFps);
    const shouldKeepVisiblePlayerBillboardInFarLook =
      this.shouldKeepFarLookPlayerBillboardVisible() &&
      tileRelation.isCurrentPlayerTile &&
      this.hasExplicitPlayerVisual(
        behavior,
        typeof tile?.char === "string" ? tile.char : null,
      );
    const fpsPlayerTileBillboardBehavior = tileRelation.isCurrentPlayerTile
      ? this.dependencies.worldClassification.getFpsPlayerTileBillboardBehaviorFromCache(key, behavior)
      : null;
    if (
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.camera.fpsStepCameraActive &&
      behavior &&
      !behavior.isPlayerGlyph &&
      (this.dependencies.worldClassification.isMonsterLikeBehavior(behavior) ||
        this.dependencies.worldClassification.isLootLikeBehavior(behavior))
    ) {
      this.pendingTileUpdates.set(key, tile);
      return;
    }

    const signature = this.buildTileStateSignatureFromPayload(tile);
    const deferredVisualUpdate =
      this.dependencies.entityMovement.deferredEntityVisualUpdatesByKey.get(key) ?? null;
    if (deferredVisualUpdate) {
      this.tileStateCache.set(key, signature);
      deferredVisualUpdate.tile = tile;
      return;
    }
    if (this.tileStateCache.get(key) === signature) {
      const shouldHaveElevatedBillboard =
        (behavior !== null &&
          !isRuntimeTrackedPlayerTileInFps &&
          !tileRelation.isPlayerGlyph &&
          !tileRelation.isPlayerMaterial &&
          !tileRelation.isStepDestinationTile &&
          !tileRelation.isPredictedPlayerTile &&
          !shouldSuppressRecentPreviousPlayerTileInFps &&
          (this.dependencies.worldClassification.isMonsterLikeBehavior(behavior) ||
            this.dependencies.worldClassification.isLootLikeBehavior(behavior) ||
            ((this.dependencies.engineState.clientOptions.tilesetMode === "tiles" || this.dependencies.movementInput.isFpsMode()) &&
              this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(behavior)) ||
            (this.dependencies.movementInput.isFpsMode() &&
              this.dependencies.worldClassification.isAltarOrTombstoneLikeBehavior(behavior))) &&
          (this.dependencies.engineState.clientOptions.tilesetMode === "tiles" || this.dependencies.movementInput.isFpsMode()) &&
          !tileRelation.isCurrentPlayerTile) ||
        fpsPlayerTileBillboardBehavior !== null ||
        shouldKeepVisiblePlayerBillboardInFarLook;
      if (shouldHaveElevatedBillboard && !this.dependencies.entityBillboards.monsterBillboards.has(key)) {
        this.dependencies.tileRendering.updateTile(tile.x, tile.y, tile.glyph, tile.char, tile.color, {
          runtimeTrackedEntityId:
            typeof tile.monsterId === "number" ? tile.monsterId : undefined,
          runtimeTileIndex:
            typeof tile.tileIndex === "number" ? tile.tileIndex : undefined,
          runtimeSymidx:
            typeof tile.symidx === "number" ? tile.symidx : undefined,
          runtimeGlyphFlags:
            typeof tile.glyphFlags === "number" ? tile.glyphFlags : undefined,
          runtimeFloorUnderlayGlyph:
            typeof tile.floorUnderlayGlyph === "number"
              ? tile.floorUnderlayGlyph
              : undefined,
          runtimeFloorUnderlayChar:
            typeof tile.floorUnderlayChar === "string"
              ? tile.floorUnderlayChar
              : undefined,
          runtimeFloorUnderlayColor:
            typeof tile.floorUnderlayColor === "number"
              ? tile.floorUnderlayColor
              : undefined,
          runtimeFloorUnderlayTileIndex:
            typeof tile.floorUnderlayTileIndex === "number"
              ? tile.floorUnderlayTileIndex
              : undefined,
          runtimeFloorUnderlaySymidx:
            typeof tile.floorUnderlaySymidx === "number"
              ? tile.floorUnderlaySymidx
              : undefined,
        });
      } else if (
        !shouldHaveElevatedBillboard &&
        this.dependencies.entityBillboards.monsterBillboards.has(key)
      ) {
        this.dependencies.entityBillboards.removeMonsterBillboard(key);
      }
      return;
    }

    this.tileStateCache.set(key, signature);
    this.dependencies.tileRendering.updateTile(tile.x, tile.y, tile.glyph, tile.char, tile.color, {
      runtimeTrackedEntityId:
        typeof tile.monsterId === "number" ? tile.monsterId : undefined,
      runtimeTileIndex:
        typeof tile.tileIndex === "number" ? tile.tileIndex : undefined,
      runtimeSymidx: typeof tile.symidx === "number" ? tile.symidx : undefined,
      runtimeGlyphFlags:
        typeof tile.glyphFlags === "number" ? tile.glyphFlags : undefined,
      runtimeFloorUnderlayGlyph:
        typeof tile.floorUnderlayGlyph === "number"
          ? tile.floorUnderlayGlyph
          : undefined,
      runtimeFloorUnderlayChar:
        typeof tile.floorUnderlayChar === "string"
          ? tile.floorUnderlayChar
          : undefined,
      runtimeFloorUnderlayColor:
        typeof tile.floorUnderlayColor === "number"
          ? tile.floorUnderlayColor
          : undefined,
      runtimeFloorUnderlayTileIndex:
        typeof tile.floorUnderlayTileIndex === "number"
          ? tile.floorUnderlayTileIndex
          : undefined,
      runtimeFloorUnderlaySymidx:
        typeof tile.floorUnderlaySymidx === "number"
          ? tile.floorUnderlaySymidx
          : undefined,
    });
  }

  flushPendingTileUpdates(forceFullBatch: boolean = false): void {
    this.tileFlushScheduled = false;

    if (forceFullBatch && this.pendingTileFlushQueueIndex < this.pendingTileFlushQueue.length && this.pendingTileUpdates.size) {
      // A player-position fence must include arrivals queued behind a partially
      // processed batch, with newer payloads replacing older ones for a tile.
      const merged = new Map(this.pendingTileFlushQueue.slice(this.pendingTileFlushQueueIndex).map(tile => [`${tile.x},${tile.y}`, tile]));
      for (const [key, tile] of this.pendingTileUpdates) {
        const previous = merged.get(key);
        if (previous) this.dependencies.worldClassification.seedTerrainCacheFromSupersededPendingUpdate(key, previous, tile);
        merged.set(key, tile);
      }
      this.pendingTileFlushQueue = [...merged.values()]; this.pendingTileFlushQueueIndex = 0;
      this.pendingTileUpdates.clear();
    }
    if (
      this.pendingTileFlushQueueIndex >= this.pendingTileFlushQueue.length &&
      this.pendingTileUpdates.size > 0
    ) {
      this.pendingTileFlushQueue = Array.from(this.pendingTileUpdates.values());
      this.pendingTileFlushQueueIndex = 0;
      this.pendingTileUpdates.clear();
    }

    if (this.pendingTileFlushQueueIndex >= this.pendingTileFlushQueue.length) {
      this.pendingTileFlushQueue = [];
      this.pendingTileFlushQueueIndex = 0;
      return;
    }

    const frameStartMs = performance.now();
    let processedCount = 0;
    while (
      this.pendingTileFlushQueueIndex < this.pendingTileFlushQueue.length
    ) {
      if (!forceFullBatch) {
        if (processedCount >= this.tileFlushMaxPerFrame) {
          break;
        }
        if (
          processedCount > 0 &&
          performance.now() - frameStartMs >= this.tileFlushFrameBudgetMs
        ) {
          break;
        }
      }
      const tile = this.pendingTileFlushQueue[this.pendingTileFlushQueueIndex];
      this.pendingTileFlushQueueIndex += 1;
      this.processPendingTileUpdate(tile);
      processedCount += 1;
    }

    if (this.pendingTileFlushQueueIndex >= this.pendingTileFlushQueue.length) {
      this.pendingTileFlushQueue = [];
      this.pendingTileFlushQueueIndex = 0;
      this.dependencies.runtimeEntityTracking.finalizePendingRuntimeMonsterVacatedTracking();
    }
    // Late tile arrivals are reconciled at the settled frame boundary below,
    // never halfway through a batch or during a player movement transition.
    // Flush minimap cells once per tile batch to keep runtime bursts lightweight.
    this.dependencies.minimap.flushPendingMinimapTileUpdates();
    this.dependencies.vultureWalls.flushPendingVultureWallMaterialRefreshes();
    this.dependencies.vultureWalls.collectPendingVultureRoomDecorReconcileKeys(false);
    this.dependencies.vultureWalls.flushPendingVultureRoomDecorReconcile();

    if (
      (this.pendingTileFlushQueueIndex < this.pendingTileFlushQueue.length ||
        this.pendingTileUpdates.size > 0) &&
      !this.tileFlushScheduled
    ) {
      this.tileFlushScheduled = true;
      requestAnimationFrame(() => this.flushPendingTileUpdates(false));
    }
  }

  refreshTileVisualFromStateCache(tileX: number, tileY: number): void {
    const key = `${tileX},${tileY}`;
    if (this.dependencies.entityMovement.isEntityVisualUpdateDeferred(key)) {
      return;
    }
    const snapshot = this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
    if (!snapshot) {
      if (
        !this.dependencies.movementInput.isFpsMode() &&
        this.dependencies.engineState.clientOptions.tilesetMode !== "tiles" &&
        this.dependencies.playerMovement.hasSeenPlayerPosition &&
        tileX === this.dependencies.playerMovement.playerPos.x &&
        tileY === this.dependencies.playerMovement.playerPos.y
      ) {
        this.dependencies.fpsDiagnostics.logAsciiPlayerTileDebug(
          "refresh_from_cache_missing_snapshot",
          tileX,
          tileY,
          {
            hasSeenPlayerPosition: this.dependencies.playerMovement.hasSeenPlayerPosition,
            tileStateCacheHasKey: this.tileStateCache.has(key),
          },
        );
      }
      return;
    }
    if (
      !this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.engineState.clientOptions.tilesetMode !== "tiles" &&
      this.dependencies.playerMovement.hasSeenPlayerPosition &&
      tileX === this.dependencies.playerMovement.playerPos.x &&
      tileY === this.dependencies.playerMovement.playerPos.y
    ) {
      this.dependencies.fpsDiagnostics.logAsciiPlayerTileDebug(
        "refresh_from_cache_update_tile",
        tileX,
        tileY,
        {
          glyph: snapshot.glyph,
          char: snapshot.char ?? null,
          color: typeof snapshot.color === "number" ? snapshot.color : null,
          tileIndex:
            typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
        },
      );
    }
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
  }

  refreshCurrentPlayerTileVisualFromStateCache(): void {
    if (!this.dependencies.playerMovement.hasSeenPlayerPosition) {
      return;
    }
    this.refreshTileVisualFromStateCache(this.dependencies.playerMovement.playerPos.x, this.dependencies.playerMovement.playerPos.y);
  }

  refreshVacatedPlayerTileVisualDuringTransition(
    tileX: number,
    tileY: number,
  ): void {
    const key = `${tileX},${tileY}`;
    const snapshot =
      this.dependencies.worldClassification.getPlayerTileUnderlaySnapshotFromCache(key) ??
      this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ??
      null;
    if (!snapshot) {
      return;
    }
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
        runtimeSymidx:
          typeof snapshot.symidx === "number" &&
          Number.isFinite(snapshot.symidx)
            ? Math.trunc(snapshot.symidx)
            : undefined,
      },
    );
  }

  hasExplicitPlayerVisual(
    behavior: TileBehaviorResult | null,
    runtimeChar?: string | null,
  ): boolean {
    if (!behavior) {
      return false;
    }
    if (behavior.materialKind === "player") {
      return true;
    }
    const chars = [
      runtimeChar,
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    return chars.some(
      (value) => typeof value === "string" && value.trim() === "@",
    );
  }

  shouldKeepFarLookPlayerBillboardVisible(): boolean {
    return this.dependencies.movementInput.isFpsMode() && this.dependencies.positionSelection.isFpsFarLookViewActive();
  }

  refreshAsciiPlayerTilesAfterPositionUpdate(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    if (this.dependencies.movementInput.isFpsMode() || this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
      return;
    }
    this.dependencies.fpsDiagnostics.logAsciiPlayerTileDebug("refresh_after_player_position", toX, toY, {
      from: { x: fromX, y: fromY },
      to: { x: toX, y: toY },
      hasSeenPlayerPosition: this.dependencies.playerMovement.hasSeenPlayerPosition,
      playerPos: { ...this.dependencies.playerMovement.playerPos },
      playMode: this.dependencies.engineState.playMode,
      tilesetMode: this.dependencies.engineState.clientOptions.tilesetMode,
    });
    this.refreshTileVisualFromStateCache(fromX, fromY);
    this.refreshTileVisualFromStateCache(toX, toY);
  }

  refreshTilesAfterPlayerPositionUpdate(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    if (fromX === toX && fromY === toY) {
      return;
    }
    if (this.dependencies.movementInput.isFpsMode() || this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
      if (this.dependencies.entityMovement.activeEntityMoveTransitions.has("player")) {
        this.refreshVacatedPlayerTileVisualDuringTransition(fromX, fromY);
      } else {
        this.refreshTileVisualFromStateCache(fromX, fromY);
      }
      this.refreshTileVisualFromStateCache(toX, toY);
      return;
    }
    this.refreshAsciiPlayerTilesAfterPositionUpdate(fromX, fromY, toX, toY);
  }

  refreshAsciiPlayerTilesForCursorHint(
    cursorX: number,
    cursorY: number,
    previousPendingTile?: { x: number; y: number } | null,
  ): void {
    if (this.dependencies.movementInput.isFpsMode() || this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
      return;
    }
    if (this.dependencies.positionSelection.positionInputModeActive || !this.dependencies.playerMovement.hasSeenPlayerPosition) {
      return;
    }

    const pendingTile = this.dependencies.playerMovement.getActiveAsciiPendingPlayerTile(Date.now()) ?? {
      x: cursorX,
      y: cursorY,
    };
    const tilesToRefresh = new Set<string>();
    const enqueueTile = (tileX: number, tileY: number): void => {
      tilesToRefresh.add(`${tileX},${tileY}`);
    };

    enqueueTile(this.dependencies.playerMovement.playerPos.x, this.dependencies.playerMovement.playerPos.y);
    enqueueTile(pendingTile.x, pendingTile.y);
    if (previousPendingTile) {
      enqueueTile(previousPendingTile.x, previousPendingTile.y);
    }

    this.dependencies.fpsDiagnostics.logAsciiPlayerTileDebug(
      "refresh_after_cursor_hint",
      pendingTile.x,
      pendingTile.y,
      {
        cursor: { x: cursorX, y: cursorY },
        pendingTile,
        previousPendingTile: previousPendingTile ?? null,
        playerPos: { ...this.dependencies.playerMovement.playerPos },
        hasSeenPlayerPosition: this.dependencies.playerMovement.hasSeenPlayerPosition,
      },
    );

    for (const tileKey of tilesToRefresh) {
      const [tileXRaw, tileYRaw] = tileKey.split(",");
      const tileX = Number(tileXRaw);
      const tileY = Number(tileYRaw);
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        continue;
      }
      this.refreshTileVisualFromStateCache(tileX, tileY);
    }
  }

  flushSettledDarkCorridorInference(): void {
    if (!this.corridorReconcileAfterTiles || this.pendingTileUpdates.size ||
        this.pendingTileFlushQueueIndex < this.pendingTileFlushQueue.length ||
        this.dependencies.camera.fpsStepCameraActive ||
        this.dependencies.entityMovement.activeEntityMoveTransitions.has("player")) return;
    this.corridorReconcileAfterTiles = false;
    this.dependencies.darkCorridorInference.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
  }

  flushPendingTileUpdatesForPlayerPositionReconcile(): void {
    if (
      !this.pendingTileUpdates.size &&
      this.pendingTileFlushQueueIndex >= this.pendingTileFlushQueue.length
    ) {
      return;
    }
    // Drain queued map updates before dark-corridor wall inference runs for
    // this movement step, preventing temporary front-wall flashes.
    this.flushPendingTileUpdates(true);
  }


  /**
   * Request a view update for a specific tile from the local runtime
   * @param x The x coordinate of the tile
   * @param y The y coordinate of the tile
   */
  requestTileUpdate(
    x: number,
    y: number,
    options: { forceRuntime?: boolean } = {},
  ): void {
    if (!options.forceRuntime) {
      // Temporarily disable explicit per-tile refresh requests across all
      // runtimes so we can verify whether newer state-sync logic still needs
      // them. Keep the public entry point intact for easy re-enable if needed.
      void x;
      void y;
      return;
    }
    if (!this.dependencies.engineState.session) {
      console.log("Cannot request tile update - runtime not started");
      return;
    }
    console.log(`Requesting tile update at (${x}, ${y})`);
    this.dependencies.engineState.session.requestTileUpdate(x, y);
  }

  requestAreaUpdate(
    centerX: number,
    centerY: number,
    radius: number = 3,
  ): void {
    if (this.dependencies.engineState.session) {
      console.log(
        `Requesting area update centered at (${centerX}, ${centerY}) with radius ${radius}`,
      );
      this.dependencies.engineState.session.requestAreaUpdate(centerX, centerY, radius);
    } else {
      console.log("Cannot request area update - runtime not started");
    }
  }

  requestPlayerAreaUpdate(radius: number = 5): void {
    this.requestAreaUpdate(this.dependencies.playerMovement.playerPos.x, this.dependencies.playerMovement.playerPos.y, radius);
  }

  requestRuntimeGlobalsSnapshot(): void {
    if (!this.dependencies.engineState.session) {
      console.log(
        "Cannot request runtime globals snapshot - runtime not started",
      );
      return;
    }
    this.dependencies.engineState.session.requestRuntimeGlobalsSnapshot();
  }

  getLatestRuntimeGlobalsSnapshot(): unknown {
    return this.dependencies.playerStatus.latestRuntimeGlobalsSnapshot;
  }

  clearTileRefreshRetryPlan(key: string): void {
    const plan = this.tileRefreshRetryPlansByKey.get(key);
    if (!plan) {
      return;
    }
    if (typeof window !== "undefined") {
      for (const timerId of plan.timerIds) {
        window.clearTimeout(timerId);
      }
    }
    this.tileRefreshRetryPlansByKey.delete(key);
  }

  clearAllTileRefreshRetryPlans(): void {
    for (const key of Array.from(this.tileRefreshRetryPlansByKey.keys())) {
      this.clearTileRefreshRetryPlan(key);
    }
  }

  requestTileUpdateWithRetry(
    x: number,
    y: number,
    options: { forceRuntime?: boolean } = {},
  ): void {
    this.requestTileUpdate(x, y, options);
    if (typeof window === "undefined") {
      return;
    }

    const key = `${Math.trunc(x)},${Math.trunc(y)}`;
    this.clearTileRefreshRetryPlan(key);

    const plan = { timerIds: [] as number[] };
    this.tileRefreshRetryPlansByKey.set(key, plan);
    const scheduleRetry = (delayMs: number): void => {
      const timerId = window.setTimeout(() => {
        const activePlan = this.tileRefreshRetryPlansByKey.get(key);
        if (activePlan !== plan) {
          return;
        }
        activePlan.timerIds = activePlan.timerIds.filter(
          (id) => id !== timerId,
        );
        this.requestTileUpdate(x, y, options);
        if (activePlan.timerIds.length <= 0) {
          this.tileRefreshRetryPlansByKey.delete(key);
        }
      }, delayMs);
      plan.timerIds.push(timerId);
    };

    scheduleRetry(this.tileRefreshRetryDelayMs);
    scheduleRetry(this.tileRefreshRetryDelayMs * 2);
  }

  requestPlayerTileRefresh(
    reason: string,
    options: { forceRuntime?: boolean } = {},
  ): void {
    if (!this.dependencies.engineState.session) {
      return;
    }
    if (this.dependencies.promptDialogs.infoMenuBlockingActive) {
      this.deferredPlayerTileRefreshReason = reason || "deferred";
      console.log(
        `Deferring player tile refresh (${reason}) until blocking info menu closes`,
      );
      return;
    }
    console.log(
      `Requesting player tile refresh (${reason}) at (${this.dependencies.playerMovement.playerPos.x}, ${this.dependencies.playerMovement.playerPos.y})`,
    );
    this.requestTileUpdateWithRetry(
      this.dependencies.playerMovement.playerPos.x,
      this.dependencies.playerMovement.playerPos.y,
      options,
    );
  }

  flushDeferredPlayerTileRefreshIfNeeded(trigger: string): void {
    if (!this.deferredPlayerTileRefreshReason) {
      return;
    }
    const deferredReason = this.deferredPlayerTileRefreshReason;
    this.deferredPlayerTileRefreshReason = null;
    this.requestPlayerTileRefresh(`${deferredReason}-${trigger}`);
  }

  getPlayerTileRefreshReasonForItemCommandInput(
    input: string,
  ): string | null {
    switch (input) {
      case ",":
        return "pickup-input";
      case "d":
        return "drop-input";
      case "e":
        return "eat-input";
      default:
        return null;
    }
  }

  getQuestionSelectionTileRefreshAction(
    questionText: string,
  ): "pickup" | "drop" | "eat" | null {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return null;
    }
    if (
      normalized.includes("pick up what") ||
      normalized.includes("what do you want to pick up") ||
      normalized.includes("what would you like to pick up")
    ) {
      return "pickup";
    }
    if (
      normalized.includes("drop what") ||
      normalized.includes("what do you want to drop") ||
      normalized.includes("what would you like to drop")
    ) {
      return "drop";
    }
    if (
      normalized.includes("eat what") ||
      normalized.includes("what do you want to eat") ||
      normalized.includes("what would you like to eat")
    ) {
      return "eat";
    }
    return null;
  }

  maybeRequestRuntimeTileRefreshForFpsCacheAssumption(
    tileKey: string,
    reason: string,
  ): void {
    if (!this.dependencies.engineState.session || !this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    const normalizedKey = String(tileKey || "");
    const commaIndex = normalizedKey.indexOf(",");
    if (commaIndex <= 0 || commaIndex >= normalizedKey.length - 1) {
      return;
    }
    const rawX = Number(normalizedKey.slice(0, commaIndex));
    const rawY = Number(normalizedKey.slice(commaIndex + 1));
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
      return;
    }
    const tileX = Math.trunc(rawX);
    const tileY = Math.trunc(rawY);
    const key = `${tileX},${tileY}`;
    const nowMs = Date.now();
    const lastRequestedAtMs =
      this.fpsCacheAssumptionRefreshLastRequestedAtByKey.get(key) ?? 0;
    if (nowMs - lastRequestedAtMs < this.fpsCacheAssumptionRefreshCooldownMs) {
      return;
    }
    this.fpsCacheAssumptionRefreshLastRequestedAtByKey.set(key, nowMs);
    if (this.fpsCacheAssumptionRefreshLastRequestedAtByKey.size > 192) {
      const cutoffMs = nowMs - this.fpsCacheAssumptionRefreshCooldownMs * 8;
      for (const [staleKey, staleAtMs] of this
        .fpsCacheAssumptionRefreshLastRequestedAtByKey) {
        if (staleAtMs < cutoffMs) {
          this.fpsCacheAssumptionRefreshLastRequestedAtByKey.delete(staleKey);
        }
      }
    }

    if (tileX === this.dependencies.playerMovement.playerPos.x && tileY === this.dependencies.playerMovement.playerPos.y) {
      this.requestPlayerTileRefresh(`fps-cache-assumption-${reason}`);
      return;
    }

    console.log(
      `Requesting tile update to replace FPS cache assumption (${reason}) at (${tileX}, ${tileY})`,
    );
    this.requestTileUpdate(tileX, tileY);
  }

  requestDirectionalAnswerTileRefresh(directionInput: string): void {
    if (!this.dependencies.engineState.session) {
      return;
    }
    const originX = this.dependencies.playerMovement.playerPos.x;
    const originY = this.dependencies.playerMovement.playerPos.y;
    this.requestTileUpdateWithRetry(originX, originY);

    const direction = this.dependencies.movementInput.getDirectionVectorFromInput(directionInput);
    if (!direction) {
      return;
    }
    this.requestTileUpdateWithRetry(
      originX + direction.dx,
      originY + direction.dy,
    );
  }
}
