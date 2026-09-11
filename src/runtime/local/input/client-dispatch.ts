// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeExtendedCommands } from "./extended-commands";
import type { RuntimeMouseInput } from "./mouse-poskey";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeTextInput } from "./text-input";
import type { RuntimeInventoryContext } from "../menus/inventory-context";
import type { RuntimeInputRequests } from "./input-requests";
import type { RuntimePositionInput } from "./position-selection";
import type { RuntimeMapCallbacks } from "../world/map-callbacks";
import type { RuntimePostActionRefresh } from "../world/post-action-refresh";
import type { RuntimeContextualLook } from "./contextual-look";
import type { RuntimeKeyboardInput } from "./keyboard";
import type { RuntimeExtendedCommandCatalog } from "./extended-command-catalog";
import type { RuntimeGameOver } from "../lifecycle/game-over";
import type { RuntimeQuestionInput } from "./questions";
import type { RuntimeInventorySnapshots } from "../menus/inventory-snapshots";

export interface RuntimeInputDispatchDependencies {
  readonly contextualLook: Pick<
    RuntimeContextualLook,
    "contextualGlanceAutoCancelPositionUntilMs"
    | "contextualGlanceProbeMouseDeadlineMs"
    | "contextualGlanceProbePrefix"
    | "contextualLookInfoAutoFlowStage"
    | "contextualLookInfoAutoFlowUntilMs"
    | "contextualLookInfoProbeMouseDeadlineMs"
    | "contextualLookInfoProbeMouseWindowMs"
    | "contextualLookInfoProbePrefix"
    | "pendingContextualLookMapRouteSelection"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "isClosed"
    | "runtimeVersion"
  >;
  readonly extendedCommandCatalog: Pick<
    RuntimeExtendedCommandCatalog,
    "resolveMetaBoundExtendedCommandName"
  >;
  readonly extendedCommands: Pick<
    RuntimeExtendedCommands,
    "canQueueExtendedCommandSubmission"
    | "clearQueuedExtendedCommandSubmission"
    | "extractExtendedCommandSubmission"
    | "pendingExtendedCommandRequest"
    | "queueExtendedCommandSubmission"
    | "resolvePendingExtendedCommandRequest"
    | "resolvePendingExtendedCommandRequestFromText"
    | "tryConsumePendingExtendedCommandInput"
  >;
  readonly gameOver: Pick<
    RuntimeGameOver,
    "isGameOverPossessionsIdentifyQuestion"
    | "pendingGameOverPossessionsInventoryFlow"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "activeInputRequest"
    | "awaitingQuestionInput"
    | "enqueueInputKeys"
    | "inputBroker"
  >;
  readonly inventoryContext: Pick<
    RuntimeInventoryContext,
    "armInventoryContextSelectionFromInput"
    | "clearPendingInventoryContextSelection"
    | "hasPendingInventoryContextSelection"
    | "isAnyInventoryContextSelectionInput"
    | "pendingInventoryContextSelection"
    | "tryAutoHandlePendingInventoryContextSelection"
  >;
  readonly inventorySnapshots: Pick<
    RuntimeInventorySnapshots,
    "lastEndedInventoryMenuKind"
  >;
  readonly keyboardInput: Pick<
    RuntimeKeyboardInput,
    "ctrlInputPrefix"
    | "isCtrlInput"
    | "isDirectionalMovementInput"
    | "isMetaInput"
    | "metaInputPrefix"
    | "normalizeInputKey"
    | "resolveMovementTargetPositionFromInput"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "playerPosition"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "createSelectionEntryFromMenuItem"
    | "currentMenuItems"
    | "currentMenuQuestionText"
    | "decodeMenuSelectionCount"
    | "getMenuSelectionKey"
    | "getMenuSelectionWakeInput"
    | "isInMultiPickup"
    | "lastEndedMenuHadQuestion"
    | "lastEndedMenuWindow"
    | "lastMenuInteractionCancelled"
    | "menuSelections"
    | "pendingMenuSelection"
    | "resolveMenuItemFromSelectionInput"
    | "resolveMenuSelection"
    | "wakeAwaitingQuestionInputForAutoSelection"
  >;
  readonly mouseInput: Pick<
    RuntimeMouseInput,
    "enqueueMouseInput"
    | "isClickMoveBlocked"
    | "resolveMouseClickMod"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "farLookMode"
    | "farLookOrigin"
    | "isFarLookPositionRequest"
    | "isLookAtMapMenuSelection"
    | "isPositionRequestContinuationInput"
    | "pendingLegacySlashEmCursorPromptFarLook"
    | "pendingLookMenuFarLookArm"
    | "positionInputActive"
    | "setPositionInputActive"
    | "shouldPreserveFarLookAfterMouseSelection"
  >;
  readonly postActionRefresh: Pick<
    RuntimePostActionRefresh,
    "armPendingPostActionPlayerTileRefreshForAnsweredYnQuestion"
    | "armPendingPostActionPlayerTileRefreshForQuestion"
    | "maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot"
    | "maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget"
    | "resolvePostActionPlayerTileRefreshQuestionContext"
  >;
  readonly questionInput: Pick<
    RuntimeQuestionInput,
    "activeYnPrompt"
    | "lastQuestionText"
  >;
  readonly textInput: Pick<
    RuntimeTextInput,
    "handleTextInputResponse"
    | "isLiteralTextInput"
    | "isTextInputCommand"
    | "pendingTextRequest"
    | "pendingTextResponses"
    | "textInputPrefix"
  >;
}

