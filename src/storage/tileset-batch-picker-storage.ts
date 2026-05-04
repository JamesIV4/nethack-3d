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
  selectedOffsets: Record<string, PersistedTilesetBatchPickerOffset>;
  selectedCropInsets: Record<string, PersistedTilesetBatchPickerCropInsets>;
  backgroundRemovalByImageId: Record<
    string,
    PersistedTilesetBatchPickerBackgroundRemovalSettings
  >;
  batchImages: Record<string, PersistedTilesetBatchPickerImageMeta[]>;
  updatedAt: number;
};

export type PersistedTilesetBatchPickerOffset = {
  x: number;
  y: number;
};

export type PersistedTilesetBatchPickerCropInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type PersistedTilesetBatchPickerRemovalSeed = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

export type PersistedTilesetBatchPickerBackgroundRemovalSettings = {
  tolerance: number;
  edgeSoftness: number;
  edgeSpillRange: number;
  edgeSpillStrength: number;
  edgeDesaturation: number;
  nonContiguous: boolean;
  seeds: PersistedTilesetBatchPickerRemovalSeed[];
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

function normalizeOffsetValue(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, Number(value)));
}

function normalizeSelectedOffsets(
  rawValue: unknown,
): Record<string, PersistedTilesetBatchPickerOffset> {
  if (!isPlainObject(rawValue)) {
    return {};
  }
  const normalized: Record<string, PersistedTilesetBatchPickerOffset> = {};
  for (const [generatedIndex, offset] of Object.entries(rawValue)) {
    if (!isPlainObject(offset)) {
      continue;
    }
    const normalizedKey = String(generatedIndex).trim();
    if (!normalizedKey) {
      continue;
    }
    const x = normalizeOffsetValue(offset.x);
    const y = normalizeOffsetValue(offset.y);
    if (x === 0 && y === 0) {
      continue;
    }
    normalized[normalizedKey] = { x, y };
  }
  return normalized;
}

function normalizeCropInsetValue(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(0.95, Number(value)));
}

function normalizeSelectedCropInsets(
  rawValue: unknown,
): Record<string, PersistedTilesetBatchPickerCropInsets> {
  if (!isPlainObject(rawValue)) {
    return {};
  }
  const normalized: Record<string, PersistedTilesetBatchPickerCropInsets> = {};
  for (const [generatedIndex, crop] of Object.entries(rawValue)) {
    if (!isPlainObject(crop)) {
      continue;
    }
    const normalizedKey = String(generatedIndex).trim();
    if (!normalizedKey) {
      continue;
    }
    const left = normalizeCropInsetValue(crop.left);
    const right = normalizeCropInsetValue(crop.right);
    const top = normalizeCropInsetValue(crop.top);
    const bottom = normalizeCropInsetValue(crop.bottom);
    if (left === 0 && right === 0 && top === 0 && bottom === 0) {
      continue;
    }
    normalized[normalizedKey] = { left, right, top, bottom };
  }
  return normalized;
}

function normalizeRemovalChannel(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(Number(value))));
}

function normalizeRemovalCoordinate(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(Number(value)));
}

function normalizeRemovalTolerance(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 57;
  }
  return Math.max(0, Math.min(255, Math.round(Number(value))));
}

function normalizeRemovalEdgeSoftness(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function normalizeRemovalEdgeSpillRange(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 4;
  }
  return Math.max(0, Math.min(64, Math.round(Number(value))));
}

function normalizeRemovalEdgeSpillStrength(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 66;
  }
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function normalizeRemovalEdgeDesaturation(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function normalizeRemovalNonContiguous(value: unknown): boolean {
  return value === true;
}

function normalizeRemovalSeed(
  rawValue: unknown,
): PersistedTilesetBatchPickerRemovalSeed | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }
  return {
    x: normalizeRemovalCoordinate(rawValue.x),
    y: normalizeRemovalCoordinate(rawValue.y),
    r: normalizeRemovalChannel(rawValue.r),
    g: normalizeRemovalChannel(rawValue.g),
    b: normalizeRemovalChannel(rawValue.b),
    a: normalizeRemovalChannel(rawValue.a),
  };
}

function normalizeBackgroundRemovalSettings(
  rawValue: unknown,
): PersistedTilesetBatchPickerBackgroundRemovalSettings | null {
  if (!isPlainObject(rawValue)) {
    return null;
  }
  return {
    tolerance: normalizeRemovalTolerance(rawValue.tolerance),
    edgeSoftness: normalizeRemovalEdgeSoftness(rawValue.edgeSoftness),
    edgeSpillRange: normalizeRemovalEdgeSpillRange(rawValue.edgeSpillRange),
    edgeSpillStrength: normalizeRemovalEdgeSpillStrength(
      rawValue.edgeSpillStrength,
    ),
    edgeDesaturation: normalizeRemovalEdgeDesaturation(
      rawValue.edgeDesaturation,
    ),
    nonContiguous: normalizeRemovalNonContiguous(rawValue.nonContiguous),
    seeds: Array.isArray(rawValue.seeds)
      ? rawValue.seeds
          .map((entry) => normalizeRemovalSeed(entry))
          .filter(
            (entry): entry is PersistedTilesetBatchPickerRemovalSeed =>
              entry !== null,
          )
      : [],
  };
}

function normalizeBackgroundRemovalByImageId(
  rawValue: unknown,
): Record<string, PersistedTilesetBatchPickerBackgroundRemovalSettings> {
  if (!isPlainObject(rawValue)) {
    return {};
  }
  const normalized: Record<
    string,
    PersistedTilesetBatchPickerBackgroundRemovalSettings
  > = {};
  for (const [imageId, settings] of Object.entries(rawValue)) {
    const normalizedImageId = String(imageId).trim();
    if (!normalizedImageId) {
      continue;
    }
    const normalizedSettings = normalizeBackgroundRemovalSettings(settings);
    if (!normalizedSettings) {
      continue;
    }
    normalized[normalizedImageId] = normalizedSettings;
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
    selectedOffsets: normalizeSelectedOffsets(rawValue.selectedOffsets),
    selectedCropInsets: normalizeSelectedCropInsets(rawValue.selectedCropInsets),
    backgroundRemovalByImageId: normalizeBackgroundRemovalByImageId(
      rawValue.backgroundRemovalByImageId,
    ),
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
      selectedOffsets: normalizeSelectedOffsets(session.selectedOffsets),
      selectedCropInsets: normalizeSelectedCropInsets(session.selectedCropInsets),
      backgroundRemovalByImageId: normalizeBackgroundRemovalByImageId(
        session.backgroundRemovalByImageId,
      ),
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
