// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import {
  getRuntimeCheckpointMountDir,
  isRecoverableCheckpointLevelZeroByteLength,
} from "../../save-storage";
import type { RuntimeStartupConfiguration } from "../startup/startup-configuration";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeGameOver } from "../lifecycle/game-over";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimeCheckpointRecovery } from "./checkpoint-recovery";

export interface RuntimeCheckpointsDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "nethackModule"
    | "runtimeVersion"
    | "startupOptions"
  >;
  readonly gameOver: Pick<
    RuntimeGameOver,
    "lastKnownPlayerName"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "readGlobalValue"
  >;
  readonly recovery: Pick<
    RuntimeCheckpointRecovery,
    "isAutosaveResumeRequested"
  >;
  readonly startupOptions: Pick<
    RuntimeStartupConfiguration,
    "buildStartupInitRuntimeOptions"
    | "isWizardDebugStartupRequested"
    | "normalizeCharacterNameValue"
  >;
}

/** Checkpoint file discovery, cleanup and recoverable artifact validation. */
export class RuntimeCheckpoints {

  constructor(private readonly deps: RuntimeCheckpointsDependencies) {}

  buildCheckpointLockBaseName(name) {
    const normalized = this.deps.startupOptions.normalizeCharacterNameValue(name);
    if (!normalized) {
      return "";
    }
    return `0${normalized.replace(/[./ ]/g, "_")}`;
  }

  getStartupCheckpointLockBaseNameCandidates() {
    const candidates = [];
    const candidateNames = [
      this.deps.coordinator.startupOptions?.characterCreation?.name,
      this.deps.gameOver.lastKnownPlayerName,
    ];
    if (this.deps.startupOptions.isWizardDebugStartupRequested()) {
      // In wizard/debug playmode NetHack can normalize the effective lockname
      // to "wizard" regardless of the configured startup name.
      candidateNames.push("wizard");
    }

    const seen = new Set();
    for (const candidateName of candidateNames) {
      const lockBaseName = this.buildCheckpointLockBaseName(candidateName);
      if (!lockBaseName || seen.has(lockBaseName)) {
        continue;
      }
      seen.add(lockBaseName);
      candidates.push(lockBaseName);
    }
    return candidates;
  }

  getTemporaryRuntimeLockBaseNames() {
    const candidates = [];
    for (let index = 0; index < 26; index += 1) {
      candidates.push(`${String.fromCharCode(97 + index)}lock`);
    }
    return candidates;
  }

  shouldCleanupCheckpointShardsBeforeStartup() {
    if (!this.deps.startupOptions.buildStartupInitRuntimeOptions().includes("checkpoint")) {
      return false;
    }
    const characterCreation = this.deps.coordinator.startupOptions?.characterCreation;
    if (characterCreation?.mode !== "resume") {
      return false;
    }
    // Autosave resume needs checkpoint shards intact so the wasm bridge can
    // recover them into a real save before startup.
    if (characterCreation.resumeCategory === "autosave") {
      return false;
    }
    // Manual-save resume should discard stale checkpoint shards to avoid
    // lock-file prompts before the normal UI callback path is ready.
    return this.getStartupCheckpointLockBaseNameCandidates().length > 0;
  }

  shouldCleanupTemporaryRuntimeLocksBeforeStartup() {
    const characterCreation = this.deps.coordinator.startupOptions?.characterCreation;
    return characterCreation?.mode === "resume";
  }

  joinRuntimeFsPath(dir, filename) {
    const normalizedDir = String(dir || "/").replace(/\/+$/, "") || "/";
    return normalizedDir === "/" ? `/${filename}` : `${normalizedDir}/${filename}`;
  }

  getRuntimeCheckpointStorageDir(mod = this.deps.coordinator.nethackModule) {
    // Checkpoint/level shards always live on the dedicated /save IDBFS mount,
    // even when runtime root persistence is enabled for other top-level game
    // data (record/xlogfile/bones). Root persistence proved unreliable for the
    // continuously-rewritten checkpoint shards, so keep them on the
    // battle-tested syncfs path where autosaves originally worked.
    const cwd =
      typeof mod?.FS?.cwd === "function"
        ? String(mod.FS.cwd() || "/")
        : String(this.deps.coordinator.nethackModule?.FS?.cwd?.() || "/");
    return getRuntimeCheckpointMountDir(this.deps.coordinator.runtimeVersion, cwd);
  }