/** Ordered client keyboard, sequence and mouse command dispatch; preserves the existing input and menu state-machine branches. */
export class RuntimeInputDispatch {

  constructor(private readonly deps: RuntimeInputDispatchDependencies) {}

  handleClientInputSequence(inputs) {
    if (this.deps.coordinator.isClosed || !Array.isArray(inputs) || inputs.length === 0) {
      return;
    }

    const normalized = inputs.filter(
      (input) => typeof input === "string" && input.length > 0,
    );
    if (normalized.length === 0) {
      return;
    }

    console.log("Received client input sequence:", normalized);
    const extendedCommandText =
      this.deps.extendedCommands.extractExtendedCommandSubmission(normalized);
    if (extendedCommandText !== null) {
      if (
        this.deps.extendedCommands.resolvePendingExtendedCommandRequestFromText(extendedCommandText)
      ) {
        return;
      }
      const queued = this.deps.extendedCommands.queueExtendedCommandSubmission(
        extendedCommandText,
        "synthetic",
      );
      if (!queued) {
        // Fall back to normal key processing when command submission cannot
        // start (for example while NetHack is waiting on a prompt answer).
        for (const input of normalized) {
          this.handleClientInput(input, "synthetic");
        }
      }
      return;
    }

    for (const input of normalized) {
      this.handleClientInput(input, "synthetic");
    }
  }

  handleClientMouseInput(x, y, button, source = "user") {
    if (this.deps.coordinator.isClosed) {
      return;
    }

    const tileX = Math.trunc(Number(x));
    const tileY = Math.trunc(Number(y));
    const clickButton = Math.trunc(Number(button));
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      return;
    }

    const clickMod = this.deps.mouseInput.resolveMouseClickMod(clickButton);
    if (clickMod === null) {
      return;
    }
    if (clickButton === 0 && this.deps.mouseInput.isClickMoveBlocked()) {
      console.log(
        `Discarding click-move during travel overlap window: button=${clickButton} tile=(${tileX}, ${tileY})`,
      );
      return;
    }

    console.log(
      `Received client mouse input: button=${clickButton} tile=(${tileX}, ${tileY}) mod=${clickMod}`,
    );

    // If NetHack is stuck waiting for an unrelated async selector flow, cancel
    // it and allow mouse movement/clicklook input to reach nh_poskey.
    if (this.deps.extendedCommands.pendingExtendedCommandRequest) {
      console.log(
        "Cancelling pending extended-command request due mouse input",
      );
      this.deps.extendedCommands.resolvePendingExtendedCommandRequest(-1);
    }
    if (this.deps.menuSelection.pendingMenuSelection && this.deps.menuSelection.isInMultiPickup) {
      console.log("Cancelling pending multi-pickup selection due mouse input");
      this.deps.menuSelection.resolveMenuSelection(-1);
    }
    if (this.deps.textInput.pendingTextRequest) {
      console.log("Cancelling pending text request due mouse input");
      this.deps.textInput.handleTextInputResponse("\x1b", "system");
    }
    if (source === "user" && this.deps.inventoryContext.hasPendingInventoryContextSelection()) {
      this.deps.inventoryContext.clearPendingInventoryContextSelection("new user mouse input");
    }

