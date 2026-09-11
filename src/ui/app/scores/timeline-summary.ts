import {
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type {
  TopScoreMetric
} from "./types";
import {
  resolveTopScoreTelemetry,
  resolveTopScoreTimelineEvents
} from "./timeline-events";
import {
  resolveTopScoreMaxCharacterLevel,
  resolveTopScoreTimelineLineIncrement
} from "./timeline-labels";
import {
  formatTopScoreInteger
} from "./format";

/** Timeline overview metrics and peak level summary. */
export function buildTopScoreTimelineSummaryMetrics(score: TopScoreRecord): TopScoreMetric[] {
  const events = resolveTopScoreTimelineEvents(score);
  if (events.length <= 0) {
    return [];
  }

  const killCount = events.reduce(
    (total, event) =>
      event.kind === "kill"
        ? total + resolveTopScoreTimelineLineIncrement("kills", {
          ...event,
          filterId: "kills",
        })
        : total,
    0,
  );
  const goldCollected = events.reduce((total, event) => {
    if (event.kind !== "gold") {
      return total;
    }
    return total + Math.max(0, event.amount ?? 0);
  }, 0);
  const telemetry = resolveTopScoreTelemetry(score);
  const locationsVisited = new Set(
    events
      .filter((event) => event.kind === "location")
      .map((event) => String(event.location || event.label).trim())
      .filter(Boolean),
  ).size;
  const maxCharacterLevel = resolveTopScoreMaxCharacterLevel(score, events);
  const hiddenFindCount = telemetry.hiddenFindEvents.length;
  const lootCount = telemetry.lootEvents.reduce(
    (total, event) => total + Math.max(0, event.quantity),
    0,
  );
  const spellsLearned = telemetry.spellLearnedEvents.length;

  return [
    {
      label: "Foes defeated",
      value: formatTopScoreInteger(killCount),
      detail: killCount === 1 ? "one recorded kill" : "recorded kills",
    },
    {
      label: "Gold gathered",
      value: formatTopScoreInteger(goldCollected),
      detail: goldCollected === 1 ? "piece picked up" : "pieces picked up",
    },
    {
      label: "Hidden finds",
      value: formatTopScoreInteger(hiddenFindCount),
      detail:
        hiddenFindCount === 1 ? "one secret revealed" : "secrets revealed",
    },
    {
      label: "Loot collected",
      value: formatTopScoreInteger(lootCount),
      detail: lootCount === 1 ? "one item tracked" : "items tracked",
    },
    {
      label: "Spells learned",
      value: formatTopScoreInteger(spellsLearned),
      detail:
        spellsLearned === 1 ? "one spell discovered" : "spells discovered",
    },
    {
      label: "Traps sprung",
      value: formatTopScoreInteger(telemetry.trapEvents.length),
      detail:
        telemetry.trapEvents.length === 1
          ? "one hazard triggered"
          : "hazards triggered",
    },
    {
      label: "Places reached",
      value: formatTopScoreInteger(locationsVisited),
      detail:
        locationsVisited === 1 ? "floor or branch logged" : "floors or branches logged",
    },
    {
      label: "Max level",
      value:
        maxCharacterLevel === null
          ? "--"
          : formatTopScoreInteger(maxCharacterLevel),
      detail: "peak character level",
    },
  ];
}
