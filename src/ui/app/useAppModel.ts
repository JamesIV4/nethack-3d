import { useDialogInteractionState } from "./layout/use-dialog-interaction-state";
import { useStartupControllerCursorState } from "./controller/use-startup-controller";
import {
  useStartupState,
  useStartupState2,
} from "./startup/use-startup-state";
import {
  useTextInputRef,
  useTextInputState,
  useTextInputReset,
  useTextInputSubmit,
} from "./prompts/use-text-input";
import {
  useTopScoresState,
  useTopScoresView,
  useTopScoresActions,
} from "./scores/use-top-scores";
import {
  useSavedGameSections,
} from "./startup/use-saved-game-sections";
import {
  useTopScoreTimelineView,
} from "./scores/use-top-score-timeline";
import {
  useStartupSelection,
} from "./startup/use-startup-selection";
import {
  useCharacterCreation,
} from "./startup/use-character-creation";
import {
  useClientOptionsState,
} from "./settings/use-client-options-state";
import {
  useTilesetDialogState,
} from "./settings/use-tileset-dialog-state";
import {
  useOverlayState,
  useOverlayState2,
} from "./layout/use-overlay-state";
import {
  useControllerSettingsState,
} from "./settings/use-controller-settings-state";
import {
  useTilesetState,
} from "./settings/use-tileset-state";
import {
  useMobileLayoutState,
  useMobileLayoutScaleRef,
  useMobileLayoutEffects,
} from "./layout/use-mobile-layout";
import {
  useCommandActionsState,
  useCommandActionsRefs,
  useCommandActionsCommands,
  useCommandActionsEffects,
} from "./actions/use-command-actions";
import {
  useDebugState,
} from "./diagnostics/use-debug-state";
import {
  useCharacterSheetState,
  useCharacterSheetView,
  useCharacterSheetInterception,
  useCharacterSheetActions,
  useCharacterSheetCommands,
} from "./character/use-character-sheet";
import {
  usePlayerStatusState,
  usePlayerStatusPresentation,
} from "./status/use-player-status";
import {
  useRunTimelineState,
  useRunTimelineTracking,
} from "./scores/use-run-timeline";
import {
  useGameSessionState,
} from "./session/use-game-session-state";
import {
  useMessageHistoryState,
  useMessageHistoryView,
  useMessageHistoryNavigation,
} from "./messages/use-message-history";
import {
  useQuestionState,
  useQuestionModel,
  useQuestionInput,
  useQuestionFocus,
} from "./prompts/use-question";
import {
  useMessageLogStyle,
  useMessageLogEffects,
  useMessageLogView,
} from "./messages/use-message-log";
import {
  useDebugSessionLogs,
} from "./diagnostics/use-debug-session-logs";
import {
  useClientOptionsCssEffects,
} from "./settings/use-client-options-css-effects";
import {
  useOverflowGlow,
} from "./layout/use-overflow-glow";
import {
  useNewGameState,
} from "./startup/use-new-game-state";
import {
  useClientOptionsCatalog,
} from "./settings/use-client-options-catalog";
import {
  useTileContextState,
  useTileContextAnimation,
  useTileContextRetention,
  useTileContextPosition,
  useTileContextTitle,
  useTileContextActions,
  useTileContextEffects,
} from "./context/use-tile-context";
import {
  useInventoryContextStateRefs,
  useInventoryContextStateState,
  useInventoryContextStateSync,
  useInventoryContextStateAnimation,
  useInventoryContextStateSnapshot,
  useInventoryContextStateModel,
  useInventoryContextStatePresentation,
} from "./inventory/use-inventory-context-state";
import {
  useInventoryProximityHandlers,
  useInventoryProximityEffects,
} from "./inventory/use-inventory-proximity";
import {
  useTilePreviewModel,
} from "./tilesets/use-tile-preview-model";
import {
  useTilePreviews,
} from "./tilesets/use-tile-previews";
import {
  useTilesetManagerPreviews,
} from "./tilesets/use-tileset-manager-previews";
import {
  useEngineLifecycle,
} from "./session/use-engine-lifecycle";
import {
  useAppliedClientOptionsEffects,
} from "./settings/use-applied-client-options-effects";
import {
  useSettingsHydration,
} from "./settings/use-settings-hydration";
import {
  useTilesetAtlasEffects,
} from "./settings/use-tileset-atlas-effects";
import {
  useAppVisibility,
} from "./layout/use-app-visibility";
import {
  useVersionUpdates,
} from "./updates/use-version-updates";
import {
  useOverlayLifecycle,
} from "./layout/use-overlay-lifecycle";
import {
  useNewGamePrompt,
} from "./startup/use-new-game-prompt";
import {
  useStartupNavigation,
} from "./startup/use-startup-navigation";
import {
  useClientOptionsNavigation,
} from "./settings/use-client-options-navigation";
import {
  useTilesetManagerActions,
} from "./settings/use-tileset-manager-actions";
import {
  useClientOptionsActions,
} from "./settings/use-client-options-actions";
import {
  useControllerRemapping,
} from "./settings/use-controller-remapping";
import {
  useTilesetSelectionDraft,
} from "./settings/use-tileset-selection-draft";
import {
  useClientSliderDraft,
} from "./settings/use-client-slider-draft";
import {
  useDarkWallDraft,
} from "./settings/use-dark-wall-draft";
import {
  useTilesetBackgroundDraft,
} from "./settings/use-tileset-background-draft";
import {
  useTilesetPickerVisibility,
} from "./settings/use-tileset-picker-visibility";
import {
  useMobileDialogCloseButton,
} from "./layout/use-mobile-dialog-close-button";
import {
  useInventoryNavigationFocus,
  useInventoryNavigationContext,
} from "./inventory/use-inventory-navigation";
import {
  useInventoryDropActions,
  useInventoryDropVisibility,
  useInventoryDropReset,
} from "./inventory/use-inventory-drop";
import {
  useInventoryContextLifecycleStateSync,
  useInventoryContextLifecycleClose,
  useInventoryContextLifecycleEffects,
} from "./inventory/use-inventory-context-lifecycle";
import {
  useKeyboardOverlays,
} from "./layout/use-keyboard-overlays";
import {
  useStartupController,
} from "./controller/use-startup-controller";
import {
  usePauseMenu,
} from "./layout/use-pause-menu";

/**
 * Compose feature hooks in their original render/effect order. Dependency
 * getters preserve per-render closures, including reads of later bindings.
 * Each hook receives only the values it uses, never the complete app model.
 */
