import type { TerrainSnapshot } from "../types";
import { getMergedGlyphOverride } from "./overrides";
import {
  getActiveGlyphCatalogVersion,
  getGlyphCatalogEntry,
  getGlyphCatalogRanges,
  resolveGlyph,
} from "./registry";
import type {
  GlyphDisposition,
  GlyphKind,
  ResolvedGlyph,
  TileBehaviorResult,
  TileEffectKind,
  TileGeometryKind,
  TileMaterialKind,
} from "./types";

function getGlyphKindRange(
  kind: string,
): { start: number; endExclusive: number } | null {
  const ranges = getGlyphCatalogRanges();
  for (const range of ranges) {
    if (range.kind === kind) {
      return { start: range.start, endExclusive: range.endExclusive };
    }
  }
  return null;
}

function normalizeRuntimeCmapIndex(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
}

function normalizeRuntimeCmapChar(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const normalized = value.charAt(0);
  const code = normalized.charCodeAt(0);
  if (code === 0 || code === 0x7f) {
    return null;
  }
  return normalized;
}

function getPreferredRuntimeCmapIndex(
  glyph: number,
  runtimeSymidx?: number | null,
  priorTerrain?: TerrainSnapshot | null,
): number | null {
  const runtimeCmapIndex = normalizeRuntimeCmapIndex(runtimeSymidx);
  if (runtimeCmapIndex !== null) {
    return runtimeCmapIndex;
  }
  if (
    priorTerrain &&
    priorTerrain.glyph === glyph &&
    typeof priorTerrain.symidx === "number"
  ) {
    return normalizeRuntimeCmapIndex(priorTerrain.symidx);
  }
  return null;
}

function getCmapIndex(glyph: number, runtimeSymidx?: number | null): number | null {
  const entry = getGlyphCatalogEntry(glyph);
  if (entry) {
    if (entry.kind !== "cmap") {
      return null;
    }
    const runtimeCmapIndex = normalizeRuntimeCmapIndex(runtimeSymidx);
    if (runtimeCmapIndex !== null) {
      return runtimeCmapIndex;
    }
    if (typeof entry.symidx === "number" && Number.isFinite(entry.symidx)) {
      const semanticIndex = Math.trunc(entry.symidx);
      if (semanticIndex >= 0) {
        return semanticIndex;
      }
    }
  }

  const range = getGlyphKindRange("cmap");
  if (!range) {
    return null;
  }
  if (glyph < range.start || glyph >= range.endExclusive) {
    return null;
  }
  const runtimeCmapIndex = normalizeRuntimeCmapIndex(runtimeSymidx);
  if (runtimeCmapIndex !== null) {
    return runtimeCmapIndex;
  }
  return glyph - range.start;
}

let cmapRepresentativeGlyphCache:
  | {
      cacheKey: string;
      byCmapIndex: Map<number, number>;
    }
  | null = null;

function getCmapRepresentativeLookup(
  range: { start: number; endExclusive: number },
): Map<number, number> {
  const cacheKey = `${range.start}:${range.endExclusive}`;
  if (cmapRepresentativeGlyphCache?.cacheKey === cacheKey) {
    return cmapRepresentativeGlyphCache.byCmapIndex;
  }

  const byCmapIndex = new Map<number, number>();
  for (let glyph = range.start; glyph < range.endExclusive; glyph += 1) {
    const entry = getGlyphCatalogEntry(glyph);
    if (!entry || entry.kind !== "cmap") {
      continue;
    }
    const cmapIndex =
      typeof entry.symidx === "number" && Number.isFinite(entry.symidx)
        ? Math.trunc(entry.symidx)
        : glyph - range.start;
    if (cmapIndex < 0 || byCmapIndex.has(cmapIndex)) {
      continue;
    }
    byCmapIndex.set(cmapIndex, glyph);
  }

  cmapRepresentativeGlyphCache = { cacheKey, byCmapIndex };
  return byCmapIndex;
}

function getRepresentativeCmapGlyph(cmapIndex: number): number | null {
  const range = getGlyphKindRange("cmap");
  if (!range) {
    return null;
  }

  const representativeGlyph =
    getCmapRepresentativeLookup(range).get(Math.trunc(cmapIndex)) ?? null;
  if (representativeGlyph !== null) {
    return representativeGlyph;
  }

  const fallbackGlyph = range.start + cmapIndex;
  if (fallbackGlyph >= range.start && fallbackGlyph < range.endExclusive) {
    return fallbackGlyph;
  }
  return null;
}

