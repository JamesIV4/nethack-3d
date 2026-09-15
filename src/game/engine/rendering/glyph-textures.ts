import * as THREE from "three";
import {
  getTerminalBoxDrawingConnections,
  resolveTerminalWallStrokeWidth
} from "../../terminal/terminal-display";
import type { TileMaterialKind } from "../../glyphs";
import type { GlyphOverlay, GlyphOverlayMap } from "../../types";
import {
  isNh3dTilesetCombinedBackgroundRemovalForced,
  isNh3dTilesetExactBackgroundRemovalForced
} from "../../tilesets";
import { type VultureTileLookup } from "../../vulture/translation";
import type {
  VultureWallProjectionFamily,
  VultureProjectionDebugFamily,
  VultureWallProjectionLookup,
  VultureDoorProjectionContext
} from "../shared/types";
import type { EngineState } from "../runtime/engine-state";
import type { Lighting } from "./lighting";
import type { TilesetAssets } from "./tileset-assets";
import type { VultureProjection } from "./vulture-projection";
import type { VultureProjectionDebug } from "../diagnostics/vulture-projection-debug";

export interface GlyphTexturesDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly lighting: Pick<
    Lighting,
    "patchMaterialForVignette"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "drawTilesetBackgroundReferenceTile"
    | "resolveAtlasTileIndexForRuntime"
    | "resolveTextureAnisotropyLevel"
    | "resolveTilesetAtlasImageSource"
    | "resolveTilesetBackgroundReferenceTileIndex"
    | "tileSourceSize"
    | "tileSourceHeight"
    | "tilesetBackgroundReferenceTilePixels"
    | "tilesetTexture"
    | "vultureTilesetTranslator"
  >;
  readonly vultureProjection: Pick<
    VultureProjection,
    "reprojectVultureWallTexture"
    | "resolveVultureDoorProjectionDebugFamily"
    | "resolveVultureDoorProjectionOrientation"
    | "resolveVultureWallProjectionFamily"
    | "tryDrawVulturePrebakedProjectionTexture"
  >;
  readonly vultureProjectionDebug: Pick<
    VultureProjectionDebug,
    "captureVultureWallProjectionSourcePreview"
  >;
}

/** Glyph and tile texture creation, background removal and glyph overlay resources */
export class GlyphTextures {
  constructor(private readonly dependencies: GlyphTexturesDependencies) {}

  glyphOverlayMap: GlyphOverlayMap = new Map();

  glyphTextureCache: Map<
    string,
    { texture: THREE.CanvasTexture; refCount: number }
  > = new Map();

  tilesetBackgroundTilePixelsCache: Map<number, Uint8ClampedArray> =
    new Map();

  readonly asciiFriendlyGlyphTextColor: string = "#F7FFF9";

  acquireGlyphTexture(
    textureKey: string,
    factory: () => THREE.CanvasTexture,
  ): THREE.CanvasTexture {
    const cached = this.glyphTextureCache.get(textureKey);
    if (cached) {
      cached.refCount += 1;
      return cached.texture;
    }

    const texture = factory();
    this.glyphTextureCache.set(textureKey, { texture, refCount: 1 });
    return texture;
  }

  releaseGlyphTexture(textureKey: string): void {
    if (!textureKey) {
      return;
    }
    const cached = this.glyphTextureCache.get(textureKey);
    if (!cached) {
      return;
    }

    cached.refCount -= 1;
    if (cached.refCount <= 0) {
      cached.texture.dispose();
      this.glyphTextureCache.delete(textureKey);
    }
  }

  disposeGlyphOverlay(overlay: GlyphOverlay): void {
    this.releaseGlyphTexture(overlay.textureKey);
    overlay.texture = null;
    overlay.textureKey = "";
    overlay.material.dispose();
  }

  toneColor(hex: string, factor: number): string {
    const color = new THREE.Color(`#${hex}`);
    color.multiplyScalar(THREE.MathUtils.clamp(factor, 0, 1));
    return color.getHexString();
  }

