import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import { resolveNh3dBloodDetailPixelsPerTile } from "../../ui-types";
import type {
  BillboardShardParticle,
  BloodGroundCacheSnapshot,
  BloodGroundDirtyRect,
  BloodGroundPatternLayer,
  BloodGroundPatternParams,
  BloodGroundImpactParams
} from "../shared/types";
import { MINIMAP_WIDTH_TILES, MINIMAP_HEIGHT_TILES } from "../shared/constants";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { EngineState } from "../runtime/engine-state";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { Lighting } from "../rendering/lighting";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";

export interface BloodGroundDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "getNativeCapacitorPlatform"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "levelTerrainCachesByName"
    | "pendingLevelCacheTransition"
  >;
  readonly lighting: Pick<
    Lighting,
    "patchMaterialForVignette"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveTextureAnisotropyLevel"
  >;
}

/** Ground blood rasterization, pixel buffers, texture upload and per-level snapshots */
export class BloodGround {
  constructor(private readonly dependencies: BloodGroundDependencies) {}

  bloodGroundOverlayMesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  > | null = null;

  bloodGroundOverlayMaterial: THREE.MeshBasicMaterial | null = null;

  bloodGroundOverlayTexture: THREE.Texture | null = null;

  bloodGroundPixelData: Uint8Array | Uint8ClampedArray | null = null;

  bloodGroundPixelData32: Uint32Array | null = null;

  bloodGroundDensity: Uint16Array | null = null;

  bloodGroundDirtyRect: BloodGroundDirtyRect | null = null;

  bloodGroundDirtyRowMin: Int32Array | null = null;

  bloodGroundDirtyRowMax: Int32Array | null = null;

  bloodGroundDirtyRowRangeStart: number = 0;

  bloodGroundDirtyRowRangeEnd: number = -1;

  bloodGroundHasVisibleData: boolean = false;

  bloodGroundTextureRequiresFullUpload: boolean = false;

  bloodGroundCompatibilityMode: boolean = false;

  bloodGroundUploadCanvas: HTMLCanvasElement | null = null;

  bloodGroundUploadContext: CanvasRenderingContext2D | null = null;

  bloodGroundUploadImageData: ImageData | null = null;

  bloodGroundColorLut: Uint32Array | null = null;

  bloodGroundNoiseAtlasA: Float32Array | null = null;

  bloodGroundNoiseAtlasB: Float32Array | null = null;

  bloodGroundNoiseAtlasC: Float32Array | null = null;

  readonly bloodGroundFeatherLutCache: Map<number, Float32Array> =
    new Map();

  readonly bloodGroundReferenceFrameSeconds: number = 1 / 60;

  readonly bloodGroundDirectionScratch = new THREE.Vector2();

  readonly bloodGroundPerpendicularScratch = new THREE.Vector2();

  readonly bloodGroundOverlayZ: number = 0.012;

  readonly bloodGroundCacheVersion: number = 4;

  readonly bloodGroundMaxDensity: number = 2048;

  readonly bloodGroundTexturePartialUploadAreaRatio: number = 0.34;

  readonly bloodGroundTrailSegmentSpacingPx: number = 3.5;

  readonly bloodGroundSpecularPixelsPerTile: number = 128;

  readonly bloodGroundSpecularReferenceStrength: number = 2.5;

  readonly bloodGroundNoiseAtlasSize: number = 256;

  readonly bloodGroundNoiseAtlasMask: number =
    this.bloodGroundNoiseAtlasSize - 1;

  readonly bloodGroundNoiseAtlasShift: number = 8;

  readonly bloodGroundColorLutIsLittleEndian: boolean = (() => {
    const buffer = new Uint32Array([0x11223344]).buffer;
    return new Uint8Array(buffer)[0] === 0x44;
  })();

  readonly bloodGroundPlaneGeometry = new THREE.PlaneGeometry(
    MINIMAP_WIDTH_TILES * TILE_SIZE,
    MINIMAP_HEIGHT_TILES * TILE_SIZE,
  );

  get bloodGroundPixelsPerTile(): number {
    return resolveNh3dBloodDetailPixelsPerTile(this.dependencies.engineState.clientOptions.bloodDetail);
  }

  get bloodGroundWidthPx(): number {
    return MINIMAP_WIDTH_TILES * this.bloodGroundPixelsPerTile;
  }

  get bloodGroundHeightPx(): number {
    return MINIMAP_HEIGHT_TILES * this.bloodGroundPixelsPerTile;
  }

  get bloodGroundPixelsPerWorldUnit(): number {
    return this.bloodGroundPixelsPerTile / TILE_SIZE;
  }

  get bloodGroundWorldToPixelX(): number {
    return (this.bloodGroundWidthPx - 1) / (MINIMAP_WIDTH_TILES * TILE_SIZE);
  }

  get bloodGroundWorldToPixelY(): number {
    return (this.bloodGroundHeightPx - 1) / (MINIMAP_HEIGHT_TILES * TILE_SIZE);
  }

  cloneBloodGroundCacheSnapshot(
    source: BloodGroundCacheSnapshot | null,
  ): BloodGroundCacheSnapshot | null {
    const width = this.bloodGroundWidthPx;
    const height = this.bloodGroundHeightPx;
    if (
      !source ||
      source.version !== this.bloodGroundCacheVersion ||
      source.width !== width ||
      source.height !== height ||
      !(source.density instanceof Uint16Array) ||
      source.density.length !== width * height
    ) {
      return null;
    }

    return {
      version: source.version,
      width: source.width,
      height: source.height,
      density: new Uint16Array(source.density),
    };
  }

  updateBloodGroundOverlayVisibility(): void {
    if (!this.bloodGroundOverlayMesh) {
      return;
    }

    this.bloodGroundOverlayMesh.visible =
      this.dependencies.engineState.clientOptions.bloodGround &&
      this.bloodGroundHasVisibleData &&
      !this.dependencies.terminalRendering.isTerminalDisplayMode();
  }

  clearAllCachedBloodGroundSnapshots(): void {
    for (const entries of this.dependencies.levelTerrainCache.levelTerrainCachesByName.values()) {
      for (const entry of entries) {
        entry.bloodGround = null;
      }
    }
  }

  packBloodGroundRgba(
    r: number,
    g: number,
    b: number,
    a: number,
  ): number {
    if (this.bloodGroundColorLutIsLittleEndian) {
      return (
        ((r & 0xff) |
          ((g & 0xff) << 8) |
          ((b & 0xff) << 16) |
          ((a & 0xff) << 24)) >>>
        0
      );
    }

    return (
      (((a & 0xff) << 24) |
        ((b & 0xff) << 16) |
        ((g & 0xff) << 8) |
        (r & 0xff)) >>>
      0
    );
  }

