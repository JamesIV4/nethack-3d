import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import {
  classifyTileBehavior,
  getDefaultDarkFloorGlyph,
  getDefaultFloorGlyph,
  getOpenDoorGlyphFrom,
  isDoorwayCmapGlyph,
  isVerticalDoorCmapGlyph
} from "../../glyphs/behavior";
import { CLASSIC_ASCII_BACKGROUND_HEX } from "../../ascii-color-mode";
import { TERMINAL_BACKGROUND_HEX } from "../../terminal/terminal-display";
import type { TileMaterialKind } from "../../glyphs";
import type { FpsChamferWallUvRotation } from "../shared/types";
import type { DarkCorridorInference } from "../world/dark-corridor-inference";
import type { EngineState } from "../runtime/engine-state";
import type { FloorOcclusion } from "./floor-occlusion";
import type { GlyphTextures } from "./glyph-textures";
import type { Lighting } from "./lighting";
import type { MovementInput } from "../input/movement-input";
import type { RenderPipeline } from "./render-pipeline";
import type { TileMaterials } from "./tile-materials";
import type { TileRendering } from "./tile-rendering";
import type { TilesetAssets } from "./tileset-assets";
import type { VultureWalls } from "./vulture-walls";
import type { WallOverlays } from "./wall-overlays";
import type { WorldClassification } from "../world/world-classification";

export interface WallGeometryDependencies {
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "getKnownTerrainSnapshotForInferenceAtKey"
    | "resolveInferredDarkCorridorWallSolidColorGridDarknessPercent"
    | "resolveInferredDarkCorridorWallSolidColorGridEnabled"
    | "resolveInferredDarkCorridorWallSolidColorHex"
  >;
  readonly engineState: Pick<
    EngineState,
    "characterCreationConfig"
    | "clientOptions"
  >;
  readonly floorOcclusion: Pick<
    FloorOcclusion,
    "getWallChamferMaskAt"
    | "refreshFloorBlockAmbientOcclusionNear"
    | "refreshFpsWallChamferFloorAmbientOcclusionAt"
    | "refreshFpsWallChamferFloorAmbientOcclusionNear"
    | "removeFpsWallChamferFloorAmbientOcclusionOverlay"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "createGlyphTexture"
    | "createTileTexture"
    | "glyphOverlayMap"
  >;
  readonly lighting: Pick<
    Lighting,
    "patchMaterialForVignette"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly tileMaterials: Pick<
    TileMaterials,
    "applyGlyphMaterial"
    | "getMaterialByKind"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
    | "tileVisualScaleFps"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "isDarkCorridorWallCompatibilityActiveOnMesh"
    | "shouldUseVultureTiles"
  >;
  readonly vultureWalls: Pick<
    VultureWalls,
    "resolveWallOrientationChar"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "alignTransparentWallGroundPlaneOverlayToTile"
    | "applyTransparentWallGroundPlaneOverlay"
    | "setTransparentWallGroundPlaneOverlayOpaqueMode"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "resolveFloorBehaviorFromNeighborTiles"
    | "resolveNormalRoomFloorBehavior"
  >;
}

/** Chamfered wall geometry, door transforms and floor wedge resources */
export class WallGeometry {
  constructor(private readonly dependencies: WallGeometryDependencies) {}

  fpsWallChamferGeometryCache: Map<string, THREE.BufferGeometry> =
    new Map();

  fpsWallChamferFloorGeometryCache: Map<number, THREE.ShapeGeometry> =
    new Map();

  fpsWallChamferFloorMeshes: Map<string, THREE.Mesh> = new Map();

  fpsWallChamferFaceMaterialCache: Map<
    string,
    THREE.MeshBasicMaterial
  > = new Map();

  fpsWallChamferFloorMaterialCache: Map<
    string,
    { material: THREE.MeshBasicMaterial; texture: THREE.CanvasTexture }
  > = new Map();

  readonly fpsWallChamferInset = TILE_SIZE * 0.25;

  readonly fpsWallChamferFloorZ = 0.0;

  wallGeometry = this.createUprightWallBlockGeometry();

  resolveFpsChamferWallUvRotation(
    glyphChar: string,
    sourceGlyph: number | null,
  ): FpsChamferWallUvRotation {
    const wallOrientationChar = this.dependencies.vultureWalls.resolveWallOrientationChar(
      glyphChar,
      sourceGlyph,
    );
    if (this.dependencies.engineState.clientOptions.tilesetMode === "tiles") {
      return "none";
    }
    // Preserve existing ASCII behavior where vertical walls use rotated chamfer sides.
    return wallOrientationChar === "|" ? "lr_ccw" : "none";
  }

