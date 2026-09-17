import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
export function patchStoreRelease(checkout) {
  const main=path.join(checkout,'app/src/main/AndroidManifest.xml');
  let xml=readFileSync(main,'utf8');
  for(const name of ['REQUEST_INSTALL_PACKAGES','QUERY_ALL_PACKAGES']) {
    xml=xml.replace(new RegExp(`<uses-permission\\s+android:name="android.permission.${name}"[^>]*/>`, 'g'),'');
  }
  writeFileSync(main,xml);
  // Keep the known game-host activity configuration; the upstream release
  // overlay otherwise replaces its theme, icons and launch mode with browser UI.
  const debug=path.join(checkout,'app/src/oculusvrArmDebug/AndroidManifest.xml');
  let overlay=readFileSync(debug,'utf8');
  for(const name of ['REQUEST_INSTALL_PACKAGES','QUERY_ALL_PACKAGES']) if(!overlay.includes(`android.permission.${name}`)) overlay=overlay.replace('<application>',`<uses-permission android:name="android.permission.${name}" tools:node="remove" />\n    <application>`);
  if(!overlay.includes('oculus.software.eye_tracking')) overlay=overlay.replace('<application>','<uses-feature android:name="oculus.software.eye_tracking" android:required="false" />\n    <application>');
  overlay=overlay.replace(/<intent-filter>\s*<category android:name="com.oculus.intent.category.VR"[^>]*\/>\s*<\/intent-filter>/,`<intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="com.oculus.intent.category.VR" />
            </intent-filter>`);
  writeFileSync(debug,overlay);
  writeFileSync(path.join(checkout,'app/src/oculusvrArmRelease/AndroidManifest.xml'),overlay.replace('<manifest ', '<manifest android:installLocation="auto" '));
  const buildPath=path.join(checkout,'app/build.gradle');
  let build=readFileSync(buildPath,'utf8');
  if(!build.includes("apply from: 'nh3d-release.gradle'")) build+="\napply from: 'nh3d-release.gradle'\n";
  writeFileSync(buildPath,build);
  copyFileSync(new URL('../../../quest/webxr/host/release.gradle',import.meta.url),path.join(checkout,'app/nh3d-release.gradle'));
  const propertiesPath=path.join(checkout,'user.properties');
  let properties=readFileSync(propertiesPath,'utf8');
  properties=properties.replace(/^useDebugSigningOnRelease=.*$/mg,'useDebugSigningOnRelease=false');
  if(!properties.includes('useDebugSigningOnRelease=')) properties+='\nuseDebugSigningOnRelease=false\n';
  writeFileSync(propertiesPath,properties);
}
