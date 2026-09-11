import {
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent
} from "react";
import type * as React from "react";
import type {
  InventoryContextAction,
  InventoryContextMenuState,
  InventoryDropCountDialogState
} from "./types";
import {
  inventoryDropTypeHoldThresholdMs,
  inventoryDropTypeMenuEstimatedHeightPx,
  inventoryDropTypeMenuEstimatedWidthPx,
  resolveInventoryDropTypeMenuPosition
} from "./position";
import {
  parseInventoryStackCount
} from "./actions";
import type { Nethack3DEngineController, InventoryDialogState } from "../../../game/ui-types";


export interface UseInventoryDropActionsDependencies {
  readonly setInventoryDropTypeMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly inventoryDropActionButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  readonly inventoryDropTypeHoldStateRef: React.MutableRefObject<{ pointerId: number; startedAtMs: number; triggered: boolean; } | null>;
  readonly inventoryDropTypeHoldAnimationFrameRef: React.MutableRefObject<number | null>;
  readonly inventorySuppressDropActionClickRef: React.MutableRefObject<boolean>;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly controller: Nethack3DEngineController | null;
  readonly setInventoryDropCountDialog: React.Dispatch<React.SetStateAction<InventoryDropCountDialogState | null>>;
  readonly setInventoryDropCountValue: React.Dispatch<React.SetStateAction<number>>;
  readonly inventoryDropCountMaxValue: number;
  readonly inventoryDropCountDialog: InventoryDropCountDialogState | null;
  readonly inventoryDropCountValue: number;
}

