import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findAndroidSdk, javaEnvironment } from "./build-environment.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2), legacy = args.includes("--legacy");
if (args.some(arg => !["--legacy", "--check", "--help"].includes(arg))) {
  console.error("Usage: node scripts/quest/build-apk.mjs [--legacy] [--check] [--help]"); process.exit(2);
}
if (args.includes("--help")) {
  console.log("Build the bundled Quest WebXR APK on Windows, macOS or Linux.\n--check: validate prerequisites without building\n--legacy: build the earlier Meta Spatial experiment\nRequires npm dependencies, a compatible JDK and Android SDK. WebXR also requires staged Meta Platform SDK and patched GeckoView artifacts.\nVerification copies the APK locally; it does not upload or install it."); process.exit(0);
}
const project = path.join(root, legacy ? "quest" : "quest/runtime/wolvic");
function run(file, argv, env) {
  const result = spawnSync(file, argv, { cwd: root, env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(file)} failed (${result.signal || result.status}).`);
}
try {
  const env = javaEnvironment();
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT = findAndroidSdk({env, properties:[path.join(project,"local.properties")]});
  const java = env.JAVA_HOME ? path.join(env.JAVA_HOME,"bin",process.platform === "win32" ? "java.exe" : "java") : "java";
  run(java,["-version"],env);
  if (!legacy) run(process.execPath,["scripts/quest/webxr/prepare-gecko-runtime.mjs",...(args.includes("--check")?["--check"]:[])],env);
  if (args.includes("--check")) { console.log("Quest build prerequisites checked."); process.exit(0); }
  const npm = [env.npm_execpath, path.join(path.dirname(process.execPath),"node_modules/npm/bin/npm-cli.js"),path.resolve(path.dirname(process.execPath),"../lib/node_modules/npm/bin/npm-cli.js")].find(file=>file&&existsSync(file));
  if (!npm) throw new Error("Cannot locate npm-cli.js. Run this build using npm run quest:webxr:apk (or quest:apk for the legacy build).");
  run(process.execPath,[npm,"run","quest:sync"],env);
  const wrapper = path.join(root,legacy?"android":"quest/runtime/wolvic","gradle/wrapper/gradle-wrapper.jar");
  // Invoke the pinned Gradle wrapper without a platform-specific shell launcher.
  run(java,["-Xmx64m","-Xms64m","-Dorg.gradle.appname=gradlew","-classpath",wrapper,"org.gradle.wrapper.GradleWrapperMain","-p",project,legacy?":app:assembleDebug":":app:assembleOculusvrArm64GeckoGenericDebug","--console=plain","--max-workers=4"],env);
  if (!legacy) run(process.execPath,["scripts/quest/webxr/publish-apk.mjs"],env);
  else {
    const apk=path.join(project,"app/build/outputs/apk/debug/app-debug.apk");
    if (!existsSync(apk)) throw new Error("Gradle finished without the expected APK: "+apk);
    const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const output = path.join(root, "release", `NetHack 3D ${version} Quest Legacy.apk`);
    mkdirSync(path.dirname(output), { recursive: true });
    copyFileSync(apk, output);
    console.log("APK ready: "+output);
  }
} catch(error) { console.error(error.message); process.exitCode=1; }
