import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import type { RuntimeEvent } from "../../types";
import type { RuntimeSystems } from "../create-runtime-systems";
import { RuntimeBootstrap } from "../startup/bootstrap";

const title = "Tip: Farlooking or selecting a map location";
let runtime: LocalNetHackRuntime, systems: RuntimeSystems, events: RuntimeEvent[];
beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  events = []; runtime = new LocalNetHackRuntime(event => events.push(event));
  runtime.runtimeVersion = "5.0";
  const heap = new Uint8Array(4096), view = new DataView(heap.buffer);
  runtime.nethackModule = {
    HEAPU8: heap,
    getValue: (ptr: number, type: string) => type === "i16" ? view.getInt16(ptr,true) : view.getInt32(ptr,true),
    setValue: (ptr: number, value: number, type: string) => type === "i16" ? view.setInt16(ptr,value,true) : view.setInt32(ptr,value,true),
  };
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});
afterEach(() => { runtime.shutdown("test complete"); vi.restoreAllMocks(); });

function emitTip(heading = title) {
  systems.menuCapture.handleShimStartMenu([4,0]);
  systems.menuSelection.currentMenuItems = [heading, 'You are now in a "farlook" mode - the movement keys move the cursor,',
    "not your character. Game time does not advance."].map(text => ({ text, identifier: 0, isSelectable: false, isCategory: false }));
  systems.menuCapture.handleShimEndMenu([4, ""]);
}

it("suppresses the first automatic glance tip without consuming the target or interrupting the probe", async () => {
  runtime.sendInput("__CTX_GLANCE_PROBE__");
  systems.positionInput.farLookMode = "armed";
  systems.positionInput.farLookOrigin = "direct";
  systems.mouseInput.enqueueMouseInput(19,13,1);
  emitTip();
  expect(events.some(event => event.type === "info_menu")).toBe(false);
  expect(systems.inventorySnapshots.lastEndedInventoryMenuKind).toBe("info_menu");
  expect(await systems.menuSelection.handleShimSelectMenu([4,0,128])).toBe(0);
  expect(await systems.positionInput.handleShimNhPoskey([64,66,72])).toBe(0);
  expect(runtime.nethackModule.getValue(64,"i16")).toBe(19);
  expect(runtime.nethackModule.getValue(66,"i16")).toBe(13);
  expect(await systems.positionInput.handleShimNhPoskey([64,66,72])).toBe(27);
  expect(systems.positionInput.positionInputActive).toBe(false);
  expect(events.some(event => event.type === "info_menu")).toBe(false);
});

it.each(["manual", "after-target", "unrelated", "3.6.7", "slashem"])("preserves tip/report presentation for %s", mode => {
  if (mode !== "manual") runtime.sendInput("__CTX_GLANCE_PROBE__");
  if (mode === "after-target") systems.contextualLook.contextualGlanceProbeMouseDeadlineMs = 0;
  if (mode === "3.6.7" || mode === "slashem") runtime.runtimeVersion = mode;
  emitTip(mode === "unrelated" ? "Unrelated game information" : title);
  expect(events.filter(event => event.type === "info_menu")).toHaveLength(1);
});

it.each(["delayed-glance","info"])("suppresses the first-use tip during %s", mode => {
  runtime.sendInput(mode === "info" ? "__CTX_LOOK_INFO_PROBE__" : "__CTX_GLANCE_PROBE__");
  if (mode === "delayed-glance") systems.contextualLook.contextualGlanceProbeMouseDeadlineMs = Date.now()-1;
  emitTip(); expect(events.some(event=>event.type==="info_menu")).toBe(false);
});

it("clears pending glance-tip suppression on cancellation so manual look retains help", async () => {
  runtime.sendInput("__CTX_GLANCE_PROBE__");
  systems.positionInput.farLookMode="armed";
  const wait=systems.positionInput.handleShimNhPoskey([64,66,72]);
  runtime.sendInput("Escape");expect(await wait).toBe(27);
  expect(systems.contextualLook.contextualGlanceProbeMouseDeadlineMs).toBe(0);
  emitTip(); expect(events.some(event=>event.type==="info_menu")).toBe(true);
});
