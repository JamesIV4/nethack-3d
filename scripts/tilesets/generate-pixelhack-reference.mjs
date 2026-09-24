import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultSource = String.raw`\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-5\NetHack\win\share`;
const output = join(root, "tools/pixelhack-reference/catalog.json");
const atlasPath = join(root, "public/assets/5.0/PixelHack.png");
const sources = [
  ["monsters.txt", "monster", 0],
  ["objects.txt", "object", 789],
  ["other.txt", "dungeon", 1272],
];
const args = process.argv.slice(2);
const check = args.includes("--check");
const sourceArg = args.indexOf("--source-dir");
if (args.some((arg, index) => arg !== "--check" && arg !== "--source-dir" && index !== sourceArg + 1)) {
  throw new Error("Usage: node generate-pixelhack-reference.mjs [--source-dir DIR] [--check]");
}
if (sourceArg >= 0 && !args[sourceArg + 1]) throw new Error("--source-dir requires a path");
const sourceDir = sourceArg >= 0 ? resolve(args[sourceArg + 1]) : defaultSource;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

const png = readFileSync(atlasPath);
if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("PixelHack is not a PNG");
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== 1280 || height !== 1856) throw new Error(`Unexpected PixelHack dimensions: ${width}x${height}`);

const tiles = [];
const sourceFiles = [];
for (const [file, category, firstId] of sources) {
  if (tiles.length !== firstId) throw new Error(`${file} starts at ${tiles.length}, expected ${firstId}`);
  const bytes = readFileSync(join(sourceDir, file));
  const text = bytes.toString("utf8");
  const matches = [...text.matchAll(/^# tile (\d+) \((.+)\)\r?$/gm)];
  for (const [index, match] of matches.entries()) {
    const sourceIndex = Number(match[1]);
    if (sourceIndex !== index) throw new Error(`${file}: expected tile ${index}, got ${sourceIndex}`);
    const label = match[2];
    const id = tiles.length;
    const sex = category === "monster" ? label.match(/^(.*),(male|female|nogender)$/) : null;
    const subject = sex ? sex[1] : label;
    tiles.push({ id, category, sourceFile: file, sourceIndex, label, subject,
      ...(sex ? { variant: sex[2] } : {}), researchKey: `${category}:${subject}` });
  }
  sourceFiles.push({ file, count: matches.length, sha256: hash(bytes) });
}
if (tiles.length !== 1515) throw new Error(`Expected 1515 source tiles, got ${tiles.length}`);

// The NetHack 5 glyph catalog supplies the object class symbol for most
// appearance tiles. This is a search hint, not a fixed identified item type.
const objectClassByChar = { ")": "weapon", "[": "armor", "=": "ring", '"': "amulet",
  "(": "tool", "%": "food", "!": "potion", "?": "scroll", "+": "spellbook",
  "/": "wand", "$": "coin", "*": "gem", "`": "rock", "0": "iron ball",
  "_": "iron chain", ".": "venom" };
const shuffledArmorAppearances = new Set([
  "plumed helmet", "etched helmet", "crested helmet", "visored helmet",
  "tattered cape", "ornamental cope", "opera cloak", "piece of cloth",
  "old gloves", "padded gloves", "riding gloves", "fencing gloves",
  "mud boots", "snow boots", "riding boots", "buckled boots",
  "hiking boots", "combat boots", "jungle boots",
]);
const glyphSource = readFileSync(join(root, "src/game/glyphs/glyph-catalog.5.generated.ts"), "utf8");
const classByTile = new Map();
for (const match of glyphSource.matchAll(/\{ glyph: \d+, kind: "obj",[^\n]*?tileIndex: (\d+), ttychar: (\d+),/g)) {
  const tileId = Number(match[1]);
  const classHint = objectClassByChar[String.fromCharCode(Number(match[2]))];
  if (classHint && !classByTile.has(tileId)) classByTile.set(tileId, classHint);
}
const seenObjectResearchKeys = new Set();
for (const tile of tiles.slice(789, 1272)) {
  if (classByTile.has(tile.id)) tile.objectClass = classByTile.get(tile.id);
  // Deferred shimmering dragon armor has source tiles but no live glyph entry.
  if (tile.id === 893 || tile.id === 904) tile.objectClass = "armor";
  const separator = tile.label.indexOf(" / ");
  tile.appearance = separator >= 0 ? tile.label.slice(0, separator) : tile.label;
  if (separator >= 0) tile.sourceAssociation = tile.label.slice(separator + 3);
  const fixedAppearance =
    tile.objectClass === "amulet" && tile.appearance === "Amulet of Yendor" ||
    tile.objectClass === "potion" && tile.sourceAssociation === "water" ||
    tile.objectClass === "scroll" && ["mail", "blank paper"].includes(tile.sourceAssociation) ||
    tile.objectClass === "spellbook" && ["blank paper", "novel", "Book of the Dead"].includes(tile.sourceAssociation);
  const randomizedClass = ["ring", "amulet", "potion", "scroll", "spellbook", "wand"].includes(tile.objectClass);
  if (!tile.label.includes(" / generic ") && !fixedAppearance &&
      (randomizedClass || tile.objectClass === "armor" && shuffledArmorAppearances.has(tile.appearance))) {
    tile.appearanceMayShuffle = true;
  }
  if (seenObjectResearchKeys.has(tile.researchKey)) {
    tile.researchKey += ` [${tile.objectClass ?? `tile ${tile.sourceIndex}`}]`;
  }
  if (seenObjectResearchKeys.has(tile.researchKey)) throw new Error(`Duplicate research key: ${tile.researchKey}`);
  seenObjectResearchKeys.add(tile.researchKey);
}

for (const monster of tiles.slice(0, 789)) {
  tiles.push({ id: tiles.length, category: "statue", sourceFile: "generated", sourceIndex: monster.sourceIndex,
    label: `statue of ${monster.subject}${monster.variant === "nogender" ? "" : ` (${monster.variant})`}`,
    subject: monster.subject, ...(monster.variant ? { variant: monster.variant } : {}),
    baseTileId: monster.id, researchKey: monster.researchKey });
}
if (tiles.length !== 2304) throw new Error(`Expected statue sequence to end at 2304, got ${tiles.length}`);
for (const label of ["invisible statue / background reference", "decal delimiter", "pet marker", "pile marker"]) {
  tiles.push({ id: tiles.length, category: "utility", sourceFile: "generated", sourceIndex: null,
    label, subject: label, researchKey: null });
}
while (tiles.length < 2320) {
  tiles.push({ id: tiles.length, category: "unmapped", sourceFile: "PixelHack only", sourceIndex: null,
    label: "unmapped atlas cell", subject: "unmapped atlas cell", researchKey: null });
}

const catalog = { schemaVersion: 1, atlas: "/assets/5.0/PixelHack.png", atlasSha256: hash(png),
  tileSize: 32, columns: 40, rows: 58, sourceVersion: "NetHack 5.0", sourceFiles, tiles };
const serialized = JSON.stringify(catalog, null, 2) + "\n";
if (check) {
  if (readFileSync(output, "utf8") !== serialized) throw new Error("PixelHack reference catalog is stale");
  console.log("PixelHack reference catalog is current");
} else {
  writeFileSync(output, serialized);
  console.log(`Wrote ${tiles.length} PixelHack cells to ${output}`);
}
