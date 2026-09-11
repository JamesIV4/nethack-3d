import {
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type {
  TopScoreTimelineDisplayEvent,
  TopScoreTimelineFilterId,
  TopScoreTimelineModel,
  TopScoreTimelinePoint,
  TopScoreTimelineSeries
} from "./types";
import {
  resolveTopScoreTimelineEvents
} from "./timeline-events";
import {
  resolveTopScoreTimelineFilterId,
  topScoreTimelineFilterConfigs
} from "./timeline-filters";
import {
  normalizeTopScoreTimelineTurn
} from "./live-timeline";
import {
  formatTopScoreTimelineLineSummary,
  resolveTopScoreTimelineLevelValue,
  resolveTopScoreTimelineLineIncrement
} from "./timeline-labels";
import {
  buildTopScoreTimelineClusters,
  buildTopScoreTimelineStepPath,
  buildTopScoreTimelineTicks,
  layoutTopScoreTimelineBottomClusters
} from "./timeline-geometry";
import {
  formatTopScoreInteger
} from "./format";

/** Timeline chart model assembly. */
export function buildTopScoreTimelineModel(
  score: TopScoreRecord | null,
  activeFilters: ReadonlyArray<TopScoreTimelineFilterId>,
): TopScoreTimelineModel | null {
  if (!score) {
    return null;
  }

  const allEvents = resolveTopScoreTimelineEvents(score)
    .filter(
      (event) =>
        typeof event.turn === "number" &&
        Number.isFinite(event.turn) &&
        event.turn >= 0,
    )
    .map<TopScoreTimelineDisplayEvent>((event) => ({
      ...event,
      filterId: resolveTopScoreTimelineFilterId(event),
    }));
  if (allEvents.length <= 0) {
    return null;
  }

  const endTurn = Math.max(
    1,
    normalizeTopScoreTimelineTurn(score.turns),
    ...allEvents.map((event) => event.turn),
  );
  const startTurn = 1;
  const rowConfigs = topScoreTimelineFilterConfigs.filter(
    (config) =>
      activeFilters.includes(config.id) &&
      allEvents.some((event) => event.filterId === config.id),
  );
  if (rowConfigs.length <= 0) {
    return null;
  }

  const leftPadding = 64;
  const rightPadding = 26;
  const topPadding = 20;
  const bottomPadding = 54;
  const plotTop = topPadding;
  const linePlotHeight = 236;
  const plotBottom = plotTop + linePlotHeight;
  const clusterMarkerSize = 22;
  const clusterMarkerSpacing = 28;
  const bottomMarkerY = plotBottom - clusterMarkerSize / 2;
  const topMarkerY = plotTop + clusterMarkerSize / 2;
  const plotWidth = Math.max(
    620,
    Math.min(2800, 640 + endTurn * 2 + allEvents.length * 22),
  );
  const width = leftPadding + rightPadding + plotWidth;
  const turnRange = Math.max(1, endTurn - startTurn);
  const toX = (turn: number): number =>
    leftPadding +
    ((Math.max(startTurn, Math.min(endTurn, turn)) - startTurn) / turnRange) *
    plotWidth;
  const turnBucketSize = Math.max(1, Math.ceil(endTurn / 48));

  const eventsByFilter = new Map<
    TopScoreTimelineFilterId,
    TopScoreTimelineDisplayEvent[]
  >();
  for (const config of rowConfigs) {
    eventsByFilter.set(
      config.id,
      allEvents
        .filter((event) => event.filterId === config.id)
        .sort(
          (left, right) =>
            left.turn - right.turn || left.label.localeCompare(right.label),
        ),
    );
  }

  const eventYByEvent = new Map<TopScoreTimelineDisplayEvent, number>();
  const series = rowConfigs.map<TopScoreTimelineSeries>((config) => {
    const rowEvents = eventsByFilter.get(config.id) ?? [];
    const seriesBase: TopScoreTimelineSeries = {
      id: config.id,
      label: config.label,
      detail: config.detail,
      color: config.color,
      tint: config.tint,
      rowType: config.rowType,
      summaryValue: "",
    };

    if (config.rowType === "line") {
      if (config.id === "levels") {
        const actualPoints = rowEvents.reduce<TopScoreTimelinePoint[]>(
          (points, event) => {
            const levelValue = resolveTopScoreTimelineLevelValue(event);
            if (levelValue === null) {
              return points;
            }
            points.push({
              x: 0,
              y: 0,
              turn: event.turn,
              value: levelValue,
              event,
            });
            return points;
          },
          [],
        );
        if (actualPoints.length <= 0) {
          seriesBase.summaryValue = "no level changes";
          return seriesBase;
        }

        const firstPoint = actualPoints[0]!;
        const firstDelta =
          typeof firstPoint.event.amount === "number" &&
            Number.isFinite(firstPoint.event.amount)
            ? Math.trunc(firstPoint.event.amount)
            : 0;
        const startValue =
          firstDelta === 0
            ? 1
            : Math.max(1, firstPoint.value - firstDelta);
        const minValue = Math.min(
          startValue,
          ...actualPoints.map((point) => point.value),
        );
        const maxValue = Math.max(
          startValue,
          ...actualPoints.map((point) => point.value),
        );
        const verticalRange = Math.max(20, plotBottom - plotTop);
        const resolveY = (value: number): number =>
          maxValue <= minValue
            ? plotBottom
            : plotBottom -
            ((value - minValue) / (maxValue - minValue)) * verticalRange;
        const pathPoints: Array<{ x: number; y: number }> = [
          { x: leftPadding, y: resolveY(startValue) },
        ];

        for (const point of actualPoints) {
          point.x = toX(point.turn);
          point.y = resolveY(point.value);
          eventYByEvent.set(point.event, point.y);
          const previousPoint = pathPoints[pathPoints.length - 1];
          if (previousPoint.x !== point.x) {
            pathPoints.push({ x: point.x, y: previousPoint.y });
          }
          pathPoints.push({ x: point.x, y: point.y });
        }

        const endX = toX(endTurn);
        const previousPoint = pathPoints[pathPoints.length - 1];
        if (previousPoint.x !== endX) {
          pathPoints.push({ x: endX, y: previousPoint.y });
        }

        seriesBase.summaryValue = formatTopScoreTimelineLineSummary(
          config.id,
          maxValue,
        );
        seriesBase.linePath = buildTopScoreTimelineStepPath(pathPoints);
        return seriesBase;
      }

      const actualPoints: TopScoreTimelinePoint[] = [];
      let runningValue = 0;
      for (const event of rowEvents) {
        runningValue += resolveTopScoreTimelineLineIncrement(config.id, event);
        actualPoints.push({
          x: 0,
          y: 0,
          turn: event.turn,
          value: runningValue,
          event,
        });
      }
      const maxValue =
        actualPoints.length > 0 ? actualPoints[actualPoints.length - 1].value : 0;
      const verticalRange = Math.max(20, plotBottom - plotTop);
      const resolveY = (value: number): number =>
        maxValue <= 0
          ? plotBottom
          : plotBottom - (value / maxValue) * verticalRange;

      const pathPoints: Array<{ x: number; y: number }> = [
        { x: leftPadding, y: resolveY(0) },
      ];
      for (const point of actualPoints) {
        point.x = toX(point.turn);
        point.y = resolveY(point.value);
        eventYByEvent.set(point.event, point.y);
        const previousPoint = pathPoints[pathPoints.length - 1];
        if (previousPoint.x !== point.x) {
          pathPoints.push({ x: point.x, y: previousPoint.y });
        }
        pathPoints.push({ x: point.x, y: point.y });
      }
      const endX = toX(endTurn);
      const previousPoint = pathPoints[pathPoints.length - 1];
      if (previousPoint.x !== endX) {
        pathPoints.push({ x: endX, y: previousPoint.y });
      }

      seriesBase.summaryValue = formatTopScoreTimelineLineSummary(
        config.id,
        runningValue,
      );
      seriesBase.linePath = buildTopScoreTimelineStepPath(pathPoints);
      return seriesBase;
    }

    for (const event of rowEvents) {
      eventYByEvent.set(event, bottomMarkerY);
    }
    seriesBase.summaryValue =
      rowEvents.length === 1
        ? "one marked moment"
        : `${formatTopScoreInteger(rowEvents.length)} marked moments`;
    return seriesBase;
  });

  const provisionalClusters = rowConfigs.flatMap((config) =>
    buildTopScoreTimelineClusters(
      config,
      eventsByFilter.get(config.id) ?? [],
      toX,
      (event) => eventYByEvent.get(event) ?? bottomMarkerY,
      turnBucketSize,
    ),
  );
  const stackedBottomClusters = layoutTopScoreTimelineBottomClusters(
    provisionalClusters.filter((cluster) => !cluster.isLineAnchored),
    bottomMarkerY,
    clusterMarkerSpacing,
    clusterMarkerSize + 8,
    topMarkerY,
  );
  const lineClusters = provisionalClusters.filter(
    (cluster) => cluster.isLineAnchored,
  );
  const clusters = [...lineClusters, ...stackedBottomClusters].sort(
    (left, right) =>
      left.x - right.x ||
      left.turnStart - right.turnStart ||
      left.filterLabel.localeCompare(right.filterLabel),
  );

  return {
    width,
    height: plotBottom + bottomPadding,
    leftPadding,
    rightPadding,
    topPadding,
    bottomPadding,
    plotTop,
    plotBottom,
    startTurn,
    endTurn,
    progressTicks: [0, 0.25, 0.5, 0.75, 1],
    series,
    ticks: buildTopScoreTimelineTicks(startTurn, endTurn),
    clusters,
  };
}
