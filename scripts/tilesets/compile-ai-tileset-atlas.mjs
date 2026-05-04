import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PNG } from "pngjs";

function parseArgs(argv) {
  const options = {
    map: null,
    out: null,
    sheetDir: null,
    sheets: [],
    statueMode: "stone",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--map" && next) {
      options.map = resolve(next);
      index += 1;
      continue;
    }

    if (arg === "--out" && next) {
      options.out = resolve(next);
      index += 1;
      continue;
    }

    if (arg === "--sheet-dir" && next) {
      options.sheetDir = resolve(next);
      index += 1;
      continue;
    }

    if (arg === "--sheet" && next) {
      options.sheets.push(resolve(next));
      index += 1;
      continue;
    }

    if (arg === "--sheets" && next) {
      options.sheets.push(
        ...next
          .split(",")
          .map((sheetPath) => sheetPath.trim())
          .filter(Boolean)
          .map((sheetPath) => resolve(sheetPath)),
      );
      index += 1;
      continue;
    }

    if (arg === "--statue-mode" && next) {
      if (next !== "stone" && next !== "copy") {
        throw new Error("--statue-mode expects stone or copy");
      }
      options.statueMode = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(`Compile AI prompt sheets into a NetHack tileset atlas.

Usage:
  node scripts/tilesets/compile-ai-tileset-atlas.mjs --map <map.json> --sheet-dir <dir> --out <atlas.png>

Options:
  --map <path>            Compile map from generate-ai-tileset-prompts.mjs
  --sheet-dir <dir>       Directory of generated prompt sheet PNGs, sorted by file name
  --sheet <path>          Prompt sheet PNG path; can be repeated
  --sheets <paths>        Comma-separated prompt sheet PNG paths
  --out <path>            Output atlas PNG path
  --statue-mode <mode>    stone or copy for derived statue slots (default: stone)
  --help                  Show this help text
`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function collectSheetPaths(options) {
  const sheetPaths = [...options.sheets];
  if (options.sheetDir) {
    const directorySheets = readdirSync(options.sheetDir)
      .filter((fileName) => /\.png$/i.test(fileName))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .map((fileName) => join(options.sheetDir, fileName));
    sheetPaths.push(...directorySheets);
  }
  return sheetPaths;
}

function readPng(filePath) {
  return PNG.sync.read(readFileSync(filePath));
}

function getGeneratedTilePlacements(compileMap) {
  const placements = new Map();
  for (const tile of compileMap.generatedTiles ?? []) {
    placements.set(tile.generatedIndex, tile);
  }
  return placements;
}

function getPixelOffset(png, x, y) {
  return (png.width * y + x) * 4;
}

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function writeStonePixel(source, sourceOffset, target, targetOffset) {
  const alpha = source.data[sourceOffset + 3];
  if (alpha === 0) {
    target.data[targetOffset + 3] = 0;
    return;
  }

  const red = source.data[sourceOffset];
  const green = source.data[sourceOffset + 1];
  const blue = source.data[sourceOffset + 2];
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
  target.data[targetOffset] = clampColor(luminance * 0.72 + 42);
  target.data[targetOffset + 1] = clampColor(luminance * 0.76 + 42);
  target.data[targetOffset + 2] = clampColor(luminance * 0.82 + 50);
  target.data[targetOffset + 3] = alpha;
}

function copyPixel(source, sourceOffset, target, targetOffset) {
  target.data[targetOffset] = source.data[sourceOffset];
  target.data[targetOffset + 1] = source.data[sourceOffset + 1];
  target.data[targetOffset + 2] = source.data[sourceOffset + 2];
  target.data[targetOffset + 3] = source.data[sourceOffset + 3];
}

function copyTile({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  tileSize,
  operation,
  statueMode,
}) {
  const writePixel =
    operation === "stone-statue" && statueMode === "stone"
      ? writeStonePixel
      : copyPixel;

  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const sourceOffset = getPixelOffset(source, sourceX + x, sourceY + y);
      const targetOffset = getPixelOffset(target, targetX + x, targetY + y);
      writePixel(source, sourceOffset, target, targetOffset);
    }
  }
}

function validateCompileInputs(compileMap, sheetPaths) {
  const requiredSheetCount = Math.max(
    0,
    ...compileMap.generatedTiles.map((tile) => tile.sheetIndex + 1),
  );
  if (sheetPaths.length < requiredSheetCount) {
    throw new Error(
      `Compile map expects ${requiredSheetCount} prompt sheets, but only ${sheetPaths.length} were provided.`,
    );
  }

  for (const sheetPath of sheetPaths.slice(0, requiredSheetCount)) {
    if (!existsSync(sheetPath)) {
      throw new Error(`Prompt sheet not found: ${sheetPath}`);
    }
  }

  return requiredSheetCount;
}

function compileAtlas(options) {
  if (options.help) {
    printUsage();
    return;
  }
  if (!options.map) {
    throw new Error("--map is required");
  }
  if (!options.out) {
    throw new Error("--out is required");
  }

  const compileMap = readJson(options.map);
  const tileSize = compileMap.finalAtlas?.tileSize;
  const finalColumns = compileMap.finalAtlas?.columns;
  const finalRows = compileMap.finalAtlas?.rows;
  const promptColumns = compileMap.promptSheets?.columns;
  const promptRows = compileMap.promptSheets?.rows;
  if (
    !Number.isInteger(tileSize) ||
    !Number.isInteger(finalColumns) ||
    !Number.isInteger(finalRows) ||
    !Number.isInteger(promptColumns) ||
    !Number.isInteger(promptRows)
  ) {
    throw new Error("Compile map is missing atlas or prompt sheet dimensions.");
  }

  const sheetPaths = collectSheetPaths(options);
  const requiredSheetCount = validateCompileInputs(compileMap, sheetPaths);
  const sheets = sheetPaths.slice(0, requiredSheetCount).map(readPng);
  for (const [index, sheet] of sheets.entries()) {
    const expectedWidth = promptColumns * tileSize;
    const expectedHeight = promptRows * tileSize;
    if (sheet.width < expectedWidth || sheet.height < expectedHeight) {
      throw new Error(
        `Prompt sheet ${index + 1} is ${sheet.width}x${sheet.height}, expected at least ${expectedWidth}x${expectedHeight}.`,
      );
    }
  }
  const generatedTilePlacements = getGeneratedTilePlacements(compileMap);
  const atlas = new PNG({
    width: finalColumns * tileSize,
    height: finalRows * tileSize,
  });

  for (const slot of compileMap.finalSlots ?? []) {
    const placement = generatedTilePlacements.get(slot.generatedIndex);
    if (!placement) {
      throw new Error(`No generated tile placement for index ${slot.generatedIndex}`);
    }

    const sheet = sheets[placement.sheetIndex];
    if (!sheet) {
      throw new Error(`Missing prompt sheet ${placement.sheetIndex + 1}`);
    }

    copyTile({
      source: sheet,
      target: atlas,
      sourceX: placement.sheetColumn * tileSize,
      sourceY: placement.sheetRow * tileSize,
      targetX: slot.finalColumn * tileSize,
      targetY: slot.finalRow * tileSize,
      tileSize,
      operation: slot.operation,
      statueMode: options.statueMode,
    });
  }

  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, PNG.sync.write(atlas));
  console.log(`Wrote compiled atlas to ${options.out}`);
}

compileAtlas(parseArgs(process.argv.slice(2)));
