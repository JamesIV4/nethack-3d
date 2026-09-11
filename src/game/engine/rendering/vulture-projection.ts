import * as THREE from "three";
import { type VultureTileLookup } from "../../vulture/translation";
import type {
  VultureWallFaceSlot,
  VultureWallProjectionFamily,
  VultureDoorProjectionOrientation,
  VultureDoorProjectionDebugFamily,
  VultureProjectionDebugFamily,
  VultureDoorProjectionState,
  VultureDoorProjectionSide,
  VultureWallProjectionPoint,
  VultureWallProjectionQuad,
  VultureWallProjectionLookup,
  VultureDoorProjectionContext,
  VulturePrebakedProjectionManifest,
  VulturePrebakedProjectionImageState
} from "../shared/types";
import {
  NH3D_INTERNAL_VULTURE_PROJECTION_TEXTURE_MODE,
  NH3D_VULTURE_PREBAKED_PROJECTION_MANIFEST_RELATIVE_PATH
} from "../shared/constants";
import type { EngineState } from "../runtime/engine-state";
import type { TilesetAssets } from "./tileset-assets";
import type { TileUpdates } from "../world/tile-updates";

export interface VultureProjectionDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "invalidateTilesetDependentCaches"
    | "tileSourceSize"
    | "vultureTilesetDataRootUrl"
    | "vultureTilesetTranslator"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "refreshTilesFromStateCache"
  >;
}

/** Vulture projection profiles, prebaked projection loading and pixel reprojection */
export class VultureProjection {
  constructor(private readonly dependencies: VultureProjectionDependencies) {}

  vultureWallProjectionQuadEW: VultureWallProjectionQuad = {
    topLeft: { x: 0.2165, y: 0.2268 },
    topRight: { x: 0.7835, y: 0 },
    bottomRight: { x: 0.7835, y: 0.7474 },
    bottomLeft: { x: 0.2165, y: 1 },
  };

  vultureWallProjectionQuadSN: VultureWallProjectionQuad = {
    topLeft: { x: 0.2165, y: 0 },
    topRight: { x: 0.7732, y: 0.2216 },
    bottomRight: { x: 0.7835, y: 0.9897 },
    bottomLeft: { x: 0.2268, y: 0.7732 },
  };

  vultureFloorProjectionQuad: VultureWallProjectionQuad = {
    topLeft: { x: 0, y: 0.4948 },
    topRight: { x: 0.5, y: 0.3093 },
    bottomRight: { x: 1, y: 0.4897 },
    bottomLeft: { x: 0.5, y: 0.6856 },
  };

  vultureDoorOpenProjectionQuadEW: VultureWallProjectionQuad = {
    topLeft: { x: 0.2938, y: 0.2371 },
    topRight: { x: 0.8866, y: 0 },
    bottomRight: { x: 0.8814, y: 0.7629 },
    bottomLeft: { x: 0.299, y: 1 },
  };

  vultureDoorOpenProjectionQuadSN: VultureWallProjectionQuad = {
    topLeft: { x: 0.1082, y: 0.0515 },
    topRight: { x: 0.7062, y: 0.2629 },
    bottomRight: { x: 0.7062, y: 1 },
    bottomLeft: { x: 0.1031, y: 0.7526 },
  };

  vultureDoorClosedProjectionQuadEW: VultureWallProjectionQuad = {
    topLeft: { x: 0.2526, y: 0.1598 },
    topRight: { x: 0.8763, y: 0 },
    bottomRight: { x: 0.866, y: 0.7216 },
    bottomLeft: { x: 0.2474, y: 0.9897 },
  };

  vultureDoorClosedProjectionQuadSN: VultureWallProjectionQuad = {
    topLeft: { x: 0.1186, y: 0 },
    topRight: { x: 0.7526, y: 0.1804 },
    bottomRight: { x: 0.7474, y: 0.9639 },
    bottomLeft: { x: 0.1134, y: 0.732 },
  };

