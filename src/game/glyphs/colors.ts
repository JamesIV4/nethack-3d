const NETHACK_NO_COLOR_INDEX = 8;

const NETHACK_COLOR_HEX_BY_INDEX: Readonly<Record<number, string>> = {
  0: "#000000",
  1: "#c62828",
  2: "#2e7d32",
  3: "#9c3d30",
  4: "#1565c0",
  5: "#8e24aa",
  6: "#00838f",
  7: "#9e9e9e",
  9: "#ef6c00",
  10: "#66bb6a",
  11: "#fdd835",
  12: "#42a5f5",
  13: "#ec407a",
  14: "#26c6da",
  15: "#ffffff",
};

export function normalizeNetHackColorIndex(
  color: number | null | undefined,
): number | null {
  if (typeof color !== "number" || !Number.isFinite(color)) {
    return null;
  }
  return Math.trunc(color);
}

export function isNetHackNoColorIndex(
  color: number | null | undefined,
): boolean {
  const normalized = normalizeNetHackColorIndex(color);
  return normalized === NETHACK_NO_COLOR_INDEX;
}

export function getNetHackColorHex(
  color: number | null | undefined,
): string | null {
  const normalized = normalizeNetHackColorIndex(color);
  if (normalized === null || normalized === NETHACK_NO_COLOR_INDEX) {
    return null;
  }
  const value = NETHACK_COLOR_HEX_BY_INDEX[normalized];
  return typeof value === "string" ? value : null;
}
