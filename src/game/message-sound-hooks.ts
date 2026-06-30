import {
  nh3dBaseSoundVariationId,
  isNh3dCombatOverrideSoundEffectKey,
  loadNh3dSoundPackStateFromIndexedDb,
  loadStoredNh3dSoundBlob,
  resolveNh3dMessageLogSoundEffectKeys,
  resolveNh3dBundledBuiltinSoundPath,
  resolveNh3dRandomPitchRate,
  type Nh3dSoundEffectKey,
  type Nh3dSoundEffectVariation,
  type Nh3dSoundPackRecord,
} from "../audio/sound-pack-storage";
import { createNh3dPitchShiftNode } from "../audio/pitch-shift";

type MessageSoundHooksOptions = {
  isSoundEnabled: () => boolean;
  debounceMs?: number;
  soundPackCacheTtlMs?: number;
};

type WebAudioPlaybackResult =
  | "played"
  | "unsupported"
  | "not-ready"
  | "failed";

export class MessageSoundHooks {
  private readonly isSoundEnabled: () => boolean;
  private readonly debounceMs: number;
  private readonly soundPackCacheTtlMs: number;
  private readonly audioContextRecoveryIntervalMs: number = 1250;
  private readonly repeatedVariationWeight: number = 0.35;
  private readonly footstepFullVolumeRecoveryMs: number = 350;
  private readonly footstepRecencyVolumeCurvePower: number = 1.35;
  private soundPackCacheLoadedAtMs: number = 0;
  private cachedSoundPack: Nh3dSoundPackRecord | null = null;
  private cachedSoundPackRevision: string = "";
  private soundPackLookupInFlight: Promise<Nh3dSoundPackRecord | null> | null =
    null;
  private soundPackLoadErrorLogged: boolean = false;
  private lastPlayedAtByKey: Map<Nh3dSoundEffectKey, number> = new Map();
  private lastPlayedVariationIdByKey: Map<Nh3dSoundEffectKey, string> =
    new Map();
  private userSoundBlobUrlByPath: Map<string, string> = new Map();
  private audioContext: AudioContext | null = null;
  private audioContextCreationAttempted: boolean = false;
  private audioContextCreationFailedLogged: boolean = false;
  private audioContextRecoveryTimerId: number | null = null;
  private decodedAudioBufferPromiseByUrl: Map<string, Promise<AudioBuffer | null>> =
    new Map();
  private audioDecodeErrorLoggedByUrl: Set<string> = new Set();
  private userGestureAudioResumed: boolean = false;
  /**
   * A code-driven generic "hit" trigger (a monster hitting the player) holds
   * off playing anything for up to this long, waiting to see whether the
   * message explaining the attack (e.g. "The wolf bites you!") arrives and
   * resolves it with a more specific sound. NetHack message text for an
   * attack that just happened arrives quickly and reliably, so this window
   * only needs to be a small safety margin, not a real "maybe it won't show
   * up" allowance.
   */
  private readonly genericHitLogWaitMs: number = 250;
  private pendingGenericHitWaits: Array<{ timeoutId: number }> = [];

  constructor(options: MessageSoundHooksOptions) {
    this.isSoundEnabled = options.isSoundEnabled;
    this.debounceMs = Math.max(1, Math.round(options.debounceMs ?? 120));
    this.soundPackCacheTtlMs = Math.max(
      250,
      Math.round(options.soundPackCacheTtlMs ?? 3000),
    );
  }

  public playDamageEffectSound(
    variant: "hit" | "defeat",
    overrideSoundKey: Nh3dSoundEffectKey | null = null,
  ): void {
    if (variant === "defeat") {
      void this.playSoundEffect("monster-killed");
      return;
    }
    if (overrideSoundKey) {
      // Already resolved synchronously by the caller from the same message
      // text driving this trigger (the player-hits-monster path).
      void this.playSoundEffect(overrideSoundKey);
      return;
    }
    // A monster hitting the player: hold off playing anything until either
    // resolveAwaitedGenericHitFromMessage() identifies the right sound from
    // the attack message (typically within a turn tick), or this timeout
    // elapses without one showing up.
    const timeoutId = globalThis.setTimeout(() => {
      this.pendingGenericHitWaits = this.pendingGenericHitWaits.filter(
        (wait) => wait.timeoutId !== timeoutId,
      );
      void this.playSoundEffect("hit");
    }, this.genericHitLogWaitMs);
    this.pendingGenericHitWaits.push({ timeoutId });
  }

