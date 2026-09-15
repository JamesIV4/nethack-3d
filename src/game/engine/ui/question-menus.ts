import type { RuntimeEvent } from "../../../runtime";
import { resolveBoundedQuestionAnswer } from "../../../runtime/input/question-answer";
import type { QuestionDialogState } from "../../ui-types";
import type { CharacterCreationQuestionPayload } from "../shared/types";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { DirectionPrompts } from "./direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { GameOver } from "./game-over";
import type { InputCommands } from "../input/input-commands";
import type { MenuPreviews } from "./menu-previews";
import type { PointerLock } from "../input/pointer-lock";
import type { RunTelemetry } from "../world/run-telemetry";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";
import type { WorldClassification } from "../world/world-classification";

export interface QuestionMenusDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "maybePlayDrinkSoundForQuestionAnswer"
    | "maybePlayDrinkSoundForQuestionMenuSelection"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly engineState: Pick<
    EngineState,
    "uiAdapter"
  >;
  readonly gameOver: Pick<
    GameOver,
    "flushDeferredGameOverUiReveal"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "cancelActivePrompt"
    | "menuSelectionInputPrefix"
    | "sendInput"
    | "sendInputSequence"
    | "updateNumberPadModeFromChoice"
  >;
  readonly menuPreviews: Pick<
    MenuPreviews,
    "normalizeMenuItemsForUi"
  >;
  readonly pointerLock: Pick<
    PointerLock,
    "syncFpsPointerLockForUiState"
  >;
  readonly runTelemetry: Pick<
    RunTelemetry,
    "armRecentSpellKillAttribution"
    | "captureKnownSpellsFromQuestionMenu"
    | "extractSpellNameFromMenuItemText"
    | "isSpellCastQuestionText"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveRuntimeVersion"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "getQuestionSelectionTileRefreshAction"
    | "requestPlayerTileRefresh"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "resolveLegacyHereChoicePreviewTileIndex"
  >;
}

/** Question counts, stable selections, pickup toggles, pagination and focus. */
export class QuestionMenus {
  constructor(private readonly dependencies: QuestionMenusDependencies) {}

  activeQuestionText: string = "";

  activeQuestionChoices: string = "";

  activeQuestionDefaultChoice: string = "";

  activeQuestionMenuItems: any[] = [];

  activeQuestionVisibleMenuItems: any[] = [];

  activeQuestionMenuPageIndex: number = 0;

  activeQuestionMenuPageCount: number = 1;

  activeQuestionPageSelectionMap: Map<string, string> = new Map();

  activeQuestionIsPickupDialog: boolean = false;

  activePickupSelections: Set<string> = new Set();

  activePickupSelectionCounts: Map<string, number> = new Map();

  activeQuestionPendingCountInput: string = "";

  activePickupFocusIndex: number = 0;

  activeQuestionMenuFocusIndex: number = 0;

  activeQuestionActionFocusIndex: number = -1;

  readonly questionMenuPageAccelerators: string[] =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  readonly pickupMenuObjectClassSymbols: ReadonlySet<string> = new Set([
    ")",
    "[",
    "=",
    '"',
    "(",
    "%",
    "!",
    "?",
    "+",
    "/",
    "$",
    "*",
    "`",
    "0",
    "_",
    ".",
  ]);


  // General question handling (pauses all movement)
  isInQuestion: boolean = false;

  isMultiSelectLootQuestion(question: string): boolean {
    if (typeof question !== "string") {
      return false;
    }

    const normalizedQuestion = question.trim().toLowerCase();
    return (
      normalizedQuestion.includes("pick up what") ||
      normalizedQuestion.includes("what do you want to pick up") ||
      normalizedQuestion.includes("what would you like to drop") ||
      normalizedQuestion.includes("drop what type of items") ||
      normalizedQuestion.includes("take out what") ||
      normalizedQuestion.includes("what do you want to take out") ||
      normalizedQuestion.includes("what would you like to take out") ||
      normalizedQuestion.includes("put in what") ||
      normalizedQuestion.includes("what do you want to put in") ||
      normalizedQuestion.includes("what would you like to put in") ||
      normalizedQuestion.includes("put in, then take out what") ||
      normalizedQuestion.includes("take out, then put in what")
    );
  }

  isCharacterCreationQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    if (
      normalized.includes("character") &&
      (normalized.includes("pick") ||
        normalized.includes("class") ||
        normalized.includes("race") ||
        normalized.includes("gender") ||
        normalized.includes("alignment") ||
        normalized.includes("role"))
    ) {
      return true;
    }
    return (
      normalized.includes("what kind of character") ||
      normalized.includes("what role") ||
      normalized.includes("what is your role") ||
      normalized.includes("what race") ||
      normalized.includes("what is your race") ||
      normalized.includes("what gender") ||
      normalized.includes("what is your gender") ||
      normalized.includes("what alignment") ||
      normalized.includes("what is your alignment") ||
      normalized.includes("pick a character for you") ||
      normalized.includes("shall i pick character") ||
      normalized.includes("shall i pick a character")
    );
  }

  isNumberPadModeQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.startsWith("select number_pad mode");
  }

  isFountainDrinkQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes("drink from the fountain");
  }

  isInventoryDrinkQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes("what do you want to drink");
  }

  isObjectTypeCategoryQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return (
      (normalized.includes("what type") || normalized.includes("what types")) &&
      (normalized.includes("object") ||
        normalized.includes("item") ||
        normalized.includes("thing"))
    );
  }

  isCountableSimpleInventoryQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes("what do you want to drop") ||
      normalized.includes("what would you like to drop") ||
      normalized.includes("put in what") ||
      normalized.includes("what do you want to put in") ||
      normalized.includes("what would you like to put in") ||
      normalized.includes("take out what") ||
      normalized.includes("what do you want to take out") ||
      normalized.includes("what would you like to take out")
    );
  }

  isCountableInventorySelectionQuestion(questionText: string): boolean {
    return (
      this.isMultiSelectLootQuestion(questionText) ||
      this.isCountableSimpleInventoryQuestion(questionText)
    );
  }

  findMenuCategoryLabelForItem(
    menuItems: any[],
    targetItem: any,
  ): string | null {
    if (!Array.isArray(menuItems) || !targetItem) {
      return null;
    }

    const targetIndex = menuItems.findIndex((item) => item === targetItem);
    if (targetIndex < 0) {
      return null;
    }

    let currentCategory: string | null = null;
    for (let index = 0; index <= targetIndex; index += 1) {
      const menuItem = menuItems[index];
      if (
        menuItem &&
        menuItem.isCategory &&
        typeof menuItem.text === "string" &&
        menuItem.text.trim()
      ) {
        currentCategory = menuItem.text.trim();
      }
    }

    return currentCategory;
  }

  isSpecialInventoryCategoryLabel(
    categoryLabel: string | null,
  ): boolean {
    return (
      String(categoryLabel || "")
        .trim()
        .toLowerCase() === "special"
    );
  }

  toCharacterCreationQuestionPayload(
    data: RuntimeEvent,
  ): CharacterCreationQuestionPayload {
    return {
      text: String(data.text || ""),
      choices: String(data.choices || ""),
      defaultChoice: String(data.default || ""),
      menuItems: Array.isArray(data.menuItems) ? [...data.menuItems] : [],
    };
  }

  isSelectableQuestionMenuItem(item: any): boolean {
    if (!item || item.isCategory) {
      return false;
    }
    if (typeof item.isSelectable === "boolean") {
      return item.isSelectable;
    }
    if (typeof item.identifier === "number") {
      return item.identifier !== 0;
    }
    if (Number.isInteger(item.menuIndex)) {
      return true;
    }
    return (
      typeof item.accelerator === "string" && item.accelerator.trim() !== ""
    );
  }

  getQuestionMenuSelectionInput(item: any): string {
    if (
      item &&
      typeof item.selectionInput === "string" &&
      item.selectionInput
    ) {
      return item.selectionInput;
    }
    const fallback =
      item && typeof item.accelerator === "string" ? item.accelerator : "";
    return this.getMenuSelectionInput(item, fallback);
  }

  getActiveQuestionPendingCount(): number | null {
    if (!/^\d+$/.test(this.activeQuestionPendingCountInput)) {
      return null;
    }
    const parsed = Number.parseInt(this.activeQuestionPendingCountInput, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  setActiveQuestionPendingCount(count: number | null): void {
    if (
      !this.isInQuestion ||
      !this.isCountableInventorySelectionQuestion(this.activeQuestionText)
    ) {
      return;
    }
    if (count === null || !Number.isFinite(count) || count < 1) {
      this.activeQuestionPendingCountInput = "";
      this.syncQuestionDialogState();
      return;
    }
    const normalized = Math.min(999999, Math.trunc(count));
    this.activeQuestionPendingCountInput = String(normalized);
    this.syncQuestionDialogState();
  }

  clearActiveQuestionPendingCount(sync: boolean = true): void {
    if (!this.activeQuestionPendingCountInput) {
      return;
    }
    this.activeQuestionPendingCountInput = "";
    if (sync) {
      this.syncQuestionDialogState();
    }
  }

  consumeActiveQuestionPendingCount(): number | null {
    const count = this.getActiveQuestionPendingCount();
    this.clearActiveQuestionPendingCount(false);
    return count;
  }

  encodeMenuSelectionInputWithCount(
    selectionInput: string,
    count: number | null,
  ): string {
    if (
      count === null ||
      count < 1 ||
      !selectionInput.startsWith(this.dependencies.inputCommands.menuSelectionInputPrefix)
    ) {
      return selectionInput;
    }
    return `${selectionInput}:${Math.trunc(count)}`;
  }

  appendActiveQuestionCountDigit(digit: string): void {
    if (!/^\d$/.test(digit)) {
      return;
    }
    const nextValue = `${this.activeQuestionPendingCountInput}${digit}`.replace(
      /^0+(?=\d)/,
      "",
    );
    this.activeQuestionPendingCountInput = nextValue.slice(0, 6);
    this.syncQuestionDialogState();
  }

  removeActiveQuestionCountDigit(): void {
    if (!this.activeQuestionPendingCountInput) {
      return;
    }
    this.activeQuestionPendingCountInput =
      this.activeQuestionPendingCountInput.slice(0, -1);
    this.syncQuestionDialogState();
  }

  handleQuestionMenuCountKeyDown(event: KeyboardEvent): boolean {
    if (
      !this.isInQuestion ||
      !this.isCountableInventorySelectionQuestion(this.activeQuestionText) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return false;
    }
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.appendActiveQuestionCountDigit(event.key);
      return true;
    }
    if (event.key === "Backspace" && this.activeQuestionPendingCountInput) {
      event.preventDefault();
      this.removeActiveQuestionCountDigit();
      return true;
    }
    return false;
  }

  sendInputWithPendingQuestionCount(input: string): void {
    const countDigits = this.activeQuestionPendingCountInput;
    this.clearActiveQuestionPendingCount(false);
    if (!countDigits || input.startsWith(this.dependencies.inputCommands.menuSelectionInputPrefix)) {
      this.dependencies.inputCommands.sendInput(input);
      return;
    }
    this.dependencies.inputCommands.sendInputSequence([...countDigits, input]);
  }

  trySubmitSimpleQuestionAnswer(input: string): boolean {
    if (!this.isInQuestion || this.activeQuestionMenuItems.length > 0 || this.activeQuestionIsPickupDialog) {
      return false;
    }
    const answer = resolveBoundedQuestionAnswer(
      input,
      this.activeQuestionChoices,
      this.activeQuestionDefaultChoice,
    );
    if (answer === null) {
      return false;
    }
    this.dependencies.inputCommands.updateNumberPadModeFromChoice(answer);
    this.dependencies.audioHapticsPlatform.maybePlayDrinkSoundForQuestionAnswer(answer);
    this.sendInputWithPendingQuestionCount(answer);
    this.hideQuestion();
    return true;
  }

  getVisiblePickupSelectableMenuItems(): any[] {
    if (!Array.isArray(this.activeQuestionVisibleMenuItems)) {
      return [];
    }
    return this.activeQuestionVisibleMenuItems.filter((item) =>
      this.isSelectableQuestionMenuItem(item),
    );
  }

  getAllPickupSelectableMenuItems(): any[] {
    if (!Array.isArray(this.activeQuestionMenuItems)) {
      return [];
    }
    return this.activeQuestionMenuItems.filter((item) =>
      this.isSelectableQuestionMenuItem(item),
    );
  }

  resolvePickupMenuItemObjectSymbol(item: any): string | null {
    if (!this.isSelectableQuestionMenuItem(item)) {
      return null;
    }

    const glyphChar =
      typeof item?.glyphChar === "string" ? item.glyphChar.trim() : "";
    if (
      glyphChar.length > 0 &&
      this.pickupMenuObjectClassSymbols.has(glyphChar.charAt(0))
    ) {
      return glyphChar.charAt(0);
    }

    const text = typeof item?.text === "string" ? item.text.trimStart() : "";
    const leadingSymbol = text.charAt(0);
    if (this.pickupMenuObjectClassSymbols.has(leadingSymbol)) {
      return leadingSymbol;
    }

    return null;
  }

  getPickupSelectableMenuItemsByObjectSymbol(symbol: string): any[] {
    if (typeof symbol !== "string" || symbol.length === 0) {
      return [];
    }
    return this.getAllPickupSelectableMenuItems().filter((item) => {
      return this.resolvePickupMenuItemObjectSymbol(item) === symbol;
    });
  }

  getPickupSelectableMenuItemsByGroupAccelerator(
    accelerator: string,
  ): any[] {
    if (typeof accelerator !== "string" || accelerator.length !== 1) {
      return [];
    }
    return this.getAllPickupSelectableMenuItems().filter((item) => {
      const groupAccelerator =
        typeof item?.groupAccelerator === "string"
          ? item.groupAccelerator.trim()
          : "";
      return groupAccelerator === accelerator;
    });
  }

  arePickupMenuItemsAllSelected(items: any[]): boolean {
    if (!Array.isArray(items) || items.length === 0) {
      return false;
    }
    return items.every((item) =>
      this.activePickupSelections.has(this.getMenuSelectionStateKey(item)),
    );
  }

  applyPickupSelectionOperation(
    items: any[],
    operation: "select" | "deselect" | "invert",
    shouldSendInput: boolean,
  ): void {
    if (!this.isInQuestion || !this.activeQuestionIsPickupDialog) {
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const changedInputs: string[] = [];
    let focusSelectionInput: string | null = null;
    const pendingCount = this.consumeActiveQuestionPendingCount();

    for (const menuItem of items) {
      const selectionInput = this.getQuestionMenuSelectionInput(menuItem);
      if (!selectionInput) {
        continue;
      }
      const selectionKey = this.getMenuSelectionStateKey(menuItem);
      const isSelected = this.activePickupSelections.has(selectionKey);
      const countedSelectionInput = this.encodeMenuSelectionInputWithCount(
        selectionInput,
        pendingCount,
      );
      let didChange = false;

      if (operation === "select") {
        if (!isSelected || pendingCount !== null) {
          this.activePickupSelections.add(selectionKey);
          if (pendingCount !== null) {
            this.activePickupSelectionCounts.set(selectionKey, pendingCount);
          }
          didChange = true;
        }
      } else if (operation === "deselect") {
        if (isSelected) {
          this.activePickupSelections.delete(selectionKey);
          this.activePickupSelectionCounts.delete(selectionKey);
          didChange = true;
        }
      } else if (isSelected && pendingCount === null) {
        this.activePickupSelections.delete(selectionKey);
        this.activePickupSelectionCounts.delete(selectionKey);
        didChange = true;
      } else {
        this.activePickupSelections.add(selectionKey);
        if (pendingCount !== null) {
          this.activePickupSelectionCounts.set(selectionKey, pendingCount);
        }
        didChange = true;
      }

      if (!didChange) {
        continue;
      }

      if (!focusSelectionInput) {
        focusSelectionInput = selectionInput;
      }
      changedInputs.push(countedSelectionInput);
    }

    if (focusSelectionInput) {
      this.setActivePickupFocusBySelectionInput(focusSelectionInput);
    }
    if (shouldSendInput && changedInputs.length > 0) {
      this.dependencies.inputCommands.sendInputSequence(changedInputs);
    }
    this.updatePickupFocusVisualState();
  }

  selectPickupMenuItems(items: any[], shouldSendInput: boolean): void {
    this.applyPickupSelectionOperation(items, "select", shouldSendInput);
  }

  deselectPickupMenuItems(
    items: any[],
    shouldSendInput: boolean,
  ): void {
    this.applyPickupSelectionOperation(items, "deselect", shouldSendInput);
  }

  invertPickupMenuItems(items: any[], shouldSendInput: boolean): void {
    this.applyPickupSelectionOperation(items, "invert", shouldSendInput);
  }

  togglePickupMenuItems(items: any[], shouldSendInput: boolean): void {
    if (this.arePickupMenuItemsAllSelected(items)) {
      this.deselectPickupMenuItems(items, shouldSendInput);
      return;
    }
    this.selectPickupMenuItems(items, shouldSendInput);
  }

  isAllPickupItemsSelected(): boolean {
    if (!this.activeQuestionIsPickupDialog) {
      return false;
    }
    const selectableItems = this.getAllPickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return false;
    }
    return selectableItems.every((item) =>
      this.activePickupSelections.has(this.getMenuSelectionStateKey(item)),
    );
  }

  normalizeActivePickupFocusIndex(): void {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      this.activePickupFocusIndex = 0;
      return;
    }

    if (
      !Number.isInteger(this.activePickupFocusIndex) ||
      this.activePickupFocusIndex < 0 ||
      this.activePickupFocusIndex >= selectableItems.length
    ) {
      this.activePickupFocusIndex = 0;
    }
  }

  getActivePickupSelectionInput(): string | null {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return null;
    }
    this.normalizeActivePickupFocusIndex();
    const focusedItem = selectableItems[this.activePickupFocusIndex];
    const selectionInput = this.getQuestionMenuSelectionInput(focusedItem);
    return typeof selectionInput === "string" && selectionInput.length > 0
      ? selectionInput
      : null;
  }

  setActivePickupFocusBySelectionInput(selectionInput: string): void {
    if (typeof selectionInput !== "string" || selectionInput.length === 0) {
      return;
    }
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    const index = selectableItems.findIndex((item) => {
      return this.getQuestionMenuSelectionInput(item) === selectionInput;
    });
    if (index >= 0) {
      this.activePickupFocusIndex = index;
      this.clearQuestionActionFocus();
    }
  }

  updatePickupFocusVisualState(): void {
    this.syncQuestionDialogState();
  }

  movePickupFocus(delta: number): void {
    if (!this.activeQuestionIsPickupDialog || delta === 0) {
      return;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return;
    }

    this.normalizeActivePickupFocusIndex();
    this.clearQuestionActionFocus();
    const itemCount = selectableItems.length;
    const nextIndex =
      (((this.activePickupFocusIndex + delta) % itemCount) + itemCount) %
      itemCount;
    this.activePickupFocusIndex = nextIndex;
    this.updatePickupFocusVisualState();
  }

  toggleActivePickupFocusSelection(): void {
    const focusedSelectionInput = this.getActivePickupSelectionInput();
    if (!focusedSelectionInput) {
      return;
    }

    this.togglePickupChoice(focusedSelectionInput);
  }

  toggleAllPickupSelections(shouldSendInput: boolean): void {
    this.togglePickupMenuItems(
      this.getAllPickupSelectableMenuItems(),
      shouldSendInput,
    );
  }

  selectAllPickupSelections(shouldSendInput: boolean): void {
    this.selectPickupMenuItems(
      this.getAllPickupSelectableMenuItems(),
      shouldSendInput,
    );
  }

  deselectAllPickupSelections(shouldSendInput: boolean): void {
    this.deselectPickupMenuItems(
      this.getAllPickupSelectableMenuItems(),
      shouldSendInput,
    );
  }

  invertAllPickupSelections(shouldSendInput: boolean): void {
    this.invertPickupMenuItems(
      this.getAllPickupSelectableMenuItems(),
      shouldSendInput,
    );
  }

  selectVisiblePickupSelections(shouldSendInput: boolean): void {
    this.selectPickupMenuItems(
      this.getVisiblePickupSelectableMenuItems(),
      shouldSendInput,
    );
  }

  deselectVisiblePickupSelections(shouldSendInput: boolean): void {
    this.deselectPickupMenuItems(
      this.getVisiblePickupSelectableMenuItems(),
      shouldSendInput,
    );
  }

  invertVisiblePickupSelections(shouldSendInput: boolean): void {
    this.invertPickupMenuItems(
      this.getVisiblePickupSelectableMenuItems(),
      shouldSendInput,
    );
  }

  togglePickupSelectionsByObjectSymbol(
    symbol: string,
    shouldSendInput: boolean,
  ): void {
    this.togglePickupMenuItems(
      this.getPickupSelectableMenuItemsByObjectSymbol(symbol),
      shouldSendInput,
    );
  }

  togglePickupSelectionsByGroupAccelerator(
    accelerator: string,
    shouldSendInput: boolean,
  ): boolean {
    const matchingItems =
      this.getPickupSelectableMenuItemsByGroupAccelerator(accelerator);
    if (matchingItems.length === 0) {
      return false;
    }
    this.togglePickupMenuItems(matchingItems, shouldSendInput);
    return true;
  }

  getActiveQuestionActionButtons(): Array<
    "select-all" | "confirm" | "cancel"
  > {
    if (!this.isInQuestion || this.activeQuestionMenuItems.length === 0) {
      return [];
    }
    const selectableCount = this.getVisiblePickupSelectableMenuItems().length;
    if (this.activeQuestionIsPickupDialog) {
      if (selectableCount > 1) {
        return ["confirm", "select-all", "cancel"];
      }
      if (selectableCount === 1) {
        return ["confirm", "cancel"];
      }
      return [];
    }
    if (selectableCount <= 0) {
      return [];
    }
    return ["cancel"];
  }

  getActiveQuestionActionButton():
    | "select-all"
    | "confirm"
    | "cancel"
    | null {
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0) {
      this.activeQuestionActionFocusIndex = -1;
      return null;
    }
    if (this.activeQuestionActionFocusIndex < 0) {
      return null;
    }
    if (this.activeQuestionActionFocusIndex >= actions.length) {
      this.activeQuestionActionFocusIndex = actions.length - 1;
    }
    return actions[this.activeQuestionActionFocusIndex] ?? null;
  }

  isQuestionActionFocused(): boolean {
    return this.getActiveQuestionActionButton() !== null;
  }

  setQuestionActionFocusIndex(index: number): void {
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0) {
      this.activeQuestionActionFocusIndex = -1;
    } else {
      const clamped = Math.max(0, Math.min(actions.length - 1, index));
      this.activeQuestionActionFocusIndex = clamped;
    }
    if (this.activeQuestionIsPickupDialog) {
      this.updatePickupFocusVisualState();
    } else {
      this.updateQuestionMenuFocusVisualState();
    }
  }

  clearQuestionActionFocus(): void {
    this.activeQuestionActionFocusIndex = -1;
  }

  moveQuestionActionFocus(delta: number): boolean {
    if (delta === 0) {
      return false;
    }
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0 || this.activeQuestionActionFocusIndex < 0) {
      return false;
    }
    const nextIndex = Math.max(
      0,
      Math.min(actions.length - 1, this.activeQuestionActionFocusIndex + delta),
    );
    this.setQuestionActionFocusIndex(nextIndex);
    return true;
  }

  focusQuestionActionsStart(): boolean {
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0) {
      return false;
    }
    this.setQuestionActionFocusIndex(0);
    return true;
  }

  setQuestionSelectableFocusIndex(index: number): boolean {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return false;
    }

    const clampedIndex = Math.max(
      0,
      Math.min(selectableItems.length - 1, Math.trunc(index)),
    );
    this.clearQuestionActionFocus();
    if (this.activeQuestionIsPickupDialog) {
      this.activePickupFocusIndex = clampedIndex;
      this.updatePickupFocusVisualState();
    } else {
      this.activeQuestionMenuFocusIndex = clampedIndex;
      this.updateQuestionMenuFocusVisualState();
    }
    return true;
  }

  focusLastQuestionSelectableItem(): boolean {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return false;
    }
    return this.setQuestionSelectableFocusIndex(selectableItems.length - 1);
  }

  moveActiveQuestionSelectableFocus(delta: number): boolean {
    if (delta === 0) {
      return false;
    }
    if (this.activeQuestionIsPickupDialog) {
      this.movePickupFocus(delta);
      return true;
    }
    if (this.activeQuestionMenuItems.length < 1) {
      return false;
    }
    this.moveQuestionMenuFocus(delta);
    return true;
  }

  moveQuestionDialogMenuLikeFocus(
    direction: "up" | "down" | "left" | "right",
  ): boolean {
    if (
      !this.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.activeQuestionMenuItems.length < 1
    ) {
      return false;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    const selectableCount = selectableItems.length;
    const actions = this.getActiveQuestionActionButtons();
    const actionCount = actions.length;
    const isActionFocused = this.isQuestionActionFocused();
    let effectiveDirection = direction;

    if (!isActionFocused) {
      if (direction === "left") {
        effectiveDirection = "up";
      } else if (direction === "right") {
        effectiveDirection = "down";
      }
    }

    if (isActionFocused) {
      if (effectiveDirection === "up") {
        return this.focusLastQuestionSelectableItem();
      }
      if (effectiveDirection === "left") {
        if (this.activeQuestionActionFocusIndex <= 0) {
          return this.focusLastQuestionSelectableItem();
        }
        this.setQuestionActionFocusIndex(
          this.activeQuestionActionFocusIndex - 1,
        );
        return true;
      }
      if (effectiveDirection === "right" || effectiveDirection === "down") {
        if (actionCount <= 0) {
          return false;
        }
        const nextActionIndex = Math.min(
          actionCount - 1,
          this.activeQuestionActionFocusIndex + 1,
        );
        this.setQuestionActionFocusIndex(nextActionIndex);
        return true;
      }
      return false;
    }

    if (effectiveDirection === "down") {
      const currentIndex = this.activeQuestionIsPickupDialog
        ? this.activePickupFocusIndex
        : this.activeQuestionMenuFocusIndex;
      const atBottom =
        selectableCount > 0 && currentIndex >= selectableCount - 1;
      if (atBottom && actionCount > 0) {
        return this.focusQuestionActionsStart();
      }
      return this.moveActiveQuestionSelectableFocus(1);
    }

    if (effectiveDirection === "up" || effectiveDirection === "left") {
      return this.moveActiveQuestionSelectableFocus(-1);
    }

    if (effectiveDirection === "right") {
      return this.moveActiveQuestionSelectableFocus(1);
    }

    return false;
  }

  moveQuestionDialogTabFocus(reverse: boolean): boolean {
    if (
      !this.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.activeQuestionMenuItems.length < 1
    ) {
      return false;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    const selectableCount = selectableItems.length;
    const actions = this.getActiveQuestionActionButtons();
    const actionCount = actions.length;
    if (selectableCount === 0 && actionCount === 0) {
      return false;
    }

    if (this.isQuestionActionFocused()) {
      const currentActionIndex = Math.max(
        0,
        Math.min(actionCount - 1, this.activeQuestionActionFocusIndex),
      );
      if (reverse) {
        if (currentActionIndex > 0) {
          this.setQuestionActionFocusIndex(currentActionIndex - 1);
          return true;
        }
        if (selectableCount > 0) {
          return this.focusLastQuestionSelectableItem();
        }
        this.setQuestionActionFocusIndex(actionCount - 1);
        return true;
      }

      if (currentActionIndex < actionCount - 1) {
        this.setQuestionActionFocusIndex(currentActionIndex + 1);
        return true;
      }
      if (selectableCount > 0) {
        return this.setQuestionSelectableFocusIndex(0);
      }
      this.setQuestionActionFocusIndex(0);
      return true;
    }

    if (selectableCount <= 0) {
      if (actionCount <= 0) {
        return false;
      }
      this.setQuestionActionFocusIndex(reverse ? actionCount - 1 : 0);
      return true;
    }

    const currentIndex = this.activeQuestionIsPickupDialog
      ? this.activePickupFocusIndex
      : this.activeQuestionMenuFocusIndex;
    if (reverse) {
      if (currentIndex > 0) {
        return this.setQuestionSelectableFocusIndex(currentIndex - 1);
      }
      if (actionCount > 0) {
        this.setQuestionActionFocusIndex(actionCount - 1);
        return true;
      }
      return this.setQuestionSelectableFocusIndex(selectableCount - 1);
    }

    if (currentIndex < selectableCount - 1) {
      return this.setQuestionSelectableFocusIndex(currentIndex + 1);
    }
    if (actionCount > 0) {
      this.setQuestionActionFocusIndex(0);
      return true;
    }
    return this.setQuestionSelectableFocusIndex(0);
  }

  activateFocusedQuestionAction(): boolean {
    const action = this.getActiveQuestionActionButton();
    if (!action) {
      return false;
    }
    if (action === "select-all") {
      this.toggleAllPickupChoices();
      return true;
    }
    if (action === "cancel") {
      this.dependencies.inputCommands.cancelActivePrompt();
      return true;
    }
    if (action === "confirm") {
      if (this.activeQuestionIsPickupDialog) {
        this.confirmPickupChoices();
      } else {
        this.confirmQuestionMenuChoice();
      }
      return true;
    }
    return false;
  }

  normalizeActiveQuestionMenuFocusIndex(): void {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      this.activeQuestionMenuFocusIndex = 0;
      return;
    }

    if (
      !Number.isInteger(this.activeQuestionMenuFocusIndex) ||
      this.activeQuestionMenuFocusIndex < 0 ||
      this.activeQuestionMenuFocusIndex >= selectableItems.length
    ) {
      this.activeQuestionMenuFocusIndex = 0;
    }
  }

  getActiveQuestionMenuSelectionInput(): string | null {
    if (
      this.activeQuestionIsPickupDialog ||
      this.activeQuestionMenuItems.length === 0
    ) {
      return null;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return null;
    }

    this.normalizeActiveQuestionMenuFocusIndex();
    const focusedItem = selectableItems[this.activeQuestionMenuFocusIndex];
    const selectionInput = this.getQuestionMenuSelectionInput(focusedItem);
    return typeof selectionInput === "string" && selectionInput.length > 0
      ? selectionInput
      : null;
  }

  setActiveQuestionMenuFocusBySelectionInput(
    selectionInput: string,
  ): void {
    if (typeof selectionInput !== "string" || selectionInput.length === 0) {
      return;
    }
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    const index = selectableItems.findIndex((item) => {
      return this.getQuestionMenuSelectionInput(item) === selectionInput;
    });
    if (index >= 0) {
      this.activeQuestionMenuFocusIndex = index;
      this.clearQuestionActionFocus();
    }
  }

  updateQuestionMenuFocusVisualState(): void {
    this.syncQuestionDialogState();
  }

  moveQuestionMenuFocus(delta: number): void {
    if (
      this.activeQuestionIsPickupDialog ||
      this.activeQuestionMenuItems.length === 0 ||
      delta === 0
    ) {
      return;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return;
    }

    this.normalizeActiveQuestionMenuFocusIndex();
    this.clearQuestionActionFocus();
    const itemCount = selectableItems.length;
    const nextIndex =
      (((this.activeQuestionMenuFocusIndex + delta) % itemCount) + itemCount) %
      itemCount;
    this.activeQuestionMenuFocusIndex = nextIndex;
    this.updateQuestionMenuFocusVisualState();
  }

  confirmActiveQuestionMenuChoice(): void {
    if (
      !this.isInQuestion ||
      this.activeQuestionIsPickupDialog ||
      this.activeQuestionMenuItems.length === 0
    ) {
      return;
    }

    const selectionInput = this.getActiveQuestionMenuSelectionInput();
    if (!selectionInput) {
      return;
    }

    const selectedItem =
      this.findActiveMenuItemBySelectionInput(selectionInput);
    if (!selectedItem) {
      return;
    }

    const refreshAction = this.dependencies.tileUpdates.getQuestionSelectionTileRefreshAction(
      this.activeQuestionText,
    );
    const pendingCount = this.consumeActiveQuestionPendingCount();
    const countedSelectionInput = this.encodeMenuSelectionInputWithCount(
      this.getQuestionMenuSelectionInput(selectedItem),
      pendingCount,
    );
    this.dependencies.audioHapticsPlatform.maybePlayDrinkSoundForQuestionMenuSelection(selectedItem);
    this.dependencies.inputCommands.sendInput(countedSelectionInput);
    if (refreshAction) {
      this.dependencies.tileUpdates.requestPlayerTileRefresh(`${refreshAction}-question-selection`);
    }
    this.hideQuestion();
  }

  rebuildActiveQuestionMenuPagination(): void {
    this.activeQuestionVisibleMenuItems = [];
    this.activeQuestionPageSelectionMap.clear();
    this.activeQuestionMenuPageCount = 1;
    this.activeQuestionMenuPageIndex = Math.max(
      0,
      this.activeQuestionMenuPageIndex,
    );
    this.activeQuestionActionFocusIndex = -1;
    if (this.activeQuestionIsPickupDialog) {
      this.activeQuestionMenuFocusIndex = 0;
    } else {
      this.activePickupFocusIndex = 0;
    }

    if (
      !Array.isArray(this.activeQuestionMenuItems) ||
      this.activeQuestionMenuItems.length === 0
    ) {
      this.activePickupFocusIndex = 0;
      this.activeQuestionMenuFocusIndex = 0;
      this.activeQuestionActionFocusIndex = -1;
      return;
    }

    const selectableItems = this.activeQuestionMenuItems.filter((item) =>
      this.isSelectableQuestionMenuItem(item),
    );
    if (selectableItems.length === 0) {
      this.activeQuestionVisibleMenuItems = [...this.activeQuestionMenuItems];
      this.activeQuestionMenuPageIndex = 0;
      this.activePickupFocusIndex = 0;
      this.activeQuestionMenuFocusIndex = 0;
      this.activeQuestionActionFocusIndex = -1;
      return;
    }

    const pageSize = this.questionMenuPageAccelerators.length;
    const pageCount = Math.ceil(selectableItems.length / pageSize);
    this.activeQuestionMenuPageCount = Math.max(1, pageCount);
    this.activeQuestionMenuPageIndex = Math.min(
      this.activeQuestionMenuPageIndex,
      this.activeQuestionMenuPageCount - 1,
    );

    const startSelectable = this.activeQuestionMenuPageIndex * pageSize;
    const endSelectable = startSelectable + pageSize;
    let selectableSeen = 0;
    let selectableInPage = 0;
    let pendingCategoryRows: any[] = [];
    let categoryRowsInjected = false;
    let lastItemWasSelectable = false;

    for (const menuItem of this.activeQuestionMenuItems) {
      if (!this.isSelectableQuestionMenuItem(menuItem)) {
        if (lastItemWasSelectable) {
          pendingCategoryRows = [];
        }
        pendingCategoryRows.push(menuItem);
        categoryRowsInjected = false;
        lastItemWasSelectable = false;
        continue;
      }

      const selectableIndex = selectableSeen;
      selectableSeen += 1;
      lastItemWasSelectable = true;
      if (
        selectableIndex < startSelectable ||
        selectableIndex >= endSelectable
      ) {
        continue;
      }

      if (!categoryRowsInjected && pendingCategoryRows.length > 0) {
        for (const categoryRow of pendingCategoryRows) {
          this.activeQuestionVisibleMenuItems.push({ ...categoryRow });
        }
        categoryRowsInjected = true;
      }

      const gameAccelerator =
        typeof menuItem.accelerator === "string" ? menuItem.accelerator : "";
      const fallbackAccelerator =
        this.questionMenuPageAccelerators[selectableInPage] ?? "?";
      const trimmedGameAccelerator = gameAccelerator.trim();
      const hasUsableGameAccelerator =
        trimmedGameAccelerator.length > 0 && trimmedGameAccelerator !== "?";
      const displayAccelerator = hasUsableGameAccelerator
        ? gameAccelerator
        : fallbackAccelerator;
      const selectionInput = this.getQuestionMenuSelectionInput(menuItem);

      this.activeQuestionVisibleMenuItems.push({
        ...menuItem,
        accelerator: displayAccelerator,
        originalAccelerator: gameAccelerator,
        selectionInput,
      });
      this.activeQuestionPageSelectionMap.set(
        displayAccelerator,
        selectionInput,
      );
      const groupAccelerator =
        this.isObjectTypeCategoryQuestion(this.activeQuestionText) &&
        typeof menuItem.groupAccelerator === "string"
          ? menuItem.groupAccelerator.trim()
          : "";
      if (groupAccelerator.length === 1) {
        this.activeQuestionPageSelectionMap.set(
          groupAccelerator,
          selectionInput,
        );
      }
      selectableInPage += 1;
    }

    if (this.activeQuestionIsPickupDialog) {
      this.normalizeActivePickupFocusIndex();
      this.activeQuestionMenuFocusIndex = 0;
      this.activeQuestionActionFocusIndex = -1;
    } else {
      this.activePickupFocusIndex = 0;
      this.normalizeActiveQuestionMenuFocusIndex();
      this.activeQuestionActionFocusIndex = -1;
    }
  }

  resolveQuestionSelectionInput(input: string): string {
    if (typeof input !== "string" || input.length === 0) {
      return "";
    }
    const mapped = this.activeQuestionPageSelectionMap.get(input);
    if (typeof mapped === "string" && mapped.length > 0) {
      return mapped;
    }
    return input;
  }

  resolveQuestionSelectionInputForKeyPress(key: string): string | null {
    if (typeof key !== "string" || key.length === 0) {
      return null;
    }
    if (this.activeQuestionMenuItems.length === 0) {
      return key;
    }
    const mapped = this.activeQuestionPageSelectionMap.get(key);
    return typeof mapped === "string" && mapped.length > 0 ? mapped : null;
  }

  goToPreviousQuestionMenuPage(): void {
    this.changeQuestionMenuPage(-1);
  }

  goToNextQuestionMenuPage(): void {
    this.changeQuestionMenuPage(1);
  }

  changeQuestionMenuPage(delta: number): void {
    if (
      !this.isInQuestion ||
      this.activeQuestionMenuItems.length === 0 ||
      this.activeQuestionMenuPageCount <= 1
    ) {
      return;
    }
    const nextPage = Math.max(
      0,
      Math.min(
        this.activeQuestionMenuPageCount - 1,
        this.activeQuestionMenuPageIndex + delta,
      ),
    );
    if (nextPage === this.activeQuestionMenuPageIndex) {
      return;
    }
    this.activeQuestionMenuPageIndex = nextPage;
    this.rebuildActiveQuestionMenuPagination();
    this.syncQuestionDialogState();
  }

  setQuestionMenuPageIndex(pageIndex: number): void {
    if (
      !this.isInQuestion ||
      this.activeQuestionMenuItems.length === 0 ||
      this.activeQuestionMenuPageCount <= 1
    ) {
      return;
    }
    const nextPage = Math.max(
      0,
      Math.min(this.activeQuestionMenuPageCount - 1, Math.trunc(pageIndex)),
    );
    if (nextPage === this.activeQuestionMenuPageIndex) {
      return;
    }
    this.activeQuestionMenuPageIndex = nextPage;
    this.rebuildActiveQuestionMenuPagination();
    this.syncQuestionDialogState();
  }

  goToFirstQuestionMenuPage(): void {
    this.setQuestionMenuPageIndex(0);
  }

  goToLastQuestionMenuPage(): void {
    this.setQuestionMenuPageIndex(this.activeQuestionMenuPageCount - 1);
  }

  setActiveQuestionState(
    question: string,
    choices: string,
    defaultChoice: string,
    menuItems: any[],
  ): void {
    const runtimeVersion = this.dependencies.tilesetAssets.resolveRuntimeVersion();
    const uiChoices =
      runtimeVersion === "slashem"
        ? String(choices || "").replace(/\*/g, "")
        : choices || "";
    this.activeQuestionText = question || "";
    this.activeQuestionChoices = uiChoices;
    this.activeQuestionDefaultChoice = defaultChoice || "";
    this.activeQuestionMenuItems = this.dependencies.menuPreviews.normalizeMenuItemsForUi(menuItems);
    this.activeQuestionIsPickupDialog =
      this.activeQuestionMenuItems.length > 0 &&
      this.isMultiSelectLootQuestion(this.activeQuestionText);
    this.activePickupSelections.clear();
    this.activePickupSelectionCounts.clear();
    this.activeQuestionPendingCountInput = "";
    this.activePickupFocusIndex = 0;
    this.activeQuestionMenuFocusIndex = 0;
    this.activeQuestionActionFocusIndex = -1;
    this.activeQuestionMenuPageIndex = 0;
    this.rebuildActiveQuestionMenuPagination();
  }

  showQuestion(
    question: string,
    choices: string,
    defaultChoice: string,
    menuItems: any[],
  ): void {
    this.setActiveQuestionState(question, choices, defaultChoice, menuItems);
    this.dependencies.runTelemetry.captureKnownSpellsFromQuestionMenu(
      question,
      this.activeQuestionMenuItems,
    );
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(false);
    this.syncQuestionDialogState();
  }

  syncQuestionDialogState(): void {
    if (!this.isInQuestion) {
      this.dependencies.engineState.uiAdapter.setQuestion(null);
      return;
    }

    const selectedAccelerators = this.activeQuestionVisibleMenuItems
      .filter((item) => {
        if (!this.isSelectableQuestionMenuItem(item)) {
          return false;
        }
        const selectionKey = this.getMenuSelectionStateKey(item);
        return this.activePickupSelections.has(selectionKey);
      })
      .map((item) =>
        typeof item.accelerator === "string" ? item.accelerator : "",
      )
      .filter((value) => value.length > 0);
    const selectedCounts: Record<string, number> = {};
    for (const item of this.activeQuestionVisibleMenuItems) {
      if (!this.isSelectableQuestionMenuItem(item)) {
        continue;
      }
      const selectionKey = this.getMenuSelectionStateKey(item);
      const count = this.activePickupSelectionCounts.get(selectionKey);
      if (!Number.isFinite(count) || Number(count) < 1) {
        continue;
      }
      selectedCounts[this.getQuestionMenuSelectionInput(item)] = Math.trunc(
        Number(count),
      );
    }
    const allPickupSelected = this.isAllPickupItemsSelected();
    const activeActionButton = this.getActiveQuestionActionButton();
    const activeMenuSelectionInput =
      this.activeQuestionMenuItems.length > 0 && !activeActionButton
        ? this.activeQuestionIsPickupDialog
          ? this.getActivePickupSelectionInput()
          : this.getActiveQuestionMenuSelectionInput()
        : null;

    const state: QuestionDialogState = {
      text: this.activeQuestionText,
      choices: this.activeQuestionChoices,
      defaultChoice: this.activeQuestionDefaultChoice,
      menuItems: [...this.activeQuestionVisibleMenuItems],
      isPickupDialog: this.activeQuestionIsPickupDialog,
      selectedAccelerators,
      selectedCounts,
      supportsSelectionCount: this.isCountableInventorySelectionQuestion(
        this.activeQuestionText,
      ),
      pendingSelectionCount: this.getActiveQuestionPendingCount(),
      allPickupSelected,
      activePickupSelectionInput: this.activeQuestionIsPickupDialog
        ? activeMenuSelectionInput
        : null,
      activeMenuSelectionInput,
      activeActionButton,
      menuPageIndex: this.activeQuestionMenuPageIndex,
      menuPageCount: this.activeQuestionMenuPageCount,
    };
    this.dependencies.engineState.uiAdapter.setQuestion(state);
  }

  hideQuestion(): void {
    this.isInQuestion = false;
    this.activeQuestionText = "";
    this.activeQuestionChoices = "";
    this.activeQuestionDefaultChoice = "";
    this.activeQuestionMenuItems = [];
    this.activeQuestionVisibleMenuItems = [];
    this.activeQuestionMenuPageIndex = 0;
    this.activeQuestionMenuPageCount = 1;
    this.activeQuestionPageSelectionMap.clear();
    this.activeQuestionIsPickupDialog = false;
    this.activePickupSelections.clear();
    this.activePickupSelectionCounts.clear();
    this.activeQuestionPendingCountInput = "";
    this.activePickupFocusIndex = 0;
    this.activeQuestionMenuFocusIndex = 0;
    this.activeQuestionActionFocusIndex = -1;
    this.dependencies.engineState.uiAdapter.setQuestion(null);
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
    this.dependencies.gameOver.flushDeferredGameOverUiReveal();
  }

  decodeMenuSelectionIndexFromInput(input: string): number | null {
    if (
      typeof input !== "string" ||
      !input.startsWith(this.dependencies.inputCommands.menuSelectionInputPrefix)
    ) {
      return null;
    }
    const raw = input
      .slice(this.dependencies.inputCommands.menuSelectionInputPrefix.length)
      .trim()
      .split(":")[0];
    if (!/^-?\d+$/.test(raw)) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }

  getMenuSelectionInput(item: any, fallbackInput = ""): string {
    if (item && Number.isInteger(item.menuIndex)) {
      return `${this.dependencies.inputCommands.menuSelectionInputPrefix}${item.menuIndex}`;
    }
    if (item && typeof item.accelerator === "string" && item.accelerator) {
      return item.accelerator;
    }
    return fallbackInput;
  }

  getMenuSelectionStateKey(item: any): string {
    if (item && Number.isInteger(item.menuIndex)) {
      return `menu-index:${item.menuIndex}`;
    }
    const originalAccelerator =
      item && typeof item.originalAccelerator === "string"
        ? item.originalAccelerator
        : "";
    const accelerator =
      item && typeof item.accelerator === "string" ? item.accelerator : "";
    const stableAccelerator = originalAccelerator || accelerator;
    return `accelerator:${stableAccelerator}`;
  }

  findActiveMenuItemBySelectionInput(input: string): any | null {
    const menuIndex = this.decodeMenuSelectionIndexFromInput(input);
    if (Number.isInteger(menuIndex)) {
      const indexed = this.activeQuestionMenuItems.find(
        (item) =>
          item &&
          !item.isCategory &&
          Number.isInteger(item.menuIndex) &&
          item.menuIndex === menuIndex,
      );
      if (indexed) {
        return indexed;
      }
    }
    return this.findActiveMenuItemByAccelerator(input);
  }

  findActiveMenuItemByAccelerator(input: string): any | null {
    if (typeof input !== "string" || input.length === 0) {
      return null;
    }

    const exact = this.activeQuestionMenuItems.find(
      (item) => item && !item.isCategory && item.accelerator === input,
    );
    if (exact) {
      return exact;
    }

    // NetHack assigns different objects to lowercase and uppercase letters.
    return null;
  }

  togglePickupSelection(
    selectionInput: string,
    shouldSendInput: boolean,
  ): void {
    const menuItem = this.findActiveMenuItemBySelectionInput(selectionInput);
    if (!menuItem) {
      return;
    }

    const selectionKey = this.getMenuSelectionStateKey(menuItem);
    const canonicalSelectionInput =
      this.getQuestionMenuSelectionInput(menuItem);
    const pendingCount = this.consumeActiveQuestionPendingCount();
    const countedSelectionInput = this.encodeMenuSelectionInputWithCount(
      canonicalSelectionInput,
      pendingCount,
    );
    this.setActivePickupFocusBySelectionInput(canonicalSelectionInput);

    if (
      this.activePickupSelections.has(selectionKey) &&
      pendingCount === null
    ) {
      this.activePickupSelections.delete(selectionKey);
      this.activePickupSelectionCounts.delete(selectionKey);
    } else {
      this.activePickupSelections.add(selectionKey);
      if (pendingCount !== null) {
        this.activePickupSelectionCounts.set(selectionKey, pendingCount);
      }
    }

    if (shouldSendInput) {
      this.dependencies.inputCommands.sendInput(countedSelectionInput);
    }
    this.updatePickupFocusVisualState();
  }

  chooseQuestionChoice(choice: string): void {
    if (!this.isInQuestion || !choice) {
      return;
    }
    const resolvedChoice = this.resolveQuestionSelectionInput(choice);
    if (this.activeQuestionMenuItems.length === 0 && !this.activeQuestionIsPickupDialog) {
      this.trySubmitSimpleQuestionAnswer(resolvedChoice);
      return;
    }
    this.dependencies.inputCommands.updateNumberPadModeFromChoice(resolvedChoice);

    if (this.activeQuestionIsPickupDialog) {
      this.togglePickupSelection(resolvedChoice, true);
      return;
    }

    const selectedItem =
      this.findActiveMenuItemBySelectionInput(resolvedChoice);
    if (selectedItem) {
      const selectionInput = this.getQuestionMenuSelectionInput(selectedItem);
      const pendingCount = this.consumeActiveQuestionPendingCount();
      const countedSelectionInput = this.encodeMenuSelectionInputWithCount(
        selectionInput,
        pendingCount,
      );
      const refreshAction = this.dependencies.tileUpdates.getQuestionSelectionTileRefreshAction(
        this.activeQuestionText,
      );
      if (this.dependencies.runTelemetry.isSpellCastQuestionText(this.activeQuestionText)) {
        this.dependencies.runTelemetry.armRecentSpellKillAttribution(
          this.dependencies.runTelemetry.extractSpellNameFromMenuItemText(selectedItem.text),
        );
      }
      this.setActiveQuestionMenuFocusBySelectionInput(selectionInput);
      this.dependencies.audioHapticsPlatform.maybePlayDrinkSoundForQuestionMenuSelection(selectedItem);
      this.dependencies.inputCommands.sendInput(countedSelectionInput);
      if (refreshAction) {
        this.dependencies.tileUpdates.requestPlayerTileRefresh(`${refreshAction}-question-selection`);
      }
      this.hideQuestion();
      return;
    }

  }

  stepQuestionSelectionCount(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    const currentCount = this.getActiveQuestionPendingCount() ?? 1;
    const nextCount = currentCount + Math.trunc(delta);
    this.setActiveQuestionPendingCount(nextCount > 1 ? nextCount : null);
  }

  setQuestionSelectionCount(count: number | null): void {
    if (count === null || !Number.isFinite(count) || count <= 1) {
      this.setActiveQuestionPendingCount(null);
      return;
    }
    this.setActiveQuestionPendingCount(count);
  }

  clearQuestionSelectionCount(): void {
    this.clearActiveQuestionPendingCount(true);
  }

  syncQuestionSelectionFocus(selectionInput: string): void {
    if (!this.isInQuestion || !selectionInput) {
      return;
    }
    const resolvedSelection =
      this.resolveQuestionSelectionInput(selectionInput);
    if (!resolvedSelection) {
      return;
    }
    if (this.activeQuestionIsPickupDialog) {
      const activeSelectionInput = this.getActivePickupSelectionInput();
      if (
        !this.isQuestionActionFocused() &&
        activeSelectionInput === resolvedSelection
      ) {
        return;
      }
      this.setActivePickupFocusBySelectionInput(resolvedSelection);
      this.updatePickupFocusVisualState();
      return;
    }
    if (this.activeQuestionMenuItems.length < 1) {
      return;
    }
    const activeSelectionInput = this.getActiveQuestionMenuSelectionInput();
    if (
      !this.isQuestionActionFocused() &&
      activeSelectionInput === resolvedSelection
    ) {
      return;
    }
    this.setActiveQuestionMenuFocusBySelectionInput(resolvedSelection);
    this.updateQuestionMenuFocusVisualState();
  }

  syncQuestionActionFocus(
    action: "select-all" | "confirm" | "cancel",
  ): void {
    if (!this.isInQuestion) {
      return;
    }
    const actions = this.getActiveQuestionActionButtons();
    const actionIndex = actions.indexOf(action);
    if (actionIndex < 0) {
      return;
    }
    if (
      this.isQuestionActionFocused() &&
      this.activeQuestionActionFocusIndex === actionIndex
    ) {
      return;
    }
    this.setQuestionActionFocusIndex(actionIndex);
  }

  resolveLegacyQuestionChoicePreviewTileIndex(
    choice: string,
  ): number | null {
    const normalizedChoice = String(choice || "").trim();
    if (normalizedChoice !== ".") {
      return null;
    }
    return this.dependencies.worldClassification.resolveLegacyHereChoicePreviewTileIndex();
  }

  confirmQuestionMenuChoice(): void {
    this.confirmActiveQuestionMenuChoice();
  }

  togglePickupChoice(accelerator: string): void {
    if (!this.isInQuestion || !this.activeQuestionIsPickupDialog) {
      return;
    }
    const resolvedInput = this.resolveQuestionSelectionInput(accelerator);
    const menuItem = this.findActiveMenuItemBySelectionInput(resolvedInput);
    if (!menuItem) {
      return;
    }
    this.togglePickupSelection(
      this.getQuestionMenuSelectionInput(menuItem),
      true,
    );
  }

  toggleAllPickupChoices(): void {
    this.toggleAllPickupSelections(true);
  }

  handlePickupDialogShortcutKey(key: string): boolean {
    if (typeof key !== "string" || key.length === 0) {
      return false;
    }

    switch (key) {
      case ".":
        this.selectAllPickupSelections(true);
        return true;
      case ",":
        this.selectVisiblePickupSelections(true);
        return true;
      case "-":
        this.deselectAllPickupSelections(true);
        return true;
      case "\\":
        this.deselectVisiblePickupSelections(true);
        return true;
      case "@":
        this.invertAllPickupSelections(true);
        return true;
      case "~":
        this.invertVisiblePickupSelections(true);
        return true;
      default:
        break;
    }

    if (
      this.isObjectTypeCategoryQuestion(this.activeQuestionText) &&
      this.togglePickupSelectionsByGroupAccelerator(key, true)
    ) {
      return true;
    }

    if (this.pickupMenuObjectClassSymbols.has(key)) {
      this.togglePickupSelectionsByObjectSymbol(key, true);
      return true;
    }

    return false;
  }

  confirmPickupChoices(): void {
    if (!this.isInQuestion || !this.activeQuestionIsPickupDialog) {
      return;
    }
    this.dependencies.inputCommands.sendInput("Enter");
    this.dependencies.tileUpdates.requestPlayerTileRefresh("pickup-confirm");
    this.hideQuestion();
  }
}
