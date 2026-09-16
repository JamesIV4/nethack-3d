import type { RuntimeCell } from "./types";

// Verified COLNO/ROWNO in all three staged game sources' include/global.h.
export const defaultRuntimeMapDimensions = { columns: 80, rows: 21 } as const;
export interface RuntimeMapDimensions { columns: number; rows: number }

export function resolveRuntimeMapDimensions(value?: Partial<RuntimeMapDimensions> | null): RuntimeMapDimensions {
  return Number.isSafeInteger(value?.columns) && Number.isSafeInteger(value?.rows) &&
    value!.columns! > 0 && value!.rows! > 0 && value!.columns! <= 256 && value!.rows! <= 256
    ? { columns: value!.columns!, rows: value!.rows! } : defaultRuntimeMapDimensions;
}

export function runtimeMapContains(x: number, y: number, dimensions: RuntimeMapDimensions): boolean {
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x < dimensions.columns && y < dimensions.rows;
}

export function refreshAreaCells(centerX: number, centerY: number, radius: number, dimensions: RuntimeMapDimensions): RuntimeCell[] {
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return [];
  const x = Math.trunc(centerX), y = Math.trunc(centerY);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return [];
  const r = Number.isFinite(radius) && radius >= 0 ? Math.trunc(radius) : 0;
  const cells: RuntimeCell[] = [];
  for (let tileX = Math.max(0, x - r); tileX <= Math.min(dimensions.columns - 1, x + r); tileX++) {
    for (let tileY = Math.max(0, y - r); tileY <= Math.min(dimensions.rows - 1, y + r); tileY++) cells.push({ x: tileX, y: tileY });
  }
  return cells;
}
