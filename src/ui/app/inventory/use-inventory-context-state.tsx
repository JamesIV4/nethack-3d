import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { FpsCrosshairContextState, Nh3dClientOptions, InventoryDialogState } from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import type * as React from "react";
import {
  classifyInventoryCategory,
  getBlockedInventoryActionIdsForCategory,
  inventoryContextActions,
  inventoryItemSupportsContextAction,
  normalizeInventoryCategoryLabel,
  parseInventoryStackCount
} from "./actions";
import type {
  InventoryContextAction,
  InventoryContextMenuState,
  InventoryDropCountDialogState,
  InventoryRowPressCandidate
} from "./types";
import {
  useContextMenuTitleScroll
} from "../menus/context-menu";
import {
  t
} from "../shared/translations";

export interface UseInventoryContextStateRefsDependencies {
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly clientOptions: Nh3dClientOptions;
}

/** Context retention, display categories and available item actions */
export function useInventoryContextStateRefs(dependencies: UseInventoryContextStateRefsDependencies) {
  const {
    activeRuntimeVersion,
    clientOptions,
  } = dependencies;

  const inventoryItemActions = useMemo(
    () =>
      activeRuntimeVersion === "slashem"
        ? inventoryContextActions.filter((action) => action.id !== "tip")
        : inventoryContextActions,
    [activeRuntimeVersion],
  );

  const inventoryContextMenuRef = useRef<HTMLDivElement | null>(null);

  const inventoryDropTypeMenuRef = useRef<HTMLDivElement | null>(null);

  const inventoryDropActionButtonRef = useRef<HTMLButtonElement | null>(null);

  const inventoryDialogRef = useRef<HTMLDivElement | null>(null);

  const inventoryItemsContainerRef = useRef<HTMLDivElement | null>(null);

  const inventoryRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const inventoryContextMenuStateRef = useRef<InventoryContextMenuState | null>(
    null,
  );

  const inventoryContextMenuLastVisibleRef =
    useRef<InventoryContextMenuState | null>(null);

  const inventoryRowHoverValueByIndexRef = useRef<Map<number, number>>(
    new Map(),
  );

  const inventoryKeyboardActivationKeysDownRef = useRef<Set<string>>(new Set());

  const inventoryContextMenuKeyboardOpenPendingRef = useRef(false);

  const inventoryPointerClientYRef = useRef<number | null>(null);

  const inventoryPointerActiveRef = useRef(false);

  const inventoryRowProximityAnimationFrameRef = useRef<number | null>(null);

  const inventoryTouchFallbackClearTimerRef = useRef<number | null>(null);

  const inventoryRowPressCandidateRef =
    useRef<InventoryRowPressCandidate | null>(null);

  const inventoryDropTypeHoldStateRef = useRef<{
    pointerId: number;
    startedAtMs: number;
    triggered: boolean;
  } | null>(null);

  const inventoryDropTypeHoldAnimationFrameRef = useRef<number | null>(null);

  const inventorySuppressDropActionClickRef = useRef(false);

  const tilesUiEnabled = clientOptions.tilesetMode === "tiles";

  const inventoryAsciiModeEnabled = !tilesUiEnabled;

  const inventoryReducedMotionEnabled =
    inventoryAsciiModeEnabled || clientOptions.reduceInventoryMotion === true;

  const inventoryTileOnlyMotionEnabled =
    !inventoryReducedMotionEnabled &&
    clientOptions.inventoryTileOnlyMotion === true;

  const inventoryUsesFullRowAnimation =
    !inventoryReducedMotionEnabled && !inventoryTileOnlyMotionEnabled;

  const inventoryFixedTileSizeMode = clientOptions.inventoryFixedTileSize;

  const inventoryFixedIconSizePx =
    inventoryFixedTileSizeMode === "small"
      ? 20
      : inventoryFixedTileSizeMode === "large"
        ? 50
        : 35;
  return {
    inventoryItemActions,
    inventoryContextMenuRef,
    inventoryDropTypeMenuRef,
    inventoryDropActionButtonRef,
    inventoryDialogRef,
    inventoryItemsContainerRef,
    inventoryRowRefs,
    inventoryContextMenuStateRef,
    inventoryContextMenuLastVisibleRef,
    inventoryRowHoverValueByIndexRef,
    inventoryKeyboardActivationKeysDownRef,
    inventoryContextMenuKeyboardOpenPendingRef,
    inventoryPointerClientYRef,
    inventoryPointerActiveRef,
    inventoryRowProximityAnimationFrameRef,
    inventoryTouchFallbackClearTimerRef,
    inventoryRowPressCandidateRef,
    inventoryDropTypeHoldStateRef,
    inventoryDropTypeHoldAnimationFrameRef,
    inventorySuppressDropActionClickRef,
    tilesUiEnabled,
    inventoryAsciiModeEnabled,
    inventoryReducedMotionEnabled,
    inventoryTileOnlyMotionEnabled,
    inventoryUsesFullRowAnimation,
    inventoryFixedTileSizeMode,
    inventoryFixedIconSizePx,
  } as const;
}

