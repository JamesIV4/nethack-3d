import * as THREE from "three";
import { applyCameraAttachedWorldAspect } from "./tile-world-presentation";
import type { NethackMenuItem } from "../../ui-types";
import { resolveDefaultNh3dTilesetWeaponSpriteFlipX } from "../../tilesets";
import {
  FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_ID,
  FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_IDS,
  createDefaultFpsHeldWeaponAnimationLibrary,
  sampleFpsHeldWeaponAnimation,
  type FpsHeldWeaponAnimationDefinition,
  type FpsHeldWeaponAnimationLibrary,
  type FpsHeldWeaponAnimationSoundEffect,
  type FpsHeldWeaponAnimationVector3
} from "../../fps-held-weapon-animations";
import type {
  FpsHeldWeaponTextureState,
  FpsHeldWeaponTileFlipOverride,
  FpsHeldWeaponTileFlipOverridesByTileset,
  FpsHeldWeaponActiveAnimationState,
  FpsHeldWeaponBasePoseDefinition
} from "../shared/types";
import {
  createZeroFpsHeldWeaponAnimationVector,
  DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET,
  createDefaultFpsHeldWeaponBasePoseDefinition
} from "../shared/constants";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { BillboardShatter } from "../effects/billboard-shatter";
import type { Camera } from "../camera/camera";
import type { CombatAttribution } from "../world/combat-attribution";
import type { DamageNumbers } from "../effects/damage-numbers";
import type { EngineState } from "../runtime/engine-state";
import type { GlyphTextures } from "./glyph-textures";
import type { HeldWeaponAnimationDebug } from "../diagnostics/held-weapon-animation-debug";
import type { MenuPreviews } from "../ui/menu-previews";
import type { MovementInput } from "../input/movement-input";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { RenderPipeline } from "./render-pipeline";
import type { TilesetAssets } from "./tileset-assets";

export interface HeldWeaponDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "messageSoundHooks"
  >;
  readonly billboardShatter: Pick<
    BillboardShatter,
    "resolveMonsterBillboardTextureSource"
  >;
  readonly camera: Pick<
    Camera,
    "camera"
    | "getActiveCamera"
    | "cameraPitch"
    | "cameraYaw"
    | "defaultFpsCameraFov"
    | "firstPersonPitchMax"
    | "firstPersonPitchMin"
    | "fpsStepCameraActive"
    | "resolveFpsCameraFov"
    | "wrapAngle"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    "pendingFpsHeldWeaponMeleeSwipeContext"
    | "suppressNextFpsHeldWeaponMissedAttackMessageSound"
  >;
  readonly damageNumbers: Pick<
    DamageNumbers,
    "fromCameraLocalOffset"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "createTileTexture"
  >;
  readonly heldWeaponAnimationDebug: Pick<
    HeldWeaponAnimationDebug,
    "fpsHeldWeaponAnimationDebugPreviewSelectedKeyframe"
    | "fpsHeldWeaponAnimationDebugPreviewTileEnabled"
    | "fpsHeldWeaponAnimationDebugPreviewTileId"
    | "fpsHeldWeaponAnimationDebugSelectedKeyframeIndex"
    | "fpsHeldWeaponAnimationDebugVisible"
    | "getFpsHeldWeaponAnimationDebugSelectedAnimation"
  >;
  readonly menuPreviews: Pick<
    MenuPreviews,
    "resolveNonNegativeMenuInteger"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "isFpsFarLookViewActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "currentInventory"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveRuntimeVersion"
    | "resolveTilesetAtlasImageSource"
    | "shouldUseVultureTiles"
    | "tileSourceSize"
    | "vultureTilesetTranslator"
  >;
}

/** First-person weapon sprite, texture transforms, sway and authored animations */
export class HeldWeapon {
  private readonly inverseWorldTileScale = new THREE.Matrix4();
  constructor(private readonly dependencies: HeldWeaponDependencies) {}

  fpsHeldWeaponMesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  > | null = null;

  fpsHeldWeaponMaterial: THREE.MeshBasicMaterial | null = null;

  fpsHeldWeaponTexture: THREE.CanvasTexture | null = null;

  fpsHeldWeaponTextureSignature: string = "";

  fpsHeldWeaponLagYaw: number | null = null;

  fpsHeldWeaponLagPitch: number | null = null;

  readonly fpsHeldWeaponMovementOffset = new THREE.Vector2();

  fpsHeldWeaponSwayPhase: number = 0;

  fpsHeldWeaponSwaySpeed: number = 0;

  fpsHeldWeaponSwaySpeedTarget: number = 0;

  readonly fpsHeldWeaponAnimations: FpsHeldWeaponAnimationLibrary =
    createDefaultFpsHeldWeaponAnimationLibrary();

  fpsHeldWeaponActiveAnimation: FpsHeldWeaponActiveAnimationState | null =
    null;

  readonly fpsHeldWeaponRepeatedVariationWeight: number = 0.35;

  readonly lastPlayedFpsHeldWeaponAnimationVariationIdByGroup: Map<
    string,
    string
  > = new Map();

  readonly fpsHeldWeaponGeometry = new THREE.PlaneGeometry(1, 1);

  readonly fpsHeldWeaponBaseLocalOffset = new THREE.Vector3(
    0.38,
    -0.28,
    -0.72,
  );

  readonly fpsHeldWeaponBasePose: FpsHeldWeaponBasePoseDefinition =
    createDefaultFpsHeldWeaponBasePoseDefinition();

  readonly fpsHeldWeaponLocalOffset = new THREE.Vector3();

