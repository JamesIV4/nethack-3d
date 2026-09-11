import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";

/** Tile context positioning and overflowing context title animation. */
export const parseCssPixelValue = (value: string, fallback = 0): number => {
  const parsed = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const clampTileContextMenuPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } => {
  const rootStyle = getComputedStyle(document.documentElement);
  const safeLeft =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-left-inset"),
      8,
    ) + 4;
  const safeRight =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-action-context-safe-right-inset"),
      8,
    ) + 4;
  const safeTop =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-mobile-overlay-top-inset"),
      8,
    ) + 4;
  const safeBottom =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-mobile-overlay-bottom-inset"),
      8,
    ) + 4;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 260;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 220;
  const maxX = Math.max(safeLeft, window.innerWidth - safeRight - safeWidth);
  const maxY = Math.max(safeTop, window.innerHeight - safeBottom - safeHeight);
  return {
    x: Math.min(Math.max(x, safeLeft), maxX),
    y: Math.min(Math.max(y, safeTop), maxY),
  };
};

export const tileContextMenuAnchorOffsetY = 30;

export const contextMenuTitleScrollGapPx = 28;

export const contextMenuTitleScrollOverflowThresholdPx = 1;

export const contextMenuTitleScrollPixelsPerSecond = 115;

export const contextMenuTitleScrollInitialDelaySec = 0.75;

export function useContextMenuTitleScroll(
  title: string,
  isActive: boolean,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const primaryTextRef = useRef<HTMLSpanElement | null>(null);
  const [scrollState, setScrollState] = useState<{
    shouldScroll: boolean;
    distancePx: number;
  }>({
    shouldScroll: false,
    distancePx: 0,
  });

  useLayoutEffect(() => {
    if (!isActive || !title) {
      setScrollState((previous) =>
        previous.shouldScroll || previous.distancePx !== 0
          ? {
            shouldScroll: false,
            distancePx: 0,
          }
          : previous,
      );
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    let animationFrameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const measure = (): void => {
      animationFrameId = null;
      const container = containerRef.current;
      const primaryText = primaryTextRef.current;
      if (!container || !primaryText) {
        return;
      }
      const textWidth = Math.ceil(primaryText.scrollWidth);
      const containerWidth = Math.floor(container.clientWidth);
      const shouldScroll =
        textWidth - containerWidth > contextMenuTitleScrollOverflowThresholdPx;
      const distancePx = shouldScroll
        ? textWidth + contextMenuTitleScrollGapPx
        : 0;
      setScrollState((previous) =>
        previous.shouldScroll === shouldScroll &&
          previous.distancePx === distancePx
          ? previous
          : {
            shouldScroll,
            distancePx,
          },
      );
    };

    const scheduleMeasure = (): void => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleMeasure();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      if (primaryTextRef.current) {
        resizeObserver.observe(primaryTextRef.current);
      }
    }

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [isActive, scrollState.shouldScroll, title]);

  return {
    containerRef,
    primaryTextRef,
    shouldScroll: scrollState.shouldScroll,
    style: scrollState.shouldScroll
      ? ({
        "--nh3d-context-title-scroll-distance": `-${scrollState.distancePx}px`,
        "--nh3d-context-title-scroll-duration": `${scrollState.distancePx / contextMenuTitleScrollPixelsPerSecond}s`,
        "--nh3d-context-title-scroll-delay": `${contextMenuTitleScrollInitialDelaySec}s`,
      } as CSSProperties)
      : undefined,
  };
}