/** Context retention, display categories and available item actions */
export function useInventoryContextStateState() {
  const [inventoryContextMenu, setInventoryContextMenu] =
    useState<InventoryContextMenuState | null>(null);

  const [inventoryContextTitleAnimationInstance, setInventoryContextTitleAnimationInstance] =
    useState(0);

  const [inventoryDropTypeMenuPosition, setInventoryDropTypeMenuPosition] =
    useState<{ x: number; y: number } | null>(null);

  const [inventoryDropCountDialog, setInventoryDropCountDialog] =
    useState<InventoryDropCountDialogState | null>(null);

  const [inventoryDropCountValue, setInventoryDropCountValue] = useState(1);

  const inventoryDropCountSliderRef = useRef<HTMLInputElement | null>(null);
  return {
    inventoryContextMenu,
    setInventoryContextMenu,
    inventoryContextTitleAnimationInstance,
    setInventoryContextTitleAnimationInstance,
    inventoryDropTypeMenuPosition,
    setInventoryDropTypeMenuPosition,
    inventoryDropCountDialog,
    setInventoryDropCountDialog,
    inventoryDropCountValue,
    setInventoryDropCountValue,
    inventoryDropCountSliderRef,
  } as const;
}

export interface UseInventoryContextStateSyncDependencies {
  readonly fpsCrosshairContext: FpsCrosshairContextState | null;
  readonly fpsCrosshairContextLastVisibleRef: React.MutableRefObject<FpsCrosshairContextState | null>;
}

/** Context retention, display categories and available item actions */
export function useInventoryContextStateSync(dependencies: UseInventoryContextStateSyncDependencies) {
  const {
    fpsCrosshairContext,
    fpsCrosshairContextLastVisibleRef,
  } = dependencies;

  useEffect(() => {
    if (fpsCrosshairContext) {
      fpsCrosshairContextLastVisibleRef.current = fpsCrosshairContext;
    }
  }, [fpsCrosshairContext]);

}

export interface UseInventoryContextStateAnimationDependencies {
  readonly tileContextMenuPosition: { x: number; y: number; } | null;
  readonly tileContextMenuPositionLastVisibleRef: React.MutableRefObject<{ x: number; y: number; } | null>;
  readonly inventoryContextMenuStateRef: React.MutableRefObject<InventoryContextMenuState | null>;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly inventoryContextMenuLastVisibleRef: React.MutableRefObject<InventoryContextMenuState | null>;
  readonly setInventoryContextTitleAnimationInstance: React.Dispatch<React.SetStateAction<number>>;
}

