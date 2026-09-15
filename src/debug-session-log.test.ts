import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

async function fixture() {
  vi.resetModules();
  const storage = new Map<string, string>();
  const frames = new Map<number, FrameRequestCallback>();
  const handlers = new Map<string, (event?: unknown) => void>();
  let frameId = 0;
  const localStorage = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
  };
  vi.stubGlobal("window", {
    localStorage,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    addEventListener: (name: string, callback: (event?: unknown) => void) => handlers.set(name, callback),
  });
  const document = { visibilityState: "visible", addEventListener: (name: string, callback: () => void) => handlers.set(name, callback) };
  vi.stubGlobal("document", document);
  vi.stubGlobal("console", { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), assert: vi.fn() });
  const logs = await import("./debug-session-log");
  logs.enableDebugSessionLogCapture({ buildLabel: "performance-test" });
  logs.readDebugSessionLogs();
  localStorage.getItem.mockClear();
  localStorage.setItem.mockClear();
  const runFrame = () => {
    const scheduled = [...frames.values()];
    frames.clear();
    for (const callback of scheduled) callback(0);
  };
  return { logs, localStorage, frames, handlers, document, runFrame };
}

describe("debug log persistence", () => {
  it("persists a callback burst once, in order, and bounds the retained history", async () => {
    const f = await fixture();
    for (let i = 0; i < 400; i++) f.logs.recordDebugSessionLogEvent("runtime", `event ${i}`, "log");
    expect(f.localStorage.setItem).not.toHaveBeenCalled();
    expect(f.localStorage.getItem).not.toHaveBeenCalled();
    expect(f.frames.size).toBe(1);
    f.runFrame();
    expect(f.localStorage.getItem).toHaveBeenCalledTimes(1);
    expect(f.localStorage.setItem).toHaveBeenCalledTimes(1);
    const entries = f.logs.readDebugSessionLogs()[0].entries;
    expect(entries).toHaveLength(320);
    expect(entries[0].message).toBe("event 80");
    expect(entries[319].message).toBe("event 399");
  });

  it("flushes warnings, explicit reads, backgrounding and page exit synchronously", async () => {
    const f = await fixture();
    f.logs.recordDebugSessionLogEvent("runtime", "before warning", "log");
    f.logs.recordDebugSessionLogEvent("runtime", "warning", "warn");
    expect(f.localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(f.frames.size).toBe(0);
    f.logs.recordDebugSessionLogEvent("runtime", "read now", "log");
    const readEntries = f.logs.readDebugSessionLogs()[0].entries;
    expect(readEntries[readEntries.length - 1]?.message).toBe("read now");
    f.logs.recordDebugSessionLogEvent("runtime", "background", "log");
    f.document.visibilityState = "hidden";
    f.handlers.get("visibilitychange")!();
    expect(f.frames.size).toBe(0);
    f.logs.recordDebugSessionLogEvent("runtime", "exit", "log");
    f.handlers.get("pagehide")!({ persisted: false });
    const session = f.logs.readDebugSessionLogs()[0];
    expect(session.closeReason).toBe("pagehide");
    expect(session.entries[session.entries.length - 2]?.message).toBe("exit");
    expect(f.frames.size).toBe(0);
  });

  it("does not resurrect cleared entries in a later session", async () => {
    const f = await fixture();
    f.logs.recordDebugSessionLogEvent("runtime", "discarded", "log");
    f.logs.clearDebugSessionLogs();
    f.logs.enableDebugSessionLogCapture({ buildLabel: "new-session" });
    f.runFrame();
    const sessions = f.logs.readDebugSessionLogs();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].buildLabel).toBe("new-session");
    expect(sessions[0].entries.some(entry => entry.message === "discarded")).toBe(false);
  });
});
