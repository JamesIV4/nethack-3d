import type {
  TilePickerEntry
} from "./atlas";
import {
  commonStrings,
  t
} from "../shared/translations";

/** Tile selection dialog with stable component identity. */
export type TilesetTilePickerDialogProps = {
  visible: boolean;
  dialogId: string;
  title: string;
  helperText?: string;
  closeLabel: string;
  selectedTileId: number;
  defaultTileId: number;
  selectedGlyphLabel: string;
  selectedGlyphNumber: number | null;
  showGlyphNumber: boolean;
  statusText: string;
  tileAtlasLoaded: boolean;
  entries: TilePickerEntry[];
  renderTilePreviewImage: (tileId: number) => JSX.Element | null;
  onSelectTile: (tileId: number) => void;
  onResetToDefault: () => void;
  onDone: () => void;
  renderMobileCloseButton: (
    onClick: () => void,
    label: string,
  ) => JSX.Element | null;
};

export function TilesetTilePickerDialog({
  visible,
  dialogId,
  title,
  helperText,
  closeLabel,
  selectedTileId,
  defaultTileId,
  selectedGlyphLabel,
  selectedGlyphNumber,
  showGlyphNumber,
  statusText,
  tileAtlasLoaded,
  entries,
  renderTilePreviewImage,
  onSelectTile,
  onResetToDefault,
  onDone,
  renderMobileCloseButton,
}: TilesetTilePickerDialogProps): JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible nh3d-dialog-tile-picker"
      id={dialogId}
    >
      {renderMobileCloseButton(onDone, closeLabel)}
      <div className="nh3d-options-title">{title}</div>
      {helperText ? (
        <div className="nh3d-option-description">{helperText}</div>
      ) : null}
      <div className="nh3d-dark-wall-picker-selected">
        <span className="nh3d-dark-wall-picker-selected-preview">
          {renderTilePreviewImage(selectedTileId)}
        </span>
        <div className="nh3d-dark-wall-picker-selected-copy">
          <div className="nh3d-option-label">
            {t.tilePicker.selectedTile(selectedTileId)}
            {selectedTileId === defaultTileId ? t.soundPack.defaultSuffix : ""}
          </div>
          <div className="nh3d-option-description">
            {t.tilePicker.glyph(selectedGlyphLabel)}
            {showGlyphNumber && typeof selectedGlyphNumber === "number"
              ? ` (${selectedGlyphNumber})`
              : ""}
          </div>
        </div>
      </div>
      {!tileAtlasLoaded ? (
        <div className="nh3d-dark-wall-picker-status">{statusText}</div>
      ) : (
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-dark-wall-tile-grid"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            {entries.map((entry) => {
              const isSelected = entry.tileId === selectedTileId;
              const isDefault = entry.tileId === defaultTileId;
              return (
                <button
                  className={`nh3d-dark-wall-tile-card${isSelected ? " is-selected" : ""
                    }${isDefault ? " is-default" : ""}`}
                  key={entry.tileId}
                  onClick={() => onSelectTile(entry.tileId)}
                  type="button"
                >
                  <span className="nh3d-dark-wall-tile-card-preview">
                    {renderTilePreviewImage(entry.tileId)}
                  </span>
                  <span className="nh3d-dark-wall-tile-card-glyph">
                    {t.tilePicker.glyph(entry.glyphLabel)}
                    {showGlyphNumber && typeof entry.glyphNumber === "number"
                      ? ` (${entry.glyphNumber})`
                      : ""}
                  </span>
                  <span className="nh3d-dark-wall-tile-card-id">
                    {t.tilePicker.tile(entry.tileId)}
                  </span>
                  {isDefault ? (
                    <span className="nh3d-dark-wall-tile-card-default">
                      {t.tilePicker.defaultBadge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button"
          disabled={selectedTileId === defaultTileId}
          onClick={onResetToDefault}
          type="button"
        >
          {t.tilePicker.resetToDefault}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={onDone}
          type="button"
        >
          {commonStrings.done}
        </button>
      </div>
    </div>
  );
}
