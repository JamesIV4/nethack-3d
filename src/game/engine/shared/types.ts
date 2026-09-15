import * as THREE from "three";
import type { TileMaterialKind } from "../../glyphs";
import type { TerrainSnapshot } from "../../types";
import { type Nh3dControllerActionId } from "../../controller-bindings";
import { type VultureTileLookup } from "../../vulture/translation";
import { type FpsHeldWeaponAnimationVector3 } from "../../fps-held-weapon-animations";

export type PendingCharacterDamage = {
  amount: number;
  createdAtMs: number;
  expectedDirection: DirectionalAttackContext | null;
  expectedTile: {
    x: number;
    y: number;
  } | null;
};

export type Nh3dAndroidBridge = {
  getGamepadStateJson?: () => string;
  vibrate?: (durationMs: number, amplitude: number) => void;
};

export type Nh3dAndroidNativeGamepadState = {
  connected?: unknown;
  timestamp?: unknown;
  axes?: unknown;
  buttons?: unknown;
};

export type DirectionalAttackContext = {
  dx: number;
  dy: number;
  originX: number;
  originY: number;
  capturedAtMs: number;
};

export type PointerAttackTargetContext = {
  x: number;
  y: number;
  capturedAtMs: number;
};

export type PendingFpsHeldWeaponMeleeSwipeContext = {
  x: number;
  y: number;
  capturedAtMs: number;
};

