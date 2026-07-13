import { describe, expect, it } from "vitest";

import type { NethackRuntimeVersion } from "./types";
import {
  MIN_RECOVERABLE_CHECKPOINT_LEVEL_ZERO_BYTES,
  getRuntimeCheckpointMountDir,
  getRuntimeRootPersistenceDbName,
  getRuntimeSaveCompatTag,
  getRuntimeSaveDbName,
  getRuntimeSaveDbNames,
  getRuntimeSaveMountDir,
  isCheckpointLevelFilename,
  isRecoverableCheckpointLevelZeroByteLength,
  resolveRuntimeSaveDbNames,
  supportsRuntimeRootPersistence,
} from "./save-storage";

// Every runtime the app can launch. Loading (normal + autosave) must behave
// consistently for all of them.
const RUNTIMES: NethackRuntimeVersion[] = ["3.6.7", "5.0", "slashem"];

describe("save-storage: normal (manual) save loading", () => {
  it.each(RUNTIMES)(
    "%s stores manual saves on the /save mount",
    (runtimeVersion) => {
      expect(getRuntimeSaveMountDir(runtimeVersion)).toBe("/save");
    },
  );

  it.each(RUNTIMES)(
    "%s resolves the save mount relative to the runtime cwd",
    (runtimeVersion) => {
      expect(getRuntimeSaveMountDir(runtimeVersion, "/nethack")).toBe(
        "/nethack/save",
      );
      // Trailing slashes / bare root normalize to the top-level mount.
      expect(getRuntimeSaveMountDir(runtimeVersion, "/")).toBe("/save");
      expect(getRuntimeSaveMountDir(runtimeVersion, "")).toBe("/save");
    },
  );

  it.each(RUNTIMES)(
    "%s backs the /save mount with a /save-<compat> IndexedDB database",
    (runtimeVersion) => {
      const dbName = getRuntimeSaveDbName(runtimeVersion);
      expect(dbName).toBe(`/save-${getRuntimeSaveCompatTag(runtimeVersion)}`);
      expect(dbName.startsWith("/save-")).toBe(true);
    },
  );

  it("keeps each runtime's manual saves in a distinct database", () => {
    const dbNames = RUNTIMES.map((rv) => getRuntimeSaveDbName(rv));
    expect(new Set(dbNames).size).toBe(RUNTIMES.length);
  });

  it.each(RUNTIMES)(
    "%s enumerates save databases across known playground roots",
    (runtimeVersion) => {
      const names = getRuntimeSaveDbNames(runtimeVersion);
      const tag = getRuntimeSaveCompatTag(runtimeVersion);
      expect(names).toContain(`/save-${tag}`);
      expect(names).toContain(`/nethack/save-${tag}`);
    },
  );
});

describe("save-storage: autosave (checkpoint) loading", () => {
  // Regression: when 5.0/SlashEm gained root persistence, checkpoint storage
  // was moved from the /save mount to "/", stranding autosaves. Checkpoints
  // must resolve to the /save mount for EVERY runtime, root persistence or not.
  it.each(RUNTIMES)(
    "%s stores autosave checkpoints on the /save mount, never at root",
    (runtimeVersion) => {
      const checkpointDir = getRuntimeCheckpointMountDir(runtimeVersion);
      expect(checkpointDir).toBe("/save");
      expect(checkpointDir).not.toBe("/");
    },
  );

  it.each(RUNTIMES)(
    "%s checkpoint mount matches the manual save mount (shared /save path)",
    (runtimeVersion) => {
      expect(getRuntimeCheckpointMountDir(runtimeVersion)).toBe(
        getRuntimeSaveMountDir(runtimeVersion),
      );
    },
  );

  it.each(RUNTIMES)(
    "%s checkpoint mount honors the runtime cwd",
    (runtimeVersion) => {
      expect(getRuntimeCheckpointMountDir(runtimeVersion, "/nethack")).toBe(
        "/nethack/save",
      );
    },
  );
});