    if (clickButton === 0) {
      if (
        this.deps.inputRequests.activeInputRequest?.kind === "position" &&
        this.deps.positionInput.farLookMode === "active" &&
        !this.deps.positionInput.shouldPreserveFarLookAfterMouseSelection()
      ) {
        this.deps.positionInput.farLookMode = "none";
        this.deps.positionInput.farLookOrigin = null;
        this.deps.positionInput.setPositionInputActive(false);
      }
      const legacyCursorPromptMouseExamineActive =
        this.deps.coordinator.runtimeVersion === "slashem" &&
        this.deps.inputRequests.activeInputRequest?.kind === "position" &&
        this.deps.positionInput.farLookMode === "active" &&
        this.deps.positionInput.farLookOrigin === "legacy_cursor_prompt";
      const playerX = Number(this.deps.mapCallbacks.playerPosition?.x);
      const playerY = Number(this.deps.mapCallbacks.playerPosition?.y);
      const clickedCurrentPlayerTile =
        Number.isFinite(playerX) &&
        Number.isFinite(playerY) &&
        tileX === Math.trunc(playerX) &&
        tileY === Math.trunc(playerY);
      if (legacyCursorPromptMouseExamineActive) {
        console.log(
          `Preserving legacy Slash'EM cursor far-look mouse examine at (${tileX}, ${tileY})`,
        );
      } else if (clickedCurrentPlayerTile) {
        this.deps.postActionRefresh.maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot(
          `for mouse pickup intent on current player tile (${tileX}, ${tileY})`,
        );
      } else {
        this.deps.postActionRefresh.maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget(
          tileX,
          tileY,
          `for mouse movement intent onto (${tileX}, ${tileY})`,
        );
      }
    }

