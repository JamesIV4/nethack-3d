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

  it("preserves an embedded symbols file", () => {
    const writeFile = vi.fn();
    const result = ensureBundledTerminalSymbolSetsFile(
      {
        FS: {
          analyzePath: () => ({ exists: true }),
          writeFile,
        },
      },
      "5.0",
    );

    expect(result).toBe("present");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("does not install NetHack symbol sets into Slash'EM", () => {
    const writeFile = vi.fn();
    const result = ensureBundledTerminalSymbolSetsFile(
      {
        FS: {
          analyzePath: () => ({ exists: false }),
          writeFile,
        },
      },
      "slashem",
    );

    expect(result).toBe("unsupported");
    expect(writeFile).not.toHaveBeenCalled();
  });
});
