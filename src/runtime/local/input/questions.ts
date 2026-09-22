// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeInventorySnapshots } from "../menus/inventory-snapshots";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeGameOver } from "../lifecycle/game-over";
import type { RuntimeCheckpointRecovery } from "../persistence/checkpoint-recovery";
import type { RuntimeKeyboardInput } from "./keyboard";
import type { RuntimeContextualLook } from "./contextual-look";
import type { RuntimePositionInput } from "./position-selection";
import type { RuntimeInputRequests } from "./input-requests";

export interface RuntimeQuestionInputDependencies {
  readonly contextualLook: Pick<
    RuntimeContextualLook,
    "resolveContextualLookInfoAutoAnswer"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "logRoutine"
    | "emit"
    | "eventHandler"
    | "runtimeVersion"
  >;
  readonly gameOver: Pick<
    RuntimeGameOver,
    "beginGameOverSequence"
    | "isGameOverPossessionsIdentifyQuestion"
    | "pendingGameOverPossessionsInventoryFlow"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "waitForQuestionInput"
  >;
  readonly inventorySnapshots: Pick<
    RuntimeInventorySnapshots,
    "latestInventoryItems"
  >;
  readonly keyboardInput: Pick<
    RuntimeKeyboardInput,
    "processKey"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "isContainerLootTypeQuestion"
    | "normalizeQuestionText"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "pendingLegacySlashEmCursorPromptFarLook"
    | "farLookMode"
    | "farLookOrigin"
  >;
  readonly recovery: Pick<
    RuntimeCheckpointRecovery,
    "shouldAutoConfirmCheckpointCleanup"
    | "shouldAutoRecoverCheckpointResume"
  >;
}

/** YN question dispatch, legacy inventory prompts, default answers and escape semantics. */
export class RuntimeQuestionInput {
  declare lastQuestionText: any;
  declare activeYnPrompt: any;
  declare legacyAutoHelpYnPromptSignature: string;
  declare legacyAutoHelpYnPromptUntilMs: number;

  constructor(private readonly deps: RuntimeQuestionInputDependencies) {
    this.lastQuestionText = null;
    // Store the last question for menu expansion
    this.activeYnPrompt = null;
    this.legacyAutoHelpYnPromptSignature = "";
    this.legacyAutoHelpYnPromptUntilMs = 0;
  }

  normalizeYnDefaultChoice(defaultChoice) {
    if (typeof defaultChoice === "string" && defaultChoice.length > 0) {
      return defaultChoice.trim().charAt(0).toLowerCase();
    }
    if (
      typeof defaultChoice === "number" &&
      Number.isFinite(defaultChoice) &&
      defaultChoice > 0
    ) {
      return String.fromCharCode(Math.trunc(defaultChoice)).toLowerCase();
    }
    return "";
  }

  getQuestionBracketChoiceSpec(question) {
    const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
    return typeof bracketMatch?.[1] === "string"
      ? bracketMatch[1].trim().toLowerCase()
      : "";
  }

  expandLegacyQuestionChoiceSpec(spec) {
    const normalized = String(spec || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+or\s+/gi, " ")
      .replace(/[,/|]/g, " ")
      .replace(/\s+/g, "")
      .replace(/[\[\]]/g, "");

    if (!normalized) {
      return [];
    }

    const expanded = [];
    const seen = new Set();
    const addChoice = (value) => {
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      expanded.push(value);
    };

    const canExpandRange = (start, end) => {
      const isLower = (value) => value >= "a" && value <= "z";
      const isUpper = (value) => value >= "A" && value <= "Z";
      const isDigit = (value) => value >= "0" && value <= "9";
      return (
        (isLower(start) && isLower(end)) ||
        (isUpper(start) && isUpper(end)) ||
        (isDigit(start) && isDigit(end))
      );
    };

    for (let i = 0; i < normalized.length; i += 1) {
      const current = normalized[i];
      const hasRangeEnd =
        i + 2 < normalized.length && normalized[i + 1] === "-";

      if (hasRangeEnd) {
        const end = normalized[i + 2];
        if (canExpandRange(current, end)) {
          const startCode = current.charCodeAt(0);
          const endCode = end.charCodeAt(0);
          const step = startCode <= endCode ? 1 : -1;
          for (
            let code = startCode;
            step > 0 ? code <= endCode : code >= endCode;
            code += step
          ) {
            addChoice(String.fromCharCode(code));
          }
          i += 2;
          continue;
        }
      }

      if (current !== "-") {
        addChoice(current);
      }
    }

    return expanded;
  }

