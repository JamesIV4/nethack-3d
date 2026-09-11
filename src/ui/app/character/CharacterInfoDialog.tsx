import type { InfoMenuState, PlayerStatsSnapshot, Nethack3DEngineController } from "../../../game/ui-types";
import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  type EnhanceMenuData
} from "../../modals/enhance-menu";
import type * as React from "react";
import type {
  PlayerStatusBadge
} from "../status/conditions";
import {
  commonStrings,
  t,
  translationStrings
} from "../shared/translations";
import {
  armorClassDescription,
  characterStatDescriptionById,
  formatCharacterNumber,
  renderCharacterSheetFieldRows
} from "../status/character-fields";
import {
  renderEnhanceMenuContent
} from "../menus/enhance-content";
import type { CharacterSheetData, CharacterSheetStat, CharacterCommandAction } from "../../modals/character-sheet";


export interface CharacterInfoDialogProps {
  isCharacterSheetVisible: boolean;
  infoEnhanceMenuData: EnhanceMenuData | null;
  infoMenu: InfoMenuState | null;
  handleInfoMenuDialogKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  displayedInfoMenu: InfoMenuState | null;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  closeInfoMenuDialog: () => void;
  characterSheet: CharacterSheetData | null;
  characterExperienceProgress: { level: number; experiencePoints: number; isMaxLevel: boolean; currentLevelStart: number; nextLevelThreshold: number; toNextLevel: number; progressPercent: number; };
  isLegacySlashEmBaseAttributesSheet: boolean;
  showLegacySlashEmDeitiesPanel: boolean;
  displayedCharacterStatEntries: CharacterSheetStat[];
  playerStats: PlayerStatsSnapshot;
  renderCharacterCurrentStatusPanel: (statusLines: readonly string[], fallbackBadges?: readonly PlayerStatusBadge[]) => JSX.Element;
  playerStatusBadges: PlayerStatusBadge[];
  renderCharacterCurrentAttributesPanel: (attributeLines: readonly string[]) => JSX.Element;
  controller: Nethack3DEngineController | null;
  characterCommandActions: CharacterCommandAction[];
  runCharacterExtendedCommand: (command: string) => void;
  hasCharacterStatValues: boolean;
  hasCharacterStatLimits: boolean;
  showMessageHistoryNavigation: boolean;
  canShowPreviousCachedMessage: boolean;
  showEarliestCachedMessageInfoMenu: () => void;
  showPreviousCachedMessageInfoMenu: () => void;
  canShowNextCachedMessage: boolean;
  showNextCachedMessageInfoMenu: () => void;
  showLatestCachedMessageInfoMenu: () => void;
}

