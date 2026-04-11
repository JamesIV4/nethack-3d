import type {
  NethackMenuItem,
  PlayerStatsSnapshot,
} from "../game/ui-types";
import { resolveRuntimeSaveDbNames } from "./save-storage";
import type { NethackRuntimeVersion } from "./types";

const scoreDetailsDbName = "nh3d-top-score-details-v1";
const scoreDetailsDbVersion = 1;
const scoreDetailsStoreName = "details";

export type TopScoreSource = "xlogfile" | "record" | "nh3d-snapshot";

export type TopScoreInventoryItem = {
  text: string;
  accelerator?: string;
  isCategory?: boolean;
  glyphChar?: string;
  tileIndex?: number;
};

export type TopScoreDetailSnapshot = {
  id: string;
  runtimeVersion: NethackRuntimeVersion;
  capturedAtMs: number;
  capturedAtIso: string;
  scoreKey: string;
  fallbackScoreKey: string;
  playerName: string;
  points: number | null;
  turns: number | null;
  deathMessage: string;
  attributes: Record<string, string>;
  playerStats: Partial<PlayerStatsSnapshot>;
  inventory: TopScoreInventoryItem[];
  tombstoneLines: string[];
};

export type TopScoreRecord = {
  id: string;
  source: TopScoreSource;
  sourceDbName: string;
  sourcePath: string;
  sourceLine: number;
  rank: number;
  points: number;
  version: string;
  deathdnum: number | null;
  deathlev: number | null;
  maxlvl: number | null;
  hp: number | null;
  maxhp: number | null;
  deaths: number | null;
  deathdate: string;
  birthdate: string;
  uid: number | null;
  role: string;
  race: string;
  gender: string;
  align: string;
  name: string;
  death: string;
  whileHelpless: string;
  conductHex: string;
  conductLabels: string[];
  turns: number | null;
  achieveHex: string;
  achievementLabels: string[];
  realtimeSeconds: number | null;
  starttime: string;
  endtime: string;
  gender0: string;
  align0: string;
  flagsHex: string;
  flagLabels: string[];
  rawFields: Record<string, string>;
  rawLine: string;
  detail?: TopScoreDetailSnapshot;
};

type StoredScoreFile = {
  dbName: string;
  key: string;
  filename: string;
  text: string;
};

const conductBitLabels = [
  "Foodless",
  "Vegan",
  "Vegetarian",
  "Atheist",
  "Weaponless",
  "Pacifist",
  "Illiterate",
  "Polypileless",
  "Polyselfless",
  "Wishless",
  "Artifact-wishless",
  "Genocideless",
];

const achievementBitLabels = [
  "Bell of Opening",
  "Entered Gehennom",
  "Candelabrum of Invocation",
  "Book of the Dead",
  "Invocation",
  "Amulet of Yendor",
  "Entered Endgame",
  "Reached Astral Plane",
  "Ascended",
  "Mines luckstone",
  "Finished Sokoban",
  "Killed Medusa",
  "Blindfolded roleplay",
  "Nudist roleplay",
];

const flagBitLabels = ["Wizard/debug", "Explore", "Bones disabled"];

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim();
}

