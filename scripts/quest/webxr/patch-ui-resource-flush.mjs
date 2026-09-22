import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {replaceOnce} from './runtime-patch.mjs';
export function patchUiResourceFlush(checkout) {
 const edit=(file,marker,apply)=>{const p=path.join(checkout,file),s=readFileSync(p,'utf8').replaceAll('\r\n','\n');if(!s.includes(marker))writeFileSync(p,apply(s));};
 edit('app/src/main/cpp/vrb/include/vrb/RenderContext.h','FlushPendingResources',s=>replaceOnce(s,'  void Update();','  void Update();\n  void FlushPendingResources();','UI resource flush declaration'));
 edit('app/src/main/cpp/vrb/src/RenderContext.cpp','RenderContext::FlushPendingResources',s=>{
  const start=s.indexOf('  m.creationContext->Synchronize();',s.indexOf('RenderContext::Update()'));
  const end=s.indexOf('\n}',start);
  if(start<0||end<0)throw Error('Missing native resource update');
  const body=s.slice(start,end);
  return s.slice(0,start)+'  FlushPendingResources();'+s.slice(end)+`\n// Commit same-frame UI geometry without advancing the frame clock twice.\nvoid\nvrb::RenderContext::FlushPendingResources() {\n${body}\n}\n`;
 });
 edit('app/src/main/cpp/BrowserWorld.cpp','NH3D commit pane geometry before drawing',s=>replaceOnce(s,
  '    gamePanels->Update(gameWindow, gamePointerState, board, popup, device->GetHeadTransform().GetTranslation(), center);',
  '    gamePanels->Update(gameWindow, gamePointerState, board, popup, device->GetHeadTransform().GetTranslation(), center);\n    // NH3D commit pane geometry before drawing: popup cutouts can create new GL resources.\n    if (gamePanels->ConsumeResourceChanges()) context->FlushPendingResources();','same-frame pane resources'));
}