  buildLegacySlashEmInventoryQuestionMenuItems(question, choices) {
    if (this.deps.coordinator.runtimeVersion !== "slashem") {
      return [];
    }

    const inventoryItems = Array.isArray(this.deps.inventorySnapshots.latestInventoryItems)
      ? this.deps.inventorySnapshots.latestInventoryItems
      : [];
    if (inventoryItems.length === 0) {
      return [];
    }

    const bracketChoiceSpec = this.getQuestionBracketChoiceSpec(question);
    const effectiveChoiceSpec = `${String(choices || "")} ${bracketChoiceSpec}`
      .trim()
      .toLowerCase();
    if (
      !effectiveChoiceSpec ||
      (!effectiveChoiceSpec.includes("?") && !effectiveChoiceSpec.includes("*"))
    ) {
      return [];
    }

    const requestedChoices = this.expandLegacyQuestionChoiceSpec(
      effectiveChoiceSpec,
    ).filter((choice) => choice !== "?" && choice !== "*");
    if (requestedChoices.length === 0) {
      return [];
    }

    const requestedChoiceSet = new Set(requestedChoices);
    const matchedChoices = new Set();
    const filteredItems = [];
    let pendingCategory = null;

    for (const item of inventoryItems) {
      if (!item || typeof item !== "object") {
        continue;
      }
      if (item.isCategory) {
        pendingCategory = item;
        continue;
      }

      const accelerator = String(item.accelerator || "").trim();
      if (!accelerator || !requestedChoiceSet.has(accelerator)) {
        continue;
      }

      if (pendingCategory) {
        filteredItems.push({ ...pendingCategory });
        pendingCategory = null;
      }
      filteredItems.push({ ...item });
      matchedChoices.add(accelerator);
    }

    if (matchedChoices.size !== requestedChoiceSet.size) {
      return [];
    }

    return filteredItems;
  }

  resolveLegacyAutoHelpYnPromptAnswer(question, choices) {
    if (this.deps.coordinator.runtimeVersion !== "slashem") {
      return null;
    }

    const normalizedQuestion = this.deps.menuSelection.normalizeQuestionText(question);
    const normalizedChoices =
      typeof choices === "string" ? choices.trim().toLowerCase() : "";
    const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
    const normalizedBracketChoices =
      typeof bracketMatch?.[1] === "string"
        ? bracketMatch[1].trim().toLowerCase()
        : "";
    const effectiveChoices = `${normalizedChoices}${normalizedBracketChoices}`;
    const autoChoice = effectiveChoices.includes(",")
      ? ","
      : effectiveChoices.includes("*")
        ? "*"
        : null;
    if (!autoChoice) {
      return null;
    }

    const signature = `${normalizedQuestion}|${effectiveChoices}`;
    const nowMs = Date.now();
    if (
      this.legacyAutoHelpYnPromptSignature === signature &&
      nowMs <= this.legacyAutoHelpYnPromptUntilMs
    ) {
      return null;
    }

    this.legacyAutoHelpYnPromptSignature = signature;
    this.legacyAutoHelpYnPromptUntilMs = nowMs + 2500;
    this.deps.coordinator.logRoutine(
      `Auto-answering legacy yn_function inventory prompt with "${autoChoice}"`,
      {
        question: normalizedQuestion,
        choices: effectiveChoices,
      },
    );
    return autoChoice;
  }

  isLegacySlashEmCursorPromptQuestion(question, choices, defaultChoice) {
    if (this.deps.coordinator.runtimeVersion !== "slashem") {
      return false;
    }

    const normalizedQuestion = this.deps.menuSelection.normalizeQuestionText(question);
    if (normalizedQuestion !== "specify unknown object by cursor?") {
      return false;
    }

    const normalizedChoices =
      typeof choices === "string" ? choices.trim().toLowerCase() : "";
    const normalizedDefaultChoice =
      this.normalizeYnDefaultChoice(defaultChoice);
    return normalizedChoices === "ynq" && normalizedDefaultChoice === "q";
  }

