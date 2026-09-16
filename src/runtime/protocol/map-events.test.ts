import { expect, it } from "vitest";
import { bundleMapGlyphEvents } from "./map-events";

it("keeps same-cell transitions in order while bundling worker messages", () => {
  const tiles = [
    { type: "map_glyph", x: 4, y: 5, glyph: 10 },
    { type: "map_glyph", x: 4, y: 5, glyph: 11 },
    { type: "map_glyph", x: 5, y: 5, glyph: 12 },
  ];
  expect(bundleMapGlyphEvents(tiles, 2)).toEqual([
    { type: "map_glyph_batch", tiles: tiles.slice(0, 2) },
    { type: "map_glyph_batch", tiles: tiles.slice(2) },
  ]);
  expect(bundleMapGlyphEvents(tiles.slice(0, 1), 2)).toEqual([tiles[0]]);
});

it("reduces a large native display burst to bounded map records", () => {
  const tiles = Array.from({ length: 1000 }, (_, index) => ({
    type: "map_glyph",
    x: index % 80,
    y: Math.floor(index / 80),
    glyph: index,
  }));
  const records = bundleMapGlyphEvents(tiles, 384);
  expect(records).toHaveLength(3);
  expect(records.flatMap(record => record.tiles as typeof tiles)).toEqual(tiles);
});
