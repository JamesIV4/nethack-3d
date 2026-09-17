import { revealFlatStartup } from "../../../quest/webxr/startup-visibility";
import { ControllerModels } from "../../../quest/webxr/controller-models";
import * as THREE from "three";
import { ScaledCameraSprites } from "./scaled-camera-sprites";
import { WorldClipCulling } from "./world-clip-culling";
import { XrTerrainBatches } from "./xr-terrain-batches";
import type { TileRendering } from "./tile-rendering";
import type { GlyphTextures } from "./glyph-textures";
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
import type { MovementInput } from "../input/movement-input";
import { createTrackingToGame, tabletopClippingPlanes } from "./webxr-rig";
import { registerWebXrOwner, updateWebXrState } from "../../../quest/webxr/presentation";
import { getXrSettings } from "../../../quest/webxr/settings";
import { StereoDepth } from "../../../quest/webxr/stereo-depth";
import { LaggingUiAnchor } from "../../../quest/webxr/lagging-ui-anchor";
import { MenuRain } from "../../../quest/webxr/menu-rain";
import { TableMoveHandle } from "../../../quest/webxr/table-move-handle";
import { TabletopPan } from "../../../quest/webxr/tabletop-pan";
import { QuestResumeMode } from "../../../quest/webxr/quest-resume-mode";
import { gridUiHeading } from "../../../quest/webxr/grid-ui-heading";

export interface WebXrPresentationDependencies {
  readonly movementInput: Pick<MovementInput,"resolveDirectionKeyFromDelta">;
  readonly camera: Pick<Camera, "camera" | "cameraYaw" | "cameraPitch" | "firstPersonEyeHeight" | "sampleFpsStepCameraGroundPosition" | "snapFpsStepToPlayer" | "fpsAutoTurnTargetYaw" | "cameraPanX" | "cameraPanY" | "cameraPanTargetX" | "cameraPanTargetY" | "isCameraCenteredOnPlayer" | "getOverheadCameraFollowTargetWorldPosition" | "applyStandardCameraPresetForTopDownModes">;
  readonly engineState: Pick<EngineState, "clientOptions" | "playMode" | "disposed">;
  readonly playerMovement: Pick<PlayerMovement, "playerPos" | "hasSeenPlayerPosition">;
  readonly renderPipeline: Pick<RenderPipeline, "renderer" | "scene">;
  readonly tileRendering: Pick<TileRendering, "tileMap" | "floorGeometry">;
  readonly glyphTextures: Pick<GlyphTextures, "glyphOverlayMap">;
  readonly heldWeapon: Pick<HeldWeapon, "fpsHeldWeaponMesh" | "resolveFpsHeldWeaponTextureState" | "createQuestWeaponTexture" | "measureTextureOpaqueAspectRatio">;
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
  private readonly worldClipCulling = new WorldClipCulling();
  private readonly terrainBatches = new XrTerrainBatches();
  private readonly stereoDepth = new StereoDepth();
  private readonly trackingRoot = new THREE.Group();
  private readonly xrCamera = new THREE.PerspectiveCamera(75, 1, 0.03, 150);
  private readonly anchor = new THREE.Vector3(0, 1.6, 0);
  private readonly heading = new THREE.Quaternion();
  private readonly tableHeading = new THREE.Quaternion();
  private readonly tablePosition = new THREE.Vector3();
  private readonly tabletopPan = new TabletopPan();
  private readonly position = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly forward = new THREE.Vector3();
  private readonly headPosition = new THREE.Vector3();
  private readonly sceneInverse = new THREE.Matrix4();
  private readonly cameraBasis = new THREE.Matrix4();
  private readonly logicalUp = new THREE.Vector3();
  private readonly uiFollow = new LaggingUiAnchor();
  private uiFirstPerson = false;
  private uiRecenter = true;
  private uiRevision = 0;
  private lastFpsPlayerTileKey = "";
  private lastPlayerPositionReady = false;
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
  private viewYaw = 0;
  private needsRecenter = true;
  private host = false;
  private nativeHost = false;
  private availabilityPending = false;
  private xrAvailable = false;
  private resumeMode: QuestResumeMode | null = null;
  private lastPresentationTick = performance.now();
  private readonly lifecycle = new AbortController();
  private wired = false;
  private htmlPanel: HtmlUiPanel | null = null;
  private readonly tilt = new BoardTilt(this.trackingRoot);
  private readonly tableMove = new TableMoveHandle(this.trackingRoot);
  private input: WebXrControllerInput | null = null;
  controllerModels: ControllerModels | null = null;
  private startupMenu = false;
  private menuRain: MenuRain | null = null;

