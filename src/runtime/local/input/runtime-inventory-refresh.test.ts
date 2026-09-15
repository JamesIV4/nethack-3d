import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import { silentInventoryRefreshCommand } from "../../input/inventory-refresh";
import type { RuntimeSystems } from "../create-runtime-systems";
import { RuntimeBootstrap } from "../startup/bootstrap";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  runtime = new LocalNetHackRuntime(() => {});
  runtime.nethackModule = { HEAPU8: new Uint8Array(4096) };
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});
afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
});

const nextCommand = () => runtime.handleUICallback("shim_nh_poskey", [64, 68, 72]);
const sellQuestion = () => runtime.handleUICallback("shim_yn_function", [
  "Will you accept 10 gold pieces for your dagger?", "ynaq", 110,
]);

describe("background inventory refresh command boundaries", () => {
  it.each(["5.0", "slashem"] as const)(
    "keeps refreshes before and during a %s sale out of its answer queue", async version => {
      runtime.runtimeVersion = version;
      runtime.sendInput(silentInventoryRefreshCommand);
      const answer = sellQuestion();
      runtime.sendInput(silentInventoryRefreshCommand);
      expect(systems.inputRequests.awaitingQuestionInput).toBe(true);
      expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
      runtime.sendInput("y");
      expect(await answer).toBe(121);
      expect(await nextCommand()).toBe(105);
      // Duplicate refreshes coalesce, and y never escapes as a new command.
      const command = nextCommand();
      runtime.sendInput(".");
      expect(await command).toBe(46);
    },
  );

  it("services an already waiting normal command immediately", async () => {
    const command = nextCommand();
    runtime.sendInput(silentInventoryRefreshCommand);
    expect(await command).toBe(105);
    expect(systems.inputRequests.silentInventoryRefreshPending).toBe(false);
    expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
  });

  it("does not append i when a command waiter was just consumed", async () => {
    const command = nextCommand();
    runtime.sendInput("d");
    runtime.sendInput(silentInventoryRefreshCommand);
    expect(await command).toBe(100);
    const answer = sellQuestion();
    runtime.sendInput("n");
    expect(await answer).toBe(110);
    expect(await nextCommand()).toBe(105);
  });

  it("defers through text input and far-look position selection", async () => {
    const text = runtime.handleUICallback("shim_getlin", ["Name this item:", 512]);
    runtime.sendInput(silentInventoryRefreshCommand);
    runtime.sendInput("__TEXT_INPUT__:wand");
    expect(await text).toBe(0);
    systems.positionInput.farLookMode = "armed";
    const look = nextCommand();
    runtime.sendInput(silentInventoryRefreshCommand);
    runtime.sendInput("Escape");
    expect(await look).toBe(27);
    expect(await nextCommand()).toBe(105);
  });

  it("runs before queued commands rather than leaving i after a drop", async () => {
    runtime.sendInput("d");
    runtime.sendInput(silentInventoryRefreshCommand);
    expect(await nextCommand()).toBe(105);
    expect(await nextCommand()).toBe(100);
    const answer = sellQuestion();
    runtime.sendInput("y");
    expect(await answer).toBe(121);
    expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
  });

  it("clears a deferred refresh on shutdown", () => {
    runtime.sendInput(silentInventoryRefreshCommand);
    runtime.shutdown();
    expect(systems.inputRequests.silentInventoryRefreshPending).toBe(false);
  });
});


describe("refresh deferral through command prefixes", () => {
  it.each([
    [false, ["3", "2"], "d"],
    [false, ["3", "2", "\b"], "d"],
    [true, ["n", "3", "2"], "d"],
    [false, ["g"], "h"],
    [false, ["m", "G"], "h"],
    [true, ["Numpad5"], "Numpad6"],
    [true, ["-"], "Numpad6"],
  ] as const)("preserves numpad=%s prefix %s before %s", async (numberPad, prefixes, commandKey) => {
    systems.keyboardInput.numberPadModeEnabled = numberPad;
    for (const prefix of prefixes) {
      const input = nextCommand();
      runtime.sendInput(prefix);
      expect(await input).toBe(systems.keyboardInput.processKey(prefix));
      runtime.sendInput(silentInventoryRefreshCommand);
    }
    const command = nextCommand();
    runtime.sendInput(silentInventoryRefreshCommand);
    runtime.sendInput(commandKey);
    expect(await command).toBe(systems.keyboardInput.processKey(commandKey));
    if (commandKey === "d") {
      const answer = sellQuestion();
      runtime.sendInput("y");
      expect(await answer).toBe(121);
    }
    expect(await nextCommand()).toBe(105);
    expect(systems.inputRequests.commandInputContinuation).toBe("none");
  });

  it("does not mistake ordinary numpad movement for a count", async () => {
    systems.keyboardInput.numberPadModeEnabled = true;
    const movement = nextCommand();
    runtime.sendInput("Numpad3");
    expect(await movement).toBe(51);
    runtime.sendInput(silentInventoryRefreshCommand);
    expect(await nextCommand()).toBe(105);
  });

  it("allows a refresh after count cancellation", async () => {
    systems.keyboardInput.numberPadModeEnabled = false;
    const count = nextCommand();
    runtime.sendInput("3");
    expect(await count).toBe(51);
    runtime.sendInput(silentInventoryRefreshCommand);
    const cancel = nextCommand();
    runtime.sendInput("Escape");
    expect(await cancel).toBe(27);
    expect(await nextCommand()).toBe(105);
  });
});

