import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  fetchTopScores,
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type * as React from "react";
import type {
  TopScoreMetric,
  TopScoreSortId
} from "./types";
import {
  compareTopScoresBySort,
  topScoreSortOptions,
  topScoresPageSize
} from "./sorting";
import {
  formatTopScoreInteger,
  formatTopScorePlayerName,
  formatTopScoreShortDateTime
} from "./format";
import {
  buildTopScoreAdventureMetrics,
  buildTopScoreAttributeMetrics,
  buildTopScoreCardMetrics,
  buildTopScoreChallengeGroups,
  buildTopScoreOverviewRows
} from "./summary";
import {
  buildTopScoreKillBreakdownGroups,
  buildTopScoreRawReportSections,
  groupTopScoreInventoryItems,
  groupTopScoreLootTimelineEvents
} from "./report-content";

/** Score archive loading, sorting, pages and selected record */
export function useTopScoresState() {
  const [topScoresDialogRuntime, setTopScoresDialogRuntime] =
    useState<NethackRuntimeVersion | null>(null);

  const [topScores, setTopScores] = useState<TopScoreRecord[]>([]);

  const [topScoresLoading, setTopScoresLoading] = useState(false);

  const [topScoresError, setTopScoresError] = useState("");

  const [topScoresPageIndex, setTopScoresPageIndex] = useState(0);

  const [topScoresSortId, setTopScoresSortId] =
    useState<TopScoreSortId>("score");

  const [topScoresSortMenuOpen, setTopScoresSortMenuOpen] = useState(false);

  const [selectedTopScore, setSelectedTopScore] =
    useState<TopScoreRecord | null>(null);
  return {
    topScoresDialogRuntime,
    setTopScoresDialogRuntime,
    topScores,
    setTopScores,
    topScoresLoading,
    setTopScoresLoading,
    topScoresError,
    setTopScoresError,
    topScoresPageIndex,
    setTopScoresPageIndex,
    topScoresSortId,
    setTopScoresSortId,
    topScoresSortMenuOpen,
    setTopScoresSortMenuOpen,
    selectedTopScore,
    setSelectedTopScore,
  } as const;
}

export interface UseTopScoresViewDependencies {
  readonly topScores: TopScoreRecord[];
  readonly topScoresSortId: TopScoreSortId;
  readonly topScoresDialogRuntime: NethackRuntimeVersion | null;
  readonly topScoresLoading: boolean;
  readonly setTopScoresSortMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  readonly topScoresPageIndex: number;
  readonly selectedTopScore: TopScoreRecord | null;
}