export function getDefaultFloorGlyph(): number {
  // drawing.c: S_room is index 19 ("floor of a room").
  return getRepresentativeCmapGlyph(19) ?? 0;
}

export function getDefaultDarkFloorGlyph(): number {
  // drawing.c: index 21 is dark corridor, which is a good unseen-dark fallback.
  return getRepresentativeCmapGlyph(21) ?? getDefaultFloorGlyph();
}

export function getDefaultDarkWallGlyph(): number {
  // drawing.c: index 0 is stone/out-of-bounds and classifies as dark wall.
  return getRepresentativeCmapGlyph(0) ?? getDefaultDarkFloorGlyph();
}

export function getOpenDoorGlyphFrom(glyph: number): number | null {
  const cmapIndex = getCmapIndex(glyph, null);
  if (cmapIndex === null) {
    return null;
  }
  if (cmapIndex === 13 || cmapIndex === 14) {
    return glyph;
  }
  if (cmapIndex === 15) {
    return getRepresentativeCmapGlyph(13);
  }
  if (cmapIndex === 16) {
    return getRepresentativeCmapGlyph(14);
  }
  return null;
}

export function isDarkCorridorCmapGlyph(glyph: number): boolean {
  return getCmapIndex(glyph, null) === 21;
}

export function isDoorwayCmapGlyph(glyph: number): boolean {
  const cmapIndex = getCmapIndex(glyph, null);
  return (
    cmapIndex === 12 || // doorway
    cmapIndex === 13 || // open vertical door
    cmapIndex === 14 || // open horizontal door
    cmapIndex === 15 || // closed vertical door
    cmapIndex === 16 // closed horizontal door
  );
}

export function isVerticalDoorCmapGlyph(glyph: number): boolean {
  const cmapIndex = getCmapIndex(glyph, null);
  return cmapIndex === 13 || cmapIndex === 15;
}

type CmapSemantic =
  | "wall"
  | "floor"
  | "door_open"
  | "door_closed"
  | "stairs_up"
  | "stairs_down"
  | "fountain"
  | "water"
  | "trap"
  | "feature"
  | "dark_floor"
  | "dark_wall";

type CmapIndexProfile = {
  wall: ReadonlySet<number>;
  doorOpen: ReadonlySet<number>;
  doorClosed: ReadonlySet<number>;
  darkFloor: ReadonlySet<number>;
  floor: ReadonlySet<number>;
  stairsUp: ReadonlySet<number>;
  stairsDown: ReadonlySet<number>;
  sink: ReadonlySet<number>;
  fountain: ReadonlySet<number>;
  water: ReadonlySet<number>;
  tombstone: ReadonlySet<number>;
  trapRanges: ReadonlyArray<readonly [number, number]>;
};

const LEGACY_367_CMAP_PROFILE: CmapIndexProfile = {
  wall: new Set<number>([17, 18, 37, 38]),
  doorOpen: new Set<number>([13, 14]),
  doorClosed: new Set<number>([15, 16]),
  darkFloor: new Set<number>([20, 21]),
  floor: new Set<number>([12, 19, 22, 35, 36]),
  stairsUp: new Set<number>([23, 25]),
  stairsDown: new Set<number>([24, 26]),
  sink: new Set<number>([30]),
  fountain: new Set<number>([31]),
  water: new Set<number>([32, 34, 41]),
  tombstone: new Set<number>([28]),
  trapRanges: [[42, 64]],
};

const NH5_SPLIT_CMAP_PROFILE: CmapIndexProfile = {
  wall: new Set<number>([17, 18, 44, 45]),
  doorOpen: new Set<number>([13, 14]),
  doorClosed: new Set<number>([15, 16]),
  darkFloor: new Set<number>([20, 22]),
  floor: new Set<number>([12, 19, 21, 23, 24, 42, 43]),
  stairsUp: new Set<number>([25, 27, 29, 31]),
  stairsDown: new Set<number>([26, 28, 30, 32]),
  sink: new Set<number>([36]),
  fountain: new Set<number>([37]),
  water: new Set<number>([38, 40, 41, 48]),
  tombstone: new Set<number>([34]),
  trapRanges: [[49, 73]],
};

function getActiveCmapIndexProfile(): CmapIndexProfile {
  return getActiveGlyphCatalogVersion() === "5.0"
    ? NH5_SPLIT_CMAP_PROFILE
    : LEGACY_367_CMAP_PROFILE;
}

