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
  createNh3dAmbientUploadSlotKey,
  createNh3dSoundPack,
  deleteNh3dSoundPackFromIndexedDb,
  exportNh3dSoundPackToZip,
  getNh3dAmbientTrackVariations,
  importNh3dSoundPackFromZip,
  loadNh3dSoundPackStateFromIndexedDb,
  loadStoredNh3dSoundBlob,
  nh3dAmbientTrackDefinitions,
  nh3dBaseSoundVariationId,
  nh3dSoundEffectDefinitions,
  resolveNh3dBundledBuiltinSoundPath,
  normalizeNh3dSoundPackName,
  resolveNh3dRandomPitchRate,
  resolveNh3dUserAmbientPath,
  resolveNh3dUserSoundPath,
  saveNh3dSoundPackToIndexedDb,
  setActiveNh3dSoundPackId,
  type Nh3dAmbientCondition,
  type Nh3dAmbientTrackAssignment,
  type Nh3dAmbientTrackKey,
  type Nh3dAmbientTrackVariation,
  type Nh3dSoundEffectKey,
  type Nh3dSoundEffectVariation,
  type Nh3dSoundPackRecord,
  type Nh3dSoundPackReverbSettings,
  type Nh3dSoundFileUploadOverrides,
} from "../audio/sound-pack-storage";
import {
  useConfirmationDialog,
  type ConfirmationDialogRequest,
} from "./modals/useConfirmationDialog";
import ConfirmationModal from "./modals/ConfirmationModal";
import { getTranslationStrings } from "../i18n/core";
import SoundAccordionRow from "./soundpack/SoundAccordionRow";
import SoundVariationRow from "./soundpack/SoundVariationRow";
import AmbientConditionEditor from "./soundpack/AmbientConditionEditor";
import ReverbSettingsPanel from "./soundpack/ReverbSettingsPanel";
import ReverbSlider from "./soundpack/ReverbSlider";

const translationStrings = getTranslationStrings();
const commonStrings = translationStrings.common;
const soundPackStrings = translationStrings.app.soundPack;

const soundFileAccept = ".wav,.ogg,.mp3,.m4a,.aac,.flac,.opus,audio/*";

type SoundPackAudioTab = "effects" | "ambient";

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

// Synthetic exponential-decay impulse response so previews can demonstrate the
// in-progress reverb send without needing FMOD.
function createPreviewReverbImpulse(context: AudioContext): AudioBuffer {
  const seconds = 1.6;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4);
    }
  }
  return impulse;
}

type SoundVariationView = {
  id: string;
  isBase: boolean;
  value: Nh3dSoundEffectVariation;
};

type AmbientVariationView = {
  id: string;
  isBase: boolean;
  value: Nh3dAmbientTrackVariation;
};

function createVariationId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
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
    reverbOffset: sound.reverbOffset,
    pitchVariation: sound.pitchVariation,
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

function getAmbientVariationViews(
  assignment: Nh3dAmbientTrackAssignment,
): AmbientVariationView[] {
  return getNh3dAmbientTrackVariations(assignment).map((variation) => ({
    id: variation.id,
    isBase: variation.id === nh3dBaseSoundVariationId,
    value: variation,
  }));
}