  ensureBloodGroundLookupTables(): void {
    if (!this.bloodGroundColorLut) {
      const lightColor = new THREE.Color(this.dependencies.engineState.clientOptions.bloodColorLightHex);
      const darkColor = new THREE.Color(this.dependencies.engineState.clientOptions.bloodColorDarkHex);
      const lightR = Math.round(lightColor.r * 255);
      const lightG = Math.round(lightColor.g * 255);
      const lightB = Math.round(lightColor.b * 255);
      const darkR = Math.round(darkColor.r * 255);
      const darkG = Math.round(darkColor.g * 255);
      const darkB = Math.round(darkColor.b * 255);
      const lut = new Uint32Array(this.bloodGroundMaxDensity + 1);
      for (
        let density = 0;
        density <= this.bloodGroundMaxDensity;
        density += 1
      ) {
        if (density === 0) {
          lut[density] = 0;
          continue;
        }

        const normalizedDensity = THREE.MathUtils.clamp(
          (density * this.dependencies.engineState.clientOptions.bloodStrength) /
            this.bloodGroundMaxDensity,
          0,
          1,
        );
        const smoothDarken = THREE.MathUtils.smoothstep(
          normalizedDensity,
          0.22,
          0.99,
        );
        const darkenT = smoothDarken * 0.84;
        const r = Math.round(THREE.MathUtils.lerp(lightR, darkR, darkenT));
        const g = Math.round(THREE.MathUtils.lerp(lightG, darkG, darkenT));
        const b = Math.round(THREE.MathUtils.lerp(lightB, darkB, darkenT));
        const a = Math.round(
          255 *
            THREE.MathUtils.clamp(
              Math.pow(normalizedDensity, 0.76) * 0.94,
              0,
              1,
            ),
        );
        lut[density] = this.packBloodGroundRgba(r, g, b, a);
      }
      this.bloodGroundColorLut = lut;
    }

    if (
      this.bloodGroundNoiseAtlasA &&
      this.bloodGroundNoiseAtlasB &&
      this.bloodGroundNoiseAtlasC
    ) {
      return;
    }

    const atlasLength =
      this.bloodGroundNoiseAtlasSize * this.bloodGroundNoiseAtlasSize;
    const buildNoiseAtlas = (seed: number): Float32Array => {
      const atlas = new Float32Array(atlasLength);
      for (let y = 0; y < this.bloodGroundNoiseAtlasSize; y += 1) {
        const rowOffset = y << this.bloodGroundNoiseAtlasShift;
        for (let x = 0; x < this.bloodGroundNoiseAtlasSize; x += 1) {
          atlas[rowOffset + x] = this.sampleBloodGroundNoise(x, y, seed);
        }
      }
      return atlas;
    };

    this.bloodGroundNoiseAtlasA = buildNoiseAtlas(0x2f6e2b1);
    this.bloodGroundNoiseAtlasB = buildNoiseAtlas(0x51a9d17);
    this.bloodGroundNoiseAtlasC = buildNoiseAtlas(0x7c4f39d);
  }

  getBloodGroundFeatherLut(power: number): Float32Array {
    const lutKey = Math.max(1, Math.round(power * 48));
    const cached = this.bloodGroundFeatherLutCache.get(lutKey);
    if (cached) {
      return cached;
    }

    const actualPower = lutKey / 48;
    const lut = new Float32Array(257);
    for (let i = 0; i < lut.length; i += 1) {
      lut[i] = Math.pow(i / 256, actualPower);
    }
    this.bloodGroundFeatherLutCache.set(lutKey, lut);
    return lut;
  }

  resetBloodGroundDirtyRowTracking(): void {
    this.bloodGroundDirtyRowMin?.fill(this.bloodGroundWidthPx);
    this.bloodGroundDirtyRowMax?.fill(-1);
    this.bloodGroundDirtyRowRangeStart = this.bloodGroundHeightPx;
    this.bloodGroundDirtyRowRangeEnd = -1;
  }

