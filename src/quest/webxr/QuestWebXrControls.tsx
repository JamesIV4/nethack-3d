import { OptionSliderRow } from "../../ui/app/settings/OptionSliderRow";
import { useSyncExternalStore } from "react";
import { getWebXrState, subscribeWebXr, toggleWebXr, recenterWebXr } from "./presentation";
import "./webxr.css";
import { getXrSettings, setXrSettings, subscribeXrSettings } from "./settings";

export function QuestWebXrButton({
  className = "nh3d-desktop-bottom-button",
  hideWhenActive = false,
}: {
  className?: string;
  hideWhenActive?: boolean;
}): JSX.Element | null {
  const state = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState);
  if (!state.host || (hideWhenActive && state.active)) return null;
  return <button type="button" className={className} disabled={!state.available || state.busy}
    aria-pressed={state.active} onClick={() => { void toggleWebXr(); }}>
    {state.busy ? "Opening VR…" : state.active ? "Exit VR" : "Enter VR"}
  </button>;
}

const vrSliders = [
  { key: "area", label: "Tabletop visible area", description: "Increase the map area shown on the table without changing tile size.", min: 1, max: 2 },
  { key: "scale", label: "VR world scale", description: "Resize the game world without changing the visible map area or UI size.", min: 0.5, max: 2 },
  { key: "resolution", label: "VR render resolution", description: "Resolution changes apply when you next enter VR.", min: 0.5, max: 2 },
] as const;

export function QuestWebXrSettings(): JSX.Element | null {
  const settings = useSyncExternalStore(subscribeXrSettings, getXrSettings, getXrSettings);
  const state = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState);
  if (!state.host) return null;
  // Controller weapons and their gesture toggle/sensitivity controls are paused.
  // Their saved settings and detector implementation remain available for revisit.
  return <>
    {vrSliders.map(option => <OptionSliderRow key={option.key} label={option.label}
      description={option.description + (option.key === "resolution" && state.renderResolution ? ` Current render size: ${state.renderResolution}.` : "")}
      valueLabel={`${Math.round(settings[option.key] * 100)}%`}>
      <input aria-label={option.label} className="nh3d-option-slider" type="range"
        min={option.min} max={option.max} step="0.1" value={settings[option.key]}
        onInput={event => setXrSettings({ [option.key]: Number(event.currentTarget.value) })}
        onChange={event => setXrSettings({ [option.key]: Number(event.currentTarget.value) })} />
    </OptionSliderRow>)}
    <div className="nh3d-menu-actions">
      <QuestWebXrButton className="nh3d-menu-action-button" />
      <button type="button" className="nh3d-menu-action-button" disabled={!state.active}
        onClick={recenterWebXr}>Recenter world</button>
    </div>
    {state.error ? <p role="alert">{state.error}</p> : null}
  </>;
}
