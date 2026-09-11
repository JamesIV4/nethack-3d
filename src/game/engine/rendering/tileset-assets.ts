import * as THREE from "three";
import type { NethackRuntimeVersion } from "../../../runtime/types";
import { getGlyphCatalogEntry, getGlyphCatalogRanges } from "../../glyphs/registry";
import type { TileMaterialKind } from "../../glyphs";
import type { Nh3dClientOptions } from "../../ui-types";
import {
  findNh3dTilesetByPath,
  inferNh3dTilesetTileSizeFromAtlasWidthForPath,
  resolveNh3dFuseBaseTilesetPathForLegacyNh5Runtime,
  resolveNh3dTilesetAssetUrl,
  type Nh3dTilesetTileLayoutVersion
} from "../../tilesets";
import {
  nh5ExpectedTileCount,
  nh5OutputRows,
  nh5TilesPerRow,
  shouldTranslateNh367TilesetForNh5Runtime,
  translateNh367TileIndexToNh5,
  translateNh5TileIndexToNh367,
  translateNh5TileIndexToNh367PreservingAliases
} from "../../tileset-367-to-5-translation";
import { VultureTilesetTranslator } from "../../vulture/translation";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "./entity-billboards";
import type { GlyphTextures } from "./glyph-textures";
import type { HeldWeapon } from "./held-weapon";
import type { MenuPreviews } from "../ui/menu-previews";
import type { PlayerStatus } from "../ui/player-status";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { RenderPipeline } from "./render-pipeline";
import type { TileUpdates } from "../world/tile-updates";
import type { VultureProjection } from "./vulture-projection";
import type { VultureProjectionDebug } from "../diagnostics/vulture-projection-debug";
import type { VultureWalls } from "./vulture-walls";
import type { WallGeometry } from "./wall-geometry";
import type { WallOverlays } from "./wall-overlays";

export interface TilesetAssetsDependencies {
  readonly engineState: Pick<
    EngineState,
    "characterCreationConfig"
    | "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "monsterBillboardTextures"
    | "monsterBillboards"
    | "removeMonsterBillboard"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "disposeGlyphOverlay"
    | "glyphOverlayMap"
    | "glyphTextureCache"
    | "tilesetBackgroundTilePixelsCache"
  >;
  readonly heldWeapon: Pick<
    HeldWeapon,
    "invalidateFpsHeldWeaponTexture"
  >;
  readonly menuPreviews: Pick<
    MenuPreviews,
    "clearMenuTilePreviewCache"
    | "refreshMenuTilePreviewStateForUi"
  >;
  readonly playerStatus: Pick<
    PlayerStatus,
    "runtimeObjectTileIndexByObjectId"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "syncLoadingVisibility"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "refreshTilesFromStateCache"
  >;
  readonly vultureProjection: Pick<
    VultureProjection,
    "disposeVulturePrebakedProjectionManifest"
    | "ensureVulturePrebakedProjectionManifest"
  >;
  readonly vultureProjectionDebug: Pick<
    VultureProjectionDebug,
    "syncVultureWallProjectionDebugPanelVisibility"
  >;
  readonly vultureWalls: Pick<
    VultureWalls,
    "pendingVultureRoomDecorReconcileKeys"
    | "vultureRoomDecorReconcileScheduled"
  >;
  readonly wallGeometry: Pick<
    WallGeometry,
    "clearFpsWallChamferMaterialCaches"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "disposeAllWallSideTileOverlays"
  >;
}

/** Tileset loading, legacy atlas translation, sampling and asset cache lifecycle */
export class TilesetAssets {
  constructor(private readonly dependencies: TilesetAssetsDependencies) {}

  tilesetTexture: THREE.Texture | null = null;

  loadedTilesetSourceAtlasImage: HTMLImageElement | null = null;

  tilesetBackgroundReferenceTileCanvas: HTMLCanvasElement | null = null;

  tilesetBackgroundReferenceTilePixels: Uint8ClampedArray | null = null;

  tileSourceSize = 32;

  vultureTilesetTranslator: VultureTilesetTranslator | null = null;

  vultureTilesetDataRootUrl = "";

  vultureTilesetTranslatorRuntimeVersion: NethackRuntimeVersion | null =
    null;

  tilesetCompilationLoadingVisible = false;

  tilesetTextureLoadRequestId = 0;

