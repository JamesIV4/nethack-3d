import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  type TopScoreRecord
} from "../../../runtime/top-score-storage";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  TopScoreMetric,
  TopScoreSortId,
  TopScoreSortOption
} from "./types";
import {
  RuntimeVersionBadge,
  resolveRuntimeVersionDisplayLabel
} from "../startup/RuntimeVersionBadge";
import {
  topScoreSortOptions
} from "./sorting";
import {
  buildTopScoreCardMetrics,
  buildTopScorePreviewLabels
} from "./summary";
import {
  formatTopScoreCharacterLine,
  formatTopScoreInteger,
  formatTopScorePlayerName,
  formatTopScoreResultSummary,
  formatTopScoreSnapshotStatus
} from "./format";
import {
  commonStrings
} from "../shared/translations";

export interface TopScoresDialogProps {
  startupInitialLoadingVisible: boolean;
  topScoresDialogRuntime: NethackRuntimeVersion | null;
  handleStartupMainMenuBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleStartupMainMenuChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleStartupMainMenuKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleStartupMainMenuPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  closeTopScoresDialog: () => void;
  topScoresSummaryStats: TopScoreMetric[];
  topScoresLoading: boolean;
  setTopScoresSortMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  topScoresSortMenuOpen: boolean;
  topScores: TopScoreRecord[];
  selectedTopScoreSortOption: TopScoreSortOption;
  topScoresSortId: TopScoreSortId;
  setTopScoresSortId: React.Dispatch<React.SetStateAction<TopScoreSortId>>;
  setTopScoresPageIndex: React.Dispatch<React.SetStateAction<number>>;
  topScoresError: string;
  visibleTopScores: TopScoreRecord[];
  setSelectedTopScore: React.Dispatch<React.SetStateAction<TopScoreRecord | null>>;
  topScoresCurrentPageIndex: number;
  topScoresPageCount: number;
  loadTopScoresForRuntime: (targetRuntimeVersion: NethackRuntimeVersion) => Promise<void>;
}

