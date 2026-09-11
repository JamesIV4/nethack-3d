import {
  useCallback
} from "react";
import type { CharacterCreationConfig, NewGamePromptState, GameOverState } from "../../../game/ui-types";
import {
  createEmptyGameOverPostmortemReports,
  createEmptyRunTelemetrySnapshot
} from "../../../game/ui-types";
import type * as React from "react";
import type {
  InventoryContextMenuState
} from "../inventory/types";
import type {
  ControllerRemapListeningState
} from "../controller/binding-capture";
import type {
  StartupFlowStep
} from "./character-preferences";

export interface UseNewGamePromptDependencies {
  readonly setReopenNewGamePromptOnInteraction: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setDeferredNewGamePromptReason: React.Dispatch<React.SetStateAction<string | null>>;
  readonly setNewGamePrompt: (prompt: NewGamePromptState) => void;
  readonly setGameOver: (state: GameOverState) => void;
  readonly setPositionRequest: (text: string | null) => void;
  readonly setInventoryContextMenu: React.Dispatch<React.SetStateAction<InventoryContextMenuState | null>>;
  readonly setIsPauseMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsExitConfirmationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsClientOptionsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsControllerRemapVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setControllerRemapListening: React.Dispatch<React.SetStateAction<ControllerRemapListeningState | null>>;
  readonly setIsControllerActionWheelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsMobileActionSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsMobileLogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsWizardCommandsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setCharacterSheetInterceptionArmed: React.Dispatch<React.SetStateAction<boolean>>;
  readonly characterSheetAwaitingInfoRef: React.MutableRefObject<boolean>;
  readonly setCharacterCreationConfig: React.Dispatch<React.SetStateAction<CharacterCreationConfig | null>>;
  readonly setStartupFlowStep: React.Dispatch<React.SetStateAction<StartupFlowStep>>;
  readonly newGamePrompt: NewGamePromptState;
  readonly deferredNewGamePromptReason: string | null;
  readonly gameOverDialogShowsTombstone: boolean;
  readonly hideAllUiForDeferredGameOver: boolean;
  readonly newGamePromptYesButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  readonly newGamePromptNoButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}

/** Coordinates replay prompts, deferred game-over interaction and focus. */
export function useNewGamePrompt(dependencies: UseNewGamePromptDependencies) {
  const {
    setReopenNewGamePromptOnInteraction,
    setDeferredNewGamePromptReason,
    setNewGamePrompt,
    setGameOver,
    setPositionRequest,
    setInventoryContextMenu,
    setIsPauseMenuVisible,
    setIsExitConfirmationVisible,
    setIsClientOptionsVisible,
    setIsControllerRemapVisible,
    setControllerRemapListening,
    setIsControllerActionWheelVisible,
    setIsMobileActionSheetVisible,
    setIsMobileLogVisible,
    setIsWizardCommandsVisible,
    setCharacterSheetInterceptionArmed,
    characterSheetAwaitingInfoRef,
    setCharacterCreationConfig,
    setStartupFlowStep,
    newGamePrompt,
    deferredNewGamePromptReason,
    gameOverDialogShowsTombstone,
    hideAllUiForDeferredGameOver,
    newGamePromptYesButtonRef,
    newGamePromptNoButtonRef,
  } = dependencies;

  const startNewGameFromPrompt = (): void => {
    setReopenNewGamePromptOnInteraction(false);
    setDeferredNewGamePromptReason(null);
    setNewGamePrompt({ visible: false, reason: null });
    setGameOver({
      active: false,
      deathMessage: null,
      promptReady: false,
      tombstoneLines: null,
      postmortemReports: createEmptyGameOverPostmortemReports(),
      telemetry: createEmptyRunTelemetrySnapshot(),
    });
    setPositionRequest(null);
    setInventoryContextMenu(null);
    setIsPauseMenuVisible(false);
    setIsExitConfirmationVisible(false);
    setIsClientOptionsVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    setIsControllerActionWheelVisible(false);
    setIsMobileActionSheetVisible(false);
    setIsMobileLogVisible(false);
    setIsWizardCommandsVisible(false);
    setCharacterSheetInterceptionArmed(false);
    characterSheetAwaitingInfoRef.current = false;
    setCharacterCreationConfig(null);
    setStartupFlowStep("variant");
  };

  const dismissNewGamePromptUntilInteraction = (): void => {
    const nextReason =
      typeof newGamePrompt.reason === "string" && newGamePrompt.reason.trim()
        ? newGamePrompt.reason.trim()
        : deferredNewGamePromptReason;
    setDeferredNewGamePromptReason(nextReason ?? null);
    setReopenNewGamePromptOnInteraction(true);
    setNewGamePrompt({ visible: false, reason: null });
  };

  const restoreDeferredNewGamePrompt = useCallback((): void => {
    setReopenNewGamePromptOnInteraction(false);
    setNewGamePrompt({
      visible: true,
      reason: deferredNewGamePromptReason,
    });
  }, [deferredNewGamePromptReason, setNewGamePrompt]);

  const toggleDeferredGameOverTombstoneUi = useCallback((): boolean => {
    if (gameOverDialogShowsTombstone) {
      dismissNewGamePromptUntilInteraction();
      return true;
    }
    if (hideAllUiForDeferredGameOver) {
      restoreDeferredNewGamePrompt();
      return true;
    }
    return false;
  }, [
    dismissNewGamePromptUntilInteraction,
    gameOverDialogShowsTombstone,
    hideAllUiForDeferredGameOver,
    restoreDeferredNewGamePrompt,
  ]);

  const handleNewGamePromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const actionButtons = [
        newGamePromptYesButtonRef.current,
        newGamePromptNoButtonRef.current,
      ].filter((button): button is HTMLButtonElement => Boolean(button));
      if (actionButtons.length === 0) {
        return;
      }
      const activeElement =
        typeof document !== "undefined" &&
          document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const activeIndex = activeElement
        ? actionButtons.findIndex((button) => button === activeElement)
        : -1;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        const targetIndex =
          activeIndex < 0
            ? delta > 0
              ? 0
              : actionButtons.length - 1
            : (((activeIndex + delta) % actionButtons.length) +
              actionButtons.length) %
            actionButtons.length;
        actionButtons[targetIndex]?.focus({ preventScroll: true });
        return;
      }
      if (
        event.key === "Enter" ||
        event.key === "NumpadEnter" ||
        event.key === " " ||
        event.key === "Space" ||
        event.key === "Spacebar"
      ) {
        if (
          activeIndex < 0 &&
          activeElement?.classList.contains("nh3d-mobile-dialog-close")
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (activeIndex === 1) {
          dismissNewGamePromptUntilInteraction();
        } else {
          startNewGameFromPrompt();
        }
      }
    },
    [dismissNewGamePromptUntilInteraction, startNewGameFromPrompt],
  );
  return {
    startNewGameFromPrompt,
    dismissNewGamePromptUntilInteraction,
    restoreDeferredNewGamePrompt,
    toggleDeferredGameOverTombstoneUi,
    handleNewGamePromptKeyDown,
  } as const;
}
