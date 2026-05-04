const dbName = "nh3d-tileset-batch-picker";
const dbVersion = 1;
const sessionStoreName = "session";
const imageStoreName = "images";
const currentSessionRecordId = "current-session";

export type PersistedTilesetBatchPickerImageMeta = {
  id: string;
  batchIndex: number;
  name: string;
  width: number;
  height: number;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
};

export type PersistedTilesetBatchPickerImageRecord =
  PersistedTilesetBatchPickerImageMeta & {
    blob: Blob;
  };

export type PersistedTilesetBatchPickerSession = {
  compileMap: unknown;
  mapLabel: string;
  selectedImages: Record<string, string>;
  batchImages: Record<string, PersistedTilesetBatchPickerImageMeta[]>;
  updatedAt: number;
};

type PersistedTilesetBatchPickerSessionRecord =
  PersistedTilesetBatchPickerSession & {
    id: string;
  };

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
      if (!db.objectStoreNames.contains(sessionStoreName)) {
        db.createObjectStore(sessionStoreName, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(imageStoreName)) {
        db.createObjectStore(imageStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeTimestamp(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(Number(value))) : Date.now();
}

function normalizeDimension(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(Number(value))) : 0;
}

function normalizeBatchIndex(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(Number(value))) : 0;
}

function normalizeSelectedImages(
  rawValue: unknown,
): Record<string, string> {
  if (!isPlainObject(rawValue)) {
    return {};
  }
  const normalized: Record<string, string> = {};
  for (const [generatedIndex, imageId] of Object.entries(rawValue)) {
    const normalizedKey = String(generatedIndex).trim();
    const normalizedImageId = normalizeText(imageId).trim();
    if (!normalizedKey || !normalizedImageId) {
      continue;
    }
    normalized[normalizedKey] = normalizedImageId;
  }
  return normalized;
}

function normalizeImageMeta(
  rawValue: unknown,
): PersistedTilesetBatchPickerImageMeta | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }
  const id = normalizeText(rawValue.id).trim();
  if (!id) {
    return null;
  }
  return {
    id,
    batchIndex: normalizeBatchIndex(rawValue.batchIndex),
    name: normalizeText(rawValue.name, "uploaded-image"),
    width: normalizeDimension(rawValue.width),
    height: normalizeDimension(rawValue.height),
    mimeType: normalizeText(rawValue.mimeType, "application/octet-stream"),
    createdAt: normalizeTimestamp(rawValue.createdAt),
    updatedAt: normalizeTimestamp(rawValue.updatedAt),
  };
}

function normalizeBatchImages(
  rawValue: unknown,
): Record<string, PersistedTilesetBatchPickerImageMeta[]> {
  if (!isPlainObject(rawValue)) {
    return {};
  }
  const normalized: Record<string, PersistedTilesetBatchPickerImageMeta[]> = {};
  for (const [batchKey, rawImages] of Object.entries(rawValue)) {
    if (!Array.isArray(rawImages)) {
      continue;
    }
    const batchIndex = normalizeBatchIndex(batchKey);
    const images = rawImages
      .map((entry) => normalizeImageMeta(entry))
      .filter(
        (entry): entry is PersistedTilesetBatchPickerImageMeta => entry !== null,
      )
      .map((entry) => ({
        ...entry,
        batchIndex,
      }))
      .sort((left, right) => left.createdAt - right.createdAt);
    normalized[String(batchIndex)] = images;
  }
  return normalized;
}

function normalizeSession(
  rawValue: unknown,
): PersistedTilesetBatchPickerSession | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }
  return {
    compileMap: rawValue.compileMap,
    mapLabel: normalizeText(rawValue.mapLabel, "NetHack 5 compile map"),
    selectedImages: normalizeSelectedImages(rawValue.selectedImages),
    batchImages: normalizeBatchImages(rawValue.batchImages),
    updatedAt: normalizeTimestamp(rawValue.updatedAt),
  };
}

function normalizeImageRecord(
  rawValue: unknown,
): PersistedTilesetBatchPickerImageRecord | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }
  const meta = normalizeImageMeta(rawValue);
  const blob = rawValue.blob instanceof Blob ? rawValue.blob : null;
  if (!meta || !blob) {
    return null;
  }
  return {
    ...meta,
    blob,
  };
}

export async function loadPersistedTilesetBatchPickerSession(): Promise<PersistedTilesetBatchPickerSession | null> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(sessionStoreName, "readonly");
    const store = transaction.objectStore(sessionStoreName);
    const rawRecord = await idbRequestToPromise(
      store.get(currentSessionRecordId),
    );
    await idbTransactionDone(transaction);
    return normalizeSession(rawRecord);
  } finally {
    db.close();
  }
}

export async function savePersistedTilesetBatchPickerSession(
  session: Omit<PersistedTilesetBatchPickerSession, "updatedAt">,
): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(sessionStoreName, "readwrite");
    const store = transaction.objectStore(sessionStoreName);
    const record: PersistedTilesetBatchPickerSessionRecord = {
      id: currentSessionRecordId,
      compileMap: session.compileMap,
      mapLabel: session.mapLabel,
      selectedImages: normalizeSelectedImages(session.selectedImages),
      batchImages: normalizeBatchImages(session.batchImages),
      updatedAt: Date.now(),
    };
    await idbRequestToPromise(store.put(record));
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function savePersistedTilesetBatchPickerImage(
  image: PersistedTilesetBatchPickerImageRecord,
): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(imageStoreName, "readwrite");
    const store = transaction.objectStore(imageStoreName);
    await idbRequestToPromise(
      store.put({
        ...image,
        updatedAt: Date.now(),
      }),
    );
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function loadPersistedTilesetBatchPickerImages(
  ids: readonly string[],
): Promise<Record<string, PersistedTilesetBatchPickerImageRecord>> {
  const normalizedIds = Array.from(
    new Set(ids.map((value) => String(value).trim()).filter(Boolean)),
  );
  if (normalizedIds.length <= 0) {
    return {};
  }

  const db = await openDatabase();
  try {
    const transaction = db.transaction(imageStoreName, "readonly");
    const store = transaction.objectStore(imageStoreName);
    const entries = await Promise.all(
      normalizedIds.map(async (id) =>
        normalizeImageRecord(await idbRequestToPromise(store.get(id))),
      ),
    );
    await idbTransactionDone(transaction);
    const byId: Record<string, PersistedTilesetBatchPickerImageRecord> = {};
    for (const entry of entries) {
      if (!entry) {
        continue;
      }
      byId[entry.id] = entry;
    }
    return byId;
  } finally {
    db.close();
  }
}

export async function deletePersistedTilesetBatchPickerImage(id: string): Promise<void> {
  const normalizedId = String(id).trim();
  if (!normalizedId) {
    return;
  }
  const db = await openDatabase();
  try {
    const transaction = db.transaction(imageStoreName, "readwrite");
    const store = transaction.objectStore(imageStoreName);
    await idbRequestToPromise(store.delete(normalizedId));
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function clearPersistedTilesetBatchPickerImages(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(imageStoreName, "readwrite");
    const store = transaction.objectStore(imageStoreName);
    await idbRequestToPromise(store.clear());
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function clearPersistedTilesetBatchPickerSession(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(
      [sessionStoreName, imageStoreName],
      "readwrite",
    );
    await idbRequestToPromise(
      transaction.objectStore(sessionStoreName).delete(currentSessionRecordId),
    );
    await idbRequestToPromise(transaction.objectStore(imageStoreName).clear());
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}
