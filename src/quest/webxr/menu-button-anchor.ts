import type { UiPane } from "./table-ui-layout";
export function menuButtonAnchor(panes: readonly UiPane[], rect: Pick<DOMRect,"left"|"top"|"width"|"height">, width: number, height: number): {x:number;y:number;pane:number}|null {
  if(width<=0||height<=0||rect.width<=0||rect.height<=0)return null;
  const x=(rect.left+rect.width/2)/width,y=rect.top/height,centerY=(rect.top+rect.height/2)/height;
  const pane=[...panes].reverse().find(p=>!(p[0]>=7&&p[0]<=10)&&x>=p[1]&&x<=p[3]&&centerY>=p[2]&&centerY<=p[4]);
  return pane?{x,y,pane:pane[0]}:null;
}
