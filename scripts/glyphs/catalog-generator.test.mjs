import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveGlyphRanges } from "./catalog-generator.mjs";

// Small counts make the object, corpse, and male/female statue boundaries
// visible. The ordering matches NetHack 5's include/display.h.
const constants = {
  GLYPH_MON_OFF: 0,
  GLYPH_BODY_OFF: 4,
  GLYPH_RIDDEN_OFF: 6,
  GLYPH_OBJ_OFF: 10,
  GLYPH_CMAP_OFF: 13,
  GLYPH_STATUE_OFF: 14,
  GLYPH_PILETOP_OFF: 18,
  GLYPH_UNEXPLORED_OFF: 27,
  GLYPH_NOTHING_OFF: 28,
  MAX_GLYPH: 29,
};

test("NetHack 5 pile-top glyphs retain object, corpse, and statue kinds", () => {
  const { maxGlyph, ranges } = deriveGlyphRanges(constants);
  const kindAt = (glyph) => ranges.find((r) => glyph >= r.start && glyph < r.endExclusive)?.kind;
  assert.equal(maxGlyph, 29);
  for (const glyph of [18, 19, 20]) assert.equal(kindAt(glyph), "obj");
  for (const glyph of [21, 22]) assert.equal(kindAt(glyph), "body");
  for (const glyph of [23, 24, 25, 26]) assert.equal(kindAt(glyph), "statue");
  assert.equal(kindAt(27), "unexplored");
  assert.equal(kindAt(28), "nothing");
  assert.equal(ranges.reduce((sum, r) => sum + r.endExclusive - r.start, 0), maxGlyph);
  assert.equal(constants.GLYPH_PILETOP_OFF, 18);
});

test("older runtimes keep their existing ranges", () => {
  assert.deepEqual(deriveGlyphRanges({ GLYPH_OBJ_OFF: 0, GLYPH_CMAP_OFF: 3, MAX_GLYPH: 5 }), {
    maxGlyph: 5,
    ranges: [
      { key: "GLYPH_OBJ_OFF", kind: "obj", start: 0, endExclusive: 3 },
      { key: "GLYPH_CMAP_OFF", kind: "cmap", start: 3, endExclusive: 5 },
    ],
  });
});

test("an unexpected pile-top layout fails instead of misclassifying items", () => {
  assert.throws(() => deriveGlyphRanges({ ...constants, GLYPH_UNEXPLORED_OFF: 26 }), /pile-top glyph layout/);
});
