/*
 * Main entry point for the NetHack 3D client.
 * This module runs NetHack WASM locally in-browser and renders the game in 3D using Three.js.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { TAARenderPass } from "three/examples/jsm/postprocessing/TAARenderPass.js";
import { WorkerRuntimeBridge } from "../runtime";
import type { RuntimeBridge, RuntimeEvent } from "../runtime";
import { FmodRuntime } from "../audio";
import type { FmodRuntimeOptions, FmodThreadingDiagnostics } from "../audio";
import {
  isLoggingEnabled,
  logWithOriginal,
  setLoggingEnabled,
  toggleLoggingEnabled,
} from "../logging";
import { TILE_SIZE, WALL_HEIGHT } from "./constants";
import {
  classifyTileBehavior,
  getDefaultDarkFloorGlyph,
  getDefaultDarkWallGlyph,
  getDefaultFloorGlyph,
  getOpenDoorGlyphFrom,
  isDarkCorridorCmapGlyph,
  isDoorwayCmapGlyph,
  isSinkCmapGlyph,
  isVerticalDoorCmapGlyph,
} from "./glyphs/behavior";
import { getGlyphCatalogEntry, setActiveGlyphCatalog } from "./glyphs/registry";
import type {
  TileBehaviorResult,
  TileEffectKind,
  TileMaterialKind,
} from "./glyphs";
import type {
  GlyphOverlay,
  GlyphOverlayMap,
  TerrainSnapshot,
  TileMap,
} from "./types";
import type {
  CharacterCreationConfig,
  FpsContextAction,
  FpsCrosshairContextState,
  GameOverState,
  InventoryDialogState,
  Nh3dClientOptions,
  Nethack3DEngineController,
  Nethack3DEngineOptions,
  Nethack3DEngineUIAdapter,
  NethackConnectionState,
  PlayMode,
  PlayerStatsSnapshot,
  QuestionDialogState,
} from "./ui-types";
import {
  nh3dFpsLookSensitivityMax,
  nh3dFpsLookSensitivityMin,
  normalizeNh3dClientOptions,
} from "./ui-types";
import {
  findNh3dTilesetByPath,
  inferNh3dTilesetTileSizeFromAtlasWidth,
  resolveNh3dTilesetAssetUrl,
} from "./tilesets";
import { getItemTextClassName } from "./helpers";
import { MessageSoundHooks } from "./message-sound-hooks";
import { VrSessionController } from "./vr";
import type { VrEngineBridge, VrTileTarget } from "./vr";

type PendingCharacterDamage = {
  amount: number;
  createdAtMs: number;
  expectedDirection: DirectionalAttackContext | null;
  expectedTile: {
    x: number;
    y: number;
  } | null;
};

type DirectionalAttackContext = {
  dx: number;
  dy: number;
  originX: number;
  originY: number;
  capturedAtMs: number;
};

type PointerAttackTargetContext = {
  x: number;
  y: number;
  capturedAtMs: number;
};

type GlyphDamageFlashState = {
  key: string;
  mode: "glyph_texture" | "overlay_tint";
  canvas: HTMLCanvasElement | null;
  context: CanvasRenderingContext2D | null;
  texture: THREE.CanvasTexture | null;
  elapsedMs: number;
  durationMs: number;
  baseColorHex: string;
  glyphChar: string;
  darkenFactor: number;
};

type MonsterBillboardDamageFlashState = {
  key: string;
  elapsedMs: number;
  durationMs: number;
};

type GlyphDamageShakeState = {
  key: string;
  tileX: number;
  tileY: number;
  elapsedMs: number;
  durationMs: number;
  amplitude: number;
  seed: number;
  spriteOnly: boolean;
};

type BloodMistParticle = {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  ageMs: number;
  lifetimeMs: number;
  radius: number;
  baseScale: THREE.Vector2;
};

type DamageNumberParticle = {
  kind: "damage" | "heal";
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  ageMs: number;
  lifetimeMs: number;
  radius: number;
  baseScale: THREE.Vector2;
  fpsFloating: boolean;
  fpsLateralOffset: number;
  fpsBaseHeightOffset: number;
  fpsCameraLocalAnchor: THREE.Vector3 | null;
};

type PlayerUiNumberParticle = {
  element: HTMLElement;
  uiWidthPx: number;
  uiHeightPx: number;
  lockedScreenXNorm: number;
  lockedScreenYNorm: number;
  ageMs: number;
  lifetimeMs: number;
  fadeDelayMs: number;
  risePx: number;
  fpsFloating: boolean;
  fpsLateralOffset: number;
  worldBaseHeightOffset: number;
};

type CorePlayerStatField =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma"
  | "armor";

type BillboardShardDescriptor = {
  texture: THREE.CanvasTexture;
  centerU: number;
  centerV: number;
  widthRatio: number;
  heightRatio: number;
  areaRatio: number;
};

type BillboardShardParticle = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  ageMs: number;
  lifetimeMs: number;
  fadeStartMs: number;
  radius: number;
  baseScale: THREE.Vector2;
  angularVelocity: THREE.Vector3;
  floorContactMs: number;
  settled: boolean;
  flatOrientation: THREE.Quaternion;
};

type CharacterCreationQuestionPayload = {
  text: string;
  choices: string;
  defaultChoice: string;
  menuItems: any[];
};

type InventoryDialogOptions = {
  contextActionsEnabled?: boolean;
};

const MINIMAP_WIDTH_TILES = 79;
const MINIMAP_HEIGHT_TILES = 21;

type MinimapViewportRect = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

type AimDirection = {
  dx: number;
  dy: number;
  input: string;
};

type FpsCrosshairTargetHint =
  | "monster"
  | "loot"
  | "door"
  | "stairs_up"
  | "stairs_down"
  | "wall"
  | "water"
  | "trap"
  | "feature"
  | "floor"
  | "unknown";

type FpsCrosshairGlanceCacheEntry = {
  hint: FpsCrosshairTargetHint;
  sourceText: string;
  updatedAtMs: number;
};

type FpsCrosshairGlancePending = {
  requestId: number;
  tileKey: string;
  tileX: number;
  tileY: number;
  startedAtMs: number;
  sawPositionInput: boolean;
  positionResolvedAtMs: number | null;
  targetClickSent: boolean;
  commandKind: "colon" | "glance";
};

type TileContextTarget = {
  key: string;
  x: number;
  y: number;
  mesh: THREE.Mesh;
};

type TileContextTouchHoldState = {
  touchId: number;
  startX: number;
  startY: number;
  opened: boolean;
};

type FpsTouchGestureState = {
  touchId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAtMs: number;
};

type RepeatableActionSpec =
  | { kind: "quick"; value: string }
  | { kind: "extended"; value: string }
  | { kind: "inventory_command"; value: string };

type TileUpdateOptions = {
  inferredDarkCorridorWall?: boolean;
  restartRevealFade?: boolean;
  runtimeTileIndex?: number;
};

type WallSideTileOverlay = {
  textureKey: string;
  material: THREE.MeshBasicMaterial;
};
type WallSideTileRotation = "none" | "cw90" | "ccw90";
type FpsChamferWallUvRotation = "none" | "lr_ccw" | "fb_ccw";

const toneAdjustShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    brightness: { value: 0 },
    contrast: { value: 0 },
    gamma: { value: 1 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float gamma;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;
      color += vec3(brightness);
      color = (color - 0.5) * (1.0 + contrast) + 0.5;
      float safeGamma = max(gamma, 0.001);
      color = pow(max(color, vec3(0.0)), vec3(1.0 / safeGamma));
      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

/**
 * The main game engine class. It encapsulates all the logic for the 3D client.
 */
class Nethack3DEngine implements Nethack3DEngineController {
  private renderer!: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private taaRenderPass: TAARenderPass | null = null;
  private fxaaPass: FXAAPass | null = null;
  private toneAdjustPass: ShaderPass | null = null;
  private scene!: THREE.Scene;
  private worldRoot!: THREE.Group;
  private camera!: THREE.PerspectiveCamera;
  private readonly mountElement: HTMLElement | null;
  private readonly vrDomOverlayRoot: HTMLElement | null;
  private readonly uiAdapter: Nethack3DEngineUIAdapter;
  private vrSessionController: VrSessionController | null = null;
  private vrHoveredTile: TileContextTarget | null = null;
  private vrTileContextMode: boolean = false;
  private vrQuickPanelVisible: boolean = false;
  private destroyed: boolean = false;

  private tileMap: TileMap = new Map();
  private glyphOverlayMap: GlyphOverlayMap = new Map();
  private inferredDarkWallSolidColorMaterialCache: Map<
    string,
    { material: THREE.MeshLambertMaterial; texture: THREE.CanvasTexture | null }
  > = new Map();
  private floorBlockAmbientOcclusionTextureCache: Map<
    number,
    THREE.CanvasTexture
  > = new Map();
  private floorBlockAmbientOcclusionOverlays: Map<string, THREE.Mesh> =
    new Map();
  private readonly floorBlockAmbientOcclusionOverlayZ: number = 0.014;
  private fpsWallChamferFloorAmbientOcclusionOverlays: Map<string, THREE.Mesh> =
    new Map();
  private readonly fpsWallChamferFloorAmbientOcclusionOverlayZ: number = 0.001;
  // Fade-in animation state for newly discovered tiles.
  private tileRevealStartMs: Map<string, number> = new Map();
  private tileRevealDurationMs: number = 225;
  private tileStateCache: Map<string, string> = new Map();
  private lastKnownTerrain: Map<string, TerrainSnapshot> = new Map();
  private fpsFlatFeatureUnderPlayerCache: Map<string, TerrainSnapshot> =
    new Map();
  private inferredDarkCorridorWallTiles: Map<string, { x: number; y: number }> =
    new Map();
  private darkCorridorInputDiscoveryWindowActive: boolean = false;
  private newlyDiscoveredDarkCorridorTilesForCurrentInput: Map<
    string,
    { x: number; y: number }
  > = new Map();
  private pendingBoulderPushDarkCorridorInference: {
    playerX: number;
    playerY: number;
    dx: number;
    dy: number;
  } | null = null;
  private readonly darkCorridorDiscoveryDoorwayChars: ReadonlySet<string> =
    new Set([".", "-", "|"]);
  private readonly darkCorridorInferenceRingInsetTiles: number = 1;
  private readonly darkCorridorWallNeighborOffsets: ReadonlyArray<{
    dx: number;
    dy: number;
  }> = [
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
  ];
  private glyphTextureCache: Map<
    string,
    { texture: THREE.CanvasTexture; refCount: number }
  > = new Map();
  private tilesetBackgroundTilePixelsCache: Map<number, Uint8ClampedArray> =
    new Map();
  private pendingTileUpdates: Map<string, any> = new Map();
  private tileFlushScheduled: boolean = false;
  private playerPos = { x: 0, y: 0 };
  private gameMessages: string[] = [];
  private hasSeenPlayerPosition: boolean = false;
  private fpsPreviousPlayerTileForSuppression: {
    x: number;
    y: number;
    capturedAtMs: number;
  } | null = null;
  private pendingPlayerTileRefreshOnNextPosition: boolean = true;
  private hasPlayerMovedOnce: boolean = false;
  private autoPickupEnabled: boolean = true;
  private lastMovementInputAtMs: number = 0;
  private pendingPlayerFootstepSoundArmed: boolean = false;
  private playerCliparoundInputCooldownUntilMs: number = 0;
  private readonly playerCliparoundInputCooldownMs: number = 520;
  private readonly tileRefreshRetryDelayMs: number = 120;
  private readonly movementUnlockWindowMs: number = 5000;
  private statusConditionMask: number = 0;
  // NetHack BL_MASK_BLIND from botl.h
  private readonly statusConditionBlindMask: number = 0x00000020;
  private statusDebugHistory: any[] = [];
  private currentInventory: any[] = []; // Store current inventory items
  private pendingInventoryDialog: boolean = false; // Flag to show inventory dialog after update
  private pendingInventoryDialogOptions: InventoryDialogOptions | null = null;
  private inventoryRefreshInFlight: boolean = false;
  private runtimeTerminationPromptShown: boolean = false;
  private runtimeConnectionState: NethackConnectionState = "disconnected";
  private lastInfoMenu: { title: string; lines: string[] } | null = null;
  private isInventoryDialogVisible: boolean = false;
  private inventoryContextActionsEnabled: boolean = true;
  private gameOverState: GameOverState = {
    active: false,
    deathMessage: null,
  };
  private isInfoDialogVisible: boolean = false;
  private pendingInventoryContextPromptCloseRequestedAtMs: number = 0;
  private readonly inventoryContextPromptCloseWindowMs: number = 2200;
  private activeQuestionText: string = "";
  private activeQuestionChoices: string = "";
  private activeQuestionDefaultChoice: string = "";
  private activeQuestionMenuItems: any[] = [];
  private activeQuestionVisibleMenuItems: any[] = [];
  private activeQuestionMenuPageIndex: number = 0;
  private activeQuestionMenuPageCount: number = 1;
  private activeQuestionPageSelectionMap: Map<string, string> = new Map();
  private activeQuestionIsPickupDialog: boolean = false;
  private activePickupSelections: Set<string> = new Set();
  private activePickupFocusIndex: number = 0;
  private activeQuestionMenuFocusIndex: number = 0;
  private activeQuestionActionFocusIndex: number = -1;
  private positionHideTimerId: number | null = null;
  private positionInputModeActive: boolean = false;
  private positionCursor = { x: 0, y: 0 };
  private hasRuntimePositionCursor: boolean = false;
  private positionCursorOutline: THREE.Line | null = null;
  private readonly positionCursorOutlineColorHex: number = 0xffe15a;
  private readonly positionCursorOutlineInset: number = 0.04;
  private readonly positionCursorGroundZ: number = 0.03;
  private readonly positionCursorWallZ: number = WALL_HEIGHT + 0.03;

  // Player stats tracking
  private playerStats = {
    name: "Adventurer",
    hp: 10,
    maxHp: 10,
    power: 0,
    maxPower: 0,
    level: 1,
    experience: 0,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    armor: 10,
    dungeon: "Dungeons of Doom",
    dlevel: 1,
    gold: 0,
    alignment: "Neutral",
    hunger: "Not Hungry",
    encumbrance: "",
    time: 1,
    score: 0,
  };

  private session: RuntimeBridge | null = null;
  private readonly fmodRuntime: FmodRuntime;
  private readonly messageSoundHooks: MessageSoundHooks;
  private readonly deploymentTarget: string = this.resolveDeploymentTarget();
  private fmodRuntimeInitializationInFlight: boolean = false;
  private readonly metaInputPrefix = "__META__:";
  private readonly menuSelectionInputPrefix = "__MENU_SELECT__:";
  private readonly textInputPrefix = "__TEXT_INPUT__:";
  private readonly inventoryContextSelectionPrefix = "__INVCTX_SELECT__:";
  private repeatableAction: RepeatableActionSpec | null = null;
  private repeatActionVisible: boolean = false;
  private repeatAutoDirectionPending: boolean = false;
  private repeatAutoDirectionArmedAtMs: number = 0;
  private readonly repeatAutoDirectionWindowMs: number = 1800;
  private fpsContextAutoDirectionInput: string | null = null;
  private fpsContextAutoDirectionArmedAtMs: number = 0;
  private readonly fpsContextAutoDirectionWindowMs: number = 10000;
  private repeatDirectionCandidate: RepeatableActionSpec | null = null;
  private repeatDirectionCandidateAtMs: number = 0;
  private readonly repeatDirectionCandidateWindowMs: number = 1100;
  private lastRepeatDirectionInput: string | null = null;
  private skipNextMobileFpsClickLookPromptMessage: boolean = false;
  private isTextInputActive: boolean = false;
  private characterCreationConfig: CharacterCreationConfig = {
    mode: "create",
    playMode: "normal",
  };
  private clientOptions: Nh3dClientOptions = normalizeNh3dClientOptions();
  private playMode: PlayMode = "normal";
  private readonly questionMenuPageAccelerators: string[] =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  private altOrMetaHeld: boolean = false;
  private metaCommandModeActive: boolean = false;
  private metaCommandBuffer: string = "";
  private metaCommandModal: HTMLDivElement | null = null;
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly pointerRaycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly pointerIntersection = new THREE.Vector3();
  private readonly tileVisualScaleFps = 1;
  private readonly defaultFpsCameraFov = 62;
  private readonly firstPersonEyeHeight = WALL_HEIGHT * 0.62;
  private readonly firstPersonPitchMin = -Math.PI / 2 + 0.03;
  private readonly firstPersonPitchMax = 1.18;
  private readonly firstPersonMouseSensitivity = 0.0026;
  private readonly fpsDiagonalAimBias = 0.035;
  private fpsPointerLockActive: boolean = false;
  private fpsPointerLockRestorePending: boolean = false;
  private fpsForwardHighlight: THREE.Mesh | null = null;
  private fpsForwardHighlightMaterial: THREE.MeshBasicMaterial | null = null;
  private fpsForwardHighlightTexture: THREE.CanvasTexture | null = null;
  private fpsAimLinePulseUntilMs: number = 0;
  private fpsFireSuppressionUntilMs: number = 0;
  private readonly fpsFireSuppressionDurationMs: number = 1500;
  private fpsCrosshairContextMenuOpen: boolean = false;
  private fpsCrosshairContextSignature: string = "";
  private normalTileContextMenuOpen: boolean = false;
  private normalTileContextSignature: string = "";
  private normalTileContextTarget: TileContextTarget | null = null;
  private activeContextActionTile: { x: number; y: number } | null = null;
  private selectedContextHighlightTile: { x: number; y: number } | null = null;
  private suppressNextMapPrimaryPointerUntilMs: number = 0;
  private readonly suppressNextMapPrimaryPointerWindowMs: number = 140;
  private readonly fpsVoidContextMesh: THREE.Mesh = (() => {
    const mesh = new THREE.Mesh();
    mesh.userData = {
      isWall: true,
      materialKind: "rock",
      isMonsterLikeCharacter: false,
      isLootLikeCharacter: false,
    };
    return mesh;
  })();
  private fpsCrosshairGlanceCache: Map<string, FpsCrosshairGlanceCacheEntry> =
    new Map();
  private fpsCrosshairGlanceAttemptedKeys: Set<string> = new Set();
  private fpsCrosshairGlanceIssuedThisOpen: boolean = false;
  private fpsCrosshairGlancePending: FpsCrosshairGlancePending | null = null;
  private fpsCrosshairGlanceRequestSequence: number = 0;
  private readonly fpsCrosshairGlanceTimeoutMs: number = 2600;
  private fpsWallChamferGeometryCache: Map<string, THREE.BufferGeometry> =
    new Map();
  private fpsWallChamferFloorGeometryCache: Map<number, THREE.ShapeGeometry> =
    new Map();
  private fpsWallChamferFloorMeshes: Map<string, THREE.Mesh> = new Map();
  private fpsWallChamferFaceMaterialCache: Map<
    TileMaterialKind,
    THREE.MeshBasicMaterial
  > = new Map();
  private fpsWallChamferFloorMaterialCache: Map<
    string,
    { material: THREE.MeshBasicMaterial; texture: THREE.CanvasTexture }
  > = new Map();
  private readonly fpsWallChamferInset = TILE_SIZE * 0.25;
  private readonly fpsWallChamferFloorZ = 0.0;
  private readonly elevatedMonsterZ = WALL_HEIGHT * 0.58;
  private entityBlobShadows: Map<string, THREE.Mesh> = new Map();
  private entityBlobShadowTexture: THREE.CanvasTexture | null = null;
  private monsterBillboards: Map<string, THREE.Sprite> = new Map();
  private monsterBillboardTextures: Map<
    string,
    { texture: THREE.CanvasTexture; refCount: number }
  > = new Map();
  private fpsStepCameraActive: boolean = false;
  private fpsStepCameraStartMs: number = 0;
  private readonly fpsStepCameraBaseDurationMs: number = 92;
  private fpsStepCameraDurationMs: number = this.fpsStepCameraBaseDurationMs;
  private readonly fpsAutoMoveDetectionWindowMs: number = 120;
  private lastManualDirectionalInputAtMs: number = 0;
  private fpsAutoMoveDirection: { dx: number; dy: number } | null = null;
  private fpsAutoTurnTargetYaw: number | null = null;
  private readonly fpsAutoTurnSpeedRadPerSec: number = 8.8;
  private fpsStepCameraFrom = new THREE.Vector3();
  private fpsStepCameraTo = new THREE.Vector3();

  // Camera controls
  private cameraDistance: number = 20;
  private cameraPitch: number = Math.PI / 2 - 0.3; // Elevation above the board (0 = horizon)
  private cameraYaw: number = 0; // Azimuth around the board (0 = facing north)
  private readonly minCameraPitch: number = 0.2;
  private readonly maxCameraPitch: number = Math.PI / 2 - 0.01;
  private readonly rotationSpeed: number = 0.01;
  private isMiddleMouseDown: boolean = false;
  private isRightMouseDown: boolean = false;
  private rightMouseDownStartX: number = 0;
  private rightMouseDownStartY: number = 0;
  private rightMouseDragExceededDeadzone: boolean = false;
  private rightMouseCanOpenContextMenuOnRelease: boolean = false;
  private readonly rightMouseContextDeadzonePx: number = 10;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private touchSwipeStart: {
    touchId: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    startedAtMs: number;
    panningActive: boolean;
  } | null = null;
  private pinchZoomStart: { distance: number; cameraDistance: number } | null =
    null;
  private fpsTouchMoveGesture: FpsTouchGestureState | null = null;
  private fpsTouchLookGesture: FpsTouchGestureState | null = null;
  private fpsTouchRunButton: HTMLDivElement | null = null;
  private fpsTouchRunButtonTouchId: number | null = null;
  private fpsTouchRunButtonCenterX: number = 0;
  private fpsTouchRunButtonCenterY: number = 0;
  private fpsTouchRunButtonActive: boolean = false;
  private fpsTouchRunButtonHoldTimerId: number | null = null;
  private readonly fpsTouchLookSensitivity: number = 0.0038;
  private readonly fpsTouchLookMoveThresholdPx: number = 8;
  private readonly fpsTouchTapMaxDurationMs: number = 280;
  private readonly touchSwipeMinDistancePx: number = 26;
  private readonly touchSwipeMaxDurationMs: number = 720;
  private readonly touchSwipePanHoldMs: number = 500;
  private mapTouchContextHoldTimerId: number | null = null;
  private mapTouchContextHoldState: TileContextTouchHoldState | null = null;
  private readonly mapTouchContextHoldMs: number = 500;
  private readonly mapTouchContextHoldDeadzonePx: number = 15;
  private readonly fpsTouchRunButtonHoldMs: number = 500;
  private readonly fpsTouchRunButtonOffsetYPx: number = 170;
  private readonly fpsTouchRunButtonLandscapeOffsetYPx: number = 140;
  private readonly fpsTouchRunButtonSizePx: number = 82;
  private minDistance: number = 5;
  private maxDistance: number = 50;
  private readonly maxRendererPixelRatio: number = 2;
  private readonly desktopTaaSampleLevel: number = 1;
  private tilesetTexture: THREE.Texture | null = null;
  private tileSourceSize = 32;

  // Direction question handling
  private isInDirectionQuestion: boolean = false;

  // General question handling (pauses all movement)
  private isInQuestion: boolean = false;
  private numberPadModeEnabled: boolean = true;

  // Camera panning
  private cameraPanX: number = 0;
  private cameraPanY: number = 0;
  private cameraPanTargetX: number = 0;
  private cameraPanTargetY: number = 0;
  private isCameraCenteredOnPlayer: boolean = true;
  private readonly cameraPanHalfLifeMs: number = 135;
  private cameraFollowHalfLifeMs: number = 85;
  private cameraFollowInitialized: boolean = false;
  private cameraFollowTarget = new THREE.Vector3();
  private cameraFollowCurrent = new THREE.Vector3();
  private lastFrameTimeMs: number | null = null;
  private lastKnownPlayerHp: number | null = null;
  private lastKnownPlayerExperience: number | null = null;
  private lastKnownPlayerLevel: number | null = null;
  private lastKnownPlayerCoreStats: Partial<
    Record<CorePlayerStatField, number>
  > = {};
  private readonly playerCoreStatDisplayNameByField: Record<
    CorePlayerStatField,
    string
  > = {
    strength: "Strength",
    dexterity: "Dexterity",
    constitution: "Constitution",
    intelligence: "Intelligence",
    wisdom: "Wisdom",
    charisma: "Charisma",
    armor: "Armor Class",
  };
  private pendingCharacterDamageQueue: PendingCharacterDamage[] = [];
  private readonly pendingCharacterDamageMaxAgeMs: number = 420;
  private readonly glyphDamageFlashDurationMs: number = 180;
  private readonly monsterBillboardDamageFlashDurationMs: number = 320;
  private readonly glyphDamageFlashTextureSize: number = 256;
  private readonly glyphDamageFlashRed = new THREE.Color("#ff2d2d");
  private readonly glyphDamageFlashWhite = new THREE.Color("#ffffff");
  private readonly glyphDamageFlashColor = new THREE.Color("#ffffff");
  private glyphDamageFlashes: Map<string, GlyphDamageFlashState> = new Map();
  private monsterBillboardDamageFlashes: Map<
    string,
    MonsterBillboardDamageFlashState
  > = new Map();
  private glyphDamageShakes: Map<string, GlyphDamageShakeState> = new Map();
  private damageParticles: BloodMistParticle[] = [];
  private monsterBillboardShardParticles: BillboardShardParticle[] = [];
  private playerDamageNumberParticles: DamageNumberParticle[] = [];
  private playerUiNumberParticles: PlayerUiNumberParticle[] = [];
  private playerUiNumberOverlay: HTMLDivElement | null = null;
  private playerUiNumbersUseWorldProjectionForVr: boolean = false;
  private readonly playerUiNumberAnchor = new THREE.Vector3();
  private readonly playerUiNumberScreenAnchor = new THREE.Vector3();
  private playerUiOverlayBounds = {
    left: Number.NaN,
    top: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
  };
  private bloodMistTexture: THREE.CanvasTexture | null = null;
  private lastParsedDamageMessage: string = "";
  private lastParsedDamageAtMs: number = 0;
  private lastParsedDefeatMessage: string = "";
  private lastParsedDefeatAtMs: number = 0;
  private lastDirectionalAttackContext: DirectionalAttackContext | null = null;
  private readonly directionalAttackContextMaxAgeMs: number = 900;
  private pendingPointerAttackTargetContext: PointerAttackTargetContext | null =
    null;
  private readonly pointerAttackTargetContextMaxAgeMs: number = 1800;
  private readonly glyphDamageShakeDurationMs: number = 155;
  private readonly glyphDefeatShakeDurationMs: number = 240;
  private readonly glyphDamageShakeAmplitude: number = TILE_SIZE * 0.08;
  private readonly glyphDefeatShakeAmplitude: number = TILE_SIZE * 0.14;
  private readonly bloodParticleHitLifetimeMs: number = 620;
  private readonly bloodParticleDefeatLifetimeMs: number = 1250;
  private readonly bloodParticleHitCountMin: number = 5;
  private readonly bloodParticleHitCountMax: number = 10;
  private readonly bloodParticleDefeatCountMin: number = 18;
  private readonly bloodParticleDefeatCountMax: number = 32;
  private readonly bloodParticleSpawnJitter: number = 0.12;
  private readonly damageParticleGravity: number = 67;
  private readonly damageParticleDrag: number = 4.2;
  private readonly monsterBillboardShardLifetimeMs: number = 3000;
  private readonly monsterBillboardShardFadeStartMs: number = 1500;
  private readonly monsterBillboardShardGravity: number = this.isFpsMode()
    ? 23
    : 23;
  private readonly monsterBillboardShardDrag: number = 2.9;
  private readonly monsterBillboardShardWallBounce: number = 2.5;
  private readonly monsterBillboardShardFloorBounce: number = 0.28;
  private readonly monsterBillboardShardGroundFriction: number = 0.72;
  private readonly monsterBillboardShardAngularAirDamping: number = 0.985;
  private readonly monsterBillboardShardAngularGroundDamping: number = 0.22;
  private readonly monsterBillboardShardFlatSettleMs: number = 220;
  private readonly monsterBillboardShardImpulseTowardPlayer: number =
    TILE_SIZE * 0.17;
  private readonly monsterBillboardShardBaseHorizontalSpeed: number = -1;
  private readonly monsterBillboardShardHorizontalVariance: number = 4;
  private readonly monsterBillboardShardVerticalBaseSpeed: number = -2.5;
  private readonly monsterBillboardShardVerticalVariance: number = 5;
  private readonly monsterBillboardShardMaxPieces: number = 18;
  private readonly monsterBillboardShardBoundaryRedChancePercent: number = 70;
  private readonly monsterBillboardShardBoundaryRedBleedChancePercent: number = 42;
  private readonly playerDamageNumberGravity: number = 18.4;
  private readonly playerDamageNumberDrag: number = 2.4;
  private readonly playerDamageNumberLifetimeMs: number = 1860;
  private readonly playerDamageNumberFadeDelayMs: number = 250;
  private readonly playerHealNumberLifetimeMs: number = 1200;
  private readonly playerHealNumberFadeDelayMs: number = 250;
  private readonly playerDamageNumberWallBounce: number = 0.35;
  private readonly playerDamageNumberForwardOffset: number = TILE_SIZE * 0.42;
  private readonly playerDamageNumberFpsLateralSpread: number =
    TILE_SIZE * 0.14;
  private readonly playerDamageNumberFpsRiseDistance: number = 0.34;
  private readonly playerDamageNumberNormalScaleFactor: number = 3;
  private readonly playerDamageNumberFpsScaleFactor: number = 0.33;
  private readonly playerDamageNumberForwardLift: number = 0.07;
  private readonly playerDamageNumberForwardDirection = new THREE.Vector3();
  private readonly playerDamageNumberRightDirection = new THREE.Vector3();
  private readonly playerDamageNumberCameraLocalScratch = new THREE.Vector3();
  private readonly playerDamageNumberCameraInverseQuaternion =
    new THREE.Quaternion();
  private readonly monsterBillboardShardAngularAxis = new THREE.Vector3();
  private readonly monsterBillboardShardDeltaQuaternion =
    new THREE.Quaternion();
  private readonly damageParticleFloorZ: number = 0.02;
  private readonly damageParticleWallBounce: number = 0.46;
  private minimapContainer: HTMLDivElement | null = null;
  private minimapCanvasContext: CanvasRenderingContext2D | null = null;
  private minimapViewportContext: CanvasRenderingContext2D | null = null;
  private minimapCells: Uint8Array = new Uint8Array(
    MINIMAP_WIDTH_TILES * MINIMAP_HEIGHT_TILES,
  );
  private pendingMinimapCellUpdates: Map<number, number> = new Map();
  private minimapFlushScheduled: boolean = false;
  private minimapDragPointerId: number | null = null;
  private readonly minimapPalette: string[] = [
    "rgba(10, 16, 28, 0.82)",
    "rgba(20, 29, 46, 0.9)",
    "#3f4b5d",
    "#687384",
    "#7d614a",
    "#2b78ab",
    "#8f76c7",
    "#886137",
    "#b59037",
    "#954647",
    "#4f9a6f",
    "#5d89ba",
    "#4df79e",
  ];

  // Pre-create geometries and materials
  private floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  private wallGeometry = this.createUprightWallBlockGeometry();

  // Materials for different glyph types
  private materials = {
    floor: new THREE.MeshLambertMaterial({ color: 0x6a4d28 }),
    stairs_up: new THREE.MeshLambertMaterial({
      color: 0x3f8753,
      emissive: 0x15301d,
    }),
    stairs_down: new THREE.MeshLambertMaterial({
      color: 0x7d5cc8,
      emissive: 0x251b3a,
    }),
    wall: new THREE.MeshLambertMaterial({ color: 0x5f6773 }),
    dark_wall: new THREE.MeshLambertMaterial({ color: 0x4a5060 }),
    door: new THREE.MeshLambertMaterial({
      color: 0x5a3b22,
      emissive: 0x1b120a,
    }),
    dark: new THREE.MeshLambertMaterial({ color: 0x17385f }),
    water: new THREE.MeshLambertMaterial({
      color: 0x1a6dbe,
      emissive: 0x08253f,
    }),
    trap: new THREE.MeshLambertMaterial({
      color: 0xac6c2e,
      emissive: 0x3a230f,
    }),
    feature: new THREE.MeshLambertMaterial({ color: 0x73768b }),
    fountain: new THREE.MeshLambertMaterial({
      color: 0x2ea8ff,
      emissive: 0x0b2f4d,
    }),
    player: new THREE.MeshLambertMaterial({
      color: 0x39ff88,
      emissive: 0x114d2a,
    }),
    monster_hostile: new THREE.MeshLambertMaterial({
      color: 0x9f3434,
      emissive: 0x311010,
    }),
    monster_friendly: new THREE.MeshLambertMaterial({
      color: 0x2f8f4f,
      emissive: 0x12301c,
    }),
    monster_neutral: new THREE.MeshLambertMaterial({
      color: 0x2f6fa8,
      emissive: 0x10263a,
    }),
    item: new THREE.MeshLambertMaterial({
      color: 0xa87f1a,
      emissive: 0x352707,
    }),
    effect_warning: new THREE.MeshLambertMaterial({
      color: 0x9d6e1f,
      emissive: 0x302109,
    }),
    effect_zap: new THREE.MeshLambertMaterial({
      color: 0x2f8290,
      emissive: 0x0e2730,
    }),
    effect_explode: new THREE.MeshLambertMaterial({
      color: 0xa7582d,
      emissive: 0x341b0f,
    }),
    effect_swallow: new THREE.MeshLambertMaterial({
      color: 0x68469a,
      emissive: 0x221733,
    }),
    default: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  };
  private effectColors: Record<TileEffectKind, THREE.Color> = {
    warning: new THREE.Color(0xffd166),
    zap: new THREE.Color(0x7df9ff),
    explode: new THREE.Color(0xffb46b),
    swallow: new THREE.Color(0xd8a8ff),
  };
  private readonly effectPulseColor = new THREE.Color(0xffffff);
  private readonly activeEffectTileKeys: Set<string> = new Set();
  private readonly animateFrameCallback = (timeMs: number): void => {
    this.animate(timeMs);
  };
  private lightingOverlayMesh: THREE.Mesh | null = null;
  private lightingOverlayTexture: THREE.CanvasTexture | null = null;
  private lightingWallOverlayMesh: THREE.Mesh | null = null;
  private lightingWallOverlayTexture: THREE.CanvasTexture | null = null;
  private readonly lightingCenterHalfLifeMs: number = 95;
  private readonly lightingCenterEpsilonTiles: number = 0.001;
  private lightingCenterCurrent = new THREE.Vector2();
  private lightingCenterTarget = new THREE.Vector2();
  private lightingCenterInitialized: boolean = false;
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private fpsPlayerLight: THREE.PointLight | null = null;
  private readonly activeViewDirection = new THREE.Vector3();

  private isPersistentTerrainKind(kind: string): boolean {
    switch (kind) {
      case "cmap":
        return true;
      // "obj", "body", "statue" are effectively transient entities on top of terrain
      // and should not overwrite the terrain cache (lastKnownTerrain).
      default:
        return false;
    }
  }

  private markLightingDirty(): void {
    // Lighting currently tracks from shared vignette uniforms, so this is a no-op.
  }

  private isUndiscoveredKind(kind: string): boolean {
    return kind === "unexplored" || kind === "nothing";
  }

  private shouldFlattenVoidOrUnknownTileFor367(
    behavior: TileBehaviorResult,
    isInferredDarkCorridorWall: boolean,
  ): boolean {
    if (isInferredDarkCorridorWall) {
      return false;
    }

    const runtimeVersion =
      this.characterCreationConfig.runtimeVersion ?? "3.6.7";
    if (runtimeVersion !== "3.6.7") {
      return false;
    }

    if (
      behavior.resolved.kind === "unknown" ||
      behavior.effective.kind === "unknown"
    ) {
      return true;
    }

    if (behavior.resolved.kind !== "cmap") {
      return false;
    }
    if (behavior.resolved.glyph !== getDefaultDarkWallGlyph()) {
      return false;
    }

    const resolvedChar =
      typeof behavior.resolved.char === "string"
        ? behavior.resolved.char.trim()
        : "";
    const glyphChar =
      typeof behavior.glyphChar === "string" ? behavior.glyphChar.trim() : "";
    return resolvedChar.length === 0 || glyphChar.length === 0;
  }

  private updateLightingCenter(deltaSeconds: number): void {
    if (this.isFpsMode()) {
      // In FPS mode, keep the vignette centered on the camera/player position in world space.
      // (World space in this renderer uses X/Y as the horizontal plane.)
      const viewCamera = this.getActiveViewCamera();
      this.vignetteUniforms.uLightingCenter.value.set(
        viewCamera.position.x,
        viewCamera.position.y,
        0,
      );
      this.vignetteUniforms.uIsFpsMode.value = true;
      return;
    }

    this.lightingCenterTarget.set(this.playerPos.x, this.playerPos.y);
    if (!this.lightingCenterInitialized) {
      this.lightingCenterCurrent.copy(this.lightingCenterTarget);
      this.lightingCenterInitialized = true;
      // Initialize uniforms right away
      this.vignetteUniforms.uLightingCenter.value.set(
        this.lightingCenterCurrent.x * TILE_SIZE,
        -this.lightingCenterCurrent.y * TILE_SIZE,
        0,
      );
      this.vignetteUniforms.uIsFpsMode.value = false;
      return;
    }

    const deltaMs = Math.max(0, deltaSeconds * 1000);
    if (deltaMs > 0) {
      const lerpAlpha =
        1 - Math.exp((-Math.LN2 * deltaMs) / this.lightingCenterHalfLifeMs);
      this.lightingCenterCurrent.lerp(this.lightingCenterTarget, lerpAlpha);
    }

    if (
      this.lightingCenterCurrent.distanceToSquared(this.lightingCenterTarget) <=
      this.lightingCenterEpsilonTiles * this.lightingCenterEpsilonTiles
    ) {
      this.lightingCenterCurrent.copy(this.lightingCenterTarget);
    }

    // --- NEW: Update the globally shared uniforms for the shaders ---
    this.vignetteUniforms.uLightingCenter.value.set(
      this.lightingCenterCurrent.x * TILE_SIZE,
      -this.lightingCenterCurrent.y * TILE_SIZE,
      0,
    );
    this.vignetteUniforms.uIsFpsMode.value = false;
  }

  private disposeLightingOverlay(): void {
    if (this.lightingOverlayMesh) {
      this.removeWorldObject(this.lightingOverlayMesh);
      this.lightingOverlayMesh.geometry.dispose();
      const material = this.lightingOverlayMesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      this.lightingOverlayMesh = null;
    }
    if (this.lightingWallOverlayMesh) {
      this.removeWorldObject(this.lightingWallOverlayMesh);
      this.lightingWallOverlayMesh.geometry.dispose();
      const material = this.lightingWallOverlayMesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      this.lightingWallOverlayMesh = null;
    }

    if (this.lightingOverlayTexture) {
      this.lightingOverlayTexture.dispose();
      this.lightingOverlayTexture = null;
    }
    if (this.lightingWallOverlayTexture) {
      this.lightingWallOverlayTexture.dispose();
      this.lightingWallOverlayTexture = null;
    }
  }

  private configureBaseLightingForPlayMode(): void {
    if (!this.ambientLight || !this.directionalLight) {
      return;
    }

    if (this.isFpsMode()) {
      this.ambientLight.intensity = 0.72;
      this.directionalLight.intensity = 1.25;
      if (!this.fpsPlayerLight) {
        this.fpsPlayerLight = new THREE.PointLight(0xfff4d8, 2.8, 14, 1.35);
        this.fpsPlayerLight.castShadow = false;
        this.scene.add(this.fpsPlayerLight);
      }
      this.fpsPlayerLight.intensity = 2.8;
      this.fpsPlayerLight.distance = 14;
      this.fpsPlayerLight.decay = 1.35;
      this.fpsPlayerLight.visible = true;
      this.updateFpsPlayerLightPosition();
      return;
    }

    this.ambientLight.intensity = 0.4;
    this.directionalLight.intensity = 0.8;
    if (this.fpsPlayerLight) {
      this.fpsPlayerLight.visible = false;
    }
  }

  private updateFpsPlayerLightPosition(): void {
    if (!this.fpsPlayerLight || !this.isFpsMode()) {
      return;
    }
    const viewCamera = this.getActiveViewCamera();
    this.fpsPlayerLight.position.copy(viewCamera.position);
    this.fpsPlayerLight.position.z = viewCamera.position.z + 0.04;
  }

  private resolveFpsCameraFov(): number {
    const candidate =
      typeof this.clientOptions.fpsFov === "number" &&
      Number.isFinite(this.clientOptions.fpsFov)
        ? this.clientOptions.fpsFov
        : this.defaultFpsCameraFov;
    return THREE.MathUtils.clamp(candidate, 45, 110);
  }

  // --- Shader Uniforms for Vignette ---
  private vignetteUniforms = {
    uLightingCenter: { value: new THREE.Vector3(0, 0, 0) },
    uLightingRadius: { value: 20.0 * TILE_SIZE },
    uFalloffPower: { value: 1.08 },
    uMaxDarkAlpha: { value: 0.82 },
    uIsFpsMode: { value: false },
  };

  private patchMaterialForVignette(material: THREE.Material): void {
    // Force Three.js to compile a unique shader for this patch
    material.customProgramCacheKey = () => "vignette_patch_v8";

    material.onBeforeCompile = (shader) => {
      // Bind our class-level uniforms to this specific shader
      shader.uniforms.uLightingCenter = this.vignetteUniforms.uLightingCenter;
      shader.uniforms.uLightingRadius = this.vignetteUniforms.uLightingRadius;
      shader.uniforms.uFalloffPower = this.vignetteUniforms.uFalloffPower;
      shader.uniforms.uMaxDarkAlpha = this.vignetteUniforms.uMaxDarkAlpha;
      shader.uniforms.uIsFpsMode = this.vignetteUniforms.uIsFpsMode;

      // Inject varying into Vertex Shader
      shader.vertexShader = `
        varying vec3 vWorldPos;
        ${shader.vertexShader}
      `;

      // Branch based on material type (Standard Meshes vs Sprites)
      if (shader.vertexShader.includes("#include <project_vertex>")) {
        // --- 3D MESHES ---
        shader.vertexShader = shader.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>
          vec4 tempWorldPosition = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            tempWorldPosition = instanceMatrix * tempWorldPosition;
          #endif
          vWorldPos = (modelMatrix * tempWorldPosition).xyz;`,
        );
      } else if (shader.vertexShader.includes("#include <fog_vertex>")) {
        // --- 2D SPRITES / BILLBOARDS ---
        shader.vertexShader = shader.vertexShader.replace(
          "#include <fog_vertex>",
          `#include <fog_vertex>
          // modelMatrix[3] is the translation column (vec4). Extract xyz for world position.
          vWorldPos = modelMatrix[3].xyz;`,
        );
      }

      let damageFlashLogic = "float uDamageFlash = 0.0;";

      // If it's a sprite, intercept the diffuse color (material.color)
      if (material instanceof THREE.SpriteMaterial) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec4 diffuseColor = vec4( diffuse, opacity );
           // When color is set to red, green drops to 0. Calculate flash intensity from that.
           float uDamageFlashAmount = clamp(1.0 - diffuse.g, 0.0, 1.0);
           // Reset the base multiplier to white so the texture isn't darkened
           diffuseColor.rgb = vec3(1.0); 
          `,
        );
        damageFlashLogic = "float uDamageFlash = uDamageFlashAmount;";
      }

      // Inject logic into Fragment Shader right at the end (before fog)
      shader.fragmentShader = `
        uniform vec3 uLightingCenter;
        uniform float uLightingRadius;
        uniform float uFalloffPower;
        uniform float uMaxDarkAlpha;
        uniform bool uIsFpsMode;
        varying vec3 vWorldPos;
        ${shader.fragmentShader}
      `.replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        
        ${damageFlashLogic}
        if (uDamageFlash > 0.0) {
            // Mix in solid red while perfectly preserving original alpha/transparency
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.0, 0.0), uDamageFlash);
        }

        // Apply vignette in both normal and FPS modes.
        float radius = uIsFpsMode ? (uLightingRadius) : uLightingRadius;
        float dist = distance(vWorldPos.xy, uLightingCenter.xy);
        float t = clamp(dist / radius, 0.0, 1.0);
        float effectiveFalloff = uIsFpsMode ? (uFalloffPower / 2.0) : uFalloffPower;
        float alpha = pow(t, effectiveFalloff) * uMaxDarkAlpha;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), alpha);`,
      );
    };

    material.needsUpdate = true;
  }

  constructor(options: Nethack3DEngineOptions) {
    this.mountElement = options.mountElement ?? null;
    this.vrDomOverlayRoot = options.vrDomOverlayRoot ?? null;
    this.uiAdapter = options.uiAdapter;
    this.characterCreationConfig = options.characterCreationConfig ?? {
      mode: "create",
      playMode: "normal",
      runtimeVersion: "3.6.7",
    };
    this.clientOptions = normalizeNh3dClientOptions(options.clientOptions);
    const explicitFpsMode = options.clientOptions?.fpsMode;
    const initialFpsMode =
      typeof explicitFpsMode === "boolean"
        ? explicitFpsMode
        : this.characterCreationConfig.playMode === "fps";
    this.playMode = initialFpsMode ? "fps" : "normal";
    this.clientOptions.fpsMode = this.playMode === "fps";
    if (typeof options.loggingEnabled === "boolean") {
      setLoggingEnabled(options.loggingEnabled);
    }
    this.fmodRuntime = new FmodRuntime(this.resolveFmodRuntimeOptions());
    this.messageSoundHooks = new MessageSoundHooks({
      isSoundEnabled: () => this.clientOptions.soundEnabled,
    });
    this.messageSoundHooks.setEnabled(this.clientOptions.soundEnabled);
    this.initThreeJS();
    this.initUI();
    this.initVr();
    this.connectToRuntime();
    this.uiAdapter.setNumberPadModeEnabled(this.numberPadModeEnabled);
    this.uiAdapter.setRepeatActionVisible(false);
    this.uiAdapter.setGameOver({ ...this.gameOverState });

    if (this.playMode === "fps") {
      this.camera.fov = this.resolveFpsCameraFov();
      this.camera.updateProjectionMatrix();
      this.cameraDistance = 0;
      this.cameraPitch = 0;
      this.cameraYaw = Math.PI;
      this.cameraFollowInitialized = true;
    } else {
      // Set initial camera position looking straight down with a slight tilt
      this.cameraDistance = 15;
      this.cameraPitch = THREE.MathUtils.clamp(
        Math.PI / 2 - 0.2,
        this.minCameraPitch,
        this.maxCameraPitch,
      );
      // Yaw is in radians; start at 180 degrees to face the board correctly.
      this.cameraYaw = Math.PI;
    }
    this.updateMinimapVisibility();
    this.applyClientOptions(this.clientOptions);
  }

  private initThreeJS(): void {
    // --- Basic Three.js setup ---
    const viewport = this.getRendererViewportSize();
    this.scene = new THREE.Scene();
    this.worldRoot = new THREE.Group();
    this.worldRoot.name = "nh3d-world-root";
    this.scene.add(this.worldRoot);
    this.camera = new THREE.PerspectiveCamera(
      75,
      viewport.width / viewport.height,
      0.1,
      1000,
    );
    this.camera.up.set(0, 0, 1);
    // Post-processing AA is driven by the client option (TAA/FXAA).
    // Use transparent clear so post-processing can affect scene content only.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.xr.enabled = true;
    this.initAntialiasingPipeline();
    this.updateRendererResolution();
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.backgroundColor = "";
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.loadTilesetTexture(normalizeNh3dClientOptions(this.clientOptions));

    Object.values(this.materials).forEach((material) => {
      this.patchMaterialForVignette(material);
    });

    const host = this.mountElement ?? document.body;
    host.style.backgroundColor = "#000011";
    host.appendChild(this.renderer.domElement);
    this.loadCameraSmoothingFromCSS();

    // --- Lighting ---
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(10, 10, 5);
    this.directionalLight.castShadow = false;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(this.directionalLight);
    this.configureBaseLightingForPlayMode();

    // --- Event Listeners ---
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    window.addEventListener("keydown", this.handleKeyDown.bind(this), false);
    window.addEventListener("keyup", this.handleKeyUp.bind(this), false);
    window.addEventListener("blur", this.handleWindowBlur.bind(this), false);
    document.addEventListener(
      "pointerlockchange",
      this.handlePointerLockChange.bind(this),
      false,
    );

    // Mouse controls for camera
    window.addEventListener("wheel", this.handleMouseWheel.bind(this), false);
    window.addEventListener(
      "mousedown",
      this.handleMouseDown.bind(this),
      false,
    );
    window.addEventListener(
      "mousemove",
      this.handleMouseMove.bind(this),
      false,
    );
    window.addEventListener("mouseup", this.handleMouseUp.bind(this), false);
    this.renderer.domElement.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this),
      { passive: false },
    );
    this.renderer.domElement.addEventListener(
      "touchmove",
      this.handleTouchMove.bind(this),
      { passive: false },
    );
    this.renderer.domElement.addEventListener(
      "touchend",
      this.handleTouchEnd.bind(this),
      { passive: false },
    );
    this.renderer.domElement.addEventListener(
      "touchcancel",
      this.handleTouchCancel.bind(this),
      false,
    );
    window.addEventListener("contextmenu", (e) => e.preventDefault(), false); // Prevent right-click menu

    // Start render loop
    this.renderer.setAnimationLoop(this.animateFrameCallback);
  }

  private initVr(): void {
    const bridge: VrEngineBridge = {
      getPlayMode: () => this.playMode,
      getPlayerTilePosition: () => ({ ...this.playerPos }),
      getClientOptions: () => this.clientOptions,
      setClientOptions: (options) => {
        this.applyClientOptions(options);
      },
      resolveTileTargetFromRay: (raycaster, requireMesh) =>
        this.resolveTileTargetFromRaycaster(raycaster, requireMesh),
      runVrPrimaryAction: (target) => {
        this.runVrPrimaryAction(target);
      },
      runVrSecondaryAction: (target) => {
        this.runVrSecondaryAction(target);
      },
      setVrHoveredTile: (target) => {
        this.setVrHoveredTile(target);
      },
      setVrQuickPanelVisible: (visible) => {
        this.setVrQuickPanelVisibleState(visible);
      },
      getVrQuickPanelVisible: () => this.vrQuickPanelVisible,
      setXrAvailability: (state) => {
        this.uiAdapter.setXrAvailability(state);
      },
      setXrSessionState: (state) => {
        this.uiAdapter.setXrSessionState(state);
      },
      setPlayerUiNumbersWorldProjection: (enabled) => {
        this.playerUiNumbersUseWorldProjectionForVr = enabled;
      },
      clearPointerLockForVr: () => {
        this.clearPointerLockForVr();
      },
      shouldSuspendVrForUi: () => this.isTextInputActive,
    };

    this.vrSessionController = new VrSessionController({
      renderer: this.renderer,
      scene: this.scene,
      worldRoot: this.worldRoot,
      bridge,
      domOverlayRoot: this.vrDomOverlayRoot,
    });
    void this.refreshVrAvailability();
  }

  private async refreshVrAvailability(): Promise<void> {
    if (!this.vrSessionController) {
      return;
    }
    await this.vrSessionController.refreshAvailability(this.clientOptions);
  }

  private isVrPresenting(): boolean {
    return Boolean(this.renderer?.xr?.isPresenting);
  }

  private getActiveViewCamera(): THREE.Camera & THREE.Object3D {
    if (this.isVrPresenting()) {
      return this.renderer.xr.getCamera() as THREE.Camera & THREE.Object3D;
    }
    return this.camera;
  }

  private getActivePerspectiveViewCamera(): THREE.PerspectiveCamera {
    if (!this.isVrPresenting()) {
      return this.camera;
    }
    const xrCamera = this.renderer.xr.getCamera();
    if (xrCamera instanceof THREE.ArrayCamera) {
      const eyeCamera = xrCamera.cameras[0];
      if (eyeCamera) {
        return eyeCamera as THREE.PerspectiveCamera;
      }
    }
    return xrCamera as THREE.PerspectiveCamera;
  }

  private addWorldObject(object: THREE.Object3D): void {
    this.worldRoot.add(object);
  }

  private removeWorldObject(object: THREE.Object3D): void {
    this.worldRoot.remove(object);
  }

  private setVrQuickPanelVisibleState(visible: boolean): void {
    this.vrQuickPanelVisible = Boolean(visible);
    this.uiAdapter.setVrQuickPanelVisible(this.vrQuickPanelVisible);
  }

  private clearPointerLockForVr(): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.fpsPointerLockActive = false;
    this.fpsPointerLockRestorePending = false;
  }

  private syncVrCameraAimFromHeadset(): void {
    if (!this.isVrPresenting() || !this.isFpsMode()) {
      return;
    }
    const viewCamera = this.getActiveViewCamera();
    viewCamera.getWorldDirection(this.activeViewDirection);
    this.cameraYaw = this.wrapAngle(
      Math.atan2(-this.activeViewDirection.x, -this.activeViewDirection.y),
    );
    this.cameraPitch = THREE.MathUtils.clamp(
      Math.asin(THREE.MathUtils.clamp(this.activeViewDirection.z, -1, 1)),
      this.firstPersonPitchMin,
      this.firstPersonPitchMax,
    );
  }

  private loadCameraSmoothingFromCSS(): void {
    const cssValue = getComputedStyle(document.documentElement)
      .getPropertyValue("--camera-follow-half-life-ms")
      .trim();
    const parsed = Number.parseFloat(cssValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.cameraFollowHalfLifeMs = parsed;
    }
  }

  private ensureMinimapOverlay(): void {
    if (this.minimapContainer && this.minimapCanvasContext) {
      return;
    }

    const container = document.createElement("div");
    container.className = "nh3d-minimap";
    container.setAttribute("aria-label", "Dungeon minimap");

    const mapCanvas = document.createElement("canvas");
    mapCanvas.className = "nh3d-minimap-canvas";
    mapCanvas.width = MINIMAP_WIDTH_TILES;
    mapCanvas.height = MINIMAP_HEIGHT_TILES;
    const mapContext = mapCanvas.getContext("2d");
    if (!mapContext) {
      return;
    }
    mapContext.imageSmoothingEnabled = false;
    container.appendChild(mapCanvas);

    const viewportCanvas = document.createElement("canvas");
    viewportCanvas.className = "nh3d-minimap-viewport";
    viewportCanvas.width = MINIMAP_WIDTH_TILES;
    viewportCanvas.height = MINIMAP_HEIGHT_TILES;
    const viewportContext = viewportCanvas.getContext("2d");
    if (!viewportContext) {
      return;
    }
    viewportContext.imageSmoothingEnabled = false;
    container.appendChild(viewportCanvas);

    container.addEventListener(
      "pointerdown",
      this.handleMinimapPointerDown.bind(this),
      false,
    );
    container.addEventListener(
      "pointermove",
      this.handleMinimapPointerMove.bind(this),
      false,
    );
    container.addEventListener(
      "pointerup",
      this.handleMinimapPointerUp.bind(this),
      false,
    );
    container.addEventListener(
      "pointercancel",
      this.handleMinimapPointerUp.bind(this),
      false,
    );
    container.addEventListener(
      "lostpointercapture",
      this.handleMinimapPointerUp.bind(this),
      false,
    );
    document.body.appendChild(container);

    this.minimapContainer = container;
    this.minimapCanvasContext = mapContext;
    this.minimapViewportContext = viewportContext;
    this.updateMinimapPresentation();
    this.resetMinimap();
    this.renderMinimapViewportOverlay();
  }

  private resetMinimap(): void {
    this.pendingMinimapCellUpdates.clear();
    this.minimapFlushScheduled = false;
    this.minimapCells.fill(0);
    this.stopMinimapDrag();

    if (this.minimapCanvasContext) {
      this.minimapCanvasContext.clearRect(
        0,
        0,
        MINIMAP_WIDTH_TILES,
        MINIMAP_HEIGHT_TILES,
      );
      this.minimapCanvasContext.fillStyle = this.minimapPalette[0];
      this.minimapCanvasContext.fillRect(
        0,
        0,
        MINIMAP_WIDTH_TILES,
        MINIMAP_HEIGHT_TILES,
      );
    }
    if (this.minimapViewportContext) {
      this.minimapViewportContext.clearRect(
        0,
        0,
        MINIMAP_WIDTH_TILES,
        MINIMAP_HEIGHT_TILES,
      );
    }
  }

  private updateMinimapVisibility(): void {
    if (!this.minimapContainer) {
      return;
    }

    const visible =
      this.clientOptions.minimap && this.runtimeConnectionState === "running";
    this.minimapContainer.style.display = visible ? "" : "none";
    this.minimapContainer.style.pointerEvents = visible ? "auto" : "none";
    this.minimapContainer.setAttribute(
      "aria-hidden",
      visible ? "false" : "true",
    );
    this.updateMinimapPresentation();
    if (!visible) {
      this.stopMinimapDrag();
      return;
    }
    this.renderMinimapViewportOverlay();
  }

  private updateMinimapPresentation(): void {
    if (!this.minimapContainer) {
      return;
    }
    const fpsMode = this.isFpsMode();
    this.minimapContainer.classList.toggle("nh3d-minimap-fps", fpsMode);
  }

  private parseTileStateSignature(signature: string): {
    glyph: number;
    char?: string;
    color?: number;
    tileIndex?: number;
  } | null {
    const parts = String(signature || "").split("|");
    if (parts.length < 2) {
      return null;
    }

    const glyphToken = parts.shift();
    const lastToken = parts.pop();
    if (!glyphToken || lastToken === undefined) {
      return null;
    }

    const glyph = Number.parseInt(glyphToken, 10);
    if (!Number.isFinite(glyph)) {
      return null;
    }

    let tileIndexToken: string | undefined;
    let colorToken: string = lastToken;
    if (lastToken.startsWith("ti:")) {
      tileIndexToken = lastToken.slice(3);
      const explicitColorToken = parts.pop();
      if (explicitColorToken === undefined) {
        return null;
      }
      colorToken = explicitColorToken;
    }

    const joinedChar = parts.join("|");
    const normalizedChar = joinedChar.length > 0 ? joinedChar : undefined;
    const color =
      colorToken.trim().length > 0 ? Number.parseInt(colorToken, 10) : NaN;
    const tileIndex =
      typeof tileIndexToken === "string" && tileIndexToken.trim().length > 0
        ? Number.parseInt(tileIndexToken, 10)
        : NaN;
    return {
      glyph,
      char: normalizedChar,
      color: Number.isFinite(color) ? color : undefined,
      tileIndex: Number.isFinite(tileIndex) ? tileIndex : undefined,
    };
  }

  private parseTileKey(key: string): { x: number; y: number } | null {
    const [rawX, rawY] = String(key || "").split(",");
    const x = Number.parseInt(rawX, 10);
    const y = Number.parseInt(rawY, 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  private getTileSnapshotFromStateCache(key: string): TerrainSnapshot | null {
    const signature = this.tileStateCache.get(key);
    if (!signature) {
      return null;
    }
    const parsed = this.parseTileStateSignature(signature);
    if (!parsed) {
      return null;
    }
    return {
      glyph: parsed.glyph,
      char: parsed.char,
      color: parsed.color,
      tileIndex: parsed.tileIndex,
    };
  }

  private hasAuthoritativeTileDataForDarkCorridorInference(
    key: string,
  ): boolean {
    return (
      this.tileStateCache.has(key) ||
      this.lastKnownTerrain.has(key) ||
      this.fpsFlatFeatureUnderPlayerCache.has(key) ||
      this.pendingTileUpdates.has(key)
    );
  }

  private isBoulderKnownAtKeyForDarkCorridorInference(key: string): boolean {
    const terrain = this.getTileSnapshotFromStateCache(key);
    if (!terrain) {
      return false;
    }
    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: terrain.char ?? null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null,
    });
    if (behavior.effective.glyph === 2353) {
      return true;
    }
    return this.isBoulderLikeBehavior(behavior);
  }

  private isPetKnownAtKeyForDarkCorridorInference(key: string): boolean {
    const terrain = this.getTileSnapshotFromStateCache(key);
    if (!terrain) {
      return false;
    }
    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: terrain.char ?? null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null,
    });
    return behavior.effective.kind === "pet";
  }

  private isBoulderOrPetKnownAtKeyForDarkCorridorInference(
    key: string,
  ): boolean {
    return (
      this.isBoulderKnownAtKeyForDarkCorridorInference(key) ||
      this.isPetKnownAtKeyForDarkCorridorInference(key)
    );
  }

  private buildBoulderPushDarkCorridorInferenceContext(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): { playerX: number; playerY: number; dx: number; dy: number } | null {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return null;
    }

    const destinationKey = `${toX},${toY}`;
    if (
      !this.isBoulderOrPetKnownAtKeyForDarkCorridorInference(destinationKey)
    ) {
      return null;
    }

    return {
      playerX: toX,
      playerY: toY,
      dx,
      dy,
    };
  }

  private applyBoulderPushDarkCorridorWallOverride(
    nextInferred: Map<string, { x: number; y: number }>,
    context: {
      playerX: number;
      playerY: number;
      dx: number;
      dy: number;
    } | null,
  ): void {
    if (!context || this.isPlayerBlindForDarkCorridorInference()) {
      return;
    }
    if (
      this.playerPos.x !== context.playerX ||
      this.playerPos.y !== context.playerY
    ) {
      return;
    }

    const playerKey = `${context.playerX},${context.playerY}`;
    if (this.isBoulderOrPetKnownAtKeyForDarkCorridorInference(playerKey)) {
      return;
    }

    const leftDx = -context.dy;
    const leftDy = context.dx;
    const rightDx = context.dy;
    const rightDy = -context.dx;
    const lateralOffsets = [
      { dx: leftDx, dy: leftDy },
      { dx: rightDx, dy: rightDy },
    ];
    const forwardDiagonalOffsets = [
      { dx: context.dx + leftDx, dy: context.dy + leftDy },
      { dx: context.dx + rightDx, dy: context.dy + rightDy },
    ];

    for (const offset of lateralOffsets) {
      const neighborX = context.playerX + offset.dx;
      const neighborY = context.playerY + offset.dy;
      if (!this.isValidMinimapCoordinate(neighborX, neighborY)) {
        continue;
      }

      const neighborKey = `${neighborX},${neighborY}`;
      if (this.hasAuthoritativeTileDataForDarkCorridorInference(neighborKey)) {
        continue;
      }
      if (!this.shouldInferDarkCorridorWallAt(neighborKey)) {
        continue;
      }
      nextInferred.set(neighborKey, { x: neighborX, y: neighborY });
    }

    for (const offset of forwardDiagonalOffsets) {
      const neighborX = context.playerX + offset.dx;
      const neighborY = context.playerY + offset.dy;
      if (!this.isValidMinimapCoordinate(neighborX, neighborY)) {
        continue;
      }

      const neighborKey = `${neighborX},${neighborY}`;
      if (this.hasAuthoritativeTileDataForDarkCorridorInference(neighborKey)) {
        continue;
      }
      if (!this.shouldInferDarkCorridorWallAt(neighborKey)) {
        continue;
      }
      nextInferred.set(neighborKey, { x: neighborX, y: neighborY });
    }
  }

  private beginDarkCorridorDiscoveryWindowFromPlayerInput(): void {
    this.darkCorridorInputDiscoveryWindowActive = true;
    this.newlyDiscoveredDarkCorridorTilesForCurrentInput.clear();
  }

  private isTileKnownAsDarkCorridorFromCaches(key: string): boolean {
    const terrain = this.getKnownTerrainSnapshotForInferenceAtKey(key);
    return Boolean(terrain && isDarkCorridorCmapGlyph(terrain.glyph));
  }

  private recordNewlyDiscoveredDarkCorridorTileForCurrentInput(
    tile: any,
  ): void {
    if (
      !this.darkCorridorInputDiscoveryWindowActive ||
      !tile ||
      typeof tile.x !== "number" ||
      typeof tile.y !== "number" ||
      typeof tile.glyph !== "number"
    ) {
      return;
    }

    if (!this.isValidMinimapCoordinate(tile.x, tile.y)) {
      return;
    }
    if (!isDarkCorridorCmapGlyph(tile.glyph)) {
      return;
    }

    const key = `${tile.x},${tile.y}`;
    if (this.isTileKnownAsDarkCorridorFromCaches(key)) {
      return;
    }

    this.newlyDiscoveredDarkCorridorTilesForCurrentInput.set(key, {
      x: tile.x,
      y: tile.y,
    });
  }

  private getKnownTerrainSnapshotForInferenceAtKey(
    key: string,
  ): TerrainSnapshot | null {
    const cachedTerrain = this.lastKnownTerrain.get(key);
    if (cachedTerrain) {
      return cachedTerrain;
    }

    const cachedFlatFeature = this.fpsFlatFeatureUnderPlayerCache.get(key);
    if (cachedFlatFeature) {
      return cachedFlatFeature;
    }

    return this.getTileSnapshotFromStateCache(key);
  }

  private getDoorwayActivationCharForInference(
    terrain: TerrainSnapshot,
  ): string | null {
    if (typeof terrain.char === "string" && terrain.char.length > 0) {
      return terrain.char.charAt(0);
    }

    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: terrain,
    });
    if (
      typeof behavior.glyphChar === "string" &&
      behavior.glyphChar.length > 0
    ) {
      return behavior.glyphChar.charAt(0);
    }
    return null;
  }

  private shouldUsePlayerTileAsDarkCorridorInferenceOrigin(): boolean {
    const playerKey = `${this.playerPos.x},${this.playerPos.y}`;
    const terrain = this.getKnownTerrainSnapshotForInferenceAtKey(playerKey);
    if (!terrain || typeof terrain.glyph !== "number") {
      return false;
    }
    if (isDoorwayCmapGlyph(terrain.glyph)) {
      return true;
    }

    const activationChar = this.getDoorwayActivationCharForInference(terrain);
    return Boolean(
      activationChar &&
      this.darkCorridorDiscoveryDoorwayChars.has(activationChar),
    );
  }

  private classifyAuthoritativeTileForDarkCorridorInference(
    key: string,
  ): TileBehaviorResult | null {
    const terrain = this.lastKnownTerrain.get(key);
    if (terrain) {
      return classifyTileBehavior({
        glyph: terrain.glyph,
        runtimeChar: terrain.char ?? null,
        runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
        runtimeTileIndex:
          typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
        priorTerrain: terrain,
      });
    }

    const snapshot = this.getTileSnapshotFromStateCache(key);
    if (!snapshot) {
      return null;
    }
    return classifyTileBehavior({
      glyph: snapshot.glyph,
      runtimeChar: snapshot.char ?? null,
      runtimeColor: typeof snapshot.color === "number" ? snapshot.color : null,
      runtimeTileIndex:
        typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
      priorTerrain: null,
    });
  }

  private collectDiscoveredDarkCorridorTiles(): Map<
    string,
    { x: number; y: number }
  > {
    const discovered = new Map<string, { x: number; y: number }>();

    const tryAddKey = (key: string, glyph: number): void => {
      if (!isDarkCorridorCmapGlyph(glyph)) {
        return;
      }
      const parsedKey = this.parseTileKey(key);
      if (!parsedKey) {
        return;
      }
      if (!this.isValidMinimapCoordinate(parsedKey.x, parsedKey.y)) {
        return;
      }
      discovered.set(key, parsedKey);
    };

    for (const [key, terrain] of this.lastKnownTerrain.entries()) {
      if (terrain && typeof terrain.glyph === "number") {
        tryAddKey(key, terrain.glyph);
      }
    }

    for (const [key, signature] of this.tileStateCache.entries()) {
      if (discovered.has(key)) {
        continue;
      }
      const parsed = this.parseTileStateSignature(signature);
      if (!parsed) {
        continue;
      }
      tryAddKey(key, parsed.glyph);
    }

    return discovered;
  }

  private getGreatestCommonDivisor(a: number, b: number): number {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y !== 0) {
      const remainder = x % y;
      x = y;
      y = remainder;
    }
    return x;
  }

  private isDarkCorridorWallInferenceEnabled(): boolean {
    const runtimeVersion =
      this.characterCreationConfig.runtimeVersion ?? "3.6.7";
    return (
      runtimeVersion === "3.6.7" && this.clientOptions.darkCorridorWalls367
    );
  }

  private resolveInferredDarkCorridorWallTileTextureIndex(
    fallbackTileIndex: number,
    isInferredDarkCorridorWall: boolean,
  ): number {
    if (!isInferredDarkCorridorWall) {
      return fallbackTileIndex;
    }
    if (this.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return fallbackTileIndex;
    }
    if (!this.clientOptions.darkCorridorWallTileOverrideEnabled) {
      return fallbackTileIndex;
    }
    const overrideTileIndex = Math.trunc(
      this.clientOptions.darkCorridorWallTileOverrideTileId,
    );
    if (!Number.isFinite(overrideTileIndex) || overrideTileIndex < 0) {
      return fallbackTileIndex;
    }
    return overrideTileIndex;
  }

  private resolveInferredDarkCorridorWallSolidColorHex(
    isInferredDarkCorridorWall: boolean,
  ): string | null {
    if (!isInferredDarkCorridorWall) {
      return null;
    }
    if (!this.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return null;
    }
    const preferredHex = this.isFpsMode()
      ? this.clientOptions.darkCorridorWallSolidColorHexFps
      : this.clientOptions.darkCorridorWallSolidColorHex;
    const fallbackHex = this.clientOptions.darkCorridorWallSolidColorHex;
    const normalized = String(preferredHex || fallbackHex || "").trim();
    const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) {
      return null;
    }
    return `#${match[1].toLowerCase()}`;
  }

  private resolveInferredDarkCorridorWallSolidColorGridEnabled(
    isInferredDarkCorridorWall: boolean,
  ): boolean {
    if (!isInferredDarkCorridorWall) {
      return false;
    }
    if (!this.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return false;
    }
    return this.clientOptions.darkCorridorWallSolidColorGridEnabled === true;
  }

  private resolveInferredDarkCorridorWallSolidColorGridDarknessPercent(
    isInferredDarkCorridorWall: boolean,
  ): number {
    if (!isInferredDarkCorridorWall) {
      return 15;
    }
    if (!this.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return 15;
    }
    const raw =
      this.clientOptions.darkCorridorWallSolidColorGridDarknessPercent;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return 15;
    }
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  private getDarkCorridorRayDepthFromPlayer(
    tileX: number,
    tileY: number,
  ): { rayKey: string; depth: number } | null {
    const dx = tileX - this.playerPos.x;
    const dy = tileY - this.playerPos.y;
    if (dx === 0 && dy === 0) {
      return null;
    }
    const gcd = this.getGreatestCommonDivisor(dx, dy);
    if (gcd <= 0) {
      return null;
    }
    return {
      rayKey: `${dx / gcd},${dy / gcd}`,
      depth: gcd,
    };
  }

  private buildDarkCorridorFrontierDepthByRay(
    darkCorridorTiles: Map<string, { x: number; y: number }>,
  ): Map<string, number> {
    const maxDepthByRay = new Map<string, number>();
    for (const tile of darkCorridorTiles.values()) {
      const rayDepth = this.getDarkCorridorRayDepthFromPlayer(tile.x, tile.y);
      if (!rayDepth) {
        continue;
      }
      const currentMax = maxDepthByRay.get(rayDepth.rayKey) ?? 0;
      if (rayDepth.depth > currentMax) {
        maxDepthByRay.set(rayDepth.rayKey, rayDepth.depth);
      }
    }
    return maxDepthByRay;
  }

  private canInferDarkCorridorWallsFromTile(
    tileX: number,
    tileY: number,
    frontierDepthByRay: Map<string, number>,
  ): boolean {
    if (tileX === this.playerPos.x && tileY === this.playerPos.y) {
      return true;
    }

    const rayDepth = this.getDarkCorridorRayDepthFromPlayer(tileX, tileY);
    if (!rayDepth) {
      return false;
    }
    const farthestDepthOnRay = frontierDepthByRay.get(rayDepth.rayKey);
    if (typeof farthestDepthOnRay !== "number") {
      return false;
    }

    // Frontier is computed per player-ray. We inset inference by one extra ring
    // so each ray keeps its outer bands as frontier.
    const inferenceDepthExclusive = Math.max(
      1,
      farthestDepthOnRay - this.darkCorridorInferenceRingInsetTiles,
    );
    return rayDepth.depth < inferenceDepthExclusive;
  }

  private shouldInferDarkCorridorWallAt(key: string): boolean {
    const mesh = this.tileMap.get(key);
    if (mesh && !mesh.userData?.isInferredDarkCorridorWall) {
      return false;
    }

    const knownBehavior =
      this.classifyAuthoritativeTileForDarkCorridorInference(key);
    if (!knownBehavior) {
      return true;
    }

    return this.isUndiscoveredKind(knownBehavior.effective.kind);
  }

  private clearInferredDarkCorridorWallMeshAt(
    key: string,
    tileX: number,
    tileY: number,
  ): void {
    this.inferredDarkCorridorWallTiles.delete(key);

    const mesh = this.tileMap.get(key);
    if (!mesh || !mesh.userData?.isInferredDarkCorridorWall) {
      return;
    }

    this.disposeWallSideTileOverlay(mesh);
    this.removeWorldObject(mesh);
    this.tileMap.delete(key);
    this.tileRevealStartMs.delete(key);
    this.activeEffectTileKeys.delete(key);
    this.removeMonsterBillboard(key);

    const overlay = this.glyphOverlayMap.get(key);
    if (overlay) {
      this.disposeGlyphOverlay(overlay);
      this.glyphOverlayMap.delete(key);
    }

    const undiscoveredFallbackBehavior = classifyTileBehavior({
      glyph: getDefaultFloorGlyph(),
      runtimeChar: ".",
      runtimeColor: null,
      priorTerrain: null,
    });
    this.queueMinimapTileUpdate(
      tileX,
      tileY,
      undiscoveredFallbackBehavior,
      true,
    );
    this.refreshFpsWallChamferGeometryNear(tileX, tileY);
    this.markLightingDirty();
  }

  private clearAllInferredDarkCorridorWallMeshes(): void {
    for (const [key, tile] of Array.from(
      this.inferredDarkCorridorWallTiles.entries(),
    )) {
      this.clearInferredDarkCorridorWallMeshAt(key, tile.x, tile.y);
    }

    for (const [key, mesh] of Array.from(this.tileMap.entries())) {
      if (!mesh.userData?.isInferredDarkCorridorWall) {
        continue;
      }
      const parsedKey = this.parseTileKey(key);
      if (!parsedKey) {
        continue;
      }
      this.clearInferredDarkCorridorWallMeshAt(key, parsedKey.x, parsedKey.y);
    }
  }

  private requestInferredDarkCorridorWallReconcile(options?: {
    forceImmediate?: boolean;
  }): void {
    if (options?.forceImmediate === true) {
      this.reconcileInferredDarkCorridorWalls();
      return;
    }
    this.reconcileInferredDarkCorridorWalls();
  }

  private reconcileInferredDarkCorridorWalls(): void {
    const pendingBoulderPushInference =
      this.pendingBoulderPushDarkCorridorInference;
    this.pendingBoulderPushDarkCorridorInference = null;

    if (!this.isDarkCorridorWallInferenceEnabled()) {
      this.clearAllInferredDarkCorridorWallMeshes();
      return;
    }

    if (!this.hasSeenPlayerPosition) {
      for (const [key, tile] of Array.from(
        this.inferredDarkCorridorWallTiles.entries(),
      )) {
        this.clearInferredDarkCorridorWallMeshAt(key, tile.x, tile.y);
      }
      return;
    }

    const darkCorridorTiles = this.collectDiscoveredDarkCorridorTiles();
    const frontierSeedDarkCorridorTiles = this
      .darkCorridorInputDiscoveryWindowActive
      ? this.newlyDiscoveredDarkCorridorTilesForCurrentInput
      : new Map<string, { x: number; y: number }>();
    const frontierDepthByRay = this.buildDarkCorridorFrontierDepthByRay(
      frontierSeedDarkCorridorTiles,
    );
    const inferenceSourceTiles = new Map(darkCorridorTiles);
    if (this.shouldUsePlayerTileAsDarkCorridorInferenceOrigin()) {
      const playerKey = `${this.playerPos.x},${this.playerPos.y}`;
      inferenceSourceTiles.set(playerKey, {
        x: this.playerPos.x,
        y: this.playerPos.y,
      });
    }
    const nextInferred = new Map<string, { x: number; y: number }>();

    for (const tile of inferenceSourceTiles.values()) {
      if (
        !this.canInferDarkCorridorWallsFromTile(
          tile.x,
          tile.y,
          frontierDepthByRay,
        )
      ) {
        continue;
      }

      for (const offset of this.darkCorridorWallNeighborOffsets) {
        const neighborX = tile.x + offset.dx;
        const neighborY = tile.y + offset.dy;
        if (!this.isValidMinimapCoordinate(neighborX, neighborY)) {
          continue;
        }

        const neighborKey = `${neighborX},${neighborY}`;
        if (darkCorridorTiles.has(neighborKey)) {
          continue;
        }
        if (!this.shouldInferDarkCorridorWallAt(neighborKey)) {
          continue;
        }
        nextInferred.set(neighborKey, { x: neighborX, y: neighborY });
      }
    }
    this.applyBoulderPushDarkCorridorWallOverride(
      nextInferred,
      pendingBoulderPushInference,
    );

    const darkWallGlyph = getDefaultDarkWallGlyph();
    const newlyInferredKeys = new Set<string>();
    for (const [key, tile] of nextInferred.entries()) {
      if (!this.inferredDarkCorridorWallTiles.has(key)) {
        newlyInferredKeys.add(key);
      }
      this.inferredDarkCorridorWallTiles.set(key, tile);
    }

    for (const [key, tile] of Array.from(
      this.inferredDarkCorridorWallTiles.entries(),
    )) {
      if (!this.shouldInferDarkCorridorWallAt(key)) {
        this.inferredDarkCorridorWallTiles.delete(key);
        continue;
      }

      const mesh = this.tileMap.get(key);
      if (mesh && !mesh.userData?.isInferredDarkCorridorWall) {
        continue;
      }

      this.updateTile(tile.x, tile.y, darkWallGlyph, " ", undefined, {
        inferredDarkCorridorWall: true,
        restartRevealFade: newlyInferredKeys.has(key),
      });
    }
  }

  private refreshTilesFromStateCache(): void {
    const snapshots: Array<{
      x: number;
      y: number;
      glyph: number;
      char?: string;
      color?: number;
      tileIndex?: number;
    }> = [];
    for (const [key, signature] of this.tileStateCache.entries()) {
      const [rawX, rawY] = key.split(",");
      const x = Number.parseInt(rawX, 10);
      const y = Number.parseInt(rawY, 10);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      const parsed = this.parseTileStateSignature(signature);
      if (!parsed) {
        continue;
      }
      snapshots.push({
        x,
        y,
        glyph: parsed.glyph,
        char: parsed.char,
        color: parsed.color,
        tileIndex: parsed.tileIndex,
      });
    }

    for (const snapshot of snapshots) {
      this.updateTile(
        snapshot.x,
        snapshot.y,
        snapshot.glyph,
        snapshot.char,
        snapshot.color,
        {
          runtimeTileIndex:
            typeof snapshot.tileIndex === "number"
              ? snapshot.tileIndex
              : undefined,
        },
      );
    }
    this.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
  }

  private applyPlayMode(nextPlayMode: PlayMode): void {
    const resolvedPlayMode: PlayMode =
      nextPlayMode === "fps" ? "fps" : "normal";
    if (this.playMode === resolvedPlayMode) {
      this.configureBaseLightingForPlayMode();
      this.markLightingDirty();
      return;
    }

    this.playMode = resolvedPlayMode;
    this.clientOptions.fpsMode = this.playMode === "fps";
    this.characterCreationConfig.playMode = this.playMode;
    this.clearFpsTouchGestures();
    this.isMiddleMouseDown = false;
    this.isRightMouseDown = false;
    this.rightMouseCanOpenContextMenuOnRelease = false;
    this.rightMouseDragExceededDeadzone = false;
    this.fpsAutoMoveDirection = null;
    this.fpsAutoTurnTargetYaw = null;
    this.fpsStepCameraActive = false;
    this.fpsPreviousPlayerTileForSuppression = null;
    this.closeAnyTileContextMenu(false);

    if (this.playMode === "fps") {
      const eyeX = this.playerPos.x * TILE_SIZE;
      const eyeY = -this.playerPos.y * TILE_SIZE;
      const currentYaw = Number.isFinite(this.cameraYaw)
        ? this.cameraYaw
        : Math.PI;
      this.camera.fov = this.resolveFpsCameraFov();
      this.camera.updateProjectionMatrix();
      this.cameraDistance = 0;
      this.cameraPitch = 0;
      this.cameraYaw = this.wrapAngle(currentYaw);
      this.cameraFollowInitialized = true;
      this.fpsStepCameraFrom.set(eyeX, eyeY, this.firstPersonEyeHeight);
      this.fpsStepCameraTo.set(eyeX, eyeY, this.firstPersonEyeHeight);
    } else {
      this.closeAnyTileContextMenu(false);
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      this.fpsFireSuppressionUntilMs = 0;
      this.clearAutomaticGlancePendingState();
      this.fpsCrosshairContextSignature = "";
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      this.fpsPointerLockActive = false;
      this.fpsPointerLockRestorePending = false;
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
      this.cameraDistance = 15;
      this.cameraYaw = Math.PI;
      this.cameraPitch = THREE.MathUtils.clamp(
        Math.PI / 2 - 0.2,
        this.minCameraPitch,
        this.maxCameraPitch,
      );
      this.cameraFollowInitialized = false;
      this.requestTileUpdate(this.playerPos.x, this.playerPos.y);
    }

    this.configureBaseLightingForPlayMode();
    this.updateMinimapPresentation();
    this.clearFloorBlockAmbientOcclusion();
    this.refreshTilesFromStateCache();
    this.syncFpsPointerLockForUiState(false);
    this.markLightingDirty();
  }

  private applyClientOptions(nextOptions: Nh3dClientOptions): void {
    const normalized = normalizeNh3dClientOptions(nextOptions);
    const previous = this.clientOptions;
    const playModeChanged = previous.fpsMode !== normalized.fpsMode;
    const vrAvailabilityChanged =
      previous.vrOfferOnSupportedDevice !== normalized.vrOfferOnSupportedDevice;
    const fpsFovChanged = previous.fpsFov !== normalized.fpsFov;
    const minimapChanged = previous.minimap !== normalized.minimap;
    const damageNumbersChanged =
      previous.damageNumbers !== normalized.damageNumbers;
    const tileShakeChanged =
      previous.tileShakeOnHit !== normalized.tileShakeOnHit;
    const bloodChanged = previous.blood !== normalized.blood;
    const monsterShatterChanged =
      previous.monsterShatter !== normalized.monsterShatter;
    const blockAmbientOcclusionChanged =
      previous.blockAmbientOcclusion !== normalized.blockAmbientOcclusion;
    const darkCorridorWallsChanged =
      previous.darkCorridorWalls367 !== normalized.darkCorridorWalls367;
    const darkCorridorWallTileOverrideChanged =
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
    const tilesetModeChanged = previous.tilesetMode !== normalized.tilesetMode;
    const tilesetPathChanged = previous.tilesetPath !== normalized.tilesetPath;
    const antialiasingChanged =
      previous.antialiasing !== normalized.antialiasing;
    const brightnessChanged = previous.brightness !== normalized.brightness;
    const contrastChanged = previous.contrast !== normalized.contrast;
    const gammaChanged = previous.gamma !== normalized.gamma;
    const soundEnabledChanged =
      previous.soundEnabled !== normalized.soundEnabled;

    this.clientOptions = normalized;

    if (playModeChanged) {
      this.applyPlayMode(normalized.fpsMode ? "fps" : "normal");
    }
    if (vrAvailabilityChanged) {
      void this.refreshVrAvailability();
    }
    if (fpsFovChanged && this.playMode === "fps") {
      this.camera.fov = this.resolveFpsCameraFov();
      this.camera.updateProjectionMatrix();
    }
    if (minimapChanged) {
      this.updateMinimapVisibility();
    }
    if (damageNumbersChanged && !normalized.damageNumbers) {
      this.clearPlayerDamageNumberParticles();
    }
    if (tileShakeChanged && !normalized.tileShakeOnHit) {
      this.clearGlyphDamageShakes();
    }
    if (bloodChanged && !normalized.blood) {
      this.clearBloodMistParticles();
    }
    if (monsterShatterChanged && !normalized.monsterShatter) {
      this.clearMonsterBillboardShardParticles();
    }
    if (tilesetPathChanged) {
      this.loadTilesetTexture(normalized);
    }
    if (
      tilesetBackgroundTileChanged ||
      tilesetBackgroundRemovalModeChanged ||
      tilesetSolidChromaKeyColorHexChanged
    ) {
      this.invalidateBillboardTextureCaches();
      this.refreshTilesFromStateCache();
    }
    if (tilesetModeChanged) {
      this.refreshTilesFromStateCache();
    }
    if (blockAmbientOcclusionChanged) {
      this.refreshAllFloorBlockAmbientOcclusion();
    }
    if (antialiasingChanged) {
      this.initAntialiasingPipeline();
      this.updateRendererResolution();
    }
    if (brightnessChanged || contrastChanged || gammaChanged) {
      this.updateToneAdjustPostProcess();
    }
    if (darkCorridorWallsChanged || darkCorridorWallTileOverrideChanged) {
      this.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
      this.markLightingDirty();
    }
    if (soundEnabledChanged && !normalized.soundEnabled) {
      this.pendingPlayerFootstepSoundArmed = false;
      this.clearPlayerCliparoundInputCooldown();
    }
    this.syncFmodRuntimeWithClientOptions(normalized.soundEnabled);
  }

  private shouldUseDesktopTextureAnisotropy(): boolean {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return true;
    }
    return !window.matchMedia("(pointer: coarse)").matches;
  }

  private resolveTextureAnisotropyLevel(): number {
    const maxAnisotropy = Math.max(
      1,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    const targetAnisotropy = this.shouldUseDesktopTextureAnisotropy() ? 8 : 2;
    return Math.min(targetAnisotropy, maxAnisotropy);
  }

  private configureTilesetTextureSampling(texture: THREE.Texture): void {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();
    texture.needsUpdate = true;
  }

  private invalidateTilesetDependentCaches(): void {
    this.disposeAllWallSideTileOverlays();
    for (const overlay of this.glyphOverlayMap.values()) {
      this.disposeGlyphOverlay(overlay);
    }
    this.glyphOverlayMap.clear();
    this.glyphTextureCache.forEach(({ texture }) => texture.dispose());
    this.glyphTextureCache.clear();

    for (const key of Array.from(this.monsterBillboards.keys())) {
      this.removeMonsterBillboard(key);
    }
    for (const entry of this.monsterBillboardTextures.values()) {
      entry.texture.dispose();
    }
    this.monsterBillboardTextures.clear();
    this.clearFpsWallChamferMaterialCaches();
    this.tilesetBackgroundTilePixelsCache.clear();
  }

  private invalidateBillboardTextureCaches(): void {
    for (const key of Array.from(this.monsterBillboards.keys())) {
      this.removeMonsterBillboard(key);
    }
    for (const entry of this.monsterBillboardTextures.values()) {
      entry.texture.dispose();
    }
    this.monsterBillboardTextures.clear();
    this.tilesetBackgroundTilePixelsCache.clear();
  }

  private loadTilesetTexture(options: Nh3dClientOptions): void {
    const tileset = findNh3dTilesetByPath(options.tilesetPath);
    const tilesetAssetUrl = resolveNh3dTilesetAssetUrl(options.tilesetPath);
    if (!tileset) {
      this.tilesetTexture?.dispose();
      this.tilesetTexture = null;
      this.tileSourceSize = 32;
      this.invalidateTilesetDependentCaches();
      if (this.clientOptions.tilesetMode === "tiles") {
        this.refreshTilesFromStateCache();
      }
      return;
    }

    this.tileSourceSize = 32;
    const textureLoader = new THREE.TextureLoader();
    let nextTexture: THREE.Texture;
    nextTexture = textureLoader.load(
      tilesetAssetUrl || tileset.path,
      () => {
        const atlasWidth = Math.max(
          0,
          Math.trunc(Number(nextTexture.image?.width) || 0),
        );
        this.tileSourceSize =
          inferNh3dTilesetTileSizeFromAtlasWidth(atlasWidth);
        this.configureTilesetTextureSampling(nextTexture);
        this.invalidateTilesetDependentCaches();
        if (this.clientOptions.tilesetMode === "tiles") {
          this.refreshTilesFromStateCache();
        }
      },
      undefined,
      () => {
        console.warn(`Failed to load tileset atlas: ${tileset.path}`);
      },
    );
    this.configureTilesetTextureSampling(nextTexture);
    if (this.tilesetTexture && this.tilesetTexture !== nextTexture) {
      this.tilesetTexture.dispose();
    }
    this.tilesetTexture = nextTexture;
  }

  private isValidMinimapCoordinate(x: number, y: number): boolean {
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      x < MINIMAP_WIDTH_TILES &&
      y >= 0 &&
      y < MINIMAP_HEIGHT_TILES
    );
  }

  private getMinimapCellIndex(x: number, y: number): number {
    return y * MINIMAP_WIDTH_TILES + x;
  }

  private resolveMinimapPaletteIndex(
    behavior: TileBehaviorResult,
    isUndiscovered: boolean,
  ): number {
    if (behavior.isPlayerGlyph || behavior.materialKind === "player") {
      return 12;
    }
    if (isUndiscovered) {
      return 1;
    }

    switch (behavior.materialKind) {
      case "wall":
      case "dark_wall":
        return 3;
      case "door":
        return 4;
      case "water":
      case "fountain":
        return 5;
      case "stairs_up":
      case "stairs_down":
        return 6;
      case "trap":
      case "feature":
      case "effect_warning":
      case "effect_zap":
      case "effect_explode":
      case "effect_swallow":
        return 7;
      case "item":
        return 8;
      case "monster_hostile":
        return 9;
      case "monster_friendly":
        return 10;
      case "monster_neutral":
        return 11;
      case "floor":
      case "dark":
      case "default":
      default:
        return 2;
    }
  }

  private queueMinimapTileUpdate(
    x: number,
    y: number,
    behavior: TileBehaviorResult,
    isUndiscovered: boolean,
  ): void {
    const tileX = Math.trunc(x);
    const tileY = Math.trunc(y);
    if (!this.isValidMinimapCoordinate(tileX, tileY)) {
      return;
    }

    const index = this.getMinimapCellIndex(tileX, tileY);
    const paletteIndex = this.resolveMinimapPaletteIndex(
      behavior,
      isUndiscovered,
    );
    const pending = this.pendingMinimapCellUpdates.get(index);
    if (pending === paletteIndex) {
      return;
    }
    if (
      !this.pendingMinimapCellUpdates.has(index) &&
      this.minimapCells[index] === paletteIndex
    ) {
      return;
    }

    this.pendingMinimapCellUpdates.set(index, paletteIndex);
    this.scheduleMinimapTileFlush();
  }

  private scheduleMinimapTileFlush(): void {
    if (this.minimapFlushScheduled) {
      return;
    }
    this.minimapFlushScheduled = true;
    requestAnimationFrame(() => {
      this.minimapFlushScheduled = false;
      this.flushPendingMinimapTileUpdates();
    });
  }

  private flushPendingMinimapTileUpdates(): void {
    if (!this.minimapCanvasContext || !this.pendingMinimapCellUpdates.size) {
      return;
    }

    for (const [
      index,
      paletteIndex,
    ] of this.pendingMinimapCellUpdates.entries()) {
      this.minimapCells[index] = paletteIndex;
      const x = index % MINIMAP_WIDTH_TILES;
      const y = Math.floor(index / MINIMAP_WIDTH_TILES);
      this.minimapCanvasContext.fillStyle =
        this.minimapPalette[paletteIndex] ?? this.minimapPalette[0];
      this.minimapCanvasContext.fillRect(x, y, 1, 1);
    }
    this.pendingMinimapCellUpdates.clear();
  }

  private computeMinimapViewportRect(): MinimapViewportRect {
    const viewCamera = this.getActivePerspectiveViewCamera();
    const centerWorldX = this.cameraFollowInitialized
      ? this.cameraFollowCurrent.x
      : this.playerPos.x * TILE_SIZE + this.cameraPanTargetX;
    const centerWorldY = this.cameraFollowInitialized
      ? this.cameraFollowCurrent.y
      : -this.playerPos.y * TILE_SIZE + this.cameraPanTargetY;
    const centerTileX = centerWorldX / TILE_SIZE;
    const centerTileY = -centerWorldY / TILE_SIZE;

    const fovRadians = THREE.MathUtils.degToRad(viewCamera.fov);
    const baseViewHeightWorld =
      2 * Math.tan(fovRadians / 2) * Math.max(1, this.cameraDistance);
    const baseViewWidthWorld =
      baseViewHeightWorld * Math.max(1, viewCamera.aspect);
    const pitchScale = 1 / Math.max(0.45, Math.sin(this.cameraPitch));

    const viewWidthTiles = THREE.MathUtils.clamp(
      (baseViewWidthWorld * pitchScale) / TILE_SIZE,
      4,
      MINIMAP_WIDTH_TILES,
    );
    const viewHeightTiles = THREE.MathUtils.clamp(
      (baseViewHeightWorld * pitchScale) / TILE_SIZE,
      3,
      MINIMAP_HEIGHT_TILES,
    );

    return {
      minX: centerTileX - viewWidthTiles / 2,
      minY: centerTileY - viewHeightTiles / 2,
      width: viewWidthTiles,
      height: viewHeightTiles,
    };
  }

  private renderMinimapViewportOverlay(): void {
    if (!this.minimapViewportContext) {
      return;
    }

    const viewport = this.computeMinimapViewportRect();
    const fpsMode = this.isFpsMode();
    const viewCamera = this.getActivePerspectiveViewCamera();

    const context = this.minimapViewportContext;
    context.clearRect(0, 0, MINIMAP_WIDTH_TILES, MINIMAP_HEIGHT_TILES);

    const drawMinX = THREE.MathUtils.clamp(
      viewport.minX,
      0,
      MINIMAP_WIDTH_TILES,
    );
    const drawMinY = THREE.MathUtils.clamp(
      viewport.minY,
      0,
      MINIMAP_HEIGHT_TILES,
    );
    const drawMaxX = THREE.MathUtils.clamp(
      viewport.minX + viewport.width,
      0,
      MINIMAP_WIDTH_TILES,
    );
    const drawMaxY = THREE.MathUtils.clamp(
      viewport.minY + viewport.height,
      0,
      MINIMAP_HEIGHT_TILES,
    );
    const drawWidth = Math.max(0, drawMaxX - drawMinX);
    const drawHeight = Math.max(0, drawMaxY - drawMinY);

    if (!fpsMode && drawWidth > 0 && drawHeight > 0) {
      context.fillStyle = "rgba(214, 233, 255, 0.08)";
      context.fillRect(drawMinX, drawMinY, drawWidth, drawHeight);

      context.strokeStyle = "rgba(214, 233, 255, 0.62)";
      context.lineWidth = 0.65;
      context.strokeRect(
        drawMinX + 0.325,
        drawMinY + 0.325,
        drawWidth,
        drawHeight,
      );
    }

    if (this.isValidMinimapCoordinate(this.playerPos.x, this.playerPos.y)) {
      if (fpsMode) {
        const playerX = this.playerPos.x + 0.5;
        const playerY = this.playerPos.y + 0.5;
        const forwardX = -Math.sin(this.cameraYaw);
        const forwardY = Math.cos(this.cameraYaw);
        const facingAngle = Math.atan2(forwardY, forwardX);
        const verticalFovRadians = THREE.MathUtils.degToRad(viewCamera.fov);
        const horizontalFovRadians =
          2 *
          Math.atan(
            Math.tan(verticalFovRadians * 0.5) *
              Math.max(0.1, viewCamera.aspect),
          );
        // Keep cone angle matched to the actual rendered camera FOV.
        const halfConeRadians = horizontalFovRadians * 0.5;
        // Shrink the rendered cone footprint proportionally while preserving angle.
        const baseConeRangeTiles = THREE.MathUtils.clamp(
          8 + horizontalFovRadians * 3.4,
          8,
          15,
        );
        const coneRangeTiles = baseConeRangeTiles * 0.68;

        const leftAngle = facingAngle - halfConeRadians;
        const rightAngle = facingAngle + halfConeRadians;
        const leftX = playerX + Math.cos(leftAngle) * coneRangeTiles;
        const leftY = playerY + Math.sin(leftAngle) * coneRangeTiles;
        const rightX = playerX + Math.cos(rightAngle) * coneRangeTiles;
        const rightY = playerY + Math.sin(rightAngle) * coneRangeTiles;

        context.save();
        context.beginPath();
        context.moveTo(playerX, playerY);
        context.lineTo(leftX, leftY);
        context.lineTo(rightX, rightY);
        context.closePath();
        const coneFillStyle = "rgba(166, 219, 255, 0.11)";
        context.fillStyle = coneFillStyle;
        context.fill();
        // Blend the far edge with the fill so it reads as a cone, not a triangle.
        context.strokeStyle = coneFillStyle;
        context.lineWidth = 0.36;
        context.stroke();

        // Keep only subtle side boundaries from the origin.
        context.beginPath();
        context.moveTo(playerX, playerY);
        context.lineTo(leftX, leftY);
        context.moveTo(playerX, playerY);
        context.lineTo(rightX, rightY);
        context.strokeStyle = "rgba(216, 240, 255, 0.34)";
        context.lineWidth = 0.44;
        context.stroke();

        context.beginPath();
        context.arc(playerX, playerY, 0.48, 0, Math.PI * 2, false);
        context.fillStyle = "rgba(250, 252, 255, 0.96)";
        context.fill();
        context.lineWidth = 0.22;
        context.strokeStyle = "rgba(36, 53, 79, 0.92)";
        context.stroke();

        const rightXDir = -forwardY;
        const rightYDir = forwardX;
        const noseX = playerX + forwardX * 0.92;
        const noseY = playerY + forwardY * 0.92;
        const tailCenterX = playerX - forwardX * 0.3;
        const tailCenterY = playerY - forwardY * 0.3;
        const tailLeftX = tailCenterX + rightXDir * 0.28;
        const tailLeftY = tailCenterY + rightYDir * 0.28;
        const tailRightX = tailCenterX - rightXDir * 0.28;
        const tailRightY = tailCenterY - rightYDir * 0.28;
        context.beginPath();
        context.moveTo(noseX, noseY);
        context.lineTo(tailLeftX, tailLeftY);
        context.lineTo(tailRightX, tailRightY);
        context.closePath();
        context.fillStyle = "rgba(96, 173, 236, 0.95)";
        context.fill();
        context.restore();
        return;
      }

      context.fillStyle = this.minimapPalette[12];
      context.fillRect(
        this.playerPos.x - 0.4,
        this.playerPos.y - 0.4,
        0.8,
        0.8,
      );
    }
  }

  private getMinimapPointerTile(
    event: PointerEvent,
  ): { x: number; y: number } | null {
    if (!this.minimapContainer) {
      return null;
    }
    const rect = this.minimapContainer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const relativeX = (event.clientX - rect.left) / rect.width;
    const relativeY = (event.clientY - rect.top) / rect.height;
    if (
      !Number.isFinite(relativeX) ||
      !Number.isFinite(relativeY) ||
      relativeX < 0 ||
      relativeX > 1 ||
      relativeY < 0 ||
      relativeY > 1
    ) {
      return null;
    }

    return {
      x: relativeX * MINIMAP_WIDTH_TILES,
      y: relativeY * MINIMAP_HEIGHT_TILES,
    };
  }

  private centerCameraOnMinimapTile(tileX: number, tileY: number): void {
    const clampedTileX = THREE.MathUtils.clamp(
      tileX,
      0,
      MINIMAP_WIDTH_TILES - 1,
    );
    const clampedTileY = THREE.MathUtils.clamp(
      tileY,
      0,
      MINIMAP_HEIGHT_TILES - 1,
    );

    const targetWorldX = clampedTileX * TILE_SIZE;
    const targetWorldY = -clampedTileY * TILE_SIZE;
    this.cameraPanTargetX = targetWorldX - this.playerPos.x * TILE_SIZE;
    this.cameraPanTargetY = targetWorldY + this.playerPos.y * TILE_SIZE;
    this.cameraPanX = this.cameraPanTargetX;
    this.cameraPanY = this.cameraPanTargetY;
    this.isCameraCenteredOnPlayer = false;
  }

  private recenterCameraOnPlayerIfNeeded(): void {
    if (this.isCameraCenteredOnPlayer) {
      return;
    }
    this.cameraPanX = 0;
    this.cameraPanY = 0;
    this.cameraPanTargetX = 0;
    this.cameraPanTargetY = 0;
    this.isCameraCenteredOnPlayer = true;
  }

  private handleMinimapPointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (
      this.isAnyModalVisible() ||
      this.isInQuestion ||
      this.isInDirectionQuestion
    ) {
      return;
    }

    const pointerTile = this.getMinimapPointerTile(event);
    if (!pointerTile) {
      return;
    }
    this.minimapDragPointerId = event.pointerId;
    this.centerCameraOnMinimapTile(pointerTile.x, pointerTile.y);
    if (this.minimapContainer) {
      this.minimapContainer.setPointerCapture(event.pointerId);
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  private handleMinimapPointerMove(event: PointerEvent): void {
    if (this.minimapDragPointerId !== event.pointerId) {
      return;
    }

    const pointerTile = this.getMinimapPointerTile(event);
    if (!pointerTile) {
      return;
    }
    this.centerCameraOnMinimapTile(pointerTile.x, pointerTile.y);

    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  private handleMinimapPointerUp(event: PointerEvent): void {
    if (
      this.minimapDragPointerId !== null &&
      this.minimapDragPointerId !== event.pointerId
    ) {
      return;
    }
    this.stopMinimapDrag();
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  private stopMinimapDrag(): void {
    if (
      this.minimapContainer &&
      this.minimapDragPointerId !== null &&
      this.minimapContainer.hasPointerCapture(this.minimapDragPointerId)
    ) {
      this.minimapContainer.releasePointerCapture(this.minimapDragPointerId);
    }
    this.minimapDragPointerId = null;
  }

  private updateCameraPanInertia(deltaSeconds: number): void {
    if (this.isCameraCenteredOnPlayer) {
      return;
    }
    const panDeltaX = this.cameraPanTargetX - this.cameraPanX;
    const panDeltaY = this.cameraPanTargetY - this.cameraPanY;
    if (Math.abs(panDeltaX) < 0.0001 && Math.abs(panDeltaY) < 0.0001) {
      return;
    }
    const alpha =
      1 -
      Math.exp((-Math.LN2 * deltaSeconds * 1000) / this.cameraPanHalfLifeMs);
    this.cameraPanX = THREE.MathUtils.lerp(
      this.cameraPanX,
      this.cameraPanTargetX,
      alpha,
    );
    this.cameraPanY = THREE.MathUtils.lerp(
      this.cameraPanY,
      this.cameraPanTargetY,
      alpha,
    );
  }

  private ensureMetaCommandModal(): HTMLDivElement {
    if (this.metaCommandModal) {
      return this.metaCommandModal;
    }

    const modal = document.createElement("div");
    modal.id = "meta-command-modal";
    modal.className = "nh3d-meta-command";
    modal.setAttribute("aria-hidden", "true");
    modal.textContent = "#";
    document.body.appendChild(modal);
    this.metaCommandModal = modal;
    return modal;
  }

  private projectWorldToScreen(
    worldX: number,
    worldY: number,
    worldZ: number,
  ): { x: number; y: number; visible: boolean } {
    const vector = new THREE.Vector3(worldX, worldY, worldZ);
    vector.project(this.getActivePerspectiveViewCamera());

    if (
      !Number.isFinite(vector.x) ||
      !Number.isFinite(vector.y) ||
      !Number.isFinite(vector.z)
    ) {
      return { x: 0, y: 0, visible: false };
    }

    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const x = canvasRect.left + ((vector.x + 1) * canvasRect.width) / 2;
    const y = canvasRect.top + ((-vector.y + 1) * canvasRect.height) / 2;
    const visible = vector.z >= -1 && vector.z <= 1;
    return { x, y, visible };
  }

  private updateMetaCommandModalPosition(): void {
    if (!this.metaCommandModeActive || !this.metaCommandModal) {
      return;
    }

    if (this.isFpsMode()) {
      const canvasRect = this.renderer.domElement.getBoundingClientRect();
      const anchorX = canvasRect.left + canvasRect.width * 0.5;
      const anchorY = canvasRect.top + Math.max(54, canvasRect.height * 0.2);
      this.metaCommandModal.style.visibility = "visible";
      this.metaCommandModal.style.left = `${Math.round(anchorX)}px`;
      this.metaCommandModal.style.top = `${Math.round(anchorY)}px`;
      return;
    }

    const projected = this.projectWorldToScreen(
      this.playerPos.x * TILE_SIZE,
      -this.playerPos.y * TILE_SIZE,
      WALL_HEIGHT + 0.3,
    );
    if (!projected.visible) {
      this.metaCommandModal.style.visibility = "hidden";
      return;
    }

    this.metaCommandModal.style.visibility = "visible";
    this.metaCommandModal.style.left = `${Math.round(projected.x)}px`;
    this.metaCommandModal.style.top = `${Math.round(projected.y - 34)}px`;
  }

  private updateMetaCommandModal(): void {
    const modal = this.metaCommandModal;
    if (!modal) {
      return;
    }

    if (!this.metaCommandModeActive) {
      modal.classList.remove("is-visible");
      modal.style.visibility = "hidden";
      modal.setAttribute("aria-hidden", "true");
      return;
    }

    modal.textContent = `#${this.metaCommandBuffer}`;
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    this.updateMetaCommandModalPosition();
  }

  private initUI(): void {
    this.ensureMetaCommandModal();
    this.ensureMinimapOverlay();
    this.uiAdapter.setStatus("Starting local NetHack runtime...");
    this.uiAdapter.setConnectionStatus("Disconnected", "disconnected");
    this.uiAdapter.setLoadingVisible(true);
    this.uiAdapter.setExtendedCommands([]);
    this.uiAdapter.setNewGamePrompt({ visible: false, reason: null });
    this.uiAdapter.setGameOver({ ...this.gameOverState });
  }

  private async initializeFmodRuntime(): Promise<void> {
    if (
      this.fmodRuntime.isInitialized() ||
      this.fmodRuntimeInitializationInFlight
    ) {
      return;
    }
    this.fmodRuntimeInitializationInFlight = true;
    try {
      await this.fmodRuntime.initialize();
      this.fmodRuntime.setEnabled(this.clientOptions.soundEnabled);
      if (!this.clientOptions.soundEnabled) {
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

  private syncFmodRuntimeWithClientOptions(soundEnabled: boolean): void {
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

  private resumeFmodFromUserGesture(): void {
    if (!this.clientOptions.soundEnabled) {
      return;
    }
    this.messageSoundHooks.resumeFromUserGesture();
    this.fmodRuntime.resumeFromUserGesture();
  }

  private getFmodAudioWorkletCopyModeHint(
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

  private isLikelyLocalhostOrigin(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    const host = window.location.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  private isLikelyElectronEnvironment(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /\belectron\b/i.test(navigator.userAgent || "");
  }

  private isLikelyCapacitorEnvironment(): boolean {
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

  private resolveDeploymentTarget(): string {
    const candidate =
      typeof import.meta.env.VITE_DEPLOY_TARGET === "string"
        ? import.meta.env.VITE_DEPLOY_TARGET.trim().toLowerCase()
        : "";
    if (!candidate) {
      return "web";
    }
    return candidate;
  }

  private resolveFmodRuntimeOptions(): FmodRuntimeOptions {
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

  private async connectToRuntime(): Promise<void> {
    console.log("Starting local NetHack runtime");
    this.runtimeTerminationPromptShown = false;
    this.setGameOverState(false, null);
    this.inventoryContextActionsEnabled = true;
    this.pendingInventoryDialog = false;
    this.pendingInventoryDialogOptions = null;
    this.statusConditionMask = 0;
    this.resetPlayerStatusDeltaTracking();
    this.pendingBoulderPushDarkCorridorInference = null;
    this.updateConnectionStatus("Starting", "starting");
    this.pendingPlayerTileRefreshOnNextPosition = true;

    await setActiveGlyphCatalog(
      this.characterCreationConfig.runtimeVersion ?? "3.6.7",
    );

    this.session = new WorkerRuntimeBridge(
      (payload: RuntimeEvent) => {
        this.handleRuntimeEvent(payload);
      },
      {
        runtimeVersion: this.characterCreationConfig.runtimeVersion ?? "3.6.7",
        characterCreation: {
          mode: this.characterCreationConfig.mode,
          name: this.characterCreationConfig.name,
          role: this.characterCreationConfig.role,
          race: this.characterCreationConfig.race,
          gender: this.characterCreationConfig.gender,
          align: this.characterCreationConfig.align,
        },
        loggingEnabled: isLoggingEnabled(),
      },
    );

    try {
      await this.session.start();
      this.session.setLoggingEnabled(isLoggingEnabled());
      this.updateConnectionStatus("Running", "running");
      this.updateStatus("Local NetHack runtime started");
      // this.addGameMessage("Local NetHack runtime started");
      if (this.isFpsMode()) {
        this.addGameMessage(
          "FPS mode active: WASD move, F search, left-click fire, right-click look/interact.",
        );
      }
      this.setLoadingVisible(false);
    } catch (error) {
      console.error("Failed to start local NetHack runtime:", error);
      this.updateConnectionStatus("Error", "error");
      this.updateStatus("Failed to start local NetHack runtime");
      this.addGameMessage("Failed to start local NetHack runtime");
      this.setLoadingVisible(true);
    }
  }

  private handleRuntimeEvent(event: RuntimeEvent): void {
    const data = event as RuntimeEvent & Record<string, any>;
    switch (data.type) {
      case "map_glyph":
        this.tryResolvePendingCharacterDamage(data);
        this.enqueueTileUpdate(data);
        break;

      case "map_glyph_batch":
        if (Array.isArray(data.tiles)) {
          for (const tile of data.tiles) {
            this.tryResolvePendingCharacterDamage(tile);
            this.enqueueTileUpdate(tile);
          }
        }
        break;

      case "player_position":
        if (this.positionInputModeActive) {
          console.log(
            `🎯 Ignoring player_position (${data.x}, ${data.y}) while position-input mode is active`,
          );
          break;
        }
        console.log(
          `🎯 Received player position update: (${data.x}, ${data.y})`,
        );
        const oldPos = { ...this.playerPos };
        this.playPlayerFootstepSoundFromCliparoundIfEligible(
          oldPos.x,
          oldPos.y,
          data.x,
          data.y,
        );
        this.pendingBoulderPushDarkCorridorInference =
          oldPos.x !== data.x || oldPos.y !== data.y
            ? this.buildBoulderPushDarkCorridorInferenceContext(
                oldPos.x,
                oldPos.y,
                data.x,
                data.y,
              )
            : null;
        this.recordPlayerMovement(oldPos.x, oldPos.y, data.x, data.y);
        if (oldPos.x !== data.x || oldPos.y !== data.y) {
          this.refreshPlayerCliparoundInputCooldownFromMovement();
        }
        this.playerPos = { x: data.x, y: data.y };
        if (oldPos.x !== data.x || oldPos.y !== data.y) {
          this.clearAutomaticGlancePendingState();
        }
        if (oldPos.x !== data.x || oldPos.y !== data.y) {
          this.closeAnyTileContextMenu(false);
        }
        this.flushPendingTileUpdatesForPlayerPositionReconcile();
        this.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
        if (this.isFpsMode()) {
          this.removeMonsterBillboard(`${data.x},${data.y}`);
        }
        this.markLightingDirty();
        console.log(
          `🎯 Player position changed from (${oldPos.x}, ${oldPos.y}) to (${data.x}, ${data.y})`,
        );
        this.updateStatus(`Player at (${data.x}, ${data.y}) - NetHack 3D`);
        if (this.pendingPlayerTileRefreshOnNextPosition) {
          this.pendingPlayerTileRefreshOnNextPosition = false;
          this.requestPlayerTileRefresh("player-position-sync");
        }
        break;

      case "position_input_state":
        this.setPositionInputMode(Boolean(data.active));
        break;

      case "position_cursor":
        if (typeof data.x === "number" && typeof data.y === "number") {
          this.setPositionCursorPosition(data.x, data.y);
        }
        break;

      case "text":
        if (this.shouldSkipMobileFpsClickLookPromptMessageEvent(data.text)) {
          break;
        }
        this.captureAutopickupStateFromMessage(data.text);
        this.captureFpsCrosshairGlanceMessage(data.text);
        {
          const playerKillHandled = this.captureMonsterDefeatFromMessage(
            data.text,
          );
          this.captureOtherMonsterKilledSoundFromMessage(
            data.text,
            playerKillHandled,
          );
        }
        this.captureDamageFromMessage(data.text);
        this.addGameMessage(data.text);
        break;

      case "raw_print":
        if (this.shouldSkipMobileFpsClickLookPromptMessageEvent(data.text)) {
          break;
        }
        this.captureAutopickupStateFromMessage(data.text);
        this.captureFpsCrosshairGlanceMessage(data.text);
        {
          const playerKillHandled = this.captureMonsterDefeatFromMessage(
            data.text,
          );
          this.captureOtherMonsterKilledSoundFromMessage(
            data.text,
            playerKillHandled,
          );
        }
        this.captureDamageFromMessage(data.text);
        this.addGameMessage(data.text);
        break;

      case "menu_item":
        // Menu rows are accumulated and delivered with question/inventory events.
        // Ignore incremental item updates to avoid noisy unknown-type logs.
        break;

      case "direction_question":
        {
          const repeatCandidate = this.consumeRepeatDirectionCandidate();
          if (repeatCandidate) {
            this.armRepeatableAction(repeatCandidate);
          }
        }
        if (this.tryAutoAnswerDirectionQuestionFromFpsContextAction()) {
          break;
        }
        if (this.tryAutoAnswerDirectionQuestionFromRepeat()) {
          break;
        }
        if (this.shouldCloseInventoryForPendingContextPrompt()) {
          this.hideInventoryDialog();
        }
        // Special handling for direction questions - show UI and pause movement
        this.isInQuestion = true;
        this.showDirectionQuestion(data.text);
        break;
      case "number_pad_mode":
        this.setNumberPadModeEnabled(Boolean(data.enabled));
        break;

      case "question":
        this.repeatAutoDirectionPending = false;
        this.repeatAutoDirectionArmedAtMs = 0;
        this.clearRepeatDirectionCandidate();
        this.skipNextMobileFpsClickLookPromptMessage = false;
        if (this.shouldCloseInventoryForPendingContextPrompt()) {
          this.hideInventoryDialog();
        }
        if (
          this.isGameOverPossessionsIdentifyQuestion(String(data.text || ""))
        ) {
          this.setGameOverState(true, null);
        }
        if (this.isCharacterCreationQuestion(String(data.text || ""))) {
          const payload = this.toCharacterCreationQuestionPayload(data);
          this.isInQuestion = true;
          this.showQuestion(
            payload.text,
            payload.choices,
            payload.defaultChoice,
            payload.menuItems,
          );
          return;
        }

        // For non-character creation questions, show normal dialog and pause movement
        this.isInQuestion = true;
        this.showQuestion(
          data.text,
          data.choices,
          data.default,
          data.menuItems,
        );
        break;

      case "text_request":
        this.repeatAutoDirectionPending = false;
        this.repeatAutoDirectionArmedAtMs = 0;
        this.clearRepeatDirectionCandidate();
        this.skipNextMobileFpsClickLookPromptMessage = false;
        if (this.shouldCloseInventoryForPendingContextPrompt()) {
          this.hideInventoryDialog();
        }
        this.showTextInputRequest(
          String(data.text || ""),
          typeof data.maxLength === "number" ? data.maxLength : 256,
        );
        break;

      case "inventory_update":
        // Handle inventory updates without showing dialog
        const nextInventory = Array.isArray(data.items)
          ? data.items.map((item: any) => ({ ...item }))
          : [];
        this.inventoryRefreshInFlight = false;
        const itemCount = nextInventory.length;
        const actualItems = nextInventory.filter(
          (item: any) => !item.isCategory,
        );
        console.log(
          `📦 Received inventory update with ${itemCount} total items (${actualItems.length} actual items)`,
        );

        // Replace current inventory state with latest snapshot.
        this.currentInventory = nextInventory;

        // If we have a pending inventory dialog request, show it now
        if (this.pendingInventoryDialog) {
          console.log("📦 Showing inventory dialog with fresh data");
          this.pendingInventoryDialog = false;
          const pendingDialogOptions = this.pendingInventoryDialogOptions;
          this.pendingInventoryDialogOptions = null;
          this.showInventoryDialog(pendingDialogOptions ?? undefined);
        } else if (
          this.gameOverState.active &&
          !this.isInventoryDialogVisible
        ) {
          this.showInventoryDialog({
            contextActionsEnabled: false,
          });
        }

        // Update inventory display if we have an inventory UI element
        this.updateInventoryDisplay(nextInventory);

        break;

      case "info_menu":
        this.lastInfoMenu = {
          title: String(data.title || "NetHack Information"),
          lines: this.normalizeInfoMenuLines(data.lines),
        };
        this.showInfoMenuDialog(
          this.lastInfoMenu.title,
          this.lastInfoMenu.lines,
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
          this.showPositionRequest(data.text);
        }
        break;

      case "name_request":
        // Runtime handles askname with startup-configured fallback to avoid
        // feedback loops from repeated async name_request events.
        console.log("Name request received from runtime:", data);
        break;

      case "extended_commands":
        this.uiAdapter.setExtendedCommands(
          this.normalizeRuntimeExtendedCommands(data.commands),
        );
        break;

      case "area_refresh_complete":
        console.log(
          `🔄 Area refresh completed: ${data.tilesRefreshed} tiles refreshed around (${data.centerX}, ${data.centerY})`,
        );
        this.addGameMessage(
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
        this.clearScene();
        this.pendingPlayerTileRefreshOnNextPosition = true;
        if (data.message) {
          this.addGameMessage(data.message);
        }
        break;

      case "status_update":
        console.log(
          `Status update: ${data.fieldName || data.field} = "${data.value}" (type=${data.valueType || "unknown"})`,
        );
        this.updatePlayerStats(data.field, data.value, data);
        break;

      case "damage_event":
        if (
          typeof data.x === "number" &&
          typeof data.y === "number" &&
          typeof data.amount === "number"
        ) {
          this.triggerDamageEffectsAtTile(data.x, data.y, data.amount);
        }
        break;

      case "runtime_terminated":
        this.handleRuntimeTermination(
          typeof data.reason === "string" ? data.reason : "",
        );
        break;

      case "runtime_error":
        this.handleRuntimeError(
          typeof data.error === "string" ? data.error : "",
        );
        break;

      default:
        console.log("Unknown message type:", data.type, data);
    }
  }

  private normalizeRuntimeExtendedCommands(rawCommands: unknown): string[] {
    if (!Array.isArray(rawCommands)) {
      return [];
    }

    const uniqueCommands: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawCommands) {
      const normalized = String(raw || "")
        .trim()
        .toLowerCase();
      if (!normalized || normalized === "#" || normalized === "?") {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      uniqueCommands.push(normalized);
    }
    return uniqueCommands;
  }

  private normalizeInfoMenuLines(rawLines: unknown): string[] {
    if (!Array.isArray(rawLines)) {
      return [];
    }
    return rawLines.map((line) =>
      String(line ?? "")
        .replace(/\r/g, "")
        .trimEnd(),
    );
  }

  private setGameOverState(active: boolean, deathMessage: string | null): void {
    this.gameOverState = {
      active: Boolean(active),
      deathMessage: deathMessage && deathMessage.trim() ? deathMessage : null,
    };
    this.uiAdapter.setGameOver({ ...this.gameOverState });
    if (this.isInventoryDialogVisible) {
      this.uiAdapter.setInventory(this.buildInventoryDialogState());
    }
  }

  private isGameOverPossessionsIdentifyQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes("do you want your possessions identified");
  }

  private isDamageFlashableBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph) {
      return true;
    }

    return this.isMonsterLikeBehavior(behavior);
  }

  private isMonsterLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph) {
      return false;
    }

    switch (behavior.effective.kind) {
      case "mon":
      case "pet":
      case "ridden":
      case "detect":
      case "invis":
        return true;
      default:
        return false;
    }
  }

  private isLootLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph) {
      return false;
    }

    switch (behavior.effective.kind) {
      case "obj":
      case "body":
        return true;
      default:
        return false;
    }
  }

  private isAltarLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph || behavior.resolved.kind !== "cmap") {
      return false;
    }
    if (behavior.materialKind !== "feature") {
      return false;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    return chars.some(
      (value) => typeof value === "string" && value.trim() === "_",
    );
  }

  private isTombstoneLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph || behavior.resolved.kind !== "cmap") {
      return false;
    }
    return (
      behavior.effective.glyph === 2387 || behavior.effective.tileIndex === 878
    );
  }

  private isAltarOrTombstoneLikeBehavior(
    behavior: TileBehaviorResult,
  ): boolean {
    return (
      this.isAltarLikeBehavior(behavior) ||
      this.isTombstoneLikeBehavior(behavior)
    );
  }

  private isGoldLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.effective.kind !== "obj") {
      return false;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    return chars.some(
      (value) => typeof value === "string" && value.trim() === "$",
    );
  }

  private isBoulderTileIndex(tileIndex: number): boolean {
    return (
      tileIndex === 844 ||
      tileIndex === 845 ||
      tileIndex === 869 ||
      tileIndex === 871
    );
  }

  private isBoulderLikeBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.effective.kind !== "obj") {
      return false;
    }
    const tileIndex = behavior.effective.tileIndex;
    if (this.isBoulderTileIndex(tileIndex)) {
      return true;
    }
    const chars = [
      behavior.glyphChar,
      behavior.effective.char,
      behavior.resolved.char,
    ];
    return chars.some(
      (value) => typeof value === "string" && value.trim() === "`",
    );
  }

  private captureAutopickupStateFromMessage(messageLike: unknown): void {
    if (typeof messageLike !== "string") {
      return;
    }
    const normalized = messageLike.trim().toLowerCase();
    if (!normalized.includes("autopickup")) {
      return;
    }
    if (/\b(off|disabled|deactivated)\b/.test(normalized)) {
      this.autoPickupEnabled = false;
      return;
    }
    if (/\b(on|enabled|activated)\b/.test(normalized)) {
      this.autoPickupEnabled = true;
    }
  }

  private classifyTilePayload(tile: any): TileBehaviorResult | null {
    if (
      !tile ||
      typeof tile.x !== "number" ||
      typeof tile.y !== "number" ||
      typeof tile.glyph !== "number"
    ) {
      return null;
    }

    const key = `${tile.x},${tile.y}`;
    return classifyTileBehavior({
      glyph: tile.glyph,
      runtimeChar: typeof tile.char === "string" ? tile.char : null,
      runtimeColor: typeof tile.color === "number" ? tile.color : null,
      runtimeTileIndex:
        typeof tile.tileIndex === "number" ? tile.tileIndex : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null,
    });
  }

  private snapshotPersistentTerrainFromTile(
    tile: any,
    behavior: TileBehaviorResult | null,
  ): TerrainSnapshot | null {
    if (!tile || typeof tile.glyph !== "number" || !behavior) {
      return null;
    }
    if (behavior.isPlayerGlyph) {
      return null;
    }
    if (!this.isPersistentTerrainKind(behavior.resolved.kind)) {
      return null;
    }
    return {
      glyph: tile.glyph,
      char: behavior.resolved.char ?? undefined,
      color: behavior.resolved.color ?? undefined,
      tileIndex: behavior.resolved.tileIndex,
    };
  }

  private shouldRenderFlatFeatureUnderFpsPlayer(
    behavior: TileBehaviorResult,
  ): boolean {
    if (behavior.isPlayerGlyph) {
      return false;
    }
    if (behavior.resolved.kind === "statue") {
      return true;
    }
    if (this.isLootLikeBehavior(behavior)) {
      if (this.isBoulderLikeBehavior(behavior)) {
        return false;
      }
      return !(this.autoPickupEnabled && this.isGoldLikeBehavior(behavior));
    }
    switch (behavior.materialKind) {
      case "stairs_up":
      case "stairs_down":
      case "fountain":
      case "trap":
      case "feature":
        return true;
      default:
        return false;
    }
  }

  private snapshotFlatFeatureUnderFpsPlayerFromTile(
    tile: any,
    behavior: TileBehaviorResult | null,
  ): TerrainSnapshot | null {
    if (!tile || typeof tile.glyph !== "number" || !behavior) {
      return null;
    }
    if (!this.shouldRenderFlatFeatureUnderFpsPlayer(behavior)) {
      return null;
    }
    return {
      glyph: tile.glyph,
      char: behavior.resolved.char ?? undefined,
      color: behavior.resolved.color ?? undefined,
      tileIndex: behavior.resolved.tileIndex,
    };
  }

  private seedTerrainCacheFromSupersededPendingUpdate(
    key: string,
    previousTile: any,
    nextTile: any,
  ): void {
    if (
      !nextTile ||
      typeof nextTile.x !== "number" ||
      typeof nextTile.y !== "number"
    ) {
      return;
    }
    const isPlayerTile =
      nextTile.x === this.playerPos.x && nextTile.y === this.playerPos.y;
    if (!isPlayerTile) {
      return;
    }
    const previousBehavior = this.classifyTilePayload(previousTile);
    const previousTerrain = this.snapshotPersistentTerrainFromTile(
      previousTile,
      previousBehavior,
    );
    if (!previousTerrain) {
      const previousFlatFeature =
        this.snapshotFlatFeatureUnderFpsPlayerFromTile(
          previousTile,
          previousBehavior,
        );
      if (previousFlatFeature) {
        this.fpsFlatFeatureUnderPlayerCache.set(key, previousFlatFeature);
      }
      return;
    }
    this.lastKnownTerrain.set(key, previousTerrain);
    const previousFlatFeature = this.snapshotFlatFeatureUnderFpsPlayerFromTile(
      previousTile,
      previousBehavior,
    );
    if (previousFlatFeature) {
      this.fpsFlatFeatureUnderPlayerCache.set(key, previousFlatFeature);
    }
  }

  private extractDamageAmountFromMessage(message: string): number | null {
    const patterns = [
      /\bfor\s+(-?\d+)\s+damage\b/i,
      /\btakes?\s+(-?\d+)\s+damage\b/i,
      /\bdeals?\s+(-?\d+)\s+damage\b/i,
      /\b(-?\d+)\s+points?\s+of\s+damage\b/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (!match || !match[1]) {
        continue;
      }

      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed !== 0) {
        return Math.abs(parsed);
      }
    }

    return null;
  }

  private isPlayerAttackMessage(message: string): boolean {
    if (/\byou miss\b/i.test(message)) {
      return false;
    }
    return /\byou\s+(?:hit|bite|kick|claw|slash|strike|punch|shoot|zap|stab|maul|wound|smite|throw|thrust)\b/i.test(
      message,
    );
  }

  private isPlayerHitMonsterMessage(message: string): boolean {
    return /\byou hit (?:the |an? )?.+[.!]?$/i.test(message);
  }

  private isMonsterDefeatMessage(message: string): boolean {
    return /\byou (?:kill|kills|killed|destroy|destroys|destroyed) (?:the |an? )?.+[.!]?$/i.test(
      message,
    );
  }

  private isAnyKillMessage(message: string): boolean {
    return /\b(?:kill|kills|killed)\b/i.test(message);
  }

  private getDirectionVectorFromInput(
    input: string,
  ): { dx: number; dy: number } | null {
    if (this.numberPadModeEnabled && /^[hjklyubn]$/i.test(input)) {
      return null;
    }

    switch (input) {
      case "k":
      case "K":
      case "ArrowUp":
      case "Numpad8":
        return { dx: 0, dy: -1 };
      case "j":
      case "J":
      case "ArrowDown":
      case "Numpad2":
        return { dx: 0, dy: 1 };
      case "h":
      case "H":
      case "ArrowLeft":
      case "Numpad4":
        return { dx: -1, dy: 0 };
      case "l":
      case "L":
      case "ArrowRight":
      case "Numpad6":
        return { dx: 1, dy: 0 };
      case "y":
      case "Y":
      case "Home":
      case "Numpad7":
        return { dx: -1, dy: -1 };
      case "u":
      case "U":
      case "PageUp":
      case "Numpad9":
        return { dx: 1, dy: -1 };
      case "b":
      case "B":
      case "End":
      case "Numpad1":
        return { dx: -1, dy: 1 };
      case "n":
      case "N":
      case "PageDown":
      case "Numpad3":
        return { dx: 1, dy: 1 };
      default:
        break;
    }

    if (!this.numberPadModeEnabled) {
      return null;
    }

    switch (input) {
      case "8":
        return { dx: 0, dy: -1 };
      case "2":
        return { dx: 0, dy: 1 };
      case "4":
        return { dx: -1, dy: 0 };
      case "6":
        return { dx: 1, dy: 0 };
      case "7":
        return { dx: -1, dy: -1 };
      case "9":
        return { dx: 1, dy: -1 };
      case "1":
        return { dx: -1, dy: 1 };
      case "3":
        return { dx: 1, dy: 1 };
      default:
        return null;
    }
  }

  private updateDirectionalAttackContext(input: string): void {
    const direction = this.getDirectionVectorFromInput(input);
    if (!direction) {
      return;
    }
    this.lastDirectionalAttackContext = {
      dx: direction.dx,
      dy: direction.dy,
      originX: this.playerPos.x,
      originY: this.playerPos.y,
      capturedAtMs: Date.now(),
    };
  }

  private updateDirectionalAttackContextFromTarget(
    targetX: number,
    targetY: number,
  ): void {
    const dx = targetX - this.playerPos.x;
    const dy = targetY - this.playerPos.y;
    const direction = this.resolveDirectionFromDelta(dx, dy);
    if (!direction) {
      return;
    }
    this.updateDirectionalAttackContext(direction);
  }

  private isMonsterAttackTargetTile(x: number, y: number): boolean {
    if (x === this.playerPos.x && y === this.playerPos.y) {
      return false;
    }
    const key = `${x},${y}`;
    const mesh = this.tileMap.get(key);
    return (
      Boolean(mesh?.userData?.isMonsterLikeCharacter) ||
      this.monsterBillboards.has(key)
    );
  }

  private setPendingPointerAttackTargetFromTile(x: number, y: number): void {
    if (!this.isMonsterAttackTargetTile(x, y)) {
      this.pendingPointerAttackTargetContext = null;
      return;
    }
    this.pendingPointerAttackTargetContext = {
      x,
      y,
      capturedAtMs: Date.now(),
    };
  }

  private getRecentPointerAttackTarget(
    nowMs: number,
  ): { x: number; y: number } | null {
    const context = this.pendingPointerAttackTargetContext;
    if (!context) {
      return null;
    }
    if (
      nowMs - context.capturedAtMs >
      this.pointerAttackTargetContextMaxAgeMs
    ) {
      return null;
    }
    return { x: context.x, y: context.y };
  }

  private tryTriggerPointerMonsterHitSpray(amount: number): boolean {
    const target = this.getRecentPointerAttackTarget(Date.now());
    if (!target) {
      return false;
    }
    this.triggerDamageEffectsAtTile(target.x, target.y, amount, "hit");
    return true;
  }

  private tryTriggerPointerMonsterDefeatSpray(): boolean {
    const target = this.getRecentPointerAttackTarget(Date.now());
    if (!target) {
      return false;
    }
    this.triggerDamageEffectsAtTile(target.x, target.y, 1, "defeat");
    return true;
  }

  private getRecentDirectionalAttackContext(
    nowMs: number,
  ): DirectionalAttackContext | null {
    const context = this.lastDirectionalAttackContext;
    if (!context) {
      return null;
    }
    if (nowMs - context.capturedAtMs > this.directionalAttackContextMaxAgeMs) {
      return null;
    }
    return { ...context };
  }

  private isTileInDirectionalAttackPath(
    tileX: number,
    tileY: number,
    context: DirectionalAttackContext | null,
  ): boolean {
    if (!context) {
      return false;
    }

    const deltaX = tileX - context.originX;
    const deltaY = tileY - context.originY;
    if (deltaX === 0 && deltaY === 0) {
      return false;
    }

    return Math.sign(deltaX) === context.dx && Math.sign(deltaY) === context.dy;
  }

  private getLatestDirectionalAttackContext(): DirectionalAttackContext | null {
    const context = this.lastDirectionalAttackContext;
    return context ? { ...context } : null;
  }

  private findDirectionalMonsterTarget(
    context: DirectionalAttackContext,
  ): { x: number; y: number } | null {
    let targetX: number | null = null;
    let targetY: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [key, mesh] of this.tileMap.entries()) {
      if (!mesh.userData?.isMonsterLikeCharacter) {
        continue;
      }
      const [rawX, rawY] = key.split(",");
      const x = Number.parseInt(rawX, 10);
      const y = Number.parseInt(rawY, 10);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      if (!this.isTileInDirectionalAttackPath(x, y, context)) {
        continue;
      }
      const distance = Math.max(
        Math.abs(x - context.originX),
        Math.abs(y - context.originY),
      );
      if (distance < 1 || distance >= bestDistance) {
        continue;
      }
      bestDistance = distance;
      targetX = x;
      targetY = y;
    }

    if (targetX === null || targetY === null) {
      return null;
    }
    return { x: targetX, y: targetY };
  }

  private captureMonsterDefeatFromMessage(messageLike: unknown): boolean {
    if (typeof messageLike !== "string") {
      return false;
    }

    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized || !this.isMonsterDefeatMessage(normalized)) {
      return false;
    }

    const now = Date.now();
    if (
      normalized === this.lastParsedDefeatMessage &&
      now - this.lastParsedDefeatAtMs < 120
    ) {
      return true;
    }

    this.lastParsedDefeatMessage = normalized;
    this.lastParsedDefeatAtMs = now;
    if (this.tryTriggerPointerMonsterDefeatSpray()) {
      return true;
    }
    this.tryTriggerDirectionalMonsterDefeatSpray();
    return true;
  }

  private captureOtherMonsterKilledSoundFromMessage(
    messageLike: unknown,
    playerKillHandled: boolean,
  ): void {
    if (playerKillHandled || typeof messageLike !== "string") {
      return;
    }
    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized || !this.isAnyKillMessage(normalized)) {
      return;
    }
    this.messageSoundHooks.playOtherMonsterKilledSound();
  }

  private queuePendingCharacterDamage(amount: number): void {
    const sanitized = Math.max(1, Math.round(Math.abs(amount)));
    const now = Date.now();
    this.pendingCharacterDamageQueue.push({
      amount: sanitized,
      createdAtMs: now,
      expectedDirection: this.getRecentDirectionalAttackContext(now),
      expectedTile: this.getRecentPointerAttackTarget(now),
    });

    if (this.pendingCharacterDamageQueue.length > 8) {
      this.pendingCharacterDamageQueue.splice(
        0,
        this.pendingCharacterDamageQueue.length - 8,
      );
    }
  }

  private prunePendingCharacterDamage(nowMs: number): void {
    this.pendingCharacterDamageQueue = this.pendingCharacterDamageQueue.filter(
      (entry) =>
        nowMs - entry.createdAtMs <= this.pendingCharacterDamageMaxAgeMs,
    );
  }

  private tryTriggerDirectionalMonsterHitSpray(amount: number): boolean {
    const now = Date.now();
    const context = this.getRecentDirectionalAttackContext(now);
    if (!context) {
      return false;
    }

    const target = this.findDirectionalMonsterTarget(context);
    if (!target) {
      return false;
    }

    this.triggerDamageEffectsAtTile(target.x, target.y, amount, "hit");
    return true;
  }

  private tryTriggerDirectionalMonsterDefeatSpray(): boolean {
    const context = this.getLatestDirectionalAttackContext();
    if (!context) {
      return false;
    }

    const target = this.findDirectionalMonsterTarget(context);
    if (target) {
      this.triggerDamageEffectsAtTile(target.x, target.y, 1, "defeat");
      return true;
    }

    const fallbackX = context.originX + context.dx;
    const fallbackY = context.originY + context.dy;
    this.triggerDamageEffectsAtTile(fallbackX, fallbackY, 1, "defeat");
    return true;
  }

  private captureDamageFromMessage(messageLike: unknown): void {
    if (typeof messageLike !== "string") {
      return;
    }

    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const explicitPlayerHit = this.isPlayerHitMonsterMessage(normalized);
    const playerAttack =
      explicitPlayerHit || this.isPlayerAttackMessage(normalized);
    if (!playerAttack) {
      return;
    }

    let amount = this.extractDamageAmountFromMessage(normalized);
    if (!amount) {
      // No explicit number from NetHack? still produce a lightweight hit cue.
      amount = 1;
    }
    if (!amount) {
      return;
    }

    const now = Date.now();
    if (
      normalized === this.lastParsedDamageMessage &&
      now - this.lastParsedDamageAtMs < 120
    ) {
      return;
    }
    this.lastParsedDamageMessage = normalized;
    this.lastParsedDamageAtMs = now;

    if (this.tryTriggerPointerMonsterHitSpray(amount)) {
      return;
    }

    if (this.tryTriggerDirectionalMonsterHitSpray(amount)) {
      return;
    }

    this.queuePendingCharacterDamage(amount);
  }

  private tryResolvePendingCharacterDamage(tile: any): void {
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }

    const now = Date.now();
    this.prunePendingCharacterDamage(now);
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }

    const behavior = this.classifyTilePayload(tile);
    if (
      !behavior ||
      behavior.isPlayerGlyph ||
      !this.isDamageFlashableBehavior(behavior)
    ) {
      return;
    }

    if (typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }

    const queueIndex = this.pendingCharacterDamageQueue.findIndex((entry) => {
      if (
        entry.expectedTile &&
        entry.expectedTile.x === tile.x &&
        entry.expectedTile.y === tile.y
      ) {
        return true;
      }
      return this.isTileInDirectionalAttackPath(
        tile.x,
        tile.y,
        entry.expectedDirection,
      );
    });
    if (queueIndex < 0) {
      return;
    }

    const [nextDamage] = this.pendingCharacterDamageQueue.splice(queueIndex, 1);
    if (!nextDamage) {
      return;
    }

    this.triggerDamageEffectsAtTile(tile.x, tile.y, nextDamage.amount);
  }

  private triggerDamageEffectsAtTile(
    x: number,
    y: number,
    amount: number,
    variant: "hit" | "defeat" = "hit",
  ): void {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(amount)
    ) {
      return;
    }

    const damage = Math.max(1, Math.round(Math.abs(amount)));
    this.messageSoundHooks.playDamageEffectSound(variant);
    const key = `${x},${y}`;
    const hadElevatedBillboard = this.monsterBillboards.has(key);
    if (variant === "defeat") {
      if (this.clientOptions.monsterShatter) {
        this.spawnMonsterBillboardShatterEffectAtTile(x, y);
      }
    }
    const useMonsterBillboardFlash =
      this.shouldUseMonsterBillboardDamageFlash(key);
    const isPlayerTarget = x === this.playerPos.x && y === this.playerPos.y;
    const suppressPlayerTileFlash =
      isPlayerTarget && this.clientOptions.tilesetMode === "tiles";
    const usePlayerBillboardFlash =
      suppressPlayerTileFlash && hadElevatedBillboard;
    const useBillboardFlash =
      useMonsterBillboardFlash || usePlayerBillboardFlash;
    const suppressTileFlashForTilesBillboard =
      this.clientOptions.tilesetMode === "tiles" && hadElevatedBillboard;
    if (variant === "hit" || variant === "defeat") {
      if (useBillboardFlash) {
        this.stopGlyphDamageFlash(key);
        this.startMonsterBillboardDamageFlash(key);
      } else if (
        !suppressPlayerTileFlash &&
        !suppressTileFlashForTilesBillboard
      ) {
        this.startGlyphDamageFlash(key);
      } else {
        this.stopGlyphDamageFlash(key);
      }
    }
    if (
      isPlayerTarget &&
      variant === "hit" &&
      this.clientOptions.damageNumbers
    ) {
      this.spawnPlayerDamageNumberParticle(x, y, damage);
    }
    if (this.clientOptions.tileShakeOnHit) {
      this.startGlyphDamageShake(x, y, variant, {
        spriteOnly: false,
      });
    }
    if (this.clientOptions.blood) {
      this.spawnBloodMistParticles(x, y, damage, variant);
    }
  }

  private enqueueTileUpdate(tile: any): void {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }

    const key = `${tile.x},${tile.y}`;
    const pendingTile = this.pendingTileUpdates.get(key);
    if (pendingTile) {
      this.seedTerrainCacheFromSupersededPendingUpdate(key, pendingTile, tile);
    }
    this.pendingTileUpdates.set(key, tile);

    if (this.tileFlushScheduled) {
      return;
    }

    this.tileFlushScheduled = true;
    requestAnimationFrame(() => this.flushPendingTileUpdates());
  }

  private flushPendingTileUpdates(): void {
    this.tileFlushScheduled = false;
    if (!this.pendingTileUpdates.size) {
      return;
    }

    const updates = Array.from(this.pendingTileUpdates.values());
    this.pendingTileUpdates.clear();

    for (const tile of updates) {
      const key = `${tile.x},${tile.y}`;
      this.recordNewlyDiscoveredDarkCorridorTileForCurrentInput(tile);
      const behavior = this.classifyTilePayload(tile);
      if (
        this.isFpsMode() &&
        this.fpsStepCameraActive &&
        behavior &&
        !behavior.isPlayerGlyph &&
        (this.isMonsterLikeBehavior(behavior) ||
          this.isLootLikeBehavior(behavior))
      ) {
        this.pendingTileUpdates.set(key, tile);
        continue;
      }

      const signature = `${tile.glyph}|${tile.char ?? ""}|${tile.color ?? ""}|ti:${typeof tile.tileIndex === "number" ? Math.trunc(tile.tileIndex) : ""}`;
      if (this.tileStateCache.get(key) === signature) {
        const shouldHaveMonsterBillboard =
          behavior !== null &&
          (this.isMonsterLikeBehavior(behavior) ||
            this.isLootLikeBehavior(behavior)) &&
          (this.clientOptions.tilesetMode === "tiles" || this.isFpsMode()) &&
          !(tile.x === this.playerPos.x && tile.y === this.playerPos.y);
        if (shouldHaveMonsterBillboard && !this.monsterBillboards.has(key)) {
          this.updateTile(tile.x, tile.y, tile.glyph, tile.char, tile.color, {
            runtimeTileIndex:
              typeof tile.tileIndex === "number" ? tile.tileIndex : undefined,
          });
        }
        continue;
      }

      this.tileStateCache.set(key, signature);
      this.updateTile(tile.x, tile.y, tile.glyph, tile.char, tile.color, {
        runtimeTileIndex:
          typeof tile.tileIndex === "number" ? tile.tileIndex : undefined,
      });
    }
    // Inferred dark-corridor walls intentionally reconcile from player_position
    // updates, not tile flushes, to avoid transient wall flashes mid-move.
    // Flush minimap cells once per tile batch to keep runtime bursts lightweight.
    this.flushPendingMinimapTileUpdates();

    if (this.pendingTileUpdates.size > 0 && !this.tileFlushScheduled) {
      this.tileFlushScheduled = true;
      requestAnimationFrame(() => this.flushPendingTileUpdates());
    }
  }

  private shouldKeepFloorGlyphUnderFpsAsciiPlayer(
    behavior: TileBehaviorResult,
  ): boolean {
    if (!this.isFpsMode() || this.clientOptions.tilesetMode === "tiles") {
      return false;
    }
    if (behavior.isPlayerGlyph || behavior.isWall) {
      return false;
    }
    if (behavior.resolved.kind !== "cmap") {
      return false;
    }
    // Keep normal ASCII floor glyphs (lit and dark floor/corridor) visible
    // under the suppressed player tile in FPS mode.
    return (
      behavior.materialKind === "floor" || behavior.materialKind === "dark"
    );
  }

  private flushPendingTileUpdatesForPlayerPositionReconcile(): void {
    if (!this.pendingTileUpdates.size) {
      return;
    }
    // Drain queued map updates before dark-corridor wall inference runs for
    // this movement step, preventing temporary front-wall flashes.
    this.flushPendingTileUpdates();
  }

  /**
   * Request a view update for a specific tile from the local runtime
   * @param x The x coordinate of the tile
   * @param y The y coordinate of the tile
   */
  public requestTileUpdate(x: number, y: number): void {
    if (this.session) {
      console.log(`Requesting tile update for (${x}, ${y})`);
      this.session.requestTileUpdate(x, y);
    } else {
      console.log("Cannot request tile update - runtime not started");
    }
  }
  public requestAreaUpdate(
    centerX: number,
    centerY: number,
    radius: number = 3,
  ): void {
    if (this.session) {
      console.log(
        `Requesting area update centered at (${centerX}, ${centerY}) with radius ${radius}`,
      );
      this.session.requestAreaUpdate(centerX, centerY, radius);
    } else {
      console.log("Cannot request area update - runtime not started");
    }
  }
  public requestPlayerAreaUpdate(radius: number = 5): void {
    this.requestAreaUpdate(this.playerPos.x, this.playerPos.y, radius);
  }

  private requestTileUpdateWithRetry(x: number, y: number): void {
    this.requestTileUpdate(x, y);
    if (typeof window === "undefined") {
      return;
    }
    window.setTimeout(() => {
      this.requestTileUpdate(x, y);
    }, this.tileRefreshRetryDelayMs);
    window.setTimeout(() => {
      this.requestTileUpdate(x, y);
    }, this.tileRefreshRetryDelayMs * 2);
  }

  private requestPlayerTileRefresh(reason: string): void {
    if (!this.session) {
      return;
    }
    console.log(
      `Requesting player tile refresh (${reason}) at (${this.playerPos.x}, ${this.playerPos.y})`,
    );
    this.requestTileUpdateWithRetry(this.playerPos.x, this.playerPos.y);
  }

  private requestDirectionalAnswerTileRefresh(directionInput: string): void {
    if (!this.session) {
      return;
    }
    const originX = this.playerPos.x;
    const originY = this.playerPos.y;
    this.requestTileUpdateWithRetry(originX, originY);

    const direction = this.getDirectionVectorFromInput(directionInput);
    if (!direction) {
      return;
    }
    this.requestTileUpdateWithRetry(
      originX + direction.dx,
      originY + direction.dy,
    );
  }

  private setRepeatActionVisible(visible: boolean): void {
    if (this.repeatActionVisible === visible) {
      return;
    }
    this.repeatActionVisible = visible;
    this.uiAdapter.setRepeatActionVisible(visible);
  }

  private armRepeatableAction(action: RepeatableActionSpec): void {
    this.repeatableAction = action;
    this.repeatAutoDirectionPending = false;
    this.repeatAutoDirectionArmedAtMs = 0;
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
    this.setRepeatActionVisible(true);
  }

  private clearRepeatableAction(): void {
    this.repeatableAction = null;
    this.repeatAutoDirectionPending = false;
    this.repeatAutoDirectionArmedAtMs = 0;
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
    this.setRepeatActionVisible(false);
  }

  private onSwipeCommandExecuted(): void {
    this.clearRepeatableAction();
  }

  private queueRepeatDirectionCandidate(action: RepeatableActionSpec): void {
    this.repeatDirectionCandidate = action;
    this.repeatDirectionCandidateAtMs = Date.now();
  }

  private consumeRepeatDirectionCandidate(): RepeatableActionSpec | null {
    const candidate = this.repeatDirectionCandidate;
    const ageMs = Date.now() - this.repeatDirectionCandidateAtMs;
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
    if (!candidate || ageMs > this.repeatDirectionCandidateWindowMs) {
      return null;
    }
    return candidate;
  }

  private clearRepeatDirectionCandidate(): void {
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
  }

  private shouldCloseInventoryForPendingContextPrompt(): boolean {
    const requestedAt = this.pendingInventoryContextPromptCloseRequestedAtMs;
    if (!requestedAt) {
      return false;
    }
    this.pendingInventoryContextPromptCloseRequestedAtMs = 0;
    return Date.now() - requestedAt <= this.inventoryContextPromptCloseWindowMs;
  }

  private shouldSkipMobileFpsClickLookPromptMessageEvent(
    messageLike: unknown,
  ): boolean {
    if (!this.skipNextMobileFpsClickLookPromptMessage) {
      return false;
    }
    this.skipNextMobileFpsClickLookPromptMessage = false;
    if (typeof messageLike !== "string") {
      return false;
    }
    const normalized =
      this.sanitizeFpsCrosshairGlanceText(messageLike).toLowerCase();
    if (!normalized) {
      return false;
    }
    if (/^pick (an?|the)? ?object\b/.test(normalized)) {
      return true;
    }
    if (
      normalized.startsWith("pick ") &&
      normalized.includes("monster, object or location")
    ) {
      return true;
    }
    return false;
  }

  private canExecuteRepeatableGameplayAction(): boolean {
    return (
      Boolean(this.session) &&
      !(
        this.metaCommandModeActive ||
        this.isInQuestion ||
        this.isInDirectionQuestion ||
        this.positionInputModeActive
      )
    );
  }

  private isAutomaticHashCommandBlockedByLookMode(): boolean {
    const pending = this.fpsCrosshairGlancePending;
    if (!pending) {
      return false;
    }
    if (pending.commandKind !== "glance") {
      return false;
    }
    return Date.now() - pending.startedAtMs <= this.fpsCrosshairGlanceTimeoutMs;
  }

  private clearAutomaticGlancePendingState(): void {
    this.fpsCrosshairGlancePending = null;
  }

  private executeQuickAction(
    normalizedActionId: string,
    shouldArmRepeat: boolean,
    autoDirectionFromFpsAim: boolean = false,
    submitDelayMs: number = 0,
  ): boolean {
    if (!normalizedActionId || !this.session) {
      return false;
    }
    const shouldAutoSelfDirectionForLoot =
      normalizedActionId === "loot" && this.isActiveContextActionOnPlayerTile();
    const adjacentDoorDirection =
      normalizedActionId === "open" || normalizedActionId === "close"
        ? this.getContextAutoDirectionFromActiveTileIfAdjacent()
        : null;

    this.closeAnyTileContextMenu(true);
    if (!this.canExecuteRepeatableGameplayAction()) {
      return false;
    }

    this.hideInfoMenuDialog();
    if (this.isInventoryDialogOpen()) {
      this.hideInventoryDialog();
    }

    if (shouldArmRepeat) {
      this.clearRepeatableAction();
    }
    this.clearRepeatDirectionCandidate();
    this.clearFpsContextAutoDirection();
    if (shouldArmRepeat && normalizedActionId === "look" && this.isFpsMode()) {
      this.skipNextMobileFpsClickLookPromptMessage = true;
    }

    let didExecute = true;
    const submitOptions = { delayMs: submitDelayMs };
    switch (normalizedActionId) {
      case "wait":
        this.sendInput(".", submitOptions);
        break;
      case "search":
        this.sendInput("s", submitOptions);
        break;
      case "pickup":
        this.sendInput(",", submitOptions);
        break;
      case "eat":
        this.sendInput("e", submitOptions);
        break;
      case "look":
        this.sendInput("/", submitOptions);
        break;
      case "loot":
        if (this.isAutomaticHashCommandBlockedByLookMode()) {
          return false;
        }
        this.sendInputSequence(
          ["#", "l", "o", "o", "t", "Enter"],
          submitOptions,
        );
        if (shouldAutoSelfDirectionForLoot) {
          this.armContextAutoDirection("s");
        }
        break;
      case "quaff":
        this.sendInput("q", submitOptions);
        break;
      case "open":
        this.armFpsFireSuppression();
        this.sendInput("o", submitOptions);
        if (adjacentDoorDirection) {
          this.armContextAutoDirection(adjacentDoorDirection);
        }
        break;
      case "close":
        this.armFpsFireSuppression();
        this.sendInput("c", submitOptions);
        if (adjacentDoorDirection) {
          this.armContextAutoDirection(adjacentDoorDirection);
        }
        break;
      case "ascend":
        this.sendInput("<", submitOptions);
        break;
      case "descend":
        this.sendInput(">", submitOptions);
        break;
      case "extended":
        this.sendInput("#", submitOptions);
        break;
      default:
        console.log(`Unknown quick action requested: ${normalizedActionId}`);
        didExecute = false;
        break;
    }

    if (didExecute && shouldArmRepeat) {
      this.queueRepeatDirectionCandidate({
        kind: "quick",
        value: normalizedActionId,
      });
    }
    if (
      didExecute &&
      autoDirectionFromFpsAim &&
      !adjacentDoorDirection &&
      (normalizedActionId === "open" || normalizedActionId === "close")
    ) {
      this.armFpsContextAutoDirectionFromAim();
    }

    return didExecute;
  }

  private executeExtendedCommand(
    normalizedCommandText: string,
    shouldArmRepeat: boolean,
    autoDirectionFromFpsAim: boolean = false,
    submitDelayMs: number = 0,
  ): boolean {
    if (!normalizedCommandText || !this.session) {
      return false;
    }
    const kickAdjacentDirection =
      normalizedCommandText === "kick"
        ? this.getContextAutoDirectionFromActiveTileIfAdjacent()
        : null;

    this.closeAnyTileContextMenu(true);
    if (!this.canExecuteRepeatableGameplayAction()) {
      return false;
    }

    this.hideInfoMenuDialog();
    if (this.isInventoryDialogOpen()) {
      this.hideInventoryDialog();
    }

    if (shouldArmRepeat) {
      this.clearRepeatableAction();
    }
    this.clearRepeatDirectionCandidate();
    this.clearFpsContextAutoDirection();
    if (normalizedCommandText === "kick") {
      this.armFpsFireSuppression();
    }
    const sequence = ["#", ...normalizedCommandText.split(""), "Enter"];
    this.sendInputSequence(sequence, { delayMs: submitDelayMs });
    if (shouldArmRepeat) {
      this.queueRepeatDirectionCandidate({
        kind: "extended",
        value: normalizedCommandText,
      });
    }
    if (kickAdjacentDirection) {
      this.armContextAutoDirection(kickAdjacentDirection);
    }
    if (
      autoDirectionFromFpsAim &&
      !kickAdjacentDirection &&
      (normalizedCommandText === "kick" ||
        normalizedCommandText === "throw" ||
        normalizedCommandText === "fire" ||
        normalizedCommandText === "zap")
    ) {
      this.armFpsContextAutoDirectionFromAim();
    }
    return true;
  }

  private executeInventoryCommandWithoutSelection(
    commandKey: string,
    shouldArmRepeat: boolean,
  ): boolean {
    if (!commandKey || commandKey.length !== 1 || !this.session) {
      return false;
    }

    this.closeAnyTileContextMenu(true);
    if (!this.canExecuteRepeatableGameplayAction()) {
      return false;
    }

    this.hideInfoMenuDialog();
    if (this.isInventoryDialogOpen()) {
      this.hideInventoryDialog();
    }

    if (shouldArmRepeat) {
      this.clearRepeatableAction();
    }
    this.clearRepeatDirectionCandidate();
    this.sendInput(commandKey);
    if (shouldArmRepeat) {
      this.queueRepeatDirectionCandidate({
        kind: "inventory_command",
        value: commandKey,
      });
    }
    return true;
  }

  private clearFpsContextAutoDirection(): void {
    this.fpsContextAutoDirectionInput = null;
    this.fpsContextAutoDirectionArmedAtMs = 0;
  }

  private armContextAutoDirection(directionInput: string): void {
    const normalized = String(directionInput || "").trim();
    if (!normalized) {
      return;
    }
    this.fpsContextAutoDirectionInput = normalized;
    this.fpsContextAutoDirectionArmedAtMs = Date.now();
  }

  private isActiveContextActionOnPlayerTile(): boolean {
    const tile = this.activeContextActionTile;
    return Boolean(
      tile && tile.x === this.playerPos.x && tile.y === this.playerPos.y,
    );
  }

  private armFpsContextAutoDirectionFromAim(): void {
    if (!this.isFpsMode()) {
      return;
    }
    const directionInput = this.getFpsDirectionQuestionInputFromAim();
    if (!directionInput) {
      return;
    }
    this.armContextAutoDirection(directionInput);
  }

  private getContextAutoDirectionFromActiveTileIfAdjacent(): string | null {
    const tile = this.activeContextActionTile;
    if (!tile) {
      return null;
    }
    const dx = tile.x - this.playerPos.x;
    const dy = tile.y - this.playerPos.y;
    if ((dx === 0 && dy === 0) || Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      return null;
    }
    return this.resolveDirectionFromDelta(dx, dy);
  }

  private tryAutoAnswerDirectionQuestionFromFpsContextAction(): boolean {
    const directionKey = this.fpsContextAutoDirectionInput;
    if (!directionKey) {
      return false;
    }
    const ageMs = Date.now() - this.fpsContextAutoDirectionArmedAtMs;
    this.clearFpsContextAutoDirection();
    if (ageMs > this.fpsContextAutoDirectionWindowMs) {
      return false;
    }
    this.isInQuestion = true;
    this.isInDirectionQuestion = true;
    this.submitDirectionAnswer(directionKey);
    return true;
  }

  private tryAutoAnswerDirectionQuestionFromRepeat(): boolean {
    if (!this.repeatAutoDirectionPending) {
      return false;
    }
    if (
      Date.now() - this.repeatAutoDirectionArmedAtMs >
      this.repeatAutoDirectionWindowMs
    ) {
      this.repeatAutoDirectionPending = false;
      this.repeatAutoDirectionArmedAtMs = 0;
      return false;
    }
    this.repeatAutoDirectionPending = false;
    this.repeatAutoDirectionArmedAtMs = 0;
    const directionKey = this.lastRepeatDirectionInput;
    if (!directionKey) {
      return false;
    }
    this.isInQuestion = true;
    this.isInDirectionQuestion = true;
    this.submitDirectionAnswer(directionKey);
    return true;
  }

  private submitDirectionAnswer(directionKey: string): void {
    if (!this.isInDirectionQuestion || !directionKey) {
      return;
    }
    const normalized = String(directionKey).trim();
    if (!normalized) {
      return;
    }

    this.lastRepeatDirectionInput = normalized;
    this.sendInput(normalized);
    if (this.isFpsMode()) {
      this.requestDirectionalAnswerTileRefresh(normalized);
    }
    this.hideDirectionQuestion();
  }

  public isLoggingEnabled(): boolean {
    return isLoggingEnabled();
  }

  public setLoggingEnabled(enabled: boolean): boolean {
    const next = setLoggingEnabled(enabled);
    if (this.session) {
      this.session.setLoggingEnabled(next);
    }
    logWithOriginal(`[NetHack 3D] Logging ${next ? "enabled" : "disabled"}`);
    return next;
  }

  private acquireGlyphTexture(
    textureKey: string,
    factory: () => THREE.CanvasTexture,
  ): THREE.CanvasTexture {
    const cached = this.glyphTextureCache.get(textureKey);
    if (cached) {
      cached.refCount += 1;
      return cached.texture;
    }

    const texture = factory();
    this.glyphTextureCache.set(textureKey, { texture, refCount: 1 });
    return texture;
  }

  private releaseGlyphTexture(textureKey: string): void {
    if (!textureKey) {
      return;
    }
    const cached = this.glyphTextureCache.get(textureKey);
    if (!cached) {
      return;
    }

    cached.refCount -= 1;
    if (cached.refCount <= 0) {
      cached.texture.dispose();
      this.glyphTextureCache.delete(textureKey);
    }
  }

  private disposeGlyphOverlay(overlay: GlyphOverlay): void {
    this.releaseGlyphTexture(overlay.textureKey);
    overlay.texture = null;
    overlay.textureKey = "";
    overlay.material.dispose();
  }

  private getAllWallSideTileOverlays(mesh: THREE.Mesh): WallSideTileOverlay[] {
    const overlays = mesh.userData?.wallSideTileOverlays as
      | Partial<Record<WallSideTileRotation, WallSideTileOverlay>>
      | undefined;
    if (!overlays) {
      return [];
    }
    const results: WallSideTileOverlay[] = [];
    for (const rotation of ["none", "cw90", "ccw90"] as const) {
      const overlay = overlays[rotation];
      if (
        overlay &&
        overlay.material instanceof THREE.MeshBasicMaterial &&
        !results.includes(overlay)
      ) {
        results.push(overlay);
      }
    }
    return results;
  }

  private disposeWallSideTileOverlay(
    mesh: THREE.Mesh,
    rotation?: WallSideTileRotation,
  ): void {
    if (rotation) {
      const overlays = mesh.userData?.wallSideTileOverlays as
        | Partial<Record<WallSideTileRotation, WallSideTileOverlay>>
        | undefined;
      const overlay = overlays?.[rotation];
      if (overlay) {
        this.releaseGlyphTexture(overlay.textureKey);
        overlay.material.dispose();
        if (overlays) {
          delete overlays[rotation];
          if (!overlays.none && !overlays.cw90 && !overlays.ccw90) {
            delete mesh.userData.wallSideTileOverlays;
          }
        }
      }
      return;
    }

    for (const overlay of this.getAllWallSideTileOverlays(mesh)) {
      this.releaseGlyphTexture(overlay.textureKey);
      overlay.material.dispose();
    }
    delete mesh.userData.wallSideTileOverlays;
  }

  private ensureWallSideTileOverlayMaterial(
    mesh: THREE.Mesh,
    tileIndex: number,
    darkenFactor: number,
    opacity: number,
    rotation: WallSideTileRotation = "cw90",
  ): THREE.MeshBasicMaterial {
    let overlays = mesh.userData?.wallSideTileOverlays as
      | Partial<Record<WallSideTileRotation, WallSideTileOverlay>>
      | undefined;
    if (!overlays) {
      overlays = {};
      mesh.userData.wallSideTileOverlays = overlays;
    }

    let overlay = overlays[rotation];
    if (!overlay) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
      });
      this.patchMaterialForVignette(material);
      overlay = {
        textureKey: "",
        material,
      };
      overlays[rotation] = overlay;
    }

    const textureKey = `tile:${tileIndex}|${darkenFactor.toFixed(3)}|rot:${rotation}`;
    const needsTextureRefresh =
      overlay.textureKey !== textureKey ||
      !this.glyphTextureCache.has(textureKey);
    if (needsTextureRefresh) {
      if (overlay.textureKey) {
        this.releaseGlyphTexture(overlay.textureKey);
      }
      const texture = this.acquireGlyphTexture(textureKey, () =>
        this.createTileTexture(tileIndex, darkenFactor, false),
      );
      texture.center.set(0.5, 0.5);
      texture.rotation =
        rotation === "cw90"
          ? -Math.PI / 2
          : rotation === "ccw90"
            ? Math.PI / 2
            : 0;
      texture.needsUpdate = true;
      overlay.material.map = texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }

    overlay.material.color.set("#ffffff");
    overlay.material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    return overlay.material;
  }

  private disposeAllWallSideTileOverlays(): void {
    this.tileMap.forEach((mesh) => {
      this.disposeWallSideTileOverlay(mesh);
    });
  }

  private resolveWallOrientationChar(
    glyphChar: string,
    sourceGlyph: number | null,
  ): "|" | "-" | null {
    if (glyphChar === "|" || glyphChar === "-") {
      return glyphChar;
    }
    if (sourceGlyph === null) {
      return null;
    }
    const glyphEntry = getGlyphCatalogEntry(sourceGlyph);
    if (!glyphEntry || typeof glyphEntry.ch !== "number") {
      return null;
    }
    const catalogChar = String.fromCodePoint(glyphEntry.ch);
    if (catalogChar === "|" || catalogChar === "-") {
      return catalogChar;
    }
    return null;
  }

  private resolveCornerWallSideBaseTileIndex(tileIndex: number): number | null {
    const normalizedTileIndex = Math.trunc(tileIndex);
    if (normalizedTileIndex < 0) {
      return null;
    }

    // Corner-wall variants follow a base+offset pattern:
    // base+1 (top-left), base+2 (top-right), base+3 (bottom-left), base+4 (bottom-right).
    // Side faces should use the base tile while top keeps the corner tile.
    for (const baseTileIndex of [852, 1039, 1050, 1061, 1072]) {
      const offset = normalizedTileIndex - baseTileIndex;
      if (offset >= 1 && offset <= 4) {
        return baseTileIndex;
      }
    }

    return null;
  }

  private resolveFpsChamferWallUvRotation(
    glyphChar: string,
    sourceGlyph: number | null,
  ): FpsChamferWallUvRotation {
    const wallOrientationChar = this.resolveWallOrientationChar(
      glyphChar,
      sourceGlyph,
    );
    if (this.clientOptions.tilesetMode === "tiles") {
      return "none";
    }
    // Preserve existing ASCII behavior where vertical walls use rotated chamfer sides.
    return wallOrientationChar === "|" ? "lr_ccw" : "none";
  }

  private toneColor(hex: string, factor: number): string {
    const color = new THREE.Color(`#${hex}`);
    color.multiplyScalar(THREE.MathUtils.clamp(factor, 0, 1));
    return color.getHexString();
  }

  private relativeLuminance(color: THREE.Color): number {
    const channel = (value: number): number => {
      if (value <= 0.03928) return value / 12.92;
      return Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const r = channel(color.r);
    const g = channel(color.g);
    const b = channel(color.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private contrastRatio(background: THREE.Color, text: THREE.Color): number {
    const l1 = this.relativeLuminance(background);
    const l2 = this.relativeLuminance(text);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private ensureTextContrast(
    tonedBackgroundHex: string,
    textColor: string,
    minContrast: number = 4.5,
  ): string {
    const background = new THREE.Color(`#${tonedBackgroundHex}`);
    const text = new THREE.Color();
    text.set(textColor || "#ffffff");

    if (this.contrastRatio(background, text) >= minContrast) {
      return background.getHexString();
    }

    for (let i = 0; i < 6; i++) {
      background.multiplyScalar(0.85);
      if (this.contrastRatio(background, text) >= minContrast) {
        return background.getHexString();
      }
    }

    return background.getHexString();
  }

  private ensureGlyphOverlay(
    key: string,
    baseMaterial: THREE.MeshLambertMaterial,
  ): GlyphOverlay {
    const baseColorHex = baseMaterial.color.getHexString();
    let overlay = this.glyphOverlayMap.get(key);
    const needsNewOverlay =
      !overlay ||
      overlay.baseColorHex !== baseColorHex ||
      overlay.material instanceof THREE.MeshLambertMaterial === true;

    if (needsNewOverlay) {
      if (overlay) {
        this.disposeGlyphOverlay(overlay);
      }

      const materialClone = new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 1,
      });

      // Patch the newly created overlay material
      this.patchMaterialForVignette(materialClone);

      overlay = {
        texture: null,
        material: materialClone,
        baseColorHex,
        textureKey: "",
      };
      this.glyphOverlayMap.set(key, overlay);
    }

    return overlay!;
  }

  private createTileTexture(
    tileIndex: number,
    darkenFactor: number = 1,
    applyChromaKey: boolean = false,
  ): THREE.CanvasTexture {
    const size = this.tileSourceSize;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Failed to create tile texture canvas context");
    }

    context.clearRect(0, 0, size, size);

    if (
      this.tilesetTexture &&
      this.tilesetTexture.image &&
      this.tilesetTexture.image.complete &&
      this.tilesetTexture.image.width > 0
    ) {
      const img = this.tilesetTexture.image;
      const width = Math.trunc(img.width);
      const tilesPerRow = Math.floor(width / size);
      const tileRows = Math.floor(img.height / size);
      const tileCount =
        tilesPerRow > 0 && tileRows > 0 ? tilesPerRow * tileRows : 0;
      if (tilesPerRow <= 0 || tileCount <= 0) {
        // Leave transparent if atlas geometry is not yet usable.
      } else {
        const sx = (tileIndex % tilesPerRow) * size;
        const sy = Math.floor(tileIndex / tilesPerRow) * size;

        // Draw the specific tile from the atlas
        context.drawImage(img, sx, sy, size, size, 0, 0, size, size);

        if (applyChromaKey) {
          this.applyTilesetBillboardBackgroundRemoval(
            context,
            img,
            size,
            tileCount,
            tilesPerRow,
          );
        }
      }
    } else {
      // Leave transparent until the tileset texture has loaded.
    }

    // Apply darkening if needed (for shadows/fog of war)
    if (darkenFactor < 1) {
      const alpha = THREE.MathUtils.clamp(1 - darkenFactor, 0, 1);
      // Use source-atop to preserve transparency if chroma key was applied
      context.globalCompositeOperation = applyChromaKey
        ? "source-atop"
        : "source-over";
      context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      context.fillRect(0, 0, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.magFilter = THREE.NearestFilter; // Keep pixel art sharp
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();

    return texture;
  }

  private parseSolidChromaKeyColorHex(
    rawHex: string,
  ): { r: number; g: number; b: number } | null {
    const match = String(rawHex || "")
      .trim()
      .match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) {
      return null;
    }
    const hex = match[1];
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  private applySolidColorChromaKey(
    context: CanvasRenderingContext2D,
    tileSize: number,
  ): void {
    const solidColor = this.parseSolidChromaKeyColorHex(
      this.clientOptions.tilesetSolidChromaKeyColorHex,
    );
    if (!solidColor) {
      return;
    }
    const imageData = context.getImageData(0, 0, tileSize, tileSize);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i] === solidColor.r &&
        data[i + 1] === solidColor.g &&
        data[i + 2] === solidColor.b
      ) {
        data[i + 3] = 0;
      }
    }
    context.putImageData(imageData, 0, 0);
  }

  private applyTilesetBillboardBackgroundRemoval(
    context: CanvasRenderingContext2D,
    atlasImage: HTMLImageElement,
    tileSize: number,
    tileCount: number,
    tilesPerRow: number,
  ): void {
    if (this.clientOptions.tilesetBackgroundRemovalMode === "solid") {
      this.applySolidColorChromaKey(context, tileSize);
      return;
    }
    this.applyTilesetBackgroundRemoval(
      context,
      atlasImage,
      tileSize,
      tileCount,
      tilesPerRow,
    );
  }

  private getTilesetBackgroundTilePixels(
    atlasImage: HTMLImageElement,
    tileSize: number,
    tileIndex: number,
    tileCount: number,
    tilesPerRow: number,
  ): Uint8ClampedArray | null {
    const normalizedTileIndex = Math.trunc(tileIndex);
    if (
      !Number.isFinite(normalizedTileIndex) ||
      normalizedTileIndex < 0 ||
      normalizedTileIndex >= tileCount ||
      tilesPerRow <= 0
    ) {
      return null;
    }

    const cached =
      this.tilesetBackgroundTilePixelsCache.get(normalizedTileIndex);
    if (cached) {
      return cached;
    }

    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    const sx = (normalizedTileIndex % tilesPerRow) * tileSize;
    const sy = Math.floor(normalizedTileIndex / tilesPerRow) * tileSize;
    context.clearRect(0, 0, tileSize, tileSize);
    context.drawImage(
      atlasImage,
      sx,
      sy,
      tileSize,
      tileSize,
      0,
      0,
      tileSize,
      tileSize,
    );
    const pixels = context.getImageData(0, 0, tileSize, tileSize).data;
    this.tilesetBackgroundTilePixelsCache.set(normalizedTileIndex, pixels);
    return pixels;
  }

  private applyTilesetBackgroundRemoval(
    context: CanvasRenderingContext2D,
    atlasImage: HTMLImageElement,
    tileSize: number,
    tileCount: number,
    tilesPerRow: number,
  ): void {
    const backgroundTileIndex = Math.max(
      0,
      Math.trunc(this.clientOptions.tilesetBackgroundTileId),
    );
    const backgroundPixels = this.getTilesetBackgroundTilePixels(
      atlasImage,
      tileSize,
      backgroundTileIndex,
      tileCount,
      tilesPerRow,
    );
    if (!backgroundPixels) {
      return;
    }

    const imageData = context.getImageData(0, 0, tileSize, tileSize);
    const data = imageData.data;
    // Per-channel color-difference threshold where background removal begins.
    // Pixels with max(R/G/B delta) <= this are treated as pure background (fully transparent).
    const alphaSoftMin = 12;
    // Per-channel color-difference threshold where background removal stops.
    // Pixels with max(R/G/B delta) >= this are treated as full foreground (keep full alpha).
    // Values between min/max are linearly feathered for smoother edges.
    const alphaSoftMax = 40;

    for (let i = 0; i < data.length; i += 4) {
      const sourceAlpha = data[i + 3];
      if (sourceAlpha === 0) {
        continue;
      }

      const deltaR = Math.abs(data[i] - backgroundPixels[i]);
      const deltaG = Math.abs(data[i + 1] - backgroundPixels[i + 1]);
      const deltaB = Math.abs(data[i + 2] - backgroundPixels[i + 2]);
      const delta = Math.max(deltaR, deltaG, deltaB);
      const visibility = THREE.MathUtils.clamp(
        (delta - alphaSoftMin) / (alphaSoftMax - alphaSoftMin),
        0,
        1,
      );
      const nextAlpha = Math.round(sourceAlpha * visibility);
      data[i + 3] = nextAlpha;
      if (nextAlpha === 0) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }

    context.putImageData(imageData, 0, 0);
  }

  private createGlyphTexture(
    baseColorHex: string,
    glyphChar: string,
    textColor: string,
    darkenFactor: number = 1,
    size: number = 256,
    drawFloorGrid: boolean = false,
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create glyph texture canvas context");
    }
    this.drawGlyphTextureToCanvas(
      context,
      size,
      baseColorHex,
      glyphChar,
      textColor,
      darkenFactor,
      drawFloorGrid,
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return texture;
  }

  private drawGlyphTextureToCanvas(
    context: CanvasRenderingContext2D,
    size: number,
    baseColorHex: string,
    glyphChar: string,
    textColor: string,
    darkenFactor: number = 1,
    drawFloorGrid: boolean = false,
  ): void {
    context.clearRect(0, 0, size, size);

    const tonedBackground = this.toneColor(
      baseColorHex,
      0.8 * THREE.MathUtils.clamp(darkenFactor, 0, 1),
    );
    const contrastBackground = this.ensureTextContrast(
      tonedBackground,
      textColor,
    );
    context.fillStyle = `#${contrastBackground}`;
    context.fillRect(0, 0, size, size);

    if (drawFloorGrid) {
      const gridLineWidth = Math.max(2, Math.floor(size * 0.02));
      const inset = gridLineWidth * 0.5;
      context.lineWidth = gridLineWidth;
      context.strokeStyle = "rgba(8, 12, 16, 0.26)";
      context.strokeRect(
        inset,
        inset,
        size - gridLineWidth,
        size - gridLineWidth,
      );
    }

    const trimmed = glyphChar.trim();
    if (trimmed.length === 0) {
      return;
    }

    const fontSize = Math.floor(size * 0.6);
    context.font = `bold ${fontSize}px monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    context.fillText(trimmed, size / 2, size / 2);
  }

  private startGlyphDamageFlash(key: string): void {
    const mesh = this.tileMap.get(key);
    const overlay = this.glyphOverlayMap.get(key);
    if (
      !mesh ||
      !overlay ||
      !overlay.texture ||
      !mesh.userData ||
      !mesh.userData.isDamageFlashableCharacter
    ) {
      return;
    }

    const useOverlayTint =
      this.clientOptions.tilesetMode === "tiles" &&
      Boolean(mesh.userData.isPlayerGlyph);
    const glyphChar =
      typeof mesh.userData.glyphChar === "string"
        ? mesh.userData.glyphChar
        : "";
    if (!useOverlayTint && !glyphChar.trim()) {
      return;
    }

    const baseColorHex =
      typeof mesh.userData.glyphBaseColorHex === "string" &&
      mesh.userData.glyphBaseColorHex
        ? mesh.userData.glyphBaseColorHex
        : overlay.baseColorHex;
    const darkenFactor =
      typeof mesh.userData.glyphDarkenFactor === "number"
        ? THREE.MathUtils.clamp(mesh.userData.glyphDarkenFactor, 0, 1)
        : 1;
    const nextMode = useOverlayTint ? "overlay_tint" : "glyph_texture";

    let state = this.glyphDamageFlashes.get(key);
    if (!state || state.mode !== nextMode) {
      if (state?.texture) {
        state.texture.dispose();
      }

      if (nextMode === "glyph_texture") {
        const canvas = document.createElement("canvas");
        const size = this.glyphDamageFlashTextureSize;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.anisotropy = this.resolveTextureAnisotropyLevel();
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        state = {
          key,
          mode: nextMode,
          canvas,
          context,
          texture,
          elapsedMs: 0,
          durationMs: this.glyphDamageFlashDurationMs,
          baseColorHex,
          glyphChar,
          darkenFactor,
        };
      } else {
        state = {
          key,
          mode: nextMode,
          canvas: null,
          context: null,
          texture: null,
          elapsedMs: 0,
          durationMs: this.glyphDamageFlashDurationMs,
          baseColorHex,
          glyphChar,
          darkenFactor,
        };
      }
      this.glyphDamageFlashes.set(key, state);
    } else {
      state.elapsedMs = 0;
      state.baseColorHex = baseColorHex;
      state.glyphChar = glyphChar;
      state.darkenFactor = darkenFactor;
    }

    overlay.material.map =
      state.mode === "glyph_texture" && state.texture
        ? state.texture
        : overlay.texture;
    overlay.material.needsUpdate = true;
    this.renderGlyphDamageFlash(state, 1);
  }

  private getGlyphDamageFlashIntensity(state: GlyphDamageFlashState): number {
    const progress = THREE.MathUtils.clamp(
      state.elapsedMs / state.durationMs,
      0,
      1,
    );
    return Math.exp(-8.5 * progress);
  }

  private renderGlyphDamageFlash(
    state: GlyphDamageFlashState,
    intensity: number,
  ): void {
    const overlay = this.glyphOverlayMap.get(state.key);
    if (!overlay) {
      return;
    }

    const clamped = THREE.MathUtils.clamp(intensity, 0, 1);
    this.glyphDamageFlashColor
      .copy(this.glyphDamageFlashWhite)
      .lerp(this.glyphDamageFlashRed, clamped);
    if (state.mode === "overlay_tint") {
      overlay.material.map = overlay.texture;
      overlay.material.color.copy(this.glyphDamageFlashColor);
      overlay.material.needsUpdate = true;
      return;
    }

    if (!state.context || !state.canvas || !state.texture) {
      return;
    }

    const flashTextColor = `#${this.glyphDamageFlashColor.getHexString()}`;
    this.drawGlyphTextureToCanvas(
      state.context,
      state.canvas.width,
      state.baseColorHex,
      state.glyphChar,
      flashTextColor,
      state.darkenFactor,
    );
    state.texture.needsUpdate = true;
    overlay.material.map = state.texture;
    overlay.material.color.copy(this.glyphDamageFlashWhite);
    overlay.material.needsUpdate = true;
  }

  private stopGlyphDamageFlash(key: string): void {
    const state = this.glyphDamageFlashes.get(key);
    if (!state) {
      return;
    }

    const overlay = this.glyphOverlayMap.get(key);
    if (overlay) {
      overlay.material.map = overlay.texture;
      overlay.material.color.copy(this.glyphDamageFlashWhite);
      overlay.material.needsUpdate = true;
    }

    state.texture?.dispose();
    this.glyphDamageFlashes.delete(key);
  }

  private shouldUseMonsterBillboardDamageFlash(key: string): boolean {
    if (this.clientOptions.tilesetMode !== "tiles") {
      return false;
    }
    const mesh = this.tileMap.get(key);
    if (!mesh || !mesh.userData?.isMonsterLikeCharacter) {
      return false;
    }
    return this.monsterBillboards.has(key);
  }

  private startMonsterBillboardDamageFlash(key: string): void {
    const sprite = this.monsterBillboards.get(key);
    if (!sprite) {
      return;
    }
    const material = sprite.material;
    if (!(material instanceof THREE.SpriteMaterial)) {
      return;
    }

    let state = this.monsterBillboardDamageFlashes.get(key);
    if (!state) {
      state = {
        key,
        elapsedMs: 0,
        durationMs: this.monsterBillboardDamageFlashDurationMs,
      };
      this.monsterBillboardDamageFlashes.set(key, state);
    } else {
      state.elapsedMs = 0;
      state.durationMs = this.monsterBillboardDamageFlashDurationMs;
    }

    // Change to red directly on the billboard material.
    material.color.set(0xff0000);
    material.needsUpdate = true;
  }

  private stopMonsterBillboardDamageFlash(key: string): void {
    const state = this.monsterBillboardDamageFlashes.get(key);
    if (!state) {
      return;
    }

    const sprite = this.monsterBillboards.get(key);
    if (sprite && sprite.material instanceof THREE.SpriteMaterial) {
      sprite.material.color.copy(this.glyphDamageFlashWhite);
      sprite.material.needsUpdate = true;
    }

    this.monsterBillboardDamageFlashes.delete(key);
  }

  private updateMonsterBillboardDamageFlashes(deltaSeconds: number): void {
    if (this.monsterBillboardDamageFlashes.size === 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.monsterBillboardDamageFlashes.entries());
    for (const [key, state] of entries) {
      const sprite = this.monsterBillboards.get(key);
      if (!sprite || !(sprite.material instanceof THREE.SpriteMaterial)) {
        this.stopMonsterBillboardDamageFlash(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const intensity = Math.exp(-8.5 * progress);
      this.glyphDamageFlashColor
        .copy(this.glyphDamageFlashWhite)
        .lerp(this.glyphDamageFlashRed, intensity);
      sprite.material.color.copy(this.glyphDamageFlashColor);
      sprite.material.needsUpdate = true;

      if (progress >= 1) {
        this.stopMonsterBillboardDamageFlash(key);
      }
    }
  }

  private updateGlyphDamageFlashes(deltaSeconds: number): void {
    if (this.glyphDamageFlashes.size === 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.glyphDamageFlashes.entries());

    for (const [key, state] of entries) {
      if (!this.tileMap.has(key) || !this.glyphOverlayMap.has(key)) {
        this.stopGlyphDamageFlash(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const intensity = this.getGlyphDamageFlashIntensity(state);
      this.renderGlyphDamageFlash(state, intensity);

      if (progress >= 1) {
        this.stopGlyphDamageFlash(key);
      }
    }
  }

  private startGlyphDamageShake(
    tileX: number,
    tileY: number,
    variant: "hit" | "defeat",
    options?: { spriteOnly?: boolean },
  ): void {
    const key = `${tileX},${tileY}`;
    const mesh = this.tileMap.get(key);
    const sprite = this.monsterBillboards.get(key);
    const spriteOnly = options?.spriteOnly === true;
    if (!mesh && !sprite) {
      return;
    }
    if (spriteOnly && !sprite) {
      return;
    }

    const amplitude =
      variant === "defeat"
        ? this.glyphDefeatShakeAmplitude
        : this.glyphDamageShakeAmplitude;
    const durationMs =
      variant === "defeat"
        ? this.glyphDefeatShakeDurationMs
        : this.glyphDamageShakeDurationMs;

    const existing = this.glyphDamageShakes.get(key);
    if (existing) {
      existing.elapsedMs = 0;
      existing.durationMs = Math.max(existing.durationMs, durationMs);
      existing.amplitude = Math.max(existing.amplitude, amplitude);
      existing.spriteOnly = existing.spriteOnly && spriteOnly;
      return;
    }

    this.glyphDamageShakes.set(key, {
      key,
      tileX,
      tileY,
      elapsedMs: 0,
      durationMs,
      amplitude,
      seed: Math.random() * Math.PI * 2,
      spriteOnly,
    });
  }

  private stopGlyphDamageShake(key: string): void {
    const state = this.glyphDamageShakes.get(key);
    if (!state) {
      return;
    }

    const mesh = this.tileMap.get(key);
    if (mesh && !state.spriteOnly) {
      const baseZ = mesh.userData?.isWall ? WALL_HEIGHT / 2 : 0;
      mesh.position.set(
        state.tileX * TILE_SIZE,
        -state.tileY * TILE_SIZE,
        baseZ,
      );
    }
    const sprite = this.monsterBillboards.get(key);
    if (sprite) {
      const spriteZ =
        typeof sprite.userData?.elevatedZ === "number"
          ? sprite.userData.elevatedZ
          : this.elevatedMonsterZ;
      sprite.position.set(
        state.tileX * TILE_SIZE,
        -state.tileY * TILE_SIZE,
        spriteZ,
      );
    }
    const shadow = this.entityBlobShadows.get(key);
    if (shadow) {
      const shadowZ = mesh?.userData?.isWall ? WALL_HEIGHT + 0.03 : 0.028;
      shadow.position.set(
        state.tileX * TILE_SIZE,
        -state.tileY * TILE_SIZE,
        shadowZ,
      );
    }

    this.glyphDamageShakes.delete(key);
  }

  private updateGlyphDamageShakes(deltaSeconds: number): void {
    if (this.glyphDamageShakes.size === 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.glyphDamageShakes.entries());

    for (const [key, state] of entries) {
      const mesh = this.tileMap.get(key);
      const sprite = this.monsterBillboards.get(key);
      if (!mesh && !sprite) {
        this.glyphDamageShakes.delete(key);
        continue;
      }
      if (state.spriteOnly && !sprite) {
        this.glyphDamageShakes.delete(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const envelope = Math.pow(1 - progress, 2);
      const jitter = state.amplitude * envelope;
      const oscillationBase = state.elapsedMs / 1000;
      const offsetX =
        Math.sin(oscillationBase * 74 + state.seed) * jitter +
        Math.sin(oscillationBase * 33 + state.seed * 1.37) * jitter * 0.5;
      const offsetY =
        Math.cos(oscillationBase * 81 + state.seed * 0.91) * jitter +
        Math.cos(oscillationBase * 29 + state.seed * 1.71) * jitter * 0.4;
      if (!state.spriteOnly && mesh) {
        const baseZ = mesh.userData?.isWall ? WALL_HEIGHT / 2 : 0;
        mesh.position.set(
          state.tileX * TILE_SIZE + offsetX,
          -state.tileY * TILE_SIZE + offsetY,
          baseZ,
        );
      }
      if (sprite) {
        const spriteZ =
          typeof sprite.userData?.elevatedZ === "number"
            ? sprite.userData.elevatedZ
            : this.elevatedMonsterZ;
        sprite.position.set(
          state.tileX * TILE_SIZE + offsetX,
          -state.tileY * TILE_SIZE + offsetY,
          spriteZ,
        );
      }
      const shadow = this.entityBlobShadows.get(key);
      if (shadow) {
        const shadowZ = mesh?.userData?.isWall ? WALL_HEIGHT + 0.03 : 0.028;
        shadow.position.set(
          state.tileX * TILE_SIZE + offsetX * 0.4,
          -state.tileY * TILE_SIZE + offsetY * 0.4,
          shadowZ,
        );
      }

      if (progress >= 1) {
        this.stopGlyphDamageShake(key);
      }
    }
  }

  private clearGlyphDamageShakes(): void {
    const shakeKeys = Array.from(this.glyphDamageShakes.keys());
    for (const key of shakeKeys) {
      this.stopGlyphDamageShake(key);
    }
  }

  private getBloodMistTexture(): THREE.CanvasTexture {
    if (this.bloodMistTexture) {
      return this.bloodMistTexture;
    }

    // Intentionally low-resolution so blood particles render with a pixelated look.
    const size = 10;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create blood mist canvas context");
    }

    context.clearRect(0, 0, size, size);
    const gradient = context.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.015,
      size * 0.5,
      size * 0.5,
      size * 0.34,
    );
    gradient.addColorStop(0, "rgba(210, 22, 22, 1)");
    gradient.addColorStop(0.22, "rgba(170, 10, 10, 0.99)");
    gradient.addColorStop(0.58, "rgba(118, 4, 4, 0.73)");
    gradient.addColorStop(0.9, "rgba(74, 0, 0, 0.13)");
    gradient.addColorStop(1, "rgba(74, 0, 0, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2);
    context.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = 1;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;

    this.bloodMistTexture = texture;
    return texture;
  }

  private createDamageNumberCanvas(
    label: string,
    options?: {
      fillStyle?: string;
      strokeStyle?: string;
      strokeWidthMultiplier?: number;
    },
  ): { canvas: HTMLCanvasElement; aspectRatio: number } {
    const height = 256;
    const fontSize = Math.floor(height * 0.52);
    const fontSpec = `600 ${fontSize}px "Roboto Condensed", "Segoe UI", "Segoe UI Variable", sans-serif`;
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = height;
    measureCanvas.height = height;
    const measureContext = measureCanvas.getContext("2d");
    if (!measureContext) {
      throw new Error("Failed to create damage number canvas context");
    }
    measureContext.font = fontSpec;
    const measuredTextWidth = Math.max(
      1,
      Math.ceil(measureContext.measureText(label).width),
    );
    const horizontalPadding = Math.ceil(height * 0.22);
    const width = THREE.MathUtils.clamp(
      measuredTextWidth + horizontalPadding * 2,
      height,
      2048,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create damage number canvas context");
    }

    context.clearRect(0, 0, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = fontSpec;
    const strokeWidthMultiplier =
      typeof options?.strokeWidthMultiplier === "number" &&
      Number.isFinite(options.strokeWidthMultiplier)
        ? options.strokeWidthMultiplier
        : 1;
    context.lineWidth = Math.max(
      3,
      Math.floor(height * 0.045 * strokeWidthMultiplier),
    );
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = options?.strokeStyle ?? "rgba(18, 0, 0, 0.95)";
    context.fillStyle = options?.fillStyle ?? "#ff3a3a";
    context.strokeText(label, width / 2, height / 2);
    context.fillText(label, width / 2, height / 2);
    return { canvas, aspectRatio: width / height };
  }

  private createDamageNumberTexture(
    label: string,
    options?: { fillStyle?: string; strokeStyle?: string },
  ): {
    texture: THREE.CanvasTexture;
    aspectRatio: number;
  } {
    const { canvas, aspectRatio } = this.createDamageNumberCanvas(
      label,
      options,
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return { texture, aspectRatio };
  }

  private spawnPlayerDamageNumberParticle(
    tileX: number,
    tileY: number,
    damage: number,
  ): void {
    const label = `-${Math.max(1, Math.round(Math.abs(damage)))}`;
    const { texture, aspectRatio } = this.createDamageNumberTexture(label);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    material.opacity = 1;

    const sprite = new THREE.Sprite(material);
    const scaleMultiplier = 1.1;
    const useFpsFloating = this.isFpsMode();
    const modeScaleFactor = useFpsFloating
      ? this.playerDamageNumberFpsScaleFactor
      : this.playerDamageNumberNormalScaleFactor;
    const scaleY = 0.42 * scaleMultiplier * modeScaleFactor;
    const scaleX = scaleY * aspectRatio;
    const baseScale = new THREE.Vector2(scaleX, scaleY);
    const fpsLateralOffset = useFpsFloating
      ? (Math.random() - 0.5) * this.playerDamageNumberFpsLateralSpread
      : 0;
    const fpsBaseHeightOffset = 0.28;
    sprite.scale.set(baseScale.x, baseScale.y, 1);
    sprite.position.set(
      tileX * TILE_SIZE,
      -tileY * TILE_SIZE,
      this.damageParticleFloorZ + fpsBaseHeightOffset,
    );
    this.applyFpsForwardOffsetToPlayerNumberPosition(
      sprite.position,
      useFpsFloating,
      fpsLateralOffset,
    );
    this.alignPlayerDamageNumberToCamera(sprite);
    sprite.renderOrder = 940;
    this.addWorldObject(sprite);

    let fpsCameraLocalAnchor: THREE.Vector3 | null = null;
    if (useFpsFloating && !this.playerUiNumbersUseWorldProjectionForVr) {
      fpsCameraLocalAnchor = this.toCameraLocalOffset(
        sprite.position,
        new THREE.Vector3(),
      );
    }

    let velocity = new THREE.Vector3(0, 0, 0);
    if (!useFpsFloating) {
      const launchSpeed = (1.95 + Math.random() * 0.45) * 5;
      const launchAngleRad = THREE.MathUtils.degToRad(10);
      const launchAzimuthRad = Math.random() * Math.PI * 2;
      const horizontalSpeed = launchSpeed * Math.sin(launchAngleRad);
      const verticalSpeed = launchSpeed * Math.cos(launchAngleRad);
      velocity = new THREE.Vector3(
        Math.cos(launchAzimuthRad) * horizontalSpeed,
        Math.sin(launchAzimuthRad) * horizontalSpeed,
        verticalSpeed,
      );
    }

    this.playerDamageNumberParticles.push({
      kind: "damage",
      sprite,
      velocity,
      ageMs: 0,
      lifetimeMs: this.playerDamageNumberLifetimeMs,
      radius: 0.055,
      baseScale,
      fpsFloating: useFpsFloating,
      fpsLateralOffset,
      fpsBaseHeightOffset,
      fpsCameraLocalAnchor,
    });
  }

  private spawnPlayerHealNumberParticle(
    tileX: number,
    tileY: number,
    healAmount: number,
    options?: {
      label?: string;
      fillStyle?: string;
      scaleMultiplier?: number;
    },
  ): void {
    void tileX;
    void tileY;
    const label =
      options?.label ?? `+${Math.max(1, Math.round(Math.abs(healAmount)))}`;
    const scaleMultiplier =
      typeof options?.scaleMultiplier === "number" &&
      Number.isFinite(options.scaleMultiplier)
        ? options.scaleMultiplier
        : 1.1;
    const useFpsFloating = this.isFpsMode();
    const zoomFactor = this.resolveThirdPersonZoomFactor();
    const zoomHeightAggression = 5;
    const zoomSizeAggression = 5;
    const fpsLateralOffset = useFpsFloating
      ? (Math.random() - 0.5) * this.playerDamageNumberFpsLateralSpread
      : 0;
    const baseWorldHeightNear = 3.1;
    const baseWorldHeightFar = 4.3;
    const worldHeightCenter = (baseWorldHeightNear + baseWorldHeightFar) * 0.5;
    const worldHeightHalfRange =
      (baseWorldHeightFar - baseWorldHeightNear) * 0.5 * zoomHeightAggression;
    const worldBaseHeightOffset = useFpsFloating
      ? 0.5
      : worldHeightCenter + (0.5 - zoomFactor) * (2 * worldHeightHalfRange);
    const fillStyle = options?.fillStyle ?? "#72ec9e";
    const uiStrokeStyle = "rgba(46, 22, 22, 0.72)";
    const { canvas, aspectRatio } = this.createDamageNumberCanvas(label, {
      fillStyle,
      strokeStyle: uiStrokeStyle,
      strokeWidthMultiplier: 1.2,
    });
    const overlay = this.ensurePlayerUiNumberOverlay();
    if (!overlay) {
      return;
    }

    const element = canvas;
    element.style.position = "absolute";
    element.style.left = "0px";
    element.style.top = "0px";
    element.style.transform = "translate(-50%, -50%)";
    const baseUiHeightNear = 50;
    const baseUiHeightFar = 40;
    const uiHeightCenter = (baseUiHeightNear + baseUiHeightFar) * 0.5;
    const uiHeightHalfRange =
      (baseUiHeightNear - baseUiHeightFar) * 0.5 * zoomSizeAggression;
    const baseHeightPx = useFpsFloating
      ? 144
      : Math.round(
          uiHeightCenter + (zoomFactor - 0.5) * (2 * uiHeightHalfRange),
        );
    const uiHeightPx = Math.max(12, Math.round(baseHeightPx * scaleMultiplier));
    const uiWidthPx = Math.max(12, Math.round(uiHeightPx * aspectRatio));
    element.style.width = `${uiWidthPx}px`;
    element.style.height = `${uiHeightPx}px`;
    element.style.imageRendering = "auto";
    element.style.pointerEvents = "none";
    element.style.userSelect = "none";
    element.style.willChange = "transform, opacity";
    element.style.opacity = "1";
    overlay.appendChild(element);

    let lockedScreenXNorm = 0.5;
    let lockedScreenYNorm = 0.5;
    if (!this.playerUiNumbersUseWorldProjectionForVr) {
      const viewportRect = this.syncPlayerUiNumberOverlayBounds();
      if (viewportRect && viewportRect.width > 0 && viewportRect.height > 0) {
        const projected = this.projectPlayerUiNumberWorldAnchor(viewportRect, {
          fpsFloating: useFpsFloating,
          fpsLateralOffset,
          worldBaseHeightOffset,
        });
        if (Number.isFinite(projected.screenX)) {
          lockedScreenXNorm = projected.screenX / viewportRect.width;
        }
        if (Number.isFinite(projected.screenY)) {
          lockedScreenYNorm = projected.screenY / viewportRect.height;
        }
      }
    }

    this.playerUiNumberParticles.push({
      element,
      uiWidthPx,
      uiHeightPx,
      lockedScreenXNorm,
      lockedScreenYNorm,
      ageMs: 0,
      lifetimeMs: Math.round(this.playerHealNumberLifetimeMs * 1.65),
      fadeDelayMs: Math.round(this.playerHealNumberFadeDelayMs * 2.2),
      risePx: useFpsFloating ? 40 : 84,
      fpsFloating: useFpsFloating,
      fpsLateralOffset,
      worldBaseHeightOffset,
    });
  }

  private applyFpsForwardOffsetToPlayerNumberPosition(
    position: THREE.Vector3,
    applyVerticalLift: boolean,
    lateralOffset: number = 0,
  ): void {
    if (!this.isFpsMode()) {
      return;
    }

    const viewCamera = this.getActiveViewCamera();
    viewCamera.getWorldDirection(this.playerDamageNumberForwardDirection);
    this.playerDamageNumberForwardDirection.z = 0;
    const lengthSq = this.playerDamageNumberForwardDirection.lengthSq();
    if (lengthSq > 1e-8) {
      this.playerDamageNumberForwardDirection.multiplyScalar(
        1 / Math.sqrt(lengthSq),
      );
    } else {
      this.playerDamageNumberForwardDirection.set(
        -Math.sin(this.cameraYaw),
        -Math.cos(this.cameraYaw),
        0,
      );
    }
    this.playerDamageNumberRightDirection.set(
      this.playerDamageNumberForwardDirection.y,
      -this.playerDamageNumberForwardDirection.x,
      0,
    );

    position.x +=
      this.playerDamageNumberForwardDirection.x *
      this.playerDamageNumberForwardOffset;
    position.y +=
      this.playerDamageNumberForwardDirection.y *
      this.playerDamageNumberForwardOffset;
    if (lateralOffset !== 0) {
      position.x += this.playerDamageNumberRightDirection.x * lateralOffset;
      position.y += this.playerDamageNumberRightDirection.y * lateralOffset;
    }
    if (applyVerticalLift) {
      position.z += this.playerDamageNumberForwardLift;
    }
  }

  private alignPlayerDamageNumberToCamera(sprite: THREE.Sprite): void {
    sprite.quaternion.copy(this.getActiveViewCamera().quaternion);
  }

  private toCameraLocalOffset(
    worldPosition: THREE.Vector3,
    target: THREE.Vector3,
  ): THREE.Vector3 {
    const viewCamera = this.getActiveViewCamera();
    this.playerDamageNumberCameraInverseQuaternion
      .copy(viewCamera.quaternion)
      .invert();
    return target
      .copy(worldPosition)
      .sub(viewCamera.position)
      .applyQuaternion(this.playerDamageNumberCameraInverseQuaternion);
  }

  private fromCameraLocalOffset(
    cameraLocalOffset: THREE.Vector3,
    target: THREE.Vector3,
  ): THREE.Vector3 {
    const viewCamera = this.getActiveViewCamera();
    return target
      .copy(cameraLocalOffset)
      .applyQuaternion(viewCamera.quaternion)
      .add(viewCamera.position);
  }

  private resolveThirdPersonZoomFactor(): number {
    if (this.isFpsMode()) {
      return 1;
    }

    const zoomSpan = Math.max(0.001, this.maxDistance - this.minDistance);
    return THREE.MathUtils.clamp(
      (this.maxDistance - this.cameraDistance) / zoomSpan,
      0,
      1,
    );
  }

  private spawnBloodMistParticles(
    tileX: number,
    tileY: number,
    damage: number,
    variant: "hit" | "defeat",
  ): void {
    const sanitized = Math.max(1, Math.round(Math.abs(damage)));
    const texture = this.getBloodMistTexture();
    const awayFromPlayer = new THREE.Vector2(
      tileX - this.playerPos.x,
      -(tileY - this.playerPos.y),
    );
    if (awayFromPlayer.lengthSq() < 0.0001) {
      const randomAngle = Math.random() * Math.PI * 2;
      awayFromPlayer.set(Math.cos(randomAngle), Math.sin(randomAngle));
    } else {
      awayFromPlayer.normalize();
    }

    const spreadRadians =
      variant === "defeat"
        ? THREE.MathUtils.degToRad(52)
        : THREE.MathUtils.degToRad(32);
    const count =
      variant === "defeat"
        ? THREE.MathUtils.randInt(
            this.bloodParticleDefeatCountMin,
            this.bloodParticleDefeatCountMax,
          )
        : THREE.MathUtils.randInt(
            this.bloodParticleHitCountMin,
            this.bloodParticleHitCountMax,
          );
    const particleCount =
      count + (variant === "defeat" ? Math.min(12, sanitized) : 0);
    const baseLifetimeMs =
      variant === "defeat"
        ? this.bloodParticleDefeatLifetimeMs
        : this.bloodParticleHitLifetimeMs;
    const lifetimeJitterMs = variant === "defeat" ? 580 : 260;
    const baseHorizontalSpeed = variant === "defeat" ? 4.2 : 3.1;
    const horizontalBoost = variant === "defeat" ? 0.24 : 0.16;
    const baseVerticalSpeed = variant === "defeat" ? 3.1 : 2.3;
    const horizontalVarianceScale = variant === "defeat" ? 1.35 : 1.1;
    const horizontalVarianceJitter = variant === "defeat" ? 1.4 : 0.9;
    const minScale = variant === "defeat" ? 0.086 : 0.049;
    const maxScale = variant === "defeat" ? 0.214 : 0.118;

    for (let i = 0; i < particleCount; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });
      material.opacity = variant === "defeat" ? 0.95 : 0.88;

      const sprite = new THREE.Sprite(material);
      const sizeFactor = Math.pow(Math.random(), 1.35);
      const baseScaleValue = THREE.MathUtils.lerp(
        minScale,
        maxScale,
        sizeFactor,
      );
      const baseScale = new THREE.Vector2(
        baseScaleValue * (0.82 + Math.random() * 0.36),
        baseScaleValue * (0.82 + Math.random() * 0.36),
      );
      sprite.scale.set(baseScale.x, baseScale.y, 1);
      sprite.position.set(
        tileX * TILE_SIZE +
          (Math.random() - 0.5) * this.bloodParticleSpawnJitter,
        -tileY * TILE_SIZE +
          (Math.random() - 0.5) * this.bloodParticleSpawnJitter,
        this.damageParticleFloorZ + 0.16 + Math.random() * 0.24,
      );
      sprite.renderOrder = 930;
      this.addWorldObject(sprite);

      const directionAngle =
        Math.atan2(awayFromPlayer.y, awayFromPlayer.x) +
        (Math.random() - 0.5) * spreadRadians;
      const horizontalSpeed =
        baseHorizontalSpeed +
        Math.random() * (baseHorizontalSpeed * horizontalVarianceScale) +
        (Math.random() - 0.5) * horizontalVarianceJitter +
        sanitized * horizontalBoost +
        (1 - sizeFactor) * (variant === "defeat" ? 2.6 : 1.9);
      const verticalSpeed =
        baseVerticalSpeed +
        Math.random() * (variant === "defeat" ? 3.2 : 2.2) +
        (1 - sizeFactor) * (variant === "defeat" ? 1.9 : 1.2);

      this.damageParticles.push({
        sprite,
        velocity: new THREE.Vector3(
          Math.cos(directionAngle) * horizontalSpeed,
          Math.sin(directionAngle) * horizontalSpeed,
          verticalSpeed,
        ),
        ageMs: 0,
        lifetimeMs: baseLifetimeMs + Math.random() * lifetimeJitterMs,
        radius: baseScaleValue * 0.52,
        baseScale,
      });
    }
  }

  private disposeMonsterBillboardShardParticle(index: number): void {
    if (index < 0 || index >= this.monsterBillboardShardParticles.length) {
      return;
    }

    const [particle] = this.monsterBillboardShardParticles.splice(index, 1);
    this.removeWorldObject(particle.mesh);
    if (particle.mesh.material.map) {
      particle.mesh.material.map.dispose();
    }
    particle.mesh.material.dispose();
    particle.mesh.geometry.dispose();
  }

  private disposeDamageParticle(index: number): void {
    if (index < 0 || index >= this.damageParticles.length) {
      return;
    }

    const [particle] = this.damageParticles.splice(index, 1);
    this.removeWorldObject(particle.sprite);

    const material = particle.sprite.material;
    if (material instanceof THREE.SpriteMaterial) {
      if (material.map && material.map !== this.bloodMistTexture) {
        material.map.dispose();
      }
      material.dispose();
    }
  }

  private disposePlayerDamageNumberParticle(index: number): void {
    if (index < 0 || index >= this.playerDamageNumberParticles.length) {
      return;
    }

    const [particle] = this.playerDamageNumberParticles.splice(index, 1);
    this.removeWorldObject(particle.sprite);

    const material = particle.sprite.material;
    if (material instanceof THREE.SpriteMaterial) {
      if (material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  }

  private resolvePlayerDamageNumberAgainstWallTile(
    particle: DamageNumberParticle,
    tileX: number,
    tileY: number,
  ): boolean {
    const position = particle.sprite.position;
    const half = TILE_SIZE / 2;
    const centerX = tileX * TILE_SIZE;
    const centerY = -tileY * TILE_SIZE;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    const radius = particle.radius;

    const closestX = THREE.MathUtils.clamp(position.x, minX, maxX);
    const closestY = THREE.MathUtils.clamp(position.y, minY, maxY);
    let nx = position.x - closestX;
    let ny = position.y - closestY;
    const distSq = nx * nx + ny * ny;

    if (distSq >= radius * radius) {
      return false;
    }

    let penetration = 0;
    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      nx /= dist;
      ny /= dist;
      penetration = radius - dist;
    } else {
      const toLeft = position.x - minX;
      const toRight = maxX - position.x;
      const toBottom = position.y - minY;
      const toTop = maxY - position.y;
      const minPenetration = Math.min(toLeft, toRight, toBottom, toTop);

      if (minPenetration === toLeft) {
        nx = -1;
        ny = 0;
        penetration = toLeft + radius;
      } else if (minPenetration === toRight) {
        nx = 1;
        ny = 0;
        penetration = toRight + radius;
      } else if (minPenetration === toBottom) {
        nx = 0;
        ny = -1;
        penetration = toBottom + radius;
      } else {
        nx = 0;
        ny = 1;
        penetration = toTop + radius;
      }
    }

    position.x += nx * penetration;
    position.y += ny * penetration;

    const velocityIntoWall =
      particle.velocity.x * nx + particle.velocity.y * ny;
    if (velocityIntoWall < 0) {
      const bounce = (1 + this.playerDamageNumberWallBounce) * velocityIntoWall;
      particle.velocity.x -= bounce * nx;
      particle.velocity.y -= bounce * ny;
      particle.velocity.x *= 0.78;
      particle.velocity.y *= 0.78;
    }

    return true;
  }

  private resolvePlayerDamageNumberWallCollision(
    particle: DamageNumberParticle,
  ): void {
    if (particle.sprite.position.z > WALL_HEIGHT + 0.22) {
      return;
    }

    const approxTileX = Math.round(particle.sprite.position.x / TILE_SIZE);
    const approxTileY = Math.round(-particle.sprite.position.y / TILE_SIZE);

    for (let x = approxTileX - 1; x <= approxTileX + 1; x += 1) {
      for (let y = approxTileY - 1; y <= approxTileY + 1; y += 1) {
        const wall = this.tileMap.get(`${x},${y}`);
        if (!wall || !wall.userData?.isWall) {
          continue;
        }
        this.resolvePlayerDamageNumberAgainstWallTile(particle, x, y);
      }
    }
  }

  private resolveCollidableParticleAgainstWallTile(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    tileX: number,
    tileY: number,
    wallBounce: number,
  ): boolean {
    const half = TILE_SIZE / 2;
    const centerX = tileX * TILE_SIZE;
    const centerY = -tileY * TILE_SIZE;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;

    const closestX = THREE.MathUtils.clamp(position.x, minX, maxX);
    const closestY = THREE.MathUtils.clamp(position.y, minY, maxY);
    let nx = position.x - closestX;
    let ny = position.y - closestY;
    const distSq = nx * nx + ny * ny;

    if (distSq >= radius * radius) {
      return false;
    }

    let penetration = 0;
    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      nx /= dist;
      ny /= dist;
      penetration = radius - dist;
    } else {
      const toLeft = position.x - minX;
      const toRight = maxX - position.x;
      const toBottom = position.y - minY;
      const toTop = maxY - position.y;
      const minPenetration = Math.min(toLeft, toRight, toBottom, toTop);

      if (minPenetration === toLeft) {
        nx = -1;
        ny = 0;
        penetration = toLeft + radius;
      } else if (minPenetration === toRight) {
        nx = 1;
        ny = 0;
        penetration = toRight + radius;
      } else if (minPenetration === toBottom) {
        nx = 0;
        ny = -1;
        penetration = toBottom + radius;
      } else {
        nx = 0;
        ny = 1;
        penetration = toTop + radius;
      }
    }

    position.x += nx * penetration;
    position.y += ny * penetration;

    const velocityIntoWall = velocity.x * nx + velocity.y * ny;
    if (velocityIntoWall < 0) {
      const bounce = (1 + wallBounce) * velocityIntoWall;
      velocity.x -= bounce * nx;
      velocity.y -= bounce * ny;
      velocity.x *= 0.78;
      velocity.y *= 0.78;
    }

    return true;
  }

  private resolveCollidableParticleWallCollision(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    wallBounce: number,
  ): void {
    if (position.z > WALL_HEIGHT + 0.22) {
      return;
    }

    const approxTileX = Math.round(position.x / TILE_SIZE);
    const approxTileY = Math.round(-position.y / TILE_SIZE);

    for (let x = approxTileX - 1; x <= approxTileX + 1; x += 1) {
      for (let y = approxTileY - 1; y <= approxTileY + 1; y += 1) {
        const wall = this.tileMap.get(`${x},${y}`);
        if (!wall || !wall.userData?.isWall) {
          continue;
        }
        this.resolveCollidableParticleAgainstWallTile(
          position,
          velocity,
          radius,
          x,
          y,
          wallBounce,
        );
      }
    }
  }

  private resolveDamageParticleWallCollision(
    particle: BloodMistParticle,
  ): void {
    this.resolveCollidableParticleWallCollision(
      particle.sprite.position,
      particle.velocity,
      particle.radius,
      this.damageParticleWallBounce,
    );
  }

  private resolveMonsterBillboardShardWallCollision(
    particle: BillboardShardParticle,
  ): void {
    this.resolveCollidableParticleWallCollision(
      particle.mesh.position,
      particle.velocity,
      particle.radius,
      this.monsterBillboardShardWallBounce,
    );
  }

  private updateDamageParticles(deltaSeconds: number): void {
    if (!this.damageParticles.length) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const drag = Math.exp(-this.damageParticleDrag * deltaSeconds);

    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.damageParticles[i];
      particle.ageMs += deltaMs;
      const speed = particle.velocity.length();
      const travelPerFrame = speed * deltaSeconds;
      const subSteps = THREE.MathUtils.clamp(
        Math.ceil(travelPerFrame / (TILE_SIZE * 0.35)),
        1,
        4,
      );
      const stepSeconds = deltaSeconds / subSteps;
      const dragPerStep = Math.pow(drag, 1 / subSteps);

      for (let step = 0; step < subSteps; step += 1) {
        particle.velocity.z -= this.damageParticleGravity * stepSeconds;
        particle.velocity.x *= dragPerStep;
        particle.velocity.y *= dragPerStep;

        particle.sprite.position.x += particle.velocity.x * stepSeconds;
        particle.sprite.position.y += particle.velocity.y * stepSeconds;
        particle.sprite.position.z += particle.velocity.z * stepSeconds;

        this.resolveDamageParticleWallCollision(particle);

        if (particle.sprite.position.z < this.damageParticleFloorZ) {
          particle.sprite.position.z = this.damageParticleFloorZ;
          if (particle.velocity.z < 0) {
            particle.velocity.z *= -0.22;
          }
          particle.velocity.x *= 0.82;
          particle.velocity.y *= 0.82;
        }
      }

      const material = particle.sprite.material;
      if (!(material instanceof THREE.SpriteMaterial)) {
        this.disposeDamageParticle(i);
        continue;
      }

      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1,
      );
      material.opacity = Math.max(0, 1 - Math.pow(lifeT, 2.1));

      const scaleBoost = 1 + lifeT * 0.34;
      particle.sprite.scale.set(
        particle.baseScale.x * scaleBoost,
        particle.baseScale.y * scaleBoost,
        1,
      );

      if (lifeT >= 1 || material.opacity <= 0.01) {
        this.disposeDamageParticle(i);
      }
    }
  }

  private updateMonsterBillboardShardParticles(deltaSeconds: number): void {
    if (!this.monsterBillboardShardParticles.length) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const drag = Math.exp(-this.monsterBillboardShardDrag * deltaSeconds);

    for (
      let i = this.monsterBillboardShardParticles.length - 1;
      i >= 0;
      i -= 1
    ) {
      const particle = this.monsterBillboardShardParticles[i];
      particle.ageMs += deltaMs;

      const speed = particle.velocity.length();
      const travelPerFrame = speed * deltaSeconds;
      const subSteps = THREE.MathUtils.clamp(
        Math.ceil(travelPerFrame / (TILE_SIZE * 0.35)),
        1,
        4,
      );
      const stepSeconds = deltaSeconds / subSteps;
      const dragPerStep = Math.pow(drag, 1 / subSteps);

      for (let step = 0; step < subSteps; step += 1) {
        let onFloor = false;
        if (!particle.settled) {
          particle.velocity.z -=
            this.monsterBillboardShardGravity * stepSeconds;
        }
        particle.velocity.x *= dragPerStep;
        particle.velocity.y *= dragPerStep;

        particle.mesh.position.x += particle.velocity.x * stepSeconds;
        particle.mesh.position.y += particle.velocity.y * stepSeconds;
        particle.mesh.position.z += particle.velocity.z * stepSeconds;

        this.resolveMonsterBillboardShardWallCollision(particle);

        if (particle.mesh.position.z < this.damageParticleFloorZ) {
          onFloor = true;
          particle.mesh.position.z = this.damageParticleFloorZ;
          particle.floorContactMs += stepSeconds * 1000;
          if (particle.velocity.z < 0) {
            particle.velocity.z *= -this.monsterBillboardShardFloorBounce;
            if (Math.abs(particle.velocity.z) < 0.44) {
              particle.velocity.z = 0;
            }
          }
          particle.velocity.x *= this.monsterBillboardShardGroundFriction;
          particle.velocity.y *= this.monsterBillboardShardGroundFriction;

          const angularGroundDrag = Math.pow(
            this.monsterBillboardShardAngularGroundDamping,
            stepSeconds * 60,
          );
          particle.angularVelocity.multiplyScalar(angularGroundDrag);
          const settleT = THREE.MathUtils.clamp(
            particle.floorContactMs / this.monsterBillboardShardFlatSettleMs,
            0,
            1,
          );
          particle.mesh.quaternion.slerp(
            particle.flatOrientation,
            0.12 + 0.64 * settleT,
          );
          if (
            settleT >= 1 &&
            particle.velocity.lengthSq() < 0.055 * 0.055 &&
            particle.angularVelocity.lengthSq() < 0.18 * 0.18
          ) {
            particle.settled = true;
            particle.velocity.set(0, 0, 0);
            particle.angularVelocity.set(0, 0, 0);
            particle.mesh.quaternion.copy(particle.flatOrientation);
          }
        } else {
          particle.floorContactMs = 0;
          particle.angularVelocity.multiplyScalar(
            this.monsterBillboardShardAngularAirDamping,
          );
        }

        if (
          particle.angularVelocity.lengthSq() > 1e-6 &&
          !particle.settled &&
          !onFloor
        ) {
          const angularSpeed = particle.angularVelocity.length();
          this.monsterBillboardShardAngularAxis
            .copy(particle.angularVelocity)
            .multiplyScalar(1 / angularSpeed);
          this.monsterBillboardShardDeltaQuaternion.setFromAxisAngle(
            this.monsterBillboardShardAngularAxis,
            angularSpeed * stepSeconds,
          );
          particle.mesh.quaternion.multiply(
            this.monsterBillboardShardDeltaQuaternion,
          );
        }
      }

      const material = particle.mesh.material;
      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1,
      );
      const fadeT = THREE.MathUtils.clamp(
        (particle.ageMs - particle.fadeStartMs) /
          Math.max(1, particle.lifetimeMs - particle.fadeStartMs),
        0,
        1,
      );
      material.opacity = Math.max(0, 1 - Math.pow(fadeT, 1.7));

      const scaleTaper = 1 - 0.2 * Math.pow(lifeT, 1.2);
      particle.mesh.scale.set(
        particle.baseScale.x * scaleTaper,
        particle.baseScale.y * scaleTaper,
        1,
      );

      if (lifeT >= 1 || material.opacity <= 0.01) {
        this.disposeMonsterBillboardShardParticle(i);
      }
    }
  }

  private clearBloodMistParticles(): void {
    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      this.disposeDamageParticle(i);
    }
  }

  private clearMonsterBillboardShardParticles(): void {
    for (
      let i = this.monsterBillboardShardParticles.length - 1;
      i >= 0;
      i -= 1
    ) {
      this.disposeMonsterBillboardShardParticle(i);
    }
  }

  private ensurePlayerUiNumberOverlay(): HTMLDivElement | null {
    if (typeof document === "undefined") {
      return null;
    }

    if (this.playerUiNumberOverlay?.isConnected) {
      return this.playerUiNumberOverlay;
    }

    const overlay = document.createElement("div");
    overlay.className = "nh3d-player-ui-number-layer";
    overlay.style.position = "fixed";
    overlay.style.left = "0px";
    overlay.style.top = "0px";
    overlay.style.width = "0px";
    overlay.style.height = "0px";
    overlay.style.pointerEvents = "none";
    overlay.style.overflow = "hidden";
    overlay.style.zIndex = "1400";
    document.body.appendChild(overlay);
    this.playerUiNumberOverlay = overlay;
    this.playerUiOverlayBounds.left = Number.NaN;
    this.playerUiOverlayBounds.top = Number.NaN;
    this.playerUiOverlayBounds.width = Number.NaN;
    this.playerUiOverlayBounds.height = Number.NaN;
    return overlay;
  }

  private syncPlayerUiNumberOverlayBounds(): DOMRect | null {
    const overlay = this.ensurePlayerUiNumberOverlay();
    if (!overlay || !this.renderer?.domElement?.isConnected) {
      return null;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (
      rect.left !== this.playerUiOverlayBounds.left ||
      rect.top !== this.playerUiOverlayBounds.top ||
      rect.width !== this.playerUiOverlayBounds.width ||
      rect.height !== this.playerUiOverlayBounds.height
    ) {
      overlay.style.left = `${Math.round(rect.left)}px`;
      overlay.style.top = `${Math.round(rect.top)}px`;
      overlay.style.width = `${Math.round(rect.width)}px`;
      overlay.style.height = `${Math.round(rect.height)}px`;
      this.playerUiOverlayBounds.left = rect.left;
      this.playerUiOverlayBounds.top = rect.top;
      this.playerUiOverlayBounds.width = rect.width;
      this.playerUiOverlayBounds.height = rect.height;
    }

    return rect;
  }

  private disposePlayerUiNumberParticle(index: number): void {
    if (index < 0 || index >= this.playerUiNumberParticles.length) {
      return;
    }

    const [particle] = this.playerUiNumberParticles.splice(index, 1);
    particle.element.remove();
  }

  private clearPlayerUiNumberParticles(): void {
    for (let i = this.playerUiNumberParticles.length - 1; i >= 0; i -= 1) {
      this.disposePlayerUiNumberParticle(i);
    }
  }

  private projectPlayerUiNumberWorldAnchor(
    viewportRect: DOMRect,
    particle: Pick<
      PlayerUiNumberParticle,
      "fpsFloating" | "fpsLateralOffset" | "worldBaseHeightOffset"
    >,
  ): { screenX: number; screenY: number; isVisible: boolean } {
    this.playerUiNumberAnchor.set(
      this.playerPos.x * TILE_SIZE,
      -this.playerPos.y * TILE_SIZE,
      this.damageParticleFloorZ + particle.worldBaseHeightOffset,
    );
    if (particle.fpsFloating) {
      this.applyFpsForwardOffsetToPlayerNumberPosition(
        this.playerUiNumberAnchor,
        false,
        particle.fpsLateralOffset,
      );
    }

    this.playerUiNumberScreenAnchor
      .copy(this.playerUiNumberAnchor)
      .project(this.getActivePerspectiveViewCamera());
    const ndc = this.playerUiNumberScreenAnchor;
    return {
      screenX: (ndc.x + 1) * 0.5 * viewportRect.width,
      screenY: (-ndc.y + 1) * 0.5 * viewportRect.height,
      isVisible:
        ndc.z >= -1 &&
        ndc.z <= 1 &&
        ndc.x >= -1.2 &&
        ndc.x <= 1.2 &&
        ndc.y >= -1.2 &&
        ndc.y <= 1.2,
    };
  }

  private updatePlayerUiNumberParticles(deltaSeconds: number): void {
    if (!this.playerUiNumberParticles.length) {
      return;
    }

    const viewportRect = this.syncPlayerUiNumberOverlayBounds();
    if (!viewportRect || viewportRect.width <= 0 || viewportRect.height <= 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const layoutCandidates: Array<{
      particle: PlayerUiNumberParticle;
      screenX: number;
      screenY: number;
      risePx: number;
    }> = [];
    for (let i = this.playerUiNumberParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.playerUiNumberParticles[i];
      particle.ageMs += deltaMs;
      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1,
      );

      let screenX = particle.lockedScreenXNorm * viewportRect.width;
      let screenY = particle.lockedScreenYNorm * viewportRect.height;
      let isVisible = true;
      if (this.playerUiNumbersUseWorldProjectionForVr) {
        const projected = this.projectPlayerUiNumberWorldAnchor(
          viewportRect,
          particle,
        );
        screenX = projected.screenX;
        screenY = projected.screenY;
        isVisible = projected.isVisible;
      } else {
        const visibilityMarginX = viewportRect.width * 0.1;
        const visibilityMarginY = viewportRect.height * 0.1;
        isVisible =
          screenX >= -visibilityMarginX &&
          screenX <= viewportRect.width + visibilityMarginX &&
          screenY >= -visibilityMarginY &&
          screenY <= viewportRect.height + visibilityMarginY;
      }

      const risePx = particle.risePx * lifeT;
      if (isVisible) {
        layoutCandidates.push({
          particle,
          screenX,
          screenY,
          risePx,
        });
      }
      particle.element.style.transform = "translate(-50%, -50%)";

      const fadeDurationMs = Math.max(
        1,
        particle.lifetimeMs - particle.fadeDelayMs,
      );
      const fadeT = THREE.MathUtils.clamp(
        (particle.ageMs - particle.fadeDelayMs) / fadeDurationMs,
        0,
        1,
      );
      const opacity = isVisible ? Math.max(0, 1 - fadeT * 1.05) : 0;
      particle.element.style.opacity = opacity.toFixed(3);

      if (lifeT >= 1 || opacity <= 0.01) {
        this.disposePlayerUiNumberParticle(i);
      }
    }

    if (!layoutCandidates.length) {
      return;
    }

    const placedBounds: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    const overlapGapPx = 12;
    const overlapWidthScale = 0.82;
    const overlapHeightScale = 0.52;
    layoutCandidates.sort((a, b) => a.particle.ageMs - b.particle.ageMs);
    for (const candidate of layoutCandidates) {
      const { particle } = candidate;
      const x = candidate.screenX;
      let y = candidate.screenY - candidate.risePx;
      const width = Math.max(8, particle.uiWidthPx * overlapWidthScale);
      const height = Math.max(8, particle.uiHeightPx * overlapHeightScale);

      let moved = true;
      let guard = 0;
      while (moved && guard < 12) {
        moved = false;
        guard += 1;
        for (const placed of placedBounds) {
          const overlapsX =
            Math.abs(x - placed.x) <
            (width + placed.width) * 0.5 + overlapGapPx;
          const overlapsY =
            Math.abs(y - placed.y) <
            (height + placed.height) * 0.5 + overlapGapPx;
          if (!overlapsX || !overlapsY) {
            continue;
          }
          y = placed.y - (height + placed.height) * 0.5 - overlapGapPx;
          moved = true;
        }
      }

      particle.element.style.left = `${Math.round(x)}px`;
      particle.element.style.top = `${Math.round(y)}px`;
      placedBounds.push({ x, y, width, height });
    }
  }

  private updatePlayerDamageNumberParticles(deltaSeconds: number): void {
    if (!this.playerDamageNumberParticles.length) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const drag = Math.exp(-this.playerDamageNumberDrag * deltaSeconds);

    for (let i = this.playerDamageNumberParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.playerDamageNumberParticles[i];
      particle.ageMs += deltaMs;
      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1,
      );

      if (this.isFpsMode() && particle.fpsFloating) {
        if (
          !this.playerUiNumbersUseWorldProjectionForVr &&
          particle.fpsCameraLocalAnchor
        ) {
          this.playerDamageNumberCameraLocalScratch.copy(
            particle.fpsCameraLocalAnchor,
          );
          this.playerDamageNumberCameraLocalScratch.y +=
            this.playerDamageNumberFpsRiseDistance * lifeT;
          this.fromCameraLocalOffset(
            this.playerDamageNumberCameraLocalScratch,
            particle.sprite.position,
          );
        } else {
          particle.sprite.position.set(
            this.playerPos.x * TILE_SIZE,
            -this.playerPos.y * TILE_SIZE,
            this.damageParticleFloorZ +
              particle.fpsBaseHeightOffset +
              this.playerDamageNumberFpsRiseDistance * lifeT,
          );
          this.applyFpsForwardOffsetToPlayerNumberPosition(
            particle.sprite.position,
            false,
            particle.fpsLateralOffset,
          );
        }
        this.alignPlayerDamageNumberToCamera(particle.sprite);

        const material = particle.sprite.material;
        if (!(material instanceof THREE.SpriteMaterial)) {
          this.disposePlayerDamageNumberParticle(i);
          continue;
        }

        const fadeStart = 0.42;
        const fadeT = THREE.MathUtils.clamp(
          (lifeT - fadeStart) / (1 - fadeStart),
          0,
          1,
        );
        material.opacity = Math.max(0, 1 - Math.pow(fadeT, 1.7));
        const scaleBoost = 1 + lifeT * 0.06;
        particle.sprite.scale.set(
          particle.baseScale.x * scaleBoost,
          particle.baseScale.y * scaleBoost,
          1,
        );

        if (lifeT >= 1 || material.opacity <= 0.01) {
          this.disposePlayerDamageNumberParticle(i);
        }
        continue;
      }

      if (particle.kind === "damage") {
        particle.velocity.z -= this.playerDamageNumberGravity * deltaSeconds;
        particle.velocity.x *= drag;
        particle.velocity.y *= drag;
      }

      particle.sprite.position.x += particle.velocity.x * deltaSeconds;
      particle.sprite.position.y += particle.velocity.y * deltaSeconds;
      particle.sprite.position.z += particle.velocity.z * deltaSeconds;
      if (particle.kind === "heal") {
        particle.sprite.position.x = this.playerPos.x * TILE_SIZE;
        particle.sprite.position.y = -this.playerPos.y * TILE_SIZE;
        this.applyFpsForwardOffsetToPlayerNumberPosition(
          particle.sprite.position,
          false,
        );
      }
      this.alignPlayerDamageNumberToCamera(particle.sprite);

      if (particle.kind === "damage") {
        this.resolvePlayerDamageNumberWallCollision(particle);

        if (particle.sprite.position.z < this.damageParticleFloorZ) {
          particle.sprite.position.z = this.damageParticleFloorZ;
          if (particle.velocity.z < 0) {
            particle.velocity.z *= -0.22;
          }
          particle.velocity.x *= 0.82;
          particle.velocity.y *= 0.82;
        }
      }

      const material = particle.sprite.material;
      if (!(material instanceof THREE.SpriteMaterial)) {
        this.disposePlayerDamageNumberParticle(i);
        continue;
      }

      if (particle.kind === "heal") {
        const fadeDelayMs = this.playerHealNumberFadeDelayMs;
        const fadeDurationMs = Math.max(1, particle.lifetimeMs - fadeDelayMs);
        const fadeT = THREE.MathUtils.clamp(
          (particle.ageMs - fadeDelayMs) / fadeDurationMs,
          0,
          1,
        );
        material.opacity = Math.max(0, 1 - fadeT * 1.4);
      } else {
        const fadeDelayMs = this.playerDamageNumberFadeDelayMs;
        const fadeDurationMs = Math.max(1, particle.lifetimeMs - fadeDelayMs);
        const fadeT = THREE.MathUtils.clamp(
          (particle.ageMs - fadeDelayMs) / fadeDurationMs,
          0,
          1,
        );
        material.opacity = Math.max(0, 1 - fadeT * fadeT);
      }

      const scaleBoost = 1 + (1 - lifeT) * 0.08;
      particle.sprite.scale.set(
        particle.baseScale.x * scaleBoost,
        particle.baseScale.y * scaleBoost,
        1,
      );

      if (lifeT >= 1 || material.opacity <= 0.01) {
        this.disposePlayerDamageNumberParticle(i);
      }
    }
  }

  private clearPlayerDamageNumberParticles(): void {
    for (let i = this.playerDamageNumberParticles.length - 1; i >= 0; i -= 1) {
      this.disposePlayerDamageNumberParticle(i);
    }
  }

  private updateDamageEffects(deltaSeconds: number): void {
    this.updateGlyphDamageFlashes(deltaSeconds);
    this.updateMonsterBillboardDamageFlashes(deltaSeconds);
    this.updateGlyphDamageShakes(deltaSeconds);
    this.updateDamageParticles(deltaSeconds);
    this.updateMonsterBillboardShardParticles(deltaSeconds);
    this.updatePlayerDamageNumberParticles(deltaSeconds);
    this.updatePlayerUiNumberParticles(deltaSeconds);
    const now = Date.now();
    this.prunePendingCharacterDamage(now);
  }

  private clearDamageEffects(): void {
    const flashKeys = Array.from(this.glyphDamageFlashes.keys());
    for (const key of flashKeys) {
      this.stopGlyphDamageFlash(key);
    }
    const billboardFlashKeys = Array.from(
      this.monsterBillboardDamageFlashes.keys(),
    );
    for (const key of billboardFlashKeys) {
      this.stopMonsterBillboardDamageFlash(key);
    }

    const shakeKeys = Array.from(this.glyphDamageShakes.keys());
    for (const key of shakeKeys) {
      this.stopGlyphDamageShake(key);
    }

    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      this.disposeDamageParticle(i);
    }
    for (
      let i = this.monsterBillboardShardParticles.length - 1;
      i >= 0;
      i -= 1
    ) {
      this.disposeMonsterBillboardShardParticle(i);
    }
    for (let i = this.playerDamageNumberParticles.length - 1; i >= 0; i -= 1) {
      this.disposePlayerDamageNumberParticle(i);
    }
    this.clearPlayerUiNumberParticles();

    this.pendingCharacterDamageQueue = [];
    this.lastDirectionalAttackContext = null;
    this.pendingPointerAttackTargetContext = null;
    this.lastParsedDamageMessage = "";
    this.lastParsedDamageAtMs = 0;
    this.lastParsedDefeatMessage = "";
    this.lastParsedDefeatAtMs = 0;
    this.pendingPlayerFootstepSoundArmed = false;
    this.clearPlayerCliparoundInputCooldown();
    this.messageSoundHooks.reset();
  }

  private applyGlyphMaterial(
    key: string,
    mesh: THREE.Mesh,
    baseMaterial: THREE.MeshLambertMaterial,
    glyphChar: string,
    textColor: string,
    isWall: boolean,
    darkenFactor: number = 1,
    drawFloorGrid: boolean = false,
    tileIndex: number = -1,
    solidColorHex: string | null = null,
    solidColorGridEnabled: boolean = false,
    solidColorGridDarknessPercent: number = 15,
  ): void {
    const overlay = this.ensureGlyphOverlay(key, baseMaterial);
    const baseColorHex = baseMaterial.color.getHexString();
    const clampedDarken = THREE.MathUtils.clamp(darkenFactor, 0, 1);
    const resolvedSolidColorHex =
      typeof solidColorHex === "string" ? solidColorHex : null;

    const useSolidColor = resolvedSolidColorHex !== null;
    const useTiles =
      !useSolidColor &&
      this.clientOptions.tilesetMode === "tiles" &&
      tileIndex >= 0;
    const solidWallMaterial =
      useSolidColor && resolvedSolidColorHex
        ? this.getInferredDarkWallSolidColorMaterial(
            resolvedSolidColorHex,
            solidColorGridEnabled,
            solidColorGridDarknessPercent,
          )
        : null;

    let textureKey: string;
    if (useSolidColor) {
      textureKey = `solid:${resolvedSolidColorHex.toLowerCase()}`;
    } else if (useTiles) {
      textureKey = `tile:${tileIndex}|${clampedDarken.toFixed(3)}`;
    } else {
      textureKey = `${baseColorHex}|${glyphChar}|${textColor}|${clampedDarken.toFixed(3)}|${drawFloorGrid ? 1 : 0}`;
    }

    if (overlay.textureKey !== textureKey) {
      if (overlay.textureKey) {
        this.releaseGlyphTexture(overlay.textureKey);
      }

      overlay.baseColorHex = baseColorHex;
      if (useSolidColor) {
        overlay.material.color.set(resolvedSolidColorHex);
      } else {
        overlay.material.color.set("#ffffff");
      }

      if (useSolidColor) {
        overlay.texture = null;
        overlay.material.map = null;
      } else if (useTiles) {
        overlay.texture = this.acquireGlyphTexture(
          textureKey,
          () => this.createTileTexture(tileIndex, clampedDarken, false), // Pass false: map tiles are opaque
        );
      } else {
        overlay.texture = this.acquireGlyphTexture(textureKey, () =>
          this.createGlyphTexture(
            baseColorHex,
            glyphChar,
            textColor,
            clampedDarken,
            256,
            drawFloorGrid,
          ),
        );
      }

      overlay.material.map = overlay.texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }
    if (useSolidColor) {
      overlay.material.color.set(resolvedSolidColorHex);
    } else {
      overlay.material.color.set("#ffffff");
    }

    const flashState = this.glyphDamageFlashes.get(key);
    if (flashState) {
      flashState.baseColorHex = baseColorHex;
      flashState.glyphChar = glyphChar;
      flashState.darkenFactor = clampedDarken;
      if (flashState.mode === "glyph_texture" && flashState.texture) {
        overlay.material.map = flashState.texture;
        overlay.material.color.copy(this.glyphDamageFlashWhite);
        overlay.material.needsUpdate = true;
      } else {
        this.renderGlyphDamageFlash(
          flashState,
          this.getGlyphDamageFlashIntensity(flashState),
        );
      }
    }

    if (!this.tileRevealStartMs.has(key)) {
      overlay.material.opacity = 1;
    }

    const isDoorWall = mesh.userData?.materialKind === "door";
    const sourceGlyph =
      typeof mesh.userData?.sourceGlyph === "number"
        ? Math.trunc(mesh.userData.sourceGlyph)
        : null;
    const wallOrientationChar = this.resolveWallOrientationChar(
      glyphChar,
      sourceGlyph,
    );
    const cornerWallSideBaseTileIndex =
      this.resolveCornerWallSideBaseTileIndex(tileIndex);
    const shouldOverrideCornerWallSideTiles =
      useTiles && isWall && !isDoorWall && cornerWallSideBaseTileIndex !== null;
    const shouldOverrideVerticalWallSideTiles =
      useTiles &&
      isWall &&
      !isDoorWall &&
      !shouldOverrideCornerWallSideTiles &&
      wallOrientationChar === "|" &&
      tileIndex >= 0;
    const shouldRotateHorizontalWallSideTiles =
      useTiles &&
      isWall &&
      !isDoorWall &&
      !shouldOverrideCornerWallSideTiles &&
      wallOrientationChar === "-" &&
      tileIndex >= 0;
    const shouldRotateVerticalDoorSideTiles =
      useTiles &&
      isWall &&
      isDoorWall &&
      sourceGlyph !== null &&
      isVerticalDoorCmapGlyph(sourceGlyph) &&
      tileIndex >= 0;
    const wallSideOverrideTileIndex = shouldOverrideCornerWallSideTiles
      ? (cornerWallSideBaseTileIndex ?? -1)
      : shouldOverrideVerticalWallSideTiles
        ? tileIndex + 1
        : shouldRotateHorizontalWallSideTiles ||
            shouldRotateVerticalDoorSideTiles
          ? tileIndex
          : -1;
    const wallSideOverrideRotation: WallSideTileRotation = "cw90";
    const wallSideOverrideMaterial =
      wallSideOverrideTileIndex >= 0
        ? this.ensureWallSideTileOverlayMaterial(
            mesh,
            wallSideOverrideTileIndex,
            clampedDarken,
            overlay.material.opacity,
            wallSideOverrideRotation,
          )
        : null;
    const wallSideFrontBackOverrideMaterial =
      shouldOverrideVerticalWallSideTiles || shouldOverrideCornerWallSideTiles
        ? this.ensureWallSideTileOverlayMaterial(
            mesh,
            shouldOverrideCornerWallSideTiles
              ? (cornerWallSideBaseTileIndex ?? -1)
              : tileIndex + 1,
            clampedDarken,
            overlay.material.opacity,
            "none",
          )
        : null;
    const chamferSideOverrideMaterial =
      wallSideOverrideTileIndex >= 0
        ? this.ensureWallSideTileOverlayMaterial(
            mesh,
            wallSideOverrideTileIndex,
            clampedDarken,
            overlay.material.opacity,
            "none",
          )
        : null;
    const neededWallSideRotations = new Set<WallSideTileRotation>();
    if (wallSideOverrideMaterial) {
      neededWallSideRotations.add(wallSideOverrideRotation);
      neededWallSideRotations.add("none");
    }
    if (wallSideFrontBackOverrideMaterial) {
      neededWallSideRotations.add("none");
    }
    for (const rotation of ["none", "cw90", "ccw90"] as const) {
      if (!neededWallSideRotations.has(rotation)) {
        this.disposeWallSideTileOverlay(mesh, rotation);
      }
    }

    const fpsWallChamferMask = Number(mesh.userData?.fpsWallChamferMask ?? 0);
    if (isWall && fpsWallChamferMask > 0) {
      if (useTiles) {
        // Chamfered FPS wall geometry uses groups: cap (0), straight walls (1), cut corners (2).
        // In tileset mode, cap uses wall tile while side groups may use the vertical-wall override.
        mesh.material = chamferSideOverrideMaterial
          ? [
              overlay.material,
              chamferSideOverrideMaterial,
              chamferSideOverrideMaterial,
            ]
          : [overlay.material, overlay.material, overlay.material];
      } else if (solidWallMaterial) {
        mesh.material = [
          solidWallMaterial,
          solidWallMaterial,
          solidWallMaterial,
        ];
      } else {
        // In ASCII mode, keep chamfer cuts floor-tinted for diagonal readability.
        const chamferKind =
          typeof mesh.userData?.fpsWallChamferMaterialKind === "string"
            ? (mesh.userData.fpsWallChamferMaterialKind as TileMaterialKind)
            : null;
        const chamferMaterial = chamferKind
          ? this.getMaterialByKind(chamferKind)
          : baseMaterial;
        mesh.material = [overlay.material, baseMaterial, chamferMaterial];
      }
    } else if (isWall) {
      if (isDoorWall && useTiles) {
        mesh.material = wallSideOverrideMaterial
          ? [
              wallSideOverrideMaterial, // right edge
              wallSideOverrideMaterial, // left edge
              wallSideOverrideMaterial, // front
              wallSideOverrideMaterial, // back
              overlay.material, // top edge
              baseMaterial, // bottom edge
            ]
          : [
              overlay.material, // right edge
              overlay.material, // left edge
              overlay.material, // front
              overlay.material, // back
              overlay.material, // top edge
              baseMaterial, // bottom edge
            ];
      } else if (useTiles) {
        const leftRightWallMaterial =
          wallSideOverrideMaterial ?? overlay.material;
        const frontBackWallMaterial =
          wallSideFrontBackOverrideMaterial ??
          (shouldRotateHorizontalWallSideTiles
            ? overlay.material
            : leftRightWallMaterial);
        mesh.material = wallSideOverrideMaterial
          ? [
              leftRightWallMaterial,
              leftRightWallMaterial,
              frontBackWallMaterial,
              frontBackWallMaterial,
              overlay.material,
              baseMaterial,
            ]
          : [
              overlay.material,
              overlay.material,
              overlay.material,
              overlay.material,
              overlay.material,
              baseMaterial,
            ];
      } else if (solidWallMaterial) {
        mesh.material = [
          solidWallMaterial,
          solidWallMaterial,
          solidWallMaterial,
          solidWallMaterial,
          solidWallMaterial,
          solidWallMaterial,
        ];
      } else {
        mesh.material = [
          baseMaterial,
          baseMaterial,
          baseMaterial,
          baseMaterial,
          overlay.material,
          baseMaterial,
        ];
      }
    } else {
      this.disposeWallSideTileOverlay(mesh);
      mesh.material = overlay.material;
    }
  }

  private getMaterialByKind(kind: TileMaterialKind): THREE.MeshLambertMaterial {
    switch (kind) {
      case "floor":
        return this.materials.floor;
      case "stairs_up":
        return this.materials.stairs_up;
      case "stairs_down":
        return this.materials.stairs_down;
      case "wall":
        return this.materials.wall;
      case "dark_wall":
        return this.materials.dark_wall;
      case "door":
        return this.materials.door;
      case "dark":
        return this.materials.dark;
      case "water":
        return this.materials.water;
      case "trap":
        return this.materials.trap;
      case "feature":
        return this.materials.feature;
      case "fountain":
        return this.materials.fountain;
      case "player":
        return this.materials.player;
      case "monster_hostile":
        return this.materials.monster_hostile;
      case "monster_friendly":
        return this.materials.monster_friendly;
      case "monster_neutral":
        return this.materials.monster_neutral;
      case "item":
        return this.materials.item;
      case "effect_warning":
        return this.materials.effect_warning;
      case "effect_zap":
        return this.materials.effect_zap;
      case "effect_explode":
        return this.materials.effect_explode;
      case "effect_swallow":
        return this.materials.effect_swallow;
      default:
        return this.materials.default;
    }
  }

  private isWallTileAt(tileX: number, tileY: number): boolean {
    const neighbor = this.tileMap.get(`${tileX},${tileY}`);
    return Boolean(neighbor?.userData?.isWall);
  }

  private getWallChamferMaskAt(tileX: number, tileY: number): number {
    const mesh = this.tileMap.get(`${tileX},${tileY}`);
    if (!mesh?.userData?.isWall) {
      return 0;
    }
    if (typeof mesh.userData?.fpsWallChamferMask !== "number") {
      return 0;
    }
    return Math.max(
      0,
      Math.min(15, Math.trunc(mesh.userData.fpsWallChamferMask)),
    );
  }

  private computeFloorBlockAmbientOcclusionMasks(
    tileX: number,
    tileY: number,
  ): {
    edgeMask: number;
    cornerMask: number;
    edgeCutMask: number;
    edgeTerminalMask: number;
  } {
    let edgeMask = 0;
    // Bit layout: 1 = north, 2 = east, 4 = south, 8 = west.
    const hasNorth = this.isWallTileAt(tileX, tileY - 1);
    const hasEast = this.isWallTileAt(tileX + 1, tileY);
    const hasSouth = this.isWallTileAt(tileX, tileY + 1);
    const hasWest = this.isWallTileAt(tileX - 1, tileY);
    if (hasNorth) {
      edgeMask |= 1;
    }
    if (hasEast) {
      edgeMask |= 2;
    }
    if (hasSouth) {
      edgeMask |= 4;
    }
    if (hasWest) {
      edgeMask |= 8;
    }
    const hasNorthWest = this.isWallTileAt(tileX - 1, tileY - 1);
    const hasNorthEast = this.isWallTileAt(tileX + 1, tileY - 1);
    const hasSouthEast = this.isWallTileAt(tileX + 1, tileY + 1);
    const hasSouthWest = this.isWallTileAt(tileX - 1, tileY + 1);

    const northChamferMask = hasNorth
      ? this.getWallChamferMaskAt(tileX, tileY - 1)
      : 0;
    const eastChamferMask = hasEast
      ? this.getWallChamferMaskAt(tileX + 1, tileY)
      : 0;
    const southChamferMask = hasSouth
      ? this.getWallChamferMaskAt(tileX, tileY + 1)
      : 0;
    const westChamferMask = hasWest
      ? this.getWallChamferMaskAt(tileX - 1, tileY)
      : 0;

    // Bit layout:
    // 1 = north-left, 2 = north-right,
    // 4 = east-top, 8 = east-bottom,
    // 16 = south-right, 32 = south-left,
    // 64 = west-bottom, 128 = west-top.
    let edgeCutMask = 0;
    if (northChamferMask & 8) {
      edgeCutMask |= 1;
    }
    if (northChamferMask & 4) {
      edgeCutMask |= 2;
    }
    if (eastChamferMask & 1) {
      edgeCutMask |= 4;
    }
    if (eastChamferMask & 8) {
      edgeCutMask |= 8;
    }
    if (southChamferMask & 2) {
      edgeCutMask |= 16;
    }
    if (southChamferMask & 1) {
      edgeCutMask |= 32;
    }
    if (westChamferMask & 4) {
      edgeCutMask |= 64;
    }
    if (westChamferMask & 2) {
      edgeCutMask |= 128;
    }

    let cornerMask = 0;
    // Bit layout: 1 = NW, 2 = NE, 4 = SE, 8 = SW.
    if (
      hasNorth &&
      hasWest &&
      (edgeCutMask & 1) === 0 &&
      (edgeCutMask & 128) === 0
    ) {
      cornerMask |= 1;
    }
    if (
      hasNorth &&
      hasEast &&
      (edgeCutMask & 2) === 0 &&
      (edgeCutMask & 4) === 0
    ) {
      cornerMask |= 2;
    }
    if (
      hasSouth &&
      hasEast &&
      (edgeCutMask & 16) === 0 &&
      (edgeCutMask & 8) === 0
    ) {
      cornerMask |= 4;
    }
    if (
      hasSouth &&
      hasWest &&
      (edgeCutMask & 32) === 0 &&
      (edgeCutMask & 64) === 0
    ) {
      cornerMask |= 8;
    }

    // Bit layout matches edgeCutMask endpoint bits so texture generation can
    // apply smooth falloff to true segment endpoints without breaking runs.
    let edgeTerminalMask = 0;
    if (hasNorth && !hasWest && !hasNorthWest && (edgeCutMask & 1) === 0) {
      edgeTerminalMask |= 1;
    }
    if (hasNorth && !hasEast && !hasNorthEast && (edgeCutMask & 2) === 0) {
      edgeTerminalMask |= 2;
    }
    if (hasEast && !hasNorth && !hasNorthEast && (edgeCutMask & 4) === 0) {
      edgeTerminalMask |= 4;
    }
    if (hasEast && !hasSouth && !hasSouthEast && (edgeCutMask & 8) === 0) {
      edgeTerminalMask |= 8;
    }
    if (hasSouth && !hasEast && !hasSouthEast && (edgeCutMask & 16) === 0) {
      edgeTerminalMask |= 16;
    }
    if (hasSouth && !hasWest && !hasSouthWest && (edgeCutMask & 32) === 0) {
      edgeTerminalMask |= 32;
    }
    if (hasWest && !hasSouth && !hasSouthWest && (edgeCutMask & 64) === 0) {
      edgeTerminalMask |= 64;
    }
    if (hasWest && !hasNorth && !hasNorthWest && (edgeCutMask & 128) === 0) {
      edgeTerminalMask |= 128;
    }

    return { edgeMask, cornerMask, edgeCutMask, edgeTerminalMask };
  }

  private createFloorBlockAmbientOcclusionTexture(
    edgeMask: number,
    cornerMask: number,
    edgeCutMask: number,
    edgeTerminalMask: number,
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, size, size);
      const depth = Math.max(16, Math.floor(size * 0.4));
      // Make ambient occlusion darker in FPS mode
      const maxAlpha = this.isFpsMode() ? 0.55 : 0.24;
      const edgeTrim = Math.max(24, Math.floor(depth * 0.95));
      const taper = Math.max(24, Math.floor(depth * 1.4));
      const terminalTaper = Math.max(10, Math.floor(depth * 0.5));
      const applyHorizontalEndTaper = (
        startX: number,
        y: number,
        width: number,
        height: number,
        fadeStart: boolean,
      ): void => {
        if (width <= 0 || height <= 0) {
          return;
        }
        context.save();
        context.globalCompositeOperation = "destination-out";
        const gradient = context.createLinearGradient(
          startX,
          0,
          startX + width,
          0,
        );
        if (fadeStart) {
          gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        } else {
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
        }
        context.fillStyle = gradient;
        context.fillRect(startX, y, width, height);
        context.restore();
      };
      const applyVerticalEndTaper = (
        x: number,
        startY: number,
        width: number,
        height: number,
        fadeStart: boolean,
      ): void => {
        if (width <= 0 || height <= 0) {
          return;
        }
        context.save();
        context.globalCompositeOperation = "destination-out";
        const gradient = context.createLinearGradient(
          0,
          startY,
          0,
          startY + height,
        );
        if (fadeStart) {
          gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        } else {
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
        }
        context.fillStyle = gradient;
        context.fillRect(x, startY, width, height);
        context.restore();
      };
      if (edgeMask & 1) {
        const leftTrim = edgeCutMask & 1 ? edgeTrim : 0;
        const rightTrim = edgeCutMask & 2 ? edgeTrim : 0;
        const width = size - leftTrim - rightTrim;
        if (width > 0) {
          const northGradient = context.createLinearGradient(0, 0, 0, depth);
          northGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          northGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = northGradient;
          context.fillRect(leftTrim, 0, width, depth);
          if (leftTrim > 0 || (edgeTerminalMask & 1) !== 0) {
            const taperWidth = Math.min(
              leftTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(leftTrim, 0, taperWidth, depth, true);
          }
          if (rightTrim > 0 || (edgeTerminalMask & 2) !== 0) {
            const taperWidth = Math.min(
              rightTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(
              leftTrim + width - taperWidth,
              0,
              taperWidth,
              depth,
              false,
            );
          }
        }
      }
      if (edgeMask & 2) {
        const topTrim = edgeCutMask & 4 ? edgeTrim : 0;
        const bottomTrim = edgeCutMask & 8 ? edgeTrim : 0;
        const height = size - topTrim - bottomTrim;
        if (height > 0) {
          const eastGradient = context.createLinearGradient(
            size,
            0,
            size - depth,
            0,
          );
          eastGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          eastGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = eastGradient;
          context.fillRect(size - depth, topTrim, depth, height);
          if (topTrim > 0 || (edgeTerminalMask & 4) !== 0) {
            const taperHeight = Math.min(
              topTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(
              size - depth,
              topTrim,
              depth,
              taperHeight,
              true,
            );
          }
          if (bottomTrim > 0 || (edgeTerminalMask & 8) !== 0) {
            const taperHeight = Math.min(
              bottomTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(
              size - depth,
              topTrim + height - taperHeight,
              depth,
              taperHeight,
              false,
            );
          }
        }
      }
      if (edgeMask & 4) {
        const rightTrim = edgeCutMask & 16 ? edgeTrim : 0;
        const leftTrim = edgeCutMask & 32 ? edgeTrim : 0;
        const width = size - leftTrim - rightTrim;
        if (width > 0) {
          const southGradient = context.createLinearGradient(
            0,
            size,
            0,
            size - depth,
          );
          southGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          southGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = southGradient;
          context.fillRect(leftTrim, size - depth, width, depth);
          if (leftTrim > 0 || (edgeTerminalMask & 32) !== 0) {
            const taperWidth = Math.min(
              leftTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(
              leftTrim,
              size - depth,
              taperWidth,
              depth,
              true,
            );
          }
          if (rightTrim > 0 || (edgeTerminalMask & 16) !== 0) {
            const taperWidth = Math.min(
              rightTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(
              leftTrim + width - taperWidth,
              size - depth,
              taperWidth,
              depth,
              false,
            );
          }
        }
      }
      if (edgeMask & 8) {
        const bottomTrim = edgeCutMask & 64 ? edgeTrim : 0;
        const topTrim = edgeCutMask & 128 ? edgeTrim : 0;
        const height = size - topTrim - bottomTrim;
        if (height > 0) {
          const westGradient = context.createLinearGradient(0, 0, depth, 0);
          westGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          westGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = westGradient;
          context.fillRect(0, topTrim, depth, height);
          if (topTrim > 0 || (edgeTerminalMask & 128) !== 0) {
            const taperHeight = Math.min(
              topTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(0, topTrim, depth, taperHeight, true);
          }
          if (bottomTrim > 0 || (edgeTerminalMask & 64) !== 0) {
            const taperHeight = Math.min(
              bottomTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(
              0,
              topTrim + height - taperHeight,
              depth,
              taperHeight,
              false,
            );
          }
        }
      }

      const cornerRadius = Math.max(depth, Math.floor(size * 0.46));
      const cornerAlpha = 0.2;
      if (cornerMask & 1) {
        const nwGradient = context.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          cornerRadius,
        );
        nwGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        nwGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = nwGradient;
        context.fillRect(0, 0, cornerRadius, cornerRadius);
      }
      if (cornerMask & 2) {
        const neGradient = context.createRadialGradient(
          size,
          0,
          0,
          size,
          0,
          cornerRadius,
        );
        neGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        neGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = neGradient;
        context.fillRect(size - cornerRadius, 0, cornerRadius, cornerRadius);
      }
      if (cornerMask & 4) {
        const seGradient = context.createRadialGradient(
          size,
          size,
          0,
          size,
          size,
          cornerRadius,
        );
        seGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        seGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = seGradient;
        context.fillRect(
          size - cornerRadius,
          size - cornerRadius,
          cornerRadius,
          cornerRadius,
        );
      }
      if (cornerMask & 8) {
        const swGradient = context.createRadialGradient(
          0,
          size,
          0,
          0,
          size,
          cornerRadius,
        );
        swGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        swGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = swGradient;
        context.fillRect(0, size - cornerRadius, cornerRadius, cornerRadius);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  private getFloorBlockAmbientOcclusionTexture(
    edgeMask: number,
    cornerMask: number,
    edgeCutMask: number,
    edgeTerminalMask: number,
  ): THREE.CanvasTexture {
    const clampedEdgeMask = Math.max(0, Math.min(15, Math.trunc(edgeMask)));
    const clampedCornerMask = Math.max(0, Math.min(15, Math.trunc(cornerMask)));
    const clampedEdgeCutMask = Math.max(
      0,
      Math.min(255, Math.trunc(edgeCutMask)),
    );
    const clampedEdgeTerminalMask = Math.max(
      0,
      Math.min(255, Math.trunc(edgeTerminalMask)),
    );
    const cacheKey =
      clampedEdgeMask |
      (clampedCornerMask << 4) |
      (clampedEdgeCutMask << 8) |
      (clampedEdgeTerminalMask << 16);
    const cached = this.floorBlockAmbientOcclusionTextureCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const created = this.createFloorBlockAmbientOcclusionTexture(
      clampedEdgeMask,
      clampedCornerMask,
      clampedEdgeCutMask,
      clampedEdgeTerminalMask,
    );
    this.floorBlockAmbientOcclusionTextureCache.set(cacheKey, created);
    return created;
  }

  private removeFloorBlockAmbientOcclusionOverlay(key: string): void {
    const overlay = this.floorBlockAmbientOcclusionOverlays.get(key);
    if (!overlay) {
      return;
    }
    this.removeWorldObject(overlay);
    if (overlay.material instanceof THREE.MeshBasicMaterial) {
      overlay.material.dispose();
    }
    this.floorBlockAmbientOcclusionOverlays.delete(key);
  }

  private refreshFloorBlockAmbientOcclusionAt(
    tileX: number,
    tileY: number,
  ): void {
    const key = `${tileX},${tileY}`;
    const mesh = this.tileMap.get(key);
    if (!mesh || this.clientOptions.blockAmbientOcclusion !== true) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
      return;
    }
    if (mesh.userData?.isWall) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
      return;
    }
    const materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? (mesh.userData.materialKind as TileMaterialKind)
        : null;

    const { edgeMask, cornerMask, edgeCutMask, edgeTerminalMask } =
      this.computeFloorBlockAmbientOcclusionMasks(tileX, tileY);
    if (edgeMask === 0 && cornerMask === 0) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
      return;
    }

    const texture = this.getFloorBlockAmbientOcclusionTexture(
      edgeMask,
      cornerMask,
      edgeCutMask,
      edgeTerminalMask,
    );
    let overlay = this.floorBlockAmbientOcclusionOverlays.get(key);
    if (!overlay) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      this.patchMaterialForVignette(material);
      overlay = new THREE.Mesh(this.floorGeometry, material);
      overlay.castShadow = false;
      overlay.receiveShadow = false;
      overlay.renderOrder = 112;
      this.addWorldObject(overlay);
      this.floorBlockAmbientOcclusionOverlays.set(key, overlay);
    } else if (
      overlay.material instanceof THREE.MeshBasicMaterial &&
      overlay.material.map !== texture
    ) {
      overlay.material.map = texture;
      overlay.material.needsUpdate = true;
    }

    overlay.position.set(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z + this.floorBlockAmbientOcclusionOverlayZ,
    );
    overlay.scale.copy(mesh.scale);
  }

  private refreshFloorBlockAmbientOcclusionNear(
    tileX: number,
    tileY: number,
  ): void {
    this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY);
    this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY - 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX + 1, tileY);
    this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY + 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX - 1, tileY);
    this.refreshFloorBlockAmbientOcclusionAt(tileX - 1, tileY - 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX + 1, tileY - 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX + 1, tileY + 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX - 1, tileY + 1);
  }

  private removeFpsWallChamferFloorAmbientOcclusionOverlay(key: string): void {
    const overlay = this.fpsWallChamferFloorAmbientOcclusionOverlays.get(key);
    if (!overlay) {
      return;
    }
    this.removeWorldObject(overlay);
    if (overlay.material instanceof THREE.MeshBasicMaterial) {
      overlay.material.dispose();
    }
    this.fpsWallChamferFloorAmbientOcclusionOverlays.delete(key);
  }

  private refreshFpsWallChamferFloorAmbientOcclusionAt(
    tileX: number,
    tileY: number,
  ): void {
    const key = `${tileX},${tileY}`;
    const chamferFloor = this.fpsWallChamferFloorMeshes.get(key);
    if (
      !chamferFloor ||
      this.clientOptions.blockAmbientOcclusion !== true ||
      !this.isFpsMode()
    ) {
      this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      return;
    }

    const { edgeMask, cornerMask, edgeCutMask, edgeTerminalMask } =
      this.computeFloorBlockAmbientOcclusionMasks(tileX, tileY);
    if (edgeMask === 0 && cornerMask === 0) {
      this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      return;
    }

    const texture = this.getFloorBlockAmbientOcclusionTexture(
      edgeMask,
      cornerMask,
      edgeCutMask,
      edgeTerminalMask,
    );
    let overlay = this.fpsWallChamferFloorAmbientOcclusionOverlays.get(key);
    if (!overlay) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      this.patchMaterialForVignette(material);
      overlay = new THREE.Mesh(chamferFloor.geometry, material);
      overlay.castShadow = false;
      overlay.receiveShadow = false;
      overlay.renderOrder = chamferFloor.renderOrder + 1;
      this.addWorldObject(overlay);
      this.fpsWallChamferFloorAmbientOcclusionOverlays.set(key, overlay);
    } else {
      if (overlay.geometry !== chamferFloor.geometry) {
        overlay.geometry = chamferFloor.geometry;
      }
      if (
        overlay.material instanceof THREE.MeshBasicMaterial &&
        overlay.material.map !== texture
      ) {
        overlay.material.map = texture;
        overlay.material.needsUpdate = true;
      }
    }

    overlay.position.set(
      chamferFloor.position.x,
      chamferFloor.position.y,
      chamferFloor.position.z +
        this.fpsWallChamferFloorAmbientOcclusionOverlayZ,
    );
    overlay.scale.copy(chamferFloor.scale);
  }

  private refreshFpsWallChamferFloorAmbientOcclusionNear(
    tileX: number,
    tileY: number,
  ): void {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        this.refreshFpsWallChamferFloorAmbientOcclusionAt(
          tileX + dx,
          tileY + dy,
        );
      }
    }
  }

  private refreshAllFloorBlockAmbientOcclusion(): void {
    if (this.clientOptions.blockAmbientOcclusion !== true) {
      for (const key of Array.from(
        this.floorBlockAmbientOcclusionOverlays.keys(),
      )) {
        this.removeFloorBlockAmbientOcclusionOverlay(key);
      }
      for (const key of Array.from(
        this.fpsWallChamferFloorAmbientOcclusionOverlays.keys(),
      )) {
        this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      }
      return;
    }
    for (const mesh of this.tileMap.values()) {
      const tileX =
        typeof mesh.userData?.tileX === "number"
          ? Math.trunc(mesh.userData.tileX)
          : null;
      const tileY =
        typeof mesh.userData?.tileY === "number"
          ? Math.trunc(mesh.userData.tileY)
          : null;
      if (tileX === null || tileY === null) {
        continue;
      }
      this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY);
    }
    for (const key of this.fpsWallChamferFloorMeshes.keys()) {
      const [rawX, rawY] = key.split(",");
      const tileX = Number.parseInt(rawX, 10);
      const tileY = Number.parseInt(rawY, 10);
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        continue;
      }
      this.refreshFpsWallChamferFloorAmbientOcclusionAt(tileX, tileY);
    }
  }

  private clearFloorBlockAmbientOcclusion(): void {
    for (const key of Array.from(
      this.floorBlockAmbientOcclusionOverlays.keys(),
    )) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
    }
    for (const key of Array.from(
      this.fpsWallChamferFloorAmbientOcclusionOverlays.keys(),
    )) {
      this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
    }
    for (const texture of this.floorBlockAmbientOcclusionTextureCache.values()) {
      texture.dispose();
    }
    this.floorBlockAmbientOcclusionTextureCache.clear();
  }

  private createInferredDarkWallSolidColorGridTexture(
    colorHex: string,
    darknessPercent: number,
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) {
      const fallback = document.createElement("canvas");
      fallback.width = 1;
      fallback.height = 1;
      const texture = new THREE.CanvasTexture(fallback);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      return texture;
    }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = colorHex;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const solid = new THREE.Color(colorHex);
    const safeDarknessPercent =
      typeof darknessPercent === "number" && Number.isFinite(darknessPercent)
        ? darknessPercent
        : 15;
    const darknessScale =
      1 - Math.max(0, Math.min(100, safeDarknessPercent)) / 100;
    const grid = solid.clone().multiplyScalar(darknessScale);
    context.fillStyle = `#${grid.getHexString()}`;
    const lineWidth = 2;
    // One cell per block face: draw only an outer border.
    context.fillRect(0, 0, canvas.width, lineWidth); // top
    context.fillRect(0, canvas.height - lineWidth, canvas.width, lineWidth); // bottom
    context.fillRect(0, 0, lineWidth, canvas.height); // left
    context.fillRect(canvas.width - lineWidth, 0, lineWidth, canvas.height); // right
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  private getInferredDarkWallSolidColorMaterial(
    colorHex: string,
    gridEnabled: boolean,
    gridDarknessPercent: number,
  ): THREE.MeshLambertMaterial {
    const normalizedColor = String(colorHex || "")
      .trim()
      .toLowerCase();
    const normalizedDarkness = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          typeof gridDarknessPercent === "number" &&
            Number.isFinite(gridDarknessPercent)
            ? gridDarknessPercent
            : 15,
        ),
      ),
    );
    const cacheKey = `${normalizedColor}|grid:${gridEnabled ? 1 : 0}|dark:${normalizedDarkness}`;
    const cached = this.inferredDarkWallSolidColorMaterialCache.get(cacheKey);
    if (cached) {
      return cached.material;
    }
    const material = this.materials.dark_wall.clone();
    let texture: THREE.CanvasTexture | null = null;
    if (gridEnabled) {
      texture = this.createInferredDarkWallSolidColorGridTexture(
        normalizedColor,
        normalizedDarkness,
      );
      material.map = texture;
      material.color.set("#ffffff");
    } else {
      material.map = null;
      material.color.set(normalizedColor);
    }
    material.needsUpdate = true;
    this.patchMaterialForVignette(material);
    this.inferredDarkWallSolidColorMaterialCache.set(cacheKey, {
      material,
      texture,
    });
    return material;
  }

  private isPassableTileForFpsDiagonal(tileX: number, tileY: number): boolean {
    const mesh = this.tileMap.get(`${tileX},${tileY}`);
    if (!mesh) {
      return false;
    }
    return !Boolean(mesh.userData?.isWall);
  }

  private shouldChamferFpsWallCorner(
    tileX: number,
    tileY: number,
    cornerDx: -1 | 1,
    cornerDy: -1 | 1,
  ): boolean {
    // Chamfer a wall corner if the two adjacent tiles in the corner direction are passable.
    // This handles both concave (inner) and convex (outer) corners,
    // including the case of two walls meeting diagonally, which should reveal a gap.
    return (
      this.isPassableTileForFpsDiagonal(tileX + cornerDx, tileY) &&
      this.isPassableTileForFpsDiagonal(tileX, tileY + cornerDy)
    );
  }

  private computeFpsWallChamferMask(tileX: number, tileY: number): number {
    let mask = 0;
    // Bit layout: 1 = NW, 2 = NE, 4 = SE, 8 = SW.
    if (this.shouldChamferFpsWallCorner(tileX, tileY, -1, -1)) {
      mask |= 1;
    }
    if (this.shouldChamferFpsWallCorner(tileX, tileY, 1, -1)) {
      mask |= 2;
    }
    if (this.shouldChamferFpsWallCorner(tileX, tileY, 1, 1)) {
      mask |= 4;
    }
    if (this.shouldChamferFpsWallCorner(tileX, tileY, -1, 1)) {
      mask |= 8;
    }
    return mask;
  }

  private getFpsChamferMaterialKindForWall(
    wallMaterialKind: TileMaterialKind,
  ): TileMaterialKind {
    return wallMaterialKind === "dark_wall" ? "dark" : "floor";
  }

  private getFpsWallChamferFloorMaterial(
    materialKind: TileMaterialKind,
  ): THREE.MeshBasicMaterial {
    const tileIndex = this.getFpsWallChamferFloorTileIndex(materialKind);
    const useTiles =
      this.clientOptions.tilesetMode === "tiles" && tileIndex >= 0;
    const cacheKey = useTiles ? `tile:${tileIndex}` : `ascii:${materialKind}`;
    const cached = this.fpsWallChamferFloorMaterialCache.get(cacheKey);
    if (cached) {
      return cached.material;
    }

    const texture = useTiles
      ? this.createTileTexture(
          tileIndex,
          1, // No artificial darkening for chamfer floors
          false,
        )
      : this.createGlyphTexture(
          this.getMaterialByKind(materialKind).color.getHexString(),
          " ",
          "#F4F4F4",
          1,
          256,
          true,
        );
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: false,
    });
    this.fpsWallChamferFloorMaterialCache.set(cacheKey, {
      material,
      texture,
    });

    // Patch the dynamically created floor material
    this.patchMaterialForVignette(material);

    return material;
  }

  private getFpsWallChamferFloorTileIndex(
    materialKind: TileMaterialKind,
  ): number {
    const floorGlyph = getDefaultFloorGlyph();
    let fallbackGlyph = floorGlyph;
    if (materialKind === "dark") {
      const runtimeVersion =
        this.characterCreationConfig.runtimeVersion ?? "3.6.7";
      // NetHack 3.6.7 dark corridor walls should chamfer using the dark hallway
      // floor texture, not the generic dark room texture.
      fallbackGlyph =
        runtimeVersion === "3.6.7"
          ? getDefaultDarkFloorGlyph()
          : floorGlyph + 1;
    }
    const behavior = classifyTileBehavior({
      glyph: fallbackGlyph,
      runtimeChar: ".",
      runtimeColor: null,
      priorTerrain: null,
    });
    return behavior.effective.tileIndex;
  }

  private clearFpsWallChamferMaterialCaches(): void {
    this.fpsWallChamferFaceMaterialCache.forEach((material) =>
      material.dispose(),
    );
    this.fpsWallChamferFaceMaterialCache.clear();
    this.fpsWallChamferFloorMaterialCache.forEach(({ material, texture }) => {
      material.dispose();
      texture.dispose();
    });
    this.fpsWallChamferFloorMaterialCache.clear();
  }

  private splitFpsChamferGeometryGroups(
    geometry: THREE.ExtrudeGeometry,
  ): THREE.ExtrudeGeometry {
    const index = geometry.getIndex();
    const position = geometry.getAttribute("position");
    if (!index || !(position instanceof THREE.BufferAttribute)) {
      return geometry;
    }

    const capIndices: number[] = [];
    const wallIndices: number[] = [];
    const chamferIndices: number[] = [];

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const normal = new THREE.Vector3();

    for (let i = 0; i < index.count; i += 3) {
      const ia = index.getX(i);
      const ib = index.getX(i + 1);
      const ic = index.getX(i + 2);
      a.fromBufferAttribute(position, ia);
      b.fromBufferAttribute(position, ib);
      c.fromBufferAttribute(position, ic);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      normal.crossVectors(ab, ac).normalize();

      const absX = Math.abs(normal.x);
      const absY = Math.abs(normal.y);
      const absZ = Math.abs(normal.z);
      const target =
        absZ >= 0.9
          ? capIndices
          : absX > 0.2 && absY > 0.2
            ? chamferIndices
            : wallIndices;
      target.push(ia, ib, ic);
    }

    const ordered = [...capIndices, ...wallIndices, ...chamferIndices];
    geometry.setIndex(ordered);
    geometry.clearGroups();
    let start = 0;
    if (capIndices.length > 0) {
      geometry.addGroup(start, capIndices.length, 0);
      start += capIndices.length;
    }
    if (wallIndices.length > 0) {
      geometry.addGroup(start, wallIndices.length, 1);
      start += wallIndices.length;
    }
    if (chamferIndices.length > 0) {
      geometry.addGroup(start, chamferIndices.length, 2);
    }

    return geometry;
  }

  private createUprightWallBlockGeometry(): THREE.BoxGeometry {
    const geometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, WALL_HEIGHT);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    if (
      !(position instanceof THREE.BufferAttribute) ||
      !(normal instanceof THREE.BufferAttribute) ||
      !(uv instanceof THREE.BufferAttribute)
    ) {
      return geometry;
    }

    const half = TILE_SIZE / 2;
    const halfWall = WALL_HEIGHT / 2;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const nx = normal.getX(i);
      const ny = normal.getY(i);
      const nz = normal.getZ(i);

      let u = 0.5;
      let v = 0.5;
      if (Math.abs(nz) >= 0.9) {
        u = (x + half) / TILE_SIZE;
        v = (y + half) / TILE_SIZE;
      } else {
        const vertical = (z + halfWall) / WALL_HEIGHT;
        const isLeftRightFace = Math.abs(nx) >= Math.abs(ny);
        const horizontal = isLeftRightFace
          ? nx >= 0
            ? 1 - (y + half) / TILE_SIZE
            : (y + half) / TILE_SIZE
          : ny >= 0
            ? (x + half) / TILE_SIZE
            : 1 - (x + half) / TILE_SIZE;
        u = horizontal;
        v = vertical;
        if (isLeftRightFace) {
          // Rotate X-facing sides 90deg CCW in UV space.
          const rotatedU = v;
          const rotatedV = 1 - u;
          u = rotatedU;
          v = rotatedV;
        }
      }

      uv.setXY(
        i,
        THREE.MathUtils.clamp(u, 0, 1),
        THREE.MathUtils.clamp(v, 0, 1),
      );
    }
    uv.needsUpdate = true;
    return geometry;
  }

  private remapFpsChamferWallUVs(
    geometry: THREE.BufferGeometry,
    sideUvRotation: FpsChamferWallUvRotation,
  ): THREE.BufferGeometry {
    const workingGeometry = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = workingGeometry.getAttribute("position");
    if (!(position instanceof THREE.BufferAttribute)) {
      return workingGeometry;
    }

    const uv = new Float32Array(position.count * 2);
    const half = TILE_SIZE / 2;
    const halfWall = WALL_HEIGHT / 2;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const normalXY = new THREE.Vector2();

    const writeUv = (index: number, u: number, v: number): void => {
      uv[index * 2] = THREE.MathUtils.clamp(u, 0, 1);
      uv[index * 2 + 1] = THREE.MathUtils.clamp(v, 0, 1);
    };

    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      normal.crossVectors(ab, ac).normalize();

      if (Math.abs(normal.z) >= 0.9) {
        const vertices = [a, b, c];
        for (let j = 0; j < 3; j += 1) {
          const p = vertices[j];
          const u = (p.x + half) / TILE_SIZE;
          const v = (p.y + half) / TILE_SIZE;
          writeUv(i + j, u, v);
        }
        continue;
      }

      normalXY.set(normal.x, normal.y);
      if (normalXY.lengthSq() <= 0.000001) {
        normalXY.set(1, 0);
      } else {
        normalXY.normalize();
      }

      const tangentX = -normalXY.y;
      const tangentY = normalXY.x;
      const projectedA = a.x * tangentX + a.y * tangentY;
      const projectedB = b.x * tangentX + b.y * tangentY;
      const projectedC = c.x * tangentX + c.y * tangentY;
      const projectedMin = Math.min(projectedA, projectedB, projectedC);
      const projectedMax = Math.max(projectedA, projectedB, projectedC);
      const projectedRange = projectedMax - projectedMin;

      const vertices = [a, b, c];
      const projected = [projectedA, projectedB, projectedC];
      for (let j = 0; j < 3; j += 1) {
        const p = vertices[j];
        const horizontal =
          projectedRange > 0.000001
            ? (projected[j] - projectedMin) / projectedRange
            : 0.5;
        // Keep side faces upright so the tile's top edge meets the block top.
        const vertical = (p.z + halfWall) / WALL_HEIGHT;
        let u = horizontal;
        let v = vertical;
        // Chamfered wall side UVs are custom-projected; use one shared rotation
        // mode for all side faces rather than splitting by face direction.
        const rotateQuarterTurns = sideUvRotation === "none" ? 0 : 1;
        if (rotateQuarterTurns === 1) {
          // Rotate selected chamfer side faces 90deg counterclockwise.
          const rotatedU = v;
          const rotatedV = 1 - u;
          u = rotatedU;
          v = rotatedV;
        }
        writeUv(i + j, u, v);
      }
    }

    workingGeometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return workingGeometry;
  }

  private remapFpsChamferFloorUVs(geometry: THREE.ShapeGeometry): void {
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    if (
      !(position instanceof THREE.BufferAttribute) ||
      !(uv instanceof THREE.BufferAttribute)
    ) {
      return;
    }

    const half = TILE_SIZE / 2;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const u = THREE.MathUtils.clamp((x + half) / TILE_SIZE, 0, 1);
      const v = THREE.MathUtils.clamp((y + half) / TILE_SIZE, 0, 1);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }

  private createFpsChamferedWallGeometry(
    mask: number,
    sideUvRotation: FpsChamferWallUvRotation,
  ): THREE.BufferGeometry {
    const half = TILE_SIZE / 2;
    const inset = Math.min(this.fpsWallChamferInset, half - 0.01);
    const cutNorthWest = (mask & 1) !== 0;
    const cutNorthEast = (mask & 2) !== 0;
    const cutSouthEast = (mask & 4) !== 0;
    const cutSouthWest = (mask & 8) !== 0;
    const points: THREE.Vector2[] = [];

    if (cutSouthWest) {
      points.push(new THREE.Vector2(-half, -half + inset));
      points.push(new THREE.Vector2(-half + inset, -half));
    } else {
      points.push(new THREE.Vector2(-half, -half));
    }

    if (cutSouthEast) {
      points.push(new THREE.Vector2(half - inset, -half));
      points.push(new THREE.Vector2(half, -half + inset));
    } else {
      points.push(new THREE.Vector2(half, -half));
    }

    if (cutNorthEast) {
      points.push(new THREE.Vector2(half, half - inset));
      points.push(new THREE.Vector2(half - inset, half));
    } else {
      points.push(new THREE.Vector2(half, half));
    }

    if (cutNorthWest) {
      points.push(new THREE.Vector2(-half + inset, half));
      points.push(new THREE.Vector2(-half, half - inset));
    } else {
      points.push(new THREE.Vector2(-half, half));
    }

    const shape = new THREE.Shape(points);
    const extrudedGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: WALL_HEIGHT,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 1,
    });
    this.splitFpsChamferGeometryGroups(extrudedGeometry);
    // Align with box geometry, which is centered around z=0.
    extrudedGeometry.translate(0, 0, -WALL_HEIGHT / 2);
    const geometry = this.remapFpsChamferWallUVs(
      extrudedGeometry,
      sideUvRotation,
    );
    if (geometry !== extrudedGeometry) {
      extrudedGeometry.dispose();
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private getFpsWallGeometry(
    mask: number,
    sideUvRotation: FpsChamferWallUvRotation = "none",
  ): THREE.BufferGeometry {
    if (mask === 0) {
      return this.wallGeometry;
    }
    const cacheKey = `${mask}:${sideUvRotation}`;
    const cached = this.fpsWallChamferGeometryCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const geometry = this.createFpsChamferedWallGeometry(mask, sideUvRotation);
    this.fpsWallChamferGeometryCache.set(cacheKey, geometry);
    return geometry;
  }

  private getFpsWallChamferFloorGeometry(
    mask: number,
  ): THREE.ShapeGeometry | null {
    if (mask === 0) {
      return null;
    }
    const cached = this.fpsWallChamferFloorGeometryCache.get(mask);
    if (cached) {
      return cached;
    }

    const half = TILE_SIZE / 2;
    const inset = Math.min(this.fpsWallChamferInset, half - 0.01);
    const shapes: THREE.Shape[] = [];
    const addTriangle = (
      p1: THREE.Vector2,
      p2: THREE.Vector2,
      p3: THREE.Vector2,
    ): void => {
      const shape = new THREE.Shape([p1, p2, p3]);
      shape.autoClose = true;
      shapes.push(shape);
    };

    // Bit layout: 1 = NW, 2 = NE, 4 = SE, 8 = SW.
    if (mask & 1) {
      addTriangle(
        new THREE.Vector2(-half, half),
        new THREE.Vector2(-half + inset, half),
        new THREE.Vector2(-half, half - inset),
      );
    }
    if (mask & 2) {
      addTriangle(
        new THREE.Vector2(half, half),
        new THREE.Vector2(half - inset, half),
        new THREE.Vector2(half, half - inset),
      );
    }
    if (mask & 4) {
      addTriangle(
        new THREE.Vector2(half, -half),
        new THREE.Vector2(half - inset, -half),
        new THREE.Vector2(half, -half + inset),
      );
    }
    if (mask & 8) {
      addTriangle(
        new THREE.Vector2(-half, -half),
        new THREE.Vector2(-half + inset, -half),
        new THREE.Vector2(-half, -half + inset),
      );
    }

    const geometry = new THREE.ShapeGeometry(shapes);
    this.remapFpsChamferFloorUVs(geometry);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.fpsWallChamferFloorGeometryCache.set(mask, geometry);
    return geometry;
  }

  private removeFpsWallChamferFloorMesh(key: string): void {
    const mesh = this.fpsWallChamferFloorMeshes.get(key);
    if (!mesh) {
      this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      return;
    }
    this.removeWorldObject(mesh);
    this.fpsWallChamferFloorMeshes.delete(key);
    this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
  }

  private upsertFpsWallChamferFloorMesh(
    tileX: number,
    tileY: number,
    mask: number,
    materialKind: TileMaterialKind | null,
  ): void {
    const key = `${tileX},${tileY}`;
    if (mask === 0 || !materialKind) {
      this.removeFpsWallChamferFloorMesh(key);
      return;
    }

    const geometry = this.getFpsWallChamferFloorGeometry(mask);
    if (!geometry) {
      this.removeFpsWallChamferFloorMesh(key);
      return;
    }

    let mesh = this.fpsWallChamferFloorMeshes.get(key);
    const material = this.getFpsWallChamferFloorMaterial(materialKind);
    if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        tileX * TILE_SIZE,
        -tileY * TILE_SIZE,
        this.fpsWallChamferFloorZ,
      );
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.renderOrder = 108;
      mesh.userData.tileX = tileX;
      mesh.userData.tileY = tileY;
      mesh.userData.fpsWallChamferMask = mask;
      this.addWorldObject(mesh);
      this.fpsWallChamferFloorMeshes.set(key, mesh);
      this.refreshFpsWallChamferFloorAmbientOcclusionAt(tileX, tileY);
      return;
    }

    if (mesh.geometry !== geometry) {
      mesh.geometry = geometry;
    }
    if (mesh.material !== material) {
      mesh.material = material;
    }
    mesh.position.set(
      tileX * TILE_SIZE,
      -tileY * TILE_SIZE,
      this.fpsWallChamferFloorZ,
    );
    mesh.userData.tileX = tileX;
    mesh.userData.tileY = tileY;
    mesh.userData.fpsWallChamferMask = mask;
    this.refreshFpsWallChamferFloorAmbientOcclusionAt(tileX, tileY);
  }

  private refreshFpsWallChamferGeometryAt(tileX: number, tileY: number): void {
    if (!this.isFpsMode()) {
      return;
    }
    const key = `${tileX},${tileY}`;
    const mesh = this.tileMap.get(key);
    if (!mesh || !mesh.userData?.isWall) {
      this.removeFpsWallChamferFloorMesh(key);
      this.refreshFpsWallChamferFloorAmbientOcclusionNear(tileX, tileY);
      return;
    }
    const materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? (mesh.userData.materialKind as TileMaterialKind)
        : null;
    if (!materialKind || materialKind === "door") {
      this.removeFpsWallChamferFloorMesh(key);
      this.refreshFpsWallChamferFloorAmbientOcclusionNear(tileX, tileY);
      return;
    }

    const nextMask = this.computeFpsWallChamferMask(tileX, tileY);
    const nextChamferKind =
      nextMask > 0 ? this.getFpsChamferMaterialKindForWall(materialKind) : null;
    const previousMask = Number(mesh.userData?.fpsWallChamferMask ?? 0);
    const previousChamferKind =
      typeof mesh.userData?.fpsWallChamferMaterialKind === "string"
        ? (mesh.userData.fpsWallChamferMaterialKind as TileMaterialKind)
        : null;
    const glyphChar =
      typeof mesh.userData?.glyphChar === "string"
        ? mesh.userData.glyphChar
        : " ";
    const sourceGlyph =
      typeof mesh.userData?.sourceGlyph === "number"
        ? Math.trunc(mesh.userData.sourceGlyph)
        : null;
    const chamferSideUvRotation =
      nextMask > 0
        ? this.resolveFpsChamferWallUvRotation(glyphChar, sourceGlyph)
        : "none";
    const previousChamferSideUvRotation =
      typeof mesh.userData?.fpsWallChamferRotateUv === "string"
        ? (mesh.userData.fpsWallChamferRotateUv as FpsChamferWallUvRotation)
        : "none";
    const nextGeometry = this.getFpsWallGeometry(
      nextMask,
      chamferSideUvRotation,
    );
    const geometryChanged = mesh.geometry !== nextGeometry;
    if (geometryChanged) {
      mesh.geometry = nextGeometry;
    }
    mesh.userData.fpsWallChamferMask = nextMask;
    mesh.userData.fpsWallChamferMaterialKind = nextChamferKind;
    mesh.userData.fpsWallChamferRotateUv = chamferSideUvRotation;
    this.upsertFpsWallChamferFloorMesh(tileX, tileY, nextMask, nextChamferKind);
    this.refreshFpsWallChamferFloorAmbientOcclusionNear(tileX, tileY);
    const chamferKindChanged = previousChamferKind !== nextChamferKind;
    const chamferRotateChanged =
      previousChamferSideUvRotation !== chamferSideUvRotation;
    if (
      !geometryChanged &&
      previousMask === nextMask &&
      !chamferKindChanged &&
      !chamferRotateChanged
    ) {
      return;
    }

    const baseMaterial = this.getMaterialByKind(materialKind);
    const textColor =
      typeof mesh.userData?.glyphTextColor === "string"
        ? mesh.userData.glyphTextColor
        : "#F4F4F4";
    const darkenFactor =
      typeof mesh.userData?.glyphDarkenFactor === "number"
        ? mesh.userData.glyphDarkenFactor
        : 1;
    const tileIndex =
      typeof mesh.userData?.tileIndex === "number"
        ? mesh.userData.tileIndex
        : -1;
    const inferredDarkWallSolidColorHex =
      this.resolveInferredDarkCorridorWallSolidColorHex(
        mesh.userData?.isInferredDarkCorridorWall === true,
      );
    const inferredDarkWallSolidColorGridEnabled =
      this.resolveInferredDarkCorridorWallSolidColorGridEnabled(
        mesh.userData?.isInferredDarkCorridorWall === true,
      );
    const inferredDarkWallSolidColorGridDarknessPercent =
      this.resolveInferredDarkCorridorWallSolidColorGridDarknessPercent(
        mesh.userData?.isInferredDarkCorridorWall === true,
      );
    this.applyGlyphMaterial(
      key,
      mesh,
      baseMaterial,
      glyphChar,
      textColor,
      true,
      darkenFactor,
      true,
      tileIndex,
      inferredDarkWallSolidColorHex,
      inferredDarkWallSolidColorGridEnabled,
      inferredDarkWallSolidColorGridDarknessPercent,
    );
  }

  private refreshFpsWallChamferGeometryNear(
    tileX: number,
    tileY: number,
  ): void {
    if (!this.isFpsMode()) {
      return;
    }
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        this.refreshFpsWallChamferGeometryAt(tileX + dx, tileY + dy);
      }
    }
  }

  private clearScene(): void {
    this.clearDamageEffects();
    // Keep last-known status baselines across scene clears so status deltas
    // (damage numbers, AC/stat change text) are not dropped after map redraws.
    this.pendingPlayerTileRefreshOnNextPosition = true;
    this.lightingCenterInitialized = false;
    this.positionInputModeActive = false;
    this.hasRuntimePositionCursor = false;
    this.clearPositionCursor();
    console.log("🧹 Clearing all tiles and glyph overlays from 3D scene");

    // Clear all tile meshes
    this.tileMap.forEach((mesh) => {
      this.disposeWallSideTileOverlay(mesh);
      this.removeWorldObject(mesh);
    });
    this.tileMap.clear();
    this.clearFloorBlockAmbientOcclusion();
    this.fpsWallChamferFloorMeshes.forEach((mesh) => {
      this.removeWorldObject(mesh);
    });
    this.fpsWallChamferFloorMeshes.clear();
    this.clearFpsWallChamferMaterialCaches();

    for (const key of Array.from(this.monsterBillboards.keys())) {
      this.removeMonsterBillboard(key);
    }
    for (const entry of this.monsterBillboardTextures.values()) {
      entry.texture.dispose();
    }
    this.monsterBillboardTextures.clear();
    if (this.entityBlobShadowTexture) {
      this.entityBlobShadowTexture.dispose();
      this.entityBlobShadowTexture = null;
    }
    this.entityBlobShadows.clear();

    if (this.fpsForwardHighlight) {
      this.removeWorldObject(this.fpsForwardHighlight);
      this.fpsForwardHighlight.geometry.dispose();
      this.fpsForwardHighlightMaterial?.dispose();
      this.fpsForwardHighlight = null;
      this.fpsForwardHighlightMaterial = null;
    }
    if (this.fpsForwardHighlightTexture) {
      this.fpsForwardHighlightTexture.dispose();
      this.fpsForwardHighlightTexture = null;
    }
    this.fpsAimLinePulseUntilMs = 0;
    this.fpsFireSuppressionUntilMs = 0;
    this.fpsStepCameraActive = false;
    this.fpsStepCameraDurationMs = this.fpsStepCameraBaseDurationMs;
    this.lastManualDirectionalInputAtMs = 0;
    this.fpsAutoMoveDirection = null;
    this.fpsAutoTurnTargetYaw = null;
    this.fpsPreviousPlayerTileForSuppression = null;
    this.fpsPointerLockRestorePending = false;
    this.fpsCrosshairContextMenuOpen = false;
    this.fpsCrosshairContextSignature = "";
    this.normalTileContextMenuOpen = false;
    this.normalTileContextSignature = "";
    this.normalTileContextTarget = null;
    this.vrTileContextMode = false;
    this.vrHoveredTile = null;
    this.selectedContextHighlightTile = null;
    this.fpsCrosshairGlanceCache.clear();
    this.fpsCrosshairGlanceAttemptedKeys.clear();
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.clearAutomaticGlancePendingState();
    this.uiAdapter.setFpsCrosshairContext(null);
    this.clearMapTouchContextHoldTimer();
    this.mapTouchContextHoldState = null;

    // Clear glyph overlays and dispose textures/materials
    this.glyphOverlayMap.forEach((overlay) => {
      this.disposeGlyphOverlay(overlay);
    });
    this.glyphOverlayMap.clear();
    this.inferredDarkWallSolidColorMaterialCache.forEach((entry) => {
      entry.material.dispose();
      entry.texture?.dispose();
    });
    this.inferredDarkWallSolidColorMaterialCache.clear();
    this.glyphTextureCache.forEach(({ texture }) => texture.dispose());
    this.glyphTextureCache.clear();
    this.disposeLightingOverlay();
    this.tileStateCache.clear();
    this.lastKnownTerrain.clear();
    this.fpsFlatFeatureUnderPlayerCache.clear();
    this.inferredDarkCorridorWallTiles.clear();
    this.pendingBoulderPushDarkCorridorInference = null;
    this.darkCorridorInputDiscoveryWindowActive = false;
    this.newlyDiscoveredDarkCorridorTilesForCurrentInput.clear();
    this.activeEffectTileKeys.clear();
    this.pendingTileUpdates.clear();
    this.tileFlushScheduled = false;
    this.resetMinimap();
    this.markLightingDirty();

    console.log("🧹 Scene cleared - ready for new level");
  }

  private ensurePositionCursorOutline(): THREE.Line {
    if (this.positionCursorOutline) {
      return this.positionCursorOutline;
    }

    const half = TILE_SIZE / 2 - this.positionCursorOutlineInset;
    const z = 0;
    const points = [
      new THREE.Vector3(-half, half, z),
      new THREE.Vector3(half, half, z),
      new THREE.Vector3(half, -half, z),
      new THREE.Vector3(-half, -half, z),
      new THREE.Vector3(-half, half, z),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.positionCursorOutlineColorHex,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
    });

    const outline = new THREE.Line(geometry, material);
    outline.visible = false;
    outline.renderOrder = 1000;
    this.addWorldObject(outline);
    this.positionCursorOutline = outline;
    return outline;
  }

  private setPositionInputMode(active: boolean): void {
    if (!active) {
      if (this.fpsCrosshairGlancePending?.sawPositionInput) {
        this.fpsCrosshairGlancePending.positionResolvedAtMs = Date.now();
      }
      this.positionInputModeActive = false;
      this.hasRuntimePositionCursor = false;
      this.clearPositionCursor();
      this.syncFpsPointerLockForUiState(true);
      return;
    }

    if (this.positionInputModeActive === active) {
      return;
    }

    this.positionInputModeActive = true;
    if (this.fpsCrosshairGlancePending) {
      this.fpsCrosshairGlancePending.sawPositionInput = true;
    }
    this.syncFpsPointerLockForUiState(false);

    // Preserve any cursor published before the active-state event arrives.
    if (!this.hasRuntimePositionCursor) {
      this.positionCursor = { ...this.playerPos };
    }
    this.updatePositionCursorOutline();
  }

  private setPositionCursorPosition(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    this.positionCursor = { x, y };
    this.hasRuntimePositionCursor = true;
    if (this.positionInputModeActive) {
      this.updatePositionCursorOutline();
    }
  }

  private updatePositionCursorOutline(): void {
    if (!this.positionInputModeActive) {
      this.clearPositionCursor();
      return;
    }

    const outline = this.ensurePositionCursorOutline();
    const key = `${this.positionCursor.x},${this.positionCursor.y}`;
    const targetTileMesh = this.tileMap.get(key);
    const outlineZ = targetTileMesh?.userData?.isWall
      ? this.positionCursorWallZ
      : this.positionCursorGroundZ;
    outline.position.set(
      this.positionCursor.x * TILE_SIZE,
      -this.positionCursor.y * TILE_SIZE,
      outlineZ,
    );
    outline.visible = true;
  }

  private clearPositionCursor(): void {
    if (this.positionCursorOutline) {
      this.positionCursorOutline.visible = false;
    }
  }

  private getMonsterBillboardQualityKey(): string {
    return "1024-v1";
  }

  private createMonsterBillboardTexture(
    glyphChar: string,
    textColor: string,
  ): THREE.CanvasTexture {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Failed to create monster billboard texture context");
    }

    context.clearRect(0, 0, size, size);
    const symbol = String(glyphChar || "?").trim() || "?";
    context.font = `700 ${Math.floor(size * 0.62)}px "Roboto Condensed", "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineCap = "round";
    context.lineWidth = Math.max(10, Math.floor(size * 0.11));
    context.strokeStyle = "rgba(0, 0, 0, 0.9)";
    context.fillStyle = textColor || "#ffffff";
    context.strokeText(symbol, size / 2, size / 2);
    context.fillText(symbol, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  private ensureEntityBlobShadowTexture(): THREE.CanvasTexture {
    if (this.entityBlobShadowTexture) {
      return this.entityBlobShadowTexture;
    }

    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create entity blob shadow texture context");
    }

    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.48,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
    gradient.addColorStop(0.72, "rgba(0, 0, 0, 0.16)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();
    this.entityBlobShadowTexture = texture;
    return texture;
  }

  private acquireMonsterBillboardTexture(
    key: string,
    factory: () => THREE.CanvasTexture,
  ): THREE.CanvasTexture {
    const cached = this.monsterBillboardTextures.get(key);
    if (cached) {
      cached.refCount += 1;
      return cached.texture;
    }
    const texture = factory();
    this.monsterBillboardTextures.set(key, { texture, refCount: 1 });
    return texture;
  }

  private releaseMonsterBillboardTexture(key: string): void {
    if (!key) {
      return;
    }
    const cached = this.monsterBillboardTextures.get(key);
    if (!cached) {
      return;
    }
    cached.refCount -= 1;
    if (cached.refCount <= 0) {
      cached.texture.dispose();
      this.monsterBillboardTextures.delete(key);
    }
  }

  private removeEntityBlobShadow(key: string): void {
    const shadow = this.entityBlobShadows.get(key);
    if (!shadow) {
      return;
    }
    this.removeWorldObject(shadow);
    const material = shadow.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.dispose();
    }
    shadow.geometry.dispose();
    this.entityBlobShadows.delete(key);
  }

  private detachMonsterBillboard(key: string): THREE.Sprite | null {
    this.removeEntityBlobShadow(key);
    this.stopMonsterBillboardDamageFlash(key);
    const sprite = this.monsterBillboards.get(key);
    if (!sprite) {
      return null;
    }
    this.removeWorldObject(sprite);
    this.monsterBillboards.delete(key);
    return sprite;
  }

  private removeMonsterBillboard(key: string): void {
    const sprite = this.detachMonsterBillboard(key);
    if (!sprite) {
      return;
    }
    const material = sprite.material;
    if (material instanceof THREE.SpriteMaterial) {
      const textureKey =
        typeof sprite.userData?.textureKey === "string"
          ? sprite.userData.textureKey
          : "";
      if (textureKey) {
        this.releaseMonsterBillboardTexture(textureKey);
      } else if (material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  }

  private resolveMonsterBillboardTextureSource(texture: THREE.Texture): {
    source: CanvasImageSource;
    width: number;
    height: number;
  } | null {
    const imageLike = texture.image as
      | (CanvasImageSource & { width?: number; height?: number })
      | undefined;
    if (!imageLike) {
      return null;
    }
    const width = Math.max(0, Math.trunc(Number(imageLike.width) || 0));
    const height = Math.max(0, Math.trunc(Number(imageLike.height) || 0));
    if (width <= 0 || height <= 0) {
      return null;
    }
    return {
      source: imageLike,
      width,
      height,
    };
  }

  private resolveMonsterBillboardSplitGridAxisSize(axisPixels: number): number {
    const normalized = Math.max(2, Math.trunc(axisPixels));
    const maxCells = Math.max(2, Math.min(40, normalized));
    const minCells = Math.max(2, Math.min(8, maxCells));

    for (let cells = maxCells; cells >= minCells; cells -= 1) {
      if (normalized % cells === 0) {
        return cells;
      }
    }

    const approx = Math.round(normalized / 8);
    return THREE.MathUtils.clamp(approx, minCells, maxCells);
  }

  private pickRandomMonsterBillboardSplitEdgeTarget(
    gridWidth: number,
    gridHeight: number,
  ): { x: number; y: number } {
    const edge = THREE.MathUtils.randInt(0, 3);
    switch (edge) {
      case 0:
        return { x: 0, y: THREE.MathUtils.randInt(0, gridHeight - 1) };
      case 1:
        return {
          x: gridWidth - 1,
          y: THREE.MathUtils.randInt(0, gridHeight - 1),
        };
      case 2:
        return { x: THREE.MathUtils.randInt(0, gridWidth - 1), y: 0 };
      default:
        return {
          x: THREE.MathUtils.randInt(0, gridWidth - 1),
          y: gridHeight - 1,
        };
    }
  }

  private traceMonsterBillboardLightningSplitPath(
    splitMask: Uint8Array,
    gridWidth: number,
    gridHeight: number,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    branchBudget: number,
  ): void {
    let x = THREE.MathUtils.clamp(Math.trunc(startX), 0, gridWidth - 1);
    let y = THREE.MathUtils.clamp(Math.trunc(startY), 0, gridHeight - 1);
    const clampedTargetX = THREE.MathUtils.clamp(
      Math.trunc(targetX),
      0,
      gridWidth - 1,
    );
    const clampedTargetY = THREE.MathUtils.clamp(
      Math.trunc(targetY),
      0,
      gridHeight - 1,
    );
    const maxSteps = (gridWidth + gridHeight) * 4;

    for (let step = 0; step < maxSteps; step += 1) {
      splitMask[y * gridWidth + x] = 1;
      if (x === clampedTargetX && y === clampedTargetY) {
        break;
      }

      const remainingX = clampedTargetX - x;
      const remainingY = clampedTargetY - y;
      let stepX = Math.sign(remainingX);
      let stepY = Math.sign(remainingY);
      const preferX = Math.abs(remainingX) >= Math.abs(remainingY);
      const jitterRoll = Math.random();

      if (jitterRoll < 0.42) {
        if (preferX) {
          stepY += THREE.MathUtils.randInt(-1, 1);
        } else {
          stepX += THREE.MathUtils.randInt(-1, 1);
        }
      } else if (jitterRoll < 0.57) {
        if (preferX) {
          stepX = Math.sign(remainingX);
          stepY = remainingY === 0 ? THREE.MathUtils.randInt(-1, 1) : 0;
        } else {
          stepY = Math.sign(remainingY);
          stepX = remainingX === 0 ? THREE.MathUtils.randInt(-1, 1) : 0;
        }
      }

      stepX = THREE.MathUtils.clamp(stepX, -1, 1);
      stepY = THREE.MathUtils.clamp(stepY, -1, 1);
      if (stepX === 0 && stepY === 0) {
        if (Math.abs(remainingX) >= Math.abs(remainingY)) {
          stepX = Math.sign(remainingX) || (Math.random() < 0.5 ? -1 : 1);
        } else {
          stepY = Math.sign(remainingY) || (Math.random() < 0.5 ? -1 : 1);
        }
      }

      const nextX = THREE.MathUtils.clamp(x + stepX, 0, gridWidth - 1);
      const nextY = THREE.MathUtils.clamp(y + stepY, 0, gridHeight - 1);
      if (nextX === x && nextY === y) {
        break;
      }

      if (branchBudget > 0 && step > 2 && Math.random() < 0.085) {
        const branchTarget = this.pickRandomMonsterBillboardSplitEdgeTarget(
          gridWidth,
          gridHeight,
        );
        this.traceMonsterBillboardLightningSplitPath(
          splitMask,
          gridWidth,
          gridHeight,
          x,
          y,
          branchTarget.x,
          branchTarget.y,
          branchBudget - 1,
        );
      }

      x = nextX;
      y = nextY;
    }

    splitMask[clampedTargetY * gridWidth + clampedTargetX] = 1;
  }

  private buildMonsterBillboardLightningSplitMask(
    gridWidth: number,
    gridHeight: number,
    startX: number,
    startY: number,
  ): Uint8Array {
    const splitMask = new Uint8Array(gridWidth * gridHeight);
    const minBranchCount = 8;
    const targets: { x: number; y: number }[] = [
      { x: 0, y: THREE.MathUtils.randInt(0, gridHeight - 1) },
      {
        x: gridWidth - 1,
        y: THREE.MathUtils.randInt(0, gridHeight - 1),
      },
      { x: THREE.MathUtils.randInt(0, gridWidth - 1), y: 0 },
      {
        x: THREE.MathUtils.randInt(0, gridWidth - 1),
        y: gridHeight - 1,
      },
    ];
    const uniqueTargetKeys = new Set(
      targets.map((target) => `${target.x},${target.y}`),
    );
    let uniqueAttempts = 0;
    while (
      targets.length < minBranchCount &&
      uniqueAttempts < minBranchCount * 8
    ) {
      const candidate = this.pickRandomMonsterBillboardSplitEdgeTarget(
        gridWidth,
        gridHeight,
      );
      const key = `${candidate.x},${candidate.y}`;
      if (!uniqueTargetKeys.has(key)) {
        targets.push(candidate);
        uniqueTargetKeys.add(key);
      }
      uniqueAttempts += 1;
    }
    while (targets.length < minBranchCount) {
      targets.push(
        this.pickRandomMonsterBillboardSplitEdgeTarget(gridWidth, gridHeight),
      );
    }

    for (const target of targets) {
      this.traceMonsterBillboardLightningSplitPath(
        splitMask,
        gridWidth,
        gridHeight,
        startX,
        startY,
        target.x,
        target.y,
        1,
      );
    }
    splitMask[startY * gridWidth + startX] = 1;

    return splitMask;
  }

  private collectMonsterBillboardSplitRegions(
    gridWidth: number,
    gridHeight: number,
    splitMask: Uint8Array,
    occupiedMask: Uint8Array,
  ): number[][] {
    const regionCells: number[][] = [];
    const visited = new Uint8Array(gridWidth * gridHeight);
    const queue: number[] = [];

    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const startIndex = y * gridWidth + x;
        if (
          splitMask[startIndex] === 1 ||
          visited[startIndex] === 1 ||
          occupiedMask[startIndex] === 0
        ) {
          continue;
        }

        queue.length = 0;
        queue.push(startIndex);
        visited[startIndex] = 1;
        const region: number[] = [];

        while (queue.length > 0) {
          const current = queue.pop();
          if (current === undefined) {
            continue;
          }
          region.push(current);

          const currentX = current % gridWidth;
          const currentY = Math.floor(current / gridWidth);
          const neighbors = [
            currentX > 0 ? current - 1 : -1,
            currentX < gridWidth - 1 ? current + 1 : -1,
            currentY > 0 ? current - gridWidth : -1,
            currentY < gridHeight - 1 ? current + gridWidth : -1,
          ];

          for (const neighbor of neighbors) {
            if (neighbor < 0) {
              continue;
            }
            if (
              splitMask[neighbor] === 1 ||
              visited[neighbor] === 1 ||
              occupiedMask[neighbor] === 0
            ) {
              continue;
            }
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }

        if (region.length > 0) {
          regionCells.push(region);
        }
      }
    }

    return regionCells;
  }

  private sampleMonsterBillboardSplitOccupancyMask(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    gridWidth: number,
    gridHeight: number,
  ): Uint8Array | null {
    const canvas = document.createElement("canvas");
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.clearRect(0, 0, gridWidth, gridHeight);
    context.imageSmoothingEnabled = false;
    context.drawImage(
      source,
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      0,
      gridWidth,
      gridHeight,
    );
    const sampled = context.getImageData(0, 0, gridWidth, gridHeight).data;
    const occupied = new Uint8Array(gridWidth * gridHeight);

    for (let i = 0; i < occupied.length; i += 1) {
      const alpha = sampled[i * 4 + 3];
      occupied[i] = alpha >= 12 ? 1 : 0;
    }

    return occupied;
  }

  private createMonsterBillboardShardDescriptors(
    texture: THREE.Texture,
  ): BillboardShardDescriptor[] {
    const sourceInfo = this.resolveMonsterBillboardTextureSource(texture);
    if (!sourceInfo) {
      return [];
    }

    const sourceWidth = sourceInfo.width;
    const sourceHeight = sourceInfo.height;
    const gridWidth =
      this.resolveMonsterBillboardSplitGridAxisSize(sourceWidth);
    const gridHeight =
      this.resolveMonsterBillboardSplitGridAxisSize(sourceHeight);
    if (gridWidth < 2 || gridHeight < 2) {
      return [];
    }

    const source = sourceInfo.source;
    const occupiedMask = this.sampleMonsterBillboardSplitOccupancyMask(
      source,
      sourceWidth,
      sourceHeight,
      gridWidth,
      gridHeight,
    );
    if (!occupiedMask) {
      return [];
    }

    const occupiedIndices: number[] = [];
    for (let i = 0; i < occupiedMask.length; i += 1) {
      if (occupiedMask[i] === 1) {
        occupiedIndices.push(i);
      }
    }
    if (!occupiedIndices.length) {
      return [];
    }

    const insetMinX = Math.floor(gridWidth * 0.25);
    const insetMaxXExclusive = Math.max(
      insetMinX + 1,
      Math.ceil(gridWidth * 0.75),
    );
    const insetMinY = Math.floor(gridHeight * 0.25);
    const insetMaxYExclusive = Math.max(
      insetMinY + 1,
      Math.ceil(gridHeight * 0.75),
    );
    const insetOccupiedIndices = occupiedIndices.filter((index) => {
      const x = index % gridWidth;
      const y = Math.floor(index / gridWidth);
      return (
        x >= insetMinX &&
        x < insetMaxXExclusive &&
        y >= insetMinY &&
        y < insetMaxYExclusive
      );
    });
    const seedCandidates =
      insetOccupiedIndices.length > 0 ? insetOccupiedIndices : occupiedIndices;
    const startIndex =
      seedCandidates[THREE.MathUtils.randInt(0, seedCandidates.length - 1)];
    const startX = startIndex % gridWidth;
    const startY = Math.floor(startIndex / gridWidth);
    const splitMask = this.buildMonsterBillboardLightningSplitMask(
      gridWidth,
      gridHeight,
      startX,
      startY,
    );
    const regions = this.collectMonsterBillboardSplitRegions(
      gridWidth,
      gridHeight,
      splitMask,
      occupiedMask,
    );
    if (regions.length <= 1) {
      return [];
    }

    regions.sort((a, b) => b.length - a.length);
    const limitedRegions = regions.slice(
      0,
      this.monsterBillboardShardMaxPieces,
    );

    const cellX = new Int32Array(gridWidth + 1);
    const cellY = new Int32Array(gridHeight + 1);
    for (let x = 0; x <= gridWidth; x += 1) {
      cellX[x] = Math.floor((x * sourceWidth) / gridWidth);
    }
    for (let y = 0; y <= gridHeight; y += 1) {
      cellY[y] = Math.floor((y * sourceHeight) / gridHeight);
    }

    const descriptors: BillboardShardDescriptor[] = [];
    for (const region of limitedRegions) {
      let minPixelX = sourceWidth;
      let minPixelY = sourceHeight;
      let maxPixelX = 0;
      let maxPixelY = 0;
      let weightedCenterX = 0;
      let weightedCenterY = 0;
      let weightedArea = 0;

      for (const cellIndex of region) {
        const cellXIndex = cellIndex % gridWidth;
        const cellYIndex = Math.floor(cellIndex / gridWidth);
        const x0 = cellX[cellXIndex];
        const x1 = cellX[cellXIndex + 1];
        const y0 = cellY[cellYIndex];
        const y1 = cellY[cellYIndex + 1];
        const width = x1 - x0;
        const height = y1 - y0;
        if (width <= 0 || height <= 0) {
          continue;
        }

        minPixelX = Math.min(minPixelX, x0);
        minPixelY = Math.min(minPixelY, y0);
        maxPixelX = Math.max(maxPixelX, x1);
        maxPixelY = Math.max(maxPixelY, y1);
        const area = width * height;
        weightedArea += area;
        weightedCenterX += (x0 + x1) * 0.5 * area;
        weightedCenterY += (y0 + y1) * 0.5 * area;
      }

      if (weightedArea <= 0) {
        continue;
      }

      const shardWidth = maxPixelX - minPixelX;
      const shardHeight = maxPixelY - minPixelY;
      if (shardWidth <= 0 || shardHeight <= 0) {
        continue;
      }

      const canvas = document.createElement("canvas");
      canvas.width = shardWidth;
      canvas.height = shardHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        continue;
      }

      context.clearRect(0, 0, shardWidth, shardHeight);
      context.imageSmoothingEnabled = false;
      const boundaryCells: Array<{
        cellIndex: number;
        towardSplitSteps: Array<{ dx: number; dy: number }>;
      }> = [];
      for (const cellIndex of region) {
        const cellXIndex = cellIndex % gridWidth;
        const cellYIndex = Math.floor(cellIndex / gridWidth);
        const left = cellXIndex > 0 ? cellIndex - 1 : -1;
        const rightNeighbor = cellXIndex < gridWidth - 1 ? cellIndex + 1 : -1;
        const up = cellYIndex > 0 ? cellIndex - gridWidth : -1;
        const down = cellYIndex < gridHeight - 1 ? cellIndex + gridWidth : -1;
        const towardSplitSteps: Array<{ dx: number; dy: number }> = [];
        if (left >= 0 && splitMask[left] === 1) {
          towardSplitSteps.push({ dx: -1, dy: 0 });
        }
        if (rightNeighbor >= 0 && splitMask[rightNeighbor] === 1) {
          towardSplitSteps.push({ dx: 1, dy: 0 });
        }
        if (up >= 0 && splitMask[up] === 1) {
          towardSplitSteps.push({ dx: 0, dy: -1 });
        }
        if (down >= 0 && splitMask[down] === 1) {
          towardSplitSteps.push({ dx: 0, dy: 1 });
        }
        if (towardSplitSteps.length > 0) {
          boundaryCells.push({ cellIndex, towardSplitSteps });
        }
      }
      for (const cellIndex of region) {
        const cellXIndex = cellIndex % gridWidth;
        const cellYIndex = Math.floor(cellIndex / gridWidth);
        const sourceX = cellX[cellXIndex];
        const sourceY = cellY[cellYIndex];
        const sourceWidthPixels = cellX[cellXIndex + 1] - sourceX;
        const sourceHeightPixels = cellY[cellYIndex + 1] - sourceY;
        if (sourceWidthPixels <= 0 || sourceHeightPixels <= 0) {
          continue;
        }
        context.drawImage(
          source,
          sourceX,
          sourceY,
          sourceWidthPixels,
          sourceHeightPixels,
          sourceX - minPixelX,
          sourceY - minPixelY,
          sourceWidthPixels,
          sourceHeightPixels,
        );
      }
      const boundaryRedChance = this.clientOptions.monsterShatterBloodBorders
        ? THREE.MathUtils.clamp(
            this.monsterBillboardShardBoundaryRedChancePercent / 100,
            0,
            1,
          )
        : 0;
      const boundaryRedBleedChance = this.clientOptions
        .monsterShatterBloodBorders
        ? THREE.MathUtils.clamp(
            this.monsterBillboardShardBoundaryRedBleedChancePercent / 100,
            0,
            1,
          )
        : 0;
      if (boundaryCells.length > 0 && boundaryRedChance > 0) {
        const imageData = context.getImageData(0, 0, shardWidth, shardHeight);
        const data = imageData.data;
        for (const boundaryCell of boundaryCells) {
          const { cellIndex, towardSplitSteps } = boundaryCell;
          const cellXIndex = cellIndex % gridWidth;
          const cellYIndex = Math.floor(cellIndex / gridWidth);
          const sourceX = cellX[cellXIndex];
          const sourceY = cellY[cellYIndex];
          const sourceWidthPixels = cellX[cellXIndex + 1] - sourceX;
          const sourceHeightPixels = cellY[cellYIndex + 1] - sourceY;
          if (sourceWidthPixels <= 0 || sourceHeightPixels <= 0) {
            continue;
          }
          const localX = sourceX - minPixelX;
          const localY = sourceY - minPixelY;
          for (let py = 0; py < sourceHeightPixels; py += 1) {
            const pixelY = localY + py;
            if (pixelY < 0 || pixelY >= shardHeight) {
              continue;
            }
            for (let px = 0; px < sourceWidthPixels; px += 1) {
              const pixelX = localX + px;
              if (pixelX < 0 || pixelX >= shardWidth) {
                continue;
              }
              const baseIndex = (pixelY * shardWidth + pixelX) * 4;
              const alphaIndex = baseIndex + 3;
              if (data[alphaIndex] === 0) {
                continue;
              }
              if (Math.random() > boundaryRedChance) {
                continue;
              }
              data[baseIndex] = 255;
              data[baseIndex + 1] = 30;
              data[baseIndex + 2] = 30;
              if (
                boundaryRedBleedChance <= 0 ||
                towardSplitSteps.length === 0 ||
                Math.random() > boundaryRedBleedChance
              ) {
                continue;
              }
              const towardStep =
                towardSplitSteps[
                  THREE.MathUtils.randInt(0, towardSplitSteps.length - 1)
                ];
              const bleedPixelX = pixelX + towardStep.dx;
              const bleedPixelY = pixelY + towardStep.dy;
              if (
                bleedPixelX < 0 ||
                bleedPixelX >= shardWidth ||
                bleedPixelY < 0 ||
                bleedPixelY >= shardHeight
              ) {
                continue;
              }
              const bleedBaseIndex =
                (bleedPixelY * shardWidth + bleedPixelX) * 4;
              if (data[bleedBaseIndex + 3] === 0) {
                continue;
              }
              data[bleedBaseIndex] = 255;
              data[bleedBaseIndex + 1] = 30;
              data[bleedBaseIndex + 2] = 30;
            }
          }
        }
        context.putImageData(imageData, 0, 0);
      }

      const shardTexture = new THREE.CanvasTexture(canvas);
      shardTexture.needsUpdate = true;
      shardTexture.magFilter = texture.magFilter;
      shardTexture.minFilter = texture.minFilter;
      shardTexture.generateMipmaps = false;
      shardTexture.anisotropy = this.resolveTextureAnisotropyLevel();

      const areaRatio = THREE.MathUtils.clamp(
        weightedArea / (sourceWidth * sourceHeight),
        0.0001,
        1,
      );
      if (areaRatio < 0.0014) {
        shardTexture.dispose();
        continue;
      }

      descriptors.push({
        texture: shardTexture,
        centerU: weightedCenterX / (weightedArea * sourceWidth),
        centerV: weightedCenterY / (weightedArea * sourceHeight),
        widthRatio: shardWidth / sourceWidth,
        heightRatio: shardHeight / sourceHeight,
        areaRatio,
      });
    }

    return descriptors;
  }

  private spawnMonsterBillboardShardParticlesFromDescriptors(
    sprite: THREE.Sprite,
    descriptors: BillboardShardDescriptor[],
  ): void {
    if (!descriptors.length) {
      return;
    }

    const basePosition = sprite.position;
    const baseScaleX = Math.max(0.02, sprite.scale.x);
    const baseScaleY = Math.max(0.02, sprite.scale.y);
    const viewCamera = this.getActiveViewCamera();
    const toCamera = new THREE.Vector2(
      viewCamera.position.x - basePosition.x,
      viewCamera.position.y - basePosition.y,
    );
    if (toCamera.lengthSq() < 1e-6) {
      toCamera.set(-Math.sin(this.cameraYaw), -Math.cos(this.cameraYaw));
    }
    toCamera.normalize();
    const right = new THREE.Vector2(toCamera.y, -toCamera.x);

    const toPlayer = new THREE.Vector2(
      this.playerPos.x * TILE_SIZE - basePosition.x,
      -this.playerPos.y * TILE_SIZE - basePosition.y,
    );
    if (toPlayer.lengthSq() < 1e-6) {
      const randomAngle = Math.random() * Math.PI * 2;
      toPlayer.set(Math.cos(randomAngle), Math.sin(randomAngle));
    }
    toPlayer.normalize();
    const awayFromPlayer = toPlayer.clone().multiplyScalar(-1);

    const impulseLocalX = (Math.random() - 0.5) * baseScaleX * 0.72;
    const impulseLocalY = (Math.random() - 0.5) * baseScaleY * 0.72;
    const impulseOrigin = new THREE.Vector3(
      basePosition.x +
        right.x * impulseLocalX +
        toPlayer.x * this.monsterBillboardShardImpulseTowardPlayer,
      basePosition.y +
        right.y * impulseLocalX +
        toPlayer.y * this.monsterBillboardShardImpulseTowardPlayer,
      basePosition.z + impulseLocalY,
    );

    for (const descriptor of descriptors) {
      const scaleX = Math.max(0.02, baseScaleX * descriptor.widthRatio);
      const scaleY = Math.max(0.02, baseScaleY * descriptor.heightRatio);
      if (scaleX <= 0 || scaleY <= 0) {
        descriptor.texture.dispose();
        continue;
      }

      const localX = (descriptor.centerU - 0.5) * baseScaleX;
      const localY = (0.5 - descriptor.centerV) * baseScaleY;
      const shardPosition = new THREE.Vector3(
        basePosition.x + right.x * localX,
        basePosition.y + right.y * localX,
        basePosition.z + localY,
      );

      const material = new THREE.MeshBasicMaterial({
        map: descriptor.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });
      material.opacity = 0.98;
      this.patchMaterialForVignette(material);

      const geometry = new THREE.PlaneGeometry(1, 1);
      const shardMesh = new THREE.Mesh(geometry, material);
      shardMesh.position.copy(shardPosition);
      shardMesh.scale.set(scaleX, scaleY, 1);
      shardMesh.quaternion.copy(viewCamera.quaternion);
      shardMesh.renderOrder = 922;
      this.addWorldObject(shardMesh);

      const radial = new THREE.Vector3().subVectors(
        shardPosition,
        impulseOrigin,
      );
      const radialXY = new THREE.Vector2(radial.x, radial.y);
      if (radialXY.lengthSq() < 1e-8) {
        radialXY.copy(awayFromPlayer);
      } else {
        radialXY.normalize();
      }
      radialXY.lerp(awayFromPlayer, 0.52);
      if (radialXY.lengthSq() < 1e-8) {
        radialXY.copy(awayFromPlayer);
      } else {
        radialXY.normalize();
      }

      const smallness = THREE.MathUtils.clamp(
        1 - Math.sqrt(descriptor.areaRatio),
        0,
        1,
      );
      const horizontalSpeed =
        this.monsterBillboardShardBaseHorizontalSpeed +
        smallness * this.monsterBillboardShardHorizontalVariance +
        Math.random() * 1.6;
      const verticalSpeed =
        this.monsterBillboardShardVerticalBaseSpeed +
        smallness * this.monsterBillboardShardVerticalVariance +
        Math.max(0, radial.z) * 1.25 +
        Math.random() * 1.35;
      const collisionRadius = THREE.MathUtils.clamp(
        Math.max(scaleX, scaleY) * 0.34,
        0.03,
        0.24,
      );
      const angularAxis = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      );
      if (angularAxis.lengthSq() < 1e-8) {
        angularAxis.set(0, 0, 1);
      } else {
        angularAxis.normalize();
      }
      const angularSpeed = 3.2 + Math.random() * 5.1;
      const flatOrientation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.random() * Math.PI * 2,
      );

      this.monsterBillboardShardParticles.push({
        mesh: shardMesh,
        velocity: new THREE.Vector3(
          radialXY.x * horizontalSpeed,
          radialXY.y * horizontalSpeed,
          verticalSpeed,
        ),
        ageMs: 0,
        lifetimeMs: this.monsterBillboardShardLifetimeMs,
        fadeStartMs: this.monsterBillboardShardFadeStartMs,
        radius: collisionRadius,
        baseScale: new THREE.Vector2(scaleX, scaleY),
        angularVelocity: angularAxis.multiplyScalar(angularSpeed),
        floorContactMs: 0,
        settled: false,
        flatOrientation,
      });
    }
  }

  private spawnMonsterBillboardShatterEffectAtTile(
    tileX: number,
    tileY: number,
  ): boolean {
    const key = `${tileX},${tileY}`;
    const sprite = this.monsterBillboards.get(key);
    if (!sprite) {
      return false;
    }

    const material = sprite.material;
    if (!(material instanceof THREE.SpriteMaterial)) {
      return false;
    }

    const sourceTexture = material.map;
    if (!sourceTexture) {
      return false;
    }
    const descriptors =
      this.createMonsterBillboardShardDescriptors(sourceTexture);
    if (!descriptors.length) {
      return false;
    }

    this.spawnMonsterBillboardShardParticlesFromDescriptors(
      sprite,
      descriptors,
    );
    return true;
  }

  private getLowestPixelOffset(
    context: CanvasRenderingContext2D,
    size: number,
  ): number {
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    let lowestPixelY = -1;

    for (let y = size - 1; y >= 0; y--) {
      for (let x = 0; x < size; x++) {
        const alphaIndex = (y * size + x) * 4 + 3;
        if (data[alphaIndex] > 0) {
          lowestPixelY = y;
          break;
        }
      }
      if (lowestPixelY !== -1) {
        break;
      }
    }

    if (lowestPixelY === -1) {
      return 1.0; // Texture is empty, align to bottom
    }

    // Add 1 to get the row *after* the last pixel for alignment.
    return (lowestPixelY + 1) / size;
  }

  private getSpriteContentWidth(
    context: CanvasRenderingContext2D,
    size: number,
  ): number {
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    let minX = size;
    let maxX = -1;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const alphaIndex = (y * size + x) * 4 + 3;
        if (data[alphaIndex] > 0) {
          if (x < minX) {
            minX = x;
          }
          if (x > maxX) {
            maxX = x;
          }
        }
      }
    }

    if (maxX === -1) {
      return 0; // Texture is empty
    }

    const widthInPixels = maxX - minX + 1;
    return widthInPixels / size;
  }

  private ensureEntityBlobShadow(
    key: string,
    x: number,
    y: number,
    scaleBase: number,
    isWall: boolean,
  ): void {
    let shadow = this.entityBlobShadows.get(key);
    if (!shadow) {
      const geometry = new THREE.PlaneGeometry(
        TILE_SIZE * 0.8,
        TILE_SIZE * 0.8,
      );
      const material = new THREE.MeshBasicMaterial({
        map: this.ensureEntityBlobShadowTexture(),
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });
      this.patchMaterialForVignette(material);
      shadow = new THREE.Mesh(geometry, material);
      shadow.renderOrder = 905;
      this.entityBlobShadows.set(key, shadow);
      this.addWorldObject(shadow);
    }

    shadow.position.set(
      x * TILE_SIZE,
      -y * TILE_SIZE,
      isWall ? WALL_HEIGHT + 0.03 : 0.028,
    );
    shadow.scale.set(scaleBase, scaleBase * 0.82, 1);
  }

  private ensureMonsterBillboard(
    key: string,
    x: number,
    y: number,
    glyphChar: string,
    textColor: string,
    tileIndex: number = -1,
    entityType: "monster" | "loot" = "monster",
    isWall: boolean = false,
  ): void {
    const useTiles =
      this.clientOptions.tilesetMode === "tiles" && tileIndex >= 0;
    const backgroundRemovalTextureKey =
      this.clientOptions.tilesetBackgroundRemovalMode === "solid"
        ? `solid:${this.clientOptions.tilesetSolidChromaKeyColorHex}`
        : `tile:${this.clientOptions.tilesetBackgroundTileId}`;
    const textureKey = useTiles
      ? `tile-billboard:${tileIndex}|bg:${backgroundRemovalTextureKey}`
      : `${this.getMonsterBillboardQualityKey()}|${glyphChar}|${textColor}`;

    const spriteKey = key;
    let sprite = this.monsterBillboards.get(spriteKey);
    if (!sprite) {
      const factory = useTiles
        ? () => this.createTileTexture(tileIndex, 1, true) // Pass true: billboards use transparency
        : () => this.createMonsterBillboardTexture(glyphChar, textColor);

      const texture = this.acquireMonsterBillboardTexture(textureKey, factory);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });

      // Patch the monster/loot billboard to add vignette lighting
      this.patchMaterialForVignette(material);

      sprite = new THREE.Sprite(material);
      sprite.renderOrder = 910;
      sprite.userData.textureKey = textureKey;
      this.monsterBillboards.set(spriteKey, sprite);
      this.addWorldObject(sprite);
    } else {
      const existingTextureKey =
        typeof sprite.userData?.textureKey === "string"
          ? sprite.userData.textureKey
          : "";
      if (existingTextureKey !== textureKey) {
        const material = sprite.material;
        if (material instanceof THREE.SpriteMaterial) {
          if (existingTextureKey) {
            this.releaseMonsterBillboardTexture(existingTextureKey);
          } else if (material.map) {
            material.map.dispose();
          }
          const factory = useTiles
            ? () => this.createTileTexture(tileIndex, 1, true) // Pass true here as well
            : () => this.createMonsterBillboardTexture(glyphChar, textColor);

          material.map = this.acquireMonsterBillboardTexture(
            textureKey,
            factory,
          );
          material.needsUpdate = true;
          sprite.userData.textureKey = textureKey;
        }
      }
    }

    const isBoulderTileIndex = this.isBoulderTileIndex(tileIndex);
    const isBoulder =
      entityType === "loot" &&
      (isBoulderTileIndex || String(glyphChar || "").trim() === "`");

    const overrideSize = (normalScale: number, fpsScale: number) => {
      return this.isFpsMode() ? fpsScale : normalScale;
    };

    // Determine sprite scale based on mode
    let scaleBase = this.isFpsMode()
      ? entityType === "loot"
        ? 0.5
        : 0.75
      : entityType === "loot"
        ? 1
        : 1;

    if (isBoulder) {
      scaleBase = overrideSize(1, 1);
    }
    sprite.scale.set(scaleBase, scaleBase, 1);

    const texture = sprite.material.map;
    let verticalOffset = 1.0;
    let contentWidth = 1.0;
    if (texture && texture.image instanceof HTMLCanvasElement) {
      const canvas = texture.image;
      const context = canvas.getContext("2d");
      if (context && useTiles) {
        verticalOffset = this.getLowestPixelOffset(context, canvas.height);
        contentWidth = this.getSpriteContentWidth(context, canvas.width);
      }
    }

    const floorZ = isWall ? WALL_HEIGHT + 0.03 : 0.028;
    const newZ = (verticalOffset - 0.5) * scaleBase + floorZ;
    sprite.position.set(x * TILE_SIZE, -y * TILE_SIZE, newZ);
    sprite.userData.elevatedZ = newZ;
    sprite.userData.tileX = x;
    sprite.userData.tileY = y;

    const shadowScale = (scaleBase * contentWidth * 1.25) / (TILE_SIZE * 0.8);
    this.ensureEntityBlobShadow(key, x, y, shadowScale, isWall);
  }

  private updateTile(
    x: number,
    y: number,
    glyph: number,
    char?: string,
    color?: number,
    options: TileUpdateOptions = {},
  ): void {
    const key = `${x},${y}`;
    const isInferredDarkCorridorWall =
      options.inferredDarkCorridorWall === true;
    const restartRevealFade = options.restartRevealFade === true;
    const hadInferredDarkCorridorWall =
      this.inferredDarkCorridorWallTiles.has(key);
    let mesh = this.tileMap.get(key);
    const behavior = classifyTileBehavior({
      glyph,
      runtimeChar: char ?? null,
      runtimeColor: typeof color === "number" ? color : null,
      runtimeTileIndex:
        typeof options.runtimeTileIndex === "number"
          ? options.runtimeTileIndex
          : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null,
    });
    const isMonsterLikeCharacter = this.isMonsterLikeBehavior(behavior);
    const isLootLikeCharacter = this.isLootLikeBehavior(behavior);
    const isSink = isSinkCmapGlyph(behavior.effective.glyph);
    const isFountain = behavior.materialKind === "fountain";
    const isStairsUp = behavior.materialKind === "stairs_up";
    const isAltarOrTombstone = this.isAltarOrTombstoneLikeBehavior(behavior);
    const isStatue = behavior.effective.kind === "statue";
    const useTiles = this.clientOptions.tilesetMode === "tiles";
    const nowMs = Date.now();
    const previousPlayerTileForSuppression =
      this.fpsPreviousPlayerTileForSuppression;
    const shouldSuppressRecentPreviousPlayerTileInFps =
      this.isFpsMode() &&
      previousPlayerTileForSuppression !== null &&
      nowMs - previousPlayerTileForSuppression.capturedAtMs <= 450 &&
      x === previousPlayerTileForSuppression.x &&
      y === previousPlayerTileForSuppression.y;
    const shouldSuppressPlayerTileVisualInFps =
      this.isFpsMode() &&
      ((x === this.playerPos.x && y === this.playerPos.y) ||
        shouldSuppressRecentPreviousPlayerTileInFps);

    const shouldElevateEntity =
      isMonsterLikeCharacter ||
      isLootLikeCharacter ||
      (this.isFpsMode() && isAltarOrTombstone) ||
      (useTiles &&
        (isSink || isFountain || isStairsUp || isAltarOrTombstone || isStatue));
    const shouldUseElevatedBillboard =
      shouldElevateEntity && (useTiles || this.isFpsMode());

    const isUndiscovered = this.isUndiscoveredKind(behavior.effective.kind);

    if (
      !isInferredDarkCorridorWall &&
      hadInferredDarkCorridorWall &&
      isUndiscovered
    ) {
      // Keep inferred corridor-wall memory when runtime emits an unknown/undiscovered
      // refresh for out-of-sight tiles. Only concrete terrain should overwrite it.
      return;
    }

    if (!isInferredDarkCorridorWall) {
      this.inferredDarkCorridorWallTiles.delete(key);
    }

    if (isUndiscovered) {
      if (mesh) {
        this.disposeWallSideTileOverlay(mesh);
        this.removeWorldObject(mesh);
        this.tileMap.delete(key);
      }
      this.removeFloorBlockAmbientOcclusionOverlay(key);
      this.fpsFlatFeatureUnderPlayerCache.delete(key);
      this.removeMonsterBillboard(key);
      this.activeEffectTileKeys.delete(key);
      const overlay = this.glyphOverlayMap.get(key);
      if (overlay) {
        this.disposeGlyphOverlay(overlay);
        this.glyphOverlayMap.delete(key);
      }
      this.queueMinimapTileUpdate(x, y, behavior, true);
      this.refreshFpsWallChamferGeometryNear(x, y);
      this.refreshFloorBlockAmbientOcclusionNear(x, y);
      this.markLightingDirty();
      return;
    }

    if (!isInferredDarkCorridorWall) {
      const shouldCacheFlatUnderPlayer =
        this.shouldRenderFlatFeatureUnderFpsPlayer(behavior);
      if (this.isPersistentTerrainKind(behavior.resolved.kind)) {
        this.lastKnownTerrain.set(key, {
          glyph,
          char: behavior.resolved.char ?? undefined,
          color: behavior.resolved.color ?? undefined,
          tileIndex: behavior.resolved.tileIndex,
        });
      }
      if (shouldCacheFlatUnderPlayer) {
        this.fpsFlatFeatureUnderPlayerCache.set(key, {
          glyph,
          char: behavior.resolved.char ?? undefined,
          color: behavior.resolved.color ?? undefined,
          tileIndex: behavior.resolved.tileIndex,
        });
      } else {
        this.fpsFlatFeatureUnderPlayerCache.delete(key);
      }
    }

    let renderBehavior = behavior;
    let tileGlyphChar = behavior.glyphChar;
    let tileTextColor = behavior.textColor;
    const shouldFlattenVoidOrUnknownTile =
      this.shouldFlattenVoidOrUnknownTileFor367(
        behavior,
        isInferredDarkCorridorWall,
      );
    if (shouldFlattenVoidOrUnknownTile) {
      renderBehavior = {
        ...behavior,
        materialKind: "dark",
        geometryKind: "floor",
        isWall: false,
      };
    }
    const preferNormalModeAsciiUnderlayForFpsBillboards =
      this.isFpsMode() && !useTiles && shouldUseElevatedBillboard;

    // FPS/tiles billboard rendering: hide duplicate glyph text on the tile.
    // Terrain underlay behavior differs by branch below.
    if (shouldSuppressPlayerTileVisualInFps) {
      const defaultPlayerSuppressedGlyph = this.isFpsMode()
        ? getDefaultDarkFloorGlyph()
        : getDefaultFloorGlyph();
      const cachedFlatFeature =
        this.fpsFlatFeatureUnderPlayerCache.get(key) ??
        this.lastKnownTerrain.get(key);
      if (cachedFlatFeature) {
        renderBehavior = classifyTileBehavior({
          glyph: cachedFlatFeature.glyph,
          runtimeChar: cachedFlatFeature.char ?? null,
          runtimeColor:
            typeof cachedFlatFeature.color === "number"
              ? cachedFlatFeature.color
              : null,
          runtimeTileIndex:
            typeof cachedFlatFeature.tileIndex === "number"
              ? cachedFlatFeature.tileIndex
              : null,
          priorTerrain: cachedFlatFeature,
        });
        if (this.isFpsMode() && renderBehavior.isWall) {
          renderBehavior = classifyTileBehavior({
            glyph: getDefaultDarkFloorGlyph(),
            runtimeChar: ".",
            runtimeColor: null,
            priorTerrain: null,
          });
        }
      } else {
        renderBehavior = classifyTileBehavior({
          glyph: defaultPlayerSuppressedGlyph,
          runtimeChar: ".",
          runtimeColor: null,
          priorTerrain: null,
        });
      }
      const shouldKeepFlatGlyphUnderPlayer =
        this.shouldRenderFlatFeatureUnderFpsPlayer(renderBehavior);
      const shouldKeepFloorGlyphUnderPlayerInFpsAscii =
        this.shouldKeepFloorGlyphUnderFpsAsciiPlayer(renderBehavior);
      tileGlyphChar =
        shouldKeepFlatGlyphUnderPlayer ||
        shouldKeepFloorGlyphUnderPlayerInFpsAscii
          ? renderBehavior.glyphChar
          : " ";
      tileTextColor = renderBehavior.textColor;
    } else if (preferNormalModeAsciiUnderlayForFpsBillboards) {
      // In FPS ASCII mode, keep the same tile color/material classification that
      // normal mode would use under entity glyphs; only lift the glyph itself
      // onto the billboard to avoid double-drawing the character.
      tileGlyphChar = " ";
      tileTextColor = behavior.textColor;
    } else if (shouldUseElevatedBillboard) {
      if (isStairsUp || isSink || isFountain || isAltarOrTombstone) {
        renderBehavior = classifyTileBehavior({
          glyph: getDefaultFloorGlyph(),
          runtimeChar: ".",
          runtimeColor: null,
          priorTerrain: null,
        });
      } else {
        const floorSnapshot = this.lastKnownTerrain.get(key);
        if (floorSnapshot) {
          const floorBehavior = classifyTileBehavior({
            glyph: floorSnapshot.glyph,
            runtimeChar: floorSnapshot.char ?? null,
            runtimeColor:
              typeof floorSnapshot.color === "number"
                ? floorSnapshot.color
                : null,
            runtimeTileIndex:
              typeof floorSnapshot.tileIndex === "number"
                ? floorSnapshot.tileIndex
                : null,
            priorTerrain: floorSnapshot,
          });
          if (
            isMonsterLikeCharacter &&
            floorBehavior.materialKind === "door" &&
            floorBehavior.isWall
          ) {
            const openDoorGlyph = getOpenDoorGlyphFrom(floorSnapshot.glyph);
            renderBehavior =
              typeof openDoorGlyph === "number"
                ? classifyTileBehavior({
                    glyph: openDoorGlyph,
                    runtimeChar: null,
                    runtimeColor:
                      typeof floorSnapshot.color === "number"
                        ? floorSnapshot.color
                        : null,
                    runtimeTileIndex: null,
                    priorTerrain: floorSnapshot,
                  })
                : floorBehavior;
          } else {
            renderBehavior = floorBehavior;
          }
          if (this.isFpsMode() && renderBehavior.isWall) {
            renderBehavior = classifyTileBehavior({
              glyph: getDefaultDarkFloorGlyph(),
              runtimeChar: ".",
              runtimeColor: null,
              priorTerrain: null,
            });
          }
        } else {
          const fallbackGlyph = this.isFpsMode()
            ? getDefaultDarkFloorGlyph()
            : getDefaultFloorGlyph();
          renderBehavior = classifyTileBehavior({
            glyph: fallbackGlyph,
            runtimeChar: ".",
            runtimeColor: null,
            priorTerrain: null,
          });
        }
      }
      tileGlyphChar = " ";
      tileTextColor = renderBehavior.textColor;
    }
    if (shouldUseElevatedBillboard && renderBehavior.isWall) {
      const fallbackGlyph = this.isFpsMode()
        ? getDefaultDarkFloorGlyph()
        : getDefaultFloorGlyph();
      renderBehavior = classifyTileBehavior({
        glyph: fallbackGlyph,
        runtimeChar: ".",
        runtimeColor: null,
        priorTerrain: null,
      });
      tileTextColor = renderBehavior.textColor;
    }

    const material = this.getMaterialByKind(renderBehavior.materialKind);
    const wallChamferMask =
      this.isFpsMode() &&
      renderBehavior.geometryKind === "wall" &&
      renderBehavior.materialKind !== "door"
        ? this.computeFpsWallChamferMask(x, y)
        : 0;
    const wallChamferMaterialKind =
      wallChamferMask > 0
        ? this.getFpsChamferMaterialKindForWall(renderBehavior.materialKind)
        : null;
    const wallChamferRotateUv: FpsChamferWallUvRotation =
      wallChamferMask > 0
        ? this.resolveFpsChamferWallUvRotation(tileGlyphChar, glyph)
        : "none";
    const geometry =
      renderBehavior.geometryKind === "wall"
        ? this.getFpsWallGeometry(wallChamferMask, wallChamferRotateUv)
        : this.floorGeometry;
    const targetZ = renderBehavior.isWall ? WALL_HEIGHT / 2 : 0;
    let createdMesh = false;

    if (!mesh) {
      createdMesh = true;
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.addWorldObject(mesh);
      this.tileMap.set(key, mesh);
      if (!this.tileRevealStartMs.has(key)) {
        this.tileRevealStartMs.set(key, performance.now());
      }
    } else {
      mesh.geometry = geometry;
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
    }

    if (restartRevealFade) {
      this.tileRevealStartMs.set(key, performance.now());
    }

    mesh.userData.tileX = x;
    mesh.userData.tileY = y;
    mesh.userData.isInferredDarkCorridorWall = isInferredDarkCorridorWall;
    mesh.userData.isWall = renderBehavior.isWall;
    mesh.userData.materialKind = renderBehavior.materialKind;
    mesh.userData.effectKind = behavior.effectKind;
    mesh.userData.disposition = behavior.disposition;
    mesh.userData.isPlayerGlyph = renderBehavior.isPlayerGlyph;
    mesh.userData.isMonsterLikeCharacter = isMonsterLikeCharacter;
    mesh.userData.isLootLikeCharacter = isLootLikeCharacter;
    mesh.userData.isDamageFlashableCharacter =
      this.isDamageFlashableBehavior(behavior);
    mesh.userData.glyphChar = behavior.glyphChar;
    mesh.userData.sourceGlyph = glyph;
    mesh.userData.glyphTextColor = behavior.textColor;
    mesh.userData.glyphDarkenFactor = behavior.darkenFactor;
    mesh.userData.glyphBaseColorHex = material.color.getHexString();
    const tileTextureIndex =
      this.resolveInferredDarkCorridorWallTileTextureIndex(
        renderBehavior.effective.tileIndex,
        isInferredDarkCorridorWall,
      );
    const inferredDarkWallSolidColorHex =
      this.resolveInferredDarkCorridorWallSolidColorHex(
        isInferredDarkCorridorWall,
      );
    const inferredDarkWallSolidColorGridEnabled =
      this.resolveInferredDarkCorridorWallSolidColorGridEnabled(
        isInferredDarkCorridorWall,
      );
    const inferredDarkWallSolidColorGridDarknessPercent =
      this.resolveInferredDarkCorridorWallSolidColorGridDarknessPercent(
        isInferredDarkCorridorWall,
      );
    mesh.userData.tileIndex = tileTextureIndex;
    mesh.userData.fpsWallChamferMask = wallChamferMask;
    mesh.userData.fpsWallChamferMaterialKind = wallChamferMaterialKind;
    mesh.userData.fpsWallChamferRotateUv = wallChamferRotateUv;
    const visualScale = this.isFpsMode() ? this.tileVisualScaleFps : 1;
    mesh.scale.set(visualScale, visualScale, visualScale);
    const drawFpsFloorGrid = this.isFpsMode() && !isInferredDarkCorridorWall;

    this.applyGlyphMaterial(
      key,
      mesh,
      material,
      tileGlyphChar,
      tileTextColor,
      renderBehavior.isWall,
      renderBehavior.darkenFactor,
      drawFpsFloorGrid,
      tileTextureIndex,
      inferredDarkWallSolidColorHex,
      inferredDarkWallSolidColorGridEnabled,
      inferredDarkWallSolidColorGridDarknessPercent,
    );
    if (isInferredDarkCorridorWall && (createdMesh || restartRevealFade)) {
      const overlay = this.glyphOverlayMap.get(key);
      if (overlay) {
        overlay.material.opacity = 0;
      }
    }

    const isFpsPlayerTile =
      this.isFpsMode() &&
      this.hasSeenPlayerPosition &&
      shouldSuppressPlayerTileVisualInFps;

    // Create or remove a billboard for any entity that should be elevated.
    if (shouldUseElevatedBillboard && !isFpsPlayerTile) {
      this.ensureMonsterBillboard(
        key,
        x,
        y,
        behavior.glyphChar,
        behavior.textColor,
        behavior.effective.tileIndex,
        isLootLikeCharacter ? "loot" : "monster",
        renderBehavior.isWall,
      );
    } else {
      this.removeMonsterBillboard(key);
    }
    if (behavior.effectKind) {
      this.activeEffectTileKeys.add(key);
    } else {
      const hadAnimatedEffect = this.activeEffectTileKeys.delete(key);
      if (hadAnimatedEffect) {
        const overlayMaterial = this.getMeshOverlayMaterial(mesh);
        if (overlayMaterial) {
          overlayMaterial.color.set("#ffffff");
        }
      }
    }
    this.queueMinimapTileUpdate(x, y, behavior, false);
    this.refreshFpsWallChamferGeometryNear(x, y);
    this.refreshFloorBlockAmbientOcclusionNear(x, y);
    this.markLightingDirty();
  }
  private addGameMessage(message: string): void {
    if (!message || message.trim() === "") return;
    this.messageSoundHooks.playMessageLogSoundEffects(message);

    this.gameMessages.unshift(message);
    if (this.gameMessages.length > 100) {
      this.gameMessages.pop();
    }

    this.uiAdapter.setGameMessages([...this.gameMessages]);

    this.showFloatingGameMessage(message);
  }

  private recordPlayerMovement(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const moved = fromX !== toX || fromY !== toY;

    if (!this.hasSeenPlayerPosition) {
      this.hasSeenPlayerPosition = true;
      return;
    }

    if (moved) {
      if (this.isFpsMode()) {
        this.fpsPreviousPlayerTileForSuppression = {
          x: fromX,
          y: fromY,
          capturedAtMs: Date.now(),
        };
      }
      if (this.isFpsMode()) {
        const nowMs = Date.now();
        const autoMoveLikely =
          nowMs - this.lastManualDirectionalInputAtMs >
          this.fpsAutoMoveDetectionWindowMs;
        const moveDx = Math.sign(toX - fromX);
        const moveDy = Math.sign(toY - fromY);
        this.updateFpsCameraAutoTurnFromMovement(
          moveDx,
          moveDy,
          autoMoveLikely,
        );
        this.beginFpsStepCameraTransition(fromX, fromY, toX, toY);
      } else {
        this.recenterCameraOnPlayerIfNeeded();
      }
    }

    const hasRecentMovementInput =
      Date.now() - this.lastMovementInputAtMs <= this.movementUnlockWindowMs;

    if (!this.hasPlayerMovedOnce && moved && hasRecentMovementInput) {
      this.hasPlayerMovedOnce = true;
    }
  }

  private updateFpsCameraAutoTurnFromMovement(
    moveDx: number,
    moveDy: number,
    autoMoveLikely: boolean,
  ): void {
    if (!this.isFpsMode()) {
      return;
    }
    if (!autoMoveLikely) {
      this.fpsAutoMoveDirection = null;
      this.fpsAutoTurnTargetYaw = null;
      return;
    }
    if (moveDx === 0 && moveDy === 0) {
      return;
    }

    if (
      this.fpsAutoMoveDirection &&
      this.fpsAutoMoveDirection.dx === moveDx &&
      this.fpsAutoMoveDirection.dy === moveDy
    ) {
      return;
    }

    // Map movement deltas to the yaw convention used by FPS controls.
    const targetYaw = this.wrapAngle(Math.atan2(-moveDx, moveDy));
    this.fpsAutoTurnTargetYaw = targetYaw;
    this.fpsAutoMoveDirection = { dx: moveDx, dy: moveDy };
  }

  private updateFpsAutoTurnYaw(deltaSeconds: number): void {
    if (!this.isFpsMode() || this.fpsAutoTurnTargetYaw === null) {
      return;
    }

    const delta = this.wrapAngle(this.fpsAutoTurnTargetYaw - this.cameraYaw);
    const maxStep = this.fpsAutoTurnSpeedRadPerSec * Math.max(0, deltaSeconds);
    if (Math.abs(delta) <= maxStep) {
      this.cameraYaw = this.fpsAutoTurnTargetYaw;
      this.fpsAutoTurnTargetYaw = null;
      return;
    }

    this.cameraYaw = this.wrapAngle(
      this.cameraYaw + Math.sign(delta) * maxStep,
    );
  }

  private beginFpsStepCameraTransition(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    if (!this.isFpsMode()) {
      return;
    }

    const fromEyeX = fromX * TILE_SIZE;
    const fromEyeY = -fromY * TILE_SIZE;
    const toEyeX = toX * TILE_SIZE;
    const toEyeY = -toY * TILE_SIZE;

    if (!this.fpsStepCameraActive) {
      this.fpsStepCameraFrom.set(fromEyeX, fromEyeY, this.firstPersonEyeHeight);
    } else {
      const now = performance.now();
      const progress = THREE.MathUtils.clamp(
        (now - this.fpsStepCameraStartMs) / this.fpsStepCameraDurationMs,
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      this.fpsStepCameraFrom.lerp(this.fpsStepCameraTo, eased);
    }

    this.fpsStepCameraDurationMs = this.fpsStepCameraBaseDurationMs;

    this.fpsStepCameraTo.set(toEyeX, toEyeY, this.firstPersonEyeHeight);
    this.fpsStepCameraStartMs = performance.now();
    this.fpsStepCameraActive = true;
  }

  private showFloatingGameMessage(message: string): void {
    this.uiAdapter.pushFloatingMessage(message);
  }

  private updateStatus(status: string): void {
    this.uiAdapter.setStatus(status);
  }

  private updateConnectionStatus(
    status: string,
    state: NethackConnectionState,
  ): void {
    this.runtimeConnectionState = state;
    this.uiAdapter.setConnectionStatus(status, state);
    this.updateMinimapVisibility();
  }

  private resetPlayerStatusDeltaTracking(): void {
    this.lastKnownPlayerHp = null;
    this.lastKnownPlayerExperience = null;
    this.lastKnownPlayerLevel = null;
    this.lastKnownPlayerCoreStats = {};
  }

  private setNewGamePrompt(visible: boolean, reason: string | null): void {
    this.uiAdapter.setNewGamePrompt({
      visible,
      reason: reason && reason.trim() ? reason.trim() : null,
    });
  }

  private handleRuntimeTermination(reason: string): void {
    if (this.runtimeTerminationPromptShown) {
      return;
    }
    this.runtimeTerminationPromptShown = true;

    this.hideQuestion();
    this.hideDirectionQuestion();
    this.hideTextInputRequest();
    this.clearPlayerCliparoundInputCooldown();
    this.hideInventoryDialog();
    this.closeAnyTileContextMenu(false);

    this.uiAdapter.setPositionRequest(null);
    this.uiAdapter.setFpsCrosshairContext(null);
    this.uiAdapter.setRepeatActionVisible(false);

    this.updateConnectionStatus("Game ended", "error");
    this.updateStatus("Game ended");
    this.setLoadingVisible(false);
    this.addGameMessage("Game ended.");
    this.setNewGamePrompt(true, reason);
  }

  private handleRuntimeError(errorMessage: string): void {
    const normalizedMessage =
      typeof errorMessage === "string" && errorMessage.trim()
        ? errorMessage.trim()
        : "Runtime error";
    const normalizedLower = normalizedMessage.toLowerCase();
    const looksLikeNormalTermination =
      (normalizedLower.includes("exitstatus") &&
        normalizedLower.includes("exit(0)")) ||
      normalizedLower.includes("program terminated with exit(0)") ||
      normalizedLower.includes("asyncify wakeup failed");
    if (looksLikeNormalTermination) {
      this.handleRuntimeTermination(normalizedMessage);
      return;
    }
    console.error("Runtime error:", normalizedMessage);
    this.updateConnectionStatus("Error", "error");
    this.updateStatus("Runtime error");
    this.addGameMessage(normalizedMessage);
  }

  private setLoadingVisible(visible: boolean): void {
    this.uiAdapter.setLoadingVisible(visible);
  }

  private parseGoldStatusValue(rawValue: string): number | null {
    const clean = rawValue.trim();
    if (!clean) {
      return null;
    }

    // NetHack may encode gold as "\G....E:<amount>" for status rendering.
    // In this format, the leading digits are metadata and the value after
    // the trailing colon is the actual gold amount.
    if (clean.startsWith("\\G")) {
      const encodedAmountMatch = clean.match(/:(-?\d+)\s*$/);
      if (encodedAmountMatch) {
        return parseInt(encodedAmountMatch[1], 10);
      }
    }

    const numericMatch = clean.match(/-?\d+/);
    if (!numericMatch) {
      return null;
    }

    return parseInt(numericMatch[0], 10);
  }

  private parseStatusConditionMaskValue(
    rawValue: string | number | null,
  ): number | null {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return Math.trunc(rawValue) >>> 0;
    }

    const clean = String(rawValue ?? "").trim();
    if (!clean) {
      return null;
    }

    if (/^0x[0-9a-f]+$/i.test(clean)) {
      const parsedHex = Number.parseInt(clean, 16);
      return Number.isFinite(parsedHex) ? parsedHex >>> 0 : null;
    }

    const decimalMatch = clean.match(/-?\d+/);
    if (!decimalMatch) {
      return null;
    }
    const parsedDecimal = Number.parseInt(decimalMatch[0], 10);
    return Number.isFinite(parsedDecimal) ? parsedDecimal >>> 0 : null;
  }

  private isPlayerBlindForDarkCorridorInference(): boolean {
    return (this.statusConditionMask & this.statusConditionBlindMask) !== 0;
  }

  private isCorePlayerStatField(field: string): field is CorePlayerStatField {
    return (
      field === "strength" ||
      field === "dexterity" ||
      field === "constitution" ||
      field === "intelligence" ||
      field === "wisdom" ||
      field === "charisma" ||
      field === "armor"
    );
  }

  private updatePlayerStats(
    field: number,
    value: string | number | null,
    data: any,
  ): void {
    const legacyByIndex: { [key: number]: string } = {
      0: "name",
      1: "strength",
      2: "dexterity",
      3: "constitution",
      4: "intelligence",
      5: "wisdom",
      6: "charisma",
      7: "alignment",
      8: "score",
      9: "hp",
      10: "maxhp",
      11: "power",
      12: "maxpower",
      13: "armor",
      14: "level",
      15: "experience",
      16: "time",
      17: "hunger",
      18: "encumbrance",
      19: "dungeon",
      20: "dlevel",
      21: "gold",
    };

    const byName: { [key: string]: string } = {
      BL_TITLE: "name",
      BL_STR: "strength",
      BL_DX: "dexterity",
      BL_CO: "constitution",
      BL_IN: "intelligence",
      BL_WI: "wisdom",
      BL_CH: "charisma",
      BL_ALIGN: "alignment",
      BL_SCORE: "score",
      BL_HP: "hp",
      BL_HPMAX: "maxhp",
      BL_ENE: "power",
      BL_ENEMAX: "maxpower",
      BL_AC: "armor",
      BL_XP: "level",
      BL_EXP: "experience",
      BL_TIME: "time",
      BL_HUNGER: "hunger",
      BL_CAP: "encumbrance",
      BL_DNUM: "dungeon",
      BL_DLEVEL: "dlevel",
      BL_GOLD: "gold",
    };

    const rawFieldName =
      typeof data?.fieldName === "string" ? data.fieldName : null;
    const isConditionMaskField =
      rawFieldName === "BL_CONDITION" || (!rawFieldName && field === 22);
    const mappedField =
      (rawFieldName && byName[rawFieldName]) || legacyByIndex[field] || null;

    // Keep a rolling debug history for runtime inspection from devtools.
    this.statusDebugHistory.unshift({
      ts: Date.now(),
      field,
      fieldName: rawFieldName,
      mappedField,
      value,
      valueType: data?.valueType,
      chg: data?.chg,
      percent: data?.percent,
      color: data?.color,
      colormask: data?.colormask,
    });
    if (this.statusDebugHistory.length > 200) {
      this.statusDebugHistory.pop();
    }

    if (isConditionMaskField) {
      const parsedConditionMask = this.parseStatusConditionMaskValue(value);
      if (parsedConditionMask !== null) {
        this.statusConditionMask = parsedConditionMask;
      }
      return;
    }

    if (!mappedField || value === null || value === undefined) {
      console.log(
        `Skipping status update: field=${field}, fieldName=${rawFieldName}, value=${value}`,
      );
      return;
    }

    const numericFields = new Set([
      "hp",
      "maxhp",
      "power",
      "maxpower",
      "level",
      "experience",
      "time",
      "armor",
      "score",
      "gold",
      "dlevel",
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]);

    let parsedValue: any = value;
    if (numericFields.has(mappedField)) {
      if (typeof value === "number") {
        parsedValue = value;
      } else {
        const clean = String(value).trim();
        if (mappedField === "gold") {
          const parsedGold = this.parseGoldStatusValue(clean);
          if (parsedGold === null) {
            console.log(`Could not parse gold status from "${value}"`);
            return;
          }
          parsedValue = parsedGold;
        } else {
          const match = clean.match(/-?\d+/);
          if (!match) {
            console.log(
              `Could not parse numeric status ${mappedField} from "${value}"`,
            );
            return;
          }
          parsedValue = parseInt(match[0], 10);
        }
      }
    } else {
      parsedValue = String(value).trim();
    }

    console.log(`Updating status ${mappedField}: ${parsedValue}`);
    const previousDlevel = this.playerStats.dlevel;
    const previousDungeon = this.playerStats.dungeon;
    let playerDamageTaken: number | null = null;
    let playerHealingGained: number | null = null;
    let playerExperienceDelta: number | null = null;
    let playerLevelUpTo: number | null = null;
    let playerCoreStatDeltaLabel: string | null = null;
    let playerCoreStatDeltaImproved: boolean | null = null;
    if (mappedField === "hp" && typeof parsedValue === "number") {
      const previousHp = this.lastKnownPlayerHp;
      if (typeof previousHp === "number" && Number.isFinite(previousHp)) {
        if (parsedValue < previousHp) {
          playerDamageTaken = Math.round(previousHp - parsedValue);
        } else if (parsedValue > previousHp) {
          playerHealingGained = Math.round(parsedValue - previousHp);
        }
      }
    }
    if (
      this.isCorePlayerStatField(mappedField) &&
      typeof parsedValue === "number"
    ) {
      const previousCoreStatValue = this.lastKnownPlayerCoreStats[mappedField];
      if (
        typeof previousCoreStatValue === "number" &&
        Number.isFinite(previousCoreStatValue)
      ) {
        const statDelta = Math.round(parsedValue - previousCoreStatValue);
        if (statDelta !== 0) {
          const signPrefix = statDelta > 0 ? "+" : "";
          playerCoreStatDeltaLabel = `${this.playerCoreStatDisplayNameByField[mappedField]} ${signPrefix}${statDelta}`;
          playerCoreStatDeltaImproved =
            mappedField === "armor" ? statDelta < 0 : statDelta > 0;
        }
      }
    }
    if (mappedField === "experience" && typeof parsedValue === "number") {
      const previousExperience = this.lastKnownPlayerExperience;
      if (
        typeof previousExperience === "number" &&
        Number.isFinite(previousExperience)
      ) {
        const delta = Math.round(parsedValue - previousExperience);
        if (delta !== 0) {
          playerExperienceDelta = delta;
        }
      }
    }
    if (mappedField === "level" && typeof parsedValue === "number") {
      const previousLevel = this.lastKnownPlayerLevel;
      if (
        typeof previousLevel === "number" &&
        Number.isFinite(previousLevel) &&
        parsedValue > previousLevel
      ) {
        playerLevelUpTo = parsedValue;
      }
    }

    if (mappedField === "maxhp") {
      this.playerStats.maxHp = parsedValue;
    } else if (mappedField === "maxpower") {
      this.playerStats.maxPower = parsedValue;
    } else if (mappedField === "dlevel") {
      this.playerStats.dlevel = parsedValue;
      if (previousDlevel !== parsedValue) {
        this.pendingPlayerTileRefreshOnNextPosition = true;
        this.requestPlayerTileRefresh("dlevel-change");
      }
    } else {
      (this.playerStats as any)[mappedField] = parsedValue;
      if (
        mappedField === "dungeon" &&
        String(previousDungeon) !== String(this.playerStats.dungeon)
      ) {
        this.pendingPlayerTileRefreshOnNextPosition = true;
        this.requestPlayerTileRefresh("dungeon-change");
      }
    }

    if (
      this.isCorePlayerStatField(mappedField) &&
      typeof parsedValue === "number"
    ) {
      this.lastKnownPlayerCoreStats[mappedField] = parsedValue;
    }
    if (mappedField === "experience" && typeof parsedValue === "number") {
      this.lastKnownPlayerExperience = parsedValue;
    }
    if (mappedField === "level" && typeof parsedValue === "number") {
      this.lastKnownPlayerLevel = parsedValue;
    }

    if (mappedField === "hp") {
      this.lastKnownPlayerHp = parsedValue;
      if (playerDamageTaken && playerDamageTaken > 0) {
        this.triggerDamageEffectsAtTile(
          this.playerPos.x,
          this.playerPos.y,
          playerDamageTaken,
        );
      }
      if (playerHealingGained && playerHealingGained > 0) {
        if (this.clientOptions.damageNumbers) {
          this.spawnPlayerHealNumberParticle(
            this.playerPos.x,
            this.playerPos.y,
            playerHealingGained,
          );
        }
      }
    }
    if (
      playerCoreStatDeltaLabel &&
      typeof playerCoreStatDeltaImproved === "boolean" &&
      this.clientOptions.displayStatChangesAbovePlayer
    ) {
      this.spawnPlayerHealNumberParticle(
        this.playerPos.x,
        this.playerPos.y,
        1,
        {
          label: playerCoreStatDeltaLabel,
          fillStyle: playerCoreStatDeltaImproved ? "#79f2a6" : "#ff6b6b",
        },
      );
    }
    if (
      playerExperienceDelta &&
      playerExperienceDelta !== 0 &&
      this.clientOptions.displayXpGainsAbovePlayer
    ) {
      const xpIncreased = playerExperienceDelta > 0;
      const signPrefix = xpIncreased ? "+" : "";
      this.spawnPlayerHealNumberParticle(
        this.playerPos.x,
        this.playerPos.y,
        1,
        {
          label: `XP ${signPrefix}${playerExperienceDelta}`,
          fillStyle: xpIncreased ? "#7ebfff" : "#ff6b6b",
          scaleMultiplier: 0.68,
        },
      );
    }
    if (
      playerLevelUpTo &&
      playerLevelUpTo > 0 &&
      this.clientOptions.displayStatChangesAbovePlayer
    ) {
      this.spawnPlayerHealNumberParticle(
        this.playerPos.x,
        this.playerPos.y,
        1,
        {
          label: `Experience Level ${playerLevelUpTo}`,
          fillStyle: "#f2d06f",
        },
      );
    }

    this.updateStatsDisplay();
  }

  private updateStatsDisplay(): void {
    const snapshot: PlayerStatsSnapshot = {
      ...this.playerStats,
    };
    this.uiAdapter.setPlayerStats(snapshot);
  }

  private updateInventoryDisplay(items: any[]): void {
    const nextInventory = Array.isArray(items)
      ? items.map((item) => ({ ...item }))
      : [];
    this.currentInventory = nextInventory;

    this.uiAdapter.setInventory(this.buildInventoryDialogState());
  }

  private buildInventoryDialogState(): InventoryDialogState {
    const items = this.currentInventory.map((item) => {
      if (item.text) {
        return {
          ...item,
          className: getItemTextClassName(item.text),
        };
      }
      return item;
    });

    return {
      visible: this.isInventoryDialogVisible,
      items: items,
      contextActionsEnabled:
        this.inventoryContextActionsEnabled && !this.gameOverState.active,
    };
  }

  private isMultiSelectLootQuestion(question: string): boolean {
    if (typeof question !== "string") {
      return false;
    }

    const normalizedQuestion = question.trim().toLowerCase();
    return (
      normalizedQuestion.includes("pick up what") ||
      normalizedQuestion.includes("what do you want to pick up") ||
      normalizedQuestion.includes("take out what") ||
      normalizedQuestion.includes("put in what") ||
      normalizedQuestion.includes("what do you want to put in") ||
      normalizedQuestion.includes("put in, then take out what")
    );
  }

  private isCharacterCreationQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    if (
      normalized.includes("character") &&
      (normalized.includes("pick") ||
        normalized.includes("class") ||
        normalized.includes("race") ||
        normalized.includes("gender") ||
        normalized.includes("alignment") ||
        normalized.includes("role"))
    ) {
      return true;
    }
    return (
      normalized.includes("what kind of character") ||
      normalized.includes("what role") ||
      normalized.includes("what is your role") ||
      normalized.includes("what race") ||
      normalized.includes("what is your race") ||
      normalized.includes("what gender") ||
      normalized.includes("what is your gender") ||
      normalized.includes("what alignment") ||
      normalized.includes("what is your alignment") ||
      normalized.includes("pick a character for you") ||
      normalized.includes("shall i pick character") ||
      normalized.includes("shall i pick a character")
    );
  }

  private isNumberPadModeQuestion(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.startsWith("select number_pad mode");
  }

  private setNumberPadModeEnabled(enabled: boolean): void {
    const normalized = Boolean(enabled);
    if (this.numberPadModeEnabled === normalized) {
      return;
    }
    this.numberPadModeEnabled = normalized;
    const modeLabel = normalized ? "numpad" : "hjklyubn";
    console.log(`🎮 Number pad mode set to ${modeLabel}`);
    this.addGameMessage(`Number pad mode: ${modeLabel}`);
    this.uiAdapter.setNumberPadModeEnabled(normalized);
  }

  private updateNumberPadModeFromChoice(choice: string): void {
    if (!this.isNumberPadModeQuestion(this.activeQuestionText)) {
      return;
    }
    const normalizedChoice = String(choice || "").trim();
    if (!normalizedChoice) {
      return;
    }
    if (normalizedChoice === "0") {
      this.setNumberPadModeEnabled(false);
      return;
    }
    if (normalizedChoice === "1" || normalizedChoice === "2") {
      this.setNumberPadModeEnabled(true);
    }
  }

  private toCharacterCreationQuestionPayload(
    data: RuntimeEvent,
  ): CharacterCreationQuestionPayload {
    return {
      text: String(data.text || ""),
      choices: String(data.choices || ""),
      defaultChoice: String(data.default || ""),
      menuItems: Array.isArray(data.menuItems) ? [...data.menuItems] : [],
    };
  }

  private isSelectableQuestionMenuItem(item: any): boolean {
    if (!item || item.isCategory) {
      return false;
    }
    if (Number.isInteger(item.menuIndex)) {
      return true;
    }
    return (
      typeof item.accelerator === "string" && item.accelerator.trim() !== ""
    );
  }

  private getQuestionMenuSelectionInput(item: any): string {
    if (
      item &&
      typeof item.selectionInput === "string" &&
      item.selectionInput
    ) {
      return item.selectionInput;
    }
    const fallback =
      item && typeof item.accelerator === "string" ? item.accelerator : "";
    return this.getMenuSelectionInput(item, fallback);
  }

  private getVisiblePickupSelectableMenuItems(): any[] {
    if (!Array.isArray(this.activeQuestionVisibleMenuItems)) {
      return [];
    }
    return this.activeQuestionVisibleMenuItems.filter((item) =>
      this.isSelectableQuestionMenuItem(item),
    );
  }

  private normalizeActivePickupFocusIndex(): void {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      this.activePickupFocusIndex = 0;
      return;
    }

    if (
      !Number.isInteger(this.activePickupFocusIndex) ||
      this.activePickupFocusIndex < 0 ||
      this.activePickupFocusIndex >= selectableItems.length
    ) {
      this.activePickupFocusIndex = 0;
    }
  }

  private getActivePickupSelectionInput(): string | null {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return null;
    }
    this.normalizeActivePickupFocusIndex();
    const focusedItem = selectableItems[this.activePickupFocusIndex];
    const selectionInput = this.getQuestionMenuSelectionInput(focusedItem);
    return typeof selectionInput === "string" && selectionInput.length > 0
      ? selectionInput
      : null;
  }

  private setActivePickupFocusBySelectionInput(selectionInput: string): void {
    if (typeof selectionInput !== "string" || selectionInput.length === 0) {
      return;
    }
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    const index = selectableItems.findIndex((item) => {
      return this.getQuestionMenuSelectionInput(item) === selectionInput;
    });
    if (index >= 0) {
      this.activePickupFocusIndex = index;
      this.clearQuestionActionFocus();
    }
  }

  private updatePickupFocusVisualState(): void {
    this.syncQuestionDialogState();
  }

  private movePickupFocus(delta: number): void {
    if (!this.activeQuestionIsPickupDialog || delta === 0) {
      return;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return;
    }

    this.normalizeActivePickupFocusIndex();
    this.clearQuestionActionFocus();
    const itemCount = selectableItems.length;
    const nextIndex =
      (((this.activePickupFocusIndex + delta) % itemCount) + itemCount) %
      itemCount;
    this.activePickupFocusIndex = nextIndex;
    this.updatePickupFocusVisualState();
  }

  private toggleActivePickupFocusSelection(): void {
    const focusedSelectionInput = this.getActivePickupSelectionInput();
    if (!focusedSelectionInput) {
      return;
    }

    this.togglePickupChoice(focusedSelectionInput);
  }

  private getActiveQuestionActionButtons(): Array<"confirm" | "cancel"> {
    if (!this.isInQuestion || this.activeQuestionMenuItems.length === 0) {
      return [];
    }
    const selectableCount = this.getVisiblePickupSelectableMenuItems().length;
    if (selectableCount <= 1) {
      return [];
    }
    if (this.activeQuestionIsPickupDialog) {
      return ["confirm", "cancel"];
    }
    return ["cancel"];
  }

  private getActiveQuestionActionButton(): "confirm" | "cancel" | null {
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0) {
      this.activeQuestionActionFocusIndex = -1;
      return null;
    }
    if (this.activeQuestionActionFocusIndex < 0) {
      return null;
    }
    if (this.activeQuestionActionFocusIndex >= actions.length) {
      this.activeQuestionActionFocusIndex = actions.length - 1;
    }
    return actions[this.activeQuestionActionFocusIndex] ?? null;
  }

  private isQuestionActionFocused(): boolean {
    return this.getActiveQuestionActionButton() !== null;
  }

  private setQuestionActionFocusIndex(index: number): void {
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0) {
      this.activeQuestionActionFocusIndex = -1;
    } else {
      const clamped = Math.max(0, Math.min(actions.length - 1, index));
      this.activeQuestionActionFocusIndex = clamped;
    }
    if (this.activeQuestionIsPickupDialog) {
      this.updatePickupFocusVisualState();
    } else {
      this.updateQuestionMenuFocusVisualState();
    }
  }

  private clearQuestionActionFocus(): void {
    this.activeQuestionActionFocusIndex = -1;
  }

  private moveQuestionActionFocus(delta: number): boolean {
    if (delta === 0) {
      return false;
    }
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0 || this.activeQuestionActionFocusIndex < 0) {
      return false;
    }
    const nextIndex = Math.max(
      0,
      Math.min(actions.length - 1, this.activeQuestionActionFocusIndex + delta),
    );
    this.setQuestionActionFocusIndex(nextIndex);
    return true;
  }

  private focusQuestionActionsStart(): boolean {
    const actions = this.getActiveQuestionActionButtons();
    if (actions.length === 0) {
      return false;
    }
    this.setQuestionActionFocusIndex(0);
    return true;
  }

  private activateFocusedQuestionAction(): boolean {
    const action = this.getActiveQuestionActionButton();
    if (!action) {
      return false;
    }
    if (action === "cancel") {
      this.cancelActivePrompt();
      return true;
    }
    if (action === "confirm") {
      if (this.activeQuestionIsPickupDialog) {
        this.confirmPickupChoices();
      } else {
        this.confirmQuestionMenuChoice();
      }
      return true;
    }
    return false;
  }

  private normalizeActiveQuestionMenuFocusIndex(): void {
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      this.activeQuestionMenuFocusIndex = 0;
      return;
    }

    if (
      !Number.isInteger(this.activeQuestionMenuFocusIndex) ||
      this.activeQuestionMenuFocusIndex < 0 ||
      this.activeQuestionMenuFocusIndex >= selectableItems.length
    ) {
      this.activeQuestionMenuFocusIndex = 0;
    }
  }

  private getActiveQuestionMenuSelectionInput(): string | null {
    if (
      this.activeQuestionIsPickupDialog ||
      this.activeQuestionMenuItems.length === 0
    ) {
      return null;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return null;
    }

    this.normalizeActiveQuestionMenuFocusIndex();
    const focusedItem = selectableItems[this.activeQuestionMenuFocusIndex];
    const selectionInput = this.getQuestionMenuSelectionInput(focusedItem);
    return typeof selectionInput === "string" && selectionInput.length > 0
      ? selectionInput
      : null;
  }

  private setActiveQuestionMenuFocusBySelectionInput(
    selectionInput: string,
  ): void {
    if (typeof selectionInput !== "string" || selectionInput.length === 0) {
      return;
    }
    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    const index = selectableItems.findIndex((item) => {
      return this.getQuestionMenuSelectionInput(item) === selectionInput;
    });
    if (index >= 0) {
      this.activeQuestionMenuFocusIndex = index;
      this.clearQuestionActionFocus();
    }
  }

  private updateQuestionMenuFocusVisualState(): void {
    this.syncQuestionDialogState();
  }

  private moveQuestionMenuFocus(delta: number): void {
    if (
      this.activeQuestionIsPickupDialog ||
      this.activeQuestionMenuItems.length === 0 ||
      delta === 0
    ) {
      return;
    }

    const selectableItems = this.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length === 0) {
      return;
    }

    this.normalizeActiveQuestionMenuFocusIndex();
    this.clearQuestionActionFocus();
    const itemCount = selectableItems.length;
    const nextIndex =
      (((this.activeQuestionMenuFocusIndex + delta) % itemCount) + itemCount) %
      itemCount;
    this.activeQuestionMenuFocusIndex = nextIndex;
    this.updateQuestionMenuFocusVisualState();
  }

  private confirmActiveQuestionMenuChoice(): void {
    if (
      !this.isInQuestion ||
      this.activeQuestionIsPickupDialog ||
      this.activeQuestionMenuItems.length === 0
    ) {
      return;
    }

    const selectionInput = this.getActiveQuestionMenuSelectionInput();
    if (!selectionInput) {
      return;
    }

    const selectedItem =
      this.findActiveMenuItemBySelectionInput(selectionInput);
    if (!selectedItem) {
      return;
    }

    this.sendInput(this.getQuestionMenuSelectionInput(selectedItem));
    this.hideQuestion();
  }

  private rebuildActiveQuestionMenuPagination(): void {
    this.activeQuestionVisibleMenuItems = [];
    this.activeQuestionPageSelectionMap.clear();
    this.activeQuestionMenuPageCount = 1;
    this.activeQuestionMenuPageIndex = Math.max(
      0,
      this.activeQuestionMenuPageIndex,
    );
    this.activeQuestionActionFocusIndex = -1;
    if (this.activeQuestionIsPickupDialog) {
      this.activeQuestionMenuFocusIndex = 0;
    } else {
      this.activePickupFocusIndex = 0;
    }

    if (
      !Array.isArray(this.activeQuestionMenuItems) ||
      this.activeQuestionMenuItems.length === 0
    ) {
      this.activePickupFocusIndex = 0;
      this.activeQuestionMenuFocusIndex = 0;
      this.activeQuestionActionFocusIndex = -1;
      return;
    }

    const selectableItems = this.activeQuestionMenuItems.filter((item) =>
      this.isSelectableQuestionMenuItem(item),
    );
    if (selectableItems.length === 0) {
      this.activeQuestionVisibleMenuItems = [...this.activeQuestionMenuItems];
      this.activeQuestionMenuPageIndex = 0;
      this.activePickupFocusIndex = 0;
      this.activeQuestionMenuFocusIndex = 0;
      this.activeQuestionActionFocusIndex = -1;
      return;
    }

    const pageSize = this.questionMenuPageAccelerators.length;
    const pageCount = Math.ceil(selectableItems.length / pageSize);
    this.activeQuestionMenuPageCount = Math.max(1, pageCount);
    this.activeQuestionMenuPageIndex = Math.min(
      this.activeQuestionMenuPageIndex,
      this.activeQuestionMenuPageCount - 1,
    );

    const startSelectable = this.activeQuestionMenuPageIndex * pageSize;
    const endSelectable = startSelectable + pageSize;
    let selectableSeen = 0;
    let selectableInPage = 0;
    let pendingCategoryRows: any[] = [];
    let categoryRowsInjected = false;
    let lastItemWasSelectable = false;

    for (const menuItem of this.activeQuestionMenuItems) {
      if (!this.isSelectableQuestionMenuItem(menuItem)) {
        if (lastItemWasSelectable) {
          pendingCategoryRows = [];
        }
        pendingCategoryRows.push(menuItem);
        categoryRowsInjected = false;
        lastItemWasSelectable = false;
        continue;
      }

      const selectableIndex = selectableSeen;
      selectableSeen += 1;
      lastItemWasSelectable = true;
      if (
        selectableIndex < startSelectable ||
        selectableIndex >= endSelectable
      ) {
        continue;
      }

      if (!categoryRowsInjected && pendingCategoryRows.length > 0) {
        for (const categoryRow of pendingCategoryRows) {
          this.activeQuestionVisibleMenuItems.push({ ...categoryRow });
        }
        categoryRowsInjected = true;
      }

      const gameAccelerator =
        typeof menuItem.accelerator === "string" ? menuItem.accelerator : "";
      const fallbackAccelerator =
        this.questionMenuPageAccelerators[selectableInPage] ?? "?";
      const trimmedGameAccelerator = gameAccelerator.trim();
      const hasUsableGameAccelerator =
        trimmedGameAccelerator.length > 0 && trimmedGameAccelerator !== "?";
      const displayAccelerator = hasUsableGameAccelerator
        ? gameAccelerator
        : fallbackAccelerator;
      const selectionInput = this.getQuestionMenuSelectionInput(menuItem);

      this.activeQuestionVisibleMenuItems.push({
        ...menuItem,
        accelerator: displayAccelerator,
        originalAccelerator: gameAccelerator,
        selectionInput,
      });
      this.activeQuestionPageSelectionMap.set(
        displayAccelerator,
        selectionInput,
      );
      selectableInPage += 1;
    }

    if (this.activeQuestionIsPickupDialog) {
      this.normalizeActivePickupFocusIndex();
      this.activeQuestionMenuFocusIndex = 0;
      this.activeQuestionActionFocusIndex = -1;
    } else {
      this.activePickupFocusIndex = 0;
      this.normalizeActiveQuestionMenuFocusIndex();
      this.activeQuestionActionFocusIndex = -1;
    }
  }

  private resolveQuestionSelectionInput(input: string): string {
    if (typeof input !== "string" || input.length === 0) {
      return "";
    }
    const mapped = this.activeQuestionPageSelectionMap.get(input);
    if (typeof mapped === "string" && mapped.length > 0) {
      return mapped;
    }
    return input;
  }

  private resolveQuestionSelectionInputForKeyPress(key: string): string | null {
    if (typeof key !== "string" || key.length === 0) {
      return null;
    }
    if (this.activeQuestionMenuItems.length === 0) {
      return key;
    }
    const mapped = this.activeQuestionPageSelectionMap.get(key);
    return typeof mapped === "string" && mapped.length > 0 ? mapped : null;
  }

  public goToPreviousQuestionMenuPage(): void {
    this.changeQuestionMenuPage(-1);
  }

  public goToNextQuestionMenuPage(): void {
    this.changeQuestionMenuPage(1);
  }

  private changeQuestionMenuPage(delta: number): void {
    if (
      !this.isInQuestion ||
      this.activeQuestionMenuItems.length === 0 ||
      this.activeQuestionMenuPageCount <= 1
    ) {
      return;
    }
    const nextPage = Math.max(
      0,
      Math.min(
        this.activeQuestionMenuPageCount - 1,
        this.activeQuestionMenuPageIndex + delta,
      ),
    );
    if (nextPage === this.activeQuestionMenuPageIndex) {
      return;
    }
    this.activeQuestionMenuPageIndex = nextPage;
    this.rebuildActiveQuestionMenuPagination();
    this.syncQuestionDialogState();
  }

  private setActiveQuestionState(
    question: string,
    choices: string,
    defaultChoice: string,
    menuItems: any[],
  ): void {
    this.activeQuestionText = question || "";
    this.activeQuestionChoices = choices || "";
    this.activeQuestionDefaultChoice = defaultChoice || "";
    this.activeQuestionMenuItems = Array.isArray(menuItems)
      ? [...menuItems]
      : [];
    this.activeQuestionIsPickupDialog =
      this.activeQuestionMenuItems.length > 0 &&
      this.isMultiSelectLootQuestion(this.activeQuestionText);
    this.activePickupSelections.clear();
    this.activePickupFocusIndex = 0;
    this.activeQuestionMenuFocusIndex = 0;
    this.activeQuestionActionFocusIndex = -1;
    this.activeQuestionMenuPageIndex = 0;
    this.rebuildActiveQuestionMenuPagination();
  }

  private showQuestion(
    question: string,
    choices: string,
    defaultChoice: string,
    menuItems: any[],
  ): void {
    this.setActiveQuestionState(question, choices, defaultChoice, menuItems);
    this.syncFpsPointerLockForUiState(false);
    this.syncQuestionDialogState();
  }

  private syncQuestionDialogState(): void {
    if (!this.isInQuestion) {
      this.uiAdapter.setQuestion(null);
      return;
    }

    const selectedAccelerators = this.activeQuestionVisibleMenuItems
      .filter((item) => {
        if (!this.isSelectableQuestionMenuItem(item)) {
          return false;
        }
        const selectionKey = this.getMenuSelectionStateKey(item);
        return this.activePickupSelections.has(selectionKey);
      })
      .map((item) =>
        typeof item.accelerator === "string" ? item.accelerator : "",
      )
      .filter((value) => value.length > 0);
    const activeActionButton = this.getActiveQuestionActionButton();
    const activeMenuSelectionInput =
      this.activeQuestionMenuItems.length > 0 && !activeActionButton
        ? this.activeQuestionIsPickupDialog
          ? this.getActivePickupSelectionInput()
          : this.getActiveQuestionMenuSelectionInput()
        : null;

    const state: QuestionDialogState = {
      text: this.activeQuestionText,
      choices: this.activeQuestionChoices,
      defaultChoice: this.activeQuestionDefaultChoice,
      menuItems: [...this.activeQuestionVisibleMenuItems],
      isPickupDialog: this.activeQuestionIsPickupDialog,
      selectedAccelerators,
      activePickupSelectionInput: this.activeQuestionIsPickupDialog
        ? activeMenuSelectionInput
        : null,
      activeMenuSelectionInput,
      activeActionButton,
      menuPageIndex: this.activeQuestionMenuPageIndex,
      menuPageCount: this.activeQuestionMenuPageCount,
    };
    this.uiAdapter.setQuestion(state);
  }

  private showDirectionQuestion(question: string): void {
    this.isInDirectionQuestion = true;
    this.syncFpsPointerLockForUiState(this.isFpsMode());
    this.uiAdapter.setDirectionQuestion(question);
  }

  private hideDirectionQuestion(): void {
    this.isInDirectionQuestion = false;
    this.isInQuestion = false;
    this.clearFpsFireSuppression();
    this.uiAdapter.setDirectionQuestion(null);
    this.syncFpsPointerLockForUiState(true);
  }

  private showInfoMenuDialog(title: string, lines: string[]): void {
    this.isInfoDialogVisible = true;
    this.syncFpsPointerLockForUiState(false);
    const normalizedLines = this.normalizeInfoMenuLines(lines);
    this.uiAdapter.setInfoMenu({
      title: title || "NetHack Information",
      lines: normalizedLines,
    });
  }

  private hideInfoMenuDialog(): void {
    this.isInfoDialogVisible = false;
    this.uiAdapter.setInfoMenu(null);
    this.syncFpsPointerLockForUiState(true);
  }

  private toggleInfoMenuDialog(): void {
    if (this.isInfoDialogVisible) {
      this.hideInfoMenuDialog();
      return;
    }

    if (this.lastInfoMenu) {
      this.showInfoMenuDialog(this.lastInfoMenu.title, this.lastInfoMenu.lines);
    } else {
      this.addGameMessage("No recent information panel to reopen.");
    }
  }

  private showInventoryDialog(options?: InventoryDialogOptions): void {
    this.isInventoryDialogVisible = true;
    const shouldDisableForGameOver = this.gameOverState.active;
    this.inventoryContextActionsEnabled = shouldDisableForGameOver
      ? false
      : options?.contextActionsEnabled !== false;
    this.pendingInventoryDialogOptions = null;
    this.syncFpsPointerLockForUiState(false);
    this.uiAdapter.setInventory(this.buildInventoryDialogState());
  }

  private hideInventoryDialog(): void {
    this.isInventoryDialogVisible = false;
    this.pendingInventoryContextPromptCloseRequestedAtMs = 0;
    this.inventoryContextActionsEnabled = true;
    this.pendingInventoryDialogOptions = null;
    this.uiAdapter.setInventory(this.buildInventoryDialogState());
    this.pendingInventoryDialog = false;
    this.syncFpsPointerLockForUiState(true);
  }

  private toggleInventoryDialogState(): void {
    if (
      this.isInQuestion ||
      this.isInDirectionQuestion ||
      this.positionInputModeActive ||
      this.metaCommandModeActive
    ) {
      return;
    }

    this.hideInfoMenuDialog();
    if (this.isInventoryDialogOpen()) {
      console.log("Closing inventory dialog");
      this.hideInventoryDialog();
      return;
    }

    console.log("Requesting current inventory from NetHack...");
    this.inventoryRefreshInFlight = true;
    this.sendInput("i");
    this.pendingInventoryDialog = true;
  }

  private showPositionRequest(text: string): void {
    if (this.positionHideTimerId !== null) {
      window.clearTimeout(this.positionHideTimerId);
      this.positionHideTimerId = null;
    }

    this.syncFpsPointerLockForUiState(false);
    this.uiAdapter.setPositionRequest(text);
    this.positionHideTimerId = window.setTimeout(() => {
      this.uiAdapter.setPositionRequest(null);
      this.syncFpsPointerLockForUiState(true);
    }, 3000);
  }

  private showTextInputRequest(text: string, maxLength = 256): void {
    this.isInQuestion = true;
    this.isTextInputActive = true;
    this.syncFpsPointerLockForUiState(false);
    this.uiAdapter.setTextInput({
      text: String(text || ""),
      maxLength,
      placeholder: "Enter text",
    });
  }

  private hideTextInputRequest(): void {
    if (!this.isTextInputActive) {
      return;
    }

    this.isTextInputActive = false;
    this.isInQuestion = false;
    this.uiAdapter.setTextInput(null);
    this.syncFpsPointerLockForUiState(true);
  }

  private hideQuestion(): void {
    this.isInQuestion = false;
    this.activeQuestionText = "";
    this.activeQuestionChoices = "";
    this.activeQuestionDefaultChoice = "";
    this.activeQuestionMenuItems = [];
    this.activeQuestionVisibleMenuItems = [];
    this.activeQuestionMenuPageIndex = 0;
    this.activeQuestionMenuPageCount = 1;
    this.activeQuestionPageSelectionMap.clear();
    this.activeQuestionIsPickupDialog = false;
    this.activePickupSelections.clear();
    this.activePickupFocusIndex = 0;
    this.activeQuestionMenuFocusIndex = 0;
    this.activeQuestionActionFocusIndex = -1;
    this.uiAdapter.setQuestion(null);
    this.syncFpsPointerLockForUiState(true);
  }

  private decodeMenuSelectionIndexFromInput(input: string): number | null {
    if (
      typeof input !== "string" ||
      !input.startsWith(this.menuSelectionInputPrefix)
    ) {
      return null;
    }
    const raw = input.slice(this.menuSelectionInputPrefix.length).trim();
    if (!/^-?\d+$/.test(raw)) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }

  private getMenuSelectionInput(item: any, fallbackInput = ""): string {
    if (item && Number.isInteger(item.menuIndex)) {
      return `${this.menuSelectionInputPrefix}${item.menuIndex}`;
    }
    if (item && typeof item.accelerator === "string" && item.accelerator) {
      return item.accelerator;
    }
    return fallbackInput;
  }

  private getMenuSelectionStateKey(item: any): string {
    if (item && Number.isInteger(item.menuIndex)) {
      return `menu-index:${item.menuIndex}`;
    }
    const originalAccelerator =
      item && typeof item.originalAccelerator === "string"
        ? item.originalAccelerator
        : "";
    const accelerator =
      item && typeof item.accelerator === "string" ? item.accelerator : "";
    const stableAccelerator = originalAccelerator || accelerator;
    return `accelerator:${stableAccelerator}`;
  }

  private findActiveMenuItemBySelectionInput(input: string): any | null {
    const menuIndex = this.decodeMenuSelectionIndexFromInput(input);
    if (Number.isInteger(menuIndex)) {
      const indexed = this.activeQuestionMenuItems.find(
        (item) =>
          item &&
          !item.isCategory &&
          Number.isInteger(item.menuIndex) &&
          item.menuIndex === menuIndex,
      );
      if (indexed) {
        return indexed;
      }
    }
    return this.findActiveMenuItemByAccelerator(input);
  }

  private findActiveMenuItemByAccelerator(input: string): any | null {
    if (typeof input !== "string" || input.length === 0) {
      return null;
    }

    const exact = this.activeQuestionMenuItems.find(
      (item) => item && !item.isCategory && item.accelerator === input,
    );
    if (exact) {
      return exact;
    }

    const lower = input.toLowerCase();
    return (
      this.activeQuestionMenuItems.find((item) => {
        if (!item || item.isCategory || typeof item.accelerator !== "string") {
          return false;
        }
        return item.accelerator.toLowerCase() === lower;
      }) ?? null
    );
  }

  private togglePickupSelection(
    selectionInput: string,
    shouldSendInput: boolean,
  ): void {
    const menuItem = this.findActiveMenuItemBySelectionInput(selectionInput);
    if (!menuItem) {
      return;
    }

    const selectionKey = this.getMenuSelectionStateKey(menuItem);
    const canonicalSelectionInput =
      this.getQuestionMenuSelectionInput(menuItem);
    this.setActivePickupFocusBySelectionInput(canonicalSelectionInput);

    if (this.activePickupSelections.has(selectionKey)) {
      this.activePickupSelections.delete(selectionKey);
    } else {
      this.activePickupSelections.add(selectionKey);
    }

    if (shouldSendInput) {
      this.sendInput(canonicalSelectionInput);
    }
    this.updatePickupFocusVisualState();
  }

  public chooseDirection(directionKey: string): void {
    if (!this.isInDirectionQuestion || !directionKey) {
      return;
    }
    this.submitDirectionAnswer(directionKey);
  }

  public chooseQuestionChoice(choice: string): void {
    if (!this.isInQuestion || !choice) {
      return;
    }
    const resolvedChoice = this.resolveQuestionSelectionInput(choice);
    this.updateNumberPadModeFromChoice(resolvedChoice);

    if (this.activeQuestionIsPickupDialog) {
      this.togglePickupSelection(resolvedChoice, true);
      return;
    }

    const selectedItem =
      this.findActiveMenuItemBySelectionInput(resolvedChoice);
    if (selectedItem) {
      const selectionInput = this.getQuestionMenuSelectionInput(selectedItem);
      this.setActiveQuestionMenuFocusBySelectionInput(selectionInput);
      this.sendInput(selectionInput);
      this.hideQuestion();
      return;
    }

    if (this.activeQuestionMenuItems.length > 0) {
      return;
    }

    this.sendInput(resolvedChoice);
    this.hideQuestion();
  }

  public confirmQuestionMenuChoice(): void {
    this.confirmActiveQuestionMenuChoice();
  }

  public togglePickupChoice(accelerator: string): void {
    if (!this.isInQuestion || !this.activeQuestionIsPickupDialog) {
      return;
    }
    const resolvedInput = this.resolveQuestionSelectionInput(accelerator);
    const menuItem = this.findActiveMenuItemBySelectionInput(resolvedInput);
    if (!menuItem) {
      return;
    }
    this.togglePickupSelection(
      this.getQuestionMenuSelectionInput(menuItem),
      true,
    );
  }

  public confirmPickupChoices(): void {
    if (!this.isInQuestion || !this.activeQuestionIsPickupDialog) {
      return;
    }
    this.sendInput("Enter");
    this.requestPlayerTileRefresh("pickup-confirm");
    this.hideQuestion();
  }

  public submitTextInput(text: string): void {
    if (!this.session) {
      this.hideTextInputRequest();
      return;
    }
    const normalized = typeof text === "string" ? text : String(text ?? "");
    this.sendInput(`${this.textInputPrefix}${normalized}`);
    this.hideTextInputRequest();
  }

  public cancelActivePrompt(): void {
    if (this.isTextInputActive) {
      this.submitTextInput("");
      return;
    }
    if (this.isInQuestion || this.isInDirectionQuestion) {
      this.sendInput("Escape");
    }
    this.hideQuestion();
    this.hideDirectionQuestion();
  }

  public toggleInventoryDialog(): void {
    this.toggleInventoryDialogState();
  }

  public runInventoryItemAction(
    actionId: string,
    itemAccelerator: string,
  ): void {
    const normalizedActionId = String(actionId || "")
      .trim()
      .toLowerCase();
    const accelerator = String(itemAccelerator || "").trim();
    if (!this.session || !normalizedActionId || accelerator.length !== 1) {
      return;
    }

    const commandMap: Record<string, string> = {
      apply: "a",
      drop: "d",
      eat: "e",
      quaff: "q",
      read: "r",
      throw: "t",
      wield: "w",
      unwield: "w",
      wear: "W",
      "take-off": "T",
      "put-on": "P",
      remove: "R",
      zap: "z",
      cast: "Z",
    };

    const commandKey = commandMap[normalizedActionId];
    if (!commandKey) {
      return;
    }

    this.hideInfoMenuDialog();
    this.clearRepeatableAction();
    this.clearRepeatDirectionCandidate();
    this.hideInventoryDialog();
    if (normalizedActionId === "unwield") {
      this.sendInputSequence([`${this.inventoryContextSelectionPrefix}-`, "w"]);
      this.queueRepeatDirectionCandidate({
        kind: "inventory_command",
        value: "w",
      });
      return;
    }

    this.sendInputSequence([
      `${this.inventoryContextSelectionPrefix}${accelerator}`,
      commandKey,
    ]);
    this.queueRepeatDirectionCandidate({
      kind: "inventory_command",
      value: commandKey,
    });
  }

  public dismissFpsCrosshairContextMenu(): void {
    if (this.normalTileContextMenuOpen || this.normalTileContextSignature) {
      this.closeNormalTileContextMenu(true);
      return;
    }
    this.closeAnyTileContextMenu(true);
  }

  public runQuickAction(
    actionId: string,
    options?: { autoDirectionFromFpsAim?: boolean; submitDelayMs?: number },
  ): void {
    const normalizedActionId = String(actionId || "")
      .trim()
      .toLowerCase();
    this.executeQuickAction(
      normalizedActionId,
      true,
      Boolean(options?.autoDirectionFromFpsAim),
      Number.isFinite(options?.submitDelayMs)
        ? Number(options?.submitDelayMs)
        : 0,
    );
  }

  public runExtendedCommand(
    commandText: string,
    options?: { autoDirectionFromFpsAim?: boolean; submitDelayMs?: number },
  ): void {
    const normalizedCommandText = String(commandText || "")
      .trim()
      .toLowerCase();
    this.executeExtendedCommand(
      normalizedCommandText,
      true,
      Boolean(options?.autoDirectionFromFpsAim),
      Number.isFinite(options?.submitDelayMs)
        ? Number(options?.submitDelayMs)
        : 0,
    );
  }

  public repeatLastAction(): void {
    if (!this.repeatActionVisible || !this.repeatableAction) {
      return;
    }

    let didExecute = false;
    switch (this.repeatableAction.kind) {
      case "quick":
        didExecute = this.executeQuickAction(
          this.repeatableAction.value,
          false,
        );
        break;
      case "extended":
        didExecute = this.executeExtendedCommand(
          this.repeatableAction.value,
          false,
        );
        break;
      case "inventory_command":
        didExecute = this.executeInventoryCommandWithoutSelection(
          this.repeatableAction.value,
          false,
        );
        break;
      default:
        didExecute = false;
        break;
    }

    if (didExecute) {
      this.repeatAutoDirectionPending = true;
      this.repeatAutoDirectionArmedAtMs = Date.now();
    }
  }

  public setClientOptions(options: Nh3dClientOptions): void {
    this.applyClientOptions(options);
  }

  public closeInventoryDialog(): void {
    this.hideInventoryDialog();
  }

  public closeInfoMenuDialog(): void {
    this.hideInfoMenuDialog();
  }

  public async enterVr(): Promise<void> {
    await this.vrSessionController?.enter(this.clientOptions);
  }

  public async exitVr(): Promise<void> {
    await this.vrSessionController?.exit();
  }

  public async toggleVr(): Promise<void> {
    await this.vrSessionController?.toggle(this.clientOptions);
  }

  public toggleVrQuickPanel(): void {
    this.vrSessionController?.toggleQuickPanel();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.vrSessionController?.dispose();
    this.vrSessionController = null;
    this.renderer.setAnimationLoop(null);
    this.clearPointerLockForVr();
    this.session?.destroy();
    this.session = null;
    this.setVrQuickPanelVisibleState(false);
    this.disposeAntialiasingPipeline();
    this.disposeLightingOverlay();
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }

  private setVrHoveredTile(target: VrTileTarget | null): void {
    this.vrHoveredTile = target
      ? {
          key: target.key,
          x: target.x,
          y: target.y,
          mesh: target.mesh,
        }
      : null;
  }

  private runVrPrimaryAction(target: VrTileTarget): void {
    if (!this.session) {
      return;
    }

    if (this.isInDirectionQuestion) {
      const dx = target.x - this.playerPos.x;
      const dy = target.y - this.playerPos.y;
      if (dx === 0 && dy === 0) {
        this.submitDirectionAnswer("s");
        return;
      }
      const direction = this.resolveDirectionFromDelta(dx, dy);
      if (direction) {
        this.submitDirectionAnswer(direction);
      }
      return;
    }

    if (
      this.isInQuestion ||
      this.isTextInputActive ||
      this.positionInputModeActive ||
      this.metaCommandModeActive ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen() ||
      this.isAnyModalVisible()
    ) {
      return;
    }

    if (!this.isFpsMode()) {
      if (!this.hasPlayerMovedOnce) {
        this.lastMovementInputAtMs = Date.now();
      }
      this.updateDirectionalAttackContextFromTarget(target.x, target.y);
      this.setPendingPointerAttackTargetFromTile(target.x, target.y);
      this.logClickLookTileDebug("vr-primary", target.x, target.y);
      this.sendMouseInput(target.x, target.y, 0);
      return;
    }

    this.activeContextActionTile = { x: target.x, y: target.y };
    if (this.tryRunVrFpsSelfTilePrimaryAction(target)) {
      return;
    }
    if (this.tryRunVrFpsDoorPrimaryAction(target)) {
      return;
    }

    const direction = this.resolveDirectionFromDelta(
      target.x - this.playerPos.x,
      target.y - this.playerPos.y,
    );
    if (direction) {
      this.armContextAutoDirection(direction);
    }
    this.armFpsFireSuppression();
    this.fpsAimLinePulseUntilMs = Date.now() + 220;
    this.sendInput("f");
  }

  private runVrSecondaryAction(target: VrTileTarget): void {
    if (
      this.isInQuestion ||
      this.isTextInputActive ||
      this.positionInputModeActive ||
      this.metaCommandModeActive ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen() ||
      this.isAnyModalVisible()
    ) {
      return;
    }

    if (this.isFpsMode()) {
      this.openVrTileContextMenuAtTarget(target);
      return;
    }
    this.openNormalTileContextMenuAtTarget(target);
  }

  private tryRunVrFpsSelfTilePrimaryAction(target: VrTileTarget): boolean {
    if (
      target.x !== this.playerPos.x ||
      target.y !== this.playerPos.y
    ) {
      return false;
    }

    const nowMs = Date.now();
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(target.key, nowMs);
    const glanceText = glanceEntry?.sourceText ?? "";
    const normalizedGlanceText = glanceText.toLowerCase();
    const isContainerLikeLoot =
      /\b(chest|box|coffer|container|sack|bag)\b/.test(normalizedGlanceText);
    const actions = this.getFpsCrosshairActionsForTile(
      target.key,
      target.mesh,
      glanceEntry?.hint ?? null,
      glanceText,
    );
    const hasQuickAction = (id: string): boolean =>
      actions.some((action) => action.kind === "quick" && action.id === id);

    let actionId: string | null = null;
    if (hasQuickAction("ascend")) {
      actionId = "ascend";
    } else if (hasQuickAction("descend")) {
      actionId = "descend";
    } else if (isContainerLikeLoot && hasQuickAction("loot")) {
      actionId = "loot";
    } else if (hasQuickAction("pickup")) {
      actionId = "pickup";
    }

    return actionId ? this.executeQuickAction(actionId, true) : false;
  }

  private tryRunVrFpsDoorPrimaryAction(target: VrTileTarget): boolean {
    const dx = target.x - this.playerPos.x;
    const dy = target.y - this.playerPos.y;
    if (
      (dx === 0 && dy === 0) ||
      Math.abs(dx) > 1 ||
      Math.abs(dy) > 1
    ) {
      return false;
    }

    const nowMs = Date.now();
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(target.key, nowMs);
    const glanceHint = glanceEntry?.hint ?? null;
    const materialKind =
      typeof target.mesh.userData?.materialKind === "string"
        ? target.mesh.userData.materialKind
        : "";
    if (materialKind !== "door" && glanceHint !== "door") {
      return false;
    }

    return this.executeQuickAction("open", true);
  }

  private isLikelyNameInputForDebug(input: string): boolean {
    const trimmed = String(input || "").trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      return false;
    }
    if (trimmed.startsWith("__") || trimmed.includes(":")) {
      return false;
    }
    if (!/^[A-Za-z][A-Za-z0-9 _'-]*$/.test(trimmed)) {
      return false;
    }
    const nonNameTokens = new Set([
      "Enter",
      "Escape",
      "Space",
      "Spacebar",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Backspace",
      "Tab",
    ]);
    return !nonNameTokens.has(trimmed);
  }

  private logNameInputTrace(input: string): void {
    if (!this.isLikelyNameInputForDebug(input)) {
      return;
    }

    const stackPreview = (new Error().stack || "")
      .split("\n")
      .slice(2, 7)
      .map((line) => line.trim());
    console.log("[NAME_DEBUG] Engine sendInput(name-like)", {
      input,
      isInQuestion: this.isInQuestion,
      isInDirectionQuestion: this.isInDirectionQuestion,
      positionInputModeActive: this.positionInputModeActive,
      metaCommandModeActive: this.metaCommandModeActive,
      hasSession: Boolean(this.session),
      stackPreview,
    });
  }

  public sendInput(
    input: string,
    options: { keepContextMenuOpen?: boolean; delayMs?: number } = {},
  ): void {
    this.logNameInputTrace(input);
    this.pendingPointerAttackTargetContext = null;
    if (!options.keepContextMenuOpen) {
      this.closeAnyTileContextMenu(false);
    }
    const resolvedInput = input;

    if (this.isMovementInput(resolvedInput)) {
      this.lastManualDirectionalInputAtMs = Date.now();
      this.fpsAutoMoveDirection = null;
      this.fpsAutoTurnTargetYaw = null;
      this.armPendingPlayerFootstepSound();
      if (this.isRunMovementInput(resolvedInput)) {
        this.armPlayerCliparoundInputCooldown();
      } else if (this.isNumpadRunPrefixInput(resolvedInput)) {
        this.armPlayerCliparoundInputCooldown();
      }
    }

    if (
      !this.hasPlayerMovedOnce &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      this.isMovementInput(resolvedInput)
    ) {
      this.lastMovementInputAtMs = Date.now();
    }

    this.updateDirectionalAttackContext(resolvedInput);

    if (
      resolvedInput === "," &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      !this.positionInputModeActive
    ) {
      this.requestPlayerTileRefresh("pickup-input");
    }

    if (this.session) {
      this.beginDarkCorridorDiscoveryWindowFromPlayerInput();
      // Workaround for a race condition in contextual command handling.
      // TODO: remove once the underlying ordering issue is fixed.
      this.session.sendInput(resolvedInput, { delayMs: options.delayMs });
    }
  }

  private sendInputSequence(
    inputs: string[],
    options: { keepContextMenuOpen?: boolean; delayMs?: number } = {},
  ): void {
    if (!this.session || inputs.length === 0) {
      return;
    }
    this.pendingPointerAttackTargetContext = null;
    if (!options.keepContextMenuOpen) {
      this.closeAnyTileContextMenu(false);
    }

    const nowMs = Date.now();
    let hasMovementInput = false;
    for (const input of inputs) {
      if (this.isMovementInput(input)) {
        this.lastManualDirectionalInputAtMs = nowMs;
        this.fpsAutoMoveDirection = null;
        this.fpsAutoTurnTargetYaw = null;
        hasMovementInput = true;
        break;
      }
    }
    const hasRunPrefixInput = inputs.some((entry) =>
      this.isRunPrefixInput(entry),
    );
    if (hasMovementInput) {
      this.armPendingPlayerFootstepSound();
      if (hasRunPrefixInput) {
        this.armPlayerCliparoundInputCooldown();
      }
    }

    this.beginDarkCorridorDiscoveryWindowFromPlayerInput();
    // Workaround for a race condition in contextual command handling.
    // TODO: remove once the underlying ordering issue is fixed.
    this.session.sendInputSequence(inputs, { delayMs: options.delayMs });
  }

  private sendForcedDirectionalInput(direction: string): void {
    if (!direction) {
      return;
    }
    this.updateDirectionalAttackContext(direction);
    this.armPlayerCliparoundInputCooldown();
    this.sendInputSequence(["5", direction]);
  }

  private logClickLookTileDebug(source: string, x: number, y: number): void {
    const key = `${x},${y}`;
    const signature = this.tileStateCache.get(key);
    const parsed = signature ? this.parseTileStateSignature(signature) : null;
    const mesh = this.tileMap.get(key) ?? null;
    const tileId =
      typeof mesh?.userData?.tileIndex === "number"
        ? mesh.userData.tileIndex
        : null;
    const glyph = parsed?.glyph ?? null;
    console.log(
      `[clicklook:${source}] tile=${key} glyph=${glyph ?? "unknown"} tileId=${tileId ?? "unknown"}`,
    );
  }

  private sendMouseInput(
    x: number,
    y: number,
    button: number,
    options: { keepContextMenuOpen?: boolean } = {},
  ): void {
    if (!this.session) {
      return;
    }
    if (!options.keepContextMenuOpen) {
      this.closeAnyTileContextMenu(false);
    }
    if (this.shouldArmPlayerFootstepFromMouseInput(x, y, button)) {
      this.armPendingPlayerFootstepSound();
      this.armPlayerCliparoundInputCooldown();
    }
    this.beginDarkCorridorDiscoveryWindowFromPlayerInput();
    this.session.sendMouseInput(x, y, button);
  }

  private canStartMetaCommandMode(): boolean {
    return (
      !this.metaCommandModeActive &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      !this.positionInputModeActive &&
      !this.isInventoryDialogVisible &&
      !this.isInfoDialogVisible
    );
  }

  private isMetaCommandTriggerKey(event: KeyboardEvent): boolean {
    if (event.key === "#") {
      return true;
    }
    return event.shiftKey && event.code === "Digit3";
  }

  private startMetaCommandMode(): void {
    if (!this.canStartMetaCommandMode()) {
      return;
    }
    this.metaCommandModeActive = true;
    this.metaCommandBuffer = "";
    this.updateMetaCommandModal();
  }

  private exitMetaCommandMode(): void {
    if (!this.metaCommandModeActive) {
      return;
    }
    this.metaCommandModeActive = false;
    this.metaCommandBuffer = "";
    this.updateMetaCommandModal();
  }

  private confirmMetaCommandMode(): void {
    if (!this.metaCommandModeActive) {
      return;
    }
    const sequence = ["#", ...this.metaCommandBuffer.split(""), "Enter"];
    this.sendInputSequence(sequence);
    this.exitMetaCommandMode();
  }

  private isMetaCommandLetter(event: KeyboardEvent): boolean {
    return event.key.length === 1 && /^[A-Za-z]$/.test(event.key);
  }

  private handleMetaCommandKeyDown(event: KeyboardEvent): boolean {
    if (!this.metaCommandModeActive) {
      return false;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.exitMetaCommandMode();
      return true;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.confirmMetaCommandMode();
      return true;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      this.metaCommandBuffer = this.metaCommandBuffer.slice(0, -1);
      this.updateMetaCommandModal();
      return true;
    }

    if (this.isMetaCommandLetter(event)) {
      event.preventDefault();
      this.metaCommandBuffer += event.key.toLowerCase();
      this.updateMetaCommandModal();
      return true;
    }

    event.preventDefault();
    return true;
  }

  private isMovementInput(input: string): boolean {
    if (input.length === 1) {
      switch (input) {
        case "h":
        case "j":
        case "k":
        case "l":
        case "y":
        case "u":
        case "b":
        case "n":
        case "H":
        case "J":
        case "K":
        case "L":
        case "Y":
        case "U":
        case "B":
        case "N":
          return !this.numberPadModeEnabled;
        case "1":
        case "2":
        case "3":
        case "4":
        case "6":
        case "7":
        case "8":
        case "9":
          return this.numberPadModeEnabled;
        default:
          return false;
      }
    }

    switch (input) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
      case "Numpad1":
      case "Numpad2":
      case "Numpad3":
      case "Numpad4":
      case "Numpad5":
      case "Numpad6":
      case "Numpad7":
      case "Numpad8":
      case "Numpad9":
        return true;
      default:
        return false;
    }
  }

  private getMovementDeltaFromInput(
    input: string,
  ): { dx: number; dy: number } | null {
    if (!this.isMovementInput(input)) {
      return null;
    }
    switch (input) {
      case "ArrowUp":
      case "Numpad8":
        return { dx: 0, dy: -1 };
      case "ArrowDown":
      case "Numpad2":
        return { dx: 0, dy: 1 };
      case "ArrowLeft":
      case "Numpad4":
        return { dx: -1, dy: 0 };
      case "ArrowRight":
      case "Numpad6":
        return { dx: 1, dy: 0 };
      case "Home":
      case "Numpad7":
        return { dx: -1, dy: -1 };
      case "PageUp":
      case "Numpad9":
        return { dx: 1, dy: -1 };
      case "End":
      case "Numpad1":
        return { dx: -1, dy: 1 };
      case "PageDown":
      case "Numpad3":
        return { dx: 1, dy: 1 };
      default:
        break;
    }

    const normalized = input.toLowerCase();
    switch (normalized) {
      case "k":
      case "8":
        return { dx: 0, dy: -1 };
      case "j":
      case "2":
        return { dx: 0, dy: 1 };
      case "h":
      case "4":
        return { dx: -1, dy: 0 };
      case "l":
      case "6":
        return { dx: 1, dy: 0 };
      case "y":
      case "7":
        return { dx: -1, dy: -1 };
      case "u":
      case "9":
        return { dx: 1, dy: -1 };
      case "b":
      case "1":
        return { dx: -1, dy: 1 };
      case "n":
      case "3":
        return { dx: 1, dy: 1 };
      default:
        return null;
    }
  }

  private canArmPendingPlayerFootstepSound(): boolean {
    return (
      this.clientOptions.soundEnabled &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      !this.positionInputModeActive
    );
  }

  private isRunMovementInput(input: string): boolean {
    return !this.numberPadModeEnabled && /^[HJKLYUBN]$/.test(input);
  }

  private isNumpadRunPrefixInput(input: string): boolean {
    return this.numberPadModeEnabled && input === "Numpad5";
  }

  private isRunPrefixInput(input: string): boolean {
    return input === "5" || this.isNumpadRunPrefixInput(input);
  }

  private armPlayerCliparoundInputCooldown(): void {
    if (!this.session) {
      return;
    }
    this.playerCliparoundInputCooldownUntilMs =
      Date.now() + this.playerCliparoundInputCooldownMs;
  }

  private refreshPlayerCliparoundInputCooldownFromMovement(): void {
    const nowMs = Date.now();
    if (nowMs > this.playerCliparoundInputCooldownUntilMs) {
      return;
    }
    this.playerCliparoundInputCooldownUntilMs =
      nowMs + this.playerCliparoundInputCooldownMs;
  }

  private clearPlayerCliparoundInputCooldown(): void {
    this.playerCliparoundInputCooldownUntilMs = 0;
  }

  private isPlayerCliparoundInputCooldownActive(nowMs: number): boolean {
    return nowMs <= this.playerCliparoundInputCooldownUntilMs;
  }

  private armPendingPlayerFootstepSound(): void {
    if (!this.canArmPendingPlayerFootstepSound()) {
      return;
    }
    this.pendingPlayerFootstepSoundArmed = true;
  }

  private shouldArmPlayerFootstepFromMouseInput(
    x: number,
    y: number,
    button: number,
  ): boolean {
    if (
      button !== 0 ||
      this.isFpsMode() ||
      !this.canArmPendingPlayerFootstepSound()
    ) {
      return false;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return false;
    }
    const tileX = Math.round(x);
    const tileY = Math.round(y);
    const deltaX = Math.abs(tileX - this.playerPos.x);
    const deltaY = Math.abs(tileY - this.playerPos.y);
    return deltaX !== 0 || deltaY !== 0;
  }

  private playPlayerFootstepSoundFromCliparoundIfEligible(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const nowMs = Date.now();
    const hadPendingSound = this.pendingPlayerFootstepSoundArmed;
    this.pendingPlayerFootstepSoundArmed = false;
    if (!this.clientOptions.soundEnabled) {
      return;
    }
    if (fromX === toX && fromY === toY) {
      return;
    }
    if (
      !hadPendingSound &&
      !this.isPlayerCliparoundInputCooldownActive(nowMs)
    ) {
      return;
    }
    this.messageSoundHooks.playPlayerFootstepSound();
  }

  private isInventoryDialogOpen(): boolean {
    return this.isInventoryDialogVisible;
  }

  private isInfoDialogOpen(): boolean {
    return this.isInfoDialogVisible;
  }

  private isSpaceDismissKey(event: KeyboardEvent): boolean {
    return (
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space" ||
      event.code === "Space"
    );
  }

  private getModifiedInput(event: KeyboardEvent): string | null {
    // NetHack meta commands are represented as ESC + key in the runtime bridge.
    const hasMetaModifier = event.altKey || event.metaKey || this.altOrMetaHeld;
    if (!hasMetaModifier) {
      return null;
    }
    if (
      event.key === "Alt" ||
      event.key === "Meta" ||
      event.key === "Control" ||
      event.key === "Shift"
    ) {
      return null;
    }
    const normalizedKey = this.getMetaPrimaryKey(event);
    if (!normalizedKey) {
      return null;
    }
    return `${this.metaInputPrefix}${normalizedKey}`;
  }

  private getMetaPrimaryKey(event: KeyboardEvent): string | null {
    if (event.code.startsWith("Key") && event.code.length === 4) {
      return event.code.slice(3).toLowerCase();
    }
    if (event.code.startsWith("Digit") && event.code.length === 6) {
      return event.code.slice(5);
    }
    if (event.key.length === 1) {
      return event.key.toLowerCase();
    }
    return null;
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key === "Alt" || event.key === "Meta") {
      this.altOrMetaHeld = false;
    }
  }

  private handleWindowBlur(): void {
    this.altOrMetaHeld = false;
    this.clearPlayerCliparoundInputCooldown();
    this.clearFpsTouchGestures();
    this.isMiddleMouseDown = false;
    this.isRightMouseDown = false;
    this.rightMouseCanOpenContextMenuOnRelease = false;
    this.rightMouseDragExceededDeadzone = false;
    this.exitMetaCommandMode();
    this.closeAnyTileContextMenu(false);
    this.stopMinimapDrag();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.fpsPointerLockActive = false;
    this.fpsPointerLockRestorePending = false;
  }

  private normalizeWaitKey(event: KeyboardEvent): string | null {
    if (event.key === ">") {
      return null;
    }
    if (
      event.key === "." ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space" ||
      event.key === "Decimal" ||
      event.key === "NumpadDecimal" ||
      event.code === "NumpadDecimal" ||
      event.code === "Space"
    ) {
      return ".";
    }
    return null;
  }

  private mapArrowKeyToDirectionKey(key: string): string | null {
    switch (key) {
      case "ArrowUp":
        return this.numberPadModeEnabled ? "8" : "k";
      case "ArrowDown":
        return this.numberPadModeEnabled ? "2" : "j";
      case "ArrowLeft":
        return this.numberPadModeEnabled ? "4" : "h";
      case "ArrowRight":
        return this.numberPadModeEnabled ? "6" : "l";
      default:
        return null;
    }
  }

  private mapNavigationKeyToDirectionKey(key: string): string | null {
    switch (key) {
      case "Home":
        return this.numberPadModeEnabled ? "7" : "y";
      case "PageUp":
        return this.numberPadModeEnabled ? "9" : "u";
      case "End":
        return this.numberPadModeEnabled ? "1" : "b";
      case "PageDown":
        return this.numberPadModeEnabled ? "3" : "n";
      default:
        return null;
    }
  }

  private mapNumpadDigitToDirectionKey(digit: string): string | null {
    if (!/^[1-9]$/.test(digit)) {
      return null;
    }
    if (this.numberPadModeEnabled) {
      return digit;
    }
    switch (digit) {
      case "1":
        return "b";
      case "2":
        return "j";
      case "3":
        return "n";
      case "4":
        return "h";
      case "5":
        return ".";
      case "6":
        return "l";
      case "7":
        return "y";
      case "8":
        return "k";
      case "9":
        return "u";
      default:
        return null;
    }
  }

  private mapDirectionalKeyFromNavigationInput(key: string): string | null {
    return (
      this.mapArrowKeyToDirectionKey(key) ||
      this.mapNavigationKeyToDirectionKey(key)
    );
  }

  private resolvePositionInputConfirmKey(event: KeyboardEvent): string | null {
    if (event.key === "Enter") {
      return "Enter";
    }
    if (
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space"
    ) {
      return ".";
    }
    if (
      event.key === "." ||
      event.key === "Decimal" ||
      event.code === "NumpadDecimal"
    ) {
      return ".";
    }
    if (event.key === "s" || event.key === "S") {
      return "s";
    }
    if (event.code === "Numpad5") {
      return this.numberPadModeEnabled ? "5" : ".";
    }
    return null;
  }

  private tryResolvePositionInputMovementKey(
    event: KeyboardEvent,
  ): string | null {
    if (this.isFpsMode()) {
      return this.tryResolveFpsPositionLookInput(event.key, event.code);
    }

    const mappedNav = this.mapDirectionalKeyFromNavigationInput(event.key);
    if (mappedNav) {
      return mappedNav;
    }

    if (event.code.startsWith("Numpad") && /^[1-9]$/.test(event.key)) {
      return this.mapNumpadDigitToDirectionKey(event.key);
    }

    if (this.numberPadModeEnabled && /^[1-9]$/.test(event.key)) {
      return event.key;
    }

    if (!this.numberPadModeEnabled) {
      const lowerKey = event.key.toLowerCase();
      if ("hjklyubn".includes(lowerKey)) {
        return lowerKey;
      }
    }

    return null;
  }

  private cancelPositionInputMode(): void {
    this.sendInput("Escape");
    this.setPositionInputMode(false);
    if (this.positionHideTimerId !== null) {
      window.clearTimeout(this.positionHideTimerId);
      this.positionHideTimerId = null;
    }
    this.uiAdapter.setPositionRequest(null);
  }

  private isFpsMode(): boolean {
    return this.playMode === "fps";
  }

  private getDirectionInputFromMapDelta(dx: number, dy: number): string | null {
    if (dx === 0 && dy === 0) {
      return null;
    }
    if (this.numberPadModeEnabled) {
      if (dx === 0 && dy < 0) return "8";
      if (dx === 0 && dy > 0) return "2";
      if (dx < 0 && dy === 0) return "4";
      if (dx > 0 && dy === 0) return "6";
      if (dx < 0 && dy < 0) return "7";
      if (dx > 0 && dy < 0) return "9";
      if (dx < 0 && dy > 0) return "1";
      if (dx > 0 && dy > 0) return "3";
      return null;
    }

    if (dx === 0 && dy < 0) return "k";
    if (dx === 0 && dy > 0) return "j";
    if (dx < 0 && dy === 0) return "h";
    if (dx > 0 && dy === 0) return "l";
    if (dx < 0 && dy < 0) return "y";
    if (dx > 0 && dy < 0) return "u";
    if (dx < 0 && dy > 0) return "b";
    if (dx > 0 && dy > 0) return "n";
    return null;
  }

  private resolveFpsLookSensitivityScale(axis: "x" | "y"): number {
    const rawValue =
      axis === "x"
        ? this.clientOptions.fpsLookSensitivityX
        : this.clientOptions.fpsLookSensitivityY;
    if (!Number.isFinite(rawValue)) {
      return 1;
    }
    return THREE.MathUtils.clamp(
      rawValue,
      nh3dFpsLookSensitivityMin,
      nh3dFpsLookSensitivityMax,
    );
  }

  private applyFpsLookDelta(
    deltaX: number,
    deltaY: number,
    baseSensitivity: number,
  ): void {
    const sensitivityX =
      baseSensitivity * this.resolveFpsLookSensitivityScale("x");
    const sensitivityY =
      baseSensitivity * this.resolveFpsLookSensitivityScale("y");
    const lookYDirection = this.clientOptions.invertLookYAxis ? -1 : 1;
    this.cameraYaw = this.wrapAngle(this.cameraYaw + deltaX * sensitivityX);
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch - deltaY * sensitivityY * lookYDirection,
      this.firstPersonPitchMin,
      this.firstPersonPitchMax,
    );
  }

  private getFpsAimDirectionFromCamera(): AimDirection | null {
    // FPS movement/fire should follow yaw, even when pitch is looking up/down.
    // Use a nearest-of-8-direction projection with a small diagonal bias so
    // diagonals are easier to target from mouselook.
    const mapForwardX = -Math.sin(this.cameraYaw);
    const mapForwardY = Math.cos(this.cameraYaw);
    const candidates = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: -1, dy: -1 },
    ];

    let bestCandidate = candidates[0];
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const lengthScale =
        candidate.dx !== 0 && candidate.dy !== 0 ? Math.SQRT1_2 : 1;
      const nx = candidate.dx * lengthScale;
      const ny = candidate.dy * lengthScale;
      const diagonalBoost =
        candidate.dx !== 0 && candidate.dy !== 0 ? this.fpsDiagonalAimBias : 0;
      const score = mapForwardX * nx + mapForwardY * ny + diagonalBoost;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    const input = this.getDirectionInputFromMapDelta(
      bestCandidate.dx,
      bestCandidate.dy,
    );
    if (!input) {
      return null;
    }
    return {
      dx: bestCandidate.dx,
      dy: bestCandidate.dy,
      input,
    };
  }

  private resolveFpsRelativeMovementInput(
    aim: AimDirection,
    localRight: -1 | 0 | 1,
    localForward: -1 | 0 | 1,
  ): string | null {
    if (localRight === 0 && localForward === 0) {
      return null;
    }

    // Basis vectors in map-space derived from current FPS aim.
    // forward = aim delta, right = 90deg clockwise from forward.
    const rightX = -aim.dy;
    const rightY = aim.dx;
    const rawDx = aim.dx * localForward + rightX * localRight;
    const rawDy = aim.dy * localForward + rightY * localRight;
    const stepDx = THREE.MathUtils.clamp(Math.sign(rawDx), -1, 1);
    const stepDy = THREE.MathUtils.clamp(Math.sign(rawDy), -1, 1);
    return this.getDirectionInputFromMapDelta(stepDx, stepDy);
  }

  private tryResolveFpsMovementInput(
    key: string,
    code: string = "",
  ): string | null {
    const lower = key.toLowerCase();
    if (this.numberPadModeEnabled && /^[hjklyubn]$/.test(lower)) {
      return null;
    }
    const aim = this.getFpsAimDirectionFromCamera();
    if (!aim) {
      return null;
    }

    if (code.startsWith("Numpad")) {
      switch (code) {
        case "Numpad8":
          return this.resolveFpsRelativeMovementInput(aim, 0, 1);
        case "Numpad2":
          return this.resolveFpsRelativeMovementInput(aim, 0, -1);
        case "Numpad4":
          return this.resolveFpsRelativeMovementInput(aim, -1, 0);
        case "Numpad6":
          return this.resolveFpsRelativeMovementInput(aim, 1, 0);
        case "Numpad7":
          return this.resolveFpsRelativeMovementInput(aim, -1, 1);
        case "Numpad9":
          return this.resolveFpsRelativeMovementInput(aim, 1, 1);
        case "Numpad1":
          return this.resolveFpsRelativeMovementInput(aim, -1, -1);
        case "Numpad3":
          return this.resolveFpsRelativeMovementInput(aim, 1, -1);
        default:
          break;
      }
    }

    switch (lower) {
      case "w":
      case "arrowup":
      case "k":
        return this.resolveFpsRelativeMovementInput(aim, 0, 1);
      case "s":
      case "arrowdown":
      case "j":
        return this.resolveFpsRelativeMovementInput(aim, 0, -1);
      case "a":
      case "arrowleft":
      case "h":
        return this.resolveFpsRelativeMovementInput(aim, -1, 0);
      case "d":
      case "arrowright":
      case "l":
        return this.resolveFpsRelativeMovementInput(aim, 1, 0);
      case "y":
      case "home":
        return this.resolveFpsRelativeMovementInput(aim, -1, 1);
      case "u":
      case "pageup":
        return this.resolveFpsRelativeMovementInput(aim, 1, 1);
      case "b":
      case "end":
        return this.resolveFpsRelativeMovementInput(aim, -1, -1);
      case "n":
      case "pagedown":
        return this.resolveFpsRelativeMovementInput(aim, 1, -1);
      default:
        return null;
    }
  }

  private tryResolveFpsPositionLookInput(
    key: string,
    code: string = "",
  ): string | null {
    const aim = this.getFpsAimDirectionFromCamera();
    if (!aim) {
      return null;
    }

    if (code.startsWith("Numpad")) {
      switch (code) {
        case "Numpad8":
          return this.resolveFpsRelativeMovementInput(aim, 0, 1);
        case "Numpad2":
          return this.resolveFpsRelativeMovementInput(aim, 0, -1);
        case "Numpad4":
          return this.resolveFpsRelativeMovementInput(aim, -1, 0);
        case "Numpad6":
          return this.resolveFpsRelativeMovementInput(aim, 1, 0);
        case "Numpad7":
          return this.resolveFpsRelativeMovementInput(aim, -1, 1);
        case "Numpad9":
          return this.resolveFpsRelativeMovementInput(aim, 1, 1);
        case "Numpad1":
          return this.resolveFpsRelativeMovementInput(aim, -1, -1);
        case "Numpad3":
          return this.resolveFpsRelativeMovementInput(aim, 1, -1);
        default:
          break;
      }
    }

    switch (key.toLowerCase()) {
      case "arrowup":
      case "k":
        return this.resolveFpsRelativeMovementInput(aim, 0, 1);
      case "arrowdown":
      case "j":
        return this.resolveFpsRelativeMovementInput(aim, 0, -1);
      case "arrowleft":
      case "h":
        return this.resolveFpsRelativeMovementInput(aim, -1, 0);
      case "arrowright":
      case "l":
        return this.resolveFpsRelativeMovementInput(aim, 1, 0);
      case "home":
      case "y":
        return this.resolveFpsRelativeMovementInput(aim, -1, 1);
      case "pageup":
      case "u":
        return this.resolveFpsRelativeMovementInput(aim, 1, 1);
      case "end":
      case "b":
        return this.resolveFpsRelativeMovementInput(aim, -1, -1);
      case "pagedown":
      case "n":
        return this.resolveFpsRelativeMovementInput(aim, 1, -1);
      default:
        return null;
    }
  }

  private fireInCurrentAimDirection(): void {
    this.armFpsFireSuppression();
    this.fpsAimLinePulseUntilMs = Date.now() + 220;
    // In FPS mode, fire should first ask for direction; the direction prompt
    // confirmation path (left-click/W/etc.) supplies the actual direction input.
    this.sendInput("f");
  }

  private armFpsFireSuppression(): void {
    if (!this.isFpsMode()) {
      return;
    }
    this.fpsFireSuppressionUntilMs =
      Date.now() + this.fpsFireSuppressionDurationMs;
  }

  private clearFpsFireSuppression(): void {
    this.fpsFireSuppressionUntilMs = 0;
  }

  private isFpsFireSuppressed(): boolean {
    return this.isFpsMode() && Date.now() < this.fpsFireSuppressionUntilMs;
  }

  private getFpsDirectionQuestionInputFromAim(): string | null {
    const aim = this.getFpsAimDirectionFromCamera();
    return aim?.input ?? null;
  }

  private tryResolveFpsDirectionQuestionInput(
    event: KeyboardEvent,
  ): string | null {
    const lowerKey = event.key.toLowerCase();
    if (lowerKey === "a" || lowerKey === "d") {
      return "Escape";
    }
    if (lowerKey === "s") {
      return "s";
    }
    if (lowerKey === "w") {
      return this.getFpsDirectionQuestionInputFromAim();
    }
    if (event.key === "<" || event.key === ",") {
      return "<";
    }
    if (event.key === ">") {
      return ">";
    }
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space"
    ) {
      return this.getFpsDirectionQuestionInputFromAim();
    }
    return null;
  }

  private tryRunFpsSelfTilePrimaryClickAction(): boolean {
    if (!this.isFpsMode()) {
      return false;
    }

    // Keep this threshold aligned with the under-player highlight behavior.
    const shouldPreferPlayerTileHighlight =
      this.cameraPitch <= this.firstPersonPitchMin + 0.42;
    if (!shouldPreferPlayerTileHighlight) {
      return false;
    }

    const tileX = this.playerPos.x;
    const tileY = this.playerPos.y;
    const tileKey = `${tileX},${tileY}`;
    const tileMesh = this.tileMap.get(tileKey);
    if (!tileMesh || Boolean(tileMesh.userData?.isWall)) {
      return false;
    }

    const nowMs = Date.now();
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(tileKey, nowMs);
    const glanceText = glanceEntry?.sourceText ?? "";
    const normalizedGlanceText = glanceText.toLowerCase();
    const isContainerLikeLoot =
      /\b(chest|box|coffer|container|sack|bag)\b/.test(normalizedGlanceText);
    const actions = this.getFpsCrosshairActionsForTile(
      tileKey,
      tileMesh,
      glanceEntry?.hint ?? null,
      glanceText,
    );
    const hasQuickAction = (id: string): boolean =>
      actions.some((action) => action.kind === "quick" && action.id === id);

    let actionId: string | null = null;
    if (hasQuickAction("ascend")) {
      actionId = "ascend";
    } else if (hasQuickAction("descend")) {
      actionId = "descend";
    } else if (isContainerLikeLoot && hasQuickAction("loot")) {
      actionId = "loot";
    } else if (hasQuickAction("pickup")) {
      actionId = "pickup";
    }

    if (!actionId) {
      return false;
    }

    return this.executeQuickAction(actionId, true);
  }

  private tryRunFpsDoorPrimaryClickAction(): boolean {
    if (!this.isFpsMode()) {
      return false;
    }

    let target = this.getTileUnderFpsCrosshair();
    if (!target) {
      const aim = this.getFpsAimDirectionFromCamera();
      if (!aim) {
        return false;
      }
      const tileX = this.playerPos.x + aim.dx;
      const tileY = this.playerPos.y + aim.dy;
      const tileKey = `${tileX},${tileY}`;
      const tileMesh = this.tileMap.get(tileKey);
      if (!tileMesh) {
        return false;
      }
      target = { key: tileKey, x: tileX, y: tileY, mesh: tileMesh };
    }

    const nowMs = Date.now();
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(
      target.key,
      nowMs,
    );
    const glanceHint = glanceEntry?.hint ?? null;
    const materialKind =
      typeof target.mesh.userData?.materialKind === "string"
        ? target.mesh.userData.materialKind
        : "";
    if (materialKind !== "door" && glanceHint !== "door") {
      return false;
    }

    return this.executeQuickAction("open", true, true);
  }

  private handlePointerLockChange(): void {
    this.fpsPointerLockActive =
      document.pointerLockElement === this.renderer.domElement;
    if (this.fpsPointerLockActive) {
      this.fpsPointerLockRestorePending = false;
    }
    this.syncFpsPointerLockForUiState(false);
  }

  private isFpsPointerLockBlockedByUi(): boolean {
    const allowDirectionLook = this.isFpsMode() && this.isInDirectionQuestion;
    const modalBlocksPointerLock =
      this.isAnyModalVisible() &&
      !(allowDirectionLook && this.isOnlyDirectionDialogVisible());
    return (
      (this.isInQuestion && !allowDirectionLook) ||
      (this.isInDirectionQuestion && !allowDirectionLook) ||
      this.isTextInputActive ||
      this.positionInputModeActive ||
      this.metaCommandModeActive ||
      this.fpsCrosshairContextMenuOpen ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen() ||
      modalBlocksPointerLock
    );
  }

  private isOnlyDirectionDialogVisible(): boolean {
    return (
      this.isInDirectionQuestion &&
      !this.isInQuestion &&
      !this.isTextInputActive &&
      !this.positionInputModeActive &&
      !this.metaCommandModeActive &&
      !this.isInventoryDialogOpen() &&
      !this.isInfoDialogOpen()
    );
  }

  private syncFpsPointerLockForUiState(tryAcquire: boolean): void {
    if (!this.isFpsMode() || this.isVrPresenting()) {
      return;
    }

    const isRendererLocked =
      document.pointerLockElement === this.renderer.domElement;
    if (this.isFpsPointerLockBlockedByUi()) {
      if (isRendererLocked || this.fpsPointerLockActive) {
        this.fpsPointerLockRestorePending = true;
      }
      if (isRendererLocked) {
        document.exitPointerLock?.();
      }
      this.fpsPointerLockActive = false;
      return;
    }

    if (
      (tryAcquire || this.fpsPointerLockRestorePending) &&
      !isRendererLocked &&
      !this.fpsPointerLockActive
    ) {
      this.fpsPointerLockRestorePending = false;
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  private getModalNavigationDirection(
    event: KeyboardEvent,
  ): "up" | "down" | "left" | "right" | null {
    switch (event.key) {
      case "ArrowUp":
        return "up";
      case "ArrowDown":
        return "down";
      case "ArrowLeft":
        return "left";
      case "ArrowRight":
        return "right";
      case "h":
      case "H":
        return this.numberPadModeEnabled ? null : "left";
      case "l":
      case "L":
        return this.numberPadModeEnabled ? null : "right";
      case "k":
      case "K":
      case "y":
      case "Y":
      case "u":
      case "U":
        return this.numberPadModeEnabled ? null : "up";
      case "j":
      case "J":
      case "b":
      case "B":
      case "n":
      case "N":
        return this.numberPadModeEnabled ? null : "down";
      default:
        break;
    }

    if (!event.code.startsWith("Numpad")) {
      return null;
    }

    switch (event.code) {
      case "Numpad8":
      case "Numpad7":
      case "Numpad9":
        return "up";
      case "Numpad2":
      case "Numpad1":
      case "Numpad3":
        return "down";
      case "Numpad4":
        return "left";
      case "Numpad6":
        return "right";
      default:
        return null;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.resumeFmodFromUserGesture();

    if (this.isTextInputActive) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
    }

    if (this.handleMetaCommandKeyDown(event)) {
      return;
    }

    if (event.key === "Alt" || event.key === "Meta") {
      this.altOrMetaHeld = true;
      event.preventDefault();
      return;
    }

    if (this.isMetaCommandTriggerKey(event) && this.canStartMetaCommandMode()) {
      event.preventDefault();
      this.startMetaCommandMode();
      return;
    }

    // Handle escape key to close dialogs
    if (event.key === "Escape") {
      if (this.isTextInputActive) {
        this.submitTextInput("");
        return;
      }
      if (this.isInventoryDialogVisible) {
        this.hideInventoryDialog();
        return;
      }

      if (this.isInfoDialogVisible) {
        this.hideInfoMenuDialog();
        return;
      }

      // If we're in a prompt/position mode, send Escape to NetHack so the
      // runtime can cancel the active flow (question, direction, far-look, etc.).
      if (
        this.isInQuestion ||
        this.isInDirectionQuestion ||
        this.positionInputModeActive
      ) {
        console.log("🔄 Sending Escape to NetHack to cancel active prompt");
        this.sendInput("Escape");
      }

      // Clear UI dialogs and states
      this.hideQuestion();
      this.hideDirectionQuestion();
      this.uiAdapter.setPositionRequest(null);
      if (this.positionHideTimerId !== null) {
        window.clearTimeout(this.positionHideTimerId);
        this.positionHideTimerId = null;
      }
      // Clear question states when escape is pressed
      this.isInQuestion = false;
      this.isInDirectionQuestion = false;
      this.setPositionInputMode(false);
      return;
    }

    if (event.key === "Enter" || event.key === "NumpadEnter") {
      if (this.isInventoryDialogVisible) {
        this.hideInventoryDialog();
        return;
      }

      if (this.isInfoDialogVisible) {
        this.hideInfoMenuDialog();
        return;
      }

      if (
        !this.isFpsMode() &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !this.isAnyModalVisible() &&
        !this.isInQuestion &&
        !this.isInDirectionQuestion &&
        !this.positionInputModeActive &&
        !this.metaCommandModeActive
      ) {
        event.preventDefault();
        this.logClickLookTileDebug(
          "keyboard-enter",
          this.playerPos.x,
          this.playerPos.y,
        );
        this.sendMouseInput(this.playerPos.x, this.playerPos.y, 0);
        return;
      }
    }

    if (this.isTextInputActive) {
      return;
    }

    if (this.isInfoDialogOpen()) {
      if (this.isSpaceDismissKey(event)) {
        event.preventDefault();
        this.hideInfoMenuDialog();
        return;
      }

      if (this.isMovementInput(event.key) || this.isMovementInput(event.code)) {
        event.preventDefault();
        return;
      }
    }

    if (
      this.positionInputModeActive &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion
    ) {
      const positionMoveKey = this.tryResolvePositionInputMovementKey(event);
      if (positionMoveKey) {
        event.preventDefault();
        this.sendInput(positionMoveKey);
        return;
      }
      const positionConfirmKey = this.resolvePositionInputConfirmKey(event);
      if (positionConfirmKey) {
        event.preventDefault();
        this.sendInput(positionConfirmKey);
        return;
      }
      event.preventDefault();
      this.cancelPositionInputMode();
      return;
    }

    const modifiedInput = this.getModifiedInput(event);
    if (modifiedInput) {
      event.preventDefault();
      this.sendInput(modifiedInput);
      return;
    }

    // Handle tile refresh shortcuts (Ctrl + key combinations)
    if (event.ctrlKey) {
      switch (event.key.toLowerCase()) {
        case "r":
          if (event.shiftKey) {
            // Ctrl+Shift+R: Refresh larger area around player
            event.preventDefault();
            console.log("🔄 Manual refresh requested for large player area");
            this.requestPlayerAreaUpdate(10);
            this.addGameMessage("Refreshing large area around player...");
            return;
          } else {
            // Ctrl+R: Refresh area around player
            event.preventDefault();
            console.log("🔄 Manual refresh requested for player area");
            this.requestPlayerAreaUpdate(5);
            this.addGameMessage("Refreshing area around player...");
            return;
          }

        case "t":
          // Ctrl+T: Refresh tile at player position
          event.preventDefault();
          console.log("🔄 Manual refresh requested for player tile");
          this.requestTileUpdate(this.playerPos.x, this.playerPos.y);
          this.addGameMessage(
            `Refreshing tile at (${this.playerPos.x}, ${this.playerPos.y})...`,
          );
          return;

        case "m":
          event.preventDefault();
          this.toggleInfoMenuDialog();
          return;

        case "l":
          if (event.shiftKey) {
            event.preventDefault();
            const next = toggleLoggingEnabled();
            if (this.session) {
              this.session.setLoggingEnabled(next);
            }
            logWithOriginal(
              `[NetHack 3D] Logging ${next ? "enabled" : "disabled"}`,
            );
            return;
          }
          break;
      }
    }

    // Handle inventory display only during normal gameplay.
    // Question dialogs must take precedence over global inventory hotkey behavior.
    if (
      (event.key === "i" || event.key === "I") &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion
    ) {
      event.preventDefault();
      this.toggleInventoryDialogState();
      return;
    }

    // Keep gameplay movement frozen while inventory is open.
    // Close controls (Esc/Enter/i) are handled above.
    if (
      this.isInventoryDialogOpen() &&
      (this.isMovementInput(event.key) || this.isMovementInput(event.code))
    ) {
      event.preventDefault();
      return;
    }

    if (
      this.isFpsMode() &&
      this.positionInputModeActive &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const fpsLookInput = this.tryResolveFpsPositionLookInput(
        event.key,
        event.code,
      );
      if (fpsLookInput) {
        event.preventDefault();
        this.sendInput(fpsLookInput);
        return;
      }
    }

    if (
      this.isFpsMode() &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      !this.positionInputModeActive &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const fpsMoveInput = this.tryResolveFpsMovementInput(
        event.key,
        event.code,
      );
      if (fpsMoveInput) {
        event.preventDefault();
        if (event.shiftKey) {
          if (event.repeat) {
            return;
          }
          this.sendForcedDirectionalInput(fpsMoveInput);
          return;
        }
        this.sendInput(fpsMoveInput);
        return;
      }

      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        this.sendInput("s");
        return;
      }
    }

    // Filter out modifier keys that shouldn't be sent to NetHack
    // Note: Home, End, PageUp, PageDown are NOT filtered as they can be used for diagonal movement
    const modifierKeys = [
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "CapsLock",
      "NumLock",
      "ScrollLock",
      "Tab",
      "Insert",
      "Delete",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ];

    if (modifierKeys.indexOf(event.key) !== -1) {
      console.log(`🚫 Filtering out modifier key: ${event.key}`);
      return;
    }

    const normalizedWaitKey = this.normalizeWaitKey(event);
    if (
      normalizedWaitKey &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion
    ) {
      event.preventDefault();
      this.sendInput(normalizedWaitKey);
      return;
    }

    // Preserve numpad intent in the runtime so movement digits are not
    // conflated with top-row numeric count prefixes.
    if (
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      event.code.startsWith("Numpad") &&
      /^[1-9]$/.test(event.key)
    ) {
      event.preventDefault();
      if (this.numberPadModeEnabled) {
        this.sendInput(`Numpad${event.key}`);
      } else {
        const mappedKey = this.mapNumpadDigitToDirectionKey(event.key);
        if (mappedKey) {
          this.sendInput(mappedKey);
        }
      }
      return;
    }

    // Handle diagonal movement keys during regular gameplay
    // Map navigation keys to direction equivalents for NetHack
    if (!this.isInQuestion && !this.isInDirectionQuestion) {
      const mappedKey = this.mapDirectionalKeyFromNavigationInput(event.key);
      if (mappedKey) {
        this.sendInput(mappedKey);
        return;
      }
    }

    // If we're in any question, handle input specially and don't allow normal movement
    if (this.isInQuestion || this.isInDirectionQuestion) {
      // If it's a direction question, handle direction input
      if (this.isInDirectionQuestion) {
        if (this.isFpsMode()) {
          const keyToSend = this.tryResolveFpsDirectionQuestionInput(event);
          if (keyToSend) {
            event.preventDefault();
            if (keyToSend === "Escape") {
              this.sendInput("Escape");
              this.hideDirectionQuestion();
            } else {
              this.submitDirectionAnswer(keyToSend);
            }
          }
          return;
        }

        // With number_pad:1 option, we can pass numpad keys and arrow keys directly
        let keyToSend = null;

        const mappedNav = this.mapDirectionalKeyFromNavigationInput(event.key);
        if (mappedNav) {
          keyToSend = mappedNav;
        }

        if (
          !keyToSend &&
          event.code.startsWith("Numpad") &&
          /^[1-9]$/.test(event.key)
        ) {
          keyToSend = this.mapNumpadDigitToDirectionKey(event.key);
        }

        if (!keyToSend) {
          if (this.numberPadModeEnabled && /^[1-9]$/.test(event.key)) {
            keyToSend = event.key;
          } else if (!this.numberPadModeEnabled) {
            const lowerKey = event.key.toLowerCase();
            if ("hjklyubn".includes(lowerKey)) {
              keyToSend = lowerKey;
            }
          }
        }

        if (!keyToSend) {
          switch (event.key) {
            case "<":
            case ",":
              keyToSend = "<";
              break;
            case ">":
              keyToSend = ">";
              break;
            case "s":
            case "S":
              keyToSend = "s";
              break;
            case " ":
            case "Spacebar":
            case "Space":
            case ".":
            case "Decimal":
            case "NumpadDecimal":
              keyToSend = ".";
              break;
          }
        }

        if (keyToSend) {
          this.submitDirectionAnswer(keyToSend);
        }
        return; // Don't send other keys when in direction question mode
      }

      const isPickupDialog = this.activeQuestionIsPickupDialog;
      const isMenuQuestion = this.activeQuestionMenuItems.length > 0;
      const modalDirection = this.getModalNavigationDirection(event);

      if (isMenuQuestion && this.activeQuestionMenuPageCount > 1) {
        if (event.key === "<") {
          event.preventDefault();
          this.goToPreviousQuestionMenuPage();
          return;
        }
        if (event.key === ">") {
          event.preventDefault();
          this.goToNextQuestionMenuPage();
          return;
        }
      }

      // For other questions, handle pickup dialogs specially
      if (isPickupDialog) {
        if (modalDirection) {
          event.preventDefault();
          const isActionFocused = this.isQuestionActionFocused();
          let effectiveDirection = modalDirection;
          if (!isActionFocused) {
            if (modalDirection === "left") {
              effectiveDirection = "up";
            } else if (modalDirection === "right") {
              effectiveDirection = "down";
            }
          }
          const selectableItems = this.getVisiblePickupSelectableMenuItems();
          if (isActionFocused) {
            if (effectiveDirection === "up") {
              this.clearQuestionActionFocus();
              if (selectableItems.length > 0) {
                this.activePickupFocusIndex = selectableItems.length - 1;
              }
              this.updatePickupFocusVisualState();
              return;
            }
            if (effectiveDirection === "left") {
              if (this.activeQuestionActionFocusIndex <= 0) {
                this.clearQuestionActionFocus();
                if (selectableItems.length > 0) {
                  this.activePickupFocusIndex = selectableItems.length - 1;
                }
                this.updatePickupFocusVisualState();
                return;
              }
              this.moveQuestionActionFocus(-1);
              return;
            }
            if (
              effectiveDirection === "right" ||
              effectiveDirection === "down"
            ) {
              this.moveQuestionActionFocus(1);
              return;
            }
          } else {
            if (effectiveDirection === "down") {
              this.normalizeActivePickupFocusIndex();
              const atBottom =
                selectableItems.length > 0 &&
                this.activePickupFocusIndex >= selectableItems.length - 1;
              if (atBottom && this.focusQuestionActionsStart()) {
                return;
              }
              this.movePickupFocus(1);
              return;
            }
            if (effectiveDirection === "up" || effectiveDirection === "left") {
              this.movePickupFocus(-1);
              return;
            }
            if (effectiveDirection === "right") {
              this.movePickupFocus(1);
              return;
            }
          }
          return;
        }

        if (
          event.key === " " ||
          event.key === "Space" ||
          event.key === "Spacebar"
        ) {
          event.preventDefault();
          if (this.activateFocusedQuestionAction()) {
            return;
          }
          this.toggleActivePickupFocusSelection();
          return;
        }

        // This is a pickup dialog - handle multi-selection
        if (event.key === "Enter") {
          event.preventDefault();
          if (this.activateFocusedQuestionAction()) {
            return;
          }
          this.confirmPickupChoices();
          return;
        } else if (event.key === "Escape") {
          event.preventDefault();
          this.cancelActivePrompt();
          return;
        } else {
          const resolvedSelectionInput = isMenuQuestion
            ? this.resolveQuestionSelectionInputForKeyPress(event.key)
            : this.resolveQuestionSelectionInput(event.key);
          const matchingItem = resolvedSelectionInput
            ? this.findActiveMenuItemBySelectionInput(resolvedSelectionInput)
            : null;

          if (matchingItem && resolvedSelectionInput) {
            event.preventDefault();
            this.togglePickupChoice(resolvedSelectionInput);
          } else if (!isMenuQuestion) {
            // Send the key anyway in case it's a valid NetHack command
            this.updateNumberPadModeFromChoice(event.key);
            this.sendInput(event.key);
          }
        }
      } else {
        if (isMenuQuestion) {
          if (modalDirection) {
            event.preventDefault();
            const isActionFocused = this.isQuestionActionFocused();
            let effectiveDirection = modalDirection;
            if (!isActionFocused) {
              if (modalDirection === "left") {
                effectiveDirection = "up";
              } else if (modalDirection === "right") {
                effectiveDirection = "down";
              }
            }
            const selectableItems = this.getVisiblePickupSelectableMenuItems();
            if (isActionFocused) {
              if (effectiveDirection === "up") {
                this.clearQuestionActionFocus();
                if (selectableItems.length > 0) {
                  this.activeQuestionMenuFocusIndex =
                    selectableItems.length - 1;
                }
                this.updateQuestionMenuFocusVisualState();
                return;
              }
              if (effectiveDirection === "left") {
                if (this.activeQuestionActionFocusIndex <= 0) {
                  this.clearQuestionActionFocus();
                  if (selectableItems.length > 0) {
                    this.activeQuestionMenuFocusIndex =
                      selectableItems.length - 1;
                  }
                  this.updateQuestionMenuFocusVisualState();
                  return;
                }
                this.moveQuestionActionFocus(-1);
                return;
              }
              if (
                effectiveDirection === "right" ||
                effectiveDirection === "down"
              ) {
                this.moveQuestionActionFocus(1);
                return;
              }
            } else {
              if (effectiveDirection === "down") {
                this.normalizeActiveQuestionMenuFocusIndex();
                const atBottom =
                  selectableItems.length > 0 &&
                  this.activeQuestionMenuFocusIndex >=
                    selectableItems.length - 1;
                if (atBottom && this.focusQuestionActionsStart()) {
                  return;
                }
                this.moveQuestionMenuFocus(1);
                return;
              }
              if (
                effectiveDirection === "up" ||
                effectiveDirection === "left"
              ) {
                this.moveQuestionMenuFocus(-1);
                return;
              }
              if (effectiveDirection === "right") {
                this.moveQuestionMenuFocus(1);
                return;
              }
            }
          }

          if (
            event.key === " " ||
            event.key === "Space" ||
            event.key === "Spacebar" ||
            event.key === "Enter"
          ) {
            event.preventDefault();
            if (this.activateFocusedQuestionAction()) {
              return;
            }
            this.confirmQuestionMenuChoice();
            return;
          }
        }

        // Standard single-selection dialog - send key and close
        const resolvedSelectionInput = isMenuQuestion
          ? this.resolveQuestionSelectionInputForKeyPress(event.key)
          : this.resolveQuestionSelectionInput(event.key);
        const selectedItem = resolvedSelectionInput
          ? this.findActiveMenuItemBySelectionInput(resolvedSelectionInput)
          : null;
        if (selectedItem && resolvedSelectionInput) {
          event.preventDefault();
          const selectionInput =
            this.getQuestionMenuSelectionInput(selectedItem);
          this.setActiveQuestionMenuFocusBySelectionInput(selectionInput);
          this.sendInput(selectionInput);
          this.hideQuestion();
        } else if (!isMenuQuestion) {
          this.updateNumberPadModeFromChoice(event.key);
          this.sendInput(event.key);
          this.hideQuestion();
        } else {
          return;
        }
      }
      return; // Don't allow normal movement during questions
    }

    // Send input to local runtime for normal gameplay
    this.sendInput(event.key);
  }

  private updateCamera(deltaSeconds: number): void {
    if (this.isVrPresenting()) {
      this.syncVrCameraAimFromHeadset();
      return;
    }

    if (this.isFpsMode()) {
      const targetEyeX = this.playerPos.x * TILE_SIZE;
      const targetEyeY = -this.playerPos.y * TILE_SIZE;
      let eyeX = targetEyeX;
      let eyeY = targetEyeY;
      const eyeZ = this.firstPersonEyeHeight;

      this.updateFpsAutoTurnYaw(deltaSeconds);

      if (this.fpsStepCameraActive) {
        const progress = THREE.MathUtils.clamp(
          (performance.now() - this.fpsStepCameraStartMs) /
            this.fpsStepCameraDurationMs,
          0,
          1,
        );
        const eased = 1 - Math.pow(1 - progress, 3);
        eyeX = THREE.MathUtils.lerp(
          this.fpsStepCameraFrom.x,
          this.fpsStepCameraTo.x,
          eased,
        );
        eyeY = THREE.MathUtils.lerp(
          this.fpsStepCameraFrom.y,
          this.fpsStepCameraTo.y,
          eased,
        );
        if (progress >= 1) {
          this.fpsStepCameraActive = false;
          this.fpsStepCameraFrom.set(targetEyeX, targetEyeY, eyeZ);
          this.fpsStepCameraTo.set(targetEyeX, targetEyeY, eyeZ);
          if (this.pendingTileUpdates.size > 0 && !this.tileFlushScheduled) {
            this.tileFlushScheduled = true;
            requestAnimationFrame(() => this.flushPendingTileUpdates());
          }
        }
      }

      const forwardX = -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
      const forwardY = -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
      const forwardZ = Math.sin(this.cameraPitch);

      this.camera.position.set(eyeX, eyeY, eyeZ);
      this.camera.lookAt(eyeX + forwardX, eyeY + forwardY, eyeZ + forwardZ);
      return;
    }

    const { x, y } = this.playerPos;
    const targetX = x * TILE_SIZE + this.cameraPanX;
    const targetY = -y * TILE_SIZE + this.cameraPanY;
    this.cameraFollowTarget.set(targetX, targetY, 0);

    if (!this.cameraFollowInitialized) {
      this.cameraFollowCurrent.copy(this.cameraFollowTarget);
      this.cameraFollowInitialized = true;
    } else {
      // Exponential smoothing for camera follow: immediate movement with natural fade-out.
      const alpha =
        1 -
        Math.exp(
          (-Math.LN2 * deltaSeconds * 1000) / this.cameraFollowHalfLifeMs,
        );
      this.cameraFollowCurrent.lerp(this.cameraFollowTarget, alpha);
    }

    const followX = this.cameraFollowCurrent.x;
    const followY = this.cameraFollowCurrent.y;

    // Use spherical coordinates for camera positioning
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const offsetX = this.cameraDistance * cosPitch * sinYaw;
    const offsetY = this.cameraDistance * cosPitch * cosYaw;
    const offsetZ = this.cameraDistance * sinPitch;

    // Position camera relative to player (with panning offset)
    this.camera.position.x = followX + offsetX;
    this.camera.position.y = followY + offsetY;
    this.camera.position.z = offsetZ;

    // Always look at the target position (player + pan offset)
    this.camera.lookAt(followX, followY, 0);
  }

  private ensureFpsForwardHighlightTexture(): THREE.CanvasTexture {
    if (this.fpsForwardHighlightTexture) {
      return this.fpsForwardHighlightTexture;
    }

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create FPS forward highlight texture context");
    }

    context.clearRect(0, 0, size, size);
    const imageData = context.createImageData(size, size);
    const data = imageData.data;
    const center = size * 0.5;
    const smoothstep = (edge0: number, edge1: number, x: number): number => {
      const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    };

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const edgeDistance = Math.min(px, py, size - px, size - py);
        const edgeNorm = edgeDistance / center;

        const outerFeather = smoothstep(0.0, 0.2, edgeNorm);
        const inwardFade = 1 - smoothstep(0.16, 0.84, edgeNorm);
        // Slightly lower intensity than previous square profile.
        const alpha = THREE.MathUtils.clamp(
          outerFeather * inwardFade * 0.58,
          0,
          1,
        );

        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 238;
        data[i + 2] = 118;
        data[i + 3] = Math.round(alpha * 255);
      }
    }

    context.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = this.resolveTextureAnisotropyLevel();
    this.fpsForwardHighlightTexture = texture;
    return texture;
  }

  private ensureFpsAimVisuals(): void {
    if (this.fpsForwardHighlight) {
      return;
    }

    if (!this.fpsForwardHighlight) {
      const geometry = new THREE.PlaneGeometry(
        TILE_SIZE * 0.9,
        TILE_SIZE * 0.9,
      );
      const material = new THREE.MeshBasicMaterial({
        map: this.ensureFpsForwardHighlightTexture(),
        color: 0xfff6a8,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      // Keep forward-tile highlight above floor/shadow layers but beneath
      // elevated billboards (monster/loot sprites use renderOrder 910).
      mesh.renderOrder = 907;
      this.addWorldObject(mesh);
      this.fpsForwardHighlight = mesh;
      this.fpsForwardHighlightMaterial = material;
    }
  }

  private updateFpsAimVisuals(timeMs: number): void {
    if (this.isVrPresenting()) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }

    if (!this.isFpsMode()) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }

    if (
      this.isAnyModalVisible() ||
      this.isInQuestion ||
      this.isInDirectionQuestion
    ) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }

    const aim = this.getFpsAimDirectionFromCamera();
    if (!aim) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }
    this.ensureFpsAimVisuals();

    let targetX = this.playerPos.x + aim.dx;
    let targetY = this.playerPos.y + aim.dy;
    let targetTile = this.tileMap.get(`${targetX},${targetY}`) ?? null;
    const shouldPreferPlayerTileHighlight =
      this.cameraPitch <= this.firstPersonPitchMin + 0.42;
    if (shouldPreferPlayerTileHighlight) {
      const playerTile =
        this.tileMap.get(`${this.playerPos.x},${this.playerPos.y}`) ?? null;
      if (playerTile) {
        targetX = this.playerPos.x;
        targetY = this.playerPos.y;
        targetTile = playerTile;
      }
    }
    const isDiscoveredPassableTarget =
      Boolean(targetTile) && !Boolean(targetTile?.userData?.isWall);
    if (!isDiscoveredPassableTarget) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }
    const targetZ = targetTile?.userData?.isWall ? WALL_HEIGHT + 0.02 : 0.03;

    if (this.fpsForwardHighlight) {
      this.fpsForwardHighlight.position.set(
        targetX * TILE_SIZE,
        -targetY * TILE_SIZE,
        targetZ,
      );
      this.fpsForwardHighlight.visible = true;
      if (this.fpsForwardHighlightMaterial) {
        const pulse = timeMs <= this.fpsAimLinePulseUntilMs ? 1 : 0.45;
        this.fpsForwardHighlightMaterial.opacity = 0.2 + pulse * 0.32;
      }
    }
  }

  private wrapAngle(angle: number): number {
    const twoPi = Math.PI * 2;
    angle = ((angle % twoPi) + twoPi) % twoPi;
    return angle > Math.PI ? angle - twoPi : angle;
  }

  private isAnyModalVisible(): boolean {
    if (this.metaCommandModal?.classList.contains("is-visible")) {
      return true;
    }

    if (document.querySelector(".nh3d-dialog.is-visible")) {
      return true;
    }
    if (document.querySelector(".nh3d-mobile-actions-sheet")) {
      return true;
    }
    const mobileLog = document.querySelector(".nh3d-mobile-log");
    if (mobileLog && !mobileLog.classList.contains("nh3d-mobile-log-hidden")) {
      return true;
    }
    return false;
  }

  private clearFpsCrosshairContextMenu(): void {
    if (!this.fpsCrosshairContextSignature) {
      return;
    }
    this.fpsCrosshairContextSignature = "";
    this.activeContextActionTile = null;
    this.uiAdapter.setFpsCrosshairContext(null);
  }

  private closeNormalTileContextMenu(
    consumeNextPrimaryPointer: boolean = false,
  ): void {
    if (
      !this.normalTileContextMenuOpen &&
      !this.normalTileContextSignature &&
      !this.selectedContextHighlightTile
    ) {
      return;
    }
    if (consumeNextPrimaryPointer) {
      this.suppressNextMapPrimaryPointerUntilMs =
        Date.now() + this.suppressNextMapPrimaryPointerWindowMs;
    }
    this.normalTileContextMenuOpen = false;
    this.vrTileContextMode = false;
    this.normalTileContextSignature = "";
    this.normalTileContextTarget = null;
    this.activeContextActionTile = null;
    this.clearContextSelectionHighlight();
    this.uiAdapter.setFpsCrosshairContext(null);
  }

  private closeAnyTileContextMenu(restorePointerLock: boolean): void {
    if (this.fpsCrosshairContextMenuOpen || this.fpsCrosshairContextSignature) {
      this.closeFpsCrosshairContextMenu(restorePointerLock);
      return;
    }
    this.closeNormalTileContextMenu();
  }

  private clearContextSelectionHighlight(): void {
    this.selectedContextHighlightTile = null;
  }

  private shouldConsumeSuppressedMapPrimaryPointerEvent(
    targetIsCanvas: boolean,
  ): boolean {
    if (!targetIsCanvas) {
      return false;
    }
    const nowMs = Date.now();
    if (nowMs > this.suppressNextMapPrimaryPointerUntilMs) {
      return false;
    }
    this.suppressNextMapPrimaryPointerUntilMs = 0;
    return true;
  }

  private setContextSelectionHighlight(tileX: number, tileY: number): void {
    this.selectedContextHighlightTile = { x: tileX, y: tileY };
  }

  private openNormalTileContextMenuAtTarget(target: TileContextTarget): void {
    if (this.isFpsMode()) {
      return;
    }
    this.fpsCrosshairGlanceCache.clear();
    this.fpsCrosshairGlanceAttemptedKeys.clear();
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.clearAutomaticGlancePendingState();
    this.normalTileContextMenuOpen = true;
    this.vrTileContextMode = false;
    this.normalTileContextTarget = target;
    this.normalTileContextSignature = "";
    this.setContextSelectionHighlight(target.x, target.y);
    this.updateNormalTileContextMenu();
  }

  private openVrTileContextMenuAtTarget(target: TileContextTarget): void {
    this.fpsCrosshairGlanceCache.clear();
    this.fpsCrosshairGlanceAttemptedKeys.clear();
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.clearAutomaticGlancePendingState();
    this.fpsCrosshairContextMenuOpen = false;
    this.normalTileContextMenuOpen = true;
    this.vrTileContextMode = true;
    this.normalTileContextTarget = target;
    this.normalTileContextSignature = "";
    this.updateNormalTileContextMenu();
  }

  private openFpsCrosshairContextMenu(): void {
    if (!this.isFpsMode()) {
      return;
    }
    this.fpsCrosshairGlanceCache.clear();
    this.fpsCrosshairGlanceAttemptedKeys.clear();
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.clearAutomaticGlancePendingState();
    this.fpsCrosshairContextMenuOpen = true;
    this.syncFpsPointerLockForUiState(false);
    this.updateFpsCrosshairContextMenu();
  }

  private closeFpsCrosshairContextMenu(restorePointerLock: boolean): void {
    if (
      !this.fpsCrosshairContextMenuOpen &&
      !this.fpsCrosshairContextSignature
    ) {
      return;
    }
    this.fpsCrosshairContextMenuOpen = false;
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.clearAutomaticGlancePendingState();
    this.activeContextActionTile = null;
    this.clearContextSelectionHighlight();
    this.clearFpsCrosshairContextMenu();
    if (restorePointerLock) {
      this.syncFpsPointerLockForUiState(true);
    }
  }

  private getTileUnderFpsCrosshair(): {
    key: string;
    x: number;
    y: number;
    mesh: THREE.Mesh;
  } | null {
    return this.getTileTargetFromPointerNdc(0, 0, true);
  }

  private isOpaqueSpriteIntersection(
    intersection: THREE.Intersection<THREE.Object3D>,
  ): boolean {
    const sprite = intersection.object;
    if (!(sprite instanceof THREE.Sprite)) {
      return true;
    }

    const material = sprite.material;
    if (!(material instanceof THREE.SpriteMaterial)) {
      return true;
    }

    const texture = material.map;
    if (!texture || !intersection.uv) {
      return true;
    }

    const image = texture.image;
    if (!(image instanceof HTMLCanvasElement)) {
      return true;
    }

    const width = image.width;
    const height = image.height;
    if (width <= 0 || height <= 0) {
      return false;
    }

    const uv = intersection.uv.clone();
    texture.transformUv(uv);
    const u = THREE.MathUtils.clamp(uv.x, 0, 0.999999);
    const v = THREE.MathUtils.clamp(uv.y, 0, 0.999999);
    const px = Math.floor(u * width);
    const py = Math.floor(THREE.MathUtils.clamp(1 - v, 0, 0.999999) * height);
    const context = image.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return true;
    }

    const alpha = context.getImageData(px, py, 1, 1).data[3];
    const alphaThreshold = Math.max(
      1,
      Math.round((material.alphaTest || 0) * 255),
    );
    return alpha >= alphaThreshold;
  }

  private getTileTargetFromPointerNdc(
    ndcX: number,
    ndcY: number,
    requireMesh: boolean,
  ): {
    key: string;
    x: number;
    y: number;
    mesh: THREE.Mesh;
  } | null {
    this.pointerNdc.set(ndcX, ndcY);
    this.pointerRaycaster.setFromCamera(
      this.pointerNdc,
      this.getActivePerspectiveViewCamera(),
    );
    return this.resolveTileTargetFromRaycaster(this.pointerRaycaster, requireMesh);
  }

  private getRaycastableTileObjects(): THREE.Object3D[] {
    return [
      ...Array.from(this.monsterBillboards.values()),
      ...Array.from(this.tileMap.values()),
    ];
  }

  private resolveTileTargetFromRaycaster(
    raycaster: THREE.Raycaster,
    requireMesh: boolean,
  ): TileContextTarget | null {
    const objects = this.getRaycastableTileObjects();
    if (objects.length === 0) {
      return null;
    }
    const intersections = raycaster.intersectObjects(objects, false);
    return this.resolveTileTargetFromIntersections(intersections, requireMesh);
  }

  private resolveTileTargetFromIntersections(
    intersections: THREE.Intersection<THREE.Object3D>[],
    requireMesh: boolean,
  ): TileContextTarget | null {
    if (intersections.length === 0) {
      return null;
    }

    for (const intersection of intersections) {
      const object = intersection.object;
      if (object instanceof THREE.Sprite) {
        if (!this.isOpaqueSpriteIntersection(intersection)) {
          continue;
        }
        const spriteTileX = Number(object.userData?.tileX);
        const spriteTileY = Number(object.userData?.tileY);
        const x = Number.isFinite(spriteTileX)
          ? Math.round(spriteTileX)
          : Math.round(object.position.x / TILE_SIZE);
        const y = Number.isFinite(spriteTileY)
          ? Math.round(spriteTileY)
          : Math.round(-object.position.y / TILE_SIZE);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          continue;
        }
        const key = `${x},${y}`;
        const mesh = this.tileMap.get(key) ?? null;
        if (!mesh && requireMesh) {
          continue;
        }
        if (mesh) {
          return { key, x, y, mesh };
        }
        continue;
      }

      if (!(object instanceof THREE.Mesh)) {
        continue;
      }

      const x = Math.round(object.position.x / TILE_SIZE);
      const y = Math.round(-object.position.y / TILE_SIZE);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      return {
        key: `${x},${y}`,
        x,
        y,
        mesh: object,
      };
    }

    return null;
  }

  private sanitizeFpsCrosshairGlanceText(rawText: string): string {
    return String(rawText || "")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private shouldIgnoreFpsCrosshairGlanceText(text: string): boolean {
    const normalized = text.toLowerCase();
    if (!normalized) {
      return true;
    }
    if (/^pick (an?|the)? ?object\b/.test(normalized)) {
      return true;
    }
    if (
      normalized.startsWith("pick ") &&
      normalized.includes("monster, object or location")
    ) {
      return true;
    }
    if (normalized.startsWith("please move the cursor")) {
      return true;
    }
    if (normalized.includes("what do you want to look at")) {
      return true;
    }
    return false;
  }

  private inferFpsCrosshairTargetHintFromGlanceText(
    text: string,
  ): FpsCrosshairTargetHint {
    const normalized = text.toLowerCase();

    if (
      /(?:staircase|stairs|stairway|ladder).*\bup\b/.test(normalized) ||
      /\bup\b.*(?:staircase|stairs|stairway|ladder)/.test(normalized)
    ) {
      return "stairs_up";
    }
    if (
      /(?:staircase|stairs|stairway|ladder).*\bdown\b/.test(normalized) ||
      /\bdown\b.*(?:staircase|stairs|stairway|ladder)/.test(normalized)
    ) {
      return "stairs_down";
    }
    if (/\bdoor\b/.test(normalized)) {
      return "door";
    }
    if (/\btrap\b/.test(normalized)) {
      return "trap";
    }
    if (/\b(fountain|sink|pool|water|moat|lava)\b/.test(normalized)) {
      return "water";
    }
    if (
      /\b(altar|throne|grave|headstone|tree|bars|boulder|statue)\b/.test(
        normalized,
      )
    ) {
      return "feature";
    }
    if (/\b(wall|rock)\b/.test(normalized)) {
      return "wall";
    }
    if (
      /\b(you see here|there is|lying here|on the floor)\b/.test(normalized) ||
      /\b(gold|coin|corpse|potion|scroll|ring|wand|spellbook|weapon|armor|amulet|gem|food)\b/.test(
        normalized,
      )
    ) {
      return "loot";
    }
    if (
      /\b(peaceful|hostile|tame|asleep|sleeping|fleeing)\b/.test(normalized) ||
      /\bis here\b/.test(normalized)
    ) {
      return "monster";
    }
    if (/\b(floor|room|corridor|passage)\b/.test(normalized)) {
      return "floor";
    }
    if (normalized.includes("never heard")) {
      return "unknown";
    }
    return "unknown";
  }

  private captureFpsCrosshairGlanceMessage(messageLike: unknown): void {
    if (!this.fpsCrosshairGlancePending || typeof messageLike !== "string") {
      return;
    }

    const text = this.sanitizeFpsCrosshairGlanceText(messageLike);
    if (!text || this.shouldIgnoreFpsCrosshairGlanceText(text)) {
      return;
    }

    const pending = this.fpsCrosshairGlancePending;
    const hint = this.inferFpsCrosshairTargetHintFromGlanceText(text);
    this.fpsCrosshairGlanceCache.set(pending.tileKey, {
      hint,
      sourceText: text,
      updatedAtMs: Date.now(),
    });
    if (pending.commandKind === "glance" && !pending.targetClickSent) {
      // Ignore pre-target text for #glance probes until target click is sent.
      this.fpsCrosshairContextSignature = "";
      return;
    }
    this.clearAutomaticGlancePendingState();
    this.fpsCrosshairContextSignature = "";
  }

  private expireFpsCrosshairGlanceState(nowMs: number): void {
    if (!this.fpsCrosshairGlancePending) {
      return;
    }
    if (
      nowMs - this.fpsCrosshairGlancePending.startedAtMs >
      this.fpsCrosshairGlanceTimeoutMs
    ) {
      this.clearAutomaticGlancePendingState();
    }
  }

  private getCachedFpsCrosshairGlanceEntry(
    tileKey: string,
    _nowMs: number,
  ): FpsCrosshairGlanceCacheEntry | null {
    const cached = this.fpsCrosshairGlanceCache.get(tileKey);
    if (!cached) {
      return null;
    }
    return cached;
  }

  private startTileContextGlanceProbe(
    target: { key: string; x: number; y: number },
    nowMs: number,
  ): void {
    if (
      !this.session ||
      !(this.fpsCrosshairContextMenuOpen || this.normalTileContextMenuOpen)
    ) {
      return;
    }
    if (
      this.isInQuestion ||
      this.isInDirectionQuestion ||
      this.isTextInputActive ||
      this.metaCommandModeActive ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen()
    ) {
      return;
    }

    const cached = this.getCachedFpsCrosshairGlanceEntry(target.key, nowMs);
    if (cached !== null) {
      return;
    }
    if (this.fpsCrosshairGlanceIssuedThisOpen) {
      return;
    }
    if (this.fpsCrosshairGlanceAttemptedKeys.has(target.key)) {
      return;
    }

    if (this.fpsCrosshairGlancePending) {
      const pendingAgeMs = nowMs - this.fpsCrosshairGlancePending.startedAtMs;
      if (this.fpsCrosshairGlancePending.tileKey === target.key) {
        return;
      }
      if (pendingAgeMs <= this.fpsCrosshairGlanceTimeoutMs) {
        return;
      }
      this.clearAutomaticGlancePendingState();
    }

    this.fpsCrosshairGlancePending = {
      requestId: ++this.fpsCrosshairGlanceRequestSequence,
      tileKey: target.key,
      tileX: target.x,
      tileY: target.y,
      startedAtMs: nowMs,
      sawPositionInput: false,
      positionResolvedAtMs: null,
      targetClickSent: false,
      commandKind: "glance",
    };
    this.fpsCrosshairGlanceAttemptedKeys.add(target.key);
    this.fpsCrosshairGlanceIssuedThisOpen = true;

    const isPlayerTile =
      target.x === this.playerPos.x && target.y === this.playerPos.y;
    if (isPlayerTile) {
      this.fpsCrosshairGlancePending.commandKind = "colon";
      this.fpsCrosshairGlancePending.targetClickSent = true;
      this.sendInput(":", { keepContextMenuOpen: true });
      this.logClickLookTileDebug("fps-glance", target.x, target.y);
      return;
    }

    // Suppress NetHack's transient clicklook prompt ("Pick an object.")
    // generated by the synthetic glance flow.
    this.skipNextMobileFpsClickLookPromptMessage = true;
    this.sendInputSequence(["#", "g", "l", "a", "n", "c", "e", "Enter"], {
      keepContextMenuOpen: true,
    });
    this.logClickLookTileDebug("fps-glance", target.x, target.y);
    this.fpsCrosshairGlancePending.targetClickSent = true;
    this.sendMouseInput(target.x, target.y, 0, { keepContextMenuOpen: true });
  }

  private getFpsCrosshairHintFromTile(
    key: string,
    mesh: THREE.Mesh,
  ): FpsCrosshairTargetHint {
    const [rawX, rawY] = key.split(",");
    const tileX = Number.parseInt(rawX, 10);
    const tileY = Number.parseInt(rawY, 10);
    const isPlayerTile =
      Number.isFinite(tileX) &&
      Number.isFinite(tileY) &&
      tileX === this.playerPos.x &&
      tileY === this.playerPos.y;
    if (
      !isPlayerTile &&
      (Boolean(mesh.userData?.isMonsterLikeCharacter) ||
        this.monsterBillboards.has(key))
    ) {
      return "monster";
    }
    if (Boolean(mesh.userData?.isLootLikeCharacter)) {
      return "loot";
    }
    const knownTerrain = this.getKnownTerrainSnapshotForInferenceAtKey(key);
    if (
      knownTerrain &&
      typeof knownTerrain.glyph === "number" &&
      isDoorwayCmapGlyph(knownTerrain.glyph)
    ) {
      return "door";
    }
    const materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? mesh.userData.materialKind
        : "";
    if (materialKind === "door") {
      return "door";
    }
    if (materialKind === "stairs_up") {
      return "stairs_up";
    }
    if (materialKind === "stairs_down") {
      return "stairs_down";
    }
    if (materialKind === "water" || materialKind === "fountain") {
      return "water";
    }
    if (materialKind === "trap") {
      return "trap";
    }
    if (materialKind === "feature") {
      return "feature";
    }
    if (Boolean(mesh.userData?.isWall)) {
      return "wall";
    }
    return "floor";
  }

  private getContextTitleFromHintWithColon(
    hint: FpsCrosshairTargetHint,
  ): string {
    switch (hint) {
      case "monster":
        return ": monster";
      case "loot":
        return ": loot";
      case "door":
        return ": door";
      case "stairs_up":
        return ": staircase up";
      case "stairs_down":
        return ": staircase down";
      case "wall":
        return ": wall";
      case "water":
        return ": water";
      case "trap":
        return ": trap";
      case "feature":
        return ": feature";
      case "floor":
        return ": floor";
      default:
        return ": tile";
    }
  }

  private createContextInferenceMeshFromTerrain(
    terrain: TerrainSnapshot,
  ): THREE.Mesh {
    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: terrain.char ?? null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: terrain,
    });
    const mesh = new THREE.Mesh();
    mesh.userData = {
      isWall: behavior.isWall,
      materialKind: behavior.materialKind,
      isMonsterLikeCharacter: this.isMonsterLikeBehavior(behavior),
      isLootLikeCharacter: this.isLootLikeBehavior(behavior),
      sourceGlyph: terrain.glyph,
    };
    return mesh;
  }

  private resolveContextActionTarget(target: TileContextTarget): {
    actionMesh: THREE.Mesh;
    allowGlanceProbe: boolean;
    fallbackTitle: string | null;
    glanceHintOverride: FpsCrosshairTargetHint | null;
  } {
    const isPlayerTile =
      target.x === this.playerPos.x && target.y === this.playerPos.y;
    if (!isPlayerTile) {
      const hint = this.getFpsCrosshairHintFromTile(target.key, target.mesh);
      return {
        actionMesh: target.mesh,
        allowGlanceProbe: true,
        fallbackTitle: this.getContextTitleFromHintWithColon(hint),
        glanceHintOverride: null,
      };
    }

    const terrain = this.getKnownTerrainSnapshotForInferenceAtKey(target.key);
    if (!terrain) {
      return {
        actionMesh: target.mesh,
        allowGlanceProbe: true,
        fallbackTitle: null,
        glanceHintOverride: null,
      };
    }
    const inferredMesh = this.createContextInferenceMeshFromTerrain(terrain);
    const hint = this.getFpsCrosshairHintFromTile(target.key, inferredMesh);
    return {
      actionMesh: inferredMesh,
      allowGlanceProbe: true,
      fallbackTitle: this.getContextTitleFromHintWithColon(hint),
      glanceHintOverride: hint,
    };
  }

  private getTileContextAnchorClientPosition(
    target: TileContextTarget,
  ): { x: number; y: number } | null {
    if (!this.renderer || !this.camera) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const z =
      target.mesh?.userData?.isWall === true ? WALL_HEIGHT + 0.04 : 0.04;
    const world = new THREE.Vector3(
      target.x * TILE_SIZE,
      -target.y * TILE_SIZE,
      z,
    );
    world.project(this.getActivePerspectiveViewCamera());
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) {
      return null;
    }
    const x = rect.left + ((world.x + 1) * rect.width) / 2;
    const y = rect.top + ((1 - world.y) * rect.height) / 2;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  private getFpsCrosshairActionsForTile(
    key: string,
    mesh: THREE.Mesh,
    glanceHint: FpsCrosshairTargetHint | null = null,
    glanceText: string | null = null,
  ): FpsContextAction[] {
    const actions: FpsContextAction[] = [];
    const addQuickAction = (id: string, label: string, value: string = id) => {
      if (
        actions.some((action) => action.id === id && action.kind === "quick")
      ) {
        return;
      }
      actions.push({
        id,
        label,
        kind: "quick",
        value,
      });
    };
    const addExtendedAction = (
      id: string,
      label: string,
      value: string = id,
    ) => {
      if (
        actions.some((action) => action.id === id && action.kind === "extended")
      ) {
        return;
      }
      actions.push({
        id,
        label,
        kind: "extended",
        value,
      });
    };

    let isMonster =
      Boolean(mesh.userData?.isMonsterLikeCharacter) ||
      this.monsterBillboards.has(key);
    let isLoot = Boolean(mesh.userData?.isLootLikeCharacter);
    let isWall = Boolean(mesh.userData?.isWall);
    let materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? mesh.userData.materialKind
        : "";
    const knownTerrain = this.getKnownTerrainSnapshotForInferenceAtKey(key);
    if (
      knownTerrain &&
      typeof knownTerrain.glyph === "number" &&
      isDoorwayCmapGlyph(knownTerrain.glyph) &&
      !isMonster &&
      !isLoot
    ) {
      const doorwayBehavior = classifyTileBehavior({
        glyph: knownTerrain.glyph,
        runtimeChar: knownTerrain.char ?? null,
        runtimeColor:
          typeof knownTerrain.color === "number" ? knownTerrain.color : null,
        runtimeTileIndex:
          typeof knownTerrain.tileIndex === "number"
            ? knownTerrain.tileIndex
            : null,
        priorTerrain: knownTerrain,
      });
      materialKind = "door";
      isWall = doorwayBehavior.isWall;
    }
    const normalizedGlanceText = String(glanceText || "").toLowerCase();
    const glanceSaysClosedDoor = /\bclosed door\b/.test(normalizedGlanceText);
    const glanceSuggestsEdibleLoot =
      /\b(corpse|food|ration|tin|egg|tripe|carcass)\b/.test(
        normalizedGlanceText,
      );
    let isTargetPlayerTile = true;
    {
      const [rawX, rawY] = key.split(",");
      const tileX = Number.parseInt(rawX, 10);
      const tileY = Number.parseInt(rawY, 10);
      if (Number.isFinite(tileX) && Number.isFinite(tileY)) {
        isTargetPlayerTile =
          tileX === this.playerPos.x && tileY === this.playerPos.y;
      }
    }
    if (glanceHint) {
      switch (glanceHint) {
        case "monster":
          isMonster = true;
          isLoot = false;
          break;
        case "loot":
          isLoot = true;
          break;
        case "door":
          materialKind = "door";
          isLoot = false;
          isMonster = false;
          if (glanceSaysClosedDoor) {
            // Closed doors are interactable even when the tile mesh is wall-like.
            isWall = false;
          }
          break;
        case "stairs_up":
          materialKind = "stairs_up";
          isWall = false;
          break;
        case "stairs_down":
          materialKind = "stairs_down";
          isWall = false;
          break;
        case "water":
          materialKind = "water";
          isWall = false;
          break;
        case "trap":
          materialKind = "trap";
          isWall = false;
          break;
        case "feature":
          materialKind = "feature";
          isWall = false;
          break;
        case "wall":
          isWall = true;
          break;
        case "floor":
          isWall = false;
          break;
        default:
          break;
      }
    }
    if (isTargetPlayerTile) {
      // The player's own tile should still allow self-tile actions (loot/pickup).
      isMonster = false;
    }
    const isStairsUp = materialKind === "stairs_up";
    const isStairsDown = materialKind === "stairs_down";

    if (isStairsUp) {
      addQuickAction("ascend", "Ascend (<)");
    }
    if (isStairsDown) {
      addQuickAction("descend", "Descend (>)");
    }

    if (!isTargetPlayerTile) {
      addExtendedAction("kick", "Kick");
      addExtendedAction("throw", "Throw");
      addExtendedAction("fire", "Fire");
    }

    if (isMonster) {
      addQuickAction("search", "Search");
      return actions;
    }

    if (isLoot) {
      if (isTargetPlayerTile) {
        addQuickAction("pickup", "Pick Up");
        addQuickAction("loot", "Loot");
        addQuickAction("eat", "Eat");
      }
      return actions;
    }

    if (materialKind === "door") {
      addQuickAction("open", "Open");
      addQuickAction("close", "Close");
      addExtendedAction("kick", "Kick");
      addQuickAction("search", "Search");
      return actions;
    }

    if (isStairsUp || isStairsDown) {
      addQuickAction("search", "Search");
      if (isTargetPlayerTile) {
        addQuickAction("pickup", "Pick Up");
      }
      return actions;
    }

    if (materialKind === "water" || materialKind === "fountain") {
      addQuickAction("quaff", "Quaff");
    }

    if (
      materialKind === "water" ||
      materialKind === "fountain" ||
      materialKind === "trap" ||
      materialKind === "feature"
    ) {
      addQuickAction("search", "Search");
      addQuickAction("pickup", "Pick Up");
      return actions;
    }

    if (isWall) {
      addQuickAction("search", "Search");
      return actions;
    }

    addQuickAction("search", "Search");
    if (isTargetPlayerTile) {
      addQuickAction("pickup", "Pick Up");
      addQuickAction("loot", "Loot");
      if (glanceSuggestsEdibleLoot) {
        addQuickAction("eat", "Eat");
      }
    }
    return actions;
  }

  private getFpsCrosshairTitle(
    key: string,
    mesh: THREE.Mesh,
    glanceHint: FpsCrosshairTargetHint | null = null,
    glanceText: string | null = null,
  ): string {
    const glanceTitle = String(glanceText || "")
      .replace(/\s+/g, " ")
      .trim();
    if (glanceTitle) {
      return glanceTitle;
    }

    const hint = glanceHint ?? this.getFpsCrosshairHintFromTile(key, mesh);
    switch (hint) {
      case "monster":
        return "Target: monster";
      case "loot":
        return "Target: loot";
      case "door":
        return "Target: door";
      case "stairs_up":
        return "Target: stairs up";
      case "stairs_down":
        return "Target: stairs down";
      case "wall":
        return "Target: wall";
      case "water":
        return "Target: water";
      case "trap":
        return "Target: trap";
      case "feature":
        return "Target: feature";
      default:
        return "Target: tile";
    }
  }

  private updateFpsCrosshairContextMenu(): void {
    if (!this.isFpsMode() || !this.fpsCrosshairContextMenuOpen) {
      this.clearFpsCrosshairContextMenu();
      return;
    }

    const nowMs = Date.now();
    this.expireFpsCrosshairGlanceState(nowMs);
    const glanceProbePositionInputActive =
      this.positionInputModeActive && this.fpsCrosshairGlancePending !== null;

    if (
      this.isInQuestion ||
      this.isInDirectionQuestion ||
      this.isTextInputActive ||
      (this.positionInputModeActive && !glanceProbePositionInputActive) ||
      this.metaCommandModeActive ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen() ||
      this.isAnyModalVisible()
    ) {
      this.clearFpsCrosshairContextMenu();
      return;
    }

    let target = this.getTileUnderFpsCrosshair();
    let treatAsVoidWallTarget = false;
    if (!target) {
      const aim = this.getFpsAimDirectionFromCamera();
      if (!aim) {
        this.clearFpsCrosshairContextMenu();
        return;
      }
      const fallbackX = this.playerPos.x + aim.dx;
      const fallbackY = this.playerPos.y + aim.dy;
      const fallbackKey = `${fallbackX},${fallbackY}`;
      const fallbackMesh =
        this.tileMap.get(fallbackKey) ?? this.fpsVoidContextMesh;
      target = {
        key: fallbackKey,
        x: fallbackX,
        y: fallbackY,
        mesh: fallbackMesh,
      };
      treatAsVoidWallTarget = fallbackMesh === this.fpsVoidContextMesh;
    }

    const resolved = this.resolveContextActionTarget(target);
    if (!treatAsVoidWallTarget && resolved.allowGlanceProbe) {
      this.startTileContextGlanceProbe(target, nowMs);
    }
    const glanceEntry = treatAsVoidWallTarget
      ? null
      : this.getCachedFpsCrosshairGlanceEntry(target.key, nowMs);
    const glanceHint: FpsCrosshairTargetHint | null = treatAsVoidWallTarget
      ? "wall"
      : (resolved.glanceHintOverride ?? glanceEntry?.hint ?? null);
    const actions = this.getFpsCrosshairActionsForTile(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? null,
    );
    if (actions.length === 0) {
      this.clearFpsCrosshairContextMenu();
      return;
    }

    let title = this.getFpsCrosshairTitle(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? resolved.fallbackTitle,
    );
    if (
      !treatAsVoidWallTarget &&
      resolved.allowGlanceProbe &&
      glanceHint === null &&
      this.fpsCrosshairGlancePending &&
      this.fpsCrosshairGlancePending.tileKey === target.key
    ) {
      title = `${title} (scanning...)`;
    }
    const signature = `${target.x},${target.y}|${title}|${actions
      .map((action) => `${action.kind}:${action.id}:${action.value}`)
      .join(",")}`;
    if (signature === this.fpsCrosshairContextSignature) {
      return;
    }

    this.fpsCrosshairContextSignature = signature;
    this.activeContextActionTile = { x: target.x, y: target.y };
    const state: FpsCrosshairContextState = {
      title,
      tileX: target.x,
      tileY: target.y,
      actions,
      autoDirectionFromFpsAim: true,
    };
    this.uiAdapter.setFpsCrosshairContext(state);
  }

  private updateNormalTileContextMenu(): void {
    if ((!this.vrTileContextMode && this.isFpsMode()) || !this.normalTileContextMenuOpen) {
      this.closeNormalTileContextMenu();
      return;
    }
    if (
      this.isInQuestion ||
      this.isInDirectionQuestion ||
      this.isTextInputActive ||
      this.positionInputModeActive ||
      this.metaCommandModeActive ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen() ||
      this.isAnyModalVisible()
    ) {
      this.closeNormalTileContextMenu();
      return;
    }

    const currentTarget = this.normalTileContextTarget;
    if (!currentTarget) {
      this.closeNormalTileContextMenu();
      return;
    }

    const liveMesh = this.tileMap.get(currentTarget.key);
    const target = liveMesh
      ? { ...currentTarget, mesh: liveMesh }
      : currentTarget;
    this.normalTileContextTarget = target;
    this.setContextSelectionHighlight(target.x, target.y);

    const nowMs = Date.now();
    this.expireFpsCrosshairGlanceState(nowMs);
    const resolved = this.resolveContextActionTarget(target);
    if (resolved.allowGlanceProbe) {
      this.startTileContextGlanceProbe(target, nowMs);
    }
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(
      target.key,
      nowMs,
    );
    const glanceHint = resolved.glanceHintOverride ?? glanceEntry?.hint ?? null;
    const actions = this.getFpsCrosshairActionsForTile(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? null,
    );
    if (actions.length === 0) {
      this.closeNormalTileContextMenu();
      return;
    }

    let title = this.getFpsCrosshairTitle(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? resolved.fallbackTitle,
    );
    if (
      resolved.allowGlanceProbe &&
      glanceHint === null &&
      this.fpsCrosshairGlancePending &&
      this.fpsCrosshairGlancePending.tileKey === target.key
    ) {
      title = `${title} (scanning...)`;
    }
    const anchor = this.getTileContextAnchorClientPosition(target);
    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const fallbackAnchorX = Math.round(
      canvasRect.left + canvasRect.width * 0.5,
    );
    const fallbackAnchorY = Math.round(
      canvasRect.top + canvasRect.height * 0.5,
    );
    const anchorX =
      anchor && Number.isFinite(anchor.x)
        ? Math.round(anchor.x)
        : fallbackAnchorX;
    const anchorY =
      anchor && Number.isFinite(anchor.y)
        ? Math.round(anchor.y)
        : fallbackAnchorY;
    const signature = `${target.x},${target.y}|${title}|${actions
      .map((action) => `${action.kind}:${action.id}:${action.value}`)
      .join(",")}|${anchorX},${anchorY}`;
    if (signature === this.normalTileContextSignature) {
      return;
    }
    this.normalTileContextSignature = signature;
    this.activeContextActionTile = { x: target.x, y: target.y };
    this.uiAdapter.setFpsCrosshairContext({
      title,
      tileX: target.x,
      tileY: target.y,
      actions,
      autoDirectionFromFpsAim: false,
      anchorClientX: anchorX,
      anchorClientY: anchorY,
    });
  }

  private updateContextSelectionHighlight(timeMs: number): void {
    const highlightedTile =
      this.vrHoveredTile ?? this.selectedContextHighlightTile;
    if (highlightedTile) {
      this.ensureFpsAimVisuals();
      const { x, y } = highlightedTile;
      const targetTile = this.tileMap.get(`${x},${y}`) ?? null;
      if (targetTile && this.fpsForwardHighlight) {
        const targetZ = targetTile.userData?.isWall ? WALL_HEIGHT + 0.02 : 0.03;
        this.fpsForwardHighlight.position.set(
          x * TILE_SIZE,
          -y * TILE_SIZE,
          targetZ,
        );
        this.fpsForwardHighlight.visible = true;
        if (this.fpsForwardHighlightMaterial) {
          const pulse = timeMs <= this.fpsAimLinePulseUntilMs ? 1 : 0.45;
          this.fpsForwardHighlightMaterial.opacity = 0.2 + pulse * 0.32;
        }
        return;
      }
      if (!this.vrHoveredTile) {
        this.closeAnyTileContextMenu(false);
      }
      return;
    }
    if ((!this.isFpsMode() || this.isVrPresenting()) && this.fpsForwardHighlight) {
      this.fpsForwardHighlight.visible = false;
    }
  }

  private handleMouseWheel(event: WheelEvent): void {
    if (this.isFpsMode()) {
      event.preventDefault();
      return;
    }

    // Disable camera zoom while any modal/dialog is visible.
    if (this.isAnyModalVisible()) {
      return;
    }

    // Check if the mouse is over the game log element
    const gameLog = document.getElementById("game-log");
    if (gameLog) {
      const rect = gameLog.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;

      // If mouse is over the game log, allow normal scrolling and don't zoom camera
      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        // Don't prevent default - allow the log to scroll naturally
        return;
      }
    }

    // If not over game log, handle camera zooming
    event.preventDefault();
    const zoomSpeed = 1.0;
    const delta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    this.cameraDistance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.cameraDistance + delta),
    );
  }

  private canUseMapMouseInput(event: MouseEvent): boolean {
    if (!this.session) {
      return false;
    }
    if (event.button !== 0) {
      return false;
    }
    if (event.target !== this.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (this.isAnyModalVisible()) {
      return false;
    }
    if (this.isInQuestion || this.isInDirectionQuestion) {
      return false;
    }
    if (this.metaCommandModeActive) {
      return false;
    }
    if (this.isFpsMode() && !this.positionInputModeActive) {
      return false;
    }
    return true;
  }

  private isTouchEventOnGameCanvas(event: TouchEvent): boolean {
    if (event.target === this.renderer.domElement) {
      return true;
    }
    if (typeof event.composedPath === "function") {
      return event.composedPath().includes(this.renderer.domElement);
    }
    return false;
  }

  private canUseMapTouchInput(event: TouchEvent): boolean {
    if (!this.session) {
      return false;
    }
    if (!this.isTouchEventOnGameCanvas(event)) {
      return false;
    }
    if (this.isAnyModalVisible()) {
      return false;
    }
    if (this.isInQuestion || this.isInDirectionQuestion) {
      return false;
    }
    if (this.metaCommandModeActive || this.positionInputModeActive) {
      return false;
    }
    if (this.isFpsMode()) {
      return false;
    }
    return true;
  }

  private canUseFpsTouchInput(event: TouchEvent): boolean {
    if (!this.session || !this.isFpsMode()) {
      return false;
    }
    if (!this.isTouchEventOnGameCanvas(event)) {
      return false;
    }
    if (this.isAnyModalVisible()) {
      return false;
    }
    if (
      this.isInQuestion ||
      this.isInDirectionQuestion ||
      this.metaCommandModeActive ||
      this.positionInputModeActive
    ) {
      return false;
    }
    return true;
  }

  private clearFpsTouchGestures(): void {
    this.fpsTouchMoveGesture = null;
    this.fpsTouchLookGesture = null;
    this.clearFpsTouchRunButtonHoldTimer();
    this.clearFpsTouchRunButtonState();
  }

  private clearMapTouchContextHoldTimer(): void {
    if (
      this.mapTouchContextHoldTimerId !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(this.mapTouchContextHoldTimerId);
    }
    this.mapTouchContextHoldTimerId = null;
  }

  private cancelMapTouchContextHoldState(): void {
    this.clearMapTouchContextHoldTimer();
    this.mapTouchContextHoldState = null;
  }

  private scheduleMapTouchContextHold(
    touchId: number,
    startX: number,
    startY: number,
  ): void {
    this.cancelMapTouchContextHoldState();
    this.mapTouchContextHoldState = {
      touchId,
      startX,
      startY,
      opened: false,
    };
    if (typeof window === "undefined") {
      return;
    }
    this.mapTouchContextHoldTimerId = window.setTimeout(() => {
      this.mapTouchContextHoldTimerId = null;
      const hold = this.mapTouchContextHoldState;
      if (!hold || hold.touchId !== touchId || hold.opened) {
        return;
      }
      if (
        this.isFpsMode() ||
        !this.session ||
        this.isAnyModalVisible() ||
        this.isInQuestion ||
        this.isInDirectionQuestion ||
        this.metaCommandModeActive ||
        this.positionInputModeActive
      ) {
        return;
      }
      const target = this.getTilePositionFromClientCoordinates(
        hold.startX,
        hold.startY,
      );
      if (!target) {
        return;
      }
      const key = `${target.x},${target.y}`;
      const mesh = this.tileMap.get(key);
      if (!mesh) {
        return;
      }
      this.openNormalTileContextMenuAtTarget({
        key,
        x: target.x,
        y: target.y,
        mesh,
      });
      hold.opened = true;
    }, this.mapTouchContextHoldMs);
  }

  private clearFpsTouchRunButtonHoldTimer(): void {
    if (
      this.fpsTouchRunButtonHoldTimerId !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(this.fpsTouchRunButtonHoldTimerId);
    }
    this.fpsTouchRunButtonHoldTimerId = null;
  }

  private ensureFpsTouchRunButton(): HTMLDivElement {
    if (this.fpsTouchRunButton) {
      return this.fpsTouchRunButton;
    }
    const button = document.createElement("div");
    button.textContent = "Run";
    button.setAttribute("aria-hidden", "true");
    button.className = "nh3d-fps-touch-run-button";
    button.style.left = "0px";
    button.style.top = "0px";
    button.style.width = `${this.fpsTouchRunButtonSizePx}px`;
    button.style.height = `${this.fpsTouchRunButtonSizePx}px`;
    const host = this.mountElement ?? document.body;
    host.appendChild(button);
    this.fpsTouchRunButton = button;
    return button;
  }

  private clearFpsTouchRunButtonState(): void {
    this.fpsTouchRunButtonTouchId = null;
    this.fpsTouchRunButtonActive = false;
    this.fpsTouchRunButtonCenterX = 0;
    this.fpsTouchRunButtonCenterY = 0;
    if (this.fpsTouchRunButton) {
      this.fpsTouchRunButton.classList.remove("is-visible", "is-active");
    }
  }

  private scheduleFpsTouchRunButtonHold(gesture: FpsTouchGestureState): void {
    this.clearFpsTouchRunButtonHoldTimer();
    if (typeof window === "undefined") {
      return;
    }
    this.fpsTouchRunButtonHoldTimerId = window.setTimeout(() => {
      this.fpsTouchRunButtonHoldTimerId = null;
      const activeGesture = this.fpsTouchMoveGesture;
      if (!activeGesture || activeGesture.touchId !== gesture.touchId) {
        return;
      }
      if (this.fpsTouchRunButtonTouchId !== null) {
        return;
      }
      this.showFpsTouchRunButtonForGesture(activeGesture);
      this.setFpsTouchRunButtonActive(
        this.isTouchOverFpsRunButton(activeGesture.lastX, activeGesture.lastY),
      );
    }, this.fpsTouchRunButtonHoldMs);
  }

  private showFpsTouchRunButtonForGesture(gesture: FpsTouchGestureState): void {
    const button = this.ensureFpsTouchRunButton();
    const hostRect = this.mountElement?.getBoundingClientRect();
    const hostLeft = hostRect?.left ?? 0;
    const hostTop = hostRect?.top ?? 0;
    const hostWidth = hostRect?.width ?? window.innerWidth;
    const hostHeight = hostRect?.height ?? window.innerHeight;
    const hostRight = hostLeft + hostWidth;
    const hostBottom = hostTop + hostHeight;
    const half = this.fpsTouchRunButtonSizePx / 2;
    const margin = 8;
    const minX = hostLeft + half + margin;
    const minY = hostTop + half + margin;
    const maxX = Math.max(minX, hostRight - half - margin);
    const maxY = Math.max(minY, hostBottom - half - margin);
    const centerX = THREE.MathUtils.clamp(gesture.startX, minX, maxX);
    const offsetY = this.resolveFpsTouchRunButtonOffsetY();
    const centerY = THREE.MathUtils.clamp(gesture.startY - offsetY, minY, maxY);
    this.fpsTouchRunButtonTouchId = gesture.touchId;
    this.fpsTouchRunButtonCenterX = centerX;
    this.fpsTouchRunButtonCenterY = centerY;
    this.fpsTouchRunButtonActive = false;
    button.style.left = `${centerX - hostLeft}px`;
    button.style.top = `${centerY - hostTop}px`;
    button.classList.add("is-visible");
    button.classList.remove("is-active");
  }

  private resolveFpsTouchRunButtonOffsetY(): number {
    if (typeof window === "undefined") {
      return this.fpsTouchRunButtonOffsetYPx;
    }
    return window.innerWidth > window.innerHeight
      ? this.fpsTouchRunButtonLandscapeOffsetYPx
      : this.fpsTouchRunButtonOffsetYPx;
  }

  private isTouchOverFpsRunButton(clientX: number, clientY: number): boolean {
    if (this.fpsTouchRunButtonTouchId === null) {
      return false;
    }
    const half = this.fpsTouchRunButtonSizePx / 2;
    return (
      clientX >= this.fpsTouchRunButtonCenterX - half &&
      clientX <= this.fpsTouchRunButtonCenterX + half &&
      clientY >= this.fpsTouchRunButtonCenterY - half &&
      clientY <= this.fpsTouchRunButtonCenterY + half
    );
  }

  private setFpsTouchRunButtonActive(active: boolean): void {
    if (this.fpsTouchRunButtonActive === active) {
      return;
    }
    this.fpsTouchRunButtonActive = active;
    const button = this.fpsTouchRunButton;
    if (!button || !button.classList.contains("is-visible")) {
      return;
    }
    button.classList.toggle("is-active", active);
  }

  private updateFpsTouchRunButtonForMoveGesture(
    gesture: FpsTouchGestureState,
    touch: Touch,
    nowMs: number,
  ): void {
    const matchingTouch =
      this.fpsTouchRunButtonTouchId !== null
        ? this.fpsTouchRunButtonTouchId === gesture.touchId
        : true;
    if (!matchingTouch) {
      return;
    }
    if (this.fpsTouchRunButtonTouchId === null) {
      const heldMs = nowMs - gesture.startedAtMs;
      if (heldMs < this.fpsTouchRunButtonHoldMs) {
        return;
      }
      this.showFpsTouchRunButtonForGesture(gesture);
    }
    if (this.fpsTouchRunButtonTouchId !== gesture.touchId) {
      return;
    }
    this.setFpsTouchRunButtonActive(
      this.isTouchOverFpsRunButton(touch.clientX, touch.clientY),
    );
  }

  private findTouchById(list: TouchList, touchId: number): Touch | null {
    for (let i = 0; i < list.length; i += 1) {
      const touch = list.item(i);
      if (touch && touch.identifier === touchId) {
        return touch;
      }
    }
    return null;
  }

  private resolveFpsMovementInputFromSwipe(
    dx: number,
    dy: number,
  ): string | null {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (
      absX < this.touchSwipeMinDistancePx &&
      absY < this.touchSwipeMinDistancePx
    ) {
      return null;
    }

    const axisBiasRatio = 0.62;
    let key: string;
    if (absX <= absY * axisBiasRatio) {
      key = dy < 0 ? "w" : "s";
    } else if (absY <= absX * axisBiasRatio) {
      key = dx < 0 ? "a" : "d";
    } else {
      key = absY >= absX ? (dy < 0 ? "w" : "s") : dx < 0 ? "a" : "d";
    }
    return this.tryResolveFpsMovementInput(key);
  }

  private resolveDirectionKeyFromDelta(
    dx: number,
    dy: number,
    deadzone: number,
  ): string | null {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < deadzone && absY < deadzone) {
      return null;
    }

    const axisBiasRatio = 0.55;
    if (absX <= absY * axisBiasRatio) {
      if (dy < 0) {
        return this.numberPadModeEnabled ? "8" : "k";
      }
      return this.numberPadModeEnabled ? "2" : "j";
    }
    if (absY <= absX * axisBiasRatio) {
      if (dx < 0) {
        return this.numberPadModeEnabled ? "4" : "h";
      }
      return this.numberPadModeEnabled ? "6" : "l";
    }

    if (dx < 0 && dy < 0) {
      return this.numberPadModeEnabled ? "7" : "y";
    }
    if (dx > 0 && dy < 0) {
      return this.numberPadModeEnabled ? "9" : "u";
    }
    if (dx < 0 && dy > 0) {
      return this.numberPadModeEnabled ? "1" : "b";
    }
    return this.numberPadModeEnabled ? "3" : "n";
  }

  private resolveSwipeDirectionInput(dx: number, dy: number): string | null {
    return this.resolveDirectionKeyFromDelta(dx, dy, 1);
  }

  private resolveDirectionFromDelta(dx: number, dy: number): string | null {
    return this.resolveDirectionKeyFromDelta(dx, dy, 0.25);
  }

  private getTilePositionFromClientCoordinates(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const target = this.getTileTargetFromPointerNdc(
      this.pointerNdc.x,
      this.pointerNdc.y,
      false,
    );
    if (!target) {
      return null;
    }
    return { x: target.x, y: target.y };
  }

  private getGridPositionFromClientCoordinates(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.pointerRaycaster.setFromCamera(
      this.pointerNdc,
      this.getActivePerspectiveViewCamera(),
    );

    const hit = this.pointerRaycaster.ray.intersectPlane(
      this.groundPlane,
      this.pointerIntersection,
    );
    if (!hit) {
      return null;
    }

    return {
      x: this.pointerIntersection.x / TILE_SIZE,
      y: -this.pointerIntersection.y / TILE_SIZE,
    };
  }

  private getClickedTilePosition(
    event: MouseEvent,
  ): { x: number; y: number } | null {
    return this.getTilePositionFromClientCoordinates(
      event.clientX,
      event.clientY,
    );
  }

  private canUseFpsGameplayMouseInput(event: MouseEvent): boolean {
    if (!this.session || !this.isFpsMode()) {
      return false;
    }
    if (event.target !== this.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (this.isAnyModalVisible()) {
      return false;
    }
    if (
      this.isInQuestion ||
      this.isInDirectionQuestion ||
      this.metaCommandModeActive ||
      this.positionInputModeActive
    ) {
      return false;
    }
    return true;
  }

  private canUseFpsDirectionPromptMouseInput(event: MouseEvent): boolean {
    if (!this.session || !this.isFpsMode() || !this.isInDirectionQuestion) {
      return false;
    }
    if (event.target !== this.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (
      this.isTextInputActive ||
      this.positionInputModeActive ||
      this.metaCommandModeActive ||
      this.fpsCrosshairContextMenuOpen ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  private canUseFpsDirectionPromptTouchInput(event: TouchEvent): boolean {
    if (!this.session || !this.isFpsMode() || !this.isInDirectionQuestion) {
      return false;
    }
    if (!this.isTouchEventOnGameCanvas(event)) {
      return false;
    }
    if (
      this.isTextInputActive ||
      this.positionInputModeActive ||
      this.metaCommandModeActive ||
      this.fpsCrosshairContextMenuOpen ||
      this.isInventoryDialogOpen() ||
      this.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  private resolveFpsDirectionTouchSwipeAction(
    dx: number,
    dy: number,
    durationMs: number,
  ): "confirm" | "self" | "cancel" | null {
    const distance = Math.hypot(dx, dy);
    if (distance < this.touchSwipeMinDistancePx) {
      if (durationMs <= this.fpsTouchTapMaxDurationMs) {
        return "confirm";
      }
      return null;
    }
    if (durationMs > this.touchSwipeMaxDurationMs) {
      return null;
    }

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const axisBiasRatio = 0.62;

    if (absX <= absY * axisBiasRatio) {
      return dy < 0 ? "confirm" : "self";
    }
    if (absY <= absX * axisBiasRatio) {
      return "cancel";
    }
    return absY >= absX ? (dy < 0 ? "confirm" : "self") : "cancel";
  }

  private confirmFpsDirectionQuestionFromAim(): boolean {
    const lookDirectionInput = this.getFpsDirectionQuestionInputFromAim();
    if (!lookDirectionInput) {
      return false;
    }
    this.submitDirectionAnswer(lookDirectionInput);
    return true;
  }

  private applyFpsDirectionTouchAction(
    action: "confirm" | "self" | "cancel",
  ): boolean {
    if (!this.isInDirectionQuestion) {
      return false;
    }

    if (action === "confirm") {
      return this.confirmFpsDirectionQuestionFromAim();
    }

    if (action === "self") {
      this.submitDirectionAnswer("s");
      return true;
    }

    this.sendInput("Escape");
    this.hideDirectionQuestion();
    return true;
  }

  private handleMapMouseInput(event: MouseEvent): boolean {
    if (!this.canUseMapMouseInput(event)) {
      return false;
    }

    const target = this.getClickedTilePosition(event);
    if (!target && event.button === 0) {
      this.pendingPointerAttackTargetContext = null;
      const gridTarget = this.getGridPositionFromClientCoordinates(
        event.clientX,
        event.clientY,
      );
      if (gridTarget) {
        const dx = gridTarget.x - this.playerPos.x;
        const dy = gridTarget.y - this.playerPos.y;
        const direction = this.resolveDirectionFromDelta(dx, dy);
        if (direction) {
          this.sendForcedDirectionalInput(direction);
          return true;
        }
      }
      return false;
    }
    if (!target) {
      return false;
    }

    if (event.button === 0 && !this.hasPlayerMovedOnce) {
      this.lastMovementInputAtMs = Date.now();
    }

    if (event.button === 0) {
      this.updateDirectionalAttackContextFromTarget(target.x, target.y);
      this.setPendingPointerAttackTargetFromTile(target.x, target.y);
    }
    this.logClickLookTileDebug("mouse-primary", target.x, target.y);
    this.sendMouseInput(target.x, target.y, event.button);
    return true;
  }

  private canOpenNormalTileContextMenuFromMouse(event: MouseEvent): boolean {
    if (!this.session || this.isFpsMode()) {
      return false;
    }
    if (event.button !== 2) {
      return false;
    }
    if (event.target !== this.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (this.isAnyModalVisible()) {
      return false;
    }
    if (this.isInQuestion || this.isInDirectionQuestion) {
      return false;
    }
    if (this.metaCommandModeActive || this.positionInputModeActive) {
      return false;
    }
    return true;
  }

  private handleMouseDown(event: MouseEvent): void {
    this.resumeFmodFromUserGesture();

    if (
      !this.isFpsMode() &&
      event.button === 0 &&
      this.shouldConsumeSuppressedMapPrimaryPointerEvent(
        event.target === this.renderer.domElement,
      )
    ) {
      event.preventDefault();
      return;
    }

    if (
      this.isFpsMode() &&
      this.isInDirectionQuestion &&
      event.button === 0 &&
      this.canUseFpsDirectionPromptMouseInput(event)
    ) {
      event.preventDefault();
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock?.();
        return;
      }
      const lookDirectionInput = this.getFpsDirectionQuestionInputFromAim();
      if (!lookDirectionInput) {
        return;
      }
      this.submitDirectionAnswer(lookDirectionInput);
      return;
    }

    if (
      this.isFpsMode() &&
      this.isInDirectionQuestion &&
      event.button === 2 &&
      this.canUseFpsDirectionPromptMouseInput(event)
    ) {
      event.preventDefault();
      this.sendInput("Escape");
      this.hideDirectionQuestion();
      return;
    }

    if (
      this.isFpsMode() &&
      event.button === 0 &&
      this.canUseFpsGameplayMouseInput(event)
    ) {
      event.preventDefault();
      if (this.isFpsFireSuppressed()) {
        if (document.pointerLockElement !== this.renderer.domElement) {
          this.renderer.domElement.requestPointerLock?.();
        }
        return;
      }
      if (this.fpsCrosshairContextMenuOpen) {
        this.closeFpsCrosshairContextMenu(true);
        return;
      }
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock?.();
        return;
      }
      if (this.tryRunFpsSelfTilePrimaryClickAction()) {
        return;
      }
      if (this.tryRunFpsDoorPrimaryClickAction()) {
        return;
      }
      this.fireInCurrentAimDirection();
      return;
    }

    if (
      this.isFpsMode() &&
      event.button === 2 &&
      this.canUseFpsGameplayMouseInput(event)
    ) {
      event.preventDefault();
      if (this.fpsCrosshairContextMenuOpen) {
        this.closeFpsCrosshairContextMenu(true);
      } else {
        this.openFpsCrosshairContextMenu();
      }
      this.isRightMouseDown = false;
      this.rightMouseCanOpenContextMenuOnRelease = false;
      this.rightMouseDragExceededDeadzone = false;
      return;
    }

    if (this.handleMapMouseInput(event)) {
      event.preventDefault();
      return;
    }

    if (event.button === 1) {
      // Middle mouse button - rotation
      event.preventDefault();
      this.isMiddleMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 2) {
      // Right mouse button - panning
      event.preventDefault();
      this.isRightMouseDown = true;
      this.isCameraCenteredOnPlayer = false;
      this.rightMouseDownStartX = event.clientX;
      this.rightMouseDownStartY = event.clientY;
      this.rightMouseDragExceededDeadzone = false;
      this.rightMouseCanOpenContextMenuOnRelease =
        !this.isFpsMode() && this.canOpenNormalTileContextMenuFromMouse(event);
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    this.resumeFmodFromUserGesture();

    if (
      !this.isFpsMode() &&
      this.shouldConsumeSuppressedMapPrimaryPointerEvent(
        this.isTouchEventOnGameCanvas(event),
      )
    ) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.isFpsMode()) {
      this.cancelMapTouchContextHoldState();
      if (this.isInDirectionQuestion) {
        if (!this.canUseFpsDirectionPromptTouchInput(event)) {
          this.clearFpsTouchGestures();
          return;
        }
        this.clearFpsTouchRunButtonHoldTimer();
        this.clearFpsTouchRunButtonState();

        const rect = this.renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          this.clearFpsTouchGestures();
          return;
        }
        const splitX = rect.left + rect.width * 0.5;

        if (this.fpsCrosshairContextMenuOpen) {
          this.closeFpsCrosshairContextMenu(false);
        }

        for (let i = 0; i < event.changedTouches.length; i += 1) {
          const touch = event.changedTouches.item(i);
          if (!touch) {
            continue;
          }
          const gesture: FpsTouchGestureState = {
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            startedAtMs: Date.now(),
          };
          if (touch.clientX < splitX) {
            if (!this.fpsTouchMoveGesture) {
              this.fpsTouchMoveGesture = gesture;
            }
          } else if (!this.fpsTouchLookGesture) {
            this.fpsTouchLookGesture = gesture;
          }
        }

        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (!this.canUseFpsTouchInput(event)) {
        this.clearFpsTouchGestures();
        return;
      }

      const rect = this.renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        this.clearFpsTouchGestures();
        return;
      }
      const splitX = rect.left + rect.width * 0.5;

      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches.item(i);
        if (!touch) {
          continue;
        }
        const gesture: FpsTouchGestureState = {
          touchId: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          lastX: touch.clientX,
          lastY: touch.clientY,
          startedAtMs: Date.now(),
        };
        const isLeftSide = touch.clientX < splitX;
        if (isLeftSide) {
          if (!this.fpsTouchMoveGesture) {
            this.fpsTouchMoveGesture = gesture;
            this.scheduleFpsTouchRunButtonHold(gesture);
            if (this.fpsCrosshairContextMenuOpen) {
              this.closeFpsCrosshairContextMenu(false);
            }
          }
        } else if (!this.fpsTouchLookGesture) {
          this.fpsTouchLookGesture = gesture;
        }
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (!this.canUseMapTouchInput(event)) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      return;
    }

    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY,
      );
      this.pinchZoomStart = { distance, cameraDistance: this.cameraDistance };
      this.touchSwipeStart = null; // Prevent swipe while pinching
      this.cancelMapTouchContextHoldState();
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (event.touches.length !== 1) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      return;
    }

    const touch = event.touches[0];
    this.touchSwipeStart = {
      touchId: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startedAtMs: Date.now(),
      panningActive: false,
    };
    this.pinchZoomStart = null;
    this.scheduleMapTouchContextHold(
      touch.identifier,
      touch.clientX,
      touch.clientY,
    );
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    if (this.isFpsMode()) {
      if (this.isInDirectionQuestion) {
        if (!this.canUseFpsDirectionPromptTouchInput(event)) {
          return;
        }

        let consumed = false;
        if (this.fpsTouchLookGesture) {
          const touch =
            this.findTouchById(
              event.changedTouches,
              this.fpsTouchLookGesture.touchId,
            ) ||
            this.findTouchById(event.touches, this.fpsTouchLookGesture.touchId);
          if (touch) {
            const deltaX = touch.clientX - this.fpsTouchLookGesture.lastX;
            const deltaY = touch.clientY - this.fpsTouchLookGesture.lastY;
            this.applyFpsLookDelta(
              deltaX,
              deltaY,
              this.fpsTouchLookSensitivity,
            );
            this.fpsTouchLookGesture.lastX = touch.clientX;
            this.fpsTouchLookGesture.lastY = touch.clientY;
            consumed = true;
          }
        }

        if (this.fpsTouchMoveGesture) {
          const touch =
            this.findTouchById(
              event.changedTouches,
              this.fpsTouchMoveGesture.touchId,
            ) ||
            this.findTouchById(event.touches, this.fpsTouchMoveGesture.touchId);
          if (touch) {
            this.fpsTouchMoveGesture.lastX = touch.clientX;
            this.fpsTouchMoveGesture.lastY = touch.clientY;
            consumed = true;
          }
        }

        if (consumed && event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (!this.canUseFpsTouchInput(event)) {
        this.clearFpsTouchGestures();
        return;
      }

      const nowMs = Date.now();
      let consumed = false;
      if (this.fpsTouchLookGesture) {
        const touch =
          this.findTouchById(
            event.changedTouches,
            this.fpsTouchLookGesture.touchId,
          ) ||
          this.findTouchById(event.touches, this.fpsTouchLookGesture.touchId);
        if (touch) {
          const deltaX = touch.clientX - this.fpsTouchLookGesture.lastX;
          const deltaY = touch.clientY - this.fpsTouchLookGesture.lastY;
          const traveled = Math.hypot(
            touch.clientX - this.fpsTouchLookGesture.startX,
            touch.clientY - this.fpsTouchLookGesture.startY,
          );
          if (
            traveled >= this.fpsTouchLookMoveThresholdPx &&
            this.fpsCrosshairContextMenuOpen
          ) {
            this.closeFpsCrosshairContextMenu(false);
          }
          this.applyFpsLookDelta(deltaX, deltaY, this.fpsTouchLookSensitivity);
          this.fpsTouchLookGesture.lastX = touch.clientX;
          this.fpsTouchLookGesture.lastY = touch.clientY;
          consumed = true;
        }
      }

      if (this.fpsTouchMoveGesture) {
        const touch =
          this.findTouchById(
            event.changedTouches,
            this.fpsTouchMoveGesture.touchId,
          ) ||
          this.findTouchById(event.touches, this.fpsTouchMoveGesture.touchId);
        if (touch) {
          this.fpsTouchMoveGesture.lastX = touch.clientX;
          this.fpsTouchMoveGesture.lastY = touch.clientY;
          this.updateFpsTouchRunButtonForMoveGesture(
            this.fpsTouchMoveGesture,
            touch,
            nowMs,
          );
          if (this.fpsCrosshairContextMenuOpen) {
            const traveled = Math.hypot(
              touch.clientX - this.fpsTouchMoveGesture.startX,
              touch.clientY - this.fpsTouchMoveGesture.startY,
            );
            if (traveled >= this.touchSwipeMinDistancePx) {
              this.closeFpsCrosshairContextMenu(false);
            }
          }
          consumed = true;
        }
      }

      if (consumed && event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (!this.canUseMapTouchInput(event)) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      return;
    }

    if (this.pinchZoomStart && event.touches.length === 2) {
      this.cancelMapTouchContextHoldState();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY,
      );
      const startDistance = this.pinchZoomStart.distance;
      const scale = startDistance / distance;

      const newCameraDistance = this.pinchZoomStart.cameraDistance * scale;
      this.cameraDistance = THREE.MathUtils.clamp(
        newCameraDistance,
        this.minDistance,
        this.maxDistance,
      );

      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (!this.touchSwipeStart) {
      return;
    }

    const touch =
      this.findTouchById(event.touches, this.touchSwipeStart.touchId) ||
      this.findTouchById(event.changedTouches, this.touchSwipeStart.touchId);
    if (!touch) {
      return;
    }
    const holdState = this.mapTouchContextHoldState;
    if (holdState && holdState.touchId === this.touchSwipeStart.touchId) {
      const holdDx = touch.clientX - holdState.startX;
      const holdDy = touch.clientY - holdState.startY;
      if (Math.hypot(holdDx, holdDy) >= this.mapTouchContextHoldDeadzonePx) {
        this.cancelMapTouchContextHoldState();
      }
    }

    const nowMs = Date.now();
    const elapsedMs = nowMs - this.touchSwipeStart.startedAtMs;
    if (!this.touchSwipeStart.panningActive) {
      const travelX = touch.clientX - this.touchSwipeStart.x;
      const travelY = touch.clientY - this.touchSwipeStart.y;
      const traveled = Math.hypot(travelX, travelY);
      if (
        elapsedMs >= this.touchSwipePanHoldMs &&
        traveled >= this.touchSwipeMinDistancePx
      ) {
        this.touchSwipeStart.panningActive = true;
        this.isCameraCenteredOnPlayer = false;
      }
    }

    if (this.touchSwipeStart.panningActive) {
      const deltaX = touch.clientX - this.touchSwipeStart.lastX;
      const deltaY = touch.clientY - this.touchSwipeStart.lastY;
      const panSpeed = 0.05;
      const touchPanDirection = this.clientOptions.invertTouchPanningDirection
        ? -1
        : 1;
      this.cameraPanX += -deltaX * panSpeed * touchPanDirection;
      this.cameraPanY += deltaY * panSpeed * touchPanDirection;
      this.cameraPanTargetX = this.cameraPanX;
      this.cameraPanTargetY = this.cameraPanY;
      this.isCameraCenteredOnPlayer = false;
      this.touchSwipeStart.lastX = touch.clientX;
      this.touchSwipeStart.lastY = touch.clientY;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (this.isFpsMode()) {
      if (this.isInDirectionQuestion) {
        this.clearFpsTouchRunButtonHoldTimer();
        this.clearFpsTouchRunButtonState();
        if (!event.changedTouches || event.changedTouches.length === 0) {
          return;
        }

        let consumed = false;
        const nowMs = Date.now();
        for (let i = 0; i < event.changedTouches.length; i += 1) {
          const touch = event.changedTouches.item(i);
          if (!touch) {
            continue;
          }

          if (
            this.fpsTouchMoveGesture &&
            touch.identifier === this.fpsTouchMoveGesture.touchId
          ) {
            const gesture = this.fpsTouchMoveGesture;
            this.fpsTouchMoveGesture = null;
            const dx = touch.clientX - gesture.startX;
            const dy = touch.clientY - gesture.startY;
            const durationMs = nowMs - gesture.startedAtMs;
            const action = this.resolveFpsDirectionTouchSwipeAction(
              dx,
              dy,
              durationMs,
            );
            if (action && this.applyFpsDirectionTouchAction(action)) {
              consumed = true;
            }
          }

          if (
            this.fpsTouchLookGesture &&
            touch.identifier === this.fpsTouchLookGesture.touchId
          ) {
            const gesture = this.fpsTouchLookGesture;
            this.fpsTouchLookGesture = null;
            const dx = touch.clientX - gesture.startX;
            const dy = touch.clientY - gesture.startY;
            const distance = Math.hypot(dx, dy);
            const durationMs = nowMs - gesture.startedAtMs;
            const isTap =
              distance < this.fpsTouchLookMoveThresholdPx &&
              durationMs <= this.fpsTouchTapMaxDurationMs;
            if (isTap && this.confirmFpsDirectionQuestionFromAim()) {
              consumed = true;
            }
          }
        }

        if (consumed && event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (!event.changedTouches || event.changedTouches.length === 0) {
        return;
      }

      let consumed = false;
      const nowMs = Date.now();
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches.item(i);
        if (!touch) {
          continue;
        }

        if (
          this.fpsTouchLookGesture &&
          touch.identifier === this.fpsTouchLookGesture.touchId
        ) {
          const gesture = this.fpsTouchLookGesture;
          this.fpsTouchLookGesture = null;
          const dx = touch.clientX - gesture.startX;
          const dy = touch.clientY - gesture.startY;
          const distance = Math.hypot(dx, dy);
          const durationMs = nowMs - gesture.startedAtMs;
          const isTap =
            distance < this.fpsTouchLookMoveThresholdPx &&
            durationMs <= this.fpsTouchTapMaxDurationMs;
          if (isTap) {
            if (this.fpsCrosshairContextMenuOpen) {
              this.closeFpsCrosshairContextMenu(false);
            } else {
              this.openFpsCrosshairContextMenu();
            }
            consumed = true;
          }
        }

        if (
          this.fpsTouchMoveGesture &&
          touch.identifier === this.fpsTouchMoveGesture.touchId
        ) {
          const gesture = this.fpsTouchMoveGesture;
          this.fpsTouchMoveGesture = null;
          this.clearFpsTouchRunButtonHoldTimer();
          const dx = touch.clientX - gesture.startX;
          const dy = touch.clientY - gesture.startY;
          const hadRunButtonForTouch =
            this.fpsTouchRunButtonTouchId === touch.identifier;
          const runButtonActive =
            hadRunButtonForTouch && this.fpsTouchRunButtonActive;
          if (hadRunButtonForTouch) {
            this.clearFpsTouchRunButtonState();
            const fpsMoveInput = this.resolveFpsMovementInputFromSwipe(dx, dy);
            if (runButtonActive && fpsMoveInput) {
              if (this.fpsCrosshairContextMenuOpen) {
                this.closeFpsCrosshairContextMenu(false);
              }
              if (!this.hasPlayerMovedOnce) {
                this.lastMovementInputAtMs = nowMs;
              }
              this.onSwipeCommandExecuted();
              this.sendForcedDirectionalInput(fpsMoveInput);
            }
            // Releasing off the run button cancels the swipe entirely.
            consumed = true;
            continue;
          }

          const durationMs = nowMs - gesture.startedAtMs;
          const fpsMoveInput =
            durationMs <= this.touchSwipeMaxDurationMs
              ? this.resolveFpsMovementInputFromSwipe(dx, dy)
              : null;
          if (fpsMoveInput) {
            if (this.fpsCrosshairContextMenuOpen) {
              this.closeFpsCrosshairContextMenu(false);
            }
            if (!this.hasPlayerMovedOnce) {
              this.lastMovementInputAtMs = nowMs;
            }
            this.onSwipeCommandExecuted();
            this.sendInput(fpsMoveInput);
            consumed = true;
          }
        }
      }

      if (consumed && event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.pinchZoomStart) {
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    const start = this.touchSwipeStart;
    this.touchSwipeStart = null;
    const holdState = this.mapTouchContextHoldState;
    this.clearMapTouchContextHoldTimer();
    if (!start || !this.canUseMapTouchInput(event)) {
      this.mapTouchContextHoldState = null;
      return;
    }
    if (!event.changedTouches || event.changedTouches.length === 0) {
      this.mapTouchContextHoldState = null;
      return;
    }

    const touch =
      this.findTouchById(event.changedTouches, start.touchId) ||
      event.changedTouches[0];
    if (!touch) {
      this.mapTouchContextHoldState = null;
      return;
    }

    if (holdState && holdState.touchId === start.touchId && holdState.opened) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (start.panningActive) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    const durationMs = Date.now() - start.startedAtMs;
    if (durationMs >= this.mapTouchContextHoldMs) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }
    if (
      distance < this.touchSwipeMinDistancePx ||
      durationMs > this.touchSwipeMaxDurationMs
    ) {
      const target = this.getTilePositionFromClientCoordinates(
        touch.clientX,
        touch.clientY,
      );
      if (!target) {
        this.pendingPointerAttackTargetContext = null;
        const gridTarget = this.getGridPositionFromClientCoordinates(
          touch.clientX,
          touch.clientY,
        );
        if (!gridTarget) {
          this.mapTouchContextHoldState = null;
          return;
        }
        const dx = gridTarget.x - this.playerPos.x;
        const dy = gridTarget.y - this.playerPos.y;
        const direction = this.resolveDirectionFromDelta(dx, dy);
        if (direction) {
          if (event.cancelable) {
            event.preventDefault();
          }
          this.onSwipeCommandExecuted();
          this.sendForcedDirectionalInput(direction);
        }
        this.mapTouchContextHoldState = null;
        return;
      }
      if (!this.hasPlayerMovedOnce) {
        this.lastMovementInputAtMs = Date.now();
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      this.updateDirectionalAttackContextFromTarget(target.x, target.y);
      this.setPendingPointerAttackTargetFromTile(target.x, target.y);
      this.onSwipeCommandExecuted();
      this.logClickLookTileDebug("touch-primary", target.x, target.y);
      this.sendMouseInput(target.x, target.y, 0);
      this.mapTouchContextHoldState = null;
      return;
    }

    const swipeInput = this.resolveSwipeDirectionInput(dx, dy);
    if (!swipeInput) {
      this.mapTouchContextHoldState = null;
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.onSwipeCommandExecuted();
    this.sendInput(swipeInput);
    this.mapTouchContextHoldState = null;
  }

  private handleTouchCancel(): void {
    if (this.isFpsMode()) {
      this.clearFpsTouchGestures();
      return;
    }
    this.touchSwipeStart = null;
    this.pinchZoomStart = null;
    this.cancelMapTouchContextHoldState();
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isFpsMode() && this.fpsPointerLockActive) {
      const deltaX = event.movementX || 0;
      const deltaY = event.movementY || 0;
      this.applyFpsLookDelta(deltaX, deltaY, this.firstPersonMouseSensitivity);
      return;
    }

    if (this.isMiddleMouseDown) {
      // Middle mouse - rotate camera
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      if (this.isFpsMode()) {
        this.applyFpsLookDelta(deltaX, deltaY, this.rotationSpeed);
      } else {
        this.cameraYaw = this.wrapAngle(
          this.cameraYaw + deltaX * this.rotationSpeed,
        );
        this.cameraPitch = THREE.MathUtils.clamp(
          this.cameraPitch + deltaY * this.rotationSpeed,
          this.minCameraPitch,
          this.maxCameraPitch,
        );
      }

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (this.isFpsMode() && this.isRightMouseDown) {
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      this.applyFpsLookDelta(deltaX, deltaY, this.rotationSpeed);
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (this.isRightMouseDown) {
      // Right mouse - pan camera
      event.preventDefault();
      if (!this.rightMouseDragExceededDeadzone) {
        const movedDistance = Math.hypot(
          event.clientX - this.rightMouseDownStartX,
          event.clientY - this.rightMouseDownStartY,
        );
        if (movedDistance > this.rightMouseContextDeadzonePx) {
          this.rightMouseDragExceededDeadzone = true;
        }
      }
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      const panSpeed = 0.05;
      this.cameraPanX -= deltaX * panSpeed;
      this.cameraPanY += deltaY * panSpeed;
      this.cameraPanTargetX = this.cameraPanX;
      this.cameraPanTargetY = this.cameraPanY;
      this.isCameraCenteredOnPlayer = false;

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 1) {
      // Middle mouse button
      this.isMiddleMouseDown = false;
    } else if (event.button === 2) {
      // Right mouse button
      const wasRightMouseDown = this.isRightMouseDown;
      this.isRightMouseDown = false;
      if (
        wasRightMouseDown &&
        this.rightMouseCanOpenContextMenuOnRelease &&
        !this.rightMouseDragExceededDeadzone
      ) {
        const target = this.getTilePositionFromClientCoordinates(
          this.rightMouseDownStartX,
          this.rightMouseDownStartY,
        );
        if (!target) {
          this.closeAnyTileContextMenu(false);
        } else {
          const key = `${target.x},${target.y}`;
          const mesh = this.tileMap.get(key);
          if (!mesh) {
            this.closeAnyTileContextMenu(false);
          } else {
            this.openNormalTileContextMenuAtTarget({
              key,
              x: target.x,
              y: target.y,
              mesh,
            });
          }
        }
        event.preventDefault();
      }
      this.rightMouseCanOpenContextMenuOnRelease = false;
      this.rightMouseDragExceededDeadzone = false;
    }
  }

  private updateRendererResolution(): void {
    const viewport = this.getRendererViewportSize();
    const pixelRatio = THREE.MathUtils.clamp(
      window.devicePixelRatio || 1,
      1,
      this.maxRendererPixelRatio,
    );
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(viewport.width, viewport.height, false);
    // Keep CSS presentation size aligned with logical viewport when updateStyle=false.
    this.renderer.domElement.style.width = `${viewport.width}px`;
    this.renderer.domElement.style.height = `${viewport.height}px`;
    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(viewport.width, viewport.height);
      if (this.taaRenderPass) {
        this.taaRenderPass.accumulate = false;
      }
    }
  }

  private onWindowResize(): void {
    const viewport = this.getRendererViewportSize();
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.updateProjectionMatrix();
    this.updateRendererResolution();
    this.recenterCameraOnPlayerIfNeeded();
  }

  private getRendererViewportSize(): { width: number; height: number } {
    const hostWidth = this.mountElement?.clientWidth ?? 0;
    const hostHeight = this.mountElement?.clientHeight ?? 0;
    const width = hostWidth > 0 ? hostWidth : window.innerWidth;
    const height = hostHeight > 0 ? hostHeight : window.innerHeight;
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }

  private disposeAntialiasingPipeline(): void {
    this.taaRenderPass?.dispose();
    this.fxaaPass?.dispose();
    this.toneAdjustPass?.dispose();
    this.composer?.dispose();
    this.taaRenderPass = null;
    this.fxaaPass = null;
    this.toneAdjustPass = null;
    this.composer = null;
  }

  private initAntialiasingPipeline(): void {
    this.disposeAntialiasingPipeline();
    const composer = new EffectComposer(this.renderer);
    composer.addPass(
      new RenderPass(
        this.scene,
        this.camera,
        undefined,
        new THREE.Color(0x000000),
        0,
      ),
    );
    if (this.clientOptions.antialiasing === "taa") {
      const taaRenderPass = new TAARenderPass(this.scene, this.camera);
      taaRenderPass.sampleLevel = this.desktopTaaSampleLevel;
      taaRenderPass.unbiased = true;
      // Keep TAA in non-accumulating mode so animated scene content continues updating.
      taaRenderPass.accumulate = false;
      composer.addPass(taaRenderPass);
      this.taaRenderPass = taaRenderPass;
      this.fxaaPass = null;
    } else {
      const fxaaPass = new FXAAPass();
      composer.addPass(fxaaPass);
      this.fxaaPass = fxaaPass;
      this.taaRenderPass = null;
    }
    const toneAdjustPass = new ShaderPass(toneAdjustShader);
    composer.addPass(toneAdjustPass);
    this.toneAdjustPass = toneAdjustPass;
    this.updateToneAdjustPostProcess();
    this.composer = composer;
  }

  private updateToneAdjustPostProcess(): void {
    if (!this.toneAdjustPass) {
      return;
    }
    this.toneAdjustPass.uniforms["brightness"].value =
      this.clientOptions.brightness;
    this.toneAdjustPass.uniforms["contrast"].value =
      this.clientOptions.contrast;
    this.toneAdjustPass.uniforms["gamma"].value = this.clientOptions.gamma;
  }

  private updateTaaState(): void {
    const taaRenderPass = this.taaRenderPass;
    if (!taaRenderPass) {
      return;
    }
    taaRenderPass.accumulate = false;
  }

  private getMeshOverlayMaterial(
    mesh: THREE.Mesh,
  ): THREE.MeshBasicMaterial | null {
    const material = mesh.material;
    if (Array.isArray(material)) {
      const top = material[4];
      return top instanceof THREE.MeshBasicMaterial ? top : null;
    }
    return material instanceof THREE.MeshBasicMaterial ? material : null;
  }

  private updateEffectAnimations(timeMs: number): void {
    if (this.activeEffectTileKeys.size === 0) {
      return;
    }

    const phaseBase = timeMs / 240;
    const staleKeys: string[] = [];
    for (const key of this.activeEffectTileKeys) {
      const mesh = this.tileMap.get(key);
      if (!mesh) {
        staleKeys.push(key);
        continue;
      }

      const effectKind = mesh.userData.effectKind as
        | TileEffectKind
        | null
        | undefined;
      const overlayMaterial = this.getMeshOverlayMaterial(mesh);
      if (!overlayMaterial) {
        staleKeys.push(key);
        continue;
      }

      if (!effectKind) {
        overlayMaterial.color.set("#ffffff");
        staleKeys.push(key);
        continue;
      }

      const wave =
        0.72 +
        0.28 *
          Math.sin(phaseBase + mesh.position.x * 0.2 + mesh.position.y * 0.2);
      this.effectPulseColor
        .copy(this.effectColors[effectKind])
        .multiplyScalar(THREE.MathUtils.clamp(wave, 0.4, 1.2));
      overlayMaterial.color.copy(this.effectPulseColor);
    }

    for (const key of staleKeys) {
      this.activeEffectTileKeys.delete(key);
    }
  }

  private updateTileRevealFades(timeMs: number): void {
    if (this.tileRevealStartMs.size === 0) {
      return;
    }

    const staleKeys: string[] = [];
    for (const [key, startedAtMs] of this.tileRevealStartMs.entries()) {
      const overlay = this.glyphOverlayMap.get(key);
      if (!overlay) {
        staleKeys.push(key);
        continue;
      }

      const elapsedMs = timeMs - startedAtMs;
      const t = THREE.MathUtils.clamp(
        elapsedMs / this.tileRevealDurationMs,
        0,
        1,
      );
      // Ease-out cubic: fast start, gentle finish.
      const eased = 1 - Math.pow(1 - t, 3);

      overlay.material.opacity = eased;
      const mesh = this.tileMap.get(key);
      const sideOverlays = mesh ? this.getAllWallSideTileOverlays(mesh) : [];
      for (const sideOverlay of sideOverlays) {
        sideOverlay.material.opacity = eased;
      }

      if (t >= 1) {
        overlay.material.opacity = 1;
        for (const sideOverlay of sideOverlays) {
          sideOverlay.material.opacity = 1;
        }
        staleKeys.push(key);
      }
    }

    for (const key of staleKeys) {
      this.tileRevealStartMs.delete(key);
    }
  }

  private animate(timeMs: number = performance.now()): void {
    const rawDeltaMs =
      this.lastFrameTimeMs === null ? 1000 / 60 : timeMs - this.lastFrameTimeMs;
    this.lastFrameTimeMs = timeMs;
    const deltaSeconds = Math.max(0, Math.min(rawDeltaMs, 250)) / 1000;

    this.syncFpsPointerLockForUiState(false);
    this.updateCameraPanInertia(deltaSeconds);
    this.updateCamera(deltaSeconds);
    this.updateFpsPlayerLightPosition();
    this.updateFpsCrosshairContextMenu();
    this.updateNormalTileContextMenu();
    this.updateFpsAimVisuals(timeMs);
    this.updateContextSelectionHighlight(timeMs);
    this.updateLightingCenter(deltaSeconds);
    this.vrSessionController?.update(deltaSeconds);
    if (this.clientOptions.minimap) {
      this.renderMinimapViewportOverlay();
    }
    this.updateMetaCommandModalPosition();
    this.disposeLightingOverlay();
    this.updateEffectAnimations(timeMs);
    this.updateDamageEffects(deltaSeconds);
    this.updateTileRevealFades(timeMs);
    if (this.composer && !this.isVrPresenting()) {
      this.updateTaaState();
      this.composer.render(deltaSeconds);
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

export default Nethack3DEngine;
