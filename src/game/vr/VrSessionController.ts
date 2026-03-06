import * as THREE from "three";
import { resolveXrAvailability } from "../../platform/xr";
import { isLoggingEnabled, logWithOriginal } from "../../logging";
import type { Nh3dClientOptions, XrAvailabilityState } from "../ui-types";
import VrHudFollower from "./VrHudFollower";
import VrInputRouter from "./VrInputRouter";
import VrPointerSystem from "./VrPointerSystem";
import type { VrEngineBridge } from "./types";
import VrVisuals from "./VrVisuals";
import VrWorldManipulator from "./VrWorldManipulator";

type VrSessionControllerOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  worldRoot: THREE.Group;
  bridge: VrEngineBridge;
  domOverlayRoot: HTMLElement | null;
};

export default class VrSessionController {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly bridge: VrEngineBridge;
  private readonly domOverlayRoot: HTMLElement | null;
  private readonly visuals: VrVisuals;
  private readonly pointerSystem: VrPointerSystem;
  private readonly worldManipulator: VrWorldManipulator;
  private readonly inputRouter: VrInputRouter;
  private readonly hudFollower: VrHudFollower;
  private availability: XrAvailabilityState = {
    supported: false,
    launchMode: "unavailable",
    directWebXrAvailable: false,
    isHeadsetShell: false,
    buttonLabel: "Check VR",
    statusText: "Checking VR support...",
    usingDomOverlay: false,
  };
  private activeSession: XRSession | null = null;
  private activationRetryCleanup: (() => void) | null = null;
  private readonly handleSessionEndBound = (): void => {
    this.handleSessionEnded();
  };

  constructor(options: VrSessionControllerOptions) {
    this.renderer = options.renderer;
    this.bridge = options.bridge;
    this.domOverlayRoot = options.domOverlayRoot;
    this.visuals = new VrVisuals(options.renderer, options.scene, options.worldRoot);
    this.pointerSystem = new VrPointerSystem(options.bridge);
    this.worldManipulator = new VrWorldManipulator(options.worldRoot);
    this.inputRouter = new VrInputRouter(options.bridge, this.worldManipulator);
    this.hudFollower = new VrHudFollower(this.domOverlayRoot);
  }

  private logDebug(message: string, details?: unknown): void {
    if (!isLoggingEnabled()) {
      return;
    }
    if (typeof details === "undefined") {
      logWithOriginal("[NH3D VR]", message);
      return;
    }
    logWithOriginal("[NH3D VR]", message, details);
  }

  async refreshAvailability(clientOptions: Nh3dClientOptions): Promise<void> {
    this.logDebug("refreshAvailability:start", {
      vrOfferOnSupportedDevice: clientOptions.vrOfferOnSupportedDevice,
    });
    this.availability = await resolveXrAvailability({
      vrOfferOnSupportedDevice: clientOptions.vrOfferOnSupportedDevice,
    });
    this.logDebug("refreshAvailability:resolved", this.availability);
    this.bridge.setXrAvailability(this.availability);
  }

  async enter(clientOptions: Nh3dClientOptions): Promise<void> {
    await this.enterInternal(clientOptions, { skipRefresh: false });
  }

  private buildBaseSessionInit(): XRSessionInit {
    return {
      optionalFeatures: ["local-floor", "bounded-floor"],
    };
  }

  private async enterInternal(
    clientOptions: Nh3dClientOptions,
    options: {
      skipRefresh: boolean;
    },
  ): Promise<void> {
    if (this.activeSession || this.renderer.xr.isPresenting) {
      this.logDebug("enterInternal:skipped-already-presenting");
      return;
    }
    if (!options.skipRefresh) {
      await this.refreshAvailability(clientOptions);
    }
    if (!this.availability.supported) {
      this.logDebug("enterInternal:blocked-unsupported", this.availability);
      return;
    }

    const xr = navigator.xr;
    if (!xr) {
      this.logDebug("enterInternal:blocked-missing-navigator-xr");
      return;
    }
    this.logDebug("enterInternal:requesting-session", {
      launchMode: this.availability.launchMode,
      directWebXrAvailable: this.availability.directWebXrAvailable,
      isHeadsetShell: this.availability.isHeadsetShell,
    });
    this.bridge.setXrSessionState("entering");

    try {
      this.clearActivationRetry();
      const session = await xr.requestSession(
        "immersive-vr",
        this.buildBaseSessionInit(),
      );
      session.addEventListener("end", this.handleSessionEndBound);
      await this.renderer.xr.setSession(session);
      this.activeSession = session;
      this.bridge.clearPointerLockForVr();
      this.bridge.setPlayerUiNumbersWorldProjection(true);
      this.bridge.setVrQuickPanelVisible(false);
      this.availability = {
        ...this.availability,
        usingDomOverlay: false,
      };
      this.logDebug("enterInternal:session-started");
      this.bridge.setXrAvailability(this.availability);
      this.bridge.setXrSessionState("immersive");
      this.worldManipulator.enter(this.bridge.getPlayMode());
      this.hudFollower.reset();
    } catch (error) {
      this.logDebug("enterInternal:requestSession-failed", error);
      console.warn("Failed to enter immersive VR session:", error);
      this.registerActivationRetry(clientOptions, error);
      this.bridge.setXrSessionState("inactive");
    }
  }

