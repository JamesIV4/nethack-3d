/** Layout boxes alone do not reveal an invisible ancestor. */
export function isVisibleUi(element: HTMLElement): boolean {
  if (element.closest?.("[inert],[aria-hidden=true],[hidden]")) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0) return false;
  }
  return true;
}
