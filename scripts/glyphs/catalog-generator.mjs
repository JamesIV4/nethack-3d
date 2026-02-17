import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyWasm } from "../wasm/copy-wasm.mjs";

const SOURCE_WASM_RELATIVE_PATH = "public/nethack.wasm";
const GENERATED_RELATIVE_PATH = "src/game/glyphs/glyph-catalog.generated.ts";

/**
 * @typedef {(
 *  "mon" | "pet" | "invis" | "detect" | "body" | "ridden" | "obj" | "cmap" |
 *  "explode" | "zap" | "swallow" | "warning" | "statue"
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
 *   color: number;
 *   special: number;
 * }} GlyphEntry
 */

const KNOWN_GLYPH_KINDS = new Set([
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

const SAFE_NAME = "GlyphCatalog";

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function glyphKindFromOffsetKey(key) {
  const rawKind = key.replace(/^GLYPH_/, "").replace(/_OFF$/, "").toLowerCase();
  if (!KNOWN_GLYPH_KINDS.has(rawKind)) {
    throw new Error(`Unsupported glyph kind '${rawKind}' from key '${key}'`);
  }
  return /** @type {GlyphKind} */ (rawKind);
}

function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
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
 */
async function bootCatalogRuntime(projectRoot) {
  copyWasm();
  const wasmPath = path.join(projectRoot, SOURCE_WASM_RELATIVE_PATH);
  const wasmBinary = await fs.readFile(wasmPath);

  const { default: factory } = await import("@neth4ck/wasm-367");
  if (typeof factory !== "function") {
    throw new Error("NetHack factory not found in @neth4ck/wasm-367");
  }

  globalThis.nethackCallback = createRuntimeCallback();

  /** @type {any} */
  const Module = await factory({
    noInitialRun: true,
    wasmBinary,
    locateFile: (assetPath) => assetPath,
    print: () => {},
    printErr: () => {},
    preRun: [
      (mod) => {
        mod.ENV = mod.ENV || {};
        mod.ENV.NETHACKOPTIONS = `autoquiver,name:${SAFE_NAME}`;
      },
    ],
  });

  const setCallback = Module.cwrap("shim_graphics_set_callback", null, ["string"]);
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

  if (
    !globalThis.nethackGlobal ||
    !globalThis.nethackGlobal.constants?.GLYPH ||
    typeof globalThis.nethackGlobal.helpers?.mapglyphHelper !== "function"
  ) {
    throw new Error("Runtime did not expose required glyph constants/helpers after _main()");
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
      ([key, value]) => /^GLYPH_[A-Z_]+_OFF$/.test(key) && Number.isFinite(value)
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
      index + 1 < offsetEntries.length ? offsetEntries[index + 1].start : maxGlyph;
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
 * @param {{ mapglyphHelper: (glyph: number, x: number, y: number, mgflags: number) => any }} helpers
 * @param {GlyphRange[]} ranges
 * @param {number} maxGlyph
 */
function buildGlyphEntries(helpers, ranges, maxGlyph) {
  /** @type {GlyphEntry[]} */
  const entries = [];
  for (let glyph = 0; glyph < maxGlyph; glyph++) {
    const info = helpers.mapglyphHelper(glyph, 0, 0, 0);
    entries.push({
      glyph,
      kind: glyphKindForGlyph(ranges, glyph),
      ch: normalizeNumber(info?.ch, 0),
      color: normalizeNumber(info?.color, 0),
      special: normalizeNumber(info?.special, 0),
    });
  }
  return entries;
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
      `  { key: "${range.key}", kind: "${range.kind}", start: ${range.start}, endExclusive: ${range.endExclusive} },`
  );

  const entryLines = model.entries.map(
    (entry) =>
      `  { glyph: ${entry.glyph}, kind: "${entry.kind}", ch: ${entry.ch}, color: ${entry.color}, special: ${entry.special} },`
  );

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
  return path.join(projectRoot, GENERATED_RELATIVE_PATH);
}

/**
 * @param {string} projectRoot
 */
function resolvePackageJsPath(projectRoot) {
  const candidate = path.join(projectRoot, "node_modules/@neth4ck/wasm-367/build/nethack.js");
  return candidate;
}

export async function generateGlyphCatalogSource(projectRoot) {
  const jsPath = resolvePackageJsPath(projectRoot);
  const wasmPath = path.join(projectRoot, SOURCE_WASM_RELATIVE_PATH);

  const [jsBuffer, runtimeInfo] = await Promise.all([
    fs.readFile(jsPath),
    bootCatalogRuntime(projectRoot),
  ]);

  const { nethackGlobal, wasmBinary } = runtimeInfo;
  const glyphConstants = nethackGlobal.constants?.GLYPH;
  const mapglyphHelper = nethackGlobal.helpers?.mapglyphHelper;

  if (!glyphConstants || typeof mapglyphHelper !== "function") {
    throw new Error("Runtime did not expose required glyph constants/helpers");
  }

  const noGlyph = normalizeNumber(glyphConstants.NO_GLYPH, normalizeNumber(glyphConstants.MAX_GLYPH, 0));
  const { maxGlyph, ranges } = deriveGlyphRanges(glyphConstants);
  const entries = buildGlyphEntries(nethackGlobal.helpers, ranges, maxGlyph);

  return renderGlyphCatalogModule({
    sourceJsPath: "@neth4ck/wasm-367/build/nethack.js",
    sourceWasmPath: toPosixPath(SOURCE_WASM_RELATIVE_PATH),
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