  ensureBloodGroundOverlayResources(): boolean {
    // One persistent level-sized plane, with density accumulated into a CPU-side
    // buffer and only changed pixel rows pushed back to the GPU.
    if (
      this.bloodGroundOverlayMesh &&
      this.bloodGroundOverlayMaterial &&
      this.bloodGroundOverlayTexture &&
      this.bloodGroundPixelData &&
      this.bloodGroundPixelData32 &&
      this.bloodGroundDensity
    ) {
      this.updateBloodGroundOverlayVisibility();
      return true;
    }

    this.ensureBloodGroundLookupTables();
    const width = this.bloodGroundWidthPx;
    const height = this.bloodGroundHeightPx;
    const useCompatibilityMode = this.shouldUseBloodGroundCompatibilityMode();
    this.bloodGroundCompatibilityMode = useCompatibilityMode;

    let pixelData: Uint8Array | Uint8ClampedArray;
    let texture: THREE.Texture;
    let uploadCanvas: HTMLCanvasElement | null = null;
    let uploadContext: CanvasRenderingContext2D | null = null;
    let uploadImageData: ImageData | null = null;
    // Evaluate specular as a shader-side pass on a fixed high-detail grid so
    // the highlight quality does not inherit lower blood-mask resolutions.
    const specularEffectWidth =
      MINIMAP_WIDTH_TILES * this.bloodGroundSpecularPixelsPerTile;
    const specularEffectHeight =
      MINIMAP_HEIGHT_TILES * this.bloodGroundSpecularPixelsPerTile;
    if (useCompatibilityMode && typeof document !== "undefined") {
      uploadCanvas = document.createElement("canvas");
      uploadCanvas.width = width;
      uploadCanvas.height = height;
      uploadContext = uploadCanvas.getContext("2d");
      if (uploadContext) {
        uploadImageData = uploadContext.createImageData(width, height);
        pixelData = uploadImageData.data;
        texture = new THREE.CanvasTexture(uploadCanvas);
      } else {
        pixelData = new Uint8Array(width * height * 4);
        texture = new THREE.DataTexture(
          pixelData,
          width,
          height,
          THREE.RGBAFormat,
          THREE.UnsignedByteType,
        );
      }
    } else {
      pixelData = new Uint8Array(width * height * 4);
      texture = new THREE.DataTexture(
        pixelData,
        width,
        height,
        THREE.RGBAFormat,
        THREE.UnsignedByteType,
      );
    }
    texture.generateMipmaps = false;
    texture.minFilter = useCompatibilityMode
      ? THREE.NearestFilter
      : THREE.LinearFilter;
    texture.magFilter = useCompatibilityMode
      ? THREE.NearestFilter
      : THREE.LinearFilter;
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = useCompatibilityMode
      ? 1
      : Math.max(1, Math.min(2, this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel()));
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    material.alphaTest = useCompatibilityMode ? 4 / 255 : 0.001;
    material.forceSinglePass = true;
    if (useCompatibilityMode) {
      this.dependencies.lighting.patchMaterialForVignette(material, {
        bloodGroundDiscardEmptyTexels: true,
      });
    } else {
      this.dependencies.lighting.patchMaterialForVignette(material, {
        bloodGroundDiscardEmptyTexels: true,
        bloodGroundSpecularEffectTexelSize: new THREE.Vector2(
          1 / specularEffectWidth,
          1 / specularEffectHeight,
        ),
      });
    }

    const mesh = new THREE.Mesh(this.bloodGroundPlaneGeometry, material);
    mesh.position.set(
      ((MINIMAP_WIDTH_TILES - 1) * TILE_SIZE) / 2,
      -((MINIMAP_HEIGHT_TILES - 1) * TILE_SIZE) / 2,
      this.bloodGroundOverlayZ,
    );
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 111;
    mesh.visible = false;
    this.dependencies.renderPipeline.scene.add(mesh);

    this.bloodGroundOverlayMesh = mesh;
    this.bloodGroundOverlayMaterial = material;
    this.bloodGroundOverlayTexture = texture;
    this.bloodGroundPixelData = pixelData;
    this.bloodGroundPixelData32 = new Uint32Array(
      pixelData.buffer,
      pixelData.byteOffset,
      pixelData.byteLength / 4,
    );
    this.bloodGroundUploadCanvas = uploadCanvas;
    this.bloodGroundUploadContext = uploadContext;
    this.bloodGroundUploadImageData = uploadImageData;
    this.bloodGroundDensity = new Uint16Array(width * height);
    this.bloodGroundDirtyRowMin = new Int32Array(height);
    this.bloodGroundDirtyRowMax = new Int32Array(height);
    this.bloodGroundDirtyRect = null;
    this.resetBloodGroundDirtyRowTracking();
    this.bloodGroundHasVisibleData = false;
    this.bloodGroundTextureRequiresFullUpload = true;
    this.updateBloodGroundOverlayVisibility();
    return true;
  }

  flushBloodGroundCompatibilityTexture(): void {
    if (
      !this.bloodGroundCompatibilityMode ||
      !this.bloodGroundUploadContext ||
      !this.bloodGroundUploadImageData
    ) {
      return;
    }

    this.bloodGroundUploadContext.putImageData(
      this.bloodGroundUploadImageData,
      0,
      0,
    );
  }

  clearActiveBloodGroundCanvas(): void {
    this.bloodGroundDirtyRect = null;
    this.resetBloodGroundDirtyRowTracking();
    this.bloodGroundHasVisibleData = false;
    this.bloodGroundTextureRequiresFullUpload = true;

    if (this.bloodGroundDensity) {
      this.bloodGroundDensity.fill(0);
    }
    if (this.bloodGroundPixelData) {
      this.bloodGroundPixelData.fill(0);
    }
    if (this.bloodGroundOverlayTexture) {
      this.flushBloodGroundCompatibilityTexture();
      this.bloodGroundOverlayTexture.clearUpdateRanges();
      this.bloodGroundOverlayTexture.needsUpdate = true;
    }

    this.updateBloodGroundOverlayVisibility();
  }

  disposeBloodGroundOverlayResources(): void {
    if (this.bloodGroundOverlayMesh) {
      this.dependencies.renderPipeline.scene.remove(this.bloodGroundOverlayMesh);
    }
    this.bloodGroundOverlayMaterial?.dispose();
    this.bloodGroundOverlayTexture?.dispose();
    this.bloodGroundOverlayMesh = null;
    this.bloodGroundOverlayMaterial = null;
    this.bloodGroundOverlayTexture = null;
    this.bloodGroundPixelData = null;
    this.bloodGroundPixelData32 = null;
    this.bloodGroundUploadCanvas = null;
    this.bloodGroundUploadContext = null;
    this.bloodGroundUploadImageData = null;
    this.bloodGroundDensity = null;
    this.bloodGroundDirtyRect = null;
    this.bloodGroundDirtyRowMin = null;
    this.bloodGroundDirtyRowMax = null;
    this.bloodGroundDirtyRowRangeStart = this.bloodGroundHeightPx;
    this.bloodGroundDirtyRowRangeEnd = -1;
    this.bloodGroundHasVisibleData = false;
    this.bloodGroundTextureRequiresFullUpload = false;
    this.bloodGroundCompatibilityMode = false;
  }

  captureActiveBloodGroundCacheSnapshot(): BloodGroundCacheSnapshot | null {
    if (!this.bloodGroundDensity || !this.bloodGroundHasVisibleData) {
      return null;
    }

    return {
      version: this.bloodGroundCacheVersion,
      width: this.bloodGroundWidthPx,
      height: this.bloodGroundHeightPx,
      density: new Uint16Array(this.bloodGroundDensity),
    };
  }

  restoreBloodGroundCacheSnapshot(
    snapshot: BloodGroundCacheSnapshot | null,
  ): void {
    if (!snapshot) {
      this.clearActiveBloodGroundCanvas();
      return;
    }
    const width = this.bloodGroundWidthPx;
    const height = this.bloodGroundHeightPx;
    if (
      snapshot.version !== this.bloodGroundCacheVersion ||
      snapshot.width !== width ||
      snapshot.height !== height ||
      !(snapshot.density instanceof Uint16Array) ||
      snapshot.density.length !== width * height
    ) {
      this.clearActiveBloodGroundCanvas();
      return;
    }
    if (!this.ensureBloodGroundOverlayResources() || !this.bloodGroundDensity) {
      return;
    }

    this.bloodGroundDensity.set(snapshot.density);
    this.bloodGroundHasVisibleData = true;
    this.bloodGroundDirtyRect = {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
    };
    this.syncBloodGroundTexture(true);
  }

  refreshActiveBloodGroundVisuals(): void {
    if (!this.bloodGroundDensity || !this.bloodGroundHasVisibleData) {
      this.updateBloodGroundOverlayVisibility();
      return;
    }

    const width = this.bloodGroundWidthPx;
    const height = this.bloodGroundHeightPx;
    this.ensureBloodGroundLookupTables();
    this.bloodGroundDirtyRect = {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
    };
    this.bloodGroundTextureRequiresFullUpload = true;
    this.syncBloodGroundTexture(true);
  }

  markBloodGroundDirtyRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void {
    const width = this.bloodGroundWidthPx;
    const height = this.bloodGroundHeightPx;
    const clampedMinX = THREE.MathUtils.clamp(Math.floor(minX), 0, width - 1);
    const clampedMinY = THREE.MathUtils.clamp(Math.floor(minY), 0, height - 1);
    const clampedMaxX = THREE.MathUtils.clamp(Math.ceil(maxX), 0, width - 1);
    const clampedMaxY = THREE.MathUtils.clamp(Math.ceil(maxY), 0, height - 1);
    if (clampedMinX > clampedMaxX || clampedMinY > clampedMaxY) {
      return;
    }

    if (!this.bloodGroundDirtyRect) {
      this.bloodGroundDirtyRect = {
        minX: clampedMinX,
        minY: clampedMinY,
        maxX: clampedMaxX,
        maxY: clampedMaxY,
      };
      if (this.bloodGroundDirtyRowMin && this.bloodGroundDirtyRowMax) {
        for (let y = clampedMinY; y <= clampedMaxY; y += 1) {
          this.bloodGroundDirtyRowMin[y] = Math.min(
            this.bloodGroundDirtyRowMin[y],
            clampedMinX,
          );
          this.bloodGroundDirtyRowMax[y] = Math.max(
            this.bloodGroundDirtyRowMax[y],
            clampedMaxX,
          );
        }
        this.bloodGroundDirtyRowRangeStart = Math.min(
          this.bloodGroundDirtyRowRangeStart,
          clampedMinY,
        );
        this.bloodGroundDirtyRowRangeEnd = Math.max(
          this.bloodGroundDirtyRowRangeEnd,
          clampedMaxY,
        );
      }
      return;
    }

    this.bloodGroundDirtyRect.minX = Math.min(
      this.bloodGroundDirtyRect.minX,
      clampedMinX,
    );
    this.bloodGroundDirtyRect.minY = Math.min(
      this.bloodGroundDirtyRect.minY,
      clampedMinY,
    );
    this.bloodGroundDirtyRect.maxX = Math.max(
      this.bloodGroundDirtyRect.maxX,
      clampedMaxX,
    );
    this.bloodGroundDirtyRect.maxY = Math.max(
      this.bloodGroundDirtyRect.maxY,
      clampedMaxY,
    );

    if (this.bloodGroundDirtyRowMin && this.bloodGroundDirtyRowMax) {
      for (let y = clampedMinY; y <= clampedMaxY; y += 1) {
        this.bloodGroundDirtyRowMin[y] = Math.min(
          this.bloodGroundDirtyRowMin[y],
          clampedMinX,
        );
        this.bloodGroundDirtyRowMax[y] = Math.max(
          this.bloodGroundDirtyRowMax[y],
          clampedMaxX,
        );
      }
      this.bloodGroundDirtyRowRangeStart = Math.min(
        this.bloodGroundDirtyRowRangeStart,
        clampedMinY,
      );
      this.bloodGroundDirtyRowRangeEnd = Math.max(
        this.bloodGroundDirtyRowRangeEnd,
        clampedMaxY,
      );
    }
  }

  sampleBloodGroundNoise(px: number, py: number, seed: number): number {
    let value =
      Math.imul(px + 1, 374761393) ^
      Math.imul(py + 1, 668265263) ^
      Math.imul(seed + 1, 2246822519);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967295;
  }

  syncBloodGroundTexture(forceFull: boolean = false): void {
    if (
      !this.bloodGroundPixelData32 ||
      !this.bloodGroundDensity ||
      !this.bloodGroundOverlayTexture ||
      !this.bloodGroundColorLut
    ) {
      return;
    }

    const width = this.bloodGroundWidthPx;
    const height = this.bloodGroundHeightPx;
    const requiresFullUpload =
      forceFull || this.bloodGroundTextureRequiresFullUpload;
    const dirtyRect = requiresFullUpload
      ? {
          minX: 0,
          minY: 0,
          maxX: width - 1,
          maxY: height - 1,
        }
      : this.bloodGroundDirtyRect;
    if (!dirtyRect) {
      this.updateBloodGroundOverlayVisibility();
      return;
    }

    const dirtyWidth = dirtyRect.maxX - dirtyRect.minX + 1;
    const dirtyHeight = dirtyRect.maxY - dirtyRect.minY + 1;
    const rowDirtyMin = this.bloodGroundDirtyRowMin;
    const rowDirtyMax = this.bloodGroundDirtyRowMax;
    const hasRowDirtyTracking =
      !requiresFullUpload &&
      rowDirtyMin !== null &&
      rowDirtyMax !== null &&
      this.bloodGroundDirtyRowRangeEnd >= this.bloodGroundDirtyRowRangeStart;
    let dirtyArea = dirtyWidth * dirtyHeight;
    if (hasRowDirtyTracking) {
      dirtyArea = 0;
      for (
        let y = this.bloodGroundDirtyRowRangeStart;
        y <= this.bloodGroundDirtyRowRangeEnd;
        y += 1
      ) {
        const rowMin = rowDirtyMin[y];
        const rowMax = rowDirtyMax[y];
        if (rowMax >= rowMin) {
          dirtyArea += rowMax - rowMin + 1;
        }
      }
    }
    const fullArea = width * height;
    const usePartialUpload =
      !this.bloodGroundCompatibilityMode &&
      !requiresFullUpload &&
      dirtyArea / fullArea <= this.bloodGroundTexturePartialUploadAreaRatio;
    const pixelData32 = this.bloodGroundPixelData32;
    const density = this.bloodGroundDensity;
    const colorLut = this.bloodGroundColorLut;
    const texture = this.bloodGroundOverlayTexture;

    texture.clearUpdateRanges();
    if (hasRowDirtyTracking) {
      for (
        let y = this.bloodGroundDirtyRowRangeStart;
        y <= this.bloodGroundDirtyRowRangeEnd;
        y += 1
      ) {
        const minRowX = rowDirtyMin[y];
        const maxRowX = rowDirtyMax[y];
        if (maxRowX < minRowX) {
          continue;
        }

        const rowOffset = y * width;
        for (let x = minRowX; x <= maxRowX; x += 1) {
          const pixelIndex = rowOffset + x;
          pixelData32[pixelIndex] = colorLut[density[pixelIndex]];
        }

        if (usePartialUpload) {
          texture.addUpdateRange(
            (rowOffset + minRowX) * 4,
            (maxRowX - minRowX + 1) * 4,
          );
        }

        rowDirtyMin[y] = width;
        rowDirtyMax[y] = -1;
      }
      this.bloodGroundDirtyRowRangeStart = height;
      this.bloodGroundDirtyRowRangeEnd = -1;
    } else {
      for (let y = dirtyRect.minY; y <= dirtyRect.maxY; y += 1) {
        const rowOffset = y * width;
        for (let x = dirtyRect.minX; x <= dirtyRect.maxX; x += 1) {
          const pixelIndex = rowOffset + x;
          pixelData32[pixelIndex] = colorLut[density[pixelIndex]];
        }

        if (usePartialUpload) {
          texture.addUpdateRange(
            (rowOffset + dirtyRect.minX) * 4,
            dirtyWidth * 4,
          );
        }
      }
    }

    if (requiresFullUpload) {
      this.resetBloodGroundDirtyRowTracking();
    }
    this.bloodGroundTextureRequiresFullUpload = false;
    this.flushBloodGroundCompatibilityTexture();
    texture.needsUpdate = true;
    this.bloodGroundDirtyRect = null;
    this.updateBloodGroundOverlayVisibility();
  }

