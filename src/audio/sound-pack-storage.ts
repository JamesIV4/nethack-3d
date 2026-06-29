import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { getTranslationStrings } from "../i18n/core";

export type Nh3dMessageLogKeyword = string | RegExp;

type Nh3dSoundEffectDefinitionShape = {
  key: string;
  label: string;
  messageLogKeywords?: readonly Nh3dMessageLogKeyword[];
};
const soundEffectStrings = getTranslationStrings().soundEffects.byKey;

export const nh3dSoundEffectDefinitions = [
  { key: "player-walk", label: soundEffectStrings["player-walk"] },
  { key: "hit", label: soundEffectStrings.hit },
  { key: "monster-killed", label: soundEffectStrings["monster-killed"] },
  {
    key: "monster-killed-other",
    label: soundEffectStrings["monster-killed-other"],
  },
  // { key: "player-hurt", label: "Player hurt" },
  {
    key: "missed-attack",
    label: soundEffectStrings["missed-attack"],
    messageLogKeywords: [/\bmiss\b/i, /\bmisses\b/i, /\balmost hit\b/i],
  },
  {
    key: "thrown-weapon",
    label: soundEffectStrings["thrown-weapon"],
    messageLogKeywords: [/\bthrow\b/i, /\bthrows\b/i],
  },
  {
    key: "door-opens",
    label: soundEffectStrings["door-opens"],
    messageLogKeywords: ["The door opens."],
  },
  {
    key: "door-closes",
    label: soundEffectStrings["door-closes"],
    messageLogKeywords: ["The door closes."],
  },
  {
    key: "door-kick",
    label: soundEffectStrings["door-kick"],
    messageLogKeywords: ["WHAMMM!!!", "Whammm!!", "Thwack!!"],
  },
  {
    key: "door-smash",
    label: soundEffectStrings["door-smash"],
    messageLogKeywords: [
      "As you kick the door, it crashes open!",
      "As you kick the door, it shatters to pieces!",
    ],
  },
  {
    key: "door-resists",
    label: soundEffectStrings["door-resists"],
    messageLogKeywords: ["The door resists!"],
  },
  {
    key: "door-distant",
    label: soundEffectStrings["door-distant"],
    messageLogKeywords: ["hear a door"],
  },
  {
    key: "walk-down-stairs",
    label: soundEffectStrings["walk-down-stairs"],
    messageLogKeywords: ["You descend the stairs."],
  },
  {
    key: "walk-up-stairs",
    label: soundEffectStrings["walk-up-stairs"],
    messageLogKeywords: ["You climb up the stairs."],
  },
  // {
  //   key: "explosion",
  //   label: "Explosion",
  //   messageLogKeywords: [/\bexplod(?:e|es|ed|ing)\b/i],
  // },
  // {
  //   key: "wand-casting",
  //   label: "Wand casting",
  //   messageLogKeywords: [/^\s*you (?:zap|wave)\b/i],
  // },
  // {
  //   key: "wand-fizzle",
  //   label: "Wand fizzle",
  //   messageLogKeywords: ["nothing happens", /\bfizzle(?:s|d)?\b/i],
  // },
  // {
  //   key: "thrown-weapons",
  //   label: "Thrown weapons",
  //   messageLogKeywords: [/^\s*you (?:throw|toss|hurl)\b/i],
  // },
  // {
  //   key: "arrow-impact",
  //   label: "Arrow impact",
  //   messageLogKeywords: [/\barrow\b.*\b(?:hit|hits|miss|misses|strikes?)\b/i],
  // },
  {
    key: "eating",
    label: soundEffectStrings.eating,
    messageLogKeywords: [
      "you eat",
      "you finish eating",
      "tastes",
      "delicious",
      "yummy",
    ],
  },
  {
    key: "drink",
    label: soundEffectStrings.drink,
  },
  {
    key: "quaff-potion",
    label: soundEffectStrings["quaff-potion"],
  },
  {
    key: "pickup-gold",
    label: soundEffectStrings["pickup-gold"],
    messageLogKeywords: ["$ - "],
  },
  {
    key: "pickup-item",
    label: soundEffectStrings["pickup-item"],
    messageLogKeywords: [/[a-z] - /i],
  },
  {
    key: "find-hidden",
    label: soundEffectStrings["find-hidden"],
    messageLogKeywords: ["find a hidden"],
  },
  {
    key: "level-up",
    label: soundEffectStrings["level-up"],
    messageLogKeywords: ["Welcome to experience level"],
  },
  {
    key: "unlock",
    label: soundEffectStrings.unlock,
    messageLogKeywords: ["unlock"],
  },
  {
    key: "boulder-push",
    label: soundEffectStrings["boulder-push"],
    messageLogKeywords: ["With great effort you move the"],
  },
  {
    key: "boulder-blocked",
    label: soundEffectStrings["boulder-blocked"],
    messageLogKeywords: [", but in vain."],
  },
  // {
  //   key: "potion-shattering",
  //   label: "Potion shattering",
  //   messageLogKeywords: [/\bpotion\b.*\b(?:shatter|smash|crash|break)\w*\b/i],
  // },
  // { key: "scroll-reading-good", label: "Scroll reading (good)" },
  // { key: "scroll-reading-bad", label: "Scroll reading (bad)" },
  // {
  //   key: "scroll-reading-neutral",
  //   label: "Scroll reading (neutral)",
  //   messageLogKeywords: [/\byou read (?:the )?scroll\b/i],
  // },
  {
    key: "splash",
    label: soundEffectStrings.splash,
    messageLogKeywords: ["splashing of a naiad"],
  },
  {
    key: "searching",
    label: soundEffectStrings.searching,
    messageLogKeywords: [
      /\byou find\b.*\b(?:hidden|secret|trap|door)\b/i,
      /\byou pick up\b.*\bgold\b/i,
    ],
  },
  {
    key: "magic-cast",
    label: soundEffectStrings["magic-cast"],
    messageLogKeywords: ["you cast"],
  },
  {
    key: "magic-heal",
    label: soundEffectStrings["magic-heal"],
    messageLogKeywords: ["you feel better"],
  },
  {
    key: "magic-buff",
    label: soundEffectStrings["magic-buff"],
    messageLogKeywords: [
      /\byou feel (?:stronger|faster|more agile|wiser|tougher|powerful)\b/i,
    ],
  },
] as const satisfies ReadonlyArray<Nh3dSoundEffectDefinitionShape>;

export type Nh3dSoundEffectDefinition =
  (typeof nh3dSoundEffectDefinitions)[number];
export type Nh3dSoundEffectKey = Nh3dSoundEffectDefinition["key"];
export type Nh3dSoundEntrySource = "builtin" | "user";
export const nh3dBaseSoundVariationId = "__base__";

// --- Ambient music / audioscapes -------------------------------------------
// One looping ambient track per dungeon "level type" (branch), matching the
// runtime branch-detection tags produced by the engine. Tracks support the
// same variation system as sound effects, plus optional gating by dungeon
// depth range, Amulet of Yendor possession, and player experience level so the
// music can escalate as the run gets harder.
type Nh3dAmbientTrackDefinitionShape = {
  key: string;
  label: string;
  branchTags: readonly string[];
};
const ambientTrackStrings = getTranslationStrings().ambientTracks.byKey;

export const nh3dAmbientTrackDefinitions = [
  {
    key: "dungeons_of_doom",
    label: ambientTrackStrings.dungeons_of_doom,
    branchTags: ["dungeons_of_doom"],
  },
  { key: "mines", label: ambientTrackStrings.mines, branchTags: ["mines"] },
  {
    key: "sokoban",
    label: ambientTrackStrings.sokoban,
    branchTags: ["sokoban"],
  },
  { key: "quest", label: ambientTrackStrings.quest, branchTags: ["quest"] },
  {
    key: "vlads_tower",
    label: ambientTrackStrings.vlads_tower,
    branchTags: ["vlads_tower"],
  },
  {
    key: "endgame",
    label: ambientTrackStrings.endgame,
    branchTags: ["endgame"],
  },
] as const satisfies ReadonlyArray<Nh3dAmbientTrackDefinitionShape>;

export type Nh3dAmbientTrackDefinition =
  (typeof nh3dAmbientTrackDefinitions)[number];
export type Nh3dAmbientTrackKey = Nh3dAmbientTrackDefinition["key"];
export const nh3dDefaultAmbientTrackKey: Nh3dAmbientTrackKey =
  "dungeons_of_doom";

export type Nh3dAmbientAmuletCondition = "any" | "carried" | "not-carried";

export type Nh3dAmbientCondition = {
  depthMin: number | null;
  depthMax: number | null;
  playerLevelMin: number | null;
  playerLevelMax: number | null;
  amulet: Nh3dAmbientAmuletCondition;
};

export type Nh3dAmbientPlaybackContext = {
  depth: number | null;
  playerLevel: number | null;
  hasAmulet: boolean;
};

export function createNh3dDefaultAmbientCondition(): Nh3dAmbientCondition {
  return {
    depthMin: null,
    depthMax: null,
    playerLevelMin: null,
    playerLevelMax: null,
    amulet: "any",
  };
}

export function resolveNh3dAmbientTrackKeyForBranch(
  branchTag: string | null | undefined,
): Nh3dAmbientTrackKey {
  const normalized = String(branchTag ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (normalized) {
    for (const definition of nh3dAmbientTrackDefinitions) {
      if (definition.branchTags.some((tag) => tag === normalized)) {
        return definition.key;
      }
    }
  }
  return nh3dDefaultAmbientTrackKey;
}

export function doesNh3dAmbientConditionMatch(
  condition: Nh3dAmbientCondition,
  context: Nh3dAmbientPlaybackContext,
): boolean {
  const depth = context.depth;
  if (condition.depthMin !== null && (depth === null || depth < condition.depthMin)) {
    return false;
  }
  if (condition.depthMax !== null && (depth === null || depth > condition.depthMax)) {
    return false;
  }
  const level = context.playerLevel;
  if (
    condition.playerLevelMin !== null &&
    (level === null || level < condition.playerLevelMin)
  ) {
    return false;
  }
  if (
    condition.playerLevelMax !== null &&
    (level === null || level > condition.playerLevelMax)
  ) {
    return false;
  }
  if (condition.amulet === "carried" && !context.hasAmulet) {
    return false;
  }
  if (condition.amulet === "not-carried" && context.hasAmulet) {
    return false;
  }
  return true;
}

type Nh3dAmbientTrackEntryBase = {
  key: Nh3dAmbientTrackKey;
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  source: Nh3dSoundEntrySource;
  attribution: string;
  conditions: Nh3dAmbientCondition;
  // Signed reverb intensity offset (-1..1) for this individual clip/variation.
  reverbOffset: number;
};

export type Nh3dAmbientTrackVariation = Nh3dAmbientTrackEntryBase & {
  id: string;
};

export type Nh3dAmbientTrackAssignment = Nh3dAmbientTrackEntryBase & {
  variations: Nh3dAmbientTrackVariation[];
};

export type Nh3dSoundPackAmbientMap = Record<
  Nh3dAmbientTrackKey,
  Nh3dAmbientTrackAssignment
>;

// --- Reverb & pitch --------------------------------------------------------
// Reverb is expressed as an "intensity" in 0..1 that maps to the wet-send
// level on each playing clip. The effective send for a given clip is:
// clamp01(pack.reverb.intensity + levelTypeOffsets[branch] + clip
// reverbOffset). Offsets are signed (-1..1) per clip so an individual clip can
// pull reverb above or below the global baseline.
//
// Pitch variation is a per-sound-effect-clip randomization range (0..1, where
// 0.1 == +/-10% playback rate), applied through WebAudio playback rate.
export type Nh3dSoundPackReverbSettings = {
  intensity: number;
  levelTypeOffsets: Record<Nh3dAmbientTrackKey, number>;
};

export const nh3dReverbDefaultIntensity = 0;

export function clampNh3dReverbIntensity(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(4))));
}

export function clampNh3dReverbOffset(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(-1, Math.min(1, Number(parsed.toFixed(4))));
}

export function clampNh3dPitchVariation(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(4))));
}

/**
 * Resolve a random playback pitch rate for a clip given its pitch variation
 * range (0..1). 0 means no variation (rate 1). 0.1 yields a rate uniformly in
 * [0.9, 1.1]. Used by both gameplay and previews.
 */
export function resolveNh3dRandomPitchRate(pitchVariation: number): number {
  const range = clampNh3dPitchVariation(pitchVariation, 0);
  if (range <= 0) {
    return 1;
  }
  const delta = (Math.random() * 2 - 1) * range;
  return Math.max(0.05, 1 + delta);
}

function createDefaultReverbLevelOffsets(): Record<Nh3dAmbientTrackKey, number> {
  const offsets = {} as Record<Nh3dAmbientTrackKey, number>;
  for (const definition of nh3dAmbientTrackDefinitions) {
    offsets[definition.key] = 0;
  }
  return offsets;
}

export function createNh3dDefaultReverbSettings(): Nh3dSoundPackReverbSettings {
  return {
    intensity: nh3dReverbDefaultIntensity,
    levelTypeOffsets: createDefaultReverbLevelOffsets(),
  };
}

function normalizeReverbSettings(
  rawValue: unknown,
): Nh3dSoundPackReverbSettings {
  if (!isRecordLike(rawValue)) {
    return createNh3dDefaultReverbSettings();
  }
  const intensity = clampNh3dReverbIntensity(
    rawValue.intensity,
    nh3dReverbDefaultIntensity,
  );
  const rawOffsets = isRecordLike(rawValue.levelTypeOffsets)
    ? rawValue.levelTypeOffsets
    : null;
  const levelTypeOffsets = {} as Record<Nh3dAmbientTrackKey, number>;
  for (const definition of nh3dAmbientTrackDefinitions) {
    levelTypeOffsets[definition.key] = clampNh3dReverbOffset(
      rawOffsets ? rawOffsets[definition.key] : 0,
      0,
    );
  }
  return { intensity, levelTypeOffsets };
}

function cloneReverbSettings(
  reverb: Nh3dSoundPackReverbSettings,
): Nh3dSoundPackReverbSettings {
  return {
    intensity: reverb.intensity,
    levelTypeOffsets: { ...reverb.levelTypeOffsets },
  };
}

/**
 * Effective reverb wet-send level (0..1) for a sound, combining the pack-global
 * reverb intensity, the current level type's offset, and the sound/track's own
 * reverb offset.
 */
export function resolveNh3dReverbSendLevel(
  pack: Nh3dSoundPackRecord | null | undefined,
  levelTypeKey: Nh3dAmbientTrackKey,
  entryReverbOffset: number,
): number {
  if (!pack) {
    return 0;
  }
  const reverb = pack.reverb ?? createNh3dDefaultReverbSettings();
  const base = clampNh3dReverbIntensity(reverb.intensity, 0);
  const levelOffset = clampNh3dReverbOffset(
    reverb.levelTypeOffsets?.[levelTypeKey],
    0,
  );
  const entryOffset = clampNh3dReverbOffset(entryReverbOffset, 0);
  return Math.max(0, Math.min(1, base + levelOffset + entryOffset));
}

type Nh3dSoundEffectEntryBase = {
  key: Nh3dSoundEffectKey;
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  source: Nh3dSoundEntrySource;
  attribution: string;
  // Signed reverb intensity offset (-1..1) for this individual clip/variation.
  reverbOffset: number;
  // Random pitch variation range (0..1, 0.1 == +/-10% rate) for this clip.
  pitchVariation: number;
};

export type Nh3dSoundEffectVariation = Nh3dSoundEffectEntryBase & {
  id: string;
};

