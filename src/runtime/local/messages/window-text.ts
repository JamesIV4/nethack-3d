// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import { getBundledDisplayFile } from "../../displayFileCatalog";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeWindows } from "./windows";
import type { RuntimePromptContext } from "./prompt-context";
import type { RuntimeMessages } from "./message-callbacks";
import type { RuntimeGameOver } from "../lifecycle/game-over";
import type { RuntimeInputRequests } from "../input/input-requests";

export interface RuntimeWindowTextDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
  >;
  readonly gameOver: Pick<
    RuntimeGameOver,
    "captureGameOverSummaryFromLines"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "waitForQuestionInput"
  >;
  readonly messages: Pick<
    RuntimeMessages,
    "gameMessages"
  >;
  readonly promptContext: Pick<
    RuntimePromptContext,
    "rememberPromptContextMessage"
  >;
  readonly windows: Pick<
    RuntimeWindows,
    "isMapWindow"
    | "isMessageWindow"
    | "shouldSuppressRedundantStatusWindowText"
  >;
}

/** Window text buffering, display-file dialogs and recallable message history. */
export class RuntimeWindowText {
  declare windowTextBuffers: Map<any, any>;
  declare messageHistorySnapshot: any[];
  declare messageHistorySnapshotIndex: number;

  constructor(private readonly deps: RuntimeWindowTextDependencies) {
    this.windowTextBuffers = new Map();
    this.messageHistorySnapshot = [];
    this.messageHistorySnapshotIndex = 0;
  }

  shouldCaptureWindowTextForDialog(winId) {
    return winId === 4 || winId === 5 || winId === 6;
  }

