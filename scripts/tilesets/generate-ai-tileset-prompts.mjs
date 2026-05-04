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
const NETHACK_5_FINAL_ATLAS_COLUMNS = 40;
const DEFAULT_STYLE_NOTE = [
  "STYLE:",
  'Transformative work: Generate a punchy arcade fantasy roguelike pixel-art tileset in the style of Super Ghouls \'n Ghosts. Small but expressive characters with heavy medium-black outlines. Characters have chunky, exaggerated shapes. Limbs and armor are thick and clearly separated. Silhouettes stay recognizable even at small sizes. This is not delicate or fine-line pixel art. It\'s confident and graphic. It\'s a masterclass in 16-bit gothic horror, blending dark atmosphere with a distinct arcade "chunkiness." It uses a morbid-yet-playful aesthetic that feels like a haunted house come to life. The art has a "cartoonish" exaggeration, heavily inspired by European folklore and 1950s monster movies. Uses multi-tone shading ramps and subtle hue shifting (e.g., dark areas lean cooler, highlights warmer). Texture is implied through shape and shading, not patterns. Materials (metal, cloth, flesh) are differentiated through value and color, not heavy texture.',
  "",
  "Use a consistent three-quarter front view or slight side-facing pose (to the left), with each creature presented as a standalone game tile sprite rather than a dramatic illustration. The lighting should be consistent across the atlas: Highlights hit from upper-left, but no drop shadows. Metallic surfaces have bright, sharp highlights.",
  "",
  "Keep the creatures grounded (no shadow), readable, and game-ready. Avoid oversized cinematic effects. In gendered cases, avoid color swaps and prefer unique art, but don't force differences if it doesn't make sense. Background should be solid black, and no grid lines.",
  "",
  "AVOID: Drop shadows on the ground.",
  "",
].join("\n");

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
    mapOut: null,
    mapOuts: [],
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

    if (arg === "--map-out" && next) {
      options.mapOut = resolve(PROJECT_ROOT, next);
      options.mapOuts.push(options.mapOut);
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
  --map-out <path>        Output JSON compile map path
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

function stripCComments(content) {
  let stripped = "";
  let index = 0;
  let inString = false;
  let inCharacter = false;

  while (index < content.length) {
    const char = content[index];
    const next = content[index + 1];

    if (inString) {
      stripped += char;
      if (char === "\\" && index + 1 < content.length) {
        stripped += content[index + 1];
        index += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (inCharacter) {
      stripped += char;
      if (char === "\\" && index + 1 < content.length) {
        stripped += content[index + 1];
        index += 2;
        continue;
      }
      if (char === "'") {
        inCharacter = false;
      }
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      stripped += char;
      index += 1;
      continue;
    }

    if (char === "'") {
      inCharacter = true;
      stripped += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < content.length && content[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (
        index + 1 < content.length &&
        !(content[index] === "*" && content[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }

    stripped += char;
    index += 1;
  }

  return stripped;
}

function findMatchingParen(content, openParenIndex) {
  let depth = 0;
  let inString = false;
  let inCharacter = false;

  for (let index = openParenIndex; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (char === "\\") {
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (inCharacter) {
      if (char === "\\") {
        index += 1;
      } else if (char === "'") {
        inCharacter = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "'") {
      inCharacter = true;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitTopLevelArguments(content) {
  const args = [];
  let depth = 0;
  let inString = false;
  let inCharacter = false;
  let start = 0;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (char === "\\") {
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (inCharacter) {
      if (char === "\\") {
        index += 1;
      } else if (char === "'") {
        inCharacter = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "'") {
      inCharacter = true;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      continue;
    }
    if (char === "," && depth === 0) {
      args.push(content.slice(start, index).trim());
      start = index + 1;
    }
  }

  args.push(content.slice(start).trim());
  return args;
}

function extractStringLiterals(content) {
  return Array.from(content.matchAll(/"((?:\\.|[^"\\])*)"/g), (match) =>
    match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
  );
}

function normalizeMonsterMetadataName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function resolveMonsterMetadataFile(sourceRoot, tileTextDirectory) {
  const normalizedRoot = resolve(sourceRoot);
  const candidates = [
    resolve(tileTextDirectory, "monsters.h"),
    resolve(normalizedRoot, "monsters.h"),
    resolve(normalizedRoot, "include/monsters.h"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectMonsterMetadata(sourceRoot, tileTextDirectory) {
  const filePath = resolveMonsterMetadataFile(sourceRoot, tileTextDirectory);
  if (!filePath) {
    return {
      byName: new Map(),
      byMonsterPairIndex: [],
    };
  }

  const content = stripCComments(readFileSync(filePath, "utf8"));
  const metadataByName = new Map();
  const metadataByMonsterPairIndex = [];
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const macroIndex = content.indexOf("MON(", searchIndex);
    if (macroIndex < 0) {
      break;
    }

    const openParenIndex = macroIndex + "MON".length;
    const closeParenIndex = findMatchingParen(content, openParenIndex);
    if (closeParenIndex < 0) {
      break;
    }

    const macroBody = content.slice(openParenIndex + 1, closeParenIndex);
    const args = splitTopLevelArguments(macroBody);
    const names = extractStringLiterals(args[0] ?? "");
    if (args.length >= 10 && names.length > 0) {
      const flag2 = args[9] ?? "";
      const gender = flag2.includes("M2_NEUTER")
        ? "neuter"
        : flag2.includes("M2_FEMALE")
          ? "female"
          : flag2.includes("M2_MALE")
            ? "male"
            : "variable";
      const metadata = {
        gender,
        maleName: names[0] ?? "",
        femaleName: names[1] ?? names[0] ?? "",
        neutralName: names[names.length - 1] ?? names[0] ?? "",
      };
      metadataByMonsterPairIndex.push(metadata);

      for (const name of names) {
        metadataByName.set(normalizeMonsterMetadataName(name), metadata);
      }
    }

    searchIndex = closeParenIndex + 1;
  }

  return {
    byName: metadataByName,
    byMonsterPairIndex: metadataByMonsterPairIndex,
  };
}

function chunkEntries(entries, chunkSize) {
  const chunks = [];
  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize));
  }
  return chunks;
}

function isNetHack5Prompt(options) {
  return /\bnethack\s*5(?:\.0)?\b/i.test(String(options.versionLabel || ""));
}

function formatGenderedMonsterName(baseName, gender) {
  return `${baseName}, ${gender}`;
}

function formatRawGenderSpacing(name) {
  return String(name || "").replace(/,\s*(male|female)\b/gi, ", $1");
}

function formatPromptSubjectName(name) {
  return formatRawGenderSpacing(name).replace(/,\s*nogender\b/gi, "");
}

function parseGenderedMonsterTileName(name) {
  const genderedNameMatch = String(name || "").match(
    /^(.*),\s*(male|female)$/i,
  );
  if (!genderedNameMatch) {
    return null;
  }

  return {
    baseName: genderedNameMatch[1].trim(),
    gender: genderedNameMatch[2].toLowerCase(),
  };
}

function formatVariableGenderMonsterSubject(baseName, slotGender, metadata) {
  const genderedSubject =
    slotGender === "female" ? metadata.femaleName : metadata.maleName;
  if (genderedSubject && genderedSubject !== baseName) {
    return `${genderedSubject} (${slotGender} ${baseName})`;
  }

  return formatGenderedMonsterName(baseName, slotGender);
}

function getNetHack5MonsterSlotMetadata(entry, options) {
  if (!isNetHack5Prompt(options) || entry.setLabel !== "monsters") {
    return null;
  }

  const parsedName = parseGenderedMonsterTileName(entry.name);
  if (!parsedName) {
    return null;
  }

  return {
    ...parsedName,
    metadata:
      options.monsterMetadataByMonsterPairIndex?.[
        Math.floor(entry.setIndex / 2)
      ] ??
      options.monsterMetadataByName?.get(
        normalizeMonsterMetadataName(parsedName.baseName),
      ) ??
      null,
  };
}

function isDistinctNetHack5GenderVariant(slotMetadata) {
  return !slotMetadata?.metadata || slotMetadata.metadata.gender === "variable";
}

function formatNetHack5GeneratedMonsterSubject(slotMetadata) {
  if (!slotMetadata) {
    return null;
  }
  if (!isDistinctNetHack5GenderVariant(slotMetadata)) {
    return slotMetadata.baseName;
  }
  if (!slotMetadata.metadata) {
    return formatGenderedMonsterName(
      slotMetadata.baseName,
      slotMetadata.gender,
    );
  }
  return formatVariableGenderMonsterSubject(
    slotMetadata.baseName,
    slotMetadata.gender,
    slotMetadata.metadata,
  );
}

function formatTileSubject(entry, options) {
  if (entry.promptSubject) {
    return entry.promptSubject;
  }

  const slotMetadata = getNetHack5MonsterSlotMetadata(entry, options);
  if (slotMetadata) {
    return (
      formatNetHack5GeneratedMonsterSubject(slotMetadata) ??
      formatPromptSubjectName(entry.name)
    );
  }

  return formatPromptSubjectName(entry.name);
}

function addSourceSlotToGeneratedTile(generatedTile, entry) {
  const sourceSlotIndex = entry.globalIndex - 1;
  if (!generatedTile.sourceSlotIndexes.includes(sourceSlotIndex)) {
    generatedTile.sourceSlotIndexes.push(sourceSlotIndex);
  }
  if (!generatedTile.sourceGlobalIndexes.includes(entry.globalIndex)) {
    generatedTile.sourceGlobalIndexes.push(entry.globalIndex);
  }
  if (!generatedTile.sourceNames.includes(entry.name)) {
    generatedTile.sourceNames.push(entry.name);
  }
}

function createGeneratedTile(entry, subject, generatedTiles, key) {
  const generatedTile = {
    generatedIndex: generatedTiles.length,
    globalIndex: generatedTiles.length + 1,
    key,
    setLabel: entry.setLabel,
    firstSourceGlobalIndex: entry.globalIndex,
    promptSubject: subject,
    sourceSlotIndexes: [],
    sourceGlobalIndexes: [],
    sourceNames: [],
  };
  generatedTiles.push(generatedTile);
  return generatedTile;
}

function createFinalSlot(entry, generatedTile, slotIndex, operation, kind) {
  const sourceName = formatRawGenderSpacing(entry.name);
  return {
    slotIndex,
    kind,
    operation,
    finalName:
      kind === "monster-statue" ? `statue of ${sourceName}` : sourceName,
    sourceSlotIndex: entry.globalIndex - 1,
    sourceGlobalIndex: entry.globalIndex,
    sourceSetLabel: entry.setLabel,
    sourceSetIndex: entry.setIndex,
    sourceName,
    generatedIndex: generatedTile.generatedIndex,
    generatedSubject: generatedTile.promptSubject,
  };
}

function getGenerationKeyAndSubject(entry, options) {
  const slotMetadata = getNetHack5MonsterSlotMetadata(entry, options);
  if (!slotMetadata) {
    return {
      key: `source:${entry.globalIndex}`,
      subject: formatPromptSubjectName(entry.name),
    };
  }

  const monsterPairIndex = Math.floor(entry.setIndex / 2);
  const variantKey = isDistinctNetHack5GenderVariant(slotMetadata)
    ? slotMetadata.gender
    : "shared";

  return {
    key: `nethack5-monster-pair:${monsterPairIndex}:${variantKey}`,
    subject:
      formatNetHack5GeneratedMonsterSubject(slotMetadata) ??
      formatRawGenderSpacing(entry.name),
  };
}

function buildGenerationPlan(entries, options) {
  const generatedTiles = [];
  const generatedTileByKey = new Map();
  const finalSlots = [];
  const sourceSlotByIndex = new Map();

  for (const entry of entries) {
    const { key, subject } = getGenerationKeyAndSubject(entry, options);
    let generatedTile = generatedTileByKey.get(key);
    if (!generatedTile) {
      generatedTile = createGeneratedTile(entry, subject, generatedTiles, key);
      generatedTileByKey.set(key, generatedTile);
    }

    addSourceSlotToGeneratedTile(generatedTile, entry);

    const sourceSlotIndex = entry.globalIndex - 1;
    const finalSlot = createFinalSlot(
      entry,
      generatedTile,
      sourceSlotIndex,
      "copy",
      "source",
    );
    finalSlots.push(finalSlot);
    sourceSlotByIndex.set(sourceSlotIndex, finalSlot);
  }

  if (isNetHack5Prompt(options)) {
    const statueSlotStart = entries.length;
    const visibleMonsterEntries = entries.filter(
      (entry) =>
        entry.setLabel === "monsters" &&
        parseGenderedMonsterTileName(entry.name) !== null,
    );

    for (const entry of visibleMonsterEntries) {
      const sourceSlotIndex = entry.globalIndex - 1;
      const sourceSlot = sourceSlotByIndex.get(sourceSlotIndex);
      if (!sourceSlot) {
        continue;
      }

      finalSlots.push(
        createFinalSlot(
          entry,
          generatedTiles[sourceSlot.generatedIndex],
          statueSlotStart + sourceSlotIndex,
          "stone-statue",
          "monster-statue",
        ),
      );
    }
  }

  finalSlots.sort((left, right) => left.slotIndex - right.slotIndex);

  return {
    sourceEntries: entries,
    generatedTiles,
    finalSlots,
    deduplicatedSourceSlotCount: entries.length - generatedTiles.length,
  };
}

function formatPrompt(batchEntries, options, totalCells) {
  const sheetWidth = options.columns * options.tileSize;
  const sheetHeight = options.rows * options.tileSize;
  const lines = [
    `Create a tileset atlas as a single image with a uniform grid of ${options.columns} columns by ${options.rows} rows (${totalCells} tiles total).`,
    `Each tile cell is exactly ${options.tileSize}x${options.tileSize} pixels, so the full sheet is ${sheetWidth}x${sheetHeight} pixels.`,
    options.styleNote,
    "Follow the exact tile order below from left to right, top to bottom. Use the tile names as the subjects.",
    "",
    "Tile order:",
    ...batchEntries.map(
      (entry, index) => `${index + 1}. ${formatTileSubject(entry, options)}`,
    ),
  ];

  const emptyCellCount = totalCells - batchEntries.length;
  if (emptyCellCount > 0) {
    lines.push(
      `Leave the remaining ${emptyCellCount} cells blank or transparent.`,
    );
  }

  return lines.join("\n");
}

function buildMarkdown(plan, options, tileTextDirectory) {
  const totalCells = options.columns * options.rows;
  const batches = chunkEntries(plan.generatedTiles, totalCells);
  const countsBySet = TILE_SOURCES.map((source) => {
    const sourceCount = plan.sourceEntries.filter(
      (entry) => entry.setLabel === source.label,
    ).length;
    const generatedCount = plan.generatedTiles.filter(
      (entry) => entry.setLabel === source.label,
    ).length;
    return `- ${source.label}: ${generatedCount} generated from ${sourceCount} source slots`;
  }).join("\n");

  const sections = batches.map((batchEntries, batchIndex) => {
    const firstGeneratedIndex = batchEntries[0].generatedIndex + 1;
    const lastGeneratedIndex =
      batchEntries[batchEntries.length - 1].generatedIndex + 1;
    const prompt = formatPrompt(batchEntries, options, totalCells);
    return [
      `## Tileset batch ${String(batchIndex + 1).padStart(2, "0")} (${firstGeneratedIndex}-${lastGeneratedIndex})`,
      "",
      prompt,
    ].join("\n");
  });

  return `# ${options.versionLabel} AI Tileset Prompts

Auto-generated by \`scripts/tilesets/generate-ai-tileset-prompts.mjs\`.

- Source root: \`${tileTextDirectory}\`
- Source tile slots: ${plan.sourceEntries.length}
- Generated tiles: ${plan.generatedTiles.length}
- Reused source slots: ${plan.deduplicatedSourceSlotCount}
- Final compile slots: ${plan.finalSlots.length}
- Sheets required: ${batches.length}
- Grid: ${options.columns} columns x ${options.rows} rows
- Tile size: ${options.tileSize}x${options.tileSize}
${options.mapOut ? `- Compile map: \`${options.mapOut}\`\n` : ""}

Tile counts by source file:
${countsBySet}

Each prompt covers one ${totalCells}-tile sheet.

${sections.join("\n\n")}
`;
}

function addSheetPlacementToGeneratedTile(generatedTile, options) {
  const sheetTileCount = options.columns * options.rows;
  const sheetTileIndex = generatedTile.generatedIndex % sheetTileCount;
  return {
    generatedIndex: generatedTile.generatedIndex,
    subject: generatedTile.promptSubject,
    setLabel: generatedTile.setLabel,
    firstSourceGlobalIndex: generatedTile.firstSourceGlobalIndex,
    sourceSlotIndexes: generatedTile.sourceSlotIndexes,
    sourceGlobalIndexes: generatedTile.sourceGlobalIndexes,
    sourceNames: generatedTile.sourceNames.map(formatRawGenderSpacing),
    sheetIndex: Math.floor(generatedTile.generatedIndex / sheetTileCount),
    sheetTileIndex,
    sheetColumn: sheetTileIndex % options.columns,
    sheetRow: Math.floor(sheetTileIndex / options.columns),
  };
}

function buildCompileMap(plan, options, tileTextDirectory) {
  const sheetTileCount = options.columns * options.rows;
  const finalColumns = isNetHack5Prompt(options)
    ? NETHACK_5_FINAL_ATLAS_COLUMNS
    : options.columns;
  const usedSlotCount =
    plan.finalSlots.length > 0
      ? Math.max(...plan.finalSlots.map((slot) => slot.slotIndex)) + 1
      : 0;
  const finalRows = Math.ceil(usedSlotCount / finalColumns);

  return {
    schemaVersion: 1,
    versionLabel: options.versionLabel,
    sourceRoot: tileTextDirectory,
    sourceTileCount: plan.sourceEntries.length,
    generatedTileCount: plan.generatedTiles.length,
    deduplicatedSourceSlotCount: plan.deduplicatedSourceSlotCount,
    promptSheets: {
      columns: options.columns,
      rows: options.rows,
      tileSize: options.tileSize,
      tileCount: sheetTileCount,
      sheetCount: Math.ceil(plan.generatedTiles.length / sheetTileCount),
    },
    finalAtlas: {
      columns: finalColumns,
      rows: finalRows,
      tileSize: options.tileSize,
      usedSlotCount,
      tileCount: finalColumns * finalRows,
    },
    generationPolicy: isNetHack5Prompt(options)
      ? {
          gender:
            "Generate both male/female only for variable-gender monsters; fixed male, fixed female, and neuter slots reuse one generated tile.",
          statues:
            "Final NetHack 5 monster statue slots are compiled from generated monster tiles.",
        }
      : null,
    generatedTiles: plan.generatedTiles.map((generatedTile) =>
      addSheetPlacementToGeneratedTile(generatedTile, options),
    ),
    finalSlots: plan.finalSlots.map((slot) => ({
      ...slot,
      finalColumn: slot.slotIndex % finalColumns,
      finalRow: Math.floor(slot.slotIndex / finalColumns),
    })),
  };
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
  const monsterMetadata = collectMonsterMetadata(
    rawOptions.sourceRoot,
    tileTextDirectory,
  );
  if (isNetHack5Prompt(rawOptions) && monsterMetadata.byName.size === 0) {
    throw new Error(
      "NetHack 5 prompt generation requires monsters.h so fixed-gender and neuter monster tile slots can be described accurately.",
    );
  }
  const options = {
    ...rawOptions,
    monsterMetadataByName: monsterMetadata.byName,
    monsterMetadataByMonsterPairIndex: monsterMetadata.byMonsterPairIndex,
  };
  const plan = buildGenerationPlan(entries, options);
  const markdown = buildMarkdown(plan, options, tileTextDirectory);

  mkdirSync(dirname(rawOptions.out), { recursive: true });
  writeFileSync(rawOptions.out, markdown, "utf8");
  if (rawOptions.mapOuts.length > 0) {
    const compileMap = buildCompileMap(plan, options, tileTextDirectory);
    for (const mapOut of rawOptions.mapOuts) {
      mkdirSync(dirname(mapOut), { recursive: true });
      writeFileSync(mapOut, `${JSON.stringify(compileMap, null, 2)}\n`, "utf8");
    }
  }

  console.log(
    `Wrote ${plan.generatedTiles.length} generated tiles across ${Math.ceil(
      plan.generatedTiles.length / (rawOptions.columns * rawOptions.rows),
    )} prompt sheets to ${rawOptions.out}`,
  );
  for (const mapOut of rawOptions.mapOuts) {
    console.log(`Wrote compile map to ${mapOut}`);
  }
}

generateAiTilesetPrompts();
