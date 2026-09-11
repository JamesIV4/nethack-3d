import type { Nh3dClientOptions, Nethack3DEngineController } from "../../../game/ui-types";
import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  t
} from "../shared/translations";
import {
  getDirectionHelpText
} from "../menus/question-choices";

export interface DirectionDialogProps {
  directionQuestion: string | null;
  controller: Nethack3DEngineController | null;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  isFpsPlayMode: boolean;
  numberPadModeEnabled: boolean;
  clientOptions: Nh3dClientOptions;
}

export function DirectionDialog({
  directionQuestion,
  controller,
  renderMobileDialogCloseButton,
  isFpsPlayMode,
  numberPadModeEnabled,
  clientOptions,
}: DirectionDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-direction nh3d-dialog-direction-fps nh3d-dialog-has-mobile-close"
      open={Boolean(directionQuestion)}
      id="direction-dialog"
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button")) {
          return;
        }
        controller?.confirmActiveDirectionQuestion();
      }}
    >
      {directionQuestion ? (
        <>
          {renderMobileDialogCloseButton(
            () => controller?.cancelActivePrompt(),
            t.dialogs.direction.cancelLabel,
          )}
          <div className="nh3d-direction-text">{directionQuestion}</div>
          <div className="nh3d-direction-fps-hint">
            {isFpsPlayMode
              ? t.directionHelp.fps
              : getDirectionHelpText(
                numberPadModeEnabled,
                clientOptions.controllerEnabled,
              )}
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