  /**
   * Looks at the same message text the keyword-matching sound system uses
   * and, if it matches a "pain-*"/"hit-by-*" combat sound that the active
   * pack actually has audio configured for, returns that key so the caller
   * can play it in place of (rather than alongside) the generic "hit" cue.
   * Returns null — meaning "fall back to the generic hit sound" — when no
   * such sound matches, or when one matches but has no audio assigned.
   *
   * Uses only the currently cached sound pack (no fresh async load) since
   * this needs to return synchronously from inside the combat hit path; the
   * pack is normally already warm from other sound playback.
   */
  public resolveCombatOverrideSoundKeyForMessage(
    messageLike: unknown,
  ): Nh3dSoundEffectKey | null {
    const soundPack = this.cachedSoundPack;
    if (!soundPack) {
      return null;
    }
    const candidateKeys = resolveNh3dMessageLogSoundEffectKeys(
      messageLike,
    ).filter(isNh3dCombatOverrideSoundEffectKey);
    for (const candidateKey of candidateKeys) {
      const hasConfiguredAudio = this.collectSoundVariations(
        candidateKey,
        soundPack,
      ).some((variation) => variation.enabled);
      if (hasConfiguredAudio) {
        return candidateKey;
      }
    }
    return null;
  }

  /**
   * Called once per incoming game message, for messages not already handled
   * by the synchronous player-hits-monster path (resolveCombatOverrideSound
   * KeyForMessage) — chiefly "a monster hits you" messages, where the
   * code-driven generic "hit" trigger comes from a separate runtime event
   * with no message text of its own and is currently waiting (see
   * playDamageEffectSound()) to find out what should actually play.
   *
   * If a wait is pending and this message is a combat-hit message, resolves
   * the oldest pending wait immediately: plays the matching "hit-by-*" sound
   * if one is configured and enabled, or the generic "hit" sound right away
   * otherwise — no reason to sit out the rest of the window once we already
   * know there's nothing more specific to play. Returns the key it played
   * (only when it's a non-generic override) so the caller can suppress that
   * same key from also being played by the normal keyword-matching pass.
   *
   * Returns null if nothing is currently waiting or this message doesn't
   * match any combat sound at all, leaving the keyword-matching pass to
   * handle the message exactly as it would otherwise.
   */
  public resolveAwaitedGenericHitFromMessage(
    messageLike: unknown,
  ): Nh3dSoundEffectKey | null {
    const combatCandidates = resolveNh3dMessageLogSoundEffectKeys(
      messageLike,
    ).filter(isNh3dCombatOverrideSoundEffectKey);
    if (combatCandidates.length === 0) {
      return null;
    }

    const pendingWait = this.pendingGenericHitWaits.shift();
    if (!pendingWait) {
      return null;
    }
    globalThis.clearTimeout(pendingWait.timeoutId);

    const soundPack = this.cachedSoundPack;
    let resolvedKey: Nh3dSoundEffectKey | null = null;
    if (soundPack) {
      for (const candidateKey of combatCandidates) {
        const hasConfiguredAudio = this.collectSoundVariations(
          candidateKey,
          soundPack,
        ).some((variation) => variation.enabled);
        if (hasConfiguredAudio) {
          resolvedKey = candidateKey;
          break;
        }
      }
    }
    void this.playSoundEffect(resolvedKey ?? "hit");
    return resolvedKey;
  }

  public playOtherMonsterKilledSound(): void {
    void this.playSoundEffect("monster-killed-other");
  }

  public playPlayerFootstepSound(): void {
    void this.playSoundEffect("player-walk");
  }

  public playDrinkSound(): void {
    void this.playSoundEffect("drink");
  }

  public playThrownWeaponSound(): void {
    void this.playSoundEffect("thrown-weapon");
  }

  public playPickupGoldSound(): void {
    void this.playSoundEffect("pickup-gold");
  }

  public playMissedAttackSound(): void {
    void this.playSoundEffect("missed-attack");
  }

  public playMessageLogSoundEffects(
    messageLike: unknown,
    options: { suppressKeys?: readonly Nh3dSoundEffectKey[] } = {},
  ): void {
    const suppressedKeys = new Set(options.suppressKeys ?? []);
    const soundKeys = resolveNh3dMessageLogSoundEffectKeys(messageLike).filter(
      (soundKey) => !suppressedKeys.has(soundKey),
    );
    for (const soundKey of soundKeys) {
      void this.playSoundEffect(soundKey);
    }
  }