  relativeLuminance(color: THREE.Color): number {
    const channel = (value: number): number => {
      if (value <= 0.03928) return value / 12.92;
      return Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const r = channel(color.r);
    const g = channel(color.g);
    const b = channel(color.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  contrastRatio(background: THREE.Color, text: THREE.Color): number {
    const l1 = this.relativeLuminance(background);
    const l2 = this.relativeLuminance(text);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  ensureTextContrast(
    tonedBackgroundHex: string,
    textColor: string,
    minContrast: number = 4.5,
  ): string {
    const background = new THREE.Color(`#${tonedBackgroundHex}`);
    const text = new THREE.Color();
    text.set(textColor || "#ffffff");

    if (this.contrastRatio(background, text) >= minContrast) {
      return background.getHexString();
    }

    for (let i = 0; i < 6; i++) {
      background.multiplyScalar(0.85);
      if (this.contrastRatio(background, text) >= minContrast) {
        return background.getHexString();
      }
    }

    return background.getHexString();
  }

  setMaterialFaceSide(
    material: THREE.Material | null | undefined,
    side: THREE.Side,
  ): void {
    if (
      material instanceof THREE.MeshBasicMaterial ||
      material instanceof THREE.MeshLambertMaterial
    ) {
      if (material.side !== side) {
        material.side = side;
        material.needsUpdate = true;
      }
    }
  }

  setMaterialAlphaCutout(
    material: THREE.Material | null | undefined,
    enabled: boolean,
  ): void {
    if (
      material instanceof THREE.MeshBasicMaterial ||
      material instanceof THREE.MeshLambertMaterial
    ) {
      const nextAlphaTest = enabled ? 0.01 : 0;
      if (Math.abs((material.alphaTest ?? 0) - nextAlphaTest) > 0.0001) {
        material.alphaTest = nextAlphaTest;
        material.needsUpdate = true;
      }
    }
  }

  ensureGlyphOverlay(
    key: string,
    baseMaterial: THREE.MeshLambertMaterial,
  ): GlyphOverlay {
    const baseColorHex = baseMaterial.color.getHexString();
    let overlay = this.glyphOverlayMap.get(key);
    const needsNewOverlay =
      !overlay ||
      overlay.baseColorHex !== baseColorHex ||
      overlay.material instanceof THREE.MeshLambertMaterial === true;

    if (needsNewOverlay) {
      if (overlay) {
        this.disposeGlyphOverlay(overlay);
      }

      const materialClone = new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 1,
      });

      // Patch the newly created overlay material
      this.dependencies.lighting.patchMaterialForVignette(materialClone);

      overlay = {
        texture: null,
        material: materialClone,
        baseColorHex,
        textureKey: "",
      };
      this.glyphOverlayMap.set(key, overlay);
    }

    return overlay!;
  }

  createTileTexture(
    tileIndex: number,
    darkenFactor: number = 1,
    applyChromaKey: boolean = false,
    sourceContext: {
      sourceGlyph?: number | null;
      materialKind?: TileMaterialKind | null;
      tileX?: number | null;
      tileY?: number | null;
      useBackgroundReferenceTile?: boolean | null;
      forceBackgroundRemoval?: boolean | null;
      floorUnderlayGlyph?: number | null;
      floorUnderlayTileIndex?: number | null;
      floorUnderlayUseBackgroundReferenceTile?: boolean | null;
      floorUnderlayMaterialKind?: TileMaterialKind | null;
      vultureLookup?: VultureWallProjectionLookup | null;
      projectionFamilyOverride?: VultureWallProjectionFamily | null;
      doorProjection?: VultureDoorProjectionContext | null;
    } = {},
  ): THREE.CanvasTexture {
    const size = this.dependencies.tilesetAssets.tileSourceSize;
    const height = this.dependencies.tilesetAssets.tileSourceHeight ?? size;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Failed to create tile texture canvas context");
    }

    context.clearRect(0, 0, size, height);

    const sourceGlyph =
      typeof sourceContext.sourceGlyph === "number" &&
      Number.isFinite(sourceContext.sourceGlyph)
        ? Math.trunc(sourceContext.sourceGlyph)
        : null;
    const materialKind =
      typeof sourceContext.materialKind === "string"
        ? (sourceContext.materialKind as TileMaterialKind)
        : null;
    const tileX =
      typeof sourceContext.tileX === "number" &&
      Number.isFinite(sourceContext.tileX)
        ? Math.trunc(sourceContext.tileX)
        : null;
    const tileY =
      typeof sourceContext.tileY === "number" &&
      Number.isFinite(sourceContext.tileY)
        ? Math.trunc(sourceContext.tileY)
        : null;
    const useBackgroundReferenceTile =
      sourceContext.useBackgroundReferenceTile === true;
    const forceBackgroundRemoval =
      sourceContext.forceBackgroundRemoval === true;
    const floorUnderlayGlyph =
      typeof sourceContext.floorUnderlayGlyph === "number" &&
      Number.isFinite(sourceContext.floorUnderlayGlyph)
        ? Math.trunc(sourceContext.floorUnderlayGlyph)
        : null;
    const floorUnderlayTileIndex =
      typeof sourceContext.floorUnderlayTileIndex === "number" &&
      Number.isFinite(sourceContext.floorUnderlayTileIndex)
        ? Math.trunc(sourceContext.floorUnderlayTileIndex)
        : null;
    const floorUnderlayUseBackgroundReferenceTile =
      sourceContext.floorUnderlayUseBackgroundReferenceTile === true;
    const floorUnderlayMaterialKind =
      typeof sourceContext.floorUnderlayMaterialKind === "string"
        ? (sourceContext.floorUnderlayMaterialKind as TileMaterialKind)
        : null;
    const vultureLookup: VultureWallProjectionLookup | null =
      sourceContext.vultureLookup &&
      typeof sourceContext.vultureLookup.category === "string" &&
      typeof sourceContext.vultureLookup.name === "string" &&
      (sourceContext.vultureLookup.projection === "sprite" ||
        sourceContext.vultureLookup.projection === "iso_floor")
        ? (sourceContext.vultureLookup as VultureWallProjectionLookup)
        : null;
    const projectionFamilyOverride =
      sourceContext.projectionFamilyOverride === "ew" ||
      sourceContext.projectionFamilyOverride === "sn"
        ? sourceContext.projectionFamilyOverride
        : null;
    const doorProjection: VultureDoorProjectionContext | null =
      sourceContext.doorProjection &&
      (sourceContext.doorProjection.state === "open" ||
        sourceContext.doorProjection.state === "closed") &&
      (sourceContext.doorProjection.side === "front" ||
        sourceContext.doorProjection.side === "back") &&
      (sourceContext.doorProjection.orientation === "ew" ||
        sourceContext.doorProjection.orientation === "sn")
        ? {
            state: sourceContext.doorProjection.state,
            side: sourceContext.doorProjection.side,
            orientation: sourceContext.doorProjection.orientation,
          }
        : null;
    const normalizedTileIndex =
      Number.isFinite(tileIndex) && tileIndex >= 0 ? Math.trunc(tileIndex) : -1;
    if (
      !applyChromaKey &&
      (floorUnderlayUseBackgroundReferenceTile ||
        floorUnderlayGlyph !== null ||
        (floorUnderlayTileIndex !== null && floorUnderlayTileIndex >= 0))
    ) {
      const floorUnderlayTexture = this.createTileTexture(
        floorUnderlayTileIndex ?? -1,
        1,
        false,
        {
          sourceGlyph: floorUnderlayGlyph,
          materialKind: floorUnderlayMaterialKind,
          tileX,
          tileY,
          useBackgroundReferenceTile: floorUnderlayUseBackgroundReferenceTile,
        },
      );
      const floorUnderlayImage = floorUnderlayTexture.image;
      if (floorUnderlayImage) {
        context.drawImage(floorUnderlayImage, 0, 0, size, height);
      }
      floorUnderlayTexture.dispose();
    }
    let resolvedLookup: VultureTileLookup | null = vultureLookup;
    if (
      !applyChromaKey &&
      resolvedLookup === null &&
      this.dependencies.tilesetAssets.vultureTilesetTranslator &&
      (sourceGlyph !== null || normalizedTileIndex >= 0)
    ) {
      resolvedLookup = this.dependencies.tilesetAssets.vultureTilesetTranslator.resolveLookupForTile({
        glyph: sourceGlyph ?? -1,
        tileIndex: normalizedTileIndex >= 0 ? normalizedTileIndex : null,
        tileX,
        tileY,
        materialKind,
        forBillboard: false,
      });
    }
    let translatedDrawSucceeded = false;
    if (!applyChromaKey && useBackgroundReferenceTile) {
      translatedDrawSucceeded = this.dependencies.tilesetAssets.drawTilesetBackgroundReferenceTile(
        context,
        size,
        height,
      );
    }
    let usedPrebakedProjectionTexture = false;
    if (!applyChromaKey && resolvedLookup) {
      usedPrebakedProjectionTexture =
        this.dependencies.vultureProjection.tryDrawVulturePrebakedProjectionTexture({
          context,
          size,
          lookup: resolvedLookup,
          projectionFamilyOverride,
          doorProjection,
        });
      translatedDrawSucceeded = usedPrebakedProjectionTexture;
    }
    if (this.dependencies.tilesetAssets.vultureTilesetTranslator) {
      if (!translatedDrawSucceeded && vultureLookup) {
        translatedDrawSucceeded = this.dependencies.tilesetAssets.vultureTilesetTranslator.drawLookupTile({
          context,
          size,
          lookup: vultureLookup,
          forBillboard: applyChromaKey,
        });
      } else if (
        !translatedDrawSucceeded &&
        !applyChromaKey &&
        resolvedLookup
      ) {
        translatedDrawSucceeded = this.dependencies.tilesetAssets.vultureTilesetTranslator.drawLookupTile({
          context,
          size,
          lookup: resolvedLookup,
          forBillboard: false,
        });
      } else if (
        !translatedDrawSucceeded &&
        (sourceGlyph !== null || normalizedTileIndex >= 0)
      ) {
        translatedDrawSucceeded =
          this.dependencies.tilesetAssets.vultureTilesetTranslator.drawTranslatedTile({
            context,
            size,
            glyph: sourceGlyph ?? -1,
            tileIndex: normalizedTileIndex >= 0 ? normalizedTileIndex : null,
            tileX,
            tileY,
            materialKind,
            forBillboard: applyChromaKey,
          });
      }
      if (!translatedDrawSucceeded && !this.dependencies.tilesetAssets.tilesetTexture) {
        this.dependencies.tilesetAssets.vultureTilesetTranslator.drawFallbackTile(
          context,
          size,
          applyChromaKey,
        );
        translatedDrawSucceeded = true;
      }
    }

    if (
      translatedDrawSucceeded &&
      !applyChromaKey &&
      !usedPrebakedProjectionTexture
    ) {
      if (
        resolvedLookup === null &&
        this.dependencies.tilesetAssets.vultureTilesetTranslator &&
        (sourceGlyph !== null || normalizedTileIndex >= 0)
      ) {
        resolvedLookup = this.dependencies.tilesetAssets.vultureTilesetTranslator.resolveLookupForTile({
          glyph: sourceGlyph ?? -1,
          tileIndex: normalizedTileIndex >= 0 ? normalizedTileIndex : null,
          tileX,
          tileY,
          materialKind,
          forBillboard: false,
        });
      }
      if (resolvedLookup?.projection === "iso_floor") {
        this.dependencies.vultureProjectionDebug.captureVultureWallProjectionSourcePreview(
          context,
          size,
          "floor",
          resolvedLookup,
        );
        this.dependencies.vultureProjection.reprojectVultureWallTexture(
          context,
          size,
          "floor",
          resolvedLookup,
        );
      }

      const projectionFamily: VultureProjectionDebugFamily | null = (() => {
        if (doorProjection) {
          const orientation =
            doorProjection.orientation ??
            projectionFamilyOverride ??
            this.dependencies.vultureProjection.resolveVultureDoorProjectionOrientation(resolvedLookup);
          if (orientation === "ew" || orientation === "sn") {
            return this.dependencies.vultureProjection.resolveVultureDoorProjectionDebugFamily(
              doorProjection.state,
              orientation,
            );
          }
          return null;
        }
        return (
          projectionFamilyOverride ??
          (resolvedLookup?.category === "wall"
            ? this.dependencies.vultureProjection.resolveVultureWallProjectionFamily(
                resolvedLookup as VultureWallProjectionLookup,
              )
            : null)
        );
      })();
      if (projectionFamily) {
        if (resolvedLookup) {
          this.dependencies.vultureProjectionDebug.captureVultureWallProjectionSourcePreview(
            context,
            size,
            projectionFamily,
            resolvedLookup,
          );
        }
        this.dependencies.vultureProjection.reprojectVultureWallTexture(
          context,
          size,
          projectionFamily,
          resolvedLookup,
          doorProjection?.side ?? null,
        );
      }
    }

    const shouldApplyBackgroundRemoval =
      (applyChromaKey || forceBackgroundRemoval) &&
      this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode !== "none";

    const atlasImage = !translatedDrawSucceeded
      ? this.dependencies.tilesetAssets.resolveTilesetAtlasImageSource()
      : null;
    if (!translatedDrawSucceeded && !vultureLookup && atlasImage) {
      const img = atlasImage;
      const width = Math.trunc(img.width);
      const tilesPerRow = Math.floor(width / size);
      const tileRows = Math.floor(img.height / height);
      const tileCount =
        tilesPerRow > 0 && tileRows > 0 ? tilesPerRow * tileRows : 0;
      if (tilesPerRow > 0 && tileCount > 0) {
        const atlasTileIndex = Math.max(
          0,
          this.dependencies.tilesetAssets.resolveAtlasTileIndexForRuntime(tileIndex, tileCount),
        );
        const sx = (atlasTileIndex % tilesPerRow) * size;
        const sy = Math.floor(atlasTileIndex / tilesPerRow) * height;

        // Draw the specific tile from the atlas
        context.drawImage(img, sx, sy, size, height, 0, 0, size, height);

        if (shouldApplyBackgroundRemoval) {
          this.applyTilesetBillboardBackgroundRemoval(
            context,
            img,
            size,
            tileCount,
            tilesPerRow,
            height,
          );
        }
      }
    }

    // Apply darkening if needed (for shadows/fog of war)
    if (darkenFactor < 1) {
      const alpha = THREE.MathUtils.clamp(1 - darkenFactor, 0, 1);
      // Use source-atop to preserve transparency if chroma key was applied
      context.globalCompositeOperation = shouldApplyBackgroundRemoval
        ? "source-atop"
        : "source-over";
      context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      context.fillRect(0, 0, size, height);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.magFilter = THREE.NearestFilter; // Keep pixel art sharp
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();

    return texture;
  }

  parseSolidChromaKeyColorHex(
    rawHex: string,
  ): { r: number; g: number; b: number } | null {
    const match = String(rawHex || "")
      .trim()
      .match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) {
      return null;
    }
    const hex = match[1];
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  applySolidColorChromaKey(
    context: CanvasRenderingContext2D,
    tileSize: number,
    tileHeight: number = tileSize,
  ): void {
    const solidColor = this.parseSolidChromaKeyColorHex(
      this.dependencies.engineState.clientOptions.tilesetSolidChromaKeyColorHex,
    );
    if (!solidColor) {
      return;
    }
    const imageData = context.getImageData(0, 0, tileSize, tileHeight);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i] === solidColor.r &&
        data[i + 1] === solidColor.g &&
        data[i + 2] === solidColor.b
      ) {
        data[i + 3] = 0;
      }
    }
    context.putImageData(imageData, 0, 0);
  }

  applyTilesetBillboardBackgroundRemoval(
    context: CanvasRenderingContext2D,
    atlasImage: HTMLImageElement | HTMLCanvasElement,
    tileSize: number,
    tileCount: number,
    tilesPerRow: number,
    tileHeight: number = tileSize,
  ): void {
    if (this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "none") {
      return;
    }
    if (this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "solid") {
      this.applySolidColorChromaKey(context, tileSize, tileHeight);
      return;
    }
    this.applyTilesetBackgroundRemoval(
      context,
      atlasImage,
      tileSize,
      tileCount,
      tilesPerRow,
      tileHeight,
    );
    if (
      isNh3dTilesetCombinedBackgroundRemovalForced(
        this.dependencies.engineState.clientOptions.tilesetPath,
      )
    ) {
      this.applySolidColorChromaKey(context, tileSize, tileHeight);
    }
  }

  getTilesetBackgroundTilePixels(
    atlasImage: HTMLImageElement | HTMLCanvasElement,
    tileSize: number,
    tileIndex: number,
    tileCount: number,
    tilesPerRow: number,
    tileHeight: number = tileSize,
  ): Uint8ClampedArray | null {
    const normalizedTileIndex = Math.trunc(tileIndex);
    if (
      !Number.isFinite(normalizedTileIndex) ||
      normalizedTileIndex < 0 ||
      normalizedTileIndex >= tileCount ||
      tilesPerRow <= 0
    ) {
      return null;
    }

    const cached =
      this.tilesetBackgroundTilePixelsCache.get(normalizedTileIndex);
    if (cached) {
      return cached;
    }

    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    const sx = (normalizedTileIndex % tilesPerRow) * tileSize;
    const sy = Math.floor(normalizedTileIndex / tilesPerRow) * tileHeight;
    context.clearRect(0, 0, tileSize, tileHeight);
    context.drawImage(
      atlasImage,
      sx,
      sy,
      tileSize,
      tileHeight,
      0,
      0,
      tileSize,
      tileHeight,
    );
    const pixels = context.getImageData(0, 0, tileSize, tileHeight).data;
    this.tilesetBackgroundTilePixelsCache.set(normalizedTileIndex, pixels);
    return pixels;
  }

  applyTilesetBackgroundRemoval(
    context: CanvasRenderingContext2D,
    atlasImage: HTMLImageElement | HTMLCanvasElement,
    tileSize: number,
    tileCount: number,
    tilesPerRow: number,
    tileHeight: number = tileSize,
  ): void {
    const backgroundPixels =
      this.dependencies.tilesetAssets.tilesetBackgroundReferenceTilePixels ??
      this.getTilesetBackgroundTilePixels(
        atlasImage,
        tileSize,
        this.dependencies.tilesetAssets.resolveTilesetBackgroundReferenceTileIndex(),
        tileCount,
        tilesPerRow,
        tileHeight,
      );
    if (!backgroundPixels) {
      return;
    }

    const imageData = context.getImageData(0, 0, tileSize, tileHeight);
    const data = imageData.data;
    // Per-channel color-difference threshold where background removal begins.
    // Pixels with max(R/G/B delta) <= this are treated as pure background (fully transparent).
    const alphaSoftMin = 12;
    // Per-channel color-difference threshold where background removal stops.
    // Pixels with max(R/G/B delta) >= this are treated as full foreground (keep full alpha).
    // Values between min/max are linearly feathered for smoother edges.
    const alphaSoftMax = 40;
    // Some tilesets (e.g. PixelHack) require exact-color removal: only pixels
    // that exactly match the reference background tile are cleared, with no
    // tolerance or feathering that would erode flat, indexed-color sprites.
    const exactRemoval = isNh3dTilesetExactBackgroundRemovalForced(
      this.dependencies.engineState.clientOptions.tilesetPath,
    );

    for (let i = 0; i < data.length; i += 4) {
      const sourceAlpha = data[i + 3];
      if (sourceAlpha === 0) {
        continue;
      }

      const deltaR = Math.abs(data[i] - backgroundPixels[i]);
      const deltaG = Math.abs(data[i + 1] - backgroundPixels[i + 1]);
      const deltaB = Math.abs(data[i + 2] - backgroundPixels[i + 2]);
      const delta = Math.max(deltaR, deltaG, deltaB);
      const visibility = exactRemoval
        ? delta === 0
          ? 0
          : 1
        : THREE.MathUtils.clamp(
            (delta - alphaSoftMin) / (alphaSoftMax - alphaSoftMin),
            0,
            1,
          );
      const nextAlpha = Math.round(sourceAlpha * visibility);
      data[i + 3] = nextAlpha;
      if (nextAlpha === 0) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }

    context.putImageData(imageData, 0, 0);
  }

  createGlyphTexture(
    baseColorHex: string,
    glyphChar: string,
    textColor: string,
    darkenFactor: number = 1,
    size: number = 256,
    drawFloorGrid: boolean = false,
    backgroundColorHex: string | null = null,
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create glyph texture canvas context");
    }
    this.drawGlyphTextureToCanvas(
      context,
      size,
      baseColorHex,
      glyphChar,
      textColor,
      darkenFactor,
      drawFloorGrid,
      backgroundColorHex,
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return texture;
  }

  drawGlyphTextureToCanvas(
    context: CanvasRenderingContext2D,
    size: number,
    baseColorHex: string,
    glyphChar: string,
    textColor: string,
    darkenFactor: number = 1,
    drawFloorGrid: boolean = false,
    backgroundColorHex: string | null = null,
  ): void {
    context.clearRect(0, 0, size, size);

    if (backgroundColorHex && backgroundColorHex.length > 0) {
      context.fillStyle = backgroundColorHex;
    } else {
      const tonedBackground = this.toneColor(
        baseColorHex,
        0.8 * THREE.MathUtils.clamp(darkenFactor, 0, 1),
      );
      const contrastBackground = this.ensureTextContrast(
        tonedBackground,
        textColor,
      );
      context.fillStyle = `#${contrastBackground}`;
    }
    context.fillRect(0, 0, size, size);

    if (drawFloorGrid) {
      const gridLineWidth = Math.max(2, Math.floor(size * 0.02));
      const inset = gridLineWidth * 0.5;
      context.lineWidth = gridLineWidth;
      context.strokeStyle = "rgba(8, 12, 16, 0.26)";
      context.strokeRect(
        inset,
        inset,
        size - gridLineWidth,
        size - gridLineWidth,
      );
    }

    const trimmed = glyphChar.trim();
    if (trimmed.length === 0) {
      return;
    }

    if (
      this.drawConnectedBoxDrawingGlyph(
        context,
        size,
        size,
        trimmed,
        textColor,
      )
    ) {
      return;
    }

    const fontSize = Math.floor(size * 0.6);
    context.font = `bold ${fontSize}px monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    context.fillText(trimmed, size / 2, size / 2);
  }

  drawConnectedBoxDrawingGlyph(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    displayChar: string,
    colorHex: string,
  ): boolean {
    const connections = getTerminalBoxDrawingConnections(displayChar);
    if (!connections) {
      return false;
    }

    // Font glyphs carry side bearings, so adjacent IBM/DEC wall characters
    // never quite meet. Draw their arms as solid, integer-aligned rectangles
    // that reach the texture edges instead.
    const strokeWidth = resolveTerminalWallStrokeWidth(width);
    const verticalStrokeStart = Math.floor((width - strokeWidth) / 2);
    const verticalStrokeEnd = verticalStrokeStart + strokeWidth;
    const horizontalStrokeStart = Math.floor((height - strokeWidth) / 2);
    const horizontalStrokeEnd = horizontalStrokeStart + strokeWidth;
    context.fillStyle = colorHex;

    if (connections.left || connections.right) {
      const startX = connections.left ? 0 : verticalStrokeStart;
      const endX = connections.right ? width : verticalStrokeEnd;
      context.fillRect(
        startX,
        horizontalStrokeStart,
        endX - startX,
        strokeWidth,
      );
    }
    if (connections.up || connections.down) {
      const startY = connections.up ? 0 : horizontalStrokeStart;
      const endY = connections.down ? height : horizontalStrokeEnd;
      context.fillRect(
        verticalStrokeStart,
        startY,
        strokeWidth,
        endY - startY,
      );
    }
    return true;
  }
}