  handleShimDisplayFile(args) {
    const [rawName, complain] = Array.isArray(args) ? args : [];
    const fileName =
      typeof rawName === "string"
        ? rawName.trim()
        : String(rawName ?? "").trim();
    const mustExist = Boolean(complain);
    console.log(
      `DISPLAY FILE request: "${fileName || "<empty>"}" (mustExist=${mustExist})`,
    );

    const bundled = getBundledDisplayFile(fileName);
    if (bundled && bundled.lines.length > 0) {
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "info_menu",
          title: bundled.title,
          lines: bundled.lines,
          source: "display_file",
          file: bundled.canonicalName,
          mustExist,
        });
      }
      return 0;
    }

    if (!mustExist && fileName.toLowerCase() === "news") {
      console.log(
        'DISPLAY FILE optional startup "news" file is not bundled; continuing without it.',
      );
      return 0;
    }

    const fallbackMessage = fileName
      ? `No bundled help text available for "${fileName}".`
      : "No help file name was provided.";
    console.warn(`DISPLAY FILE unavailable: ${fallbackMessage}`);
    if (mustExist && this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "text",
        text: fallbackMessage,
        window: 5,
        attr: 0,
        source: "display_file",
      });
    }
    return 0;
  }

  shouldLogWindowTextInsteadOfDialog(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
      return false;
    }
    const normalizedNonEmptyLines = lines
      .map((line) =>
        String(line || "")
          .trim()
          .toLowerCase(),
      )
      .filter((line) => line.length > 0);
    if (normalizedNonEmptyLines.length === 0) {
      return false;
    }
    const firstNonEmptyLine = normalizedNonEmptyLines[0];
    if (firstNonEmptyLine.startsWith("things that are here:")) {
      return true;
    }
    if (!firstNonEmptyLine.startsWith("there is a doorway here.")) {
      return false;
    }
    return normalizedNonEmptyLines.some((line) =>
      line.startsWith("things that are here:"),
    );
  }

  emitWindowTextLinesToLog(lines, winId, source = "display_nhwindow") {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    for (const rawLine of normalizedLines) {
      const text = String(rawLine || "").replace(/\u0000/g, "");
      if (!text.trim()) {
        continue;
      }
      if (this.deps.windows.shouldSuppressRedundantStatusWindowText(winId)) {
        continue;
      }
      if (this.deps.windows.isMessageWindow(winId)) {
        this.deps.promptContext.rememberPromptContextMessage(text, "message_window");
      }
      this.deps.messages.gameMessages.push({
        text: text,
        window: winId,
        timestamp: Date.now(),
        attr: 0,
      });
      if (this.deps.messages.gameMessages.length > 100) {
        this.deps.messages.gameMessages.shift();
      }
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "text",
          text: text,
          window: winId,
          attr: 0,
          source: source,
        });
      }
    }
  }

  resetWindowTextBuffer(winId) {
    if (!Number.isInteger(winId)) {
      return;
    }
    this.windowTextBuffers.set(winId, []);
  }

  appendWindowTextBuffer(winId, text) {
    if (!Number.isInteger(winId)) {
      return;
    }
    const normalized = typeof text === "string" ? text : String(text ?? "");
    const existing = this.windowTextBuffers.get(winId);
    if (Array.isArray(existing)) {
      existing.push(normalized);
      return;
    }
    this.windowTextBuffers.set(winId, [normalized]);
  }

  consumeWindowTextBuffer(winId) {
    if (!Number.isInteger(winId)) {
      return [];
    }
    const existing = this.windowTextBuffers.get(winId);
    this.windowTextBuffers.set(winId, []);
    if (!Array.isArray(existing)) {
      return [];
    }
    return existing;
  }

  getWindowTextDialogTitle(winId) {
    if (winId === 4) {
      return "NetHack Message";
    }
    if (winId === 5) {
      return "NetHack Message";
    }
    if (winId === 6) {
      return "NetHack Information";
    }
    return "NetHack Information";
  }

  getRecallableMessageHistoryLines(maxLines = 200) {
    const normalizedMax = Number.isFinite(maxLines)
      ? Math.max(1, Math.trunc(maxLines))
      : 200;
    const lines = [];
    for (const entry of this.deps.messages.gameMessages) {
      if (!entry || typeof entry.text !== "string") {
        continue;
      }
      const text = entry.text.replace(/\u0000/g, "");
      if (!text) {
        continue;
      }
      const win = Number(entry.window);
      // Recall should mirror the top-line message stream (WIN_MESSAGE).
      if (!this.deps.windows.isMessageWindow(win)) {
        continue;
      }
      lines.push(text);
    }
    if (lines.length <= normalizedMax) {
      return lines;
    }
    return lines.slice(lines.length - normalizedMax);
  }

  handleShimCreateNhwindow(args) {
    const [windowType] = args;
    this.resetWindowTextBuffer(windowType);
    console.log(
      `Creating window [ ${windowType} ] returning ${windowType}`,
    );
    return windowType;
  }

  handleShimDisplayNhwindow(args) {
    const [winid, blocking] = args;
    console.log(`DISPLAY WINDOW [Win ${winid}], blocking: ${blocking}`);
    const displayLines = this.consumeWindowTextBuffer(winid);
    const hasDisplayText = displayLines.some(
      (line) => String(line || "").trim().length > 0,
    );
    let didEmitInfoDialog = false;
    if (hasDisplayText && this.shouldCaptureWindowTextForDialog(winid)) {
      const normalizedLines = displayLines.map((line) =>
        String(line || "").replace(/\u0000/g, ""),
      );
      this.deps.gameOver.captureGameOverSummaryFromLines(
        normalizedLines,
        "display_nhwindow",
      );
      if (this.shouldLogWindowTextInsteadOfDialog(normalizedLines)) {
        console.log(
          `Routing window ${winid} text to message log (${normalizedLines.length} lines)`,
        );
        this.emitWindowTextLinesToLog(normalizedLines, winid);
        return 0;
      }
      if (!this.deps.coordinator.eventHandler) {
        return 0;
      }
      console.log(
        `Emitting info dialog for window ${winid} with ${normalizedLines.length} lines`,
      );
      this.deps.coordinator.emit({
        type: "info_menu",
        title: this.getWindowTextDialogTitle(winid),
        lines: normalizedLines,
        window: winid,
        blocking: blocking,
        source: "display_nhwindow",
      });
      didEmitInfoDialog = true;
    }
    if (blocking && didEmitInfoDialog) {
      return this.deps.inputRequests.waitForQuestionInput();
    }
    return 0;
  }

  handleShimClearNhwindow(args) {
    const [clearWinId] = args;
    console.log(`🗑️ Clearing window ${clearWinId}`);
    this.resetWindowTextBuffer(clearWinId);

    // If clearing the map window, clear the 3D scene
    if (this.deps.windows.isMapWindow(clearWinId)) {
      console.log("Map window cleared - clearing 3D scene");
      this.deps.coordinator.emit({
        type: "clear_scene",
        // message: "Level transition - clearing display",
      });
    }
    return 0;
  }

  handleShimDestroyNhwindow(args) {
    const [destroyWinId] = args;
    console.log(`🗑️ Destroying window ${destroyWinId}`);
    this.resetWindowTextBuffer(destroyWinId);
    return 0;
  }
}
