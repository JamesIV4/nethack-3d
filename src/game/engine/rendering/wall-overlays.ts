import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import { getOpenDoorGlyphFrom, isVerticalDoorCmapGlyph } from "../../glyphs/behavior";
import type { TileMaterialKind } from "../../glyphs";
import { type VultureTileLookup } from "../../vulture/translation";
import type {
  WallSideTileOverlay,
  WallSideTileRotation,
  VultureWallFaceSlot,
  VultureWallFaceOverlay,
  VultureWallPlaneSlice,
  VultureWallPlaneOverlay,
  VultureDoorPlaneOverlay,
  TransparentWallGroundPlaneOverlay,
  IronBarsWallPlaneOverlay,
  VultureWallProjectionFamily,
  VultureDoorProjectionState,
  VultureWallProjectionLookup
} from "../shared/types";
import type { EngineState } from "../runtime/engine-state";
import type { GlyphTextures } from "./glyph-textures";
import type { Lighting } from "./lighting";
import type { MovementInput } from "../input/movement-input";
import type { TileRendering } from "./tile-rendering";
import type { TilesetAssets } from "./tileset-assets";
import type { VultureProjection } from "./vulture-projection";

export interface WallOverlaysDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "acquireGlyphTexture"
    | "createTileTexture"
    | "glyphTextureCache"
    | "releaseGlyphTexture"
  >;
  readonly lighting: Pick<
    Lighting,
    "patchMaterialForVignette"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "floorGeometry"
    | "tileMap"
    | "tileVisualScaleFps"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "vultureTilesetTranslator"
  >;
  readonly vultureProjection: Pick<
    VultureProjection,
    "getVultureDoorProjectionRotationDegrees"
    | "getVultureWallProjectionRotationDegrees"
  >;
}

/** Auxiliary wall, transparent floor, iron-bar and Vulture door-plane mesh ownership */
export class WallOverlays {
  constructor(private readonly dependencies: WallOverlaysDependencies) {}

  readonly vultureDoorPlaneOverlayMeshes: Set<THREE.Mesh> = new Set();

  readonly ironBarsWallPlaneOverlayMeshes: Set<THREE.Mesh> = new Set();

  readonly vultureFrontWallPlaneRenderOrder: number = 914;

  readonly vultureBackWallPlaneRenderOrder: number = 916;

