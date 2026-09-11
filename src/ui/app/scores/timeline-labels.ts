import {
  type TopScoreRecord,
  type TopScoreTimelineEvent
} from "../../../runtime/top-score-storage";
import type {
  TopScoreTimelineCluster,
  TopScoreTimelineDisplayEvent,
  TopScoreTimelineFilterId
} from "./types";
import {
  formatTopScoreInteger,
  resolveTopScoreAttributeValue
} from "./format";
import {
  resolveTopScoreTimelineEvents
} from "./timeline-events";

/** Timeline event and line labels and level resolution. */
export function formatTopScoreTimelineClusterTurnLabel(
  cluster: TopScoreTimelineCluster,
): string {
  if (cluster.turnStart === cluster.turnEnd) {
    return `Turn ${formatTopScoreInteger(cluster.turnStart)}`;
  }
  return `Turns ${formatTopScoreInteger(cluster.turnStart)}-${formatTopScoreInteger(cluster.turnEnd)}`;
}

export function formatTopScoreTimelineEventBadge(event: TopScoreTimelineEvent): string {
  switch (event.kind) {
    case "kill":
      return "Kill";
    case "gold":
      return "Gold";
    case "loot":
      return "Loot";
    case "location":
      return "Location";
    case "experience-level":
      return "Level";
    case "trap":
      return "Trap";
    case "escape":
      return "Escape";
    case "hidden-find":
      return "Hidden";
    case "search":
      return "Search";
    case "spell-learned":
      return "Spell";
    case "death":
      return "Ending";
    default:
      return "Moment";
  }
}

export function formatTopScoreTimelineEventMeta(event: TopScoreTimelineEvent): string {
  switch (event.kind) {
    case "gold": {
      const parts: string[] = [];
      if (typeof event.amount === "number" && Number.isFinite(event.amount)) {
        const amount = Math.trunc(event.amount);
        parts.push(`${amount > 0 ? "+" : ""}${amount} gold`);
      }
      if (typeof event.total === "number" && Number.isFinite(event.total)) {
        parts.push(`purse ${Math.trunc(event.total)}`);
      }
      return parts.join(" / ");
    }
    case "loot": {
      const parts: string[] = [];
      if (typeof event.amount === "number" && Number.isFinite(event.amount)) {
        parts.push(
          `${formatTopScoreInteger(Math.trunc(event.amount))} collected`,
        );
      }
      if (event.detail) {
        parts.push(event.detail);
      }
      return parts.join(" / ");
    }
    case "location":
      return event.location ?? "";
    case "experience-level": {
      const parts: string[] = [];
      if (typeof event.amount === "number" && Number.isFinite(event.amount)) {
        const amount = Math.trunc(event.amount);
        if (amount !== 0) {
          parts.push(
            `${amount > 0 ? "+" : ""}${amount} ${Math.abs(amount) === 1 ? "level" : "levels"}`,
          );
        }
      }
      if (typeof event.total === "number" && Number.isFinite(event.total)) {
        parts.push(`level ${Math.trunc(event.total)}`);
      }
      if (event.detail) {
        parts.push(event.detail);
      }
      return parts.join(" / ");
    }
    case "trap":
      return event.location ?? event.detail ?? "";
    case "escape":
      return event.location ?? event.detail ?? "";
    case "hidden-find":
      return event.location ?? event.detail ?? "";
    case "search":
      return event.location ?? "";
    case "spell-learned":
      return event.detail ?? event.location ?? "";
    case "death":
      return event.location ?? "";
    default:
      return event.detail ?? "";
  }
}

export function resolveTopScoreTimelineLineIncrement(
  filterId: TopScoreTimelineFilterId,
  event: TopScoreTimelineDisplayEvent,
): number {
  switch (filterId) {
    case "hazards":
    case "magic":
      return 1;
    case "kills": {
      const amount =
        typeof event.amount === "number" && Number.isFinite(event.amount)
          ? Math.trunc(event.amount)
          : 0;
      return amount > 0 ? amount : 1;
    }
    case "gold":
    case "loot":
    case "secrets": {
      const amount =
        typeof event.amount === "number" && Number.isFinite(event.amount)
          ? Math.trunc(event.amount)
          : 0;
      if (amount > 0) {
        return amount;
      }
      return filterId === "gold" ? 0 : 1;
    }
    default:
      return 0;
  }
}

export function resolveTopScoreTimelineLevelValue(
  event: TopScoreTimelineEvent,
): number | null {
  if (event.kind !== "experience-level") {
    return null;
  }
  if (typeof event.total === "number" && Number.isFinite(event.total)) {
    return Math.max(1, Math.trunc(event.total));
  }

  const levelText = [event.label, event.summary, event.detail]
    .filter(Boolean)
    .join(" ");
  const levelMatch = /\blevel\s+(-?\d+)\b/i.exec(levelText);
  if (!levelMatch) {
    return null;
  }
  const parsedLevel = Number.parseInt(levelMatch[1]!, 10);
  return Number.isFinite(parsedLevel) ? Math.max(1, parsedLevel) : null;
}

export function resolveTopScoreFinalCharacterLevel(score: TopScoreRecord): number | null {
  const snapshotLevel =
    typeof score.detail?.playerStats.level === "number" &&
      Number.isFinite(score.detail.playerStats.level)
      ? Math.trunc(score.detail.playerStats.level)
      : null;
  if (snapshotLevel !== null) {
    return Math.max(1, snapshotLevel);
  }

  const attributeLevel = Number.parseInt(
    resolveTopScoreAttributeValue(score, "Level"),
    10,
  );
  return Number.isFinite(attributeLevel) ? Math.max(1, attributeLevel) : null;
}

export function resolveTopScoreMaxCharacterLevel(
  score: TopScoreRecord,
  events = resolveTopScoreTimelineEvents(score),
): number | null {
  const levels = events
    .map((event) => resolveTopScoreTimelineLevelValue(event))
    .filter((level): level is number => level !== null);
  const finalLevel = resolveTopScoreFinalCharacterLevel(score);
  if (finalLevel !== null) {
    levels.push(finalLevel);
  }
  return levels.length > 0 ? Math.max(...levels) : null;
}

export function formatTopScoreTimelineLineSummary(
  filterId: TopScoreTimelineFilterId,
  value: number,
): string {
  switch (filterId) {
    case "kills":
      return `${formatTopScoreInteger(value)} defeated`;
    case "gold":
      return `${formatTopScoreInteger(value)} gathered`;
    case "loot":
      return `${formatTopScoreInteger(value)} picked up`;
    case "secrets":
      return `${formatTopScoreInteger(value)} found`;
    case "levels":
      return `peak level ${formatTopScoreInteger(value)}`;
    case "hazards":
      return `${formatTopScoreInteger(value)} triggered`;
    case "magic":
      return `${formatTopScoreInteger(value)} learned`;
    default:
      return `${formatTopScoreInteger(value)} logged`;
  }
}
