import { useState } from "react";
import { getUiFontFamilyCss, normalizeUiFontFamily } from "../../../game/ui-font";
import { t } from "../shared/translations";
import { OptionLabelWithInfo } from "./OptionLabelWithInfo";

type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<Array<{ family: string }>>;
};

export function ClientOptionFontControl({ value, onChange }: {
  value: string;
  onChange: (family: string) => void;
}): JSX.Element {
  const strings = t.uiFont;
  const [families, setFamilies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const canListFonts = typeof (window as LocalFontWindow).queryLocalFonts === "function";
  const choices = Array.from(new Set([value, ...families].filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));

  const browseFonts = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      // Only enumerate after this explicit click, allowing the browser to ask
      // for local-fonts permission. Font names stay on this device.
      const fonts = await (window as LocalFontWindow).queryLocalFonts!();
      const names = Array.from(new Set(fonts.map(font => normalizeUiFontFamily(font.family)).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));
      setFamilies(names);
      if (!names.length) setStatus(strings.unavailable);
    } catch {
      setStatus(strings.unavailable);
    } finally {
      setBusy(false);
    }
  };

  return <div className="nh3d-option-row nh3d-option-row-font">
    <div className="nh3d-option-copy">
      <OptionLabelWithInfo label={strings.label} description={strings.description} />
      <div className="nh3d-options-panel-description">{strings.description}</div>
      <div className="nh3d-ui-font-preview" style={{ fontFamily: getUiFontFamilyCss(value) }}>
        {strings.preview}
      </div>
      <div className="nh3d-options-panel-description" role="status">
        {status || (!canListFonts ? strings.unavailable : "")}
      </div>
    </div>
    <div className="nh3d-option-select-controls nh3d-option-select-controls-stacked">
      <select className="nh3d-startup-config-select" aria-label={strings.label}
        value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{strings.defaultFont}</option>
        {choices.map(family => <option key={family} value={family}>{family}</option>)}
      </select>
      {canListFonts ? <button type="button" className="nh3d-menu-action-button"
        disabled={busy} onClick={() => void browseFonts()}>{busy ? strings.loading : strings.browse}</button> : null}
      <button type="button" className="nh3d-menu-action-button" disabled={!value}
        onClick={() => onChange("")}>{strings.restoreDefault}</button>
      <input className="nh3d-startup-config-input" type="text" maxLength={200}
        aria-label={strings.fontName} placeholder={strings.fontName} value={value}
        spellCheck={false} autoComplete="off" onChange={event => onChange(event.target.value)} />
    </div>
  </div>;
}
