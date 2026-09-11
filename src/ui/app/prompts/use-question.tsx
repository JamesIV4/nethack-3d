import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { CharacterCreationConfig, FpsCrosshairContextState, InfoMenuState, QuestionDialogState, InventoryDialogState, Nethack3DEngineController, NewGamePromptState, TextInputRequestState } from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  parseCastSpellMenu
} from "../../modals/cast-menu";
import {
  parseTechniqueMenu
} from "../../modals/technique-menu";
import {
  parseEnhanceMenu
} from "../../modals/enhance-menu";
import type * as React from "react";
import type {
  MessageInfoMenuHistoryState
} from "../menus/message-history";
import {
  buildLegacyInventoryQuestionMenuItems,
  getMenuSelectionInput,
  isAdjustLetterQuestionPrompt,
  isLegacyInventoryQuestionChoicePrompt,
  isSelectableQuestionMenuItem,
  isSymbolLookupTextQuestion,
  isYesNoChoicePrompt,
  orderQuestionChoicesForDisplay,
  parseQuestionChoices,
  shouldUseCompactQuestionChoiceLayout
} from "../menus/question-choices";
import {
  capitalizeFirstLetter
} from "../shared/text";
import type {
  InventoryContextAction,
  InventoryContextMenuState
} from "../inventory/types";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";
import type { ConfirmationDialogState } from "../../modals/useConfirmationDialog";


export interface UseQuestionStateDependencies {
  readonly setMessageInfoMenuHistory: React.Dispatch<React.SetStateAction<MessageInfoMenuHistoryState>>;
  readonly characterCreationConfig: CharacterCreationConfig | null;
}

/** Question choice/menu derivation and initial focus */
export function useQuestionState(dependencies: UseQuestionStateDependencies) {
  const {
    setMessageInfoMenuHistory,
    characterCreationConfig,
  } = dependencies;

  const questionTextInputRef = useRef<HTMLInputElement | null>(null);

  const [questionTextInputValue, setQuestionTextInputValue] = useState("");

  useEffect(() => {
    setMessageInfoMenuHistory({
      entries: [],
      index: 0,
    });
  }, [characterCreationConfig]);
  return {
    questionTextInputRef,
    questionTextInputValue,
    setQuestionTextInputValue,
  } as const;
}

export interface UseQuestionModelDependencies {
  readonly question: QuestionDialogState | null;
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly displayedInfoMenu: InfoMenuState | null;
  readonly inventory: InventoryDialogState;
  readonly isMobileViewport: boolean;
}