export function isSinkCmapGlyph(glyph: number): boolean {
  const cmapIndex = getCmapIndex(glyph, null);
  return (
    cmapIndex !== null && getActiveCmapIndexProfile().sink.has(cmapIndex)
  );
}

export function isIronBarsCmapGlyph(glyph: number): boolean {
  return getCmapIndex(glyph, null) === 17;
}

function isIndexInAnyInclusiveRange(
  index: number,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean {
  for (const [min, max] of ranges) {
    if (index >= min && index <= max) {
      return true;
    }
  }
  return false;
}

function semanticForCmapIndex(cmapIndex: number): CmapSemantic {
  // Runtime symidx can differ between legacy 3.6.x and 5.0 split-cmap layouts.
  const profile = getActiveCmapIndexProfile();
  if (cmapIndex === 0) return "dark_wall"; // stone/out-of-bounds

  // Core walls and wall-like obstacles.
  if (cmapIndex >= 1 && cmapIndex <= 11) return "wall";
  if (profile.wall.has(cmapIndex)) return "wall";
  if (profile.doorClosed.has(cmapIndex)) return "door_closed";

  // Doors and floors.
  if (profile.doorOpen.has(cmapIndex)) return "door_open";
  if (profile.darkFloor.has(cmapIndex)) return "dark_floor";
  if (profile.floor.has(cmapIndex)) return "floor";

  // Stairs/ladders.
  if (profile.stairsUp.has(cmapIndex)) return "stairs_up";
  if (profile.stairsDown.has(cmapIndex)) return "stairs_down";

  // Water-ish terrain.
  if (profile.fountain.has(cmapIndex)) return "fountain";
  if (profile.water.has(cmapIndex)) return "water";

  // Traps (including the vibrating square).
  if (isIndexInAnyInclusiveRange(cmapIndex, profile.trapRanges)) return "trap";

  // Everything else is treated as a passable floor feature.
  return "feature";
}

function semanticForRuntimeCmapChar(
  runtimeCmapIndex: number | null,
  runtimeCmapChar: string | null,
): CmapSemantic | null {
  const profile = getActiveCmapIndexProfile();
  if (runtimeCmapChar === "<") {
    return "stairs_up";
  }
  if (runtimeCmapChar === ">") {
    return "stairs_down";
  }
  if (runtimeCmapChar === "_") {
    return "feature";
  }
  if (
    runtimeCmapChar === "|" &&
    runtimeCmapIndex !== null &&
    profile.tombstone.has(runtimeCmapIndex)
  ) {
    return "feature";
  }
  if (runtimeCmapChar === "{") {
    if (runtimeCmapIndex !== null && profile.sink.has(runtimeCmapIndex)) {
      return "feature";
    }
    return "fountain";
  }
  if (runtimeCmapChar === "}") {
    return "water";
  }
  return null;
}

function semanticForCmapGlyph(
  glyph: number,
  runtimeSymidx?: number | null,
): CmapSemantic | null {
  const cmapIndex = getCmapIndex(glyph, runtimeSymidx);
  if (cmapIndex === null) {
    return null;
  }
  return semanticForCmapIndex(cmapIndex);
}

function fallbackGlyphChar(glyph: number, resolved: ResolvedGlyph): string {
  if (resolved.char && resolved.char.length > 0) {
    return resolved.char;
  }
  return glyph >= 0 ? "?" : " ";
}

function inferDisposition(effective: ResolvedGlyph): GlyphDisposition {
  switch (effective.kind) {
    case "pet":
    case "ridden":
      return "friendly";
    case "mon":
    case "warning":
    case "explode":
    case "zap":
    case "swallow":
      return "hostile";
    case "detect":
    case "statue":
    case "invis":
      return "neutral";
    default:
      return "unknown";
  }
}

function textColorFor(
  disposition: GlyphDisposition,
  effective: ResolvedGlyph,
  effectKind: TileEffectKind | null,
): string {
  if (effectKind === "warning") return "#FFF9E8";
  if (effectKind === "zap") return "#F3FBFF";
  if (effectKind === "explode") return "#FFF4EC";
  if (effectKind === "swallow") return "#FAF2FF";

  switch (effective.kind) {
    case "obj":
    case "body":
      return "#FFF7D6";
    case "cmap":
      return "#F4F4F4";
    default:
      break;
  }

  switch (disposition) {
    case "friendly":
      return "#F7FFF9";
    case "hostile":
      return "#FFF5F5";
    case "neutral":
      return "#F3F8FF";
    default:
      return "#F4F4F4";
  }
}

function applyCmapSemantic(semantic: CmapSemantic): {
  materialKind: TileMaterialKind;
  geometryKind: TileGeometryKind;
  isWall: boolean;
  effectKind: TileEffectKind | null;
} {
  switch (semantic) {
    case "wall":
      return {
        materialKind: "wall",
        geometryKind: "wall",
        isWall: true,
        effectKind: null,
      };
    case "dark_wall":
      return {
        materialKind: "dark_wall",
        geometryKind: "wall",
        isWall: true,
        effectKind: null,
      };
    case "door_closed":
      return {
        materialKind: "door",
        geometryKind: "wall",
        isWall: true,
        effectKind: null,
      };
    case "door_open":
      return {
        materialKind: "door",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "stairs_up":
      return {
        materialKind: "stairs_up",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "stairs_down":
      return {
        materialKind: "stairs_down",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "floor":
      return {
        materialKind: "floor",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "dark_floor":
      return {
        materialKind: "dark",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "fountain":
      return {
        materialKind: "fountain",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "water":
      return {
        materialKind: "water",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "trap":
      return {
        materialKind: "trap",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "feature":
    default:
      return {
        materialKind: "feature",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
  }
}

function baseMaterialForDisposition(
  disposition: GlyphDisposition,
): TileMaterialKind {
  switch (disposition) {
    case "friendly":
      return "monster_friendly";
    case "hostile":
      return "monster_hostile";
    case "neutral":
      return "monster_neutral";
    default:
      return "monster_hostile";
  }
}

function classifyByKind(
  effective: ResolvedGlyph,
  runtimeCmapIndex: number | null,
  runtimeCmapChar: string | null,
): {
  materialKind: TileMaterialKind;
  geometryKind: TileGeometryKind;
  isWall: boolean;
  effectKind: TileEffectKind | null;
} {
  switch (effective.kind) {
    case "cmap": {
      const semanticFromRuntimeChar = semanticForRuntimeCmapChar(
        runtimeCmapIndex,
        runtimeCmapChar,
      );
      const semantic =
        semanticFromRuntimeChar ??
        semanticForCmapGlyph(effective.glyph, runtimeCmapIndex) ??
        "feature";
      return applyCmapSemantic(semantic);
    }
    case "obj":
    case "body":
      return {
        materialKind: "item",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "warning":
      return {
        materialKind: "effect_warning",
        geometryKind: "floor",
        isWall: false,
        effectKind: "warning",
      };
    case "zap":
      return {
        materialKind: "effect_zap",
        geometryKind: "floor",
        isWall: false,
        effectKind: "zap",
      };
    case "explode":
      return {
        materialKind: "effect_explode",
        geometryKind: "floor",
        isWall: false,
        effectKind: "explode",
      };
    case "swallow":
      return {
        materialKind: "effect_swallow",
        geometryKind: "floor",
        isWall: false,
        effectKind: "swallow",
      };
    case "statue":
      return {
        materialKind: "monster_neutral",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    case "mon":
    case "pet":
    case "detect":
    case "ridden":
    case "invis":
      return {
        materialKind: baseMaterialForDisposition(inferDisposition(effective)),
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
    default:
      return {
        materialKind: "default",
        geometryKind: "floor",
        isWall: false,
        effectKind: null,
      };
  }
}

export function classifyTileBehavior(input: {
  glyph: number;
  runtimeKind?: GlyphKind | null;
  runtimeChar?: string | null;
  runtimeColor?: number | null;
  runtimeTileIndex?: number | null;
  runtimeSymidx?: number | null;
  priorTerrain?: TerrainSnapshot | null;
}): TileBehaviorResult {
  const runtimeChar =
    typeof input.runtimeChar === "string" && input.runtimeChar.length > 0
      ? input.runtimeChar.charAt(0)
      : null;
  const runtimeKind =
    input.runtimeKind ??
    (input.priorTerrain &&
    input.priorTerrain.glyph === input.glyph &&
    typeof input.priorTerrain.kind === "string"
      ? input.priorTerrain.kind
      : null);

  const resolved = resolveGlyph(
    input.glyph,
    runtimeChar,
    input.runtimeColor,
    input.runtimeTileIndex,
    runtimeKind,
  );
  const runtimeCmapIndexForInputGlyph = getPreferredRuntimeCmapIndex(
    input.glyph,
    input.runtimeSymidx,
    input.priorTerrain,
  );
  const resolvedRuntimeCmapIndex =
    resolved.kind === "cmap"
      ? getPreferredRuntimeCmapIndex(
          resolved.glyph,
          input.runtimeSymidx,
          input.priorTerrain,
        )
      : null;
  const resolvedCmapSemantic =
    resolved.kind === "cmap"
      ? semanticForCmapGlyph(resolved.glyph, resolvedRuntimeCmapIndex)
      : null;
  const isDeterministicDarkCmap =
    resolvedCmapSemantic === "dark_floor" ||
    resolvedCmapSemantic === "dark_wall";
  const darkOverlayIndex = getCmapIndex(
    input.glyph,
    runtimeCmapIndexForInputGlyph,
  );
  const isDarkOverlay =
    darkOverlayIndex === 0 ||
    darkOverlayIndex === 20 ||
    darkOverlayIndex === 21;
  // Player location is authoritative from shim_cliparound (player_position),
  // not from glyph range heuristics.
  const isPlayerGlyph = false;

  let effective = resolved;
  let darkenFactor = 1;
  // Keep explicit dark cmap tiles deterministic; only unknown overlays borrow prior terrain.
  if (isDarkOverlay && !isDeterministicDarkCmap) {
    if (input.priorTerrain) {
      effective = resolveGlyph(
        input.priorTerrain.glyph,
        input.priorTerrain.char ?? null,
        input.priorTerrain.color ?? null,
        input.priorTerrain.tileIndex ?? null,
        input.priorTerrain.kind ?? null,
      );
    }
    darkenFactor = darkOverlayIndex === 21 ? 0.45 : 0.6;
  }

  const disposition = inferDisposition(effective);
  const effectiveRuntimeCmapIndex =
    effective.kind === "cmap"
      ? getPreferredRuntimeCmapIndex(
          effective.glyph,
          input.runtimeSymidx,
          input.priorTerrain,
        )
      : null;
  const effectiveRuntimeCmapChar =
    effective.kind === "cmap"
      ? normalizeRuntimeCmapChar(runtimeChar) ??
        (input.priorTerrain &&
        input.priorTerrain.glyph === effective.glyph &&
        typeof input.priorTerrain.char === "string"
          ? normalizeRuntimeCmapChar(input.priorTerrain.char)
          : null) ??
        normalizeRuntimeCmapChar(effective.char)
      : null;
  const byKind = classifyByKind(
    effective,
    effectiveRuntimeCmapIndex,
    effectiveRuntimeCmapChar,
  );
  let materialKind = byKind.materialKind;
  let geometryKind = byKind.geometryKind;
  let isWall = byKind.isWall;
  let effectKind = byKind.effectKind;
  let glyphChar = isDarkOverlay
    ? fallbackGlyphChar(input.glyph, resolved)
    : fallbackGlyphChar(effective.glyph, effective);
  let textColor = textColorFor(disposition, effective, effectKind);
  let resolvedDisposition: GlyphDisposition = disposition;

  const override = getMergedGlyphOverride(input.glyph, effective.kind);
  if (override) {
    if (override.materialKind) materialKind = override.materialKind;
    if (override.geometryKind) geometryKind = override.geometryKind;
    if (typeof override.isWall === "boolean") isWall = override.isWall;
    if (
      typeof override.glyphChar === "string" &&
      override.glyphChar.length > 0
    ) {
      glyphChar = override.glyphChar.charAt(0);
    }
    if (
      typeof override.textColor === "string" &&
      override.textColor.length > 0
    ) {
      textColor = override.textColor;
    }
    if (typeof override.darkenFactor === "number") {
      darkenFactor = override.darkenFactor;
    }
    if (override.disposition) {
      resolvedDisposition = override.disposition;
      if (!override.textColor) {
        textColor = textColorFor(resolvedDisposition, effective, effectKind);
      }
    }
    if (override.effectKind !== undefined) {
      effectKind = override.effectKind;
      if (!override.textColor) {
        textColor = textColorFor(resolvedDisposition, effective, effectKind);
      }
    }
  }

  // Dot glyphs should always render flat, even when the underlying semantic is wall-like.
  if (glyphChar.trim() === ".") {
    if (materialKind === "wall" || materialKind === "dark_wall") {
      materialKind = "floor";
    }
    geometryKind = "floor";
    isWall = false;
  }

  return {
    resolved,
    effective,
    materialKind,
    geometryKind,
    isWall,
    isPlayerGlyph,
    isDarkOverlay,
    darkenFactor,
    glyphChar,
    textColor,
    disposition: resolvedDisposition,
    effectKind,
  };
}
