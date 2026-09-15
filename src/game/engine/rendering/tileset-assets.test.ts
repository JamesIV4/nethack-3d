import { afterEach, describe, expect, it, vi } from "vitest";
import { TilesetAssets, type TilesetAssetsDependencies } from "./tileset-assets";
import { nh5OutputRows } from "../../tileset-367-to-5-translation";

afterEach(() => vi.unstubAllGlobals());
function canvasFixture() {
  const drawImage = vi.fn();
  const getImageData = vi.fn((_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }));
  const context = { clearRect: vi.fn(), drawImage, getImageData, imageSmoothingEnabled: true };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const assets = new TilesetAssets({ engineState: { clientOptions: { tilesetBackgroundTileId: 41 } } } as unknown as TilesetAssetsDependencies);
  return { assets, drawImage, getImageData };
}
describe("rectangular atlas loading", () => {
  it("extracts a second-row reference cell with its native height", () => {
    const { assets, drawImage, getImageData } = canvasFixture();
    const source = { width: 600, height: 975 } as HTMLImageElement;
    assets.captureTilesetBackgroundReferenceTile(source, 15, 25);
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(source, 15, 25, 15, 25, 0, 0, 15, 25);
    expect(getImageData).toHaveBeenCalledExactlyOnceWith(0, 0, 15, 25);
    expect(assets.tilesetBackgroundReferenceTilePixels).toHaveLength(15 * 25 * 4);
  });
  it("retains rectangular rows when translating a legacy atlas to NetHack 5", () => {
    const { assets, drawImage } = canvasFixture();
    const source = { width: 600, height: 975 } as HTMLImageElement;
    const output = assets.compileLegacyTilesetAtlasToNh5(source, 15, null, 25);
    expect([output.width, output.height]).toEqual([600, nh5OutputRows * 25]);
    expect(drawImage.mock.calls.length).toBeGreaterThan(1000);
    for (const [image, sx, sy, sw, sh, dx, dy, dw, dh] of drawImage.mock.calls) {
      expect(image).toBe(source);
      expect([sw, sh, dw, dh]).toEqual([15, 25, 15, 25]);
      expect(sx % 15).toBe(0); expect(sy % 25).toBe(0);
      expect(dx % 15).toBe(0); expect(dy % 25).toBe(0);
      expect(sy + sh).toBeLessThanOrEqual(source.height);
    }
  });
});