export type Nh3dSoundEffectAssignment = Nh3dSoundEffectEntryBase & {
  variations: Nh3dSoundEffectVariation[];
};

export type Nh3dSoundPackSoundMap = Record<
  Nh3dSoundEffectKey,
  Nh3dSoundEffectAssignment
>;

export type Nh3dSoundPackRecord = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  sounds: Nh3dSoundPackSoundMap;
  ambient: Nh3dSoundPackAmbientMap;
  reverb: Nh3dSoundPackReverbSettings;
};

export type Nh3dLoadedSoundPackState = {
  packs: Nh3dSoundPackRecord[];
  activePackId: string;
};

export type Nh3dSoundFileUploadOverrides = Partial<Record<string, Blob | null>>;

type Nh3dStoredSoundFileRecord = {
  path: string;
  packId: string;
  soundKey: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  byteLength: number;
  createdAt: number;
  updatedAt: number;
};

type Nh3dMetaRecord = {
  key: string;
  value: unknown;
  updatedAt: number;
};

type Nh3dSoundPackManifestAmbientEntry = {
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  source: Nh3dSoundEntrySource;
  attribution: string;
  conditions: Nh3dAmbientCondition;
  reverbOffset: number;
  archivePath: string | null;
};

type Nh3dSoundPackManifestSoundEntry = {
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  source: Nh3dSoundEntrySource;
  attribution: string;
  reverbOffset: number;
  pitchVariation: number;
  archivePath: string | null;
};

type Nh3dSoundPackExportManifest = {
  schema: "nh3d-soundpack";
  version: 5;
  exportedAt: string;
  pack: {
    name: string;
    isDefault: boolean;
    reverb: Nh3dSoundPackReverbSettings;
    sounds: Array<
      Nh3dSoundPackManifestSoundEntry & {
        key: Nh3dSoundEffectKey;
        label: string;
        variations: Array<
          Nh3dSoundPackManifestSoundEntry & {
            id: string;
          }
        >;
      }
    >;
    ambient: Array<
      Nh3dSoundPackManifestAmbientEntry & {
        key: Nh3dAmbientTrackKey;
        label: string;
        variations: Array<
          Nh3dSoundPackManifestAmbientEntry & {
            id: string;
          }
        >;
      }
    >;
  };
};

type ParsedImportSoundVariationEntry = {
  id: string;
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  source: Nh3dSoundEntrySource;
  attribution: string;
  reverbOffset: number;
  pitchVariation: number;
  archivePath: string | null;
};

type ParsedImportSoundEntry = {
  key: Nh3dSoundEffectKey;
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  source: Nh3dSoundEntrySource;
  attribution: string;
  reverbOffset: number;
  pitchVariation: number;
  archivePath: string | null;
  variations: ParsedImportSoundVariationEntry[];
};

type ParsedImportAmbientVariationEntry = {
  id: string;
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  attribution: string;
  conditions: Nh3dAmbientCondition;
  reverbOffset: number;
  archivePath: string | null;
};

type ParsedImportAmbientEntry = {
  key: Nh3dAmbientTrackKey;
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  attribution: string;
  conditions: Nh3dAmbientCondition;
  reverbOffset: number;
  archivePath: string | null;
  variations: ParsedImportAmbientVariationEntry[];
};

type RecordLike = Record<string, unknown>;

const dbName = "nh3d-soundpacks";
const dbVersion = 1;
const packStoreName = "sound-packs";
const fileStoreName = "sound-files";
const metaStoreName = "meta";
const activePackMetaKey = "active-sound-pack-id";
const bundledDefaultSoundPackZipRelativePath =
  "soundpacks/Default.soundpack.zip";
const soundPackManifestPath = "manifest.json";

export const nh3dDefaultSoundPackId = "default-sound-pack";
export const nh3dDefaultSoundPackName = "Default";

let bundledDefaultSoundPackImportWarningLogged = false;
let bundledDefaultSoundPackImportAttempted = false;
let bundledDefaultSoundPackImportInFlight: Promise<void> | null = null;

function isRecordLike(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureIndexedDbAvailable(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this browser context.");
  }
}

function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IDB request failed."));
  });
}

function idbTransactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IDB transaction aborted."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  ensureIndexedDbAvailable();
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(packStoreName)) {
        db.createObjectStore(packStoreName, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(fileStoreName)) {
        db.createObjectStore(fileStoreName, { keyPath: "path" });
      }
      if (!db.objectStoreNames.contains(metaStoreName)) {
        db.createObjectStore(metaStoreName, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function resolvePublicAssetUrl(assetRelativePath: string): string {
  const normalizedPath = String(assetRelativePath || "").replace(/^\/+/, "");
  const baseUrl =
    typeof import.meta.env.BASE_URL === "string" &&
    import.meta.env.BASE_URL.trim()
      ? import.meta.env.BASE_URL.trim()
      : "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  if (typeof window === "undefined" || !window.location?.href) {
    return `${normalizedBase}${normalizedPath}`;
  }

  return new URL(
    normalizedPath,
    new URL(normalizedBase, window.location.href),
  ).toString();
}

function normalizeAttribution(value: unknown, fallback = ""): string {
  const normalized = normalizeWhitespace(String(value || ""));
  if (normalized) {
    return normalized;
  }
  return normalizeWhitespace(String(fallback || ""));
}

export function normalizeNh3dSoundPackName(value: string): string {
  return normalizeWhitespace(String(value || ""));
}

function sanitizePathSegment(value: string, fallback: string): string {
  const normalized = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function sanitizeFileName(value: string, fallback: string): string {
  const rawValue = String(value || "").trim();
  const candidate = rawValue || fallback;
  const normalized = candidate
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function resolveDefaultFileName(key: Nh3dSoundEffectKey): string {
  if (key === "player-walk") {
    return "player-footstep.ogg";
  }
  if (key === "monster-killed-other") {
    return "monster-killed.ogg";
  }
  return `${key}.ogg`;
}

export function resolveNh3dDefaultSoundPath(key: Nh3dSoundEffectKey): string {
  return `soundpacks/default/${resolveDefaultFileName(key)}`;
}

// The web build currently ships the default sound pack as a ZIP imported into
// IndexedDB, not as raw public /soundpacks/default/*.ogg files.
const bundledBuiltinSoundPathByKey: Partial<
  Record<Nh3dSoundEffectKey, string>
> = {};

export function resolveNh3dBundledBuiltinSoundPath(
  key: Nh3dSoundEffectKey,
): string | null {
  const configuredPath = bundledBuiltinSoundPathByKey[key];
  if (typeof configuredPath !== "string") {
    return null;
  }
  const normalizedPath = normalizeWhitespace(configuredPath);
  return normalizedPath || null;
}

function normalizeMessageLogText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeMessageLogSearchText(value: string): string {
  return normalizeMessageLogText(value).toLowerCase();
}

function doesMessageLogKeywordMatch(
  keyword: Nh3dMessageLogKeyword,
  message: string,
  normalizedLowerMessage: string,
): boolean {
  if (typeof keyword === "string") {
    const normalizedKeyword = normalizeMessageLogSearchText(keyword);
    if (!normalizedKeyword) {
      return false;
    }
    return normalizedLowerMessage.includes(normalizedKeyword);
  }

  keyword.lastIndex = 0;
  const matched = keyword.test(message);
  keyword.lastIndex = 0;
  return matched;
}

export function resolveNh3dMessageLogSoundEffectKeys(
  messageLike: unknown,
): Nh3dSoundEffectKey[] {
  if (typeof messageLike !== "string") {
    return [];
  }

  const normalizedMessage = normalizeMessageLogText(messageLike);
  if (!normalizedMessage) {
    return [];
  }

  const normalizedLowerMessage =
    normalizeMessageLogSearchText(normalizedMessage);
  const matchedKeys: Nh3dSoundEffectKey[] = [];
  for (const definition of nh3dSoundEffectDefinitions) {
    const keywords =
      "messageLogKeywords" in definition
        ? definition.messageLogKeywords
        : undefined;
    if (!keywords) {
      continue;
    }
    const matched = keywords.some((keyword: Nh3dMessageLogKeyword) =>
      doesMessageLogKeywordMatch(
        keyword,
        normalizedMessage,
        normalizedLowerMessage,
      ),
    );
    if (matched) {
      matchedKeys.push(definition.key);
    }
  }
  return matchedKeys;
}

export function resolveNh3dUserSoundPath(
  packName: string,
  soundKey: Nh3dSoundEffectKey,
  fileName: string,
  variationId: string = nh3dBaseSoundVariationId,
): string {
  const packSegment = sanitizePathSegment(packName, "sound-pack");
  const fileSegment = sanitizeFileName(fileName, `${soundKey}.bin`);
  const normalizedVariationId = normalizeWhitespace(String(variationId || ""));
  if (
    normalizedVariationId &&
    normalizedVariationId !== nh3dBaseSoundVariationId
  ) {
    const variationSegment = sanitizePathSegment(
      normalizedVariationId,
      "variation",
    );
    return `soundpacks/${packSegment}/${soundKey}/${variationSegment}/${fileSegment}`;
  }
  return `soundpacks/${packSegment}/${soundKey}/${fileSegment}`;
}

export function createNh3dSoundUploadSlotKey(
  soundKey: Nh3dSoundEffectKey,
  variationId: string = nh3dBaseSoundVariationId,
): string {
  const normalizedVariationId = normalizeWhitespace(String(variationId || ""));
  return `${soundKey}::${normalizedVariationId || nh3dBaseSoundVariationId}`;
}

export const nh3dAmbientUploadSlotPrefix = "ambient";

export function resolveNh3dUserAmbientPath(
  packName: string,
  trackKey: Nh3dAmbientTrackKey,
  fileName: string,
  variationId: string = nh3dBaseSoundVariationId,
): string {
  const packSegment = sanitizePathSegment(packName, "sound-pack");
  const trackSegment = sanitizePathSegment(trackKey, "ambient");
  const fileSegment = sanitizeFileName(fileName, `${trackKey}.bin`);
  const normalizedVariationId = normalizeWhitespace(String(variationId || ""));
  if (
    normalizedVariationId &&
    normalizedVariationId !== nh3dBaseSoundVariationId
  ) {
    const variationSegment = sanitizePathSegment(
      normalizedVariationId,
      "variation",
    );
    return `soundpacks/${packSegment}/ambient/${trackSegment}/${variationSegment}/${fileSegment}`;
  }
  return `soundpacks/${packSegment}/ambient/${trackSegment}/${fileSegment}`;
}

export function createNh3dAmbientUploadSlotKey(
  trackKey: Nh3dAmbientTrackKey,
  variationId: string = nh3dBaseSoundVariationId,
): string {
  const normalizedVariationId =
    normalizeWhitespace(String(variationId || "")) || nh3dBaseSoundVariationId;
  return `${nh3dAmbientUploadSlotPrefix}::${trackKey}::${normalizedVariationId}`;
}

function normalizeOptionalConditionInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.trunc(parsed));
}

function normalizeAmbientAmuletCondition(
  value: unknown,
): Nh3dAmbientAmuletCondition {
  return value === "carried" || value === "not-carried" ? value : "any";
}

function normalizeAmbientCondition(rawValue: unknown): Nh3dAmbientCondition {
  if (!isRecordLike(rawValue)) {
    return createNh3dDefaultAmbientCondition();
  }
  return {
    depthMin: normalizeOptionalConditionInteger(rawValue.depthMin),
    depthMax: normalizeOptionalConditionInteger(rawValue.depthMax),
    playerLevelMin: normalizeOptionalConditionInteger(rawValue.playerLevelMin),
    playerLevelMax: normalizeOptionalConditionInteger(rawValue.playerLevelMax),
    amulet: normalizeAmbientAmuletCondition(rawValue.amulet),
  };
}

function cloneAmbientCondition(
  condition: Nh3dAmbientCondition,
): Nh3dAmbientCondition {
  return { ...condition };
}

function clampUnit(value: unknown, fallback = 1): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(4))));
}

function createBundledBuiltinSoundEntryBase(
  key: Nh3dSoundEffectKey,
  options: {
    enabled?: boolean;
    volume?: number;
    attribution?: unknown;
  } = {},
): Nh3dSoundEffectEntryBase {
  const bundledPath = resolveNh3dBundledBuiltinSoundPath(key);
  const bundledAvailable =
    typeof bundledPath === "string" && bundledPath.length > 0;
  return {
    key,
    enabled: bundledAvailable ? options.enabled !== false : false,
    volume: clampUnit(options.volume, 1),
    fileName: bundledAvailable ? resolveDefaultFileName(key) : "",
    mimeType: "audio/ogg",
    path: bundledPath ?? "",
    source: "builtin",
    attribution: normalizeAttribution(
      options.attribution,
      bundledAvailable ? "" : "No bundled sound assigned.",
    ),
    reverbOffset: 0,
    pitchVariation: 0,
  };
}

function toArrayBufferBackedUint8Array(
  bytes: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  // BlobPart expects an ArrayBuffer-backed view; copy in case source is SharedArrayBuffer-backed.
  return Uint8Array.from(bytes);
}

function resolveSoundDefinitionLabel(key: Nh3dSoundEffectKey): string {
  const definition = nh3dSoundEffectDefinitions.find(
    (entry) => entry.key === key,
  );
  return definition?.label ?? key;
}

function createDefaultSoundAssignment(
  key: Nh3dSoundEffectKey,
): Nh3dSoundEffectAssignment {
  return {
    ...createBundledBuiltinSoundEntryBase(key, {
      enabled: true,
      volume: 1,
      attribution: "No bundled sound assigned.",
    }),
    variations: [],
  };
}

function createDefaultSoundMap(): Nh3dSoundPackSoundMap {
  const sounds = {} as Nh3dSoundPackSoundMap;
  for (const definition of nh3dSoundEffectDefinitions) {
    sounds[definition.key] = createDefaultSoundAssignment(definition.key);
  }
  return sounds;
}

function cloneSoundAssignment(
  assignment: Nh3dSoundEffectAssignment,
): Nh3dSoundEffectAssignment {
  return {
    ...assignment,
    variations: Array.isArray(assignment.variations)
      ? assignment.variations.map((variation) => ({ ...variation }))
      : [],
  };
}

function cloneSoundMap(sounds: Nh3dSoundPackSoundMap): Nh3dSoundPackSoundMap {
  const next = {} as Nh3dSoundPackSoundMap;
  for (const definition of nh3dSoundEffectDefinitions) {
    next[definition.key] = cloneSoundAssignment(sounds[definition.key]);
  }
  return next;
}

function generateAmbientVariationId(trackKey: Nh3dAmbientTrackKey): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${trackKey}-${crypto.randomUUID()}`;
  }
  return `${trackKey}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function normalizeAmbientVariationId(
  rawId: unknown,
  trackKey: Nh3dAmbientTrackKey,
): string {
  const normalized = normalizeWhitespace(String(rawId || ""));
  if (normalized && normalized !== nh3dBaseSoundVariationId) {
    return normalized;
  }
  return generateAmbientVariationId(trackKey);
}

function createDefaultAmbientEntryBase(
  trackKey: Nh3dAmbientTrackKey,
): Nh3dAmbientTrackEntryBase {
  return {
    key: trackKey,
    enabled: false,
    volume: 1,
    fileName: "",
    mimeType: "",
    path: "",
    source: "user",
    attribution: "",
    conditions: createNh3dDefaultAmbientCondition(),
    reverbOffset: 0,
  };
}

function createDefaultAmbientAssignment(
  trackKey: Nh3dAmbientTrackKey,
): Nh3dAmbientTrackAssignment {
  return {
    ...createDefaultAmbientEntryBase(trackKey),
    variations: [],
  };
}

