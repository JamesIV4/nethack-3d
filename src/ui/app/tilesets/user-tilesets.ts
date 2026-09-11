import {
  inferNh3dTilesetTileSizeFromAtlasWidthForPath
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

export function toUserTilesetRegistrations(
  records: ReadonlyArray<StoredUserTilesetRecord>,
): ReadonlyArray<{
  id: string;
  label: string;
  tileSize: number;
  tileLayoutVersion: StoredUserTilesetTileLayoutVersion;
  blob: Blob;
}> {
  return records.map((record) => ({
    id: record.id,
    label: record.label,
    tileSize: record.tileSize,
    tileLayoutVersion: record.tileLayoutVersion,
    blob: record.blob,
  }));
}

export async function inferTilesetTileSizeFromBlob(blob: Blob): Promise<number> {
  if (typeof window === "undefined") {
    return 32;
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const size = await new Promise<number>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () =>
        resolve(
          inferNh3dTilesetTileSizeFromAtlasWidthForPath(image.naturalWidth),
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
      try {
        const tileSize = await inferTilesetTileSizeFromBlob(record.blob);
        return {
          ...record,
          tileSize,
        };
      } catch {
        return {
          ...record,
          tileSize: fallbackTileSize,
        };
      }
    }),
  );
}
