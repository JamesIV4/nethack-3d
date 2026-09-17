import { uiHitRectangles } from "./dom-pointer";
import { paintBounds } from "./paint-bounds";
import { isVisibleUi, clipUiBounds } from "./visibility";

/** id, left, top, right, bottom in the one live HTML surface. */
export type UiPane = [number, number, number, number, number];
function bounds(selector: string, paint = false, excludeInventoryPopups = false): [number, number, number, number] | null {
  let left = innerWidth, top = innerHeight, right = 0, bottom = 0;
  for (const node of document.querySelectorAll<HTMLElement>(selector)) {
    if (excludeInventoryPopups && node.matches?.(".nh3d-inventory-context-menu,.nh3d-inventory-drop-type-menu")) continue;
    const rect = node.getBoundingClientRect();
    if (!isVisibleUi(node) || rect.width <= 0 || rect.height <= 0) continue;
    const box = clipUiBounds(node, paint ? paintBounds(node) : rect);
    if (!box) continue;
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
  const minimap = bounds(".nh3d-minimap");
  const status = bounds("#stats-bar", true);
  // Leave two source pixels before the minimap: a shared boundary allows
  // bilinear filtering to sample its border into the status pane.
  if (status && minimap && minimap[1] > status[1] && minimap[1] <= status[3]) {
    status[3] = minimap[1] - 2 / innerHeight;
  }
  const modal = bounds("#loading,.nh3d-dialog,.nh3d-context-menu,.nh3d-mobile-actions-sheet,.nh3d-mobile-log:not(.nh3d-mobile-log-collapsed),.nh3d-wizard-commands-sheet.is-visible,[role=dialog],[role=alertdialog],[role=menu]", true, true);
  // The native host attaches this crop to pane 4 at its source-pixel offset,
  // leaving the parent dialog crop and its physical placement unchanged.
  const selectMenu = bounds(".nh3d-select-menu,.nh3d-inventory-context-menu,.nh3d-inventory-drop-type-menu", true);
  // These crops share the game's live DOM texture and native hit-testing path.
  if (document.documentElement?.classList.contains("nh3d-xr-menu")) {
    const panes: UiPane[] = [];
    const logo = bounds(".logo-container", true);
    const footer = bounds(".nh3d-startup-build-label,.nh3d-startup-build-label-link,.nh3d-startup-build-label-toast,.nh3d-startup-vr-entry:has(button)", true);
    if (logo) panes.push([12, ...logo]);
    if (modal) panes.push([13, ...modal]);
    if (modal && selectMenu) panes.push([15, ...selectMenu]);
    if (footer) panes.push([14, ...footer]);
    return panes;
  }
  if (firstPerson) {
    const actions = bounds(".nh3d-mobile-bottom-bar,.nh3d-mobile-repeat-button", true) ?? bounds(".nh3d-desktop-bottom-actions", true);
    const dedicated: UiPane[] = [
      ...(status ? [[0, ...status] as UiPane] : []),
      ...(actions ? [[2, ...actions] as UiPane] : []),
      ...(minimap ? [[5, ...minimap] as UiPane] : []),
    ];
    // GameUiPanels subtracts these exact dedicated crops from the full HUD.
    // Retaining the complete source pane preserves messages and every other
    // HUD element between the status, minimap, and action controls.
    return [...dedicated, [7, 0, 0, 1, 1], ...(modal ? [[4, ...modal] as UiPane] : []), ...(modal && selectMenu ? [[15, ...selectMenu] as UiPane] : [])];
  }
  const selectors = [[0, "#stats-bar"], [2, ".nh3d-mobile-bottom-bar,.nh3d-mobile-repeat-button"], [3, ".nh3d-desktop-bottom-actions,.nh3d-map-move-controls"]] as const;
  const panes: UiPane[] = [];
  selectors.forEach(([id, selector]) => { const rect = id === 0 ? status : bounds(selector, true); if (rect) panes.push([id, ...rect]); });
  for (const [id, selector] of [[5, ".nh3d-minimap"], [6, ".nh3d-xr-table-controls"]] as const) {
    const rect = bounds(selector, id === 6); if (rect) panes.push([id, ...rect]);
  }
  const messages = bounds(".top-left-ui,.floating-message-container,.nh3d-mobile-log-collapsed", true);
  if (messages) panes.push([11, ...messages]);
  // Only explicit UI surfaces become panes; arbitrary hit boxes are not windows.
  if (modal) panes.push([4, ...modal]);
  if (modal && selectMenu) panes.push([15, ...selectMenu]);
  return panes;
}
