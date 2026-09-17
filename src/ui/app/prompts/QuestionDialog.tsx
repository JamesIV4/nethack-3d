import type { NethackMenuItem, QuestionDialogState, Nethack3DEngineController } from "../../../game/ui-types";
import {
  Nh3dIcon,
  Nh3dIconArrowDown,
  Nh3dIconArrowUp
} from "../../icons";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import { CastSpellMenu, type CastSpellMenuData } from "../../modals/cast-menu";
import { TechniqueMenu, type TechniqueMenuData } from "../../modals/technique-menu";
import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  type EnhanceMenuData
} from "../../modals/enhance-menu";
import type * as React from "react";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  getInventoryItemForQuestionChoice,
  getMenuSelectionInput,
  getQuestionChoiceLabel,
  isReadOnlyQuestionOptionMenuItem,
  isSelectableQuestionMenuItem
} from "../menus/question-choices";
import {
  isMenuItemTileApplicable,
  resolveMenuItemFallbackGlyph,
  resolveMenuItemTileIndex
} from "../tilesets/menu-glyphs";
import {
  renderEnhanceMenuContent
} from "../menus/enhance-content";

export interface QuestionDialogProps {
  question: QuestionDialogState | null;
  isYesNoQuestionChoices: boolean;
  enhanceMenuData: EnhanceMenuData | null;
  castMenuData: CastSpellMenuData | null;
  useSlashEmLegacyShortcutChoiceDialog: boolean;
  techniqueMenuData: TechniqueMenuData | null;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  controller: Nethack3DEngineController | null;
  showQuestionAmountControls: boolean;
  displayedQuestionText: string;
  displayedQuestionPendingCount: number | null;
  shouldRenderQuestionMenuItems: boolean;
  displayedQuestionMenuItems: NethackMenuItem[];
  tilesUiEnabled: boolean;
  renderMenuItemTilePreview: (item: NethackMenuItem | null | undefined, tileId: number | null) => JSX.Element | null;
  showPickupActionButtons: boolean;
  showPickupToggleAllButton: boolean;
  questionSelectableMenuItemCount: number;
  shouldRenderQuestionTextInput: boolean;
  setQuestionTextInputValue: React.Dispatch<React.SetStateAction<string>>;
  submitQuestionTextInput: () => void;
  questionTextInputRef: React.MutableRefObject<HTMLInputElement | null>;
  questionTextInputValue: string;
  useCompactQuestionChoiceLayout: boolean;
  orderedQuestionChoices: string[];
  useInventoryChoiceLabels: boolean;
  questionChoiceSourceItems: NethackMenuItem[];
  activeRuntimeVersion: NethackRuntimeVersion;
  showQuestionCancelButton: boolean;
  questionMenuPageCount: number;
  questionMenuPageIndex: number;
}

