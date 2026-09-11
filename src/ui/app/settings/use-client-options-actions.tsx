import {
  useCallback,
  useEffect
} from "react";
import type { Nh3dClientOptions, Nethack3DEngineController } from "../../../game/ui-types";
import {
  defaultNh3dClientOptions,
  normalizeNh3dClientOptions
} from "../../../game/ui-types";
import {
  persistNh3dClientOptionsToIndexedDb
} from "../../../storage/client-options-storage";
import {
  resetNh3dDefaultSoundPackVolumeLevelsToDefaults
} from "../../../audio/sound-pack-storage";
import {
  type SoundPackDialogActions
} from "../../SoundPackSettings";
import {
  getCurrentLocale,
  setCurrentLocale
} from "../../../i18n/core";
import type * as React from "react";
import type {
  ClientOptionColor,
  ClientOptionSelect,
  ClientOptionSlider,
  ClientOptionToggleKey,
  ClientOptionsTabId,
  ManualSafeZonePreview
} from "./types";
import type {
  ControllerRemapListeningState
} from "../controller/binding-capture";
import {
  clientOptionsDefaultTabId
} from "./config";

export interface UseClientOptionsActionsDependencies {
  readonly clientOptions: Nh3dClientOptions;
  readonly setClientOptions: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly controller: Nethack3DEngineController | null;
  readonly setIsControllerSupportPromptVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setHasAskedControllerSupportThisSession: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setActiveClientOptionsTab: React.Dispatch<React.SetStateAction<ClientOptionsTabId>>;
  readonly setIsClientOptionsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsDarkWallTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsTilesetBackgroundTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsTilesetSolidColorPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsTilesetManagerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsResetClientOptionsConfirmationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsControllerRemapVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setControllerRemapListening: React.Dispatch<React.SetStateAction<ControllerRemapListeningState | null>>;
  readonly soundPackDialogActionsRef: React.MutableRefObject<SoundPackDialogActions | null>;
  readonly clientOptionsDraft: Nh3dClientOptions;
  readonly setManualSafeZonePreview: React.Dispatch<React.SetStateAction<ManualSafeZonePreview | null>>;
  readonly manualSafeZonePreviewTimerRef: React.MutableRefObject<number | null>;
}

