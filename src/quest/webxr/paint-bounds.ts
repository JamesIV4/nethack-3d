/** Conservative CSS shadow outsets: left, top, right, bottom. */
export function shadowOutsets(shadow: string): [number, number, number, number] {
  const out: [number,number,number,number] = [0,0,0,0];
  const parts: string[] = []; let depth=0, start=0;
  for(let i=0;i<shadow.length;i++) { if(shadow[i]==="(") depth++; if(shadow[i]===")") depth--; if(shadow[i]===","&&depth===0){parts.push(shadow.slice(start,i));start=i+1;} }
  parts.push(shadow.slice(start));
  for(const part of parts) {
    if (/\binset\b/.test(part)) continue;
    const values=[...part.matchAll(/(-?(?:\d*\.)?\d+)px/g)].map(m=>Number(m[1]));
    if(values.length<2) continue;
    const [x,y,blur=0,spread=0]=values, extent=2*blur+spread;
    [extent-x,extent-y,extent+x,extent+y].forEach((v,i)=>{out[i]=Math.max(out[i],v);});
  }
  return out;
}
export function paintBounds(element: HTMLElement): { left:number; top:number; right:number; bottom:number } {
  const initial=element.getBoundingClientRect();
  const result={left:initial.left,top:initial.top,right:initial.right,bottom:initial.bottom};
  for(const node of [element,...element.querySelectorAll<HTMLElement>("*")]) {
    const style=getComputedStyle(node), rect=node.getBoundingClientRect();
    if(style.display==="none"||style.visibility!=="visible"||Number(style.opacity)===0||rect.width<=0||rect.height<=0) continue;
    const scale=node.offsetWidth>0?rect.width/node.offsetWidth:1;
    const text = shadowOutsets(style.textShadow??"none");
    const [l,t,r,b]=shadowOutsets(style.boxShadow??"none").map((v,i)=>Math.max(v,text[i])*scale);
    let left=rect.left-l, top=rect.top-t, right=rect.right+r, bottom=rect.bottom+b;
    if (node !== element) for(let parent=node.parentElement;parent;parent=parent.parentElement) {
      const css=getComputedStyle(parent), clip=parent.getBoundingClientRect();
      if(/hidden|clip|auto|scroll/.test(css.overflowX)) { left=Math.max(left,clip.left); right=Math.min(right,clip.right); }
      if(/hidden|clip|auto|scroll/.test(css.overflowY)) { top=Math.max(top,clip.top); bottom=Math.min(bottom,clip.bottom); }
      if(parent===element) break;
    }
    if(right<=left||bottom<=top) continue;
    result.left=Math.min(result.left,left); result.top=Math.min(result.top,top);
    result.right=Math.max(result.right,right); result.bottom=Math.max(result.bottom,bottom);
  }
  return result;
}
