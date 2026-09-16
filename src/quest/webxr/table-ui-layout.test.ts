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

it("trims status shadow padding before the separate minimap source", () => {
  const f = fixture();
  f.add(".nh3d-minimap", 500, 82, 600, 160);
  for (const firstPerson of [false, true]) {
    const panes = tableUiPanes(firstPerson, []);
    expect(panes.find(p => p[0] === 0)![4]).toBe(.082);
    expect(panes.find(p => p[0] === 5)![2]).toBe(.082);
  }
});

it("crops the menu logo independently of dialogs and excludes game panes", () => {
  const f = fixture();
  Object.assign(document, { documentElement: { classList: { contains: (name: string) => name === "nh3d-xr-menu" } } });
  f.add(".logo-container", 300, 10, 1000, 280);
  f.add(".nh3d-dialog", 500, 400, 600, 420);
  const panes = tableUiPanes(false, []);
  expect(panes.map(p => p[0])).toEqual([12, 13]);
  expect(panes[0][4]).toBeLessThan(panes[1][2]);
  expect(tableUiPanes(true, [])).toEqual(panes);
});

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
it("keeps an input-anchored select list in a child pane without enlarging its dialog crop", () => {
  const f = fixture();
  f.add(".nh3d-dialog", 500, 200, 600, 500);
  const before = tableUiPanes(false, []);
  f.add(".nh3d-select-menu", 820, 410, 240, 260);
  const panes = tableUiPanes(false, []);
  expect(panes.find(p => p[0] === 4)).toEqual(before.find(p => p[0] === 4));
  expect(panes.find(p => p[0] === 15)).toEqual([15, .51, .406, .665, .674]);
});
it("keeps a full first-person HUD source pane beside the dedicated status pane", () => {
  const f=fixture(); f.nodes.delete(".nh3d-mobile-bottom-bar"); f.nodes.delete(".nh3d-desktop-bottom-actions");
  const panes = tableUiPanes(true, []);
  expect(panes.find(p => p[0] === 0)).toEqual([0, 0, 0, 1, .084]);
  expect(panes.find(p => p[0] === 7)).toEqual([7, 0, 0, 1, 1]);
});
it("cuts a first-person modal out of the HUD rather than duplicating it at full size", () => {
  const f = fixture(); f.nodes.delete(".nh3d-mobile-bottom-bar"); f.nodes.delete(".nh3d-desktop-bottom-actions"); f.add(".nh3d-dialog", 400, 200, 800, 600);
  const panes = tableUiPanes(true, []), modal = panes.find(p => p[0] === 4)!;
  expect(modal).toEqual([4, .2475, .196, .7525, .804]);
  expect(panes.find(p => p[0] === 7)).toEqual([7, 0, 0, 1, 1]);
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
it("unions the repeat action above the bottom bar into the existing action pane", () => {
  const f = fixture();
  f.add(".nh3d-mobile-repeat-button", 1300, 820, 300, 40);
  const panes = tableUiPanes(false, []);
  expect(panes.filter(p => p[0] === 2)).toEqual([[2, .81, .096, 1, .864]]);
  expect(tableUiPanes(true, []).filter(p => p[0] === 2)).toEqual([[2, .81, .096, 1, .864]]);
});
it("separates first-person actions from the upper HUD without painting a second copy", () => {
  const f=fixture(); f.nodes.delete(".nh3d-desktop-bottom-actions");
  const panes=tableUiPanes(true, []), actions=panes.find(p=>p[0]===2)!;
  expect(actions).toEqual([2,.81,.096,1,.804]);
  expect(panes.find(p => p[0] === 7)).toEqual([7, 0, 0, 1, 1]);
});
it("keeps the first-person minimap interactive in pane 5 without duplicating it in the HUD", () => {
  const f = fixture();
  f.add(".nh3d-minimap", 500, 100, 600, 160);
  const panes = tableUiPanes(true, []), minimap = panes.find(p => p[0] === 5)!;
  expect(minimap).toEqual([5, .3125, .1, .6875, .26]);
  // The message source at x=.1/y=.5 lies outside status, minimap, and action
  // crops, so the full HUD pane still supplies it to the native mask pass.
  const hud = panes.find(p => p[0] === 7)!;
  expect(hud).toEqual([7, 0, 0, 1, 1]);
  expect(.1 >= hud[1] && .1 <= hud[3] && .5 >= hud[2] && .5 <= hud[4]).toBe(true);
  for (const hole of panes.filter(p => p[0] === 0 || p[0] === 2 || p[0] === 5)) {
    expect(.1 >= hole[1] && .1 <= hole[3] && .5 >= hole[2] && .5 <= hole[4]).toBe(false);
  }
});
