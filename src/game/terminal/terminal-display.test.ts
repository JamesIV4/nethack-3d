import { describe, expect, it } from "vitest";
import {
  buildTerminalCellTextureKey,
  defaultTerminalRenderOptionStates,
  getTerminalBoxDrawingConnections,
  getTerminalColorHex,
  isTerminalVoidGridTargetAdjacentToPlayer,
  mapCp437ByteToDisplayChar,
  mapDecGraphicsByteToDisplayChar,
  mapSlashEmCmapCharForTerminal,
  mapTerminalDisplayChar,
  replaceNetHackLookDescriptionSymbol,
  resolveTerminalCellPresentation,
  resolveTerminalPhysicalCellWidth,
  resolveTerminalRenderOptionStates,
  resolveTerminalWallStrokeWidth,
  resolveTerminalSymsetHintFromName,
  shouldShowTerminalGutterMinimap,
  splitNetHackOptionsString,
  snapTerminalCameraCenterToPixelGrid,
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

  it("replaces the encoded symbol field in NetHack look descriptions", () => {
    expect(
      replaceNetHackLookDescriptionSymbol(
        `${String.fromCharCode(0xb3)}       a wall`,
        "\u2502",
      ),
    ).toBe("\u2502       a wall");
    expect(
      replaceNetHackLookDescriptionSymbol("\ufffd       a corridor", "\u2500"),
    ).toBe("\u2500       a corridor");
    expect(
      replaceNetHackLookDescriptionSymbol("The jackal bites!", "\u2502"),
    ).toBe("The jackal bites!");
  });
});

