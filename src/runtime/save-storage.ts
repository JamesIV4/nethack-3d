import type { NethackRuntimeVersion } from "./types";

const knownSaveRuntimeRoots = ["/", "/nethack"] as const;
// NetHack's recover_savefile() expects level-0 checkpoint files to contain
// more than the bare pid lock. A real checkpoint header is significantly
// larger than this; 80 bytes is a conservative lower bound across our wasm
// builds and cleanly excludes plain 4-byte lock files.
export const MIN_RECOVERABLE_CHECKPOINT_LEVEL_ZERO_BYTES = 80;

function normalizeCompatTag(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeRuntimeRoot(root: string): string {
  const slashNormalized = String(root || "/")
    .replace(/\\/g, "/")
    .trim()
    .replace(/\/+$/, "");
  if (!slashNormalized) {
    return "/";
  }
  return slashNormalized.startsWith("/") ? slashNormalized : `/${slashNormalized}`;
}

export function getStoredFileByteLength(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const contents = (value as { contents?: unknown }).contents;
  if (!contents || typeof contents !== "object") {
    return null;
  }

  const rawByteLength =
    typeof (contents as { byteLength?: unknown }).byteLength === "number"
      ? Number((contents as { byteLength: number }).byteLength)
      : typeof (contents as { length?: unknown }).length === "number"
        ? Number((contents as { length: number }).length)
        : null;

  if (rawByteLength === null || !Number.isFinite(rawByteLength) || rawByteLength < 0) {
    return null;
  }

  return Math.trunc(rawByteLength);
}

export function isRecoverableCheckpointLevelZeroByteLength(
  byteLength: number | null | undefined,
): boolean {
  return (
    typeof byteLength === "number" &&
    Number.isFinite(byteLength) &&
    byteLength >= MIN_RECOVERABLE_CHECKPOINT_LEVEL_ZERO_BYTES
  );
}

export function getRuntimeSaveCompatTag(
  runtimeVersion: NethackRuntimeVersion,
): string {
  const fallback =
    runtimeVersion === "5.0"
      ? "wasm-5"
      : runtimeVersion === "slashem"
        ? "slashem-343"
        : "wasm-367";
  const rawCompatTag =
    runtimeVersion === "5.0"
      ? import.meta.env.VITE_NH3D_WASM_5_COMPAT_TAG
      : runtimeVersion === "slashem"
        ? import.meta.env.VITE_NH3D_WASM_SLASHEM_COMPAT_TAG
        : import.meta.env.VITE_NH3D_WASM_367_COMPAT_TAG;
  return normalizeCompatTag(rawCompatTag, fallback);
}

export function getRuntimeSaveMountDir(
  runtimeVersion: NethackRuntimeVersion,
  cwd = "/",
): string {
  void runtimeVersion;
  const normalizedRoot = normalizeRuntimeRoot(cwd);
  const saveLeaf = "save";
  return normalizedRoot === "/"
    ? `/${saveLeaf}`
    : `${normalizedRoot}/${saveLeaf}`;
}

/**
 * Directory that holds checkpoint/autosave level shards for a runtime.
 *
 * Always the dedicated /save IDBFS mount — even for runtimes that enable root
 * persistence — so autosaves round-trip through the proven syncfs path instead
 * of the root-persistence layer (which only owns other top-level game data such
 * as record/xlogfile/bones). This decoupling is the fix for autosaves breaking
 * when 5.0/SlashEm gained root persistence, so keep checkpoints here for every
 * runtime.
 */
export function getRuntimeCheckpointMountDir(
  runtimeVersion: NethackRuntimeVersion,
  cwd = "/",
): string {
  return getRuntimeSaveMountDir(runtimeVersion, cwd);
}

/**
 * True when a bare filename is a NetHack checkpoint/level shard ("<lock>.<n>").
 * These belong to the /save mount and must be excluded from root persistence.
 */
export function isCheckpointLevelFilename(
  filename: string | null | undefined,
): boolean {
  return /^[^/\\]+\.\d+$/.test(String(filename ?? ""));
}

export function getRuntimeSaveDbName(
  runtimeVersion: NethackRuntimeVersion,
  cwd = "/",
): string {
  const normalizedRoot = normalizeRuntimeRoot(cwd);
  const saveLeaf = `save-${getRuntimeSaveCompatTag(runtimeVersion)}`;
  return normalizedRoot === "/"
    ? `/${saveLeaf}`
    : `${normalizedRoot}/${saveLeaf}`;
}

export function getRuntimeSaveDbNames(
  runtimeVersion: NethackRuntimeVersion,
): string[] {
  return Array.from(
    new Set(
      knownSaveRuntimeRoots.map((root) =>
        getRuntimeSaveDbName(runtimeVersion, root),
      ),
    ),
  );
}

export function getRuntimeRootPersistenceDbName(
  runtimeVersion: NethackRuntimeVersion,
): string {
  return `/root-${getRuntimeSaveCompatTag(runtimeVersion)}`;
}

export function supportsRuntimeRootPersistence(
  runtimeVersion: NethackRuntimeVersion,
): boolean {
  return (
    runtimeVersion === "3.6.7" ||
    runtimeVersion === "5.0" ||
    runtimeVersion === "slashem"
  );
}

export function getRuntimeRootPersistenceDbNames(
  runtimeVersion: NethackRuntimeVersion,
): string[] {
  return supportsRuntimeRootPersistence(runtimeVersion)
    ? [getRuntimeRootPersistenceDbName(runtimeVersion)]
    : [];
}

type IndexedDbDatabaseListEntry = {
  name?: unknown;
};

export async function resolveRuntimeSaveDbNames(
  runtimeVersion: NethackRuntimeVersion,
): Promise<string[]> {
  const staticNames = getRuntimeSaveDbNames(runtimeVersion);
  const rootPersistenceNames = getRuntimeRootPersistenceDbNames(runtimeVersion);
  const compatTag = getRuntimeSaveCompatTag(runtimeVersion);
  const matchingNames = new Set([...staticNames, ...rootPersistenceNames]);

  if (
    typeof indexedDB !== "undefined" &&
    typeof (
      indexedDB as IDBFactory & {
        databases?: () => Promise<IndexedDbDatabaseListEntry[]>;
      }
    ).databases === "function"
  ) {
    try {
      const databases = await (
        indexedDB as IDBFactory & {
          databases: () => Promise<IndexedDbDatabaseListEntry[]>;
        }
      ).databases();
      for (const entry of databases) {
        const name =
          typeof entry?.name === "string" ? entry.name.trim() : "";
        if (!name) {
          continue;
        }
        if (
          name === `save-${compatTag}` ||
          name.endsWith(`/save-${compatTag}`) ||
          (supportsRuntimeRootPersistence(runtimeVersion) &&
            (name === `root-${compatTag}` ||
              name.endsWith(`/root-${compatTag}`)))
        ) {
          matchingNames.add(name);
        }
      }
    } catch (error) {
      console.warn("Failed to enumerate IndexedDB save databases:", error);
    }
  }

  return Array.from(matchingNames);
}
