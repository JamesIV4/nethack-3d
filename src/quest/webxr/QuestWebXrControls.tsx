import { OptionSliderRow } from "../../ui/app/settings/OptionSliderRow";
import { useSyncExternalStore } from "react";
import { getWebXrState, subscribeWebXr, toggleWebXr, recenterWebXr } from "./presentation";
import "./webxr.css";
import { getXrSettings, setXrSettings, subscribeXrSettings, WEBXR_WEAPON_ATTACKS_ENABLED } from "./settings";
import { OptionLabelWithInfo } from "../../ui/app/settings/OptionLabelWithInfo";
import { isQuestApk } from "./host";

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
  { key: "scale", label: "Tabletop world scale", description: "Resize the tabletop world without changing the visible map area or UI size.", min: 0.5, max: 2 },
  { key: "resolution", label: "VR render resolution", description: "Resolution changes apply when you next enter VR.", min: 0.5, max: 2 },
] as const;

export function QuestWebXrSettings(): JSX.Element | null {
  const settings = useSyncExternalStore(subscribeXrSettings, getXrSettings, getXrSettings);
  const state = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState);
  if (!isQuestApk()) return null;
  return <>
    <OptionSliderRow label="FPS world scale"
      description="Resize the immersive first-person world immediately. 100% restores the original size. Controllers, held weapons and UI keep their physical size."
      valueLabel={`${Math.round(settings.fpsScale * 100)}%${settings.fpsScale === 1 ? " (default)" : ""}`}>
      <div className="nh3d-xr-fps-scale-slider">
        <input aria-label="FPS world scale" className="nh3d-option-slider" type="range"
          min="0.5" max="2" step="0.05" value={settings.fpsScale} list="nh3d-xr-fps-scale-default"
          aria-valuetext={`${Math.round(settings.fpsScale * 100)} percent${settings.fpsScale === 1 ? ", default" : ""}`}
          onInput={event => setXrSettings({ fpsScale: Number(event.currentTarget.value) })}
          onChange={event => setXrSettings({ fpsScale: Number(event.currentTarget.value) })} />
        <datalist id="nh3d-xr-fps-scale-default"><option value="1" label="Default" /></datalist>
        <button type="button" className="nh3d-xr-fps-scale-default" aria-label="Reset FPS world scale to 100 percent"
          onClick={() => setXrSettings({ fpsScale: 1 })}>Default</button>
      </div>
    </OptionSliderRow>
    {WEBXR_WEAPON_ATTACKS_ENABLED ? <><div className="nh3d-option-row nh3d-option-row-inline-toggle">
      <div className="nh3d-option-copy"><OptionLabelWithInfo label="Weapon gestures"
        description="Swing a held weapon to attack in first-person VR. Recover to a quiet position before the next attack." /></div>
      <button aria-label="Weapon gestures" aria-checked={settings.swipeAttacks} role="switch" type="button"
        className={`nh3d-option-switch nh3d-option-inline-switch${settings.swipeAttacks ? " is-on" : ""}`}
        onClick={() => setXrSettings({ swipeAttacks: !settings.swipeAttacks })}><span className="nh3d-option-switch-thumb" /></button>
    </div>
    <OptionSliderRow label="Weapon gesture sensitivity" description="Higher values accept lighter swings."
      valueLabel={`${Math.round(settings.swipeSensitivity * 100)}%`}>
      <input aria-label="Weapon gesture sensitivity" className="nh3d-option-slider" type="range" min="0.5" max="2.5" step="0.1"
        value={settings.swipeSensitivity} onChange={event => setXrSettings({ swipeSensitivity: Number(event.currentTarget.value) })} />
    </OptionSliderRow></> : null}
    {vrSliders.map(option => <OptionSliderRow key={option.key} label={option.label}
      description={option.description + (option.key === "resolution" && state.renderResolution ? ` Current render size: ${state.renderResolution}.` : "")}
      valueLabel={`${Math.round(settings[option.key] * 100)}%`}>
      <input aria-label={option.label} className="nh3d-option-slider" type="range"
        min={option.min} max={option.max} step="0.1" value={settings[option.key]}
        onInput={event => setXrSettings({ [option.key]: Number(event.currentTarget.value) })}
        onChange={event => setXrSettings({ [option.key]: Number(event.currentTarget.value) })} />
    </OptionSliderRow>)}
    <div className="nh3d-option-row nh3d-option-row-inline-toggle">
      <div className="nh3d-option-copy">
        <OptionLabelWithInfo label="Instant movement"
          description="Move immediately between dungeon tiles instead of using the standard first-person movement animation." />
      </div>
        <button aria-label="Instant movement" aria-checked={settings.instantMovement}
        className={`nh3d-option-switch nh3d-option-inline-switch${settings.instantMovement ? " is-on" : ""}`}
        onClick={() => setXrSettings({ instantMovement: !settings.instantMovement })} role="switch" type="button">
        <span className="nh3d-option-switch-thumb" />
      </button>
    </div>
    <div className="nh3d-menu-actions">
      <QuestWebXrButton className="nh3d-menu-action-button" />
      <button type="button" className="nh3d-menu-action-button" disabled={!state.active}
        onClick={recenterWebXr}>Recenter world</button>
    </div>
    {state.error ? <p role="alert">{state.error}</p> : null}
  </>;
}