  readonly vultureWallPlaneGeometry = (() => {
    const geometry = new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT);
    // Make walls vertical with height mapped to world Z.
    geometry.rotateX(Math.PI / 2);
    return geometry;
  })();

  readonly vultureDoorPlaneGeometry = new THREE.PlaneGeometry(
    TILE_SIZE,
    WALL_HEIGHT,
  );

  readonly transparentWallGroundPlaneGeometry = new THREE.PlaneGeometry(
    TILE_SIZE,
    TILE_SIZE,
  );

  readonly vultureInvisibleSurfaceMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

  getAllWallSideTileOverlays(mesh: THREE.Mesh): WallSideTileOverlay[] {
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

  disposeWallSideTileOverlay(
    mesh: THREE.Mesh,
    rotation?: WallSideTileRotation,
  ): void {
    if (rotation) {
      const overlays = mesh.userData?.wallSideTileOverlays as
        | Partial<Record<WallSideTileRotation, WallSideTileOverlay>>
        | undefined;
      const overlay = overlays?.[rotation];
      if (overlay) {
        this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
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
      this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
      overlay.material.dispose();
    }
    delete mesh.userData.wallSideTileOverlays;
  }

  getAllVultureWallFaceOverlays(
    mesh: THREE.Mesh,
  ): VultureWallFaceOverlay[] {
    const overlays = mesh.userData?.vultureWallFaceOverlays as
      | Partial<Record<VultureWallFaceSlot, VultureWallFaceOverlay>>
      | undefined;
    if (!overlays) {
      return [];
    }
    const results: VultureWallFaceOverlay[] = [];
    for (const face of ["west", "north", "east", "south"] as const) {
      const overlay = overlays[face];
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

  applyRevealOpacityToAuxiliaryOverlays(
    mesh: THREE.Mesh,
    opacity: number,
  ): void {
    const clampedOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    for (const sideOverlay of this.getAllWallSideTileOverlays(mesh)) {
      sideOverlay.material.opacity = clampedOpacity;
    }
    for (const faceOverlay of this.getAllVultureWallFaceOverlays(mesh)) {
      faceOverlay.material.opacity = clampedOpacity;
    }
    const doorOverlay = mesh.userData?.vultureDoorPlaneOverlay as
      | VultureDoorPlaneOverlay
      | undefined;
    if (doorOverlay) {
      doorOverlay.frontMaterial.opacity = clampedOpacity;
      doorOverlay.backMaterial.opacity = clampedOpacity;
      doorOverlay.floorMaterial.opacity = clampedOpacity;
    }
    const transparentWallGroundOverlay = mesh.userData
      ?.transparentWallGroundPlaneOverlay as
      | TransparentWallGroundPlaneOverlay
      | undefined;
    if (transparentWallGroundOverlay) {
      transparentWallGroundOverlay.material.opacity = clampedOpacity;
    }
    const ironBarsOverlay = mesh.userData?.ironBarsWallPlaneOverlay as
      | IronBarsWallPlaneOverlay
      | undefined;
    if (ironBarsOverlay) {
      ironBarsOverlay.material.opacity = clampedOpacity;
    }
  }

  disposeTransparentWallGroundPlaneOverlay(mesh: THREE.Mesh): void {
    const overlay = mesh.userData?.transparentWallGroundPlaneOverlay as
      | TransparentWallGroundPlaneOverlay
      | undefined;
    if (!overlay) {
      return;
    }
    this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
    mesh.remove(overlay.floorMesh);
    overlay.material.dispose();
    delete mesh.userData.transparentWallGroundPlaneOverlay;
  }

  ensureTransparentWallGroundPlaneOverlay(
    mesh: THREE.Mesh,
  ): TransparentWallGroundPlaneOverlay {
    let overlay = mesh.userData?.transparentWallGroundPlaneOverlay as
      | TransparentWallGroundPlaneOverlay
      | undefined;
    if (overlay) {
      return overlay;
    }
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.dependencies.lighting.patchMaterialForVignette(material);
    const floorMesh = new THREE.Mesh(
      this.transparentWallGroundPlaneGeometry,
      material,
    );
    floorMesh.castShadow = false;
    floorMesh.receiveShadow = false;
    mesh.add(floorMesh);
    overlay = {
      floorMesh,
      material,
      textureKey: "",
    };
    mesh.userData.transparentWallGroundPlaneOverlay = overlay;
    return overlay;
  }

  applyTransparentWallGroundPlaneOverlay(
    mesh: THREE.Mesh,
    floorGlyph: number,
    floorTileIndex: number,
    floorMaterialKind: TileMaterialKind | null,
    darkenFactor: number,
    opacity: number,
    useBackgroundReferenceTile: boolean = false,
  ): void {
    const overlay = this.ensureTransparentWallGroundPlaneOverlay(mesh);
    const normalizedFloorGlyph = Number.isFinite(floorGlyph)
      ? Math.trunc(floorGlyph)
      : -1;
    const normalizedFloorTileIndex = Number.isFinite(floorTileIndex)
      ? Math.trunc(floorTileIndex)
      : -1;
    const materialKindKey = floorMaterialKind ?? "none";
    const backgroundReferenceTileKey = useBackgroundReferenceTile
      ? "bgref:1"
      : "bgref:0";
    const textureKey = `wall-ground-plane:${normalizedFloorTileIndex}|sg:${normalizedFloorGlyph}|mk:${materialKindKey}|${backgroundReferenceTileKey}|${darkenFactor.toFixed(3)}`;
    const needsTextureRefresh =
      overlay.textureKey !== textureKey ||
      !this.dependencies.glyphTextures.glyphTextureCache.has(textureKey);
    if (needsTextureRefresh) {
      if (overlay.textureKey) {
        this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
      }
      const texture = this.dependencies.glyphTextures.acquireGlyphTexture(textureKey, () =>
        this.dependencies.glyphTextures.createTileTexture(normalizedFloorTileIndex, darkenFactor, false, {
          sourceGlyph: normalizedFloorGlyph,
          materialKind: floorMaterialKind,
          useBackgroundReferenceTile,
        }),
      );
      overlay.material.map = texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }
    overlay.material.color.set("#ffffff");
    overlay.material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    const planeZ = this.getTransparentWallGroundPlaneLocalZForWorldFloor(mesh);
    overlay.floorMesh.rotation.set(0, 0, 0, "XYZ");
    overlay.floorMesh.position.set(0, 0, planeZ);
    overlay.floorMesh.scale.set(1, 1, 1);
    overlay.floorMesh.renderOrder = mesh.renderOrder - 0.25;
  }

  getTransparentWallGroundPlaneLocalZForWorldFloor(
    mesh: THREE.Mesh,
  ): number {
    const parentScaleZ =
      typeof mesh.scale?.z === "number" &&
      Number.isFinite(mesh.scale.z) &&
      Math.abs(mesh.scale.z) > 0.0001
        ? mesh.scale.z
        : 1;
    const parentWorldZ =
      typeof mesh.position?.z === "number" && Number.isFinite(mesh.position.z)
        ? mesh.position.z
        : WALL_HEIGHT / 2;
    return -parentWorldZ / parentScaleZ;
  }

  alignTransparentWallGroundPlaneOverlayToTile(
    mesh: THREE.Mesh,
    offsetX: number,
    offsetY: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const overlay = mesh.userData?.transparentWallGroundPlaneOverlay as
      | TransparentWallGroundPlaneOverlay
      | undefined;
    if (!overlay) {
      return;
    }
    const safeScaleX =
      typeof scaleX === "number" &&
      Number.isFinite(scaleX) &&
      Math.abs(scaleX) > 0.0001
        ? scaleX
        : 1;
    const safeScaleY =
      typeof scaleY === "number" &&
      Number.isFinite(scaleY) &&
      Math.abs(scaleY) > 0.0001
        ? scaleY
        : 1;
    const parentScaleX =
      typeof mesh.scale?.x === "number" &&
      Number.isFinite(mesh.scale.x) &&
      Math.abs(mesh.scale.x) > 0.0001
        ? mesh.scale.x
        : safeScaleX;
    const parentScaleY =
      typeof mesh.scale?.y === "number" &&
      Number.isFinite(mesh.scale.y) &&
      Math.abs(mesh.scale.y) > 0.0001
        ? mesh.scale.y
        : safeScaleY;
    const desiredWorldFloorScale =
      this.dependencies.movementInput.isFpsMode() &&
      typeof this.dependencies.tileRendering.tileVisualScaleFps === "number" &&
      Number.isFinite(this.dependencies.tileRendering.tileVisualScaleFps) &&
      Math.abs(this.dependencies.tileRendering.tileVisualScaleFps) > 0.0001
        ? this.dependencies.tileRendering.tileVisualScaleFps
        : 1;
    const planeZ = this.getTransparentWallGroundPlaneLocalZForWorldFloor(mesh);
    // Counteract parent door transform so the underlay stays tile-aligned.
    overlay.floorMesh.position.set(
      -offsetX / parentScaleX,
      -offsetY / parentScaleY,
      planeZ,
    );
    overlay.floorMesh.scale.set(
      desiredWorldFloorScale / parentScaleX,
      desiredWorldFloorScale / parentScaleY,
      1,
    );
  }

  setTransparentWallGroundPlaneOverlayOpaqueMode(
    mesh: THREE.Mesh,
    opaque: boolean,
  ): void {
    const overlay = mesh.userData?.transparentWallGroundPlaneOverlay as
      | TransparentWallGroundPlaneOverlay
      | undefined;
    if (!overlay) {
      return;
    }
    const material = overlay.material;
    const nextTransparent = !opaque;
    let needsUpdate = false;
    if (material.transparent !== nextTransparent) {
      material.transparent = nextTransparent;
      needsUpdate = true;
    }
    const nextOpacity = opaque ? 1 : material.opacity;
    if (Math.abs(material.opacity - nextOpacity) > 0.0001) {
      material.opacity = nextOpacity;
    }
    if (needsUpdate) {
      material.needsUpdate = true;
    }
  }

  disposeIronBarsWallPlaneOverlay(mesh: THREE.Mesh): void {
    const overlay = mesh.userData?.ironBarsWallPlaneOverlay as
      | IronBarsWallPlaneOverlay
      | undefined;
    if (!overlay) {
      return;
    }
    this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
    mesh.remove(overlay.frontMesh);
    mesh.remove(overlay.backMesh);
    overlay.material.dispose();
    delete mesh.userData.ironBarsWallPlaneOverlay;
    this.ironBarsWallPlaneOverlayMeshes.delete(mesh);
  }

  ensureIronBarsWallPlaneOverlay(
    mesh: THREE.Mesh,
  ): IronBarsWallPlaneOverlay {
    const existing = mesh.userData?.ironBarsWallPlaneOverlay as
      | IronBarsWallPlaneOverlay
      | undefined;
    if (existing) {
      return existing;
    }
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
      alphaTest: 0.01,
      toneMapped: false,
    });
    this.dependencies.lighting.patchMaterialForVignette(material);
    const frontMesh = new THREE.Mesh(this.vultureDoorPlaneGeometry, material);
    const backMesh = new THREE.Mesh(this.vultureDoorPlaneGeometry, material);
    frontMesh.castShadow = false;
    frontMesh.receiveShadow = false;
    backMesh.castShadow = false;
    backMesh.receiveShadow = false;
    mesh.add(frontMesh);
    mesh.add(backMesh);
    const overlay: IronBarsWallPlaneOverlay = {
      frontMesh,
      backMesh,
      material,
      textureKey: "",
    };
    mesh.userData.ironBarsWallPlaneOverlay = overlay;
    this.ironBarsWallPlaneOverlayMeshes.add(mesh);
    return overlay;
  }

  applyIronBarsWallPlaneOverlay(
    mesh: THREE.Mesh,
    tileIndex: number,
    sourceGlyph: number | null,
    materialKind: TileMaterialKind | null,
    darkenFactor: number,
    opacity: number,
  ): void {
    const overlay = this.ensureIronBarsWallPlaneOverlay(mesh);
    const normalizedSourceGlyph =
      typeof sourceGlyph === "number" && Number.isFinite(sourceGlyph)
        ? Math.trunc(sourceGlyph)
        : null;
    const normalizedTileIndex =
      Number.isFinite(tileIndex) && tileIndex >= 0 ? Math.trunc(tileIndex) : -1;
    const materialKindKey = materialKind ?? "none";
    const textureKey = `iron-bars-plane:${normalizedTileIndex}|sg:${normalizedSourceGlyph ?? "none"}|mk:${materialKindKey}|${darkenFactor.toFixed(3)}|bg:${this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode}`;
    if (
      overlay.textureKey !== textureKey ||
      !this.dependencies.glyphTextures.glyphTextureCache.has(textureKey)
    ) {
      if (overlay.textureKey) {
        this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
      }
      const texture = this.dependencies.glyphTextures.acquireGlyphTexture(textureKey, () =>
        this.dependencies.glyphTextures.createTileTexture(normalizedTileIndex, darkenFactor, false, {
          sourceGlyph: normalizedSourceGlyph,
          materialKind,
          forceBackgroundRemoval:
            this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode !== "none",
        }),
      );
      overlay.material.map = texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }
    overlay.material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    overlay.material.color.set("#ffffff");
    const epsilon = TILE_SIZE * 0.003;
    overlay.frontMesh.rotation.set(-Math.PI / 2, 0, 0, "XYZ");
    overlay.backMesh.rotation.set(Math.PI / 2, 0, 0, "XYZ");
    overlay.frontMesh.position.set(0, -TILE_SIZE / 2 + epsilon, 0);
    overlay.backMesh.position.set(0, TILE_SIZE / 2 - epsilon, 0);
    overlay.frontMesh.renderOrder = mesh.renderOrder + 0.1;
    overlay.backMesh.renderOrder = mesh.renderOrder + 0.1;
  }

  disposeVultureWallFaceOverlay(
    mesh: THREE.Mesh,
    face?: VultureWallFaceSlot,
  ): void {
    if (face) {
      const overlays = mesh.userData?.vultureWallFaceOverlays as
        | Partial<Record<VultureWallFaceSlot, VultureWallFaceOverlay>>
        | undefined;
      const overlay = overlays?.[face];
      if (overlay) {
        this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
        overlay.material.dispose();
        if (overlays) {
          delete overlays[face];
          if (
            !overlays.west &&
            !overlays.north &&
            !overlays.east &&
            !overlays.south
          ) {
            delete mesh.userData.vultureWallFaceOverlays;
          }
        }
      }
      return;
    }

    for (const overlay of this.getAllVultureWallFaceOverlays(mesh)) {
      this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
      overlay.material.dispose();
    }
    delete mesh.userData.vultureWallFaceOverlays;
  }

  disposeVultureWallPlaneOverlay(
    mesh: THREE.Mesh,
    direction?: VultureWallFaceSlot,
  ): void {
    const overlay = mesh.userData?.vultureWallPlaneOverlay as
      | VultureWallPlaneOverlay
      | undefined;
    if (!overlay) {
      return;
    }

    const disposeDirection = (face: VultureWallFaceSlot): void => {
      const slice = overlay[face];
      if (!slice) {
        return;
      }
      mesh.remove(slice.frontMesh);
      mesh.remove(slice.backMesh);
      delete overlay[face];
    };

    if (direction) {
      disposeDirection(direction);
      if (!overlay.west && !overlay.north && !overlay.east && !overlay.south) {
        delete mesh.userData.vultureWallPlaneOverlay;
      }
      return;
    }

    for (const face of ["west", "north", "east", "south"] as const) {
      disposeDirection(face);
    }
    delete mesh.userData.vultureWallPlaneOverlay;
  }

  ensureVultureWallPlaneSlice(
    mesh: THREE.Mesh,
    direction: VultureWallFaceSlot,
  ): VultureWallPlaneSlice {
    let overlay = mesh.userData?.vultureWallPlaneOverlay as
      | VultureWallPlaneOverlay
      | undefined;
    if (!overlay) {
      overlay = {};
      mesh.userData.vultureWallPlaneOverlay = overlay;
    }

    const existingSlice = overlay[direction];
    if (existingSlice) {
      return existingSlice;
    }

    const frontMesh = new THREE.Mesh(
      this.vultureWallPlaneGeometry,
      this.vultureInvisibleSurfaceMaterial,
    );
    const backMesh = new THREE.Mesh(
      this.vultureWallPlaneGeometry,
      this.vultureInvisibleSurfaceMaterial,
    );
    frontMesh.renderOrder = this.vultureFrontWallPlaneRenderOrder;
    backMesh.renderOrder = this.vultureBackWallPlaneRenderOrder;
    this.applyVultureWallPlaneFaceTransform(frontMesh, direction);
    this.applyVultureWallPlaneFaceTransform(backMesh, direction);
    mesh.add(frontMesh);
    mesh.add(backMesh);

    const slice: VultureWallPlaneSlice = {
      frontMesh,
      backMesh,
    };
    overlay[direction] = slice;
    return slice;
  }

  applyVultureWallPlaneFaceTransform(
    planeMesh: THREE.Object3D,
    face: VultureWallFaceSlot,
    invertNormal: boolean = false,
    offsetFromCenter: number | null = null,
  ): void {
    const epsilon = TILE_SIZE * 0.003;
    const half =
      typeof offsetFromCenter === "number" && Number.isFinite(offsetFromCenter)
        ? Math.max(0, offsetFromCenter)
        : TILE_SIZE / 2 - epsilon;
    let rotationZ = 0;
    let posX = 0;
    let posY = 0;
    switch (face) {
      case "east":
        rotationZ = Math.PI / 2;
        posX = half;
        break;
      case "west":
        rotationZ = -Math.PI / 2;
        posX = -half;
        break;
      case "north":
        rotationZ = Math.PI;
        posY = half;
        break;
      case "south":
      default:
        rotationZ = 0;
        posY = -half;
        break;
    }
    if (invertNormal) {
      rotationZ += Math.PI;
    }
    planeMesh.rotation.set(0, 0, rotationZ, "XYZ");
    planeMesh.position.set(posX, posY, 0);
  }

  applyVultureWallPlaneSliceTransform(
    slice: VultureWallPlaneSlice,
    direction: VultureWallFaceSlot,
  ): void {
    this.applyVultureWallPlaneFaceTransform(slice.frontMesh, direction, false);
    this.applyVultureWallPlaneFaceTransform(slice.backMesh, direction, true);
    slice.frontMesh.scale.set(1, 1, 1);
    slice.backMesh.scale.set(1, 1, 1);
  }

  disposeVultureDoorPlaneOverlay(mesh: THREE.Mesh): void {
    const overlay = mesh.userData?.vultureDoorPlaneOverlay as
      | VultureDoorPlaneOverlay
      | undefined;
    if (!overlay) {
      return;
    }
    this.dependencies.glyphTextures.releaseGlyphTexture(overlay.frontTextureKey);
    this.dependencies.glyphTextures.releaseGlyphTexture(overlay.backTextureKey);
    this.dependencies.glyphTextures.releaseGlyphTexture(overlay.floorTextureKey);
    mesh.remove(overlay.frontMesh);
    mesh.remove(overlay.backMesh);
    mesh.remove(overlay.floorMesh);
    overlay.frontMaterial.dispose();
    overlay.backMaterial.dispose();
    overlay.floorMaterial.dispose();
    delete mesh.userData.vultureDoorPlaneOverlay;
    this.vultureDoorPlaneOverlayMeshes.delete(mesh);
  }

  ensureVultureDoorPlaneOverlay(
    mesh: THREE.Mesh,
  ): VultureDoorPlaneOverlay {
    const existing = mesh.userData?.vultureDoorPlaneOverlay as
      | VultureDoorPlaneOverlay
      | undefined;
    if (existing) {
      return existing;
    }
    const frontMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide,
      depthWrite: false,
      depthTest: true,
    });
    const backMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide,
      depthWrite: false,
      depthTest: true,
    });
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide,
      depthWrite: false,
      depthTest: true,
    });
    this.dependencies.lighting.patchMaterialForVignette(frontMaterial);
    this.dependencies.lighting.patchMaterialForVignette(backMaterial);
    this.dependencies.lighting.patchMaterialForVignette(floorMaterial);
    const frontMesh = new THREE.Mesh(
      this.vultureDoorPlaneGeometry,
      frontMaterial,
    );
    const backMesh = new THREE.Mesh(
      this.vultureDoorPlaneGeometry,
      backMaterial,
    );
    const floorMesh = new THREE.Mesh(this.dependencies.tileRendering.floorGeometry, floorMaterial);
    frontMesh.renderOrder = this.vultureFrontWallPlaneRenderOrder;
    backMesh.renderOrder = this.vultureBackWallPlaneRenderOrder;
    floorMesh.renderOrder = this.vultureFrontWallPlaneRenderOrder - 1;
    const floorPlaneZ = -WALL_HEIGHT / 2 + TILE_SIZE * 0.003;
    floorMesh.position.set(0, 0, floorPlaneZ);
    mesh.add(frontMesh);
    mesh.add(backMesh);
    mesh.add(floorMesh);
    const overlay: VultureDoorPlaneOverlay = {
      frontMesh,
      backMesh,
      floorMesh,
      frontTextureKey: "",
      backTextureKey: "",
      floorTextureKey: "",
      frontMaterial,
      backMaterial,
      floorMaterial,
      doorOrientation: "sn",
    };
    mesh.userData.vultureDoorPlaneOverlay = overlay;
    this.vultureDoorPlaneOverlayMeshes.add(mesh);
    return overlay;
  }

  applyVultureDoorPlaneTransforms(
    overlay: VultureDoorPlaneOverlay,
    family: VultureWallProjectionFamily,
    centerPlane: boolean = false,
  ): void {
    const epsilon = TILE_SIZE * 0.003;
    if (family === "ew") {
      if (centerPlane) {
        // Keep the same orientation as closed-door planes, just centered.
        overlay.frontMesh.rotation.set(Math.PI / 2, Math.PI / 2, 0, "XYZ");
        overlay.backMesh.rotation.set(Math.PI / 2, -Math.PI / 2, 0, "XYZ");
        overlay.frontMesh.position.set(0, 0, 0);
        overlay.backMesh.position.set(0, 0, 0);
      } else {
        overlay.frontMesh.rotation.set(Math.PI / 2, Math.PI / 2, 0, "XYZ");
        overlay.backMesh.rotation.set(Math.PI / 2, -Math.PI / 2, 0, "XYZ");
        overlay.frontMesh.position.set(epsilon, 0, 0);
        overlay.backMesh.position.set(-epsilon, 0, 0);
      }
      return;
    }
    overlay.frontMesh.rotation.set(-Math.PI / 2, 0, 0, "XYZ");
    overlay.backMesh.rotation.set(Math.PI / 2, 0, 0, "XYZ");
    if (centerPlane) {
      overlay.frontMesh.position.set(0, 0, 0);
      overlay.backMesh.position.set(0, 0, 0);
    } else {
      overlay.frontMesh.position.set(0, -epsilon, 0);
      overlay.backMesh.position.set(0, epsilon, 0);
    }
  }

  applyVultureDoorPlaneTexture(
    overlay: VultureDoorPlaneOverlay,
    side: "front" | "back",
    doorState: VultureDoorProjectionState,
    lookup: VultureWallProjectionLookup,
    family: VultureWallProjectionFamily,
    darkenFactor: number,
    opacity: number,
  ): void {
    const rotation = this.dependencies.vultureProjection.getVultureDoorProjectionRotationDegrees(
      doorState,
      side,
    );
    const textureKey = `vdoor:${doorState}:${side}|${lookup.category}.${lookup.name}|axis:${family}|rot:${rotation}|${darkenFactor.toFixed(3)}`;
    const currentTextureKey =
      side === "front" ? overlay.frontTextureKey : overlay.backTextureKey;
    if (
      currentTextureKey !== textureKey ||
      !this.dependencies.glyphTextures.glyphTextureCache.has(textureKey)
    ) {
      if (currentTextureKey) {
        this.dependencies.glyphTextures.releaseGlyphTexture(currentTextureKey);
      }
      const texture = this.dependencies.glyphTextures.acquireGlyphTexture(textureKey, () =>
        this.dependencies.glyphTextures.createTileTexture(-1, darkenFactor, false, {
          sourceGlyph: null,
          materialKind: "door",
          vultureLookup: lookup,
          projectionFamilyOverride: family,
          doorProjection: {
            state: doorState,
            side,
            orientation: family,
          },
        }),
      );
      if (side === "front") {
        overlay.frontTextureKey = textureKey;
        overlay.frontMaterial.map = texture;
        overlay.frontMaterial.needsUpdate = true;
      } else {
        overlay.backTextureKey = textureKey;
        overlay.backMaterial.map = texture;
        overlay.backMaterial.needsUpdate = true;
      }
    }
    const material =
      side === "front" ? overlay.frontMaterial : overlay.backMaterial;
    const useFpsDepthOcclusion = this.dependencies.movementInput.isFpsMode();
    const depthAlphaTest = useFpsDepthOcclusion ? 0.01 : 0;
    if (
      material.depthWrite !== useFpsDepthOcclusion ||
      material.depthTest !== true ||
      Math.abs(material.alphaTest - depthAlphaTest) > 0.0001
    ) {
      material.depthWrite = useFpsDepthOcclusion;
      material.depthTest = true;
      material.alphaTest = depthAlphaTest;
      material.needsUpdate = true;
    }
    material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    material.color.set("#ffffff");
  }

  applyVultureDoorFloorTexture(
    overlay: VultureDoorPlaneOverlay,
    lookup: VultureTileLookup,
    darkenFactor: number,
    opacity: number,
  ): void {
    const textureKey = `vdoorfloor:${lookup.category}.${lookup.name}|${darkenFactor.toFixed(3)}`;
    const currentTextureKey = overlay.floorTextureKey;
    if (
      currentTextureKey !== textureKey ||
      !this.dependencies.glyphTextures.glyphTextureCache.has(textureKey)
    ) {
      if (currentTextureKey) {
        this.dependencies.glyphTextures.releaseGlyphTexture(currentTextureKey);
      }
      const texture = this.dependencies.glyphTextures.acquireGlyphTexture(textureKey, () =>
        this.dependencies.glyphTextures.createTileTexture(-1, darkenFactor, false, {
          sourceGlyph: null,
          materialKind: "floor",
          vultureLookup: lookup,
        }),
      );
      overlay.floorTextureKey = textureKey;
      overlay.floorMaterial.map = texture;
      overlay.floorMaterial.needsUpdate = true;
    }
    overlay.floorMaterial.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    overlay.floorMaterial.color.set("#ffffff");
  }

  applyVultureDoorPlane(
    mesh: THREE.Mesh,
    sourceGlyph: number | null,
    tileIndex: number,
    wallX: number | null,
    wallY: number | null,
    darkenFactor: number,
    opacity: number,
    wallOrientationChar: "|" | "-" | null,
    centerPlane: boolean = false,
    anchorFloorToWall: boolean = true,
  ): boolean {
    const translator = this.dependencies.tilesetAssets.vultureTilesetTranslator;
    if (!translator) {
      this.disposeVultureDoorPlaneOverlay(mesh);
      return false;
    }
    const family: VultureWallProjectionFamily =
      sourceGlyph !== null
        ? isVerticalDoorCmapGlyph(sourceGlyph)
          ? "ew"
          : "sn"
        : wallOrientationChar === "|"
          ? "ew"
          : "sn";
    const lookup = translator.resolveLookupForTile({
      glyph: sourceGlyph ?? -1,
      tileIndex: tileIndex >= 0 ? tileIndex : null,
      materialKind: "door",
      forBillboard: false,
    });
    if (!lookup) {
      this.disposeVultureDoorPlaneOverlay(mesh);
      return false;
    }
    const frontFace: VultureWallFaceSlot = family === "ew" ? "east" : "south";
    const backFace: VultureWallFaceSlot = family === "ew" ? "west" : "north";
    const frontLookup: VultureWallProjectionLookup = {
      ...lookup,
      wallFace: frontFace,
    };
    const backLookup: VultureWallProjectionLookup = {
      ...lookup,
      wallFace: backFace,
    };
    const doorState: VultureDoorProjectionState =
      sourceGlyph !== null && getOpenDoorGlyphFrom(sourceGlyph) === sourceGlyph
        ? "open"
        : "closed";
    // Doorway floor planes in Vulture should always use the rough-floor family.
    const floorLookup = translator.resolveDoorwayFloorLookup(wallX, wallY);
    const overlay = this.ensureVultureDoorPlaneOverlay(mesh);
    overlay.doorOrientation = family;
    const floorPlaneZ = anchorFloorToWall
      ? -WALL_HEIGHT / 2 + TILE_SIZE * 0.003
      : TILE_SIZE * 0.003;
    overlay.floorMesh.position.set(0, 0, floorPlaneZ);
    this.applyVultureDoorPlaneTransforms(overlay, family, centerPlane);
    const doorwayPlaneZ = anchorFloorToWall ? 0 : WALL_HEIGHT / 2;
    overlay.frontMesh.position.z = doorwayPlaneZ;
    overlay.backMesh.position.z = doorwayPlaneZ;
    this.applyVultureDoorPlaneTexture(
      overlay,
      "front",
      doorState,
      frontLookup,
      family,
      darkenFactor,
      opacity,
    );
    this.applyVultureDoorPlaneTexture(
      overlay,
      "back",
      doorState,
      backLookup,
      family,
      darkenFactor,
      opacity,
    );
    this.applyVultureDoorFloorTexture(
      overlay,
      floorLookup,
      darkenFactor,
      opacity,
    );
    return true;
  }

  ensureVultureWallFaceOverlayMaterial(
    mesh: THREE.Mesh,
    face: VultureWallFaceSlot,
    lookup: VultureWallProjectionLookup,
    darkenFactor: number,
    opacity: number,
  ): THREE.MeshBasicMaterial {
    let overlays = mesh.userData?.vultureWallFaceOverlays as
      | Partial<Record<VultureWallFaceSlot, VultureWallFaceOverlay>>
      | undefined;
    if (!overlays) {
      overlays = {};
      mesh.userData.vultureWallFaceOverlays = overlays;
    }

    let overlay = overlays[face];
    if (!overlay) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
      });
      this.dependencies.lighting.patchMaterialForVignette(material);
      overlay = {
        textureKey: "",
        material,
      };
      overlays[face] = overlay;
    }

    const rotation = this.dependencies.vultureProjection.getVultureWallProjectionRotationDegrees(face);
    const textureKey = `vwall:${lookup.category}.${lookup.name}|face:${face}|rot:${rotation}|${darkenFactor.toFixed(3)}`;
    const needsTextureRefresh =
      overlay.textureKey !== textureKey ||
      !this.dependencies.glyphTextures.glyphTextureCache.has(textureKey);
    if (needsTextureRefresh) {
      if (overlay.textureKey) {
        this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
      }
      const projectionLookup: VultureWallProjectionLookup = {
        ...lookup,
        wallFace: face,
      };
      const texture = this.dependencies.glyphTextures.acquireGlyphTexture(textureKey, () =>
        this.dependencies.glyphTextures.createTileTexture(-1, darkenFactor, false, {
          sourceGlyph: null,
          materialKind: null,
          vultureLookup: projectionLookup,
        }),
      );
      overlay.material.map = texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }

    overlay.material.color.set("#ffffff");
    overlay.material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    const useFpsDepthOcclusion = this.dependencies.movementInput.isFpsMode();
    const depthAlphaTest = useFpsDepthOcclusion ? 0.01 : 0;
    if (
      overlay.material.depthWrite !== useFpsDepthOcclusion ||
      overlay.material.depthTest !== true ||
      Math.abs(overlay.material.alphaTest - depthAlphaTest) > 0.0001
    ) {
      overlay.material.depthWrite = useFpsDepthOcclusion;
      overlay.material.depthTest = true;
      overlay.material.alphaTest = depthAlphaTest;
      overlay.material.needsUpdate = true;
    }
    return overlay.material;
  }

  ensureWallSideTileOverlayMaterial(
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
      this.dependencies.lighting.patchMaterialForVignette(material);
      overlay = {
        textureKey: "",
        material,
      };
      overlays[rotation] = overlay;
    }

    const tileTextureSourceGlyph =
      typeof mesh.userData?.tileTextureSourceGlyph === "number" &&
      Number.isFinite(mesh.userData.tileTextureSourceGlyph)
        ? Math.trunc(mesh.userData.tileTextureSourceGlyph)
        : null;
    const tileTextureMaterialKind =
      typeof mesh.userData?.materialKind === "string"
        ? (mesh.userData.materialKind as TileMaterialKind)
        : null;
    const tileTextureForceBackgroundRemoval =
      mesh.userData?.tileTextureForceBackgroundRemoval === true;
    const tileTextureSourceGlyphKey =
      tileTextureSourceGlyph === null ? "none" : String(tileTextureSourceGlyph);
    const tileTextureMaterialKindKey = tileTextureMaterialKind ?? "none";
    const textureKey = `tile:${tileIndex}|sg:${tileTextureSourceGlyphKey}|mk:${tileTextureMaterialKindKey}|bgrem:${tileTextureForceBackgroundRemoval ? 1 : 0}|${darkenFactor.toFixed(3)}|rot:${rotation}`;
    const needsTextureRefresh =
      overlay.textureKey !== textureKey ||
      !this.dependencies.glyphTextures.glyphTextureCache.has(textureKey);
    if (needsTextureRefresh) {
      if (overlay.textureKey) {
        this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
      }
      const texture = this.dependencies.glyphTextures.acquireGlyphTexture(textureKey, () =>
        this.dependencies.glyphTextures.createTileTexture(tileIndex, darkenFactor, false, {
          sourceGlyph: tileTextureSourceGlyph,
          materialKind: tileTextureMaterialKind,
          forceBackgroundRemoval: tileTextureForceBackgroundRemoval,
        }),
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

  disposeAllWallSideTileOverlays(): void {
    this.dependencies.tileRendering.tileMap.forEach((mesh) => {
      this.disposeWallSideTileOverlay(mesh);
      this.disposeVultureWallFaceOverlay(mesh);
      this.disposeVultureWallPlaneOverlay(mesh);
      this.disposeVultureDoorPlaneOverlay(mesh);
      this.disposeTransparentWallGroundPlaneOverlay(mesh);
      this.disposeIronBarsWallPlaneOverlay(mesh);
    });
  }
}