// Mirrors the in-game weighted variation picker: each candidate has weight 1,
// except the most recently previewed one which is down-weighted so repeats are
// less likely. Used by the collapsed-row preview button.
function pickWeightedVariationView<T extends { id: string }>(
  views: T[],
  lastId: string | undefined,
  repeatWeight: number,
): T | null {
  if (views.length === 0) {
    return null;
  }
  if (views.length === 1) {
    return views[0] ?? null;
  }
  const weights = views.map((view) => (view.id === lastId ? repeatWeight : 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(totalWeight > 0)) {
    return views[0] ?? null;
  }
  let remaining = Math.random() * totalWeight;
  for (let index = 0; index < views.length; index += 1) {
    remaining -= weights[index] ?? 0;
    if (remaining <= 0) {
      return views[index] ?? null;
    }
  }
  return views[views.length - 1] ?? null;
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
  const [activeAudioTab, setActiveAudioTab] =
    useState<SoundPackAudioTab>("effects");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [reverbPanelExpanded, setReverbPanelExpanded] = useState(false);
  const [playingSoundSlotKey, setPlayingSoundSlotKey] = useState<string | null>(
    null,
  );
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastPreviewVariationIdRef = useRef<Record<string, string>>({});
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewWetGainRef = useRef<GainNode | null>(null);
  const previewGraphFailedRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const {
    dialog: localConfirmationDialog,
    requestConfirmation: requestLocalConfirmation,
    resolveConfirmation: resolveLocalConfirmation,
  } = useConfirmationDialog();

  const defaultPack = useMemo(
    () => packs.find((pack) => pack.isDefault) ?? null,
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
      const context = previewAudioContextRef.current;
      previewAudioContextRef.current = null;
      previewWetGainRef.current = null;
      if (context) {
        void context.close().catch(() => undefined);
      }
    };
  }, [stopPreview]);

  const toggleExpanded = useCallback((rowKey: string): void => {
    setExpandedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);

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

  // --- Sound effect draft mutations -----------------------------------------
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
      return {
        ...previous,
        sounds: {
          ...previous.sounds,
          [soundKey]: updater(previous.sounds[soundKey]),
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
        reverbOffset: current.reverbOffset,
        pitchVariation: current.pitchVariation,
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

  // --- Reverb draft mutations -----------------------------------------------
  const updateDraftReverb = (
    updater: (current: Nh3dSoundPackReverbSettings) => Nh3dSoundPackReverbSettings,
  ): void => {
    setDraftPack((previous) => {
      if (!previous) {
        return previous;
      }
      return { ...previous, reverb: updater(previous.reverb) };
    });
    markDraftAsDirty();
  };

  // --- Ambient draft mutations ----------------------------------------------
  const updateDraftAmbient = (
    trackKey: Nh3dAmbientTrackKey,
    updater: (current: Nh3dAmbientTrackAssignment) => Nh3dAmbientTrackAssignment,
  ): void => {
    setDraftPack((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ambient: {
          ...previous.ambient,
          [trackKey]: updater(previous.ambient[trackKey]),
        },
      };
    });
    markDraftAsDirty();
  };

  const updateDraftAmbientVariation = (
    trackKey: Nh3dAmbientTrackKey,
    variationId: string,
    updater: (current: Nh3dAmbientTrackVariation) => Nh3dAmbientTrackVariation,
  ): void => {
    updateDraftAmbient(trackKey, (current) => {
      const views = getAmbientVariationViews(current);
      const nextViews = views.map((view) =>
        view.id === variationId
          ? {
              ...view,
              value: {
                ...updater(view.value),
                id: view.id,
                key: trackKey,
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
        conditions: baseView.value.conditions,
        variations: nextViews
          .filter((view) => view.id !== nh3dBaseSoundVariationId)
          .map((view) => ({
            ...view.value,
            id: view.id,
            key: trackKey,
          })),
      };
    });
  };

  const addDraftAmbientVariation = (trackKey: Nh3dAmbientTrackKey): void => {
    updateDraftAmbient(trackKey, (current) => {
      const nextVariation: Nh3dAmbientTrackVariation = {
        id: createVariationId(trackKey),
        key: trackKey,
        enabled: current.enabled,
        volume: current.volume,
        fileName: current.fileName,
        mimeType: current.mimeType,
        path: current.path,
        source: current.source,
        attribution: current.attribution,
        conditions: { ...current.conditions },
        reverbOffset: current.reverbOffset,
      };
      return {
        ...current,
        variations: [...(current.variations ?? []), nextVariation],
      };
    });
  };

  const removeDraftAmbientVariation = (
    trackKey: Nh3dAmbientTrackKey,
    variationId: string,
  ): void => {
    if (variationId === nh3dBaseSoundVariationId) {
      return;
    }
    const slotKey = createNh3dAmbientUploadSlotKey(trackKey, variationId);
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
    updateDraftAmbient(trackKey, (current) => ({
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

  // Lazily build a WebAudio graph around the preview element so previews can
  // demonstrate the in-progress reverb send (dry + convolver wet). Pitch is
  // applied via playbackRate and works even without the graph.
  const ensurePreviewReverbGraph = (
    audio: HTMLAudioElement,
  ): GainNode | null => {
    if (previewWetGainRef.current) {
      return previewWetGainRef.current;
    }
    if (previewGraphFailedRef.current || typeof window === "undefined") {
      return null;
    }
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      previewGraphFailedRef.current = true;
      return null;
    }
    try {
      const context = previewAudioContextRef.current ?? new AudioContextCtor();
      previewAudioContextRef.current = context;
      const source = context.createMediaElementSource(audio);
      const dryGain = context.createGain();
      dryGain.gain.value = 1;
      const wetGain = context.createGain();
      wetGain.gain.value = 0;
      const convolver = context.createConvolver();
      convolver.buffer = createPreviewReverbImpulse(context);
      source.connect(dryGain);
      dryGain.connect(context.destination);
      source.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(context.destination);
      previewWetGainRef.current = wetGain;
      return wetGain;
    } catch {
      previewGraphFailedRef.current = true;
      return null;
    }
  };

  const playResolvedPreview = async (
    previewUrl: string,
    volume: number,
    revokeAfterPlay: boolean,
    indicatorSlotKey: string,
    reverbSend: number,
    pitchRate: number,
  ): Promise<void> => {
    const audio = previewAudioRef.current ?? new Audio();
    previewAudioRef.current = audio;
    const previewVolume = Math.max(0, Math.min(1, Number(volume ?? 1)));
    audio.pause();
    audio.currentTime = 0;
    audio.volume = Number.isFinite(previewVolume) ? previewVolume : 1;
    const rate = Number.isFinite(pitchRate) && pitchRate > 0 ? pitchRate : 1;
    try {
      audio.playbackRate = rate;
      (
        audio as HTMLAudioElement & { preservesPitch?: boolean }
      ).preservesPitch = false;
    } catch {
      // Some browsers reject playbackRate/preservesPitch changes; ignore.
    }
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

    const wetGain = ensurePreviewReverbGraph(audio);
    const context = previewAudioContextRef.current;
    if (wetGain && context) {
      if (context.state === "suspended") {
        try {
          await context.resume();
        } catch {
          // Ignore resume rejections outside trusted gestures.
        }
      }
      wetGain.gain.value = Math.max(0, Math.min(1, reverbSend));
    }

    await audio.play();
    setPlayingSoundSlotKey(indicatorSlotKey);
  };

  const handlePlayPreview = async (
    soundKey: Nh3dSoundEffectKey,
    variationId: string = nh3dBaseSoundVariationId,
    indicatorSlotKey?: string,
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
    const previewReverbSend = Math.max(
      0,
      Math.min(1, draftPack.reverb.intensity + variation.reverbOffset),
    );
    const previewPitchRate = resolveNh3dRandomPitchRate(
      variation.pitchVariation,
    );
    let previewUrl = "";
    let revokeAfterPlay = false;

    try {
      if (pendingUpload instanceof Blob) {
        previewUrl = URL.createObjectURL(pendingUpload);
        revokeAfterPlay = true;
      } else if (pendingUpload === null) {
        previewUrl =
          fallbackSound?.path ||
          resolveNh3dBundledBuiltinSoundPath(soundKey) ||
          "";
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
      await playResolvedPreview(
        previewUrl,
        variation.volume,
        revokeAfterPlay,
        indicatorSlotKey ?? uploadSlotKey,
        previewReverbSend,
        previewPitchRate,
      );
    } catch (error) {
      if (revokeAfterPlay && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      previewObjectUrlRef.current = null;
      setErrorText(getErrorMessage(error, soundPackStrings.unableToPreview));
    }
  };

  const handlePlayAmbientPreview = async (
    trackKey: Nh3dAmbientTrackKey,
    variationId: string = nh3dBaseSoundVariationId,
    indicatorSlotKey?: string,
  ): Promise<void> => {
    if (!draftPack) {
      return;
    }
    setErrorText("");
    stopPreview();
    const track = draftPack.ambient[trackKey];
    const variation =
      getAmbientVariationViews(track).find((entry) => entry.id === variationId)
        ?.value ?? null;
    if (!variation) {
      return;
    }
    const uploadSlotKey = createNh3dAmbientUploadSlotKey(trackKey, variationId);
    const pendingUpload = pendingUploads[uploadSlotKey];
    const previewReverbSend = Math.max(
      0,
      Math.min(1, draftPack.reverb.intensity + variation.reverbOffset),
    );
    const previewPitchRate = 1;
    let previewUrl = "";
    let revokeAfterPlay = false;

    try {
      if (pendingUpload instanceof Blob) {
        previewUrl = URL.createObjectURL(pendingUpload);
        revokeAfterPlay = true;
      } else if (pendingUpload === null) {
        previewUrl = "";
      } else if (variation.path) {
        const storedBlob = await loadStoredNh3dSoundBlob(variation.path);
        if (storedBlob) {
          previewUrl = URL.createObjectURL(storedBlob);
          revokeAfterPlay = true;
        } else {
          previewUrl = variation.path;
        }
      }

      if (!previewUrl) {
        throw new Error(soundPackStrings.noPreviewSource);
      }
      await playResolvedPreview(
        previewUrl,
        variation.volume,
        revokeAfterPlay,
        indicatorSlotKey ?? uploadSlotKey,
        previewReverbSend,
        previewPitchRate,
      );
    } catch (error) {
      if (revokeAfterPlay && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      previewObjectUrlRef.current = null;
      setErrorText(getErrorMessage(error, soundPackStrings.unableToPreview));
    }
  };

  const createAttributionPasteHandler =
    (applyAttribution: (value: string) => void) =>
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
      applyAttribution(nextValue);
    };

  // --- Renderers ------------------------------------------------------------
  const renderSoundEffectVariation = (
    definition: (typeof nh3dSoundEffectDefinitions)[number],
    view: SoundVariationView,
    variationIndex: number,
  ): JSX.Element => {
    const soundKey = definition.key;
    const variationId = view.id;
    const variation = view.value;
    const fallbackSound = defaultPack?.sounds[soundKey];
    const uploadSlotKey = createNh3dSoundUploadSlotKey(soundKey, variationId);
    const pendingUpload =
      pendingUploads[uploadSlotKey] ??
      (view.isBase ? pendingUploads[soundKey] : undefined);
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
    const canResetCustom =
      !isDefaultDraft &&
      (pendingUpload instanceof Blob || variation.source === "user");
    const label =
      variationIndex > 0
        ? `${definition.label} ${variationIndex + 1}`
        : definition.label;
    return (
      <SoundVariationRow
        key={uploadSlotKey}
        label={label}
        busy={isBusy}
        enabled={variation.enabled}
        onToggleEnabled={() =>
          updateDraftSoundVariation(soundKey, variationId, (current) => ({
            ...current,
            enabled: !current.enabled,
          }))
        }
        enableAriaLabel={soundPackStrings.enableSoundAria(label)}
        volume={variation.volume}
        onVolumeChange={(nextVolume) =>
          updateDraftSoundVariation(soundKey, variationId, (current) => ({
            ...current,
            volume: nextVolume,
          }))
        }
        volumeLabel={soundPackStrings.volume}
        volumeAriaLabel={soundPackStrings.volumeAria(label)}
        showPlay
        isPlaying={playingSoundSlotKey === uploadSlotKey}
        onPlay={() => {
          void handlePlayPreview(soundKey, variationId);
        }}
        onStop={stopPreview}
        playAriaLabel={soundPackStrings.play}
        stopAriaLabel={soundPackStrings.stopPreview}
        showFile={!isDefaultDraft}
        fileLabel={soundPackStrings.soundFile}
        displayFileName={displayFileName}
        fileAccept={soundFileAccept}
        replaceLabel={soundPackStrings.replace}
        onFileSelected={(file) => {
          if (!draftPack || isDefaultDraft) {
            return;
          }
          setPendingUploads((previous) => ({
            ...previous,
            [uploadSlotKey]: file,
          }));
          updateDraftSoundVariation(soundKey, variationId, (current) => ({
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
          }));
        }}
        showRemove={!view.isBase}
        removeLabel={soundPackStrings.remove}
        onRemove={() => removeDraftSoundVariation(soundKey, variationId)}
        showReset={!isDefaultDraft}
        resetLabel={soundPackStrings.reset}
        canReset={canResetCustom}
        onReset={() => {
          if (!draftPack || isDefaultDraft) {
            return;
          }
          setPendingUploads((previous) => ({
            ...previous,
            [uploadSlotKey]: null,
          }));
          updateDraftSoundVariation(soundKey, variationId, (current) => ({
            ...current,
            enabled:
              fallbackSound?.enabled ??
              Boolean(resolveNh3dBundledBuiltinSoundPath(soundKey)),
            fileName: fallbackSound?.fileName || "",
            mimeType: fallbackSound?.mimeType || "audio/ogg",
            path:
              fallbackSound?.path ||
              resolveNh3dBundledBuiltinSoundPath(soundKey) ||
              "",
            source: "builtin",
          }));
        }}
        attributionLabel={soundPackStrings.attribution}
        attributionAriaLabel={soundPackStrings.attributionAria(label)}
        attributionPlaceholder={soundPackStrings.attributionPlaceholder}
        attribution={variation.attribution}
        attributionReadOnly={isDefaultDraft}
        onAttributionChange={(value) =>
          updateDraftSoundVariation(soundKey, variationId, (current) => ({
            ...current,
            attribution: value,
          }))
        }
        onAttributionPaste={createAttributionPasteHandler((value) =>
          updateDraftSoundVariation(soundKey, variationId, (current) => ({
            ...current,
            attribution: value,
          })),
        )}
        extraContent={
          <div className="nh3d-soundpack-clip-fx">
            <ReverbSlider
              ariaLabel={`${soundPackStrings.reverbOffset} ${label}`}
              disabled={isBusy}
              label={soundPackStrings.reverbOffset}
              onChange={(value) =>
                updateDraftSoundVariation(soundKey, variationId, (current) => ({
                  ...current,
                  reverbOffset: value,
                }))
              }
              signed
              value={variation.reverbOffset}
            />
            <ReverbSlider
              ariaLabel={`${soundPackStrings.pitchVariation} ${label}`}
              disabled={isBusy}
              label={soundPackStrings.pitchVariation}
              onChange={(value) =>
                updateDraftSoundVariation(soundKey, variationId, (current) => ({
                  ...current,
                  pitchVariation: value,
                }))
              }
              value={variation.pitchVariation}
            />
          </div>
        }
      />
    );
  };

  const renderAmbientVariation = (
    definition: (typeof nh3dAmbientTrackDefinitions)[number],
    view: AmbientVariationView,
    variationIndex: number,
  ): JSX.Element => {
    const trackKey = definition.key;
    const variationId = view.id;
    const variation = view.value;
    const uploadSlotKey = createNh3dAmbientUploadSlotKey(trackKey, variationId);
    const pendingUpload = pendingUploads[uploadSlotKey];
    const pendingFileName =
      pendingUpload instanceof File && pendingUpload.name
        ? pendingUpload.name
        : variation.fileName;
    const displayFileName =
      pendingUpload instanceof Blob
        ? `${pendingFileName}${soundPackStrings.pendingSaveSuffix}`
        : pendingUpload === null || !variation.fileName
          ? soundPackStrings.ambientUnassigned
          : variation.fileName;
    const canClear =
      pendingUpload instanceof Blob || Boolean(variation.path);
    const label =
      variationIndex > 0
        ? `${definition.label} ${variationIndex + 1}`
        : definition.label;
    return (
      <SoundVariationRow
        key={uploadSlotKey}
        label={label}
        busy={isBusy}
        enabled={variation.enabled}
        onToggleEnabled={() =>
          updateDraftAmbientVariation(trackKey, variationId, (current) => ({
            ...current,
            enabled: !current.enabled,
          }))
        }
        enableAriaLabel={soundPackStrings.enableSoundAria(label)}
        volume={variation.volume}
        onVolumeChange={(nextVolume) =>
          updateDraftAmbientVariation(trackKey, variationId, (current) => ({
            ...current,
            volume: nextVolume,
          }))
        }
        volumeLabel={soundPackStrings.volume}
        volumeAriaLabel={soundPackStrings.volumeAria(label)}
        showPlay
        isPlaying={playingSoundSlotKey === uploadSlotKey}
        onPlay={() => {
          void handlePlayAmbientPreview(trackKey, variationId);
        }}
        onStop={stopPreview}
        playAriaLabel={soundPackStrings.play}
        stopAriaLabel={soundPackStrings.stopPreview}
        playDisabled={!canClear}
        showFile
        fileLabel={soundPackStrings.soundFile}
        displayFileName={displayFileName}
        fileAccept={soundFileAccept}
        replaceLabel={soundPackStrings.replace}
        onFileSelected={(file) => {
          if (!draftPack) {
            return;
          }
          setPendingUploads((previous) => ({
            ...previous,
            [uploadSlotKey]: file,
          }));
          updateDraftAmbientVariation(trackKey, variationId, (current) => ({
            ...current,
            enabled: true,
            fileName: file.name || current.fileName,
            mimeType: file.type || current.mimeType,
            path: resolveNh3dUserAmbientPath(
              draftPack.name,
              trackKey,
              file.name || current.fileName,
              variationId,
            ),
            source: "user",
          }));
        }}
        showRemove={!view.isBase}
        removeLabel={soundPackStrings.remove}
        onRemove={() => removeDraftAmbientVariation(trackKey, variationId)}
        showReset
        resetLabel={soundPackStrings.reset}
        canReset={canClear}
        onReset={() => {
          if (!draftPack) {
            return;
          }
          if (playingSoundSlotKey === uploadSlotKey) {
            stopPreview();
          }
          setPendingUploads((previous) => ({
            ...previous,
            [uploadSlotKey]: null,
          }));
          updateDraftAmbientVariation(trackKey, variationId, (current) => ({
            ...current,
            enabled: false,
            fileName: "",
            mimeType: "",
            path: "",
            source: "user",
          }));
        }}
        attributionLabel={soundPackStrings.attribution}
        attributionAriaLabel={soundPackStrings.attributionAria(label)}
        attributionPlaceholder={soundPackStrings.attributionPlaceholder}
        attribution={variation.attribution}
        attributionReadOnly={false}
        onAttributionChange={(value) =>
          updateDraftAmbientVariation(trackKey, variationId, (current) => ({
            ...current,
            attribution: value,
          }))
        }
        onAttributionPaste={createAttributionPasteHandler((value) =>
          updateDraftAmbientVariation(trackKey, variationId, (current) => ({
            ...current,
            attribution: value,
          })),
        )}
        extraContent={
          <div className="nh3d-soundpack-clip-fx">
            <ReverbSlider
              ariaLabel={`${soundPackStrings.reverbOffset} ${label}`}
              disabled={isBusy}
              label={soundPackStrings.reverbOffset}
              onChange={(value) =>
                updateDraftAmbientVariation(
                  trackKey,
                  variationId,
                  (current) => ({
                    ...current,
                    reverbOffset: value,
                  }),
                )
              }
              signed
              value={variation.reverbOffset}
            />
            <AmbientConditionEditor
              value={variation.conditions}
              disabled={isBusy}
              onChange={(nextConditions: Nh3dAmbientCondition) =>
                updateDraftAmbientVariation(
                  trackKey,
                  variationId,
                  (current) => ({
                    ...current,
                    conditions: nextConditions,
                  }),
                )
              }
              strings={{
                heading: soundPackStrings.conditionsHeading,
                hint: soundPackStrings.conditionsHint,
                depthRange: soundPackStrings.depthRange,
                minDepth: soundPackStrings.minDepth,
                maxDepth: soundPackStrings.maxDepth,
                playerLevelRange: soundPackStrings.playerLevelRange,
                minLevel: soundPackStrings.minLevel,
                maxLevel: soundPackStrings.maxLevel,
                amuletCondition: soundPackStrings.amuletCondition,
                amuletAny: soundPackStrings.amuletAny,
                amuletCarried: soundPackStrings.amuletCarried,
                amuletNotCarried: soundPackStrings.amuletNotCarried,
                anyValue: soundPackStrings.anyValue,
              }}
            />
          </div>
        }
      />
    );
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

      {draftPack ? (
        <ReverbSettingsPanel
          reverb={draftPack.reverb}
          disabled={isBusy}
          expanded={reverbPanelExpanded}
          onToggleExpanded={() =>
            setReverbPanelExpanded((previous) => !previous)
          }
          onIntensityChange={(value) =>
            updateDraftReverb((current) => ({ ...current, intensity: value }))
          }
          onLevelTypeOffsetChange={(key, value) =>
            updateDraftReverb((current) => ({
              ...current,
              levelTypeOffsets: {
                ...current.levelTypeOffsets,
                [key]: value,
              },
            }))
          }
          levelTypes={nh3dAmbientTrackDefinitions.map((definition) => ({
            key: definition.key,
            label: definition.label,
          }))}
          strings={{
            heading: soundPackStrings.reverbHeading,
            description: soundPackStrings.reverbDescription,
            intensity: soundPackStrings.reverbIntensity,
            intensityAria: soundPackStrings.reverbIntensity,
            levelTypes: soundPackStrings.reverbLevelTypes,
            offsetAria: (label: string) =>
              `${soundPackStrings.reverbOffset} ${label}`,
            expandAria: soundPackStrings.expandAria(
              soundPackStrings.reverbHeading,
            ),
            collapseAria: soundPackStrings.collapseAria(
              soundPackStrings.reverbHeading,
            ),
          }}
        />
      ) : null}

      <div className="nh3d-soundpack-tabs" role="tablist">
        <button
          aria-selected={activeAudioTab === "effects"}
          className={`nh3d-soundpack-tab${
            activeAudioTab === "effects" ? " is-active" : ""
          }`}
          onClick={() => setActiveAudioTab("effects")}
          role="tab"
          type="button"
        >
          {soundPackStrings.tabSoundEffects}
        </button>
        <button
          aria-selected={activeAudioTab === "ambient"}
          className={`nh3d-soundpack-tab${
            activeAudioTab === "ambient" ? " is-active" : ""
          }`}
          onClick={() => setActiveAudioTab("ambient")}
          role="tab"
          type="button"
        >
          {soundPackStrings.tabAmbient}
        </button>
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

      {draftPack && activeAudioTab === "effects" ? (
        <div className="nh3d-soundpack-list">
          {nh3dSoundEffectDefinitions.map((definition) => {
            const soundKey = definition.key;
            const sound = draftPack.sounds[soundKey];
            const variationViews = getSoundVariationViews(soundKey, sound);
            const rowKey = `sfx:${soundKey}`;
            const expanded = expandedKeys.has(rowKey);
            const previewKey = `preview:${rowKey}`;
            return (
              <SoundAccordionRow
                key={soundKey}
                title={definition.label}
                expanded={expanded}
                onToggleExpanded={() => toggleExpanded(rowKey)}
                expandAriaLabel={soundPackStrings.expandAria(definition.label)}
                collapseAriaLabel={soundPackStrings.collapseAria(
                  definition.label,
                )}
                isPlaying={playingSoundSlotKey === previewKey}
                onPlay={() => {
                  const enabledViews = variationViews.filter(
                    (view) => view.value.enabled,
                  );
                  const pool =
                    enabledViews.length > 0 ? enabledViews : variationViews;
                  const picked = pickWeightedVariationView(
                    pool,
                    lastPreviewVariationIdRef.current[rowKey],
                    0.35,
                  );
                  if (!picked) {
                    return;
                  }
                  lastPreviewVariationIdRef.current[rowKey] = picked.id;
                  void handlePlayPreview(soundKey, picked.id, previewKey);
                }}
                onStop={stopPreview}
                playAriaLabel={soundPackStrings.play}
                stopAriaLabel={soundPackStrings.stopPreview}
                playDisabled={isBusy}
                isDefaultPack={isDefaultDraft}
              >
                <div className="nh3d-soundpack-variation-list">
                  {variationViews.map((view, index) =>
                    renderSoundEffectVariation(definition, view, index),
                  )}
                </div>
                {!isDefaultDraft ? (
                  <button
                    className="nh3d-menu-action-button"
                    disabled={isBusy}
                    onClick={() => addDraftSoundVariation(soundKey)}
                    type="button"
                  >
                    {soundPackStrings.addVariation}
                  </button>
                ) : null}
              </SoundAccordionRow>
            );
          })}
        </div>
      ) : null}

      {draftPack && activeAudioTab === "ambient" ? (
        <div className="nh3d-soundpack-list">
          <div className="nh3d-option-description nh3d-soundpack-ambient-description">
            {soundPackStrings.ambientDescription}
          </div>
          {nh3dAmbientTrackDefinitions.map((definition) => {
            const trackKey = definition.key;
            const track = draftPack.ambient[trackKey];
            const variationViews = getAmbientVariationViews(track);
            const rowKey = `ambient:${trackKey}`;
            const expanded = expandedKeys.has(rowKey);
            const previewKey = `preview:${rowKey}`;
            const playableViews = variationViews.filter(
              (view) =>
                pendingUploads[
                  createNh3dAmbientUploadSlotKey(trackKey, view.id)
                ] instanceof Blob || Boolean(view.value.path),
            );
            return (
              <SoundAccordionRow
                key={trackKey}
                title={definition.label}
                expanded={expanded}
                onToggleExpanded={() => toggleExpanded(rowKey)}
                expandAriaLabel={soundPackStrings.expandAria(definition.label)}
                collapseAriaLabel={soundPackStrings.collapseAria(
                  definition.label,
                )}
                isPlaying={playingSoundSlotKey === previewKey}
                onPlay={() => {
                  const enabledViews = playableViews.filter(
                    (view) => view.value.enabled,
                  );
                  const pool =
                    enabledViews.length > 0 ? enabledViews : playableViews;
                  const picked = pickWeightedVariationView(
                    pool,
                    lastPreviewVariationIdRef.current[rowKey],
                    0.4,
                  );
                  if (!picked) {
                    return;
                  }
                  lastPreviewVariationIdRef.current[rowKey] = picked.id;
                  void handlePlayAmbientPreview(trackKey, picked.id, previewKey);
                }}
                onStop={stopPreview}
                playAriaLabel={soundPackStrings.play}
                stopAriaLabel={soundPackStrings.stopPreview}
                playDisabled={isBusy || playableViews.length === 0}
              >
                <div className="nh3d-soundpack-variation-list">
                  {variationViews.map((view, index) =>
                    renderAmbientVariation(definition, view, index),
                  )}
                </div>
                <button
                  className="nh3d-menu-action-button"
                  disabled={isBusy}
                  onClick={() => addDraftAmbientVariation(trackKey)}
                  type="button"
                >
                  {soundPackStrings.addVariation}
                </button>
              </SoundAccordionRow>
            );
          })}
        </div>
      ) : null}

      <ConfirmationModal
        dialog={localConfirmationDialog}
        dialogId="nh3d-soundpack-confirmation-dialog"
        onCancel={() => resolveLocalConfirmation(false)}
        onConfirm={() => resolveLocalConfirmation(true)}
      />
    </div>
  );
}