  isPassableTileForFpsDiagonal(tileX: number, tileY: number): boolean {
    const key = `${tileX},${tileY}`;
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (this.isDoorwayTileForFpsChamfer(tileX, tileY)) {
      return true;
    }
    if (!mesh) {
      return false;
    }
    return !Boolean(mesh.userData?.isWall);
  }

  isDoorwayTileForFpsChamfer(tileX: number, tileY: number): boolean {
    const key = `${tileX},${tileY}`;
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (mesh) {
      const materialKind =
        typeof mesh.userData?.materialKind === "string"
          ? (mesh.userData.materialKind as TileMaterialKind)
          : null;
      if (materialKind === "door") {
        return true;
      }
      const tileTextureSourceGlyph =
        typeof mesh.userData?.tileTextureSourceGlyph === "number" &&
        Number.isFinite(mesh.userData.tileTextureSourceGlyph)
          ? Math.trunc(mesh.userData.tileTextureSourceGlyph)
          : null;
      if (
        tileTextureSourceGlyph !== null &&
        isDoorwayCmapGlyph(tileTextureSourceGlyph)
      ) {
        return true;
      }
      const sourceGlyph =
        typeof mesh.userData?.sourceGlyph === "number" &&
        Number.isFinite(mesh.userData.sourceGlyph)
          ? Math.trunc(mesh.userData.sourceGlyph)
          : null;
      if (sourceGlyph !== null && isDoorwayCmapGlyph(sourceGlyph)) {
        return true;
      }
    }

    const knownTerrain = this.dependencies.darkCorridorInference.getKnownTerrainSnapshotForInferenceAtKey(key);
    return Boolean(
      knownTerrain &&
      typeof knownTerrain.glyph === "number" &&
      isDoorwayCmapGlyph(Math.trunc(knownTerrain.glyph)),
    );
  }

  isSolidWallTileForFpsChamfer(tileX: number, tileY: number): boolean {
    const mesh = this.dependencies.tileRendering.tileMap.get(`${tileX},${tileY}`);
    if (!mesh?.userData?.isWall) {
      return false;
    }
    return mesh.userData?.materialKind !== "door";
  }

  getFpsChamferMaskForSolidWallTile(
    tileX: number,
    tileY: number,
  ): number {
    if (!this.isSolidWallTileForFpsChamfer(tileX, tileY)) {
      return 0;
    }
    return this.computeFpsWallChamferMask(tileX, tileY);
  }

