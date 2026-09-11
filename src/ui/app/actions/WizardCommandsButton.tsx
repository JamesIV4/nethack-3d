import type * as React from "react";
import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "../menus/mobile-actions";

export interface WizardCommandsButtonProps {
  wizardCommandsSupported: boolean;
  mobileTouchUiVisible: boolean;
  isWizardCommandsVisible: boolean;
  toggleWizardCommands: () => void;
  wizardCommandsButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}

export function WizardCommandsButton({
  wizardCommandsSupported,
  mobileTouchUiVisible,
  isWizardCommandsVisible,
  toggleWizardCommands,
  wizardCommandsButtonRef,
}: WizardCommandsButtonProps) {
  return (
    wizardCommandsSupported && mobileTouchUiVisible ? (
      <button
        className={`nh3d-wizard-commands-button${isWizardCommandsVisible ? " is-active" : ""
          }`}
        onClick={toggleWizardCommands}
        ref={wizardCommandsButtonRef}
        type="button"
      >
        {t.dialogs.mobileActions.wizard}
      </button>
    ) : null
  );
}
