import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "./mobile-actions";

/** Fallback extended commands and wizard command copy. */
export type WizardCommandCopy = {
  name: string;
  description: string;
};

export const fallbackExtendedCommandNames = [
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

export const commonExtendedCommandWhitelist = [
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

export const wizardExtendedCommandNameSet = new Set([
  "levelchange",
  "lightsources",
  "migratemons",
  "panic",
  "polyself",
  "seenv",
  "stats",
  "timeout",
  "vanquished",
  "vision",
  "wizbury",
  "wizdetect",
  "wizgenesis",
  "wizidentify",
  "wizintrinsic",
  "wizlevelport",
  "wizmakemap",
  "wizmap",
  "wizrumorcheck",
  "wizsmell",
  "wizwhere",
  "wizwish",
  "wmode",
]);

export const fallbackWizardExtendedCommandNames = Array.from(
  wizardExtendedCommandNameSet,
).sort((left, right) => left.localeCompare(right));

export function getWizardCommandCopy(command: string): WizardCommandCopy {
  const normalized = String(command || "").trim().toLowerCase();
  const copy =
    t.dialogs.mobileActions.wizardCommandDetails[
    normalized as keyof typeof t.dialogs.mobileActions.wizardCommandDetails
    ];
  if (copy) {
    return copy;
  }
  return {
    name: command,
    description: t.dialogs.mobileActions.wizardCommandFallbackDescription,
  };
}

export function isWizardExtendedCommandName(commandName: string): boolean {
  const normalized = String(commandName || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.startsWith("wiz") || wizardExtendedCommandNameSet.has(normalized)
  );
}
