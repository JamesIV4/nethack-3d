import {
  useCallback
} from "react";
import type {
  NethackMenuItem
} from "../../../game/ui-types";
import type * as React from "react";
import type {
  InventoryContextMenuState
} from "./types";
import {
  clampInventoryContextMenuPosition,
  inventoryContextMenuAnchorBottomGapPx,
  inventoryContextMenuAnchorGapPx,
  resolveInventoryContextMenuPosition
} from "./position";
import {
  t
} from "../shared/translations";

export interface UseInventoryNavigationFocusDependencies {
  readonly inventoryRowRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  readonly inventoryContextMenuStateRef: React.MutableRefObject<InventoryContextMenuState | null>;
  readonly inventoryContextMenuKeyboardOpenPendingRef: React.MutableRefObject<boolean>;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly setInventoryDropTypeMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
}

/** Inventory focus, context action navigation and context-menu opening */
export function useInventoryNavigationFocus(dependencies: UseInventoryNavigationFocusDependencies) {
  const {
    inventoryRowRefs,
    inventoryContextMenuStateRef,
    inventoryContextMenuKeyboardOpenPendingRef,
    setInventoryContextMenu,
    setInventoryDropTypeMenuPosition,
  } = dependencies;

  const focusInventoryItemByAccelerator = useCallback(
    (accelerator: string): void => {
      const normalizedAccelerator = String(accelerator || "").trim();
      if (!normalizedAccelerator) {
        return;
      }
      const focusTargetRow = (): void => {
        let targetRow: HTMLDivElement | null = null;
        for (const rowElement of inventoryRowRefs.current.values()) {
          const rowAccelerator = String(
            rowElement.dataset.nh3dAccelerator || "",
          ).trim();
          if (rowAccelerator === normalizedAccelerator) {
            targetRow = rowElement;
            break;
          }
        }
        if (!targetRow || !targetRow.isConnected) {
          return;
        }
        targetRow.focus({ preventScroll: true });
        targetRow.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      if (typeof window === "undefined") {
        focusTargetRow();
        return;
      }
      window.requestAnimationFrame(focusTargetRow);
    },
    [],
  );

  const moveInventoryItemFocusByArrowKey = useCallback(
    (
      currentRow: HTMLDivElement,
      direction: "previous" | "next",
    ): HTMLDivElement | null => {
      const focusableRows = Array.from(inventoryRowRefs.current.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([, rowElement]) => rowElement)
        .filter(
          (rowElement) =>
            rowElement.isConnected &&
            !rowElement.classList.contains("nh3d-inventory-item-disabled"),
        );
      if (focusableRows.length === 0) {
        return null;
      }

      const currentIndex = focusableRows.findIndex(
        (rowElement) => rowElement === currentRow,
      );
      const delta = direction === "previous" ? -1 : 1;
      const targetIndex =
        currentIndex < 0
          ? delta > 0
            ? 0
            : focusableRows.length - 1
          : (((currentIndex + delta) % focusableRows.length) +
            focusableRows.length) %
          focusableRows.length;
      const targetRow = focusableRows[targetIndex] ?? null;
      if (!targetRow) {
        return null;
      }
      targetRow.focus({ preventScroll: true });
      targetRow.scrollIntoView({ block: "nearest", inline: "nearest" });
      return targetRow;
    },
    [],
  );

  const closeInventoryContextMenu = useCallback(
    (options?: { restoreItemFocus?: boolean }): void => {
      const shouldRestoreItemFocus = options?.restoreItemFocus === true;
      const activeContextMenu = inventoryContextMenuStateRef.current;
      inventoryContextMenuKeyboardOpenPendingRef.current = false;
      setInventoryContextMenu(null);
      setInventoryDropTypeMenuPosition(null);
      if (shouldRestoreItemFocus && activeContextMenu?.accelerator) {
        focusInventoryItemByAccelerator(activeContextMenu.accelerator);
      }
    },
    [focusInventoryItemByAccelerator],
  );
  return {
    moveInventoryItemFocusByArrowKey,
    closeInventoryContextMenu,
  } as const;
}

export interface UseInventoryNavigationContextDependencies {
  readonly inventoryContextMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly inventoryContextMenuKeyboardOpenPendingRef: React.MutableRefObject<boolean>;
  readonly setInventoryDropTypeMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly inventoryContextActionsEnabled: boolean;
  readonly getInventoryContextMenuClampRegion: () => DOMRect | null;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
}

/** Inventory focus, context action navigation and context-menu opening */
export function useInventoryNavigationContext(dependencies: UseInventoryNavigationContextDependencies) {
  const {
    inventoryContextMenuRef,
    inventoryContextMenuKeyboardOpenPendingRef,
    setInventoryDropTypeMenuPosition,
    inventoryContextActionsEnabled,
    getInventoryContextMenuClampRegion,
    setInventoryContextMenu,
  } = dependencies;

  const resolveInventoryContextNavigationDirection = useCallback(
    (key: string, code?: string): "up" | "down" | "left" | "right" | null => {
      switch (key) {
        case "ArrowUp":
        case "PageUp":
        case "k":
        case "K":
        case "y":
        case "Y":
        case "u":
        case "U":
          return "up";
        case "ArrowDown":
        case "PageDown":
        case "j":
        case "J":
        case "b":
        case "B":
        case "n":
        case "N":
          return "down";
        case "ArrowLeft":
        case "h":
        case "H":
          return "left";
        case "ArrowRight":
        case "l":
        case "L":
          return "right";
        default:
          break;
      }
      switch (code) {
        case "Numpad8":
        case "Numpad7":
        case "Numpad9":
          return "up";
        case "Numpad2":
        case "Numpad1":
        case "Numpad3":
          return "down";
        case "Numpad4":
          return "left";
        case "Numpad6":
          return "right";
        default:
          return null;
      }
    },
    [],
  );

  const moveInventoryContextMenuActionFocus = useCallback(
    (direction: "up" | "down" | "left" | "right"): boolean => {
      const actionButtons =
        inventoryContextMenuRef.current?.querySelectorAll<HTMLButtonElement>(
          ".nh3d-context-menu-button:not(:disabled)",
        ) ?? null;
      if (!actionButtons || actionButtons.length === 0) {
        return false;
      }
      const focusableButtons = Array.from(actionButtons).filter(
        (button) => button.isConnected,
      );
      if (focusableButtons.length === 0) {
        return false;
      }

      const measuredButtons = focusableButtons
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            button,
            centerX: rect.left + rect.width * 0.5,
            centerY: rect.top + rect.height * 0.5,
          };
        })
        .sort((left, right) =>
          left.centerY === right.centerY
            ? left.centerX - right.centerX
            : left.centerY - right.centerY,
        );
      const rows: Array<{
        centerY: number;
        items: Array<{
          button: HTMLButtonElement;
          centerX: number;
          centerY: number;
        }>;
      }> = [];
      const rowTolerancePx = 12;
      for (const measured of measuredButtons) {
        const lastRow = rows[rows.length - 1];
        if (
          lastRow &&
          Math.abs(measured.centerY - lastRow.centerY) <= rowTolerancePx
        ) {
          lastRow.items.push(measured);
          const rowSize = lastRow.items.length;
          lastRow.centerY =
            (lastRow.centerY * (rowSize - 1) + measured.centerY) / rowSize;
        } else {
          rows.push({
            centerY: measured.centerY,
            items: [measured],
          });
        }
      }
      for (const row of rows) {
        row.items.sort((left, right) => left.centerX - right.centerX);
      }

      const activeElement =
        typeof document !== "undefined" &&
          document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const focusLinear = (delta: -1 | 1): HTMLButtonElement | null => {
        const activeIndex = activeElement
          ? focusableButtons.findIndex((button) => button === activeElement)
          : -1;
        const targetIndex =
          activeIndex < 0
            ? delta > 0
              ? 0
              : focusableButtons.length - 1
            : (((activeIndex + delta) % focusableButtons.length) +
              focusableButtons.length) %
            focusableButtons.length;
        return focusableButtons[targetIndex] ?? null;
      };

      const hasMultipleColumns = rows.some((row) => row.items.length > 1);
      let targetButton: HTMLButtonElement | null = null;
      if (rows.length > 0 && hasMultipleColumns) {
        let activeRowIndex = -1;
        let activeColumnIndex = -1;
        let activeCenterX = Number.NaN;
        if (activeElement) {
          for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            const columnIndex = rows[rowIndex].items.findIndex(
              (item) => item.button === activeElement,
            );
            if (columnIndex >= 0) {
              activeRowIndex = rowIndex;
              activeColumnIndex = columnIndex;
              activeCenterX = rows[rowIndex].items[columnIndex].centerX;
              break;
            }
          }
        }

        if (activeRowIndex < 0 || activeColumnIndex < 0) {
          if (direction === "up" || direction === "left") {
            const lastRow = rows[rows.length - 1];
            targetButton =
              lastRow.items[lastRow.items.length - 1]?.button ?? null;
          } else {
            targetButton = rows[0].items[0]?.button ?? null;
          }
        } else if (direction === "right") {
          const currentRow = rows[activeRowIndex];
          if (activeColumnIndex < currentRow.items.length - 1) {
            targetButton =
              currentRow.items[activeColumnIndex + 1]?.button ?? null;
          } else if (activeRowIndex < rows.length - 1) {
            targetButton = rows[activeRowIndex + 1].items[0]?.button ?? null;
          } else {
            targetButton = rows[0].items[0]?.button ?? null;
          }
        } else if (direction === "left") {
          const currentRow = rows[activeRowIndex];
          if (activeColumnIndex > 0) {
            targetButton =
              currentRow.items[activeColumnIndex - 1]?.button ?? null;
          } else if (activeRowIndex > 0) {
            const previousRow = rows[activeRowIndex - 1];
            targetButton =
              previousRow.items[previousRow.items.length - 1]?.button ?? null;
          } else {
            const lastRow = rows[rows.length - 1];
            targetButton =
              lastRow.items[lastRow.items.length - 1]?.button ?? null;
          }
        } else {
          const rowDelta = direction === "up" ? -1 : 1;
          let nextRowIndex = activeRowIndex + rowDelta;
          if (nextRowIndex < 0) {
            nextRowIndex = rows.length - 1;
          } else if (nextRowIndex >= rows.length) {
            nextRowIndex = 0;
          }
          const nextRow = rows[nextRowIndex];
          targetButton =
            nextRow.items.reduce<{
              button: HTMLButtonElement;
              distance: number;
            } | null>((best, item) => {
              const distance = Math.abs(item.centerX - activeCenterX);
              if (!best || distance < best.distance) {
                return { button: item.button, distance };
              }
              return best;
            }, null)?.button ?? null;
        }
      }
      if (!targetButton) {
        const linearDelta = direction === "up" || direction === "left" ? -1 : 1;
        targetButton = focusLinear(linearDelta);
      }
      if (!targetButton) {
        return false;
      }
      targetButton.focus({ preventScroll: true });
      targetButton.scrollIntoView({ block: "nearest", inline: "nearest" });
      return true;
    },
    [],
  );

  const openInventoryContextMenu = (
    item: NethackMenuItem,
    clientX: number,
    clientY: number,
    anchorRect?: DOMRect | null,
    options?: { focusMenu?: boolean },
  ): void => {
    inventoryContextMenuKeyboardOpenPendingRef.current =
      options?.focusMenu === true;
    setInventoryDropTypeMenuPosition(null);
    if (!inventoryContextActionsEnabled) {
      return;
    }
    if (typeof item.accelerator !== "string") {
      return;
    }
    const itemAccelerator = item.accelerator.trim();
    if (!itemAccelerator) {
      return;
    }

    const estimatedMenuWidthPx = 220;
    const estimatedMenuHeightPx = 260;
    const pointerOffsetPx = 8;
    let anchorCenterX: number | undefined;
    let anchorLeftX: number | undefined;
    let anchorBottomY: number | undefined;
    let anchorRightX: number | undefined;
    let anchorTopY: number | undefined;

    let initial = clampInventoryContextMenuPosition(
      clientX + pointerOffsetPx,
      clientY + pointerOffsetPx,
      estimatedMenuWidthPx,
      estimatedMenuHeightPx,
    );

    if (anchorRect) {
      const anchorRectLeft = Number.isFinite(anchorRect.left)
        ? anchorRect.left
        : null;
      const anchorRectRight = Number.isFinite(anchorRect.right)
        ? anchorRect.right
        : null;
      if (anchorRectLeft !== null && anchorRectRight !== null) {
        anchorCenterX = Math.min(
          Math.max(clientX, anchorRectLeft),
          anchorRectRight,
        );
      }
      if (Number.isFinite(anchorRect.left)) {
        anchorLeftX = anchorRect.left - inventoryContextMenuAnchorGapPx;
      }
      if (Number.isFinite(anchorRect.right)) {
        anchorRightX = anchorRect.right + inventoryContextMenuAnchorGapPx;
      }
      if (Number.isFinite(anchorRect.top)) {
        anchorTopY = anchorRect.top - inventoryContextMenuAnchorBottomGapPx;
      }
      if (Number.isFinite(anchorRect.bottom)) {
        anchorBottomY =
          anchorRect.bottom + inventoryContextMenuAnchorBottomGapPx;
      }
      const preferredRightX =
        typeof anchorRightX === "number" && Number.isFinite(anchorRightX)
          ? anchorRightX
          : clientX + pointerOffsetPx;
      const preferredRightY =
        typeof anchorBottomY === "number" && Number.isFinite(anchorBottomY)
          ? anchorBottomY
          : clientY + pointerOffsetPx;
      const preferredLeftX =
        typeof anchorCenterX === "number" && Number.isFinite(anchorCenterX)
          ? anchorCenterX - estimatedMenuWidthPx * 0.5
          : preferredRightX;
      const belowCandidate = clampInventoryContextMenuPosition(
        preferredLeftX,
        preferredRightY,
        estimatedMenuWidthPx,
        estimatedMenuHeightPx,
      );

      initial = belowCandidate;
    }
    const initialWithRegionClamp = resolveInventoryContextMenuPosition(
      {
        accelerator: itemAccelerator,
        itemText: String(item.text || t.dialogs.inventory.unknownItem),
        x: initial.x,
        y: initial.y,
        anchorCenterX,
        anchorLeftX,
        anchorBottomY,
        anchorRightX,
        anchorTopY,
      },
      estimatedMenuWidthPx,
      estimatedMenuHeightPx,
      getInventoryContextMenuClampRegion(),
    );

    setInventoryContextMenu({
      accelerator: itemAccelerator,
      itemText: String(item.text || t.dialogs.inventory.unknownItem),
      x: initialWithRegionClamp.x,
      y: initialWithRegionClamp.y,
      anchorCenterX,
      anchorLeftX,
      anchorBottomY,
      anchorRightX,
      anchorTopY,
    });
  };
  return {
    resolveInventoryContextNavigationDirection,
    moveInventoryContextMenuActionFocus,
    openInventoryContextMenu,
  } as const;
}
