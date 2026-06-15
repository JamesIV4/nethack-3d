import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getAllTiles } from "./tile-parser.mjs";

export const GLYPH_CATALOG_VERSIONS = /** @type {const} */ ([
  "3.6.7",
  "5.0",
  "slashem",
  "evilhack",
]);

const CATALOG_TARGETS = [
  {
    version: "3.6.7",
    publicJsPath: "public/nethack-367.js",
    publicWasmPath: "public/nethack-367.wasm",
    generatedCatalogPath: "src/game/glyphs/glyph-catalog.367.generated.ts",
  },
  {
    version: "5.0",
    publicJsPath: "public/nethack-5.js",
    publicWasmPath: "public/nethack-5.wasm",
    generatedCatalogPath: "src/game/glyphs/glyph-catalog.5.generated.ts",
  },
  {
    version: "slashem",
    publicJsPath: "public/slashem.js",
    publicWasmPath: "public/slashem.wasm",
    generatedCatalogPath: "src/game/glyphs/glyph-catalog.slashem.generated.ts",
  },
  {
    version: "evilhack",
    publicJsPath: "public/evilhack.js",
    publicWasmPath: "public/evilhack.wasm",
    generatedCatalogPath: "src/game/glyphs/glyph-catalog.evilhack.generated.ts",
  },
];

/**
 * @typedef {(
 *  "mon" | "pet" | "peaceful" | "invis" | "detect" | "body" | "ridden" | "obj" | "cmap" |
 *  "explode" | "zap" | "swallow" | "warning" | "statue" | "unexplored" | "nothing"
 * )} GlyphKind
 */

/**
 * @typedef {{
 *   key: string;
 *   kind: GlyphKind;
 *   start: number;
 *   endExclusive: number;
 * }} GlyphRange
 */

/**
 * @typedef {{
 *   glyph: number;
 *   kind: GlyphKind;
 *   ch: number;
 *   asciiChar: string | null;
 *   color: number;
 *   tileIndex: number;
 *
 *   special?: number;
 *   ttychar?: number;
 *   framecolor?: number;
 *   glyphflags?: number;
 *   symidx?: number;
 *   customcolor?: number;
 *   color256idx?: number;
 *   tileidx?: number;
 *   x?: number;
 *   y?: number;
 *   mgflags?: number;
 * }} GlyphEntry
 */

const KNOWN_GLYPH_KINDS = new Set([
  "mon",
  "pet",
  "peaceful",
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
  "unexplored",
  "nothing",
]);

const SAFE_NAME = "GlyphCatalog";

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function glyphKindFromOffsetKey(key) {
  const rawKind = key
    .replace(/^GLYPH_/, "")
    .replace(/_OFF$/, "")
    .toLowerCase();
  if (!KNOWN_GLYPH_KINDS.has(rawKind)) {
    throw new Error(`Unsupported glyph kind '${rawKind}' from key '${key}'`);
  }
  return /** @type {GlyphKind} */ (rawKind);
}

function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeCodePoint(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.trunc(Number(value));
  if (normalized < 0 || normalized > 0x10ffff) {
    return null;
  }
  return normalized;
}

function codePointToDebugChar(value) {
  const normalized = normalizeCodePoint(value);
  if (normalized === null || normalized === 0) {
    return null;
  }
  return String.fromCodePoint(normalized);
}

function resolveGlyphAsciiChar(info, version) {
  if (version === "5.0") {
    return (
      codePointToDebugChar(info?.ttychar) ?? codePointToDebugChar(info?.ch)
    );
  }
  return codePointToDebugChar(info?.ch) ?? codePointToDebugChar(info?.ttychar);
}

function createRuntimeCallback() {
  // Intentionally synchronous: _main() will throw at the ASYNCIFY boundary,
  // but js_helpers_init / js_constants_init / js_globals_init have already run
  // by that point, giving us access to mapglyphHelper and glyph constants.
  return function glyphCatalogCallback(name) {
    switch (name) {
      case "shim_get_nh_event":
      case "shim_nhgetch":
      case "shim_nh_poskey":
      case "shim_yn_function":
        return 27;
      case "shim_select_menu":
        return 0;
      case "shim_getmsghistory":
        return "";
      case "shim_askname":
      case "shim_getlin":
        return SAFE_NAME;
      case "shim_create_nhwindow":
        return 1;
      default:
        return 0;
    }
  };
}

/**
 * @param {string} projectRoot
 * @param {{ version: "3.6.7" | "5.0" | "slashem" | "evilhack"; publicJsPath: string; publicWasmPath: string }} target
 */
