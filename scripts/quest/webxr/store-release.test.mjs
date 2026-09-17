import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {patchStoreRelease} from './patch-store-release.mjs';
import {assertStoreManifest} from './store-manifest.mjs';
const valid=`E: manifest (line=1)
  E: uses-feature
    A: android:name(0x01010003)="oculus.software.eye_tracking"
  E: uses-permission
    A: android:name(0x01010003)="com.oculus.permission.EYE_TRACKING"
  E: application
    A: android:label(0x01010001)="NetHack 3D"
    A: android:description(0x01010020)=@0x7f120123
    A: android:debuggable(0x0101000f)=(type 0x12)0x0
    E: activity
      E: intent-filter
        E: action
          A: android:name(0x01010003)="android.intent.action.MAIN"
        E: category
          A: android:name(0x01010003)="com.oculus.intent.category.VR"
`;
test('accepts a non-debuggable VR release with its optional eye feature',()=>assert.doesNotThrow(()=>assertStoreManifest(valid)));
for(const permission of ['REQUEST_INSTALL_PACKAGES','QUERY_ALL_PACKAGES']) test('rejects '+permission,()=>assert.throws(()=>assertStoreManifest(valid.replace('com.oculus.permission.EYE_TRACKING','android.permission.'+permission)),/Unsupported store permission/));
test('rejects debuggable, incomplete tracking declarations, wrong name and detached VR category',()=>{
 assert.throws(()=>assertStoreManifest(valid.replace('(type 0x12)0x0','(type 0x12)0xffffffff')),/debuggable/);
 assert.throws(()=>assertStoreManifest(valid.replace('oculus.software.eye_tracking','other')),/Eye tracking/);
 assert.throws(()=>assertStoreManifest(valid.replace('NetHack 3D','Wolvic')),/app name/);
 assert.throws(()=>assertStoreManifest(valid.replace('        E: category','      E: intent-filter\n        E: category')),/MAIN\/VR/);
});
test('patch preserves game activity and local properties and is repeatable',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'nh3d-store-test-'));
 try {
  const put=(file,text)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),text);};
  put('app/src/main/AndroidManifest.xml','<manifest><uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/><application android:theme="@style/Nh3d.Game"/></manifest>');
  put('app/src/oculusvrArmDebug/AndroidManifest.xml','<manifest><application><activity android:name=".VRBrowserActivity"><intent-filter><category android:name="com.oculus.intent.category.VR" android:value="vr_only"/></intent-filter></activity></application></manifest>');
  mkdirSync(path.join(root,'app/src/oculusvrArmRelease'),{recursive:true});put('app/build.gradle','android {}');put('user.properties','customSetting=keep\nuseDebugSigningOnRelease=true\n');
  patchStoreRelease(root);
  const files=['app/src/main/AndroidManifest.xml','app/src/oculusvrArmDebug/AndroidManifest.xml','app/src/oculusvrArmRelease/AndroidManifest.xml','app/build.gradle','user.properties'];
  const before=files.map(file=>readFileSync(path.join(root,file),'utf8'));patchStoreRelease(root);
  assert.deepEqual(files.map(file=>readFileSync(path.join(root,file),'utf8')),before);
  assert.match(before[0],/Nh3d.Game/);assert.doesNotMatch(before[0],/REQUEST_INSTALL_PACKAGES/);
  assert.doesNotMatch(before[2],/android:debuggable/);assert.match(readFileSync(path.join(root,"app/nh3d-release.gradle"),"utf8"),/debuggable false/);assert.match(before[2],/eye_tracking" android:required="false"/);
  assert.match(before[2],/android.intent.action.MAIN/);assert.match(before[4],/customSetting=keep/);assert.match(before[4],/useDebugSigningOnRelease=false/);
 } finally {assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.match(path.basename(root),/^nh3d-store-test-/);rmSync(root,{recursive:true,force:true});}
});

import {geckoConfigResourcePath} from './store-manifest.mjs';
test('resolves Gecko configuration after release resource path shortening',()=>{
 for(const file of ['res/raw/fxr_config.yaml','res/U6.yaml']) assert.equal(geckoConfigResourcePath(`  resource 0x7f100006 com.nethack3d.quest.vr:raw/fxr_config: t=0x03\n    (string8) "${file}"`),file);
 assert.throws(()=>geckoConfigResourcePath('spec resource raw/fxr_config'),/Cannot resolve/);
});
