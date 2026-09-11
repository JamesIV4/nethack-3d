import {
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent
} from "react";
import type { NethackMenuItem, InventoryDialogState } from "../../../game/ui-types";
import type * as React from "react";
import type {
  InventoryContextMenuState,
  InventoryRowPressCandidate
} from "./types";
import {
  inventoryContextMenuAnchorBottomGapPx,
  inventoryContextMenuAnchorGapPx,
  inventoryRowPressPreferInitialMs,
  resolveInventoryContextMenuPosition
} from "./position";

export interface UseInventoryProximityHandlersDependencies {
  readonly inventoryRowProximityAnimationFrameRef: React.MutableRefObject<number | null>;
  readonly inventoryRowRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  readonly inventoryRowHoverValueByIndexRef: React.MutableRefObject<Map<number, number>>;
  readonly inventoryReducedMotionEnabled: boolean;
  readonly inventoryPointerClientYRef: React.MutableRefObject<number | null>;
  readonly inventoryPointerActiveRef: React.MutableRefObject<boolean>;
  readonly inventoryItemsContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly inventoryContextMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly getInventoryContextMenuClampRegion: () => DOMRect | null;
  readonly inventoryTouchFallbackClearTimerRef: React.MutableRefObject<number | null>;
  readonly inventory: InventoryDialogState;
  readonly inventoryRowPressCandidateRef: React.MutableRefObject<InventoryRowPressCandidate | null>;
  readonly inventoryUsesFullRowAnimation: boolean;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly openInventoryContextMenu: (item: NethackMenuItem, clientX: number, clientY: number, anchorRect?: DOMRect | null | undefined, options?: { focusMenu?: boolean | undefined; } | undefined) => void;
}

