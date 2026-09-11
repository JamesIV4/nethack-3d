import { Capacitor } from "@capacitor/core";
import { Haptics } from "@capacitor/haptics";
import { WebHaptics } from "web-haptics";
import { FmodRuntime } from "../../../audio";
import type { FmodRuntimeOptions, FmodThreadingDiagnostics } from "../../../audio";
import { logWithOriginal } from "../../../logging";
import { MessageSoundHooks } from "../../message-sound-hooks";
import type { Nh3dAndroidBridge } from "../shared/types";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";

export interface AudioHapticsPlatformDependencies {
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
    | "isSelfDirectionAnswerInput"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
    | "isPlayerCliparoundInputCooldownActive"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "currentInventory"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "activeQuestionMenuItems"
    | "activeQuestionText"
    | "findMenuCategoryLabelForItem"
    | "isFountainDrinkQuestion"
    | "isInQuestion"
    | "isInventoryDrinkQuestion"
    | "isSpecialInventoryCategoryLabel"
  >;
}

/** FMOD lifecycle, audio environment selection, native/web haptics and movement sound cues. */
export class AudioHapticsPlatform {
  constructor(private readonly dependencies: AudioHapticsPlatformDependencies) {}

  pendingPlayerFootstepSoundArmed: boolean = false;

  fmodRuntime!: FmodRuntime;

  messageSoundHooks!: MessageSoundHooks;

  readonly deploymentTarget: string = this.resolveDeploymentTarget();

  fmodRuntimeInitializationInFlight: boolean = false;

  pendingThrownWeaponDirectionSound: boolean = false;

  pendingThrownWeaponDirectionSoundArmedAtMs: number = 0;

  readonly pendingThrownWeaponDirectionSoundWindowMs: number = 45000;

  webHaptics: WebHaptics | null = null;

  pendingIncomingDamageRumbleAmount: number = 0;

  pendingIncomingDamageRumbleStartingHp: number | null = null;

  pendingIncomingDamageRumbleTimerId: number | null = null;

  readonly damageRumbleDurationMs: number = 300;

  readonly incomingDamageRumbleDebounceMs: number = 140;

  async initializeFmodRuntime(): Promise<void> {
    if (
      this.fmodRuntime.isInitialized() ||
      this.fmodRuntimeInitializationInFlight
    ) {
      return;
    }
    this.fmodRuntimeInitializationInFlight = true;
    try {
      await this.fmodRuntime.initialize();
      this.fmodRuntime.setEnabled(this.dependencies.engineState.clientOptions.soundEnabled);
      if (!this.dependencies.engineState.clientOptions.soundEnabled) {
        logWithOriginal(
          "[NetHack 3D] FMOD Studio runtime initialized (audio disabled in client options).",
        );
        return;
      }
      logWithOriginal("[NetHack 3D] FMOD Studio runtime initialized.");
      const diagnostics = this.fmodRuntime.getThreadingDiagnostics();
      logWithOriginal(
        `[NetHack 3D] FMOD audio backend: ${diagnostics.backendMode} (update ${diagnostics.updateIntervalMs}ms, dsp ${diagnostics.dspBufferLength}x${diagnostics.dspBufferCount}, recover ${diagnostics.resumeRecoveryIntervalMs}ms).`,
      );
      if (!this.fmodRuntime.isUsingThreadedAudioMixing()) {
        console.warn(
          "FMOD fell back to ScriptProcessor (main-thread audio). AudioWorklet support is recommended for best performance.",
        );
      } else if (diagnostics.backendMode === "audio-worklet-copy") {
        const copyModeHint = this.getFmodAudioWorkletCopyModeHint(diagnostics);
        if (copyModeHint.level === "warn") {
          console.warn(copyModeHint.message);
        } else {
          logWithOriginal(copyModeHint.message);
        }
      }
    } catch (error) {
      console.warn(
        "FMOD Studio runtime is unavailable; continuing without audio.",
        error,
      );
    } finally {
      this.fmodRuntimeInitializationInFlight = false;
    }
  }

