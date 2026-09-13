import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchRuntime, runtimePaths, replaceOnce, WOLVIC_REVISION } from "./runtime-patch.mjs";
import { readGeckoArtifact, PAINT_PREFERENCE } from "./gecko-artifact.mjs";
import { patchHostInteraction } from "./patch-host-interaction.mjs";
import { patchWolvicPointer } from "./patch-wolvic-pointer.mjs";
import { patchTableUi } from "./patch-table-ui.mjs";
import { patchLiveUi } from "./patch-live-ui.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const checkout = path.join(root, "quest/runtime/wolvic");
const platform = process.env.QUEST_OVR_PLATFORM_SDK ?? path.join(root, "quest/runtime/OVRPlatformSDK");
const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA ?? "", "Android/Sdk");
const geckoRevision = "dc23a6a0dbc999a0ec38e7ce87f654945568b28b";
const geckoDirectory = path.resolve(process.env.QUEST_GECKO_DIR ?? path.join(root, "quest/runtime/gecko"));
if (!existsSync(path.join(platform, "Include/OVR_Platform.h")) ||
    !existsSync(path.join(platform, "Android/libs/arm64-v8a/libovrplatformloader.so"))) throw new Error("Install the Meta Platform SDK or set QUEST_OVR_PLATFORM_SDK.");