/** Score archive loading, sorting, pages and selected record */
export function useTopScoresView(dependencies: UseTopScoresViewDependencies) {
  const {
    topScores,
    topScoresSortId,
    topScoresDialogRuntime,
    topScoresLoading,
    setTopScoresSortMenuOpen,
    topScoresPageIndex,
    selectedTopScore,
  } = dependencies;

  const sortedTopScores = useMemo(
    () =>
      [...topScores].sort((left, right) =>
        compareTopScoresBySort(left, right, topScoresSortId),
      ),
    [topScores, topScoresSortId],
  );

  const selectedTopScoreSortOption =
    topScoreSortOptions.find((option) => option.id === topScoresSortId) ??
    topScoreSortOptions[1]!;

  useEffect(() => {
    if (!topScoresDialogRuntime || topScoresLoading || topScores.length <= 1) {
      setTopScoresSortMenuOpen(false);
    }
  }, [topScores.length, topScoresDialogRuntime, topScoresLoading]);

  const topScoresPageCount = useMemo(
    () => Math.max(1, Math.ceil(sortedTopScores.length / topScoresPageSize)),
    [sortedTopScores.length],
  );

  const topScoresCurrentPageIndex = Math.max(
    0,
    Math.min(topScoresPageIndex, topScoresPageCount - 1),
  );

  const visibleTopScores = useMemo(() => {
    return sortedTopScores.slice(
      topScoresCurrentPageIndex * topScoresPageSize,
      topScoresCurrentPageIndex * topScoresPageSize + topScoresPageSize,
    );
  }, [sortedTopScores, topScoresCurrentPageIndex]);

  const topScoresSummaryStats = useMemo(() => {
    if (topScores.length <= 0) {
      return [] as TopScoreMetric[];
    }

    const latestScore = topScores.reduce((latest, candidate) => {
      const latestTime = Date.parse(
        latest.endtime || latest.deathdate || latest.detail?.capturedAtIso || "",
      );
      const candidateTime = Date.parse(
        candidate.endtime ||
        candidate.deathdate ||
        candidate.detail?.capturedAtIso ||
        "",
      );
      if (!Number.isFinite(candidateTime)) {
        return latest;
      }
      if (!Number.isFinite(latestTime) || candidateTime > latestTime) {
        return candidate;
      }
      return latest;
    }, topScores[0]);

    const snapshotCount = topScores.filter((score) => Boolean(score.detail)).length;
    return [
      {
        label: "Recorded runs",
        value: formatTopScoreInteger(topScores.length),
        detail:
          topScores.length === 1
            ? "One name in the ledger"
            : "Names in the ledger",
      },
      {
        label: "Best score",
        value: formatTopScoreInteger(topScores[0]?.points),
        detail: formatTopScorePlayerName(topScores[0]),
      },
      {
        label: "Latest entry",
        value: formatTopScoreShortDateTime(
          latestScore.endtime ||
          latestScore.deathdate ||
          latestScore.detail?.capturedAtIso,
        ),
        detail: formatTopScorePlayerName(latestScore),
      },
      {
        label: "Snapshots",
        value: formatTopScoreInteger(snapshotCount),
        detail:
          snapshotCount === 1
            ? "final build saved"
            : "final builds saved",
      },
    ] satisfies TopScoreMetric[];
  }, [topScores]);

  const selectedTopScoreOverviewRows = useMemo(
    () => (selectedTopScore ? buildTopScoreOverviewRows(selectedTopScore) : []),
    [selectedTopScore],
  );

  const selectedTopScoreCardMetrics = useMemo(
    () => (selectedTopScore ? buildTopScoreCardMetrics(selectedTopScore) : []),
    [selectedTopScore],
  );

  const selectedTopScoreAdventureMetrics = useMemo(
    () =>
      selectedTopScore ? buildTopScoreAdventureMetrics(selectedTopScore) : [],
    [selectedTopScore],
  );

  const selectedTopScoreAttributeMetrics = useMemo(
    () =>
      selectedTopScore ? buildTopScoreAttributeMetrics(selectedTopScore) : [],
    [selectedTopScore],
  );

  const selectedTopScoreChallengeGroups = useMemo(
    () => (selectedTopScore ? buildTopScoreChallengeGroups(selectedTopScore) : []),
    [selectedTopScore],
  );

  const selectedTopScoreKillBreakdownGroups = useMemo(
    () => (selectedTopScore ? buildTopScoreKillBreakdownGroups(selectedTopScore) : []),
    [selectedTopScore],
  );

  const selectedTopScoreLootTimelineSections = useMemo(
    () => (selectedTopScore ? groupTopScoreLootTimelineEvents(selectedTopScore) : []),
    [selectedTopScore],
  );

  const selectedTopScoreRawReportSections = useMemo(
    () => (selectedTopScore ? buildTopScoreRawReportSections(selectedTopScore) : []),
    [selectedTopScore],
  );

  const selectedTopScoreFinalAttributesReport = useMemo(
    () =>
      selectedTopScoreRawReportSections.find(
        (section) => section.id === "attributes",
      ) ?? null,
    [selectedTopScoreRawReportSections],
  );

  const selectedTopScorePostmortemReportSections = useMemo(
    () =>
      selectedTopScoreRawReportSections.filter(
        (section) => section.id !== "attributes",
      ),
    [selectedTopScoreRawReportSections],
  );

  const selectedTopScoreInventorySections = useMemo(
    () =>
      selectedTopScore?.detail
        ? groupTopScoreInventoryItems(selectedTopScore.detail.inventory)
        : [],
    [selectedTopScore],
  );
  return {
    selectedTopScoreSortOption,
    topScoresPageCount,
    topScoresCurrentPageIndex,
    visibleTopScores,
    topScoresSummaryStats,
    selectedTopScoreOverviewRows,
    selectedTopScoreCardMetrics,
    selectedTopScoreAdventureMetrics,
    selectedTopScoreAttributeMetrics,
    selectedTopScoreChallengeGroups,
    selectedTopScoreKillBreakdownGroups,
    selectedTopScoreLootTimelineSections,
    selectedTopScoreFinalAttributesReport,
    selectedTopScorePostmortemReportSections,
    selectedTopScoreInventorySections,
  } as const;
}

export interface UseTopScoresActionsDependencies {
  readonly setTopScoresLoading: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setTopScoresError: React.Dispatch<React.SetStateAction<string>>;
  readonly setTopScores: React.Dispatch<React.SetStateAction<TopScoreRecord[]>>;
  readonly setTopScoresPageIndex: React.Dispatch<React.SetStateAction<number>>;
  readonly runtimeVersion: NethackRuntimeVersion;
  readonly setTopScoresDialogRuntime: React.Dispatch<React.SetStateAction<NethackRuntimeVersion | null>>;
  readonly setSelectedTopScore: React.Dispatch<React.SetStateAction<TopScoreRecord | null>>;
}

/** Score archive loading, sorting, pages and selected record */
export function useTopScoresActions(dependencies: UseTopScoresActionsDependencies) {
  const {
    setTopScoresLoading,
    setTopScoresError,
    setTopScores,
    setTopScoresPageIndex,
    runtimeVersion,
    setTopScoresDialogRuntime,
    setSelectedTopScore,
  } = dependencies;

  const loadTopScoresForRuntime = useCallback(
    async (targetRuntimeVersion: NethackRuntimeVersion): Promise<void> => {
      setTopScoresLoading(true);
      setTopScoresError("");
      try {
        const scores = await fetchTopScores(targetRuntimeVersion);
        setTopScores(scores);
        setTopScoresPageIndex(0);
      } catch (error) {
        console.error("Failed to load top scores:", error);
        setTopScores([]);
        setTopScoresError(
          error instanceof Error
            ? error.message
            : "Unable to load top scores.",
        );
      } finally {
        setTopScoresLoading(false);
      }
    },
    [],
  );

  const openTopScoresDialog = useCallback((): void => {
    const targetRuntimeVersion = runtimeVersion;
    setTopScoresDialogRuntime(targetRuntimeVersion);
    setSelectedTopScore(null);
    void loadTopScoresForRuntime(targetRuntimeVersion);
  }, [loadTopScoresForRuntime, runtimeVersion]);

  const closeTopScoresDialog = useCallback((): void => {
    setTopScoresDialogRuntime(null);
    setSelectedTopScore(null);
  }, []);
  return {
    loadTopScoresForRuntime,
    openTopScoresDialog,
    closeTopScoresDialog,
  } as const;
}
