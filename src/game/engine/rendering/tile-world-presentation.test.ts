import * as THREE from "three";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } }));
import { createEngineSystems } from "../create-engine-systems";
import type { EngineCoordinator } from "../engine-coordinator";
import { applyCameraAttachedWorldAspect } from "./tile-world-presentation";
afterAll(() => vi.unstubAllGlobals());

function fixture(width: number, height: number) {
  const systems = createEngineSystems({} as EngineCoordinator);
  systems.engineState.clientOptions.tilesetMode = "tiles";
  systems.engineState.clientOptions.tilesetPath = "assets/5.0/Geoduck.bmp";
  systems.engineState.clientOptions.tilesetUseTileAspectRatio = true;
  systems.tilesetAssets.tileSourceSize = width;
  systems.tilesetAssets.tileSourceHeight = height;
  systems.renderPipeline.scene = new THREE.Scene();
  systems.camera.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  systems.camera.camera.up.set(0, 0, 1);
  systems.camera.camera.position.set(4, -8, 4);
  systems.camera.camera.lookAt(4, -5, 0);
  systems.camera.camera.updateMatrixWorld();
  return systems;
}

describe("rectangular world cell presentation", () => {
  it.each([[15, 25], [32, 64], [64, 32], [32, 32]])("uses %sx%s cells without changing logical positions or wall height", (width, height) => {
    const s = fixture(width, height);
    const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    block.position.set(4, -5, 0.5);
    s.renderPipeline.scene.add(block);
    s.renderPipeline.syncWorldTileScale();
    const bounds = new THREE.Box3().setFromObject(block);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(width / height);
    expect(size.y).toBe(1); expect(size.z).toBe(1);
    expect(block.position.toArray()).toEqual([4, -5, 0.5]);
    const activeCamera = s.camera.getActiveCamera();
    expect(activeCamera.position.x).toBeCloseTo(4 * width / height);
    expect(s.camera.camera.position.toArray()).toEqual([4, -8, 4]);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(), activeCamera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3())!;
    expect(hit.x / s.tilesetAssets.getWorldTileScaleX()).toBeCloseTo(4);
    expect(hit.y).toBeCloseTo(-5);
    s.engineState.clientOptions.tilesetUseTileAspectRatio = false;
    s.renderPipeline.syncWorldTileScale();
    expect(s.renderPipeline.scene.scale.toArray()).toEqual([1, 1, 1]);
    expect(s.camera.getActiveCamera()).toBe(s.camera.camera);
    block.geometry.dispose(); (block.material as THREE.Material).dispose();
  });

  it("does not scale ASCII, terminal or Vulture views", () => {
    const s = fixture(15, 25);
    for (const mode of ["ascii", "terminal"] as const) {
      s.engineState.clientOptions.tilesetMode = mode;
      expect(s.tilesetAssets.getWorldTileScaleX()).toBe(1);
    }
    s.engineState.clientOptions.tilesetMode = "tiles";
    vi.spyOn(s.tilesetAssets, "isVultureTilesActive").mockReturnValue(true);
    expect(s.tilesetAssets.getWorldTileScaleX()).toBe(1);
  });

  it("keeps held artwork aligned with the rendered camera at oblique angles", () => {
    const s = fixture(15, 25);
    s.renderPipeline.syncWorldTileScale();
    const logicalCamera = s.camera.camera;
    const presented = s.camera.getActiveCamera();
    logicalCamera.updateMatrixWorld();
    const object = new THREE.Object3D();
    const offset = new THREE.Vector3(0.4, -0.2, -1);
    object.position.copy(offset).applyMatrix4(logicalCamera.matrixWorld);
    object.quaternion.copy(logicalCamera.quaternion);
    s.renderPipeline.scene.add(object);
    applyCameraAttachedWorldAspect(object, logicalCamera, presented, 0.6, new THREE.Matrix4());
    s.renderPipeline.scene.updateMatrixWorld(true);
    const viewed = new THREE.Matrix4().multiplyMatrices(presented.matrixWorldInverse, object.matrixWorld);
    expect(new THREE.Vector3().setFromMatrixPosition(viewed).distanceTo(offset)).toBeLessThan(1e-10);
    for (const scale of new THREE.Vector3().setFromMatrixScale(viewed).toArray()) expect(scale).toBeCloseTo(1, 8);
    applyCameraAttachedWorldAspect(object, logicalCamera, logicalCamera, 1, new THREE.Matrix4());
    expect(object.matrixAutoUpdate).toBe(true);
  });
});
