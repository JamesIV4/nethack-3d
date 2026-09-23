import { createReadStream, createWriteStream, readFileSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import { GECKO_REVISION, sha256 } from "./gecko-artifact.mjs";

export function validateDownload(lock) {
  const patchHash = sha256(readFileSync(new URL("./patch-gecko-paint.py", import.meta.url)));
  if (lock.schema !== 1 || lock.revision !== GECKO_REVISION || lock.patchSha256 !== patchHash ||
      !/^[a-f0-9]{64}$/.test(lock.sha256) || !Number.isSafeInteger(lock.bytes) || lock.bytes <= 0 || lock.bytes > 2 ** 31 ||
      new URL(lock.url).protocol !== "https:") {
    throw new Error("The pinned Quest dependency download is invalid or does not match this branch. Rebuild and publish its runtime dependencies.");
  }
}

export function validateArchiveEntry(entry) {
  const name = entry.path.replace(/\/$/, "");
  if (!["File", "Directory"].includes(entry.type) || name.includes("\\") || name.includes(":") ||
      name.split("/").some(part => !part || part === "." || part === "..") ||
      !(name === "quest-dependencies.json" || /^(gecko|OVRPlatformSDK)(\/|$)/.test(name))) {
    throw new Error(`Unsafe Quest dependency archive entry: ${entry.path} (${entry.type})`);
  }
}

export async function fileSha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function downloadDependencies(destination, lock, { fetchImpl = fetch, log = console.log } = {}) {
  validateDownload(lock);
  const archive = path.join(destination, "download.tar.gz");
  log(`Downloading pinned Quest runtime: ${lock.url}`);
  const response = await fetchImpl(lock.url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`Quest dependency download failed (HTTP ${response.status}). Retry npm run quest:webxr:setup.`);
  let bytes = 0;
  const limit = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    callback(bytes > lock.bytes ? new Error("Quest dependency download exceeds its pinned size.") : null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(archive, { flags: "wx" }));
    if (statSync(archive).size !== lock.bytes || await fileSha256(archive) !== lock.sha256) {
      throw new Error("Quest dependency download failed SHA256/size verification; nothing was installed.");
    }
    // Inspect the entire authenticated archive before writing any extracted files.
    tar.t({ file: archive, sync: true, strict: true, onReadEntry: validateArchiveEntry });
    tar.x({ file: archive, cwd: destination, sync: true, strict: true });
  } finally { rmSync(archive, { force: true }); }
}
