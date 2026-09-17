import {
  parseCssPixelValue
} from "../menus/context-menu";
import type {
  InventoryContextMenuState
} from "./types";

/** Inventory context and drop menu positioning and gesture constants. */
export const clampInventoryContextMenuPosition = (
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
      rootStyle.getPropertyValue("--nh3d-modal-safe-top-inset"),
      8,
    ) + 4;
  const safeBottom =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-bottom-inset"),
      8,
    ) + 4;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 220;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 260;
  const maxX = Math.max(safeLeft, window.innerWidth - safeRight - safeWidth);
  const maxY = Math.max(safeTop, window.innerHeight - safeBottom - safeHeight);
  return {
    x: Math.min(Math.max(x, safeLeft), maxX),
    y: Math.min(Math.max(y, safeTop), maxY),
  };
};

export const inventoryContextMenuAnchorGapPx = 8;

export const inventoryContextMenuAnchorBottomGapPx = 6;

export const inventoryContextMenuScrollRegionPaddingPx = 4;

export const inventoryRowPressPreferInitialMs = 200;

export const inventoryDropTypeMenuAnchorGapPx = 6;

export const inventoryDropTypeMenuEstimatedWidthPx = 220;

export const inventoryDropTypeMenuEstimatedHeightPx = 300;

export const inventoryDropTypeHoldThresholdMs = 260;

export const resolveInventoryContextMenuPosition = (
  state: InventoryContextMenuState,
  width: number,
  height: number,
  scrollRegionRect?: DOMRect | null,
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
      rootStyle.getPropertyValue("--nh3d-modal-safe-top-inset"),
      8,
    ) + 4;
  const safeBottom =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-bottom-inset"),
      8,
    ) + 4;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 220;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 260;
  let minX = safeLeft;
  let maxX = Math.max(safeLeft, window.innerWidth - safeRight - safeWidth);
  let minY = safeTop;
  let maxY = Math.max(safeTop, window.innerHeight - safeBottom - safeHeight);
  const anchorRightX =
    typeof state.anchorRightX === "number" &&
      Number.isFinite(state.anchorRightX)
      ? state.anchorRightX
      : state.x;
  const anchorCenterX =
    typeof state.anchorCenterX === "number" &&
      Number.isFinite(state.anchorCenterX)
      ? state.anchorCenterX
      : anchorRightX - safeWidth * 0.5;
  const anchorBottomY =
    typeof state.anchorBottomY === "number" &&
      Number.isFinite(state.anchorBottomY)
      ? state.anchorBottomY
      : state.y;
  const regionLeft = scrollRegionRect?.left;
  const regionRight = scrollRegionRect?.right;
  const regionTop = scrollRegionRect?.top;
  const regionBottom = scrollRegionRect?.bottom;
  const immersive = document.documentElement.classList.contains("nh3d-webxr-active");
  const hasRegionBounds =
    typeof regionLeft === "number" &&
    Number.isFinite(regionLeft) &&
    typeof regionRight === "number" &&
    Number.isFinite(regionRight) &&
    typeof regionTop === "number" &&
    Number.isFinite(regionTop) &&
    typeof regionBottom === "number" &&
    Number.isFinite(regionBottom);
  if (hasRegionBounds) {
    const regionMinX = regionLeft + inventoryContextMenuScrollRegionPaddingPx;
    const regionMaxX =
      regionRight - safeWidth - inventoryContextMenuScrollRegionPaddingPx;
    const regionMinY = regionTop + inventoryContextMenuScrollRegionPaddingPx;
    const regionMaxY =
      regionBottom - safeHeight - inventoryContextMenuScrollRegionPaddingPx;
    const boundedMinX = Math.max(minX, regionMinX);
    const boundedMaxX = Math.min(maxX, regionMaxX);
    const boundedMinY = Math.max(minY, regionMinY);
    const boundedMaxY = Math.min(maxY, regionMaxY);
    if (boundedMaxX >= boundedMinX) {
      minX = boundedMinX;
      maxX = boundedMaxX;
    }
    if (!immersive && boundedMaxY >= boundedMinY) {
      minY = boundedMinY;
      maxY = boundedMaxY;
    }
  }
  const preferredX = anchorCenterX - safeWidth * 0.5;
  const preferredY = immersive && typeof state.anchorTopY === "number" && Number.isFinite(state.anchorTopY)
    ? state.anchorTopY - safeHeight : anchorBottomY;
  return {
    x: Math.min(Math.max(preferredX, minX), maxX),
    y: Math.min(Math.max(preferredY, minY), maxY),
  };
};

export const resolveInventoryDropTypeMenuPosition = (
  anchorRect: DOMRect,
  width: number,
  height: number,
): { x: number; y: number } => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 220;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 300;
  const preferredX = anchorRect.left + anchorRect.width * 0.5 - safeWidth * 0.5;
  const preferredY =
    anchorRect.top - inventoryDropTypeMenuAnchorGapPx - safeHeight;
  const above = clampInventoryContextMenuPosition(
    preferredX,
    preferredY,
    safeWidth,
    safeHeight,
  );
  if (above.y + safeHeight <= anchorRect.top) return above;
  // Near the viewport ceiling, clamping an above-button menu can cover Drop.
  // Prefer the clear space below, then beside the button.
  const below = clampInventoryContextMenuPosition(preferredX, anchorRect.bottom + inventoryDropTypeMenuAnchorGapPx, safeWidth, safeHeight);
  if (below.y >= anchorRect.bottom) return below;
  const right = clampInventoryContextMenuPosition(anchorRect.right + inventoryDropTypeMenuAnchorGapPx, above.y, safeWidth, safeHeight);
  if (right.x >= anchorRect.right) return right;
  const left = clampInventoryContextMenuPosition(anchorRect.left - inventoryDropTypeMenuAnchorGapPx - safeWidth, above.y, safeWidth, safeHeight);
  return left.x + safeWidth <= anchorRect.left ? left : above;
};
