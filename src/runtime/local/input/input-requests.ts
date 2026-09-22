// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import RuntimeInputBroker from "../../input/RuntimeInputBroker";
import { resolveBoundedQuestionAnswer } from "../../input/question-answer";
import type {
  InputConsumeResult,
  InputRequestKind,
  InputSource,
  InputTargetKinds,
} from "../../input/RuntimeInputBroker";
import type { RuntimeMouseInput } from "./mouse-poskey";
import type { RuntimeContextualLook } from "./contextual-look";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimePositionInput } from "./position-selection";
import type { RuntimeQuestionInput } from "./questions";
import type { RuntimeInventoryContext } from "../menus/inventory-context";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeKeyboardInput } from "./keyboard";
import type { RuntimeTileRefresh } from "../world/tile-refresh";
import type { RuntimeExtendedCommands } from "./extended-commands";

export interface RuntimeInputRequestsDependencies {
  readonly contextualLook: Pick<
    RuntimeContextualLook,
    "clearContextualLookInfoAutoFlow"
    | "contextualGlanceAutoCancelPositionUntilMs"
    | "contextualGlanceAutoCancelPositionWindowMs"
    | "contextualGlanceProbeMouseDeadlineMs"
    | "contextualLookInfoAutoFlowStage"
    | "contextualLookInfoAutoFlowUntilMs"
    | "contextualLookInfoProbeMouseDeadlineMs"
    | "isContextualLookInfoAutoFlowActive"
    | "pendingContextualLookMapRouteSelection"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "logRoutine"
    | "runtimeVersion"
    | "isClosed"
    | "protocol"
  >;
  readonly extendedCommands: Pick<
    RuntimeExtendedCommands,
    "clearQueuedExtendedCommandSubmission"
    | "resolvePendingExtendedCommandRequest"
  >;
  readonly inventoryContext: Pick<
    RuntimeInventoryContext,
    "isCallRootQuestion"
    | "isNameRootQuestion"
  >;
  readonly keyboardInput: Pick<
    RuntimeKeyboardInput,
    "processKey"
    | "numberPadModeEnabled"
    | "updateNumberPadModeFromInput"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "currentMenuQuestionText"
  >;
  readonly mouseInput: Pick<
    RuntimeMouseInput,
    "applyMouseTokenToPoskeyRequest"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "farLookMode"
    | "farLookOrigin"
    | "isFarLookContinuationInput"
    | "isFarLookExitInput"
    | "isPositionModeInitiatorInput"
    | "normalizeFarLookPositionInput"
    | "pendingLookMenuFarLookArm"
    | "pendingTravelPositionInputArm"
    | "positionInputActive"
    | "setPositionInputActive"
    | "shouldPreserveFarLookAfterMouseSelection"
  >;
  readonly questionInput: Pick<
    RuntimeQuestionInput,
    "activeYnPrompt"
    | "resolveEscapeForActiveYnPrompt"
  >;
  readonly tileRefresh: Pick<
    RuntimeTileRefresh,
    "flushDeferredTileRefreshesNow"
    | "maybeFlushDeferredTileRefreshes"
  >;
}

/** Input broker ownership, active request identity, token consumption and question waiter lifecycle. */
export class RuntimeInputRequests {
  declare inputBroker: RuntimeInputBroker;
  declare activeInputRequest: any;
  declare awaitingQuestionInput: boolean;
  silentInventoryRefreshPending = false;
  commandInputContinuation: "none" | "count" | "prefix" = "none";

  constructor(private readonly deps: RuntimeInputRequestsDependencies) {
    this.inputBroker = new RuntimeInputBroker(256, token => this.deps.coordinator.protocol.tagToken(token));
    this.activeInputRequest = null;
    this.awaitingQuestionInput = false;
  }

  enqueueInputKeys(keys: string[], source: InputSource | "ctrl" = "user", targetKinds: InputTargetKinds = "any") {
    const now = Date.now();
    const tokens = [];
    for (const key of keys) {
      if (typeof key !== "string" || key.length === 0) {
        continue;
      }
      tokens.push({
        key,
        source,
        createdAt: now,
        targetKinds,
      });
    }
    if (tokens.length > 0) {
      this.inputBroker.enqueueTokens(tokens);
    }
  }

