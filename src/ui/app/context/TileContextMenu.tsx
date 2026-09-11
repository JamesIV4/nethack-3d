import {
  type CSSProperties
} from "react";
import type { FpsCrosshairContextState, FpsContextAction } from "../../../game/ui-types";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";

export interface TileContextMenuProps {
  isFpsPlayMode: boolean;
  fpsCrosshairContextRenderState: FpsCrosshairContextState | null;
  tileContextMenuRenderPosition: { x: number; y: number; } | null;
  fpsCrosshairContext: FpsCrosshairContextState | null;
  fpsCrosshairContextMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  fpsContextTitleScroll: { containerRef: React.MutableRefObject<HTMLDivElement | null>; primaryTextRef: React.MutableRefObject<HTMLSpanElement | null>; shouldScroll: boolean; style: React.CSSProperties | undefined; };
  fpsContextTitleAnimationKey: string;
  fpsContextTitle: string;
  runFpsCrosshairContextAction: (action: FpsContextAction) => void;
}

export function TileContextMenu({
  isFpsPlayMode,
  fpsCrosshairContextRenderState,
  tileContextMenuRenderPosition,
  fpsCrosshairContext,
  fpsCrosshairContextMenuRef,
  fpsContextTitleScroll,
  fpsContextTitleAnimationKey,
  fpsContextTitle,
  runFpsCrosshairContextAction,
}: TileContextMenuProps) {
  return (
    <AnimatedDialog
      className={`nh3d-context-menu ${isFpsPlayMode &&
        fpsCrosshairContextRenderState?.autoDirectionFromFpsAim !== false &&
        tileContextMenuRenderPosition === null
        ? "nh3d-fps-crosshair-context"
        : "nh3d-tile-context-menu"
        }`}
      open={Boolean(fpsCrosshairContext)}
      ref={fpsCrosshairContextMenuRef}
      style={
        tileContextMenuRenderPosition
          ? {
            left: `${tileContextMenuRenderPosition.x}px`,
            top: `${tileContextMenuRenderPosition.y}px`,
          }
          : undefined
      }
    >
      {fpsCrosshairContextRenderState ? (
        <>
          <div
            className={`nh3d-context-menu-title${fpsContextTitleScroll.shouldScroll
              ? " nh3d-context-menu-title-scroll"
              : ""
              }`}
            ref={fpsContextTitleScroll.containerRef}
            style={fpsContextTitleScroll.style}
          >
            {fpsContextTitleScroll.shouldScroll ? (
              <span
                className="nh3d-context-menu-title-scroll-track"
                key={fpsContextTitleAnimationKey}
              >
                <span ref={fpsContextTitleScroll.primaryTextRef}>
                  {fpsContextTitle}
                </span>
                <span aria-hidden="true">{fpsContextTitle}</span>
              </span>
            ) : (
              <span
                className="nh3d-context-menu-title-text"
                ref={fpsContextTitleScroll.primaryTextRef}
              >
                {fpsContextTitle}
              </span>
            )}
          </div>
          <div className="nh3d-context-menu-actions">
            {fpsCrosshairContextRenderState.actions.map((action) => (
              <button
                className="nh3d-context-menu-button"
                key={`crosshair-${action.kind}-${action.id}-${action.value}`}
                onClick={() => runFpsCrosshairContextAction(action)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
