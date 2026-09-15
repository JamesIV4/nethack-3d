import {
  Fragment,
  type ChangeEvent
} from "react";
import type { Nh3dClientOptions, TilesetBackgroundRemovalMode as ImportedTilesetBackgroundRemovalMode } from "../../../game/ui-types";
import {
  isNh3dTilesetBackgroundRemovalModeForcedOff,
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import {
  type StoredUserTilesetRecord,
  type StoredUserTilesetTileLayoutVersion
} from "../../../game/user-tileset-storage";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  TilesetBackgroundRemovalMode
} from "./types";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  formatSolidChromaKeyHex,
  normalizeSolidChromaKeyHex
} from "../tilesets/TilesetSolidColorPickerDialog";
import {
  resolveTilesetLayoutDisplayLabel,
  resolveTilesetLayoutShortLabel
} from "../tilesets/labels";

export interface TilesetManagerDialogProps {
  isClientOptionsVisible: boolean;
  isTilesetManagerVisible: boolean;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  closeTilesetManager: () => void;
  tilesetManagerInNewMode: boolean;
  selectedTilesetManagerEditEntry: Nh3dTilesetEntry | null;
  setTilesetManagerName: React.Dispatch<React.SetStateAction<string>>;
  tilesetManagerNameInputDisabled: boolean;
  tilesetManagerName: string;
  selectedTilesetManagerEditUserRecord: StoredUserTilesetRecord | null;
  setTilesetManagerTileLayoutVersion: React.Dispatch<React.SetStateAction<StoredUserTilesetTileLayoutVersion>>;
  tilesetManagerTileLayoutVersion: StoredUserTilesetTileLayoutVersion;
  tilesetManagerTileHeight: string;
  setTilesetManagerTileHeight: React.Dispatch<React.SetStateAction<string>>;
  tilesetManagerTileDimensions: { tileWidth: number; tileHeight: number } | null;
  handleTilesetManagerFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  tilesetManagerFileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  tilesetManagerFile: File | null;
  tilesetManagerWeaponSpriteFlipX: boolean;
  updateTilesetWeaponSpriteFlipXDraft: (enabled: boolean, rawTilesetPath?: string | undefined) => void;
  selectedTilesetManagerEditPath: string;
  tilesetManagerBackgroundRemovalMode: ImportedTilesetBackgroundRemovalMode;
  tilesetManagerBackgroundRemovalSettingsLocked: boolean;
  setIsTilesetBackgroundTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  renderTilesetManagerTilePreviewImage: (tileId: number) => JSX.Element | null;
  tilesetManagerBackgroundTileId: number;
  tilesetManagerBackgroundGlyphLabel: string;
  updateTilesetBackgroundRemovalModeDraft: (mode: ImportedTilesetBackgroundRemovalMode, rawTilesetPath?: string | undefined) => void;
  setIsTilesetSolidColorPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  tilesetManagerSolidChromaKeyColorHex: string;
  tilesetManagerBusy: boolean;
  saveTilesetManager: () => Promise<void>;
  tilesetManagerError: string;
  openTilesetManagerNewEditor: () => void;
  tilesetManagerListTilesets: Nh3dTilesetEntry[];
  clientOptionsDraft: Nh3dClientOptions;
  userTilesetRecordByPath: Map<string, StoredUserTilesetRecord>;
  openTilesetManagerEditor: (rawTilesetPath: string) => void;
  removeUserTileset: (record: StoredUserTilesetRecord) => Promise<void>;
}

