import { useSyncExternalStore } from "react";
import { getWebXrState, subscribeWebXr, toggleWebXr, recenterWebXr } from "./presentation";
import "./webxr.css";

export function QuestWebXrButton({ className = "nh3d-desktop-bottom-button" }: { className?: string }): JSX.Element | null {
  const state = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState);
  if (!state.host) return null;
  return <button type="button" className={className} disabled={!state.available || state.busy}
    aria-pressed={state.active} onClick={() => { void toggleWebXr(); }}>
    {state.busy ? "Opening VR…" : state.active ? "Exit VR" : "Enter VR"}
  </button>;
}

export function QuestWebXrSettings(): JSX.Element | null {
  const state = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState);
  if (!state.host) return null;
  return <div className="nh3d-quest-xr-settings">
    <div className="nh3d-options-group-title">Virtual reality</div>
    <p>The first-person option below selects the surrounding dungeon. Turn it off for a tabletop board.</p>
    <div className="nh3d-menu-actions">
      <QuestWebXrButton className="nh3d-menu-action-button" />
      <button type="button" className="nh3d-menu-action-button" disabled={!state.active}
        onClick={recenterWebXr}>Recenter world</button>
    </div>
    {state.error ? <p role="alert">{state.error}</p> : null}
  </div>;
}
