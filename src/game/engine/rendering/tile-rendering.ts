import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import {
  classifyTileBehavior,
  getDefaultDarkFloorGlyph,
  getDefaultFloorGlyph,
  getOpenDoorGlyphFrom,
  isDoorwayCmapGlyph,
  isSinkCmapGlyph
} from "../../glyphs/behavior";
import { resolveAsciiGlyphPresentation } from "../../ascii-color-mode";
import { getTerminalColorHex } from "../../terminal/terminal-display";
import type { TileEffectKind, TileMaterialKind } from "../../glyphs";
import type { TerrainSnapshot, TileMap } from "../../types";
import type { TileUpdateOptions, FpsChamferWallUvRotation } from "../shared/types";
import type { DarkCorridorInference } from "../world/dark-corridor-inference";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "./entity-billboards";
import type { FloorOcclusion } from "./floor-occlusion";
import type { FpsDiagnostics } from "../diagnostics/fps-diagnostics";
import type { GlyphTextures } from "./glyph-textures";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { Lighting } from "./lighting";
import type { Minimap } from "../ui/minimap";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { RenderPipeline } from "./render-pipeline";
import type { RuntimeEntityTracking } from "../world/runtime-entity-tracking";
import type { TerminalRendering } from "./terminal-rendering";
import type { TileMaterials } from "./tile-materials";
import type { TilesetAssets } from "./tileset-assets";
import type { TileUpdates } from "../world/tile-updates";
import type { VultureWalls } from "./vulture-walls";
import type { WallGeometry } from "./wall-geometry";
import type { WallOverlays } from "./wall-overlays";
import type { WorldClassification } from "../world/world-classification";

export interface TileRenderingDependencies {
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "addInferredDarkCorridorTile"
    | "inferredDarkCorridorTileFlags"
    | "inferredDarkCorridorWallTiles"
    | "removeInferredDarkCorridorTile"
    | "resolveInferredDarkCorridorWallSolidColorGridDarknessPercent"
    | "resolveInferredDarkCorridorWallSolidColorGridEnabled"
    | "resolveInferredDarkCorridorWallSolidColorHex"
    | "resolveInferredDarkCorridorWallTileTextureIndex"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "ensureMonsterBillboard"
    | "monsterBillboards"
    | "removeEntityBlobShadow"
    | "removeMonsterBillboard"
    | "resolveStandardBillboardRenderOrder"
    | "shouldShowPetHighlightHeart"
  >;
  readonly floorOcclusion: Pick<
    FloorOcclusion,
    "refreshFloorBlockAmbientOcclusionNear"
    | "removeFloorBlockAmbientOcclusionOverlay"
    | "removeTrimmedDoorInsetAmbientOcclusionOverlay"
  >;
  readonly fpsDiagnostics: Pick<
    FpsDiagnostics,
    "logAsciiPlayerTileDebug"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "asciiFriendlyGlyphTextColor"
    | "disposeGlyphOverlay"
    | "glyphOverlayMap"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "lastKnownTerrain"
  >;
  readonly lighting: Pick<
    Lighting,
    "markLightingDirty"
  >;
  readonly minimap: Pick<
    Minimap,
    "queueMinimapTileUpdate"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "getActiveAsciiPendingPlayerTile"
    | "getFpsPlayerTileRelationFlags"
    | "hasSeenPlayerPosition"
    | "playerPos"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "normalizeRuntimeTrackedEntityId"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
    | "resolveSlashEmTerminalCmapIndex"
    | "terminalRenderOptionStates"
    | "updateTerminalCell"
  >;
  readonly tileMaterials: Pick<
    TileMaterials,
    "applyGlyphMaterial"
    | "getMaterialByKind"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "isNh5DarkCorridorWallVariantForLegacyTileset"
    | "shouldUseVultureTiles"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "hasExplicitPlayerVisual"
    | "maybeRequestRuntimeTileRefreshForFpsCacheAssumption"
    | "shouldKeepFarLookPlayerBillboardVisible"
  >;
  readonly vultureWalls: Pick<
    VultureWalls,
    "refreshVultureWallMaterialsNear"
  >;
  readonly wallGeometry: Pick<
    WallGeometry,
    "computeFpsWallChamferMask"
    | "getFpsChamferMaterialKindForWall"
    | "getFpsClosedDoorChamferTransform"
    | "getFpsWallGeometry"
    | "refreshFpsWallChamferGeometryNear"
    | "resolveFpsChamferWallUvRotation"
    | "shouldUseChamferedWallGeometry"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "alignTransparentWallGroundPlaneOverlayToTile"
    | "applyRevealOpacityToAuxiliaryOverlays"
    | "applyTransparentWallGroundPlaneOverlay"
    | "disposeIronBarsWallPlaneOverlay"
    | "disposeTransparentWallGroundPlaneOverlay"
    | "disposeVultureDoorPlaneOverlay"
    | "disposeVultureWallFaceOverlay"
    | "disposeVultureWallPlaneOverlay"
    | "disposeWallSideTileOverlay"
    | "setTransparentWallGroundPlaneOverlayOpaqueMode"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "flatFeatureUnderPlayerCache"
    | "getFpsPlayerTileBillboardBehaviorFromCache"
    | "getPlayerTileUnderlaySnapshotFromCache"
    | "getPlayerUnderlayBillboardKey"
    | "isAltarOrTombstoneLikeBehavior"
    | "isDamageFlashableBehavior"
    | "isDisallowedSpecialDotFloorBehavior"
    | "isLootLikeBehavior"
    | "isMonsterLikeBehavior"
    | "isOpenDoorFloorBehavior"
    | "isPersistentTerrainKind"
    | "isUndiscoveredKind"
    | "resolveFloorBehaviorFromNeighborTiles"
    | "resolveFloorBehaviorUnderFpsPlayerTileBillboard"
    | "resolveFpsFloorUnderlayBehaviorFromCache"
    | "resolveNormalRoomFloorBehavior"
    | "resolveRaisedSpecialTileFloorBehavior"
    | "resolveTransparentOpenDoorwayFloorBehavior"
    | "shouldFlattenVoidOrUnknownTileFor367"
    | "shouldKeepFloorGlyphUnderFpsAsciiPlayer"
    | "shouldRenderFlatFeatureUnderPlayer"
    | "shouldShowUnderPlayerFeaturesInOverheadTilesMode"
    | "shouldUseRaisedSpecialTileBillboardInTiles"
    | "shouldUseTransparentTileFloorUnderlay"
    | "shouldUseTransparentWallGroundPlaneUnderlay"
    | "suppressedLootLikeUnderPlayerCacheKeys"
  >;
}

/** Tile mesh construction and transient reveal/effect animation */
export class TileRendering {
  constructor(private readonly dependencies: TileRenderingDependencies) {}

  tileMap: TileMap = new Map();

  // Fade-in animation state for newly discovered tiles.
  tileRevealStartMs: Map<string, number> = new Map();

  tileRevealDurationMs: number = 225;

  readonly tileVisualScaleFps = 1;

  // Pre-create geometries and materials
  floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

  effectColors: Record<TileEffectKind, THREE.Color> = {
    warning: new THREE.Color(0xffd166),
    zap: new THREE.Color(0x7df9ff),
    explode: new THREE.Color(0xffb46b),
    swallow: new THREE.Color(0xd8a8ff),
  };

  readonly effectPulseColor = new THREE.Color(0xffffff);

  readonly activeEffectTileKeys: Set<string> = new Set();

