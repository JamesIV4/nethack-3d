import {
  useEffect
} from "react";
import type { Nh3dClientOptions, Nethack3DEngineController } from "../../../game/ui-types";
import {
  normalizeNh3dClientOptions
} from "../../../game/ui-types";
import {
  persistNh3dClientOptionsToIndexedDb
} from "../../../storage/client-options-storage";
import {
  getCurrentLocale,
  setCurrentLocale
} from "../../../i18n/core";

export interface UseAppliedClientOptionsEffectsDependencies {
  readonly controller: Nethack3DEngineController | null;
  readonly clientOptions: Nh3dClientOptions;
  readonly isControllerSupportPromptVisible: boolean;
  readonly hasHydratedUserTilesets: boolean;
}

/** Applies client options to the engine and persists hydrated settings. */
export function useAppliedClientOptionsEffects(dependencies: UseAppliedClientOptionsEffectsDependencies) {
  const {
    controller,
    clientOptions,
    isControllerSupportPromptVisible,
    hasHydratedUserTilesets,
  } = dependencies;

  useEffect(() => {
    if (!controller) {
      return;
    }
    controller.setClientOptions(clientOptions);
  }, [controller, clientOptions]);

  useEffect(() => {
    if (!controller || !isControllerSupportPromptVisible) {
      return;
    }
    controller.setClientOptions(
      normalizeNh3dClientOptions({
        ...clientOptions,
        controllerEnabled: true,
      }),
    );
  }, [clientOptions, controller, isControllerSupportPromptVisible]);

  useEffect(() => {
    if (!hasHydratedUserTilesets) {
      return;
    }
    const currentLocale = getCurrentLocale();
    if (clientOptions.locale === currentLocale) {
      return;
    }
    setCurrentLocale(clientOptions.locale);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, [clientOptions.locale, hasHydratedUserTilesets]);

  useEffect(() => {
    if (!hasHydratedUserTilesets) {
      return;
    }
    persistNh3dClientOptionsToIndexedDb(clientOptions).catch((error) => {
      console.warn("Failed to persist client options to IndexedDB:", error);
    });
  }, [clientOptions, hasHydratedUserTilesets]);

}
