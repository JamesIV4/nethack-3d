import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  shouldTranslateNh367TilesetForNh5Runtime,
  translateNh5TileIndexToNh367
} from "../../../game/tileset-367-to-5-translation";
import type {
  GlyphCatalogEntry
} from "../../../game/glyphs/types";
import type {
  TilesetBackgroundRemovalMode
} from "../settings/types";

/** Tile atlas state, representative glyph lookup, pixels and preview isolation. */
export const emptyGlyphCatalogEntries: readonly GlyphCatalogEntry[] = [];

export type TileAtlasState = {
  tilesetPath: string;
  loaded: boolean;
  failed: boolean;
  tileSourceSize: number;
  columns: number;
  rows: number;
  tileCount: number;
};

export const createDefaultTileAtlasState = (): TileAtlasState => ({
  tilesetPath: "",
  loaded: false,
  failed: false,
  tileSourceSize: 32,
  columns: 0,
  rows: 0,
  tileCount: 0,
});

export type TilePickerEntry = {
  tileId: number;
  glyphLabel: string;
  glyphNumber: number | null;
};

export function glyphCodePointToChar(codePoint: unknown): string | null {
  if (
    typeof codePoint !== "number" ||
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff
  ) {
    return null;
  }
  return String.fromCodePoint(codePoint);
}