/** Question choice/menu derivation and initial focus */
export function useQuestionModel(dependencies: UseQuestionModelDependencies) {
  const {
    question,
    activeRuntimeVersion,
    displayedInfoMenu,
    inventory,
    isMobileViewport,
  } = dependencies;

  const parsedQuestionChoices = question
    ? parseQuestionChoices(question.text, question.choices)
    : [];

  const hideLegacySlashEmInventoryShortcuts =
    activeRuntimeVersion === "slashem" &&
    parsedQuestionChoices.some((choice) => choice.trim() === "*");

  const visibleQuestionChoices = hideLegacySlashEmInventoryShortcuts
    ? parsedQuestionChoices.filter((choice) => {
      const normalizedChoice = choice.trim();
      return normalizedChoice !== "*" && normalizedChoice !== "?";
    })
    : parsedQuestionChoices;

  const orderedQuestionChoices = orderQuestionChoicesForDisplay(
    visibleQuestionChoices,
    activeRuntimeVersion,
  );

  const shouldRenderQuestionTextInput =
    Boolean(question) &&
    (question?.menuItems.length ?? 0) === 0 &&
    orderedQuestionChoices.length === 0 &&
    isSymbolLookupTextQuestion(question?.text ?? "", question?.choices ?? "");

  const isYesNoQuestionChoices = isYesNoChoicePrompt(visibleQuestionChoices);

  const isAdjustLetterQuestion = isAdjustLetterQuestionPrompt(
    question?.text ?? "",
  );

  const useInventoryChoiceLabels =
    !isYesNoQuestionChoices && !isAdjustLetterQuestion;

  const normalizedVisibleQuestionChoiceSignature = visibleQuestionChoices
    .map((choice) =>
      String(choice || "")
        .trim()
        .toLowerCase(),
    )
    .filter((choice) => choice.length > 0)
    .join("");

  const suppressQuestionCancelButton =
    normalizedVisibleQuestionChoiceSignature === "yn" ||
    normalizedVisibleQuestionChoiceSignature === "ynq" ||
    normalizedVisibleQuestionChoiceSignature === "ynaq";

  const showLegacyInventoryQuestionCancelButton =
    isLegacyInventoryQuestionChoicePrompt(
      question?.text ?? "",
      visibleQuestionChoices,
      activeRuntimeVersion,
      isYesNoQuestionChoices,
    );

  const useCompactQuestionChoiceLayout = shouldUseCompactQuestionChoiceLayout(
    question?.text ?? "",
    orderedQuestionChoices,
    activeRuntimeVersion,
    isYesNoQuestionChoices,
  );

  const showQuestionCancelButton =
    Boolean(question) &&
    !suppressQuestionCancelButton &&
    ((question?.menuItems.length ?? 0) === 0 ||
      showLegacyInventoryQuestionCancelButton);

  const displayedQuestionText = capitalizeFirstLetter(question?.text ?? "");

  const displayedQuestionPendingCount =
    typeof question?.pendingSelectionCount === "number" &&
      Number.isFinite(question.pendingSelectionCount) &&
      question.pendingSelectionCount > 0
      ? Math.trunc(question.pendingSelectionCount)
      : null;

  const showQuestionAmountControls = Boolean(
    question?.supportsSelectionCount,
  );

  const questionMenuPageIndex = question?.menuPageIndex ?? 0;

  const questionMenuPageCount = Math.max(1, question?.menuPageCount ?? 1);

  const enhanceMenuData = useMemo(
    () =>
      question ? parseEnhanceMenu(question.text, question.menuItems) : null,
    [question],
  );

  const infoEnhanceMenuData = useMemo(
    () =>
      displayedInfoMenu
        ? parseEnhanceMenu(displayedInfoMenu.title, displayedInfoMenu.lines)
        : null,
    [displayedInfoMenu],
  );

  const castMenuData = useMemo(
    () =>
      question ? parseCastSpellMenu(question.text, question.menuItems) : null,
    [question],
  );

  const techniqueMenuData = useMemo(
    () =>
      question ? parseTechniqueMenu(question.text, question.menuItems) : null,
    [question],
  );

  const legacyInventoryQuestionMenuItems = useMemo(
    () =>
      question && question.menuItems.length === 0
        ? buildLegacyInventoryQuestionMenuItems(
          question.text,
          orderedQuestionChoices,
          inventory.items,
          activeRuntimeVersion,
          isYesNoQuestionChoices,
        )
        : [],
    [
      activeRuntimeVersion,
      inventory.items,
      isYesNoQuestionChoices,
      orderedQuestionChoices,
      question,
    ],
  );

  const displayedQuestionMenuItems =
    question && question.menuItems.length > 0
      ? question.menuItems
      : legacyInventoryQuestionMenuItems;

  const useSlashEmLegacyShortcutChoiceDialog =
    activeRuntimeVersion === "slashem" &&
    Boolean(question) &&
    showLegacyInventoryQuestionCancelButton &&
    !question?.isPickupDialog;

  const questionChoiceSourceItems =
    displayedQuestionMenuItems.length > 0
      ? displayedQuestionMenuItems
      : inventory.items;

  const shouldRenderQuestionMenuItems =
    displayedQuestionMenuItems.length > 0 &&
    !useSlashEmLegacyShortcutChoiceDialog;

  const questionSelectableMenuItemCount = displayedQuestionMenuItems.filter(
    (item) => isSelectableQuestionMenuItem(item),
  ).length;

  const showPickupActionButtons =
    Boolean(question?.isPickupDialog) &&
    (questionSelectableMenuItemCount > 0 || isMobileViewport);

  const showPickupToggleAllButton =
    Boolean(question?.isPickupDialog) && questionSelectableMenuItemCount > 1;
  return {
    orderedQuestionChoices,
    shouldRenderQuestionTextInput,
    isYesNoQuestionChoices,
    useInventoryChoiceLabels,
    useCompactQuestionChoiceLayout,
    showQuestionCancelButton,
    displayedQuestionText,
    displayedQuestionPendingCount,
    showQuestionAmountControls,
    questionMenuPageIndex,
    questionMenuPageCount,
    enhanceMenuData,
    infoEnhanceMenuData,
    castMenuData,
    techniqueMenuData,
    displayedQuestionMenuItems,
    useSlashEmLegacyShortcutChoiceDialog,
    questionChoiceSourceItems,
    shouldRenderQuestionMenuItems,
    questionSelectableMenuItemCount,
    showPickupActionButtons,
    showPickupToggleAllButton,
  } as const;
}

