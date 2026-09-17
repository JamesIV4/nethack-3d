import { expect, it } from "vitest";
import { SystemRecenter } from "./system-recenter";

it("baselines the host revision then recenters once for each new system event", () => {
  const recenter = new SystemRecenter();
  expect(recenter.accept("3")).toBe(false);
  expect(recenter.accept("3")).toBe(false);
  expect(recenter.accept("4")).toBe(true);
  expect(recenter.accept("4")).toBe(false);
  expect(recenter.accept(null)).toBe(false);
  expect(recenter.accept("invalid")).toBe(false);
  expect(recenter.accept("5")).toBe(true);
});
