import {
  GENERATED_TILESET_MANIFEST,
  type GeneratedTilesetManifestEntry,
} from "./tilesets.generated";
import type { NethackRuntimeVersion } from "../runtime/types";

export type Nh3dTilesetSource = "builtin" | "user" | "vulture";
export type Nh3dTilesetTileLayoutVersion =
  | "slashem"
  | "3.4.3"
  | "3.6.7"
  | "5.0"
  | "unknown";
export type Nh3dTilesetBackgroundRemovalMode = "none" | "tile" | "solid";

type Nh3dBaseTilesetEntry = Omit<
  GeneratedTilesetManifestEntry,
  "tileLayoutVersion"
> & {
  readonly tileLayoutVersion: Nh3dTilesetTileLayoutVersion;
};

export type Nh3dTilesetEntry = Nh3dBaseTilesetEntry & {
  readonly source: Nh3dTilesetSource;
  readonly assetUrl: string;
};

export type Nh3dUserTilesetRegistration = {
  readonly id: string;
  readonly label: string;
  readonly tileSize: number;
  readonly tileLayoutVersion?: Nh3dTilesetTileLayoutVersion;
  readonly blob: Blob;
};

const fallbackTileSize = 32;
const fallbackBackgroundTileId = 0;
const fallbackBackgroundRemovalMode: Nh3dTilesetBackgroundRemovalMode = "tile";
const fallbackSolidChromaKeyColorHex = "#466d6c";
const fallbackWeaponSpriteFlipX = true;
export const nh3dTilesetAtlasTileColumns = 40;
const builtinSlashEmTilesetPathPrefix = "assets/slashem/";
const builtinNh5TilesetPathPrefix = "assets/5.0/";
const userTilesetPathPrefix = "user:";
const vultureTilesetPathPrefix = "vulture:";
const vultureTilesetLabel = "Vulture (isometric)";
const vultureDefaultDataRoot = "assets/vulture/win/vulture/gamedata";
const vultureNominalTileSize = 112;
const tilesetBackgroundTilePresetByLabel: Readonly<Record<string, number>> = {
  "Absurdly Evil": 869,
  DawnHack: 869,
  Nevanda: 1476,
  "Vanilla NetHack TIles": 1476,
  "Vanilla NetHack Tiles": 1476,
  "NetHack Modern": 850,
};
const tilesetSolidChromaKeyPresetByLabel: Readonly<Record<string, string>> = {
  "Absurdly Evil": "#466d6c",
  DawnHack: "#466d6c",
  Nevanda: "#466d6c",
  "Nevanda (5.0)": "#466d6c",
  "Vanilla NetHack TIles": "#476C6C",
  "Vanilla NetHack Tiles (5.0)": "#466d6c",
  "Vanilla NetHack Tiles": "#476C6C",
  "NetHack Modern": "#000000",
};
const tilesetAtlasTileColumnsPresetByPath: Readonly<Record<string, number>> = {
  "assets/slashem/Abigaba.bmp": 38,
  "assets/slashem/Absurd.png": 38,
};
const tilesetWeaponSpriteFlipXPresetByPath: Readonly<Record<string, boolean>> =
  {};

// Centralized per-tileset defaults. Add entries here to override fallback
// behavior for any specific built-in tileset path.
const tilesetBackgroundRemovalModePresetByPath: Readonly<
  Record<string, Nh3dTilesetBackgroundRemovalMode>
> = {
  "assets/slashem/Absurd.png": "none",
  "assets/5.0/Nevanda (5.0).png": "solid",
  "assets/5.0/Vanilla NetHack Tiles (5.0).png": "solid",
  "assets/3.6/Nevanda.png": "solid",
  "assets/3.6/NetHack Modern.bmp": "solid",
  "assets/3.6/DawnHack.bmp": "tile",
  "assets/3.6/RZTiles.bmp": "tile",
  "assets/3.6/Absurdly Evil.png": "none",
  "assets/3.6/Vanilla NetHack Tiles.png": "solid",
};

function normalizeTilesetPresetLookupLabel(label: string): string {
  return String(label || "")
    .trim()
    .replace(/\s+\((?:\d+\.)*\d+\)\s*$/i, "");
}