/** Drop type hold, drop amount dialog, submit and cleanup */
export function useInventoryDropActions(dependencies: UseInventoryDropActionsDependencies) {
  const {
    setInventoryDropTypeMenuPosition,
    inventoryDropActionButtonRef,
    inventoryDropTypeHoldStateRef,
    inventoryDropTypeHoldAnimationFrameRef,
    inventorySuppressDropActionClickRef,
    setInventoryContextMenu,
    controller,
    setInventoryDropCountDialog,
    setInventoryDropCountValue,
    inventoryDropCountMaxValue,
    inventoryDropCountDialog,
    inventoryDropCountValue,
  } = dependencies;

  const closeInventoryDropTypeMenu = useCallback((): void => {
    setInventoryDropTypeMenuPosition(null);
  }, []);

  const openInventoryDropTypeMenu = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    const anchorElement = inventoryDropActionButtonRef.current;
    if (!anchorElement) {
      return;
    }
    const anchorRect = anchorElement.getBoundingClientRect();
    const nextPosition = resolveInventoryDropTypeMenuPosition(
      anchorRect,
      inventoryDropTypeMenuEstimatedWidthPx,
      inventoryDropTypeMenuEstimatedHeightPx,
    );
    setInventoryDropTypeMenuPosition((previous) => {
      if (
        previous &&
        Math.abs(previous.x - nextPosition.x) < 0.02 &&
        Math.abs(previous.y - nextPosition.y) < 0.02
      ) {
        return previous;
      }
      return nextPosition;
    });
  }, []);

  const cancelInventoryDropTypeHold = useCallback((): void => {
    if (typeof window === "undefined") {
      inventoryDropTypeHoldStateRef.current = null;
      inventoryDropTypeHoldAnimationFrameRef.current = null;
      return;
    }
    const activeFrame = inventoryDropTypeHoldAnimationFrameRef.current;
    if (activeFrame !== null) {
      window.cancelAnimationFrame(activeFrame);
      inventoryDropTypeHoldAnimationFrameRef.current = null;
    }
    inventoryDropTypeHoldStateRef.current = null;
  }, []);

  const beginInventoryDropTypeHold = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      if (typeof window === "undefined") {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      inventorySuppressDropActionClickRef.current = false;
      cancelInventoryDropTypeHold();
      const holdState = {
        pointerId: event.pointerId,
        startedAtMs: performance.now(),
        triggered: false,
      };
      inventoryDropTypeHoldStateRef.current = holdState;
      const tick = (): void => {
        const activeState = inventoryDropTypeHoldStateRef.current;
        if (!activeState || activeState.pointerId !== holdState.pointerId) {
          inventoryDropTypeHoldAnimationFrameRef.current = null;
          return;
        }
        if (
          performance.now() - activeState.startedAtMs >=
          inventoryDropTypeHoldThresholdMs
        ) {
          activeState.triggered = true;
          inventorySuppressDropActionClickRef.current = true;
          inventoryDropTypeHoldAnimationFrameRef.current = null;
          openInventoryDropTypeMenu();
          return;
        }
        inventoryDropTypeHoldAnimationFrameRef.current =
          window.requestAnimationFrame(tick);
      };
      inventoryDropTypeHoldAnimationFrameRef.current =
        window.requestAnimationFrame(tick);
    },
    [cancelInventoryDropTypeHold, openInventoryDropTypeMenu],
  );

  const completeInventoryDropTypeHold = useCallback(
    (pointerId: number): void => {
      const holdState = inventoryDropTypeHoldStateRef.current;
      if (!holdState || holdState.pointerId !== pointerId) {
        return;
      }
      if (holdState.triggered) {
        inventorySuppressDropActionClickRef.current = true;
      }
      cancelInventoryDropTypeHold();
    },
    [cancelInventoryDropTypeHold],
  );

  const consumeInventoryDropActionClickSuppression =
    useCallback((): boolean => {
      if (!inventorySuppressDropActionClickRef.current) {
        return false;
      }
      inventorySuppressDropActionClickRef.current = false;
      return true;
    }, []);

  const runInventoryDropTypeCommand = useCallback((): void => {
    closeInventoryDropTypeMenu();
    setInventoryContextMenu(null);
    controller?.runExtendedCommand("droptype");
  }, [closeInventoryDropTypeMenu, controller]);

  const closeInventoryDropCountModal = useCallback((): void => {
    setInventoryDropCountDialog(null);
  }, []);

  const openInventoryDropCountModal = useCallback(
    (accelerator: string, itemText: string): void => {
      const stackCount = parseInventoryStackCount(itemText);
      if (!stackCount) {
        return;
      }
      closeInventoryDropTypeMenu();
      setInventoryContextMenu(null);
      setInventoryDropCountDialog({
        accelerator,
        itemText,
        maxCount: stackCount,
      });
      setInventoryDropCountValue(1);
    },
    [closeInventoryDropTypeMenu],
  );

  const clampInventoryDropCountValue = useCallback(
    (nextValue: number): number => {
      const normalized = Number.isFinite(nextValue) ? Math.trunc(nextValue) : 1;
      return Math.max(1, Math.min(inventoryDropCountMaxValue, normalized));
    },
    [inventoryDropCountMaxValue],
  );

  const stepInventoryDropCountValue = useCallback(
    (delta: number): void => {
      if (!Number.isFinite(delta) || delta === 0) {
        return;
      }
      setInventoryDropCountValue((previous) =>
        clampInventoryDropCountValue(previous + Math.trunc(delta)),
      );
    },
    [clampInventoryDropCountValue],
  );

  const submitInventoryDropCount = useCallback((): void => {
    if (!inventoryDropCountDialog) {
      return;
    }
    const amount = clampInventoryDropCountValue(inventoryDropCountValue);
    if (!controller) {
      closeInventoryDropCountModal();
      return;
    }
    controller.runInventoryItemDropCount(
      inventoryDropCountDialog.accelerator,
      amount,
    );
    closeInventoryDropCountModal();
  }, [
    clampInventoryDropCountValue,
    closeInventoryDropCountModal,
    controller,
    inventoryDropCountDialog,
    inventoryDropCountValue,
  ]);
  return {
    closeInventoryDropTypeMenu,
    openInventoryDropTypeMenu,
    cancelInventoryDropTypeHold,
    beginInventoryDropTypeHold,
    completeInventoryDropTypeHold,
    consumeInventoryDropActionClickSuppression,
    runInventoryDropTypeCommand,
    closeInventoryDropCountModal,
    openInventoryDropCountModal,
    clampInventoryDropCountValue,
    stepInventoryDropCountValue,
    submitInventoryDropCount,
  } as const;
}

export interface UseInventoryDropVisibilityDependencies {
  readonly inventory: InventoryDialogState;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly setInventoryDropTypeMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly setInventoryDropCountDialog: React.Dispatch<React.SetStateAction<InventoryDropCountDialogState | null>>;
  readonly cancelInventoryDropTypeHold: () => void;
  readonly inventorySuppressDropActionClickRef: React.MutableRefObject<boolean>;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
}

