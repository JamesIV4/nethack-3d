// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeInputRequests } from "./input-requests";
import type { RuntimeTextInput } from "./text-input";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeExtendedCommandCatalog } from "./extended-command-catalog";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeInventoryContext } from "../menus/inventory-context";
import type { RuntimeKeyboardInput } from "./keyboard";
import type { RuntimePositionInput } from "./position-selection";
import type { RuntimeStartupConfiguration } from "../startup/startup-configuration";

export interface RuntimeExtendedCommandsDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "startupOptions"
    | "protocol"
  >;
  readonly extendedCommandCatalog: Pick<
    RuntimeExtendedCommandCatalog,
    "getExtendedCommandEntries"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "awaitingQuestionInput"
    | "enqueueInputKeys"
    | "inputBroker"
  >;
  readonly inventoryContext: Pick<
    RuntimeInventoryContext,
    "clearPendingInventoryContextSelection"
  >;
  readonly keyboardInput: Pick<
    RuntimeKeyboardInput,
    "normalizeInputKey"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "decodeMenuSelectionIndex"
    | "isInMultiPickup"
    | "isMenuSelectionInput"
    | "pendingMenuSelection"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "farLookMode"
    | "farLookOrigin"
    | "pendingLookMenuFarLookArm"
  >;
  readonly startupOptions: Pick<
    RuntimeStartupConfiguration,
    "resolveStartupExtmenuEnabled"
  >;
  readonly textInput: Pick<
    RuntimeTextInput,
    "pendingTextRequest"
  >;
}

/** Queued extended command submissions, dedicated command prompt waiters and far-look command activation. */
export class RuntimeExtendedCommands {
  declare pendingExtendedCommand: any;
  declare extendedCommandTriggerQueued: boolean;
  declare pendingExtendedCommandRequest: any;
  declare startupExtmenuEnabled: boolean;

  constructor(private readonly deps: RuntimeExtendedCommandsDependencies) {
    this.pendingExtendedCommand = null;
    this.extendedCommandTriggerQueued = false;
    this.pendingExtendedCommandRequest = null;
    this.startupExtmenuEnabled = this.deps.startupOptions.resolveStartupExtmenuEnabled(
      this.deps.coordinator.startupOptions?.initOptions,
    );
  }

  isExtendedCommandSubmitToken(input) {
    return input === "Enter" || input === "\r" || input === "\n";
  }

  extractExtendedCommandSubmission(inputs) {
    if (!Array.isArray(inputs) || inputs.length < 2) {
      return null;
    }

    const first = inputs[0];
    const last = inputs[inputs.length - 1];
    if (first !== "#" || !this.isExtendedCommandSubmitToken(last)) {
      return null;
    }

    let commandText = "";
    for (let i = 1; i < inputs.length - 1; i += 1) {
      const token = inputs[i];
      if (token === "Backspace") {
        commandText = commandText.slice(0, -1);
        continue;
      }
      if (token === "#") {
        continue;
      }
      if (typeof token === "string" && token.length === 1) {
        if (/^[A-Za-z0-9_?-]$/.test(token)) {
          commandText += token.toLowerCase();
          continue;
        }
      }
      return null;
    }

    return commandText;
  }

  queueExtendedCommandSubmission(commandText, source = "synthetic") {
    if (!this.canQueueExtendedCommandSubmission()) {
      console.log(
        `Skipping extended command submission while prompt input is active (command="${commandText}")`,
      );
      this.clearQueuedExtendedCommandSubmission(
        "prompt input active during queue request",
      );
      return false;
    }
    const normalizedCommand =
      typeof commandText === "string" ? commandText : "";
    if (this.resolvePendingExtendedCommandRequestFromText(normalizedCommand)) {
      return true;
    }
    this.pendingExtendedCommand = normalizedCommand;
    // Do not gate trigger injection on previous attempts. If a prior "#"
    // trigger was consumed without reaching shim_get_ext_cmd, we still need to
    // enqueue a fresh trigger to avoid command deadlock.
    this.extendedCommandTriggerQueued = true;
    // Route "#" through the normal input path so whichever callback is active
    // can kick NetHack into extended-command resolution.
    this.deps.inputRequests.enqueueInputKeys(["#"], source);
    return true;
  }

  canQueueExtendedCommandSubmission() {
    return (
      !this.deps.inputRequests.awaitingQuestionInput &&
      !this.deps.textInput.pendingTextRequest &&
      !this.deps.menuSelection.pendingMenuSelection &&
      !this.deps.menuSelection.isInMultiPickup
    );
  }