/** Row proximity scaling, pointer/touch tracking and activation candidates */
export function useInventoryProximityHandlers(dependencies: UseInventoryProximityHandlersDependencies) {
  const {
    inventoryRowProximityAnimationFrameRef,
    inventoryRowRefs,
    inventoryRowHoverValueByIndexRef,
    inventoryReducedMotionEnabled,
    inventoryPointerClientYRef,
    inventoryPointerActiveRef,
    inventoryItemsContainerRef,
    inventoryContextMenuRef,
    setInventoryContextMenu,
    getInventoryContextMenuClampRegion,
    inventoryTouchFallbackClearTimerRef,
    inventory,
    inventoryRowPressCandidateRef,
    inventoryUsesFullRowAnimation,
    inventoryContextMenu,
  } = dependencies;

  const applyInventoryRowProximity = useCallback((): void => {
    inventoryRowProximityAnimationFrameRef.current = null;
    const rows = inventoryRowRefs.current;
    const hoverValuesByIndex = inventoryRowHoverValueByIndexRef.current;
    if (rows.size === 0) {
      hoverValuesByIndex.clear();
      return;
    }
    if (inventoryReducedMotionEnabled) {
      for (const [index, rowElement] of rows.entries()) {
        hoverValuesByIndex.set(index, 0);
        rowElement.style.setProperty("--nh3d-inv-hover", "0");
      }
      return;
    }
    const pointerY = inventoryPointerClientYRef.current;
    const rawPointerIsActive =
      inventoryPointerActiveRef.current &&
      typeof pointerY === "number" &&
      Number.isFinite(pointerY);
    const proximityFalloffPx = 240;
    let needsAnotherFrame = false;
    const activeIndexes = new Set<number>();
    let pinnedActiveIndex: number | null = null;
    let pinnedActiveRowRect: DOMRect | null = null;
    let virtualPointerY: number | null = null;

    for (const [index, rowElement] of rows.entries()) {
      if (
        rowElement.classList.contains("nh3d-inventory-item-active") &&
        !rowElement.classList.contains("nh3d-inventory-item-disabled")
      ) {
        pinnedActiveIndex = index;
        const activeRowRect = rowElement.getBoundingClientRect();
        pinnedActiveRowRect = activeRowRect;
        if (activeRowRect.height > 0) {
          virtualPointerY = activeRowRect.top + activeRowRect.height / 2;
        }
        break;
      }
    }
    const effectivePointerY =
      typeof virtualPointerY === "number" && Number.isFinite(virtualPointerY)
        ? virtualPointerY
        : pointerY;
    const pointerIsActive =
      typeof effectivePointerY === "number" &&
      Number.isFinite(effectivePointerY) &&
      (pinnedActiveIndex !== null || rawPointerIsActive);
    const smoothing = pointerIsActive ? 0.26 : 0.2;

    for (const [index, rowElement] of rows.entries()) {
      activeIndexes.add(index);
      let targetValue = 0;
      if (rowElement.classList.contains("nh3d-inventory-item-disabled")) {
        targetValue = 0;
      } else if (pointerIsActive) {
        const rowRect = rowElement.getBoundingClientRect();
        if (rowRect.height > 0) {
          const rowCenterY = rowRect.top + rowRect.height / 2;
          const distancePx = Math.abs(effectivePointerY - rowCenterY);
          const normalized = Math.max(0, 1 - distancePx / proximityFalloffPx);
          targetValue = normalized * normalized * (3 - 2 * normalized);
        }
      }

      const currentValue = hoverValuesByIndex.get(index) ?? 0;
      let nextValue = currentValue + (targetValue - currentValue) * smoothing;
      if (Math.abs(targetValue - nextValue) < 0.0015) {
        nextValue = targetValue;
      } else {
        needsAnotherFrame = true;
      }

      hoverValuesByIndex.set(index, nextValue);
      rowElement.style.setProperty("--nh3d-inv-hover", nextValue.toFixed(4));
    }

    for (const index of Array.from(hoverValuesByIndex.keys())) {
      if (!activeIndexes.has(index)) {
        hoverValuesByIndex.delete(index);
      }
    }

    const inventoryItemsContainer = inventoryItemsContainerRef.current;
    const inventoryItemsRect =
      inventoryItemsContainer?.getBoundingClientRect() ?? null;
    if (pinnedActiveRowRect && inventoryItemsContainer && inventoryItemsRect) {
      const viewportInsetPx = 6;
      const lowerBound = inventoryItemsRect.bottom - viewportInsetPx;
      const upperBound = inventoryItemsRect.top + viewportInsetPx;
      const overflowBelow = pinnedActiveRowRect.bottom - lowerBound;
      const overflowAbove = upperBound - pinnedActiveRowRect.top;
      if (overflowBelow > 0.5) {
        inventoryItemsContainer.scrollTop += overflowBelow;
      } else if (overflowAbove > 0.5) {
        inventoryItemsContainer.scrollTop -= overflowAbove;
      }
    }

    if (pinnedActiveRowRect && inventoryContextMenuRef.current) {
      const menuRect = inventoryContextMenuRef.current.getBoundingClientRect();
      const menuWidth =
        Number.isFinite(menuRect.width) && menuRect.width > 0
          ? menuRect.width
          : 220;
      const menuHeight =
        Number.isFinite(menuRect.height) && menuRect.height > 0
          ? menuRect.height
          : 260;
      const anchorRightX =
        pinnedActiveRowRect.right + inventoryContextMenuAnchorGapPx;
      const anchorBottomY =
        pinnedActiveRowRect.bottom + inventoryContextMenuAnchorBottomGapPx;
      const anchorCenterX =
        pinnedActiveRowRect.left + pinnedActiveRowRect.width * 0.5;
      const anchorLeftX =
        pinnedActiveRowRect.left - inventoryContextMenuAnchorGapPx;
      const anchorTopY =
        pinnedActiveRowRect.top - inventoryContextMenuAnchorBottomGapPx;
      setInventoryContextMenu((previous) => {
        if (!previous) {
          return previous;
        }
        const next = resolveInventoryContextMenuPosition(
          {
            ...previous,
            anchorCenterX,
            anchorLeftX,
            anchorBottomY,
            anchorRightX,
            anchorTopY,
          },
          menuWidth,
          menuHeight,
          getInventoryContextMenuClampRegion(),
        );
        const previousAnchorBottomY =
          typeof previous.anchorBottomY === "number" &&
            Number.isFinite(previous.anchorBottomY)
            ? previous.anchorBottomY
            : previous.y;
        const previousAnchorRightX =
          typeof previous.anchorRightX === "number" &&
            Number.isFinite(previous.anchorRightX)
            ? previous.anchorRightX
            : previous.x;
        const previousAnchorCenterX =
          typeof previous.anchorCenterX === "number" &&
            Number.isFinite(previous.anchorCenterX)
            ? previous.anchorCenterX
            : previous.x;
        const previousAnchorLeftX =
          typeof previous.anchorLeftX === "number" &&
            Number.isFinite(previous.anchorLeftX)
            ? previous.anchorLeftX
            : previous.x;
        if (
          Math.abs(next.x - previous.x) < 0.02 &&
          Math.abs(next.y - previous.y) < 0.02 &&
          Math.abs(anchorBottomY - previousAnchorBottomY) < 0.02 &&
          Math.abs(anchorCenterX - previousAnchorCenterX) < 0.02 &&
          Math.abs(anchorRightX - previousAnchorRightX) < 0.02 &&
          Math.abs(anchorLeftX - previousAnchorLeftX) < 0.02
        ) {
          return previous;
        }
        return {
          ...previous,
          anchorCenterX,
          anchorLeftX,
          x: next.x,
          y: next.y,
          anchorBottomY,
          anchorRightX,
          anchorTopY,
        };
      });
    }

    if (needsAnotherFrame && typeof window !== "undefined") {
      inventoryRowProximityAnimationFrameRef.current =
        window.requestAnimationFrame(() => {
          applyInventoryRowProximity();
        });
    }
  }, [getInventoryContextMenuClampRegion, inventoryReducedMotionEnabled]);

  const scheduleInventoryRowProximityUpdate = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (inventoryRowProximityAnimationFrameRef.current !== null) {
      return;
    }
    inventoryRowProximityAnimationFrameRef.current =
      window.requestAnimationFrame(() => {
        applyInventoryRowProximity();
      });
  }, [applyInventoryRowProximity]);

  const clearInventoryTouchFallbackClearTimer = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    const activeTimer = inventoryTouchFallbackClearTimerRef.current;
    if (activeTimer === null) {
      return;
    }
    window.clearTimeout(activeTimer);
    inventoryTouchFallbackClearTimerRef.current = null;
  }, []);

  const scheduleInventoryTouchFallbackClear = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryTouchFallbackClearTimerRef.current = window.setTimeout(() => {
      inventoryTouchFallbackClearTimerRef.current = null;
      inventoryPointerActiveRef.current = false;
      inventoryPointerClientYRef.current = null;
      scheduleInventoryRowProximityUpdate();
    }, 220);
  }, [
    clearInventoryTouchFallbackClearTimer,
    scheduleInventoryRowProximityUpdate,
  ]);

  const normalizeInventoryActivationKey = useCallback(
    (key: string): "Enter" | "Space" | null => {
      if (key === "Enter" || key === "NumpadEnter") {
        return "Enter";
      }
      if (key === " " || key === "Space" || key === "Spacebar") {
        return "Space";
      }
      return null;
    },
    [],
  );

  const setInventoryRowRef = useCallback(
    (index: number, element: HTMLDivElement | null): void => {
      if (element) {
        inventoryRowRefs.current.set(index, element);
        const existingValue =
          inventoryRowHoverValueByIndexRef.current.get(index) ?? 0;
        element.style.setProperty("--nh3d-inv-hover", existingValue.toFixed(4));
      } else {
        inventoryRowRefs.current.delete(index);
      }
      if (inventory.visible) {
        scheduleInventoryRowProximityUpdate();
      }
    },
    [inventory.visible, scheduleInventoryRowProximityUpdate],
  );

  const handleInventoryPointerUpdate = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      clearInventoryTouchFallbackClearTimer();
      inventoryPointerActiveRef.current = true;
      inventoryPointerClientYRef.current = event.clientY;
      scheduleInventoryRowProximityUpdate();
    },
    [
      clearInventoryTouchFallbackClearTimer,
      scheduleInventoryRowProximityUpdate,
    ],
  );

  const handleInventoryPointerLeave = useCallback((): void => {
    if (
      inventoryRowPressCandidateRef.current &&
      inventoryRowPressCandidateRef.current.source === "pointer"
    ) {
      inventoryRowPressCandidateRef.current = null;
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    scheduleInventoryRowProximityUpdate();
  }, [
    clearInventoryTouchFallbackClearTimer,
    scheduleInventoryRowProximityUpdate,
  ]);

  const handleInventoryPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    activateInventoryRowPressCandidateFromRelease(
      "pointer",
      event.pointerId,
      event.clientX,
      event.clientY,
      event.target,
    );
    if (event.pointerType === "mouse") {
      return;
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    scheduleInventoryRowProximityUpdate();
  };

  const handleInventoryPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const pressCandidate = inventoryRowPressCandidateRef.current;
      if (
        pressCandidate &&
        pressCandidate.source === "pointer" &&
        pressCandidate.pointerId === event.pointerId
      ) {
        inventoryRowPressCandidateRef.current = null;
      }
      if (event.pointerType === "touch") {
        scheduleInventoryTouchFallbackClear();
        return;
      }
      handleInventoryPointerLeave();
    },
    [handleInventoryPointerLeave, scheduleInventoryTouchFallbackClear],
  );

  const handleInventoryTouchUpdate = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>): void => {
      const primaryTouch = event.touches[0] ?? event.changedTouches[0];
      if (!primaryTouch) {
        return;
      }
      clearInventoryTouchFallbackClearTimer();
      inventoryPointerActiveRef.current = true;
      inventoryPointerClientYRef.current = primaryTouch.clientY;
      scheduleInventoryRowProximityUpdate();
    },
    [
      clearInventoryTouchFallbackClearTimer,
      scheduleInventoryRowProximityUpdate,
    ],
  );

  const handleInventoryTouchEnd = (
    event: ReactTouchEvent<HTMLDivElement>,
  ): void => {
    const releaseTouch = event.changedTouches[0] ?? event.touches[0];
    if (releaseTouch) {
      activateInventoryRowPressCandidateFromRelease(
        "touch",
        releaseTouch.identifier,
        releaseTouch.clientX,
        releaseTouch.clientY,
        event.target,
      );
    } else {
      const pressCandidate = inventoryRowPressCandidateRef.current;
      if (pressCandidate && pressCandidate.source === "touch") {
        inventoryRowPressCandidateRef.current = null;
      }
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    scheduleInventoryRowProximityUpdate();
  };

  const handleInventoryTouchCancel = useCallback((): void => {
    if (
      inventoryRowPressCandidateRef.current &&
      inventoryRowPressCandidateRef.current.source === "touch"
    ) {
      inventoryRowPressCandidateRef.current = null;
    }
    scheduleInventoryTouchFallbackClear();
  }, [scheduleInventoryTouchFallbackClear]);

  const handleInventoryTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>): void => {
      handleInventoryTouchUpdate(event);
    },
    [handleInventoryTouchUpdate],
  );

  const handleInventoryItemsScroll = useCallback((): void => {
    if (!inventoryPointerActiveRef.current) {
      return;
    }
    scheduleInventoryRowProximityUpdate();
  }, [scheduleInventoryRowProximityUpdate]);

  const beginInventoryRowPressCandidate = useCallback(
    (
      source: InventoryRowPressCandidate["source"],
      pointerId: number,
      item: NethackMenuItem,
      accelerator: string,
      rowElement: HTMLDivElement | null,
      startClientX: number,
      startClientY: number,
    ): void => {
      if (!inventoryUsesFullRowAnimation) {
        return;
      }
      if (inventoryContextMenu) {
        return;
      }
      const normalizedAccelerator = String(accelerator || "").trim();
      if (
        !normalizedAccelerator ||
        !Number.isFinite(startClientX) ||
        !Number.isFinite(startClientY)
      ) {
        return;
      }
      inventoryRowPressCandidateRef.current = {
        source,
        pointerId,
        accelerator: normalizedAccelerator,
        item,
        rowElement,
        startClientX,
        startClientY,
        startedAtMs: Date.now(),
      };
    },
    [inventoryContextMenu, inventoryUsesFullRowAnimation],
  );

  const activateInventoryRowPressCandidateFromRelease = useCallback(
    (
      source: InventoryRowPressCandidate["source"],
      pointerId: number,
      releaseClientX: number,
      releaseClientY: number,
      releaseTarget: EventTarget | null,
    ): void => {
      if (!inventoryUsesFullRowAnimation) {
        inventoryRowPressCandidateRef.current = null;
        return;
      }
      const candidate = inventoryRowPressCandidateRef.current;
      if (
        !candidate ||
        candidate.source !== source ||
        candidate.pointerId !== pointerId
      ) {
        return;
      }
      inventoryRowPressCandidateRef.current = null;
      if (
        !Number.isFinite(releaseClientX) ||
        !Number.isFinite(releaseClientY)
      ) {
        return;
      }
      const elapsedMs = Date.now() - candidate.startedAtMs;
      const preferInitialSelection =
        elapsedMs <= inventoryRowPressPreferInitialMs;
      if (!preferInitialSelection) {
        // After the short tap window, fall back to normal release-target behavior.
        return;
      }

      const releaseElement =
        releaseTarget instanceof Element ? releaseTarget : null;
      const releaseRowElement = releaseElement?.closest(".nh3d-inventory-item");
      const releaseAccelerator =
        releaseRowElement instanceof HTMLElement
          ? String(releaseRowElement.dataset.nh3dAccelerator || "").trim()
          : "";
      if (releaseAccelerator && releaseAccelerator === candidate.accelerator) {
        return;
      }

      const activeAccelerator = String(
        inventoryContextMenu?.accelerator || "",
      ).trim();
      if (activeAccelerator && activeAccelerator === candidate.accelerator) {
        setInventoryContextMenu(null);
        return;
      }

      const anchorRect =
        candidate.rowElement && candidate.rowElement.isConnected
          ? candidate.rowElement.getBoundingClientRect()
          : undefined;
      dependencies.openInventoryContextMenu(
        candidate.item,
        candidate.startClientX,
        candidate.startClientY,
        anchorRect,
      );
    },
    [inventoryContextMenu?.accelerator, inventoryUsesFullRowAnimation],
  );

  const handleInventoryRowActivationDismissCapture = useCallback(
    (target: EventTarget | null): void => {
      if (!inventoryUsesFullRowAnimation) {
        return;
      }
      if (!inventoryContextMenu) {
        return;
      }
      const targetElement = target instanceof Element ? target : null;
      if (!targetElement) {
        return;
      }
      const rowElement = targetElement.closest(".nh3d-inventory-item");
      if (!(rowElement instanceof HTMLElement)) {
        return;
      }
      const accelerator = rowElement.dataset.nh3dAccelerator || "";
      const normalizedAccelerator = String(accelerator).trim();
      if (!normalizedAccelerator) {
        return;
      }
      inventoryRowPressCandidateRef.current = null;
      setInventoryContextMenu(null);
    },
    [inventoryContextMenu, inventoryUsesFullRowAnimation],
  );

  const handleInventoryRowPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      handleInventoryRowActivationDismissCapture(event.target);
    },
    [handleInventoryRowActivationDismissCapture],
  );

  const handleInventoryRowTouchStartCapture = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>): void => {
      handleInventoryRowActivationDismissCapture(event.target);
    },
    [handleInventoryRowActivationDismissCapture],
  );
  return {
    scheduleInventoryRowProximityUpdate,
    clearInventoryTouchFallbackClearTimer,
    normalizeInventoryActivationKey,
    setInventoryRowRef,
    handleInventoryPointerUpdate,
    handleInventoryPointerLeave,
    handleInventoryPointerUp,
    handleInventoryPointerCancel,
    handleInventoryTouchUpdate,
    handleInventoryTouchEnd,
    handleInventoryTouchCancel,
    handleInventoryTouchMove,
    handleInventoryItemsScroll,
    beginInventoryRowPressCandidate,
    handleInventoryRowPointerDownCapture,
    handleInventoryRowTouchStartCapture,
  } as const;
}

