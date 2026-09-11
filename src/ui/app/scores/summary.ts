import {
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type {
  TopScoreChipGroup,
  TopScoreMetric
} from "./types";
import {
  formatTopScoreAlignmentLabel,
  formatTopScoreCharacterLine,
  formatTopScoreDateTime,
  formatTopScoreDuration,
  formatTopScoreHp,
  formatTopScoreInteger,
  formatTopScorePlayerName,
  formatTopScoreShortDateTime,
  formatTopScoreText,
  hasTopScoreDisplayValue,
  pushTopScoreMetric,
  pushTopScoreRow,
  resolveTopScoreAttributeValue,
  resolveTopScoreDepthMetric,
  resolveTopScoreLocationLabel
} from "./format";

/** Score cards, overview, adventure, attributes and challenge groups. */
export function buildTopScoreCardMetrics(score: TopScoreRecord): TopScoreMetric[] {
  const metrics: TopScoreMetric[] = [];
  pushTopScoreMetric(metrics, "Turns", formatTopScoreInteger(score.turns));
  pushTopScoreMetric(metrics, "Depth", resolveTopScoreDepthMetric(score));
  pushTopScoreMetric(metrics, "Final HP", formatTopScoreHp(score));
  pushTopScoreMetric(
    metrics,
    "Ended",
    formatTopScoreShortDateTime(
      score.endtime || score.deathdate || score.detail?.capturedAtIso,
    ),
  );
  return metrics;
}

export function buildTopScoreOverviewRows(score: TopScoreRecord): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  pushTopScoreRow(rows, "Adventurer", formatTopScorePlayerName(score));
  pushTopScoreRow(rows, "Path", formatTopScoreCharacterLine(score));
  pushTopScoreRow(
    rows,
    "Final score",
    `${formatTopScoreInteger(score.points)} points`,
  );
  pushTopScoreRow(rows, "Cause of end", formatTopScoreText(score.death));
  pushTopScoreRow(rows, "Final location", resolveTopScoreLocationLabel(score));
  pushTopScoreRow(rows, "Turns survived", formatTopScoreInteger(score.turns));
  pushTopScoreRow(rows, "Real time", formatTopScoreDuration(score.realtimeSeconds));
  pushTopScoreRow(rows, "Final HP", formatTopScoreHp(score));
  pushTopScoreRow(rows, "Started", formatTopScoreDateTime(score.starttime));
  pushTopScoreRow(
    rows,
    "Ended",
    formatTopScoreDateTime(
      score.endtime || score.deathdate || score.detail?.capturedAtIso,
    ),
  );
  pushTopScoreRow(rows, "State at death", formatTopScoreText(score.whileHelpless));
  return rows;
}

export function buildTopScoreAdventureMetrics(score: TopScoreRecord): TopScoreMetric[] {
  const metrics: TopScoreMetric[] = [];
  const hitPoints = resolveTopScoreAttributeValue(score, "Hit points");
  const power = resolveTopScoreAttributeValue(score, "Power");
  const armorClass = resolveTopScoreAttributeValue(score, "Armor class");
  const experience = resolveTopScoreAttributeValue(score, "Experience");
  const level = resolveTopScoreAttributeValue(score, "Level");
  const gold = resolveTopScoreAttributeValue(score, "Gold");
  const alignment =
    resolveTopScoreAttributeValue(score, "Alignment") ||
    formatTopScoreAlignmentLabel(score.align);
  const turn =
    resolveTopScoreAttributeValue(score, "Turn") || formatTopScoreInteger(score.turns);

  pushTopScoreMetric(
    metrics,
    "Hit points",
    hitPoints || formatTopScoreHp(score),
    power ? `Power ${power}` : undefined,
  );
  pushTopScoreMetric(metrics, "Armor class", armorClass);
  pushTopScoreMetric(
    metrics,
    "Experience",
    experience,
    level ? `Level ${level}` : undefined,
  );
  pushTopScoreMetric(metrics, "Gold", gold);
  pushTopScoreMetric(metrics, "Alignment", alignment);
  pushTopScoreMetric(metrics, "Turn", turn);

  if (metrics.length < 4) {
    pushTopScoreMetric(metrics, "Depth", resolveTopScoreDepthMetric(score));
    pushTopScoreMetric(metrics, "Real time", formatTopScoreDuration(score.realtimeSeconds));
    pushTopScoreMetric(metrics, "Deaths on file", formatTopScoreInteger(score.deaths));
  }

  return metrics;
}

export function buildTopScoreAttributeMetrics(score: TopScoreRecord): TopScoreMetric[] {
  return [
    { label: "Strength", value: resolveTopScoreAttributeValue(score, "Strength") },
    { label: "Dexterity", value: resolveTopScoreAttributeValue(score, "Dexterity") },
    {
      label: "Constitution",
      value: resolveTopScoreAttributeValue(score, "Constitution"),
    },
    {
      label: "Intelligence",
      value: resolveTopScoreAttributeValue(score, "Intelligence"),
    },
    { label: "Wisdom", value: resolveTopScoreAttributeValue(score, "Wisdom") },
    { label: "Charisma", value: resolveTopScoreAttributeValue(score, "Charisma") },
  ].filter((metric) => hasTopScoreDisplayValue(metric.value));
}

export function buildTopScoreChallengeGroups(score: TopScoreRecord): TopScoreChipGroup[] {
  return [
    {
      label: "Challenge streaks",
      values: score.conductLabels,
      emptyLabel: "No conduct streaks were recorded for this run.",
    },
    {
      label: "Milestones",
      values: score.achievementLabels,
      emptyLabel: "No milestone flags were recorded for this run.",
    },
    {
      label: "Run rules",
      values: score.flagLabels.length > 0 ? score.flagLabels : ["Normal"],
      emptyLabel: "Normal",
    },
  ];
}

export function buildTopScorePreviewLabels(score: TopScoreRecord): string[] {
  const allLabels = [
    ...score.flagLabels.filter(
      (label) => label.trim().toLowerCase() !== "bones disabled",
    ),
    ...score.conductLabels,
    ...score.achievementLabels,
  ];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const label of allLabels) {
    const normalized = label.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(normalized);
  }
  const visible = deduped.slice(0, 5);
  if (deduped.length > visible.length) {
    visible.push(`+${deduped.length - visible.length} more`);
  }
  return visible;
}
