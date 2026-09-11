// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimePositionInput } from "../input/position-selection";
import type { RuntimeMessages } from "./message-callbacks";
import type { RuntimeWindows } from "./windows";

export interface RuntimePromptContextDependencies {
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "currentMenuQuestionText"
  >;
  readonly messages: Pick<
    RuntimeMessages,
    "gameMessages"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "isFarLookPositionRequest"
    | "positionInputActive"
  >;
  readonly windows: Pick<
    RuntimeWindows,
    "isMessageWindow"
  >;
}

/** Prompt and callback histories used to attach the correct preceding message to text questions. */
export class RuntimePromptContext {
  declare lastPromptContextMessage: string;
  declare lastPromptContextEntry: any;
  declare promptContextHistory: any[];
  declare recentUICallbackHistory: any[];

  constructor(private readonly deps: RuntimePromptContextDependencies) {
    this.lastPromptContextMessage = "";
    this.lastPromptContextEntry = null;
    this.promptContextHistory = [];
    this.recentUICallbackHistory = [];
  }

  normalizePromptContextMessage(text) {
    if (typeof text !== "string") {
      return "";
    }
    return text.replace(/\u0000/g, "").trim();
  }

  normalizePromptContextSource(source) {
    const normalized =
      typeof source === "string" ? source.trim().toLowerCase() : "";
    return normalized || "unknown";
  }

  isCurrentMenuQuestionText(text) {
    const normalized = this.normalizePromptContextMessage(text).toLowerCase();
    if (!normalized) {
      return false;
    }
    const currentMenuQuestion = this.normalizePromptContextMessage(
      this.deps.menuSelection.currentMenuQuestionText,
    ).toLowerCase();
    return Boolean(currentMenuQuestion) && normalized === currentMenuQuestion;
  }

  derivePromptContextSource(text, source = "unknown") {
    const normalizedSource = this.normalizePromptContextSource(source);
    if (this.isCurrentMenuQuestionText(text)) {
      return "menu_question_echo";
    }
    return normalizedSource;
  }

  isMenuRelatedPromptContextSource(source) {
    const normalizedSource = this.normalizePromptContextSource(source);
    return (
      normalizedSource === "menu_question" ||
      normalizedSource === "menu_question_echo" ||
      normalizedSource === "inventory_menu_question"
    );
  }

  rememberPromptContextMessage(text, source = "unknown") {
    const normalized = this.normalizePromptContextMessage(text);
    if (!normalized) {
      return;
    }
    const resolvedSource = this.derivePromptContextSource(normalized, source);
    const entry = {
      text: normalized,
      source: resolvedSource,
      timestamp: Date.now(),
    };
    this.lastPromptContextMessage = normalized;
    this.lastPromptContextEntry = entry;
    this.promptContextHistory.push(entry);
    if (this.promptContextHistory.length > 120) {
      this.promptContextHistory.shift();
    }
  }

  isRawPrintCallbackName(name) {
    return name === "shim_raw_print" || name === "shim_raw_print_bold";
  }

  isPlayerMovementCallbackName(name) {
    if (name !== "shim_cliparound") {
      return false;
    }
    return !this.deps.positionInput.positionInputActive && !this.deps.positionInput.isFarLookPositionRequest();
  }

  recordRecentUICallback(name, args) {
    const entry = {
      name: typeof name === "string" ? name : String(name ?? ""),
      text: "",
      isPlayerMovement: false,
    };
    if (this.isRawPrintCallbackName(entry.name) && Array.isArray(args)) {
      entry.text = this.normalizePromptContextMessage(args[0]);
    }
    entry.isPlayerMovement = this.isPlayerMovementCallbackName(entry.name);
    this.recentUICallbackHistory.push(entry);
    if (this.recentUICallbackHistory.length > 80) {
      this.recentUICallbackHistory.shift();
    }
  }

  getRecentRawPrintContextMessage() {
    if (!Array.isArray(this.recentUICallbackHistory)) {
      return "";
    }

    let latestRawPrintIndex = -1;
    for (
      let index = this.recentUICallbackHistory.length - 1;
      index >= 0;
      index -= 1
    ) {
      const entry = this.recentUICallbackHistory[index];
      if (!entry || entry.name === "shim_getlin") {
        continue;
      }
      if (entry.isPlayerMovement) {
        break;
      }
      if (this.isRawPrintCallbackName(entry.name) && entry.text) {
        latestRawPrintIndex = index;
        break;
      }
    }

    if (latestRawPrintIndex < 0) {
      return "";
    }

    const collectedLines = [];
    for (let index = latestRawPrintIndex; index >= 0; index -= 1) {
      const entry = this.recentUICallbackHistory[index];
      if (!entry || entry.isPlayerMovement) {
        break;
      }
      if (!this.isRawPrintCallbackName(entry.name)) {
        break;
      }
      if (entry.text) {
        collectedLines.unshift(entry.text);
      }
    }

    return collectedLines.join("\n");
  }

  getMostRecentToplineMessage() {
    for (
      let index = this.promptContextHistory.length - 1;
      index >= 0;
      index -= 1
    ) {
      const entry = this.promptContextHistory[index];
      if (!entry) {
        continue;
      }
      const text = this.normalizePromptContextMessage(entry.text);
      if (!text) {
        continue;
      }
      if (this.isMenuRelatedPromptContextSource(entry.source)) {
        continue;
      }
      return text;
    }

    const latestRemembered = this.normalizePromptContextMessage(
      this.lastPromptContextMessage,
    );
    if (latestRemembered && !this.isCurrentMenuQuestionText(latestRemembered)) {
      return latestRemembered;
    }

    for (let index = this.deps.messages.gameMessages.length - 1; index >= 0; index -= 1) {
      const entry = this.deps.messages.gameMessages[index];
      if (!entry || !this.deps.windows.isMessageWindow(entry.window)) {
        continue;
      }
      const text = this.normalizePromptContextMessage(entry.text);
      if (text && !this.isCurrentMenuQuestionText(text)) {
        return text;
      }
    }

    return "";
  }

  shouldAppendPreviousMessageToGetlinPrompt(question) {
    return /^call\b/i.test(String(question || "").trim());
  }

  getGetlinPromptContextMessage(question) {
    if (!this.shouldAppendPreviousMessageToGetlinPrompt(question)) {
      return "";
    }

    const context =
      this.getRecentRawPrintContextMessage() ||
      this.getMostRecentToplineMessage();
    if (!context) {
      return "";
    }
    if (this.isCurrentMenuQuestionText(context)) {
      return "";
    }

    const normalizedQuestion = this.normalizePromptContextMessage(
      String(question || ""),
    );
    if (
      normalizedQuestion &&
      context.toLowerCase() === normalizedQuestion.toLowerCase()
    ) {
      return "";
    }

    return context;
  }
}
