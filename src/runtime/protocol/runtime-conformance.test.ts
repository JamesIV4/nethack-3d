import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../LocalNetHackRuntime";
import type { NethackRuntimeVersion, RuntimeEvent } from "../types";
import { RuntimeBootstrap } from "../local/startup/bootstrap";
import type { RuntimeSystems } from "../local/create-runtime-systems";

const protocolEvents = new Set(["input_wait", "input_consumed", "command_result", "runtime_boundary", "refresh_result"]);
const runtimes: LocalNetHackRuntime[] = [];
beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.shutdown("conformance test");
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

function fixture(version: NethackRuntimeVersion, protocol: boolean) {
  const events: RuntimeEvent[] = [];
  const runtime = new LocalNetHackRuntime(event => events.push(structuredClone(event)), {
    runtimeVersion: version, ...(protocol ? { protocolVersion: 1 as const } : {}),
  });
  runtimes.push(runtime); runtime.runtimeVersion = version;
  const systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
  const heap = new Uint8Array(4096), view = new DataView(heap.buffer);
  runtime.nethackModule = {
    HEAPU8: heap, _malloc: () => 1024, _free() {},
    getValue: (ptr: number, type: string) => type === "i8" ? view.getInt8(ptr) : view.getInt32(ptr, true),
    setValue: (ptr: number, value: number, type: string) => type === "i8" ? view.setInt8(ptr, value) : view.setInt32(ptr, value, true),
    UTF8ToString: (ptr: number) => `value-${ptr}`,
  };
  const glyphInfo = { ch: 46, color: 7, tileidx: 12, glyphflags: 0, symidx: 19 };
  vi.stubGlobal("nethackGlobal", { globals: { u: { uz: { dnum: 0, dlevel: 1 } } },
    helpers: { mapglyphHelper: () => glyphInfo, mapGlyphInfoHelper: () => glyphInfo },
  });
  vi.spyOn(systems.memory, "decodeGlyphInfoPointer").mockImplementation(pointer => ({
    pointer, glyph: 100, ttychar: 46, color: 7, tileIndex: 12, symidx: 19, glyphFlags: 0,
  }));
  const waitId = () => {
    const waits = events.filter(e => e.type === "input_wait" && e.state === "waiting");
    return Number(waits[waits.length - 1]?.requestId);
  };
  let command = 0;
  const answer = (input: string, requestId = waitId()) => runtime.sendInput(input, protocol ? {
    sessionId: "test", commandId: ++command, lastProcessedSequence: 0, requestId,
  } : undefined);
  const readText = () => new TextDecoder().decode(heap.slice(64, heap.indexOf(0, 64)));
  return { runtime, systems, events, waitId, answer, readText };
}

function withoutProtocol(events: RuntimeEvent[]): RuntimeEvent[] {
  return events.filter(event => !protocolEvents.has(event.type)).map(event => {
    const copy = structuredClone(event);
    const scrub = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if (!Array.isArray(value)) {
        delete (value as Record<string, unknown>).timestamp;
        delete (value as Record<string, unknown>).capturedAtMs;
      }
      for (const nested of Object.values(value)) scrub(nested);
    };
    scrub(copy);
    delete copy.inputRequestId;
    return copy;
  });
}

