import {
  useEffect,
  useLayoutEffect
} from "react";
import type { FpsCrosshairContextState, InfoMenuState, QuestionDialogState, InventoryDialogState, TextInputRequestState, NewGamePromptState, Nethack3DEngineController } from "../../../game/ui-types";
import type * as React from "react";
import type {
  InventoryContextMenuState,
  InventoryDropCountDialogState
} from "../inventory/types";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";
import type {
  ControllerRemapListeningState
} from "../controller/binding-capture";
import {
  getConnectedGamepadsForCapture
} from "../controller/binding-capture";

export interface UseOverlayLifecycleDependencies {
  readonly asciiLogoVisible: boolean;
  readonly question: QuestionDialogState | null;
  readonly directionQuestion: string | null;
  readonly infoMenu: InfoMenuState | null;
  readonly inventory: InventoryDialogState;
  readonly textInputRequest: TextInputRequestState | null;
  readonly positionRequest: string | null;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly inventoryDropCountDialog: InventoryDropCountDialogState | null;
  readonly fpsCrosshairContext: FpsCrosshairContextState | null;
  readonly isWizardCommandsVisible: boolean;
  readonly isControllerActionWheelVisible: boolean;
  readonly isControllerSupportPromptVisible: boolean;
  readonly newGamePrompt: NewGamePromptState;
  readonly hasHydratedUserTilesets: boolean;
  readonly hasAskedControllerSupportThisSession: boolean;
  readonly setIsControllerSupportPromptVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isMobileGameRunning: boolean;
  readonly setIsMobileActionSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setMobileActionSheetMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  readonly setIsMobileLogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly gameOverDialogShowsTombstone: boolean;
  readonly setIsWizardCommandsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly hideAllUiForDeferredGameOver: boolean;
  readonly setIsPauseMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsExitConfirmationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsClientOptionsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsControllerRemapVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setControllerRemapListening: React.Dispatch<React.SetStateAction<ControllerRemapListeningState | null>>;
  readonly setIsControllerActionWheelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setControllerActionWheelMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  readonly setControllerActionWheelChosenIndex: React.Dispatch<React.SetStateAction<number>>;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly setInventoryDropTypeMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly setInventoryDropCountDialog: React.Dispatch<React.SetStateAction<InventoryDropCountDialogState | null>>;
  readonly setTileContextMenuPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; } | null>>;
  readonly setPositionRequest: (text: string | null) => void;
  readonly setCharacterSheetInterceptionArmed: React.Dispatch<React.SetStateAction<boolean>>;
  readonly characterSheetAwaitingInfoRef: React.MutableRefObject<boolean>;
  readonly controller: Nethack3DEngineController | null;
  readonly isDesktopGameRunning: boolean;
}