  isNormalCommandPositionRequest(): boolean {
    return this.commandInputContinuation === "none" &&
      !this.awaitingQuestionInput &&
      !this.deps.questionInput.activeYnPrompt &&
      this.deps.positionInput.farLookMode === "none" &&
      !this.deps.positionInput.positionInputActive &&
      !this.deps.positionInput.pendingTravelPositionInputArm &&
      !this.deps.positionInput.pendingLookMenuFarLookArm;
  }

  requestSilentInventoryRefresh(): void {
    this.silentInventoryRefreshPending = true;
    // A live broker waiter is essential: activeInputRequest can still describe
    // an already-consumed command until its Promise continuation runs.
    if (this.activeInputRequest?.kind === "position" &&
        this.inputBroker.hasPendingRequests("position") &&
        this.isNormalCommandPositionRequest()) {
      this.silentInventoryRefreshPending = false;
      this.enqueueInputKeys(["i"], "system", ["position"]);
    }
  }

  updateCommandInputContinuation(inputCode: number): void {
    const key = String.fromCharCode(inputCode);
    const numberPad = this.deps.keyboardInput.numberPadModeEnabled;
    // readchar/nh_poskey also collects counts and movement/menu prefixes.
    // Those waits belong to the command already being entered, not a new one.
    if (this.commandInputContinuation === "count" && (inputCode === 8 || inputCode === 127)) {
      return; // Editing a count still leaves its command pending.
    }
    if ((!numberPad || this.commandInputContinuation === "count") && /^\d$/.test(key)) {
      this.commandInputContinuation = "count";
    } else if (numberPad && key === "n") {
      this.commandInputContinuation = "count";
    } else if (/^[gGmMF]$/.test(key) || (numberPad && (key === "5" || key === "-" || inputCode === 0xb5))) {
      this.commandInputContinuation = "prefix";
    } else {
      this.commandInputContinuation = "none";
    }
  }

