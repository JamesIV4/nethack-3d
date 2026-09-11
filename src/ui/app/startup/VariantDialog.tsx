import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  StartupFlowStep
} from "./character-preferences";
import {
  t
} from "../shared/translations";
import {
  requestGameQuit
} from "../shared/platform";

export interface VariantDialogProps {
  startupInitialLoadingVisible: boolean;
  startupVariantDialogVisible: boolean;
  handleStartupMainMenuBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleStartupMainMenuChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleStartupMainMenuKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleStartupMainMenuPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  setRuntimeVersion: React.Dispatch<React.SetStateAction<NethackRuntimeVersion>>;
  setStartupFlowStep: React.Dispatch<React.SetStateAction<StartupFlowStep>>;
}

export function VariantDialog({
  startupInitialLoadingVisible,
  startupVariantDialogVisible,
  handleStartupMainMenuBlurCapture,
  handleStartupMainMenuChangeCapture,
  handleStartupMainMenuKeyDown,
  handleStartupMainMenuPointerDownCapture,
  setRuntimeVersion,
  setStartupFlowStep,
}: VariantDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog"
      disableAnimations={startupInitialLoadingVisible}
      open={startupVariantDialogVisible}
      id="character-setup-dialog-variant"
      onBlurCapture={handleStartupMainMenuBlurCapture}
      onChangeCapture={handleStartupMainMenuChangeCapture}
      onKeyDown={handleStartupMainMenuKeyDown}
      onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
    >
      <div className="nh3d-question-text">
        {t.dialogs.startup.chooseVariant}
      </div>
      <div className="nh3d-overflow-glow-frame">
        <div
          className="nh3d-choice-list nh3d-choice-list-startup-choose"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
        >
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={() => {
              setRuntimeVersion("5.0");
              setStartupFlowStep("choose");
            }}
            type="button"
          >
            NetHack 5.0
          </button>
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={() => {
              setRuntimeVersion("3.6.7");
              setStartupFlowStep("choose");
            }}
            type="button"
          >
            NetHack 3.6.7
          </button>
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={() => {
              setRuntimeVersion("slashem");
              setStartupFlowStep("choose");
            }}
            type="button"
          >
            SLASH'EM
          </button>
          <button
            className="nh3d-choice-button nh3d-character-setup-choice-button"
            onClick={() => {
              void requestGameQuit();
            }}
            type="button"
          >
            {t.dialogs.startup.quitGame}
          </button>
        </div>
      </div>
    </AnimatedDialog>
  );
}
