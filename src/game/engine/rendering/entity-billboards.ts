import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import { TERMINAL_MG_FLAGS } from "../../terminal/terminal-display";
import type { TileBehaviorResult, TileMaterialKind } from "../../glyphs";
import {
  NH3D_LUCIDE_HEART_PATH,
  NH3D_PET_HEART_COLOR,
  NH3D_PET_HEART_MIN_TILE_RESOLUTION
} from "../shared/constants";
import type { BillboardShatter } from "../effects/billboard-shatter";
import type { Camera } from "../camera/camera";
import type { DamageFlashes } from "../effects/damage-flashes";
import type { EngineState } from "../runtime/engine-state";
import type { GlyphTextures } from "./glyph-textures";
import type { Lighting } from "./lighting";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PositionSelection } from "../input/position-selection";
import type { RenderPipeline } from "./render-pipeline";
import type { TerminalRendering } from "./terminal-rendering";
import type { TilesetAssets } from "./tileset-assets";
import type { VultureProjection } from "./vulture-projection";
import type { WorldClassification } from "../world/world-classification";

export interface EntityBillboardsDependencies {
  readonly billboardShatter: Pick<
    BillboardShatter,
    "resolveMonsterBillboardTextureSource"
  >;
  readonly camera: Pick<
    Camera,
    "camera"
    | "cameraYaw"
  >;
  readonly damageFlashes: Pick<
    DamageFlashes,
    "stopMonsterBillboardDamageFlash"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "createTileTexture"
  >;
  readonly lighting: Pick<
    Lighting,
    "patchMaterialForVignette"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "fpsLastPlayerMoveFromTile"
    | "hasSeenPlayerPosition"
    | "playerPos"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "isFpsFarLookViewActive"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "terminalRenderOptionStates"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveTextureAnisotropyLevel"
    | "shouldUseVultureTiles"
    | "tileSourceSize"
  >;
  readonly vultureProjection: Pick<
    VultureProjection,
    "getVultureBillboardScaleFactor"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "getPlayerUnderlayBillboardKey"
    | "isBoulderGlyphByCatalog"
    | "isUnderlayFeatureBillboardKey"
  >;
}

/** Entity billboard texture ownership, sprites, pitch/flat proxies and blob shadows */
export class EntityBillboards {
  constructor(private readonly dependencies: EntityBillboardsDependencies) {}

  readonly elevatedMonsterZ = WALL_HEIGHT * 0.58;

  entityBlobShadows: Map<string, THREE.Mesh> = new Map();

  entityBlobShadowTexture: THREE.CanvasTexture | null = null;

  monsterBillboards: Map<string, THREE.Sprite> = new Map();

  monsterBillboardTextures: Map<
    string,
    { texture: THREE.CanvasTexture; refCount: number }
  > = new Map();

  readonly vultureBillboardRenderOrder: number = 915;

  readonly vultureFlattenedBillboardRenderOrder: number = 914.5;

  readonly fpsPitchLockedBillboardGeometry = new THREE.PlaneGeometry(
    1,
    1,
  );

  readonly fpsPitchLockedBillboardForward = new THREE.Vector3();

  readonly fpsPitchLockedBillboardRight = new THREE.Vector3();

  readonly fpsPitchLockedBillboardLookTarget = new THREE.Vector3();

  readonly fpsPlayerTileBillboardSideNudge = TILE_SIZE * 0.24;

  resolveStandardBillboardRenderOrder(
    useVultureBillboardGrounding: boolean,
  ): number {
    return useVultureBillboardGrounding
      ? this.vultureBillboardRenderOrder
      : 910;
  }

  shouldUseStandingBillboardOverlayMode(): boolean {
    if (this.dependencies.tilesetAssets.shouldUseVultureTiles()) {
      return true;
    }
    return !this.dependencies.engineState.clientOptions.fpsFlattenEntityBillboards;
  }

  shouldAnimatePlayerBillboardsInFps(): boolean {
    return false;
  }

  shouldAnimateGlyphMoveTransitions(): boolean {
    return (
      this.dependencies.engineState.clientOptions.animatedMovement &&
      this.dependencies.engineState.clientOptions.tilesetMode !== "terminal"
    );
  }

