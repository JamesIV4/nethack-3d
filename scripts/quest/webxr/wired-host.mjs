import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createInputController, validateInput, readJson } from "../wired/protocol.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const origin = "http://127.0.0.1:5177";
const token = randomBytes(32).toString("base64url");
const smoke = process.argv.includes("--smoke") || process.argv.includes("--menu-smoke");
const profile = path.join(root, ".wired-dev", smoke ? "three-webxr-smoke" : "three-webxr");
const chrome = process.env.QUEST_CHROME_PATH ?? [
  path.join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
  path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft/Edge/Application/msedge.exe"),
  path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
].find(existsSync);
if (!chrome) throw new Error("Install Chrome/Edge or set QUEST_CHROME_PATH to its executable.");
if (process.argv.includes("--check")) {
  console.log("WebXR browser: " + chrome);
  console.log("Run npm.cmd run quest:webxr:wired with Quest Link active.");
  process.exit(0);
}
mkdirSync(profile, { recursive: true });
process.chdir(root);
process.env.VITE_DEPLOY_TARGET = "quest";
delete process.env.BUILD_TARGET;
const browser = spawn(chrome, [
  "--remote-debugging-pipe", "--user-data-dir=" + profile, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--window-size=1620,1100", ...(smoke ? ["--headless=new"] : []), "about:blank",
], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });
browser.stderr.resume();
let nextId = 0, incoming = Buffer.alloc(0), sessionId, closed = false, vite;
const pending = new Map();
const events = new Map();
function cdp(method, params = {}, target = sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    browser.stdio[3].write(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }) + "\0");
  });
}
browser.stdio[4].on("data", (chunk) => {
  incoming = Buffer.concat([incoming, chunk]);
  let boundary;
  while ((boundary = incoming.indexOf(0)) >= 0) {
    const line = incoming.subarray(0, boundary).toString("utf8");
    incoming = incoming.subarray(boundary + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.method) events.get(message.method)?.(message.params);
    const request = pending.get(message.id);
    if (!request) continue;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result ?? {});
  }
});
browser.on("error", (error) => { console.error(error.message); void shutdown(); });
browser.on("exit", () => { void shutdown(); });
let inputQueue = Promise.resolve(), capture = null, viewportQueue = Promise.resolve();
let logicalViewport = { width: 1920, height: 1080 };
const input = createInputController((method, params) => cdp(method, params));
function reply(response, code, data) {
  response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}
