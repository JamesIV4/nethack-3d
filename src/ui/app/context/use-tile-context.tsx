import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import type { FpsCrosshairContextState, Nh3dClientOptions, Nethack3DEngineController } from "../../../game/ui-types";
import type * as React from "react";
import type {
  InventoryContextMenuState
} from "../inventory/types";
import {
  clampTileContextMenuPosition,
  tileContextMenuAnchorOffsetY,
  useContextMenuTitleScroll
} from "../menus/context-menu";

export interface UseTileContextStateDependencies {
  readonly clientOptions: Nh3dClientOptions;
}

/** FPS/tile context retention, title, action routing and positioning */
export function useTileContextState(dependencies: UseTileContextStateDependencies) {
  const {
    clientOptions,
  } = dependencies;

  const isFpsPlayMode = clientOptions.fpsMode;

  const fpsCrosshairContextMenuRef = useRef<HTMLDivElement | null>(null);

  const fpsCrosshairContextLastVisibleRef =
    useRef<FpsCrosshairContextState | null>(null);

  const [tileContextMenuPosition, setTileContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const tileContextMenuPositionLastVisibleRef = useRef<{
    x: number;
    y: number;
  } | null>(null);
  return {
    isFpsPlayMode,
    fpsCrosshairContextMenuRef,
    fpsCrosshairContextLastVisibleRef,
    tileContextMenuPosition,
    setTileContextMenuPosition,
    tileContextMenuPositionLastVisibleRef,
  } as const;
}

/** FPS/tile context retention, title, action routing and positioning */
export function useTileContextAnimation() {
  const [fpsContextTitleAnimationInstance, setFpsContextTitleAnimationInstance] =
    useState(0);
  return {
    fpsContextTitleAnimationInstance,
    setFpsContextTitleAnimationInstance,
  } as const;
}

export interface UseTileContextRetentionDependencies {
  readonly fpsCrosshairContext: FpsCrosshairContextState | null;
  readonly setFpsContextTitleAnimationInstance: React.Dispatch<React.SetStateAction<number>>;
}

/** FPS/tile context retention, title, action routing and positioning */
export function useTileContextRetention(dependencies: UseTileContextRetentionDependencies) {
  const {
    fpsCrosshairContext,
    setFpsContextTitleAnimationInstance,
  } = dependencies;

  useEffect(() => {
    if (!fpsCrosshairContext) {
      return;
    }
    setFpsContextTitleAnimationInstance((previous) => previous + 1);
  }, [fpsCrosshairContext]);

}

export interface UseTileContextPositionDependencies {
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly inventoryContextMenuKeyboardOpenPendingRef: React.MutableRefObject<boolean>;
  readonly inventoryContextMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly fpsCrosshairContext: FpsCrosshairContextState | null;
  readonly fpsCrosshairContextLastVisibleRef: React.MutableRefObject<FpsCrosshairContextState | null>;
  readonly tileContextMenuPosition: { x: number; y: number; } | null;
  readonly tileContextMenuPositionLastVisibleRef: React.MutableRefObject<{ x: number; y: number; } | null>;
}

/** FPS/tile context retention, title, action routing and positioning */
export function useTileContextPosition(dependencies: UseTileContextPositionDependencies) {
  const {
    inventoryContextMenu,
    inventoryContextMenuKeyboardOpenPendingRef,
    inventoryContextMenuRef,
    fpsCrosshairContext,
    fpsCrosshairContextLastVisibleRef,
    tileContextMenuPosition,
    tileContextMenuPositionLastVisibleRef,
  } = dependencies;

  useEffect(() => {
    if (
      !inventoryContextMenu ||
      !inventoryContextMenuKeyboardOpenPendingRef.current ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let remainingFrameAttempts = 4;
    const focusFirstActionButton = (): void => {
      if (cancelled) {
        return;
      }
      const firstActionButton =
        inventoryContextMenuRef.current?.querySelector<HTMLButtonElement>(
          ".nh3d-context-menu-button:not(:disabled)",
        ) ?? null;
      if (!firstActionButton) {
        if (remainingFrameAttempts <= 0) {
          return;
        }
        remainingFrameAttempts -= 1;
        animationFrameId = window.requestAnimationFrame(focusFirstActionButton);
        return;
      }
      firstActionButton.focus({ preventScroll: true });
      firstActionButton.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
      inventoryContextMenuKeyboardOpenPendingRef.current = false;
    };
    const timerId = window.setTimeout(() => {
      focusFirstActionButton();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [inventoryContextMenu]);

  const fpsCrosshairContextRenderState =
    fpsCrosshairContext ?? fpsCrosshairContextLastVisibleRef.current;

  const tileContextMenuRenderPosition =
    tileContextMenuPosition ?? tileContextMenuPositionLastVisibleRef.current;
  return {
    fpsCrosshairContextRenderState,
    tileContextMenuRenderPosition,
  } as const;
}

export interface UseTileContextTitleDependencies {
  readonly fpsCrosshairContextRenderState: FpsCrosshairContextState | null;
  readonly fpsContextTitleAnimationInstance: number;
}

/** FPS/tile context retention, title, action routing and positioning */
export function useTileContextTitle(dependencies: UseTileContextTitleDependencies) {
  const {
    fpsCrosshairContextRenderState,
    fpsContextTitleAnimationInstance,
  } = dependencies;

  const fpsContextTitle = String(fpsCrosshairContextRenderState?.title || "");

  const fpsContextTitleAnimationKey =
    `fps-context-title-${fpsContextTitleAnimationInstance}`;

  const fpsContextTitleScroll = useContextMenuTitleScroll(
    fpsContextTitle,
    Boolean(fpsCrosshairContextRenderState),
  );
  return {
    fpsContextTitle,
    fpsContextTitleAnimationKey,
    fpsContextTitleScroll,
  } as const;
}

export interface UseTileContextActionsDependencies {
  readonly fpsCrosshairContext: FpsCrosshairContextState | null;
  readonly controller: Nethack3DEngineController | null;
}

/** FPS/tile context retention, title, action routing and positioning */
export function useTileContextActions(dependencies: UseTileContextActionsDependencies) {
  const {
    fpsCrosshairContext,
    controller,
  } = dependencies;

  const runFpsCrosshairContextAction = (
    action: FpsCrosshairContextState["actions"][number],
  ): void => {
    // Workaround for a race condition in context-menu command submission.
    // TODO: remove once the underlying ordering issue is fixed.
    const contextualSubmitDelayMs = 0;
    const autoDirectionFromFpsAim =
      fpsCrosshairContext?.autoDirectionFromFpsAim === true;
    if (action.kind === "debug") {
      controller?.rotateActiveTileFaceTexture();
      return;
    }
    if (action.kind === "contextual") {
      controller?.runContextualAction(action.value);
      return;
    }
    if (action.kind === "quick") {
      controller?.runQuickAction(action.value, {
        autoDirectionFromFpsAim,
        submitDelayMs: contextualSubmitDelayMs,
      });
      return;
    }
    controller?.runExtendedCommand(action.value, {
      autoDirectionFromFpsAim,
      submitDelayMs: contextualSubmitDelayMs,
    });
  };
  return {
    runFpsCrosshairContextAction,
  } as const;
}

export interface UseTileContextEffectsDependencies {
  readonly fpsCrosshairContext: FpsCrosshairContextState | null;
  readonly setTileContextMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly fpsCrosshairContextMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly loadingOverlayVisible: boolean;
  readonly controller: Nethack3DEngineController | null;
}

/** FPS/tile context retention, title, action routing and positioning */
export function useTileContextEffects(dependencies: UseTileContextEffectsDependencies) {
  const {
    fpsCrosshairContext,
    setTileContextMenuPosition,
    fpsCrosshairContextMenuRef,
    loadingOverlayVisible,
    controller,
  } = dependencies;

  useLayoutEffect(() => {
    if (!fpsCrosshairContext) {
      setTileContextMenuPosition(null);
      return;
    }
    const anchorX = fpsCrosshairContext.anchorClientX;
    const anchorY = fpsCrosshairContext.anchorClientY;
    if (
      typeof anchorX !== "number" ||
      typeof anchorY !== "number" ||
      !Number.isFinite(anchorX) ||
      !Number.isFinite(anchorY)
    ) {
      setTileContextMenuPosition(null);
      return;
    }

    const menuElement = fpsCrosshairContextMenuRef.current;
    const rect = menuElement?.getBoundingClientRect();
    const width = rect?.width ?? 260;
    const height = rect?.height ?? 220;
    const unclampedX = anchorX - width / 2;
    const unclampedY = anchorY - height - tileContextMenuAnchorOffsetY;
    const clamped = clampTileContextMenuPosition(
      unclampedX,
      unclampedY,
      width,
      height,
    );
    setTileContextMenuPosition((previous) => {
      if (previous && previous.x === clamped.x && previous.y === clamped.y) {
        return previous;
      }
      return clamped;
    });
  }, [
    fpsCrosshairContext,
    fpsCrosshairContext?.anchorClientX,
    fpsCrosshairContext?.anchorClientY,
  ]);

  useEffect(() => {
    if (!fpsCrosshairContext || loadingOverlayVisible) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target && fpsCrosshairContextMenuRef.current?.contains(target)) {
        return;
      }
      controller?.dismissFpsCrosshairContextMenu();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        controller?.dismissFpsCrosshairContextMenu();
      }
    };

    const handleViewportResize = (): void => {
      const menuElement = fpsCrosshairContextMenuRef.current;
      const rect = menuElement?.getBoundingClientRect();
      const width = rect?.width ?? 260;
      const height = rect?.height ?? 220;
      const anchorX =
        typeof fpsCrosshairContext.anchorClientX === "number"
          ? fpsCrosshairContext.anchorClientX
          : window.innerWidth * 0.5;
      const anchorY =
        typeof fpsCrosshairContext.anchorClientY === "number"
          ? fpsCrosshairContext.anchorClientY
          : window.innerHeight * 0.5;
      const clamped = clampTileContextMenuPosition(
        anchorX - width / 2,
        anchorY - height - tileContextMenuAnchorOffsetY,
        width,
        height,
      );
      setTileContextMenuPosition((previous) => {
        if (previous && previous.x === clamped.x && previous.y === clamped.y) {
          return previous;
        }
        return clamped;
      });
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [controller, fpsCrosshairContext, loadingOverlayVisible]);

}