  handleShimYnFunction(args) {
    const [question, choices, defaultChoice] = args;
    const normalizedChoices =
      typeof choices === "string" ? choices : String(choices ?? "");
    const normalizedDefaultChoice =
      typeof defaultChoice === "number" && Number.isFinite(defaultChoice)
        ? Math.trunc(defaultChoice)
        : 0;
    this.deps.coordinator.logRoutine(
      `Y/N Question: "${question}" choices: "${choices}" default: ${defaultChoice}`,
    );

    this.lastQuestionText = question;
    this.activeYnPrompt = null;
    this.deps.gameOver.pendingGameOverPossessionsInventoryFlow =
      this.deps.gameOver.isGameOverPossessionsIdentifyQuestion(question);
    if (this.deps.gameOver.pendingGameOverPossessionsInventoryFlow) {
      this.deps.gameOver.beginGameOverSequence("possessions-question");
    }

    if (this.deps.recovery.shouldAutoRecoverCheckpointResume(question)) {
      // Autosave rows in the load-game UI represent explicit recovery of
      // checkpoint-only runs. Once the wasm package exposes a full browser-side
      // checkpoint resume bridge, accept NetHack's follow-up recover prompt
      // automatically so resume goes straight into the recovered save without
      // asking the player twice.
      const recoveryChoice = /r/i.test(normalizedChoices) ? "r" : "y";
      this.deps.coordinator.logRoutine(
        `Auto-confirming checkpoint recovery with "${recoveryChoice}" during autosave resume`,
      );
      return this.deps.keyboardInput.processKey(recoveryChoice);
    }

    if (this.deps.recovery.shouldAutoConfirmCheckpointCleanup(question)) {
      // Unsupported wasm builds cannot recover checkpoint shards into a proper
      // save file. For those builds, auto-confirm stale cleanup during
      // fresh-game startup instead of surfacing an unusable prompt.
      this.deps.coordinator.logRoutine(
        'Auto-confirming stale checkpoint cleanup with "y" during fresh-game startup',
      );
      return this.deps.keyboardInput.processKey("y");
    }

    if (this.deps.menuSelection.isContainerLootTypeQuestion(question)) {
      this.deps.coordinator.logRoutine('Auto-answering container loot type question with "a"');
      return this.deps.keyboardInput.processKey("a");
    }

    const legacyAutoHelpYnPromptAnswer =
      this.resolveLegacyAutoHelpYnPromptAnswer(question, normalizedChoices);
    if (legacyAutoHelpYnPromptAnswer) {
      return this.deps.keyboardInput.processKey(legacyAutoHelpYnPromptAnswer);
    }

    const contextualLookInfoAutoAnswer =
      this.deps.contextualLook.resolveContextualLookInfoAutoAnswer(
        question,
        normalizedChoices,
        defaultChoice,
      );
    if (contextualLookInfoAutoAnswer) {
      if (contextualLookInfoAutoAnswer === "y" && this.isLegacySlashEmCursorPromptQuestion(question, normalizedChoices, defaultChoice)) {
        // Auto-confirming bypasses the ordinary legacy cursor-prompt arm.
        // Arm before getpos emits its first cliparound, just like the map menu.
        this.deps.positionInput.farLookMode = "armed";
        this.deps.positionInput.farLookOrigin = "legacy_cursor_prompt";
        this.deps.positionInput.pendingLegacySlashEmCursorPromptFarLook = false;
      }
      return this.deps.keyboardInput.processKey(contextualLookInfoAutoAnswer);
    }

    this.deps.positionInput.pendingLegacySlashEmCursorPromptFarLook =
      this.isLegacySlashEmCursorPromptQuestion(
        question,
        normalizedChoices,
        defaultChoice,
      );
    if (this.deps.positionInput.pendingLegacySlashEmCursorPromptFarLook) {
      this.deps.coordinator.logRoutine(
        "Tracking legacy Slash'EM cursor yn prompt for far-look activation",
      );
    }

    if (question && question.toLowerCase().includes("direction")) {
      this.activeYnPrompt = {
        choices: normalizedChoices,
        defaultChoice: normalizedDefaultChoice,
      };
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "direction_question",
          text: question,
          choices: choices,
          default: defaultChoice,
        });
      }
      const requested = this.deps.inputRequests.waitForQuestionInput();
      if (requested && typeof requested.then === "function") {
        return requested.finally(() => {
          this.activeYnPrompt = null;
        });
      }
      this.activeYnPrompt = null;
      return requested;
    }

    this.activeYnPrompt = {
      choices: normalizedChoices,
      defaultChoice: normalizedDefaultChoice,
    };
    const legacySlashEmInventoryPromptMenuItems =
      this.buildLegacySlashEmInventoryQuestionMenuItems(
        question,
        normalizedChoices,
      );
    if (legacySlashEmInventoryPromptMenuItems.length > 0) {
      this.deps.coordinator.logRoutine(
        `Routing legacy Slash'EM inventory yn prompt through menu dialog (${legacySlashEmInventoryPromptMenuItems.length} items)`,
        {
          question: String(question || ""),
          choices: `${normalizedChoices} ${this.getQuestionBracketChoiceSpec(question)}`.trim(),
        },
      );
    }
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "question",
        text: question,
        choices: choices,
        default: defaultChoice,
        menuItems: legacySlashEmInventoryPromptMenuItems,
      });
    }

    const requested = this.deps.inputRequests.waitForQuestionInput();
    if (requested && typeof requested.then === "function") {
      return requested.finally(() => {
        this.activeYnPrompt = null;
      });
    }
    this.activeYnPrompt = null;
    return requested;
  }

  resolveEscapeForActiveYnPrompt() {
    const prompt = this.activeYnPrompt;
    if (!prompt || typeof prompt !== "object") {
      return null;
    }

    const choices =
      typeof prompt.choices === "string" ? prompt.choices : String(prompt.choices ?? "");
    if (!choices) {
      return null;
    }
    const choicesLower = choices.toLowerCase();

    const defaultCode =
      typeof prompt.defaultChoice === "number" &&
        Number.isFinite(prompt.defaultChoice)
        ? Math.trunc(prompt.defaultChoice)
        : 0;
    const defaultChar =
      defaultCode > 0 && defaultCode <= 255
        ? String.fromCharCode(defaultCode).toLowerCase()
        : "";
    if (defaultChar && choicesLower.includes(defaultChar)) {
      return defaultChar;
    }
    if (choicesLower.includes("n")) {
      return "n";
    }
    if (choicesLower.includes("q")) {
      return "q";
    }
    return null;
  }
}
