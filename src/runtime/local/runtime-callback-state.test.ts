import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../LocalNetHackRuntime";
import { RuntimeBootstrap } from "./startup/bootstrap";
import type { RuntimeSystems } from "./create-runtime-systems";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
let events: any[];

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("nethackGlobal", undefined);
  events = [];
  runtime = new LocalNetHackRuntime(event => events.push(event));
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function installMemory() {
  const bytes = new Uint8Array(4096);
  const view = new DataView(bytes.buffer);
  const selectionsPresentDuringWrites: number[] = [];
  const module = {
    HEAPU8: bytes,
    _malloc: vi.fn(() => 512),
    _free: vi.fn(),
    getValue: vi.fn((pointer: number, type: string) => type === "i8" ? view.getInt8(pointer) : view.getInt32(pointer, true)),
    setValue: vi.fn((pointer: number, value: number, type: string) => {
      selectionsPresentDuringWrites.push(systems.menuSelection.menuSelections.size);
      if (type === "i8") view.setInt8(pointer, value);
      else view.setInt32(pointer, value, true);
    }),
    UTF8ToString: vi.fn((pointer: number) => `value-${pointer}`),
  };
  runtime.nethackModule = module;
  return { module, view, selectionsPresentDuringWrites };
}

describe("assembled callback state and WASM menu output", () => {
  it("coalesces repeated status fields and flushes in numeric order after clearing pending state", () => {
    installMemory();
    const emit = runtime.eventHandler;
    runtime.eventHandler = event => {
      expect(systems.status.statusPending.size).toBe(0);
      emit(event);
    };
    runtime.handleUICallback("shim_status_update", [7, 40, 0, 0, 0, 0]);
    runtime.handleUICallback("shim_status_update", [2, 80, 0, 0, 0, 0]);
    runtime.handleUICallback("shim_status_update", [7, 120, 0, 0, 0, 0]);
    expect(events).toEqual([]);
    expect(systems.status.latestStatusUpdates.get(7).value).toBe("value-120");
    runtime.handleUICallback("shim_status_update", [-1, 0, 0, 0, 0, 0]);
    expect(events.map(event => [event.field, event.value])).toEqual([[2, "value-80"], [7, "value-120"]]);
    runtime.handleUICallback("shim_status_update", [-2, 0, 0, 0, 0, 0]);
    expect(events).toHaveLength(2);
  });

  it("decodes condition masks as integers and formatted fields as strings", () => {
    const { module, view } = installMemory();
    view.setInt32(64, 0x1002, true);
    expect(systems.status.decodeStatusValue("BL_CONDITION", 64)).toEqual({ value: 0x1002, valueType: "i" });
    expect(systems.status.decodeStatusValue("BL_HP", 64)).toEqual({ value: "value-64", valueType: "s" });
    module.getValue.mockClear();
    module.UTF8ToString.mockClear();
    expect(systems.status.decodeStatusValue("BL_RESET", 4096)).toEqual({ value: 0, valueType: "i" });
    expect(module.getValue).not.toHaveBeenCalled();
    expect(module.UTF8ToString).not.toHaveBeenCalled();
  });

  it("rejects a malformed callback before invoking its status owner", () => {
    installMemory();
    const dispatch = vi.spyOn(systems.status, "handleShimStatusUpdate");
    expect(runtime.handleUICallback("shim_status_update", [1])).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
    expect(systems.status.statusPending.size).toBe(0);
    expect(systems.startupDiagnostics.uiCallbackCount).toBe(1);
  });

  it("returns Escape for invalid position pointers without starting an input wait", () => {
    installMemory();
    const dispatch = vi.spyOn(systems.positionInput, "handleShimNhPoskey");
    expect(runtime.handleUICallback("shim_nh_poskey", [0, 32, 36])).toBe(27);
    expect(runtime.handleUICallback("shim_nh_poskey", [4095, 32, 36])).toBe(27);
    expect(dispatch).not.toHaveBeenCalled();
    expect(systems.inputRequests.activeInputRequest).toBeNull();
  });

  it("writes all selected menu structs before clearing selection state and leaves prior buffers caller-owned", () => {
    const { module, view, selectionsPresentDuringWrites } = installMemory();
    view.setInt32(64, 256, true);
    systems.menuSelection.menuSelections.set("a", { menuChar: "a", identifier: 901, count: 3, text: "arrows" });
    systems.menuSelection.menuSelections.set("b", { menuChar: "b", identifier: 902, count: 2, text: "daggers" });
    expect(runtime.handleUICallback("shim_select_menu", [7, 2, 64])).toBe(2);
    const layout = systems.pointerContract.getRuntimePointerContract().menuItem;
    expect(module._malloc).toHaveBeenCalledWith(2 * layout.stride);
    expect(view.getInt32(64, true)).toBe(512);
    expect(view.getInt32(512, true)).toBe(901);
    expect(view.getInt32(512 + layout.countOffset, true)).toBe(3);
    expect(view.getInt32(512 + layout.stride, true)).toBe(902);
    expect(view.getInt32(512 + layout.stride + layout.countOffset, true)).toBe(2);
    expect(selectionsPresentDuringWrites.every(count => count === 2)).toBe(true);
    expect(systems.menuSelection.menuSelections.size).toBe(0);
    expect(module._free).not.toHaveBeenCalled();
  });

  it("limits PICK_ONE output to the first selected item", () => {
    const { module, view } = installMemory();
    systems.menuSelection.menuSelections.set("a", { menuChar: "a", identifier: 101, text: "sword" });
    systems.menuSelection.menuSelections.set("b", { menuChar: "b", identifier: 102, text: "shield" });
    expect(runtime.handleUICallback("shim_select_menu", [7, 1, 64])).toBe(1);
    expect(module._malloc).toHaveBeenCalledWith(systems.pointerContract.getRuntimePointerContract().menuItem.stride);
    expect(view.getInt32(512, true)).toBe(101);
    expect(systems.menuSelection.menuSelections.size).toBe(0);
  });

  it.each([1, 2])("returns -1 and nulls the output pointer on cancelled PICK mode %i", mode => {
    const { module, view } = installMemory();
    view.setInt32(64, 256, true);
    systems.menuSelection.lastMenuInteractionCancelled = true;
    expect(runtime.handleUICallback("shim_select_menu", [7, mode, 64])).toBe(-1);
    expect(view.getInt32(64, true)).toBe(0);
    expect(systems.menuSelection.lastMenuInteractionCancelled).toBe(false);
    expect(module._malloc).not.toHaveBeenCalled();
  });

  it("returns zero for an empty menu without treating it as cancellation", () => {
    const { view } = installMemory();
    view.setInt32(64, 256, true);
    expect(runtime.handleUICallback("shim_select_menu", [7, 1, 64])).toBe(0);
    expect(view.getInt32(64, true)).toBe(0);
  });
});
