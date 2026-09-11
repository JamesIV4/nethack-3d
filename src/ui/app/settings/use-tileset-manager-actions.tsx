import {
  useCallback,
  useEffect,
  type ChangeEvent
} from "react";
import type { Nh3dClientOptions, Nethack3DEngineController } from "../../../game/ui-types";
import {
  normalizeNh3dClientOptions
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  findNh3dTilesetByPath,
  isNh3dTilesetPathAvailable,
  getNh3dUserTilesetPath,
  setNh3dUserTilesets,
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import {
  deleteStoredUserTileset,
  listStoredUserTilesets,
  saveStoredUserTileset,
  type StoredUserTilesetRecord,
  type StoredUserTilesetTileLayoutVersion
} from "../../../game/user-tileset-storage";
import {
  loadPersistedNh3dClientOptionsWithMigration
} from "../../../storage/client-options-storage";
import type * as React from "react";
import type {
  TileAtlasState
} from "../tilesets/atlas";
import {
  appendUserTilesetNameSuffix,
  defaultUserTilesetTileLayoutVersion,
  inferTilesetTileSizeFromBlob,
  normalizeUserTilesetTileSizes,
  stripUserTilesetNameSuffix,
  toUserTilesetRegistrations
} from "../tilesets/user-tilesets";
import {
  nh3dClientOptionsStorageKey,
  resolveInitialClientOptionsFromPersisted
} from "./defaults";
import {
  createDefaultTileAtlasState
} from "../tilesets/atlas";
import {
  commonStrings,
  t
} from "../shared/translations";
import type { ConfirmationDialogRequest } from "../../modals/useConfirmationDialog";


export interface UseTilesetManagerActionsDependencies {
  readonly setUserTilesets: React.Dispatch<React.SetStateAction<StoredUserTilesetRecord[]>>;
  readonly initialPersistedClientOptionsRef: React.MutableRefObject<Partial<Nh3dClientOptions> | null>;
  readonly setClientOptions: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly setHasHydratedUserTilesets: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setTilesetManagerFile: React.Dispatch<React.SetStateAction<File | null>>;
  readonly tilesetManagerFileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  readonly setTilesetManagerMode: React.Dispatch<React.SetStateAction<"edit" | "new">>;
  readonly setTilesetManagerEditPath: React.Dispatch<React.SetStateAction<string>>;
  readonly setTilesetManagerName: React.Dispatch<React.SetStateAction<string>>;
  readonly setTilesetManagerTileLayoutVersion: React.Dispatch<React.SetStateAction<StoredUserTilesetTileLayoutVersion>>;
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly setTilesetManagerAtlasState: React.Dispatch<React.SetStateAction<TileAtlasState>>;
  readonly setTilesetManagerAtlasImage: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>;
  readonly setIsTilesetBackgroundTilePickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsTilesetSolidColorPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setTilesetManagerError: React.Dispatch<React.SetStateAction<string>>;
  readonly userTilesetRecordByPath: Map<string, StoredUserTilesetRecord>;
  readonly tilesetManagerEditPath: string;
  readonly clientOptionsDraft: Nh3dClientOptions;
  readonly tilesetCatalog: readonly Nh3dTilesetEntry[];
  readonly setIsTilesetManagerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly tilesetManagerName: string;
  readonly requestConfirmation: (request: ConfirmationDialogRequest) => Promise<boolean>;
  readonly setTilesetManagerBusy: React.Dispatch<React.SetStateAction<boolean>>;
  readonly selectedTilesetManagerEditPath: string;
  readonly clientOptions: Nh3dClientOptions;
  readonly controller: Nethack3DEngineController | null;
  readonly tilesetManagerFile: File | null;
  readonly tilesetManagerTileLayoutVersion: StoredUserTilesetTileLayoutVersion;
  readonly tilesetManagerInNewMode: boolean;
  readonly selectedTilesetManagerEditUserRecord: StoredUserTilesetRecord | null;
}

/** Hydrates uploaded tilesets and handles tileset editing, saving and removal. */
export function useTilesetManagerActions(dependencies: UseTilesetManagerActionsDependencies) {
  const {
    setUserTilesets,
    initialPersistedClientOptionsRef,
    setClientOptions,
    setClientOptionsDraft,
    setHasHydratedUserTilesets,
    setTilesetManagerFile,
    tilesetManagerFileInputRef,
    setTilesetManagerMode,
    setTilesetManagerEditPath,
    setTilesetManagerName,
    setTilesetManagerTileLayoutVersion,
    activeRuntimeVersion,
    setTilesetManagerAtlasState,
    setTilesetManagerAtlasImage,
    setIsTilesetBackgroundTilePickerVisible,
    setIsTilesetSolidColorPickerVisible,
    setTilesetManagerError,
    userTilesetRecordByPath,
    tilesetManagerEditPath,
    clientOptionsDraft,
    tilesetCatalog,
    setIsTilesetManagerVisible,
    tilesetManagerName,
    requestConfirmation,
    setTilesetManagerBusy,
    selectedTilesetManagerEditPath,
    clientOptions,
    controller,
    tilesetManagerFile,
    tilesetManagerTileLayoutVersion,
    tilesetManagerInNewMode,
    selectedTilesetManagerEditUserRecord,
  } = dependencies;

  const refreshUserTilesetCatalog = useCallback(
    async (rehydrateFromStorage: boolean): Promise<void> => {
      try {
        const records = await listStoredUserTilesets();
        const normalizedRecords = await normalizeUserTilesetTileSizes(records);
        setUserTilesets(normalizedRecords);
        setNh3dUserTilesets(toUserTilesetRegistrations(normalizedRecords));
        if (rehydrateFromStorage) {
          const persistedOptions =
            await loadPersistedNh3dClientOptionsWithMigration(
              nh3dClientOptionsStorageKey,
            );
          initialPersistedClientOptionsRef.current = persistedOptions;
          const nextOptions =
            resolveInitialClientOptionsFromPersisted(persistedOptions);
          setClientOptions(nextOptions);
          setClientOptionsDraft(nextOptions);
          return;
        }
        setClientOptions((previous) => normalizeNh3dClientOptions(previous));
        setClientOptionsDraft((previous) =>
          normalizeNh3dClientOptions(previous),
        );
      } finally {
        if (rehydrateFromStorage) {
          setHasHydratedUserTilesets(true);
        }
      }
    },
    [],
  );

  const resetTilesetManagerSelectedFile = (): void => {
    setTilesetManagerFile(null);
    if (tilesetManagerFileInputRef.current) {
      tilesetManagerFileInputRef.current.value = "";
    }
  };

  const openTilesetManagerNewEditor = (): void => {
    setTilesetManagerMode("new");
    setTilesetManagerEditPath("");
    setTilesetManagerName("");
    setTilesetManagerTileLayoutVersion(
      activeRuntimeVersion === "slashem"
        ? "slashem"
        : defaultUserTilesetTileLayoutVersion,
    );
    setTilesetManagerAtlasState(createDefaultTileAtlasState());
    setTilesetManagerAtlasImage(null);
    resetTilesetManagerSelectedFile();
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setTilesetManagerError("");
  };

  const openTilesetManagerEditor = (rawTilesetPath: string): void => {
    const tilesetPath = String(rawTilesetPath || "").trim();
    if (!tilesetPath) {
      return;
    }
    const tilesetEntry = findNh3dTilesetByPath(tilesetPath);
    if (!tilesetEntry) {
      return;
    }
    const userRecord = userTilesetRecordByPath.get(tilesetPath);
    const currentEditPath = String(tilesetManagerEditPath || "").trim();
    setTilesetManagerMode("edit");
    setTilesetManagerEditPath(tilesetPath);
    setTilesetManagerName(
      userRecord
        ? stripUserTilesetNameSuffix(userRecord.label)
        : tilesetEntry.label,
    );
    setTilesetManagerTileLayoutVersion(
      userRecord
        ? userRecord.tileLayoutVersion
        : tilesetEntry.tileLayoutVersion === "slashem"
          ? "slashem"
          : tilesetEntry.tileLayoutVersion === "3.4.3"
            ? "3.4.3"
            : tilesetEntry.tileLayoutVersion === "5.0"
              ? "5.0"
              : "3.6.7",
    );
    if (tilesetPath !== currentEditPath) {
      setTilesetManagerAtlasState(createDefaultTileAtlasState());
      setTilesetManagerAtlasImage(null);
    }
    resetTilesetManagerSelectedFile();
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setTilesetManagerError("");
  };

  const openTilesetManager = (): void => {
    const activeTilesetPath = String(
      clientOptionsDraft.tilesetPath || "",
    ).trim();
    const fallbackTilesetPath = tilesetCatalog[0]?.path ?? "";
    const nextEditPath =
      (activeTilesetPath && isNh3dTilesetPathAvailable(activeTilesetPath)
        ? activeTilesetPath
        : "") || fallbackTilesetPath;
    if (nextEditPath) {
      openTilesetManagerEditor(nextEditPath);
    } else {
      openTilesetManagerNewEditor();
    }
    setIsTilesetManagerVisible(true);
  };

  const closeTilesetManager = (): void => {
    setIsTilesetManagerVisible(false);
    setTilesetManagerMode("edit");
    setTilesetManagerEditPath("");
    setTilesetManagerName("");
    setTilesetManagerTileLayoutVersion(defaultUserTilesetTileLayoutVersion);
    setTilesetManagerAtlasState(createDefaultTileAtlasState());
    setTilesetManagerAtlasImage(null);
    resetTilesetManagerSelectedFile();
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setTilesetManagerError("");
  };

  const handleTilesetManagerFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0] ?? null;
    setTilesetManagerFile(file);
    if (!file) {
      return;
    }
    const strippedName = String(file.name || "")
      .replace(/\.[^.]+$/g, "")
      .trim();
    if (!tilesetManagerName.trim()) {
      setTilesetManagerName(strippedName || t.tilesets.userTileset);
    }
  };

  const removeUserTileset = async (
    record: StoredUserTilesetRecord,
  ): Promise<void> => {
    const label = String(record.label || t.tilesets.currentSelectionFallback);
    const confirmed = await requestConfirmation({
      title: t.tilesets.deleteUploadedTitle,
      message: t.tilesets.deleteUploadedMessage(label),
      confirmLabel: commonStrings.delete,
      cancelLabel: commonStrings.cancel,
      confirmClassName: "nh3d-menu-action-cancel",
    });
    if (!confirmed) {
      return;
    }
    setTilesetManagerBusy(true);
    setTilesetManagerError("");
    try {
      await deleteStoredUserTileset(record.id);
      await refreshUserTilesetCatalog(false);
      const deletedPath = getNh3dUserTilesetPath(record.id);
      if (selectedTilesetManagerEditPath === deletedPath) {
        const activeTilesetPath = String(
          clientOptionsDraft.tilesetPath || "",
        ).trim();
        const fallbackTilesetPath = tilesetCatalog[0]?.path ?? "";
        const nextEditPath =
          (activeTilesetPath &&
            activeTilesetPath !== deletedPath &&
            isNh3dTilesetPathAvailable(activeTilesetPath)
            ? activeTilesetPath
            : "") || fallbackTilesetPath;
        if (nextEditPath && nextEditPath !== deletedPath) {
          openTilesetManagerEditor(nextEditPath);
        } else {
          openTilesetManagerNewEditor();
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.tilesets.failedToDelete;
      setTilesetManagerError(message);
    } finally {
      setTilesetManagerBusy(false);
    }
  };

  const saveTilesetManagerSettingsDraft = (): void => {
    const next = normalizeNh3dClientOptions({
      ...clientOptions,
      tilesetBackgroundTileIdByTileset:
        clientOptionsDraft.tilesetBackgroundTileIdByTileset,
      tilesetBackgroundRemovalModeByTileset:
        clientOptionsDraft.tilesetBackgroundRemovalModeByTileset,
      tilesetSolidChromaKeyColorHexByTileset:
        clientOptionsDraft.tilesetSolidChromaKeyColorHexByTileset,
      fpsHeldWeaponSpriteFlipXByTileset:
        clientOptionsDraft.fpsHeldWeaponSpriteFlipXByTileset,
    });
    setClientOptions(next);
    setClientOptionsDraft((previous) =>
      normalizeNh3dClientOptions({
        ...previous,
        tilesetBackgroundTileIdByTileset: next.tilesetBackgroundTileIdByTileset,
        tilesetBackgroundRemovalModeByTileset:
          next.tilesetBackgroundRemovalModeByTileset,
        tilesetSolidChromaKeyColorHexByTileset:
          next.tilesetSolidChromaKeyColorHexByTileset,
        tilesetBackgroundTileId: next.tilesetBackgroundTileId,
        tilesetBackgroundRemovalMode: next.tilesetBackgroundRemovalMode,
        tilesetSolidChromaKeyColorHex: next.tilesetSolidChromaKeyColorHex,
        fpsHeldWeaponSpriteFlipX: next.fpsHeldWeaponSpriteFlipX,
        fpsHeldWeaponSpriteFlipXByTileset:
          next.fpsHeldWeaponSpriteFlipXByTileset,
      }),
    );
    controller?.setClientOptions(next);
  };

  const saveTilesetManager = async (): Promise<void> => {
    const file = tilesetManagerFile;
    const label = stripUserTilesetNameSuffix(tilesetManagerName);
    const userLabel = appendUserTilesetNameSuffix(label);
    const tileLayoutVersion = tilesetManagerTileLayoutVersion;
    if (tilesetManagerInNewMode) {
      if (!file) {
        setTilesetManagerError(t.tilesets.chooseFile);
        return;
      }
      if (!label) {
        setTilesetManagerError(t.tilesets.provideName);
        return;
      }
    }
    if (
      !tilesetManagerInNewMode &&
      selectedTilesetManagerEditUserRecord &&
      !label
    ) {
      setTilesetManagerError(t.tilesets.provideName);
      return;
    }

    setTilesetManagerBusy(true);
    setTilesetManagerError("");
    try {
      if (tilesetManagerInNewMode) {
        const tileSize = await inferTilesetTileSizeFromBlob(file as File);
        const savedRecord = await saveStoredUserTileset({
          label: userLabel,
          tileSize,
          tileLayoutVersion,
          fileName: (file as File).name,
          file: file as File,
        });
        await refreshUserTilesetCatalog(false);
        openTilesetManagerEditor(getNh3dUserTilesetPath(savedRecord.id));
        setTilesetManagerName(label);
      } else if (selectedTilesetManagerEditUserRecord) {
        const nextFile = file ?? selectedTilesetManagerEditUserRecord.blob;
        const nextFileName = file
          ? file.name
          : selectedTilesetManagerEditUserRecord.fileName;
        const nextTileSize = file
          ? await inferTilesetTileSizeFromBlob(file)
          : selectedTilesetManagerEditUserRecord.tileSize;
        await saveStoredUserTileset({
          id: selectedTilesetManagerEditUserRecord.id,
          label: userLabel,
          tileSize: nextTileSize,
          tileLayoutVersion,
          fileName: nextFileName,
          file: nextFile,
        });
        await refreshUserTilesetCatalog(false);
        openTilesetManagerEditor(
          getNh3dUserTilesetPath(selectedTilesetManagerEditUserRecord.id),
        );
        setTilesetManagerName(label);
      }
      saveTilesetManagerSettingsDraft();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.tilesets.failedToSave;
      setTilesetManagerError(message);
    } finally {
      setTilesetManagerBusy(false);
    }
  };

  useEffect(() => {
    refreshUserTilesetCatalog(true).catch((error) => {
      console.warn(t.tilesets.failedToLoadUploaded, error);
    });
  }, [refreshUserTilesetCatalog]);
  return {
    openTilesetManagerNewEditor,
    openTilesetManagerEditor,
    openTilesetManager,
    closeTilesetManager,
    handleTilesetManagerFileChange,
    removeUserTileset,
    saveTilesetManager,
  } as const;
}