  rasterizeBloodGroundEllipse(
    worldX: number,
    worldY: number,
    radiusWorldX: number,
    radiusWorldY: number,
    angleRadians: number,
    densityAmount: number,
    featherPower: number,
    seed: number,
    pattern: BloodGroundPatternParams | null = null,
  ): void {
    const densityBuffer = this.bloodGroundDensity;
    const noiseAtlasA = this.bloodGroundNoiseAtlasA;
    const noiseAtlasB = this.bloodGroundNoiseAtlasB;
    const noiseAtlasC = this.bloodGroundNoiseAtlasC;
    if (!densityBuffer || !noiseAtlasA || !noiseAtlasB || !noiseAtlasC) {
      return;
    }

    const width = this.bloodGroundWidthPx;
    const height = this.bloodGroundHeightPx;
    const centerX = (worldX + TILE_SIZE * 0.5) * this.bloodGroundWorldToPixelX;
    const centerY =
      height - 1 - (TILE_SIZE * 0.5 - worldY) * this.bloodGroundWorldToPixelY;
    const radiusPxX = Math.max(
      0.75,
      radiusWorldX * this.bloodGroundPixelsPerWorldUnit,
    );
    const radiusPxY = Math.max(
      0.75,
      radiusWorldY * this.bloodGroundPixelsPerWorldUnit,
    );
    const extent = Math.max(radiusPxX, radiusPxY) * 1.5 + 2;
    const minX = Math.max(0, Math.floor(centerX - extent));
    const maxX = Math.min(width - 1, Math.ceil(centerX + extent));
    const minY = Math.max(0, Math.floor(centerY - extent));
    const maxY = Math.min(height - 1, Math.ceil(centerY + extent));
    if (minX > maxX || minY > maxY) {
      return;
    }

    const sin = Math.sin(angleRadians);
    const cos = Math.cos(angleRadians);
    const invRadiusXSq = 1 / (radiusPxX * radiusPxX);
    const invRadiusYSq = 1 / (radiusPxY * radiusPxY);
    const noiseMask = this.bloodGroundNoiseAtlasMask;
    const noiseShift = this.bloodGroundNoiseAtlasShift;
    const baseNoiseOffsetX = seed & noiseMask;
    const baseNoiseOffsetY = (seed >>> 8) & noiseMask;
    const secondaryNoiseOffsetX = (seed >>> 16) & noiseMask;
    const secondaryNoiseOffsetY = (seed >>> 24) & noiseMask;
    const baseDensity = Math.max(0, densityAmount);
    const featherLut = this.getBloodGroundFeatherLut(featherPower);
    const minDx = minX - centerX;
    let wrotePixel = false;

    for (let py = minY; py <= maxY; py += 1) {
      const dy = py - centerY;
      const rowOffset = py * width;
      let localX = minDx * cos + dy * sin;
      let localY = -minDx * sin + dy * cos;
      let primaryX = 0;
      let primaryY = 0;
      let secondaryX = 0;
      let secondaryY = 0;
      let tertiaryX = 0;
      let tertiaryY = 0;
      if (pattern) {
        primaryX =
          minX * pattern.primary.xx +
          py * pattern.primary.xy +
          pattern.primary.xb;
        primaryY =
          minX * pattern.primary.yx +
          py * pattern.primary.yy +
          pattern.primary.yb;
        secondaryX =
          minX * pattern.secondary.xx +
          py * pattern.secondary.xy +
          pattern.secondary.xb;
        secondaryY =
          minX * pattern.secondary.yx +
          py * pattern.secondary.yy +
          pattern.secondary.yb;
        tertiaryX =
          minX * pattern.tertiary.xx +
          py * pattern.tertiary.xy +
          pattern.tertiary.xb;
        tertiaryY =
          minX * pattern.tertiary.yx +
          py * pattern.tertiary.yy +
          pattern.tertiary.yb;
      }

      for (let px = minX; px <= maxX; px += 1) {
        const radialDistance =
          localX * localX * invRadiusXSq + localY * localY * invRadiusYSq;
        if (radialDistance > 1) {
          localX += cos;
          localY -= sin;
          if (pattern) {
            primaryX += pattern.primary.xx;
            primaryY += pattern.primary.yx;
            secondaryX += pattern.secondary.xx;
            secondaryY += pattern.secondary.yx;
            tertiaryX += pattern.tertiary.xx;
            tertiaryY += pattern.tertiary.yx;
          }
          continue;
        }

        const distanceT = Math.sqrt(radialDistance);
        const edgeT = 1 - distanceT;
        const baseNoise =
          noiseAtlasA[
            (((py + baseNoiseOffsetY) & noiseMask) << noiseShift) +
              ((px + baseNoiseOffsetX) & noiseMask)
          ];
        const breakupT =
          distanceT <= 0.08
            ? 0
            : distanceT >= 1
              ? 1
              : (distanceT - 0.08) * 1.0869565217391304;
        let patternNoise = 1;
        let depositScale = 1;
        const breakupThreshold = 0.16 + (0.68 - 0.16) * breakupT;
        if (pattern) {
          const primaryNoise =
            noiseAtlasA[
              ((Math.floor(primaryY) & noiseMask) << noiseShift) +
                (Math.floor(primaryX) & noiseMask)
            ];
          const secondaryNoise =
            noiseAtlasB[
              ((Math.floor(secondaryY) & noiseMask) << noiseShift) +
                (Math.floor(secondaryX) & noiseMask)
            ];
          const tertiaryNoise =
            noiseAtlasC[
              ((Math.floor(tertiaryY) & noiseMask) << noiseShift) +
                (Math.floor(tertiaryX) & noiseMask)
            ];
          const ridge = 1 - Math.abs(secondaryNoise * 2 - 1);
          const combined =
            primaryNoise * 0.5 + ridge * 0.3 + tertiaryNoise * 0.2;
          patternNoise = Math.max(
            0,
            Math.min(
              1,
              (combined - pattern.threshold) * pattern.contrast + 0.5,
            ),
          );
          depositScale = 0.18 + 1.18 * patternNoise;
        }

        if (distanceT > 0.28 && patternNoise < breakupThreshold) {
          localX += cos;
          localY -= sin;
          if (pattern) {
            primaryX += pattern.primary.xx;
            primaryY += pattern.primary.yx;
            secondaryX += pattern.secondary.xx;
            secondaryY += pattern.secondary.yx;
            tertiaryX += pattern.tertiary.xx;
            tertiaryY += pattern.tertiary.yx;
          }
          continue;
        }
        if (
          distanceT > 0.93 &&
          noiseAtlasB[
            (((py + secondaryNoiseOffsetY) & noiseMask) << noiseShift) +
              ((px + secondaryNoiseOffsetX) & noiseMask)
          ] < 0.18
        ) {
          localX += cos;
          localY -= sin;
          if (pattern) {
            primaryX += pattern.primary.xx;
            primaryY += pattern.primary.yx;
            secondaryX += pattern.secondary.xx;
            secondaryY += pattern.secondary.yx;
            tertiaryX += pattern.tertiary.xx;
            tertiaryY += pattern.tertiary.yx;
          }
          continue;
        }

        const edgeIndex =
          edgeT <= 0 ? 0 : edgeT >= 1 ? 256 : Math.round(edgeT * 256);
        let deposit = baseDensity * featherLut[edgeIndex];
        deposit *= depositScale;
        if (distanceT > 0.72) {
          deposit *= 0.45 + (1.18 - 0.45) * baseNoise;
        } else {
          deposit *= 0.84 + baseNoise * 0.24;
        }
        const depositRounded = Math.max(0, Math.round(deposit));
        if (depositRounded <= 0) {
          localX += cos;
          localY -= sin;
          if (pattern) {
            primaryX += pattern.primary.xx;
            primaryY += pattern.primary.yx;
            secondaryX += pattern.secondary.xx;
            secondaryY += pattern.secondary.yx;
            tertiaryX += pattern.tertiary.xx;
            tertiaryY += pattern.tertiary.yx;
          }
          continue;
        }

        const densityIndex = rowOffset + px;
        const previousDensity = densityBuffer[densityIndex];
        const nextDensity = Math.min(
          this.bloodGroundMaxDensity,
          previousDensity + depositRounded,
        );
        if (nextDensity === previousDensity) {
          localX += cos;
          localY -= sin;
          if (pattern) {
            primaryX += pattern.primary.xx;
            primaryY += pattern.primary.yx;
            secondaryX += pattern.secondary.xx;
            secondaryY += pattern.secondary.yx;
            tertiaryX += pattern.tertiary.xx;
            tertiaryY += pattern.tertiary.yx;
          }
          continue;
        }

        densityBuffer[densityIndex] = nextDensity;
        wrotePixel = true;
        localX += cos;
        localY -= sin;
        if (pattern) {
          primaryX += pattern.primary.xx;
          primaryY += pattern.primary.yx;
          secondaryX += pattern.secondary.xx;
          secondaryY += pattern.secondary.yx;
          tertiaryX += pattern.tertiary.xx;
          tertiaryY += pattern.tertiary.yx;
        }
      }
    }

    if (!wrotePixel) {
      return;
    }

    this.bloodGroundHasVisibleData = true;
    this.markBloodGroundDirtyRect(minX, minY, maxX, maxY);
  }

