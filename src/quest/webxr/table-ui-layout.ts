import { uiHitRectangles } from "./dom-pointer";

/** id, left, top, right, bottom in the one live HTML surface. */
export type UiPane = [number, number, number, number, number];
function bounds(selector: string): [number, number, number, number] | null {
  let left = innerWidth, top = innerHeight, right = 0, bottom = 0;
  for (const node of document.querySelectorAll<HTMLElement>(selector)) {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    if (style.visibility !== "visible" || style.display === "none" || Number(style.opacity) === 0 || rect.width <= 0 || rect.height <= 0) continue;
    left = Math.min(left, rect.left); top = Math.min(top, rect.top);
    right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom);
  }
  left = Math.max(0, left); top = Math.max(0, top); right = Math.min(innerWidth, right); bottom = Math.min(innerHeight, bottom);
  return right > left && bottom > top ? [left / innerWidth, top / innerHeight, right / innerWidth, bottom / innerHeight] : null;
}

export function tableUiPanes(firstPerson: boolean, hitRects = uiHitRectangles()): UiPane[] {
  if (firstPerson) return [[4, 0, 0, 1, 1]];
  const modal = bounds(".nh3d-dialog.is-visible,.nh3d-mobile-actions-sheet,.nh3d-mobile-log:not(.nh3d-mobile-log-collapsed),.nh3d-wizard-commands-sheet.is-visible,[role=dialog],[role=menu]");
  if (modal) return [[4, ...modal]];
  const selectors = ["#stats-bar", ".top-left-ui,.nh3d-mobile-log-collapsed,.floating-message-container", ".nh3d-minimap,.nh3d-mobile-bottom-bar", ".nh3d-desktop-bottom-actions,.nh3d-map-move-controls"];
  const panes: UiPane[] = [];
  selectors.forEach((selector, id) => { const rect = bounds(selector); if (rect) panes.push([id, ...rect]); });
  for (let i = 0; i < panes.length; i++) for (let j = i + 1; j < panes.length; j++) {
    const a = panes[i], b = panes[j];
    if (Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.002 && Math.min(a[4], b[4]) - Math.max(a[2], b[2]) > 0.002) return [[4, 0, 0, 1, 1]];
  }
  // Preserve unfamiliar popovers instead of clipping controls out of a crop.
  for (let i = 0; i < hitRects.length; i += 4) {
    if (!panes.some((p) => p[1] <= hitRects[i] + 0.002 && p[2] <= hitRects[i + 1] + 0.002 && p[3] >= hitRects[i + 2] - 0.002 && p[4] >= hitRects[i + 3] - 0.002)) return [[4, 0, 0, 1, 1]];
  }
  return panes.length ? panes : [[4, 0, 0, 1, 1]];
}
