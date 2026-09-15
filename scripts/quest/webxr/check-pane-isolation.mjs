import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const root=process.cwd();
const css=(await import('sass')).compile('src/styles/app.scss',{logger:{warn(){},debug(){}}}).css+(await import('node:fs')).readFileSync('src/quest/webxr/webxr.css','utf8');
const fixture=await build({stdin:{resolveDir:root,contents:(await import('node:fs')).readFileSync('scripts/quest/webxr/fixtures/pane-isolation.js','utf8')},bundle:true,loader:{'.css':'empty'},format:'iife',write:false,logLevel:'silent'});
const profile=path.join(root,'.wired-dev/interaction-check');mkdirSync(profile,{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});
let serial=0,buffer=Buffer.alloc(0);const pending=new Map();
function cdp(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});}
chrome.stdio[4].on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);let n;while((n=buffer.indexOf(0))>=0){const line=buffer.subarray(0,n);buffer=buffer.subarray(n+1);if(!line.length)continue;const reply=JSON.parse(line.toString());const req=pending.get(reply.id);if(req){pending.delete(reply.id);reply.error?req.reject(new Error(reply.error.message)):req.resolve(reply.result);}}});
const deadline=setTimeout(()=>{console.error('GPU probe timeout');chrome.kill();process.exitCode=1;},30000);
try{
const {targetId}=await cdp('Target.createTarget',{url:'about:blank?xrHost=native'});
const {sessionId}=await cdp('Target.attachToTarget',{targetId,flatten:true});
for (const [width,height] of [[1600,1000],[1280,800],[800,600]]) {
await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
const result=await cdp('Runtime.evaluate',{expression:"Object.defineProperty(window, 'localStorage', {configurable:true,value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});"+'window.__uiStyles='+JSON.stringify(css)+';'+fixture.outputFiles[0].text+'\nwindow.probePromise',returnByValue:true,awaitPromise:true},sessionId);
if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
console.log(JSON.stringify({viewport:[width,height],...result.result.value},null,2));
}
}finally{clearTimeout(deadline);chrome.kill();}