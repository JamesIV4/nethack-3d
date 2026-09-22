import { useActionLayout } from "./action-layout";
import { ActionLabel } from "./ActionLabel";
import { actionCatalog, formatActionLabel, runCustomCommand } from "./action-catalog";
import { useHotbarHeight } from "./use-hotbar-height";
import { QuestWebXrButton } from "../../../quest/webxr/QuestWebXrControls";
import type { Nh3dClientOptions, InventoryDialogState, Nethack3DEngineController } from "../../../game/ui-types";
import type * as React from "react";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";

export interface MobileBottomBarProps {
  actionCommandNames: string[];
  openButtonCustomization: () => void;
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
  actionCommandNames,
  openButtonCustomization,
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
  const layout = useActionLayout();
  const catalog = actionCatalog(actionCommandNames);
  const barRef = useHotbarHeight(mobileTouchUiVisible);
  const openActions = (extended = false) => {
    controller?.dismissFpsCrosshairContextMenu();
    setIsMobileActionSheetVisible(visible => extended || !visible);
    setMobileActionSheetMode(extended ? "extended" : "quick");
    setIsMobileLogVisible(false);
    closeWizardCommands();
  };
  if (!mobileTouchUiVisible) return null;
  return <div className="nh3d-mobile-bottom-bar" data-xr-ui ref={barRef}>
    <QuestWebXrButton className="nh3d-mobile-bottom-button" hideWhenActive />
    {layout.mobileHotbar.map(id => {
      const action = catalog.find(a => a.id === id);
      const active = id === "character" ? isCharacterSheetVisible : id === "inventory" ? inventory.visible : id === "log" ? isMobileLogVisible : id === "menu" ? isMobileActionSheetVisible : false;
      return <button key={id} data-nh3d-menu-anchor={id === "menu" || id === "extended" ? "actions" : undefined} type="button" className={`nh3d-mobile-bottom-button${active ? " is-active" : ""}`}
        disabled={!action || (id === "log" && !clientOptions.liveMessageLog)}
        aria-expanded={id === "menu" ? isMobileActionSheetVisible : id === "log" ? isMobileLogVisible : undefined}
        onClick={() => {
          if (!action) return;
          controller?.dismissFpsCrosshairContextMenu();
          if (id === "character") openCharacterDialog();
          else if (id === "inventory") { closeWizardCommands(); controller?.toggleInventoryDialog(); }
          else if (id === "log") {
            setIsMobileLogVisible(visible => !visible);
            setIsMobileActionSheetVisible(false); setMobileActionSheetMode("quick"); closeWizardCommands();
          } else if (id === "menu" || id === "extended") openActions(id === "extended");
          else runCustomCommand(controller, action);
        }}><ActionLabel>{action?.label ?? formatActionLabel(id.replace(/^command:/, ""))}</ActionLabel></button>;
    })}
    {!layout.mobileHotbar.includes("menu") ? <button className="nh3d-mobile-bottom-button" type="button" onClick={openButtonCustomization} aria-label="Customize hotbar">Hotbar</button> : null}
  </div>;
}