/** Coordinates overlay focus, visibility and controller interaction. */
export function useOverlayLifecycle(dependencies: UseOverlayLifecycleDependencies) {
  const {
    asciiLogoVisible,
    question,
    directionQuestion,
    infoMenu,
    inventory,
    textInputRequest,
    positionRequest,
    inventoryContextMenu,
    inventoryDropCountDialog,
    fpsCrosshairContext,
    isWizardCommandsVisible,
    isControllerActionWheelVisible,
    isControllerSupportPromptVisible,
    newGamePrompt,
    hasHydratedUserTilesets,
    hasAskedControllerSupportThisSession,
    setIsControllerSupportPromptVisible,
    isMobileGameRunning,
    setIsMobileActionSheetVisible,
    setMobileActionSheetMode,
    setIsMobileLogVisible,
    gameOverDialogShowsTombstone,
    setIsWizardCommandsVisible,
    hideAllUiForDeferredGameOver,
    setIsPauseMenuVisible,
    setIsExitConfirmationVisible,
    setIsClientOptionsVisible,
    setIsControllerRemapVisible,
    setControllerRemapListening,
    setIsControllerActionWheelVisible,
    setControllerActionWheelMode,
    setControllerActionWheelChosenIndex,
    setInventoryContextMenu,
    setInventoryDropTypeMenuPosition,
    setInventoryDropCountDialog,
    setTileContextMenuPosition,
    setPositionRequest,
    setCharacterSheetInterceptionArmed,
    characterSheetAwaitingInfoRef,
    controller,
    isDesktopGameRunning,
  } = dependencies;

  useLayoutEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (!asciiLogoVisible) {
      root.style.removeProperty("--nh3d-startup-logo-bottom");
      return;
    }

    const measureLogoBottom = (): void => {
      const logos = Array.from(
        document.querySelectorAll<HTMLElement>(".nethack-ascii-logo"),
      );
      if (logos.length === 0) {
        root.style.removeProperty("--nh3d-startup-logo-bottom");
        return;
      }
      const maxBottom = logos.reduce((max, logo) => {
        const rect = logo.getBoundingClientRect();
        return Math.max(max, rect.bottom);
      }, 0);
      if (!Number.isFinite(maxBottom) || maxBottom <= 0) {
        root.style.removeProperty("--nh3d-startup-logo-bottom");
        return;
      }
      root.style.setProperty(
        "--nh3d-startup-logo-bottom",
        `${Math.ceil(maxBottom)}px`,
      );
    };

    measureLogoBottom();
    const rafId = window.requestAnimationFrame(measureLogoBottom);
    window.addEventListener("resize", measureLogoBottom);
    window.addEventListener("orientationchange", measureLogoBottom);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measureLogoBottom);
      const logos = document.querySelectorAll<HTMLElement>(
        ".nethack-ascii-logo",
      );
      logos.forEach((logo) => resizeObserver?.observe(logo));
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measureLogoBottom);
      window.removeEventListener("orientationchange", measureLogoBottom);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      root.style.removeProperty("--nh3d-startup-logo-bottom");
    };
  }, [asciiLogoVisible]);

  const hasGameplayOverlayOpen =
    Boolean(question) ||
    Boolean(directionQuestion) ||
    Boolean(infoMenu) ||
    inventory.visible ||
    Boolean(textInputRequest) ||
    Boolean(positionRequest) ||
    Boolean(inventoryContextMenu) ||
    Boolean(inventoryDropCountDialog) ||
    Boolean(fpsCrosshairContext) ||
    isWizardCommandsVisible ||
    isControllerActionWheelVisible ||
    isControllerSupportPromptVisible ||
    newGamePrompt.visible;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!hasHydratedUserTilesets || hasAskedControllerSupportThisSession) {
      return;
    }

    const handleControllerDetection = (): void => {
      if (
        !hasHydratedUserTilesets ||
        hasAskedControllerSupportThisSession ||
        isControllerSupportPromptVisible
      ) {
        return;
      }
      if (getConnectedGamepadsForCapture().length <= 0) {
        return;
      }
      setIsControllerSupportPromptVisible(true);
    };

    handleControllerDetection();
    const pollId = window.setInterval(handleControllerDetection, 1200);
    window.addEventListener("gamepadconnected", handleControllerDetection);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener("gamepadconnected", handleControllerDetection);
    };
  }, [
    hasAskedControllerSupportThisSession,
    hasHydratedUserTilesets,
    isControllerSupportPromptVisible,
  ]);

  useEffect(() => {
    if (!isMobileGameRunning) {
      setIsMobileActionSheetVisible(false);
      setMobileActionSheetMode("quick");
      setIsMobileLogVisible(false);
    }
  }, [isMobileGameRunning]);

  useEffect(() => {
    if (!gameOverDialogShowsTombstone) {
      return;
    }
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    setIsWizardCommandsVisible(false);
  }, [gameOverDialogShowsTombstone]);

  useEffect(() => {
    if (!hideAllUiForDeferredGameOver) {
      return;
    }
    setIsPauseMenuVisible(false);
    setIsExitConfirmationVisible(false);
    setIsClientOptionsVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    setIsControllerSupportPromptVisible(false);
    setIsControllerActionWheelVisible(false);
    setControllerActionWheelMode("quick");
    setControllerActionWheelChosenIndex(0);
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    setIsWizardCommandsVisible(false);
    setInventoryContextMenu(null);
    setInventoryDropTypeMenuPosition(null);
    setInventoryDropCountDialog(null);
    setTileContextMenuPosition(null);
    setPositionRequest(null);
    setCharacterSheetInterceptionArmed(false);
    characterSheetAwaitingInfoRef.current = false;
    controller?.dismissFpsCrosshairContextMenu();
    controller?.closeInfoMenuDialog();
    controller?.closeInventoryDialog();
  }, [controller, hideAllUiForDeferredGameOver, setPositionRequest]);

  useEffect(() => {
    if (isMobileGameRunning || isDesktopGameRunning) {
      return;
    }
    setIsControllerActionWheelVisible(false);
    setControllerActionWheelMode("quick");
    setControllerActionWheelChosenIndex(0);
  }, [isDesktopGameRunning, isMobileGameRunning]);
  return {
    hasGameplayOverlayOpen,
  } as const;
}
