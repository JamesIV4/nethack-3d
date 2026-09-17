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
import type { StartupCreateCharacterSelection, StartupCreateCharacterOptionSet } from "../../../game/helpers/startup-character-constraints";


export interface CreateCharacterDialogProps {
  startupInitOptionsExpanded: boolean;
  startupInitialLoadingVisible: boolean;
  startupCreateDialogVisible: boolean;
  handleStartupMainMenuBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleStartupMainMenuChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleStartupMainMenuKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleStartupMainMenuPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  startupSelectedRuntimeVersionLabel: string | null;
  setCreateCharacterName: React.Dispatch<React.SetStateAction<string>>;
  createCharacterName: string;
  setCreateRole: React.Dispatch<React.SetStateAction<string>>;
  normalizedCreateCharacterSelection: StartupCreateCharacterSelection;
  startupCreateCharacterOptionSet: StartupCreateCharacterOptionSet;
  setCreateRace: React.Dispatch<React.SetStateAction<string>>;
  setCreateGender: React.Dispatch<React.SetStateAction<string>>;
  setCreateAlign: React.Dispatch<React.SetStateAction<string>>;
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

export function CreateCharacterDialog({
  startupInitOptionsExpanded,
  startupInitialLoadingVisible,
  startupCreateDialogVisible,
  handleStartupMainMenuBlurCapture,
  handleStartupMainMenuChangeCapture,
  handleStartupMainMenuKeyDown,
  handleStartupMainMenuPointerDownCapture,
  startupSelectedRuntimeVersionLabel,
  setCreateCharacterName,
  createCharacterName,
  setCreateRole,
  normalizedCreateCharacterSelection,
  startupCreateCharacterOptionSet,
  setCreateRace,
  setCreateGender,
  setCreateAlign,
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
}: CreateCharacterDialogProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog${startupInitOptionsExpanded ? " nh3d-startup-init-expanded" : ""
        }`}
      disableAnimations={startupInitialLoadingVisible}
      open={startupCreateDialogVisible}
      id="character-setup-dialog-create"
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
        {t.dialogs.startup.createCharacterPrompt}
      </div>
      <div className="nh3d-startup-config-grid">
        <label className="nh3d-startup-config-field">
          <span>{t.dialogs.startup.name}</span>
          <input
            className="nh3d-startup-config-input"
            maxLength={30}
            onChange={(event) => setCreateCharacterName(event.target.value)}
            onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
            placeholder={startupDefaultCharacterName}
            type="text"
            value={createCharacterName}
          />
        </label>
        <label className="nh3d-startup-config-field">
          <span>{t.dialogs.startup.role}</span>
          <select
            className="nh3d-startup-config-select"
            onChange={(event) => setCreateRole(event.target.value)}
            value={normalizedCreateCharacterSelection.role}
          >
            {startupCreateCharacterOptionSet.roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="nh3d-startup-config-field">
          <span>{t.dialogs.startup.race}</span>
          <select
            className="nh3d-startup-config-select"
            onChange={(event) => setCreateRace(event.target.value)}
            value={normalizedCreateCharacterSelection.race}
          >
            {startupCreateCharacterOptionSet.raceOptions.map((race) => (
              <option key={race} value={race}>
                {race}
              </option>
            ))}
          </select>
        </label>
        <label className="nh3d-startup-config-field">
          <span>{t.dialogs.startup.gender}</span>
          <select
            className="nh3d-startup-config-select"
            onChange={(event) => setCreateGender(event.target.value)}
            value={normalizedCreateCharacterSelection.gender}
          >
            {startupCreateCharacterOptionSet.genderOptions.map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
        </label>
        <label className="nh3d-startup-config-field">
          <span>{t.dialogs.startup.alignment}</span>
          <select
            className="nh3d-startup-config-select"
            onChange={(event) => setCreateAlign(event.target.value)}
            value={normalizedCreateCharacterSelection.align}
          >
            {startupCreateCharacterOptionSet.alignOptions.map((align) => (
              <option key={align} value={align}>
                {align}
              </option>
            ))}
          </select>
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
          onClick={() =>
            handleStartNewGame({
              mode: "create",
              playMode: clientOptions.fpsMode ? "fps" : "normal",
              runtimeVersion,
              name: normalizeStartupCharacterName(createCharacterName),
              role: normalizedCreateCharacterSelection.role,
              race: normalizedCreateCharacterSelection.race,
              gender: normalizedCreateCharacterSelection.gender,
              align: normalizedCreateCharacterSelection.align,
              initOptions: startupInitOptionTokens,
            })
          }
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