  public reset(): void {
    this.lastPlayedAtByKey.clear();
    this.lastPlayedVariationIdByKey.clear();
    for (const wait of this.pendingGenericHitWaits) {
      globalThis.clearTimeout(wait.timeoutId);
    }
    this.pendingGenericHitWaits = [];
  }

  public setEnabled(enabled: boolean): void {
    if (enabled) {
      if (this.userGestureAudioResumed) {
        this.startAudioContextRecoveryLoop();
        void this.resumeAudioContextIfNeeded();
      }
      return;
    }
    this.stopAudioContextRecoveryLoop();
    this.userGestureAudioResumed = false;
    void this.suspendAudioContext();
  }

  public resumeFromUserGesture(): void {
    if (!this.isSoundEnabled()) {
      return;
    }
    this.userGestureAudioResumed = true;
    this.startAudioContextRecoveryLoop();
    void this.resumeAudioContextIfNeeded();
  }

  public dispose(): void {
    this.reset();
    this.stopAudioContextRecoveryLoop();
    this.userGestureAudioResumed = false;
    this.clearUserSoundBlobUrlCache();
    this.clearDecodedAudioBufferCache();
    const context = this.audioContext;
    this.audioContext = null;
    if (context) {
      void context.close().catch(() => undefined);
    }
  }

