import type { Nh3dClientOptions, InventoryDialogState, Nethack3DEngineController } from "../../../game/ui-types";
import type * as React from "react";
import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "../menus/mobile-actions";

export interface DesktopActionsProps {
  isDesktopGameRunning: boolean;
  clientOptions: Nh3dClientOptions;
  wizardCommandsSupported: boolean;
  isWizardCommandsVisible: boolean;
  toggleWizardCommands: () => void;
  wizardCommandsButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  isCharacterSheetVisible: boolean;
  openCharacterDialog: () => void;
  inventory: InventoryDialogState;
  controller: Nethack3DEngineController | null;
  closeWizardCommands: () => void;
}

export function DesktopActions({
  isDesktopGameRunning,
  clientOptions,
  wizardCommandsSupported,
  isWizardCommandsVisible,
  toggleWizardCommands,
  wizardCommandsButtonRef,
  isCharacterSheetVisible,
  openCharacterDialog,
  inventory,
  controller,
  closeWizardCommands,
}: DesktopActionsProps) {
  return (
    isDesktopGameRunning && !clientOptions.controllerEnabled ? (
      <div className="nh3d-desktop-bottom-actions">
        {wizardCommandsSupported ? (
          <button
            className={`nh3d-desktop-bottom-button${isWizardCommandsVisible ? " is-active" : ""
              }`}
            onClick={toggleWizardCommands}
            ref={wizardCommandsButtonRef}
            type="button"
          >
            {t.dialogs.mobileActions.wizard}
          </button>
        ) : null}
        <button
          className={`nh3d-desktop-bottom-button${isCharacterSheetVisible ? " is-active" : ""
            }`}
          onClick={openCharacterDialog}
          type="button"
        >
          {t.dialogs.mobileActions.character}
        </button>
        <button
          className={`nh3d-desktop-bottom-button${inventory.visible ? " is-active" : ""
            }`}
          onClick={() => {
            controller?.dismissFpsCrosshairContextMenu();
            closeWizardCommands();
            controller?.toggleInventoryDialog();
          }}
          type="button"
        >
          {t.dialogs.mobileActions.inventory}
        </button>
      </div>
    ) : null
  );
}
