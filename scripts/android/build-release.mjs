import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findAndroidSdk, javaEnvironment } from "../quest/build-environment.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const project = path.join(root, "android");
const args = process.argv.slice(2);
if (args.some(arg => !["--check", "--help"].includes(arg))) {
  console.error("Usage: npm run android:release -- [--check | --help]");
  process.exit(2);
}
if (args.includes("--help")) {
  console.log("Build and sign the Android release APK without opening Android Studio.\nConfigure android/keystore.properties first (see the example file).\n--check: check Java, Android SDK and signing configuration without building.\nOutput: release/NetHack 3D <version> Android.apk");
  process.exit(0);
}

try {
  const env = javaEnvironment();
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT = findAndroidSdk({ env, properties: [path.join(project, "local.properties")] });
  const java = env.JAVA_HOME ? path.join(env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : "java";
  function run(file, argv) {
    const result = spawnSync(file, argv, { cwd: root, env, stdio: "inherit", windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${path.basename(file)} failed (${result.signal || result.status}).`);
  }
  function gradle(task) {
    run(java, ["-Xmx64m", "-Xms64m", "-Dorg.gradle.appname=gradlew", "-classpath", path.join(project, "gradle/wrapper/gradle-wrapper.jar"), "org.gradle.wrapper.GradleWrapperMain", "-p", project, task, "--console=plain"]);
  }
  run(java, ["-version"]);
  // Fail before the web build if the release key has not been configured.
  gradle(":app:validateReleaseSigning");
  if (args.includes("--check")) {
    console.log("Android SDK, Java and signing configuration checked. Passwords are validated during release signing.");
  } else {
    const npm = [env.npm_execpath, path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")].find(file => file && existsSync(file));
    if (!npm) throw new Error("Cannot locate npm-cli.js. Run this script using npm run android:release.");
    run(process.execPath, [npm, "run", "android:sync"]);
    gradle(":app:assembleRelease");
    const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const apk = path.join(project, "app/build/outputs/apk/release", `NetHack 3D ${version}.apk`);
    if (!existsSync(apk)) throw new Error(`Gradle finished without the expected APK: ${apk}`);
    const output = path.join(root, "release", `NetHack 3D ${version} Android.apk`);
    mkdirSync(path.dirname(output), { recursive: true });
    copyFileSync(apk, output);
    console.log(`Signed release APK ready: ${output}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