describe("connected terminal cell rendering", () => {
  it("describes every IBM/DEC single-line wall connection", () => {
    expect(getTerminalBoxDrawingConnections("\u2500")).toEqual({
      left: true,
      right: true,
      up: false,
      down: false,
    });
    expect(getTerminalBoxDrawingConnections("\u2502")).toEqual({
      left: false,
      right: false,
      up: true,
      down: true,
    });
    expect(getTerminalBoxDrawingConnections("\u250c")).toEqual({
      left: false,
      right: true,
      up: false,
      down: true,
    });
    expect(getTerminalBoxDrawingConnections("\u253c")).toEqual({
      left: true,
      right: true,
      up: true,
      down: true,
    });
    expect(getTerminalBoxDrawingConnections("@")).toBeNull();
  });

  it("uses a whole number of physical pixels without exceeding fit", () => {
    expect(
      resolveTerminalPhysicalCellWidth({
        drawingBufferWidth: 1919,
        drawingBufferHeight: 1079,
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        cellAspect: 2,
        zoomFactor: 1,
        pixelRatio: 1.25,
        minCellCssPx: 14,
        zoomOutMinCellCssPx: 2,
        maxCellCssPx: 96,
        containWholeLevel: true,
      }),
    ).toBe(23);
  });

  it("uses one uniform integer wall thickness per snapped scale", () => {
    expect(resolveTerminalWallStrokeWidth(23)).toBe(2);
    expect(resolveTerminalWallStrokeWidth(29)).toBe(3);
    expect(resolveTerminalWallStrokeWidth(64)).toBe(6);
  });

  it("recognizes only the eight void cells adjacent to the player", () => {
    expect(
      isTerminalVoidGridTargetAdjacentToPlayer({
        gridX: 7.1,
        gridY: 18.2,
        playerX: 8,
        playerY: 18,
      }),
    ).toBe(true);
    expect(
      isTerminalVoidGridTargetAdjacentToPlayer({
        gridX: 8.9,
        gridY: 17.1,
        playerX: 8,
        playerY: 18,
      }),
    ).toBe(true);
    expect(
      isTerminalVoidGridTargetAdjacentToPlayer({
        gridX: 10,
        gridY: 18,
        playerX: 8,
        playerY: 18,
      }),
    ).toBe(false);
    expect(
      isTerminalVoidGridTargetAdjacentToPlayer({
        gridX: 8.2,
        gridY: 18.1,
        playerX: 8,
        playerY: 18,
      }),
    ).toBe(false);
  });

  it("rounds zoomed views to the nearest physical-pixel scale", () => {
    expect(
      resolveTerminalPhysicalCellWidth({
        drawingBufferWidth: 1919,
        drawingBufferHeight: 1079,
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        cellAspect: 2,
        zoomFactor: 1.2,
        pixelRatio: 1.25,
        minCellCssPx: 14,
        zoomOutMinCellCssPx: 2,
        maxCellCssPx: 96,
        containWholeLevel: false,
      }),
    ).toBe(29);
  });

  it("keeps the readable starting scale on a narrow high-DPI viewport", () => {
    expect(
      resolveTerminalPhysicalCellWidth({
        drawingBufferWidth: 1170,
        drawingBufferHeight: 2532,
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        cellAspect: 2,
        zoomFactor: 1,
        pixelRatio: 3,
        minCellCssPx: 14,
        zoomOutMinCellCssPx: 2,
        maxCellCssPx: 96,
        containWholeLevel: true,
      }),
    ).toBe(42);
  });

  it("allows far zoom-out on a narrow high-DPI viewport", () => {
    expect(
      resolveTerminalPhysicalCellWidth({
        drawingBufferWidth: 1170,
        drawingBufferHeight: 2532,
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        cellAspect: 2,
        zoomFactor: 0.125,
        pixelRatio: 3,
        minCellCssPx: 14,
        zoomOutMinCellCssPx: 2,
        maxCellCssPx: 96,
        containWholeLevel: true,
      }),
    ).toBe(6);
  });

  it("allows far zoom-out on a desktop viewport", () => {
    expect(
      resolveTerminalPhysicalCellWidth({
        drawingBufferWidth: 1919,
        drawingBufferHeight: 1079,
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        cellAspect: 2,
        zoomFactor: 0.125,
        pixelRatio: 1.25,
        minCellCssPx: 14,
        zoomOutMinCellCssPx: 2,
        maxCellCssPx: 96,
        containWholeLevel: true,
      }),
    ).toBe(3);
  });

  it("shows the gutter minimap when the level is clipped or zoomed", () => {
    expect(
      shouldShowTerminalGutterMinimap({
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        viewWorldWidth: 80,
        viewWorldHeight: 21,
        zoomFactor: 1,
      }),
    ).toBe(false);
    expect(
      shouldShowTerminalGutterMinimap({
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        viewWorldWidth: 72,
        viewWorldHeight: 21,
        zoomFactor: 1,
      }),
    ).toBe(true);
    expect(
      shouldShowTerminalGutterMinimap({
        mapWorldWidth: 80,
        mapWorldHeight: 21,
        viewWorldWidth: 80,
        viewWorldHeight: 21,
        zoomFactor: 1.05,
      }),
    ).toBe(true);
  });

  it("snaps the reference tile boundary to a physical pixel", () => {
    const center = snapTerminalCameraCenterToPixelGrid({
      centerWorld: 39.5,
      referenceBoundaryWorld: -0.5,
      drawingBufferPixels: 1919,
      pixelsPerWorldUnit: 23,
    });
    const projectedBoundary = 1919 / 2 + (-0.5 - center) * 23;

    expect(Number.isInteger(projectedBoundary)).toBe(true);
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

  it("recognizes Slash'EM's legacy graphics options", () => {
    expect(resolveTerminalRenderOptionStates([["IBMgraphics"]]).symsetHint).toBe(
      "ibm",
    );
    expect(resolveTerminalRenderOptionStates([["DECgraphics"]]).symsetHint).toBe(
      "dec",
    );
    expect(
      resolveTerminalRenderOptionStates([["DECgraphics", "!DECgraphics"]])
        .symsetHint,
    ).toBeNull();
  });
});

describe("Slash'EM legacy terminal symbol sets", () => {
  it("maps Slash'EM wall cmap indexes to IBM line drawing bytes", () => {
    const rawChar = mapSlashEmCmapCharForTerminal("|", 1, "ibm");
    expect(mapTerminalDisplayChar(rawChar, "ibm")).toBe("│");
  });

  it("maps Slash'EM wall cmap indexes to DEC line drawing bytes", () => {
    const rawChar = mapSlashEmCmapCharForTerminal("-", 2, "dec");
    expect(mapTerminalDisplayChar(rawChar, "dec")).toBe("─");
  });

  it("leaves symbols without a legacy override unchanged", () => {
    expect(mapSlashEmCmapCharForTerminal("<", 22, "ibm")).toBe("<");
    expect(mapSlashEmCmapCharForTerminal("|", 1, null)).toBe("|");
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