function normalizeGeneratedTileLayoutVersion(
  tileLayoutVersion: GeneratedTilesetManifestEntry["tileLayoutVersion"],
): Nh3dTilesetTileLayoutVersion {
  if (tileLayoutVersion === "slashem") {
    return "slashem";
  }
  if (tileLayoutVersion === "5.0") {
    return "5.0";
  }
  if (tileLayoutVersion === "3.4.3") {
    return "3.4.3";
  }
  return "3.6.7";
}

function normalizeUserTilesetTileLayoutVersion(
  tileLayoutVersion: Nh3dTilesetTileLayoutVersion | undefined,
): Nh3dTilesetTileLayoutVersion {
  if (tileLayoutVersion === "slashem") {
    return "slashem";
  }
  if (tileLayoutVersion === "5.0") {
    return "5.0";
  }
  if (tileLayoutVersion === "3.6.7") {
    return "3.6.7";
  }
  if (tileLayoutVersion === "3.4.3") {
    return "3.4.3";
  }
  return "unknown";
}

export function isNh3dTilesetLayoutCompatibleWithRuntime(
  tileLayoutVersion: Nh3dTilesetTileLayoutVersion,
  runtimeVersion: NethackRuntimeVersion,
): boolean {
  if (tileLayoutVersion === "unknown") {
    return true;
  }
  if (tileLayoutVersion === "slashem") {
    return runtimeVersion === "slashem";
  }
  if (tileLayoutVersion === "3.4.3") {
    return runtimeVersion === "slashem";
  }
  if (tileLayoutVersion === "3.6.7") {
    return runtimeVersion === "3.6.7" || runtimeVersion === "5.0";
  }
  return runtimeVersion === "5.0";
}

function isNh3dTilesetCompatibleWithRuntime(
  tileset: Nh3dTilesetEntry,
  runtimeVersion: NethackRuntimeVersion,
): boolean {
  return isNh3dTilesetLayoutCompatibleWithRuntime(
    tileset.tileLayoutVersion,
    runtimeVersion,
  );
}

function findLabelMatchedCompatibleTileset(
  label: string,
  runtimeVersion: NethackRuntimeVersion,
): Nh3dTilesetEntry | null {
  const normalizedLookupLabel = normalizeTilesetPresetLookupLabel(label).toLowerCase();
  return (
    tilesetCatalog.find(
      (entry) =>
        isNh3dTilesetCompatibleWithRuntime(entry, runtimeVersion) &&
        normalizeTilesetPresetLookupLabel(entry.label).toLowerCase() ===
          normalizedLookupLabel,
    ) ?? null
  );
}

function isBuiltinNh5Tileset(tileset: Nh3dTilesetEntry): boolean {
  return (
    tileset.source === "builtin" &&
    String(tileset.path || "").startsWith(builtinNh5TilesetPathPrefix)
  );
}

export function inferNh3dTilesetTileSizeFromAtlasWidth(width: number): number {
  return inferNh3dTilesetTileSizeFromAtlasWidthForPath(width);
}

export function getNh3dTilesetAtlasTileColumns(
  path: string | null | undefined,
): number {
  const normalizedPath = String(path || "").trim();
  const preset =
    tilesetAtlasTileColumnsPresetByPath[normalizedPath] ??
    tilesetAtlasTileColumnsPresetByPath[String(findNh3dTilesetByPath(path)?.path || "").trim()];
  if (typeof preset === "number" && Number.isFinite(preset)) {
    return Math.max(1, Math.trunc(preset));
  }
  return nh3dTilesetAtlasTileColumns;
}

export function inferNh3dTilesetTileSizeFromAtlasWidthForPath(
  width: number,
  path?: string | null,
): number {
  const safeWidth = Math.max(0, Math.trunc(width));
  if (safeWidth <= 0) {
    return fallbackTileSize;
  }
  return Math.max(1, Math.trunc(safeWidth / getNh3dTilesetAtlasTileColumns(path)));
}

