import { describe, expect, it, vi } from "vitest";
import {
  bundledTerminalSymbolSets,
  ensureBundledTerminalSymbolSetsFile,
} from "./nethack-symbols";

describe("ensureBundledTerminalSymbolSetsFile", () => {
  it("installs the IBM and DEC definitions when the WASM file is missing", () => {
    const writeFile = vi.fn();
    const result = ensureBundledTerminalSymbolSetsFile(
      {
        FS: {
          analyzePath: () => ({ exists: false }),
          writeFile,
        },
      },
      "3.6.7",
    );

    expect(result).toBe("created");
    expect(writeFile).toHaveBeenCalledWith("/symbols", bundledTerminalSymbolSets);
    expect(bundledTerminalSymbolSets).toContain("start: IBMgraphics");
    expect(bundledTerminalSymbolSets).toContain("S_vwall: \\xb3");
    expect(bundledTerminalSymbolSets).toContain("start: DECgraphics");
    expect(bundledTerminalSymbolSets).toContain("S_vwall: \\xf8");
  });

  it("preserves an existing NetHack 3.6.7 symbols file", () => {
    const writeFile = vi.fn();
    const result = ensureBundledTerminalSymbolSetsFile(
      {
        FS: {
          analyzePath: () => ({ exists: true }),
          writeFile,
        },
      },
      "3.6.7",
    );

    expect(result).toBe("present");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("leaves NetHack 5.0's late-initialized embedded symbols file alone", () => {
    const analyzePath = vi.fn(() => ({ exists: false }));
    const writeFile = vi.fn();
    const result = ensureBundledTerminalSymbolSetsFile(
      {
        FS: {
          analyzePath,
          writeFile,
        },
      },
      "5.0",
    );

    expect(result).toBe("embedded");
    expect(analyzePath).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("uses Slash'EM's built-in legacy IBM and DEC graphics options", () => {
    const analyzePath = vi.fn(() => ({ exists: false }));
    const writeFile = vi.fn();
    const result = ensureBundledTerminalSymbolSetsFile(
      {
        FS: {
          analyzePath,
          writeFile,
        },
      },
      "slashem",
    );

    expect(result).toBe("legacy-builtin");
    expect(analyzePath).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
