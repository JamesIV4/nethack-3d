import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type {
  TopScoreTimelineFilterId
} from "./types";
import {
  defaultTopScoreTimelineFilters,
  resolveTopScoreTimelineFilterId,
  topScoreTimelineFilterConfigs
} from "./timeline-filters";
import {
  resolveTopScoreTimelineEvents
} from "./timeline-events";
import {
  buildTopScoreTimelineSummaryMetrics
} from "./timeline-summary";
import {
  buildTopScoreTimelineModel
} from "./timeline-model";

export interface UseTopScoreTimelineViewDependencies {
  readonly selectedTopScore: TopScoreRecord | null;
}

/** Selected score timeline filters, chart model and focused cluster */
export function useTopScoreTimelineView(dependencies: UseTopScoreTimelineViewDependencies) {
  const {
    selectedTopScore,
  } = dependencies;

  const [selectedTopScoreTimelineFilters, setSelectedTopScoreTimelineFilters] =
    useState<TopScoreTimelineFilterId[]>(defaultTopScoreTimelineFilters);

  const [activeTopScoreTimelineClusterId, setActiveTopScoreTimelineClusterId] =
    useState<string | null>(null);

  const selectedTopScoreTimelineEvents = useMemo(
    () => (selectedTopScore ? resolveTopScoreTimelineEvents(selectedTopScore) : []),
    [selectedTopScore],
  );

  const selectedTopScoreTimelineFilterCounts = useMemo(() => {
    const counts: Record<TopScoreTimelineFilterId, number> = {
      kills: 0,
      gold: 0,
      loot: 0,
      secrets: 0,
      levels: 0,
      hazards: 0,
      magic: 0,
      milestones: 0,
    };
    for (const event of selectedTopScoreTimelineEvents) {
      counts[resolveTopScoreTimelineFilterId(event)] += 1;
    }
    return counts;
  }, [selectedTopScoreTimelineEvents]);

  const selectedTopScoreTimelineSummaryMetrics = useMemo(
    () =>
      selectedTopScore ? buildTopScoreTimelineSummaryMetrics(selectedTopScore) : [],
    [selectedTopScore],
  );

  const selectedTopScoreTimelineModel = useMemo(
    () => buildTopScoreTimelineModel(selectedTopScore, selectedTopScoreTimelineFilters),
    [selectedTopScore, selectedTopScoreTimelineFilters],
  );

  const activeTopScoreTimelineCluster = useMemo(() => {
    if (
      !selectedTopScoreTimelineModel ||
      selectedTopScoreTimelineModel.clusters.length <= 0
    ) {
      return null;
    }
    return (
      selectedTopScoreTimelineModel.clusters.find(
        (cluster) => cluster.id === activeTopScoreTimelineClusterId,
      ) ??
      selectedTopScoreTimelineModel.clusters[
      selectedTopScoreTimelineModel.clusters.length - 1
      ]
    );
  }, [activeTopScoreTimelineClusterId, selectedTopScoreTimelineModel]);

  useEffect(() => {
    setSelectedTopScoreTimelineFilters(defaultTopScoreTimelineFilters);
    setActiveTopScoreTimelineClusterId(null);
  }, [selectedTopScore?.id]);

  useEffect(() => {
    if (
      !selectedTopScoreTimelineModel ||
      selectedTopScoreTimelineModel.clusters.length <= 0
    ) {
      setActiveTopScoreTimelineClusterId(null);
      return;
    }
    setActiveTopScoreTimelineClusterId((current) =>
      current &&
        selectedTopScoreTimelineModel.clusters.some(
          (cluster) => cluster.id === current,
        )
        ? current
        : selectedTopScoreTimelineModel.clusters[
          selectedTopScoreTimelineModel.clusters.length - 1
        ]!.id,
    );
  }, [selectedTopScoreTimelineModel]);

  const toggleSelectedTopScoreTimelineFilter = useCallback(
    (filterId: TopScoreTimelineFilterId): void => {
      setSelectedTopScoreTimelineFilters((current) => {
        const isActive = current.includes(filterId);
        if (isActive && current.length <= 1) {
          return current;
        }
        const next = isActive
          ? current.filter((candidate) => candidate !== filterId)
          : [...current, filterId];
        return topScoreTimelineFilterConfigs.map((config) => config.id).filter((candidate) =>
          next.includes(candidate),
        );
      });
    },
    [],
  );
  return {
    selectedTopScoreTimelineFilters,
    setActiveTopScoreTimelineClusterId,
    selectedTopScoreTimelineFilterCounts,
    selectedTopScoreTimelineSummaryMetrics,
    selectedTopScoreTimelineModel,
    activeTopScoreTimelineCluster,
    toggleSelectedTopScoreTimelineFilter,
  } as const;
}