  getFpsClosedDoorChamferTransform(
    tileX: number,
    tileY: number,
    sourceGlyph: number | null,
  ): { scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
    const identity = {
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    };
    if (!this.dependencies.movementInput.isFpsMode()) {
      return identity;
    }
    if (
      sourceGlyph !== null &&
      isDoorwayCmapGlyph(sourceGlyph) &&
      getOpenDoorGlyphFrom(sourceGlyph) === sourceGlyph
    ) {
      // Open doors are rendered as floor tiles in FPS, so no wall-block trim.
      return identity;
    }

    const half = TILE_SIZE / 2;
    const inset = Math.min(this.fpsWallChamferInset, half - 0.01);
    if (!(inset > 0)) {
      return identity;
    }

    const resolveNeighborMask = (x: number, y: number): number => {
      if (!this.isSolidWallTileForFpsChamfer(x, y)) {
        return 0;
      }
      const appliedMask = this.dependencies.floorOcclusion.getWallChamferMaskAt(x, y);
      if (appliedMask > 0) {
        return appliedMask;
      }
      // Fallback for update-order cases where neighbors have not been refreshed yet.
      return this.getFpsChamferMaskForSolidWallTile(x, y);
    };

    const northMask = resolveNeighborMask(tileX, tileY - 1);
    const southMask = resolveNeighborMask(tileX, tileY + 1);
    const eastMask = resolveNeighborMask(tileX + 1, tileY);
    const westMask = resolveNeighborMask(tileX - 1, tileY);

    // X-axis trimming (west/east ends) driven by north/south side walls.
    const cutWest = (northMask & 8) !== 0 || (southMask & 1) !== 0 ? inset : 0;
    const cutEast = (northMask & 4) !== 0 || (southMask & 2) !== 0 ? inset : 0;
    // Y-axis trimming (south/north ends) driven by east/west side walls.
    const cutSouth = (eastMask & 8) !== 0 || (westMask & 4) !== 0 ? inset : 0;
    const cutNorth = (eastMask & 1) !== 0 || (westMask & 2) !== 0 ? inset : 0;

    const totalCutX = cutWest + cutEast;
    const totalCutY = cutSouth + cutNorth;
    if (totalCutX <= 0 && totalCutY <= 0) {
      return identity;
    }

    const useXAxis =
      totalCutX > totalCutY
        ? true
        : totalCutY > totalCutX
          ? false
          : sourceGlyph !== null && isDoorwayCmapGlyph(sourceGlyph)
            ? isVerticalDoorCmapGlyph(sourceGlyph)
            : totalCutX > 0;
    const cutNegative = useXAxis ? cutWest : cutSouth;
    const cutPositive = useXAxis ? cutEast : cutNorth;
    const doorLength = TILE_SIZE - cutNegative - cutPositive;
    if (!(doorLength > 0) || doorLength >= TILE_SIZE - 0.0001) {
      return identity;
    }
    const alongScale = THREE.MathUtils.clamp(doorLength / TILE_SIZE, 0.01, 1);
    const alongOffset = (cutNegative - cutPositive) / 2;
    return useXAxis
      ? {
          scaleX: alongScale,
          scaleY: 1,
          offsetX: alongOffset,
          offsetY: 0,
        }
      : {
          scaleX: 1,
          scaleY: alongScale,
          offsetX: 0,
          offsetY: alongOffset,
        };
  }

  applyFpsClosedDoorChamferTransformAt(
    tileX: number,
    tileY: number,
  ): void {
    const mesh = this.dependencies.tileRendering.tileMap.get(`${tileX},${tileY}`);
    if (!mesh || !mesh.userData?.isWall) {
      return;
    }
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    const runtimeSourceGlyph =
      typeof mesh.userData?.sourceGlyph === "number" &&
      Number.isFinite(mesh.userData.sourceGlyph)
        ? Math.trunc(mesh.userData.sourceGlyph)
        : null;
    const textureSourceGlyph =
      typeof mesh.userData?.tileTextureSourceGlyph === "number" &&
      Number.isFinite(mesh.userData.tileTextureSourceGlyph)
        ? Math.trunc(mesh.userData.tileTextureSourceGlyph)
        : null;
    const sourceGlyph =
      runtimeSourceGlyph !== null && isDoorwayCmapGlyph(runtimeSourceGlyph)
        ? runtimeSourceGlyph
        : textureSourceGlyph !== null && isDoorwayCmapGlyph(textureSourceGlyph)
          ? textureSourceGlyph
          : runtimeSourceGlyph;
    if (
      sourceGlyph === null ||
      !isDoorwayCmapGlyph(sourceGlyph) ||
      getOpenDoorGlyphFrom(sourceGlyph) === sourceGlyph
    ) {
      return;
    }
    const visualScale = this.dependencies.tileRendering.tileVisualScaleFps;
    const transform = this.getFpsClosedDoorChamferTransform(
      tileX,
      tileY,
      sourceGlyph,
    );
    mesh.position.set(
      tileX * TILE_SIZE + transform.offsetX,
      -tileY * TILE_SIZE + transform.offsetY,
      mesh.position.z,
    );
    mesh.scale.set(
      visualScale * transform.scaleX,
      visualScale * transform.scaleY,
      visualScale,
    );

    const hasTrim = transform.scaleX < 0.9999 || transform.scaleY < 0.9999;
    if (this.dependencies.engineState.clientOptions.tilesetMode === "tiles" && hasTrim) {
      const floorUnderlayBehavior = this.dependencies.worldClassification.resolveNormalRoomFloorBehavior();
      const floorUnderlayDarkenFactor =
        typeof mesh.userData?.glyphDarkenFactor === "number" &&
        Number.isFinite(mesh.userData.glyphDarkenFactor)
          ? mesh.userData.glyphDarkenFactor
          : 1;
      const key = `${tileX},${tileY}`;
      const overlayOpacity =
        this.dependencies.glyphTextures.glyphOverlayMap.get(key)?.material.opacity ?? 1;
      this.dependencies.wallOverlays.applyTransparentWallGroundPlaneOverlay(
        mesh,
        floorUnderlayBehavior.effective.glyph,
        typeof floorUnderlayBehavior.effective.tileIndex === "number" &&
          Number.isFinite(floorUnderlayBehavior.effective.tileIndex)
          ? Math.trunc(floorUnderlayBehavior.effective.tileIndex)
          : -1,
        floorUnderlayBehavior.materialKind,
        floorUnderlayDarkenFactor,
        overlayOpacity,
        floorUnderlayBehavior.useBackgroundReferenceTile === true,
      );
      this.dependencies.wallOverlays.setTransparentWallGroundPlaneOverlayOpaqueMode(mesh, true);
      this.dependencies.wallOverlays.alignTransparentWallGroundPlaneOverlayToTile(
        mesh,
        transform.offsetX,
        transform.offsetY,
        transform.scaleX,
        transform.scaleY,
      );
    }

    // Door trims are applied after nearby wall/chamfer masks settle, so refresh
    // AO now to ensure neighbors sample the final inset footprint.
    this.dependencies.floorOcclusion.refreshFloorBlockAmbientOcclusionNear(tileX, tileY);
    this.dependencies.floorOcclusion.refreshFpsWallChamferFloorAmbientOcclusionNear(tileX, tileY);
  }

