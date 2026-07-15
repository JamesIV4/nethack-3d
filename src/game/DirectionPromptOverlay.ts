import * as THREE from "three";
import { TILE_SIZE } from "./constants";

export type DirectionPromptOverlayButtonId =
  | "northwest"
  | "north"
  | "northeast"
  | "west"
  | "self"
  | "east"
  | "southwest"
  | "south"
  | "southeast"
  | "up"
  | "down";

type DirectionPromptOverlayButtonKind = "ground" | "billboard";
type DirectionPromptOverlayIconKind = "arrow" | "circle";
type DirectionPromptOverlayVisualState =
  | "normal"
  | "preview"
  | "hover"
  | "pressed";

type DirectionPromptOverlayDisplayMode = "full" | "single_preview";

type DirectionPromptOverlayTextures = Record<
  DirectionPromptOverlayIconKind,
  Record<DirectionPromptOverlayVisualState, THREE.CanvasTexture>
>;

type DirectionPromptOverlayButton = {
  id: DirectionPromptOverlayButtonId;
  aspectRoot: THREE.Group;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  kind: DirectionPromptOverlayButtonKind;
  icon: DirectionPromptOverlayIconKind;
  groundMapOffsetX: number;
  groundMapOffsetY: number;
  groundRotationZ: number;
  baseScaleTiles: number;
  billboardScreenRotationZ: number;
  billboardScreenOffsetY: number;
};

const directionPromptOverlayButtonIds: readonly DirectionPromptOverlayButtonId[] =
  [
    "northwest",
    "north",
    "northeast",
    "west",
    "self",
    "east",
    "southwest",
    "south",
    "southeast",
    "up",
    "down",
  ] as const;

const directionPromptOverlayGroundSpecs: ReadonlyArray<
  Readonly<{
    id: DirectionPromptOverlayButtonId;
    icon: DirectionPromptOverlayIconKind;
    mapDx: number;
    mapDy: number;
    scaleTiles: number;
  }>
> = [
  { id: "northwest", icon: "arrow", mapDx: -1, mapDy: -1, scaleTiles: 0.76 },
  { id: "north", icon: "arrow", mapDx: 0, mapDy: -1, scaleTiles: 0.76 },
  { id: "northeast", icon: "arrow", mapDx: 1, mapDy: -1, scaleTiles: 0.76 },
  { id: "west", icon: "arrow", mapDx: -1, mapDy: 0, scaleTiles: 0.76 },
  { id: "self", icon: "circle", mapDx: 0, mapDy: 0, scaleTiles: 0.84 },
  { id: "east", icon: "arrow", mapDx: 1, mapDy: 0, scaleTiles: 0.76 },
  { id: "southwest", icon: "arrow", mapDx: -1, mapDy: 1, scaleTiles: 0.76 },
  { id: "south", icon: "arrow", mapDx: 0, mapDy: 1, scaleTiles: 0.76 },
  { id: "southeast", icon: "arrow", mapDx: 1, mapDy: 1, scaleTiles: 0.76 },
];

const directionPromptOverlayBillboardSpecs: ReadonlyArray<
  Readonly<{
    id: DirectionPromptOverlayButtonId;
    icon: DirectionPromptOverlayIconKind;
    screenRotationZ: number;
    verticalOffset: number;
    scaleTiles: number;
  }>
> = [
  {
    id: "up",
    icon: "arrow",
    screenRotationZ: Math.PI / 2,
    verticalOffset: 0.42,
    scaleTiles: 0.68,
  },
  {
    id: "down",
    icon: "arrow",
    screenRotationZ: -Math.PI / 2,
    verticalOffset: -0.42,
    scaleTiles: 0.68,
  },
];

const directionPromptOverlayStateOpacity: Record<
  DirectionPromptOverlayVisualState,
  number
> = {
  normal: 0.5,
  preview: 0.64,
  hover: 0.8,
  pressed: 0.95,
};

const directionPromptOverlayStateScale: Record<
  DirectionPromptOverlayVisualState,
  number
> = {
  normal: 1,
  preview: 1.05,
  hover: 1.1,
  pressed: 1.16,
};

const directionPromptOverlayRenderOrder = 2000;
const directionPromptOverlayGroundZ = 0.028;
const directionPromptOverlayBillboardSideOffsetTiles = 2.18;
const directionPromptOverlayBillboardAnchorZ = 0.04;