if (!existsSync(sdk)) throw new Error("Android SDK not found.");
const gecko = readGeckoArtifact(geckoDirectory);
if (process.argv.includes("--check")) { console.log("Meta/Android SDKs and patched GeckoView Maven artifacts verified."); process.exit(0); }
function git(...args) { return execFileSync("git", args, { cwd: root, stdio: "pipe", encoding: "utf8", windowsHide: true }); }
if (!existsSync(checkout)) {
  mkdirSync(path.dirname(checkout), { recursive: true });
  execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", "https://github.com/Igalia/wolvic.git", checkout], { stdio: "inherit", windowsHide: true });
  git("-C", checkout, "checkout", "--detach", WOLVIC_REVISION);
}
if (git("-C", checkout, "rev-parse", "HEAD").trim() !== WOLVIC_REVISION) throw new Error("Unexpected runtime source revision.");
const marker = path.join(checkout, ".nh3d-stock-gecko.json");
if (!existsSync(marker)) {
  if (git("-C", checkout, "status", "--porcelain").trim()) throw new Error("Refusing to replace a modified runtime checkout.");
  const sources = Object.fromEntries(Object.entries(runtimePaths).map(([key, file]) => [key, readFileSync(path.join(checkout, file), "utf8")]));
  const patched = patchRuntime(sources);
  let native = patched.external;
  native = replaceOnce(native,
    "  memcpy(m.system.displayState.eyeTransform[which].data(), aTransform.Data(), arraySize(m.system.displayState.eyeTransform[which]));",
    "  const vrb::Vector eyePosition = aTransform.GetTranslation();\n  m.system.displayState.eyeTranslation[which] = { eyePosition.x(), eyePosition.y(), eyePosition.z() };",
    "upstream Gecko eye-translation ABI");
  const blendStart = native.indexOf("  std::fill(m.system.displayState.blendModes.begin()");
  const blendEnd = native.indexOf("\n}\n", blendStart);
  if (blendStart < 0 || blendEnd < 0) throw new Error("Unknown blend-mode implementation.");
  native = native.slice(0, blendStart) + "  // Stock Gecko's v19 API advertises one blend mode.\n  m.system.displayState.blendMode = mozilla::gfx::VRDisplayBlendMode::Opaque;" + native.slice(blendEnd);
  const getterStart = native.indexOf("  ASSERT(IsPresenting());\n  switch (m.browser.blendMode)");
  const getterEnd = native.indexOf("\n}\n", getterStart);
  if (getterStart < 0 || getterEnd < 0) throw new Error("Unknown blend-mode getter.");
  native = native.slice(0, getterStart) + "  return device::BlendMode::Opaque;" + native.slice(getterEnd);
  const sessionStart = native.indexOf("  ASSERT(IsPresenting());\n  switch (m.browser.sessionType)");
  const sessionEnd = native.indexOf("\n}\n", sessionStart);
  if (sessionStart < 0 || sessionEnd < 0) throw new Error("Unknown session-type getter.");
  native = native.slice(0, sessionStart) + "  return DeviceDelegate::ImmersiveXRSessionType::VR;" + native.slice(sessionEnd);
  for (const name of ["MetaQuest3", "YvrTouch", "YvrTouch2"]) native = native.replaceAll("VRControllerType::" + name + ";", "VRControllerType::OculusTouch3;");
  for (const name of ["PicoNeo3", "Pico4"]) native = native.replaceAll("VRControllerType::" + name + ";", "VRControllerType::PicoNeo2;");
  patched.external = native;
  const response = await fetch("https://hg.mozilla.org/mozilla-central/raw-file/" + geckoRevision + "/gfx/vr/external_api/moz_external_vr.h");
  if (!response.ok) throw new Error("Could not fetch the exact GeckoView ABI header.");
  const header = await response.text();
  if (!header.includes("kVRExternalVersion = 19;") || !header.includes("eyeTranslation")) throw new Error("Unexpected GeckoView ABI.");
  for (const [key, file] of Object.entries(runtimePaths)) writeFileSync(path.join(checkout, file), patched[key]);
  writeFileSync(path.join(checkout, "app/src/main/cpp/moz_external_vr.h"), header);
  const gradlePath = path.join(checkout, "app/build.gradle");
  let gradle = readFileSync(gradlePath, "utf8")
    .replace('applicationId "com.igalia.wolvic"', 'applicationId "com.nethack3d.quest.webxrproof"');
  const assets = path.join(root, "quest/app/build/generated/gameAssets").replaceAll("\\", "/").replaceAll("'", "\\'");
  gradle += `\nandroid.defaultConfig {\n buildConfigField "boolean", "NH3D_GAME_HOST", "true"\n resValue "string", "app_name", "NetHack 3D WebXR Proof"\n}\nandroid.sourceSets.main.assets.srcDir('${assets}')\n`;
  writeFileSync(gradlePath, gradle);
  const enginePath = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/browser/engine/EngineProvider.kt");
  let engine = readFileSync(enginePath, "utf8").replace(
    "if (settingsStore.transparentBorderWidth > 0)", "if (BuildConfig.NH3D_GAME_HOST || settingsStore.transparentBorderWidth > 0)");
  engine = engine.replace("builder.debugLogging(settingsStore.isDebugLoggingEnabled)", "builder.debugLogging(BuildConfig.DEBUG || settingsStore.isDebugLoggingEnabled)")
    .replace("builder.consoleOutput(settingsStore.isDebugLoggingEnabled)", "builder.consoleOutput(BuildConfig.DEBUG || settingsStore.isDebugLoggingEnabled)");
  writeFileSync(enginePath, engine);
  const runtimePath = path.join(checkout, "app/src/common/gecko/com/igalia/wolvic/browser/api/impl/RuntimeImpl.java");
  let runtime = readFileSync(runtimePath, "utf8").replace(".glMsaaLevel(settings.getGlMsaaLevel())",
    ".glMsaaLevel(settings.getGlMsaaLevel())\n                .useMaxScreenDepth(true)");
  writeFileSync(runtimePath, runtime);
  writeFileSync(marker, JSON.stringify({ wolvic: WOLVIC_REVISION, gecko: geckoRevision, abi: 19, version: 1 }) + "\n");
}
const versionsPath = path.join(checkout, "gradle/libs.versions.toml");
writeFileSync(versionsPath, readFileSync(versionsPath, "utf8")
  .replace('agp = "8.11.1"', 'agp = "8.13.2"')
  .replace('kotlin = "2.2.21"', 'kotlin = "2.3.21"'));
const appBuildPath = path.join(checkout, "app/build.gradle");
let appBuild = readFileSync(appBuildPath, "utf8");
if (!appBuild.includes("targets 'native-lib'")) {
  appBuild += "\n// Build the browser and its read-only KTX dependency; skip the unused texture encoder.\nandroid.defaultConfig.externalNativeBuild.cmake { targets 'native-lib' }\n";
  writeFileSync(appBuildPath, appBuild);
}
if (!appBuild.includes('applicationId = "com.nethack3d.quest.webxrproof"')) {
  appBuild += '\nandroid.defaultConfig { applicationId = "com.nethack3d.quest.webxrproof" }\n';
  writeFileSync(appBuildPath, appBuild);
}
const engineDebugPath = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/browser/engine/EngineProvider.kt");
writeFileSync(engineDebugPath, readFileSync(engineDebugPath, "utf8")
  .replace("builder.remoteDebuggingEnabled(settingsStore.isRemoteDebuggingEnabled)", "builder.remoteDebuggingEnabled(BuildConfig.DEBUG || settingsStore.isRemoteDebuggingEnabled)"));

