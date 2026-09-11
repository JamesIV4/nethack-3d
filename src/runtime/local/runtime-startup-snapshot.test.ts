import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../LocalNetHackRuntime";
import { RuntimeBootstrap } from "./startup/bootstrap";
import type { RuntimeSystems } from "./create-runtime-systems";

const initializeNetHack = RuntimeBootstrap.prototype.initializeNetHack;
let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
let events: any[];

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("nethackGlobal", undefined);
  vi.stubGlobal("nethackCallback", undefined);
  events = [];
  runtime = new LocalNetHackRuntime(event => events.push(event));
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("assembled startup and snapshot contracts", () => {
  it("keeps character tokens ahead of startup tokens and applies shim windowtype first in NetHack's reverse parse order", () => {
    runtime.startupOptions = {
      characterCreation: { mode: "random", name: " Alice,  Rogue " },
      initOptions: ["checkpoint", "extmenu"],
    };
    const result = systems.startupOptions.buildRuntimeModuleStartupOptions("3.6.7");
    expect(result.runtimeOptions).toContain("name:Alice Rogue");
    expect(result.runtimeOptions.indexOf("name:Alice Rogue")).toBeLessThan(result.runtimeOptions.indexOf("extmenu"));
    expect(result.runtimeOptions[result.runtimeOptions.length - 1]).toBe("windowtype:shim");
    expect(result.checkpointStartupOptionEnabled).toBe(true);
  });

  it("resumes by name alone without introducing character creation choices", () => {
    runtime.startupOptions = {
      characterCreation: { mode: "resume", name: "Returning Hero", role: "wizard", race: "human", gender: "female", align: "neutral" },
    };
    expect(systems.startupOptions.buildCharacterCreationRuntimeOptions()).toEqual(["name:Returning Hero"]);
  });

  it("resolves packaged worker assets from dist and does not add build tags to file URLs", () => {
    vi.stubEnv("BASE_URL", "./");
    vi.stubGlobal("location", { href: "file:///C:/Game/dist/assets/runtime-worker.js" });
    vi.spyOn(systems.assets, "readRuntimeBuildTag").mockReturnValue("build-42");
    expect(systems.assets.resolveWasmAssetUrl("/nethack-5.wasm", "5.0")).toBe("file:///C:/Game/dist/nethack-5.wasm");
  });

  it("retains HTTP deployment base paths and per-runtime module/wasm names", () => {
    vi.stubEnv("BASE_URL", "/play/");
    vi.stubGlobal("location", { href: "https://example.test/play/assets/runtime-worker.js" });
    vi.spyOn(systems.assets, "readRuntimeBuildTag").mockReturnValue("build-42");
    expect(systems.assets.resolveWasmAssetUrl("slashem.wasm", "slashem")).toBe("https://example.test/play/slashem.wasm?nh3d_rt=build-42");
    expect((["3.6.7", "5.0", "slashem"] as const).map(version => [
      systems.assets.getRuntimeModuleAssetPath(version), systems.assets.getRuntimeWasmAssetPath(version),
    ])).toEqual([["nethack-367.js", "nethack-367.wasm"], ["nethack-5.js", "nethack-5.wasm"], ["slashem.js", "slashem.wasm"]]);
  });

  it("waits for hydration before callback registration/main and preserves module method receivers", async () => {
    const order: string[] = [];
    let hydrate: (() => void) | undefined;
    const module = {
      ENV: {},
      __nh3dHydrateRootPersistence(callback: () => void) {
        expect(this).toBe(module);
        order.push("hydrate");
        hydrate = callback;
      },
      cwrap(name: string) {
        expect(this).toBe(module);
        expect(name).toBe("shim_graphics_set_callback");
        order.push("bind");
        return (callback: string) => { order.push(callback); };
      },
      _malloc(size: number) { expect(this).toBe(module); return size === 8 ? 128 : 64; },
      stringToUTF8() { expect(this).toBe(module); },
      setValue() { expect(this).toBe(module); },
      _main(argc: number, argv: number) {
        expect(this).toBe(module);
        expect([argc, argv]).toEqual([1, 128]);
        order.push("main");
        return 0;
      },
    };
    vi.spyOn(systems.recovery, "updateCheckpointRecoverySupport").mockImplementation(() => { order.push("recovery"); });
    vi.spyOn(systems.recovery, "queueCheckpointAutosaveResumeBeforeStartup").mockImplementation(() => { order.push("resume"); });
    vi.spyOn(systems.pointerContract, "validateRuntimePointerContract").mockImplementation(() => { order.push("abi"); return true; });
    vi.spyOn(systems.startupDiagnostics, "scheduleStartupNoCallbackDiagnostic").mockImplementation(() => { order.push("diagnostic"); });
    vi.spyOn(systems.assets, "loadRuntimeFactory").mockResolvedValue(async (options: any) => {
      expect(options.noInitialRun).toBe(true);
      options.preInit[0](module);
      options.preRun[0](module);
      options.onRuntimeInitialized();
      options.postRun[0](module);
      return module;
    });
    const ready = initializeNetHack.call(systems.bootstrap);
    await vi.waitFor(() => expect(hydrate).toBeTypeOf("function"));
    expect(runtime.nethackInstance).toBe(module);
    expect(runtime.nethackModule).toBe(module);
    expect(order).toEqual(["recovery", "hydrate"]);
    hydrate!();
    await ready;
    expect(order).toEqual(["recovery", "hydrate", "bind", "nethackCallback", "abi", "resume", "main", "diagnostic"]);
  });

  it("replays scene, commands, map chunks, player, status, cloned inventory and the last thirty messages in order", () => {
    systems.extendedCommandCatalog.extendedCommandEntries = [{ name: "pray" }];
    for (let index = 0; index < 1001; index++) systems.mapCallbacks.gameMap.set(`${index},0`, { x: index, y: 0 });
    systems.mapCallbacks.playerPosition = { x: 9, y: 4 };
    systems.status.latestStatusUpdates.set(7, { type: "status_update", field: 7, value: "first" });
    systems.status.latestStatusUpdates.set(2, { type: "status_update", field: 2, value: "second" });
    const item = { menuChar: "a", text: "sword" };
    systems.inventorySnapshots.latestInventoryItems = [item];
    systems.messages.gameMessages = Array.from({ length: 35 }, (_, index) => ({ text: `message-${index}`, window: 1, attr: 0 }));
    systems.globalSnapshots.sendReconnectSnapshot();
    expect(events.slice(0, 9).map(event => event.type)).toEqual([
      "clear_scene", "extended_commands", "map_glyph_batch", "map_glyph_batch", "map_glyph_batch", "player_position", "status_update", "status_update", "inventory_update",
    ]);
    expect(events.filter(event => event.type === "map_glyph_batch").map(event => event.tiles.length)).toEqual([500, 500, 1]);
    expect(events[5]).toMatchObject({ x: 9, y: 4 });
    expect(events.slice(6, 8).map(event => event.field)).toEqual([7, 2]);
    expect(events[8].items[0]).toEqual(item);
    expect(events[8].items[0]).not.toBe(item);
    expect(events.slice(9).map(event => event.text)).toEqual(Array.from({ length: 30 }, (_, index) => `message-${index + 5}`));
  });

  it("installs void pointer compatibility once while preserving the original helper's call semantics", () => {
    const helper = vi.fn(function (this: unknown, name: string, pointer: number, type: string) {
      expect(this).toBeUndefined();
      return `${name}:${pointer}:${type}`;
    });
    const globals = { helpers: { getPointerValue: helper as (...args: any[]) => any } };
    vi.stubGlobal("nethackGlobal", globals);
    systems.memory.installHelperCompatibilityShims();
    const wrapper = globals.helpers.getPointerValue;
    expect(wrapper("arg", 64, "v")).toBe(0);
    expect(helper).not.toHaveBeenCalled();
    expect(wrapper("arg", 64, "i")).toBe("arg:64:i");
    systems.memory.installHelperCompatibilityShims();
    expect(globals.helpers.getPointerValue).toBe(wrapper);
  });
});