  removeCheckpointShardsByLockBaseName(mod, saveDir, lockBaseName, reason) {
    if (!mod?.FS || !saveDir || !lockBaseName) {
      return 0;
    }

    const escapedLockBaseName = lockBaseName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const checkpointShardPattern = new RegExp(
      `^${escapedLockBaseName}\\.\\d+$`,
    );

    let entries = [];
    try {
      entries = mod.FS.readdir(saveDir);
    } catch (error) {
      console.warn(
        `Failed to enumerate ${saveDir} for save-shard cleanup (${reason}):`,
        error,
      );
      return 0;
    }

    const shardPaths = entries
      .filter((entry) => checkpointShardPattern.test(String(entry)))
      .map((entry) => this.joinRuntimeFsPath(saveDir, entry));

    if (shardPaths.length === 0) {
      return 0;
    }

    console.log(
      `Removing ${shardPaths.length} save shard(s) for "${lockBaseName}" (${reason})`,
    );

    let removedCount = 0;
    for (const shardPath of shardPaths) {
      try {
        mod.FS.unlink(shardPath);
        removedCount += 1;
      } catch (error) {
        console.warn(
          `Failed to remove save shard ${shardPath} (${reason}):`,
          error,
        );
      }
    }

    return removedCount;
  }

  resolveCurrentCheckpointLockBaseName() {
    const resolvedName =
      this.deps.startupOptions.normalizeCharacterNameValue(this.deps.gameOver.lastKnownPlayerName) ||
      this.deps.startupOptions.normalizeCharacterNameValue(
        String(this.deps.memory.readGlobalValue(["plname"]) || ""),
      ) ||
      this.deps.startupOptions.normalizeCharacterNameValue(
        this.deps.coordinator.startupOptions?.characterCreation?.name,
      );
    return this.buildCheckpointLockBaseName(resolvedName);
  }

  cleanupAndFlushCheckpointShardsAfterGameOver(onComplete) {
    const done = () => {
      if (typeof onComplete === "function") {
        onComplete();
      }
    };

    const mod = this.deps.coordinator.nethackModule;
    if (!mod?.FS) {
      done();
      return;
    }

    const saveDir = this.getRuntimeCheckpointStorageDir(mod);
    const lockBaseName = this.resolveCurrentCheckpointLockBaseName();
    if (lockBaseName) {
      this.removeCheckpointShardsByLockBaseName(
        mod,
        saveDir,
        lockBaseName,
        "after game over",
      );
    }

    if (typeof mod.FS.syncfs !== "function") {
      done();
      return;
    }

    try {
      mod.FS.syncfs(false, (error) => {
        if (error) {
          console.warn("IDBFS sync after game-over checkpoint cleanup failed:", error);
        }
        done();
      });
    } catch (error) {
      console.warn("IDBFS sync exception after game-over checkpoint cleanup:", error);
      done();
    }
  }

