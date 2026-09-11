import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  commonStrings,
  t
} from "../shared/translations";

export interface ControllerSupportDialogProps {
  isControllerSupportPromptVisible: boolean;
  confirmControllerSupportPromptChoice: (enabled: boolean) => void;
}

export function ControllerSupportDialog({
  isControllerSupportPromptVisible,
  confirmControllerSupportPromptChoice,
}: ControllerSupportDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
      open={isControllerSupportPromptVisible}
      id="nh3d-controller-support-dialog"
    >
      <div className="nh3d-question-text">
        {t.dialogs.controllerSupport.prompt}
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={() => confirmControllerSupportPromptChoice(true)}
          type="button"
        >
          {commonStrings.yes}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={() => confirmControllerSupportPromptChoice(false)}
          type="button"
        >
          {commonStrings.no}
        </button>
      </div>
    </AnimatedDialog>
  );
}
