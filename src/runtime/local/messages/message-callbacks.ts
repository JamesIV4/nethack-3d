// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeWindows } from "./windows";
import type { RuntimeWindowText } from "./window-text";
import type { RuntimePromptContext } from "./prompt-context";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeContextualLook } from "../input/contextual-look";
import type { RuntimeGameOver } from "../lifecycle/game-over";
import type { RuntimePositionInput } from "../input/position-selection";
import type { RuntimePostActionRefresh } from "../world/post-action-refresh";
import type { RuntimeCheckpointRecovery } from "../persistence/checkpoint-recovery";
import type { RuntimeTextInput } from "../input/text-input";

export interface RuntimeMessagesDependencies {
  readonly contextualLook: Pick<
    RuntimeContextualLook,
    "isContextualInfoQuiet"
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
    "captureGameOverSummaryFromLines"
    | "emitGameOverComplete"
    | "gameOverEmptyRawPrintCount"
    | "gameOverSequenceActive"
    | "lastGameOverHow"
    | "lastGameOverWhen"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "armPendingTravelPositionInput"
  >;
  readonly postActionRefresh: Pick<
    RuntimePostActionRefresh,
    "armPendingPostActionPlayerTileRefreshForAutopickupRawPrint"
  >;
  readonly promptContext: Pick<
    RuntimePromptContext,
    "normalizePromptContextMessage"
    | "rememberPromptContextMessage"
  >;
  readonly recovery: Pick<
    RuntimeCheckpointRecovery,
    "didAutoQueueRawRecoverChoice"
    | "isAutosaveResumeRequested"
  >;
  readonly textInput: Pick<
    RuntimeTextInput,
    "queueStdinTextInput"
  >;
  readonly windows: Pick<
    RuntimeWindows,
    "getRuntimeWindowId"
    | "isMessageWindow"
    | "shouldSuppressRedundantStatusWindowText"
  >;
  readonly windowText: Pick<
    RuntimeWindowText,
    "appendWindowTextBuffer"
    | "getRecallableMessageHistoryLines"
    | "messageHistorySnapshot"
    | "messageHistorySnapshotIndex"
    | "shouldCaptureWindowTextForDialog"
  >;
}

/** Text and raw-print callbacks, message history and game-over text routing. */
export class RuntimeMessages {
  declare gameMessages: any[];

  constructor(private readonly deps: RuntimeMessagesDependencies) {
    this.gameMessages = [];
  }

