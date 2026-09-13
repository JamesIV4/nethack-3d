import { describe, expect, it } from "vitest";
import { SnapTurnLatch, WorldClickGesture } from "./controller-gestures";
describe("VR controller gestures", () => {
  it("turns once per deflection and requires neutral before the next turn", () => {
    const turn = new SnapTurnLatch();
    expect(turn.update(0.8, true)).toBe(1);
    expect(turn.update(1, true)).toBe(0);
    expect(turn.update(-1, true)).toBe(0);
    turn.update(0, true);
    expect(turn.update(-0.8, true)).toBe(-1);
    expect(turn.update(NaN, true)).toBe(0);
  });
  it("does not turn immediately when a dialog closes with the stick held", () => {
    const turn = new SnapTurnLatch();
    turn.update(1, false);
    expect(turn.update(1, true)).toBe(0);
    turn.update(0, true); expect(turn.update(1, true)).toBe(1);
  });
  it("separates taps from holds without sending an extra primary click", () => {
    const press = new WorldClickGesture();
    press.press(100); expect(press.release(200)).toBe("primary");
    press.press(1000); expect(press.update(1449)).toBe(false);
    expect(press.update(1450)).toBe(true); expect(press.update(1700)).toBe(false);
    expect(press.release(1800)).toBeNull();
    press.press(2000); expect(press.release(2600)).toBe("secondary");
    press.press(3000); press.cancel(); expect(press.release(3100)).toBeNull();
  });
});