  updateTile(
    x: number,
    y: number,
    glyph: number,
    char?: string,
    color?: number,
    options: TileUpdateOptions = {},
  ): void {
    if (this.dependencies.terminalRendering.isTerminalDisplayMode()) {
      // The simulated terminal shows only what the runtime printed;
      // synthetic inferred-wall tiles are a 3D-mode presentation aid.
      if (options.inferredDarkCorridorWall !== true) {
        this.dependencies.terminalRendering.updateTerminalCell(x, y, glyph, char, color, options);
      }
      return;
    }
    const key = `${x},${y}`;
    const isInferredDarkCorridorWall =
      options.inferredDarkCorridorWall === true;
    const restartRevealFade = options.restartRevealFade === true;
    const hadInferredDarkCorridorWall =
      this.dependencies.darkCorridorInference.inferredDarkCorridorWallTiles.has(key) ||
      this.dependencies.darkCorridorInference.inferredDarkCorridorTileFlags.has(key);
    let mesh = this.tileMap.get(key);
    const previousTerrainSnapshot = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
    const runtimeSymidxForTileBehavior =
      typeof options.runtimeSymidx === "number" &&
      Number.isFinite(options.runtimeSymidx) &&
      options.runtimeSymidx >= 0
        ? Math.trunc(options.runtimeSymidx)
        : null;
    const behavior = classifyTileBehavior({
      glyph,
      runtimeChar: char ?? null,
      runtimeColor: typeof color === "number" ? color : null,
      runtimeTileIndex:
        typeof options.runtimeTileIndex === "number"
          ? options.runtimeTileIndex
          : null,
      runtimeSymidx: runtimeSymidxForTileBehavior,
      priorTerrain: previousTerrainSnapshot,
    });
    const runtimeTileIndexForDarkCorridorCompatibility =
      typeof options.runtimeTileIndex === "number" &&
      Number.isFinite(options.runtimeTileIndex)
        ? Math.trunc(options.runtimeTileIndex)
        : typeof behavior.effective.tileIndex === "number" &&
            Number.isFinite(behavior.effective.tileIndex)
          ? Math.trunc(behavior.effective.tileIndex)
          : -1;
    const darkCorridorWallCompatibilityActive =
      isInferredDarkCorridorWall ||
      this.dependencies.tilesetAssets.isNh5DarkCorridorWallVariantForLegacyTileset(
        glyph,
        runtimeTileIndexForDarkCorridorCompatibility,
        behavior.materialKind,
        runtimeSymidxForTileBehavior,
      );
    const isMonsterLikeCharacter = this.dependencies.worldClassification.isMonsterLikeBehavior(behavior);
    const isLootLikeCharacter = this.dependencies.worldClassification.isLootLikeBehavior(behavior);
    const runtimeFloorUnderlaySnapshot: TerrainSnapshot | null =
      typeof options.runtimeFloorUnderlayGlyph === "number" &&
      Number.isFinite(options.runtimeFloorUnderlayGlyph)
        ? {
            glyph: Math.trunc(options.runtimeFloorUnderlayGlyph),
            char:
              typeof options.runtimeFloorUnderlayChar === "string"
                ? options.runtimeFloorUnderlayChar
                : undefined,
            color:
              typeof options.runtimeFloorUnderlayColor === "number" &&
              Number.isFinite(options.runtimeFloorUnderlayColor)
                ? Math.trunc(options.runtimeFloorUnderlayColor)
                : undefined,
            tileIndex:
              typeof options.runtimeFloorUnderlayTileIndex === "number" &&
              Number.isFinite(options.runtimeFloorUnderlayTileIndex) &&
              options.runtimeFloorUnderlayTileIndex >= 0
                ? Math.trunc(options.runtimeFloorUnderlayTileIndex)
                : undefined,
            symidx:
              typeof options.runtimeFloorUnderlaySymidx === "number" &&
              Number.isFinite(options.runtimeFloorUnderlaySymidx) &&
              options.runtimeFloorUnderlaySymidx >= 0
                ? Math.trunc(options.runtimeFloorUnderlaySymidx)
                : undefined,
          }
        : null;
    const isSink = isSinkCmapGlyph(behavior.effective.glyph);
    const isFountain = behavior.materialKind === "fountain";
    const isStairsUp = behavior.materialKind === "stairs_up";
    const isStairsDown = behavior.materialKind === "stairs_down";
    const isAltarOrTombstone = this.dependencies.worldClassification.isAltarOrTombstoneLikeBehavior(behavior);
    const isStatue = behavior.effective.kind === "statue";
    const useTiles = this.dependencies.engineState.clientOptions.tilesetMode === "tiles";
    const isOverheadAsciiMode = !useTiles && !this.dependencies.movementInput.isFpsMode();
    const nowMs = Date.now();
    const runtimeTrackedEntityId = this.dependencies.runtimeEntityTracking.normalizeRuntimeTrackedEntityId(
      options.runtimeTrackedEntityId,
    );
    const isRuntimeTrackedPlayerTileInFps =
      this.dependencies.movementInput.isFpsMode() && runtimeTrackedEntityId === 0;
    const isCurrentKnownPlayerTile =
      this.dependencies.playerMovement.hasSeenPlayerPosition &&
      x === this.dependencies.playerMovement.playerPos.x &&
      y === this.dependencies.playerMovement.playerPos.y;
    const pendingAsciiPlayerTile = this.dependencies.playerMovement.getActiveAsciiPendingPlayerTile(nowMs);
    const isPendingAsciiPlayerTile =
      pendingAsciiPlayerTile !== null &&
      x === pendingAsciiPlayerTile.x &&
      y === pendingAsciiPlayerTile.y;
    const hasPendingAsciiPlayerTile = pendingAsciiPlayerTile !== null;
    const isPlayerPosCoordinate =
      x === this.dependencies.playerMovement.playerPos.x && y === this.dependencies.playerMovement.playerPos.y;
    const shouldTraceAsciiPlayerTile =
      !this.dependencies.movementInput.isFpsMode() &&
      !useTiles &&
      (isCurrentKnownPlayerTile ||
        isPlayerPosCoordinate ||
        isPendingAsciiPlayerTile);
    const tileRelation = this.dependencies.playerMovement.getFpsPlayerTileRelationFlags(
      x,
      y,
      nowMs,
      behavior,
    );
    const isFpsStepDestinationTile = tileRelation.isStepDestinationTile;
    const shouldSuppressRecentPreviousPlayerTileInFps =
      tileRelation.isTrailSuppressedTile &&
      (tileRelation.isPlayerGlyph ||
        tileRelation.isPlayerMaterial ||
        isRuntimeTrackedPlayerTileInFps);
    const isPredictedFpsPlayerTile = tileRelation.isPredictedPlayerTile;
    const shouldKeepVisiblePlayerBillboardInFarLook =
      this.dependencies.tileUpdates.shouldKeepFarLookPlayerBillboardVisible() &&
      tileRelation.isCurrentPlayerTile &&
      this.dependencies.tileUpdates.hasExplicitPlayerVisual(behavior, char);
    const shouldSuppressPlayerTileVisualInFps =
      this.dependencies.movementInput.isFpsMode() &&
      ((isRuntimeTrackedPlayerTileInFps &&
        !shouldKeepVisiblePlayerBillboardInFarLook) ||
        ((tileRelation.isPlayerGlyph || tileRelation.isPlayerMaterial) &&
          !shouldKeepVisiblePlayerBillboardInFarLook) ||
        isFpsStepDestinationTile ||
        isPredictedFpsPlayerTile ||
        (tileRelation.isCurrentPlayerTile &&
          !shouldKeepVisiblePlayerBillboardInFarLook) ||
        shouldSuppressRecentPreviousPlayerTileInFps);
    const fpsPlayerTileBillboardBehavior = tileRelation.isCurrentPlayerTile
      ? this.dependencies.worldClassification.getFpsPlayerTileBillboardBehaviorFromCache(key, behavior)
      : null;
    const farLookPlayerBillboardBehavior =
      shouldKeepVisiblePlayerBillboardInFarLook ? behavior : null;
    const shouldKeepFpsPlayerTileBillboard =
      fpsPlayerTileBillboardBehavior !== null ||
      farLookPlayerBillboardBehavior !== null;

    const shouldElevateEntity =
      isMonsterLikeCharacter ||
      isLootLikeCharacter ||
      (this.dependencies.movementInput.isFpsMode() && isAltarOrTombstone) ||
      (useTiles &&
        (isSink || isFountain || isStairsUp || isAltarOrTombstone || isStatue));
    const shouldUseElevatedBillboard =
      shouldElevateEntity &&
      (useTiles || this.dependencies.movementInput.isFpsMode() || isOverheadAsciiMode);

    const isUndiscovered = this.dependencies.worldClassification.isUndiscoveredKind(behavior.effective.kind);

    if (
      !isInferredDarkCorridorWall &&
      hadInferredDarkCorridorWall &&
      isUndiscovered
    ) {
      // Keep inferred corridor-wall memory when runtime emits an unknown/undiscovered
      // refresh for out-of-sight tiles. Only concrete terrain should overwrite it.
      return;
    }

    if (!isInferredDarkCorridorWall) {
      this.dependencies.darkCorridorInference.removeInferredDarkCorridorTile(key);
    } else {
      this.dependencies.darkCorridorInference.addInferredDarkCorridorTile(key, x, y);
    }

    if (isUndiscovered) {
      if (mesh) {
        this.dependencies.wallOverlays.disposeWallSideTileOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeTransparentWallGroundPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
        this.dependencies.renderPipeline.scene.remove(mesh);
        this.tileMap.delete(key);
      }
      this.dependencies.floorOcclusion.removeFloorBlockAmbientOcclusionOverlay(key);
      this.dependencies.floorOcclusion.removeTrimmedDoorInsetAmbientOcclusionOverlay(key);
      this.dependencies.worldClassification.flatFeatureUnderPlayerCache.delete(key);
      this.dependencies.worldClassification.suppressedLootLikeUnderPlayerCacheKeys.delete(key);
      this.dependencies.entityBillboards.removeMonsterBillboard(key);
      this.activeEffectTileKeys.delete(key);
      const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
      if (overlay) {
        this.dependencies.glyphTextures.disposeGlyphOverlay(overlay);
        this.dependencies.glyphTextures.glyphOverlayMap.delete(key);
      }
      this.dependencies.minimap.queueMinimapTileUpdate(x, y, behavior, true);
      this.dependencies.wallGeometry.refreshFpsWallChamferGeometryNear(x, y);
      this.dependencies.floorOcclusion.refreshFloorBlockAmbientOcclusionNear(x, y);
      this.dependencies.vultureWalls.refreshVultureWallMaterialsNear(x, y);
      this.dependencies.lighting.markLightingDirty();
      return;
    }

    if (!isInferredDarkCorridorWall) {
      const shouldCacheFlatUnderPlayer =
        this.dependencies.worldClassification.shouldRenderFlatFeatureUnderPlayer(behavior);
      const shouldSuppressLootLikeFlatFeatureCache =
        isCurrentKnownPlayerTile &&
        isLootLikeCharacter &&
        this.dependencies.worldClassification.suppressedLootLikeUnderPlayerCacheKeys.has(key);
      const previousFlatFeatureSnapshot =
        this.dependencies.worldClassification.flatFeatureUnderPlayerCache.get(key) ?? null;
      const previousFlatFeatureBehavior =
        previousFlatFeatureSnapshot !== null
          ? classifyTileBehavior({
              glyph: previousFlatFeatureSnapshot.glyph,
              runtimeChar: previousFlatFeatureSnapshot.char ?? null,
              runtimeColor:
                typeof previousFlatFeatureSnapshot.color === "number"
                  ? previousFlatFeatureSnapshot.color
                  : null,
              runtimeTileIndex:
                typeof previousFlatFeatureSnapshot.tileIndex === "number"
                  ? previousFlatFeatureSnapshot.tileIndex
                  : null,
              runtimeSymidx:
                typeof previousFlatFeatureSnapshot.symidx === "number"
                  ? previousFlatFeatureSnapshot.symidx
                  : null,
              priorTerrain: this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null,
            })
          : null;
      const shouldPreserveExistingUnderPlayerFeatureCache =
        isCurrentKnownPlayerTile &&
        this.dependencies.worldClassification.shouldShowUnderPlayerFeaturesInOverheadTilesMode() &&
        previousFlatFeatureBehavior !== null &&
        (this.dependencies.worldClassification.shouldRenderFlatFeatureUnderPlayer(previousFlatFeatureBehavior) ||
          this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(
            previousFlatFeatureBehavior,
          ));
      const resolvedTerrainSymidx =
        runtimeSymidxForTileBehavior !== null
          ? runtimeSymidxForTileBehavior
          : previousTerrainSnapshot &&
              previousTerrainSnapshot.glyph === glyph &&
              typeof previousTerrainSnapshot.symidx === "number" &&
              Number.isFinite(previousTerrainSnapshot.symidx)
            ? Math.trunc(previousTerrainSnapshot.symidx)
            : undefined;
      const resolvedFlatFeatureSymidx =
        runtimeSymidxForTileBehavior !== null
          ? runtimeSymidxForTileBehavior
          : previousFlatFeatureSnapshot &&
              previousFlatFeatureSnapshot.glyph === glyph &&
              typeof previousFlatFeatureSnapshot.symidx === "number" &&
              Number.isFinite(previousFlatFeatureSnapshot.symidx)
            ? Math.trunc(previousFlatFeatureSnapshot.symidx)
            : resolvedTerrainSymidx;
      if (this.dependencies.worldClassification.isPersistentTerrainKind(behavior.resolved.kind)) {
        this.dependencies.levelTerrainCache.lastKnownTerrain.set(key, {
          glyph,
          char: behavior.resolved.char ?? undefined,
          color: behavior.resolved.color ?? undefined,
          tileIndex: behavior.resolved.tileIndex,
          symidx: resolvedTerrainSymidx,
        });
      }
      if (shouldCacheFlatUnderPlayer) {
        if (shouldSuppressLootLikeFlatFeatureCache) {
          this.dependencies.worldClassification.flatFeatureUnderPlayerCache.delete(key);
        } else {
          this.dependencies.worldClassification.flatFeatureUnderPlayerCache.set(key, {
            glyph,
            char: behavior.resolved.char ?? undefined,
            color: behavior.resolved.color ?? undefined,
            tileIndex: behavior.resolved.tileIndex,
            symidx: resolvedFlatFeatureSymidx,
          });
          if (isLootLikeCharacter) {
            this.dependencies.worldClassification.suppressedLootLikeUnderPlayerCacheKeys.delete(key);
          }
        }
      } else if (
        !(this.dependencies.movementInput.isFpsMode() && shouldSuppressPlayerTileVisualInFps) &&
        !shouldPreserveExistingUnderPlayerFeatureCache
      ) {
        this.dependencies.worldClassification.flatFeatureUnderPlayerCache.delete(key);
      }
    }

    let renderBehavior = behavior;
    let tileGlyphChar = behavior.glyphChar;
    let tileTextColor = behavior.textColor;
    const shouldFlattenVoidOrUnknownTile =
      this.dependencies.worldClassification.shouldFlattenVoidOrUnknownTileFor367(
        behavior,
        isInferredDarkCorridorWall,
      );
    if (shouldFlattenVoidOrUnknownTile) {
      renderBehavior = {
        ...behavior,
        materialKind: "dark",
        geometryKind: "floor",
        isWall: false,
      };
    }
    const preferNormalModeAsciiUnderlayForFpsBillboards =
      this.dependencies.movementInput.isFpsMode() && !useTiles && shouldUseElevatedBillboard;

    // Billboard rendering: hide the duplicate entity glyph on the base tile
    // and resolve that tile from runtime or remembered terrain instead.
    if (shouldSuppressPlayerTileVisualInFps) {
      const defaultPlayerSuppressedGlyph = this.dependencies.movementInput.isFpsMode()
        ? getDefaultDarkFloorGlyph()
        : getDefaultFloorGlyph();
      const cachedFlatFeature = this.dependencies.worldClassification.getPlayerTileUnderlaySnapshotFromCache(
        key,
        runtimeFloorUnderlaySnapshot,
      );
      if (cachedFlatFeature) {
        const usingAssumedUnderlayFromCache =
          !this.dependencies.worldClassification.shouldRenderFlatFeatureUnderPlayer(behavior) &&
          !this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(behavior);
        if (usingAssumedUnderlayFromCache) {
          this.dependencies.tileUpdates.maybeRequestRuntimeTileRefreshForFpsCacheAssumption(
            key,
            "suppressed-player-underlay",
          );
        }
        renderBehavior = classifyTileBehavior({
          glyph: cachedFlatFeature.glyph,
          runtimeChar: cachedFlatFeature.char ?? null,
          runtimeColor:
            typeof cachedFlatFeature.color === "number"
              ? cachedFlatFeature.color
              : null,
          runtimeTileIndex:
            typeof cachedFlatFeature.tileIndex === "number"
              ? cachedFlatFeature.tileIndex
              : null,
          priorTerrain: cachedFlatFeature,
        });
        if (this.dependencies.movementInput.isFpsMode() && renderBehavior.isWall) {
          renderBehavior = classifyTileBehavior({
            glyph: getDefaultDarkFloorGlyph(),
            runtimeChar: ".",
            runtimeColor: null,
            priorTerrain: null,
          });
        }
        if (
          shouldKeepFpsPlayerTileBillboard &&
          fpsPlayerTileBillboardBehavior
        ) {
          renderBehavior = this.dependencies.worldClassification.resolveFloorBehaviorUnderFpsPlayerTileBillboard(
            key,
            fpsPlayerTileBillboardBehavior,
          );
        }
      } else {
        renderBehavior = classifyTileBehavior({
          glyph: defaultPlayerSuppressedGlyph,
          runtimeChar: ".",
          runtimeColor: null,
          priorTerrain: null,
        });
      }
      const shouldKeepFlatGlyphUnderPlayer =
        this.dependencies.worldClassification.shouldRenderFlatFeatureUnderPlayer(renderBehavior);
      const shouldKeepFloorGlyphUnderPlayerInFpsAscii =
        this.dependencies.worldClassification.shouldKeepFloorGlyphUnderFpsAsciiPlayer(renderBehavior);
      tileGlyphChar =
        shouldKeepFlatGlyphUnderPlayer ||
        shouldKeepFloorGlyphUnderPlayerInFpsAscii
          ? renderBehavior.glyphChar
          : " ";
      tileTextColor = renderBehavior.textColor;
    } else if (preferNormalModeAsciiUnderlayForFpsBillboards) {
      // In FPS ASCII mode, entity glyphs render on billboards; keep floor-style
      // terrain underlays on the tile to avoid hostile/player tint bleed.
      renderBehavior = this.dependencies.worldClassification.resolveFpsFloorUnderlayBehaviorFromCache(key);
      tileGlyphChar = renderBehavior.glyphChar;
      tileTextColor = renderBehavior.textColor;
    } else if (shouldUseElevatedBillboard) {
      if (
        isStairsUp ||
        isStairsDown ||
        isSink ||
        isFountain ||
        isAltarOrTombstone
      ) {
        renderBehavior = this.dependencies.worldClassification.resolveRaisedSpecialTileFloorBehavior();
      } else {
        let floorSnapshot = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
        if (!floorSnapshot && runtimeFloorUnderlaySnapshot) {
          floorSnapshot = runtimeFloorUnderlaySnapshot;
          this.dependencies.levelTerrainCache.lastKnownTerrain.set(key, runtimeFloorUnderlaySnapshot);
        }
        if (floorSnapshot) {
          const floorBehavior = classifyTileBehavior({
            glyph: floorSnapshot.glyph,
            runtimeChar: floorSnapshot.char ?? null,
            runtimeColor:
              typeof floorSnapshot.color === "number"
                ? floorSnapshot.color
                : null,
            runtimeTileIndex:
              typeof floorSnapshot.tileIndex === "number"
                ? floorSnapshot.tileIndex
                : null,
            priorTerrain: floorSnapshot,
          });
          const shouldForceCanonicalFloorForSpecialDotOverlayEntity =
            useTiles &&
            (isMonsterLikeCharacter || isLootLikeCharacter) &&
            this.dependencies.worldClassification.isDisallowedSpecialDotFloorBehavior(floorBehavior);
          if (shouldForceCanonicalFloorForSpecialDotOverlayEntity) {
            // Cached tile data is authoritative; if it resolves to a special
            // dot-floor variant (doorway/open-door-ish), normalize to canonical
            // room floor for entity underlays.
            renderBehavior = this.dependencies.worldClassification.resolveNormalRoomFloorBehavior();
          } else {
            const shouldKeepBaseFloorUnderRaisedSpecialInVulture =
              this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
              useTiles &&
              this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(floorBehavior);
            const shouldKeepBaseFloorUnderRaisedSpecialForPlayerTile =
              useTiles &&
              isCurrentKnownPlayerTile &&
              this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(floorBehavior);
            const shouldKeepBaseFloorUnderRaisedSpecialForOverlayEntity =
              useTiles &&
              (isMonsterLikeCharacter || isLootLikeCharacter) &&
              this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(floorBehavior);
            if (
              shouldKeepBaseFloorUnderRaisedSpecialInVulture ||
              shouldKeepBaseFloorUnderRaisedSpecialForPlayerTile ||
              shouldKeepBaseFloorUnderRaisedSpecialForOverlayEntity
            ) {
              // In Vulture mode, raised special tiles should remain billboards
              // while the tile underlay stays a floor texture. Apply the same
              // floor underlay rule for overlay entities (monster/loot/player)
              // so the cached fountain/stairs/etc. does not flatten onto the
              // floor mesh when an entity is rendered on top.
              renderBehavior = this.dependencies.worldClassification.resolveRaisedSpecialTileFloorBehavior();
            } else if (
              isMonsterLikeCharacter &&
              floorBehavior.materialKind === "door" &&
              floorBehavior.isWall
            ) {
              const openDoorGlyph = getOpenDoorGlyphFrom(floorSnapshot.glyph);
              renderBehavior =
                typeof openDoorGlyph === "number"
                  ? classifyTileBehavior({
                      glyph: openDoorGlyph,
                      runtimeChar: null,
                      runtimeColor:
                        typeof floorSnapshot.color === "number"
                          ? floorSnapshot.color
                          : null,
                      runtimeTileIndex: null,
                      priorTerrain: floorSnapshot,
                    })
                  : floorBehavior;
            } else {
              renderBehavior = floorBehavior;
            }
          }
          if (this.dependencies.movementInput.isFpsMode() && renderBehavior.isWall) {
            renderBehavior = classifyTileBehavior({
              glyph: getDefaultDarkFloorGlyph(),
              runtimeChar: ".",
              runtimeColor: null,
              priorTerrain: null,
            });
          }
        } else {
          const inferredNeighborFloorBehavior =
            (useTiles || isOverheadAsciiMode) &&
            (isMonsterLikeCharacter || isLootLikeCharacter)
              ? this.dependencies.worldClassification.resolveFloorBehaviorFromNeighborTiles(x, y)
              : null;
          if (inferredNeighborFloorBehavior) {
            // Newly seen overlay entities can borrow only an adjacent empty
            // floor/corridor underlay until authoritative terrain arrives.
            renderBehavior = inferredNeighborFloorBehavior;
          } else {
            const fallbackGlyph = this.dependencies.movementInput.isFpsMode()
              ? getDefaultDarkFloorGlyph()
              : getDefaultFloorGlyph();
            renderBehavior = classifyTileBehavior({
              glyph: fallbackGlyph,
              runtimeChar: ".",
              runtimeColor: null,
              priorTerrain: null,
            });
          }
        }
      }
      tileGlyphChar = isOverheadAsciiMode ? renderBehavior.glyphChar : " ";
      tileTextColor = renderBehavior.textColor;
    }
    if (shouldUseElevatedBillboard && renderBehavior.isWall) {
      const fallbackGlyph = this.dependencies.movementInput.isFpsMode()
        ? getDefaultDarkFloorGlyph()
        : getDefaultFloorGlyph();
      renderBehavior = classifyTileBehavior({
        glyph: fallbackGlyph,
        runtimeChar: ".",
        runtimeColor: null,
        priorTerrain: null,
      });
      if (!useTiles) {
        tileGlyphChar = renderBehavior.glyphChar;
      }
      tileTextColor = renderBehavior.textColor;
    }
    const isPlayerRelatedTileInFps =
      this.dependencies.movementInput.isFpsMode() &&
      (isRuntimeTrackedPlayerTileInFps ||
        tileRelation.isPlayerGlyph ||
        tileRelation.isPlayerMaterial ||
        isFpsStepDestinationTile ||
        isPredictedFpsPlayerTile ||
        tileRelation.isCurrentPlayerTile ||
        shouldSuppressRecentPreviousPlayerTileInFps);
    const hasAtGlyphForAsciiPlayerTint =
      tileGlyphChar === "@" || behavior.glyphChar === "@" || char === "@";
    if (isPlayerRelatedTileInFps) {
      // Player color should never leak onto FPS tile underlays.
      if (
        this.dependencies.worldClassification.isMonsterLikeBehavior(renderBehavior) ||
        renderBehavior.materialKind === "player"
      ) {
        renderBehavior = this.dependencies.worldClassification.resolveFpsFloorUnderlayBehaviorFromCache(key);
      }
      tileTextColor = renderBehavior.textColor;
    } else if (
      !this.dependencies.movementInput.isFpsMode() &&
      !useTiles &&
      (isPendingAsciiPlayerTile || isCurrentKnownPlayerTile) &&
      hasAtGlyphForAsciiPlayerTint
    ) {
      // Keep top-down ASCII player tile aligned with friendly/pet tint.
      if (renderBehavior.materialKind !== "monster_friendly") {
        renderBehavior = {
          ...renderBehavior,
          materialKind: "monster_friendly",
        };
      }
      tileTextColor = this.dependencies.glyphTextures.asciiFriendlyGlyphTextColor;
    }
    let glyphBackgroundColorHex: string | null = null;
    let runtimeAsciiBillboardGlyphChar: string | null = null;
    let runtimeAsciiBillboardTextColor: string | null = null;
    if (!useTiles) {
      const useReconstructedAsciiUnderlay = shouldUseElevatedBillboard;
      const asciiPresentation = resolveAsciiGlyphPresentation({
        mode: this.dependencies.engineState.clientOptions.asciiColorMode,
        glyphChar: tileGlyphChar,
        baseTextColor: tileTextColor,
        runtimeChar: useReconstructedAsciiUnderlay
          ? (renderBehavior.resolved.char ?? renderBehavior.glyphChar)
          : char,
        runtimeColor: useReconstructedAsciiUnderlay
          ? renderBehavior.resolved.color
          : color,
        runtimeGlyphFlags:
          !useReconstructedAsciiUnderlay &&
          typeof options.runtimeGlyphFlags === "number"
            ? options.runtimeGlyphFlags
            : null,
        terminalOptionStates: this.dependencies.terminalRendering.terminalRenderOptionStates,
        slashEmCmapIndex: this.dependencies.terminalRendering.resolveSlashEmTerminalCmapIndex(
          useReconstructedAsciiUnderlay
            ? renderBehavior.effective.glyph
            : glyph,
        ),
      });
      tileGlyphChar = asciiPresentation.glyphChar;
      tileTextColor = asciiPresentation.textColor;
      glyphBackgroundColorHex = asciiPresentation.backgroundColorHex;

      if (useReconstructedAsciiUnderlay) {
        const entityPresentation = resolveAsciiGlyphPresentation({
          mode: this.dependencies.engineState.clientOptions.asciiColorMode,
          glyphChar: behavior.glyphChar,
          baseTextColor: behavior.textColor,
          runtimeChar: char,
          runtimeColor: color,
          runtimeGlyphFlags:
            typeof options.runtimeGlyphFlags === "number"
              ? options.runtimeGlyphFlags
              : null,
          terminalOptionStates: this.dependencies.terminalRendering.terminalRenderOptionStates,
          slashEmCmapIndex: this.dependencies.terminalRendering.resolveSlashEmTerminalCmapIndex(glyph),
        });
        runtimeAsciiBillboardGlyphChar = entityPresentation.glyphChar;
        runtimeAsciiBillboardTextColor = entityPresentation.textColor;
      } else if (this.dependencies.engineState.clientOptions.asciiColorMode !== "nethack-3d") {
        runtimeAsciiBillboardTextColor = asciiPresentation.textColor;
      }
    }
    if (shouldTraceAsciiPlayerTile) {
      this.dependencies.fpsDiagnostics.logAsciiPlayerTileDebug("update_tile_color_resolution", x, y, {
        hasSeenPlayerPosition: this.dependencies.playerMovement.hasSeenPlayerPosition,
        isCurrentKnownPlayerTile,
        isPlayerPosCoordinate,
        isPendingAsciiPlayerTile,
        hasPendingAsciiPlayerTile,
        pendingAsciiPlayerTile,
        playerPos: { ...this.dependencies.playerMovement.playerPos },
        hasAtGlyphForAsciiPlayerTint,
        glyph,
        char: char ?? null,
        color: typeof color === "number" ? color : null,
        tileIndex:
          typeof options.runtimeTileIndex === "number"
            ? options.runtimeTileIndex
            : null,
        behaviorKind: behavior.effective.kind,
        behaviorDisposition: behavior.disposition,
        behaviorTextColor: behavior.textColor,
        renderKind: renderBehavior.effective.kind,
        renderMaterialKind: renderBehavior.materialKind,
        resolvedTileTextColor: tileTextColor,
      });
    }

    const material = this.dependencies.tileMaterials.getMaterialByKind(renderBehavior.materialKind);
    const wallChamferMask =
      this.dependencies.wallGeometry.shouldUseChamferedWallGeometry() &&
      renderBehavior.geometryKind === "wall" &&
      renderBehavior.materialKind !== "door"
        ? this.dependencies.wallGeometry.computeFpsWallChamferMask(x, y)
        : 0;
    const wallChamferMaterialKind =
      wallChamferMask > 0
        ? this.dependencies.wallGeometry.getFpsChamferMaterialKindForWall(renderBehavior.materialKind)
        : null;
    const wallChamferRotateUv: FpsChamferWallUvRotation =
      wallChamferMask > 0
        ? this.dependencies.wallGeometry.resolveFpsChamferWallUvRotation(tileGlyphChar, glyph)
        : "none";
    const geometry =
      renderBehavior.geometryKind === "wall"
        ? this.dependencies.wallGeometry.getFpsWallGeometry(wallChamferMask, wallChamferRotateUv)
        : this.floorGeometry;
    const targetZ = renderBehavior.isWall ? WALL_HEIGHT / 2 : 0;
    let createdMesh = false;

    if (!mesh) {
      createdMesh = true;
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.dependencies.renderPipeline.scene.add(mesh);
      this.tileMap.set(key, mesh);
      if (!this.tileRevealStartMs.has(key)) {
        this.tileRevealStartMs.set(key, performance.now());
      }
    } else {
      mesh.geometry = geometry;
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
    }

    if (restartRevealFade) {
      this.tileRevealStartMs.set(key, performance.now());
    }

    mesh.userData.tileX = x;
    mesh.userData.tileY = y;
    mesh.userData.isInferredDarkCorridorWall = isInferredDarkCorridorWall;
    mesh.userData.useDarkCorridorWallCompatibility =
      darkCorridorWallCompatibilityActive;
    mesh.userData.isWall = renderBehavior.isWall;
    mesh.userData.materialKind = renderBehavior.materialKind;
    mesh.userData.effectKind = behavior.effectKind;
    mesh.userData.disposition = behavior.disposition;
    mesh.userData.isPlayerGlyph = renderBehavior.isPlayerGlyph;
    mesh.userData.isMonsterLikeCharacter = isMonsterLikeCharacter;
    mesh.userData.isLootLikeCharacter = isLootLikeCharacter;
    mesh.userData.isDamageFlashableCharacter =
      this.dependencies.worldClassification.isDamageFlashableBehavior(behavior);
    mesh.userData.glyphChar = behavior.glyphChar;
    mesh.userData.sourceGlyph = glyph;
    mesh.userData.tileTextureSourceGlyph = renderBehavior.effective.glyph;
    const shouldCompositeTransparentFloorOnFlatTile =
      useTiles &&
      this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "none" &&
      this.dependencies.worldClassification.isOpenDoorFloorBehavior(renderBehavior);
    const shouldUseTransparentFloorUnderlayTreatmentOnTile =
      (shouldUseElevatedBillboard &&
        this.dependencies.worldClassification.shouldUseTransparentTileFloorUnderlay(renderBehavior)) ||
      shouldCompositeTransparentFloorOnFlatTile ||
      (this.dependencies.movementInput.isFpsMode() &&
        shouldSuppressPlayerTileVisualInFps &&
        this.dependencies.worldClassification.shouldRenderFlatFeatureUnderPlayer(renderBehavior));
    const shouldForceTileTextureBackgroundRemoval =
      useTiles &&
      !this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
      renderBehavior.isWall &&
      this.dependencies.worldClassification.shouldUseTransparentWallGroundPlaneUnderlay(renderBehavior) &&
      this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode !== "none";
    mesh.userData.tileTextureForceBackgroundRemoval =
      shouldForceTileTextureBackgroundRemoval;
    mesh.userData.glyphTextColor = tileTextColor;
    mesh.userData.glyphBackgroundColor = glyphBackgroundColorHex;
    mesh.userData.glyphDarkenFactor = behavior.darkenFactor;
    mesh.userData.glyphBaseColorHex = material.color.getHexString();
    const tileTextureIndex =
      this.dependencies.darkCorridorInference.resolveInferredDarkCorridorWallTileTextureIndex(
        renderBehavior.effective.tileIndex,
        darkCorridorWallCompatibilityActive,
      );
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
    mesh.userData.tileIndex = tileTextureIndex;
    mesh.userData.tileUseBackgroundReferenceTile =
      renderBehavior.useBackgroundReferenceTile === true;
    const shouldCompositeFloorUnderFlatFeatureOnTile =
      useTiles &&
      this.dependencies.engineState.clientOptions.tilesetBackgroundRemovalMode === "none" &&
      shouldUseTransparentFloorUnderlayTreatmentOnTile;
    if (shouldCompositeFloorUnderFlatFeatureOnTile) {
      const floorUnderlayBehavior = shouldCompositeTransparentFloorOnFlatTile
        ? this.dependencies.worldClassification.resolveTransparentOpenDoorwayFloorBehavior()
        : this.dependencies.worldClassification.shouldUseTransparentTileFloorUnderlay(renderBehavior)
          ? this.dependencies.worldClassification.resolveRaisedSpecialTileFloorBehavior()
          : this.dependencies.worldClassification.resolveFpsFloorUnderlayBehaviorFromCache(key);
      mesh.userData.floorUnderlaySourceGlyph =
        floorUnderlayBehavior.effective.glyph;
      mesh.userData.floorUnderlayTileIndex =
        typeof floorUnderlayBehavior.effective.tileIndex === "number" &&
        Number.isFinite(floorUnderlayBehavior.effective.tileIndex)
          ? Math.trunc(floorUnderlayBehavior.effective.tileIndex)
          : -1;
      mesh.userData.floorUnderlayUseBackgroundReferenceTile =
        floorUnderlayBehavior.useBackgroundReferenceTile === true;
      mesh.userData.floorUnderlayMaterialKind =
        floorUnderlayBehavior.materialKind;
    } else {
      delete mesh.userData.floorUnderlaySourceGlyph;
      delete mesh.userData.floorUnderlayTileIndex;
      delete mesh.userData.floorUnderlayUseBackgroundReferenceTile;
      delete mesh.userData.floorUnderlayMaterialKind;
    }
    mesh.userData.fpsWallChamferMask = wallChamferMask;
    mesh.userData.fpsWallChamferMaterialKind = wallChamferMaterialKind;
    mesh.userData.fpsWallChamferRotateUv = wallChamferRotateUv;
    const visualScale = this.dependencies.movementInput.isFpsMode() ? this.tileVisualScaleFps : 1;
    const isClosedDoorWallFromGlyph =
      typeof glyph === "number" &&
      Number.isFinite(glyph) &&
      isDoorwayCmapGlyph(Math.trunc(glyph)) &&
      getOpenDoorGlyphFrom(Math.trunc(glyph)) !== Math.trunc(glyph);
    const shouldApplyFpsClosedDoorChamferTrim =
      renderBehavior.isWall &&
      (renderBehavior.materialKind === "door" || isClosedDoorWallFromGlyph);
    const closedDoorSourceGlyph =
      typeof glyph === "number" && Number.isFinite(glyph)
        ? Math.trunc(glyph)
        : null;
    const fpsClosedDoorChamferTransform = shouldApplyFpsClosedDoorChamferTrim
      ? this.dependencies.wallGeometry.getFpsClosedDoorChamferTransform(x, y, closedDoorSourceGlyph)
      : {
          scaleX: 1,
          scaleY: 1,
          offsetX: 0,
          offsetY: 0,
        };
    mesh.position.set(
      x * TILE_SIZE + fpsClosedDoorChamferTransform.offsetX,
      -y * TILE_SIZE + fpsClosedDoorChamferTransform.offsetY,
      targetZ,
    );
    mesh.scale.set(
      visualScale * fpsClosedDoorChamferTransform.scaleX,
      visualScale * fpsClosedDoorChamferTransform.scaleY,
      visualScale,
    );
    const drawFpsFloorGrid =
      this.dependencies.movementInput.isFpsMode() && !darkCorridorWallCompatibilityActive;

    this.dependencies.tileMaterials.applyGlyphMaterial(
      key,
      mesh,
      material,
      tileGlyphChar,
      tileTextColor,
      renderBehavior.isWall,
      renderBehavior.darkenFactor,
      drawFpsFloorGrid,
      tileTextureIndex,
      inferredDarkWallSolidColorHex,
      inferredDarkWallSolidColorGridEnabled,
      inferredDarkWallSolidColorGridDarknessPercent,
      glyphBackgroundColorHex,
    );
    const hasFpsClosedDoorChamferTrim =
      this.dependencies.movementInput.isFpsMode() &&
      (fpsClosedDoorChamferTransform.scaleX < 0.9999 ||
        fpsClosedDoorChamferTransform.scaleY < 0.9999);
    const shouldRenderClosedDoorChamferExposedFloor =
      useTiles && hasFpsClosedDoorChamferTrim;
    const shouldRenderTransparentWallGroundPlane =
      useTiles &&
      renderBehavior.isWall &&
      ((!this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
        this.dependencies.worldClassification.shouldUseTransparentWallGroundPlaneUnderlay(renderBehavior)) ||
        shouldRenderClosedDoorChamferExposedFloor);
    if (shouldRenderTransparentWallGroundPlane) {
      const floorUnderlayBehavior = shouldRenderClosedDoorChamferExposedFloor
        ? this.dependencies.worldClassification.resolveNormalRoomFloorBehavior()
        : this.dependencies.worldClassification.resolveRaisedSpecialTileFloorBehavior();
      const floorUnderlayDarkenFactor = renderBehavior.darkenFactor;
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
      if (shouldRenderClosedDoorChamferExposedFloor) {
        this.dependencies.wallOverlays.setTransparentWallGroundPlaneOverlayOpaqueMode(mesh, true);
        this.dependencies.wallOverlays.alignTransparentWallGroundPlaneOverlayToTile(
          mesh,
          fpsClosedDoorChamferTransform.offsetX,
          fpsClosedDoorChamferTransform.offsetY,
          fpsClosedDoorChamferTransform.scaleX,
          fpsClosedDoorChamferTransform.scaleY,
        );
      } else {
        this.dependencies.wallOverlays.setTransparentWallGroundPlaneOverlayOpaqueMode(mesh, false);
      }
    } else {
      this.dependencies.wallOverlays.disposeTransparentWallGroundPlaneOverlay(mesh);
    }
    if (createdMesh || restartRevealFade) {
      const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
      if (overlay) {
        overlay.material.opacity = 0;
      }
      this.dependencies.wallOverlays.applyRevealOpacityToAuxiliaryOverlays(mesh, 0);
    }

    const isFpsPlayerTile =
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.playerMovement.hasSeenPlayerPosition &&
      shouldSuppressPlayerTileVisualInFps;
    const shouldKeepBillboardOnFpsPlayerTile =
      tileRelation.isCurrentPlayerTile &&
      ((isFpsPlayerTile && shouldKeepFpsPlayerTileBillboard) ||
        farLookPlayerBillboardBehavior !== null);
    const shouldRenderPlayerUnderlayBillboard =
      useTiles &&
      !isFpsPlayerTile &&
      this.dependencies.playerMovement.hasSeenPlayerPosition &&
      x === this.dependencies.playerMovement.playerPos.x &&
      y === this.dependencies.playerMovement.playerPos.y;
    let playerUnderlayBillboard: {
      glyphChar: string;
      textColor: string;
      tileIndex: number;
      sourceGlyph: number;
      materialKind: TileMaterialKind;
    } | null = null;
    if (shouldRenderPlayerUnderlayBillboard) {
      const shouldIncludeFlatUnderPlayerFeatures =
        this.dependencies.worldClassification.shouldShowUnderPlayerFeaturesInOverheadTilesMode();
      const floorSnapshotCandidates: TerrainSnapshot[] = [];
      const cachedUnderPlayerFeature =
        this.dependencies.worldClassification.flatFeatureUnderPlayerCache.get(key);
      if (cachedUnderPlayerFeature && shouldIncludeFlatUnderPlayerFeatures) {
        floorSnapshotCandidates.push(cachedUnderPlayerFeature);
      }
      const rememberedTerrain = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key);
      if (rememberedTerrain) {
        floorSnapshotCandidates.push(rememberedTerrain);
      }
      for (const floorSnapshot of floorSnapshotCandidates) {
        const floorBehavior = classifyTileBehavior({
          glyph: floorSnapshot.glyph,
          runtimeChar: floorSnapshot.char ?? null,
          runtimeColor:
            typeof floorSnapshot.color === "number"
              ? floorSnapshot.color
              : null,
          runtimeTileIndex:
            typeof floorSnapshot.tileIndex === "number"
              ? floorSnapshot.tileIndex
              : null,
          priorTerrain: floorSnapshot,
        });
        const shouldRenderAsPlayerUnderlay =
          this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(floorBehavior) ||
          (shouldIncludeFlatUnderPlayerFeatures &&
            this.dependencies.worldClassification.shouldRenderFlatFeatureUnderPlayer(floorBehavior));
        if (shouldRenderAsPlayerUnderlay) {
          playerUnderlayBillboard = {
            glyphChar: floorBehavior.glyphChar,
            textColor: floorBehavior.textColor,
            tileIndex:
              typeof floorBehavior.effective.tileIndex === "number" &&
              Number.isFinite(floorBehavior.effective.tileIndex)
                ? Math.trunc(floorBehavior.effective.tileIndex)
                : -1,
            sourceGlyph: floorBehavior.effective.glyph,
            materialKind: floorBehavior.materialKind,
          };
          break;
        }
      }
    }