export function formatTileGlyphLabel(glyphChar: string): string {
  if (glyphChar === " ") {
    return "space";
  }
  const codePoint = glyphChar.codePointAt(0);
  if (typeof codePoint === "number" && (codePoint < 32 || codePoint === 127)) {
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  return `'${glyphChar}'`;
}

export function buildRepresentativeGlyphByTileId(
  glyphCatalog: ReadonlyArray<{
    tileIndex: number;
    ch?: number;
    ttychar?: number;
  }>,
): Map<number, string> {
  const representativeByTile = new Map<number, string>();
  for (const entry of glyphCatalog) {
    const tileId = Math.trunc(entry.tileIndex);
    if (!Number.isFinite(tileId) || tileId < 0) {
      continue;
    }
    const candidate =
      glyphCodePointToChar(entry.ch) ?? glyphCodePointToChar(entry.ttychar);
    if (!candidate || candidate.length === 0) {
      continue;
    }
    const glyphChar = candidate.charAt(0);
    const existing = representativeByTile.get(tileId);
    if (!existing) {
      representativeByTile.set(tileId, glyphChar);
      continue;
    }
    if (existing.trim().length === 0 && glyphChar.trim().length > 0) {
      representativeByTile.set(tileId, glyphChar);
    }
  }
  return representativeByTile;
}

export function buildRepresentativeGlyphNumberByTileId(
  glyphCatalog: ReadonlyArray<{
    glyph?: number;
    tileIndex: number;
    ch?: number;
    ttychar?: number;
  }>,
): Map<number, number> {
  const representativeByTile = new Map<
    number,
    { glyphChar: string; glyph: number }
  >();
  for (const entry of glyphCatalog) {
    const tileId = Math.trunc(entry.tileIndex);
    if (!Number.isFinite(tileId) || tileId < 0) {
      continue;
    }
    const candidate =
      glyphCodePointToChar(entry.ch) ?? glyphCodePointToChar(entry.ttychar);
    if (!candidate || candidate.length === 0) {
      continue;
    }
    const glyph = Math.trunc(Number(entry.glyph));
    if (!Number.isFinite(glyph) || glyph < 0) {
      continue;
    }
    const glyphChar = candidate.charAt(0);
    const existing = representativeByTile.get(tileId);
    if (!existing) {
      representativeByTile.set(tileId, { glyphChar, glyph });
      continue;
    }
    if (existing.glyphChar.trim().length === 0 && glyphChar.trim().length > 0) {
      representativeByTile.set(tileId, { glyphChar, glyph });
    }
  }
  const glyphByTileId = new Map<number, number>();
  for (const [tileId, entry] of representativeByTile.entries()) {
    glyphByTileId.set(tileId, entry.glyph);
  }
  return glyphByTileId;
}

export function createIsolatedAtlasTilePreviewDataUrl(
  atlasImage: HTMLImageElement,
  tileId: number,
  tileSourceSize: number,
  tileColumns: number,
  tileRows: number,
  backgroundRemoval?: {
    enabled: boolean;
    mode: TilesetBackgroundRemovalMode;
    applySolidChromaKeyAfterTile: boolean;
    solidChromaKeyColorHex: string;
    backgroundTilePixels: Uint8ClampedArray | null;
  },
): string | null {
  if (
    typeof document === "undefined" ||
    !atlasImage ||
    tileSourceSize <= 0 ||
    !Number.isFinite(tileId)
  ) {
    return null;
  }
  const tilesPerRow = Math.max(0, Math.trunc(tileColumns));
  const rows = Math.max(0, Math.trunc(tileRows));
  const tileCount = tilesPerRow > 0 && rows > 0 ? tilesPerRow * rows : 0;
  const safeTileId = Math.trunc(tileId);
  if (tileCount <= 0 || safeTileId < 0 || safeTileId >= tileCount) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = tileSourceSize;
  canvas.height = tileSourceSize;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const sx = (safeTileId % tilesPerRow) * tileSourceSize;
  const sy = Math.floor(safeTileId / tilesPerRow) * tileSourceSize;
  context.clearRect(0, 0, tileSourceSize, tileSourceSize);
  context.drawImage(
    atlasImage,
    sx,
    sy,
    tileSourceSize,
    tileSourceSize,
    0,
    0,
    tileSourceSize,
    tileSourceSize,
  );

  if (backgroundRemoval?.enabled) {
    const imageData = context.getImageData(
      0,
      0,
      tileSourceSize,
      tileSourceSize,
    );
    const data = imageData.data;
    const applySolidChromaKey = (): void => {
      const match = String(backgroundRemoval.solidChromaKeyColorHex || "")
        .trim()
        .match(/^#?([0-9a-fA-F]{6})$/);
      if (match) {
        const hex = match[1];
        const targetR = Number.parseInt(hex.slice(0, 2), 16);
        const targetG = Number.parseInt(hex.slice(2, 4), 16);
        const targetB = Number.parseInt(hex.slice(4, 6), 16);
        for (let i = 0; i < data.length; i += 4) {
          if (
            data[i] === targetR &&
            data[i + 1] === targetG &&
            data[i + 2] === targetB
          ) {
            data[i + 3] = 0;
          }
        }
      }
    };
    if (backgroundRemoval.mode === "solid") {
      applySolidChromaKey();
    } else if (backgroundRemoval.backgroundTilePixels) {
      const alphaSoftMin = 12;
      const alphaSoftMax = 40;
      const backgroundPixels = backgroundRemoval.backgroundTilePixels;
      for (let i = 0; i < data.length; i += 4) {
        const sourceAlpha = data[i + 3];
        if (sourceAlpha === 0) {
          continue;
        }
        const deltaR = Math.abs(data[i] - backgroundPixels[i]);
        const deltaG = Math.abs(data[i + 1] - backgroundPixels[i + 1]);
        const deltaB = Math.abs(data[i + 2] - backgroundPixels[i + 2]);
        const delta = Math.max(deltaR, deltaG, deltaB);
        const visibility = Math.max(
          0,
          Math.min(1, (delta - alphaSoftMin) / (alphaSoftMax - alphaSoftMin)),
        );
        const nextAlpha = Math.round(sourceAlpha * visibility);
        data[i + 3] = nextAlpha;
        if (nextAlpha === 0) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
      if (backgroundRemoval.applySolidChromaKeyAfterTile) {
        applySolidChromaKey();
      }
    }
    context.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL("image/png");
}

export function getAtlasTilePixels(
  atlasImage: HTMLImageElement,
  tileSourceSize: number,
  tileId: number,
  tileColumns: number,
  tileRows: number,
): Uint8ClampedArray | null {
  if (
    typeof document === "undefined" ||
    !atlasImage ||
    tileSourceSize <= 0 ||
    !Number.isFinite(tileId)
  ) {
    return null;
  }
  const tilesPerRow = Math.max(0, Math.trunc(tileColumns));
  const rows = Math.max(0, Math.trunc(tileRows));
  const tileCount = tilesPerRow > 0 && rows > 0 ? tilesPerRow * rows : 0;
  const safeTileId = Math.trunc(tileId);
  if (tileCount <= 0 || safeTileId < 0 || safeTileId >= tileCount) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = tileSourceSize;
  canvas.height = tileSourceSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  const sx = (safeTileId % tilesPerRow) * tileSourceSize;
  const sy = Math.floor(safeTileId / tilesPerRow) * tileSourceSize;
  context.clearRect(0, 0, tileSourceSize, tileSourceSize);
  context.drawImage(
    atlasImage,
    sx,
    sy,
    tileSourceSize,
    tileSourceSize,
    0,
    0,
    tileSourceSize,
    tileSourceSize,
  );
  return context.getImageData(0, 0, tileSourceSize, tileSourceSize).data;
}

export function resolvePreviewAtlasTileIdForRuntime(
  runtimeVersion: NethackRuntimeVersion,
  tileId: number,
  atlasTileCount: number,
): number {
  const normalizedTileId = Math.trunc(tileId);
  if (!Number.isFinite(normalizedTileId) || normalizedTileId < 0) {
    return normalizedTileId;
  }
  try {
    if (
      !shouldTranslateNh367TilesetForNh5Runtime(runtimeVersion, atlasTileCount)
    ) {
      return normalizedTileId;
    }
    return translateNh5TileIndexToNh367(normalizedTileId);
  } catch {
    return normalizedTileId;
  }
}
