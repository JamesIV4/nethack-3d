import { Fragment } from "react";
import { t } from "../shared/translations";
import { OptionLabelWithInfo } from "./OptionLabelWithInfo";
import { normalizeSolidChromaKeyHex } from "../tilesets/TilesetSolidColorPickerDialog";
import type { ClientOptionsDialogProps } from "./ClientOptionsDialog";
import type { ClientOptionToggle } from "./types";

type ClientOptionToggleControlProps = Pick<ClientOptionsDialogProps,
  | "selectedClientOptionsTab"
  | "clientOptionsDraft"
  | "updateClientOptionDraft"
  | "isVultureTilesetSelected"
  | "setIsDarkWallTilePickerVisible"
  | "renderTilePreviewImageForOptions"
  | "selectedDarkWallTileId"
  | "selectedDarkWallGlyphLabel"
  | "updateDarkWallSolidColorHexDraft"
  | "selectedDarkWallSolidColorHex"
  | "updateDarkWallSolidColorHexFpsDraft"
  | "selectedDarkWallSolidColorHexFps"
  | "selectedDarkWallSolidColorGridEnabled"
  | "updateDarkWallSolidColorGridEnabledDraft"
  | "updateDarkWallSolidColorGridDarknessPercentDraft"
  | "selectedDarkWallSolidColorGridDarknessPercent"
  | "updateDarkWallTileOverrideEnabledDraft"
  | "updateDarkWallSolidColorOverrideEnabledDraft"
  | "openControllerRemapDialog"
> & { option: ClientOptionToggle };

