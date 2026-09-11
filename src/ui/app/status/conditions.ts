import type {
  PlayerStatsSnapshot
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  t
} from "../shared/translations";

/** Condition definitions, hunger, encumbrance, severity and badges by runtime. */
export type StatusSeverity = "good" | "warning" | "danger";

export type PlayerStatusBadge = {
  label: string;
  severity: StatusSeverity;
};

export const playerConditionStatusDefinitions367: ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> = [
    {
      mask: 0x00000001,
      label: t.statusEffects.turningToStone,
      severity: "danger",
    },
    { mask: 0x00000002, label: t.statusEffects.slimed, severity: "danger" },
    {
      mask: 0x00000004,
      label: t.statusEffects.strangled,
      severity: "danger",
    },
    {
      mask: 0x00000008,
      label: t.statusEffects.foodPoisoning,
      severity: "danger",
    },
    {
      mask: 0x00000010,
      label: t.statusEffects.terminallyIll,
      severity: "danger",
    },
    { mask: 0x00000020, label: t.statusEffects.blind, severity: "warning" },
    { mask: 0x00000040, label: t.statusEffects.deaf, severity: "warning" },
    { mask: 0x00000080, label: t.statusEffects.stunned, severity: "warning" },
    { mask: 0x00000100, label: t.statusEffects.confused, severity: "warning" },
    {
      mask: 0x00000200,
      label: t.statusEffects.hallucinating,
      severity: "warning",
    },
    {
      mask: 0x00000400,
      label: t.statusEffects.levitating,
      severity: "good",
    },
    { mask: 0x00000800, label: t.statusEffects.flying, severity: "good" },
    { mask: 0x00001000, label: t.statusEffects.riding, severity: "good" },
  ];

export const playerConditionStatusDefinitions5: ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> = [
    {
      mask: 0x00000001,
      label: t.statusEffects.barehanded,
      severity: "warning",
    },
    { mask: 0x00000002, label: t.statusEffects.blind, severity: "warning" },
    { mask: 0x00000004, label: t.statusEffects.busy, severity: "warning" },
    { mask: 0x00000008, label: t.statusEffects.confused, severity: "warning" },
    { mask: 0x00000010, label: t.statusEffects.deaf, severity: "warning" },
    { mask: 0x00000020, label: t.statusEffects.iron, severity: "warning" },
    { mask: 0x00000040, label: t.statusEffects.flying, severity: "good" },
    {
      mask: 0x00000080,
      label: t.statusEffects.foodPoisoning,
      severity: "danger",
    },
    {
      mask: 0x00000100,
      label: t.statusEffects.glowingHands,
      severity: "warning",
    },
    { mask: 0x00000200, label: t.statusEffects.grabbed, severity: "danger" },
    {
      mask: 0x00000400,
      label: t.statusEffects.hallucinating,
      severity: "warning",
    },
    { mask: 0x00000800, label: t.statusEffects.held, severity: "warning" },
    { mask: 0x00001000, label: t.statusEffects.icy, severity: "warning" },
    { mask: 0x00002000, label: t.statusEffects.inLava, severity: "danger" },
    {
      mask: 0x00004000,
      label: t.statusEffects.levitating,
      severity: "good",
    },
    {
      mask: 0x00008000,
      label: t.statusEffects.paralyzed,
      severity: "danger",
    },
    { mask: 0x00010000, label: t.statusEffects.riding, severity: "good" },
    { mask: 0x00020000, label: t.statusEffects.sleeping, severity: "warning" },
    { mask: 0x00040000, label: t.statusEffects.slimed, severity: "danger" },
    { mask: 0x00080000, label: t.statusEffects.slippery, severity: "warning" },
    {
      mask: 0x00100000,
      label: t.statusEffects.turningToStone,
      severity: "danger",
    },
    {
      mask: 0x00200000,
      label: t.statusEffects.strangled,
      severity: "danger",
    },
    { mask: 0x00400000, label: t.statusEffects.stunned, severity: "warning" },
    { mask: 0x00800000, label: t.statusEffects.submerged, severity: "warning" },
    {
      mask: 0x01000000,
      label: t.statusEffects.terminallyIll,
      severity: "danger",
    },
    { mask: 0x02000000, label: t.statusEffects.tethered, severity: "warning" },
    { mask: 0x04000000, label: t.statusEffects.trapped, severity: "warning" },
    {
      mask: 0x08000000,
      label: t.statusEffects.unconscious,
      severity: "danger",
    },
    {
      mask: 0x10000000,
      label: t.statusEffects.woundedLegs,
      severity: "warning",
    },
    { mask: 0x20000000, label: t.statusEffects.holding, severity: "warning" },
  ];

