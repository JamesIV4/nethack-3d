import * as THREE from "three";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createEngineSystems, type EngineSystems } from "../create-engine-systems";
import type { EngineCoordinator } from "../engine-coordinator";
import type { BloodGround } from "../effects/blood-ground";

vi.hoisted(() => {
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false }),
    location: { protocol: "http:", hostname: "localhost" },
  });
});
afterAll(() => vi.unstubAllGlobals());

const instances: EngineSystems[] = [];

function createSystems(): EngineSystems {
  const coordinator: EngineCoordinator = {
    initThreeJS() {},
    initUI() {},
    async connectToRuntime() {},
    handleRuntimeEvent() {},
    animate() {},
    dispose() {},
    applyClientOptions() {},
    applyPlayMode() {},
    clearScene() {},
    setClientOptions() {},
  };
  const systems = createEngineSystems(coordinator);
  instances.push(systems);
  systems.engineState.clientOptions.bloodDetail = "veryLow";
  systems.renderPipeline.scene = new THREE.Scene();
  vi.spyOn(systems.tilesetAssets, "resolveTextureAnisotropyLevel").mockReturnValue(1);
  return systems;
}

function initializeGround(systems: EngineSystems): BloodGround {
  const ground = systems.bloodGround;
  expect(ground.ensureBloodGroundOverlayResources()).toBe(true);
  ground.syncBloodGroundTexture(true);
  ground.bloodGroundOverlayTexture!.onUpdate?.(ground.bloodGroundOverlayTexture!);
  return ground;
}

afterEach(() => {
  for (const systems of instances.splice(0)) {
    const ground = systems.bloodGround;
    ground.disposeBloodGroundOverlayResources();
    ground.bloodGroundPlaneGeometry.dispose();
    systems.wallGeometry.wallGeometry.dispose();
    systems.tileRendering.floorGeometry.dispose();
    systems.heldWeapon.fpsHeldWeaponGeometry.dispose();
    systems.entityBillboards.fpsPitchLockedBillboardGeometry.dispose();
    systems.wallOverlays.vultureWallPlaneGeometry.dispose();
    systems.wallOverlays.vultureDoorPlaneGeometry.dispose();
    systems.wallOverlays.transparentWallGroundPlaneGeometry.dispose();
    systems.wallOverlays.vultureInvisibleSurfaceMaterial.dispose();
    Object.values(systems.tileMaterials.materials).forEach((material) => material.dispose());
    for (const { texture } of systems.glyphTextures.glyphTextureCache.values()) {
      texture.dispose();
    }
  }
});

