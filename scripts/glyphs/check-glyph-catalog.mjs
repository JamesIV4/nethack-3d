import fs from "node:fs/promises";
import { generateGlyphCatalogSource, getGeneratedCatalogPath, resolveProjectRoot } from "./catalog-generator.mjs";

function validateGeneratedSource(source) {
  const maxGlyphMatch = source.match(/maxGlyph:\s*(\d+),/);
  if (!maxGlyphMatch) {
    throw new Error("Unable to find maxGlyph in generated catalog");
  }
  const maxGlyph = Number(maxGlyphMatch[1]);

  const entries = [...source.matchAll(/\{\s*glyph:\s*(\d+),\s*kind:\s*"([a-z_]+)"/g)];
  if (entries.length !== maxGlyph) {
    throw new Error(
      `Catalog entry count mismatch: expected ${maxGlyph}, got ${entries.length}`
    );
  }

  const seenKinds = new Set(entries.map((match) => match[2]));
  const expectedKinds = new Set([
    "mon",
    "pet",
    "invis",
    "detect",
    "body",
    "ridden",
    "obj",
    "cmap",
    "explode",
    "zap",
    "swallow",
    "warning",
    "statue",
  ]);
  for (const kind of expectedKinds) {
    if (!seenKinds.has(kind)) {
      throw new Error(`Missing expected glyph kind '${kind}' in catalog`);
    }
  }

  const rangeMatches = [
    ...source.matchAll(
      /\{\s*key:\s*"GLYPH_[A-Z_]+",\s*kind:\s*"[a-z_]+",\s*start:\s*(\d+),\s*endExclusive:\s*(\d+)\s*\}/g
    ),
  ];
  if (!rangeMatches.length) {
    throw new Error("No glyph ranges found in generated catalog");
  }

  let coverage = 0;
  for (const match of rangeMatches) {
    const start = Number(match[1]);
    const endExclusive = Number(match[2]);
    if (endExclusive < start) {
      throw new Error(`Invalid glyph range ${start}..${endExclusive}`);
    }
    coverage += endExclusive - start;
  }
  if (coverage !== maxGlyph) {
    throw new Error(
      `Glyph range coverage mismatch: expected ${maxGlyph}, got ${coverage}`
    );
  }
}

async function main() {
  const projectRoot = resolveProjectRoot();
  const outputPath = getGeneratedCatalogPath(projectRoot);
  const [expectedSource, currentSource] = await Promise.all([
    generateGlyphCatalogSource(projectRoot),
    fs.readFile(outputPath, "utf8"),
  ]);

  if (currentSource !== expectedSource) {
    console.error(
      `Glyph catalog is stale: ${outputPath}\nRun: npm run glyphs:generate`
    );
    process.exit(1);
  }

  validateGeneratedSource(currentSource);
  console.log("Glyph catalog is up to date.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
