import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VultureWalls, type VultureWallsDependencies } from "./vulture-walls";
import { WallOverlays, type WallOverlaysDependencies } from "./wall-overlays";
import { getGlyphCatalogEntry, getGlyphCatalogRanges, setActiveGlyphCatalog } from "../../glyphs/registry";
import type { VultureWallFaceSlot } from "../shared/types";

beforeEach(async () => { await setActiveGlyphCatalog("3.6.7"); });

function fixture(cmap: number, floors: VultureWallFaceSlot[]) {
  const glyph = getGlyphCatalogRanges().find(range => range.kind === "cmap")!.start + cmap;
  const mesh = new THREE.Mesh(); mesh.userData.tileTextureSourceGlyph = glyph;
  const tileMap = new Map([["4,5", mesh]]);
  const snapshot = vi.fn(() => null as { glyph: number; symidx: number } | null);
  const walls = new VultureWalls({
    tileRendering: { tileMap },
    levelTerrainCache: { getTileSnapshotFromStateCache: snapshot },
  } as unknown as VultureWallsDependencies);
  // Lookups stand for visible ordinary-floor neighbors, independently of the
  // asset translator. Exercise the actual face selection and suffix mapping.
  vi.spyOn(walls, "resolveVultureWallNeighborFaceLookup").mockImplementation(face => floors.includes(face)
    ? { category: "wall", name: `WALL_ROUGH_F_${face[0].toUpperCase()}`, projection: "sprite", wallFace: face }
    : null);
  vi.spyOn(walls, "isVultureDoorwayNeighborFloor").mockReturnValue(false);
  const char = walls.resolveWallOrientationChar(String.fromCodePoint(getGlyphCatalogEntry(glyph)!.ch), glyph);
  return { walls, mesh, glyph, snapshot, tileMap, config: () => walls.resolveVultureWallPlaneRenderConfig(4, 5, "wall", char) };
}