  rasterizeBloodGroundTrail(
    startWorldX: number,
    startWorldY: number,
    endWorldX: number,
    endWorldY: number,
    startRadiusWorld: number,
    endRadiusWorld: number,
    densityAmount: number,
    seed: number,
    pattern: BloodGroundPatternParams | null = null,
  ): void {
    const deltaX = endWorldX - startWorldX;
    const deltaY = endWorldY - startWorldY;
    const lengthWorld = Math.hypot(deltaX, deltaY);
    const angle = Math.atan2(deltaY, deltaX);
    const averageRadiusWorld = (startRadiusWorld + endRadiusWorld) * 0.5;
    const lengthPx = lengthWorld * this.bloodGroundPixelsPerWorldUnit;
    const averageRadiusPx =
      averageRadiusWorld * this.bloodGroundPixelsPerWorldUnit;
    const segmentSpacingPx = Math.max(
      this.bloodGroundTrailSegmentSpacingPx,
      averageRadiusPx * 1.2,
    );
    const steps = THREE.MathUtils.clamp(
      Math.ceil(lengthPx / Math.max(1, segmentSpacingPx)),
      1,
      9,
    );

    for (let step = 0; step <= steps; step += 1) {
      const t = steps > 0 ? step / steps : 0;
      const worldX = THREE.MathUtils.lerp(startWorldX, endWorldX, t);
      const worldY = THREE.MathUtils.lerp(startWorldY, endWorldY, t);
      const radiusWorld = THREE.MathUtils.lerp(
        startRadiusWorld,
        endRadiusWorld,
        t,
      );
      const stepDensity = densityAmount * (0.95 - t * 0.42);
      this.rasterizeBloodGroundEllipse(
        worldX,
        worldY,
        radiusWorld * 1.08,
        radiusWorld * 0.82,
        angle,
        stepDensity,
        1.55 + t * 0.45,
        seed + step * 977,
        pattern,
      );
    }
  }

