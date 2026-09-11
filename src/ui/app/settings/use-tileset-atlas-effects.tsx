import {
  useEffect
} from "react";
import type {
  CharacterCreationConfig
} from "../../../game/ui-types";
import {
  getNh3dTilesetAtlasTileColumns,
  inferNh3dTilesetTileSizeFromAtlasWidthForPath,
  resolveNh3dTilesetAssetUrl,
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import type * as React from "react";
import type {
  TileAtlasState
} from "../tilesets/atlas";
import {
  createDefaultTileAtlasState
} from "../tilesets/atlas";

export interface UseTilesetAtlasEffectsDependencies {
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly selectedTilesetEntry: Nh3dTilesetEntry | null;
  readonly setTileAtlasState: React.Dispatch<React.SetStateAction<TileAtlasState>>;
  readonly setTileAtlasImage: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>;
  readonly isTilesetManagerVisible: boolean;
  readonly selectedTilesetManagerEditEntry: Nh3dTilesetEntry | null;
  readonly setTilesetManagerAtlasState: React.Dispatch<React.SetStateAction<TileAtlasState>>;
  readonly setTilesetManagerAtlasImage: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>;
  readonly tileAtlasState: TileAtlasState;
  readonly tileAtlasImage: HTMLImageElement | null;
}

/** Loads and disposes the selected and editor tileset atlas images. */
export function useTilesetAtlasEffects(dependencies: UseTilesetAtlasEffectsDependencies) {
  const {
    characterCreationConfig,
    selectedTilesetEntry,
    setTileAtlasState,
    setTileAtlasImage,
    isTilesetManagerVisible,
    selectedTilesetManagerEditEntry,
    setTilesetManagerAtlasState,
    setTilesetManagerAtlasImage,
    tileAtlasState,
    tileAtlasImage,
  } = dependencies;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (characterCreationConfig === null || !selectedTilesetEntry) {
      setTileAtlasState(createDefaultTileAtlasState());
      setTileAtlasImage(null);
      return;
    }
    let disposed = false;
    const atlasImage = new window.Image();
    const tilesetAssetUrl =
      resolveNh3dTilesetAssetUrl(selectedTilesetEntry.path) ??
      selectedTilesetEntry.path;

    const handleLoad = (): void => {
      if (disposed) {
        return;
      }
      const naturalWidth = Math.max(0, Math.trunc(atlasImage.naturalWidth));
      const tileSourceSize = inferNh3dTilesetTileSizeFromAtlasWidthForPath(
        naturalWidth,
        selectedTilesetEntry.path,
      );
      const height = Math.max(0, Math.trunc(atlasImage.naturalHeight));
      const columns = getNh3dTilesetAtlasTileColumns(selectedTilesetEntry.path);
      const rows = Math.max(0, Math.floor(height / tileSourceSize));
      const tileCount = columns > 0 && rows > 0 ? columns * rows : 0;
      setTileAtlasState({
        tilesetPath: selectedTilesetEntry.path,
        loaded: tileCount > 0,
        failed: tileCount <= 0,
        tileSourceSize,
        columns,
        rows,
        tileCount,
      });
      setTileAtlasImage(tileCount > 0 ? atlasImage : null);
    };

    const handleError = (): void => {
      if (disposed) {
        return;
      }
      setTileAtlasState({
        ...createDefaultTileAtlasState(),
        tilesetPath: selectedTilesetEntry.path,
        failed: true,
      });
      setTileAtlasImage(null);
    };

    atlasImage.addEventListener("load", handleLoad);
    atlasImage.addEventListener("error", handleError);
    atlasImage.src = tilesetAssetUrl;

    return () => {
      disposed = true;
      atlasImage.removeEventListener("load", handleLoad);
      atlasImage.removeEventListener("error", handleError);
    };
  }, [characterCreationConfig, selectedTilesetEntry]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isTilesetManagerVisible || !selectedTilesetManagerEditEntry) {
      setTilesetManagerAtlasState(createDefaultTileAtlasState());
      setTilesetManagerAtlasImage(null);
      return;
    }
    if (
      tileAtlasState.loaded &&
      tileAtlasState.tilesetPath === selectedTilesetManagerEditEntry.path &&
      tileAtlasImage
    ) {
      setTilesetManagerAtlasState(tileAtlasState);
      setTilesetManagerAtlasImage(tileAtlasImage);
      return;
    }
    let disposed = false;
    const atlasImage = new window.Image();
    const tilesetAssetUrl =
      resolveNh3dTilesetAssetUrl(selectedTilesetManagerEditEntry.path) ??
      selectedTilesetManagerEditEntry.path;

    const handleLoad = (): void => {
      if (disposed) {
        return;
      }
      const naturalWidth = Math.max(0, Math.trunc(atlasImage.naturalWidth));
      const tileSourceSize = inferNh3dTilesetTileSizeFromAtlasWidthForPath(
        naturalWidth,
        selectedTilesetManagerEditEntry.path,
      );
      const height = Math.max(0, Math.trunc(atlasImage.naturalHeight));
      const columns = getNh3dTilesetAtlasTileColumns(
        selectedTilesetManagerEditEntry.path,
      );
      const rows = Math.max(0, Math.floor(height / tileSourceSize));
      const tileCount = columns > 0 && rows > 0 ? columns * rows : 0;
      setTilesetManagerAtlasState({
        tilesetPath: selectedTilesetManagerEditEntry.path,
        loaded: tileCount > 0,
        failed: tileCount <= 0,
        tileSourceSize,
        columns,
        rows,
        tileCount,
      });
      setTilesetManagerAtlasImage(tileCount > 0 ? atlasImage : null);
    };

    const handleError = (): void => {
      if (disposed) {
        return;
      }
      setTilesetManagerAtlasState({
        ...createDefaultTileAtlasState(),
        tilesetPath: selectedTilesetManagerEditEntry.path,
        failed: true,
      });
      setTilesetManagerAtlasImage(null);
    };

    atlasImage.addEventListener("load", handleLoad);
    atlasImage.addEventListener("error", handleError);
    atlasImage.src = tilesetAssetUrl;

    return () => {
      disposed = true;
      atlasImage.removeEventListener("load", handleLoad);
      atlasImage.removeEventListener("error", handleError);
    };
  }, [
    isTilesetManagerVisible,
    selectedTilesetManagerEditEntry,
    tileAtlasImage,
    tileAtlasState,
  ]);

}
