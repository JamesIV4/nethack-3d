import {
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type {
  TopScoreSortId,
  TopScoreSortOption
} from "./types";
import {
  resolveTopScoreAttributeValue
} from "./format";
import {
  resolveTopScoreTelemetry,
  resolveTopScoreTimelineEvents
} from "./timeline-events";
import {
  resolveTopScoreTimelineLineIncrement
} from "./timeline-labels";

/** Score sorting options and deterministic sort comparison. */
export const topScoresPageSize = 10;

export const topScoreSortOptions: readonly TopScoreSortOption[] = [
  { id: "date", label: "Date" },
  { id: "score", label: "Score" },
  { id: "depth", label: "Depth" },
  { id: "turns", label: "Turns" },
  { id: "kills", label: "Kills" },
];

export function resolveTopScoreDateSortValue(score: TopScoreRecord): number {
  const parsed = Date.parse(
    score.endtime || score.deathdate || score.detail?.capturedAtIso || "",
  );
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function resolveTopScoreDepthSortValue(score: TopScoreRecord): number {
  const candidates = [
    score.maxlvl,
    score.deathlev,
    Number.parseInt(resolveTopScoreAttributeValue(score, "Dungeon level"), 10),
  ].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  return candidates.length > 0
    ? Math.max(...candidates.map((value) => Math.trunc(value)))
    : 0;
}

export function resolveTopScoreTurnsSortValue(score: TopScoreRecord): number {
  const turnCandidate =
    typeof score.turns === "number" && Number.isFinite(score.turns)
      ? score.turns
      : Number.parseInt(resolveTopScoreAttributeValue(score, "Turn"), 10);
  return Number.isFinite(turnCandidate)
    ? Math.max(0, Math.trunc(turnCandidate))
    : 0;
}

export function resolveTopScoreKillsSortValue(score: TopScoreRecord): number {
  const timelineKills = resolveTopScoreTimelineEvents(score).reduce(
    (total, event) =>
      event.kind === "kill"
        ? total + resolveTopScoreTimelineLineIncrement("kills", {
          ...event,
          filterId: "kills",
        })
        : total,
    0,
  );
  const telemetry = resolveTopScoreTelemetry(score);
  const breakdownKills = [
    ...telemetry.weaponKills,
    ...telemetry.spellKills,
    ...telemetry.petKills,
  ].reduce((total, entry) => total + Math.max(0, Math.trunc(entry.count)), 0);
  return Math.max(timelineKills, breakdownKills);
}

export function compareTopScoresBySort(
  left: TopScoreRecord,
  right: TopScoreRecord,
  sortId: TopScoreSortId,
): number {
  const compareNumericDescending = (
    leftValue: number,
    rightValue: number,
  ): number => rightValue - leftValue;

  let result = 0;
  switch (sortId) {
    case "date":
      result = compareNumericDescending(
        resolveTopScoreDateSortValue(left),
        resolveTopScoreDateSortValue(right),
      );
      break;
    case "depth":
      result = compareNumericDescending(
        resolveTopScoreDepthSortValue(left),
        resolveTopScoreDepthSortValue(right),
      );
      break;
    case "turns":
      result = compareNumericDescending(
        resolveTopScoreTurnsSortValue(left),
        resolveTopScoreTurnsSortValue(right),
      );
      break;
    case "kills":
      result = compareNumericDescending(
        resolveTopScoreKillsSortValue(left),
        resolveTopScoreKillsSortValue(right),
      );
      break;
    case "score":
    default:
      result = compareNumericDescending(left.points, right.points);
      break;
  }
  if (result !== 0) {
    return result;
  }
  if (right.points !== left.points) {
    return right.points - left.points;
  }
  return left.rank - right.rank || right.sourceLine - left.sourceLine;
}
