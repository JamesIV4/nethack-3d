import type {
  CharacterCreationConfig,
  Nh3dClientOptions
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  type StartupInitOptionValue,
  type StartupInitOptionValues
} from "../../../runtime/startup-init-options";
import StartupInitOptionsAccordion from "../../componenets/StartupInitOptionsAccordion";
import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  pickRandomStartupCreateCharacterSelection
} from "../../../game/helpers/startup-character-constraints";
import type * as React from "react";
import type {
  StartupFlowStep
} from "./character-preferences";
import {
  RuntimeVersionBadge
} from "./RuntimeVersionBadge";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  normalizeStartupCharacterName,
  startupDefaultCharacterName
} from "./character-preferences";

export interface RandomCharacterDialogProps {
  startupInitOptionsExpanded: boolean;
  startupInitialLoadingVisible: boolean;
  startupRandomDialogVisible: boolean;
  handleStartupMainMenuBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleStartupMainMenuChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleStartupMainMenuKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleStartupMainMenuPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  startupSelectedRuntimeVersionLabel: string | null;
  setRandomCharacterName: React.Dispatch<React.SetStateAction<string>>;
  randomCharacterName: string;
  setStartupInitOptionsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  updateStartupInitOptionValue: (key: string, value: StartupInitOptionValue) => void;
  resetStartupInitOptionValues: () => void;
  runtimeVersion: NethackRuntimeVersion;
  startupInitOptionValues: StartupInitOptionValues;
  handleStartNewGame: (config: CharacterCreationConfig) => Promise<void>;
  clientOptions: Nh3dClientOptions;
  startupInitOptionTokens: string[];
  setStartupFlowStep: React.Dispatch<React.SetStateAction<StartupFlowStep>>;
  openClientOptionsDialog: () => void;
}

export function RandomCharacterDialog({
  startupInitOptionsExpanded,
  startupInitialLoadingVisible,
  startupRandomDialogVisible,
  handleStartupMainMenuBlurCapture,
  handleStartupMainMenuChangeCapture,
  handleStartupMainMenuKeyDown,
  handleStartupMainMenuPointerDownCapture,
  startupSelectedRuntimeVersionLabel,
  setRandomCharacterName,
  randomCharacterName,
  setStartupInitOptionsExpanded,
  updateStartupInitOptionValue,
  resetStartupInitOptionValues,
  runtimeVersion,
  startupInitOptionValues,
  handleStartNewGame,
  clientOptions,
  startupInitOptionTokens,
  setStartupFlowStep,
  openClientOptionsDialog,
}: RandomCharacterDialogProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog${startupInitOptionsExpanded ? " nh3d-startup-init-expanded" : ""
        }`}
      disableAnimations={startupInitialLoadingVisible}
      open={startupRandomDialogVisible}
      id="character-setup-dialog-random"
      onBlurCapture={handleStartupMainMenuBlurCapture}
      onChangeCapture={handleStartupMainMenuChangeCapture}
      onKeyDown={handleStartupMainMenuKeyDown}
      onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
    >
      {startupSelectedRuntimeVersionLabel ? (
        <RuntimeVersionBadge
          label={startupSelectedRuntimeVersionLabel}
          startup
        />
      ) : null}
      <div className="nh3d-question-text">
        {t.dialogs.startup.enterRandomName}
      </div>
      <div className="nh3d-startup-config-grid centered">
        <label className="nh3d-startup-config-field">
          <span>{t.dialogs.startup.name}</span>
          <input
            className="nh3d-startup-config-input"
            maxLength={30}
            onChange={(event) => setRandomCharacterName(event.target.value)}
            onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
            placeholder={startupDefaultCharacterName}
            type="text"
            value={randomCharacterName}
          />
        </label>
      </div>
      <StartupInitOptionsAccordion
        expanded={startupInitOptionsExpanded}
        onExpandedChange={setStartupInitOptionsExpanded}
        onOptionValueChange={updateStartupInitOptionValue}
        onResetDefaults={resetStartupInitOptionValues}
        runtimeVersion={runtimeVersion}
        values={startupInitOptionValues}
      />
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={() => {
            const randomSelection =
              pickRandomStartupCreateCharacterSelection(
                runtimeVersion,
              );
            handleStartNewGame({
              mode: "random",
              playMode: clientOptions.fpsMode ? "fps" : "normal",
              runtimeVersion,
              name: normalizeStartupCharacterName(randomCharacterName),
              role: randomSelection.role,
              race: randomSelection.race,
              gender: randomSelection.gender,
              align: randomSelection.align,
              initOptions: startupInitOptionTokens,
            });
          }}
          type="button"
        >
          {t.dialogs.startup.startGame}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={() => setStartupFlowStep("choose")}
          type="button"
        >
          {commonStrings.back}
        </button>
        <button
          className="nh3d-menu-action-button"
          onClick={openClientOptionsDialog}
          type="button"
        >
          {t.dialogs.startup.options}
        </button>
      </div>
    </AnimatedDialog>
  );
}
