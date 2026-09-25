import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultDarkFloorGlyph, getDefaultFloorGlyph } from "../../glyphs/behavior";
import { getGlyphCatalogRanges, setActiveGlyphCatalog } from "../../glyphs/registry";
import { DarkCorridorInference, type DarkCorridorInferenceDependencies } from "./dark-corridor-inference";
import { WorldClassification, type WorldClassificationDependencies } from "./world-classification";
import { TileUpdates, type TileUpdatesDependencies } from "./tile-updates";
import type { TerrainSnapshot } from "../../types";

afterEach(async () => {
  vi.unstubAllGlobals();
  await setActiveGlyphCatalog("3.6.7");
});

async function fixture(version: "3.6.7" | "5.0" | "slashem") {
  await setActiveGlyphCatalog(version);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  const levels = {
    lastKnownTerrain: new Map<string, TerrainSnapshot>(),
    getTileSnapshotFromStateCache: (key: string) => {
      const signature = updates.tileStateCache.get(key);
      return signature ? JSON.parse(signature) : null;
    },
    parseTileStateSignature: (signature: string) => JSON.parse(signature),
    parseTileKey: (key: string) => { const [x, y] = key.split(",").map(Number); return { x, y }; },
  };
  const tilesetAssets = { resolveRuntimeVersion: () => version, isVultureTilesActive: () => false };
  const player = { hasSeenPlayerPosition: true, playerPos: { x: 5, y: 5 } };
  const world = new WorldClassification({ levelTerrainCache: levels, tilesetAssets, playerMovement: player } as unknown as WorldClassificationDependencies);
  const tileMap = new Map<string, { userData: { isInferredDarkCorridorWall: boolean } }>();
  const rendering = {
    tileMap, tileRevealStartMs: new Map(), activeEffectTileKeys: new Set(),
    updateTile: vi.fn((x: number, y: number) => { tileMap.set(`${x},${y}`, { userData: { isInferredDarkCorridorWall: true } }); }),
  };
  const status = { statusConditionMask: 0 };
  const tileBatch = { beginTileBatch: vi.fn(), endTileBatch: vi.fn() };
  const updates = new TileUpdates({
    floorOcclusion: tileBatch, wallGeometry: tileBatch,
    camera: { fpsStepCameraActive: true },
    entityMovement: { activeEntityMoveTransitions: new Map([["player", {}]]) },
    get darkCorridorInference() { return inference; },
    worldClassification: world,
  } as unknown as TileUpdatesDependencies);
  updates.processPendingTileUpdate = vi.fn();
  const inference = new DarkCorridorInference({
    tileUpdates: updates, worldClassification: world, levelTerrainCache: levels,
    engineState: { characterCreationConfig: { runtimeVersion: version }, clientOptions: { darkCorridorWalls367: true } },
    playerMovement: player, playerStatus: status, tilesetAssets,
    terminalRendering: { isTerminalDisplayMode: () => false },
    tileRendering: rendering,
    minimap: { isValidMinimapCoordinate: (x: number, y: number) => x >= 0 && x < 80 && y >= 0 && y < 21, queueMinimapTileUpdate: vi.fn() },
    wallOverlays: new Proxy({}, { get: () => vi.fn() }),
    glyphTextures: { glyphOverlayMap: new Map() },
    entityBillboards: { removeMonsterBillboard: vi.fn() },
    wallGeometry: { refreshFpsWallChamferGeometryNear: vi.fn() },
    vultureWalls: { refreshVultureWallMaterialsNear: vi.fn() },
    renderPipeline: { scene: { remove: vi.fn() } },
    lighting: { markLightingDirty: vi.fn() },
  } as unknown as DarkCorridorInferenceDependencies);
  const corridor = version === "slashem" ? 3612 : getDefaultDarkFloorGlyph();
  const floor = getDefaultFloorGlyph();
  levels.lastKnownTerrain.set("5,5", { glyph: corridor, char: "#" });
  inference.beginDarkCorridorDiscoveryWindowFromPlayerInput();
  for (let x = 6; x <= 10; x++) updates.enqueueTileUpdate({ x, y: 5, glyph: corridor, char: "#" });
  return { updates, inference, rendering, levels, player, status, floor, corridor };
}

