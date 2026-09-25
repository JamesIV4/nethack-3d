// Measures real scene-update code in isolated headless Chrome, without APK/device interaction.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const root=(await import('node:url')).fileURLToPath(new URL('../../',import.meta.url));
const scenario=process.argv[2]??'nh5-movement';
if(!['corridor-movement','nh5-movement','nh5-frame-preparation'].includes(scenario))throw new Error('Choose corridor-movement, nh5-movement, or nh5-frame-preparation.');
const fixture=await build({stdin:{resolveDir:root,contents:(await import('node:fs')).readFileSync(path.join(root,'scripts/performance/fixtures/'+scenario+'.js'),'utf8')},bundle:true,format:'iife',write:false,logLevel:'silent',define:{'import.meta.env':'{}'},loader:{'.c':'text'}});
const profile=path.join(root,'.wired-dev/movement-benchmark-'+scenario);mkdirSync(profile,{recursive:true});
const chrome=spawn(process.env.QUEST_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});
let serial=0,buffer=Buffer.alloc(0);const pending=new Map();
function cdp(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});}
chrome.stdio[4].on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);let n;while((n=buffer.indexOf(0))>=0){const line=buffer.subarray(0,n);buffer=buffer.subarray(n+1);if(!line.length)continue;const reply=JSON.parse(line.toString());const req=pending.get(reply.id);if(req){pending.delete(reply.id);reply.error?req.reject(new Error(reply.error.message)):req.resolve(reply.result);}}});
const deadline=setTimeout(()=>{console.error('Movement CPU benchmark timed out');chrome.kill();process.exitCode=1;},60000);
try{
const {targetId}=await cdp('Target.createTarget',{url:'about:blank'});
const {sessionId}=await cdp('Target.attachToTarget',{targetId,flatten:true});
await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
const result=await cdp('Runtime.evaluate',{expression:"Object.defineProperty(window, 'localStorage', {value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});"+fixture.outputFiles[0].text+'\nwindow.runMovementWork()',returnByValue:true,awaitPromise:true},sessionId);
if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
const report=result.result.value;
if(report.sceneGeometry?.length) report.sceneGeometrySha256=createHash('sha256').update(JSON.stringify(report.sceneGeometry)).digest('hex');
delete report.sceneGeometry;
mkdirSync(path.join(root,'quest/build/diagnostics/perfetto'),{recursive:true});
writeFileSync(path.join(root,'quest/build/diagnostics/perfetto/'+scenario+'.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
}finally{clearTimeout(deadline);chrome.kill();}