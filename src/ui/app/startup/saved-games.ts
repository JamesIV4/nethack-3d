import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  supportsRuntimeCheckpointRecovery
} from "../../../runtime/runtime-capabilities";
import {
  resolveRuntimeSaveDbNames,
  getStoredFileByteLength,
  isRecoverableCheckpointLevelZeroByteLength
} from "../../../runtime/save-storage";
import {
  resolveSaveResumeInitOptionTokens,
  resolveSavePresentationMetadataEntry
} from "../../../runtime/save-presentation-metadata";
import {
  readSavePresentationMetadataByKey
} from "./save-presentation";
import {
  normalizeStartupCharacterName
} from "./character-preferences";

/** IndexedDB save discovery, grouping, resumability and deletion. */
export type SaveGameRecord = {
  key: string;
  name: string;
  displayName: string;
  displayPlayMode: "normal" | "explore" | "debug" | null;
  initOptions?: string[];
  category: "manual" | "autosave";
  isResumable: boolean;
  timestamp: Date;
  dateFormatted: string;
  files: Array<{
    dbName: string;
    key: string;
    filename: string;
    timestamp: Date;
  }>;
};

export function resolveSaveCategory(filename: string): "manual" | "autosave" {
  const normalizedFilename = filename.toLowerCase();
  if (/(?:\.e|-e)(?:\.[a-z0-9]+)?$/.test(normalizedFilename)) {
    return "autosave";
  }
  // NetHack checkpoint files are level snapshots like "<uid><name>.<level>".
  if (/\.\d+$/.test(normalizedFilename)) {
    return "autosave";
  }
  return "manual";
}

export function isCheckpointShardFilename(filename: string): boolean {
  return /\.\d+$/i.test(String(filename || "").toLowerCase());
}

export function resolveSaveDisplayName(
  name: string,
  category: "manual" | "autosave",
): string {
  if (category === "autosave") {
    return name
      .replace(/(?:\.e|-e)(?:\.[a-z0-9]+)?$/i, "")
      .replace(/\.\d+$/i, "");
  }
  return name;
}

export function resolveSaveLogicalName(
  filename: string,
  category: "manual" | "autosave",
): string {
  const strippedName = filename.replace(/^\d+/, "");
  if (category === "autosave") {
    return strippedName
      .replace(/(?:\.e|-e)(?:\.[a-z0-9]+)?$/i, "")
      .replace(/\.\d+$/i, "");
  }
  return strippedName;
}

