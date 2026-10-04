import type { TopScoreTimelineEvent } from "./top-score-storage";

/** Prefer the native report; older snapshots and Slash'EM can use known visits. */
export function resolveArchivedDungeonOverview(
  report: readonly string[] | null | undefined,
  timeline: readonly TopScoreTimelineEvent[] = [],
): string[] | null {
  if (report?.some(line => line.trim())) return [...report];
  const seen = new Set<string>();
  const visits: string[] = [];
  for (const event of [...timeline].sort((a, b) => a.turn - b.turn)) {
    const location = event.location?.trim();
    if (!location || seen.has(location.toLowerCase())) continue;
    seen.add(location.toLowerCase());
    visits.push(`Turn ${event.turn}: ${location}`);
  }
  return visits.length ? [
    "Recorded dungeon visits",
    "From this run's timeline; the native dungeon overview was not available.",
    ...visits,
  ] : null;
}