export const playerConditionStatusDefinitionsSlashEm: ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> = [
    {
      mask: 0x00000001,
      label: t.statusEffects.levitating,
      severity: "good",
    },
    { mask: 0x00000002, label: t.statusEffects.confused, severity: "warning" },
    {
      mask: 0x00000004,
      label: t.statusEffects.foodPoisoning,
      severity: "danger",
    },
    {
      mask: 0x00000008,
      label: t.statusEffects.terminallyIll,
      severity: "danger",
    },
    { mask: 0x00000010, label: t.statusEffects.blind, severity: "warning" },
    { mask: 0x00000020, label: t.statusEffects.stunned, severity: "warning" },
    {
      mask: 0x00000040,
      label: t.statusEffects.hallucinating,
      severity: "warning",
    },
    { mask: 0x00000080, label: t.statusEffects.slimed, severity: "danger" },
    { mask: 0x00000100, label: t.statusEffects.held, severity: "warning" },
  ];

export function resolveHungerStatusBadge(
  rawHunger: unknown,
): PlayerStatusBadge | null {
  const label = String(rawHunger || "").trim();
  if (!label) {
    return null;
  }
  const normalized = label.toLowerCase();
  if (normalized === "not hungry") {
    return null;
  }
  if (normalized === "satiated") {
    return { label, severity: "good" };
  }
  if (normalized === "hungry") {
    return { label, severity: "warning" };
  }
  if (
    normalized === "weak" ||
    normalized === "fainting" ||
    normalized === "fainted" ||
    normalized === "starved"
  ) {
    return { label, severity: "danger" };
  }
  return { label, severity: "warning" };
}

export function resolveEncumbranceStatusBadge(
  rawEncumbrance: unknown,
): PlayerStatusBadge | null {
  const label = String(rawEncumbrance || "").trim();
  if (!label) {
    return null;
  }
  const normalized = label.toLowerCase();
  if (normalized.includes("unencumbered")) {
    return { label, severity: "good" };
  }
  if (normalized.includes("burdened") || normalized.includes("stressed")) {
    return { label, severity: "warning" };
  }
  if (
    normalized.includes("strained") ||
    normalized.includes("overtaxed") ||
    normalized.includes("overloaded")
  ) {
    return { label, severity: "danger" };
  }
  return { label, severity: "warning" };
}

export function resolveConditionStatusDefinitions(
  runtimeVersion: NethackRuntimeVersion,
): ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> {
  return runtimeVersion === "5.0"
    ? playerConditionStatusDefinitions5
    : runtimeVersion === "slashem"
      ? playerConditionStatusDefinitionsSlashEm
      : playerConditionStatusDefinitions367;
}

export function resolveConditionStatusBadges(
  rawMask: unknown,
  runtimeVersion: NethackRuntimeVersion,
): PlayerStatusBadge[] {
  const conditionMask =
    typeof rawMask === "number" && Number.isFinite(rawMask)
      ? Math.trunc(rawMask) >>> 0
      : 0;
  if (conditionMask === 0) {
    return [];
  }
  const definitions = resolveConditionStatusDefinitions(runtimeVersion);
  return definitions
    .filter((entry) => (conditionMask & entry.mask) !== 0)
    .map((entry) => ({
      label: entry.label,
      severity: entry.severity,
    }));
}

