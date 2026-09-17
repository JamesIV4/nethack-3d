import {
  type CSSProperties
} from "react";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  InventoryContextAction,
  InventoryContextMenuState
} from "./types";
import type { Nethack3DEngineController } from "../../../game/ui-types";


export interface InventoryContextMenuProps {
  resolveInventoryContextNavigationDirection: (key: string, code?: string | undefined) => "left" | "right" | "up" | "down" | null;
  moveInventoryContextMenuActionFocus: (direction: "left" | "right" | "up" | "down") => boolean;
  inventoryDropTypeMenuPosition: { x: number; y: number; } | null;
  closeInventoryDropTypeMenu: () => void;
  inventorySuppressDropActionClickRef: React.MutableRefObject<boolean>;
  cancelInventoryDropTypeHold: () => void;
  closeInventoryContextMenu: (options?: { restoreItemFocus?: boolean | undefined; } | undefined) => void;
  inventoryContextMenuOpen: boolean;
  inventoryContextMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  inventoryContextMenuRenderState: InventoryContextMenuState | null;
  inventoryContextTitleScroll: { containerRef: React.MutableRefObject<HTMLDivElement | null>; primaryTextRef: React.MutableRefObject<HTMLSpanElement | null>; shouldScroll: boolean; style: React.CSSProperties | undefined; };
  inventoryContextTitleAnimationKey: string;
  inventoryContextTitle: string;
  inventoryContextMenuActions: InventoryContextAction[];
  consumeInventoryDropActionClickSuppression: () => boolean;
  controller: Nethack3DEngineController | null;
  setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  openInventoryDropTypeMenu: () => void;
  completeInventoryDropTypeHold: (pointerId: number) => void;
  beginInventoryDropTypeHold: (event: React.PointerEvent<HTMLButtonElement>) => void;
  inventoryDropTypeHoldStateRef: React.MutableRefObject<{ pointerId: number; startedAtMs: number; triggered: boolean; } | null>;
  inventoryDropActionButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}

export function shouldOpenInventoryDropTypeMenuOnHover(
  documentElement: Pick<HTMLElement, "classList"> | null =
    typeof document === "undefined" ? null : document.documentElement,
): boolean {
  return !documentElement?.classList.contains("nh3d-webxr-active");
}

