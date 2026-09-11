import type * as React from "react";

export interface CanvasRootProps {
  canvasRootRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function CanvasRoot({
  canvasRootRef,
}: CanvasRootProps) {
  return (
    <div className="nh3d-canvas-root" ref={canvasRootRef} />
  );
}