function buildTintedSvgTexture(
  image: HTMLImageElement,
  options: {
    fillStyle: string;
    fillAlpha?: number;
    glowAlpha: number;
    glowBlurPx: number;
    paddingPx?: number;
    strokeWidthPx?: number;
  },
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Failed to create direction prompt overlay canvas");
  }

  const paddingPx = Math.max(0, options.paddingPx ?? 18);
  const drawWidth = size - paddingPx * 2;
  const drawHeight = size - paddingPx * 2;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = size;
  maskCanvas.height = size;
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!maskContext) {
    throw new Error("Failed to create direction prompt overlay mask");
  }

  maskContext.clearRect(0, 0, size, size);
  maskContext.drawImage(image, paddingPx, paddingPx, drawWidth, drawHeight);
  maskContext.globalCompositeOperation = "source-in";
  maskContext.fillStyle = options.fillStyle;
  maskContext.globalAlpha = THREE.MathUtils.clamp(
    options.fillAlpha ?? 1,
    0,
    1,
  );
  maskContext.fillRect(0, 0, size, size);
  maskContext.globalAlpha = 1;
  maskContext.globalCompositeOperation = "source-over";

  const strokeCanvas = document.createElement("canvas");
  strokeCanvas.width = size;
  strokeCanvas.height = size;
  const strokeContext = strokeCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!strokeContext) {
    throw new Error("Failed to create direction prompt overlay stroke");
  }

  const strokeWidthPx = Math.max(0, Math.round(options.strokeWidthPx ?? 15));
  if (strokeWidthPx > 0) {
    for (let offsetY = -strokeWidthPx; offsetY <= strokeWidthPx; offsetY += 1) {
      for (
        let offsetX = -strokeWidthPx;
        offsetX <= strokeWidthPx;
        offsetX += 1
      ) {
        if (offsetX === 0 && offsetY === 0) {
          continue;
        }
        if (Math.hypot(offsetX, offsetY) > strokeWidthPx + 0.2) {
          continue;
        }
        strokeContext.drawImage(
          image,
          paddingPx + offsetX,
          paddingPx + offsetY,
          drawWidth,
          drawHeight,
        );
      }
    }
    strokeContext.globalCompositeOperation = "source-in";
    strokeContext.fillStyle = "#ffffff";
    strokeContext.fillRect(0, 0, size, size);
    strokeContext.globalCompositeOperation = "destination-out";
    strokeContext.drawImage(image, paddingPx, paddingPx, drawWidth, drawHeight);
    strokeContext.globalCompositeOperation = "source-over";
  }

  context.clearRect(0, 0, size, size);
  if (strokeWidthPx > 0) {
    context.drawImage(strokeCanvas, 0, 0, size, size);
  }
  if (options.glowAlpha > 0 && options.glowBlurPx > 0) {
    context.save();
    context.globalAlpha = options.glowAlpha;
    context.shadowColor = "rgba(255, 223, 92, 0.98)";
    context.shadowBlur = options.glowBlurPx;
    context.drawImage(maskCanvas, 0, 0, size, size);
    context.restore();
  }
  context.drawImage(maskCanvas, 0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.generateMipmaps = false;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load direction prompt overlay asset: ${url}`));
    image.src = url;
  });
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = String(baseUrl || "").trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function buildDirectionPromptAssetUrlCandidates(assetFileName: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (url: string): void => {
    const normalized = String(url || "").trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  const baseUrl = normalizeBaseUrl(
    typeof import.meta.env.BASE_URL === "string"
      ? import.meta.env.BASE_URL
      : "/",
  );

  const maybeAddResolvedCandidate = (path: string): void => {
    try {
      addCandidate(new URL(path, window.location.href).href);
    } catch {
      // Skip malformed candidate URLs.
    }
  };

  maybeAddResolvedCandidate(`${baseUrl}assets/ui/${assetFileName}`);
  maybeAddResolvedCandidate(`./assets/ui/${assetFileName}`);
  maybeAddResolvedCandidate(`/assets/ui/${assetFileName}`);
  return candidates;
}

async function loadSvgImageFromCandidates(
  urlCandidates: readonly string[],
): Promise<HTMLImageElement> {
  if (!Array.isArray(urlCandidates) || urlCandidates.length < 1) {
    throw new Error("No direction prompt overlay asset URL candidates provided");
  }
  const errors: string[] = [];
  for (const url of urlCandidates) {
    try {
      return await loadSvgImage(url);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const attempted = urlCandidates.join(", ");
  const failureSummary = errors.join(" | ");
  throw new Error(
    `Failed to load direction prompt overlay asset after trying: ${attempted}. Errors: ${failureSummary}`,
  );
}

export class DirectionPromptOverlay {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly groundButtonGroup = new THREE.Group();
  private readonly billboardButtonGroup = new THREE.Group();
  private readonly buttons = new Map<
    DirectionPromptOverlayButtonId,
    DirectionPromptOverlayButton
  >();
  private readonly raycastTargets: THREE.Mesh[] = [];
  private readonly cameraRightScratch = new THREE.Vector3();
  private textures: DirectionPromptOverlayTextures | null = null;
  private textureLoadPromise: Promise<void> | null = null;
  private textureLoadFailureCount = 0;
  private textureReloadRetryTimerId: number | null = null;
  private readonly textureLoadMaxRetries = 6;
  private visible = false;
  private displayMode: DirectionPromptOverlayDisplayMode = "full";
  private worldVerticalAspectScale = 1;
  private hoveredButtonId: DirectionPromptOverlayButtonId | null = null;
  private pressedButtonId: DirectionPromptOverlayButtonId | null = null;
  private previewedButtonId: DirectionPromptOverlayButtonId | null = null;

  public constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.visible = false;
    this.root.renderOrder = directionPromptOverlayRenderOrder;
    this.root.add(this.groundButtonGroup);
    this.root.add(this.billboardButtonGroup);
    this.scene.add(this.root);
    void this.ensureTexturesLoaded();
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible && this.textures === null) {
      void this.ensureTexturesLoaded();
    }
    this.root.visible = visible && this.textures !== null;
    if (!visible) {
      this.hoveredButtonId = null;
      this.pressedButtonId = null;
      this.previewedButtonId = null;
      this.applyVisualState();
    }
  }

  public setDisplayMode(mode: DirectionPromptOverlayDisplayMode): void {
    const normalizedMode = mode === "single_preview" ? mode : "full";
    if (this.displayMode === normalizedMode) {
      return;
    }
    this.displayMode = normalizedMode;
    this.applyVisualState();
  }

  public setWorldVerticalAspectScale(scaleY: number): void {
    const normalizedScale =
      typeof scaleY === "number" && Number.isFinite(scaleY)
        ? THREE.MathUtils.clamp(scaleY, 0.1, 10)
        : 1;
    if (Math.abs(this.worldVerticalAspectScale - normalizedScale) < 0.0001) {
      return;
    }
    this.worldVerticalAspectScale = normalizedScale;
    for (const button of this.buttons.values()) {
      button.aspectRoot.scale.set(1, normalizedScale, 1);
    }
  }

  public setInteractionState(options: {
    hoveredButtonId: DirectionPromptOverlayButtonId | null;
    pressedButtonId: DirectionPromptOverlayButtonId | null;
    previewedButtonId?: DirectionPromptOverlayButtonId | null;
  }): void {
    this.hoveredButtonId = options.hoveredButtonId ?? null;
    this.pressedButtonId = options.pressedButtonId ?? null;
    this.previewedButtonId = options.previewedButtonId ?? null;
    this.applyVisualState();
  }

  public update(camera: THREE.Camera, playerX: number, playerY: number): void {
    if (this.visible && this.textures === null && this.textureLoadPromise === null) {
      void this.ensureTexturesLoaded();
    }
    if (!this.visible || this.textures === null) {
      this.root.visible = false;
      return;
    }

    this.root.visible = true;
    const baseX = playerX * TILE_SIZE;
    const baseY = -playerY * TILE_SIZE;

    for (const spec of directionPromptOverlayGroundSpecs) {
      const button = this.buttons.get(spec.id);
      if (!button) {
        continue;
      }
      button.aspectRoot.position.set(
        baseX + spec.mapDx * TILE_SIZE,
        baseY - spec.mapDy * TILE_SIZE,
        directionPromptOverlayGroundZ,
      );
      button.mesh.rotation.set(0, 0, Math.atan2(-spec.mapDy, spec.mapDx));
    }

    this.cameraRightScratch.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.cameraRightScratch.z = 0;
    if (this.cameraRightScratch.lengthSq() < 0.0001) {
      this.cameraRightScratch.set(1, 0, 0);
    } else {
      this.cameraRightScratch.normalize();
    }

    const anchorX =
      baseX +
      this.cameraRightScratch.x *
        TILE_SIZE *
        directionPromptOverlayBillboardSideOffsetTiles;
    const anchorY =
      baseY +
      this.cameraRightScratch.y *
        TILE_SIZE *
        directionPromptOverlayBillboardSideOffsetTiles;
    this.billboardButtonGroup.position.set(
      anchorX,
      anchorY,
      directionPromptOverlayBillboardAnchorZ,
    );
    this.billboardButtonGroup.quaternion.copy(camera.quaternion);

    for (const spec of directionPromptOverlayBillboardSpecs) {
      const button = this.buttons.get(spec.id);
      if (!button) {
        continue;
      }
      button.aspectRoot.position.set(0, button.billboardScreenOffsetY, 0);
      button.mesh.rotation.set(0, 0, button.billboardScreenRotationZ);
    }
  }

  public hitTest(
    ndcX: number,
    ndcY: number,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster,
  ): DirectionPromptOverlayButtonId | null {
    if (!this.visible || this.textures === null || this.raycastTargets.length < 1) {
      return null;
    }
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const intersections = raycaster.intersectObjects(this.raycastTargets, false);
    for (const intersection of intersections) {
      const buttonId = intersection.object.userData
        ?.directionPromptOverlayButtonId as DirectionPromptOverlayButtonId | undefined;
      if (buttonId && directionPromptOverlayButtonIds.includes(buttonId)) {
        return buttonId;
      }
    }
    return null;
  }

  public dispose(): void {
    this.clearTextureReloadRetry();
    this.root.removeFromParent();
    for (const button of this.buttons.values()) {
      button.mesh.geometry.dispose();
      button.mesh.material.dispose();
    }
    for (const iconTextures of Object.values(this.textures ?? {})) {
      for (const texture of Object.values(iconTextures)) {
        texture.dispose();
      }
    }
    this.buttons.clear();
    this.raycastTargets.length = 0;
    this.textures = null;
  }

  private async ensureTexturesLoaded(): Promise<void> {
    if (this.textures || this.textureLoadPromise) {
      return this.textureLoadPromise ?? Promise.resolve();
    }

    const arrowUrls = buildDirectionPromptAssetUrlCandidates("arrow.svg");
    const circleUrls = buildDirectionPromptAssetUrlCandidates("circle.svg");
    this.textureLoadPromise = Promise.all([
      loadSvgImageFromCandidates(arrowUrls),
      loadSvgImageFromCandidates(circleUrls),
    ])
      .then(([arrowImage, circleImage]) => {
        this.textureLoadFailureCount = 0;
        this.clearTextureReloadRetry();
        this.textures = {
          arrow: {
            normal: buildTintedSvgTexture(arrowImage, {
              fillStyle: "#ffd83d",
              fillAlpha: directionPromptOverlayStateOpacity.normal,
              glowAlpha: 0,
              glowBlurPx: 0,
            }),
            preview: buildTintedSvgTexture(arrowImage, {
              fillStyle: "#ffe255",
              fillAlpha: directionPromptOverlayStateOpacity.preview,
              glowAlpha: 0.2,
              glowBlurPx: 14,
            }),
            hover: buildTintedSvgTexture(arrowImage, {
              fillStyle: "#ffeb73",
              fillAlpha: directionPromptOverlayStateOpacity.hover,
              glowAlpha: 0.34,
              glowBlurPx: 20,
            }),
            pressed: buildTintedSvgTexture(arrowImage, {
              fillStyle: "#fff1a0",
              fillAlpha: directionPromptOverlayStateOpacity.pressed,
              glowAlpha: 0.48,
              glowBlurPx: 28,
            }),
          },
          circle: {
            normal: buildTintedSvgTexture(circleImage, {
              fillStyle: "#ffd83d",
              fillAlpha: directionPromptOverlayStateOpacity.normal,
              glowAlpha: 0.08,
              glowBlurPx: 12,
              paddingPx: 24,
            }),
            preview: buildTintedSvgTexture(circleImage, {
              fillStyle: "#ffe255",
              fillAlpha: directionPromptOverlayStateOpacity.preview,
              glowAlpha: 0.18,
              glowBlurPx: 16,
              paddingPx: 24,
            }),
            hover: buildTintedSvgTexture(circleImage, {
              fillStyle: "#ffeb73",
              fillAlpha: directionPromptOverlayStateOpacity.hover,
              glowAlpha: 0.3,
              glowBlurPx: 22,
              paddingPx: 24,
            }),
            pressed: buildTintedSvgTexture(circleImage, {
              fillStyle: "#fff1a0",
              fillAlpha: directionPromptOverlayStateOpacity.pressed,
              glowAlpha: 0.44,
              glowBlurPx: 28,
              paddingPx: 24,
            }),
          },
        };
        this.ensureButtons();
        this.applyVisualState();
        this.root.visible = this.visible;
      })
      .catch((error) => {
        this.textureLoadFailureCount += 1;
        console.warn(error);
      })
      .finally(() => {
        this.textureLoadPromise = null;
        if (
          this.visible &&
          this.textures === null &&
          this.textureLoadFailureCount < this.textureLoadMaxRetries
        ) {
          this.scheduleTextureReloadRetry();
        }
      });

    return this.textureLoadPromise;
  }

  private clearTextureReloadRetry(): void {
    if (
      this.textureReloadRetryTimerId !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(this.textureReloadRetryTimerId);
    }
    this.textureReloadRetryTimerId = null;
  }

  private scheduleTextureReloadRetry(): void {
    if (typeof window === "undefined") {
      return;
    }
    if (this.textureReloadRetryTimerId !== null || this.textures !== null) {
      return;
    }
    const attempt = Math.max(1, this.textureLoadFailureCount);
    const delayMs = Math.min(2000, 220 * 2 ** (attempt - 1));
    this.textureReloadRetryTimerId = window.setTimeout(() => {
      this.textureReloadRetryTimerId = null;
      void this.ensureTexturesLoaded();
    }, delayMs);
  }

  private ensureButtons(): void {
    if (this.textures === null || this.buttons.size > 0) {
      return;
    }

    const createMaterial = (
      icon: DirectionPromptOverlayIconKind,
    ): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({
        map: this.textures![icon].normal,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        alphaTest: 0.02,
      });

    for (const spec of directionPromptOverlayGroundSpecs) {
      const geometry = new THREE.PlaneGeometry(
        TILE_SIZE * spec.scaleTiles,
        TILE_SIZE * spec.scaleTiles,
      );
      const material = createMaterial(spec.icon);
      const mesh = new THREE.Mesh(geometry, material);
      const aspectRoot = new THREE.Group();
      aspectRoot.scale.set(1, this.worldVerticalAspectScale, 1);
      aspectRoot.add(mesh);
      mesh.renderOrder = directionPromptOverlayRenderOrder;
      mesh.userData.directionPromptOverlayButtonId = spec.id;
      this.groundButtonGroup.add(aspectRoot);
      this.buttons.set(spec.id, {
        id: spec.id,
        aspectRoot,
        mesh,
        kind: "ground",
        icon: spec.icon,
        groundMapOffsetX: spec.mapDx,
        groundMapOffsetY: spec.mapDy,
        groundRotationZ: Math.atan2(-spec.mapDy, spec.mapDx),
        baseScaleTiles: spec.scaleTiles,
        billboardScreenRotationZ: 0,
        billboardScreenOffsetY: 0,
      });
      this.raycastTargets.push(mesh);
    }

    for (const spec of directionPromptOverlayBillboardSpecs) {
      const geometry = new THREE.PlaneGeometry(
        TILE_SIZE * spec.scaleTiles,
        TILE_SIZE * spec.scaleTiles,
      );
      const material = createMaterial(spec.icon);
      const mesh = new THREE.Mesh(geometry, material);
      const aspectRoot = new THREE.Group();
      aspectRoot.scale.set(1, this.worldVerticalAspectScale, 1);
      aspectRoot.add(mesh);
      mesh.renderOrder = directionPromptOverlayRenderOrder;
      mesh.userData.directionPromptOverlayButtonId = spec.id;
      this.billboardButtonGroup.add(aspectRoot);
      this.buttons.set(spec.id, {
        id: spec.id,
        aspectRoot,
        mesh,
        kind: "billboard",
        icon: spec.icon,
        groundMapOffsetX: 0,
        groundMapOffsetY: 0,
        groundRotationZ: 0,
        baseScaleTiles: spec.scaleTiles,
        billboardScreenRotationZ: spec.screenRotationZ,
        billboardScreenOffsetY: spec.verticalOffset,
      });
      this.raycastTargets.push(mesh);
    }
  }

  private applyVisualState(): void {
    if (this.textures === null) {
      return;
    }

    for (const button of this.buttons.values()) {
      let visualState: DirectionPromptOverlayVisualState = "normal";
      if (button.id === this.previewedButtonId) {
        visualState = "preview";
      }
      if (button.id === this.hoveredButtonId) {
        visualState = "hover";
      }
      if (button.id === this.pressedButtonId) {
        visualState = "pressed";
      }

      button.mesh.material.map = this.textures[button.icon][visualState];
      button.mesh.material.opacity = 1;
      const scaleFactor = directionPromptOverlayStateScale[visualState];
      button.mesh.scale.set(scaleFactor, scaleFactor, 1);
      const showSinglePreviewOnly = this.displayMode === "single_preview";
      button.mesh.visible =
        this.visible &&
        (!showSinglePreviewOnly || button.id === this.previewedButtonId);
      button.mesh.material.needsUpdate = true;
    }
  }
}

export default DirectionPromptOverlay;
