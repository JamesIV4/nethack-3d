import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {patchUiResourceFlush} from './patch-ui-resource-flush.mjs';
test('same-frame pane resource flush leaves the render clock in the once-per-frame update',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'nh3d-resource-test-'));
 const files={
  'app/src/main/cpp/vrb/include/vrb/RenderContext.h':'  void Update();',
  'app/src/main/cpp/vrb/src/RenderContext.cpp':'namespace vrb {\nvoid\nRenderContext::Update() {\n  m.timestamp = nextTimestamp;\n  m.creationContext->Synchronize();\n  m.uninitializedResources.Update();\n  m.updatables.UpdateResource(*this);\n}\n}\n',
  'app/src/main/cpp/BrowserWorld.cpp':'    gamePanels->Update(gameWindow, gamePointerState, board, popup, device->GetHeadTransform().GetTranslation(), center);'};
 try{
  for(const[f,s]of Object.entries(files)){const p=path.join(dir,f);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,s);}
  patchUiResourceFlush(dir);const before=Object.keys(files).map(f=>readFileSync(path.join(dir,f),'utf8'));patchUiResourceFlush(dir);assert.deepEqual(Object.keys(files).map(f=>readFileSync(path.join(dir,f),'utf8')),before);
  const cpp=before[1],flush=cpp.slice(cpp.indexOf('vrb::RenderContext::FlushPendingResources'));
  assert.match(cpp,/m.timestamp = nextTimestamp;\s*FlushPendingResources\(\);/);assert.doesNotMatch(flush,/timestamp|frameDelta/);assert.match(flush,/m.uninitializedResources.Update/);
  assert.match(before[2],/if \(gamePanels->ConsumeResourceChanges\(\)\) context->FlushPendingResources/);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));assert.match(path.basename(dir),/^nh3d-resource-test-/);rmSync(dir,{recursive:true,force:true});}
});
