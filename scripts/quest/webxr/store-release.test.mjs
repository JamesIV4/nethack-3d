import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {patchStoreRelease} from './patch-store-release.mjs';
import {assertStoreManifest, excludedStorePermissions, networkSecurityResource, assertNetworkSecurityPolicy} from './store-manifest.mjs';
const valid=`E: manifest (line=1)
  E: uses-permission
    A: android:name(0x01010003)="android.permission.INTERNET"
  E: application
    A: android:label(0x01010001)="NetHack 3D"
    A: android:description(0x01010020)=@0x7f120123
    A: android:debuggable(0x0101000f)=(type 0x12)0x0
    A: android:allowBackup(0x01010280)=(type 0x12)0x0
    A: android:fullBackupContent(0x010104eb)=(type 0x12)0x0
    A: android:usesCleartextTraffic(0x010104ec)=(type 0x12)0x0
    A: android:networkSecurityConfig(0x01010527)=@0x7f150001
    E: activity
      E: intent-filter
        E: action
          A: android:name(0x01010003)="android.intent.action.MAIN"
        E: category
          A: android:name(0x01010003)="com.oculus.intent.category.VR"
`;
test('accepts a non-debuggable VR release without sensitive browser permissions',()=>assert.doesNotThrow(()=>assertStoreManifest(valid)));
for(const permission of excludedStorePermissions) for(const tag of ['uses-permission','uses-permission-sdk-23']) test('rejects '+tag+' '+permission,()=>assert.throws(()=>assertStoreManifest(valid.replace('android.permission.INTERNET',permission).replace('E: uses-permission','E: '+tag)),/Unsupported store permission/));
test('rejects debuggable, wrong name and detached VR category',()=>{
 assert.throws(()=>assertStoreManifest(valid.replace('android:debuggable(0x0101000f)=(type 0x12)0x0','android:debuggable(0x0101000f)=(type 0x12)0xffffffff')),/debuggable/);
 assert.throws(()=>assertStoreManifest(valid.replace('NetHack 3D','Wolvic')),/app name/);
 assert.throws(()=>assertStoreManifest(valid.replace('        E: category','      E: intent-filter\n        E: category')),/MAIN\/VR/);
});
for (const attribute of ['allowBackup','fullBackupContent','usesCleartextTraffic']) test('requires explicit false for '+attribute,()=>{
 const line=valid.split('\n').find(line=>line.includes('android:'+attribute+'('));
 assert.throws(()=>assertStoreManifest(valid.replace(line,'')),new RegExp(attribute));
 assert.throws(()=>assertStoreManifest(valid.replace(line,line.replace('(type 0x12)0x0','(type 0x12)0xffffffff'))),new RegExp(attribute));
});
test('requires network policy',()=>assert.throws(()=>assertStoreManifest(valid.replace(/^.*android:networkSecurityConfig.*\n/m,'')),/network security/));
test('patch preserves game activity and local properties and is repeatable',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'nh3d-store-test-'));
 try {
  const put=(file,text)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),text);};
  const unwanted=excludedStorePermissions.map(name=>`<uses-permission android:name="${name}"/><uses-permission-sdk-23 android:maxSdkVersion="32" android:name='${name}' />`).join('\n');
  put('app/src/main/AndroidManifest.xml',`<manifest>${unwanted}<uses-permission android:name="android.permission.INTERNET"/><application android:allowBackup="true" android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/old" android:theme="@style/Nh3d.Game"/></manifest>`);
  put('app/src/oculusvrArmDebug/AndroidManifest.xml',`<manifest>${unwanted}<uses-feature android:name="oculus.software.eye_tracking" android:required="false" /><application><activity android:name=".VRBrowserActivity"><intent-filter><category android:name="com.oculus.intent.category.VR" android:value="vr_only"/></intent-filter></activity></application></manifest>`);
  mkdirSync(path.join(root,'app/src/oculusvrArmRelease'),{recursive:true});put('app/build.gradle','android {}');put('user.properties','customSetting=keep\nuseDebugSigningOnRelease=true\n');
  patchStoreRelease(root);
  const files=['app/src/main/AndroidManifest.xml','app/src/oculusvrArmDebug/AndroidManifest.xml','app/src/oculusvrArmRelease/AndroidManifest.xml','app/build.gradle','user.properties','app/src/main/res/xml/nh3d_network_security_config.xml'];
  const before=files.map(file=>readFileSync(path.join(root,file),'utf8'));patchStoreRelease(root);
  assert.deepEqual(files.map(file=>readFileSync(path.join(root,file),'utf8')),before);
  assert.match(before[0],/Nh3d.Game/);assert.doesNotMatch(before[0],/REQUEST_INSTALL_PACKAGES/);
  assert.doesNotMatch(before[2],/android:debuggable/);assert.match(readFileSync(path.join(root,"app/nh3d-release.gradle"),"utf8"),/debuggable false/);
  assert.match(before[0],/android.permission.INTERNET/);
  for(const permission of excludedStorePermissions) {
   assert.ok(!before[0].includes(permission));
   for(const overlay of before.slice(1,3)) for(const tag of ['uses-permission','uses-permission-sdk-23']) assert.ok(overlay.includes(`<${tag} android:name="${permission}" tools:node="remove" />`));
  }
  assert.match(before[2],/eye_tracking" tools:node="remove"/);
  assert.doesNotMatch(before[2],/eye_tracking" android:required/);
  assert.match(before[2],/xmlns:tools="http:\/\/schemas.android.com\/tools"/);
  for (const manifest of before.slice(0,3)) {
   assert.match(manifest,/android:allowBackup="false"/);
   assert.match(manifest,/android:fullBackupContent="false"/);
   assert.match(manifest,/android:usesCleartextTraffic="false"/);
   assert.match(manifest,/android:networkSecurityConfig="@xml\/nh3d_network_security_config"/);
  }
  assert.match(before[2],/tools:replace="android:allowBackup,android:fullBackupContent,android:usesCleartextTraffic,android:networkSecurityConfig"/);
  assert.match(before[5],/<base-config cleartextTrafficPermitted="false"/);
  assert.deepEqual([...before[5].matchAll(/<domain\b[^>]*>([^<]+)<\/domain>/g)].map(m=>m[1]),['127.0.0.1']);
  assert.match(before[2],/android.intent.action.MAIN/);assert.match(before[4],/customSetting=keep/);assert.match(before[4],/useDebugSigningOnRelease=false/);
 } finally {assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.match(path.basename(root),/^nh3d-store-test-/);rmSync(root,{recursive:true,force:true});}
});