  clearQueuedExtendedCommandSubmission(reason = "reset") {
    const hadQueuedTrigger = this.extendedCommandTriggerQueued;
    const hadPendingCommand =
      this.pendingExtendedCommand !== null &&
      this.pendingExtendedCommand !== undefined;
    if (!hadQueuedTrigger && !hadPendingCommand) {
      return;
    }
    console.log(`Clearing queued extended command submission (${reason})`, {
      hadQueuedTrigger,
      pendingCommand:
        typeof this.pendingExtendedCommand === "string"
          ? this.pendingExtendedCommand
          : null,
    });
    this.pendingExtendedCommand = null;
    this.extendedCommandTriggerQueued = false;
  }

  dequeuePendingExtendedCommandSubmission() {
    const pending = this.pendingExtendedCommand;
    this.pendingExtendedCommand = null;
    this.extendedCommandTriggerQueued = false;
    if (pending === null || pending === undefined) {
      return undefined;
    }
    return pending;
  }

  buildExtendedCommandPromptMenuItems() {
    const entries = this.deps.extendedCommandCatalog.getExtendedCommandEntries();
    const menuItems = [];
    let menuIndex = 0;
    for (const entry of entries) {
      const commandName = String(entry?.name || "")
        .trim()
        .toLowerCase();
      if (!commandName || commandName === "#" || commandName === "?") {
        continue;
      }
      menuItems.push({
        menuIndex,
        commandIndex: entry.index,
        accelerator: "",
        text: commandName,
        isCategory: false,
      });
      menuIndex += 1;
    }
    return menuItems;
  }

  requestExtendedCommandSelectionFromUi() {
    if (
      this.pendingExtendedCommandRequest &&
      this.pendingExtendedCommandRequest.promise
    ) {
      return this.pendingExtendedCommandRequest.promise;
    }

    const menuItems = this.buildExtendedCommandPromptMenuItems();
    if (!menuItems.length || !this.deps.coordinator.eventHandler) {
      return Promise.resolve(-1);
    }

    const menuIndexToCommandIndex = new Map();
    for (const item of menuItems) {
      if (
        Number.isInteger(item.menuIndex) &&
        Number.isInteger(item.commandIndex)
      ) {
        menuIndexToCommandIndex.set(item.menuIndex, item.commandIndex);
      }
    }

    let resolveSelection = null;
    const requestPromise = new Promise((resolve) => {
      resolveSelection = resolve;
    });
    this.pendingExtendedCommandRequest = {
      resolve: resolveSelection,
      promise: requestPromise,
      commandBuffer: "",
      menuIndexToCommandIndex,
    };

    this.deps.coordinator.emit({
      type: "question",
      text: "What extended command?",
      choices: "",
      default: "",
      menuItems,
      source: "shim_get_ext_cmd",
    });

    return requestPromise;
  }

  resolvePendingExtendedCommandRequest(commandIndex) {
    const pending = this.pendingExtendedCommandRequest;
    this.pendingExtendedCommandRequest = null;
    if (!pending || typeof pending.resolve !== "function") {
      return;
    }
    this.armFarLookForExtendedCommandIndex(commandIndex);
    this.deps.coordinator.protocol.consumed(undefined, ["shim_get_ext_cmd"]);
    pending.resolve(Number.isInteger(commandIndex) ? commandIndex : -1);
  }

  resolvePendingExtendedCommandRequestFromText(commandText) {
    if (!this.pendingExtendedCommandRequest) {
      return false;
    }

    const normalized = String(commandText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      this.resolvePendingExtendedCommandRequest(-1);
      this.deps.inventoryContext.clearPendingInventoryContextSelection(
        "extended command submission cancelled",
      );
      return true;
    }

    const extCommandIndex = this.resolveExtendedCommandIndex(normalized);
    if (extCommandIndex < 0) {
      console.log(
        `Unknown extended command "${normalized}" while awaiting shim_get_ext_cmd; canceling`,
      );
      this.resolvePendingExtendedCommandRequest(-1);
      this.deps.inventoryContext.clearPendingInventoryContextSelection(
        "unknown extended command submission",
      );
      return true;
    }

    this.resolvePendingExtendedCommandRequest(extCommandIndex);
    return true;
  }

