// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimePromptContext } from "../messages/prompt-context";
import type { RuntimeStartupConfiguration } from "../startup/startup-configuration";
import type { RuntimeCheckpoints } from "../persistence/checkpoint-files";
import type { RuntimeWindowText } from "../messages/window-text";

export interface RuntimeGameOverDependencies {
  readonly checkpoints: Pick<
    RuntimeCheckpoints,
    "cleanupAndFlushCheckpointShardsAfterGameOver"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "emitRuntimeTerminated"
    | "eventHandler"
    | "runtimeTerminationEmitted"
    | "startupOptions"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "normalizeRuntimeInteger"
    | "readGlobalValue"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "normalizeQuestionText"
  >;
  readonly promptContext: Pick<
    RuntimePromptContext,
    "getMostRecentToplineMessage"
    | "getRecentRawPrintContextMessage"
    | "normalizePromptContextMessage"
    | "rememberPromptContextMessage"
  >;
  readonly startupOptions: Pick<
    RuntimeStartupConfiguration,
    "normalizeCharacterNameValue"
  >;
  readonly windowText: Pick<
    RuntimeWindowText,
    "appendWindowTextBuffer"
    | "resetWindowTextBuffer"
  >;
}

/** Game-over progression, death/gold summary capture and tombstone formatting. */
export class RuntimeGameOver {
  declare pendingGameOverPossessionsInventoryFlow: boolean;
  declare gameOverSequenceActive: boolean;
  declare gameOverEmptyRawPrintCount: number;
  declare lastGameOverHow: any;
  declare lastGameOverWhen: any;
  declare lastGameOverDeathSummary: string;
  declare lastKnownPlayerName: string;
  declare lastKnownGold: any;

  constructor(private readonly deps: RuntimeGameOverDependencies) {
    this.pendingGameOverPossessionsInventoryFlow = false;
    this.gameOverSequenceActive = false;
    this.gameOverEmptyRawPrintCount = 0;
    this.lastGameOverHow = null;
    this.lastGameOverWhen = null;
    this.lastGameOverDeathSummary = "";
    this.lastKnownPlayerName = "";
    this.lastKnownGold = null;
  }

  isGameOverPossessionsIdentifyQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes("do you want your possessions identified") ||
      normalized.startsWith("do you want to see what you had when you ")
    );
  }

  beginGameOverSequence(source = "unknown") {
    if (this.gameOverSequenceActive) {
      return;
    }
    this.gameOverSequenceActive = true;
    this.gameOverEmptyRawPrintCount = 0;
    this.lastGameOverDeathSummary = "";
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "game_over_started",
        source,
      });
    }
    console.log(`Game-over sequence armed (${source}).`);
  }

  resetGameOverSequence(reason = "reset") {
    if (!this.gameOverSequenceActive) {
      return;
    }
    this.gameOverSequenceActive = false;
    this.gameOverEmptyRawPrintCount = 0;
    this.lastGameOverDeathSummary = "";
    console.log(`Game-over sequence reset (${reason}).`);
  }

  recordLastKnownGold(fieldName, value) {
    if (fieldName !== "BL_GOLD") {
      return;
    }
    const parsed = this.deps.memory.normalizeRuntimeInteger(value);
    if (parsed === null) {
      return;
    }
    this.lastKnownGold = parsed;
  }

  extractGameOverDeathSummary(line) {
    const normalized = this.deps.promptContext.normalizePromptContextMessage(line);
    if (!normalized) {
      return "";
    }
    const lower = normalized.toLowerCase();
    const patterns = [
      "killed by ",
      "choked on ",
      "poisoned by ",
      "died of ",
      "drowned in ",
      "burned by ",
      "dissolved in ",
      "crushed to death by ",
      "petrified by ",
      "turned to slime by ",
    ];
    for (const pattern of patterns) {
      const index = lower.indexOf(pattern);
      if (index >= 0) {
        const summary = normalized
          .slice(index)
          .replace(/[.!]+$/g, "")
          .trim();
        return summary;
      }
    }
    return "";
  }

  captureGameOverSummaryFromLines(lines, source = "unknown") {
    if (!this.gameOverSequenceActive || !Array.isArray(lines)) {
      return;
    }
    for (const line of lines) {
      const summary = this.extractGameOverDeathSummary(line);
      if (summary) {
        this.lastGameOverDeathSummary = summary;
        console.log(`Captured game-over death summary (${source}): ${summary}`);
        return;
      }
    }
  }

  resolveGameOverDeathText() {
    const summary = this.deps.promptContext.normalizePromptContextMessage(
      this.lastGameOverDeathSummary,
    );
    if (summary) {
      return summary;
    }
    const rawContext = this.deps.promptContext.getRecentRawPrintContextMessage();
    if (rawContext) {
      return rawContext;
    }
    const topline = this.deps.promptContext.getMostRecentToplineMessage();
    if (topline) {
      return topline;
    }
    return "";
  }

  buildTombstoneLines(how, when) {
    const normalizeLine = (value, width) => {
      const raw = String(value ?? "")
        .replace(/\u0000/g, "")
        .trim();
      if (!raw) {
        return "";
      }
      const trimmed = raw.slice(0, width);
      const leftPad = Math.floor((width - trimmed.length) / 2);
      const rightPad = Math.max(0, width - trimmed.length - leftPad);
      return `${" ".repeat(leftPad)}${trimmed}${" ".repeat(rightPad)}`;
    };

    const applyCenteredLine = (line, content) => {
      const start = line.indexOf("|");
      const end = line.lastIndexOf("|");
      if (start < 0 || end <= start + 1) {
        return line;
      }
      const width = end - start - 1;
      if (width <= 0) {
        return line;
      }
      const payload = normalizeLine(content, width);
      if (!payload) {
        return line;
      }
      return `${line.slice(0, start + 1)}${payload}${line.slice(end)}`;
    };

    const wrapStoneLines = (text, maxLines) => {
      const width = 16;
      const normalized = String(text ?? "")
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalized) {
        return [];
      }
      const words = normalized.split(" ");
      const lines = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= width) {
          current = candidate;
          continue;
        }
        if (current) {
          lines.push(current);
          current = word;
        } else {
          lines.push(word.slice(0, width));
          current = word.slice(width);
        }
        if (lines.length >= maxLines) {
          return lines.slice(0, maxLines);
        }
      }
      if (current) {
        lines.push(current);
      }
      return lines.slice(0, maxLines);
    };

    const withIndefiniteArticle = (value) => {
      const trimmed = String(value ?? "").trim();
      if (!trimmed) {
        return "";
      }
      const firstChar = trimmed[0]?.toLowerCase() ?? "";
      const article =
        firstChar === "a" ||
          firstChar === "e" ||
          firstChar === "i" ||
          firstChar === "o" ||
          firstChar === "u"
          ? "an"
          : "a";
      return `${article} ${trimmed}`;
    };

    const resolvedHow = Number.isFinite(how)
      ? Math.trunc(how)
      : Number.isFinite(this.lastGameOverHow)
        ? Math.trunc(this.lastGameOverHow)
        : 0;
    const resolvedWhen = Number.isFinite(when)
      ? Math.trunc(when)
      : Number.isFinite(this.lastGameOverWhen)
        ? Math.trunc(this.lastGameOverWhen)
        : Math.floor(Date.now() / 1000);

    const playerName =
      this.deps.startupOptions.normalizeCharacterNameValue(
        this.deps.coordinator.startupOptions?.characterCreation?.name,
      ) ||
      this.lastKnownPlayerName ||
      String(this.deps.memory.readGlobalValue(["plname"]) || "").trim() ||
      "Player";
    const doneMoney = Number(this.deps.memory.readGlobalValue(["done_money"]));
    const fallbackMoney =
      typeof this.lastKnownGold === "number" &&
        Number.isFinite(this.lastKnownGold)
        ? this.lastKnownGold
        : NaN;
    const goldText = Number.isFinite(doneMoney)
      ? `${Math.max(0, Math.trunc(doneMoney))} Au`
      : Number.isFinite(fallbackMoney)
        ? `${Math.max(0, Math.trunc(fallbackMoney))} Au`
        : "";

    const killerName = String(this.deps.memory.readGlobalValue(["killer", "name"]) || "")
      .replace(/\u0000/g, "")
      .trim();
    const killerFormat = Number(this.deps.memory.readGlobalValue(["killer", "format"]));
    const killedByPrefix = [
      "killed by ",
      "choked on ",
      "poisoned by ",
      "died of ",
      "drowned in ",
      "burned by ",
      "dissolved in ",
      "crushed to death by ",
      "petrified by ",
      "turned to slime by ",
      "killed by ",
      "",
      "",
      "",
      "",
      "",
    ];
    const prefix = killedByPrefix[resolvedHow] ?? "";
    const deathTextBase = killerName
      ? killerFormat === 2
        ? killerName
        : killerFormat === 0
          ? `${prefix}${withIndefiniteArticle(killerName)}`
          : `${prefix}${killerName}`
      : "";
    const deathText = deathTextBase || this.resolveGameOverDeathText() || "";

    const year =
      new Date(resolvedWhen * 1000).getFullYear() || new Date().getFullYear();

    const tombstoneText = [
      "               ----------",
      "              /          \\",
      "             /    REST    \\",
      "            /      IN      \\",
      "           /     PEACE      \\",
      "          /                  \\",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |       1001       |",
      "         *|     *  *  *      | *",
      "_________)/\\\\_//(\\/(/\\)/\\//\\/|_)_______",
    ];

    const nameLineIndex = 6;
    const goldLineIndex = 7;
    const deathLineStartIndex = 8;
    const yearLineIndex = 12;

    tombstoneText[nameLineIndex] = applyCenteredLine(
      tombstoneText[nameLineIndex],
      playerName,
    );
    if (goldText) {
      tombstoneText[goldLineIndex] = applyCenteredLine(
        tombstoneText[goldLineIndex],
        goldText,
      );
    }
    const deathLines = wrapStoneLines(deathText, 4);
    for (let i = 0; i < deathLines.length; i += 1) {
      const lineIndex = deathLineStartIndex + i;
      if (lineIndex >= tombstoneText.length) {
        break;
      }
      tombstoneText[lineIndex] = applyCenteredLine(
        tombstoneText[lineIndex],
        deathLines[i],
      );
    }
    tombstoneText[yearLineIndex] = applyCenteredLine(
      tombstoneText[yearLineIndex],
      String(year),
    );

    return tombstoneText;
  }

  emitGameOverComplete(how, when) {
    if (!this.deps.coordinator.eventHandler) {
      this.resetGameOverSequence("no-handler");
      return;
    }
    const tombstoneLines = this.buildTombstoneLines(how, when);
    const killerName = String(this.deps.memory.readGlobalValue(["killer", "name"]) || "")
      .replace(/\u0000/g, "")
      .trim();
    const deathMessage =
      killerName || this.resolveGameOverDeathText() || "Game over";
    this.deps.checkpoints.cleanupAndFlushCheckpointShardsAfterGameOver(() => {
      this.deps.coordinator.emit({
        type: "game_over_complete",
        tombstoneLines,
        deathMessage,
      });
      this.resetGameOverSequence("complete");
    });
  }

  handleShimOutrip(args) {
    {
      const [ripWinId, how, when] = args;
      const winId = Number.isFinite(ripWinId) ? Math.trunc(ripWinId) : null;
      console.log("NetHack outrip (tombstone)", args);
      this.lastGameOverHow = Number.isFinite(how)
        ? Math.trunc(how)
        : this.lastGameOverHow;
      this.lastGameOverWhen = Number.isFinite(when)
        ? Math.trunc(when)
        : this.lastGameOverWhen;
      this.beginGameOverSequence("outrip");

      const tombstoneText = this.buildTombstoneLines(how, when);

      if (winId !== null) {
        this.deps.windowText.resetWindowTextBuffer(winId);
        for (const line of tombstoneText) {
          this.deps.windowText.appendWindowTextBuffer(winId, line);
        }
      }

      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "outrip",
          args: args,
        });
      }
      return 0;
    }
  }

  handleShimExitNhwindows(args) {
    const [exitMessage] = args;
    const normalizedExitMessage =
      typeof exitMessage === "string"
        ? this.deps.promptContext.normalizePromptContextMessage(exitMessage)
        : "";
    console.log("Exiting NetHack windows");
    if (normalizedExitMessage && this.deps.coordinator.eventHandler) {
      this.deps.promptContext.rememberPromptContextMessage(
        normalizedExitMessage,
        "exit_nhwindows",
      );
      this.deps.coordinator.emit({
        type: "raw_print",
        text: normalizedExitMessage,
      });
    }
    if (
      normalizedExitMessage.toLowerCase() === "be seeing you..." &&
      !this.deps.coordinator.runtimeTerminationEmitted
    ) {
      // Manual save/quit can reach exit_nhwindows before the Emscripten
      // quit/onExit hooks fire. Emit a termination fallback so the UI can
      // transition and the worker can flush IDBFS.
      this.deps.coordinator.emitRuntimeTerminated(normalizedExitMessage, 0);
    }
    return 0;
  }
}
