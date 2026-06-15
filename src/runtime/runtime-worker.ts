import LocalNetHackRuntime from "./LocalNetHackRuntime";
import { setLoggingEnabled } from "../logging";
import type {
  RuntimeCommand,
  RuntimeEvent,
  RuntimeStartupOptions,
  RuntimeWorkerEnvelope,
} from "./types";

let runtime: LocalNetHackRuntime | null = null;
let started = false;
let terminationReported = false;
let asyncifyWakeUpTrapInstalled = false;
const mapGlyphBatchMaxSize = 384;
let pendingMapGlyphTilesByKey: Map<string, RuntimeEvent> = new Map();
let pendingMapGlyphTileOrder: string[] = [];
let mapGlyphFlushScheduled = false;
let workerConsoleMirrorsInstalled = false;

function isLikelyNameInputForDebug(input: string): boolean {
  const trimmed = String(input || "").trim();
  if (trimmed.length < 2 || trimmed.length > 30) {
    return false;
  }
  if (trimmed.startsWith("__") || trimmed.includes(":")) {
    return false;
  }
  return /^[A-Za-z][A-Za-z0-9 _'-]*$/.test(trimmed);
}

function postEnvelopeDirect(envelope: RuntimeWorkerEnvelope): void {
  (self as unknown as Worker).postMessage(envelope);
}

function installWorkerConsoleMirrors(): void {
  if (workerConsoleMirrorsInstalled || typeof console === "undefined") {
    return;
  }
  workerConsoleMirrorsInstalled = true;

  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalDebug = console.debug.bind(console);
  const originalTrace = console.trace.bind(console);
  const originalAssert = console.assert.bind(console);

  const mirror = (
    level: Extract<RuntimeWorkerEnvelope, { type: "runtime_console" }>["level"],
    source: string,
    args: unknown[],
  ): void => {
    try {
      postEnvelopeDirect({
        type: "runtime_console",
        level,
        source,
        args,
      });
    } catch {
      // Best effort only; keep the worker logging path intact.
    }
  };

  console.log = (...args: unknown[]): void => {
    mirror("log", "runtime.worker.console.log", args);
    originalLog(...args);
  };
  console.info = (...args: unknown[]): void => {
    mirror("info", "runtime.worker.console.info", args);
    originalInfo(...args);
  };
  console.warn = (...args: unknown[]): void => {
    mirror("warn", "runtime.worker.console.warn", args);
    originalWarn(...args);
  };
  console.error = (...args: unknown[]): void => {
    mirror("error", "runtime.worker.console.error", args);
    originalError(...args);
  };
  console.debug = (...args: unknown[]): void => {
    mirror("debug", "runtime.worker.console.debug", args);
    originalDebug(...args);
  };
  console.trace = (...args: unknown[]): void => {
    mirror("trace", "runtime.worker.console.trace", args);
    originalTrace(...args);
  };
  console.assert = (condition?: boolean, ...args: unknown[]): void => {
    if (!condition) {
      mirror("assert", "runtime.worker.console.assert", args);
    }
    originalAssert(condition, ...args);
  };
}

function schedulePendingMapGlyphFlush(): void {
  if (mapGlyphFlushScheduled) {
    return;
  }
  mapGlyphFlushScheduled = true;
  if (typeof queueMicrotask === "function") {
    queueMicrotask(() => {
      flushPendingMapGlyphEvents();
    });
    return;
  }
  Promise.resolve().then(() => {
    flushPendingMapGlyphEvents();
  });
}

function enqueuePendingMapGlyphTile(
  tile: RuntimeEvent,
  scheduleFlush: boolean = true,
): void {
  const candidate = tile as RuntimeEvent & { x?: unknown; y?: unknown };
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    flushPendingMapGlyphEvents();
    postEnvelopeDirect({
      type: "runtime_event",
      event: tile,
    });
    return;
  }

  const key = `${Math.trunc(x)},${Math.trunc(y)}`;
  if (!pendingMapGlyphTilesByKey.has(key)) {
    pendingMapGlyphTileOrder.push(key);
  }
  pendingMapGlyphTilesByKey.set(key, tile);

  if (scheduleFlush) {
    schedulePendingMapGlyphFlush();
  }
}

