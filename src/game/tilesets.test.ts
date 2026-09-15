import { afterEach, describe, expect, it } from "vitest";
import {
  clearNh3dUserTilesets, findNh3dTilesetByPath, getNh3dCompatibleTilesetCatalog,
  inferNh3dTilesetTileDimensions, isNh3dTilesetExactBackgroundRemovalForced,
  resolveDefaultNh3dTilesetBackgroundRemovalMode, resolveDefaultNh3dTilesetBackgroundTileId,
  resolveDefaultNh3dTilesetSolidChromaKeyColorHex,
  setNh3dUserTilesets,
} from "./tilesets";
import { shouldTranslateNh367TilesetForNh5Runtime } from "./tileset-367-to-5-translation";

afterEach(() => clearNh3dUserTilesets());
describe("DuskHack built-in support", () => {
  it("offers its original 16px sheet for 3.6 and translates it for NetHack 5", () => {
    const path = "assets/3.6/DuskHack.bmp";
    expect(findNh3dTilesetByPath(path)).toMatchObject({ label: "DuskHack", tileSize: 16, tileLayoutVersion: "3.6.7", source: "builtin" });
    for (const version of ["3.6.7", "5.0"] as const) {
      expect(getNh3dCompatibleTilesetCatalog(version).some(entry => entry.path === path)).toBe(true);
    }
    expect(getNh3dCompatibleTilesetCatalog("slashem").some(entry => entry.path === path)).toBe(false);
    expect(inferNh3dTilesetTileDimensions(640, 592, path)).toEqual({ tileWidth: 16, tileHeight: 16 });
    expect(shouldTranslateNh367TilesetForNh5Runtime("5.0", 1480, "3.6.7")).toBe(true);
    expect(resolveDefaultNh3dTilesetBackgroundRemovalMode(path)).toBe("solid");
    expect(resolveDefaultNh3dTilesetSolidChromaKeyColorHex(path)).toBe("#000000");
    expect(resolveDefaultNh3dTilesetBackgroundTileId(path)).toBe(850);
  });
});
describe("rectangular tileset dimensions", () => {
  it.each([["3.6.7", 975, 1476, "assets/3.6/Geoduck.bmp"], ["5.0", 1500, 2304, "assets/5.0/Geoduck.bmp"]] as const)(
    "registers the native Geoduck sheet for %s", (version, height, background, path) => {
      expect(getNh3dCompatibleTilesetCatalog(version).some(entry => entry.path === path)).toBe(true);
      expect(findNh3dTilesetByPath(path)).toMatchObject({ tileSize: 15, tileHeight: 25 });
      expect(inferNh3dTilesetTileDimensions(600, height, path)).toEqual({ tileWidth: 15, tileHeight: 25 });
      expect(inferNh3dTilesetTileDimensions(600, height, undefined, version)).toEqual({ tileWidth: 15, tileHeight: 25 });
      expect(resolveDefaultNh3dTilesetBackgroundRemovalMode(path)).toBe("tile");
      expect(resolveDefaultNh3dTilesetBackgroundTileId(path)).toBe(background);
      expect(isNh3dTilesetExactBackgroundRemovalForced(path)).toBe(true);
    },
  );
  it("preserves square sheets, including unknown heights, and honors stored rectangular cells", () => {
    expect(inferNh3dTilesetTileDimensions(1280, 1248)).toEqual({ tileWidth: 32, tileHeight: 32 });
    expect(inferNh3dTilesetTileDimensions(600, 600)).toEqual({ tileWidth: 15, tileHeight: 15 });
    setNh3dUserTilesets([{ id: "rectangle", label: "Rectangle", tileSize: 20, tileHeight: 30, blob: new Blob() }]);
    expect(inferNh3dTilesetTileDimensions(800, 1200, "user:rectangle")).toEqual({ tileWidth: 20, tileHeight: 30 });
    expect(getNh3dCompatibleTilesetCatalog("slashem").some(entry => entry.path.endsWith("Geoduck.bmp"))).toBe(false);
  });
});
