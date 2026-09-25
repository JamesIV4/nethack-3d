import { assertStoreManifest, geckoConfigResourcePath, networkSecurityResource, assertNetworkSecurityPolicy } from "./store-manifest.mjs";
import { findAndroidSdk } from "../build-environment.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { readGeckoArtifact, PAINT_PREFERENCE } from "./gecko-artifact.mjs";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--debug")) throw new Error("Usage: publish-apk.mjs [--debug]");
const debug = args.includes("--debug"), type = debug ? "debug" : "release";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const apk = path.join(
  root,
  `quest/runtime/wolvic/app/build/outputs/apk/oculusvrArm64GeckoGeneric/${type}/Wolvic-oculusvr-arm64-gecko-generic-${type}.apk`,
);
const sdk = findAndroidSdk({
  properties: [path.join(root, "quest/runtime/wolvic/local.properties")],
});
const versions = readdirSync(path.join(sdk, "build-tools")).sort((a, b) =>
  b.localeCompare(a, undefined, { numeric: true }),
);
const aapt = path.join(
  sdk,
  "build-tools",
  versions[0],
  process.platform === "win32" ? "aapt.exe" : "aapt",
);
const details = execFileSync(aapt, ["dump", "badging", apk], {
  encoding: "utf8",
  windowsHide: true,
});
if (!details.includes("package: name='com.nethack3d.quest.vr'"))
  throw new Error("Incorrect Quest VR package identity.");
const packagedVersion = details.match(/^package: .*\bversionCode='(\d+)' versionName='([^']+)'/m);
if (!packagedVersion) throw new Error("APK package metadata is missing its version.");
const [, versionCode, versionName] = packagedVersion;
if (!details.includes("application-label:'NetHack 3D'")) throw new Error("Incorrect Quest launcher name.");
for (const permission of ["WAKE_LOCK", "FOREGROUND_SERVICE"]) {
  if (!details.includes("name='android.permission." + permission + "'"))
    throw new Error("Missing Gecko runtime permission: " + permission);
}
const resources = execFileSync(aapt, ["dump", "--values", "resources", apk], {encoding:"utf8",windowsHide:true,maxBuffer:32*1024*1024});
if (!debug) {
  const reference=assertStoreManifest(execFileSync(aapt, ["dump", "xmltree", apk, "AndroidManifest.xml"], {encoding:"utf8", windowsHide:true}));
  const policy=networkSecurityResource(resources);
  if(reference!==policy.reference) throw new Error('APK references an unexpected network security policy.');
  assertNetworkSecurityPolicy(execFileSync(aapt, ["dump", "xmltree", apk, policy.path], {encoding:"utf8",windowsHide:true}));
  const signer = path.join(sdk,"build-tools",versions[0],"lib/apksigner.jar");
  const result = execFileSync(process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME,"bin",process.platform === "win32" ? "java.exe" : "java") : "java", ["-jar",signer,"verify","--verbose","--print-certs",apk], {encoding:"utf8",windowsHide:true});
  if (/CN=Android Debug/i.test(result)) throw new Error("Store APK uses the Android debug signing certificate.");
}
const configResourcePath = geckoConfigResourcePath(resources);
const bytes = readFileSync(apk),
  names = new Set();
