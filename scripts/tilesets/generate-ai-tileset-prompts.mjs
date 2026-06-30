import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

const DEFAULT_OUTPUT_PATH = resolve(
  PROJECT_ROOT,
  "docs/nethack-367-ai-tileset-prompts.md",
);
const DEFAULT_SOURCE_ROOT = resolve(PROJECT_ROOT, "imported/nethack-3.6.7");
const DEFAULT_VERSION_LABEL = "NetHack 3.6.7";
const DEFAULT_COLUMNS = 12;
const DEFAULT_ROWS = 8;
const DEFAULT_TILE_SIZE = 128;
const DEFAULT_STYLE_NOTE =
  "Use a consistent fantasy roguelike tileset style across the full sheet. One subject per cell, standing centered and fully contained inside the cell, turning the subject if needed to fit. Only the tiles, no grid lines and no text.";

const TILE_SOURCES = [
  { label: "monsters", fileName: "monsters.txt" },
  { label: "objects", fileName: "objects.txt" },
  { label: "other", fileName: "other.txt" },
];

function parseArgs(argv) {
  const options = {
    columns: DEFAULT_COLUMNS,
    rows: DEFAULT_ROWS,
    tileSize: DEFAULT_TILE_SIZE,
    out: DEFAULT_OUTPUT_PATH,
    sourceRoot: DEFAULT_SOURCE_ROOT,
    versionLabel: DEFAULT_VERSION_LABEL,
    styleNote: DEFAULT_STYLE_NOTE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--columns" && next) {
      options.columns = parsePositiveInteger(next, "--columns");
      index += 1;
      continue;
    }

    if (arg === "--rows" && next) {
      options.rows = parsePositiveInteger(next, "--rows");
      index += 1;
      continue;
    }

    if (arg === "--tile-size" && next) {
      options.tileSize = parsePositiveInteger(next, "--tile-size");
      index += 1;
      continue;
    }

    if (arg === "--out" && next) {
      options.out = resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (arg === "--source-root" && next) {
      options.sourceRoot = next;
      index += 1;
      continue;
    }

    if (arg === "--version-label" && next) {
      options.versionLabel = next;
      index += 1;
      continue;
    }

    if (arg === "--style-note" && next) {
      options.styleNote = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  return options;
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `${flagName} expects a positive integer, received: ${value}`,
    );
  }
  return parsed;
}

function printUsage() {
  console.log(`Generate batched AI tileset prompts from NetHack tile comment files.

Usage:
  node scripts/tilesets/generate-ai-tileset-prompts.mjs [options]

Options:
  --source-root <path>    NetHack source root or tile text directory
  --out <path>            Output markdown path
  --columns <number>      Tile columns per sheet (default: ${DEFAULT_COLUMNS})
  --rows <number>         Tile rows per sheet (default: ${DEFAULT_ROWS})
  --tile-size <number>    Tile width and height in pixels (default: ${DEFAULT_TILE_SIZE})
  --version-label <text>  Version label used in prompts (default: ${DEFAULT_VERSION_LABEL})
  --style-note <text>     Extra style instructions appended to each prompt
  --help                  Show this help text
`);
}

function resolveTileTextDirectory(sourceRoot) {
  const normalizedRoot = resolve(sourceRoot);
  const candidateDirectories = [
    normalizedRoot,
    resolve(normalizedRoot, "win/share"),
  ];

  for (const directory of candidateDirectories) {
    const hasAllFiles = TILE_SOURCES.every((source) =>
      existsSync(resolve(directory, source.fileName)),
    );
    if (hasAllFiles) {
      return directory;
    }
  }

  throw new Error(
    `Could not find monsters.txt, objects.txt, and other.txt under ${sourceRoot}`,
  );
}

