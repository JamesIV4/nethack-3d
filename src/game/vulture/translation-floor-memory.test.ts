import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VultureTilesetTranslator } from "./translation";
import { getGlyphCatalogEntry, getGlyphCatalogRanges, setActiveGlyphCatalog } from "../glyphs/registry";

let translator: VultureTilesetTranslator;
let cmapStart: number;
beforeEach(async () => {
  await setActiveGlyphCatalog("3.6.7");
  cmapStart = getGlyphCatalogRanges().find(range => range.kind === "cmap")!.start;
  translator = new VultureTilesetTranslator({ dataRootUrl: "unused", runtimeVersion: "3.6.7" });
  Object.assign(translator, { configLoaded: true, configLoadingStarted: true });
});
afterEach(() => translator.dispose());

function floor(cmap: number, x: number, y: number) {
  const glyph = cmapStart + cmap;
  return translator.resolveLookupForTile({ glyph, tileIndex: getGlyphCatalogEntry(glyph)!.tileIndex,
    tileX: x, tileY: y, materialKind: cmap === 20 ? "dark" : "floor", forBillboard: false });
}
function wall(cmap: number, x: number, y: number) {
  return translator.resolveWallFaceLookup({ face: "north", wallX: x, wallY: y - 1,
    floorX: x, floorY: y, floorGlyph: cmapStart + cmap,
    floorTileIndex: getGlyphCatalogEntry(cmapStart + cmap)!.tileIndex,
    floorMaterialKind: cmap === 20 ? "dark" : "floor", wallMaterialKind: "wall" });
}

describe("Vulture remembered room artwork", () => {
  it("keeps each resolved floor and rug tile when part of a room leaves sight", () => {
    const cells = Array.from({ length: 48 }, (_, i) => ({ x: 10 + i % 8, y: 10 + Math.floor(i / 8) }));
    for (const { x, y } of cells) floor(19, x, y);
    const known = cells.map(({ x, y }) => floor(19, x, y));
    expect(known.some(lookup => /CARPET|MURAL/.test(lookup?.name ?? ""))).toBe(true);
    const wallBefore = wall(19, 10, 10);
    translator.consumeRoomDecorDirtyCoordinateKeys();
    for (let i = 0; i < 24; i++) expect(floor(20, cells[i].x, cells[i].y)).toEqual(known[i]);
    expect(wall(20, 10, 10)).toEqual(wallBefore);
    expect(translator.consumeRoomDecorDirtyCoordinateKeys()).toEqual([]);
    for (let i = 24; i < cells.length; i++) expect(floor(19, cells[i].x, cells[i].y)).toEqual(known[i]);
    for (let i = 0; i < cells.length; i++) expect(floor(19, cells[i].x, cells[i].y)).toEqual(known[i]);
  });

  it("retains the last resolved hidden texture across unrelated room discovery", () => {
    const known = floor(19, 14, 15);
    expect(floor(20, 14, 15)).toEqual(known);
    floor(19, 55, 5); // Invalidates ordinary lookup caches.
    expect(floor(20, 14, 15)).toEqual(known);
  });

  it("does not invent artwork for dark squares never seen or restore obsolete terrain", () => {
    expect(floor(20, 14, 15)?.name).toBe("FLOOR_DARK_0_0");
    const known = floor(19, 14, 15);
    expect(floor(20, 14, 15)).toEqual(known);
    floor(31, 14, 15); // A real fountain replacement invalidates room-floor memory.
    expect(floor(20, 14, 15)?.name).toBe("FLOOR_DARK_0_0");
  });

  it("clears appearance memory with the runtime map state", () => {
    floor(19, 14, 15);
    translator.resetRuntimeMapState();
    expect(floor(20, 14, 15)?.name).toBe("FLOOR_DARK_0_0");
  });
});
