import { afterEach, expect, it, vi } from "vitest";
import { tableUiPanes } from "./table-ui-layout";

function fixture() {
  const nodes = new Map<string, object[]>();
  const add = (selector: string, left: number, top: number, width: number, height: number) => {
    nodes.set(selector, [{ getBoundingClientRect: () => ({ left, top, right: left + width, bottom: top + height, width, height }) }]);
  };
  vi.stubGlobal("innerWidth", 1600); vi.stubGlobal("innerHeight", 1000);
  vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible", display: "block", opacity: "1" }));
  vi.stubGlobal("document", { querySelectorAll: (query: string) => query.split(",").flatMap(s => nodes.get(s) ?? []) });
  add("#stats-bar", 0, 0, 1600, 80);
  add(".top-left-ui", 0, 100, 300, 600);
  add(".nh3d-mobile-bottom-bar", 1300, 100, 300, 700);
  add(".nh3d-desktop-bottom-actions", 400, 900, 800, 100);
  return { add, nodes };
}
afterEach(() => vi.unstubAllGlobals());

it("keeps all four edge crops unchanged while quick actions open and close", () => {
  const f = fixture(), edges = tableUiPanes(false, []);
  f.add(".nh3d-context-menu.is-visible", 600, 300, 400, 400);
  expect(tableUiPanes(false, [])).toEqual([...edges, [4, 0.375, 0.3, 0.625, 0.7]]);
  f.nodes.delete(".nh3d-context-menu.is-visible");
  expect(tableUiPanes(false, [])).toEqual(edges);
});
it("gives an unfamiliar popover a tight floating crop without relocating the HUD", () => {
  fixture(); const edges = tableUiPanes(false, []);
  expect(tableUiPanes(false, [.4, .35, .6, .65])).toEqual([...edges, [4, .4, .35, .6, .65]]);
});
it("refreshes a resized modal crop without changing the edge crops", () => {
  const f = fixture(), edges = tableUiPanes(false, []);
  f.add(".nh3d-dialog.is-visible", 500, 200, 600, 500);
  expect(tableUiPanes(false, []).slice(0, 4)).toEqual(edges);
  f.add(".nh3d-dialog.is-visible", 500, 150, 600, 600);
  expect(tableUiPanes(false, [])).toEqual([...edges, [4, .3125, .15, .6875, .75]]);
});
it("retains the single world-anchored HUD in first-person mode", () => {
  fixture(); expect(tableUiPanes(true, [])).toEqual([[4, 0, 0, 1, 1]]);
});
