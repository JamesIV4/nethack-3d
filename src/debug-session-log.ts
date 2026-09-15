type DebugSessionLogLevel =
  | "log"
  | "info"
  | "warn"
  | "error"
  | "debug"
  | "trace"
  | "assert"
  | "event";

type DebugSessionLogCloseReason =
  | "active"
  | "pagehide"
  | "beforeunload"
  | "manual-stop"
  | "superseded"
  | "abrupt-stop";

export type DebugSessionLogEntry = {
  id: string;
  timestamp: string;
  level: DebugSessionLogLevel;
  source: string;
  message: string;
};

export type DebugSessionLogSession = {
  id: string;
  startedAt: string;
  lastUpdatedAt: string;
  endedAt: string | null;
  closeReason: DebugSessionLogCloseReason;
  buildLabel: string;
  locationHref: string;
  userAgent: string;
  entries: DebugSessionLogEntry[];
};

type PersistedDebugSessionLogState = {
  version: 1;
  sessions: DebugSessionLogSession[];
};

type DebugSessionLogOptions = {
  buildLabel?: string;
};

type NH3DGlobalScope = typeof globalThis & {
  __NH3D_DEBUG_SESSION_LOG_HOOK__?: (
    level: DebugSessionLogLevel,
    args: unknown[],
    source?: string,
  ) => void;
};

const globalScope = globalThis as NH3DGlobalScope;
const debugSessionLogStorageKey = "nh3d:debug-session-logs:v1";
const maxPersistedDebugSessions = 6;
const maxEntriesPerDebugSession = 320;
const maxMessageLength = 900;

let activeSessionId: string | null = null;
let listenersInstalled = false;
let consoleMirrorsInstalled = false;
let consoleLogOriginal: typeof console.log | null = null;
let consoleInfoOriginal: typeof console.info | null = null;
let consoleWarnOriginal: typeof console.warn | null = null;
let consoleErrorOriginal: typeof console.error | null = null;
let consoleDebugOriginal: typeof console.debug | null = null;
let consoleTraceOriginal: typeof console.trace | null = null;
let consoleAssertOriginal: typeof console.assert | null = null;
let pendingEntries: DebugSessionLogEntry[] = [];
let persistFrameId: number | null = null;

function cancelPendingPersistence(): void {
  if (persistFrameId !== null) {
    window.cancelAnimationFrame(persistFrameId);
    persistFrameId = null;
  }
}

function flushPendingEntries(): void {
  cancelPendingPersistence();
  if (!activeSessionId || pendingEntries.length === 0) return;
  const batch = pendingEntries;
  pendingEntries = [];
  updateSessions((sessions) => sessions.map((session) => {
    if (session.id !== activeSessionId) return session;
    return {
      ...session,
      lastUpdatedAt: batch[batch.length - 1].timestamp,
      entries: [...session.entries, ...batch].slice(-maxEntriesPerDebugSession),
    };
  }));
}

function schedulePendingPersistence(): void {
  if (persistFrameId !== null) return;
  if (typeof window.requestAnimationFrame !== "function") {
    flushPendingEntries();
    return;
  }
  persistFrameId = window.requestAnimationFrame(() => {
    persistFrameId = null;
    flushPendingEntries();
  });
}

function canUseBrowserStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function"
  );
}

function createEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readPersistedState(): PersistedDebugSessionLogState {
  if (!canUseBrowserStorage()) {
    return {
      version: 1,
      sessions: [],
    };
  }
  try {
    const raw = window.localStorage.getItem(debugSessionLogStorageKey);
    if (!raw) {
      return {
        version: 1,
        sessions: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedDebugSessionLogState>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      return {
        version: 1,
        sessions: [],
      };
    }
    return {
      version: 1,
      sessions: parsed.sessions.filter(
        (session): session is DebugSessionLogSession =>
          Boolean(
            session &&
              typeof session === "object" &&
              typeof session.id === "string" &&
              Array.isArray(session.entries),
          ),
      ),
    };
  } catch {
    return {
      version: 1,
      sessions: [],
    };
  }
}

function writePersistedState(state: PersistedDebugSessionLogState): void {
  if (!canUseBrowserStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(debugSessionLogStorageKey, JSON.stringify(state));
  } catch {
    // Best effort only. Avoid throwing during logging paths.
  }
}

function normalizeMessagePart(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): string {
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (typeof Event !== "undefined" && value instanceof Event) {
    const targetTag =
      value.target &&
      typeof (value.target as Element).nodeName === "string"
        ? (value.target as Element).nodeName.toLowerCase()
        : "unknown";
    return `[Event ${value.type} target=${targetTag}]`;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(
        value,
        (_key, nestedValue) => {
          if (
            typeof nestedValue === "object" &&
            nestedValue !== null
          ) {
            if (seen.has(nestedValue)) {
              return "[Circular]";
            }
            seen.add(nestedValue);
          }
          if (nestedValue instanceof Error) {
            return {
              name: nestedValue.name,
              message: nestedValue.message,
              stack: nestedValue.stack,
            };
          }
          if (typeof nestedValue === "function") {
            return `[Function ${nestedValue.name || "anonymous"}]`;
          }
          return nestedValue;
        },
        0,
      );
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}

function normalizeMessage(args: unknown[]): string {
  const raw = args
    .map((part) => normalizeMessagePart(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) {
    return "(empty)";
  }
  return raw.length > maxMessageLength
    ? `${raw.slice(0, maxMessageLength)}...`
    : raw;
}

function updateSessions(
  updater: (sessions: DebugSessionLogSession[]) => DebugSessionLogSession[],
): DebugSessionLogSession[] {
  const current = readPersistedState();
  const nextSessions = updater([...current.sessions]).slice(
    0,
    maxPersistedDebugSessions,
  );
  writePersistedState({
    version: 1,
    sessions: nextSessions,
  });
  return nextSessions;
}

function closeActiveSession(reason: Exclude<DebugSessionLogCloseReason, "active">): void {
  if (!activeSessionId) {
    return;
  }
  flushPendingEntries();
  const now = new Date().toISOString();
  updateSessions((sessions) =>
    sessions.map((session) =>
      session.id === activeSessionId
        ? {
            ...session,
            lastUpdatedAt: now,
            endedAt: now,
            closeReason: reason,
          }
        : session,
    ),
  );
  activeSessionId = null;
}

function markDanglingSessionsAsAbruptStop(): void {
  const now = new Date().toISOString();
  updateSessions((sessions) =>
    sessions.map((session) =>
      session.endedAt === null || session.closeReason === "active"
        ? {
            ...session,
            lastUpdatedAt: now,
            endedAt: now,
            closeReason: "abrupt-stop",
          }
        : session,
    ),
  );
}

function appendEntry(
  level: DebugSessionLogLevel,
  source: string,
  args: unknown[],
): void {
  if (!activeSessionId) {
    return;
  }
  const now = new Date().toISOString();
  const entry: DebugSessionLogEntry = {
    id: createEntryId(),
    timestamp: now,
    level,
    source: source || "app",
    message: normalizeMessage(args),
  };
  pendingEntries.push(entry);
  if (pendingEntries.length > maxEntriesPerDebugSession) pendingEntries.shift();
  // Logging bursts must not parse/stringify all saved sessions and block on
  // localStorage for every callback. Errors stay durable immediately; normal
  // logs flush once per frame, and before reads or page lifecycle boundaries.
  if (level === "error" || level === "warn" || level === "assert") {
    flushPendingEntries();
  } else {
    schedulePendingPersistence();
  }
}

function handleWindowError(event: ErrorEvent): void {
  appendEntry(
    "error",
    "window.onerror",
    [
      event.message || "Unhandled window error",
      event.filename ? `@ ${event.filename}:${event.lineno}:${event.colno}` : "",
      event.error instanceof Error ? event.error : null,
    ].filter(Boolean),
  );
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  appendEntry("error", "window.unhandledrejection", [event.reason]);
}

function handleVisibilityChange(): void {
  appendEntry("event", "document.visibilitychange", [
    `visibilityState=${document.visibilityState}`,
  ]);
  if (document.visibilityState === "hidden") flushPendingEntries();
}

function handlePageHide(event: PageTransitionEvent): void {
  appendEntry("event", "window.pagehide", [`persisted=${Boolean(event.persisted)}`]);
  closeActiveSession("pagehide");
}

function handleBeforeUnload(): void {
  appendEntry("event", "window.beforeunload", ["beforeunload"]);
  closeActiveSession("beforeunload");
}

function installListeners(): void {
  if (listenersInstalled || typeof window === "undefined") {
    return;
  }
  window.addEventListener("error", handleWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("beforeunload", handleBeforeUnload);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  listenersInstalled = true;
}

function installConsoleMirrors(): void {
  if (consoleMirrorsInstalled || typeof console === "undefined") {
    return;
  }
  consoleLogOriginal = console.log.bind(console);
  consoleInfoOriginal = console.info.bind(console);
  consoleWarnOriginal = console.warn.bind(console);
  consoleErrorOriginal = console.error.bind(console);
  consoleDebugOriginal = console.debug.bind(console);
  consoleTraceOriginal = console.trace.bind(console);
  consoleAssertOriginal = console.assert.bind(console);

  console.log = (...args: unknown[]): void => {
    appendEntry("log", "console.log", args);
    consoleLogOriginal?.(...args);
  };
  console.info = (...args: unknown[]): void => {
    appendEntry("info", "console.info", args);
    consoleInfoOriginal?.(...args);
  };
  console.warn = (...args: unknown[]): void => {
    appendEntry("warn", "console.warn", args);
    consoleWarnOriginal?.(...args);
  };
  console.error = (...args: unknown[]): void => {
    appendEntry("error", "console.error", args);
    consoleErrorOriginal?.(...args);
  };
  console.debug = (...args: unknown[]): void => {
    appendEntry("debug", "console.debug", args);
    consoleDebugOriginal?.(...args);
  };
  console.trace = (...args: unknown[]): void => {
    appendEntry("trace", "console.trace", args);
    consoleTraceOriginal?.(...args);
  };
  console.assert = (condition?: boolean, ...args: unknown[]): void => {
    if (!condition) {
      appendEntry("assert", "console.assert", args);
    }
    consoleAssertOriginal?.(condition, ...args);
  };

  globalScope.__NH3D_DEBUG_SESSION_LOG_HOOK__ = (
    level: DebugSessionLogLevel,
    args: unknown[],
    source = "logWithOriginal",
  ): void => {
    appendEntry(level, source, args);
  };

  consoleMirrorsInstalled = true;
}

export function enableDebugSessionLogCapture(
  options: DebugSessionLogOptions = {},
): void {
  if (!canUseBrowserStorage()) {
    return;
  }
  if (activeSessionId) {
    return;
  }
  markDanglingSessionsAsAbruptStop();
  installListeners();
  installConsoleMirrors();
  const now = new Date().toISOString();
  const sessionId = createEntryId();
  const buildLabel =
    typeof options.buildLabel === "string" && options.buildLabel.trim()
      ? options.buildLabel.trim()
      : "unknown";
  const locationHref =
    typeof globalThis.location?.href === "string" ? globalThis.location.href : "";
  const userAgent =
    typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
      ? navigator.userAgent
      : "";
  updateSessions((sessions) => [
    {
      id: sessionId,
      startedAt: now,
      lastUpdatedAt: now,
      endedAt: null,
      closeReason: "active",
      buildLabel,
      locationHref,
      userAgent,
      entries: [],
    },
    ...sessions.map((session) =>
      session.endedAt === null || session.closeReason === "active"
        ? {
            ...session,
            lastUpdatedAt: now,
            endedAt: now,
            closeReason: "superseded" as const,
          }
        : session,
    ),
  ]);
  activeSessionId = sessionId;
  appendEntry("event", "debug-session-log", [
    `Session started for ${buildLabel}`,
  ]);
}

export function readDebugSessionLogs(): DebugSessionLogSession[] {
  flushPendingEntries();
  if (!activeSessionId) {
    markDanglingSessionsAsAbruptStop();
  }
  return readPersistedState().sessions;
}

export function clearDebugSessionLogs(): void {
  if (!canUseBrowserStorage()) {
    return;
  }
  cancelPendingPersistence();
  pendingEntries = [];
  try {
    window.localStorage.removeItem(debugSessionLogStorageKey);
  } catch {
    // Ignore best-effort cleanup errors.
  }
  activeSessionId = null;
}

export function recordDebugSessionLogEvent(
  source: string,
  payload: unknown,
  level: DebugSessionLogLevel = "event",
): void {
  appendEntry(level, source, Array.isArray(payload) ? payload : [payload]);
}

export function formatDebugSessionLogSession(
  session: DebugSessionLogSession,
): string {
  const headerLines = [
    `Session: ${session.id}`,
    `Build: ${session.buildLabel || "unknown"}`,
    `Started: ${session.startedAt}`,
    `Last Updated: ${session.lastUpdatedAt}`,
    `Ended: ${session.endedAt || "(not recorded)"}`,
    `Close Reason: ${session.closeReason}`,
    `Location: ${session.locationHref || "(unknown)"}`,
    `User Agent: ${session.userAgent || "(unknown)"}`,
    "",
  ];
  const entryLines = session.entries.map(
    (entry) =>
      `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`,
  );
  return [...headerLines, ...entryLines].join("\n");
}
