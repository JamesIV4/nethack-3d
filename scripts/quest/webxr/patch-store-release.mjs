import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { excludedStorePermissions } from './store-manifest.mjs';

function stripUnusedDeclarations(xml) {
  return xml.replace(/<uses-(?:permission(?:-sdk-23)?|feature)\b[^>]*\/\s*>/g, tag => {
    const name = tag.match(/android:name\s*=\s*["']([^"']+)["']/)?.[1];
    return excludedStorePermissions.includes(name) || name === 'oculus.software.eye_tracking' ? '' : tag;
  });
}

function hardenApplication(xml, overlay = false) {
  return xml.replace(/<application\b[^>]*>/, tag => {
    const attributes = {
      'android:allowBackup': 'false',
      'android:fullBackupContent': 'false',
      'android:usesCleartextTraffic': 'false',
      'android:networkSecurityConfig': '@xml/nh3d_network_security_config',
    };
    if (overlay) {
      const existing = tag.match(/tools:replace\s*=\s*["']([^"']*)["']/)?.[1] ?? '';
      attributes['tools:replace'] = [...new Set([...existing.split(',').map(s=>s.trim()).filter(Boolean), ...Object.keys(attributes)])].join(',');
    }
    for (const [name, value] of Object.entries(attributes)) {
      const pattern = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, 'g');
      tag = tag.replace(pattern, '').replace(/\s*\/?>$/, end => ` ${name}="${value}"${end}`);
    }
    return tag;
  });
}
export function patchStoreRelease(checkout) {
  const main=path.join(checkout,'app/src/main/AndroidManifest.xml');
  let xml=hardenApplication(stripUnusedDeclarations(readFileSync(main,'utf8')));
  writeFileSync(main,xml);
  const resources=path.join(checkout,'app/src/main/res/xml');
  mkdirSync(resources,{recursive:true});
  copyFileSync(new URL('../../../quest/webxr/host/network-security-config.xml',import.meta.url),path.join(resources,'nh3d_network_security_config.xml'));
  // Keep the known game-host activity configuration; the upstream release
  // overlay otherwise replaces its theme, icons and launch mode with browser UI.
  const debug=path.join(checkout,'app/src/oculusvrArmDebug/AndroidManifest.xml');
  let overlay=readFileSync(debug,'utf8');
  // Replace old declarations and removal markers on already-prepared checkouts.
  // Overlay removals also block permissions inherited from browser libraries.
  overlay=stripUnusedDeclarations(overlay);
  if(!overlay.includes('xmlns:tools=')) overlay=overlay.replace('<manifest', '<manifest xmlns:tools="http://schemas.android.com/tools"');
  const removals=excludedStorePermissions.flatMap(name => [
    `<uses-permission android:name="${name}" tools:node="remove" />`,
    `<uses-permission-sdk-23 android:name="${name}" tools:node="remove" />`,
  ]);
  removals.push('<uses-feature android:name="oculus.software.eye_tracking" tools:node="remove" />');
  overlay=overlay.replace(/\s*<application\b/, '\n    '+removals.join('\n    ')+'\n    <application');
  overlay=hardenApplication(overlay,true);
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
