import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GECKO_REVISION, readGeckoArtifact, sha256 } from "./gecko-artifact.mjs";
import { bundleFile, dependencyCache, setupDependencies, verifyBundle } from "./setup-dependencies.mjs";

function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "nh3d-dependencies-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, "repo");
  const env = { QUEST_DEPENDENCY_CACHE: path.join(directory, "external-cache") };
  const write = (name, contents) => {
    const file = path.join(root, "quest/runtime", name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };
  write("OVRPlatformSDK/Include/OVR_Platform.h", "header");
  write("OVRPlatformSDK/Android/libs/arm64-v8a/libovrplatformloader.so", "library");
  write("OVRPlatformSDK/LICENSE.txt", "license");
  const files = {};
  for (const extension of ["aar", "pom", "module"]) {
    const name = `maven/runtime.${extension}`;
    write(`gecko/${name}`, extension);
    files[name] = sha256(extension);
  }
  write("gecko/nh3d-gecko-runtime.json", JSON.stringify({
    schema: 1, revision: GECKO_REVISION, paintDocument: true, transparentDocument: true, compositeDocument: true,
    patchSha256: sha256(readFileSync(new URL("./patch-gecko-paint.py", import.meta.url))),
    coordinate: "org.mozilla.geckoview:geckoview-default-omni:fixture", aar: "maven/runtime.aar", files,
  }));
  return { directory, root, env, log() {} };
}

test("external cache restores dependencies after the runtime directory is removed", async t => {
  const options = fixture(t);
  const cache = await setupDependencies(options);
  assert.equal(cache, dependencyCache(options.env));
  assert.ok(!cache.startsWith(options.root));
  rmSync(path.join(options.root, "quest/runtime"), { recursive: true });
  await setupDependencies(options);
  readGeckoArtifact(path.join(options.root, "quest/runtime/gecko"));
  assert.equal(readFileSync(path.join(options.root, "quest/runtime/OVRPlatformSDK/LICENSE.txt"), "utf8"), "license");
});

test("portable bundle restores a fresh checkout with an empty cache", async t => {
  const options = fixture(t);
  const output = path.join(options.directory, "portable");
  await setupDependencies({ ...options, output });
  const fresh = { ...options, root: path.join(options.directory, "fresh"), env: { QUEST_DEPENDENCY_CACHE: path.join(options.directory, "fresh-cache") } };
  await setupDependencies({ ...fresh, from: output });
  readGeckoArtifact(path.join(fresh.root, "quest/runtime/gecko"));
  await assert.rejects(() => setupDependencies({ ...options, output }), /already exists/);
});

test("corrupt imported files and a different patch are rejected before restoring", async t => {
  const options = fixture(t);
  const output = path.join(options.directory, "portable");
  await setupDependencies({ ...options, output });
  writeFileSync(path.join(output, "OVRPlatformSDK/LICENSE.txt"), "tampered");
  assert.throws(() => verifyBundle(output), /checksum failed/);
  const manifestPath = path.join(output, "quest-dependencies.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.patchSha256 = "wrong patch";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  await assert.rejects(() => setupDependencies({ ...options, from: output }), /does not match/);
});

test("invalid explicit overrides fail without being replaced", async t => {
  const options = fixture(t);
  await setupDependencies(options);
  const missing = path.join(options.directory, "missing");
  await assert.rejects(() => setupDependencies({ ...options, env: { ...options.env, QUEST_OVR_PLATFORM_SDK: missing } }), /Invalid QUEST_OVR_PLATFORM_SDK/);
  await assert.rejects(() => setupDependencies({ ...options, env: { ...options.env, QUEST_GECKO_DIR: missing } }), /Patched GeckoView is missing/);
  assert.equal(existsSync(missing), false);
});

test("bundle paths cannot escape the dependency directories", () => {
  for (const name of ["../outside", "gecko/../../outside", "gecko/C:/outside", "gecko/..\\outside", "/gecko/file", "gecko//file"]) {
    assert.throws(() => bundleFile(os.tmpdir(), name), /Invalid dependency bundle path/);
  }
});
