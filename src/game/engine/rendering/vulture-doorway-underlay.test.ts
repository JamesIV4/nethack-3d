import * as THREE from "three";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } }));
import { createEngineSystems } from "../create-engine-systems";
import type { EngineCoordinator } from "../engine-coordinator";
import { getGlyphCatalogRanges } from "../../glyphs/registry";
import { classifyTileBehavior, getDefaultFloorGlyph } from "../../glyphs/behavior";

afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

describe("Vulture occupied doorway terrain", () => {
  it.each([12, 13, 14])("keeps remembered doorway cmap %s beneath an entering player", cmap => {
    const s = createEngineSystems({} as EngineCoordinator);
    s.engineState.clientOptions.tilesetMode = "tiles";
    s.renderPipeline.scene = new THREE.Scene();
    vi.spyOn(s.tilesetAssets, "shouldUseVultureTiles").mockReturnValue(true);
    vi.spyOn(s.glyphTextures, "createTileTexture").mockImplementation(() => new THREE.CanvasTexture({} as HTMLCanvasElement));
    const roughFloor = { category: "floor", name: "FLOOR_ROUGH_0_1", projection: "iso_floor" } as const;
    s.tilesetAssets.vultureTilesetTranslator = {
      resolveLookupForTile: ({ materialKind }: { materialKind: string }) => materialKind === "door"
        ? { category: "misc", name: "open_door", projection: "sprite" }
        : roughFloor,
      resolveDoorwayFloorLookup: () => roughFloor,
    } as unknown as NonNullable<typeof s.tilesetAssets.vultureTilesetTranslator>;
    vi.spyOn(s.entityBillboards, "ensureMonsterBillboard").mockImplementation(() => {});
    vi.spyOn(s.vultureWalls, "refreshVultureWallMaterialsNear").mockImplementation(() => {});
    vi.spyOn(s.minimap, "queueMinimapTileUpdate").mockImplementation(() => {});
    const ranges = getGlyphCatalogRanges();
    const door = ranges.find(range => range.kind === "cmap")!.start + cmap;
    const player = ranges.find(range => range.kind === "mon")!.start;
    const doorChar = cmap === 12 ? "." : cmap === 13 ? "|" : "-";
    expect(classifyTileBehavior({ glyph: door, runtimeChar: doorChar, runtimeColor: 3, priorTerrain: null }).materialKind).toBe(cmap === 12 ? "floor" : "door");
    s.tileRendering.updateTile(4, 5, door, doorChar, 3);
    const originalMesh = s.tileRendering.tileMap.get("4,5")!;
    const originalDoorOverlay = originalMesh.userData.vultureDoorPlaneOverlay;
    const originalFloorTexture = originalDoorOverlay?.floorMaterial.map;
    s.playerMovement.playerPos = { x: 4, y: 5 };
    s.playerMovement.hasSeenPlayerPosition = true;
    s.tileRendering.updateTile(4, 5, player, "@", 15, { runtimeTrackedEntityId: 0 });
    const mesh = s.tileRendering.tileMap.get("4,5")!;
    expect(s.levelTerrainCache.lastKnownTerrain.get("4,5")?.glyph).toBe(door);
    expect(mesh.userData.tileTextureSourceGlyph).toBe(door);
    expect(s.vultureWalls.isVultureDoorwayNeighborFloor(4, 5)).toBe(true);
    expect(mesh.position.toArray()).toEqual([4, -5, 0]);
    expect(mesh).toBe(originalMesh);
    const billboardCalls = vi.mocked(s.entityBillboards.ensureMonsterBillboard).mock.calls;
    expect(billboardCalls.some(call => call[0] === "4,5" && call[8] === player)).toBe(true);
    expect(billboardCalls.some(call => call[8] === door)).toBe(false);
    if (cmap !== 12) {
      expect(mesh.userData.vultureDoorPlaneOverlay).toBe(originalDoorOverlay);
      expect(originalDoorOverlay.floorMaterial.map).toBe(originalFloorTexture);
      expect(originalDoorOverlay.floorTextureKey).toContain("FLOOR_ROUGH_0_1");
      mesh.updateMatrixWorld(true);
      const floorCenter = originalDoorOverlay.floorMesh.getWorldPosition(new THREE.Vector3());
      expect(floorCenter.x).toBe(4); expect(floorCenter.y).toBe(-5); expect(floorCenter.z).toBeCloseTo(0.003);
      expect(originalDoorOverlay.frontMesh.parent).toBe(mesh);
      expect(originalDoorOverlay.backMesh.parent).toBe(mesh);
    }
    s.playerMovement.playerPos = { x: 5, y: 5 };
    s.tileRendering.updateTile(4, 5, door, doorChar, 3);
    expect(mesh.userData.tileTextureSourceGlyph).toBe(door);
    expect(s.vultureWalls.isVultureDoorwayNeighborFloor(4, 5)).toBe(true);
    if (cmap !== 12) expect(mesh.userData.vultureDoorPlaneOverlay).toBe(originalDoorOverlay);
    // Ordinary atlas tiles retain their established canonical floor treatment.
    vi.mocked(s.tilesetAssets.shouldUseVultureTiles).mockReturnValue(false);
    s.playerMovement.playerPos = { x: 4, y: 5 };
    s.tileRendering.updateTile(4, 5, player, "@", 15, { runtimeTrackedEntityId: 0 });
    expect(mesh.userData.tileTextureSourceGlyph).toBe(getDefaultFloorGlyph());
  });
});
