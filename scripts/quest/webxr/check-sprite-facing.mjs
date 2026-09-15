import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const root=(await import('node:url')).fileURLToPath(new URL('../../../',import.meta.url));
const fixture=await build({stdin:{resolveDir:root,contents:(await import('node:fs')).readFileSync(path.join(root,'scripts/quest/webxr/fixtures/sprite-facing.js'),'utf8')},bundle:true,format:'iife',write:false,logLevel:'silent'});
const profile=path.join(root,'.wired-dev/interaction-check');mkdirSync(profile,{recursive:true});
const chrome=spawn(process.env.QUEST_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});
let serial=0,buffer=Buffer.alloc(0);const pending=new Map();
function cdp(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});}
chrome.stdio[4].on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);let n;while((n=buffer.indexOf(0))>=0){const line=buffer.subarray(0,n);buffer=buffer.subarray(n+1);if(!line.length)continue;const reply=JSON.parse(line.toString());const req=pending.get(reply.id);if(req){pending.delete(reply.id);reply.error?req.reject(new Error(reply.error.message)):req.resolve(reply.result);}}});
const deadline=setTimeout(()=>{console.error('GPU probe timeout');chrome.kill();process.exitCode=1;},30000);
try{
const {targetId}=await cdp('Target.createTarget',{url:'about:blank'});
const {sessionId}=await cdp('Target.attachToTarget',{targetId,flatten:true});
await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
const result=await cdp('Runtime.evaluate',{expression:"Object.defineProperty(window, 'localStorage', {value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});"+fixture.outputFiles[0].text+'\nwindow.probePromise',returnByValue:true,awaitPromise:true},sessionId);
if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
console.log(JSON.stringify(result.result.value,null,2));
}finally{clearTimeout(deadline);chrome.kill();}