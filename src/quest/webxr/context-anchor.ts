import { isVisibleUi } from "./visibility";

/** Inventory and other modal popups belong to their existing floating pane. */
export function hasWorldContextAnchor(root: ParentNode = document): boolean {
  const visible = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector)).some(isVisibleUi);
  if (visible(".nh3d-dialog,.nh3d-mobile-actions-sheet,.nh3d-mobile-log:not(.nh3d-mobile-log-collapsed),.nh3d-wizard-commands-sheet.is-visible,[role=dialog],[role=alertdialog]")) return false;
  return visible(".nh3d-tile-context-menu.is-visible,.nh3d-fps-crosshair-context.is-visible");
}
