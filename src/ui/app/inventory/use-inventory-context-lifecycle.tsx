import {
  useEffect,
  useLayoutEffect
} from "react";
import { nh3dCloseInventoryContextMenuEventName, type InventoryDialogState } from "../../../game/ui-types";
import type * as React from "react";
import type {
  InventoryContextMenuState
} from "./types";
import {
  resolveInventoryContextMenuPosition,
  resolveInventoryDropTypeMenuPosition
} from "./position";

export interface UseInventoryContextLifecycleStateSyncDependencies {
  readonly closeInventoryContextMenu: (options?: { restoreItemFocus?: boolean | undefined; } | undefined) => void;
}

/** Dismiss listeners, resize positioning and activation key release */
export function useInventoryContextLifecycleStateSync(dependencies: UseInventoryContextLifecycleStateSyncDependencies) {
  const {
    closeInventoryContextMenu,
  } = dependencies;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleCloseInventoryContextMenu = (): void => {
      closeInventoryContextMenu({ restoreItemFocus: true });
    };
    window.addEventListener(
      nh3dCloseInventoryContextMenuEventName,
      handleCloseInventoryContextMenu,
    );
    return () => {
      window.removeEventListener(
        nh3dCloseInventoryContextMenuEventName,
        handleCloseInventoryContextMenu,
      );
    };
  }, [closeInventoryContextMenu]);

}

export interface UseInventoryContextLifecycleCloseDependencies {
  readonly inventory: InventoryDialogState;
  readonly loadingOverlayVisible: boolean;
  readonly inventoryKeyboardActivationKeysDownRef: React.MutableRefObject<Set<string>>;
  readonly normalizeInventoryActivationKey: (key: string) => "Enter" | "Space" | null;
}

/** Dismiss listeners, resize positioning and activation key release */
export function useInventoryContextLifecycleClose(dependencies: UseInventoryContextLifecycleCloseDependencies) {
  const {
    inventory,
    loadingOverlayVisible,
    inventoryKeyboardActivationKeysDownRef,
    normalizeInventoryActivationKey,
  } = dependencies;

  useEffect(() => {
    if (
      !inventory.visible ||
      loadingOverlayVisible ||
      typeof window === "undefined"
    ) {
      inventoryKeyboardActivationKeysDownRef.current.clear();
      return;
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      const normalizedKey = normalizeInventoryActivationKey(event.key);
      if (!normalizedKey) {
        return;
      }
      inventoryKeyboardActivationKeysDownRef.current.delete(normalizedKey);
    };

    const handleWindowBlur = (): void => {
      inventoryKeyboardActivationKeysDownRef.current.clear();
    };

    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      inventoryKeyboardActivationKeysDownRef.current.clear();
    };
  }, [
    inventory.visible,
    loadingOverlayVisible,
    normalizeInventoryActivationKey,
  ]);

}

export interface UseInventoryContextLifecycleEffectsDependencies {
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly loadingOverlayVisible: boolean;
  readonly inventoryContextMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly inventoryDropTypeMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly inventoryDropTypeMenuPosition: { x: number; y: number; } | null;
  readonly closeInventoryDropTypeMenu: () => void;
  readonly inventorySuppressDropActionClickRef: React.MutableRefObject<boolean>;
  readonly cancelInventoryDropTypeHold: () => void;
  readonly setInventoryDropTypeMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly closeInventoryContextMenu: (options?: { restoreItemFocus?: boolean | undefined; } | undefined) => void;
  readonly getInventoryContextMenuClampRegion: () => DOMRect | null;
  readonly inventoryDropActionButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}

