import {
  useState
} from "react";

/** Owns tileset manager and tile-picker visibility. */
export function useTilesetDialogState() {
  const [isDarkWallTilePickerVisible, setIsDarkWallTilePickerVisible] =
    useState(false);

  const [
    isTilesetBackgroundTilePickerVisible,
    setIsTilesetBackgroundTilePickerVisible,
  ] = useState(false);

  const [
    isTilesetSolidColorPickerVisible,
    setIsTilesetSolidColorPickerVisible,
  ] = useState(false);

  const [isTilesetManagerVisible, setIsTilesetManagerVisible] = useState(false);
  return {
    isDarkWallTilePickerVisible,
    setIsDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    setIsTilesetBackgroundTilePickerVisible,
    isTilesetSolidColorPickerVisible,
    setIsTilesetSolidColorPickerVisible,
    isTilesetManagerVisible,
    setIsTilesetManagerVisible,
  } as const;
}
