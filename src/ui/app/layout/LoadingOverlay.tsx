import {
  createPortal
} from "react-dom";

export interface LoadingOverlayProps {
  loadingOverlayVisible: boolean;
  loadingSubtitle: string;
}

export function LoadingOverlay({
  loadingOverlayVisible,
  loadingSubtitle,
}: LoadingOverlayProps) {
  return (
    loadingOverlayVisible && typeof document !== "undefined"
      ? createPortal(
        <div
          aria-atomic="true"
          aria-live="polite"
          className="loading"
          id="loading"
          role="status"
          tabIndex={-1}
        >
          <div>NetHack 3D</div>
          <div className="loading-subtitle">{loadingSubtitle}</div>
        </div>,
        document.body,
      )
      : null
  );
}
