import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchAppQuit } from "./patch-app-quit.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
function cleanup(directory) {
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
  assert.match(path.basename(directory), /^nh3d-quit-test-/);
  rmSync(directory, { recursive: true, force: true });
}

test("native quit registration is scoped to the game host, runs on the UI thread and is idempotent", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "nh3d-quit-test-"));
  try {
    const file = path.join(dir, "app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "        BundledGameServer.start(getApplicationContext());\n");
    patchAppQuit(dir);
    const source = readFileSync(file, "utf8"); patchAppQuit(dir);
    assert.equal(readFileSync(file, "utf8"), source);
    assert.match(source, /if \(BuildConfig.NH3D_GAME_HOST\)/);
    assert.match(source, /runOnUiThread\(this::finishAndRemoveTask\)/);
    assert.doesNotMatch(source, /System.exit|closeWindow|closeSession/);
  } finally { cleanup(dir); }
});

test("real host HTTP handler accepts only same-origin POST quit and clears the callback on shutdown", t => {
  try { execFileSync("javac", ["-version"], { windowsHide: true, stdio: "pipe" }); }
  catch { t.skip("JDK not available"); return; }
  const dir = mkdtempSync(path.join(tmpdir(), "nh3d-quit-test-"));
  const sources = [];
  const write = (name, text) => { const file = path.join(dir, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); sources.push(file); };
  try {
    write("com/igalia/wolvic/BundledGameServer.java", readFileSync(path.join(root, "quest/webxr/host/BundledGameServer.java"), "utf8"));
    write("android/content/Context.java", "package android.content; public class Context { public Context getApplicationContext(){return this;} public android.content.res.AssetManager getAssets(){return new android.content.res.AssetManager();} }");
    write("android/content/res/AssetManager.java", "package android.content.res; public class AssetManager { public static final int ACCESS_STREAMING=2; public java.io.InputStream open(String name,int mode)throws java.io.IOException{throw new java.io.FileNotFoundException(name);} }");
    write("android/util/Log.java", "package android.util; public class Log { public static int traces=0; public static void i(String a,String b){if(a.equals(\"NH3DSprites\"))traces++;} public static void e(String a,String b,Throwable c){} public static void w(String a,String b){} }");
    write("org/json/JSONArray.java", "package org.json; public class JSONArray { private final String[] values; public JSONArray(String s){s=s.trim();if(!s.startsWith(\"[\")||!s.endsWith(\"]\"))throw new IllegalArgumentException();s=s.substring(1,s.length()-1).trim();values=s.isEmpty()?new String[0]:s.split(\",\");} public int length(){return values.length;} public double getDouble(int i){return Double.parseDouble(values[i]);} public int getInt(int i){return (int)getDouble(i);} }");
    write("QuitHarness.java", String.raw`
import com.igalia.wolvic.BundledGameServer;
import java.net.*; import java.nio.charset.StandardCharsets; import java.lang.reflect.Method; import java.util.concurrent.atomic.AtomicInteger;
public class QuitHarness {
 static String controllerHeader="";
 static String request(String method,String origin,String body)throws Exception {
  return requestPath(method,"/__xr/quit",origin,body);
 }
 static String requestPath(String method,String path,String origin,String body)throws Exception {
  Method serve=BundledGameServer.class.getDeclaredMethod("serve",android.content.res.AssetManager.class,Socket.class);serve.setAccessible(true);
  try(ServerSocket listener=new ServerSocket(0);Socket client=new Socket("127.0.0.1",listener.getLocalPort())) {
   Socket accepted=listener.accept();
   Thread worker=new Thread(()->{try {serve.invoke(null,new android.content.res.AssetManager(),accepted);}catch(Exception e){throw new RuntimeException(e);}});worker.start();
   String headers=method+" "+path+" HTTP/1.1\r\nHost: 127.0.0.1:18973\r\nOrigin: "+origin+"\r\n"+controllerHeader+"Content-Length: "+body.length()+"\r\n\r\n";
   client.getOutputStream().write((headers.replace("\\r\\n","\r\n")+body).getBytes(StandardCharsets.US_ASCII));
   client.setSoTimeout(3000);
   String response=new String(client.getInputStream().readAllBytes(),StandardCharsets.US_ASCII);worker.join();return response;
  }
 }
 static void check(boolean b){if(!b)throw new AssertionError();}
 public static void main(String[] args)throws Exception {
  AtomicInteger calls=new AtomicInteger();String origin=BundledGameServer.ORIGIN;
  check(requestPath("POST","/__xr/sprite-trace","https://example.com","{}").contains("403"));
  check(android.util.Log.traces==0);
  check(requestPath("POST","/__xr/sprite-trace",origin,"{\"event\":\"trace-ready\"}\n{\"event\":\"presentation\"}").contains("204"));
  check(android.util.Log.traces==2);
  check(requestPath("POST","/__xr/sprite-trace",origin,"x".repeat(2501)).contains("400"));
  check(android.util.Log.traces==2);
  check(!BundledGameServer.isStartupFlatReady());
  check(requestPath("POST","/__xr/startup-flat-ready","https://example.com","[]").contains("403"));
  check(!BundledGameServer.isStartupFlatReady());
  check(requestPath("POST","/__xr/startup-flat-ready",origin,"[1]").contains("400"));
  check(!BundledGameServer.isStartupFlatReady());
  check(requestPath("POST","/__xr/startup-flat-ready",origin,"[]").contains("204"));
  check(BundledGameServer.isStartupFlatReady());

  check(request("POST",origin,"[]").contains("503"));
  BundledGameServer.setQuitHandler(calls::incrementAndGet);
  check(request("POST","https://example.com","[]").contains("403"));
  check(request("GET",origin,"").contains("404"));
  check(request("POST",origin,"[1]").contains("400"));check(calls.get()==0);
  check(request("POST",origin,"[]").contains("204"));check(calls.get()==1);
  String url="/__xr/controller-model/left.glb";
  check(requestPath("HEAD",url,origin,"").contains("202 Accepted"));
  BundledGameServer.setControllerModel(0,"glTF-test".getBytes(StandardCharsets.US_ASCII),"ready:1:2");
  String head=requestPath("HEAD",url,origin,"");
  check(head.contains("200 OK")&&head.contains("Content-Length: 9")&&head.contains("ETag: \"ready:1:2\""));
  check(!head.contains("glTF-test"));
  check(requestPath("GET",url,origin,"").endsWith("glTF-test"));
  check(requestPath("GET","/__xr/controller-model/right.glb",origin,"").contains("202 Accepted"));
  String pose="[1,0,-1,0,0,1,-1,0,0,1,0,0.7,-0.65,0,0,1.6,0,0,1,1,0,0,0,0,0,1.6,0,0,1]";
  controllerHeader="X-NH3D-Controller-Opacity: 32896\r\n";
  check(requestPath("POST","/__xr/table-ui",origin,pose).contains("204"));
  String instructionPanes=pose.replace(",-0.65,0,",",-0.65,9,");
  instructionPanes=instructionPanes.substring(0,instructionPanes.length()-1);
  for(int i=0;i<9;i++)instructionPanes+=","+i+",0.2,0.2,0.8,0.8";
  instructionPanes+="]";
  check(requestPath("POST","/__xr/table-ui",origin,instructionPanes).contains("204"));
  check(BundledGameServer.getControllerOpacity()==32896);
  controllerHeader="X-NH3D-Loot-Hits: 2\r\n";
  String fpsPose=pose.replace(",0,0.7,-0.65,",",1,0.7,-0.65,");
  check(requestPath("POST","/__xr/table-ui",origin,fpsPose).contains("204"));
  check(BundledGameServer.getLootHits()==2);
  controllerHeader="X-NH3D-Loot-Hits: 4\r\n";
  check(!requestPath("POST","/__xr/table-ui",origin,fpsPose).contains("204"));
  check(BundledGameServer.getLootHits()==2);
  controllerHeader="X-NH3D-Controller-Opacity: 32896\r\n";
  check(requestPath("POST","/__xr/table-ui",origin,pose).contains("204"));
  check(BundledGameServer.getLootHits()==0);
  String buttonPose="[1,0,-1,0,0,1,-1,0,0,1,0,0.7,-0.65,0,0,1.6,0,0,1,1,2,0.45,0.82,2,0,1.6,0,0,1]";
  check(requestPath("POST","/__xr/table-ui",origin,buttonPose).contains("204"));
  check(BundledGameServer.getPointerState()[20]==2);

  BundledGameServer.resetControllerOpacity();check(BundledGameServer.getControllerOpacity()==0);
  controllerHeader="";
  BundledGameServer.stop();check(requestPath("GET",url,origin,"").contains("202 Accepted"));
  check(request("POST",origin,"[]").contains("503"));check(calls.get()==1);
  check(!BundledGameServer.isStartupFlatReady());
 }
}`);
    execFileSync("javac", ["-d", dir, ...sources], { windowsHide: true, stdio: "pipe" });
    execFileSync("java", ["-cp", dir, "QuitHarness"], { windowsHide: true, stdio: "pipe", timeout: 15000 });
  } finally { cleanup(dir); }
});
