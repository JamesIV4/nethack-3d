import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Nh3dIcon } from "../icons";
import SoundPlayButton from "./SoundPlayButton";

export type SoundAccordionRowProps = {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  expandAriaLabel: string;
  collapseAriaLabel: string;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  playAriaLabel: string;
  stopAriaLabel: string;
  playDisabled?: boolean;
  playRetriggerable?: boolean;
  isDefaultPack?: boolean;
  children: ReactNode;
};

/**
 * Compact, self-contained collapsible row used for every sound effect and
 * ambient track. The collapsed header shows only the name, a quick play/stop
 * button and an expand chevron; the body (full controls) is revealed when
 * expanded. Uses explicit React state via props — no native <details>.
 */
export default function SoundAccordionRow({
  title,
  subtitle,
  expanded,
  onToggleExpanded,
  expandAriaLabel,
  collapseAriaLabel,
  isPlaying,
  onPlay,
  onStop,
  playAriaLabel,
  stopAriaLabel,
  playDisabled,
  playRetriggerable,
  isDefaultPack,
  children,
}: SoundAccordionRowProps): JSX.Element {
  return (
    <div
      className={`nh3d-soundpack-accordion${expanded ? " is-expanded" : ""}${
        isDefaultPack ? " is-default-pack" : ""
      }`}
    >
      <div className="nh3d-soundpack-accordion-header">
        <button
          aria-expanded={expanded}
          aria-label={expanded ? collapseAriaLabel : expandAriaLabel}
          className="nh3d-soundpack-accordion-summary"
          onClick={onToggleExpanded}
          type="button"
        >
          <Nh3dIcon
            className="nh3d-soundpack-accordion-chevron"
            icon={ChevronRight}
            size={16}
          />
          <span className="nh3d-soundpack-accordion-title">{title}</span>
          {subtitle ? (
            <span className="nh3d-soundpack-accordion-subtitle">
              {subtitle}
            </span>
          ) : null}
        </button>
        <SoundPlayButton
          className="nh3d-soundpack-accordion-play"
          disabled={playDisabled}
          isPlaying={isPlaying}
          onPlay={onPlay}
          onStop={onStop}
          playAriaLabel={playAriaLabel}
          retriggerable={playRetriggerable}
          stopAriaLabel={stopAriaLabel}
        />
      </div>
      {expanded ? (
        <div className="nh3d-soundpack-accordion-body">{children}</div>
      ) : null}
    </div>
  );
}
