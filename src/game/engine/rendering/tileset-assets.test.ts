import { afterEach, describe, expect, it, vi } from "vitest";
import { TilesetAssets, type TilesetAssetsDependencies } from "./tileset-assets";
import { nh5OutputRows, nh5ExpectedTileCount, translateNh367TileIndexToNh5 } from "../../tileset-367-to-5-translation";
import { DarkCorridorInference, type DarkCorridorInferenceDependencies } from "../world/dark-corridor-inference";
import type { NethackRuntimeVersion } from "../../../runtime/types";
import type { Nh3dClientOptions } from "../../ui-types";
import * as THREE from "three";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function canvasFixture() {
  const drawImage = vi.fn();
  const getImageData = vi.fn((_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }));
  const context = { clearRect: vi.fn(), drawImage, getImageData, imageSmoothingEnabled: true };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const assets = new TilesetAssets({ engineState: { clientOptions: { tilesetBackgroundTileId: 41 } } } as unknown as TilesetAssetsDependencies);
  return { assets, drawImage, getImageData };
}
it.each(["3.6.7", "5.0", "slashem"] as const)("reloads an unchanged tileset path when a retained renderer switches to %s", version => {
  const config = { runtimeVersion: "5.0" as NethackRuntimeVersion };
  const assets = new TilesetAssets({ engineState: { characterCreationConfig: config } } as TilesetAssetsDependencies);
  const options = { tilesetPath: "assets/3.6/Nevanda.png" } as Nh3dClientOptions;
  assets.tilesetTextureRuntimeVersion = version === "5.0" ? "3.6.7" : "5.0";
  config.runtimeVersion = version;
  assets.loadTilesetTexture = vi.fn(() => { assets.tilesetTextureRuntimeVersion = assets.resolveRuntimeVersion(); });
  assets.ensureTilesetRuntime(options);
  expect(assets.loadTilesetTexture).toHaveBeenCalledExactlyOnceWith(options);
  assets.ensureTilesetRuntime(options);
  expect(assets.loadTilesetTexture).toHaveBeenCalledOnce();
});
it("replaces a compiled NH5 atlas with the original sheet when returning to 3.6.7", async () => {
  vi.useFakeTimers();
  const { assets } = canvasFixture();
  const config = { runtimeVersion: "5.0" as NethackRuntimeVersion };
  const options = { tilesetMode: "tiles", tilesetPath: "assets/3.6/Nevanda.png" } as Nh3dClientOptions;
  Object.assign((assets as any).dependencies, {
    engineState: { characterCreationConfig: config, clientOptions: options, disposed: false },
    renderPipeline: { syncWorldTileScale: vi.fn() }, promptDialogs: { syncLoadingVisibility: vi.fn() },
    tileUpdates: { refreshTilesFromStateCache: vi.fn() },
    vultureProjectionDebug: { syncVultureWallProjectionDebugPanelVisibility: vi.fn() },
  });
  const source = { width: 1280, height: 1248 } as HTMLImageElement;
  assets.loadTilesetImage = vi.fn(async () => source);
  assets.disposeVultureTilesetTranslator = vi.fn();
  assets.invalidateTilesetDependentCaches = vi.fn();
  assets.captureTilesetBackgroundReferenceTile = vi.fn();
  assets.createTilesetTextureFromSource = image => new THREE.Texture(image);
  assets.loadTilesetTexture(options);
  await vi.runAllTimersAsync();
  expect(assets.loadedTilesetTileLayoutVersion).toBe("5.0");
  const compiled = assets.tilesetTexture!;
  expect(compiled.image).not.toBe(source);
  const dispose = vi.spyOn(compiled, "dispose");
  config.runtimeVersion = "3.6.7";
  assets.ensureTilesetRuntime(options);
  await vi.runAllTimersAsync();
  expect(assets.tilesetTexture!.image).toBe(source);
  expect(assets.loadedTilesetTileLayoutVersion).toBe("3.6.7");
  expect(assets.tilesetTextureRuntimeVersion).toBe("3.6.7");
  expect(dispose).toHaveBeenCalledOnce();
  expect(assets.tilesetCompilationLoadingVisible).toBe(false);
});
describe("rectangular atlas loading", () => {
  it.each(["raw","compiled"] as const)("preserves the selected inferred wall tile in a %s legacy pack on NH5",async layout=>{
    const {assets,drawImage}=canvasFixture();
    assets.resolveRuntimeVersion=()=>"5.0";
    assets.loadedTilesetSourceLayoutVersion="3.6.7";
    assets.loadedTilesetTileLayoutVersion=layout==="compiled"?"5.0":"3.6.7";
    assets.resolveLoadedAtlasTileCount=()=>layout==="compiled"?nh5ExpectedTileCount:1082;
    assets.isVultureTilesActive=()=>false;
    const selected=866, runtime=translateNh367TileIndexToNh5(selected);
    expect(runtime).not.toBe(selected);
    const options={darkCorridorWallTileOverrideEnabled:true,darkCorridorWallTileOverrideTileId:selected,darkCorridorWallSolidColorOverrideEnabled:false};
    const inference=new DarkCorridorInference({engineState:{clientOptions:options},tilesetAssets:assets} as unknown as DarkCorridorInferenceDependencies);
    expect(inference.resolveInferredDarkCorridorWallTileTextureIndex(0,true)).toBe(runtime);
    expect(inference.resolveInferredDarkCorridorWallTileTextureIndex(17,false)).toBe(17);
    expect(assets.resolveSourceTileIndexForRuntime(runtime)).toBe(selected);
    const atlasTile=assets.resolveAtlasTileIndexForRuntime(runtime,assets.resolveLoadedAtlasTileCount());
    if(layout==="raw") expect(atlasTile).toBe(selected);
    else {
      expect(atlasTile).toBe(runtime);
      await assets.compileLegacyTilesetAtlasToNh5({width:640,height:448} as HTMLImageElement,16,null);
      const cell=drawImage.mock.calls.find(call=>call[5]===(runtime%40)*16 && call[6]===Math.floor(runtime/40)*16)!;
      expect(cell.slice(1,3)).toEqual([(selected%40)*16,Math.floor(selected/40)*16]);
    }
    options.darkCorridorWallSolidColorOverrideEnabled=true;
    expect(inference.resolveInferredDarkCorridorWallTileTextureIndex(17,true)).toBe(17);
    options.darkCorridorWallSolidColorOverrideEnabled=false;options.darkCorridorWallTileOverrideEnabled=false;
    expect(inference.resolveInferredDarkCorridorWallTileTextureIndex(17,true)).toBe(17);
  });
  it("extracts a second-row reference cell with its native height", () => {
    const { assets, drawImage, getImageData } = canvasFixture();
    const source = { width: 600, height: 975 } as HTMLImageElement;
    assets.captureTilesetBackgroundReferenceTile(source, 15, 25);
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(source, 15, 25, 15, 25, 0, 0, 15, 25);
    expect(getImageData).toHaveBeenCalledExactlyOnceWith(0, 0, 15, 25);
    expect(assets.tilesetBackgroundReferenceTilePixels).toHaveLength(15 * 25 * 4);
  });
  it("retains rectangular rows when translating a legacy atlas to NetHack 5", async () => {
    const { assets, drawImage } = canvasFixture();
    const source = { width: 600, height: 975 } as HTMLImageElement;
    const output = await assets.compileLegacyTilesetAtlasToNh5(source, 15, null, 25);
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
  it("lets loading frames run between atlas chunks and cancels superseded work", async () => {
    const { assets, drawImage } = canvasFixture();
    let current = true;
    const compilation = assets.compileLegacyTilesetAtlasToNh5(
      { width: 640, height: 448 } as HTMLImageElement, 16, null, 16, 16, 16, () => current,
    );
    const firstChunk = drawImage.mock.calls.length;
    expect(firstChunk).toBeGreaterThan(0);
    expect(firstChunk).toBeLessThanOrEqual(64);
    current = false;
    await expect(compilation).rejects.toThrow("superseded");
    expect(drawImage).toHaveBeenCalledTimes(firstChunk);
  });
});
