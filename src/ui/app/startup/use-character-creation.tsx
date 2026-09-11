import {
  useCallback,
  useEffect,
  useMemo
} from "react";
import type {
  CharacterCreationConfig,
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  normalizeNh3dClientOptions
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  appendRequiredStartupInitOptionTokens,
  createDefaultStartupInitOptionValues,
  serializeStartupInitOptionTokens,
  type StartupInitOptionValue,
  type StartupInitOptionValues
} from "../../../runtime/startup-init-options";
import {
  resolveNh3dCompatibleTilesetPathForRuntime
} from "../../../game/tilesets";
import {
  type StartupCharacterPreferences
} from "../../../storage/client-options-storage";
import { normalizeStartupCreateCharacterSelection, type StartupCreateCharacterSelection } from "../../../game/helpers/startup-character-constraints";
import type * as React from "react";
import {
  areStartupCharacterPreferencesEqual,
  createDefaultStartupCharacterPreferences,
  normalizeStartupCharacterName,
  resolveEffectiveStartupCharacterName,
  resolveStartupCharacterPreferencesForRuntime
} from "./character-preferences";
import type {
  SaveGameRecord
} from "./saved-games";
import {
  deleteSavedGame,
  fetchSavedGames
} from "./saved-games";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  persistSavePresentationMetadataForCharacter
} from "./save-presentation";
import type { ConfirmationDialogRequest, ConfirmationDialogChoice } from "../../modals/useConfirmationDialog";


export interface UseCharacterCreationDependencies {
  readonly runtimeVersion: NethackRuntimeVersion;
  readonly requestConfirmationChoice: (request: ConfirmationDialogRequest) => Promise<ConfirmationDialogChoice>;
  readonly clientOptions: Nh3dClientOptions;
  readonly setClientOptions: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly setCharacterCreationConfig: React.Dispatch<React.SetStateAction<CharacterCreationConfig | null>>;
  readonly setStartupInitOptionValues: React.Dispatch<React.SetStateAction<StartupInitOptionValues>>;
  readonly startupInitOptionValues: StartupInitOptionValues;
  readonly randomCharacterName: string;
  readonly createCharacterName: string;
  readonly normalizedCreateCharacterSelection: StartupCreateCharacterSelection;
  readonly createRole: string;
  readonly setCreateRole: React.Dispatch<React.SetStateAction<string>>;
  readonly createRace: string;
  readonly setCreateRace: React.Dispatch<React.SetStateAction<string>>;
  readonly createGender: string;
  readonly setCreateGender: React.Dispatch<React.SetStateAction<string>>;
  readonly createAlign: string;
  readonly setCreateAlign: React.Dispatch<React.SetStateAction<string>>;
  readonly hasHydratedStartupCharacterPreferences: boolean;
  readonly startupCharacterPreferencesStateRuntimeRef: React.MutableRefObject<NethackRuntimeVersion | null>;
  readonly setStartupCharacterPreferencesByRuntime: React.Dispatch<React.SetStateAction<Partial<Record<NethackRuntimeVersion, StartupCharacterPreferences>>>>;
  readonly startupCharacterPreferencesByRuntime: Partial<Record<NethackRuntimeVersion, StartupCharacterPreferences>>;
  readonly startupDefaultCharacterPreferencesByRuntime: Partial<Record<NethackRuntimeVersion, StartupCharacterPreferences>>;
  readonly setRandomCharacterName: React.Dispatch<React.SetStateAction<string>>;
  readonly setCreateCharacterName: React.Dispatch<React.SetStateAction<string>>;
}

