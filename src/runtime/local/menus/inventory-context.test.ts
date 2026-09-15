import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import { RuntimeBootstrap } from "../startup/bootstrap";
import type { RuntimeSystems } from "../create-runtime-systems";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
const arrow = { accelerator: "d", identifier: 901, menuIndex: 0, text: "an arrow" };
const gem = { accelerator: "D", identifier: 902, menuIndex: 1, text: "a gem" };
const everything = { accelerator: "*", identifier: 42, menuIndex: 2, text: "List everything" };

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("nethackGlobal", undefined);
  runtime = new LocalNetHackRuntime(() => {});
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("case-sensitive inventory context actions", () => {
  it("expands a filtered throw list before selecting uppercase D instead of arrow d", () => {
    runtime.sendInput("__INVCTX_SELECT__:D:throw");
    const context = systems.inventoryContext;
    expect(context.tryAutoHandlePendingInventoryContextSelection("What do you want to throw?", [arrow, everything])).toBe(true);
    expect([...systems.menuSelection.menuSelections.values()].map(item => item.identifier)).toEqual([42]);
    expect(context.pendingInventoryContextSelection.accelerator).toBe("D");
    expect(context.pendingInventoryContextSelection.listEverythingFallbackUsed).toBe(true);

    systems.menuSelection.menuSelections.clear();
    expect(context.tryAutoHandlePendingInventoryContextSelection("What do you want to throw?", [arrow, gem])).toBe(true);
    expect([...systems.menuSelection.menuSelections.values()].map(item => item.identifier)).toEqual([902]);
    expect(context.pendingInventoryContextSelection).toBeNull();
  });

  it.each([["D", arrow], ["d", gem]])("leaves selection to the player when %s is absent and cannot be expanded", (letter, otherItem) => {
    runtime.sendInput(`__INVCTX_SELECT__:${letter}:throw`);
    expect(systems.inventoryContext.tryAutoHandlePendingInventoryContextSelection("What do you want to throw?", [otherItem])).toBe(false);
    expect(systems.menuSelection.menuSelections.size).toBe(0);
    expect(systems.inventoryContext.pendingInventoryContextSelection).toBeNull();
  });

  it("keeps the exact item and stack count through questionless inventory selection", () => {
    runtime.sendInput("__INVCTX_SELECT_COUNT__:D:3:drop");
    expect(systems.inventoryContext.consumePendingInventoryContextSelection([arrow, gem])).toEqual({ menuItem: gem, selectionCount: 3 });
  });
});


