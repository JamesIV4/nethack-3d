import type {
  Nh3dAmbientAmuletCondition,
  Nh3dAmbientCondition,
} from "../../audio/sound-pack-storage";

export type AmbientConditionEditorStrings = {
  heading: string;
  hint: string;
  depthRange: string;
  minDepth: string;
  maxDepth: string;
  playerLevelRange: string;
  minLevel: string;
  maxLevel: string;
  amuletCondition: string;
  amuletAny: string;
  amuletCarried: string;
  amuletNotCarried: string;
  anyValue: string;
};

export type AmbientConditionEditorProps = {
  value: Nh3dAmbientCondition;
  disabled?: boolean;
  onChange: (next: Nh3dAmbientCondition) => void;
  strings: AmbientConditionEditorStrings;
};

function parseOptionalInteger(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.trunc(parsed));
}

function toInputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * Optional gating controls for an ambient/audioscape variation: dungeon depth
 * range, player experience-level range, and Amulet of Yendor possession. A
 * blank numeric field means "no limit". Reused across every ambient variation.
 */
export default function AmbientConditionEditor({
  value,
  disabled,
  onChange,
  strings,
}: AmbientConditionEditorProps): JSX.Element {
  const patch = (partial: Partial<Nh3dAmbientCondition>): void => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="nh3d-soundpack-conditions">
      <div className="nh3d-soundpack-conditions-heading">{strings.heading}</div>
      <div className="nh3d-option-description nh3d-soundpack-conditions-hint">
        {strings.hint}
      </div>
      <div className="nh3d-soundpack-conditions-grid">
        <div className="nh3d-soundpack-condition-field">
          <div className="nh3d-option-description">{strings.depthRange}</div>
          <div className="nh3d-soundpack-condition-range">
            <input
              aria-label={strings.minDepth}
              className="nh3d-text-input nh3d-soundpack-condition-input"
              disabled={disabled}
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                patch({ depthMin: parseOptionalInteger(event.target.value) })
              }
              placeholder={strings.minDepth}
              type="number"
              value={toInputValue(value.depthMin)}
            />
            <span className="nh3d-soundpack-condition-range-dash">–</span>
            <input
              aria-label={strings.maxDepth}
              className="nh3d-text-input nh3d-soundpack-condition-input"
              disabled={disabled}
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                patch({ depthMax: parseOptionalInteger(event.target.value) })
              }
              placeholder={strings.maxDepth}
              type="number"
              value={toInputValue(value.depthMax)}
            />
          </div>
        </div>

        <div className="nh3d-soundpack-condition-field">
          <div className="nh3d-option-description">
            {strings.playerLevelRange}
          </div>
          <div className="nh3d-soundpack-condition-range">
            <input
              aria-label={strings.minLevel}
              className="nh3d-text-input nh3d-soundpack-condition-input"
              disabled={disabled}
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                patch({
                  playerLevelMin: parseOptionalInteger(event.target.value),
                })
              }
              placeholder={strings.minLevel}
              type="number"
              value={toInputValue(value.playerLevelMin)}
            />
            <span className="nh3d-soundpack-condition-range-dash">–</span>
            <input
              aria-label={strings.maxLevel}
              className="nh3d-text-input nh3d-soundpack-condition-input"
              disabled={disabled}
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                patch({
                  playerLevelMax: parseOptionalInteger(event.target.value),
                })
              }
              placeholder={strings.maxLevel}
              type="number"
              value={toInputValue(value.playerLevelMax)}
            />
          </div>
        </div>

        <div className="nh3d-soundpack-condition-field">
          <div className="nh3d-option-description">
            {strings.amuletCondition}
          </div>
          <select
            className="nh3d-startup-config-select nh3d-soundpack-condition-select"
            disabled={disabled}
            onChange={(event) =>
              patch({
                amulet: event.target.value as Nh3dAmbientAmuletCondition,
              })
            }
            value={value.amulet}
          >
            <option value="any">{strings.amuletAny}</option>
            <option value="carried">{strings.amuletCarried}</option>
            <option value="not-carried">{strings.amuletNotCarried}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
