import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const OUTPUT_FILE = resolve(
  PROJECT_ROOT,
  "src/game/helpers/startup-character-rulesets.generated.ts",
);

const ROLE_SOURCE_TARGETS = [
  {
    version: "3.6.7",
    sourcePath: resolve(PROJECT_ROOT, "imported/role-sources/3.6.7/role.c"),
  },
  {
    version: "5.0",
    sourcePath: resolve(PROJECT_ROOT, "imported/role-sources/5.0/role.c"),
  },
  {
    version: "slashem",
    sourcePath: resolve(PROJECT_ROOT, "imported/role-sources/slashem/role.c"),
  },
];

const GENDER_TOKEN_TO_VALUE = {
  ROLE_MALE: "male",
  ROLE_FEMALE: "female",
};

const ALIGN_TOKEN_TO_VALUE = {
  ROLE_LAWFUL: "lawful",
  ROLE_NEUTRAL: "neutral",
  ROLE_CHAOTIC: "chaotic",
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readRequiredFile(filePath) {
  assert(existsSync(filePath), `Missing required source file: ${filePath}`);
  return readFileSync(filePath, "utf8");
}

function extractSection(source, startPattern, endPatterns, label) {
  const match = source.match(startPattern);
  assert(match?.index != null, `Unable to find ${label} start`);
  const startIndex = match.index + match[0].length;
  const matchingEndIndices = endPatterns
    .map((pattern) => source.indexOf(pattern, startIndex))
    .filter((index) => index >= 0);
  const endIndex = Math.min(...matchingEndIndices);
  assert(Number.isFinite(endIndex), `Unable to find ${label} end`);
  return source.slice(startIndex, endIndex);
}

function splitTopLevelBlocks(source) {
  const blocks = [];
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const previousCharacter = source[index - 1] ?? "";
    if (character === '"' && previousCharacter !== "\\") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (character === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        blocks.push(source.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }
  return blocks;
}

function extractAllowTokens(block, kind, name) {
  const allowMatch = block.match(
    /\b(MH_[A-Z_|\s]+?ROLE_[A-Z_|\s]+?)\s*,/s,
  );
  assert(allowMatch, `Unable to extract allow mask for ${kind} '${name}'`);
  const tokens = allowMatch[1].match(/\b(?:MH|ROLE)_[A-Z_]+\b/g) ?? [];
  const raceTokens = tokens.filter((token) => token.startsWith("MH_"));
  const genderTokens = tokens.filter((token) => token in GENDER_TOKEN_TO_VALUE);
  const alignTokens = tokens.filter((token) => token in ALIGN_TOKEN_TO_VALUE);
  assert(raceTokens.length > 0, `${kind} '${name}' has no race tokens`);
  assert(genderTokens.length > 0, `${kind} '${name}' has no gender tokens`);
  assert(
    alignTokens.length > 0,
    `${kind} '${name}' has no alignment tokens`,
  );
  const unsupportedGenderTokens = tokens.filter(
    (token) => token.startsWith("ROLE_") && token === "ROLE_NEUTER",
  );
  assert(
    unsupportedGenderTokens.length === 0,
    `${kind} '${name}' uses unsupported gender tokens: ${unsupportedGenderTokens.join(", ")}`,
  );
  return {
    raceTokens,
    genders: genderTokens.map((token) => GENDER_TOKEN_TO_VALUE[token]),
    aligns: alignTokens.map((token) => ALIGN_TOKEN_TO_VALUE[token]),
  };
}

function parseRoleEntries(roleSource) {
  const section = extractSection(
    roleSource,
    /const struct Role roles(?:\[[^\]]*\])?\s*=\s*\{/,
    ["/* The player's role", "/* Table of all races */"],
    "role table",
  );
  const blocks = splitTopLevelBlocks(section);
  return blocks
    .filter((block) => !/\{\s*\{\s*0\s*,\s*0\s*\}\s*\}/.test(block))
    .map((block) => {
      const nameMatch = block.match(/^\s*\{\s*\{\s*"([^"]+)"/s);
      assert(nameMatch, `Unable to extract role name from block: ${block.slice(0, 80)}`);
      const name = nameMatch[1];
      return {
        name,
        ...extractAllowTokens(block, "role", name),
      };
    });
}

function parseRaceEntries(roleSource) {
  const section = extractSection(
    roleSource,
    /const struct Race races(?:\[[^\]]*\])?\s*=\s*\{/,
    ["/* The player's race", "/* Table of all genders */"],
    "race table",
  );
  const blocks = splitTopLevelBlocks(section);
  return blocks
    .filter((block) => !/\{\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\}/.test(block))
    .map((block) => {
      const nameMatch = block.match(/^\s*\{\s*"([^"]+)"/s);
      assert(nameMatch, `Unable to extract race name from block: ${block.slice(0, 80)}`);
      const name = nameMatch[1];
      return {
        name,
        ...extractAllowTokens(block, "race", name),
      };
    });
}

function hasIntersection(leftValues, rightValues) {
  const rightValueSet = new Set(rightValues);
  return leftValues.some((value) => rightValueSet.has(value));
}

function pushUnique(target, value) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function createRulesetFromRoleSource(roleSource) {
  const roles = parseRoleEntries(roleSource);
  const races = parseRaceEntries(roleSource);
  const ruleset = {
    roles: roles.map((role) => role.name),
    races: races.map((race) => race.name),
    roleConstraints: Object.fromEntries(
      roles.map((role) => [
        role.name,
        {
          races: races
            .filter(
              (race) =>
                hasIntersection(role.raceTokens, race.raceTokens) &&
                hasIntersection(role.genders, race.genders) &&
                hasIntersection(role.aligns, race.aligns),
            )
            .map((race) => race.name),
          genders: role.genders,
          aligns: role.aligns,
        },
      ]),
    ),
    raceConstraints: Object.fromEntries(
      races.map((race) => [
        race.name,
        {
          genders: race.genders,
          aligns: race.aligns,
        },
      ]),
    ),
  };
  return ruleset;
}

function buildGeneratedSource(allRoleOptions, allRaceOptions, rulesetsByVersion) {
  const sourceListComment = ROLE_SOURCE_TARGETS.map((target) => {
    const relativeSourcePath = relative(PROJECT_ROOT, target.sourcePath).replace(
      new RegExp(`\\${path.sep}`, "g"),
      "/",
    );
    return ` * - ${relativeSourcePath}`;
  }).join("\n");
  return `/* AUTO-GENERATED FILE. DO NOT EDIT.
 *
 * Generated by scripts/game/generate-startup-character-rulesets.mjs
 * Sources:
${sourceListComment}
 */

export const GENERATED_STARTUP_ROLE_OPTIONS = ${JSON.stringify(allRoleOptions, null, 2)} as const;

export const GENERATED_STARTUP_RACE_OPTIONS = ${JSON.stringify(allRaceOptions, null, 2)} as const;

export const GENERATED_STARTUP_CHARACTER_RULESETS = ${JSON.stringify(rulesetsByVersion, null, 2)} as const;
`;
}

export function generateStartupCharacterRulesets({
  check = false,
} = {}) {
  const allRoleOptions = [];
  const allRaceOptions = [];
  const rulesetsByVersion = Object.fromEntries(
    ROLE_SOURCE_TARGETS.map((target) => {
      const roleSource = readRequiredFile(target.sourcePath);
      const ruleset = createRulesetFromRoleSource(roleSource);
      for (const role of ruleset.roles) {
        pushUnique(allRoleOptions, role);
      }
      for (const race of ruleset.races) {
        pushUnique(allRaceOptions, race);
      }
      return [target.version, ruleset];
    }),
  );

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  const nextSource = buildGeneratedSource(
    allRoleOptions,
    allRaceOptions,
    rulesetsByVersion,
  );
  const previousSource = existsSync(OUTPUT_FILE)
    ? readFileSync(OUTPUT_FILE, "utf8")
    : "";
  if (check) {
    assert(
      nextSource === previousSource,
      "Generated startup character rulesets are out of date. Run 'npm run startup:generate-rulesets'.",
    );
    return;
  }
  if (nextSource !== previousSource) {
    writeFileSync(OUTPUT_FILE, nextSource, "utf8");
  }
}

generateStartupCharacterRulesets({
  check: process.argv.includes("--check"),
});
