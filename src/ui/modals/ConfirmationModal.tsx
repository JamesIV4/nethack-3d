import type { ConfirmationDialogState } from "./useConfirmationDialog";
import AnimatedDialog from "./AnimatedDialog";

type ConfirmationModalProps = {
  dialogId: string;
  dialog: ConfirmationDialogState | null;
  onConfirm: () => void;
  onCancel: () => void;
  onExtra?: () => void;
};

export default function ConfirmationModal({
  dialogId,
  dialog,
  onConfirm,
  onCancel,
  onExtra,
}: ConfirmationModalProps): JSX.Element | null {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
      open={dialog !== null}
      id={dialogId}
    >
      {dialog ? (
        <>
          {dialog.title ? (
            <div className="nh3d-options-title">{dialog.title}</div>
          ) : null}
          <div className="nh3d-question-text">{dialog.message}</div>
          <div className="nh3d-menu-actions">
            <button
              className={`nh3d-menu-action-button ${dialog.confirmClassName}`}
              onClick={onConfirm}
              type="button"
            >
              {dialog.confirmLabel}
            </button>
            {dialog.extraLabel ? (
              <button
                className={`nh3d-menu-action-button ${dialog.extraClassName}`}
                onClick={onExtra}
                type="button"
              >
                {dialog.extraLabel}
              </button>
            ) : null}
            <button
              className="nh3d-menu-action-button"
              onClick={onCancel}
              type="button"
            >
              {dialog.cancelLabel}
            </button>
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
