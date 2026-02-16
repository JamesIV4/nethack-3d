import type { TerrainSnapshot } from "../types";
import { getMergedGlyphOverride } from "./overrides";
import { resolveGlyph } from "./registry";
import type {
  GlyphDisposition,
  ResolvedGlyph,
  TileBehaviorResult,
  TileEffectKind,
  TileGeometryKind,
  TileMaterialKind,
} from "./types";

const PLAYER_GLYPH_MIN = 330;
const PLAYER_GLYPH_MAX = 360;

const DARK_OVERLAY_GLYPHS = new Set([2377, 2397, 2398]);

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

const CMAP_SEMANTICS: Record<number, CmapSemantic> = {};

function setCmapSemanticRange(
  start: number,
  endInclusive: number,
  semantic: CmapSemantic
): void {
  for (let glyph = start; glyph <= endInclusive; glyph++) {
    CMAP_SEMANTICS[glyph] = semantic;
  }
}

setCmapSemanticRange(2378, 2388, "wall");
setCmapSemanticRange(2419, 2440, "trap");
setCmapSemanticRange(2442, 2463, "feature");

Object.assign(CMAP_SEMANTICS, {
  2377: "dark_wall",
  2389: "door_closed",
  2390: "door_open",
  2391: "door_open",
  2392: "door_closed",
  2393: "door_closed",
  2394: "wall",
  2395: "wall",
  2396: "floor",
  2397: "dark_floor",
  2398: "dark_floor",
  2399: "floor",
  2400: "stairs_up",
  2401: "stairs_down",
  2402: "stairs_up",
  2403: "stairs_down",
  2404: "feature",
  2405: "feature",
  2406: "feature",
  2407: "floor",
  2408: "fountain",
  2409: "door_open",
  2410: "door_open",
  2411: "door_closed",
  2412: "door_closed",
  2413: "floor",
  2414: "floor",
  2415: "floor",
  2416: "wall",
  2417: "floor",
  2418: "feature",
  2441: "water",
});

function isPlayerGlyph(glyph: number, runtimeChar: string | null): boolean {
  if (glyph < PLAYER_GLYPH_MIN || glyph > PLAYER_GLYPH_MAX) {
    return false;
  }
  return runtimeChar === "@" || !runtimeChar;
}

function fallbackGlyphChar(glyph: number, resolved: ResolvedGlyph): string {
  if (resolved.char && resolved.char.length > 0) {
    return resolved.char;
  }
  return glyph >= 0 ? "?" : " ";
}

function inferDisposition(
  effective: ResolvedGlyph,
  isPlayer: boolean
): GlyphDisposition {
  if (isPlayer) {
    return "friendly";
  }

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
  effectKind: TileEffectKind | null
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
  disposition: GlyphDisposition
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

function classifyByKind(effective: ResolvedGlyph, isPlayer: boolean): {
  materialKind: TileMaterialKind;
  geometryKind: TileGeometryKind;
  isWall: boolean;
  effectKind: TileEffectKind | null;
} {
  if (isPlayer) {
    return {
      materialKind: "player",
      geometryKind: "floor",
      isWall: false,
      effectKind: null,
    };
  }

  switch (effective.kind) {
    case "cmap": {
      const semantic = CMAP_SEMANTICS[effective.glyph] || "feature";
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
        materialKind: baseMaterialForDisposition(inferDisposition(effective, false)),
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
  runtimeChar?: string | null;
  runtimeColor?: number | null;
  priorTerrain?: TerrainSnapshot | null;
}): TileBehaviorResult {
  const runtimeChar =
    typeof input.runtimeChar === "string" && input.runtimeChar.length > 0
      ? input.runtimeChar.charAt(0)
      : null;

  const resolved = resolveGlyph(input.glyph, runtimeChar, input.runtimeColor);
  const resolvedCmapSemantic =
    resolved.kind === "cmap" ? CMAP_SEMANTICS[resolved.glyph] ?? null : null;
  const isDeterministicDarkCmap =
    resolvedCmapSemantic === "dark_floor" || resolvedCmapSemantic === "dark_wall";
  const isDarkOverlay = DARK_OVERLAY_GLYPHS.has(input.glyph);
  const isPlayer = isPlayerGlyph(input.glyph, runtimeChar);

  let effective = resolved;
  let darkenFactor = 1;
  // Keep explicit dark cmap tiles deterministic; only unknown overlays borrow prior terrain.
  if (isDarkOverlay && !isDeterministicDarkCmap) {
    if (input.priorTerrain) {
      effective = resolveGlyph(
        input.priorTerrain.glyph,
        input.priorTerrain.char ?? null,
        input.priorTerrain.color ?? null
      );
    }
    darkenFactor = input.glyph === 2398 ? 0.45 : 0.6;
  }

  const disposition = inferDisposition(effective, isPlayer);
  const byKind = classifyByKind(effective, isPlayer);
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
    if (typeof override.glyphChar === "string" && override.glyphChar.length > 0) {
      glyphChar = override.glyphChar.charAt(0);
    }
    if (typeof override.textColor === "string" && override.textColor.length > 0) {
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
    isPlayerGlyph: isPlayer,
    isDarkOverlay,
    darkenFactor,
    glyphChar,
    textColor,
    disposition: resolvedDisposition,
    effectKind,
  };
}
