import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {replaceOnce} from './runtime-patch.mjs';
export function patchStartupVisibility(checkout) {
 const edit=(file,marker,apply)=>{const p=path.join(checkout,file),s=readFileSync(p,'utf8').replaceAll('\r\n','\n');if(!s.includes(marker))writeFileSync(p,apply(s));};
 edit('app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java','isGameStartupMasked',s=>replaceOnce(s,'    final Object mCompositorLock = new Object();',`    @Keep
    public boolean isGameStartupMasked() { return BuildConfig.NH3D_GAME_HOST && !BundledGameServer.isStartupFlatReady(); }
    final Object mCompositorLock = new Object();`,'startup visibility JNI getter'));
 edit('app/src/main/cpp/VRBrowser.h','IsGameStartupMasked',s=>replaceOnce(s,'JNIEnv * Env();','JNIEnv * Env();\nbool IsGameStartupMasked();','startup mask declaration'));
 edit('app/src/main/cpp/VRBrowser.cpp','IsGameStartupMasked',s=>{
  s=replaceOnce(s,'jmethodID sGetPointerColor = nullptr;','jmethodID sGetPointerColor = nullptr;\njmethodID sIsGameStartupMasked = nullptr;','startup mask binding');
  s=replaceOnce(s,'  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);','  sIsGameStartupMasked = FindJNIMethodID(sEnv, sBrowserClass, "isGameStartupMasked", "()Z");\n  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);','startup mask lookup');
  return s+'\nbool crow::VRBrowser::IsGameStartupMasked() {\n  return sEnv && sActivity && sIsGameStartupMasked && sEnv->CallBooleanMethod(sActivity, sIsGameStartupMasked);\n}\n';
 });
 edit('app/src/main/cpp/BrowserWorld.cpp','NH3D startup presentation gate',s=>{
  s=replaceOnce(s,'  SplashAnimationPtr splashAnimation;',`  // NH3D startup presentation gate. Never change logical widget visibility:
  // Gecko must keep painting and establishing WebXR behind the blank frame.
  bool gameStartupComplete = false;
  bool gameStartupMasked = false;
  void DrawGameStartupBlank() {
    for (const auto& widget : widgets) if (widget->GetLayer()) widget->GetLayer()->ClearRequestDraw();
    if (skybox && skybox->GetLayer()) skybox->GetLayer()->ClearRequestDraw();
    if (layerEnvironment) layerEnvironment->ClearRequestDraw();
    GLfloat color[4]; glGetFloatv(GL_COLOR_CLEAR_VALUE, color);
    const bool scissor = glIsEnabled(GL_SCISSOR_TEST);
    glDisable(GL_SCISSOR_TEST); glDepthMask(GL_TRUE);
    glClearColor(0, 0, 0, 1); glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glClearColor(color[0], color[1], color[2], color[3]);
    if (scissor) glEnable(GL_SCISSOR_TEST);
  }
  SplashAnimationPtr splashAnimation;`,'startup presentation state');
  s=replaceOnce(s,'  if (m.splashAnimation) {\n    TickSplashAnimation();',`  if (!m.gameStartupComplete) {
    m.gameStartupMasked = VRBrowser::IsGameStartupMasked();
    if (!m.gameStartupMasked) m.gameStartupComplete = true; // Explicit flat/error recovery.
  }
  if (m.splashAnimation) {
    TickSplashAnimation();`,'startup rendering gate update');
  s=replaceOnce(s,'BrowserWorld::State::UpdateControllers(bool& aRelayoutWidgets) {','BrowserWorld::State::UpdateControllers(bool& aRelayoutWidgets) {\n  if (gameStartupMasked) return; // No clicks into the hidden startup browser.','startup hit suppression');
  for(const name of ['DrawWorld','DrawWebXRInterstitial']) {
    const start=s.indexOf('BrowserWorld::'+name+'('),bind=s.indexOf('  m.device->BindEye(aEye);',start);
    if(start<0||bind<0)throw new Error('Missing '+name+' eye binding');
    const end=bind+'  m.device->BindEye(aEye);'.length;
    s=s.slice(0,end)+'\n  if (m.gameStartupMasked) { m.DrawGameStartupBlank(); return; }'+s.slice(end);
  }
  s=replaceOnce(s,'  m.blitter->Draw(aEye);',`  if (m.gameStartupMasked) {
    // DrawImmersive is reached only for a completed, non-discarded XR frame.
    // Wait for actual HTML menu panes as well as the 3D projection.
    if (!m.gameUiAnchored || !m.gamePanels || !m.gamePanels->Owns(m.gameWindow) || m.gamePointerState.size() < 29 || m.gamePointerState[13] < 1) {
      m.DrawGameStartupBlank(); return;
    }
    m.gameStartupComplete = true;
    m.gameStartupMasked = false;
  }
  m.blitter->Draw(aEye);`,'reveal completed VR menu');
  return s;
 });
}