export function CharacterInfoDialog({
  isCharacterSheetVisible,
  infoEnhanceMenuData,
  infoMenu,
  handleInfoMenuDialogKeyDown,
  displayedInfoMenu,
  renderMobileDialogCloseButton,
  closeInfoMenuDialog,
  characterSheet,
  characterExperienceProgress,
  isLegacySlashEmBaseAttributesSheet,
  showLegacySlashEmDeitiesPanel,
  displayedCharacterStatEntries,
  playerStats,
  renderCharacterCurrentStatusPanel,
  playerStatusBadges,
  renderCharacterCurrentAttributesPanel,
  controller,
  characterCommandActions,
  runCharacterExtendedCommand,
  hasCharacterStatValues,
  hasCharacterStatLimits,
  showMessageHistoryNavigation,
  canShowPreviousCachedMessage,
  showEarliestCachedMessageInfoMenu,
  showPreviousCachedMessageInfoMenu,
  canShowNextCachedMessage,
  showNextCachedMessageInfoMenu,
  showLatestCachedMessageInfoMenu,
}: CharacterInfoDialogProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog ${isCharacterSheetVisible ? "nh3d-dialog-character" : "nh3d-dialog-info"
        }${infoEnhanceMenuData ? " nh3d-dialog-info-enhance" : ""} nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-overflow-glow-frame`}
      open={Boolean(infoMenu)}
      id={isCharacterSheetVisible ? "character-dialog" : "info-menu-dialog"}
      onKeyDown={handleInfoMenuDialogKeyDown}
    >
      {displayedInfoMenu ? (
        <>
          {renderMobileDialogCloseButton(
            closeInfoMenuDialog,
            isCharacterSheetVisible
              ? t.dialogs.info.closeCharacter
              : t.dialogs.info.closeInformation,
          )}
          {isCharacterSheetVisible && characterSheet ? (
            <>
              <div
                className="nh3d-character-sheet-scroll"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                <div className="nh3d-info-title">
                  {t.dialogs.info.characterTitle}
                </div>
                <div className="nh3d-character-xp-block nh3d-character-xp-block-top">
                  <div className="nh3d-character-xp-header">
                    <span>{t.dialogs.info.experienceProgress}</span>
                    <span>
                      {t.dialogs.info.levelLabel(
                        characterExperienceProgress.level,
                      )}
                    </span>
                  </div>
                  <div className="nh3d-character-xp-track">
                    <div
                      className="nh3d-character-xp-fill"
                      style={{
                        width: `${characterExperienceProgress.progressPercent}%`,
                      }}
                    />
                  </div>
                  <div className="nh3d-character-xp-meta">
                    {characterExperienceProgress.isMaxLevel ? (
                      <>
                        {t.dialogs.info.xpAtMaxLevel(
                          formatCharacterNumber(
                            characterExperienceProgress.experiencePoints,
                          ),
                        )}
                      </>
                    ) : (
                      <>
                        {t.dialogs.info.xpToNextLevel(
                          formatCharacterNumber(
                            characterExperienceProgress.experiencePoints,
                          ),
                          formatCharacterNumber(
                            characterExperienceProgress.nextLevelThreshold,
                          ),
                          formatCharacterNumber(
                            characterExperienceProgress.toNextLevel,
                          ),
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="nh3d-character-grid">
                  {isLegacySlashEmBaseAttributesSheet ? (
                    <>
                      <div className="nh3d-character-legacy-summary-row">
                        <section className="nh3d-character-panel nh3d-character-panel-legacy-summary">
                          <div className="nh3d-character-panel-title">
                            Starting
                          </div>
                          {renderCharacterSheetFieldRows(
                            characterSheet.backgroundLines,
                            "character-legacy-starting",
                            { showBadges: false },
                          )}
                        </section>

                        <section className="nh3d-character-panel nh3d-character-panel-legacy-summary">
                          <div className="nh3d-character-panel-title">
                            Current
                          </div>
                          {renderCharacterSheetFieldRows(
                            characterSheet.characteristicsLines,
                            "character-legacy-current",
                            { showBadges: false },
                          )}
                        </section>

                        {showLegacySlashEmDeitiesPanel ? (
                          <section className="nh3d-character-panel nh3d-character-panel-legacy-summary nh3d-character-panel-legacy-deities">
                            <div className="nh3d-character-panel-title">
                              Deities
                            </div>
                            {renderCharacterSheetFieldRows(
                              characterSheet.deityLines,
                              "character-legacy-deities",
                              {
                                showBadges: false,
                                highlightCurrent: true,
                              },
                            )}
                          </section>
                        ) : null}
                      </div>

                      <section className="nh3d-character-panel nh3d-character-panel-characteristics">
                        <div className="nh3d-character-panel-title">
                          {t.dialogs.info.characteristics}
                        </div>
                        <div className="nh3d-character-stat-grid">
                          {displayedCharacterStatEntries.map((entry) => (
                            <div
                              className="nh3d-character-stat"
                              key={`character-legacy-stat-${entry.id}`}
                            >
                              <div className="nh3d-character-stat-label">
                                {entry.label}
                              </div>
                              <div className="nh3d-character-stat-value">
                                <span className="nh3d-character-stat-current">
                                  {entry.currentValue ||
                                    entry.rawValue ||
                                    "--"}
                                </span>
                              </div>
                              <div className="nh3d-character-stat-description">
                                {characterStatDescriptionById[entry.id]}
                              </div>
                            </div>
                          ))}
                          <div className="nh3d-character-stat">
                            <div className="nh3d-character-stat-label">
                              {t.dialogs.info.armorClass}
                            </div>
                            <div className="nh3d-character-stat-value">
                              <span className="nh3d-character-stat-current">
                                {playerStats.armor}
                              </span>
                            </div>
                            <div className="nh3d-character-stat-description">
                              {armorClassDescription}
                            </div>
                          </div>
                        </div>
                      </section>

                      {renderCharacterCurrentStatusPanel(
                        characterSheet.statusLines,
                        playerStatusBadges,
                      )}

                      {characterSheet.attributeLines.length > 0
                        ? renderCharacterCurrentAttributesPanel(
                          characterSheet.attributeLines,
                        )
                        : null}

                      <section className="nh3d-character-panel nh3d-character-panel-actions">
                        <div className="nh3d-character-panel-title">
                          {t.dialogs.info.characterActions}
                        </div>
                        <div className="nh3d-character-actions-grid">
                          <button
                            className="nh3d-character-action-button"
                            onClick={() =>
                              controller?.toggleInventoryDialog()
                            }
                            type="button"
                          >
                            <span className="nh3d-character-action-label">
                              {t.dialogs.info.inventory}
                            </span>
                            <span className="nh3d-character-action-detail">
                              {t.dialogs.info.inventoryDetail}
                            </span>
                          </button>
                          {characterCommandActions.map((action) => (
                            <button
                              className="nh3d-character-action-button"
                              key={`character-action-${action.id}`}
                              onClick={() =>
                                runCharacterExtendedCommand(action.command)
                              }
                              type="button"
                            >
                              <span className="nh3d-character-action-label">
                                {action.label}
                              </span>
                              <span className="nh3d-character-action-detail">
                                {action.detail}
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : (
                    <>
                      <section className="nh3d-character-panel">
                        <div className="nh3d-character-panel-title">
                          {
                            translationStrings.characterSheet.sectionTitles
                              .background
                          }
                        </div>
                        <div className="nh3d-character-line-stack">
                          {characterSheet.backgroundLines.length > 0 ? (
                            characterSheet.backgroundLines.map(
                              (line, index) => (
                                <div
                                  className="nh3d-character-line"
                                  key={`character-bg-${index}`}
                                >
                                  {line}
                                </div>
                              ),
                            )
                          ) : characterSheet.identityLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.identityLine}
                            </div>
                          ) : null}
                        </div>
                      </section>

                      <section className="nh3d-character-panel">
                        <div className="nh3d-character-panel-title">
                          {t.dialogs.info.vitals}
                        </div>
                        <div className="nh3d-character-line-stack">
                          {characterSheet.hitPointsLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.hitPointsLine}
                            </div>
                          ) : null}
                          {characterSheet.energyLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.energyLine}
                            </div>
                          ) : null}
                          {characterSheet.armorClassLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.armorClassLine}
                            </div>
                          ) : null}
                          {characterSheet.experienceLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.experienceLine}
                            </div>
                          ) : null}
                          {characterSheet.scoreLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.scoreLine}
                            </div>
                          ) : null}
                          {characterSheet.walletLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.walletLine}
                            </div>
                          ) : null}
                          {characterSheet.autopickupLine ? (
                            <div className="nh3d-character-line">
                              {characterSheet.autopickupLine}
                            </div>
                          ) : null}
                        </div>
                      </section>

                      <section className="nh3d-character-panel nh3d-character-panel-characteristics">
                        <div className="nh3d-character-panel-title">
                          {t.dialogs.info.characteristics}
                        </div>
                        {hasCharacterStatValues ? (
                          <div className="nh3d-character-stat-grid">
                            {hasCharacterStatLimits ? (
                              <div className="nh3d-character-stat-grid-hint">
                                {t.dialogs.info.currentLimit}
                              </div>
                            ) : null}
                            {displayedCharacterStatEntries.map((entry) => (
                              <div
                                className="nh3d-character-stat"
                                key={`character-stat-${entry.id}`}
                              >
                                <div className="nh3d-character-stat-label">
                                  {entry.label}
                                </div>
                                <div className="nh3d-character-stat-value">
                                  <span className="nh3d-character-stat-current">
                                    {entry.currentValue ||
                                      entry.rawValue ||
                                      "--"}
                                  </span>
                                  {entry.limitValue ? (
                                    <>
                                      <span className="nh3d-character-stat-divider">
                                        /
                                      </span>
                                      <span className="nh3d-character-stat-limit">
                                        {entry.limitValue}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                                <div className="nh3d-character-stat-description">
                                  {characterStatDescriptionById[entry.id]}
                                </div>
                              </div>
                            ))}
                            <div className="nh3d-character-stat">
                              <div className="nh3d-character-stat-label">
                                {t.dialogs.info.armorClass}
                              </div>
                              <div className="nh3d-character-stat-value">
                                <span className="nh3d-character-stat-current">
                                  {playerStats.armor}
                                </span>
                              </div>
                              <div className="nh3d-character-stat-description">
                                {armorClassDescription}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="nh3d-character-line-stack">
                            {characterSheet.characteristicsLines.map(
                              (line, index) => (
                                <div
                                  className="nh3d-character-line"
                                  key={`character-characteristics-${index}`}
                                >
                                  {line}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </section>

                      {renderCharacterCurrentStatusPanel(
                        characterSheet.statusLines,
                      )}

                      {renderCharacterCurrentAttributesPanel(
                        characterSheet.attributeLines,
                      )}

                      <section className="nh3d-character-panel nh3d-character-panel-actions">
                        <div className="nh3d-character-panel-title">
                          {t.dialogs.info.characterActions}
                        </div>
                        <div className="nh3d-character-actions-grid">
                          <button
                            className="nh3d-character-action-button"
                            onClick={() =>
                              controller?.toggleInventoryDialog()
                            }
                            type="button"
                          >
                            <span className="nh3d-character-action-label">
                              {t.dialogs.info.inventory}
                            </span>
                            <span className="nh3d-character-action-detail">
                              {t.dialogs.info.inventoryDetail}
                            </span>
                          </button>
                          {characterCommandActions.map((action) => (
                            <button
                              className="nh3d-character-action-button"
                              key={`character-action-${action.id}`}
                              onClick={() =>
                                runCharacterExtendedCommand(action.command)
                              }
                              type="button"
                            >
                              <span className="nh3d-character-action-label">
                                {action.label}
                              </span>
                              <span className="nh3d-character-action-detail">
                                {action.detail}
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>

                      {characterSheet.extraSections.map(
                        (section, sectionIndex) => (
                          <section
                            className="nh3d-character-panel"
                            key={`character-extra-${section.title}-${sectionIndex}`}
                          >
                            <div className="nh3d-character-panel-title">
                              {section.title}
                            </div>
                            <div className="nh3d-character-line-stack">
                              {section.lines.map((line, lineIndex) => (
                                <div
                                  className="nh3d-character-line"
                                  key={`character-extra-line-${sectionIndex}-${lineIndex}`}
                                >
                                  {line}
                                </div>
                              ))}
                            </div>
                          </section>
                        ),
                      )}
                    </>
                  )}
                </div>

                <div className="nh3d-info-hint">
                  {t.dialogs.info.closeHint}
                </div>
              </div>
              <div className="nh3d-menu-actions">
                {showMessageHistoryNavigation ? (
                  <>
                    <button
                      aria-label="Show earliest NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowPreviousCachedMessage}
                      onClick={showEarliestCachedMessageInfoMenu}
                      type="button"
                    >
                      {"<<"}
                    </button>
                    <button
                      aria-label="Show previous NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowPreviousCachedMessage}
                      onClick={showPreviousCachedMessageInfoMenu}
                      type="button"
                    >
                      {"<"}
                    </button>
                    <button
                      className="nh3d-menu-action-button nh3d-menu-action-cancel"
                      onClick={closeInfoMenuDialog}
                      type="button"
                    >
                      {commonStrings.close}
                    </button>
                    <button
                      aria-label="Show next NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowNextCachedMessage}
                      onClick={showNextCachedMessageInfoMenu}
                      type="button"
                    >
                      {">"}
                    </button>
                    <button
                      aria-label="Show latest NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowNextCachedMessage}
                      onClick={showLatestCachedMessageInfoMenu}
                      type="button"
                    >
                      {">>"}
                    </button>
                  </>
                ) : (
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-cancel"
                    onClick={closeInfoMenuDialog}
                    type="button"
                  >
                    {commonStrings.close}
                  </button>
                )}
              </div>
            </>
          ) : infoEnhanceMenuData ? (
            <>
              <div
                className="nh3d-dialog-info-scroll"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                <div className="nh3d-question-text">
                  {infoEnhanceMenuData.prompt ||
                    displayedInfoMenu.title ||
                    t.dialogs.info.infoTitleFallback}
                </div>
                {renderEnhanceMenuContent(infoEnhanceMenuData)}
              </div>
              <div className="nh3d-menu-actions">
                {showMessageHistoryNavigation ? (
                  <>
                    <button
                      aria-label="Show earliest NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowPreviousCachedMessage}
                      onClick={showEarliestCachedMessageInfoMenu}
                      type="button"
                    >
                      {"<<"}
                    </button>
                    <button
                      aria-label="Show previous NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowPreviousCachedMessage}
                      onClick={showPreviousCachedMessageInfoMenu}
                      type="button"
                    >
                      {"<"}
                    </button>
                    <button
                      className="nh3d-menu-action-button nh3d-menu-action-cancel"
                      onClick={closeInfoMenuDialog}
                      type="button"
                    >
                      {commonStrings.close}
                    </button>
                    <button
                      aria-label="Show next NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowNextCachedMessage}
                      onClick={showNextCachedMessageInfoMenu}
                      type="button"
                    >
                      {">"}
                    </button>
                    <button
                      aria-label="Show latest NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowNextCachedMessage}
                      onClick={showLatestCachedMessageInfoMenu}
                      type="button"
                    >
                      {">>"}
                    </button>
                  </>
                ) : (
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-cancel"
                    onClick={closeInfoMenuDialog}
                    type="button"
                  >
                    {commonStrings.close}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div
                className="nh3d-dialog-info-scroll"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                <div className="nh3d-info-title">
                  {displayedInfoMenu.title || t.dialogs.info.infoTitleFallback}
                </div>
                <div className="nh3d-info-body">
                  {displayedInfoMenu.lines.length > 0
                    ? displayedInfoMenu.lines.join("\n")
                    : t.dialogs.info.noDetails}
                </div>
                <div className="nh3d-info-hint">
                  {t.dialogs.info.closeHint}
                </div>
              </div>
              <div className="nh3d-menu-actions">
                {showMessageHistoryNavigation ? (
                  <>
                    <button
                      aria-label="Show earliest NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowPreviousCachedMessage}
                      onClick={showEarliestCachedMessageInfoMenu}
                      type="button"
                    >
                      {"<<"}
                    </button>
                    <button
                      aria-label="Show previous NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowPreviousCachedMessage}
                      onClick={showPreviousCachedMessageInfoMenu}
                      type="button"
                    >
                      {"<"}
                    </button>
                    <button
                      className="nh3d-menu-action-button nh3d-menu-action-cancel"
                      onClick={closeInfoMenuDialog}
                      type="button"
                    >
                      {commonStrings.close}
                    </button>
                    <button
                      aria-label="Show next NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowNextCachedMessage}
                      onClick={showNextCachedMessageInfoMenu}
                      type="button"
                    >
                      {">"}
                    </button>
                    <button
                      aria-label="Show latest NetHack message"
                      className="nh3d-menu-action-button nh3d-message-history-nav-button"
                      disabled={!canShowNextCachedMessage}
                      onClick={showLatestCachedMessageInfoMenu}
                      type="button"
                    >
                      {">>"}
                    </button>
                  </>
                ) : (
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-cancel"
                    onClick={closeInfoMenuDialog}
                    type="button"
                  >
                    {commonStrings.close}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      ) : null}
    </AnimatedDialog>
  );
}
