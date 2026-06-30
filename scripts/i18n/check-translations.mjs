import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const showAll = process.argv.includes("--verbose");
const maxItemsPerCategory = showAll ? Number.POSITIVE_INFINITY : 80;
const cp1252CodePointToByte = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);
const mojibakeLeadCodePoints = new Set([
  0x00c2, 0x00c3, 0x00e2, 0x00e3, 0x00e4, 0x00e5, 0x00e6, 0x00e7, 0x00e8,
  0x00e9, 0x00ea, 0x00eb, 0x00ec, 0x00ed, 0x00ee, 0x00ef, 0x00f0, 0x00f1,
  0x00f2, 0x00f3, 0x00f4, 0x00f5, 0x00f6, 0x00f8, 0x00f9, 0x00fa, 0x00fb,
  0x00fc, 0x00fd, 0x00fe, 0x00ff,
]);
const cp1252ContinuationCodePoints = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const localeChecks = [
  {
    locale: "de",
    file: path.join(repoRoot, "src", "i18n", "locales", "de.ts"),
    exportName: "de",
  },
  {
    locale: "es",
    file: path.join(repoRoot, "src", "i18n", "locales", "es.ts"),
    exportName: "esOverrides",
  },
  {
    locale: "fi",
    file: path.join(repoRoot, "src", "i18n", "locales", "fi.ts"),
    exportName: "fi",
  },
  {
    locale: "fr",
    file: path.join(repoRoot, "src", "i18n", "locales", "fr.ts"),
    exportName: "fr",
  },
  {
    locale: "ja",
    file: path.join(repoRoot, "src", "i18n", "locales", "ja.ts"),
    exportName: "ja",
  },
  {
    locale: "ko",
    file: path.join(repoRoot, "src", "i18n", "locales", "ko.ts"),
    exportName: "ko",
  },
  {
    locale: "pt-br",
    file: path.join(repoRoot, "src", "i18n", "locales", "pt-br.ts"),
    exportName: "ptBrOverrides",
  },
  {
    locale: "ru",
    file: path.join(repoRoot, "src", "i18n", "locales", "ru.ts"),
    exportName: "ru",
  },
  {
    locale: "zh-cn",
    file: path.join(repoRoot, "src", "i18n", "locales", "zh-cn.ts"),
    exportName: "zhCnOverrides",
  },
];

const moduleCache = new Map();

function resolveModulePath(request, fromDirectory) {
  const basePath = path.resolve(fromDirectory, request);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
    path.join(basePath, "index.cjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to resolve module '${request}' from '${fromDirectory}'.`,
  );
}

function loadTsModule(modulePath) {
  const resolvedPath = path.resolve(modulePath);
  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath).exports;
  }

  const source = fs.readFileSync(resolvedPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  });

  const module = { exports: {} };
  moduleCache.set(resolvedPath, module);

  const localRequire = (request) => {
    if (request.startsWith(".") || request.startsWith("/")) {
      const dependencyPath = resolveModulePath(
        request,
        path.dirname(resolvedPath),
      );
      return loadTsModule(dependencyPath);
    }
    return require(request);
  };

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: localRequire,
    __dirname: path.dirname(resolvedPath),
    __filename: resolvedPath,
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });

  const script = new vm.Script(transpiled.outputText, {
    filename: resolvedPath,
  });
  script.runInContext(context);
  return module.exports;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValueKind(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function collectLeafPaths(value, prefix) {
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectLeafPaths(child, [...prefix, key]),
    );
  }
  return [prefix.join(".")];
}

function collectIdenticalStringPaths(baseValue, localeValue, prefix, result) {
  if (localeValue === undefined) {
    return;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(localeValue)) {
      return;
    }

    for (const [key, childBaseValue] of Object.entries(baseValue)) {
      collectIdenticalStringPaths(
        childBaseValue,
        localeValue[key],
        [...prefix, key],
        result,
      );
    }
    return;
  }

  if (
    typeof baseValue === "string" &&
    typeof localeValue === "string" &&
    prefix.join(".") !== "meta.locale" &&
    baseValue === localeValue
  ) {
    result.push(prefix.join("."));
  }
}