function parseTileEntries(filePath, groupLabel, startIndex) {
  const content = readFileSync(filePath, "utf8");
  const matches = Array.from(
    content.matchAll(/^# tile (\d+) \((.*)\)$/gm),
    (match) => ({
      globalIndex: startIndex + 1,
      setLabel: groupLabel,
      setIndex: Number.parseInt(match[1], 10),
      name: match[2],
    }),
  );

  return matches.map((entry, index) => ({
    ...entry,
    globalIndex: startIndex + index + 1,
  }));
}

function collectTileEntries(tileTextDirectory) {
  const entries = [];

  for (const source of TILE_SOURCES) {
    const filePath = resolve(tileTextDirectory, source.fileName);
    const parsedEntries = parseTileEntries(
      filePath,
      source.label,
      entries.length,
    );
    entries.push(...parsedEntries);
  }

  return entries;
}

function chunkEntries(entries, chunkSize) {
  const chunks = [];
  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize));
  }
  return chunks;
}

function formatPrompt(batchEntries, options, totalCells) {
  const sheetWidth = options.columns * options.tileSize;
  const sheetHeight = options.rows * options.tileSize;
  const lines = [
    `Create a ${options.versionLabel} tileset atlas as a single image with a uniform grid of ${options.columns} columns by ${options.rows} rows (${totalCells} tiles total).`,
    `Each tile cell is exactly ${options.tileSize}x${options.tileSize} pixels, so the full sheet is ${sheetWidth}x${sheetHeight} pixels.`,
    options.styleNote,
    "Follow the exact tile order below from left to right, top to bottom. Use the canonical NetHack tile names as the tile subjects.",
    "Tile order:",
    ...batchEntries.map((entry, index) => `${index + 1}. ${entry.name}`),
  ];

  const emptyCellCount = totalCells - batchEntries.length;
  if (emptyCellCount > 0) {
    lines.push(
      `Leave the remaining ${emptyCellCount} cells blank or transparent.`,
    );
  }

  return lines.join("\n");
}

function buildMarkdown(entries, options, tileTextDirectory) {
  const totalCells = options.columns * options.rows;
  const batches = chunkEntries(entries, totalCells);
  const countsBySet = TILE_SOURCES.map((source) => {
    const count = entries.filter(
      (entry) => entry.setLabel === source.label,
    ).length;
    return `- ${source.label}: ${count}`;
  }).join("\n");

  const sections = batches.map((batchEntries, batchIndex) => {
    const firstGlobalIndex = batchEntries[0].globalIndex;
    const lastGlobalIndex = batchEntries[batchEntries.length - 1].globalIndex;
    const prompt = formatPrompt(batchEntries, options, totalCells);
    return [
      `## Prompt ${String(batchIndex + 1).padStart(2, "0")} (${firstGlobalIndex}-${lastGlobalIndex})`,
      "",
      "```text",
      prompt,
      "```",
    ].join("\n");
  });

  return `# ${options.versionLabel} AI Tileset Prompts

Auto-generated by \`scripts/tilesets/generate-ai-tileset-prompts.mjs\`.

- Source root: \`${tileTextDirectory}\`
- Total canonical tiles: ${entries.length}
- Sheets required: ${batches.length}
- Grid: ${options.columns} columns x ${options.rows} rows
- Tile size: ${options.tileSize}x${options.tileSize}

Tile counts by source file:
${countsBySet}

The prompts below preserve the canonical source order across \`monsters.txt\`, \`objects.txt\`, and \`other.txt\`. Each prompt covers one ${totalCells}-tile sheet.

${sections.join("\n\n")}
`;
}

function generateAiTilesetPrompts(
  rawOptions = parseArgs(process.argv.slice(2)),
) {
  if (rawOptions.help) {
    printUsage();
    return;
  }

  const tileTextDirectory = resolveTileTextDirectory(rawOptions.sourceRoot);
  const entries = collectTileEntries(tileTextDirectory);
  const markdown = buildMarkdown(entries, rawOptions, tileTextDirectory);

  mkdirSync(dirname(rawOptions.out), { recursive: true });
  writeFileSync(rawOptions.out, markdown, "utf8");

  console.log(
    `Wrote ${entries.length} tiles across ${Math.ceil(
      entries.length / (rawOptions.columns * rawOptions.rows),
    )} prompt sheets to ${rawOptions.out}`,
  );
}

generateAiTilesetPrompts();
