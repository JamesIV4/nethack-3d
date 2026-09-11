import {
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import type * as React from "react";
import type {
  TileAtlasState
} from "../tilesets/atlas";
import {
  TilesetSolidColorPickerDialog
} from "../tilesets/TilesetSolidColorPickerDialog";
import {
  t
} from "../shared/translations";

export interface BackgroundColorPickerProps {
  tilesetManagerAtlasImage: HTMLImageElement | null;
  tilesetManagerAtlasState: TileAtlasState;
  setIsTilesetSolidColorPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  updateTilesetSolidChromaKeyColorHexDraft: (rawHex: string, rawTilesetPath?: string | undefined) => void;
  selectedTilesetManagerEditPath: string;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  tilesetManagerSolidChromaKeyColorHex: string;
  tilesetManagerTilePickerStatusText: string;
  selectedTilesetManagerEditEntry: Nh3dTilesetEntry | null;
  isClientOptionsVisible: boolean;
  isTilesetManagerVisible: boolean;
  isTilesetSolidColorPickerVisible: boolean;
}

export function BackgroundColorPicker({
  tilesetManagerAtlasImage,
  tilesetManagerAtlasState,
  setIsTilesetSolidColorPickerVisible,
  updateTilesetSolidChromaKeyColorHexDraft,
  selectedTilesetManagerEditPath,
  renderMobileDialogCloseButton,
  tilesetManagerSolidChromaKeyColorHex,
  tilesetManagerTilePickerStatusText,
  selectedTilesetManagerEditEntry,
  isClientOptionsVisible,
  isTilesetManagerVisible,
  isTilesetSolidColorPickerVisible,
}: BackgroundColorPickerProps) {
  return (
    <TilesetSolidColorPickerDialog
      atlasImage={tilesetManagerAtlasImage}
      atlasWidthPx={
        tilesetManagerAtlasState.columns *
        tilesetManagerAtlasState.tileSourceSize
      }
      closeLabel={t.tilePicker.closeSolidColor}
      dialogId="nh3d-tileset-solid-color-picker-dialog"
      onDone={() => setIsTilesetSolidColorPickerVisible(false)}
      onSelectColorHex={(rawHex) =>
        updateTilesetSolidChromaKeyColorHexDraft(
          rawHex,
          selectedTilesetManagerEditPath,
        )
      }
      renderMobileCloseButton={renderMobileDialogCloseButton}
      selectedColorHex={tilesetManagerSolidChromaKeyColorHex}
      statusText={tilesetManagerTilePickerStatusText}
      tileAtlasLoaded={tilesetManagerAtlasState.loaded}
      tileSourceSize={tilesetManagerAtlasState.tileSourceSize}
      title={
        selectedTilesetManagerEditEntry
          ? t.tilePicker.solidColorTitleWithLabel(
            selectedTilesetManagerEditEntry.label,
          )
          : t.tilePicker.solidColorTitle
      }
      visible={
        isClientOptionsVisible &&
        isTilesetManagerVisible &&
        Boolean(selectedTilesetManagerEditPath) &&
        isTilesetSolidColorPickerVisible
      }
    />
  );
}