describe("engine rendering resource ownership", () => {
  it("animates billboard damage colors without shader invalidation and restores white", () => {
    const systems = createSystems();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
    systems.entityBillboards.monsterBillboards.set("2,3", sprite);
    const version = sprite.material.version;
    systems.damageFlashes.startMonsterBillboardDamageFlash("2,3");
    expect(sprite.material.color.getHex()).toBe(0xff0000);
    systems.damageFlashes.updateMonsterBillboardDamageFlashes(0.08);
    const expected = new THREE.Color("#ffffff").lerp(new THREE.Color("#ff2d2d"), Math.exp(-8.5 * 0.25));
    expect(sprite.material.color.equals(expected)).toBe(true);
    systems.damageFlashes.updateMonsterBillboardDamageFlashes(0.25);
    expect(sprite.material.color.getHex()).toBe(0xffffff);
    expect(sprite.material.version).toBe(version);
    expect(systems.damageFlashes.monsterBillboardDamageFlashes.size).toBe(0);
  });

  it("renders shatter planes in one pass and still disposes their owned resources", () => {
    const systems = createSystems();
    systems.camera.camera = new THREE.PerspectiveCamera();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
    const texture = new THREE.CanvasTexture(undefined);
    const disposed = vi.fn();
    texture.addEventListener("dispose", disposed);
    systems.billboardShatter.spawnMonsterBillboardShardParticlesFromDescriptors(sprite, [{
      texture, centerU: 0.5, centerV: 0.5, widthRatio: 0.5, heightRatio: 0.5, areaRatio: 0.25,
    }]);
    const particle = systems.bloodParticles.monsterBillboardShardParticles[0];
    expect(particle.mesh.material.forceSinglePass).toBe(true);
    expect(particle.mesh.material.side).toBe(THREE.DoubleSide);
    systems.bloodParticles.clearMonsterBillboardShardParticles();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(systems.renderPipeline.scene.children).not.toContain(particle.mesh);
  });

  it.each(["ensureMonsterBillboardPitchLockedProxyMesh", "ensureMonsterBillboardFlatProxyMesh"] as const)(
    "%s refreshes shaders only when their source changes", (method) => {
      const systems = createSystems();
      const source = new THREE.SpriteMaterial({ map: new THREE.Texture(), alphaTest: 0.2 });
      const sprite = new THREE.Sprite(source);
      sprite.userData.tileX = 12; sprite.userData.tileY = 8;
      const ensure = () => systems.entityBillboards[method](sprite)!;
      const proxy = ensure();
      expect(proxy.userData).toMatchObject({ tileX: 12, tileY: 8 });
      sprite.userData.tileX = 13;
      ensure();
      expect(proxy.userData.tileX).toBe(13);
      expect(proxy.material.forceSinglePass).toBe(true);
      expect(proxy.material.side).toBe(THREE.DoubleSide);
      const initialVersion = proxy.material.version;
      for (let frame = 0; frame < 120; frame++) {
        source.opacity = frame / 120;
        source.color.setRGB(frame / 120, 0.2, 0.1);
        source.depthTest = frame % 2 === 0;
        expect(ensure()).toBe(proxy);
      }
      expect(proxy.material.version).toBe(initialVersion);
      expect(proxy.material.opacity).toBe(source.opacity);
      expect(proxy.material.color.equals(source.color)).toBe(true);
      expect(proxy.material.depthTest).toBe(source.depthTest);
      source.map = new THREE.Texture();
      ensure();
      expect(proxy.material.version).toBeGreaterThan(initialVersion);
      expect(proxy.material.map).toBe(source.map);
      const textureVersion = proxy.material.version;
      source.needsUpdate = true;
      ensure();
      expect(proxy.material.version).toBeGreaterThan(textureVersion);
      source.alphaTest = 0;
      ensure();
      expect(proxy.material.alphaTest).toBe(0);
      const disposed = vi.fn();
      proxy.material.addEventListener("dispose", disposed);
      systems.entityBillboards.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
      systems.entityBillboards.disposeMonsterBillboardFlatProxyMesh(sprite);
      expect(disposed).toHaveBeenCalledTimes(1);
    },
  );
  it("constructs eager dependencies and keeps resources separate between game sessions", () => {
    const first = createSystems();
    const second = createSystems();

    expect(first.lighting.vignetteUniforms.uBloodGroundStrength.value).toBe(
      first.engineState.clientOptions.bloodStrength,
    );
    expect(first.lighting.vignetteUniforms.uBloodGroundSpecularReferenceStrength.value).toBe(
      first.bloodGround.bloodGroundSpecularReferenceStrength,
    );
    expect(first.bloodParticles.monsterBillboardShardGravity).toBe(23);
    first.wallGeometry.wallGeometry.computeBoundingBox();
    expect(first.wallGeometry.wallGeometry.boundingBox?.getSize(new THREE.Vector3()).toArray()).toEqual([1, 1, 1]);
    expect(first.wallGeometry.wallGeometry).not.toBe(second.wallGeometry.wallGeometry);
    expect(first.glyphTextures.glyphTextureCache).not.toBe(second.glyphTextures.glyphTextureCache);
    expect(first.bloodGround.bloodGroundFeatherLutCache).not.toBe(second.bloodGround.bloodGroundFeatherLutCache);
    first.tileRendering.tileMap.set("1,2", new THREE.Mesh());
    expect(second.tileRendering.tileMap.has("1,2")).toBe(false);
  });

  it("keeps a shared glyph texture alive until its last consumer releases it", () => {
    const cache = createSystems().glyphTextures;
    const texture = new THREE.CanvasTexture(undefined);
    const factory = vi.fn(() => texture);
    const disposed = vi.fn();
    texture.addEventListener("dispose", disposed);

    expect(cache.acquireGlyphTexture("monster", factory)).toBe(texture);
    expect(cache.acquireGlyphTexture("monster", factory)).toBe(texture);
    expect(factory).toHaveBeenCalledTimes(1);
    cache.releaseGlyphTexture("monster");
    expect(disposed).not.toHaveBeenCalled();
    cache.releaseGlyphTexture("monster");
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(cache.glyphTextureCache.has("monster")).toBe(false);
    cache.releaseGlyphTexture("monster");
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it("restores blood per level without sharing mutable density buffers", () => {
    const systems = createSystems();
    const ground = initializeGround(systems);
    ground.bloodGroundDensity![17] = 123;
    ground.bloodGroundHasVisibleData = true;
    const snapshot = ground.captureActiveBloodGroundCacheSnapshot()!;
    const clone = ground.cloneBloodGroundCacheSnapshot(snapshot)!;

    ground.bloodGroundDensity![17] = 999;
    expect(snapshot.density[17]).toBe(123);
    clone.density[17] = 456;
    expect(snapshot.density[17]).toBe(123);
    ground.restoreBloodGroundCacheSnapshot(snapshot);
    expect(ground.bloodGroundDensity![17]).toBe(123);
    expect(ground.bloodGroundDensity).not.toBe(snapshot.density);
    expect(ground.bloodGroundOverlayMesh!.visible).toBe(true);

    systems.engineState.clientOptions.bloodDetail = "low";
    expect(ground.cloneBloodGroundCacheSnapshot(snapshot)).toBeNull();
    systems.engineState.clientOptions.bloodDetail = "veryLow";
    ground.restoreBloodGroundCacheSnapshot({ ...snapshot, version: snapshot.version + 1 });
    expect(ground.bloodGroundDensity![17]).toBe(0);
    expect(ground.bloodGroundOverlayMesh!.visible).toBe(false);
    expect(ground.captureActiveBloodGroundCacheSnapshot()).toBeNull();
  });

  it("uploads sparse blood edits as independent rows and clears consumed dirty ranges", () => {
    const ground = initializeGround(createSystems());
    const width = ground.bloodGroundWidthPx;
    const texture = ground.bloodGroundOverlayTexture!;
    const topIndex = 2 * width + 4;
    const bottomIndex = 7 * width + 9;
    ground.bloodGroundDensity![topIndex] = 37;
    ground.bloodGroundDensity![bottomIndex] = 64;
    ground.bloodGroundHasVisibleData = true;
    ground.markBloodGroundDirtyRect(4, 2, 4, 2);
    ground.markBloodGroundDirtyRect(9, 7, 9, 7);
    ground.syncBloodGroundTexture();

    expect(ground.bloodGroundPixelData32![topIndex]).toBe(ground.bloodGroundColorLut![37]);
    expect(ground.bloodGroundPixelData32![bottomIndex]).toBe(ground.bloodGroundColorLut![64]);
    expect(ground.bloodGroundPixelData32![4 * width + 6]).toBe(0);
    expect(texture.updateRanges).toEqual([
      { start: topIndex * 4, count: 4 },
      { start: bottomIndex * 4, count: 4 },
    ]);
    expect(ground.bloodGroundDirtyRect).toBeNull();
    expect(ground.bloodGroundDirtyRowRangeEnd).toBe(-1);

    ground.markBloodGroundDirtyRect(-8, -3, 1.2, 0.2);
    expect(ground.bloodGroundDirtyRect).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 1 });
  });

  it("disposes a ground overlay once and detaches it from its scene", () => {
    const systems = createSystems();
    const ground = initializeGround(systems);
    const textureDisposed = vi.fn();
    const materialDisposed = vi.fn();
    ground.bloodGroundOverlayTexture!.addEventListener("dispose", textureDisposed);
    ground.bloodGroundOverlayMaterial!.addEventListener("dispose", materialDisposed);
    expect(systems.renderPipeline.scene.children).toContain(ground.bloodGroundOverlayMesh);

    ground.disposeBloodGroundOverlayResources();
    ground.disposeBloodGroundOverlayResources();
    expect(textureDisposed).toHaveBeenCalledTimes(1);
    expect(materialDisposed).toHaveBeenCalledTimes(1);
    expect(systems.renderPipeline.scene.children).toHaveLength(0);
    expect(ground.bloodGroundDensity).toBeNull();
  });
});