const inspected = unzipSync(bytes, {
  filter: (entry) => {
    names.add(entry.name);
    return entry.name.startsWith("assets/game/quest-controllers/") || [
      "assets/nh3d-gecko-runtime.json",
      "assets/vr_splash.png",
      "lib/arm64-v8a/libxul.so",
      "lib/arm64-v8a/libnative-lib.so",
      configResourcePath,
    ].includes(entry.name);
  },
});
const gecko = readGeckoArtifact(
  process.env.QUEST_GECKO_DIR ?? path.join(root, "quest/runtime/gecko"),
);
const native = Buffer.from(inspected["lib/arm64-v8a/libnative-lib.so"] ?? []);
for (const marker of [
  "NH3D resolution limit:",
  "NH3D resolution: WebXR eye",
  "NH3D HTML surface:",
]) {
  if (!native.includes(Buffer.from(marker)))
    throw new Error("APK lacks the native resolution fix: " + marker);
}
const receipt = JSON.parse(
  Buffer.from(inspected["assets/nh3d-gecko-runtime.json"] ?? []).toString(),
);
if (
  receipt.coordinate !== gecko.coordinate ||
  receipt.patchSha256 !== gecko.patchSha256 ||
  receipt.revision !== gecko.revision ||
  createHash("sha256")
    .update(inspected["lib/arm64-v8a/libxul.so"] ?? [])
    .digest("hex") !== gecko.libxulSha256 ||
  !Buffer.from(inspected["lib/arm64-v8a/libxul.so"] ?? []).includes(
    Buffer.from(PAINT_PREFERENCE),
  ) ||
  !Buffer.from(inspected["lib/arm64-v8a/libxul.so"] ?? []).includes(
    Buffer.from("dom.vr.webxr.transparent-document"),
  ) ||
  !Buffer.from(inspected["lib/arm64-v8a/libxul.so"] ?? []).includes(
    Buffer.from("dom.vr.webxr.composite-document"),
  ) ||
  !Buffer.from(inspected[configResourcePath] ?? []).includes(
    Buffer.from("dom.vr.webxr.composite-document: true"),
  ) ||
  !Buffer.from(inspected[configResourcePath] ?? []).includes(
    Buffer.from("dom.vr.webxr.transparent-document: true"),
  ) ||
  !Buffer.from(inspected[configResourcePath] ?? []).includes(
    Buffer.from(PAINT_PREFERENCE + ": true"),
  )
) {
  throw new Error("APK does not contain and enable the patched Gecko runtime.");
}
for (const required of [
  "assets/game/index.html",
  "assets/game/quest-build.json",
  "lib/arm64-v8a/libxul.so",
  "lib/arm64-v8a/libnative-lib.so",
  "lib/arm64-v8a/libopenxr_loader.so",
]) {
  if (!names.has(required))
    throw new Error("Standalone APK is missing " + required);
}
if (
  [...names].filter(
    (name) => name.startsWith("assets/game/") && name.endsWith(".wasm"),
  ).length < 3
) {
  throw new Error("The bundled NetHack runtimes are incomplete.");
}
// Offline AO must ship intact; matching only the JavaScript bundle is insufficient.
const controllerManifest = JSON.parse(readFileSync(path.join(root, "public/quest-controllers/prebaked.json"), "utf8"));
for (const asset of ["/quest-controllers/prebaked.json", "/quest-controllers/meta-quest-touch-plus/left.glb", "/quest-controllers/meta-quest-touch-plus/right.glb", ...Object.values(controllerManifest.runtime)]) {
  if (!Buffer.from(inspected["assets/game" + asset] ?? []).equals(readFileSync(path.join(root, "public", asset)))) throw new Error("Missing or stale prebaked controller asset: " + asset);
}
const output = path.join(
  root,
  "quest/build/outputs/apk/nethack3d-vr.apk",
);
if (!Buffer.from(inspected["assets/vr_splash.png"] ?? []).equals(readFileSync(path.join(root, "public/NetHack3D-splash.png")))) {
  throw new Error("Quest launcher splash does not match NetHack3D-splash.png.");
}
mkdirSync(path.dirname(output), { recursive: true });
copyFileSync(apk, output);
// Keep the stable sideloading path while also producing a desktop-style release artifact.
copyFileSync(apk, path.join(path.dirname(output), "nethack3d-webxr.apk"));
const versionedOutput = path.join(root, "release", `NetHack 3D ${versionName} Quest${debug ? " Debug" : ""}.apk`);
mkdirSync(path.dirname(versionedOutput), { recursive: true });
copyFileSync(apk, versionedOutput);
console.log("Verified standalone APK: " + versionedOutput);
console.log(`Version: ${versionName}; versionCode: ${versionCode}`);
console.log("Latest APK: " + output);
console.log("SHA256: " + createHash("sha256").update(bytes).digest("hex"));
console.log("APK binary modified: " + statSync(apk).mtime.toLocaleString());
console.log("Verified/copied at: " + new Date().toLocaleString());
console.log("Verification does not increment versions; signed release builds reserve a new versionCode.");
