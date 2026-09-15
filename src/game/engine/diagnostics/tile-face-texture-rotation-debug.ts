import * as THREE from "three";
import type { NethackRuntimeVersion } from "../../../runtime/types";
import type { TileUpdates } from "../world/tile-updates";
import type {
  TileFaceTextureRotationOverrides,
  TileFaceTextureRotationTarget,
  TileFaceTextureSlot,
} from "../shared/types";
import {
  createDefaultTileFaceTextureRotationOverrides,
  NH3D_INTERNAL_TILE_FACE_TEXTURE_ROTATION_DEBUG_ENABLED,
  isLocalhostTileFaceTextureDebugEnabled,
  mergeTileFaceTextureRotationOverrides,
  normalizeTileFaceTextureRotationOverrides,
  serializeTileFaceTextureRotationOverrides,
  tileFaceTextureRotationsEndpoint,
  tileFaceTextureSlots,
} from "./tile-face-texture-rotation-data";

export interface TileFaceTextureRotationDebugDependencies {
  readonly tileUpdates: Pick<TileUpdates, "refreshTilesFromStateCache">;
}

/** Localhost-only per-tile-variant, per-world-face texture calibration. */
export class TileFaceTextureRotationDebug {
  constructor(
    private readonly dependencies: TileFaceTextureRotationDebugDependencies,
  ) {}

  rotationOverrides: TileFaceTextureRotationOverrides =
    createDefaultTileFaceTextureRotationOverrides();

  debugEnabled = NH3D_INTERNAL_TILE_FACE_TEXTURE_ROTATION_DEBUG_ENABLED;

  private loadPromise: Promise<void> | null = null;

  private persistPromise: Promise<void> = Promise.resolve();

  private readonly rotatedGeometryByKey = new Map<string, THREE.BufferGeometry>();

  isEnabled(): boolean {
    return this.debugEnabled && isLocalhostTileFaceTextureDebugEnabled();
  }

  buildVariantKey(
    runtimeVersion: NethackRuntimeVersion,
    tileIndex: number,
  ): string | null {
    const normalizedTileIndex = Math.trunc(tileIndex);
    if (!Number.isFinite(normalizedTileIndex) || normalizedTileIndex < 0) {
      return null;
    }
    return `${runtimeVersion}:tile:${normalizedTileIndex}`;
  }

  getRotationDegrees(variant: string, face: TileFaceTextureSlot): number {
    return this.rotationOverrides[variant]?.[face] ?? 0;
  }

  initialize(): void {
    if (!this.isEnabled() || this.loadPromise) {
      return;
    }
    this.loadPromise = fetch(tileFaceTextureRotationsEndpoint, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const loaded = normalizeTileFaceTextureRotationOverrides(
          await response.json(),
        );
        this.rotationOverrides = mergeTileFaceTextureRotationOverrides(
          createDefaultTileFaceTextureRotationOverrides(),
          loaded,
        );
        this.clearRotatedGeometryCache();
        this.dependencies.tileUpdates.refreshTilesFromStateCache();
      })
      .catch((error) => {
        console.warn("Failed to load tile face texture rotations:", error);
      });
  }

  resolveFaceFromWorldNormal(
    worldNormal: THREE.Vector3 | null,
  ): TileFaceTextureSlot | null {
    if (!worldNormal) {
      return null;
    }
    const absX = Math.abs(worldNormal.x);
    const absY = Math.abs(worldNormal.y);
    const absZ = Math.abs(worldNormal.z);
    if (![absX, absY, absZ].every(Number.isFinite)) {
      return null;
    }
    if (absZ >= absX && absZ >= absY) {
      return worldNormal.z >= 0 ? "top" : "bottom";
    }
    if (absX >= absY) {
      return worldNormal.x >= 0 ? "east" : "west";
    }
    return worldNormal.y >= 0 ? "north" : "south";
  }

  resolveTarget(
    mesh: THREE.Mesh,
    worldNormal: THREE.Vector3 | null,
  ): TileFaceTextureRotationTarget | null {
    if (!this.isEnabled()) {
      return null;
    }
    const variant =
      typeof mesh.userData?.tileFaceTextureVariant === "string"
        ? mesh.userData.tileFaceTextureVariant
        : "";
    const tileIndex = Number(mesh.userData?.tileIndex);
    const face = this.resolveFaceFromWorldNormal(worldNormal);
    if (!variant || !Number.isFinite(tileIndex) || tileIndex < 0 || !face) {
      return null;
    }
    return {
      variant,
      tileIndex: Math.trunc(tileIndex),
      face,
      rotationDegrees: this.getRotationDegrees(variant, face),
    };
  }

  resolveGeometry(
    baseGeometry: THREE.BufferGeometry,
    variant: string | null,
  ): THREE.BufferGeometry {
    if (!variant) {
      return baseGeometry;
    }
    const rotations = this.rotationOverrides[variant];
    if (!rotations || Object.keys(rotations).length === 0) {
      return baseGeometry;
    }
    const signature = tileFaceTextureSlots
      .map((face) => this.getRotationDegrees(variant, face))
      .join(",");
    const cacheKey = `${baseGeometry.uuid}|${variant}|${signature}`;
    const cached = this.rotatedGeometryByKey.get(cacheKey);
    if (cached) {
      return cached;
    }

    const geometry = baseGeometry.clone();
    const uv = geometry.getAttribute("uv");
    const normal = geometry.getAttribute("normal");
    if (!(uv instanceof THREE.BufferAttribute) || !(normal instanceof THREE.BufferAttribute)) {
      geometry.dispose();
      return baseGeometry;
    }
    const vertexNormal = new THREE.Vector3();
    for (let index = 0; index < uv.count; index += 1) {
      vertexNormal.fromBufferAttribute(normal, index);
      const face = this.resolveFaceFromWorldNormal(vertexNormal);
      const quarterTurns = face
        ? Math.trunc(this.getRotationDegrees(variant, face) / 90)
        : 0;
      let u = uv.getX(index);
      let v = uv.getY(index);
      for (let turn = 0; turn < quarterTurns; turn += 1) {
        const previousU = u;
        u = v;
        v = 1 - previousU;
      }
      uv.setXY(index, u, v);
    }
    uv.needsUpdate = true;
    this.rotatedGeometryByKey.set(cacheKey, geometry);
    return geometry;
  }

  cycleRotation(target: TileFaceTextureRotationTarget): void {
    if (!this.isEnabled()) {
      return;
    }
    const current = this.getRotationDegrees(target.variant, target.face);
    const next = (current + 90) % 360;
    const nextFaces = { ...(this.rotationOverrides[target.variant] ?? {}) };
    if (next === 0) {
      delete nextFaces[target.face];
    } else {
      nextFaces[target.face] = next;
    }
    if (Object.keys(nextFaces).length === 0) {
      delete this.rotationOverrides[target.variant];
    } else {
      this.rotationOverrides[target.variant] = nextFaces;
    }
    this.clearRotatedGeometryCache();
    this.dependencies.tileUpdates.refreshTilesFromStateCache();
    this.persist();
  }

  private persist(): void {
    const payload = serializeTileFaceTextureRotationOverrides(
      this.rotationOverrides,
    );
    this.persistPromise = this.persistPromise
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch(tileFaceTextureRotationsEndpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      })
      .catch((error) => {
        console.warn("Failed to save tile face texture rotations:", error);
      });
  }

  clearRotatedGeometryCache(): void {
    for (const geometry of this.rotatedGeometryByKey.values()) {
      geometry.dispose();
    }
    this.rotatedGeometryByKey.clear();
  }
}