/** Context retention, display categories and available item actions */
export function useInventoryContextStateAnimation(dependencies: UseInventoryContextStateAnimationDependencies) {
  const {
    tileContextMenuPosition,
    tileContextMenuPositionLastVisibleRef,
    inventoryContextMenuStateRef,
    inventoryContextMenu,
    inventoryContextMenuLastVisibleRef,
    setInventoryContextTitleAnimationInstance,
  } = dependencies;

  useEffect(() => {
    if (tileContextMenuPosition) {
      tileContextMenuPositionLastVisibleRef.current = tileContextMenuPosition;
    }
  }, [tileContextMenuPosition]);

  useEffect(() => {
    inventoryContextMenuStateRef.current = inventoryContextMenu;
    if (inventoryContextMenu) {
      inventoryContextMenuLastVisibleRef.current = inventoryContextMenu;
    }
  }, [inventoryContextMenu]);

  useEffect(() => {
    if (!inventoryContextMenu) {
      return;
    }
    setInventoryContextTitleAnimationInstance((previous) => previous + 1);
  }, [inventoryContextMenu]);

}

export interface UseInventoryContextStateSnapshotDependencies {
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly inventoryContextMenuLastVisibleRef: React.MutableRefObject<InventoryContextMenuState | null>;
}

/** Context retention, display categories and available item actions */
export function useInventoryContextStateSnapshot(dependencies: UseInventoryContextStateSnapshotDependencies) {
  const {
    inventoryContextMenu,
    inventoryContextMenuLastVisibleRef,
  } = dependencies;

  const inventoryContextMenuRenderState =
    inventoryContextMenu ?? inventoryContextMenuLastVisibleRef.current;
  return {
    inventoryContextMenuRenderState,
  } as const;
}

export interface UseInventoryContextStateModelDependencies {
  readonly inventoryContextMenuRenderState: InventoryContextMenuState | null;
  readonly inventoryContextTitleAnimationInstance: number;
  readonly inventory: InventoryDialogState;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly inventoryDropCountDialog: InventoryDropCountDialogState | null;
  readonly inventoryItemActions: InventoryContextAction[];
  readonly inventoryDialogRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly inventoryItemsContainerRef: React.MutableRefObject<HTMLDivElement | null>;
}

