import { describe, expect, it } from "vitest";

import {
  createDefaultStartupInitOptionValues,
  getAutomaticRuntimeInitOptionTokens,
  getStartupInitOptionDefinitions,
  normalizeStartupInitOptionValues,
  sanitizeStartupInitOptionTokens,
  serializeStartupInitOptionTokens,
} from "./startup-init-options";

describe("terminal-friendly startup defaults", () => {
  it.each(["3.6.7", "5.0", "slashem"] as const)(
    "enables NetHack color output for %s",
    (runtimeVersion) => {
      expect(getAutomaticRuntimeInitOptionTokens(runtimeVersion)).toContain(
        "color",
      );
    },
  );

  it("selects IBMgraphics by default for supported runtimes", () => {
    const defaults = createDefaultStartupInitOptionValues();

    expect(defaults.symset).toBe("IBMgraphics");
    expect(serializeStartupInitOptionTokens(defaults, "3.6.7")).toContain(
      "symset:IBMgraphics",
    );
    expect(serializeStartupInitOptionTokens(defaults, "5.0")).toContain(
      "symset:IBMgraphics",
    );
  });

  it("offers legacy Slash'EM terminal symbol sets", () => {
    const defaults = createDefaultStartupInitOptionValues();

    expect(
      getStartupInitOptionDefinitions("slashem").some(
        (definition) => definition.key === "symset",
      ),
    ).toBe(true);
    expect(serializeStartupInitOptionTokens(defaults, "slashem")).toContain(
      "IBMgraphics",
    );
    expect(serializeStartupInitOptionTokens(defaults, "slashem")).not.toContain(
      "symset:IBMgraphics",
    );
  });

  it("serializes and sanitizes the Slash'EM DEC graphics option", () => {
    const defaults = createDefaultStartupInitOptionValues();
    const values = { ...defaults, symset: "DECgraphics" };

    expect(serializeStartupInitOptionTokens(values, "slashem")).toContain(
      "DECgraphics",
    );
    expect(
      sanitizeStartupInitOptionTokens(
        ["IBMgraphics", "DECgraphics"],
        "slashem",
      ),
    ).toEqual(["DECgraphics"]);
  });

  it("offers the NetHack 5 tutorial toggle without exposing it to older runtimes", () => {
    const defaults = createDefaultStartupInitOptionValues();

    expect(
      getStartupInitOptionDefinitions("5.0").some(
        (definition) => definition.key === "tutorial",
      ),
    ).toBe(true);
    expect(
      getStartupInitOptionDefinitions("3.6.7").some(
        (definition) => definition.key === "tutorial",
      ),
    ).toBe(false);
    expect(
      getStartupInitOptionDefinitions("slashem").some(
        (definition) => definition.key === "tutorial",
      ),
    ).toBe(false);
    expect(defaults.tutorial).toBe(false);
    expect(serializeStartupInitOptionTokens(defaults, "5.0")).toContain(
      "!tutorial",
    );
    const offeredTutorialTokens = serializeStartupInitOptionTokens(
      { ...defaults, tutorial: true },
      "5.0",
    );
    expect(offeredTutorialTokens).not.toContain("tutorial");
    expect(offeredTutorialTokens).not.toContain("!tutorial");
    expect(
      serializeStartupInitOptionTokens(
        { ...defaults, tutorial: false },
        "3.6.7",
      ),
    ).not.toContain("!tutorial");
    expect(sanitizeStartupInitOptionTokens(["!tutorial"], "5.0")).toEqual([
      "!tutorial",
    ]);
    expect(sanitizeStartupInitOptionTokens(["tutorial"], "5.0")).toEqual([]);
    expect(
      sanitizeStartupInitOptionTokens(["!tutorial"], "3.6.7"),
    ).toEqual([]);
    expect(
      sanitizeStartupInitOptionTokens(["!tutorial"], "slashem"),
    ).toEqual([]);
  });
});

describe("NetHack 5 pauper startup mode", () => {
  it("offers a disabled-by-default switch through the startup option definitions", () => {
    expect(getStartupInitOptionDefinitions("5.0").find(option => option.key === "pauper"))
      .toMatchObject({ control: "boolean", defaultValue: false });
    const defaults = createDefaultStartupInitOptionValues();
    expect(defaults.pauper).toBe(false);
    expect(serializeStartupInitOptionTokens(defaults, "5.0")).toContain("!pauper");
  });

  it("preserves the saved toggle through normalization and the runtime token sanitizer", () => {
    const saved = JSON.parse(JSON.stringify({
      ...createDefaultStartupInitOptionValues(),
      pauper: true,
    }));
    const restored = normalizeStartupInitOptionValues(saved);
    const runtimeTokens = sanitizeStartupInitOptionTokens(
      serializeStartupInitOptionTokens(restored, "5.0"),
      "5.0",
    );
    expect(restored.pauper).toBe(true);
    expect(runtimeTokens).toContain("pauper");
    expect(runtimeTokens).not.toContain("!pauper");
    expect(normalizeStartupInitOptionValues({}).pauper).toBe(false);
    expect(normalizeStartupInitOptionValues({ pauper: "true" }).pauper).toBe(false);
  });

  it.each(["3.6.7", "slashem"] as const)("never offers or sends pauper to %s", runtimeVersion => {
    expect(getStartupInitOptionDefinitions(runtimeVersion).some(option => option.key === "pauper"))
      .toBe(false);
    const tokens = serializeStartupInitOptionTokens({
      ...createDefaultStartupInitOptionValues(),
      pauper: true,
    }, runtimeVersion);
    expect(tokens).not.toContain("pauper");
    expect(tokens).not.toContain("!pauper");
    expect(sanitizeStartupInitOptionTokens(["pauper", "!pauper"], runtimeVersion)).toEqual([]);
  });
});
