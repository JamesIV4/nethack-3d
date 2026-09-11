import type {
  TopScoreTimelineCluster,
  TopScoreTimelineDisplayEvent,
  TopScoreTimelineFilterConfig
} from "./types";

/** Timeline tick, path, clustering and lane geometry. */
export function buildTopScoreTimelineTicks(startTurn: number, endTurn: number): number[] {
  if (endTurn <= startTurn) {
    return [startTurn];
  }

  const range = endTurn - startTurn;
  const roughStep = Math.max(1, range / 5);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const stepMultiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = stepMultiplier * magnitude;
  const ticks = [startTurn];
  let nextTick = Math.ceil((startTurn + step) / step) * step;
  while (nextTick < endTurn) {
    ticks.push(nextTick);
    nextTick += step;
  }
  if (ticks[ticks.length - 1] !== endTurn) {
    ticks.push(endTurn);
  }
  return ticks;
}

export function buildTopScoreTimelineStepPath(
  points: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (points.length <= 0) {
    return "";
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    path += ` L ${points[index].x} ${points[index].y}`;
  }
  return path;
}

export function buildTopScoreTimelineClusters(
  filter: TopScoreTimelineFilterConfig,
  events: ReadonlyArray<TopScoreTimelineDisplayEvent>,
  toX: (turn: number) => number,
  resolveY: (event: TopScoreTimelineDisplayEvent) => number,
  turnBucketSize: number,
): TopScoreTimelineCluster[] {
  if (events.length <= 0) {
    return [];
  }

  const clusters: TopScoreTimelineCluster[] = [];
  for (const event of events) {
    const x = toX(event.turn);
    const y = resolveY(event);
    const previousCluster =
      clusters.length > 0 ? clusters[clusters.length - 1] : null;
    if (
      previousCluster &&
      event.turn - previousCluster.turnEnd <= turnBucketSize
    ) {
      const previousEventCount = previousCluster.events.length;
      previousCluster.turnEnd = event.turn;
      if (filter.rowType === "line") {
        previousCluster.x = x;
        previousCluster.y = y;
      } else {
        previousCluster.x =
          (previousCluster.x * previousEventCount + x) /
          (previousEventCount + 1);
      }
      previousCluster.events.push(event);
      continue;
    }

    clusters.push({
      id: `${filter.id}-${event.turn}-${clusters.length}`,
      filterId: filter.id,
      filterLabel: filter.label,
      color: filter.color,
      isLineAnchored: filter.rowType === "line",
      x,
      y,
      stackLevel: 0,
      turnStart: event.turn,
      turnEnd: event.turn,
      events: [event],
    });
  }

  return clusters;
}

export function layoutTopScoreTimelineBottomClusters(
  clusters: ReadonlyArray<TopScoreTimelineCluster>,
  bottomMarkerY: number,
  markerStackGap: number,
  minClusterSeparation: number,
  minMarkerY: number,
): TopScoreTimelineCluster[] {
  if (clusters.length <= 0) {
    return [];
  }

  const laneEndX: number[] = [];
  return [...clusters]
    .sort(
      (left, right) =>
        left.x - right.x ||
        left.turnStart - right.turnStart ||
        left.filterLabel.localeCompare(right.filterLabel),
    )
    .map((cluster) => {
      let stackLevel = 0;
      while (
        stackLevel < laneEndX.length &&
        cluster.x - laneEndX[stackLevel]! < minClusterSeparation
      ) {
        stackLevel += 1;
      }
      laneEndX[stackLevel] = cluster.x;
      return {
        ...cluster,
        stackLevel,
        y: Math.max(minMarkerY, bottomMarkerY - stackLevel * markerStackGap),
      };
    });
}
