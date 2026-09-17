import { useMemo, useState } from "react";
import { actionCatalog } from "../actions/action-catalog";
import { defaultActionLayout, isActionAllowed, moveAction, setActionLayout, useActionLayout, type ActionArea } from "../actions/action-layout";

export function ActionLayoutSettings({ commands }: { commands: string[] }): JSX.Element {
  const layout = useActionLayout();
  const [area, setArea] = useState<ActionArea>("mobileHotbar");
  const [search, setSearch] = useState("");
  const catalog = useMemo(() => actionCatalog(commands), [commands]);
  const selected = layout[area];
  const setSelected = (ids: string[]) => setActionLayout({ ...layout, [area]: ids });
  const available = catalog.filter(a => isActionAllowed(area, a.id) && `${a.label} ${a.value}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <section className="nh3d-action-customization">
    <p>Changes are saved immediately. Restore Defaults resets all three button layouts.</p>
    <label>Customize <select value={area} onChange={e => setArea(e.target.value as ActionArea)}>
      <option value="mobileHotbar">Hotbar (mobile / VR)</option>
      <option value="desktopHotbar">Hotbar (desktop)</option>
      <option value="menuActions">Menu / Actions</option>
    </select></label>
    <h3>Button order</h3>
    <ol className="nh3d-action-order">
      {selected.map((id, index) => {
        const entry = catalog.find(a => a.id === id), label = entry?.label ?? id.replace(/^command:/, "");
        return <li key={id}>
          <span>{label}{!entry ? " (unavailable in this game)" : ""}</span>
          <button type="button" aria-label={`Move ${label} earlier`} disabled={index === 0} onClick={() => setSelected(moveAction(selected, index, -1))}>↑</button>
          <button type="button" aria-label={`Move ${label} later`} disabled={index === selected.length - 1} onClick={() => setSelected(moveAction(selected, index, 1))}>↓</button>
          <button type="button" aria-label={`Remove ${label}`} onClick={() => setSelected(selected.filter(x => x !== id))}>Remove</button>
        </li>;
      })}
    </ol>
    {!selected.length ? <p>No buttons added yet.</p> : null}
    <h3>All commands</h3>
    <label>Search commands <input type="search" value={search} placeholder="Search by name" onChange={e => setSearch(e.target.value)} /></label>
    <div className="nh3d-action-catalog">
      {available.map(action => <div key={action.id}><span>{action.label}</span>
        <button type="button" disabled={selected.includes(action.id) || selected.length >= 128} aria-label={`Add ${action.label}`}
          onClick={() => setSelected([...selected, action.id])}>{selected.includes(action.id) ? "Added" : "Add"}</button></div>)}
      {!available.length ? <p>No matching commands.</p> : null}
    </div>
    <button className="nh3d-menu-action-button" type="button" onClick={() => setActionLayout(defaultActionLayout)}>Restore Defaults</button>
  </section>;
}