export function TopScoresDialog({
  startupInitialLoadingVisible,
  topScoresDialogRuntime,
  handleStartupMainMenuBlurCapture,
  handleStartupMainMenuChangeCapture,
  handleStartupMainMenuKeyDown,
  handleStartupMainMenuPointerDownCapture,
  renderMobileDialogCloseButton,
  closeTopScoresDialog,
  topScoresSummaryStats,
  topScoresLoading,
  setTopScoresSortMenuOpen,
  topScoresSortMenuOpen,
  topScores,
  selectedTopScoreSortOption,
  topScoresSortId,
  setTopScoresSortId,
  setTopScoresPageIndex,
  topScoresError,
  visibleTopScores,
  setSelectedTopScore,
  topScoresCurrentPageIndex,
  topScoresPageCount,
  loadTopScoresForRuntime,
}: TopScoresDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-top-scores-dialog"
      disableAnimations={startupInitialLoadingVisible}
      open={Boolean(topScoresDialogRuntime)}
      id="nh3d-top-scores-dialog"
      onBlurCapture={handleStartupMainMenuBlurCapture}
      onChangeCapture={handleStartupMainMenuChangeCapture}
      onKeyDown={handleStartupMainMenuKeyDown}
      onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
    >
      {renderMobileDialogCloseButton(closeTopScoresDialog, "Close top scores")}
      {topScoresDialogRuntime ? (
        <RuntimeVersionBadge
          label={resolveRuntimeVersionDisplayLabel(topScoresDialogRuntime)}
          startup
        />
      ) : null}
      <div className="nh3d-options-title">Top Scores</div>
      <div className="nh3d-top-scores-summary">
        {topScoresSummaryStats.length > 0 ? (
          <div className="nh3d-top-scores-summary-grid">
            {topScoresSummaryStats.map((metric) => (
              <div
                className="nh3d-top-scores-summary-card"
                key={`top-score-summary-${metric.label}`}
              >
                <div className="nh3d-top-scores-summary-label">
                  {metric.label}
                </div>
                <div className="nh3d-top-scores-summary-value">
                  {metric.value}
                </div>
                {metric.detail ? (
                  <div className="nh3d-top-scores-summary-detail">
                    {metric.detail}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="nh3d-top-scores-summary-empty">
            {topScoresLoading ? "Loading the ledger..." : "No scores yet."}
          </div>
        )}
      </div>
      <div className="nh3d-top-scores-toolbar">
        <div
          className="nh3d-top-scores-sort"
          onBlur={(event) => {
            const nextFocusedElement = event.relatedTarget;
            if (
              !(nextFocusedElement instanceof Node) ||
              !event.currentTarget.contains(nextFocusedElement)
            ) {
              setTopScoresSortMenuOpen(false);
            }
          }}
        >
          <span>Sort by</span>
          <span className="nh3d-top-scores-select-shell">
            <button
              aria-expanded={topScoresSortMenuOpen}
              aria-haspopup="listbox"
              className="nh3d-top-scores-sort-trigger"
              disabled={topScoresLoading || topScores.length <= 1}
              onClick={() => {
                setTopScoresSortMenuOpen((previous) => !previous);
              }}
              type="button"
            >
              {selectedTopScoreSortOption.label}
            </button>
            {topScoresSortMenuOpen ? (
              <div
                aria-label="Sort top scores by"
                className="nh3d-top-scores-sort-menu"
                role="listbox"
              >
                {topScoreSortOptions.map((option) => (
                  <button
                    aria-selected={option.id === topScoresSortId}
                    className={`nh3d-top-scores-sort-option${option.id === topScoresSortId ? " is-selected" : ""
                      }`}
                    key={`top-score-sort-${option.id}`}
                    onClick={() => {
                      setTopScoresSortId(option.id);
                      setTopScoresPageIndex(0);
                      setTopScoresSortMenuOpen(false);
                    }}
                    role="option"
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </span>
        </div>
      </div>
      <div className="nh3d-overflow-glow-frame nh3d-top-scores-table-frame">
        <div
          className="nh3d-top-scores-table-scroll"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
        >
          {topScoresLoading ? (
            <div className="nh3d-top-scores-empty">Loading the ledger...</div>
          ) : topScoresError ? (
            <div className="nh3d-top-scores-empty">{topScoresError}</div>
          ) : visibleTopScores.length <= 0 ? (
            <div className="nh3d-top-scores-empty">
              No adventurers have claimed a place in the ledger yet. Finish a
              scoring run to write the first entry.
            </div>
          ) : (
            <div className="nh3d-top-scores-list">
              {visibleTopScores.map((score) => {
                const previewLabels = buildTopScorePreviewLabels(score);
                const cardMetrics = buildTopScoreCardMetrics(score);
                const snapshotStatus = formatTopScoreSnapshotStatus(score);
                return (
                  <article
                    className={`nh3d-top-score-card${score.rank <= 3 ? " is-podium" : ""
                      }`}
                    key={score.id}
                  >
                    <div className="nh3d-top-score-card-header">
                      <div className="nh3d-top-score-card-rank">
                        #{formatTopScoreInteger(score.rank)}
                      </div>
                      <div className="nh3d-top-score-card-copy">
                        <div className="nh3d-top-score-card-heading">
                          <div className="nh3d-top-score-card-name">
                            {formatTopScorePlayerName(score)}
                          </div>
                          <div className="nh3d-top-score-card-points">
                            {formatTopScoreInteger(score.points)} pts
                          </div>
                        </div>
                        <div className="nh3d-top-score-card-archetype">
                          {formatTopScoreCharacterLine(score)}
                        </div>
                        <div className="nh3d-top-score-card-summary">
                          {formatTopScoreResultSummary(score)}
                        </div>
                      </div>
                      {snapshotStatus ? (
                        <div className="nh3d-top-score-card-status">
                          <span className="nh3d-top-score-badge">
                            {snapshotStatus}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="nh3d-top-score-card-metrics">
                      {cardMetrics.map((metric) => (
                        <div
                          className="nh3d-top-score-mini-stat"
                          key={`${score.id}-${metric.label}`}
                        >
                          <div className="nh3d-top-score-mini-stat-label">
                            {metric.label}
                          </div>
                          <div className="nh3d-top-score-mini-stat-value">
                            {metric.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="nh3d-top-score-card-footer">
                      <div className="nh3d-top-score-card-tags">
                        {previewLabels.map((label) => (
                          <span
                            className="nh3d-top-score-badge"
                            key={`${score.id}-label-${label}`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      <button
                        className="nh3d-top-scores-link-button"
                        onClick={() => setSelectedTopScore(score)}
                        type="button"
                      >
                        Open run breakdown
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="nh3d-top-scores-pagination">
        Page {topScoresCurrentPageIndex + 1} of {topScoresPageCount}
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button"
          disabled={topScoresLoading || topScoresCurrentPageIndex <= 0}
          onClick={() =>
            setTopScoresPageIndex((previous) => Math.max(0, previous - 1))
          }
          type="button"
        >
          Previous
        </button>
        <button
          className="nh3d-menu-action-button"
          disabled={
            topScoresLoading ||
            topScoresCurrentPageIndex >= topScoresPageCount - 1
          }
          onClick={() =>
            setTopScoresPageIndex((previous) =>
              Math.min(topScoresPageCount - 1, previous + 1),
            )
          }
          type="button"
        >
          Next
        </button>
        <button
          className="nh3d-menu-action-button"
          disabled={topScoresLoading || !topScoresDialogRuntime}
          onClick={() => {
            if (topScoresDialogRuntime) {
              void loadTopScoresForRuntime(topScoresDialogRuntime);
            }
          }}
          type="button"
        >
          Refresh
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={closeTopScoresDialog}
          type="button"
        >
          {commonStrings.close}
        </button>
      </div>
    </AnimatedDialog>
  );
}