  setStartupMenu(visible: boolean): void {
    this.lastPlayerPositionReady = false;
    this.startupMenu = visible;
    document.documentElement.classList.toggle("nh3d-xr-menu", visible);
    this.needsRecenter = true;
    this.lastRigKey = "";
    this.tabletopPan.reset();
    if (visible) {
      this.terrainBatches.dispose();
      this.scaledSprites.disable(this.dependencies.renderPipeline.scene);
    }
    if (!visible) {
      if (this.active) this.dependencies.renderPipeline.scene.add(this.trackingRoot);
      this.menuRain?.dispose(); this.menuRain = null;
    }
  }

  renderStartupFrame(time: number): void {
    this.checkResumeAfterFramePause();
    if (!this.active) return;
    this.menuRain ??= new MenuRain();
    if (this.trackingRoot.parent !== this.menuRain.scene) this.menuRain.scene.add(this.trackingRoot);
    this.updateCamera();
    this.updateControllerModels(time);
    this.input?.update(time, null);
    this.htmlPanel?.update(time);
    this.menuRain.update(time);
    const { renderer } = this.dependencies.renderPipeline;
    this.stereoDepth.render(renderer.xr, this.xrCamera, getXrSettings().depth,
      () => renderer.render(this.menuRain!.scene, this.xrCamera));
    this.controllerModels?.render(this.xrCamera, this.trackingRoot);
  }

