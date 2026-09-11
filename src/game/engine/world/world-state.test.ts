import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { GLYPH_CATALOG } from "../../glyphs";
import { normalizeNh3dClientOptions } from "../../ui-types";
import { LevelTerrainCache, type LevelTerrainCacheDependencies } from "./level-terrain-cache";
import {
  RuntimeEntityTracking,
  type RuntimeEntityTrackingDependencies
} from "./runtime-entity-tracking";
import { TileUpdates } from "./tile-updates";
import { WorldClassification, type WorldClassificationDependencies } from "./world-classification";

vi.hoisted(() => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } });
});
afterAll(() => vi.unstubAllGlobals());

function createWorldFixture() {
  const tileUpdates: LevelTerrainCacheDependencies["tileUpdates"] &
    WorldClassificationDependencies["tileUpdates"] = {
    tileStateCache: new Map(),
    pendingTileUpdates: new Map(),
    pendingTileFlushQueue: [],
    pendingTileFlushQueueIndex: 0,
    buildTileStateSignatureFromPayload: TileUpdates.prototype.buildTileStateSignatureFromPayload,
    flushPendingTileUpdates: vi.fn(),
    refreshTilesFromStateCache: vi.fn(),
    refreshTileVisualFromStateCache: vi.fn(),
    maybeRequestRuntimeTileRefreshForFpsCacheAssumption: vi.fn(),
    requestPlayerTileRefresh: vi.fn(),
  };
  const darkCorridorInference: LevelTerrainCacheDependencies["darkCorridorInference"] = {
    inferredDarkCorridorTileFlags: new Set(),
    inferredDarkCorridorWallTiles: new Map(),
  };
  const tileRendering = { updateTile: vi.fn(), tileMap: new Map() };
  const worldDependencies: WorldClassificationDependencies = {
    darkCorridorInference: { getKnownTerrainSnapshotForInferenceAtKey: vi.fn(() => null) },
    engineState: {
      characterCreationConfig: { mode: "create", playMode: "normal", runtimeVersion: "3.6.7" },
      clientOptions: normalizeNh3dClientOptions(),
    },
    entityBillboards: { monsterBillboards: new Map(), shouldUseStandingBillboardOverlayMode: () => true },
    get levelTerrainCache() { return levelTerrainCache; },
    movementInput: { isFpsMode: () => true },
    playerMovement: { playerPos: { x: 4, y: 5 }, hasSeenPlayerPosition: true },
    tileRendering,
    tilesetAssets: {
      loadedTilesetTileLayoutVersion: "3.6.7",
      resolveRuntimeVersion: () => "3.6.7",
      resolveTilesetBackgroundReferenceTileIndex: () => 0,
      shouldUseVultureTiles: () => false,
      tilesetBackgroundReferenceTileCanvas: null,
    },
    tileUpdates,
  };
  const worldClassification = new WorldClassification(worldDependencies);
  const levelDependencies: LevelTerrainCacheDependencies = {
    bloodGround: {
      captureActiveBloodGroundCacheSnapshot: () => null,
      clearActiveBloodGroundCanvas: vi.fn(),
      cloneBloodGroundCacheSnapshot: () => null,
      disposeBloodGroundOverlayResources: vi.fn(),
      restoreBloodGroundCacheSnapshot: vi.fn(),
    },
    darkCorridorInference,
    playerStatus: { playerStats: {
      name: "Adventurer", hp: 10, maxHp: 10, power: 0, maxPower: 0,
      level: 1, experience: 0, strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10, armor: 10,
      dungeon: "Dungeons of Doom", dlevel: 1, locationLabel: "", gold: 0,
      alignment: "Neutral", hunger: "Not Hungry", encumbrance: "",
      conditionMask: 0, time: 1, score: 0,
    } },
    tileRendering,
    tileUpdates,
    vultureWalls: { pendingVultureWallMaterialRefreshKeys: new Set(), flushPendingVultureWallMaterialRefreshes: vi.fn() },
    worldClassification,
  };
  const levelTerrainCache = new LevelTerrainCache(levelDependencies);
  return { worldClassification, worldDependencies, levelTerrainCache, tileUpdates, tileRendering, darkCorridorInference };
}

afterEach(() => vi.restoreAllMocks());