  consumeInputResult(result: InputConsumeResult | null, requestKind: InputRequestKind, requestContext = null): number {
    if (!result || result.cancelled) {
      this.deps.coordinator.protocol.cancelWait(
        requestKind === "position"
          ? ["shim_nh_poskey"]
          : ["shim_nhgetch", "shim_yn_function", "shim_display_nhwindow", "shim_display_file"],
      );
      this.commandInputContinuation = "none";
      return typeof result?.cancelCode === "number" ? result.cancelCode : 27;
    }

    const commandPositionInput = requestKind === "position" &&
      !this.awaitingQuestionInput && !this.deps.questionInput.activeYnPrompt &&
      this.deps.positionInput.farLookMode === "none" &&
      !this.deps.positionInput.positionInputActive;
    const token = result.token;
    this.deps.coordinator.protocol.consumed(
      token ?? undefined,
      requestKind === "position"
        ? ["shim_nh_poskey"]
        : ["shim_nhgetch", "shim_yn_function", "shim_display_nhwindow", "shim_display_file"],
    );
    if (
      requestKind === "position" &&
      this.deps.mouseInput.applyMouseTokenToPoskeyRequest(token, requestContext)
    ) {
      if (this.deps.contextualLook.contextualLookInfoProbeMouseDeadlineMs > 0) {
        const nowMs = Date.now();
        if (nowMs <= this.deps.contextualLook.contextualLookInfoProbeMouseDeadlineMs) {
          if (this.deps.coordinator.runtimeVersion === "slashem") {
            this.deps.coordinator.logRoutine(
              'Queueing contextual tile info follow-up input ["Escape"] for legacy /what is map probe',
            );
            this.enqueueInputKeys(["Escape"], "synthetic", ["position"]);
            this.deps.contextualLook.contextualLookInfoAutoFlowStage = "await_more_info";
            this.deps.contextualLook.contextualLookInfoAutoFlowUntilMs = nowMs + 30000;
          } else {
            this.deps.coordinator.logRoutine(
              'Queueing contextual tile info follow-up inputs [":", "Escape"] for /what is map probe',
            );
            this.enqueueInputKeys([":", "Escape"], "synthetic", ["position"]);
            this.deps.contextualLook.contextualLookInfoAutoFlowStage = "await_exit";
            this.deps.contextualLook.contextualLookInfoAutoFlowUntilMs = nowMs + 30000;
          }
        } else {
          this.deps.contextualLook.clearContextualLookInfoAutoFlow("mouse target expired");
        }
        this.deps.contextualLook.contextualLookInfoProbeMouseDeadlineMs = 0;
        this.deps.contextualLook.pendingContextualLookMapRouteSelection = false;
      }
      if (this.deps.contextualLook.contextualGlanceProbeMouseDeadlineMs > 0) {
        const nowMs = Date.now();
        if (nowMs <= this.deps.contextualLook.contextualGlanceProbeMouseDeadlineMs) {
          this.deps.contextualLook.contextualGlanceAutoCancelPositionUntilMs =
            nowMs + this.deps.contextualLook.contextualGlanceAutoCancelPositionWindowMs;
        }
        this.deps.contextualLook.contextualGlanceProbeMouseDeadlineMs = 0;
      }
      // "/" -> "/" look mode can stay active after a click while NetHack asks
      // for additional description details. Keep UI position mode aligned.
      if (
        this.deps.positionInput.farLookMode === "active" &&
        !this.deps.positionInput.shouldPreserveFarLookAfterMouseSelection()
      ) {
        this.deps.positionInput.farLookMode = "none";
        this.deps.positionInput.farLookOrigin = null;
        this.deps.positionInput.setPositionInputActive(false);
      }
      this.commandInputContinuation = "none";
      return 0;
    }

    const rawKey = token && typeof token.key === "string" ? token.key : "";
    let key =
      requestKind === "position"
        ? this.deps.positionInput.normalizeFarLookPositionInput(rawKey)
        : rawKey;
    if (!key) {
      return 0;
    }
    if (key === "Escape" || (commandPositionInput && key !== "#")) this.deps.contextualLook.contextualGlanceProbeMouseDeadlineMs = 0;

    if (
      token &&
      token.source === "synthetic" &&
      requestKind === "position" &&
      key === "Escape" &&
      this.deps.contextualLook.isContextualLookInfoAutoFlowActive()
    ) {
      this.deps.contextualLook.clearContextualLookInfoAutoFlow("synthetic escape consumed");
    }

    if (requestKind === "event" && key === "Escape") {
      const replacement = this.deps.questionInput.resolveEscapeForActiveYnPrompt();
      if (replacement) {
        this.deps.coordinator.logRoutine(
          `Mapping Escape to "${replacement}" for active yn_function prompt`,
          {
            choices: this.deps.questionInput.activeYnPrompt?.choices || "",
            defaultChoice: this.deps.questionInput.activeYnPrompt?.defaultChoice ?? 0,
          },
        );
        key = replacement;
      }
    }

    if (this.deps.positionInput.farLookMode === "none" && this.deps.positionInput.isPositionModeInitiatorInput(key)) {
      // ";" can be consumed through either event or position requests.
      const armedFromNameOrCallFloorTarget =
        this.deps.positionInput.pendingLookMenuFarLookArm &&
        (this.deps.inventoryContext.isNameRootQuestion(this.deps.menuSelection.currentMenuQuestionText) ||
          this.deps.inventoryContext.isCallRootQuestion(this.deps.menuSelection.currentMenuQuestionText));
      this.deps.positionInput.farLookMode = "armed";
      this.deps.positionInput.farLookOrigin = this.deps.positionInput.pendingLookMenuFarLookArm
        ? armedFromNameOrCallFloorTarget
          ? "floor_target_menu"
          : "look_menu"
        : "direct";
      this.deps.positionInput.pendingLookMenuFarLookArm = false;
    } else if (
      requestKind === "event" &&
      this.deps.positionInput.farLookMode === "armed" &&
      this.deps.positionInput.farLookOrigin !== "legacy_cursor_prompt"
    ) {
      this.deps.positionInput.farLookMode = "none";
      this.deps.positionInput.farLookOrigin = null;
      this.deps.positionInput.pendingLookMenuFarLookArm = false;
    } else if (this.deps.positionInput.pendingLookMenuFarLookArm) {
      this.deps.positionInput.pendingLookMenuFarLookArm = false;
    }

    if (requestKind === "position" && this.deps.positionInput.farLookMode === "active") {
      const shouldExitFarLook =
        this.deps.positionInput.isFarLookExitInput(key) ||
        !this.deps.positionInput.isFarLookContinuationInput(key);
      if (shouldExitFarLook) {
        this.deps.positionInput.farLookMode = "none";
        this.deps.positionInput.farLookOrigin = null;
        this.deps.positionInput.setPositionInputActive(false);
      }
    }

    if (this.awaitingQuestionInput) {
      this.deps.keyboardInput.updateNumberPadModeFromInput(key);
    }

    const inputCode = this.deps.keyboardInput.processKey(key);
    if (commandPositionInput) {
      this.updateCommandInputContinuation(inputCode);
    } else if (requestKind === "event") {
      this.commandInputContinuation = "none";
    }
    return inputCode;
  }