function flushPendingMapGlyphEvents(): void {
  mapGlyphFlushScheduled = false;
  if (pendingMapGlyphTileOrder.length <= 0) {
    return;
  }

  const orderedTiles: RuntimeEvent[] = [];
  for (const key of pendingMapGlyphTileOrder) {
    const tile = pendingMapGlyphTilesByKey.get(key);
    if (tile) {
      orderedTiles.push(tile);
    }
  }

  pendingMapGlyphTilesByKey.clear();
  pendingMapGlyphTileOrder = [];

  if (orderedTiles.length <= 0) {
    return;
  }
  if (orderedTiles.length === 1) {
    postEnvelopeDirect({
      type: "runtime_event",
      event: orderedTiles[0],
    });
    return;
  }

  for (let start = 0; start < orderedTiles.length; start += mapGlyphBatchMaxSize) {
    postEnvelopeDirect({
      type: "runtime_event",
      event: {
        type: "map_glyph_batch",
        tiles: orderedTiles.slice(start, start + mapGlyphBatchMaxSize),
      },
    });
  }
}

function tryBufferMapGlyphEnvelope(envelope: RuntimeWorkerEnvelope): boolean {
  if (envelope.type !== "runtime_event") {
    return false;
  }

  const event = envelope.event as RuntimeEvent & {
    type?: unknown;
    tiles?: unknown;
  };
  if (event.type === "map_glyph") {
    enqueuePendingMapGlyphTile(envelope.event);
    return true;
  }
  if (event.type !== "map_glyph_batch" || !Array.isArray(event.tiles)) {
    return false;
  }

  for (const tile of event.tiles) {
    if (!tile || typeof tile !== "object") {
      continue;
    }
    enqueuePendingMapGlyphTile(tile as RuntimeEvent, false);
  }
  schedulePendingMapGlyphFlush();
  return true;
}

function postEnvelope(envelope: RuntimeWorkerEnvelope): void {
  if (tryBufferMapGlyphEnvelope(envelope)) {
    return;
  }
  flushPendingMapGlyphEvents();

  // Intercept termination events to guarantee IndexedDB has finished saving
  // before the main UI thread is allowed to reload or close the game.
  if (
    envelope.type === "runtime_event" &&
    (envelope.event as RuntimeEvent).type === "runtime_terminated"
  ) {
    const finalize = () => {
      postEnvelopeDirect(envelope);
    };

    if (
      runtime &&
      (runtime as any).nethackModule &&
      (runtime as any).nethackModule.FS
    ) {
      try {
        console.log("Worker: syncing files to IndexedDB before terminating...");
        (runtime as any).nethackModule.FS.syncfs(false, (err: unknown) => {
          if (err) console.error("Worker IDBFS sync error:", err);
          else console.log("Worker: file sync complete.");
          finalize();
        });
        return;
      } catch (e) {
        console.error("Worker IDBFS sync exception:", e);
      }
    }
  }

  postEnvelopeDirect(envelope);
}

function getErrorStatus(errorLike: unknown): number | null {
  if (!errorLike || typeof errorLike !== "object") {
    return null;
  }
  const candidate = errorLike as { status?: unknown };
  if (
    typeof candidate.status === "number" &&
    Number.isFinite(candidate.status)
  ) {
    return candidate.status;
  }
  return null;
}

function extractErrorMessage(errorLike: unknown): string {
  if (typeof errorLike === "string") {
    return errorLike;
  }
  if (!errorLike || typeof errorLike !== "object") {
    return String(errorLike ?? "");
  }
  const candidate = errorLike as {
    message?: unknown;
    reason?: unknown;
    error?: { message?: unknown; reason?: unknown } | unknown;
  };
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }
  if (typeof candidate.reason === "string" && candidate.reason.trim()) {
    return candidate.reason;
  }
  if (candidate.error && typeof candidate.error === "object") {
    const inner = candidate.error as { message?: unknown; reason?: unknown };
    if (typeof inner.message === "string" && inner.message.trim()) {
      return inner.message;
    }
    if (typeof inner.reason === "string" && inner.reason.trim()) {
      return inner.reason;
    }
  }
  return String(errorLike);
}

function isNormalRuntimeTermination(
  message: string,
  status: number | null,
): boolean {
  if (status === 0) {
    return true;
  }
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

function reportTermination(reason: string, status: number | null = 0): void {
  if (terminationReported) {
    return;
  }
  terminationReported = true;
  postEnvelope({
    type: "runtime_event",
    event: {
      type: "runtime_terminated",
      reason: reason || "Program terminated with exit(0)",
      exitCode: status ?? 0,
    },
  });
}

function reportRuntimeError(errorMessage: string): void {
  postEnvelope({
    type: "runtime_error",
    error: errorMessage || "Runtime worker error",
  });
}

function installAsyncifyWakeUpTrap(): void {
  if (asyncifyWakeUpTrapInstalled) {
    return;
  }
  asyncifyWakeUpTrapInstalled = true;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const first = args[0];
      const second = args[1];
      const firstText = typeof first === "string" ? first.toLowerCase() : "";
      const secondText = extractErrorMessage(second).toLowerCase();
      const secondStatus = getErrorStatus(second);
      const isWakeUpFailure = firstText.includes("asyncify wakeup failed");
      if (
        isWakeUpFailure &&
        isNormalRuntimeTermination(secondText, secondStatus)
      ) {
        reportTermination(
          extractErrorMessage(second) || "Program terminated with exit(0)",
          secondStatus ?? 0,
        );
        return;
      }
    } catch {
      // Preserve original logging path even if the detector fails.
    }
    originalConsoleError(...args);
  };
}