function compareTrees(baseValue, localeValue, prefix, result) {
  const baseKind = describeValueKind(baseValue);
  const localeKind = describeValueKind(localeValue);
  const keyPath = prefix.join(".");

  if (localeValue === undefined) {
    result.missing.push(...collectLeafPaths(baseValue, prefix));
    return;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(localeValue)) {
      result.mismatchedTypes.push({
        path: keyPath,
        expected: baseKind,
        actual: localeKind,
      });
      return;
    }

    for (const [key, childBaseValue] of Object.entries(baseValue)) {
      compareTrees(childBaseValue, localeValue[key], [...prefix, key], result);
    }

    for (const key of Object.keys(localeValue)) {
      if (!(key in baseValue)) {
        result.extra.push([...prefix, key].join("."));
      }
    }
    return;
  }

  if (baseKind !== localeKind) {
    result.mismatchedTypes.push({
      path: keyPath,
      expected: baseKind,
      actual: localeKind,
    });
    return;
  }

  if (
    typeof baseValue === "function" &&
    typeof localeValue === "function" &&
    baseValue.length !== localeValue.length
  ) {
    result.mismatchedArity.push({
      path: keyPath,
      expected: baseValue.length,
      actual: localeValue.length,
    });
  }
}

function printCategory(title, items, formatter = (item) => item, log = "error") {
  if (items.length === 0) {
    return;
  }

  console[log](`  ${title}: ${items.length}`);
  const visibleItems = items.slice(0, maxItemsPerCategory);
  for (const item of visibleItems) {
    console[log](`    - ${formatter(item)}`);
  }
  if (visibleItems.length < items.length) {
    console[log](`    ... ${items.length - visibleItems.length} more`);
  }
}

function encodeCp1252Bytes(value) {
  const bytes = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const cp1252Byte = cp1252CodePointToByte.get(codePoint);
    if (cp1252Byte === undefined) {
      return null;
    }
    bytes.push(cp1252Byte);
  }
  return Buffer.from(bytes);
}

function countMojibakeSequences(value) {
  const characters = Array.from(value);
  let count = 0;
  for (let index = 0; index < characters.length - 1; index += 1) {
    const currentCodePoint = characters[index].codePointAt(0);
    const nextCodePoint = characters[index + 1].codePointAt(0);
    const isContinuationCodePoint =
      cp1252ContinuationCodePoints.has(nextCodePoint) ||
      (nextCodePoint >= 0x00a0 && nextCodePoint <= 0x00bf);
    if (
      mojibakeLeadCodePoints.has(currentCodePoint) &&
      isContinuationCodePoint
    ) {
      count += 1;
    }
  }
  return count;
}

function mojibakeScore(value) {
  const replacementCharCount = (value.match(/\uFFFD/g) ?? []).length;
  return replacementCharCount * 10 + countMojibakeSequences(value);
}

function tryRepairMojibake(value) {
  let current = value;
  let best = value;
  let bestScore = mojibakeScore(value);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const bytes = encodeCp1252Bytes(current);
    if (!bytes) {
      break;
    }

    const repaired = bytes.toString("utf8");
    if (repaired === current || repaired.includes("\uFFFD")) {
      break;
    }

    const repairedScore = mojibakeScore(repaired);
    if (repairedScore >= bestScore) {
      break;
    }

    best = repaired;
    bestScore = repairedScore;
    current = repaired;
  }

  return best !== value ? { repaired: best, score: bestScore } : null;
}

function previewString(value, maxLength = 120) {
  const serialized = JSON.stringify(value);
  if (!serialized) {
    return String(value);
  }
  if (serialized.length <= maxLength) {
    return serialized;
  }
  return `${serialized.slice(0, maxLength - 3)}...`;
}