function normalizeScoreName(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeFiniteInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const normalized = normalizeText(value);
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHexInteger(value: string): number {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return 0;
  }
  const parsed = Number.parseInt(
    normalized.startsWith("0x") ? normalized.slice(2) : normalized,
    16,
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function labelsFromBitMask(value: string, labels: string[]): string[] {
  const mask = parseHexInteger(value);
  const resolved: string[] = [];
  for (let index = 0; index < labels.length; index += 1) {
    if ((mask & (1 << index)) !== 0) {
      resolved.push(labels[index]);
    }
  }
  return resolved;
}

function formatYyyymmdd(value: unknown): string {
  const normalized = normalizeText(value);
  if (!/^\d{8}$/.test(normalized)) {
    return normalized;
  }
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(
    6,
    8,
  )}`;
}

function formatUnixSeconds(value: unknown): string {
  const seconds = normalizeFiniteInteger(value);
  if (seconds === null || seconds <= 0) {
    return "";
  }
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function buildScoreKey(
  name: unknown,
  points: unknown,
  turns: unknown,
): string {
  const normalizedName = normalizeScoreName(name);
  const normalizedPoints = normalizeFiniteInteger(points);
  const normalizedTurns = normalizeFiniteInteger(turns);
  return [
    normalizedName,
    normalizedPoints === null ? "" : String(normalizedPoints),
    normalizedTurns === null ? "" : String(normalizedTurns),
  ].join("|");
}

function buildFallbackScoreKey(name: unknown, points: unknown): string {
  const normalizedName = normalizeScoreName(name);
  const normalizedPoints = normalizeFiniteInteger(points);
  return [
    normalizedName,
    normalizedPoints === null ? "" : String(normalizedPoints),
  ].join("|");
}

function normalizeScoreNameAliases(value: unknown): string[] {
  const normalized = normalizeScoreName(value);
  if (!normalized) {
    return [];
  }

  const aliases = new Set<string>([normalized]);
  const titleMarkerIndex = normalized.indexOf(" the ");
  if (titleMarkerIndex > 0) {
    aliases.add(normalized.slice(0, titleMarkerIndex).trim());
  }
  return Array.from(aliases).filter(Boolean);
}

function buildScoreKeyCandidates(
  name: unknown,
  points: unknown,
  turns: unknown,
): string[] {
  const normalizedPoints = normalizeFiniteInteger(points);
  const normalizedTurns = normalizeFiniteInteger(turns);
  return normalizeScoreNameAliases(name).map((normalizedName) =>
    [
      normalizedName,
      normalizedPoints === null ? "" : String(normalizedPoints),
      normalizedTurns === null ? "" : String(normalizedTurns),
    ].join("|"),
  );
}

function buildFallbackScoreKeyCandidates(
  name: unknown,
  points: unknown,
): string[] {
  const normalizedPoints = normalizeFiniteInteger(points);
  return normalizeScoreNameAliases(name).map((normalizedName) =>
    [
      normalizedName,
      normalizedPoints === null ? "" : String(normalizedPoints),
    ].join("|"),
  );
}

function createSnapshotId(runtimeVersion: NethackRuntimeVersion): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${runtimeVersion}:${Date.now()}:${randomPart}`;
}

function sanitizeInventoryItems(
  inventoryItems: ReadonlyArray<NethackMenuItem> | undefined,
): TopScoreInventoryItem[] {
  if (!Array.isArray(inventoryItems)) {
    return [];
  }
  return inventoryItems.reduce<TopScoreInventoryItem[]>((items, item) => {
    const text = normalizeText(item?.text);
    if (!text) {
      return items;
    }
    const accelerator =
      typeof item.accelerator === "string" && item.accelerator.trim()
        ? item.accelerator.trim()
        : typeof item.originalAccelerator === "string" &&
            item.originalAccelerator.trim()
          ? item.originalAccelerator.trim()
          : "";
    const inventoryItem: TopScoreInventoryItem = {
      text,
      isCategory: Boolean(item.isCategory),
    };
    if (accelerator) {
      inventoryItem.accelerator = accelerator;
    }
    if (typeof item.glyphChar === "string" && item.glyphChar) {
      inventoryItem.glyphChar = item.glyphChar;
    }
    if (typeof item.tileIndex === "number" && Number.isFinite(item.tileIndex)) {
      inventoryItem.tileIndex = Math.trunc(item.tileIndex);
    }
    items.push(inventoryItem);
    return items;
  }, []);
}

function buildAttributeSnapshot(
  playerStats: PlayerStatsSnapshot,
): Record<string, string> {
  return {
    Strength: String(playerStats.strength),
    Dexterity: String(playerStats.dexterity),
    Constitution: String(playerStats.constitution),
    Intelligence: String(playerStats.intelligence),
    Wisdom: String(playerStats.wisdom),
    Charisma: String(playerStats.charisma),
    "Armor class": String(playerStats.armor),
    "Hit points": `${playerStats.hp}/${playerStats.maxHp}`,
    Power: `${playerStats.power}/${playerStats.maxPower}`,
    Level: String(playerStats.level),
    Experience: String(playerStats.experience),
    Gold: String(playerStats.gold),
    Alignment: normalizeText(playerStats.alignment),
    Hunger: normalizeText(playerStats.hunger),
    Encumbrance: normalizeText(playerStats.encumbrance),
    Turn: String(playerStats.time),
    Score: String(playerStats.score),
    Dungeon: normalizeText(playerStats.dungeon),
    "Dungeon level": String(playerStats.dlevel),
    Location: normalizeText(playerStats.locationLabel),
  };
}

function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openScoreDetailsDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = indexedDB.open(scoreDetailsDbName, scoreDetailsDbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(scoreDetailsStoreName)) {
        const store = db.createObjectStore(scoreDetailsStoreName, {
          keyPath: "id",
        });
        store.createIndex("runtimeVersion", "runtimeVersion", {
          unique: false,
        });
        store.createIndex("scoreKey", "scoreKey", { unique: false });
        store.createIndex("fallbackScoreKey", "fallbackScoreKey", {
          unique: false,
        });
        store.createIndex("capturedAtMs", "capturedAtMs", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTopScoreDetailSnapshot(input: {
  runtimeVersion: NethackRuntimeVersion;
  playerStats: PlayerStatsSnapshot;
  inventoryItems: ReadonlyArray<NethackMenuItem>;
  deathMessage?: string | null;
  tombstoneLines?: ReadonlyArray<string> | null;
}): Promise<void> {
  if (input.runtimeVersion !== "3.6.7") {
    return;
  }

  const points = normalizeFiniteInteger(input.playerStats.score);
  const turns = normalizeFiniteInteger(input.playerStats.time);
  const capturedAtMs = Date.now();
  const snapshot: TopScoreDetailSnapshot = {
    id: createSnapshotId(input.runtimeVersion),
    runtimeVersion: input.runtimeVersion,
    capturedAtMs,
    capturedAtIso: new Date(capturedAtMs).toISOString(),
    scoreKey: buildScoreKey(input.playerStats.name, points, turns),
    fallbackScoreKey: buildFallbackScoreKey(input.playerStats.name, points),
    playerName: normalizeText(input.playerStats.name),
    points,
    turns,
    deathMessage: normalizeText(input.deathMessage),
    attributes: buildAttributeSnapshot(input.playerStats),
    playerStats: { ...input.playerStats },
    inventory: sanitizeInventoryItems(input.inventoryItems),
    tombstoneLines: Array.isArray(input.tombstoneLines)
      ? input.tombstoneLines.map((line) => normalizeText(line)).filter(Boolean)
      : [],
  };

  const db = await openScoreDetailsDatabase();
  try {
    const transaction = db.transaction([scoreDetailsStoreName], "readwrite");
    const store = transaction.objectStore(scoreDetailsStoreName);
    await idbRequestToPromise(store.put(snapshot));
  } finally {
    db.close();
  }
}

async function loadTopScoreDetailSnapshots(
  runtimeVersion: NethackRuntimeVersion,
): Promise<TopScoreDetailSnapshot[]> {
  let db: IDBDatabase;
  try {
    db = await openScoreDetailsDatabase();
  } catch {
    return [];
  }

  try {
    const transaction = db.transaction([scoreDetailsStoreName], "readonly");
    const store = transaction.objectStore(scoreDetailsStoreName);
    const records = await idbRequestToPromise(store.getAll());
    return records
      .filter(
        (record): record is TopScoreDetailSnapshot =>
          Boolean(
            record &&
              typeof record === "object" &&
              (record as TopScoreDetailSnapshot).runtimeVersion ===
                runtimeVersion,
          ),
      )
      .sort((a, b) => b.capturedAtMs - a.capturedAtMs);
  } finally {
    db.close();
  }
}

function decodeStoredFileText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const contents = (value as { contents?: unknown }).contents;
  if (typeof contents === "string") {
    return contents;
  }
  let bytes: Uint8Array | null = null;
  if (contents instanceof Uint8Array) {
    bytes = contents;
  } else if (contents instanceof ArrayBuffer) {
    bytes = new Uint8Array(contents);
  } else if (Array.isArray(contents)) {
    bytes = new Uint8Array(
      contents.map((entry) => Math.max(0, Math.min(255, Number(entry) || 0))),
    );
  } else if (
    contents &&
    typeof contents === "object" &&
    Array.isArray((contents as { data?: unknown }).data)
  ) {
    bytes = new Uint8Array(
      ((contents as { data: unknown[] }).data).map((entry) =>
        Math.max(0, Math.min(255, Number(entry) || 0)),
      ),
    );
  }
  if (!bytes || bytes.byteLength <= 0) {
    return "";
  }
  return new TextDecoder("utf-8").decode(bytes);
}

async function openExistingDatabase(dbName: string): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      (event.target as IDBOpenDBRequest).transaction?.abort();
      resolve(null);
    };
  });
}

