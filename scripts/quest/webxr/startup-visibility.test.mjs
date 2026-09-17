import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {patchStartupVisibility} from './patch-startup-visibility.mjs';
test('startup mask keeps splash and frame scheduling live and patches repeatably',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'nh3d-startup-test-'));
 const files={
 'app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java':'    final Object mCompositorLock = new Object();',
 'app/src/main/cpp/VRBrowser.h':'JNIEnv * Env();',
 'app/src/main/cpp/VRBrowser.cpp':'jmethodID sGetPointerColor = nullptr;\n  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);',
 'app/src/main/cpp/BrowserWorld.cpp':`  SplashAnimationPtr splashAnimation;
void Tick() {
  if (m.splashAnimation) {
    TickSplashAnimation();
  } else { TickWorld(); PushSystemState(); }
}
BrowserWorld::State::UpdateControllers(bool& aRelayoutWidgets) { UpdateInput(); }
BrowserWorld::DrawWorld(device::Eye aEye) {
  m.device->BindEye(aEye);
  DrawFlatBrowser();
}
BrowserWorld::DrawWebXRInterstitial(device::Eye aEye) {
  m.device->BindEye(aEye);
  DrawSpinner();
}
BrowserWorld::DrawImmersive(device::Eye aEye) {
  m.device->BindEye(aEye);
  m.blitter->Draw(aEye);
  DrawGamePanes();
}
BrowserWorld::DrawSplashAnimation(device::Eye aEye) { DrawOriginalSplash(); }
`};
 try{
  for(const[file,source]of Object.entries(files)){const p=path.join(dir,file);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,source);}
  patchStartupVisibility(dir);const first=Object.keys(files).map(f=>readFileSync(path.join(dir,f),'utf8'));patchStartupVisibility(dir);
  assert.deepEqual(Object.keys(files).map(f=>readFileSync(path.join(dir,f),'utf8')),first);
  const cpp=first.at(-1);
  assert.match(first[0],/BuildConfig.NH3D_GAME_HOST && !BundledGameServer.isStartupFlatReady/);
  assert.match(cpp,/else \{ TickWorld\(\); PushSystemState\(\); \}/);
  assert.match(cpp,/DrawSplashAnimation\(device::Eye aEye\) \{ DrawOriginalSplash\(\); \}/);
  assert.match(cpp,/DrawWorld[^]*?BindEye\(aEye\);\s*if \(m.gameStartupMasked\).*return;[^]*?DrawFlatBrowser/);
  const immersive=cpp.slice(cpp.indexOf('BrowserWorld::DrawImmersive'));
  assert.ok(immersive.indexOf('gamePointerState[13] < 1')<immersive.indexOf('m.blitter->Draw'));
  assert.match(cpp,/widget->GetLayer\(\)->ClearRequestDraw/);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));assert.match(path.basename(dir),/^nh3d-startup-test-/);rmSync(dir,{recursive:true,force:true});}
});
