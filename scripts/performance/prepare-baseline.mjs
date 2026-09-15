import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const revision = process.argv[2] || "HEAD";
const sha = execFileSync("git", ["rev-parse", "--verify", `${revision}^{commit}`], { cwd: root, encoding: "utf8" }).trim();
const destination = path.join(root, ".wired-dev/performance");
mkdirSync(destination, { recursive: true });
for (const filename of ["effects/blood-ground.ts", "world/level-terrain-cache.ts"]) {
  const sourcePath = `src/game/engine/${filename}`;
  const source = execFileSync("git", ["show", `${sha}:${sourcePath}`], { cwd: root, encoding: "utf8" });
  // Vite serves these ignored reference copies; all peer imports still resolve
  // to the checkout. No production source or generated WASM artifact is edited.
  const rewritten = source.replace(/from\s+(["'])(\.[^"']+)\1/g, (_match, quote, specifier) =>
    `from ${quote}/${path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier))}${quote}`,
  );
  writeFileSync(path.join(destination, path.basename(filename)), rewritten);
}
writeFileSync(path.join(destination, "revision.json"), JSON.stringify({ revision: sha }));
console.log(`Prepared ${sha} in .wired-dev/performance. Open /scripts/performance/ in the Vite dev server.`);
