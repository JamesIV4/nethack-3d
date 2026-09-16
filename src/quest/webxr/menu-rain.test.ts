import { expect, it } from "vitest";
import { rainVisibility } from "./menu-rain";

it("fades births and retirements over two seconds, including count changes mid-fade", () => {
  expect(rainVisibility(0, true, 1)).toBe(.5);
  expect(rainVisibility(0, true, 2)).toBe(1);
  expect(rainVisibility(1, false, 1)).toBe(.5);
  expect(rainVisibility(1, false, 2)).toBe(0);
  expect(rainVisibility(.5, false, .5)).toBe(.25);
  expect(rainVisibility(0, false, 1)).toBe(0);
});
