import * as THREE from "three";
import { ScaledCameraSprites } from "./scaled-camera-sprites";
import { XrCanvasPresentation } from "./xr-canvas-presentation";
import { HtmlUiPanel } from "../../../quest/webxr/html-ui-panel";
import { BoardTilt } from "../../../quest/webxr/board-tilt";
import { withoutWorldClipping } from "../../../quest/webxr/overlay-material";
import { WebXrControllerInput } from "../../../quest/webxr/controller-input";
import { TILE_SIZE } from "../../constants";
import type { Camera } from "../camera/camera";
import type { EngineState } from "../runtime/engine-state";
import type { PlayerMovement } from "../world/player-movement";
import type { RenderPipeline } from "./render-pipeline";
import type { HeldWeapon } from "./held-weapon";
import { createTrackingToGame, tabletopClippingPlanes } from "./webxr-rig";
import { enterWebXr, registerWebXrOwner, updateWebXrState } from "../../../quest/webxr/presentation";

export interface WebXrPresentationDependencies {
  readonly camera: Pick<Camera, "camera" | "cameraYaw" | "cameraPitch" | "firstPersonEyeHeight" | "applyStandardCameraPresetForTopDownModes">;
  readonly engineState: Pick<EngineState, "clientOptions" | "playMode" | "disposed">;
  readonly playerMovement: Pick<PlayerMovement, "playerPos">;
  readonly renderPipeline: Pick<RenderPipeline, "renderer" | "scene">;
  readonly heldWeapon: Pick<HeldWeapon, "fpsHeldWeaponMesh">;
}

