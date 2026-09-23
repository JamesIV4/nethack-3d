import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { copyArtifacts, dependencyKey } from "./wsl-appimage.mjs";

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nh3d-appimage-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("dependency cache invalidates for metadata, npm configuration, and Node changes", (t) => {
  const directory = fixture(t);
  fs.writeFileSync(path.join(directory, "package.json"), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(directory, "package-lock.json"), '{"lockfileVersion":3}');
  let previous = dependencyKey(directory, "node-a");
  assert.equal(dependencyKey(directory, "node-a"), previous);
  for (const [name, content] of [
    ["package.json", '{"version":"1.0.1"}'],
    ["package-lock.json", '{"lockfileVersion":3,"packages":{}}'],
    [".npmrc", "legacy-peer-deps=true"],
  ]) {
    fs.writeFileSync(path.join(directory, name), content);
    const next = dependencyKey(directory, "node-a");
    assert.notEqual(next, previous);
    previous = next;
  }
  assert.notEqual(dependencyKey(directory, "node-b"), previous);
  fs.rmSync(path.join(directory, ".npmrc"));
  assert.notEqual(dependencyKey(directory, "node-a"), previous);
});

test("artifact copy preserves Windows releases, replaces existing AppImages, and skips unpacked output", (t) => {
  const directory = fixture(t);
  const source = path.join(directory, "linux output");
  const destination = path.join(directory, "release with spaces");
  fs.mkdirSync(path.join(source, "linux-unpacked"), { recursive: true });
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(source, "NetHack 3D 1.0.0.AppImage"), "new image");
  fs.writeFileSync(path.join(source, "builder-debug.yml"), "debug");
  fs.writeFileSync(path.join(source, "linux-unpacked", "app"), "unpacked");
  fs.writeFileSync(path.join(destination, "NetHack 3D 1.0.0.AppImage"), "old image");
  fs.writeFileSync(path.join(destination, "Windows.exe"), "windows");
  copyArtifacts(source, destination);
  assert.equal(fs.readFileSync(path.join(destination, "NetHack 3D 1.0.0.AppImage"), "utf8"), "new image");
  assert.equal(fs.readFileSync(path.join(destination, "Windows.exe"), "utf8"), "windows");
  assert.deepEqual(fs.readdirSync(destination).sort(), ["NetHack 3D 1.0.0.AppImage", "Windows.exe", "builder-debug.yml"]);
});

test("missing AppImage fails before copying any output", (t) => {
  const directory = fixture(t);
  const destination = path.join(directory, "destination");
  fs.writeFileSync(path.join(directory, "builder-debug.yml"), "debug");
  assert.throws(() => copyArtifacts(directory, destination), /no AppImage/);
  assert.equal(fs.existsSync(destination), false);
});
