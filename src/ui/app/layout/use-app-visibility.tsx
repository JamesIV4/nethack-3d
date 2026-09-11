import {
  useEffect,
  useLayoutEffect
} from "react";
import type { CharacterCreationConfig, InfoMenuState, Nh3dClientOptions, NethackConnectionState, NewGamePromptState, QuestionDialogState, GameOverState } from "../../../game/ui-types";
import {
  useGameStore
} from "../../../state/gameStore";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import type {
  Nh3dVersionCheckResult
} from "../../../update/types";
import type * as React from "react";
import type {
  TileAtlasState
} from "../tilesets/atlas";
import type {
  StartupFlowStep
} from "../startup/character-preferences";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  resolveRuntimeVersionDisplayLabel
} from "../startup/RuntimeVersionBadge";
import {
  nh3dAppVersion
} from "../shared/build-info";

export interface UseAppVisibilityDependencies {
  readonly isMobileViewport: boolean;
  readonly clientOptions: Nh3dClientOptions;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly connectionState: NethackConnectionState;
  readonly loadingVisible: boolean;
  readonly hasHydratedUserTilesets: boolean;
  readonly hasHydratedStartupCharacterPreferences: boolean;
  readonly hasHydratedStartupInitOptions: boolean;
  readonly selectedTileAtlasLoadRequested: boolean;
  readonly selectedTilesetEntry: Nh3dTilesetEntry | null;
  readonly tileAtlasState: TileAtlasState;
  readonly isTilesetManagerVisible: boolean;
  readonly selectedTilesetManagerEditEntry: Nh3dTilesetEntry | null;
  readonly tilesetManagerAtlasState: TileAtlasState;
  readonly hasShownStartupMenu: boolean;
  readonly isStartupUpdateDialogVisible: boolean;
  readonly startupUpdateDetailsVisible: boolean;
  readonly newGamePrompt: NewGamePromptState;
  readonly infoMenu: InfoMenuState | null;
  readonly question: QuestionDialogState | null;
  readonly gameOver: GameOverState;
  readonly positionInputActive: boolean;
  readonly positionInputOrigin: string | null;
  readonly positionRequest: string | null;
  readonly reopenNewGamePromptOnInteraction: boolean;
  readonly gameMessages: string[];
  readonly statusText: string;
  readonly startupFlowStep: StartupFlowStep;
  readonly runtimeVersion: NethackRuntimeVersion;
  readonly setStartupBuildLabelClickCount: React.Dispatch<React.SetStateAction<number>>;
  readonly setStartupBuildLabelToastVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly startupBuildLabelToastTimerRef: React.MutableRefObject<number | null>;
  readonly startupUpdateCheck: Nh3dVersionCheckResult | null;
  readonly setHasShownStartupMenu: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Derives startup, game, loading and modal visibility from session state. */
export function useAppVisibility(dependencies: UseAppVisibilityDependencies) {
  const {
    isMobileViewport,
    clientOptions,
    characterCreationConfig,
    connectionState,
    loadingVisible,
    hasHydratedUserTilesets,
    hasHydratedStartupCharacterPreferences,
    hasHydratedStartupInitOptions,
    selectedTileAtlasLoadRequested,
    selectedTilesetEntry,
    tileAtlasState,
    isTilesetManagerVisible,
    selectedTilesetManagerEditEntry,
    tilesetManagerAtlasState,
    hasShownStartupMenu,
    isStartupUpdateDialogVisible,
    startupUpdateDetailsVisible,
    newGamePrompt,
    infoMenu,
    question,
    gameOver,
    positionInputActive,
    positionInputOrigin,
    positionRequest,
    reopenNewGamePromptOnInteraction,
    gameMessages,
    statusText,
    startupFlowStep,
    runtimeVersion,
    setStartupBuildLabelClickCount,
    setStartupBuildLabelToastVisible,
    startupBuildLabelToastTimerRef,
    startupUpdateCheck,
    setHasShownStartupMenu,
  } = dependencies;

  const isMobileGameRunning =
    (isMobileViewport ||
      (!isMobileViewport &&
        clientOptions.desktopTouchInterfaceMode !== "off")) &&
    characterCreationConfig !== null &&
    connectionState === "running" &&
    !loadingVisible;

  const isDesktopGameRunning =
    !(isMobileViewport || clientOptions.desktopTouchInterfaceMode !== "off") &&
    characterCreationConfig !== null &&
    connectionState === "running" &&
    !loadingVisible;

  const terminalDesktopGutterVisible =
    isDesktopGameRunning && clientOptions.tilesetMode === "terminal";

  useLayoutEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-terminal-desktop-gutter",
      terminalDesktopGutterVisible,
    );
    // The engine sizes its renderer from the canvas host. Notify it after the
    // gutter changes that host's available width so camera fitting and pointer
    // coordinates use the visible gameplay area.
    window.dispatchEvent(new Event("resize"));
    return () => {
      root.classList.remove("nh3d-terminal-desktop-gutter");
    };
  }, [terminalDesktopGutterVisible]);

  const forcedDesktopTouchInterfaceMode = !isMobileViewport
    ? clientOptions.desktopTouchInterfaceMode
    : "off";

  const isDesktopTouchInterfaceForced =
    forcedDesktopTouchInterfaceMode !== "off";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-force-touch-layout",
      isDesktopTouchInterfaceForced,
    );
    root.classList.toggle(
      "nh3d-force-touch-layout-portrait",
      forcedDesktopTouchInterfaceMode === "portrait",
    );
    root.classList.toggle(
      "nh3d-force-touch-layout-landscape",
      forcedDesktopTouchInterfaceMode === "landscape",
    );
    return () => {
      root.classList.remove(
        "nh3d-force-touch-layout",
        "nh3d-force-touch-layout-portrait",
        "nh3d-force-touch-layout-landscape",
      );
    };
  }, [forcedDesktopTouchInterfaceMode, isDesktopTouchInterfaceForced]);

  const startup = !isMobileGameRunning && !isDesktopGameRunning;

  const startupScreenReady =
    startup &&
    hasHydratedUserTilesets &&
    hasHydratedStartupCharacterPreferences &&
    hasHydratedStartupInitOptions;

  const startupUiVisible = startupScreenReady;

  const startupLoadingVisible = startup && !startupScreenReady;

  const runtimeLoadingVisible =
    loadingVisible && characterCreationConfig !== null;

  const tilesetLoadingVisible =
    (selectedTileAtlasLoadRequested &&
      Boolean(selectedTilesetEntry) &&
      !tileAtlasState.loaded &&
      !tileAtlasState.failed) ||
    (isTilesetManagerVisible &&
      Boolean(selectedTilesetManagerEditEntry) &&
      !tilesetManagerAtlasState.loaded &&
      !tilesetManagerAtlasState.failed);

  const loadingOverlayVisible =
    startupLoadingVisible || runtimeLoadingVisible || tilesetLoadingVisible;

  const loadingSubtitle = startupLoadingVisible
    ? t.update.loading.startupData
    : tilesetLoadingVisible
      ? t.update.loading.tileset
      : t.update.loading.runtime;

  const startupInitialLoadingVisible =
    !hasShownStartupMenu && loadingOverlayVisible;

  const startupMenuVisible =
    startupUiVisible &&
    characterCreationConfig === null &&
    !startupInitialLoadingVisible;

  const startupUpdateDialogOpen =
    startupMenuVisible && isStartupUpdateDialogVisible;

  const startupUpdateExpanded =
    startupUpdateDialogOpen && startupUpdateDetailsVisible;

  const startupLogoVisible =
    startupUiVisible &&
    !startupInitialLoadingVisible &&
    !runtimeLoadingVisible;

  const newGameDialogVisible = newGamePrompt.visible && !infoMenu && !question;

  const gameOverTombstoneLines = Array.isArray(gameOver.tombstoneLines)
    ? gameOver.tombstoneLines
    : [];

  const gameOverDialogShowsTombstone =
    newGameDialogVisible && gameOverTombstoneLines.length > 0;

  const asciiLogoVisible = startupLogoVisible || gameOverDialogShowsTombstone;

  const mobileTouchUiVisible =
    isMobileGameRunning && !gameOverDialogShowsTombstone;

  const farLookPositionInputActive =
    positionInputActive && positionInputOrigin !== "travel";

  const positionInputInstruction = farLookPositionInputActive
    ? clientOptions.controllerEnabled && !mobileTouchUiVisible
      ? t.dialogs.positionPrompt.controllerHint
      : mobileTouchUiVisible
        ? t.dialogs.positionPrompt.mobileHint
        : t.dialogs.positionPrompt.desktopHint
    : null;

  const positionDialogVisible =
    Boolean(positionRequest) || Boolean(positionInputInstruction);

  const hideAllUiForDeferredGameOver =
    reopenNewGamePromptOnInteraction && !newGamePrompt.visible;

  const latestGameMessage =
    gameMessages.length > 0 ? String(gameMessages[0] || "").trim() : "";

  const runtimeInitializationErrorVisible =
    startup &&
    characterCreationConfig !== null &&
    connectionState === "error" &&
    !loadingOverlayVisible;

  const runtimeInitializationErrorMessage = runtimeInitializationErrorVisible
    ? latestGameMessage ||
    statusText.trim() ||
    t.update.runtimeStoppedBeforeStartup
    : "";

  const startupSelectedRuntimeVersionLabel =
    startupMenuVisible && startupFlowStep !== "variant"
      ? resolveRuntimeVersionDisplayLabel(runtimeVersion)
      : null;

  useEffect(() => {
    if (startupMenuVisible) {
      return;
    }
    setStartupBuildLabelClickCount(0);
    setStartupBuildLabelToastVisible(false);
    if (startupBuildLabelToastTimerRef.current !== null) {
      window.clearTimeout(startupBuildLabelToastTimerRef.current);
      startupBuildLabelToastTimerRef.current = null;
    }
  }, [startupMenuVisible]);

  const startupVariantDialogVisible =
    startupMenuVisible &&
    startupFlowStep === "variant" &&
    !startupUpdateDialogOpen;

  const startupChooseDialogVisible =
    startupMenuVisible &&
    startupFlowStep === "choose" &&
    !startupUpdateDialogOpen;

  const startupResumeDialogVisible =
    startupMenuVisible && startupFlowStep === "resume";

  const startupRandomDialogVisible =
    startupMenuVisible && startupFlowStep === "random";

  const startupCreateDialogVisible =
    startupMenuVisible && startupFlowStep === "create";

  const startupPendingUpdateCount = startupUpdateCheck?.newerTags.length ?? 0;

  const startupPendingUpdateTags = startupUpdateCheck?.newerTags ?? [];

  const startupCurrentVersionLabel = `v${startupUpdateCheck?.currentVersion ?? nh3dAppVersion
    }`;

  const startupLatestVersionLabel =
    startupUpdateCheck?.latestVersion ??
    startupUpdateCheck?.latestTagName ??
    commonStrings.none;

  useEffect(() => {
    if (!hasShownStartupMenu && startupMenuVisible) {
      setHasShownStartupMenu(true);
    }
  }, [hasShownStartupMenu, startupMenuVisible]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-game-over-tombstone-active",
      gameOverDialogShowsTombstone,
    );
    return () => {
      root.classList.remove("nh3d-game-over-tombstone-active");
    };
  }, [gameOverDialogShowsTombstone]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-hide-runtime-ui-deferred-game-over",
      hideAllUiForDeferredGameOver,
    );
    return () => {
      root.classList.remove("nh3d-hide-runtime-ui-deferred-game-over");
    };
  }, [hideAllUiForDeferredGameOver]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.getElementById("root");
    if (!root) {
      return;
    }

    if (loadingOverlayVisible) {
      root.setAttribute("inert", "");
      root.setAttribute("aria-hidden", "true");
    } else {
      root.removeAttribute("inert");
      root.removeAttribute("aria-hidden");
    }

    return () => {
      root.removeAttribute("inert");
      root.removeAttribute("aria-hidden");
    };
  }, [loadingOverlayVisible]);

  useLayoutEffect(() => {
    useGameStore.getState().setUiBlockingVisible(loadingOverlayVisible);
    return () => {
      useGameStore.getState().setUiBlockingVisible(false);
    };
  }, [loadingOverlayVisible]);
  return {
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
  } as const;
}
