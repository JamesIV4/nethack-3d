import { expect, it, vi } from "vitest";
vi.mock("../../state/gameStore",()=>({useGameStore:vi.fn()}));
import { hotbarContext, hotbarExpanded, initialVrHotbarState, toggleHotbar } from "./use-vr-hotbar";

it("auto-hides on each glance entry and requires the hamburger to open it",()=>{
  let state={...initialVrHotbarState};
  expect(hotbarExpanded(state,false)).toBe(true);
  expect(hotbarExpanded(state,true)).toBe(false); // before the context effect runs
  state=hotbarContext(state,true);expect(hotbarExpanded(state,true)).toBe(false);
  state=toggleHotbar(state,true);expect(hotbarExpanded(state,true)).toBe(true);
  state=hotbarContext(state,false);expect(hotbarExpanded(state,false)).toBe(true);
  state=hotbarContext(state,true);expect(hotbarExpanded(state,true)).toBe(false);
});
it("remembers normal hotbar visibility independently of the glance override",()=>{
  let state=toggleHotbar({...initialVrHotbarState},false);
  expect(hotbarExpanded(state,false)).toBe(false);
  state=hotbarContext(state,true);state=toggleHotbar(state,true);
  expect(hotbarExpanded(state,true)).toBe(true);
  state=hotbarContext(state,false);expect(hotbarExpanded(state,false)).toBe(false);
  state=toggleHotbar(state,false);expect(hotbarExpanded(state,false)).toBe(true);
});