  requestInputCode(requestKind: InputRequestKind, requestContext = null): number | Promise<number> {
    if (this.activeInputRequest && this.activeInputRequest.promise) {
      if (this.activeInputRequest.kind === requestKind) {
        return this.activeInputRequest.promise;
      }

      this.deps.coordinator.logRoutine(
        `Deferring ${requestKind} input request until pending ${this.activeInputRequest.kind} request completes`,
      );
      return this.activeInputRequest.promise.then(() =>
        this.requestInputCode(requestKind, requestContext),
      );
    }

    // Run background inventory queries only at a normal command boundary.
    // Never enqueue an i behind player commands: a drop can ask to sell before
    // the next command, and would consume that i as an invalid yes/no answer.
    if (requestKind === "position" && this.silentInventoryRefreshPending &&
        this.isNormalCommandPositionRequest()) {
      this.silentInventoryRefreshPending = false;
      return this.deps.keyboardInput.processKey("i");
    }
    const requested = this.requestValidInputResult(requestKind);
    if (requested && typeof requested.then === "function") {
      let pendingPromise = null;
      pendingPromise = requested
        .then((result) =>
          this.consumeInputResult(result, requestKind, requestContext),
        )
        .finally(() => {
          if (
            this.activeInputRequest &&
            this.activeInputRequest.promise === pendingPromise
          ) {
            this.activeInputRequest = null;
          }
          this.deps.tileRefresh.flushDeferredTileRefreshesNow();
          this.deps.tileRefresh.maybeFlushDeferredTileRefreshes();
        });
      this.activeInputRequest = {
        kind: requestKind,
        promise: pendingPromise,
      };
      return pendingPromise;
    }
    return this.consumeInputResult(requested, requestKind, requestContext);
  }

  requestValidInputResult(requestKind: InputRequestKind): InputConsumeResult | Promise<InputConsumeResult> {
    const validate = (result: InputConsumeResult): InputConsumeResult | null => {
      if (this.deps.coordinator.isClosed) {
        return { ...result, token: null, cancelled: true, cancelCode: 27 };
      }
      const prompt = this.deps.questionInput.activeYnPrompt;
      if (result.cancelled || !result.token || requestKind !== "event" || !prompt) {
        return result;
      }
      const answer = resolveBoundedQuestionAnswer(
        result.token.key, prompt.choices, prompt.defaultChoice,
      );
      return answer === null ? null : {
        ...result, token: { ...result.token, key: answer },
      };
    };
    // Invalid answers leave this same request pending. Read directly from the
    // broker rather than re-entering requestInputCode and awaiting ourselves.
    while (true) {
      const requested = this.inputBroker.requestNext(requestKind);
      if (requested instanceof Promise) {
        return requested.then(result => validate(result) ?? this.requestValidInputResult(requestKind));
      }
      const valid = validate(requested);
      if (valid) return valid;
    }
  }

  waitForQuestionInput() {
    // A question prompt consumes single-key answers; queued extended command
    // triggers are stale in this mode and can poison later command dispatch.
    this.deps.extendedCommands.resolvePendingExtendedCommandRequest(-1);
    this.deps.extendedCommands.clearQueuedExtendedCommandSubmission("question input requested");
    this.awaitingQuestionInput = true;
    const requested = this.requestInputCode("event");
    if (requested && typeof requested.then === "function") {
      return requested.finally(() => {
        this.awaitingQuestionInput = false;
      });
    }
    this.awaitingQuestionInput = false;
    return requested;
  }

  handleShimGetNhEvent() {
    // NetHack's get_nh_event is a non-blocking event pump hook.
    // It should not consume command input; nh_poskey/nhgetch own key waits.
    return 0;
  }

  handleShimNhGetch() {
    return this.requestInputCode("event");
  }
}