export function TilesetManagerDialog({
  isClientOptionsVisible,
  isTilesetManagerVisible,
  renderMobileDialogCloseButton,
  closeTilesetManager,
  tilesetManagerInNewMode,
  selectedTilesetManagerEditEntry,
  setTilesetManagerName,
  tilesetManagerNameInputDisabled,
  tilesetManagerName,
  selectedTilesetManagerEditUserRecord,
  setTilesetManagerTileLayoutVersion,
  tilesetManagerTileLayoutVersion,
  tilesetManagerTileHeight,
  setTilesetManagerTileHeight,
  tilesetManagerTileDimensions,
  handleTilesetManagerFileChange,
  tilesetManagerFileInputRef,
  tilesetManagerFile,
  tilesetManagerWeaponSpriteFlipX,
  updateTilesetWeaponSpriteFlipXDraft,
  selectedTilesetManagerEditPath,
  tilesetManagerBackgroundRemovalMode,
  tilesetManagerBackgroundRemovalSettingsLocked,
  setIsTilesetBackgroundTilePickerVisible,
  renderTilesetManagerTilePreviewImage,
  tilesetManagerBackgroundTileId,
  tilesetManagerBackgroundGlyphLabel,
  updateTilesetBackgroundRemovalModeDraft,
  setIsTilesetSolidColorPickerVisible,
  tilesetManagerSolidChromaKeyColorHex,
  tilesetManagerBusy,
  saveTilesetManager,
  tilesetManagerError,
  openTilesetManagerNewEditor,
  tilesetManagerListTilesets,
  clientOptionsDraft,
  userTilesetRecordByPath,
  openTilesetManagerEditor,
  removeUserTileset,
}: TilesetManagerDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-tileset-manager"
      open={isClientOptionsVisible && isTilesetManagerVisible}
      id="nh3d-tileset-manager-dialog"
    >
      {renderMobileDialogCloseButton(
        closeTilesetManager,
        t.dialogs.tilesetManager.closeLabel,
      )}
      <div className="nh3d-options-title">
        {t.dialogs.tilesetManager.title}
      </div>
      <div className="nh3d-option-description">
        {t.dialogs.tilesetManager.description}
      </div>
      <div className="nh3d-tileset-manager-content-shell">
        <div className="nh3d-tileset-manager-content">
          <div className="nh3d-overflow-glow-frame nh3d-tileset-manager-editor-shell">
            <div
              className="nh3d-tileset-manager-upload"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
              <div className="nh3d-tileset-manager-header">
                <div className="nh3d-option-label">
                  {tilesetManagerInNewMode
                    ? t.dialogs.tilesetManager.createTitle
                    : selectedTilesetManagerEditEntry
                      ? t.dialogs.tilesetManager.editTitleWithName(
                        selectedTilesetManagerEditEntry.label,
                      )
                      : t.dialogs.tilesetManager.editTitle}
                </div>
              </div>
              <div className="nh3d-tileset-manager-upload-row">
                <label
                  className="nh3d-option-label"
                  htmlFor="nh3d-tileset-name"
                >
                  {t.dialogs.tilesetManager.tileSetName}
                </label>
                <input
                  className="nh3d-text-input nh3d-tileset-manager-input"
                  id="nh3d-tileset-name"
                  onChange={(event) =>
                    setTilesetManagerName(event.target.value)
                  }
                  placeholder={t.dialogs.tilesetManager.tileSetPlaceholder}
                  readOnly={tilesetManagerNameInputDisabled}
                  type="text"
                  value={tilesetManagerName}
                />
                {tilesetManagerNameInputDisabled ? (
                  <div className="nh3d-option-description">
                    {t.dialogs.tilesetManager.builtInNamesLocked}
                  </div>
                ) : null}
              </div>
              {tilesetManagerInNewMode ||
                selectedTilesetManagerEditUserRecord ? (
                <div className="nh3d-tileset-manager-upload-row">
                  <label
                    className="nh3d-option-label"
                    htmlFor="nh3d-tileset-version"
                  >
                    {t.dialogs.tilesetManager.tileLayoutVersion}
                  </label>
                  <select
                    className="nh3d-startup-config-select"
                    id="nh3d-tileset-version"
                    onChange={(event) =>
                      setTilesetManagerTileLayoutVersion(
                        event.target.value === "slashem"
                          ? "slashem"
                          : event.target.value === "5.0"
                            ? "5.0"
                            : event.target.value === "3.4.3"
                              ? "3.4.3"
                              : "3.6.7",
                      )
                    }
                    value={tilesetManagerTileLayoutVersion}
                  >
                    <option value="slashem">Slash&apos;EM layout</option>
                    <option value="3.4.3">NetHack 3.4.3 layout</option>
                    <option value="3.6.7">
                      {t.dialogs.tilesetManager.layout367}
                    </option>
                    <option value="5.0">
                      {t.dialogs.tilesetManager.layout5}
                    </option>
                  </select>
                  <div className="nh3d-option-description">
                    {t.dialogs.tilesetManager.tileLayoutDescription}
                  </div>
                </div>
              ) : null}
              {tilesetManagerInNewMode ||
                selectedTilesetManagerEditUserRecord ? (
                <div className="nh3d-tileset-manager-upload-row">
                  <label
                    className="nh3d-option-label"
                    htmlFor="nh3d-tileset-upload-file"
                  >
                    {tilesetManagerInNewMode
                      ? t.dialogs.tilesetManager.tileImage
                      : t.dialogs.tilesetManager.tileImageOptional}
                  </label>
                  <input
                    accept=".png,.bmp,.gif,.jpg,.jpeg,image/*"
                    className="nh3d-tileset-manager-file-input"
                    id="nh3d-tileset-upload-file"
                    onChange={handleTilesetManagerFileChange}
                    ref={tilesetManagerFileInputRef}
                    type="file"
                  />
                  <div className="nh3d-option-description">
                    {tilesetManagerFile
                      ? t.dialogs.tilesetManager.selectedFile(
                        tilesetManagerFile.name,
                      )
                      : tilesetManagerInNewMode
                        ? t.tilesets.chooseFile
                        : t.dialogs.tilesetManager.currentFile(
                          selectedTilesetManagerEditUserRecord?.fileName ||
                          t.dialogs.tilesetManager.uploadedImage,
                        )}
                  </div>
                </div>
              ) : null}
              {tilesetManagerInNewMode || selectedTilesetManagerEditUserRecord ? (
                <div className="nh3d-tileset-manager-upload-row">
                  <label className="nh3d-option-label" htmlFor="nh3d-tileset-tile-width">
                    {t.dialogs.tilesetManager.tileWidth}
                  </label>
                  <input id="nh3d-tileset-tile-width" className="nh3d-startup-config-input"
                    readOnly value={tilesetManagerTileDimensions?.tileWidth ?? ""} />
                  <label className="nh3d-option-label" htmlFor="nh3d-tileset-tile-height">
                    {t.dialogs.tilesetManager.tileHeight}
                  </label>
                  <input id="nh3d-tileset-tile-height" className="nh3d-startup-config-input"
                    type="number" min={1} step={1} value={tilesetManagerTileHeight}
                    placeholder={tilesetManagerTileDimensions ? String(tilesetManagerTileDimensions.tileHeight) : t.dialogs.tilesetManager.autoTileHeight}
                    onChange={event => setTilesetManagerTileHeight(event.target.value)}
                    aria-describedby="nh3d-tileset-dimensions-description" />
                  <div className="nh3d-option-description" id="nh3d-tileset-dimensions-description">
                    {t.dialogs.tilesetManager.tileDimensionsDescription}
                  </div>
                </div>
              ) : null}
              {selectedTilesetManagerEditEntry ? (
                <Fragment>
                  <div className="nh3d-option-row nh3d-option-row-inline-toggle">
                    <div className="nh3d-option-copy">
                      <div className="nh3d-option-label">
                        {t.dialogs.tilesetManager.weaponSpriteFlip}
                      </div>
                      <div className="nh3d-option-description">
                        {
                          t.dialogs.tilesetManager
                            .weaponSpriteFlipDescription
                        }
                      </div>
                    </div>
                    <button
                      aria-checked={tilesetManagerWeaponSpriteFlipX}
                      className={`nh3d-option-switch nh3d-option-inline-switch${tilesetManagerWeaponSpriteFlipX ? " is-on" : ""
                        }`}
                      onClick={() =>
                        updateTilesetWeaponSpriteFlipXDraft(
                          !tilesetManagerWeaponSpriteFlipX,
                          selectedTilesetManagerEditPath,
                        )
                      }
                      role="switch"
                      type="button"
                    >
                      <span className="nh3d-option-switch-thumb" />
                    </button>
                  </div>
                  <div className="nh3d-option-description">
                    {t.dialogs.tilesetManager.backgroundRemovalDescription}
                  </div>
                  <div
                    className={`nh3d-option-row nh3d-option-row-inline-toggle nh3d-option-row-has-secondary-controls${tilesetManagerBackgroundRemovalMode === "tile"
                      ? ""
                      : " nh3d-option-row-mode-inactive"
                      }`}
                  >
                    <div className="nh3d-option-copy">
                      <div className="nh3d-option-label">
                        {t.dialogs.tilesetManager.backgroundTileRemoval}
                      </div>
                      <div className="nh3d-option-description">
                        {
                          t.dialogs.tilesetManager
                            .backgroundTileRemovalDescription
                        }
                      </div>
                    </div>
                    <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                      <button
                        className={`nh3d-option-tile-picker-button${tilesetManagerBackgroundRemovalMode === "tile"
                          ? ""
                          : " is-disabled"
                          }`}
                        disabled={
                          tilesetManagerBackgroundRemovalMode !== "tile" ||
                          tilesetManagerBackgroundRemovalSettingsLocked
                        }
                        onClick={() =>
                          setIsTilesetBackgroundTilePickerVisible(true)
                        }
                        type="button"
                      >
                        <span className="nh3d-option-tile-picker-preview">
                          {renderTilesetManagerTilePreviewImage(
                            tilesetManagerBackgroundTileId,
                          )}
                        </span>
                        <span className="nh3d-option-tile-picker-copy">
                          <span className="nh3d-option-tile-picker-glyph">
                            {tilesetManagerBackgroundGlyphLabel}
                          </span>
                          <span className="nh3d-option-tile-picker-id">
                            tile #{tilesetManagerBackgroundTileId}
                          </span>
                        </span>
                      </button>
                    </div>
                    <button
                      aria-checked={
                        tilesetManagerBackgroundRemovalMode === "tile"
                      }
                      className={`nh3d-option-switch nh3d-option-inline-switch${tilesetManagerBackgroundRemovalMode === "tile"
                        ? " is-on"
                        : ""
                        }`}
                      disabled={isNh3dTilesetBackgroundRemovalModeForcedOff(
                        selectedTilesetManagerEditPath,
                      ) || tilesetManagerBackgroundRemovalSettingsLocked}
                      onClick={() =>
                        updateTilesetBackgroundRemovalModeDraft(
                          tilesetManagerBackgroundRemovalMode === "tile"
                            ? "none"
                            : "tile",
                          selectedTilesetManagerEditPath,
                        )
                      }
                      role="switch"
                      type="button"
                    >
                      <span className="nh3d-option-switch-thumb" />
                    </button>
                  </div>
                  <div
                    className={`nh3d-option-row nh3d-option-row-inline-toggle nh3d-option-row-has-secondary-controls${tilesetManagerBackgroundRemovalMode === "solid" ||
                      tilesetManagerBackgroundRemovalSettingsLocked
                      ? ""
                      : " nh3d-option-row-mode-inactive"
                      }`}
                  >
                    <div className="nh3d-option-copy">
                      <div className="nh3d-option-label">
                        {t.dialogs.tilesetManager.solidChromaKey}
                      </div>
                      <div className="nh3d-option-description">
                        {t.dialogs.tilesetManager.solidChromaKeyDescription}
                      </div>
                    </div>
                    <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                      <button
                        className={`nh3d-option-tile-picker-button${tilesetManagerBackgroundRemovalMode === "solid" ||
                          tilesetManagerBackgroundRemovalSettingsLocked
                          ? ""
                          : " is-disabled"
                          }`}
                        disabled={
                          tilesetManagerBackgroundRemovalMode !== "solid" ||
                          tilesetManagerBackgroundRemovalSettingsLocked
                        }
                        onClick={() =>
                          setIsTilesetSolidColorPickerVisible(true)
                        }
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="nh3d-option-solid-color-preview"
                          style={{
                            backgroundColor: normalizeSolidChromaKeyHex(
                              tilesetManagerSolidChromaKeyColorHex,
                            ),
                          }}
                        />
                        <span className="nh3d-option-tile-picker-copy">
                          <span className="nh3d-option-tile-picker-glyph">
                            {formatSolidChromaKeyHex(
                              tilesetManagerSolidChromaKeyColorHex,
                            )}
                          </span>
                          <span className="nh3d-option-tile-picker-id">
                            {t.dialogs.tilesetManager.clickToPickFromAtlas}
                          </span>
                        </span>
                      </button>
                      <input
                        className="nh3d-option-solid-color-input"
                        readOnly
                        type="text"
                        value={formatSolidChromaKeyHex(
                          tilesetManagerSolidChromaKeyColorHex,
                        )}
                      />
                    </div>
                    <button
                      aria-checked={
                        tilesetManagerBackgroundRemovalMode === "solid" ||
                        tilesetManagerBackgroundRemovalSettingsLocked
                      }
                      className={`nh3d-option-switch nh3d-option-inline-switch${tilesetManagerBackgroundRemovalMode === "solid" ||
                        tilesetManagerBackgroundRemovalSettingsLocked
                        ? " is-on"
                        : ""
                        }`}
                      disabled={isNh3dTilesetBackgroundRemovalModeForcedOff(
                        selectedTilesetManagerEditPath,
                      ) || tilesetManagerBackgroundRemovalSettingsLocked}
                      onClick={() =>
                        updateTilesetBackgroundRemovalModeDraft(
                          tilesetManagerBackgroundRemovalMode === "solid"
                            ? "none"
                            : "solid",
                          selectedTilesetManagerEditPath,
                        )
                      }
                      role="switch"
                      type="button"
                    >
                      <span className="nh3d-option-switch-thumb" />
                    </button>
                  </div>
                </Fragment>
              ) : (
                <div className="nh3d-option-description">
                  {t.dialogs.tilesetManager.saveFirstThenEdit}
                </div>
              )}
              <div className="nh3d-tileset-manager-upload-actions">
                <button
                  className="nh3d-menu-action-button nh3d-menu-action-confirm"
                  disabled={tilesetManagerBusy}
                  onClick={() => {
                    void saveTilesetManager();
                  }}
                  type="button"
                >
                  {tilesetManagerInNewMode
                    ? t.dialogs.tilesetManager.createTileSet
                    : selectedTilesetManagerEditUserRecord
                      ? t.dialogs.tilesetManager.saveTileSet
                      : t.dialogs.tilesetManager.saveTileSettings}
                </button>
              </div>
            </div>
          </div>
          {tilesetManagerError ? (
            <div className="nh3d-tileset-manager-error">
              {tilesetManagerError}
            </div>
          ) : null}
          <div className="nh3d-tileset-manager-divider" />
          <button
            className="nh3d-menu-action-button"
            disabled={tilesetManagerBusy}
            onClick={openTilesetManagerNewEditor}
            type="button"
          >
            {t.dialogs.tilesetManager.importNewTileSet}
          </button>
          <div className="nh3d-overflow-glow-frame nh3d-tileset-manager-list-shell">
            <div
              className="nh3d-tileset-manager-list"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
              {tilesetManagerListTilesets.length === 0 ? (
                <div className="nh3d-option-description">
                  {t.dialogs.tilesetManager.noUploadedTilesets}
                </div>
              ) : (
                tilesetManagerListTilesets.map((tileset) => {
                  const tilesetPath = String(tileset.path || "").trim();
                  const isSelected =
                    clientOptionsDraft.tilesetPath === tilesetPath;
                  const isEditing =
                    !tilesetManagerInNewMode &&
                    selectedTilesetManagerEditPath === tilesetPath;
                  const userRecord = userTilesetRecordByPath.get(tilesetPath);
                  const isUserTileset = tileset.source === "user";
                  return (
                    <div
                      className="nh3d-tileset-manager-item"
                      key={tilesetPath}
                    >
                      <div className="nh3d-tileset-manager-item-copy">
                        <div className="nh3d-option-label">
                          {tileset.label}
                          {isSelected
                            ? t.dialogs.tilesetManager.selectedSuffix
                            : ""}
                          {isEditing
                            ? t.dialogs.tilesetManager.editingSuffix
                            : ""}
                        </div>
                        <div className="nh3d-option-description">
                          {isUserTileset
                            ? t.dialogs.tilesetManager.uploadedDetails(
                              userRecord?.fileName || tilesetPath,
                              resolveTilesetLayoutShortLabel(
                                tileset.tileLayoutVersion,
                              ),
                            )
                            : t.dialogs.tilesetManager.builtInDetails(
                              resolveTilesetLayoutDisplayLabel(
                                tileset.tileLayoutVersion,
                              ),
                            )}
                        </div>
                      </div>
                      <div className="nh3d-tileset-manager-item-actions">
                        <button
                          className="nh3d-menu-action-button"
                          onClick={() =>
                            openTilesetManagerEditor(tilesetPath)
                          }
                          type="button"
                        >
                          {commonStrings.edit}
                        </button>
                        {isUserTileset ? (
                          <button
                            aria-label={`Delete ${tileset.label}`}
                            className="delete-button"
                            disabled={tilesetManagerBusy || !userRecord}
                            onClick={() => {
                              if (!userRecord) {
                                return;
                              }
                              void removeUserTileset(userRecord);
                            }}
                            type="button"
                          >
                            X
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button"
          onClick={closeTilesetManager}
          type="button"
        >
          {commonStrings.done}
        </button>
      </div>
    </AnimatedDialog>
  );
}
