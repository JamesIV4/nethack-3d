import {
  useEffect
} from "react";
import type { InfoMenuState, NewGamePromptState, GameOverState, QuestionDialogState, TextInputRequestState, InventoryDialogState } from "../../../game/ui-types";
import type * as React from "react";
import {
  t
} from "../shared/translations";

export interface UseKeyboardOverlaysDependencies {
  readonly newGamePrompt: NewGamePromptState;
  readonly setReopenNewGamePromptOnInteraction: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setDeferredNewGamePromptReason: React.Dispatch<React.SetStateAction<string | null>>;
  readonly gameOver: GameOverState;
  readonly reopenNewGamePromptOnInteraction: boolean;
  readonly loadingOverlayVisible: boolean;
  readonly question: QuestionDialogState | null;
  readonly infoMenu: InfoMenuState | null;
  readonly textInputRequest: TextInputRequestState | null;
  readonly directionQuestion: string | null;
  readonly inventory: InventoryDialogState;
  readonly setNewGamePrompt: (prompt: NewGamePromptState) => void;
  readonly restoreDeferredNewGamePrompt: () => void;
}

/** Restores deferred replay prompts when gameplay input resumes. */
export function useKeyboardOverlays(dependencies: UseKeyboardOverlaysDependencies) {
  const {
    newGamePrompt,
    setReopenNewGamePromptOnInteraction,
    setDeferredNewGamePromptReason,
    gameOver,
    reopenNewGamePromptOnInteraction,
    loadingOverlayVisible,
    question,
    infoMenu,
    textInputRequest,
    directionQuestion,
    inventory,
    setNewGamePrompt,
    restoreDeferredNewGamePrompt,
  } = dependencies;

  useEffect(() => {
    if (!newGamePrompt.visible) {
      return;
    }
    setReopenNewGamePromptOnInteraction(false);
    if (
      typeof newGamePrompt.reason === "string" &&
      newGamePrompt.reason.trim().length > 0
    ) {
      setDeferredNewGamePromptReason(newGamePrompt.reason.trim());
    }
  }, [newGamePrompt.reason, newGamePrompt.visible]);

  useEffect(() => {
    if (!gameOver.active || !gameOver.promptReady) {
      return;
    }
    if (
      newGamePrompt.visible ||
      reopenNewGamePromptOnInteraction ||
      loadingOverlayVisible
    ) {
      return;
    }
    if (
      question ||
      infoMenu ||
      textInputRequest ||
      directionQuestion ||
      inventory.visible
    ) {
      return;
    }
    setNewGamePrompt({
      visible: true,
      reason:
        typeof gameOver.deathMessage === "string" &&
          gameOver.deathMessage.trim()
          ? gameOver.deathMessage.trim()
          : t.dialogs.newGamePrompt.reasonFallback,
    });
  }, [
    directionQuestion,
    gameOver.active,
    gameOver.deathMessage,
    gameOver.promptReady,
    infoMenu,
    inventory.visible,
    loadingOverlayVisible,
    newGamePrompt.visible,
    question,
    reopenNewGamePromptOnInteraction,
    setNewGamePrompt,
    textInputRequest,
  ]);

  useEffect(() => {
    if (
      !reopenNewGamePromptOnInteraction ||
      newGamePrompt.visible ||
      loadingOverlayVisible ||
      typeof window === "undefined"
    ) {
      return;
    }
    let handled = false;
    const tapMaxDurationMs = 250;
    const tapMaxMovePx = 12;
    let activeTouchId: number | null = null;
    let touchStartedAtMs = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTapEligible = false;
    let multiTouchGestureSeen = false;
    const handleFirstInteraction = (): void => {
      if (handled) {
        return;
      }
      handled = true;
      restoreDeferredNewGamePrompt();
    };

    const handleInteractionMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0) {
        return;
      }
      handleFirstInteraction();
    };

    const handleInteractionTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1 || event.changedTouches.length < 1) {
        multiTouchGestureSeen = true;
        touchTapEligible = false;
        activeTouchId = null;
        return;
      }
      const touch = event.changedTouches[0];
      activeTouchId = touch.identifier;
      touchStartedAtMs = performance.now();
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchTapEligible = true;
      multiTouchGestureSeen = false;
    };

    const handleInteractionTouchMove = (event: TouchEvent): void => {
      if (event.touches.length !== 1 || activeTouchId === null) {
        multiTouchGestureSeen = true;
        touchTapEligible = false;
        return;
      }
      const activeTouch = Array.from(event.touches).find(
        (touch) => touch.identifier === activeTouchId,
      );
      if (!activeTouch) {
        touchTapEligible = false;
        return;
      }
      if (
        Math.hypot(
          activeTouch.clientX - touchStartX,
          activeTouch.clientY - touchStartY,
        ) > tapMaxMovePx
      ) {
        touchTapEligible = false;
      }
    };

    const resetInteractionTouchState = (): void => {
      activeTouchId = null;
      touchTapEligible = false;
      multiTouchGestureSeen = false;
      touchStartedAtMs = 0;
    };

    const handleInteractionTouchEnd = (event: TouchEvent): void => {
      if (activeTouchId === null || multiTouchGestureSeen || !touchTapEligible) {
        resetInteractionTouchState();
        return;
      }
      const endedTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === activeTouchId,
      );
      if (!endedTouch) {
        return;
      }
      const tapDurationMs = performance.now() - touchStartedAtMs;
      const tapDistancePx = Math.hypot(
        endedTouch.clientX - touchStartX,
        endedTouch.clientY - touchStartY,
      );
      const shouldHandleTap =
        event.touches.length === 0 &&
        tapDurationMs <= tapMaxDurationMs &&
        tapDistancePx <= tapMaxMovePx;
      resetInteractionTouchState();
      if (shouldHandleTap) {
        handleFirstInteraction();
      }
    };

    const handleInteractionKey = (event: KeyboardEvent): void => {
      if (
        event.key !== "Enter" &&
        event.key !== "NumpadEnter" &&
        event.key !== " " &&
        event.key !== "Space" &&
        event.key !== "Spacebar"
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleFirstInteraction();
    };

    window.addEventListener("mousedown", handleInteractionMouseDown, true);
    window.addEventListener("touchstart", handleInteractionTouchStart, true);
    window.addEventListener("touchmove", handleInteractionTouchMove, true);
    window.addEventListener("touchend", handleInteractionTouchEnd, true);
    window.addEventListener("touchcancel", resetInteractionTouchState, true);
    window.addEventListener("keydown", handleInteractionKey, true);
    return () => {
      window.removeEventListener(
        "mousedown",
        handleInteractionMouseDown,
        true,
      );
      window.removeEventListener(
        "touchstart",
        handleInteractionTouchStart,
        true,
      );
      window.removeEventListener("touchmove", handleInteractionTouchMove, true);
      window.removeEventListener("touchend", handleInteractionTouchEnd, true);
      window.removeEventListener(
        "touchcancel",
        resetInteractionTouchState,
        true,
      );
      window.removeEventListener("keydown", handleInteractionKey, true);
    };
  }, [
    newGamePrompt.visible,
    reopenNewGamePromptOnInteraction,
    restoreDeferredNewGamePrompt,
    loadingOverlayVisible,
  ]);

}
