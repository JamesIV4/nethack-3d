import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requiredFiles = [
  "index.html", "quest-ui-probe.html", "quest-build.json",
  "nethack-367.js", "nethack-367.wasm",
  "nethack-5.js", "nethack-5.wasm",
  "slashem.js", "slashem.wasm",
];

function requireChild(parent, child) {
  const path = relative(parent, child);
  if (!path || path.startsWith("..") || isAbsolute(path)) {
    throw new Error(`Refusing to replace assets outside the generated directory: ${child}`);
  }
}

function rejectLinks(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Asset staging does not follow links: ${path}`);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) rejectLinks(resolve(path, entry));
  }
}

export function stageQuestAssets(root = projectRoot) {
  const resolvedRoot = realpathSync(root);
  const source = resolve(resolvedRoot, "dist-quest");
  const generated = resolve(resolvedRoot, "quest/app/build/generated/gameAssets");
  const target = resolve(generated, "game");
  requireChild(generated, target);

  if (!existsSync(source)) throw new Error("Missing dist-quest. Run npm run build:quest first.");
  rejectLinks(source);
  for (const file of requiredFiles) {
    const location = resolve(source, file);
    if (!existsSync(location) || !lstatSync(location).isFile() || lstatSync(location).size === 0) {
      throw new Error(`Incomplete Quest build: ${file}. Run npm run build:quest first.`);
    }
    const bytes = readFileSync(location);
    if (file.endsWith(".wasm") && !bytes.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) {
      throw new Error(`Invalid WASM asset (possibly a Git LFS pointer): ${file}`);
    }
  }
  const marker = JSON.parse(readFileSync(resolve(source, "quest-build.json"), "utf8"));
  if (marker.target !== "quest-ui-proof" || marker.base !== "/" || marker.entry !== "quest-ui-probe.html") {
    throw new Error("Wrong build target. Run npm run build:quest before staging.");
  }
  for (const entry of ["index.html", "quest-ui-probe.html"]) {
    const html = readFileSync(resolve(source, entry), "utf8");
    for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      const reference = tag[0].match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
      if (!reference) continue;
      const url = new URL(reference, "https://bundle.invalid/");
      if (url.origin !== "https://bundle.invalid") {
        throw new Error(`Quest entry depends on an external resource: ${reference}`);
      }
      const resource = resolve(source, "." + decodeURIComponent(url.pathname));
      requireChild(source, resource);
      if (!existsSync(resource) || !lstatSync(resource).isFile()) {
        throw new Error(`Missing Quest entry resource: ${reference}`);
      }
    }
  }

  // Resolve every existing ancestor before creating or recursively replacing
  // anything; a junction in quest/ must not redirect staging outside this repo.
  let ancestor = generated;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (realpathSync(ancestor) !== resolvedRoot) requireChild(resolvedRoot, realpathSync(ancestor));
  if (existsSync(target)) {
    rejectLinks(target);
    requireChild(generated, realpathSync(target));
  }
  mkdirSync(generated, { recursive: true });
  requireChild(resolvedRoot, realpathSync(generated));
  if (existsSync(target)) rmSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
  return target;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Bundled Quest assets staged at ${stageQuestAssets()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
