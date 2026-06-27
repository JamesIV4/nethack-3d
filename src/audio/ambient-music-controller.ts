import {
  doesNh3dAmbientConditionMatch,
  getNh3dAmbientTrackVariations,
  loadNh3dSoundPackStateFromIndexedDb,
  loadStoredNh3dSoundBlob,
  resolveNh3dAmbientTrackKeyForBranch,
  type Nh3dAmbientPlaybackContext,
  type Nh3dAmbientTrackKey,
  type Nh3dAmbientTrackVariation,
  type Nh3dSoundPackRecord,
} from "./sound-pack-storage";

export type AmbientMusicContext = {
  branchTag: string | null;
  depth: number | null;
  playerLevel: number | null;
  hasAmulet: boolean;
};

type AmbientMusicControllerOptions = {
  isSoundEnabled: () => boolean;
  soundPackCacheTtlMs?: number;
  crossfadeMs?: number;
};

type AmbientLayer = {
  audio: HTMLAudioElement;
  objectUrl: string | null;
  ownsObjectUrl: boolean;
  trackKey: Nh3dAmbientTrackKey | null;
  variationId: string | null;
  targetVolume: number;
  releaseWhenSilent: boolean;
};

/**
 * Plays a single looping ambient/music track in the background, selecting the
 * track + variation that matches the player's current dungeon branch, depth,
 * experience level and Amulet of Yendor possession. Switching tracks crossfades
 * between two HTMLAudioElement layers so the score can escalate smoothly as the
 * run gets harder.
 */
export class AmbientMusicController {
  private readonly isSoundEnabled: () => boolean;
  private readonly soundPackCacheTtlMs: number;
  private readonly crossfadeMs: number;
  private readonly fadeIntervalMs = 60;
  private readonly repeatedVariationWeight = 0.4;

  private enabled = false;
  private userGestureResumed = false;
  private disposed = false;

  private latestContext: AmbientMusicContext | null = null;
  private evaluateToken = 0;

  private cachedSoundPack: Nh3dSoundPackRecord | null = null;
  private soundPackCacheLoadedAtMs = 0;
  private cachedSoundPackRevision = "";
  private soundPackLookupInFlight: Promise<Nh3dSoundPackRecord | null> | null =
    null;
  private soundPackLoadErrorLogged = false;

  private userSoundBlobUrlByPath = new Map<string, string>();
  private lastVariationIdByTrack = new Map<Nh3dAmbientTrackKey, string>();

  private layers: AmbientLayer[] = [];
  private activeLayerIndex = -1;
  private fadeTimerId: number | null = null;

  constructor(options: AmbientMusicControllerOptions) {
    this.isSoundEnabled = options.isSoundEnabled;
    this.soundPackCacheTtlMs = Math.max(
      250,
      Math.round(options.soundPackCacheTtlMs ?? 3000),
    );
    this.crossfadeMs = Math.max(120, Math.round(options.crossfadeMs ?? 1400));
  }

