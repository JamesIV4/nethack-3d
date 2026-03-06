import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export type Nh3dMessageLogKeyword = string | RegExp;

type Nh3dSoundEffectDefinitionShape = {
  key: string;
  label: string;
  messageLogKeywords?: readonly Nh3dMessageLogKeyword[];
};

export const nh3dSoundEffectDefinitions = [
  { key: "player-walk", label: "Player walk" },
  { key: "player-run", label: "Player run" },
  // { key: "monster-footstep", label: "Monster footstep" },
  { key: "hit", label: "Hit" },
  { key: "monster-killed", label: "Monster killed (player)" },
  { key: "monster-killed-other", label: "Monster killed (other)" },
  // { key: "player-hurt", label: "Player hurt" },
  {
    key: "missed-attack",
    label: "Missed attack",
    messageLogKeywords: [/\bmiss\b/i, /\bmisses\b/i],
  },
  {
    key: "door-opens",
    label: "Door opens",
    messageLogKeywords: [/\bdoor\b.*\bopens?\b/i, /\bopens?\b.*\bdoor\b/i],
  },
  {
    key: "door-closes",
    label: "Door closes",
    messageLogKeywords: [/\bdoor\b.*\bcloses?\b/i, /\bcloses?\b.*\bdoor\b/i],
  },
  {
    key: "walk-down-stairs",
    label: "Walk down stairs",
    messageLogKeywords: ["You descend the stairs."],
  },
  {
    key: "walk-up-stairs",
    label: "Walk up stairs",
    messageLogKeywords: ["You ascend the stairs."],
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
    label: "Eating",
    messageLogKeywords: ["you eat", "you finish eating", "tastes"],
  },
  {
    key: "drink",
    label: "Drink",
    messageLogKeywords: ["The cool draught refreshes you."],
  },
  {
    key: "quaff-potion",
    label: "Quaff a potion",
    messageLogKeywords: ["you quaff"],
  },
  {
    key: "pickup-gold",
    label: "Pick up gold",
    messageLogKeywords: ["gold pieces"],
  },
  {
    key: "pickup-item",
    label: "Pick up item",
    messageLogKeywords: [/[a-z] - /i],
  },
  {
    key: "find-hidden",
    label: "Find hidden door/passage",
    messageLogKeywords: ["find a hidden"],
  },
  {
    key: "level-up",
    label: "Level up",
    messageLogKeywords: ["Welcome to experience level"],
  },
  {
    key: "unlock",
    label: "Unlock",
    messageLogKeywords: ["unlock"],
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
    key: "searching",
    label: "Searching",
    messageLogKeywords: [
      /\byou find\b.*\b(?:hidden|secret|trap|door)\b/i,
      /\byou pick up\b.*\bgold\b/i,
    ],
  },
  {
    key: "magic-cast",
    label: "Magic cast",
    messageLogKeywords: ["you cast"],
  },
  {
    key: "magic-heal",
    label: "Magic heal",
    messageLogKeywords: ["you feel better"],
  },
  {
    key: "magic-buff",
    label: "Magic buff",
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

type Nh3dSoundEffectEntryBase = {
  key: Nh3dSoundEffectKey;
  enabled: boolean;
  volume: number;
  fileName: string;
  mimeType: string;
  path: string;
  source: Nh3dSoundEntrySource;
  attribution: string;
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
};

export type Nh3dLoadedSoundPackState = {
  packs: Nh3dSoundPackRecord[];
  activePackId: string;
};

export type Nh3dSoundFileUploadOverrides = Partial<Record<string, Blob | null>>;

type Nh3dStoredSoundFileRecord = {
  path: string;
  packId: string;
  soundKey: Nh3dSoundEffectKey;
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

type Nh3dSoundPackExportManifest = {
  schema: "nh3d-soundpack";
  version: 2;
  exportedAt: string;
  pack: {
    name: string;
    isDefault: boolean;
    sounds: Array<{
      key: Nh3dSoundEffectKey;
      label: string;
      enabled: boolean;
      volume: number;
      fileName: string;
      mimeType: string;
      path: string;
      source: Nh3dSoundEntrySource;
      attribution: string;
      archivePath: string | null;
      variations: Array<{
        id: string;
        enabled: boolean;
        volume: number;
        fileName: string;
        mimeType: string;
        path: string;
        source: Nh3dSoundEntrySource;
        attribution: string;
        archivePath: string | null;
      }>;
    }>;
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
  archivePath: string | null;
  variations: ParsedImportSoundVariationEntry[];
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
  if (key === "player-walk" || key === "player-run") {
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

function normalizeMessageLogText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function doesMessageLogKeywordMatch(
  keyword: Nh3dMessageLogKeyword,
  message: string,
  normalizedLowerMessage: string,
): boolean {
  if (typeof keyword === "string") {
    const normalizedKeyword = normalizeMessageLogText(keyword).toLowerCase();
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

  const normalizedLowerMessage = normalizedMessage.toLowerCase();
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

function clampUnit(value: unknown, fallback = 1): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(4))));
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
  const defaultFileName = resolveDefaultFileName(key);
  const defaultLabel = resolveSoundDefinitionLabel(key);
  return {
    key,
    enabled: true,
    volume: 1,
    fileName: defaultFileName,
    mimeType: "audio/ogg",
    path: resolveNh3dDefaultSoundPath(key),
    source: "builtin",
    attribution: `Sound not added yet`,
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
    variations: extraVariations,
  };
}

export function cloneNh3dSoundPack(
  pack: Nh3dSoundPackRecord,
): Nh3dSoundPackRecord {
  return {
    ...pack,
    sounds: cloneSoundMap(pack.sounds),
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
    };
  }
  const source: Nh3dSoundEntrySource =
    rawValue.source === "user" ? "user" : "builtin";
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
    };
  }

  return {
    key: soundKey,
    enabled,
    volume,
    fileName: resolveDefaultFileName(soundKey),
    mimeType: "audio/ogg",
    path: resolveNh3dDefaultSoundPath(soundKey),
    source: "builtin",
    attribution,
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
      rawSounds && (soundKey === "player-walk" || soundKey === "player-run")
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
  const soundKey = String(rawValue.soundKey || "") as Nh3dSoundEffectKey;
  if (
    !nh3dSoundEffectDefinitions.some(
      (definition) => definition.key === soundKey,
    )
  ) {
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
    soundKey: Nh3dSoundEffectKey;
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
  forcedKey: Nh3dSoundEffectKey,
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
          key: soundKey,
          enabled: defaultEntry.enabled,
          volume: defaultEntry.volume,
          fileName: resolveDefaultFileName(soundKey),
          mimeType: "audio/ogg",
          path: resolveNh3dDefaultSoundPath(soundKey),
          source: "builtin",
          attribution: normalizeAttribution(
            defaultEntry.attribution,
            fallbackDefault.attribution,
          ),
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
    const nextPack: Nh3dSoundPackRecord = {
      id: nextPackId,
      name: normalizedName,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      sounds: nextSounds,
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

    const nextPack: Nh3dSoundPackRecord = {
      id: existingPack.id,
      name: nextName,
      isDefault: existingPack.isDefault,
      createdAt: existingPack.createdAt,
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

  const storedBlobsByPath = await readStoredSoundBlobs(
    Array.from(storedPathSet),
  );
  const archiveEntries: Record<string, Uint8Array> = {};
  const manifest: Nh3dSoundPackExportManifest = {
    schema: "nh3d-soundpack",
    version: 2,
    exportedAt: new Date().toISOString(),
    pack: {
      name: normalizedPack.name,
      isDefault: normalizedPack.isDefault,
      sounds: [],
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
      archivePath: baseArchivePath,
      variations: variationManifestEntries,
    });
  }

  archiveEntries[soundPackManifestPath] = strToU8(
    JSON.stringify(manifest, null, 2),
  );
  const zipBytes = zipSync(archiveEntries, { level: 6 });
  return new Blob([zipBytes], { type: "application/zip" });
}

function parseImportManifest(rawManifest: unknown): {
  packName: string;
  soundsByKey: Map<Nh3dSoundEffectKey, ParsedImportSoundEntry>;
} {
  if (!isRecordLike(rawManifest)) {
    throw new Error("Invalid sound pack archive manifest.");
  }
  const rawVersion = Number(rawManifest.version);
  if (
    rawManifest.schema !== "nh3d-soundpack" ||
    !Number.isFinite(rawVersion) ||
    (rawVersion !== 1 && rawVersion !== 2)
  ) {
    throw new Error("Unsupported sound pack archive format.");
  }
  if (!isRecordLike(rawManifest.pack)) {
    throw new Error("Sound pack archive is missing pack metadata.");
  }
  const packName =
    normalizeNh3dSoundPackName(String(rawManifest.pack.name || "")) ||
    "Imported Sound Pack";

  const rawSounds = Array.isArray(rawManifest.pack.sounds)
    ? rawManifest.pack.sounds
    : [];
  const soundsByKey = new Map<Nh3dSoundEffectKey, ParsedImportSoundEntry>();

  for (const rawEntry of rawSounds) {
    if (!isRecordLike(rawEntry)) {
      continue;
    }
    const rawKey = String(rawEntry.key || "");
    const isLegacyPlayerFootstep = rawKey === "player-footstep";
    const key = rawKey as Nh3dSoundEffectKey;
    if (
      !isLegacyPlayerFootstep &&
      !nh3dSoundEffectDefinitions.some((definition) => definition.key === key)
    ) {
      continue;
    }
    const source: Nh3dSoundEntrySource =
      rawEntry.source === "user" ? "user" : "builtin";
    const targetKeys: Nh3dSoundEffectKey[] = isLegacyPlayerFootstep
      ? ["player-walk", "player-run"]
      : [key];
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
            : resolveNh3dDefaultSoundPath(targetKey)),
        source,
        attribution: normalizeAttribution(rawEntry.attribution),
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
              : resolveNh3dDefaultSoundPath(targetKey)),
          source: variationSource,
          attribution: normalizeAttribution(rawVariation.attribution),
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

  return {
    packName,
    soundsByKey,
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
          const fileBlob = new Blob([archiveBytes], { type: mimeType });

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
          });
          continue;
        }

        nextEntries.push({
          id: variationId,
          key: soundKey,
          enabled: Boolean(importedEntry.enabled),
          volume: clampUnit(importedEntry.volume, defaultSound.volume),
          fileName: resolveDefaultFileName(soundKey),
          mimeType: "audio/ogg",
          path: resolveNh3dDefaultSoundPath(soundKey),
          source: "builtin",
          attribution: normalizeAttribution(
            importedEntry.attribution,
            defaultSound.attribution,
          ),
        });
      }

      nextSounds[soundKey] = soundAssignmentFromVariations(
        soundKey,
        nextEntries,
        defaultSound,
      );
    }

    const importedPack: Nh3dSoundPackRecord = {
      id: nextPackId,
      name: uniqueName,
      isDefault: intoDefaultSlot,
      createdAt: intoDefaultSlot
        ? (existingDefaultPack?.createdAt ?? now)
        : now,
      updatedAt: now,
      sounds: nextSounds,
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
