import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const defaultState = path.join(root, "quest/version-code.local.json");

function readCode(stateFile) {
  if (!existsSync(stateFile)) return 0;
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  if (state.schema !== 1 || !Number.isSafeInteger(state.code) || state.code < 1 || state.code > 2100000000) {
    throw new Error("Invalid Quest version counter: " + stateFile);
  }
  return state.code;
}

export function questAppVersion(version, stateFile = defaultState) {
  const useCounter = version === undefined;
  version ??= JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).version;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new Error("Quest requires a semantic package.json version.");
  const [major, minor, patch] = match.slice(1).map(Number);
  const code = major * 1000000 + minor * 1000 + patch;
  if (minor > 999 || patch > 999 || !Number.isSafeInteger(code) || code < 1 || code > 2100000000) throw new Error("Package version cannot be represented as an Android versionCode.");
  return { name: version, code: useCounter ? Math.max(code, readCode(stateFile)) : code };
}

/** Reserve before building: failed builds consume a code rather than reusing it. */
export function reserveQuestVersion(version, { stateFile = defaultState, override = process.env.NH3D_QUEST_VERSION_CODE } = {}) {
  const base = questAppVersion(version);
  const lock = stateFile + ".lock";
  const handle = openSync(lock, "wx");
  const temporary = stateFile + ".tmp";
  try {
    const previous = Math.max(base.code, readCode(stateFile));
    const code = override === undefined ? previous + 1 : /^\d+$/.test(override) ? Number(override) : NaN;
    if (!Number.isSafeInteger(code) || code <= previous || code > 2100000000) {
      throw new Error(`Quest versionCode must be greater than ${previous} and at most 2100000000.`);
    }
    writeFileSync(temporary, JSON.stringify({ schema: 1, code }, null, 2) + "\n");
    renameSync(temporary, stateFile);
    return { name: base.name, code };
  } finally {
    closeSync(handle);
    unlinkSync(lock);
  }
}
