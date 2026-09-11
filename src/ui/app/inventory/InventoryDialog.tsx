import {
  type CSSProperties
} from "react";
import type { NethackMenuItem, InventoryDialogState, Nethack3DEngineController, Nh3dInventoryFixedTileSizeMode } from "../../../game/ui-types";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  InventoryContextMenuState
} from "./types";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  isMenuItemTileApplicable,
  resolveMenuItemFallbackGlyph,
  resolveMenuItemTileIndex
} from "../tilesets/menu-glyphs";

export interface InventoryDialogProps {
  inventoryReducedMotionEnabled: boolean;
  inventoryAsciiModeEnabled: boolean;
  inventoryTileOnlyMotionEnabled: boolean;
  inventory: InventoryDialogState;
  inventoryDialogRef: React.MutableRefObject<HTMLDivElement | null>;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  controller: Nethack3DEngineController | null;
  inventoryFixedTileSizeMode: Nh3dInventoryFixedTileSizeMode;
  handleInventoryRowPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInventoryPointerUpdate: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInventoryPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInventoryPointerLeave: () => void;
  handleInventoryPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInventoryRowTouchStartCapture: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleInventoryTouchUpdate: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleInventoryTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleInventoryTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleInventoryTouchCancel: () => void;
  handleInventoryItemsScroll: () => void;
  inventoryItemsContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  inventoryFixedIconSizePx: 20 | 50 | 35;
  tilesUiEnabled: boolean;
  renderMenuItemTilePreview: (item: NethackMenuItem | null | undefined, tileId: number | null) => JSX.Element | null;
  inventoryContextMenu: InventoryContextMenuState | null;
  inventoryContextActionsEnabled: boolean;
  setInventoryRowRef: (index: number, element: HTMLDivElement | null) => void;
  inventoryUsesFullRowAnimation: boolean;
  beginInventoryRowPressCandidate: (source: "pointer" | "touch", pointerId: number, item: NethackMenuItem, accelerator: string, rowElement: HTMLDivElement | null, startClientX: number, startClientY: number) => void;
  setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  openInventoryContextMenu: (item: NethackMenuItem, clientX: number, clientY: number, anchorRect?: DOMRect | null | undefined, options?: { focusMenu?: boolean | undefined; } | undefined) => void;
  resolveInventoryContextNavigationDirection: (key: string, code?: string | undefined) => "left" | "right" | "up" | "down" | null;
  moveInventoryContextMenuActionFocus: (direction: "left" | "right" | "up" | "down") => boolean;
  moveInventoryItemFocusByArrowKey: (currentRow: HTMLDivElement, direction: "next" | "previous") => HTMLDivElement | null;
  normalizeInventoryActivationKey: (key: string) => "Enter" | "Space" | null;
  inventoryKeyboardActivationKeysDownRef: React.MutableRefObject<Set<string>>;
  inventoryCloseInstructionText: string;
}

