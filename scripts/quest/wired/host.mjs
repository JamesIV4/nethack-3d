import { app, BrowserWindow } from "electron";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PANEL_WIDTH,
  PANEL_HEIGHT,
  PANEL_FRAME_RATE,
  WIRED_ORIGIN,
  SOURCE_PAGES,
  createInputController,
  isAuthorized,
  isLocalRequest,
  isSourceNavigation,
  readJson,
  validateNavigation,
  validateInput,
} from "./protocol.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dataPath = path.join(root, ".wired-dev");
mkdirSync(dataPath, { recursive: true });
app.setPath("userData", dataPath);
app.setPath("sessionData", dataPath);
app.commandLine.appendSwitch("force-device-scale-factor", "1");
process.chdir(root);
process.env.VITE_DEPLOY_TARGET = "quest";
// Keep this development renderer independent of desktop release configuration.
delete process.env.BUILD_TARGET;

const token = randomBytes(32).toString("base64url");
const state = { width: PANEL_WIDTH, height: PANEL_HEIGHT, frameId: 0, page: "probe", ready: false };
let frame = null;
let source = null;
let input = null;
let vite = null;
let shuttingDown = false;
let queue = Promise.resolve();
let queuedActions = 0;

function enqueue(action) {
  if (queuedActions >= 100) throw new Error("Input queue is full. Wait for the renderer.");
  queuedActions += 1;
  const next = queue.then(action);
  queue = next.catch(() => {}).finally(() => { queuedActions -= 1; });
  return next;
}

function reply(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function navigate(page) {
  await input.release();
  state.ready = false;
  state.page = page;
  delete state.error;
  frame = null;
  await source.loadURL(`${WIRED_ORIGIN}${SOURCE_PAGES[page]}`);
}

async function api(request, response, next) {
  // Apply before Vite, including its asset routes, to reject DNS rebinding and
  // foreign web origins. The separate token protects source pixels and input.
  if (!isLocalRequest(request.headers)) {
    reply(response, 403, { error: "Use the exact local viewer URL printed by quest:wired." });
    return;
  }
  const url = new URL(request.url, WIRED_ORIGIN);
  if (!url.pathname.startsWith("/__wired/")) {
    next();
    return;
  }
  if (!isAuthorized(request.headers, token)) {
    reply(response, 401, { error: "Missing or expired wired development token. Open the current terminal URL." });
    return;
  }
  try {
    if (request.method === "GET" && url.pathname === "/__wired/info") {
      reply(response, 200, state);
      return;
    }
    if (request.method === "GET" && url.pathname === "/__wired/frame") {
      const since = url.searchParams.get("since");
      if (since !== null && !/^\d{1,16}$/.test(since)) throw new TypeError("Invalid frame id.");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Frame-Id", String(state.frameId));
      response.setHeader("X-Content-Type-Options", "nosniff");
      if (frame === null || (since !== null && Number(since) === state.frameId)) {
        response.writeHead(204);
        response.end();
      } else {
        response.writeHead(200, { "Content-Type": "image/png", "Content-Length": frame.length });
        response.end(frame);
      }
      return;
    }
    if (request.method !== "POST") {
      reply(response, 405, { error: "Unsupported endpoint or method." });
      return;
    }
    const payload = await readJson(request);
    if (!source || source.isDestroyed() || !input) throw new Error("The HTML renderer is not ready.");
    if (url.pathname === "/__wired/input") {
      const event = validateInput(payload);
      await enqueue(() => input.dispatch(event));
    } else if (url.pathname === "/__wired/navigate") {
      const page = validateNavigation(payload);
      await enqueue(() => navigate(page));
    } else if (url.pathname === "/__wired/release") {
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length !== 0) {
        throw new TypeError("Release body must be an empty object.");
      }
      await enqueue(() => input.release());
    } else {
      reply(response, 404, { error: "Unknown wired development endpoint." });
      return;
    }
    reply(response, 200, { ok: true });
  } catch (error) {
    if (!response.headersSent && !response.destroyed) {
      reply(response, error instanceof TypeError ? 400 : 503, { error: error.message });
    }
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await enqueue(() => input?.release());
  } catch {
    // A crashed source cannot receive a final release.
  }
  if (source && !source.isDestroyed()) source.destroy();
  if (vite) await vite.close();
  app.quit();
}

app.on("before-quit", (event) => {
  if (!shuttingDown) {
    event.preventDefault();
    void shutdown();
  }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void shutdown());

async function start() {
try {
  await app.whenReady();
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    configFile: path.join(root, "vite.config.ts"),
    clearScreen: false,
    plugins: [{
      name: "quest-wired-development-host",
      enforce: "pre",
      configureServer(server) {
        server.middlewares.use((request, response, next) => { void api(request, response, next); });
      },
    }],
    server: {
      host: "127.0.0.1",
      port: 5175,
      strictPort: true,
      allowedHosts: ["127.0.0.1"],
      cors: false,
      open: false,
    },
  });
  await vite.listen();

  source = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    useContentSize: true,
    show: false,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      partition: "persist:quest-wired-source",
    },
  });
  source.webContents.setFrameRate(PANEL_FRAME_RATE);
  source.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  source.webContents.on("will-navigate", (event, url) => {
    if (!isSourceNavigation(url)) event.preventDefault();
  });
  source.webContents.on("will-redirect", (event, url) => {
    if (!isSourceNavigation(url)) event.preventDefault();
  });
  const browserSession = source.webContents.session;
  browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.on("will-download", (event) => event.preventDefault());
  browserSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const allowed = url.origin === WIRED_ORIGIN ||
      (url.protocol === "ws:" && url.host === new URL(WIRED_ORIGIN).host) ||
      ["data:", "blob:"].includes(url.protocol);
    callback({ cancel: !allowed });
  });
  source.webContents.debugger.attach("1.3");
  input = createInputController((method, params) => source.webContents.debugger.sendCommand(method, params));
  source.webContents.on("paint", (_event, _dirty, image) => {
    if (shuttingDown || image.isEmpty()) return;
    // A single cached frame gives bounded memory when the viewer is slower.
    frame = image.toPNG();
    state.frameId += 1;
  });
  source.webContents.on("did-finish-load", () => {
    state.ready = true;
    delete state.error;
    const pathname = new URL(source.webContents.getURL()).pathname;
    state.page = pathname === "/" || pathname === SOURCE_PAGES.game ? "game" : "probe";
    void source.webContents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }).catch((error) => { state.error = `Focus emulation failed: ${error.message}`; });
  });
  source.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    state.ready = false;
    state.error = `HTML renderer failed to load (${code}): ${description}`;
  });
  source.webContents.on("render-process-gone", (_event, details) => {
    state.ready = false;
    state.error = `HTML renderer stopped: ${details.reason}. Restart quest:wired.`;
    frame = null;
  });
  source.on("closed", () => {
    if (!shuttingDown) void shutdown();
  });
  console.log(`\n[quest:wired] Open this URL in Chrome or Edge on the PC connected to your headset:\n${WIRED_ORIGIN}/quest-wired.html#token=${token}\n`);
  console.log(`[quest:wired] HTML panel: ${PANEL_WIDTH}x${PANEL_HEIGHT}, up to ${PANEL_FRAME_RATE} fps. Ctrl+C stops the host.`);
  console.log(`[quest:wired] Development saves: ${dataPath}`);
  await navigate("probe");
} catch (error) {
  console.error(`[quest:wired] ${error.stack ?? error.message}`);
  process.exitCode = 1;
  await shutdown();
}
}

// Finish module evaluation before waiting for Electron readiness.
void start();
