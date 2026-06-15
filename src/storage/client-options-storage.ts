import type { Nh3dClientOptions } from "../game/ui-types";
import type { NethackRuntimeVersion } from "../runtime/types";
import {
  normalizeStartupInitOptionValues,
  type StartupInitOptionValues,
} from "../runtime/startup-init-options";

const dbName = "nh3d-client-settings";
const dbVersion = 1;
const storeName = "settings";
const clientOptionsRecordId = "client-options";
const startupInitOptionsRecordId = "startup-init-options";
const startupCharacterPreferencesRecordId = "startup-character-preferences";

type ClientOptionsStoredRecord = {
  id: string;
  value: Partial<Nh3dClientOptions>;
  updatedAt: number;
};

type StartupInitOptionsStoredRecord = {
  id: string;
  value: StartupInitOptionValues;
  updatedAt: number;
};

export type StartupCharacterPreferences = {
  randomName: string;
  createName: string;
  createRole: string;
  createRace: string;
  createGender: string;
  createAlign: string;
};

export type StartupCharacterPreferencesByRuntime = Partial<
  Record<NethackRuntimeVersion, StartupCharacterPreferences>
>;

type StartupCharacterPreferencesStoredRecord = {
  id: string;
  value: StartupCharacterPreferences | { byRuntime: StartupCharacterPreferencesByRuntime };
  updatedAt: number;
};

const startupCharacterPreferenceRuntimeVersions: readonly NethackRuntimeVersion[] =
  ["3.6.7", "5.0", "slashem", "evilhack"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
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
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function normalizePersistedClientOptions(
  rawValue: unknown,
): Partial<Nh3dClientOptions> | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }
  return rawValue as Partial<Nh3dClientOptions>;
}

async function readClientOptionsFromIndexedDb(): Promise<
  Partial<Nh3dClientOptions> | null
> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const rawRecord = await idbRequestToPromise(
      store.get(clientOptionsRecordId),
    );
    await idbTransactionDone(transaction);
    if (!isPlainObject(rawRecord)) {
      return null;
    }
    return normalizePersistedClientOptions(
      (rawRecord as Partial<ClientOptionsStoredRecord>).value,
    );
  } finally {
    db.close();
  }
}

async function writeClientOptionsToIndexedDb(
  options: Partial<Nh3dClientOptions>,
): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const record: ClientOptionsStoredRecord = {
      id: clientOptionsRecordId,
      value: options,
      updatedAt: Date.now(),
    };
    await idbRequestToPromise(store.put(record));
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

async function readStartupInitOptionsFromIndexedDb(): Promise<StartupInitOptionValues | null> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const rawRecord = await idbRequestToPromise(
      store.get(startupInitOptionsRecordId),
    );
    await idbTransactionDone(transaction);
    if (!isPlainObject(rawRecord)) {
      return null;
    }
    return normalizeStartupInitOptionValues(
      (rawRecord as Partial<StartupInitOptionsStoredRecord>).value,
    );
  } finally {
    db.close();
  }
}

async function writeStartupInitOptionsToIndexedDb(
  options: StartupInitOptionValues,
): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const record: StartupInitOptionsStoredRecord = {
      id: startupInitOptionsRecordId,
      value: normalizeStartupInitOptionValues(options),
      updatedAt: Date.now(),
    };
    await idbRequestToPromise(store.put(record));
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

function sanitizeStartupPreferenceText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizePersistedStartupCharacterPreferences(
  rawValue: unknown,
): StartupCharacterPreferences | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }
  const value = rawValue as Partial<StartupCharacterPreferences>;
  return {
    randomName: sanitizeStartupPreferenceText(value.randomName, 30),
    createName: sanitizeStartupPreferenceText(value.createName, 30),
    createRole: sanitizeStartupPreferenceText(value.createRole, 30),
    createRace: sanitizeStartupPreferenceText(value.createRace, 30),
    createGender: sanitizeStartupPreferenceText(value.createGender, 30),
    createAlign: sanitizeStartupPreferenceText(value.createAlign, 30),
  };
}