/** Validates character choices, updates startup options and starts new games. */
export function useCharacterCreation(dependencies: UseCharacterCreationDependencies) {
  const {
    runtimeVersion,
    setCharacterCreationConfig,
    setStartupInitOptionValues,
    startupInitOptionValues,
    randomCharacterName,
    createCharacterName,
    normalizedCreateCharacterSelection,
    createRole,
    setCreateRole,
    createRace,
    setCreateRace,
    createGender,
    setCreateGender,
    createAlign,
    setCreateAlign,
    hasHydratedStartupCharacterPreferences,
    startupCharacterPreferencesStateRuntimeRef,
    setStartupCharacterPreferencesByRuntime,
    startupCharacterPreferencesByRuntime,
    startupDefaultCharacterPreferencesByRuntime,
    setRandomCharacterName,
    setCreateCharacterName,
  } = dependencies;

  const handleStartNewGame = async (config: CharacterCreationConfig) => {
    const runtimeVersionForLaunch = config.runtimeVersion ?? runtimeVersion;
    const normalizedInitOptions = appendRequiredStartupInitOptionTokens(
      config.initOptions,
      runtimeVersionForLaunch,
    );
    const requestedCharacterName = normalizeStartupCharacterName(
      config.name || "",
    );
    const effectiveCharacterName = resolveEffectiveStartupCharacterName({
      ...config,
      runtimeVersion: runtimeVersionForLaunch,
      initOptions: normalizedInitOptions,
    });
    let resumeExistingSave: SaveGameRecord | null = null;
    if (config.mode === "random" || config.mode === "create") {
      try {
        const saves = await fetchSavedGames(runtimeVersionForLaunch);
        const configName = effectiveCharacterName;
        const matchingSaves = saves.filter((s) => s.name === configName);
        if (matchingSaves.length > 0) {
          const choice = await dependencies.requestConfirmationChoice({
            title: t.saves.overwriteTitle,
            message: t.saves.overwriteMessage(configName),
            confirmLabel: "Overwrite",
            cancelLabel: commonStrings.cancel,
            confirmClassName: "nh3d-menu-action-cancel",
            extraLabel: t.saves.loadExisting,
          });
          if (choice === "cancel") {
            return;
          }
          if (choice === "extra") {
            // Load the detected save instead of starting a new character.
            // Prefer the most recent resumable match.
            resumeExistingSave =
              matchingSaves
                .filter((save) => save.isResumable)
                .sort(
                  (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
                )[0] ?? matchingSaves[0];
          } else {
            await Promise.all(
              matchingSaves.map((save) => deleteSavedGame(save)),
            );
          }
        }
      } catch (e) {
        console.warn("Failed to check for existing saves:", e);
      }
      if (!resumeExistingSave) {
        persistSavePresentationMetadataForCharacter(
          effectiveCharacterName,
          requestedCharacterName,
          runtimeVersionForLaunch,
          normalizedInitOptions,
        );
      }
    }
    const currentTilesetPath = String(dependencies.clientOptions.tilesetPath || "").trim();
    const compatibleTilesetPath = resolveNh3dCompatibleTilesetPathForRuntime(
      currentTilesetPath,
      runtimeVersionForLaunch,
    );
    if (compatibleTilesetPath && compatibleTilesetPath !== currentTilesetPath) {
      dependencies.setClientOptions((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleTilesetPath,
        }),
      );
      dependencies.setClientOptionsDraft((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleTilesetPath,
        }),
      );
    }
    if (resumeExistingSave) {
      setCharacterCreationConfig({
        mode: "resume",
        playMode: dependencies.clientOptions.fpsMode ? "fps" : "normal",
        runtimeVersion: runtimeVersionForLaunch,
        name: resumeExistingSave.name,
        initOptions: resumeExistingSave.initOptions,
        resumeCategory: resumeExistingSave.category,
      });
      return;
    }
    setCharacterCreationConfig({
      ...config,
      runtimeVersion: runtimeVersionForLaunch,
      name: effectiveCharacterName,
      initOptions: normalizedInitOptions,
    });
  };

  const updateStartupInitOptionValue = useCallback(
    (key: string, value: StartupInitOptionValue): void => {
      setStartupInitOptionValues((previous) => ({
        ...previous,
        [key]: value,
      }));
    },
    [],
  );

  const resetStartupInitOptionValues = useCallback((): void => {
    setStartupInitOptionValues(createDefaultStartupInitOptionValues());
  }, []);

  const startupInitOptionTokens = useMemo(
    () =>
      serializeStartupInitOptionTokens(startupInitOptionValues, runtimeVersion),
    [runtimeVersion, startupInitOptionValues],
  );

  const startupCharacterPreferences = useMemo<StartupCharacterPreferences>(
    () => ({
      randomName: randomCharacterName,
      createName: createCharacterName,
      createRole: normalizedCreateCharacterSelection.role,
      createRace: normalizedCreateCharacterSelection.race,
      createGender: normalizedCreateCharacterSelection.gender,
      createAlign: normalizedCreateCharacterSelection.align,
    }),
    [
      randomCharacterName,
      createCharacterName,
      normalizedCreateCharacterSelection.role,
      normalizedCreateCharacterSelection.race,
      normalizedCreateCharacterSelection.gender,
      normalizedCreateCharacterSelection.align,
    ],
  );

  useEffect(() => {
    if (createRole !== normalizedCreateCharacterSelection.role) {
      setCreateRole(normalizedCreateCharacterSelection.role);
    }
    if (createRace !== normalizedCreateCharacterSelection.race) {
      setCreateRace(normalizedCreateCharacterSelection.race);
    }
    if (createGender !== normalizedCreateCharacterSelection.gender) {
      setCreateGender(normalizedCreateCharacterSelection.gender);
    }
    if (createAlign !== normalizedCreateCharacterSelection.align) {
      setCreateAlign(normalizedCreateCharacterSelection.align);
    }
  }, [
    createRole,
    createRace,
    createGender,
    createAlign,
    normalizedCreateCharacterSelection.role,
    normalizedCreateCharacterSelection.race,
    normalizedCreateCharacterSelection.gender,
    normalizedCreateCharacterSelection.align,
  ]);

  useEffect(() => {
    if (!hasHydratedStartupCharacterPreferences) {
      return;
    }
    if (startupCharacterPreferencesStateRuntimeRef.current !== runtimeVersion) {
      return;
    }
    setStartupCharacterPreferencesByRuntime((previous) => {
      if (
        areStartupCharacterPreferencesEqual(
          previous[runtimeVersion],
          startupCharacterPreferences,
        )
      ) {
        return previous;
      }
      return {
        ...previous,
        [runtimeVersion]: startupCharacterPreferences,
      };
    });
  }, [
    hasHydratedStartupCharacterPreferences,
    runtimeVersion,
    startupCharacterPreferences,
  ]);

  useEffect(() => {
    if (!hasHydratedStartupCharacterPreferences) {
      return;
    }
    if (startupCharacterPreferencesStateRuntimeRef.current === runtimeVersion) {
      return;
    }

    const runtimePreferences = resolveStartupCharacterPreferencesForRuntime(
      startupCharacterPreferencesByRuntime,
      startupDefaultCharacterPreferencesByRuntime,
      runtimeVersion,
    );
    const defaultRuntimePreferences =
      startupDefaultCharacterPreferencesByRuntime[runtimeVersion] ??
      createDefaultStartupCharacterPreferences(runtimeVersion);
    setRandomCharacterName(
      runtimePreferences.randomName || defaultRuntimePreferences.randomName,
    );
    setCreateCharacterName(
      runtimePreferences.createName || defaultRuntimePreferences.createName,
    );
    const normalizedRuntimeSelection = normalizeStartupCreateCharacterSelection(
      {
        role: runtimePreferences.createRole,
        race: runtimePreferences.createRace,
        gender: runtimePreferences.createGender,
        align: runtimePreferences.createAlign,
      },
      runtimeVersion,
    );
    setCreateRole(normalizedRuntimeSelection.role);
    setCreateRace(normalizedRuntimeSelection.race);
    setCreateGender(normalizedRuntimeSelection.gender);
    setCreateAlign(normalizedRuntimeSelection.align);
    startupCharacterPreferencesStateRuntimeRef.current = runtimeVersion;
  }, [
    hasHydratedStartupCharacterPreferences,
    runtimeVersion,
    startupCharacterPreferencesByRuntime,
    startupDefaultCharacterPreferencesByRuntime,
  ]);
  return {
    handleStartNewGame,
    updateStartupInitOptionValue,
    resetStartupInitOptionValues,
    startupInitOptionTokens,
  } as const;
}