async function readScoreFilesFromDatabase(
  dbName: string,
): Promise<StoredScoreFile[]> {
  const db = await openExistingDatabase(dbName);
  if (!db) {
    return [];
  }

  try {
    if (!db.objectStoreNames.contains("FILE_DATA")) {
      return [];
    }

    const transaction = db.transaction(["FILE_DATA"], "readonly");
    const store = transaction.objectStore("FILE_DATA");
    const [values, keys] = await Promise.all([
      idbRequestToPromise(store.getAll()),
      idbRequestToPromise(store.getAllKeys()),
    ]);
    const files: StoredScoreFile[] = [];
    for (let index = 0; index < values.length; index += 1) {
      const key = typeof keys[index] === "string" ? String(keys[index]) : "";
      const filename = key.split("/").pop()?.toLowerCase() ?? "";
      if (filename !== "xlogfile" && filename !== "record") {
        continue;
      }
      const text = decodeStoredFileText(values[index]);
      if (!text.trim()) {
        continue;
      }
      files.push({ dbName, key, filename, text });
    }
    return files;
  } finally {
    db.close();
  }
}

async function readRuntimeScoreFiles(
  runtimeVersion: NethackRuntimeVersion,
): Promise<StoredScoreFile[]> {
  if (typeof indexedDB === "undefined") {
    return [];
  }
  const dbNames = await resolveRuntimeSaveDbNames(runtimeVersion);
  const allFiles: StoredScoreFile[] = [];
  for (const dbName of dbNames) {
    try {
      allFiles.push(...(await readScoreFilesFromDatabase(dbName)));
    } catch (error) {
      console.warn(`Could not read top score files from ${dbName}:`, error);
    }
  }
  return allFiles;
}