  shouldShowPetHighlightHeart(
    behavior: TileBehaviorResult,
    runtimeGlyphFlags: unknown,
  ): boolean {
    if (!this.dependencies.terminalRendering.terminalRenderOptionStates.hilitePet) {
      return false;
    }
    if (
      behavior.effective.kind === "pet" ||
      behavior.effective.kind === "ridden"
    ) {
      return true;
    }
    return (
      typeof runtimeGlyphFlags === "number" &&
      (Math.trunc(runtimeGlyphFlags) & TERMINAL_MG_FLAGS.pet) !== 0
    );
  }

  getMonsterBillboardQualityKey(): string {
    return "1024-v1";
  }

  createMonsterBillboardTexture(
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
    texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  createPetHighlightedBillboardTexture(
    baseTexture: THREE.CanvasTexture,
  ): THREE.CanvasTexture {
    const sourceInfo = this.dependencies.billboardShatter.resolveMonsterBillboardTextureSource(baseTexture);
    if (!sourceInfo || typeof Path2D === "undefined") {
      return baseTexture;
    }

    const sourceMinAxis = Math.max(
      1,
      Math.min(sourceInfo.width, sourceInfo.height),
    );
    const outputScale = Math.max(
      1,
      Math.ceil(NH3D_PET_HEART_MIN_TILE_RESOLUTION / sourceMinAxis),
    );
    const canvas = document.createElement("canvas");
    canvas.width = sourceInfo.width * outputScale;
    canvas.height = sourceInfo.height * outputScale;
    const context = canvas.getContext("2d");
    if (!context) {
      return baseTexture;
    }

    // Preserve the tileset's original pixel boundaries when a sub-32px tile
    // needs a larger decoration surface. The heart itself is then rasterized
    // at no less than the resolution of a 32px tileset.
    context.imageSmoothingEnabled = outputScale === 1;
    context.drawImage(sourceInfo.source, 0, 0, canvas.width, canvas.height);
    const iconSize = Math.max(
      8,
      Math.min(canvas.width, canvas.height) * 0.34,
    );
    const inset = Math.max(1, Math.min(canvas.width, canvas.height) * 0.035);
    const iconScale = iconSize / 24;
    const heartPath = new Path2D(NH3D_LUCIDE_HEART_PATH);
    context.save();
    context.translate(canvas.width - inset - iconSize, inset);
    context.scale(iconScale, iconScale);
    context.lineJoin = "round";
    context.lineCap = "round";
    context.shadowColor = "rgba(0, 0, 0, 0.95)";
    context.shadowBlur = 1.8;
    context.shadowOffsetX = 0.8;
    context.shadowOffsetY = 1.1;
    context.fillStyle = NH3D_PET_HEART_COLOR;
    context.strokeStyle = "rgba(0, 0, 0, 0.94)";
    context.lineWidth = 2.6;
    context.stroke(heartPath);
    context.fill(heartPath);
    context.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();
    texture.magFilter = baseTexture.magFilter;
    texture.minFilter = baseTexture.minFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = baseTexture.colorSpace;
    baseTexture.dispose();
    return texture;
  }

  ensureEntityBlobShadowTexture(): THREE.CanvasTexture {
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
    texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();
    this.entityBlobShadowTexture = texture;
    return texture;
  }

  acquireMonsterBillboardTexture(
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

  releaseMonsterBillboardTexture(key: string): void {
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

  removeEntityBlobShadow(key: string): void {
    const shadow = this.entityBlobShadows.get(key);
    if (!shadow) {
      return;
    }
    this.dependencies.renderPipeline.scene.remove(shadow);
    const material = shadow.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.dispose();
    }
    shadow.geometry.dispose();
    this.entityBlobShadows.delete(key);
  }

  getMonsterBillboardFlattenedBackdropSprite(
    sprite: THREE.Sprite,
  ): THREE.Sprite | null {
    const candidate = sprite.userData?.flattenedBackdropSprite;
    return candidate instanceof THREE.Sprite ? candidate : null;
  }

  disposeMonsterBillboardFlattenedBackdropSprite(
    sprite: THREE.Sprite,
  ): void {
    const backdrop = this.getMonsterBillboardFlattenedBackdropSprite(sprite);
    if (!backdrop) {
      return;
    }
    sprite.remove(backdrop);
    const material = backdrop.material;
    if (material instanceof THREE.SpriteMaterial) {
      material.dispose();
    }
    delete sprite.userData.flattenedBackdropSprite;
  }

  ensureMonsterBillboardFlattenedBackdropSprite(
    sprite: THREE.Sprite,
    texture: THREE.Texture | null,
    enabled: boolean,
    depthTest: boolean,
    alphaTest: number,
  ): THREE.Sprite | null {
    if (!enabled || !texture) {
      this.disposeMonsterBillboardFlattenedBackdropSprite(sprite);
      return null;
    }

    let backdrop = this.getMonsterBillboardFlattenedBackdropSprite(sprite);
    if (!backdrop) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest,
        alphaTest,
        toneMapped: false,
      });
      this.dependencies.lighting.patchMaterialForVignette(material);
      backdrop = new THREE.Sprite(material);
      backdrop.center.set(0.5, 0);
      backdrop.renderOrder = this.vultureFlattenedBillboardRenderOrder;
      backdrop.position.set(0, 0, 0);
      sprite.add(backdrop);
      sprite.userData.flattenedBackdropSprite = backdrop;
      return backdrop;
    }

