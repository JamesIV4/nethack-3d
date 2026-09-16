import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { WorldClipCulling } from "./world-clip-culling";
import { tabletopClippingPlanes } from "./webxr-rig";

function fixture() {
  const scene = new THREE.Scene(), tracking = new THREE.Group();
  scene.add(tracking);
  const planes = tabletopClippingPlanes(new THREE.Vector3(), 1);
  const culling = new WorldClipCulling();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const mesh = (x: number, y = 0, parent: THREE.Object3D = scene) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, 0); parent.add(object); return object;
  };
  const renderer = { clippingPlanes: planes, render: vi.fn() };
  const render = () => culling.render(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera(), tracking);
  return { culling, scene, tracking, planes, geometry, mesh, renderer, render };
}

describe("world clipping before XR submission", () => {
  it("keeps inset/partial tiles and restores masks even after a render failure", () => {
    const f = fixture(), outside = f.mesh(14), touching = f.mesh(12.999), partial = f.mesh(12.8);
    outside.layers.set(3);
    const invisible = f.mesh(0); invisible.visible = false;
    const update = vi.spyOn(f.scene, "updateMatrixWorld");
    f.renderer.render.mockImplementation(() => {
      expect(outside.layers.mask).toBe(0);
      expect(touching.layers.mask).toBe(1);
      expect(partial.layers.mask).toBe(1);
      expect(f.scene.matrixWorldAutoUpdate).toBe(false);
      throw new Error("lost context");
    });
    expect(f.render).toThrow("lost context");
    expect(update).toHaveBeenCalledOnce();
    expect(outside.layers.mask).toBe(8);
    expect(outside.visible).toBe(true);
    expect(invisible.visible).toBe(false);
    expect(f.scene.matrixWorldAutoUpdate).toBe(true);
    expect(outside.geometry).toBe(f.geometry);
    f.scene.matrixWorldAutoUpdate = false;
    expect(f.render).toThrow("lost context");
    expect(f.scene.matrixWorldAutoUpdate).toBe(false);
    expect(update).toHaveBeenCalledOnce();
  });

  it("tests children independently and leaves tracking overlays and hidden ancestors alone", () => {
    const f = fixture(), outside = f.mesh(30), child = f.mesh(-30, 0, outside);
    const overlay = f.mesh(30, 0, f.tracking), hidden = new THREE.Group();
    hidden.visible = false; f.scene.add(hidden);
    const hiddenChild = f.mesh(0, 0, hidden);
    f.renderer.render.mockImplementation(() => {
      expect(outside.layers.mask).toBe(0);
      expect(child.layers.mask).toBe(1);
      expect(overlay.layers.mask).toBe(1);
      expect(hiddenChild.layers.mask).toBe(1);
      expect(hidden.visible).toBe(false);
    });
    f.render();
  });

  it("uses transformed geometry bounds for rectangular, rotated and moving tiles", () => {
    const f = fixture();
    f.scene.scale.set(0.6, 1.3, 1);
    const tile = f.mesh(20);
    tile.rotation.z = Math.PI / 4;
    f.scene.updateMatrixWorld(true);
    // Its center is close to the right edge but a rotated corner is inside.
    expect(f.culling.isOutside(tile, f.planes)).toBe(false);
    tile.position.x = 24; f.scene.updateMatrixWorld(true);
    expect(f.culling.isOutside(tile, f.planes)).toBe(true);
    tile.position.x = 20; f.scene.updateMatrixWorld(true);
    expect(f.culling.isOutside(tile, f.planes)).toBe(false);
    f.planes[1].constant = 9;
    expect(f.culling.isOutside(tile, f.planes)).toBe(true);
  });

  it("preserves sprites, uncullable effects and deformed meshes", () => {
    const f = fixture();
    const sprite = new THREE.Sprite(), uncullable = f.mesh(40);
    const skinned = new THREE.SkinnedMesh(f.geometry), instanced = new THREE.InstancedMesh(f.geometry, new THREE.MeshBasicMaterial(), 1);
    const morph = f.mesh(40); morph.morphTargetInfluences = [1];
    uncullable.frustumCulled = false;
    f.scene.add(sprite, skinned, instanced);
    for (const object of [sprite, uncullable, skinned, instanced, morph]) {
      object.position.x = 40; object.updateMatrixWorld(true);
      expect(f.culling.isOutside(object, f.planes)).toBe(false);
    }
  });

  it("does not add draw candidates as more distant tiles are revealed", () => {
    const f = fixture(), near = f.mesh(0);
    for (let i = 0; i < 1600; i++) f.mesh(30 + i % 80, Math.floor(i / 80));
    f.renderer.render.mockImplementation(() => {
      expect(f.scene.children.filter(o => o instanceof THREE.Mesh && o.layers.mask !== 0)).toEqual([near]);
    });
    f.render();
    expect(f.scene.children.filter(o => o.layers.mask === 0)).toHaveLength(0);
    f.renderer.clippingPlanes = [];
    f.renderer.render.mockImplementation(() => {
      expect(f.scene.children.filter(o => o.layers.mask === 0)).toHaveLength(0);
    });
    f.render();
  });
});
