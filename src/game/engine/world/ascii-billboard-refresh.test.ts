import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { classifyTileBehavior, GLYPH_CATALOG } from "../../glyphs";
import { PlayerMovement, type PlayerMovementDependencies } from "./player-movement";
import { TileUpdates, type TileUpdatesDependencies } from "./tile-updates";
import { WorldClassification } from "./world-classification";

const playerTile = { x: 4, y: 5, glyph: 0, char: "@", color: 15, monsterId: 0 };
const key = "4,5";

function fixture(mode: "ascii" | "tiles" = "ascii", fps = false) {
  const movementInput = { isFpsMode: () => fps };
  const camera = { fpsStepCameraActive: false, fpsStepCameraTargetTile: null };
  const player = new PlayerMovement({ movementInput, camera } as unknown as PlayerMovementDependencies);
  player.playerPos = { x: 4, y: 5 };
  player.hasSeenPlayerPosition = true;
  const billboards = new Map<string, THREE.Sprite>();
  const remove = vi.fn((tileKey: string) => { billboards.delete(tileKey); });
  const draw = vi.fn((x: number, y: number) => {
    const tileKey = `${x},${y}`;
    if (!billboards.has(tileKey)) billboards.set(tileKey, new THREE.Sprite());
  });
  const deferred = new Map();
  const classify = (tile: typeof playerTile) => classifyTileBehavior({
    glyph: tile.glyph, runtimeChar: tile.char, runtimeColor: tile.color,
  });
  const dependencies = {
    camera, movementInput,
    engineState: { clientOptions: { tilesetMode: mode } },
    playerMovement: player,
    entityBillboards: { monsterBillboards: billboards, removeMonsterBillboard: remove },
    entityMovement: { deferredEntityVisualUpdatesByKey: deferred },
    positionSelection: { isFpsFarLookViewActive: () => false },
    runtimeEntityTracking: { isRuntimeTrackedPlayerEntityId: (id: unknown) => id === 0 },
    tileRendering: { updateTile: draw },
    darkCorridorInference: { recordNewlyDiscoveredDarkCorridorTileForCurrentInput: vi.fn() },
    worldClassification: {
      classifyTilePayload: classify,
      isMonsterLikeBehavior: WorldClassification.prototype.isMonsterLikeBehavior,
      isLootLikeBehavior: WorldClassification.prototype.isLootLikeBehavior,
      shouldShowUnderPlayerFeaturesInOverheadTilesMode: () => false,
      seedFlatFeatureUnderPlayerCacheFromPreviousState: vi.fn(),
      getFpsPlayerTileBillboardBehaviorFromCache: () => null,
      shouldUseRaisedSpecialTileBillboardInTiles: () => false,
      isAltarOrTombstoneLikeBehavior: () => false,
    },
  } as unknown as TileUpdatesDependencies;
  const updates = new TileUpdates(dependencies);
  return { updates, billboards, remove, draw, deferred, classify };
}

describe("overhead ASCII duplicate tile refresh", () => {
  it("preserves the same player sprite on repeated post-action player updates", () => {
    const f = fixture();
    expect(f.classify(playerTile).effective.kind).toBe("mon");
    f.updates.processPendingTileUpdate(playerTile);
    const sprite = f.billboards.get(key);
    // Picking up loot or drying a fountain can redraw the unchanged player
    // glyph. The fast path must agree with the renderer's ASCII billboard rule.
    for (let i = 0; i < 3; i++) f.updates.processPendingTileUpdate({ ...playerTile });
    expect(f.billboards.get(key)).toBe(sprite);
    expect(f.remove).not.toHaveBeenCalled();
    expect(f.draw).toHaveBeenCalledOnce();
  });

  it("restores an absent ASCII sprite when the authoritative tile is unchanged", () => {
    const f = fixture();
    f.updates.processPendingTileUpdate(playerTile);
    f.billboards.delete(key);
    f.updates.processPendingTileUpdate({ ...playerTile });
    expect(f.billboards.has(key)).toBe(true);
    expect(f.draw).toHaveBeenCalledTimes(2);
  });

  it("preserves other raised ASCII entities as well as the player", () => {
    const f = fixture();
    const monster = { ...playerTile, x: 8, char: "a", monsterId: 7 };
    f.updates.processPendingTileUpdate(monster);
    const sprite = f.billboards.get("8,5");
    f.updates.processPendingTileUpdate({ ...monster });
    expect(f.billboards.get("8,5")).toBe(sprite);
  });

  it("still removes stale sprites when the authoritative tile is floor", () => {
    const f = fixture();
    const floorEntry = GLYPH_CATALOG.find(entry => entry.kind === "cmap" && entry.asciiChar === ".")!;
    const floor = { ...playerTile, glyph: floorEntry.glyph, char: ".", monsterId: -1 };
    f.updates.processPendingTileUpdate(floor);
    f.updates.processPendingTileUpdate({ ...floor });
    expect(f.billboards.has(key)).toBe(false);
  });

  it("does not bypass deferred entity movement updates", () => {
    const f = fixture();
    f.updates.processPendingTileUpdate(playerTile);
    const sprite = f.billboards.get(key);
    const waiting = { tile: null };
    f.deferred.set(key, waiting);
    const refreshed = { ...playerTile };
    f.updates.processPendingTileUpdate(refreshed);
    expect(waiting.tile).toBe(refreshed);
    expect(f.billboards.get(key)).toBe(sprite);
    expect(f.draw).toHaveBeenCalledOnce();
    expect(f.remove).not.toHaveBeenCalled();
  });

  it("retains FPS player suppression and overhead tiles behavior", () => {
    const fps = fixture("ascii", true);
    fps.updates.processPendingTileUpdate(playerTile);
    fps.updates.processPendingTileUpdate({ ...playerTile });
    expect(fps.billboards.has(key)).toBe(false);
    const tiles = fixture("tiles");
    tiles.updates.processPendingTileUpdate(playerTile);
    const sprite = tiles.billboards.get(key);
    tiles.updates.processPendingTileUpdate({ ...playerTile });
    expect(tiles.billboards.get(key)).toBe(sprite);
  });
});
