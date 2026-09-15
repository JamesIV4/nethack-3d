import { useState, useSyncExternalStore } from "react";
import { getXrSettings, setXrSettings, subscribeXrSettings } from "./settings";
export function TableControls(): JSX.Element {
  const settings = useSyncExternalStore(subscribeXrSettings, getXrSettings, getXrSettings);
  const [selected, select] = useState<"area" | "scale" | null>(null);
  return <div className="nh3d-xr-table-controls" data-xr-ui>
    <div className="nh3d-xr-table-icons">
      {(["area", "scale"] as const).map(key => <button type="button" key={key} className="nh3d-mobile-bottom-button"
        title={key === "area" ? "Visible map area" : "World scale"} aria-label={key === "area" ? "Visible map area" : "World scale"}
        aria-expanded={selected === key} onClick={() => select(selected === key ? null : key)}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          {key === "area" ? <><path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/></> : <><path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6M4 4l6 6m4 4l6 6"/><path d="M9 9h6v6H9z"/></>}
        </svg>
      </button>)}
    </div>
    {selected && <label>{selected === "area" ? "Visible map area" : "World scale"}: {Math.round(settings[selected] * 100)}%
      <input aria-label={selected === "area" ? "Visible map area" : "World scale"} type="range" min={selected === "area" ? 1 : .5} max="2" step="0.1"
        value={settings[selected]} onChange={event => setXrSettings({ [selected]: Number(event.target.value) })}/>
    </label>}
  </div>;
}
