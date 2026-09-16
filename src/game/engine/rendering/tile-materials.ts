import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import {
  classifyTileBehavior,
  getOpenDoorGlyphFrom,
  isVerticalDoorCmapGlyph
} from "../../glyphs/behavior";
import type { TileMaterialKind } from "../../glyphs";
import type {
  WallSideTileRotation,
  VultureWallFaceSlot,
  VultureWallPlaneOverlay,
  IronBarsWallPlaneOverlay,
  VultureWallProjectionLookup
} from "../shared/types";
import type { Camera } from "../camera/camera";
import type { DamageFlashes } from "../effects/damage-flashes";
import type { EngineState } from "../runtime/engine-state";
import type { GlyphTextures } from "./glyph-textures";
import type { Lighting } from "./lighting";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { TileRendering } from "./tile-rendering";
import type { TilesetAssets } from "./tileset-assets";
import type { VultureWalls } from "./vulture-walls";
import type { WallGeometry } from "./wall-geometry";
import type { WallOverlays } from "./wall-overlays";
import type { WorldClassification } from "../world/world-classification";

export interface TileMaterialsDependencies {
  readonly camera: Pick<
    Camera,
    "camera"
  >;
  readonly damageFlashes: Pick<
    DamageFlashes,
    "getGlyphDamageFlashIntensity"
    | "glyphDamageFlashWhite"
    | "glyphDamageFlashes"
    | "renderGlyphDamageFlash"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "acquireGlyphTexture"
    | "createGlyphTexture"
    | "createTileTexture"
    | "ensureGlyphOverlay"
    | "releaseGlyphTexture"
    | "setMaterialAlphaCutout"
    | "setMaterialFaceSide"
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
    "playerPos"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileRevealStartMs"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "shouldUseVultureTiles"
    | "vultureTilesetTranslator"
  >;
  readonly vultureWalls: Pick<
    VultureWalls,
    "resolveCornerWallSideBaseTileIndex"
    | "resolveVultureWallPlaneRenderConfig"
    | "resolveWallOrientationChar"
  >;
  readonly wallGeometry: Pick<
    WallGeometry,
    "getFpsAsciiWallColorModeFaceMaterial"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "applyIronBarsWallPlaneOverlay"
    | "applyVultureDoorPlane"
    | "applyVultureWallPlaneSliceTransform"
    | "disposeIronBarsWallPlaneOverlay"
    | "disposeVultureDoorPlaneOverlay"
    | "disposeVultureWallFaceOverlay"
    | "disposeVultureWallPlaneOverlay"
    | "disposeWallSideTileOverlay"
    | "ensureVultureWallFaceOverlayMaterial"
    | "ensureVultureWallPlaneSlice"
    | "ensureWallSideTileOverlayMaterial"
    | "vultureBackWallPlaneRenderOrder"
    | "vultureFrontWallPlaneRenderOrder"
    | "vultureInvisibleSurfaceMaterial"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "isIronBarsLikeBehavior"
    | "isTileAdjacentToIronBars"
  >;
}

/** Tile material application and cached fallback surface materials */
export class TileMaterials {
  constructor(private readonly dependencies: TileMaterialsDependencies) {}

  inferredDarkWallSolidColorMaterialCache: Map<
    string,
    { material: THREE.MeshLambertMaterial; texture: THREE.CanvasTexture | null }
  > = new Map();


  // Materials for different glyph types
  materials = {
    floor: new THREE.MeshLambertMaterial({ color: 0x6a4d28 }),
    stairs_up: new THREE.MeshLambertMaterial({
      color: 0x3f8753,
      emissive: 0x15301d,
    }),
    stairs_down: new THREE.MeshLambertMaterial({
      color: 0x7d5cc8,
      emissive: 0x251b3a,
    }),
    wall: new THREE.MeshLambertMaterial({ color: 0x5f6773 }),
    dark_wall: new THREE.MeshLambertMaterial({ color: 0x4a5060 }),
    door: new THREE.MeshLambertMaterial({
      color: 0x5a3b22,
      emissive: 0x1b120a,
    }),
    dark: new THREE.MeshLambertMaterial({ color: 0x17385f }),
    water: new THREE.MeshLambertMaterial({
      color: 0x1a6dbe,
      emissive: 0x08253f,
    }),
    trap: new THREE.MeshLambertMaterial({
      color: 0xac6c2e,
      emissive: 0x3a230f,
    }),
    feature: new THREE.MeshLambertMaterial({ color: 0x73768b }),
    fountain: new THREE.MeshLambertMaterial({
      color: 0x2ea8ff,
      emissive: 0x0b2f4d,
    }),
    player: new THREE.MeshLambertMaterial({
      color: 0x39ff88,
      emissive: 0x114d2a,
    }),
    monster_hostile: new THREE.MeshLambertMaterial({
      color: 0x9f3434,
      emissive: 0x311010,
    }),
    monster_friendly: new THREE.MeshLambertMaterial({
      color: 0x2f8f4f,
      emissive: 0x12301c,
    }),
    monster_neutral: new THREE.MeshLambertMaterial({
      color: 0x2f6fa8,
      emissive: 0x10263a,
    }),
    item: new THREE.MeshLambertMaterial({
      color: 0xa87f1a,
      emissive: 0x352707,
    }),
    effect_warning: new THREE.MeshLambertMaterial({
      color: 0x9d6e1f,
      emissive: 0x302109,
    }),
    effect_zap: new THREE.MeshLambertMaterial({
      color: 0x2f8290,
      emissive: 0x0e2730,
    }),
    effect_explode: new THREE.MeshLambertMaterial({
      color: 0xa7582d,
      emissive: 0x341b0f,
    }),
    effect_swallow: new THREE.MeshLambertMaterial({
      color: 0x68469a,
      emissive: 0x221733,
    }),
    default: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  };

