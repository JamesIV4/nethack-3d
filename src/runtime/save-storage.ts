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
        : runtimeVersion === "evilhack"
          ? "evilhack-092"
          : "wasm-367";
  const rawCompatTag =
    runtimeVersion === "5.0"
      ? import.meta.env.VITE_NH3D_WASM_5_COMPAT_TAG
      : runtimeVersion === "slashem"
        ? import.meta.env.VITE_NH3D_WASM_SLASHEM_COMPAT_TAG
        : runtimeVersion === "evilhack"
          ? import.meta.env.VITE_NH3D_WASM_EVILHACK_COMPAT_TAG
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

type IndexedDbDatabaseListEntry = {
  name?: unknown;
};

export async function resolveRuntimeSaveDbNames(
  runtimeVersion: NethackRuntimeVersion,
): Promise<string[]> {
  const staticNames = getRuntimeSaveDbNames(runtimeVersion);
  const compatTag = getRuntimeSaveCompatTag(runtimeVersion);
  const matchingNames = new Set(staticNames);

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
        if (name === `save-${compatTag}` || name.endsWith(`/save-${compatTag}`)) {
          matchingNames.add(name);
        }
      }
    } catch (error) {
      console.warn("Failed to enumerate IndexedDB save databases:", error);
    }
  }

  return Array.from(matchingNames);
}
