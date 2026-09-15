import * as THREE from "three";
import { gameFrameTime } from "./engine/rendering/frame-time";
import { WebHaptics } from "web-haptics";
import { WorkerRuntimeBridge } from "../runtime";
import type { RuntimeEvent } from "../runtime";
import { FmodRuntime } from "../audio";
import { isLoggingEnabled, setLoggingEnabled } from "../logging";
import { TILE_SIZE } from "./constants";
import { setActiveGlyphCatalog } from "./glyphs/registry";
import type {
  Nh3dClientOptions,
  Nethack3DEngineController,
  Nethack3DEngineOptions,
  PlayMode
} from "./ui-types";
import { createEmptyGameOverPostmortemReports, createEmptyRunTelemetrySnapshot } from "./ui-types";
import { normalizeNh3dClientOptions } from "./ui-types";
import { MessageSoundHooks } from "./message-sound-hooks";
import DirectionPromptOverlay from "./DirectionPromptOverlay";
import { createEngineSystems, type EngineSystems } from "./engine/create-engine-systems";

/** Main engine composition, ordered lifecycle, and public UI controller. */
class Nethack3DEngine implements Nethack3DEngineController {
  private readonly systems: EngineSystems;

  constructor(options: Nethack3DEngineOptions) {
    this.systems = createEngineSystems({
      initThreeJS: (...args) => this.initThreeJS(...args),
      initUI: (...args) => this.initUI(...args),
      connectToRuntime: (...args) => this.connectToRuntime(...args),
      handleRuntimeEvent: (...args) => this.handleRuntimeEvent(...args),
      animate: (...args) => this.animate(...args),
      dispose: (...args) => this.dispose(...args),
      applyClientOptions: (...args) => this.applyClientOptions(...args),
      applyPlayMode: (...args) => this.applyPlayMode(...args),
      clearScene: (...args) => this.clearScene(...args),
      setClientOptions: (...args) => this.setClientOptions(...args),
    });
    this.systems.engineState.mountElement = options.mountElement ?? null;
    this.systems.engineState.uiAdapter = options.uiAdapter;
    this.systems.engineState.characterCreationConfig = options.characterCreationConfig ?? {
      mode: "create",
      playMode: "normal",
      runtimeVersion: "3.6.7",
    };
    this.systems.inputCommands.numberPadModeEnabled = this.systems.extendedCommands.resolveStartupNumberPadModeEnabled(
      this.systems.engineState.characterCreationConfig.initOptions,
    );
    this.systems.extendedCommands.useNativeExtendedCommandMenu = this.systems.extendedCommands.resolveStartupExtmenuEnabled(
      this.systems.engineState.characterCreationConfig.initOptions,
    );
    this.systems.engineState.clientOptions = normalizeNh3dClientOptions(options.clientOptions);
    this.systems.terminalRendering.refreshTerminalRenderOptionStates();
    const explicitFpsMode = options.clientOptions?.fpsMode;
    const initialFpsMode =
      typeof explicitFpsMode === "boolean"
        ? explicitFpsMode
        : this.systems.engineState.characterCreationConfig.playMode === "fps";
    this.systems.engineState.playMode =
      initialFpsMode && this.systems.engineState.clientOptions.tilesetMode !== "terminal"
        ? "fps"
        : "normal";
    this.systems.engineState.clientOptions.fpsMode = this.systems.engineState.playMode === "fps";
    if (typeof options.loggingEnabled === "boolean") {
      setLoggingEnabled(options.loggingEnabled);
    }
    this.systems.audioHapticsPlatform.fmodRuntime = new FmodRuntime(this.systems.audioHapticsPlatform.resolveFmodRuntimeOptions());
    this.systems.audioHapticsPlatform.messageSoundHooks = new MessageSoundHooks({
      isSoundEnabled: () => this.systems.engineState.clientOptions.soundEnabled,
    });
    this.systems.audioHapticsPlatform.messageSoundHooks.setEnabled(this.systems.engineState.clientOptions.soundEnabled);
    this.systems.audioHapticsPlatform.webHaptics = this.systems.audioHapticsPlatform.shouldInitializeWebHaptics()
      ? new WebHaptics()
      : null;
    this.initThreeJS();
    this.initUI();
    this.connectToRuntime();
    this.systems.engineState.uiAdapter.setNumberPadModeEnabled(this.systems.inputCommands.numberPadModeEnabled);
    this.systems.engineState.uiAdapter.setRepeatActionVisible(false);
    this.systems.engineState.uiAdapter.setGameOver({ ...this.systems.gameOver.gameOverState });

    if (this.systems.engineState.playMode === "fps") {
      this.systems.camera.camera.fov = this.systems.camera.resolveFpsCameraFov();
      this.systems.camera.camera.updateProjectionMatrix();
      this.systems.camera.cameraDistance = 0;
      this.systems.camera.cameraPitch = 0;
      this.systems.camera.cameraYaw = Math.PI;
      this.systems.camera.cameraFollowInitialized = true;
    } else {
      this.systems.camera.applyStandardCameraPresetForTopDownModes({ force: true });
    }
    this.systems.minimap.updateMinimapVisibility();
    this.applyClientOptions(this.systems.engineState.clientOptions);
    this.systems.camera.applyVultureIsometricCameraPresetIfNeeded({ force: true });
    if (this.systems.terminalRendering.isTerminalDisplayMode()) {
      // Terminal mode persisted from a previous session starts active, so
      // the option-change path never fires; initialize it directly.
      this.systems.terminalRendering.enterTerminalDisplayMode();
    }
    this.systems.questSceneExport.start();
    this.systems.webXrPresentation.start();
  }

  private initThreeJS(): void {
    // --- Basic Three.js setup ---
    const viewport = this.systems.renderPipeline.getRendererViewportSize();
    this.systems.renderPipeline.scene = new THREE.Scene();
    this.systems.camera.camera = new THREE.PerspectiveCamera(
      75,
      viewport.width / viewport.height,
      0.1,
      1000,
    );
    this.systems.camera.camera.up.set(0, 0, 1);
    // Post-processing AA is driven by the client option (TAA/FXAA).
    // Use transparent clear so post-processing can affect scene content only.
    this.systems.renderPipeline.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.systems.renderPipeline.initAntialiasingPipeline();
    this.systems.renderPipeline.updateRendererResolution();
    this.systems.renderPipeline.renderer.setClearColor(0x000000, 0);
    this.systems.renderPipeline.renderer.domElement.style.backgroundColor = "";
    // No current light path casts shadows, so keep shadow-map allocation off.
    this.systems.renderPipeline.renderer.shadowMap.enabled = false;
    this.systems.renderPipeline.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.systems.directionPrompts.directionPromptOverlay = new DirectionPromptOverlay(this.systems.renderPipeline.scene);

    this.systems.tilesetAssets.loadTilesetTexture(normalizeNh3dClientOptions(this.systems.engineState.clientOptions));

    Object.values(this.systems.tileMaterials.materials).forEach((material) => {
      this.systems.lighting.patchMaterialForVignette(material);
    });

    const host = this.systems.engineState.mountElement ?? document.body;
    host.style.backgroundColor = "#000011";
    host.appendChild(this.systems.renderPipeline.renderer.domElement);
    this.systems.camera.syncCameraSmoothingCssVariablesFromCode();

    // --- Lighting ---
    this.systems.lighting.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.systems.renderPipeline.scene.add(this.systems.lighting.ambientLight);

    this.systems.lighting.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.systems.lighting.directionalLight.position.set(10, 10, 5);
    this.systems.lighting.directionalLight.castShadow = false;
    this.systems.lighting.directionalLight.shadow.mapSize.width = 2048;
    this.systems.lighting.directionalLight.shadow.mapSize.height = 2048;
    this.systems.renderPipeline.scene.add(this.systems.lighting.directionalLight);
    this.systems.lighting.configureBaseLightingForPlayMode();

    // --- Event Listeners ---
    const eventListenerSignal = { signal: this.systems.engineState.domEventAbortController.signal };
    this.systems.renderPipeline.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.systems.renderPipeline.handleWebGlContextLost,
      eventListenerSignal,
    );
    this.systems.renderPipeline.renderer.domElement.addEventListener(
      "webglcontextrestored",
      this.systems.renderPipeline.handleWebGlContextRestored,
      eventListenerSignal,
    );
    window.addEventListener(
      "resize",
      this.systems.renderPipeline.onWindowResize.bind(this.systems.renderPipeline),
      eventListenerSignal,
    );
    window.addEventListener(
      "orientationchange",
      this.systems.minimap.scheduleMinimapActionRailOverlapSync.bind(this.systems.minimap),
      eventListenerSignal,
    );
    window.addEventListener(
      "keydown",
      this.systems.keyboardInput.handleKeyDown.bind(this.systems.keyboardInput),
      eventListenerSignal,
    );
    window.addEventListener(
      "keyup",
      this.systems.keyboardInput.handleKeyUp.bind(this.systems.keyboardInput),
      eventListenerSignal,
    );
    window.addEventListener(
      "blur",
      this.systems.keyboardInput.handleWindowBlur.bind(this.systems.keyboardInput),
      eventListenerSignal,
    );
    window.addEventListener(
      "beforeunload",
      this.systems.keyboardInput.handleBeforeUnload.bind(this.systems.keyboardInput),
      eventListenerSignal,
    );
    document.addEventListener(
      "pointerlockchange",
      this.systems.pointerLock.handlePointerLockChange.bind(this.systems.pointerLock),
      eventListenerSignal,
    );

    // Mouse controls for camera
    window.addEventListener(
      "wheel",
      this.systems.mouseInput.handleMouseWheel.bind(this.systems.mouseInput),
      eventListenerSignal,
    );
    window.addEventListener(
      "mousedown",
      this.systems.mouseInput.handleMouseDown.bind(this.systems.mouseInput),
      eventListenerSignal,
    );
    window.addEventListener(
      "mousemove",
      this.systems.mouseInput.handleMouseMove.bind(this.systems.mouseInput),
      eventListenerSignal,
    );
    window.addEventListener(
      "mouseup",
      this.systems.mouseInput.handleMouseUp.bind(this.systems.mouseInput),
      eventListenerSignal,
    );
    const touchInputSurface = this.systems.engineState.mountElement ?? this.systems.renderPipeline.renderer.domElement;
    touchInputSurface.addEventListener(
      "touchstart",
      this.systems.touchInput.handleTouchStart.bind(this.systems.touchInput),
      {
        passive: false,
        signal: this.systems.engineState.domEventAbortController.signal,
      },
    );
    touchInputSurface.addEventListener(
      "touchmove",
      this.systems.touchInput.handleTouchMove.bind(this.systems.touchInput),
      {
        passive: false,
        signal: this.systems.engineState.domEventAbortController.signal,
      },
    );
    touchInputSurface.addEventListener(
      "touchend",
      this.systems.touchInput.handleTouchEnd.bind(this.systems.touchInput),
      {
        passive: false,
        signal: this.systems.engineState.domEventAbortController.signal,
      },
    );
    touchInputSurface.addEventListener(
      "touchcancel",
      this.systems.touchInput.handleTouchCancel.bind(this.systems.touchInput),
      eventListenerSignal,
    );
    window.addEventListener(
      "contextmenu",
      (e) => e.preventDefault(),
      eventListenerSignal,
    );

