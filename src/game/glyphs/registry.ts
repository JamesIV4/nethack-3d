import type { NethackRuntimeVersion } from "../../runtime/types";
import {
  GLYPH_CATALOG as GLYPH_CATALOG_367,
  GLYPH_CATALOG_META as GLYPH_CATALOG_META_367,
  GLYPH_CATALOG_RANGES as GLYPH_CATALOG_RANGES_367,
} from "./glyph-catalog.367.generated";
import type {
  GlyphCatalogEntry,
  GlyphCatalogMeta,
  GlyphCatalogRange,
  GlyphKind,
  ResolvedGlyph,
} from "./types";

type GlyphCatalogModule = {
  GLYPH_CATALOG: readonly GlyphCatalogEntry[];
  GLYPH_CATALOG_META: GlyphCatalogMeta;
  GLYPH_CATALOG_RANGES: readonly GlyphCatalogRange[];
};

const GLYPH_CATALOG_BY_VERSION: Record<
  NethackRuntimeVersion,
  GlyphCatalogModule
> = {
  "3.6.7": {
    GLYPH_CATALOG: GLYPH_CATALOG_367,
    GLYPH_CATALOG_META: GLYPH_CATALOG_META_367,
    GLYPH_CATALOG_RANGES: GLYPH_CATALOG_RANGES_367,
  },
  "5.0": {
    GLYPH_CATALOG: GLYPH_CATALOG_367,
    GLYPH_CATALOG_META: GLYPH_CATALOG_META_367,
    GLYPH_CATALOG_RANGES: GLYPH_CATALOG_RANGES_367,
  },
  slashem: {
    GLYPH_CATALOG: GLYPH_CATALOG_367,
    GLYPH_CATALOG_META: GLYPH_CATALOG_META_367,
    GLYPH_CATALOG_RANGES: GLYPH_CATALOG_RANGES_367,
  },
  evilhack: {
    GLYPH_CATALOG: GLYPH_CATALOG_367,
    GLYPH_CATALOG_META: GLYPH_CATALOG_META_367,
    GLYPH_CATALOG_RANGES: GLYPH_CATALOG_RANGES_367,
  },
};

let activeGlyphCatalogVersion: NethackRuntimeVersion = "3.6.7";
let activeGlyphCatalog: GlyphCatalogModule = GLYPH_CATALOG_BY_VERSION["3.6.7"];

async function loadGlyphCatalogModule(
  version: NethackRuntimeVersion,
): Promise<GlyphCatalogModule> {
  if (version === "5.0") {
    const existing = GLYPH_CATALOG_BY_VERSION["5.0"];
    if (existing.GLYPH_CATALOG !== GLYPH_CATALOG_367) {
      return existing;
    }
    const mod =
      (await import("./glyph-catalog.5.generated")) as GlyphCatalogModule;
    GLYPH_CATALOG_BY_VERSION["5.0"] = mod;
    return mod;
  }

  if (version === "slashem") {
    const existing = GLYPH_CATALOG_BY_VERSION.slashem;
    if (existing.GLYPH_CATALOG !== GLYPH_CATALOG_367) {
      return existing;
    }
    const mod =
      (await import("./glyph-catalog.slashem.generated")) as GlyphCatalogModule;
    GLYPH_CATALOG_BY_VERSION.slashem = mod;
    return mod;
  }

  if (version === "evilhack") {
    const existing = GLYPH_CATALOG_BY_VERSION.evilhack;
    if (existing.GLYPH_CATALOG !== GLYPH_CATALOG_367) {
      return existing;
    }
    const mod =
      (await import("./glyph-catalog.evilhack.generated")) as GlyphCatalogModule;
    GLYPH_CATALOG_BY_VERSION.evilhack = mod;
    return mod;
  }

  return GLYPH_CATALOG_BY_VERSION["3.6.7"];
}

export async function setActiveGlyphCatalog(
  version: NethackRuntimeVersion,
): Promise<void> {
  if (version === activeGlyphCatalogVersion) {
    return;
  }
  const mod = await loadGlyphCatalogModule(version);
  activeGlyphCatalog = mod;
  activeGlyphCatalogVersion = version;
}

