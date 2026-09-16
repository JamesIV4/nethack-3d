import { expect, it } from "vitest";
import { isRepeatActionButtonVisible } from "./RepeatActionButton";

it("keeps repeat hidden outside touch UI until immersive VR is active", () => {
  expect(isRepeatActionButtonVisible(false, true, false)).toBe(false);
  expect(isRepeatActionButtonVisible(false, true, true)).toBe(true);
  expect(isRepeatActionButtonVisible(true, true, false)).toBe(true);
  expect(isRepeatActionButtonVisible(true, false, true)).toBe(false);
});