/** Drop type hold, drop amount dialog, submit and cleanup */
export function useInventoryDropVisibility(dependencies: UseInventoryDropVisibilityDependencies) {
  const {
    inventory,
    setInventoryContextMenu,
    setInventoryDropTypeMenuPosition,
    setInventoryDropCountDialog,
    cancelInventoryDropTypeHold,
    inventorySuppressDropActionClickRef,
    inventoryContextMenu,
  } = dependencies;

  useEffect(() => {
    if (!inventory.visible) {
      setInventoryContextMenu(null);
      setInventoryDropTypeMenuPosition(null);
      setInventoryDropCountDialog(null);
      cancelInventoryDropTypeHold();
      inventorySuppressDropActionClickRef.current = false;
    }
  }, [cancelInventoryDropTypeHold, inventory.visible]);

  useEffect(() => {
    if (inventoryContextMenu) {
      return;
    }
    setInventoryDropTypeMenuPosition(null);
    cancelInventoryDropTypeHold();
    inventorySuppressDropActionClickRef.current = false;
  }, [cancelInventoryDropTypeHold, inventoryContextMenu]);

}

export interface UseInventoryDropResetDependencies {
  readonly cancelInventoryDropTypeHold: () => void;
  readonly inventorySuppressDropActionClickRef: React.MutableRefObject<boolean>;
  readonly inventoryContextActionsEnabled: boolean;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly setInventoryDropTypeMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly setInventoryDropCountDialog: React.Dispatch<React.SetStateAction<InventoryDropCountDialogState | null>>;
  readonly inventoryDropTypeMenuPosition: { x: number; y: number; } | null;
  readonly inventoryContextMenuActions: InventoryContextAction[];
  readonly openInventoryDropTypeMenu: () => void;
  readonly inventoryDropCountDialog: InventoryDropCountDialogState | null;
  readonly inventoryDropCountSliderRef: React.MutableRefObject<HTMLInputElement | null>;
}

/** Drop type hold, drop amount dialog, submit and cleanup */
export function useInventoryDropReset(dependencies: UseInventoryDropResetDependencies) {
  const {
    cancelInventoryDropTypeHold,
    inventorySuppressDropActionClickRef,
    inventoryContextActionsEnabled,
    setInventoryContextMenu,
    setInventoryDropTypeMenuPosition,
    setInventoryDropCountDialog,
    inventoryDropTypeMenuPosition,
    inventoryContextMenuActions,
    openInventoryDropTypeMenu,
    inventoryDropCountDialog,
    inventoryDropCountSliderRef,
  } = dependencies;

  useEffect(
    () => () => {
      cancelInventoryDropTypeHold();
      inventorySuppressDropActionClickRef.current = false;
    },
    [cancelInventoryDropTypeHold],
  );

  useEffect(() => {
    if (inventoryContextActionsEnabled) {
      return;
    }
    setInventoryContextMenu(null);
    setInventoryDropTypeMenuPosition(null);
    setInventoryDropCountDialog(null);
    cancelInventoryDropTypeHold();
    inventorySuppressDropActionClickRef.current = false;
  }, [
    cancelInventoryDropTypeHold,
    inventoryContextActionsEnabled,
    setInventoryDropTypeMenuPosition,
  ]);

  useEffect(() => {
    if (!inventoryDropTypeMenuPosition) {
      return;
    }
    const hasDropAction = inventoryContextMenuActions.some(
      (action) => action.id === "drop",
    );
    if (!hasDropAction) {
      setInventoryDropTypeMenuPosition(null);
    }
  }, [inventoryContextMenuActions, inventoryDropTypeMenuPosition]);

  useEffect(() => {
    if (!inventoryDropTypeMenuPosition || typeof window === "undefined") {
      return;
    }
    const handleViewportResize = (): void => {
      openInventoryDropTypeMenu();
    };
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [inventoryDropTypeMenuPosition, openInventoryDropTypeMenu]);

  useEffect(() => {
    if (!inventoryDropCountDialog || typeof window === "undefined") {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      inventoryDropCountSliderRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [inventoryDropCountDialog]);

}