  paintBloodGroundImpact(params: BloodGroundImpactParams): void {
    if (!this.dependencies.engineState.clientOptions.bloodGround) {
      return;
    }
    if (this.dependencies.levelTerrainCache.pendingLevelCacheTransition) {
      return;
    }
    if (!this.ensureBloodGroundOverlayResources()) {
      return;
    }

    const intensityScale = THREE.MathUtils.clamp(
      params.intensityScale ?? 1,
      0.2,
      1,
    );
    const densityAmount = Math.max(1, params.densityAmount * intensityScale);
    const scatterCount = this.scaleBloodGroundDiscreteCount(
      params.scatterCount,
      intensityScale,
    );
    const streakCount = this.scaleBloodGroundDiscreteCount(
      params.streakCount,
      intensityScale,
    );

    // Compose each deposit from a denser focal blot, satellite droplets, and
    // directional trails so hits read as splats instead of uniform ovals.
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const patternAngle = Math.random() * Math.PI * 2;
    const rotationSin = Math.sin(patternAngle);
    const rotationCos = Math.cos(patternAngle);
    const offsetX = (Math.random() - 0.5) * 4096;
    const offsetY = (Math.random() - 0.5) * 4096;
    const buildPatternLayer = (
      sampleXOffset: number,
      sampleYOffset: number,
      sampleXX: number,
      sampleXY: number,
      sampleYX: number,
      sampleYY: number,
      scale: number,
    ): BloodGroundPatternLayer => {
      const inverseScale = 1 / scale;
      return {
        xx: sampleXX * inverseScale,
        xy: sampleXY * inverseScale,
        xb: sampleXOffset * inverseScale,
        yx: sampleYX * inverseScale,
        yy: sampleYY * inverseScale,
        yb: sampleYOffset * inverseScale,
      };
    };
    const pattern: BloodGroundPatternParams = {
      primary: buildPatternLayer(
        offsetX,
        offsetY,
        rotationCos,
        -rotationSin,
        rotationSin,
        rotationCos,
        THREE.MathUtils.lerp(4.2, 10.5, Math.random()),
      ),
      secondary: buildPatternLayer(
        offsetX - offsetY * 0.17,
        offsetY + offsetX * 0.17,
        rotationCos,
        -rotationSin,
        rotationSin,
        rotationCos,
        THREE.MathUtils.lerp(1.8, 4.4, Math.random()),
      ),
      tertiary: buildPatternLayer(
        offsetX + offsetY,
        offsetY - offsetX,
        rotationCos + rotationSin,
        rotationCos - rotationSin,
        rotationSin - rotationCos,
        rotationCos + rotationSin,
        THREE.MathUtils.lerp(1.2, 2.5, Math.random()),
      ),
      threshold: THREE.MathUtils.lerp(0.3, 0.56, Math.random()),
      contrast: THREE.MathUtils.lerp(1.9, 3.1, Math.random()),
    };
    this.bloodGroundDirectionScratch.set(params.directionX, params.directionY);
    if (this.bloodGroundDirectionScratch.lengthSq() < 1e-8) {
      const randomAngle = Math.random() * Math.PI * 2;
      this.bloodGroundDirectionScratch.set(
        Math.cos(randomAngle),
        Math.sin(randomAngle),
      );
    } else {
      this.bloodGroundDirectionScratch.normalize();
    }
    this.bloodGroundPerpendicularScratch.set(
      -this.bloodGroundDirectionScratch.y,
      this.bloodGroundDirectionScratch.x,
    );

    const impactAngle = Math.atan2(
      this.bloodGroundDirectionScratch.y,
      this.bloodGroundDirectionScratch.x,
    );
    const baseRadius = Math.max(0.015, params.baseRadiusWorld);
    const coreRadiusX = baseRadius * (1 + params.elongation * 0.38);
    const coreRadiusY = baseRadius * (0.84 + Math.random() * 0.18);
    this.rasterizeBloodGroundEllipse(
      params.worldX,
      params.worldY,
      coreRadiusX,
      coreRadiusY,
      impactAngle + (Math.random() - 0.5) * 0.42,
      densityAmount,
      1.4,
      seed,
      pattern,
    );

    const lobeDistance = baseRadius * (0.28 + Math.random() * 0.55);
    this.rasterizeBloodGroundEllipse(
      params.worldX +
        this.bloodGroundDirectionScratch.x * lobeDistance +
        this.bloodGroundPerpendicularScratch.x *
          baseRadius *
          (Math.random() - 0.5) *
          0.7,
      params.worldY +
        this.bloodGroundDirectionScratch.y * lobeDistance +
        this.bloodGroundPerpendicularScratch.y *
          baseRadius *
          (Math.random() - 0.5) *
          0.7,
      baseRadius * (0.55 + Math.random() * 0.2),
      baseRadius * (0.4 + Math.random() * 0.2),
      impactAngle + (Math.random() - 0.5) * 0.55,
      densityAmount * 0.78,
      1.7,
      seed + 101,
      pattern,
    );

    for (let i = 0; i < scatterCount; i += 1) {
      const forward =
        Math.pow(Math.random(), 0.78) *
        (baseRadius * 1.25 + params.streakLengthWorld * 0.75);
      const lateral =
        (Math.random() - 0.5) * baseRadius * (1.5 + Math.random());
      const spotRadius = baseRadius * (0.16 + Math.random() * 0.32);
      const worldX =
        params.worldX +
        this.bloodGroundDirectionScratch.x * forward +
        this.bloodGroundPerpendicularScratch.x * lateral;
      const worldY =
        params.worldY +
        this.bloodGroundDirectionScratch.y * forward +
        this.bloodGroundPerpendicularScratch.y * lateral;
      this.rasterizeBloodGroundEllipse(
        worldX,
        worldY,
        spotRadius * (0.85 + Math.random() * 0.35),
        spotRadius * (0.8 + Math.random() * 0.25),
        impactAngle + (Math.random() - 0.5) * 1.15,
        densityAmount * (0.18 + Math.random() * 0.28),
        1.8 + Math.random() * 0.5,
        seed + 211 + i * 31,
        pattern,
      );
    }

    for (let i = 0; i < streakCount; i += 1) {
      const streakStartForward = baseRadius * (0.18 + Math.random() * 0.34);
      const streakLateral = (Math.random() - 0.5) * baseRadius * 0.9;
      const streakLength =
        params.streakLengthWorld * (0.55 + Math.random() * 0.75);
      const startX =
        params.worldX +
        this.bloodGroundDirectionScratch.x * streakStartForward +
        this.bloodGroundPerpendicularScratch.x * streakLateral;
      const startY =
        params.worldY +
        this.bloodGroundDirectionScratch.y * streakStartForward +
        this.bloodGroundPerpendicularScratch.y * streakLateral;
      const endX =
        startX +
        this.bloodGroundDirectionScratch.x * streakLength +
        this.bloodGroundPerpendicularScratch.x *
          baseRadius *
          (Math.random() - 0.5) *
          0.65;
      const endY =
        startY +
        this.bloodGroundDirectionScratch.y * streakLength +
        this.bloodGroundPerpendicularScratch.y *
          baseRadius *
          (Math.random() - 0.5) *
          0.65;
      this.rasterizeBloodGroundTrail(
        startX,
        startY,
        endX,
        endY,
        baseRadius * (0.28 + Math.random() * 0.14),
        baseRadius * (0.08 + Math.random() * 0.06),
        densityAmount * (0.36 + Math.random() * 0.22),
        seed + 503 + i * 131,
        pattern,
      );
    }
  }

