import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import * as bindings from "../../controller-bindings";
import { ControllerGameplay, type ControllerGameplayDependencies } from "./controller-gameplay";
import { ControllerDialogs, type ControllerDialogsDependencies } from "./controller-dialogs";

vi.hoisted(() => vi.stubGlobal("window", {
  matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" },
}));
afterAll(() => vi.unstubAllGlobals());
afterEach(() => vi.restoreAllMocks());

describe("controller polling", () => {
  it("clears cursor feedback once without idle DOM writes that invalidate native UI geometry", () => {
    const dialogs = new ControllerDialogs({} as ControllerDialogsDependencies);
    const writes: string[] = [];
    const element = () => {
      let display = "block";
      const classes = new Set(["is-active"]);
      return { style: { get display() { return display; }, set display(value: string) { writes.push("display"); display = value; } },
        classList: { contains: (name: string) => classes.has(name), remove: (name: string) => { writes.push("class"); classes.delete(name); } } } as unknown as HTMLDivElement;
    };
    dialogs.controllerVirtualCursorElement = element();
    dialogs.controllerVirtualCursorPulseElement = element();
    dialogs.controllerVirtualCursorVisible = true;
    dialogs.resetControllerVirtualCursor();
    expect(dialogs.controllerVirtualCursorVisible).toBe(false);
    expect(dialogs.controllerVirtualCursorPulseElement.classList.contains("is-active")).toBe(false);
    expect(writes).toEqual(["display", "class", "display"]);
    writes.length = 0;
    for (let i = 0; i < 120; i++) dialogs.resetControllerVirtualCursor();
    expect(writes).toEqual([]);
  });
  it("reuses binding parses while sampling live button/axis values and remaps", () => {
    const parse = vi.spyOn(bindings, "parseNh3dControllerBinding");
    const input = new ControllerGameplay({} as ControllerGameplayDependencies);
    const state = { buttons: [{ pressed: false, value: 0 }, { pressed: true, value: 1 }], axes: [0.9] };
    const pad = state as unknown as Gamepad;
    for (let i = 0; i < 120; i++) expect(input.getControllerBindingValue(pad, "button:0")).toBe(0);
    expect(parse).toHaveBeenCalledTimes(1);
    state.buttons[0].pressed = true;
    expect(input.getControllerBindingValue(pad, "button:0")).toBe(1);
    expect(input.getControllerBindingValue(pad, "button:1")).toBe(1);
    expect(input.getControllerBindingValue(pad, "axis:0:+")).toBeGreaterThan(0);
    state.axes[0] = -0.9;
    expect(input.getControllerBindingValue(pad, "axis:0:+")).toBe(0);
    expect(input.getControllerBindingValue(pad, "axis:0:-")).toBeGreaterThan(0);
    expect(input.getControllerBindingValue(pad, "invalid")).toBe(0);
    const calls = parse.mock.calls.length;
    expect(input.getControllerBindingValue(pad, "invalid")).toBe(0);
    expect(parse).toHaveBeenCalledTimes(calls);
  });

  it("keeps press, held and release edges intact with cached bindings", () => {
    const input = new ControllerGameplay({} as ControllerGameplayDependencies);
    const mapping = bindings.normalizeNh3dControllerBindings(bindings.defaultNh3dControllerBindings);
    const state = { buttons: Array.from({ length: 18 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    const pad = state as unknown as Gamepad;
    mapping.confirm = ["button:0", null];
    input.sampleControllerActionSnapshot(mapping, [pad]);
    state.buttons[0].pressed = true;
    expect(input.sampleControllerActionSnapshot(mapping, [pad]).pressed.confirm).toBe(true);
    expect(input.sampleControllerActionSnapshot(mapping, [pad]).pressed.confirm).toBe(false);
    state.buttons[0].pressed = false;
    expect(input.sampleControllerActionSnapshot(mapping, [pad]).released.confirm).toBe(true);
    expect(input.sampleControllerActionSnapshot(mapping, [pad]).released.confirm).toBe(false);
  });
});
