import { describe, expect, it } from "vitest";

import {
  createDefaultStartupInitOptionValues,
  getAutomaticRuntimeInitOptionTokens,
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

  it("does not send the unsupported symset option to Slash'EM", () => {
    const defaults = createDefaultStartupInitOptionValues();

    expect(serializeStartupInitOptionTokens(defaults, "slashem")).not.toContain(
      "symset:IBMgraphics",
    );
  });
});
