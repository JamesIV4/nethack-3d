import { afterEach, describe, expect, it, vi } from "vitest";
import { createIsolatedAtlasTilePreviewDataUrl, getAtlasTilePixels } from "./atlas";

type PixelImage = { width: number; height: number; pixels: Uint8ClampedArray };

// A small pixel-backed canvas boundary lets the tests inspect the actual crop
// and its aspect ratio without requiring a browser or GPU.
function installPixelCanvas() {
  vi.stubGlobal("document", {
    createElement: () => {
      const canvas: PixelImage = { width: 0, height: 0, pixels: new Uint8ClampedArray() };
      const context = {
        clearRect: () => { canvas.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4); },
        drawImage: (image: PixelImage, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
          for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
            const source = ((sy + Math.floor(y * sh / dh)) * image.width + sx + Math.floor(x * sw / dw)) * 4;
            const dest = ((dy + y) * canvas.width + dx + x) * 4;
            canvas.pixels.set(image.pixels.slice(source, source + 4), dest);
          }
        },
        getImageData: () => ({ data: canvas.pixels }),
        putImageData: (image: { data: Uint8ClampedArray }) => { canvas.pixels = image.data; },
      };
      return { ...canvas,
        get width() { return canvas.width; }, set width(value: number) { canvas.width = value; },
        get height() { return canvas.height; }, set height(value: number) { canvas.height = value; },
        getContext: () => context,
        toDataURL: () => JSON.stringify({ width: canvas.width, height: canvas.height, pixels: [...canvas.pixels] }),
      };
    },
  });
}

function colorAtlas(tileWidth: number, tileHeight: number): HTMLImageElement {
  const width = tileWidth * 2;
  const height = tileHeight * 2;
  const colors = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 0, 255, 255]];
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cell = Math.floor(y / tileHeight) * 2 + Math.floor(x / tileWidth);
    pixels.set(colors[cell], (y * width + x) * 4);
  }
  return { width, height, pixels } as unknown as HTMLImageElement;
}

afterEach(() => vi.unstubAllGlobals());

describe("rectangular atlas previews", () => {
  it("extracts the complete second-row cell with its 15 by 25 native aspect", () => {
    installPixelCanvas();
    const atlas = colorAtlas(15, 25);
    const result = JSON.parse(createIsolatedAtlasTilePreviewDataUrl(atlas, 2, 15, 2, 2, undefined, 25)!);
    expect([result.width, result.height]).toEqual([15, 25]);
    expect(result.pixels).toEqual(Array.from({ length: 15 * 25 }, () => [0, 0, 255, 255]).flat());
    expect([...getAtlasTilePixels(atlas, 15, 3, 2, 2, 25)!])
      .toEqual(Array.from({ length: 15 * 25 }, () => [255, 0, 255, 255]).flat());
  });

  it("uses the same rectangular extent for background subtraction", () => {
    installPixelCanvas();
    const atlas = colorAtlas(15, 25);
    const background = getAtlasTilePixels(atlas, 15, 2, 2, 2, 25)!;
    const result = JSON.parse(createIsolatedAtlasTilePreviewDataUrl(atlas, 2, 15, 2, 2, {
      enabled: true, mode: "tile", applySolidChromaKeyAfterTile: false,
      solidChromaKeyColorHex: "#000000", backgroundTilePixels: background,
    }, 25)!);
    expect(result.pixels).toEqual(Array(15 * 25 * 4).fill(0));
  });

  it("retains square defaults for callers without a height", () => {
    installPixelCanvas();
    const result = JSON.parse(createIsolatedAtlasTilePreviewDataUrl(colorAtlas(16, 16), 3, 16, 2, 2)!);
    expect([result.width, result.height]).toEqual([16, 16]);
    expect(result.pixels).toEqual(Array.from({ length: 16 * 16 }, () => [255, 0, 255, 255]).flat());
  });
});
