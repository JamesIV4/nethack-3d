import type {
  GameOverPostmortemReportId,
  GameOverPostmortemReports,
  GameOverState,
  RunTelemetrySnapshot
} from "../../ui-types";
import {
  createEmptyGameOverPostmortemReports,
  createEmptyRunTelemetrySnapshot
} from "../../ui-types";
import type { InventoryDialogOptions } from "../shared/types";
import type { CombatAttribution } from "../world/combat-attribution";
import type { DirectionPrompts } from "./direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { KeyboardInput } from "../input/keyboard-input";
import type { MovementInput } from "../input/movement-input";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { RunTelemetry } from "../world/run-telemetry";

export interface GameOverDependencies {
  readonly combatAttribution: Pick<
    CombatAttribution,
    "hasTriggeredPlayerDeathEffect"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly engineState: Pick<
    EngineState,
    "uiAdapter"
  >;
  readonly keyboardInput: Pick<
    KeyboardInput,
    "isSpaceDismissKey"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isMovementInput"
    | "tryResolveCameraRelativeGameplayMovementInput"
    | "tryResolveFpsMovementInput"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "buildInventoryDialogState"
    | "infoMenuBlockingActive"
    | "isInfoDialogVisible"
    | "isInventoryDialogVisible"
    | "isNetHackMessageInfoMenuTitle"
    | "normalizeInfoMenuLines"
    | "showInventoryDialog"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
    | "showQuestion"
  >;
  readonly runTelemetry: Pick<
    RunTelemetry,
    "buildRunTelemetrySnapshot"
    | "cloneRunTelemetrySnapshot"
  >;
}

/** Postmortem reports and deferred game-over presentation synchronization. */
export class GameOver {
  constructor(private readonly dependencies: GameOverDependencies) {}

  deferredGameOverInventoryDialogOptions: InventoryDialogOptions | null =
    null;

  deferredGameOverQuestionState: {
    question: string;
    choices: string;
    defaultChoice: string;
    menuItems: any[];
  } | null = null;

  deferredGameOverCompletionState: {
    deathMessage: string | null;
    tombstoneLines: string[] | null;
    shouldDeferPromptReady: boolean;
  } | null = null;

  gameOverState: GameOverState = {
    active: false,
    deathMessage: null,
    promptReady: false,
    tombstoneLines: null,
    postmortemReports: createEmptyGameOverPostmortemReports(),
    telemetry: createEmptyRunTelemetrySnapshot(),
  };

  postmortemReports: GameOverPostmortemReports =
    createEmptyGameOverPostmortemReports();

  pendingSuppressedGameOverReportKind: GameOverPostmortemReportId | null =
    null;

  pendingGameOverPromptReady: boolean = false;

  gameOverUiRevealBlocked: boolean = false;

  cloneGameOverPostmortemReports(
    reports: GameOverPostmortemReports | null | undefined,
  ): GameOverPostmortemReports {
    const source = reports ?? createEmptyGameOverPostmortemReports();
    return {
      attributes: Array.isArray(source.attributes)
        ? [...source.attributes]
        : null,
      vanquished: Array.isArray(source.vanquished)
        ? [...source.vanquished]
        : null,
      conduct: Array.isArray(source.conduct) ? [...source.conduct] : null,
      dungeonOverview: Array.isArray(source.dungeonOverview)
        ? [...source.dungeonOverview]
        : null,
    };
  }

  syncActiveGameOverDetails(): void {
    if (!this.gameOverState.active) {
      return;
    }
    this.gameOverState = {
      ...this.gameOverState,
      postmortemReports: this.cloneGameOverPostmortemReports(
        this.postmortemReports,
      ),
      telemetry: this.dependencies.runTelemetry.buildRunTelemetrySnapshot(),
    };
    this.dependencies.engineState.uiAdapter.setGameOver({ ...this.gameOverState });
  }

