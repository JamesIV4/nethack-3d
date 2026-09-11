import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  commonStrings,
  t
} from "../shared/translations";

export interface ResetClientOptionsDialogProps {
  isClientOptionsVisible: boolean;
  isResetClientOptionsConfirmationVisible: boolean;
  confirmResetClientOptionsToDefaults: () => Promise<void>;
  cancelResetClientOptionsConfirmation: () => void;
}

export function ResetClientOptionsDialog({
  isClientOptionsVisible,
  isResetClientOptionsConfirmationVisible,
  confirmResetClientOptionsToDefaults,
  cancelResetClientOptionsConfirmation,
}: ResetClientOptionsDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
      open={isClientOptionsVisible && isResetClientOptionsConfirmationVisible}
      id="nh3d-reset-client-options-confirmation-dialog"
    >
      <div className="nh3d-question-text">
        {t.dialogs.clientOptions.resetPrompt}
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={confirmResetClientOptionsToDefaults}
          type="button"
        >
          {commonStrings.yes}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={cancelResetClientOptionsConfirmation}
          type="button"
        >
          {commonStrings.no}
        </button>
      </div>
    </AnimatedDialog>
  );
}
