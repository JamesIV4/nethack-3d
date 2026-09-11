import {
  type CSSProperties
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import type * as React from "react";
import type { JSX } from "react/jsx-runtime";


export interface MobileMessageLogProps {
  mobileTouchUiVisible: boolean;
  gameMessageLog: JSX.Element | null;
  isMobileLogVisible: boolean;
  clientOptions: Nh3dClientOptions;
  statsBarHeight: number;
}

export function MobileMessageLog({
  mobileTouchUiVisible,
  gameMessageLog,
  isMobileLogVisible,
  clientOptions,
  statsBarHeight,
}: MobileMessageLogProps) {
  return (
    mobileTouchUiVisible &&
      gameMessageLog &&
      (isMobileLogVisible || clientOptions.showPersistentMobileMessageLog) ? (
      <div
        className={`nh3d-mobile-log nh3d-overflow-glow-frame${isMobileLogVisible ? "" : " nh3d-mobile-log-collapsed"
          }`}
        style={
          {
            "--nh3d-mobile-log-top": `${statsBarHeight}px`,
          } as React.CSSProperties
        }
      >
        {gameMessageLog}
      </div>
    ) : null
  );
}