describe("save-storage: root persistence stays decoupled from checkpoints", () => {
  // Root persistence must remain enabled so top-scores/record/xlogfile/bones
  // survive reloads, but it must NOT be the home of checkpoint shards.
  it.each(RUNTIMES)("%s enables root persistence", (runtimeVersion) => {
    expect(supportsRuntimeRootPersistence(runtimeVersion)).toBe(true);
  });

  it.each(RUNTIMES)(
    "%s keeps the root-persistence database separate from the save database",
    (runtimeVersion) => {
      const rootDb = getRuntimeRootPersistenceDbName(runtimeVersion);
      const saveDb = getRuntimeSaveDbName(runtimeVersion);
      expect(rootDb).toBe(`/root-${getRuntimeSaveCompatTag(runtimeVersion)}`);
      expect(rootDb).not.toBe(saveDb);
    },
  );

  it.each(RUNTIMES)(
    "%s exposes both the save and root databases for top-score reads",
    async (runtimeVersion) => {
      // In the Node test env indexedDB is undefined, so this resolves to the
      // static set (save DBs + root persistence DB) without enumeration.
      const names = await resolveRuntimeSaveDbNames(runtimeVersion);
      expect(names).toContain(getRuntimeSaveDbName(runtimeVersion));
      expect(names).toContain(getRuntimeRootPersistenceDbName(runtimeVersion));
    },
  );
});

describe("save-storage: checkpoint level-file classification", () => {
  it("recognizes NetHack checkpoint/level shards", () => {
    for (const name of ["0Web_user.0", "0Web_user.1", "0Web_user.15", "awizard.0"]) {
      expect(isCheckpointLevelFilename(name)).toBe(true);
    }
  });

  it("does not treat root-persistence game data as a checkpoint shard", () => {
    for (const name of [
      "record",
      "xlogfile",
      "logfile",
      "sysconf",
      "nhdat",
      "0Web_user", // lock base name, no numeric level suffix
      "bonM0.T", // special-level bones use a letter suffix -> root persistence
    ]) {
      expect(isCheckpointLevelFilename(name)).toBe(false);
    }
  });

  it("only classifies bare filenames, never paths", () => {
    expect(isCheckpointLevelFilename("/0Web_user.0")).toBe(false);
    expect(isCheckpointLevelFilename("save/0Web_user.0")).toBe(false);
    expect(isCheckpointLevelFilename("")).toBe(false);
    expect(isCheckpointLevelFilename(null)).toBe(false);
    expect(isCheckpointLevelFilename(undefined)).toBe(false);
  });
});

describe("save-storage: recoverable checkpoint detection", () => {
  it("requires at least the minimum level-zero byte length", () => {
    expect(
      isRecoverableCheckpointLevelZeroByteLength(
        MIN_RECOVERABLE_CHECKPOINT_LEVEL_ZERO_BYTES,
      ),
    ).toBe(true);
    expect(
      isRecoverableCheckpointLevelZeroByteLength(
        MIN_RECOVERABLE_CHECKPOINT_LEVEL_ZERO_BYTES + 1,
      ),
    ).toBe(true);
  });

  it("rejects bare lock files and missing/invalid sizes", () => {
    expect(
      isRecoverableCheckpointLevelZeroByteLength(
        MIN_RECOVERABLE_CHECKPOINT_LEVEL_ZERO_BYTES - 1,
      ),
    ).toBe(false);
    expect(isRecoverableCheckpointLevelZeroByteLength(0)).toBe(false);
    expect(isRecoverableCheckpointLevelZeroByteLength(null)).toBe(false);
    expect(isRecoverableCheckpointLevelZeroByteLength(undefined)).toBe(false);
    expect(isRecoverableCheckpointLevelZeroByteLength(Number.NaN)).toBe(false);
    expect(isRecoverableCheckpointLevelZeroByteLength(-10)).toBe(false);
  });
});
