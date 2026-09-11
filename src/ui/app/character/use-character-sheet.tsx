import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { InfoMenuState, PlayerStatsSnapshot, Nethack3DEngineController } from "../../../game/ui-types";
import {
  nh3dOpenCharacterSheetEventName
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import { parseCharacterSheetInfoMenu, type CharacterSheetData } from "../../modals/character-sheet";
import type * as React from "react";
import {
  getExperienceThresholdForLevel,
  getLegacyCharacterStatValue,
  maxExperienceLevel
} from "../status/character-fields";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";

/** Character sheet interception and parsed attributes */
export function useCharacterSheetState() {
  const [characterSheetInterceptionArmed, setCharacterSheetInterceptionArmed] =
    useState(false);

  const characterSheetAwaitingInfoRef = useRef(false);
  return {
    characterSheetInterceptionArmed,
    setCharacterSheetInterceptionArmed,
    characterSheetAwaitingInfoRef,
  } as const;
}

export interface UseCharacterSheetViewDependencies {
  readonly displayedInfoMenu: InfoMenuState | null;
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly playerStats: PlayerStatsSnapshot;
  readonly characterSheetInterceptionArmed: boolean;
}

/** Character sheet interception and parsed attributes */
export function useCharacterSheetView(dependencies: UseCharacterSheetViewDependencies) {
  const {
    displayedInfoMenu,
    activeRuntimeVersion,
    playerStats,
    characterSheetInterceptionArmed,
  } = dependencies;

  const characterSheet = useMemo(
    () => parseCharacterSheetInfoMenu(displayedInfoMenu),
    [displayedInfoMenu],
  );

  const isLegacySlashEmBaseAttributesSheet =
    activeRuntimeVersion === "slashem" &&
    characterSheet?.variant === "slashem_base_attributes";

  const displayedCharacterStatEntries = useMemo(() => {
    if (!characterSheet) {
      return [];
    }
    if (!isLegacySlashEmBaseAttributesSheet) {
      return characterSheet.statEntries;
    }
    return characterSheet.statEntries.map((entry) => {
      const currentValue = getLegacyCharacterStatValue(entry.id, playerStats);
      return {
        ...entry,
        rawValue: currentValue,
        currentValue,
        limitValue: null,
      };
    });
  }, [characterSheet, isLegacySlashEmBaseAttributesSheet, playerStats]);

  const isCharacterSheetVisible = Boolean(
    displayedInfoMenu && characterSheet && characterSheetInterceptionArmed,
  );

  const hasCharacterStatValues = Boolean(
    displayedCharacterStatEntries.some((entry) =>
      Boolean(entry.currentValue || entry.rawValue || entry.limitValue),
    ),
  );

  const hasCharacterStatLimits = Boolean(
    displayedCharacterStatEntries.some((entry) => Boolean(entry.limitValue)),
  );

  const showLegacySlashEmDeitiesPanel = Boolean(
    isLegacySlashEmBaseAttributesSheet &&
    characterSheet?.deityLines &&
    characterSheet.deityLines.length > 0,
  );

  const characterExperienceProgress = useMemo(() => {
    const level = Number.isFinite(playerStats.level)
      ? Math.max(1, Math.trunc(playerStats.level))
      : 1;
    const experiencePoints = Number.isFinite(playerStats.experience)
      ? Math.max(0, Math.trunc(playerStats.experience))
      : 0;
    const currentLevelStart = getExperienceThresholdForLevel(level - 1);
    if (level >= maxExperienceLevel) {
      return {
        level,
        experiencePoints,
        isMaxLevel: true,
        currentLevelStart,
        nextLevelThreshold: currentLevelStart,
        toNextLevel: 0,
        progressPercent: 100,
      };
    }
    const nextLevelThreshold = getExperienceThresholdForLevel(level);
    const levelSpan = Math.max(1, nextLevelThreshold - currentLevelStart);
    const gainedThisLevel = Math.max(
      0,
      Math.min(levelSpan, experiencePoints - currentLevelStart),
    );
    const toNextLevel = Math.max(0, nextLevelThreshold - experiencePoints);
    return {
      level,
      experiencePoints,
      isMaxLevel: false,
      currentLevelStart,
      nextLevelThreshold,
      toNextLevel,
      progressPercent: Math.max(
        0,
        Math.min(100, (gainedThisLevel / levelSpan) * 100),
      ),
    };
  }, [playerStats.level, playerStats.experience]);
  return {
    characterSheet,
    isLegacySlashEmBaseAttributesSheet,
    displayedCharacterStatEntries,
    isCharacterSheetVisible,
    hasCharacterStatValues,
    hasCharacterStatLimits,
    showLegacySlashEmDeitiesPanel,
    characterExperienceProgress,
  } as const;
}

export interface UseCharacterSheetInterceptionDependencies {
  readonly characterSheetInterceptionArmed: boolean;
  readonly characterSheetAwaitingInfoRef: React.MutableRefObject<boolean>;
  readonly infoMenu: InfoMenuState | null;
  readonly setCharacterSheetInterceptionArmed: React.Dispatch<React.SetStateAction<boolean>>;
  readonly characterSheet: CharacterSheetData | null;
}

/** Character sheet interception and parsed attributes */
export function useCharacterSheetInterception(dependencies: UseCharacterSheetInterceptionDependencies) {
  const {
    characterSheetInterceptionArmed,
    characterSheetAwaitingInfoRef,
    infoMenu,
    setCharacterSheetInterceptionArmed,
    characterSheet,
  } = dependencies;

  useEffect(() => {
    if (!characterSheetInterceptionArmed) {
      characterSheetAwaitingInfoRef.current = false;
      return;
    }
    if (!infoMenu) {
      if (!characterSheetAwaitingInfoRef.current) {
        setCharacterSheetInterceptionArmed(false);
      }
      return;
    }
    characterSheetAwaitingInfoRef.current = false;
    if (!characterSheet) {
      setCharacterSheetInterceptionArmed(false);
    }
  }, [infoMenu, characterSheet, characterSheetInterceptionArmed]);

}

export interface UseCharacterSheetActionsDependencies {
  readonly setCharacterSheetInterceptionArmed: React.Dispatch<React.SetStateAction<boolean>>;
  readonly characterSheetAwaitingInfoRef: React.MutableRefObject<boolean>;
  readonly controller: Nethack3DEngineController | null;
  readonly closeControllerActionWheel: () => void;
  readonly setIsMobileActionSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setMobileActionSheetMode: React.Dispatch<React.SetStateAction<MobileActionSheetMode>>;
  readonly setIsMobileLogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly closeWizardCommands: () => void;
  readonly loadingOverlayVisible: boolean;
}

/** Character sheet interception and parsed attributes */
export function useCharacterSheetActions(dependencies: UseCharacterSheetActionsDependencies) {
  const {
    setCharacterSheetInterceptionArmed,
    characterSheetAwaitingInfoRef,
    controller,
    closeControllerActionWheel,
    setIsMobileActionSheetVisible,
    setMobileActionSheetMode,
    setIsMobileLogVisible,
    closeWizardCommands,
    loadingOverlayVisible,
  } = dependencies;

  const openCharacterDialog = useCallback((): void => {
    setCharacterSheetInterceptionArmed(true);
    characterSheetAwaitingInfoRef.current = true;
    controller?.dismissFpsCrosshairContextMenu();
    closeControllerActionWheel();
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    closeWizardCommands();
    controller?.runExtendedCommand("attributes");
  }, [closeControllerActionWheel, closeWizardCommands, controller]);

  useEffect(() => {
    if (loadingOverlayVisible || typeof window === "undefined") {
      return;
    }
    const handleControllerCharacterSheetRequest = (event: Event): void => {
      if (event.cancelable) {
        event.preventDefault();
      }
      openCharacterDialog();
    };
    window.addEventListener(
      nh3dOpenCharacterSheetEventName,
      handleControllerCharacterSheetRequest,
    );
    return () => {
      window.removeEventListener(
        nh3dOpenCharacterSheetEventName,
        handleControllerCharacterSheetRequest,
      );
    };
  }, [loadingOverlayVisible, openCharacterDialog]);
  return {
    openCharacterDialog,
  } as const;
}

export interface UseCharacterSheetCommandsDependencies {
  readonly setCharacterSheetInterceptionArmed: React.Dispatch<React.SetStateAction<boolean>>;
  readonly characterSheetAwaitingInfoRef: React.MutableRefObject<boolean>;
  readonly controller: Nethack3DEngineController | null;
}

/** Character sheet interception and parsed attributes */
export function useCharacterSheetCommands(dependencies: UseCharacterSheetCommandsDependencies) {
  const {
    setCharacterSheetInterceptionArmed,
    characterSheetAwaitingInfoRef,
    controller,
  } = dependencies;

  const runCharacterExtendedCommand = useCallback(
    (command: string): void => {
      const normalizedCommand = String(command || "")
        .trim()
        .toLowerCase();
      setCharacterSheetInterceptionArmed(normalizedCommand === "attributes");
      characterSheetAwaitingInfoRef.current =
        normalizedCommand === "attributes";
      controller?.dismissFpsCrosshairContextMenu();
      controller?.runExtendedCommand(command);
    },
    [controller],
  );

  const closeInfoMenuDialog = useCallback((): void => {
    setCharacterSheetInterceptionArmed(false);
    characterSheetAwaitingInfoRef.current = false;
    controller?.closeInfoMenuDialog();
  }, [controller]);
  return {
    runCharacterExtendedCommand,
    closeInfoMenuDialog,
  } as const;
}
