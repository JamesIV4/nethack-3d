import {
  type TopScoreTimelineEvent
} from "../../../runtime/top-score-storage";
import type {
  TopScoreTimelineFilterConfig,
  TopScoreTimelineFilterId
} from "./types";

/** Timeline filter catalog and event-kind classification. */
export const topScoreTimelineFilterConfigs: readonly TopScoreTimelineFilterConfig[] = [
  {
    id: "kills",
    label: "Kills",
    detail: "Defeated enemies",
    color: "#ff8a8a",
    tint: "rgba(255, 138, 138, 0.18)",
    rowType: "line",
  },
  {
    id: "gold",
    label: "Gold",
    detail: "Gold gathered",
    color: "#f2d06f",
    tint: "rgba(242, 208, 111, 0.18)",
    rowType: "line",
  },
  {
    id: "loot",
    label: "Loot",
    detail: "Items picked up",
    color: "#8fe4c3",
    tint: "rgba(143, 228, 195, 0.18)",
    rowType: "line",
  },
  {
    id: "secrets",
    label: "Hidden Finds",
    detail: "Hidden doors, passages, and traps",
    color: "#c7b8ff",
    tint: "rgba(199, 184, 255, 0.18)",
    rowType: "line",
  },
  {
    id: "levels",
    label: "Level",
    detail: "Character level",
    color: "#9bd470",
    tint: "rgba(155, 212, 112, 0.18)",
    rowType: "line",
  },
  {
    id: "hazards",
    label: "Hazards",
    detail: "Traps and bad surprises",
    color: "#ffb17a",
    tint: "rgba(255, 177, 122, 0.18)",
    rowType: "line",
  },
  {
    id: "magic",
    label: "Magic",
    detail: "Spells learned",
    color: "#80e2ff",
    tint: "rgba(128, 226, 255, 0.18)",
    rowType: "line",
  },
  {
    id: "milestones",
    label: "Milestones",
    detail: "Places and the ending",
    color: "#7ec8ff",
    tint: "rgba(126, 200, 255, 0.18)",
    rowType: "markers",
  },
] as const;

export const defaultTopScoreTimelineFilters: TopScoreTimelineFilterId[] = [
  "kills",
  "gold",
  "loot",
  "secrets",
  "levels",
  "hazards",
  "milestones",
];

export function resolveTopScoreTimelineFilterId(
  event: TopScoreTimelineEvent,
): TopScoreTimelineFilterId {
  switch (event.kind) {
    case "kill":
      return "kills";
    case "gold":
      return "gold";
    case "loot":
      return "loot";
    case "hidden-find":
      return "secrets";
    case "experience-level":
      return "levels";
    case "trap":
      return "hazards";
    case "spell-learned":
      return "magic";
    default:
      return "milestones";
  }
}

export function resolveTopScoreTimelineFilterConfig(
  filterId: TopScoreTimelineFilterId,
): TopScoreTimelineFilterConfig {
  return (
    topScoreTimelineFilterConfigs.find((config) => config.id === filterId) ??
    topScoreTimelineFilterConfigs[0]
  );
}