function createDefaultAmbientMap(): Nh3dSoundPackAmbientMap {
  const ambient = {} as Nh3dSoundPackAmbientMap;
  for (const definition of nh3dAmbientTrackDefinitions) {
    ambient[definition.key] = createDefaultAmbientAssignment(definition.key);
  }
  return ambient;
}

function cloneAmbientAssignment(
  assignment: Nh3dAmbientTrackAssignment,
): Nh3dAmbientTrackAssignment {
  return {
    ...assignment,
    conditions: cloneAmbientCondition(assignment.conditions),
    variations: Array.isArray(assignment.variations)
      ? assignment.variations.map((variation) => ({
          ...variation,
          conditions: cloneAmbientCondition(variation.conditions),
        }))
      : [],
  };
}

function cloneAmbientMap(
  ambient: Nh3dSoundPackAmbientMap | undefined,
): Nh3dSoundPackAmbientMap {
  const next = {} as Nh3dSoundPackAmbientMap;
  const source = ambient && typeof ambient === "object" ? ambient : null;
  for (const definition of nh3dAmbientTrackDefinitions) {
    const current = source ? source[definition.key] : undefined;
    next[definition.key] = current
      ? cloneAmbientAssignment(current)
      : createDefaultAmbientAssignment(definition.key);
  }
  return next;
}

function ambientAssignmentToVariations(
  assignment: Nh3dAmbientTrackAssignment,
): Nh3dAmbientTrackVariation[] {
  const baseVariation: Nh3dAmbientTrackVariation = {
    id: nh3dBaseSoundVariationId,
    key: assignment.key,
    enabled: assignment.enabled,
    volume: assignment.volume,
    fileName: assignment.fileName,
    mimeType: assignment.mimeType,
    path: assignment.path,
    source: assignment.source,
    attribution: assignment.attribution,
    conditions: cloneAmbientCondition(assignment.conditions),
    reverbOffset: assignment.reverbOffset,
  };
  return [
    baseVariation,
    ...(assignment.variations ?? []).map((entry) => ({
      ...entry,
      conditions: cloneAmbientCondition(entry.conditions),
    })),
  ];
}

export function getNh3dAmbientTrackVariations(
  assignment: Nh3dAmbientTrackAssignment,
): Nh3dAmbientTrackVariation[] {
  return ambientAssignmentToVariations(assignment);
}

function ambientAssignmentFromVariations(
  trackKey: Nh3dAmbientTrackKey,
  variations: Nh3dAmbientTrackVariation[],
  fallback: Nh3dAmbientTrackAssignment,
): Nh3dAmbientTrackAssignment {
  const normalizedVariations = Array.isArray(variations)
    ? variations.map((entry) => ({
        ...entry,
        key: trackKey,
        conditions: cloneAmbientCondition(entry.conditions),
      }))
    : [];
  const baseIndex = normalizedVariations.findIndex(
    (entry) => entry.id === nh3dBaseSoundVariationId,
  );
  const baseEntry =
    baseIndex >= 0 ? normalizedVariations[baseIndex] : normalizedVariations[0];
  const resolvedBase: Nh3dAmbientTrackVariation = baseEntry
    ? { ...baseEntry, id: nh3dBaseSoundVariationId }
    : {
        id: nh3dBaseSoundVariationId,
        key: trackKey,
        enabled: fallback.enabled,
        volume: fallback.volume,
        fileName: fallback.fileName,
        mimeType: fallback.mimeType,
        path: fallback.path,
        source: fallback.source,
        attribution: fallback.attribution,
        conditions: cloneAmbientCondition(fallback.conditions),
        reverbOffset: fallback.reverbOffset,
      };

  const extraVariations = normalizedVariations
    .filter((entry, index) => {
      if (!entry || entry.id === nh3dBaseSoundVariationId) {
        return false;
      }
      if (baseIndex < 0 && index === 0) {
        return false;
      }
      return true;
    })
    .map((entry) => ({ ...entry }));

  return {
    key: trackKey,
    enabled: resolvedBase.enabled,
    volume: resolvedBase.volume,
    fileName: resolvedBase.fileName,
    mimeType: resolvedBase.mimeType,
    path: resolvedBase.path,
    source: resolvedBase.source,
    attribution: resolvedBase.attribution,
    conditions: cloneAmbientCondition(resolvedBase.conditions),
    reverbOffset: clampNh3dReverbOffset(resolvedBase.reverbOffset, 0),
    variations: extraVariations,
  };
}

function normalizeAmbientTrackEntry(
  rawValue: unknown,
  trackKey: Nh3dAmbientTrackKey,
  fallback: Nh3dAmbientTrackEntryBase,
  packName: string,
  variationId: string = nh3dBaseSoundVariationId,
): Nh3dAmbientTrackEntryBase {
  if (!isRecordLike(rawValue)) {
    return {
      key: trackKey,
      enabled: Boolean(fallback.enabled),
      volume: clampUnit(fallback.volume, 1),
      fileName: fallback.fileName,
      mimeType: fallback.mimeType,
      path: fallback.path,
      source: fallback.source,
      attribution: normalizeAttribution(fallback.attribution),
      conditions: cloneAmbientCondition(fallback.conditions),
      reverbOffset: clampNh3dReverbOffset(fallback.reverbOffset, 0),
    };
  }
  const volume = clampUnit(rawValue.volume, fallback.volume);
  const attribution = normalizeAttribution(
    rawValue.attribution,
    fallback.attribution,
  );
  const conditions = normalizeAmbientCondition(rawValue.conditions);
  const reverbOffset = clampNh3dReverbOffset(
    rawValue.reverbOffset,
    fallback.reverbOffset,
  );
  const rawFileName = sanitizeFileName(String(rawValue.fileName || ""), "");
  const rawPath = normalizeWhitespace(String(rawValue.path || ""));
  if (!rawFileName && !rawPath) {
    return {
      key: trackKey,
      enabled: false,
      volume,
      fileName: "",
      mimeType: "",
      path: "",
      source: "user",
      attribution,
      conditions,
      reverbOffset,
    };
  }
  const fileName = rawFileName || `${trackKey}.bin`;
  const mimeType =
    normalizeWhitespace(String(rawValue.mimeType || "")) ||
    fallback.mimeType ||
    "application/octet-stream";
  const path =
    rawPath ||
    resolveNh3dUserAmbientPath(packName, trackKey, fileName, variationId);
  return {
    key: trackKey,
    enabled: Boolean(rawValue.enabled),
    volume,
    fileName,
    mimeType,
    path,
    source: "user",
    attribution,
    conditions,
    reverbOffset,
  };
}

function normalizeAmbientTrackAssignment(
  rawValue: unknown,
  trackKey: Nh3dAmbientTrackKey,
  fallback: Nh3dAmbientTrackAssignment,
  packName: string,
): Nh3dAmbientTrackAssignment {
  if (!isRecordLike(rawValue)) {
    return cloneAmbientAssignment(fallback);
  }
  const base = normalizeAmbientTrackEntry(
    rawValue,
    trackKey,
    fallback,
    packName,
  );
  const rawVariations = Array.isArray(rawValue.variations)
    ? rawValue.variations
    : [];
  const seenVariationIds = new Set<string>();
  const variations: Nh3dAmbientTrackVariation[] = [];
  for (const rawVariation of rawVariations) {
    if (!isRecordLike(rawVariation)) {
      continue;
    }
    const nextId = normalizeAmbientVariationId(rawVariation.id, trackKey);
    if (seenVariationIds.has(nextId)) {
      continue;
    }
    const normalized = normalizeAmbientTrackEntry(
      rawVariation,
      trackKey,
      createDefaultAmbientEntryBase(trackKey),
      packName,
      nextId,
    );
    seenVariationIds.add(nextId);
    variations.push({ id: nextId, ...normalized });
  }
  return {
    ...base,
    variations,
  };
}

function normalizeAmbientMap(
  rawValue: unknown,
  packName: string,
): Nh3dSoundPackAmbientMap {
  const rawMap = isRecordLike(rawValue) ? rawValue : null;
  const ambient = {} as Nh3dSoundPackAmbientMap;
  for (const definition of nh3dAmbientTrackDefinitions) {
    const fallback = createDefaultAmbientAssignment(definition.key);
    ambient[definition.key] = normalizeAmbientTrackAssignment(
      rawMap ? rawMap[definition.key] : undefined,
      definition.key,
      fallback,
      packName,
    );
  }
  return ambient;
}

function normalizeVariationId(
  rawId: unknown,
  soundKey: Nh3dSoundEffectKey,
  fallback?: string,
): string {
  const normalized = normalizeWhitespace(String(rawId || ""));
  if (normalized && normalized !== nh3dBaseSoundVariationId) {
    return normalized;
  }
  const fallbackNormalized = normalizeWhitespace(String(fallback || ""));
  if (fallbackNormalized && fallbackNormalized !== nh3dBaseSoundVariationId) {
    return fallbackNormalized;
  }
  return generateSoundVariationId(soundKey);
}

function soundAssignmentToVariations(
  assignment: Nh3dSoundEffectAssignment,
): Nh3dSoundEffectVariation[] {
  const baseVariation: Nh3dSoundEffectVariation = {
    id: nh3dBaseSoundVariationId,
    key: assignment.key,
    enabled: assignment.enabled,
    volume: assignment.volume,
    fileName: assignment.fileName,
    mimeType: assignment.mimeType,
    path: assignment.path,
    source: assignment.source,
    attribution: assignment.attribution,
    reverbOffset: assignment.reverbOffset,
    pitchVariation: assignment.pitchVariation,
  };
  return [
    baseVariation,
    ...(assignment.variations ?? []).map((entry) => ({ ...entry })),
  ];
}

function soundAssignmentFromVariations(
  soundKey: Nh3dSoundEffectKey,
  variations: Nh3dSoundEffectVariation[],
  fallback: Nh3dSoundEffectAssignment,
): Nh3dSoundEffectAssignment {
  const normalizedVariations = Array.isArray(variations)
    ? variations.map((entry) => ({ ...entry, key: soundKey }))
    : [];
  const baseIndex = normalizedVariations.findIndex(
    (entry) => entry.id === nh3dBaseSoundVariationId,
  );
  const baseEntry =
    baseIndex >= 0 ? normalizedVariations[baseIndex] : normalizedVariations[0];
  const resolvedBase = baseEntry
    ? { ...baseEntry, id: nh3dBaseSoundVariationId }
    : {
        id: nh3dBaseSoundVariationId,
        key: soundKey,
        enabled: fallback.enabled,
        volume: fallback.volume,
        fileName: fallback.fileName,
        mimeType: fallback.mimeType,
        path: fallback.path,
        source: fallback.source,
        attribution: fallback.attribution,
        reverbOffset: fallback.reverbOffset,
        pitchVariation: fallback.pitchVariation,
      };

  const extraVariations = normalizedVariations
    .filter((entry, index) => {
      if (!entry || entry.id === nh3dBaseSoundVariationId) {
        return false;
      }
      if (baseIndex < 0 && index === 0) {
        return false;
      }
      return true;
    })
    .map((entry) => ({ ...entry }));

  return {
    key: soundKey,
    enabled: resolvedBase.enabled,
    volume: resolvedBase.volume,
    fileName: resolvedBase.fileName,
    mimeType: resolvedBase.mimeType,
    path: resolvedBase.path,
    source: resolvedBase.source,
    attribution: resolvedBase.attribution,
    reverbOffset: clampNh3dReverbOffset(resolvedBase.reverbOffset, 0),
    pitchVariation: clampNh3dPitchVariation(resolvedBase.pitchVariation, 0),
    variations: extraVariations,
  };
}

export function cloneNh3dSoundPack(
  pack: Nh3dSoundPackRecord,
): Nh3dSoundPackRecord {
  return {
    ...pack,
    sounds: cloneSoundMap(pack.sounds),
    ambient: cloneAmbientMap(pack.ambient),
    reverb: cloneReverbSettings(pack.reverb ?? createNh3dDefaultReverbSettings()),
  };
}

function createDefaultSoundPackRecord(now = Date.now()): Nh3dSoundPackRecord {
  return {
    id: nh3dDefaultSoundPackId,
    name: nh3dDefaultSoundPackName,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    sounds: createDefaultSoundMap(),
    ambient: createDefaultAmbientMap(),
    reverb: createNh3dDefaultReverbSettings(),
  };
}

function normalizeSoundEffectEntry(
  rawValue: unknown,
  soundKey: Nh3dSoundEffectKey,
  fallback: Nh3dSoundEffectEntryBase,
  packName: string,
  variationId: string = nh3dBaseSoundVariationId,
): Nh3dSoundEffectEntryBase {
  if (!isRecordLike(rawValue)) {
    return {
      key: soundKey,
      enabled: Boolean(fallback.enabled),
      volume: clampUnit(fallback.volume, 1),
      fileName: fallback.fileName,
      mimeType: fallback.mimeType,
      path: fallback.path,
      source: fallback.source,
      attribution: normalizeAttribution(fallback.attribution),
      reverbOffset: clampNh3dReverbOffset(fallback.reverbOffset, 0),
      pitchVariation: clampNh3dPitchVariation(fallback.pitchVariation, 0),
    };
  }
  const source: Nh3dSoundEntrySource =
    rawValue.source === "user" ? "user" : "builtin";
  const reverbOffset = clampNh3dReverbOffset(
    rawValue.reverbOffset,
    fallback.reverbOffset,
  );
  const pitchVariation = clampNh3dPitchVariation(
    rawValue.pitchVariation,
    fallback.pitchVariation,
  );
  const enabled = Boolean(rawValue.enabled);
  const volume = clampUnit(rawValue.volume, fallback.volume);
  const fallbackFileName =
    source === "user"
      ? sanitizeFileName(fallback.fileName, `${soundKey}.bin`)
      : resolveDefaultFileName(soundKey);
  const fileName = sanitizeFileName(
    String(rawValue.fileName || ""),
    fallbackFileName,
  );
  const mimeTypeCandidate = normalizeWhitespace(
    String(rawValue.mimeType || ""),
  );
  const mimeType =
    mimeTypeCandidate ||
    (source === "user"
      ? fallback.mimeType || "application/octet-stream"
      : "audio/ogg");
  const attribution = normalizeAttribution(
    rawValue.attribution,
    fallback.attribution,
  );

  if (source === "user") {
    const rawPath = normalizeWhitespace(String(rawValue.path || ""));
    const path =
      rawPath ||
      resolveNh3dUserSoundPath(packName, soundKey, fileName, variationId);
    return {
      key: soundKey,
      enabled,
      volume,
      fileName,
      mimeType,
      path,
      source: "user",
      attribution,
      reverbOffset,
      pitchVariation,
    };
  }

  return {
    ...createBundledBuiltinSoundEntryBase(soundKey, {
      enabled,
      volume,
      attribution,
    }),
    reverbOffset,
    pitchVariation,
  };
}

