import * as THREE from "three";
import {
  getDefaultVrBrowserLaunchUrl,
  launchVrBrowserHandoff,
  resolveXrAvailability,
} from "../../platform/xr";
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
    browserHandoffUrl: getDefaultVrBrowserLaunchUrl(),
    buttonLabel: "VR Unavailable",
    statusText: "VR is unavailable on this device.",
    usingDomOverlay: false,
  };
  private activeSession: XRSession | null = null;
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

  async refreshAvailability(clientOptions: Nh3dClientOptions): Promise<void> {
    this.availability = await resolveXrAvailability({
      vrOfferOnSupportedDevice: clientOptions.vrOfferOnSupportedDevice,
    });
    this.bridge.setXrAvailability(this.availability);
  }

  async enter(clientOptions: Nh3dClientOptions): Promise<void> {
    if (this.activeSession || this.renderer.xr.isPresenting) {
      return;
    }
    await this.refreshAvailability(clientOptions);
    if (!this.availability.supported) {
      return;
    }

    if (this.availability.launchMode === "browser-handoff") {
      this.bridge.setXrSessionState("handoff");
      await launchVrBrowserHandoff(this.availability.browserHandoffUrl ?? undefined);
      this.bridge.setXrSessionState("inactive");
      return;
    }

    const xr = navigator.xr;
    if (!xr) {
      return;
    }
    this.bridge.setXrSessionState("entering");
    const sessionInit: XRSessionInit = {
      optionalFeatures: ["local-floor", "bounded-floor"],
    };
    if (this.domOverlayRoot) {
      sessionInit.optionalFeatures = [
        ...(sessionInit.optionalFeatures ?? []),
        "dom-overlay",
      ];
      sessionInit.domOverlay = { root: this.domOverlayRoot };
    }

    try {
      const session = await xr.requestSession("immersive-vr", sessionInit);
      session.addEventListener("end", this.handleSessionEndBound);
      await this.renderer.xr.setSession(session);
      this.activeSession = session;
      this.bridge.clearPointerLockForVr();
      this.bridge.setPlayerUiNumbersWorldProjection(true);
      this.bridge.setVrQuickPanelVisible(false);
      this.availability = {
        ...this.availability,
        usingDomOverlay: Boolean(session.domOverlayState),
      };
      this.bridge.setXrAvailability(this.availability);
      this.bridge.setXrSessionState("immersive");
      this.worldManipulator.enter(this.bridge.getPlayMode());
      this.hudFollower.reset();
    } catch (error) {
      console.warn("Failed to enter immersive VR session:", error);
      this.bridge.setXrSessionState("inactive");
    }
  }

  async exit(): Promise<void> {
    if (!this.activeSession) {
      this.bridge.setXrSessionState("inactive");
      return;
    }
    this.bridge.setXrSessionState("exiting");
    await this.activeSession.end();
  }

  async toggle(clientOptions: Nh3dClientOptions): Promise<void> {
    if (this.activeSession || this.renderer.xr.isPresenting) {
      await this.exit();
      return;
    }
    await this.enter(clientOptions);
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

    if (!this.availability.usingDomOverlay && this.bridge.shouldSuspendVrForUi()) {
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
    this.visuals.setBoundaryVisible(
      this.bridge.getPlayMode() === "normal" &&
        clientOptions.vrShowLevelBoundaries,
    );
  }

  dispose(): void {
    this.exit().catch(() => {
      // Ignore cleanup errors during teardown.
    });
    this.pointerSystem.clear();
    this.worldManipulator.exit();
    this.hudFollower.reset();
    this.visuals.dispose();
  }

  private handleSessionEnded(): void {
    if (this.activeSession) {
      this.activeSession.removeEventListener("end", this.handleSessionEndBound);
    }
    this.activeSession = null;
    this.pointerSystem.clear();
    this.visuals.resetRayLengths();
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
}
