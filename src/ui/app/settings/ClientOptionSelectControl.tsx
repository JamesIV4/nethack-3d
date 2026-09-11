import { constrainFpsModeForTilesetMode } from "../../../game/client-option-constraints";
import { resolveSupportedLocale } from "../../../i18n/core";
import { t } from "../shared/translations";
import { OptionLabelWithInfo } from "./OptionLabelWithInfo";
import type { ClientOptionsDialogProps } from "./ClientOptionsDialog";
import type { ClientOptionSelect } from "./types";

type ClientOptionSelectControlProps = Pick<ClientOptionsDialogProps,
  | "clientOptionsDraft"
  | "updateClientOptionDraft"
  | "tilesetDropdownOptions"
  | "hasAnyTilesets"
  | "openTilesetManager"
  | "setClientOptionsDraft"
  | "updateTilesetPathDraft"
> & { option: ClientOptionSelect };

export function ClientOptionSelectControl({
  option,
  clientOptionsDraft,
  updateClientOptionDraft,
  tilesetDropdownOptions,
  hasAnyTilesets,
  openTilesetManager,
  setClientOptionsDraft,
  updateTilesetPathDraft,
}: ClientOptionSelectControlProps): JSX.Element {

  const isTilesetSelect = option.key === "tilesetPath";
  const isInventoryFixedTileSizeSelect =
    option.key === "inventoryFixedTileSize";
  const isBloodDetailSelect = option.key === "bloodDetail";
  const selectOptions = isTilesetSelect
    ? tilesetDropdownOptions
    : option.options;
  const tilesetSelectDisabledByDisplayMode =
    isTilesetSelect &&
    clientOptionsDraft.tilesetMode !== "tiles";
  const selectDisabled = isTilesetSelect
    ? tilesetSelectDisabledByDisplayMode || !hasAnyTilesets
    : isInventoryFixedTileSizeSelect
      ? !clientOptionsDraft.reduceInventoryMotion
      : isBloodDetailSelect
        ? !clientOptionsDraft.bloodGround
        : option.key === "asciiColorMode"
          ? clientOptionsDraft.tilesetMode === "terminal"
          : Boolean(option.disabled);
  return (
    <div
      className={`nh3d-option-row${selectDisabled ? " nh3d-option-row-mode-inactive" : ""
        }`}
      key={option.key}
    >
      <div className="nh3d-option-copy">
        <OptionLabelWithInfo
          label={option.label}
          description={option.description}
        />
      </div>
      <div
        className={`nh3d-option-select-controls${isTilesetSelect
          ? " nh3d-option-select-controls-tileset"
          : ""
          }`}
      >
        {isTilesetSelect ? (
          <button
            className="nh3d-menu-action-button"
            onClick={openTilesetManager}
            type="button"
          >
            {t.dialogs.clientOptions.buttons.manageTileSets}
          </button>
        ) : null}
        <select
          className="nh3d-startup-config-select"
          disabled={selectDisabled}
          onChange={(event) => {
            if (option.key === "locale") {
              const nextValue =
                resolveSupportedLocale(event.target.value) ??
                clientOptionsDraft.locale;
              updateClientOptionDraft(option.key, nextValue);
              return;
            }
            if (option.key === "tilesetMode") {
              const nextTilesetMode =
                event.target.value === "tiles"
                  ? "tiles"
                  : event.target.value === "terminal"
                    ? "terminal"
                    : "ascii";
              setClientOptionsDraft((previous) => ({
                ...previous,
                tilesetMode: nextTilesetMode,
                fpsMode: constrainFpsModeForTilesetMode(
                  previous.fpsMode,
                  nextTilesetMode,
                ),
              }));
              return;
            }
            if (option.key === "tilesetPath") {
              updateTilesetPathDraft(event.target.value);
              return;
            }
            if (option.key === "inventoryFixedTileSize") {
              const nextValue =
                event.target.value === "none" ||
                  event.target.value === "small" ||
                  event.target.value === "large"
                  ? event.target.value
                  : "medium";
              updateClientOptionDraft(option.key, nextValue);
              return;
            }
            if (option.key === "desktopTouchInterfaceMode") {
              const nextValue =
                event.target.value === "portrait" ||
                  event.target.value === "landscape"
                  ? event.target.value
                  : "off";
              updateClientOptionDraft(option.key, nextValue);
              return;
            }
            if (option.key === "bloodDetail") {
              const nextValue =
                event.target.value === "veryLow" ||
                  event.target.value === "low" ||
                  event.target.value === "high"
                  ? event.target.value
                  : "medium";
              updateClientOptionDraft(option.key, nextValue);
              return;
            }
            if (option.key === "asciiColorMode") {
              updateClientOptionDraft(
                option.key,
                event.target.value === "classic" ||
                  event.target.value === "terminal"
                  ? event.target.value
                  : "nethack-3d",
              );
              return;
            }
            if (option.key === "minimapColorMode") {
              updateClientOptionDraft(
                option.key,
                event.target.value === "terminal"
                  ? "terminal"
                  : "nethack-3d",
              );
              return;
            }
            updateClientOptionDraft(
              option.key,
              event.target.value === "taa" ? "taa" : "fxaa",
            );
          }}
          value={String(clientOptionsDraft[option.key])}
        >
          {selectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