  public updateContext(context: AmbientMusicContext): void {
    this.latestContext = context;
    void this.evaluate();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.fadeOutAll();
      return;
    }
    if (this.userGestureResumed) {
      void this.evaluate();
    }
  }

  public resumeFromUserGesture(): void {
    if (!this.isSoundEnabled()) {
      return;
    }
    this.userGestureResumed = true;
    this.enabled = true;
    void this.resumeActiveLayerPlayback();
    void this.evaluate();
  }

  /** Forget the active selection so the next context update re-evaluates. */
  public reset(): void {
    this.lastVariationIdByTrack.clear();
  }

  public dispose(): void {
    this.disposed = true;
    this.stopFadeLoop();
    for (const layer of this.layers) {
      try {
        layer.audio.pause();
        layer.audio.src = "";
      } catch {
        // Ignore teardown errors.
      }
      this.releaseLayerObjectUrl(layer);
    }
    this.layers = [];
    this.activeLayerIndex = -1;
    this.clearUserSoundBlobUrlCache();
  }

  private clearUserSoundBlobUrlCache(): void {
    for (const blobUrl of this.userSoundBlobUrlByPath.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.userSoundBlobUrlByPath.clear();
  }

  private async resolveActiveSoundPack(): Promise<Nh3dSoundPackRecord | null> {
    const now = Date.now();
    if (
      this.cachedSoundPack &&
      now - this.soundPackCacheLoadedAtMs <= this.soundPackCacheTtlMs
    ) {
      return this.cachedSoundPack;
    }
    if (this.soundPackLookupInFlight) {
      return this.soundPackLookupInFlight;
    }

    this.soundPackLookupInFlight = (async () => {
      try {
        const state = await loadNh3dSoundPackStateFromIndexedDb();
        const activePack =
          state.packs.find((pack) => pack.id === state.activePackId) ??
          state.packs.find((pack) => pack.isDefault) ??
          null;
        const nextRevision = activePack
          ? `${activePack.id}:${activePack.updatedAt}`
          : "";
        if (nextRevision !== this.cachedSoundPackRevision) {
          this.clearUserSoundBlobUrlCache();
          this.cachedSoundPackRevision = nextRevision;
        }
        this.cachedSoundPack = activePack;
        this.soundPackCacheLoadedAtMs = Date.now();
        this.soundPackLoadErrorLogged = false;
        return activePack;
      } catch (error) {
        if (!this.soundPackLoadErrorLogged) {
          this.soundPackLoadErrorLogged = true;
          console.warn(
            "Unable to load sound-pack state for ambient music.",
            error,
          );
        }
        this.cachedSoundPack = null;
        this.soundPackCacheLoadedAtMs = Date.now();
        return null;
      } finally {
        this.soundPackLookupInFlight = null;
      }
    })();

    return this.soundPackLookupInFlight;
  }

  private async evaluate(): Promise<void> {
    if (this.disposed) {
      return;
    }
    const token = ++this.evaluateToken;

    if (!this.enabled || !this.userGestureResumed || !this.isSoundEnabled()) {
      this.fadeOutAll();
      return;
    }

    const context = this.latestContext;
    if (!context) {
      return;
    }

    const soundPack = await this.resolveActiveSoundPack();
    if (token !== this.evaluateToken || this.disposed) {
      return;
    }
    if (!soundPack) {
      this.fadeOutAll();
      return;
    }

    const trackKey = resolveNh3dAmbientTrackKeyForBranch(context.branchTag);
    const assignment = soundPack.ambient?.[trackKey];
    if (!assignment) {
      this.fadeOutAll();
      return;
    }

    const playbackContext: Nh3dAmbientPlaybackContext = {
      depth: context.depth,
      playerLevel: context.playerLevel,
      hasAmulet: context.hasAmulet,
    };
    const candidates = getNh3dAmbientTrackVariations(assignment).filter(
      (variation) =>
        variation.enabled &&
        Boolean(String(variation.path || "").trim()) &&
        doesNh3dAmbientConditionMatch(variation.conditions, playbackContext),
    );

    if (candidates.length === 0) {
      this.fadeOutAll();
      return;
    }

    const activeLayer =
      this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
    if (
      activeLayer &&
      activeLayer.trackKey === trackKey &&
      activeLayer.variationId &&
      candidates.some((variation) => variation.id === activeLayer.variationId)
    ) {
      // Current selection still valid — keep playing, refresh target volume.
      const current = candidates.find(
        (variation) => variation.id === activeLayer.variationId,
      );
      if (current) {
        activeLayer.targetVolume = this.clampVolume(current.volume);
        this.startFadeLoop();
      }
      void this.resumeActiveLayerPlayback();
      return;
    }

    const selected = this.selectVariation(trackKey, candidates);
    if (!selected) {
      this.fadeOutAll();
      return;
    }

    await this.crossfadeToVariation(trackKey, selected, token);
  }

  private selectVariation(
    trackKey: Nh3dAmbientTrackKey,
    variations: Nh3dAmbientTrackVariation[],
  ): Nh3dAmbientTrackVariation | null {
    if (variations.length === 0) {
      return null;
    }
    if (variations.length === 1) {
      return variations[0] ?? null;
    }
    const lastId = this.lastVariationIdByTrack.get(trackKey) ?? null;
    const weights = variations.map((variation) =>
      variation.id === lastId ? this.repeatedVariationWeight : 1,
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (!(totalWeight > 0)) {
      return variations[0] ?? null;
    }
    let remaining = Math.random() * totalWeight;
    for (let i = 0; i < variations.length; i += 1) {
      remaining -= weights[i] ?? 0;
      if (remaining <= 0) {
        return variations[i] ?? null;
      }
    }
    return variations[variations.length - 1] ?? null;
  }

  private async resolveSourceUrl(
    variation: Nh3dAmbientTrackVariation,
  ): Promise<{ url: string; ownsObjectUrl: boolean } | null> {
    const path = String(variation.path || "").trim();
    if (!path) {
      return null;
    }
    const cached = this.userSoundBlobUrlByPath.get(path);
    if (cached) {
      return { url: cached, ownsObjectUrl: false };
    }
    try {
      const blob = await loadStoredNh3dSoundBlob(path);
      if (!blob) {
        return null;
      }
      const blobUrl = URL.createObjectURL(blob);
      this.userSoundBlobUrlByPath.set(path, blobUrl);
      return { url: blobUrl, ownsObjectUrl: false };
    } catch {
      return null;
    }
  }

  private ensureLayer(index: 0 | 1): AmbientLayer {
    let layer = this.layers[index];
    if (!layer) {
      const audio =
        typeof Audio !== "undefined" ? new Audio() : ({} as HTMLAudioElement);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      layer = {
        audio,
        objectUrl: null,
        ownsObjectUrl: false,
        trackKey: null,
        variationId: null,
        targetVolume: 0,
        releaseWhenSilent: false,
      };
      this.layers[index] = layer;
    }
    return layer;
  }

  private async crossfadeToVariation(
    trackKey: Nh3dAmbientTrackKey,
    variation: Nh3dAmbientTrackVariation,
    token: number,
  ): Promise<void> {
    const source = await this.resolveSourceUrl(variation);
    if (token !== this.evaluateToken || this.disposed || !source) {
      return;
    }

    const nextIndex: 0 | 1 = this.activeLayerIndex === 0 ? 1 : 0;
    const nextLayer = this.ensureLayer(nextIndex);
    const previousActive =
      this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;

    // Fade out and release the previously active layer.
    if (previousActive && previousActive !== nextLayer) {
      previousActive.targetVolume = 0;
      previousActive.releaseWhenSilent = true;
    }

    this.releaseLayerObjectUrl(nextLayer);
    nextLayer.objectUrl = source.ownsObjectUrl ? source.url : null;
    nextLayer.ownsObjectUrl = source.ownsObjectUrl;
    nextLayer.trackKey = trackKey;
    nextLayer.variationId = variation.id;
    nextLayer.targetVolume = this.clampVolume(variation.volume);
    nextLayer.releaseWhenSilent = false;

    try {
      nextLayer.audio.loop = true;
      nextLayer.audio.src = source.url;
      nextLayer.audio.volume = 0;
      nextLayer.audio.currentTime = 0;
    } catch {
      // Ignore source assignment errors; playback attempt below will no-op.
    }

    this.activeLayerIndex = nextIndex;
    this.lastVariationIdByTrack.set(trackKey, variation.id);

    try {
      await nextLayer.audio.play();
    } catch {
      // Autoplay can be blocked until a user gesture; retry on resume.
    }

    if (token !== this.evaluateToken || this.disposed) {
      return;
    }
    this.startFadeLoop();
  }

  private async resumeActiveLayerPlayback(): Promise<void> {
    const layer =
      this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
    if (!layer || !layer.audio.src) {
      return;
    }
    if (layer.audio.paused) {
      try {
        await layer.audio.play();
      } catch {
        // Ignore; will retry on next gesture/update.
      }
    }
  }

  private fadeOutAll(): void {
    for (const layer of this.layers) {
      if (!layer) {
        continue;
      }
      layer.targetVolume = 0;
      layer.releaseWhenSilent = true;
    }
    this.activeLayerIndex = -1;
    this.startFadeLoop();
  }

  private startFadeLoop(): void {
    if (this.fadeTimerId !== null || typeof window === "undefined") {
      // If we cannot run a timer, snap volumes immediately.
      if (typeof window === "undefined") {
        this.applyFadeStep();
      }
      return;
    }
    this.fadeTimerId = window.setInterval(() => {
      this.applyFadeStep();
    }, this.fadeIntervalMs);
  }

  private stopFadeLoop(): void {
    if (this.fadeTimerId === null || typeof window === "undefined") {
      return;
    }
    window.clearInterval(this.fadeTimerId);
    this.fadeTimerId = null;
  }

  private applyFadeStep(): void {
    const step = this.fadeIntervalMs / this.crossfadeMs;
    let stillFading = false;

    for (const layer of this.layers) {
      if (!layer) {
        continue;
      }
      const current = Number.isFinite(layer.audio.volume)
        ? layer.audio.volume
        : 0;
      const target = layer.targetVolume;
      if (Math.abs(current - target) <= step) {
        this.setLayerVolume(layer, target);
        if (target <= 0) {
          this.silenceLayer(layer);
        }
      } else {
        const next = current < target ? current + step : current - step;
        this.setLayerVolume(layer, next);
        stillFading = true;
      }
    }

    if (!stillFading) {
      this.stopFadeLoop();
    }
  }

  private silenceLayer(layer: AmbientLayer): void {
    if (layer.audio.src && !layer.audio.paused) {
      try {
        layer.audio.pause();
      } catch {
        // Ignore pause errors.
      }
    }
    if (layer.releaseWhenSilent) {
      try {
        layer.audio.src = "";
      } catch {
        // Ignore.
      }
      this.releaseLayerObjectUrl(layer);
      layer.trackKey = null;
      layer.variationId = null;
      layer.releaseWhenSilent = false;
    }
  }

  private setLayerVolume(layer: AmbientLayer, volume: number): void {
    const clamped = this.clampVolume(volume);
    try {
      layer.audio.volume = clamped;
    } catch {
      // Ignore volume assignment errors.
    }
  }

  private releaseLayerObjectUrl(layer: AmbientLayer): void {
    if (layer.objectUrl && layer.ownsObjectUrl) {
      URL.revokeObjectURL(layer.objectUrl);
    }
    layer.objectUrl = null;
    layer.ownsObjectUrl = false;
  }

  private clampVolume(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(1, parsed));
  }
}