  readonly fpsHeldWeaponWorldPosition = new THREE.Vector3();

  readonly fpsHeldWeaponWorldQuaternion = new THREE.Quaternion();

  readonly fpsHeldWeaponBaseRotationEuler = new THREE.Euler();

  readonly fpsHeldWeaponBaseRotationQuaternion = new THREE.Quaternion();

  readonly fpsHeldWeaponAnimationPivotLocal = new THREE.Vector3();

  readonly fpsHeldWeaponAnimationCenterFromPivot = new THREE.Vector3();

  readonly fpsHeldWeaponAnimationRotatedCenter = new THREE.Vector3();

  readonly fpsHeldWeaponAnimationEuler = new THREE.Euler();

  readonly fpsHeldWeaponAnimationQuaternion = new THREE.Quaternion();

  readonly fpsHeldWeaponTileFlipOverridesByTileset: FpsHeldWeaponTileFlipOverridesByTileset =
    {};

  readonly fpsHeldWeaponYawLagHalfLifeMs: number = 84;

  readonly fpsHeldWeaponYawLagAmount: number = 0.38;

  readonly fpsHeldWeaponYawLagMax: number = 0.2;

  readonly fpsHeldWeaponPitchLagHalfLifeMs: number = 68;

  readonly fpsHeldWeaponPitchLagAmount: number = 0.48;

  readonly fpsHeldWeaponPitchLagMax: number = 0.12;

  readonly fpsHeldWeaponPitchOffsetRange: number = 0.11;

  readonly fpsHeldWeaponSwayHorizontalAmplitude: number = 0.04833333333333333;

  readonly fpsHeldWeaponSwayVerticalAmplitude: number = 0.055;

  readonly fpsHeldWeaponSwaySpeedImpulsePerTileFromRest: number = 2.9;

  readonly fpsHeldWeaponSwaySpeedImpulsePerTileWhileMoving: number = 0.95;

  readonly fpsHeldWeaponSwaySpeedMax: number = 4.07;

  readonly fpsHeldWeaponSwaySpeedApproachHalfLifeMs: number = 90;

  readonly fpsHeldWeaponSwaySpeedDecayHalfLifeMs: number = 650;

  readonly fpsHeldWeaponScaleY: number = 0.72;

  readonly fpsHeldWeaponAuthoredAspectRatio: number = 16 / 9;

  readonly fpsHeldWeaponFovDepthCompensationStrength: number = 0.92;

  readonly fpsHeldWeaponFovDepthCompensationMinScale: number = 0.47;

  readonly fpsHeldWeaponFovDepthCompensationMaxScale: number = 1.2;