export interface UseQuestionInputDependencies {
  readonly questionTextInputValue: string;
  readonly controller: Nethack3DEngineController | null;
  readonly setQuestionTextInputValue: React.Dispatch<React.SetStateAction<string>>;
  readonly shouldRenderQuestionTextInput: boolean;
  readonly questionTextInputRef: React.MutableRefObject<HTMLInputElement | null>;
  readonly question: QuestionDialogState | null;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly directionQuestion: string | null;
  readonly infoMenu: InfoMenuState | null;
  readonly inventory: InventoryDialogState;
  readonly isClientOptionsVisible: boolean;
  readonly isControllerRemapVisible: boolean;
  readonly isDarkWallTilePickerVisible: boolean;
  readonly isTilesetBackgroundTilePickerVisible: boolean;
  readonly isTilesetManagerVisible: boolean;
  readonly isTilesetSolidColorPickerVisible: boolean;
  readonly newGamePrompt: NewGamePromptState;
  readonly textInputRequest: TextInputRequestState | null;
  readonly inventoryContextMenu: InventoryContextMenuState | null;
  readonly inventoryContextMenuActions: InventoryContextAction[];
  readonly fpsCrosshairContext: FpsCrosshairContextState | null;
  readonly tileContextMenuPosition: { x: number; y: number; } | null;
  readonly isWizardCommandsVisible: boolean;
  readonly isControllerActionWheelVisible: boolean;
  readonly controllerActionWheelMode: MobileActionSheetMode;
  readonly globalConfirmationDialog: ConfirmationDialogState | null;
  readonly loadingOverlayVisible: boolean;
}

