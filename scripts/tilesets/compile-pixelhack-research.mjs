import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const reference = join(root, "tools/pixelhack-reference");
const catalog = JSON.parse(readFileSync(join(reference, "catalog.json"), "utf8"));
const knownSubjects = new Set(catalog.tiles.map((tile) => tile.researchKey).filter(Boolean));
const research = { schemaVersion: 1, subjects: {}, tiles: {} };
const packFiles = readdirSync(join(reference, "research-packs"))
  .filter((file) => file.endsWith(".json")).sort();

for (const file of packFiles) {
  const pack = JSON.parse(readFileSync(join(reference, "research-packs", file), "utf8"));
  if (pack.schemaVersion !== 1) throw new Error(`${file}: unsupported schema version`);
  for (const [key, note] of Object.entries(pack.subjects ?? {})) {
    if (!knownSubjects.has(key)) throw new Error(`${file}: unknown research key ${key}`);
    if (research.subjects[key]) throw new Error(`${file}: duplicate research key ${key}`);
    for (const field of ["visualDescription", "wikiDescription", "modelBrief"]) {
      if (!String(note[field] ?? "").trim()) throw new Error(`${file}: ${key} missing ${field}`);
      if (/[A-Za-z0-9]\?[A-Za-z0-9]|\?[A-Z][^?]{1,32}\?/.test(note[field])) {
        throw new Error(`${file}: ${key} ${field} contains a damaged question mark`);
      }
    }
    if (!Array.isArray(note.sources) || !note.sources.some((source) => /^https:\/\//.test(source.url))) {
      throw new Error(`${file}: ${key} needs an HTTPS source URL`);
    }
    research.subjects[key] = note;
  }
  for (const [id, note] of Object.entries(pack.tiles ?? {})) {
    if (!Number.isInteger(Number(id)) || Number(id) < 0 || Number(id) >= catalog.tiles.length) {
      throw new Error(`${file}: unknown tile ${id}`);
    }
    if (research.tiles[id]) throw new Error(`${file}: duplicate tile note ${id}`);
    research.tiles[id] = note;
  }
}

const batchSize = 12;
const batches = [];
for (const category of ["monster", "object"]) {
  const subjects = [];
  const seen = new Set();
  for (const tile of catalog.tiles) {
    if (tile.category !== category || seen.has(tile.researchKey)) continue;
    seen.add(tile.researchKey);
    subjects.push({ researchKey: tile.researchKey, firstTileId: tile.id, label: tile.subject,
      researched: Boolean(research.subjects[tile.researchKey]) });
  }
  for (let start = 0; start < subjects.length; start += batchSize) {
    const number = Math.floor(start / batchSize) + 1;
    batches.push({ id: `${category === "monster" ? "M" : "O"}-${String(number).padStart(3, "0")}`,
      category, subjects: subjects.slice(start, start + batchSize) });
  }
}
const queue = { schemaVersion: 1, batchSize, batches };
const scriptArgs = process.argv.slice(2);
const check = scriptArgs.includes("--check");
if (scriptArgs.some((arg) => arg !== "--check")) throw new Error("Usage: node compile-pixelhack-research.mjs [--check]");
for (const [file, value] of [["research.json", research], ["research-queue.json", queue]]) {
  const text = JSON.stringify(value, null, 2) + "\n";
  const path = join(reference, file);
  if (check) {
    if (readFileSync(path, "utf8") !== text) throw new Error(`${file} is stale`);
  } else {
    writeFileSync(path, text);
  }
}
console.log(`${check ? "Checked" : "Compiled"} ${Object.keys(research.subjects).length} researched subjects across ${batches.length} batches`);
