import * as THREE from "three";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } }));
import { createEngineSystems } from "../create-engine-systems";
import type { EngineCoordinator } from "../engine-coordinator";
import { getGlyphCatalogRanges } from "../../glyphs/registry";
import { classifyTileBehavior, getDefaultFloorGlyph } from "../../glyphs/behavior";

afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

describe("Vulture downward stairs", () => {
  it.each([24, 26])("raises cmap %s above a textured floor, including while occupied", cmap => {
    const s = createEngineSystems({} as EngineCoordinator);
    s.engineState.clientOptions.tilesetMode = "tiles";
    s.engineState.clientOptions.showItemsUnderPlayerInOverheadTilesMode = true;
    s.renderPipeline.scene = new THREE.Scene();
    vi.spyOn(s.tilesetAssets, "shouldUseVultureTiles").mockReturnValue(true);
    const texture = new THREE.CanvasTexture({} as HTMLCanvasElement);
    const createTexture = vi.spyOn(s.glyphTextures, "createTileTexture").mockReturnValue(texture);
    s.tilesetAssets.vultureTilesetTranslator = {
      resolveLookupForTile: () => ({ category: "floor", name: "FLOOR_MOSS_COVERED_0_0", projection: "iso_floor" }),
    } as unknown as NonNullable<typeof s.tilesetAssets.vultureTilesetTranslator>;
    const billboard = vi.spyOn(s.entityBillboards, "ensureMonsterBillboard").mockImplementation(() => {});
    vi.spyOn(s.vultureWalls, "refreshVultureWallMaterialsNear").mockImplementation(() => {});
    vi.spyOn(s.minimap, "queueMinimapTileUpdate").mockImplementation(() => {});
    const ranges = getGlyphCatalogRanges();
    const stairs = ranges.find(range => range.kind === "cmap")!.start + cmap;
    const player = ranges.find(range => range.kind === "mon")!.start;
    const behavior = classifyTileBehavior({ glyph: stairs, runtimeChar: ">", runtimeColor: 7, priorTerrain: null });
    expect(s.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(behavior)).toBe(true);
    s.tileRendering.updateTile(4, 5, stairs, ">", 7);
    const mesh = s.tileRendering.tileMap.get("4,5")!;
    expect(mesh.userData.tileTextureSourceGlyph).toBe(getDefaultFloorGlyph());
    expect(createTexture.mock.calls.some(call => call[3]?.sourceGlyph === getDefaultFloorGlyph())).toBe(true);
    expect(billboard.mock.calls.some(call => call[0] === "4,5" && call[8] === stairs)).toBe(true);
    billboard.mockClear();
    s.playerMovement.playerPos = { x: 4, y: 5 };
    s.playerMovement.hasSeenPlayerPosition = true;
    s.tileRendering.updateTile(4, 5, player, "@", 15, { runtimeTrackedEntityId: 0 });
    expect(mesh.userData.tileTextureSourceGlyph).toBe(getDefaultFloorGlyph());
    expect(billboard.mock.calls.some(call => call[0] === "4,5|underlay-feature" && call[8] === stairs)).toBe(true);
    s.playerMovement.playerPos = { x: 5, y: 5 };
    billboard.mockClear();
    s.tileRendering.updateTile(4, 5, stairs, ">", 7);
    expect(mesh.userData.tileTextureSourceGlyph).toBe(getDefaultFloorGlyph());
    expect(billboard.mock.calls.some(call => call[0] === "4,5" && call[8] === stairs)).toBe(true);
    vi.mocked(s.tilesetAssets.shouldUseVultureTiles).mockReturnValue(false);
    expect(s.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(behavior)).toBe(false);
  });
});