export function QuestionDialog({
  question,
  isYesNoQuestionChoices,
  enhanceMenuData,
  castMenuData,
  useSlashEmLegacyShortcutChoiceDialog,
  techniqueMenuData,
  renderMobileDialogCloseButton,
  controller,
  showQuestionAmountControls,
  displayedQuestionText,
  displayedQuestionPendingCount,
  shouldRenderQuestionMenuItems,
  displayedQuestionMenuItems,
  tilesUiEnabled,
  renderMenuItemTilePreview,
  showPickupActionButtons,
  showPickupToggleAllButton,
  questionSelectableMenuItemCount,
  shouldRenderQuestionTextInput,
  setQuestionTextInputValue,
  submitQuestionTextInput,
  questionTextInputRef,
  questionTextInputValue,
  useCompactQuestionChoiceLayout,
  orderedQuestionChoices,
  useInventoryChoiceLabels,
  questionChoiceSourceItems,
  activeRuntimeVersion,
  showQuestionCancelButton,
  questionMenuPageCount,
  questionMenuPageIndex,
}: QuestionDialogProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close${question?.menuItems.length === 0 && isYesNoQuestionChoices
        ? " nh3d-dialog-question-yes-no"
        : ""
        }${enhanceMenuData ? " nh3d-dialog-question-enhance" : ""}${castMenuData ? " nh3d-dialog-question-cast" : ""
        }${useSlashEmLegacyShortcutChoiceDialog
          ? " nh3d-dialog-question-legacy-shortcuts"
          : ""
        }${techniqueMenuData ? " nh3d-dialog-question-technique" : ""}`}
      open={Boolean(question)}
      id="question-dialog"
    >
      {question ? (
        <>
          {renderMobileDialogCloseButton(
            () => controller?.cancelActivePrompt(),
            t.dialogs.question.cancelPrompt,
          )}
          <div
            className={`nh3d-question-text${showQuestionAmountControls
              ? " nh3d-question-text-has-amount"
              : ""
              }`}
          >
            <span className="nh3d-question-title-label">
              {displayedQuestionText}
            </span>
            {showQuestionAmountControls ? (
              <div className="nh3d-question-amount-controls">
                <button
                  aria-label={t.dialogs.question.decreaseAmount}
                  className="nh3d-question-amount-button"
                  disabled={displayedQuestionPendingCount === null}
                  onClick={() => controller?.stepQuestionSelectionCount(-1)}
                  title={t.dialogs.question.decreaseAmount}
                  type="button"
                >
                  <Nh3dIcon icon={Nh3dIconArrowDown} size={13} />
                </button>
                <input
                  aria-label={t.dialogs.question.amount}
                  className="nh3d-question-amount-input"
                  inputMode="numeric"
                  max={999999}
                  min={1}
                  placeholder="-"
                  onChange={(event) => {
                    const nextValue = Number(event.currentTarget.value);
                    controller?.setQuestionSelectionCount(
                      Number.isFinite(nextValue) ? nextValue : null,
                    );
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                  type="number"
                  value={displayedQuestionPendingCount ?? ""}
                />
                <button
                  aria-label={t.dialogs.question.increaseAmount}
                  className="nh3d-question-amount-button"
                  onClick={() => controller?.stepQuestionSelectionCount(1)}
                  title={t.dialogs.question.increaseAmount}
                  type="button"
                >
                  <Nh3dIcon icon={Nh3dIconArrowUp} size={13} />
                </button>
              </div>
            ) : null}
          </div>
          {shouldRenderQuestionMenuItems ? (
            question.isPickupDialog ? (
              <>
                {displayedQuestionMenuItems.map((item, index) => {
                  if (!isSelectableQuestionMenuItem(item)) {
                    return (
                      <div
                        className={
                          item.isCategory
                            ? "nh3d-menu-category"
                            : "nh3d-menu-row"
                        }
                        key={`cat-${index}`}
                      >
                        {item.text}
                      </div>
                    );
                  }
                  const tileApplicable =
                    tilesUiEnabled && isMenuItemTileApplicable(item);
                  const tileIndex = tileApplicable
                    ? resolveMenuItemTileIndex(item)
                    : null;
                  const tilePreview = renderMenuItemTilePreview(
                    item,
                    tileIndex,
                  );
                  const fallbackGlyph = resolveMenuItemFallbackGlyph(item);
                  const selectionInput = getMenuSelectionInput(item);
                  const selectedCount =
                    question.selectedCounts?.[selectionInput] ?? null;
                  return (
                    <div
                      className={`nh3d-pickup-item${question.selectedAccelerators.includes(
                        String(item.accelerator),
                      )
                        ? " nh3d-pickup-item-selected"
                        : ""
                        }${question.activeMenuSelectionInput ===
                          selectionInput
                          ? " nh3d-pickup-item-active"
                          : ""
                        }`}
                      key={`pickup-${item.accelerator}-${index}`}
                      onClick={() =>
                        controller?.togglePickupChoice(selectionInput)
                      }
                      onFocus={() =>
                        controller?.syncQuestionSelectionFocus(selectionInput)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === " " ||
                          event.key === "Space" ||
                          event.key === "Spacebar"
                        ) {
                          event.preventDefault();
                          event.stopPropagation();
                          controller?.togglePickupChoice(selectionInput);
                        }
                      }}
                      role="checkbox"
                      aria-checked={question.selectedAccelerators.includes(
                        String(item.accelerator),
                      )}
                      tabIndex={0}
                    >
                      <input
                        checked={question.selectedAccelerators.includes(
                          String(item.accelerator),
                        )}
                        aria-hidden="true"
                        className="nh3d-pickup-checkbox"
                        readOnly
                        tabIndex={-1}
                        type="checkbox"
                      />
                      <span className="nh3d-question-item-leading">
                        {tileApplicable ? (
                          <span
                            className="nh3d-question-item-icon-shell"
                            aria-hidden="true"
                          >
                            {tilePreview ? (
                              <span className="nh3d-question-item-icon-art">
                                {tilePreview}
                              </span>
                            ) : (
                              <span className="nh3d-question-item-icon-fallback">
                                {fallbackGlyph}
                              </span>
                            )}
                          </span>
                        ) : null}
                        <span className="nh3d-pickup-key">
                          {item.accelerator})
                        </span>
                      </span>
                      <span className="nh3d-pickup-text">{item.text}</span>
                      {typeof selectedCount === "number" &&
                        Number.isFinite(selectedCount) &&
                        selectedCount > 0 ? (
                        <span className="nh3d-pickup-count">
                          {`x${selectedCount}`}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {showPickupActionButtons ? (
                  <div className="nh3d-pickup-actions">
                    <button
                      className={`nh3d-pickup-action-button nh3d-pickup-action-confirm${question.activeActionButton === "confirm"
                        ? " nh3d-action-button-active"
                        : ""
                        }`}
                      autoFocus={question.activeActionButton === "confirm"}
                      onClick={() => controller?.confirmPickupChoices()}
                      onFocus={() =>
                        controller?.syncQuestionActionFocus("confirm")
                      }
                      type="button"
                    >
                      {commonStrings.confirm}
                    </button>
                    {showPickupToggleAllButton ? (
                      <button
                        className={`nh3d-pickup-action-button nh3d-pickup-action-toggle-all${question.activeActionButton === "select-all"
                          ? " nh3d-action-button-active"
                          : ""
                          }`}
                        autoFocus={
                          question.activeActionButton === "select-all"
                        }
                        onClick={() => controller?.toggleAllPickupChoices()}
                        onFocus={() =>
                          controller?.syncQuestionActionFocus("select-all")
                        }
                        type="button"
                      >
                        <span className="nh3d-pickup-action-button-label">
                          {question.allPickupSelected
                            ? t.dialogs.question.deselectAll
                            : t.dialogs.question.selectAll}
                        </span>
                        <span
                          aria-hidden="true"
                          className="nh3d-pickup-action-button-sizer"
                        >
                          {t.dialogs.question.deselectAll}
                        </span>
                      </button>
                    ) : null}
                    <button
                      className={`nh3d-pickup-action-button nh3d-pickup-action-cancel${question.activeActionButton === "cancel"
                        ? " nh3d-action-button-active"
                        : ""
                        }`}
                      autoFocus={question.activeActionButton === "cancel"}
                      onClick={() => controller?.cancelActivePrompt()}
                      onFocus={() =>
                        controller?.syncQuestionActionFocus("cancel")
                      }
                      type="button"
                    >
                      {commonStrings.cancel}
                    </button>
                  </div>
                ) : null}
              </>
            ) : enhanceMenuData ? (
              <>
                {renderEnhanceMenuContent(enhanceMenuData, {
                  activeMenuSelectionInput: question.activeMenuSelectionInput,
                  onChooseSelectionInput: (selectionInput) =>
                    controller?.chooseQuestionChoice(selectionInput),
                  onFocusSelectionInput: (selectionInput) =>
                    controller?.syncQuestionSelectionFocus(selectionInput),
                })}
                <div className="nh3d-menu-actions">
                  <button
                    className={`nh3d-menu-action-button nh3d-menu-action-cancel${question.activeActionButton === "cancel"
                      ? " nh3d-action-button-active"
                      : ""
                      }`}
                    autoFocus={question.activeActionButton === "cancel"}
                    onClick={() => controller?.cancelActivePrompt()}
                    onFocus={() =>
                      controller?.syncQuestionActionFocus("cancel")
                    }
                    type="button"
                  >
                    {commonStrings.cancel}
                  </button>
                </div>
              </>
            ) : castMenuData ? (
              <>
                <CastSpellMenu
                  activeSelectionInput={question.activeMenuSelectionInput}
                  menuData={castMenuData}
                  onFocusSpell={(selectionInput) =>
                    controller?.syncQuestionSelectionFocus(selectionInput)
                  }
                  onChooseSpell={(selectionInput) =>
                    controller?.chooseQuestionChoice(selectionInput)
                  }
                />
                <div className="nh3d-menu-actions">
                  <button
                    className={`nh3d-menu-action-button nh3d-menu-action-cancel${question.activeActionButton === "cancel"
                      ? " nh3d-action-button-active"
                      : ""
                      }`}
                    autoFocus={question.activeActionButton === "cancel"}
                    onClick={() => controller?.cancelActivePrompt()}
                    onFocus={() =>
                      controller?.syncQuestionActionFocus("cancel")
                    }
                    type="button"
                  >
                    {commonStrings.cancel}
                  </button>
                </div>
              </>
            ) : techniqueMenuData ? (
              <>
                <TechniqueMenu
                  activeSelectionInput={question.activeMenuSelectionInput}
                  menuData={techniqueMenuData}
                  onFocusTechnique={(selectionInput) =>
                    controller?.syncQuestionSelectionFocus(selectionInput)
                  }
                  onChooseTechnique={(selectionInput) =>
                    controller?.chooseQuestionChoice(selectionInput)
                  }
                />
                <div className="nh3d-menu-actions">
                  <button
                    className={`nh3d-menu-action-button nh3d-menu-action-cancel${question.activeActionButton === "cancel"
                      ? " nh3d-action-button-active"
                      : ""
                      }`}
                    autoFocus={question.activeActionButton === "cancel"}
                    onClick={() => controller?.cancelActivePrompt()}
                    onFocus={() =>
                      controller?.syncQuestionActionFocus("cancel")
                    }
                    type="button"
                  >
                    {commonStrings.cancel}
                  </button>
                </div>
              </>
            ) : (
              <>
                {displayedQuestionMenuItems.map((item, index) => {
                  if (!isSelectableQuestionMenuItem(item)) {
                    if (
                      isReadOnlyQuestionOptionMenuItem(item, question.text)
                    ) {
                      return (
                        <button
                          className="nh3d-menu-button nh3d-menu-button-readonly"
                          disabled
                          key={`readonly-${index}`}
                          type="button"
                        >
                          <span className="nh3d-menu-button-key">{"-"}</span>
                          <span className="nh3d-menu-button-label">
                            {String(item.text || "").trimStart()}
                          </span>
                        </button>
                      );
                    }
                    return (
                      <div
                        className={
                          item.isCategory
                            ? "nh3d-menu-category"
                            : "nh3d-menu-row"
                        }
                        key={`cat-${index}`}
                      >
                        {item.text}
                      </div>
                    );
                  }
                  const tileApplicable =
                    tilesUiEnabled && isMenuItemTileApplicable(item);
                  const tileIndex = tileApplicable
                    ? resolveMenuItemTileIndex(item)
                    : null;
                  const tilePreview = renderMenuItemTilePreview(
                    item,
                    tileIndex,
                  );
                  const fallbackGlyph = resolveMenuItemFallbackGlyph(item);
                  const selectionInput = getMenuSelectionInput(item);
                  const isActiveSelection =
                    question.activeActionButton === null &&
                    question.activeMenuSelectionInput === selectionInput;
                  return (
                    <button
                      className={`nh3d-menu-button${isActiveSelection ? " nh3d-menu-button-active" : ""
                        }`}
                      autoFocus={isActiveSelection}
                      key={`menu-${selectionInput}-${index}`}
                      onClick={() =>
                        controller?.chooseQuestionChoice(selectionInput)
                      }
                      onFocus={() =>
                        controller?.syncQuestionSelectionFocus(selectionInput)
                      }
                      type="button"
                    >
                      <span className="nh3d-question-item-leading">
                        {tileApplicable ? (
                          <span
                            className="nh3d-question-item-icon-shell"
                            aria-hidden="true"
                          >
                            {tilePreview ? (
                              <span className="nh3d-question-item-icon-art">
                                {tilePreview}
                              </span>
                            ) : (
                              <span className="nh3d-question-item-icon-fallback">
                                {fallbackGlyph}
                              </span>
                            )}
                          </span>
                        ) : null}
                        <span className="nh3d-menu-button-key">
                          {item.accelerator})
                        </span>
                      </span>
                      <span className="nh3d-menu-button-label">
                        {item.text}
                      </span>
                    </button>
                  );
                })}
                {questionSelectableMenuItemCount > 0 ? (
                  <div className="nh3d-menu-actions">
                    <button
                      className={`nh3d-menu-action-button nh3d-menu-action-cancel${question.activeActionButton === "cancel"
                        ? " nh3d-action-button-active"
                        : ""
                        }`}
                      autoFocus={question.activeActionButton === "cancel"}
                      onClick={() => controller?.cancelActivePrompt()}
                      onFocus={() =>
                        controller?.syncQuestionActionFocus("cancel")
                      }
                      type="button"
                    >
                      {commonStrings.cancel}
                    </button>
                  </div>
                ) : null}
              </>
            )
          ) : shouldRenderQuestionTextInput ? (
            <>
              <input
                aria-label={
                  displayedQuestionText || t.dialogs.textInput.placeholder
                }
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                autoFocus
                className="nh3d-text-input nh3d-question-text-input"
                inputMode="text"
                maxLength={1}
                onChange={(event) =>
                  setQuestionTextInputValue(event.target.value)
                }
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitQuestionTextInput();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    controller?.cancelActivePrompt();
                  }
                }}
                placeholder={t.dialogs.textInput.placeholder}
                ref={questionTextInputRef}
                spellCheck={false}
                type="text"
                value={questionTextInputValue}
              />
              <div className="nh3d-menu-actions">
                <button
                  className="nh3d-menu-action-button nh3d-menu-action-confirm"
                  onClick={submitQuestionTextInput}
                  type="button"
                >
                  {t.dialogs.textInput.ok}
                </button>
                <button
                  className="nh3d-menu-action-button nh3d-menu-action-cancel"
                  onClick={() => controller?.cancelActivePrompt()}
                  type="button"
                >
                  {commonStrings.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="nh3d-overflow-glow-frame">
                <div
                  className={`nh3d-choice-list${useCompactQuestionChoiceLayout ? " is-compact" : ""
                    }${isYesNoQuestionChoices ? " is-yes-no" : ""}${useSlashEmLegacyShortcutChoiceDialog
                      ? " nh3d-choice-list-legacy-shortcuts"
                      : ""
                    }`}
                  data-nh3d-overflow-glow
                  data-nh3d-overflow-glow-host="parent"
                >
                  {orderedQuestionChoices.map((choice, index) => {
                    const normalizedChoice = choice.trim();
                    const choiceSourceItem = useInventoryChoiceLabels
                      ? getInventoryItemForQuestionChoice(
                        normalizedChoice,
                        questionChoiceSourceItems,
                      )
                      : null;
                    const choiceSourceItemTileApplicable =
                      Boolean(choiceSourceItem) &&
                      isMenuItemTileApplicable(choiceSourceItem);
                    const legacyChoicePreviewTileIndex =
                      useSlashEmLegacyShortcutChoiceDialog &&
                        normalizedChoice === "."
                        ? controller?.resolveLegacyQuestionChoicePreviewTileIndex(
                          normalizedChoice,
                        ) ?? null
                        : null;
                    const resolvedChoiceTileIndex =
                      legacyChoicePreviewTileIndex ??
                      (choiceSourceItemTileApplicable && choiceSourceItem
                        ? resolveMenuItemTileIndex(choiceSourceItem)
                        : null);
                    const tileApplicable =
                      tilesUiEnabled &&
                      (choiceSourceItemTileApplicable ||
                        legacyChoicePreviewTileIndex !== null);
                    const tileIndex = tileApplicable
                      ? resolvedChoiceTileIndex
                      : null;
                    const tilePreview = renderMenuItemTilePreview(
                      choiceSourceItem,
                      tileIndex,
                    );
                    const fallbackGlyph = resolveMenuItemFallbackGlyph(
                      choiceSourceItem,
                      normalizedChoice.charAt(0) || "?",
                    );
                    return (
                      <button
                        className={`nh3d-choice-button${choice === question.defaultChoice
                          ? " nh3d-choice-button-default"
                          : ""
                          }${tileApplicable ? " nh3d-choice-button-with-tile" : ""
                          }`}
                        autoFocus={
                          question.activeActionButton === null &&
                          (choice === question.defaultChoice ||
                            (question.defaultChoice === "" && index === 0))
                        }
                        data-nh3d-choice-value={choice}
                        key={choice}
                        onClick={() =>
                          controller?.chooseQuestionChoice(choice)
                        }
                        type="button"
                      >
                        {tileApplicable ? (
                          <span
                            className="nh3d-question-item-icon-shell"
                            aria-hidden="true"
                          >
                            {tilePreview ? (
                              <span className="nh3d-question-item-icon-art">
                                {tilePreview}
                              </span>
                            ) : (
                              <span className="nh3d-question-item-icon-fallback">
                                {fallbackGlyph}
                              </span>
                            )}
                          </span>
                        ) : null}
                        <span className="nh3d-choice-button-item-label">
                          {getQuestionChoiceLabel(
                            question.text,
                            normalizedChoice,
                            questionChoiceSourceItems,
                            activeRuntimeVersion,
                            useInventoryChoiceLabels,
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {showQuestionCancelButton ? (
                <div className="nh3d-menu-actions">
                  <button
                    className={`nh3d-menu-action-button nh3d-menu-action-cancel${question.activeActionButton === "cancel"
                      ? " nh3d-action-button-active"
                      : ""
                      }`}
                    autoFocus={question.activeActionButton === "cancel"}
                    onClick={() => controller?.cancelActivePrompt()}
                    onFocus={() =>
                      controller?.syncQuestionActionFocus("cancel")
                    }
                    type="button"
                  >
                    {commonStrings.cancel}
                  </button>
                </div>
              ) : null}
            </>
          )}
          {question.menuItems.length > 0 && questionMenuPageCount > 1 ? (
            <div className="nh3d-question-pagination">
              <button
                className="nh3d-question-page-button"
                disabled={questionMenuPageIndex <= 0}
                onClick={() => controller?.goToPreviousQuestionMenuPage()}
                type="button"
              >
                {"<"}
              </button>
              <div className="nh3d-question-page-indicator">
                {t.dialogs.question.page(
                  questionMenuPageIndex + 1,
                  questionMenuPageCount,
                )}
              </div>
              <button
                className="nh3d-question-page-button"
                disabled={questionMenuPageIndex >= questionMenuPageCount - 1}
                onClick={() => controller?.goToNextQuestionMenuPage()}
                type="button"
              >
                {">"}
              </button>
            </div>
          ) : null}
          <div className="nh3d-dialog-hint">
            {question.menuItems.length > 0 && questionMenuPageCount > 1
              ? t.dialogs.question.pageHintMultiple
              : t.dialogs.question.pageHintSingle}
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
