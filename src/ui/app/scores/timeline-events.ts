import type {
  RunTelemetrySnapshot
} from "../../../game/ui-types";
import {
  createEmptyRunTelemetrySnapshot
} from "../../../game/ui-types";
import {
  type TopScoreRecord,
  type TopScoreTimelineEvent
} from "../../../runtime/top-score-storage";
import {
  normalizeTopScoreTimelineTurn
} from "./live-timeline";
import {
  formatTopScoreInteger,
  formatTopScoreText,
  resolveTopScoreLocationLabel
} from "./format";

/** Telemetry timeline events and compatibility fallbacks. */
export function resolveTopScoreTelemetry(score: TopScoreRecord): RunTelemetrySnapshot {
  return score.detail?.telemetry ?? createEmptyRunTelemetrySnapshot();
}

export function buildTopScoreTelemetryTimelineEvents(
  score: TopScoreRecord,
): TopScoreTimelineEvent[] {
  const telemetry = resolveTopScoreTelemetry(score);
  const lootEvents = telemetry.lootEvents.map<TopScoreTimelineEvent>((event) => ({
    id: `telemetry-loot-${event.id}`,
    turn: normalizeTopScoreTimelineTurn(event.turn),
    kind: "loot",
    label:
      event.quantity === 1
        ? "Loot picked up"
        : `${formatTopScoreInteger(event.quantity)} items picked up`,
    summary:
      event.quantity === 1
        ? `Picked up ${event.label}.`
        : `Picked up ${formatTopScoreInteger(event.quantity)} ${event.label}.`,
    detail: event.category || event.detail,
    amount: event.quantity,
    location: event.location,
  }));
  const trapEvents = telemetry.trapEvents.map<TopScoreTimelineEvent>((event) => ({
    id: `telemetry-trap-${event.id}`,
    turn: normalizeTopScoreTimelineTurn(event.turn),
    kind: "trap",
    label: event.label,
    summary: event.detail || `${event.label} triggered.`,
    detail: event.detail,
    location: event.location,
  }));
  const hiddenFindEvents = telemetry.hiddenFindEvents.map<TopScoreTimelineEvent>(
    (event) => ({
      id: `telemetry-hidden-find-${event.id}`,
      turn: normalizeTopScoreTimelineTurn(event.turn),
      kind: "hidden-find",
      label: event.label,
      summary: event.detail || `Found ${event.label}.`,
      detail: event.category,
      amount: 1,
      location: event.location,
    }),
  );
  const spellEvents = telemetry.spellLearnedEvents.map<TopScoreTimelineEvent>((event) => ({
    id: `telemetry-spell-${event.id}`,
    turn: normalizeTopScoreTimelineTurn(event.turn),
    kind: "spell-learned",
    label: event.spell,
    summary: `Learned ${event.spell}.`,
    detail: event.detail,
    location: event.location,
  }));
  const petKillEvents =
    telemetry.petKillEvents.length > 0
      ? telemetry.petKillEvents.map<TopScoreTimelineEvent>((event) => ({
        id: `telemetry-pet-kill-${event.id}`,
        turn: normalizeTopScoreTimelineTurn(event.turn),
        kind: "kill",
        label:
          event.count === 1
            ? "Pet defeated an enemy"
            : `Pet defeated ${formatTopScoreInteger(event.count)} enemies`,
        summary:
          event.count === 1
            ? `${event.label} defeated an enemy.`
            : `${event.label} defeated ${formatTopScoreInteger(event.count)} enemies.`,
        detail: event.detail,
        amount: event.count,
        location: event.location,
      }))
      : telemetry.petKills.map<TopScoreTimelineEvent>((entry, index) => ({
        id: `telemetry-pet-kill-aggregate-${index}`,
        turn: normalizeTopScoreTimelineTurn(score.turns ?? score.detail?.turns),
        kind: "kill",
        label:
          entry.count === 1
            ? "Pet defeated an enemy"
            : `Pet defeated ${formatTopScoreInteger(entry.count)} enemies`,
        summary:
          entry.count === 1
            ? `${entry.label} defeated an enemy.`
            : `${entry.label} defeated ${formatTopScoreInteger(entry.count)} enemies.`,
        detail: entry.detail,
        amount: entry.count,
      }));
  return [
    ...lootEvents,
    ...trapEvents,
    ...hiddenFindEvents,
    ...spellEvents,
    ...petKillEvents,
  ];
}

export function buildFallbackTopScoreTimeline(score: TopScoreRecord): TopScoreTimelineEvent[] {
  const turn = normalizeTopScoreTimelineTurn(score.turns);
  const summary = formatTopScoreText(score.death) || "Run ended.";
  return [
    {
      id: `fallback-death-${score.id}`,
      turn,
      kind: "death",
      label: "Run ended",
      summary,
      location: resolveTopScoreLocationLabel(score),
    },
  ];
}

export function dedupeSlashemLocationTimelineEvents(
  events: TopScoreTimelineEvent[],
  score: TopScoreRecord,
): TopScoreTimelineEvent[] {
  if (score.detail?.runtimeVersion !== "slashem" && score.version !== "slashem") {
    return events;
  }

  const seenLocationKeys = new Set<string>();
  return events.filter((event) => {
    if (event.kind !== "location") {
      return true;
    }
    const label = String(
      event.location || event.summary || event.detail || event.label || "",
    ).trim();
    const depthMatch = label.match(/-?\d+\s*\.?$/);
    const key = depthMatch
      ? `slashem-depth:${Number.parseInt(depthMatch[0], 10)}`
      : label.toLowerCase();
    if (!key) {
      return true;
    }
    if (seenLocationKeys.has(key)) {
      return false;
    }
    seenLocationKeys.add(key);
    return true;
  });
}

export function resolveTopScoreTimelineEvents(score: TopScoreRecord): TopScoreTimelineEvent[] {
  const savedTimeline = score.detail?.timeline ?? [];
  const telemetryTimeline = buildTopScoreTelemetryTimelineEvents(score);
  const mergedTimeline = [...savedTimeline, ...telemetryTimeline].filter(
    (event) => event.kind !== "search",
  );
  return mergedTimeline.length > 0
    ? dedupeSlashemLocationTimelineEvents(
      mergedTimeline.sort(
        (left, right) => left.turn - right.turn || left.label.localeCompare(right.label),
      ),
      score,
    )
    : buildFallbackTopScoreTimeline(score);
}
