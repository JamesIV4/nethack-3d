import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlyphTextures, type GlyphTexturesDependencies } from "./glyph-textures";
import { EntityBillboards, type EntityBillboardsDependencies } from "./entity-billboards";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture(width = 15, height: number | undefined = 25) {
  const contexts: any[] = [];
  vi.stubGlobal("document", { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => context };
    const context = {
      canvas, clearRect: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), putImageData: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) })),
    };
    contexts.push(context);
    return canvas;
  } });
  const atlas = { width: width * 40, height: (height ?? width) * 60 };
  const assets = {
    tileSourceSize: width, tileSourceHeight: height as number | undefined,
    resolveTilesetAtlasImageSource: () => atlas,
    resolveAtlasTileIndexForRuntime: vi.fn((index: number) => index),
    resolveTextureAnisotropyLevel: () => 1,
    resolveTilesetBackgroundReferenceTileIndex: () => 41,
    tilesetBackgroundReferenceTilePixels: null as Uint8ClampedArray | null,
    drawTilesetBackgroundReferenceTile: vi.fn(() => true),
  };
  const textures = new GlyphTextures({
    engineState: { clientOptions: { tilesetPath: "custom", tilesetBackgroundRemovalMode: "tile", tilesetSolidChromaKeyColorHex: "#ffffff" } },
    tilesetAssets: assets,
  } as unknown as GlyphTexturesDependencies);
  return { textures, contexts, atlas, assets };
}

describe("rectangular atlas extraction", () => {
  it.each([[15, 25], [32, 32], [16, undefined]])("crops width %s height %s independently beyond the first atlas row", (width, height) => {
    const f = fixture(width!, height ?? width!);
    f.assets.tileSourceHeight = height;
    const resolvedHeight = height ?? width!;
    const texture = f.textures.createTileTexture(81, 0.5);
    expect(texture.image).toMatchObject({ width, height: resolvedHeight });
    expect(f.contexts[0].drawImage).toHaveBeenCalledExactlyOnceWith(f.atlas, width, resolvedHeight * 2, width, resolvedHeight, 0, 0, width, resolvedHeight);
    expect(f.assets.resolveAtlasTileIndexForRuntime).toHaveBeenCalledWith(81, 2400);
    expect(f.contexts[0].fillRect).toHaveBeenCalledWith(0, 0, width, resolvedHeight);
    texture.dispose();
  });

  it("extracts the full rectangular reference and removes matching pixels in its bottom rows", () => {
    const f = fixture();
    const texture = f.textures.createTileTexture(81, 1, true);
    expect(f.contexts[1].drawImage).toHaveBeenCalledWith(f.atlas, 15, 25, 15, 25, 0, 0, 15, 25);
    expect(f.contexts[0].getImageData).toHaveBeenCalledWith(0, 0, 15, 25);
    const result = f.contexts[0].putImageData.mock.calls[0][0].data;
    expect(result.length).toBe(15 * 25 * 4);
    expect(result[result.length - 1]).toBe(0);
    texture.dispose();
  });

  it("applies solid removal and reference drawing across the rectangular height", () => {
    const f = fixture();
    const texture = f.textures.createTileTexture(81, 1, false, { useBackgroundReferenceTile: true });
    expect(f.assets.drawTilesetBackgroundReferenceTile).toHaveBeenCalledWith(f.contexts[0], 15, 25);
    f.textures.applySolidColorChromaKey(f.contexts[0], 15, 25);
    const result = f.contexts[0].putImageData.mock.calls[0][0].data;
    expect(result.length).toBe(1500);
    expect(result[result.length - 1]).toBe(0);
    texture.dispose();
  });
});

describe("rectangular entity sprite aspect", () => {
  it.each([
    ["tiles", 15, 25, false, 0.6, 1, 1],
    ["tiles", 15, 25, false, 1, 1, 0.6],
    ["tiles", 15, 25, true, 0.45, 0.75, 1],
    ["tiles", 32, 32, false, 1, 1, 1],
    ["ascii", 15, 25, false, 1, 1, 1],
  ] as const)("preserves %s %sx%s sprite aspect in fps=%s", (mode, width, height, fps, scaleX, scaleY, worldScale) => {
    vi.stubGlobal("HTMLCanvasElement", class {});
    const texture = new THREE.CanvasTexture(undefined);
    const billboards = new EntityBillboards({
      engineState: { clientOptions: { tilesetMode: mode, tilesetBackgroundRemovalMode: "none" } },
      movementInput: { isFpsMode: () => fps },
      tilesetAssets: { tileSourceSize: width, tileSourceHeight: height, shouldUseVultureTiles: () => false, getWorldTileScaleX: () => worldScale },
      glyphTextures: { createTileTexture: () => texture },
      lighting: { patchMaterialForVignette: vi.fn() },
      renderPipeline: { scene: new THREE.Scene() },
    } as unknown as EntityBillboardsDependencies);
    vi.spyOn(billboards, "getMonsterBillboardQualityKey").mockReturnValue("test");
    vi.spyOn(billboards, "createMonsterBillboardTexture").mockReturnValue(texture);
    vi.spyOn(billboards, "ensureEntityBlobShadow").mockImplementation(() => {});
    vi.spyOn(billboards, "updateMonsterBillboardPitchLockStateForEntry").mockImplementation(() => {});
    billboards.ensureMonsterBillboard("1,2", 1, 2, "@", "#ffffff", 81);
    const sprite = billboards.monsterBillboards.get("1,2")!;
    expect(sprite.scale.x).toBeCloseTo(scaleX);
    expect(sprite.scale.y).toBe(scaleY);
    sprite.material.dispose(); texture.dispose(); billboards.fpsPitchLockedBillboardGeometry.dispose();
  });
});
