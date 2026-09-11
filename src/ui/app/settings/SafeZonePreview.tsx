import {
  type CSSProperties
} from "react";
import type {
  ManualSafeZonePreview
} from "./types";
import {
  t
} from "../shared/translations";

export interface SafeZonePreviewProps {
  manualSafeZonePreview: ManualSafeZonePreview | null;
}

export function SafeZonePreview({
  manualSafeZonePreview,
}: SafeZonePreviewProps) {
  return (
    manualSafeZonePreview ? (
      <div
        aria-hidden="true"
        className={`nh3d-mobile-safe-zone-preview is-${manualSafeZonePreview.side}`}
        style={
          {
            "--nh3d-mobile-safe-zone-preview-size": `${manualSafeZonePreview.sizePx}px`,
          } as CSSProperties
        }
      >
        <span>
          {manualSafeZonePreview.side === "right"
            ? t.clientOptions.config.manualMobileRightSafeZonePreview
            : t.clientOptions.config.manualMobileBottomSafeZonePreview}
        </span>
      </div>
    ) : null
  );
}