async function api(request, response, next) {
  if (request.headers.host !== "127.0.0.1:5177" || (request.headers.origin && request.headers.origin !== origin)) {
    reply(response, 403, { error: "Only this local development origin is allowed." }); return;
  }
  const url = new URL(request.url, origin);
  if (!url.pathname.startsWith("/__xr/")) { next(); return; }
  if (request.headers.authorization !== "Bearer " + token) { reply(response, 401, { error: "Invalid development token." }); return; }
  try {
    if (request.method === "GET" && url.pathname === "/__xr/frame") {
      if (!sessionId) { reply(response, 503, { error: "Browser starting." }); return; }
      await viewportQueue;
      // Capture only our dedicated game tab's DOM surface. Three.js renders its world directly to WebXR.
      capture ??= cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true })
        .finally(() => { capture = null; });
      const result = await capture;
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
      response.end(Buffer.from(result.data, "base64")); return;
    }
    if (request.method === "POST" && url.pathname === "/__xr/input") {
      const data = validateInput(await readJson(request));
      inputQueue = inputQueue.catch(() => {}).then(() => input.dispatch(data));
      await inputQueue; reply(response, 200, { ok: true }); return;
    }
    if (request.method === "POST" && url.pathname === "/__xr/release") {
      inputQueue = inputQueue.catch(() => {}).then(() => input.release());
      await inputQueue; reply(response, 200, { ok: true }); return;
    }
    reply(response, 404, { error: "Unknown development endpoint." });
  } catch (error) { reply(response, 400, { error: error.message }); }
}
async function shutdown() {
  if (closed) return;
  closed = true;
  for (const request of pending.values()) request.reject(new Error("Development browser closed."));
  pending.clear();
  await vite?.close();
  if (browser.exitCode === null) browser.kill();
}
process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
const { createServer } = await import("vite");
vite = await createServer({
  root, plugins: [{ name: "direct-webxr-ui", configureServer(server) { server.middlewares.use(api); } }],
  server: { host: "127.0.0.1", port: 5177, strictPort: true, cors: false, open: false, allowedHosts: ["127.0.0.1"], watch: { ignored: ["**/.wired-dev/**", "**/quest/runtime/**"] }, fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.wired-dev/**", "**/quest/runtime/**"] } },
});
await vite.listen();
const target = await cdp("Target.createTarget", { url: "about:blank" }, null);
sessionId = (await cdp("Target.attachToTarget", { targetId: target.targetId, flatten: true }, null)).sessionId;
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { ...logicalViewport, deviceScaleFactor: 1, mobile: false });
await cdp("Runtime.addBinding", { name: "nh3dViewportMode" });
let immersiveViewport = false;
events.set("Runtime.bindingCalled", ({ name, payload }) => {
  if (name !== "nh3dViewportMode" || (payload !== "flat" && payload !== "immersive")) return;
  const immersive = payload === "immersive";
  if (immersive === immersiveViewport) return;
  immersiveViewport = immersive;
  const dimensions = immersive ? { width: 2560, height: 1440 } : { width: 1920, height: 1080 };
  viewportQueue = viewportQueue.then(async () => {
    await cdp("Emulation.setDeviceMetricsOverride", { ...dimensions, deviceScaleFactor: 1, mobile: false });
    logicalViewport = dimensions;
  });
});
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `
  document.addEventListener('DOMContentLoaded', () => {
    const update = () => nh3dViewportMode(document.documentElement.classList.contains('nh3d-webxr-active') ? 'immersive' : 'flat');
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    update();
  }, { once: true });
` });
await cdp("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
const loaded = new Promise((resolve) => events.set("Page.loadEventFired", resolve));
await cdp("Page.navigate", { url: origin + "/?xrHost=wired#token=" + token });
if (smoke) {
  // A bounded smoke-test deadline prevents a failed page import from hanging the test process.
  const deadline = setTimeout(() => { console.error("Wired browser smoke check timed out."); process.exitCode = 1; void shutdown(); }, 30000);
  try {
    await loaded;
    const result = await cdp("Runtime.evaluate", {
      expression: "new Promise(resolve => { const ready = () => { if (document.querySelector('.nh3d-dialog.is-visible button')?.getClientRects().length) { resolve({title:document.title, roots:document.getElementById('root').children.length}); return true; } return false; }; if (!ready()) { const observer = new MutationObserver(() => { if (ready()) observer.disconnect(); }); observer.observe(document.documentElement, {childList:true,subtree:true,attributes:true}); } })",
      awaitPromise: true, returnByValue: true,
    });
    if (!result.result?.value?.roots) throw new Error("React game UI did not mount.");
    if (process.argv.includes("--menu-smoke")) {
      const { menuSmoke } = await import("./menu-smoke.mjs");
      await menuSmoke(cdp);
    }
    await cdp("Runtime.evaluate", {
      expression: "Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity).map(a => a.finished.catch(() => {}))).then(() => document.fonts.ready).then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
      awaitPromise: true,
    });
    const unauthorized = await fetch(origin + "/__xr/frame");
    if (unauthorized.status !== 401) throw new Error("Capture endpoint accepted an unauthenticated request.");
    const response = await fetch(origin + "/__xr/frame", { headers: { Authorization: "Bearer " + token } });
    if (!response.ok) throw new Error("Live HTML capture failed.");
    const png = Buffer.from(await response.arrayBuffer());
    if (png.readUInt32BE(16) !== logicalViewport.width || png.readUInt32BE(20) !== logicalViewport.height) throw new Error("Unexpected UI capture size.");
    writeFileSync(path.join(root, ".wired-dev/webxr-smoke.png"), png);
    const preview = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 65, fromSurface: true,
      clip: { x: 0, y: 0, ...logicalViewport, scale: 0.5 } });
    writeFileSync(path.join(root, ".wired-dev/webxr-smoke-preview.jpg"), Buffer.from(preview.data, "base64"));
    console.log(`Wired smoke passed: React UI mounted, authenticated live capture is ${logicalViewport.width}x${logicalViewport.height}, unauthorized capture rejected.`);
    console.log("Headless smoke does not validate headset stereo, tracking, or performance.");
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { clearTimeout(deadline); await shutdown(); }
} else {
console.log("Direct Three.js WebXR development is running in its own browser/profile.");
console.log("Start/resume a game, then use Enter VR or Options > Display.");
console.log("The headset must be connected through Quest Link with an active OpenXR runtime.");
console.log("Only the HTML UI is captured; the game world is rendered directly by Three.js.");
console.log("Close the development browser or press Ctrl+C to stop.");

}
