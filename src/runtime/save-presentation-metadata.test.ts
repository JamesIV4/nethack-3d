import { describe, expect, it } from "vitest";

import {
  getLegacySavePresentationMetadataKey,
  getRuntimeSavePresentationMetadataKey,
  normalizeSavePresentationRuntimeVersion,
  normalizeStoredSaveInitOptions,
  resolveSaveResumeInitOptionTokens,
  resolveSavePresentationMetadataEntry,
} from "./save-presentation-metadata";

describe("save presentation metadata", () => {
  it("preserves Slash'EM-only init options with their save", () => {
    expect(
      normalizeStoredSaveInitOptions(
        ["IBMgraphics", "number_pad:0"],
        "slashem",
      ),
    ).toEqual(["IBMgraphics", "number_pad:0"]);
  });

  it("keeps legacy raw tokens until the save runtime is known", () => {
    const legacyTokens = normalizeStoredSaveInitOptions([
      "DECgraphics",
      "number_pad:0",
    ]);

    expect(legacyTokens).toEqual(["DECgraphics", "number_pad:0"]);
    expect(normalizeStoredSaveInitOptions(legacyTokens, "slashem")).toEqual([
      "DECgraphics",
      "number_pad:0",
    ]);
  });

  it.each(["3.6.7", "5.0", "slashem"] as const)(
    "preserves both number pad modes when resuming %s",
    (runtimeVersion) => {
      expect(
        resolveSaveResumeInitOptionTokens(["number_pad:0"], runtimeVersion),
      ).toEqual(["number_pad:0"]);
      expect(
        resolveSaveResumeInitOptionTokens(["number_pad:1"], runtimeVersion),
      ).toEqual(["number_pad:1"]);
    },
  );

  it.each(["3.6.7", "5.0", "slashem"] as const)(
    "does not force number pad on when %s legacy metadata has no mode",
    (runtimeVersion) => {
      expect(resolveSaveResumeInitOptionTokens([], runtimeVersion)).toEqual([]);
    },
  );

  it("uses runtime-scoped keys without losing legacy metadata fallback", () => {
    const runtimeKey = getRuntimeSavePresentationMetadataKey(
      "slashem",
      "manual",
      "Player",
    );
    const legacyKey = getLegacySavePresentationMetadataKey(
      "manual",
      "Player",
    );
    const metadata = {
      [legacyKey]: "legacy",
      [runtimeKey]: "slashem",
    };

    expect(
      resolveSavePresentationMetadataEntry(
        metadata,
        "slashem",
        "manual",
        "Player",
      ),
    ).toBe("slashem");
    expect(
      resolveSavePresentationMetadataEntry(
        { [legacyKey]: "legacy" },
        "slashem",
        "manual",
        "Player",
      ),
    ).toBe("legacy");
  });

  it("accepts only known runtime identifiers", () => {
    expect(normalizeSavePresentationRuntimeVersion("slashem")).toBe(
      "slashem",
    );
    expect(normalizeSavePresentationRuntimeVersion("unknown")).toBeUndefined();
  });
});
