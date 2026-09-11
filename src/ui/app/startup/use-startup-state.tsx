import {
  useMemo,
  useRef,
  useState
} from "react";
import type {
  CharacterCreationConfig
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  createDefaultStartupInitOptionValues,
  type StartupInitOptionValues
} from "../../../runtime/startup-init-options";
import {
  type StartupCharacterPreferences,
  type StartupCharacterPreferencesByRuntime
} from "../../../storage/client-options-storage";
import {
  createDefaultStartupCharacterPreferences,
  createDefaultStartupCharacterPreferencesByRuntime
} from "./character-preferences";
import type {
  StartupFlowStep
} from "./character-preferences";
import {
  resolveRuntimeVersionDisplayLabel
} from "./RuntimeVersionBadge";
import type {
  SaveGameRecord
} from "./saved-games";

/** Seeds runtime preferences and owns the startup and canvas refs. */
export function useStartupState() {
  const startupDefaultCharacterPreferencesByRuntime = useMemo(
    () => createDefaultStartupCharacterPreferencesByRuntime(),
    [],
  );

  const startupDefaultCharacterPreferences =
    startupDefaultCharacterPreferencesByRuntime["3.6.7"] ??
    createDefaultStartupCharacterPreferences("3.6.7");

  const startupCharacterPreferencesStateRuntimeRef =
    useRef<NethackRuntimeVersion | null>("3.6.7");

  const [hasShownStartupMenu, setHasShownStartupMenu] = useState(false);

  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  return {
    startupDefaultCharacterPreferencesByRuntime,
    startupDefaultCharacterPreferences,
    startupCharacterPreferencesStateRuntimeRef,
    hasShownStartupMenu,
    setHasShownStartupMenu,
    canvasRootRef,
  } as const;
}

export interface UseStartupState2Dependencies {
  readonly startupDefaultCharacterPreferences: StartupCharacterPreferences;
  readonly startupDefaultCharacterPreferencesByRuntime: Partial<Record<NethackRuntimeVersion, StartupCharacterPreferences>>;
}

/** Owns character selections, startup options and saved-game state. */
export function useStartupState2(dependencies: UseStartupState2Dependencies) {
  const {
    startupDefaultCharacterPreferences,
    startupDefaultCharacterPreferencesByRuntime,
  } = dependencies;

  const startupRenderSignalSentRef = useRef(false);

  const [characterCreationConfig, setCharacterCreationConfig] =
    useState<CharacterCreationConfig | null>(null);

  const [startupFlowStep, setStartupFlowStep] =
    useState<StartupFlowStep>("variant");

  const [runtimeVersion, setRuntimeVersion] =
    useState<NethackRuntimeVersion>("3.6.7");

  const activeRuntimeVersion =
    characterCreationConfig?.runtimeVersion ?? runtimeVersion;

  const activeRuntimeVersionLabel =
    resolveRuntimeVersionDisplayLabel(activeRuntimeVersion);

  const [createRole, setCreateRole] = useState(
    startupDefaultCharacterPreferences.createRole,
  );

  const [createRace, setCreateRace] = useState(
    startupDefaultCharacterPreferences.createRace,
  );

  const [createGender, setCreateGender] = useState(
    startupDefaultCharacterPreferences.createGender,
  );

  const [createAlign, setCreateAlign] = useState(
    startupDefaultCharacterPreferences.createAlign,
  );

  const [randomCharacterName, setRandomCharacterName] = useState(
    startupDefaultCharacterPreferences.randomName,
  );

  const [createCharacterName, setCreateCharacterName] = useState(
    startupDefaultCharacterPreferences.createName,
  );

  const [
    startupCharacterPreferencesByRuntime,
    setStartupCharacterPreferencesByRuntime,
  ] = useState<StartupCharacterPreferencesByRuntime>(() => ({
    ...startupDefaultCharacterPreferencesByRuntime,
  }));

  const [
    hasHydratedStartupCharacterPreferences,
    setHasHydratedStartupCharacterPreferences,
  ] = useState(false);

  const [startupInitOptionsExpanded, setStartupInitOptionsExpanded] =
    useState(false);

  const [startupInitOptionValues, setStartupInitOptionValues] =
    useState<StartupInitOptionValues>(() =>
      createDefaultStartupInitOptionValues(),
    );

  const [hasHydratedStartupInitOptions, setHasHydratedStartupInitOptions] =
    useState(false);

  const [savedGames, setSavedGames] = useState<SaveGameRecord[]>([]);
  return {
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
  } as const;
}