describe("under-player runtime item state", () => {
  it("keeps live classification and atlas metadata and reuses it for a partial update", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { worldClassification: world, tileUpdates } = createWorldFixture();
    // A runtime object may disagree with the static catalog's monster range.
    const liveItem = { x: 4, y: 5, glyph: 0, kind: "obj", char: ")", color: 7, tileIndex: 9123, symidx: 12, glyphFlags: 16 };
    world.applyUnderPlayerItemGlyphEvent(liveItem);
    expect(world.flatFeatureUnderPlayerCache.get("4,5")).toEqual({
      glyph: 0, kind: "obj", char: ")", color: 7, tileIndex: 9123, symidx: 12, glyphFlags: 16,
    });
    world.applyUnderPlayerItemGlyphEvent({ x: 4, y: 5, glyph: 0 });
    expect(world.flatFeatureUnderPlayerCache.get("4,5")).toEqual({
      glyph: 0, kind: "obj", char: ")", color: 7, tileIndex: 9123, symidx: 12, glyphFlags: 16,
    });
    expect(tileUpdates.refreshTileVisualFromStateCache).toHaveBeenCalledTimes(2);
  });

  it("prevents stale map snapshots from resurrecting cleared loot until a fresh runtime item arrives", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { worldClassification: world, tileUpdates } = createWorldFixture();
    const object = GLYPH_CATALOG.find(entry => entry.kind === "obj")!;
    expect(object).toBeDefined();
    const item = { x: 4, y: 5, glyph: object.glyph, char: ")", color: 7, tileIndex: 999 };
    tileUpdates.tileStateCache.set("4,5", tileUpdates.buildTileStateSignatureFromPayload(item));
    world.applyUnderPlayerItemGlyphEvent({ ...item, kind: "obj" });
    world.clearUnderPlayerItemGlyphEvent({ x: 4, y: 5 });
    world.seedFlatFeatureUnderPlayerCacheFromPreviousState("4,5");
    world.seedTerrainCacheFromSupersededPendingUpdate("4,5", item, { x: 4, y: 5, glyph: 0, char: "@" });
    expect(world.flatFeatureUnderPlayerCache.has("4,5")).toBe(false);
    expect(world.suppressedLootLikeUnderPlayerCacheKeys.has("4,5")).toBe(true);

    world.applyUnderPlayerItemGlyphEvent({ ...item, tileIndex: 1000, kind: "obj" });
    expect(world.flatFeatureUnderPlayerCache.get("4,5")?.tileIndex).toBe(1000);
    expect(world.suppressedLootLikeUnderPlayerCacheKeys.has("4,5")).toBe(false);
  });
});

describe("level terrain restoration", () => {
  it("isolates cached state and restores shared state before applying newly observed tiles", () => {
    const { worldClassification: world, levelTerrainCache: levels, tileUpdates, tileRendering, darkCorridorInference } = createWorldFixture();
    levels.lastKnownTerrain.set("4,5", { glyph: 100, char: ".", tileIndex: 10 });
    world.flatFeatureUnderPlayerCache.set("4,5", { glyph: 200, kind: "obj", tileIndex: 20 });
    world.suppressedLootLikeUnderPlayerCacheKeys.add("6,5");
    tileUpdates.tileStateCache.set("4,5", "old signature");
    darkCorridorInference.inferredDarkCorridorWallTiles.set("3,5", { x: 3, y: 5 });
    const snapshot = levels.captureCurrentLevelTerrainCacheSnapshot();
    levels.upsertLevelTerrainCacheEntry("Dlvl:1", "entry-1", snapshot);
    const entry = levels.levelTerrainCachesByName.get("Dlvl:1")![0];

    levels.lastKnownTerrain.get("4,5")!.tileIndex = 11;
    world.flatFeatureUnderPlayerCache.get("4,5")!.tileIndex = 21;
    darkCorridorInference.inferredDarkCorridorWallTiles.get("3,5")!.x = 30;
    snapshot.lastKnownTerrain.get("4,5")!.tileIndex = 12;
    snapshot.flatFeatureUnderPlayerCache.get("4,5")!.tileIndex = 22;
    expect(entry.lastKnownTerrain.get("4,5")!.tileIndex).toBe(10);
    expect(entry.flatFeatureUnderPlayerCache.get("4,5")!.tileIndex).toBe(20);
    expect(entry.inferredDarkCorridorWallTiles.get("3,5")).toEqual({ x: 3, y: 5 });

    const order: string[] = [];
    vi.mocked(tileUpdates.refreshTilesFromStateCache).mockImplementation(() => {
      order.push("restore");
      expect(tileUpdates.tileStateCache.get("4,5")).toBe("old signature");
      expect(world.flatFeatureUnderPlayerCache.get("4,5")!.tileIndex).toBe(20);
    });
    tileRendering.updateTile.mockImplementation(() => order.push("observed"));
    const observed = { x: 4, y: 5, glyph: 300, char: "!", color: 2, tileIndex: 30 };
    levels.restoreLevelTerrainCacheEntry("Dlvl:1", entry, new Map([["4,5", observed]]));
    expect(order).toEqual(["restore", "observed"]);
    expect(tileUpdates.tileStateCache.get("4,5")).toBe(tileUpdates.buildTileStateSignatureFromPayload(observed));
    expect(world.suppressedLootLikeUnderPlayerCacheKeys.has("6,5")).toBe(true);
    expect(darkCorridorInference.inferredDarkCorridorTileFlags.has("3,5")).toBe(true);
    expect(levels.activeLevelCacheRef).toEqual({ levelName: "Dlvl:1", entryId: "entry-1" });
    world.flatFeatureUnderPlayerCache.get("4,5")!.tileIndex = 999;
    levels.lastKnownTerrain.get("4,5")!.tileIndex = 999;
    expect(entry.flatFeatureUnderPlayerCache.get("4,5")!.tileIndex).toBe(20);
    expect(entry.lastKnownTerrain.get("4,5")!.tileIndex).toBe(10);
  });
});

