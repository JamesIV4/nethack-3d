import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import type { RuntimeSystems } from "../create-runtime-systems";
import type { RuntimeEvent } from "../../types";
import { RuntimeBootstrap } from "../startup/bootstrap";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
let events: RuntimeEvent[];

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  events = [];
  runtime = new LocalNetHackRuntime(event => events.push(event));
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
  systems.mapCallbacks.playerPosition = { x: 33, y: 7 };
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
});

const prompt = "Where do you want to hit?";
function beginTargeting(channel: "message" | "raw" | "bold" = "message") {
  if (channel === "message") systems.messages.handleShimPutstr([1, 0, prompt]);
  else if (channel === "raw") systems.messages.handleShimRawPrint([prompt]);
  else systems.messages.handleShimRawPrintBold([prompt]);
}

describe.each(["3.6.7", "5.0", "slashem"] as const)("polearm targeting in %s", version => {
  beforeEach(() => { runtime.runtimeVersion = version; });

  it.each(["message", "raw", "bold"] as const)("claims the cursor before the first cliparound from a %s prompt", async channel => {
    beginTargeting(channel);
    expect(events).toContainEqual({ type: "position_input_state", active: true, origin: "target" });
    expect(events).toContainEqual(expect.objectContaining({ type: "position_request", text: prompt }));
    // getpos can start on a nearby monster, not on the hero, before nh_poskey.
    systems.mapCallbacks.handleShimCliparound([35, 7]);
    systems.mapCallbacks.handleShimCurs([3, 35, 7]);
    const next = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
    runtime.sendInput("6");
    expect(await next).toBe(54);
    systems.mapCallbacks.handleShimCliparound([36, 7]);
    systems.mapCallbacks.handleShimCurs([3, 36, 7]);
    expect(systems.mapCallbacks.playerPosition).toEqual({ x: 33, y: 7 });
    expect(systems.mapCallbacks.playerPositionMovementSerial).toBe(0);
    expect(events.filter(event => ["player_position", "map_cursor"].includes(event.type))).toEqual([]);
    expect(systems.positionInput.positionCursor).toMatchObject({ x: 36, y: 7 });
    expect(systems.positionInput.positionInputActive).toBe(true);
  });

  it.each([".", ",", ";", ":", "Enter", "Escape"])("finishes selection on %s and restores ordinary player updates", async key => {
    beginTargeting();
    const selected = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
    runtime.sendInput(key);
    expect(await selected).toBe(key === "Escape" ? 27 : key === "Enter" ? 46 : key.charCodeAt(0));
    expect(systems.positionInput.positionInputActive).toBe(false);
    expect(systems.positionInput.farLookMode).toBe("none");
    expect(systems.positionInput.farLookOrigin).toBeNull();
    systems.mapCallbacks.handleShimCliparound([33, 7]);
    expect(events.filter(event => event.type === "player_position")).toEqual([{ type: "player_position", x: 33, y: 7 }]);
    expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
  });

  it("keeps target cycling and help owned by getpos", async () => {
    beginTargeting();
    for (const key of ["m", "?", "@", "6"]) {
      const next = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
      runtime.sendInput(key);
      expect(await next).toBe(key.charCodeAt(0));
      expect(systems.positionInput.positionInputActive).toBe(true);
    }
  });

  it("passes the clicked target to NetHack and ends selection without moving the hero", async () => {
    const setValue = vi.fn();
    runtime.nethackModule = { HEAPU8: new Uint8Array(256), setValue };
    beginTargeting();
    const selected = systems.positionInput.handleShimNhPoskey([64, 68, 72]);
    runtime.sendMouseInput(35, 7, 0);
    expect(await selected).toBe(0);
    const coordType = version === "5.0" ? "i16" : "i32";
    expect(setValue.mock.calls).toEqual([[64, 35, coordType], [68, 7, coordType], [72, 1, "i32"]]);
    expect(systems.positionInput.positionInputActive).toBe(false);
    expect(systems.mapCallbacks.playerPosition).toEqual({ x: 33, y: 7 });
  });
});

it("does not turn a recalled message or ordinary command wait into targeting", async () => {
  systems.messages.handleShimPutstr([4, 0, prompt]);
  const command = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
  expect(systems.positionInput.positionInputActive).toBe(false);
  runtime.sendInput("6");
  expect(await command).toBe(54);
  expect(events.filter(event => event.type === "position_request")).toEqual([]);
});
