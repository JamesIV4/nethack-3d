import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import type { DamageNumberParticle, PlayerUiNumberParticle } from "../shared/types";
import type { BloodGround } from "./blood-ground";
import type { BloodParticles } from "./blood-particles";
import type { Camera } from "../camera/camera";
import type { CombatAttribution } from "../world/combat-attribution";
import type { DamageFlashes } from "./damage-flashes";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";

export interface DamageNumbersDependencies {
  readonly bloodGround: Pick<
    BloodGround,
    "syncBloodGroundTexture"
  >;
  readonly bloodParticles: Pick<
    BloodParticles,
    "damageParticleFloorZ"
    | "updateDamageParticles"
    | "updateMonsterBillboardShardParticles"
  >;
  readonly camera: Pick<
    Camera,
    "camera"
    | "cameraYaw"
    | "getActiveCamera"
    | "resolveThirdPersonZoomFactor"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    "prunePendingCharacterDamage"
  >;
  readonly damageFlashes: Pick<
    DamageFlashes,
    "updateGlyphDamageFlashes"
    | "updateGlyphDamageShakes"
    | "updateMonsterBillboardDamageFlashes"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
    | "scene"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveTextureAnisotropyLevel"
  >;
}

/** Player damage/heal number sprites, DOM overlays and projected motion */
export class DamageNumbers {
  constructor(private readonly dependencies: DamageNumbersDependencies) {}

  playerDamageNumberParticles: DamageNumberParticle[] = [];

  playerUiNumberParticles: PlayerUiNumberParticle[] = [];

  playerUiNumberOverlay: HTMLDivElement | null = null;

  playerUiNumbersUseWorldProjectionForVr: boolean = false;

  readonly playerUiNumberAnchor = new THREE.Vector3();

  readonly playerUiNumberScreenAnchor = new THREE.Vector3();

  playerUiOverlayBounds = {
    left: Number.NaN,
    top: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
  };

  readonly playerDamageNumberGravity: number = 18.4;

  readonly playerDamageNumberDrag: number = 2.4;

  readonly playerDamageNumberLifetimeMs: number = 1860;

  readonly playerDamageNumberFadeDelayMs: number = 250;

  readonly playerHealNumberLifetimeMs: number = 1200;

  readonly playerHealNumberFadeDelayMs: number = 250;

  readonly playerDamageNumberWallBounce: number = 0.35;

  readonly playerDamageNumberForwardOffset: number = TILE_SIZE * 0.42;

  readonly playerDamageNumberFpsLateralSpread: number =
    TILE_SIZE * 0.14;

  readonly playerDamageNumberFpsRiseDistance: number = 0.34;

  readonly playerDamageNumberNormalScaleFactor: number = 3;

  readonly playerDamageNumberFpsScaleFactor: number = 0.33;

  readonly playerDamageNumberForwardLift: number = 0.07;

  readonly playerDamageNumberForwardDirection = new THREE.Vector3();

  readonly playerDamageNumberRightDirection = new THREE.Vector3();

  readonly playerDamageNumberCameraLocalScratch = new THREE.Vector3();

  readonly playerDamageNumberCameraInverseQuaternion =
    new THREE.Quaternion();