  vultureWallProjectionRotationByFace: Record<
    VultureWallFaceSlot,
    number
  > = {
    north: 0,
    east: 0,
    south: 0,
    west: 0,
  };

  vultureFloorProjectionRotationDegrees = 270;

  vultureDoorProjectionRotationByStateSide: Record<
    VultureDoorProjectionState,
    Record<VultureDoorProjectionSide, number>
  > = {
    open: {
      front: 180,
      back: 0,
    },
    closed: {
      front: 180,
      back: 0,
    },
  };

  vultureBillboardScaleFactor = 1.4;

  vultureWallProjectionWorkCanvas: HTMLCanvasElement | null = null;

  vulturePrebakedProjectionManifest: VulturePrebakedProjectionManifest | null =
    null;

  vulturePrebakedProjectionManifestUrl = "";

  vulturePrebakedProjectionManifestLoadPromise: Promise<void> | null =
    null;

  readonly vulturePrebakedProjectionImageByUrl = new Map<
    string,
    VulturePrebakedProjectionImageState
  >();

  readonly vulturePrebakedProjectionImageLoadPromiseByUrl = new Map<
    string,
    Promise<HTMLImageElement | null>
  >();

  disposeVulturePrebakedProjectionManifest(): void {
    this.vulturePrebakedProjectionManifest = null;
    this.vulturePrebakedProjectionManifestUrl = "";
    this.vulturePrebakedProjectionManifestLoadPromise = null;
    this.vulturePrebakedProjectionImageByUrl.clear();
    this.vulturePrebakedProjectionImageLoadPromiseByUrl.clear();
  }

  shouldUseVulturePrebakedProjectionTextures(): boolean {
    return NH3D_INTERNAL_VULTURE_PROJECTION_TEXTURE_MODE === "prebaked";
  }

  ensureVulturePrebakedProjectionManifest(dataRootUrl: string): void {
    if (!this.shouldUseVulturePrebakedProjectionTextures()) {
      this.disposeVulturePrebakedProjectionManifest();
      return;
    }
    const manifestUrl = `${dataRootUrl}/${NH3D_VULTURE_PREBAKED_PROJECTION_MANIFEST_RELATIVE_PATH}`;
    if (
      this.vulturePrebakedProjectionManifestUrl === manifestUrl &&
      (this.vulturePrebakedProjectionManifest !== null ||
        this.vulturePrebakedProjectionManifestLoadPromise !== null)
    ) {
      return;
    }

    this.vulturePrebakedProjectionManifest = null;
    this.vulturePrebakedProjectionManifestUrl = manifestUrl;
    this.vulturePrebakedProjectionManifestLoadPromise =
      this.loadVulturePrebakedProjectionManifest(manifestUrl, dataRootUrl);
  }