describe("Vulture corner and junction wall faces", () => {
  it.each([
    ["east", "north"], ["east", "south"],
    ["west", "north"], ["west", "south"],
  ] as VultureWallFaceSlot[][])("renders both inferred cave bend faces %s/%s", (first, second) => {
    const f = fixture(0, [first, second]);
    f.mesh.userData.isInferredDarkCorridorWall = true;
    const config = f.config();
    expect(config?.slices.map(slice => slice.direction).sort()).toEqual([first, second].sort());
    expect(config?.slices).toHaveLength(2);
  });

  it("does not infer a cave face from diagonal floor across an unmapped edge", () => {
    const f = fixture(0, []);
    f.mesh.userData.isInferredDarkCorridorWall = true;
    vi.mocked(f.walls.resolveVultureWallNeighborFaceLookup).mockImplementation((face, _wx, _wy, fx, fy) =>
      fx === 5 && fy === 6
        ? { category: "wall", name: "WALL_ROUGH_F_E", projection: "sprite", wallFace: face }
        : null);
    expect(f.config()).toBeNull();
  });

  it.each([
    [3, ["east", "south"]], [4, ["west", "south"]],
    [5, ["east", "north"]], [6, ["west", "north"]],
    [7, ["east", "west", "north", "south"]],
    [8, ["east", "west", "north"]], [9, ["east", "west", "south"]],
    [10, ["east", "north", "south"]], [11, ["west", "north", "south"]],
  ] as [number, VultureWallFaceSlot[]][])("keeps every exposed face for semantic wall %s despite its ASCII character", (cmap, floors) => {
    const f = fixture(cmap, floors);
    const config = f.config()!;
    expect(config.slices.map(slice => slice.direction).sort()).toEqual([...floors].sort());
    for (const slice of config.slices) {
      const ew = slice.direction === "east" || slice.direction === "west";
      expect(slice.innerLookup.name).toBe(`WALL_ROUGH_F_${ew ? "E" : "S"}`);
      expect(slice.outerLookup.name).toBe(`WALL_ROUGH_F_${ew ? "W" : "N"}`);
    }
  });

  it("renders an east-only corner that used to have no wall geometry", () => {
    expect(fixture(3, ["east"]).config()?.slices.map(slice => slice.direction)).toEqual(["east"]);
  });

  it.each([
    [3, 1, 1, ["east", "south"]], [4, -1, 1, ["west", "south"]],
    [5, 1, -1, ["east", "north"]], [6, -1, -1, ["west", "north"]],
  ] as [number, number, number, VultureWallFaceSlot[]][])("keeps hidden faces hidden when corner %s has only diagonal floor", (cmap, dx, dy) => {
    const f = fixture(cmap, []);
    vi.mocked(f.walls.resolveVultureWallNeighborFaceLookup).mockImplementation((face, _wx, _wy, fx, fy) =>
      fx === 4 + dx && fy === 5 + dy
        ? { category: "wall", name: `WALL_ROUGH_F_${face[0].toUpperCase()}`, projection: "sprite", wallFace: face }
        : null);
    expect(f.config()).toBeNull();
  });

  it("does not invent wall surfaces when all neighboring floors are unknown", () => {
    expect(fixture(3, []).config()).toBeNull();
  });

  it("renders only direct floor faces and leaves straight walls unchanged", () => {
    for (const cmap of [3, 2]) {
      const f = fixture(cmap, []);
      vi.mocked(f.walls.resolveVultureWallNeighborFaceLookup).mockImplementation((face, _wx, _wy, fx, fy) => {
        const style = fx === 5 && fy === 5 ? "BRICK" : fx === 5 && fy === 6 ? "ROUGH" : null;
        return style ? { category: "wall", name: `WALL_${style}_F_${face[0].toUpperCase()}`, projection: "sprite", wallFace: face } : null;
      });
      const config = f.config();
      if (cmap === 2) expect(config).toBeNull();
      else {
        expect(config?.slices.map(slice => slice.direction)).toEqual(["east"]);
        expect(config?.slices[0].innerLookup.name).toBe("WALL_BRICK_F_E");
      }
    }
  });

  it("does not create diagonal dependencies when floor arrives later", () => {
    const f = fixture(3, []);
    const straight = new THREE.Mesh();
    straight.userData.tileTextureSourceGlyph = f.glyph - 1;
    f.tileMap.set("6,5", straight);
    vi.spyOn(f.walls, "shouldUseVultureWallFaceRendering").mockReturnValue(true);
    vi.spyOn(f.walls, "scheduleVultureWallMaterialRefresh").mockImplementation(() => {});
    const refresh = vi.spyOn(f.walls, "refreshVultureWallMaterialAt").mockImplementation(() => {});
    f.walls.refreshVultureWallMaterialsNear(5, 6);
    f.walls.refreshVultureWallMaterialsNear(5, 6);
    expect(f.walls.pendingVultureWallMaterialRefreshKeys.has("4,5")).toBe(false);
    expect(f.walls.pendingVultureWallMaterialRefreshKeys.has("6,5")).toBe(false);
    expect(f.walls.pendingVultureWallMaterialRefreshKeys.size).toBe(5);
    f.walls.flushPendingVultureWallMaterialRefreshes();
    expect(refresh.mock.calls.filter(([x, y]) => x === 4 && y === 5)).toHaveLength(0);
    expect(f.walls.pendingVultureWallMaterialRefreshKeys.size).toBe(0);
  });

  it("places corner face pairs on distinct exposed edges with opposite outward normals", () => {
    const f = fixture(7, ["east", "west", "north", "south"]);
    const overlays = new WallOverlays({} as WallOverlaysDependencies);
    const normals = { east: [1, 0, 0], west: [-1, 0, 0], north: [0, 1, 0], south: [0, -1, 0] };
    const centers = new Set<string>();
    for (const config of f.config()!.slices) {
      const slice = overlays.ensureVultureWallPlaneSlice(f.mesh, config.direction);
      overlays.applyVultureWallPlaneSliceTransform(slice, config.direction);
      const expected = new THREE.Vector3().fromArray(normals[config.direction]);
      const geometryNormal = new THREE.Vector3().fromBufferAttribute(overlays.vultureWallPlaneGeometry.getAttribute("normal"), 0);
      const frontNormal = geometryNormal.clone().applyQuaternion(slice.frontMesh.quaternion);
      const backNormal = geometryNormal.clone().applyQuaternion(slice.backMesh.quaternion);
      expect(frontNormal.dot(expected)).toBeCloseTo(1);
      expect(frontNormal.dot(backNormal)).toBeCloseTo(-1);
      expect(slice.frontMesh.position.dot(expected)).toBeCloseTo(0.497);
      expect(slice.frontMesh.position).toEqual(slice.backMesh.position);
      centers.add(slice.frontMesh.position.toArray().join(","));
    }
    expect(centers.size).toBe(4);
    overlays.vultureWallPlaneGeometry.dispose(); overlays.vultureDoorPlaneGeometry.dispose();
    overlays.transparentWallGroundPlaneGeometry.dispose(); overlays.vultureInvisibleSurfaceMaterial.dispose();
  });

  it("prefers matching live symbol metadata and ignores metadata from a different glyph", () => {
    const f = fixture(2, ["east"]); // A horizontal catalog wall alone would hide the east face.
    expect(f.config()).toBeNull();
    f.snapshot.mockReturnValue({ glyph: f.glyph, symidx: 3 });
    expect(f.config()?.slices.map(slice => slice.direction)).toEqual(["east"]);
    f.snapshot.mockReturnValue({ glyph: f.glyph + 1, symidx: 3 });
    expect(f.config()).toBeNull();
  });

  it.each([1, 2])("preserves straight wall %s and its doorway cross-axis faces", cmap => {
    const f = fixture(cmap, ["east", "west", "north", "south"]);
    expect(f.config()?.slices.map(slice => slice.direction).sort())
      .toEqual(cmap === 1 ? ["east", "west"] : ["north", "south"]);
    vi.mocked(f.walls.isVultureDoorwayNeighborFloor).mockReturnValue(true);
    expect(f.config()?.slices.map(slice => slice.direction).sort()).toEqual(["east", "north", "south", "west"]);
  });
});
