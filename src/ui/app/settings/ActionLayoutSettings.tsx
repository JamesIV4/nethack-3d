import { useMemo, useState } from "react";
import { actionCatalog } from "../actions/action-catalog";
import { defaultActionLayout, isActionAllowed, moveAction, setActionLayout, useActionLayout, type ActionArea } from "../actions/action-layout";
import { t } from "../shared/translations";

export function ActionLayoutSettings({ commands }: { commands: string[] }): JSX.Element {
  const layout = useActionLayout();
  const [area, setArea] = useState<ActionArea>("mobileHotbar");
  const [search, setSearch] = useState("");
  const catalog = useMemo(() => actionCatalog(commands), [commands]);
  const selected = layout[area];
  const setSelected = (ids: string[]) => setActionLayout({ ...layout, [area]: ids });
  const available = catalog.filter(a => isActionAllowed(area, a.id) && `${a.label} ${a.value}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <section className="nh3d-action-customization">
    <p>{t.actionCustomization.savedImmediately}</p>
    <label>{t.actionCustomization.customize} <select value={area} onChange={e => setArea(e.target.value as ActionArea)}>
      <option value="mobileHotbar">{t.actionCustomization.mobileHotbar}</option>
      <option value="desktopHotbar">{t.actionCustomization.desktopHotbar}</option>
      <option value="menuActions">{t.actionCustomization.menuActions}</option>
    </select></label>
    <h3>{t.actionCustomization.buttonOrder}</h3>
    <ol className="nh3d-action-order">
      {selected.map((id, index) => {
        const entry = catalog.find(a => a.id === id), label = entry?.label ?? id.replace(/^command:/, "");
        return <li key={id}>
          <span>{entry ? label : t.actionCustomization.unavailableInGame(label)}</span>
          <button type="button" aria-label={t.actionCustomization.moveEarlier(label)} disabled={index === 0} onClick={() => setSelected(moveAction(selected, index, -1))}>↑</button>
          <button type="button" aria-label={t.actionCustomization.moveLater(label)} disabled={index === selected.length - 1} onClick={() => setSelected(moveAction(selected, index, 1))}>↓</button>
          <button type="button" aria-label={t.actionCustomization.remove(label)} onClick={() => setSelected(selected.filter(x => x !== id))}>{t.actionCustomization.removeButton}</button>
        </li>;
      })}
    </ol>
    {!selected.length ? <p>{t.actionCustomization.noButtonsAdded}</p> : null}
    <h3>{t.actionCustomization.allCommands}</h3>
    <label>{t.actionCustomization.searchCommands} <input type="search" value={search} placeholder={t.actionCustomization.searchPlaceholder} onChange={e => setSearch(e.target.value)} /></label>
    <div className="nh3d-action-catalog">
      {available.map(action => <div key={action.id}><span>{action.label}</span>
        <button type="button" disabled={selected.includes(action.id) || selected.length >= 128} aria-label={t.actionCustomization.add(action.label)}
          onClick={() => setSelected([...selected, action.id])}>{selected.includes(action.id) ? t.actionCustomization.added : t.actionCustomization.addButton}</button></div>)}
      {!available.length ? <p>{t.actionCustomization.noMatchingCommands}</p> : null}
    </div>
    <button className="nh3d-menu-action-button" type="button" onClick={() => setActionLayout(defaultActionLayout)}>{t.actionCustomization.restoreDefaults}</button>
  </section>;
}