function normalizeSoundAssignment(
  rawValue: unknown,
  soundKey: Nh3dSoundEffectKey,
  fallback: Nh3dSoundEffectAssignment,
  packName: string,
): Nh3dSoundEffectAssignment {
  if (!isRecordLike(rawValue)) {
    return cloneSoundAssignment(fallback);
  }

  const base = normalizeSoundEffectEntry(
    rawValue,
    soundKey,
    fallback,
    packName,
  );
  const rawVariations = Array.isArray(rawValue.variations)
    ? rawValue.variations
    : [];
  const fallbackVariations = Array.isArray(fallback.variations)
    ? fallback.variations
    : [];
  const seenVariationIds = new Set<string>();
  const variations: Nh3dSoundEffectVariation[] = [];

  for (let index = 0; index < rawVariations.length; index += 1) {
    const rawVariation = rawVariations[index];
    if (!isRecordLike(rawVariation)) {
      continue;
    }
    const fallbackVariation = fallbackVariations[index] ?? {
      ...fallback,
      key: soundKey,
    };
    const nextId = normalizeVariationId(rawVariation.id, soundKey);
    if (seenVariationIds.has(nextId)) {
      continue;
    }
    const normalized = normalizeSoundEffectEntry(
      rawVariation,
      soundKey,
      fallbackVariation,
      packName,
      nextId,
    );
    seenVariationIds.add(nextId);
    variations.push({
      id: nextId,
      ...normalized,
    });
  }

  return {
    ...base,
    variations,
  };
}

function normalizeSoundPackRecord(
  rawValue: unknown,
): Nh3dSoundPackRecord | null {
  if (!isRecordLike(rawValue)) {
    return null;
  }
  const rawId = normalizeWhitespace(String(rawValue.id || ""));
  if (!rawId) {
    return null;
  }
  const isDefault =
    rawId === nh3dDefaultSoundPackId || rawValue.isDefault === true;
  const id = isDefault ? nh3dDefaultSoundPackId : rawId;
  const name = isDefault
    ? nh3dDefaultSoundPackName
    : normalizeNh3dSoundPackName(String(rawValue.name || "")) || "Sound Pack";
  const createdAt =
    typeof rawValue.createdAt === "number" &&
    Number.isFinite(rawValue.createdAt)
      ? rawValue.createdAt
      : Date.now();
  const updatedAt =
    typeof rawValue.updatedAt === "number" &&
    Number.isFinite(rawValue.updatedAt)
      ? rawValue.updatedAt
      : createdAt;
  const rawSounds = isRecordLike(rawValue.sounds) ? rawValue.sounds : null;
  const sounds = {} as Nh3dSoundPackSoundMap;

  for (const definition of nh3dSoundEffectDefinitions) {
    const soundKey = definition.key;
    const fallback = createDefaultSoundAssignment(soundKey);
    const legacyPlayerFootstepSound =
      rawSounds && soundKey === "player-walk"
        ? rawSounds["player-footstep"]
        : undefined;
    const rawSound = rawSounds ? rawSounds[soundKey] : undefined;
    const normalized = normalizeSoundAssignment(
      rawSound,
      soundKey,
      fallback,
      name,
    );
    const normalizedLegacy =
      legacyPlayerFootstepSound !== undefined
        ? normalizeSoundAssignment(
            legacyPlayerFootstepSound,
            soundKey,
            fallback,
            name,
          )
        : null;
    sounds[soundKey] =
      rawSound !== undefined ? normalized : normalizedLegacy || normalized;
  }

  return {
    id,
    name,
    isDefault,
    createdAt,
    updatedAt,
    sounds,
    ambient: normalizeAmbientMap(rawValue.ambient, name),
    reverb: normalizeReverbSettings(rawValue.reverb),
  };
}

