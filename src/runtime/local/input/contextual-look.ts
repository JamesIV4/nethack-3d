// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeQuestionInput } from "./questions";

export interface RuntimeContextualLookDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "runtimeVersion"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "normalizeQuestionText"
  >;
  readonly questionInput: Pick<
    RuntimeQuestionInput,
    "normalizeYnDefaultChoice"
  >;
}

/** Contextual look/glance probe lifetimes and automatic follow-up prompt answers. */
export class RuntimeContextualLook {
  declare contextualGlanceProbePrefix: string;
  declare contextualLookInfoProbePrefix: string;
  declare contextualGlanceProbeMouseDeadlineMs: number;
  declare contextualGlanceAutoCancelPositionUntilMs: number;
  declare contextualGlanceAutoCancelPositionWindowMs: number;
  declare contextualLookInfoProbeMouseDeadlineMs: number;
  declare contextualLookInfoProbeMouseWindowMs: number;
  declare pendingContextualLookMapRouteSelection: boolean;
  declare contextualLookInfoAutoFlowStage: string;
  declare contextualLookInfoAutoFlowUntilMs: number;

  constructor(private readonly deps: RuntimeContextualLookDependencies) {
    this.contextualGlanceProbePrefix = "__CTX_GLANCE_PROBE__";
    this.contextualLookInfoProbePrefix = "__CTX_LOOK_INFO_PROBE__";
    this.contextualGlanceProbeMouseDeadlineMs = 0;
    this.contextualGlanceAutoCancelPositionUntilMs = 0;
    this.contextualGlanceAutoCancelPositionWindowMs = 450;
    this.contextualLookInfoProbeMouseDeadlineMs = 0;
    this.contextualLookInfoProbeMouseWindowMs = 5000;
    this.pendingContextualLookMapRouteSelection = false;
    this.contextualLookInfoAutoFlowStage = "none";
    this.contextualLookInfoAutoFlowUntilMs = 0;
  }

  clearContextualLookInfoAutoFlow(reason = "") {
    if (reason) {
      console.log(`Clearing contextual tile info auto-flow: ${reason}`);
    }
    this.contextualLookInfoProbeMouseDeadlineMs = 0;
    this.pendingContextualLookMapRouteSelection = false;
    this.contextualLookInfoAutoFlowStage = "none";
    this.contextualLookInfoAutoFlowUntilMs = 0;
  }

  isContextualLookInfoAutoFlowActive() {
    if (this.contextualLookInfoAutoFlowStage === "none") {
      return false;
    }
    if (
      !Number.isFinite(this.contextualLookInfoAutoFlowUntilMs) ||
      Date.now() > this.contextualLookInfoAutoFlowUntilMs
    ) {
      this.clearContextualLookInfoAutoFlow("expired");
      return false;
    }
    return true;
  }

  shouldSuppressLegacyContextualLookInfoRawPrint() {
    return (
      this.deps.coordinator.runtimeVersion === "slashem" &&
      this.isContextualLookInfoAutoFlowActive()
    );
  }

  resolveContextualLookInfoAutoAnswer(question, choices, defaultChoice) {
    if (!this.isContextualLookInfoAutoFlowActive()) {
      return null;
    }

    const normalizedQuestion = this.deps.menuSelection.normalizeQuestionText(question);
    const normalizedChoices =
      typeof choices === "string" ? choices.trim().toLowerCase() : "";
    const normalizedDefaultChoice =
      this.deps.questionInput.normalizeYnDefaultChoice(defaultChoice);
    const stage = this.contextualLookInfoAutoFlowStage;

    if (this.deps.coordinator.runtimeVersion === "slashem") {
      const isCursorPrompt =
        stage === "await_cursor_confirm" &&
        normalizedQuestion.includes("cursor") &&
        normalizedChoices.includes("y") &&
        normalizedChoices.includes("q") &&
        normalizedDefaultChoice === "q";
      if (isCursorPrompt) {
        console.log(
          'Auto-answering contextual tile info cursor prompt with "y"',
        );
        this.contextualLookInfoAutoFlowStage = "await_mouse_target";
        return "y";
      }

      const isMoreInfoPrompt =
        stage === "await_more_info" &&
        normalizedQuestion.includes("more info") &&
        normalizedChoices.includes("y") &&
        normalizedChoices.includes("n") &&
        normalizedDefaultChoice === "n";
      if (isMoreInfoPrompt) {
        console.log('Auto-answering contextual tile info "More info?" with "y"');
        this.contextualLookInfoAutoFlowStage = "await_exit";
        this.contextualLookInfoAutoFlowUntilMs = Date.now() + 30000;
        return "y";
      }
    }

    if (stage !== "none") {
      console.log(
        "Unexpected prompt during contextual tile info auto-flow; using Escape failsafe",
        {
          question: normalizedQuestion,
          choices: normalizedChoices,
          defaultChoice: normalizedDefaultChoice,
          stage,
        },
      );
      this.clearContextualLookInfoAutoFlow("unexpected prompt");
      return "Escape";
    }

    return null;
  }
}
