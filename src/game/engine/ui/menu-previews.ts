
import type { EngineState } from "../runtime/engine-state";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { TilesetAssets } from "../rendering/tileset-assets";

export interface MenuPreviewsDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "uiAdapter"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "buildInventoryDialogState"
    | "currentInventory"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "activeQuestionMenuItems"
    | "isInQuestion"
    | "rebuildActiveQuestionMenuPagination"
    | "syncQuestionDialogState"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveAtlasTileIndexForRuntime"
    | "resolveRuntimeVersion"
    | "resolveTilesetAtlasImageSource"
    | "shouldUseVultureTiles"
    | "tileSourceSize"
    | "vultureTilesetTranslator"
  >;
}

/** Menu item normalization and tileset-backed preview image caching. */
export class MenuPreviews {
  constructor(private readonly dependencies: MenuPreviewsDependencies) {}

  readonly menuTilePreviewDataUrlCache = new Map<string, string>();

  menuTilePreviewCanvas: HTMLCanvasElement | null = null;

  clearMenuTilePreviewCache(): void {
    this.menuTilePreviewDataUrlCache.clear();
    this.menuTilePreviewCanvas = null;
  }

  refreshMenuTilePreviewStateForUi(): void {
    if (this.dependencies.promptDialogs.currentInventory.length > 0) {
      this.dependencies.promptDialogs.currentInventory = this.normalizeMenuItemsForUi(
        this.dependencies.promptDialogs.currentInventory,
      );
      this.dependencies.engineState.uiAdapter.setInventory(this.dependencies.promptDialogs.buildInventoryDialogState());
    }

    if (this.dependencies.questionMenus.activeQuestionMenuItems.length > 0) {
      this.dependencies.questionMenus.activeQuestionMenuItems = this.normalizeMenuItemsForUi(
        this.dependencies.questionMenus.activeQuestionMenuItems,
      );
      this.dependencies.questionMenus.rebuildActiveQuestionMenuPagination();
      if (this.dependencies.questionMenus.isInQuestion) {
        this.dependencies.questionMenus.syncQuestionDialogState();
      }
    }
  }

  normalizeMenuItemsForUi(items: unknown): any[] {
    if (!Array.isArray(items)) {
      return [];
    }
    return items.map((item) => this.normalizeMenuItemForUi(item));
  }

  normalizeMenuItemForUi(item: unknown): any {
    if (!item || typeof item !== "object") {
      return item;
    }
    const normalizedItem = { ...(item as Record<string, unknown>) };
    const previewDataUrl =
      this.resolveMenuItemTilePreviewDataUrl(normalizedItem);
    if (previewDataUrl) {
      normalizedItem.tilePreviewDataUrl = previewDataUrl;
    } else {
      delete normalizedItem.tilePreviewDataUrl;
    }
    return normalizedItem;
  }

  resolveMenuItemTilePreviewDataUrl(
    item: Record<string, unknown>,
  ): string | null {
    if (
      !this.dependencies.tilesetAssets.shouldUseVultureTiles() ||
      !this.dependencies.tilesetAssets.vultureTilesetTranslator ||
      item.isCategory === true
    ) {
      return null;
    }

    const explicitTileApplicable = item.isTileApplicable;
    if (
      typeof explicitTileApplicable === "boolean" &&
      !explicitTileApplicable
    ) {
      return null;
    }

    const glyph = this.resolveNonNegativeMenuInteger(item.glyph);
    const tileIndex = this.resolveNonNegativeMenuInteger(item.tileIndex);
    if (glyph === null && tileIndex === null) {
      return null;
    }

    const glyphForLookup = glyph ?? -1;
    const previewSize = Math.max(
      32,
      Math.min(112, Math.trunc(this.dependencies.tilesetAssets.tileSourceSize) || 112),
    );
    const cacheKey = `${this.dependencies.engineState.clientOptions.tilesetPath}|rv:${this.dependencies.tilesetAssets.resolveRuntimeVersion()}|g:${glyphForLookup}|ti:${
      tileIndex === null ? "n" : tileIndex
    }|s:${previewSize}`;
    const cached = this.menuTilePreviewDataUrlCache.get(cacheKey);
    if (typeof cached === "string" && cached.length > 0) {
      return cached;
    }

    if (typeof document === "undefined") {
      return null;
    }
    let previewCanvas = this.menuTilePreviewCanvas;
    if (!previewCanvas) {
      previewCanvas = document.createElement("canvas");
      this.menuTilePreviewCanvas = previewCanvas;
    }
    if (
      previewCanvas.width !== previewSize ||
      previewCanvas.height !== previewSize
    ) {
      previewCanvas.width = previewSize;
      previewCanvas.height = previewSize;
    }
    const context = previewCanvas.getContext("2d");
    if (!context) {
      return null;
    }

    const drawAtlasPreview = (runtimeTileIndex: number | null): boolean => {
      if (runtimeTileIndex === null) {
        return false;
      }
      const atlasImage = this.dependencies.tilesetAssets.resolveTilesetAtlasImageSource();
      if (!atlasImage) {
        return false;
      }
      const sourceTileSize = Math.max(1, Math.trunc(this.dependencies.tilesetAssets.tileSourceSize) || 1);
      const tilesPerRow = Math.floor(atlasImage.width / sourceTileSize);
      const tileRows = Math.floor(atlasImage.height / sourceTileSize);
      const tileCount =
        tilesPerRow > 0 && tileRows > 0 ? tilesPerRow * tileRows : 0;
      if (tilesPerRow <= 0 || tileCount <= 0) {
        return false;
      }
      const atlasTileIndex = this.dependencies.tilesetAssets.resolveAtlasTileIndexForRuntime(
        runtimeTileIndex,
        tileCount,
      );
      if (atlasTileIndex < 0 || atlasTileIndex >= tileCount) {
        return false;
      }
      const sx = (atlasTileIndex % tilesPerRow) * sourceTileSize;
      const sy = Math.floor(atlasTileIndex / tilesPerRow) * sourceTileSize;
      context.clearRect(0, 0, previewSize, previewSize);
      context.imageSmoothingEnabled = false;
      context.drawImage(
        atlasImage,
        sx,
        sy,
        sourceTileSize,
        sourceTileSize,
        0,
        0,
        previewSize,
        previewSize,
      );
      return true;
    };

    context.clearRect(0, 0, previewSize, previewSize);
    const lookup = this.dependencies.tilesetAssets.vultureTilesetTranslator.resolveLookupForTile({
      glyph: glyphForLookup,
      tileIndex,
      materialKind: null,
      forBillboard: true,
    });
    if (!lookup) {
      if (!drawAtlasPreview(tileIndex)) {
        return null;
      }
    } else {
      const drewTile =
        this.dependencies.tilesetAssets.vultureTilesetTranslator.drawLookupSourcePreview({
          context,
          size: previewSize,
          lookup,
        }) ||
        this.dependencies.tilesetAssets.vultureTilesetTranslator.drawLookupTile({
          context,
          size: previewSize,
          lookup,
          forBillboard: true,
        });
      if (!drewTile && !drawAtlasPreview(tileIndex)) {
        return null;
      }
    }
    const dataUrl = previewCanvas.toDataURL("image/png");
    if (dataUrl) {
      this.menuTilePreviewDataUrlCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
    return null;
  }

  resolveNonNegativeMenuInteger(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    const normalized = Math.trunc(value);
    return normalized >= 0 ? normalized : null;
  }
}
