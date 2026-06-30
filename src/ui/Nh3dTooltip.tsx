import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type Nh3dTooltipProps = {
  content: ReactNode;
  className?: string;
  children: ReactNode;
};

const tooltipViewportMarginPx = 8;
const tooltipTriggerGapPx = 8;
const tooltipAssumedMaxWidthPx = 320;
const tooltipMinSpaceBelowPx = 80;

/**
 * Custom hover/focus tooltip that appears immediately (no native browser
 * hover delay, and no "won't reappear right after dismissing a previous
 * tooltip" cooldown quirk some browsers apply to the native `title`
 * attribute). Renders via a portal into `document.body` so it can't be
 * clipped by a scrolling/overflow:hidden ancestor, and clamps to the
 * viewport so it never runs off-screen.
 */
export default function Nh3dTooltip({
  content,
  className,
  children,
}: Nh3dTooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{
    top: number | null;
    bottom: number | null;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") {
      return;
    }
    const rect = el.getBoundingClientRect();
    const left = Math.max(
      tooltipViewportMarginPx,
      Math.min(
        window.innerWidth - tooltipAssumedMaxWidthPx - tooltipViewportMarginPx,
        rect.left,
      ),
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const showBelow =
      spaceBelow >= tooltipMinSpaceBelowPx || spaceBelow >= rect.top;
    const top = showBelow
      ? rect.bottom + tooltipTriggerGapPx
      : null;
    const bottom = showBelow
      ? null
      : window.innerHeight - rect.top + tooltipTriggerGapPx;
    setPosition({ top, bottom, left });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible || typeof window === "undefined") {
      return;
    }
    const handleReposition = (): void => updatePosition();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [visible, updatePosition]);

  return (
    <span
      className={`nh3d-tooltip-trigger${className ? ` ${className}` : ""}`}
      onBlur={hide}
      onFocus={show}
      onMouseEnter={show}
      onMouseLeave={hide}
      ref={triggerRef}
    >
      {children}
      {visible && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="nh3d-tooltip-bubble"
              role="tooltip"
              style={{
                top: position.top ?? undefined,
                bottom: position.bottom ?? undefined,
                left: position.left,
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