export function resolveConditionStatusLinePatterns(
  runtimeVersion: NethackRuntimeVersion,
  mask: number,
): readonly RegExp[] {
  if (runtimeVersion === "5.0") {
    switch (mask >>> 0) {
      case 0x00000001:
        return [/\bbare[- ]handed\b/i];
      case 0x00000002:
        return [/\bblind\b/i];
      case 0x00000004:
        return [/\bbusy\b/i];
      case 0x00000008:
        return [/\bconfused\b/i];
      case 0x00000010:
        return [/\bdeaf\b/i];
      case 0x00000020:
        return [/\biron ball\b/i, /\bchained\b/i];
      case 0x00000040:
        return [/\bcan fly\b/i, /\bflying\b/i];
      case 0x00000080:
        return [/\bfood poison(?:ing|ed)?\b/i];
      case 0x00000100:
        return [/\bglowing hands?\b/i];
      case 0x00000200:
        return [/\bgrabbed\b/i];
      case 0x00000400:
        return [/\bhallucinat(?:ing|ion)\b/i];
      case 0x00000800:
        return [/\bheld\b/i];
      case 0x00001000:
        return [/\bicy\b/i];
      case 0x00002000:
        return [/\bin lava\b/i, /\blava\b/i];
      case 0x00004000:
        return [/\blevitat(?:ing|ion)\b/i];
      case 0x00008000:
        return [/\bparaly[sz]ed\b/i];
      case 0x00010000:
        return [/\briding\b/i];
      case 0x00020000:
        return [/\bsleeping\b/i, /\basleep\b/i];
      case 0x00040000:
        return [/\bslim(?:ed|ing)\b/i];
      case 0x00080000:
        return [/\bslippery\b/i];
      case 0x00100000:
        return [/\bturn(?:ing)? to stone\b/i, /\bpetrif(?:y|ied|ying)\b/i];
      case 0x00200000:
        return [/\bstrangl(?:ed|ing)\b/i];
      case 0x00400000:
        return [/\bstunned\b/i];
      case 0x00800000:
        return [/\bsubmerged\b/i];
      case 0x01000000:
        return [/\bterminally ill\b/i];
      case 0x02000000:
        return [/\btethered\b/i];
      case 0x04000000:
        return [/\btrapped\b/i];
      case 0x08000000:
        return [/\bunconscious\b/i];
      case 0x10000000:
        return [/\bwounded legs?\b/i, /\blimping\b/i];
      case 0x20000000:
        return [/\bholding\b/i];
      default:
        return [];
    }
  }

  if (runtimeVersion === "slashem") {
    switch (mask >>> 0) {
      case 0x00000001:
        return [/\blevitat(?:ing|ion)\b/i];
      case 0x00000002:
        return [/\bconfused\b/i];
      case 0x00000004:
        return [/\bfood poison(?:ing|ed)?\b/i];
      case 0x00000008:
        return [/\bterminally ill\b/i];
      case 0x00000010:
        return [/\bblind\b/i];
      case 0x00000020:
        return [/\bstunned\b/i];
      case 0x00000040:
        return [/\bhallucinat(?:ing|ion)\b/i];
      case 0x00000080:
        return [/\bslim(?:ed|ing)\b/i];
      case 0x00000100:
        return [/\bheld\b/i];
      default:
        return [];
    }
  }

  switch (mask >>> 0) {
    case 0x00000001:
      return [/\bturn(?:ing)? to stone\b/i, /\bpetrif(?:y|ied|ying)\b/i];
    case 0x00000002:
      return [/\bslim(?:ed|ing)\b/i];
    case 0x00000004:
      return [/\bstrangl(?:ed|ing)\b/i];
    case 0x00000008:
      return [/\bfood poison(?:ing|ed)?\b/i];
    case 0x00000010:
      return [/\bterminally ill\b/i];
    case 0x00000020:
      return [/\bblind\b/i];
    case 0x00000040:
      return [/\bdeaf\b/i];
    case 0x00000080:
      return [/\bstunned\b/i];
    case 0x00000100:
      return [/\bconfused\b/i];
    case 0x00000200:
      return [/\bhallucinat(?:ing|ion)\b/i];
    case 0x00000400:
      return [/\blevitat(?:ing|ion)\b/i];
    case 0x00000800:
      return [/\bcan fly\b/i, /\bflying\b/i];
    case 0x00001000:
      return [/\briding\b/i];
    default:
      return [];
  }
}