function normalizeVultureDataRoot(rawRoot: string): string {
  const normalized = String(rawRoot || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
  return normalized || vultureDefaultDataRoot;
}

export function getNh3dVultureTilesetPath(dataRoot?: string): string {
  return `${vultureTilesetPathPrefix}${normalizeVultureDataRoot(
    String(dataRoot || ""),
  )}`;
}

export function isNh3dVultureTilesetPath(path: string): boolean {
  return String(path || "")
    .trim()
    .startsWith(vultureTilesetPathPrefix);
}

function createDynamicVultureTilesetEntry(path: string): Nh3dTilesetEntry {
  const normalizedPath = String(path || "").trim();
  const rawRoot = normalizedPath.slice(vultureTilesetPathPrefix.length);
  const dataRoot = normalizeVultureDataRoot(rawRoot);
  return {
    path: normalizedPath || getNh3dVultureTilesetPath(dataRoot),
    label: vultureTilesetLabel,
    tileSize: vultureNominalTileSize,
    source: "vulture",
    assetUrl: dataRoot,
    tileLayoutVersion: "3.6.7",
  };
}

const builtinTilesets: Nh3dTilesetEntry[] = [];
const seenPaths = new Set<string>();
for (const rawEntry of GENERATED_TILESET_MANIFEST) {
  const path = String(rawEntry?.path || "").trim();
  const label = String(rawEntry?.label || "").trim();
  const tileSize = Math.max(
    1,
    Math.trunc(
      Number.isFinite(rawEntry?.tileSize) ? rawEntry.tileSize : fallbackTileSize,
    ),
  );
  const tileLayoutVersion = normalizeGeneratedTileLayoutVersion(
    rawEntry?.tileLayoutVersion,
  );
  if (!path || seenPaths.has(path)) {
    continue;
  }
  seenPaths.add(path);
  builtinTilesets.push({
    path,
    label: label || path,
    tileSize,
    source: "builtin",
    assetUrl: path,
    tileLayoutVersion,
  });
}
const builtinVultureTilesetPath = getNh3dVultureTilesetPath(
  vultureDefaultDataRoot,
);
if (!seenPaths.has(builtinVultureTilesetPath)) {
  seenPaths.add(builtinVultureTilesetPath);
  builtinTilesets.push({
    path: builtinVultureTilesetPath,
    label: vultureTilesetLabel,
    tileSize: vultureNominalTileSize,
    source: "vulture",
    assetUrl: vultureDefaultDataRoot,
    tileLayoutVersion: "3.6.7",
  });
}

let userTilesets: Nh3dTilesetEntry[] = [];
let tilesetCatalog: Nh3dTilesetEntry[] = [...builtinTilesets];
let tilesetByPath = new Map(tilesetCatalog.map((entry) => [entry.path, entry]));

function rebuildTilesetCatalog(): void {
  tilesetCatalog = [...builtinTilesets, ...userTilesets];
  tilesetByPath = new Map(tilesetCatalog.map((entry) => [entry.path, entry]));
}

function isLikelyBlobUrl(path: string): boolean {
  return path.startsWith("blob:");
}

function revokeUserTilesetAssetUrls(
  entries: ReadonlyArray<Nh3dTilesetEntry>,
): void {
  for (const entry of entries) {
    if (!isLikelyBlobUrl(entry.assetUrl)) {
      continue;
    }
    try {
      URL.revokeObjectURL(entry.assetUrl);
    } catch {
      // Ignore invalid/expired blob URLs.
    }
  }
}

function ensureUserSuffix(label: string): string {
  const trimmed = String(label || "").trim();
  if (!trimmed) {
    return "User Tileset (user)";
  }
  return /\(user\)$/i.test(trimmed) ? trimmed : `${trimmed} (user)`;
}

export function getNh3dUserTilesetPath(id: string): string {
  return `${userTilesetPathPrefix}${String(id || "").trim()}`;
}

export function isNh3dUserTilesetPath(path: string): boolean {
  return String(path || "")
    .trim()
    .startsWith(userTilesetPathPrefix);
}

export function setNh3dUserTilesets(
  registrations: ReadonlyArray<Nh3dUserTilesetRegistration>,
): void {
  revokeUserTilesetAssetUrls(userTilesets);

  const nextUserTilesets: Nh3dTilesetEntry[] = [];
  const seenUserPaths = new Set<string>();
  for (const registration of registrations) {
    const id = String(registration?.id || "").trim();
    if (!id) {
      continue;
    }
    const path = getNh3dUserTilesetPath(id);
    if (seenUserPaths.has(path)) {
      continue;
    }
    seenUserPaths.add(path);
    const tileSize = Math.max(
      1,
      Math.trunc(
        Number.isFinite(registration?.tileSize) ? registration.tileSize : 32,
      ),
    );
    const label = ensureUserSuffix(registration?.label || path);
    const tileLayoutVersion = normalizeUserTilesetTileLayoutVersion(
      registration?.tileLayoutVersion,
    );
    let assetUrl = "";
    if (
      registration?.blob instanceof Blob &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function"
    ) {
      assetUrl = URL.createObjectURL(registration.blob);
    }
    nextUserTilesets.push({
      path,
      label,
      tileSize,
      source: "user",
      assetUrl,
      tileLayoutVersion,
    });
  }

  userTilesets = nextUserTilesets;
  rebuildTilesetCatalog();
}

export function clearNh3dUserTilesets(): void {
  setNh3dUserTilesets([]);
}

export function getNh3dTilesetCatalog(): ReadonlyArray<Nh3dTilesetEntry> {
  return tilesetCatalog;
}

export function getNh3dCompatibleTilesetCatalog(
  runtimeVersion: NethackRuntimeVersion,
): ReadonlyArray<Nh3dTilesetEntry> {
  return tilesetCatalog.filter((entry) =>
    isNh3dTilesetCompatibleWithRuntime(entry, runtimeVersion),
  );
}

export const nh3dTilesetCatalog: ReadonlyArray<Nh3dTilesetEntry> =
  builtinTilesets;

const preferredDefaultTilesetPath = "assets/3.6/Nevanda 3.6.png";
const preferredDefaultTilesetLabel = "Nevanda";
const preferredDefaultTilesetPathByRuntime: Readonly<
  Partial<Record<NethackRuntimeVersion, string>>
> = {
  slashem: "assets/slashem/Absurd.png",
};
export const defaultNh3dTilesetPath: string =
  builtinTilesets.find((entry) => entry.path === preferredDefaultTilesetPath)
    ?.path ??
  builtinTilesets.find((entry) => entry.label === preferredDefaultTilesetLabel)
    ?.path ??
  builtinTilesets[0]?.path ??
  "";

function getDefaultNh3dTilesetPathForRuntime(
  runtimeVersion: NethackRuntimeVersion,
): string {
  const preferredPath = preferredDefaultTilesetPathByRuntime[runtimeVersion];
  const preferredTileset = preferredPath
    ? builtinTilesets.find((entry) => entry.path === preferredPath)
    : undefined;
  if (
    preferredTileset &&
    isNh3dTilesetCompatibleWithRuntime(preferredTileset, runtimeVersion)
  ) {
    return preferredTileset.path;
  }
  return (
    getNh3dCompatibleTilesetCatalog(runtimeVersion)[0]?.path ??
    defaultNh3dTilesetPath
  );
}

export function findNh3dTilesetByPath(
  path: string | null | undefined,
): Nh3dTilesetEntry | null {
  if (typeof path !== "string") {
    return null;
  }
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return null;
  }
  const fromCatalog = tilesetByPath.get(normalizedPath);
  if (fromCatalog) {
    return fromCatalog;
  }
  if (isNh3dVultureTilesetPath(normalizedPath)) {
    return createDynamicVultureTilesetEntry(normalizedPath);
  }
  return null;
}

