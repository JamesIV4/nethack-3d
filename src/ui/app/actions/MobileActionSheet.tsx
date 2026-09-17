import { useActionLayout } from "./action-layout";
import { actionCatalog, formatActionLabel } from "./action-catalog";
import { ActionLabel } from "./ActionLabel";
import type * as React from "react";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";
import {
  commonStrings,
  t
} from "../shared/translations";
import type { Nethack3DEngineController } from "../../../game/ui-types";


export interface MobileActionSheetProps {
  openButtonCustomization: () => void;
  mobileTouchUiVisible: boolean;
  isMobileActionSheetVisible: boolean;
  mobileActionSheetMode: MobileActionSheetMode;
  setMobileActionSheetMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  openPauseMenu: () => void;
  setIsMobileActionSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  controller: Nethack3DEngineController | null;
  mobileCommonExtendedCommandNames: string[];
  mobileExtendedCommandNames: string[];
}

export function MobileActionSheet({
  openButtonCustomization,
  mobileTouchUiVisible,
  isMobileActionSheetVisible,
  mobileActionSheetMode,
  setMobileActionSheetMode,
  openPauseMenu,
  setIsMobileActionSheetVisible,
  controller,
  mobileCommonExtendedCommandNames,
  mobileExtendedCommandNames,
}: MobileActionSheetProps) {
  const layout = useActionLayout();
  const catalog = actionCatalog(mobileExtendedCommandNames);
  const actions = layout.menuActions.map(id => catalog.find(a => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  return (
    mobileTouchUiVisible && isMobileActionSheetVisible ? (
      <div className="nh3d-mobile-actions-sheet">
        <div className="nh3d-mobile-actions-title-row">
          <div className="nh3d-mobile-actions-title">
            {mobileActionSheetMode === "quick"
              ? t.dialogs.mobileActions.actions
              : t.dialogs.mobileActions.extendedCommands}
          </div>
          <div className="nh3d-mobile-actions-controls">
            {mobileActionSheetMode === "quick" ? <button type="button" className="nh3d-mobile-actions-back" onClick={openButtonCustomization}>Customize</button> : null}
            {mobileActionSheetMode === "extended" ? (
              <button
                className="nh3d-mobile-actions-back"
                onClick={() => setMobileActionSheetMode("quick")}
                type="button"
              >
                {commonStrings.back}
              </button>
            ) : null}

            <div className="nh3d-mobile-actions-divider" />

            <button
              className="nh3d-mobile-actions-back"
              onClick={openPauseMenu}
              type="button"
            >
              {t.dialogs.mobileActions.menu}
            </button>

            <button
              className="nh3d-mobile-actions-close"
              onClick={() => {
                setIsMobileActionSheetVisible(false);
                setMobileActionSheetMode("quick");
              }}
              type="button"
            >
              {t.dialogs.mobileActions.close}
            </button>
          </div>
        </div>
        {mobileActionSheetMode === "quick" ? (
          <div className="nh3d-overflow-glow-frame">
            <div
              className="nh3d-mobile-actions-grid is-fixed-layout"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
              {actions.map((action) => (
                <button
                  className="nh3d-mobile-actions-button"
                  key={action.id}
                  onClick={() => {
                    controller?.dismissFpsCrosshairContextMenu();
                    if (action.id === "extended") {
                      setMobileActionSheetMode("extended");
                      return;
                    }
                    if (action.kind === "quick") {
                      controller?.runQuickAction(action.value);
                    } else {
                      controller?.runExtendedCommand(action.value);
                    }
                    setIsMobileActionSheetVisible(false);
                    setMobileActionSheetMode("quick");
                  }}
                  type="button"
                >
                  <ActionLabel>{action.label}</ActionLabel>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="nh3d-overflow-glow-frame">
            <div
              className="nh3d-mobile-actions-sections"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
              {mobileCommonExtendedCommandNames.length > 0 ? (
                <div className="nh3d-mobile-actions-section">
                  <div className="nh3d-mobile-actions-subheader">
                    {t.dialogs.mobileActions.commonCommands}
                  </div>
                  <div className="nh3d-mobile-actions-grid is-extended">
                    {mobileCommonExtendedCommandNames.map((command) => (
                      <button
                        className="nh3d-mobile-actions-button"
                        key={`common-${command}`}
                        onClick={() => {
                          controller?.dismissFpsCrosshairContextMenu();
                          controller?.runExtendedCommand(command);
                          setIsMobileActionSheetVisible(false);
                          setMobileActionSheetMode("quick");
                        }}
                        type="button"
                      >
                        <ActionLabel>{formatActionLabel(command)}</ActionLabel>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="nh3d-mobile-actions-section">
                <div className="nh3d-mobile-actions-subheader">
                  {t.dialogs.mobileActions.allCommands}
                </div>
                <div className="nh3d-mobile-actions-grid is-extended">
                  {mobileExtendedCommandNames.map((command) => (
                    <button
                      className="nh3d-mobile-actions-button"
                      key={`all-${command}`}
                      onClick={() => {
                        controller?.dismissFpsCrosshairContextMenu();
                        controller?.runExtendedCommand(command);
                        setIsMobileActionSheetVisible(false);
                        setMobileActionSheetMode("quick");
                      }}
                      type="button"
                    >
                      <ActionLabel>{formatActionLabel(command)}</ActionLabel>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    ) : null
  );
}
