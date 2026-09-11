import {
  useEffect
} from "react";
import type { Nh3dClientOptions, TilesetBackgroundRemovalMode as ImportedTilesetBackgroundRemovalMode } from "../../../game/ui-types";
import {
  isNh3dTilesetPathAvailable,
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import type * as React from "react";
import type {
  TilesetBackgroundRemovalMode
} from "./types";

export interface UseTilesetPickerVisibilityDependencies {
  readonly clientOptionsDraft: Nh3dClientOptions;
  readonly setIsDarkWallTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isVultureTilesetSelected: boolean;
  readonly selectedTilesetEntry: Nh3dTilesetEntry | null;
  readonly setIsTilesetBackgroundTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsTilesetSolidColorPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsTilesetManagerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isTilesetManagerVisible: boolean;
  readonly selectedTilesetManagerEditPath: string;
  readonly tilesetManagerBackgroundRemovalMode: ImportedTilesetBackgroundRemovalMode;
  readonly tilesetManagerMode: "edit" | "new";
  readonly tilesetCatalog: readonly Nh3dTilesetEntry[];
  readonly openTilesetManagerEditor: (rawTilesetPath: string) => void;
  readonly openTilesetManagerNewEditor: () => void;
}

/** Closes unavailable tile pickers and selects a valid tileset editor entry. */
export function useTilesetPickerVisibility(dependencies: UseTilesetPickerVisibilityDependencies) {
  const {
    clientOptionsDraft,
    setIsDarkWallTilePickerVisible,
    isVultureTilesetSelected,
    selectedTilesetEntry,
    setIsTilesetBackgroundTilePickerVisible,
    setIsTilesetSolidColorPickerVisible,
    setIsTilesetManagerVisible,
    isTilesetManagerVisible,
    selectedTilesetManagerEditPath,
    tilesetManagerBackgroundRemovalMode,
    tilesetManagerMode,
    tilesetCatalog,
    openTilesetManagerEditor,
    openTilesetManagerNewEditor,
  } = dependencies;

  useEffect(() => {
    if (!clientOptionsDraft.darkCorridorWallTileOverrideEnabled) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [clientOptionsDraft.darkCorridorWallTileOverrideEnabled]);

  useEffect(() => {
    if (
      !clientOptionsDraft.darkCorridorWalls367 &&
      !clientOptionsDraft.overrideNh5DarkCorridorWallTiles
    ) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [
    clientOptionsDraft.darkCorridorWalls367,
    clientOptionsDraft.overrideNh5DarkCorridorWallTiles,
  ]);

  useEffect(() => {
    if (isVultureTilesetSelected) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [isVultureTilesetSelected]);

  useEffect(() => {
    if (clientOptionsDraft.tilesetMode !== "tiles" || !selectedTilesetEntry) {
      setIsTilesetBackgroundTilePickerVisible(false);
      setIsTilesetSolidColorPickerVisible(false);
      setIsTilesetManagerVisible(false);
    }
  }, [clientOptionsDraft.tilesetMode, selectedTilesetEntry]);

  useEffect(() => {
    if (!isTilesetManagerVisible || !selectedTilesetManagerEditPath) {
      setIsTilesetBackgroundTilePickerVisible(false);
      setIsTilesetSolidColorPickerVisible(false);
      return;
    }
    if (tilesetManagerBackgroundRemovalMode !== "tile") {
      setIsTilesetBackgroundTilePickerVisible(false);
    }
    if (tilesetManagerBackgroundRemovalMode !== "solid") {
      setIsTilesetSolidColorPickerVisible(false);
    }
  }, [
    isTilesetManagerVisible,
    selectedTilesetManagerEditPath,
    tilesetManagerBackgroundRemovalMode,
  ]);

  useEffect(() => {
    if (!isTilesetManagerVisible || tilesetManagerMode !== "edit") {
      return;
    }
    const hasActiveEditTileset =
      selectedTilesetManagerEditPath &&
      isNh3dTilesetPathAvailable(selectedTilesetManagerEditPath);
    if (hasActiveEditTileset) {
      return;
    }
    const activeTilesetPath = String(
      clientOptionsDraft.tilesetPath || "",
    ).trim();
    const fallbackTilesetPath = tilesetCatalog[0]?.path ?? "";
    const nextEditPath =
      (activeTilesetPath && isNh3dTilesetPathAvailable(activeTilesetPath)
        ? activeTilesetPath
        : "") || fallbackTilesetPath;
    if (nextEditPath) {
      openTilesetManagerEditor(nextEditPath);
      return;
    }
    openTilesetManagerNewEditor();
  }, [
    clientOptionsDraft.tilesetPath,
    isTilesetManagerVisible,
    selectedTilesetManagerEditPath,
    tilesetManagerMode,
    tilesetCatalog,
  ]);

}
