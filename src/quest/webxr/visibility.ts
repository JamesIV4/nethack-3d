/** Layout boxes alone do not reveal an invisible ancestor. */
export function isVisibleUi(element: HTMLElement): boolean {
  if (element.isConnected === false || element.getClientRects?.().length === 0) return false;
  if (element.closest?.("[inert],[aria-hidden=true],[hidden],.is-exiting")) return false;
  let opacity = 1;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility !== "visible" || style.contentVisibility === "hidden") return false;
    opacity *= Number(style.opacity);
    if (opacity <= .001) return false;
  }
  return true;
}

/** Clipping can hide a laid-out child even when every ancestor is visible. */
export function clipUiBounds(element: HTMLElement, box: Pick<DOMRect, "left" | "top" | "right" | "bottom">): {left:number;top:number;right:number;bottom:number} | null {
  let left = Math.max(0,box.left), top = Math.max(0,box.top), right = Math.min(innerWidth,box.right), bottom = Math.min(innerHeight,box.bottom);
  for (let parent=element.parentElement; parent; parent=parent.parentElement) {
    const css=getComputedStyle(parent), clip=parent.getBoundingClientRect();
    if (/hidden|clip|scroll|auto/.test(css.overflowX)) { left=Math.max(left,clip.left); right=Math.min(right,clip.right); }
    if (/hidden|clip|scroll|auto/.test(css.overflowY)) { top=Math.max(top,clip.top); bottom=Math.min(bottom,clip.bottom); }
  }
  return right>left && bottom>top ? {left,top,right,bottom} : null;
}
