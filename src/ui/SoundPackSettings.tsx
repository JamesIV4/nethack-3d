import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import {
  cloneNh3dSoundPack,
  createNh3dSoundUploadSlotKey,
  createNh3dSoundPack,
  deleteNh3dSoundPackFromIndexedDb,
  exportNh3dSoundPackToZip,
  importNh3dSoundPackFromZip,
  loadNh3dSoundPackStateFromIndexedDb,
  loadStoredNh3dSoundBlob,
  nh3dBaseSoundVariationId,
  nh3dDefaultSoundPackId,
  nh3dSoundEffectDefinitions,
  resolveNh3dBundledBuiltinSoundPath,
  normalizeNh3dSoundPackName,
  resolveNh3dUserSoundPath,
  saveNh3dSoundPackToIndexedDb,
  setActiveNh3dSoundPackId,
  type Nh3dSoundEffectKey,
  type Nh3dSoundEffectVariation,
  type Nh3dSoundPackRecord,
  type Nh3dSoundFileUploadOverrides,
} from "../audio/sound-pack-storage";
import {
  useConfirmationDialog,
  type ConfirmationDialogRequest,
} from "./modals/useConfirmationDialog";
import ConfirmationModal from "./modals/ConfirmationModal";
import { getTranslationStrings } from "../i18n/core";

const translationStrings = getTranslationStrings();
const commonStrings = translationStrings.common;
const soundPackStrings = translationStrings.app.soundPack;

type SoundPackSettingsProps = {
  visible: boolean;
  requestConfirmation?: (
    request: SoundPackConfirmationRequest,
  ) => Promise<boolean>;
  onDialogActionsChange?: (actions: SoundPackDialogActions | null) => void;
};

export type SoundPackDialogActions = {
  saveIfNeeded: () => Promise<boolean>;
  confirmDiscardIfNeeded: () => Promise<boolean>;
  reloadFromStorage: () => Promise<void>;
};

export type SoundPackConfirmationRequest = ConfirmationDialogRequest;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function sanitizeArchiveFileName(value: string): string {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "sound-pack";
  }
  return normalized;
}