/** Question choice/menu derivation and initial focus */
export function useQuestionInput(dependencies: UseQuestionInputDependencies) {
  const {
    questionTextInputValue,
    controller,
    setQuestionTextInputValue,
    shouldRenderQuestionTextInput,
    questionTextInputRef,
    question,
    characterCreationConfig,
    directionQuestion,
    infoMenu,
    inventory,
    isClientOptionsVisible,
    isControllerRemapVisible,
    isDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    isTilesetManagerVisible,
    isTilesetSolidColorPickerVisible,
    newGamePrompt,
    textInputRequest,
    inventoryContextMenu,
    inventoryContextMenuActions,
    fpsCrosshairContext,
    tileContextMenuPosition,
    isWizardCommandsVisible,
    isControllerActionWheelVisible,
    controllerActionWheelMode,
    globalConfirmationDialog,
    loadingOverlayVisible,
  } = dependencies;

  const submitQuestionTextInput = useCallback((): void => {
    const answer = questionTextInputValue.charAt(0);
    if (!answer) {
      controller?.cancelActivePrompt();
      return;
    }
    controller?.chooseQuestionChoice(answer);
    setQuestionTextInputValue("");
  }, [controller, questionTextInputValue]);

  useEffect(() => {
    if (!shouldRenderQuestionTextInput) {
      setQuestionTextInputValue("");
      return;
    }
    setQuestionTextInputValue("");
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        questionTextInputRef.current?.focus();
      }, 0);
    }
  }, [question?.text, shouldRenderQuestionTextInput]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const visibleOverlays = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".nh3d-context-menu.is-visible, .nh3d-dialog.is-visible, #position-dialog.is-visible, .nh3d-wizard-commands-sheet.is-visible, #loading:not(.is-hidden)",
      ),
    ).filter((element) => {
      if (!element.isConnected) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return element.getClientRects().length > 0;
    });
    if (visibleOverlays.length === 0) {
      return;
    }

    let topOverlay = visibleOverlays[0];
    let topOverlayZIndex =
      Number.parseInt(window.getComputedStyle(topOverlay).zIndex, 10) || 0;
    for (let index = 1; index < visibleOverlays.length; index += 1) {
      const candidate = visibleOverlays[index];
      const zIndex =
        Number.parseInt(window.getComputedStyle(candidate).zIndex, 10) || 0;
      if (
        zIndex > topOverlayZIndex ||
        (zIndex === topOverlayZIndex && index > 0)
      ) {
        topOverlay = candidate;
        topOverlayZIndex = zIndex;
      }
    }

    if (topOverlay.id === "text-input-dialog") {
      return;
    }

    if (topOverlay.id === "loading") {
      topOverlay.focus({ preventScroll: true });
      return;
    }

    const focusableSelector = [
      ".nh3d-context-menu-button:not(:disabled)",
      "button:not(:disabled):not(.nh3d-mobile-dialog-close)",
      "summary",
      "a[href]",
      "input:not(:disabled):not([tabindex='-1'])",
      "select:not(:disabled)",
      "textarea:not(:disabled)",
      '[role="button"][tabindex="0"]',
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const explicitActiveTarget = topOverlay.querySelector<HTMLElement>(
      ".nh3d-menu-button.nh3d-menu-button-active, button.nh3d-enhance-skill-card.nh3d-menu-button-active, button.nh3d-cast-row.nh3d-menu-button-active, button.nh3d-technique-row.nh3d-menu-button-active, .nh3d-pickup-item.nh3d-pickup-item-active, .nh3d-menu-action-button.nh3d-action-button-active, .nh3d-pickup-action-button.nh3d-action-button-active",
    );
    const firstContextActionButton = topOverlay.classList.contains(
      "nh3d-context-menu",
    )
      ? topOverlay.querySelector<HTMLElement>(
        ".nh3d-context-menu-button:not(:disabled)",
      )
      : null;
    const firstActionWheelButton = topOverlay.classList.contains(
      "nh3d-controller-action-wheel-dialog",
    )
      ? topOverlay.querySelector<HTMLElement>(
        "[data-nh3d-wheel-angle]:not(:disabled), .nh3d-controller-action-wheel-extended .nh3d-mobile-actions-button:not(:disabled)",
      )
      : null;
    const firstSelectableButton =
      topOverlay.querySelector<HTMLElement>(focusableSelector);
    const activeElement =
      typeof document.activeElement === "object" &&
        document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const activeElementInDialog =
      activeElement &&
        topOverlay.contains(activeElement) &&
        activeElement.matches(focusableSelector)
        ? activeElement
        : null;
    const shouldTrackExplicitActiveTarget =
      topOverlay.id === "question-dialog" ||
      topOverlay.classList.contains("nh3d-dialog-question");
    if (shouldTrackExplicitActiveTarget && explicitActiveTarget) {
      if (activeElementInDialog !== explicitActiveTarget) {
        explicitActiveTarget.focus({ preventScroll: true });
        explicitActiveTarget.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      }
      return;
    }
    const targetButton =
      activeElementInDialog ??
      firstActionWheelButton ??
      firstContextActionButton ??
      explicitActiveTarget ??
      firstSelectableButton;
    if (!targetButton) {
      return;
    }
    if (activeElementInDialog) {
      return;
    }
    targetButton.focus({ preventScroll: true });
  }, [
    characterCreationConfig,
    directionQuestion,
    infoMenu,
    inventory.visible,
    inventory.items,
    inventory.contextActionsEnabled,
    isClientOptionsVisible,
    isControllerRemapVisible,
    isDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    isTilesetManagerVisible,
    isTilesetSolidColorPickerVisible,
    newGamePrompt.visible,
    question,
    textInputRequest,
    inventoryContextMenu,
    inventoryContextMenuActions.length,
    fpsCrosshairContext,
    fpsCrosshairContext?.actions.length,
    tileContextMenuPosition,
    isWizardCommandsVisible,
    isControllerActionWheelVisible,
    controllerActionWheelMode,
    globalConfirmationDialog,
    loadingOverlayVisible,
  ]);
  return {
    submitQuestionTextInput,
  } as const;
}

