/** Startup rain glyphs and eagerly initialized animation particles. */
export const startupMenuRainAlphabet = [
  "@",
  "#",
  "$",
  "%",
  "&",
  "*",
  "+",
  "!",
  "?",
  "/",
  "\\",
  "[",
  "]",
  "{",
  "}",
  "<",
  ">",
  "|",
  "_",
  "~",
  "=",
  ":",
  ";",
  ".",
  ",",
  ")",
  "(",
  "d",
  "D",
  "g",
  "h",
  "k",
  "m",
  "o",
  "r",
  "s",
  "u",
  "w",
  "x",
  "y",
  "z",
  "B",
  "E",
  "F",
  "H",
  "K",
  "L",
  "N",
  "P",
  "R",
  "S",
  "T",
  "V",
] as const;

export type StartupMenuRainGlyphFrame = {
  char: string;
  delayMs: number;
  durationMs: number;
};

export type StartupMenuRainParticle = {
  blurPx: number;
  delayMs: number;
  durationMs: number;
  fontSizePx: number;
  glyphFrames: readonly StartupMenuRainGlyphFrame[];
  leftPercent: number;
  opacity: number;
};

export function createStartupMenuRainParticles(): readonly StartupMenuRainParticle[] {
  let seed = 0x3d6b4f21;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  return Array.from({ length: 72 }, () => {
    const durationMs = 14000 + Math.round(next() * 12000);
    const glyphFrameCount = 4;
    const glyphChangeIntervalMs = 5000 + Math.round(next() * 2200);
    const glyphCycleDurationMs = glyphChangeIntervalMs * glyphFrameCount;
    const glyphPhaseOffsetMs = -Math.round(next() * glyphCycleDurationMs);
    const glyphFrames = Array.from({ length: glyphFrameCount }, (_, index) => ({
      char: startupMenuRainAlphabet[
        Math.floor(next() * startupMenuRainAlphabet.length)
      ],
      delayMs: glyphPhaseOffsetMs + index * glyphChangeIntervalMs,
      durationMs: glyphCycleDurationMs,
    }));

    return {
      blurPx: next() > 0.76 ? Number((0.5 + next() * 0.9).toFixed(2)) : 0,
      delayMs: -Math.round(next() * durationMs),
      durationMs,
      fontSizePx: (13 + Math.round(next() * 8)) * 2.5,
      glyphFrames,
      leftPercent: Number((-4 + next() * 108).toFixed(3)),
      opacity: Number((0.18 + next() * 0.36).toFixed(3)),
    };
  });
}

export const startupMenuRainParticles = createStartupMenuRainParticles();
