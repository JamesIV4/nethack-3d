import {
  Fragment,
  type CSSProperties
} from "react";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  type TopScoreInventoryItem,
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  TopScoreBreakdownGroup,
  TopScoreChipGroup,
  TopScoreInventorySection,
  TopScoreLootTimelineSection,
  TopScoreMetric,
  TopScoreRawReportSection,
  TopScoreTimelineCluster,
  TopScoreTimelineFilterId,
  TopScoreTimelineModel
} from "./types";
import {
  formatTopScoreCharacterLine,
  formatTopScoreInteger,
  formatTopScorePlayerName,
  formatTopScoreResultSummary
} from "./format";
import {
  resolveTopScoreTimelineFilterConfig,
  resolveTopScoreTimelineFilterId,
  topScoreTimelineFilterConfigs
} from "./timeline-filters";
import {
  formatTopScoreTimelineClusterTurnLabel,
  formatTopScoreTimelineEventBadge,
  formatTopScoreTimelineEventMeta
} from "./timeline-labels";
import {
  renderTopScoreRawReportBlock
} from "./report-content";
import {
  commonStrings
} from "../shared/translations";

export interface TopScoreDetailDialogProps {
  selectedTopScore: TopScoreRecord | null;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  setSelectedTopScore: React.Dispatch<React.SetStateAction<TopScoreRecord | null>>;
  selectedTopScoreCardMetrics: TopScoreMetric[];
  selectedTopScoreTimelineSummaryMetrics: TopScoreMetric[];
  selectedTopScoreTimelineModel: TopScoreTimelineModel | null;
  selectedTopScoreTimelineFilterCounts: Record<TopScoreTimelineFilterId, number>;
  selectedTopScoreTimelineFilters: TopScoreTimelineFilterId[];
  toggleSelectedTopScoreTimelineFilter: (filterId: TopScoreTimelineFilterId) => void;
  activeTopScoreTimelineCluster: TopScoreTimelineCluster | null;
  setActiveTopScoreTimelineClusterId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedTopScoreOverviewRows: [string, string][];
  selectedTopScoreAdventureMetrics: TopScoreMetric[];
  selectedTopScoreAttributeMetrics: TopScoreMetric[];
  selectedTopScoreChallengeGroups: TopScoreChipGroup[];
  selectedTopScoreKillBreakdownGroups: TopScoreBreakdownGroup[];
  selectedTopScoreLootTimelineSections: TopScoreLootTimelineSection[];
  selectedTopScoreInventorySections: TopScoreInventorySection[];
  renderTopScoreInventoryPreview: (item: TopScoreInventoryItem, runtimeVersion: NethackRuntimeVersion) => JSX.Element;
  selectedTopScoreFinalAttributesReport: TopScoreRawReportSection | null;
  selectedTopScorePostmortemReportSections: TopScoreRawReportSection[];
}

