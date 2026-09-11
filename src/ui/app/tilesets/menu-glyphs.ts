import type {
  NethackMenuItem
} from "../../../game/ui-types";

/** Live runtime glyph resolution and explicit menu-item tile decisions. */
export function normalizeTileIndexCandidate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.trunc(value);
}

export function resolveTileIndexForGlyph(glyph: unknown): number | null {
  if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
    return null;
  }
  const normalizedGlyph = Math.trunc(glyph);
  const helpers =
    (
      globalThis as {
        nethackGlobal?: {
          helpers?: {
            tileIndexForGlyph?: (glyphValue: number) => unknown;
          };
        };
      }
    ).nethackGlobal?.helpers ?? null;
  const tileIndexForGlyphHelper =
    typeof helpers?.tileIndexForGlyph === "function"
      ? helpers.tileIndexForGlyph
      : null;
  if (!tileIndexForGlyphHelper) {
    return null;
  }
  try {
    return normalizeTileIndexCandidate(
      tileIndexForGlyphHelper(normalizedGlyph),
    );
  } catch {
    return null;
  }
}

export function resolveNoGlyphValueFromRuntime(): number | null {
  const glyphConstants =
    (
      globalThis as {
        nethackGlobal?: {
          constants?: {
            GLYPH?: {
              NO_GLYPH?: unknown;
              MAX_GLYPH?: unknown;
            };
          };
        };
      }
    ).nethackGlobal?.constants?.GLYPH ?? null;
  if (!glyphConstants) {
    return null;
  }
  const explicitNoGlyph = normalizeTileIndexCandidate(glyphConstants.NO_GLYPH);
  if (explicitNoGlyph !== null) {
    return explicitNoGlyph;
  }
  return normalizeTileIndexCandidate(glyphConstants.MAX_GLYPH);
}

export function isMenuItemTileApplicable(
  item: NethackMenuItem | null | undefined,
): boolean {
  if (!item || item.isCategory) {
    return false;
  }
  if (typeof item.isTileApplicable === "boolean") {
    return item.isTileApplicable;
  }
  const glyphCandidate =
    typeof item.glyphChar === "string" ? item.glyphChar : "";
  if (glyphCandidate.length > 0 && glyphCandidate.trim().length === 0) {
    return false;
  }
  if (typeof item.glyph === "number" && Number.isFinite(item.glyph)) {
    const noGlyphValue = resolveNoGlyphValueFromRuntime();
    if (noGlyphValue !== null && Math.trunc(item.glyph) === noGlyphValue) {
      return false;
    }
  }
  if (normalizeTileIndexCandidate(item.tileIndex) !== null) {
    return true;
  }
  return (
    typeof item.glyph === "number" &&
    Number.isFinite(item.glyph) &&
    item.glyph >= 0
  );
}

export function resolveMenuItemTileIndex(
  item: NethackMenuItem | null | undefined,
): number | null {
  if (!isMenuItemTileApplicable(item) || !item) {
    return null;
  }
  const explicitTileIndex = normalizeTileIndexCandidate(item.tileIndex);
  if (explicitTileIndex !== null) {
    return explicitTileIndex;
  }
  if (typeof item.isTileApplicable === "boolean") {
    // Runtime already made a deterministic tile/non-tile decision.
    return null;
  }
  return resolveTileIndexForGlyph(item.glyph);
}

export function resolveMenuItemTilePreviewDataUrl(
  item: NethackMenuItem | null | undefined,
): string | null {
  const candidate =
    typeof item?.tilePreviewDataUrl === "string"
      ? item.tilePreviewDataUrl.trim()
      : "";
  return candidate.length > 0 ? candidate : null;
}

export function resolveMenuItemFallbackGlyph(
  item: NethackMenuItem | null | undefined,
  fallback = "?",
): string {
  const glyphCandidate =
    typeof item?.glyphChar === "string" ? item.glyphChar : "";
  const glyphCodePoint = glyphCandidate.codePointAt(0);
  if (
    typeof glyphCodePoint === "number" &&
    glyphCodePoint >= 32 &&
    glyphCodePoint !== 127
  ) {
    return glyphCandidate.charAt(0);
  }
  return fallback;
}
