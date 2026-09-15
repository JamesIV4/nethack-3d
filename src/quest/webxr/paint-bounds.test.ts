import { expect, it } from "vitest";
import { shadowOutsets } from "./paint-bounds";
it("includes the upward action-bar shadow in its movable crop", () => {
  expect(shadowOutsets("rgba(0, 0, 0, 0.5) 0px -8px 18px 0px")).toEqual([36,44,36,28]);
});
it("combines outer shadows without including inset shadows or splitting colors", () => {
  expect(shadowOutsets("rgba(0, 0, 0, .5) 0px 8px 18px, inset 0px 0px 100px red, rgb(1, 2, 3) 0px 0px 0px 1px")).toEqual([36,28,36,44]);
  expect(shadowOutsets("none")).toEqual([0,0,0,0]);
});
