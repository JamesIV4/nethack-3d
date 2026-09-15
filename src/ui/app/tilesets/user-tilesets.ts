import {
  inferNh3dTilesetTileDimensions
} from "../../../game/tilesets";
import {
  type StoredUserTilesetRecord,
  type StoredUserTilesetTileLayoutVersion
} from "../../../game/user-tileset-storage";
import {
  t
} from "../shared/translations";

/** User tileset registration, name labels and image-size normalization. */
export function stripUserTilesetNameSuffix(value: string): string {
  return String(value || "")
    .replace(/\s*\(user\)\s*$/i, "")
    .trim();
}

export function appendUserTilesetNameSuffix(value: string): string {
  const normalized = stripUserTilesetNameSuffix(value);
  return normalized ? `${normalized} (user)` : t.tilesets.userTilesetSuffix;
}

export const defaultUserTilesetTileLayoutVersion: StoredUserTilesetTileLayoutVersion =
  "3.6.7";

export function resolveUserTilesetTileHeight(rawHeight: string, inferredHeight: number): number {
  if (!rawHeight.trim()) {
    return inferredHeight;
  }
  const height = Number(rawHeight);
  if (!Number.isSafeInteger(height) || height < 1) {
    throw new Error(t.dialogs.tilesetManager.invalidTileHeight);
  }
  return height;
}

export function toUserTilesetRegistrations(
  records: ReadonlyArray<StoredUserTilesetRecord>,
): ReadonlyArray<{
  id: string;
  label: string;
  tileSize: number;
  tileHeight?: number;
  tileLayoutVersion: StoredUserTilesetTileLayoutVersion;
  blob: Blob;
}> {
  return records.map((record) => ({
    id: record.id,
    label: record.label,
    tileSize: record.tileSize,
    tileHeight: record.tileHeight,
    tileLayoutVersion: record.tileLayoutVersion,
    blob: record.blob,
  }));
}

export async function inferTilesetTileDimensionsFromBlob(
  blob: Blob,
  tileLayoutVersion?: StoredUserTilesetTileLayoutVersion,
): Promise<{ tileWidth: number; tileHeight: number }> {
  if (typeof window === "undefined") {
    return { tileWidth: 32, tileHeight: 32 };
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const size = await new Promise<{ tileWidth: number; tileHeight: number }>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () =>
        resolve(
          inferNh3dTilesetTileDimensions(image.naturalWidth, image.naturalHeight, undefined, tileLayoutVersion),
        );
      image.onerror = () => reject(new Error(t.tilesets.failedToReadImage));
      image.src = objectUrl;
    });
    return size;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function normalizeUserTilesetTileSizes(
  records: ReadonlyArray<StoredUserTilesetRecord>,
): Promise<StoredUserTilesetRecord[]> {
  return Promise.all(
    records.map(async (record) => {
      const fallbackTileSize = Math.max(
        1,
        Math.trunc(Number.isFinite(record.tileSize) ? record.tileSize : 32),
      );
      const fallbackTileHeight = Math.max(
        1,
        Math.trunc(Number.isFinite(record.tileHeight) ? record.tileHeight! : fallbackTileSize),
      );
      try {
        const dimensions = await inferTilesetTileDimensionsFromBlob(record.blob, record.tileLayoutVersion);
        return {
          ...record,
          tileSize: dimensions.tileWidth,
          tileHeight: record.tileHeight !== undefined ? fallbackTileHeight : dimensions.tileHeight,
        };
      } catch {
        return {
          ...record,
          tileSize: fallbackTileSize,
          tileHeight: fallbackTileHeight,
        };
      }
    }),
  );
}
