import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function findAndroidSdk({ env = process.env, platform = process.platform, home = os.homedir(), properties = [], exists = existsSync, read = readFileSync } = {}) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const explicit = env.ANDROID_SDK_ROOT || env.ANDROID_HOME;
  if (explicit) {
    if (!exists(explicit)) throw new Error(`Android SDK does not exist: ${explicit}`);
    return explicit;
  }
  for (const file of properties) {
    if (!exists(file)) continue;
    const value = /^\s*sdk\.dir\s*[=:]\s*(.+?)\s*$/m.exec(read(file, "utf8"))?.[1]?.replace(/\\([\\:= ])/g, "$1");
    if (value && exists(value)) return value;
  }
  const candidates = platform === "win32"
    ? [env.LOCALAPPDATA && paths.join(env.LOCALAPPDATA, "Android", "Sdk")]
    : platform === "darwin" ? [paths.join(home, "Library", "Android", "sdk")]
    : [paths.join(home, "Android", "Sdk"), paths.join(home, "Android", "sdk")];
  const sdk = candidates.find(value => value && exists(value));
  if (!sdk) throw new Error("Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT, or configure sdk.dir in local.properties.");
  return sdk;
}

export function javaEnvironment(env = process.env) {
  if (env.JAVA_HOME) return { ...env };
  const candidates = process.platform === "win32"
    ? [path.join(env.ProgramFiles || "C:/Program Files", "Android/Android Studio/jbr")]
    : process.platform === "darwin" ? ["/Applications/Android Studio.app/Contents/jbr/Contents/Home"]
    : ["/opt/android-studio/jbr", "/usr/local/android-studio/jbr"];
  const home = candidates.find(value => existsSync(path.join(value, "bin", process.platform === "win32" ? "java.exe" : "java")));
  return { ...env, ...(home ? { JAVA_HOME: home } : {}) };
}
