import {
  useEffect
} from "react";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  type StartupInitOptionValues
} from "../../../runtime/startup-init-options";
import {
  loadPersistedNh3dStartupCharacterPreferences,
  loadPersistedNh3dStartupInitOptions,
  persistNh3dStartupCharacterPreferencesToIndexedDb,
  persistNh3dStartupInitOptionsToIndexedDb,
  type StartupCharacterPreferences,
  type StartupCharacterPreferencesByRuntime
} from "../../../storage/client-options-storage";
import {
  normalizeStartupCreateCharacterSelection
} from "../../../game/helpers/startup-character-constraints";
import type * as React from "react";
import {
  createDefaultStartupCharacterPreferences,
  resolveStartupCharacterPreferencesForRuntime
} from "../startup/character-preferences";

export interface UseSettingsHydrationDependencies {
  readonly hasHydratedStartupCharacterPreferences: boolean;
  readonly startupDefaultCharacterPreferencesByRuntime: Partial<Record<NethackRuntimeVersion, StartupCharacterPreferences>>;
  readonly setStartupCharacterPreferencesByRuntime: React.Dispatch<React.SetStateAction<Partial<Record<NethackRuntimeVersion, StartupCharacterPreferences>>>>;
  readonly runtimeVersion: NethackRuntimeVersion;
  readonly setRandomCharacterName: React.Dispatch<React.SetStateAction<string>>;
  readonly setCreateCharacterName: React.Dispatch<React.SetStateAction<string>>;
  readonly setCreateRole: React.Dispatch<React.SetStateAction<string>>;
  readonly setCreateRace: React.Dispatch<React.SetStateAction<string>>;
  readonly setCreateGender: React.Dispatch<React.SetStateAction<string>>;
  readonly setCreateAlign: React.Dispatch<React.SetStateAction<string>>;
  readonly startupCharacterPreferencesStateRuntimeRef: React.MutableRefObject<NethackRuntimeVersion | null>;
  readonly setHasHydratedStartupCharacterPreferences: React.Dispatch<React.SetStateAction<boolean>>;
  readonly startupCharacterPreferencesByRuntime: Partial<Record<NethackRuntimeVersion, StartupCharacterPreferences>>;
  readonly setStartupInitOptionValues: React.Dispatch<React.SetStateAction<StartupInitOptionValues>>;
  readonly setHasHydratedStartupInitOptions: React.Dispatch<React.SetStateAction<boolean>>;
  readonly hasHydratedStartupInitOptions: boolean;
  readonly startupInitOptionValues: StartupInitOptionValues;
}

/** Hydrates and persists startup character preferences and init options. */
export function useSettingsHydration(dependencies: UseSettingsHydrationDependencies) {
  const {
    hasHydratedStartupCharacterPreferences,
    startupDefaultCharacterPreferencesByRuntime,
    setStartupCharacterPreferencesByRuntime,
    runtimeVersion,
    setRandomCharacterName,
    setCreateCharacterName,
    setCreateRole,
    setCreateRace,
    setCreateGender,
    setCreateAlign,
    startupCharacterPreferencesStateRuntimeRef,
    setHasHydratedStartupCharacterPreferences,
    startupCharacterPreferencesByRuntime,
    setStartupInitOptionValues,
    setHasHydratedStartupInitOptions,
    hasHydratedStartupInitOptions,
    startupInitOptionValues,
  } = dependencies;

  useEffect(() => {
    if (hasHydratedStartupCharacterPreferences) {
      return;
    }
    let disposed = false;
    loadPersistedNh3dStartupCharacterPreferences()
      .then((persistedPreferencesByRuntime) => {
        if (disposed) {
          return;
        }
        const mergedPreferencesByRuntime: StartupCharacterPreferencesByRuntime =
        {
          ...startupDefaultCharacterPreferencesByRuntime,
          ...(persistedPreferencesByRuntime ?? {}),
        };
        setStartupCharacterPreferencesByRuntime(mergedPreferencesByRuntime);
        const hydratedRuntimePreferences =
          resolveStartupCharacterPreferencesForRuntime(
            mergedPreferencesByRuntime,
            startupDefaultCharacterPreferencesByRuntime,
            runtimeVersion,
          );
        const defaultRuntimePreferences =
          startupDefaultCharacterPreferencesByRuntime[runtimeVersion] ??
          createDefaultStartupCharacterPreferences(runtimeVersion);
        setRandomCharacterName(
          hydratedRuntimePreferences.randomName ||
          defaultRuntimePreferences.randomName,
        );
        setCreateCharacterName(
          hydratedRuntimePreferences.createName ||
          defaultRuntimePreferences.createName,
        );
        const normalizedPersistedCreateSelection =
          normalizeStartupCreateCharacterSelection(
            {
              role: hydratedRuntimePreferences.createRole,
              race: hydratedRuntimePreferences.createRace,
              gender: hydratedRuntimePreferences.createGender,
              align: hydratedRuntimePreferences.createAlign,
            },
            runtimeVersion,
          );
        setCreateRole(normalizedPersistedCreateSelection.role);
        setCreateRace(normalizedPersistedCreateSelection.race);
        setCreateGender(normalizedPersistedCreateSelection.gender);
        setCreateAlign(normalizedPersistedCreateSelection.align);
        startupCharacterPreferencesStateRuntimeRef.current = runtimeVersion;
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        console.warn(
          "Failed to hydrate startup character preferences from IndexedDB:",
          error,
        );
      })
      .finally(() => {
        if (disposed) {
          return;
        }
        setHasHydratedStartupCharacterPreferences(true);
      });

    return () => {
      disposed = true;
    };
  }, [
    hasHydratedStartupCharacterPreferences,
    runtimeVersion,
    startupDefaultCharacterPreferencesByRuntime,
  ]);

  useEffect(() => {
    if (!hasHydratedStartupCharacterPreferences) {
      return;
    }
    persistNh3dStartupCharacterPreferencesToIndexedDb(
      startupCharacterPreferencesByRuntime,
    ).catch((error) => {
      console.warn(
        "Failed to persist startup character preferences to IndexedDB:",
        error,
      );
    });
  }, [
    hasHydratedStartupCharacterPreferences,
    startupCharacterPreferencesByRuntime,
  ]);

  useEffect(() => {
    let disposed = false;
    loadPersistedNh3dStartupInitOptions()
      .then((persistedValues) => {
        if (disposed || !persistedValues) {
          return;
        }
        setStartupInitOptionValues(persistedValues);
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        console.warn(
          "Failed to hydrate startup init options from IndexedDB:",
          error,
        );
      })
      .finally(() => {
        if (disposed) {
          return;
        }
        setHasHydratedStartupInitOptions(true);
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedStartupInitOptions) {
      return;
    }
    persistNh3dStartupInitOptionsToIndexedDb(startupInitOptionValues).catch(
      (error) => {
        console.warn(
          "Failed to persist startup init options to IndexedDB:",
          error,
        );
      },
    );
  }, [hasHydratedStartupInitOptions, startupInitOptionValues]);

}
