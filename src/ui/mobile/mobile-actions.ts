export type MobileActionEntry = {
  id: string;
  label: string;
  kind: "quick" | "extended";
  value: string;
};

export type MobileActionSheetMode = "quick" | "extended";

export const mobileActions: MobileActionEntry[] = [
  { id: "wait", label: "Wait", kind: "quick", value: "wait" },
  { id: "zap", label: "Zap", kind: "extended", value: "zap" },
  { id: "cast", label: "Cast", kind: "extended", value: "cast" },
  { id: "kick", label: "Kick", kind: "extended", value: "kick" },
  { id: "read", label: "Read", kind: "extended", value: "read" },
  { id: "quaff", label: "Quaff", kind: "extended", value: "quaff" },
  { id: "eat", label: "Eat", kind: "extended", value: "eat" },
  { id: "glance", label: "Glance", kind: "extended", value: "glance" },
  { id: "loot", label: "Loot", kind: "quick", value: "loot" },
  { id: "open", label: "Open", kind: "quick", value: "open" },
  { id: "wield", label: "Wield", kind: "extended", value: "wield" },
  { id: "wear", label: "Wear", kind: "extended", value: "wear" },
  { id: "put-on", label: "Put On", kind: "extended", value: "puton" },
  { id: "take-off", label: "Take Off", kind: "extended", value: "takeoff" },
  { id: "extended", label: "Extended", kind: "quick", value: "extended" },
];

const fallbackExtendedCommandNames = [
  "adjust",
  "annotate",
  "apply",
  "attributes",
  "autopickup",
  "call",
  "cast",
  "chat",
  "close",
  "conduct",
  "dip",
  "drop",
  "droptype",
  "eat",
  "engrave",
  "enhance",
  "explode",
  "fight",
  "fire",
  "force",
  "getpos",
  "glance",
  "history",
  "invoke",
  "jump",
  "kick",
  "known",
  "knownclass",
  "look",
  "loot",
  "monster",
  "monsters",
  "name",
  "namefloor",
  "offer",
  "open",
  "options",
  "overview",
  "pay",
  "pickup",
  "pray",
  "prevmsg",
  "puton",
  "quaff",
  "quit",
  "quiver",
  "read",
  "redraw",
  "remove",
  "ride",
  "rub",
  "seeall",
  "seeamulet",
  "seegold",
  "seeinv",
  "seespells",
  "semicolon",
  "set",
  "shell",
  "sit",
  "spells",
  "takeoff",
  "takeoffall",
  "teleport",
  "terrain",
  "throw",
  "tip",
  "travel",
  "turn",
  "twoweapon",
  "untrap",
  "version",
  "versionshort",
  "wield",
  "wipe",
  "wear",
  "whatdoes",
  "whatis",
  "wieldquiver",
  "zap",
];

const commonExtendedCommandWhitelist = [
  "apply",
  "autopickup",
  "attributes",
  "drop",
  "engrave",
  "fire",
  "options",
  "pray",
  "quiver",
  "remove",
  "throw",
  "travel",
];

export function resolveMobileExtendedCommandNames(
  extendedCommands: string[],
): string[] {
  const rawCommands =
    Array.isArray(extendedCommands) && extendedCommands.length > 0
      ? extendedCommands
      : fallbackExtendedCommandNames;
  const uniqueCommands: string[] = [];
  const seen = new Set<string>();
  for (const rawCommand of rawCommands) {
    const normalized = String(rawCommand || "")
      .trim()
      .toLowerCase();
    if (!normalized || normalized === "#" || normalized === "?") {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    uniqueCommands.push(normalized);
  }
  return uniqueCommands;
}

export function resolveMobileCommonExtendedCommandNames(
  mobileExtendedCommandNames: string[],
): string[] {
  const available = new Set(mobileExtendedCommandNames);
  return commonExtendedCommandWhitelist.filter((command) =>
    available.has(command),
  );
}
