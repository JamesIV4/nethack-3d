import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import type { RuntimeSystems } from "../create-runtime-systems";
import { RuntimeBootstrap } from "../startup/bootstrap";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
let events: any[];
let heap: Uint8Array;

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  events = [];
  runtime = new LocalNetHackRuntime(event => events.push(event));
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
  heap = new Uint8Array(4096);
  runtime.nethackModule = { HEAPU8: heap };
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
});

function readAnswer() {
  return new TextDecoder().decode(heap.slice(64, heap.indexOf(0, 64)));
}

describe("explicit runtime text submissions", () => {
  it.each(["Unidentified", "AltGraph", "Dead", "Process", "Shift", "AudioVolumeUp", "F13"])(
    "ignores %s before and during naming and engraving prompts",
    async key => {
      runtime.sendInput(key);
      expect(systems.textInput.pendingTextResponses).toEqual([]);
      expect(systems.inputRequests.inputBroker.drain()).toEqual([]);

      for (const [question, answer] of [
        ["What do you want to name this wand?", "fire"],
        ["What do you want to write in the dust here?", "Elbereth"],
      ]) {
        const response = systems.textInput.handleShimGetlin([question, 64]);
        const pending = systems.textInput.pendingTextRequest;
        expect(pending).not.toBeNull();
        expect(events).toContainEqual(expect.objectContaining({ type: "text_request", text: question }));
        runtime.sendInput(key);
        expect(systems.textInput.pendingTextRequest).toBe(pending);
        runtime.sendInput(`__TEXT_INPUT__:${answer}`);
        await response;
        expect(readAnswer()).toBe(answer);
      }
      expect(systems.textInput.pendingTextResponses).toEqual([]);
      expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
    },
  );

  it.each(["AltGraph", "Unidentified", "", "x", "\x1b"])(
    "accepts the literal value %j when explicitly submitted",
    async answer => {
      const response = systems.textInput.handleShimGetlin(["Name this item:", 64]);
      runtime.sendInput(`__TEXT_INPUT__:${answer}`);
      await response;
      expect(readAnswer()).toBe(answer);
      expect(systems.textInput.pendingTextRequest).toBeNull();
    },
  );

  it("retains explicitly queued text without treating arbitrary key names as text", () => {
    runtime.sendInput("__TEXT_INPUT__:Elbereth");
    runtime.sendInput("Unidentified");
    expect(systems.textInput.handleShimGetlin(["Write what?", 64])).toBe(0);
    expect(readAnswer()).toBe("Elbereth");
    expect(systems.textInput.pendingTextResponses).toEqual([]);
  });

  it("preserves character case, movement keys, and command modifiers", () => {
    for (const [key, expected] of [["D", 68], ["d", 100], ["ArrowRight", 54], ["__CTRL__:a", 1]] as const) {
      runtime.sendInput(key);
      expect(systems.inputRequests.handleShimNhGetch()).toBe(expected);
    }
  });
});