  scaleBloodGroundDiscreteCount(count: number, scale: number): number {
    if (count <= 0) {
      return 0;
    }
    const scaled = count * THREE.MathUtils.clamp(scale, 0, 1);
    const whole = Math.floor(scaled);
    return whole + (Math.random() < scaled - whole ? 1 : 0);
  }

  resolveBloodGroundLowFpsScale(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return 1;
    }
    return THREE.MathUtils.clamp(
      this.bloodGroundReferenceFrameSeconds / deltaSeconds,
      0.2,
      1,
    );
  }

  paintBloodGroundFromDirectHit(
    tileX: number,
    tileY: number,
    damage: number,
    variant: "hit" | "defeat",
    directionX: number,
    directionY: number,
  ): void {
    const clampedDamage = THREE.MathUtils.clamp(Math.abs(damage), 1, 24);
    const defeat = variant === "defeat";
    this.paintBloodGroundImpact({
      worldX: tileX * TILE_SIZE,
      worldY: -tileY * TILE_SIZE,
      directionX,
      directionY,
      baseRadiusWorld:
        (defeat ? 0.13 : 0.09) + clampedDamage * (defeat ? 0.011 : 0.0075),
      densityAmount: defeat
        ? 230 + clampedDamage * 12
        : 150 + clampedDamage * 9,
      scatterCount:
        (defeat
          ? THREE.MathUtils.randInt(8, 13)
          : THREE.MathUtils.randInt(4, 8)) +
        Math.min(defeat ? 5 : 3, Math.floor(clampedDamage / 4)),
      streakCount: defeat
        ? THREE.MathUtils.randInt(2, 4)
        : THREE.MathUtils.randInt(1, 2),
      streakLengthWorld:
        (defeat ? 0.28 : 0.16) + clampedDamage * (defeat ? 0.03 : 0.018),
      elongation: defeat ? 1.05 : 0.72,
    });
  }

  paintBloodGroundFromParticleImpact(
    worldX: number,
    worldY: number,
    velocityX: number,
    velocityY: number,
    impactSpeed: number,
    radiusHint: number,
    impactCount: number,
    intensityScale: number = 1,
  ): void {
    if (impactSpeed < 0.3 || (impactCount > 0 && impactSpeed < 1.05)) {
      return;
    }

    const horizontalSpeed = Math.hypot(velocityX, velocityY);
    this.paintBloodGroundImpact({
      worldX,
      worldY,
      directionX: velocityX,
      directionY: velocityY,
      baseRadiusWorld: THREE.MathUtils.clamp(
        radiusHint * 0.95 + impactSpeed * 0.012,
        0.02,
        0.1,
      ),
      densityAmount: THREE.MathUtils.clamp(38 + impactSpeed * 16, 28, 118),
      scatterCount:
        horizontalSpeed > 0.85
          ? THREE.MathUtils.randInt(1, 3)
          : THREE.MathUtils.randInt(0, 1),
      streakCount: horizontalSpeed > 0.45 ? THREE.MathUtils.randInt(1, 2) : 0,
      streakLengthWorld: THREE.MathUtils.clamp(
        horizontalSpeed * 0.055,
        0.04,
        0.22,
      ),
      elongation: THREE.MathUtils.clamp(horizontalSpeed / 2.2, 0.12, 0.95),
      intensityScale,
    });
  }

  paintBloodGroundFromShardImpact(
    particle: BillboardShardParticle,
    impactSpeed: number,
    intensityScale: number = 1,
  ): void {
    if (
      impactSpeed < 0.35 ||
      (particle.groundImpactCount > 0 && impactSpeed < 0.95)
    ) {
      return;
    }

    const horizontalSpeed = Math.hypot(
      particle.velocity.x,
      particle.velocity.y,
    );
    const shardWidth = Math.max(0.01, particle.baseScale.x);
    const shardHeight = Math.max(0.01, particle.baseScale.y);
    const scaleHint = Math.max(shardWidth, shardHeight);
    const shardArea = shardWidth * shardHeight;
    const shardSizeFactor = THREE.MathUtils.clamp(
      Math.sqrt(shardArea) / 0.1,
      0.55,
      2.5,
    );
    this.paintBloodGroundImpact({
      worldX: particle.mesh.position.x,
      worldY: particle.mesh.position.y,
      directionX: particle.velocity.x,
      directionY: particle.velocity.y,
      baseRadiusWorld: THREE.MathUtils.clamp(
        scaleHint * (0.3 + shardSizeFactor * 0.07) + impactSpeed * 0.012,
        0.05,
        0.22,
      ),
      densityAmount: THREE.MathUtils.clamp(
        74 +
          impactSpeed * 16 +
          scaleHint * 190 +
          shardArea * 2000 +
          shardSizeFactor * 22,
        68,
        280,
      ),
      scatterCount: THREE.MathUtils.randInt(
        2,
        Math.max(3, 2 + Math.round(shardSizeFactor * 1.3)),
      ),
      streakCount:
        horizontalSpeed > 0.35
          ? THREE.MathUtils.randInt(
              1,
              Math.max(2, 2 + Math.round(shardSizeFactor * 0.8)),
            )
          : THREE.MathUtils.randInt(
              1,
              Math.max(1, 1 + Math.round(shardSizeFactor * 0.55)),
            ),
      streakLengthWorld: THREE.MathUtils.clamp(
        scaleHint * (0.64 + shardSizeFactor * 0.1) + horizontalSpeed * 0.072,
        0.08,
        0.34,
      ),
      elongation: THREE.MathUtils.clamp(
        0.26 + shardSizeFactor * 0.14 + horizontalSpeed / 2.45,
        0.28,
        1.08,
      ),
      intensityScale,
    });
  }

  shouldUseBloodGroundCompatibilityMode(): boolean {
    return (
      this.dependencies.audioHapticsPlatform.getNativeCapacitorPlatform() === "android" ||
      (typeof navigator !== "undefined" &&
        /\bAndroid\b/i.test(navigator.userAgent || ""))
    );
  }
}
