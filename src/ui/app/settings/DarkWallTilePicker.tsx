import type * as React from "react";
import type {
  TileAtlasState,
  TilePickerEntry
} from "../tilesets/atlas";
import {
  TilesetTilePickerDialog
} from "../tilesets/TilesetTilePickerDialog";
import {
  t
} from "../shared/translations";

export interface DarkWallTilePickerProps {
  defaultDarkWallTileId: number;
  tilePickerEntries: TilePickerEntry[];
  setIsDarkWallTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  updateDarkWallTileOverrideTileIdDraft: (rawTileId: number) => void;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  renderTilePreviewImageForOptions: (tileId: number) => JSX.Element | null;
  selectedDarkWallGlyphLabel: string;
  selectedDarkWallGlyphNumber: number | null;
  selectedDarkWallTileId: number;
  showTilePickerGlyphNumber: boolean;
  tilePickerStatusText: string;
  tileAtlasState: TileAtlasState;
  isClientOptionsVisible: boolean;
  isDarkWallTilePickerVisible: boolean;
}

export function DarkWallTilePicker({
  defaultDarkWallTileId,
  tilePickerEntries,
  setIsDarkWallTilePickerVisible,
  updateDarkWallTileOverrideTileIdDraft,
  renderMobileDialogCloseButton,
  renderTilePreviewImageForOptions,
  selectedDarkWallGlyphLabel,
  selectedDarkWallGlyphNumber,
  selectedDarkWallTileId,
  showTilePickerGlyphNumber,
  tilePickerStatusText,
  tileAtlasState,
  isClientOptionsVisible,
  isDarkWallTilePickerVisible,
}: DarkWallTilePickerProps) {
  return (
    <TilesetTilePickerDialog
      closeLabel={t.tilePicker.closeDarkWall}
      defaultTileId={defaultDarkWallTileId}
      dialogId="nh3d-dark-wall-tile-picker-dialog"
      entries={tilePickerEntries}
      onDone={() => setIsDarkWallTilePickerVisible(false)}
      onResetToDefault={() =>
        updateDarkWallTileOverrideTileIdDraft(defaultDarkWallTileId)
      }
      onSelectTile={updateDarkWallTileOverrideTileIdDraft}
      renderMobileCloseButton={renderMobileDialogCloseButton}
      renderTilePreviewImage={renderTilePreviewImageForOptions}
      selectedGlyphLabel={selectedDarkWallGlyphLabel}
      selectedGlyphNumber={selectedDarkWallGlyphNumber}
      selectedTileId={selectedDarkWallTileId}
      showGlyphNumber={showTilePickerGlyphNumber}
      statusText={tilePickerStatusText}
      tileAtlasLoaded={tileAtlasState.loaded}
      title={t.tilePicker.darkWallTitle}
      visible={isClientOptionsVisible && isDarkWallTilePickerVisible}
    />
  );
}