export function isNh3dTilesetPathAvailable(
  path: string | null | undefined,
): boolean {
  return findNh3dTilesetByPath(path) !== null;
}

export function getNh3dTilesetTileSize(
  path: string | null | undefined,
): number {
  return findNh3dTilesetByPath(path)?.tileSize ?? fallbackTileSize;
}

export function resolveNh3dTilesetAssetUrl(
  path: string | null | undefined,
): string | null {
  const tileset = findNh3dTilesetByPath(path);
  if (!tileset) {
    return null;
  }
  return String(tileset.assetUrl || "").trim() || null;
}

export function resolveNh3dTilesetTileLayoutVersion(
  path: string | null | undefined,
): Nh3dTilesetTileLayoutVersion {
  return findNh3dTilesetByPath(path)?.tileLayoutVersion ?? "unknown";
}

export function resolveNh3dCompatibleTilesetPathForRuntime(
  path: string | null | undefined,
  runtimeVersion: NethackRuntimeVersion,
): string {
  const selectedTileset = findNh3dTilesetByPath(path);
  if (!selectedTileset) {
    return getDefaultNh3dTilesetPathForRuntime(runtimeVersion);
  }
  if (isNh3dTilesetCompatibleWithRuntime(selectedTileset, runtimeVersion)) {
    return selectedTileset.path;
  }
  const labelMatchedTileset = findLabelMatchedCompatibleTileset(
    selectedTileset.label,
    runtimeVersion,
  );
  if (labelMatchedTileset) {
    return labelMatchedTileset.path;
  }
  return getDefaultNh3dTilesetPathForRuntime(runtimeVersion);
}

