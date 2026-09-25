import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Read-only capture: no log clearing, refresh overrides, app restarts or input.
const seconds = Number(process.argv[2] ?? 30);
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 300) throw new Error("Duration must be 1..300 seconds.");
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ??
  (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android/Sdk") : "");
const adb = process.env.ADB ?? (sdk ? path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb") : "adb");
const target = process.env.QUEST_SERIAL ? ["-s", process.env.QUEST_SERIAL] : [];
const run = (...args) => execFileSync(adb, [...target, ...args], { encoding: "utf8", windowsHide: true });
const pid = run("shell", "pidof", "com.nethack3d.quest.vr").trim().split(/\s+/)[0];
if (!/^\d+$/.test(pid)) throw new Error("The Quest app is not running.");
const output = path.resolve(process.argv[3] ?? `quest/build/diagnostics/performance-${Date.now()}`);
mkdirSync(path.dirname(output), { recursive: true });
const packageInfo = run("shell", "dumpsys", "package", "com.nethack3d.quest.vr")
  .split(/\r?\n/).filter(line => /versionCode=|versionName=/.test(line)).map(line => line.trim());
let raw = "", errors = "";
const capture = spawn(adb, [...target, "logcat", "-v", "threadtime", "-T", "1", `--pid=${pid}`, "VrApi:I", "*:S"], { windowsHide: true });
capture.stdout.on("data", chunk => { raw += chunk; });
capture.stderr.on("data", chunk => { errors += chunk; });
console.log(`Capturing ${seconds}s from app PID ${pid}. Keep the headset awake; output: ${output}`);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => capture.kill(), seconds * 1000);
  capture.on("error", error => { clearTimeout(timer); reject(error); });
  capture.on("close", code => { clearTimeout(timer); code && code !== 1 ? reject(new Error(errors || `adb exited ${code}`)) : resolve(); });
});
writeFileSync(output + ".log", raw);
const samples = raw.split(/\r?\n/).filter(line => line.includes("FPS="));
const stats = values => {
  values.sort((a,b) => a-b);
  return { count: values.length, min: values[0] ?? null, mean: values.length ? values.reduce((a,b)=>a+b,0)/values.length : null,
    p95: values[Math.min(values.length-1, Math.floor(values.length*.95))] ?? null, max: values.at(-1) ?? null };
};
const read = pattern => stats(samples.flatMap(line => { const match=line.match(pattern); return match ? [Number(match[1])] : []; }));
const report = {
  capturedAt: new Date().toISOString(), seconds, pid, packageInfo,
  warning: "Native VrApi telemetry, not WebXR delivered-frame timing. Reprojection may contribute; use profile-frame.js and MQDH together. Activity was not controlled by this script.",
  nativeFps: read(/FPS=(\d+)\//), refreshHz: read(/FPS=\d+\/(\d+)/),
  appMs: read(/,App=([\d.]+)ms/), cpuAndGpuMs: read(/,CPU&GPU=([\d.]+)ms/),
  stalePerSample: read(/,Stale=(\d+)/), gpuUtilization: read(/,GPU%=([\d.]+)/),
  firstSample: samples[0] ?? null, lastSample: samples.at(-1) ?? null,
};
writeFileSync(output + ".json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!samples.length) process.exitCode = 1;