function stripHtmlToPlainText(value: string): string {
  const withoutTags = String(value || "").replace(/<[^>]*>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
}

type SoundVariationView = {
  id: string;
  isBase: boolean;
  value: Nh3dSoundEffectVariation;
};

function createVariationId(soundKey: Nh3dSoundEffectKey): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${soundKey}-${crypto.randomUUID()}`;
  }
  return `${soundKey}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function getSoundVariationViews(
  soundKey: Nh3dSoundEffectKey,
  sound: Nh3dSoundPackRecord["sounds"][Nh3dSoundEffectKey],
): SoundVariationView[] {
  const base: Nh3dSoundEffectVariation = {
    id: nh3dBaseSoundVariationId,
    key: soundKey,
    enabled: sound.enabled,
    volume: sound.volume,
    fileName: sound.fileName,
    mimeType: sound.mimeType,
    path: sound.path,
    source: sound.source,
    attribution: sound.attribution,
  };
  const extras = Array.isArray(sound.variations) ? sound.variations : [];
  return [
    { id: nh3dBaseSoundVariationId, isBase: true, value: base },
    ...extras.map((variation) => ({
      id: variation.id,
      isBase: false,
      value: {
        ...variation,
        key: soundKey,
      },
    })),
  ];
}

export default function SoundPackSettings({
  visible,
  requestConfirmation,
  onDialogActionsChange,
}: SoundPackSettingsProps): JSX.Element | null {
  const [packs, setPacks] = useState<Nh3dSoundPackRecord[]>([]);
  const [activePackId, setActivePackId] = useState("");
  const [draftPack, setDraftPack] = useState<Nh3dSoundPackRecord | null>(null);
  const [pendingUploads, setPendingUploads] =
    useState<Nh3dSoundFileUploadOverrides>({});
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [playingSoundSlotKey, setPlayingSoundSlotKey] = useState<string | null>(
    null,
  );
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const soundFileInputRefs = useRef<Record<string, HTMLInputElement | null>>(
    {},
  );
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const {
    dialog: localConfirmationDialog,
    requestConfirmation: requestLocalConfirmation,
    resolveConfirmation: resolveLocalConfirmation,
  } = useConfirmationDialog();

  const defaultPack = useMemo(
    () => packs.find((pack) => pack.id === nh3dDefaultSoundPackId) ?? null,
    [packs],
  );
  const isDefaultDraft = Boolean(draftPack?.isDefault);

  const stopPreview = useCallback((): void => {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.onended = null;
      audio.onerror = null;
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPlayingSoundSlotKey(null);
  }, []);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const requestInGameConfirmation = useCallback(
    (request: SoundPackConfirmationRequest): Promise<boolean> => {
      if (requestConfirmation) {
        return requestConfirmation(request);
      }
      return requestLocalConfirmation(request);
    },
    [requestConfirmation, requestLocalConfirmation],
  );

  const applyLoadedState = useCallback(
    (loadedPacks: Nh3dSoundPackRecord[], preferredPackId?: string): void => {
      const fallbackPack = loadedPacks[0] ?? null;
      const nextActivePack =
        (preferredPackId
          ? loadedPacks.find((pack) => pack.id === preferredPackId)
          : null) ?? fallbackPack;
      setPacks(loadedPacks);
      setActivePackId(nextActivePack?.id ?? "");
      setDraftPack(nextActivePack ? cloneNh3dSoundPack(nextActivePack) : null);
      setPendingUploads({});
      setIsDraftDirty(false);
      setIsCreateMode(false);
      setNewPackName("");
      stopPreview();
    },
    [stopPreview],
  );

  const reloadSoundPacks = useCallback(
    async (preferredPackId?: string): Promise<void> => {
      setIsLoading(true);
      setErrorText("");
      try {
        const state = await loadNh3dSoundPackStateFromIndexedDb();
        const activePackIdToUse =
          preferredPackId &&
          state.packs.some((pack) => pack.id === preferredPackId)
            ? preferredPackId
            : state.activePackId;
        applyLoadedState(state.packs, activePackIdToUse);
      } catch (error) {
        setErrorText(
          getErrorMessage(error, soundPackStrings.failedToLoadIndexedDb),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [applyLoadedState],
  );

  useEffect(() => {
    if (!visible || hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    void reloadSoundPacks();
  }, [reloadSoundPacks, visible]);

  const markDraftAsDirty = useCallback((): void => {
    setIsDraftDirty(true);
    setStatusText("");
    setErrorText("");
  }, []);

  const updateDraftSound = (
    soundKey: Nh3dSoundEffectKey,
    updater: (
      current: Nh3dSoundPackRecord["sounds"][Nh3dSoundEffectKey],
    ) => Nh3dSoundPackRecord["sounds"][Nh3dSoundEffectKey],
  ): void => {
    setDraftPack((previous) => {
      if (!previous) {
        return previous;
      }
      const current = previous.sounds[soundKey];
      const nextSound = updater(current);
      return {
        ...previous,
        sounds: {
          ...previous.sounds,
          [soundKey]: nextSound,
        },
      };
    });
    markDraftAsDirty();
  };

  const updateDraftSoundVariation = (
    soundKey: Nh3dSoundEffectKey,
    variationId: string,
    updater: (current: Nh3dSoundEffectVariation) => Nh3dSoundEffectVariation,
  ): void => {
    updateDraftSound(soundKey, (current) => {
      const views = getSoundVariationViews(soundKey, current);
      const nextViews = views.map((view) =>
        view.id === variationId
          ? {
              ...view,
              value: {
                ...updater(view.value),
                id: view.id,
                key: soundKey,
              },
            }
          : view,
      );
      const baseView =
        nextViews.find((view) => view.id === nh3dBaseSoundVariationId) ??
        nextViews[0];
      if (!baseView) {
        return current;
      }
      return {
        ...current,
        enabled: baseView.value.enabled,
        volume: baseView.value.volume,
        fileName: baseView.value.fileName,
        mimeType: baseView.value.mimeType,
        path: baseView.value.path,
        source: baseView.value.source,
        attribution: baseView.value.attribution,
        variations: nextViews
          .filter((view) => view.id !== nh3dBaseSoundVariationId)
          .map((view) => ({
            ...view.value,
            id: view.id,
            key: soundKey,
          })),
      };
    });
  };

  const addDraftSoundVariation = (soundKey: Nh3dSoundEffectKey): void => {
    updateDraftSound(soundKey, (current) => {
      const nextVariation: Nh3dSoundEffectVariation = {
        id: createVariationId(soundKey),
        key: soundKey,
        enabled: current.enabled,
        volume: current.volume,
        fileName: current.fileName,
        mimeType: current.mimeType,
        path: current.path,
        source: current.source,
        attribution: current.attribution,
      };
      return {
        ...current,
        variations: [...(current.variations ?? []), nextVariation],
      };
    });
  };

  const removeDraftSoundVariation = (
    soundKey: Nh3dSoundEffectKey,
    variationId: string,
  ): void => {
    if (variationId === nh3dBaseSoundVariationId) {
      return;
    }
    const slotKey = createNh3dSoundUploadSlotKey(soundKey, variationId);
    if (playingSoundSlotKey === slotKey) {
      stopPreview();
    }
    setPendingUploads((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, slotKey)) {
        return previous;
      }
      const next = { ...previous };
      delete next[slotKey];
      return next;
    });
    updateDraftSound(soundKey, (current) => ({
      ...current,
      variations: (current.variations ?? []).filter(
        (variation) => variation.id !== variationId,
      ),
    }));
  };

  const discardPendingChangesIfNeeded =
    useCallback(async (): Promise<boolean> => {
      if (!isDraftDirty) {
        return true;
      }
      return requestInGameConfirmation({
        title: soundPackStrings.discardChangesTitle,
        message: soundPackStrings.discardChangesMessage,
        confirmLabel: soundPackStrings.discard,
        cancelLabel: soundPackStrings.keepEditing,
        confirmClassName: "nh3d-menu-action-cancel",
      });
    }, [isDraftDirty, requestInGameConfirmation]);

  const handleSelectPack = async (nextPackId: string): Promise<void> => {
    if (!nextPackId || nextPackId === activePackId) {
      return;
    }
    if (!(await discardPendingChangesIfNeeded())) {
      return;
    }
    setErrorText("");
    setStatusText("");
    try {
      await setActiveNh3dSoundPackId(nextPackId);
      const selectedPack = packs.find((pack) => pack.id === nextPackId) ?? null;
      if (selectedPack) {
        applyLoadedState(packs, selectedPack.id);
      } else {
        await reloadSoundPacks(nextPackId);
      }
    } catch (error) {
      setErrorText(
        getErrorMessage(error, soundPackStrings.failedToSelectRequested),
      );
      await reloadSoundPacks();
    }
  };

  const handleCreatePack = async (): Promise<void> => {
    const normalizedName = normalizeNh3dSoundPackName(newPackName);
    if (!normalizedName) {
      setErrorText(soundPackStrings.provideName);
      return;
    }
    if (!(await discardPendingChangesIfNeeded())) {
      return;
    }
    setIsBusy(true);
    setErrorText("");
    setStatusText("");
    try {
      const createdPack = await createNh3dSoundPack(normalizedName);
      await reloadSoundPacks(createdPack.id);
      setStatusText(soundPackStrings.created(createdPack.name));
    } catch (error) {
      setErrorText(getErrorMessage(error, soundPackStrings.failedToCreate));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveDraft = useCallback(async (): Promise<boolean> => {
    if (!draftPack || !isDraftDirty) {
      return true;
    }
    setIsBusy(true);
    setErrorText("");
    setStatusText("");
    try {
      const savedPack = await saveNh3dSoundPackToIndexedDb(
        draftPack,
        pendingUploads,
      );
      await reloadSoundPacks(savedPack.id);
      setStatusText(soundPackStrings.saved(savedPack.name));
      return true;
    } catch (error) {
      setErrorText(getErrorMessage(error, soundPackStrings.failedToSave));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [draftPack, isDraftDirty, pendingUploads, reloadSoundPacks]);

  useEffect(() => {
    if (!onDialogActionsChange) {
      return;
    }
    onDialogActionsChange({
      saveIfNeeded: handleSaveDraft,
      confirmDiscardIfNeeded: discardPendingChangesIfNeeded,
      reloadFromStorage: async () => {
        await reloadSoundPacks();
      },
    });
    return () => {
      onDialogActionsChange(null);
    };
  }, [discardPendingChangesIfNeeded, handleSaveDraft, onDialogActionsChange]);

  const handleExportDraft = async (): Promise<void> => {
    if (!draftPack) {
      return;
    }
    setIsBusy(true);
    setErrorText("");
    setStatusText("");
    try {
      const archiveBlob = await exportNh3dSoundPackToZip(
        draftPack,
        pendingUploads,
      );
      const archiveName = `${sanitizeArchiveFileName(draftPack.name)}.soundpack.zip`;
      const objectUrl = URL.createObjectURL(archiveBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = archiveName;
      anchor.rel = "noopener";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setStatusText(soundPackStrings.exported(draftPack.name));
    } catch (error) {
      setErrorText(getErrorMessage(error, soundPackStrings.failedToExportZip));
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportArchiveChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!(await discardPendingChangesIfNeeded())) {
      return;
    }
    setIsBusy(true);
    setErrorText("");
    setStatusText("");
    try {
      const importedPack = await importNh3dSoundPackFromZip(file);
      await reloadSoundPacks(importedPack.id);
      setStatusText(soundPackStrings.imported(importedPack.name));
    } catch (error) {
      setErrorText(getErrorMessage(error, soundPackStrings.failedToImportZip));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteDraftPack = async (): Promise<void> => {
    if (!draftPack || isDefaultDraft) {
      return;
    }
    const confirmed = await requestInGameConfirmation({
      title: soundPackStrings.deleteTitle,
      message: soundPackStrings.deleteMessage(draftPack.name),
      confirmLabel: commonStrings.delete,
      cancelLabel: commonStrings.cancel,
      confirmClassName: "nh3d-menu-action-cancel",
    });
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    setErrorText("");
    setStatusText("");
    try {
      const nextActivePackId = await deleteNh3dSoundPackFromIndexedDb(
        draftPack.id,
      );
      await reloadSoundPacks(nextActivePackId);
      setStatusText(soundPackStrings.deleted(draftPack.name));
    } catch (error) {
      setErrorText(getErrorMessage(error, soundPackStrings.failedToDelete));
    } finally {
      setIsBusy(false);
    }
  };

  const handlePlayPreview = async (
    soundKey: Nh3dSoundEffectKey,
    variationId: string = nh3dBaseSoundVariationId,
  ): Promise<void> => {
    if (!draftPack) {
      return;
    }
    setErrorText("");
    stopPreview();
    const sound = draftPack.sounds[soundKey];
    const variation =
      getSoundVariationViews(soundKey, sound).find(
        (entry) => entry.id === variationId,
      )?.value ?? null;
    if (!variation) {
      return;
    }
    const uploadSlotKey = createNh3dSoundUploadSlotKey(soundKey, variationId);
    const pendingUpload =
      pendingUploads[uploadSlotKey] ??
      (variationId === nh3dBaseSoundVariationId
        ? pendingUploads[soundKey]
        : undefined);
    const fallbackSound = defaultPack?.sounds[soundKey];
    let previewUrl = "";
    let revokeAfterPlay = false;

    try {
      if (pendingUpload instanceof Blob) {
        previewUrl = URL.createObjectURL(pendingUpload);
        revokeAfterPlay = true;
      } else if (pendingUpload === null) {
        previewUrl =
          fallbackSound?.path || resolveNh3dBundledBuiltinSoundPath(soundKey) || "";
      } else if (variation.source === "user") {
        const storedBlob = await loadStoredNh3dSoundBlob(variation.path);
        if (storedBlob) {
          previewUrl = URL.createObjectURL(storedBlob);
          revokeAfterPlay = true;
        } else {
          previewUrl = variation.path;
        }
      } else {
        previewUrl = variation.path;
      }

      if (!previewUrl) {
        throw new Error(soundPackStrings.noPreviewSource);
      }

      const audio = previewAudioRef.current ?? new Audio();
      previewAudioRef.current = audio;
      const previewVolume = Math.max(
        0,
        Math.min(1, Number(variation.volume ?? 1)),
      );
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Number.isFinite(previewVolume) ? previewVolume : 1;
      audio.src = previewUrl;
      audio.onended = () => {
        setPlayingSoundSlotKey(null);
        if (revokeAfterPlay && previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
          previewObjectUrlRef.current = null;
        }
      };
      audio.onerror = () => {
        setPlayingSoundSlotKey(null);
        if (revokeAfterPlay && previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
          previewObjectUrlRef.current = null;
        }
        setErrorText(soundPackStrings.unableToPreview);
      };

      if (revokeAfterPlay) {
        previewObjectUrlRef.current = previewUrl;
      }

      await audio.play();
      setPlayingSoundSlotKey(uploadSlotKey);
    } catch (error) {
      if (revokeAfterPlay) {
        URL.revokeObjectURL(previewUrl);
      }
      previewObjectUrlRef.current = null;
      setErrorText(getErrorMessage(error, soundPackStrings.unableToPreview));
    }
  };

  const handleAttributionPaste =
    (soundKey: Nh3dSoundEffectKey, variationId: string) =>
    (event: ClipboardEvent<HTMLInputElement>): void => {
      event.preventDefault();
      const input = event.currentTarget;
      const clipboard = event.clipboardData;
      const htmlText = clipboard.getData("text/html");
      const plainText = clipboard.getData("text/plain");
      const pastedText = plainText
        ? stripHtmlToPlainText(plainText)
        : stripHtmlToPlainText(htmlText);
      const selectionStart = input.selectionStart ?? input.value.length;
      const selectionEnd = input.selectionEnd ?? input.value.length;
      const nextValue = `${input.value.slice(0, selectionStart)}${pastedText}${input.value.slice(selectionEnd)}`;

      updateDraftSoundVariation(soundKey, variationId, (current) => ({
        ...current,
        attribution: nextValue,
      }));
    };

  if (!visible) {
    return null;
  }

  return (
    <div className="nh3d-soundpack-manager">
      <div className="nh3d-option-row">
        <div className="nh3d-option-copy">
          <div className="nh3d-option-label">{soundPackStrings.activePack}</div>
          <div className="nh3d-option-description">
            {soundPackStrings.activePackDescription}
          </div>
        </div>
        <div className="nh3d-option-select-controls nh3d-soundpack-select-controls">
          <select
            className="nh3d-startup-config-select"
            disabled={isLoading || isBusy || packs.length === 0}
            onChange={(event) => {
              void handleSelectPack(event.target.value);
            }}
            value={activePackId}
          >
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
          <button
            className="nh3d-menu-action-button"
            disabled={isBusy || isLoading}
            onClick={() => {
              setIsCreateMode((previous) => !previous);
              setErrorText("");
              setStatusText("");
            }}
            type="button"
          >
            {soundPackStrings.createNew}
          </button>
        </div>
      </div>

      {isCreateMode ? (
        <div className="nh3d-soundpack-create-panel">
          <label
            className="nh3d-option-label"
            htmlFor="nh3d-soundpack-new-name"
          >
            {soundPackStrings.createNameLabel}
          </label>
          <input
            className="nh3d-text-input"
            id="nh3d-soundpack-new-name"
            onChange={(event) => setNewPackName(event.target.value)}
            placeholder={soundPackStrings.createPlaceholder}
            type="text"
            value={newPackName}
          />
          <div className="nh3d-soundpack-create-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-confirm"
              disabled={isBusy}
              onClick={() => {
                void handleCreatePack();
              }}
              type="button"
            >
              {soundPackStrings.createAndSave}
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              disabled={isBusy}
              onClick={() => {
                setIsCreateMode(false);
                setNewPackName("");
              }}
              type="button"
            >
              {commonStrings.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {draftPack && !isDefaultDraft ? (
        <div className="nh3d-option-row nh3d-soundpack-name-row">
          <div className="nh3d-option-copy">
            <div className="nh3d-option-label">{soundPackStrings.packName}</div>
            <div className="nh3d-option-description">
              {soundPackStrings.packNameDescription}
            </div>
          </div>
          <div className="nh3d-soundpack-name-controls">
            <input
              className="nh3d-text-input"
              onChange={(event) => {
                const nextName = event.target.value;
                setDraftPack((previous) =>
                  previous
                    ? {
                        ...previous,
                        name: nextName,
                      }
                    : previous,
                );
                markDraftAsDirty();
              }}
              readOnly={isDefaultDraft}
              type="text"
              value={draftPack.name}
            />
            <button
              className="nh3d-menu-action-button nh3d-menu-action-confirm"
              disabled={isBusy || isLoading || !isDraftDirty}
              onClick={() => {
                void handleSaveDraft();
              }}
              type="button"
            >
              {soundPackStrings.savePack}
            </button>
          </div>
        </div>
      ) : null}

      <div className="nh3d-soundpack-top-actions">
        <button
          className="nh3d-menu-action-button"
          disabled={isBusy || isLoading || !draftPack}
          onClick={() => {
            void handleExportDraft();
          }}
          type="button"
        >
          {soundPackStrings.export}
        </button>
        <button
          className="nh3d-menu-action-button"
          disabled={isBusy || isLoading}
          onClick={() => importFileInputRef.current?.click()}
          type="button"
        >
          {soundPackStrings.import}
        </button>
        {draftPack && !isDefaultDraft ? (
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            disabled={isBusy || isLoading}
            onClick={() => {
              void handleDeleteDraftPack();
            }}
            type="button"
          >
            {soundPackStrings.deletePack}
          </button>
        ) : null}
        {playingSoundSlotKey ? (
          <button
            className="nh3d-menu-action-button"
            onClick={stopPreview}
            type="button"
          >
            {soundPackStrings.stopPreview}
          </button>
        ) : null}
        <input
          accept=".zip,application/zip,application/x-zip-compressed"
          className="nh3d-soundpack-hidden-input"
          onChange={(event) => {
            void handleImportArchiveChange(event);
          }}
          ref={importFileInputRef}
          type="file"
        />
      </div>

      {isLoading ? (
        <div className="nh3d-option-description">{soundPackStrings.loading}</div>
      ) : null}
      {statusText ? (
        <div className="nh3d-soundpack-status">{statusText}</div>
      ) : null}
      {errorText ? (
        <div className="nh3d-soundpack-error">{errorText}</div>
      ) : null}

      {draftPack ? (
        <div className="nh3d-soundpack-list">
          {nh3dSoundEffectDefinitions.map((definition) => {
            const soundKey = definition.key;
            const sound = draftPack.sounds[soundKey];
            const fallbackSound = defaultPack?.sounds[soundKey];
            const variationViews = getSoundVariationViews(soundKey, sound);
            return (
              <div
                className={`nh3d-soundpack-row${isDefaultDraft ? " is-default-pack" : ""}`}
                key={soundKey}
              >
                <div className="nh3d-soundpack-variation-list">
                  {variationViews.map((variationView, variationIndex) => {
                    const variationId = variationView.id;
                    const variation = variationView.value;
                    const uploadSlotKey = createNh3dSoundUploadSlotKey(
                      soundKey,
                      variationId,
                    );
                    const pendingUpload =
                      pendingUploads[uploadSlotKey] ??
                      (variationView.isBase
                        ? pendingUploads[soundKey]
                        : undefined);
                    const pendingFileName =
                      pendingUpload instanceof File && pendingUpload.name
                        ? pendingUpload.name
                        : variation.fileName;
                    const displayFileName =
                      pendingUpload instanceof Blob
                        ? `${pendingFileName}${soundPackStrings.pendingSaveSuffix}`
                        : pendingUpload === null
                          ? `${fallbackSound?.fileName || resolveNh3dBundledBuiltinSoundPath(soundKey) || soundPackStrings.noBundledSound}${soundPackStrings.defaultSuffix}`
                          : variation.source === "user"
                            ? `${variation.fileName}${soundPackStrings.customSuffix}`
                            : variation.fileName;
                    const volumePercent = Math.round(variation.volume * 100);
                    const updateVolumeFromPercentValue = (
                      nextPercentRaw: string,
                    ): void => {
                      const nextVolume = Math.max(
                        0,
                        Math.min(1, Number(nextPercentRaw) / 100),
                      );
                      updateDraftSoundVariation(
                        soundKey,
                        variationId,
                        (current) => ({
                          ...current,
                          volume: nextVolume,
                        }),
                      );
                    };
                    const canResetCustom =
                      !isDefaultDraft &&
                      (pendingUpload instanceof Blob ||
                        variation.source === "user");
                    const isPlaying = playingSoundSlotKey === uploadSlotKey;
                    const soundDisplayLabel =
                      variationViews.length > 1 && variationIndex > 0
                        ? `${definition.label} ${variationIndex + 1}`
                        : definition.label;
                    return (
                      <div
                        className="nh3d-soundpack-variation-row"
                        key={uploadSlotKey}
                      >
                        <div className="nh3d-soundpack-control-row nh3d-soundpack-control-row-primary">
                          <button
                            aria-checked={variation.enabled}
                            aria-label={soundPackStrings.enableSoundAria(
                              soundDisplayLabel,
                            )}
                            className={`nh3d-option-switch nh3d-soundpack-toggle${
                              variation.enabled ? " is-on" : ""
                            }`}
                            disabled={isBusy}
                            onClick={() =>
                              updateDraftSoundVariation(
                                soundKey,
                                variationId,
                                (current) => ({
                                  ...current,
                                  enabled: !current.enabled,
                                }),
                              )
                            }
                            role="switch"
                            type="button"
                          >
                            <span className="nh3d-option-switch-thumb" />
                          </button>
                          <div className="nh3d-soundpack-sound-type">
                            <div className="nh3d-option-label">
                              {soundDisplayLabel}
                            </div>
                          </div>
                          <div className="nh3d-soundpack-info-box nh3d-soundpack-volume-box">
                            <div className="nh3d-option-description">
                              {soundPackStrings.volume}
                            </div>
                            <div className="nh3d-soundpack-volume-control">
                              <input
                                aria-label={soundPackStrings.volumeAria(
                                  soundDisplayLabel,
                                )}
                                className="nh3d-option-slider"
                                disabled={isBusy}
                                max={100}
                                min={0}
                                onInput={(event) =>
                                  updateVolumeFromPercentValue(
                                    event.currentTarget.value,
                                  )
                                }
                                onChange={(event) =>
                                  updateVolumeFromPercentValue(
                                    event.currentTarget.value,
                                  )
                                }
                                step={1}
                                type="range"
                                value={volumePercent}
                              />
                              <span className="nh3d-soundpack-volume-value">
                                {volumePercent}%
                              </span>
                            </div>
                          </div>
                          <button
                            className={`nh3d-menu-action-button nh3d-soundpack-play-button${
                              isPlaying ? " nh3d-menu-action-confirm" : ""
                            }`}
                            disabled={isBusy}
                            onClick={() => {
                              void handlePlayPreview(soundKey, variationId);
                            }}
                            type="button"
                          >
                            {isPlaying
                              ? soundPackStrings.playing
                              : soundPackStrings.play}
                          </button>
                        </div>

                        {!isDefaultDraft ? (
                          <div className="nh3d-soundpack-control-row nh3d-soundpack-control-row-secondary">
                            <div
                              className={`nh3d-soundpack-file-action-group${
                                variationView.isBase ? " is-single-action" : ""
                              }`}
                            >
                              {!variationView.isBase ? (
                                <button
                                  className="nh3d-menu-action-button nh3d-menu-action-cancel nh3d-soundpack-remove-variation-button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    removeDraftSoundVariation(
                                      soundKey,
                                      variationId,
                                    );
                                  }}
                                  type="button"
                                >
                                  {soundPackStrings.remove}
                                </button>
                              ) : null}
                              <button
                                className="nh3d-menu-action-button nh3d-soundpack-choose-file-button"
                                disabled={isBusy}
                                onClick={() => {
                                  soundFileInputRefs.current[
                                    uploadSlotKey
                                  ]?.click();
                                }}
                                type="button"
                              >
                                {soundPackStrings.replace}
                              </button>
                            </div>
                            <input
                              accept=".wav,.ogg,.mp3,.m4a,.aac,.flac,.opus,audio/*"
                              className="nh3d-soundpack-file-input-hidden"
                              disabled={isBusy}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                event.target.value = "";
                                if (!file || !draftPack || isDefaultDraft) {
                                  return;
                                }
                                setPendingUploads((previous) => ({
                                  ...previous,
                                  [uploadSlotKey]: file,
                                }));
                                updateDraftSoundVariation(
                                  soundKey,
                                  variationId,
                                  (current) => ({
                                    ...current,
                                    fileName: file.name || current.fileName,
                                    mimeType: file.type || current.mimeType,
                                    path: resolveNh3dUserSoundPath(
                                      draftPack.name,
                                      soundKey,
                                      file.name || current.fileName,
                                      variationId,
                                    ),
                                    source: "user",
                                  }),
                                );
                              }}
                              ref={(node) => {
                                soundFileInputRefs.current[uploadSlotKey] =
                                  node;
                              }}
                              type="file"
                            />
                            <div className="nh3d-soundpack-info-box nh3d-soundpack-path">
                              <div className="nh3d-option-description">
                                {soundPackStrings.soundFile}
                              </div>
                              <div className="nh3d-soundpack-path-value">
                                {displayFileName}
                              </div>
                            </div>
                            <button
                              className="nh3d-menu-action-button nh3d-soundpack-reset-button"
                              disabled={!canResetCustom || isBusy}
                              onClick={() => {
                                if (!draftPack || isDefaultDraft) {
                                  return;
                                }
                                setPendingUploads((previous) => ({
                                  ...previous,
                                  [uploadSlotKey]: null,
                                }));
                                updateDraftSoundVariation(
                                  soundKey,
                                  variationId,
                                  (current) => ({
                                    ...current,
                                    enabled:
                                      fallbackSound?.enabled ??
                                      Boolean(
                                        resolveNh3dBundledBuiltinSoundPath(
                                          soundKey,
                                        ),
                                      ),
                                    fileName: fallbackSound?.fileName || "",
                                    mimeType:
                                      fallbackSound?.mimeType || "audio/ogg",
                                    path:
                                      fallbackSound?.path ||
                                      resolveNh3dBundledBuiltinSoundPath(
                                        soundKey,
                                      ) ||
                                      "",
                                    source: "builtin",
                                  }),
                                );
                              }}
                              type="button"
                            >
                              {soundPackStrings.reset}
                            </button>
                          </div>
                        ) : null}

                        <div className="nh3d-soundpack-control-row nh3d-soundpack-control-row-tertiary">
                          <div className="nh3d-soundpack-info-box nh3d-soundpack-attribution-box">
                            <div className="nh3d-option-description">
                              {soundPackStrings.attribution}
                            </div>
                            <input
                              aria-label={soundPackStrings.attributionAria(
                                soundDisplayLabel,
                              )}
                              className="nh3d-text-input nh3d-soundpack-attribution-input"
                              disabled={isBusy}
                              onChange={(event) => {
                                const nextAttribution = event.target.value;
                                updateDraftSoundVariation(
                                  soundKey,
                                  variationId,
                                  (current) => ({
                                    ...current,
                                    attribution: nextAttribution,
                                  }),
                                );
                              }}
                              onPaste={handleAttributionPaste(
                                soundKey,
                                variationId,
                              )}
                              placeholder={soundPackStrings.attributionPlaceholder}
                              readOnly={isDefaultDraft}
                              type="text"
                              value={variation.attribution}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!isDefaultDraft ? (
                  <button
                    className="nh3d-menu-action-button"
                    disabled={isBusy}
                    onClick={() => {
                      addDraftSoundVariation(soundKey);
                    }}
                    type="button"
                  >
                    {soundPackStrings.addVariation}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <ConfirmationModal
        dialog={localConfirmationDialog}
        dialogId="nh3d-soundpack-confirmation-dialog"
        onCancel={() => resolveLocalConfirmation("cancel")}
        onConfirm={() => resolveLocalConfirmation("confirm")}
      />
    </div>
  );
}
