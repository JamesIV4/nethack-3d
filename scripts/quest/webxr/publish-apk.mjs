import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { readGeckoArtifact, PAINT_PREFERENCE } from "./gecko-artifact.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const apk = path.join(root, "quest/runtime/wolvic/app/build/outputs/apk/oculusvrArm64GeckoGeneric/debug/Wolvic-oculusvr-arm64-gecko-generic-debug.apk");
const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA, "Android/Sdk");
const versions = readdirSync(path.join(sdk, "build-tools")).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
const aapt = path.join(sdk, "build-tools", versions[0], process.platform === "win32" ? "aapt.exe" : "aapt");
const details = execFileSync(aapt, ["dump", "badging", apk], { encoding: "utf8", windowsHide: true });
if (!details.includes("package: name='com.nethack3d.quest.webxrproof'")) throw new Error("Incorrect proof package identity.");
if (!details.includes("versionName='0.3.14-ui-input'")) throw new Error("Unexpected APK version.");
for (const permission of ["WAKE_LOCK", "FOREGROUND_SERVICE"]) {
  if (!details.includes("name='android.permission." + permission + "'")) throw new Error("Missing Gecko runtime permission: " + permission);
}
const bytes = readFileSync(apk), names = new Set();
const inspected = unzipSync(bytes, { filter: (entry) => {
  names.add(entry.name);
  return ["assets/nh3d-gecko-runtime.json", "lib/arm64-v8a/libxul.so", "lib/arm64-v8a/libnative-lib.so", "res/raw/fxr_config.yaml"].includes(entry.name);
} });
const gecko = readGeckoArtifact(process.env.QUEST_GECKO_DIR ?? path.join(root, "quest/runtime/gecko"));
const native = Buffer.from(inspected["lib/arm64-v8a/libnative-lib.so"] ?? []);
for (const marker of ["NH3D resolution limit:", "NH3D resolution: WebXR eye", "NH3D HTML surface:"]) {
  if (!native.includes(Buffer.from(marker))) throw new Error("APK lacks the native resolution fix: " + marker);
}
const receipt = JSON.parse(Buffer.from(inspected["assets/nh3d-gecko-runtime.json"] ?? []).toString());
if (receipt.coordinate !== gecko.coordinate || receipt.patchSha256 !== gecko.patchSha256 || receipt.revision !== gecko.revision ||
    createHash("sha256").update(inspected["lib/arm64-v8a/libxul.so"] ?? []).digest("hex") !== gecko.libxulSha256 ||
    !Buffer.from(inspected["lib/arm64-v8a/libxul.so"] ?? []).includes(Buffer.from(PAINT_PREFERENCE)) ||
    !Buffer.from(inspected["lib/arm64-v8a/libxul.so"] ?? []).includes(Buffer.from("dom.vr.webxr.transparent-document")) ||
    !Buffer.from(inspected["lib/arm64-v8a/libxul.so"] ?? []).includes(Buffer.from("dom.vr.webxr.composite-document")) ||
    !Buffer.from(inspected["res/raw/fxr_config.yaml"] ?? []).includes(Buffer.from("dom.vr.webxr.composite-document: true")) ||
    !Buffer.from(inspected["res/raw/fxr_config.yaml"] ?? []).includes(Buffer.from("dom.vr.webxr.transparent-document: true")) ||
    !Buffer.from(inspected["res/raw/fxr_config.yaml"] ?? []).includes(Buffer.from(PAINT_PREFERENCE + ": true"))) {
  throw new Error("APK does not contain and enable the patched Gecko runtime.");
}
for (const required of ["assets/game/index.html", "assets/game/quest-build.json",
  "lib/arm64-v8a/libxul.so", "lib/arm64-v8a/libnative-lib.so", "lib/arm64-v8a/libopenxr_loader.so"]) {
  if (!names.has(required)) throw new Error("Standalone APK is missing " + required);
}
if ([...names].filter((name) => name.startsWith("assets/game/") && name.endsWith(".wasm")).length < 3) {
  throw new Error("The bundled NetHack runtimes are incomplete.");
}
const output = path.join(root, "quest/build/outputs/apk/nethack3d-webxr-proof-debug.apk");
mkdirSync(path.dirname(output), { recursive: true });
copyFileSync(apk, output);
const versionedOutput = path.join(path.dirname(output), "nethack3d-webxr-0.3.14-ui-input-debug.apk");
copyFileSync(apk, versionedOutput);
console.log("Verified standalone APK: " + versionedOutput);
console.log("Latest APK: " + output);
console.log("SHA256: " + createHash("sha256").update(bytes).digest("hex"));