describe.each(["3.6.7", "slashem"] as const)("%s corridor observation timing", version => {
  it("reuses unchanged inferred walls across movement and rebuilds missing visuals", async () => {
    const f = await fixture(version);
    f.updates.flushPendingDarkCorridorInference(true);
    const previous = new Map(f.rendering.tileMap);
    expect(previous.size).toBeGreaterThan(0);
    f.rendering.updateTile.mockClear();
    f.updates.flushPendingDarkCorridorInference(true);
    expect(f.rendering.updateTile).not.toHaveBeenCalled();
    expect(f.rendering.tileMap).toEqual(previous);
    const [key] = previous.keys();
    f.rendering.tileMap.delete(key);
    f.updates.flushPendingDarkCorridorInference(true);
    expect(f.rendering.updateTile).toHaveBeenCalledOnce();
    expect(f.rendering.tileMap.has(key)).toBe(true);
  });

  it("refreshes inferred artwork on explicit invalidation without restarting reveal fades", async () => {
    const f = await fixture(version);
    f.updates.flushPendingDarkCorridorInference(true);
    const count = f.rendering.tileMap.size;
    f.rendering.updateTile.mockClear();
    f.inference.requestInferredDarkCorridorWallReconcile({ forceImmediate: true, refreshVisuals: true });
    expect(f.rendering.updateTile).toHaveBeenCalledTimes(count);
    for (const call of vi.mocked(f.rendering.updateTile).mock.calls) {
      expect((call as unknown[])[5]).toEqual({ inferredDarkCorridorWall: true, restartRevealFade: false });
    }
    f.rendering.updateTile.mockClear();
    f.updates.flushPendingDarkCorridorInference(true);
    expect(f.rendering.updateTile).not.toHaveBeenCalled();
  });

  it("rebuilds a replaced inferred mesh even when its coordinate is unchanged", async () => {
    const f = await fixture(version);
    f.updates.flushPendingDarkCorridorInference(true);
    const [key] = f.rendering.tileMap.keys();
    f.rendering.tileMap.set(key, { userData: { isInferredDarkCorridorWall: true } });
    f.rendering.updateTile.mockClear();
    f.updates.flushPendingDarkCorridorInference(true);
    expect(f.rendering.updateTile).toHaveBeenCalledOnce();
  });
  it("retains observed corridor terrain when a later actor covers it before cliparound", async () => {
    const f = await fixture(version);
    f.updates.pendingTileUpdates.clear();
    f.levels.lastKnownTerrain.clear();
    f.inference.newlyDiscoveredDarkCorridorTilesForCurrentInput.clear();
    const petGlyph = getGlyphCatalogRanges().find(range => range.kind === "pet")!.start;
    f.updates.enqueueTileUpdate({ x: 6, y: 5, glyph: f.corridor, char: "#" });
    f.updates.enqueueTileUpdate({ x: 6, y: 5, glyph: petGlyph, char: "d", monsterId: 46 });
    // The actor is the latest display, but must not erase observed terrain.
    expect(f.updates.pendingTileUpdates.get("6,5").glyph).toBe(petGlyph);
    expect(f.levels.lastKnownTerrain.get("6,5")?.glyph).toBe(f.corridor);
    f.player.playerPos = { x: 6, y: 5 };
    f.updates.flushPendingDarkCorridorInference(true);
    expect(f.rendering.tileMap.has("7,6")).toBe(true);
  });
  it("creates walls on each fast step before the terrain queue or animation finishes", async () => {
    const f = await fixture(version);
    for (let i = 0; i < 500; i++) f.updates.enqueueTileUpdate({ x: 30 + i % 50, y: 10 + Math.floor(i / 50), glyph: f.floor, char: "." });
    f.updates.flushPendingDarkCorridorInference();
    expect(f.inference.inferredDarkCorridorWallTiles.has("8,4")).toBe(true);
    expect(f.rendering.tileMap.has("8,4")).toBe(true);
    expect(f.inference.inferredDarkCorridorWallTiles.has("10,4")).toBe(false);
    expect(f.updates.processPendingTileUpdate).not.toHaveBeenCalled();
    expect(f.updates.pendingTileUpdates.size).toBe(505);
    expect(f.updates.tileStateCache.size).toBe(0);
    expect(f.levels.lastKnownTerrain.has("8,5")).toBe(false);

    f.player.playerPos = { x: 6, y: 5 };
    f.inference.beginDarkCorridorDiscoveryWindowFromPlayerInput();
    f.updates.enqueueTileUpdate({ x: 11, y: 5, glyph: f.corridor, char: "#" });
    f.updates.flushPendingDarkCorridorInference(true);
    expect(f.inference.inferredDarkCorridorWallTiles.has("10,4")).toBe(true);
    expect(f.rendering.tileMap.has("10,4")).toBe(true);
    expect(f.updates.processPendingTileUpdate).not.toHaveBeenCalled();
  });

  it("honors queued floors and clears a wall invalidated by newer authoritative data", async () => {
    const f = await fixture(version);
    f.updates.enqueueTileUpdate({ x: 7, y: 4, glyph: f.floor, char: "." });
    f.updates.flushPendingDarkCorridorInference();
    expect(f.rendering.tileMap.has("7,4")).toBe(false);
    expect(f.rendering.tileMap.has("8,4")).toBe(true);
    f.updates.enqueueTileUpdate({ x: 8, y: 4, glyph: f.floor, char: "." });
    f.updates.flushPendingDarkCorridorInference();
    expect(f.inference.inferredDarkCorridorWallTiles.has("8,4")).toBe(false);
    expect(f.rendering.tileMap.has("8,4")).toBe(false);
    expect(f.updates.pendingTileUpdates.has("8,4")).toBe(true);
  });

  it("keeps blindness suppression while evaluating pending data early", async () => {
    const f = await fixture(version);
    f.status.statusConditionMask = f.inference.resolveStatusConditionBlindMask();
    f.updates.flushPendingDarkCorridorInference();
    expect(f.rendering.updateTile).not.toHaveBeenCalled();
  });
});

it("keeps NetHack 5.0's native corridor rendering instead of enabling legacy inference", async () => {
  const f = await fixture("5.0");
  f.updates.flushPendingDarkCorridorInference();
  expect(f.rendering.updateTile).not.toHaveBeenCalled();
});
