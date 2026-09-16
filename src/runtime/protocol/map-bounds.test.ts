import { expect, it } from "vitest";
import { defaultRuntimeMapDimensions, refreshAreaCells, resolveRuntimeMapDimensions, runtimeMapContains } from "./map-bounds";

it("bounds large refresh areas before allocating cells and retains x-major order", () => {
  expect(refreshAreaCells(0, 0, 1, defaultRuntimeMapDimensions)).toEqual([
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  ]);
  const cells = refreshAreaCells(10, 10, 1_000_000, defaultRuntimeMapDimensions);
  expect(cells).toHaveLength(80 * 21);
  expect(cells.every(cell => runtimeMapContains(cell.x, cell.y, defaultRuntimeMapDimensions))).toBe(true);
  expect(refreshAreaCells(NaN, 1, 3, defaultRuntimeMapDimensions)).toEqual([]);
});

it("uses published dimensions when valid and the verified legacy dimensions otherwise", () => {
  expect(resolveRuntimeMapDimensions({ columns: 100, rows: 40 })).toEqual({ columns: 100, rows: 40 });
  expect(resolveRuntimeMapDimensions({ columns: Infinity, rows: 21 })).toEqual(defaultRuntimeMapDimensions);
  expect(runtimeMapContains(80, 10, defaultRuntimeMapDimensions)).toBe(false);
  expect(runtimeMapContains(4, 21, defaultRuntimeMapDimensions)).toBe(false);
  expect(runtimeMapContains(-1, 0, defaultRuntimeMapDimensions)).toBe(false);
});