    // Start render loop
    this.systems.renderPipeline.renderer.setAnimationLoop(this.systems.engineState.animateFrameCallback);
  }

  private applyPlayMode(nextPlayMode: PlayMode): void {
    const previousPlayMode = this.systems.engineState.playMode;
    // The simulated terminal is inherently top-down; FPS play is suspended
    // while it is active (the stored fpsMode preference is left untouched).
    const resolvedPlayMode: PlayMode =
      nextPlayMode === "fps" && !this.systems.terminalRendering.isTerminalDisplayMode()
        ? "fps"
        : "normal";
    if (this.systems.engineState.playMode === resolvedPlayMode) {
      this.systems.lighting.configureBaseLightingForPlayMode();
      this.systems.lighting.markLightingDirty();
      return;
    }

    this.systems.engineState.playMode = resolvedPlayMode;
    this.systems.engineState.clientOptions.fpsMode = this.systems.engineState.playMode === "fps";
    this.systems.engineState.characterCreationConfig.playMode = this.systems.engineState.playMode;
    this.systems.touchInput.clearFpsTouchGestures();
    this.systems.mouseInput.isMiddleMouseDown = false;
    this.systems.mouseInput.isRightMouseDown = false;
    this.systems.mouseInput.rightMouseCanOpenContextMenuOnRelease = false;
    this.systems.mouseInput.rightMouseDragExceededDeadzone = false;
    this.systems.camera.clearCameraYawSnapTarget();
    this.systems.camera.fpsAutoMoveDirection = null;
    this.systems.camera.fpsAutoTurnTargetYaw = null;
    this.systems.camera.fpsStepCameraActive = false;
    this.systems.camera.fpsStepCameraDurationMs = this.systems.camera.fpsStepCameraBaseDurationMs;
    this.systems.camera.fpsStepCameraTargetTile = null;
    this.systems.camera.lastRunLikeInputAtMs = 0;
    this.systems.playerMovement.fpsPredictedPlayerTile = null;
    this.systems.playerMovement.asciiPendingPlayerTile = null;
    this.systems.heldWeapon.fpsHeldWeaponLagYaw = null;
    this.systems.heldWeapon.fpsHeldWeaponLagPitch = null;
    this.systems.heldWeapon.fpsHeldWeaponMovementOffset.set(0, 0);
    this.systems.heldWeapon.fpsHeldWeaponSwayPhase = 0;
    this.systems.heldWeapon.fpsHeldWeaponSwaySpeed = 0;
    this.systems.heldWeapon.fpsHeldWeaponSwaySpeedTarget = 0;
    this.systems.heldWeapon.clearFpsHeldWeaponAnimationState();
    this.systems.combatAttribution.pendingFpsHeldWeaponMeleeSwipeContext = null;
    this.systems.combatAttribution.suppressNextFpsHeldWeaponMissedAttackMessageSound = false;
    if (this.systems.heldWeapon.fpsHeldWeaponMesh) {
      this.systems.heldWeapon.fpsHeldWeaponMesh.visible = false;
    }
    this.systems.playerMovement.fpsRecentPlayerTilesForSuppression = [];
    this.systems.fpsDiagnostics.asciiPlayerTileDebugLastLogAtByKey.clear();
    this.systems.tileContextActions.closeAnyTileContextMenu(false);

    if (this.systems.engineState.playMode === "fps") {
      if (previousPlayMode !== "fps") {
        const currentLookDirection = this.systems.camera.camera.getWorldDirection(
          new THREE.Vector3(),
        );
        this.systems.camera.playModeCameraTransitionCurrentPosition.copy(this.systems.camera.camera.position);
        this.systems.camera.playModeCameraTransitionCurrentLookTarget
          .copy(this.systems.camera.camera.position)
          .add(
            currentLookDirection.multiplyScalar(
              Math.max(TILE_SIZE * 2, this.systems.camera.positionCursorFarLookOrbitDistance),
            ),
          );
        this.systems.camera.playModeCameraTransitionActive = true;
      } else {
        this.systems.camera.playModeCameraTransitionActive = false;
      }
      const eyeX = this.systems.playerMovement.playerPos.x * TILE_SIZE;
      const eyeY = -this.systems.playerMovement.playerPos.y * TILE_SIZE;
      const currentYaw = Number.isFinite(this.systems.camera.cameraYaw)
        ? this.systems.camera.cameraYaw
        : Math.PI;
      this.systems.camera.camera.fov = this.systems.camera.resolveFpsCameraFov();
      this.systems.camera.camera.updateProjectionMatrix();
      this.systems.camera.cameraDistance = 0;
      this.systems.camera.cameraPitch = 0;
      this.systems.camera.cameraYaw = this.systems.camera.wrapAngle(currentYaw);
      this.systems.camera.cameraFollowInitialized = true;
      this.systems.camera.fpsStepCameraFrom.set(eyeX, eyeY, this.systems.camera.firstPersonEyeHeight);
      this.systems.camera.fpsStepCameraTo.set(eyeX, eyeY, this.systems.camera.firstPersonEyeHeight);
      if (this.systems.promptDialogs.runtimeConnectionState === "running") {
        this.systems.promptDialogs.requestSilentInventoryRefresh("fps-mode-enter");
      }
    } else {
      this.systems.tileContextActions.closeAnyTileContextMenu(false);
      if (this.systems.aimHighlights.fpsForwardHighlight) {
        this.systems.aimHighlights.fpsForwardHighlight.visible = false;
      }
      this.systems.movementInput.fpsFireSuppressionUntilMs = 0;
      this.systems.inputCommands.clearAutomaticGlancePendingState();
      this.systems.tileContextActions.fpsCrosshairContextSignature = "";
      if (document.pointerLockElement === this.systems.renderPipeline.renderer.domElement) {
        document.exitPointerLock?.();
      }
      this.systems.pointerLock.fpsPointerLockActive = false;
      this.systems.pointerLock.fpsPointerLockRestorePending = false;
      this.systems.camera.camera.fov = 75;
      this.systems.camera.camera.updateProjectionMatrix();
      if (previousPlayMode === "fps") {
        const currentLookDirection = this.systems.camera.camera.getWorldDirection(
          new THREE.Vector3(),
        );
        this.systems.camera.playModeCameraTransitionCurrentPosition.copy(this.systems.camera.camera.position);
        this.systems.camera.playModeCameraTransitionCurrentLookTarget
          .copy(this.systems.camera.camera.position)
          .add(
            currentLookDirection.multiplyScalar(
              Math.max(TILE_SIZE * 2, this.systems.camera.positionCursorFarLookOrbitDistance),
            ),
          );
        this.systems.camera.playModeCameraTransitionActive = true;
      } else {
        this.systems.camera.playModeCameraTransitionActive = false;
      }
      this.systems.camera.applyStandardCameraPresetForTopDownModes({ force: true });
      this.systems.camera.applyVultureIsometricCameraPresetIfNeeded({ force: true });
      this.systems.camera.cameraFollowInitialized = false;
      this.systems.tileUpdates.requestTileUpdate(this.systems.playerMovement.playerPos.x, this.systems.playerMovement.playerPos.y);
    }

    this.systems.lighting.configureBaseLightingForPlayMode();
    this.systems.minimap.updateMinimapPresentation();
    this.systems.floorOcclusion.clearFloorBlockAmbientOcclusion();
    this.systems.tileUpdates.refreshTilesFromStateCache();
    this.systems.pointerLock.syncFpsPointerLockForUiState(false);
    this.systems.lighting.markLightingDirty();
  }

  private applyClientOptions(nextOptions: Nh3dClientOptions): void {
    const normalized = normalizeNh3dClientOptions(nextOptions);
    const previous = this.systems.engineState.clientOptions;
    const wasUsingVultureTiles = this.systems.tilesetAssets.isVultureTilesActive(previous);
    const isUsingVultureTiles = this.systems.tilesetAssets.isVultureTilesActive(normalized);
    const playModeChanged = previous.fpsMode !== normalized.fpsMode;
    const fpsFovChanged = previous.fpsFov !== normalized.fpsFov;
    const lightingEnabledChanged =
      previous.lightingEnabled !== normalized.lightingEnabled;
    const fpsFlattenEntityBillboardsChanged =
      previous.fpsFlattenEntityBillboards !==
      normalized.fpsFlattenEntityBillboards;
    const showItemsUnderPlayerInOverheadTilesModeChanged =
      previous.showItemsUnderPlayerInOverheadTilesMode !==
      normalized.showItemsUnderPlayerInOverheadTilesMode;
    const minimapChanged = previous.minimap !== normalized.minimap;
    const minimapColorModeChanged =
      previous.minimapColorMode !== normalized.minimapColorMode;
    const minimapLayoutChanged =
      previous.minimapScale !== normalized.minimapScale ||
      previous.manualMobileBottomSafeZoneEnabled !==
        normalized.manualMobileBottomSafeZoneEnabled ||
      previous.manualMobileRightSafeZoneHorizontalPx !==
        normalized.manualMobileRightSafeZoneHorizontalPx;
    const damageNumbersChanged =
      previous.damageNumbers !== normalized.damageNumbers;
    const tileShakeChanged =
      previous.tileShakeOnHit !== normalized.tileShakeOnHit;
    const bloodMistChanged = previous.bloodMist !== normalized.bloodMist;
    const bloodGroundChanged = previous.bloodGround !== normalized.bloodGround;
    const bloodStrengthChanged =
      previous.bloodStrength !== normalized.bloodStrength;
    const bloodGroundColorChanged =
      previous.bloodColorLightHex !== normalized.bloodColorLightHex ||
      previous.bloodColorDarkHex !== normalized.bloodColorDarkHex;
    const bloodMistColorChanged =
      previous.bloodMistColorHex !== normalized.bloodMistColorHex;
    const bloodDetailChanged = previous.bloodDetail !== normalized.bloodDetail;
    const monsterShatterChanged =
      previous.monsterShatter !== normalized.monsterShatter;
    const blockAmbientOcclusionChanged =
      previous.blockAmbientOcclusion !== normalized.blockAmbientOcclusion;
    const darkCorridorWallsChanged =
      previous.darkCorridorWalls367 !== normalized.darkCorridorWalls367;
    const darkCorridorWallTileOverrideChanged =
      previous.overrideNh5DarkCorridorWallTiles !==
        normalized.overrideNh5DarkCorridorWallTiles ||
      previous.darkCorridorWallTileOverrideEnabled !==
        normalized.darkCorridorWallTileOverrideEnabled ||
      previous.darkCorridorWallTileOverrideTileId !==
        normalized.darkCorridorWallTileOverrideTileId ||
      previous.darkCorridorWallSolidColorOverrideEnabled !==
        normalized.darkCorridorWallSolidColorOverrideEnabled ||
      previous.darkCorridorWallSolidColorHex !==
        normalized.darkCorridorWallSolidColorHex ||
      previous.darkCorridorWallSolidColorHexFps !==
        normalized.darkCorridorWallSolidColorHexFps ||
      previous.darkCorridorWallSolidColorGridEnabled !==
        normalized.darkCorridorWallSolidColorGridEnabled ||
      previous.darkCorridorWallSolidColorGridDarknessPercent !==
        normalized.darkCorridorWallSolidColorGridDarknessPercent;
    const tilesetBackgroundTileChanged =
      previous.tilesetBackgroundTileId !== normalized.tilesetBackgroundTileId;
    const tilesetBackgroundRemovalModeChanged =
      previous.tilesetBackgroundRemovalMode !==
      normalized.tilesetBackgroundRemovalMode;
    const tilesetSolidChromaKeyColorHexChanged =
      previous.tilesetSolidChromaKeyColorHex !==
      normalized.tilesetSolidChromaKeyColorHex;
    const fpsHeldWeaponSpriteFlipXChanged =
      previous.fpsHeldWeaponSpriteFlipX !== normalized.fpsHeldWeaponSpriteFlipX;
    const tilesetModeChanged = previous.tilesetMode !== normalized.tilesetMode;
    const animatedMovementChanged =
      previous.animatedMovement !== normalized.animatedMovement;
    const asciiColorModeChanged =
      previous.asciiColorMode !== normalized.asciiColorMode;
    const tilesetPathChanged = previous.tilesetPath !== normalized.tilesetPath;
    const antialiasingChanged =
      previous.antialiasing !== normalized.antialiasing;
    const brightnessChanged = previous.brightness !== normalized.brightness;
    const contrastChanged = previous.contrast !== normalized.contrast;
    const gammaChanged = previous.gamma !== normalized.gamma;
    const soundEnabledChanged =
      previous.soundEnabled !== normalized.soundEnabled;
    const rumbleEnabledChanged =
      previous.rumbleEnabled !== normalized.rumbleEnabled;
    const cameraYawSnapChanged =
      previous.snapCameraYawToNearest45 !== normalized.snapCameraYawToNearest45;

    this.systems.engineState.clientOptions = normalized;
    this.systems.lighting.vignetteUniforms.uBloodGroundStrength.value =
      normalized.bloodStrength;
    if (cameraYawSnapChanged && !normalized.snapCameraYawToNearest45) {
      this.systems.camera.clearCameraYawSnapTarget();
    }

    if (playModeChanged) {
      this.applyPlayMode(normalized.fpsMode ? "fps" : "normal");
    }
    if (fpsFovChanged && this.systems.engineState.playMode === "fps") {
      this.systems.camera.camera.fov = this.systems.camera.resolveFpsCameraFov();
      this.systems.camera.camera.updateProjectionMatrix();
    }
    if (lightingEnabledChanged) {
      this.systems.lighting.configureBaseLightingForPlayMode();
      this.systems.lighting.markLightingDirty();
    }
    if (minimapChanged) {
      this.systems.minimap.updateMinimapVisibility();
    } else if (minimapLayoutChanged) {
      this.systems.minimap.scheduleMinimapActionRailOverlapSync();
    }
    if (minimapColorModeChanged) {
      this.systems.minimap.resetMinimap();
      this.systems.tileUpdates.refreshTilesFromStateCache();
    }
    if (damageNumbersChanged && !normalized.damageNumbers) {
      this.systems.damageNumbers.clearPlayerDamageNumberParticles();
    }
    if (tileShakeChanged && !normalized.tileShakeOnHit) {
      this.systems.damageFlashes.clearGlyphDamageShakes();
    }
    if (
      (bloodMistChanged || bloodStrengthChanged || bloodMistColorChanged) &&
      !normalized.bloodMist
    ) {
      this.systems.bloodParticles.clearBloodMistParticles();
    }
    if (bloodStrengthChanged || bloodMistColorChanged) {
      this.systems.bloodParticles.clearBloodMistParticles();
      this.systems.bloodParticles.disposeBloodMistTexture();
    }
    if (bloodStrengthChanged || bloodGroundColorChanged) {
      this.systems.bloodGround.bloodGroundColorLut = null;
    }
    if (bloodDetailChanged) {
      this.systems.bloodGround.clearAllCachedBloodGroundSnapshots();
      this.systems.bloodGround.disposeBloodGroundOverlayResources();
    } else if (bloodStrengthChanged || bloodGroundColorChanged) {
      this.systems.bloodGround.refreshActiveBloodGroundVisuals();
    }
    if (bloodGroundChanged) {
      this.systems.bloodGround.updateBloodGroundOverlayVisibility();
    }
    if (monsterShatterChanged && !normalized.monsterShatter) {
      this.systems.bloodParticles.clearMonsterBillboardShardParticles();
    }
    if (tilesetPathChanged) {
      this.systems.menuPreviews.clearMenuTilePreviewCache();
      this.systems.tilesetAssets.loadTilesetTexture(normalized);
    }
    if (tilesetBackgroundTileChanged && !tilesetPathChanged) {
      this.systems.tilesetAssets.captureTilesetBackgroundReferenceTile(
        this.systems.tilesetAssets.loadedTilesetSourceAtlasImage ??
          this.systems.tilesetAssets.resolveTilesetAtlasImageSource(),
        this.systems.tilesetAssets.tileSourceSize,
      );
    }
    if (
      tilesetBackgroundTileChanged ||
      tilesetBackgroundRemovalModeChanged ||
      tilesetSolidChromaKeyColorHexChanged
    ) {
      this.systems.tilesetAssets.invalidateBillboardTextureCaches();
      this.systems.tileUpdates.refreshTilesFromStateCache();
    }
    if (tilesetModeChanged) {
      if (normalized.tilesetMode === "terminal") {
        // True terminal cells always apply runtime updates immediately.
        this.systems.entityMovement.clearEntityMoveTransitions();
      }
      this.systems.menuPreviews.clearMenuTilePreviewCache();
      const enteredTerminal =
        normalized.tilesetMode === "terminal" &&
        previous.tilesetMode !== "terminal";
      const leftTerminal =
        previous.tilesetMode === "terminal" &&
        normalized.tilesetMode !== "terminal";
      if (enteredTerminal) {
        this.systems.terminalRendering.enterTerminalDisplayMode();
      } else if (leftTerminal) {
        this.systems.terminalRendering.leaveTerminalDisplayMode();
      }
      this.systems.tileUpdates.refreshTilesFromStateCache();
    }
    if (animatedMovementChanged && !normalized.animatedMovement) {
      this.systems.entityMovement.clearEntityMoveTransitions();
    }
    if (asciiColorModeChanged && !tilesetModeChanged) {
      this.systems.tilesetAssets.invalidateTilesetDependentCaches();
      this.systems.tileUpdates.refreshTilesFromStateCache();
    }
    if (fpsFlattenEntityBillboardsChanged && !tilesetModeChanged) {
      this.systems.tileUpdates.refreshTilesFromStateCache();
    }
    if (showItemsUnderPlayerInOverheadTilesModeChanged) {
      this.systems.tileUpdates.refreshTilesFromStateCache();
      if (this.systems.worldClassification.shouldShowUnderPlayerFeaturesInOverheadTilesMode()) {
        this.systems.tileUpdates.requestPlayerTileRefresh("overhead-under-player-option-enabled");
      }
    }
    if (fpsFlattenEntityBillboardsChanged) {
      this.systems.entityBillboards.updateMonsterBillboardPitchLockState();
    }
    if (tilesetPathChanged || tilesetModeChanged) {
      this.systems.menuPreviews.refreshMenuTilePreviewStateForUi();
    }
    if (!wasUsingVultureTiles && isUsingVultureTiles) {
      this.systems.camera.applyVultureIsometricCameraPresetIfNeeded({ force: true });
    }
    if (wasUsingVultureTiles && !isUsingVultureTiles && !this.systems.movementInput.isFpsMode()) {
      this.systems.camera.applyStandardCameraPresetForTopDownModes({ force: true });
    }
    if (!isUsingVultureTiles) {
      this.systems.tileContextActions.clearVultureMouseHoverHighlight();
    }
    if (!this.systems.wallGeometry.shouldUseChamferedWallGeometry()) {
      this.systems.wallGeometry.clearFpsWallChamferFloorMeshes();
    }
    if (blockAmbientOcclusionChanged) {
      this.systems.floorOcclusion.refreshAllFloorBlockAmbientOcclusion();
    }
    if (antialiasingChanged) {
      this.systems.renderPipeline.initAntialiasingPipeline();
      this.systems.renderPipeline.updateRendererResolution();
    }
    if (brightnessChanged || contrastChanged || gammaChanged) {
      this.systems.renderPipeline.updateToneAdjustPostProcess();
    }
    if (darkCorridorWallsChanged || darkCorridorWallTileOverrideChanged) {
      this.systems.darkCorridorInference.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
      if (this.systems.tilesetAssets.resolveRuntimeVersion() === "5.0") {
        this.systems.tilesetAssets.invalidateBillboardTextureCaches();
        this.systems.tileUpdates.refreshTilesFromStateCache();
      }
      this.systems.lighting.markLightingDirty();
    }
    if (soundEnabledChanged && !normalized.soundEnabled) {
      this.systems.audioHapticsPlatform.pendingPlayerFootstepSoundArmed = false;
      this.systems.movementInput.clearPlayerCliparoundInputCooldown();
    }
    if (rumbleEnabledChanged && !normalized.rumbleEnabled) {
      this.systems.audioHapticsPlatform.clearPendingIncomingDamageRumble();
      this.systems.audioHapticsPlatform.webHaptics?.cancel();
    }
    this.systems.audioHapticsPlatform.syncFmodRuntimeWithClientOptions(normalized.soundEnabled);
    this.systems.vultureProjectionDebug.syncVultureWallProjectionDebugPanelVisibility();
    this.systems.tilesetAssets.refreshTilesetCompilationLoadingState();
    if (
      this.systems.heldWeaponAnimationDebug.fpsHeldWeaponAnimationDebugVisible &&
      (tilesetPathChanged ||
        tilesetModeChanged ||
        fpsHeldWeaponSpriteFlipXChanged)
    ) {
      this.systems.heldWeaponAnimationDebug.syncFpsHeldWeaponAnimationDebugUi();
    }
  }

  private initUI(): void {
    this.systems.extendedCommands.ensureMetaCommandModal();
    this.systems.minimap.ensureMinimapOverlay();
    this.systems.controllerDialogs.ensureControllerVirtualCursorOverlay();
    this.systems.vultureProjectionDebug.ensureVultureWallProjectionDebugPanel();
    this.systems.vultureProjectionDebug.syncVultureWallProjectionDebugPanelVisibility();
    this.systems.controllerDialogs.resetControllerVirtualCursor();
    this.systems.engineState.uiAdapter.setStatus("Starting local NetHack runtime...");
    this.systems.engineState.uiAdapter.setConnectionStatus("Disconnected", "disconnected");
    this.systems.promptDialogs.setLoadingVisible(true);
    this.systems.extendedCommands.availableExtendedCommands = [];
    this.systems.engineState.uiAdapter.setExtendedCommands([]);
    this.systems.engineState.uiAdapter.setNewGamePrompt({ visible: false, reason: null });
    this.systems.engineState.uiAdapter.setGameOver({ ...this.systems.gameOver.gameOverState });
  }

  private async connectToRuntime(): Promise<void> {
    if (this.systems.engineState.disposed) {
      return;
    }
    console.log("Starting local NetHack runtime");
    this.systems.levelTerrainCache.resetLevelTerrainCacheTracking();
    this.systems.promptDialogs.runtimeTerminationPromptShown = false;
    this.systems.runTelemetry.resetRunTelemetryTracking();
    this.systems.gameOver.setGameOverState(false, null);
    this.systems.promptDialogs.inventoryContextActionsEnabled = true;
    this.systems.promptDialogs.currentInventory = [];
    this.systems.promptDialogs.pendingInventoryDialog = false;
    this.systems.promptDialogs.pendingInventoryDialogOptions = null;
    this.systems.promptDialogs.inventoryRefreshInFlight = false;
    this.systems.promptDialogs.pendingStartupInventoryRefresh = true;
    this.systems.promptDialogs.pendingStartupInventoryRefreshEarliestAtMs =
      Date.now() + this.systems.promptDialogs.startupInventoryRefreshDelayMs;
    this.systems.engineState.uiAdapter.setInventory(this.systems.promptDialogs.buildInventoryDialogState());
    this.systems.playerStatus.statusConditionMask = 0;
    this.systems.playerStatus.playerStats.conditionMask = 0;
    this.systems.playerStatus.resetPlayerStatusDeltaTracking();
    this.systems.darkCorridorInference.pendingBoulderPushDarkCorridorInference = null;
    this.systems.playerMovement.fpsLastPlayerMoveFromTile = null;
    this.systems.promptDialogs.updateConnectionStatus("Starting", "starting");
    this.systems.tileUpdates.pendingPlayerTileRefreshOnNextPosition = true;

    await setActiveGlyphCatalog(
      this.systems.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7",
    );
    if (this.systems.engineState.disposed) {
      return;
    }

    const session = new WorkerRuntimeBridge(
      (payload: RuntimeEvent) => {
        this.handleRuntimeEvent(payload);
      },
      {
        runtimeVersion: this.systems.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7",
        characterCreation: {
          mode: this.systems.engineState.characterCreationConfig.mode,
          name: this.systems.engineState.characterCreationConfig.name,
          role: this.systems.engineState.characterCreationConfig.role,
          race: this.systems.engineState.characterCreationConfig.race,
          gender: this.systems.engineState.characterCreationConfig.gender,
          align: this.systems.engineState.characterCreationConfig.align,
          resumeCategory: this.systems.engineState.characterCreationConfig.resumeCategory,
        },
        initOptions: this.systems.engineState.characterCreationConfig.initOptions,
        loggingEnabled: isLoggingEnabled(),
      },
    );
    if (this.systems.engineState.disposed) {
      session.dispose();
      return;
    }
    this.systems.engineState.session = session;

    try {
      await this.systems.engineState.session.start();
      if (this.systems.engineState.disposed) {
        this.systems.engineState.session?.dispose();
        this.systems.engineState.session = null;
        return;
      }
      this.systems.engineState.session.setLoggingEnabled(isLoggingEnabled());
      this.systems.engineState.session.requestRuntimeGlobalsSnapshot();
      this.systems.promptDialogs.updateConnectionStatus("Running", "running");
      this.systems.promptDialogs.updateStatus("Local NetHack runtime started");
      // this.addGameMessage("Local NetHack runtime started");
      if (this.systems.movementInput.isFpsMode()) {
        this.systems.engineMessages.addGameMessage(
          "FPS mode active: WASD move, F search, left-click fire, right-click look/interact.",
        );
      }
      this.systems.promptDialogs.setLoadingVisible(false);
    } catch (error) {
      if (this.systems.engineState.disposed) {
        return;
      }
      const startupErrorMessage =
        error instanceof Error ? error.message : String(error ?? "");
      const startupFailureMessage = startupErrorMessage.trim()
        ? `Failed to start local NetHack runtime: ${startupErrorMessage.trim()}`
        : "Failed to start local NetHack runtime";
      console.error("Failed to start local NetHack runtime:", error);
      this.systems.promptDialogs.updateConnectionStatus("Error", "error");
      this.systems.promptDialogs.updateStatus("Failed to start local NetHack runtime");
      this.systems.engineMessages.addGameMessage(startupFailureMessage);
      // Drop the startup overlay on failure so the underlying error UI stays
      // readable instead of leaving the app blurred behind the loading state.
      this.systems.promptDialogs.setLoadingVisible(false);
    }
  }

  private handleRuntimeEvent(event: RuntimeEvent): void {
    if (this.systems.engineState.disposed) {
      return;
    }
    const data = event as RuntimeEvent & Record<string, any>;
    switch (data.type) {
      case "map_glyph":
        this.systems.runtimeEntityTracking.updateRuntimeMonsterTrackingFromTile(data);
        this.systems.levelTerrainCache.capturePendingLevelTransitionTile(data);
        this.systems.levelTerrainCache.maybeFinalizePendingLevelCacheTransition("tile");
        this.systems.combatAttribution.tryResolvePendingCharacterDamage(data);
        this.systems.tileUpdates.enqueueTileUpdate(data);
        break;

      case "map_glyph_batch":
        if (Array.isArray(data.tiles)) {
          this.systems.levelTerrainCache.capturePendingLevelTransitionTiles(data.tiles);
          this.systems.levelTerrainCache.maybeFinalizePendingLevelCacheTransition("tile");
          for (const tile of data.tiles) {
            this.systems.runtimeEntityTracking.updateRuntimeMonsterTrackingFromTile(tile);
            this.systems.combatAttribution.tryResolvePendingCharacterDamage(tile);
            this.systems.tileUpdates.enqueueTileUpdate(tile);
          }
        }
        break;

      case "monster_attack": {
        const targetEntityId = this.systems.runtimeEntityTracking.normalizeRuntimeTargetEntityId(
          data.targetId,
        );
        const fallbackTargetTile =
          typeof data.targetX === "number" &&
          Number.isFinite(data.targetX) &&
          typeof data.targetY === "number" &&
          Number.isFinite(data.targetY)
            ? {
                x: Math.trunc(data.targetX),
                y: Math.trunc(data.targetY),
              }
            : null;
        const targetTile =
          targetEntityId === 0
            ? { x: this.systems.playerMovement.playerPos.x, y: this.systems.playerMovement.playerPos.y }
            : targetEntityId !== null
              ? (this.systems.runtimeEntityTracking.resolveRuntimeMonsterEffectTileById(targetEntityId) ??
                fallbackTargetTile)
              : fallbackTargetTile;
        const attackDirection = this.systems.combatAttribution.resolveDamageEffectDirectionFromTiles(
          this.systems.runtimeEntityTracking.resolveRuntimeEffectOriginTileByEntityId(data.attackerId),
          targetTile,
        );
        if (targetTile) {
          this.systems.combatAttribution.triggerDamageEffectsAtTile(
            targetTile.x,
            targetTile.y,
            1,
            "hit",
            attackDirection
              ? {
                  directionX: attackDirection.x,
                  directionY: attackDirection.y,
                }
              : {},
          );
        }
        break;
      }

      case "monster_killed": {
        const defeatedMonsterId = this.systems.runtimeEntityTracking.normalizeRuntimeMonsterId(
          data.monsterId,
        );
        this.systems.runTelemetry.recordRunKillTelemetryFromRuntimeEvent(data.killerId);
        const fallbackTargetTile =
          typeof data.x === "number" &&
          Number.isFinite(data.x) &&
          typeof data.y === "number" &&
          Number.isFinite(data.y)
            ? { x: Math.trunc(data.x), y: Math.trunc(data.y) }
            : null;
        const targetTile =
          this.systems.runtimeEntityTracking.resolveRuntimeMonsterEffectTileById(data.monsterId) ??
          fallbackTargetTile;
        const defeatDirection = this.systems.combatAttribution.resolveDamageEffectDirectionFromTiles(
          this.systems.runtimeEntityTracking.resolveRuntimeEffectOriginTileByEntityId(data.killerId),
          targetTile,
        );
        this.systems.combatAttribution.suppressMonsterKillMessageHeuristics();
        if (targetTile) {
          this.systems.combatAttribution.triggerDamageEffectsAtTile(
            targetTile.x,
            targetTile.y,
            1,
            "defeat",
            defeatDirection
              ? {
                  directionX: defeatDirection.x,
                  directionY: defeatDirection.y,
                  billboardShatter: {
                    runtimeMonsterId: defeatedMonsterId,
                  },
                }
              : defeatedMonsterId !== null
                ? {
                    billboardShatter: {
                      runtimeMonsterId: defeatedMonsterId,
                    },
                  }
                : {},
          );
        }
        if (this.systems.runtimeEntityTracking.normalizeRuntimeTargetEntityId(data.killerId) !== 0) {
          this.systems.audioHapticsPlatform.messageSoundHooks.playOtherMonsterKilledSound();
        }
        this.systems.runtimeEntityTracking.removeRuntimeMonsterTrackingById(data.monsterId);
        this.systems.runtimeEntityTracking.forgetRuntimeMonsterLastSeenStateById(data.monsterId);
        break;
      }

      case "under_player_item_glyph":
        this.systems.worldClassification.applyUnderPlayerItemGlyphEvent(data);
        break;

      case "under_player_item_glyph_cleared":
        this.systems.worldClassification.clearUnderPlayerItemGlyphEvent(data);
        break;

      case "confirmed_boulder_push":
        this.systems.entityMovement.startConfirmedBoulderPushTransition(data);
        break;

      case "inventory_updated_signal":
        // Inventory mutation is a strong signal that floor stack order at the
        // player tile may have changed (pickup/drop/eat/use from floor).
        this.systems.tileUpdates.requestPlayerTileRefresh("inventory-updated-signal");
        if (this.systems.movementInput.isFpsMode() && !this.systems.promptDialogs.pendingStartupInventoryRefresh) {
          this.systems.promptDialogs.requestSilentInventoryRefresh("inventory-updated-signal");
        }
        break;

      case "travel_step_delay":
        if (
          typeof data.delayMs === "number" &&
          Number.isFinite(data.delayMs) &&
          data.delayMs >= 0
        ) {
          this.systems.camera.runtimeTravelStepDelayMs = Math.trunc(data.delayMs);
        }
        break;

      case "player_position":
        if (this.systems.positionSelection.positionInputModeActive) {
          console.log(
            `🎯 Ignoring player_position (${data.x}, ${data.y}) while position-input mode is active`,
          );
          break;
        }
        console.log(
          `🎯 Received player position update: (${data.x}, ${data.y})`,
        );
        this.systems.fpsDiagnostics.logAsciiPlayerTileDebug(
          "player_position_received",
          data.x,
          data.y,
          {
            oldPlayerPos: { ...this.systems.playerMovement.playerPos },
            hasSeenPlayerPosition: this.systems.playerMovement.hasSeenPlayerPosition,
            playMode: this.systems.engineState.playMode,
            tilesetMode: this.systems.engineState.clientOptions.tilesetMode,
          },
        );
        this.systems.levelTerrainCache.handlePendingLevelTransitionPlayerPosition(data.x, data.y);
        const oldPos = { ...this.systems.playerMovement.playerPos };
        this.systems.playerMovement.fpsPredictedPlayerTile = null;
        this.systems.playerMovement.asciiPendingPlayerTile = null;
        this.systems.audioHapticsPlatform.playPlayerFootstepSoundFromCliparoundIfEligible(
          oldPos.x,
          oldPos.y,
          data.x,
          data.y,
        );
        this.systems.darkCorridorInference.pendingBoulderPushDarkCorridorInference =
          oldPos.x !== data.x || oldPos.y !== data.y
            ? this.systems.darkCorridorInference.buildBoulderPushDarkCorridorInferenceContext(
                oldPos.x,
                oldPos.y,
                data.x,
                data.y,
              )
            : null;
        this.systems.playerMovement.recordPlayerMovement(oldPos.x, oldPos.y, data.x, data.y);
        if (oldPos.x !== data.x || oldPos.y !== data.y) {
          this.systems.movementInput.refreshPlayerCliparoundInputCooldownFromMovement();
        }
        this.systems.playerMovement.playerPos = { x: data.x, y: data.y };
        this.systems.entityMovement.finalizeHeldPlayerMoveTransitionIfConfirmed(data.x, data.y);
        this.systems.fpsDiagnostics.logAsciiPlayerTileDebug(
          "player_position_applied",
          data.x,
          data.y,
          {
            oldPos,
            newPos: { ...this.systems.playerMovement.playerPos },
            hasSeenPlayerPosition: this.systems.playerMovement.hasSeenPlayerPosition,
          },
        );
        if (oldPos.x !== data.x || oldPos.y !== data.y) {
          this.systems.inputCommands.clearAutomaticGlancePendingState();
        }
        const didMove = oldPos.x !== data.x || oldPos.y !== data.y;
        if (didMove) {
          this.systems.tileContextActions.closeAnyTileContextMenu(false);
        }
        this.systems.tileUpdates.flushPendingTileUpdatesForPlayerPositionReconcile();
        this.systems.tileUpdates.refreshTilesAfterPlayerPositionUpdate(
          oldPos.x,
          oldPos.y,
          data.x,
          data.y,
        );
        if (
          didMove &&
          this.systems.worldClassification.shouldShowUnderPlayerFeaturesInOverheadTilesMode()
        ) {
          this.systems.tileUpdates.requestPlayerTileRefresh("overhead-under-player-move");
        }
        this.systems.darkCorridorInference.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
        if (this.systems.movementInput.isFpsMode()) {
          const playerTileKey = `${data.x},${data.y}`;
          const shouldKeepPlayerTileBillboard =
            this.systems.worldClassification.getFpsPlayerTileBillboardBehaviorFromCache(playerTileKey) !==
              null || this.systems.tileUpdates.shouldKeepFarLookPlayerBillboardVisible();
          if (!shouldKeepPlayerTileBillboard) {
            this.systems.entityBillboards.removeMonsterBillboard(playerTileKey);
          }
        }
        this.systems.lighting.markLightingDirty();
        console.log(
          `🎯 Player position changed from (${oldPos.x}, ${oldPos.y}) to (${data.x}, ${data.y})`,
        );
        this.systems.promptDialogs.updateStatus(`Player at (${data.x}, ${data.y}) - NetHack 3D`);
        if (this.systems.tileUpdates.pendingPlayerTileRefreshOnNextPosition) {
          this.systems.tileUpdates.pendingPlayerTileRefreshOnNextPosition = false;
          this.systems.tileUpdates.requestPlayerTileRefresh("player-position-sync");
        }
        break;

      case "position_input_state":
        this.systems.positionSelection.setPositionInputMode(
          Boolean(data.active),
          typeof data.origin === "string" ? data.origin : null,
        );
        break;

      case "position_cursor":
        if (typeof data.x === "number" && typeof data.y === "number") {
          this.systems.positionSelection.setPositionCursorPosition(data.x, data.y);
        }
        break;

      case "map_cursor":
        if (typeof data.x === "number" && typeof data.y === "number") {
          const previousAsciiPendingPlayerTile =
            this.systems.playerMovement.getActiveAsciiPendingPlayerTile(Date.now());
          this.systems.playerMovement.updateFpsPredictedPlayerTileFromMapCursorHint(data.x, data.y);
          this.systems.playerMovement.updateAsciiPendingPlayerTileFromMapCursorHint(data.x, data.y);
          this.systems.tileUpdates.refreshAsciiPlayerTilesForCursorHint(
            data.x,
            data.y,
            previousAsciiPendingPlayerTile,
          );
        }
        break;

      case "text":
        if (this.systems.inputCommands.shouldSkipMobileFpsClickLookPromptMessageEvent(data.text)) {
          break;
        }
        this.systems.playerStatus.captureAutopickupStateFromMessage(data.text);
        this.systems.runTelemetry.captureRunTelemetryFromMessage(data.text);
        this.systems.worldClassification.capturePlayerTileTerrainInvalidationFromMessage(data.text);
        this.systems.tileContextActions.captureFpsCrosshairGlanceMessage(data.text);
        this.systems.combatAttribution.captureFpsHeldWeaponSwipeFromCombatMessage(data.text);
        {
          const playerKillHandled = this.systems.combatAttribution.captureMonsterDefeatFromMessage(
            data.text,
          );
          this.systems.combatAttribution.captureOtherMonsterKilledSoundFromMessage(
            data.text,
            playerKillHandled,
          );
        }
        this.systems.combatAttribution.captureDamageFromMessage(data.text);
        this.systems.engineMessages.addGameMessage(data.text);
        break;

      case "raw_print":
        if (this.systems.inputCommands.shouldSkipMobileFpsClickLookPromptMessageEvent(data.text)) {
          break;
        }
        this.systems.playerStatus.captureAutopickupStateFromMessage(data.text);
        this.systems.runTelemetry.captureRunTelemetryFromMessage(data.text);
        this.systems.worldClassification.capturePlayerTileTerrainInvalidationFromMessage(data.text);
        this.systems.tileContextActions.captureFpsCrosshairGlanceMessage(data.text);
        this.systems.combatAttribution.captureFpsHeldWeaponSwipeFromCombatMessage(data.text);
        {
          const playerKillHandled = this.systems.combatAttribution.captureMonsterDefeatFromMessage(
            data.text,
          );
          this.systems.combatAttribution.captureOtherMonsterKilledSoundFromMessage(
            data.text,
            playerKillHandled,
          );
        }
        this.systems.combatAttribution.captureDamageFromMessage(data.text);
        this.systems.engineMessages.addGameMessage(data.text);
        break;

      case "menu_item":
        // Menu rows are accumulated and delivered with question/inventory events.
        // Ignore incremental item updates to avoid noisy unknown-type logs.
        break;

      case "direction_question":
        {
          const repeatCandidate = this.systems.inputCommands.consumeRepeatDirectionCandidate();
          if (repeatCandidate) {
            this.systems.inputCommands.armRepeatableAction(repeatCandidate);
          }
        }
        if (this.systems.inputCommands.tryAutoAnswerDirectionQuestionFromFpsContextAction()) {
          break;
        }
        if (this.systems.inputCommands.tryAutoAnswerDirectionQuestionFromRepeat()) {
          break;
        }
        if (this.systems.inputCommands.shouldCloseInventoryForPendingContextPrompt()) {
          this.systems.promptDialogs.hideInventoryDialog();
        }
        // Special handling for direction questions - show UI and pause movement
        this.systems.directionPrompts.showDirectionQuestion(data.text);
        break;
      case "number_pad_mode":
        this.systems.inputCommands.setNumberPadModeEnabled(Boolean(data.enabled));
        break;

      case "question":
        this.systems.inputCommands.repeatAutoDirectionPending = false;
        this.systems.inputCommands.repeatAutoDirectionArmedAtMs = 0;
        this.systems.inputCommands.clearRepeatDirectionCandidate();
        this.systems.inputCommands.skipNextMobileFpsClickLookPromptMessage = false;
        if (this.systems.inputCommands.shouldCloseInventoryForPendingContextPrompt()) {
          this.systems.promptDialogs.hideInventoryDialog();
        }
        const isGameOverPossessionsQuestion =
          this.systems.gameOver.isGameOverPossessionsIdentifyQuestion(String(data.text || ""));
        if (isGameOverPossessionsQuestion) {
          this.systems.gameOver.setGameOverState(true, null);
        }
        if (this.systems.questionMenus.isCharacterCreationQuestion(String(data.text || ""))) {
          const payload = this.systems.questionMenus.toCharacterCreationQuestionPayload(data);
          this.systems.questionMenus.isInQuestion = true;
          this.systems.questionMenus.showQuestion(
            payload.text,
            payload.choices,
            payload.defaultChoice,
            payload.menuItems,
          );
          return;
        }

        // For non-character creation questions, show normal dialog and pause movement
        if (isGameOverPossessionsQuestion && this.systems.gameOver.isGameOverUiRevealBlocked()) {
          this.systems.gameOver.deferredGameOverQuestionState = {
            question: String(data.text || ""),
            choices: String(data.choices || ""),
            defaultChoice: String(data.default || ""),
            menuItems: Array.isArray(data.menuItems) ? data.menuItems : [],
          };
          this.systems.gameOver.scheduleGameOverUiRevealFlush();
          break;
        }
        this.systems.questionMenus.isInQuestion = true;
        this.systems.questionMenus.showQuestion(
          data.text,
          data.choices,
          data.default,
          data.menuItems,
        );
        break;

      case "text_request":
        this.systems.inputCommands.repeatAutoDirectionPending = false;
        this.systems.inputCommands.repeatAutoDirectionArmedAtMs = 0;
        this.systems.inputCommands.clearRepeatDirectionCandidate();
        this.systems.inputCommands.skipNextMobileFpsClickLookPromptMessage = false;
        if (this.systems.inputCommands.shouldCloseInventoryForPendingContextPrompt()) {
          this.systems.promptDialogs.hideInventoryDialog();
        }
        this.systems.promptDialogs.showTextInputRequest(
          String(data.text || ""),
          typeof data.maxLength === "number" ? data.maxLength : 256,
          typeof data.contextMessage === "string" ? data.contextMessage : "",
        );
        break;

      case "inventory_update":
        // Handle inventory updates without showing dialog
        const nextInventory = this.systems.menuPreviews.normalizeMenuItemsForUi(data.items);
        this.systems.promptDialogs.inventoryRefreshInFlight = false;
        const itemCount = nextInventory.length;
        const actualItems = nextInventory.filter(
          (item: any) => !item.isCategory,
        );
        if (actualItems.length > 0) {
          this.systems.promptDialogs.pendingStartupInventoryRefresh = false;
        }
        console.log(
          `📦 Received inventory update with ${itemCount} total items (${actualItems.length} actual items)`,
        );

        // Replace current inventory state with latest snapshot.
        this.systems.promptDialogs.currentInventory = nextInventory;

        // If we have a pending inventory dialog request, show it now
        if (this.systems.promptDialogs.pendingInventoryDialog) {
          console.log("📦 Showing inventory dialog with fresh data");
          this.systems.promptDialogs.pendingInventoryDialog = false;
          const pendingDialogOptions = this.systems.promptDialogs.pendingInventoryDialogOptions;
          this.systems.promptDialogs.pendingInventoryDialogOptions = null;
          this.systems.promptDialogs.showInventoryDialog(pendingDialogOptions ?? undefined);
        } else if (
          this.systems.gameOver.gameOverState.active &&
          !this.systems.promptDialogs.isInventoryDialogVisible
        ) {
          const gameOverInventoryOptions = {
            contextActionsEnabled: false,
          };
          if (this.systems.gameOver.isGameOverUiRevealBlocked()) {
            this.systems.gameOver.deferredGameOverInventoryDialogOptions =
              gameOverInventoryOptions;
            this.systems.gameOver.scheduleGameOverUiRevealFlush();
          } else {
            this.systems.promptDialogs.showInventoryDialog(gameOverInventoryOptions);
          }
        }

        // Update inventory display if we have an inventory UI element
        this.systems.promptDialogs.updateInventoryDisplay(nextInventory);

        break;

      case "info_menu":
        console.log("Received info_menu event from runtime", {
          title: data.title,
          lineCount: Array.isArray(data.lines) ? data.lines.length : 0,
          source: data.source,
        });
        const normalizedInfoMenu = {
          title: String(data.title || "NetHack Information"),
          lines: this.systems.promptDialogs.normalizeInfoMenuLines(data.lines),
        };
        const postmortemReportKind = this.systems.gameOver.gameOverState.active
          ? (this.systems.gameOver.pendingSuppressedGameOverReportKind ??
            this.systems.gameOver.resolveGameOverPostmortemReportKindFromInfoMenu(
              normalizedInfoMenu.title,
              normalizedInfoMenu.lines,
            ))
          : null;
        if (postmortemReportKind) {
          const shouldSuppressPostmortemReportDisplay =
            this.systems.gameOver.pendingSuppressedGameOverReportKind !== null;
          this.systems.gameOver.captureGameOverPostmortemReport(
            postmortemReportKind,
            normalizedInfoMenu.title,
            normalizedInfoMenu.lines,
          );
          if (shouldSuppressPostmortemReportDisplay) {
            if (Boolean(data.blocking) && this.systems.engineState.session) {
              this.systems.engineState.session.sendInput(" ");
            }
            this.systems.gameOver.fulfillDeferredGameOverPromptReadyIfPossible();
            break;
          }
        }
        const infoMenuSource =
          typeof data.source === "string" ? data.source : "";
        const shouldRefreshCtrlMCache =
          infoMenuSource !== "doprev_message" &&
          this.systems.promptDialogs.isNetHackMessageInfoMenuTitle(normalizedInfoMenu.title);
        if (shouldRefreshCtrlMCache) {
          this.systems.promptDialogs.lastMessageInfoMenu = normalizedInfoMenu;
        }
        this.systems.promptDialogs.showInfoMenuDialog(
          normalizedInfoMenu.title,
          this.systems.promptDialogs.isNetHackMessageInfoMenuTitle(normalizedInfoMenu.title)
            ? normalizedInfoMenu.lines.filter(
                (line) => !this.systems.promptDialogs.isNetHackMessageInfoMenuTitle(line),
              )
            : normalizedInfoMenu.lines,
          {
            blocking: Boolean(data.blocking),
          },
        );
        break;

      case "position_request":
        // Only show meaningful position requests, filter out spam
        if (
          data.text &&
          data.text.trim() &&
          !data.text.includes("cursor") &&
          !data.text.includes("Select a position")
        ) {
          this.systems.positionSelection.showPositionRequest(data.text);
        }
        break;

      case "name_request":
        // Runtime handles askname with startup-configured fallback to avoid
        // feedback loops from repeated async name_request events.
        console.log("Name request received from runtime:", data);
        break;

      case "extended_commands":
        this.systems.extendedCommands.availableExtendedCommands = this.systems.extendedCommands.normalizeRuntimeExtendedCommands(
          data.commands,
        );
        this.systems.engineState.uiAdapter.setExtendedCommands([...this.systems.extendedCommands.availableExtendedCommands]);
        if (this.systems.extendedCommands.metaCommandModeActive) {
          this.systems.extendedCommands.updateMetaCommandSuggestionsState();
          this.systems.extendedCommands.updateMetaCommandModal();
        }
        break;

      case "area_refresh_complete":
        console.log(
          `🔄 Area refresh completed: ${data.tilesRefreshed} tiles refreshed around (${data.centerX}, ${data.centerY})`,
        );
        this.systems.engineMessages.addGameMessage(
          `Refreshed ${data.tilesRefreshed} tiles around (${data.centerX}, ${data.centerY})`,
        );
        break;

      case "tile_not_found":
        console.log(
          `⚠️ Tile not found at (${data.x}, ${data.y}): ${data.message}`,
        );
        break;

      case "clear_scene":
        console.log("🧹 Clearing 3D scene for level transition");
        this.systems.levelTerrainCache.persistActiveLevelTerrainCache();
        this.systems.levelTerrainCache.beginPendingLevelCacheTransition();
        this.clearScene();
        this.systems.tileUpdates.pendingPlayerTileRefreshOnNextPosition = true;
        if (data.message) {
          this.systems.engineMessages.addGameMessage(data.message);
        }
        break;

      case "status_update":
        console.log(
          `Status update: ${data.fieldName || data.field} = "${data.value}" (type=${data.valueType || "unknown"})`,
        );
        this.systems.playerStatus.updatePlayerStats(data.field, data.value, data);
        break;

      case "runtime_globals_snapshot":
        this.systems.playerStatus.applyRuntimeGlobalsSnapshot(data.snapshot);
        break;
      case "runtime_object_tile_map":
        this.systems.playerStatus.applyRuntimeObjectTileIndexByObjectId(
          data.objectTileIndexByObjectId,
        );
        break;

      case "damage_event":
        if (
          typeof data.x === "number" &&
          typeof data.y === "number" &&
          typeof data.amount === "number"
        ) {
          this.systems.combatAttribution.triggerDamageEffectsAtTile(data.x, data.y, data.amount);
        }
        break;

      case "game_over_started":
        this.systems.combatAttribution.triggerPlayerDeathEffects();
        this.systems.gameOver.armGameOverUiRevealDelay();
        break;

      case "game_over_complete":
        const shouldDeferPromptReady = this.systems.promptDialogs.infoMenuBlockingActive;
        const deathMessage =
          typeof data.deathMessage === "string" ? data.deathMessage : null;
        const tombstoneLines = Array.isArray(data.tombstoneLines)
          ? (data.tombstoneLines as string[])
          : null;
        if (this.systems.gameOver.isGameOverUiRevealBlocked()) {
          this.systems.gameOver.deferredGameOverCompletionState = {
            deathMessage,
            tombstoneLines,
            shouldDeferPromptReady,
          };
          this.systems.gameOver.setGameOverState(true, deathMessage, {
            promptReady: false,
            tombstoneLines,
          });
          this.systems.gameOver.scheduleGameOverUiRevealFlush();
          break;
        }
        this.systems.gameOver.pendingGameOverPromptReady = shouldDeferPromptReady;
        this.systems.gameOver.setGameOverState(true, deathMessage, {
          promptReady: shouldDeferPromptReady ? false : true,
          tombstoneLines,
        });
        break;

      case "runtime_terminated":
        this.systems.promptDialogs.handleRuntimeTermination(
          typeof data.reason === "string" ? data.reason : "",
        );
        break;

      case "runtime_error":
        this.systems.promptDialogs.handleRuntimeError(
          typeof data.error === "string" ? data.error : "",
        );
        break;

      default:
        console.log("Unknown message type:", data.type, data);
    }
  }

  private clearScene(): void {
    this.systems.combatAttribution.clearDamageEffects();
    this.systems.bloodGround.disposeBloodGroundOverlayResources();
    this.systems.tilesetAssets.vultureTilesetTranslator?.resetRuntimeMapState();
    this.systems.vultureWalls.pendingVultureRoomDecorReconcileKeys.clear();
    this.systems.vultureWalls.vultureRoomDecorReconcileScheduled = false;
    // Keep last-known status baselines across scene clears so status deltas
    // (damage numbers, AC/stat change text) are not dropped after map redraws.
    this.systems.tileUpdates.pendingPlayerTileRefreshOnNextPosition = true;
    this.systems.lighting.lightingCenterInitialized = false;
    this.systems.positionSelection.positionInputModeActive = false;
    this.systems.engineState.uiAdapter.setPositionInputActive(false);
    this.systems.positionSelection.hasRuntimePositionCursor = false;
    this.systems.camera.fpsPositionCursorOrbitYaw = 0;
    this.systems.camera.fpsPositionCursorOrbitPitch = 0;
    this.systems.positionSelection.clearPositionCursor();
    console.log("🧹 Clearing all tiles and glyph overlays from 3D scene");

    // Clear all tile meshes
    this.systems.tileRendering.tileMap.forEach((mesh) => {
      this.systems.terminalRendering.releaseTerminalCellVisualFromMesh(mesh);
      this.systems.wallOverlays.disposeWallSideTileOverlay(mesh);
      this.systems.wallOverlays.disposeVultureWallFaceOverlay(mesh);
      this.systems.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
      this.systems.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
      this.systems.wallOverlays.disposeTransparentWallGroundPlaneOverlay(mesh);
      this.systems.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
      this.systems.renderPipeline.scene.remove(mesh);
    });
    this.systems.tileRendering.tileMap.clear();
    this.systems.floorOcclusion.clearFloorBlockAmbientOcclusion();
    this.systems.wallGeometry.fpsWallChamferFloorMeshes.forEach((mesh) => {
      this.systems.renderPipeline.scene.remove(mesh);
    });
    this.systems.wallGeometry.fpsWallChamferFloorMeshes.clear();
    this.systems.wallGeometry.clearFpsWallChamferMaterialCaches();

    for (const key of Array.from(this.systems.entityBillboards.monsterBillboards.keys())) {
      this.systems.entityBillboards.removeMonsterBillboard(key);
    }
    for (const entry of this.systems.entityBillboards.monsterBillboardTextures.values()) {
      entry.texture.dispose();
    }
    this.systems.entityBillboards.monsterBillboardTextures.clear();
    this.systems.runtimeEntityTracking.runtimeTrackedPlayerEntitySeen = false;
    this.systems.minimap.minimapTrackedPlayerTileKey = null;
    this.systems.camera.normalModePlayerMoveCameraFollowActive = false;
    this.systems.runtimeEntityTracking.runtimeMonsterTileKeyById.clear();
    this.systems.runtimeEntityTracking.runtimeMonsterIdByTileKey.clear();
    this.systems.runtimeEntityTracking.pendingRuntimeMonsterVacatedTileKeyById.clear();
    this.systems.runtimeEntityTracking.runtimeMonsterLastSeenStateById.clear();
    this.systems.entityMovement.clearEntityMoveTransitions();
    if (this.systems.entityBillboards.entityBlobShadowTexture) {
      this.systems.entityBillboards.entityBlobShadowTexture.dispose();
      this.systems.entityBillboards.entityBlobShadowTexture = null;
    }
    this.systems.entityBillboards.entityBlobShadows.clear();

    if (this.systems.aimHighlights.fpsForwardHighlight) {
      this.systems.renderPipeline.scene.remove(this.systems.aimHighlights.fpsForwardHighlight);
      this.systems.aimHighlights.fpsForwardHighlight.geometry.dispose();
      this.systems.aimHighlights.fpsForwardHighlightMaterial?.dispose();
      this.systems.aimHighlights.fpsForwardHighlight = null;
      this.systems.aimHighlights.fpsForwardHighlightMaterial = null;
    }
    if (this.systems.aimHighlights.fpsForwardHighlightTexture) {
      this.systems.aimHighlights.fpsForwardHighlightTexture.dispose();
      this.systems.aimHighlights.fpsForwardHighlightTexture = null;
    }
    this.systems.heldWeapon.clearFpsHeldWeaponVisual();
    this.systems.aimHighlights.fpsAimLinePulseUntilMs = 0;
    this.systems.movementInput.fpsFireSuppressionUntilMs = 0;
    this.systems.camera.fpsStepCameraActive = false;
    this.systems.camera.fpsStepCameraDurationMs = this.systems.camera.fpsStepCameraBaseDurationMs;
    this.systems.camera.fpsStepCameraTargetTile = null;
    this.systems.playerMovement.fpsPredictedPlayerTile = null;
    this.systems.playerMovement.asciiPendingPlayerTile = null;
    this.systems.camera.lastManualDirectionalInputAtMs = 0;
    this.systems.camera.lastRunLikeInputAtMs = 0;
    this.systems.camera.fpsAutoMoveDirection = null;
    this.systems.camera.fpsAutoTurnTargetYaw = null;
    this.systems.playerMovement.fpsRecentPlayerTilesForSuppression = [];
    this.systems.playerMovement.fpsLastPlayerMoveFromTile = null;
    this.systems.fpsDiagnostics.asciiPlayerTileDebugLastLogAtByKey.clear();
    this.systems.pointerLock.fpsPointerLockRestorePending = false;
    this.systems.tileContextActions.fpsCrosshairContextMenuOpen = false;
    this.systems.tileContextActions.fpsCrosshairContextSignature = "";
    this.systems.tileContextActions.normalTileContextMenuOpen = false;
    this.systems.tileContextActions.normalTileContextSignature = "";
    this.systems.tileContextActions.normalTileContextTarget = null;
    this.systems.tileContextActions.selectedContextHighlightTile = null;
    this.systems.tileContextActions.vultureMouseHoverHighlightTile = null;
    this.systems.tileContextActions.fpsCrosshairGlanceCache.clear();
    this.systems.tileContextActions.fpsCrosshairGlanceAttemptedKeys.clear();
    this.systems.tileContextActions.fpsCrosshairGlanceIssuedThisOpen = false;
    this.systems.inputCommands.clearAutomaticGlancePendingState();
    this.systems.engineState.uiAdapter.setFpsCrosshairContext(null);
    this.systems.touchInput.clearMapTouchContextHoldTimer();
    this.systems.touchInput.mapTouchContextHoldState = null;

    // Clear glyph overlays and dispose textures/materials
    this.systems.glyphTextures.glyphOverlayMap.forEach((overlay) => {
      this.systems.glyphTextures.disposeGlyphOverlay(overlay);
    });
    this.systems.glyphTextures.glyphOverlayMap.clear();
    this.systems.tileMaterials.inferredDarkWallSolidColorMaterialCache.forEach((entry) => {
      entry.material.dispose();
      entry.texture?.dispose();
    });
    this.systems.tileMaterials.inferredDarkWallSolidColorMaterialCache.clear();
    this.systems.glyphTextures.glyphTextureCache.forEach(({ texture }) => texture.dispose());
    this.systems.glyphTextures.glyphTextureCache.clear();
    this.systems.lighting.disposeLightingOverlay();
    this.systems.tileUpdates.tileStateCache.clear();
    this.systems.combatAttribution.runtimeMonsterKillHeuristicSuppressionUntilMs = 0;
    this.systems.runtimeEntityTracking.runtimeTrackedPlayerEntitySeen = false;
    this.systems.camera.normalModePlayerMoveCameraFollowActive = false;
    this.systems.levelTerrainCache.lastKnownTerrain.clear();
    this.systems.runtimeEntityTracking.pendingRuntimeMonsterVacatedTileKeyById.clear();
    this.systems.worldClassification.flatFeatureUnderPlayerCache.clear();
    this.systems.worldClassification.suppressedLootLikeUnderPlayerCacheKeys.clear();
    this.systems.darkCorridorInference.inferredDarkCorridorWallTiles.clear();
    this.systems.darkCorridorInference.inferredDarkCorridorTileFlags.clear();
    this.systems.darkCorridorInference.pendingBoulderPushDarkCorridorInference = null;
    this.systems.darkCorridorInference.darkCorridorInputDiscoveryWindowActive = false;
    this.systems.darkCorridorInference.darkCorridorBlindSearchInferenceActive = false;
    this.systems.darkCorridorInference.darkCorridorBlindSearchInferenceUntilMs = 0;
    this.systems.darkCorridorInference.newlyDiscoveredDarkCorridorTilesForCurrentInput.clear();
    this.systems.tileRendering.activeEffectTileKeys.clear();
    this.systems.tileUpdates.clearAllTileRefreshRetryPlans();
    this.systems.tileUpdates.pendingTileUpdates.clear();
    this.systems.tileUpdates.pendingTileFlushQueue = [];
    this.systems.tileUpdates.pendingTileFlushQueueIndex = 0;
    this.systems.tileUpdates.tileFlushScheduled = false;
    this.systems.vultureWalls.pendingVultureWallMaterialRefreshKeys.clear();
    this.systems.vultureWalls.vultureWallMaterialRefreshScheduled = false;
    this.systems.wallOverlays.vultureDoorPlaneOverlayMeshes.clear();
    this.systems.wallOverlays.ironBarsWallPlaneOverlayMeshes.clear();
    this.systems.minimap.resetMinimap();
    this.systems.lighting.markLightingDirty();

    console.log("🧹 Scene cleared - ready for new level");
  }

  public dispose(): void {
    if (this.systems.engineState.disposed) {
      return;
    }
    this.systems.engineState.disposed = true;
    this.systems.renderPipeline.renderer.setAnimationLoop(null);
    this.systems.webXrPresentation.dispose();
    this.systems.questSceneExport.dispose();
    this.systems.minimap.setTerminalGutterMinimapState(false, false);

    if (this.systems.engineState.animationFrameId !== null) {
      cancelAnimationFrame(this.systems.engineState.animationFrameId);
      this.systems.engineState.animationFrameId = null;
    }
    this.systems.engineState.domEventAbortController.abort();
    if (this.systems.positionSelection.positionHideTimerId !== null) {
      window.clearTimeout(this.systems.positionSelection.positionHideTimerId);
      this.systems.positionSelection.positionHideTimerId = null;
    }
    if (this.systems.touchInput.fpsTouchRunButtonHoldTimerId !== null) {
      window.clearTimeout(this.systems.touchInput.fpsTouchRunButtonHoldTimerId);
      this.systems.touchInput.fpsTouchRunButtonHoldTimerId = null;
    }
    if (this.systems.minimap.minimapActionRailSyncRafId !== null) {
      window.cancelAnimationFrame(this.systems.minimap.minimapActionRailSyncRafId);
      this.systems.minimap.minimapActionRailSyncRafId = null;
    }
    this.systems.gameOver.clearGameOverUiRevealDelayState();
    this.systems.touchInput.clearMapTouchContextHoldTimer();
    this.systems.minimap.stopMinimapDrag();
    this.systems.controllerDialogs.resetControllerVirtualCursor();
    this.systems.extendedCommands.exitMetaCommandMode();
    this.systems.questionMenus.hideQuestion();
    this.systems.directionPrompts.hideDirectionQuestion();
    this.systems.promptDialogs.hideTextInputRequest();
    this.systems.promptDialogs.hideInventoryDialog();
    this.systems.promptDialogs.hideInfoMenuDialog();
    this.systems.tileContextActions.closeAnyTileContextMenu(false);
    this.systems.engineState.uiAdapter.setPositionRequest(null);
    this.systems.engineState.uiAdapter.setPositionInputActive(false);
    this.systems.engineState.uiAdapter.setRepeatActionVisible(false);
    this.systems.engineState.uiAdapter.setFpsCrosshairContext(null);
    this.systems.engineState.uiAdapter.setNewGamePrompt({ visible: false, reason: null });
    this.systems.engineState.uiAdapter.setGameOver({
      active: false,
      deathMessage: null,
      promptReady: false,
      tombstoneLines: null,
      postmortemReports: createEmptyGameOverPostmortemReports(),
      telemetry: createEmptyRunTelemetrySnapshot(),
    });
    this.systems.promptDialogs.updateStatus("");
    this.systems.promptDialogs.updateConnectionStatus("Disconnected", "disconnected");
    this.systems.promptDialogs.setLoadingVisible(false);
    this.clearScene();
    this.systems.terminalRendering.disposeAllTerminalCellVisuals();

    this.systems.engineState.session?.dispose();
    this.systems.engineState.session = null;
    this.systems.audioHapticsPlatform.messageSoundHooks.dispose();
    this.systems.audioHapticsPlatform.clearPendingIncomingDamageRumble();
    this.systems.audioHapticsPlatform.webHaptics?.destroy();
    this.systems.audioHapticsPlatform.webHaptics = null;
    this.systems.audioHapticsPlatform.fmodRuntime.dispose();

    this.systems.directionPrompts.directionPromptOverlay?.dispose();
    this.systems.directionPrompts.directionPromptOverlay = null;

    this.systems.minimap.minimapContainer?.remove();
    this.systems.minimap.minimapContainer = null;
    this.systems.minimap.minimapCanvasContext = null;
    this.systems.minimap.minimapViewportContext = null;
    this.systems.fpsDiagnostics.removeFpsDebugDisplay();
    this.systems.heldWeaponAnimationDebug.removeFpsHeldWeaponAnimationDebugPanel();

    this.systems.extendedCommands.metaCommandModal?.remove();
    this.systems.extendedCommands.metaCommandModal = null;
    this.systems.extendedCommands.metaCommandInputTextElement = null;
    this.systems.extendedCommands.metaCommandInputGhostElement = null;
    this.systems.extendedCommands.metaCommandInputGhostTypedElement = null;
    this.systems.extendedCommands.metaCommandInputGhostSuffixElement = null;
    this.systems.extendedCommands.metaCommandSuggestionsElement = null;

    this.systems.controllerDialogs.controllerVirtualCursorElement?.remove();
    this.systems.controllerDialogs.controllerVirtualCursorElement = null;
    this.systems.controllerDialogs.controllerVirtualCursorPulseElement?.remove();
    this.systems.controllerDialogs.controllerVirtualCursorPulseElement = null;

    this.systems.touchInput.fpsTouchRunButton?.remove();
    this.systems.touchInput.fpsTouchRunButton = null;
    this.systems.touchInput.fpsTouchRunButtonTouchId = null;
    this.systems.touchInput.fpsTouchRunButtonActive = false;

    this.systems.damageNumbers.playerUiNumberOverlay?.remove();
    this.systems.damageNumbers.playerUiNumberOverlay = null;
    this.systems.damageNumbers.playerUiNumberParticles = [];
    this.systems.vultureProjection.disposeVulturePrebakedProjectionManifest();
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugPanel?.remove();
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugPanel = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugCanvasEW = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugCanvasSN = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugCanvasFloor = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugCanvasDoorOpenEW = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugCanvasDoorOpenSN = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugCanvasDoorClosedEW = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugCanvasDoorClosedSN = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugSourceCanvasEW = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugSourceCanvasSN = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugSourceCanvasFloor = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugSourceCanvasDoorOpenEW = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugSourceCanvasDoorOpenSN = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugSourceCanvasDoorClosedEW = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugSourceCanvasDoorClosedSN = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugFamilySelect = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugFamilySections = {};
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugStatusLabel = null;
    this.systems.vultureProjectionDebug.vultureBillboardScaleInput = null;
    this.systems.vultureProjectionDebug.vultureFloorProjectionRotationButton = null;
    this.systems.vultureProjectionDebug.vultureWallProjectionRotationButtons = {};
    this.systems.vultureProjectionDebug.vultureDoorProjectionRotationButtons = {};
    this.systems.vultureProjectionDebug.vultureWallProjectionDebugDrag = null;

    this.systems.renderPipeline.disposeAntialiasingPipeline();
    this.systems.renderPipeline.renderer.domElement.remove();
    this.systems.renderPipeline.renderer.forceContextLoss();
    this.systems.renderPipeline.renderer.dispose();
    this.systems.bloodParticles.disposeBloodMistTexture();
    this.systems.bloodGround.disposeBloodGroundOverlayResources();
    this.systems.tileRendering.floorGeometry.dispose();
    this.systems.bloodGround.bloodGroundPlaneGeometry.dispose();
    this.systems.wallGeometry.wallGeometry.dispose();
    this.systems.wallOverlays.vultureWallPlaneGeometry.dispose();
    this.systems.wallOverlays.vultureDoorPlaneGeometry.dispose();
    this.systems.wallOverlays.transparentWallGroundPlaneGeometry.dispose();
    this.systems.wallOverlays.vultureInvisibleSurfaceMaterial.dispose();
    this.systems.entityBillboards.fpsPitchLockedBillboardGeometry.dispose();
    this.systems.heldWeapon.fpsHeldWeaponGeometry.dispose();
    Object.values(this.systems.tileMaterials.materials).forEach((material) => material.dispose());
  }

  public setClientOptions(options: Nh3dClientOptions): void {
    this.applyClientOptions(options);
  }

  private animate(animationTime: number = performance.now()): void {
    const timeMs = gameFrameTime(animationTime, this.systems.renderPipeline.renderer.xr.isPresenting, performance.now());
    if (this.systems.engineState.disposed) {
      return;
    }
    if (!this.systems.webXrPresentation.active && this.systems.fpsDiagnostics.shouldSkipFrameForFpsDebugOverride(timeMs)) {
      return;
    }
    const rawDeltaMs =
      this.systems.engineState.lastFrameTimeMs === null ? 1000 / 60 : timeMs - this.systems.engineState.lastFrameTimeMs;
    this.systems.engineState.lastFrameTimeMs = timeMs;
    const deltaSeconds = Math.max(0, Math.min(rawDeltaMs, 250)) / 1000;

    this.systems.questSceneExport.syncPlayMode();
    this.systems.webXrPresentation.updateCamera();
    this.systems.webXrPresentation.updateInput(timeMs);
    this.systems.pointerLock.syncFpsPointerLockForUiState(false);
    this.systems.controllerGameplay.updateControllerInput(deltaSeconds, !this.systems.webXrPresentation.active);
    this.systems.entityMovement.updateEntityMoveTransitions();
    this.systems.camera.updateCameraPanInertia(deltaSeconds);
    // Preserve step completion and queued tile flushing before applying the XR view.
    this.systems.camera.updateCamera(deltaSeconds);
    this.systems.webXrPresentation.updateCamera();
    this.systems.promptDialogs.maybeRequestPendingStartupInventoryRefresh();
    this.systems.heldWeapon.syncFpsHeldWeaponSprite(deltaSeconds);
    this.systems.entityBillboards.updateMonsterBillboardPitchLockState();
    this.systems.directionPrompts.syncDirectionPromptOverlayVisibility();
    this.systems.directionPrompts.directionPromptOverlay?.update(
      this.systems.camera.getActiveCamera(),
      this.systems.playerMovement.playerPos.x,
      this.systems.playerMovement.playerPos.y,
    );
    this.systems.lighting.updateFpsPlayerLightPosition();
    this.systems.tileContextActions.updateFpsCrosshairContextMenu();
    this.systems.tileContextActions.updateNormalTileContextMenu();
    this.systems.aimHighlights.updateFpsAimVisuals(timeMs);
    this.systems.tileContextActions.updateContextSelectionHighlight(timeMs);
    this.systems.positionSelection.updatePositionCursorPulse(timeMs);
    this.systems.darkCorridorInference.expireBlindSearchInferenceWindowIfNeeded();
    this.systems.lighting.updateLightingCenter(deltaSeconds);
    if (this.systems.engineState.clientOptions.minimap || this.systems.terminalRendering.terminalGutterMinimapVisible) {
      this.systems.minimap.renderMinimapViewportOverlay(timeMs);
    }
    this.systems.extendedCommands.updateMetaCommandModalPosition();
    this.systems.lighting.disposeLightingOverlay();
    this.systems.tileRendering.updateEffectAnimations(timeMs);
    this.systems.damageNumbers.updateDamageEffects(deltaSeconds);
    this.systems.tileRendering.updateTileRevealFades(timeMs);
    this.systems.vultureWalls.updateVultureDoorPlaneRenderOrdering();
    this.systems.vultureWalls.updateIronBarsWallPlaneVisibility();
    this.systems.camera.compensateTerminalWorldSpriteAspect();
    const xrCamera = this.systems.webXrPresentation.prepareRender();
    if (xrCamera) {
      this.systems.renderPipeline.renderer.render(this.systems.renderPipeline.scene, xrCamera);
      return;
    }
    this.systems.questSceneExport.update(timeMs);
    if (this.systems.questSceneExport.usesNativeRenderer()) return;
    const shouldCollectFpsDebugStats = this.systems.fpsDiagnostics.fpsDebugDisplayVisible;
    const renderStartedAtMs = shouldCollectFpsDebugStats
      ? performance.now()
      : 0;
    if (this.systems.terminalRendering.isTerminalDisplayMode()) {
      // Render the simulated terminal directly (no AA/tone passes) so glyph
      // text stays crisp, through the top-down orthographic camera.
      this.systems.renderPipeline.renderer.render(this.systems.renderPipeline.scene, this.systems.camera.ensureTerminalCamera());
      if (shouldCollectFpsDebugStats) {
        this.systems.fpsDiagnostics.updateFpsDebugDisplay(
          rawDeltaMs,
          performance.now() - renderStartedAtMs,
        );
      }
      return;
    }
    if (this.systems.renderPipeline.composer) {
      this.systems.renderPipeline.updateTaaState();
      this.systems.renderPipeline.composer.render(deltaSeconds);
      if (shouldCollectFpsDebugStats) {
        this.systems.fpsDiagnostics.updateFpsDebugDisplay(
          rawDeltaMs,
          performance.now() - renderStartedAtMs,
        );
      }
      return;
    }
    this.systems.renderPipeline.renderer.render(this.systems.renderPipeline.scene, this.systems.camera.camera);
    if (shouldCollectFpsDebugStats) {
      this.systems.fpsDiagnostics.updateFpsDebugDisplay(
        rawDeltaMs,
        performance.now() - renderStartedAtMs,
      );
    }
  }

  public requestTileUpdate(
    x: number,
    y: number,
    options: { forceRuntime?: boolean } = {},
  ): void {
    return this.systems.tileUpdates.requestTileUpdate(x, y, options);
  }

  public requestAreaUpdate(
    centerX: number,
    centerY: number,
    radius: number = 3,
  ): void {
    return this.systems.tileUpdates.requestAreaUpdate(centerX, centerY, radius);
  }

  public requestPlayerAreaUpdate(radius: number = 5): void {
    return this.systems.tileUpdates.requestPlayerAreaUpdate(radius);
  }

  public requestRuntimeGlobalsSnapshot(): void {
    return this.systems.tileUpdates.requestRuntimeGlobalsSnapshot();
  }

  public getLatestRuntimeGlobalsSnapshot(): unknown {
    return this.systems.tileUpdates.getLatestRuntimeGlobalsSnapshot();
  }

  public isLoggingEnabled(): boolean {
    return this.systems.engineMessages.isLoggingEnabled();
  }

  public setLoggingEnabled(enabled: boolean): boolean {
    return this.systems.engineMessages.setLoggingEnabled(enabled);
  }

  public goToPreviousQuestionMenuPage(): void {
    return this.systems.questionMenus.goToPreviousQuestionMenuPage();
  }

  public goToNextQuestionMenuPage(): void {
    return this.systems.questionMenus.goToNextQuestionMenuPage();
  }

  public chooseDirection(directionKey: string): void {
    return this.systems.inputCommands.chooseDirection(directionKey);
  }

  public confirmActiveDirectionQuestion(): void {
    return this.systems.inputCommands.confirmActiveDirectionQuestion();
  }

  public chooseQuestionChoice(choice: string): void {
    return this.systems.questionMenus.chooseQuestionChoice(choice);
  }

  public stepQuestionSelectionCount(delta: number): void {
    return this.systems.questionMenus.stepQuestionSelectionCount(delta);
  }

  public setQuestionSelectionCount(count: number | null): void {
    return this.systems.questionMenus.setQuestionSelectionCount(count);
  }

  public clearQuestionSelectionCount(): void {
    return this.systems.questionMenus.clearQuestionSelectionCount();
  }

  public syncQuestionSelectionFocus(selectionInput: string): void {
    return this.systems.questionMenus.syncQuestionSelectionFocus(selectionInput);
  }

  public syncQuestionActionFocus(
    action: "select-all" | "confirm" | "cancel",
  ): void {
    return this.systems.questionMenus.syncQuestionActionFocus(action);
  }

  public resolveLegacyQuestionChoicePreviewTileIndex(
    choice: string,
  ): number | null {
    return this.systems.questionMenus.resolveLegacyQuestionChoicePreviewTileIndex(choice);
  }

  public confirmQuestionMenuChoice(): void {
    return this.systems.questionMenus.confirmQuestionMenuChoice();
  }

  public togglePickupChoice(accelerator: string): void {
    return this.systems.questionMenus.togglePickupChoice(accelerator);
  }

  public toggleAllPickupChoices(): void {
    return this.systems.questionMenus.toggleAllPickupChoices();
  }

  public confirmPickupChoices(): void {
    return this.systems.questionMenus.confirmPickupChoices();
  }

  public submitTextInput(text: string): void {
    return this.systems.inputCommands.submitTextInput(text);
  }

  public cancelActivePrompt(): void {
    return this.systems.inputCommands.cancelActivePrompt();
  }

  public toggleInventoryDialog(): void {
    return this.systems.inputCommands.toggleInventoryDialog();
  }

  public openCharacterSheet(): void {
    return this.systems.inputCommands.openCharacterSheet();
  }

  public runInventoryItemAction(
    actionId: string,
    itemAccelerator: string,
  ): void {
    return this.systems.inputCommands.runInventoryItemAction(actionId, itemAccelerator);
  }

  public runInventoryItemDropCount(
    itemAccelerator: string,
    count: number,
  ): void {
    return this.systems.inputCommands.runInventoryItemDropCount(itemAccelerator, count);
  }

  public dismissFpsCrosshairContextMenu(): void {
    return this.systems.inputCommands.dismissFpsCrosshairContextMenu();
  }

  public runQuickAction(
    actionId: string,
    options?: { autoDirectionFromFpsAim?: boolean; submitDelayMs?: number },
  ): void {
    return this.systems.inputCommands.runQuickAction(actionId, options);
  }

  public runExtendedCommand(
    commandText: string,
    options?: {
      autoDirectionFromFpsAim?: boolean;
      submitDelayMs?: number;
      forceHashSubmission?: boolean;
    },
  ): void {
    return this.systems.inputCommands.runExtendedCommand(commandText, options);
  }

  public runContextualAction(actionId: string): void {
    return this.systems.inputCommands.runContextualAction(actionId);
  }

  public repeatLastAction(): void {
    return this.systems.inputCommands.repeatLastAction();
  }

  public closeInventoryDialog(): void {
    return this.systems.promptDialogs.closeInventoryDialog();
  }

  public closeInfoMenuDialog(): void {
    return this.systems.promptDialogs.closeInfoMenuDialog();
  }

  public activateQuestTile(x: number, y: number, secondary = false): boolean {
    return this.systems.mouseInput.activateQuestTile(x, y, secondary);
  }
  public runQuestDirection(direction: string): void {
    this.systems.inputCommands.sendForcedDirectionalInput(direction);
  }

  public sendInput(
    input: string,
    options: { keepContextMenuOpen?: boolean; delayMs?: number } = {},
  ): void {
    return this.systems.inputCommands.sendInput(input, options);
  }

  public toggleInfoMenuDialog(): void {
    return this.systems.promptDialogs.toggleInfoMenuDialog();
  }

  /** Recent runtime status payloads exposed to the existing browser debug helpers. */
  public get statusDebugHistory() {
    return this.systems.playerStatus.statusDebugHistory;
  }
}

export default Nethack3DEngine;
