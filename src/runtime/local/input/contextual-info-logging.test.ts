import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import type { RuntimeEvent } from "../../types";
import type { RuntimeSystems } from "../create-runtime-systems";
import { RuntimeBootstrap } from "../startup/bootstrap";

let runtime: LocalNetHackRuntime, systems: RuntimeSystems, events: RuntimeEvent[];
beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  events = []; runtime = new LocalNetHackRuntime(event => events.push(event));
  const heap = new Uint8Array(4096), view = new DataView(heap.buffer);
  runtime.nethackModule = {
    HEAPU8: heap,
    getValue: (ptr: number, type: string) => type === "i16" ? view.getInt16(ptr,true) : view.getInt32(ptr,true),
    setValue: (ptr: number, value: number, type: string) => type === "i16" ? view.setInt16(ptr,value,true) : view.setInt32(ptr,value,true),
  };
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});
afterEach(() => { runtime.shutdown("test complete"); vi.restoreAllMocks(); });

it.each(["3.6.7", "5.0", "slashem"] as const)("keeps %s contextual Info quiet but still displays its information", async version => {
  runtime.runtimeVersion = version;
  runtime.sendInput("__CTX_LOOK_INFO_PROBE__");
  systems.positionInput.farLookMode = "armed";
  systems.positionInput.farLookOrigin = "look_menu";
  vi.mocked(console.log).mockClear();
  const initialCallbacks = systems.startupDiagnostics.uiCallbackCount;
  runtime.handleUICallback("shim_raw_print", ["Please move the cursor to a monster, object or location."]);
  runtime.handleUICallback("shim_raw_print", ["(For instructions type a '?')"]);
  runtime.handleUICallback("shim_raw_print_bold", ["Pick a location."]);
  runtime.handleUICallback("shim_cliparound", [18,14]);
  runtime.handleUICallback("shim_curs", [3,18,14]);
  runtime.handleUICallback("shim_display_nhwindow", [3,false]);
  runtime.sendMouseInput(19,13,0);
  expect(await runtime.handleUICallback("shim_nh_poskey", [64,68,72])).toBe(0);
  runtime.handleUICallback("shim_putstr", [1,0,"d        a tame little dog"]);
  runtime.handleUICallback("shim_message_menu", [0,0,"temporary look text"]);
  systems.contextualLook.contextualLookInfoAutoFlowStage = "await_exit";
  expect(runtime.handleUICallback("shim_yn_function", ['More info about "little dog"?',"yn",110])).toBe(121);
  runtime.handleUICallback("shim_create_nhwindow", [5]);
  runtime.handleUICallback("shim_putstr", [5,0,"The requested encyclopedia entry."]);
  runtime.handleUICallback("shim_display_nhwindow", [5,false]);
  expect(console.log).not.toHaveBeenCalled();
  expect(events.some(event => event.type === "text" || event.type === "raw_print")).toBe(false);
  expect(systems.messages.gameMessages).toHaveLength(0);
  expect(events.find(event => event.type === "info_menu")).toMatchObject({ lines: ["The requested encyclopedia entry."] });
  expect(systems.startupDiagnostics.uiCallbackCount).toBeGreaterThan(initialCallbacks);
  if (version !== "slashem") expect(await runtime.handleUICallback("shim_nh_poskey", [64,68,72])).toBe(58);
  expect(await runtime.handleUICallback("shim_nh_poskey", [64,68,72])).toBe(27);
  expect(console.log).not.toHaveBeenCalled();
  runtime.handleUICallback("shim_putstr", [1,0,"You hear a door open."]);
  runtime.handleUICallback("shim_raw_print", ["An ordinary game message."]);
  expect(events).toContainEqual(expect.objectContaining({ type: "text", text: "You hear a door open." }));
  expect(events).toContainEqual(expect.objectContaining({ type: "raw_print", text: "An ordinary game message." }));
  expect(console.log).toHaveBeenCalled();
});

it("does not mute manual look, expired Info flows, or failure diagnostics", () => {
  runtime.handleUICallback("shim_raw_print", ["Please move the cursor."]);
  expect(events).toContainEqual({ type: "raw_print", text: "Please move the cursor." });
  runtime.sendInput("__CTX_LOOK_INFO_PROBE__");
  systems.contextualLook.contextualLookInfoAutoFlowUntilMs = Date.now()-1;
  vi.mocked(console.log).mockClear();
  runtime.handleUICallback("shim_raw_print", ["Logging after expiry."]);
  expect(console.log).toHaveBeenCalled();
  runtime.sendInput("__CTX_LOOK_INFO_PROBE__");
  vi.mocked(console.log).mockClear();
  systems.mouseInput.writePoskeyTargetValue(0,1,"x","i16");
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Skipping nh_poskey"));
});