export function useAppModel() {
  const {
    startupDefaultCharacterPreferencesByRuntime,
    startupDefaultCharacterPreferences,
    startupCharacterPreferencesStateRuntimeRef,
    hasShownStartupMenu,
    setHasShownStartupMenu,
    canvasRootRef,
  } = useStartupState();

  const {
    textInputRef,
  } = useTextInputRef();

  const {
    startupRenderSignalSentRef,
    characterCreationConfig,
    setCharacterCreationConfig,
    startupFlowStep,
    setStartupFlowStep,
    runtimeVersion,
    setRuntimeVersion,
    activeRuntimeVersion,
    activeRuntimeVersionLabel,
    createRole,
    setCreateRole,
    createRace,
    setCreateRace,
    createGender,
    setCreateGender,
    createAlign,
    setCreateAlign,
    randomCharacterName,
    setRandomCharacterName,
    createCharacterName,
    setCreateCharacterName,
    startupCharacterPreferencesByRuntime,
    setStartupCharacterPreferencesByRuntime,
    hasHydratedStartupCharacterPreferences,
    setHasHydratedStartupCharacterPreferences,
    startupInitOptionsExpanded,
    setStartupInitOptionsExpanded,
    startupInitOptionValues,
    setStartupInitOptionValues,
    hasHydratedStartupInitOptions,
    setHasHydratedStartupInitOptions,
    savedGames,
    setSavedGames,
  } = useStartupState2({
    get startupDefaultCharacterPreferences() { return startupDefaultCharacterPreferences; },
    get startupDefaultCharacterPreferencesByRuntime() { return startupDefaultCharacterPreferencesByRuntime; },
  });

  const {
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
  } = useTopScoresState();

  const {
    savedGameSections,
  } = useSavedGameSections({
    get savedGames() { return savedGames; },
  });

  const {
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
  } = useTopScoresView({
    get topScores() { return topScores; },
    get topScoresSortId() { return topScoresSortId; },
    get topScoresDialogRuntime() { return topScoresDialogRuntime; },
    get topScoresLoading() { return topScoresLoading; },
    get setTopScoresSortMenuOpen() { return setTopScoresSortMenuOpen; },
    get topScoresPageIndex() { return topScoresPageIndex; },
    get selectedTopScore() { return selectedTopScore; },
  });

  const {
    selectedTopScoreTimelineFilters,
    setActiveTopScoreTimelineClusterId,
    selectedTopScoreTimelineFilterCounts,
    selectedTopScoreTimelineSummaryMetrics,
    selectedTopScoreTimelineModel,
    activeTopScoreTimelineCluster,
    toggleSelectedTopScoreTimelineFilter,
  } = useTopScoreTimelineView({
    get selectedTopScore() { return selectedTopScore; },
  });

  const {
    isLoadingSaves,
    startupUpdateCheckStartedRef,
    startupUpdateCheck,
    setStartupUpdateCheck,
    isStartupUpdateDialogVisible,
    setIsStartupUpdateDialogVisible,
    startupUpdateDetailsVisible,
    setStartupUpdateDetailsVisible,
    startupCreateCharacterOptionSet,
    normalizedCreateCharacterSelection,
    handleDeleteSave,
    handleResumeClick,
  } = useStartupSelection({
    get createRole() { return createRole; },
    get createRace() { return createRace; },
    get createGender() { return createGender; },
    get createAlign() { return createAlign; },
    get runtimeVersion() { return runtimeVersion; },
    get requestConfirmation() { return requestConfirmation; },
    get setSavedGames() { return setSavedGames; },
    get setStartupFlowStep() { return setStartupFlowStep; },
  });

  const {
    loadTopScoresForRuntime,
    openTopScoresDialog,
    closeTopScoresDialog,
  } = useTopScoresActions({
    get setTopScoresLoading() { return setTopScoresLoading; },
    get setTopScoresError() { return setTopScoresError; },
    get setTopScores() { return setTopScores; },
    get setTopScoresPageIndex() { return setTopScoresPageIndex; },
    get runtimeVersion() { return runtimeVersion; },
    get setTopScoresDialogRuntime() { return setTopScoresDialogRuntime; },
    get setSelectedTopScore() { return setSelectedTopScore; },
  });

  const {
    handleStartNewGame,
    updateStartupInitOptionValue,
    resetStartupInitOptionValues,
    startupInitOptionTokens,
  } = useCharacterCreation({
    get runtimeVersion() { return runtimeVersion; },
    get requestConfirmationChoice() { return requestConfirmationChoice; },
    get clientOptions() { return clientOptions; },
    get setClientOptions() { return setClientOptions; },
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get setCharacterCreationConfig() { return setCharacterCreationConfig; },
    get setStartupInitOptionValues() { return setStartupInitOptionValues; },
    get startupInitOptionValues() { return startupInitOptionValues; },
    get randomCharacterName() { return randomCharacterName; },
    get createCharacterName() { return createCharacterName; },
    get normalizedCreateCharacterSelection() { return normalizedCreateCharacterSelection; },
    get createRole() { return createRole; },
    get setCreateRole() { return setCreateRole; },
    get createRace() { return createRace; },
    get setCreateRace() { return setCreateRace; },
    get createGender() { return createGender; },
    get setCreateGender() { return setCreateGender; },
    get createAlign() { return createAlign; },
    get setCreateAlign() { return setCreateAlign; },
    get hasHydratedStartupCharacterPreferences() { return hasHydratedStartupCharacterPreferences; },
    get startupCharacterPreferencesStateRuntimeRef() { return startupCharacterPreferencesStateRuntimeRef; },
    get setStartupCharacterPreferencesByRuntime() { return setStartupCharacterPreferencesByRuntime; },
    get startupCharacterPreferencesByRuntime() { return startupCharacterPreferencesByRuntime; },
    get startupDefaultCharacterPreferencesByRuntime() { return startupDefaultCharacterPreferencesByRuntime; },
    get setRandomCharacterName() { return setRandomCharacterName; },
    get setCreateCharacterName() { return setCreateCharacterName; },
  });

  const {
    initialPersistedClientOptionsRef,
    clientOptions,
    setClientOptions,
    clientOptionsDraft,
    setClientOptionsDraft,
    manualSafeZonePreview,
    setManualSafeZonePreview,
    manualSafeZonePreviewTimerRef,
    hasHydratedUserTilesets,
    setHasHydratedUserTilesets,
    isClientOptionsVisible,
    setIsClientOptionsVisible,
    activeClientOptionsTab,
    setActiveClientOptionsTab,
    optionsUpdateCheckBusy,
    setOptionsUpdateCheckBusy,
    optionsUpdateCheckResult,
    setOptionsUpdateCheckResult,
    optionsUpdateCheckStatus,
    setOptionsUpdateCheckStatus,
  } = useClientOptionsState();

  const {
    isDarkWallTilePickerVisible,
    setIsDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    setIsTilesetBackgroundTilePickerVisible,
    isTilesetSolidColorPickerVisible,
    setIsTilesetSolidColorPickerVisible,
    isTilesetManagerVisible,
    setIsTilesetManagerVisible,
  } = useTilesetDialogState();

  const {
    isPauseMenuVisible,
    setIsPauseMenuVisible,
    isExitConfirmationVisible,
    setIsExitConfirmationVisible,
  } = useOverlayState();

  const {
    isResetClientOptionsConfirmationVisible,
    setIsResetClientOptionsConfirmationVisible,
    isControllerRemapVisible,
    setIsControllerRemapVisible,
    controllerRemapListening,
    setControllerRemapListening,
    hasAskedControllerSupportThisSession,
    setHasAskedControllerSupportThisSession,
    isControllerSupportPromptVisible,
    setIsControllerSupportPromptVisible,
  } = useControllerSettingsState();

  const {
    isDebugSessionLogsLinkVisible,
    setIsDebugSessionLogsLinkVisible,
  } = useOverlayState2();

  const {
    userTilesets,
    setUserTilesets,
    tilesetManagerMode,
    setTilesetManagerMode,
    tilesetManagerName,
    setTilesetManagerName,
    tilesetManagerTileLayoutVersion,
    setTilesetManagerTileLayoutVersion,
    tilesetManagerEditPath,
    setTilesetManagerEditPath,
    tilesetManagerFile,
    setTilesetManagerFile,
    tilesetManagerError,
    setTilesetManagerError,
    tilesetManagerBusy,
    setTilesetManagerBusy,
    tilesetManagerFileInputRef,
    tileAtlasImage,
    setTileAtlasImage,
    tileAtlasState,
    setTileAtlasState,
    tilesetManagerAtlasImage,
    setTilesetManagerAtlasImage,
    tilesetManagerAtlasState,
    setTilesetManagerAtlasState,
  } = useTilesetState();

  const {
    isMobileViewport,
    setIsMobileViewport,
  } = useMobileLayoutState();

  const {
    isMobileActionSheetVisible,
    setIsMobileActionSheetVisible,
    mobileActionSheetMode,
    setMobileActionSheetMode,
    isControllerActionWheelVisible,
    setIsControllerActionWheelVisible,
    controllerActionWheelMode,
    setControllerActionWheelMode,
    controllerActionWheelChosenIndex,
    setControllerActionWheelChosenIndex,
  } = useCommandActionsState();

  const {
    startupBuildLabelClickCount,
    setStartupBuildLabelClickCount,
    startupBuildLabelToastVisible,
    setStartupBuildLabelToastVisible,
    debugSessionLogsEnabled,
    setDebugSessionLogsEnabled,
    isDebugSessionLogsVisible,
    setIsDebugSessionLogsVisible,
    debugSessionLogs,
    setDebugSessionLogs,
    selectedDebugSessionLogId,
    setSelectedDebugSessionLogId,
  } = useDebugState();

  const {
    controllerActionWheelDialogRef,
    isMobileLogVisible,
    setIsMobileLogVisible,
    isWizardCommandsVisible,
    setIsWizardCommandsVisible,
    wizardCommandsButtonRef,
    wizardCommandsSheetRef,
  } = useCommandActionsRefs();

  const {
    characterSheetInterceptionArmed,
    setCharacterSheetInterceptionArmed,
    characterSheetAwaitingInfoRef,
  } = useCharacterSheetState();

  const {
    statsBarHeight,
    setStatsBarHeight,
    coreStatBoldUntilTurn,
    setCoreStatBoldUntilTurn,
    previousCoreStatSnapshotRef,
  } = usePlayerStatusState();

  const {
    textInputValue,
    setTextInputValue,
  } = useTextInputState();

  const {
    soundPackDialogActionsRef,
    globalConfirmationDialog,
    requestConfirmation,
    requestConfirmationChoice,
    resolveConfirmation,
    startupControllerPreviousActionActiveRef,
    startupAccordionConfirmReleaseLatchRef,
    startupControllerSliderInteractionActiveRef,
    startupControllerSliderStepCarryRef,
    startupControllerActiveSliderElementRef,
    startupControllerCursorElementRef,
    startupControllerCursorPulseElementRef,
    startupControllerCursorHighlightElementRef,
    startupControllerCursorPulseTimerRef,
    startupBuildLabelToastTimerRef,
  } = useDialogInteractionState();

  const {
    persistedTopScoreSignatureRef,
    persistedTopScoreSnapshotIdRef,
    topScoreTimelineEventsRef,
    previousTopScoreTimelineStatsRef,
    previousTopScoreTimelineMessagesRef,
    seenTopScoreTimelineSignaturesRef,
    visitedTopScoreLocationsRef,
  } = useRunTimelineState();

  const {
    startupControllerCursorVisibleRef,
    startupControllerCursorXRef,
    startupControllerCursorYRef,
  } = useStartupControllerCursorState();

  const {
    refreshMobileStatsCoreRowScaleRef,
  } = useMobileLayoutScaleRef();

  const {
    adapter,
    setEngineController,
    setPositionRequest,
    setFloatingMessageTiming,
    setNewGamePrompt,
    setGameOver,
    loadingVisible,
    statusText,
    gameMessages,
    floatingMessages,
    playerStats,
    question,
    directionQuestion,
    numberPadModeEnabled,
    infoMenu,
    inventory,
    textInputRequest,
    fpsCrosshairContext,
    repeatActionVisible,
    positionRequest,
    positionInputActive,
    positionInputOrigin,
    connectionState,
    extendedCommands,
    controller,
    newGamePrompt,
    gameOver,
  } = useGameSessionState();

  useRunTimelineTracking({
    get seenTopScoreTimelineSignaturesRef() { return seenTopScoreTimelineSignaturesRef; },
    get topScoreTimelineEventsRef() { return topScoreTimelineEventsRef; },
    get persistedTopScoreSignatureRef() { return persistedTopScoreSignatureRef; },
    get persistedTopScoreSnapshotIdRef() { return persistedTopScoreSnapshotIdRef; },
    get previousTopScoreTimelineStatsRef() { return previousTopScoreTimelineStatsRef; },
    get previousTopScoreTimelineMessagesRef() { return previousTopScoreTimelineMessagesRef; },
    get visitedTopScoreLocationsRef() { return visitedTopScoreLocationsRef; },
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get characterCreationConfig() { return characterCreationConfig; },
    get playerStats() { return playerStats; },
    get gameMessages() { return gameMessages; },
    get gameOver() { return gameOver; },
    get inventory() { return inventory; },
  });

  const {
    messageInfoMenuHistory,
    setMessageInfoMenuHistory,
  } = useMessageHistoryState();

  const {
    questionTextInputRef,
    questionTextInputValue,
    setQuestionTextInputValue,
  } = useQuestionState({
    get setMessageInfoMenuHistory() { return setMessageInfoMenuHistory; },
    get characterCreationConfig() { return characterCreationConfig; },
  });

  const {
    displayedInfoMenu,
  } = useMessageHistoryView({
    get infoMenu() { return infoMenu; },
    get setMessageInfoMenuHistory() { return setMessageInfoMenuHistory; },
    get messageInfoMenuHistory() { return messageInfoMenuHistory; },
  });

  const {
    characterSheet,
    isLegacySlashEmBaseAttributesSheet,
    displayedCharacterStatEntries,
    isCharacterSheetVisible,
    hasCharacterStatValues,
    hasCharacterStatLimits,
    showLegacySlashEmDeitiesPanel,
    characterExperienceProgress,
  } = useCharacterSheetView({
    get displayedInfoMenu() { return displayedInfoMenu; },
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get playerStats() { return playerStats; },
    get characterSheetInterceptionArmed() { return characterSheetInterceptionArmed; },
  });

  const {
    floatingMessageTextStyle,
  } = useMessageLogStyle({
    get clientOptions() { return clientOptions; },
  });

  const {
    refreshDebugSessionLogs,
    openDebugSessionLogsDialog,
    handleStartupBuildLabelClick,
    selectedDebugSessionLog,
    selectedDebugSessionLogText,
  } = useDebugSessionLogs({
    get startupBuildLabelToastTimerRef() { return startupBuildLabelToastTimerRef; },
    get setDebugSessionLogs() { return setDebugSessionLogs; },
    get setSelectedDebugSessionLogId() { return setSelectedDebugSessionLogId; },
    get setIsDebugSessionLogsVisible() { return setIsDebugSessionLogsVisible; },
    get debugSessionLogsEnabled() { return debugSessionLogsEnabled; },
    get setStartupBuildLabelClickCount() { return setStartupBuildLabelClickCount; },
    get setDebugSessionLogsEnabled() { return setDebugSessionLogsEnabled; },
    get setIsDebugSessionLogsLinkVisible() { return setIsDebugSessionLogsLinkVisible; },
    get setStartupBuildLabelToastVisible() { return setStartupBuildLabelToastVisible; },
    get debugSessionLogs() { return debugSessionLogs; },
    get selectedDebugSessionLogId() { return selectedDebugSessionLogId; },
  });

  useClientOptionsCssEffects({
    get clientOptions() { return clientOptions; },
  });

  useOverflowGlow();

  const {
    reopenNewGamePromptOnInteraction,
    setReopenNewGamePromptOnInteraction,
    deferredNewGamePromptReason,
    setDeferredNewGamePromptReason,
    newGamePromptYesButtonRef,
    newGamePromptNoButtonRef,
    startupLikelyOpenSelectElementsRef,
    startupLikelyOpenSelectInitialValueByElementRef,
  } = useNewGameState();

  const {
    clientOptionsLikelyOpenSelectElementsRef,
    clientOptionsLikelyOpenSelectInitialValueByElementRef,
    tilesetCatalog,
    showDeveloperClientSettings,
    userTilesetRecordByPath,
    tilesetManagerListTilesets,
    hasAnyTilesets,
    tilesetDropdownOptions,
    selectedClientOptionsTab,
    visibleClientOptions,
    controllerRemapListeningActionLabel,
    connectedControllerCount,
  } = useClientOptionsCatalog({
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get userTilesets() { return userTilesets; },
    get hasHydratedUserTilesets() { return hasHydratedUserTilesets; },
    get startupFlowStep() { return startupFlowStep; },
    get characterCreationConfig() { return characterCreationConfig; },
    get clientOptions() { return clientOptions; },
    get setClientOptions() { return setClientOptions; },
    get clientOptionsDraft() { return clientOptionsDraft; },
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get activeClientOptionsTab() { return activeClientOptionsTab; },
    get controllerRemapListening() { return controllerRemapListening; },
    get isControllerRemapVisible() { return isControllerRemapVisible; },
  });

  const {
    isFpsPlayMode,
    fpsCrosshairContextMenuRef,
    fpsCrosshairContextLastVisibleRef,
    tileContextMenuPosition,
    setTileContextMenuPosition,
    tileContextMenuPositionLastVisibleRef,
  } = useTileContextState({
    get clientOptions() { return clientOptions; },
  });

  const {
    inventoryItemActions,
    inventoryContextMenuRef,
    inventoryDropTypeMenuRef,
    inventoryDropActionButtonRef,
    inventoryDialogRef,
    inventoryItemsContainerRef,
    inventoryRowRefs,
    inventoryContextMenuStateRef,
    inventoryContextMenuLastVisibleRef,
    inventoryRowHoverValueByIndexRef,
    inventoryKeyboardActivationKeysDownRef,
    inventoryContextMenuKeyboardOpenPendingRef,
    inventoryPointerClientYRef,
    inventoryPointerActiveRef,
    inventoryRowProximityAnimationFrameRef,
    inventoryTouchFallbackClearTimerRef,
    inventoryRowPressCandidateRef,
    inventoryDropTypeHoldStateRef,
    inventoryDropTypeHoldAnimationFrameRef,
    inventorySuppressDropActionClickRef,
    tilesUiEnabled,
    inventoryAsciiModeEnabled,
    inventoryReducedMotionEnabled,
    inventoryTileOnlyMotionEnabled,
    inventoryUsesFullRowAnimation,
    inventoryFixedTileSizeMode,
    inventoryFixedIconSizePx,
  } = useInventoryContextStateRefs({
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get clientOptions() { return clientOptions; },
  });

  const {
    fpsContextTitleAnimationInstance,
    setFpsContextTitleAnimationInstance,
  } = useTileContextAnimation();

  const {
    inventoryContextMenu,
    setInventoryContextMenu,
    inventoryContextTitleAnimationInstance,
    setInventoryContextTitleAnimationInstance,
    inventoryDropTypeMenuPosition,
    setInventoryDropTypeMenuPosition,
    inventoryDropCountDialog,
    setInventoryDropCountDialog,
    inventoryDropCountValue,
    setInventoryDropCountValue,
    inventoryDropCountSliderRef,
  } = useInventoryContextStateState();

  useInventoryContextStateSync({
    get fpsCrosshairContext() { return fpsCrosshairContext; },
    get fpsCrosshairContextLastVisibleRef() { return fpsCrosshairContextLastVisibleRef; },
  });

  useTileContextRetention({
    get fpsCrosshairContext() { return fpsCrosshairContext; },
    get setFpsContextTitleAnimationInstance() { return setFpsContextTitleAnimationInstance; },
  });

  useInventoryContextStateAnimation({
    get tileContextMenuPosition() { return tileContextMenuPosition; },
    get tileContextMenuPositionLastVisibleRef() { return tileContextMenuPositionLastVisibleRef; },
    get inventoryContextMenuStateRef() { return inventoryContextMenuStateRef; },
    get inventoryContextMenu() { return inventoryContextMenu; },
    get inventoryContextMenuLastVisibleRef() { return inventoryContextMenuLastVisibleRef; },
    get setInventoryContextTitleAnimationInstance() { return setInventoryContextTitleAnimationInstance; },
  });

  const {
    fpsCrosshairContextRenderState,
    tileContextMenuRenderPosition,
  } = useTileContextPosition({
    get inventoryContextMenu() { return inventoryContextMenu; },
    get inventoryContextMenuKeyboardOpenPendingRef() { return inventoryContextMenuKeyboardOpenPendingRef; },
    get inventoryContextMenuRef() { return inventoryContextMenuRef; },
    get fpsCrosshairContext() { return fpsCrosshairContext; },
    get fpsCrosshairContextLastVisibleRef() { return fpsCrosshairContextLastVisibleRef; },
    get tileContextMenuPosition() { return tileContextMenuPosition; },
    get tileContextMenuPositionLastVisibleRef() { return tileContextMenuPositionLastVisibleRef; },
  });

  const {
    inventoryContextMenuRenderState,
  } = useInventoryContextStateSnapshot({
    get inventoryContextMenu() { return inventoryContextMenu; },
    get inventoryContextMenuLastVisibleRef() { return inventoryContextMenuLastVisibleRef; },
  });

  const {
    fpsContextTitle,
    fpsContextTitleAnimationKey,
    fpsContextTitleScroll,
  } = useTileContextTitle({
    get fpsCrosshairContextRenderState() { return fpsCrosshairContextRenderState; },
    get fpsContextTitleAnimationInstance() { return fpsContextTitleAnimationInstance; },
  });

  const {
    inventoryContextTitle,
    inventoryContextTitleAnimationKey,
    inventoryContextTitleScroll,
    inventoryContextSupportsDropAmount,
    inventoryDropCountMaxValue,
    inventoryContextMenuActions,
    getInventoryContextMenuClampRegion,
  } = useInventoryContextStateModel({
    get inventoryContextMenuRenderState() { return inventoryContextMenuRenderState; },
    get inventoryContextTitleAnimationInstance() { return inventoryContextTitleAnimationInstance; },
    get inventory() { return inventory; },
    get inventoryContextMenu() { return inventoryContextMenu; },
    get inventoryDropCountDialog() { return inventoryDropCountDialog; },
    get inventoryItemActions() { return inventoryItemActions; },
    get inventoryDialogRef() { return inventoryDialogRef; },
    get inventoryItemsContainerRef() { return inventoryItemsContainerRef; },
  });

  const {
    scheduleInventoryRowProximityUpdate,
    clearInventoryTouchFallbackClearTimer,
    normalizeInventoryActivationKey,
    setInventoryRowRef,
    handleInventoryPointerUpdate,
    handleInventoryPointerLeave,
    handleInventoryPointerUp,
    handleInventoryPointerCancel,
    handleInventoryTouchUpdate,
    handleInventoryTouchEnd,
    handleInventoryTouchCancel,
    handleInventoryTouchMove,
    handleInventoryItemsScroll,
    beginInventoryRowPressCandidate,
    handleInventoryRowPointerDownCapture,
    handleInventoryRowTouchStartCapture,
  } = useInventoryProximityHandlers({
    get inventoryRowProximityAnimationFrameRef() { return inventoryRowProximityAnimationFrameRef; },
    get inventoryRowRefs() { return inventoryRowRefs; },
    get inventoryRowHoverValueByIndexRef() { return inventoryRowHoverValueByIndexRef; },
    get inventoryReducedMotionEnabled() { return inventoryReducedMotionEnabled; },
    get inventoryPointerClientYRef() { return inventoryPointerClientYRef; },
    get inventoryPointerActiveRef() { return inventoryPointerActiveRef; },
    get inventoryItemsContainerRef() { return inventoryItemsContainerRef; },
    get inventoryContextMenuRef() { return inventoryContextMenuRef; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get getInventoryContextMenuClampRegion() { return getInventoryContextMenuClampRegion; },
    get inventoryTouchFallbackClearTimerRef() { return inventoryTouchFallbackClearTimerRef; },
    get inventory() { return inventory; },
    get inventoryRowPressCandidateRef() { return inventoryRowPressCandidateRef; },
    get inventoryUsesFullRowAnimation() { return inventoryUsesFullRowAnimation; },
    get inventoryContextMenu() { return inventoryContextMenu; },
    get openInventoryContextMenu() { return openInventoryContextMenu; },
  });

  const {
    representativeGlyphByTileId,
    representativeGlyphNumberByTileId,
    showTilePickerGlyphNumber,
    defaultDarkWallTileId,
    defaultDarkWallSolidColorHex,
    defaultDarkWallSolidColorHexFps,
    selectedDarkWallTileId,
    selectedDarkWallSolidColorHex,
    selectedDarkWallSolidColorHexFps,
    selectedDarkWallSolidColorGridEnabled,
    selectedDarkWallSolidColorGridDarknessPercent,
    selectedDarkWallGlyphLabel,
    selectedDarkWallGlyphNumber,
    selectedTilesetManagerEditPath,
    selectedTilesetManagerEditEntry,
    selectedTilesetManagerEditUserRecord,
    tilesetManagerInNewMode,
    tilesetManagerNameInputDisabled,
    tilesetManagerDefaultBackgroundTileId,
    tilesetManagerBackgroundTileId,
    tilesetManagerBackgroundRemovalMode,
    tilesetManagerBackgroundRemovalSettingsLocked,
    tilesetManagerSolidChromaKeyColorHex,
    tilesetManagerWeaponSpriteFlipX,
    tilesetManagerBackgroundGlyphLabel,
    tilesetManagerBackgroundGlyphNumber,
    selectedTilesetEntry,
    selectedTileAtlasLoadRequested,
    isVultureTilesetSelected,
  } = useTilePreviewModel({
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get clientOptionsDraft() { return clientOptionsDraft; },
    get tilesetManagerEditPath() { return tilesetManagerEditPath; },
    get tilesetCatalog() { return tilesetCatalog; },
    get userTilesetRecordByPath() { return userTilesetRecordByPath; },
    get tilesetManagerMode() { return tilesetManagerMode; },
    get characterCreationConfig() { return characterCreationConfig; },
  });

  const {
    tilePickerEntries,
    tilePickerStatusText,
    renderTilePreviewImageForOptions,
    renderTopScoreInventoryPreview,
    renderMenuItemTilePreview,
  } = useTilePreviews({
    get tileAtlasState() { return tileAtlasState; },
    get representativeGlyphByTileId() { return representativeGlyphByTileId; },
    get representativeGlyphNumberByTileId() { return representativeGlyphNumberByTileId; },
    get selectedTilesetEntry() { return selectedTilesetEntry; },
    get selectedTileAtlasLoadRequested() { return selectedTileAtlasLoadRequested; },
    get tileAtlasImage() { return tileAtlasImage; },
    get clientOptions() { return clientOptions; },
    get activeRuntimeVersion() { return activeRuntimeVersion; },
  });

  const {
    tilesetManagerTilePickerEntries,
    tilesetManagerTilePickerStatusText,
    renderTilesetManagerTilePreviewImage,
  } = useTilesetManagerPreviews({
    get tilesetManagerAtlasState() { return tilesetManagerAtlasState; },
    get representativeGlyphByTileId() { return representativeGlyphByTileId; },
    get representativeGlyphNumberByTileId() { return representativeGlyphNumberByTileId; },
    get selectedTilesetManagerEditEntry() { return selectedTilesetManagerEditEntry; },
    get tilesetManagerAtlasImage() { return tilesetManagerAtlasImage; },
  });

  useEngineLifecycle({
    get canvasRootRef() { return canvasRootRef; },
    get characterCreationConfig() { return characterCreationConfig; },
    get adapter() { return adapter; },
    get clientOptions() { return clientOptions; },
    get setEngineController() { return setEngineController; },
  });

  useAppliedClientOptionsEffects({
    get controller() { return controller; },
    get clientOptions() { return clientOptions; },
    get isControllerSupportPromptVisible() { return isControllerSupportPromptVisible; },
    get hasHydratedUserTilesets() { return hasHydratedUserTilesets; },
  });

  useSettingsHydration({
    get hasHydratedStartupCharacterPreferences() { return hasHydratedStartupCharacterPreferences; },
    get startupDefaultCharacterPreferencesByRuntime() { return startupDefaultCharacterPreferencesByRuntime; },
    get setStartupCharacterPreferencesByRuntime() { return setStartupCharacterPreferencesByRuntime; },
    get runtimeVersion() { return runtimeVersion; },
    get setRandomCharacterName() { return setRandomCharacterName; },
    get setCreateCharacterName() { return setCreateCharacterName; },
    get setCreateRole() { return setCreateRole; },
    get setCreateRace() { return setCreateRace; },
    get setCreateGender() { return setCreateGender; },
    get setCreateAlign() { return setCreateAlign; },
    get startupCharacterPreferencesStateRuntimeRef() { return startupCharacterPreferencesStateRuntimeRef; },
    get setHasHydratedStartupCharacterPreferences() { return setHasHydratedStartupCharacterPreferences; },
    get startupCharacterPreferencesByRuntime() { return startupCharacterPreferencesByRuntime; },
    get setStartupInitOptionValues() { return setStartupInitOptionValues; },
    get setHasHydratedStartupInitOptions() { return setHasHydratedStartupInitOptions; },
    get hasHydratedStartupInitOptions() { return hasHydratedStartupInitOptions; },
    get startupInitOptionValues() { return startupInitOptionValues; },
  });

  useTilesetAtlasEffects({
    get characterCreationConfig() { return characterCreationConfig; },
    get selectedTilesetEntry() { return selectedTilesetEntry; },
    get setTileAtlasState() { return setTileAtlasState; },
    get setTileAtlasImage() { return setTileAtlasImage; },
    get isTilesetManagerVisible() { return isTilesetManagerVisible; },
    get selectedTilesetManagerEditEntry() { return selectedTilesetManagerEditEntry; },
    get setTilesetManagerAtlasState() { return setTilesetManagerAtlasState; },
    get setTilesetManagerAtlasImage() { return setTilesetManagerAtlasImage; },
    get tileAtlasState() { return tileAtlasState; },
    get tileAtlasImage() { return tileAtlasImage; },
  });

  useMobileLayoutEffects({
    get setIsMobileViewport() { return setIsMobileViewport; },
    get setStatsBarHeight() { return setStatsBarHeight; },
    get characterCreationConfig() { return characterCreationConfig; },
    get connectionState() { return connectionState; },
    get loadingVisible() { return loadingVisible; },
    get isMobileViewport() { return isMobileViewport; },
    get newGamePrompt() { return newGamePrompt; },
    get infoMenu() { return infoMenu; },
    get question() { return question; },
    get gameOver() { return gameOver; },
    get statsBarHeight() { return statsBarHeight; },
    get refreshMobileStatsCoreRowScaleRef() { return refreshMobileStatsCoreRowScaleRef; },
  });

  const {
    isMobileGameRunning,
    isDesktopGameRunning,
    terminalDesktopGutterVisible,
    startup,
    startupUiVisible,
    loadingOverlayVisible,
    loadingSubtitle,
    startupInitialLoadingVisible,
    startupMenuVisible,
    startupUpdateDialogOpen,
    startupUpdateExpanded,
    newGameDialogVisible,
    gameOverTombstoneLines,
    gameOverDialogShowsTombstone,
    asciiLogoVisible,
    mobileTouchUiVisible,
    positionInputInstruction,
    positionDialogVisible,
    hideAllUiForDeferredGameOver,
    runtimeInitializationErrorVisible,
    runtimeInitializationErrorMessage,
    startupSelectedRuntimeVersionLabel,
    startupVariantDialogVisible,
    startupChooseDialogVisible,
    startupResumeDialogVisible,
    startupRandomDialogVisible,
    startupCreateDialogVisible,
    startupPendingUpdateCount,
    startupPendingUpdateTags,
    startupCurrentVersionLabel,
    startupLatestVersionLabel,
  } = useAppVisibility({
    get isMobileViewport() { return isMobileViewport; },
    get clientOptions() { return clientOptions; },
    get characterCreationConfig() { return characterCreationConfig; },
    get connectionState() { return connectionState; },
    get loadingVisible() { return loadingVisible; },
    get hasHydratedUserTilesets() { return hasHydratedUserTilesets; },
    get hasHydratedStartupCharacterPreferences() { return hasHydratedStartupCharacterPreferences; },
    get hasHydratedStartupInitOptions() { return hasHydratedStartupInitOptions; },
    get selectedTileAtlasLoadRequested() { return selectedTileAtlasLoadRequested; },
    get selectedTilesetEntry() { return selectedTilesetEntry; },
    get tileAtlasState() { return tileAtlasState; },
    get isTilesetManagerVisible() { return isTilesetManagerVisible; },
    get selectedTilesetManagerEditEntry() { return selectedTilesetManagerEditEntry; },
    get tilesetManagerAtlasState() { return tilesetManagerAtlasState; },
    get hasShownStartupMenu() { return hasShownStartupMenu; },
    get isStartupUpdateDialogVisible() { return isStartupUpdateDialogVisible; },
    get startupUpdateDetailsVisible() { return startupUpdateDetailsVisible; },
    get newGamePrompt() { return newGamePrompt; },
    get infoMenu() { return infoMenu; },
    get question() { return question; },
    get gameOver() { return gameOver; },
    get positionInputActive() { return positionInputActive; },
    get positionInputOrigin() { return positionInputOrigin; },
    get positionRequest() { return positionRequest; },
    get reopenNewGamePromptOnInteraction() { return reopenNewGamePromptOnInteraction; },
    get gameMessages() { return gameMessages; },
    get statusText() { return statusText; },
    get startupFlowStep() { return startupFlowStep; },
    get runtimeVersion() { return runtimeVersion; },
    get setStartupBuildLabelClickCount() { return setStartupBuildLabelClickCount; },
    get setStartupBuildLabelToastVisible() { return setStartupBuildLabelToastVisible; },
    get startupBuildLabelToastTimerRef() { return startupBuildLabelToastTimerRef; },
    get startupUpdateCheck() { return startupUpdateCheck; },
    get setHasShownStartupMenu() { return setHasShownStartupMenu; },
  });

  const {
    closeStartupUpdateDialog,
    toggleStartupUpdateDetails,
    openGitHubReleases,
    checkForUpdatesFromOptions,
  } = useVersionUpdates({
    get startupUiVisible() { return startupUiVisible; },
    get startupRenderSignalSentRef() { return startupRenderSignalSentRef; },
    get startupUpdateCheckStartedRef() { return startupUpdateCheckStartedRef; },
    get clientOptions() { return clientOptions; },
    get setStartupUpdateCheck() { return setStartupUpdateCheck; },
    get setStartupUpdateDetailsVisible() { return setStartupUpdateDetailsVisible; },
    get setIsStartupUpdateDialogVisible() { return setIsStartupUpdateDialogVisible; },
    get startupUpdateCheck() { return startupUpdateCheck; },
    get optionsUpdateCheckResult() { return optionsUpdateCheckResult; },
    get optionsUpdateCheckBusy() { return optionsUpdateCheckBusy; },
    get setOptionsUpdateCheckBusy() { return setOptionsUpdateCheckBusy; },
    get setOptionsUpdateCheckStatus() { return setOptionsUpdateCheckStatus; },
    get setOptionsUpdateCheckResult() { return setOptionsUpdateCheckResult; },
    get startupMenuVisible() { return startupMenuVisible; },
  });

  useCharacterSheetInterception({
    get characterSheetInterceptionArmed() { return characterSheetInterceptionArmed; },
    get characterSheetAwaitingInfoRef() { return characterSheetAwaitingInfoRef; },
    get infoMenu() { return infoMenu; },
    get setCharacterSheetInterceptionArmed() { return setCharacterSheetInterceptionArmed; },
    get characterSheet() { return characterSheet; },
  });

  const {
    hasGameplayOverlayOpen,
  } = useOverlayLifecycle({
    get asciiLogoVisible() { return asciiLogoVisible; },
    get question() { return question; },
    get directionQuestion() { return directionQuestion; },
    get infoMenu() { return infoMenu; },
    get inventory() { return inventory; },
    get textInputRequest() { return textInputRequest; },
    get positionRequest() { return positionRequest; },
    get inventoryContextMenu() { return inventoryContextMenu; },
    get inventoryDropCountDialog() { return inventoryDropCountDialog; },
    get fpsCrosshairContext() { return fpsCrosshairContext; },
    get isWizardCommandsVisible() { return isWizardCommandsVisible; },
    get isControllerActionWheelVisible() { return isControllerActionWheelVisible; },
    get isControllerSupportPromptVisible() { return isControllerSupportPromptVisible; },
    get newGamePrompt() { return newGamePrompt; },
    get hasHydratedUserTilesets() { return hasHydratedUserTilesets; },
    get hasAskedControllerSupportThisSession() { return hasAskedControllerSupportThisSession; },
    get setIsControllerSupportPromptVisible() { return setIsControllerSupportPromptVisible; },
    get isMobileGameRunning() { return isMobileGameRunning; },
    get setIsMobileActionSheetVisible() { return setIsMobileActionSheetVisible; },
    get setMobileActionSheetMode() { return setMobileActionSheetMode; },
    get setIsMobileLogVisible() { return setIsMobileLogVisible; },
    get gameOverDialogShowsTombstone() { return gameOverDialogShowsTombstone; },
    get setIsWizardCommandsVisible() { return setIsWizardCommandsVisible; },
    get hideAllUiForDeferredGameOver() { return hideAllUiForDeferredGameOver; },
    get setIsPauseMenuVisible() { return setIsPauseMenuVisible; },
    get setIsExitConfirmationVisible() { return setIsExitConfirmationVisible; },
    get setIsClientOptionsVisible() { return setIsClientOptionsVisible; },
    get setIsControllerRemapVisible() { return setIsControllerRemapVisible; },
    get setControllerRemapListening() { return setControllerRemapListening; },
    get setIsControllerActionWheelVisible() { return setIsControllerActionWheelVisible; },
    get setControllerActionWheelMode() { return setControllerActionWheelMode; },
    get setControllerActionWheelChosenIndex() { return setControllerActionWheelChosenIndex; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get setInventoryDropTypeMenuPosition() { return setInventoryDropTypeMenuPosition; },
    get setInventoryDropCountDialog() { return setInventoryDropCountDialog; },
    get setTileContextMenuPosition() { return setTileContextMenuPosition; },
    get setPositionRequest() { return setPositionRequest; },
    get setCharacterSheetInterceptionArmed() { return setCharacterSheetInterceptionArmed; },
    get characterSheetAwaitingInfoRef() { return characterSheetAwaitingInfoRef; },
    get controller() { return controller; },
    get isDesktopGameRunning() { return isDesktopGameRunning; },
  });

  useMessageLogEffects({
    get setFloatingMessageTiming() { return setFloatingMessageTiming; },
    get clientOptions() { return clientOptions; },
    get setIsMobileLogVisible() { return setIsMobileLogVisible; },
  });

  useTextInputReset({
    get textInputRequest() { return textInputRequest; },
    get setTextInputValue() { return setTextInputValue; },
    get textInputRef() { return textInputRef; },
  });

  const {
    hpPercentage,
    hpColor,
    powerPercentage,
    resolveCoreStatStyle,
    playerStatusBadges,
    visibleLocationLabel,
    renderCharacterCurrentStatusPanel,
    renderCharacterCurrentAttributesPanel,
  } = usePlayerStatusPresentation({
    get setCoreStatBoldUntilTurn() { return setCoreStatBoldUntilTurn; },
    get isMobileGameRunning() { return isMobileGameRunning; },
    get isDesktopGameRunning() { return isDesktopGameRunning; },
    get previousCoreStatSnapshotRef() { return previousCoreStatSnapshotRef; },
    get playerStats() { return playerStats; },
    get coreStatBoldUntilTurn() { return coreStatBoldUntilTurn; },
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get refreshMobileStatsCoreRowScaleRef() { return refreshMobileStatsCoreRowScaleRef; },
    get isMobileViewport() { return isMobileViewport; },
    get startup() { return startup; },
  });

  const {
    orderedQuestionChoices,
    shouldRenderQuestionTextInput,
    isYesNoQuestionChoices,
    useInventoryChoiceLabels,
    useCompactQuestionChoiceLayout,
    showQuestionCancelButton,
    displayedQuestionText,
    displayedQuestionPendingCount,
    showQuestionAmountControls,
    questionMenuPageIndex,
    questionMenuPageCount,
    enhanceMenuData,
    infoEnhanceMenuData,
    castMenuData,
    techniqueMenuData,
    displayedQuestionMenuItems,
    useSlashEmLegacyShortcutChoiceDialog,
    questionChoiceSourceItems,
    shouldRenderQuestionMenuItems,
    questionSelectableMenuItemCount,
    showPickupActionButtons,
    showPickupToggleAllButton,
  } = useQuestionModel({
    get question() { return question; },
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get displayedInfoMenu() { return displayedInfoMenu; },
    get inventory() { return inventory; },
    get isMobileViewport() { return isMobileViewport; },
  });

  const {
    inventoryContextActionsEnabled,
    inventoryContextMenuOpen,
    inventoryCloseInstructionText,
  } = useInventoryContextStatePresentation({
    get inventory() { return inventory; },
    get inventoryContextMenu() { return inventoryContextMenu; },
  });

  const {
    submitQuestionTextInput,
  } = useQuestionInput({
    get questionTextInputValue() { return questionTextInputValue; },
    get controller() { return controller; },
    get setQuestionTextInputValue() { return setQuestionTextInputValue; },
    get shouldRenderQuestionTextInput() { return shouldRenderQuestionTextInput; },
    get questionTextInputRef() { return questionTextInputRef; },
    get question() { return question; },
    get characterCreationConfig() { return characterCreationConfig; },
    get directionQuestion() { return directionQuestion; },
    get infoMenu() { return infoMenu; },
    get inventory() { return inventory; },
    get isClientOptionsVisible() { return isClientOptionsVisible; },
    get isControllerRemapVisible() { return isControllerRemapVisible; },
    get isDarkWallTilePickerVisible() { return isDarkWallTilePickerVisible; },
    get isTilesetBackgroundTilePickerVisible() { return isTilesetBackgroundTilePickerVisible; },
    get isTilesetManagerVisible() { return isTilesetManagerVisible; },
    get isTilesetSolidColorPickerVisible() { return isTilesetSolidColorPickerVisible; },
    get newGamePrompt() { return newGamePrompt; },
    get textInputRequest() { return textInputRequest; },
    get inventoryContextMenu() { return inventoryContextMenu; },
    get inventoryContextMenuActions() { return inventoryContextMenuActions; },
    get fpsCrosshairContext() { return fpsCrosshairContext; },
    get tileContextMenuPosition() { return tileContextMenuPosition; },
    get isWizardCommandsVisible() { return isWizardCommandsVisible; },
    get isControllerActionWheelVisible() { return isControllerActionWheelVisible; },
    get controllerActionWheelMode() { return controllerActionWheelMode; },
    get globalConfirmationDialog() { return globalConfirmationDialog; },
    get loadingOverlayVisible() { return loadingOverlayVisible; },
  });

  const {
    mobileExtendedCommandNames,
    mobileCommonExtendedCommandNames,
    wizardExtendedCommandNames,
    wizardCommandsSupported,
    controllerActionWheelEntries,
    characterCommandActions,
    closeControllerActionWheel,
    closeWizardCommands,
    openPauseMenu,
    toggleWizardCommands,
    runWizardExtendedCommand,
    runControllerWheelEntry,
    runControllerWheelExtendedCommand,
  } = useCommandActionsCommands({
    get extendedCommands() { return extendedCommands; },
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get characterCreationConfig() { return characterCreationConfig; },
    get runtimeVersion() { return runtimeVersion; },
    get isMobileGameRunning() { return isMobileGameRunning; },
    get isDesktopGameRunning() { return isDesktopGameRunning; },
    get setIsControllerActionWheelVisible() { return setIsControllerActionWheelVisible; },
    get setControllerActionWheelMode() { return setControllerActionWheelMode; },
    get setControllerActionWheelChosenIndex() { return setControllerActionWheelChosenIndex; },
    get setIsWizardCommandsVisible() { return setIsWizardCommandsVisible; },
    get controller() { return controller; },
    get setIsMobileActionSheetVisible() { return setIsMobileActionSheetVisible; },
    get setMobileActionSheetMode() { return setMobileActionSheetMode; },
    get setIsMobileLogVisible() { return setIsMobileLogVisible; },
    get setIsExitConfirmationVisible() { return setIsExitConfirmationVisible; },
    get setIsPauseMenuVisible() { return setIsPauseMenuVisible; },
  });

  const {
    openCharacterDialog,
  } = useCharacterSheetActions({
    get setCharacterSheetInterceptionArmed() { return setCharacterSheetInterceptionArmed; },
    get characterSheetAwaitingInfoRef() { return characterSheetAwaitingInfoRef; },
    get controller() { return controller; },
    get closeControllerActionWheel() { return closeControllerActionWheel; },
    get setIsMobileActionSheetVisible() { return setIsMobileActionSheetVisible; },
    get setMobileActionSheetMode() { return setMobileActionSheetMode; },
    get setIsMobileLogVisible() { return setIsMobileLogVisible; },
    get closeWizardCommands() { return closeWizardCommands; },
    get loadingOverlayVisible() { return loadingOverlayVisible; },
  });

  useCommandActionsEffects({
    get loadingOverlayVisible() { return loadingOverlayVisible; },
    get isMobileGameRunning() { return isMobileGameRunning; },
    get isDesktopGameRunning() { return isDesktopGameRunning; },
    get controller() { return controller; },
    get closeWizardCommands() { return closeWizardCommands; },
    get setIsMobileActionSheetVisible() { return setIsMobileActionSheetVisible; },
    get setMobileActionSheetMode() { return setMobileActionSheetMode; },
    get setIsControllerActionWheelVisible() { return setIsControllerActionWheelVisible; },
    get setControllerActionWheelMode() { return setControllerActionWheelMode; },
    get setControllerActionWheelChosenIndex() { return setControllerActionWheelChosenIndex; },
    get closeControllerActionWheel() { return closeControllerActionWheel; },
    get isControllerActionWheelVisible() { return isControllerActionWheelVisible; },
    get controllerActionWheelDialogRef() { return controllerActionWheelDialogRef; },
    get controllerActionWheelMode() { return controllerActionWheelMode; },
    get controllerActionWheelEntries() { return controllerActionWheelEntries; },
    get mobileCommonExtendedCommandNames() { return mobileCommonExtendedCommandNames; },
    get mobileExtendedCommandNames() { return mobileExtendedCommandNames; },
    get wizardCommandsSupported() { return wizardCommandsSupported; },
    get setIsWizardCommandsVisible() { return setIsWizardCommandsVisible; },
    get isWizardCommandsVisible() { return isWizardCommandsVisible; },
    get wizardCommandsButtonRef() { return wizardCommandsButtonRef; },
    get wizardCommandsSheetRef() { return wizardCommandsSheetRef; },
    get wizardExtendedCommandNames() { return wizardExtendedCommandNames; },
  });

  const {
    runCharacterExtendedCommand,
    closeInfoMenuDialog,
  } = useCharacterSheetCommands({
    get setCharacterSheetInterceptionArmed() { return setCharacterSheetInterceptionArmed; },
    get characterSheetAwaitingInfoRef() { return characterSheetAwaitingInfoRef; },
    get controller() { return controller; },
  });

  const {
    showPreviousCachedMessageInfoMenu,
    showEarliestCachedMessageInfoMenu,
    showNextCachedMessageInfoMenu,
    showLatestCachedMessageInfoMenu,
    showMessageHistoryNavigation,
    canShowPreviousCachedMessage,
    canShowNextCachedMessage,
  } = useMessageHistoryNavigation({
    get setMessageInfoMenuHistory() { return setMessageInfoMenuHistory; },
    get displayedInfoMenu() { return displayedInfoMenu; },
    get messageInfoMenuHistory() { return messageInfoMenuHistory; },
  });

  const {
    submitTextInput,
  } = useTextInputSubmit({
    get controller() { return controller; },
    get setTextInputValue() { return setTextInputValue; },
  });

  useQuestionFocus({
    get question() { return question; },
  });

  const {
    startNewGameFromPrompt,
    dismissNewGamePromptUntilInteraction,
    restoreDeferredNewGamePrompt,
    toggleDeferredGameOverTombstoneUi,
    handleNewGamePromptKeyDown,
  } = useNewGamePrompt({
    get setReopenNewGamePromptOnInteraction() { return setReopenNewGamePromptOnInteraction; },
    get setDeferredNewGamePromptReason() { return setDeferredNewGamePromptReason; },
    get setNewGamePrompt() { return setNewGamePrompt; },
    get setGameOver() { return setGameOver; },
    get setPositionRequest() { return setPositionRequest; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get setIsPauseMenuVisible() { return setIsPauseMenuVisible; },
    get setIsExitConfirmationVisible() { return setIsExitConfirmationVisible; },
    get setIsClientOptionsVisible() { return setIsClientOptionsVisible; },
    get setIsControllerRemapVisible() { return setIsControllerRemapVisible; },
    get setControllerRemapListening() { return setControllerRemapListening; },
    get setIsControllerActionWheelVisible() { return setIsControllerActionWheelVisible; },
    get setIsMobileActionSheetVisible() { return setIsMobileActionSheetVisible; },
    get setIsMobileLogVisible() { return setIsMobileLogVisible; },
    get setIsWizardCommandsVisible() { return setIsWizardCommandsVisible; },
    get setCharacterSheetInterceptionArmed() { return setCharacterSheetInterceptionArmed; },
    get characterSheetAwaitingInfoRef() { return characterSheetAwaitingInfoRef; },
    get setCharacterCreationConfig() { return setCharacterCreationConfig; },
    get setStartupFlowStep() { return setStartupFlowStep; },
    get newGamePrompt() { return newGamePrompt; },
    get deferredNewGamePromptReason() { return deferredNewGamePromptReason; },
    get gameOverDialogShowsTombstone() { return gameOverDialogShowsTombstone; },
    get hideAllUiForDeferredGameOver() { return hideAllUiForDeferredGameOver; },
    get newGamePromptYesButtonRef() { return newGamePromptYesButtonRef; },
    get newGamePromptNoButtonRef() { return newGamePromptNoButtonRef; },
  });

  const {
    resolveStartupMenuNavigationDirection,
    applyDialogDirectionalNavigation,
    handleInfoMenuDialogKeyDown,
    handleStartupMainMenuKeyDown,
    handleStartupMainMenuPointerDownCapture,
    handleStartupMainMenuBlurCapture,
    handleStartupMainMenuChangeCapture,
  } = useStartupNavigation({
    get startupLikelyOpenSelectElementsRef() { return startupLikelyOpenSelectElementsRef; },
    get startupLikelyOpenSelectInitialValueByElementRef() { return startupLikelyOpenSelectInitialValueByElementRef; },
  });

  const {
    handleClientOptionsDialogKeyDown,
    handleClientOptionsDialogPointerDownCapture,
    handleClientOptionsDialogBlurCapture,
    handleClientOptionsDialogChangeCapture,
  } = useClientOptionsNavigation({
    get clientOptionsLikelyOpenSelectElementsRef() { return clientOptionsLikelyOpenSelectElementsRef; },
    get clientOptionsLikelyOpenSelectInitialValueByElementRef() { return clientOptionsLikelyOpenSelectInitialValueByElementRef; },
    get resolveStartupMenuNavigationDirection() { return resolveStartupMenuNavigationDirection; },
    get applyDialogDirectionalNavigation() { return applyDialogDirectionalNavigation; },
  });

  const {
    openTilesetManagerNewEditor,
    openTilesetManagerEditor,
    openTilesetManager,
    closeTilesetManager,
    handleTilesetManagerFileChange,
    removeUserTileset,
    saveTilesetManager,
  } = useTilesetManagerActions({
    get setUserTilesets() { return setUserTilesets; },
    get initialPersistedClientOptionsRef() { return initialPersistedClientOptionsRef; },
    get setClientOptions() { return setClientOptions; },
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get setHasHydratedUserTilesets() { return setHasHydratedUserTilesets; },
    get setTilesetManagerFile() { return setTilesetManagerFile; },
    get tilesetManagerFileInputRef() { return tilesetManagerFileInputRef; },
    get setTilesetManagerMode() { return setTilesetManagerMode; },
    get setTilesetManagerEditPath() { return setTilesetManagerEditPath; },
    get setTilesetManagerName() { return setTilesetManagerName; },
    get setTilesetManagerTileLayoutVersion() { return setTilesetManagerTileLayoutVersion; },
    get activeRuntimeVersion() { return activeRuntimeVersion; },
    get setTilesetManagerAtlasState() { return setTilesetManagerAtlasState; },
    get setTilesetManagerAtlasImage() { return setTilesetManagerAtlasImage; },
    get setIsTilesetBackgroundTilePickerVisible() { return setIsTilesetBackgroundTilePickerVisible; },
    get setIsTilesetSolidColorPickerVisible() { return setIsTilesetSolidColorPickerVisible; },
    get setTilesetManagerError() { return setTilesetManagerError; },
    get userTilesetRecordByPath() { return userTilesetRecordByPath; },
    get tilesetManagerEditPath() { return tilesetManagerEditPath; },
    get clientOptionsDraft() { return clientOptionsDraft; },
    get tilesetCatalog() { return tilesetCatalog; },
    get setIsTilesetManagerVisible() { return setIsTilesetManagerVisible; },
    get tilesetManagerName() { return tilesetManagerName; },
    get requestConfirmation() { return requestConfirmation; },
    get setTilesetManagerBusy() { return setTilesetManagerBusy; },
    get selectedTilesetManagerEditPath() { return selectedTilesetManagerEditPath; },
    get clientOptions() { return clientOptions; },
    get controller() { return controller; },
    get tilesetManagerFile() { return tilesetManagerFile; },
    get tilesetManagerTileLayoutVersion() { return tilesetManagerTileLayoutVersion; },
    get tilesetManagerInNewMode() { return tilesetManagerInNewMode; },
    get selectedTilesetManagerEditUserRecord() { return selectedTilesetManagerEditUserRecord; },
  });

  const {
    confirmControllerSupportPromptChoice,
    openClientOptionsDialog,
    requestCloseClientOptionsDialog,
    requestConfirmClientOptionsDialog,
    openResetClientOptionsConfirmation,
    cancelResetClientOptionsConfirmation,
    confirmResetClientOptionsToDefaults,
    updateClientOptionDraft,
    showManualSafeZonePreview,
  } = useClientOptionsActions({
    get clientOptions() { return clientOptions; },
    get setClientOptions() { return setClientOptions; },
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get controller() { return controller; },
    get setIsControllerSupportPromptVisible() { return setIsControllerSupportPromptVisible; },
    get setHasAskedControllerSupportThisSession() { return setHasAskedControllerSupportThisSession; },
    get setActiveClientOptionsTab() { return setActiveClientOptionsTab; },
    get setIsClientOptionsVisible() { return setIsClientOptionsVisible; },
    get setIsDarkWallTilePickerVisible() { return setIsDarkWallTilePickerVisible; },
    get setIsTilesetBackgroundTilePickerVisible() { return setIsTilesetBackgroundTilePickerVisible; },
    get setIsTilesetSolidColorPickerVisible() { return setIsTilesetSolidColorPickerVisible; },
    get setIsTilesetManagerVisible() { return setIsTilesetManagerVisible; },
    get setIsResetClientOptionsConfirmationVisible() { return setIsResetClientOptionsConfirmationVisible; },
    get setIsControllerRemapVisible() { return setIsControllerRemapVisible; },
    get setControllerRemapListening() { return setControllerRemapListening; },
    get soundPackDialogActionsRef() { return soundPackDialogActionsRef; },
    get clientOptionsDraft() { return clientOptionsDraft; },
    get setManualSafeZonePreview() { return setManualSafeZonePreview; },
    get manualSafeZonePreviewTimerRef() { return manualSafeZonePreviewTimerRef; },
  });

  const {
    closeControllerRemapDialog,
    openControllerRemapDialog,
    setControllerBindingSlotDraft,
    resetControllerBindingsToDefaultsDraft,
    beginControllerBindingCapture,
    clearControllerBindingCapture,
  } = useControllerRemapping({
    get setControllerRemapListening() { return setControllerRemapListening; },
    get setIsControllerRemapVisible() { return setIsControllerRemapVisible; },
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get controllerRemapListening() { return controllerRemapListening; },
    get loadingOverlayVisible() { return loadingOverlayVisible; },
  });

  const {
    updateTilesetPathDraft,
  } = useTilesetSelectionDraft({
    get clientOptionsDraft() { return clientOptionsDraft; },
    get setTileAtlasState() { return setTileAtlasState; },
    get setTileAtlasImage() { return setTileAtlasImage; },
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get defaultDarkWallTileId() { return defaultDarkWallTileId; },
    get defaultDarkWallSolidColorHex() { return defaultDarkWallSolidColorHex; },
    get defaultDarkWallSolidColorHexFps() { return defaultDarkWallSolidColorHexFps; },
  });

  const {
    updateClientSliderDraft,
  } = useClientSliderDraft({
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get updateClientOptionDraft() { return updateClientOptionDraft; },
  });

  const {
    updateDarkWallTileOverrideEnabledDraft,
    updateDarkWallTileOverrideTileIdDraft,
    updateDarkWallSolidColorOverrideEnabledDraft,
    updateDarkWallSolidColorHexDraft,
    updateDarkWallSolidColorHexFpsDraft,
    updateDarkWallSolidColorGridEnabledDraft,
    updateDarkWallSolidColorGridDarknessPercentDraft,
  } = useDarkWallDraft({
    get setClientOptionsDraft() { return setClientOptionsDraft; },
    get tileAtlasState() { return tileAtlasState; },
  });

  const {
    updateTilesetBackgroundTileIdDraft,
    updateTilesetBackgroundRemovalModeDraft,
    updateTilesetSolidChromaKeyColorHexDraft,
    updateTilesetWeaponSpriteFlipXDraft,
  } = useTilesetBackgroundDraft({
    get setClientOptionsDraft() { return setClientOptionsDraft; },
  });

  useTilesetPickerVisibility({
    get clientOptionsDraft() { return clientOptionsDraft; },
    get setIsDarkWallTilePickerVisible() { return setIsDarkWallTilePickerVisible; },
    get isVultureTilesetSelected() { return isVultureTilesetSelected; },
    get selectedTilesetEntry() { return selectedTilesetEntry; },
    get setIsTilesetBackgroundTilePickerVisible() { return setIsTilesetBackgroundTilePickerVisible; },
    get setIsTilesetSolidColorPickerVisible() { return setIsTilesetSolidColorPickerVisible; },
    get setIsTilesetManagerVisible() { return setIsTilesetManagerVisible; },
    get isTilesetManagerVisible() { return isTilesetManagerVisible; },
    get selectedTilesetManagerEditPath() { return selectedTilesetManagerEditPath; },
    get tilesetManagerBackgroundRemovalMode() { return tilesetManagerBackgroundRemovalMode; },
    get tilesetManagerMode() { return tilesetManagerMode; },
    get tilesetCatalog() { return tilesetCatalog; },
    get openTilesetManagerEditor() { return openTilesetManagerEditor; },
    get openTilesetManagerNewEditor() { return openTilesetManagerNewEditor; },
  });

  const {
    renderMobileDialogCloseButton,
  } = useMobileDialogCloseButton({
    get isMobileViewport() { return isMobileViewport; },
  });

  const {
    moveInventoryItemFocusByArrowKey,
    closeInventoryContextMenu,
  } = useInventoryNavigationFocus({
    get inventoryRowRefs() { return inventoryRowRefs; },
    get inventoryContextMenuStateRef() { return inventoryContextMenuStateRef; },
    get inventoryContextMenuKeyboardOpenPendingRef() { return inventoryContextMenuKeyboardOpenPendingRef; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get setInventoryDropTypeMenuPosition() { return setInventoryDropTypeMenuPosition; },
  });

  const {
    closeInventoryDropTypeMenu,
    openInventoryDropTypeMenu,
    cancelInventoryDropTypeHold,
    beginInventoryDropTypeHold,
    completeInventoryDropTypeHold,
    consumeInventoryDropActionClickSuppression,
    runInventoryDropTypeCommand,
    closeInventoryDropCountModal,
    openInventoryDropCountModal,
    clampInventoryDropCountValue,
    stepInventoryDropCountValue,
    submitInventoryDropCount,
  } = useInventoryDropActions({
    get setInventoryDropTypeMenuPosition() { return setInventoryDropTypeMenuPosition; },
    get inventoryDropActionButtonRef() { return inventoryDropActionButtonRef; },
    get inventoryDropTypeHoldStateRef() { return inventoryDropTypeHoldStateRef; },
    get inventoryDropTypeHoldAnimationFrameRef() { return inventoryDropTypeHoldAnimationFrameRef; },
    get inventorySuppressDropActionClickRef() { return inventorySuppressDropActionClickRef; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get controller() { return controller; },
    get setInventoryDropCountDialog() { return setInventoryDropCountDialog; },
    get setInventoryDropCountValue() { return setInventoryDropCountValue; },
    get inventoryDropCountMaxValue() { return inventoryDropCountMaxValue; },
    get inventoryDropCountDialog() { return inventoryDropCountDialog; },
    get inventoryDropCountValue() { return inventoryDropCountValue; },
  });

  const {
    resolveInventoryContextNavigationDirection,
    moveInventoryContextMenuActionFocus,
    openInventoryContextMenu,
  } = useInventoryNavigationContext({
    get inventoryContextMenuRef() { return inventoryContextMenuRef; },
    get inventoryContextMenuKeyboardOpenPendingRef() { return inventoryContextMenuKeyboardOpenPendingRef; },
    get setInventoryDropTypeMenuPosition() { return setInventoryDropTypeMenuPosition; },
    get inventoryContextActionsEnabled() { return inventoryContextActionsEnabled; },
    get getInventoryContextMenuClampRegion() { return getInventoryContextMenuClampRegion; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
  });

  const {
    runFpsCrosshairContextAction,
  } = useTileContextActions({
    get fpsCrosshairContext() { return fpsCrosshairContext; },
    get controller() { return controller; },
  });

  useInventoryDropVisibility({
    get inventory() { return inventory; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get setInventoryDropTypeMenuPosition() { return setInventoryDropTypeMenuPosition; },
    get setInventoryDropCountDialog() { return setInventoryDropCountDialog; },
    get cancelInventoryDropTypeHold() { return cancelInventoryDropTypeHold; },
    get inventorySuppressDropActionClickRef() { return inventorySuppressDropActionClickRef; },
    get inventoryContextMenu() { return inventoryContextMenu; },
  });

  useInventoryContextLifecycleStateSync({
    get closeInventoryContextMenu() { return closeInventoryContextMenu; },
  });

  useInventoryProximityEffects({
    get inventory() { return inventory; },
    get scheduleInventoryRowProximityUpdate() { return scheduleInventoryRowProximityUpdate; },
    get inventoryContextMenu() { return inventoryContextMenu; },
    get inventoryPointerActiveRef() { return inventoryPointerActiveRef; },
    get inventoryPointerClientYRef() { return inventoryPointerClientYRef; },
    get inventoryRowPressCandidateRef() { return inventoryRowPressCandidateRef; },
    get inventoryRowHoverValueByIndexRef() { return inventoryRowHoverValueByIndexRef; },
    get inventoryRowRefs() { return inventoryRowRefs; },
    get inventoryReducedMotionEnabled() { return inventoryReducedMotionEnabled; },
    get clearInventoryTouchFallbackClearTimer() { return clearInventoryTouchFallbackClearTimer; },
    get inventoryRowProximityAnimationFrameRef() { return inventoryRowProximityAnimationFrameRef; },
  });

  useInventoryDropReset({
    get cancelInventoryDropTypeHold() { return cancelInventoryDropTypeHold; },
    get inventorySuppressDropActionClickRef() { return inventorySuppressDropActionClickRef; },
    get inventoryContextActionsEnabled() { return inventoryContextActionsEnabled; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get setInventoryDropTypeMenuPosition() { return setInventoryDropTypeMenuPosition; },
    get setInventoryDropCountDialog() { return setInventoryDropCountDialog; },
    get inventoryDropTypeMenuPosition() { return inventoryDropTypeMenuPosition; },
    get inventoryContextMenuActions() { return inventoryContextMenuActions; },
    get openInventoryDropTypeMenu() { return openInventoryDropTypeMenu; },
    get inventoryDropCountDialog() { return inventoryDropCountDialog; },
    get inventoryDropCountSliderRef() { return inventoryDropCountSliderRef; },
  });

  useInventoryContextLifecycleClose({
    get inventory() { return inventory; },
    get loadingOverlayVisible() { return loadingOverlayVisible; },
    get inventoryKeyboardActivationKeysDownRef() { return inventoryKeyboardActivationKeysDownRef; },
    get normalizeInventoryActivationKey() { return normalizeInventoryActivationKey; },
  });

  useKeyboardOverlays({
    get newGamePrompt() { return newGamePrompt; },
    get setReopenNewGamePromptOnInteraction() { return setReopenNewGamePromptOnInteraction; },
    get setDeferredNewGamePromptReason() { return setDeferredNewGamePromptReason; },
    get gameOver() { return gameOver; },
    get reopenNewGamePromptOnInteraction() { return reopenNewGamePromptOnInteraction; },
    get loadingOverlayVisible() { return loadingOverlayVisible; },
    get question() { return question; },
    get infoMenu() { return infoMenu; },
    get textInputRequest() { return textInputRequest; },
    get directionQuestion() { return directionQuestion; },
    get inventory() { return inventory; },
    get setNewGamePrompt() { return setNewGamePrompt; },
    get restoreDeferredNewGamePrompt() { return restoreDeferredNewGamePrompt; },
  });

  useInventoryContextLifecycleEffects({
    get inventoryContextMenu() { return inventoryContextMenu; },
    get loadingOverlayVisible() { return loadingOverlayVisible; },
    get inventoryContextMenuRef() { return inventoryContextMenuRef; },
    get inventoryDropTypeMenuRef() { return inventoryDropTypeMenuRef; },
    get inventoryDropTypeMenuPosition() { return inventoryDropTypeMenuPosition; },
    get closeInventoryDropTypeMenu() { return closeInventoryDropTypeMenu; },
    get inventorySuppressDropActionClickRef() { return inventorySuppressDropActionClickRef; },
    get cancelInventoryDropTypeHold() { return cancelInventoryDropTypeHold; },
    get setInventoryDropTypeMenuPosition() { return setInventoryDropTypeMenuPosition; },
    get setInventoryContextMenu() { return setInventoryContextMenu; },
    get closeInventoryContextMenu() { return closeInventoryContextMenu; },
    get getInventoryContextMenuClampRegion() { return getInventoryContextMenuClampRegion; },
    get inventoryDropActionButtonRef() { return inventoryDropActionButtonRef; },
  });

  useTileContextEffects({
    get fpsCrosshairContext() { return fpsCrosshairContext; },
    get setTileContextMenuPosition() { return setTileContextMenuPosition; },
    get fpsCrosshairContextMenuRef() { return fpsCrosshairContextMenuRef; },
    get loadingOverlayVisible() { return loadingOverlayVisible; },
    get controller() { return controller; },
  });

  useStartupController({
    get loadingOverlayVisible() { return loadingOverlayVisible; },
    get toggleDeferredGameOverTombstoneUi() { return toggleDeferredGameOverTombstoneUi; },
    get inventoryDropCountDialog() { return inventoryDropCountDialog; },
    get closeInventoryDropCountModal() { return closeInventoryDropCountModal; },
    get isControllerSupportPromptVisible() { return isControllerSupportPromptVisible; },
    get confirmControllerSupportPromptChoice() { return confirmControllerSupportPromptChoice; },
    get isPauseMenuVisible() { return isPauseMenuVisible; },
    get isExitConfirmationVisible() { return isExitConfirmationVisible; },
    get setIsExitConfirmationVisible() { return setIsExitConfirmationVisible; },
    get setIsPauseMenuVisible() { return setIsPauseMenuVisible; },
    get isClientOptionsVisible() { return isClientOptionsVisible; },
    get controllerRemapListening() { return controllerRemapListening; },
    get clearControllerBindingCapture() { return clearControllerBindingCapture; },
    get isControllerRemapVisible() { return isControllerRemapVisible; },
    get closeControllerRemapDialog() { return closeControllerRemapDialog; },
    get isResetClientOptionsConfirmationVisible() { return isResetClientOptionsConfirmationVisible; },
    get setIsResetClientOptionsConfirmationVisible() { return setIsResetClientOptionsConfirmationVisible; },
    get isTilesetManagerVisible() { return isTilesetManagerVisible; },
    get closeTilesetManager() { return closeTilesetManager; },
    get isDarkWallTilePickerVisible() { return isDarkWallTilePickerVisible; },
    get setIsDarkWallTilePickerVisible() { return setIsDarkWallTilePickerVisible; },
    get isTilesetBackgroundTilePickerVisible() { return isTilesetBackgroundTilePickerVisible; },
    get setIsTilesetBackgroundTilePickerVisible() { return setIsTilesetBackgroundTilePickerVisible; },
    get isTilesetSolidColorPickerVisible() { return isTilesetSolidColorPickerVisible; },
    get setIsTilesetSolidColorPickerVisible() { return setIsTilesetSolidColorPickerVisible; },
    get requestCloseClientOptionsDialog() { return requestCloseClientOptionsDialog; },
    get positionInputActive() { return positionInputActive; },
    get isDesktopGameRunning() { return isDesktopGameRunning; },
    get isMobileGameRunning() { return isMobileGameRunning; },
    get hasGameplayOverlayOpen() { return hasGameplayOverlayOpen; },
    get openPauseMenu() { return openPauseMenu; },
    get clientOptions() { return clientOptions; },
    get controller() { return controller; },
    get startupControllerCursorHighlightElementRef() { return startupControllerCursorHighlightElementRef; },
    get startupControllerCursorElementRef() { return startupControllerCursorElementRef; },
    get startupControllerCursorPulseElementRef() { return startupControllerCursorPulseElementRef; },
    get startupControllerCursorVisibleRef() { return startupControllerCursorVisibleRef; },
    get startupControllerCursorXRef() { return startupControllerCursorXRef; },
    get startupControllerCursorYRef() { return startupControllerCursorYRef; },
    get startupControllerCursorPulseTimerRef() { return startupControllerCursorPulseTimerRef; },
    get startupControllerActiveSliderElementRef() { return startupControllerActiveSliderElementRef; },
    get startupMenuVisible() { return startupMenuVisible; },
    get startupControllerPreviousActionActiveRef() { return startupControllerPreviousActionActiveRef; },
    get startupAccordionConfirmReleaseLatchRef() { return startupAccordionConfirmReleaseLatchRef; },
    get startupControllerSliderInteractionActiveRef() { return startupControllerSliderInteractionActiveRef; },
    get startupControllerSliderStepCarryRef() { return startupControllerSliderStepCarryRef; },
    get clientOptionsDraft() { return clientOptionsDraft; },
    get applyDialogDirectionalNavigation() { return applyDialogDirectionalNavigation; },
    get startupFlowStep() { return startupFlowStep; },
    get setStartupFlowStep() { return setStartupFlowStep; },
    get characterCreationConfig() { return characterCreationConfig; },
    get startup() { return startup; },
  });

  const {
    renderPauseMenu,
  } = usePauseMenu({
    get isPauseMenuVisible() { return isPauseMenuVisible; },
    get isExitConfirmationVisible() { return isExitConfirmationVisible; },
    get controller() { return controller; },
    get setIsPauseMenuVisible() { return setIsPauseMenuVisible; },
    get setIsExitConfirmationVisible() { return setIsExitConfirmationVisible; },
    get startNewGameFromPrompt() { return startNewGameFromPrompt; },
    get activeRuntimeVersionLabel() { return activeRuntimeVersionLabel; },
    get openClientOptionsDialog() { return openClientOptionsDialog; },
  });

  const {
    gameMessageLog,
    desktopGameMessageLog,
  } = useMessageLogView({
    get clientOptions() { return clientOptions; },
    get terminalDesktopGutterVisible() { return terminalDesktopGutterVisible; },
    get mobileTouchUiVisible() { return mobileTouchUiVisible; },
    get isMobileLogVisible() { return isMobileLogVisible; },
    get renderMobileDialogCloseButton() { return renderMobileDialogCloseButton; },
    get setIsMobileLogVisible() { return setIsMobileLogVisible; },
    get gameMessages() { return gameMessages; },
    get isMobileViewport() { return isMobileViewport; },
    get isDesktopGameRunning() { return isDesktopGameRunning; },
    get statusText() { return statusText; },
  });

  return {
    canvasRoot: {
      canvasRootRef,
    },
    terminalMessageGutter: {
      terminalDesktopGutterVisible,
      desktopGameMessageLog,
    },
    pauseMenu: {
      renderPauseMenu,
    },
    startupBackdrop: {
      startupMenuVisible,
      startupBuildLabelClickCount,
      handleStartupBuildLabelClick,
      startupBuildLabelToastVisible,
      isDebugSessionLogsLinkVisible,
      openDebugSessionLogsDialog,
    },
    debugSessionLogsDialog: {
      isDebugSessionLogsVisible,
      renderMobileDialogCloseButton,
      setIsDebugSessionLogsVisible,
      debugSessionLogs,
      selectedDebugSessionLog,
      setSelectedDebugSessionLogId,
      selectedDebugSessionLogText,
      refreshDebugSessionLogs,
    },
    startupLogo: {
      asciiLogoVisible,
    },
    startupUpdateDialog: {
      startupUpdateExpanded,
      startupInitialLoadingVisible,
      startupUpdateDialogOpen,
      handleStartupMainMenuBlurCapture,
      handleStartupMainMenuChangeCapture,
      handleStartupMainMenuKeyDown,
      handleStartupMainMenuPointerDownCapture,
      startupPendingUpdateCount,
      startupCurrentVersionLabel,
      startupLatestVersionLabel,
      startupUpdateDetailsVisible,
      startupPendingUpdateTags,
      clientOptions,
      setClientOptions,
      setClientOptionsDraft,
      openGitHubReleases,
      toggleStartupUpdateDetails,
      closeStartupUpdateDialog,
    },
    variantDialog: {
      startupInitialLoadingVisible,
      startupVariantDialogVisible,
      handleStartupMainMenuBlurCapture,
      handleStartupMainMenuChangeCapture,
      handleStartupMainMenuKeyDown,
      handleStartupMainMenuPointerDownCapture,
      setRuntimeVersion,
      setStartupFlowStep,
    },
    startupMenuDialog: {
      startupInitialLoadingVisible,
      startupChooseDialogVisible,
      handleStartupMainMenuBlurCapture,
      handleStartupMainMenuChangeCapture,
      handleStartupMainMenuKeyDown,
      handleStartupMainMenuPointerDownCapture,
      startupSelectedRuntimeVersionLabel,
      setStartupFlowStep,
      handleResumeClick,
      runtimeVersion,
      openTopScoresDialog,
      openClientOptionsDialog,
    },
    resumeGameDialog: {
      startupInitialLoadingVisible,
      startupResumeDialogVisible,
      handleStartupMainMenuBlurCapture,
      handleStartupMainMenuChangeCapture,
      handleStartupMainMenuKeyDown,
      handleStartupMainMenuPointerDownCapture,
      startupSelectedRuntimeVersionLabel,
      isLoadingSaves,
      savedGameSections,
      clientOptions,
      runtimeVersion,
      setClientOptions,
      setClientOptionsDraft,
      setCharacterCreationConfig,
      handleDeleteSave,
      setStartupFlowStep,
    },
    topScoresDialog: {
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
    },
    topScoreDetailDialog: {
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
    },
    randomCharacterDialog: {
      startupInitOptionsExpanded,
      startupInitialLoadingVisible,
      startupRandomDialogVisible,
      handleStartupMainMenuBlurCapture,
      handleStartupMainMenuChangeCapture,
      handleStartupMainMenuKeyDown,
      handleStartupMainMenuPointerDownCapture,
      startupSelectedRuntimeVersionLabel,
      setRandomCharacterName,
      randomCharacterName,
      setStartupInitOptionsExpanded,
      updateStartupInitOptionValue,
      resetStartupInitOptionValues,
      runtimeVersion,
      startupInitOptionValues,
      handleStartNewGame,
      clientOptions,
      startupInitOptionTokens,
      setStartupFlowStep,
      openClientOptionsDialog,
    },
    createCharacterDialog: {
      startupInitOptionsExpanded,
      startupInitialLoadingVisible,
      startupCreateDialogVisible,
      handleStartupMainMenuBlurCapture,
      handleStartupMainMenuChangeCapture,
      handleStartupMainMenuKeyDown,
      handleStartupMainMenuPointerDownCapture,
      startupSelectedRuntimeVersionLabel,
      setCreateCharacterName,
      createCharacterName,
      setCreateRole,
      normalizedCreateCharacterSelection,
      startupCreateCharacterOptionSet,
      setCreateRace,
      setCreateGender,
      setCreateAlign,
      setStartupInitOptionsExpanded,
      updateStartupInitOptionValue,
      resetStartupInitOptionValues,
      runtimeVersion,
      startupInitOptionValues,
      handleStartNewGame,
      clientOptions,
      startupInitOptionTokens,
      setStartupFlowStep,
      openClientOptionsDialog,
    },
    loadingOverlay: {
      loadingOverlayVisible,
      loadingSubtitle,
    },
    desktopMessageLog: {
      terminalDesktopGutterVisible,
      desktopGameMessageLog,
    },
    mobileMessageLog: {
      mobileTouchUiVisible,
      gameMessageLog,
      isMobileLogVisible,
      clientOptions,
      statsBarHeight,
    },
    floatingMessages: {
      clientOptions,
      floatingMessages,
      floatingMessageTextStyle,
    },
    statusBar: {
      startup,
      gameOverDialogShowsTombstone,
      playerStats,
      hpPercentage,
      hpColor,
      powerPercentage,
      resolveCoreStatStyle,
      playerStatusBadges,
      visibleLocationLabel,
    },
    clientOptionsDialog: {
      isClientOptionsVisible,
      handleClientOptionsDialogBlurCapture,
      handleClientOptionsDialogChangeCapture,
      handleClientOptionsDialogKeyDown,
      handleClientOptionsDialogPointerDownCapture,
      renderMobileDialogCloseButton,
      requestCloseClientOptionsDialog,
      selectedClientOptionsTab,
      setActiveClientOptionsTab,
      clientOptionsDraft,
      updateClientOptionDraft,
      optionsUpdateCheckStatus,
      optionsUpdateCheckResult,
      optionsUpdateCheckBusy,
      checkForUpdatesFromOptions,
      openGitHubReleases,
      visibleClientOptions,
      showDeveloperClientSettings,
      isVultureTilesetSelected,
      setIsDarkWallTilePickerVisible,
      renderTilePreviewImageForOptions,
      selectedDarkWallTileId,
      selectedDarkWallGlyphLabel,
      updateDarkWallSolidColorHexDraft,
      selectedDarkWallSolidColorHex,
      updateDarkWallSolidColorHexFpsDraft,
      selectedDarkWallSolidColorHexFps,
      selectedDarkWallSolidColorGridEnabled,
      updateDarkWallSolidColorGridEnabledDraft,
      updateDarkWallSolidColorGridDarknessPercentDraft,
      selectedDarkWallSolidColorGridDarknessPercent,
      updateDarkWallTileOverrideEnabledDraft,
      updateDarkWallSolidColorOverrideEnabledDraft,
      openControllerRemapDialog,
      tilesetDropdownOptions,
      hasAnyTilesets,
      openTilesetManager,
      setClientOptionsDraft,
      updateTilesetPathDraft,
      setManualSafeZonePreview,
      showManualSafeZonePreview,
      updateClientSliderDraft,
      soundPackDialogActionsRef,
      requestConfirmation,
      requestConfirmClientOptionsDialog,
      openResetClientOptionsConfirmation,
    },
    resetClientOptionsDialog: {
      isClientOptionsVisible,
      isResetClientOptionsConfirmationVisible,
      confirmResetClientOptionsToDefaults,
      cancelResetClientOptionsConfirmation,
    },
    controllerRemapDialog: {
      isClientOptionsVisible,
      isControllerRemapVisible,
      renderMobileDialogCloseButton,
      closeControllerRemapDialog,
      controllerRemapListening,
      controllerRemapListeningActionLabel,
      connectedControllerCount,
      clientOptionsDraft,
      beginControllerBindingCapture,
      setControllerBindingSlotDraft,
      clearControllerBindingCapture,
      resetControllerBindingsToDefaultsDraft,
    },
    tilesetManagerDialog: {
      isClientOptionsVisible,
      isTilesetManagerVisible,
      renderMobileDialogCloseButton,
      closeTilesetManager,
      tilesetManagerInNewMode,
      selectedTilesetManagerEditEntry,
      setTilesetManagerName,
      tilesetManagerNameInputDisabled,
      tilesetManagerName,
      selectedTilesetManagerEditUserRecord,
      setTilesetManagerTileLayoutVersion,
      tilesetManagerTileLayoutVersion,
      handleTilesetManagerFileChange,
      tilesetManagerFileInputRef,
      tilesetManagerFile,
      tilesetManagerWeaponSpriteFlipX,
      updateTilesetWeaponSpriteFlipXDraft,
      selectedTilesetManagerEditPath,
      tilesetManagerBackgroundRemovalMode,
      tilesetManagerBackgroundRemovalSettingsLocked,
      setIsTilesetBackgroundTilePickerVisible,
      renderTilesetManagerTilePreviewImage,
      tilesetManagerBackgroundTileId,
      tilesetManagerBackgroundGlyphLabel,
      updateTilesetBackgroundRemovalModeDraft,
      setIsTilesetSolidColorPickerVisible,
      tilesetManagerSolidChromaKeyColorHex,
      tilesetManagerBusy,
      saveTilesetManager,
      tilesetManagerError,
      openTilesetManagerNewEditor,
      tilesetManagerListTilesets,
      clientOptionsDraft,
      userTilesetRecordByPath,
      openTilesetManagerEditor,
      removeUserTileset,
    },
    darkWallTilePicker: {
      defaultDarkWallTileId,
      tilePickerEntries,
      setIsDarkWallTilePickerVisible,
      updateDarkWallTileOverrideTileIdDraft,
      renderMobileDialogCloseButton,
      renderTilePreviewImageForOptions,
      selectedDarkWallGlyphLabel,
      selectedDarkWallGlyphNumber,
      selectedDarkWallTileId,
      showTilePickerGlyphNumber,
      tilePickerStatusText,
      tileAtlasState,
      isClientOptionsVisible,
      isDarkWallTilePickerVisible,
    },
    backgroundTilePicker: {
      tilesetManagerDefaultBackgroundTileId,
      tilesetManagerTilePickerEntries,
      setIsTilesetBackgroundTilePickerVisible,
      updateTilesetBackgroundTileIdDraft,
      selectedTilesetManagerEditPath,
      tilesetManagerAtlasState,
      renderMobileDialogCloseButton,
      renderTilesetManagerTilePreviewImage,
      tilesetManagerBackgroundGlyphLabel,
      tilesetManagerBackgroundGlyphNumber,
      tilesetManagerBackgroundTileId,
      showTilePickerGlyphNumber,
      tilesetManagerTilePickerStatusText,
      selectedTilesetManagerEditEntry,
      isClientOptionsVisible,
      isTilesetManagerVisible,
      isTilesetBackgroundTilePickerVisible,
    },
    backgroundColorPicker: {
      tilesetManagerAtlasImage,
      tilesetManagerAtlasState,
      setIsTilesetSolidColorPickerVisible,
      updateTilesetSolidChromaKeyColorHexDraft,
      selectedTilesetManagerEditPath,
      renderMobileDialogCloseButton,
      tilesetManagerSolidChromaKeyColorHex,
      tilesetManagerTilePickerStatusText,
      selectedTilesetManagerEditEntry,
      isClientOptionsVisible,
      isTilesetManagerVisible,
      isTilesetSolidColorPickerVisible,
    },
    textInputDialog: {
      textInputRequest,
      renderMobileDialogCloseButton,
      submitTextInput,
      setTextInputValue,
      textInputValue,
      textInputRef,
    },
    questionDialog: {
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
    },
    runtimeErrorDialog: {
      runtimeInitializationErrorVisible,
      newGamePrompt,
      infoMenu,
      question,
      renderMobileDialogCloseButton,
      startNewGameFromPrompt,
      runtimeInitializationErrorMessage,
    },
    newGameDialog: {
      gameOverDialogShowsTombstone,
      newGameDialogVisible,
      handleNewGamePromptKeyDown,
      renderMobileDialogCloseButton,
      setNewGamePrompt,
      gameOverTombstoneLines,
      startNewGameFromPrompt,
      newGamePromptYesButtonRef,
      dismissNewGamePromptUntilInteraction,
      newGamePromptNoButtonRef,
    },
    directionDialog: {
      directionQuestion,
      controller,
      renderMobileDialogCloseButton,
      isFpsPlayMode,
      numberPadModeEnabled,
      clientOptions,
    },
    characterInfoDialog: {
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
    },
    inventoryDialog: {
      inventoryReducedMotionEnabled,
      inventoryAsciiModeEnabled,
      inventoryTileOnlyMotionEnabled,
      inventory,
      inventoryDialogRef,
      renderMobileDialogCloseButton,
      controller,
      inventoryFixedTileSizeMode,
      handleInventoryRowPointerDownCapture,
      handleInventoryPointerUpdate,
      handleInventoryPointerCancel,
      handleInventoryPointerLeave,
      handleInventoryPointerUp,
      handleInventoryRowTouchStartCapture,
      handleInventoryTouchUpdate,
      handleInventoryTouchMove,
      handleInventoryTouchEnd,
      handleInventoryTouchCancel,
      handleInventoryItemsScroll,
      inventoryItemsContainerRef,
      inventoryFixedIconSizePx,
      tilesUiEnabled,
      renderMenuItemTilePreview,
      inventoryContextMenu,
      inventoryContextActionsEnabled,
      setInventoryRowRef,
      inventoryUsesFullRowAnimation,
      beginInventoryRowPressCandidate,
      setInventoryContextMenu,
      openInventoryContextMenu,
      resolveInventoryContextNavigationDirection,
      moveInventoryContextMenuActionFocus,
      moveInventoryItemFocusByArrowKey,
      normalizeInventoryActivationKey,
      inventoryKeyboardActivationKeysDownRef,
      inventoryCloseInstructionText,
    },
    inventoryContextMenu: {
      resolveInventoryContextNavigationDirection,
      moveInventoryContextMenuActionFocus,
      inventoryDropTypeMenuPosition,
      closeInventoryDropTypeMenu,
      inventorySuppressDropActionClickRef,
      cancelInventoryDropTypeHold,
      closeInventoryContextMenu,
      inventoryContextMenuOpen,
      inventoryContextMenuRef,
      inventoryContextMenuRenderState,
      inventoryContextTitleScroll,
      inventoryContextTitleAnimationKey,
      inventoryContextTitle,
      inventoryContextMenuActions,
      consumeInventoryDropActionClickSuppression,
      controller,
      setInventoryContextMenu,
      openInventoryDropTypeMenu,
      completeInventoryDropTypeHold,
      beginInventoryDropTypeHold,
      inventoryDropTypeHoldStateRef,
      inventoryDropActionButtonRef,
    },
    inventoryDropTypePortal: {
      inventoryContextMenuOpen,
      inventoryDropTypeMenuPosition,
      inventoryDropTypeMenuRef,
      runInventoryDropTypeCommand,
      inventoryContextSupportsDropAmount,
      inventoryContextMenuRenderState,
      openInventoryDropCountModal,
    },
    inventoryDropCountDialog: {
      inventoryDropCountDialog,
      closeInventoryDropCountModal,
      submitInventoryDropCount,
      inventoryDropCountMaxValue,
      setInventoryDropCountValue,
      clampInventoryDropCountValue,
      inventoryDropCountSliderRef,
      inventoryDropCountValue,
      stepInventoryDropCountValue,
    },
    fpsCrosshair: {
      isFpsPlayMode,
      characterCreationConfig,
      connectionState,
      positionInputActive,
      loadingVisible,
    },
    tileContextMenu: {
      isFpsPlayMode,
      fpsCrosshairContextRenderState,
      tileContextMenuRenderPosition,
      fpsCrosshairContext,
      fpsCrosshairContextMenuRef,
      fpsContextTitleScroll,
      fpsContextTitleAnimationKey,
      fpsContextTitle,
      runFpsCrosshairContextAction,
    },
    controllerActionWheel: {
      controllerActionWheelMode,
      isControllerActionWheelVisible,
      controllerActionWheelDialogRef,
      controllerActionWheelChosenIndex,
      controllerActionWheelEntries,
      runControllerWheelEntry,
      setControllerActionWheelChosenIndex,
      mobileCommonExtendedCommandNames,
      runControllerWheelExtendedCommand,
      mobileExtendedCommandNames,
    },
    mobileActionSheet: {
      mobileTouchUiVisible,
      isMobileActionSheetVisible,
      mobileActionSheetMode,
      setMobileActionSheetMode,
      openPauseMenu,
      setIsMobileActionSheetVisible,
      controller,
      mobileCommonExtendedCommandNames,
      mobileExtendedCommandNames,
    },
    wizardCommandsSheet: {
      wizardCommandsSupported,
      isWizardCommandsVisible,
      isDesktopGameRunning,
      mobileTouchUiVisible,
      isMobileGameRunning,
      wizardCommandsSheetRef,
      closeWizardCommands,
      wizardExtendedCommandNames,
      runWizardExtendedCommand,
    },
    wizardCommandsButton: {
      wizardCommandsSupported,
      mobileTouchUiVisible,
      isWizardCommandsVisible,
      toggleWizardCommands,
      wizardCommandsButtonRef,
    },
    repeatActionButton: {
      mobileTouchUiVisible,
      repeatActionVisible,
      controller,
    },
    safeZonePreview: {
      manualSafeZonePreview,
    },
    desktopActions: {
      isDesktopGameRunning,
      clientOptions,
      wizardCommandsSupported,
      isWizardCommandsVisible,
      toggleWizardCommands,
      wizardCommandsButtonRef,
      isCharacterSheetVisible,
      openCharacterDialog,
      inventory,
      controller,
      closeWizardCommands,
    },
    mobileBottomBar: {
      mobileTouchUiVisible,
      isCharacterSheetVisible,
      openCharacterDialog,
      inventory,
      controller,
      closeWizardCommands,
      isMobileLogVisible,
      clientOptions,
      setIsMobileLogVisible,
      setIsMobileActionSheetVisible,
      setMobileActionSheetMode,
      isMobileActionSheetVisible,
    },
    positionDialog: {
      positionDialogVisible,
      isMobileViewport,
      controller,
      setPositionRequest,
      positionRequest,
      positionInputInstruction,
    },
    controllerSupportDialog: {
      isControllerSupportPromptVisible,
      confirmControllerSupportPromptChoice,
    },
    globalConfirmationDialog: {
      globalConfirmationDialog,
      resolveConfirmation,
    },
  };
}