export type GlyphDamageFlashState = {
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

export type MonsterBillboardDamageFlashState = {
  key: string;
  elapsedMs: number;
  durationMs: number;
};

export type GlyphDamageShakeState = {
  key: string;
  tileX: number;
  tileY: number;
  elapsedMs: number;
  durationMs: number;
  amplitude: number;
  seed: number;
  spriteOnly: boolean;
};

export type BloodMistParticle = {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  ageMs: number;
  lifetimeMs: number;
  radius: number;
  baseScale: THREE.Vector2;
  groundImpactCount: number;
};

export type DamageNumberParticle = {
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

export type PlayerUiNumberParticle = {
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

export type CorePlayerStatField =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma"
  | "armor";

export type BillboardShardDescriptor = {
  texture: THREE.CanvasTexture;
  centerU: number;
  centerV: number;
  widthRatio: number;
  heightRatio: number;
  areaRatio: number;
};

export type MonsterBillboardShatterOptions = {
  splitTargetCountOverride?: number;
  removeSourceBillboard?: boolean;
  persistShardsOnGround?: boolean;
  directionX?: number;
  directionY?: number;
  runtimeMonsterId?: number | null;
};

export type RuntimeMonsterBillboardAppearance = {
  glyphChar: string;
  textColor: string;
  tileIndex: number;
  sourceGlyph: number | null;
  materialKind: TileMaterialKind | null;
  isWall: boolean;
  showPetHeart: boolean;
};

export type RuntimeMonsterLastSeenState = {
  tileKey: string;
  appearance: RuntimeMonsterBillboardAppearance | null;
  relationship: "monster" | "pet" | "other";
};

export type ParsedLootTelemetryMessage = {
  label: string;
  quantity: number;
  detail?: string;
};

export type PendingRunKillAttribution = {
  kind: "spell";
  label: string;
  expiresAtMs: number;
};

export type EntityMoveTransitionVisual = {
  object: THREE.Object3D;
  dispose: () => void;
};

export type EntityMoveTransitionWaypoint = {
  destinationKey: string;
  durationMs: number;
};

export type EntityMoveTransition = {
  id: string;
  destinationKey: string;
  object: THREE.Object3D;
  dispose: () => void;
  baseRenderOrder: number;
  startedAtMs: number;
  durationMs: number;
  baseDurationMs: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  queuedWaypoints: EntityMoveTransitionWaypoint[];
  holdAtDestinationUntilConfirmation: boolean;
};

export type DeferredEntityVisualUpdate = {
  transitionId: string;
  tile: any | null;
};

export type DamageEffectOptions = {
  bloodMistCountMultiplier?: number;
  radialBloodMistSpread?: boolean;
  bloodMistHorizontalSpeedMultiplier?: number;
  bloodMistVerticalSpeedMultiplier?: number;
  directionX?: number;
  directionY?: number;
  billboardShatter?: MonsterBillboardShatterOptions;
};

export type BillboardShardParticle = {
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
  groundImpactCount: number;
  persistOnGround: boolean;
};

export type CharacterCreationQuestionPayload = {
  text: string;
  choices: string;
  defaultChoice: string;
  menuItems: any[];
};

export type InventoryDialogOptions = {
  contextActionsEnabled?: boolean;
};

export type FpsHeldWeaponTextureState = {
  tileIndex: number;
  sourceGlyph: number | null;
  signature: string;
};

export type FpsHeldWeaponTileFlipOverride = {
  flipX: boolean;
  flipY: boolean;
  flipDiagonal: boolean;
};

export type FpsHeldWeaponTileFlipOverridesByTileId = Record<
  string,
  FpsHeldWeaponTileFlipOverride
>;

export type FpsHeldWeaponTileFlipOverridesByTileset = Record<
  string,
  FpsHeldWeaponTileFlipOverridesByTileId
>;

export type FpsHeldWeaponActiveAnimationState = {
  animationId: string;
  startedAtMs: number;
  durationScale: number;
  lastProcessedKeyframeIndex: number;
};

export type FpsHeldWeaponAnimationEditorAxis = "x" | "y" | "z";

export type FpsHeldWeaponAnimationEditorInputMap = Record<
  FpsHeldWeaponAnimationEditorAxis,
  HTMLInputElement | null
>;

export type FpsHeldWeaponAnimationEditorElements = {
  panel: HTMLDivElement | null;
  animationSelect: HTMLSelectElement | null;
  copyButton: HTMLButtonElement | null;
  weightInput: HTMLInputElement | null;
  keyframeSelect: HTMLSelectElement | null;
  durationInput: HTMLInputElement | null;
  slowMoCheckbox: HTMLInputElement | null;
  previewKeyframeCheckbox: HTMLInputElement | null;
  statusLabel: HTMLDivElement | null;
  noteLabel: HTMLDivElement | null;
  weightRow: HTMLDivElement | null;
  previewRow: HTMLDivElement | null;
  tilePreviewRow: HTMLDivElement | null;
  tileFlipRow: HTMLDivElement | null;
  keyframeRow: HTMLDivElement | null;
  addRow: HTMLDivElement | null;
  durationRow: HTMLDivElement | null;
  basePositionSection: HTMLDivElement | null;
  baseRotationSection: HTMLDivElement | null;
  pivotSection: HTMLDivElement | null;
  translationSection: HTMLDivElement | null;
  rotationSection: HTMLDivElement | null;
  tilePreviewEnabledCheckbox: HTMLInputElement | null;
  tilePreviewTileIdInput: HTMLInputElement | null;
  tilePreviewTilesetLabel: HTMLDivElement | null;
  tileFlipXCheckbox: HTMLInputElement | null;
  tileFlipYCheckbox: HTMLInputElement | null;
  tileFlipDiagonalCheckbox: HTMLInputElement | null;
  basePositionInputs: FpsHeldWeaponAnimationEditorInputMap;
  baseRotationInputs: FpsHeldWeaponAnimationEditorInputMap;
  pivotInputs: FpsHeldWeaponAnimationEditorInputMap;
  translationInputs: FpsHeldWeaponAnimationEditorInputMap;
  rotationInputs: FpsHeldWeaponAnimationEditorInputMap;
};

export type FpsHeldWeaponBasePoseDefinition = {
  position: FpsHeldWeaponAnimationVector3;
  rotationDeg: FpsHeldWeaponAnimationVector3;
};

export type MinimapViewportRect = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type MinimapCellPresentation = {
  foregroundHex?: string | null;
  backgroundHex?: string | null;
  displayChar?: string | null;
  inverse?: boolean;
  forcePlayer?: boolean;
};

export type AimDirection = {
  dx: number;
  dy: number;
  input: string;
};

export type FpsCrosshairTargetHint =
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

export type FpsCrosshairGlanceCacheEntry = {
  hint: FpsCrosshairTargetHint;
  sourceText: string;
  updatedAtMs: number;
};

export type FpsCrosshairGlancePending = {
  requestId: number;
  tileKey: string;
  tileX: number;
  tileY: number;
  startedAtMs: number;
  sawPositionInput: boolean;
  positionResolvedAtMs: number | null;
  targetClickSent: boolean;
  lastCapturedMessageAtMs: number | null;
  commandKind: "colon" | "glance";
};

export type TileContextTarget = {
  key: string;
  x: number;
  y: number;
  mesh: THREE.Mesh;
  faceTextureRotationTarget?: TileFaceTextureRotationTarget | null;
};

export type TileFaceTextureSlot =
  | "east"
  | "west"
  | "north"
  | "south"
  | "top"
  | "bottom";

export type TileFaceTextureRotationTarget = {
  variant: string;
  tileIndex: number;
  face: TileFaceTextureSlot;
  rotationDegrees: number;
};

export type TileFaceTextureRotationOverrides = Record<
  string,
  Partial<Record<TileFaceTextureSlot, number>>
>;

export type TileContextTouchHoldState = {
  touchId: number;
  startX: number;
  startY: number;
  opened: boolean;
};

export type FpsTouchGestureState = {
  touchId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAtMs: number;
};

export type RepeatableActionSpec =
  | { kind: "quick"; value: string }
  | { kind: "extended"; value: string }
  | { kind: "inventory_command"; value: string };

export type TileUpdateOptions = {
  inferredDarkCorridorWall?: boolean;
  restartRevealFade?: boolean;
  runtimeTrackedEntityId?: number;
  runtimeTileIndex?: number;
  runtimeSymidx?: number;
  runtimeGlyphFlags?: number;
  runtimeFloorUnderlayGlyph?: number;
  runtimeFloorUnderlayChar?: string;
  runtimeFloorUnderlayColor?: number;
  runtimeFloorUnderlayTileIndex?: number;
  runtimeFloorUnderlaySymidx?: number;
};

export type TerminalCellTextureEntry = {
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  refCount: number;
};

export type LevelCacheObservedTile = {
  x: number;
  y: number;
  glyph: number;
  char?: string;
  color?: number;
  tileIndex?: number;
  symidx?: number;
};

export type LevelTerrainCacheSnapshot = {
  tileStateCache: Map<string, string>;
  lastKnownTerrain: Map<string, TerrainSnapshot>;
  flatFeatureUnderPlayerCache: Map<string, TerrainSnapshot>;
  suppressedLootLikeUnderPlayerCacheKeys: Set<string>;
  inferredDarkCorridorWallTiles: Map<string, { x: number; y: number }>;
  inferredDarkCorridorTileFlags: Set<string>;
  bloodGround: BloodGroundCacheSnapshot | null;
};

export type LevelTerrainCacheEntry = LevelTerrainCacheSnapshot & {
  id: string;
  levelName: string;
  updatedAtMs: number;
};

export type PendingLevelCacheTransition = {
  startedAtMs: number;
  observedTiles: Map<string, LevelCacheObservedTile>;
  firstPassComplete: boolean;
  sawLevelIdentityStatusUpdate: boolean;
  initialPlayerPosition: { x: number; y: number } | null;
  preTransitionFallbackLevelName: string | null;
};

export type RuntimeLevelIdentity = {
  dnum: number;
  dlevel: number;
  ledgerNo: number | null;
  depth: number | null;
  dungeonName: string | null;
  branchTag: string | null;
};

export type BloodGroundCacheSnapshot = {
  version: number;
  width: number;
  height: number;
  density: Uint16Array;
};

export type BloodGroundDirtyRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type BloodGroundPatternLayer = {
  xx: number;
  xy: number;
  xb: number;
  yx: number;
  yy: number;
  yb: number;
};

export type BloodGroundPatternParams = {
  primary: BloodGroundPatternLayer;
  secondary: BloodGroundPatternLayer;
  tertiary: BloodGroundPatternLayer;
  threshold: number;
  contrast: number;
};

export type BloodGroundImpactParams = {
  worldX: number;
  worldY: number;
  directionX: number;
  directionY: number;
  baseRadiusWorld: number;
  densityAmount: number;
  scatterCount: number;
  streakCount: number;
  streakLengthWorld: number;
  elongation: number;
  intensityScale?: number;
};

export type WallSideTileOverlay = {
  textureKey: string;
  material: THREE.MeshBasicMaterial;
};

export type WallSideTileRotation = "none" | "cw90" | "ccw90";

export type VultureWallFaceSlot = "west" | "north" | "east" | "south";

export type VultureWallFaceOverlay = {
  textureKey: string;
  material: THREE.MeshBasicMaterial;
};

export type VultureWallPlaneSlice = {
  frontMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | THREE.Material[]>;
  backMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | THREE.Material[]>;
};

export type VultureWallPlaneOverlay = Partial<
  Record<VultureWallFaceSlot, VultureWallPlaneSlice>
>;

export type VultureDoorPlaneOverlay = {
  frontMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  backMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  floorMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  frontTextureKey: string;
  backTextureKey: string;
  floorTextureKey: string;
  frontMaterial: THREE.MeshBasicMaterial;
  backMaterial: THREE.MeshBasicMaterial;
  floorMaterial: THREE.MeshBasicMaterial;
  doorOrientation: VultureWallProjectionFamily;
};

export type TransparentWallGroundPlaneOverlay = {
  floorMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  textureKey: string;
};

export type IronBarsWallPlaneOverlay = {
  frontMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  backMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  textureKey: string;
};

export type FpsChamferWallUvRotation = "none" | "lr_ccw" | "fb_ccw";

export type ControllerActionSnapshot = {
  values: Record<Nh3dControllerActionId, number>;
  active: Record<Nh3dControllerActionId, boolean>;
  pressed: Record<Nh3dControllerActionId, boolean>;
  released: Record<Nh3dControllerActionId, boolean>;
};

export type ControllerFocusableEntry = {
  element: HTMLElement;
  centerX: number;
  centerY: number;
  height: number;
};

export type VultureWallProjectionFamily = "ew" | "sn";

export type VultureDoorProjectionOrientation = VultureWallProjectionFamily;

export type VultureDoorProjectionDebugFamily =
  | "door_open_ew"
  | "door_open_sn"
  | "door_closed_ew"
  | "door_closed_sn";

export type VultureProjectionDebugFamily =
  | VultureWallProjectionFamily
  | "floor"
  | VultureDoorProjectionDebugFamily;

export type VultureDoorProjectionState = "open" | "closed";

export type VultureDoorProjectionSide = "front" | "back";

export type VultureWallProjectionCornerId =
  | "topLeft"
  | "topRight"
  | "bottomRight"
  | "bottomLeft";

export type VultureWallProjectionPoint = {
  x: number;
  y: number;
};

export type VultureWallProjectionQuad = Record<
  VultureWallProjectionCornerId,
  VultureWallProjectionPoint
>;

export type VultureWallProjectionLookup = VultureTileLookup & {
  wallFace?: VultureWallFaceSlot | null;
};

export type VultureDoorProjectionContext = {
  state: VultureDoorProjectionState;
  side: VultureDoorProjectionSide;
  orientation: VultureDoorProjectionOrientation;
};

export type VultureWallPlaneRenderConfig = {
  family: VultureWallProjectionFamily;
  slices: Array<{
    direction: VultureWallFaceSlot;
    innerTextureFace: VultureWallFaceSlot;
    outerTextureFace: VultureWallFaceSlot;
    innerLookup: VultureWallProjectionLookup;
    outerLookup: VultureWallProjectionLookup;
  }>;
};

export type VultureProjectionTextureMode = "runtime" | "prebaked";

export type VulturePrebakedProjectionManifest = {
  formatVersion: number;
  tileSize: number;
  profileSignature: string;
  entries: Record<string, string>;
};

export type VulturePrebakedProjectionImageState = HTMLImageElement | "loading" | null;
