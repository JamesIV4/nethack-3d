import "aframe";
import { useEffect, useMemo } from "react";
import type {
  Nh3dClientOptions,
  XrAvailabilityState,
  XrSessionState,
} from "../../game/ui-types";
import { isLoggingEnabled, logWithOriginal } from "../../logging";
import type {
  MobileActionEntry,
  MobileActionSheetMode,
} from "../mobile/mobile-actions";
import VrAframeMobileHud from "./VrAframeMobileHud";
import VrHudFrame from "./VrHudFrame";

export type VrAframeTouchHudProps = {
  visible: boolean;
  repeatActionVisible: boolean;
  actionSheetVisible: boolean;
  actionSheetMode: MobileActionSheetMode;
  quickActions: MobileActionEntry[];
  commonExtendedCommandNames: string[];
  extendedCommandNames: string[];
  logEnabled: boolean;
  logVisible: boolean;
  tiltDegrees: number;
  onOpenInventory: () => void;
  onToggleLog: () => void;
  onPickup: () => void;
  onSearch: () => void;
  onToggleActionSheet: () => void;
  onRepeatAction: () => void;
  onShowPauseMenu: () => void;
  onCloseActionSheet: () => void;
  onSetActionSheetMode: (mode: MobileActionSheetMode) => void;
  onSelectAction: (action: MobileActionEntry) => void;
  onRunExtendedCommand: (command: string) => void;
  onAdjustTilt: (deltaDegrees: number) => void;
};

type VrAframeHudFrameProps = {
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
  touchHud?: VrAframeTouchHudProps | null;
};

type WindowWithAframe = Window & {
  AFRAME?: {
    components?: Record<string, unknown>;
    registerComponent?: (
      name: string,
      definition: Record<string, unknown>,
    ) => void;
  };
};

