import type {
  RunTelemetryLootEvent
} from "../../../game/ui-types";
import {
  createEmptyGameOverPostmortemReports
} from "../../../game/ui-types";
import {
  type TopScoreInventoryItem,
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import type {
  TopScoreBreakdownGroup,
  TopScoreInventorySection,
  TopScoreLootTimelineSection,
  TopScoreRawReportSection
} from "./types";
import {
  resolveTopScoreTelemetry
} from "./timeline-events";
import {
  formatTopScoreInteger
} from "./format";

/** Score inventory, kill breakdown, loot grouping and raw report rendering. */
export function resolveTopScoreInventoryFallbackGlyph(
  item: TopScoreInventoryItem,
  fallback = "?",
): string {
  const glyphCandidate =
    typeof item.glyphChar === "string" ? item.glyphChar.trim() : "";
  const glyphCodePoint = glyphCandidate.codePointAt(0);
  if (
    typeof glyphCodePoint === "number" &&
    glyphCodePoint >= 32 &&
    glyphCodePoint !== 127
  ) {
    return glyphCandidate.charAt(0);
  }
  const accelerator =
    typeof item.accelerator === "string" ? item.accelerator.trim() : "";
  if (accelerator.length > 0) {
    return accelerator.charAt(0);
  }
  return fallback;
}

export function groupTopScoreInventoryItems(
  inventory: ReadonlyArray<TopScoreInventoryItem>,
): TopScoreInventorySection[] {
  if (!Array.isArray(inventory) || inventory.length <= 0) {
    return [];
  }

  const sections: TopScoreInventorySection[] = [];
  let currentSection: TopScoreInventorySection = {
    title: "Pack",
    items: [],
  };

  const pushCurrentSection = (): void => {
    if (currentSection.items.length <= 0) {
      return;
    }
    sections.push(currentSection);
  };

  for (const item of inventory) {
    if (item.isCategory) {
      pushCurrentSection();
      currentSection = {
        title: item.text || "Pack",
        items: [],
      };
      continue;
    }
    currentSection.items.push(item);
  }

  pushCurrentSection();
  return sections;
}

export function buildTopScoreKillBreakdownGroups(
  score: TopScoreRecord,
): TopScoreBreakdownGroup[] {
  const telemetry = resolveTopScoreTelemetry(score);
  return [
    {
      label: "Kills by weapon",
      values: telemetry.weaponKills,
      emptyLabel: "No weapon-attributed kills were tracked for this run.",
    },
    {
      label: "Kills by spell",
      values: telemetry.spellKills,
      emptyLabel: "No spell-attributed kills were tracked for this run.",
    },
    {
      label: "Kills by pet",
      values: telemetry.petKills,
      emptyLabel: "No pet-attributed kills were tracked for this run.",
    },
  ];
}

export function groupTopScoreLootTimelineEvents(
  score: TopScoreRecord,
): TopScoreLootTimelineSection[] {
  const telemetry = resolveTopScoreTelemetry(score);
  if (telemetry.lootEvents.length <= 0) {
    return [];
  }
  const sections = new Map<string, RunTelemetryLootEvent[]>();
  for (const event of telemetry.lootEvents) {
    const title = String(event.category || "Pack").trim() || "Pack";
    const existing = sections.get(title) ?? [];
    existing.push(event);
    sections.set(title, existing);
  }
  return Array.from(sections.entries())
    .map(([title, events]) => ({
      title,
      events: [...events].sort((left, right) => left.turn - right.turn),
    }))
    .sort(
      (left, right) =>
        right.events.length - left.events.length ||
        left.title.localeCompare(right.title),
    );
}

export function buildTopScoreRawReportSections(
  score: TopScoreRecord,
): TopScoreRawReportSection[] {
  const reports =
    score.detail?.postmortemReports ?? createEmptyGameOverPostmortemReports();
  return [
    {
      id: "attributes",
      title: "Final attributes",
      lines: reports.attributes,
      emptyLabel: "No final-attributes report was archived for this run.",
    },
    {
      id: "vanquished",
      title: "Creatures vanquished",
      lines: reports.vanquished,
      emptyLabel: "No vanquished-creatures report was archived for this run.",
    },
    {
      id: "conduct",
      title: "Conduct",
      lines: reports.conduct,
      emptyLabel: "No conduct report was archived for this run.",
    },
    {
      id: "dungeon-overview",
      title: "Dungeon overview",
      lines: reports.dungeonOverview,
      emptyLabel: "No dungeon-overview report was archived for this run.",
    },
  ];
}

export function renderTopScoreRawReportBlock(
  section: TopScoreRawReportSection,
): JSX.Element {
  return (
    <details
      className="nh3d-top-score-report-block"
      key={`top-score-report-${section.id}`}
      open={Boolean(section.lines?.length)}
    >
      <summary className="nh3d-top-score-report-summary">
        <span>{section.title}</span>
        <span>
          {section.lines?.length
            ? `${formatTopScoreInteger(section.lines.length)} lines`
            : "Not captured"}
        </span>
      </summary>
      {section.lines?.length ? (
        <pre className="nh3d-top-score-report-pre">
          {section.lines.join("\n")}
        </pre>
      ) : (
        <div className="nh3d-top-scores-empty">{section.emptyLabel}</div>
      )}
    </details>
  );
}
