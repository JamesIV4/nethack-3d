// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import {
  getRuntimeRootPersistenceDbName,
  getRuntimeSaveDbName,
  getRuntimeSaveMountDir,
  isCheckpointLevelFilename,
  supportsRuntimeRootPersistence,
} from "../../save-storage";
import type { RuntimeCheckpoints } from "./checkpoint-files";

export interface RuntimePersistenceDependencies {
  readonly checkpoints: Pick<
    RuntimeCheckpoints,
    "cleanupStaleCheckpointShardsBeforeStartup"
    | "cleanupStaleTemporaryRuntimeLocksBeforeStartup"
    | "removeStaleRecoverableSaveArtifactsBeforeAutosaveResume"
  >;
}

/** Per-module filesystem persistence hooks and ordered save hydration. */
export class RuntimePersistence {

  constructor(private readonly deps: RuntimePersistenceDependencies) {}

  installRuntimeStartupPersistence(mod, runtimeVersion, checkpointStartupOptionEnabled, logStartupHook, listDirectoryEntries) {

    // Setup IndexedDB file system for persisting saves
    const IDBFS =
      mod.FS && mod.FS.filesystems && mod.FS.filesystems.IDBFS
        ? mod.FS.filesystems.IDBFS
        : mod.IDBFS;
    if (mod.FS && IDBFS) {
      // Dynamically locate the CWD so we mount IDBFS exactly where NetHack writes
      const cwd = mod.FS.cwd();
      const saveDir = getRuntimeSaveMountDir(runtimeVersion, cwd);
      const saveDbName = getRuntimeSaveDbName(runtimeVersion, cwd);
      const rootPersistenceEnabled =
        supportsRuntimeRootPersistence(runtimeVersion);
      const rootPersistenceDbName = rootPersistenceEnabled
        ? getRuntimeRootPersistenceDbName(runtimeVersion)
        : "";
      const rootPersistenceStoreName =
        IDBFS.DB_STORE_NAME || "FILE_DATA";
      const rootPersistenceDbVersion =
        Number(IDBFS.DB_VERSION) > 0 ? Number(IDBFS.DB_VERSION) : 21;
      const normalizedCwd = cwd.replace(/\/+$/, "") || "/";
      const normalizedSaveDir =
        saveDir.replace(/\/+$/, "") ||
        getRuntimeSaveMountDir(runtimeVersion);
      // Checkpoint shards always live on the /save mount, independent
      // of root persistence (which persists other top-level game data).
      const checkpointStorageDir = normalizedSaveDir;
      const normalizeRuntimeFsPath = (rawPath) => {
        if (typeof rawPath !== "string" || !rawPath.trim()) {
          return "";
        }
        let normalized = rawPath.replace(/\\/g, "/").trim();
        if (normalized.startsWith("./")) {
          normalized = normalized.slice(2);
        }
        if (!normalized.startsWith("/")) {
          const liveCwd =
            typeof mod.FS.cwd === "function"
              ? String(mod.FS.cwd() || normalizedCwd)
              : normalizedCwd;
          const cwdPrefix = liveCwd.replace(/\/+$/, "") || "/";
          normalized =
            cwdPrefix === "/" ? `/${normalized}` : `${cwdPrefix}/${normalized}`;
        }
        const parts = [];
        for (const part of normalized.split("/")) {
          if (!part || part === ".") {
            continue;
          }
          if (part === "..") {
            parts.pop();
            continue;
          }
          parts.push(part);
        }
        return `/${parts.join("/")}`;
      };
      const basenameForRuntimePath = (path) =>
        String(path || "").split("/").pop() || "";
      const isRootPersistenceStaticFilename = (filename) => {
        const normalized = String(filename || "").toLowerCase();
        return (
          normalized === "nhdat" ||
          normalized === "symbols" ||
          normalized === "sysconf" ||
          normalized === "perm" ||
          normalized === "timestamp" ||
          normalized === ".keep" ||
          normalized === "save" ||
          normalized === "tmp" ||
          normalized === "home" ||
          normalized === "dev" ||
          normalized === "proc"
        );
      };
      const isRootPersistenceLockFilename = (filename) => {
        const normalized = String(filename || "").toLowerCase();
        return (
          normalized === "lock" ||
          /^[a-z]lock$/i.test(normalized) ||
          normalized.endsWith(".lock") ||
          normalized.endsWith("_lock")
        );
      };
      const shouldPersistRootFilePath = (path) => {
        const normalizedPath = normalizeRuntimeFsPath(path);
        const filename = basenameForRuntimePath(normalizedPath);
        if (!shouldPersistRootPathName(normalizedPath, filename)) {
          return false;
        }
        try {
          const stat = mod.FS.stat(normalizedPath);
          return Boolean(stat && mod.FS.isFile(stat.mode));
        } catch {
          return false;
        }
      };
      const shouldPersistRootPathName = (path, filename = null) => {
        const normalizedPath = normalizeRuntimeFsPath(path);
        const normalizedFilename =
          filename ?? basenameForRuntimePath(normalizedPath);
        return Boolean(
          /^\/[^/]+$/.test(normalizedPath) &&
          normalizedFilename &&
          !isRootPersistenceStaticFilename(normalizedFilename) &&
          !isRootPersistenceLockFilename(normalizedFilename) &&
          // Checkpoint/level shards are owned by the /save mount, not
          // root persistence, even though they sit at the FS root.
          !isCheckpointLevelFilename(normalizedFilename),
        );
      };
      const normalizeRootPersistenceKey = (key) => {
        const normalizedPath = normalizeRuntimeFsPath(key);
        return /^\/[^/]+$/.test(normalizedPath) ? normalizedPath : "";
      };
      let rootPersistenceOperationDepth = 0;
      const isRootPersistenceOperationActive = () =>
        rootPersistenceOperationDepth > 0;
      const runDuringRootPersistenceOperation = (operation) => {
        rootPersistenceOperationDepth += 1;
        try {
          return operation();
        } finally {
          rootPersistenceOperationDepth -= 1;
        }
      };
      const openRootPersistenceDatabase = () =>
        new Promise((resolve, reject) => {
          if (
            !rootPersistenceEnabled ||
            !rootPersistenceDbName ||
            typeof indexedDB === "undefined"
          ) {
            resolve(null);
            return;
          }
          const request = indexedDB.open(
            rootPersistenceDbName,
            rootPersistenceDbVersion,
          );
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            let store = null;
            if (db.objectStoreNames.contains(rootPersistenceStoreName)) {
              store = event.target.transaction.objectStore(
                rootPersistenceStoreName,
              );
            } else {
              store = db.createObjectStore(rootPersistenceStoreName);
            }
            if (
              store &&
              !Array.from(store.indexNames || []).includes("timestamp")
            ) {
              store.createIndex("timestamp", "timestamp", {
                unique: false,
              });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const idbRequestToPromise = (request) =>
        new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const decodeStoredRootContents = (value) => {
        const contents =
          value && typeof value === "object" ? value.contents : null;
        if (contents instanceof Uint8Array) {
          return new Uint8Array(contents);
        }
        if (contents instanceof ArrayBuffer) {
          return new Uint8Array(contents);
        }
        if (Array.isArray(contents)) {
          return new Uint8Array(
            contents.map((entry) =>
              Math.max(0, Math.min(255, Number(entry) || 0)),
            ),
          );
        }
        if (
          contents &&
          typeof contents === "object" &&
          Array.isArray(contents.data)
        ) {
          return new Uint8Array(
            contents.data.map((entry) =>
              Math.max(0, Math.min(255, Number(entry) || 0)),
            ),
          );
        }
        return null;
      };
      const hydrateRootPersistence = (callback) => {
        let settled = false;
        const finish = (error = null) => {
          if (settled) {
            return;
          }
          settled = true;
          callback(error);
        };
        if (!rootPersistenceEnabled) {
          finish(null);
          return;
        }
        openRootPersistenceDatabase()
          .then((db) => {
            if (!db) {
              finish(null);
              return;
            }
            if (!db.objectStoreNames.contains(rootPersistenceStoreName)) {
              db.close();
              finish(null);
              return;
            }
            const transaction = db.transaction(
              [rootPersistenceStoreName],
              "readonly",
            );
            const store = transaction.objectStore(
              rootPersistenceStoreName,
            );
            Promise.all([
              idbRequestToPromise(store.getAll()),
              idbRequestToPromise(store.getAllKeys()),
            ])
              .then(([values, keys]) => {
                let restoredCount = 0;
                for (let index = 0; index < values.length; index += 1) {
                  const key =
                    typeof keys[index] === "string"
                      ? normalizeRootPersistenceKey(keys[index])
                      : "";
                  if (!key) {
                    continue;
                  }
                  const filename = basenameForRuntimePath(key);
                  if (
                    isRootPersistenceStaticFilename(filename) ||
                    isRootPersistenceLockFilename(filename) ||
                    // Checkpoint/level shards belong to the /save mount;
                    // never rehydrate them from the root-persistence DB.
                    isCheckpointLevelFilename(filename)
                  ) {
                    continue;
                  }
                  if (
                    values[index] &&
                    typeof values[index] === "object" &&
                    typeof values[index].mode === "number" &&
                    !mod.FS.isFile(values[index].mode)
                  ) {
                    continue;
                  }
                  const contents = decodeStoredRootContents(values[index]);
                  if (!contents) {
                    continue;
                  }
                  try {
                    runDuringRootPersistenceOperation(() => {
                      mod.FS.writeFile(key, contents);
                    });
                    if (
                      values[index] &&
                      typeof values[index] === "object" &&
                      typeof values[index].mode === "number" &&
                      typeof mod.FS.chmod === "function"
                    ) {
                      runDuringRootPersistenceOperation(() => {
                        mod.FS.chmod(key, values[index].mode);
                      });
                    }
                    if (
                      values[index] &&
                      typeof values[index] === "object" &&
                      values[index].timestamp &&
                      typeof mod.FS.utime === "function"
                    ) {
                      const timestamp = new Date(values[index].timestamp);
                      runDuringRootPersistenceOperation(() => {
                        mod.FS.utime(key, timestamp, timestamp);
                      });
                    }
                    restoredCount += 1;
                  } catch (error) {
                    console.warn(
                      `Failed to restore persisted root file ${key}:`,
                      error,
                    );
                  }
                }
                db.close();
                if (restoredCount > 0) {
                  console.log(
                    `Restored ${restoredCount} NetHack root file(s) from ${rootPersistenceDbName}`,
                  );
                }
                finish(null);
              })
              .catch((error) => {
                db.close();
                finish(error);
              });
          })
          .catch((error) => finish(error));
      };
      const readPersistableRootEntries = () => {
        const entries = new Map();
        runDuringRootPersistenceOperation(() => {
          let names = [];
          try {
            names = mod.FS.readdir("/");
          } catch {
            return;
          }
          for (const name of names) {
            const filename = String(name || "");
            const path = `/${filename}`;
            if (!shouldPersistRootFilePath(path)) {
              continue;
            }
            try {
              const stat = mod.FS.stat(path);
              const contents = mod.FS.readFile(path);
              entries.set(path, {
                timestamp:
                  stat && stat.mtime instanceof Date
                    ? stat.mtime
                    : new Date(),
                mode: stat.mode,
                contents: new Uint8Array(contents),
              });
            } catch (error) {
              console.warn(
                `Failed to read root file ${path} for persistence:`,
                error,
              );
            }
          }
        });
        return entries;
      };
      const flushRootPersistence = (reason, callback = null) => {
        if (!rootPersistenceEnabled) {
          if (typeof callback === "function") {
            callback(null);
          }
          return;
        }
        const entries = readPersistableRootEntries();
        openRootPersistenceDatabase()
          .then((db) => {
            if (!db) {
              if (typeof callback === "function") {
                callback(null);
              }
              return;
            }
            const transaction = db.transaction(
              [rootPersistenceStoreName],
              "readwrite",
            );
            const store = transaction.objectStore(
              rootPersistenceStoreName,
            );
            const keysRequest = store.getAllKeys();
            keysRequest.onsuccess = () => {
              const existingKeys = Array.from(keysRequest.result || [])
                .filter((key) => typeof key === "string")
                .map((key) => ({
                  original: key,
                  normalized: normalizeRootPersistenceKey(key),
                }));
              const operations = [];
              for (const { original, normalized } of existingKeys) {
                if (!normalized) {
                  operations.push(idbRequestToPromise(store.delete(original)));
                  continue;
                }
                const filename = basenameForRuntimePath(normalized);
                if (
                  isRootPersistenceStaticFilename(filename) ||
                  isRootPersistenceLockFilename(filename)
                ) {
                  operations.push(idbRequestToPromise(store.delete(original)));
                  continue;
                }
                if (!entries.has(normalized)) {
                  operations.push(idbRequestToPromise(store.delete(original)));
                }
              }
              for (const [path, entry] of entries.entries()) {
                operations.push(idbRequestToPromise(store.put(entry, path)));
              }
              Promise.all(operations)
                .then(() => {
                  db.close();
                  if (
                    entries.size > 0 &&
                    (reason === "startup" || reason === "postRun")
                  ) {
                    console.log(
                      `Persisted ${entries.size} NetHack root file(s) to ${rootPersistenceDbName} (${reason})`,
                    );
                  }
                  if (typeof callback === "function") {
                    callback(null);
                  }
                })
                .catch((error) => {
                  db.close();
                  if (typeof callback === "function") {
                    callback(error);
                  }
                });
            };
            keysRequest.onerror = () => {
              const error = keysRequest.error;
              db.close();
              if (typeof callback === "function") {
                callback(error);
              }
            };
          })
          .catch((error) => {
            if (typeof callback === "function") {
              callback(error);
            }
          });
      };
      let rootPersistenceFlushInFlight = false;
      let rootPersistenceFlushQueued = false;
      let rootPersistenceFlushTimer = 0;
      const runQueuedRootPersistenceFlush = (reason = "queued") => {
        if (!rootPersistenceEnabled) {
          return;
        }
        if (rootPersistenceFlushInFlight) {
          rootPersistenceFlushQueued = true;
          return;
        }
        rootPersistenceFlushInFlight = true;
        flushRootPersistence(reason, (error) => {
          if (error) {
            console.warn("NetHack root persistence flush failed:", error);
          }
          rootPersistenceFlushInFlight = false;
          if (rootPersistenceFlushQueued) {
            rootPersistenceFlushQueued = false;
            runQueuedRootPersistenceFlush("queued");
          }
        });
      };
      const scheduleRootPersistenceFlush = (reason = "scheduled") => {
        if (
          !rootPersistenceEnabled ||
          isRootPersistenceOperationActive()
        ) {
          return;
        }
        if (rootPersistenceFlushTimer) {
          clearTimeout(rootPersistenceFlushTimer);
        }
        rootPersistenceFlushTimer = globalThis.setTimeout(() => {
          rootPersistenceFlushTimer = 0;
          runQueuedRootPersistenceFlush(reason);
        }, 75);
      };
      if (rootPersistenceEnabled) {
        mod.__nh3dFlushRootPersistence = flushRootPersistence;
        mod.__nh3dHydrateRootPersistence = hydrateRootPersistence;
      }

      const patchIdbfsDbNameResolution = () => {
        if (!IDBFS || typeof IDBFS.getDB !== "function") {
          return;
        }
        if (!(IDBFS.__nh3dDbNameByMountPoint instanceof Map)) {
          IDBFS.__nh3dDbNameByMountPoint = new Map();
        }
        IDBFS.__nh3dDbNameByMountPoint.set(saveDir, saveDbName);
        if (IDBFS.__nh3dGetDbPatched) {
          return;
        }
        const originalGetDb = IDBFS.getDB.bind(IDBFS);
        IDBFS.getDB = function (name, callback) {
          const mappedName =
            this.__nh3dDbNameByMountPoint instanceof Map
              ? this.__nh3dDbNameByMountPoint.get(name) || name
              : name;
          return originalGetDb(mappedName, callback);
        };
        IDBFS.__nh3dGetDbPatched = true;
      };
      patchIdbfsDbNameResolution();

      if (!mod.FS.analyzePath(saveDir).exists) {
        try {
          mod.FS.mkdir(saveDir);
        } catch (e) {
          console.warn(`Failed to create ${saveDir}`, e);
        }
      }

      let scheduleCheckpointSync = () => { };
      if (checkpointStartupOptionEnabled) {
        // NetHack checkpointing writes level snapshots as
        // "<lockname>.<level>" in the current working directory.
        // Route those into the /save mount so they persist through the
        // IDBFS syncfs path. This runs even when root persistence is on,
        // since root persistence only owns other top-level game data.
        const remapCheckpointLevelPath = (rawPath) => {
          if (typeof rawPath !== "string" || !rawPath) {
            return rawPath;
          }

          const slashNormalized = rawPath.replace(/\\/g, "/").trim();
          if (!slashNormalized) {
            return rawPath;
          }
          const withoutDotPrefix = slashNormalized.startsWith("./")
            ? slashNormalized.slice(2)
            : slashNormalized;

          const lastSlashIndex = withoutDotPrefix.lastIndexOf("/");
          const baseName =
            lastSlashIndex >= 0
              ? withoutDotPrefix.slice(lastSlashIndex + 1)
              : withoutDotPrefix;
          if (!isCheckpointLevelFilename(baseName)) {
            return rawPath;
          }

          if (withoutDotPrefix.startsWith(`${normalizedSaveDir}/`)) {
            return rawPath;
          }

          let shouldRemap = false;
          if (lastSlashIndex < 0) {
            shouldRemap = true;
          } else {
            const parentPath =
              withoutDotPrefix.slice(0, lastSlashIndex) || "/";
            if (
              parentPath === "/" ||
              parentPath === normalizedCwd ||
              parentPath === "."
            ) {
              shouldRemap = true;
            }
          }

          if (!shouldRemap) {
            return rawPath;
          }

          const remappedPath = `${normalizedSaveDir}/${baseName}`;
          if (remappedPath !== rawPath) {
            console.log(
              `Remapping checkpoint level file path: ${rawPath} -> ${remappedPath}`,
            );
          }
          return remappedPath;
        };

        const wrapFsPathMethod = (methodName) => {
          const originalMethod = mod.FS[methodName];
          if (typeof originalMethod !== "function") {
            return;
          }
          mod.FS[methodName] = function (path, ...args) {
            return originalMethod.call(
              this,
              remapCheckpointLevelPath(path),
              ...args,
            );
          };
        };
        wrapFsPathMethod("open");
        wrapFsPathMethod("unlink");
      }

      const originalSyncfs =
        typeof mod.FS.syncfs === "function"
          ? mod.FS.syncfs.bind(mod.FS)
          : null;
      if (originalSyncfs) {
        const syncfsQueue = [];
        let syncfsInFlight = false;

        const queueSyncfs = (populate, callback) => {
          syncfsQueue.push({
            populate: Boolean(populate),
            callback: typeof callback === "function" ? callback : null,
          });
          if (syncfsInFlight) {
            return;
          }

          const runNext = () => {
            const next = syncfsQueue.shift();
            if (!next) {
              syncfsInFlight = false;
              return;
            }
            syncfsInFlight = true;
            originalSyncfs(next.populate, (err) => {
              const finish = (rootErr = null) => {
                try {
                  if (next.callback) {
                    next.callback(err || rootErr);
                  }
                } finally {
                  runNext();
                }
              };
              if (err || next.populate || !rootPersistenceEnabled) {
                finish();
                return;
              }
              flushRootPersistence("syncfs", finish);
            });
          };

          runNext();
        };

        mod.FS.syncfs = function (populateOrCallback, maybeCallback) {
          if (typeof populateOrCallback === "function") {
            queueSyncfs(false, populateOrCallback);
            return;
          }
          queueSyncfs(populateOrCallback, maybeCallback);
        };
      }

      if (rootPersistenceEnabled) {
        const isWritableOpenFlags = (flags, streamFlags) => {
          if (typeof flags === "string") {
            return /[wa+]/.test(flags);
          }
          const numericFlags =
            typeof streamFlags === "number"
              ? streamFlags
              : typeof flags === "number"
                ? flags
                : null;
          if (numericFlags === null) {
            return false;
          }
          return Boolean(
            (numericFlags & 3) !== 0 ||
            (numericFlags & 64) !== 0 ||
            (numericFlags & 512) !== 0 ||
            (numericFlags & 1024) !== 0,
          );
        };
        const originalOpen = mod.FS.open;
        if (typeof originalOpen === "function") {
          mod.FS.open = function (path, flags, ...args) {
            const normalizedPath = normalizeRuntimeFsPath(path);
            const stream = originalOpen.call(this, path, flags, ...args);
            if (
              !isRootPersistenceOperationActive() &&
              shouldPersistRootFilePath(normalizedPath) &&
              isWritableOpenFlags(flags, stream?.flags)
            ) {
              stream.__nh3dRootPersistenceWritable = true;
            }
            return stream;
          };
        }
        const originalUnlink = mod.FS.unlink;
        if (typeof originalUnlink === "function") {
          mod.FS.unlink = function (path, ...args) {
            const normalizedPath = normalizeRuntimeFsPath(path);
            const filename = basenameForRuntimePath(normalizedPath);
            const shouldFlushRoot =
              !isRootPersistenceOperationActive() &&
              shouldPersistRootPathName(normalizedPath, filename);
            const result = originalUnlink.call(this, path, ...args);
            if (shouldFlushRoot) {
              scheduleRootPersistenceFlush("unlink");
            }
            return result;
          };
        }
      }

      if (checkpointStartupOptionEnabled || rootPersistenceEnabled) {
        let checkpointSyncInFlight = false;
        let checkpointSyncQueued = false;
        let checkpointSyncTimer = 0;
        const checkpointSyncDebounceMs = 150;
        const flushCheckpointSync = () => {
          if (checkpointSyncInFlight) {
            checkpointSyncQueued = true;
            return;
          }
          checkpointSyncInFlight = true;
          mod.FS.syncfs(false, (err) => {
            if (err) {
              console.warn("IDBFS checkpoint sync error:", err);
            }
            checkpointSyncInFlight = false;
            if (checkpointSyncQueued) {
              checkpointSyncQueued = false;
              flushCheckpointSync();
            }
          });
        };
        scheduleCheckpointSync = () => {
          if (checkpointSyncTimer) {
            clearTimeout(checkpointSyncTimer);
          }
          checkpointSyncTimer = globalThis.setTimeout(() => {
            checkpointSyncTimer = 0;
            flushCheckpointSync();
          }, checkpointSyncDebounceMs);
        };

        const originalClose = mod.FS.close;
        if (typeof originalClose === "function") {
          mod.FS.close = function (stream, ...args) {
            const streamPath =
              stream && typeof stream.path === "string"
                ? stream.path
                : "";
            const normalizedStreamPath =
              normalizeRuntimeFsPath(streamPath);
            const streamWasRootPersistenceWrite =
              Boolean(stream?.__nh3dRootPersistenceWritable) &&
              !isRootPersistenceOperationActive();
            // Checkpoint shards are remapped onto the /save mount (even
            // under root persistence), so sync them through syncfs
            // whenever a "<lock>.<level>" file under /save is closed.
            const shouldSyncCheckpoint =
              normalizedStreamPath.startsWith(`${normalizedSaveDir}/`) &&
              /\/[^/]+\.\d+$/.test(normalizedStreamPath);
            const shouldFlushRoot =
              rootPersistenceEnabled &&
              streamWasRootPersistenceWrite &&
              shouldPersistRootFilePath(normalizedStreamPath);
            const result = originalClose.call(this, stream, ...args);
            if (shouldSyncCheckpoint) {
              scheduleCheckpointSync();
            }
            if (shouldFlushRoot) {
              scheduleRootPersistenceFlush("close");
            }
            return result;
          };
        }
      }

      try {
        mod.FS.mount(IDBFS, { dbName: saveDbName }, saveDir);
        logStartupHook("preRun:idbfs-mounted", mod, {
          saveDir,
          saveDbName,
          rootPersistenceEnabled,
          rootPersistenceDbName,
          rootEntries: listDirectoryEntries(mod, "/"),
          saveEntries: listDirectoryEntries(mod, saveDir),
        });
        mod.addRunDependency("idbfs_sync");
        let idbfsSyncDependencyRemoved = false;
        const removeIdbfsSyncDependency = () => {
          if (idbfsSyncDependencyRemoved) {
            return;
          }
          idbfsSyncDependencyRemoved = true;
          mod.removeRunDependency("idbfs_sync");
        };
        mod.FS.syncfs(true, (err) => {
          if (err) {
            console.warn("IDBFS load syncfs error:", err);
            logStartupHook("preRun:idbfs-sync-error", mod, {
              saveDir,
              saveDbName,
              error:
                err instanceof Error && err.message
                  ? err.message
                  : String(err ?? ""),
            });
            removeIdbfsSyncDependency();
            return;
          }

          const finishStartupPersistence = () => {
            try {
              console.log(`IDBFS mounted and synced at ${saveDir}`);
              logStartupHook("preRun:idbfs-synced", mod, {
                saveDir,
                saveDbName,
                rootPersistenceEnabled,
                rootPersistenceDbName,
                checkpointStorageDir,
                rootEntries: listDirectoryEntries(mod, "/"),
                saveEntries: listDirectoryEntries(mod, saveDir),
              });
              try {
                const sysconfPath = "/sysconf";
                if (
                  mod.FS.analyzePath(sysconfPath).exists &&
                  typeof mod.FS.readFile === "function"
                ) {
                  const sysconfRaw = String(
                    mod.FS.readFile(sysconfPath, { encoding: "utf8" }) ||
                    "",
                  );
                  const maxPlayersLine =
                    sysconfRaw
                      .split(/\r?\n/)
                      .find((line) =>
                        /^MAXPLAYERS=/i.test(line.trim()),
                      ) || "";
                  if (maxPlayersLine) {
                    console.log(
                      `Embedded runtime sysconf ${maxPlayersLine.trim()}`,
                    );
                  }
                }
              } catch (error) {
                console.warn("Failed to inspect embedded /sysconf:", error);
              }

              const removedCheckpointShardCount =
                this.deps.checkpoints.cleanupStaleCheckpointShardsBeforeStartup(
                  mod,
                  checkpointStorageDir,
                );
              const removedTemporaryLockShardCount =
                this.deps.checkpoints.cleanupStaleTemporaryRuntimeLocksBeforeStartup(
                  mod,
                  checkpointStorageDir,
                );
              const removedRecoverableSaveArtifactCount =
                this.deps.checkpoints.removeStaleRecoverableSaveArtifactsBeforeAutosaveResume(
                  mod,
                  checkpointStorageDir,
                );
              if (
                removedCheckpointShardCount +
                removedTemporaryLockShardCount +
                removedRecoverableSaveArtifactCount >
                0
              ) {
                mod.FS.syncfs(false, (syncErr) => {
                  if (syncErr) {
                    console.warn(
                      "IDBFS stale checkpoint cleanup sync error:",
                      syncErr,
                    );
                  }
                  removeIdbfsSyncDependency();
                });
                return;
              }
            } catch (error) {
              console.warn(
                "IDBFS startup persistence cleanup failed:",
                error,
              );
            } finally {
              removeIdbfsSyncDependency();
            }
          };

          finishStartupPersistence();
        });
      } catch (e) {
        console.warn(`Failed to mount IDBFS at ${saveDir}`, e);
        logStartupHook("preRun:idbfs-mount-error", mod, {
          saveDir,
          saveDbName,
          error:
            e instanceof Error && e.message
              ? e.message
              : String(e ?? ""),
        });
      }
    }
  }
}
