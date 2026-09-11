import {
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type {
  TopScoreMetric
} from "./types";
import {
  capitalizeFirstLetter
} from "../shared/text";

/** Score values, character labels, location and result formatting. */
export function formatTopScoreInteger(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return Math.trunc(value).toLocaleString();
}

export function formatTopScoreText(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  return normalized || "--";
}

export function formatTopScoreDateTime(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "--";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  return date.toLocaleString();
}

export function formatTopScoreDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "--";
  }
  const totalSeconds = Math.trunc(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainder}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainder}s`;
  }
  return `${remainder}s`;
}

export function formatTopScoreList(labels: ReadonlyArray<string>): string {
  return labels.length > 0 ? labels.join(", ") : "None";
}

export const topScoreRoleLabels: Record<string, string> = {
  Arc: "Archeologist",
  Bar: "Barbarian",
  Cav: "Caveman",
  Hea: "Healer",
  Kni: "Knight",
  Mon: "Monk",
  Pri: "Priest",
  Ran: "Ranger",
  Rog: "Rogue",
  Sam: "Samurai",
  Tou: "Tourist",
  Val: "Valkyrie",
  Wiz: "Wizard",
};

export const topScoreRaceLabels: Record<string, string> = {
  Dwa: "Dwarf",
  Elf: "Elf",
  Gno: "Gnome",
  Hum: "Human",
  Orc: "Orc",
};

export const topScoreGenderLabels: Record<string, string> = {
  Fem: "Female",
  F: "Female",
  Mal: "Male",
  M: "Male",
};

export const topScoreAlignmentLabels: Record<string, string> = {
  Cha: "Chaotic",
  Law: "Lawful",
  Neu: "Neutral",
  Unc: "Unaligned",
};

export function resolveTopScoreDisplayLabel(
  value: string | null | undefined,
  labels: Record<string, string>,
): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }
  return labels[normalized] ?? normalized;
}

export function hasTopScoreDisplayValue(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 && normalized !== "--";
}

export function pushTopScoreMetric(
  metrics: TopScoreMetric[],
  label: string,
  value: string | null | undefined,
  detail?: string | null | undefined,
): void {
  const normalizedValue = String(value ?? "").trim();
  if (!hasTopScoreDisplayValue(normalizedValue)) {
    return;
  }
  const normalizedDetail = String(detail ?? "").trim();
  metrics.push({
    label,
    value: normalizedValue,
    detail: hasTopScoreDisplayValue(normalizedDetail)
      ? normalizedDetail
      : undefined,
  });
}

export function pushTopScoreRow(
  rows: Array<[string, string]>,
  label: string,
  value: string | null | undefined,
): void {
  const normalized = String(value ?? "").trim();
  if (!hasTopScoreDisplayValue(normalized)) {
    return;
  }
  rows.push([label, normalized]);
}

export function formatTopScoreHp(score: TopScoreRecord): string {
  const hp =
    typeof score.hp === "number" && Number.isFinite(score.hp)
      ? String(Math.trunc(score.hp))
      : "--";
  const maxhp =
    typeof score.maxhp === "number" && Number.isFinite(score.maxhp)
      ? String(Math.trunc(score.maxhp))
      : "--";
  if (hp === "--" && maxhp === "--") {
    return "--";
  }
  if (maxhp === "--") {
    return hp;
  }
  if (hp === "--") {
    return `--/${maxhp}`;
  }
  return `${hp}/${maxhp}`;
}

export function formatTopScoreRoleLabel(value: string | null | undefined): string {
  return resolveTopScoreDisplayLabel(value, topScoreRoleLabels);
}

export function formatTopScoreRaceLabel(value: string | null | undefined): string {
  return resolveTopScoreDisplayLabel(value, topScoreRaceLabels);
}

export function formatTopScoreGenderLabel(value: string | null | undefined): string {
  return resolveTopScoreDisplayLabel(value, topScoreGenderLabels);
}

export function formatTopScoreAlignmentLabel(value: string | null | undefined): string {
  return resolveTopScoreDisplayLabel(value, topScoreAlignmentLabels);
}

export function formatTopScorePlayerName(score: TopScoreRecord): string {
  const normalized = String(score.name ?? "").trim();
  return normalized || "Unknown hero";
}

export function resolveTopScoreAttributeValue(
  score: TopScoreRecord,
  key: string,
): string {
  return String(score.detail?.attributes[key] ?? "").trim();
}

export function formatTopScoreCharacterLine(score: TopScoreRecord): string {
  const parts = [
    formatTopScoreRoleLabel(score.role),
    formatTopScoreRaceLabel(score.race),
    formatTopScoreGenderLabel(score.gender),
    formatTopScoreAlignmentLabel(score.align),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Unclassified adventurer";
}

export function formatTopScoreShortDateTime(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "--";
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function resolveTopScoreLocationLabel(score: TopScoreRecord): string {
  const location = resolveTopScoreAttributeValue(score, "Location");
  if (location) {
    return location;
  }

  const dungeon = resolveTopScoreAttributeValue(score, "Dungeon");
  const dungeonLevel = resolveTopScoreAttributeValue(score, "Dungeon level");
  if (dungeon && dungeonLevel) {
    return `${dungeon} ${dungeonLevel}`;
  }
  if (dungeon) {
    return dungeon;
  }
  if (dungeonLevel) {
    return `Depth ${dungeonLevel}`;
  }

  const deathLevel =
    typeof score.deathlev === "number" && Number.isFinite(score.deathlev)
      ? String(Math.trunc(score.deathlev))
      : "";
  const maxLevel =
    typeof score.maxlvl === "number" && Number.isFinite(score.maxlvl)
      ? String(Math.trunc(score.maxlvl))
      : "";
  if (deathLevel && maxLevel && deathLevel !== maxLevel) {
    return `Depth ${deathLevel} / deepest ${maxLevel}`;
  }
  if (maxLevel) {
    return `Depth ${maxLevel}`;
  }
  if (deathLevel) {
    return `Depth ${deathLevel}`;
  }
  if (typeof score.deathdnum === "number" && Number.isFinite(score.deathdnum)) {
    return `Dungeon ${Math.trunc(score.deathdnum)}`;
  }
  return "Unknown depth";
}

export function resolveTopScoreDepthMetric(score: TopScoreRecord): string {
  const dungeonLevel = resolveTopScoreAttributeValue(score, "Dungeon level");
  if (dungeonLevel) {
    return dungeonLevel;
  }
  const deathLevel = formatTopScoreInteger(score.deathlev);
  const maxLevel = formatTopScoreInteger(score.maxlvl);
  if (
    hasTopScoreDisplayValue(deathLevel) &&
    hasTopScoreDisplayValue(maxLevel) &&
    deathLevel !== maxLevel
  ) {
    return `${deathLevel} / ${maxLevel}`;
  }
  if (hasTopScoreDisplayValue(maxLevel)) {
    return maxLevel;
  }
  return deathLevel;
}

export function formatTopScoreSnapshotStatus(score: TopScoreRecord): string | null {
  return score.detail ? null : "Archive only";
}

export function formatTopScoreResultSummary(score: TopScoreRecord): string {
  const cause = String(score.death ?? "").trim();
  const location = resolveTopScoreLocationLabel(score);
  if (cause && location !== "Unknown depth") {
    return `${capitalizeFirstLetter(cause)} in ${location}.`;
  }
  if (cause) {
    return capitalizeFirstLetter(cause);
  }
  if (location !== "Unknown depth") {
    return `Recorded in ${location}.`;
  }
  return "A recorded expedition.";
}
