import { afterEach, expect, it, vi } from "vitest";
import { hasWorldContextAnchor } from "./context-anchor";
afterEach(() => vi.unstubAllGlobals());
function fixture(entries: Array<[string, boolean]>) {
  const nodes = entries.map(([selector, visible]) => ({selector, visible}));
  vi.stubGlobal("getComputedStyle", (node: {visible:boolean}) => ({display:node.visible?"block":"none",visibility:"visible",opacity:"1"}));
  return {querySelectorAll: (selector:string) => nodes.filter(node=>selector.split(",").includes(node.selector))} as unknown as ParentNode;
}
it("does not reuse a tile anchor for an inventory context menu", () => {
  expect(hasWorldContextAnchor(fixture([[".nh3d-inventory-context-menu.is-visible",true]]))).toBe(false);
});
it("keeps a visible inventory pane stationary even if a world menu is still mounted", () => {
  expect(hasWorldContextAnchor(fixture([[".nh3d-dialog",true],[".nh3d-tile-context-menu.is-visible",true]]))).toBe(false);
});
it("allows world-action anchoring when there is no visible modal", () => {
  expect(hasWorldContextAnchor(fixture([[".nh3d-dialog",false],[".nh3d-tile-context-menu.is-visible",true]]))).toBe(true);
  expect(hasWorldContextAnchor(fixture([[".nh3d-fps-crosshair-context.is-visible",true]]))).toBe(true);
});
it("does not anchor to hidden world menus", () => {
  expect(hasWorldContextAnchor(fixture([[".nh3d-tile-context-menu.is-visible",false]]))).toBe(false);
});