  ensureFpsHeldWeaponMesh(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  > {
    if (this.fpsHeldWeaponMesh && this.fpsHeldWeaponMaterial) {
      return this.fpsHeldWeaponMesh;
    }
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(this.fpsHeldWeaponGeometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 980;
    mesh.visible = false;
    this.dependencies.renderPipeline.scene.add(mesh);
    this.fpsHeldWeaponMesh = mesh;
    this.fpsHeldWeaponMaterial = material;
    return mesh;
  }

  invalidateFpsHeldWeaponTexture(): void {
    if (this.fpsHeldWeaponMaterial) {
      this.fpsHeldWeaponMaterial.map = null;
      this.fpsHeldWeaponMaterial.needsUpdate = true;
    }
    if (this.fpsHeldWeaponTexture) {
      this.fpsHeldWeaponTexture.dispose();
      this.fpsHeldWeaponTexture = null;
    }
    this.fpsHeldWeaponTextureSignature = "";
  }

  clearFpsHeldWeaponVisual(): void {
    this.invalidateFpsHeldWeaponTexture();
    if (this.fpsHeldWeaponMesh) {
      this.dependencies.renderPipeline.scene.remove(this.fpsHeldWeaponMesh);
      this.fpsHeldWeaponMesh = null;
    }
    if (this.fpsHeldWeaponMaterial) {
      this.fpsHeldWeaponMaterial.dispose();
      this.fpsHeldWeaponMaterial = null;
    }
    this.fpsHeldWeaponLagYaw = null;
    this.fpsHeldWeaponLagPitch = null;
    this.fpsHeldWeaponMovementOffset.set(0, 0);
    this.fpsHeldWeaponSwayPhase = 0;
    this.fpsHeldWeaponSwaySpeed = 0;
    this.fpsHeldWeaponSwaySpeedTarget = 0;
    this.clearFpsHeldWeaponAnimationState();
    this.dependencies.combatAttribution.pendingFpsHeldWeaponMeleeSwipeContext = null;
    this.dependencies.combatAttribution.suppressNextFpsHeldWeaponMissedAttackMessageSound = false;
  }

  isHeldWeaponInventoryItem(item: unknown): item is NethackMenuItem {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item as NethackMenuItem;
    if (candidate.isCategory) {
      return false;
    }
    const text =
      typeof candidate.text === "string" ? candidate.text.toLowerCase() : "";
    return (
      text.includes("(weapon in hand)") ||
      text.includes("(weapon in right hand)") ||
      text.includes("(weapon in left hand)")
    );
  }

  findHeldWeaponInventoryItem(): NethackMenuItem | null {
    for (const item of this.dependencies.promptDialogs.currentInventory) {
      if (this.isHeldWeaponInventoryItem(item)) {
        return item;
      }
    }
    return null;
  }

  getFpsHeldWeaponTileFlipOverrideTilesetPath(): string {
    return String(this.dependencies.engineState.clientOptions.tilesetPath || "").trim();
  }

  getFpsHeldWeaponTileFlipOverrideTilesetLabel(): string {
    const tilesetPath = this.getFpsHeldWeaponTileFlipOverrideTilesetPath();
    if (!tilesetPath) {
      return "(no tileset)";
    }
    const segments = tilesetPath.split(/[\\/]/);
    return segments[segments.length - 1] || tilesetPath;
  }

  getConfiguredFpsHeldWeaponAnimationDebugPreviewTileId():
    | number
    | null {
    if (!this.dependencies.heldWeaponAnimationDebug.fpsHeldWeaponAnimationDebugPreviewTileEnabled) {
      return null;
    }
    const tileId = this.dependencies.heldWeaponAnimationDebug.fpsHeldWeaponAnimationDebugPreviewTileId;
    if (!Number.isFinite(tileId) || tileId < 0) {
      return null;
    }
    return Math.trunc(tileId);
  }

  getActiveFpsHeldWeaponAnimationDebugPreviewTileId(): number | null {
    if (!this.dependencies.heldWeaponAnimationDebug.fpsHeldWeaponAnimationDebugVisible) {
      return null;
    }
    return this.getConfiguredFpsHeldWeaponAnimationDebugPreviewTileId();
  }

  resolveTilesetDefaultFpsHeldWeaponTileFlipState(
    tilesetPath: string,
  ): FpsHeldWeaponTileFlipOverride {
    return {
      flipX: resolveDefaultNh3dTilesetWeaponSpriteFlipX(tilesetPath),
      flipY: false,
      flipDiagonal: false,
    };
  }

  resolveBuiltInFpsHeldWeaponTileFlipDefaultState(
    tilesetPath: string,
    tileId: number | null,
  ): FpsHeldWeaponTileFlipOverride {
    const tilesetDefaultState =
      this.resolveTilesetDefaultFpsHeldWeaponTileFlipState(tilesetPath);
    if (tileId === null || tileId < 0) {
      return tilesetDefaultState;
    }

    const builtInOverride =
      DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET[tilesetPath]?.[
        String(Math.trunc(tileId))
      ] ?? null;
    if (!builtInOverride) {
      return tilesetDefaultState;
    }

    return {
      flipX: builtInOverride.flipX,
      flipY: builtInOverride.flipY,
      flipDiagonal: builtInOverride.flipDiagonal,
    };
  }

  resolveFpsHeldWeaponTileFlipState(
    tileId: number | null,
  ): FpsHeldWeaponTileFlipOverride {
    const tilesetPath = this.getFpsHeldWeaponTileFlipOverrideTilesetPath();
    const defaultState = this.resolveBuiltInFpsHeldWeaponTileFlipDefaultState(
      tilesetPath,
      tileId,
    );
    if (tileId === null || tileId < 0) {
      return defaultState;
    }
    const override =
      tilesetPath && this.fpsHeldWeaponTileFlipOverridesByTileset[tilesetPath]
        ? (this.fpsHeldWeaponTileFlipOverridesByTileset[tilesetPath][
            String(Math.trunc(tileId))
          ] ?? null)
        : null;
    return {
      flipX: override?.flipX ?? defaultState.flipX,
      flipY: override?.flipY ?? defaultState.flipY,
      flipDiagonal: override?.flipDiagonal ?? defaultState.flipDiagonal,
    };
  }

  setFpsHeldWeaponTileFlipOverride(
    tileId: number,
    nextOverride: FpsHeldWeaponTileFlipOverride,
  ): void {
    const normalizedTileId = Math.max(0, Math.trunc(tileId));
    const tilesetPath = this.getFpsHeldWeaponTileFlipOverrideTilesetPath();
    if (!tilesetPath) {
      return;
    }

    const defaultState = this.resolveBuiltInFpsHeldWeaponTileFlipDefaultState(
      tilesetPath,
      normalizedTileId,
    );
    const shouldPersistOverride =
      nextOverride.flipX !== defaultState.flipX ||
      nextOverride.flipY !== defaultState.flipY ||
      nextOverride.flipDiagonal !== defaultState.flipDiagonal;
    if (!shouldPersistOverride) {
      const existingByTileId =
        this.fpsHeldWeaponTileFlipOverridesByTileset[tilesetPath];
      if (existingByTileId) {
        delete existingByTileId[String(normalizedTileId)];
        if (Object.keys(existingByTileId).length <= 0) {
          delete this.fpsHeldWeaponTileFlipOverridesByTileset[tilesetPath];
        }
      }
      return;
    }

    const existingByTileId =
      this.fpsHeldWeaponTileFlipOverridesByTileset[tilesetPath] ?? {};
    existingByTileId[String(normalizedTileId)] = {
      flipX: nextOverride.flipX === true,
      flipY: nextOverride.flipY === true,
      flipDiagonal: nextOverride.flipDiagonal === true,
    };
    this.fpsHeldWeaponTileFlipOverridesByTileset[tilesetPath] =
      existingByTileId;
  }

  resolveFpsHeldWeaponTextureState(): FpsHeldWeaponTextureState | null {
    const previewTileId =
      this.getActiveFpsHeldWeaponAnimationDebugPreviewTileId();
    if (
      !this.dependencies.movementInput.isFpsMode() ||
      (!this.dependencies.engineState.clientOptions.fpsHeldWeaponVisible && previewTileId === null) ||
      this.dependencies.engineState.clientOptions.tilesetMode !== "tiles" ||
      this.dependencies.positionSelection.isFpsFarLookViewActive()
    ) {
      return null;
    }
    const item =
      previewTileId === null ? this.findHeldWeaponInventoryItem() : null;
    if (previewTileId === null && !item) {
      return null;
    }
    const sourceGlyph =
      previewTileId === null && item
        ? this.dependencies.menuPreviews.resolveNonNegativeMenuInteger(item.glyph)
        : null;
    const tileIndex =
      previewTileId !== null
        ? previewTileId
        : item
          ? this.dependencies.menuPreviews.resolveNonNegativeMenuInteger(item.tileIndex)
          : null;
    const usingVultureTiles = this.dependencies.tilesetAssets.shouldUseVultureTiles();
    const canUseTranslatedTileWithoutAtlas =
      usingVultureTiles && sourceGlyph !== null;
    const assetReady = usingVultureTiles
      ? this.dependencies.tilesetAssets.vultureTilesetTranslator !== null
      : this.dependencies.tilesetAssets.resolveTilesetAtlasImageSource() !== null;
    if (
      !assetReady ||
      (tileIndex === null && !canUseTranslatedTileWithoutAtlas)
    ) {
      return null;
    }
    const backgroundRemovalKey =
      this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "solid"
        ? `solid:${this.dependencies.engineState.clientOptions.tilesetSolidChromaKeyColorHex}`
        : this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "none"
          ? "none"
          : `tile:${this.dependencies.engineState.clientOptions.tilesetBackgroundTileId}`;
    const effectiveFlipState = this.resolveFpsHeldWeaponTileFlipState(
      tileIndex ?? null,
    );
    return {
      tileIndex: tileIndex ?? -1,
      sourceGlyph,
      signature: `${this.dependencies.engineState.clientOptions.tilesetPath}|rv:${this.dependencies.tilesetAssets.resolveRuntimeVersion()}|ts:${this.dependencies.tilesetAssets.tileSourceSize}|g:${sourceGlyph ?? -1}|ti:${tileIndex ?? -1}|bg:${backgroundRemovalKey}|preview:${previewTileId ?? -1}|fx:${effectiveFlipState.flipX ? 1 : 0}|fy:${effectiveFlipState.flipY ? 1 : 0}|fd:${effectiveFlipState.flipDiagonal ? 1 : 0}`,
    };
  }

  measureTextureOpaqueAspectRatio(texture: THREE.Texture): number {
    const sourceInfo = this.dependencies.billboardShatter.resolveMonsterBillboardTextureSource(texture);
    if (!sourceInfo || typeof document === "undefined") {
      return 1;
    }
    const { source, width, height } = sourceInfo;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return width > 0 && height > 0 ? width / height : 1;
    }
    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha <= 4) {
          continue;
        }
        if (x < minX) {
          minX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      return width > 0 && height > 0 ? width / height : 1;
    }
    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    return contentHeight > 0 ? contentWidth / contentHeight : 1;
  }