  tryConsumePendingExtendedCommandInput(input) {
    const pending = this.pendingExtendedCommandRequest;
    if (!pending) {
      return false;
    }

    if (this.deps.menuSelection.isMenuSelectionInput(input)) {
      const menuIndex = this.deps.menuSelection.decodeMenuSelectionIndex(input);
      const extCommandIndex = Number.isInteger(menuIndex)
        ? pending.menuIndexToCommandIndex.get(menuIndex)
        : undefined;
      if (Number.isInteger(extCommandIndex)) {
        this.resolvePendingExtendedCommandRequest(extCommandIndex);
      } else {
        this.resolvePendingExtendedCommandRequest(-1);
        this.deps.inventoryContext.clearPendingInventoryContextSelection(
          "extended command menu selection cancelled",
        );
      }
      return true;
    }

    const normalizedInput = this.deps.keyboardInput.normalizeInputKey(input);
    if (normalizedInput === "Escape") {
      this.resolvePendingExtendedCommandRequest(-1);
      this.deps.inventoryContext.clearPendingInventoryContextSelection(
        "extended command prompt cancelled",
      );
      return true;
    }
    if (this.isExtendedCommandSubmitToken(normalizedInput)) {
      this.resolvePendingExtendedCommandRequestFromText(pending.commandBuffer);
      return true;
    }
    if (normalizedInput === "Backspace") {
      pending.commandBuffer = pending.commandBuffer.slice(0, -1);
      return true;
    }
    if (
      typeof normalizedInput === "string" &&
      normalizedInput.length === 1 &&
      /^[A-Za-z0-9_?-]$/.test(normalizedInput)
    ) {
      pending.commandBuffer += normalizedInput.toLowerCase();
      return true;
    }

    // Unrelated keys should cancel stale ext-command waits so gameplay input
    // can flow back through normal nh_poskey handling.
    this.resolvePendingExtendedCommandRequest(-1);
    this.deps.inventoryContext.clearPendingInventoryContextSelection(
      "extended command input changed",
    );
    return false;
  }

  consumeQueuedExtendedCommandInput() {
    let commandText = "";

    while (true) {
      const nextToken = this.deps.inputRequests.inputBroker.dequeueToken("event");
      if (!nextToken) {
        break;
      }

      const nextInput = nextToken.key;
      if (nextInput === undefined || nextInput === null) {
        continue;
      }

      if (nextInput === "Escape") {
        return null;
      }
      if (nextInput === "Enter" || nextInput === "\r" || nextInput === "\n") {
        break;
      }
      if (nextInput === "Backspace") {
        commandText = commandText.slice(0, -1);
        continue;
      }

      let token = null;
      if (typeof nextInput === "string" && nextInput.length === 1) {
        token = nextInput;
      } else {
        // Preserve non-command input for the normal callback path.
        this.deps.inputRequests.inputBroker.prependToken(nextToken);
        break;
      }

      if (!token || token === "#") {
        continue;
      }
      if (/^[A-Za-z0-9_?-]$/.test(token)) {
        commandText += token.toLowerCase();
        continue;
      }

      // Preserve unexpected input for regular processing.
      this.deps.inputRequests.inputBroker.prependToken(nextToken);
      break;
    }

    return commandText;
  }

  resolveExtendedCommandIndex(commandText) {
    const normalized = String(commandText || "")
      .trim()
      .toLowerCase()
      .replace(/^#+/, "");
    if (!normalized) {
      return -1;
    }

    const entries = this.deps.extendedCommandCatalog.getExtendedCommandEntries();
    if (entries.length) {
      const exact = entries.find((entry) => entry.name === normalized);
      if (exact) {
        return exact.index;
      }

      const prefixMatches = entries.filter((entry) =>
        entry.name.startsWith(normalized),
      );
      if (prefixMatches.length === 1) {
        return prefixMatches[0].index;
      }
      return -1;
    }

    return -1;
  }

  resolveExtendedCommandNameByIndex(commandIndex) {
    if (!Number.isInteger(commandIndex) || commandIndex < 0) {
      return null;
    }
    const entry = this.deps.extendedCommandCatalog.getExtendedCommandEntries().find(
      (candidate) => candidate && candidate.index === commandIndex,
    );
    return entry && typeof entry.name === "string" ? entry.name : null;
  }

  armFarLookForExtendedCommandIndex(commandIndex) {
    const commandName = this.resolveExtendedCommandNameByIndex(commandIndex);
    if (commandName !== "glance") {
      return;
    }
    console.log("Arming far-look mode for #glance extended command");
    this.deps.positionInput.farLookMode = "armed";
    this.deps.positionInput.farLookOrigin = "direct";
    this.deps.positionInput.pendingLookMenuFarLookArm = false;
  }

  handleShimGetExtCmd() {
    const queuedExtendedCommandText =
      this.dequeuePendingExtendedCommandSubmission();
    const extCommandText =
      queuedExtendedCommandText !== undefined
        ? queuedExtendedCommandText
        : this.consumeQueuedExtendedCommandInput();
    if (extCommandText === null) {
      console.log("Extended command cancelled before submission");
      return -1;
    }

    if (!extCommandText) {
      if (this.startupExtmenuEnabled) {
        console.log(
          "Extended command submission was empty; awaiting extmenu selection",
        );
        return this.requestExtendedCommandSelectionFromUi();
      }
      console.log("Extended command submission was empty");
      return -1;
    }

    const extCommandIndex =
      this.resolveExtendedCommandIndex(extCommandText);
    if (extCommandIndex < 0) {
      console.log(
        `Unknown extended command "${extCommandText}" (canceling command)`,
      );
      return -1;
    }

    console.log(
      `Resolved extended command "${extCommandText}" to index ${extCommandIndex}`,
    );
    this.armFarLookForExtendedCommandIndex(extCommandIndex);
    return extCommandIndex;
  }
}
