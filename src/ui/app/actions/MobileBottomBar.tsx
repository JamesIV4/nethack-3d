import { QuestWebXrButton } from "../../../quest/webxr/QuestWebXrControls";
import type { Nh3dClientOptions, InventoryDialogState, Nethack3DEngineController } from "../../../game/ui-types";
import type * as React from "react";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";
import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "../menus/mobile-actions";

export interface MobileBottomBarProps {
  mobileTouchUiVisible: boolean;
  isCharacterSheetVisible: boolean;
  openCharacterDialog: () => void;
  inventory: InventoryDialogState;
  controller: Nethack3DEngineController | null;
  closeWizardCommands: () => void;
  isMobileLogVisible: boolean;
  clientOptions: Nh3dClientOptions;
  setIsMobileLogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMobileActionSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileActionSheetMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  isMobileActionSheetVisible: boolean;
}

export function MobileBottomBar({
  mobileTouchUiVisible,
  isCharacterSheetVisible,
  openCharacterDialog,
  inventory,
  controller,
  closeWizardCommands,
  isMobileLogVisible,
  clientOptions,
  setIsMobileLogVisible,
  setIsMobileActionSheetVisible,
  setMobileActionSheetMode,
  isMobileActionSheetVisible,
}: MobileBottomBarProps) {
  return (
    mobileTouchUiVisible ? (
      <div className="nh3d-mobile-bottom-bar" data-xr-ui>
        <QuestWebXrButton className="nh3d-mobile-bottom-button" />
        <button
          className={`nh3d-mobile-bottom-button${isCharacterSheetVisible ? " is-active" : ""
            }`}
          onClick={openCharacterDialog}
          type="button"
        >
          {t.dialogs.mobileActions.character}
        </button>
        <button
          className={`nh3d-mobile-bottom-button${inventory.visible ? " is-active" : ""
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
        <button
          aria-expanded={isMobileLogVisible}
          className={`nh3d-mobile-bottom-button${isMobileLogVisible ? " is-active" : ""
            }`}
          disabled={!clientOptions.liveMessageLog}
          onClick={() => {
            controller?.dismissFpsCrosshairContextMenu();
            if (!clientOptions.liveMessageLog) {
              return;
            }
            setIsMobileLogVisible((visible) => {
              const next = !visible;
              if (next) {
                setIsMobileActionSheetVisible(false);
                setMobileActionSheetMode("quick");
                closeWizardCommands();
              }
              return next;
            });
          }}
          type="button"
        >
          {t.dialogs.mobileActions.log}
        </button>
        <button
          className="nh3d-mobile-bottom-button"
          onClick={() => {
            controller?.dismissFpsCrosshairContextMenu();
            controller?.runQuickAction("pickup");
          }}
          type="button"
        >
          {t.dialogs.mobileActions.pickUp}
        </button>
        <button
          className="nh3d-mobile-bottom-button"
          onClick={() => {
            controller?.dismissFpsCrosshairContextMenu();
            controller?.runQuickAction("search");
          }}
          type="button"
        >
          {t.dialogs.mobileActions.search}
        </button>
        <button
          aria-label={`${t.dialogs.mobileActions.menu} / ${t.dialogs.mobileActions.actions}`}
          className={`nh3d-mobile-bottom-button${isMobileActionSheetVisible ? " is-active" : ""
            }`}
          onClick={() => {
            controller?.dismissFpsCrosshairContextMenu();
            setIsMobileActionSheetVisible((visible) => {
              const next = !visible;
              if (next) {
                setMobileActionSheetMode("quick");
                setIsMobileLogVisible(false);
                closeWizardCommands();
              }
              return next;
            });
          }}
          type="button"
        >
          {t.dialogs.mobileActions.menu} /
          <br />
          {t.dialogs.mobileActions.actions}
        </button>
      </div>
    ) : null
  );
}
