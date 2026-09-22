import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import type { RuntimeEvent } from "../../types";
import type { RuntimeSystems } from "../create-runtime-systems";
import { RuntimeBootstrap } from "../startup/bootstrap";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
let events: RuntimeEvent[];

beforeEach(() => {
  // Exercise real runtime assembly and input owners without loading WASM.
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  events = [];
  runtime = new LocalNetHackRuntime(event => events.push(event));
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
});

describe("assembled runtime input lifecycle", () => {
  it.each(["3.6.7", "5.0", "slashem"] as const)("keeps contextual Info cliparound on the cursor in %s until Escape", async version => {
    runtime.runtimeVersion = version;
    systems.mapCallbacks.playerPosition = { x: 33, y: 7 };
    runtime.sendInput("__CTX_LOOK_INFO_PROBE__");
    if (version === "slashem") {
      expect(systems.questionInput.handleShimYnFunction(["Specify unknown object by cursor?", "ynq", 113])).toBe(121);
    } else {
      expect(systems.inventoryContext.tryAutoHandlePendingInventoryContextSelection(
        "What do you want to look at:",
        [{ accelerator: "/", identifier: 47, menuIndex: 0, text: "something on the map" }],
      )).toBe(true);
    }
    expect(systems.positionInput.farLookMode).toBe("armed");
    systems.mapCallbacks.handleShimCliparound([34, 6]);
    expect(systems.mapCallbacks.playerPosition).toEqual({ x: 33, y: 7 });
    const wait = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
    // Replay the verbose-look continuation that previously ended the mode early.
    systems.inputRequests.enqueueInputKeys([":"], "synthetic", ["position"]);
    expect(await wait).toBe(58);
    expect(systems.positionInput.positionInputActive).toBe(true);
    systems.contextualLook.contextualLookInfoAutoFlowStage = version === "slashem" ? "await_more_info" : "await_exit";
    systems.contextualLook.contextualLookInfoAutoFlowUntilMs = Date.now() + 10000;
    expect(systems.contextualLook.resolveContextualLookInfoAutoAnswer('More info about "jackal"?', "yn", 110)).toBe("y");
    systems.mapCallbacks.handleShimCliparound([34, 6]);
    expect(events.filter(event => event.type === "player_position")).toHaveLength(0);
    const finish = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
    systems.inputRequests.enqueueInputKeys(["Escape"], "synthetic", ["position"]);
    expect(await finish).toBe(27);
    expect(systems.positionInput.positionInputActive).toBe(false);
    systems.mapCallbacks.handleShimCliparound([33, 7]);
    expect(events.filter(event => event.type === "player_position")).toEqual([{ type: "player_position", x: 33, y: 7 }]);
  });
  it("shares same-kind waits and serializes a different request kind", async () => {
    const eventWait = systems.inputRequests.requestInputCode("event");
    expect(systems.inputRequests.requestInputCode("event")).toBe(eventWait);
    const positionWait = systems.inputRequests.requestInputCode("position");
    systems.inputRequests.enqueueInputKeys(["a"], "user", ["event"]);
    expect(await eventWait).toBe(97);
    systems.inputRequests.enqueueInputKeys(["b"], "user", ["position"]);
    expect(await positionWait).toBe(98);
    expect(systems.inputRequests.activeInputRequest).toBeNull();
  });

  it("leaves position-targeted tokens queued while a question consumes an event answer", async () => {
    systems.inputRequests.enqueueInputKeys(["ArrowRight"], "synthetic", ["position"]);
    const answer = systems.inputRequests.waitForQuestionInput();
    expect(systems.inputRequests.awaitingQuestionInput).toBe(true);
    systems.inputRequests.enqueueInputKeys(["y"], "user", ["event"]);
    expect(await answer).toBe(121);
    expect(systems.inputRequests.awaitingQuestionInput).toBe(false);
    expect(systems.inputRequests.requestInputCode("position")).toBe(54);
  });

  it("treats get_nh_event as a pump without consuming a queued command", () => {
    runtime.sendInput("i");
    expect(systems.inputRequests.handleShimGetNhEvent()).toBe(0);
    expect(systems.inputRequests.handleShimNhGetch()).toBe(105);
  });

  it("rejects extended command submission while a question is awaiting its answer", async () => {
    const answer = systems.inputRequests.waitForQuestionInput();
    expect(systems.extendedCommands.queueExtendedCommandSubmission("pray")).toBe(false);
    expect(systems.extendedCommands.pendingExtendedCommand).toBeNull();
    runtime.sendInput("n");
    expect(await answer).toBe(110);
    expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
  });

  it("maps Escape using the current yn default and clears prompt state after completion", async () => {
    const answer = systems.questionInput.handleShimYnFunction(["Really continue?", "yn", 110]);
    runtime.sendInput("Escape");
    expect(await answer).toBe(110);
    expect(systems.questionInput.activeYnPrompt).toBeNull();
    expect(systems.inputRequests.awaitingQuestionInput).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "question", text: "Really continue?" }));
  });

  it("arms far-look on input consumption and activates it only on a position request", async () => {
    runtime.sendInput(";");
    expect(systems.inputRequests.handleShimNhGetch()).toBe(59);
    expect(systems.positionInput.farLookMode).toBe("armed");
    expect(systems.positionInput.positionInputActive).toBe(false);
    const position = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
    expect(systems.positionInput.farLookMode).toBe("active");
    expect(systems.positionInput.positionInputActive).toBe(true);
    runtime.sendInput("Escape");
    expect(await position).toBe(27);
    expect(systems.positionInput.farLookMode).toBe("none");
    expect(systems.positionInput.positionInputActive).toBe(false);
  });

  it("cancels far-look before queuing an unrelated command for the next event wait", async () => {
    runtime.sendInput(";");
    systems.inputRequests.handleShimNhGetch();
    const position = systems.positionInput.handleShimNhPoskey([0, 0, 0]);
    runtime.sendInput("i");
    expect(await position).toBe(27);
    expect(systems.inputRequests.handleShimNhGetch()).toBe(105);
    expect(systems.positionInput.farLookMode).toBe("none");
  });

  it("resolves a menu waiter without consuming the independent input broker wait", async () => {
    const eventWait = systems.inputRequests.requestInputCode("event");
    const menuResolver = vi.fn();
    systems.menuSelection.pendingMenuSelection = { resolver: menuResolver, menuListPtrPtr: 0 };
    systems.menuSelection.menuSelections.set("a", { menuChar: "a" });
    systems.menuSelection.resolveMenuSelection(0);
    expect(menuResolver).toHaveBeenCalledExactlyOnceWith(0);
    expect(systems.menuSelection.pendingMenuSelection).toBeNull();
    expect(systems.menuSelection.menuSelections.size).toBe(0);
    expect(systems.inputRequests.inputBroker.hasPendingRequests("event")).toBe(true);
    systems.inputRequests.enqueueInputKeys(["z"], "user", ["event"]);
    expect(await eventWait).toBe(122);
  });

  it("shutdown cancels pending waiters once and discards queued input", async () => {
    const eventWait = systems.inputRequests.requestInputCode("event");
    const menuResolver = vi.fn();
    const commandResolver = vi.fn();
    systems.menuSelection.pendingMenuSelection = { resolver: menuResolver, menuListPtrPtr: 0 };
    systems.extendedCommands.pendingExtendedCommandRequest = { resolve: commandResolver };
    systems.inputRequests.enqueueInputKeys(["a"], "synthetic", ["position"]);
    runtime.shutdown("test shutdown");
    runtime.shutdown("duplicate shutdown");
    expect(await eventWait).toBe(27);
    expect(menuResolver).toHaveBeenCalledExactlyOnceWith(0);
    expect(commandResolver).toHaveBeenCalledExactlyOnceWith(-1);
    expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
    expect(systems.inputRequests.activeInputRequest).toBeNull();
    runtime.sendInput("i");
    expect(systems.inputRequests.inputBroker.drain()).toEqual([]);
  });
});
