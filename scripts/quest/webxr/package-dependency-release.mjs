import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as tar from "tar";
import { setupDependencies, verifyBundle, bundleFile } from "./setup-dependencies.mjs";
import { fileSha256 } from "./download-dependencies.mjs";
import { sha256 } from "./gecko-artifact.mjs";

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (!["--tag", "--source-bundle", "--output"].includes(args[i]) || !args[i + 1]) throw new Error("Usage: node scripts/quest/webxr/package-dependency-release.mjs --tag <tag> --source-bundle <source.tar.gz> --output <new-directory>");
  options[args[i].slice(2)] = args[++i];
}
if (!/^quest-runtime-[a-zA-Z0-9.-]+$/.test(options.tag || "") || !options["source-bundle"] || !options.output) throw new Error("Supply --tag quest-runtime-<version>, --source-bundle, and --output.");
const output = path.resolve(options.output);
if (existsSync(output)) throw new Error("Release output must be a new directory.");
const cache = await setupDependencies();
const original = verifyBundle(cache);
const bundle = path.join(output, "bundle");
mkdirSync(bundle, { recursive: true });
const files = {};
for (const [name, hash] of Object.entries(original.files)) {
  if (!(name.startsWith("gecko/") || name.startsWith("OVRPlatformSDK/Include/") ||
      ["OVRPlatformSDK/Android/libs/arm64-v8a/libovrplatformloader.so", "OVRPlatformSDK/LICENSE.txt", "OVRPlatformSDK/THIRD_PARTY_NOTICES.txt"].includes(name))) continue;
  const target = bundleFile(bundle, name);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(bundleFile(cache, name), target);
  files[name] = hash;
}
for (const name of ["OVRPlatformSDK/LICENSE.txt", "OVRPlatformSDK/THIRD_PARTY_NOTICES.txt"]) {
  if (!files[name]) throw new Error(`Cannot publish without SDK notices: ${name}`);
}
const sourceName = "gecko/corresponding-source.tar.gz";
cpSync(path.resolve(options["source-bundle"]), bundleFile(bundle, sourceName));
files[sourceName] = await fileSha256(bundleFile(bundle, sourceName));
const noticeName = "OVRPlatformSDK/NETHACK3D-NOTICE.txt";
const notice = "Copyright © Meta Platform Technologies, LLC and its affiliates. All rights reserved.\n\nThese unmodified SDK headers and ARM64 library are supplied for contributors building NetHack 3D for Meta Quest. They retain their separate Meta SDK license; they are not covered by the application's open-source license.\nhttps://developers.meta.com/horizon/licenses/oculussdk/\nSee LICENSE.txt and THIRD_PARTY_NOTICES.txt.\n";
writeFileSync(bundleFile(bundle, noticeName), notice);
files[noticeName] = sha256(notice);
writeFileSync(path.join(bundle, "quest-dependencies.json"), JSON.stringify({ ...original, files }, null, 2) + "\n");
verifyBundle(bundle);
const archive = path.join(output, "quest-dependencies.tar.gz");
await tar.c({ file: archive, cwd: bundle, gzip: true, portable: true }, ["quest-dependencies.json", "OVRPlatformSDK", "gecko"]);
const lock = {
  schema: 1, revision: original.revision, patchSha256: original.patchSha256,
  url: `https://github.com/JamesIV4/nethack-3d/releases/download/${options.tag}/quest-dependencies.tar.gz`,
  bytes: statSync(archive).size, sha256: await fileSha256(archive),
};
writeFileSync(path.join(output, "dependencies.lock.json"), JSON.stringify(lock, null, 2) + "\n");
writeFileSync(path.join(output, "SHA256SUMS"), `${lock.sha256}  quest-dependencies.tar.gz\n`);
console.log(`Release ready: ${output}\nReview/upload its assets, then copy dependencies.lock.json into scripts/quest/webxr/.`);
