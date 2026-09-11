import {
  useMemo
} from "react";
import {
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import type {
  TileAtlasState,
  TilePickerEntry
} from "./atlas";
import {
  createIsolatedAtlasTilePreviewDataUrl,
  formatTileGlyphLabel
} from "./atlas";
import {
  t
} from "../shared/translations";

export interface UseTilesetManagerPreviewsDependencies {
  readonly tilesetManagerAtlasState: TileAtlasState;
  readonly representativeGlyphByTileId: Map<number, string>;
  readonly representativeGlyphNumberByTileId: Map<number, number>;
  readonly selectedTilesetManagerEditEntry: Nh3dTilesetEntry | null;
  readonly tilesetManagerAtlasImage: HTMLImageElement | null;
}

/** Builds atlas entries and preview images for the tileset editor. */
export function useTilesetManagerPreviews(dependencies: UseTilesetManagerPreviewsDependencies) {
  const {
    tilesetManagerAtlasState,
    representativeGlyphByTileId,
    representativeGlyphNumberByTileId,
    selectedTilesetManagerEditEntry,
    tilesetManagerAtlasImage,
  } = dependencies;

  const tilesetManagerTilePickerEntries = useMemo<TilePickerEntry[]>(() => {
    if (
      !tilesetManagerAtlasState.loaded ||
      tilesetManagerAtlasState.tileCount <= 0
    ) {
      return [];
    }
    const entries: TilePickerEntry[] = [];
    for (
      let tileId = 0;
      tileId < tilesetManagerAtlasState.tileCount;
      tileId += 1
    ) {
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
    tilesetManagerAtlasState.loaded,
    tilesetManagerAtlasState.tileCount,
  ]);

  const tilesetManagerTilePickerStatusText = !selectedTilesetManagerEditEntry
    ? t.tilePicker.noAtlasAvailable
    : tilesetManagerAtlasState.failed
      ? t.tilePicker.unableToLoadAtlas
      : tilesetManagerAtlasState.loaded
        ? t.tilePicker.atlasLoaded
        : t.tilePicker.loadingAtlas;

  const tilesetManagerTilePreviewDataUrlById = useMemo(() => {
    const previewByTileId = new Map<number, string>();
    if (
      !tilesetManagerAtlasState.loaded ||
      !tilesetManagerAtlasImage ||
      tilesetManagerAtlasState.tileCount <= 0
    ) {
      return previewByTileId;
    }
    for (
      let tileId = 0;
      tileId < tilesetManagerAtlasState.tileCount;
      tileId += 1
    ) {
      const dataUrl = createIsolatedAtlasTilePreviewDataUrl(
        tilesetManagerAtlasImage,
        tileId,
        tilesetManagerAtlasState.tileSourceSize,
        tilesetManagerAtlasState.columns,
        tilesetManagerAtlasState.rows,
      );
      if (!dataUrl) {
        continue;
      }
      previewByTileId.set(tileId, dataUrl);
    }
    return previewByTileId;
  }, [
    tilesetManagerAtlasImage,
    tilesetManagerAtlasState.columns,
    tilesetManagerAtlasState.loaded,
    tilesetManagerAtlasState.rows,
    tilesetManagerAtlasState.tileCount,
    tilesetManagerAtlasState.tileSourceSize,
  ]);

  const getTilesetManagerTilePreviewDataUrl = (
    tileId: number,
  ): string | null => {
    if (tilesetManagerAtlasState.tileCount <= 0) {
      return null;
    }
    const clampedTileId = Math.max(
      0,
      Math.min(tilesetManagerAtlasState.tileCount - 1, Math.trunc(tileId)),
    );
    return tilesetManagerTilePreviewDataUrlById.get(clampedTileId) ?? null;
  };

  const renderTilesetManagerTilePreviewImage = (
    tileId: number,
  ): JSX.Element | null => {
    const tilePreviewDataUrl = getTilesetManagerTilePreviewDataUrl(tileId);
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
  return {
    tilesetManagerTilePickerEntries,
    tilesetManagerTilePickerStatusText,
    renderTilesetManagerTilePreviewImage,
  } as const;
}
