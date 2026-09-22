import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {replaceOnce} from './runtime-patch.mjs';
export function patchForeground(checkout){
 const edit=(file,marker,apply)=>{const p=path.join(checkout,file),s=readFileSync(p,'utf8').replaceAll('\r\n','\n');if(!s.includes(marker))writeFileSync(p,apply(s));};
 edit('app/src/main/cpp/ExternalBlitter.h','aForegroundOnly',s=>s.replace('const device::EyeRect& aRightEye);','const device::EyeRect& aRightEye, int aWidth = 0, int aHeight = 0);').replace('void Draw(const device::Eye aEye);','void Draw(const device::Eye aEye, bool aForegroundOnly = false);'));
 edit('app/src/main/cpp/ExternalBlitter.cpp','NH3D frame-local foreground',s=>{
  s=s.replaceAll('precision mediump float;', 'precision highp float;');
  s=s.replaceAll('uniform samplerExternalOES u_texture0;\n\nvarying vec2 v_uv;',`uniform samplerExternalOES u_texture0;
uniform vec2 u_texel;
uniform vec4 u_eyeRect;
uniform bool u_foregroundOnly;
varying vec2 v_uv;
// NH3D frame-local foreground: recognize the four alpha-only header texels.
// Probe both orientations because SurfaceTexture producers may flip vertically.
vec4 tagRow(float y) {
  return vec4(texture2D(u_texture0,vec2(u_eyeRect.x+0.5*u_texel.x,y)).a,
    texture2D(u_texture0,vec2(u_eyeRect.x+1.5*u_texel.x,y)).a,
    texture2D(u_texture0,vec2(u_eyeRect.x+2.5*u_texel.x,y)).a,
    texture2D(u_texture0,vec2(u_eyeRect.x+3.5*u_texel.x,y)).a);
}
bool validTag(vec4 a) { return all(lessThan(abs(a-vec4(.625,.75,.875,.625)),vec4(.012))); }`);
  s=replaceOnce(s,'  gl_FragColor = texture2D(u_texture0, v_uv);',`  vec4 color = texture2D(u_texture0, v_uv);
  bool bottom = validTag(tagRow(u_eyeRect.y+.5*u_texel.y));
  bool top = validTag(tagRow(u_eyeRect.y+u_eyeRect.w-.5*u_texel.y));
  bool encoded = bottom || top;
  bool header = v_uv.x < u_eyeRect.x+4.0*u_texel.x &&
    ((bottom && v_uv.y < u_eyeRect.y+u_texel.y) || (top && v_uv.y > u_eyeRect.y+u_eyeRect.w-u_texel.y));
  if (u_foregroundOnly) {
    if (!encoded || header || color.a <= .51) discard;
    color.a = clamp((color.a-.5)*2.,0.,1.);
  } else if (encoded) {
    color.a = header ? 0. : min(1.,color.a*2.);
  }
  gl_FragColor = color;`,'foreground shader');
  s=s.replace('  GLint uTexture0;', '  GLint uTexture0;\n  GLint uTexel, uEyeRect, uForegroundOnly;\n  float texelX = 0, texelY = 0;');
  s=s.replace('const device::EyeRect& aRightEye) {','const device::EyeRect& aRightEye, int aWidth, int aHeight) {\n  m.texelX = aWidth > 0 ? 1.0f/aWidth : 0; m.texelY = aHeight > 0 ? 1.0f/aHeight : 0;');
  s=s.replace('ExternalBlitter::Draw(const device::Eye aEye) {','ExternalBlitter::Draw(const device::Eye aEye, bool aForegroundOnly) {');
  s=s.replace('  VRB_GL_CHECK(glUniform1i(m.uTexture0, 0));','  VRB_GL_CHECK(glUniform1i(m.uTexture0, 0));\n  glUniform2f(m.uTexel,m.texelX,m.texelY);\n  const auto& eye = m.eyes[device::EyeIndex(aEye)];\n  glUniform4f(m.uEyeRect,eye.mX,eye.mY,eye.mWidth,eye.mHeight);\n  glUniform1i(m.uForegroundOnly,aForegroundOnly);');
  return s.replace('    m.uTexture0 = vrb::GetUniformLocation(m.program, "u_texture0");','    m.uTexture0 = vrb::GetUniformLocation(m.program, "u_texture0");\n    m.uTexel = vrb::GetUniformLocation(m.program,"u_texel");\n    m.uEyeRect = vrb::GetUniformLocation(m.program,"u_eyeRect");\n    m.uForegroundOnly = vrb::GetUniformLocation(m.program,"u_foregroundOnly");');
 });
 edit('app/src/main/cpp/BrowserWorld.cpp','NH3D redraw tracked foreground',s=>{
  s=s.replace('m.blitter->StartFrame(surfaceHandle, leftEye, rightEye);','m.blitter->StartFrame(surfaceHandle, leftEye, rightEye, textureWidth, textureHeight);');
  const start=s.indexOf('BrowserWorld::DrawImmersive(device::Eye aEye)'),end=s.indexOf('\nvoid\nBrowserWorld::TickWebXRInterstitial',start);
  const body=replaceOnce(s.slice(start,end),'  m.DrawGamePointers(*camera);','  // NH3D redraw tracked foreground after every native HTML/keyboard surface.\n  m.blitter->Draw(aEye, true);\n  m.DrawGamePointers(*camera);','foreground composition order');
  return s.slice(0,start)+body+s.slice(end);
 });
}
