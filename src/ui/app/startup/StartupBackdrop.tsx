import {
  startupMenuRainParticles
} from "./rain";
import { QuestWebXrButton } from "../../../quest/webxr/QuestWebXrControls";
import {
  t
} from "../shared/translations";
import {
  nh3dBuildLabel,
  nh3dBuildLabelDebugEnableClickCount
} from "../shared/build-info";

export interface StartupBackdropProps {
  startupMenuVisible: boolean;
  startupBuildLabelClickCount: number;
  handleStartupBuildLabelClick: () => void;
  startupBuildLabelToastVisible: boolean;
  isDebugSessionLogsLinkVisible: boolean;
  openDebugSessionLogsDialog: () => void;
}

export function StartupBackdrop({
  startupMenuVisible,
  startupBuildLabelClickCount,
  handleStartupBuildLabelClick,
  startupBuildLabelToastVisible,
  isDebugSessionLogsLinkVisible,
  openDebugSessionLogsDialog,
}: StartupBackdropProps) {
  return (
    startupMenuVisible ? (
      <>
        <div className="nh3d-startup-vr-entry"><QuestWebXrButton className="nh3d-menu-action-button" /></div>
        <div aria-hidden="true" className="nh3d-startup-background-rain">
          <div className="nh3d-startup-background-rain-field">
            {startupMenuRainParticles.map((particle, index) => (
              <span
                className="nh3d-startup-background-rain-glyph"
                key={index}
                style={{
                  left: `${particle.leftPercent}%`,
                  opacity: particle.opacity,
                  fontSize: `${particle.fontSizePx}px`,
                  filter:
                    particle.blurPx > 0
                      ? `blur(${particle.blurPx}px)`
                      : undefined,
                  animationDelay: `${particle.delayMs}ms`,
                  animationDuration: `${particle.durationMs}ms`,
                }}
              >
                {particle.glyphFrames.map((glyphFrame, glyphIndex) => (
                  <span
                    className="nh3d-startup-background-rain-glyph-frame"
                    key={glyphIndex}
                    style={{
                      animationDelay: `${glyphFrame.delayMs}ms`,
                      animationDuration: `${glyphFrame.durationMs}ms`,
                    }}
                  >
                    {glyphFrame.char}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
        <button
          aria-label={t.debugLogs.buildLabelAria(
            nh3dBuildLabel,
            startupBuildLabelClickCount,
            nh3dBuildLabelDebugEnableClickCount,
          )}
          className="nh3d-startup-build-label"
          onClick={handleStartupBuildLabelClick}
          type="button"
        >
          {nh3dBuildLabel}
        </button>
        {startupBuildLabelToastVisible ? (
          <div aria-live="polite" className="nh3d-startup-build-label-toast">
            {t.debugLogs.enabledToast}
          </div>
        ) : null}
        {isDebugSessionLogsLinkVisible ? (
          <button
            className={`nh3d-startup-build-label-link${startupBuildLabelToastVisible ? " is-offset" : ""
              }`}
            onClick={openDebugSessionLogsDialog}
            type="button"
          >
            {t.debugLogs.openLink}
          </button>
        ) : null}
      </>
    ) : null
  );
}