  private clearUserSoundBlobUrlCache(): void {
    for (const blobUrl of this.userSoundBlobUrlByPath.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.userSoundBlobUrlByPath.clear();
  }

  private clearDecodedAudioBufferCache(): void {
    this.decodedAudioBufferPromiseByUrl.clear();
    this.audioDecodeErrorLoggedByUrl.clear();
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
          this.clearDecodedAudioBufferCache();
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
            "Unable to load sound-pack state for gameplay message hooks.",
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

  private async resolveSoundEffectSourceUrl(
    soundKey: Nh3dSoundEffectKey,
    entry: {
      path: string;
      source: "builtin" | "user";
    } | null,
  ): Promise<string | null> {
    const defaultPath = resolveNh3dBundledBuiltinSoundPath(soundKey);
    if (!entry) {
      return defaultPath;
    }

    const assignmentPath = String(entry.path || "").trim();
    if (entry.source !== "user") {
      return assignmentPath || defaultPath;
    }
    if (!assignmentPath) {
      return defaultPath;
    }

    const cachedBlobUrl = this.userSoundBlobUrlByPath.get(assignmentPath);
    if (cachedBlobUrl) {
      return cachedBlobUrl;
    }

    try {
      const blob = await loadStoredNh3dSoundBlob(assignmentPath);
      if (!blob) {
        return defaultPath;
      }
      const blobUrl = URL.createObjectURL(blob);
      this.userSoundBlobUrlByPath.set(assignmentPath, blobUrl);
      return blobUrl;
    } catch {
      return defaultPath;
    }
  }

  private collectSoundVariations(
    soundKey: Nh3dSoundEffectKey,
    soundPack: Nh3dSoundPackRecord | null,
  ): Nh3dSoundEffectVariation[] {
    const assignment = soundPack?.sounds[soundKey];
    if (!assignment) {
      return [
        {
          id: nh3dBaseSoundVariationId,
          key: soundKey,
          enabled: Boolean(resolveNh3dBundledBuiltinSoundPath(soundKey)),
          volume: 1,
          fileName: "",
          mimeType: "audio/ogg",
          path: resolveNh3dBundledBuiltinSoundPath(soundKey) ?? "",
          source: "builtin",
          attribution: "",
          reverbOffset: 0,
          pitchVariation: 0,
        },
      ];
    }
    const baseVariation: Nh3dSoundEffectVariation = {
      id: nh3dBaseSoundVariationId,
      key: soundKey,
      enabled: assignment.enabled,
      volume: assignment.volume,
      fileName: assignment.fileName,
      mimeType: assignment.mimeType,
      path: assignment.path,
      source: assignment.source,
      attribution: assignment.attribution,
      reverbOffset: assignment.reverbOffset,
      pitchVariation: assignment.pitchVariation,
    };
    return [baseVariation, ...(assignment.variations ?? [])];
  }

  private selectWeightedVariation(
    soundKey: Nh3dSoundEffectKey,
    variations: Nh3dSoundEffectVariation[],
  ): Nh3dSoundEffectVariation | null {
    if (!variations.length) {
      return null;
    }
    if (variations.length === 1) {
      return variations[0] ?? null;
    }

    const lastPlayedVariationId =
      this.lastPlayedVariationIdByKey.get(soundKey) ?? null;
    const weights = variations.map((variation) =>
      variation.id === lastPlayedVariationId ? this.repeatedVariationWeight : 1,
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

  private resolveRecencyVolumeScale(
    soundKey: Nh3dSoundEffectKey,
    elapsedSinceLastMs: number,
  ): number {
    if (soundKey !== "player-walk") {
      return 1;
    }
    const normalizedElapsed = Number.isFinite(elapsedSinceLastMs)
      ? Math.max(0, elapsedSinceLastMs)
      : this.footstepFullVolumeRecoveryMs;
    const linearScale = Math.min(
      1,
      normalizedElapsed / this.footstepFullVolumeRecoveryMs,
    );
    return Math.pow(linearScale, this.footstepRecencyVolumeCurvePower);
  }

  private async playSoundEffect(soundKey: Nh3dSoundEffectKey): Promise<void> {
    if (!this.isSoundEnabled()) {
      return;
    }

    const now = Date.now();
    const lastPlayedAt = this.lastPlayedAtByKey.get(soundKey) ?? 0;
    if (now - lastPlayedAt < this.debounceMs) {
      return;
    }
    this.lastPlayedAtByKey.set(soundKey, now);

    const soundPack = await this.resolveActiveSoundPack();
    const variations = this.collectSoundVariations(soundKey, soundPack).filter(
      (entry) => entry.enabled,
    );
    if (variations.length === 0) {
      return;
    }

    const selectedVariation = this.selectWeightedVariation(
      soundKey,
      variations,
    );
    if (!selectedVariation) {
      return;
    }
    this.lastPlayedVariationIdByKey.set(soundKey, selectedVariation.id);

    const volume = Math.max(
      0,
      Math.min(1, Number(selectedVariation.volume ?? 1)),
    );
    const recencyVolumeScale = this.resolveRecencyVolumeScale(
      soundKey,
      now - lastPlayedAt,
    );
    const effectiveVolume = volume * recencyVolumeScale;
    if (effectiveVolume <= 0) {
      return;
    }

    const sourceUrl = await this.resolveSoundEffectSourceUrl(soundKey, {
      path: selectedVariation.path,
      source: selectedVariation.source,
    });
    if (!sourceUrl) {
      return;
    }

    const pitchRate = resolveNh3dRandomPitchRate(
      selectedVariation.pitchVariation,
    );

    const globalReverb = soundPack?.reverb?.intensity ?? 0;
    const totalReverb = Math.max(
      0,
      Math.min(1, globalReverb + (selectedVariation.reverbOffset || 0)),
    );

    const webAudioResult = await this.tryPlaySoundEffectViaWebAudio(
      sourceUrl,
      effectiveVolume,
      pitchRate,
      totalReverb,
    );
    if (webAudioResult === "played") {
      return;
    }
    this.tryPlaySoundEffectViaHtmlAudio(sourceUrl, effectiveVolume);
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext;
    }
    if (
      this.audioContextCreationAttempted &&
      this.audioContextCreationFailedLogged
    ) {
      return null;
    }
    this.audioContextCreationAttempted = true;
    if (typeof globalThis === "undefined") {
      return null;
    }
    const globalWithWebkit = globalThis as typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor =
      globalWithWebkit.AudioContext ?? globalWithWebkit.webkitAudioContext;
    if (!AudioContextCtor) {
      this.audioContextCreationFailedLogged = true;
      return null;
    }
    try {
      const context = new AudioContextCtor();
      this.audioContext = context;
      return context;
    } catch (error) {
      if (!this.audioContextCreationFailedLogged) {
        this.audioContextCreationFailedLogged = true;
        console.warn("Unable to create WebAudio context for gameplay sounds.", error);
      }
      return null;
    }
  }

  private async resumeAudioContextIfNeeded(): Promise<void> {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    if (context.state === "running") {
      return;
    }
    try {
      await context.resume();
    } catch {
      // iOS/Safari can reject resume calls outside trusted gestures.
    }
  }

  private async suspendAudioContext(): Promise<void> {
    const context = this.audioContext;
    if (!context || context.state !== "running") {
      return;
    }
    try {
      await context.suspend();
    } catch {
      // Ignore suspend errors to keep gameplay paths resilient.
    }
  }

  private startAudioContextRecoveryLoop(): void {
    if (this.audioContextRecoveryTimerId !== null || typeof window === "undefined") {
      return;
    }
    this.audioContextRecoveryTimerId = window.setInterval(() => {
      if (!this.isSoundEnabled() || !this.userGestureAudioResumed) {
        return;
      }
      void this.resumeAudioContextIfNeeded();
    }, this.audioContextRecoveryIntervalMs);
  }

  private stopAudioContextRecoveryLoop(): void {
    if (this.audioContextRecoveryTimerId === null || typeof window === "undefined") {
      return;
    }
    window.clearInterval(this.audioContextRecoveryTimerId);
    this.audioContextRecoveryTimerId = null;
  }

  private async decodeAudioBufferForUrl(
    sourceUrl: string,
    context: AudioContext,
  ): Promise<AudioBuffer | null> {
    const existing = this.decodedAudioBufferPromiseByUrl.get(sourceUrl);
    if (existing) {
      return existing;
    }
    const decodePromise = (async () => {
      try {
        const response = await fetch(sourceUrl, { credentials: "same-origin" });
        if (!response.ok) {
          return null;
        }
        const bytes = await response.arrayBuffer();
        return await context.decodeAudioData(bytes.slice(0));
      } catch (error) {
        if (!this.audioDecodeErrorLoggedByUrl.has(sourceUrl)) {
          this.audioDecodeErrorLoggedByUrl.add(sourceUrl);
          console.warn(`Unable to decode gameplay sound '${sourceUrl}'.`, error);
        }
        return null;
      }
    })();
    this.decodedAudioBufferPromiseByUrl.set(sourceUrl, decodePromise);
    return decodePromise;
  }

  private cachedReverbImpulse: AudioBuffer | null = null;
  private getReverbImpulse(context: AudioContext): AudioBuffer {
    if (this.cachedReverbImpulse) return this.cachedReverbImpulse;
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
    this.cachedReverbImpulse = impulse;
    return impulse;
  }

  private async tryPlaySoundEffectViaWebAudio(
    sourceUrl: string,
    volume: number,
    pitchRate: number,
    reverbOffset: number,
  ): Promise<WebAudioPlaybackResult> {
    const context = this.ensureAudioContext();
    if (!context) {
      return "unsupported";
    }
    if (context.state !== "running") {
      await this.resumeAudioContextIfNeeded();
      const currentState = this.audioContext?.state ?? context.state;
      if (currentState !== "running") {
        return "not-ready";
      }
    }

    const buffer = await this.decodeAudioBufferForUrl(sourceUrl, context);
    if (!buffer) {
      return "failed";
    }

    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      const mainGain = context.createGain();
      const pitchInput = context.createGain();
      mainGain.gain.value = volume;
      mainGain.connect(context.destination);

      if (reverbOffset > 0) {
        const convolver = context.createConvolver();
        convolver.buffer = this.getReverbImpulse(context);

        const dryGain = context.createGain();
        dryGain.gain.value = 1;

        const wetGain = context.createGain();
        wetGain.gain.value = reverbOffset;

        pitchInput.connect(dryGain);
        dryGain.connect(mainGain);

        pitchInput.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(mainGain);
      } else {
        pitchInput.connect(mainGain);
      }

      const pitchNode = await createNh3dPitchShiftNode(context, pitchRate);
      if (pitchNode) {
        source.connect(pitchNode);
        pitchNode.connect(pitchInput);
      } else {
        source.connect(pitchInput);
      }
      source.start();
      source.stop(context.currentTime + buffer.duration);
      source.onended = () => {
        try {
          source.disconnect();
        } catch {
          // Ignore graph cleanup races.
        }
      };
      globalThis.setTimeout(() => {
        try {
          pitchInput.disconnect();
          mainGain.disconnect();
          pitchNode?.disconnect();
        } catch {
          // The graph may already have been torn down by source completion.
        }
      }, Math.max(1, Math.ceil(buffer.duration * 1000) + 100));
      return "played";
    } catch {
      return "failed";
    }
  }

  private tryPlaySoundEffectViaHtmlAudio(
    sourceUrl: string,
    volume: number,
  ): void {
    try {
      const audio = new Audio();
      audio.volume = volume;
      audio.preload = "auto";
      audio.src = sourceUrl;
      audio.playbackRate = 1;
      void audio.play().catch(() => undefined);
    } catch {
      // Browser autoplay policies can block playback until a user gesture.
    }
  }
}