  shouldUseChamferedWallGeometry(): boolean {
    return this.dependencies.movementInput.isFpsMode();
  }

  shouldChamferFpsWallCorner(
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

  computeFpsWallChamferMask(tileX: number, tileY: number): number {
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

  getFpsChamferMaterialKindForWall(
    wallMaterialKind: TileMaterialKind,
  ): TileMaterialKind {
    return wallMaterialKind === "dark_wall" ? "dark" : "floor";
  }

  getFpsAsciiWallColorModeFaceMaterial(
    backgroundColorHex: string,
  ): THREE.MeshBasicMaterial {
    const cacheKey = backgroundColorHex.trim().toLowerCase();
    const cached = this.fpsWallChamferFaceMaterialCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const material = new THREE.MeshBasicMaterial({
      color: backgroundColorHex,
      transparent: false,
      toneMapped: false,
    });
    this.dependencies.lighting.patchMaterialForVignette(material);
    this.fpsWallChamferFaceMaterialCache.set(cacheKey, material);
    return material;
  }

  resolveFpsAsciiColorModeBackground(): string | null {
    if (this.dependencies.engineState.clientOptions.tilesetMode !== "ascii") {
      return null;
    }
    if (this.dependencies.engineState.clientOptions.asciiColorMode === "terminal") {
      return TERMINAL_BACKGROUND_HEX;
    }
    if (this.dependencies.engineState.clientOptions.asciiColorMode === "classic") {
      return CLASSIC_ASCII_BACKGROUND_HEX;
    }
    return null;
  }

  getFpsWallChamferFloorMaterial(
    tileX: number,
    tileY: number,
    materialKind: TileMaterialKind,
  ): THREE.MeshBasicMaterial {
    const {
      tileIndex,
      sourceGlyph,
      materialKind: resolvedMaterialKind,
      useBackgroundReferenceTile,
    } = this.getFpsWallChamferFloorTileSource(tileX, tileY, materialKind);
    const canUseTranslatedTileWithoutAtlas =
      this.dependencies.tilesetAssets.shouldUseVultureTiles() && sourceGlyph !== null;
    const useTiles =
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
      (useBackgroundReferenceTile ||
        tileIndex >= 0 ||
        canUseTranslatedTileWithoutAtlas);
    const sourceGlyphKey = sourceGlyph === null ? "none" : String(sourceGlyph);
    const useBackgroundReferenceTileKey = useBackgroundReferenceTile
      ? "ubgref:1"
      : "ubgref:0";
    const asciiColorModeBackground = useTiles
      ? null
      : this.resolveFpsAsciiColorModeBackground();
    const cacheKey = useTiles
      ? `tile:${tileIndex}|sg:${sourceGlyphKey}|mk:${resolvedMaterialKind}|${useBackgroundReferenceTileKey}`
      : `ascii:${resolvedMaterialKind}|bg:${asciiColorModeBackground ?? "semantic"}`;
    const cached = this.fpsWallChamferFloorMaterialCache.get(cacheKey);
    if (cached) {
      return cached.material;
    }

    const texture = useTiles
      ? this.dependencies.glyphTextures.createTileTexture(
          tileIndex,
          1, // No artificial darkening for chamfer floors
          false,
          {
            sourceGlyph,
            materialKind: resolvedMaterialKind,
            useBackgroundReferenceTile,
          },
        )
      : this.dependencies.glyphTextures.createGlyphTexture(
          this.dependencies.tileMaterials.getMaterialByKind(resolvedMaterialKind).color.getHexString(),
          " ",
          "#F4F4F4",
          1,
          256,
          true,
          asciiColorModeBackground,
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
    this.dependencies.lighting.patchMaterialForVignette(material);

    return material;
  }

  getDefaultFpsWallChamferFloorTileSource(
    materialKind: TileMaterialKind,
  ): {
    tileIndex: number;
    sourceGlyph: number | null;
    materialKind: TileMaterialKind;
    useBackgroundReferenceTile: boolean;
  } {
    const floorGlyph = getDefaultFloorGlyph();
    let fallbackGlyph = floorGlyph;
    if (materialKind === "dark") {
      const runtimeVersion =
        this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7";
      // Legacy 3.4.3/3.6.x dark corridor walls should chamfer using the dark hallway
      // floor texture, not the generic dark room texture.
      fallbackGlyph =
        runtimeVersion !== "5.0" ? getDefaultDarkFloorGlyph() : floorGlyph + 1;
    }
    const behavior = classifyTileBehavior({
      glyph: fallbackGlyph,
      runtimeChar: ".",
      runtimeColor: null,
      priorTerrain: null,
    });
    return {
      tileIndex: behavior.effective.tileIndex,
      sourceGlyph: behavior.effective.glyph,
      materialKind: behavior.materialKind,
      useBackgroundReferenceTile: behavior.useBackgroundReferenceTile === true,
    };
  }

  getFpsWallChamferFloorTileSource(
    tileX: number,
    tileY: number,
    materialKind: TileMaterialKind,
  ): {
    tileIndex: number;
    sourceGlyph: number | null;
    materialKind: TileMaterialKind;
    useBackgroundReferenceTile: boolean;
  } {
    const adjacentFloorBehavior = this.dependencies.worldClassification.resolveFloorBehaviorFromNeighborTiles(
      tileX,
      tileY,
    );
    if (adjacentFloorBehavior) {
      return {
        tileIndex:
          typeof adjacentFloorBehavior.effective.tileIndex === "number" &&
          Number.isFinite(adjacentFloorBehavior.effective.tileIndex)
            ? Math.trunc(adjacentFloorBehavior.effective.tileIndex)
            : -1,
        sourceGlyph:
          typeof adjacentFloorBehavior.effective.glyph === "number" &&
          Number.isFinite(adjacentFloorBehavior.effective.glyph)
            ? Math.trunc(adjacentFloorBehavior.effective.glyph)
            : null,
        materialKind: adjacentFloorBehavior.materialKind,
        // Adjacent fallback only accepts empty floor/corridor terrain, never
        // doorways, raised specials, traps, water, or other feature tiles.
        useBackgroundReferenceTile:
          adjacentFloorBehavior.useBackgroundReferenceTile === true,
      };
    }
    return this.getDefaultFpsWallChamferFloorTileSource(materialKind);
  }

  clearFpsWallChamferMaterialCaches(): void {
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

  splitFpsChamferGeometryGroups(
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

  createUprightWallBlockGeometry(): THREE.BoxGeometry {
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

  remapFpsChamferWallUVs(
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

  remapFpsChamferFloorUVs(geometry: THREE.ShapeGeometry): void {
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

  createFpsChamferedWallGeometry(
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

  getFpsWallGeometry(
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

  getFpsWallChamferFloorGeometry(
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

  removeFpsWallChamferFloorMesh(key: string): void {
    const mesh = this.fpsWallChamferFloorMeshes.get(key);
    if (!mesh) {
      this.dependencies.floorOcclusion.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      return;
    }
    this.dependencies.renderPipeline.scene.remove(mesh);
    this.fpsWallChamferFloorMeshes.delete(key);
    this.dependencies.floorOcclusion.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
  }

  clearFpsWallChamferFloorMeshes(): void {
    for (const key of Array.from(this.fpsWallChamferFloorMeshes.keys())) {
      this.removeFpsWallChamferFloorMesh(key);
    }
  }

  upsertFpsWallChamferFloorMesh(
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
    const material = this.getFpsWallChamferFloorMaterial(
      tileX,
      tileY,
      materialKind,
    );
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
      this.dependencies.renderPipeline.scene.add(mesh);
      this.fpsWallChamferFloorMeshes.set(key, mesh);
      this.dependencies.floorOcclusion.refreshFpsWallChamferFloorAmbientOcclusionAt(tileX, tileY);
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
    this.dependencies.floorOcclusion.refreshFpsWallChamferFloorAmbientOcclusionAt(tileX, tileY);
  }

  refreshFpsWallChamferGeometryAt(tileX: number, tileY: number): void {
    const key = `${tileX},${tileY}`;
    if (!this.shouldUseChamferedWallGeometry()) {
      this.removeFpsWallChamferFloorMesh(key);
      return;
    }
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (!mesh || !mesh.userData?.isWall) {
      this.removeFpsWallChamferFloorMesh(key);
      this.dependencies.floorOcclusion.refreshFpsWallChamferFloorAmbientOcclusionNear(tileX, tileY);
      return;
    }
    const materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? (mesh.userData.materialKind as TileMaterialKind)
        : null;
    if (!materialKind || materialKind === "door") {
      this.removeFpsWallChamferFloorMesh(key);
      this.dependencies.floorOcclusion.refreshFpsWallChamferFloorAmbientOcclusionNear(tileX, tileY);
      return;
    }

    const sourceGlyph =
      typeof mesh.userData?.sourceGlyph === "number"
        ? Math.trunc(mesh.userData.sourceGlyph)
        : null;
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
    this.dependencies.floorOcclusion.refreshFpsWallChamferFloorAmbientOcclusionNear(tileX, tileY);
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

    const baseMaterial = this.dependencies.tileMaterials.getMaterialByKind(materialKind);
    const textColor =
      typeof mesh.userData?.glyphTextColor === "string"
        ? mesh.userData.glyphTextColor
        : "#F4F4F4";
    const glyphBackgroundColor =
      typeof mesh.userData?.glyphBackgroundColor === "string"
        ? mesh.userData.glyphBackgroundColor
        : null;
    const darkenFactor =
      typeof mesh.userData?.glyphDarkenFactor === "number"
        ? mesh.userData.glyphDarkenFactor
        : 1;
    const tileIndex =
      typeof mesh.userData?.tileIndex === "number"
        ? mesh.userData.tileIndex
        : -1;
    const darkCorridorWallCompatibilityActive =
      this.dependencies.tilesetAssets.isDarkCorridorWallCompatibilityActiveOnMesh(mesh);
    const inferredDarkWallSolidColorHex =
      this.dependencies.darkCorridorInference.resolveInferredDarkCorridorWallSolidColorHex(
        darkCorridorWallCompatibilityActive,
      );
    const inferredDarkWallSolidColorGridEnabled =
      this.dependencies.darkCorridorInference.resolveInferredDarkCorridorWallSolidColorGridEnabled(
        darkCorridorWallCompatibilityActive,
      );
    const inferredDarkWallSolidColorGridDarknessPercent =
      this.dependencies.darkCorridorInference.resolveInferredDarkCorridorWallSolidColorGridDarknessPercent(
        darkCorridorWallCompatibilityActive,
      );
    this.dependencies.tileMaterials.applyGlyphMaterial(
      key,
      mesh,
      baseMaterial,
      glyphChar,
      textColor,
      true,
      darkenFactor,
      this.dependencies.movementInput.isFpsMode() && !darkCorridorWallCompatibilityActive,
      tileIndex,
      inferredDarkWallSolidColorHex,
      inferredDarkWallSolidColorGridEnabled,
      inferredDarkWallSolidColorGridDarknessPercent,
      glyphBackgroundColor,
    );
  }

  refreshFpsWallChamferGeometryNear(
    tileX: number,
    tileY: number,
  ): void {
    if (!this.shouldUseChamferedWallGeometry()) {
      this.clearFpsWallChamferFloorMeshes();
      return;
    }
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        this.refreshFpsWallChamferGeometryAt(tileX + dx, tileY + dy);
      }
    }
    // Door trims depend on neighboring wall chamfer masks; re-apply after masks settle.
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        this.applyFpsClosedDoorChamferTransformAt(tileX + dx, tileY + dy);
      }
    }
  }
}
