import type {
  Nh3dClientOptions,
  XrAvailabilityState,
  XrSessionState,
} from "../../game/ui-types";

type VrHudFrameProps = {
  offerEnabled: boolean;
  availability: XrAvailabilityState;
  sessionState: XrSessionState;
  quickPanelVisible: boolean;
  clientOptions: Pick<
    Nh3dClientOptions,
    "fpsMode" | "vrFollowPlayer" | "vrShowLevelBoundaries"
  >;
  onSessionAction: () => void;
  onToggleQuickPanel: () => void;
  onTogglePlayMode: () => void;
  onToggleFollowPlayer: () => void;
  onToggleBoundaries: () => void;
  onExitVr: () => void;
};

function getSessionButtonLabel(
  offerEnabled: boolean,
  availability: XrAvailabilityState,
  sessionState: XrSessionState,
): string {
  if (sessionState === "immersive") {
    return "Return to Flat";
  }
  if (sessionState === "entering") {
    return "Entering VR...";
  }
  if (sessionState === "exiting") {
    return "Leaving VR...";
  }
  if (!offerEnabled) {
    return "VR Disabled";
  }
  if (!availability.supported) {
    return "Check VR";
  }
  return availability.buttonLabel;
}

export default function VrHudFrame({
  offerEnabled,
  availability,
  sessionState,
  quickPanelVisible,
  clientOptions,
  onSessionAction,
  onToggleQuickPanel,
  onTogglePlayMode,
  onToggleFollowPlayer,
  onToggleBoundaries,
  onExitVr,
}: VrHudFrameProps): JSX.Element | null {
  const browserCanProbeVr =
    typeof navigator !== "undefined" && typeof navigator.xr !== "undefined";
  const shouldRender =
    sessionState !== "inactive" ||
    (offerEnabled &&
      (availability.supported ||
        availability.isHeadsetShell ||
        availability.directWebXrAvailable ||
        browserCanProbeVr));
  if (!shouldRender) {
    return null;
  }

  const immersive = sessionState === "immersive";
  const busy =
    sessionState === "entering" ||
    sessionState === "exiting";

  return (
    <div
      className={`nh3d-vr-hud-frame${immersive ? " is-immersive" : ""}${
        quickPanelVisible ? " is-expanded" : ""
      }`}
      id="nh3d-vr-hud-frame"
    >
      <div className="nh3d-vr-hud-header">
        <div className="nh3d-vr-hud-copy">
          <div className="nh3d-vr-hud-title">VR</div>
          <div className="nh3d-vr-hud-status">{availability.statusText}</div>
        </div>
        <div className="nh3d-vr-hud-actions">
          <button
            className="nh3d-vr-hud-button nh3d-vr-hud-button-primary"
            disabled={busy || !offerEnabled}
            onClick={onSessionAction}
            type="button"
          >
            {getSessionButtonLabel(offerEnabled, availability, sessionState)}
          </button>
          {immersive ? (
            <button
              className="nh3d-vr-hud-button"
              onClick={onToggleQuickPanel}
              type="button"
            >
              {quickPanelVisible ? "Hide Panel" : "Quick Panel"}
            </button>
          ) : null}
        </div>
      </div>

      {immersive && quickPanelVisible ? (
        <div className="nh3d-vr-quick-panel">
          <button className="nh3d-vr-hud-button" onClick={onTogglePlayMode} type="button">
            {clientOptions.fpsMode ? "Use Tabletop Mode" : "Use FPS Mode"}
          </button>
          <button
            className="nh3d-vr-hud-button"
            onClick={onToggleFollowPlayer}
            type="button"
          >
            {clientOptions.vrFollowPlayer
              ? "Stop Following Player"
              : "Follow Player"}
          </button>
          <button
            className="nh3d-vr-hud-button"
            onClick={onToggleBoundaries}
            type="button"
          >
            {clientOptions.vrShowLevelBoundaries
              ? "Hide Level Bounds"
              : "Show Level Bounds"}
          </button>
          <button
            className="nh3d-vr-hud-button nh3d-vr-hud-button-warn"
            onClick={onExitVr}
            type="button"
          >
            Flat Mode
          </button>
          <div className="nh3d-vr-hud-hint">
            Trigger or A: primary. Secondary face button: context. Grip: move.
            Two grips: scale.
          </div>
        </div>
      ) : null}
    </div>
  );
}