export async function getGlyphCatalogEntriesForVersion(
  version: NethackRuntimeVersion,
): Promise<readonly GlyphCatalogEntry[]> {
  const mod = await loadGlyphCatalogModule(version);
  return mod.GLYPH_CATALOG;
}

export function getActiveGlyphCatalogVersion(): NethackRuntimeVersion {
  return activeGlyphCatalogVersion;
}

function normalizeRuntimeChar(runtimeChar?: string | null): string | null {
  if (typeof runtimeChar !== "string" || runtimeChar.length === 0) {
    return null;
  }
  return runtimeChar.charAt(0);
}

function normalizeRuntimeColor(runtimeColor?: number | null): number | null {
  return typeof runtimeColor === "number" && Number.isFinite(runtimeColor)
    ? runtimeColor
    : null;
}

function normalizeRuntimeTileIndex(
  runtimeTileIndex?: number | null,
): number | null {
  if (
    typeof runtimeTileIndex !== "number" ||
    !Number.isFinite(runtimeTileIndex)
  ) {
    return null;
  }
  const normalized = Math.trunc(runtimeTileIndex);
  return normalized >= 0 ? normalized : null;
}

function normalizeRuntimeKind(
  runtimeKind?: GlyphKind | string | null,
): GlyphKind | null {
  if (typeof runtimeKind !== "string" || runtimeKind.length === 0) {
    return null;
  }
  switch (runtimeKind) {
    case "mon":
    case "pet":
    case "peaceful":
    case "invis":
    case "detect":
    case "body":
    case "ridden":
    case "obj":
    case "cmap":
    case "explode":
    case "zap":
    case "swallow":
    case "warning":
    case "statue":
    case "unexplored":
    case "nothing":
      return runtimeKind;
    default:
      return null;
  }
}

function codePointToChar(codePoint: number): string | null {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return null;
  }
  return String.fromCodePoint(codePoint);
}

export function getGlyphCatalogMeta(): GlyphCatalogMeta {
  return activeGlyphCatalog.GLYPH_CATALOG_META;
}

export function getGlyphCatalogRanges(): readonly GlyphCatalogRange[] {
  return activeGlyphCatalog.GLYPH_CATALOG_RANGES;
}

export function getGlyphCatalogEntry(glyph: number): GlyphCatalogEntry | null {
  const catalog = activeGlyphCatalog.GLYPH_CATALOG;
  if (!Number.isInteger(glyph) || glyph < 0 || glyph >= catalog.length) {
    return null;
  }
  return catalog[glyph] || null;
}

export function getGlyphKind(glyph: number): GlyphKind | "unknown" {
  const entry = getGlyphCatalogEntry(glyph);
  return entry ? entry.kind : "unknown";
}

export function resolveGlyph(
  glyph: number,
  runtimeChar?: string | null,
  runtimeColor?: number | null,
  runtimeTileIndex?: number | null,
  runtimeKind?: GlyphKind | null,
): ResolvedGlyph {
  const entry = getGlyphCatalogEntry(glyph);
  const normalizedRuntimeChar = normalizeRuntimeChar(runtimeChar);
  const normalizedRuntimeColor = normalizeRuntimeColor(runtimeColor);
  const normalizedRuntimeTileIndex = normalizeRuntimeTileIndex(runtimeTileIndex);
  const normalizedRuntimeKind = normalizeRuntimeKind(runtimeKind);

  if (!entry) {
    return {
      glyph,
      kind: normalizedRuntimeKind ?? "unknown",
      char: normalizedRuntimeChar,
      color: normalizedRuntimeColor,
      special: null,
      isKnown: false,
      tileIndex: normalizedRuntimeTileIndex ?? -1,
    };
  }

  const catalogChar = codePointToChar(entry.ch);
  return {
    glyph,
    kind: normalizedRuntimeKind ?? entry.kind,
    char: normalizedRuntimeChar ?? catalogChar,
    color:
      normalizedRuntimeColor ??
      (typeof entry.color === "number" ? entry.color : null),
    special: typeof entry.special === "number" ? entry.special : null,
    isKnown: true,
    tileIndex: normalizedRuntimeTileIndex ?? entry.tileIndex,
  };
}