  createFpsHeldWeaponFlippedTexture(
    texture: THREE.CanvasTexture,
    flipState: FpsHeldWeaponTileFlipOverride,
  ): THREE.CanvasTexture {
    if (!flipState.flipX && !flipState.flipY && !flipState.flipDiagonal) {
      return texture;
    }

    const sourceInfo = this.dependencies.billboardShatter.resolveMonsterBillboardTextureSource(texture);
    if (!sourceInfo || typeof document === "undefined") {
      return texture;
    }

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = sourceInfo.width;
    sourceCanvas.height = sourceInfo.height;
    const sourceContext = sourceCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sourceContext) {
      return texture;
    }

    sourceContext.imageSmoothingEnabled = false;
    sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.drawImage(
      sourceInfo.source,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    );

    const destinationWidth = flipState.flipDiagonal
      ? sourceCanvas.height
      : sourceCanvas.width;
    const destinationHeight = flipState.flipDiagonal
      ? sourceCanvas.width
      : sourceCanvas.height;
    const destinationCanvas = document.createElement("canvas");
    destinationCanvas.width = destinationWidth;
    destinationCanvas.height = destinationHeight;
    const destinationContext = destinationCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!destinationContext) {
      return texture;
    }

    const sourceImageData = sourceContext.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    );
    const destinationImageData = destinationContext.createImageData(
      destinationWidth,
      destinationHeight,
    );
    const sourceData = sourceImageData.data;
    const destinationData = destinationImageData.data;

    for (let sourceY = 0; sourceY < sourceCanvas.height; sourceY += 1) {
      for (let sourceX = 0; sourceX < sourceCanvas.width; sourceX += 1) {
        let destinationX = sourceX;
        let destinationY = sourceY;
        let transformedWidth = sourceCanvas.width;
        let transformedHeight = sourceCanvas.height;

        if (flipState.flipDiagonal) {
          destinationX = sourceY;
          destinationY = sourceX;
          transformedWidth = sourceCanvas.height;
          transformedHeight = sourceCanvas.width;
        }

        if (flipState.flipX) {
          destinationX = transformedWidth - 1 - destinationX;
        }
        if (flipState.flipY) {
          destinationY = transformedHeight - 1 - destinationY;
        }

        const sourceIndex = (sourceY * sourceCanvas.width + sourceX) * 4;
        const destinationIndex =
          (destinationY * destinationWidth + destinationX) * 4;
        destinationData[destinationIndex] = sourceData[sourceIndex];
        destinationData[destinationIndex + 1] = sourceData[sourceIndex + 1];
        destinationData[destinationIndex + 2] = sourceData[sourceIndex + 2];
        destinationData[destinationIndex + 3] = sourceData[sourceIndex + 3];
      }
    }

    destinationContext.putImageData(destinationImageData, 0, 0);

    const flippedTexture = new THREE.CanvasTexture(destinationCanvas);
    flippedTexture.needsUpdate = true;
    flippedTexture.magFilter = texture.magFilter;
    flippedTexture.minFilter = texture.minFilter;
    flippedTexture.generateMipmaps = texture.generateMipmaps;
    flippedTexture.anisotropy = texture.anisotropy;
    flippedTexture.wrapS = texture.wrapS;
    flippedTexture.wrapT = texture.wrapT;
    flippedTexture.flipY = texture.flipY;
    texture.dispose();
    return flippedTexture;
  }

  applyFpsHeldWeaponSwayImpulse(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const moveTileX = toX - fromX;
    const moveTileY = toY - fromY;
    const stepDistanceTiles = Math.hypot(moveTileX, moveTileY);
    if (stepDistanceTiles <= 0.0001) {
      return;
    }

    const currentSpeedT = THREE.MathUtils.clamp(
      this.fpsHeldWeaponSwaySpeedTarget / this.fpsHeldWeaponSwaySpeedMax,
      0,
      1,
    );
    const impulsePerTile = THREE.MathUtils.lerp(
      this.fpsHeldWeaponSwaySpeedImpulsePerTileFromRest,
      this.fpsHeldWeaponSwaySpeedImpulsePerTileWhileMoving,
      currentSpeedT,
    );
    this.fpsHeldWeaponSwaySpeedTarget = THREE.MathUtils.clamp(
      this.fpsHeldWeaponSwaySpeedTarget + stepDistanceTiles * impulsePerTile,
      0,
      this.fpsHeldWeaponSwaySpeedMax,
    );
  }

  resolveFpsHeldWeaponMovementOffset(
    deltaSeconds: number,
  ): THREE.Vector2 {
    const dt = Math.min(Math.max(0, deltaSeconds), 0.1);

    if (!this.dependencies.camera.fpsStepCameraActive) {
      this.fpsHeldWeaponSwaySpeedTarget *= Math.exp(
        (-Math.LN2 * dt * 1000) / this.fpsHeldWeaponSwaySpeedDecayHalfLifeMs,
      );
      if (Math.abs(this.fpsHeldWeaponSwaySpeedTarget) < 0.0001) {
        this.fpsHeldWeaponSwaySpeedTarget = 0;
      }
    }
    const swaySpeedAlpha =
      1 -
      Math.exp(
        (-Math.LN2 * dt * 1000) / this.fpsHeldWeaponSwaySpeedApproachHalfLifeMs,
      );
    this.fpsHeldWeaponSwaySpeed +=
      (this.fpsHeldWeaponSwaySpeedTarget - this.fpsHeldWeaponSwaySpeed) *
      swaySpeedAlpha;
    if (Math.abs(this.fpsHeldWeaponSwaySpeed) < 0.0001) {
      this.fpsHeldWeaponSwaySpeed = 0;
    }
    this.fpsHeldWeaponSwayPhase = THREE.MathUtils.euclideanModulo(
      this.fpsHeldWeaponSwayPhase + this.fpsHeldWeaponSwaySpeed * dt,
      Math.PI * 2,
    );
    const swaySpeedT = THREE.MathUtils.clamp(
      this.fpsHeldWeaponSwaySpeed / this.fpsHeldWeaponSwaySpeedMax,
      0,
      1,
    );
    const swayAmountT = swaySpeedT * swaySpeedT * (3 - 2 * swaySpeedT);
    const swayHorizontal = Math.cos(this.fpsHeldWeaponSwayPhase);
    const swayVertical =
      -Math.sin(this.fpsHeldWeaponSwayPhase) *
      Math.sin(this.fpsHeldWeaponSwayPhase);

    this.fpsHeldWeaponMovementOffset.set(
      swayHorizontal * this.fpsHeldWeaponSwayHorizontalAmplitude * swayAmountT,
      swayVertical * this.fpsHeldWeaponSwayVerticalAmplitude * swayAmountT,
    );
    return this.fpsHeldWeaponMovementOffset;
  }

  resolveFpsHeldWeaponFovDepthCompensationScale(): number {
    const currentFov =
      typeof this.dependencies.camera.camera.fov === "number" && Number.isFinite(this.dependencies.camera.camera.fov)
        ? this.dependencies.camera.camera.fov
        : this.dependencies.camera.resolveFpsCameraFov();
    const baseFovTan = Math.tan(
      THREE.MathUtils.degToRad(this.dependencies.camera.defaultFpsCameraFov) / 2,
    );
    const currentFovTan = Math.tan(
      THREE.MathUtils.degToRad(THREE.MathUtils.clamp(currentFov, 45, 110)) / 2,
    );
    if (baseFovTan <= 0 || currentFovTan <= 0) {
      return 1;
    }
    const targetScale = THREE.MathUtils.clamp(
      baseFovTan / currentFovTan,
      this.fpsHeldWeaponFovDepthCompensationMinScale,
      this.fpsHeldWeaponFovDepthCompensationMaxScale,
    );
    return THREE.MathUtils.lerp(
      1,
      targetScale,
      this.fpsHeldWeaponFovDepthCompensationStrength,
    );
  }

  resolveFpsHeldWeaponHorizontalTranslationScale(): number {
    const cameraAspect =
      typeof this.dependencies.camera.camera.aspect === "number" &&
      Number.isFinite(this.dependencies.camera.camera.aspect)
        ? this.dependencies.camera.camera.aspect
        : Number.NaN;
    if (!(cameraAspect > 0)) {
      return 1;
    }
    return cameraAspect / this.fpsHeldWeaponAuthoredAspectRatio;
  }

  clearFpsHeldWeaponAnimationState(): void {
    this.fpsHeldWeaponActiveAnimation = null;
  }

  getFpsHeldWeaponAnimation(
    animationId: string,
  ): FpsHeldWeaponAnimationDefinition | null {
    return this.fpsHeldWeaponAnimations[animationId] ?? null;
  }

  selectWeightedFpsHeldWeaponAnimationVariation(
    variationGroupId: string,
    animationIds: readonly string[],
  ): FpsHeldWeaponAnimationDefinition | null {
    const variations = animationIds
      .map((animationId) => this.getFpsHeldWeaponAnimation(animationId))
      .filter((animation): animation is FpsHeldWeaponAnimationDefinition =>
        Boolean(animation),
      );
    if (variations.length <= 0) {
      return null;
    }
    if (variations.length === 1) {
      return variations[0] ?? null;
    }

    const lastPlayedVariationId =
      this.lastPlayedFpsHeldWeaponAnimationVariationIdByGroup.get(
        variationGroupId,
      ) ?? null;
    const weights = variations.map((animation) => {
      const baseWeight = Math.max(0, Number(animation.weight ?? 1));
      if (animation.id === lastPlayedVariationId) {
        return baseWeight * this.fpsHeldWeaponRepeatedVariationWeight;
      }
      return baseWeight;
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (!(totalWeight > 0)) {
      return variations[0] ?? null;
    }

    let remaining = Math.random() * totalWeight;
    for (let index = 0; index < variations.length; index += 1) {
      remaining -= weights[index] ?? 0;
      if (remaining <= 0) {
        return variations[index] ?? null;
      }
    }
    return variations[variations.length - 1] ?? null;
  }

  playFpsHeldWeaponAnimation(
    animationId: string,
    options: { durationScale?: number } = {},
  ): boolean {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return false;
    }
    const animation = this.getFpsHeldWeaponAnimation(animationId);
    if (!animation || animation.keyframes.length <= 0) {
      return false;
    }
    const durationScale =
      Number.isFinite(options.durationScale) && options.durationScale
        ? Math.max(0.0001, options.durationScale)
        : 1;
    const firstKeyframeSoundEffect = animation.keyframes[0]?.soundEffect;
    this.fpsHeldWeaponActiveAnimation = {
      animationId,
      startedAtMs: performance.now(),
      durationScale,
      lastProcessedKeyframeIndex: 0,
    };
    if (firstKeyframeSoundEffect) {
      this.playFpsHeldWeaponAnimationSoundEffect(firstKeyframeSoundEffect);
    }
    return true;
  }

  playFpsHeldWeaponSwipeAnimation(): void {
    const selectedVariation =
      this.selectWeightedFpsHeldWeaponAnimationVariation(
        FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_ID,
        FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_IDS,
      );
    if (!selectedVariation) {
      this.playFpsHeldWeaponAnimation(FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_ID);
      return;
    }
    this.lastPlayedFpsHeldWeaponAnimationVariationIdByGroup.set(
      FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_ID,
      selectedVariation.id,
    );
    this.playFpsHeldWeaponAnimation(selectedVariation.id);
  }

  playFpsHeldWeaponAnimationSoundEffect(
    soundEffect: FpsHeldWeaponAnimationSoundEffect,
  ): void {
    if (soundEffect === "missed_attack") {
      this.dependencies.audioHapticsPlatform.messageSoundHooks.playMissedAttackSound();
    }
  }

  resolveFpsHeldWeaponAnimationPose(now: number = performance.now()): {
    active: boolean;
    translation: FpsHeldWeaponAnimationVector3;
    rotationDeg: FpsHeldWeaponAnimationVector3;
    pivotNormalized: FpsHeldWeaponAnimationVector3;
  } {
    const zero = createZeroFpsHeldWeaponAnimationVector();
    const activeAnimation = this.fpsHeldWeaponActiveAnimation;
    if (activeAnimation) {
      const animation = this.getFpsHeldWeaponAnimation(
        activeAnimation.animationId,
      );
      if (animation) {
        const elapsedMs = now - activeAnimation.startedAtMs;
        const sample = sampleFpsHeldWeaponAnimation(
          animation,
          elapsedMs,
          activeAnimation.durationScale,
        );
        const currentKeyframeIndex = sample.currentKeyframeIndex;
        if (
          currentKeyframeIndex !== null &&
          currentKeyframeIndex > activeAnimation.lastProcessedKeyframeIndex
        ) {
          for (
            let index = activeAnimation.lastProcessedKeyframeIndex + 1;
            index <= currentKeyframeIndex;
            index += 1
          ) {
            const soundEffect = animation.keyframes[index]?.soundEffect;
            if (soundEffect) {
              this.playFpsHeldWeaponAnimationSoundEffect(soundEffect);
            }
          }
          activeAnimation.lastProcessedKeyframeIndex = currentKeyframeIndex;
        }
        if (sample.active) {
          return {
            active: true,
            translation: sample.translation,
            rotationDeg: sample.rotationDeg,
            pivotNormalized: animation.pivotNormalized,
          };
        }
      }
      this.clearFpsHeldWeaponAnimationState();
    }

    if (
      this.dependencies.heldWeaponAnimationDebug.fpsHeldWeaponAnimationDebugVisible &&
      this.dependencies.heldWeaponAnimationDebug.fpsHeldWeaponAnimationDebugPreviewSelectedKeyframe
    ) {
      const animation = this.dependencies.heldWeaponAnimationDebug.getFpsHeldWeaponAnimationDebugSelectedAnimation();
      if (animation && animation.keyframes.length > 0) {
        const keyframeIndex = THREE.MathUtils.clamp(
          this.dependencies.heldWeaponAnimationDebug.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex,
          0,
          animation.keyframes.length - 1,
        );
        const keyframe = animation.keyframes[keyframeIndex];
        return {
          active: true,
          translation: keyframe.translation,
          rotationDeg: keyframe.rotationDeg,
          pivotNormalized: animation.pivotNormalized,
        };
      }
    }

    return {
      active: false,
      translation: zero,
      rotationDeg: zero,
      pivotNormalized: zero,
    };
  }

  syncFpsHeldWeaponSprite(deltaSeconds: number): void {
    const textureState = this.resolveFpsHeldWeaponTextureState();
    if (!textureState) {
      if (this.fpsHeldWeaponMesh) {
        this.fpsHeldWeaponMesh.visible = false;
      }
      this.fpsHeldWeaponLagYaw = null;
      this.fpsHeldWeaponLagPitch = null;
      this.fpsHeldWeaponMovementOffset.set(0, 0);
      this.fpsHeldWeaponSwayPhase = 0;
      this.fpsHeldWeaponSwaySpeed = 0;
      this.fpsHeldWeaponSwaySpeedTarget = 0;
      this.clearFpsHeldWeaponAnimationState();
      this.dependencies.combatAttribution.pendingFpsHeldWeaponMeleeSwipeContext = null;
      this.dependencies.combatAttribution.suppressNextFpsHeldWeaponMissedAttackMessageSound = false;
      return;
    }

    const mesh = this.ensureFpsHeldWeaponMesh();
    const material = this.fpsHeldWeaponMaterial;
    if (!material) {
      return;
    }

    if (
      this.fpsHeldWeaponTextureSignature !== textureState.signature ||
      !this.fpsHeldWeaponTexture ||
      material.map !== this.fpsHeldWeaponTexture
    ) {
      this.invalidateFpsHeldWeaponTexture();
      const tileFlipState = this.resolveFpsHeldWeaponTileFlipState(
        textureState.tileIndex >= 0 ? textureState.tileIndex : null,
      );
      const texture = this.createFpsHeldWeaponFlippedTexture(
        this.dependencies.glyphTextures.createTileTexture(textureState.tileIndex, 1, true, {
          sourceGlyph: textureState.sourceGlyph,
        }),
        tileFlipState,
      );
      const aspectRatio = THREE.MathUtils.clamp(
        this.measureTextureOpaqueAspectRatio(texture),
        0.45,
        1.8,
      );
      this.fpsHeldWeaponTexture = texture;
      this.fpsHeldWeaponTextureSignature = textureState.signature;
      material.map = texture;
      material.needsUpdate = true;
      mesh.userData.aspectRatio = aspectRatio;
    }

    const aspectRatio =
      typeof mesh.userData?.aspectRatio === "number" &&
      Number.isFinite(mesh.userData.aspectRatio)
        ? THREE.MathUtils.clamp(mesh.userData.aspectRatio, 0.45, 1.8)
        : 1;
    const horizontalScale = aspectRatio * this.fpsHeldWeaponScaleY;
    const verticalScale = this.fpsHeldWeaponScaleY;
    mesh.scale.set(horizontalScale, verticalScale, 1);

    if (
      this.fpsHeldWeaponLagYaw === null ||
      !Number.isFinite(this.fpsHeldWeaponLagYaw)
    ) {
      this.fpsHeldWeaponLagYaw = this.dependencies.camera.wrapAngle(this.dependencies.camera.cameraYaw);
    }
    const lagAlpha =
      1 -
      Math.exp(
        (-Math.LN2 * deltaSeconds * 1000) / this.fpsHeldWeaponYawLagHalfLifeMs,
      );
    this.fpsHeldWeaponLagYaw = this.dependencies.camera.wrapAngle(
      this.fpsHeldWeaponLagYaw +
        this.dependencies.camera.wrapAngle(this.dependencies.camera.cameraYaw - this.fpsHeldWeaponLagYaw) * lagAlpha,
    );
    const yawLagOffset = THREE.MathUtils.clamp(
      -this.dependencies.camera.wrapAngle(this.dependencies.camera.cameraYaw - this.fpsHeldWeaponLagYaw) *
        this.fpsHeldWeaponYawLagAmount,
      -this.fpsHeldWeaponYawLagMax,
      this.fpsHeldWeaponYawLagMax,
    );
    if (
      this.fpsHeldWeaponLagPitch === null ||
      !Number.isFinite(this.fpsHeldWeaponLagPitch)
    ) {
      this.fpsHeldWeaponLagPitch = this.dependencies.camera.cameraPitch;
    }
    const pitchLagAlpha =
      1 -
      Math.exp(
        (-Math.LN2 * deltaSeconds * 1000) /
          this.fpsHeldWeaponPitchLagHalfLifeMs,
      );
    this.fpsHeldWeaponLagPitch +=
      (this.dependencies.camera.cameraPitch - this.fpsHeldWeaponLagPitch) * pitchLagAlpha;
    const pitchLagOffset = THREE.MathUtils.clamp(
      -(this.dependencies.camera.cameraPitch - this.fpsHeldWeaponLagPitch) *
        this.fpsHeldWeaponPitchLagAmount,
      -this.fpsHeldWeaponPitchLagMax,
      this.fpsHeldWeaponPitchLagMax,
    );
    const pitchT = THREE.MathUtils.inverseLerp(
      this.dependencies.camera.firstPersonPitchMin,
      this.dependencies.camera.firstPersonPitchMax,
      THREE.MathUtils.clamp(
        this.dependencies.camera.cameraPitch,
        this.dependencies.camera.firstPersonPitchMin,
        this.dependencies.camera.firstPersonPitchMax,
      ),
    );
    const pitchOffset =
      (0.5 - pitchT) * 2 * this.fpsHeldWeaponPitchOffsetRange + pitchLagOffset;
    const movementOffset =
      this.resolveFpsHeldWeaponMovementOffset(deltaSeconds);
    const animationPose = this.resolveFpsHeldWeaponAnimationPose();
    const fovDepthCompensationScale =
      this.resolveFpsHeldWeaponFovDepthCompensationScale();

    this.fpsHeldWeaponLocalOffset.set(
      this.fpsHeldWeaponBaseLocalOffset.x,
      this.fpsHeldWeaponBaseLocalOffset.y,
      this.fpsHeldWeaponBaseLocalOffset.z,
    );
    this.fpsHeldWeaponLocalOffset.z *= fovDepthCompensationScale;
    this.fpsHeldWeaponLocalOffset.x += yawLagOffset + movementOffset.x;
    this.fpsHeldWeaponLocalOffset.y += pitchOffset + movementOffset.y;
    if (!animationPose.active) {
      this.fpsHeldWeaponLocalOffset.x += this.fpsHeldWeaponBasePose.position.x;
      this.fpsHeldWeaponLocalOffset.y += this.fpsHeldWeaponBasePose.position.y;
      this.fpsHeldWeaponLocalOffset.z += this.fpsHeldWeaponBasePose.position.z;
    }
    if (animationPose.active) {
      const width = horizontalScale;
      const height = verticalScale;
      this.fpsHeldWeaponAnimationPivotLocal.copy(this.fpsHeldWeaponLocalOffset);
      this.fpsHeldWeaponAnimationPivotLocal.x +=
        width * animationPose.pivotNormalized.x + animationPose.translation.x;
      this.fpsHeldWeaponAnimationPivotLocal.y +=
        height * animationPose.pivotNormalized.y + animationPose.translation.y;
      this.fpsHeldWeaponAnimationPivotLocal.z +=
        animationPose.pivotNormalized.z + animationPose.translation.z;
      this.fpsHeldWeaponAnimationCenterFromPivot.set(
        -width * animationPose.pivotNormalized.x,
        -height * animationPose.pivotNormalized.y,
        -animationPose.pivotNormalized.z,
      );
      this.fpsHeldWeaponAnimationEuler.set(
        THREE.MathUtils.degToRad(animationPose.rotationDeg.x),
        THREE.MathUtils.degToRad(animationPose.rotationDeg.y),
        THREE.MathUtils.degToRad(animationPose.rotationDeg.z),
        "XYZ",
      );
      this.fpsHeldWeaponAnimationQuaternion.setFromEuler(
        this.fpsHeldWeaponAnimationEuler,
      );
      this.fpsHeldWeaponAnimationRotatedCenter
        .copy(this.fpsHeldWeaponAnimationCenterFromPivot)
        .applyQuaternion(this.fpsHeldWeaponAnimationQuaternion);
      this.fpsHeldWeaponLocalOffset
        .copy(this.fpsHeldWeaponAnimationPivotLocal)
        .add(this.fpsHeldWeaponAnimationRotatedCenter);
    }
    // Weapon placement was authored at 16:9, so remap horizontal offsets to the
    // current viewport aspect before projecting back into world space.
    this.fpsHeldWeaponLocalOffset.x *=
      this.resolveFpsHeldWeaponHorizontalTranslationScale();
    this.dependencies.damageNumbers.fromCameraLocalOffset(
      this.fpsHeldWeaponLocalOffset,
      this.fpsHeldWeaponWorldPosition,
    );
    mesh.position.copy(this.fpsHeldWeaponWorldPosition);
    this.fpsHeldWeaponBaseRotationEuler.set(
      THREE.MathUtils.degToRad(
        animationPose.active
          ? animationPose.rotationDeg.x
          : this.fpsHeldWeaponBasePose.rotationDeg.x,
      ),
      THREE.MathUtils.degToRad(
        animationPose.active
          ? animationPose.rotationDeg.y
          : this.fpsHeldWeaponBasePose.rotationDeg.y,
      ),
      THREE.MathUtils.degToRad(
        animationPose.active
          ? animationPose.rotationDeg.z
          : this.fpsHeldWeaponBasePose.rotationDeg.z,
      ),
      "XYZ",
    );
    this.fpsHeldWeaponBaseRotationQuaternion.setFromEuler(
      this.fpsHeldWeaponBaseRotationEuler,
    );
    this.fpsHeldWeaponWorldQuaternion
      .copy(this.dependencies.camera.camera.quaternion)
      .multiply(this.fpsHeldWeaponBaseRotationQuaternion);
    mesh.quaternion.copy(this.fpsHeldWeaponWorldQuaternion);
    applyCameraAttachedWorldAspect(mesh, this.dependencies.camera.camera,
      this.dependencies.camera.getActiveCamera(),
      this.dependencies.renderPipeline.scene.scale.x, this.inverseWorldTileScale);
    mesh.visible = true;
  }
}
