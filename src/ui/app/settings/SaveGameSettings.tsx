import { useEffect, useRef, useState } from "react";
import type { NethackRuntimeVersion } from "../../../runtime/types";
import { t } from "../shared/translations";
import { fetchSavedGames, type SaveGameRecord } from "../startup/saved-games";
import { exportSavedGame, importSavedGame, MAX_SAVE_ARCHIVE_BYTES, SaveTransferError } from "../startup/save-transfer";
import { resolveRuntimeVersionDisplayLabel } from "../startup/RuntimeVersionBadge";
import { OptionLabelWithInfo } from "./OptionLabelWithInfo";

export function SaveGameSettings({ runtimeVersion, gameActive }: {
  runtimeVersion: NethackRuntimeVersion;
  gameActive: boolean;
}): JSX.Element {
  const strings = t.saveTransfer;
  const [saves, setSaves] = useState<SaveGameRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const importControllerRef = useRef(new AbortController());

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    importControllerRef.current = controller;
    setLoading(true);
    setError("");
    setStatus("");
    if (gameActive) { setLoading(false); return; }
    void fetchSavedGames(runtimeVersion).then(records => {
      if (current) setSaves(records.filter(save => save.isResumable));
    }).catch(() => { if (current) setError(strings.failed); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [runtimeVersion, gameActive, strings.failed]);

  const transfer = async (operation: () => Promise<void>) => {
    if (busyRef.current || gameActive) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try { await operation(); }
    catch (error) {
      setError(error instanceof SaveTransferError ? strings[error.code] : strings.failed);
    } finally { busyRef.current = false; setBusy(false); }
  };

  return <>
    <div className="nh3d-options-group-title">{resolveRuntimeVersionDisplayLabel(runtimeVersion)}</div>
    <div className="nh3d-option-row">
      <div className="nh3d-option-copy">
        <OptionLabelWithInfo label={strings.importLabel} description={strings.importDescription} />
        <div className="nh3d-options-panel-description">{gameActive ? strings.activeGame : strings.importDescription}</div>
      </div>
      <div className="nh3d-option-select-controls">
        <button className="nh3d-menu-action-button" type="button" disabled={gameActive || busy || loading}
          onClick={() => inputRef.current?.click()}>{strings.importLabel}</button>
        <input ref={inputRef} type="file" hidden accept=".nh3dsave,application/json" onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          const signal = importControllerRef.current.signal;
          void transfer(async () => {
            if (file.size > MAX_SAVE_ARCHIVE_BYTES) throw new SaveTransferError("invalid");
            await importSavedGame(await file.text(), runtimeVersion, signal);
            setSaves((await fetchSavedGames(runtimeVersion)).filter(save => save.isResumable));
            setStatus(strings.imported);
          });
        }} />
      </div>
    </div>
    <div className="nh3d-options-group-title">{strings.exportLabel}</div>
    <div className="nh3d-options-panel-description">{strings.exportDescription}</div>
    {!gameActive && !loading && saves.length === 0 ? <div className="nh3d-options-panel-description">{strings.empty}</div> : null}
    {!gameActive && saves.map(save => <div className="nh3d-option-row" key={save.key}>
      <div className="nh3d-option-copy">
        <div className="nh3d-option-label">{save.displayName}</div>
        <div className="nh3d-options-panel-description">{save.category === "manual" ? strings.manual : strings.autosave} · {save.dateFormatted}</div>
      </div>
      <div className="nh3d-option-select-controls">
        <button className="nh3d-menu-action-button" type="button" disabled={busy || loading}
          aria-label={`${strings.exportLabel}: ${save.displayName}`} onClick={() => void transfer(async () => {
            const text = await exportSavedGame(save, runtimeVersion);
            const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${save.displayName.replace(/[^a-z0-9_-]/gi, "_")}-${runtimeVersion}-${save.category}.nh3dsave`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            setStatus(strings.exported);
          })}>{strings.exportLabel}</button>
      </div>
    </div>)}
    <div className="nh3d-options-panel-description" role="status">{busy || loading ? strings.working : status}</div>
    {error ? <div className="nh3d-options-panel-description" role="alert">{error}</div> : null}
  </>;
}
