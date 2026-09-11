// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import {
  hasRuntimeCheckpointRecoveryPrimitiveExport,
  supportsRuntimeCheckpointRecovery,
} from "../../runtime-capabilities";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeStartupConfiguration } from "../startup/startup-configuration";
import type { RuntimeCheckpoints } from "./checkpoint-files";

export interface RuntimeCheckpointRecoveryDependencies {
  readonly checkpoints: Pick<
    RuntimeCheckpoints,
    "ensureAutosaveResumeHasRecoverableCheckpoint"
    | "logAutosaveCheckpointArtifactsBeforeStartup"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "nethackInstance"
    | "runtimeVersion"
    | "startupOptions"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "normalizeQuestionText"
  >;
  readonly startupOptions: Pick<
    RuntimeStartupConfiguration,
    "buildStartupInitRuntimeOptions"
    | "normalizeCharacterNameValue"
  >;
}

/** Checkpoint recovery capability detection, resume binding and startup requests. */
export class RuntimeCheckpointRecovery {
  declare checkpointRecoverySupported: boolean;
  declare resumeCheckpointSave: any;
  declare didAutoQueueRawRecoverChoice: boolean;

  constructor(private readonly deps: RuntimeCheckpointRecoveryDependencies) {
    this.didAutoQueueRawRecoverChoice = false;
    this.checkpointRecoverySupported = false;
    this.resumeCheckpointSave = null;
  }

  isDestroyOldGameQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      (normalized.includes(
        "there is already a game in progress under your name",
      ) ||
        normalized.includes(
          "there are files from a game in progress under your name",
        )) &&
      normalized.includes("destroy old game")
    );
  }

  shouldAutoConfirmCheckpointCleanup(question) {
    if (this.deps.coordinator.startupOptions?.characterCreation?.mode === "resume") {
      return false;
    }
    if (!this.deps.startupOptions.buildStartupInitRuntimeOptions().includes("checkpoint")) {
      return false;
    }
    return this.isDestroyOldGameQuestion(question);
  }

  isRecoverInterruptedGameQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      (normalized.includes(
        "there is already a game in progress under your name",
      ) ||
        normalized.includes(
          "there are files from a game in progress under your name",
        ) ||
        // NetHack 5.0's SELF_RECOVER prompt is shorter:
        // "Old game in progress. Destroy [y], Recover [r], or Cancel [n]?"
        normalized.includes("old game in progress")) &&
      normalized.includes("recover")
    );
  }

  shouldAutoRecoverCheckpointResume(question) {
    const characterCreation = this.deps.coordinator.startupOptions?.characterCreation;
    if (
      !characterCreation ||
      characterCreation.mode !== "resume" ||
      characterCreation.resumeCategory !== "autosave"
    ) {
      return false;
    }
    return this.isRecoverInterruptedGameQuestion(question);
  }

  isAutosaveResumeRequested() {
    const characterCreation = this.deps.coordinator.startupOptions?.characterCreation;
    return (
      characterCreation?.mode === "resume" &&
      characterCreation?.resumeCategory === "autosave"
    );
  }

  buildCheckpointAutosaveResumeUnsupportedReason(
    runtimeVersion = this.deps.coordinator.runtimeVersion,
  ) {
    if (hasRuntimeCheckpointRecoveryPrimitiveExport(runtimeVersion)) {
      return "Checkpoint autosave resume is disabled for this wasm build. It exports recover_savefile(), but it does not expose a working browser-side resume_checkpoint_save bridge needed before unixunix.c/getlock().";
    }
    return "Checkpoint autosave resume is unavailable for this wasm build.";
  }

  updateCheckpointRecoverySupport() {
    this.checkpointRecoverySupported = false;
    this.resumeCheckpointSave = null;

    const buildHintSupportsBridge = supportsRuntimeCheckpointRecovery(
      this.deps.coordinator.runtimeVersion,
    );
    if (!buildHintSupportsBridge) {
      console.log(
        `Checkpoint recovery support unavailable for runtime ${this.deps.coordinator.runtimeVersion}`,
      );
      return;
    }

    if (
      !this.deps.coordinator.nethackInstance ||
      typeof this.deps.coordinator.nethackInstance.cwrap !== "function"
    ) {
      return;
    }

    try {
      let wrappedResumeCheckpointSave = null;
      if (typeof this.deps.coordinator.nethackInstance.cwrap === "function") {
        try {
          wrappedResumeCheckpointSave = this.deps.coordinator.nethackInstance.cwrap(
            "resume_checkpoint_save",
            "number",
            ["string"],
          );
        } catch (error) {
          console.warn(
            "Failed to bind cwrap resume_checkpoint_save bridge from NetHack runtime:",
            error,
          );
        }
      }

      if (typeof wrappedResumeCheckpointSave === "function") {
        this.resumeCheckpointSave = (playerName) => {
          const normalizedName = this.deps.startupOptions.normalizeCharacterNameValue(playerName);
          if (!normalizedName) {
            return 0;
          }
          return Number(wrappedResumeCheckpointSave(normalizedName));
        };
      }

      const directResumeCheckpointSave =
        typeof this.deps.coordinator.nethackInstance._resume_checkpoint_save === "function"
          ? this.deps.coordinator.nethackInstance._resume_checkpoint_save
          : null;
      const malloc =
        typeof this.deps.coordinator.nethackInstance._malloc === "function"
          ? this.deps.coordinator.nethackInstance._malloc
          : null;
      const free =
        typeof this.deps.coordinator.nethackInstance._free === "function"
          ? this.deps.coordinator.nethackInstance._free
          : null;
      const stringToUtf8 =
        typeof this.deps.coordinator.nethackInstance.stringToUTF8 === "function"
          ? this.deps.coordinator.nethackInstance.stringToUTF8
          : null;

      if (
        !this.resumeCheckpointSave &&
        directResumeCheckpointSave &&
        malloc &&
        free &&
        stringToUtf8
      ) {
        this.resumeCheckpointSave = (playerName) => {
          const normalizedName = this.deps.startupOptions.normalizeCharacterNameValue(playerName);
          if (!normalizedName) {
            return 0;
          }
          const bufferSize = normalizedName.length * 4 + 1;
          const playerNamePtr = malloc(bufferSize);
          try {
            stringToUtf8(normalizedName, playerNamePtr, bufferSize);
            return Number(directResumeCheckpointSave(playerNamePtr));
          } finally {
            free(playerNamePtr);
          }
        };
      }

      this.checkpointRecoverySupported =
        typeof this.resumeCheckpointSave === "function";
      console.log(
        `Checkpoint recovery support ${this.checkpointRecoverySupported ? "enabled" : "unavailable"
        } for runtime ${this.deps.coordinator.runtimeVersion}`,
      );
      if (!this.checkpointRecoverySupported) {
        if (buildHintSupportsBridge) {
          console.warn(
            `Checkpoint recovery build hint was enabled for runtime ${this.deps.coordinator.runtimeVersion}, but the instantiated module could not bind resume_checkpoint_save. Treating recovery as unavailable.`,
          );
        } else if (
          hasRuntimeCheckpointRecoveryPrimitiveExport(this.deps.coordinator.runtimeVersion)
        ) {
          console.log(
            `Checkpoint recovery primitive detected for runtime ${this.deps.coordinator.runtimeVersion}, but the instantiated module still lacks a working browser-side resume bridge.`,
          );
        }
      }
    } catch (error) {
      console.warn(
        "Failed to bind direct resume_checkpoint_save bridge from NetHack runtime:",
        error,
      );
    }
  }

  queueCheckpointAutosaveResumeBeforeStartup() {
    if (!this.isAutosaveResumeRequested()) {
      return;
    }

    this.deps.checkpoints.logAutosaveCheckpointArtifactsBeforeStartup();
    this.deps.checkpoints.ensureAutosaveResumeHasRecoverableCheckpoint();

    if (this.deps.coordinator.runtimeVersion === "5.0") {
      // NetHack 5.0's SELF_RECOVER path is wired through getlock().
      // Calling resume_checkpoint_save() directly before startup has proven
      // unstable in this build (function signature mismatch + partial side
      // effects), so defer to getlock() and auto-answer "r".
      console.log(
        "Deferring checkpoint autosave resume to getlock() prompt flow for runtime 5.0",
      );
      return;
    }

    if (
      !this.checkpointRecoverySupported ||
      typeof this.resumeCheckpointSave !== "function"
    ) {
      throw new Error(this.buildCheckpointAutosaveResumeUnsupportedReason());
    }

    const playerName = this.deps.startupOptions.normalizeCharacterNameValue(
      this.deps.coordinator.startupOptions?.characterCreation?.name,
    );
    if (!playerName) {
      throw new Error(
        "Checkpoint autosave resume requires a character name to identify the save.",
      );
    }

    let didRecover = 0;
    try {
      didRecover = Number(this.resumeCheckpointSave(playerName));
    } catch (error) {
      const errorText =
        error instanceof Error && error.message
          ? error.message
          : String(error ?? "");
      // Some builds can still recover through getlock()'s SELF_RECOVER prompt
      // even when direct pre-main bridge invocation fails.
      if (
        /function signature mismatch/i.test(errorText) ||
        /runtimeerror/i.test(errorText)
      ) {
        console.warn(
          `Direct checkpoint resume bridge failed before startup (${errorText}). Falling back to getlock() recovery prompt.`,
          error,
        );
        return;
      }
      throw error;
    }
    if (didRecover !== 1) {
      throw new Error(
        `Failed to queue checkpoint autosave resume for "${playerName}" before startup.`,
      );
    }

    console.log(
      `Queued checkpoint autosave resume for "${playerName}" before NetHack startup`,
    );
  }
}