function normalizePersistedStartupCharacterPreferencesByRuntime(
  rawValue: unknown,
): StartupCharacterPreferencesByRuntime | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }

  if (isPlainObject(rawValue.byRuntime)) {
    const byRuntime = rawValue.byRuntime as Record<string, unknown>;
    const normalized: StartupCharacterPreferencesByRuntime = {};
    for (const runtimeVersion of startupCharacterPreferenceRuntimeVersions) {
      const runtimePreferences =
        normalizePersistedStartupCharacterPreferences(byRuntime[runtimeVersion]);
      if (runtimePreferences) {
        normalized[runtimeVersion] = runtimePreferences;
      }
    }
    return normalized;
  }

  const legacyPreferences =
    normalizePersistedStartupCharacterPreferences(rawValue);
  if (!legacyPreferences) {
    return null;
  }

  const normalized: StartupCharacterPreferencesByRuntime = {};
  for (const runtimeVersion of startupCharacterPreferenceRuntimeVersions) {
    normalized[runtimeVersion] = { ...legacyPreferences };
  }
  return normalized;
}

async function readStartupCharacterPreferencesFromIndexedDb(): Promise<StartupCharacterPreferencesByRuntime | null> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const rawRecord = await idbRequestToPromise(
      store.get(startupCharacterPreferencesRecordId),
    );
    await idbTransactionDone(transaction);
    if (!isPlainObject(rawRecord)) {
      return null;
    }
    return normalizePersistedStartupCharacterPreferencesByRuntime(
      (rawRecord as Partial<StartupCharacterPreferencesStoredRecord>).value,
    );
  } finally {
    db.close();
  }
}

async function writeStartupCharacterPreferencesToIndexedDb(
  preferencesByRuntime: StartupCharacterPreferencesByRuntime,
): Promise<void> {
  const normalized: StartupCharacterPreferencesByRuntime =
    normalizePersistedStartupCharacterPreferencesByRuntime({
      byRuntime: preferencesByRuntime,
    }) ?? {};
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const record: StartupCharacterPreferencesStoredRecord = {
      id: startupCharacterPreferencesRecordId,
      value: { byRuntime: normalized },
      updatedAt: Date.now(),
    };
    await idbRequestToPromise(store.put(record));
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

function readClientOptionsFromLocalStorage(
  localStorageKey: string,
): Partial<Nh3dClientOptions> | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(localStorageKey);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return normalizePersistedClientOptions(parsed);
  } catch {
    return null;
  }
}

function removeClientOptionsFromLocalStorage(localStorageKey: string): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(localStorageKey);
  } catch {
    // Ignore cleanup failures.
  }
}

export async function loadPersistedNh3dClientOptionsWithMigration(
  localStorageKey: string,
): Promise<Partial<Nh3dClientOptions> | null> {
  try {
    const fromIndexedDb = await readClientOptionsFromIndexedDb();
    if (fromIndexedDb) {
      return fromIndexedDb;
    }
  } catch {
    // Continue to localStorage migration fallback.
  }

  const fromLocalStorage = readClientOptionsFromLocalStorage(localStorageKey);
  if (!fromLocalStorage) {
    return null;
  }

  try {
    await writeClientOptionsToIndexedDb(fromLocalStorage);
    removeClientOptionsFromLocalStorage(localStorageKey);
  } catch {
    // Keep localStorage data if migration write failed.
  }

  return fromLocalStorage;
}

export async function persistNh3dClientOptionsToIndexedDb(
  options: Nh3dClientOptions,
): Promise<void> {
  await writeClientOptionsToIndexedDb(options);
}

export async function loadPersistedNh3dStartupInitOptions(): Promise<StartupInitOptionValues | null> {
  return readStartupInitOptionsFromIndexedDb();
}

export async function persistNh3dStartupInitOptionsToIndexedDb(
  options: StartupInitOptionValues,
): Promise<void> {
  await writeStartupInitOptionsToIndexedDb(options);
}

export async function loadPersistedNh3dStartupCharacterPreferences(): Promise<StartupCharacterPreferencesByRuntime | null> {
  return readStartupCharacterPreferencesFromIndexedDb();
}

export async function persistNh3dStartupCharacterPreferencesToIndexedDb(
  preferencesByRuntime: StartupCharacterPreferencesByRuntime,
): Promise<void> {
  await writeStartupCharacterPreferencesToIndexedDb(preferencesByRuntime);
}
