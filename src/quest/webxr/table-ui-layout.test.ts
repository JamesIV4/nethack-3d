import { afterEach, expect, it, vi } from "vitest";
import { tableUiPanes } from "./table-ui-layout";

function fixture() {
  const nodes = new Map<string, object[]>();
  const add = (selector: string, left: number, top: number, width: number, height: number) => {
    nodes.set(selector, [{ offsetWidth: width, querySelectorAll: () => [], getBoundingClientRect: () => ({ left, top, right: left + width, bottom: top + height, width, height }) }]);
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
  f.add(".nh3d-context-menu", 600, 300, 400, 400);
  expect(tableUiPanes(false, [])).toEqual([...edges, [4, 0.3725, 0.296, 0.6275, 0.704]]);
  f.nodes.delete(".nh3d-context-menu");
  expect(tableUiPanes(false, [])).toEqual(edges);
});
it("does not promote an unmatched hit rectangle to an invisible upright pane", () => {
  fixture(); const edges = tableUiPanes(false, []);
  expect(tableUiPanes(false, [.4, .35, .6, .65])).toEqual(edges);
});
it("refreshes a resized modal crop without changing the edge crops", () => {
  const f = fixture(), edges = tableUiPanes(false, []);
  f.add(".nh3d-dialog", 500, 200, 600, 500);
  expect(tableUiPanes(false, []).slice(0, 4)).toEqual(edges);
  f.add(".nh3d-dialog", 500, 150, 600, 600);
  expect(tableUiPanes(false, [])).toEqual([...edges, [4, .31, .146, .69, .754]]);
});
it("retains the single world-anchored HUD in first-person mode", () => {
  const f=fixture(); f.nodes.delete(".nh3d-mobile-bottom-bar"); f.nodes.delete(".nh3d-desktop-bottom-actions");
  expect(tableUiPanes(true, [])).toEqual([[7, 0, 0, 1, 1]]);
});
it("cuts a first-person modal out of the HUD rather than duplicating it at full size", () => {
  const f = fixture(); f.nodes.delete(".nh3d-mobile-bottom-bar"); f.nodes.delete(".nh3d-desktop-bottom-actions"); f.add(".nh3d-dialog", 400, 200, 800, 600);
  const panes = tableUiPanes(true, []), modal = panes.find(p => p[0] === 4)!;
  expect(modal).toEqual([4, .2475, .196, .7525, .804]);
  for (const p of panes.filter(p => p[0] !== 4)) {
    expect(Math.min(p[3], modal[3]) <= Math.max(p[1], modal[1]) || Math.min(p[4], modal[4]) <= Math.max(p[2], modal[2])).toBe(true);
  }
  expect(panes.reduce((area,p) => area + (p[3]-p[1])*(p[4]-p[2]), 0)).toBeCloseTo(1);
});
it("assigns separate panes to the minimap, actions, and table controls", () => {
  const f = fixture();
  f.add(".nh3d-minimap", 1300, 0, 300, 80);
  f.add(".nh3d-xr-table-controls", 600, 800, 400, 100);
  const panes = tableUiPanes(false, []);
  expect(panes.find(p => p[0] === 2)).toEqual([2, .81, .096, 1, .804]);
  expect(panes.find(p => p[0] === 5)).toEqual([5, .8125, 0, 1, .08]);
  expect(panes.find(p => p[0] === 6)).toEqual([6, .375, .8, .625, .9]);
});
it("separates first-person actions from the upper HUD without painting a second copy", () => {
  const f=fixture(); f.nodes.delete(".nh3d-desktop-bottom-actions");
  const panes=tableUiPanes(true, []), actions=panes.find(p=>p[0]===2)!;
  expect(actions).toEqual([2,.81,.096,1,.804]);
  for(const p of panes.filter(p=>p[0]>=7)) expect(
    Math.min(p[3],actions[3])<=Math.max(p[1],actions[1]) || Math.min(p[4],actions[4])<=Math.max(p[2],actions[2])
  ).toBe(true);
  expect(panes.reduce((a,p)=>a+(p[3]-p[1])*(p[4]-p[2]),0)).toBeCloseTo(1);
});