/** Context retention, display categories and available item actions */
export function useInventoryContextStateModel(dependencies: UseInventoryContextStateModelDependencies) {
  const {
    inventoryContextMenuRenderState,
    inventoryContextTitleAnimationInstance,
    inventory,
    inventoryContextMenu,
    inventoryDropCountDialog,
    inventoryItemActions,
    inventoryDialogRef,
    inventoryItemsContainerRef,
  } = dependencies;

  const inventoryContextTitle = inventoryContextMenuRenderState
    ? `${inventoryContextMenuRenderState.itemText} (${inventoryContextMenuRenderState.accelerator})`
    : "";

  const inventoryContextTitleAnimationKey =
    `inventory-context-title-${inventoryContextTitleAnimationInstance}`;

  const inventoryContextTitleScroll = useContextMenuTitleScroll(
    inventoryContextTitle,
    Boolean(inventoryContextMenuRenderState),
  );

  const inventoryItemCategoryByAccelerator = useMemo(() => {
    const categoryByAccelerator = new Map<string, string>();
    let currentCategory = "";
    for (const item of inventory.items) {
      if (item?.isCategory) {
        currentCategory = normalizeInventoryCategoryLabel(item.text);
        continue;
      }
      const accelerator =
        typeof item?.accelerator === "string" ? item.accelerator.trim() : "";
      if (!accelerator) {
        continue;
      }
      categoryByAccelerator.set(accelerator, currentCategory);
    }
    return categoryByAccelerator;
  }, [inventory.items]);

  const inventoryContextCategory = useMemo(() => {
    if (!inventoryContextMenu) {
      return "";
    }
    return (
      inventoryItemCategoryByAccelerator.get(
        String(inventoryContextMenu.accelerator || "").trim(),
      ) || ""
    );
  }, [inventoryContextMenu, inventoryItemCategoryByAccelerator]);

  const inventoryContextCategoryId = useMemo(
    () => classifyInventoryCategory(inventoryContextCategory),
    [inventoryContextCategory],
  );

  const inventoryContextStackCount = useMemo(
    () =>
      parseInventoryStackCount(String(inventoryContextMenu?.itemText || "")),
    [inventoryContextMenu?.itemText],
  );

  const inventoryContextSupportsDropAmount =
    typeof inventoryContextStackCount === "number" &&
    Number.isFinite(inventoryContextStackCount) &&
    inventoryContextStackCount > 1;

  const inventoryDropCountMaxValue = useMemo(() => {
    if (
      !inventoryDropCountDialog ||
      !Number.isFinite(inventoryDropCountDialog.maxCount)
    ) {
      return 1;
    }
    return Math.max(1, Math.trunc(inventoryDropCountDialog.maxCount));
  }, [inventoryDropCountDialog]);

  const inventoryContextMenuActions = useMemo(() => {
    const blocked = getBlockedInventoryActionIdsForCategory(
      inventoryContextCategory,
    );
    const filteredByCategory = blocked.size
      ? inventoryItemActions.filter((action) => !blocked.has(action.id))
      : inventoryItemActions;
    const selectedItemText = String(inventoryContextMenu?.itemText || "");
    const filteredByItemSupport = filteredByCategory.filter((action) =>
      inventoryItemSupportsContextAction(
        action.id,
        inventoryContextCategoryId,
        selectedItemText,
      ),
    );
    const visibleActions =
      inventoryContextCategoryId === "weapons"
        ? filteredByItemSupport
        : filteredByItemSupport.filter((action) => action.id !== "quiver");
    const selectedItemIsWeaponInHand = /\bweapon in hand\b/i.test(
      selectedItemText,
    );
    if (!selectedItemIsWeaponInHand) {
      return visibleActions;
    }
    return visibleActions.map((action) =>
      action.id === "wield"
        ? { ...action, id: "unwield", label: "Unwield" }
        : action,
    );
  }, [
    inventoryContextCategory,
    inventoryContextCategoryId,
    inventoryContextMenu?.itemText,
    inventoryItemActions,
  ]);

  const getInventoryContextMenuClampRegion = useCallback((): DOMRect | null => {
    const inventoryDialogRect =
      inventoryDialogRef.current?.getBoundingClientRect() ?? null;
    const inventoryItemsRect =
      inventoryItemsContainerRef.current?.getBoundingClientRect() ?? null;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return inventoryDialogRect ?? inventoryItemsRect;
    }
    return inventoryItemsRect ?? inventoryDialogRect;
  }, []);
  return {
    inventoryContextTitle,
    inventoryContextTitleAnimationKey,
    inventoryContextTitleScroll,
    inventoryContextSupportsDropAmount,
    inventoryDropCountMaxValue,
    inventoryContextMenuActions,
    getInventoryContextMenuClampRegion,
  } as const;
}

export interface UseInventoryContextStatePresentationDependencies {
  readonly inventory: InventoryDialogState;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
}

/** Context retention, display categories and available item actions */
export function useInventoryContextStatePresentation(dependencies: UseInventoryContextStatePresentationDependencies) {
  const {
    inventory,
    inventoryContextMenu,
  } = dependencies;

  const inventoryContextActionsEnabled =
    inventory.contextActionsEnabled !== false;

  const inventoryContextMenuOpen =
    inventoryContextMenu !== null && inventoryContextActionsEnabled;

  const inventoryCloseInstructionText = inventoryContextActionsEnabled
    ? t.dialogs.inventory.closeHintWithContext
    : t.dialogs.inventory.closeHint;
  return {
    inventoryContextActionsEnabled,
    inventoryContextMenuOpen,
    inventoryCloseInstructionText,
  } as const;
}
