const runtimeNumberPadCandidatePaths: ReadonlyArray<readonly string[]> = [
  ["iflags", "num_pad"],
  ["iflags", "number_pad"],
  ["flags", "num_pad"],
  ["flags", "number_pad"],
  ["g", "iflags", "num_pad"],
  ["g", "iflags", "number_pad"],
  ["g", "flags", "num_pad"],
  ["g", "flags", "number_pad"],
];

function readNestedValue(root: unknown, path: readonly string[]): unknown {
  let current = root;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function normalizeNumberPadModeValue(
  value: unknown,
): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value) > 0;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "0" ||
    normalized === "-1" ||
    normalized === "false" ||
    normalized === "off"
  ) {
    return false;
  }
  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "on"
  ) {
    return true;
  }
  return null;
}

export function extractRuntimeNumberPadModeEnabled(
  snapshot: unknown,
): boolean | null {
  const globalsRoot = readNestedValue(snapshot, ["nethackGlobal", "globals"]);
  for (const path of runtimeNumberPadCandidatePaths) {
    const normalized = normalizeNumberPadModeValue(
      readNestedValue(globalsRoot, path),
    );
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}
