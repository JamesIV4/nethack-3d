import {
  useCallback,
  useEffect,
  useRef
} from "react";
import type { CharacterCreationConfig, Nh3dClientOptions, Nethack3DEngineController } from "../../../game/ui-types";
import {
  normalizeNh3dControllerBindings,
  type Nh3dControllerActionId
} from "../../../game/controller-bindings";
import type * as React from "react";
import type {
  InventoryDropCountDialogState
} from "../inventory/types";
import type {
  ControllerRemapListeningState
} from "./binding-capture";
import type {
  StartupFlowStep
} from "../startup/character-preferences";
import {
  clickControllerDialogElementAtPoint,
  clickFocusedControllerDialogElement,
  findControllerScrollableElement,
  getFocusedControllerRangeInput,
  getTopVisibleControllerDialogElement,
  stepControllerRangeInput
} from "./dialog-navigation";
import {
  getConnectedGamepadsForCapture,
  getControllerActionValueFromGamepads,
  startupControllerActionThreshold,
  startupControllerCursorDeadzone,
  startupControllerCursorSpeedPxPerSec,
  startupControllerNavActionIds,
  startupControllerScrollSpeedPxPerSec,
  startupControllerSliderFastStepsPerSec
} from "./binding-capture";

export interface UseStartupControllerDependencies {
  readonly loadingOverlayVisible: boolean;
  readonly toggleDeferredGameOverTombstoneUi: () => boolean;
  readonly inventoryDropCountDialog: InventoryDropCountDialogState | null;
  readonly closeInventoryDropCountModal: () => void;
  readonly isControllerSupportPromptVisible: boolean;
  readonly confirmControllerSupportPromptChoice: (enabled: boolean) => void;
  readonly isPauseMenuVisible: boolean;
  readonly isExitConfirmationVisible: boolean;
  readonly setIsExitConfirmationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsPauseMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isClientOptionsVisible: boolean;
  readonly controllerRemapListening: ControllerRemapListeningState | null;
  readonly clearControllerBindingCapture: () => void;
  readonly isControllerRemapVisible: boolean;
  readonly closeControllerRemapDialog: () => void;
  readonly isResetClientOptionsConfirmationVisible: boolean;
  readonly setIsResetClientOptionsConfirmationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isTilesetManagerVisible: boolean;
  readonly closeTilesetManager: () => void;
  readonly isDarkWallTilePickerVisible: boolean;
  readonly setIsDarkWallTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isTilesetBackgroundTilePickerVisible: boolean;
  readonly setIsTilesetBackgroundTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isTilesetSolidColorPickerVisible: boolean;
  readonly setIsTilesetSolidColorPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly requestCloseClientOptionsDialog: () => void;
  readonly positionInputActive: boolean;
  readonly isDesktopGameRunning: boolean;
  readonly isMobileGameRunning: boolean;
  readonly hasGameplayOverlayOpen: boolean;
  readonly openPauseMenu: () => void;
  readonly clientOptions: Nh3dClientOptions;
  readonly controller: Nethack3DEngineController | null;
  readonly startupControllerCursorHighlightElementRef: React.MutableRefObject<HTMLElement | null>;
  readonly startupControllerCursorElementRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly startupControllerCursorPulseElementRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly startupControllerCursorVisibleRef: React.MutableRefObject<boolean>;
  readonly startupControllerCursorXRef: React.MutableRefObject<number>;
  readonly startupControllerCursorYRef: React.MutableRefObject<number>;
  readonly startupControllerCursorPulseTimerRef: React.MutableRefObject<number | null>;
  readonly startupControllerActiveSliderElementRef: React.MutableRefObject<HTMLInputElement | null>;
  readonly startupMenuVisible: boolean;
  readonly startupControllerPreviousActionActiveRef: React.MutableRefObject<Partial<Record<Nh3dControllerActionId, boolean>>>;
  readonly startupAccordionConfirmReleaseLatchRef: React.MutableRefObject<boolean>;
  readonly startupControllerSliderInteractionActiveRef: React.MutableRefObject<boolean>;
  readonly startupControllerSliderStepCarryRef: React.MutableRefObject<number>;
  readonly clientOptionsDraft: Nh3dClientOptions;
  readonly applyDialogDirectionalNavigation: (direction: "left" | "right" | "up" | "down", dialogRoot: HTMLElement | null, options?: { focusedSlider?: HTMLInputElement | null | undefined; stepFocusedSliderOnHorizontal?: boolean | undefined; } | undefined) => boolean;
  readonly startupFlowStep: StartupFlowStep;
  readonly setStartupFlowStep: React.Dispatch<React.SetStateAction<StartupFlowStep>>;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly startup: boolean;
}