    // Create or remove a billboard for any entity that should be elevated.
    const shouldRenderEntityBillboardFromTileState =
      shouldUseElevatedBillboard &&
      !isRuntimeTrackedPlayerTileInFps &&
      !tileRelation.isPlayerGlyph &&
      !tileRelation.isPlayerMaterial &&
      !isFpsStepDestinationTile &&
      !isPredictedFpsPlayerTile &&
      !shouldSuppressRecentPreviousPlayerTileInFps &&
      !tileRelation.isCurrentPlayerTile;
    const shouldRenderEntityBillboard =
      shouldRenderEntityBillboardFromTileState ||
      shouldKeepBillboardOnFpsPlayerTile;
    const billboardBehavior =
      shouldKeepBillboardOnFpsPlayerTile && fpsPlayerTileBillboardBehavior
        ? fpsPlayerTileBillboardBehavior
        : shouldKeepBillboardOnFpsPlayerTile && farLookPlayerBillboardBehavior
          ? farLookPlayerBillboardBehavior
          : behavior;
    const billboardEntityType = this.dependencies.worldClassification.isLootLikeBehavior(billboardBehavior)
      ? "loot"
      : "monster";
    const billboardIsWall = shouldKeepBillboardOnFpsPlayerTile
      ? billboardBehavior.isWall
      : renderBehavior.isWall;
    let entityUnderlayRaisedBillboard: {
      glyphChar: string;
      textColor: string;
      tileIndex: number;
      sourceGlyph: number;
      materialKind: TileMaterialKind;
    } | null = null;
    if (useTiles && shouldRenderEntityBillboard) {
      const floorSnapshot = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
      if (floorSnapshot) {
        const floorBehavior = classifyTileBehavior({
          glyph: floorSnapshot.glyph,
          runtimeChar: floorSnapshot.char ?? null,
          runtimeColor:
            typeof floorSnapshot.color === "number"
              ? floorSnapshot.color
              : null,
          runtimeTileIndex:
            typeof floorSnapshot.tileIndex === "number"
              ? floorSnapshot.tileIndex
              : null,
          priorTerrain: floorSnapshot,
        });
        const hasDistinctUnderlyingBillboardGlyph =
          floorBehavior.effective.glyph !== billboardBehavior.effective.glyph ||
          floorBehavior.effective.tileIndex !==
            billboardBehavior.effective.tileIndex;
        if (
          this.dependencies.worldClassification.shouldUseRaisedSpecialTileBillboardInTiles(floorBehavior) &&
          hasDistinctUnderlyingBillboardGlyph
        ) {
          entityUnderlayRaisedBillboard = {
            glyphChar: floorBehavior.glyphChar,
            textColor: floorBehavior.textColor,
            tileIndex:
              typeof floorBehavior.effective.tileIndex === "number" &&
              Number.isFinite(floorBehavior.effective.tileIndex)
                ? Math.trunc(floorBehavior.effective.tileIndex)
                : -1,
            sourceGlyph: floorBehavior.effective.glyph,
            materialKind: floorBehavior.materialKind,
          };
        }
      }
    }
    const hasEntityUnderlayRaisedBillboard =
      entityUnderlayRaisedBillboard !== null;
    const baseTileBillboardRenderOrder =
      this.dependencies.entityBillboards.resolveStandardBillboardRenderOrder(
        this.dependencies.tilesetAssets.shouldUseVultureTiles() && useTiles,
      );
    if (
      shouldRenderEntityBillboard &&
      (!isFpsPlayerTile || shouldKeepBillboardOnFpsPlayerTile)
    ) {
      this.dependencies.entityBillboards.ensureMonsterBillboard(
        key,
        x,
        y,
        runtimeAsciiBillboardGlyphChar ?? billboardBehavior.glyphChar,
        runtimeAsciiBillboardTextColor ?? billboardBehavior.textColor,
        billboardBehavior.effective.tileIndex,
        billboardEntityType,
        billboardIsWall,
        billboardBehavior.effective.glyph,
        billboardBehavior.materialKind,
        this.dependencies.entityBillboards.shouldShowPetHighlightHeart(
          billboardBehavior,
          options.runtimeGlyphFlags,
        ),
      );
      if (hasEntityUnderlayRaisedBillboard) {
        const entitySprite = this.dependencies.entityBillboards.monsterBillboards.get(key);
        if (entitySprite) {
          entitySprite.renderOrder = baseTileBillboardRenderOrder + 0.1;
        }
      }
    } else {
      this.dependencies.entityBillboards.removeMonsterBillboard(key);
    }
    const playerUnderlayBillboardKey = this.dependencies.worldClassification.getPlayerUnderlayBillboardKey(key);
    const underlayRaisedBillboard =
      entityUnderlayRaisedBillboard ?? playerUnderlayBillboard;
    if (underlayRaisedBillboard) {
      this.dependencies.entityBillboards.ensureMonsterBillboard(
        playerUnderlayBillboardKey,
        x,
        y,
        underlayRaisedBillboard.glyphChar,
        underlayRaisedBillboard.textColor,
        underlayRaisedBillboard.tileIndex,
        "monster",
        false,
        underlayRaisedBillboard.sourceGlyph,
        underlayRaisedBillboard.materialKind,
      );
      const underlaySprite = this.dependencies.entityBillboards.monsterBillboards.get(
        playerUnderlayBillboardKey,
      );
      if (underlaySprite) {
        underlaySprite.renderOrder = hasEntityUnderlayRaisedBillboard
          ? baseTileBillboardRenderOrder
          : playerUnderlayBillboard &&
              this.dependencies.worldClassification.shouldShowUnderPlayerFeaturesInOverheadTilesMode()
            ? baseTileBillboardRenderOrder - 0.05
            : baseTileBillboardRenderOrder - 0.25;
        if (!hasEntityUnderlayRaisedBillboard && !playerUnderlayBillboard) {
          underlaySprite.position.z -= TILE_SIZE * 0.005;
        }
      }
      this.dependencies.entityBillboards.removeEntityBlobShadow(playerUnderlayBillboardKey);
    } else {
      this.dependencies.entityBillboards.removeMonsterBillboard(playerUnderlayBillboardKey);
    }
    if (behavior.effectKind) {
      this.activeEffectTileKeys.add(key);
    } else {
      const hadAnimatedEffect = this.activeEffectTileKeys.delete(key);
      if (hadAnimatedEffect) {
        const overlayMaterial = this.getMeshOverlayMaterial(mesh);
        if (overlayMaterial) {
          overlayMaterial.color.set("#ffffff");
        }
      }
    }
    this.dependencies.minimap.queueMinimapTileUpdate(x, y, behavior, false, {
      foregroundHex: getTerminalColorHex(behavior.resolved.color),
      displayChar: char ?? behavior.glyphChar,
      forcePlayer: runtimeTrackedEntityId === 0,
    });
    this.dependencies.wallGeometry.refreshFpsWallChamferGeometryNear(x, y);
    this.dependencies.floorOcclusion.refreshFloorBlockAmbientOcclusionNear(x, y);
    this.dependencies.vultureWalls.refreshVultureWallMaterialsNear(x, y);
    this.dependencies.lighting.markLightingDirty();
  }

  getMeshOverlayMaterial(
    mesh: THREE.Mesh,
  ): THREE.MeshBasicMaterial | null {
    const material = mesh.material;
    if (Array.isArray(material)) {
      const top = material[4];
      return top instanceof THREE.MeshBasicMaterial ? top : null;
    }
    return material instanceof THREE.MeshBasicMaterial ? material : null;
  }

  updateEffectAnimations(timeMs: number): void {
    if (this.activeEffectTileKeys.size === 0) {
      return;
    }

    const phaseBase = timeMs / 240;
    const staleKeys: string[] = [];
    for (const key of this.activeEffectTileKeys) {
      const mesh = this.tileMap.get(key);
      if (!mesh) {
        staleKeys.push(key);
        continue;
      }

      const effectKind = mesh.userData.effectKind as
        | TileEffectKind
        | null
        | undefined;
      const overlayMaterial = this.getMeshOverlayMaterial(mesh);
      if (!overlayMaterial) {
        staleKeys.push(key);
        continue;
      }

      if (!effectKind) {
        overlayMaterial.color.set("#ffffff");
        staleKeys.push(key);
        continue;
      }

      const wave =
        0.72 +
        0.28 *
          Math.sin(phaseBase + mesh.position.x * 0.2 + mesh.position.y * 0.2);
      this.effectPulseColor
        .copy(this.effectColors[effectKind])
        .multiplyScalar(THREE.MathUtils.clamp(wave, 0.4, 1.2));
      overlayMaterial.color.copy(this.effectPulseColor);
    }

    for (const key of staleKeys) {
      this.activeEffectTileKeys.delete(key);
    }
  }

  updateTileRevealFades(timeMs: number): void {
    if (this.tileRevealStartMs.size === 0) {
      return;
    }

    const staleKeys: string[] = [];
    for (const [key, startedAtMs] of this.tileRevealStartMs.entries()) {
      const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
      if (!overlay) {
        staleKeys.push(key);
        continue;
      }

      const elapsedMs = timeMs - startedAtMs;
      const t = THREE.MathUtils.clamp(
        elapsedMs / this.tileRevealDurationMs,
        0,
        1,
      );
      // Ease-out cubic: fast start, gentle finish.
      const eased = 1 - Math.pow(1 - t, 3);

      overlay.material.opacity = eased;
      const mesh = this.tileMap.get(key);
      if (mesh) {
        this.dependencies.wallOverlays.applyRevealOpacityToAuxiliaryOverlays(mesh, eased);
      }

      if (t >= 1) {
        overlay.material.opacity = 1;
        if (mesh) {
          this.dependencies.wallOverlays.applyRevealOpacityToAuxiliaryOverlays(mesh, 1);
        }
        staleKeys.push(key);
      }
    }

    for (const key of staleKeys) {
      this.tileRevealStartMs.delete(key);
    }
  }
}
