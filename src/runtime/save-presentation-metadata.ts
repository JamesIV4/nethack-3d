import { sanitizeStartupInitOptionTokens } from "./startup-init-options";
import type { NethackRuntimeVersion } from "./types";

export type SavePresentationCategory = "manual" | "autosave";

export function normalizeSavePresentationRuntimeVersion(
  rawValue: unknown,
): NethackRuntimeVersion | undefined {
  return rawValue === "3.6.7" || rawValue === "5.0" || rawValue === "slashem"
    ? rawValue
    : undefined;
}

export function normalizeStoredSaveInitOptions(
  rawInitOptions: unknown,
  runtimeVersion?: NethackRuntimeVersion,
): string[] {
  if (runtimeVersion) {
    return sanitizeStartupInitOptionTokens(rawInitOptions, runtimeVersion);
  }
  if (!Array.isArray(rawInitOptions)) {
    return [];
  }

  // Legacy metadata did not record its runtime. Preserve its raw string tokens
  // until the save list supplies the owning runtime, where they are sanitized
  // against the correct option set. Sanitizing here as generic NetHack options
  // would discard Slash'EM-only tokens such as IBMgraphics and DECgraphics.
  return rawInitOptions
    .filter((token): token is string => typeof token === "string")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function resolveSaveResumeInitOptionTokens(
  rawInitOptions: unknown,
  runtimeVersion: NethackRuntimeVersion,
): string[] {
  // Do not synthesize number_pad:1 for old saves. NetHack restores num_pad
  // from the save itself, and forcing the current default here overwrites an
  // intentionally saved vi-key mode before the restored runtime state arrives.
  return sanitizeStartupInitOptionTokens(rawInitOptions, runtimeVersion);
}

export function getRuntimeSavePresentationMetadataKey(
  runtimeVersion: NethackRuntimeVersion,
  category: SavePresentationCategory,
  runtimeName: string,
): string {
  return `${runtimeVersion}:${category}:${runtimeName}`;
}

export function getLegacySavePresentationMetadataKey(
  category: SavePresentationCategory,
  runtimeName: string,
): string {
  return `${category}:${runtimeName}`;
}

export function resolveSavePresentationMetadataEntry<T>(
  metadataByKey: Record<string, T>,
  runtimeVersion: NethackRuntimeVersion,
  category: SavePresentationCategory,
  runtimeName: string,
): T | undefined {
  return (
    metadataByKey[
      getRuntimeSavePresentationMetadataKey(
        runtimeVersion,
        category,
        runtimeName,
      )
    ] ??
    metadataByKey[getLegacySavePresentationMetadataKey(category, runtimeName)]
  );
}
