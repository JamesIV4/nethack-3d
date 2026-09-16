import { afterEach, expect, it, vi } from "vitest";
import { isVisibleUi, clipUiBounds } from "./visibility";

afterEach(()=>vi.unstubAllGlobals());
function node(style: Record<string,string> = {}, parentElement: unknown = null) {
  return { parentElement, isConnected: true, closest: () => null, getClientRects: () => [{}],
    getBoundingClientRect: () => ({left:0,top:0,right:100,bottom:100}),
    style: {display:"block",visibility:"visible",opacity:"1",overflowX:"visible",overflowY:"visible",...style},
  };
}
function styles() { vi.stubGlobal("getComputedStyle", (element: ReturnType<typeof node>)=>element.style); }
it("excludes disconnected, unrendered, hidden-ancestor and effectively transparent UI", () => {
  styles(); const element = node();
  expect(isVisibleUi(element as unknown as HTMLElement)).toBe(true);
  element.isConnected=false; expect(isVisibleUi(element as unknown as HTMLElement)).toBe(false);
  element.isConnected=true; element.getClientRects=()=>[]; expect(isVisibleUi(element as unknown as HTMLElement)).toBe(false);
  expect(isVisibleUi(node({},node({contentVisibility:"hidden"})) as unknown as HTMLElement)).toBe(false);
  expect(isVisibleUi(node({opacity:".01"},node({opacity:".01"})) as unknown as HTMLElement)).toBe(false);
});
it("does not retain a UI crop when a collapsed ancestor clips all of it", () => {
  styles(); vi.stubGlobal("innerWidth",1000);vi.stubGlobal("innerHeight",1000);
  const parent=node({overflowY:"hidden"});parent.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:0});
  const child=node({},parent);
  expect(clipUiBounds(child as unknown as HTMLElement,child.getBoundingClientRect())).toBeNull();
});
