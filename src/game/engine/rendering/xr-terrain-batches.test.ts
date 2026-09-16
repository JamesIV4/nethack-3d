import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { XrTerrainBatches } from "./xr-terrain-batches";
import { WorldClipCulling } from "./world-clip-culling";
import { tabletopClippingPlanes } from "./webxr-rig";

function fixture() {
  const scene = new THREE.Scene(), tracking = new THREE.Group(), floorGeometry = new THREE.PlaneGeometry();
  scene.add(tracking);
  const tiles = new Map<string, THREE.Mesh>(), overlays = new Map<string, { material: THREE.Material }>();
  const alpha = new Uint8ClampedArray([255, 255, 255, 255]);
  const read = vi.fn(() => ({ data: alpha }));
  const image = { width: 1, height: 1, getContext: () => ({ getImageData: read }) } as unknown as HTMLCanvasElement;
  const texture = new THREE.CanvasTexture(image);
  const compile: THREE.Material["onBeforeCompile"] = () => {};
  const addFloor = (x: number, kind = "floor") => {
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    material.onBeforeCompile = compile; material.customProgramCacheKey = () => "test-vignette";
    const mesh = new THREE.Mesh(floorGeometry, material); mesh.position.x = x;
    mesh.userData = { materialKind: kind, isWall: false };
    const key = String(x); tiles.set(key, mesh); overlays.set(key, { material }); scene.add(mesh);
    return mesh;
  };
  const owner = new XrTerrainBatches(), culling = new WorldClipCulling();
  const renderer = { clippingPlanes: tabletopClippingPlanes(new THREE.Vector3(), 1), render: vi.fn() };
  const render = () => owner.render(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera(), tracking, tiles, floorGeometry, overlays, culling);
  const visibleBatches = () => scene.getObjectByName("XR terrain draw batches")!.children.filter(o => o.visible) as THREE.InstancedMesh[];
  return { owner, scene, tiles, overlays, renderer, render, addFloor, visibleBatches, read, alpha, texture, compile };
}

