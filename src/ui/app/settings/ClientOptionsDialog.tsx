import { QuestWebXrSettings } from "../../../quest/webxr/QuestWebXrControls";
import { getWebXrState } from "../../../quest/webxr/presentation";
import { ClientOptionsUpdates } from "./ClientOptionsUpdates";
import { ClientOptionToggleControl } from "./ClientOptionToggleControl";
import { ClientOptionSelectControl } from "./ClientOptionSelectControl";
import { ClientOptionSliderControl } from "./ClientOptionSliderControl";
import { ClientOptionColorControl } from "./ClientOptionColorControl";
import {
  Fragment
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  constrainFpsModeForTilesetMode
} from "../../../game/client-option-constraints";
import type {
  Nh3dVersionCheckResult
} from "../../../update/types";
import SoundPackSettings, {
  type SoundPackDialogActions
} from "../../SoundPackSettings";
import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  resolveSupportedLocale
} from "../../../i18n/core";
import type * as React from "react";
import type {
  ClientOption,
  ClientOptionColor,
  ClientOptionSelect,
  ClientOptionSlider,
  ClientOptionToggleKey,
  ClientOptionsTab,
  ClientOptionsTabId,
  ManualSafeZonePreview
} from "./types";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  clientOptionsTabs
} from "./config";
import {
  OptionLabelWithInfo
} from "./OptionLabelWithInfo";
import {
  normalizeSolidChromaKeyHex
} from "../tilesets/TilesetSolidColorPickerDialog";
import type { ConfirmationDialogRequest } from "../../modals/useConfirmationDialog";


export interface ClientOptionsDialogProps {
  isClientOptionsVisible: boolean;
  handleClientOptionsDialogBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleClientOptionsDialogChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleClientOptionsDialogKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleClientOptionsDialogPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  requestCloseClientOptionsDialog: () => void;
  selectedClientOptionsTab: ClientOptionsTab;
  setActiveClientOptionsTab: React.Dispatch<React.SetStateAction<ClientOptionsTabId>>;
  clientOptionsDraft: Nh3dClientOptions;
  updateClientOptionDraft: <K extends ClientOptionToggleKey | ClientOptionSelect["key"] | ClientOptionSlider["key"] | ClientOptionColor["key"]>(optionKey: K, value: Nh3dClientOptions[K]) => void;
  optionsUpdateCheckStatus: string;
  optionsUpdateCheckResult: Nh3dVersionCheckResult | null;
  optionsUpdateCheckBusy: boolean;
  checkForUpdatesFromOptions: () => Promise<void>;
  openGitHubReleases: () => void;
  visibleClientOptions: ClientOption[];
  showDeveloperClientSettings: boolean;
  isVultureTilesetSelected: boolean;
  setIsDarkWallTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  renderTilePreviewImageForOptions: (tileId: number) => JSX.Element | null;
  selectedDarkWallTileId: number;
  selectedDarkWallGlyphLabel: string;
  updateDarkWallSolidColorHexDraft: (rawHex: string, rawTilesetPath?: string | undefined) => void;
  selectedDarkWallSolidColorHex: string;
  updateDarkWallSolidColorHexFpsDraft: (rawHex: string, rawTilesetPath?: string | undefined) => void;
  selectedDarkWallSolidColorHexFps: string;
  selectedDarkWallSolidColorGridEnabled: boolean;
  updateDarkWallSolidColorGridEnabledDraft: (enabled: boolean, rawTilesetPath?: string | undefined) => void;
  updateDarkWallSolidColorGridDarknessPercentDraft: (rawPercent: number, rawTilesetPath?: string | undefined) => void;
  selectedDarkWallSolidColorGridDarknessPercent: number;
  updateDarkWallTileOverrideEnabledDraft: (enabled: boolean, rawTilesetPath?: string | undefined) => void;
  updateDarkWallSolidColorOverrideEnabledDraft: (enabled: boolean, rawTilesetPath?: string | undefined) => void;
  openControllerRemapDialog: () => void;
  tilesetDropdownOptions: { value: string; label: string; }[];
  hasAnyTilesets: boolean;
  openTilesetManager: () => void;
  setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  updateTilesetPathDraft: (rawTilesetPath: string) => void;
  setManualSafeZonePreview: React.Dispatch<React.SetStateAction<ManualSafeZonePreview | null>>;
  showManualSafeZonePreview: (side: "right" | "bottom", rawSizePx: number) => void;
  updateClientSliderDraft: (key: "brightness" | "contrast" | "gamma" | "minimapScale" | "uiFontScale" | "liveMessageLogFontScale" | "desktopMessageLogWindowScale" | "controllerFpsMoveRepeatMs" | "fpsFov" | "fpsLookSensitivityX" | "fpsLookSensitivityY" | "bloodStrength" | "liveMessageDisplayTimeMs" | "liveMessageFadeOutTimeMs" | "manualMobileBottomSafeZoneVerticalPx" | "manualMobileBottomSafeZoneHorizontalPx" | "manualMobileRightSafeZoneHorizontalPx", rawValue: number) => void;
  soundPackDialogActionsRef: React.MutableRefObject<SoundPackDialogActions | null>;
  requestConfirmation: (request: ConfirmationDialogRequest) => Promise<boolean>;
  requestConfirmClientOptionsDialog: () => void;
  openResetClientOptionsConfirmation: () => void;
}