async function bootCatalogRuntime(projectRoot, target) {
  const jsPath = path.join(projectRoot, target.publicJsPath);
  const wasmPath = path.join(projectRoot, target.publicWasmPath);
  const wasmBinary = await fs.readFile(wasmPath);

  const { default: factory } = await import(pathToFileURL(jsPath).href);
  if (typeof factory !== "function") {
    throw new Error(`NetHack factory not found in ${target.publicJsPath}`);
  }

  delete globalThis.nethackGlobal;

  globalThis.nethackCallback = createRuntimeCallback();

  /** @type {any} */
  const Module = await factory({
    noInitialRun: true,
    wasmBinary,
    locateFile: (assetPath) => assetPath,
    print: target.version === "evilhack" ? console.log : () => {},
    printErr: target.version === "evilhack" ? console.warn : () => {},
    preRun: [
      (mod) => {
        mod.ENV = mod.ENV || {};
        const opts = `autoquiver,name:${SAFE_NAME},map_mode:tiles`;
        mod.ENV.NETHACKOPTIONS = opts;
        // EvilHack reads EVILHACKOPTIONS / HACKOPTIONS, not NETHACKOPTIONS.
        mod.ENV.EVILHACKOPTIONS = opts;
        mod.ENV.HACKOPTIONS = opts;
        // Without HACKDIR / NETHACKDIR, evilhack's main() tries to chdir to
        // the compiled-in default (/usr/games/lib/evilhackdir) and abort()s
        // before nh_wasm_init runs.
        mod.ENV.HACKDIR = "/";
        mod.ENV.NETHACKDIR = "/";
      },
    ],
  });

  const setCallback = Module.cwrap("shim_graphics_set_callback", null, [
    "string",
  ]);
  setCallback("nethackCallback");

  // Start main() — with a synchronous callback, _main() will throw at the first
  // ASYNCIFY boundary. By then, js_helpers_init / js_constants_init / js_globals_init
  // have already run, giving us access to mapglyphHelper and glyph constants.
  try {
    Module._main(0, 0);
  } catch {
    // Expected: ASYNCIFY requires async callbacks, but we only need the
    // initialization that runs before the first async suspension point.
  }

  // EvilHack defers nh_wasm_init() until shim_init_nhwindows, which fires
  // *after* the first ASYNCIFY boundary. Since _main() suspends before that,
  // helpers/constants are never registered. Force-call the exported init
  // function directly — it's idempotent and only touches JS state.
  if (target.version === "evilhack" && typeof Module._nh_wasm_init === "function") {
    try {
      Module._nh_wasm_init();
    } catch (err) {
      console.warn("nh_wasm_init() failed:", err?.message || err);
    }
  }

  const helpers = globalThis.nethackGlobal?.helpers;
  const hasRequiredHelpers =
    target.version === "5.0"
      ? typeof helpers?.mapGlyphInfoHelper === "function"
      : typeof helpers?.mapglyphHelper === "function" &&
        typeof helpers?.tileIndexForGlyph === "function";

  if (!globalThis.nethackGlobal || !hasRequiredHelpers)
    if (
      !globalThis.nethackGlobal ||
      !globalThis.nethackGlobal.constants?.GLYPH ||
      !hasRequiredHelpers
    ) {
      throw new Error(
        `Runtime did not expose required glyph constants/helpers for ${target.version} after _main()`,
      );
    }

  return {
    nethackGlobal: globalThis.nethackGlobal,
    wasmBinary,
  };
}

/**
 * @param {Record<string, number>} glyphConstants
 */
function deriveGlyphRanges(glyphConstants) {
  const maxGlyph = normalizeNumber(glyphConstants.MAX_GLYPH, 0);
  const offsetEntries = Object.entries(glyphConstants)
    .filter(
      ([key, value]) =>
        /^GLYPH_[A-Z_]+_OFF$/.test(key) && Number.isFinite(value),
    )
    .map(([key, value]) => ({ key, start: Number(value) }))
    .sort((a, b) => a.start - b.start);

  if (offsetEntries.length === 0) {
    throw new Error("No GLYPH_*_OFF constants found in runtime");
  }

  /** @type {GlyphRange[]} */
  const ranges = [];
  for (let index = 0; index < offsetEntries.length; index++) {
    const current = offsetEntries[index];
    const nextStart =
      index + 1 < offsetEntries.length
        ? offsetEntries[index + 1].start
        : maxGlyph;
    ranges.push({
      key: current.key,
      kind: glyphKindFromOffsetKey(current.key),
      start: current.start,
      endExclusive: nextStart,
    });
  }

  return { maxGlyph, ranges };
}

