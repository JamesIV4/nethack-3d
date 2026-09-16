import { afterEach, expect, it, vi } from "vitest";
import { uiHitRectangles } from "./dom-pointer";

afterEach(() => vi.unstubAllGlobals());

it("keeps HTML canvases interactive while excluding only the game renderer", () => {
  const canvas = (renderer: boolean, left: number) => ({
    matches: (selector: string) => renderer && selector === ".nh3d-canvas-root > canvas",
    closest: () => null,
    parentElement: null,
    getBoundingClientRect: () => ({ left, top: 100, right: left + 100, bottom: 200 }),
  });
  const game = canvas(true, 0), minimap = canvas(false, 200);
  vi.stubGlobal("innerWidth", 1000); vi.stubGlobal("innerHeight", 1000);
  vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible", display: "block", opacity: "1", pointerEvents: "auto", overflowX: "visible", overflowY: "visible" }));
  vi.stubGlobal("document", { querySelectorAll: () => [game, minimap], body: null });
  expect(uiHitRectangles()).toEqual([0, .1, .1, .2, .2, .1, .3, .2]);
  expect(uiHitRectangles({ excludeRendererCanvas: true })).toEqual([.2, .1, .3, .2]);
});