type VrAframeButton = {
  id: string;
  label: string;
  disabled: boolean;
  tone: "default" | "primary" | "warn";
  onClick: () => void;
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

function escapeAframeTextValue(value: string): string {
  return String(value || "")
    .replace(/[;\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function registerNh3dAframeButtonComponent(): void {
  if (typeof window === "undefined") {
    return;
  }
  const aframeWindow = window as WindowWithAframe;
  const aframe = aframeWindow.AFRAME;
  if (!aframe || typeof aframe.registerComponent !== "function") {
    return;
  }
  const existing = aframe.components ?? {};
  if (Object.prototype.hasOwnProperty.call(existing, "nh3d-ui-button")) {
    return;
  }
  aframe.registerComponent("nh3d-ui-button", {
    schema: {
      disabled: { type: "boolean", default: false },
      tone: { type: "string", default: "default" },
    },
    init(this: {
      data: { disabled: boolean; tone: string };
      el: HTMLElement & {
        setAttribute(name: string, value: string, value2?: string): void;
      };
      applyBaseColor: () => void;
      onMouseEnter: () => void;
      onMouseLeave: () => void;
      onClick: () => void;
    }) {
      this.applyBaseColor = () => {
        const tone = this.data.tone;
        const disabled = this.data.disabled;
        let color = "#132237";
        if (disabled) {
          color = "#1b2a3b";
        } else if (tone === "primary") {
          color = "#0c4e83";
        } else if (tone === "warn") {
          color = "#69301f";
        }
        this.el.setAttribute("material", "color", color);
      };
      this.onMouseEnter = () => {
        if (this.data.disabled) {
          return;
        }
        this.el.setAttribute("material", "color", "#046de7");
      };
      this.onMouseLeave = () => {
        this.applyBaseColor();
      };
      this.onClick = () => {
        if (this.data.disabled) {
          return;
        }
        this.el.setAttribute("material", "color", "#118a7e");
        window.setTimeout(() => {
          this.applyBaseColor();
        }, 120);
      };
      this.el.addEventListener("mouseenter", this.onMouseEnter);
      this.el.addEventListener("mouseleave", this.onMouseLeave);
      this.el.addEventListener("click", this.onClick);
      this.applyBaseColor();
    },
    update(this: {
      applyBaseColor: () => void;
    }) {
      this.applyBaseColor();
    },
    remove(this: {
      el: HTMLElement;
      onMouseEnter: () => void;
      onMouseLeave: () => void;
      onClick: () => void;
    }) {
      this.el.removeEventListener("mouseenter", this.onMouseEnter);
      this.el.removeEventListener("mouseleave", this.onMouseLeave);
      this.el.removeEventListener("click", this.onClick);
    },
  });
}

export default function VrAframeHudFrame({
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
  touchHud = null,
}: VrAframeHudFrameProps): JSX.Element | null {
  const aframeReady =
    typeof window !== "undefined" &&
    Boolean((window as WindowWithAframe).AFRAME);
  const browserCanProbeVr =
    typeof navigator !== "undefined" && typeof navigator.xr !== "undefined";
  const shouldRender =
    sessionState !== "inactive" ||
    (offerEnabled &&
      (availability.supported ||
        availability.isHeadsetShell ||
        availability.directWebXrAvailable ||
        browserCanProbeVr));
  const immersive = sessionState === "immersive";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    registerNh3dAframeButtonComponent();
    if (!isLoggingEnabled()) {
      return;
    }
    logWithOriginal("[NH3D VR]", "A-Frame HUD runtime ready", {
      aframeReady,
      sessionState,
    });
  }, [aframeReady, sessionState]);

  useEffect(() => {
    if (!isLoggingEnabled()) {
      return;
    }
    logWithOriginal("[NH3D VR]", "A-Frame HUD render mode", {
      immersive,
      aframeReady,
      mode: !immersive || !aframeReady ? "react-fallback" : "aframe",
    });
  }, [immersive, aframeReady]);

  const buttons = useMemo(() => {
    const busy = sessionState === "entering" || sessionState === "exiting";
    const rows: VrAframeButton[] = [
      {
        id: "session",
        label: getSessionButtonLabel(offerEnabled, availability, sessionState),
        disabled: busy || !offerEnabled,
        tone: "primary",
        onClick: onSessionAction,
      },
    ];
    if (immersive) {
      rows.push({
        id: "quick-panel",
        label: quickPanelVisible ? "Hide Panel" : "Quick Panel",
        disabled: false,
        tone: "default",
        onClick: onToggleQuickPanel,
      });
      if (quickPanelVisible) {
        rows.push(
          {
            id: "play-mode",
            label: clientOptions.fpsMode
              ? "Use Tabletop Mode"
              : "Use FPS Mode",
            disabled: false,
            tone: "default",
            onClick: onTogglePlayMode,
          },
          {
            id: "follow-player",
            label: clientOptions.vrFollowPlayer
              ? "Stop Following Player"
              : "Follow Player",
            disabled: false,
            tone: "default",
            onClick: onToggleFollowPlayer,
          },
          {
            id: "boundaries",
            label: clientOptions.vrShowLevelBoundaries
              ? "Hide Level Bounds"
              : "Show Level Bounds",
            disabled: false,
            tone: "default",
            onClick: onToggleBoundaries,
          },
          {
            id: "flat-mode",
            label: "Flat Mode",
            disabled: false,
            tone: "warn",
            onClick: onExitVr,
          },
        );
      }
    }
    return rows;
  }, [
    sessionState,
    offerEnabled,
    availability,
    immersive,
    quickPanelVisible,
    clientOptions.fpsMode,
    clientOptions.vrFollowPlayer,
    clientOptions.vrShowLevelBoundaries,
    onSessionAction,
    onToggleQuickPanel,
    onTogglePlayMode,
    onToggleFollowPlayer,
    onToggleBoundaries,
    onExitVr,
  ]);

  if (!shouldRender) {
    return null;
  }

  if (!immersive || !aframeReady) {
    return (
      <VrHudFrame
        availability={availability}
        clientOptions={clientOptions}
        offerEnabled={offerEnabled}
        onExitVr={onExitVr}
        onSessionAction={onSessionAction}
        onToggleBoundaries={onToggleBoundaries}
        onToggleFollowPlayer={onToggleFollowPlayer}
        onTogglePlayMode={onTogglePlayMode}
        onToggleQuickPanel={onToggleQuickPanel}
        quickPanelVisible={quickPanelVisible}
        sessionState={sessionState}
      />
    );
  }

  const rowSpacing = 0.19;
  const firstRowY = 0.12;
  const lastRowY = firstRowY - rowSpacing * Math.max(0, buttons.length - 1);
  const panelTopY = 0.52;
  const panelBottomY = lastRowY - 0.16;
  const panelHeight = Math.max(0.92, panelTopY - panelBottomY);
  const panelCenterY = panelBottomY + panelHeight * 0.5;
  const statusValue = escapeAframeTextValue(availability.statusText);

  return (
    <div className="nh3d-vr-aframe-frame" id="nh3d-vr-aframe-frame">
      <a-scene
        background="color: #000; transparent: true"
        className="nh3d-vr-aframe-scene"
        embedded="true"
        renderer="alpha: true; antialias: true; colorManagement: true"
        vr-mode-ui="enabled: false"
        xr-mode-ui="enabled: false"
      >
        <a-entity
          camera="active: true"
          cursor="rayOrigin: mouse; fuse: false"
          look-controls="enabled: false"
          raycaster="objects: .raycastable; interval: 0; far: 6"
        >
          <a-entity position="0 0.28 -1.08">
            <a-entity
              geometry={`primitive: plane; width: 1.45; height: ${panelHeight}`}
              material="color: #08121f; opacity: 0.94; shader: flat"
              position={`0 ${panelCenterY} -0.01`}
            />
            <a-entity
              geometry="primitive: plane; width: 1.45; height: 0.12"
              material="color: #10263f; opacity: 0.96; shader: flat"
              position={`0 ${panelTopY - 0.06} 0`}
            />
            <a-entity
              position={`0 ${panelTopY - 0.08} 0.01`}
              text="align: center; anchor: center; color: #fff6a8; value: VR; width: 2.1"
            />
            <a-entity
              position={`0 ${panelTopY - 0.21} 0.01`}
              text={`align: center; anchor: center; color: #dbe9ff; value: ${statusValue}; width: 2.35; wrapCount: 34`}
            />
            {buttons.map((button, index) => {
              const y = firstRowY - index * rowSpacing;
              const textColor = button.disabled ? "#6f8295" : "#eef7ff";
              const tone = button.tone;
              return (
                <a-entity
                  className="raycastable"
                  geometry="primitive: plane; width: 1.18; height: 0.15"
                  key={button.id}
                  material="color: #132237; opacity: 0.96; shader: flat"
                  nh3d-ui-button={`disabled: ${button.disabled}; tone: ${tone}`}
                  onClick={() => {
                    if (button.disabled) {
                      return;
                    }
                    button.onClick();
                  }}
                  position={`0 ${y} 0`}
                >
                  <a-entity
                    position="0 0 0.01"
                    text={`align: center; anchor: center; color: ${textColor}; value: ${escapeAframeTextValue(button.label)}; width: 1.6; wrapCount: 30`}
                  />
                </a-entity>
              );
            })}
            <a-entity
              position={`0 ${panelBottomY + 0.08} 0.01`}
              text="align: center; anchor: center; color: #9db7cf; value: Trigger or A: primary. Secondary face button: context.; width: 2.35; wrapCount: 45"
            />
          </a-entity>
          {touchHud?.visible ? (
            <VrAframeMobileHud
              actionSheetMode={touchHud.actionSheetMode}
              actionSheetVisible={touchHud.actionSheetVisible}
              commonExtendedCommandNames={touchHud.commonExtendedCommandNames}
              extendedCommandNames={touchHud.extendedCommandNames}
              logEnabled={touchHud.logEnabled}
              logVisible={touchHud.logVisible}
              onAdjustTilt={touchHud.onAdjustTilt}
              onCloseActionSheet={touchHud.onCloseActionSheet}
              onOpenInventory={touchHud.onOpenInventory}
              onPickup={touchHud.onPickup}
              onRepeatAction={touchHud.onRepeatAction}
              onRunExtendedCommand={touchHud.onRunExtendedCommand}
              onSearch={touchHud.onSearch}
              onSelectAction={touchHud.onSelectAction}
              onSetActionSheetMode={touchHud.onSetActionSheetMode}
              onShowPauseMenu={touchHud.onShowPauseMenu}
              onToggleActionSheet={touchHud.onToggleActionSheet}
              onToggleLog={touchHud.onToggleLog}
              quickActions={touchHud.quickActions}
              repeatActionVisible={touchHud.repeatActionVisible}
              tiltDegrees={touchHud.tiltDegrees}
              visible={touchHud.visible}
            />
          ) : null}
        </a-entity>
        <a-entity
          cursor="fuse: false; rayOrigin: entity"
          laser-controls="hand: left"
          line="color: #78e8ff; opacity: 0.86"
          raycaster="objects: .raycastable; interval: 0; far: 6"
        />
        <a-entity
          cursor="fuse: false; rayOrigin: entity"
          laser-controls="hand: right"
          line="color: #78e8ff; opacity: 0.86"
          raycaster="objects: .raycastable; interval: 0; far: 6"
        />
      </a-scene>
    </div>
  );
}