/** Applies, discards and resets settings drafts and coordinates sound-pack changes. */
export function useClientOptionsActions(dependencies: UseClientOptionsActionsDependencies) {
  const {
    clientOptions,
    setClientOptions,
    setClientOptionsDraft,
    controller,
    setIsControllerSupportPromptVisible,
    setHasAskedControllerSupportThisSession,
    setActiveClientOptionsTab,
    setIsClientOptionsVisible,
    setIsDarkWallTilePickerVisible,
    setIsTilesetBackgroundTilePickerVisible,
    setIsTilesetSolidColorPickerVisible,
    setIsTilesetManagerVisible,
    setIsResetClientOptionsConfirmationVisible,
    setIsControllerRemapVisible,
    setControllerRemapListening,
    soundPackDialogActionsRef,
    clientOptionsDraft,
    setManualSafeZonePreview,
    manualSafeZonePreviewTimerRef,
  } = dependencies;

  const confirmControllerSupportPromptChoice = useCallback(
    (enabled: boolean): void => {
      const next = normalizeNh3dClientOptions({
        ...clientOptions,
        controllerEnabled: enabled,
      });
      setClientOptions(next);
      setClientOptionsDraft((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          controllerEnabled: enabled,
        }),
      );
      controller?.setClientOptions(next);
      setIsControllerSupportPromptVisible(false);
      setHasAskedControllerSupportThisSession(true);
    },
    [clientOptions, controller],
  );

  const openClientOptionsDialog = (): void => {
    setClientOptionsDraft({ ...clientOptions });
    setActiveClientOptionsTab(clientOptionsDefaultTabId);
    setIsClientOptionsVisible(true);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    controller?.dismissFpsCrosshairContextMenu();
  };

  const persistLocaleSelectionAndReloadIfNeeded = useCallback(
    async (nextOptions: Nh3dClientOptions): Promise<void> => {
      const previousLocale = getCurrentLocale();
      setCurrentLocale(nextOptions.locale);
      if (nextOptions.locale === previousLocale) {
        return;
      }
      try {
        await persistNh3dClientOptionsToIndexedDb(nextOptions);
      } catch (error) {
        console.warn(
          "Failed to persist client options before locale reload:",
          error,
        );
      }
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    [],
  );

  const closeClientOptionsDialog = async (): Promise<void> => {
    const canDiscardSoundPackChanges =
      (await soundPackDialogActionsRef.current?.confirmDiscardIfNeeded()) ??
      true;
    if (!canDiscardSoundPackChanges) {
      return;
    }
    setIsClientOptionsVisible(false);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    setClientOptionsDraft({ ...clientOptions });
  };

  const confirmClientOptionsDialog = async (): Promise<void> => {
    const didSaveSoundPackChanges =
      (await soundPackDialogActionsRef.current?.saveIfNeeded()) ?? true;
    if (!didSaveSoundPackChanges) {
      return;
    }
    const next = normalizeNh3dClientOptions(clientOptionsDraft);
    setClientOptions(next);
    setClientOptionsDraft(next);
    setIsClientOptionsVisible(false);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    controller?.setClientOptions(next);
    await persistLocaleSelectionAndReloadIfNeeded(next);
  };

  const requestCloseClientOptionsDialog = (): void => {
    void closeClientOptionsDialog();
  };

  const requestConfirmClientOptionsDialog = (): void => {
    void confirmClientOptionsDialog();
  };

  const openResetClientOptionsConfirmation = (): void => {
    setIsResetClientOptionsConfirmationVisible(true);
  };

  const cancelResetClientOptionsConfirmation = (): void => {
    setIsResetClientOptionsConfirmationVisible(false);
  };

  const confirmResetClientOptionsToDefaults = async (): Promise<void> => {
    const next = normalizeNh3dClientOptions(defaultNh3dClientOptions);
    setClientOptions(next);
    setClientOptionsDraft(next);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    controller?.setClientOptions(next);
    try {
      await resetNh3dDefaultSoundPackVolumeLevelsToDefaults();
    } catch (error) {
      console.warn(
        "Failed to reset default sound-pack volume levels to defaults:",
        error,
      );
    } finally {
      try {
        await soundPackDialogActionsRef.current?.reloadFromStorage();
      } catch (error) {
        console.warn(
          "Failed to reload sound-pack state after resetting defaults:",
          error,
        );
      }
    }
    await persistLocaleSelectionAndReloadIfNeeded(next);
  };

  const updateClientOptionDraft = <
    K extends
    | ClientOptionToggleKey
    | ClientOptionSelect["key"]
    | ClientOptionSlider["key"]
    | ClientOptionColor["key"],
  >(
    optionKey: K,
    value: Nh3dClientOptions[K],
  ): void => {
    setClientOptionsDraft((previous) => ({
      ...previous,
      [optionKey]: value,
    }));
  };

  const showManualSafeZonePreview = useCallback(
    (side: ManualSafeZonePreview["side"], rawSizePx: number): void => {
      const sizePx = Math.max(0, Math.min(100, Math.round(rawSizePx)));
      setManualSafeZonePreview({ side, sizePx });
      if (typeof window === "undefined") {
        return;
      }
      if (manualSafeZonePreviewTimerRef.current !== null) {
        window.clearTimeout(manualSafeZonePreviewTimerRef.current);
      }
      manualSafeZonePreviewTimerRef.current = window.setTimeout(() => {
        setManualSafeZonePreview(null);
        manualSafeZonePreviewTimerRef.current = null;
      }, 1200);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        manualSafeZonePreviewTimerRef.current !== null
      ) {
        window.clearTimeout(manualSafeZonePreviewTimerRef.current);
      }
    };
  }, []);
  return {
    confirmControllerSupportPromptChoice,
    openClientOptionsDialog,
    requestCloseClientOptionsDialog,
    requestConfirmClientOptionsDialog,
    openResetClientOptionsConfirmation,
    cancelResetClientOptionsConfirmation,
    confirmResetClientOptionsToDefaults,
    updateClientOptionDraft,
    showManualSafeZonePreview,
  } as const;
}