  syncFmodRuntimeWithClientOptions(soundEnabled: boolean): void {
    const enabled = Boolean(soundEnabled);
    this.fmodRuntime.setEnabled(enabled);
    this.messageSoundHooks.setEnabled(enabled);
    if (!enabled) {
      return;
    }
    if (this.fmodRuntime.isInitialized()) {
      return;
    }
    void this.initializeFmodRuntime();
  }

  resumeFmodFromUserGesture(): void {
    if (!this.dependencies.engineState.clientOptions.soundEnabled) {
      return;
    }
    this.messageSoundHooks.resumeFromUserGesture();
    this.fmodRuntime.resumeFromUserGesture();
  }

  triggerDamageRumble(durationMs: number, intensity: number): void {
    if (!this.dependencies.engineState.clientOptions.rumbleEnabled) {
      return;
    }

    const duration = Math.max(1, Math.min(1000, Math.round(durationMs)));
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    if (this.tryTriggerAndroidNativeDamageRumble(duration, clampedIntensity)) {
      return;
    }

    if (this.isNativeCapacitorPlatform()) {
      void Haptics.vibrate({ duration }).catch((error) => {
        console.warn("Unable to trigger native haptic damage rumble.", error);
      });
      return;
    }

    if (!this.webHaptics) {
      return;
    }

    void this.webHaptics
      .trigger(duration, { intensity: clampedIntensity })
      .catch((error) => {
        console.warn("Unable to trigger haptic damage rumble.", error);
      });
  }

  tryTriggerAndroidNativeDamageRumble(
    durationMs: number,
    intensity: number,
  ): boolean {
    if (
      this.getNativeCapacitorPlatform() !== "android" ||
      typeof window === "undefined"
    ) {
      return false;
    }

    const androidBridge = (window as Window & {
      nh3dAndroid?: Nh3dAndroidBridge;
    }).nh3dAndroid;
    if (typeof androidBridge?.vibrate !== "function") {
      return false;
    }

    const amplitude = Math.max(1, Math.min(255, Math.round(255 * intensity)));
    try {
      androidBridge.vibrate(durationMs, amplitude);
      return true;
    } catch (error) {
      console.warn("Unable to trigger Android haptic damage rumble.", error);
      return false;
    }
  }