const manifestPath = path.join(checkout, "app/src/main/AndroidManifest.xml");
let manifest = readFileSync(manifestPath, "utf8");
for (const permission of ["WAKE_LOCK", "FOREGROUND_SERVICE"]) {
  manifest = manifest.replace('android:name="android.permission.' + permission + '" tools:node="remove"',
    'android:name="android.permission.' + permission + '"');
}
manifest = manifest.replace("Requested by GeckoView but not needed in VR",
  "Required by GeckoView for audio and wake-lock lifecycle callbacks");
writeFileSync(manifestPath, manifest);
if (!appBuild.includes('versionName = "0.3.1-auto-vr"')) {
  appBuild += '\nandroid.defaultConfig { versionName = "0.3.1-auto-vr"; resValue "string", "app_name", "NetHack 3D VR Auto" }\n';
  writeFileSync(appBuildPath, appBuild);
}
appBuild = appBuild.replace(
  "select(candidates.find { it.id.module.contains(candidate) })",
  "select(candidates.find { it.id.module.contains(candidate) } ?: candidates.find { it.id.module == 'geckoview-default-omni' })");
if (!appBuild.includes("apply from: 'nh3d-gecko.gradle'")) appBuild += "\napply from: 'nh3d-gecko.gradle'\n";
writeFileSync(appBuildPath, appBuild);
const mavenDirectory = path.join(geckoDirectory, "maven").replaceAll("\\", "/").replaceAll("'", "\\'");
writeFileSync(path.join(checkout, "app/nh3d-gecko.gradle"), `
repositories {
    exclusiveContent {
        forRepository { maven { url = uri('${mavenDirectory}') } }
        filter { includeModule('org.mozilla.geckoview', 'geckoview-default-omni') }
    }
}
configurations.configureEach {
    resolutionStrategy.cacheChangingModulesFor 0, 'seconds'
    resolutionStrategy.dependencySubstitution {
        substitute module('org.mozilla.geckoview:geckoview-nightly-omni-arm64-v8a') using module('${gecko.coordinate}')
        substitute module('org.mozilla.geckoview:geckoview-nightly-omni-x86_64') using module('${gecko.coordinate}')
    }
}
android.defaultConfig {
    versionName = "0.3.8-live-ui"
    resValue "string", "app_name", "NetHack 3D VR"
}
`);
const prefsPath = path.join(checkout, "app/src/main/res/raw/fxr_config.yaml");
let prefs = readFileSync(prefsPath, "utf8");
if (!prefs.includes("dom.vr.webxr.composite-document: true")) {
  prefs = prefs.replace(/prefs:\r?\n/, "prefs:\n  dom.vr.webxr.composite-document: true\n");
  writeFileSync(prefsPath, prefs);
}
if (!prefs.includes("dom.vr.webxr.transparent-document: true")) {
  prefs = prefs.replace(/prefs:\r?\n/, "prefs:\n  dom.vr.webxr.transparent-document: true\n");
  writeFileSync(prefsPath, prefs);
}
if (!prefs.includes(PAINT_PREFERENCE + ": true")) {
  prefs = prefs.replace("prefs:\n", "prefs:\n  " + PAINT_PREFERENCE + ": true\n")
    .replace("prefs:\r\n", "prefs:\r\n  " + PAINT_PREFERENCE + ": true\r\n");
  if (!prefs.includes(PAINT_PREFERENCE + ": true")) throw new Error("Cannot enable the Gecko HTML painting preference.");
  writeFileSync(prefsPath, prefs);
}
const hostAssets = path.join(checkout, "app/src/main/assets");
mkdirSync(hostAssets, { recursive: true });
writeFileSync(path.join(hostAssets, "nh3d-gecko-runtime.json"), JSON.stringify(gecko, null, 2) + "\n");
execFileSync("git", ["-C", checkout, "submodule", "update", "--init", "--recursive", "--depth=1"], { stdio: "inherit", windowsHide: true });
cpSync(path.join(root, "quest/webxr/host/BundledGameServer.java"), path.join(checkout, "app/src/common/shared/com/igalia/wolvic/BundledGameServer.java"));
cpSync(platform, path.join(checkout, "third_party/OVRPlatformSDK"), { recursive: true });
writeFileSync(path.join(checkout, "local.properties"), "sdk.dir=" + sdk.replaceAll("\\", "/").replaceAll(":", "\\:") + "\n");
writeFileSync(path.join(checkout, "user.properties"), "useStaticVersionCode=true\nuseDebugSigningOnRelease=true\n");
patchHostInteraction(checkout);
patchWolvicPointer(checkout);
patchTableUi(checkout);
patchLiveUi(checkout);
console.log("Prepared standalone WebXR host with patched GeckoView and its matching v19 native ABI.");
