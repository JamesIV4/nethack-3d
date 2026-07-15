import { describe, expect, it } from "vitest";
import {
  buildTerminalCellTextureKey,
  defaultTerminalRenderOptionStates,
  getTerminalColorHex,
  mapCp437ByteToDisplayChar,
  mapDecGraphicsByteToDisplayChar,
  mapTerminalDisplayChar,
  resolveTerminalCellPresentation,
  resolveTerminalRenderOptionStates,
  resolveTerminalSymsetHintFromName,
  splitNetHackOptionsString,
  TERMINAL_BACKGROUND_HEX,
  TERMINAL_DEFAULT_FG_HEX,
  TERMINAL_MG_FLAGS,
} from "./terminal-display";

describe("getTerminalColorHex", () => {
  it("maps the classic NetHack color indexes", () => {
    expect(getTerminalColorHex(1)).toBe("#aa0000");
    expect(getTerminalColorHex(7)).toBe("#aaaaaa");
    expect(getTerminalColorHex(11)).toBe("#ffff55");
    expect(getTerminalColorHex(15)).toBe("#ffffff");
  });

  it("renders black glyphs as a visible dark gray", () => {
    expect(getTerminalColorHex(0)).toBe("#555555");
  });

  it("uses the default foreground for NO_COLOR and invalid values", () => {
    expect(getTerminalColorHex(8)).toBe(TERMINAL_DEFAULT_FG_HEX);
    expect(getTerminalColorHex(null)).toBe(TERMINAL_DEFAULT_FG_HEX);
    expect(getTerminalColorHex(undefined)).toBe(TERMINAL_DEFAULT_FG_HEX);
    expect(getTerminalColorHex(99)).toBe(TERMINAL_DEFAULT_FG_HEX);
  });
});

describe("CP437 and DEC graphics mapping", () => {
  it("maps IBMgraphics line-drawing bytes through CP437", () => {
    expect(mapCp437ByteToDisplayChar(0xb3)).toBe("│");
    expect(mapCp437ByteToDisplayChar(0xc4)).toBe("─");
    expect(mapCp437ByteToDisplayChar(0xda)).toBe("┌");
    expect(mapCp437ByteToDisplayChar(0xbf)).toBe("┐");
    expect(mapCp437ByteToDisplayChar(0xb1)).toBe("▒");
    expect(mapCp437ByteToDisplayChar(0xfa)).toBe("·");
  });

  it("keeps printable ASCII unchanged", () => {
    expect(mapCp437ByteToDisplayChar(0x40)).toBe("@");
    expect(mapCp437ByteToDisplayChar(0x64)).toBe("d");
  });

  it("maps DEC special graphics codes", () => {
    expect(mapDecGraphicsByteToDisplayChar(0x80 | 0x71)).toBe("─");
    expect(mapDecGraphicsByteToDisplayChar(0x80 | 0x78)).toBe("│");
    expect(mapDecGraphicsByteToDisplayChar(0x80 | 0x6c)).toBe("┌");
    expect(mapDecGraphicsByteToDisplayChar(0x80 | 0x7e)).toBe("·");
  });

  it("routes high-bit chars by symset hint", () => {
    const ibmChar = String.fromCharCode(0xb3);
    expect(mapTerminalDisplayChar(ibmChar, "ibm")).toBe("│");
    expect(mapTerminalDisplayChar(ibmChar, null)).toBe("│");
    const decHorizontal = String.fromCharCode(0x80 | 0x71);
    expect(mapTerminalDisplayChar(decHorizontal, "dec")).toBe("─");
    expect(mapTerminalDisplayChar("@", "dec")).toBe("@");
    expect(mapTerminalDisplayChar("", null)).toBe(" ");
    expect(mapTerminalDisplayChar(null, null)).toBe(" ");
  });
});

describe("splitNetHackOptionsString", () => {
  it("splits comma separated NETHACKOPTIONS text", () => {
    expect(
      splitNetHackOptionsString("hilite_pet, !autopickup ,symset:IBMgraphics"),
    ).toEqual(["hilite_pet", "!autopickup", "symset:IBMgraphics"]);
  });

  it("returns an empty list for blank or non-string input", () => {
    expect(splitNetHackOptionsString("")).toEqual([]);
    expect(splitNetHackOptionsString("   ")).toEqual([]);
    expect(splitNetHackOptionsString(undefined)).toEqual([]);
  });
});