  applyGlyphMaterial(
    key: string,
    mesh: THREE.Mesh,
    baseMaterial: THREE.MeshLambertMaterial,
    glyphChar: string,
    textColor: string,
    isWall: boolean,
    darkenFactor: number = 1,
    drawFloorGrid: boolean = false,
    tileIndex: number = -1,
    solidColorHex: string | null = null,
    solidColorGridEnabled: boolean = false,
    solidColorGridDarknessPercent: number = 15,
    glyphBackgroundColorHex: string | null = null,
  ): void {
    const overlay = this.dependencies.glyphTextures.ensureGlyphOverlay(key, baseMaterial);
    const baseColorHex = baseMaterial.color.getHexString();
    const clampedDarken = THREE.MathUtils.clamp(darkenFactor, 0, 1);
    const resolvedSolidColorHex =
      typeof solidColorHex === "string" ? solidColorHex : null;

    const useSolidColor = resolvedSolidColorHex !== null;
    const sourceGlyph =
      typeof mesh.userData?.sourceGlyph === "number" &&
      Number.isFinite(mesh.userData.sourceGlyph)
        ? Math.trunc(mesh.userData.sourceGlyph)
        : null;
    const tileTextureSourceGlyph =
      typeof mesh.userData?.tileTextureSourceGlyph === "number" &&
      Number.isFinite(mesh.userData.tileTextureSourceGlyph)
        ? Math.trunc(mesh.userData.tileTextureSourceGlyph)
        : sourceGlyph;
    const tileTextureMaterialKind =
      typeof mesh.userData?.materialKind === "string"
        ? (mesh.userData.materialKind as TileMaterialKind)
        : null;
    const tileTextureX =
      typeof mesh.userData?.tileX === "number" &&
      Number.isFinite(mesh.userData.tileX)
        ? Math.trunc(mesh.userData.tileX)
        : null;
    const tileTextureY =
      typeof mesh.userData?.tileY === "number" &&
      Number.isFinite(mesh.userData.tileY)
        ? Math.trunc(mesh.userData.tileY)
        : null;
    const floorUnderlayGlyph =
      typeof mesh.userData?.floorUnderlaySourceGlyph === "number" &&
      Number.isFinite(mesh.userData.floorUnderlaySourceGlyph)
        ? Math.trunc(mesh.userData.floorUnderlaySourceGlyph)
        : null;
    const floorUnderlayTileIndex =
      typeof mesh.userData?.floorUnderlayTileIndex === "number" &&
      Number.isFinite(mesh.userData.floorUnderlayTileIndex)
        ? Math.trunc(mesh.userData.floorUnderlayTileIndex)
        : null;
    const floorUnderlayMaterialKind =
      typeof mesh.userData?.floorUnderlayMaterialKind === "string"
        ? (mesh.userData.floorUnderlayMaterialKind as TileMaterialKind)
        : null;
    const tileUseBackgroundReferenceTile =
      mesh.userData?.tileUseBackgroundReferenceTile === true;
    const floorUnderlayUseBackgroundReferenceTile =
      mesh.userData?.floorUnderlayUseBackgroundReferenceTile === true;
    const tileTextureForceBackgroundRemoval =
      mesh.userData?.tileTextureForceBackgroundRemoval === true;
    const canUseTranslatedTileWithoutAtlas =
      this.dependencies.tilesetAssets.shouldUseVultureTiles() && tileTextureSourceGlyph !== null;
    const vultureTranslator = this.dependencies.tilesetAssets.vultureTilesetTranslator;
    const resolvedVultureLookup =
      this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
      !useSolidColor &&
      vultureTranslator &&
      (tileTextureSourceGlyph !== null || tileIndex >= 0)
        ? vultureTranslator.resolveLookupForTile({
            glyph: tileTextureSourceGlyph ?? sourceGlyph ?? -1,
            tileIndex: tileIndex >= 0 ? tileIndex : null,
            tileX: tileTextureX,
            tileY: tileTextureY,
            materialKind: tileTextureMaterialKind,
            forBillboard: false,
          })
        : null;
    const resolvedVultureLookupKey = resolvedVultureLookup
      ? `${resolvedVultureLookup.category}.${resolvedVultureLookup.name}|proj:${resolvedVultureLookup.projection}`
      : "";
    const useTiles =
      !useSolidColor &&
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
      (tileUseBackgroundReferenceTile ||
        tileIndex >= 0 ||
        canUseTranslatedTileWithoutAtlas);
    const tileTextureSourceGlyphKey =
      tileTextureSourceGlyph === null ? "none" : String(tileTextureSourceGlyph);
    const tileTextureMaterialKindKey = tileTextureMaterialKind ?? "none";
    const floorUnderlayGlyphKey =
      floorUnderlayGlyph === null ? "none" : String(floorUnderlayGlyph);
    const floorUnderlayTileIndexKey =
      floorUnderlayTileIndex === null ? "none" : String(floorUnderlayTileIndex);
    const floorUnderlayMaterialKindKey = floorUnderlayMaterialKind ?? "none";
    const tileUseBackgroundReferenceTileKey = tileUseBackgroundReferenceTile
      ? "bgref:1"
      : "bgref:0";
    const floorUnderlayUseBackgroundReferenceTileKey =
      floorUnderlayUseBackgroundReferenceTile ? "ubgref:1" : "ubgref:0";
    const tileTextureForceBackgroundRemovalKey =
      tileTextureForceBackgroundRemoval ? "bgrem:1" : "bgrem:0";
    const solidWallMaterial =
      useSolidColor && resolvedSolidColorHex
        ? this.getInferredDarkWallSolidColorMaterial(
            resolvedSolidColorHex,
            solidColorGridEnabled,
            solidColorGridDarknessPercent,
          )
        : null;
    const resolvedGlyphBackgroundColorHex =
      typeof glyphBackgroundColorHex === "string" &&
      glyphBackgroundColorHex.length > 0
        ? glyphBackgroundColorHex
        : null;

    let textureKey: string;
    if (useSolidColor) {
      textureKey = `solid:${resolvedSolidColorHex.toLowerCase()}`;
    } else if (useTiles) {
      textureKey = resolvedVultureLookupKey
        ? `vtile:${resolvedVultureLookupKey}|mk:${tileTextureMaterialKindKey}|${clampedDarken.toFixed(3)}`
        : `tile:${tileIndex}|sg:${tileTextureSourceGlyphKey}|mk:${tileTextureMaterialKindKey}|${tileUseBackgroundReferenceTileKey}|${tileTextureForceBackgroundRemovalKey}|ug:${floorUnderlayGlyphKey}|ui:${floorUnderlayTileIndexKey}|${floorUnderlayUseBackgroundReferenceTileKey}|umk:${floorUnderlayMaterialKindKey}|${clampedDarken.toFixed(3)}`;
    } else {
      textureKey = `${baseColorHex}|${glyphChar}|${textColor}|${clampedDarken.toFixed(3)}|${drawFloorGrid ? 1 : 0}|bg:${resolvedGlyphBackgroundColorHex ?? "none"}`;
    }

    if (overlay.textureKey !== textureKey) {
      if (overlay.textureKey) {
        this.dependencies.glyphTextures.releaseGlyphTexture(overlay.textureKey);
      }

      overlay.baseColorHex = baseColorHex;
      if (useSolidColor) {
        overlay.material.color.set(resolvedSolidColorHex);
      } else {
        overlay.material.color.set("#ffffff");
      }

      if (useSolidColor) {
        overlay.texture = null;
        overlay.material.map = null;
      } else if (useTiles) {
        overlay.texture = this.dependencies.glyphTextures.acquireGlyphTexture(
          textureKey,
          () =>
            this.dependencies.glyphTextures.createTileTexture(tileIndex, clampedDarken, false, {
              sourceGlyph: tileTextureSourceGlyph,
              materialKind: tileTextureMaterialKind,
              tileX: tileTextureX,
              tileY: tileTextureY,
              useBackgroundReferenceTile: tileUseBackgroundReferenceTile,
              forceBackgroundRemoval: tileTextureForceBackgroundRemoval,
              floorUnderlayGlyph,
              floorUnderlayTileIndex,
              floorUnderlayUseBackgroundReferenceTile,
              floorUnderlayMaterialKind,
              vultureLookup:
                resolvedVultureLookup as VultureWallProjectionLookup | null,
            }), // Pass false: map tiles are opaque
        );
      } else {
        overlay.texture = this.dependencies.glyphTextures.acquireGlyphTexture(textureKey, () =>
          this.dependencies.glyphTextures.createGlyphTexture(
            baseColorHex,
            glyphChar,
            textColor,
            clampedDarken,
            256,
            drawFloorGrid,
            resolvedGlyphBackgroundColorHex,
          ),
        );
      }

      overlay.material.map = overlay.texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }
    if (useSolidColor) {
      overlay.material.color.set(resolvedSolidColorHex);
    } else {
      overlay.material.color.set("#ffffff");
    }

    const flashState = this.dependencies.damageFlashes.glyphDamageFlashes.get(key);
    if (flashState) {
      flashState.baseColorHex = baseColorHex;
      flashState.glyphChar = glyphChar;
      flashState.darkenFactor = clampedDarken;
      if (flashState.mode === "glyph_texture" && flashState.texture) {
        overlay.material.map = flashState.texture;
        overlay.material.color.copy(this.dependencies.damageFlashes.glyphDamageFlashWhite);
        overlay.material.needsUpdate = true;
      } else {
        this.dependencies.damageFlashes.renderGlyphDamageFlash(
          flashState,
          this.dependencies.damageFlashes.getGlyphDamageFlashIntensity(flashState),
        );
      }
    }

    if (!this.dependencies.tileRendering.tileRevealStartMs.has(key)) {
      overlay.material.opacity = 1;
    }

    const isDoorWall = mesh.userData?.materialKind === "door";
    const isOpenDoorGlyph =
      tileTextureSourceGlyph !== null &&
      getOpenDoorGlyphFrom(tileTextureSourceGlyph) === tileTextureSourceGlyph;
    const useVultureTiles = this.dependencies.tilesetAssets.shouldUseVultureTiles() && useTiles;
    const shouldUseVultureOpenDoorPlane =
      useVultureTiles && !isWall && isDoorWall && isOpenDoorGlyph;
    const shouldUseVultureWallFaceMaterials =
      useVultureTiles && isWall && !isDoorWall;
    const shouldUseVultureDoorPlane = useVultureTiles && isWall && isDoorWall;
    const supportsAtlasWallSideOverrides =
      useTiles && !this.dependencies.tilesetAssets.shouldUseVultureTiles();
    const wallOrientationSourceGlyph =
      tileTextureMaterialKind === "door" ? tileTextureSourceGlyph : sourceGlyph;
    const wallOrientationChar =
      tileTextureMaterialKind === "door"
        ? this.dependencies.vultureWalls.resolveWallOrientationChar(" ", wallOrientationSourceGlyph)
        : this.dependencies.vultureWalls.resolveWallOrientationChar(
            glyphChar,
            wallOrientationSourceGlyph,
          );
    const cornerWallSideBaseTileIndex =
      this.dependencies.vultureWalls.resolveCornerWallSideBaseTileIndex(tileIndex);
    const shouldOverrideCornerWallSideTiles =
      supportsAtlasWallSideOverrides &&
      isWall &&
      !isDoorWall &&
      cornerWallSideBaseTileIndex !== null;
    const shouldOverrideVerticalWallSideTiles =
      supportsAtlasWallSideOverrides &&
      isWall &&
      !isDoorWall &&
      !shouldOverrideCornerWallSideTiles &&
      wallOrientationChar === "|" &&
      tileIndex >= 0;
    const shouldRotateHorizontalWallSideTiles =
      supportsAtlasWallSideOverrides &&
      isWall &&
      !isDoorWall &&
      !shouldOverrideCornerWallSideTiles &&
      wallOrientationChar === "-" &&
      tileIndex >= 0;
    const shouldRotateVerticalDoorSideTiles =
      supportsAtlasWallSideOverrides &&
      isWall &&
      isDoorWall &&
      sourceGlyph !== null &&
      isVerticalDoorCmapGlyph(sourceGlyph) &&
      tileIndex >= 0;
    const wallSideOverrideTileIndex = shouldOverrideCornerWallSideTiles
      ? (cornerWallSideBaseTileIndex ?? -1)
      : shouldOverrideVerticalWallSideTiles
        ? tileIndex + 1
        : shouldRotateHorizontalWallSideTiles ||
            shouldRotateVerticalDoorSideTiles
          ? tileIndex
          : -1;
    const wallSideOverrideRotation: WallSideTileRotation = "cw90";
    const wallSideOverrideMaterial =
      wallSideOverrideTileIndex >= 0
        ? this.dependencies.wallOverlays.ensureWallSideTileOverlayMaterial(
            mesh,
            wallSideOverrideTileIndex,
            clampedDarken,
            overlay.material.opacity,
            wallSideOverrideRotation,
          )
        : null;
    const wallSideFrontBackOverrideMaterial =
      shouldOverrideVerticalWallSideTiles || shouldOverrideCornerWallSideTiles
        ? this.dependencies.wallOverlays.ensureWallSideTileOverlayMaterial(
            mesh,
            shouldOverrideCornerWallSideTiles
              ? (cornerWallSideBaseTileIndex ?? -1)
              : tileIndex + 1,
            clampedDarken,
            overlay.material.opacity,
            "none",
          )
        : null;
    const chamferSideOverrideMaterial =
      wallSideOverrideTileIndex >= 0
        ? this.dependencies.wallOverlays.ensureWallSideTileOverlayMaterial(
            mesh,
            wallSideOverrideTileIndex,
            clampedDarken,
            overlay.material.opacity,
            "none",
          )
        : null;
    const neededWallSideRotations = new Set<WallSideTileRotation>();
    if (wallSideOverrideMaterial) {
      neededWallSideRotations.add(wallSideOverrideRotation);
      neededWallSideRotations.add("none");
    }
    if (wallSideFrontBackOverrideMaterial) {
      neededWallSideRotations.add("none");
    }
    for (const rotation of ["none", "cw90", "ccw90"] as const) {
      if (!neededWallSideRotations.has(rotation)) {
        this.dependencies.wallOverlays.disposeWallSideTileOverlay(mesh, rotation);
      }
    }
    const shouldDisableWallSideCulling =
      isWall &&
      tileTextureX !== null &&
      tileTextureY !== null &&
      this.dependencies.worldClassification.isTileAdjacentToIronBars(tileTextureX, tileTextureY);
    const wallFaceSide = shouldDisableWallSideCulling
      ? THREE.DoubleSide
      : THREE.FrontSide;
    const shouldUseWallAlphaCutout =
      isWall && tileTextureForceBackgroundRemoval;
    const shouldUseIronBarsWallPlanes =
      this.dependencies.movementInput.isFpsMode() &&
      useTiles &&
      !this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
      isWall &&
      this.dependencies.worldClassification.isIronBarsLikeBehavior(
        classifyTileBehavior({
          glyph: tileTextureSourceGlyph ?? sourceGlyph ?? -1,
          runtimeChar: glyphChar,
          runtimeColor: null,
          runtimeTileIndex: tileIndex >= 0 ? tileIndex : null,
          priorTerrain: null,
        }),
      );
    this.dependencies.glyphTextures.setMaterialFaceSide(overlay.material, wallFaceSide);
    this.dependencies.glyphTextures.setMaterialFaceSide(wallSideOverrideMaterial, wallFaceSide);
    this.dependencies.glyphTextures.setMaterialFaceSide(wallSideFrontBackOverrideMaterial, wallFaceSide);
    this.dependencies.glyphTextures.setMaterialFaceSide(chamferSideOverrideMaterial, wallFaceSide);
    this.dependencies.glyphTextures.setMaterialAlphaCutout(overlay.material, shouldUseWallAlphaCutout);
    this.dependencies.glyphTextures.setMaterialAlphaCutout(
      wallSideOverrideMaterial,
      shouldUseWallAlphaCutout,
    );
    this.dependencies.glyphTextures.setMaterialAlphaCutout(
      wallSideFrontBackOverrideMaterial,
      shouldUseWallAlphaCutout,
    );
    this.dependencies.glyphTextures.setMaterialAlphaCutout(
      chamferSideOverrideMaterial,
      shouldUseWallAlphaCutout,
    );

    const fpsWallChamferMask = Number(mesh.userData?.fpsWallChamferMask ?? 0);
    if (isWall && fpsWallChamferMask > 0) {
      this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
      if (useTiles) {
        // Chamfered wall geometry uses groups: cap (0), straight walls (1), cut corners (2).
        // In tileset mode, cap uses wall tile while side groups may use the vertical-wall override.
        mesh.material = chamferSideOverrideMaterial
          ? [
              overlay.material,
              chamferSideOverrideMaterial,
              chamferSideOverrideMaterial,
            ]
          : [overlay.material, overlay.material, overlay.material];
      } else if (solidWallMaterial) {
        mesh.material = [
          solidWallMaterial,
          solidWallMaterial,
          solidWallMaterial,
        ];
      } else {
        const asciiColorModeFaceMaterial = resolvedGlyphBackgroundColorHex
          ? this.dependencies.wallGeometry.getFpsAsciiWallColorModeFaceMaterial(
              resolvedGlyphBackgroundColorHex,
            )
          : null;
        if (asciiColorModeFaceMaterial) {
          // Classic and Terminal define an explicit cell background. Apply it
          // to every vertical wall face so chamfers cannot fall back to the
          // semantic 3D wall/floor palette.
          mesh.material = [
            overlay.material,
            asciiColorModeFaceMaterial,
            asciiColorModeFaceMaterial,
          ];
        } else {
          // NetHack 3D colors retain the semantic floor-tinted chamfer.
          const chamferKind =
            typeof mesh.userData?.fpsWallChamferMaterialKind === "string"
              ? (mesh.userData.fpsWallChamferMaterialKind as TileMaterialKind)
              : null;
          const chamferMaterial = chamferKind
            ? this.getMaterialByKind(chamferKind)
            : baseMaterial;
          mesh.material = [overlay.material, baseMaterial, chamferMaterial];
        }
      }
    } else if (isWall) {
      if (shouldUseVultureWallFaceMaterials && useTiles) {
        this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
        const wallX =
          typeof mesh.userData?.tileX === "number" &&
          Number.isFinite(mesh.userData.tileX)
            ? Math.trunc(mesh.userData.tileX)
            : null;
        const wallY =
          typeof mesh.userData?.tileY === "number" &&
          Number.isFinite(mesh.userData.tileY)
            ? Math.trunc(mesh.userData.tileY)
            : null;
        if (wallX === null || wallY === null) {
          this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
          this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
          this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
          mesh.material = [
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
          ];
        } else {
          const wallPlaneConfig = this.dependencies.vultureWalls.resolveVultureWallPlaneRenderConfig(
            wallX,
            wallY,
            tileTextureMaterialKind,
            wallOrientationChar,
          );
          if (!wallPlaneConfig) {
            this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
            this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
            this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
            mesh.material = [
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            ];
          } else {
            const usedTextureFaces = new Set<VultureWallFaceSlot>();
            const activePlaneDirections = new Set<VultureWallFaceSlot>();
            for (const sliceConfig of wallPlaneConfig.slices) {
              const innerWallMaterial =
                this.dependencies.wallOverlays.ensureVultureWallFaceOverlayMaterial(
                  mesh,
                  sliceConfig.innerTextureFace,
                  sliceConfig.innerLookup,
                  clampedDarken,
                  overlay.material.opacity,
                );
              innerWallMaterial.side = THREE.FrontSide;
              innerWallMaterial.transparent = true;
              const outerWallMaterial =
                this.dependencies.wallOverlays.ensureVultureWallFaceOverlayMaterial(
                  mesh,
                  sliceConfig.outerTextureFace,
                  sliceConfig.outerLookup,
                  clampedDarken,
                  overlay.material.opacity,
                );
              outerWallMaterial.side = THREE.FrontSide;
              outerWallMaterial.transparent = true;
              const planeSlice = this.dependencies.wallOverlays.ensureVultureWallPlaneSlice(
                mesh,
                sliceConfig.direction,
              );
              this.dependencies.wallOverlays.applyVultureWallPlaneSliceTransform(
                planeSlice,
                sliceConfig.direction,
              );
              planeSlice.frontMesh.renderOrder =
                this.dependencies.wallOverlays.vultureFrontWallPlaneRenderOrder;
              planeSlice.backMesh.renderOrder =
                this.dependencies.wallOverlays.vultureBackWallPlaneRenderOrder;
              planeSlice.frontMesh.material = innerWallMaterial;
              planeSlice.backMesh.material = outerWallMaterial;
              usedTextureFaces.add(sliceConfig.innerTextureFace);
              usedTextureFaces.add(sliceConfig.outerTextureFace);
              activePlaneDirections.add(sliceConfig.direction);
            }
            for (const face of ["west", "north", "east", "south"] as const) {
              if (!usedTextureFaces.has(face)) {
                this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh, face);
              }
              if (!activePlaneDirections.has(face)) {
                this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh, face);
              }
            }
            this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
            mesh.material = [
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
              this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            ];
          }
        }
      } else if (shouldUseVultureDoorPlane && useTiles) {
        this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
        const doorWallX =
          typeof mesh.userData?.tileX === "number" &&
          Number.isFinite(mesh.userData.tileX)
            ? Math.trunc(mesh.userData.tileX)
            : null;
        const doorWallY =
          typeof mesh.userData?.tileY === "number" &&
          Number.isFinite(mesh.userData.tileY)
            ? Math.trunc(mesh.userData.tileY)
            : null;
        const doorwayPlaneApplied = this.dependencies.wallOverlays.applyVultureDoorPlane(
          mesh,
          tileTextureSourceGlyph,
          tileIndex,
          doorWallX,
          doorWallY,
          clampedDarken,
          overlay.material.opacity,
          wallOrientationChar,
        );
        if (doorwayPlaneApplied) {
          mesh.material = [
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
            this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
          ];
        } else {
          this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
          mesh.material = wallSideOverrideMaterial
            ? [
                wallSideOverrideMaterial, // right edge
                wallSideOverrideMaterial, // left edge
                wallSideOverrideMaterial, // front
                wallSideOverrideMaterial, // back
                overlay.material, // top edge
                baseMaterial, // bottom edge
              ]
            : [
                overlay.material, // right edge
                overlay.material, // left edge
                overlay.material, // front
                overlay.material, // back
                overlay.material, // top edge
                baseMaterial, // bottom edge
              ];
        }
      } else if (isDoorWall && useTiles) {
        this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
        mesh.material = wallSideOverrideMaterial
          ? [
              wallSideOverrideMaterial, // right edge
              wallSideOverrideMaterial, // left edge
              wallSideOverrideMaterial, // front
              wallSideOverrideMaterial, // back
              overlay.material, // top edge
              baseMaterial, // bottom edge
            ]
          : [
              overlay.material, // right edge
              overlay.material, // left edge
              overlay.material, // front
              overlay.material, // back
              overlay.material, // top edge
              baseMaterial, // bottom edge
            ];
      } else if (useTiles) {
        this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
        const leftRightWallMaterial =
          wallSideOverrideMaterial ?? overlay.material;
        const frontBackWallMaterial =
          wallSideFrontBackOverrideMaterial ??
          (shouldRotateHorizontalWallSideTiles
            ? overlay.material
            : leftRightWallMaterial);
        if (shouldUseIronBarsWallPlanes) {
          this.dependencies.wallOverlays.applyIronBarsWallPlaneOverlay(
            mesh,
            tileIndex,
            tileTextureSourceGlyph ?? sourceGlyph,
            tileTextureMaterialKind,
            clampedDarken,
            overlay.material.opacity,
          );
          mesh.material = wallSideOverrideMaterial
            ? [
                leftRightWallMaterial,
                leftRightWallMaterial,
                this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
                this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
                overlay.material,
                baseMaterial,
              ]
            : [
                overlay.material,
                overlay.material,
                this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
                this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial,
                overlay.material,
                baseMaterial,
              ];
        } else {
          this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
          mesh.material = wallSideOverrideMaterial
            ? [
                leftRightWallMaterial,
                leftRightWallMaterial,
                frontBackWallMaterial,
                frontBackWallMaterial,
                overlay.material,
                baseMaterial,
              ]
            : [
                overlay.material,
                overlay.material,
                overlay.material,
                overlay.material,
                overlay.material,
                baseMaterial,
              ];
        }
      } else if (solidWallMaterial) {
        this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
        // Every face uses the same opaque material. A material array makes
        // Three submit all six box groups separately, including in each XR eye.
        mesh.material = solidWallMaterial;
      } else {
        this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
        mesh.material = [
          baseMaterial,
          baseMaterial,
          baseMaterial,
          baseMaterial,
          overlay.material,
          baseMaterial,
        ];
      }
    } else if (shouldUseVultureOpenDoorPlane && useTiles) {
      this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeWallSideTileOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
      const doorX =
        typeof mesh.userData?.tileX === "number" &&
        Number.isFinite(mesh.userData.tileX)
          ? Math.trunc(mesh.userData.tileX)
          : null;
      const doorY =
        typeof mesh.userData?.tileY === "number" &&
        Number.isFinite(mesh.userData.tileY)
          ? Math.trunc(mesh.userData.tileY)
          : null;
      const openDoorPlaneApplied = this.dependencies.wallOverlays.applyVultureDoorPlane(
        mesh,
        tileTextureSourceGlyph,
        tileIndex,
        doorX,
        doorY,
        clampedDarken,
        overlay.material.opacity,
        wallOrientationChar,
        true,
        false,
      );
      if (openDoorPlaneApplied) {
        // Prevent floor-projected sprite flattening; draw doorway sprite on a
        // centered transparent plane instead.
        mesh.material = this.dependencies.wallOverlays.vultureInvisibleSurfaceMaterial;
      } else {
        this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
        mesh.material = overlay.material;
      }
    } else {
      this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeWallSideTileOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
      mesh.material = overlay.material;
    }
    this.applyWallBackSideVisibilityForCurrentPlayMode(mesh);
  }

  applyWallBackSideVisibilityForCurrentPlayMode(
    mesh: THREE.Mesh,
  ): void {
    const vultureOverlay = mesh.userData?.vultureWallPlaneOverlay as
      | VultureWallPlaneOverlay
      | undefined;
    if (vultureOverlay) {
      const showBackWallPlanes = !this.dependencies.movementInput.isFpsMode();
      for (const direction of ["west", "north", "east", "south"] as const) {
        const slice = vultureOverlay[direction];
        if (!slice) {
          continue;
        }
        slice.frontMesh.visible = true;
        slice.backMesh.visible = showBackWallPlanes;
      }
      return;
    }
    const ironBarsOverlay = mesh.userData?.ironBarsWallPlaneOverlay as
      | IronBarsWallPlaneOverlay
      | undefined;
    if (ironBarsOverlay) {
      if (!this.dependencies.movementInput.isFpsMode()) {
        ironBarsOverlay.frontMesh.visible = true;
        ironBarsOverlay.backMesh.visible = true;
        return;
      }
      const tileX =
        typeof mesh.userData?.tileX === "number" &&
        Number.isFinite(mesh.userData.tileX)
          ? Math.trunc(mesh.userData.tileX)
          : null;
      const tileY =
        typeof mesh.userData?.tileY === "number" &&
        Number.isFinite(mesh.userData.tileY)
          ? Math.trunc(mesh.userData.tileY)
          : null;
      if (tileX === null || tileY === null) {
        ironBarsOverlay.frontMesh.visible = true;
        ironBarsOverlay.backMesh.visible = false;
        return;
      }
      const centerY = -tileY * TILE_SIZE;
      const axisEpsilon = TILE_SIZE * 0.06;
      const cameraAxisDelta = this.dependencies.camera.camera.position.y - centerY;
      const playerAxisDelta = this.dependencies.playerMovement.playerPos.y * -TILE_SIZE - centerY;
      const resolvedSide =
        cameraAxisDelta > axisEpsilon
          ? 1
          : cameraAxisDelta < -axisEpsilon
            ? -1
            : playerAxisDelta > axisEpsilon
              ? 1
              : playerAxisDelta < -axisEpsilon
                ? -1
                : -1;
      ironBarsOverlay.frontMesh.visible = resolvedSide <= 0;
      ironBarsOverlay.backMesh.visible = resolvedSide >= 0;
      return;
    }
  }

  getMaterialByKind(kind: TileMaterialKind): THREE.MeshLambertMaterial {
    switch (kind) {
      case "floor":
        return this.materials.floor;
      case "stairs_up":
        return this.materials.stairs_up;
      case "stairs_down":
        return this.materials.stairs_down;
      case "wall":
        return this.materials.wall;
      case "dark_wall":
        return this.materials.dark_wall;
      case "door":
        return this.materials.door;
      case "dark":
        return this.materials.dark;
      case "water":
        return this.materials.water;
      case "trap":
        return this.materials.trap;
      case "feature":
        return this.materials.feature;
      case "fountain":
        return this.materials.fountain;
      case "player":
        return this.materials.player;
      case "monster_hostile":
        return this.materials.monster_hostile;
      case "monster_friendly":
        return this.materials.monster_friendly;
      case "monster_neutral":
        return this.materials.monster_neutral;
      case "item":
        return this.materials.item;
      case "effect_warning":
        return this.materials.effect_warning;
      case "effect_zap":
        return this.materials.effect_zap;
      case "effect_explode":
        return this.materials.effect_explode;
      case "effect_swallow":
        return this.materials.effect_swallow;
      default:
        return this.materials.default;
    }
  }

  createInferredDarkWallSolidColorGridTexture(
    colorHex: string,
    darknessPercent: number,
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) {
      const fallback = document.createElement("canvas");
      fallback.width = 1;
      fallback.height = 1;
      const texture = new THREE.CanvasTexture(fallback);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      return texture;
    }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = colorHex;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const solid = new THREE.Color(colorHex);
    const safeDarknessPercent =
      typeof darknessPercent === "number" && Number.isFinite(darknessPercent)
        ? darknessPercent
        : 15;
    const darknessScale =
      1 - Math.max(0, Math.min(100, safeDarknessPercent)) / 100;
    const grid = solid.clone().multiplyScalar(darknessScale);
    context.fillStyle = `#${grid.getHexString()}`;
    const lineWidth = 2;
    // One cell per block face: draw only an outer border.
    context.fillRect(0, 0, canvas.width, lineWidth); // top
    context.fillRect(0, canvas.height - lineWidth, canvas.width, lineWidth); // bottom
    context.fillRect(0, 0, lineWidth, canvas.height); // left
    context.fillRect(canvas.width - lineWidth, 0, lineWidth, canvas.height); // right
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  getInferredDarkWallSolidColorMaterial(
    colorHex: string,
    gridEnabled: boolean,
    gridDarknessPercent: number,
  ): THREE.MeshLambertMaterial {
    const normalizedColor = String(colorHex || "")
      .trim()
      .toLowerCase();
    const normalizedDarkness = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          typeof gridDarknessPercent === "number" &&
            Number.isFinite(gridDarknessPercent)
            ? gridDarknessPercent
            : 15,
        ),
      ),
    );
    const cacheKey = `${normalizedColor}|grid:${gridEnabled ? 1 : 0}|dark:${normalizedDarkness}`;
    const cached = this.inferredDarkWallSolidColorMaterialCache.get(cacheKey);
    if (cached) {
      return cached.material;
    }
    const material = this.materials.dark_wall.clone();
    let texture: THREE.CanvasTexture | null = null;
    if (gridEnabled) {
      texture = this.createInferredDarkWallSolidColorGridTexture(
        normalizedColor,
        normalizedDarkness,
      );
      material.map = texture;
      material.color.set("#ffffff");
    } else {
      material.map = null;
      material.color.set(normalizedColor);
    }
    material.needsUpdate = true;
    this.dependencies.lighting.patchMaterialForVignette(material);
    this.inferredDarkWallSolidColorMaterialCache.set(cacheKey, {
      material,
      texture,
    });
    return material;
  }
}
