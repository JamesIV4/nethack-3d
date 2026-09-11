import {
  useCallback
} from "react";
import type * as React from "react";
import {
  focusControllerDialogElement,
  getControllerFocusableElements,
  getFocusedControllerRangeInput,
  handleControllerDialogKeyboardScrollKey,
  moveControllerDialogFocus,
  stepControllerRangeInput
} from "../controller/dialog-navigation";

export interface UseStartupNavigationDependencies {
  readonly startupLikelyOpenSelectElementsRef: React.MutableRefObject<Set<HTMLSelectElement>>;
  readonly startupLikelyOpenSelectInitialValueByElementRef: React.MutableRefObject<Map<HTMLSelectElement, string>>;
}

/** Handles keyboard, pointer and select navigation in startup dialogs. */
export function useStartupNavigation(dependencies: UseStartupNavigationDependencies) {
  const {
    startupLikelyOpenSelectElementsRef,
    startupLikelyOpenSelectInitialValueByElementRef,
  } = dependencies;

  const resolveStartupMenuNavigationDirection = useCallback(
    (key: string, code?: string): "up" | "down" | "left" | "right" | null => {
      switch (key) {
        case "ArrowUp":
        case "k":
        case "K":
        case "y":
        case "Y":
        case "u":
        case "U":
          return "up";
        case "ArrowDown":
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

  const applyDialogDirectionalNavigation = useCallback(
    (
      direction: "up" | "down" | "left" | "right",
      dialogRoot: HTMLElement | null,
      options?: {
        focusedSlider?: HTMLInputElement | null;
        stepFocusedSliderOnHorizontal?: boolean;
      },
    ): boolean => {
      if (!dialogRoot) {
        return false;
      }
      const focusedSlider =
        options?.focusedSlider ?? getFocusedControllerRangeInput(dialogRoot);
      const stepFocusedSliderOnHorizontal =
        options?.stepFocusedSliderOnHorizontal ?? true;
      if (
        stepFocusedSliderOnHorizontal &&
        focusedSlider &&
        (direction === "left" || direction === "right")
      ) {
        return stepControllerRangeInput(
          focusedSlider,
          direction === "left" ? -1 : 1,
        );
      }
      if (moveControllerDialogFocus(direction)) {
        return true;
      }
      const focusable = getControllerFocusableElements(dialogRoot);
      if (focusable.length === 0) {
        return false;
      }
      const targetElement =
        direction === "up" || direction === "left"
          ? focusable[focusable.length - 1]
          : focusable[0];
      focusControllerDialogElement(targetElement);
      return true;
    },
    [],
  );

  const handleInfoMenuDialogKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        if (
          handleControllerDialogKeyboardScrollKey(
            event.currentTarget,
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (event.key === "Home" || event.key === "End") {
        const focusable = getControllerFocusableElements(event.currentTarget);
        if (focusable.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const targetElement =
          event.key === "End" ? focusable[focusable.length - 1] : focusable[0];
        focusControllerDialogElement(targetElement);
        return;
      }

      const direction = resolveStartupMenuNavigationDirection(
        event.key,
        event.code,
      );
      if (!direction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyDialogDirectionalNavigation(direction, event.currentTarget, {
        stepFocusedSliderOnHorizontal: false,
      });
    },
    [applyDialogDirectionalNavigation, resolveStartupMenuNavigationDirection],
  );

  const handleStartupMainMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement | null;
      const targetSelect = target instanceof HTMLSelectElement ? target : null;
      const selectLikelyOpen = !!targetSelect
        ? startupLikelyOpenSelectElementsRef.current.has(targetSelect)
        : false;
      if (targetSelect) {
        const closeLikelyOpenSelect = (): void => {
          const previousValue =
            startupLikelyOpenSelectInitialValueByElementRef.current.get(
              targetSelect,
            ) ?? targetSelect.value;
          startupLikelyOpenSelectElementsRef.current.delete(targetSelect);
          startupLikelyOpenSelectInitialValueByElementRef.current.delete(
            targetSelect,
          );
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              if (!targetSelect.isConnected) {
                return;
              }
              if (targetSelect.value !== previousValue) {
                targetSelect.dispatchEvent(
                  new Event("input", { bubbles: true }),
                );
                targetSelect.dispatchEvent(
                  new Event("change", { bubbles: true }),
                );
              }
              targetSelect.blur();
            });
          }
        };
        if (selectLikelyOpen) {
          if (
            event.key === "Enter" ||
            event.key === "NumpadEnter" ||
            event.key === " " ||
            event.key === "Space" ||
            event.key === "Spacebar"
          ) {
            if (
              event.key === " " ||
              event.key === "Space" ||
              event.key === "Spacebar"
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
            closeLikelyOpenSelect();
            return;
          }
          if (event.key === "Escape") {
            startupLikelyOpenSelectElementsRef.current.delete(targetSelect);
            startupLikelyOpenSelectInitialValueByElementRef.current.delete(
              targetSelect,
            );
            return;
          }
          return;
        }
        const opensSelect =
          event.key === "F4" ||
          event.key === "Enter" ||
          event.key === "NumpadEnter" ||
          event.key === " " ||
          event.key === "Space" ||
          event.key === "Spacebar" ||
          ((event.key === "ArrowDown" || event.key === "ArrowUp") &&
            event.altKey);
        if (opensSelect) {
          startupLikelyOpenSelectElementsRef.current.add(targetSelect);
          startupLikelyOpenSelectInitialValueByElementRef.current.set(
            targetSelect,
            targetSelect.value,
          );
          return;
        }
        // Let focused selects keep native keyboard ownership for changing values.
        return;
      }
      const targetInput = target instanceof HTMLInputElement ? target : null;
      const targetInputType = String(targetInput?.type || "").toLowerCase();
      const targetRangeInput =
        targetInput && targetInputType === "range" && !targetInput.disabled
          ? targetInput
          : null;
      if (targetRangeInput) {
        const inputDirection = resolveStartupMenuNavigationDirection(
          event.key,
          event.code,
        );
        if (inputDirection) {
          event.preventDefault();
          event.stopPropagation();
          applyDialogDirectionalNavigation(
            inputDirection,
            event.currentTarget,
            {
              focusedSlider: targetRangeInput,
            },
          );
          return;
        }
      }
      const isTextLikeInput =
        !!targetInput &&
        targetInputType !== "checkbox" &&
        targetInputType !== "radio" &&
        targetInputType !== "range" &&
        targetInputType !== "color" &&
        targetInputType !== "button" &&
        targetInputType !== "submit" &&
        targetInputType !== "reset";
      if (
        target &&
        (isTextLikeInput ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        // Do not hijack keyboard input from editable fields during startup
        // character creation; keep typing, selection, and caret movement native.
        return;
      }

      if (
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        if (
          handleControllerDialogKeyboardScrollKey(
            event.currentTarget,
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (event.key === "Home" || event.key === "End") {
        const focusable = getControllerFocusableElements(event.currentTarget);
        if (focusable.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const targetElement =
          event.key === "End" ? focusable[focusable.length - 1] : focusable[0];
        focusControllerDialogElement(targetElement);
        return;
      }

      const direction = resolveStartupMenuNavigationDirection(
        event.key,
        event.code,
      );
      if (!direction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyDialogDirectionalNavigation(direction, event.currentTarget, {
        stepFocusedSliderOnHorizontal: false,
      });
    },
    [
      applyDialogDirectionalNavigation,
      resolveStartupMenuNavigationDirection,
    ],
  );

  const handleStartupMainMenuPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        startupLikelyOpenSelectElementsRef.current.add(target);
        startupLikelyOpenSelectInitialValueByElementRef.current.set(
          target,
          target.value,
        );
      } else {
        startupLikelyOpenSelectElementsRef.current.clear();
        startupLikelyOpenSelectInitialValueByElementRef.current.clear();
      }
    },
    [],
  );

  const handleStartupMainMenuBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        startupLikelyOpenSelectElementsRef.current.delete(target);
        startupLikelyOpenSelectInitialValueByElementRef.current.delete(target);
      }
    },
    [],
  );

  const handleStartupMainMenuChangeCapture = useCallback(
    (event: React.FormEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        startupLikelyOpenSelectElementsRef.current.delete(target);
        startupLikelyOpenSelectInitialValueByElementRef.current.delete(target);
      }
    },
    [],
  );
  return {
    resolveStartupMenuNavigationDirection,
    applyDialogDirectionalNavigation,
    handleInfoMenuDialogKeyDown,
    handleStartupMainMenuKeyDown,
    handleStartupMainMenuPointerDownCapture,
    handleStartupMainMenuBlurCapture,
    handleStartupMainMenuChangeCapture,
  } as const;
}