describe("temporary XR terrain instances", () => {
  it("batches proven opaque floors, preserves shader hooks and restores original objects for input", () => {
    const f = fixture(), a = f.addFloor(0), b = f.addFloor(1), outside = f.addFloor(30);
    const sources = [...f.tiles.values()].map(o => [o.geometry, o.material]);
    f.scene.scale.x = 0.6;
    f.renderer.render.mockImplementation(() => {
      const batches = f.visibleBatches(); expect(batches).toHaveLength(1);
      expect(batches[0].count).toBe(2);
      expect(batches[0].matrixWorld.elements[0]).toBe(0.6);
      const matrix = new THREE.Matrix4(); batches[0].getMatrixAt(1, matrix);
      expect(matrix.equals(b.matrix)).toBe(true);
      expect((batches[0].material as THREE.Material).transparent).toBe(false);
      expect((batches[0].material as THREE.Material).onBeforeCompile).toBe(f.compile);
      expect(a.layers.mask).toBe(0); expect(b.layers.mask).toBe(0); expect(outside.layers.mask).toBe(0);
    });
    f.render(); f.render();
    expect(f.read).toHaveBeenCalledOnce();
    expect([...f.tiles.values()].map(o => [o.geometry, o.material])).toEqual(sources);
    expect(a.material.transparent).toBe(true);
    expect(a.layers.mask).toBe(1); expect(outside.layers.mask).toBe(1);
    expect(f.scene.getObjectByName("XR terrain draw batches")!.visible).toBe(false);
    f.owner.dispose();
  });

  it("falls back for fades, alpha textures, special terrain, and changed texture revisions", () => {
    const f = fixture(), a = f.addFloor(0), b = f.addFloor(1), water = f.addFloor(2, "water");
    a.material.opacity = 0.5;
    f.renderer.render.mockImplementation(() => {
      expect(f.visibleBatches()).toHaveLength(0);
      expect(a.layers.mask).toBe(1); expect(b.layers.mask).toBe(1); expect(water.layers.mask).toBe(1);
    });
    f.render();
    a.material.opacity = 1; f.alpha[3] = 100; f.texture.needsUpdate = true;
    f.render(); expect(f.read).toHaveBeenCalledTimes(2);
    f.alpha[3] = 255; f.texture.source.needsUpdate = true;
    f.renderer.render.mockImplementation(() => { expect(f.visibleBatches()).toHaveLength(1); expect(water.layers.mask).toBe(1); });
    f.render(); expect(f.read).toHaveBeenCalledTimes(3);
    f.owner.dispose();
  });

  it("instances shared solid walls and removes textured undersides only during rendering", () => {
    const f = fixture(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshLambertMaterial();
    const walls = [0, 1, 2].map(x => {
      const mesh = new THREE.Mesh(geometry, x === 2 ? Array(6).fill(material) : material);
      mesh.position.x = x; mesh.userData.isWall = true; f.tiles.set(String(x), mesh); f.scene.add(mesh); return mesh;
    });
    f.renderer.render.mockImplementation(() => {
      expect(f.visibleBatches()).toHaveLength(1); expect(f.visibleBatches()[0].count).toBe(2);
      expect(f.visibleBatches()[0].geometry.index!.count).toBe(30);
      expect(walls[2].geometry.groups).toHaveLength(1); expect(walls[2].layers.mask).toBe(1);
    });
    f.render();
    for (const wall of walls) expect(wall.geometry).toBe(geometry);
    const geometryDisposed = vi.spyOn(geometry, "dispose"), materialDisposed = vi.spyOn(material, "dispose");
    f.owner.dispose();
    expect(geometryDisposed).not.toHaveBeenCalled(); expect(materialDisposed).not.toHaveBeenCalled();
  });

  it("drops stale batches on level changes, disposes owned resources and restores after errors", () => {
    const f = fixture(), a = f.addFloor(0); f.addFloor(1);
    let owned: THREE.Material;
    f.renderer.render.mockImplementation(() => { owned = f.visibleBatches()[0].material as THREE.Material; throw new Error("render failed"); });
    expect(f.render).toThrow("render failed");
    expect(a.layers.mask).toBe(1); expect(f.scene.matrixWorldAutoUpdate).toBe(true);
    expect(f.scene.getObjectByName("XR terrain draw batches")!.visible).toBe(false);
    const disposed = vi.spyOn(owned!, "dispose"), textureDisposed = vi.spyOn(f.texture, "dispose");
    for (const mesh of f.tiles.values()) f.scene.remove(mesh);
    f.tiles.clear(); f.overlays.clear();
    f.renderer.render.mockImplementation(() => expect(f.visibleBatches()).toHaveLength(0));
    f.render();
    expect(disposed).toHaveBeenCalledOnce(); expect(textureDisposed).not.toHaveBeenCalled();
    f.owner.dispose();
  });

  it("grows batches, follows moved tiles and restores ordinary draws when only one instance remains", () => {
    const f = fixture(), a = f.addFloor(0), b = f.addFloor(1);
    let previous: THREE.InstancedMesh;
    f.renderer.render.mockImplementation(() => { previous = f.visibleBatches()[0]; });
    f.render();
    const released = vi.fn(); previous!.addEventListener("dispose", released);
    for (let i = 2; i < 7; i++) f.addFloor(i);
    f.renderer.clippingPlanes = [];
    b.position.set(1.5, -2, 0);
    f.renderer.render.mockImplementation(() => {
      const batch = f.visibleBatches()[0]; expect(batch.count).toBe(7); expect(batch.instanceMatrix.count).toBe(8);
      const matrix = new THREE.Matrix4(); batch.getMatrixAt(1, matrix); expect(matrix.equals(b.matrix)).toBe(true);
    });
    f.render(); expect(released).toHaveBeenCalledOnce();
    for (const mesh of f.tiles.values()) if (mesh !== a) mesh.visible = false;
    f.renderer.render.mockImplementation(() => { expect(f.visibleBatches()).toHaveLength(0); expect(a.layers.mask).toBe(1); });
    f.render(); f.owner.dispose();
  });
});
