export type StoredUserTilesetRecord = {
  id: string;
  label: string;
  tileSize: number;
  tileLayoutVersion: StoredUserTilesetTileLayoutVersion;
  fileName: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
  updatedAt: number;
};

export type StoredUserTilesetTileLayoutVersion =
  | "slashem"
  | "3.4.3"
  | "3.6.7"
  | "5.0";

type SaveUserTilesetInput = {
  id?: string;
  label: string;
  tileSize: number;
  tileLayoutVersion?: StoredUserTilesetTileLayoutVersion;
  fileName?: string;
  file: File | Blob;
};

const dbName = "nh3d-user-tilesets";
const dbVersion = 1;
const storeName = "tilesets";

function normalizeStoredTileLayoutVersion(
  rawValue: unknown,
): StoredUserTilesetTileLayoutVersion {
  if (rawValue === "slashem") {
    return "slashem";
  }
  if (rawValue === "5.0") {
    return "5.0";
  }
  if (rawValue === "3.4.3") {
    return "3.4.3";
  }
  return "3.6.7";
}

function ensureIndexedDbAvailable(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this browser context.");
  }
}

function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDB request failed."));
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
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function normalizeStoredRecord(raw: unknown): StoredUserTilesetRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Partial<StoredUserTilesetRecord>;
  const id = String(value.id || "").trim();
  if (!id) {
    return null;
  }
  const label = String(value.label || "").trim() || id;
  const tileSize = Math.max(
    1,
    Math.trunc(Number.isFinite(value.tileSize) ? Number(value.tileSize) : 32),
  );
  const tileLayoutVersion = normalizeStoredTileLayoutVersion(
    value.tileLayoutVersion,
  );
  const blob = value.blob instanceof Blob ? value.blob : null;
  if (!blob) {
    return null;
  }
  return {
    id,
    label,
    tileSize,
    tileLayoutVersion,
    fileName: String(value.fileName || `${label}.png`).trim() || `${label}.png`,
    mimeType: String(value.mimeType || blob.type || "application/octet-stream"),
    blob,
    createdAt: Number.isFinite(value.createdAt) ? Number(value.createdAt) : Date.now(),
    updatedAt: Number.isFinite(value.updatedAt) ? Number(value.updatedAt) : Date.now(),
  };
}

function generateUserTilesetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tileset-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export async function listStoredUserTilesets(): Promise<StoredUserTilesetRecord[]> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const rawValues = await idbRequestToPromise(store.getAll());
    await idbTransactionDone(transaction);
    return rawValues
      .map((raw) => normalizeStoredRecord(raw))
      .filter((record): record is StoredUserTilesetRecord => record !== null)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  } finally {
    db.close();
  }
}

export async function saveStoredUserTileset(
  input: SaveUserTilesetInput,
): Promise<StoredUserTilesetRecord> {
  const label = String(input.label || "").trim();
  if (!label) {
    throw new Error("Tileset name is required.");
  }
  const tileSize = Math.max(
    1,
    Math.trunc(Number.isFinite(input.tileSize) ? input.tileSize : 32),
  );
  const requestedTileLayoutVersion = normalizeStoredTileLayoutVersion(
    input.tileLayoutVersion,
  );
  const blob = input.file instanceof Blob ? input.file : null;
  if (!blob) {
    throw new Error("Tileset file is required.");
  }
  const normalizedId = String(input.id || "").trim();
  const id = normalizedId || generateUserTilesetId();
  const now = Date.now();

  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const existingRecord = normalizedId
      ? normalizeStoredRecord(await idbRequestToPromise(store.get(normalizedId)))
      : null;
    const tileLayoutVersion =
      input.tileLayoutVersion !== undefined
        ? requestedTileLayoutVersion
        : existingRecord?.tileLayoutVersion ?? "3.6.7";
    const record: StoredUserTilesetRecord = {
      id,
      label,
      tileSize,
      tileLayoutVersion,
      fileName: String(
        input.fileName ||
          (input.file instanceof File
            ? input.file.name
            : existingRecord?.fileName || `${label}.png`),
      ).trim(),
      mimeType: String(blob.type || "application/octet-stream"),
      blob,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
    };
    await idbRequestToPromise(store.put(record));
    await idbTransactionDone(transaction);
    return record;
  } finally {
    db.close();
  }
}

export async function deleteStoredUserTileset(id: string): Promise<void> {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return;
  }
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    await idbRequestToPromise(store.delete(normalizedId));
    await idbTransactionDone(transaction);
  } finally {
    db.close();
  }
}
