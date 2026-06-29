import { Play, Square } from "lucide-react";
import { Nh3dIcon } from "../icons";

export type SoundPlayButtonProps = {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  playAriaLabel: string;
  stopAriaLabel: string;
  disabled?: boolean;
  className?: string;
  retriggerable?: boolean;
};

/**
 * Compact icon play/stop button shared by the collapsed accordion header and
 * every variation row. Toggles between a play and a stop glyph.
 */
export default function SoundPlayButton({
  isPlaying,
  onPlay,
  onStop,
  playAriaLabel,
  stopAriaLabel,
  disabled,
  className,
  retriggerable,
}: SoundPlayButtonProps): JSX.Element {
  const showStopState = isPlaying && !retriggerable;
  return (
    <button
      aria-label={showStopState ? stopAriaLabel : playAriaLabel}
      className={`nh3d-soundpack-icon-play${showStopState ? " is-playing" : ""}${
        className ? ` ${className}` : ""
      }`}
      disabled={disabled}
      onClick={showStopState ? onStop : onPlay}
      type="button"
    >
      <Nh3dIcon icon={showStopState ? Square : Play} size={16} />
    </button>
  );
}