describe("resolveTerminalSymsetHintFromName", () => {
  it("recognizes IBM and DEC symbol sets", () => {
    expect(resolveTerminalSymsetHintFromName("IBMgraphics")).toBe("ibm");
    expect(resolveTerminalSymsetHintFromName("IBMgraphics_2")).toBe("ibm");
    expect(resolveTerminalSymsetHintFromName("DECgraphics")).toBe("dec");
    expect(resolveTerminalSymsetHintFromName("plain")).toBeNull();
    expect(resolveTerminalSymsetHintFromName("")).toBeNull();
  });
});

describe("resolveTerminalRenderOptionStates", () => {
  it("uses NetHack defaults when no tokens are present", () => {
    const states = resolveTerminalRenderOptionStates([]);
    expect(states).toEqual(defaultTerminalRenderOptionStates);
    expect(states.hilitePet).toBe(false);
    expect(states.hilitePile).toBe(false);
    expect(states.useInverse).toBe(true);
    expect(states.symsetHint).toBeNull();
  });

  it("applies boolean and value option tokens", () => {
    const states = resolveTerminalRenderOptionStates([
      ["hilite_pet", "hilite_pile", "!use_inverse", "symset:DECgraphics"],
    ]);
    expect(states.hilitePet).toBe(true);
    expect(states.hilitePile).toBe(true);
    expect(states.useInverse).toBe(false);
    expect(states.symsetHint).toBe("dec");
  });

  it("lets later token lists win", () => {
    const states = resolveTerminalRenderOptionStates([
      ["hilite_pet", "symset:IBMgraphics"],
      ["!hilite_pet"],
    ]);
    expect(states.hilitePet).toBe(false);
    expect(states.symsetHint).toBe("ibm");
  });
});

describe("resolveTerminalCellPresentation", () => {
  const baseParams = {
    char: "d",
    color: 3,
    glyphFlags: 0,
    optionStates: { ...defaultTerminalRenderOptionStates },
  };

  it("renders plain glyphs with runtime colors on black", () => {
    const cell = resolveTerminalCellPresentation(baseParams);
    expect(cell.displayChar).toBe("d");
    expect(cell.fgHex).toBe("#aa5500");
    expect(cell.bgHex).toBe(TERMINAL_BACKGROUND_HEX);
    expect(cell.inverse).toBe(false);
  });

  it("does not highlight pets unless hilite_pet is enabled", () => {
    const cell = resolveTerminalCellPresentation({
      ...baseParams,
      glyphFlags: TERMINAL_MG_FLAGS.pet,
    });
    expect(cell.inverse).toBe(false);
  });

  it("applies reverse video for pets when hilite_pet is on", () => {
    const cell = resolveTerminalCellPresentation({
      ...baseParams,
      glyphFlags: TERMINAL_MG_FLAGS.pet,
      optionStates: {
        ...defaultTerminalRenderOptionStates,
        hilitePet: true,
      },
    });
    expect(cell.inverse).toBe(true);
    expect(cell.bgHex).toBe("#aa5500");
    expect(cell.fgHex).toBe(TERMINAL_BACKGROUND_HEX);
  });

  it("applies reverse video for object piles when hilite_pile is on", () => {
    const withoutOption = resolveTerminalCellPresentation({
      ...baseParams,
      glyphFlags: TERMINAL_MG_FLAGS.objpile,
    });
    expect(withoutOption.inverse).toBe(false);
    const withOption = resolveTerminalCellPresentation({
      ...baseParams,
      glyphFlags: TERMINAL_MG_FLAGS.objpile,
      optionStates: {
        ...defaultTerminalRenderOptionStates,
        hilitePile: true,
      },
    });
    expect(withOption.inverse).toBe(true);
  });

  it("inverts detected monsters under use_inverse", () => {
    const detected = resolveTerminalCellPresentation({
      ...baseParams,
      glyphFlags: TERMINAL_MG_FLAGS.detected,
    });
    expect(detected.inverse).toBe(true);
    const suppressed = resolveTerminalCellPresentation({
      ...baseParams,
      glyphFlags: TERMINAL_MG_FLAGS.detected,
      optionStates: {
        ...defaultTerminalRenderOptionStates,
        useInverse: false,
      },
    });
    expect(suppressed.inverse).toBe(false);
  });

  it("builds distinct texture keys per presentation", () => {
    const plain = resolveTerminalCellPresentation(baseParams);
    const inverse = resolveTerminalCellPresentation({
      ...baseParams,
      glyphFlags: TERMINAL_MG_FLAGS.detected,
    });
    expect(buildTerminalCellTextureKey(plain)).not.toBe(
      buildTerminalCellTextureKey(inverse),
    );
  });
});
