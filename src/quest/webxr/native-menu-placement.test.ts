import { afterEach, expect, it, vi } from "vitest";
import { NativePointerBridge } from "./native-pointer-bridge";
import * as THREE from "three";
vi.mock("./dom-pointer", () => ({ uiHitRectangles: () => [] }));
vi.mock("./table-ui-layout", () => ({ tableUiPanes: () => [[2,.1,.8,.9,.95]] }));
vi.mock("./context-anchor", () => ({ hasWorldContextAnchor: () => false }));
vi.mock("./presentation", () => ({ recenterWebXr: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("hinges Actions and horizontally centered Extended above the bar, but centers Pause and its submenus", async () => {
  let actionsVisible = false,extended=false;
  const doc = Object.assign(new EventTarget(), {
    body: {}, documentElement: {},
    querySelector: (selector: string) => selector === ".nh3d-mobile-actions-sheet" && actionsVisible ? {getAttribute:()=>extended?"extended":"quick"} : null,
  });
  vi.stubGlobal("document",doc); vi.stubGlobal("window",new EventTarget());
  vi.stubGlobal("innerWidth",1000); vi.stubGlobal("innerHeight",1000);
  vi.stubGlobal("getComputedStyle",()=>({display:"block",visibility:"visible",opacity:"1"}));
  vi.stubGlobal("MutationObserver",class { observe() {} disconnect() {} });
  const fetcher = vi.fn(async () => new Response()); vi.stubGlobal("fetch",fetcher);
  const bridge = new NativePointerBridge();
  const update = async (time: number) => { bridge.update(time); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  const click = (kind: string) => {
    const button = { dataset: { nh3dMenuAnchor:kind }, getAttribute: () => "false", getBoundingClientRect: () => ({left:400,top:820,width:100,height:50}) };
    const event = new Event("click"); Object.defineProperty(event,"target",{value:{closest:()=>button}}); doc.dispatchEvent(event);
  };
  const anchorMode = () => JSON.parse((fetcher.mock.calls as unknown as [string,RequestInit][])[fetcher.mock.calls.length-1][1].body as string)[20];
  const anchor = () => JSON.parse((fetcher.mock.calls as unknown as [string,RequestInit][])[fetcher.mock.calls.length-1][1].body as string).slice(21,24);
  await update(0); click("actions"); actionsVisible = true; await update(100);
  expect(anchorMode()).toBe(2);
  expect(anchor()).toEqual([.45,.82,2]);
  extended=true;await update(150);expect(anchorMode()).toBe(2);
  expect(anchor()).toEqual([.5,.82,2]);
  extended=false;await update(190);expect(anchorMode()).toBe(2);
  expect(anchor()).toEqual([.45,.82,2]);
  click("center"); actionsVisible = false; await update(250);
  expect(anchorMode()).toBe(0);
  await update(800); // Options or another pause submenu retains normal placement.
  expect(anchorMode()).toBe(0);
  bridge.setBoard(true,0,-.65);
  bridge.hit("left",new THREE.Ray(),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,1),new THREE.Matrix4(),true);
  await update(900);
  const headers = () => (fetcher.mock.calls as unknown as [string,RequestInit][])[fetcher.mock.calls.length-1][1].headers as Record<string,string>;
  expect(headers()["X-NH3D-Loot-Hits"]).toBe("1");
  bridge.forget("left"); await update(1000);
  expect(headers()["X-NH3D-Loot-Hits"]).toBe("0");
  bridge.dispose();
});
