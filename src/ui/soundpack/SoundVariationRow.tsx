import { useRef, type ClipboardEvent, type ReactNode } from "react";
import SoundPlayButton from "./SoundPlayButton";

export type SoundVariationRowProps = {
  label: string;
  busy?: boolean;

  enabled: boolean;
  onToggleEnabled: () => void;
  enableAriaLabel: string;

  volume: number;
  onVolumeChange: (volume: number) => void;
  volumeLabel: string;
  volumeAriaLabel: string;

  showPlay: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  playAriaLabel: string;
  stopAriaLabel: string;
  playDisabled?: boolean;
  playRetriggerable?: boolean;

  showFile: boolean;
  fileLabel: string;
  displayFileName: string;
  fileAccept: string;
  replaceLabel: string;
  onFileSelected: (file: File) => void;
  showRemove: boolean;
  removeLabel: string;
  onRemove: () => void;
  showReset: boolean;
  resetLabel: string;
  canReset: boolean;
  onReset: () => void;

  attributionLabel: string;
  attributionAriaLabel: string;
  attributionPlaceholder: string;
  attribution: string;
  attributionReadOnly: boolean;
  onAttributionChange: (value: string) => void;
  onAttributionPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;

  extraContent?: ReactNode;
};

/**
 * Full editing controls for a single sound/ambient variation. Shared by both
 * the Sound Effects and Music/Audioscapes tabs. The owning component supplies
 * the values and callbacks; ambient-specific controls (play conditions) are
 * injected through `extraContent`.
 */
export default function SoundVariationRow({
  label,
  busy,
  enabled,
  onToggleEnabled,
  enableAriaLabel,
  volume,
  onVolumeChange,
  volumeLabel,
  volumeAriaLabel,
  showPlay,
  isPlaying,
  onPlay,
  onStop,
  playAriaLabel,
  stopAriaLabel,
  playDisabled,
  playRetriggerable,
  showFile,
  fileLabel,
  displayFileName,
  fileAccept,
  replaceLabel,
  onFileSelected,
  showRemove,
  removeLabel,
  onRemove,
  showReset,
  resetLabel,
  canReset,
  onReset,
  attributionLabel,
  attributionAriaLabel,
  attributionPlaceholder,
  attribution,
  attributionReadOnly,
  onAttributionChange,
  onAttributionPaste,
  extraContent,
}: SoundVariationRowProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const volumePercent = Math.round(Math.max(0, Math.min(1, volume)) * 100);

  const handleVolumeInput = (rawValue: string): void => {
    const nextVolume = Math.max(0, Math.min(1, Number(rawValue) / 100));
    onVolumeChange(Number.isFinite(nextVolume) ? nextVolume : 0);
  };

  return (
    <div className="nh3d-soundpack-variation-row">
      <div className="nh3d-soundpack-control-row nh3d-soundpack-control-row-primary">
        <button
          aria-checked={enabled}
          aria-label={enableAriaLabel}
          className={`nh3d-option-switch nh3d-soundpack-toggle${
            enabled ? " is-on" : ""
          }`}
          disabled={busy}
          onClick={onToggleEnabled}
          role="switch"
          type="button"
        >
          <span className="nh3d-option-switch-thumb" />
        </button>
        <div className="nh3d-soundpack-sound-type">
          <div className="nh3d-option-label">{label}</div>
        </div>
        <div className="nh3d-soundpack-info-box nh3d-soundpack-volume-box">
          <div className="nh3d-option-description">{volumeLabel}</div>
          <div className="nh3d-soundpack-volume-control">
            <input
              aria-label={volumeAriaLabel}
              className="nh3d-option-slider"
              disabled={busy}
              max={100}
              min={0}
              onChange={(event) => handleVolumeInput(event.currentTarget.value)}
              onInput={(event) => handleVolumeInput(event.currentTarget.value)}
              step={1}
              type="range"
              value={volumePercent}
            />
            <span className="nh3d-soundpack-volume-value">
              {volumePercent}%
            </span>
          </div>
        </div>
        {showPlay ? (
          <SoundPlayButton
            className="nh3d-soundpack-variation-play"
            disabled={busy || playDisabled}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onStop={onStop}
            playAriaLabel={playAriaLabel}
            retriggerable={playRetriggerable}
            stopAriaLabel={stopAriaLabel}
          />
        ) : (
          <span className="nh3d-soundpack-play-button-placeholder" />
        )}
      </div>

      {showFile ? (
        <div className="nh3d-soundpack-control-row nh3d-soundpack-control-row-secondary">
          <div
            className={`nh3d-soundpack-file-action-group${
              showRemove ? "" : " is-single-action"
            }`}
          >
            {showRemove ? (
              <button
                className="nh3d-menu-action-button nh3d-menu-action-cancel nh3d-soundpack-remove-variation-button"
                disabled={busy}
                onClick={onRemove}
                type="button"
              >
                {removeLabel}
              </button>
            ) : null}
            <button
              className="nh3d-menu-action-button nh3d-soundpack-choose-file-button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {replaceLabel}
            </button>
          </div>
          <input
            accept={fileAccept}
            className="nh3d-soundpack-file-input-hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (file) {
                onFileSelected(file);
              }
            }}
            ref={fileInputRef}
            type="file"
          />
          <div className="nh3d-soundpack-info-box nh3d-soundpack-path">
            <div className="nh3d-option-description">{fileLabel}</div>
            <div className="nh3d-soundpack-path-value">{displayFileName}</div>
          </div>
          <button
            className="nh3d-menu-action-button nh3d-soundpack-reset-button"
            disabled={!canReset || busy}
            onClick={onReset}
            style={showReset ? undefined : { visibility: "hidden" }}
            type="button"
          >
            {resetLabel}
          </button>
        </div>
      ) : null}

      {extraContent ? (
        <div className="nh3d-soundpack-control-row nh3d-soundpack-control-row-extra">
          {extraContent}
        </div>
      ) : null}

      <div className="nh3d-soundpack-control-row nh3d-soundpack-control-row-tertiary">
        <div className="nh3d-soundpack-info-box nh3d-soundpack-attribution-box">
          <div className="nh3d-option-description">{attributionLabel}</div>
          <input
            aria-label={attributionAriaLabel}
            className="nh3d-text-input nh3d-soundpack-attribution-input"
            disabled={busy}
            onChange={(event) => onAttributionChange(event.target.value)}
            onPaste={onAttributionPaste}
            placeholder={attributionPlaceholder}
            readOnly={attributionReadOnly}
            type="text"
            value={attribution}
          />
        </div>
      </div>
    </div>
  );
}
