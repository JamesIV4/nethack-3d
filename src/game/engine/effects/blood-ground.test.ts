import * as THREE from "three";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { BloodGround, type BloodGroundDependencies } from "./blood-ground";
import { normalizeNh3dClientOptions } from "../../ui-types";

vi.hoisted(() => vi.stubGlobal("window", {
  matchMedia: () => ({ matches: false }),
  location: { protocol: "http:", hostname: "localhost" },
}));
afterAll(() => vi.unstubAllGlobals());

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const clientOptions = normalizeNh3dClientOptions({ bloodGround: true, bloodDetail: "low" });
  const blood = new BloodGround({
    engineState: { clientOptions },
    audioHapticsPlatform: { getNativeCapacitorPlatform: () => null },
    levelTerrainCache: { levelTerrainCachesByName: new Map(), pendingLevelCacheTransition: null },
    lighting: { patchMaterialForVignette: () => {} },
    renderPipeline: { scene: new THREE.Scene() },
    terminalRendering: { isTerminalDisplayMode: () => false },
    tilesetAssets: { resolveTextureAnisotropyLevel: () => 1 },
  } as unknown as BloodGroundDependencies);
  blood.ensureBloodGroundOverlayResources();
  return { blood, clientOptions };
}

function seedRandom() {
  let seed = 0x12345678;
  vi.spyOn(Math, "random").mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  });
}

function hash(data: ArrayLike<number>) {
  let value = 2166136261;
  for (let i = 0; i < data.length; i++) value = Math.imul(value ^ data[i], 16777619) >>> 0;
  return value;
}

describe("ground blood preservation", () => {
  it("retains all pending edits until a visible renderer uploads the texture", () => {
    const { blood } = fixture();
    const texture = blood.bloodGroundOverlayTexture!;
    const width = blood.bloodGroundWidthPx;
    const edit = (x: number, y: number) => {
      blood.bloodGroundDensity![y * width + x] = 50;
      blood.bloodGroundHasVisibleData = true;
      blood.markBloodGroundDirtyRect(x, y, x, y);
      blood.syncBloodGroundTexture();
    };
    edit(1, 1);
    edit(4, 2);
    expect(texture.updateRanges).toEqual([]); // First upload initializes the whole GPU image.
    const version = texture.version;
    blood.syncBloodGroundTexture();
    expect(texture.version).toBe(version); // Hidden/idle frames do not re-upload.
    texture.onUpdate?.(texture);
    edit(7, 3);
    edit(9, 4);
    expect(texture.updateRanges).toEqual([
      { start: (3 * width + 7) * 4, count: 4 },
      { start: (4 * width + 9) * 4, count: 4 },
    ]);
    blood.refreshActiveBloodGroundVisuals();
    edit(12, 5);
    expect(texture.updateRanges).toEqual([]); // Recolor stays full until rendering.
    expect(blood.bloodGroundPixelData32![width + 1]).toBe(blood.bloodGroundColorLut![50]);
    blood.disposeBloodGroundOverlayResources();
  });

  it("copies only the changed canvas rectangle while preserving Android rendering safeguards", () => {
    const { blood } = fixture();
    blood.disposeBloodGroundOverlayResources();
    const putImageData = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
      putImageData,
    }) };
    vi.stubGlobal("document", { createElement: () => canvas });
    try {
      vi.spyOn(blood, "shouldUseBloodGroundCompatibilityMode").mockReturnValue(true);
      blood.ensureBloodGroundOverlayResources();
      const texture = blood.bloodGroundOverlayTexture!;
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.minFilter).toBe(THREE.NearestFilter);
      expect(texture.magFilter).toBe(THREE.NearestFilter);
      expect(texture.anisotropy).toBe(1);
      expect(texture.flipY).toBe(false);
      expect(texture.generateMipmaps).toBe(false);
      expect(blood.bloodGroundOverlayMaterial!.alphaTest).toBe(4 / 255);
      expect(blood.bloodGroundOverlayMaterial!.forceSinglePass).toBe(true);
      const index = 8 * blood.bloodGroundWidthPx + 12;
      blood.bloodGroundDensity![index] = 73;
      blood.markBloodGroundDirtyRect(12, 8, 13, 10);
      blood.syncBloodGroundTexture();
      expect(putImageData).toHaveBeenLastCalledWith(blood.bloodGroundUploadImageData, 0, 0, 12, 8, 2, 3);
      expect(blood.bloodGroundPixelData32![index]).toBe(blood.bloodGroundColorLut![73]);
      expect(texture.updateRanges).toEqual([]);
      blood.clearActiveBloodGroundCanvas();
      expect(putImageData).toHaveBeenLastCalledWith(blood.bloodGroundUploadImageData, 0, 0);
      expect(blood.bloodGroundPixelData32![index]).toBe(0);
    } finally {
      blood.disposeBloodGroundOverlayResources();
      vi.stubGlobal("document", undefined);
    }
  });

  it("does not shade saturated pixels or upload empty rasterization bounds", () => {
    const { blood } = fixture();
    blood.bloodGroundDensity!.fill(blood.bloodGroundMaxDensity);
    blood.bloodGroundNoiseAtlasA = new Proxy(blood.bloodGroundNoiseAtlasA!, {
      get: () => { throw new Error("Saturated blood must not sample noise"); },
    });
    blood.rasterizeBloodGroundEllipse(12, -8, 0.2, 0.1, 0.7, 60, 1.5, 19);
    expect(blood.bloodGroundDirtyRect).toBeNull();
    blood.disposeBloodGroundOverlayResources();
  });

  it("preserves seeded direct hits and repeated particle impacts pixel for pixel", () => {
    const { blood } = fixture();
    seedRandom();
    blood.paintBloodGroundFromDirectHit(12, 8, 17, "defeat", 1, -0.5);
    for (let i = 0; i < 30; i++) {
      blood.paintBloodGroundFromParticleImpact(12 + i * 0.01, -8, 1.2, -0.7, 3, 0.1, 0);
    }
    blood.syncBloodGroundTexture();
    // Recorded from the original rasterizer before the performance changes.
    expect(hash(blood.bloodGroundDensity!)).toBe(1987085205);
    expect(hash(blood.bloodGroundPixelData!)).toBe(987416243);
    expect(blood.bloodGroundHasVisibleData).toBe(true);
    const snapshot = blood.captureActiveBloodGroundCacheSnapshot()!;
    const pixels = blood.bloodGroundPixelData!.slice();
    blood.clearActiveBloodGroundCanvas();
    expect(blood.bloodGroundOverlayMesh!.visible).toBe(false);
    expect(blood.bloodGroundPixelData!.some(value => value !== 0)).toBe(false);
    blood.restoreBloodGroundCacheSnapshot(snapshot);
    expect(hash(blood.bloodGroundPixelData!)).toBe(hash(pixels));
    expect(blood.bloodGroundDensity).not.toBe(snapshot.density);
    blood.disposeBloodGroundOverlayResources();
  });
});