/** Three.js owns all world pixels. The APK host composites the existing live DOM separately. */
export class WebXrPresentation {
  private session: XRSession | null = null;
  private started = false;
  private entering = false;
  private endListener: (() => void) | null = null;
  private canvasPresentation: XrCanvasPresentation | null = null;
  private unregister: (() => void) | null = null;
  private readonly scaledSprites = new ScaledCameraSprites();
  private readonly trackingRoot = new THREE.Group();
  private readonly xrCamera = new THREE.PerspectiveCamera(75, 1, 0.03, 150);
  private readonly anchor = new THREE.Vector3(0, 1.6, 0);
  private readonly heading = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly forward = new THREE.Vector3();
  private readonly board = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.05, 1.9),
    withoutWorldClipping(new THREE.MeshBasicMaterial({ color: 0x17212c })),
  );
  private previousClipPlanes: THREE.Plane[] = [];
  private previousBackground: THREE.Scene["background"] = null;
  private readonly previousClearColor = new THREE.Color();
  private previousClearAlpha = 1;
  private savedCamera: { position: THREE.Vector3; quaternion: THREE.Quaternion; yaw: number; pitch: number; mode: string } | null = null;
  private lastRigKey = "";
  private needsRecenter = true;
  private host = false;
  private nativeHost = false;
  private autoEntryAttempted = false;
  private availabilityPending = false;
  private xrAvailable = false;
  private readonly lifecycle = new AbortController();
  private wired = false;
  private htmlPanel: HtmlUiPanel | null = null;
  private readonly tilt = new BoardTilt(this.trackingRoot);
  private input: WebXrControllerInput | null = null;

  constructor(private readonly dependencies: WebXrPresentationDependencies) {
    this.trackingRoot.name = "WebXR tracking space";
    this.trackingRoot.add(this.xrCamera, this.board);
    this.board.visible = false;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const host = new URLSearchParams(location.search).get("xrHost");
    this.nativeHost = host === "native" || location.origin === "http://127.0.0.1:18973";
    this.host = this.nativeHost || host === "wired";
    this.wired = host === "wired";
    // Only expose entry where a live HTML UI compositor is available.
    if (!this.host) return;
    this.dependencies.renderPipeline.renderer.xr.enabled = true;
    this.dependencies.renderPipeline.renderer.xr.setReferenceSpaceType("local-floor");
    this.unregister = registerWebXrOwner({
      enter: () => this.enter(), exit: async () => { await this.session?.end(); }, recenter: () => { this.needsRecenter = true; },
    });
    updateWebXrState({ host: true, available: false, error: "" });
    if (!navigator.xr) {
      updateWebXrState({ available: false, error: "This host does not expose WebXR. Use the WebXR runtime build." });
      return;
    }
    navigator.xr.addEventListener("devicechange", this.refreshAvailability, { signal: this.lifecycle.signal });
    document.addEventListener("visibilitychange", this.refreshAvailability, { signal: this.lifecycle.signal });
    document.addEventListener("pointerup", this.tryAutomaticEntry, { capture: true, signal: this.lifecycle.signal });
    document.addEventListener("keydown", this.tryAutomaticEntry, { capture: true, signal: this.lifecycle.signal });
    void this.refreshAvailability();
  }

  private readonly refreshAvailability = async (): Promise<void> => {
    if (!this.started || !navigator.xr || this.availabilityPending) return;
    this.availabilityPending = true;
    try {
      const available = await navigator.xr.isSessionSupported("immersive-vr");
      if (!this.started) return;
      this.xrAvailable = available;
      updateWebXrState({ available, error: available ? "" : "No active XR headset/runtime was found." });
      this.tryAutomaticEntry();
    } catch (error) {
      if (this.started) updateWebXrState({ error: String(error) });
    } finally { this.availabilityPending = false; }
  };

  private readonly tryAutomaticEntry = (): void => {
    if (!this.started || !this.nativeHost || !this.xrAvailable || this.autoEntryAttempted ||
        document.visibilityState === "hidden" || navigator.userActivation?.isActive === false) return;
    // Use the normal Start/Resume interaction's transient activation. If startup
    // outlasts it, the next ordinary game interaction completes entry.
    this.autoEntryAttempted = true;
    void enterWebXr();
  };

  private async enter(): Promise<void> {
    if (this.session || this.entering || !navigator.xr || !this.host) return;
    const renderer = this.dependencies.renderPipeline.renderer;
    this.entering = true;
    this.canvasPresentation ??= new XrCanvasPresentation(renderer.domElement);
    this.canvasPresentation.enter();
    document.documentElement.classList.add("nh3d-webxr-active");
    let session: XRSession | null = null;
    try {
      const mode = this.dependencies.engineState.clientOptions.vrPassthrough ? "immersive-ar" : "immersive-vr";
      // requestSession stays directly in the user gesture; unsupported MR produces a visible error.
      session = await navigator.xr.requestSession(mode, { requiredFeatures: ["local-floor"] });
      if (!this.started) { await session.end(); return; }
      this.session = session;
      const currentSession = session;
      this.endListener = () => queueMicrotask(() => {
        if (this.session === currentSession) this.ended();
      });
      session.addEventListener("end", this.endListener);
      const gameCamera = this.dependencies.camera.camera;
      this.savedCamera = { position: gameCamera.position.clone(), quaternion: gameCamera.quaternion.clone(),
        yaw: this.dependencies.camera.cameraYaw, pitch: this.dependencies.camera.cameraPitch, mode: this.dependencies.engineState.playMode };
      this.previousClipPlanes = renderer.clippingPlanes;
      this.previousBackground = this.dependencies.renderPipeline.scene.background;
      renderer.getClearColor(this.previousClearColor);
      this.previousClearAlpha = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, mode === "immersive-ar" ? 0 : 1);
      this.dependencies.renderPipeline.scene.add(this.trackingRoot);
      document.exitPointerLock?.();
      await renderer.xr.setSession(session);
      if (!this.started || this.session !== session) return;
      this.htmlPanel = new HtmlUiPanel(this.trackingRoot, this.nativeHost);
      this.input = new WebXrControllerInput(session, renderer, this.dependencies.renderPipeline.scene,
        this.trackingRoot, TILE_SIZE, () => this.htmlPanel, this.tilt);
      this.needsRecenter = true;
      this.lastRigKey = "";
      document.documentElement.classList.add("nh3d-webxr-active");
      updateWebXrState({ active: true, error: "" });
    } catch (error) {
      if (session) { await session.end().catch(() => {}); if (this.session === session) this.ended(); }
      else { this.canvasPresentation.exit(); document.documentElement.classList.remove("nh3d-webxr-active"); }
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(this.dependencies.engineState.clientOptions.vrPassthrough
        ? "Could not enter mixed reality. Turn off Mixed reality in VR to test an opaque VR session. " + detail : detail);
    } finally { this.entering = false; }
  }

  private readonly ended = (): void => {
    if (this.endListener) this.session?.removeEventListener("end", this.endListener);
    this.endListener = null;
    this.session = null;
    this.input?.dispose(); this.input = null;
    this.htmlPanel?.dispose(); this.htmlPanel = null;
    const { renderer, scene } = this.dependencies.renderPipeline;
    renderer.clippingPlanes = this.previousClipPlanes;
    scene.background = this.previousBackground;
    renderer.setClearColor(this.previousClearColor, this.previousClearAlpha);
    scene.remove(this.trackingRoot);
    if (this.savedCamera) {
      if (this.savedCamera.mode === this.dependencies.engineState.playMode) {
        this.dependencies.camera.camera.position.copy(this.savedCamera.position);
        this.dependencies.camera.camera.quaternion.copy(this.savedCamera.quaternion);
        this.dependencies.camera.cameraYaw = this.savedCamera.yaw;
        this.dependencies.camera.cameraPitch = this.savedCamera.pitch;
      } else if (this.dependencies.engineState.playMode === "fps") {
        this.dependencies.camera.cameraYaw = Math.PI;
        this.dependencies.camera.cameraPitch = 0;
      } else {
        this.dependencies.camera.applyStandardCameraPresetForTopDownModes({ force: true });
      }
      this.savedCamera = null;
    }
    this.board.visible = false;
    this.tilt.cancel();
    this.canvasPresentation?.exit();
    document.documentElement.classList.remove("nh3d-webxr-active");
    updateWebXrState({ active: false });
  };

  get active(): boolean { return this.session !== null && this.dependencies.renderPipeline.renderer.xr.isPresenting; }

  updateCamera(): boolean {
    if (!this.active) return false;
    const renderer = this.dependencies.renderPipeline.renderer;
    const xr = renderer.xr;
    const referenceSpace = xr.getReferenceSpace();
    const pose = referenceSpace && xr.getFrame()?.getViewerPose(referenceSpace);
    if (!pose) return true;
    if (this.needsRecenter) {
      const { position, orientation } = pose.transform;
      this.anchor.set(position.x, position.y > 0.35 ? position.y : 1.6, position.z);
      this.orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
      this.forward.set(0, 0, -1).applyQuaternion(this.orientation);
      this.heading.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-this.forward.x, -this.forward.z));
      this.htmlPanel?.recenter(this.anchor, this.heading);
      this.needsRecenter = false; this.lastRigKey = "";
    }
    const player = this.dependencies.playerMovement.playerPos;
    this.position.set(player.x * TILE_SIZE, -player.y * TILE_SIZE, 0);
    const firstPerson = this.dependencies.engineState.playMode === "fps";
    const key = [player.x, player.y, firstPerson, this.dependencies.camera.firstPersonEyeHeight, this.tilt.pitch].join(":");
    if (key !== this.lastRigKey) {
      const rig = createTrackingToGame(firstPerson ? "first-person" : "tabletop", this.position, this.anchor,
        this.heading, TILE_SIZE, this.dependencies.camera.firstPersonEyeHeight, this.tilt.pitch);
      rig.matrix.decompose(this.trackingRoot.position, this.trackingRoot.quaternion, this.trackingRoot.scale);
      this.trackingRoot.updateMatrixWorld(true);
      this.board.quaternion.copy(this.heading).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.tilt.pitch));
      this.board.position.copy(rig.tabletop).add(new THREE.Vector3(0, -0.027, 0).applyQuaternion(this.board.quaternion));
      this.board.visible = !firstPerson;
      this.tilt.place(rig.tabletop, this.heading, !firstPerson);
      renderer.clippingPlanes = firstPerson ? [] : tabletopClippingPlanes(this.position, TILE_SIZE);
      this.dependencies.renderPipeline.scene.background = this.session?.environmentBlendMode === "opaque"
        ? new THREE.Color(0x101720) : null;
      this.lastRigKey = key;
    }
    xr.updateCamera(this.xrCamera);
    // Existing billboard, light and aim code sees the actual tracked camera in source world coordinates.
    const tracked = xr.getCamera();
    const camera = this.dependencies.camera.camera;
    camera.position.setFromMatrixPosition(tracked.matrixWorld);
    tracked.getWorldQuaternion(camera.quaternion);
    camera.updateMatrixWorld(true);
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (firstPerson) {
      this.dependencies.camera.cameraYaw = Math.atan2(-this.forward.x, -this.forward.y);
      this.dependencies.camera.cameraPitch = Math.asin(THREE.MathUtils.clamp(this.forward.z, -1, 1));
    }
    return true;
  }

  updateInput(time: number): void {
    if (this.active) this.input?.update(time, this.dependencies.engineState.playMode === "fps" ? this.forward : null);
  }

  prepareRender(): THREE.Camera | null {
    if (!this.active) return null;
    this.htmlPanel?.update(performance.now());
    this.scaledSprites.prepare(this.dependencies.renderPipeline.scene);
    // The screen-space held weapon is not an XR hand/controller prop.
    if (this.dependencies.heldWeapon.fpsHeldWeaponMesh) this.dependencies.heldWeapon.fpsHeldWeaponMesh.visible = false;
    return this.xrCamera;
  }

  dispose(): void {
    this.started = false;
    this.lifecycle.abort();
    this.unregister?.(); this.unregister = null;
    const session = this.session;
    if (session) { this.ended(); void session.end().catch(() => {}); }
    this.canvasPresentation?.exit();
    if (this.host) document.documentElement.classList.remove("nh3d-webxr-active");
    this.board.geometry.dispose(); this.board.material.dispose();
    this.tilt.dispose();
  }
}
