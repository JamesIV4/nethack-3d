import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
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
afterEach(() => { runtime.shutdown(); vi.restoreAllMocks(); });

const question = (choices = "ynq", defaultChoice = 110) =>
  runtime.handleUICallback("shim_yn_function", [
    "There is a cave dweller corpse here; eat it?", choices, defaultChoice,
  ]);

describe("bounded runtime yes/no answers", () => {
  it.each(["y", "n", "q"])("ignores queued and live invalid input before accepting %s", async valid => {
    runtime.sendInput("t");
    runtime.sendInput("i");
    const answer = question();
    const pending = systems.inputRequests.activeInputRequest;
    let finished = false;
    void Promise.resolve(answer).then(() => { finished = true; });
    runtime.sendInput("t");
    runtime.sendInput("ArrowUp");
    await Promise.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(systems.inputRequests.activeInputRequest).toBe(pending);
    runtime.sendInput(valid);
    expect(await answer).toBe(valid.charCodeAt(0));
    expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
  });

  it.each(["Enter", " ", "Spacebar", "Escape"])("maps %s to the supported default", async key => {
    const answer = question();
    runtime.sendInput(key);
    expect(await answer).toBe(110);
  });

  it("keeps waiting on Enter without a default and supports capitalized answers", async () => {
    const answer = question("ynq", 0);
    runtime.sendInput("Enter");
    runtime.sendInput("Y");
    expect(await answer).toBe(121);
  });

  it("preserves unrestricted direction input and exact inventory case", async () => {
    const direction = runtime.handleUICallback("shim_yn_function", ["In what direction?", "", 0]);
    runtime.sendInput("ArrowRight");
    expect(await direction).toBe(54);
    const inventory = runtime.handleUICallback("shim_yn_function", ["Choose an item", "dD", 0]);
    runtime.sendInput("D");
    expect(await inventory).toBe(68);
  });

  it("preserves cancellation when only q is the supported default", async () => {
    const answer = question("ynq", 113);
    runtime.sendInput("Escape");
    expect(await answer).toBe(113);
  });

  it("cancels an unanswered prompt on shutdown after invalid input", async () => {
    const answer = question();
    runtime.sendInput("t");
    runtime.shutdown();
    expect(await answer).toBe(27);
  });
});
