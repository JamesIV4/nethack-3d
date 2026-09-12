import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchRuntime, runtimePaths, WOLVIC_REVISION } from "./runtime-patch.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const checkout = path.join(root, "quest/runtime/wolvic");
const chromium = process.env.QUEST_CHROMIUM_DIR;
const platform = process.env.QUEST_OVR_PLATFORM_SDK;
const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ??
  (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android/Sdk"));
const requiredChromium = ["Content.aar", "ChromiumUi.aar", "snapshot_blob_64.bin", "icudtl.dat", "wolvic.pak"];
function prerequisites() {
  const missing = [];
  for (const name of requiredChromium) if (!chromium || !existsSync(path.join(chromium, name))) missing.push("QUEST_CHROMIUM_DIR/" + name);
  if (!chromium || !existsSync(path.join(chromium, "nh3d-runtime.json"))) missing.push("QUEST_CHROMIUM_DIR/nh3d-runtime.json (transparency-patched build)");
  else {
    const metadata = JSON.parse(readFileSync(path.join(chromium, "nh3d-runtime.json"), "utf8"));
    if (metadata.wolvic !== WOLVIC_REVISION || metadata.chromium !== "c45f7339cd6d087c9a9cb9130d2b42555a87f6cb" || metadata.alphaSurface !== true) {
      missing.push("matching transparency-patched Chromium build metadata");
    }
  }
  if (!platform || !existsSync(path.join(platform, "Include")) ||
      !existsSync(path.join(platform, "Android/libs/arm64-v8a/libovrplatformloader.so"))) missing.push("QUEST_OVR_PLATFORM_SDK (Include and Android/libs/arm64-v8a)");
  if (!sdk || !existsSync(sdk)) missing.push("Android SDK (ANDROID_SDK_ROOT)");
  return missing;
}
if (process.argv.includes("--verify-upstream")) {
  const sources = {};
  for (const [key, file] of Object.entries(runtimePaths)) {
    const response = await fetch("https://raw.githubusercontent.com/Igalia/wolvic/" + WOLVIC_REVISION + "/" + file);
    if (!response.ok) throw new Error("Cannot read pinned upstream source: " + file);
    sources[key] = await response.text();
  }
  const patched = patchRuntime(sources);
  for (const [key, file] of Object.entries(runtimePaths)) {
    if (patched[key] === sources[key]) throw new Error("Patch did not change " + file);
    console.log("Verified patch: " + file);
  }
  console.log("Pinned host patch applies. This does not compile or validate XR rendering.");
  process.exit(0);
}
const missing = prerequisites();
if (missing.length) {
  console.error("The standalone WebXR proof needs a WebXR-enabled browser runtime.");
  console.error("Missing prerequisites:\n- " + missing.join("\n- "));
  console.error("See docs/quest-webxr-runtime.md. Stock Android WebView/GeckoView cannot replace these artifacts.");
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log("Runtime prerequisite files found. JDK/NDK and native compilation remain build-time checks.");
  process.exit(0);
}
function git(...args) { return execFileSync("git", args, { cwd: root, stdio: "pipe", encoding: "utf8", windowsHide: true }); }
if (!existsSync(checkout)) {
  mkdirSync(path.dirname(checkout), { recursive: true });
  execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", "https://github.com/Igalia/wolvic.git", checkout], { stdio: "inherit", windowsHide: true });
  git("-C", checkout, "checkout", "--detach", WOLVIC_REVISION);
}
if (git("-C", checkout, "rev-parse", "HEAD").trim() !== WOLVIC_REVISION) throw new Error("Runtime checkout revision differs; refusing to overwrite it.");
const marker = path.join(checkout, ".nh3d-host-patch.json");
if (!existsSync(marker)) {
  if (git("-C", checkout, "status", "--porcelain").trim()) throw new Error("Runtime checkout has local edits; refusing to overwrite them.");
  const sources = Object.fromEntries(Object.entries(runtimePaths).map(([key, file]) => [key, readFileSync(path.join(checkout, file), "utf8")]));
  const patched = patchRuntime(sources);
  for (const [key, file] of Object.entries(runtimePaths)) writeFileSync(path.join(checkout, file), patched[key]);
  const gradle = path.join(checkout, "app/build.gradle");
  let config = readFileSync(gradle, "utf8")
    .replace('applicationId "com.igalia.wolvic"', 'applicationId "com.nethack3d.quest.webxrproof"')
    .replace('resValue "string", "app_name", "Wolvic Chromium"', 'resValue "string", "app_name", "NetHack 3D WebXR Proof"');
  const assetRoot = path.join(root, "quest/app/build/generated/gameAssets").replaceAll("\\", "/").replaceAll("'", "\\'");
  config += `\n// Dedicated NetHack WebXR proof host.\nandroid.defaultConfig { buildConfigField "boolean", "NH3D_GAME_HOST", "true" }\nandroid.sourceSets.main.assets.srcDir('${assetRoot}')\n`;
  writeFileSync(gradle, config);
  writeFileSync(marker, JSON.stringify({ revision: WOLVIC_REVISION, version: 1 }) + "\n");
} else if (JSON.parse(readFileSync(marker, "utf8")).revision !== WOLVIC_REVISION) {
  throw new Error("Host patch marker does not match this runtime.");
}
execFileSync("git", ["-C", checkout, "submodule", "update", "--init", "--recursive", "--depth=1"], { stdio: "inherit", windowsHide: true });
cpSync(path.join(root, "quest/webxr/host/BundledGameServer.java"),
  path.join(checkout, "app/src/common/shared/com/igalia/wolvic/BundledGameServer.java"));
const resourceDir = path.join(checkout, "app/src/chromium/assets");
mkdirSync(resourceDir, { recursive: true });
for (const name of requiredChromium.slice(2)) cpSync(path.join(chromium, name), path.join(resourceDir, name));
cpSync(platform, path.join(checkout, "third_party/OVRPlatformSDK"), { recursive: true });
const property = (value) => value.replaceAll("\\", "/").replaceAll(":", "\\:");
writeFileSync(path.join(checkout, "local.properties"), `sdk.dir=${property(sdk)}\nchromium_aar=${property(path.resolve(chromium))}\n`);
writeFileSync(path.join(checkout, "user.properties"), "useStaticVersionCode=true\nuseDebugSigningOnRelease=true\n");
console.log("Prepared the standalone WebXR host at " + checkout);