  constructor(private readonly dependencies: WebXrPresentationDependencies) {
    this.trackingRoot.name = "WebXR tracking space";
    // The inverse of a scaled parent combined with a rotated rig can contain
    // shear. Keep its exact matrix instead of decomposing it into local TRS.
    this.trackingRoot.matrixAutoUpdate = false;
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
    if (this.nativeHost) {
      let storage: Storage | null = null;
      try { storage = typeof localStorage === "undefined" ? null : localStorage; } catch { /* Use session-only intent. */ }
      this.resumeMode = new QuestResumeMode({
        storage,
        isVisible: () => this.started && this.xrAvailable && document.visibilityState !== "hidden",
        isImmersiveActive: () => this.active,
        enterImmersive: async () => {
          updateWebXrState({ busy: true });
          try { await this.enter(); } catch (error) { void revealFlatStartup(); throw error; } finally { if (this.started) updateWebXrState({ busy: false }); }
        },
        exitImmersive: async () => { await this.session?.end(); },
      });
      if (this.resumeMode.desired === "flat") void revealFlatStartup();
    }
    this.dependencies.renderPipeline.renderer.xr.enabled = true;
    this.dependencies.renderPipeline.renderer.xr.setReferenceSpaceType("local-floor");
    this.unregister = registerWebXrOwner({
      enter: () => this.resumeMode?.chooseImmersive() ?? this.enter(),
      exit: () => this.resumeMode?.chooseFlat() ?? this.session?.end() ?? Promise.resolve(),
      recenter: () => { this.needsRecenter = true; },
    });
    updateWebXrState({ host: true, available: false, error: "" });
    if (!navigator.xr) {
      void revealFlatStartup();
      updateWebXrState({ available: false, error: "This host does not expose WebXR. Use the WebXR runtime build." });
      return;
    }
    navigator.xr.addEventListener("devicechange", this.refreshAvailability, { signal: this.lifecycle.signal });
    document.addEventListener("visibilitychange", this.refreshAvailability, { signal: this.lifecycle.signal });
    if (typeof window !== "undefined") {
      window.addEventListener("pageshow", this.refreshAvailability, { signal: this.lifecycle.signal });
      window.addEventListener("focus", this.refreshAvailability, { signal: this.lifecycle.signal });
    }
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
      if (!available) void revealFlatStartup();
      updateWebXrState({ available, error: available ? "" : "No active XR headset/runtime was found." });
      this.tryAutomaticEntry();
    } catch (error) {
      if (this.started) { void revealFlatStartup(); updateWebXrState({ error: String(error) }); }
    } finally { this.availabilityPending = false; }
  };

  private readonly tryAutomaticEntry = (): void => {
    if (this.resumeMode) this.resumePresentation();
  };

  private resumePresentation(): void {
    if (!this.started || !this.xrAvailable || document.visibilityState === "hidden") return;
    void this.resumeMode?.onVisibilityResume().catch(error => {
      if (this.started) updateWebXrState({ error: error instanceof Error ? error.message : String(error) });
    });
  }
  private checkResumeAfterFramePause(): void {
    const now = performance.now(), paused = now-this.lastPresentationTick > 1000;
    this.lastPresentationTick = now;
    // A resumed native compositor can restart RAF without a DOM visibility event.
    if (paused && !this.active) this.resumePresentation();
  }

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
      session.addEventListener("visibilitychange", () => {
        if (this.session === currentSession && currentSession.visibilityState === "visible") this.resumePresentation();
      }, { signal: this.lifecycle.signal });
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
      renderer.xr.setFramebufferScaleFactor(getXrSettings().resolution);
      await renderer.xr.setSession(session);
      if (!this.started || this.session !== session) return;
      const layer = session.renderState?.baseLayer;
      if (layer) updateWebXrState({ renderResolution: `${Math.floor(layer.framebufferWidth / 2)} × ${layer.framebufferHeight} pixels per eye` });
      this.htmlPanel = new HtmlUiPanel(this.trackingRoot, this.nativeHost);
      this.input = new WebXrControllerInput(session, renderer, this.dependencies.renderPipeline.scene,
        this.trackingRoot, TILE_SIZE, () => this.htmlPanel, this.tilt, direction => this.snapTurn(direction), this.dependencies.heldWeapon,
        (dx, dy) => this.panTabletop(dx, dy), this.tableMove, {
          playerTile: () => this.dependencies.playerMovement.playerPos,
          direction: (dx,dy) => this.dependencies.movementInput.resolveDirectionKeyFromDelta(dx,dy,.25),
        });
      if (renderer instanceof THREE.WebGLRenderer) this.controllerModels = new ControllerModels(renderer);
      this.input.controllerOpacity = source => this.controllerModels?.opacity(source) ?? 1;
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
    this.terrainBatches.dispose();
    this.uiFirstPerson = false; this.uiRecenter = true; this.lastFpsPlayerTileKey = "";
    this.scaledSprites.disable(this.dependencies.renderPipeline.scene);
    document.documentElement.classList.remove("nh3d-xr-first-person");
    if (this.endListener) this.session?.removeEventListener("end", this.endListener);
    this.endListener = null;
    this.session = null;
    this.input?.dispose(); this.input = null;
    this.controllerModels?.dispose(); this.controllerModels = null;
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
    this.tabletopPan.reset();
    this.tableMove.cancel();
    this.menuRain?.reset();
    this.trackingRoot.removeFromParent();
    this.tilt.cancel();
    this.canvasPresentation?.exit();
    document.documentElement.classList.remove("nh3d-webxr-active");
    updateWebXrState({ active: false });
    if (this.started && !this.entering) void this.resumeMode?.onSessionEnded().catch(error => {
      if (this.started) { void revealFlatStartup(); updateWebXrState({ error: String(error) }); }
    });
  };

  get active(): boolean { return this.session !== null && this.dependencies.renderPipeline.renderer.xr.isPresenting; }

  private panTabletop(dx: number, dy: number): void {
    if (!this.active || this.startupMenu || this.dependencies.engineState.playMode === "fps") return;
    const camera = this.dependencies.camera;
    const direction = this.dependencies.engineState.clientOptions.invertTouchPanningDirection ? -1 : 1;
    camera.cameraPanX -= dx * direction;
    camera.cameraPanY -= dy * direction;
    camera.cameraPanTargetX = camera.cameraPanX;
    camera.cameraPanTargetY = camera.cameraPanY;
    camera.isCameraCenteredOnPlayer = false;
  }

  private snapTurn(direction: -1 | 1): void {
    if (!this.active || this.dependencies.engineState.playMode !== "fps") return;
    const xr = this.dependencies.renderPipeline.renderer.xr;
    const reference = xr.getReferenceSpace();
    const pose = reference && xr.getFrame()?.getViewerPose(reference);
    if (!pose) return;
    this.rotateView(direction * Math.PI / 4, pose.transform.position);
    this.updateCamera();
  }

  private rotateView(angle: number, head: {x:number;z:number}): void {
    const pivot = new THREE.Vector3(head.x, 0, head.z);
    const offset = new THREE.Vector3(this.anchor.x, 0, this.anchor.z).sub(pivot)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(pivot);
    this.anchor.x = offset.x; this.anchor.z = offset.z;
    this.viewYaw += angle; this.lastRigKey = "";
    this.uiRecenter = true;
  }

  updateCamera(): boolean {
    this.checkResumeAfterFramePause();
    if (!this.active) return false;
    const renderer = this.dependencies.renderPipeline.renderer;
    const xr = renderer.xr;
    const referenceSpace = xr.getReferenceSpace();
    const pose = referenceSpace && xr.getFrame()?.getViewerPose(referenceSpace);
    if (!pose) return true;
    const positionReady = this.dependencies.playerMovement.hasSeenPlayerPosition !== false;
    const enteringFps = !this.startupMenu && this.dependencies.engineState.playMode === "fps" &&
      (!this.uiFirstPerson || (!this.lastPlayerPositionReady && positionReady));
    this.lastPlayerPositionReady = positionReady;
    if (this.needsRecenter || enteringFps) {
      const camera = this.dependencies.camera;
      if (this.needsRecenter) {
        this.tableMove.reset();
        camera.cameraPanX = camera.cameraPanY = camera.cameraPanTargetX = camera.cameraPanTargetY = 0;
        camera.isCameraCenteredOnPlayer = true;
        this.tabletopPan.reset();
      }
      if (this.dependencies.engineState.playMode === "fps") camera.snapFpsStepToPlayer();
      this.viewYaw = 0;
      const { position, orientation } = pose.transform;
      this.anchor.set(position.x, position.y > 0.35 ? position.y : 1.6, position.z);
      this.orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
      this.forward.set(0, 0, -1).applyQuaternion(this.orientation);
      this.heading.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-this.forward.x, -this.forward.z));
      this.htmlPanel?.recenter(this.anchor, this.heading);
      this.uiRecenter = true;
      this.needsRecenter = false; this.lastRigKey = "";
    }
    if (this.startupMenu) {
      this.trackingRoot.matrix.identity();
      this.trackingRoot.updateMatrixWorld(true);
      renderer.clippingPlanes = [];
      this.board.visible = false;
      this.tilt.place(this.anchor, this.heading, false);
      this.tableMove.place(this.anchor, this.heading, this.tilt.pitch, false);
      this.htmlPanel?.nativePointer?.setBoard(false, 0, -.65);
      this.menuRain?.recenter(this.anchor);
      return true;
    }
    const player = this.dependencies.playerMovement.playerPos;
    const scene = this.dependencies.renderPipeline.scene;
    scene.updateWorldMatrix(true, false);
    this.sceneInverse.copy(scene.matrixWorld).invert();
    const firstPerson = this.dependencies.engineState.playMode === "fps";
    const turnTarget = this.dependencies.camera.fpsAutoTurnTargetYaw;
    if (firstPerson && typeof turnTarget === "number" && Number.isFinite(turnTarget)) {
      const o = pose.transform.orientation;
      const headForward = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(o.x,o.y,o.z,o.w));
      const gridForward = new THREE.Vector3(0,0,-1).applyQuaternion(this.heading);
      const headYaw = Math.atan2(-headForward.x,-headForward.z), gridYaw = Math.atan2(-gridForward.x,-gridForward.z);
      const currentYaw = Math.PI + gridYaw + this.viewYaw - headYaw;
      const angle = Math.atan2(Math.sin(turnTarget-currentYaw),Math.cos(turnTarget-currentYaw));
      this.rotateView(angle,pose.transform.position);
      // The XR turn is complete now; do not also run the flat camera's slow turn.
      this.dependencies.camera.fpsAutoTurnTargetYaw = null;
    }
    const playerTileKey = `${player.x},${player.y}`;
    if (firstPerson && this.lastFpsPlayerTileKey && this.lastFpsPlayerTileKey !== playerTileKey) this.uiRecenter = true;
    this.lastFpsPlayerTileKey = firstPerson ? playerTileKey : "";
    const settings = getXrSettings();
    const usingAnimatedFpsPosition = firstPerson && !settings.instantMovement &&
      this.dependencies.camera.sampleFpsStepCameraGroundPosition(this.position);
    if (!usingAnimatedFpsPosition && !firstPerson) {
      const target = this.dependencies.camera.getOverheadCameraFollowTargetWorldPosition();
      if (this.uiFirstPerson) this.tabletopPan.reset(target);
      const smoothed = this.tabletopPan.update(target, performance.now());
      this.position.set(smoothed.x, smoothed.y, 0);
    } else if (!usingAnimatedFpsPosition) this.position.set(player.x * TILE_SIZE, -player.y * TILE_SIZE, 0);
    this.position.applyMatrix4(scene.matrixWorld);
    if (firstPerson) {
      const viewer = new THREE.Vector3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
      const o = pose.transform.orientation;
      const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(o.x, o.y, o.z, o.w));
      const yaw = Math.hypot(facing.x, facing.z) > .1 ? Math.atan2(-facing.x, -facing.z) : this.uiFollow.yaw, time = performance.now();
      const gridForward = new THREE.Vector3(0,0,-1).applyQuaternion(this.heading);
      const gridYaw = Math.atan2(-gridForward.x,-gridForward.z);
      const snapUiYaw = (value:number) => gridUiHeading(value,gridYaw,this.viewYaw);
      if (!this.uiFirstPerson || this.uiRecenter) {
        this.uiFollow.reset(viewer, snapUiYaw(yaw), time, this.uiFirstPerson); this.uiRevision++;
      } else {
        const previousYaw = this.uiFollow.yaw;
        this.uiFollow.update(viewer, yaw, time, snapUiYaw);
        if (Math.abs(previousYaw-this.uiFollow.yaw) > .000001) this.uiRevision++;
      }
      this.htmlPanel?.setFirstPersonAnchor(this.uiFollow.position, this.uiFollow.yaw, this.uiRevision);
      this.uiRecenter = false;
    } else if (this.uiFirstPerson) this.htmlPanel?.recenter(this.anchor, this.heading);
    this.uiFirstPerson = firstPerson;
    document.documentElement.classList.toggle("nh3d-xr-first-person", firstPerson);
    this.tablePosition.set(0, THREE.MathUtils.clamp(this.anchor.y-.65,.45,1.05), -1.55).applyQuaternion(this.heading)
      .add(new THREE.Vector3(this.anchor.x,0,this.anchor.z)).add(this.tableMove.offset);
    const towardX = this.tablePosition.x-pose.transform.position.x, towardZ = this.tablePosition.z-pose.transform.position.z;
    this.tableHeading.copy(this.heading);
    if (Math.hypot(towardX,towardZ) > .05) this.tableHeading.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(-towardX,-towardZ));
    const heading = firstPerson ? this.heading : this.tableHeading;
    const key = [this.position.x, this.position.y, this.position.z, firstPerson, this.dependencies.camera.firstPersonEyeHeight, this.tilt.pitch, this.viewYaw, settings.area, settings.scale, ...this.tablePosition.toArray(), ...heading.toArray(), ...scene.matrixWorld.elements].join(":");
    if (key !== this.lastRigKey) {
      const rig = createTrackingToGame(firstPerson ? "first-person" : "tabletop", this.position, this.anchor,
        heading, TILE_SIZE, this.dependencies.camera.firstPersonEyeHeight, this.tilt.pitch, this.viewYaw, settings.scale, firstPerson ? undefined : this.tablePosition);
      this.trackingRoot.matrix.multiplyMatrices(this.sceneInverse, rig.matrix);
      this.trackingRoot.updateMatrixWorld(true);
      this.board.quaternion.copy(heading).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.tilt.pitch));
      this.board.scale.set(settings.area * settings.scale, settings.scale, settings.area * settings.scale);
      this.board.position.copy(rig.tabletop).add(new THREE.Vector3(0, -0.027 * settings.scale, 0).applyQuaternion(this.board.quaternion));
      this.board.visible = !firstPerson;
      this.tilt.place(rig.tabletop, heading, !firstPerson, settings.area, settings.scale);
      this.tableMove.place(rig.tabletop, heading, this.tilt.pitch, !firstPerson, settings.area, settings.scale);
      if (!firstPerson) this.htmlPanel?.nativePointer?.setTablePose(rig.tabletop, heading);
      this.htmlPanel?.nativePointer?.setBoard(firstPerson, this.tilt.pitch, firstPerson ? rig.tabletop.y - this.anchor.y : -.65);
      renderer.clippingPlanes = firstPerson ? [] : tabletopClippingPlanes(this.position, TILE_SIZE, settings.area);
      this.dependencies.renderPipeline.scene.background = this.session?.environmentBlendMode === "opaque"
        ? new THREE.Color(0x000000) : null;
      this.lastRigKey = key;
    }
    xr.updateCamera(this.xrCamera);
    // Engine aim/billboards use logical coordinates; rendered sprite shaders
    // and controller rays use the physical scene coordinates.
    const tracked = xr.getCamera();
    const camera = this.dependencies.camera.camera;
    // The stereo union camera shifts backwards along head orientation. It is
    // useful for culling, but is not the viewer's position for billboard facing.
    this.headPosition.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z).applyMatrix4(this.trackingRoot.matrixWorld);
    camera.position.copy(this.headPosition).applyMatrix4(this.sceneInverse);
    this.scaledSprites.setOrigin(this.headPosition);
    this.scaledSprites.setTabletop(!firstPerson);
    tracked.getWorldQuaternion(camera.quaternion);
    if (scene.scale.x !== 1 || scene.scale.y !== 1 || scene.scale.z !== 1) {
      this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion).transformDirection(this.sceneInverse);
      this.logicalUp.set(0, 1, 0).applyQuaternion(camera.quaternion).transformDirection(this.sceneInverse);
      this.cameraBasis.lookAt(new THREE.Vector3(), this.forward, this.logicalUp);
      camera.quaternion.setFromRotationMatrix(this.cameraBasis);
    }
    camera.updateMatrixWorld(true);
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (firstPerson) {
      this.dependencies.camera.cameraYaw = Math.atan2(-this.forward.x, -this.forward.y);
      this.dependencies.camera.cameraPitch = Math.asin(THREE.MathUtils.clamp(this.forward.z, -1, 1));
    }
    return true;
  }

  private updateControllerModels(time: number): void {
    if (!this.controllerModels) return;
    const xr = this.dependencies.renderPipeline.renderer.xr;
    const frame = xr.getFrame?.(), reference = xr.getReferenceSpace();
    if (frame && reference && this.session) this.controllerModels?.update(frame, reference, Array.from(this.session.inputSources), time);
  }

  updateInput(time: number): void {
    if (this.active) this.updateControllerModels(time);
    if (this.active) this.input?.update(time, this.dependencies.engineState.playMode === "fps" ? this.forward : null);
  }

  prepareRender(): THREE.Camera | null {
    if (!this.active) return null;
    this.htmlPanel?.nativePointer?.setWorldTransform(this.trackingRoot.matrixWorld.clone().invert());
    this.htmlPanel?.update(performance.now());
    this.scaledSprites.prepare(this.dependencies.renderPipeline.scene, this.headPosition, this.dependencies.engineState.playMode !== "fps");
    // The screen-space held weapon is not an XR hand/controller prop.
    if (this.dependencies.heldWeapon.fpsHeldWeaponMesh) this.dependencies.heldWeapon.fpsHeldWeaponMesh.visible = false;
    return this.xrCamera;
  }

  render(camera: THREE.Camera): void {
    const { renderer, scene } = this.dependencies.renderPipeline;
    this.stereoDepth.render(renderer.xr, this.xrCamera, getXrSettings().depth, () => this.terrainBatches.render(renderer, scene, camera, this.trackingRoot,
      this.dependencies.tileRendering.tileMap, this.dependencies.tileRendering.floorGeometry,
      this.dependencies.glyphTextures.glyphOverlayMap, this.worldClipCulling));
    this.controllerModels?.render(camera, this.trackingRoot);
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
    this.tableMove.dispose();
    this.terrainBatches.dispose();
    this.menuRain?.dispose(); this.menuRain = null;
    document.documentElement.classList.remove("nh3d-xr-menu");
  }
}