  handleShimPutstr(args) {
    const [win, textAttr, textStr] = args;
    this.deps.coordinator.logRoutine(`💬 TEXT [Win ${win}]: "${textStr}"`);
    if (this.deps.windows.shouldSuppressRedundantStatusWindowText(win)) {
      return 0;
    }
    this.deps.windowText.appendWindowTextBuffer(win, textStr);
    if (this.deps.windows.isMessageWindow(win)) {
      this.deps.promptContext.rememberPromptContextMessage(textStr, "message_window");
      if (this.deps.contextualLook.isContextualInfoQuiet() && !this.deps.gameOver.gameOverSequenceActive) return 0;
    }

    if (!this.deps.windowText.shouldCaptureWindowTextForDialog(win)) {
      this.gameMessages.push({
        text: textStr,
        window: win,
        timestamp: Date.now(),
        attr: textAttr,
      });
      if (this.gameMessages.length > 100) {
        this.gameMessages.shift();
      }
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "text",
          text: textStr,
          window: win,
          attr: textAttr,
        });
      }
    }
    return 0;
  }

  handleShimRawPrint(args) {
    const [rawText] = args;
    const suppressContextualInfo = this.deps.contextualLook.isContextualInfoQuiet() && !this.deps.gameOver.gameOverSequenceActive;
    if (!suppressContextualInfo) {
      this.deps.coordinator.logRoutine(`📢 RAW PRINT: "${rawText}"`);
    }
    const normalizedRawText = this.deps.promptContext.normalizePromptContextMessage(rawText);
    if (normalizedRawText) {
      this.deps.gameOver.captureGameOverSummaryFromLines(
        [normalizedRawText],
        "raw_print",
      );
    }
    if (!normalizedRawText && this.deps.gameOver.gameOverSequenceActive) {
      this.deps.gameOver.gameOverEmptyRawPrintCount += 1;
      this.deps.coordinator.logRoutine(
        `Game-over empty raw_print (${this.deps.gameOver.gameOverEmptyRawPrintCount}/3)`,
      );
      if (this.deps.gameOver.gameOverEmptyRawPrintCount >= 3) {
        this.deps.gameOver.emitGameOverComplete(
          this.deps.gameOver.lastGameOverHow,
          this.deps.gameOver.lastGameOverWhen,
        );
      }
      return 0;
    }
    if (this.deps.gameOver.gameOverSequenceActive) {
      this.deps.gameOver.gameOverEmptyRawPrintCount = 0;
    }
    if (normalizedRawText) {
      this.deps.promptContext.rememberPromptContextMessage(normalizedRawText, "raw_print");
      this.deps.positionInput.armPendingTravelPositionInput(normalizedRawText);
      this.deps.postActionRefresh.armPendingPostActionPlayerTileRefreshForAutopickupRawPrint(
        normalizedRawText,
      );
    }
    if (
      normalizedRawText &&
      this.deps.coordinator.runtimeVersion === "5.0" &&
      this.deps.recovery.isAutosaveResumeRequested() &&
      !this.deps.recovery.didAutoQueueRawRecoverChoice
    ) {
      const loweredRawText = normalizedRawText.toLowerCase();
      const isRawRecoverPrompt =
        (loweredRawText.includes(
          "there is already a game in progress under your name",
        ) ||
          loweredRawText.includes(
            "there are files from a game in progress under your name",
          )) &&
        loweredRawText.includes("do what");
      if (isRawRecoverPrompt) {
        this.deps.textInput.queueStdinTextInput("r", "autosave raw recover prompt");
        this.deps.recovery.didAutoQueueRawRecoverChoice = true;
        this.deps.coordinator.logRoutine(
          'Auto-queued "r" for raw startup recovery prompt during autosave resume',
        );
      }
    }

    // Send raw print messages to the UI log
    if (
      this.deps.coordinator.eventHandler &&
      normalizedRawText &&
      !suppressContextualInfo
    ) {
      this.deps.coordinator.emit({
        type: "raw_print",
        text: normalizedRawText,
      });
    }
    return 0;
  }

  handleShimRawPrintBold(args) {
    const [rawBoldText] = args;
    this.deps.coordinator.logRoutine(`RAW PRINT BOLD: "${rawBoldText}"`);
    const normalizedRawBoldText =
      this.deps.promptContext.normalizePromptContextMessage(rawBoldText);
    if (normalizedRawBoldText) {
      this.deps.gameOver.captureGameOverSummaryFromLines(
        [normalizedRawBoldText],
        "raw_print_bold",
      );
    }
    if (normalizedRawBoldText) {
      this.deps.promptContext.rememberPromptContextMessage(
        normalizedRawBoldText,
        "raw_print_bold",
      );
    }
    if (this.deps.coordinator.eventHandler && normalizedRawBoldText &&
        (!this.deps.contextualLook.isContextualInfoQuiet() || this.deps.gameOver.gameOverSequenceActive)) {
      this.deps.coordinator.emit({
        type: "raw_print",
        text: normalizedRawBoldText,
        bold: true,
      });
    }
    return 0;
  }

  handleShimMessageMenu(args) {
    const [menuLet, menuHow, menuMessage] = args;
    this.deps.coordinator.logRoutine(
      `NetHack message_menu: let=${menuLet}, how=${menuHow}, message="${menuMessage}"`,
    );
    if (this.deps.coordinator.eventHandler && menuMessage && String(menuMessage).trim()) {
      this.deps.promptContext.rememberPromptContextMessage(String(menuMessage), "message_menu");
      if (this.deps.contextualLook.isContextualInfoQuiet() && !this.deps.gameOver.gameOverSequenceActive) return 0;
      this.deps.coordinator.emit({
        type: "text",
        text: String(menuMessage),
        window: this.deps.windows.getRuntimeWindowId("WIN_MESSAGE"),
        attr: 0,
        source: "message_menu",
      });
    }
    // force_invmenu keeps this path rare; default to "no choice".
    return 0;
  }

  handleShimGetmsghistory(args) {
    const [init] = args;
    this.deps.coordinator.logRoutine(`Getting message history, init: ${init}`);
    if (init) {
      this.deps.windowText.messageHistorySnapshot = [];
      this.deps.windowText.messageHistorySnapshotIndex = 0;
    }
    // Keep this callback non-invasive. The runtime helper's "s" return
    // marshalling expects a writable destination, so we must return empty.
    return "";
  }

  handleShimPutmsghistory(args) {
    const [msg, is_restoring] = args;
    this.deps.coordinator.logRoutine(
      `Putting message history: "${msg}", restoring: ${is_restoring}`,
    );
    if (typeof msg === "string" && msg.trim()) {
      const text = msg.replace(/\u0000/g, "").trim();
      if (text) {
        this.deps.promptContext.rememberPromptContextMessage(text, "putmsghistory");
        this.gameMessages.push({
          text,
          window: this.deps.windows.getRuntimeWindowId("WIN_MESSAGE"),
          timestamp: Date.now(),
          attr: 0,
        });
        if (this.gameMessages.length > 100) {
          this.gameMessages.shift();
        }
      }
    } else if (is_restoring) {
      // End-of-restore marker from NetHack; reset any active snapshot iteration.
      this.deps.windowText.messageHistorySnapshot = [];
      this.deps.windowText.messageHistorySnapshotIndex = 0;
    }
    return 0;
  }

  handleShimDoprevMessage() {
    this.deps.coordinator.logRoutine("Handling previous-message request");
    if (this.deps.coordinator.eventHandler) {
      const historyLines = this.deps.windowText.getRecallableMessageHistoryLines();
      if (historyLines.length > 0) {
        this.deps.coordinator.logRoutine(
          `Emitting info_menu for previous-message request (${historyLines.length} lines)`,
        );
        this.deps.coordinator.emit({
          type: "info_menu",
          title: "Message History",
          lines: historyLines,
          source: "doprev_message",
        });
      }
    }
    return 0;
  }
}