/** Dismiss listeners, resize positioning and activation key release */
export function useInventoryContextLifecycleEffects(dependencies: UseInventoryContextLifecycleEffectsDependencies) {
  const {
    inventoryContextMenu,
    loadingOverlayVisible,
    inventoryContextMenuRef,
    inventoryDropTypeMenuRef,
    inventoryDropTypeMenuPosition,
    closeInventoryDropTypeMenu,
    inventorySuppressDropActionClickRef,
    cancelInventoryDropTypeHold,
    setInventoryDropTypeMenuPosition,
    setInventoryContextMenu,
    closeInventoryContextMenu,
    getInventoryContextMenuClampRegion,
    inventoryDropActionButtonRef,
  } = dependencies;

  useEffect(() => {
    if (!inventoryContextMenu || loadingOverlayVisible) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      const insideContextMenu = Boolean(
        target && inventoryContextMenuRef.current?.contains(target),
      );
      const insideDropTypeMenu = Boolean(
        target && inventoryDropTypeMenuRef.current?.contains(target),
      );
      if (inventoryDropTypeMenuPosition && !insideDropTypeMenu) {
        closeInventoryDropTypeMenu();
        inventorySuppressDropActionClickRef.current = false;
        cancelInventoryDropTypeHold();
        if (insideContextMenu) {
          return;
        }
      }
      if (insideContextMenu || insideDropTypeMenu) {
        return;
      }
      setInventoryDropTypeMenuPosition(null);
      setInventoryContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        if (inventoryDropTypeMenuPosition) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          closeInventoryDropTypeMenu();
          inventorySuppressDropActionClickRef.current = false;
          cancelInventoryDropTypeHold();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        closeInventoryContextMenu({ restoreItemFocus: true });
      }
    };

    const handleViewportResize = (): void => {
      setInventoryContextMenu((previous) => {
        if (!previous) {
          return previous;
        }
        const menuElement = inventoryContextMenuRef.current;
        const rect = menuElement?.getBoundingClientRect();
        const clamped = resolveInventoryContextMenuPosition(
          previous,
          rect?.width ?? 220,
          rect?.height ?? 260,
          getInventoryContextMenuClampRegion(),
        );
        if (clamped.x === previous.x && clamped.y === previous.y) {
          return previous;
        }
        return {
          ...previous,
          x: clamped.x,
          y: clamped.y,
        };
      });
    };

    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("contextmenu", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("contextmenu", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [
    cancelInventoryDropTypeHold,
    closeInventoryContextMenu,
    closeInventoryDropTypeMenu,
    getInventoryContextMenuClampRegion,
    inventoryContextMenu,
    inventoryDropTypeMenuPosition,
    loadingOverlayVisible,
  ]);

  useLayoutEffect(() => {
    if (!inventoryContextMenu) {
      return;
    }

    const menuElement = inventoryContextMenuRef.current;
    if (!menuElement) {
      return;
    }

    const rect = menuElement.getBoundingClientRect();
    const clamped = resolveInventoryContextMenuPosition(
      inventoryContextMenu,
      rect.width,
      rect.height,
      getInventoryContextMenuClampRegion(),
    );
    if (
      clamped.x === inventoryContextMenu.x &&
      clamped.y === inventoryContextMenu.y
    ) {
      return;
    }

    setInventoryContextMenu((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        x: clamped.x,
        y: clamped.y,
      };
    });
  }, [getInventoryContextMenuClampRegion, inventoryContextMenu]);

  useLayoutEffect(() => {
    if (!inventoryDropTypeMenuPosition) {
      return;
    }
    const menuElement = inventoryDropTypeMenuRef.current;
    const anchorElement = inventoryDropActionButtonRef.current;
    if (!menuElement || !anchorElement) {
      return;
    }
    const menuRect = menuElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const clamped = resolveInventoryDropTypeMenuPosition(
      anchorRect,
      menuRect.width,
      menuRect.height,
    );
    if (
      Math.abs(clamped.x - inventoryDropTypeMenuPosition.x) < 0.02 &&
      Math.abs(clamped.y - inventoryDropTypeMenuPosition.y) < 0.02
    ) {
      return;
    }
    setInventoryDropTypeMenuPosition(clamped);
  }, [
    inventoryContextMenu?.x,
    inventoryContextMenu?.y,
    inventoryDropTypeMenuPosition,
  ]);

}
