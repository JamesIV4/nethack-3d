import { readFileSync } from "node:fs";

export function questAppVersion(version = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new Error("Quest requires a semantic package.json version.");
  const [major, minor, patch] = match.slice(1).map(Number);
  const code = major * 1000000 + minor * 1000 + patch;
  if (minor > 999 || patch > 999 || !Number.isSafeInteger(code) || code < 1 || code > 2100000000) throw new Error("Package version cannot be represented as an Android versionCode.");
  return { name: version, code };
}