export async function fetchSavedGames(
  runtimeVersion: NethackRuntimeVersion,
): Promise<SaveGameRecord[]> {
  const saves = new Map<string, SaveGameRecord>();
  const dbNames = await resolveRuntimeSaveDbNames(runtimeVersion);
  const checkpointRecoverySupported =
    supportsRuntimeCheckpointRecovery(runtimeVersion);
  const savePresentationMetadataByKey = readSavePresentationMetadataByKey();

  for (const dbName of dbNames) {
    try {
      const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (e) => {
          (e.target as IDBOpenDBRequest).transaction?.abort();
          resolve(null);
        };
      });

      if (!db) continue;

      if (!db.objectStoreNames.contains("FILE_DATA")) {
        db.close();
        continue;
      }

      const records = await new Promise<{ key: string; value: any }[]>(
        (resolve, reject) => {
          const transaction = db.transaction(["FILE_DATA"], "readonly");
          const store = transaction.objectStore("FILE_DATA");
          const request = store.getAll();
          const keysRequest = store.getAllKeys();

          request.onsuccess = () => {
            keysRequest.onsuccess = () => {
              const result = [];
              for (let i = 0; i < request.result.length; i++) {
                result.push({
                  key: keysRequest.result[i] as string,
                  value: request.result[i],
                });
              }
              resolve(result);
            };
            keysRequest.onerror = () => reject(keysRequest.error);
          };
          request.onerror = () => reject(request.error);
        },
      );

      for (const record of records) {
        const key = record.key;
        const value = record.value;
        if (!key || typeof key !== "string") continue;

        const filename = key.split("/").pop();
        if (!filename) continue;
        const normalizedFilename = filename.toLowerCase();

        const isCheckpointShard = isCheckpointShardFilename(filename);
        const isCheckpointLevelZero = /\.0$/i.test(normalizedFilename);
        const fileByteLength = getStoredFileByteLength(value);
        const isRecoverableCheckpointLevelZero =
          isCheckpointLevelZero &&
          isRecoverableCheckpointLevelZeroByteLength(fileByteLength);
        const isTemporaryLockCheckpointShard = /^[a-z]lock\.\d+$/i.test(
          normalizedFilename,
        );

        // Ignore structural/metadata files used by NetHack
        const knownNonSaves = [
          "record",
          "logfile",
          "xlogfile",
          "nhdat",
          "sysconf",
          "perm",
          "timestamp",
          ".keep",
          "save",
          "tmp",
          "home",
          "dev",
          "proc",
        ];
        if (knownNonSaves.includes(normalizedFilename)) continue;
        if (
          /^bon\d?[a-z].*\./i.test(normalizedFilename) ||
          normalizedFilename.endsWith(".bn")
        ) {
          continue;
        }
        if (normalizedFilename.includes("level")) {
          continue;
        }
        // These shards come from lock-letter mode (MAXPLAYERS>0). Our current
        // browser resume bridge targets UID+name locknames, so these cannot be
        // resumed by character selection and should not be listed as loadable.
        if (isTemporaryLockCheckpointShard) {
          continue;
        }
        // Drop non-shard lock artifacts.
        const isLockArtifact =
          normalizedFilename === "lock" ||
          /^[a-z]lock$/i.test(normalizedFilename) ||
          normalizedFilename.endsWith(".lock") ||
          normalizedFilename.endsWith("_lock");
        if (isLockArtifact && !isCheckpointShard) {
          continue;
        }

        // NetHack prepends a user ID (usually 0) to save files, e.g. "0Web_user".
        const category = resolveSaveCategory(filename);
        const name = resolveSaveLogicalName(filename, category);
        if (name && value && value.timestamp) {
          const timestamp = new Date(value.timestamp);
          const logicalKey = `${category}:${name}`;
          const presentationMetadata = resolveSavePresentationMetadataEntry(
            savePresentationMetadataByKey,
            runtimeVersion,
            category,
            name,
          );
          const displayPlayMode =
            presentationMetadata &&
              (presentationMetadata.playMode === "normal" ||
                presentationMetadata.playMode === "explore" ||
                presentationMetadata.playMode === "debug")
              ? presentationMetadata.playMode
              : null;
          const displayName =
            presentationMetadata &&
              typeof presentationMetadata.characterName === "string" &&
              presentationMetadata.characterName.trim().length > 0
              ? normalizeStartupCharacterName(
                presentationMetadata.characterName,
              )
              : resolveSaveDisplayName(name, category);
          const initOptions =
            presentationMetadata &&
              Array.isArray(presentationMetadata.initOptions)
              ? resolveSaveResumeInitOptionTokens(
                presentationMetadata.initOptions,
                runtimeVersion,
              )
              : resolveSaveResumeInitOptionTokens([], runtimeVersion);
          const existing = saves.get(logicalKey);
          if (existing) {
            existing.files.push({
              dbName,
              key,
              filename,
              timestamp,
            });
            if (
              !isCheckpointShard ||
              (checkpointRecoverySupported && isRecoverableCheckpointLevelZero)
            ) {
              existing.isResumable = true;
            }
            if (existing.timestamp < timestamp) {
              existing.timestamp = timestamp;
              existing.dateFormatted = timestamp.toLocaleString();
            }
            continue;
          }

          saves.set(logicalKey, {
            key: logicalKey,
            name,
            displayName,
            displayPlayMode,
            initOptions,
            category,
            // A lone "<lock>.0" file at 4 bytes is just NetHack's pid lock,
            // not a recoverable checkpoint autosave.
            isResumable:
              !isCheckpointShard ||
              (checkpointRecoverySupported && isRecoverableCheckpointLevelZero),
            timestamp,
            dateFormatted: timestamp.toLocaleString(),
            files: [
              {
                dbName,
                key,
                filename,
                timestamp,
              },
            ],
          });
        }
      }

      db.close();
    } catch (e) {
      console.warn(`Could not read IndexedDB ${dbName}:`, e);
    }
  }

  return Array.from(saves.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
}

export async function deleteSavedGame(save: SaveGameRecord): Promise<void> {
  const fileGroups = new Map<
    string,
    Array<{ key: string; filename: string; timestamp: Date }>
  >();

  for (const file of save.files) {
    const existing = fileGroups.get(file.dbName);
    if (existing) {
      existing.push(file);
      continue;
    }
    fileGroups.set(file.dbName, [file]);
  }

  for (const [dbName, files] of fileGroups.entries()) {
    try {
      const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (e) => {
          (e.target as IDBOpenDBRequest).transaction?.abort();
          resolve(null);
        };
      });

      if (!db) continue;

      if (!db.objectStoreNames.contains("FILE_DATA")) {
        db.close();
        continue;
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(["FILE_DATA"], "readwrite");
        const store = transaction.objectStore("FILE_DATA");

        let remaining = files.length;
        if (remaining <= 0) {
          resolve();
          return;
        }

        const completeDelete = () => {
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
          }
        };

        for (const file of files) {
          const request = store.delete(file.key);
          request.onsuccess = () => completeDelete();
          request.onerror = () => reject(request.error);
        }
      });

      db.close();
    } catch (e) {
      console.warn(`Could not delete from IndexedDB ${dbName}:`, e);
    }
  }
}