  loadedTilesetSourceLayoutVersion: Nh3dTilesetTileLayoutVersion =
    "unknown";

  loadedTilesetTileLayoutVersion: Nh3dTilesetTileLayoutVersion =
    "unknown";

  readonly handleVultureTilesetAssetReady = (): void => {
    if (this.dependencies.engineState.clientOptions.tilesetMode !== "tiles") {
      this.refreshTilesetCompilationLoadingState();
      return;
    }
    this.dependencies.menuPreviews.clearMenuTilePreviewCache();
    this.invalidateTilesetDependentCaches();
    this.dependencies.tileUpdates.refreshTilesFromStateCache();
    this.dependencies.menuPreviews.refreshMenuTilePreviewStateForUi();
    this.refreshTilesetCompilationLoadingState();
  };

  isVultureTilesActive(options: Nh3dClientOptions): boolean {
    if (options.tilesetMode !== "tiles") {
      return false;
    }
    return findNh3dTilesetByPath(options.tilesetPath)?.source === "vulture";
  }

  shouldUseDesktopTextureAnisotropy(): boolean {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return true;
    }
    return !window.matchMedia("(pointer: coarse)").matches;
  }

  resolveTextureAnisotropyLevel(): number {
    const maxAnisotropy = Math.max(
      1,
      this.dependencies.renderPipeline.renderer.capabilities.getMaxAnisotropy(),
    );
    const targetAnisotropy = this.shouldUseDesktopTextureAnisotropy() ? 8 : 2;
    return Math.min(targetAnisotropy, maxAnisotropy);
  }

  configureTilesetTextureSampling(texture: THREE.Texture): void {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();
    texture.needsUpdate = true;
  }

  invalidateTilesetDependentCaches(): void {
    this.dependencies.wallOverlays.disposeAllWallSideTileOverlays();
    for (const overlay of this.dependencies.glyphTextures.glyphOverlayMap.values()) {
      this.dependencies.glyphTextures.disposeGlyphOverlay(overlay);
    }
    this.dependencies.glyphTextures.glyphOverlayMap.clear();
    this.dependencies.glyphTextures.glyphTextureCache.forEach(({ texture }) => texture.dispose());
    this.dependencies.glyphTextures.glyphTextureCache.clear();

    for (const key of Array.from(this.dependencies.entityBillboards.monsterBillboards.keys())) {
      this.dependencies.entityBillboards.removeMonsterBillboard(key);
    }
    for (const entry of this.dependencies.entityBillboards.monsterBillboardTextures.values()) {
      entry.texture.dispose();
    }
    this.dependencies.entityBillboards.monsterBillboardTextures.clear();
    this.dependencies.heldWeapon.invalidateFpsHeldWeaponTexture();
    this.dependencies.wallGeometry.clearFpsWallChamferMaterialCaches();
    this.dependencies.glyphTextures.tilesetBackgroundTilePixelsCache.clear();
  }

  invalidateBillboardTextureCaches(): void {
    for (const key of Array.from(this.dependencies.entityBillboards.monsterBillboards.keys())) {
      this.dependencies.entityBillboards.removeMonsterBillboard(key);
    }
    for (const entry of this.dependencies.entityBillboards.monsterBillboardTextures.values()) {
      entry.texture.dispose();
    }
    this.dependencies.entityBillboards.monsterBillboardTextures.clear();
    this.dependencies.heldWeapon.invalidateFpsHeldWeaponTexture();
    this.dependencies.glyphTextures.tilesetBackgroundTilePixelsCache.clear();
  }

  disposeVultureTilesetTranslator(): void {
    this.vultureTilesetTranslator?.dispose();
    this.vultureTilesetTranslator = null;
    this.vultureTilesetDataRootUrl = "";
    this.vultureTilesetTranslatorRuntimeVersion = null;
    this.dependencies.vultureWalls.pendingVultureRoomDecorReconcileKeys.clear();
    this.dependencies.vultureWalls.vultureRoomDecorReconcileScheduled = false;
    this.dependencies.vultureProjection.disposeVulturePrebakedProjectionManifest();
  }

  ensureVultureTilesetTranslator(dataRootUrl: string): void {
    const normalizedDataRootUrl = String(dataRootUrl || "")
      .trim()
      .replace(/\/+$/, "");
    const runtimeVersion = this.resolveRuntimeVersion();
    if (!normalizedDataRootUrl) {
      this.disposeVultureTilesetTranslator();
      return;
    }
    if (
      this.vultureTilesetTranslator &&
      this.vultureTilesetDataRootUrl === normalizedDataRootUrl &&
      this.vultureTilesetTranslatorRuntimeVersion === runtimeVersion
    ) {
      return;
    }
    this.disposeVultureTilesetTranslator();
    this.vultureTilesetTranslator = new VultureTilesetTranslator({
      dataRootUrl: normalizedDataRootUrl,
      onAssetReady: this.handleVultureTilesetAssetReady,
      runtimeVersion,
    });
    this.vultureTilesetTranslator.setRuntimeObjectTileIndexByObjectId(
      this.dependencies.playerStatus.runtimeObjectTileIndexByObjectId,
    );
    this.vultureTilesetTranslator.ensureAssetLoadingStarted();
    this.vultureTilesetDataRootUrl = normalizedDataRootUrl;
    this.vultureTilesetTranslatorRuntimeVersion = runtimeVersion;
    this.dependencies.vultureProjection.ensureVulturePrebakedProjectionManifest(normalizedDataRootUrl);
  }

  loadTilesetImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error(`Failed to load tileset atlas image: ${url}`));
      image.src = url;
    });
  }

  clearTilesetBackgroundReferenceTileCache(): void {
    this.tilesetBackgroundReferenceTileCanvas = null;
    this.tilesetBackgroundReferenceTilePixels = null;
  }

  captureTilesetBackgroundReferenceTile(
    atlasImage: HTMLImageElement | HTMLCanvasElement | null,
    tileSize: number,
  ): void {
    this.clearTilesetBackgroundReferenceTileCache();
    if (!atlasImage || tileSize <= 0) {
      return;
    }
    const atlasWidth = Math.max(0, Math.trunc(atlasImage.width || 0));
    const atlasHeight = Math.max(0, Math.trunc(atlasImage.height || 0));
    const tilesPerRow = Math.floor(atlasWidth / tileSize);
    const rows = Math.floor(atlasHeight / tileSize);
    const tileCount = tilesPerRow > 0 && rows > 0 ? tilesPerRow * rows : 0;
    const tileIndex = Math.max(
      0,
      Math.trunc(this.dependencies.engineState.clientOptions.tilesetBackgroundTileId),
    );
    if (tileCount <= 0 || tileIndex >= tileCount) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return;
    }
    context.imageSmoothingEnabled = false;
    const sourceX = (tileIndex % tilesPerRow) * tileSize;
    const sourceY = Math.floor(tileIndex / tilesPerRow) * tileSize;
    context.clearRect(0, 0, tileSize, tileSize);
    context.drawImage(
      atlasImage,
      sourceX,
      sourceY,
      tileSize,
      tileSize,
      0,
      0,
      tileSize,
      tileSize,
    );
    this.tilesetBackgroundReferenceTilePixels = context.getImageData(
      0,
      0,
      tileSize,
      tileSize,
    ).data;
    this.tilesetBackgroundReferenceTileCanvas = canvas;
  }

  drawTilesetBackgroundReferenceTile(
    context: CanvasRenderingContext2D,
    tileSize: number,
  ): boolean {
    const sourceCanvas = this.tilesetBackgroundReferenceTileCanvas;
    if (!sourceCanvas || sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
      return false;
    }
    context.drawImage(sourceCanvas, 0, 0, tileSize, tileSize);
    return true;
  }

  createTilesetTextureFromSource(
    source: HTMLImageElement | HTMLCanvasElement,
  ): THREE.Texture {
    const texture =
      source instanceof HTMLCanvasElement
        ? new THREE.CanvasTexture(source)
        : new THREE.Texture(source);
    this.configureTilesetTextureSampling(texture);
    return texture;
  }

  shouldCompileLegacyTilesetAtlasForNh5Runtime(
    tileLayoutVersion: Nh3dTilesetTileLayoutVersion,
    atlasTileCount: number,
  ): boolean {
    return shouldTranslateNh367TilesetForNh5Runtime(
      this.resolveRuntimeVersion(),
      atlasTileCount,
      tileLayoutVersion,
    );
  }

  compileLegacyTilesetAtlasToNh5(
    legacyAtlasImage: HTMLImageElement,
    tileSize: number,
    fuseBaseImage: HTMLImageElement | null,
  ): HTMLCanvasElement {
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = nh5TilesPerRow * tileSize;
    outputCanvas.height = nh5OutputRows * tileSize;
    const context = outputCanvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create compiled tileset atlas canvas context");
    }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

    const sourceTilesPerRow = Math.floor(legacyAtlasImage.width / tileSize);
    const sourceRows = Math.floor(legacyAtlasImage.height / tileSize);
    const sourceTileCount =
      sourceTilesPerRow > 0 && sourceRows > 0
        ? sourceTilesPerRow * sourceRows
        : 0;
    const fuseBaseTilesPerRow = fuseBaseImage
      ? Math.floor(fuseBaseImage.width / tileSize)
      : 0;
    const fuseBaseRows = fuseBaseImage
      ? Math.floor(fuseBaseImage.height / tileSize)
      : 0;
    const fuseBaseTileCount =
      fuseBaseTilesPerRow > 0 && fuseBaseRows > 0
        ? fuseBaseTilesPerRow * fuseBaseRows
        : 0;
    for (
      let nh5TileIndex = 0;
      nh5TileIndex < nh5ExpectedTileCount;
      nh5TileIndex += 1
    ) {
      const rawMappedTileIndex =
        translateNh5TileIndexToNh367PreservingAliases(nh5TileIndex);
      const shouldUseFuseBaseTile =
        rawMappedTileIndex < 0 &&
        fuseBaseImage !== null &&
        nh5TileIndex < fuseBaseTileCount;
      const sourceTileIndex =
        rawMappedTileIndex < 0
          ? Math.abs(rawMappedTileIndex)
          : rawMappedTileIndex;
      const destX = (nh5TileIndex % nh5TilesPerRow) * tileSize;
      const destY = Math.floor(nh5TileIndex / nh5TilesPerRow) * tileSize;
      context.clearRect(destX, destY, tileSize, tileSize);
      if (shouldUseFuseBaseTile && fuseBaseImage) {
        const fuseSourceX = (nh5TileIndex % fuseBaseTilesPerRow) * tileSize;
        const fuseSourceY =
          Math.floor(nh5TileIndex / fuseBaseTilesPerRow) * tileSize;
        context.drawImage(
          fuseBaseImage,
          fuseSourceX,
          fuseSourceY,
          tileSize,
          tileSize,
          destX,
          destY,
          tileSize,
          tileSize,
        );
        continue;
      }
      if (
        !Number.isFinite(sourceTileIndex) ||
        sourceTileIndex < 0 ||
        sourceTileIndex >= sourceTileCount
      ) {
        continue;
      }
      const sourceX = (sourceTileIndex % sourceTilesPerRow) * tileSize;
      const sourceY =
        Math.floor(sourceTileIndex / sourceTilesPerRow) * tileSize;
      context.drawImage(
        legacyAtlasImage,
        sourceX,
        sourceY,
        tileSize,
        tileSize,
        destX,
        destY,
        tileSize,
        tileSize,
      );
    }

    return outputCanvas;
  }

  loadTilesetTexture(options: Nh3dClientOptions): void {
    const loadRequestId = ++this.tilesetTextureLoadRequestId;
    const shouldShowCompileLoading = options.tilesetMode === "tiles";
    this.setTilesetCompilationLoadingVisible(shouldShowCompileLoading);
    const tileset = findNh3dTilesetByPath(options.tilesetPath);
    this.loadedTilesetSourceAtlasImage = null;
    this.clearTilesetBackgroundReferenceTileCache();
    this.loadedTilesetSourceLayoutVersion =
      tileset?.tileLayoutVersion ?? "unknown";
    this.loadedTilesetTileLayoutVersion =
      tileset?.tileLayoutVersion ?? "unknown";
    const tilesetAssetUrl = resolveNh3dTilesetAssetUrl(options.tilesetPath);
    if (!tileset) {
      this.disposeVultureTilesetTranslator();
      this.tilesetTexture?.dispose();
      this.tilesetTexture = null;
      this.tileSourceSize = 32;
      this.loadedTilesetSourceLayoutVersion = "unknown";
      this.loadedTilesetTileLayoutVersion = "unknown";
      this.invalidateTilesetDependentCaches();
      if (this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
        this.dependencies.tileUpdates.refreshTilesFromStateCache();
      }
      this.dependencies.vultureProjectionDebug.syncVultureWallProjectionDebugPanelVisibility();
      this.setTilesetCompilationLoadingVisible(false);
      return;
    }

    if (tileset.source === "vulture") {
      this.tilesetTexture?.dispose();
      this.tilesetTexture = null;
      this.ensureVultureTilesetTranslator(tilesetAssetUrl || "");
      this.tileSourceSize =
        this.vultureTilesetTranslator?.nominalTileSize ?? 112;
      this.loadedTilesetSourceAtlasImage = null;
      this.clearTilesetBackgroundReferenceTileCache();
      this.loadedTilesetSourceLayoutVersion = tileset.tileLayoutVersion;
      this.loadedTilesetTileLayoutVersion = tileset.tileLayoutVersion;
      this.invalidateTilesetDependentCaches();
      if (this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
        this.dependencies.tileUpdates.refreshTilesFromStateCache();
      }
      this.dependencies.vultureProjectionDebug.syncVultureWallProjectionDebugPanelVisibility();
      this.refreshTilesetCompilationLoadingState();
      return;
    }

    this.disposeVultureTilesetTranslator();
    this.dependencies.vultureProjectionDebug.syncVultureWallProjectionDebugPanelVisibility();
    this.tileSourceSize = 32;
    const atlasUrl = tilesetAssetUrl || tileset.path;
    void (async () => {
      try {
        const sourceImage = await this.loadTilesetImage(atlasUrl);
        if (loadRequestId !== this.tilesetTextureLoadRequestId) {
          return;
        }
        const atlasWidth = Math.max(0, Math.trunc(sourceImage.width || 0));
        const tileSize = inferNh3dTilesetTileSizeFromAtlasWidthForPath(
          atlasWidth,
          tileset.path,
        );
        const atlasHeight = Math.max(0, Math.trunc(sourceImage.height || 0));
        const sourceTilesPerRow = Math.floor(
          atlasWidth / Math.max(1, tileSize),
        );
        const sourceRows = Math.floor(atlasHeight / Math.max(1, tileSize));
        const sourceTileCount =
          sourceTilesPerRow > 0 && sourceRows > 0
            ? sourceTilesPerRow * sourceRows
            : 0;
        this.loadedTilesetSourceAtlasImage = sourceImage;
        this.captureTilesetBackgroundReferenceTile(sourceImage, tileSize);
        let textureSource: HTMLImageElement | HTMLCanvasElement = sourceImage;
        let loadedLayoutVersion: Nh3dTilesetTileLayoutVersion =
          tileset.tileLayoutVersion;
        let sourceLayoutVersion: Nh3dTilesetTileLayoutVersion =
          tileset.tileLayoutVersion;
        if (
          this.shouldCompileLegacyTilesetAtlasForNh5Runtime(
            tileset.tileLayoutVersion,
            sourceTileCount,
          )
        ) {
          const fuseBaseTilesetPath =
            resolveNh3dFuseBaseTilesetPathForLegacyNh5Runtime(tileset.path);
          const fuseBaseTilesetAssetUrl = fuseBaseTilesetPath
            ? (resolveNh3dTilesetAssetUrl(fuseBaseTilesetPath) ??
              fuseBaseTilesetPath)
            : null;
          let fuseBaseImage: HTMLImageElement | null = null;
          if (fuseBaseTilesetAssetUrl) {
            try {
              fuseBaseImage = await this.loadTilesetImage(
                fuseBaseTilesetAssetUrl,
              );
            } catch (error) {
              console.warn(
                `Failed to load fuse base tileset atlas: ${fuseBaseTilesetAssetUrl}`,
                error,
              );
            }
          }
          if (loadRequestId !== this.tilesetTextureLoadRequestId) {
            return;
          }
          textureSource = this.compileLegacyTilesetAtlasToNh5(
            sourceImage,
            tileSize,
            fuseBaseImage,
          );
          loadedLayoutVersion = "5.0";
          sourceLayoutVersion =
            tileset.tileLayoutVersion === "unknown"
              ? "3.6.7"
              : tileset.tileLayoutVersion;
        }
        if (loadRequestId !== this.tilesetTextureLoadRequestId) {
          return;
        }
        const nextTexture = this.createTilesetTextureFromSource(textureSource);
        if (this.tilesetTexture && this.tilesetTexture !== nextTexture) {
          this.tilesetTexture.dispose();
        }
        this.tilesetTexture = nextTexture;
        this.tileSourceSize = tileSize;
        this.loadedTilesetSourceLayoutVersion = sourceLayoutVersion;
        this.loadedTilesetTileLayoutVersion = loadedLayoutVersion;
        this.invalidateTilesetDependentCaches();
        if (this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
          this.dependencies.tileUpdates.refreshTilesFromStateCache();
        }
        this.setTilesetCompilationLoadingVisible(false);
      } catch (error) {
        if (loadRequestId !== this.tilesetTextureLoadRequestId) {
          return;
        }
        this.loadedTilesetSourceAtlasImage = null;
        this.clearTilesetBackgroundReferenceTileCache();
        console.warn(`Failed to load tileset atlas: ${tileset.path}`, error);
        this.setTilesetCompilationLoadingVisible(false);
      }
    })();
  }

  shouldUseVultureTiles(): boolean {
    return (
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
      this.vultureTilesetTranslator !== null
    );
  }

  resolveRuntimeVersion(): NethackRuntimeVersion {
    return this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7";
  }

  shouldUseNh5LegacyTilesetCompatibility(): boolean {
    if (this.resolveRuntimeVersion() !== "5.0") {
      return false;
    }
    if (this.loadedTilesetTileLayoutVersion === "5.0") {
      return false;
    }
    if (this.loadedTilesetTileLayoutVersion === "3.6.7") {
      return true;
    }
    return shouldTranslateNh367TilesetForNh5Runtime(
      "5.0",
      this.resolveLoadedAtlasTileCount(),
      this.loadedTilesetTileLayoutVersion,
    );
  }

  isNh5DarkCorridorWallVariantForLegacyTileset(
    sourceGlyph: number,
    runtimeTileIndex: number,
    materialKind: TileMaterialKind,
    runtimeSymidx: number | null = null,
  ): boolean {
    if (this.dependencies.engineState.clientOptions.tilesetMode !== "tiles") {
      return false;
    }
    if (this.resolveRuntimeVersion() !== "5.0") {
      return false;
    }
    if (!this.dependencies.engineState.clientOptions.overrideNh5DarkCorridorWallTiles) {
      return false;
    }
    if (materialKind !== "wall" && materialKind !== "dark_wall") {
      return false;
    }
    const normalizedSourceGlyph = Math.trunc(sourceGlyph);
    const normalizedRuntimeTileIndex = Math.trunc(runtimeTileIndex);
    if (
      !Number.isFinite(normalizedSourceGlyph) ||
      normalizedSourceGlyph < 0 ||
      !Number.isFinite(normalizedRuntimeTileIndex) ||
      normalizedRuntimeTileIndex < 0
    ) {
      return false;
    }
    const symidx =
      typeof runtimeSymidx === "number" &&
      Number.isFinite(runtimeSymidx) &&
      runtimeSymidx >= 0
        ? Math.trunc(runtimeSymidx)
        : (() => {
            const glyphEntry = getGlyphCatalogEntry(normalizedSourceGlyph);
            if (!glyphEntry || glyphEntry.kind !== "cmap") {
              return null;
            }
            return typeof glyphEntry.symidx === "number" &&
              Number.isFinite(glyphEntry.symidx)
              ? Math.trunc(glyphEntry.symidx)
              : null;
          })();
    if (symidx === null) {
      return false;
    }
    // NetHack 5.0 dark corridor wall tiles can come through as cmap symidx=0
    // (stone/out-of-bounds semantic). Legacy 3.6 tilesets do not contain those
    // dedicated textures, and some 5.0 tilesets still prefer compatibility
    // overrides for consistency, so route them through dark-wall overrides.
    if (symidx === 0) {
      return true;
    }
    if (!this.shouldUseNh5LegacyTilesetCompatibility()) {
      return false;
    }
    if (symidx < 1 || symidx > 11) {
      return false;
    }
    const cmapRange = getGlyphCatalogRanges().find(
      (range) => range.kind === "cmap",
    );
    if (!cmapRange || !Number.isFinite(cmapRange.start)) {
      return false;
    }
    const canonicalGlyph = Math.trunc(cmapRange.start) + symidx;
    if (normalizedSourceGlyph !== canonicalGlyph) {
      return true;
    }
    const canonicalEntry = getGlyphCatalogEntry(canonicalGlyph);
    if (
      !canonicalEntry ||
      typeof canonicalEntry.tileIndex !== "number" ||
      !Number.isFinite(canonicalEntry.tileIndex)
    ) {
      return false;
    }
    const canonicalTileIndex = Math.trunc(canonicalEntry.tileIndex);
    return normalizedRuntimeTileIndex !== canonicalTileIndex;
  }

  isDarkCorridorWallCompatibilityActiveOnMesh(
    mesh: THREE.Mesh,
  ): boolean {
    return (
      mesh.userData?.isInferredDarkCorridorWall === true ||
      mesh.userData?.useDarkCorridorWallCompatibility === true
    );
  }

  resolveAtlasTileIndexForRuntime(
    tileIndex: number,
    atlasTileCount: number,
  ): number {
    const normalizedTileIndex = Math.trunc(tileIndex);
    if (!Number.isFinite(normalizedTileIndex) || normalizedTileIndex < 0) {
      return normalizedTileIndex;
    }
    try {
      if (
        !shouldTranslateNh367TilesetForNh5Runtime(
          this.resolveRuntimeVersion(),
          atlasTileCount,
          this.loadedTilesetTileLayoutVersion,
        )
      ) {
        return normalizedTileIndex;
      }
      return translateNh5TileIndexToNh367(normalizedTileIndex);
    } catch {
      return normalizedTileIndex;
    }
  }

  resolveLoadedAtlasTileCount(): number {
    const imageCandidate = this.resolveTilesetAtlasImageSource() as
      | { width?: unknown; height?: unknown }
      | undefined;
    if (!imageCandidate || typeof imageCandidate !== "object") {
      return 0;
    }
    const atlasWidth = Math.max(
      0,
      Math.trunc(Number(imageCandidate.width) || 0),
    );
    const atlasHeight = Math.max(
      0,
      Math.trunc(Number(imageCandidate.height) || 0),
    );
    const tileSize = Math.max(1, Math.trunc(this.tileSourceSize) || 1);
    const tilesPerRow = Math.floor(atlasWidth / tileSize);
    const rows = Math.floor(atlasHeight / tileSize);
    return tilesPerRow > 0 && rows > 0 ? tilesPerRow * rows : 0;
  }

  resolveTilesetBackgroundReferenceTileIndex(): number {
    const normalizedTileIndex = Math.max(
      0,
      Math.trunc(this.dependencies.engineState.clientOptions.tilesetBackgroundTileId),
    );
    return this.resolveOverrideTileIndexForRuntime(normalizedTileIndex);
  }

  resolveTilesetAtlasImageSource():
    | HTMLImageElement
    | HTMLCanvasElement
    | null {
    const imageCandidate = this.tilesetTexture?.image;
    if (imageCandidate instanceof HTMLCanvasElement) {
      return imageCandidate.width > 0 && imageCandidate.height > 0
        ? imageCandidate
        : null;
    }
    if (imageCandidate instanceof HTMLImageElement) {
      return imageCandidate.complete &&
        imageCandidate.width > 0 &&
        imageCandidate.height > 0
        ? imageCandidate
        : null;
    }
    return null;
  }

  resolveOverrideTileIndexForRuntime(tileIndex: number): number {
    const normalizedTileIndex = Math.trunc(tileIndex);
    if (!Number.isFinite(normalizedTileIndex) || normalizedTileIndex < 0) {
      return normalizedTileIndex;
    }
    try {
      if (
        !shouldTranslateNh367TilesetForNh5Runtime(
          this.resolveRuntimeVersion(),
          this.resolveLoadedAtlasTileCount(),
          this.loadedTilesetSourceLayoutVersion,
        )
      ) {
        return normalizedTileIndex;
      }
      return translateNh367TileIndexToNh5(normalizedTileIndex);
    } catch {
      return normalizedTileIndex;
    }
  }

  setTilesetCompilationLoadingVisible(visible: boolean): void {
    const nextVisible = Boolean(visible);
    if (this.tilesetCompilationLoadingVisible === nextVisible) {
      return;
    }
    this.tilesetCompilationLoadingVisible = nextVisible;
    this.dependencies.promptDialogs.syncLoadingVisibility();
  }

  refreshTilesetCompilationLoadingState(): void {
    if (this.dependencies.engineState.clientOptions.tilesetMode !== "tiles") {
      this.setTilesetCompilationLoadingVisible(false);
      return;
    }
    const translator = this.vultureTilesetTranslator;
    if (translator) {
      this.setTilesetCompilationLoadingVisible(
        translator.isAssetCompilationInProgress(),
      );
    }
  }
}
