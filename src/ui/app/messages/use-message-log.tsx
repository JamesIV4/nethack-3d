import {
  useEffect,
  useMemo,
  type CSSProperties
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import type * as React from "react";
import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "../menus/mobile-actions";

export interface UseMessageLogStyleDependencies {
  readonly clientOptions: Nh3dClientOptions;
}

/** Floating log text/timing and desktop/mobile log rendering */
export function useMessageLogStyle(dependencies: UseMessageLogStyleDependencies) {
  const {
    clientOptions,
  } = dependencies;

  const floatingMessageTextStyle = useMemo(
    () =>
      ({
        "--floating-message-fade-delay-ms": `${clientOptions.liveMessageDisplayTimeMs}ms`,
        "--floating-message-fade-duration-ms": `${clientOptions.liveMessageFadeOutTimeMs}ms`,
      }) as React.CSSProperties,
    [
      clientOptions.liveMessageDisplayTimeMs,
      clientOptions.liveMessageFadeOutTimeMs,
    ],
  );
  return {
    floatingMessageTextStyle,
  } as const;
}

export interface UseMessageLogEffectsDependencies {
  readonly setFloatingMessageTiming: (delayMs: number, durationMs: number) => void;
  readonly clientOptions: Nh3dClientOptions;
  readonly setIsMobileLogVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Floating log text/timing and desktop/mobile log rendering */
export function useMessageLogEffects(dependencies: UseMessageLogEffectsDependencies) {
  const {
    setFloatingMessageTiming,
    clientOptions,
    setIsMobileLogVisible,
  } = dependencies;

  useEffect(() => {
    setFloatingMessageTiming(
      clientOptions.liveMessageDisplayTimeMs,
      clientOptions.liveMessageFadeOutTimeMs,
    );
  }, [
    clientOptions.liveMessageDisplayTimeMs,
    clientOptions.liveMessageFadeOutTimeMs,
    setFloatingMessageTiming,
  ]);

  useEffect(() => {
    if (!clientOptions.liveMessageLog) {
      setIsMobileLogVisible(false);
    }
  }, [clientOptions.liveMessageLog]);

}

export interface UseMessageLogViewDependencies {
  readonly clientOptions: Nh3dClientOptions;
  readonly terminalDesktopGutterVisible: boolean;
  readonly mobileTouchUiVisible: boolean;
  readonly isMobileLogVisible: boolean;
  readonly renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  readonly setIsMobileLogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly gameMessages: string[];
  readonly isMobileViewport: boolean;
  readonly isDesktopGameRunning: boolean;
  readonly statusText: string;
}

/** Floating log text/timing and desktop/mobile log rendering */
export function useMessageLogView(dependencies: UseMessageLogViewDependencies) {
  const {
    clientOptions,
    terminalDesktopGutterVisible,
    mobileTouchUiVisible,
    isMobileLogVisible,
    renderMobileDialogCloseButton,
    setIsMobileLogVisible,
    gameMessages,
    isMobileViewport,
    isDesktopGameRunning,
    statusText,
  } = dependencies;

  const gameMessageLog =
    clientOptions.liveMessageLog || terminalDesktopGutterVisible ? (
      <div
        className="nh3d-message-log-scroll"
        data-nh3d-overflow-glow
        data-nh3d-overflow-glow-host="parent"
        id="game-log"
      >
        {mobileTouchUiVisible && isMobileLogVisible
          ? renderMobileDialogCloseButton(
            () => setIsMobileLogVisible(false),
            t.dialogs.mobileActions.closeMessageLog,
          )
          : null}
        {gameMessages.map((message, index) => (
          <div key={`${index}-${message}`}>{message}</div>
        ))}
      </div>
    ) : null;

  const desktopGameMessageLog =
    !isMobileViewport && isDesktopGameRunning ? (
      <div
        className={`top-left-ui with-stats${terminalDesktopGutterVisible
          ? " nh3d-terminal-log-gutter-panel"
          : ""
          }`}
      >
        <div id="game-status">{statusText}</div>
        {gameMessageLog ? (
          <div className="nh3d-overflow-glow-frame">{gameMessageLog}</div>
        ) : null}
      </div>
    ) : null;
  return {
    gameMessageLog,
    desktopGameMessageLog,
  } as const;
}