export function InventoryDialog({
  inventoryReducedMotionEnabled,
  inventoryAsciiModeEnabled,
  inventoryTileOnlyMotionEnabled,
  inventory,
  inventoryDialogRef,
  renderMobileDialogCloseButton,
  controller,
  inventoryFixedTileSizeMode,
  handleInventoryRowPointerDownCapture,
  handleInventoryPointerUpdate,
  handleInventoryPointerCancel,
  handleInventoryPointerLeave,
  handleInventoryPointerUp,
  handleInventoryRowTouchStartCapture,
  handleInventoryTouchUpdate,
  handleInventoryTouchMove,
  handleInventoryTouchEnd,
  handleInventoryTouchCancel,
  handleInventoryItemsScroll,
  inventoryItemsContainerRef,
  inventoryFixedIconSizePx,
  tilesUiEnabled,
  renderMenuItemTilePreview,
  inventoryContextMenu,
  inventoryContextActionsEnabled,
  setInventoryRowRef,
  inventoryUsesFullRowAnimation,
  beginInventoryRowPressCandidate,
  setInventoryContextMenu,
  openInventoryContextMenu,
  resolveInventoryContextNavigationDirection,
  moveInventoryContextMenuActionFocus,
  moveInventoryItemFocusByArrowKey,
  normalizeInventoryActivationKey,
  inventoryKeyboardActivationKeysDownRef,
  inventoryCloseInstructionText,
}: InventoryDialogProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog nh3d-dialog-inventory nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close${inventoryReducedMotionEnabled
        ? " nh3d-dialog-inventory-reduced-motion"
        : ""
        }${inventoryAsciiModeEnabled ? " nh3d-dialog-inventory-ascii" : ""}${inventoryTileOnlyMotionEnabled
          ? " nh3d-dialog-inventory-tile-motion-only"
          : ""
        }`}
      open={inventory.visible}
      id="inventory-dialog"
      ref={inventoryDialogRef}
    >
      {renderMobileDialogCloseButton(
        () => controller?.closeInventoryDialog(),
        t.dialogs.inventory.closeLabel,
      )}
      <div className="nh3d-inventory-title">{t.dialogs.inventory.title}</div>
      <div className="nh3d-overflow-glow-frame nh3d-overflow-glow-shell-fill">
        <div
          className={`nh3d-inventory-items${inventoryReducedMotionEnabled
            ? " nh3d-inventory-items-fixed-size"
            : ""
            }`}
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
          data-nh3d-inv-fixed-size={inventoryFixedTileSizeMode}
          onPointerDownCapture={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryRowPointerDownCapture
          }
          onPointerDown={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryPointerUpdate
          }
          onPointerEnter={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryPointerUpdate
          }
          onPointerCancel={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryPointerCancel
          }
          onPointerLeave={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryPointerLeave
          }
          onPointerMove={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryPointerUpdate
          }
          onPointerUp={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryPointerUp
          }
          onTouchStartCapture={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryRowTouchStartCapture
          }
          onTouchStart={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryTouchUpdate
          }
          onTouchMove={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryTouchMove
          }
          onTouchEnd={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryTouchEnd
          }
          onTouchCancel={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryTouchCancel
          }
          onScroll={
            inventoryReducedMotionEnabled
              ? undefined
              : handleInventoryItemsScroll
          }
          ref={inventoryItemsContainerRef}
          style={
            inventoryReducedMotionEnabled
              ? ({
                "--nh3d-inv-fixed-icon-size-px": `${inventoryFixedIconSizePx}px`,
              } as CSSProperties)
              : undefined
          }
        >
          {inventory.items.length === 0 ? (
            <div className="nh3d-inventory-empty">
              {t.dialogs.inventory.empty}
            </div>
          ) : (
            inventory.items.map((item, index) => {
              if (item.isCategory) {
                return (
                  <div
                    className={`nh3d-inventory-category${index === 0 ? " nh3d-inventory-category-first" : ""
                      }`}
                    key={`cat-${index}`}
                  >
                    {item.text}
                  </div>
                );
              }

              const tileApplicable = isMenuItemTileApplicable(item);
              const tileIndex =
                tilesUiEnabled && tileApplicable
                  ? resolveMenuItemTileIndex(item)
                  : null;
              const tilePreview = renderMenuItemTilePreview(item, tileIndex);
              const fallbackGlyph = resolveMenuItemFallbackGlyph(item);
              const itemAccelerator =
                typeof item.accelerator === "string"
                  ? item.accelerator.trim()
                  : "";
              const isContextMenuItemActive =
                inventoryContextMenu?.accelerator === itemAccelerator;
              const showInventoryTileIcon =
                tilesUiEnabled &&
                tileApplicable &&
                (!inventoryReducedMotionEnabled ||
                  inventoryFixedTileSizeMode !== "none");

              return (
                <div
                  className={`nh3d-inventory-item${!inventoryContextActionsEnabled
                    ? " nh3d-inventory-item-disabled"
                    : ""
                    }${isContextMenuItemActive
                      ? " nh3d-inventory-item-active"
                      : ""
                    }`}
                  data-nh3d-accelerator={itemAccelerator}
                  key={`item-${index}`}
                  ref={(element) => {
                    setInventoryRowRef(index, element);
                  }}
                  style={
                    inventoryTileOnlyMotionEnabled
                      ? ({
                        "--nh3d-inv-row-order": String(index + 1),
                      } as CSSProperties)
                      : undefined
                  }
                  onPointerDown={(event) => {
                    if (!inventoryUsesFullRowAnimation) {
                      return;
                    }
                    if (event.pointerType === "mouse" && event.button !== 0) {
                      return;
                    }
                    beginInventoryRowPressCandidate(
                      "pointer",
                      event.pointerId,
                      item,
                      itemAccelerator,
                      event.currentTarget,
                      event.clientX,
                      event.clientY,
                    );
                  }}
                  onTouchStart={(event) => {
                    if (!inventoryUsesFullRowAnimation) {
                      return;
                    }
                    const primaryTouch =
                      event.changedTouches[0] ?? event.touches[0];
                    if (!primaryTouch) {
                      return;
                    }
                    beginInventoryRowPressCandidate(
                      "touch",
                      primaryTouch.identifier,
                      item,
                      itemAccelerator,
                      event.currentTarget,
                      primaryTouch.clientX,
                      primaryTouch.clientY,
                    );
                  }}
                  onClick={(event) => {
                    if (!inventoryContextActionsEnabled) {
                      return;
                    }
                    if (isContextMenuItemActive) {
                      setInventoryContextMenu(null);
                      return;
                    }
                    const targetRect =
                      event.currentTarget.getBoundingClientRect();
                    openInventoryContextMenu(
                      item,
                      event.clientX,
                      event.clientY,
                      targetRect,
                    );
                  }}
                  onContextMenu={(event) => {
                    if (!inventoryContextActionsEnabled) {
                      return;
                    }
                    event.preventDefault();
                    const targetRect =
                      event.currentTarget.getBoundingClientRect();
                    openInventoryContextMenu(
                      item,
                      event.clientX,
                      event.clientY,
                      targetRect,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (!inventoryContextActionsEnabled) {
                      return;
                    }
                    const moveDirection =
                      resolveInventoryContextNavigationDirection(
                        event.key,
                        event.code,
                      );
                    if (moveDirection) {
                      event.preventDefault();
                      event.stopPropagation();
                      if (inventoryContextMenu) {
                        moveInventoryContextMenuActionFocus(moveDirection);
                        return;
                      }
                      moveInventoryItemFocusByArrowKey(
                        event.currentTarget,
                        moveDirection === "up" || moveDirection === "left"
                          ? "previous"
                          : "next",
                      );
                      return;
                    }

                    const activationKey = normalizeInventoryActivationKey(
                      event.key,
                    );
                    if (!activationKey) {
                      return;
                    }

                    if (
                      inventoryKeyboardActivationKeysDownRef.current.has(
                        activationKey,
                      )
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                    inventoryKeyboardActivationKeysDownRef.current.add(
                      activationKey,
                    );
                    event.preventDefault();
                    event.stopPropagation();

                    const target =
                      event.currentTarget.getBoundingClientRect();
                    openInventoryContextMenu(
                      item,
                      target.right,
                      target.top + target.height / 2,
                      target,
                      { focusMenu: true },
                    );
                  }}
                  role={inventoryContextActionsEnabled ? "button" : undefined}
                  tabIndex={inventoryContextActionsEnabled ? 0 : -1}
                >
                  <span className="nh3d-inventory-item-leading">
                    {showInventoryTileIcon ? (
                      <span
                        className="nh3d-inventory-icon-anchor"
                        aria-hidden="true"
                      >
                        <span className="nh3d-inventory-icon-shell">
                          {tilePreview ? (
                            <span className="nh3d-inventory-icon-art">
                              {tilePreview}
                            </span>
                          ) : (
                            <span className="nh3d-inventory-icon-fallback">
                              {fallbackGlyph}
                            </span>
                          )}
                        </span>
                      </span>
                    ) : null}
                    <span className="nh3d-inventory-key">
                      {item.accelerator || "?"})
                    </span>
                  </span>
                  <span className={item.className as string}>
                    {item.text || t.dialogs.inventory.unknownItem}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="nh3d-inventory-close">
        {inventoryCloseInstructionText}
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={() => controller?.closeInventoryDialog()}
          type="button"
        >
          {commonStrings.close}
        </button>
      </div>
    </AnimatedDialog>
  );
}