export function resolveNh3dFuseBaseTilesetPathForLegacyNh5Runtime(
  path: string | null | undefined,
): string | null {
  const selectedTileset = findNh3dTilesetByPath(path);
  if (!selectedTileset || selectedTileset.tileLayoutVersion !== "3.6.7") {
    return null;
  }
  const selectedLookupLabel = normalizeTilesetPresetLookupLabel(
    selectedTileset.label,
  ).toLowerCase();
  const labelMatchedNh5Tileset = tilesetCatalog.find(
    (entry) =>
      entry.tileLayoutVersion === "5.0" &&
      normalizeTilesetPresetLookupLabel(entry.label).toLowerCase() ===
        selectedLookupLabel,
  );
  if (labelMatchedNh5Tileset) {
    return labelMatchedNh5Tileset.path;
  }
  return null;
}

function normalizeHexColorOrFallback(
  rawValue: unknown,
  fallback: string,
): string {
  const normalized = String(rawValue || "").trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) {
    return fallback;
  }
  return `#${match[1].toLowerCase()}`;
}

export function resolveDefaultNh3dTilesetSolidChromaKeyColorHex(
  path: string | null | undefined,
): string {
  const tileset = findNh3dTilesetByPath(path);
  if (!tileset) {
    return fallbackSolidChromaKeyColorHex;
  }
  const presetLookupLabel = normalizeTilesetPresetLookupLabel(tileset.label);
  const presetByLabel =
    tileset.source === "builtin"
      ? tilesetSolidChromaKeyPresetByLabel[presetLookupLabel] ??
        tilesetSolidChromaKeyPresetByLabel[tileset.label]
      : undefined;
  if (typeof presetByLabel === "string" && presetByLabel.trim()) {
    return normalizeHexColorOrFallback(
      presetByLabel,
      fallbackSolidChromaKeyColorHex,
    );
  }
  return fallbackSolidChromaKeyColorHex;
}

export function resolveDefaultNh3dTilesetBackgroundTileId(
  path: string | null | undefined,
): number {
  const tileset = findNh3dTilesetByPath(path);
  if (!tileset) {
    return fallbackBackgroundTileId;
  }
  const presetLookupLabel = normalizeTilesetPresetLookupLabel(tileset.label);
  const presetByLabel =
    tileset.source === "builtin"
      ? tilesetBackgroundTilePresetByLabel[presetLookupLabel] ??
        tilesetBackgroundTilePresetByLabel[tileset.label]
      : undefined;
  if (typeof presetByLabel === "number" && Number.isFinite(presetByLabel)) {
    return Math.max(0, Math.trunc(presetByLabel));
  }
  return fallbackBackgroundTileId;
}

export function resolveDefaultNh3dTilesetBackgroundRemovalMode(
  path: string | null | undefined,
): Nh3dTilesetBackgroundRemovalMode {
  const tileset = findNh3dTilesetByPath(path);
  if (!tileset || tileset.source !== "builtin") {
    return fallbackBackgroundRemovalMode;
  }
  const preset = tilesetBackgroundRemovalModePresetByPath[tileset.path];
  if (preset === "none" || preset === "solid" || preset === "tile") {
    return preset;
  }
  if (
    tileset.source === "builtin" &&
    String(tileset.path || "").startsWith(builtinSlashEmTilesetPathPrefix)
  ) {
    return "solid";
  }
  if (isBuiltinNh5Tileset(tileset)) {
    return "solid";
  }
  return fallbackBackgroundRemovalMode;
}

export function resolveDefaultNh3dTilesetWeaponSpriteFlipX(
  path: string | null | undefined,
): boolean {
  const tileset = findNh3dTilesetByPath(path);
  if (!tileset) {
    return fallbackWeaponSpriteFlipX;
  }
  const preset = tilesetWeaponSpriteFlipXPresetByPath[tileset.path];
  if (typeof preset === "boolean") {
    return preset;
  }
  return fallbackWeaponSpriteFlipX;
}

export function isNh3dTilesetBackgroundRemovalModeForcedOff(
  path: string | null | undefined,
): boolean {
  return resolveDefaultNh3dTilesetBackgroundRemovalMode(path) === "none";
}