    const material = backdrop.material;
    if (material instanceof THREE.SpriteMaterial) {
      material.map = texture;
      material.depthWrite = false;
      material.depthTest = depthTest;
      material.alphaTest = alphaTest;
      material.needsUpdate = true;
    }
    backdrop.center.set(0.5, 0);
    backdrop.renderOrder = this.vultureFlattenedBillboardRenderOrder;
    backdrop.position.set(0, 0, 0);
    return backdrop;
  }

  getMonsterBillboardPitchLockedProxyMesh(
    sprite: THREE.Sprite,
  ): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null {
    const candidate = sprite.userData?.fpsPitchLockedProxyMesh;
    if (
      candidate instanceof THREE.Mesh &&
      candidate.geometry instanceof THREE.PlaneGeometry &&
      candidate.material instanceof THREE.MeshBasicMaterial
    ) {
      return candidate as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >;
    }
    return null;
  }

  disposeMonsterBillboardPitchLockedProxyMesh(
    sprite: THREE.Sprite,
  ): void {
    const proxy = this.getMonsterBillboardPitchLockedProxyMesh(sprite);
    if (!proxy) {
      return;
    }
    this.dependencies.renderPipeline.scene.remove(proxy);
    proxy.material.dispose();
    delete sprite.userData.fpsPitchLockedProxyMesh;
  }

  ensureMonsterBillboardPitchLockedProxyMesh(
    sprite: THREE.Sprite,
  ): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null {
    const spriteMaterial = sprite.material;
    if (!(spriteMaterial instanceof THREE.SpriteMaterial)) {
      this.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
      return null;
    }
    let proxy = this.getMonsterBillboardPitchLockedProxyMesh(sprite);
    if (!proxy) {
      const proxyMaterial = new THREE.MeshBasicMaterial({
        map: spriteMaterial.map ?? null,
        transparent: true,
        depthWrite: spriteMaterial.depthWrite,
        depthTest: spriteMaterial.depthTest,
        alphaTest: spriteMaterial.alphaTest,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      proxyMaterial.opacity = spriteMaterial.opacity;
      proxyMaterial.color.copy(spriteMaterial.color);
      this.dependencies.lighting.patchMaterialForVignette(proxyMaterial);
      proxy = new THREE.Mesh(
        this.fpsPitchLockedBillboardGeometry,
        proxyMaterial,
      );
      proxy.castShadow = false;
      proxy.receiveShadow = false;
      proxy.up.set(0, 0, 1);
      this.dependencies.renderPipeline.scene.add(proxy);
      sprite.userData.fpsPitchLockedProxyMesh = proxy;
    }

    const proxyMaterial = proxy.material;
    proxyMaterial.map = spriteMaterial.map ?? null;
    proxyMaterial.opacity = spriteMaterial.opacity;
    proxyMaterial.color.copy(spriteMaterial.color);
    proxyMaterial.depthWrite = spriteMaterial.depthWrite;
    proxyMaterial.depthTest = spriteMaterial.depthTest;
    proxyMaterial.alphaTest = spriteMaterial.alphaTest;
    proxyMaterial.needsUpdate = true;
    return proxy;
  }

  getMonsterBillboardFlatProxyMesh(
    sprite: THREE.Sprite,
  ): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null {
    const candidate = sprite.userData?.flatBillboardProxyMesh;
    if (
      candidate instanceof THREE.Mesh &&
      candidate.geometry instanceof THREE.PlaneGeometry &&
      candidate.material instanceof THREE.MeshBasicMaterial
    ) {
      return candidate as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >;
    }
    return null;
  }

  disposeMonsterBillboardFlatProxyMesh(sprite: THREE.Sprite): void {
    const proxy = this.getMonsterBillboardFlatProxyMesh(sprite);
    if (!proxy) {
      return;
    }
    this.dependencies.renderPipeline.scene.remove(proxy);
    proxy.material.dispose();
    delete sprite.userData.flatBillboardProxyMesh;
  }

  ensureMonsterBillboardFlatProxyMesh(
    sprite: THREE.Sprite,
  ): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null {
    const spriteMaterial = sprite.material;
    if (!(spriteMaterial instanceof THREE.SpriteMaterial)) {
      this.disposeMonsterBillboardFlatProxyMesh(sprite);
      return null;
    }

    let proxy = this.getMonsterBillboardFlatProxyMesh(sprite);
    if (!proxy) {
      const proxyMaterial = new THREE.MeshBasicMaterial({
        map: spriteMaterial.map ?? null,
        transparent: true,
        depthWrite: spriteMaterial.depthWrite,
        depthTest: spriteMaterial.depthTest,
        alphaTest: spriteMaterial.alphaTest,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      proxyMaterial.opacity = spriteMaterial.opacity;
      proxyMaterial.color.copy(spriteMaterial.color);
      this.dependencies.lighting.patchMaterialForVignette(proxyMaterial);
      proxy = new THREE.Mesh(
        this.fpsPitchLockedBillboardGeometry,
        proxyMaterial,
      );
      proxy.castShadow = false;
      proxy.receiveShadow = false;
      this.dependencies.renderPipeline.scene.add(proxy);
      sprite.userData.flatBillboardProxyMesh = proxy;
    }

    const proxyMaterial = proxy.material;
    proxyMaterial.map = spriteMaterial.map ?? null;
    proxyMaterial.opacity = spriteMaterial.opacity;
    proxyMaterial.color.copy(spriteMaterial.color);
    proxyMaterial.depthWrite = spriteMaterial.depthWrite;
    proxyMaterial.depthTest = spriteMaterial.depthTest;
    proxyMaterial.alphaTest = spriteMaterial.alphaTest;
    proxyMaterial.needsUpdate = true;
    return proxy;
  }

  updateMonsterBillboardPitchLockStateForEntry(
    sprite: THREE.Sprite,
  ): void {
    const billboardKey =
      typeof sprite.userData?.billboardKey === "string"
        ? sprite.userData.billboardKey
        : "";
    const isUnderlayFeatureBillboard =
      billboardKey.length > 0 &&
      this.dependencies.worldClassification.isUnderlayFeatureBillboardKey(billboardKey);
    const shouldUseFlatUnderlayProxy =
      !this.dependencies.movementInput.isFpsMode() &&
      isUnderlayFeatureBillboard &&
      this.dependencies.engineState.clientOptions.fpsFlattenEntityBillboards &&
      !this.dependencies.tilesetAssets.shouldUseVultureTiles();

    if (shouldUseFlatUnderlayProxy) {
      const proxy = this.ensureMonsterBillboardFlatProxyMesh(sprite);
      if (!proxy) {
        sprite.visible = true;
        return;
      }
      const floorZ =
        typeof sprite.userData?.floorZ === "number" &&
        Number.isFinite(sprite.userData.floorZ)
          ? sprite.userData.floorZ
          : 0.028;
      proxy.position.copy(sprite.position);
      proxy.position.z = floorZ + TILE_SIZE * 0.002;
      proxy.scale.set(sprite.scale.x, sprite.scale.y, 1);
      proxy.rotation.set(0, 0, 0, "XYZ");
      proxy.renderOrder = sprite.renderOrder;
      proxy.visible = true;
      sprite.visible = false;
      this.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
      return;
    }

    this.disposeMonsterBillboardFlatProxyMesh(sprite);

    if (!this.dependencies.movementInput.isFpsMode()) {
      this.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
      sprite.visible = true;
      return;
    }

    if (!this.shouldUseStandingBillboardOverlayMode()) {
      this.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
      sprite.visible = true;
      return;
    }

    const tileXRaw = Number(sprite.userData?.tileX);
    const tileYRaw = Number(sprite.userData?.tileY);
    if (!Number.isFinite(tileXRaw) || !Number.isFinite(tileYRaw)) {
      this.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
      sprite.visible = true;
      return;
    }
    const tileX = Math.round(tileXRaw);
    const tileY = Math.round(tileYRaw);
    const isCurrentPlayerTile =
      this.dependencies.playerMovement.hasSeenPlayerPosition &&
      tileX === this.dependencies.playerMovement.playerPos.x &&
      tileY === this.dependencies.playerMovement.playerPos.y;
    const usePlayerCentricFacing =
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.playerMovement.hasSeenPlayerPosition &&
      !this.dependencies.positionSelection.isFpsFarLookViewActive();

    const proxy = this.ensureMonsterBillboardPitchLockedProxyMesh(sprite);
    if (!proxy) {
      sprite.visible = true;
      return;
    }

    proxy.position.copy(sprite.position);
    proxy.scale.copy(sprite.scale);
    if (isCurrentPlayerTile && usePlayerCentricFacing) {
      const previousTile = this.dependencies.playerMovement.fpsLastPlayerMoveFromTile;
      if (previousTile) {
        this.fpsPitchLockedBillboardRight.set(
          tileX - previousTile.x,
          -(tileY - previousTile.y),
          0,
        );
      } else {
        this.fpsPitchLockedBillboardRight.set(0, 0, 0);
      }
      if (this.fpsPitchLockedBillboardRight.lengthSq() > 1e-8) {
        this.fpsPitchLockedBillboardRight.normalize();
        proxy.position.addScaledVector(
          this.fpsPitchLockedBillboardRight,
          this.fpsPlayerTileBillboardSideNudge,
        );
      }
    }
    const spriteCenterY =
      typeof sprite.center?.y === "number" && Number.isFinite(sprite.center.y)
        ? sprite.center.y
        : 0.5;
    proxy.position.z += (0.5 - spriteCenterY) * proxy.scale.y;
    proxy.renderOrder = sprite.renderOrder;
    if (usePlayerCentricFacing) {
      this.fpsPitchLockedBillboardForward.set(
        this.dependencies.playerMovement.playerPos.x * TILE_SIZE - proxy.position.x,
        -this.dependencies.playerMovement.playerPos.y * TILE_SIZE - proxy.position.y,
        0,
      );
    } else {
      this.fpsPitchLockedBillboardForward.set(
        this.dependencies.camera.camera.position.x - proxy.position.x,
        this.dependencies.camera.camera.position.y - proxy.position.y,
        0,
      );
      if (this.fpsPitchLockedBillboardForward.lengthSq() < 1e-8) {
        this.dependencies.camera.camera.getWorldDirection(this.fpsPitchLockedBillboardForward);
        this.fpsPitchLockedBillboardForward.z = 0;
      }
    }
    if (this.fpsPitchLockedBillboardForward.lengthSq() < 1e-8) {
      this.fpsPitchLockedBillboardForward.set(
        -Math.sin(this.dependencies.camera.cameraYaw),
        -Math.cos(this.dependencies.camera.cameraYaw),
        0,
      );
    } else {
      this.fpsPitchLockedBillboardForward.normalize();
    }
    this.fpsPitchLockedBillboardLookTarget
      .copy(proxy.position)
      .add(this.fpsPitchLockedBillboardForward);
    proxy.lookAt(this.fpsPitchLockedBillboardLookTarget);
    proxy.visible = true;
    sprite.visible = false;
  }

  updateMonsterBillboardPitchLockState(): void {
    if (this.monsterBillboards.size === 0) {
      return;
    }
    for (const sprite of this.monsterBillboards.values()) {
      this.updateMonsterBillboardPitchLockStateForEntry(sprite);
    }
  }

  detachMonsterBillboard(key: string): THREE.Sprite | null {
    this.removeEntityBlobShadow(key);
    this.dependencies.damageFlashes.stopMonsterBillboardDamageFlash(key);
    const sprite = this.monsterBillboards.get(key);
    if (!sprite) {
      return null;
    }
    this.dependencies.renderPipeline.scene.remove(sprite);
    this.monsterBillboards.delete(key);
    return sprite;
  }

  disposeDetachedMonsterBillboard(sprite: THREE.Sprite): void {
    this.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
    this.disposeMonsterBillboardFlatProxyMesh(sprite);
    this.disposeMonsterBillboardFlattenedBackdropSprite(sprite);
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

  removeMonsterBillboard(key: string): void {
    if (!key.includes("|")) {
      const underlayKey = this.dependencies.worldClassification.getPlayerUnderlayBillboardKey(key);
      if (underlayKey !== key) {
        this.removeMonsterBillboard(underlayKey);
      }
    }
    const sprite = this.detachMonsterBillboard(key);
    if (!sprite) {
      return;
    }
    this.disposeDetachedMonsterBillboard(sprite);
  }

  getLowestPixelOffset(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): number {
    const normalizedWidth = Math.max(1, Math.trunc(width));
    const normalizedHeight = Math.max(1, Math.trunc(height));
    const imageData = context.getImageData(
      0,
      0,
      normalizedWidth,
      normalizedHeight,
    );
    const data = imageData.data;
    let lowestPixelY = -1;

    for (let y = normalizedHeight - 1; y >= 0; y--) {
      for (let x = 0; x < normalizedWidth; x++) {
        const alphaIndex = (y * normalizedWidth + x) * 4 + 3;
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
    return (lowestPixelY + 1) / normalizedHeight;
  }

  getSpriteContentWidth(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): number {
    const normalizedWidth = Math.max(1, Math.trunc(width));
    const normalizedHeight = Math.max(1, Math.trunc(height));
    const imageData = context.getImageData(
      0,
      0,
      normalizedWidth,
      normalizedHeight,
    );
    const data = imageData.data;
    let minX = normalizedWidth;
    let maxX = -1;

    for (let y = 0; y < normalizedHeight; y++) {
      for (let x = 0; x < normalizedWidth; x++) {
        const alphaIndex = (y * normalizedWidth + x) * 4 + 3;
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
    return widthInPixels / normalizedWidth;
  }

  ensureEntityBlobShadow(
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
      this.dependencies.lighting.patchMaterialForVignette(material);
      shadow = new THREE.Mesh(geometry, material);
      shadow.renderOrder = 905;
      this.entityBlobShadows.set(key, shadow);
      this.dependencies.renderPipeline.scene.add(shadow);
    }

    shadow.position.set(
      x * TILE_SIZE,
      -y * TILE_SIZE,
      isWall ? WALL_HEIGHT + 0.03 : 0.028,
    );
    shadow.scale.set(scaleBase, scaleBase * 0.82, 1);
  }

  ensureMonsterBillboard(
    key: string,
    x: number,
    y: number,
    glyphChar: string,
    textColor: string,
    tileIndex: number = -1,
    entityType: "monster" | "loot" = "monster",
    isWall: boolean = false,
    sourceGlyph: number | null = null,
    materialKind: TileMaterialKind | null = null,
    showPetHeart: boolean = false,
  ): void {
    const normalizedSourceGlyph =
      typeof sourceGlyph === "number" && Number.isFinite(sourceGlyph)
        ? Math.trunc(sourceGlyph)
        : null;
    const normalizedMaterialKind =
      typeof materialKind === "string" ? materialKind : null;
    const canUseTranslatedTileWithoutAtlas =
      this.dependencies.tilesetAssets.shouldUseVultureTiles() && normalizedSourceGlyph !== null;
    const useTiles =
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
      (tileIndex >= 0 || canUseTranslatedTileWithoutAtlas);
    const backgroundRemovalTextureKey =
      this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "solid"
        ? `solid:${this.dependencies.engineState.clientOptions.tilesetSolidChromaKeyColorHex}`
        : this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "none"
          ? "none"
          : `tile:${this.dependencies.engineState.clientOptions.tilesetBackgroundTileId}`;
    const sourceGlyphKey =
      normalizedSourceGlyph === null ? "none" : String(normalizedSourceGlyph);
    const materialKindKey = normalizedMaterialKind ?? "none";
    const petHeartKey = showPetHeart ? "pet-heart" : "plain";
    const textureKey = useTiles
      ? `tile-billboard:${tileIndex}|sg:${sourceGlyphKey}|mk:${materialKindKey}|bg:${backgroundRemovalTextureKey}`
      : `${this.getMonsterBillboardQualityKey()}|${glyphChar}|${textColor}`;
    const decoratedTextureKey = `${textureKey}|${petHeartKey}`;

    const spriteKey = key;
    let sprite = this.monsterBillboards.get(spriteKey);
    const useVultureWallPlaneOverlay = this.dependencies.tilesetAssets.shouldUseVultureTiles();
    const useVultureBillboardGrounding = useVultureWallPlaneOverlay && useTiles;
    const useVultureFpsDepthOcclusion =
      useVultureWallPlaneOverlay && this.dependencies.movementInput.isFpsMode();
    const spriteDepthWrite = false;
    const spriteDepthTest =
      useVultureFpsDepthOcclusion || !useVultureWallPlaneOverlay;
    const spriteAlphaTest = useVultureWallPlaneOverlay ? 0.01 : 0;
    // Do not render the legacy flattened duplicate behind Vulture billboards.
    // Keep only the standing billboard plus tile-floor underlay.
    const shouldRenderFlattenedBackdrop = false;
    const spriteRenderOrder = this.resolveStandardBillboardRenderOrder(
      useVultureBillboardGrounding,
    );
    if (!sprite) {
      const factory = () => {
        const baseTexture = useTiles
          ? this.dependencies.glyphTextures.createTileTexture(tileIndex, 1, true, {
              sourceGlyph: normalizedSourceGlyph,
              materialKind: normalizedMaterialKind,
            }) // Billboards use transparency.
          : this.createMonsterBillboardTexture(glyphChar, textColor);
        return showPetHeart
          ? this.createPetHighlightedBillboardTexture(baseTexture)
          : baseTexture;
      };

      const texture = this.acquireMonsterBillboardTexture(
        decoratedTextureKey,
        factory,
      );
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: spriteDepthWrite,
        depthTest: spriteDepthTest,
        alphaTest: spriteAlphaTest,
        toneMapped: false,
      });

      // Patch the monster/loot billboard to add vignette lighting
      this.dependencies.lighting.patchMaterialForVignette(material);

      sprite = new THREE.Sprite(material);
      sprite.renderOrder = spriteRenderOrder;
      sprite.userData.textureKey = decoratedTextureKey;
      this.monsterBillboards.set(spriteKey, sprite);
      this.dependencies.renderPipeline.scene.add(sprite);
    } else {
      sprite.renderOrder = spriteRenderOrder;
      const existingTextureKey =
        typeof sprite.userData?.textureKey === "string"
          ? sprite.userData.textureKey
          : "";
      if (existingTextureKey !== decoratedTextureKey) {
        const material = sprite.material;
        if (material instanceof THREE.SpriteMaterial) {
          if (existingTextureKey) {
            this.releaseMonsterBillboardTexture(existingTextureKey);
          } else if (material.map) {
            material.map.dispose();
          }
          const factory = () => {
            const baseTexture = useTiles
              ? this.dependencies.glyphTextures.createTileTexture(tileIndex, 1, true, {
                  sourceGlyph: normalizedSourceGlyph,
                  materialKind: normalizedMaterialKind,
                })
              : this.createMonsterBillboardTexture(glyphChar, textColor);
            return showPetHeart
              ? this.createPetHighlightedBillboardTexture(baseTexture)
              : baseTexture;
          };

          material.map = this.acquireMonsterBillboardTexture(
            decoratedTextureKey,
            factory,
          );
          material.depthWrite = spriteDepthWrite;
          material.depthTest = spriteDepthTest;
          material.alphaTest = spriteAlphaTest;
          material.needsUpdate = true;
          sprite.userData.textureKey = decoratedTextureKey;
        }
      } else {
        const material = sprite.material;
        if (material instanceof THREE.SpriteMaterial) {
          material.depthWrite = spriteDepthWrite;
          material.depthTest = spriteDepthTest;
          material.alphaTest = spriteAlphaTest;
          material.needsUpdate = true;
        }
      }
    }
    sprite.userData.tileIndex =
      typeof tileIndex === "number" && Number.isFinite(tileIndex)
        ? Math.trunc(tileIndex)
        : -1;
    sprite.userData.sourceGlyph = normalizedSourceGlyph;
    sprite.userData.materialKind = normalizedMaterialKind;
    sprite.userData.entityType = entityType;
    sprite.userData.isWall = isWall;
    const mainSpriteMaterial = sprite.material;
    const flattenedBackdropSprite =
      mainSpriteMaterial instanceof THREE.SpriteMaterial
        ? this.ensureMonsterBillboardFlattenedBackdropSprite(
            sprite,
            mainSpriteMaterial.map ?? null,
            shouldRenderFlattenedBackdrop,
            spriteDepthTest,
            spriteAlphaTest,
          )
        : null;

    const shouldForceBoulderScale =
      entityType === "loot" &&
      normalizedSourceGlyph !== null &&
      this.dependencies.worldClassification.isBoulderGlyphByCatalog(normalizedSourceGlyph);

    // Determine sprite scale based on mode
    let scaleBase = this.dependencies.movementInput.isFpsMode() ? (entityType === "loot" ? 0.5 : 0.75) : 1;
    if (shouldForceBoulderScale) {
      scaleBase = 1;
    }
    let scaleX = scaleBase;
    let scaleY = scaleBase;
    let verticalOffset = 1.0;
    let contentWidth = 1.0;
    const spriteMaterial = sprite.material;
    const texture =
      spriteMaterial instanceof THREE.SpriteMaterial
        ? spriteMaterial.map
        : null;
    if (useVultureBillboardGrounding) {
      const textureInfo = texture
        ? this.dependencies.billboardShatter.resolveMonsterBillboardTextureSource(texture)
        : null;
      if (textureInfo) {
        const worldUnitsPerTexturePixelX =
          TILE_SIZE / Math.max(1, this.dependencies.tilesetAssets.tileSourceSize);
        const worldUnitsPerTexturePixelY =
          WALL_HEIGHT / Math.max(1, this.dependencies.tilesetAssets.tileSourceSize);
        scaleX = textureInfo.width * worldUnitsPerTexturePixelX * scaleBase;
        scaleY = textureInfo.height * worldUnitsPerTexturePixelY * scaleBase;
      }
      const billboardScale = this.dependencies.vultureProjection.getVultureBillboardScaleFactor();
      scaleX *= billboardScale;
      scaleY *= billboardScale;
    }
    if (useTiles && texture?.image instanceof HTMLCanvasElement) {
      const canvas = texture.image;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        verticalOffset = this.getLowestPixelOffset(
          context,
          canvas.width,
          canvas.height,
        );
        contentWidth = this.getSpriteContentWidth(
          context,
          canvas.width,
          canvas.height,
        );
      }
    }
    if (useVultureBillboardGrounding) {
      // Anchor vulture billboards from bottom-center so they stand on the tile center.
      sprite.center.set(0.5, 0);
      sprite.scale.set(scaleX, scaleY, 1);
    } else {
      // Keep legacy placement/scaling for non-vulture tilesets and ASCII.
      sprite.center.set(0.5, 0.5);
      sprite.scale.set(scaleBase, scaleBase, 1);
    }
    if (flattenedBackdropSprite) {
      // Keep the historical flattened billboard behind the primary billboard.
      flattenedBackdropSprite.scale.set(scaleBase, scaleBase, 1);
      flattenedBackdropSprite.position.set(0, 0, 0);
    }

    const floorZ = isWall ? WALL_HEIGHT + 0.03 : 0.028;
    const newZ = useVultureBillboardGrounding
      ? floorZ - (1 - verticalOffset) * scaleY
      : (verticalOffset - 0.5) * scaleBase + floorZ;
    sprite.position.set(x * TILE_SIZE, -y * TILE_SIZE, newZ);
    sprite.userData.elevatedZ = newZ;
    sprite.userData.floorZ = floorZ;
    sprite.userData.tileX = x;
    sprite.userData.tileY = y;
    sprite.userData.billboardKey = key;

    const shadowScale =
      ((useVultureBillboardGrounding ? scaleX : scaleBase) *
        contentWidth *
        1.25) /
      (TILE_SIZE * 0.8);
    this.ensureEntityBlobShadow(key, x, y, shadowScale, isWall);
    this.updateMonsterBillboardPitchLockStateForEntry(sprite);
  }
}
