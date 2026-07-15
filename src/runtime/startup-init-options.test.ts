import { describe, expect, it } from "vitest";

import {
  createDefaultStartupInitOptionValues,
  getAutomaticRuntimeInitOptionTokens,
  getStartupInitOptionDefinitions,
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
});