  async exit(): Promise<void> {
    if (!this.activeSession) {
      this.logDebug("exit:skipped-no-active-session");
      this.bridge.setXrSessionState("inactive");
      return;
    }
    this.logDebug("exit:ending-session");
    this.bridge.setXrSessionState("exiting");
    await this.activeSession.end();
  }

  async toggle(clientOptions: Nh3dClientOptions): Promise<void> {
    if (this.activeSession || this.renderer.xr.isPresenting) {
      await this.exit();
      return;
    }
    await this.enterInternal(clientOptions, { skipRefresh: false });
  }

  toggleQuickPanel(): void {
    if (!this.activeSession) {
      return;
    }
    this.bridge.setVrQuickPanelVisible(!this.bridge.getVrQuickPanelVisible());
  }

  update(deltaSeconds: number): void {
    if (!this.activeSession || !this.renderer.xr.isPresenting) {
      return;
    }

    if (this.bridge.shouldSuspendVrForUi()) {
      void this.exit();
      return;
    }

    const clientOptions = this.bridge.getClientOptions();
    const controllers = this.visuals.getControllers();
    const target = this.pointerSystem.update(
      controllers,
      clientOptions.vrPreferredPointerHand,
      (visual, distance) => this.visuals.setRayLength(visual, distance),
    );

    this.inputRouter.update({
      controllers,
      activeTarget: target,
      playMode: this.bridge.getPlayMode(),
      quickPanelVisible: this.bridge.getVrQuickPanelVisible(),
    });
    this.worldManipulator.update(
      deltaSeconds,
      this.bridge.getPlayMode(),
      this.bridge.getPlayerTilePosition(),
      clientOptions,
      controllers,
    );
    this.hudFollower.update(
      this.renderer.xr.getCamera() as THREE.Camera & THREE.Object3D,
      deltaSeconds,
    );
    this.visuals.setWarningPanelHover(false);
    this.visuals.updateWarningPanel(
      this.renderer.xr.getCamera() as THREE.Camera & THREE.Object3D,
      false,
    );
    this.visuals.setBoundaryVisible(
      this.bridge.getPlayMode() === "normal" &&
        clientOptions.vrShowLevelBoundaries,
    );
  }

  dispose(): void {
    this.exit().catch(() => {
      // Ignore cleanup errors during teardown.
    });
    this.clearActivationRetry();
    this.pointerSystem.clear();
    this.worldManipulator.exit();
    this.hudFollower.reset();
    this.visuals.dispose();
  }

  private handleSessionEnded(): void {
    this.logDebug("handleSessionEnded");
    if (this.activeSession) {
      this.activeSession.removeEventListener("end", this.handleSessionEndBound);
    }
    this.activeSession = null;
    this.pointerSystem.clear();
    this.visuals.resetRayLengths();
    this.visuals.setWarningPanelHover(false);
    this.visuals.updateWarningPanel(
      this.renderer.xr.getCamera() as THREE.Camera & THREE.Object3D,
      false,
    );
    this.worldManipulator.exit();
    this.hudFollower.reset();
    this.bridge.setPlayerUiNumbersWorldProjection(false);
    this.bridge.setVrQuickPanelVisible(false);
    this.bridge.setXrSessionState("inactive");
    this.availability = {
      ...this.availability,
      usingDomOverlay: false,
    };
    this.bridge.setXrAvailability(this.availability);
  }

  private clearActivationRetry(): void {
    if (!this.activationRetryCleanup) {
      return;
    }
    this.activationRetryCleanup();
    this.activationRetryCleanup = null;
  }

  private registerActivationRetry(
    clientOptions: Nh3dClientOptions,
    error: unknown,
  ): void {
    const likelyActivationError = this.isLikelyActivationError(error);
    if (!likelyActivationError || this.activationRetryCleanup) {
      this.logDebug("registerActivationRetry:skipped", {
        likelyActivationError,
        alreadyRegistered: Boolean(this.activationRetryCleanup),
      });
      return;
    }
    this.logDebug("registerActivationRetry:registered");
    const retry = (): void => {
      this.logDebug("registerActivationRetry:retry-triggered");
      this.clearActivationRetry();
      void this.enterInternal(clientOptions, {
        skipRefresh: false,
      });
    };
    const eventNames: Array<keyof WindowEventMap> = [
      "pointerup",
      "touchend",
      "keydown",
      "mouseup",
    ];
    for (const eventName of eventNames) {
      window.addEventListener(eventName, retry, {
        passive: true,
        once: true,
      });
    }
    this.activationRetryCleanup = () => {
      for (const eventName of eventNames) {
        window.removeEventListener(eventName, retry);
      }
    };
  }

  private isLikelyActivationError(error: unknown): boolean {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    const normalized = message.toLowerCase();
    return (
      normalized.includes("user activation") ||
      normalized.includes("transient activation") ||
      normalized.includes("user gesture") ||
      normalized.includes("gesture")
    );
  }
}
