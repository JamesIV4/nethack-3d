import * as THREE from "three";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } }));
import { createEngineSystems } from "../create-engine-systems";
import type { EngineCoordinator } from "../engine-coordinator";
import { getGlyphCatalogRanges } from "../../glyphs/registry";
import { getDefaultFloorGlyph } from "../../glyphs/behavior";
import { normalizeNh3dClientOptions } from "../../ui-types";
import { usesTerrainTiles, usesTileTextures } from "../../terrain-tile-options";

afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

function fixture(walls: boolean, floors: boolean, fps: boolean) {
  const s = createEngineSystems({} as EngineCoordinator);
  Object.assign(s.engineState.clientOptions, {
    tilesetMode: "ascii", asciiTilesForWalls: walls, asciiTilesForFloors: floors,
    darkCorridorWallSolidColorOverrideEnabled: false,
    blockAmbientOcclusion: false,
  });
  s.engineState.playMode = fps ? "fps" : "normal";
  s.renderPipeline.scene = new THREE.Scene();
  s.camera.camera = new THREE.PerspectiveCamera();
  const texture = (name: string) => {
    const texture = new THREE.CanvasTexture({ width: 64, height: 64 } as HTMLCanvasElement);
    texture.name = name;
    return texture;
  };
  vi.spyOn(s.glyphTextures, "createTileTexture").mockImplementation(() => texture("tile"));
  vi.spyOn(s.glyphTextures, "createGlyphTexture").mockImplementation(() => texture("ascii"));
  vi.spyOn(s.entityBillboards, "createMonsterBillboardTexture").mockImplementation(() => texture("ascii-billboard"));
  vi.spyOn(s.entityBillboards, "ensureEntityBlobShadowTexture").mockImplementation(() => texture("shadow"));
  vi.spyOn(s.minimap, "queueMinimapTileUpdate").mockImplementation(() => {});
  return s;
}

describe("3D ASCII terrain tiles", () => {
  it.each([false, true].flatMap(fps => [false, true].flatMap(walls => [false, true].map(floors => ({ fps, walls, floors })))))
    ("independent wall=$walls floor=$floors choices in fps=$fps keep actors and items ASCII", ({ fps, walls, floors }) => {
      const s = fixture(walls, floors, fps);
      const wall = getGlyphCatalogRanges().find(range => range.kind === "cmap")!.start + 1;
      s.tileRendering.updateTile(10, 8, wall, "|");
      s.tileRendering.updateTile(11, 8, getDefaultFloorGlyph(), ".");
      expect(s.glyphTextures.glyphOverlayMap.get("10,8")!.texture!.name).toBe(walls ? "tile" : "ascii");
      expect(s.glyphTextures.glyphOverlayMap.get("11,8")!.texture!.name).toBe(floors ? "tile" : "ascii");
      for (const [i, kind] of ["mon", "obj"].entries()) {
        const glyph = getGlyphCatalogRanges().find(range => range.kind === kind)!.start;
        const key = `${12 + i},8`;
        s.levelTerrainCache.lastKnownTerrain.set(key, { glyph: getDefaultFloorGlyph(), char: ".", color: 7 });
        s.tileRendering.updateTile(12 + i, 8, glyph);
        expect(s.glyphTextures.glyphOverlayMap.get(key)!.texture!.name).toBe(floors ? "tile" : "ascii");
        expect(s.entityBillboards.monsterBillboards.get(key)!.material.map!.name).toBe("ascii-billboard");
      }
      // Disabling the choices must replace already-rendered tile textures.
      s.engineState.clientOptions.asciiTilesForWalls = false;
      s.engineState.clientOptions.asciiTilesForFloors = false;
      s.tileRendering.updateTile(10, 8, wall, "|");
      s.tileRendering.updateTile(11, 8, getDefaultFloorGlyph(), ".");
      expect(s.glyphTextures.glyphOverlayMap.get("10,8")!.texture!.name).toBe("ascii");
      expect(s.glyphTextures.glyphOverlayMap.get("11,8")!.texture!.name).toBe("ascii");
    });

  it("preserves special feature glyphs and leaves terminal mode alone", () => {
    const options = normalizeNh3dClientOptions({ tilesetMode: "ascii", asciiTilesForWalls: true, asciiTilesForFloors: true });
    for (const kind of ["stairs_up", "stairs_down", "fountain", "trap", "feature", "item", "monster_hostile"] as const) {
      expect(usesTerrainTiles(options, false, kind)).toBe(false);
    }
    options.tilesetMode = "terminal";
    expect(usesTileTextures(options)).toBe(false);
    expect(usesTerrainTiles(options, true, "wall")).toBe(false);
    expect(usesTerrainTiles(options, false, "floor")).toBe(false);
  });

  it("defaults off and preserves saved choices across display modes", () => {
    expect(normalizeNh3dClientOptions()).toMatchObject({ asciiTilesForWalls: false, asciiTilesForFloors: false });
    expect(normalizeNh3dClientOptions({ tilesetMode: "tiles", asciiTilesForWalls: true, asciiTilesForFloors: false }))
      .toMatchObject({ asciiTilesForWalls: true, asciiTilesForFloors: false });
  });

  it("refreshes mixed terrain after Vulture assets become ready", () => {
    const s = fixture(true, false, false);
    vi.spyOn(s.tilesetAssets, "invalidateTilesetDependentCaches").mockImplementation(() => {});
    vi.spyOn(s.menuPreviews, "clearMenuTilePreviewCache").mockImplementation(() => {});
    vi.spyOn(s.menuPreviews, "refreshMenuTilePreviewStateForUi").mockImplementation(() => {});
    const refresh = vi.spyOn(s.tileUpdates, "refreshTilesFromStateCache").mockImplementation(() => {});
    s.tilesetAssets.handleVultureTilesetAssetReady();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