  resolveGameOverPostmortemReportKindFromQuestion(
    questionText: string,
  ): GameOverPostmortemReportId | null {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized.includes("vanquished")) {
      return "vanquished";
    }
    if (
      normalized.includes("voluntary challenges") ||
      normalized.includes("conduct")
    ) {
      return "conduct";
    }
    if (
      normalized.includes("final attributes") ||
      (normalized.includes("attributes") &&
        (normalized.includes("show") || normalized.includes("see")))
    ) {
      return "attributes";
    }
    if (
      normalized.includes("dungeon overview") ||
      (normalized.includes("overview") &&
        (normalized.includes("show") || normalized.includes("see")))
    ) {
      return "dungeonOverview";
    }
    return null;
  }

  resolveGameOverPostmortemReportKindFromInfoMenu(
    title: string,
    lines: readonly string[],
  ): GameOverPostmortemReportId | null {
    const normalizedTitle = String(title || "")
      .trim()
      .toLowerCase();
    const firstLine = Array.isArray(lines) ? String(lines[0] || "").trim() : "";
    const normalizedFirstLine = firstLine.toLowerCase();
    const combined = `${normalizedTitle}\n${normalizedFirstLine}`;
    if (combined.includes("vanquished")) {
      return "vanquished";
    }
    if (
      combined.includes("voluntary challenges") ||
      combined.includes("conduct")
    ) {
      return "conduct";
    }
    if (combined.includes("attribute")) {
      return "attributes";
    }
    if (
      combined.includes("dungeon overview") ||
      (combined.includes("overview") && combined.includes("dungeon"))
    ) {
      return "dungeonOverview";
    }
    return null;
  }

  captureGameOverPostmortemReport(
    kind: GameOverPostmortemReportId,
    title: string,
    lines: readonly string[],
  ): void {
    const normalizedLines = this.dependencies.promptDialogs.normalizeInfoMenuLines(lines).filter(
      (line) =>
        line.trim().length > 0 && !this.dependencies.promptDialogs.isNetHackMessageInfoMenuTitle(line),
    );
    const normalizedTitle = String(title || "").trim();
    const storedLines =
      normalizedTitle &&
      !this.dependencies.promptDialogs.isNetHackMessageInfoMenuTitle(normalizedTitle) &&
      normalizedLines.length > 0 &&
      normalizedTitle.toLowerCase() !== normalizedLines[0]?.trim().toLowerCase()
        ? [normalizedTitle, ...normalizedLines]
        : normalizedLines;
    this.postmortemReports = {
      ...this.postmortemReports,
      [kind]: storedLines.length > 0 ? storedLines : null,
    };
    this.pendingSuppressedGameOverReportKind = null;
    this.syncActiveGameOverDetails();
  }

  setGameOverState(
    active: boolean,
    deathMessage: string | null,
    options: {
      promptReady?: boolean;
      tombstoneLines?: string[] | null;
      postmortemReports?: GameOverPostmortemReports | null;
      telemetry?: RunTelemetrySnapshot | null;
    } = {},
  ): void {
    const nextActive = Boolean(active);
    const nextPromptReady =
      typeof options.promptReady === "boolean"
        ? options.promptReady
        : nextActive
          ? false
          : false;
    const nextTombstoneLines =
      options.tombstoneLines !== undefined
        ? options.tombstoneLines
        : nextActive
          ? this.gameOverState.tombstoneLines
          : null;
    const nextPostmortemReports =
      options.postmortemReports !== undefined
        ? this.cloneGameOverPostmortemReports(options.postmortemReports)
        : nextActive
          ? this.cloneGameOverPostmortemReports(this.postmortemReports)
          : createEmptyGameOverPostmortemReports();
    const nextTelemetry =
      options.telemetry !== undefined
        ? this.dependencies.runTelemetry.cloneRunTelemetrySnapshot(options.telemetry)
        : nextActive
          ? this.dependencies.runTelemetry.buildRunTelemetrySnapshot()
          : createEmptyRunTelemetrySnapshot();
    if (!nextActive || nextPromptReady) {
      this.pendingGameOverPromptReady = false;
    }
    this.gameOverState = {
      active: nextActive,
      deathMessage: deathMessage && deathMessage.trim() ? deathMessage : null,
      promptReady: nextPromptReady,
      tombstoneLines:
        Array.isArray(nextTombstoneLines) && nextTombstoneLines.length > 0
          ? [...nextTombstoneLines]
          : null,
      postmortemReports: nextPostmortemReports,
      telemetry: nextTelemetry,
    };
    if (!nextActive) {
      this.dependencies.combatAttribution.hasTriggeredPlayerDeathEffect = false;
      this.clearGameOverUiRevealDelayState();
    }
    this.dependencies.engineState.uiAdapter.setGameOver({ ...this.gameOverState });
    if (this.dependencies.promptDialogs.isInventoryDialogVisible) {
      this.dependencies.engineState.uiAdapter.setInventory(this.dependencies.promptDialogs.buildInventoryDialogState());
    }
  }

  clearGameOverUiRevealDelayState(): void {
    this.gameOverUiRevealBlocked = false;
    this.deferredGameOverInventoryDialogOptions = null;
    this.deferredGameOverQuestionState = null;
    this.deferredGameOverCompletionState = null;
  }

  isGameOverUiRevealBlocked(): boolean {
    return this.gameOverUiRevealBlocked;
  }

  armGameOverUiRevealDelay(): void {
    this.gameOverUiRevealBlocked = true;
    this.deferredGameOverInventoryDialogOptions = null;
    this.deferredGameOverQuestionState = null;
    this.deferredGameOverCompletionState = null;
  }

  scheduleGameOverUiRevealFlush(): void {
    if (!this.isGameOverUiRevealBlocked()) {
      this.flushDeferredGameOverUiReveal();
    }
  }

  releaseDeferredGameOverUiReveal(): boolean {
    if (!this.isGameOverUiRevealBlocked()) {
      return false;
    }
    this.gameOverUiRevealBlocked = false;
    this.flushDeferredGameOverUiReveal();
    return true;
  }

  shouldReleaseDeferredGameOverUiFromKeyDown(
    event: KeyboardEvent,
  ): boolean {
    if (!this.isGameOverUiRevealBlocked()) {
      return false;
    }
    if (
      event.key === "Escape" ||
      event.key === "Enter" ||
      event.key === "NumpadEnter" ||
      this.dependencies.keyboardInput.isSpaceDismissKey(event)
    ) {
      return true;
    }
    if (this.dependencies.movementInput.isMovementInput(event.key) || this.dependencies.movementInput.isMovementInput(event.code)) {
      return true;
    }
    return (
      this.dependencies.movementInput.tryResolveFpsMovementInput(event.key, event.code) !== null ||
      this.dependencies.movementInput.tryResolveCameraRelativeGameplayMovementInput(event) !== null
    );
  }

  flushDeferredGameOverUiReveal(): void {
    if (this.isGameOverUiRevealBlocked()) {
      return;
    }

    const deferredCompletion = this.deferredGameOverCompletionState;
    this.deferredGameOverCompletionState = null;
    if (deferredCompletion) {
      this.pendingGameOverPromptReady =
        deferredCompletion.shouldDeferPromptReady;
      this.setGameOverState(true, deferredCompletion.deathMessage, {
        promptReady: deferredCompletion.shouldDeferPromptReady ? false : true,
        tombstoneLines: deferredCompletion.tombstoneLines,
      });
    }

    const deferredQuestion = this.deferredGameOverQuestionState;
    this.deferredGameOverQuestionState = null;
    if (deferredQuestion) {
      this.dependencies.questionMenus.isInQuestion = true;
      this.dependencies.questionMenus.showQuestion(
        deferredQuestion.question,
        deferredQuestion.choices,
        deferredQuestion.defaultChoice,
        deferredQuestion.menuItems,
      );
    }

    if (
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      this.deferredGameOverInventoryDialogOptions &&
      this.gameOverState.active &&
      !this.dependencies.promptDialogs.isInventoryDialogVisible
    ) {
      const deferredInventoryOptions =
        this.deferredGameOverInventoryDialogOptions;
      this.deferredGameOverInventoryDialogOptions = null;
      this.dependencies.promptDialogs.showInventoryDialog(deferredInventoryOptions);
    }
  }

  isGameOverPossessionsIdentifyQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes("do you want your possessions identified") ||
      normalized.startsWith("do you want to see what you had when you ")
    );
  }

  fulfillDeferredGameOverPromptReadyIfPossible(): void {
    if (!this.pendingGameOverPromptReady) {
      return;
    }
    if (!this.gameOverState.active) {
      this.pendingGameOverPromptReady = false;
      return;
    }
    if (this.dependencies.promptDialogs.isInfoDialogVisible || this.dependencies.promptDialogs.infoMenuBlockingActive) {
      return;
    }
    this.pendingGameOverPromptReady = false;
    this.setGameOverState(true, this.gameOverState.deathMessage, {
      promptReady: true,
    });
  }
}