function collectMojibakePaths(value, prefix, result) {
  if (value === undefined) {
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectMojibakePaths(child, [...prefix, key], result);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      collectMojibakePaths(child, [...prefix, String(index)], result);
    });
    return;
  }

  if (typeof value !== "string") {
    return;
  }

  const originalScore = mojibakeScore(value);
  const repairAttempt = tryRepairMojibake(value);
  if (originalScore === 0 && !repairAttempt) {
    return;
  }

  if (
    originalScore > 0 ||
    (repairAttempt && repairAttempt.score < originalScore)
  ) {
    result.push({
      path: prefix.join("."),
      value: previewString(value),
      suggestion: repairAttempt ? previewString(repairAttempt.repaired) : null,
    });
  }
}

const { en } = loadTsModule(
  path.join(repoRoot, "src", "i18n", "locales", "en.ts"),
);
const coreModule = loadTsModule(path.join(repoRoot, "src", "i18n", "core.ts"));
let hasFailures = false;

const globalMojibakeFindings = [];
collectMojibakePaths(en, ["en"], globalMojibakeFindings);

if (typeof coreModule.getSupportedLocaleOptions === "function") {
  const supportedLocaleOptions = coreModule.getSupportedLocaleOptions();
  supportedLocaleOptions.forEach((option) => {
    collectMojibakePaths(
      option.label,
      ["core", "supportedLocaleOptions", option.value, "label"],
      globalMojibakeFindings,
    );
  });
}

if (globalMojibakeFindings.length > 0) {
  hasFailures = true;
  console.error("Global i18n strings contain likely mojibake.");
  printCategory(
    "Mojibake candidates",
    globalMojibakeFindings,
    (item) =>
      item.suggestion
        ? `${item.path}: ${item.value} -> ${item.suggestion}`
        : `${item.path}: ${item.value}`,
  );
}

for (const localeCheck of localeChecks) {
  const localeModule = loadTsModule(localeCheck.file);
  const localeValue = localeModule[localeCheck.exportName];

  if (!localeValue) {
    console.error(
      `Translation check failed: export '${localeCheck.exportName}' was not found in ${localeCheck.file}.`,
    );
    process.exitCode = 1;
    hasFailures = true;
    continue;
  }

  const result = {
    missing: [],
    extra: [],
    mismatchedTypes: [],
    mismatchedArity: [],
    identicalStrings: [],
    mojibake: [],
  };

  compareTrees(en, localeValue, [], result);
  collectIdenticalStringPaths(en, localeValue, [], result.identicalStrings);
  collectMojibakePaths(localeValue, [], result.mojibake);

  const issueCount =
    result.missing.length +
    result.extra.length +
    result.mismatchedTypes.length +
    result.mismatchedArity.length +
    result.mojibake.length;

  if (issueCount === 0) {
    if (result.identicalStrings.length === 0) {
      console.log(`Locale '${localeCheck.locale}' is complete.`);
    } else {
      console.warn(
        `Locale '${localeCheck.locale}' is complete with ${result.identicalStrings.length} identical-string warning${result.identicalStrings.length === 1 ? "" : "s"}.`,
      );
      printCategory(
        "Identical to English",
        result.identicalStrings,
        (item) => item,
        "warn",
      );
    }
    continue;
  }

  hasFailures = true;
  console.error(`Locale '${localeCheck.locale}' has translation issues.`);
  printCategory("Missing keys", result.missing);
  printCategory("Extra keys", result.extra);
  printCategory(
    "Type mismatches",
    result.mismatchedTypes,
    (item) => `${item.path} (expected ${item.expected}, got ${item.actual})`,
  );
  printCategory(
    "Function arity mismatches",
    result.mismatchedArity,
    (item) => `${item.path} (expected ${item.expected}, got ${item.actual})`,
  );
  printCategory(
    "Mojibake candidates",
    result.mojibake,
    (item) =>
      item.suggestion
        ? `${item.path}: ${item.value} -> ${item.suggestion}`
        : `${item.path}: ${item.value}`,
  );
  printCategory("Identical to English", result.identicalStrings);
}

if (hasFailures) {
  if (!showAll) {
    console.error("Re-run with --verbose to print every issue.");
  }
  process.exitCode = 1;
} else {
  console.log("All locale overrides are complete.");
}
