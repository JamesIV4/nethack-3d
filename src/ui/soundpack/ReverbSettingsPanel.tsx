import { ChevronRight } from "lucide-react";
import { Nh3dIcon } from "../icons";
import ReverbSlider from "./ReverbSlider";
import type {
  Nh3dAmbientTrackKey,
  Nh3dSoundPackReverbSettings,
} from "../../audio/sound-pack-storage";

export type ReverbSettingsPanelStrings = {
  heading: string;
  description: string;
  intensity: string;
  intensityAria: string;
  levelTypes: string;
  offsetAria: (label: string) => string;
  expandAria: string;
  collapseAria: string;
};

export type ReverbSettingsPanelProps = {
  reverb: Nh3dSoundPackReverbSettings;
  disabled?: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onIntensityChange: (value: number) => void;
  onLevelTypeOffsetChange: (key: Nh3dAmbientTrackKey, value: number) => void;
  levelTypes: ReadonlyArray<{ key: Nh3dAmbientTrackKey; label: string }>;
  strings: ReverbSettingsPanelStrings;
};

/**
 * Pack-global reverb configuration: the base reverb intensity plus a signed
 * offset per dungeon level type. Per-sound/track offsets are edited inside each
 * sound row. Collapsible with explicit state (no native <details>).
 */
export default function ReverbSettingsPanel({
  reverb,
  disabled,
  expanded,
  onToggleExpanded,
  onIntensityChange,
  onLevelTypeOffsetChange,
  levelTypes,
  strings,
}: ReverbSettingsPanelProps): JSX.Element {
  return (
    <div
      className={`nh3d-soundpack-accordion nh3d-soundpack-reverb-panel${
        expanded ? " is-expanded" : ""
      }`}
    >
      <div className="nh3d-soundpack-accordion-header">
        <button
          aria-expanded={expanded}
          aria-label={expanded ? strings.collapseAria : strings.expandAria}
          className="nh3d-soundpack-accordion-summary"
          onClick={onToggleExpanded}
          type="button"
        >
          <Nh3dIcon
            className="nh3d-soundpack-accordion-chevron"
            icon={ChevronRight}
            size={16}
          />
          <span className="nh3d-soundpack-accordion-title">
            {strings.heading}
          </span>
        </button>
      </div>
      {expanded ? (
        <div className="nh3d-soundpack-accordion-body">
          <div className="nh3d-option-description">{strings.description}</div>
          <ReverbSlider
            ariaLabel={strings.intensityAria}
            disabled={disabled}
            label={strings.intensity}
            onChange={onIntensityChange}
            value={reverb.intensity}
          />
          <div className="nh3d-soundpack-reverb-leveltypes-heading">
            {strings.levelTypes}
          </div>
          <div className="nh3d-soundpack-reverb-leveltypes">
            {levelTypes.map((levelType) => (
              <ReverbSlider
                ariaLabel={strings.offsetAria(levelType.label)}
                disabled={disabled}
                key={levelType.key}
                label={levelType.label}
                onChange={(value) =>
                  onLevelTypeOffsetChange(levelType.key, value)
                }
                signed
                value={reverb.levelTypeOffsets[levelType.key] ?? 0}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
