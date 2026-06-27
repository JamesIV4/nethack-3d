export type ReverbSliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  signed?: boolean;
  disabled?: boolean;
  description?: string;
};

function formatPercent(value: number, signed: boolean): string {
  const percent = Math.round(value * 100);
  if (!signed) {
    return `${percent}%`;
  }
  if (percent > 0) {
    return `+${percent}%`;
  }
  return `${percent}%`;
}

/**
 * Labeled reverb slider. Unsigned mode covers 0..100% (global intensity);
 * signed mode covers -100..+100% (per-level-type and per-sound offsets).
 * Reused everywhere reverb intensity is edited.
 */
export default function ReverbSlider({
  label,
  value,
  onChange,
  ariaLabel,
  signed,
  disabled,
  description,
}: ReverbSliderProps): JSX.Element {
  const min = signed ? -100 : 0;
  const clamped = Math.max(signed ? -1 : 0, Math.min(1, value));
  const percent = Math.round(clamped * 100);

  const handleInput = (rawValue: string): void => {
    const nextPercent = Number(rawValue);
    if (!Number.isFinite(nextPercent)) {
      return;
    }
    onChange(Math.max(signed ? -1 : 0, Math.min(1, nextPercent / 100)));
  };

  return (
    <div className="nh3d-soundpack-reverb-field">
      <div className="nh3d-soundpack-reverb-field-head">
        <span className="nh3d-option-label nh3d-soundpack-reverb-field-label">
          {label}
        </span>
        <span className="nh3d-soundpack-reverb-field-value">
          {formatPercent(clamped, Boolean(signed))}
        </span>
      </div>
      {description ? (
        <div className="nh3d-option-description">{description}</div>
      ) : null}
      <input
        aria-label={ariaLabel}
        className="nh3d-option-slider nh3d-soundpack-reverb-slider"
        disabled={disabled}
        max={100}
        min={min}
        onChange={(event) => handleInput(event.currentTarget.value)}
        onInput={(event) => handleInput(event.currentTarget.value)}
        step={1}
        type="range"
        value={percent}
      />
    </div>
  );
}
