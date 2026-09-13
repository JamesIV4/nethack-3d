const controls = "button,a[href],input,textarea,select,label,[role=button],[role=slider],[contenteditable=true],[data-xr-ui]";
const surfaces = ".nh3d-dialog.is-visible,.nh3d-mobile-actions-sheet,.nh3d-wizard-commands-sheet.is-visible";

export function pickUiTarget(x: number, y: number): HTMLElement | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const target = element.closest<HTMLElement>(controls) ?? element.closest<HTMLElement>(surfaces);
    if (!target || target.closest("[inert], [aria-hidden=true]") || getComputedStyle(target).visibility === "hidden") continue;
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
