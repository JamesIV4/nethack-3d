import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GECKO_REVISION, readGeckoArtifact, sha256 } from "./gecko-artifact.mjs";
import { downloadDependencies } from "./download-dependencies.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const patchHash = sha256(readFileSync(new URL("./patch-gecko-paint.py", import.meta.url)));
const requiredPlatform = ["Include/OVR_Platform.h", "Android/libs/arm64-v8a/libovrplatformloader.so"];

export function dependencyCache(env = process.env) {
  const base = env.QUEST_DEPENDENCY_CACHE || path.join(
    env.LOCALAPPDATA || env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "nethack-3d", "quest-dependencies");
  return path.resolve(base, `${GECKO_REVISION}-${patchHash}`);
}

function validPlatform(directory) {
  return requiredPlatform.every(file => existsSync(path.join(directory, file)) && lstatSync(path.join(directory, file)).isFile());
}

function validGecko(directory) {
  try { readGeckoArtifact(directory); return true; } catch { return false; }
}

// Bundles are directories, so importing never executes an archive extractor or script.
export function bundleFile(directory, name) {
  if (typeof name !== "string" || !/^(OVRPlatformSDK|gecko)\//.test(name) ||
      name.includes("\\") || name.includes(":") || name.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error(`Invalid dependency bundle path: ${name}`);
  }
  let current = directory;
  for (const part of name.split("/")) {
    current = path.join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Dependency bundle contains a link: ${name}`);
  }
  return current;
}

function inventory(directory, prefix, files = {}) {
  for (const entry of readdirSync(path.join(directory, prefix), { withFileTypes: true })) {
    const name = `${prefix}/${entry.name}`;
    const file = bundleFile(directory, name);
    if (entry.isDirectory()) inventory(directory, name, files);
    else if (entry.isFile()) files[name] = sha256(readFileSync(file));
    else throw new Error(`Unsupported dependency file: ${name}`);
  }
  return files;
}

export function verifyBundle(directory) {
  const manifest = JSON.parse(readFileSync(path.join(directory, "quest-dependencies.json"), "utf8"));
  if (manifest.schema !== 1 || manifest.revision !== GECKO_REVISION || manifest.patchSha256 !== patchHash ||
      !manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== "object") {
    throw new Error("Dependency bundle does not match this branch's Gecko revision and paint patch.");
  }
  for (const [name, hash] of Object.entries(manifest.files)) {
    if (!/^[a-f0-9]{64}$/.test(hash) || sha256(readFileSync(bundleFile(directory, name))) !== hash) {
      throw new Error(`Dependency bundle checksum failed: ${name}`);
    }
  }
  for (const file of [...requiredPlatform.map(name => `OVRPlatformSDK/${name}`), "gecko/nh3d-gecko-runtime.json"]) {
    if (!manifest.files[file]) throw new Error(`Incomplete dependency bundle: ${file}`);
  }
  const gecko = readGeckoArtifact(path.join(directory, "gecko"));
  for (const file of Object.keys(gecko.files)) {
    if (!manifest.files[`gecko/${file}`]) throw new Error(`Unlisted Gecko dependency: ${file}`);
  }
  return manifest;
}

function copyBundle(source, destination) {
  const manifest = verifyBundle(source);
  for (const name of Object.keys(manifest.files)) {
    const target = bundleFile(destination, name);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(bundleFile(source, name), target);
  }
  writeFileSync(path.join(destination, "quest-dependencies.json"), JSON.stringify(manifest, null, 2) + "\n");
  verifyBundle(destination);
}

function createBundle(platform, geckoDirectory, destination) {
  const gecko = readGeckoArtifact(geckoDirectory);
  cpSync(platform, path.join(destination, "OVRPlatformSDK"), { recursive: true, dereference: false });
  // Keep only the selected runtime, not all historical Maven publications.
  const files = {};
  for (const suffix of [".aar", ".pom", ".module"]) {
    const name = gecko.aar.replace(/\.aar$/, suffix);
    const target = bundleFile(destination, `gecko/${name}`);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(geckoDirectory, name), target);
    files[name] = gecko.files[name];
  }
  writeFileSync(path.join(destination, "gecko/nh3d-gecko-runtime.json"), JSON.stringify({ ...gecko, files }, null, 2) + "\n");
  writeFileSync(path.join(destination, "quest-dependencies.json"), JSON.stringify({
    schema: 1, revision: GECKO_REVISION, patchSha256: patchHash,
    files: { ...inventory(destination, "OVRPlatformSDK"), ...inventory(destination, "gecko") },
  }, null, 2) + "\n");
  verifyBundle(destination);
}

export async function setupDependencies({ root = repository, env = process.env, from, output, log = console.log,
  lockFile = new URL("./dependencies.lock.json", import.meta.url), fetchImpl = fetch } = {}) {
  const cache = dependencyCache(env);
  const platform = path.resolve(env.QUEST_OVR_PLATFORM_SDK || path.join(root, "quest/runtime/OVRPlatformSDK"));
  const gecko = path.resolve(env.QUEST_GECKO_DIR || path.join(root, "quest/runtime/gecko"));
  // Explicit paths are authoritative; never silently replace a custom SDK/runtime.
  if (env.QUEST_OVR_PLATFORM_SDK && !validPlatform(platform)) throw new Error(`Invalid QUEST_OVR_PLATFORM_SDK: ${platform}`);
  if (env.QUEST_GECKO_DIR) readGeckoArtifact(gecko);
  if (from) verifyBundle(path.resolve(from));
  let cached = false;
  try { verifyBundle(cache); cached = true; } catch { /* Recover from validated local files or an imported bundle. */ }
  if (!cached || from) {
    const sdkSource = validPlatform(platform) ? platform : path.join(root, "quest/runtime/wolvic/third_party/OVRPlatformSDK");
    const local = validPlatform(sdkSource) && validGecko(gecko);
    mkdirSync(path.dirname(cache), { recursive: true });
    const temporary = mkdtempSync(path.join(path.dirname(cache), ".staging-"));
    try {
      if (from) copyBundle(path.resolve(from), temporary);
      else if (local) createBundle(sdkSource, gecko, temporary);
      else {
        const lock = JSON.parse(readFileSync(lockFile, "utf8"));
        await downloadDependencies(temporary, lock, { fetchImpl, log });
        verifyBundle(temporary);
      }
      if (existsSync(cache)) {
        // Preserve an older/corrupt cache for diagnosis instead of deleting it.
        renameSync(cache, `${cache}.previous-${Date.now()}`);
      }
      renameSync(temporary, cache);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
    log(`Saved Quest dependency cache: ${cache}`);
  }
  if (!validPlatform(platform)) {
    cpSync(path.join(cache, "OVRPlatformSDK"), platform, { recursive: true });
    log("Restored Meta Platform SDK from the external cache.");
  }
  if (!validGecko(gecko)) {
    cpSync(path.join(cache, "gecko"), gecko, { recursive: true });
    log("Restored patched GeckoView from the external cache.");
  }
  if (output) {
    const destination = path.resolve(output);
    if (existsSync(destination)) throw new Error(`Bundle destination already exists: ${destination}`);
    copyBundle(cache, destination);
    log(`Exported portable Quest dependency bundle: ${destination}`);
  }
  return cache;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (!["--from", "--export"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) {
        throw new Error("Usage: npm run quest:webxr:setup -- [--from <bundle-directory>] [--export <new-directory>]");
      }
      options[args[i] === "--from" ? "from" : "output"] = args[++i];
    }
    const cache = await setupDependencies(options);
    console.log(`Quest dependencies ready. Cache: ${cache}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