import {geckoConfigResourcePath} from './store-manifest.mjs';
test('resolves Gecko configuration after release resource path shortening',()=>{
 for(const file of ['res/raw/fxr_config.yaml','res/U6.yaml']) assert.equal(geckoConfigResourcePath(`  resource 0x7f100006 com.nethack3d.quest.vr:raw/fxr_config: t=0x03\n    (string8) "${file}"`),file);
 assert.throws(()=>geckoConfigResourcePath('spec resource raw/fxr_config'),/Cannot resolve/);
});

const policyTree=`E: network-security-config
  E: base-config
    A: cleartextTrafficPermitted=(type 0x12)0x0
  E: domain-config
    A: cleartextTrafficPermitted=(type 0x12)0xffffffff
    E: domain
      A: includeSubdomains=(type 0x12)0x0
      C: "127.0.0.1"
`;
test('packaged policy permits only exact loopback HTTP',()=>{
 assert.doesNotThrow(()=>assertNetworkSecurityPolicy(policyTree));
 assert.doesNotThrow(()=>assertNetworkSecurityPolicy(policyTree.replace('C:','T:')));
 for(const tree of [policyTree.replace('127.0.0.1','example.com'),policyTree.replace('cleartextTrafficPermitted=(type 0x12)0x0','cleartextTrafficPermitted=(type 0x12)0xffffffff'),policyTree.replace('includeSubdomains=(type 0x12)0x0','includeSubdomains=(type 0x12)0xffffffff'),policyTree+'  E: domain-config\n',policyTree.replace('    E: domain','  E: domain')]) assert.throws(()=>assertNetworkSecurityPolicy(tree),/deny cleartext/);
});
test('resolves optimized network policy and validates its manifest reference',()=>{
 const policy=networkSecurityResource('  resource 0x7f150001 com.nethack3d.quest.vr:xml/nh3d_network_security_config: t=0x03\n    (string8) "res/AB.xml"');
 assert.equal(policy.path,'res/AB.xml');
 assert.equal(assertStoreManifest(valid),policy.reference);
 assert.throws(()=>networkSecurityResource(''),/network security/);
});
