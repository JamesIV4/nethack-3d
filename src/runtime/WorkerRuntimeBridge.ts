import type {
  RuntimeBridge,
  RuntimeCommand,
  RuntimeEvent,
  RuntimeEventHandler,
  RuntimeStartupOptions,
  RuntimeWorkerEnvelope,
  RuntimeInputOptions,
} from "./types";
import { RuntimeEventBatchReceiver } from "./protocol/event-batches";
import { refreshAreaCells, resolveRuntimeMapDimensions } from "./protocol/map-bounds";
import type {
  RuntimeCell,
  RuntimeProtocolHandshake,
  RuntimeRefreshResult,
  RuntimeRefreshOptions,
} from "./protocol/types";
import { recordDebugSessionLogEvent } from "../debug-session-log";
import { isLoggingEnabled } from "../logging";

export default class WorkerRuntimeBridge implements RuntimeBridge {
  private readonly worker: Worker;
  private readonly onEvent: RuntimeEventHandler;
  private readonly startupOptions: RuntimeStartupOptions | undefined;
  private startPromise: Promise<void> | null = null;
  private startResolve: (() => void) | null = null;
  private startReject: ((reason?: unknown) => void) | null = null;
  private disposed = false;
  readonly sessionId = globalThis.crypto?.randomUUID?.() ?? `runtime-${Date.now()}-${Math.random()}`;
  private nextCommandId = 0;
  private sentStart = false;
  private readonly beforeStart: RuntimeCommand[] = [];
  private readonly receiver: RuntimeEventBatchReceiver;
  protocol: RuntimeProtocolHandshake | null = null;
  lastBoundary: { reason: string; sequence: number } | null = null;
  private activeWait: { requestId: number; purpose: string } | null = null;
  private visiblePromptRequestId: number | null = null;
  private positionSelectionActive = false;
  private protocolFailed = false;
  private nextRefreshId = 0;
  private readonly refreshResults = new Map<number, RuntimeRefreshResult>();
  private readonly pendingRefreshes = new Map<
    number,
    { cells: RuntimeCell[]; resolve: (result: RuntimeRefreshResult) => void }
  >();

  constructor(
    onEvent: RuntimeEventHandler,
    startupOptions?: RuntimeStartupOptions,
  ) {
    this.onEvent = onEvent;
    this.startupOptions = startupOptions;
    this.receiver = new RuntimeEventBatchReceiver(this.sessionId, event => this.deliverEvent(event), error => {
      this.protocolFailed = true;
      this.cancelPendingRefreshes();
      this.onEvent({ type: "runtime_error", error });
    });
    // Keep the URL creation inline so Vite recognizes this as a worker entry
    // and emits JavaScript for production hosts like GitHub Pages.
    this.worker = new Worker(new URL("./runtime-worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (message: MessageEvent<RuntimeWorkerEnvelope>) => {
      if (this.disposed) {
        return;
      }
      this.handleWorkerMessage(message.data);
    };
    this.worker.onerror = (error) => {
      if (this.disposed) {
        return;
      }
      const errorMessage = this.extractWorkerErrorMessage(error);
      const startupErrorMessage = errorMessage || "Runtime worker failed to load";
      if (!this.isNormalRuntimeTerminationError(errorMessage)) this.protocolFailed = true;
      this.cancelPendingRefreshes();
      if (this.startReject) {
        this.startReject(new Error(startupErrorMessage));
        this.startResolve = null;
        this.startReject = null;
        return;
      }
      if (this.isNormalRuntimeTerminationError(errorMessage)) {
        this.onEvent({
          type: "runtime_terminated",
          reason: errorMessage || "Program terminated with exit(0)",
          exitCode: 0,
        });
        return;
      }
      console.error("Runtime worker error:", error);
      this.onEvent({
        type: "runtime_error",
        error: startupErrorMessage,
      });
    };
    this.worker.onmessageerror = (event) => {
      if (this.disposed) {
        return;
      }
      const message = this.extractWorkerErrorMessage(event);
      this.protocolFailed = true;
      this.cancelPendingRefreshes();
      if (this.startReject) {
        this.startReject(new Error(message || "Runtime worker message error"));
        this.startResolve = null;
        this.startReject = null;
        return;
      }
      this.onEvent({
        type: "runtime_error",
        error: message || "Runtime worker message error",
      });
    };
  }

  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("Runtime bridge already disposed"));
    if (this.protocolFailed) return Promise.reject(new Error("Runtime protocol has failed; restart the session"));
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = new Promise<void>((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;
      this.sentStart = true;
      this.postCommand({ type: "start", startupOptions: { ...this.startupOptions, protocolVersion: 1 } });
    });

