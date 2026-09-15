import {
  useMemo
} from "react";
import type {
  Nh3dClientOptions,
  NethackMenuItem
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  type TopScoreInventoryItem
} from "../../../runtime/top-score-storage";
import {
  isNh3dTilesetCombinedBackgroundRemovalForced,
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import type {
  TileAtlasState,
  TilePickerEntry
} from "./atlas";
import {
  createIsolatedAtlasTilePreviewDataUrl,
  formatTileGlyphLabel,
  getAtlasTilePixels,
  resolvePreviewAtlasTileIdForRuntime
} from "./atlas";
import {
  t
} from "../shared/translations";
import {
  resolveTopScoreInventoryFallbackGlyph
} from "../scores/report-content";
import {
  resolveMenuItemTilePreviewDataUrl
} from "./menu-glyphs";

export interface UseTilePreviewsDependencies {
  readonly tileAtlasState: TileAtlasState;
  readonly representativeGlyphByTileId: Map<number, string>;
  readonly representativeGlyphNumberByTileId: Map<number, number>;
  readonly selectedTilesetEntry: Nh3dTilesetEntry | null;
  readonly selectedTileAtlasLoadRequested: boolean;
  readonly tileAtlasImage: HTMLImageElement | null;
  readonly clientOptions: Nh3dClientOptions;
  readonly activeRuntimeVersion: NethackRuntimeVersion;
}

/** Renders tile previews for menus, inventory and archived scores. */
export function useTilePreviews(dependencies: UseTilePreviewsDependencies) {
  const {
    tileAtlasState,
    representativeGlyphByTileId,
    representativeGlyphNumberByTileId,
    selectedTilesetEntry,
    selectedTileAtlasLoadRequested,
    tileAtlasImage,
    clientOptions,
    activeRuntimeVersion,
  } = dependencies;

  const tilePickerEntries = useMemo<TilePickerEntry[]>(() => {
    if (!tileAtlasState.loaded || tileAtlasState.tileCount <= 0) {
      return [];
    }
    const entries: TilePickerEntry[] = [];
    for (let tileId = 0; tileId < tileAtlasState.tileCount; tileId += 1) {
      const glyphChar = representativeGlyphByTileId.get(tileId) ?? " ";
      entries.push({
        tileId,
        glyphLabel: formatTileGlyphLabel(glyphChar),
        glyphNumber: representativeGlyphNumberByTileId.get(tileId) ?? null,
      });
    }
    return entries;
  }, [
    representativeGlyphByTileId,
    representativeGlyphNumberByTileId,
    tileAtlasState.loaded,
    tileAtlasState.tileCount,
  ]);

  const tilePickerStatusText =
    !selectedTilesetEntry || !selectedTileAtlasLoadRequested
      ? t.tilePicker.noAtlasAvailable
      : tileAtlasState.failed
        ? t.tilePicker.unableToLoadAtlas
        : tileAtlasState.loaded
          ? t.tilePicker.atlasLoaded
          : t.tilePicker.loadingAtlas;

  const tilePreviewDataUrlByIdRaw = useMemo(() => {
    const previewByTileId = new Map<number, string>();
    if (
      !tileAtlasState.loaded ||
      !tileAtlasImage ||
      tileAtlasState.tileCount <= 0
    ) {
      return previewByTileId;
    }
    for (let tileId = 0; tileId < tileAtlasState.tileCount; tileId += 1) {
      const dataUrl = createIsolatedAtlasTilePreviewDataUrl(
        tileAtlasImage,
        tileId,
        tileAtlasState.tileSourceSize,
        tileAtlasState.columns,
        tileAtlasState.rows,
        undefined,
        tileAtlasState.tileSourceHeight,
      );
      if (!dataUrl) {
        continue;
      }
      previewByTileId.set(tileId, dataUrl);
    }
    return previewByTileId;
  }, [
    tileAtlasImage,
    tileAtlasState.columns,
    tileAtlasState.loaded,
    tileAtlasState.rows,
    tileAtlasState.tileCount,
    tileAtlasState.tileSourceSize,
    tileAtlasState.tileSourceHeight,
  ]);

  const tilePreviewDataUrlById = useMemo(() => {
    if (!clientOptions.uiTileBackgroundRemoval) {
      return tilePreviewDataUrlByIdRaw;
    }
    const previewByTileId = new Map<number, string>();
    if (
      !tileAtlasState.loaded ||
      !tileAtlasImage ||
      tileAtlasState.tileCount <= 0
    ) {
      return previewByTileId;
    }
    const tilePreviewBackgroundRemoval = {
      enabled: clientOptions.tilesetBackgroundRemovalMode !== "none",
      mode: clientOptions.tilesetBackgroundRemovalMode,
      applySolidChromaKeyAfterTile:
        isNh3dTilesetCombinedBackgroundRemovalForced(
          clientOptions.tilesetPath,
        ),
      solidChromaKeyColorHex: clientOptions.tilesetSolidChromaKeyColorHex,
      backgroundTilePixels:
        clientOptions.tilesetBackgroundRemovalMode === "tile"
          ? getAtlasTilePixels(
            tileAtlasImage,
            tileAtlasState.tileSourceSize,
            clientOptions.tilesetBackgroundTileId,
            tileAtlasState.columns,
            tileAtlasState.rows,
            tileAtlasState.tileSourceHeight,
          )
          : null,
    };
    for (let tileId = 0; tileId < tileAtlasState.tileCount; tileId += 1) {
      const dataUrl = createIsolatedAtlasTilePreviewDataUrl(
        tileAtlasImage,
        tileId,
        tileAtlasState.tileSourceSize,
        tileAtlasState.columns,
        tileAtlasState.rows,
        tilePreviewBackgroundRemoval,
        tileAtlasState.tileSourceHeight,
      );
      if (!dataUrl) {
        continue;
      }
      previewByTileId.set(tileId, dataUrl);
    }
    return previewByTileId;
  }, [
    clientOptions.tilesetBackgroundRemovalMode,
    clientOptions.tilesetBackgroundTileId,
    clientOptions.tilesetSolidChromaKeyColorHex,
    clientOptions.tilesetPath,
    clientOptions.uiTileBackgroundRemoval,
    tileAtlasImage,
    tileAtlasState.columns,
    tileAtlasState.loaded,
    tileAtlasState.rows,
    tileAtlasState.tileCount,
    tileAtlasState.tileSourceSize,
    tileAtlasState.tileSourceHeight,
    tilePreviewDataUrlByIdRaw,
  ]);

  const getTilePreviewDataUrlForOptions = (tileId: number): string | null => {
    if (tileAtlasState.tileCount <= 0) {
      return null;
    }
    const clampedTileId = Math.max(
      0,
      Math.min(tileAtlasState.tileCount - 1, Math.trunc(tileId)),
    );
    return tilePreviewDataUrlByIdRaw.get(clampedTileId) ?? null;
  };

  const renderTilePreviewImageForOptions = (
    tileId: number,
  ): JSX.Element | null => {
    const tilePreviewDataUrl = getTilePreviewDataUrlForOptions(tileId);
    if (!tilePreviewDataUrl) {
      return null;
    }
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={tilePreviewDataUrl}
      />
    );
  };

  const getTilePreviewDataUrl = (tileId: number): string | null => {
    if (tileAtlasState.tileCount <= 0) {
      return null;
    }
    const clampedTileId = Math.max(
      0,
      Math.min(tileAtlasState.tileCount - 1, Math.trunc(tileId)),
    );
    return tilePreviewDataUrlById.get(clampedTileId) ?? null;
  };

  const getRuntimeTilePreviewDataUrl = (tileId: number): string | null => {
    if (tileAtlasState.tileCount <= 0) {
      return null;
    }
    const remappedTileId = resolvePreviewAtlasTileIdForRuntime(
      activeRuntimeVersion,
      tileId,
      tileAtlasState.tileCount,
    );
    const clampedTileId = Math.max(
      0,
      Math.min(tileAtlasState.tileCount - 1, Math.trunc(remappedTileId)),
    );
    return tilePreviewDataUrlById.get(clampedTileId) ?? null;
  };

  const getTilePreviewDataUrlForRuntimeVersion = (
    runtimeVersion: NethackRuntimeVersion,
    tileId: number,
  ): string | null => {
    if (tileAtlasState.tileCount <= 0) {
      return null;
    }
    const remappedTileId = resolvePreviewAtlasTileIdForRuntime(
      runtimeVersion,
      tileId,
      tileAtlasState.tileCount,
    );
    const clampedTileId = Math.max(
      0,
      Math.min(tileAtlasState.tileCount - 1, Math.trunc(remappedTileId)),
    );
    return tilePreviewDataUrlById.get(clampedTileId) ?? null;
  };

  const renderTilePreviewImageFromDataUrl = (
    tilePreviewDataUrl: string,
  ): JSX.Element | null => {
    if (!tilePreviewDataUrl) {
      return null;
    }
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={tilePreviewDataUrl}
      />
    );
  };

  const renderTilePreviewImage = (tileId: number): JSX.Element | null => {
    const tilePreviewDataUrl = getTilePreviewDataUrl(tileId);
    if (!tilePreviewDataUrl) {
      return null;
    }
    return renderTilePreviewImageFromDataUrl(tilePreviewDataUrl);
  };

  const renderTopScoreInventoryPreview = (
    item: TopScoreInventoryItem,
    runtimeVersion: NethackRuntimeVersion,
  ): JSX.Element => {
    const tilePreviewDataUrl =
      typeof item.tileIndex === "number" && Number.isFinite(item.tileIndex)
        ? getTilePreviewDataUrlForRuntimeVersion(runtimeVersion, item.tileIndex)
        : null;
    return (
      <span className="nh3d-top-score-inventory-icon-shell">
        {tilePreviewDataUrl ? (
          <span className="nh3d-top-score-inventory-icon-art">
            {renderTilePreviewImageFromDataUrl(tilePreviewDataUrl)}
          </span>
        ) : (
          <span className="nh3d-top-score-inventory-icon-fallback">
            {resolveTopScoreInventoryFallbackGlyph(item)}
          </span>
        )}
      </span>
    );
  };

  const renderMenuItemTilePreview = (
    item: NethackMenuItem | null | undefined,
    tileId: number | null,
  ): JSX.Element | null => {
    const dataUrl = resolveMenuItemTilePreviewDataUrl(item);
    if (dataUrl) {
      return renderTilePreviewImageFromDataUrl(dataUrl);
    }
    if (tileId === null) {
      return null;
    }
    const tilePreviewDataUrl = getRuntimeTilePreviewDataUrl(tileId);
    if (!tilePreviewDataUrl) {
      return null;
    }
    return renderTilePreviewImageFromDataUrl(tilePreviewDataUrl);
  };
  return {
    tilePickerEntries,
    tilePickerStatusText,
    renderTilePreviewImageForOptions,
    renderTopScoreInventoryPreview,
    renderMenuItemTilePreview,
  } as const;
}