export interface UseQuestionFocusDependencies {
  readonly question: QuestionDialogState | null;
}

/** Question choice/menu derivation and initial focus */
export function useQuestionFocus(dependencies: UseQuestionFocusDependencies) {
  const {
    question,
  } = dependencies;

  const questionInitialFocusSeed = useMemo(() => {
    if (!question) {
      return null;
    }
    const selectableKeys = question.menuItems
      .filter((item) => isSelectableQuestionMenuItem(item))
      .map((item, index) => {
        const selectionInput = getMenuSelectionInput(item).trim();
        return selectionInput.length > 0
          ? selectionInput
          : `${index}:${String(item.text || "").trim()}`;
      })
      .join("|");
    return [
      String(question.text || "").trim(),
      String(question.menuPageIndex ?? 0),
      question.activeMenuSelectionInput ?? "",
      question.activeActionButton ?? "",
      selectableKeys,
      question.isPickupDialog ? "pickup" : "question",
    ].join("|");
  }, [question]);

  const questionLastInitialFocusSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    if (!questionInitialFocusSeed) {
      questionLastInitialFocusSeedRef.current = null;
      return;
    }
    if (questionLastInitialFocusSeedRef.current === questionInitialFocusSeed) {
      return;
    }
    questionLastInitialFocusSeedRef.current = questionInitialFocusSeed;
    const timerId = window.setTimeout(() => {
      const questionDialog = document.querySelector<HTMLElement>(
        "#question-dialog.nh3d-dialog.is-visible",
      );
      if (!questionDialog) {
        return;
      }
      const activeQuestionTarget = questionDialog.querySelector<HTMLElement>(
        ".nh3d-menu-button.nh3d-menu-button-active, button.nh3d-enhance-skill-card.nh3d-menu-button-active, button.nh3d-cast-row.nh3d-menu-button-active, button.nh3d-technique-row.nh3d-menu-button-active, .nh3d-pickup-item.nh3d-pickup-item-active, .nh3d-menu-action-button.nh3d-action-button-active, .nh3d-pickup-action-button.nh3d-action-button-active",
      );
      const firstQuestionTarget = questionDialog.querySelector<HTMLElement>(
        ".nh3d-menu-button:not(:disabled), button.nh3d-enhance-skill-card:not(:disabled), button.nh3d-cast-row:not(:disabled), button.nh3d-technique-row:not(:disabled), .nh3d-pickup-item[tabindex='0'], .nh3d-choice-button:not(:disabled), .nh3d-menu-action-button:not(:disabled), .nh3d-pickup-action-button:not(:disabled)",
      );
      const focusTarget = activeQuestionTarget ?? firstQuestionTarget;
      if (!focusTarget) {
        return;
      }
      focusTarget.focus({ preventScroll: true });
      focusTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [questionInitialFocusSeed]);

}
