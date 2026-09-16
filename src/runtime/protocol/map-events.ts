import type { RuntimeEvent } from "../types";

/** Preserve every observed map transition while reducing worker messages. */
export function bundleMapGlyphEvents(
  tiles: readonly RuntimeEvent[],
  maxTiles: number,
): RuntimeEvent[] {
  if (tiles.length === 0) return [];
  if (tiles.length === 1) return [tiles[0]];
  const chunkSize = Number.isSafeInteger(maxTiles) && maxTiles > 0
    ? maxTiles
    : tiles.length;
  const events: RuntimeEvent[] = [];
  for (let start = 0; start < tiles.length; start += chunkSize) {
    events.push({
      type: "map_glyph_batch",
      tiles: tiles.slice(start, start + chunkSize),
    });
  }
  return events;
}
