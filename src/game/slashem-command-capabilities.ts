import type { NethackRuntimeVersion } from "../runtime/types";

export type SlashEmCommandInputBinding = Readonly<{
  key: string;
  modifier?: "ctrl" | "meta";
}>;

// Slash'EM 0.0.7E7F3 keeps ordinary keyboard commands in the static
// `cmdlist[]` table in src/cmd.c, separate from the exported `extcmdlist[]`
// table used for # commands. NetHack 3D cannot discover cmdlist at runtime,
// so keep the user-facing command names and exact source-defined bindings
// here. The two tables are merged for the action UI below.
const slashEmKeyboardCommandBindings = {
  "2weapon": { key: "2", modifier: "meta" },
  adjust: { key: "a", modifier: "meta" },
  apply: { key: "a" },
  attributes: { key: "x", modifier: "ctrl" },
  autopickup: { key: "@" },
  borrow: { key: "b", modifier: "meta" },
  call: { key: "C" },
  cast: { key: "Z" },
  chat: { key: "c", modifier: "meta" },
  close: { key: "c" },
  dip: { key: "d", modifier: "meta" },
  drop: { key: "d" },
  eat: { key: "e" },
  engrave: { key: "E" },
  enhance: { key: "k", modifier: "meta" },
  explore: { key: "X" },
  fight: { key: "F" },
  fire: { key: "f" },
  force: { key: "f", modifier: "meta" },
  glance: { key: ";" },
  history: { key: "V" },
  invoke: { key: "i", modifier: "meta" },
  jump: { key: "j", modifier: "meta" },
  kick: { key: "d", modifier: "ctrl" },
  known: { key: "\\" },
  look: { key: ":" },
  loot: { key: "l", modifier: "meta" },
  monster: { key: "m", modifier: "meta" },
  name: { key: "n", modifier: "meta" },
  offer: { key: "o", modifier: "meta" },
  open: { key: "o" },
  options: { key: "O" },
  pay: { key: "p" },
  pickup: { key: "," },
  pray: { key: "p", modifier: "meta" },
  prevmsg: { key: "p", modifier: "ctrl" },
  puton: { key: "P" },
  quaff: { key: "q" },
  quit: { key: "q", modifier: "meta" },
  quiver: { key: "Q" },
  read: { key: "r" },
  redraw: { key: "r", modifier: "ctrl" },
  remove: { key: "R" },
  rub: { key: "r", modifier: "meta" },
  search: { key: "s" },
  sit: { key: "s", modifier: "meta" },
  spells: { key: "+" },
  takeoff: { key: "T" },
  takeoffall: { key: "A" },
  technique: { key: "t", modifier: "meta" },
  teleport: { key: "t", modifier: "ctrl" },
  throw: { key: "t" },
  travel: { key: "_" },
  twoweapon: { key: "2", modifier: "meta" },
  untrap: { key: "u", modifier: "meta" },
  version: { key: "v", modifier: "meta" },
  versionshort: { key: "v" },
  wear: { key: "W" },
  whatdoes: { key: "&" },
  whatis: { key: "/" },
  wield: { key: "w" },
  wipe: { key: "w", modifier: "meta" },
  youpoly: { key: "y", modifier: "meta" },
  zap: { key: "z" },
} as const satisfies Readonly<Record<string, SlashEmCommandInputBinding>>;

export const slashEmKeyboardCommandNames = Object.freeze(
  Object.keys(slashEmKeyboardCommandBindings),
);

export function resolveSlashEmCommandInputBinding(
  commandName: string,
): SlashEmCommandInputBinding | null {
  const normalized = String(commandName || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  return (
    slashEmKeyboardCommandBindings[
      normalized as keyof typeof slashEmKeyboardCommandBindings
    ] ?? null
  );
}

export function augmentRuntimeCommandNames(
  runtimeVersion: NethackRuntimeVersion,
  runtimeCommandNames: readonly string[],
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  const append = (rawName: string): void => {
    const normalized = String(rawName || "")
      .trim()
      .toLowerCase();
    if (
      !normalized ||
      normalized === "#" ||
      normalized === "?" ||
      seen.has(normalized)
    ) {
      return;
    }
    seen.add(normalized);
    merged.push(normalized);
  };

  for (const commandName of runtimeCommandNames) {
    append(commandName);
  }
  if (runtimeVersion === "slashem") {
    for (const commandName of slashEmKeyboardCommandNames) {
      append(commandName);
    }
    merged.sort((left, right) => left.localeCompare(right));
  }

  return merged;
}
