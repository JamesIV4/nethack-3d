import type {
  TileFaceTextureRotationOverrides,
  TileFaceTextureSlot,
} from "../shared/types";

export const tileFaceTextureRotationsEndpoint =
  "/__nh3d/tile-face-texture-rotations";

// Set this to true when another localhost calibration pass is needed.
export const NH3D_INTERNAL_TILE_FACE_TEXTURE_ROTATION_DEBUG_ENABLED = false;

export const tileFaceTextureSlots: readonly TileFaceTextureSlot[] = [
  "east",
  "west",
  "north",
  "south",
  "top",
  "bottom",
];

export const defaultTileFaceTextureRotationOverrides: TileFaceTextureRotationOverrides = {
  "5.0:tile:1273": { north: 90, south: 90 },
  "5.0:tile:1274": { east: 90, north: 180, south: 180 },
  "5.0:tile:1275": { west: 180, south: 180 },
  "5.0:tile:1276": { south: 180 },
  "5.0:tile:1277": { west: 180, north: 270, south: 180 },
  "5.0:tile:1278": { west: 90, south: 180 },
};

export function createDefaultTileFaceTextureRotationOverrides(): TileFaceTextureRotationOverrides {
  return Object.fromEntries(
    Object.entries(defaultTileFaceTextureRotationOverrides).map(
      ([variant, faces]) => [variant, { ...faces }],
    ),
  );
}

export function mergeTileFaceTextureRotationOverrides(
  base: TileFaceTextureRotationOverrides,
  overrides: TileFaceTextureRotationOverrides,
): TileFaceTextureRotationOverrides {
  const merged: TileFaceTextureRotationOverrides = Object.fromEntries(
    Object.entries(base).map(([variant, faces]) => [variant, { ...faces }]),
  );
  for (const [variant, faces] of Object.entries(overrides)) {
    merged[variant] = { ...(merged[variant] ?? {}), ...faces };
  }
  return merged;
}

export function normalizeTileFaceRotationDegrees(rawValue: unknown): number | null {
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return null;
  }
  const quarterTurns = ((Math.round(rawValue / 90) % 4) + 4) % 4;
  return quarterTurns * 90;
}

export function isLocalhostTileFaceTextureDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const hostname = String(window.location?.hostname || "")
    .trim()
    .toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

export function normalizeTileFaceTextureRotationOverrides(
  rawPayload: unknown,
): TileFaceTextureRotationOverrides {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return {};
  }
  const rawRotations = (rawPayload as { rotations?: unknown }).rotations;
  if (
    !rawRotations ||
    typeof rawRotations !== "object" ||
    Array.isArray(rawRotations)
  ) {
    return {};
  }

  const normalized: TileFaceTextureRotationOverrides = {};
  for (const [rawVariant, rawFaces] of Object.entries(rawRotations)) {
    const variant = rawVariant.trim();
    if (
      !variant ||
      variant.length > 80 ||
      !/^(?:3\.6\.7|5\.0|slashem):tile:\d+$/.test(variant) ||
      !rawFaces ||
      typeof rawFaces !== "object" ||
      Array.isArray(rawFaces)
    ) {
      continue;
    }
    const faces: Partial<Record<TileFaceTextureSlot, number>> = {};
    for (const face of tileFaceTextureSlots) {
      const rotation = normalizeTileFaceRotationDegrees(
        (rawFaces as Record<string, unknown>)[face],
      );
      if (rotation !== null && rotation !== 0) {
        faces[face] = rotation;
      }
    }
    if (Object.keys(faces).length > 0) {
      normalized[variant] = faces;
    }
  }
  return normalized;
}

export function serializeTileFaceTextureRotationOverrides(
  overrides: TileFaceTextureRotationOverrides,
): {
  formatVersion: 1;
  rotations: TileFaceTextureRotationOverrides;
} {
  const rotations: TileFaceTextureRotationOverrides = {};
  for (const variant of Object.keys(overrides).sort()) {
    const sourceFaces = overrides[variant];
    if (!sourceFaces) {
      continue;
    }
    const faces: Partial<Record<TileFaceTextureSlot, number>> = {};
    for (const face of tileFaceTextureSlots) {
      const rotation = normalizeTileFaceRotationDegrees(sourceFaces[face]);
      if (rotation !== null && rotation !== 0) {
        faces[face] = rotation;
      }
    }
    if (Object.keys(faces).length > 0) {
      rotations[variant] = faces;
    }
  }
  return { formatVersion: 1, rotations };
}
