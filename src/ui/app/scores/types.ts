import type {
  RunTelemetryBreakdownEntry,
  RunTelemetryLootEvent
} from "../../../game/ui-types";
import {
  type TopScoreInventoryItem,
  type TopScoreTimelineEvent
} from "../../../runtime/top-score-storage";

/** Score card, report and timeline presentation contracts. */
export type TopScoreMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type TopScoreSortId = "date" | "score" | "depth" | "turns" | "kills";

export type TopScoreSortOption = {
  id: TopScoreSortId;
  label: string;
};

export type TopScoreChipGroup = {
  label: string;
  values: string[];
  emptyLabel: string;
};

export type TopScoreInventorySection = {
  title: string;
  items: TopScoreInventoryItem[];
};

export type TopScoreBreakdownGroup = {
  label: string;
  values: RunTelemetryBreakdownEntry[];
  emptyLabel: string;
};

export type TopScoreRawReportSection = {
  id: string;
  title: string;
  lines: string[] | null;
  emptyLabel: string;
};

export type TopScoreLootTimelineSection = {
  title: string;
  events: RunTelemetryLootEvent[];
};

export type TopScoreTimelineFilterId =
  | "kills"
  | "gold"
  | "loot"
  | "secrets"
  | "levels"
  | "hazards"
  | "magic"
  | "milestones";

export type TopScoreTimelineFilterConfig = {
  id: TopScoreTimelineFilterId;
  label: string;
  detail: string;
  color: string;
  tint: string;
  rowType: "line" | "markers";
};

export type TopScoreTimelineDisplayEvent = TopScoreTimelineEvent & {
  filterId: TopScoreTimelineFilterId;
};

export type TopScoreTimelinePoint = {
  x: number;
  y: number;
  turn: number;
  value: number;
  event: TopScoreTimelineDisplayEvent;
};

export type TopScoreTimelineCluster = {
  id: string;
  filterId: TopScoreTimelineFilterId;
  filterLabel: string;
  color: string;
  isLineAnchored: boolean;
  x: number;
  y: number;
  stackLevel: number;
  turnStart: number;
  turnEnd: number;
  events: TopScoreTimelineDisplayEvent[];
};

export type TopScoreTimelineSeries = {
  id: TopScoreTimelineFilterId;
  label: string;
  detail: string;
  color: string;
  tint: string;
  rowType: "line" | "markers";
  summaryValue: string;
  linePath?: string;
};

export type TopScoreTimelineModel = {
  width: number;
  height: number;
  leftPadding: number;
  rightPadding: number;
  topPadding: number;
  bottomPadding: number;
  plotTop: number;
  plotBottom: number;
  startTurn: number;
  endTurn: number;
  progressTicks: number[];
  series: TopScoreTimelineSeries[];
  ticks: number[];
  clusters: TopScoreTimelineCluster[];
};