export function InventoryContextMenu({
  resolveInventoryContextNavigationDirection,
  moveInventoryContextMenuActionFocus,
  inventoryDropTypeMenuPosition,
  closeInventoryDropTypeMenu,
  inventorySuppressDropActionClickRef,
  cancelInventoryDropTypeHold,
  closeInventoryContextMenu,
  inventoryContextMenuOpen,
  inventoryContextMenuRef,
  inventoryContextMenuRenderState,
  inventoryContextTitleScroll,
  inventoryContextTitleAnimationKey,
  inventoryContextTitle,
  inventoryContextMenuActions,
  consumeInventoryDropActionClickSuppression,
  controller,
  setInventoryContextMenu,
  openInventoryDropTypeMenu,
  completeInventoryDropTypeHold,
  beginInventoryDropTypeHold,
  inventoryDropTypeHoldStateRef,
  inventoryDropActionButtonRef,
}: InventoryContextMenuProps) {
  const openDropTypeMenuOnHover = shouldOpenInventoryDropTypeMenuOnHover();
  return (
    <AnimatedDialog
      className="nh3d-context-menu nh3d-inventory-context-menu nh3d-overflow-glow-frame"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        const moveDirection = resolveInventoryContextNavigationDirection(
          event.key,
          event.code,
        );
        if (moveDirection) {
          event.preventDefault();
          event.stopPropagation();
          moveInventoryContextMenuActionFocus(moveDirection);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (inventoryDropTypeMenuPosition) {
            closeInventoryDropTypeMenu();
            inventorySuppressDropActionClickRef.current = false;
            cancelInventoryDropTypeHold();
            return;
          }
          closeInventoryContextMenu({ restoreItemFocus: true });
        }
      }}
      open={inventoryContextMenuOpen}
      ref={inventoryContextMenuRef}
      style={
        inventoryContextMenuRenderState
          ? {
            left: `${inventoryContextMenuRenderState.x}px`,
            top: `${inventoryContextMenuRenderState.y}px`,
          }
          : undefined
      }
    >
      {inventoryContextMenuRenderState ? (
        <div
          className="nh3d-inventory-context-menu-scroll"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
        >
          <div
            className={`nh3d-context-menu-title${inventoryContextTitleScroll.shouldScroll
              ? " nh3d-context-menu-title-scroll"
              : ""
              }`}
            ref={inventoryContextTitleScroll.containerRef}
            style={inventoryContextTitleScroll.style}
          >
            {inventoryContextTitleScroll.shouldScroll ? (
              <span
                className="nh3d-context-menu-title-scroll-track"
                key={inventoryContextTitleAnimationKey}
              >
                <span ref={inventoryContextTitleScroll.primaryTextRef}>
                  {inventoryContextTitle}
                </span>
                <span aria-hidden="true">{inventoryContextTitle}</span>
              </span>
            ) : (
              <span
                className="nh3d-context-menu-title-text"
                ref={inventoryContextTitleScroll.primaryTextRef}
              >
                {inventoryContextTitle}
              </span>
            )}
          </div>
          <div className="nh3d-context-menu-actions nh3d-context-menu-actions-inventory">
            {inventoryContextMenuActions.map((action) => {
              const isDropAction = action.id === "drop";
              return (
                <button
                  aria-haspopup={isDropAction ? "menu" : undefined}
                  className={`nh3d-context-menu-button${isDropAction && inventoryDropTypeMenuPosition
                    ? " is-drop-type-open"
                    : ""
                    }`}
                  key={`inventory-${inventoryContextMenuRenderState.accelerator}-${action.id}`}
                  onClick={() => {
                    if (
                      isDropAction &&
                      consumeInventoryDropActionClickSuppression()
                    ) {
                      return;
                    }
                    closeInventoryDropTypeMenu();
                    if (action.kind === "extended" && action.value) {
                      if (action.armInventorySelection !== false) {
                        // Use the special prefix to ensure the runtime intercepts it and reliably
                        // applies it to the next inventory prompt menu without race conditions.
                        controller?.sendInput(
                          `__INVCTX_SELECT__:${inventoryContextMenuRenderState.accelerator}:${action.id}`,
                        );
                      }
                      controller?.runExtendedCommand(action.value, {
                        forceHashSubmission: true,
                      });
                    } else {
                      controller?.runInventoryItemAction(
                        action.id,
                        inventoryContextMenuRenderState.accelerator,
                      );
                    }
                    setInventoryContextMenu(null);
                  }}
                  onMouseEnter={
                    isDropAction && openDropTypeMenuOnHover
                      ? () => openInventoryDropTypeMenu()
                      : undefined
                  }
                  onPointerCancel={
                    isDropAction
                      ? (event) => {
                        completeInventoryDropTypeHold(event.pointerId);
                      }
                      : undefined
                  }
                  onPointerDown={
                    isDropAction
                      ? (event) => {
                        beginInventoryDropTypeHold(event);
                      }
                      : undefined
                  }
                  onPointerLeave={
                    isDropAction
                      ? (event) => {
                        const holdState =
                          inventoryDropTypeHoldStateRef.current;
                        if (
                          holdState &&
                          holdState.pointerId === event.pointerId
                        ) {
                          cancelInventoryDropTypeHold();
                        }
                      }
                      : undefined
                  }
                  onPointerUp={
                    isDropAction
                      ? (event) => {
                        completeInventoryDropTypeHold(event.pointerId);
                      }
                      : undefined
                  }
                  ref={
                    isDropAction
                      ? (element) => {
                        inventoryDropActionButtonRef.current = element;
                      }
                      : undefined
                  }
                  type="button"
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </AnimatedDialog>
  );
}
