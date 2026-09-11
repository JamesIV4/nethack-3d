import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  supportsRuntimeTopScores
} from "../../../runtime/runtime-capabilities";
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

export interface StartupMenuDialogProps {
  startupInitialLoadingVisible: boolean;
  startupChooseDialogVisible: boolean;
  handleStartupMainMenuBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleStartupMainMenuChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleStartupMainMenuKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleStartupMainMenuPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  startupSelectedRuntimeVersionLabel: string | null;
  setStartupFlowStep: React.Dispatch<React.SetStateAction<StartupFlowStep>>;
  handleResumeClick: () => Promise<void>;
  runtimeVersion: NethackRuntimeVersion;
  openTopScoresDialog: () => void;
  openClientOptionsDialog: () => void;
}

export function StartupMenuDialog({
  startupInitialLoadingVisible,
  startupChooseDialogVisible,
  handleStartupMainMenuBlurCapture,
  handleStartupMainMenuChangeCapture,
  handleStartupMainMenuKeyDown,
  handleStartupMainMenuPointerDownCapture,
  startupSelectedRuntimeVersionLabel,
  setStartupFlowStep,
  handleResumeClick,
  runtimeVersion,
  openTopScoresDialog,
  openClientOptionsDialog,
}: StartupMenuDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog"
      disableAnimations={startupInitialLoadingVisible}
      open={startupChooseDialogVisible}
      id="character-setup-dialog-choose"
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
        {t.dialogs.startup.chooseSetup}
      </div>
      <div className="nh3d-overflow-glow-frame">
        <div
          className="nh3d-choice-list nh3d-choice-list-startup-choose"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
        >
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={() => setStartupFlowStep("random")}
            type="button"
          >
            {t.dialogs.startup.randomCharacter}
          </button>
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={() => setStartupFlowStep("create")}
            type="button"
          >
            {t.dialogs.startup.createCharacter}
          </button>
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={handleResumeClick}
            type="button"
          >
            {t.dialogs.startup.loadGame}
          </button>
          {supportsRuntimeTopScores(runtimeVersion) ? (
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={openTopScoresDialog}
              type="button"
            >
              Top Scores
            </button>
          ) : null}
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={openClientOptionsDialog}
            type="button"
          >
            {t.dialogs.startup.options}
          </button>
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={() => setStartupFlowStep("variant")}
            type="button"
          >
            {commonStrings.back}
          </button>
        </div>
      </div>
    </AnimatedDialog>
  );
}
