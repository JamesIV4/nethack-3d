import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import type { RuntimeEvent } from "../../types";
import type { RuntimeSystems } from "../create-runtime-systems";
import { RuntimeBootstrap } from "../startup/bootstrap";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
let events: RuntimeEvent[];
let heap: Uint8Array;

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  events = [];
  runtime = new LocalNetHackRuntime(event => events.push(event));
  runtime.runtimeVersion = "5.0";
  heap = new Uint8Array(4096);
  runtime.nethackModule = { HEAPU8: heap };
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
});

describe("NetHack 5 priest donation input", () => {
  // priest_talk calls bribe, which calls getlin and parses its buffer as a long.
  // A queued key name such as Unidentified therefore used to silently refuse.
  it.each(["Unidentified", "AltGraph", "Shift", "Dead"])(
    "waits for a donation after %s and the chat direction",
    async key => {
      runtime.sendInput(key);
      const direction = runtime.handleUICallback("shim_yn_function", [
        "In what direction?", "", 0,
      ]);
      runtime.sendInput("ArrowRight");
      expect(await direction).toBe(54);

      const prompt = "How much will you offer (suggested: 400 or 800)?";
      const donation = runtime.handleUICallback("shim_getlin", [prompt, 512]);
      expect(events).toContainEqual(expect.objectContaining({
        type: "text_request", text: prompt,
      }));
      expect(systems.textInput.pendingTextRequest).not.toBeNull();
      expect(heap[512]).toBe(0);

      runtime.sendInput("__TEXT_INPUT__:2500");
      expect(await donation).toBe(0);
      expect(new TextDecoder().decode(heap.slice(512, 517))).toBe("2500\0");
      expect(systems.textInput.pendingTextRequest).toBeNull();
      expect(systems.textInput.pendingTextResponses).toEqual([]);
    },
  );

  it("preserves explicit cancellation of the donation prompt", async () => {
    const donation = runtime.handleUICallback("shim_getlin", [
      "How much will you offer (suggested: 400 or 800)?", 512,
    ]);
    runtime.sendInput("__TEXT_INPUT__:\x1b");
    expect(await donation).toBe(0);
    expect(Array.from(heap.slice(512, 514))).toEqual([27, 0]);
    expect(systems.textInput.pendingTextRequest).toBeNull();
  });
});
