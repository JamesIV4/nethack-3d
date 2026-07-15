import { describe, expect, it } from "vitest";
import {
  CLASSIC_ASCII_BACKGROUND_HEX,
  resolveAsciiGlyphPresentation,
} from "./ascii-color-mode";
import {
  defaultTerminalRenderOptionStates,
  TERMINAL_MG_FLAGS,
} from "./terminal/terminal-display";

const baseParams = {
  glyphChar: "d",
  baseTextColor: "#123456",
  runtimeChar: "d",
  runtimeColor: 3,
  runtimeGlyphFlags: 0,
  terminalOptionStates: { ...defaultTerminalRenderOptionStates },
};

describe("resolveAsciiGlyphPresentation", () => {
  it("preserves the NetHack 3D colors", () => {
    expect(
      resolveAsciiGlyphPresentation({
        ...baseParams,
        mode: "nethack-3d",
      }),
    ).toEqual({
      glyphChar: "d",
      textColor: "#123456",
      backgroundColorHex: null,
    });
  });

  it("uses terminal runtime colors on the Classic dark-grey background", () => {
    expect(
      resolveAsciiGlyphPresentation({
        ...baseParams,
        mode: "classic",
      }),
    ).toEqual({
      glyphChar: "d",
      textColor: "#aa5500",
      backgroundColorHex: CLASSIC_ASCII_BACKGROUND_HEX,
    });
  });

  it("uses the raw runtime color with the terminal palette", () => {
    expect(
      resolveAsciiGlyphPresentation({
        ...baseParams,
        mode: "terminal",
        runtimeColor: 12,
      }),
    ).toEqual({
      glyphChar: "d",
      textColor: "#5555ff",
      backgroundColorHex: "#000000",
    });
  });

  it("keeps the normal pet color in Terminal-colored 3D ASCII", () => {
    expect(
      resolveAsciiGlyphPresentation({
        ...baseParams,
        mode: "terminal",
        runtimeGlyphFlags: TERMINAL_MG_FLAGS.pet,
        terminalOptionStates: {
          ...defaultTerminalRenderOptionStates,
          hilitePet: true,
        },
      }),
    ).toEqual({
      glyphChar: "d",
      textColor: "#aa5500",
      backgroundColorHex: "#000000",
    });
  });

  it("keeps the normal pet color on the Classic dark-grey background", () => {
    expect(
      resolveAsciiGlyphPresentation({
        ...baseParams,
        mode: "classic",
        runtimeGlyphFlags: TERMINAL_MG_FLAGS.pet,
        terminalOptionStates: {
          ...defaultTerminalRenderOptionStates,
          hilitePet: true,
        },
      }),
    ).toEqual({
      glyphChar: "d",
      textColor: "#aa5500",
      backgroundColorHex: CLASSIC_ASCII_BACKGROUND_HEX,
    });
  });

  it("decodes IBM graphics bytes for every ASCII color mode", () => {
    expect(
      resolveAsciiGlyphPresentation({
        ...baseParams,
        mode: "nethack-3d",
        glyphChar: String.fromCharCode(0xc4),
        runtimeChar: String.fromCharCode(0xc4),
        terminalOptionStates: {
          ...defaultTerminalRenderOptionStates,
          symsetHint: "ibm",
        },
      }).glyphChar,
    ).toBe("─");
  });
});
