import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { CharacterCreationConfig, Nethack3DEngineController } from "../../../game/ui-types";
import {
  nh3dCloseControllerActionWheelEventName,
  nh3dToggleControllerActionWheelEventName
} from "../../../game/ui-types";
import {
  augmentRuntimeCommandNames
} from "../../../game/slashem-command-capabilities";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  sanitizeStartupInitOptionTokens
} from "../../../runtime/startup-init-options";
import {
  resolveCharacterCommandActions
} from "../../modals/character-sheet";
import type * as React from "react";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";
import {
  commonExtendedCommandWhitelist,
  fallbackExtendedCommandNames,
  fallbackWizardExtendedCommandNames,
  isWizardExtendedCommandName
} from "../menus/extended-commands";
import {
  createControllerActionWheelEntries
} from "../controller/action-wheel";
import {
  mobileActions
} from "../menus/mobile-actions";
import type {
  ControllerActionWheelEntry
} from "../controller/action-wheel";

/** Controller wheel, wizard commands, character command definitions and callbacks */
export function useCommandActionsState() {
  const [isMobileActionSheetVisible, setIsMobileActionSheetVisible] =
    useState(false);

  const [mobileActionSheetMode, setMobileActionSheetMode] =
    useState<MobileActionSheetMode>("quick");

  const [isControllerActionWheelVisible, setIsControllerActionWheelVisible] =
    useState(false);

  const [controllerActionWheelMode, setControllerActionWheelMode] =
    useState<MobileActionSheetMode>("quick");

  const [
    controllerActionWheelChosenIndex,
    setControllerActionWheelChosenIndex,
  ] = useState(0);
  return {
    isMobileActionSheetVisible,
    setIsMobileActionSheetVisible,
    mobileActionSheetMode,
    setMobileActionSheetMode,
    isControllerActionWheelVisible,
    setIsControllerActionWheelVisible,
    controllerActionWheelMode,
    setControllerActionWheelMode,
    controllerActionWheelChosenIndex,
    setControllerActionWheelChosenIndex,
  } as const;
}

/** Controller wheel, wizard commands, character command definitions and callbacks */
export function useCommandActionsRefs() {
  const controllerActionWheelDialogRef = useRef<HTMLDivElement | null>(null);

  const [isMobileLogVisible, setIsMobileLogVisible] = useState(false);

  const [isWizardCommandsVisible, setIsWizardCommandsVisible] = useState(false);

  const wizardCommandsButtonRef = useRef<HTMLButtonElement | null>(null);

  const wizardCommandsSheetRef = useRef<HTMLDivElement | null>(null);
  return {
    controllerActionWheelDialogRef,
    isMobileLogVisible,
    setIsMobileLogVisible,
    isWizardCommandsVisible,
    setIsWizardCommandsVisible,
    wizardCommandsButtonRef,
    wizardCommandsSheetRef,
  } as const;
}

