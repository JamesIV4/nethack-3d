import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {replaceOnce} from './runtime-patch.mjs';

export function patchLootForeground(checkout) {
 const edit=(file,marker,apply)=>{const p=path.join(checkout,file),s=readFileSync(p,'utf8').replaceAll('\r\n','\n');if(!s.includes(marker))writeFileSync(p,apply(s));};
 edit('app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java','getGameLootHits',s=>replaceOnce(s,
  '    final Object mCompositorLock = new Object();',
  '    @Keep\n    public int getGameLootHits() { return BundledGameServer.getLootHits(); }\n    final Object mCompositorLock = new Object();','loot hit getter'));
 edit('app/src/main/cpp/VRBrowser.h','GetGameLootHits',s=>replaceOnce(s,'JNIEnv * Env();','JNIEnv * Env();\nint GetGameLootHits();','loot hit declaration'));
 edit('app/src/main/cpp/VRBrowser.cpp','GetGameLootHits',s=>{
  s=replaceOnce(s,'jmethodID sGetPointerColor = nullptr;','jmethodID sGetPointerColor = nullptr;\njmethodID sGetGameLootHits = nullptr;','loot hit binding');
  s=replaceOnce(s,'  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);',
    '  sGetGameLootHits = FindJNIMethodID(sEnv, sBrowserClass, "getGameLootHits", "()I");\n  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);','loot hit lookup');
  return s+'\nint crow::VRBrowser::GetGameLootHits() { return sEnv && sActivity && sGetGameLootHits ? sEnv->CallIntMethod(sActivity, sGetGameLootHits) : 0; }\n';
 });
 edit('app/src/main/cpp/BrowserWorld.cpp','NH3D loot input priority',s=>{
  s=replaceOnce(s,'  const int controllerOpacity = externalVR->IsPresenting() ? VRBrowser::GetGameControllerOpacity() : 65535;',
    '  const int controllerOpacity = externalVR->IsPresenting() ? VRBrowser::GetGameControllerOpacity() : 65535;\n  const int lootHits = externalVR->IsPresenting() ? VRBrowser::GetGameLootHits() : 0; // NH3D loot input priority','loot hit snapshot');
  return replaceOnce(s,'    const bool keyboardForeground = externalVR->IsPresenting() &&\n',
    '    if (gamePanels) gamePanels->SetLootHit(controller.index, controller.hasAim && (lootHits & (controller.leftHanded ? 1 : 2)));\n    const bool keyboardForeground = externalVR->IsPresenting() &&\n','loot hit per hand');
 });
 edit('app/src/main/cpp/ExternalBlitter.h','aLootOnly',s=>replaceOnce(s,
  'bool aForegroundOnly = false);','bool aForegroundOnly = false, bool aLootOnly = false);','loot blitter declaration'));
 edit('app/src/main/cpp/ExternalBlitter.cpp','NH3D loot foreground',s=>{
  s=s.replaceAll('uniform bool u_foregroundOnly;','uniform bool u_foregroundOnly;\nuniform bool u_lootOnly; // NH3D loot foreground');
  s=s.replaceAll('bool validTag(vec4 a) { return all(lessThan(abs(a-vec4(.625,.75,.875,.625)),vec4(.012))); }',
   'bool validTag(vec4 a) { return all(lessThan(abs(a.xyz-vec3(.625,.75,.875)),vec3(.012))) && (abs(a.w-.625)<.012 || abs(a.w-.75)<.012); }');
  s=replaceOnce(s,'  bool encoded = bottom || top;',`  bool encoded = bottom || top;
  bool lootEncoded = (bottom && tagRow(u_eyeRect.y+.5*u_texel.y).w > .7) ||
    (top && tagRow(u_eyeRect.y+u_eyeRect.w-.5*u_texel.y).w > .7);`,'loot frame tag');
  s=replaceOnce(s,`  if (u_foregroundOnly) {
    if (!encoded || header || color.a <= .51) discard;
    color.a = clamp((color.a-.5)*2.,0.,1.);`, `  if (u_lootOnly) {
    if (!lootEncoded || header || color.a <= .51 || color.a > .875) discard;
    color.a = clamp((color.a-.5)*4.,0.,1.);
  } else if (u_foregroundOnly) {
    if (!encoded || header || color.a <= (lootEncoded ? .875 : .51)) discard;
    color.a = lootEncoded ? clamp((color.a-.75)*4.,0.,1.) : clamp((color.a-.5)*2.,0.,1.);`,'separate loot and hand masks');
  s=replaceOnce(s,'GLint uTexel, uEyeRect, uForegroundOnly;','GLint uTexel, uEyeRect, uForegroundOnly, uLootOnly;','loot uniform state');
  s=replaceOnce(s,'ExternalBlitter::Draw(const device::Eye aEye, bool aForegroundOnly) {','ExternalBlitter::Draw(const device::Eye aEye, bool aForegroundOnly, bool aLootOnly) {','loot draw signature');
  s=replaceOnce(s,'  glUniform1i(m.uForegroundOnly,aForegroundOnly);','  glUniform1i(m.uForegroundOnly,aForegroundOnly);\n  glUniform1i(m.uLootOnly,aLootOnly);','loot draw uniform');
  return replaceOnce(s,'    m.uForegroundOnly = vrb::GetUniformLocation(m.program,"u_foregroundOnly");',
    '    m.uForegroundOnly = vrb::GetUniformLocation(m.program,"u_foregroundOnly");\n    m.uLootOnly = vrb::GetUniformLocation(m.program,"u_lootOnly");','loot uniform lookup');
 });
 edit('app/src/main/cpp/BrowserWorld.cpp','NH3D loot covers only actions',s=>replaceOnce(s,
  '  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);',
  `  // NH3D loot covers only actions: other HUD panes and modals follow it.
  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, false, true);
  m.drawList->Draw(*camera);
  m.blitter->Draw(aEye, false, true);
  m.drawList->Reset();
  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);`,'loot above action bar'));
 edit('app/src/main/cpp/ExternalBlitter.cpp','NH3D cached loot tag',s=>{
  s=replaceOnce(s,`  bool bottom = validTag(tagRow(u_eyeRect.y+.5*u_texel.y));
  bool top = validTag(tagRow(u_eyeRect.y+u_eyeRect.w-.5*u_texel.y));`,
   `  // NH3D cached loot tag: reuse the same header samples for both gates.
  vec4 bottomTag = tagRow(u_eyeRect.y+.5*u_texel.y);
  vec4 topTag = tagRow(u_eyeRect.y+u_eyeRect.w-.5*u_texel.y);
  bool bottom = validTag(bottomTag);
  bool top = validTag(topTag);`,'cached loot header samples');
  return s.replace('(bottom && tagRow(u_eyeRect.y+.5*u_texel.y).w > .7)', '(bottom && bottomTag.w > .7)')
    .replace('(top && tagRow(u_eyeRect.y+u_eyeRect.w-.5*u_texel.y).w > .7)', '(top && topTag.w > .7)');
 });
}
