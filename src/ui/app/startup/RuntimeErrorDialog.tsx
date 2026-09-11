import type { InfoMenuState, NewGamePromptState, QuestionDialogState } from "../../../game/ui-types";
import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  t
} from "../shared/translations";

export interface RuntimeErrorDialogProps {
  runtimeInitializationErrorVisible: boolean;
  newGamePrompt: NewGamePromptState;
  infoMenu: InfoMenuState | null;
  question: QuestionDialogState | null;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  startNewGameFromPrompt: () => void;
  runtimeInitializationErrorMessage: string;
}

// Keep startup failures pinned in a real dialog so update/runtime
// initialization errors remain readable even after the loading overlay
// is dismissed.
export function RuntimeErrorDialog({
  runtimeInitializationErrorVisible,
  newGamePrompt,
  infoMenu,
  question,
  renderMobileDialogCloseButton,
  startNewGameFromPrompt,
  runtimeInitializationErrorMessage,
}: RuntimeErrorDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-runtime-start-error"
      open={
        runtimeInitializationErrorVisible &&
        !newGamePrompt.visible &&
        !infoMenu &&
        !question
      }
      id="runtime-start-error-dialog"
    >
      {renderMobileDialogCloseButton(
        startNewGameFromPrompt,
        t.dialogs.runtimeStartError.closeLabel,
      )}
      <div className="nh3d-question-text">
        {t.dialogs.runtimeStartError.title}
      </div>
      <div className="nh3d-runtime-start-error-copy">
        {runtimeInitializationErrorMessage}
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={startNewGameFromPrompt}
          type="button"
        >
          {t.dialogs.runtimeStartError.returnToMainMenu}
        </button>
      </div>
    </AnimatedDialog>
  );
}