export function resolveHungerStatusLineSeverity(
  line: string,
  rawHunger: unknown,
): StatusSeverity | null {
  const badge = resolveHungerStatusBadge(rawHunger);
  if (!badge) {
    return null;
  }

  const normalizedHunger = String(rawHunger || "")
    .trim()
    .toLowerCase();
  let pattern: RegExp | null = null;
  switch (normalizedHunger) {
    case "satiated":
      pattern = /\bsatiated\b/i;
      break;
    case "hungry":
      pattern = /\bhungry\b/i;
      break;
    case "weak":
      pattern = /\bweak\b/i;
      break;
    case "fainting":
      pattern = /\bfainting\b/i;
      break;
    case "fainted":
      pattern = /\bfainted\b/i;
      break;
    case "starved":
      pattern = /\bstarved\b/i;
      break;
    default:
      pattern = normalizedHunger ? new RegExp(`\\b${normalizedHunger}\\b`, "i") : null;
      break;
  }

  return pattern && pattern.test(line) ? badge.severity : null;
}

export function resolveEncumbranceStatusLineSeverity(
  line: string,
  rawEncumbrance: unknown,
): StatusSeverity | null {
  const badge = resolveEncumbranceStatusBadge(rawEncumbrance);
  if (!badge) {
    return null;
  }

  const normalizedEncumbrance = String(rawEncumbrance || "")
    .trim()
    .toLowerCase();
  let pattern: RegExp | null = null;
  if (normalizedEncumbrance.includes("unencumbered")) {
    pattern = /\bunencumbered\b/i;
  } else if (normalizedEncumbrance.includes("burdened")) {
    pattern = /\bburdened\b/i;
  } else if (normalizedEncumbrance.includes("stressed")) {
    pattern = /\bstressed\b/i;
  } else if (normalizedEncumbrance.includes("strained")) {
    pattern = /\bstrained\b/i;
  } else if (normalizedEncumbrance.includes("overtaxed")) {
    pattern = /\bovertaxed\b/i;
  } else if (normalizedEncumbrance.includes("overloaded")) {
    pattern = /\boverloaded\b/i;
  }

  return pattern && pattern.test(line) ? badge.severity : null;
}

export function resolveConditionStatusLineSeverity(
  line: string,
  rawMask: unknown,
  runtimeVersion: NethackRuntimeVersion,
): StatusSeverity | null {
  const conditionMask =
    typeof rawMask === "number" && Number.isFinite(rawMask)
      ? Math.trunc(rawMask) >>> 0
      : 0;
  if (conditionMask === 0) {
    return null;
  }

  for (const definition of resolveConditionStatusDefinitions(runtimeVersion)) {
    if ((conditionMask & definition.mask) === 0) {
      continue;
    }
    const patterns = resolveConditionStatusLinePatterns(
      runtimeVersion,
      definition.mask,
    );
    if (patterns.some((pattern) => pattern.test(line))) {
      return definition.severity;
    }
  }

  return null;
}

export function resolveCharacterStatusLineSeverity(
  line: string,
  stats: PlayerStatsSnapshot,
  runtimeVersion: NethackRuntimeVersion,
): StatusSeverity | null {
  const normalizedLine = String(line || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedLine) {
    return null;
  }

  return (
    resolveHungerStatusLineSeverity(normalizedLine, stats.hunger) ??
    resolveEncumbranceStatusLineSeverity(normalizedLine, stats.encumbrance) ??
    resolveConditionStatusLineSeverity(
      normalizedLine,
      stats.conditionMask,
      runtimeVersion,
    )
  );
}

export function buildPlayerStatusBadges(
  stats: PlayerStatsSnapshot,
  runtimeVersion: NethackRuntimeVersion,
): PlayerStatusBadge[] {
  const badges: PlayerStatusBadge[] = [];
  const seen = new Set<string>();
  const pushUnique = (badge: PlayerStatusBadge | null): void => {
    if (!badge) {
      return;
    }
    const key = badge.label.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    badges.push(badge);
  };

  pushUnique(resolveHungerStatusBadge(stats.hunger));
  pushUnique(resolveEncumbranceStatusBadge(stats.encumbrance));
  for (const badge of resolveConditionStatusBadges(
    stats.conditionMask,
    runtimeVersion,
  )) {
    pushUnique(badge);
  }
  return badges;
}
