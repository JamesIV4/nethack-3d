import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { TileNeighborBatch } from "./tile-neighbor-batch";
import { FloorOcclusion, type FloorOcclusionDependencies } from "./floor-occlusion";
import { WallGeometry, type WallGeometryDependencies } from "./wall-geometry";

describe("derived tile neighborhood batches", () => {
  it("deduplicates final work, preserves nested boundaries and can flush before actor snapshots", () => {
    const applied: string[] = [], batch = new TileNeighborBatch((x, y) => applied.push(`${x},${y}`));
    batch.update(0, 0); expect(applied).toEqual(["0,0"]); applied.length = 0;
    batch.begin(); batch.begin();
    batch.update(1, 1); batch.update(1, 1); batch.update(2, 1);
    batch.end(); expect(applied).toEqual([]);
    batch.flush(); expect(applied).toEqual(["1,1", "2,1"]);
    expect(batch.active).toBe(true);
    batch.update(1, 1); batch.end(); expect(applied).toEqual(["1,1", "2,1", "1,1"]);
    expect(batch.active).toBe(false);
  });

  it("does not leave batching enabled after a failed final flush", () => {
    const apply = vi.fn<(x: number, y: number) => void>(() => { throw new Error("texture failed"); }), batch = new TileNeighborBatch(apply);
    batch.begin(); batch.update(1, 2);
    expect(() => batch.end()).toThrow("texture failed"); expect(batch.active).toBe(false);
    apply.mockImplementation(() => {}); batch.update(3, 4);
    expect(apply).toHaveBeenLastCalledWith(3, 4);
  });

  it("rebuilds each FPS chamfer and door trim once after a discovered region settles", () => {
    const wall = new WallGeometry({} as WallGeometryDependencies);
    vi.spyOn(wall, "shouldUseChamferedWallGeometry").mockReturnValue(true);
    const chamfers = vi.spyOn(wall, "refreshFpsWallChamferGeometryAt").mockImplementation(() => {});
    const doors = vi.spyOn(wall, "applyFpsClosedDoorChamferTransformAt").mockImplementation(() => {});
    wall.beginTileBatch();
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) wall.refreshFpsWallChamferGeometryNear(x, y);
    expect(chamfers).not.toHaveBeenCalled(); expect(doors).not.toHaveBeenCalled();
    wall.endTileBatch();
    expect(chamfers).toHaveBeenCalledTimes(144); // formerly 900
    expect(doors).toHaveBeenCalledTimes(196); // formerly 2500
    expect(Math.max(...chamfers.mock.invocationCallOrder)).toBeLessThan(Math.min(...doors.mock.invocationCallOrder));
    wall.wallGeometry.dispose();
  });

  it("preserves final contact-shadow masks, transforms and removals", () => {
    function run(batched: boolean) {
      const tileMap = new Map<string, THREE.Mesh>(), scene = new THREE.Scene(), floorGeometry = new THREE.PlaneGeometry();
      const floor = new FloorOcclusion({
        engineState: { clientOptions: { blockAmbientOcclusion: true } },
        movementInput: { isFpsMode: () => false }, renderPipeline: { scene },
        tileRendering: { tileMap, floorGeometry, tileVisualScaleFps: 1 },
        wallGeometry: { fpsWallChamferFloorMeshes: new Map(), getFpsClosedDoorChamferTransform: () => null },
        lighting: { patchMaterialForVignette() {} },
      } as unknown as FloorOcclusionDependencies);
      const textures = new Map<string, THREE.Texture>();
      vi.spyOn(floor, "getFloorBlockAmbientOcclusionTexture").mockImplementation((...masks) => {
        const key = masks.join(":"); let texture = textures.get(key);
        if (!texture) { texture = new THREE.Texture(); texture.userData.mask = key; textures.set(key, texture); }
        return texture as THREE.CanvasTexture;
      });
      const compute = vi.spyOn(floor, "computeFloorBlockAmbientOcclusionMasks");
      if (batched) floor.beginTileBatch();
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
        const tile = new THREE.Mesh(floorGeometry); tile.position.set(x, -y, 0);
        tile.userData.isWall = x === 0 || y === 0 || x === 9 || y === 9;
        tileMap.set(`${x},${y}`, tile); floor.refreshFloorBlockAmbientOcclusionNear(x, y);
      }
      // A wall disappears in the same batch; its former contact shadow must go.
      tileMap.get("0,4")!.userData.isWall = false; floor.refreshFloorBlockAmbientOcclusionNear(0, 4);
      if (batched) floor.endTileBatch();
      const output = [...floor.floorBlockAmbientOcclusionOverlays].map(([key, mesh]) => ({ key,
        mask: (mesh.material as THREE.MeshBasicMaterial).map!.userData.mask,
        position: mesh.position.toArray(), scale: mesh.scale.toArray(), order: mesh.renderOrder,
      })).sort((a, b) => a.key.localeCompare(b.key));
      const count = compute.mock.calls.length;
      floor.clearFloorBlockAmbientOcclusion(); floorGeometry.dispose(); textures.forEach(texture => texture.dispose());
      return { output, count };
    }
    const before = run(false), after = run(true);
    expect(after.output).toEqual(before.output);
    expect(after.count).toBeLessThan(before.count / 3);
  });
});