/** Routes gamepad input through startup dialogs, controls and cursor navigation. */
export function useStartupController(dependencies: UseStartupControllerDependencies) {
  const {
    loadingOverlayVisible,
    toggleDeferredGameOverTombstoneUi,
    inventoryDropCountDialog,
    closeInventoryDropCountModal,
    isControllerSupportPromptVisible,
    confirmControllerSupportPromptChoice,
    isPauseMenuVisible,
    isExitConfirmationVisible,
    setIsExitConfirmationVisible,
    setIsPauseMenuVisible,
    isClientOptionsVisible,
    controllerRemapListening,
    clearControllerBindingCapture,
    isControllerRemapVisible,
    closeControllerRemapDialog,
    isResetClientOptionsConfirmationVisible,
    setIsResetClientOptionsConfirmationVisible,
    isTilesetManagerVisible,
    closeTilesetManager,
    isDarkWallTilePickerVisible,
    setIsDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    setIsTilesetBackgroundTilePickerVisible,
    isTilesetSolidColorPickerVisible,
    setIsTilesetSolidColorPickerVisible,
    requestCloseClientOptionsDialog,
    positionInputActive,
    isDesktopGameRunning,
    isMobileGameRunning,
    hasGameplayOverlayOpen,
    openPauseMenu,
    clientOptions,
    controller,
    startupControllerCursorHighlightElementRef,
    startupControllerCursorElementRef,
    startupControllerCursorPulseElementRef,
    startupControllerCursorVisibleRef,
    startupControllerCursorXRef,
    startupControllerCursorYRef,
    startupControllerCursorPulseTimerRef,
    startupControllerActiveSliderElementRef,
    startupMenuVisible,
    startupControllerPreviousActionActiveRef,
    startupAccordionConfirmReleaseLatchRef,
    startupControllerSliderInteractionActiveRef,
    startupControllerSliderStepCarryRef,
    clientOptionsDraft,
    applyDialogDirectionalNavigation,
    startupFlowStep,
    setStartupFlowStep,
    characterCreationConfig,
    startup,
  } = dependencies;

  useEffect(() => {
    if (loadingOverlayVisible || typeof window === "undefined") {
      return;
    }

    const handleEscapeForClientOptions = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (toggleDeferredGameOverTombstoneUi()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
      if (inventoryDropCountDialog) {
        event.preventDefault();
        event.stopPropagation();
        closeInventoryDropCountModal();
        return;
      }
      if (isControllerSupportPromptVisible) {
        event.preventDefault();
        event.stopPropagation();
        confirmControllerSupportPromptChoice(false);
        return;
      }

      if (isPauseMenuVisible) {
        event.preventDefault();
        event.stopPropagation();
        if (isExitConfirmationVisible) {
          setIsExitConfirmationVisible(false);
        } else {
          setIsPauseMenuVisible(false);
        }
        return;
      }

      if (isClientOptionsVisible) {
        event.preventDefault();
        event.stopPropagation();
        if (controllerRemapListening) {
          clearControllerBindingCapture();
          return;
        }
        if (isControllerRemapVisible) {
          closeControllerRemapDialog();
          return;
        }
        if (isResetClientOptionsConfirmationVisible) {
          setIsResetClientOptionsConfirmationVisible(false);
          return;
        }
        if (isTilesetManagerVisible) {
          closeTilesetManager();
          return;
        }
        if (isDarkWallTilePickerVisible) {
          setIsDarkWallTilePickerVisible(false);
          return;
        }
        if (isTilesetBackgroundTilePickerVisible) {
          setIsTilesetBackgroundTilePickerVisible(false);
          return;
        }
        if (isTilesetSolidColorPickerVisible) {
          setIsTilesetSolidColorPickerVisible(false);
          return;
        }
        requestCloseClientOptionsDialog();
        return;
      }

      if (positionInputActive) {
        return;
      }

      // XR B arrives through the same key route as gameplay's Back command.
      if (document.documentElement.classList.contains("nh3d-webxr-active") &&
          document.documentElement.classList.contains("nh3d-xr-menu") &&
          startupFlowStep !== "variant") {
        event.preventDefault();
        event.stopPropagation();
        setStartupFlowStep(startupFlowStep === "choose" ? "variant" : "choose");
        return;
      }

      if ((!isDesktopGameRunning && !isMobileGameRunning) || hasGameplayOverlayOpen) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openPauseMenu();
    };

    window.addEventListener("keydown", handleEscapeForClientOptions, true);
    return () => {
      window.removeEventListener("keydown", handleEscapeForClientOptions, true);
    };
  }, [
    clientOptions,
    clearControllerBindingCapture,
    closeControllerRemapDialog,
    closeInventoryDropCountModal,
    confirmControllerSupportPromptChoice,
    controller,
    controllerRemapListening,
    hasGameplayOverlayOpen,
    isClientOptionsVisible,
    inventoryDropCountDialog,
    positionInputActive,
    isControllerSupportPromptVisible,
    isControllerRemapVisible,
    isDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    isTilesetSolidColorPickerVisible,
    isTilesetManagerVisible,
    isResetClientOptionsConfirmationVisible,
    isPauseMenuVisible,
    isExitConfirmationVisible,
    isDesktopGameRunning,
    isMobileGameRunning,
    loadingOverlayVisible,
    openPauseMenu,
    toggleDeferredGameOverTombstoneUi,
    startupFlowStep,
    setStartupFlowStep,
  ]);

  const clearStartupControllerCursorHighlight = useCallback((): void => {
    const highlightedElement =
      startupControllerCursorHighlightElementRef.current;
    if (highlightedElement) {
      highlightedElement.classList.remove("nh3d-controller-hover-target");
      startupControllerCursorHighlightElementRef.current = null;
    }
  }, []);

  const ensureStartupControllerCursorOverlay = useCallback((): void => {
    if (
      startupControllerCursorElementRef.current &&
      startupControllerCursorPulseElementRef.current
    ) {
      return;
    }
    const cursor = document.createElement("div");
    cursor.className =
      "nh3d-controller-virtual-cursor nh3d-controller-virtual-cursor-app";
    cursor.setAttribute("aria-hidden", "true");
    cursor.style.display = "none";
    const pulse = document.createElement("div");
    pulse.className =
      "nh3d-controller-virtual-cursor-pulse nh3d-controller-virtual-cursor-pulse-app";
    pulse.setAttribute("aria-hidden", "true");
    pulse.style.display = "none";
    document.body.appendChild(cursor);
    document.body.appendChild(pulse);
    startupControllerCursorElementRef.current = cursor;
    startupControllerCursorPulseElementRef.current = pulse;
  }, []);

  const setStartupControllerCursorVisible = useCallback(
    (visible: boolean): void => {
      ensureStartupControllerCursorOverlay();
      startupControllerCursorVisibleRef.current = visible;
      const cursor = startupControllerCursorElementRef.current;
      if (cursor) {
        cursor.style.display = visible ? "block" : "none";
      }
      if (!visible) {
        clearStartupControllerCursorHighlight();
      }
    },
    [
      clearStartupControllerCursorHighlight,
      ensureStartupControllerCursorOverlay,
    ],
  );

  const updateStartupControllerCursorHighlightAtPoint = useCallback(
    (clientX: number, clientY: number): void => {
      const target = document.elementFromPoint(clientX, clientY);
      const highlightedCandidate =
        target instanceof HTMLElement
          ? ((target.closest(
            "button, summary, [role='button'], a, input:not([tabindex='-1']), select, textarea, label, [tabindex]",
          ) as HTMLElement | null) ?? target)
          : null;
      const previousHighlight =
        startupControllerCursorHighlightElementRef.current;
      if (previousHighlight && previousHighlight !== highlightedCandidate) {
        previousHighlight.classList.remove("nh3d-controller-hover-target");
        startupControllerCursorHighlightElementRef.current = null;
      }
      if (
        highlightedCandidate &&
        highlightedCandidate !== previousHighlight &&
        highlightedCandidate.isConnected
      ) {
        highlightedCandidate.classList.add("nh3d-controller-hover-target");
        startupControllerCursorHighlightElementRef.current =
          highlightedCandidate;
      }
    },
    [],
  );

  const setStartupControllerCursorPosition = useCallback(
    (clientX: number, clientY: number): void => {
      ensureStartupControllerCursorOverlay();
      const clampedX = Math.max(0, Math.min(window.innerWidth, clientX));
      const clampedY = Math.max(0, Math.min(window.innerHeight, clientY));
      startupControllerCursorXRef.current = clampedX;
      startupControllerCursorYRef.current = clampedY;
      const cursor = startupControllerCursorElementRef.current;
      if (cursor) {
        cursor.style.left = `${Math.round(clampedX)}px`;
        cursor.style.top = `${Math.round(clampedY)}px`;
      }
      if (startupControllerCursorVisibleRef.current) {
        updateStartupControllerCursorHighlightAtPoint(clampedX, clampedY);
      }
    },
    [
      ensureStartupControllerCursorOverlay,
      updateStartupControllerCursorHighlightAtPoint,
    ],
  );

  const ensureStartupControllerCursorSeedPosition = useCallback((): void => {
    if (
      Number.isFinite(startupControllerCursorXRef.current) &&
      Number.isFinite(startupControllerCursorYRef.current)
    ) {
      return;
    }
    const topDialog = getTopVisibleControllerDialogElement();
    if (topDialog) {
      const rect = topDialog.getBoundingClientRect();
      setStartupControllerCursorPosition(
        rect.left + rect.width * 0.5,
        rect.top + rect.height * 0.5,
      );
      return;
    }
    setStartupControllerCursorPosition(
      window.innerWidth * 0.5,
      window.innerHeight * 0.5,
    );
  }, [setStartupControllerCursorPosition]);

  const pulseStartupControllerCursor = useCallback((): void => {
    const pulse = startupControllerCursorPulseElementRef.current;
    const x = startupControllerCursorXRef.current;
    const y = startupControllerCursorYRef.current;
    if (!pulse || !Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    pulse.style.left = `${Math.round(x)}px`;
    pulse.style.top = `${Math.round(y)}px`;
    pulse.style.display = "block";
    pulse.classList.remove("is-active");
    void pulse.offsetWidth;
    pulse.classList.add("is-active");
    if (startupControllerCursorPulseTimerRef.current !== null) {
      window.clearTimeout(startupControllerCursorPulseTimerRef.current);
      startupControllerCursorPulseTimerRef.current = null;
    }
    startupControllerCursorPulseTimerRef.current = window.setTimeout(() => {
      pulse.classList.remove("is-active");
      pulse.style.display = "none";
      startupControllerCursorPulseTimerRef.current = null;
    }, 260);
  }, []);

  const resetStartupControllerCursor = useCallback((): void => {
    startupControllerCursorVisibleRef.current = false;
    if (startupControllerCursorElementRef.current) {
      startupControllerCursorElementRef.current.style.display = "none";
    }
    if (startupControllerCursorPulseTimerRef.current !== null) {
      window.clearTimeout(startupControllerCursorPulseTimerRef.current);
      startupControllerCursorPulseTimerRef.current = null;
    }
    if (startupControllerCursorPulseElementRef.current) {
      startupControllerCursorPulseElementRef.current.classList.remove(
        "is-active",
      );
      startupControllerCursorPulseElementRef.current.style.display = "none";
    }
    clearStartupControllerCursorHighlight();
  }, [clearStartupControllerCursorHighlight]);

  const clearStartupControllerActiveSliderVisual = useCallback((): void => {
    const previousSlider = startupControllerActiveSliderElementRef.current;
    if (previousSlider && previousSlider.isConnected) {
      previousSlider.classList.remove("nh3d-controller-slider-active");
    }
    startupControllerActiveSliderElementRef.current = null;
  }, []);

  const setStartupControllerActiveSliderVisual = useCallback(
    (slider: HTMLInputElement | null): void => {
      const previousSlider = startupControllerActiveSliderElementRef.current;
      if (
        previousSlider &&
        previousSlider !== slider &&
        previousSlider.isConnected
      ) {
        previousSlider.classList.remove("nh3d-controller-slider-active");
      }
      startupControllerActiveSliderElementRef.current = slider;
      if (slider && slider.isConnected) {
        slider.classList.add("nh3d-controller-slider-active");
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const startupControllerContextActive =
      startupMenuVisible && !loadingOverlayVisible;
    if (!startupControllerContextActive) {
      startupControllerPreviousActionActiveRef.current = {};
      startupAccordionConfirmReleaseLatchRef.current = false;
      startupControllerSliderInteractionActiveRef.current = false;
      startupControllerSliderStepCarryRef.current = 0;
      clearStartupControllerActiveSliderVisual();
      resetStartupControllerCursor();
      return;
    }

    ensureStartupControllerCursorOverlay();
    let frameHandle = 0;
    let lastFrameAtMs = performance.now();

    const tick = (nowMs: number): void => {
      const deltaSeconds = Math.max(
        0,
        Math.min(0.2, (nowMs - lastFrameAtMs) / 1000),
      );
      lastFrameAtMs = nowMs;

      const sourceOptions = isClientOptionsVisible
        ? clientOptionsDraft
        : clientOptions;
      const controllerSupportEnabled =
        sourceOptions.controllerEnabled === true ||
        isControllerSupportPromptVisible;
      if (!controllerSupportEnabled || document.documentElement.classList.contains("nh3d-webxr-active")) {
        startupControllerPreviousActionActiveRef.current = {};
        startupAccordionConfirmReleaseLatchRef.current = false;
        startupControllerSliderInteractionActiveRef.current = false;
        startupControllerSliderStepCarryRef.current = 0;
        clearStartupControllerActiveSliderVisual();
        resetStartupControllerCursor();
        frameHandle = window.requestAnimationFrame(tick);
        return;
      }

      const bindings = normalizeNh3dControllerBindings(
        sourceOptions.controllerBindings,
      );
      const gamepads = getConnectedGamepadsForCapture();
      const previousActionActive =
        startupControllerPreviousActionActiveRef.current;
      const nextActionActive: Partial<Record<Nh3dControllerActionId, boolean>> =
        {};
      const actionPressed: Partial<Record<Nh3dControllerActionId, boolean>> =
        {};
      const actionValues: Partial<Record<Nh3dControllerActionId, number>> = {};

      for (const actionId of startupControllerNavActionIds) {
        const value = getControllerActionValueFromGamepads(
          actionId,
          bindings,
          gamepads,
        );
        actionValues[actionId] = value;
        const isActive = value >= startupControllerActionThreshold;
        const wasActive = previousActionActive[actionId] === true;
        actionPressed[actionId] = isActive && !wasActive;
        nextActionActive[actionId] = isActive;
      }
      startupControllerPreviousActionActiveRef.current = nextActionActive;

      if (controllerRemapListening) {
        startupControllerSliderInteractionActiveRef.current = false;
        startupControllerSliderStepCarryRef.current = 0;
        clearStartupControllerActiveSliderVisual();
        if (actionPressed.cancel_or_context) {
          clearControllerBindingCapture();
        }
        frameHandle = window.requestAnimationFrame(tick);
        return;
      }

      const topDialog = getTopVisibleControllerDialogElement();
      const focusedSlider = getFocusedControllerRangeInput(topDialog);
      if (!focusedSlider) {
        startupControllerSliderInteractionActiveRef.current = false;
        startupControllerSliderStepCarryRef.current = 0;
        clearStartupControllerActiveSliderVisual();
      }

      if (
        focusedSlider &&
        actionPressed.confirm &&
        !startupControllerSliderInteractionActiveRef.current &&
        !startupAccordionConfirmReleaseLatchRef.current
      ) {
        startupControllerSliderInteractionActiveRef.current = true;
        startupControllerSliderStepCarryRef.current = 0;
        startupAccordionConfirmReleaseLatchRef.current = true;
        setStartupControllerActiveSliderVisual(focusedSlider);
        setStartupControllerCursorVisible(false);
        frameHandle = window.requestAnimationFrame(tick);
        return;
      }

      if (startupControllerSliderInteractionActiveRef.current) {
        if (!focusedSlider) {
          startupControllerSliderInteractionActiveRef.current = false;
          startupControllerSliderStepCarryRef.current = 0;
          clearStartupControllerActiveSliderVisual();
        } else {
          setStartupControllerActiveSliderVisual(focusedSlider);
          if (actionPressed.cancel_or_context) {
            startupControllerSliderInteractionActiveRef.current = false;
            startupControllerSliderStepCarryRef.current = 0;
            clearStartupControllerActiveSliderVisual();
            frameHandle = window.requestAnimationFrame(tick);
            return;
          }

          const dpadStepDirection = actionPressed.dpad_right
            ? 1
            : actionPressed.dpad_left
              ? -1
              : 0;
          if (dpadStepDirection !== 0) {
            stepControllerRangeInput(focusedSlider, dpadStepDirection);
          }

          const sliderAxisX =
            (actionValues.left_stick_right ?? 0) -
            (actionValues.left_stick_left ?? 0);
          if (Math.abs(sliderAxisX) > startupControllerCursorDeadzone) {
            const nextStepCarry =
              startupControllerSliderStepCarryRef.current +
              sliderAxisX *
              startupControllerSliderFastStepsPerSec *
              deltaSeconds;
            const fastStepCount =
              nextStepCarry > 0
                ? Math.floor(nextStepCarry)
                : Math.ceil(nextStepCarry);
            startupControllerSliderStepCarryRef.current =
              nextStepCarry - fastStepCount;
            if (fastStepCount !== 0) {
              stepControllerRangeInput(focusedSlider, fastStepCount);
            }
          } else {
            startupControllerSliderStepCarryRef.current = 0;
          }

          frameHandle = window.requestAnimationFrame(tick);
          return;
        }
      }

      let focusDirection: "up" | "down" | "left" | "right" | null = null;
      if (actionPressed.dpad_up) {
        focusDirection = "up";
      } else if (actionPressed.dpad_down) {
        focusDirection = "down";
      } else if (actionPressed.dpad_left) {
        focusDirection = "left";
      } else if (actionPressed.dpad_right) {
        focusDirection = "right";
      }
      if (focusDirection) {
        setStartupControllerCursorVisible(false);
        applyDialogDirectionalNavigation(focusDirection, topDialog, {
          focusedSlider,
        });
      }

      const leftAxisX =
        (actionValues.left_stick_right ?? 0) -
        (actionValues.left_stick_left ?? 0);
      const leftAxisY =
        (actionValues.left_stick_down ?? 0) - (actionValues.left_stick_up ?? 0);
      const leftAxisMagnitude = Math.hypot(leftAxisX, leftAxisY);
      if (leftAxisMagnitude > startupControllerCursorDeadzone) {
        ensureStartupControllerCursorSeedPosition();
        setStartupControllerCursorVisible(true);
        const nextCursorX =
          startupControllerCursorXRef.current +
          leftAxisX * startupControllerCursorSpeedPxPerSec * deltaSeconds;
        const nextCursorY =
          startupControllerCursorYRef.current +
          leftAxisY * startupControllerCursorSpeedPxPerSec * deltaSeconds;
        setStartupControllerCursorPosition(nextCursorX, nextCursorY);
      }

      const scrollAxisY =
        (actionValues.right_stick_down ?? 0) -
        (actionValues.right_stick_up ?? 0);
      if (Math.abs(scrollAxisY) > 0.02) {
        const scrollElement = findControllerScrollableElement(topDialog);
        if (scrollElement) {
          scrollElement.scrollTop +=
            scrollAxisY * startupControllerScrollSpeedPxPerSec * deltaSeconds;
        }
      }

      const confirmValue = actionValues.confirm ?? 0;
      if (confirmValue <= 0.12) {
        startupAccordionConfirmReleaseLatchRef.current = false;
      }

      if (
        actionPressed.confirm &&
        !controllerRemapListening &&
        !startupAccordionConfirmReleaseLatchRef.current
      ) {
        let confirmConsumed = false;
        const clickedElement =
          startupControllerCursorVisibleRef.current &&
            Number.isFinite(startupControllerCursorXRef.current) &&
            Number.isFinite(startupControllerCursorYRef.current)
            ? clickControllerDialogElementAtPoint(
              startupControllerCursorXRef.current,
              startupControllerCursorYRef.current,
            )
            : null;
        if (clickedElement) {
          pulseStartupControllerCursor();
          confirmConsumed = true;
        } else {
          const focusedClickElement = clickFocusedControllerDialogElement();
          if (focusedClickElement) {
            confirmConsumed = true;
          }
        }
        if (confirmConsumed) {
          startupAccordionConfirmReleaseLatchRef.current = true;
        }
      }

      if (actionPressed.cancel_or_context) {
        if (isControllerSupportPromptVisible) {
          confirmControllerSupportPromptChoice(false);
        } else if (controllerRemapListening) {
          clearControllerBindingCapture();
        } else if (isControllerRemapVisible) {
          closeControllerRemapDialog();
        } else if (isClientOptionsVisible) {
          requestCloseClientOptionsDialog();
        } else if (startupFlowStep === "choose") {
          setStartupFlowStep("variant");
        } else if (startupFlowStep !== "variant") {
          setStartupFlowStep("choose");
        }
      }

      frameHandle = window.requestAnimationFrame(tick);
    };

    frameHandle = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameHandle);
      startupControllerPreviousActionActiveRef.current = {};
      startupAccordionConfirmReleaseLatchRef.current = false;
      startupControllerSliderInteractionActiveRef.current = false;
      startupControllerSliderStepCarryRef.current = 0;
      clearStartupControllerActiveSliderVisual();
      resetStartupControllerCursor();
    };
  }, [
    applyDialogDirectionalNavigation,
    characterCreationConfig,
    clearStartupControllerActiveSliderVisual,
    clearControllerBindingCapture,
    clientOptions,
    clientOptionsDraft,
    closeControllerRemapDialog,
    confirmControllerSupportPromptChoice,
    controllerRemapListening,
    ensureStartupControllerCursorOverlay,
    ensureStartupControllerCursorSeedPosition,
    isClientOptionsVisible,
    isControllerSupportPromptVisible,
    isControllerRemapVisible,
    pulseStartupControllerCursor,
    resetStartupControllerCursor,
    requestCloseClientOptionsDialog,
    setStartupControllerActiveSliderVisual,
    setStartupControllerCursorPosition,
    setStartupControllerCursorVisible,
    startup,
    startupFlowStep,
    loadingOverlayVisible,
  ]);

}

/** Owns startup controller cursor visibility and coordinates. */
export function useStartupControllerCursorState() {
  const startupControllerCursorVisibleRef = useRef(false);

  const startupControllerCursorXRef = useRef<number>(Number.NaN);

  const startupControllerCursorYRef = useRef<number>(Number.NaN);
  return {
    startupControllerCursorVisibleRef,
    startupControllerCursorXRef,
    startupControllerCursorYRef,
  } as const;
}