    this.deps.mouseInput.enqueueMouseInput(tileX, tileY, clickMod, source);
  }

  // Handle incoming input from the client
  handleClientInput(input, source = "user") {
    if (this.deps.coordinator.isClosed) {
      return;
    }
    if (typeof input !== "string" || input.length === 0) {
      return;
    }
    if (input === this.deps.contextualLook.contextualGlanceProbePrefix) {
      // Arms auto-cancel for synthetic contextual tile probes driven by
      // the modern #glance flow.
      this.deps.contextualLook.contextualGlanceProbeMouseDeadlineMs = Date.now() + 1200;
      this.deps.contextualLook.contextualGlanceAutoCancelPositionUntilMs = 0;
      return;
    }
    if (input === this.deps.contextualLook.contextualLookInfoProbePrefix) {
      // Arms a synthetic map-routed "/what is" probe which should choose the
      // map target, then request verbose info and exit the follow-up loop.
      this.deps.contextualLook.pendingContextualLookMapRouteSelection = true;
      this.deps.contextualLook.contextualLookInfoProbeMouseDeadlineMs =
        Date.now() + this.deps.contextualLook.contextualLookInfoProbeMouseWindowMs;
      this.deps.contextualLook.contextualLookInfoAutoFlowStage =
        this.deps.coordinator.runtimeVersion === "slashem"
          ? "await_cursor_confirm"
          : "await_mouse_target";
      this.deps.contextualLook.contextualLookInfoAutoFlowUntilMs = Date.now() + 15000;
      return;
    }

    console.log("Received client input:", input, {
      source,
      awaitingQuestionInput: this.deps.inputRequests.awaitingQuestionInput,
      pendingTextResponses: this.deps.textInput.pendingTextResponses.length,
      activeInputRequestType: this.deps.inputRequests.activeInputRequest?.kind || null,
      pendingExtendedCommandRequest: Boolean(
        this.deps.extendedCommands.pendingExtendedCommandRequest,
      ),
      pendingMenuSelection: Boolean(this.deps.menuSelection.pendingMenuSelection),
      isInMultiPickup: this.deps.menuSelection.isInMultiPickup,
      hasPendingTextRequest: Boolean(this.deps.textInput.pendingTextRequest),
    });

    if (
      this.deps.inputRequests.activeInputRequest?.kind === "position" &&
      (this.deps.positionInput.positionInputActive || this.deps.positionInput.isFarLookPositionRequest()) &&
      !this.deps.positionInput.isPositionRequestContinuationInput(input)
    ) {
      console.log(
        `Cancelling active position request before command input "${input}"`,
      );
      this.deps.inputRequests.enqueueInputKeys(["Escape"], "system", ["position"]);
    }

    if (
      this.deps.inventoryContext.hasPendingInventoryContextSelection() &&
      !this.deps.inventoryContext.isAnyInventoryContextSelectionInput(input) &&
      !this.deps.inputRequests.awaitingQuestionInput
    ) {
      // Preserve freshly-armed contextual inventory selections through the
      // immediate command key (for example "__INVCTX_SELECT__:i" + "N").
      // Clear only if the pending state has gone stale.
      const pending =
        this.deps.inventoryContext.pendingInventoryContextSelection &&
          typeof this.deps.inventoryContext.pendingInventoryContextSelection === "object"
          ? this.deps.inventoryContext.pendingInventoryContextSelection
          : null;
      const armedAtMs =
        pending && Number.isFinite(pending.armedAtMs)
          ? Math.trunc(Number(pending.armedAtMs))
          : 0;
      const staleWindowMs = 3000;
      const nowMs = Date.now();
      if (armedAtMs > 0 && nowMs - armedAtMs > staleWindowMs) {
        this.deps.inventoryContext.clearPendingInventoryContextSelection("stale after user input");
      } else {
        const issuedAtMs =
          pending && Number.isFinite(pending.commandIssuedAtMs)
            ? Math.trunc(Number(pending.commandIssuedAtMs))
            : 0;
        if (source === "system") {
          // Internal synthetic/system keys should not extend contextual
          // selection lifetime.
        } else if (issuedAtMs <= 0 && pending) {
          pending.commandIssuedAtMs = nowMs;
        } else if (issuedAtMs > 0) {
          this.deps.inventoryContext.clearPendingInventoryContextSelection(
            "superseded by subsequent user input",
          );
        }
      }
    }

    if (
      this.deps.menuSelection.pendingMenuSelection &&
      this.deps.menuSelection.isInMultiPickup &&
      this.deps.keyboardInput.isDirectionalMovementInput(input) &&
      !this.deps.inputRequests.awaitingQuestionInput
    ) {
      console.log(
        `Cancelling pending multi-pickup selection due directional input "${input}"`,
      );
      this.deps.menuSelection.resolveMenuSelection(-1);
    }
    if (this.deps.textInput.pendingTextRequest && this.deps.keyboardInput.isDirectionalMovementInput(input)) {
      console.log(
        `Cancelling pending text request due directional input "${input}"`,
      );
      this.deps.textInput.handleTextInputResponse("\x1b", "system");
    }

    if (this.deps.extendedCommands.tryConsumePendingExtendedCommandInput(input)) {
      return;
    }

    if (this.deps.textInput.isTextInputCommand(input)) {
      const text = input.slice(this.deps.textInput.textInputPrefix.length);
      this.deps.textInput.handleTextInputResponse(text, source);
      return;
    }

    if (this.deps.inventoryContext.armInventoryContextSelectionFromInput(input)) {
      if (
        this.deps.inputRequests.awaitingQuestionInput &&
        Array.isArray(this.deps.menuSelection.currentMenuItems) &&
        this.deps.menuSelection.currentMenuItems.some((item) => item && !item.isCategory)
      ) {
        const didAutoSelect =
          this.deps.inventoryContext.tryAutoHandlePendingInventoryContextSelection(
            this.deps.menuSelection.currentMenuQuestionText,
            this.deps.menuSelection.currentMenuItems,
            {
              reason: "context action (armed during active menu wait)",
            },
          );
        if (didAutoSelect) {
          this.deps.menuSelection.wakeAwaitingQuestionInputForAutoSelection(source);
        }
      }
      return;
    }

    if (this.deps.keyboardInput.isMetaInput(input)) {
      const metaKey = input.slice(this.deps.keyboardInput.metaInputPrefix.length).charAt(0);
      if (!metaKey) {
        return;
      }

      const mappedExtCommand =
        this.deps.extendedCommandCatalog.resolveMetaBoundExtendedCommandName(metaKey);
      if (mappedExtCommand) {
        if (!this.deps.extendedCommands.canQueueExtendedCommandSubmission()) {
          console.log(
            `Meta extended command "${mappedExtCommand}" blocked by active prompt state; forwarding "${metaKey}" as normal event input`,
          );
          this.deps.extendedCommands.clearQueuedExtendedCommandSubmission(
            "blocked meta extended command",
          );
          this.deps.inputRequests.enqueueInputKeys([metaKey], "meta", ["event"]);
          return;
        }
        console.log(
          `Meta input Alt+${metaKey.toLowerCase()} mapped to extended command "${mappedExtCommand}"`,
        );
        this.deps.extendedCommands.queueExtendedCommandSubmission(mappedExtCommand, "meta");
        return;
      }

      this.deps.inputRequests.enqueueInputKeys(["Escape", metaKey], "meta", ["event"]);
      return;
    }

    if (this.deps.keyboardInput.isCtrlInput(input)) {
      const ctrlKey = input.slice(this.deps.keyboardInput.ctrlInputPrefix.length).charAt(0);
      if (!ctrlKey) {
        return;
      }
      // NetHack expects control-byte keycodes: C(c) = (0x1f & c).
      const controlCode = ctrlKey.charCodeAt(0) & 0x1f;
      if (controlCode <= 0) {
        return;
      }
      this.deps.inputRequests.enqueueInputKeys([String.fromCharCode(controlCode)], "ctrl");
      return;
    }

    const selectedMenuItem = this.deps.menuSelection.resolveMenuItemFromSelectionInput(input);
    if (selectedMenuItem) {
      const selectionCount = this.deps.menuSelection.decodeMenuSelectionCount(input);
      const selectionEntry =
        this.deps.menuSelection.createSelectionEntryFromMenuItem(selectedMenuItem, selectionCount);
      if (!selectionEntry) {
        return;
      }
      const selectionKey = this.deps.menuSelection.getMenuSelectionKey(selectionEntry);

      if (this.deps.menuSelection.isInMultiPickup) {
        if (this.deps.menuSelection.menuSelections.has(selectionKey)) {
          if (Number.isFinite(selectionCount) && Number(selectionCount) > 0) {
            this.deps.menuSelection.menuSelections.set(selectionKey, selectionEntry);
            console.log(
              `Updated selected item count: ${selectionEntry.menuChar} (${selectionEntry.text}) x${selectionEntry.count}. Current selections:`,
              Array.from(this.deps.menuSelection.menuSelections.values()).map(
                (item) =>
                  `${item.menuChar}:${item.text}${Number.isFinite(item.count) ? ` x${item.count}` : ""
                  }`,
              ),
            );
          } else {
            this.deps.menuSelection.menuSelections.delete(selectionKey);
            console.log(
              `Deselected item: ${selectionEntry.menuChar} (${selectionEntry.text}). Current selections:`,
              Array.from(this.deps.menuSelection.menuSelections.values()).map(
                (item) => `${item.menuChar}:${item.text}`,
              ),
            );
          }
        } else {
          this.deps.menuSelection.menuSelections.set(selectionKey, selectionEntry);
          console.log(
            `Selected item: ${selectionEntry.menuChar} (${selectionEntry.text}). Current selections:`,
            Array.from(this.deps.menuSelection.menuSelections.values()).map(
              (item) =>
                `${item.menuChar}:${item.text}${Number.isFinite(item.count) ? ` x${item.count}` : ""
                }`,
            ),
          );
        }
        return;
      }

      this.deps.menuSelection.menuSelections.clear();
      this.deps.menuSelection.menuSelections.set(selectionKey, selectionEntry);
      this.deps.menuSelection.lastMenuInteractionCancelled = false;
      console.log(
        `Recorded single menu selection by index: ${selectionEntry.menuIndex} (${selectionEntry.menuChar} ${selectionEntry.text})`,
      );

      if (this.deps.inputRequests.awaitingQuestionInput) {
        this.deps.postActionRefresh.armPendingPostActionPlayerTileRefreshForQuestion(
          this.deps.postActionRefresh.resolvePostActionPlayerTileRefreshQuestionContext(
            this.deps.menuSelection.currentMenuQuestionText,
          ),
        );
        const wakeInput = this.deps.menuSelection.getMenuSelectionWakeInput(selectedMenuItem);
        this.deps.inputRequests.enqueueInputKeys([wakeInput], source, ["event"]);
      }
      return;
    }

    if (this.deps.textInput.isLiteralTextInput(input)) {
      this.deps.textInput.handleTextInputResponse(input, source);
      return;
    }

    const normalizedInput = this.deps.keyboardInput.normalizeInputKey(input);
    if (
      !this.deps.menuSelection.isInMultiPickup &&
      normalizedInput === "Escape" &&
      this.deps.inputRequests.awaitingQuestionInput &&
      Array.isArray(this.deps.menuSelection.currentMenuItems) &&
      this.deps.menuSelection.currentMenuItems.some((item) => item && !item.isCategory)
    ) {
      this.deps.menuSelection.lastMenuInteractionCancelled = true;
      this.deps.inventoryContext.clearPendingInventoryContextSelection("menu interaction cancelled");
    }
    if (
      this.deps.gameOver.pendingGameOverPossessionsInventoryFlow &&
      this.deps.gameOver.isGameOverPossessionsIdentifyQuestion(this.deps.questionInput.lastQuestionText)
    ) {
      const normalizedYesNoInput = String(normalizedInput || "")
        .trim()
        .toLowerCase();
      if (normalizedYesNoInput !== "y") {
        this.deps.gameOver.pendingGameOverPossessionsInventoryFlow = false;
      }
    }

    if (
      !this.deps.menuSelection.isInMultiPickup &&
      this.deps.inputRequests.awaitingQuestionInput &&
      typeof normalizedInput === "string" &&
      normalizedInput.length === 1 &&
      Array.isArray(this.deps.menuSelection.currentMenuItems) &&
      this.deps.menuSelection.currentMenuItems.length > 0
    ) {
      const suppressSyntheticSelectionOverride =
        source === "synthetic" &&
        this.deps.menuSelection.menuSelections.size > 0 &&
        this.deps.inventoryContext.hasPendingInventoryContextSelection() &&
        this.deps.menuSelection.lastEndedMenuWindow === 4 &&
        !this.deps.menuSelection.lastEndedMenuHadQuestion &&
        this.deps.inventorySnapshots.lastEndedInventoryMenuKind === "inventory";
      if (suppressSyntheticSelectionOverride) {
        console.log(
          `Ignoring synthetic menu accelerator "${normalizedInput}" while preserving contextual inventory auto-selection`,
        );
      } else {
        const menuItem = this.deps.menuSelection.currentMenuItems.find(
          (item) => item.accelerator === normalizedInput && !item.isCategory,
        );
        if (menuItem) {
          this.deps.menuSelection.menuSelections.clear();
          const selectionEntry = this.deps.menuSelection.createSelectionEntryFromMenuItem(menuItem);
          if (!selectionEntry) {
            return;
          }
          const selectionKey = this.deps.menuSelection.getMenuSelectionKey(selectionEntry);
          this.deps.menuSelection.menuSelections.set(selectionKey, selectionEntry);
          this.deps.menuSelection.lastMenuInteractionCancelled = false;
          console.log(
            `Recorded single menu selection: ${normalizedInput} (${menuItem.text})`,
          );
          this.deps.postActionRefresh.armPendingPostActionPlayerTileRefreshForQuestion(
            this.deps.postActionRefresh.resolvePostActionPlayerTileRefreshQuestionContext(
              this.deps.menuSelection.currentMenuQuestionText,
            ),
          );
          if (this.deps.positionInput.isLookAtMapMenuSelection(menuItem)) {
            this.deps.inputRequests.enqueueInputKeys([";"], source, ["event"]);
            return;
          }
        }
      }
    }

    if (
      this.deps.menuSelection.isInMultiPickup &&
      typeof normalizedInput === "string" &&
      normalizedInput.length === 1 &&
      normalizedInput !== "\r" &&
      normalizedInput !== "\n" &&
      normalizedInput !== "Escape"
    ) {
      const menuItem = this.deps.menuSelection.currentMenuItems.find(
        (item) => item.accelerator === normalizedInput && !item.isCategory,
      );
      if (menuItem) {
        const selectionEntry = this.deps.menuSelection.createSelectionEntryFromMenuItem(menuItem);
        if (!selectionEntry) {
          return;
        }
        const selectionKey = this.deps.menuSelection.getMenuSelectionKey(selectionEntry);
        if (this.deps.menuSelection.menuSelections.has(selectionKey)) {
          this.deps.menuSelection.menuSelections.delete(selectionKey);
          console.log(
            `Deselected item: ${normalizedInput} (${menuItem.text}). Current selections:`,
            Array.from(this.deps.menuSelection.menuSelections.values()).map(
              (item) => `${item.menuChar}:${item.text}`,
            ),
          );
        } else {
          this.deps.menuSelection.menuSelections.set(selectionKey, selectionEntry);
          console.log(
            `Selected item: ${normalizedInput} (${menuItem.text}). Current selections:`,
            Array.from(this.deps.menuSelection.menuSelections.values()).map(
              (item) => `${item.menuChar}:${item.text}`,
            ),
          );
        }
      } else {
        console.log(`No menu item found for accelerator '${normalizedInput}'`);
      }
      console.log("Multi-pickup item selection updated");
      return;
    }

    if (
      this.deps.menuSelection.isInMultiPickup &&
      (normalizedInput === "Enter" ||
        normalizedInput === "\r" ||
        normalizedInput === "\n")
    ) {
      const selectedItems = Array.from(this.deps.menuSelection.menuSelections.values()).map(
        (item) => `${item.menuChar}:${item.text}`,
      );
      console.log("Confirming multi-pickup with selections:", selectedItems);
      this.deps.postActionRefresh.armPendingPostActionPlayerTileRefreshForQuestion(
        this.deps.postActionRefresh.resolvePostActionPlayerTileRefreshQuestionContext(
          this.deps.menuSelection.currentMenuQuestionText,
        ),
      );
      this.deps.menuSelection.lastMenuInteractionCancelled = false;
      this.deps.menuSelection.resolveMenuSelection(this.deps.menuSelection.menuSelections.size);
      if (this.deps.inputRequests.inputBroker.hasPendingRequests("event")) {
        this.deps.inputRequests.enqueueInputKeys(["Enter"], source, ["event"]);
      }
      return;
    }

    if (this.deps.menuSelection.isInMultiPickup && normalizedInput === "Escape") {
      this.deps.menuSelection.menuSelections.clear();
      this.deps.menuSelection.resolveMenuSelection(-1);
      this.deps.inventoryContext.clearPendingInventoryContextSelection(
        "multi-select menu interaction cancelled",
      );
      if (this.deps.inputRequests.inputBroker.hasPendingRequests("event")) {
        this.deps.inputRequests.enqueueInputKeys(["Escape"], source, ["event"]);
      }
      return;
    }

    const normalizedAnsweredYnInput = String(normalizedInput || "")
      .trim()
      .toLowerCase();
    if (this.deps.inputRequests.awaitingQuestionInput && this.deps.positionInput.pendingLegacySlashEmCursorPromptFarLook) {
      if (normalizedAnsweredYnInput === "y") {
        console.log(
          'Arming far-look mode for legacy Slash\'EM cursor prompt on answered "y"',
        );
        this.deps.positionInput.farLookMode = "armed";
        this.deps.positionInput.farLookOrigin = "legacy_cursor_prompt";
        this.deps.positionInput.pendingLookMenuFarLookArm = false;
      }
      this.deps.positionInput.pendingLegacySlashEmCursorPromptFarLook = false;
    }
    if (this.deps.inputRequests.awaitingQuestionInput && this.deps.questionInput.activeYnPrompt) {
      this.deps.postActionRefresh.armPendingPostActionPlayerTileRefreshForAnsweredYnQuestion(
        this.deps.questionInput.lastQuestionText,
        normalizedInput,
      );
    }
    if (normalizedInput === ",") {
      this.deps.postActionRefresh.maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot(
        'for explicit pickup input "," on current player tile',
      );
    }
    if (this.deps.keyboardInput.isDirectionalMovementInput(normalizedInput)) {
      const movementTarget =
        this.deps.keyboardInput.resolveMovementTargetPositionFromInput(normalizedInput);
      if (movementTarget) {
        this.deps.postActionRefresh.maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget(
          movementTarget.x,
          movementTarget.y,
          `for keyboard movement intent "${normalizedInput}" onto (${movementTarget.x}, ${movementTarget.y})`,
        );
      }
    }

    this.deps.inputRequests.enqueueInputKeys([normalizedInput], source);
  }
}