  cleanupStaleCheckpointShardsBeforeStartup(mod, saveDir) {
    if (!mod?.FS || !this.shouldCleanupCheckpointShardsBeforeStartup()) {
      return 0;
    }

    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return 0;
    }
    let removedCount = 0;
    for (const lockBaseName of lockBaseNames) {
      removedCount += this.removeCheckpointShardsByLockBaseName(
        mod,
        saveDir,
        lockBaseName,
        "before startup",
      );
    }
    return removedCount;
  }

  cleanupStaleTemporaryRuntimeLocksBeforeStartup(mod, saveDir) {
    if (!mod?.FS || !this.shouldCleanupTemporaryRuntimeLocksBeforeStartup()) {
      return 0;
    }

    let removedCount = 0;
    for (const lockBaseName of this.getTemporaryRuntimeLockBaseNames()) {
      removedCount += this.removeCheckpointShardsByLockBaseName(
        mod,
        saveDir,
        lockBaseName,
        "before startup (temporary runtime lock)",
      );
    }
    return removedCount;
  }

  getRecoverableSaveArtifactNames(lockBaseName) {
    if (!lockBaseName) {
      return [];
    }
    return [
      lockBaseName,
      `${lockBaseName}.e`,
      `${lockBaseName}.e;1`,
      `${lockBaseName}.gz`,
      `${lockBaseName}.Z`,
    ];
  }

  getCheckpointLevelZeroArtifactSizeBytes(mod, saveDir, lockBaseName) {
    if (!mod?.FS || !saveDir || !lockBaseName) {
      return null;
    }

    const checkpointLevelZeroPath = this.joinRuntimeFsPath(
      saveDir,
      `${lockBaseName}.0`,
    );
    try {
      if (!mod.FS.analyzePath(checkpointLevelZeroPath)?.exists) {
        return null;
      }
      if (typeof mod.FS.stat !== "function") {
        return null;
      }
      const statResult = mod.FS.stat(checkpointLevelZeroPath);
      if (
        !statResult ||
        typeof statResult.size !== "number" ||
        !Number.isFinite(statResult.size)
      ) {
        return null;
      }
      return Math.trunc(statResult.size);
    } catch {
      return null;
    }
  }

  logAutosaveCheckpointArtifactsBeforeStartup() {
    if (!this.deps.recovery.isAutosaveResumeRequested()) {
      return;
    }

    const mod = this.deps.coordinator.nethackModule;
    if (!mod?.FS || typeof mod.FS.readdir !== "function") {
      return;
    }

    const saveDir = this.getRuntimeCheckpointStorageDir(mod);
    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return;
    }

    try {
      const entries = mod.FS.readdir(saveDir);
      for (const lockBaseName of lockBaseNames) {
        const escapedLockBaseName = lockBaseName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const shardPattern = new RegExp(`^${escapedLockBaseName}\\.\\d+$`);
        const shardDiagnostics = entries
          .filter((entry) => shardPattern.test(String(entry)))
          .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
          .map((entry) => {
            const artifactPath = this.joinRuntimeFsPath(saveDir, entry);
            let byteLength = null;
            try {
              if (typeof mod.FS.stat === "function") {
                const statResult = mod.FS.stat(artifactPath);
                if (
                  statResult &&
                  typeof statResult.size === "number" &&
                  Number.isFinite(statResult.size)
                ) {
                  byteLength = Math.trunc(statResult.size);
                }
              }
            } catch {
              byteLength = null;
            }
            return {
              path: artifactPath,
              byteLength,
            };
          });
        if (shardDiagnostics.length > 0) {
          console.log("Autosave checkpoint artifacts before startup", shardDiagnostics);
        }
      }
    } catch (error) {
      console.warn("Failed to inspect autosave checkpoint artifacts before startup:", error);
    }
  }

  ensureAutosaveResumeHasRecoverableCheckpoint() {
    if (!this.deps.recovery.isAutosaveResumeRequested()) {
      return;
    }

    const mod = this.deps.coordinator.nethackModule;
    if (!mod?.FS) {
      return;
    }

    const saveDir = this.getRuntimeCheckpointStorageDir(mod);
    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return;
    }

    const invalidCheckpointPaths = [];
    for (const lockBaseName of lockBaseNames) {
      const byteLength = this.getCheckpointLevelZeroArtifactSizeBytes(
        mod,
        saveDir,
        lockBaseName,
      );
      if (isRecoverableCheckpointLevelZeroByteLength(byteLength)) {
        return;
      }
      if (byteLength !== null) {
        invalidCheckpointPaths.push(
          `${this.joinRuntimeFsPath(saveDir, `${lockBaseName}.0`)} (${byteLength} bytes)`,
        );
      }
    }

    const playerName =
      this.deps.startupOptions.normalizeCharacterNameValue(this.deps.coordinator.startupOptions?.characterCreation?.name) ||
      "selected autosave";
    if (invalidCheckpointPaths.length > 0) {
      throw new Error(
        `Autosave "${playerName}" has only lock-file checkpoint data (${invalidCheckpointPaths.join(", ")}). NetHack has not written a recoverable checkpoint yet.`,
      );
    }
    throw new Error(
      `Autosave "${playerName}" does not have a recoverable checkpoint file yet.`,
    );
  }

  removeStaleRecoverableSaveArtifactsBeforeAutosaveResume(mod, saveDir) {
    if (!mod?.FS || !this.deps.recovery.isAutosaveResumeRequested()) {
      return 0;
    }
    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return 0;
    }

    let preparedCount = 0;
    for (const lockBaseName of lockBaseNames) {
      for (const artifactName of this.getRecoverableSaveArtifactNames(
        lockBaseName,
      )) {
        const artifactPath = this.joinRuntimeFsPath(saveDir, artifactName);
        let exists = false;
        try {
          exists = Boolean(mod.FS.analyzePath(artifactPath)?.exists);
        } catch {
          exists = false;
        }
        if (!exists) {
          continue;
        }

        let artifactSize = null;
        try {
          if (typeof mod.FS.stat === "function") {
            const statResult = mod.FS.stat(artifactPath);
            if (
              statResult &&
              typeof statResult.size === "number" &&
              Number.isFinite(statResult.size)
            ) {
              artifactSize = Math.trunc(statResult.size);
            }
          }
        } catch (error) {
          console.warn(`Failed to stat recoverable save artifact ${artifactPath}:`, error);
        }

        try {
          // NetHack's SELF_RECOVER path treats a too-short "<lock>.0" as a
          // potentially interrupted prior recover attempt. If a stale regular
          // save file still exists, recover_savefile() returns success and
          // restore_saved_game() will try to load that artifact instead of
          // rebuilding it from the checkpoint shards.
          mod.FS.unlink(artifactPath);
          preparedCount += 1;
          console.log(
            `Removed stale recoverable save artifact for autosave resume: ${artifactPath}${artifactSize !== null ? ` (${artifactSize} bytes)` : ""
            }`,
          );
        } catch (error) {
          console.warn(
            `Failed to remove stale recoverable save artifact ${artifactPath} before autosave resume:`,
            error,
          );
        }
      }
    }

    return preparedCount;
  }
}
