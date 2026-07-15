import type { Nh3dAsciiColorMode } from "./ui-types";
import {
  resolveTerminalCellPresentation,
  TERMINAL_BACKGROUND_HEX,
  type TerminalRenderOptionStates,
} from "./terminal/terminal-display";

export const CLASSIC_ASCII_BACKGROUND_HEX = "#1f1f1f";

export type AsciiGlyphPresentation = {
  glyphChar: string;
  textColor: string;
  backgroundColorHex: string | null;
};

export function resolveAsciiGlyphPresentation(params: {
  mode: Nh3dAsciiColorMode;
  glyphChar: string;
  baseTextColor: string;
  runtimeChar: string | null | undefined;
  runtimeColor: number | null | undefined;
  runtimeGlyphFlags: number | null | undefined;
  terminalOptionStates: TerminalRenderOptionStates;
  slashEmCmapIndex?: number | null;
}): AsciiGlyphPresentation {
  const {
    mode,
    glyphChar,
    baseTextColor,
    runtimeChar,
    runtimeColor,
    runtimeGlyphFlags,
    terminalOptionStates,
    slashEmCmapIndex,
  } = params;

  const terminalPresentation = resolveTerminalCellPresentation({
    char: runtimeChar ?? glyphChar,
    color: runtimeColor,
    glyphFlags: runtimeGlyphFlags,
    // In 3D ASCII, pets use their normal runtime foreground color. The 3D
    // billboard heart is the pet marker; reverse video remains exclusive to
    // the faithful Terminal display mode.
    optionStates: {
      ...terminalOptionStates,
      hilitePet: false,
    },
    slashEmCmapIndex,
  });
  const displayChar = terminalPresentation.displayChar || glyphChar;

  if (mode === "terminal") {
    return {
      glyphChar: displayChar,
      textColor: terminalPresentation.fgHex,
      backgroundColorHex: terminalPresentation.bgHex,
    };
  }

  if (mode === "classic") {
    return {
      glyphChar: displayChar,
      textColor:
        terminalPresentation.fgHex === TERMINAL_BACKGROUND_HEX
          ? CLASSIC_ASCII_BACKGROUND_HEX
          : terminalPresentation.fgHex,
      backgroundColorHex:
        terminalPresentation.bgHex === TERMINAL_BACKGROUND_HEX
          ? CLASSIC_ASCII_BACKGROUND_HEX
          : terminalPresentation.bgHex,
    };
  }

  return {
    glyphChar: displayChar,
    textColor: baseTextColor,
    backgroundColorHex: null,
  };
}
