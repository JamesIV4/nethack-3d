import { isVisibleUi } from "./visibility";
const controls = "button,a[href],input,textarea,select,label,summary,canvas,#stats-bar,#game-log,[tabindex]:not([tabindex='-1']),[role=button],[role=slider],[contenteditable=true],[data-xr-ui]";
const surfaces = ".nh3d-dialog,.nh3d-context-menu,.nh3d-mobile-actions-sheet,.nh3d-wizard-commands-sheet.is-visible,[role=dialog],[role=alertdialog]";

export function uiHitRectangles(): number[] {
  const regions: number[][] = [];
  const coveredSurfaces = new Set<Element>();
  for (const element of document.querySelectorAll<HTMLElement>(surfaces + "," + controls)) {
    const surface = element.closest(surfaces);
    if (surface !== element && surface && coveredSurfaces.has(surface)) continue;
    const style = getComputedStyle(element);
    if (!isVisibleUi(element) || style.pointerEvents === "none") continue;
    const bounds = element.getBoundingClientRect();
    let left = Math.max(0, bounds.left), top = Math.max(0, bounds.top), right = Math.min(innerWidth, bounds.right), bottom = Math.min(innerHeight, bounds.bottom);
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const css = getComputedStyle(parent), clip = parent.getBoundingClientRect();
      if (/hidden|clip|scroll|auto/.test(css.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      if (/hidden|clip|scroll|auto/.test(css.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
    }
    if (right <= left || bottom <= top) continue;
    const rect = [left / innerWidth, top / innerHeight, right / innerWidth, bottom / innerHeight];
    if (regions.some((r) => r[0] <= rect[0] && r[1] <= rect[1] && r[2] >= rect[2] && r[3] >= rect[3])) continue;
    regions.push(rect);
    if (surface === element) coveredSurfaces.add(element);
    if (regions.length > 128) return [0, 0, 1, 1];
  }
  return regions.flat();
}

export function pickUiTarget(x: number, y: number): HTMLElement | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const target = element.closest<HTMLElement>(controls) ?? element.closest<HTMLElement>(surfaces);
    if (!target || !isVisibleUi(target)) continue;
    return target;
  }
  return null;
}

export function pointerEvent(target: HTMLElement, type: string, x: number, y: number, id: number, down: boolean): void {
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: id,
    pointerType: "mouse", isPrimary: id === 1, button: 0, buttons: down ? 1 : 0 };
  target.dispatchEvent(new PointerEvent("pointer" + type, init));
  if (type !== "cancel") target.dispatchEvent(new MouseEvent("mouse" + type, init));
}

export function dragRange(target: HTMLElement, x: number): void {
  if (!(target instanceof HTMLInputElement) || target.type !== "range" || target.disabled) return;
  const bounds = target.getBoundingClientRect();
  if (!bounds.width) return;
  const min = Number(target.min || 0), max = Number(target.max || 100), step = Number(target.step || 1);
  let fraction = Math.max(0, Math.min(1, (x - bounds.left) / bounds.width));
  if (getComputedStyle(target).direction === "rtl") fraction = 1 - fraction;
  let value = min + fraction * (max - min);
  if (Number.isFinite(step) && step > 0) value = min + Math.round((value - min) / step) * step;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setValue.call(target, String(Math.max(min, Math.min(max, value))));
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}