  async loadVulturePrebakedProjectionManifest(
    manifestUrl: string,
    dataRootUrl: string,
  ): Promise<void> {
    try {
      const response = await fetch(manifestUrl);
      if (this.vulturePrebakedProjectionManifestUrl !== manifestUrl) {
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (this.vulturePrebakedProjectionManifestUrl !== manifestUrl) {
        return;
      }
      const normalizedManifest =
        this.normalizeVulturePrebakedProjectionManifest(payload);
      if (!normalizedManifest) {
        throw new Error("Invalid manifest payload");
      }
      this.vulturePrebakedProjectionManifest = normalizedManifest;

      const preloadPaths = new Set<string>(
        Object.values(normalizedManifest.entries),
      );
      const preloadUrls = Array.from(preloadPaths, (relativePath) =>
        this.resolveVulturePrebakedProjectionAssetUrl(
          dataRootUrl,
          relativePath,
        ),
      );
      await Promise.allSettled(
        preloadUrls.map((url) => this.loadVulturePrebakedProjectionImage(url)),
      );
      if (this.vulturePrebakedProjectionManifestUrl !== manifestUrl) {
        return;
      }
      this.dependencies.tilesetAssets.invalidateTilesetDependentCaches();
      if (this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
        this.dependencies.tileUpdates.refreshTilesFromStateCache();
      }
    } catch (error) {
      if (this.vulturePrebakedProjectionManifestUrl === manifestUrl) {
        this.vulturePrebakedProjectionManifest = null;
      }
      console.warn(
        `Failed to load Vulture prebaked projection manifest from '${manifestUrl}':`,
        error,
      );
    } finally {
      if (this.vulturePrebakedProjectionManifestUrl === manifestUrl) {
        this.vulturePrebakedProjectionManifestLoadPromise = null;
      }
    }
  }

  normalizeVulturePrebakedProjectionManifest(
    payload: unknown,
  ): VulturePrebakedProjectionManifest | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const manifest = payload as Partial<VulturePrebakedProjectionManifest>;
    const rawEntries = manifest.entries;
    if (!rawEntries || typeof rawEntries !== "object") {
      return null;
    }
    const normalizedEntries: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawEntries)) {
      if (typeof key !== "string" || typeof value !== "string") {
        continue;
      }
      normalizedEntries[key] = value;
    }
    if (Object.keys(normalizedEntries).length <= 0) {
      return null;
    }
    const tileSize =
      typeof manifest.tileSize === "number" &&
      Number.isFinite(manifest.tileSize)
        ? Math.max(1, Math.trunc(manifest.tileSize))
        : this.dependencies.tilesetAssets.tileSourceSize;
    const formatVersion =
      typeof manifest.formatVersion === "number" &&
      Number.isFinite(manifest.formatVersion)
        ? Math.trunc(manifest.formatVersion)
        : 1;
    const profileSignature =
      typeof manifest.profileSignature === "string"
        ? manifest.profileSignature
        : "";
    if (!profileSignature) {
      return null;
    }
    return {
      formatVersion,
      tileSize,
      profileSignature,
      entries: normalizedEntries,
    };
  }

  resolveVulturePrebakedProjectionAssetUrl(
    dataRootUrl: string,
    relativePath: string,
  ): string {
    const normalizedRelativePath = String(relativePath || "")
      .replace(/\\/g, "/")
      .replace(/^\.?\//, "");
    return `${dataRootUrl}/${normalizedRelativePath}`;
  }

  loadVulturePrebakedProjectionImage(
    url: string,
  ): Promise<HTMLImageElement | null> {
    const cachedState = this.vulturePrebakedProjectionImageByUrl.get(url);
    if (cachedState instanceof HTMLImageElement) {
      return Promise.resolve(cachedState);
    }
    const pending =
      this.vulturePrebakedProjectionImageLoadPromiseByUrl.get(url);
    if (pending) {
      return pending;
    }

    this.vulturePrebakedProjectionImageByUrl.set(url, "loading");
    const loadPromise = new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => {
        this.vulturePrebakedProjectionImageByUrl.set(url, image);
        resolve(image);
      };
      image.onerror = () => {
        this.vulturePrebakedProjectionImageByUrl.set(url, null);
        resolve(null);
      };
      image.src = url;
    }).finally(() => {
      this.vulturePrebakedProjectionImageLoadPromiseByUrl.delete(url);
    });
    this.vulturePrebakedProjectionImageLoadPromiseByUrl.set(url, loadPromise);
    return loadPromise;
  }

  getLoadedVulturePrebakedProjectionImage(
    url: string,
  ): HTMLImageElement | null {
    const cached = this.vulturePrebakedProjectionImageByUrl.get(url);
    if (cached instanceof HTMLImageElement) {
      return cached;
    }
    if (cached === "loading") {
      return null;
    }
    void this.loadVulturePrebakedProjectionImage(url);
    return null;
  }

  getVultureWallProjectionRotationDegrees(
    face: VultureWallFaceSlot,
  ): number {
    const rawValue = this.vultureWallProjectionRotationByFace[face];
    const normalized = ((Math.trunc(rawValue / 90) % 4) + 4) % 4;
    return normalized * 90;
  }

  getVultureBillboardScaleFactor(): number {
    const raw = this.vultureBillboardScaleFactor;
    if (!Number.isFinite(raw)) {
      return 1;
    }
    return THREE.MathUtils.clamp(raw, 0.1, 8);
  }

  getVultureFloorProjectionRotationDegrees(): number {
    const rawValue = this.vultureFloorProjectionRotationDegrees;
    const normalized = ((Math.trunc(rawValue / 90) % 4) + 4) % 4;
    return normalized * 90;
  }

  getVultureDoorProjectionRotationDegrees(
    state: VultureDoorProjectionState,
    side: VultureDoorProjectionSide,
  ): number {
    const rawValue = this.vultureDoorProjectionRotationByStateSide[state][side];
    const normalized = ((Math.trunc(rawValue / 90) % 4) + 4) % 4;
    return normalized * 90;
  }

  getVultureDoorProjectionSideRotationDegrees(
    side: VultureDoorProjectionSide,
  ): number {
    return this.getVultureDoorProjectionRotationDegrees("open", side);
  }

  createDefaultVultureWallProjectionQuad(
    family: VultureProjectionDebugFamily,
  ): VultureWallProjectionQuad {
    if (family === "ew") {
      return {
        topLeft: { x: 0.2165, y: 0.2268 },
        topRight: { x: 0.7835, y: 0 },
        bottomRight: { x: 0.7835, y: 0.7474 },
        bottomLeft: { x: 0.2165, y: 1 },
      };
    }
    if (family === "sn") {
      return {
        topLeft: { x: 0.2165, y: 0 },
        topRight: { x: 0.7732, y: 0.2216 },
        bottomRight: { x: 0.7835, y: 0.9897 },
        bottomLeft: { x: 0.2268, y: 0.7732 },
      };
    }
    if (family === "door_open_ew") {
      return {
        topLeft: { x: 0.2938, y: 0.2371 },
        topRight: { x: 0.8866, y: 0 },
        bottomRight: { x: 0.8814, y: 0.7629 },
        bottomLeft: { x: 0.299, y: 1 },
      };
    }
    if (family === "door_open_sn") {
      return {
        topLeft: { x: 0.1082, y: 0.0515 },
        topRight: { x: 0.7062, y: 0.2629 },
        bottomRight: { x: 0.7062, y: 1 },
        bottomLeft: { x: 0.1031, y: 0.7526 },
      };
    }
    if (family === "door_closed_ew") {
      return {
        topLeft: { x: 0.2526, y: 0.1598 },
        topRight: { x: 0.8763, y: 0 },
        bottomRight: { x: 0.866, y: 0.7216 },
        bottomLeft: { x: 0.2474, y: 0.9897 },
      };
    }
    if (family === "door_closed_sn") {
      return {
        topLeft: { x: 0.1186, y: 0 },
        topRight: { x: 0.7526, y: 0.1804 },
        bottomRight: { x: 0.7474, y: 0.9639 },
        bottomLeft: { x: 0.1134, y: 0.732 },
      };
    }
    return {
      topLeft: { x: 0, y: 0.4948 },
      topRight: { x: 0.5, y: 0.3093 },
      bottomRight: { x: 1, y: 0.4897 },
      bottomLeft: { x: 0.5, y: 0.6856 },
    };
  }

  getVultureWallProjectionQuad(
    family: VultureProjectionDebugFamily,
  ): VultureWallProjectionQuad {
    if (family === "ew") {
      return this.vultureWallProjectionQuadEW;
    }
    if (family === "sn") {
      return this.vultureWallProjectionQuadSN;
    }
    if (family === "door_open_ew") {
      return this.vultureDoorOpenProjectionQuadEW;
    }
    if (family === "door_open_sn") {
      return this.vultureDoorOpenProjectionQuadSN;
    }
    if (family === "door_closed_ew") {
      return this.vultureDoorClosedProjectionQuadEW;
    }
    if (family === "door_closed_sn") {
      return this.vultureDoorClosedProjectionQuadSN;
    }
    return this.vultureFloorProjectionQuad;
  }

  ensureVultureWallProjectionWorkCanvas(
    size: number,
  ): HTMLCanvasElement {
    let canvas = this.vultureWallProjectionWorkCanvas;
    if (!canvas) {
      canvas = document.createElement("canvas");
      this.vultureWallProjectionWorkCanvas = canvas;
    }
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    return canvas;
  }

  roundVultureProjectionValue(value: number): number {
    return Number(value.toFixed(4));
  }

  buildVultureProjectionProfileSignature(): string {
    const roundPoint = (
      point: VultureWallProjectionPoint,
    ): VultureWallProjectionPoint => ({
      x: this.roundVultureProjectionValue(point.x),
      y: this.roundVultureProjectionValue(point.y),
    });
    const roundQuad = (
      quad: VultureWallProjectionQuad,
    ): VultureWallProjectionQuad => ({
      topLeft: roundPoint(quad.topLeft),
      topRight: roundPoint(quad.topRight),
      bottomRight: roundPoint(quad.bottomRight),
      bottomLeft: roundPoint(quad.bottomLeft),
    });
    return JSON.stringify({
      ew: roundQuad(this.vultureWallProjectionQuadEW),
      sn: roundQuad(this.vultureWallProjectionQuadSN),
      floor: roundQuad(this.vultureFloorProjectionQuad),
      door_open_ew: roundQuad(this.vultureDoorOpenProjectionQuadEW),
      door_open_sn: roundQuad(this.vultureDoorOpenProjectionQuadSN),
      door_closed_ew: roundQuad(this.vultureDoorClosedProjectionQuadEW),
      door_closed_sn: roundQuad(this.vultureDoorClosedProjectionQuadSN),
      rotation: {
        north: this.getVultureWallProjectionRotationDegrees("north"),
        east: this.getVultureWallProjectionRotationDegrees("east"),
        south: this.getVultureWallProjectionRotationDegrees("south"),
        west: this.getVultureWallProjectionRotationDegrees("west"),
        floor: this.getVultureFloorProjectionRotationDegrees(),
      },
      doorRotation: {
        open: {
          front: this.getVultureDoorProjectionRotationDegrees("open", "front"),
          back: this.getVultureDoorProjectionRotationDegrees("open", "back"),
        },
        closed: {
          front: this.getVultureDoorProjectionRotationDegrees(
            "closed",
            "front",
          ),
          back: this.getVultureDoorProjectionRotationDegrees("closed", "back"),
        },
      },
    });
  }

  resolveVulturePrebakedProjectionLookupKey(
    lookup: VultureTileLookup,
    projectionFamilyOverride: VultureWallProjectionFamily | null,
    doorProjection: VultureDoorProjectionContext | null,
  ): string | null {
    if (doorProjection) {
      const orientation =
        doorProjection.orientation ??
        projectionFamilyOverride ??
        this.resolveVultureDoorProjectionOrientation(lookup);
      if (orientation !== "ew" && orientation !== "sn") {
        return null;
      }
      const family = this.resolveVultureDoorProjectionDebugFamily(
        doorProjection.state,
        orientation,
      );
      return `${lookup.category}.${lookup.name}|family:${family}|doorSide:${doorProjection.side}`;
    }
    if (lookup.projection === "iso_floor") {
      return `${lookup.category}.${lookup.name}|family:floor|face:none`;
    }
    const wallLookup = lookup as VultureWallProjectionLookup;
    const family =
      projectionFamilyOverride ??
      (lookup.category === "wall"
        ? this.resolveVultureWallProjectionFamily(wallLookup)
        : null);
    if (!family) {
      return null;
    }
    const face = this.resolveVultureWallProjectionFace(wallLookup, family);
    return `${lookup.category}.${lookup.name}|family:${family}|face:${face}`;
  }

  tryDrawVulturePrebakedProjectionTexture(params: {
    context: CanvasRenderingContext2D;
    size: number;
    lookup: VultureTileLookup;
    projectionFamilyOverride: VultureWallProjectionFamily | null;
    doorProjection: VultureDoorProjectionContext | null;
  }): boolean {
    if (!this.shouldUseVulturePrebakedProjectionTextures()) {
      return false;
    }
    const manifest = this.vulturePrebakedProjectionManifest;
    if (!manifest) {
      return false;
    }
    if (
      manifest.profileSignature !==
      this.buildVultureProjectionProfileSignature()
    ) {
      return false;
    }
    const manifestKey = this.resolveVulturePrebakedProjectionLookupKey(
      params.lookup,
      params.projectionFamilyOverride,
      params.doorProjection,
    );
    if (!manifestKey) {
      return false;
    }
    const relativePath = manifest.entries[manifestKey];
    if (!relativePath || !this.dependencies.tilesetAssets.vultureTilesetDataRootUrl) {
      return false;
    }
    const imageUrl = this.resolveVulturePrebakedProjectionAssetUrl(
      this.dependencies.tilesetAssets.vultureTilesetDataRootUrl,
      relativePath,
    );
    const image = this.getLoadedVulturePrebakedProjectionImage(imageUrl);
    if (!image) {
      return false;
    }

    params.context.clearRect(0, 0, params.size, params.size);
    params.context.imageSmoothingEnabled = false;
    params.context.drawImage(
      image,
      0,
      0,
      Math.max(1, image.width),
      Math.max(1, image.height),
      0,
      0,
      params.size,
      params.size,
    );
    return true;
  }

  resolveVultureWallProjectionFamily(
    lookup: VultureWallProjectionLookup,
  ): VultureWallProjectionFamily | null {
    if (lookup.category !== "wall") {
      return null;
    }
    const normalizedName = String(lookup.name || "").toUpperCase();
    if (normalizedName.endsWith("_E") || normalizedName.endsWith("_W")) {
      return "ew";
    }
    if (normalizedName.endsWith("_S") || normalizedName.endsWith("_N")) {
      return "sn";
    }
    return null;
  }

  resolveVultureDoorProjectionOrientation(
    lookup: VultureTileLookup | null,
  ): VultureDoorProjectionOrientation | null {
    if (!lookup || lookup.category !== "misc") {
      return null;
    }
    const normalizedName = String(lookup.name || "").toUpperCase();
    if (normalizedName.startsWith("VDOOR_")) {
      return "ew";
    }
    if (normalizedName.startsWith("HDOOR_")) {
      return "sn";
    }
    return null;
  }

  resolveVultureDoorProjectionDebugFamily(
    state: VultureDoorProjectionState,
    orientation: VultureDoorProjectionOrientation,
  ): VultureDoorProjectionDebugFamily {
    if (state === "open") {
      return orientation === "ew" ? "door_open_ew" : "door_open_sn";
    }
    return orientation === "ew" ? "door_closed_ew" : "door_closed_sn";
  }

  resolveVultureWallProjectionFace(
    lookup: VultureWallProjectionLookup | null,
    family: VultureWallProjectionFamily,
  ): VultureWallFaceSlot {
    const explicitFace = lookup?.wallFace ?? null;
    if (
      explicitFace === "north" ||
      explicitFace === "east" ||
      explicitFace === "south" ||
      explicitFace === "west"
    ) {
      return explicitFace;
    }
    return family === "ew" ? "east" : "south";
  }

  rotateVultureWallProjectionUv(
    u: number,
    v: number,
    rotationDegrees: number,
  ): { u: number; v: number } {
    const normalizedRotation = ((Math.trunc(rotationDegrees / 90) % 4) + 4) % 4;
    switch (normalizedRotation) {
      case 1:
        return { u: v, v: 1 - u };
      case 2:
        return { u: 1 - u, v: 1 - v };
      case 3:
        return { u: 1 - v, v: u };
      case 0:
      default:
        return { u, v };
    }
  }

  dilateOpaqueVultureWallPixels(
    pixels: Uint8ClampedArray,
    size: number,
    iterations: number,
  ): void {
    if (iterations <= 0 || size <= 1) {
      return;
    }
    const directions: ReadonlyArray<readonly [number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (let pass = 0; pass < iterations; pass += 1) {
      const source = new Uint8ClampedArray(pixels);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const index = (y * size + x) * 4;
          if (source[index + 3] > 0) {
            continue;
          }
          let bestNeighborIndex = -1;
          let bestNeighborAlpha = 0;
          for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
              continue;
            }
            const neighborIndex = (ny * size + nx) * 4;
            const neighborAlpha = source[neighborIndex + 3];
            if (neighborAlpha <= bestNeighborAlpha) {
              continue;
            }
            bestNeighborAlpha = neighborAlpha;
            bestNeighborIndex = neighborIndex;
          }
          if (bestNeighborIndex < 0) {
            continue;
          }
          pixels[index] = source[bestNeighborIndex];
          pixels[index + 1] = source[bestNeighborIndex + 1];
          pixels[index + 2] = source[bestNeighborIndex + 2];
          pixels[index + 3] = source[bestNeighborIndex + 3];
        }
      }
    }
  }

  extendVultureWallOpaqueRunsToBorders(
    pixels: Uint8ClampedArray,
    size: number,
  ): void {
    const rowHasOpaque = new Array<boolean>(size).fill(false);
    for (let y = 0; y < size; y += 1) {
      let firstOpaqueX = -1;
      let lastOpaqueX = -1;
      for (let x = 0; x < size; x += 1) {
        const alpha = pixels[(y * size + x) * 4 + 3];
        if (alpha <= 0) {
          continue;
        }
        if (firstOpaqueX < 0) {
          firstOpaqueX = x;
        }
        lastOpaqueX = x;
      }
      if (firstOpaqueX < 0 || lastOpaqueX < 0) {
        continue;
      }
      rowHasOpaque[y] = true;
      const firstIndex = (y * size + firstOpaqueX) * 4;
      const lastIndex = (y * size + lastOpaqueX) * 4;
      for (let x = 0; x < firstOpaqueX; x += 1) {
        const index = (y * size + x) * 4;
        pixels[index] = pixels[firstIndex];
        pixels[index + 1] = pixels[firstIndex + 1];
        pixels[index + 2] = pixels[firstIndex + 2];
        pixels[index + 3] = pixels[firstIndex + 3];
      }
      for (let x = lastOpaqueX + 1; x < size; x += 1) {
        const index = (y * size + x) * 4;
        pixels[index] = pixels[lastIndex];
        pixels[index + 1] = pixels[lastIndex + 1];
        pixels[index + 2] = pixels[lastIndex + 2];
        pixels[index + 3] = pixels[lastIndex + 3];
      }
    }

    for (let y = 0; y < size; y += 1) {
      if (rowHasOpaque[y]) {
        continue;
      }
      let sourceRow = -1;
      for (let search = y - 1; search >= 0; search -= 1) {
        if (rowHasOpaque[search]) {
          sourceRow = search;
          break;
        }
      }
      if (sourceRow < 0) {
        for (let search = y + 1; search < size; search += 1) {
          if (rowHasOpaque[search]) {
            sourceRow = search;
            break;
          }
        }
      }
      if (sourceRow < 0) {
        continue;
      }
      for (let x = 0; x < size; x += 1) {
        const srcIndex = (sourceRow * size + x) * 4;
        const destIndex = (y * size + x) * 4;
        pixels[destIndex] = pixels[srcIndex];
        pixels[destIndex + 1] = pixels[srcIndex + 1];
        pixels[destIndex + 2] = pixels[srcIndex + 2];
        pixels[destIndex + 3] = pixels[srcIndex + 3];
      }
      rowHasOpaque[y] = true;
    }
  }

  solidifyVultureWallTexturePixels(
    pixels: Uint8ClampedArray,
    size: number,
  ): void {
    this.dilateOpaqueVultureWallPixels(pixels, size, 3);
    this.extendVultureWallOpaqueRunsToBorders(pixels, size);
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] <= 0) {
        continue;
      }
      pixels[index + 3] = 255;
    }
  }

  reprojectVultureWallTexture(
    context: CanvasRenderingContext2D,
    size: number,
    family: VultureProjectionDebugFamily,
    lookup: VultureTileLookup | null,
    doorProjectionSide: VultureDoorProjectionSide | null = null,
  ): void {
    const source = context.getImageData(0, 0, size, size);
    let sourcePixels: Uint8ClampedArray = source.data;
    if (this.dependencies.tilesetAssets.vultureTilesetTranslator && lookup) {
      const workCanvas = this.ensureVultureWallProjectionWorkCanvas(size);
      const workContext = workCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      if (workContext) {
        const drewRawSource =
          this.dependencies.tilesetAssets.vultureTilesetTranslator.drawLookupSourcePreview({
            context: workContext,
            size,
            lookup,
          });
        if (drewRawSource) {
          sourcePixels = workContext.getImageData(0, 0, size, size).data;
        }
      }
    }
    const destPixels = new Uint8ClampedArray(sourcePixels.length);
    const quad = this.getVultureWallProjectionQuad(family);
    const sizeMinusOne = Math.max(1, size - 1);
    let face: VultureWallFaceSlot | null = null;
    let rotationDegrees = this.getVultureFloorProjectionRotationDegrees();
    if (
      family === "door_open_ew" ||
      family === "door_open_sn" ||
      family === "door_closed_ew" ||
      family === "door_closed_sn"
    ) {
      const doorState: VultureDoorProjectionState =
        family === "door_open_ew" || family === "door_open_sn"
          ? "open"
          : "closed";
      const side: VultureDoorProjectionSide =
        doorProjectionSide === "back" ? "back" : "front";
      rotationDegrees = this.getVultureDoorProjectionRotationDegrees(
        doorState,
        side,
      );
      if (
        (family === "door_open_ew" || family === "door_closed_ew") &&
        side === "front"
      ) {
        // E/W back-facing door planes need an additional half turn to match
        // visual orientation with in-world left-side rendering.
        rotationDegrees = (rotationDegrees + 180) % 360;
      }
    } else if (family !== "floor") {
      face = this.resolveVultureWallProjectionFace(
        lookup as VultureWallProjectionLookup | null,
        family,
      );
      rotationDegrees = this.getVultureWallProjectionRotationDegrees(face);
    }

    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        const baseU = x / sizeMinusOne;
        const baseV = y / sizeMinusOne;
        const rotated = this.rotateVultureWallProjectionUv(
          baseU,
          baseV,
          rotationDegrees,
        );
        const u = rotated.u;
        const v = rotated.v;
        const srcU =
          (1 - u) * (1 - v) * quad.topLeft.x +
          u * (1 - v) * quad.topRight.x +
          u * v * quad.bottomRight.x +
          (1 - u) * v * quad.bottomLeft.x;
        const srcV =
          (1 - u) * (1 - v) * quad.topLeft.y +
          u * (1 - v) * quad.topRight.y +
          u * v * quad.bottomRight.y +
          (1 - u) * v * quad.bottomLeft.y;
        const srcX = THREE.MathUtils.clamp(
          Math.round(srcU * sizeMinusOne),
          0,
          sizeMinusOne,
        );
        const srcY = THREE.MathUtils.clamp(
          Math.round(srcV * sizeMinusOne),
          0,
          sizeMinusOne,
        );
        const srcIndex = (srcY * size + srcX) * 4;
        const destIndex = (y * size + x) * 4;
        destPixels[destIndex] = sourcePixels[srcIndex];
        destPixels[destIndex + 1] = sourcePixels[srcIndex + 1];
        destPixels[destIndex + 2] = sourcePixels[srcIndex + 2];
        destPixels[destIndex + 3] = sourcePixels[srcIndex + 3];
      }
    }

    // W/N wall sprites in this tileset are dark mask-like passes.
    // Preserving their original alpha avoids turning the entire plane into a
    // solid black quad during reprojection.
    if (family !== "floor" && (face === "east" || face === "south")) {
      this.solidifyVultureWallTexturePixels(destPixels, size);
    }

    source.data.set(destPixels);
    context.putImageData(source, 0, 0);
  }
}
