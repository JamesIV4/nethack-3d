import { OptionSliderRow } from "../../ui/app/settings/OptionSliderRow";
import { useSyncExternalStore } from "react";
import { getWebXrState, subscribeWebXr, toggleWebXr, recenterWebXr } from "./presentation";
import "./webxr.css";
import { getXrSettings, setXrSettings, subscribeXrSettings, WEBXR_WEAPON_ATTACKS_ENABLED } from "./settings";
import { OptionLabelWithInfo } from "../../ui/app/settings/OptionLabelWithInfo";
import { isQuestApk } from "./host";
import { t } from "../../ui/app/shared/translations";

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
    {state.busy ? t.webxr.opening : state.active ? t.webxr.exit : t.webxr.enter}
  </button>;
}

const vrSliders = [
  { key: "area", label: t.webxr.tabletopVisibleAreaLabel, description: t.webxr.tabletopVisibleAreaDescription, min: 1, max: 2 },
  { key: "scale", label: t.webxr.tabletopWorldScaleLabel, description: t.webxr.tabletopWorldScaleDescription, min: 0.5, max: 2 },
  { key: "resolution", label: t.webxr.renderResolutionLabel, description: t.webxr.renderResolutionDescription, min: 0.5, max: 2 },
] as const;

export function QuestWebXrSettings(): JSX.Element | null {
  const settings = useSyncExternalStore(subscribeXrSettings, getXrSettings, getXrSettings);
  const state = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState);
  if (!isQuestApk()) return null;
  return <>
    <OptionSliderRow label={t.webxr.fpsWorldScaleLabel}
      description={t.webxr.fpsWorldScaleDescription}
      valueLabel={t.webxr.fpsScaleValue(Math.round(settings.fpsScale * 100), settings.fpsScale === 1)}>
      <div className="nh3d-xr-fps-scale-slider">
        <input aria-label={t.webxr.fpsWorldScaleLabel} className="nh3d-option-slider" type="range"
          min="0.5" max="2" step="0.05" value={settings.fpsScale} list="nh3d-xr-fps-scale-default"
          aria-valuetext={t.webxr.fpsScaleAriaValue(Math.round(settings.fpsScale * 100), settings.fpsScale === 1)}
          onInput={event => setXrSettings({ fpsScale: Number(event.currentTarget.value) })}
          onChange={event => setXrSettings({ fpsScale: Number(event.currentTarget.value) })} />
        <datalist id="nh3d-xr-fps-scale-default"><option value="1" label={t.webxr.defaultLabel} /></datalist>
        <button type="button" className="nh3d-xr-fps-scale-default" aria-label={t.webxr.resetFpsWorldScaleLabel}
          onClick={() => setXrSettings({ fpsScale: 1 })}>{t.webxr.defaultLabel}</button>
      </div>
    </OptionSliderRow>
    {WEBXR_WEAPON_ATTACKS_ENABLED ? <><div className="nh3d-option-row nh3d-option-row-inline-toggle">
      <div className="nh3d-option-copy"><OptionLabelWithInfo label={t.webxr.weaponGesturesLabel}
        description={t.webxr.weaponGesturesDescription} /></div>
      <button aria-label={t.webxr.weaponGesturesLabel} aria-checked={settings.swipeAttacks} role="switch" type="button"
        className={`nh3d-option-switch nh3d-option-inline-switch${settings.swipeAttacks ? " is-on" : ""}`}
        onClick={() => setXrSettings({ swipeAttacks: !settings.swipeAttacks })}><span className="nh3d-option-switch-thumb" /></button>
    </div>
    <OptionSliderRow label={t.webxr.weaponSensitivityLabel} description={t.webxr.weaponSensitivityDescription}
      valueLabel={`${Math.round(settings.swipeSensitivity * 100)}%`}>
      <input aria-label={t.webxr.weaponSensitivityLabel} className="nh3d-option-slider" type="range" min="0.5" max="2.5" step="0.1"
        value={settings.swipeSensitivity} onChange={event => setXrSettings({ swipeSensitivity: Number(event.currentTarget.value) })} />
    </OptionSliderRow></> : null}
    {vrSliders.map(option => <OptionSliderRow key={option.key} label={option.label}
      description={option.description + (option.key === "resolution" && state.renderResolution ? t.webxr.currentRenderSize(state.renderResolution) : "")}
      valueLabel={`${Math.round(settings[option.key] * 100)}%`}>
      <input aria-label={option.label} className="nh3d-option-slider" type="range"
        min={option.min} max={option.max} step="0.1" value={settings[option.key]}
        onInput={event => setXrSettings({ [option.key]: Number(event.currentTarget.value) })}
        onChange={event => setXrSettings({ [option.key]: Number(event.currentTarget.value) })} />
    </OptionSliderRow>)}
    <div className="nh3d-option-row nh3d-option-row-inline-toggle">
      <div className="nh3d-option-copy">
        <OptionLabelWithInfo label={t.webxr.instantMovementLabel}
          description={t.webxr.instantMovementDescription} />
      </div>
        <button aria-label={t.webxr.instantMovementLabel} aria-checked={settings.instantMovement}
        className={`nh3d-option-switch nh3d-option-inline-switch${settings.instantMovement ? " is-on" : ""}`}
        onClick={() => setXrSettings({ instantMovement: !settings.instantMovement })} role="switch" type="button">
        <span className="nh3d-option-switch-thumb" />
      </button>
    </div>
    <div className="nh3d-menu-actions">
      <QuestWebXrButton className="nh3d-menu-action-button" />
      <button type="button" className="nh3d-menu-action-button" disabled={!state.active}
        onClick={recenterWebXr}>{t.webxr.recenterWorldLabel}</button>
    </div>
    {state.error ? <p role="alert">{state.error}</p> : null}
  </>;
}
