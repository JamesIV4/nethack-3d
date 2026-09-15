import { test } from "node:test";
import assert from "node:assert/strict";
import { findAndroidSdk } from "./build-environment.mjs";
for (const [platform,home,env,expected] of [
 ["win32","C:\\Users\\Test",{LOCALAPPDATA:"C:\\Users\\Test\\AppData\\Local"},"C:\\Users\\Test\\AppData\\Local\\Android\\Sdk"],
 ["darwin","/Users/test",{},"/Users/test/Library/Android/sdk"],
 ["linux","/home/test",{},"/home/test/Android/Sdk"],
]) test(`${platform} default SDK discovery`,()=>assert.equal(findAndroidSdk({platform,home,env,exists:p=>p===expected}),expected));
test("explicit SDK overrides properties and missing explicit paths fail",()=>{
 assert.equal(findAndroidSdk({env:{ANDROID_HOME:"/custom/sdk"},exists:p=>p==="/custom/sdk"}),"/custom/sdk");
 assert.throws(()=>findAndroidSdk({env:{ANDROID_HOME:"/missing"},exists:()=>false}),/does not exist/);
});
test("local.properties decodes escaped Windows paths",()=>assert.equal(findAndroidSdk({env:{},properties:["local.properties"],exists:p=>["local.properties","C:\\Android SDK"].includes(p),read:()=>"sdk.dir=C\\:\\\\Android SDK\n"}),"C:\\Android SDK"));