  isNativeCapacitorPlatform(): boolean {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return this.isLikelyCapacitorEnvironment();
    }
  }

  getNativeCapacitorPlatform(): string {
    try {
      if (Capacitor.isNativePlatform()) {
        return Capacitor.getPlatform();
      }
    } catch {
      // Fall through to URL-scheme inference.
    }
    return this.isLikelyCapacitorEnvironment() ? "capacitor" : "web";
  }

  shouldInitializeWebHaptics(): boolean {
    if (WebHaptics.isSupported) {
      return true;
    }

    // iOS Safari does not expose navigator.vibrate, but web-haptics includes
    // an iOS switch-control fallback that can still produce light feedback.
    return this.isIosTouchWebEnvironment();
  }

  triggerOutgoingDamageRumble(): void {
    this.triggerDamageRumble(this.damageRumbleDurationMs, 0.5);
  }

  triggerPlayerKillRumble(): void {
    this.triggerDamageRumble(this.damageRumbleDurationMs, 0.75);
  }

  triggerPlayerDeathRumble(): void {
    this.clearPendingIncomingDamageRumble();
    this.webHaptics?.cancel();
    this.triggerDamageRumble(this.damageRumbleDurationMs * 2, 1);
  }

  queueIncomingDamageRumble(amount: number, hpBeforeDamage: number): void {
    const damage = Math.max(1, Math.round(Math.abs(amount)));
    if (!Number.isFinite(damage)) {
      return;
    }

    this.pendingIncomingDamageRumbleAmount += damage;
    if (
      this.pendingIncomingDamageRumbleStartingHp === null ||
      !Number.isFinite(this.pendingIncomingDamageRumbleStartingHp)
    ) {
      this.pendingIncomingDamageRumbleStartingHp = Math.max(
        damage,
        Math.round(Math.abs(hpBeforeDamage)),
        1,
      );
    }

    if (
      this.pendingIncomingDamageRumbleTimerId !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(this.pendingIncomingDamageRumbleTimerId);
    }

    if (typeof window === "undefined") {
      this.flushIncomingDamageRumble();
      return;
    }

    this.pendingIncomingDamageRumbleTimerId = window.setTimeout(() => {
      this.pendingIncomingDamageRumbleTimerId = null;
      this.flushIncomingDamageRumble();
    }, this.incomingDamageRumbleDebounceMs);
  }

  flushIncomingDamageRumble(): void {
    const totalDamage = this.pendingIncomingDamageRumbleAmount;
    const startingHp = this.pendingIncomingDamageRumbleStartingHp;
    this.pendingIncomingDamageRumbleAmount = 0;
    this.pendingIncomingDamageRumbleStartingHp = null;

    if (
      totalDamage <= 0 ||
      startingHp === null ||
      startingHp <= 0 ||
      !Number.isFinite(totalDamage) ||
      !Number.isFinite(startingHp)
    ) {
      return;
    }

    const damageRatio = Math.max(0, Math.min(1, totalDamage / startingHp));
    const intensity = Math.max(0.5, Math.min(1, 0.5 + damageRatio));
    this.triggerDamageRumble(this.damageRumbleDurationMs, intensity);
  }

  clearPendingIncomingDamageRumble(): void {
    if (
      this.pendingIncomingDamageRumbleTimerId !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(this.pendingIncomingDamageRumbleTimerId);
    }
    this.pendingIncomingDamageRumbleTimerId = null;
    this.pendingIncomingDamageRumbleAmount = 0;
    this.pendingIncomingDamageRumbleStartingHp = null;
  }

  getFmodAudioWorkletCopyModeHint(
    diagnostics: FmodThreadingDiagnostics,
  ): {
    level: "warn" | "info";
    message: string;
  } {
    if (this.deploymentTarget === "github-pages") {
      return {
        level: "info",
        message:
          "FMOD is using AudioWorklet copy mode on GitHub Pages. This host does not support custom COOP/COEP response headers.",
      };
    }

    if (
      diagnostics.crossOriginIsolated &&
      !diagnostics.sharedArrayBufferAvailable
    ) {
      return {
        level: "info",
        message:
          "FMOD is using AudioWorklet copy mode. This browser/runtime does not expose SharedArrayBuffer, so shared mode is unavailable.",
      };
    }

    const protocol =
      typeof window !== "undefined"
        ? window.location.protocol.toLowerCase()
        : "";
    if (this.isLikelyCapacitorEnvironment()) {
      return {
        level: "info",
        message:
          "FMOD is using AudioWorklet copy mode (Capacitor WebView). This is expected unless the embedded host is configured for COOP/COEP and supports SharedArrayBuffer.",
      };
    }

    if (this.isLikelyElectronEnvironment() && protocol === "file:") {
      return {
        level: "info",
        message:
          "FMOD is using AudioWorklet copy mode (Electron packaged file://). Shared-buffer mode requires cross-origin isolation over an HTTP(S) origin.",
      };
    }

    if (this.isLikelyLocalhostOrigin()) {
      return {
        level: "warn",
        message:
          "FMOD is using AudioWorklet copy mode. For localhost dev, run `npm run dev:isolated` to enable COOP/COEP and shared-buffer mode.",
      };
    }

    return {
      level: "warn",
      message:
        "FMOD is using AudioWorklet copy mode. Enable cross-origin isolation (COOP/COEP) on your host for lower-overhead shared-buffer mode.",
    };
  }

  isLikelyLocalhostOrigin(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    const host = window.location.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  isLikelyElectronEnvironment(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /\belectron\b/i.test(navigator.userAgent || "");
  }

  isLikelyCapacitorEnvironment(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    const globalWithCapacitor = window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    if (globalWithCapacitor.Capacitor?.isNativePlatform?.() === true) {
      return true;
    }
    const protocol = window.location.protocol.toLowerCase();
    return protocol === "capacitor:" || protocol === "ionic:";
  }

  resolveDeploymentTarget(): string {
    const candidate =
      typeof import.meta.env.VITE_DEPLOY_TARGET === "string"
        ? import.meta.env.VITE_DEPLOY_TARGET.trim().toLowerCase()
        : "";
    if (!candidate) {
      return "web";
    }
    return candidate;
  }

  resolveFmodRuntimeOptions(): FmodRuntimeOptions {
    switch (this.deploymentTarget) {
      case "electron":
        return {
          dspBufferLength: 1024,
          dspBufferCount: 4,
          updateIntervalMs: 16,
          resumeRecoveryIntervalMs: 1000,
        };
      case "capacitor":
        return {
          dspBufferLength: 2048,
          dspBufferCount: 6,
          updateIntervalMs: 16,
          resumeRecoveryIntervalMs: 1000,
        };
      case "github-pages":
        return {
          dspBufferLength: 2048,
          dspBufferCount: 4,
          updateIntervalMs: 16,
          resumeRecoveryIntervalMs: 1250,
        };
      default:
        return {
          dspBufferLength: 2048,
          dspBufferCount: 4,
          updateIntervalMs: 16,
          resumeRecoveryIntervalMs: 1250,
        };
    }
  }

  isIosTouchDevice(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }

    const userAgent = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const maxTouchPoints =
      typeof navigator.maxTouchPoints === "number"
        ? navigator.maxTouchPoints
        : 0;
    return (
      /\b(iPad|iPhone|iPod)\b/i.test(userAgent) ||
      (/Mac/i.test(platform) && maxTouchPoints > 1)
    );
  }

  isIosTouchWebEnvironment(): boolean {
    return this.isIosTouchDevice() && !this.isLikelyCapacitorEnvironment();
  }

  isMobileIosWebOrAndroidDevice(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }

    const userAgent = navigator.userAgent || "";
    const isIosWeb = this.isIosTouchWebEnvironment();
    const isAndroid = /\bAndroid\b/i.test(userAgent);
    return isIosWeb || isAndroid;
  }

  shouldPlayDrinkSoundForInventorySelection(
    questionText: string,
    menuItems: any[],
    selectedItem: any,
  ): boolean {
    if (!this.dependencies.questionMenus.isInventoryDrinkQuestion(questionText) || !selectedItem) {
      return false;
    }
    const categoryLabel = this.dependencies.questionMenus.findMenuCategoryLabelForItem(
      menuItems,
      selectedItem,
    );
    return !this.dependencies.questionMenus.isSpecialInventoryCategoryLabel(categoryLabel);
  }

  maybePlayDrinkSoundForQuestionAnswer(input: string): void {
    if (!this.dependencies.questionMenus.isInQuestion || this.dependencies.questionMenus.activeQuestionMenuItems.length > 0) {
      return;
    }
    if (!this.dependencies.questionMenus.isFountainDrinkQuestion(this.dependencies.questionMenus.activeQuestionText)) {
      return;
    }
    const normalizedChoice = String(input || "")
      .trim()
      .toLowerCase();
    if (normalizedChoice === "y") {
      this.messageSoundHooks.playDrinkSound();
    }
  }

  maybePlayDrinkSoundForQuestionMenuSelection(selectedItem: any): void {
    if (
      this.shouldPlayDrinkSoundForInventorySelection(
        this.dependencies.questionMenus.activeQuestionText,
        this.dependencies.questionMenus.activeQuestionMenuItems,
        selectedItem,
      )
    ) {
      this.messageSoundHooks.playDrinkSound();
    }
  }

  maybePlayDrinkSoundForInventoryItemAction(
    actionId: string,
    itemAccelerator: string,
  ): void {
    if (actionId !== "quaff") {
      return;
    }
    const selectedItem = this.dependencies.promptDialogs.currentInventory.find(
      (item) =>
        item &&
        !item.isCategory &&
        typeof item.accelerator === "string" &&
        item.accelerator === itemAccelerator,
    );
    if (
      this.shouldPlayDrinkSoundForInventorySelection(
        "What do you want to drink?",
        this.dependencies.promptDialogs.currentInventory,
        selectedItem,
      )
    ) {
      this.messageSoundHooks.playDrinkSound();
    }
  }

  clearPendingThrownWeaponDirectionSound(): void {
    this.pendingThrownWeaponDirectionSound = false;
    this.pendingThrownWeaponDirectionSoundArmedAtMs = 0;
  }

  armPendingThrownWeaponDirectionSound(): void {
    this.pendingThrownWeaponDirectionSound = true;
    this.pendingThrownWeaponDirectionSoundArmedAtMs = Date.now();
  }

  hasPendingThrownWeaponDirectionSound(): boolean {
    if (!this.pendingThrownWeaponDirectionSound) {
      return false;
    }
    if (
      Date.now() - this.pendingThrownWeaponDirectionSoundArmedAtMs >
      this.pendingThrownWeaponDirectionSoundWindowMs
    ) {
      this.clearPendingThrownWeaponDirectionSound();
      return false;
    }
    return true;
  }

  maybePlayThrownWeaponSoundForDirectionAnswer(
    directionKey: string,
  ): void {
    if (!this.hasPendingThrownWeaponDirectionSound()) {
      return;
    }
    this.clearPendingThrownWeaponDirectionSound();
    if (this.dependencies.directionPrompts.isSelfDirectionAnswerInput(directionKey)) {
      return;
    }
    this.messageSoundHooks.playThrownWeaponSound();
  }

  canArmPendingPlayerFootstepSound(): boolean {
    return (
      this.dependencies.engineState.clientOptions.soundEnabled &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.positionSelection.positionInputModeActive
    );
  }

  armPendingPlayerFootstepSound(): void {
    if (!this.canArmPendingPlayerFootstepSound()) {
      return;
    }
    this.pendingPlayerFootstepSoundArmed = true;
  }

  shouldArmPlayerFootstepFromMouseInput(
    x: number,
    y: number,
    button: number,
  ): boolean {
    if (
      button !== 0 ||
      this.dependencies.movementInput.isFpsMode() ||
      !this.canArmPendingPlayerFootstepSound()
    ) {
      return false;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return false;
    }
    const tileX = Math.round(x);
    const tileY = Math.round(y);
    const deltaX = Math.abs(tileX - this.dependencies.playerMovement.playerPos.x);
    const deltaY = Math.abs(tileY - this.dependencies.playerMovement.playerPos.y);
    return deltaX !== 0 || deltaY !== 0;
  }

  playPlayerFootstepSoundFromCliparoundIfEligible(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const nowMs = Date.now();
    const hadPendingSound = this.pendingPlayerFootstepSoundArmed;
    this.pendingPlayerFootstepSoundArmed = false;
    if (!this.dependencies.engineState.clientOptions.soundEnabled) {
      return;
    }
    if (fromX === toX && fromY === toY) {
      return;
    }
    if (
      !hadPendingSound &&
      !this.dependencies.movementInput.isPlayerCliparoundInputCooldownActive(nowMs)
    ) {
      return;
    }
    this.messageSoundHooks.playPlayerFootstepSound();
  }
}
