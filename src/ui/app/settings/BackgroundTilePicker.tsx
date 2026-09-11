import {
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
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

export interface BackgroundTilePickerProps {
  tilesetManagerDefaultBackgroundTileId: number;
  tilesetManagerTilePickerEntries: TilePickerEntry[];
  setIsTilesetBackgroundTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  updateTilesetBackgroundTileIdDraft: (rawTileId: number, rawTilesetPath?: string | undefined, tileCountHint?: number | undefined) => void;
  selectedTilesetManagerEditPath: string;
  tilesetManagerAtlasState: TileAtlasState;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  renderTilesetManagerTilePreviewImage: (tileId: number) => JSX.Element | null;
  tilesetManagerBackgroundGlyphLabel: string;
  tilesetManagerBackgroundGlyphNumber: number | null;
  tilesetManagerBackgroundTileId: number;
  showTilePickerGlyphNumber: boolean;
  tilesetManagerTilePickerStatusText: string;
  selectedTilesetManagerEditEntry: Nh3dTilesetEntry | null;
  isClientOptionsVisible: boolean;
  isTilesetManagerVisible: boolean;
  isTilesetBackgroundTilePickerVisible: boolean;
}

export function BackgroundTilePicker({
  tilesetManagerDefaultBackgroundTileId,
  tilesetManagerTilePickerEntries,
  setIsTilesetBackgroundTilePickerVisible,
  updateTilesetBackgroundTileIdDraft,
  selectedTilesetManagerEditPath,
  tilesetManagerAtlasState,
  renderMobileDialogCloseButton,
  renderTilesetManagerTilePreviewImage,
  tilesetManagerBackgroundGlyphLabel,
  tilesetManagerBackgroundGlyphNumber,
  tilesetManagerBackgroundTileId,
  showTilePickerGlyphNumber,
  tilesetManagerTilePickerStatusText,
  selectedTilesetManagerEditEntry,
  isClientOptionsVisible,
  isTilesetManagerVisible,
  isTilesetBackgroundTilePickerVisible,
}: BackgroundTilePickerProps) {
  return (
    <TilesetTilePickerDialog
      closeLabel={t.tilePicker.closeBackground}
      defaultTileId={tilesetManagerDefaultBackgroundTileId}
      dialogId="nh3d-tileset-background-tile-picker-dialog"
      entries={tilesetManagerTilePickerEntries}
      helperText={t.tilePicker.backgroundHelper}
      onDone={() => setIsTilesetBackgroundTilePickerVisible(false)}
      onResetToDefault={() =>
        updateTilesetBackgroundTileIdDraft(
          tilesetManagerDefaultBackgroundTileId,
          selectedTilesetManagerEditPath,
          tilesetManagerAtlasState.tileCount,
        )
      }
      onSelectTile={(tileId) =>
        updateTilesetBackgroundTileIdDraft(
          tileId,
          selectedTilesetManagerEditPath,
          tilesetManagerAtlasState.tileCount,
        )
      }
      renderMobileCloseButton={renderMobileDialogCloseButton}
      renderTilePreviewImage={renderTilesetManagerTilePreviewImage}
      selectedGlyphLabel={tilesetManagerBackgroundGlyphLabel}
      selectedGlyphNumber={tilesetManagerBackgroundGlyphNumber}
      selectedTileId={tilesetManagerBackgroundTileId}
      showGlyphNumber={showTilePickerGlyphNumber}
      statusText={tilesetManagerTilePickerStatusText}
      tileAtlasLoaded={tilesetManagerAtlasState.loaded}
      title={
        selectedTilesetManagerEditEntry
          ? t.tilePicker.backgroundTitleWithLabel(
            selectedTilesetManagerEditEntry.label,
          )
          : t.tilePicker.backgroundTitle
      }
      visible={
        isClientOptionsVisible &&
        isTilesetManagerVisible &&
        Boolean(selectedTilesetManagerEditPath) &&
        isTilesetBackgroundTilePickerVisible
      }
    />
  );
}