describe.each(["3.6.7", "5.0", "slashem"] as const)("%s shared protocol conformance", version => {
  it("keeps bulk map refreshes separate from explicit under-player refreshes", () => {
    const f = fixture(version, true), topItemGlyphUnderPlayer = vi.fn(() => -1);
    const decode = () => ({ ch: 46, color: 7, tileidx: 12 });
    vi.stubGlobal("nethackGlobal", { helpers: { glyphAtHelper: () => 100, mapglyphHelper: decode, mapGlyphInfoHelper: decode, topItemGlyphUnderPlayer } });
    f.systems.mapCallbacks.playerPosition = { x: 4, y: 5 };
    f.runtime.requestCells(1, [{ x: 4, y: 5 }], f.runtime.protocol.scope);
    expect(topItemGlyphUnderPlayer).not.toHaveBeenCalled();
    expect(f.events.some(event => event.type === "under_player_item_glyph_cleared")).toBe(false);
    f.runtime.requestCells(2, [{ x: 4, y: 5 }], f.runtime.protocol.scope, true);
    expect(topItemGlyphUnderPlayer).toHaveBeenCalledOnce();
  });
  it("does not mistake out-of-map native room sentinels for visible floor data", () => {
    const f = fixture(version, true), glyphAtHelper = vi.fn(() => 100);
    vi.stubGlobal("nethackGlobal", { helpers: { glyphAtHelper } });
    expect(f.systems.tileRefresh.handleTileUpdateRequest(80, 1)).toBe("unavailable");
    expect(f.systems.tileRefresh.handleTileUpdateRequest(1, 21)).toBe("unavailable");
    expect(glyphAtHelper).not.toHaveBeenCalled();
    expect(f.events.filter(event => event.type === "map_glyph")).toEqual([]);
  });
  it("reports uninitialized startup levels as unknown without decoding dungeon metadata", () => {
    const f = fixture(version, true), readDungeonMetadata = vi.fn(() => { throw new Error("not initialized"); });
    const globals = { u: { uz: { dnum: 0, dlevel: 0 } } };
    Object.defineProperty(globals, "dungeons", { get: readDungeonMetadata });
    vi.stubGlobal("nethackGlobal", { globals });
    f.runtime.emit({ type: "name_request" });
    expect(f.runtime.protocol.scope.level).toBeNull();
    globals.u.uz.dlevel = 1;
    f.runtime.emit({ type: "map_cursor", x: 1, y: 1 });
    expect(f.runtime.protocol.scope.level).toEqual({ dnum: 0, dlevel: 1 });
    expect(readDungeonMetadata).not.toHaveBeenCalled();
  });
  it("preserves map/status/position, prompt cancellation and reconnect observation order", async () => {
    async function run(protocol: boolean) {
      const f = fixture(version, protocol);
      const mapWindow = f.systems.windows.getRuntimeWindowId("WIN_MAP");
      const args = version === "5.0" ? [mapWindow, 4, 5, 128, 192, -1, -1]
        : version === "slashem" ? [mapWindow, 4, 5, 100, -1, -1] : [mapWindow, 4, 5, 100, 0, -1, -1];
      expect(f.runtime.handleUICallback("shim_print_glyph", args)).toBe(0);
      f.runtime.handleUICallback("shim_cliparound", [4, 5]);
      f.runtime.handleUICallback("shim_curs", [mapWindow, 4, 5]);
      f.runtime.handleUICallback("shim_status_update", [7, 40, 0, 0, 0, 0]);
      f.runtime.handleUICallback("shim_status_update", [2, 80, 0, 0, 0, 0]);
      f.runtime.handleUICallback("shim_status_update", [-1, 0, 0, 0, 0, 0]);
      const question = f.runtime.handleUICallback("shim_yn_function", ["Continue?", "yn", 110]);
      f.answer("y"); expect(await question).toBe(121);
      const direction = f.runtime.handleUICallback("shim_yn_function", ["In what direction?", "", 0]);
      f.answer("Escape"); expect(await direction).toBe(27);
      const text = f.runtime.handleUICallback("shim_getlin", ["What do you want to write?", 64]);
      f.answer("__TEXT_INPUT__:Elbereth"); await text; expect(f.readText()).toBe("Elbereth");
      f.systems.globalSnapshots.sendReconnectSnapshot();
      const normalized = withoutProtocol(f.events);
      expect(normalized.some(event => event.type === "map_glyph")).toBe(true);
      expect(normalized.some(event => event.type === "status_update")).toBe(true);
      expect(normalized.some(event => event.type === "text_request")).toBe(true);
      return normalized;
    }
    expect(await run(true)).toEqual(await run(false));
  });

  it("rejects a late text answer without consuming the next prompt", async () => {
    const f = fixture(version, true);
    const first = f.runtime.handleUICallback("shim_getlin", ["Name the wand", 64]), oldId = f.waitId();
    f.answer("__TEXT_INPUT__:first", oldId); await first;
    const second = f.runtime.handleUICallback("shim_getlin", ["Name the potion", 64]), currentId = f.waitId();
    const pending = f.systems.textInput.pendingTextRequest;
    expect(currentId).not.toBe(oldId);
    f.answer("__TEXT_INPUT__:stale", oldId);
    expect(f.systems.textInput.pendingTextRequest).toBe(pending);
    expect(f.events).toContainEqual(expect.objectContaining({ type: "command_result", requestId: oldId, status: "rejected" }));
    f.answer("__TEXT_INPUT__:current", currentId); await second;
    expect(f.readText()).toBe("current");
  });
});
