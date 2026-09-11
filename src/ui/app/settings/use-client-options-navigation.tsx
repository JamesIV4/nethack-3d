import {
  useCallback
} from "react";
import type * as React from "react";
import {
  focusControllerDialogElement,
  getControllerFocusableElements,
  handleControllerDialogKeyboardScrollKey
} from "../controller/dialog-navigation";

export interface UseClientOptionsNavigationDependencies {
  readonly clientOptionsLikelyOpenSelectElementsRef: React.MutableRefObject<Set<HTMLSelectElement>>;
  readonly clientOptionsLikelyOpenSelectInitialValueByElementRef: React.MutableRefObject<Map<HTMLSelectElement, string>>;
  readonly resolveStartupMenuNavigationDirection: (key: string, code?: string | undefined) => "left" | "right" | "up" | "down" | null;
  readonly applyDialogDirectionalNavigation: (direction: "left" | "right" | "up" | "down", dialogRoot: HTMLElement | null, options?: { focusedSlider?: HTMLInputElement | null | undefined; stepFocusedSliderOnHorizontal?: boolean | undefined; } | undefined) => boolean;
}

/** Handles keyboard, pointer and select navigation in client options. */
export function useClientOptionsNavigation(dependencies: UseClientOptionsNavigationDependencies) {
  const {
    clientOptionsLikelyOpenSelectElementsRef,
    clientOptionsLikelyOpenSelectInitialValueByElementRef,
    resolveStartupMenuNavigationDirection,
    applyDialogDirectionalNavigation,
  } = dependencies;

  const handleClientOptionsDialogKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement | null;
      const targetSelect = target instanceof HTMLSelectElement ? target : null;
      const selectLikelyOpen = !!targetSelect
        ? clientOptionsLikelyOpenSelectElementsRef.current.has(targetSelect)
        : false;
      if (targetSelect) {
        const closeLikelyOpenSelect = (): void => {
          const previousValue =
            clientOptionsLikelyOpenSelectInitialValueByElementRef.current.get(
              targetSelect,
            ) ?? targetSelect.value;
          clientOptionsLikelyOpenSelectElementsRef.current.delete(targetSelect);
          clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
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
            clientOptionsLikelyOpenSelectElementsRef.current.delete(
              targetSelect,
            );
            clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
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
          clientOptionsLikelyOpenSelectElementsRef.current.add(targetSelect);
          clientOptionsLikelyOpenSelectInitialValueByElementRef.current.set(
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
      if (targetInputType === "range" && targetInput && !targetInput.disabled) {
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
              focusedSlider: targetInput,
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
        // Do not hijack keyboard input from editable fields in options forms;
        // keep typing, selection, and caret movement native.
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

  const handleClientOptionsDialogPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        clientOptionsLikelyOpenSelectElementsRef.current.add(target);
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.set(
          target,
          target.value,
        );
      } else {
        clientOptionsLikelyOpenSelectElementsRef.current.clear();
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.clear();
      }
    },
    [],
  );

  const handleClientOptionsDialogBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        clientOptionsLikelyOpenSelectElementsRef.current.delete(target);
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
          target,
        );
      }
    },
    [],
  );

  const handleClientOptionsDialogChangeCapture = useCallback(
    (event: React.FormEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        clientOptionsLikelyOpenSelectElementsRef.current.delete(target);
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
          target,
        );
      }
    },
    [],
  );
  return {
    handleClientOptionsDialogKeyDown,
    handleClientOptionsDialogPointerDownCapture,
    handleClientOptionsDialogBlurCapture,
    handleClientOptionsDialogChangeCapture,
  } as const;
}