export function ClientOptionToggleControl({
  option,
  selectedClientOptionsTab,
  clientOptionsDraft,
  updateClientOptionDraft,
  isVultureTilesetSelected,
  setIsDarkWallTilePickerVisible,
  renderTilePreviewImageForOptions,
  selectedDarkWallTileId,
  selectedDarkWallGlyphLabel,
  updateDarkWallSolidColorHexDraft,
  selectedDarkWallSolidColorHex,
  updateDarkWallSolidColorHexFpsDraft,
  selectedDarkWallSolidColorHexFps,
  selectedDarkWallSolidColorGridEnabled,
  updateDarkWallSolidColorGridEnabledDraft,
  updateDarkWallSolidColorGridDarknessPercentDraft,
  selectedDarkWallSolidColorGridDarknessPercent,
  updateDarkWallTileOverrideEnabledDraft,
  updateDarkWallSolidColorOverrideEnabledDraft,
  openControllerRemapDialog,
}: ClientOptionToggleControlProps): JSX.Element {

  const isInventoryTileOnlyMotionOption =
    option.key === "inventoryTileOnlyMotion";
  const isDarkCorridorWallsOption =
    option.key === "darkCorridorWalls367";
  const isNh5DarkWallOverrideOption =
    option.key === "overrideNh5DarkCorridorWallTiles";
  const isDarkWallTileOverrideOption =
    option.key === "darkCorridorWallTileOverrideEnabled";
  const isDarkWallSolidColorOverrideOption =
    option.key ===
    "darkCorridorWallSolidColorOverrideEnabled";
  const isDarkWallOverrideOption =
    isDarkWallTileOverrideOption ||
    isDarkWallSolidColorOverrideOption;
  const darkCorridorOptionSuppressedByVulture =
    isVultureTilesetSelected &&
    (isDarkCorridorWallsOption ||
      isNh5DarkWallOverrideOption ||
      isDarkWallOverrideOption);
  const darkCorridorWallsForcedOnByVulture =
    isVultureTilesetSelected && isDarkCorridorWallsOption;
  const invertLookOptionDisabledByFpsMode =
    option.key === "invertLookYAxis" &&
    !clientOptionsDraft.fpsMode;
  const fpsModeDisabledByTerminal =
    option.key === "fpsMode" &&
    clientOptionsDraft.tilesetMode === "terminal";
  const animatedMovementDisabledByTerminal =
    option.key === "animatedMovement" &&
    clientOptionsDraft.tilesetMode === "terminal";
  const darkWallOverrideDisabledByDarkCorridorWalls =
    isDarkWallOverrideOption &&
    !clientOptionsDraft.darkCorridorWalls367 &&
    !clientOptionsDraft.overrideNh5DarkCorridorWallTiles;
  const enabled = darkCorridorWallsForcedOnByVulture
    ? true
    : Boolean(clientOptionsDraft[option.key]);
  const toggleDisabled =
    (isInventoryTileOnlyMotionOption &&
      clientOptionsDraft.reduceInventoryMotion) ||
    darkCorridorOptionSuppressedByVulture ||
    darkWallOverrideDisabledByDarkCorridorWalls ||
    invertLookOptionDisabledByFpsMode ||
    fpsModeDisabledByTerminal ||
    animatedMovementDisabledByTerminal;
  const toggleDisabledHint =
    darkCorridorWallsForcedOnByVulture
      ? t.dialogs.clientOptions.hints.darkWallsAlwaysEnabled
      : darkCorridorOptionSuppressedByVulture
        ? t.dialogs.clientOptions.hints
          .darkWallsDisabledByVulture
        : darkWallOverrideDisabledByDarkCorridorWalls
          ? t.dialogs.clientOptions.hints.enableDarkWallsFirst
          : invertLookOptionDisabledByFpsMode
            ? t.dialogs.clientOptions.hints.enableFpsFirst
            : "";
  const darkWallSecondaryControlsDisabled =
    !enabled || toggleDisabled;
  const shouldRenderControllerRemapRow =
    selectedClientOptionsTab.id === "controls" &&
    option.key === "controllerEnabled";
  return (
    <Fragment key={option.key}>
      <div
        className={`nh3d-option-row nh3d-option-row-inline-toggle${isDarkWallOverrideOption
          ? " nh3d-option-row-has-secondary-controls"
          : ""
          }${toggleDisabled
            ? " nh3d-option-row-mode-inactive"
            : ""
          }${isDarkWallOverrideOption && !enabled
            ? " nh3d-option-row-mode-inactive"
            : ""
          }`}
      >
        <div className="nh3d-option-copy">
          <OptionLabelWithInfo
            label={option.label}
            description={`${option.description}${toggleDisabledHint
              ? ` ${toggleDisabledHint}`
              : ""
              }`}
          />
        </div>
        {isDarkWallTileOverrideOption ? (
          <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
            <button
              className={`nh3d-option-tile-picker-button${darkWallSecondaryControlsDisabled
                ? " is-disabled"
                : ""
                }`}
              disabled={darkWallSecondaryControlsDisabled}
              onClick={() =>
                setIsDarkWallTilePickerVisible(true)
              }
              type="button"
            >
              <span className="nh3d-option-tile-picker-preview">
                {renderTilePreviewImageForOptions(
                  selectedDarkWallTileId,
                )}
              </span>
              <span className="nh3d-option-tile-picker-copy">
                <span className="nh3d-option-tile-picker-glyph">
                  {selectedDarkWallGlyphLabel}
                </span>
                <span className="nh3d-option-tile-picker-id">
                  tile #{selectedDarkWallTileId}
                </span>
              </span>
            </button>
          </div>
        ) : isDarkWallSolidColorOverrideOption ? (
          <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
            <div className="nh3d-dark-wall-solid-color-controls">
              <div className="nh3d-dark-wall-solid-color-input-row">
                <div className="nh3d-dark-wall-solid-color-input-group">
                  <label className="nh3d-dark-wall-mode-color">
                    <span>
                      {
                        t.dialogs.clientOptions
                          .darkWallControls.normal
                      }
                    </span>
                    <input
                      aria-label={
                        t.dialogs.clientOptions
                          .darkWallControls.normalAria
                      }
                      className="nh3d-option-solid-color-native-picker"
                      disabled={
                        darkWallSecondaryControlsDisabled
                      }
                      onChange={(event) =>
                        updateDarkWallSolidColorHexDraft(
                          event.target.value,
                        )
                      }
                      type="color"
                      value={normalizeSolidChromaKeyHex(
                        selectedDarkWallSolidColorHex,
                      )}
                    />
                  </label>
                  <label className="nh3d-dark-wall-mode-color">
                    <span>
                      {
                        t.dialogs.clientOptions
                          .darkWallControls.fps
                      }
                    </span>
                    <input
                      aria-label={
                        t.dialogs.clientOptions
                          .darkWallControls.fpsAria
                      }
                      className="nh3d-option-solid-color-native-picker"
                      disabled={
                        darkWallSecondaryControlsDisabled
                      }
                      onChange={(event) =>
                        updateDarkWallSolidColorHexFpsDraft(
                          event.target.value,
                        )
                      }
                      type="color"
                      value={normalizeSolidChromaKeyHex(
                        selectedDarkWallSolidColorHexFps,
                      )}
                    />
                  </label>
                </div>
                <div className="nh3d-dark-wall-solid-color-input-group">
                  <label className="nh3d-dark-wall-grid-toggle">
                    <input
                      checked={
                        selectedDarkWallSolidColorGridEnabled
                      }
                      disabled={
                        darkWallSecondaryControlsDisabled
                      }
                      onChange={(event) =>
                        updateDarkWallSolidColorGridEnabledDraft(
                          event.target.checked,
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      {
                        t.dialogs.clientOptions
                          .darkWallControls.gridLines
                      }
                    </span>
                  </label>
                  <label className="nh3d-dark-wall-grid-darkness">
                    <span>
                      {
                        t.dialogs.clientOptions
                          .darkWallControls.intensity
                      }
                    </span>
                    <span className="nh3d-dark-wall-grid-darkness-input-wrap">
                      <input
                        className="nh3d-dark-wall-grid-darkness-input"
                        disabled={
                          darkWallSecondaryControlsDisabled ||
                          !selectedDarkWallSolidColorGridEnabled
                        }
                        max={100}
                        min={0}
                        onChange={(event) =>
                          updateDarkWallSolidColorGridDarknessPercentDraft(
                            Number(event.target.value),
                          )
                        }
                        step={1}
                        type="number"
                        value={
                          selectedDarkWallSolidColorGridDarknessPercent
                        }
                      />
                      <span
                        aria-hidden="true"
                        className="nh3d-dark-wall-grid-darkness-suffix"
                      >
                        %
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <button
          aria-checked={enabled}
          className={`nh3d-option-switch nh3d-option-inline-switch${enabled ? " is-on" : ""
            }`}
          disabled={toggleDisabled}
          onClick={() => {
            if (toggleDisabled) {
              return;
            }
            if (isDarkWallTileOverrideOption) {
              updateDarkWallTileOverrideEnabledDraft(
                !enabled,
              );
              return;
            }
            if (isDarkWallSolidColorOverrideOption) {
              updateDarkWallSolidColorOverrideEnabledDraft(
                !enabled,
              );
              return;
            }
            updateClientOptionDraft(option.key, !enabled);
          }}
          role="switch"
          type="button"
        >
          <span className="nh3d-option-switch-thumb" />
        </button>
      </div>
      {shouldRenderControllerRemapRow ? (
        <div className="nh3d-option-row nh3d-option-row-controller-remap">
          <div className="nh3d-option-copy">
            <OptionLabelWithInfo
              label={
                t.dialogs.clientOptions.controllerRemap.title
              }
              description={
                t.dialogs.clientOptions.controllerRemap.hint
              }
            />
          </div>
          <div className="nh3d-option-select-controls">
            <button
              className="nh3d-menu-action-button"
              onClick={openControllerRemapDialog}
              type="button"
            >
              {
                t.dialogs.clientOptions.buttons
                  .remapController
              }
            </button>
          </div>
        </div>
      ) : null}
    </Fragment>
  );
}