    return this.startPromise;
  }

  sendInput(input: string, options: RuntimeInputOptions = {}): void {
    if (isLoggingEnabled() && this.isLikelyNameInputForDebug(input)) {
      const stackPreview = (new Error().stack || "")
        .split("\n")
        .slice(2, 7)
        .map((line) => line.trim());
      console.log("[NAME_DEBUG] Bridge sendInput(name-like)", {
        input,
        stackPreview,
      });
    }
    this.postCommandWithOptionalDelay({ type: "send_input", input, ...this.inputTarget(options, input) }, options);
  }

  sendInputSequence(
    inputs: string[],
    options: RuntimeInputOptions = {},
  ): void {
    this.postCommandWithOptionalDelay(
      { type: "send_input_sequence", inputs, ...this.inputTarget(options, inputs[0] ?? "") },
      options,
    );
  }

  sendMouseInput(x: number, y: number, button: number): void {
    this.postCommand({ type: "send_mouse_input", x, y, button, ...this.inputTarget({}) });
  }

  requestTileUpdate(x: number, y: number): Promise<RuntimeRefreshResult> {
    return this.requestCells([{ x, y }], { includeUnderPlayer: true });
  }

  requestAreaUpdate(centerX: number, centerY: number, radius: number): Promise<RuntimeRefreshResult> {
    return this.requestCells(refreshAreaCells(centerX, centerY, radius, resolveRuntimeMapDimensions(this.protocol?.mapDimensions)));
  }

  requestCells(cells: readonly RuntimeCell[], options: RuntimeRefreshOptions = {}): Promise<RuntimeRefreshResult> {
    const refreshId = ++this.nextRefreshId;
    const unique = new Map<string, RuntimeCell>();
    for (const cell of cells) {
      const x = Math.trunc(Number(cell?.x));
      const y = Math.trunc(Number(cell?.y));
      if (
        !Number.isSafeInteger(x) ||
        !Number.isSafeInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= 256 ||
        y >= 256
      ) continue;
      unique.set(`${x},${y}`, { x, y });
      if (unique.size >= 4096) break;
    }
    const normalizedCells = [...unique.values()];
    if (this.disposed || this.protocolFailed) {
      return Promise.resolve(this.cancelledRefreshResult(refreshId, normalizedCells));
    }
    const result = new Promise<RuntimeRefreshResult>(resolve => {
      this.pendingRefreshes.set(refreshId, { cells: normalizedCells, resolve });
    });
    this.postCommand({
      type: "request_cells",
      refreshId,
      cells: normalizedCells,
      includeUnderPlayer: options.includeUnderPlayer === true,
      scope: { ...this.receiver.scope },
    });
    return result;
  }

  requestRuntimeGlobalsSnapshot(): void {
    this.postCommand({ type: "request_runtime_globals_snapshot" });
  }

  setLoggingEnabled(enabled: boolean): void {
    this.postCommand({ type: "set_logging", enabled: Boolean(enabled) });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    try {
      this.postCommand({ type: "shutdown" });
    } catch {
      // Best-effort shutdown; worker might already be unavailable.
    }
    this.disposed = true;
    if (this.startReject) {
      this.startReject(new Error("Runtime bridge disposed"));
    }
    this.startResolve = null;
    this.startReject = null;
    this.startPromise = null;
    this.beforeStart.length = 0;
    this.activeWait = null;
    this.visiblePromptRequestId = null;
    this.cancelPendingRefreshes();
    this.refreshResults.clear();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    globalThis.setTimeout(() => {
      try {
        this.worker.terminate();
      } catch {
        // Ignore termination races during disposal.
      }
    }, 150);
  }

  private postCommand(command: RuntimeCommand): void {
    if (this.disposed || (this.protocolFailed && command.type !== "shutdown")) {
      return;
    }
    if (!this.sentStart) { this.beforeStart.push(command); return; }
    const scopedCommand = command.type === "request_cells"
      ? { ...command, scope: { ...this.receiver.scope } }
      : command;
    this.worker.postMessage({ ...scopedCommand, sessionId: this.sessionId, commandId: ++this.nextCommandId,
      lastProcessedSequence: this.receiver.lastProcessedSequence });
  }

  private inputTarget(options: RuntimeInputOptions, input = ""): { requestId?: number } {
    if (options.requestId !== undefined) return options.requestId === null ? {} : { requestId: options.requestId };
    // Background/meta command protocols retain their established queueing.
    if (input.startsWith("__") && !input.startsWith("__TEXT_INPUT__:") && !input.startsWith("__MENU_SELECT__:")) return {};
    const knownPrompt = this.activeWait && this.activeWait.purpose !== "command-or-position" && this.activeWait.purpose !== "unknown";
    return this.activeWait && (knownPrompt || this.positionSelectionActive || this.visiblePromptRequestId === this.activeWait.requestId)
      ? { requestId: this.activeWait.requestId } : {};
  }

  private deliverEvent(event: RuntimeEvent): void {
    if (event.type === "runtime_boundary") {
      this.lastBoundary = { reason: String(event.reason), sequence: this.receiver.lastProcessedSequence + 1 };
      if (event.reason === "map-display" || event.reason === "snapshot-complete") {
        this.onEvent({ type: "map_update_complete" });
      }
      return;
    }
    if (event.type === "runtime_terminated") {
      this.protocolFailed = true;
      this.cancelPendingRefreshes();
    }
    if (event.type === "input_wait" && typeof event.requestId === "number") {
      if (event.state === "waiting") this.activeWait = { requestId: event.requestId, purpose: String(event.purpose) };
      else {
        if (this.activeWait?.requestId === event.requestId) this.activeWait = null;
        if (this.visiblePromptRequestId === event.requestId) this.visiblePromptRequestId = null;
      }
    }
    if (typeof event.inputRequestId === "number" && ["question", "direction_question", "info_menu", "text_request", "position_request"].includes(event.type)) {
      this.visiblePromptRequestId = event.inputRequestId;
    }
    if (event.type === "input_wait") return;
    if (event.type === "command_result" || event.type === "input_consumed") return;
    if (event.type === "refresh_result" && typeof event.requestId === "number") {
      const result = event as RuntimeRefreshResult;
      this.refreshResults.set(result.requestId, result);
      if (result.complete) {
        const pending = this.pendingRefreshes.get(result.requestId);
        this.pendingRefreshes.delete(result.requestId);
        pending?.resolve(result);
      }
      if (result.complete && this.refreshResults.size > 256) {
        const oldest = this.refreshResults.keys().next().value;
        if (oldest !== undefined) this.refreshResults.delete(oldest);
      }
      return;
    }
    if (event.type === "position_input_state") this.positionSelectionActive = Boolean(event.active);
    this.onEvent(event);
  }

  private cancelledRefreshResult(
    requestId: number,
    cells: readonly RuntimeCell[],
  ): RuntimeRefreshResult {
    return {
      type: "refresh_result",
      requestId,
      complete: true,
      cells: cells.map(cell => ({ ...cell, status: "cancelled" as const })),
    };
  }

  private cancelPendingRefreshes(): void {
    for (const [requestId, pending] of this.pendingRefreshes) {
      pending.resolve(this.cancelledRefreshResult(requestId, pending.cells));
    }
    this.pendingRefreshes.clear();
  }

  private acceptsHandshake(protocol: RuntimeProtocolHandshake | undefined): protocol is RuntimeProtocolHandshake {
    const expectedRuntime = this.startupOptions?.runtimeVersion ?? "3.6.7";
    return Boolean(
      protocol &&
      protocol.protocolVersion === 1 &&
      protocol.sessionId === this.sessionId &&
      protocol.runtimeVersion === expectedRuntime &&
      protocol.pointerAbiValidated === true &&
      typeof protocol.pointerAbi === "string" &&
      protocol.pointerAbi.length > 0 &&
      protocol.mapDimensions &&
      protocol.mapDimensions.columns > 0 &&
      protocol.mapDimensions.rows > 0 &&
      protocol.capabilities?.orderedBatches === true &&
      protocol.capabilities?.refreshSets === true &&
      protocol.capabilities?.inputRequestIdentity === true,
    );
  }

  private postCommandWithOptionalDelay(
    command: RuntimeCommand,
    options: { delayMs?: number } = {},
  ): void {
    const delayMs = Number(options.delayMs);
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      this.postCommand(command);
      return;
    }
    globalThis.setTimeout(() => {
      this.postCommand(command);
    }, delayMs);
  }

  private isLikelyNameInputForDebug(input: string): boolean {
    const trimmed = String(input || "").trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      return false;
    }
    if (trimmed.startsWith("__") || trimmed.includes(":")) {
      return false;
    }
    return /^[A-Za-z][A-Za-z0-9 _'-]*$/.test(trimmed);
  }

  private isNormalRuntimeTerminationError(message: string): boolean {
    const normalized = String(message || "").toLowerCase();
    if (!normalized) {
      return false;
    }
    return (
      (normalized.includes("exitstatus") && normalized.includes("exit(0)")) ||
      normalized.includes("program terminated with exit(0)") ||
      normalized.includes("asyncify wakeup failed")
    );
  }

  private extractWorkerErrorMessage(error: unknown): string {
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object") {
      const candidate = error as {
        message?: unknown;
        error?: { message?: unknown } | unknown;
        type?: unknown;
        filename?: unknown;
        lineno?: unknown;
        colno?: unknown;
      };
      if (typeof candidate.message === "string" && candidate.message.trim()) {
        const details = this.buildWorkerErrorDetails(candidate);
        return details ? `${candidate.message} (${details})` : candidate.message;
      }
      if (
        candidate.error &&
        typeof candidate.error === "object" &&
        typeof (candidate.error as { message?: unknown }).message === "string"
      ) {
        const nestedMessage = String(
          (candidate.error as { message?: unknown }).message,
        );
        const details = this.buildWorkerErrorDetails(candidate);
        return details ? `${nestedMessage} (${details})` : nestedMessage;
      }
      const details = this.buildWorkerErrorDetails(candidate);
      if (details) {
        return details;
      }
    }
    return String(error ?? "");
  }

  private buildWorkerErrorDetails(candidate: {
    type?: unknown;
    filename?: unknown;
    lineno?: unknown;
    colno?: unknown;
  }): string {
    const details: string[] = [];
    if (typeof candidate.type === "string" && candidate.type.trim()) {
      details.push(`type=${candidate.type}`);
    }
    if (typeof candidate.filename === "string" && candidate.filename.trim()) {
      details.push(`file=${candidate.filename}`);
    }
    if (typeof candidate.lineno === "number" && Number.isFinite(candidate.lineno)) {
      details.push(`line=${candidate.lineno}`);
    }
    if (typeof candidate.colno === "number" && Number.isFinite(candidate.colno)) {
      details.push(`col=${candidate.colno}`);
    }
    return details.join(", ");
  }

  private handleWorkerMessage(message: RuntimeWorkerEnvelope): void {
    if (this.disposed) {
      return;
    }
    switch (message.type) {
      case "runtime_events":
        this.receiver.receive(message);
        break;
      case "runtime_ready":
        if (!this.acceptsHandshake(message.protocol)) {
          const error = new Error("Runtime protocol handshake is incompatible; restart the session.");
          this.protocolFailed = true;
          this.cancelPendingRefreshes();
          if (this.startReject) this.startReject(error);
          else this.onEvent({ type: "runtime_error", error: error.message });
          this.startResolve = null; this.startReject = null;
          break;
        }
        this.protocol = message.protocol;
        for (const command of this.beforeStart.splice(0)) this.postCommand(command);
        if (this.startResolve) {
          this.startResolve();
          this.startResolve = null;
          this.startReject = null;
        }
        break;
      case "runtime_error":
        if (!this.isNormalRuntimeTerminationError(message.error)) this.protocolFailed = true;
        this.cancelPendingRefreshes();
        if (this.startReject) {
          this.startReject(new Error(message.error));
          this.startResolve = null;
          this.startReject = null;
        } else {
          if (this.isNormalRuntimeTerminationError(message.error)) {
            this.onEvent({
              type: "runtime_terminated",
              reason: message.error,
              exitCode: 0,
            });
            break;
          }
          console.error("Runtime error:", message.error);
          this.onEvent({
            type: "runtime_error",
            error: message.error,
          });
        }
        break;
      case "runtime_event":
        this.deliverEvent(message.event as RuntimeEvent);
        break;
      case "runtime_console":
        recordDebugSessionLogEvent(
          message.source || "runtime.worker.console",
          Array.isArray(message.args) ? message.args : [message.args],
          message.level,
        );
        break;
      default:
        break;
    }
  }
}