function createEntityFixture() {
  const world = createWorldFixture();
  const dependencies: RuntimeEntityTrackingDependencies = {
    entityBillboards: { shouldAnimateGlyphMoveTransitions: () => true, shouldAnimatePlayerBillboardsInFps: () => false, shouldShowPetHighlightHeart: () => false },
    entityMovement: { restoreTileVisualFromRememberedTerrain: vi.fn(), startRuntimeMonsterMoveTransition: vi.fn() },
    levelTerrainCache: world.levelTerrainCache,
    minimap: { minimapTrackedPlayerTileKey: null, queueRuntimeTrackedPlayerMinimapTile: vi.fn(), restoreMinimapTileFromRememberedTerrain: vi.fn() },
    movementInput: { isFpsMode: () => false },
    playerMovement: world.worldDependencies.playerMovement,
    tileUpdates: { hasExplicitPlayerVisual: (_behavior, char) => char === "@" },
    worldClassification: world.worldClassification,
  };
  return { tracking: new RuntimeEntityTracking(dependencies), dependencies };
}

describe("runtime entity batches", () => {
  it("keeps a vacated source until the same batch supplies its destination", () => {
    const { tracking, dependencies } = createEntityFixture();
    tracking.updateRuntimeMonsterTrackingFromTile({ x: 2, y: 3, glyph: 0, char: "a", monsterId: 7 });
    tracking.updateRuntimeMonsterTrackingFromTile({ x: 2, y: 3, glyph: 100, char: "." });
    expect(tracking.pendingRuntimeMonsterVacatedTileKeyById.get(7)).toBe("2,3");
    expect(tracking.runtimeMonsterIdByTileKey.has("2,3")).toBe(false);
    const arrival = { x: 3, y: 3, glyph: 0, char: "a", monsterId: 7 };
    tracking.updateRuntimeMonsterTrackingFromTile(arrival);
    tracking.finalizePendingRuntimeMonsterVacatedTracking();
    expect(dependencies.entityMovement.startRuntimeMonsterMoveTransition).toHaveBeenCalledWith(7, "2,3", "3,3", arrival);
    expect(tracking.runtimeMonsterTileKeyById.get(7)).toBe("3,3");
    expect(tracking.runtimeMonsterIdByTileKey.get("3,3")).toBe(7);
    expect(tracking.pendingRuntimeMonsterVacatedTileKeyById.size).toBe(0);
    tracking.updateRuntimeMonsterTrackingFromTile({ x: 3, y: 3, glyph: 100, char: "." });
    tracking.finalizePendingRuntimeMonsterVacatedTracking();
    expect(tracking.runtimeMonsterTileKeyById.has(7)).toBe(false);
    expect(tracking.resolveRuntimeMonsterLastSeenTileById(7)).toEqual({ x: 3, y: 3 });
  });

  it("treats entity zero as the player and updates the minimap at both ends of a move", () => {
    const { tracking, dependencies } = createEntityFixture();
    tracking.updateRuntimeMonsterTrackingFromTile({ x: 4, y: 5, glyph: 0, char: "@", monsterId: 0 });
    const moved = { x: 5, y: 5, glyph: 0, char: "@", monsterId: 0 };
    tracking.updateRuntimeMonsterTrackingFromTile(moved);
    expect(tracking.hasRuntimeTrackedPlayerEntitySupport()).toBe(true);
    expect(tracking.runtimeMonsterTileKeyById.get(0)).toBe("5,5");
    expect(tracking.normalizeRuntimeMonsterId(0)).toBe(null);
    expect(dependencies.minimap.minimapTrackedPlayerTileKey).toBe("5,5");
    expect(dependencies.minimap.restoreMinimapTileFromRememberedTerrain).toHaveBeenCalledWith("4,5");
    expect(dependencies.minimap.queueRuntimeTrackedPlayerMinimapTile).toHaveBeenLastCalledWith(moved);
  });
});