function ensureRuntime(
  startupOptions?: RuntimeStartupOptions,
): LocalNetHackRuntime {
  if (!runtime) {
    installAsyncifyWakeUpTrap();
    runtime = new LocalNetHackRuntime(
      (event: RuntimeEvent) => {
        postEnvelope({ type: "runtime_event", event });
      },
      (startupOptions ?? null) as any,
    );
  }
  return runtime;
}

self.addEventListener("error", (event: ErrorEvent) => {
  const rawError = (event as unknown as { error?: unknown }).error;
  const status = getErrorStatus(rawError);
  const message = extractErrorMessage(rawError ?? event.message);
  if (isNormalRuntimeTermination(message, status)) {
    reportTermination(message, status ?? 0);
    event.preventDefault();
    return;
  }
  const stack =
    rawError && typeof (rawError as any).stack === "string"
      ? (rawError as any).stack
      : "";
  // eslint-disable-next-line no-console
  console.error("[WORKER_ERROR_EVENT]", message, stack || "(no stack)");
  reportRuntimeError(stack ? `${message}\n${stack}` : message);
});

self.addEventListener("unhandledrejection", (event: any) => {
  const status = getErrorStatus(event.reason);
  const message = extractErrorMessage(event.reason);
  if (isNormalRuntimeTermination(message, status)) {
    reportTermination(message, status ?? 0);
    event.preventDefault();
    return;
  }
  const stack =
    event.reason && typeof event.reason.stack === "string"
      ? event.reason.stack
      : "";
  // eslint-disable-next-line no-console
  console.error("[WORKER_UNHANDLED_REJECTION]", message, stack || "(no stack)");
  reportRuntimeError(stack ? `${message}\n${stack}` : message);
});

self.onmessage = async (message: MessageEvent<RuntimeCommand>) => {
  try {
    installWorkerConsoleMirrors();
    const command = message.data;

    switch (command.type) {
      case "start":
        setLoggingEnabled(Boolean(command.startupOptions?.loggingEnabled));
        const startInstance = ensureRuntime(command.startupOptions);
        if (!started) {
          await startInstance.start();
          started = true;
        }
        postEnvelope({ type: "runtime_ready" });
        return;
      case "send_input":
        if (isLikelyNameInputForDebug(command.input)) {
          console.log("[NAME_DEBUG] Worker received send_input(name-like)", {
            input: command.input,
          });
        }
        ensureRuntime().sendInput(command.input);
        return;
      case "send_input_sequence":
        ensureRuntime().sendInputSequence(command.inputs);
        return;
      case "send_mouse_input":
        ensureRuntime().sendMouseInput(command.x, command.y, command.button);
        return;
      case "request_tile_update":
        ensureRuntime().requestTileUpdate(command.x, command.y);
        return;
      case "request_area_update":
        ensureRuntime().requestAreaUpdate(
          command.centerX,
          command.centerY,
          command.radius,
        );
        return;
      case "request_runtime_globals_snapshot":
        ensureRuntime().requestRuntimeGlobalsSnapshot();
        return;
      case "set_logging":
        setLoggingEnabled(Boolean(command.enabled));
        return;
      case "shutdown":
        if (runtime) {
          try {
            runtime.shutdown("runtime bridge dispose");
          } catch (error) {
            console.warn("Runtime shutdown hook error:", error);
          }
          const moduleFs =
            (runtime as any).nethackModule &&
            (runtime as any).nethackModule.FS;
          if (moduleFs && typeof moduleFs.syncfs === "function") {
            try {
              await new Promise<void>((resolve) => {
                moduleFs.syncfs(false, (err: unknown) => {
                  if (err) {
                    console.warn("Worker shutdown IDBFS sync error:", err);
                  }
                  resolve();
                });
              });
            } catch (error) {
              console.warn("Worker shutdown IDBFS sync exception:", error);
            }
          }
        }
        runtime = null;
        started = false;
        terminationReported = false;
        return;
      default:
        return;
    }
  } catch (error) {
    const status = getErrorStatus(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (isNormalRuntimeTermination(errorMessage, status)) {
      reportTermination(errorMessage, status ?? 0);
      return;
    }
    reportRuntimeError(errorMessage);
  }
};