export interface UseInventoryProximityEffectsDependencies {
  readonly inventory: InventoryDialogState;
  readonly scheduleInventoryRowProximityUpdate: () => void;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly inventoryPointerActiveRef: React.MutableRefObject<boolean>;
  readonly inventoryPointerClientYRef: React.MutableRefObject<number | null>;
  readonly inventoryRowPressCandidateRef: React.MutableRefObject<InventoryRowPressCandidate | null>;
  readonly inventoryRowHoverValueByIndexRef: React.MutableRefObject<Map<number, number>>;
  readonly inventoryRowRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  readonly inventoryReducedMotionEnabled: boolean;
  readonly clearInventoryTouchFallbackClearTimer: () => void;
  readonly inventoryRowProximityAnimationFrameRef: React.MutableRefObject<number | null>;
}

/** Row proximity scaling, pointer/touch tracking and activation candidates */
export function useInventoryProximityEffects(dependencies: UseInventoryProximityEffectsDependencies) {
  const {
    inventory,
    scheduleInventoryRowProximityUpdate,
    inventoryContextMenu,
    inventoryPointerActiveRef,
    inventoryPointerClientYRef,
    inventoryRowPressCandidateRef,
    inventoryRowHoverValueByIndexRef,
    inventoryRowRefs,
    inventoryReducedMotionEnabled,
    clearInventoryTouchFallbackClearTimer,
    inventoryRowProximityAnimationFrameRef,
  } = dependencies;

  useEffect(() => {
    if (!inventory.visible) {
      return;
    }
    scheduleInventoryRowProximityUpdate();
  }, [
    inventory.visible,
    inventoryContextMenu,
    scheduleInventoryRowProximityUpdate,
  ]);

  useEffect(() => {
    if (inventory.visible) {
      scheduleInventoryRowProximityUpdate();
      return;
    }
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    inventoryRowPressCandidateRef.current = null;
    inventoryRowHoverValueByIndexRef.current.clear();
    for (const rowElement of inventoryRowRefs.current.values()) {
      rowElement.style.setProperty("--nh3d-inv-hover", "0");
    }
  }, [inventory.items, inventory.visible, scheduleInventoryRowProximityUpdate]);

  useEffect(() => {
    if (!inventoryReducedMotionEnabled) {
      return;
    }
    inventoryRowPressCandidateRef.current = null;
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    for (const rowElement of inventoryRowRefs.current.values()) {
      rowElement.style.setProperty("--nh3d-inv-hover", "0");
    }
  }, [inventoryReducedMotionEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleViewportResize = (): void => {
      if (!inventory.visible) {
        return;
      }
      scheduleInventoryRowProximityUpdate();
    };
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [inventory.visible, scheduleInventoryRowProximityUpdate]);

  useEffect(
    () => () => {
      if (typeof window === "undefined") {
        return;
      }
      clearInventoryTouchFallbackClearTimer();
      if (inventoryRowProximityAnimationFrameRef.current === null) {
        return;
      }
      window.cancelAnimationFrame(
        inventoryRowProximityAnimationFrameRef.current,
      );
      inventoryRowProximityAnimationFrameRef.current = null;
      inventoryRowHoverValueByIndexRef.current.clear();
    },
    [clearInventoryTouchFallbackClearTimer],
  );

}