function sortSoundPacks(packs: Nh3dSoundPackRecord[]): Nh3dSoundPackRecord[] {
  return [...packs].sort((a, b) => {
    if (a.isDefault && !b.isDefault) {
      return -1;
    }
    if (!a.isDefault && b.isDefault) {
      return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function parseActivePackId(rawValue: unknown): string | null {
  if (!isRecordLike(rawValue)) {
    return null;
  }
  const key = normalizeWhitespace(String(rawValue.key || ""));
  if (key !== activePackMetaKey) {
    return null;
  }
  const value = normalizeWhitespace(String(rawValue.value || ""));
  return value || null;
}

function generateSoundPackId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `sound-pack-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function generateSoundVariationId(soundKey: Nh3dSoundEffectKey): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${soundKey}-${crypto.randomUUID()}`;
  }
  return `${soundKey}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function readNormalizedSoundPacks(rawValues: unknown[]): Nh3dSoundPackRecord[] {
  const packsById = new Map<string, Nh3dSoundPackRecord>();
  for (const rawValue of rawValues) {
    const normalized = normalizeSoundPackRecord(rawValue);
    if (!normalized) {
      continue;
    }
    packsById.set(normalized.id, normalized);
  }
  if (!packsById.has(nh3dDefaultSoundPackId)) {
    packsById.set(nh3dDefaultSoundPackId, createDefaultSoundPackRecord());
  }
  return sortSoundPacks(Array.from(packsById.values()));
}

function throwIfPackNameTaken(
  packs: ReadonlyArray<Nh3dSoundPackRecord>,
  nextName: string,
  excludedPackId: string,
): void {
  const normalizedNextName = normalizeNh3dSoundPackName(nextName).toLowerCase();
  if (!normalizedNextName) {
    throw new Error("Sound pack name is required.");
  }
  const nameInUse = packs.some((pack) => {
    if (pack.id === excludedPackId) {
      return false;
    }
    return (
      normalizeNh3dSoundPackName(pack.name).toLowerCase() === normalizedNextName
    );
  });
  if (nameInUse) {
    throw new Error(`A sound pack named '${nextName}' already exists.`);
  }
}

function resolveUniqueSoundPackName(
  requestedName: string,
  packs: ReadonlyArray<Nh3dSoundPackRecord>,
): string {
  const trimmedRequestedName =
    normalizeNh3dSoundPackName(requestedName) || "Imported Sound Pack";
  const usedNames = new Set(
    packs.map((pack) => normalizeNh3dSoundPackName(pack.name).toLowerCase()),
  );
  if (!usedNames.has(trimmedRequestedName.toLowerCase())) {
    return trimmedRequestedName;
  }
  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${trimmedRequestedName} (${suffix})`;
    if (!usedNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    suffix += 1;
  }
  return `${trimmedRequestedName} (${Date.now()})`;
}

function normalizeSoundFileRecord(
  rawValue: unknown,
): Nh3dStoredSoundFileRecord | null {
  if (!isRecordLike(rawValue)) {
    return null;
  }
  const path = normalizeWhitespace(String(rawValue.path || ""));
  if (!path) {
    return null;
  }
  const blob = rawValue.blob instanceof Blob ? rawValue.blob : null;
  if (!blob) {
    return null;
  }
  const soundKey = String(rawValue.soundKey || "");
  const isKnownSoundKey =
    nh3dSoundEffectDefinitions.some((definition) => definition.key === soundKey) ||
    nh3dAmbientTrackDefinitions.some((definition) => definition.key === soundKey);
  if (!isKnownSoundKey) {
    return null;
  }
  const fileName = sanitizeFileName(
    String(rawValue.fileName || ""),
    `${soundKey}.bin`,
  );
  const mimeType =
    normalizeWhitespace(String(rawValue.mimeType || "")) ||
    blob.type ||
    "application/octet-stream";
  const packId = normalizeWhitespace(String(rawValue.packId || ""));
  return {
    path,
    packId,
    soundKey,
    fileName,
    mimeType,
    blob,
    byteLength:
      typeof rawValue.byteLength === "number" &&
      Number.isFinite(rawValue.byteLength)
        ? rawValue.byteLength
        : blob.size,
    createdAt:
      typeof rawValue.createdAt === "number" &&
      Number.isFinite(rawValue.createdAt)
        ? rawValue.createdAt
        : Date.now(),
    updatedAt:
      typeof rawValue.updatedAt === "number" &&
      Number.isFinite(rawValue.updatedAt)
        ? rawValue.updatedAt
        : Date.now(),
  };
}

async function readSoundFileRecord(
  fileStore: IDBObjectStore,
  path: string,
): Promise<Nh3dStoredSoundFileRecord | null> {
  const rawValue = await idbRequestToPromise(fileStore.get(path));
  return normalizeSoundFileRecord(rawValue);
}

async function writeSoundFileRecord(
  fileStore: IDBObjectStore,
  options: {
    path: string;
    packId: string;
    soundKey: string;
    fileName: string;
    mimeType: string;
    blob: Blob;
    now: number;
  },
): Promise<void> {
  const existing = await readSoundFileRecord(fileStore, options.path);
  const record: Nh3dStoredSoundFileRecord = {
    path: options.path,
    packId: options.packId,
    soundKey: options.soundKey,
    fileName: sanitizeFileName(options.fileName, `${options.soundKey}.bin`),
    mimeType:
      normalizeWhitespace(options.mimeType) ||
      options.blob.type ||
      "application/octet-stream",
    blob: options.blob,
    byteLength: options.blob.size,
    createdAt: existing?.createdAt ?? options.now,
    updatedAt: options.now,
  };
  await idbRequestToPromise(fileStore.put(record));
}

async function moveSoundFileRecord(
  fileStore: IDBObjectStore,
  fromPath: string,
  toPath: string,
  now: number,
  forcedPackId: string,
  forcedKey: string,
): Promise<void> {
  if (!fromPath || !toPath || fromPath === toPath) {
    return;
  }
  const existing = await readSoundFileRecord(fileStore, fromPath);
  if (!existing) {
    return;
  }
  await writeSoundFileRecord(fileStore, {
    path: toPath,
    packId: forcedPackId || existing.packId,
    soundKey: forcedKey || existing.soundKey,
    fileName: existing.fileName,
    mimeType: existing.mimeType,
    blob: existing.blob,
    now,
  });
  await idbRequestToPromise(fileStore.delete(fromPath));
}

async function getNormalizedPacksForTransaction(
  packStore: IDBObjectStore,
): Promise<Nh3dSoundPackRecord[]> {
  const rawValues = await idbRequestToPromise(packStore.getAll());
  return readNormalizedSoundPacks(rawValues as unknown[]);
}

async function deleteUserSoundFilesForPack(
  fileStore: IDBObjectStore,
  pack: Nh3dSoundPackRecord,
): Promise<void> {
  for (const definition of nh3dSoundEffectDefinitions) {
    const soundKey = definition.key;
    const sound = pack.sounds[soundKey];
    const entries = soundAssignmentToVariations(sound);
    for (const entry of entries) {
      if (entry.source !== "user") {
        continue;
      }
      const path = normalizeWhitespace(entry.path || "");
      if (!path) {
        continue;
      }
      await idbRequestToPromise(fileStore.delete(path));
    }
  }
}

async function deleteUserAmbientFilesForPack(
  fileStore: IDBObjectStore,
  pack: Nh3dSoundPackRecord,
): Promise<void> {
  const ambientMap = pack.ambient;
  if (!ambientMap) {
    return;
  }
  for (const definition of nh3dAmbientTrackDefinitions) {
    const track = ambientMap[definition.key];
    if (!track) {
      continue;
    }
    const entries = ambientAssignmentToVariations(track);
    for (const entry of entries) {
      const path = normalizeWhitespace(entry.path || "");
      if (!path) {
        continue;
      }
      await idbRequestToPromise(fileStore.delete(path));
    }
  }
}

async function importBundledDefaultSoundPackOnLoad(): Promise<void> {
  if (bundledDefaultSoundPackImportAttempted) {
    return;
  }

  if (!bundledDefaultSoundPackImportInFlight) {
    bundledDefaultSoundPackImportInFlight = (async () => {
      bundledDefaultSoundPackImportAttempted = true;
      if (typeof fetch !== "function") {
        return;
      }
      try {
        const response = await fetch(
          resolvePublicAssetUrl(bundledDefaultSoundPackZipRelativePath),
          {
            cache: "no-store",
          },
        );
        if (!response.ok) {
          return;
        }
        await importNh3dSoundPackFromZip(await response.blob(), {
          intoDefaultSlot: true,
        });
      } catch (error) {
        if (!bundledDefaultSoundPackImportWarningLogged) {
          bundledDefaultSoundPackImportWarningLogged = true;
          console.warn(
            "Unable to import bundled default sound pack ZIP on load.",
            error,
          );
        }
      }
    })();
  }

  try {
    await bundledDefaultSoundPackImportInFlight;
  } finally {
    bundledDefaultSoundPackImportInFlight = null;
  }
}

type Nh3dDefaultSoundVolumeTemplate = {
  baseVolume: number;
  variationVolumeById: Map<string, number>;
};

function createFallbackDefaultSoundVolumeTemplates(): Map<
  Nh3dSoundEffectKey,
  Nh3dDefaultSoundVolumeTemplate
> {
  const templates = new Map<
    Nh3dSoundEffectKey,
    Nh3dDefaultSoundVolumeTemplate
  >();
  for (const definition of nh3dSoundEffectDefinitions) {
    const fallback = createDefaultSoundAssignment(definition.key);
    templates.set(definition.key, {
      baseVolume: fallback.volume,
      variationVolumeById: new Map<string, number>(),
    });
  }
  return templates;
}

async function loadBundledDefaultSoundVolumeTemplates(): Promise<
  Map<Nh3dSoundEffectKey, Nh3dDefaultSoundVolumeTemplate>
> {
  const templates = createFallbackDefaultSoundVolumeTemplates();
  if (typeof fetch !== "function") {
    return templates;
  }

  try {
    const response = await fetch(
      resolvePublicAssetUrl(bundledDefaultSoundPackZipRelativePath),
      {
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return templates;
    }

    const archiveEntries = await unzipArchiveEntries(await response.blob());
    const manifestBytes = archiveEntries[soundPackManifestPath];
    if (!manifestBytes) {
      return templates;
    }

    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(strFromU8(manifestBytes));
    } catch {
      return templates;
    }

    const manifest = parseImportManifest(parsedManifest);
    for (const definition of nh3dSoundEffectDefinitions) {
      const soundKey = definition.key;
      const template = templates.get(soundKey);
      if (!template) {
        continue;
      }
      const imported = manifest.soundsByKey.get(soundKey);
      if (!imported) {
        continue;
      }
      template.baseVolume = clampUnit(imported.volume, template.baseVolume);
      const nextVariationVolumeById = new Map<string, number>();
      for (const variation of imported.variations ?? []) {
        const variationId = normalizeWhitespace(String(variation.id || ""));
        if (!variationId || variationId === nh3dBaseSoundVariationId) {
          continue;
        }
        nextVariationVolumeById.set(
          variationId,
          clampUnit(variation.volume, template.baseVolume),
        );
      }
      template.variationVolumeById = nextVariationVolumeById;
    }
  } catch {
    return templates;
  }

  return templates;
}

export async function resetNh3dDefaultSoundPackVolumeLevelsToDefaults(): Promise<Nh3dSoundPackRecord> {
  const templates = await loadBundledDefaultSoundVolumeTemplates();
  const db = await openDatabase();
  try {
    const transaction = db.transaction(packStoreName, "readwrite");
    const packStore = transaction.objectStore(packStoreName);
    const packs = await getNormalizedPacksForTransaction(packStore);
    for (const pack of packs) {
      await idbRequestToPromise(packStore.put(pack));
    }

    const now = Date.now();
    const defaultPack =
      packs.find((pack) => pack.id === nh3dDefaultSoundPackId) ??
      createDefaultSoundPackRecord(now);
    const nextSounds = {} as Nh3dSoundPackSoundMap;

    for (const definition of nh3dSoundEffectDefinitions) {
      const soundKey = definition.key;
      const fallback = createDefaultSoundAssignment(soundKey);
      const current = defaultPack.sounds[soundKey] ?? fallback;
      const template = templates.get(soundKey);
      const baseVolume = clampUnit(template?.baseVolume, fallback.volume);
      const variationVolumeById = template?.variationVolumeById;
      const nextVariations = (current.variations ?? []).map((variation) => ({
        ...variation,
        volume: clampUnit(variationVolumeById?.get(variation.id), baseVolume),
      }));

      nextSounds[soundKey] = {
        ...current,
        volume: baseVolume,
        variations: nextVariations,
      };
    }

    const nextPack: Nh3dSoundPackRecord = {
      ...defaultPack,
      id: nh3dDefaultSoundPackId,
      name: nh3dDefaultSoundPackName,
      isDefault: true,
      updatedAt: now,
      sounds: nextSounds,
    };

    await idbRequestToPromise(packStore.put(nextPack));
    await idbTransactionDone(transaction);

    return cloneNh3dSoundPack(nextPack);
  } finally {
    db.close();
  }
}

export async function loadNh3dSoundPackStateFromIndexedDb(): Promise<Nh3dLoadedSoundPackState> {
  await importBundledDefaultSoundPackOnLoad();
  const db = await openDatabase();
  try {
    const transaction = db.transaction(
      [packStoreName, metaStoreName],
      "readwrite",
    );
    const packStore = transaction.objectStore(packStoreName);
    const metaStore = transaction.objectStore(metaStoreName);
    const packs = await getNormalizedPacksForTransaction(packStore);

    for (const pack of packs) {
      await idbRequestToPromise(packStore.put(pack));
    }

    const rawActiveRecord = await idbRequestToPromise(
      metaStore.get(activePackMetaKey),
    );
    const rawActivePackId = parseActivePackId(rawActiveRecord);
    const activePackId =
      rawActivePackId && packs.some((pack) => pack.id === rawActivePackId)
        ? rawActivePackId
        : nh3dDefaultSoundPackId;

    const nextMeta: Nh3dMetaRecord = {
      key: activePackMetaKey,
      value: activePackId,
      updatedAt: Date.now(),
    };
    await idbRequestToPromise(metaStore.put(nextMeta));
    await idbTransactionDone(transaction);

    return {
      packs: packs.map((pack) => cloneNh3dSoundPack(pack)),
      activePackId,
    };
  } finally {
    db.close();
  }
}

export async function setActiveNh3dSoundPackId(packId: string): Promise<void> {
  const normalizedPackId = normalizeWhitespace(String(packId || ""));
  if (!normalizedPackId) {
    throw new Error("Sound pack id is required.");
  }
  const db = await openDatabase();
  try {
    const transaction = db.transaction(
      [packStoreName, metaStoreName],
      "readwrite",
    );
    const packStore = transaction.objectStore(packStoreName);
    const metaStore = transaction.objectStore(metaStoreName);
    const packRecord = await idbRequestToPromise(
      packStore.get(normalizedPackId),
    );
    const normalizedPack = normalizeSoundPackRecord(packRecord);
    if (!normalizedPack) {
      throw new Error("Selected sound pack no longer exists.");
    }

    const nextMeta: Nh3dMetaRecord = {
      key: activePackMetaKey,
      value: normalizedPackId,
      updatedAt: Date.now(),
    };
    await idbRequestToPromise(metaStore.put(nextMeta));
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function deleteNh3dSoundPackFromIndexedDb(
  packId: string,
): Promise<string> {
  const normalizedPackId = normalizeWhitespace(String(packId || ""));
  if (!normalizedPackId) {
    throw new Error("Sound pack id is required.");
  }
  if (normalizedPackId === nh3dDefaultSoundPackId) {
    throw new Error("The default sound pack cannot be deleted.");
  }

  const db = await openDatabase();
  try {
    const transaction = db.transaction(
      [packStoreName, fileStoreName, metaStoreName],
      "readwrite",
    );
    const packStore = transaction.objectStore(packStoreName);
    const fileStore = transaction.objectStore(fileStoreName);
    const metaStore = transaction.objectStore(metaStoreName);
    const packs = await getNormalizedPacksForTransaction(packStore);
    for (const pack of packs) {
      await idbRequestToPromise(packStore.put(pack));
    }

    const targetPack = packs.find((entry) => entry.id === normalizedPackId);
    if (!targetPack) {
      throw new Error("Sound pack no longer exists.");
    }
    if (targetPack.isDefault) {
      throw new Error("The default sound pack cannot be deleted.");
    }

    for (const definition of nh3dSoundEffectDefinitions) {
      const soundKey = definition.key;
      const sound = targetPack.sounds[soundKey];
      const entries = soundAssignmentToVariations(sound);
      for (const entry of entries) {
        if (entry.source !== "user") {
          continue;
        }
        const path = normalizeWhitespace(entry.path || "");
        if (!path) {
          continue;
        }
        await idbRequestToPromise(fileStore.delete(path));
      }
    }
    await deleteUserAmbientFilesForPack(fileStore, targetPack);

    await idbRequestToPromise(packStore.delete(targetPack.id));

    const rawActiveRecord = await idbRequestToPromise(
      metaStore.get(activePackMetaKey),
    );
    const rawActivePackId = parseActivePackId(rawActiveRecord);
    const nextActivePackId =
      rawActivePackId && rawActivePackId !== targetPack.id
        ? rawActivePackId
        : nh3dDefaultSoundPackId;
    const nextMeta: Nh3dMetaRecord = {
      key: activePackMetaKey,
      value: nextActivePackId,
      updatedAt: Date.now(),
    };
    await idbRequestToPromise(metaStore.put(nextMeta));
    await idbTransactionDone(transaction);
    return nextActivePackId;
  } finally {
    db.close();
  }
}

async function cloneDefaultSoundMapForNewPack(
  defaultPack: Nh3dSoundPackRecord,
  fileStore: IDBObjectStore,
  nextPackId: string,
  nextPackName: string,
  now: number,
): Promise<Nh3dSoundPackSoundMap> {
  const sounds = {} as Nh3dSoundPackSoundMap;

  for (const definition of nh3dSoundEffectDefinitions) {
    const soundKey = definition.key;
    const fallbackDefault = createDefaultSoundAssignment(soundKey);
    const defaultSound =
      defaultPack.sounds[soundKey] ?? createDefaultSoundAssignment(soundKey);
    const nextEntries: Nh3dSoundEffectVariation[] = [];
    const defaultEntries = soundAssignmentToVariations(defaultSound);

    for (const defaultEntry of defaultEntries) {
      const isBase = defaultEntry.id === nh3dBaseSoundVariationId;
      if (defaultEntry.source !== "user") {
        nextEntries.push({
          id: defaultEntry.id,
          ...createBundledBuiltinSoundEntryBase(soundKey, {
            enabled: defaultEntry.enabled,
            volume: defaultEntry.volume,
            attribution: normalizeAttribution(
              defaultEntry.attribution,
              fallbackDefault.attribution,
            ),
          }),
          reverbOffset: defaultEntry.reverbOffset,
          pitchVariation: defaultEntry.pitchVariation,
        });
        continue;
      }

      const sourcePath = normalizeWhitespace(defaultEntry.path || "");
      const fileName = sanitizeFileName(
        defaultEntry.fileName,
        `${soundKey}.bin`,
      );
      const canonicalPath = resolveNh3dUserSoundPath(
        nextPackName,
        soundKey,
        fileName,
        defaultEntry.id,
      );
      const storedRecord = sourcePath
        ? await readSoundFileRecord(fileStore, sourcePath)
        : null;

      if (!storedRecord) {
        if (isBase) {
          nextEntries.push({
            id: nh3dBaseSoundVariationId,
            key: soundKey,
            enabled: defaultEntry.enabled,
            volume: defaultEntry.volume,
            fileName: fallbackDefault.fileName,
            mimeType: fallbackDefault.mimeType,
            path: fallbackDefault.path,
            source: "builtin",
            attribution: normalizeAttribution(
              defaultEntry.attribution,
              fallbackDefault.attribution,
            ),
            reverbOffset: defaultEntry.reverbOffset,
            pitchVariation: defaultEntry.pitchVariation,
          });
        }
        continue;
      }

      const nextMimeType =
        normalizeWhitespace(defaultEntry.mimeType || "") ||
        normalizeWhitespace(storedRecord.mimeType || "") ||
        normalizeWhitespace(storedRecord.blob.type || "") ||
        "application/octet-stream";
      await writeSoundFileRecord(fileStore, {
        path: canonicalPath,
        packId: nextPackId,
        soundKey,
        fileName,
        mimeType: nextMimeType,
        blob: storedRecord.blob,
        now,
      });

      nextEntries.push({
        id: defaultEntry.id,
        key: soundKey,
        enabled: defaultEntry.enabled,
        volume: defaultEntry.volume,
        fileName,
        mimeType: nextMimeType,
        path: canonicalPath,
        source: "user",
        attribution: normalizeAttribution(
          defaultEntry.attribution,
          fallbackDefault.attribution,
        ),
        reverbOffset: defaultEntry.reverbOffset,
        pitchVariation: defaultEntry.pitchVariation,
      });
    }

    sounds[soundKey] = soundAssignmentFromVariations(
      soundKey,
      nextEntries,
      fallbackDefault,
    );
  }

  return sounds;
}

async function cloneDefaultAmbientMapForNewPack(
  defaultPack: Nh3dSoundPackRecord,
  fileStore: IDBObjectStore,
  nextPackId: string,
  nextPackName: string,
  now: number,
): Promise<Nh3dSoundPackAmbientMap> {
  const ambient = {} as Nh3dSoundPackAmbientMap;

  for (const definition of nh3dAmbientTrackDefinitions) {
    const trackKey = definition.key;
    const fallback = createDefaultAmbientAssignment(trackKey);
    const defaultTrack = defaultPack.ambient?.[trackKey] ?? fallback;
    const defaultEntries = ambientAssignmentToVariations(defaultTrack);
    const nextEntries: Nh3dAmbientTrackVariation[] = [];

    for (const defaultEntry of defaultEntries) {
      const isBase = defaultEntry.id === nh3dBaseSoundVariationId;
      const sourcePath = normalizeWhitespace(defaultEntry.path || "");
      if (!sourcePath) {
        if (isBase) {
          nextEntries.push({ ...defaultEntry });
        }
        continue;
      }

      const fileName = sanitizeFileName(
        defaultEntry.fileName,
        `${trackKey}.bin`,
      );
      const canonicalPath = resolveNh3dUserAmbientPath(
        nextPackName,
        trackKey,
        fileName,
        defaultEntry.id,
      );
      const storedRecord = await readSoundFileRecord(fileStore, sourcePath);
      if (!storedRecord) {
        if (isBase) {
          nextEntries.push({
            ...defaultEntry,
            enabled: false,
            fileName: "",
            mimeType: "",
            path: "",
          });
        }
        continue;
      }

      const nextMimeType =
        normalizeWhitespace(defaultEntry.mimeType || "") ||
        normalizeWhitespace(storedRecord.mimeType || "") ||
        normalizeWhitespace(storedRecord.blob.type || "") ||
        "application/octet-stream";
      await writeSoundFileRecord(fileStore, {
        path: canonicalPath,
        packId: nextPackId,
        soundKey: trackKey,
        fileName,
        mimeType: nextMimeType,
        blob: storedRecord.blob,
        now,
      });

      nextEntries.push({
        id: defaultEntry.id,
        key: trackKey,
        enabled: defaultEntry.enabled,
        volume: defaultEntry.volume,
        fileName,
        mimeType: nextMimeType,
        path: canonicalPath,
        source: "user",
        attribution: defaultEntry.attribution,
        conditions: cloneAmbientCondition(defaultEntry.conditions),
        reverbOffset: defaultEntry.reverbOffset,
      });
    }

    ambient[trackKey] = ambientAssignmentFromVariations(
      trackKey,
      nextEntries,
      fallback,
    );
  }

  return ambient;
}

export async function createNh3dSoundPack(
  name: string,
): Promise<Nh3dSoundPackRecord> {
  const normalizedName = normalizeNh3dSoundPackName(name);
  if (!normalizedName) {
    throw new Error("Sound pack name is required.");
  }

  await importBundledDefaultSoundPackOnLoad();

  const db = await openDatabase();
  try {
    const transaction = db.transaction(
      [packStoreName, fileStoreName, metaStoreName],
      "readwrite",
    );
    const packStore = transaction.objectStore(packStoreName);
    const fileStore = transaction.objectStore(fileStoreName);
    const metaStore = transaction.objectStore(metaStoreName);
    const packs = await getNormalizedPacksForTransaction(packStore);
    for (const pack of packs) {
      await idbRequestToPromise(packStore.put(pack));
    }
    throwIfPackNameTaken(packs, normalizedName, "");

    const defaultPack =
      packs.find((pack) => pack.id === nh3dDefaultSoundPackId) ??
      createDefaultSoundPackRecord();
    const now = Date.now();
    const nextPackId = generateSoundPackId();
    const nextSounds = await cloneDefaultSoundMapForNewPack(
      defaultPack,
      fileStore,
      nextPackId,
      normalizedName,
      now,
    );
    const nextAmbient = await cloneDefaultAmbientMapForNewPack(
      defaultPack,
      fileStore,
      nextPackId,
      normalizedName,
      now,
    );
    const nextPack: Nh3dSoundPackRecord = {
      id: nextPackId,
      name: normalizedName,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      sounds: nextSounds,
      ambient: nextAmbient,
      reverb: cloneReverbSettings(
        defaultPack.reverb ?? createNh3dDefaultReverbSettings(),
      ),
    };

    await idbRequestToPromise(packStore.put(nextPack));
    const nextMeta: Nh3dMetaRecord = {
      key: activePackMetaKey,
      value: nextPack.id,
      updatedAt: now,
    };
    await idbRequestToPromise(metaStore.put(nextMeta));
    await idbTransactionDone(transaction);

    return cloneNh3dSoundPack(nextPack);
  } finally {
    db.close();
  }
}

async function persistAmbientMapForSave(
  fileStore: IDBObjectStore,
  existingPack: Nh3dSoundPackRecord,
  incomingPack: Nh3dSoundPackRecord,
  uploadedSoundFiles: Nh3dSoundFileUploadOverrides,
  nextName: string,
  packId: string,
  now: number,
): Promise<Nh3dSoundPackAmbientMap> {
  const nextAmbient = {} as Nh3dSoundPackAmbientMap;

  for (const definition of nh3dAmbientTrackDefinitions) {
    const trackKey = definition.key;
    const fallback = createDefaultAmbientAssignment(trackKey);
    const existingTrack = existingPack.ambient?.[trackKey] ?? fallback;
    const incomingTrack = incomingPack.ambient?.[trackKey] ?? existingTrack;
    const existingEntries = ambientAssignmentToVariations(existingTrack);
    const existingById = new Map(existingEntries.map((entry) => [entry.id, entry]));
    const incomingEntriesRaw = ambientAssignmentToVariations(incomingTrack);

    const seenIds = new Set<string>();
    const nextEntries: Nh3dAmbientTrackVariation[] = [];
    const retainedUserPaths = new Set<string>();

    const pushUnassigned = (
      variationId: string,
      volume: number,
      attribution: string,
      conditions: Nh3dAmbientCondition,
      reverbOffset: number,
    ): void => {
      nextEntries.push({
        id: variationId,
        key: trackKey,
        enabled: false,
        volume,
        fileName: "",
        mimeType: "",
        path: "",
        source: "user",
        attribution,
        conditions,
        reverbOffset,
      });
    };

    for (const rawEntry of incomingEntriesRaw) {
      const isBase = rawEntry.id === nh3dBaseSoundVariationId;
      let variationId = isBase
        ? nh3dBaseSoundVariationId
        : normalizeAmbientVariationId(rawEntry.id, trackKey);
      if (seenIds.has(variationId)) {
        if (isBase) {
          continue;
        }
        do {
          variationId = generateAmbientVariationId(trackKey);
        } while (seenIds.has(variationId));
      }
      seenIds.add(variationId);

      const existingEntry = existingById.get(variationId);
      const volume = clampUnit(rawEntry.volume, existingEntry?.volume ?? 1);
      const conditions = normalizeAmbientCondition(rawEntry.conditions);
      const attribution = normalizeAttribution(
        rawEntry.attribution,
        existingEntry?.attribution,
      );
      const reverbOffset = clampNh3dReverbOffset(
        rawEntry.reverbOffset,
        existingEntry?.reverbOffset,
      );
      const uploadSlotKey = createNh3dAmbientUploadSlotKey(trackKey, variationId);
      const uploaded = uploadedSoundFiles[uploadSlotKey];

      if (uploaded instanceof Blob) {
        const uploadedFileName =
          uploaded instanceof File && uploaded.name
            ? uploaded.name
            : rawEntry.fileName || `${trackKey}.bin`;
        const fileName = sanitizeFileName(uploadedFileName, `${trackKey}.bin`);
        const path = resolveNh3dUserAmbientPath(
          nextName,
          trackKey,
          fileName,
          variationId,
        );
        const mimeType =
          normalizeWhitespace(uploaded.type) ||
          normalizeWhitespace(rawEntry.mimeType) ||
          "application/octet-stream";
        await writeSoundFileRecord(fileStore, {
          path,
          packId,
          soundKey: trackKey,
          fileName,
          mimeType,
          blob: uploaded,
          now,
        });
        retainedUserPaths.add(path);
        nextEntries.push({
          id: variationId,
          key: trackKey,
          enabled: Boolean(rawEntry.enabled),
          volume,
          fileName,
          mimeType,
          path,
          source: "user",
          attribution,
          conditions,
          reverbOffset,
        });
        continue;
      }

      if (uploaded === null) {
        pushUnassigned(variationId, volume, attribution, conditions, reverbOffset);
        continue;
      }

      const incomingPath = normalizeWhitespace(rawEntry.path || "");
      const incomingFileName = sanitizeFileName(rawEntry.fileName, "");
      if (!incomingFileName && !incomingPath) {
        pushUnassigned(variationId, volume, attribution, conditions, reverbOffset);
        continue;
      }

      const fileName = incomingFileName || `${trackKey}.bin`;
      const canonicalPath = resolveNh3dUserAmbientPath(
        nextName,
        trackKey,
        fileName,
        variationId,
      );
      const existingSourcePath =
        existingEntry && existingEntry.source === "user"
          ? normalizeWhitespace(existingEntry.path || "")
          : "";
      let sourcePath = existingSourcePath;

      if (!sourcePath && incomingPath && incomingPath !== canonicalPath) {
        const candidateRecord = await readSoundFileRecord(fileStore, incomingPath);
        if (candidateRecord) {
          await writeSoundFileRecord(fileStore, {
            path: canonicalPath,
            packId,
            soundKey: trackKey,
            fileName,
            mimeType: candidateRecord.mimeType,
            blob: candidateRecord.blob,
            now,
          });
          sourcePath = canonicalPath;
        }
      }

      if (sourcePath && sourcePath !== canonicalPath) {
        await moveSoundFileRecord(
          fileStore,
          sourcePath,
          canonicalPath,
          now,
          packId,
          trackKey,
        );
      }

      const ensuredRecord = await readSoundFileRecord(fileStore, canonicalPath);
      if (!ensuredRecord) {
        pushUnassigned(variationId, volume, attribution, conditions, reverbOffset);
        continue;
      }

      retainedUserPaths.add(canonicalPath);
      nextEntries.push({
        id: variationId,
        key: trackKey,
        enabled: Boolean(rawEntry.enabled),
        volume,
        fileName,
        mimeType:
          normalizeWhitespace(rawEntry.mimeType) ||
          normalizeWhitespace(ensuredRecord.mimeType) ||
          "application/octet-stream",
        path: canonicalPath,
        source: "user",
        attribution,
        conditions,
        reverbOffset,
      });
    }

    for (const existingEntry of existingEntries) {
      const existingPath = normalizeWhitespace(existingEntry.path || "");
      if (!existingPath || retainedUserPaths.has(existingPath)) {
        continue;
      }
      await idbRequestToPromise(fileStore.delete(existingPath));
    }

    nextAmbient[trackKey] = ambientAssignmentFromVariations(
      trackKey,
      nextEntries,
      fallback,
    );
  }

  return nextAmbient;
}

export async function saveNh3dSoundPackToIndexedDb(
  pack: Nh3dSoundPackRecord,
  uploadedSoundFiles: Nh3dSoundFileUploadOverrides = {},
): Promise<Nh3dSoundPackRecord> {
  const normalizedPackId = normalizeWhitespace(String(pack.id || ""));
  if (!normalizedPackId) {
    throw new Error("Sound pack id is required.");
  }

  const db = await openDatabase();
  try {
    const transaction = db.transaction(
      [packStoreName, fileStoreName],
      "readwrite",
    );
    const packStore = transaction.objectStore(packStoreName);
    const fileStore = transaction.objectStore(fileStoreName);

    const packs = await getNormalizedPacksForTransaction(packStore);
    const existingPack = packs.find((entry) => entry.id === normalizedPackId);
    if (!existingPack) {
      throw new Error("Sound pack no longer exists.");
    }

    const nextName = existingPack.isDefault
      ? nh3dDefaultSoundPackName
      : normalizeNh3dSoundPackName(pack.name);
    if (!nextName) {
      throw new Error("Sound pack name is required.");
    }

    throwIfPackNameTaken(packs, nextName, existingPack.id);
    const now = Date.now();
    const nextSounds = {} as Nh3dSoundPackSoundMap;

    for (const definition of nh3dSoundEffectDefinitions) {
      const soundKey = definition.key;
      const fallbackDefault = createDefaultSoundAssignment(soundKey);
      const existingSound = existingPack.sounds[soundKey] ?? fallbackDefault;
      const incomingSound = pack.sounds[soundKey] ?? existingSound;
      const existingEntries = soundAssignmentToVariations(existingSound);
      const existingById = new Map(
        existingEntries.map((entry) => [entry.id, entry]),
      );
      const incomingEntriesRaw = soundAssignmentToVariations(incomingSound);
      const seenIncomingIds = new Set<string>();
      const incomingEntries: Nh3dSoundEffectVariation[] = [];

      for (const rawEntry of incomingEntriesRaw) {
        const isBase = rawEntry.id === nh3dBaseSoundVariationId;
        let nextId = isBase
          ? nh3dBaseSoundVariationId
          : normalizeVariationId(rawEntry.id, soundKey);
        if (seenIncomingIds.has(nextId)) {
          if (isBase) {
            continue;
          }
          do {
            nextId = generateSoundVariationId(soundKey);
          } while (seenIncomingIds.has(nextId));
        }
        seenIncomingIds.add(nextId);
        const fallbackEntry =
          existingById.get(nextId) ??
          ({
            ...fallbackDefault,
            key: soundKey,
          } as Nh3dSoundEffectEntryBase);
        const normalizedEntry = normalizeSoundEffectEntry(
          rawEntry,
          soundKey,
          fallbackEntry,
          nextName,
          nextId,
        );
        incomingEntries.push({
          id: nextId,
          ...normalizedEntry,
        });
      }

      if (
        !incomingEntries.some((entry) => entry.id === nh3dBaseSoundVariationId)
      ) {
        incomingEntries.unshift({
          id: nh3dBaseSoundVariationId,
          ...normalizeSoundEffectEntry(
            incomingSound,
            soundKey,
            existingById.get(nh3dBaseSoundVariationId) ?? fallbackDefault,
            nextName,
            nh3dBaseSoundVariationId,
          ),
        });
      }

      if (existingPack.isDefault) {
        for (const existingEntry of existingEntries) {
          if (existingEntry.source !== "user") {
            continue;
          }
          const existingPath = normalizeWhitespace(existingEntry.path || "");
          if (!existingPath) {
            continue;
          }
          await idbRequestToPromise(fileStore.delete(existingPath));
        }
        const baseIncoming =
          incomingEntries.find(
            (entry) => entry.id === nh3dBaseSoundVariationId,
          ) ?? incomingEntries[0];
        nextSounds[soundKey] = {
          ...fallbackDefault,
          enabled: Boolean(baseIncoming?.enabled),
          volume: clampUnit(baseIncoming?.volume, fallbackDefault.volume),
          attribution: fallbackDefault.attribution,
          variations: [],
          reverbOffset: clampNh3dReverbOffset(
            incomingSound.reverbOffset,
            fallbackDefault.reverbOffset,
          ),
        };
        continue;
      }

      const nextEntries: Nh3dSoundEffectVariation[] = [];
      const retainedUserPaths = new Set<string>();

      for (const incomingEntry of incomingEntries) {
        const variationId = incomingEntry.id || nh3dBaseSoundVariationId;
        const fallbackEntry: Nh3dSoundEffectEntryBase = {
          ...fallbackDefault,
          key: soundKey,
        };
        const existingEntry = existingById.get(variationId) ?? {
          id: variationId,
          ...fallbackEntry,
        };
        const enabled = Boolean(incomingEntry.enabled);
        const volume = clampUnit(incomingEntry.volume, existingEntry.volume);
        const uploadSlotKey = createNh3dSoundUploadSlotKey(
          soundKey,
          variationId,
        );
        const uploaded =
          uploadedSoundFiles[uploadSlotKey] ??
          (variationId === nh3dBaseSoundVariationId
            ? uploadedSoundFiles[soundKey]
            : undefined);

        if (uploaded === null) {
          nextEntries.push({
            id: variationId,
            ...fallbackEntry,
            enabled,
            volume,
            attribution: fallbackEntry.attribution,
          });
          continue;
        }

        if (uploaded instanceof Blob) {
          const uploadedFileName =
            uploaded instanceof File && uploaded.name
              ? uploaded.name
              : incomingEntry.fileName || `${soundKey}.bin`;
          const fileName = sanitizeFileName(
            uploadedFileName,
            `${soundKey}.bin`,
          );
          const path = resolveNh3dUserSoundPath(
            nextName,
            soundKey,
            fileName,
            variationId,
          );
          const mimeType =
            normalizeWhitespace(uploaded.type) ||
            normalizeWhitespace(incomingEntry.mimeType) ||
            "application/octet-stream";

          await writeSoundFileRecord(fileStore, {
            path,
            packId: existingPack.id,
            soundKey,
            fileName,
            mimeType,
            blob: uploaded,
            now,
          });

          retainedUserPaths.add(path);
          nextEntries.push({
            id: variationId,
            key: soundKey,
            enabled,
            volume,
            fileName,
            mimeType,
            path,
            source: "user",
            attribution: normalizeAttribution(
              incomingEntry.attribution,
              existingEntry.attribution,
            ),
            reverbOffset: clampNh3dReverbOffset(incomingEntry.reverbOffset, 0),
            pitchVariation: clampNh3dPitchVariation(
              incomingEntry.pitchVariation,
              0,
            ),
          });
          continue;
        }

        const incomingSource: Nh3dSoundEntrySource =
          incomingEntry.source === "user" ? "user" : "builtin";

        if (incomingSource === "user") {
          const fileName = sanitizeFileName(
            incomingEntry.fileName,
            `${soundKey}.bin`,
          );
          const canonicalPath = resolveNh3dUserSoundPath(
            nextName,
            soundKey,
            fileName,
            variationId,
          );
          const existingSourcePath =
            existingEntry.source === "user"
              ? normalizeWhitespace(existingEntry.path || "")
              : "";
          const baseResolvedPathForCopy =
            variationId !== nh3dBaseSoundVariationId
              ? normalizeWhitespace(
                  nextEntries.find(
                    (entry) =>
                      entry.id === nh3dBaseSoundVariationId &&
                      entry.source === "user",
                  )?.path || "",
                )
              : "";
          const candidatePath = normalizeWhitespace(
            incomingEntry.path || baseResolvedPathForCopy,
          );
          let sourcePath = existingSourcePath;

          if (!sourcePath && candidatePath && candidatePath !== canonicalPath) {
            const candidateRecord = await readSoundFileRecord(
              fileStore,
              candidatePath,
            );
            if (candidateRecord) {
              await writeSoundFileRecord(fileStore, {
                path: canonicalPath,
                packId: existingPack.id,
                soundKey,
                fileName,
                mimeType: candidateRecord.mimeType,
                blob: candidateRecord.blob,
                now,
              });
              sourcePath = canonicalPath;
            }
          }

          if (sourcePath && sourcePath !== canonicalPath) {
            await moveSoundFileRecord(
              fileStore,
              sourcePath,
              canonicalPath,
              now,
              existingPack.id,
              soundKey,
            );
          }

          const storedRecord = await readSoundFileRecord(
            fileStore,
            canonicalPath,
          );
          if (!storedRecord && sourcePath && sourcePath !== canonicalPath) {
            await moveSoundFileRecord(
              fileStore,
              sourcePath,
              canonicalPath,
              now,
              existingPack.id,
              soundKey,
            );
          }
          const ensuredRecord = await readSoundFileRecord(
            fileStore,
            canonicalPath,
          );
          if (!ensuredRecord) {
            nextEntries.push({
              id: variationId,
              ...fallbackEntry,
              enabled,
              volume,
              attribution: normalizeAttribution(
                incomingEntry.attribution,
                existingEntry.attribution || fallbackEntry.attribution,
              ),
              reverbOffset: clampNh3dReverbOffset(incomingEntry.reverbOffset, 0),
              pitchVariation: clampNh3dPitchVariation(
                incomingEntry.pitchVariation,
                0,
              ),
            });
            continue;
          }

          retainedUserPaths.add(canonicalPath);
          nextEntries.push({
            id: variationId,
            key: soundKey,
            enabled,
            volume,
            fileName,
            mimeType:
              normalizeWhitespace(incomingEntry.mimeType) ||
              normalizeWhitespace(existingEntry.mimeType) ||
              "application/octet-stream",
            path: canonicalPath,
            source: "user",
            attribution: normalizeAttribution(
              incomingEntry.attribution,
              existingEntry.attribution,
            ),
            reverbOffset: clampNh3dReverbOffset(incomingEntry.reverbOffset, 0),
            pitchVariation: clampNh3dPitchVariation(
              incomingEntry.pitchVariation,
              0,
            ),
          });
          continue;
        }

        nextEntries.push({
          id: variationId,
          ...fallbackEntry,
          enabled,
          volume,
          attribution: normalizeAttribution(
            incomingEntry.attribution,
            existingEntry.attribution || fallbackEntry.attribution,
          ),
          reverbOffset: clampNh3dReverbOffset(incomingEntry.reverbOffset, 0),
          pitchVariation: clampNh3dPitchVariation(
            incomingEntry.pitchVariation,
            0,
          ),
        });
      }

      for (const existingEntry of existingEntries) {
        if (existingEntry.source !== "user") {
          continue;
        }
        const existingPath = normalizeWhitespace(existingEntry.path || "");
        if (!existingPath || retainedUserPaths.has(existingPath)) {
          continue;
        }
        await idbRequestToPromise(fileStore.delete(existingPath));
      }

      nextSounds[soundKey] = soundAssignmentFromVariations(
        soundKey,
        nextEntries,
        fallbackDefault,
      );
    }

    const nextAmbient = await persistAmbientMapForSave(
      fileStore,
      existingPack,
      pack,
      uploadedSoundFiles,
      nextName,
      existingPack.id,
      now,
    );

    const nextPack: Nh3dSoundPackRecord = {
      id: existingPack.id,
      name: nextName,
      isDefault: existingPack.isDefault,
      createdAt: existingPack.createdAt,
      updatedAt: now,
      sounds: nextSounds,
      ambient: nextAmbient,
      reverb: normalizeReverbSettings(pack.reverb),
    };

    await idbRequestToPromise(packStore.put(nextPack));
    await idbTransactionDone(transaction);

    return cloneNh3dSoundPack(nextPack);
  } finally {
    db.close();
  }
}

export async function loadStoredNh3dSoundBlob(
  path: string,
): Promise<Blob | null> {
  const normalizedPath = normalizeWhitespace(String(path || ""));
  if (!normalizedPath) {
    return null;
  }
  const db = await openDatabase();
  try {
    const transaction = db.transaction(fileStoreName, "readonly");
    const fileStore = transaction.objectStore(fileStoreName);
    const rawValue = await idbRequestToPromise(fileStore.get(normalizedPath));
    await idbTransactionDone(transaction);
    const normalized = normalizeSoundFileRecord(rawValue);
    return normalized?.blob ?? null;
  } finally {
    db.close();
  }
}

async function readStoredSoundBlobs(
  paths: string[],
): Promise<Map<string, Blob>> {
  const filteredPaths = paths
    .map((path) => normalizeWhitespace(path))
    .filter((path) => path.length > 0);
  const blobByPath = new Map<string, Blob>();
  if (filteredPaths.length === 0) {
    return blobByPath;
  }

  const db = await openDatabase();
  try {
    const transaction = db.transaction(fileStoreName, "readonly");
    const fileStore = transaction.objectStore(fileStoreName);
    for (const path of filteredPaths) {
      const rawValue = await idbRequestToPromise(fileStore.get(path));
      const normalized = normalizeSoundFileRecord(rawValue);
      if (!normalized) {
        continue;
      }
      blobByPath.set(path, normalized.blob);
    }
    await idbTransactionDone(transaction);
    return blobByPath;
  } finally {
    db.close();
  }
}

export async function exportNh3dSoundPackToZip(
  pack: Nh3dSoundPackRecord,
  pendingUploads: Nh3dSoundFileUploadOverrides = {},
): Promise<Blob> {
  const normalizedPack = normalizeSoundPackRecord(pack);
  if (!normalizedPack) {
    throw new Error("Sound pack data is invalid.");
  }

  const storedPathSet = new Set<string>();
  for (const definition of nh3dSoundEffectDefinitions) {
    const soundKey = definition.key;
    const sound = normalizedPack.sounds[soundKey];
    const entries = soundAssignmentToVariations(sound);
    for (const entry of entries) {
      const uploadSlotKey = createNh3dSoundUploadSlotKey(soundKey, entry.id);
      const pendingUpload =
        pendingUploads[uploadSlotKey] ??
        (entry.id === nh3dBaseSoundVariationId
          ? pendingUploads[soundKey]
          : undefined);
      if (pendingUpload instanceof Blob || pendingUpload === null) {
        continue;
      }
      if (entry.source === "user") {
        const entryPath = normalizeWhitespace(entry.path || "");
        if (entryPath) {
          storedPathSet.add(entryPath);
        }
      }
    }
  }
  for (const definition of nh3dAmbientTrackDefinitions) {
    const trackKey = definition.key;
    const track = normalizedPack.ambient[trackKey];
    const entries = ambientAssignmentToVariations(track);
    for (const entry of entries) {
      const uploadSlotKey = createNh3dAmbientUploadSlotKey(trackKey, entry.id);
      const pendingUpload = pendingUploads[uploadSlotKey];
      if (pendingUpload instanceof Blob || pendingUpload === null) {
        continue;
      }
      const entryPath = normalizeWhitespace(entry.path || "");
      if (entryPath) {
        storedPathSet.add(entryPath);
      }
    }
  }

  const storedBlobsByPath = await readStoredSoundBlobs(
    Array.from(storedPathSet),
  );
  const archiveEntries: Record<string, Uint8Array> = {};
  const manifest: Nh3dSoundPackExportManifest = {
    schema: "nh3d-soundpack",
    version: 5,
    exportedAt: new Date().toISOString(),
    pack: {
      name: normalizedPack.name,
      isDefault: normalizedPack.isDefault,
      reverb: cloneReverbSettings(
        normalizedPack.reverb ?? createNh3dDefaultReverbSettings(),
      ),
      sounds: [],
      ambient: [],
    },
  };

  for (const definition of nh3dSoundEffectDefinitions) {
    const soundKey = definition.key;
    const sound = normalizedPack.sounds[soundKey];
    const entries = soundAssignmentToVariations(sound);
    const baseEntry =
      entries.find((entry) => entry.id === nh3dBaseSoundVariationId) ??
      entries[0];
    if (!baseEntry) {
      continue;
    }
    const variationManifestEntries: Nh3dSoundPackExportManifest["pack"]["sounds"][number]["variations"] =
      [];

    let baseArchivePath: string | null = null;
    let baseBlobForArchive: Blob | null = null;

    for (const entry of entries) {
      const archiveFileName = sanitizeFileName(
        entry.fileName,
        `${soundKey}.bin`,
      );
      const uploadSlotKey = createNh3dSoundUploadSlotKey(soundKey, entry.id);
      const pendingUpload =
        pendingUploads[uploadSlotKey] ??
        (entry.id === nh3dBaseSoundVariationId
          ? pendingUploads[soundKey]
          : undefined);
      const archiveFolder =
        entry.id === nh3dBaseSoundVariationId
          ? "base"
          : sanitizePathSegment(entry.id, "variation");
      let archivePath: string | null = null;
      let blobForArchive: Blob | null = null;

      if (pendingUpload instanceof Blob) {
        blobForArchive = pendingUpload;
        archivePath = `sounds/${soundKey}/${archiveFolder}/${archiveFileName}`;
      } else if (pendingUpload === null) {
        blobForArchive = null;
        archivePath = null;
      } else if (entry.source === "user") {
        const storedBlob = storedBlobsByPath.get(entry.path) ?? null;
        if (storedBlob) {
          blobForArchive = storedBlob;
          archivePath = `sounds/${soundKey}/${archiveFolder}/${archiveFileName}`;
        }
      }

      if (archivePath && blobForArchive) {
        archiveEntries[archivePath] = new Uint8Array(
          await blobForArchive.arrayBuffer(),
        );
      }

      if (entry.id === nh3dBaseSoundVariationId) {
        baseArchivePath = archivePath;
        baseBlobForArchive = blobForArchive;
      } else {
        variationManifestEntries.push({
          id: entry.id,
          enabled: Boolean(entry.enabled),
          volume: clampUnit(entry.volume, 1),
          fileName: archiveFileName,
          mimeType:
            normalizeWhitespace(entry.mimeType) ||
            blobForArchive?.type ||
            "application/octet-stream",
          path: entry.path,
          source: entry.source,
          attribution: normalizeAttribution(entry.attribution),
          reverbOffset: clampNh3dReverbOffset(entry.reverbOffset, 0),
          pitchVariation: clampNh3dPitchVariation(entry.pitchVariation, 0),
          archivePath,
        });
      }
    }

    const baseArchiveFileName = sanitizeFileName(
      baseEntry.fileName,
      `${soundKey}.bin`,
    );
    manifest.pack.sounds.push({
      key: soundKey,
      label: resolveSoundDefinitionLabel(soundKey),
      enabled: Boolean(baseEntry.enabled),
      volume: clampUnit(baseEntry.volume, 1),
      fileName: baseArchiveFileName,
      mimeType:
        normalizeWhitespace(baseEntry.mimeType) ||
        baseBlobForArchive?.type ||
        "application/octet-stream",
      path: baseEntry.path,
      source: baseEntry.source,
      attribution: normalizeAttribution(baseEntry.attribution),
      reverbOffset: clampNh3dReverbOffset(baseEntry.reverbOffset, 0),
      pitchVariation: clampNh3dPitchVariation(baseEntry.pitchVariation, 0),
      archivePath: baseArchivePath,
      variations: variationManifestEntries,
    });
  }

  for (const definition of nh3dAmbientTrackDefinitions) {
    const trackKey = definition.key;
    const track = normalizedPack.ambient[trackKey];
    const entries = ambientAssignmentToVariations(track);
    const baseEntry =
      entries.find((entry) => entry.id === nh3dBaseSoundVariationId) ??
      entries[0];
    if (!baseEntry) {
      continue;
    }
    const variationManifestEntries: Nh3dSoundPackExportManifest["pack"]["ambient"][number]["variations"] =
      [];
    let baseArchivePath: string | null = null;
    let baseBlobForArchive: Blob | null = null;

    for (const entry of entries) {
      const archiveFileName = sanitizeFileName(
        entry.fileName,
        `${trackKey}.bin`,
      );
      const uploadSlotKey = createNh3dAmbientUploadSlotKey(trackKey, entry.id);
      const pendingUpload = pendingUploads[uploadSlotKey];
      const archiveFolder =
        entry.id === nh3dBaseSoundVariationId
          ? "base"
          : sanitizePathSegment(entry.id, "variation");
      let archivePath: string | null = null;
      let blobForArchive: Blob | null = null;

      if (pendingUpload instanceof Blob) {
        blobForArchive = pendingUpload;
        archivePath = `ambient/${trackKey}/${archiveFolder}/${archiveFileName}`;
      } else if (pendingUpload === null) {
        blobForArchive = null;
        archivePath = null;
      } else {
        const entryPath = normalizeWhitespace(entry.path || "");
        const storedBlob = entryPath
          ? (storedBlobsByPath.get(entryPath) ?? null)
          : null;
        if (storedBlob) {
          blobForArchive = storedBlob;
          archivePath = `ambient/${trackKey}/${archiveFolder}/${archiveFileName}`;
        }
      }

      if (archivePath && blobForArchive) {
        archiveEntries[archivePath] = new Uint8Array(
          await blobForArchive.arrayBuffer(),
        );
      }

      if (entry.id === nh3dBaseSoundVariationId) {
        baseArchivePath = archivePath;
        baseBlobForArchive = blobForArchive;
      } else {
        variationManifestEntries.push({
          id: entry.id,
          enabled: Boolean(entry.enabled),
          volume: clampUnit(entry.volume, 1),
          fileName: archiveFileName,
          mimeType:
            normalizeWhitespace(entry.mimeType) ||
            blobForArchive?.type ||
            "application/octet-stream",
          path: entry.path,
          source: entry.source,
          attribution: normalizeAttribution(entry.attribution),
          conditions: cloneAmbientCondition(entry.conditions),
          reverbOffset: clampNh3dReverbOffset(entry.reverbOffset, 0),
          archivePath,
        });
      }
    }

    const baseArchiveFileName = sanitizeFileName(
      baseEntry.fileName,
      `${trackKey}.bin`,
    );
    manifest.pack.ambient.push({
      key: trackKey,
      label: definition.label,
      reverbOffset: clampNh3dReverbOffset(baseEntry.reverbOffset, 0),
      enabled: Boolean(baseEntry.enabled),
      volume: clampUnit(baseEntry.volume, 1),
      fileName: baseArchiveFileName,
      mimeType:
        normalizeWhitespace(baseEntry.mimeType) ||
        baseBlobForArchive?.type ||
        "application/octet-stream",
      path: baseEntry.path,
      source: baseEntry.source,
      attribution: normalizeAttribution(baseEntry.attribution),
      conditions: cloneAmbientCondition(baseEntry.conditions),
      archivePath: baseArchivePath,
      variations: variationManifestEntries,
    });
  }

  archiveEntries[soundPackManifestPath] = strToU8(
    JSON.stringify(manifest, null, 2),
  );
  const zipBytes = zipSync(archiveEntries, { level: 6 });
  return new Blob([toArrayBufferBackedUint8Array(zipBytes)], {
    type: "application/zip",
  });
}

function parseImportManifest(rawManifest: unknown): {
  packName: string;
  soundsByKey: Map<Nh3dSoundEffectKey, ParsedImportSoundEntry>;
  ambientByKey: Map<Nh3dAmbientTrackKey, ParsedImportAmbientEntry>;
  reverb: Nh3dSoundPackReverbSettings | null;
} {
  if (!isRecordLike(rawManifest)) {
    throw new Error("Invalid sound pack archive manifest.");
  }
  const rawVersion = Number(rawManifest.version);
  if (
    rawManifest.schema !== "nh3d-soundpack" ||
    !Number.isFinite(rawVersion) ||
    (rawVersion !== 1 &&
      rawVersion !== 2 &&
      rawVersion !== 3 &&
      rawVersion !== 4 &&
      rawVersion !== 5)
  ) {
    throw new Error("Unsupported sound pack archive format.");
  }
  if (!isRecordLike(rawManifest.pack)) {
    throw new Error("Sound pack archive is missing pack metadata.");
  }
  const packName =
    normalizeNh3dSoundPackName(String(rawManifest.pack.name || "")) ||
    "Imported Sound Pack";
  const reverb = isRecordLike(rawManifest.pack.reverb)
    ? normalizeReverbSettings(rawManifest.pack.reverb)
    : null;

  const rawSounds = Array.isArray(rawManifest.pack.sounds)
    ? rawManifest.pack.sounds
    : [];
  const soundsByKey = new Map<Nh3dSoundEffectKey, ParsedImportSoundEntry>();

  for (const rawEntry of rawSounds) {
    if (!isRecordLike(rawEntry)) {
      continue;
    }
    const rawKey = String(rawEntry.key || "");
    const key = rawKey as Nh3dSoundEffectKey;
    if (
      !nh3dSoundEffectDefinitions.some((definition) => definition.key === key)
    ) {
      continue;
    }
    const source: Nh3dSoundEntrySource =
      rawEntry.source === "user" ? "user" : "builtin";
    const targetKeys: Nh3dSoundEffectKey[] = [key];
    for (const targetKey of targetKeys) {
      const parsedEntry: ParsedImportSoundEntry = {
        key: targetKey,
        enabled: Boolean(rawEntry.enabled),
        volume: clampUnit(rawEntry.volume, 1),
        fileName: sanitizeFileName(
          String(rawEntry.fileName || ""),
          `${targetKey}.bin`,
        ),
        mimeType:
          normalizeWhitespace(String(rawEntry.mimeType || "")) ||
          (source === "user" ? "application/octet-stream" : "audio/ogg"),
        path:
          normalizeWhitespace(String(rawEntry.path || "")) ||
          (source === "user"
            ? resolveNh3dUserSoundPath(packName, targetKey, `${targetKey}.bin`)
            : (resolveNh3dBundledBuiltinSoundPath(targetKey) ?? "")),
        source,
        attribution: normalizeAttribution(rawEntry.attribution),
        reverbOffset: clampNh3dReverbOffset(rawEntry.reverbOffset, 0),
        pitchVariation: clampNh3dPitchVariation(rawEntry.pitchVariation, 0),
        archivePath:
          normalizeWhitespace(String(rawEntry.archivePath || "")) || null,
        variations: [],
      };

      const rawVariations = Array.isArray(rawEntry.variations)
        ? rawEntry.variations
        : [];
      const seenVariationIds = new Set<string>();
      for (const rawVariation of rawVariations) {
        if (!isRecordLike(rawVariation)) {
          continue;
        }
        const variationSource: Nh3dSoundEntrySource =
          rawVariation.source === "user" ? "user" : "builtin";
        const variationId = normalizeVariationId(rawVariation.id, targetKey);
        if (
          variationId === nh3dBaseSoundVariationId ||
          seenVariationIds.has(variationId)
        ) {
          continue;
        }
        seenVariationIds.add(variationId);
        const variation: ParsedImportSoundVariationEntry = {
          id: variationId,
          enabled: Boolean(rawVariation.enabled),
          volume: clampUnit(rawVariation.volume, 1),
          fileName: sanitizeFileName(
            String(rawVariation.fileName || ""),
            `${targetKey}.bin`,
          ),
          mimeType:
            normalizeWhitespace(String(rawVariation.mimeType || "")) ||
            (variationSource === "user"
              ? "application/octet-stream"
              : "audio/ogg"),
          path:
            normalizeWhitespace(String(rawVariation.path || "")) ||
            (variationSource === "user"
              ? resolveNh3dUserSoundPath(
                  packName,
                  targetKey,
                  `${targetKey}.bin`,
                  variationId,
                )
              : (resolveNh3dBundledBuiltinSoundPath(targetKey) ?? "")),
          source: variationSource,
          attribution: normalizeAttribution(rawVariation.attribution),
          reverbOffset: clampNh3dReverbOffset(rawVariation.reverbOffset, 0),
          pitchVariation: clampNh3dPitchVariation(
            rawVariation.pitchVariation,
            0,
          ),
          archivePath:
            normalizeWhitespace(String(rawVariation.archivePath || "")) || null,
        };
        parsedEntry.variations.push(variation);
      }

      if (!soundsByKey.has(targetKey)) {
        soundsByKey.set(targetKey, parsedEntry);
      }
    }
  }

  const rawAmbient = Array.isArray(rawManifest.pack.ambient)
    ? rawManifest.pack.ambient
    : [];
  const ambientByKey = new Map<Nh3dAmbientTrackKey, ParsedImportAmbientEntry>();
  for (const rawEntry of rawAmbient) {
    if (!isRecordLike(rawEntry)) {
      continue;
    }
    const trackKey = String(rawEntry.key || "") as Nh3dAmbientTrackKey;
    if (
      !nh3dAmbientTrackDefinitions.some(
        (definition) => definition.key === trackKey,
      )
    ) {
      continue;
    }
    if (ambientByKey.has(trackKey)) {
      continue;
    }
    const parsedEntry: ParsedImportAmbientEntry = {
      key: trackKey,
      enabled: Boolean(rawEntry.enabled),
      volume: clampUnit(rawEntry.volume, 1),
      fileName: sanitizeFileName(String(rawEntry.fileName || ""), ""),
      mimeType:
        normalizeWhitespace(String(rawEntry.mimeType || "")) ||
        "application/octet-stream",
      path: normalizeWhitespace(String(rawEntry.path || "")),
      attribution: normalizeAttribution(rawEntry.attribution),
      conditions: normalizeAmbientCondition(rawEntry.conditions),
      reverbOffset: clampNh3dReverbOffset(rawEntry.reverbOffset, 0),
      archivePath:
        normalizeWhitespace(String(rawEntry.archivePath || "")) || null,
      variations: [],
    };

    const rawVariations = Array.isArray(rawEntry.variations)
      ? rawEntry.variations
      : [];
    const seenVariationIds = new Set<string>();
    for (const rawVariation of rawVariations) {
      if (!isRecordLike(rawVariation)) {
        continue;
      }
      const variationId = normalizeAmbientVariationId(rawVariation.id, trackKey);
      if (
        variationId === nh3dBaseSoundVariationId ||
        seenVariationIds.has(variationId)
      ) {
        continue;
      }
      seenVariationIds.add(variationId);
      parsedEntry.variations.push({
        id: variationId,
        enabled: Boolean(rawVariation.enabled),
        volume: clampUnit(rawVariation.volume, 1),
        fileName: sanitizeFileName(String(rawVariation.fileName || ""), ""),
        mimeType:
          normalizeWhitespace(String(rawVariation.mimeType || "")) ||
          "application/octet-stream",
        path: normalizeWhitespace(String(rawVariation.path || "")),
        attribution: normalizeAttribution(rawVariation.attribution),
        conditions: normalizeAmbientCondition(rawVariation.conditions),
        reverbOffset: clampNh3dReverbOffset(rawVariation.reverbOffset, 0),
        archivePath:
          normalizeWhitespace(String(rawVariation.archivePath || "")) || null,
      });
    }

    ambientByKey.set(trackKey, parsedEntry);
  }

  return {
    packName,
    soundsByKey,
    ambientByKey,
    reverb,
  };
}

async function unzipArchiveEntries(
  zipBlob: Blob,
): Promise<Record<string, Uint8Array>> {
  const bytes = new Uint8Array(await zipBlob.arrayBuffer());
  try {
    return unzipSync(bytes);
  } catch {
    throw new Error("Failed to read sound pack ZIP archive.");
  }
}

export async function importNh3dSoundPackFromZip(
  zipBlob: Blob,
  options: {
    intoDefaultSlot?: boolean;
  } = {},
): Promise<Nh3dSoundPackRecord> {
  const archiveEntries = await unzipArchiveEntries(zipBlob);
  const manifestBytes = archiveEntries[soundPackManifestPath];
  if (!manifestBytes) {
    throw new Error("Sound pack ZIP is missing manifest.json.");
  }

  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error("Sound pack manifest.json is not valid JSON.");
  }

  const manifest = parseImportManifest(parsedManifest);
  const db = await openDatabase();

  try {
    const transaction = db.transaction(
      [packStoreName, fileStoreName, metaStoreName],
      "readwrite",
    );
    const packStore = transaction.objectStore(packStoreName);
    const fileStore = transaction.objectStore(fileStoreName);
    const metaStore = transaction.objectStore(metaStoreName);

    const existingPacks = await getNormalizedPacksForTransaction(packStore);
    for (const pack of existingPacks) {
      await idbRequestToPromise(packStore.put(pack));
    }

    const intoDefaultSlot = options.intoDefaultSlot === true;
    const uniqueName = intoDefaultSlot
      ? nh3dDefaultSoundPackName
      : resolveUniqueSoundPackName(manifest.packName, existingPacks);
    const now = Date.now();
    const nextPackId = intoDefaultSlot
      ? nh3dDefaultSoundPackId
      : generateSoundPackId();
    const existingDefaultPack = intoDefaultSlot
      ? (existingPacks.find((pack) => pack.id === nh3dDefaultSoundPackId) ??
        createDefaultSoundPackRecord(now))
      : null;
    const defaultPack =
      existingPacks.find((pack) => pack.id === nh3dDefaultSoundPackId) ??
      createDefaultSoundPackRecord(now);
    if (intoDefaultSlot && existingDefaultPack) {
      await deleteUserSoundFilesForPack(fileStore, existingDefaultPack);
    }

    const nextSounds = {} as Nh3dSoundPackSoundMap;

    for (const definition of nh3dSoundEffectDefinitions) {
      const soundKey = definition.key;
      const defaultSound =
        defaultPack.sounds[soundKey] ?? createDefaultSoundAssignment(soundKey);
      const imported = manifest.soundsByKey.get(soundKey);
      const baseImported = imported ?? {
        key: soundKey,
        enabled: defaultSound.enabled,
        volume: defaultSound.volume,
        fileName: defaultSound.fileName,
        mimeType: defaultSound.mimeType,
        path: defaultSound.path,
        source: defaultSound.source,
        attribution: defaultSound.attribution,
        reverbOffset: defaultSound.reverbOffset,
        pitchVariation: defaultSound.pitchVariation,
        archivePath: null,
        variations: [],
      };

      const nextEntries: Nh3dSoundEffectVariation[] = [];
      const importedEntries: Array<
        ParsedImportSoundEntry | ParsedImportSoundVariationEntry
      > = [baseImported, ...(baseImported.variations ?? [])];

      for (const [entryIndex, importedEntry] of importedEntries.entries()) {
        const isBase = entryIndex === 0;
        const variationId = isBase
          ? nh3dBaseSoundVariationId
          : normalizeVariationId(
              (importedEntry as ParsedImportSoundVariationEntry).id,
              soundKey,
            );
        const archivePath = importedEntry.archivePath;
        const archiveBytes = archivePath
          ? archiveEntries[archivePath]
          : undefined;

        if (archiveBytes instanceof Uint8Array) {
          const fileName = sanitizeFileName(
            importedEntry.fileName || `${soundKey}.bin`,
            `${soundKey}.bin`,
          );
          const mimeType =
            normalizeWhitespace(importedEntry.mimeType || "") ||
            "application/octet-stream";
          const path = resolveNh3dUserSoundPath(
            uniqueName,
            soundKey,
            fileName,
            variationId,
          );
          const fileBlob = new Blob(
            [toArrayBufferBackedUint8Array(archiveBytes)],
            { type: mimeType },
          );

          await writeSoundFileRecord(fileStore, {
            path,
            packId: nextPackId,
            soundKey,
            fileName,
            mimeType,
            blob: fileBlob,
            now,
          });

          nextEntries.push({
            id: variationId,
            key: soundKey,
            enabled: Boolean(importedEntry.enabled),
            volume: clampUnit(importedEntry.volume, defaultSound.volume),
            fileName,
            mimeType,
            path,
            source: "user",
            attribution: normalizeAttribution(
              importedEntry.attribution,
              defaultSound.attribution,
            ),
            reverbOffset: clampNh3dReverbOffset(importedEntry.reverbOffset, 0),
            pitchVariation: clampNh3dPitchVariation(
              importedEntry.pitchVariation,
              0,
            ),
          });
          continue;
        }

        if (importedEntry.source === "user") {
          const fileName = sanitizeFileName(
            importedEntry.fileName || `${soundKey}.bin`,
            `${soundKey}.bin`,
          );
          const path = resolveNh3dUserSoundPath(
            uniqueName,
            soundKey,
            fileName,
            variationId,
          );
          nextEntries.push({
            id: variationId,
            key: soundKey,
            enabled: Boolean(importedEntry.enabled),
            volume: clampUnit(importedEntry.volume, defaultSound.volume),
            fileName,
            mimeType:
              normalizeWhitespace(importedEntry.mimeType || "") ||
              "application/octet-stream",
            path,
            source: "user",
            attribution: normalizeAttribution(
              importedEntry.attribution,
              defaultSound.attribution,
            ),
            reverbOffset: clampNh3dReverbOffset(importedEntry.reverbOffset, 0),
            pitchVariation: clampNh3dPitchVariation(
              importedEntry.pitchVariation,
              0,
            ),
          });
          continue;
        }

        nextEntries.push({
          id: variationId,
          ...createBundledBuiltinSoundEntryBase(soundKey, {
            enabled: Boolean(importedEntry.enabled),
            volume: clampUnit(importedEntry.volume, defaultSound.volume),
            attribution: normalizeAttribution(
              importedEntry.attribution,
              defaultSound.attribution,
            ),
          }),
          reverbOffset: clampNh3dReverbOffset(importedEntry.reverbOffset, 0),
          pitchVariation: clampNh3dPitchVariation(
            importedEntry.pitchVariation,
            0,
          ),
        });
      }

      nextSounds[soundKey] = soundAssignmentFromVariations(
        soundKey,
        nextEntries,
        defaultSound,
      );
    }

    let nextAmbient: Nh3dSoundPackAmbientMap;
    if (
      intoDefaultSlot &&
      manifest.ambientByKey.size === 0 &&
      existingDefaultPack
    ) {
      // Re-importing the bundled default pack (which carries no ambient music):
      // preserve any ambient tracks the user added to the default pack.
      nextAmbient = cloneAmbientMap(existingDefaultPack.ambient);
    } else {
      if (intoDefaultSlot && existingDefaultPack) {
        await deleteUserAmbientFilesForPack(fileStore, existingDefaultPack);
      }
      nextAmbient = {} as Nh3dSoundPackAmbientMap;
      for (const definition of nh3dAmbientTrackDefinitions) {
        const trackKey = definition.key;
        const fallback = createDefaultAmbientAssignment(trackKey);
        const imported = manifest.ambientByKey.get(trackKey);
        if (!imported) {
          nextAmbient[trackKey] = fallback;
          continue;
        }
        const importedEntries: Array<
          ParsedImportAmbientEntry | ParsedImportAmbientVariationEntry
        > = [imported, ...(imported.variations ?? [])];
        const nextEntries: Nh3dAmbientTrackVariation[] = [];

        for (const [entryIndex, importedEntry] of importedEntries.entries()) {
          const isBase = entryIndex === 0;
          const variationId = isBase
            ? nh3dBaseSoundVariationId
            : normalizeAmbientVariationId(
                (importedEntry as ParsedImportAmbientVariationEntry).id,
                trackKey,
              );
          const conditions = cloneAmbientCondition(importedEntry.conditions);
          const archivePath = importedEntry.archivePath;
          const archiveBytes = archivePath
            ? archiveEntries[archivePath]
            : undefined;

          if (archiveBytes instanceof Uint8Array) {
            const fileName = sanitizeFileName(
              importedEntry.fileName || `${trackKey}.bin`,
              `${trackKey}.bin`,
            );
            const mimeType =
              normalizeWhitespace(importedEntry.mimeType || "") ||
              "application/octet-stream";
            const path = resolveNh3dUserAmbientPath(
              uniqueName,
              trackKey,
              fileName,
              variationId,
            );
            const fileBlob = new Blob(
              [toArrayBufferBackedUint8Array(archiveBytes)],
              { type: mimeType },
            );
            await writeSoundFileRecord(fileStore, {
              path,
              packId: nextPackId,
              soundKey: trackKey,
              fileName,
              mimeType,
              blob: fileBlob,
              now,
            });
            nextEntries.push({
              id: variationId,
              key: trackKey,
              enabled: Boolean(importedEntry.enabled),
              volume: clampUnit(importedEntry.volume, 1),
              fileName,
              mimeType,
              path,
              source: "user",
              attribution: normalizeAttribution(importedEntry.attribution),
              conditions,
              reverbOffset: clampNh3dReverbOffset(importedEntry.reverbOffset, 0),
            });
            continue;
          }

          if (isBase) {
            nextEntries.push({
              id: nh3dBaseSoundVariationId,
              key: trackKey,
              enabled: false,
              volume: clampUnit(importedEntry.volume, 1),
              fileName: "",
              mimeType: "",
              path: "",
              source: "user",
              attribution: normalizeAttribution(importedEntry.attribution),
              conditions,
              reverbOffset: clampNh3dReverbOffset(importedEntry.reverbOffset, 0),
            });
          }
        }

        nextAmbient[trackKey] = ambientAssignmentFromVariations(
          trackKey,
          nextEntries,
          fallback,
        );
      }
    }

    const importedReverb =
      intoDefaultSlot && manifest.reverb === null && existingDefaultPack
        ? cloneReverbSettings(
            existingDefaultPack.reverb ?? createNh3dDefaultReverbSettings(),
          )
        : (manifest.reverb ?? createNh3dDefaultReverbSettings());

    const importedPack: Nh3dSoundPackRecord = {
      id: nextPackId,
      name: uniqueName,
      isDefault: intoDefaultSlot,
      createdAt: intoDefaultSlot
        ? (existingDefaultPack?.createdAt ?? now)
        : now,
      updatedAt: now,
      sounds: nextSounds,
      ambient: nextAmbient,
      reverb: importedReverb,
    };

    await idbRequestToPromise(packStore.put(importedPack));
    const metaRecord: Nh3dMetaRecord = {
      key: activePackMetaKey,
      value: intoDefaultSlot ? nh3dDefaultSoundPackId : importedPack.id,
      updatedAt: now,
    };
    await idbRequestToPromise(metaStore.put(metaRecord));
    await idbTransactionDone(transaction);

    return cloneNh3dSoundPack(importedPack);
  } finally {
    db.close();
  }
}
