import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  sanitizeStartupInitOptionTokens
} from "../../../runtime/startup-init-options";
import {
  getRuntimeSavePresentationMetadataKey,
  normalizeSavePresentationRuntimeVersion,
  normalizeStoredSaveInitOptions
} from "../../../runtime/save-presentation-metadata";
import {
  normalizeStartupCharacterName
} from "./character-preferences";

/** Persisted save display metadata and play-mode labels. */
export type SavePresentationMetadataEntry = {
  characterName: string;
  playMode: "normal" | "explore" | "debug" | null;
  initOptions?: string[];
  runtimeVersion?: NethackRuntimeVersion;
  updatedAt: string;
};

export const savePresentationMetadataStorageKey = "nh3d-save-presentation-v1";

export function readSavePresentationMetadataByKey(): Record<
  string,
  SavePresentationMetadataEntry
> {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(savePresentationMetadataStorageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const normalized: Record<string, SavePresentationMetadataEntry> = {};
    for (const [rawKey, rawValue] of Object.entries(parsed)) {
      if (!rawKey || typeof rawKey !== "string") {
        continue;
      }
      if (!rawValue || typeof rawValue !== "object") {
        continue;
      }
      const candidate = rawValue as Partial<SavePresentationMetadataEntry>;
      const characterName = normalizeStartupCharacterName(
        String(candidate.characterName || ""),
      );
      const playMode =
        candidate.playMode === "debug" ||
          candidate.playMode === "explore" ||
          candidate.playMode === "normal"
          ? candidate.playMode
          : null;
      const runtimeVersion = normalizeSavePresentationRuntimeVersion(
        candidate.runtimeVersion,
      );
      normalized[rawKey] = {
        characterName,
        playMode,
        initOptions: normalizeStoredSaveInitOptions(
          candidate.initOptions,
          runtimeVersion,
        ),
        runtimeVersion,
        updatedAt:
          typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
            ? candidate.updatedAt
            : "",
      };
    }
    return normalized;
  } catch {
    return {};
  }
}

export function writeSavePresentationMetadataByKey(
  metadataByKey: Record<string, SavePresentationMetadataEntry>,
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(
      savePresentationMetadataStorageKey,
      JSON.stringify(metadataByKey),
    );
  } catch (error) {
    console.warn("Failed to persist save presentation metadata:", error);
  }
}

export function resolveStartupPlayModeForSavePresentation(
  runtimeVersion: NethackRuntimeVersion | undefined,
  initOptions: string[] | undefined,
): "normal" | "explore" | "debug" | null {
  const tokens = sanitizeStartupInitOptionTokens(initOptions, runtimeVersion);
  if (tokens.includes("playmode:debug")) {
    return "debug";
  }
  if (tokens.includes("playmode:explore")) {
    return "explore";
  }
  if (tokens.includes("playmode:normal")) {
    return "normal";
  }
  return "normal";
}

export function persistSavePresentationMetadataForCharacter(
  runtimeName: string,
  characterName: string,
  runtimeVersion: NethackRuntimeVersion,
  initOptions: string[] | undefined,
): void {
  const normalizedRuntimeName = normalizeStartupCharacterName(runtimeName);
  const normalizedCharacterName = normalizeStartupCharacterName(characterName);
  if (!normalizedRuntimeName || !normalizedCharacterName) {
    return;
  }

  const metadataByKey = readSavePresentationMetadataByKey();
  const playMode = resolveStartupPlayModeForSavePresentation(
    runtimeVersion,
    initOptions,
  );
  const sanitizedInitOptions = sanitizeStartupInitOptionTokens(
    initOptions,
    runtimeVersion,
  );
  const updatedAt = new Date().toISOString();
  const categories: Array<"manual" | "autosave"> = ["manual", "autosave"];
  for (const category of categories) {
    const metadataKey = getRuntimeSavePresentationMetadataKey(
      runtimeVersion,
      category,
      normalizedRuntimeName,
    );
    metadataByKey[metadataKey] = {
      characterName: normalizedCharacterName,
      playMode,
      initOptions: sanitizedInitOptions,
      runtimeVersion,
      updatedAt,
    };
  }
  writeSavePresentationMetadataByKey(metadataByKey);
}

export function resolveSavePlayModeChipLabel(
  playMode: "normal" | "explore" | "debug" | null,
): string | null {
  if (playMode === "debug") {
    return "Wizard/Debug";
  }
  if (playMode === "explore") {
    return "Explore";
  }
  return null;
}
