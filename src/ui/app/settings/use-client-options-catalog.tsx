import {
  useEffect,
  useMemo,
  useRef
} from "react";
import type {
  CharacterCreationConfig,
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  normalizeNh3dClientOptions
} from "../../../game/ui-types";
import {
  nh3dControllerActionSpecsByGroup
} from "../../../game/controller-bindings";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  getNh3dCompatibleTilesetCatalog,
  getNh3dUserTilesetPath,
  resolveNh3dCompatibleTilesetPathForRuntime
} from "../../../game/tilesets";
import {
  type StoredUserTilesetRecord
} from "../../../game/user-tileset-storage";
import type * as React from "react";
import type {
  StartupFlowStep
} from "../startup/character-preferences";
import type {
  ClientOptionsTab,
  ClientOptionsTabId
} from "./types";
import type {
  ControllerRemapListeningState
} from "../controller/binding-capture";
import {
  isRunningOnLocalhost
} from "../shared/platform";
import {
  formatTilesetPickerOptionLabel
} from "../tilesets/labels";
import {
  t
} from "../shared/translations";
import {
  clientOptionsTabs,
  resolveClientOptionsDefaultTabId,
  getClientOptionsForGroup
} from "./config";
import {
  controllerActionGroupOrder,
  getConnectedGamepadsForCapture
} from "../controller/binding-capture";

export interface UseClientOptionsCatalogDependencies {
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly userTilesets: StoredUserTilesetRecord[];
  readonly hasHydratedUserTilesets: boolean;
  readonly startupFlowStep: StartupFlowStep;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly clientOptions: Nh3dClientOptions;
  readonly setClientOptions: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly clientOptionsDraft: Nh3dClientOptions;
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly activeClientOptionsTab: ClientOptionsTabId;
  readonly controllerRemapListening: ControllerRemapListeningState | null;
  readonly isControllerRemapVisible: boolean;
}

/** Builds settings categories and tileset choices and enforces runtime compatibility. */
export function useClientOptionsCatalog(dependencies: UseClientOptionsCatalogDependencies) {
  const {
    activeRuntimeVersion,
    userTilesets,
    hasHydratedUserTilesets,
    startupFlowStep,
    characterCreationConfig,
    clientOptions,
    setClientOptions,
    clientOptionsDraft,
    setClientOptionsDraft,
    activeClientOptionsTab,
    controllerRemapListening,
    isControllerRemapVisible,
  } = dependencies;

  const clientOptionsLikelyOpenSelectElementsRef = useRef<
    Set<HTMLSelectElement>
  >(new Set());

  const clientOptionsLikelyOpenSelectInitialValueByElementRef = useRef<
    Map<HTMLSelectElement, string>
  >(new Map());

  const tilesetCatalog = useMemo(
    () => getNh3dCompatibleTilesetCatalog(activeRuntimeVersion),
    [activeRuntimeVersion, userTilesets],
  );

  const showBuiltInTilesetsInTilesetManagerList = useMemo(
    () => isRunningOnLocalhost(),
    [],
  );

  const showDeveloperClientSettings = showBuiltInTilesetsInTilesetManagerList;

  const userTilesetRecordByPath = useMemo(() => {
    const recordByPath = new Map<string, StoredUserTilesetRecord>();
    for (const record of userTilesets) {
      recordByPath.set(getNh3dUserTilesetPath(record.id), record);
    }
    return recordByPath;
  }, [userTilesets]);

  const tilesetManagerListTilesets = useMemo(
    () =>
      tilesetCatalog.filter(
        (tileset) =>
          tileset.source === "user" || showBuiltInTilesetsInTilesetManagerList,
      ),
    [showBuiltInTilesetsInTilesetManagerList, tilesetCatalog],
  );

  const hasAnyTilesets = tilesetCatalog.length > 0;

  const tilesetCatalogLayoutVersionCount = useMemo(
    () =>
      new Set(tilesetCatalog.map((tileset) => tileset.tileLayoutVersion)).size,
    [tilesetCatalog],
  );

  const showTilesetLayoutInDropdown = tilesetCatalogLayoutVersionCount > 1;

  const tilesetDropdownOptions = useMemo(
    () =>
      hasAnyTilesets
        ? tilesetCatalog.map((tileset) => ({
          value: tileset.path,
          label: formatTilesetPickerOptionLabel(
            tileset,
            showTilesetLayoutInDropdown,
          ),
        }))
        : [{ value: "", label: t.tilesets.noTilesetsFound }],
    [hasAnyTilesets, showTilesetLayoutInDropdown, tilesetCatalog],
  );

  useEffect(() => {
    // Runtime coercion overwrites (and persists over) clientOptions.tilesetPath,
    // so it must not run against the transient default runtime before the user
    // has chosen a variant — otherwise the last-used tileset from a different
    // runtime family is clobbered with the default runtime's default tileset on
    // every reload. Only coerce once options have hydrated and a runtime is
    // genuinely active (a variant was picked or a game is in progress).
    if (!hasHydratedUserTilesets) {
      return;
    }
    if (startupFlowStep === "variant" && !characterCreationConfig) {
      return;
    }
    const currentClientTilesetPath = String(
      clientOptions.tilesetPath || "",
    ).trim();
    const compatibleClientTilesetPath =
      resolveNh3dCompatibleTilesetPathForRuntime(
        currentClientTilesetPath,
        activeRuntimeVersion,
      );
    if (
      compatibleClientTilesetPath &&
      compatibleClientTilesetPath !== currentClientTilesetPath
    ) {
      setClientOptions((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleClientTilesetPath,
        }),
      );
    }

    const currentDraftTilesetPath = String(
      clientOptionsDraft.tilesetPath || "",
    ).trim();
    const compatibleDraftTilesetPath =
      resolveNh3dCompatibleTilesetPathForRuntime(
        currentDraftTilesetPath,
        activeRuntimeVersion,
      );
    if (
      compatibleDraftTilesetPath &&
      compatibleDraftTilesetPath !== currentDraftTilesetPath
    ) {
      setClientOptionsDraft((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleDraftTilesetPath,
        }),
      );
    }
  }, [
    clientOptions.tilesetPath,
    clientOptionsDraft.tilesetPath,
    activeRuntimeVersion,
    userTilesets,
    hasHydratedUserTilesets,
    startupFlowStep,
    characterCreationConfig,
  ]);

  const selectedClientOptionsTab = useMemo<ClientOptionsTab>(
    () =>
      clientOptionsTabs.find((tab) => tab.id === activeClientOptionsTab) ??
      clientOptionsTabs.find(tab => tab.id === resolveClientOptionsDefaultTabId())!,
    [activeClientOptionsTab],
  );

  const visibleClientOptions = useMemo(
    () => getClientOptionsForGroup(selectedClientOptionsTab.groupKey),
    [selectedClientOptionsTab.groupKey],
  );

  const controllerRemapListeningActionLabel = useMemo(() => {
    if (!controllerRemapListening) {
      return "";
    }
    for (const group of controllerActionGroupOrder) {
      const spec = nh3dControllerActionSpecsByGroup[group].find(
        (entry) => entry.id === controllerRemapListening.actionId,
      );
      if (spec) {
        return spec.label;
      }
    }
    return controllerRemapListening.actionId;
  }, [controllerRemapListening]);

  const connectedControllerCount = useMemo(
    () =>
      isControllerRemapVisible ? getConnectedGamepadsForCapture().length : 0,
    [isControllerRemapVisible, controllerRemapListening],
  );
  return {
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
  } as const;
}
