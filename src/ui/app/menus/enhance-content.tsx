import {
  type EnhanceMenuData
} from "../../modals/enhance-menu";
import {
  translationStrings
} from "../shared/translations";
import {
  getMenuSelectionInput,
  isSelectableQuestionMenuItem
} from "./question-choices";

/** Enhancement menu content rendering. */
export function renderEnhanceMenuContent(
  enhanceMenuData: EnhanceMenuData,
  options: {
    activeMenuSelectionInput?: string | null;
    onChooseSelectionInput?: ((selectionInput: string) => void) | null;
    onFocusSelectionInput?: ((selectionInput: string) => void) | null;
  } = {},
): JSX.Element {
  const activeMenuSelectionInput = options.activeMenuSelectionInput ?? null;
  const onChooseSelectionInput = options.onChooseSelectionInput ?? null;
  const onFocusSelectionInput = options.onFocusSelectionInput ?? null;
  return (
    <div className="nh3d-enhance-menu">
      <div className="nh3d-enhance-summary">
        <span className="nh3d-enhance-summary-chip is-available">
          {translationStrings.enhanceMenu.summary.available(
            enhanceMenuData.availableCount,
          )}
        </span>
        <span className="nh3d-enhance-summary-chip is-gated">
          {translationStrings.enhanceMenu.summary.gated(
            enhanceMenuData.needsExperienceCount,
          )}
        </span>
        <span className="nh3d-enhance-summary-chip is-practice">
          {translationStrings.enhanceMenu.summary.practice(
            enhanceMenuData.needsPracticeCount,
          )}
        </span>
        <span className="nh3d-enhance-summary-chip is-maxed">
          {translationStrings.enhanceMenu.summary.maxed(
            enhanceMenuData.maxedOutCount,
          )}
        </span>
      </div>
      {enhanceMenuData.legendLines.length > 0 ? (
        <div className="nh3d-enhance-legend">
          {enhanceMenuData.legendLines.map((line, index) => (
            <div
              className="nh3d-enhance-legend-line"
              key={`enhance-legend-${index}`}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {enhanceMenuData.groups.map((group) => (
        <section
          className="nh3d-enhance-group"
          key={`enhance-group-${group.id}`}
        >
          <div className="nh3d-menu-category nh3d-enhance-group-title">
            {group.title}
          </div>
          <div className="nh3d-enhance-skill-grid">
            {group.entries.map((entry) => {
              const selectionInput = getMenuSelectionInput(entry.menuItem);
              const isSelectable =
                typeof onChooseSelectionInput === "function" &&
                isSelectableQuestionMenuItem(entry.menuItem);
              const isActive = activeMenuSelectionInput === selectionInput;
              const acceleratorLabel =
                typeof entry.menuItem.accelerator === "string" &&
                  entry.menuItem.accelerator.trim().length > 0
                  ? `${entry.menuItem.accelerator})`
                  : "";
              return isSelectable ? (
                <button
                  autoFocus={isActive}
                  className={`nh3d-enhance-skill-card is-${entry.availability}${isActive ? " nh3d-menu-button-active" : ""
                    }`}
                  key={`enhance-skill-${entry.id}`}
                  onClick={() => onChooseSelectionInput(selectionInput)}
                  onFocus={() => onFocusSelectionInput?.(selectionInput)}
                  type="button"
                >
                  <div className="nh3d-enhance-skill-head">
                    <span className="nh3d-enhance-skill-name">
                      {entry.name}
                    </span>
                    <span className="nh3d-enhance-skill-badges">
                      {acceleratorLabel ? (
                        <span className="nh3d-enhance-key">
                          {acceleratorLabel}
                        </span>
                      ) : null}
                      <span className="nh3d-enhance-state-chip">
                        {entry.availabilityLabel}
                      </span>
                    </span>
                  </div>
                  <div className="nh3d-enhance-rank-row">
                    <span>{entry.currentRank}</span>
                    {entry.nextRank ? (
                      <>
                        <span className="nh3d-enhance-rank-arrow">{"->"}</span>
                        <span>{entry.nextRank}</span>
                      </>
                    ) : (
                      <span className="nh3d-enhance-rank-max">
                        {translationStrings.enhanceMenu.maxLabel}
                      </span>
                    )}
                  </div>
                  {enhanceMenuData.showSlotCost && entry.slotCostForNextRank ? (
                    <div className="nh3d-enhance-slot-cost">
                      {translationStrings.enhanceMenu.slotCount(
                        entry.slotCostForNextRank,
                      )}
                    </div>
                  ) : null}
                </button>
              ) : (
                <div
                  className={`nh3d-enhance-skill-card is-${entry.availability} is-disabled${isActive ? " nh3d-menu-button-active" : ""
                    }`}
                  key={`enhance-skill-${entry.id}`}
                >
                  <div className="nh3d-enhance-skill-head">
                    <span className="nh3d-enhance-skill-name">
                      {entry.name}
                    </span>
                    <span className="nh3d-enhance-state-chip">
                      {entry.availabilityLabel}
                    </span>
                  </div>
                  <div className="nh3d-enhance-rank-row">
                    <span>{entry.currentRank}</span>
                    {entry.nextRank ? (
                      <>
                        <span className="nh3d-enhance-rank-arrow">{"->"}</span>
                        <span>{entry.nextRank}</span>
                      </>
                    ) : (
                      <span className="nh3d-enhance-rank-max">
                        {translationStrings.enhanceMenu.maxLabel}
                      </span>
                    )}
                  </div>
                  {enhanceMenuData.showSlotCost && entry.slotCostForNextRank ? (
                    <div className="nh3d-enhance-slot-cost">
                      {translationStrings.enhanceMenu.slotCount(
                        entry.slotCostForNextRank,
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
