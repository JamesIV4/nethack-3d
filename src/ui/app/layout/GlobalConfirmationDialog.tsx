import ConfirmationModal from "../../modals/ConfirmationModal";
import type { ConfirmationDialogState, ConfirmationDialogChoice } from "../../modals/useConfirmationDialog";


export interface GlobalConfirmationDialogProps {
  globalConfirmationDialog: ConfirmationDialogState | null;
  resolveConfirmation: (choice: ConfirmationDialogChoice) => void;
}

export function GlobalConfirmationDialog({
  globalConfirmationDialog,
  resolveConfirmation,
}: GlobalConfirmationDialogProps) {
  return (
    <ConfirmationModal
      dialog={globalConfirmationDialog}
      dialogId="nh3d-global-confirmation-dialog"
      onCancel={() => resolveConfirmation("cancel")}
      onConfirm={() => resolveConfirmation("confirm")}
      onExtra={() => resolveConfirmation("extra")}
    />
  );
}
