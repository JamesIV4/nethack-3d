import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import { sha256, GECKO_REVISION } from "./gecko-artifact.mjs";
import { downloadDependencies, validateArchiveEntry } from "./download-dependencies.mjs";

async function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "nh3d-download-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const destination = path.join(root, "destination");
  mkdirSync(source); mkdirSync(destination);
  writeFileSync(path.join(source, "quest-dependencies.json"), "fixture");
  const file = path.join(root, "bundle.tar.gz");
  await tar.c({ cwd: source, file, gzip: true }, ["quest-dependencies.json"]);
  const bytes = readFileSync(file);
  const lock = { schema: 1, revision: GECKO_REVISION,
    patchSha256: sha256(readFileSync(new URL("./patch-gecko-paint.py", import.meta.url))),
    url: "https://example.com/pinned.tar.gz", bytes: bytes.length, sha256: sha256(bytes) };
  return { destination, bytes, lock, fetchImpl: async () => new Response(bytes), log() {} };
}

test("pinned download verifies and extracts without retaining the archive", async t => {
  const f = await fixture(t);
  await downloadDependencies(f.destination, f.lock, f);
  assert.equal(readFileSync(path.join(f.destination, "quest-dependencies.json"), "utf8"), "fixture");
  assert.equal(existsSync(path.join(f.destination, "download.tar.gz")), false);
});

test("bad checksum, truncated response, and oversized response install nothing", async t => {
  const f = await fixture(t);
  for (const bytes of [Buffer.alloc(f.bytes.length), f.bytes.subarray(0, 10), Buffer.concat([f.bytes, Buffer.from("extra")])]) {
    await assert.rejects(() => downloadDependencies(f.destination, f.lock, { ...f, fetchImpl: async () => new Response(bytes) }), /verification|pinned size/);
    assert.equal(existsSync(path.join(f.destination, "quest-dependencies.json")), false);
    assert.equal(existsSync(path.join(f.destination, "download.tar.gz")), false);
  }
});

test("HTTP failures and incompatible branch locks do not extract files", async t => {
  const f = await fixture(t);
  await assert.rejects(() => downloadDependencies(f.destination, f.lock, { ...f, fetchImpl: async () => new Response(null, { status: 404 }) }), /HTTP 404/);
  await assert.rejects(() => downloadDependencies(f.destination, { ...f.lock, patchSha256: "wrong" }, f), /does not match/);
});

test("archive entries reject links, traversal, and unexpected roots", () => {
  for (const entry of [
    { path: "gecko/link", type: "SymbolicLink" }, { path: "gecko/link", type: "Link" },
    { path: "../outside", type: "File" }, { path: "/gecko/file", type: "File" },
    { path: "gecko/../outside", type: "File" }, { path: "arbitrary/file", type: "File" },
  ]) assert.throws(() => validateArchiveEntry(entry), /Unsafe/);
});
