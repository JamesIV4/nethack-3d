// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

export interface RuntimeGlyphsDependencies {

}

/** Runtime glyph metadata, monster identities, renderability and loot classification. */
export class RuntimeGlyphs {

  constructor(private readonly deps: RuntimeGlyphsDependencies) {}

  extractGlyphInfoTileIndex(glyphInfo) {
    if (!glyphInfo || typeof glyphInfo !== "object") {
      return null;
    }
    const tileIndexCandidate =
      typeof glyphInfo.tileidx === "number"
        ? glyphInfo.tileidx
        : glyphInfo.tileIdx;
    if (
      typeof tileIndexCandidate === "number" &&
      Number.isFinite(tileIndexCandidate) &&
      tileIndexCandidate >= 0
    ) {
      return Math.trunc(tileIndexCandidate);
    }
    return null;
  }

  extractGlyphInfoSymidx(glyphInfo) {
    if (!glyphInfo || typeof glyphInfo !== "object") {
      return null;
    }
    const symidxCandidate =
      typeof glyphInfo.symidx === "number"
        ? glyphInfo.symidx
        : glyphInfo.symIdx;
    if (
      typeof symidxCandidate === "number" &&
      Number.isFinite(symidxCandidate) &&
      symidxCandidate >= 0
    ) {
      return Math.trunc(symidxCandidate);
    }
    return null;
  }

  extractGlyphInfoGlyphFlags(glyphInfo) {
    if (!glyphInfo || typeof glyphInfo !== "object") {
      return null;
    }
    // 5.0 map_glyphinfo exposes "glyphflags"; the 3.6.7/Slash'EM mapglyph
    // helper returns the same MG_* bits as "special".
    const glyphFlagsCandidate =
      typeof glyphInfo.glyphflags === "number"
        ? glyphInfo.glyphflags
        : typeof glyphInfo.glyphFlags === "number"
          ? glyphInfo.glyphFlags
          : glyphInfo.special;
    if (
      typeof glyphFlagsCandidate === "number" &&
      Number.isFinite(glyphFlagsCandidate)
    ) {
      return Math.trunc(glyphFlagsCandidate);
    }
    return null;
  }

  getGlyphConstants() {
    return globalThis.nethackGlobal &&
      globalThis.nethackGlobal.constants &&
      globalThis.nethackGlobal.constants.GLYPH &&
      typeof globalThis.nethackGlobal.constants.GLYPH === "object"
      ? globalThis.nethackGlobal.constants.GLYPH
      : null;
  }

  getGlyphConstantValue(...keys) {
    const glyphConstants = this.getGlyphConstants();
    if (!glyphConstants || !Array.isArray(keys) || keys.length === 0) {
      return null;
    }
    for (const key of keys) {
      if (!key || !Object.prototype.hasOwnProperty.call(glyphConstants, key)) {
        continue;
      }
      const value = this.normalizeNonNegativeInteger(glyphConstants[key]);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  isUndiscoveredOrNothingGlyph(glyph, glyphFlags = null) {
    if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
      return false;
    }

    const normalizedGlyph = Math.trunc(glyph);
    const unexploredGlyph = this.getGlyphConstantValue(
      "GLYPH_UNEXPLORED",
      "GLYPH_UNEXPLORED_OFF",
    );
    if (unexploredGlyph !== null && normalizedGlyph === unexploredGlyph) {
      return true;
    }

    const nothingGlyph = this.getGlyphConstantValue(
      "GLYPH_NOTHING",
      "GLYPH_NOTHING_OFF",
    );
    if (nothingGlyph !== null && normalizedGlyph === nothingGlyph) {
      return true;
    }

    const normalizedGlyphFlags = this.normalizeNonNegativeInteger(glyphFlags);
    if (normalizedGlyphFlags !== null) {
      // NetHack 5.0 mapglyph flags: MG_UNEXPLORED=0x0800, MG_NOTHING=0x0400.
      if ((normalizedGlyphFlags & 0x0800) !== 0) {
        return true;
      }
      if ((normalizedGlyphFlags & 0x0400) !== 0) {
        return true;
      }
    }

    return false;
  }

  isRenderableRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return false;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null || glyph < 0) {
      return false;
    }
    const glyphFlags =
      typeof tileData.glyphFlags === "number" &&
        Number.isFinite(tileData.glyphFlags)
        ? Math.trunc(tileData.glyphFlags)
        : null;
    return !this.isUndiscoveredOrNothingGlyph(glyph, glyphFlags);
  }

  normalizeRuntimeMonsterId(rawValue) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized > 0 ? normalized : null;
  }

  normalizeRuntimeTrackedEntityId(rawValue) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized >= 0 ? normalized : null;
  }

  normalizeRuntimeAttackTargetId(rawValue) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized >= 0 ? normalized : null;
  }

  getTrackedMonsterIdFromRuntimeTile(tileData) {
    return this.normalizeRuntimeTrackedEntityId(tileData?.monsterId);
  }

  isMonsterLikeGlyph(glyph) {
    if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
      return false;
    }

    const normalizedGlyph = Math.trunc(glyph);
    const monGlyphOff = this.getGlyphConstantValue("GLYPH_MON_OFF");
    const bodyGlyphOff = this.getGlyphConstantValue(
      "GLYPH_BODY_OFF",
      "GLYPH_OBJ_OFF",
      "GLYPH_CMAP_OFF",
    );
    if (monGlyphOff === null || bodyGlyphOff === null) {
      return false;
    }

    return (
      normalizedGlyph >= monGlyphOff && normalizedGlyph < bodyGlyphOff
    );
  }

  isMonsterLikeRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return false;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null) {
      return false;
    }
    return this.isMonsterLikeGlyph(glyph);
  }

  isLootLikeGlyph(glyph) {
    if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
      return false;
    }

    const normalizedGlyph = Math.trunc(glyph);
    const objGlyphOff = this.getGlyphConstantValue("GLYPH_OBJ_OFF");
    const cmapGlyphOff = this.getGlyphConstantValue(
      "GLYPH_CMAP_OFF",
      "GLYPH_EXPLODE_OFF",
      "GLYPH_WARNING_OFF",
    );
    if (objGlyphOff === null || cmapGlyphOff === null) {
      return false;
    }

    return normalizedGlyph >= objGlyphOff && normalizedGlyph < cmapGlyphOff;
  }

  isLootLikeRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return false;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null) {
      return false;
    }
    return this.isLootLikeGlyph(glyph);
  }

  normalizeNonNegativeInteger(value) {
    const numeric =
      typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : value;
    if (
      typeof numeric !== "number" ||
      !Number.isFinite(numeric) ||
      numeric < 0
    ) {
      return null;
    }
    return Math.trunc(numeric);
  }

  getNoGlyphValue() {
    const glyphConstants = this.getGlyphConstants();
    if (!glyphConstants) {
      return null;
    }
    const explicitNoGlyph = this.normalizeNonNegativeInteger(
      glyphConstants.NO_GLYPH,
    );
    if (explicitNoGlyph !== null) {
      return explicitNoGlyph;
    }
    return this.normalizeNonNegativeInteger(glyphConstants.MAX_GLYPH);
  }
}
