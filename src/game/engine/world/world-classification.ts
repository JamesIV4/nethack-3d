import type { NethackRuntimeVersion } from "../../../runtime/types";
import {
  classifyTileBehavior,
  getDefaultDarkFloorGlyph,
  getDefaultDarkWallGlyph,
  getDefaultFloorGlyph,
  getOpenDoorGlyphFrom,
  isDoorwayCmapGlyph,
  isIronBarsCmapGlyph,
  isSinkCmapGlyph
} from "../../glyphs/behavior";
import { getGlyphCatalogEntry, getGlyphCatalogRanges } from "../../glyphs/registry";
import type { GlyphKind, TileBehaviorResult, TileMaterialKind } from "../../glyphs";
import type { TerrainSnapshot } from "../../types";
import type { DarkCorridorInference } from "./dark-corridor-inference";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { LevelTerrainCache } from "./level-terrain-cache";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "./player-movement";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "./tile-updates";

export interface WorldClassificationDependencies {
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "getKnownTerrainSnapshotForInferenceAtKey"
  >;
  readonly engineState: Pick<
    EngineState,
    "characterCreationConfig"
    | "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "monsterBillboards"
    | "shouldUseStandingBillboardOverlayMode"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "getTileSnapshotFromStateCache"
    | "lastKnownTerrain"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "hasSeenPlayerPosition"
    | "playerPos"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "loadedTilesetTileLayoutVersion"
    | "resolveRuntimeVersion"
    | "resolveTilesetBackgroundReferenceTileIndex"
    | "shouldUseVultureTiles"
    | "tilesetBackgroundReferenceTileCanvas"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "maybeRequestRuntimeTileRefreshForFpsCacheAssumption"
    | "refreshTileVisualFromStateCache"
    | "requestPlayerTileRefresh"
  >;
}

/** Runtime glyph classification, persistent terrain snapshots and authoritative under-player item refresh. */
export class WorldClassification {
  constructor(private readonly dependencies: WorldClassificationDependencies) {}

  flatFeatureUnderPlayerCache: Map<string, TerrainSnapshot> = new Map();

  suppressedLootLikeUnderPlayerCacheKeys: Set<string> = new Set();

  boulderGlyphLookupVersion: NethackRuntimeVersion | null = null;

  boulderGlyphLookup: Set<number> = new Set();

  isPersistentTerrainKind(kind: string): boolean {
    switch (kind) {
      case "cmap":
        return true;
      // "obj", "body", "statue" are effectively transient entities on top of terrain
      // and should not overwrite the terrain cache (lastKnownTerrain).
      default:
        return false;
    }
  }

  isUndiscoveredKind(kind: string): boolean {
    return kind === "unexplored" || kind === "nothing";
  }

  shouldFlattenVoidOrUnknownTileFor367(
    behavior: TileBehaviorResult,
    isInferredDarkCorridorWall: boolean,
  ): boolean {
    if (isInferredDarkCorridorWall) {
      return false;
    }

    const runtimeVersion =
      this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7";
    if (runtimeVersion === "5.0") {
      return false;
    }

    if (
      behavior.resolved.kind === "unknown" ||
      behavior.effective.kind === "unknown"
    ) {
      return true;
    }

    if (behavior.resolved.kind !== "cmap") {
      return false;
    }
    if (behavior.resolved.glyph !== getDefaultDarkWallGlyph()) {
      return false;
    }

    const resolvedChar =
      typeof behavior.resolved.char === "string"
        ? behavior.resolved.char.trim()
        : "";
    const glyphChar =
      typeof behavior.glyphChar === "string" ? behavior.glyphChar.trim() : "";
    return resolvedChar.length === 0 || glyphChar.length === 0;
  }

  isDamageFlashableBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph) {
      return true;
    }

    return this.isMonsterLikeBehavior(behavior);
  }

  isMonsterLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph) {
      return false;
    }

    switch (behavior.effective.kind) {
      case "mon":
      case "pet":
      case "ridden":
      case "detect":
      case "invis":
        return true;
      default:
        return false;
    }
  }

  isLootLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph) {
      return false;
    }

    switch (behavior.effective.kind) {
      case "obj":
      case "body":
        return true;
      default:
        return false;
    }
  }

  isAltarLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph || behavior.resolved.kind !== "cmap") {
      return false;
    }
    if (behavior.materialKind !== "feature") {
      return false;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    return chars.some(
      (value) => typeof value === "string" && value.trim() === "_",
    );
  }

  isTombstoneLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph || behavior.resolved.kind !== "cmap") {
      return false;
    }
    if (
      behavior.effective.glyph === 2387 ||
      behavior.effective.tileIndex === 878
    ) {
      return true;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    const isPipeGlyph = chars.some(
      (value) => typeof value === "string" && value.trim() === "|",
    );
    if (!isPipeGlyph) {
      return false;
    }
    if (behavior.materialKind === "door" || behavior.isWall) {
      return false;
    }
    return true;
  }

  isSinkLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph || behavior.resolved.kind !== "cmap") {
      return false;
    }
    if (behavior.materialKind !== "feature") {
      return false;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    return chars.some(
      (value) => typeof value === "string" && value.trim() === "{",
    );
  }

  isAltarOrTombstoneLikeBehavior(
    behavior: TileBehaviorResult,
  ): boolean {
    return (
      this.isAltarLikeBehavior(behavior) ||
      this.isTombstoneLikeBehavior(behavior)
    );
  }

  shouldUseRaisedSpecialTileBillboardInTiles(
    behavior: TileBehaviorResult,
  ): boolean {
    if (behavior.isPlayerGlyph) {
      return false;
    }
    if (behavior.effective.kind === "statue") {
      return true;
    }
    if (
      this.isSinkLikeBehavior(behavior) ||
      isSinkCmapGlyph(behavior.effective.glyph)
    ) {
      return true;
    }
    if (
      behavior.materialKind === "stairs_up" ||
      behavior.materialKind === "fountain"
    ) {
      return true;
    }
    return this.isAltarOrTombstoneLikeBehavior(behavior);
  }

  shouldUseTransparentTileFloorUnderlay(
    behavior: TileBehaviorResult,
  ): boolean {
    return (
      this.shouldUseRaisedSpecialTileBillboardInTiles(behavior) ||
      this.isOpenDoorFloorBehavior(behavior)
    );
  }

  shouldUseTransparentWallGroundPlaneUnderlay(
    behavior: TileBehaviorResult,
  ): boolean {
    return this.isIronBarsLikeBehavior(behavior);
  }

  isIronBarsLikeBehavior(behavior: TileBehaviorResult): boolean {
    return isIronBarsCmapGlyph(behavior.effective.glyph);
  }

  isPassableDoorwayTerrainBehavior(
    behavior: TileBehaviorResult,
  ): boolean {
    return !behavior.isWall && isDoorwayCmapGlyph(behavior.effective.glyph);
  }

  isOpenDoorFloorBehavior(behavior: TileBehaviorResult): boolean {
    const effectiveGlyph = behavior.effective.glyph;
    return (
      behavior.materialKind === "door" &&
      this.isPassableDoorwayTerrainBehavior(behavior) &&
      getOpenDoorGlyphFrom(effectiveGlyph) === effectiveGlyph
    );
  }

  isTileAdjacentToIronBars(tileX: number, tileY: number): boolean {
    const neighborOffsets = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const offset of neighborOffsets) {
      const neighborKey = `${tileX + offset.dx},${tileY + offset.dy}`;
      const snapshot =
        this.dependencies.darkCorridorInference.getKnownTerrainSnapshotForInferenceAtKey(neighborKey);
      if (!snapshot) {
        continue;
      }
      const behavior = classifyTileBehavior({
        glyph: snapshot.glyph,
        runtimeChar: snapshot.char ?? null,
        runtimeColor:
          typeof snapshot.color === "number" ? snapshot.color : null,
        runtimeTileIndex:
          typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
        priorTerrain: this.dependencies.levelTerrainCache.lastKnownTerrain.get(neighborKey) ?? snapshot,
      });
      if (this.isIronBarsLikeBehavior(behavior)) {
        return true;
      }
    }
    return false;
  }

  getPlayerUnderlayBillboardKey(tileKey: string): string {
    return `${tileKey}|underlay-feature`;
  }

  isUnderlayFeatureBillboardKey(billboardKey: string): boolean {
    return billboardKey.endsWith("|underlay-feature");
  }

  shouldShowUnderPlayerFeaturesInOverheadTilesMode(): boolean {
    return (
      !this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
      this.dependencies.engineState.clientOptions.showItemsUnderPlayerInOverheadTilesMode
    );
  }

  shouldHandleUnderPlayerItemGlyphEvents(): boolean {
    return (
      this.dependencies.movementInput.isFpsMode() ||
      this.shouldShowUnderPlayerFeaturesInOverheadTilesMode()
    );
  }

  resolveLegacyHereChoicePreviewTileIndex(): number | null {
    const playerTileKey = `${this.dependencies.playerMovement.playerPos.x},${this.dependencies.playerMovement.playerPos.y}`;
    const playerTileMesh = this.dependencies.tileRendering.tileMap.get(playerTileKey) ?? null;
    const floorTileIndex =
      typeof playerTileMesh?.userData?.floorUnderlayTileIndex === "number" &&
      Number.isFinite(playerTileMesh.userData.floorUnderlayTileIndex)
        ? Math.trunc(playerTileMesh.userData.floorUnderlayTileIndex)
        : typeof playerTileMesh?.userData?.tileIndex === "number" &&
            Number.isFinite(playerTileMesh.userData.tileIndex)
          ? Math.trunc(playerTileMesh.userData.tileIndex)
          : null;
    const sharedSpaceBillboard =
      this.dependencies.entityBillboards.monsterBillboards.get(playerTileKey) ?? null;
    const sharedSpaceBillboardTileIndex =
      typeof sharedSpaceBillboard?.userData?.tileIndex === "number" &&
      Number.isFinite(sharedSpaceBillboard.userData.tileIndex)
        ? Math.trunc(sharedSpaceBillboard.userData.tileIndex)
        : null;
    const flattenedFeatureBillboard =
      this.dependencies.entityBillboards.monsterBillboards.get(
        this.getPlayerUnderlayBillboardKey(playerTileKey),
      ) ?? null;
    const flattenedFeatureBillboardTileIndex =
      typeof flattenedFeatureBillboard?.userData?.tileIndex === "number" &&
      Number.isFinite(flattenedFeatureBillboard.userData.tileIndex)
        ? Math.trunc(flattenedFeatureBillboard.userData.tileIndex)
        : null;

    if (this.dependencies.engineState.clientOptions.fpsFlattenEntityBillboards) {
      return flattenedFeatureBillboardTileIndex ?? floorTileIndex;
    }

    return sharedSpaceBillboardTileIndex ?? floorTileIndex;
  }

  getFpsPlayerTileBillboardBehaviorFromCache(
    key: string,
    currentBehavior: TileBehaviorResult | null = null,
  ): TileBehaviorResult | null {
    if (
      !this.dependencies.entityBillboards.shouldUseStandingBillboardOverlayMode() ||
      this.dependencies.engineState.clientOptions.tilesetMode !== "tiles"
    ) {
      return null;
    }
    const snapshot = this.getPlayerTileUnderlaySnapshotFromCache(key);
    if (!snapshot) {
      return null;
    }
    const canUseLiveTileBehavior =
      currentBehavior !== null &&
      (this.shouldRenderFlatFeatureUnderPlayer(currentBehavior) ||
        this.shouldUseRaisedSpecialTileBillboardInTiles(currentBehavior));
    if (!canUseLiveTileBehavior) {
      this.dependencies.tileUpdates.maybeRequestRuntimeTileRefreshForFpsCacheAssumption(
        key,
        "player-tile-billboard",
      );
    }
    const behavior = classifyTileBehavior({
      glyph: snapshot.glyph,
      runtimeChar: snapshot.char ?? null,
      runtimeColor: typeof snapshot.color === "number" ? snapshot.color : null,
      runtimeTileIndex:
        typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
      priorTerrain: snapshot,
    });
    if (
      this.isLootLikeBehavior(behavior) ||
      this.shouldUseRaisedSpecialTileBillboardInTiles(behavior)
    ) {
      return behavior;
    }
    return null;
  }

  getPlayerTileUnderlaySnapshotFromCache(
    key: string,
    runtimeFloorUnderlaySnapshot: TerrainSnapshot | null = null,
  ): TerrainSnapshot | null {
    const cachedTerrain = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
    return (
      this.flatFeatureUnderPlayerCache.get(key) ??
      runtimeFloorUnderlaySnapshot ??
      cachedTerrain
    );
  }

  resolveFloorBehaviorUnderFpsPlayerTileBillboard(
    key: string,
    billboardBehavior: TileBehaviorResult,
  ): TileBehaviorResult {
    if (this.shouldUseRaisedSpecialTileBillboardInTiles(billboardBehavior)) {
      return this.resolveRaisedSpecialTileFloorBehavior();
    }
    return this.resolveFpsFloorUnderlayBehaviorFromCache(key);
  }

  resolveRaisedSpecialTileFloorBehavior(): TileBehaviorResult {
    const fallbackGlyph = getDefaultFloorGlyph();
    const shouldUseTilesetBackgroundTileUnderlay =
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
      !this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
      this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "tile";
    const useBackgroundReferenceTile =
      shouldUseTilesetBackgroundTileUnderlay &&
      this.dependencies.tilesetAssets.tilesetBackgroundReferenceTileCanvas !== null;
    const behavior = classifyTileBehavior({
      glyph: fallbackGlyph,
      runtimeChar: ".",
      runtimeColor: null,
      runtimeTileIndex: shouldUseTilesetBackgroundTileUnderlay
        ? useBackgroundReferenceTile
          ? null
          : this.dependencies.tilesetAssets.resolveTilesetBackgroundReferenceTileIndex()
        : null,
      priorTerrain: null,
    });
    behavior.useBackgroundReferenceTile = useBackgroundReferenceTile;
    return behavior;
  }

  resolveNormalRoomFloorBehavior(): TileBehaviorResult {
    return classifyTileBehavior({
      glyph: getDefaultFloorGlyph(),
      runtimeChar: ".",
      runtimeColor: null,
      priorTerrain: null,
    });
  }

  resolveTransparentOpenDoorwayFloorTileIndex(): number {
    if (
      this.dependencies.tilesetAssets.loadedTilesetTileLayoutVersion === "slashem" ||
      this.dependencies.tilesetAssets.loadedTilesetTileLayoutVersion === "3.4.3"
    ) {
      return 1187;
    }
    if (this.dependencies.tilesetAssets.loadedTilesetTileLayoutVersion === "5.0") {
      return 1281;
    }
    return 862;
  }

  resolveTransparentOpenDoorwayFloorBehavior(): TileBehaviorResult {
    return classifyTileBehavior({
      glyph: getDefaultFloorGlyph(),
      runtimeChar: ".",
      runtimeColor: null,
      runtimeTileIndex: this.resolveTransparentOpenDoorwayFloorTileIndex(),
      priorTerrain: null,
    });
  }

  isGoldLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.effective.kind !== "obj") {
      return false;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    return chars.some(
      (value) => typeof value === "string" && value.trim() === "$",
    );
  }

  rebuildBoulderGlyphLookupIfNeeded(): void {
    const runtimeVersion = this.dependencies.tilesetAssets.resolveRuntimeVersion();
    if (this.boulderGlyphLookupVersion === runtimeVersion) {
      return;
    }
    const lookup = new Set<number>();
    const backtickObjGlyphs: number[] = [];
    const ranges = getGlyphCatalogRanges();
    for (const range of ranges) {
      if (range.kind !== "obj") {
        continue;
      }
      for (let glyph = range.start; glyph < range.endExclusive; glyph += 1) {
        const entry = getGlyphCatalogEntry(glyph);
        if (!entry || entry.kind !== "obj") {
          continue;
        }
        if (
          typeof entry.symidx === "number" &&
          Number.isFinite(entry.symidx) &&
          Math.trunc(entry.symidx) === 192
        ) {
          lookup.add(glyph);
          continue;
        }
        const catalogCharCode =
          typeof entry.ttychar === "number" && Number.isFinite(entry.ttychar)
            ? Math.trunc(entry.ttychar)
            : typeof entry.ch === "number" && Number.isFinite(entry.ch)
              ? Math.trunc(entry.ch)
              : null;
        if (catalogCharCode === 96) {
          backtickObjGlyphs.push(glyph);
        }
      }
    }
    if (lookup.size === 0 && backtickObjGlyphs.length > 0) {
      // 3.6.7 catalogs don't expose obj symidx; boulder is the first rock-class obj glyph.
      lookup.add(Math.min(...backtickObjGlyphs));
    }
    this.boulderGlyphLookup = lookup;
    this.boulderGlyphLookupVersion = runtimeVersion;
  }

  isBoulderGlyphByCatalog(glyph: number): boolean {
    if (!Number.isFinite(glyph)) {
      return false;
    }
    this.rebuildBoulderGlyphLookupIfNeeded();
    return this.boulderGlyphLookup.has(Math.trunc(glyph));
  }

  isBoulderLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.effective.kind !== "obj") {
      return false;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    if (
      chars.some((value) => typeof value === "string" && value.trim() === "`")
    ) {
      return true;
    }
    if (
      this.isBoulderGlyphByCatalog(behavior.effective.glyph) ||
      this.isBoulderGlyphByCatalog(behavior.resolved.glyph)
    ) {
      return true;
    }
    return false;
  }

  getMaterialKindForTerrainSnapshot(
    snapshot: TerrainSnapshot | null,
  ): TileMaterialKind | null {
    if (!snapshot) {
      return null;
    }
    const behavior = classifyTileBehavior({
      glyph: snapshot.glyph,
      runtimeKind: snapshot.kind ?? null,
      runtimeChar: snapshot.char ?? null,
      runtimeColor: typeof snapshot.color === "number" ? snapshot.color : null,
      runtimeTileIndex:
        typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
      runtimeSymidx:
        typeof snapshot.symidx === "number" ? snapshot.symidx : null,
      priorTerrain: snapshot,
    });
    return behavior.materialKind;
  }

  buildFallbackTerrainSnapshotForPlayerTile(): TerrainSnapshot {
    const fallbackBehavior =
      this.resolveFloorBehaviorFromNeighborTiles(
        this.dependencies.playerMovement.playerPos.x,
        this.dependencies.playerMovement.playerPos.y,
      ) ?? this.resolveNormalRoomFloorBehavior();
    return {
      glyph: fallbackBehavior.effective.glyph,
      char: fallbackBehavior.resolved.char ?? undefined,
      color: fallbackBehavior.resolved.color ?? undefined,
      tileIndex: fallbackBehavior.resolved.tileIndex,
    };
  }

  invalidatePlayerTileFeatureFromMessage(
    materialKind: TileMaterialKind,
    refreshReason: string,
  ): void {
    if (!this.dependencies.playerMovement.hasSeenPlayerPosition) {
      return;
    }

    const tileX = this.dependencies.playerMovement.playerPos.x;
    const tileY = this.dependencies.playerMovement.playerPos.y;
    const key = `${tileX},${tileY}`;
    let changed = false;

    const cachedFlatFeature = this.flatFeatureUnderPlayerCache.get(key) ?? null;
    if (
      cachedFlatFeature &&
      this.getMaterialKindForTerrainSnapshot(cachedFlatFeature) === materialKind
    ) {
      this.flatFeatureUnderPlayerCache.delete(key);
      changed = true;
    }

    const cachedTerrain = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
    if (
      cachedTerrain &&
      this.getMaterialKindForTerrainSnapshot(cachedTerrain) === materialKind
    ) {
      this.dependencies.levelTerrainCache.lastKnownTerrain.set(
        key,
        this.buildFallbackTerrainSnapshotForPlayerTile(),
      );
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.dependencies.tileUpdates.refreshTileVisualFromStateCache(tileX, tileY);
    this.dependencies.tileUpdates.requestPlayerTileRefresh(refreshReason, { forceRuntime: true });
  }

  capturePlayerTileTerrainInvalidationFromMessage(
    messageLike: unknown,
  ): void {
    if (typeof messageLike !== "string") {
      return;
    }
    const normalized = messageLike.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    if (/\bfountain dries up\b/.test(normalized)) {
      this.invalidatePlayerTileFeatureFromMessage(
        "fountain",
        "fountain-dried-up-message",
      );
    }
  }

  classifyTilePayload(tile: any): TileBehaviorResult | null {
    if (
      !tile ||
      typeof tile.x !== "number" ||
      typeof tile.y !== "number" ||
      typeof tile.glyph !== "number"
    ) {
      return null;
    }

    const key = `${tile.x},${tile.y}`;
    return classifyTileBehavior({
      glyph: tile.glyph,
      runtimeChar: typeof tile.char === "string" ? tile.char : null,
      runtimeColor: typeof tile.color === "number" ? tile.color : null,
      runtimeTileIndex:
        typeof tile.tileIndex === "number" ? tile.tileIndex : null,
      runtimeSymidx: typeof tile.symidx === "number" ? tile.symidx : null,
      priorTerrain: this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null,
    });
  }

  snapshotPersistentTerrainFromTile(
    tile: any,
    behavior: TileBehaviorResult | null,
  ): TerrainSnapshot | null {
    if (!tile || typeof tile.glyph !== "number" || !behavior) {
      return null;
    }
    if (behavior.isPlayerGlyph) {
      return null;
    }
    if (!this.isPersistentTerrainKind(behavior.resolved.kind)) {
      return null;
    }
    return {
      glyph: tile.glyph,
      char: behavior.resolved.char ?? undefined,
      color: behavior.resolved.color ?? undefined,
      tileIndex: behavior.resolved.tileIndex,
      symidx:
        typeof tile.symidx === "number" && Number.isFinite(tile.symidx)
          ? Math.trunc(tile.symidx)
          : undefined,
    };
  }

  shouldRenderFlatFeatureUnderPlayer(
    behavior: TileBehaviorResult,
  ): boolean {
    if (behavior.isPlayerGlyph) {
      return false;
    }
    if (behavior.resolved.kind === "statue") {
      return true;
    }
    if (this.isLootLikeBehavior(behavior)) {
      if (this.isBoulderLikeBehavior(behavior)) {
        return false;
      }
      return true;
    }
    if (this.isPassableDoorwayTerrainBehavior(behavior)) {
      return true;
    }
    switch (behavior.materialKind) {
      case "stairs_up":
      case "stairs_down":
      case "fountain":
      case "trap":
      case "feature":
        return true;
      default:
        return false;
    }
  }

  snapshotFlatFeatureUnderPlayerFromTile(
    tile: any,
    behavior: TileBehaviorResult | null,
  ): TerrainSnapshot | null {
    if (!tile || typeof tile.glyph !== "number" || !behavior) {
      return null;
    }
    if (!this.shouldRenderFlatFeatureUnderPlayer(behavior)) {
      return null;
    }
    return {
      glyph: tile.glyph,
      char: behavior.resolved.char ?? undefined,
      color: behavior.resolved.color ?? undefined,
      tileIndex: behavior.resolved.tileIndex,
      symidx:
        typeof tile.symidx === "number" && Number.isFinite(tile.symidx)
          ? Math.trunc(tile.symidx)
          : undefined,
    };
  }

  seedTerrainCacheFromSupersededPendingUpdate(
    key: string,
    previousTile: any,
    nextTile: any,
  ): void {
    if (
      !nextTile ||
      typeof nextTile.x !== "number" ||
      typeof nextTile.y !== "number"
    ) {
      return;
    }
    const isPlayerTile =
      nextTile.x === this.dependencies.playerMovement.playerPos.x && nextTile.y === this.dependencies.playerMovement.playerPos.y;
    if (!isPlayerTile) {
      return;
    }
    const previousBehavior = this.classifyTilePayload(previousTile);
    const shouldSuppressPreviousFlatFeatureSeed =
      previousBehavior !== null &&
      this.isLootLikeBehavior(previousBehavior) &&
      this.suppressedLootLikeUnderPlayerCacheKeys.has(key);
    const previousTerrain = this.snapshotPersistentTerrainFromTile(
      previousTile,
      previousBehavior,
    );
    if (!previousTerrain) {
      const previousFlatFeature = this.snapshotFlatFeatureUnderPlayerFromTile(
        previousTile,
        previousBehavior,
      );
      if (previousFlatFeature && !shouldSuppressPreviousFlatFeatureSeed) {
        this.flatFeatureUnderPlayerCache.set(key, previousFlatFeature);
      }
      return;
    }
    this.dependencies.levelTerrainCache.lastKnownTerrain.set(key, previousTerrain);
    const previousFlatFeature = this.snapshotFlatFeatureUnderPlayerFromTile(
      previousTile,
      previousBehavior,
    );
    if (previousFlatFeature && !shouldSuppressPreviousFlatFeatureSeed) {
      this.flatFeatureUnderPlayerCache.set(key, previousFlatFeature);
    }
  }

  seedFlatFeatureUnderPlayerCacheFromPreviousState(key: string): void {
    const previousSnapshot = this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
    if (!previousSnapshot) {
      return;
    }
    const previousBehavior = classifyTileBehavior({
      glyph: previousSnapshot.glyph,
      runtimeChar: previousSnapshot.char ?? null,
      runtimeColor:
        typeof previousSnapshot.color === "number"
          ? previousSnapshot.color
          : null,
      runtimeTileIndex:
        typeof previousSnapshot.tileIndex === "number"
          ? previousSnapshot.tileIndex
          : null,
      priorTerrain: this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null,
    });
    const previousFlatFeature = this.snapshotFlatFeatureUnderPlayerFromTile(
      previousSnapshot,
      previousBehavior,
    );
    const shouldSuppressPreviousFlatFeatureSeed =
      previousBehavior !== null &&
      this.isLootLikeBehavior(previousBehavior) &&
      this.suppressedLootLikeUnderPlayerCacheKeys.has(key);
    if (previousFlatFeature && !shouldSuppressPreviousFlatFeatureSeed) {
      this.flatFeatureUnderPlayerCache.set(key, previousFlatFeature);
    }
  }

  shouldKeepFloorGlyphUnderFpsAsciiPlayer(
    behavior: TileBehaviorResult,
  ): boolean {
    if (!this.dependencies.movementInput.isFpsMode() || this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
      return false;
    }
    if (behavior.isPlayerGlyph || behavior.isWall) {
      return false;
    }
    if (behavior.resolved.kind !== "cmap") {
      return false;
    }
    // Keep normal ASCII floor glyphs (lit and dark floor/corridor) visible
    // under the suppressed player tile in FPS mode.
    return (
      behavior.materialKind === "floor" || behavior.materialKind === "dark"
    );
  }

  resolveFpsFloorUnderlayBehaviorFromCache(
    key: string,
  ): TileBehaviorResult {
    const floorSnapshot = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
    if (floorSnapshot) {
      const floorBehavior = classifyTileBehavior({
        glyph: floorSnapshot.glyph,
        runtimeChar: floorSnapshot.char ?? null,
        runtimeColor:
          typeof floorSnapshot.color === "number" ? floorSnapshot.color : null,
        runtimeTileIndex:
          typeof floorSnapshot.tileIndex === "number"
            ? floorSnapshot.tileIndex
            : null,
        priorTerrain: floorSnapshot,
      });
      if (
        !floorBehavior.isWall &&
        !this.isMonsterLikeBehavior(floorBehavior) &&
        floorBehavior.materialKind !== "player"
      ) {
        return floorBehavior;
      }
    }
    return classifyTileBehavior({
      glyph: getDefaultDarkFloorGlyph(),
      runtimeChar: ".",
      runtimeColor: null,
      priorTerrain: null,
    });
  }

  isDisallowedSpecialDotFloorBehavior(
    behavior: TileBehaviorResult | null,
  ): boolean {
    if (!behavior) {
      return false;
    }
    if (behavior.effective.kind !== "cmap") {
      return false;
    }
    const effectiveGlyph =
      typeof behavior.effective.glyph === "number" &&
      Number.isFinite(behavior.effective.glyph)
        ? Math.trunc(behavior.effective.glyph)
        : null;
    if (effectiveGlyph === null) {
      return false;
    }
    return (
      isDoorwayCmapGlyph(effectiveGlyph) || behavior.materialKind === "door"
    );
  }

  isEmptyAdjacentFloorFallbackBehavior(
    behavior: TileBehaviorResult | null,
  ): boolean {
    if (!behavior) {
      return false;
    }
    if (behavior.effective.kind !== "cmap") {
      return false;
    }
    if (this.isDisallowedSpecialDotFloorBehavior(behavior)) {
      return false;
    }
    return (
      behavior.materialKind === "floor" || behavior.materialKind === "dark"
    );
  }

  resolveFloorBehaviorFromNeighborTiles(
    tileX: number,
    tileY: number,
  ): TileBehaviorResult | null {
    const neighborOffsets = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];

    let bestDarkFloorFallback: TileBehaviorResult | null = null;
    for (const offset of neighborOffsets) {
      const neighborX = tileX + offset.dx;
      const neighborY = tileY + offset.dy;
      const neighborKey = `${neighborX},${neighborY}`;
      const snapshot = this.dependencies.levelTerrainCache.lastKnownTerrain.get(neighborKey);
      if (!snapshot) {
        continue;
      }
      const neighborBehavior = classifyTileBehavior({
        glyph: snapshot.glyph,
        runtimeChar: snapshot.char ?? null,
        runtimeColor:
          typeof snapshot.color === "number" ? snapshot.color : null,
        runtimeTileIndex:
          typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
        priorTerrain: snapshot,
      });
      if (
        neighborBehavior.isWall ||
        this.isMonsterLikeBehavior(neighborBehavior) ||
        this.isLootLikeBehavior(neighborBehavior) ||
        neighborBehavior.materialKind === "player" ||
        !this.isEmptyAdjacentFloorFallbackBehavior(neighborBehavior)
      ) {
        continue;
      }

      if (neighborBehavior.materialKind !== "dark") {
        return neighborBehavior;
      }
      if (!bestDarkFloorFallback) {
        bestDarkFloorFallback = neighborBehavior;
      }
    }

    return bestDarkFloorFallback;
  }

  applyUnderPlayerItemGlyphEvent(data: Record<string, unknown>): void {
    if (!this.shouldHandleUnderPlayerItemGlyphEvents()) {
      return;
    }
    const x = Number(data.x);
    const y = Number(data.y);
    const glyph = Number(data.glyph);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(glyph)) {
      return;
    }
    const tileX = Math.trunc(x);
    const tileY = Math.trunc(y);
    const normalizedGlyph = Math.trunc(glyph);
    const key = `${tileX},${tileY}`;
    const runtimeChar =
      typeof data.char === "string" && data.char.length > 0 ? data.char : null;
    const runtimeColor =
      typeof data.color === "number" && Number.isFinite(data.color)
        ? Math.trunc(data.color)
        : null;
    const runtimeTileIndex =
      typeof data.tileIndex === "number" &&
      Number.isFinite(data.tileIndex) &&
      data.tileIndex >= 0
        ? Math.trunc(data.tileIndex)
        : null;
    const runtimeSymidx =
      typeof data.symidx === "number" &&
      Number.isFinite(data.symidx) &&
      data.symidx >= 0
        ? Math.trunc(data.symidx)
        : null;
    const runtimeKind =
      typeof data.kind === "string" &&
      [
        "mon",
        "pet",
        "invis",
        "detect",
        "body",
        "ridden",
        "obj",
        "cmap",
        "explode",
        "zap",
        "swallow",
        "warning",
        "statue",
        "unexplored",
        "nothing",
      ].includes(data.kind)
        ? (data.kind as GlyphKind)
        : null;
    const runtimeGlyphFlags =
      typeof data.glyphFlags === "number" && Number.isFinite(data.glyphFlags)
        ? Math.trunc(data.glyphFlags)
        : null;
    const rememberedUnderPlayerFeature =
      this.flatFeatureUnderPlayerCache.get(key) ?? null;
    const resolvedRuntimeTileIndex =
      runtimeTileIndex === null &&
      rememberedUnderPlayerFeature &&
      rememberedUnderPlayerFeature.glyph === normalizedGlyph &&
      typeof rememberedUnderPlayerFeature.tileIndex === "number" &&
      Number.isFinite(rememberedUnderPlayerFeature.tileIndex) &&
      rememberedUnderPlayerFeature.tileIndex >= 0
        ? Math.trunc(rememberedUnderPlayerFeature.tileIndex)
        : runtimeTileIndex;
    const resolvedRuntimeSymidx =
      runtimeSymidx === null &&
      rememberedUnderPlayerFeature &&
      rememberedUnderPlayerFeature.glyph === normalizedGlyph &&
      typeof rememberedUnderPlayerFeature.symidx === "number" &&
      Number.isFinite(rememberedUnderPlayerFeature.symidx) &&
      rememberedUnderPlayerFeature.symidx >= 0
        ? Math.trunc(rememberedUnderPlayerFeature.symidx)
        : runtimeSymidx;
    const resolvedRuntimeChar =
      runtimeChar ??
      (rememberedUnderPlayerFeature &&
      rememberedUnderPlayerFeature.glyph === normalizedGlyph &&
      typeof rememberedUnderPlayerFeature.char === "string" &&
      rememberedUnderPlayerFeature.char.length > 0
        ? rememberedUnderPlayerFeature.char
        : null);
    const resolvedRuntimeColor =
      runtimeColor ??
      (rememberedUnderPlayerFeature &&
      rememberedUnderPlayerFeature.glyph === normalizedGlyph &&
      typeof rememberedUnderPlayerFeature.color === "number" &&
      Number.isFinite(rememberedUnderPlayerFeature.color)
        ? Math.trunc(rememberedUnderPlayerFeature.color)
        : null);
    const resolvedRuntimeKind =
      runtimeKind ??
      (rememberedUnderPlayerFeature &&
      rememberedUnderPlayerFeature.glyph === normalizedGlyph &&
      typeof rememberedUnderPlayerFeature.kind === "string"
        ? rememberedUnderPlayerFeature.kind
        : null);
    const resolvedRuntimeGlyphFlags =
      runtimeGlyphFlags ??
      (rememberedUnderPlayerFeature &&
      rememberedUnderPlayerFeature.glyph === normalizedGlyph &&
      typeof rememberedUnderPlayerFeature.glyphFlags === "number" &&
      Number.isFinite(rememberedUnderPlayerFeature.glyphFlags)
        ? Math.trunc(rememberedUnderPlayerFeature.glyphFlags)
        : null);

    const behavior = classifyTileBehavior({
      glyph: normalizedGlyph,
      runtimeKind: resolvedRuntimeKind,
      runtimeChar: resolvedRuntimeChar,
      runtimeColor: resolvedRuntimeColor,
      runtimeTileIndex: resolvedRuntimeTileIndex,
      runtimeSymidx: resolvedRuntimeSymidx,
      priorTerrain: this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null,
    });
    console.log(
      `Applying under-player item glyph at (${tileX}, ${tileY}): ${normalizedGlyph}`,
    );
    if (!this.shouldRenderFlatFeatureUnderPlayer(behavior)) {
      if (this.isLootLikeBehavior(behavior)) {
        this.suppressedLootLikeUnderPlayerCacheKeys.add(key);
      } else {
        this.suppressedLootLikeUnderPlayerCacheKeys.delete(key);
      }
      this.flatFeatureUnderPlayerCache.delete(key);
      this.dependencies.tileUpdates.refreshTileVisualFromStateCache(tileX, tileY);
      return;
    }

    this.suppressedLootLikeUnderPlayerCacheKeys.delete(key);
    this.flatFeatureUnderPlayerCache.set(key, {
      glyph: normalizedGlyph,
      kind: resolvedRuntimeKind ?? undefined,
      char: resolvedRuntimeChar ?? undefined,
      color: resolvedRuntimeColor ?? undefined,
      tileIndex: resolvedRuntimeTileIndex ?? undefined,
      symidx: resolvedRuntimeSymidx ?? undefined,
      glyphFlags: resolvedRuntimeGlyphFlags ?? undefined,
    });
    this.dependencies.tileUpdates.refreshTileVisualFromStateCache(tileX, tileY);
  }

  clearUnderPlayerItemGlyphEvent(data: Record<string, unknown>): void {
    if (!this.shouldHandleUnderPlayerItemGlyphEvents()) {
      return;
    }
    const x = Number(data.x);
    const y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    const tileX = Math.trunc(x);
    const tileY = Math.trunc(y);
    const key = `${tileX},${tileY}`;
    console.log(`Clearing under-player item glyph at (${tileX}, ${tileY})`);
    this.suppressedLootLikeUnderPlayerCacheKeys.add(key);
    this.flatFeatureUnderPlayerCache.delete(key);
    this.dependencies.tileUpdates.refreshTileVisualFromStateCache(tileX, tileY);
  }
}
