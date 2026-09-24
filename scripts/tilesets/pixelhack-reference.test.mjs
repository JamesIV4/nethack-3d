import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("tools/pixelhack-reference/catalog.json", root), "utf8"));
const artAnalysis = JSON.parse(readFileSync(new URL("tools/pixelhack-reference/art-analysis.json", root), "utf8"));
const research = JSON.parse(readFileSync(new URL("tools/pixelhack-reference/research.json", root), "utf8"));
const queue = JSON.parse(readFileSync(new URL("tools/pixelhack-reference/research-queue.json", root), "utf8"));
const glyphs = readFileSync(new URL("src/game/glyphs/glyph-catalog.5.generated.ts", root), "utf8");

test("PixelHack source order matches atlas and NetHack 5 glyph boundaries", () => {
  assert.equal(catalog.columns, 40);
  assert.equal(catalog.rows, 58);
  assert.equal(catalog.tiles.length, 2320);
  assert.deepEqual(catalog.sourceFiles.map(({ count }) => count), [789, 483, 243]);
  assert.deepEqual([0, 1, 789, 1272, 1515, 2303, 2304, 2305, 2306, 2307].map((id) => catalog.tiles[id].category),
    ["monster", "monster", "object", "dungeon", "statue", "statue", "utility", "utility", "utility", "utility"]);
  assert.equal(catalog.tiles[0].label, "giant ant,male");
  assert.equal(catalog.tiles[1].label, "giant ant,female");
  assert.equal(catalog.tiles[1515].baseTileId, 0);
  assert.equal(catalog.tiles[2303].baseTileId, 788);
  assert.equal(catalog.tiles[1088].objectClass, "potion");
  assert.equal(catalog.tiles[893].objectClass, "armor");
  assert.equal(catalog.tiles[904].objectClass, "armor");
  assert.equal(catalog.tiles[1088].appearance, "ruby");
  assert.equal(catalog.tiles[1088].sourceAssociation, "gain ability");
  assert.equal(catalog.tiles[1088].appearanceMayShuffle, true);
  for (const id of [887, 938, 952, 958, 1112, 1135, 1213]) {
    assert.equal(catalog.tiles[id].appearanceMayShuffle, true, `tile ${id} should be a randomized appearance`);
  }
  for (const id of [912, 1003, 1004, 1113, 1155, 1156, 1198, 1199, 1200]) {
    assert.notEqual(catalog.tiles[id].appearanceMayShuffle, true, `tile ${id} has a fixed appearance`);
  }
  assert.equal(catalog.tiles[1190].researchKey, "object:silver / polymorph");
  assert.equal(catalog.tiles[1213].researchKey, "object:silver / polymorph [wand]");
  for (const [glyph, tileIndex] of [[0, 0], [3448, 789], [3929, 1272], [7226, 1515]]) {
    assert.match(glyphs, new RegExp(`glyph: ${glyph},[^\\n]*tileIndex: ${tileIndex},`));
  }
  assert.ok(catalog.tiles.every((tile, id) => tile.id === id));
});

test("atlas dimensions and header remain compatible with catalog", () => {
  const atlas = readFileSync(new URL("public/assets/5.0/PixelHack.png", root));
  assert.equal(atlas.readUInt32BE(16), catalog.columns * catalog.tileSize);
  assert.equal(atlas.readUInt32BE(20), catalog.rows * catalog.tileSize);
});

test("variant pixel comparisons refer to the current atlas and valid pairs", () => {
  assert.equal(artAnalysis.atlasSha256, catalog.atlasSha256);
  assert.equal(artAnalysis.variantPairs.length, 788);
  assert.equal(artAnalysis.variantPairs[0].maleTileId, 0);
  assert.equal(artAnalysis.variantPairs[0].femaleTileId, 1);
  assert.equal(artAnalysis.variantPairs[0].identicalPixels, true);
  for (const pair of artAnalysis.variantPairs) {
    assert.equal(catalog.tiles[pair.maleTileId].variant, "male");
    assert.equal(catalog.tiles[pair.femaleTileId].variant, "female");
    assert.equal(catalog.tiles[pair.maleTileId].subject, catalog.tiles[pair.femaleTileId].subject);
  }
});

test("research queue covers each item and monster subject once", () => {
  const subjects = queue.batches.flatMap((batch) => batch.subjects);
  const expected = new Set(catalog.tiles.filter((tile) => ["monster", "object"].includes(tile.category)).map((tile) => tile.researchKey));
  assert.equal(queue.batches.length, 74);
  assert.equal(expected.size, 875);
  assert.equal(subjects.length, expected.size);
  assert.equal(new Set(subjects.map((subject) => subject.researchKey)).size, expected.size);
  assert.ok(subjects.every((subject) => expected.has(subject.researchKey)));
  assert.ok(subjects.every((subject) => subject.researched === Boolean(research.subjects[subject.researchKey])));
  assert.ok(subjects.every((subject) => subject.researched), "every monster and object needs a researched brief");
});

test("randomized appearance hints exclude fixed items", () => {
  const ranges = [[886, 889], [937, 940], [950, 953], [957, 963], [964, 991],
    [992, 1002], [1088, 1112], [1114, 1154], [1157, 1197], [1201, 1228]];
  const expected = new Set(ranges.flatMap(([start, end]) =>
    Array.from({ length: end - start + 1 }, (_, index) => start + index)));
  const actual = new Set(catalog.tiles.filter((tile) => tile.appearanceMayShuffle).map((tile) => tile.id));
  assert.deepEqual([...actual].sort((a, b) => a - b), [...expected].sort((a, b) => a - b));
});