/**
 * @param {GlyphRange[]} ranges
 * @param {number} glyph
 */
function glyphKindForGlyph(ranges, glyph) {
  for (const range of ranges) {
    if (glyph >= range.start && glyph < range.endExclusive) {
      return range.kind;
    }
  }
  throw new Error(`No glyph kind range found for glyph ${glyph}`);
}

/**
 * @param {{
 *   mapglyphHelper?: (glyph: number, x: number, y: number, mgflags: number) => any,
 *   mapGlyphInfoHelper?: (glyph: number, x: number, y: number, mgflags: number) => any
 * }} helpers
 * @param {"3.6.7" | "5.0" | "slashem" | "evilhack"} version
 * @param {GlyphRange[]} ranges
 * @param {number} maxGlyph
 */
function buildGlyphEntries(
  helpers,
  version,
  ranges,
  maxGlyph,
  tiles,
  offsets,
  counts,
) {
  /** @type {GlyphEntry[]} */
  const entries = [];
  const MG_FLAG_NORMAL = 0x00;

  for (let glyph = 0; glyph < maxGlyph; glyph++) {
    const info =
      version === "5.0"
        ? helpers.mapGlyphInfoHelper?.(glyph, 0, 0, MG_FLAG_NORMAL)
        : helpers.mapglyphHelper?.(glyph, 0, 0, 0);

    const kind = glyphKindForGlyph(ranges, glyph);
    let tileIndex = -1;

    /** @type {GlyphEntry} */
    const entry = {
      glyph,
      kind: kind,
      ch: normalizeNumber(info?.ch, 0),
      asciiChar: resolveGlyphAsciiChar(info, version),
      color: normalizeNumber(info?.color, 0),
      tileIndex: tileIndex,
    };

    if (version === "5.0") {
      entry.ttychar = normalizeNumber(info?.ttychar);
      entry.framecolor = normalizeNumber(info?.framecolor);
      entry.glyphflags = normalizeNumber(info?.glyphflags);
      entry.symidx = normalizeNumber(info?.symidx);
      entry.customcolor = normalizeNumber(info?.customcolor);
      entry.color256idx = normalizeNumber(info?.color256idx);
      entry.tileIndex = normalizeNumber(info?.tileidx);
      entry.x = normalizeNumber(info?.x);
      entry.y = normalizeNumber(info?.y);
      entry.mgflags = normalizeNumber(info?.mgflags);
    } else {
      entry.special = normalizeNumber(info?.special, 0);
      entry.mgflags = normalizeNumber(info?.mgflags);
      entry.tileIndex = helpers.tileIndexForGlyph(glyph);
    }

    entries.push(entry);
  }
  return entries;
}

/**
 * @param {GlyphEntry} entry
 */
function renderEntry(entry) {
  const simpleFields = [
    `glyph: ${entry.glyph}`,
    `kind: "${entry.kind}"`,
    `ch: ${entry.ch}`,
    `asciiChar: ${entry.asciiChar === null ? "null" : JSON.stringify(entry.asciiChar)}`,
    `color: ${entry.color}`,
    `tileIndex: ${entry.tileIndex}`,
  ];

  /** @type {Record<string, number | undefined>} */
  const optionalFields = {
    special: entry.special,
    ttychar: entry.ttychar,
    framecolor: entry.framecolor,
    glyphflags: entry.glyphflags,
    symidx: entry.symidx,
    customcolor: entry.customcolor,
    color256idx: entry.color256idx,
    tileidx: entry.tileidx,
    x: entry.x,
    y: entry.y,
    mgflags: entry.mgflags,
  };

  const renderedOptionals = Object.entries(optionalFields)
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => `${key}: ${value}`);

  return `  { ${[...simpleFields, ...renderedOptionals].join(", ")} },`;
}

/**
 * @param {{
 *  sourceJsPath: string;
 *  sourceWasmPath: string;
 *  sourceJsSha256: string;
 *  sourceWasmSha256: string;
 *  maxGlyph: number;
 *  noGlyph: number;
 *  ranges: GlyphRange[];
 *  entries: GlyphEntry[];
 * }} model
 */
