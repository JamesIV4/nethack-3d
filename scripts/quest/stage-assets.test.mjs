import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { stageQuestAssets } from "./stage-assets.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "nh3d-quest-stage-"));
  t.after(() => {
    // Only remove the unique temp directory created by this fixture.
    assert.equal(resolve(root).startsWith(resolve(tmpdir()) + "\\") || resolve(root).startsWith(resolve(tmpdir()) + "/"), true);
    rmSync(root, { recursive: true });
  });
  const source = join(root, "dist-quest");
  const target = join(root, "quest/app/build/generated/gameAssets/game");
  mkdirSync(source, { recursive: true });
  mkdirSync(target, { recursive: true });
  for (const file of ["index.html", "quest-ui-probe.html", "nethack-367.js", "nethack-5.js", "slashem.js"]) {
    writeFileSync(join(source, file), "fixture");
  }
  for (const file of ["nethack-367.wasm", "nethack-5.wasm", "slashem.wasm"]) {
    writeFileSync(join(source, file), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  }
  writeFileSync(join(source, "quest-build.json"), JSON.stringify({ target: "quest-ui-proof", base: "/", entry: "quest-ui-probe.html" }));
  writeFileSync(join(target, "previous.txt"), "keep until preflight passes");
  return { root, source, target };
}

test("copies the prepared bundle including workers and removes stale generated chunks", (t) => {
  const { root, source, target } = fixture(t);
  mkdirSync(join(source, "assets"));
  writeFileSync(join(source, "assets/runtime-worker.js"), "worker fixture");
  assert.equal(stageQuestAssets(root).toLowerCase(), target.toLowerCase());
  assert.equal(existsSync(join(target, "previous.txt")), false);
  assert.equal(readFileSync(join(target, "assets/runtime-worker.js"), "utf8"), "worker fixture");
});

test("rejects missing entry chunks and external HTML dependencies before replacing assets", (t) => {
  const { root, source, target } = fixture(t);
  writeFileSync(join(source, "index.html"), '<script type="module" src="/assets/missing.js"></script>');
  assert.throws(() => stageQuestAssets(root), /Missing Quest entry resource/);
  writeFileSync(join(source, "index.html"), '<link rel="stylesheet" href="https://example.org/fonts.css">');
  assert.throws(() => stageQuestAssets(root), /external resource/);
  assert.equal(existsSync(join(target, "previous.txt")), true);
});

test("rejects missing runtime assets without removing the previous staged bundle", (t) => {
  const { root, source, target } = fixture(t);
  rmSync(join(source, "slashem.wasm"));
  assert.throws(() => stageQuestAssets(root), /Incomplete Quest build: slashem.wasm/);
  assert.equal(existsSync(join(target, "previous.txt")), true);
});

test("rejects WASM pointers and another platform's build", (t) => {
  const { root, source, target } = fixture(t);
  writeFileSync(join(source, "nethack-5.wasm"), "version https://git-lfs.github.com/spec/v1");
  assert.throws(() => stageQuestAssets(root), /Invalid WASM asset/);
  writeFileSync(join(source, "nethack-5.wasm"), Buffer.from([0, 97, 115, 109]));
  writeFileSync(join(source, "quest-build.json"), JSON.stringify({ target: "capacitor" }));
  assert.throws(() => stageQuestAssets(root), /Wrong build target/);
  assert.equal(existsSync(join(target, "previous.txt")), true);
});