export interface UseCommandActionsCommandsDependencies {
  readonly extendedCommands: string[];
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly runtimeVersion: NethackRuntimeVersion;
  readonly isMobileGameRunning: boolean;
  readonly isDesktopGameRunning: boolean;
  readonly setIsControllerActionWheelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setControllerActionWheelMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  readonly setControllerActionWheelChosenIndex: React.Dispatch<React.SetStateAction<number>>;
  readonly setIsWizardCommandsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly controller: Nethack3DEngineController | null;
  readonly setIsMobileActionSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setMobileActionSheetMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  readonly setIsMobileLogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsExitConfirmationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsPauseMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Controller wheel, wizard commands, character command definitions and callbacks */
export function useCommandActionsCommands(dependencies: UseCommandActionsCommandsDependencies) {
  const {
    extendedCommands,
    activeRuntimeVersion,
    characterCreationConfig,
    runtimeVersion,
    isMobileGameRunning,
    isDesktopGameRunning,
    setIsControllerActionWheelVisible,
    setControllerActionWheelMode,
    setControllerActionWheelChosenIndex,
    setIsWizardCommandsVisible,
    controller,
    setIsMobileActionSheetVisible,
    setMobileActionSheetMode,
    setIsMobileLogVisible,
    setIsExitConfirmationVisible,
    setIsPauseMenuVisible,
  } = dependencies;

  const mobileExtendedCommandNames = useMemo(() => {
    const rawCommands =
      Array.isArray(extendedCommands) && extendedCommands.length > 0
        ? extendedCommands
        : fallbackExtendedCommandNames;
    const uniqueCommands: string[] = [];
    const seen = new Set<string>();
    for (const rawCommand of rawCommands) {
      const normalized = String(rawCommand || "")
        .trim()
        .toLowerCase();
      if (!normalized || normalized === "#" || normalized === "?") {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      uniqueCommands.push(normalized);
    }
    return augmentRuntimeCommandNames(activeRuntimeVersion, uniqueCommands);
  }, [activeRuntimeVersion, extendedCommands]);

  const mobileCommonExtendedCommandNames = useMemo(() => {
    const available = new Set(mobileExtendedCommandNames);
    return commonExtendedCommandWhitelist.filter((command) =>
      available.has(command),
    );
  }, [mobileExtendedCommandNames]);

  const isWizardModeSession = useMemo(() => {
    if (!characterCreationConfig) {
      return false;
    }
    const initOptionTokens = sanitizeStartupInitOptionTokens(
      characterCreationConfig.initOptions,
      characterCreationConfig.runtimeVersion ?? runtimeVersion,
    );
    for (const token of initOptionTokens) {
      const normalizedToken = String(token || "")
        .trim()
        .toLowerCase();
      if (!normalizedToken.startsWith("playmode:")) {
        continue;
      }
      const playmodeValue = normalizedToken.slice("playmode:".length).trim();
      return playmodeValue === "debug";
    }
    return false;
  }, [characterCreationConfig, runtimeVersion]);

  const wizardExtendedCommandNames = useMemo(() => {
    const availableWizardCommands = mobileExtendedCommandNames.filter(
      isWizardExtendedCommandName,
    );
    return availableWizardCommands.length > 0
      ? availableWizardCommands
      : fallbackWizardExtendedCommandNames;
  }, [mobileExtendedCommandNames]);

  const wizardCommandsSupported =
    (isMobileGameRunning || isDesktopGameRunning) &&
    isWizardModeSession &&
    wizardExtendedCommandNames.length > 0;

  const controllerActionWheelEntries = useMemo(
    () => createControllerActionWheelEntries(mobileActions),
    [],
  );

  const characterCommandActions = useMemo(
    () =>
      resolveCharacterCommandActions(
        mobileExtendedCommandNames,
        activeRuntimeVersion,
      ),
    [activeRuntimeVersion, mobileExtendedCommandNames],
  );

  const closeControllerActionWheel = useCallback((): void => {
    setIsControllerActionWheelVisible(false);
    setControllerActionWheelMode("quick");
    setControllerActionWheelChosenIndex(0);
  }, []);

  const closeWizardCommands = useCallback((): void => {
    setIsWizardCommandsVisible(false);
  }, []);

  const openPauseMenu = useCallback((): void => {
    if (!isMobileGameRunning && !isDesktopGameRunning) {
      return;
    }
    controller?.dismissFpsCrosshairContextMenu();
    closeControllerActionWheel();
    closeWizardCommands();
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    setIsExitConfirmationVisible(false);
    setIsPauseMenuVisible(true);
  }, [
    closeControllerActionWheel,
    closeWizardCommands,
    controller,
    isDesktopGameRunning,
    isMobileGameRunning,
  ]);

  const toggleWizardCommands = useCallback((): void => {
    if (!wizardCommandsSupported) {
      return;
    }
    controller?.dismissFpsCrosshairContextMenu();
    setIsWizardCommandsVisible((visible) => {
      const nextVisible = !visible;
      if (nextVisible) {
        closeControllerActionWheel();
        setIsMobileActionSheetVisible(false);
        setMobileActionSheetMode("quick");
        setIsMobileLogVisible(false);
      }
      return nextVisible;
    });
  }, [closeControllerActionWheel, controller, wizardCommandsSupported]);

  const runWizardExtendedCommand = useCallback(
    (command: string): void => {
      controller?.dismissFpsCrosshairContextMenu();
      controller?.runExtendedCommand(command);
      closeWizardCommands();
    },
    [closeWizardCommands, controller],
  );

  const runControllerWheelEntry = useCallback(
    (action: ControllerActionWheelEntry): void => {
      controller?.dismissFpsCrosshairContextMenu();
      if (action.id === "extended") {
        setControllerActionWheelMode("extended");
        return;
      }
      if (action.kind === "quick") {
        controller?.runQuickAction(action.value);
      } else {
        controller?.runExtendedCommand(action.value);
      }
      closeControllerActionWheel();
    },
    [closeControllerActionWheel, controller],
  );

  const runControllerWheelExtendedCommand = useCallback(
    (command: string): void => {
      controller?.dismissFpsCrosshairContextMenu();
      controller?.runExtendedCommand(command);
      closeControllerActionWheel();
    },
    [closeControllerActionWheel, controller],
  );
  return {
    mobileExtendedCommandNames,
    mobileCommonExtendedCommandNames,
    wizardExtendedCommandNames,
    wizardCommandsSupported,
    controllerActionWheelEntries,
    characterCommandActions,
    closeControllerActionWheel,
    closeWizardCommands,
    openPauseMenu,
    toggleWizardCommands,
    runWizardExtendedCommand,
    runControllerWheelEntry,
    runControllerWheelExtendedCommand,
  } as const;
}

export interface UseCommandActionsEffectsDependencies {
  readonly loadingOverlayVisible: boolean;
  readonly isMobileGameRunning: boolean;
  readonly isDesktopGameRunning: boolean;
  readonly controller: Nethack3DEngineController | null;
  readonly closeWizardCommands: () => void;
  readonly setIsMobileActionSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setMobileActionSheetMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  readonly setIsControllerActionWheelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setControllerActionWheelMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  readonly setControllerActionWheelChosenIndex: React.Dispatch<React.SetStateAction<number>>;
  readonly closeControllerActionWheel: () => void;
  readonly isControllerActionWheelVisible: boolean;
  readonly controllerActionWheelDialogRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly controllerActionWheelMode: MobileActionSheetMode;
  readonly controllerActionWheelEntries: ControllerActionWheelEntry[];
  readonly mobileCommonExtendedCommandNames: string[];
  readonly mobileExtendedCommandNames: string[];
  readonly wizardCommandsSupported: boolean;
  readonly setIsWizardCommandsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isWizardCommandsVisible: boolean;
  readonly wizardCommandsButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  readonly wizardCommandsSheetRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly wizardExtendedCommandNames: string[];
}

/** Controller wheel, wizard commands, character command definitions and callbacks */
export function useCommandActionsEffects(dependencies: UseCommandActionsEffectsDependencies) {
  const {
    loadingOverlayVisible,
    isMobileGameRunning,
    isDesktopGameRunning,
    controller,
    closeWizardCommands,
    setIsMobileActionSheetVisible,
    setMobileActionSheetMode,
    setIsControllerActionWheelVisible,
    setControllerActionWheelMode,
    setControllerActionWheelChosenIndex,
    closeControllerActionWheel,
    isControllerActionWheelVisible,
    controllerActionWheelDialogRef,
    controllerActionWheelMode,
    controllerActionWheelEntries,
    mobileCommonExtendedCommandNames,
    mobileExtendedCommandNames,
    wizardCommandsSupported,
    setIsWizardCommandsVisible,
    isWizardCommandsVisible,
    wizardCommandsButtonRef,
    wizardCommandsSheetRef,
    wizardExtendedCommandNames,
  } = dependencies;

  useEffect(() => {
    if (loadingOverlayVisible || typeof window === "undefined") {
      return;
    }
    const handleControllerActionWheelToggle = (event: Event): void => {
      if (event.cancelable) {
        event.preventDefault();
      }
      if (!isMobileGameRunning && !isDesktopGameRunning) {
        return;
      }
      controller?.dismissFpsCrosshairContextMenu();
      closeWizardCommands();
      setIsMobileActionSheetVisible(false);
      setMobileActionSheetMode("quick");
      setIsControllerActionWheelVisible((wasVisible) => {
        const nextVisible = !wasVisible;
        if (nextVisible) {
          setControllerActionWheelMode("quick");
          setControllerActionWheelChosenIndex(0);
        }
        return nextVisible;
      });
    };
    const handleControllerActionWheelClose = (event: Event): void => {
      if (event.cancelable) {
        event.preventDefault();
      }
      closeControllerActionWheel();
    };
    window.addEventListener(
      nh3dToggleControllerActionWheelEventName,
      handleControllerActionWheelToggle,
    );
    window.addEventListener(
      nh3dCloseControllerActionWheelEventName,
      handleControllerActionWheelClose,
    );
    return () => {
      window.removeEventListener(
        nh3dToggleControllerActionWheelEventName,
        handleControllerActionWheelToggle,
      );
      window.removeEventListener(
        nh3dCloseControllerActionWheelEventName,
        handleControllerActionWheelClose,
      );
    };
  }, [
    closeControllerActionWheel,
    closeWizardCommands,
    controller,
    isDesktopGameRunning,
    isMobileGameRunning,
    loadingOverlayVisible,
  ]);

  useEffect(() => {
    if (
      !isControllerActionWheelVisible ||
      loadingOverlayVisible ||
      typeof window === "undefined"
    ) {
      return;
    }
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeControllerActionWheel();
    };
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target && controllerActionWheelDialogRef.current?.contains(target)) {
        return;
      }
      closeControllerActionWheel();
    };
    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [
    closeControllerActionWheel,
    isControllerActionWheelVisible,
    loadingOverlayVisible,
  ]);