export function TopScoreDetailDialog({
  selectedTopScore,
  renderMobileDialogCloseButton,
  setSelectedTopScore,
  selectedTopScoreCardMetrics,
  selectedTopScoreTimelineSummaryMetrics,
  selectedTopScoreTimelineModel,
  selectedTopScoreTimelineFilterCounts,
  selectedTopScoreTimelineFilters,
  toggleSelectedTopScoreTimelineFilter,
  activeTopScoreTimelineCluster,
  setActiveTopScoreTimelineClusterId,
  selectedTopScoreOverviewRows,
  selectedTopScoreAdventureMetrics,
  selectedTopScoreAttributeMetrics,
  selectedTopScoreChallengeGroups,
  selectedTopScoreKillBreakdownGroups,
  selectedTopScoreLootTimelineSections,
  selectedTopScoreInventorySections,
  renderTopScoreInventoryPreview,
  selectedTopScoreFinalAttributesReport,
  selectedTopScorePostmortemReportSections,
}: TopScoreDetailDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-character nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-overflow-glow-frame nh3d-top-score-detail-dialog"
      open={Boolean(selectedTopScore)}
      id="nh3d-top-score-detail-dialog"
    >
      {selectedTopScore ? (
        <>
          {renderMobileDialogCloseButton(
            () => setSelectedTopScore(null),
            "Close top score details",
          )}
          <div
            className="nh3d-character-sheet-scroll"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <div className="nh3d-info-title">
              #{selectedTopScore.rank}{" "}
              {formatTopScorePlayerName(selectedTopScore)}
            </div>
            <div className="nh3d-top-score-hero">
              <div className="nh3d-top-score-hero-copy">
                <div className="nh3d-top-score-hero-score">
                  {formatTopScoreInteger(selectedTopScore.points)} points
                </div>
                <div className="nh3d-top-score-hero-archetype">
                  {formatTopScoreCharacterLine(selectedTopScore)}
                </div>
                <div className="nh3d-top-score-hero-summary">
                  {formatTopScoreResultSummary(selectedTopScore)}
                </div>
              </div>
            </div>
            <div className="nh3d-top-score-hero-stats">
              {selectedTopScoreCardMetrics.map((metric) => (
                <div
                  className="nh3d-top-score-hero-stat"
                  key={`top-score-hero-stat-${metric.label}`}
                >
                  <div className="nh3d-top-score-hero-stat-label">
                    {metric.label}
                  </div>
                  <div className="nh3d-top-score-hero-stat-value">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
            <section className="nh3d-character-panel nh3d-top-score-panel-wide nh3d-top-score-timeline-panel">
              <div className="nh3d-character-panel-title">Run Timeline</div>
              {selectedTopScoreTimelineSummaryMetrics.length > 0 ? (
                <div className="nh3d-top-score-timeline-summary-grid">
                  {selectedTopScoreTimelineSummaryMetrics.map((metric) => (
                    <div
                      className="nh3d-top-score-timeline-summary-card"
                      key={`top-score-timeline-summary-${metric.label}`}
                    >
                      <div className="nh3d-top-score-timeline-summary-label">
                        {metric.label}
                      </div>
                      <div className="nh3d-top-score-timeline-summary-value">
                        {metric.value}
                      </div>
                      {metric.detail ? (
                        <div className="nh3d-top-score-timeline-summary-detail">
                          {metric.detail}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {selectedTopScoreTimelineModel ? (
                <>
                  <div className="nh3d-top-score-timeline-toolbar">
                    <div className="nh3d-top-score-timeline-intro">
                      Filter the run by what mattered most.
                    </div>
                    <div className="nh3d-top-score-timeline-filters">
                      {topScoreTimelineFilterConfigs.map((filter) => {
                        const count =
                          selectedTopScoreTimelineFilterCounts[filter.id];
                        if (count <= 0) {
                          return null;
                        }
                        const isActive =
                          selectedTopScoreTimelineFilters.includes(filter.id);
                        return (
                          <button
                            className={`nh3d-top-score-timeline-filter${isActive ? " is-active" : ""
                              }`}
                            key={`top-score-timeline-filter-${filter.id}`}
                            onClick={() =>
                              toggleSelectedTopScoreTimelineFilter(filter.id)
                            }
                            style={
                              {
                                "--nh3d-top-score-timeline-color": filter.color,
                                "--nh3d-top-score-timeline-tint": filter.tint,
                              } as CSSProperties
                            }
                            type="button"
                          >
                            <span>{filter.label}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="nh3d-top-score-timeline-hint">
                    Lines show how each active thread of the run climbed over
                    time. Touch a cluster to unpack a busy stretch.
                  </div>
                  <div className="nh3d-top-score-timeline-viewport">
                    <div
                      className="nh3d-top-score-timeline-canvas"
                      style={{
                        width: `${selectedTopScoreTimelineModel.width}px`,
                        height: `${selectedTopScoreTimelineModel.height}px`,
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        className="nh3d-top-score-timeline-svg"
                        height={selectedTopScoreTimelineModel.height}
                        viewBox={`0 0 ${selectedTopScoreTimelineModel.width} ${selectedTopScoreTimelineModel.height}`}
                        width={selectedTopScoreTimelineModel.width}
                      >
                        <rect
                          className="nh3d-top-score-timeline-plot-frame"
                          height={
                            selectedTopScoreTimelineModel.plotBottom -
                            selectedTopScoreTimelineModel.plotTop
                          }
                          rx={14}
                          width={
                            selectedTopScoreTimelineModel.width -
                            selectedTopScoreTimelineModel.leftPadding -
                            selectedTopScoreTimelineModel.rightPadding
                          }
                          x={selectedTopScoreTimelineModel.leftPadding}
                          y={selectedTopScoreTimelineModel.plotTop}
                        />
                        {selectedTopScoreTimelineModel.progressTicks.map(
                          (progress) => {
                            const y =
                              selectedTopScoreTimelineModel.plotBottom -
                              progress *
                              (selectedTopScoreTimelineModel.plotBottom -
                                selectedTopScoreTimelineModel.plotTop);
                            return (
                              <Fragment
                                key={`top-score-timeline-progress-${progress}`}
                              >
                                <line
                                  className="nh3d-top-score-timeline-progress-line"
                                  x1={selectedTopScoreTimelineModel.leftPadding}
                                  x2={
                                    selectedTopScoreTimelineModel.width -
                                    selectedTopScoreTimelineModel.rightPadding
                                  }
                                  y1={y}
                                  y2={y}
                                />
                                <text
                                  className="nh3d-top-score-timeline-progress-label"
                                  x={16}
                                  y={y + 4}
                                >
                                  {`${Math.round(progress * 100)}%`}
                                </text>
                              </Fragment>
                            );
                          },
                        )}
                        {selectedTopScoreTimelineModel.ticks.map((tick) => {
                          const turnRange = Math.max(
                            1,
                            selectedTopScoreTimelineModel.endTurn -
                            selectedTopScoreTimelineModel.startTurn,
                          );
                          const plotWidth =
                            selectedTopScoreTimelineModel.width -
                            selectedTopScoreTimelineModel.leftPadding -
                            selectedTopScoreTimelineModel.rightPadding;
                          const x =
                            selectedTopScoreTimelineModel.leftPadding +
                            ((tick - selectedTopScoreTimelineModel.startTurn) /
                              turnRange) *
                            plotWidth;
                          return (
                            <Fragment key={`top-score-timeline-tick-${tick}`}>
                              <line
                                className="nh3d-top-score-timeline-tick-line"
                                x1={x}
                                x2={x}
                                y1={selectedTopScoreTimelineModel.plotTop}
                                y2={
                                  selectedTopScoreTimelineModel.height -
                                  selectedTopScoreTimelineModel.bottomPadding +
                                  8
                                }
                              />
                              <text
                                className="nh3d-top-score-timeline-tick-label"
                                textAnchor="middle"
                                x={x}
                                y={
                                  selectedTopScoreTimelineModel.height -
                                  selectedTopScoreTimelineModel.bottomPadding +
                                  26
                                }
                              >
                                {formatTopScoreInteger(tick)}
                              </text>
                            </Fragment>
                          );
                        })}
                        <text
                          className="nh3d-top-score-timeline-axis-caption"
                          textAnchor="end"
                          x={selectedTopScoreTimelineModel.width - 10}
                          y={
                            selectedTopScoreTimelineModel.height -
                            selectedTopScoreTimelineModel.bottomPadding +
                            44
                          }
                        >
                          Turns
                        </text>
                        {selectedTopScoreTimelineModel.clusters
                          .filter((cluster) => !cluster.isLineAnchored)
                          .map((cluster) => (
                            <line
                              className="nh3d-top-score-timeline-marker-guide"
                              key={`top-score-timeline-marker-guide-${cluster.id}`}
                              stroke={cluster.color}
                              x1={cluster.x}
                              x2={cluster.x}
                              y1={selectedTopScoreTimelineModel.plotTop}
                              y2={selectedTopScoreTimelineModel.plotBottom}
                            />
                          ))}
                        {selectedTopScoreTimelineModel.series.map((series) =>
                          series.linePath ? (
                            <Fragment key={`top-score-timeline-series-${series.id}`}>
                              <path
                                className="nh3d-top-score-timeline-line is-glow"
                                d={series.linePath}
                                stroke={series.color}
                              />
                              <path
                                className="nh3d-top-score-timeline-line"
                                d={series.linePath}
                                stroke={series.color}
                              />
                            </Fragment>
                          ) : null,
                        )}
                      </svg>
                      <div className="nh3d-top-score-timeline-marker-layer">
                        {selectedTopScoreTimelineModel.clusters.map((cluster) => (
                          <button
                            aria-label={`${cluster.filterLabel} at ${formatTopScoreTimelineClusterTurnLabel(cluster)}`}
                            className={`nh3d-top-score-timeline-marker${activeTopScoreTimelineCluster?.id === cluster.id
                              ? " is-active"
                              : ""
                              }`}
                            key={cluster.id}
                            onClick={() =>
                              setActiveTopScoreTimelineClusterId(cluster.id)
                            }
                            onFocus={() =>
                              setActiveTopScoreTimelineClusterId(cluster.id)
                            }
                            onMouseEnter={() =>
                              setActiveTopScoreTimelineClusterId(cluster.id)
                            }
                            style={
                              {
                                left: `${cluster.x}px`,
                                top: `${cluster.y}px`,
                                "--nh3d-top-score-timeline-color": cluster.color,
                              } as CSSProperties
                            }
                            type="button"
                          >
                            <span>
                              {cluster.events.length > 1
                                ? cluster.events.length
                                : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {activeTopScoreTimelineCluster ? (
                    <div className="nh3d-top-score-timeline-focus">
                      <div className="nh3d-top-score-timeline-focus-header">
                        <div>
                          <div className="nh3d-top-score-timeline-focus-eyebrow">
                            {activeTopScoreTimelineCluster.filterLabel}
                          </div>
                          <div className="nh3d-top-score-timeline-focus-turn">
                            {formatTopScoreTimelineClusterTurnLabel(
                              activeTopScoreTimelineCluster,
                            )}
                          </div>
                        </div>
                        {activeTopScoreTimelineCluster.events.length > 1 ? (
                          <div className="nh3d-top-score-timeline-focus-count">
                            {`${formatTopScoreInteger(activeTopScoreTimelineCluster.events.length)} moments`}
                          </div>
                        ) : null}
                      </div>
                      <div className="nh3d-top-score-timeline-focus-list">
                        {activeTopScoreTimelineCluster.events.map((event, index) => {
                          const filterConfig = resolveTopScoreTimelineFilterConfig(
                            resolveTopScoreTimelineFilterId(event),
                          );
                          const eventMeta = formatTopScoreTimelineEventMeta(event);
                          return (
                            <div
                              className="nh3d-top-score-timeline-focus-card"
                              key={`${activeTopScoreTimelineCluster.id}-${event.id}-${index}`}
                            >
                              <div className="nh3d-top-score-timeline-focus-card-header">
                                <span
                                  className="nh3d-top-score-timeline-focus-badge"
                                  style={
                                    {
                                      "--nh3d-top-score-timeline-color":
                                        filterConfig.color,
                                    } as CSSProperties
                                  }
                                >
                                  {formatTopScoreTimelineEventBadge(event)}
                                </span>
                                <span className="nh3d-top-score-timeline-focus-card-turn">
                                  Turn {formatTopScoreInteger(event.turn)}
                                </span>
                              </div>
                              <div className="nh3d-top-score-timeline-focus-card-title">
                                {event.label}
                              </div>
                              <div className="nh3d-top-score-timeline-focus-card-summary">
                                {event.summary}
                              </div>
                              {eventMeta ? (
                                <div className="nh3d-top-score-timeline-focus-card-meta">
                                  {eventMeta}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="nh3d-top-scores-empty">
                  This run was archived before turn-by-turn history was being
                  kept.
                </div>
              )}
            </section>
            <div className="nh3d-character-grid nh3d-top-score-detail-grid">
              <section className="nh3d-character-panel nh3d-top-score-summary-panel">
                <div className="nh3d-character-panel-title">Run Summary</div>
                <div className="nh3d-character-field-list">
                  {selectedTopScoreOverviewRows.map(([label, value]) => (
                    <div
                      className="nh3d-character-field-row"
                      key={`top-score-stat-${label}`}
                    >
                      <div className="nh3d-character-field-label">
                        {label}
                      </div>
                      <div className="nh3d-character-field-value-group">
                        <span className="nh3d-character-field-value">
                          {value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="nh3d-character-panel nh3d-top-score-final-panel">
                <div className="nh3d-character-panel-title">
                  Final Snapshot
                </div>
                {selectedTopScoreAdventureMetrics.length > 0 ? (
                  <div className="nh3d-character-stat-grid">
                    {selectedTopScoreAdventureMetrics.map((metric) => (
                      <div
                        className="nh3d-character-stat"
                        key={`top-score-adventure-${metric.label}`}
                      >
                        <div className="nh3d-character-stat-label">
                          {metric.label}
                        </div>
                        <div className="nh3d-character-stat-value">
                          <span className="nh3d-character-stat-current">
                            {metric.value}
                          </span>
                        </div>
                        {metric.detail ? (
                          <div className="nh3d-character-stat-description">
                            {metric.detail}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nh3d-top-scores-empty">
                    Only the archived score line was available for this run.
                  </div>
                )}
              </section>

              <section className="nh3d-character-panel nh3d-top-score-core-panel">
                <div className="nh3d-character-panel-title">Core Attributes</div>
                {selectedTopScoreAttributeMetrics.length > 0 ? (
                  <div className="nh3d-character-stat-grid nh3d-top-score-core-stat-grid">
                    {selectedTopScoreAttributeMetrics.map((metric) => (
                      <div
                        className="nh3d-character-stat"
                        key={`top-score-attribute-${metric.label}`}
                      >
                        <div className="nh3d-character-stat-label">
                          {metric.label}
                        </div>
                        <div className="nh3d-character-stat-value">
                          <span className="nh3d-character-stat-current">
                            {metric.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nh3d-top-scores-empty">
                    No core attribute snapshot was captured for this run.
                  </div>
                )}
              </section>

              <section className="nh3d-character-panel nh3d-top-score-challenge-panel">
                <div className="nh3d-character-panel-title">
                  Challenge Ledger
                </div>
                <div className="nh3d-top-score-chip-groups">
                  {selectedTopScoreChallengeGroups.map((group) => (
                    <div
                      className="nh3d-top-score-chip-group"
                      key={`top-score-group-${group.label}`}
                    >
                      <div className="nh3d-top-score-chip-group-title">
                        {group.label}
                      </div>
                      {group.values.length > 0 ? (
                        <div className="nh3d-character-chip-list">
                          {group.values.map((value) => (
                            <div
                              className="nh3d-character-chip"
                              key={`top-score-group-${group.label}-${value}`}
                            >
                              {value}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="nh3d-top-scores-empty">
                          {group.emptyLabel}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="nh3d-character-panel nh3d-top-score-panel-wide">
                <div className="nh3d-character-panel-title">
                  Battle Breakdown
                </div>
                <div className="nh3d-top-score-breakdown-grid">
                  {selectedTopScoreKillBreakdownGroups.map((group) => (
                    <div
                      className="nh3d-top-score-breakdown-group"
                      key={`top-score-breakdown-${group.label}`}
                    >
                      <div className="nh3d-top-score-breakdown-title">
                        {group.label}
                      </div>
                      {group.values.length > 0 ? (
                        <div className="nh3d-character-field-list">
                          {group.values.map((entry) => (
                            <div
                              className="nh3d-character-field-row"
                              key={`top-score-breakdown-${group.label}-${entry.label}`}
                            >
                              <div className="nh3d-character-field-label">
                                {entry.label}
                              </div>
                              <div className="nh3d-character-field-value-group">
                                <span className="nh3d-character-field-value">
                                  {formatTopScoreInteger(entry.count)}
                                </span>
                                {entry.detail ? (
                                  <span className="nh3d-character-field-detail">
                                    {entry.detail}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="nh3d-top-scores-empty">
                          {group.emptyLabel}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="nh3d-character-panel nh3d-top-score-panel-wide">
                <div className="nh3d-character-panel-title">Loot Trail</div>
                {selectedTopScoreLootTimelineSections.length > 0 ? (
                  <div className="nh3d-top-score-loot-sections">
                    {selectedTopScoreLootTimelineSections.map((section) => (
                      <div
                        className="nh3d-top-score-loot-section"
                        key={`top-score-loot-${section.title}`}
                      >
                        <div className="nh3d-top-score-loot-section-header">
                          <span>{section.title}</span>
                          <span>{section.events.length}</span>
                        </div>
                        <div className="nh3d-character-field-list">
                          {section.events.map((event) => (
                            <div
                              className="nh3d-character-field-row"
                              key={`top-score-loot-event-${event.id}`}
                            >
                              <div className="nh3d-character-field-label">
                                Turn {formatTopScoreInteger(event.turn)}
                              </div>
                              <div className="nh3d-character-field-value-group">
                                <span className="nh3d-character-field-value">
                                  {event.quantity === 1
                                    ? event.label
                                    : `${formatTopScoreInteger(event.quantity)} x ${event.label}`}
                                </span>
                                <span className="nh3d-character-field-detail">
                                  {event.location || event.detail || "Pack update"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nh3d-top-scores-empty">
                    No loot pickups were archived for this run.
                  </div>
                )}
              </section>

              <section className="nh3d-character-panel nh3d-top-score-panel-wide">
                <div className="nh3d-character-panel-title">Pack at the End</div>
                {selectedTopScoreInventorySections.length > 0 &&
                  selectedTopScore.detail ? (
                  <div className="nh3d-top-score-inventory-sections">
                    {selectedTopScoreInventorySections.map((section) => (
                      <div
                        className="nh3d-top-score-inventory-section"
                        key={`top-score-inventory-section-${section.title}`}
                      >
                        <div className="nh3d-top-score-inventory-section-header">
                          <span>{section.title}</span>
                          <span>{section.items.length}</span>
                        </div>
                        <div className="nh3d-top-score-inventory-grid">
                          {section.items.map((item, index) => (
                            <div
                              className="nh3d-top-score-inventory-card"
                              key={`${section.title}-${index}-${item.text}`}
                            >
                              <div className="nh3d-top-score-inventory-card-leading">
                                {renderTopScoreInventoryPreview(
                                  item,
                                  selectedTopScore.detail!.runtimeVersion,
                                )}
                                <span className="nh3d-top-score-inventory-key">
                                  {item.accelerator ?? "-"}
                                </span>
                              </div>
                              <div className="nh3d-top-score-inventory-card-text">
                                {item.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nh3d-top-scores-empty">
                    No inventory snapshot was captured for this run.
                  </div>
                )}
              </section>

              <section className="nh3d-character-panel nh3d-top-score-panel-wide">
                <div className="nh3d-character-panel-title">
                  Postmortem Archives
                </div>
                <div className="nh3d-top-score-postmortem-archives">
                  <div className="nh3d-top-score-postmortem-feature-row">
                    <div className="nh3d-top-score-report-block nh3d-top-score-tombstone-block">
                      <div className="nh3d-top-score-breakdown-title">
                        Tombstone
                      </div>
                      {selectedTopScore.detail?.tombstoneLines.length ? (
                        <pre className="nh3d-top-score-tombstone">
                          {selectedTopScore.detail.tombstoneLines.join("\n")}
                        </pre>
                      ) : (
                        <div className="nh3d-top-scores-empty">
                          No tombstone snapshot was archived for this run.
                        </div>
                      )}
                    </div>
                    {selectedTopScoreFinalAttributesReport
                      ? renderTopScoreRawReportBlock(
                        selectedTopScoreFinalAttributesReport,
                      )
                      : null}
                  </div>
                  <div className="nh3d-top-score-postmortem-report-grid">
                    {selectedTopScorePostmortemReportSections.map((section) =>
                      renderTopScoreRawReportBlock(section),
                    )}
                  </div>
                </div>
              </section>

            </div>
          </div>
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={() => setSelectedTopScore(null)}
              type="button"
            >
              {commonStrings.close}
            </button>
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
