import type {
  RuntimeBridge,
  RuntimeCommand,
  RuntimeEvent,
  RuntimeEventHandler,
  RuntimeStartupOptions,
  RuntimeWorkerEnvelope,
} from "./types";

export default class WorkerRuntimeBridge implements RuntimeBridge {
  private readonly worker: Worker;
  private readonly onEvent: RuntimeEventHandler;
  private readonly startupOptions: RuntimeStartupOptions | undefined;
  private startPromise: Promise<void> | null = null;
  private startResolve: (() => void) | null = null;
  private startReject: ((reason?: unknown) => void) | null = null;

  constructor(
    onEvent: RuntimeEventHandler,
    startupOptions?: RuntimeStartupOptions,
  ) {
    this.onEvent = onEvent;
    this.startupOptions = startupOptions;
    this.worker = new Worker(new URL("./runtime-worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (message: MessageEvent<RuntimeWorkerEnvelope>) => {
      this.handleWorkerMessage(message.data);
    };
    this.worker.onerror = (error) => {
      const errorMessage = this.extractWorkerErrorMessage(error);
      const startupErrorMessage = errorMessage || "Runtime worker failed to load";
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
      const message = this.extractWorkerErrorMessage(event);
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
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = new Promise<void>((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;
      this.postCommand({ type: "start", startupOptions: this.startupOptions });
    });

    return this.startPromise;
  }

  sendInput(input: string, options: { delayMs?: number } = {}): void {
    if (this.isLikelyNameInputForDebug(input)) {
      const stackPreview = (new Error().stack || "")
        .split("\n")
        .slice(2, 7)
        .map((line) => line.trim());
      console.log("[NAME_DEBUG] Bridge sendInput(name-like)", {
        input,
        stackPreview,
      });
    }
    this.postCommandWithOptionalDelay({ type: "send_input", input }, options);
  }

  sendInputSequence(
    inputs: string[],
    options: { delayMs?: number } = {},
  ): void {
    this.postCommandWithOptionalDelay(
      { type: "send_input_sequence", inputs },
      options,
    );
  }

  sendMouseInput(x: number, y: number, button: number): void {
    this.postCommand({ type: "send_mouse_input", x, y, button });
  }

  requestTileUpdate(x: number, y: number): void {
    this.postCommand({ type: "request_tile_update", x, y });
  }

  requestAreaUpdate(centerX: number, centerY: number, radius: number): void {
    this.postCommand({
      type: "request_area_update",
      centerX,
      centerY,
      radius,
    });
  }

  setLoggingEnabled(enabled: boolean): void {
    this.postCommand({ type: "set_logging", enabled: Boolean(enabled) });
  }

  destroy(): void {
    this.startResolve = null;
    this.startReject = null;
    this.startPromise = null;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
  }

  private postCommand(command: RuntimeCommand): void {
    this.worker.postMessage(command);
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
    switch (message.type) {
      case "runtime_ready":
        if (this.startResolve) {
          this.startResolve();
          this.startResolve = null;
          this.startReject = null;
        }
        break;
      case "runtime_error":
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
        this.onEvent(message.event as RuntimeEvent);
        break;
      default:
        break;
    }
  }
}