  useEffect(() => {
    if (
      !isControllerActionWheelVisible ||
      loadingOverlayVisible ||
      controllerActionWheelMode !== "quick"
    ) {
      return;
    }
    const dialog = controllerActionWheelDialogRef.current;
    if (!dialog) {
      return;
    }
    const syncChosenIndexFromElement = (element: HTMLElement | null): void => {
      const wheelArc = element?.closest<HTMLElement>("[data-nh3d-wheel-index]");
      if (!wheelArc || !dialog.contains(wheelArc)) {
        return;
      }
      const rawIndex = Number.parseInt(
        wheelArc.dataset.nh3dWheelIndex || "",
        10,
      );
      if (!Number.isFinite(rawIndex) || rawIndex < 0) {
        return;
      }
      setControllerActionWheelChosenIndex((previous) =>
        previous === rawIndex ? previous : rawIndex,
      );
    };
    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      syncChosenIndexFromElement(target);
    };
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    syncChosenIndexFromElement(activeElement);
    dialog.addEventListener("focusin", handleFocusIn);
    return () => {
      dialog.removeEventListener("focusin", handleFocusIn);
    };
  }, [
    controllerActionWheelMode,
    isControllerActionWheelVisible,
    controllerActionWheelEntries.length,
    loadingOverlayVisible,
  ]);

  useEffect(() => {
    if (
      !isControllerActionWheelVisible ||
      loadingOverlayVisible ||
      controllerActionWheelMode !== "extended"
    ) {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }
    const overlay = controllerActionWheelDialogRef.current;
    if (!overlay) {
      return;
    }
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeElement && overlay.contains(activeElement)) {
      return;
    }
    const timerId = window.setTimeout(() => {
      const firstExtendedButton = overlay.querySelector<HTMLElement>(
        ".nh3d-controller-action-wheel-extended .nh3d-mobile-actions-button:not(:disabled)",
      );
      firstExtendedButton?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    isControllerActionWheelVisible,
    controllerActionWheelMode,
    mobileCommonExtendedCommandNames.length,
    mobileExtendedCommandNames.length,
    loadingOverlayVisible,
  ]);

  useEffect(() => {
    if (wizardCommandsSupported) {
      return;
    }
    setIsWizardCommandsVisible(false);
  }, [wizardCommandsSupported]);

  useEffect(() => {
    if (
      !isWizardCommandsVisible ||
      loadingOverlayVisible ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeWizardCommands();
    };
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target && wizardCommandsButtonRef.current?.contains(target)) {
        return;
      }
      if (target && wizardCommandsSheetRef.current?.contains(target)) {
        return;
      }
      closeWizardCommands();
    };
    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [closeWizardCommands, isWizardCommandsVisible, loadingOverlayVisible]);

  useEffect(() => {
    if (!isWizardCommandsVisible || typeof window === "undefined") {
      return;
    }
    const focusTimerId = window.setTimeout(() => {
      const firstWizardCommandButton =
        wizardCommandsSheetRef.current?.querySelector<HTMLElement>(
          ".nh3d-mobile-actions-button:not(:disabled)",
        );
      firstWizardCommandButton?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(focusTimerId);
    };
  }, [isWizardCommandsVisible, wizardExtendedCommandNames.length]);

}
