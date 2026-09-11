import {
  createPortal
} from "react-dom";
import type * as React from "react";
import type {
  InventoryContextMenuState
} from "./types";
import {
  t
} from "../shared/translations";

export interface InventoryDropTypePortalProps {
  inventoryContextMenuOpen: boolean;
  inventoryDropTypeMenuPosition: { x: number; y: number; } | null;
  inventoryDropTypeMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  runInventoryDropTypeCommand: () => void;
  inventoryContextSupportsDropAmount: boolean;
  inventoryContextMenuRenderState: InventoryContextMenuState | null;
  openInventoryDropCountModal: (accelerator: string, itemText: string) => void;
}

export function InventoryDropTypePortal({
  inventoryContextMenuOpen,
  inventoryDropTypeMenuPosition,
  inventoryDropTypeMenuRef,
  runInventoryDropTypeCommand,
  inventoryContextSupportsDropAmount,
  inventoryContextMenuRenderState,
  openInventoryDropCountModal,
}: InventoryDropTypePortalProps) {
  return (
    inventoryContextMenuOpen &&
      inventoryDropTypeMenuPosition &&
      typeof document !== "undefined"
      ? createPortal(
        <div
          className="nh3d-context-menu nh3d-inventory-drop-type-menu"
          onContextMenu={(event) => event.preventDefault()}
          ref={inventoryDropTypeMenuRef}
          style={{
            left: `${inventoryDropTypeMenuPosition.x}px`,
            top: `${inventoryDropTypeMenuPosition.y}px`,
          }}
        >
          <div className="nh3d-context-menu-title">
            {t.dialogs.inventoryDropMenu.title}
          </div>
          <div className="nh3d-context-menu-actions">
            <button
              className="nh3d-context-menu-button"
              onClick={() => runInventoryDropTypeCommand()}
              type="button"
            >
              {t.dialogs.inventoryDropMenu.dropType}
            </button>
            <button
              className="nh3d-context-menu-button"
              disabled={
                !inventoryContextSupportsDropAmount ||
                !inventoryContextMenuRenderState
              }
              onClick={() => {
                if (!inventoryContextMenuRenderState) {
                  return;
                }
                openInventoryDropCountModal(
                  inventoryContextMenuRenderState.accelerator,
                  inventoryContextMenuRenderState.itemText,
                );
              }}
              title={
                inventoryContextSupportsDropAmount
                  ? t.dialogs.inventoryDropMenu.dropSpecificAmount
                  : t.dialogs.inventoryDropMenu.onlyStackedItems
              }
              type="button"
            >
              {t.dialogs.inventoryDropMenu.dropAmount}
            </button>
          </div>
        </div>,
        document.body,
      )
      : null
  );
}
