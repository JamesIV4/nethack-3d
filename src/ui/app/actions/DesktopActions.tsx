import { useActionLayout } from "./action-layout";
import { ActionLabel } from "./ActionLabel";
import { actionCatalog, formatActionLabel, runCustomCommand } from "./action-catalog";
import { QuestWebXrButton } from "../../../quest/webxr/QuestWebXrControls";
import type { Nh3dClientOptions, InventoryDialogState, Nethack3DEngineController } from "../../../game/ui-types";
import type * as React from "react";
import {
  t
} from "../shared/translations";

export interface DesktopActionsProps {
  actionCommandNames: string[];
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
  actionCommandNames,
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
  const layout = useActionLayout();
  const catalog = actionCatalog(actionCommandNames);
  return (
    isDesktopGameRunning && !clientOptions.controllerEnabled ? (
      <div className="nh3d-desktop-bottom-actions">
        <QuestWebXrButton />
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
        {layout.desktopHotbar.map(id => {
          const action = catalog.find(a => a.id === id);
          const active = id === "character" ? isCharacterSheetVisible : id === "inventory" ? inventory.visible : false;
          return <button key={id} type="button" disabled={!action}
            className={`nh3d-desktop-bottom-button${active ? " is-active" : ""}`}
            onClick={() => {
              if (!action) return;
              controller?.dismissFpsCrosshairContextMenu();
              if (id === "character") openCharacterDialog();
              else if (id === "inventory") { closeWizardCommands(); controller?.toggleInventoryDialog(); }
              else runCustomCommand(controller, action);
            }}><ActionLabel>{action?.label ?? formatActionLabel(id.replace(/^command:/, ""))}</ActionLabel></button>;
        })}
      </div>
    ) : null
  );
}