export function ClientOptionsDialog({
  isClientOptionsVisible,
  handleClientOptionsDialogBlurCapture,
  handleClientOptionsDialogChangeCapture,
  handleClientOptionsDialogKeyDown,
  handleClientOptionsDialogPointerDownCapture,
  renderMobileDialogCloseButton,
  requestCloseClientOptionsDialog,
  selectedClientOptionsTab,
  setActiveClientOptionsTab,
  clientOptionsDraft,
  updateClientOptionDraft,
  optionsUpdateCheckStatus,
  optionsUpdateCheckResult,
  optionsUpdateCheckBusy,
  checkForUpdatesFromOptions,
  openGitHubReleases,
  visibleClientOptions,
  showDeveloperClientSettings,
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
  tilesetDropdownOptions,
  hasAnyTilesets,
  openTilesetManager,
  setClientOptionsDraft,
  updateTilesetPathDraft,
  setManualSafeZonePreview,
  showManualSafeZonePreview,
  updateClientSliderDraft,
  soundPackDialogActionsRef,
  requestConfirmation,
  requestConfirmClientOptionsDialog,
  openResetClientOptionsConfirmation,
}: ClientOptionsDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close"
      open={isClientOptionsVisible}
      id="nh3d-client-options-dialog"
      onBlurCapture={handleClientOptionsDialogBlurCapture}
      onChangeCapture={handleClientOptionsDialogChangeCapture}
      onKeyDown={handleClientOptionsDialogKeyDown}
      onPointerDownCapture={handleClientOptionsDialogPointerDownCapture}
    >
      {renderMobileDialogCloseButton(
        requestCloseClientOptionsDialog,
        t.dialogs.clientOptions.closeLabel,
      )}
      <div className="nh3d-options-title">
        {t.dialogs.clientOptions.title}
      </div>
      <div className="nh3d-options-layout">
        <div className="nh3d-overflow-glow-frame nh3d-options-nav-shell">
          <div
            aria-label={t.dialogs.clientOptions.categoriesLabel}
            className="nh3d-options-nav"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
            role="tablist"
          >
            {clientOptionsTabs.map((tab) => {
              const isSelected = tab.id === selectedClientOptionsTab.id;
              return (
                <button
                  aria-controls="nh3d-client-options-panel"
                  aria-selected={isSelected}
                  className={`nh3d-options-tab${isSelected ? " is-selected" : ""}`}
                  id={`nh3d-client-options-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveClientOptionsTab(tab.id)}
                  role="tab"
                  tabIndex={isSelected ? 0 : -1}
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="nh3d-overflow-glow-frame nh3d-options-panel-shell">
          <div
            aria-labelledby={`nh3d-client-options-tab-${selectedClientOptionsTab.id}`}
            className="nh3d-options-panel"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
            id="nh3d-client-options-panel"
            role="tabpanel"
          >
            <div className="nh3d-options-panel-heading">
              <div className="nh3d-options-panel-title">
                {selectedClientOptionsTab.label}
              </div>
              <div className="nh3d-options-panel-description">
                {selectedClientOptionsTab.description}
              </div>
            </div>
            <div className="nh3d-options-list">
              {selectedClientOptionsTab.id === "updates" ? (<ClientOptionsUpdates
                clientOptionsDraft={clientOptionsDraft}
                updateClientOptionDraft={updateClientOptionDraft}
                optionsUpdateCheckStatus={optionsUpdateCheckStatus}
                optionsUpdateCheckResult={optionsUpdateCheckResult}
                optionsUpdateCheckBusy={optionsUpdateCheckBusy}
                checkForUpdatesFromOptions={checkForUpdatesFromOptions}
                openGitHubReleases={openGitHubReleases}
              />) : null}
              {selectedClientOptionsTab.id === "display" ? <QuestWebXrSettings /> : null}
              {visibleClientOptions.map((option) => {
                if (option.key === "vrPassthrough" && !getWebXrState().host) return null;
                if (option.developerOnly && !showDeveloperClientSettings) {
                  return null;
                }
                if (option.type === "section") {
                  return (
                    <Fragment key={option.key}>
                      <div className="nh3d-options-group-title">
                        {option.label}
                      </div>
                    </Fragment>
                  );
                }
                if (option.type === "boolean") {
                  return (<ClientOptionToggleControl key={option.key} option={option}
                    selectedClientOptionsTab={selectedClientOptionsTab}
                    clientOptionsDraft={clientOptionsDraft}
                    updateClientOptionDraft={updateClientOptionDraft}
                    isVultureTilesetSelected={isVultureTilesetSelected}
                    setIsDarkWallTilePickerVisible={setIsDarkWallTilePickerVisible}
                    renderTilePreviewImageForOptions={renderTilePreviewImageForOptions}
                    selectedDarkWallTileId={selectedDarkWallTileId}
                    selectedDarkWallGlyphLabel={selectedDarkWallGlyphLabel}
                    updateDarkWallSolidColorHexDraft={updateDarkWallSolidColorHexDraft}
                    selectedDarkWallSolidColorHex={selectedDarkWallSolidColorHex}
                    updateDarkWallSolidColorHexFpsDraft={updateDarkWallSolidColorHexFpsDraft}
                    selectedDarkWallSolidColorHexFps={selectedDarkWallSolidColorHexFps}
                    selectedDarkWallSolidColorGridEnabled={selectedDarkWallSolidColorGridEnabled}
                    updateDarkWallSolidColorGridEnabledDraft={updateDarkWallSolidColorGridEnabledDraft}
                    updateDarkWallSolidColorGridDarknessPercentDraft={updateDarkWallSolidColorGridDarknessPercentDraft}
                    selectedDarkWallSolidColorGridDarknessPercent={selectedDarkWallSolidColorGridDarknessPercent}
                    updateDarkWallTileOverrideEnabledDraft={updateDarkWallTileOverrideEnabledDraft}
                    updateDarkWallSolidColorOverrideEnabledDraft={updateDarkWallSolidColorOverrideEnabledDraft}
                    openControllerRemapDialog={openControllerRemapDialog}
                  />);
                }
                if (option.type === "select") {
                  return (<ClientOptionSelectControl key={option.key} option={option}
                    clientOptionsDraft={clientOptionsDraft}
                    updateClientOptionDraft={updateClientOptionDraft}
                    tilesetDropdownOptions={tilesetDropdownOptions}
                    hasAnyTilesets={hasAnyTilesets}
                    openTilesetManager={openTilesetManager}
                    setClientOptionsDraft={setClientOptionsDraft}
                    updateTilesetPathDraft={updateTilesetPathDraft}
                  />);
                }
                if (option.type === "slider") {
                  return (<ClientOptionSliderControl key={option.key} option={option}
                    clientOptionsDraft={clientOptionsDraft}
                    setManualSafeZonePreview={setManualSafeZonePreview}
                    showManualSafeZonePreview={showManualSafeZonePreview}
                    updateClientSliderDraft={updateClientSliderDraft}
                  />);
                }
                if (option.type === "color") {
                  return (<ClientOptionColorControl key={option.key} option={option}
                    clientOptionsDraft={clientOptionsDraft}
                    updateClientOptionDraft={updateClientOptionDraft}
                  />);
                }
                return null;
              })}
              <SoundPackSettings
                onDialogActionsChange={(actions) => {
                  soundPackDialogActionsRef.current = actions;
                }}
                requestConfirmation={requestConfirmation}
                visible={selectedClientOptionsTab.id === "sound"}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={requestConfirmClientOptionsDialog}
          type="button"
        >
          {commonStrings.confirm}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={requestCloseClientOptionsDialog}
          type="button"
        >
          {commonStrings.cancel}
        </button>
        <button
          className="nh3d-menu-action-button"
          onClick={openResetClientOptionsConfirmation}
          type="button"
        >
          {commonStrings.resetToDefaults}
        </button>
      </div>
    </AnimatedDialog>
  );
}
