import { uiHitRectangles } from "./dom-pointer";
import { paintBounds } from "./paint-bounds";
import { isVisibleUi } from "./visibility";

/** id, left, top, right, bottom in the one live HTML surface. */
export type UiPane = [number, number, number, number, number];
function bounds(selector: string, paint = false): [number, number, number, number] | null {
  let left = innerWidth, top = innerHeight, right = 0, bottom = 0;
  for (const node of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = node.getBoundingClientRect();
    if (!isVisibleUi(node) || rect.width <= 0 || rect.height <= 0) continue;
    const box = paint ? paintBounds(node) : rect;
    left = Math.min(left, box.left); top = Math.min(top, box.top);
    right = Math.max(right, box.right); bottom = Math.max(bottom, box.bottom);
  }
  // A gutter includes antialiased borders and prevents adjacent crops sampling
  // a blue edge from this pane through bilinear texture filtering.
  if (paint && right > left && bottom > top) { left -= 4; top -= 4; right += 4; bottom += 4; }
  left = Math.max(0, left); top = Math.max(0, top); right = Math.min(innerWidth, right); bottom = Math.min(innerHeight, bottom);
  return right > left && bottom > top ? [left / innerWidth, top / innerHeight, right / innerWidth, bottom / innerHeight] : null;
}

export function tableUiPanes(firstPerson: boolean, hitRects = uiHitRectangles()): UiPane[] {
  const modal = bounds(".nh3d-dialog,.nh3d-context-menu,.nh3d-mobile-actions-sheet,.nh3d-mobile-log:not(.nh3d-mobile-log-collapsed),.nh3d-wizard-commands-sheet.is-visible,[role=dialog],[role=alertdialog],[role=menu]", true);
  if (firstPerson) {
    const actions = bounds(".nh3d-mobile-bottom-bar", true) ?? bounds(".nh3d-desktop-bottom-actions", true);
    const hole = actions ?? modal;
    if (!hole) return [[7, 0, 0, 1, 1]];
    const [left, top, right, bottom] = hole;
    // The movable action row is not also painted in the upper HUD. Native
    // modal masking removes any additional overlap without duplicating UI.
    const hud: UiPane[] = [[7, 0, 0, 1, top], [8, 0, bottom, 1, 1], [9, 0, top, left, bottom], [10, right, top, 1, bottom]];
    return [...hud.filter(p => p[3] > p[1] && p[4] > p[2]), ...(actions ? [[2, ...actions] as UiPane] : []), ...(modal ? [[4, ...modal] as UiPane] : [])];
  }
  const selectors = [[0, "#stats-bar"], [2, ".nh3d-mobile-bottom-bar"], [3, ".nh3d-desktop-bottom-actions,.nh3d-map-move-controls"]] as const;
  const panes: UiPane[] = [];
  selectors.forEach(([id, selector]) => { const rect = bounds(selector, id === 2 || id === 3); if (rect) panes.push([id, ...rect]); });
  for (const [id, selector] of [[5, ".nh3d-minimap"], [6, ".nh3d-xr-table-controls"]] as const) {
    const rect = bounds(selector); if (rect) panes.push([id, ...rect]);
  }
  const messages = bounds(".top-left-ui,.floating-message-container,.nh3d-mobile-log-collapsed", true);
  if (messages) panes.push([11, ...messages]);
  // Only explicit UI surfaces become panes; arbitrary hit boxes are not windows.
  if (modal) panes.push([4, ...modal]);
  return panes;
}
