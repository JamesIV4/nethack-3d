import {
  type CSSProperties
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import type * as React from "react";
import type { FloatingMessage } from "../../../state/gameStore";


export interface FloatingMessagesProps {
  clientOptions: Nh3dClientOptions;
  floatingMessages: FloatingMessage[];
  floatingMessageTextStyle: React.CSSProperties;
}

export function FloatingMessages({
  clientOptions,
  floatingMessages,
  floatingMessageTextStyle,
}: FloatingMessagesProps) {
  return (
    <div
      className={
        clientOptions.tilesetMode === "terminal"
          ? "nh3d-floating-log-terminal"
          : undefined
      }
      id="floating-log-message-layer"
    >
      {floatingMessages.map((entry, index) => (
        <div
          className="floating-message-container"
          key={entry.id}
          style={{
            top: `calc(${-index * 30}px * var(--nh3d-live-log-font-scale, 1))`,
          }}
        >
          <div
            className="floating-message-text"
            style={floatingMessageTextStyle}
          >
            {entry.text}
          </div>
        </div>
      ))}
    </div>
  );
}