function parseXlogFields(line: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const segment of line.split("\t")) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = segment.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }
    fields[key] = segment.slice(separatorIndex + 1).trim();
  }
  return fields;
}

function normalizeRawFieldValue(value: unknown): string {
  return normalizeText(value).replace(/[\t\r\n]+/g, " ");
}

function stringifyRawFields(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${normalizeRawFieldValue(value)}`)
    .join("\t");
}

function formatIsoDate(value: unknown): string {
  const normalized = normalizeText(value);
  const date = normalized ? new Date(normalized) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function createTopScoreRecordBase(input: {
  source: TopScoreSource;
  file: StoredScoreFile;
  lineNumber: number;
  rawLine: string;
  rawFields: Record<string, string>;
  points: number;
  version: string;
  deathdnum: number | null;
  deathlev: number | null;
  maxlvl: number | null;
  hp: number | null;
  maxhp: number | null;
  deaths: number | null;
  deathdate: string;
  birthdate: string;
  uid: number | null;
  role: string;
  race: string;
  gender: string;
  align: string;
  name: string;
  death: string;
  whileHelpless?: string;
  conductHex?: string;
  turns?: number | null;
  achieveHex?: string;
  realtimeSeconds?: number | null;
  starttime?: string;
  endtime?: string;
  gender0?: string;
  align0?: string;
  flagsHex?: string;
}): TopScoreRecord {
  const conductHex = input.conductHex ?? "";
  const achieveHex = input.achieveHex ?? "";
  const flagsHex = input.flagsHex ?? "";
  return {
    id: `${input.source}:${input.file.dbName}:${input.file.key}:${input.lineNumber}`,
    source: input.source,
    sourceDbName: input.file.dbName,
    sourcePath: input.file.key,
    sourceLine: input.lineNumber,
    rank: 0,
    points: input.points,
    version: input.version,
    deathdnum: input.deathdnum,
    deathlev: input.deathlev,
    maxlvl: input.maxlvl,
    hp: input.hp,
    maxhp: input.maxhp,
    deaths: input.deaths,
    deathdate: input.deathdate,
    birthdate: input.birthdate,
    uid: input.uid,
    role: input.role,
    race: input.race,
    gender: input.gender,
    align: input.align,
    name: input.name,
    death: input.death,
    whileHelpless: input.whileHelpless ?? "",
    conductHex,
    conductLabels: labelsFromBitMask(conductHex, conductBitLabels),
    turns: input.turns ?? null,
    achieveHex,
    achievementLabels: labelsFromBitMask(achieveHex, achievementBitLabels),
    realtimeSeconds: input.realtimeSeconds ?? null,
    starttime: input.starttime ?? "",
    endtime: input.endtime ?? "",
    gender0: input.gender0 ?? "",
    align0: input.align0 ?? "",
    flagsHex,
    flagLabels: labelsFromBitMask(flagsHex, flagBitLabels),
    rawFields: input.rawFields,
    rawLine: input.rawLine,
  };
}

function parseXlogScoreFile(file: StoredScoreFile): TopScoreRecord[] {
  const records: TopScoreRecord[] = [];
  const lines = file.text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index].trim();
    if (!rawLine) {
      continue;
    }
    const fields = parseXlogFields(rawLine);
    const points = normalizeFiniteInteger(fields.points);
    if (points === null) {
      continue;
    }
    records.push(
      createTopScoreRecordBase({
        source: "xlogfile",
        file,
        lineNumber: index + 1,
        rawLine,
        rawFields: fields,
        points,
        version: normalizeText(fields.version),
        deathdnum: normalizeFiniteInteger(fields.deathdnum),
        deathlev: normalizeFiniteInteger(fields.deathlev),
        maxlvl: normalizeFiniteInteger(fields.maxlvl),
        hp: normalizeFiniteInteger(fields.hp),
        maxhp: normalizeFiniteInteger(fields.maxhp),
        deaths: normalizeFiniteInteger(fields.deaths),
        deathdate: formatYyyymmdd(fields.deathdate),
        birthdate: formatYyyymmdd(fields.birthdate),
        uid: normalizeFiniteInteger(fields.uid),
        role: normalizeText(fields.role),
        race: normalizeText(fields.race),
        gender: normalizeText(fields.gender),
        align: normalizeText(fields.align),
        name: normalizeText(fields.name),
        death: normalizeText(fields.death),
        whileHelpless: normalizeText(fields.while),
        conductHex: normalizeText(fields.conduct),
        turns: normalizeFiniteInteger(fields.turns),
        achieveHex: normalizeText(fields.achieve),
        realtimeSeconds: normalizeFiniteInteger(fields.realtime),
        starttime: formatUnixSeconds(fields.starttime),
        endtime: formatUnixSeconds(fields.endtime),
        gender0: normalizeText(fields.gender0),
        align0: normalizeText(fields.align0),
        flagsHex: normalizeText(fields.flags),
      }),
    );
  }
  return records;
}

function parseRecordScoreFile(file: StoredScoreFile): TopScoreRecord[] {
  const records: TopScoreRecord[] = [];
  const linePattern =
    /^(\d+)\.(\d+)\.(\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([^,]*),(.*)$/;
  const lines = file.text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index].trim();
    if (!rawLine) {
      continue;
    }
    const match = rawLine.match(linePattern);
    if (!match) {
      continue;
    }
    const points = normalizeFiniteInteger(match[4]);
    if (points === null || points <= 0) {
      continue;
    }
    const rawFields: Record<string, string> = {
      version: `${match[1]}.${match[2]}.${match[3]}`,
      points: match[4],
      deathdnum: match[5],
      deathlev: match[6],
      maxlvl: match[7],
      hp: match[8],
      maxhp: match[9],
      deaths: match[10],
      deathdate: match[11],
      birthdate: match[12],
      uid: match[13],
      role: match[14],
      race: match[15],
      gender: match[16],
      align: match[17],
      name: match[18],
      death: match[19],
    };
    records.push(
      createTopScoreRecordBase({
        source: "record",
        file,
        lineNumber: index + 1,
        rawLine,
        rawFields,
        points,
        version: rawFields.version,
        deathdnum: normalizeFiniteInteger(rawFields.deathdnum),
        deathlev: normalizeFiniteInteger(rawFields.deathlev),
        maxlvl: normalizeFiniteInteger(rawFields.maxlvl),
        hp: normalizeFiniteInteger(rawFields.hp),
        maxhp: normalizeFiniteInteger(rawFields.maxhp),
        deaths: normalizeFiniteInteger(rawFields.deaths),
        deathdate: formatYyyymmdd(rawFields.deathdate),
        birthdate: formatYyyymmdd(rawFields.birthdate),
        uid: normalizeFiniteInteger(rawFields.uid),
        role: normalizeText(rawFields.role),
        race: normalizeText(rawFields.race),
        gender: normalizeText(rawFields.gender),
        align: normalizeText(rawFields.align),
        name: normalizeText(rawFields.name),
        death: normalizeText(rawFields.death),
      }),
    );
  }
  return records;
}

function createSnapshotTopScoreRecord(
  detail: TopScoreDetailSnapshot,
  index: number,
): TopScoreRecord {
  const stats = detail.playerStats;
  const points = detail.points ?? normalizeFiniteInteger(stats.score) ?? 0;
  const turns = detail.turns ?? normalizeFiniteInteger(stats.time);
  const hp = normalizeFiniteInteger(stats.hp);
  const maxhp = normalizeFiniteInteger(stats.maxHp);
  const deathlev = normalizeFiniteInteger(stats.dlevel);
  const endtime = normalizeText(detail.capturedAtIso);
  const deathdate = formatIsoDate(endtime);
  const name = normalizeText(detail.playerName || stats.name);
  const death = normalizeText(detail.deathMessage);
  const align = normalizeText(stats.alignment);
  const rawFields: Record<string, string> = {
    version: detail.runtimeVersion,
    points: String(points),
    deathdnum: "",
    deathlev: deathlev === null ? "" : String(deathlev),
    maxlvl: deathlev === null ? "" : String(deathlev),
    hp: hp === null ? "" : String(hp),
    maxhp: maxhp === null ? "" : String(maxhp),
    deaths: "",
    deathdate,
    birthdate: "",
    uid: "",
    role: "",
    race: "",
    gender: "",
    align,
    name,
    death,
    while: "",
    conduct: "",
    turns: turns === null ? "" : String(turns),
    achieve: "",
    realtime: "",
    starttime: "",
    endtime,
    gender0: "",
    align0: align,
    flags: "",
    source: scoreDetailsDbName,
    capturedAt: endtime,
    scoreKey: detail.scoreKey,
  };

  return {
    id: `nh3d-snapshot:${detail.id}`,
    source: "nh3d-snapshot",
    sourceDbName: scoreDetailsDbName,
    sourcePath: `${scoreDetailsStoreName}/${detail.id}`,
    sourceLine: index + 1,
    rank: 0,
    points,
    version: detail.runtimeVersion,
    deathdnum: null,
    deathlev,
    maxlvl: deathlev,
    hp,
    maxhp,
    deaths: null,
    deathdate,
    birthdate: "",
    uid: null,
    role: "",
    race: "",
    gender: "",
    align,
    name,
    death,
    whileHelpless: "",
    conductHex: "",
    conductLabels: [],
    turns,
    achieveHex: "",
    achievementLabels: [],
    realtimeSeconds: null,
    starttime: "",
    endtime,
    gender0: "",
    align0: align,
    flagsHex: "",
    flagLabels: [],
    rawFields,
    rawLine: stringifyRawFields(rawFields),
    detail,
  };
}

function attachDetailsToScores(
  scores: TopScoreRecord[],
  details: TopScoreDetailSnapshot[],
): TopScoreRecord[] {
  const detailsByScoreKey = new Map<string, TopScoreDetailSnapshot[]>();
  const detailsByFallbackKey = new Map<string, TopScoreDetailSnapshot[]>();
  const pushDetail = (
    map: Map<string, TopScoreDetailSnapshot[]>,
    key: string,
    detail: TopScoreDetailSnapshot,
  ): void => {
    if (!key) {
      return;
    }
    const existing = map.get(key) ?? [];
    existing.push(detail);
    map.set(key, existing);
  };

  for (const detail of details) {
    pushDetail(detailsByScoreKey, detail.scoreKey, detail);
    pushDetail(detailsByFallbackKey, detail.fallbackScoreKey, detail);
    for (const key of buildScoreKeyCandidates(
      detail.playerName || detail.playerStats.name,
      detail.points ?? detail.playerStats.score,
      detail.turns ?? detail.playerStats.time,
    )) {
      pushDetail(detailsByScoreKey, key, detail);
    }
    for (const key of buildFallbackScoreKeyCandidates(
      detail.playerName || detail.playerStats.name,
      detail.points ?? detail.playerStats.score,
    )) {
      pushDetail(detailsByFallbackKey, key, detail);
    }
  }

  const usedDetailIds = new Set<string>();
  const scoreEndTimeMs = (score: TopScoreRecord): number | null => {
    const parsed = Date.parse(score.endtime || score.deathdate || "");
    return Number.isFinite(parsed) ? parsed : null;
  };
  const chooseBestDetail = (
    candidates: TopScoreDetailSnapshot[],
    score: TopScoreRecord,
  ): TopScoreDetailSnapshot | undefined => {
    const available = candidates.filter((detail) => !usedDetailIds.has(detail.id));
    if (available.length <= 0) {
      return undefined;
    }

    const endTimeMs = scoreEndTimeMs(score);
    const sorted = [...available].sort((a, b) => {
      if (endTimeMs !== null) {
        const aDistance = Math.abs(a.capturedAtMs - endTimeMs);
        const bDistance = Math.abs(b.capturedAtMs - endTimeMs);
        if (aDistance !== bDistance) {
          return aDistance - bDistance;
        }
      }
      return b.capturedAtMs - a.capturedAtMs;
    });
    const detail = sorted[0];
    usedDetailIds.add(detail.id);
    return detail;
  };

  const findMatchingDetail = (
    score: TopScoreRecord,
  ): TopScoreDetailSnapshot | undefined => {
    const scoreKeys = buildScoreKeyCandidates(score.name, score.points, score.turns);
    for (const key of scoreKeys) {
      const detail = chooseBestDetail(detailsByScoreKey.get(key) ?? [], score);
      if (detail) {
        return detail;
      }
    }

    const fallbackKeys = buildFallbackScoreKeyCandidates(score.name, score.points);
    for (const key of fallbackKeys) {
      const detail = chooseBestDetail(detailsByFallbackKey.get(key) ?? [], score);
      if (detail) {
        return detail;
      }
    }
    return undefined;
  };

  return scores.map((score) => {
    const detail = findMatchingDetail(score);
    return detail ? { ...score, detail } : score;
  });
}

export async function fetchTopScores(
  runtimeVersion: NethackRuntimeVersion,
): Promise<TopScoreRecord[]> {
  if (runtimeVersion !== "3.6.7") {
    return [];
  }
  const details = await loadTopScoreDetailSnapshots(runtimeVersion);
  const files = await readRuntimeScoreFiles(runtimeVersion);
  const xlogRecords = files
    .filter((file) => file.filename === "xlogfile")
    .flatMap(parseXlogScoreFile);
  const recordRecords = files
    .filter((file) => file.filename === "record")
    .flatMap(parseRecordScoreFile);
  const candidateRecords = xlogRecords.length > 0 ? xlogRecords : recordRecords;
  const seen = new Set<string>();
  const deduped = candidateRecords.filter((record) => {
    const key = `${record.source}:${record.rawLine}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    const aEnd = Date.parse(a.endtime || a.deathdate || "");
    const bEnd = Date.parse(b.endtime || b.deathdate || "");
    if (Number.isFinite(aEnd) && Number.isFinite(bEnd) && bEnd !== aEnd) {
      return bEnd - aEnd;
    }
    return b.sourceLine - a.sourceLine;
  });

  const nativeRecords = attachDetailsToScores(deduped, details);
  const matchedDetailIds = new Set(
    nativeRecords
      .map((record) => record.detail?.id)
      .filter((id): id is string => Boolean(id)),
  );
  const snapshotRecords = details
    .filter((detail) => !matchedDetailIds.has(detail.id))
    .map(createSnapshotTopScoreRecord);
  const mergedRecords = [...nativeRecords, ...snapshotRecords];

  mergedRecords.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    const aEnd = Date.parse(a.endtime || a.deathdate || "");
    const bEnd = Date.parse(b.endtime || b.deathdate || "");
    if (Number.isFinite(aEnd) && Number.isFinite(bEnd) && bEnd !== aEnd) {
      return bEnd - aEnd;
    }
    return b.sourceLine - a.sourceLine;
  });

  return mergedRecords.map((record, index) => ({
    ...record,
    rank: index + 1,
  }));
}