function renderGlyphCatalogModule(model) {
  const rangeLines = model.ranges.map(
    (range) =>
      `  { key: "${range.key}", kind: "${range.kind}", start: ${range.start}, endExclusive: ${range.endExclusive} },`,
  );

  const entryLines = model.entries.map(renderEntry);

  return `// @ts-nocheck
/* AUTO-GENERATED FILE. DO NOT EDIT. */
/* Run \`npm run glyphs:generate\` to refresh this file. */

import type { GlyphCatalogEntry, GlyphCatalogMeta, GlyphCatalogRange } from "./types";

export const GLYPH_CATALOG_META: GlyphCatalogMeta = {
  sourceJsPath: "${model.sourceJsPath}",
  sourceWasmPath: "${model.sourceWasmPath}",
  sourceJsSha256: "${model.sourceJsSha256}",
  sourceWasmSha256: "${model.sourceWasmSha256}",
  maxGlyph: ${model.maxGlyph},
  noGlyph: ${model.noGlyph},
};

export const GLYPH_CATALOG_RANGES: readonly GlyphCatalogRange[] = [
${rangeLines.join("\n")}
];

export const GLYPH_CATALOG: readonly GlyphCatalogEntry[] = [
${entryLines.join("\n")}
];
`;
}

/**
 * @param {string} projectRoot
 */
export function getGeneratedCatalogPath(projectRoot) {
  const target = CATALOG_TARGETS[0];
  return path.join(projectRoot, target.generatedCatalogPath);
}

/**
 * @param {string} projectRoot
 */
function resolvePublicJsPath(projectRoot, target) {
  return path.join(projectRoot, target.publicJsPath);
}

function normalizeCatalogVersion(version) {
  if (version === "5.0") {
    return "5.0";
  }
  if (version === "slashem") {
    return "slashem";
  }
  if (version === "evilhack") {
    return "evilhack";
  }
  return "3.6.7";
}

function resolveCatalogTarget(version) {
  const normalized = normalizeCatalogVersion(version);
  const target = CATALOG_TARGETS.find((entry) => entry.version === normalized);
  if (!target) {
    throw new Error(`Unsupported glyph catalog version: ${String(version)}`);
  }
  return target;
}

export function getGlyphCatalogTargets() {
  return CATALOG_TARGETS.map((target) => ({ ...target }));
}

export function getGeneratedCatalogPathForVersion(projectRoot, version) {
  const target = resolveCatalogTarget(version);
  return path.join(projectRoot, target.generatedCatalogPath);
}

export async function generateGlyphCatalogSource(
  projectRoot,
  version = "3.6.7",
) {
  const target = resolveCatalogTarget(version);
  const jsPath = resolvePublicJsPath(projectRoot, target);
  const wasmPath = path.join(projectRoot, target.publicWasmPath);

  const [jsBuffer, runtimeInfo] = await Promise.all([
    fs.readFile(jsPath),
    bootCatalogRuntime(projectRoot, target),
  ]);

  const { nethackGlobal, wasmBinary } = runtimeInfo;
  const { tiles, counts } = await getAllTiles(projectRoot);

  const glyphConstants = nethackGlobal.constants?.GLYPH;
  if (!glyphConstants) {
    throw new Error("Runtime did not expose required glyph constants");
  }

  const noGlyph = normalizeNumber(
    glyphConstants.NO_GLYPH,
    normalizeNumber(glyphConstants.MAX_GLYPH, 0),
  );
  const { maxGlyph, ranges } = deriveGlyphRanges(glyphConstants);
  const offsets = {
    mon: glyphConstants.GLYPH_MON_OFF,
    obj: glyphConstants.GLYPH_OBJ_OFF,
    other: glyphConstants.GLYPH_CMAP_OFF, // Assuming 'other.txt' maps to cmap
    pet: glyphConstants.GLYPH_PET_OFF,
    detect: glyphConstants.GLYPH_DETECT_OFF,
    ridden: glyphConstants.GLYPH_RIDDEN_OFF,
    invis: glyphConstants.GLYPH_INVIS_OFF,
    body: glyphConstants.GLYPH_BODY_OFF,
    other: glyphConstants.GLYPH_CMAP_OFF,
    statue: glyphConstants.GLYPH_STATUE_OFF,
    warning: glyphConstants.GLYPH_WARNING_OFF,
  };
  const entries = buildGlyphEntries(
    nethackGlobal.helpers,
    target.version,
    ranges,
    maxGlyph,
    tiles,
    offsets,
    counts,
  );

  return renderGlyphCatalogModule({
    sourceJsPath: toPosixPath(target.publicJsPath),
    sourceWasmPath: toPosixPath(target.publicWasmPath),
    sourceJsSha256: hashBuffer(jsBuffer),
    sourceWasmSha256: hashBuffer(wasmBinary),
    maxGlyph,
    noGlyph,
    ranges,
    entries,
  });
}

export function resolveProjectRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}