  createDamageNumberCanvas(
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

  createDamageNumberTexture(
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
    texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return { texture, aspectRatio };
  }

  spawnPlayerDamageNumberParticle(
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
    const useFpsFloating = this.dependencies.movementInput.isFpsMode();
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
      this.dependencies.bloodParticles.damageParticleFloorZ + fpsBaseHeightOffset,
    );
    this.applyFpsForwardOffsetToPlayerNumberPosition(
      sprite.position,
      useFpsFloating,
      fpsLateralOffset,
    );
    this.alignPlayerDamageNumberToCamera(sprite);
    sprite.renderOrder = 940;
    this.dependencies.renderPipeline.scene.add(sprite);

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

  spawnPlayerHealNumberParticle(
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
    const useFpsFloating = this.dependencies.movementInput.isFpsMode();
    const zoomFactor = this.dependencies.camera.resolveThirdPersonZoomFactor();
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

  applyFpsForwardOffsetToPlayerNumberPosition(
    position: THREE.Vector3,
    applyVerticalLift: boolean,
    lateralOffset: number = 0,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }

    this.dependencies.camera.camera.getWorldDirection(this.playerDamageNumberForwardDirection);
    this.playerDamageNumberForwardDirection.z = 0;
    const lengthSq = this.playerDamageNumberForwardDirection.lengthSq();
    if (lengthSq > 1e-8) {
      this.playerDamageNumberForwardDirection.multiplyScalar(
        1 / Math.sqrt(lengthSq),
      );
    } else {
      this.playerDamageNumberForwardDirection.set(
        -Math.sin(this.dependencies.camera.cameraYaw),
        -Math.cos(this.dependencies.camera.cameraYaw),
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

  alignPlayerDamageNumberToCamera(sprite: THREE.Sprite): void {
    sprite.quaternion.copy(this.dependencies.camera.camera.quaternion);
  }

  toCameraLocalOffset(
    worldPosition: THREE.Vector3,
    target: THREE.Vector3,
  ): THREE.Vector3 {
    this.playerDamageNumberCameraInverseQuaternion
      .copy(this.dependencies.camera.camera.quaternion)
      .invert();
    return target
      .copy(worldPosition)
      .sub(this.dependencies.camera.camera.position)
      .applyQuaternion(this.playerDamageNumberCameraInverseQuaternion);
  }

  fromCameraLocalOffset(
    cameraLocalOffset: THREE.Vector3,
    target: THREE.Vector3,
  ): THREE.Vector3 {
    return target
      .copy(cameraLocalOffset)
      .applyQuaternion(this.dependencies.camera.camera.quaternion)
      .add(this.dependencies.camera.camera.position);
  }

  disposePlayerDamageNumberParticle(index: number): void {
    if (index < 0 || index >= this.playerDamageNumberParticles.length) {
      return;
    }

    const [particle] = this.playerDamageNumberParticles.splice(index, 1);
    this.dependencies.renderPipeline.scene.remove(particle.sprite);

    const material = particle.sprite.material;
    if (material instanceof THREE.SpriteMaterial) {
      if (material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  }

  resolvePlayerDamageNumberAgainstWallTile(
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

  resolvePlayerDamageNumberWallCollision(
    particle: DamageNumberParticle,
  ): void {
    if (particle.sprite.position.z > WALL_HEIGHT + 0.22) {
      return;
    }

    const approxTileX = Math.round(particle.sprite.position.x / TILE_SIZE);
    const approxTileY = Math.round(-particle.sprite.position.y / TILE_SIZE);

    for (let x = approxTileX - 1; x <= approxTileX + 1; x += 1) {
      for (let y = approxTileY - 1; y <= approxTileY + 1; y += 1) {
        const wall = this.dependencies.tileRendering.tileMap.get(`${x},${y}`);
        if (!wall || !wall.userData?.isWall) {
          continue;
        }
        this.resolvePlayerDamageNumberAgainstWallTile(particle, x, y);
      }
    }
  }

  ensurePlayerUiNumberOverlay(): HTMLDivElement | null {
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

  syncPlayerUiNumberOverlayBounds(): DOMRect | null {
    const overlay = this.ensurePlayerUiNumberOverlay();
    if (!overlay || !this.dependencies.renderPipeline.renderer?.domElement?.isConnected) {
      return null;
    }

    const rect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
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

  disposePlayerUiNumberParticle(index: number): void {
    if (index < 0 || index >= this.playerUiNumberParticles.length) {
      return;
    }

    const [particle] = this.playerUiNumberParticles.splice(index, 1);
    particle.element.remove();
  }

  clearPlayerUiNumberParticles(): void {
    for (let i = this.playerUiNumberParticles.length - 1; i >= 0; i -= 1) {
      this.disposePlayerUiNumberParticle(i);
    }
  }

  projectPlayerUiNumberWorldAnchor(
    viewportRect: DOMRect,
    particle: Pick<
    PlayerUiNumberParticle,
    "fpsFloating"
    | "fpsLateralOffset"
    | "worldBaseHeightOffset"
  >,
  ): { screenX: number; screenY: number; isVisible: boolean } {
    this.playerUiNumberAnchor.set(
      this.dependencies.playerMovement.playerPos.x * TILE_SIZE,
      -this.dependencies.playerMovement.playerPos.y * TILE_SIZE,
      this.dependencies.bloodParticles.damageParticleFloorZ + particle.worldBaseHeightOffset,
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
      .project(this.dependencies.camera.getActiveCamera());
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

  updatePlayerUiNumberParticles(deltaSeconds: number): void {
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

  updatePlayerDamageNumberParticles(deltaSeconds: number): void {
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

      if (this.dependencies.movementInput.isFpsMode() && particle.fpsFloating) {
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
            this.dependencies.playerMovement.playerPos.x * TILE_SIZE,
            -this.dependencies.playerMovement.playerPos.y * TILE_SIZE,
            this.dependencies.bloodParticles.damageParticleFloorZ +
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
        particle.sprite.position.x = this.dependencies.playerMovement.playerPos.x * TILE_SIZE;
        particle.sprite.position.y = -this.dependencies.playerMovement.playerPos.y * TILE_SIZE;
        this.applyFpsForwardOffsetToPlayerNumberPosition(
          particle.sprite.position,
          false,
        );
      }
      this.alignPlayerDamageNumberToCamera(particle.sprite);

      if (particle.kind === "damage") {
        this.resolvePlayerDamageNumberWallCollision(particle);

        if (particle.sprite.position.z < this.dependencies.bloodParticles.damageParticleFloorZ) {
          particle.sprite.position.z = this.dependencies.bloodParticles.damageParticleFloorZ;
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

  clearPlayerDamageNumberParticles(): void {
    for (let i = this.playerDamageNumberParticles.length - 1; i >= 0; i -= 1) {
      this.disposePlayerDamageNumberParticle(i);
    }
  }

  updateDamageEffects(deltaSeconds: number): void {
    this.dependencies.damageFlashes.updateGlyphDamageFlashes(deltaSeconds);
    this.dependencies.damageFlashes.updateMonsterBillboardDamageFlashes(deltaSeconds);
    this.dependencies.damageFlashes.updateGlyphDamageShakes(deltaSeconds);
    this.dependencies.bloodParticles.updateDamageParticles(deltaSeconds);
    this.dependencies.bloodParticles.updateMonsterBillboardShardParticles(deltaSeconds);
    this.dependencies.bloodGround.syncBloodGroundTexture();
    this.updatePlayerDamageNumberParticles(deltaSeconds);
    this.updatePlayerUiNumberParticles(deltaSeconds);
    const now = Date.now();
    this.dependencies.combatAttribution.prunePendingCharacterDamage(now);
  }
}
