import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { questAppVersion, reserveQuestVersion } from './app-version.mjs';

function fixture(t) {
  const directory=mkdtempSync(path.join(tmpdir(),'nh3d-version-'));
  t.after(()=>{assert.equal(path.dirname(directory),path.resolve(tmpdir()));assert.match(path.basename(directory),/^nh3d-version-/);rmSync(directory,{recursive:true,force:true});});
  return path.join(directory,'counter.json');
}
test('increments repeated release builds while preserving display version',t=>{
  const stateFile=fixture(t);
  const options={stateFile,override:undefined};
  assert.deepEqual(reserveQuestVersion('1.6.0',options),{name:'1.6.0',code:1006001});
  assert.equal(reserveQuestVersion('1.6.0',options).code,1006002);
  assert.equal(questAppVersion(undefined,stateFile).code,1006002);
  assert.equal(reserveQuestVersion('1.6.1',options).code,1006003);
  assert.equal(reserveQuestVersion('1.7.0',options).code,1007001);
  assert.equal(reserveQuestVersion('1.6.0',options).code,1007002);
  assert.equal(existsSync(stateFile+'.lock'),false);
});
test('explicit version code seeds a new checkout and must increase',t=>{
  const stateFile=fixture(t);
  assert.equal(reserveQuestVersion('1.6.0',{stateFile,override:'1006050'}).code,1006050);
  for(const override of ['1006050','0','bad','2100000001']) assert.throws(()=>reserveQuestVersion('1.6.0',{stateFile,override}),/versionCode/);
  assert.equal(JSON.parse(readFileSync(stateFile)).code,1006050);
  assert.equal(reserveQuestVersion('1.6.0',{stateFile}).code,1006051);
});
test('corrupt state or simultaneous reservation cannot reset the counter',t=>{
  const stateFile=fixture(t);
  writeFileSync(stateFile,JSON.stringify({schema:1,code:-1}));
  assert.throws(()=>reserveQuestVersion('1.6.0',{stateFile}),/Invalid Quest/);
  writeFileSync(stateFile+'.lock','');
  assert.throws(()=>reserveQuestVersion('1.6.0',{stateFile}),/EEXIST/);
});
test('reading versions never reserves codes and semantic inputs stay bounded',t=>{
  const stateFile=fixture(t);
  questAppVersion(undefined,stateFile);
  assert.equal(existsSync(stateFile),false);
  assert.deepEqual(questAppVersion('1.6.0'),{name:'1.6.0',code:1006000});
  for(const version of ['bad','0.0.0','1.1000.0','2101.0.0']) assert.throws(()=>questAppVersion(version));
});
