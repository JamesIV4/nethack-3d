import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useGameStore } from "../../state/gameStore";
import { getWebXrState, subscribeWebXr } from "./presentation";

export type VrHotbarState = { normalOpen: boolean; glance: boolean; glanceOpen: boolean };
export const initialVrHotbarState: VrHotbarState = { normalOpen:true,glance:false,glanceOpen:false };
export const hotbarExpanded = (state: VrHotbarState, glance: boolean) => glance ? state.glance && state.glanceOpen : state.normalOpen;
export const hotbarContext = (state: VrHotbarState, glance: boolean): VrHotbarState => state.glance === glance ? state : {...state,glance,glanceOpen:false};
export function toggleHotbar(state: VrHotbarState, glance: boolean): VrHotbarState {
  return glance ? {...state,glance:true,glanceOpen:!hotbarExpanded(state,true)} : {...state,normalOpen:!state.normalOpen};
}

/** Both the VR hotbar and its menus must become available at the same time. */
export function useVrHotbarActive(): boolean {
  const xr = useSyncExternalStore(subscribeWebXr,getWebXrState,getWebXrState);
  const playing = useGameStore(s=>s.connectionState === "running" && !s.gameOver.active);
  return xr.active && playing;
}

export function useVrHotbar() {
  const active = useVrHotbarActive();
  const selecting = useGameStore(s=>s.positionInputActive && s.positionInputOrigin !== "travel" && s.positionInputOrigin !== "contextual-probe");
  const glance = active && selecting;
  const [state,setState] = useState(initialVrHotbarState);
  useLayoutEffect(()=>setState(previous=>hotbarContext(previous,glance)),[glance]);
  return { active, expanded: !active || hotbarExpanded(state,glance), toggle:()=>setState(previous=>toggleHotbar(previous,glance)) };
}
