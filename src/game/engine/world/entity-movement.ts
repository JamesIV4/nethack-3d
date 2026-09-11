import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import type { TileMaterialKind } from "../../glyphs";
import type {
  EntityMoveTransitionVisual,
  EntityMoveTransition,
  DeferredEntityVisualUpdate
} from "../shared/types";
import type { BillboardShatter } from "../effects/billboard-shatter";
import type { Camera } from "../camera/camera";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { GlyphTextures } from "../rendering/glyph-textures";
import type { LevelTerrainCache } from "./level-terrain-cache";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "./player-movement";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { RuntimeEntityTracking } from "./runtime-entity-tracking";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "./tile-updates";
import type { WorldClassification } from "./world-classification";

export interface EntityMovementDependencies {
  readonly billboardShatter: Pick<
    BillboardShatter,
    "createDetachedRuntimeMonsterBillboardSprite"
  >;
  readonly camera: Pick<
    Camera,
    "fpsStepCameraMinDurationMs"
    | "getPreferredEntityMoveDurationMs"
    | "runtimeTravelStepDelayMs"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "createMonsterBillboardTexture"
    | "detachMonsterBillboard"
    | "disposeDetachedMonsterBillboard"
    | "disposeMonsterBillboardFlatProxyMesh"
    | "disposeMonsterBillboardFlattenedBackdropSprite"
    | "disposeMonsterBillboardPitchLockedProxyMesh"
    | "monsterBillboards"
    | "resolveStandardBillboardRenderOrder"
    | "shouldAnimateGlyphMoveTransitions"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "acquireGlyphTexture"
    | "createTileTexture"
    | "glyphOverlayMap"
    | "releaseGlyphTexture"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "lastKnownTerrain"
    | "parseTileKey"
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
    "scene"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "getTrackedEntityMoveTransitionId"
    | "resolveRuntimeMonsterBillboardAppearanceById"
    | "runtimeMonsterIdByTileKey"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "floorGeometry"
    | "tileMap"
    | "updateTile"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "shouldUseVultureTiles"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "refreshTileVisualFromStateCache"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "getPlayerUnderlayBillboardKey"
  >;
}

/** Entity move transitions, deferred visual updates, reciprocal swaps and boulder pushes. */
export class EntityMovement {
  constructor(private readonly dependencies: EntityMovementDependencies) {}

  activeEntityMoveTransitions: Map<string, EntityMoveTransition> =
    new Map();

  deferredEntityVisualUpdatesByKey: Map<
    string,
    DeferredEntityVisualUpdate
  > = new Map();

  isEntityVisualUpdateDeferred(key: string): boolean {
    return this.deferredEntityVisualUpdatesByKey.has(key);
  }

  sanitizeEntityMoveTransitionDurationMs(durationMs: number): number {
    return Math.max(this.dependencies.camera.fpsStepCameraMinDurationMs, Math.trunc(durationMs));
  }

  getEntityMoveTransitionMinimumSegmentDurationMs(
    transitionId: string,
  ): number {
    if (transitionId !== "player") {
      return this.dependencies.camera.fpsStepCameraMinDurationMs;
    }
    return Math.max(
      this.dependencies.camera.fpsStepCameraMinDurationMs,
      Number.isFinite(this.dependencies.camera.runtimeTravelStepDelayMs)
        ? Math.trunc(this.dependencies.camera.runtimeTravelStepDelayMs)
        : 0,
    );
  }

  resolveEntityMoveTransitionSegmentDurationMs(
    transitionId: string,
    baseDurationMs: number,
    queuedWaypointCount: number,
  ): number {
    return Math.max(
      this.getEntityMoveTransitionMinimumSegmentDurationMs(transitionId),
      Math.trunc(
        this.sanitizeEntityMoveTransitionDurationMs(baseDurationMs) /
          Math.max(1, queuedWaypointCount + 1),
      ),
    );
  }

  areEntityMoveTransitionsReciprocalSwap(
    first: EntityMoveTransition,
    second: EntityMoveTransition,
  ): boolean {
    const epsilon = TILE_SIZE * 0.01;
    return (
      Math.abs(first.from.x - second.to.x) <= epsilon &&
      Math.abs(first.from.y - second.to.y) <= epsilon &&
      Math.abs(first.to.x - second.from.x) <= epsilon &&
      Math.abs(first.to.y - second.from.y) <= epsilon
    );
  }

  buildEntityMoveTransitionReciprocalSwapPartnerById(
    transitions: EntityMoveTransition[],
  ): Map<string, string> {
    const partners = new Map<string, string>();
    for (let index = 0; index < transitions.length; index += 1) {
      const transition = transitions[index];
      if (partners.has(transition.id)) {
        continue;
      }
      for (
        let otherIndex = index + 1;
        otherIndex < transitions.length;
        otherIndex += 1
      ) {
        const otherTransition = transitions[otherIndex];
        if (
          partners.has(otherTransition.id) ||
          !this.areEntityMoveTransitionsReciprocalSwap(
            transition,
            otherTransition,
          )
        ) {
          continue;
        }
        partners.set(transition.id, otherTransition.id);
        partners.set(otherTransition.id, transition.id);
        break;
      }
    }
    return partners;
  }

  buildEntityMoveTransitionReciprocalSwapOffsetById(
    transitions: EntityMoveTransition[],
    partners: Map<string, string>,
  ): Map<string, { x: number; y: number }> {
    const offsets = new Map<string, { x: number; y: number }>();
    const seenPairKeys = new Set<string>();
    const playerSwapOffsetMagnitude = TILE_SIZE * 0.06;
    const nonPlayerSwapOffsetMagnitude = TILE_SIZE * 0.04;
    for (const transition of transitions) {
      const partnerId = partners.get(transition.id) ?? null;
      if (!partnerId) {
        continue;
      }
      const pairKey = [transition.id, partnerId].sort().join("|");
      if (seenPairKeys.has(pairKey)) {
        continue;
      }
      seenPairKeys.add(pairKey);
      const partner =
        transitions.find((candidate) => candidate.id === partnerId) ?? null;
      if (!partner) {
        continue;
      }
      const deltaX = transition.to.x - transition.from.x;
      const deltaY = transition.to.y - transition.from.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance <= 1e-6) {
        continue;
      }
      const perpendicularX = -deltaY / distance;
      const perpendicularY = deltaX / distance;
      if (transition.id === "player" || partner.id === "player") {
        const nonPlayerId =
          transition.id === "player" ? partner.id : transition.id;
        const playerId =
          transition.id === "player" ? transition.id : partner.id;
        offsets.set(playerId, { x: 0, y: 0 });
        offsets.set(nonPlayerId, {
          x: perpendicularX * playerSwapOffsetMagnitude,
          y: perpendicularY * playerSwapOffsetMagnitude,
        });
        continue;
      }
      offsets.set(transition.id, {
        x: perpendicularX * nonPlayerSwapOffsetMagnitude,
        y: perpendicularY * nonPlayerSwapOffsetMagnitude,
      });
      offsets.set(partner.id, {
        x: -perpendicularX * nonPlayerSwapOffsetMagnitude,
        y: -perpendicularY * nonPlayerSwapOffsetMagnitude,
      });
    }
    return offsets;
  }

  hasActiveEntityMoveTransitionDestination(
    destinationKey: string,
    excludedTransitionId: string | null = null,
  ): boolean {
    for (const transition of this.activeEntityMoveTransitions.values()) {
      if (
        excludedTransitionId !== null &&
        transition.id === excludedTransitionId
      ) {
        continue;
      }
      if (transition.destinationKey === destinationKey) {
        return true;
      }
      if (
        transition.queuedWaypoints.some(
          (waypoint) => waypoint.destinationKey === destinationKey,
        )
      ) {
        return true;
      }
    }
    return false;
  }

  setEntityMoveTransitionSegment(
    transition: EntityMoveTransition,
    destinationKey: string,
    baseDurationMs: number,
    now: number = performance.now(),
  ): boolean {
    const destinationTile = this.dependencies.levelTerrainCache.parseTileKey(destinationKey);
    if (!destinationTile) {
      return false;
    }
    transition.destinationKey = destinationKey;
    transition.baseDurationMs =
      this.sanitizeEntityMoveTransitionDurationMs(baseDurationMs);
    transition.startedAtMs = now;
    transition.holdAtDestinationUntilConfirmation = false;
    transition.durationMs = this.resolveEntityMoveTransitionSegmentDurationMs(
      transition.id,
      transition.baseDurationMs,
      transition.queuedWaypoints.length,
    );
    transition.from.copy(transition.object.position);
    transition.to.set(
      destinationTile.x * TILE_SIZE,
      -destinationTile.y * TILE_SIZE,
      transition.object.position.z,
    );
    return true;
  }

  retuneEntityMoveTransitionForQueuedWaypoints(
    transition: EntityMoveTransition,
    now: number = performance.now(),
  ): void {
    const nextDurationMs = this.resolveEntityMoveTransitionSegmentDurationMs(
      transition.id,
      transition.baseDurationMs,
      transition.queuedWaypoints.length,
    );
    if (nextDurationMs >= transition.durationMs) {
      return;
    }
    transition.from.copy(transition.object.position);
    transition.startedAtMs = now;
    transition.durationMs = nextDurationMs;
  }

  clearDeferredEntityVisualUpdateForTransition(
    transitionId: string,
  ): void {
    for (const [key, entry] of Array.from(
      this.deferredEntityVisualUpdatesByKey.entries(),
    )) {
      if (entry.transitionId === transitionId) {
        this.deferredEntityVisualUpdatesByKey.delete(key);
      }
    }
  }

  applyTilePayloadToVisual(tile: any): void {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }
    this.dependencies.tileRendering.updateTile(tile.x, tile.y, tile.glyph, tile.char, tile.color, {
      runtimeTrackedEntityId:
        typeof tile.monsterId === "number" ? tile.monsterId : undefined,
      runtimeTileIndex:
        typeof tile.tileIndex === "number" ? tile.tileIndex : undefined,
      runtimeSymidx: typeof tile.symidx === "number" ? tile.symidx : undefined,
      runtimeFloorUnderlayGlyph:
        typeof tile.floorUnderlayGlyph === "number"
          ? tile.floorUnderlayGlyph
          : undefined,
      runtimeFloorUnderlayChar:
        typeof tile.floorUnderlayChar === "string"
          ? tile.floorUnderlayChar
          : undefined,
      runtimeFloorUnderlayColor:
        typeof tile.floorUnderlayColor === "number"
          ? tile.floorUnderlayColor
          : undefined,
      runtimeFloorUnderlayTileIndex:
        typeof tile.floorUnderlayTileIndex === "number"
          ? tile.floorUnderlayTileIndex
          : undefined,
      runtimeFloorUnderlaySymidx:
        typeof tile.floorUnderlaySymidx === "number"
          ? tile.floorUnderlaySymidx
          : undefined,
    });
  }

  applyDeferredEntityVisualUpdateForKey(
    key: string,
    transitionId: string,
  ): void {
    const entry = this.deferredEntityVisualUpdatesByKey.get(key) ?? null;
    if (!entry || entry.transitionId !== transitionId) {
      return;
    }
    this.deferredEntityVisualUpdatesByKey.delete(key);
    if (entry.tile) {
      this.applyTilePayloadToVisual(entry.tile);
      return;
    }
    const tile = this.dependencies.levelTerrainCache.parseTileKey(key);
    if (tile) {
      this.dependencies.tileUpdates.refreshTileVisualFromStateCache(tile.x, tile.y);
    }
  }

  createEntityMoveTransitionVisualFromMonsterBillboardKey(
    key: string,
  ): EntityMoveTransitionVisual | null {
    const sprite = this.dependencies.entityBillboards.detachMonsterBillboard(key);
    if (!sprite) {
      return null;
    }
    this.dependencies.entityBillboards.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
    this.dependencies.entityBillboards.disposeMonsterBillboardFlatProxyMesh(sprite);
    this.dependencies.entityBillboards.disposeMonsterBillboardFlattenedBackdropSprite(sprite);
    sprite.visible = true;
    sprite.frustumCulled = false;
    sprite.renderOrder = this.dependencies.entityBillboards.resolveStandardBillboardRenderOrder(
      this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
        this.dependencies.engineState.clientOptions.tilesetMode === "tiles",
    );
    this.dependencies.renderPipeline.scene.add(sprite);
    return {
      object: sprite,
      dispose: () => this.dependencies.entityBillboards.disposeDetachedMonsterBillboard(sprite),
    };
  }

  createEntityMoveTransitionVisualFromTrackedEntityAppearance(
    entityId: number,
    key: string,
  ): EntityMoveTransitionVisual | null {
    if (entityId === 0 && this.dependencies.movementInput.isFpsMode()) {
      return null;
    }
    const tile = this.dependencies.levelTerrainCache.parseTileKey(key);
    if (!tile) {
      return null;
    }
    const appearance =
      this.dependencies.runtimeEntityTracking.resolveRuntimeMonsterBillboardAppearanceById(entityId);
    if (!appearance) {
      return null;
    }
    const sprite = this.dependencies.billboardShatter.createDetachedRuntimeMonsterBillboardSprite(
      tile.x,
      tile.y,
      appearance,
      entityId,
    );
    if (!sprite) {
      return null;
    }
    this.dependencies.entityBillboards.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
    this.dependencies.entityBillboards.disposeMonsterBillboardFlatProxyMesh(sprite);
    this.dependencies.entityBillboards.disposeMonsterBillboardFlattenedBackdropSprite(sprite);
    sprite.visible = true;
    sprite.frustumCulled = false;
    this.dependencies.renderPipeline.scene.add(sprite);
    return {
      object: sprite,
      dispose: () => this.dependencies.entityBillboards.disposeDetachedMonsterBillboard(sprite),
    };
  }

  createEntityMoveTransitionVisualFromTileKey(
    key: string,
  ): EntityMoveTransitionVisual | null {
    const mesh = this.dependencies.tileRendering.tileMap.get(key) ?? null;
    if (!mesh) {
      return null;
    }

    const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key) ?? null;
    const overlayTextureKey =
      overlay && typeof overlay.textureKey === "string"
        ? overlay.textureKey
        : "";
    let texture: THREE.CanvasTexture | null = null;
    let releaseTexture = (): void => {};
    let disposeOwnedTexture = (): void => {};
    let useTileLikeColor = false;

    if (overlay && overlay.texture && overlayTextureKey) {
      texture = this.dependencies.glyphTextures.acquireGlyphTexture(
        overlayTextureKey,
        () => overlay.texture!,
      );
      releaseTexture = () => this.dependencies.glyphTextures.releaseGlyphTexture(overlayTextureKey);
      useTileLikeColor =
        overlayTextureKey.startsWith("tile:") ||
        overlayTextureKey.startsWith("vtile:") ||
        overlayTextureKey.startsWith("solid:");
    } else {
      const tileIndex =
        typeof mesh.userData?.tileIndex === "number" &&
        Number.isFinite(mesh.userData.tileIndex)
          ? Math.trunc(mesh.userData.tileIndex)
          : -1;
      const sourceGlyph =
        typeof mesh.userData?.tileTextureSourceGlyph === "number" &&
        Number.isFinite(mesh.userData.tileTextureSourceGlyph)
          ? Math.trunc(mesh.userData.tileTextureSourceGlyph)
          : typeof mesh.userData?.sourceGlyph === "number" &&
              Number.isFinite(mesh.userData.sourceGlyph)
            ? Math.trunc(mesh.userData.sourceGlyph)
            : null;
      const materialKind =
        typeof mesh.userData?.materialKind === "string"
          ? (mesh.userData.materialKind as TileMaterialKind)
          : null;
      const glyphChar =
        typeof mesh.userData?.glyphChar === "string"
          ? mesh.userData.glyphChar
          : "?";
      const textColor =
        typeof mesh.userData?.glyphTextColor === "string"
          ? mesh.userData.glyphTextColor
          : "#ffffff";
      if (
        this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
        (tileIndex >= 0 || sourceGlyph !== null)
      ) {
        texture = this.dependencies.glyphTextures.createTileTexture(tileIndex, 1, false, {
          sourceGlyph,
          materialKind,
          tileX:
            typeof mesh.userData?.tileX === "number"
              ? Math.trunc(mesh.userData.tileX)
              : null,
          tileY:
            typeof mesh.userData?.tileY === "number"
              ? Math.trunc(mesh.userData.tileY)
              : null,
          useBackgroundReferenceTile:
            mesh.userData?.tileUseBackgroundReferenceTile === true,
          forceBackgroundRemoval:
            mesh.userData?.tileTextureForceBackgroundRemoval === true,
          floorUnderlayGlyph:
            typeof mesh.userData?.floorUnderlaySourceGlyph === "number"
              ? Math.trunc(mesh.userData.floorUnderlaySourceGlyph)
              : null,
          floorUnderlayTileIndex:
            typeof mesh.userData?.floorUnderlayTileIndex === "number"
              ? Math.trunc(mesh.userData.floorUnderlayTileIndex)
              : null,
          floorUnderlayUseBackgroundReferenceTile:
            mesh.userData?.floorUnderlayUseBackgroundReferenceTile === true,
          floorUnderlayMaterialKind:
            typeof mesh.userData?.floorUnderlayMaterialKind === "string"
              ? (mesh.userData.floorUnderlayMaterialKind as TileMaterialKind)
              : null,
        });
        useTileLikeColor = true;
      } else {
        texture = this.dependencies.entityBillboards.createMonsterBillboardTexture(glyphChar, textColor);
      }
      disposeOwnedTexture = () => texture?.dispose();
    }

    if (!texture) {
      return null;
    }

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    material.color.set(
      useTileLikeColor
        ? "#ffffff"
        : `#${overlay?.baseColorHex ?? mesh.userData?.glyphBaseColorHex ?? "ffffff"}`,
    );
    const plane = new THREE.Mesh(this.dependencies.tileRendering.floorGeometry, material);
    plane.frustumCulled = false;
    plane.renderOrder = 912;
    plane.position.set(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z + 0.03,
    );
    this.dependencies.renderPipeline.scene.add(plane);
    return {
      object: plane,
      dispose: () => {
        material.dispose();
        releaseTexture();
        disposeOwnedTexture();
      },
    };
  }

  restoreTileVisualFromRememberedTerrain(
    tileX: number,
    tileY: number,
  ): boolean {
    const key = `${tileX},${tileY}`;
    const snapshot = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
    if (!snapshot) {
      return false;
    }
    this.dependencies.tileRendering.updateTile(
      tileX,
      tileY,
      snapshot.glyph,
      snapshot.char ?? undefined,
      typeof snapshot.color === "number" ? snapshot.color : undefined,
      {
        runtimeTileIndex:
          typeof snapshot.tileIndex === "number"
            ? snapshot.tileIndex
            : undefined,
        runtimeSymidx:
          typeof snapshot.symidx === "number" ? snapshot.symidx : undefined,
      },
    );
    return true;
  }

  beginOrRetargetEntityMoveTransition(
    transitionId: string,
    destinationKey: string,
    durationMs: number,
    deferredTile: any | null,
    visualFactory: () => EntityMoveTransitionVisual | null,
  ): boolean {
    const destinationTile = this.dependencies.levelTerrainCache.parseTileKey(destinationKey);
    if (!destinationTile) {
      return false;
    }
    const sanitizedDurationMs =
      this.sanitizeEntityMoveTransitionDurationMs(durationMs);
    const now = performance.now();

    let transition = this.activeEntityMoveTransitions.get(transitionId) ?? null;
    if (!transition) {
      const visual = visualFactory();
      if (!visual) {
        return false;
      }
      transition = {
        id: transitionId,
        destinationKey,
        object: visual.object,
        dispose: visual.dispose,
        baseRenderOrder: visual.object.renderOrder,
        startedAtMs: now,
        durationMs: sanitizedDurationMs,
        baseDurationMs: sanitizedDurationMs,
        from: visual.object.position.clone(),
        to: visual.object.position.clone(),
        queuedWaypoints: [],
        holdAtDestinationUntilConfirmation: false,
      };
      this.activeEntityMoveTransitions.set(transitionId, transition);
    } else {
      if (transition.holdAtDestinationUntilConfirmation) {
        if (transition.destinationKey === destinationKey) {
          transition.baseDurationMs = sanitizedDurationMs;
        } else {
          transition.queuedWaypoints = [];
          this.setEntityMoveTransitionSegment(
            transition,
            destinationKey,
            sanitizedDurationMs,
            now,
          );
        }
        this.deferredEntityVisualUpdatesByKey.set(destinationKey, {
          transitionId,
          tile: deferredTile,
        });
        return true;
      }
      const currentOrQueuedWaypoint =
        transition.destinationKey === destinationKey
          ? null
          : (transition.queuedWaypoints.find(
              (waypoint) => waypoint.destinationKey === destinationKey,
            ) ?? null);
      if (transition.destinationKey === destinationKey) {
        transition.baseDurationMs = sanitizedDurationMs;
      } else if (currentOrQueuedWaypoint) {
        currentOrQueuedWaypoint.durationMs = sanitizedDurationMs;
      } else {
        transition.queuedWaypoints.push({
          destinationKey,
          durationMs: sanitizedDurationMs,
        });
        this.retuneEntityMoveTransitionForQueuedWaypoints(transition, now);
      }
      this.deferredEntityVisualUpdatesByKey.set(destinationKey, {
        transitionId,
        tile: deferredTile,
      });
      return true;
    }

    this.setEntityMoveTransitionSegment(
      transition,
      destinationKey,
      sanitizedDurationMs,
      now,
    );
    this.deferredEntityVisualUpdatesByKey.set(destinationKey, {
      transitionId,
      tile: deferredTile,
    });
    return true;
  }

  finishEntityMoveTransition(
    transitionId: string,
    applyDeferredVisual: boolean,
  ): void {
    const transition = this.activeEntityMoveTransitions.get(transitionId);
    if (!transition) {
      return;
    }
    this.activeEntityMoveTransitions.delete(transitionId);
    if (applyDeferredVisual) {
      this.applyDeferredEntityVisualUpdateForKey(
        transition.destinationKey,
        transitionId,
      );
    }
    this.clearDeferredEntityVisualUpdateForTransition(transitionId);
    transition.object.parent?.remove(transition.object);
    transition.dispose();
  }

  updateEntityMoveTransitions(): void {
    if (this.activeEntityMoveTransitions.size <= 0) {
      return;
    }
    const now = performance.now();
    const transitions = Array.from(this.activeEntityMoveTransitions.values());
    const reciprocalSwapPartnerById =
      this.buildEntityMoveTransitionReciprocalSwapPartnerById(
        transitions.filter(
          (transition) => !transition.holdAtDestinationUntilConfirmation,
        ),
      );
    const reciprocalSwapOffsetById =
      this.buildEntityMoveTransitionReciprocalSwapOffsetById(
        transitions,
        reciprocalSwapPartnerById,
      );
    for (const transition of transitions) {
      if (transition.holdAtDestinationUntilConfirmation) {
        continue;
      }
      const progress = THREE.MathUtils.clamp(
        (now - transition.startedAtMs) / Math.max(1, transition.durationMs),
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      const reciprocalSwapPartnerId =
        reciprocalSwapPartnerById.get(transition.id) ?? null;
      const reciprocalSwapPartner =
        reciprocalSwapPartnerId !== null
          ? (this.activeEntityMoveTransitions.get(reciprocalSwapPartnerId) ??
            null)
          : null;
      const reciprocalSwapOffset =
        reciprocalSwapOffsetById.get(transition.id) ?? null;
      const reciprocalSwapCurve =
        reciprocalSwapOffset !== null ? Math.sin(progress * Math.PI) : 0;
      transition.object.renderOrder = transition.baseRenderOrder;
      if (reciprocalSwapPartner) {
        const topRenderOrder =
          Math.max(
            transition.baseRenderOrder,
            reciprocalSwapPartner.baseRenderOrder,
          ) + 0.5;
        const bottomRenderOrder = Math.min(
          transition.baseRenderOrder,
          reciprocalSwapPartner.baseRenderOrder,
        );
        if (transition.id === "player") {
          transition.object.renderOrder = topRenderOrder;
        } else if (reciprocalSwapPartner.id === "player") {
          transition.object.renderOrder = bottomRenderOrder;
        }
      }
      transition.object.position.set(
        THREE.MathUtils.lerp(transition.from.x, transition.to.x, eased) +
          (reciprocalSwapOffset?.x ?? 0) * reciprocalSwapCurve,
        THREE.MathUtils.lerp(transition.from.y, transition.to.y, eased) +
          (reciprocalSwapOffset?.y ?? 0) * reciprocalSwapCurve,
        THREE.MathUtils.lerp(transition.from.z, transition.to.z, eased),
      );
      if (progress >= 1) {
        transition.object.position.copy(transition.to);
        this.applyDeferredEntityVisualUpdateForKey(
          transition.destinationKey,
          transition.id,
        );
        const nextWaypoint = transition.queuedWaypoints.shift() ?? null;
        if (nextWaypoint) {
          const didAdvance = this.setEntityMoveTransitionSegment(
            transition,
            nextWaypoint.destinationKey,
            nextWaypoint.durationMs,
            now,
          );
          if (didAdvance) {
            continue;
          }
        }
        if (
          transition.id === "player" &&
          `${this.dependencies.playerMovement.playerPos.x},${this.dependencies.playerMovement.playerPos.y}` !==
            transition.destinationKey
        ) {
          transition.holdAtDestinationUntilConfirmation = true;
          continue;
        }
        this.finishEntityMoveTransition(transition.id, false);
      }
    }
  }

  finalizeHeldPlayerMoveTransitionIfConfirmed(
    tileX: number,
    tileY: number,
  ): void {
    const transition = this.activeEntityMoveTransitions.get("player") ?? null;
    if (!transition || !transition.holdAtDestinationUntilConfirmation) {
      return;
    }
    if (transition.destinationKey !== `${tileX},${tileY}`) {
      return;
    }
    this.finishEntityMoveTransition("player", false);
  }

  clearEntityMoveTransitions(): void {
    for (const transitionId of Array.from(
      this.activeEntityMoveTransitions.keys(),
    )) {
      this.finishEntityMoveTransition(transitionId, false);
    }
    this.deferredEntityVisualUpdatesByKey.clear();
  }

  startRuntimeMonsterMoveTransition(
    monsterId: number,
    fromKey: string,
    toKey: string,
    destinationTile: any,
  ): void {
    if (
      !this.dependencies.entityBillboards.shouldAnimateGlyphMoveTransitions() ||
      (monsterId === 0 && this.dependencies.movementInput.isFpsMode())
    ) {
      return;
    }
    const hadStandingBillboardSource = this.dependencies.entityBillboards.monsterBillboards.has(fromKey);
    const transitionId = this.dependencies.runtimeEntityTracking.getTrackedEntityMoveTransitionId(monsterId);
    const started = this.beginOrRetargetEntityMoveTransition(
      transitionId,
      toKey,
      this.dependencies.camera.getPreferredEntityMoveDurationMs(),
      destinationTile,
      () =>
        this.createEntityMoveTransitionVisualFromMonsterBillboardKey(fromKey) ??
        this.createEntityMoveTransitionVisualFromTrackedEntityAppearance(
          monsterId,
          fromKey,
        ) ??
        this.createEntityMoveTransitionVisualFromTileKey(fromKey),
    );
    if (!started || hadStandingBillboardSource) {
      return;
    }
    if (this.hasActiveEntityMoveTransitionDestination(fromKey, transitionId)) {
      const fromTile = this.dependencies.levelTerrainCache.parseTileKey(fromKey);
      if (fromTile) {
        // Another in-flight transition already owns the replacement occupant
        // for this tile, so restore the floor immediately instead of leaving
        // the source entity art trailing underneath the crossing swap.
        this.restoreTileVisualFromRememberedTerrain(fromTile.x, fromTile.y);
      }
      return;
    }
    const sourceTileOccupantId = this.dependencies.runtimeEntityTracking.runtimeMonsterIdByTileKey.get(fromKey);
    if (
      sourceTileOccupantId !== undefined &&
      sourceTileOccupantId !== monsterId
    ) {
      return;
    }
    const fromTile = this.dependencies.levelTerrainCache.parseTileKey(fromKey);
    if (fromTile) {
      this.restoreTileVisualFromRememberedTerrain(fromTile.x, fromTile.y);
    }
  }

  startPlayerMoveTransition(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number,
  ): void {
    if (this.dependencies.movementInput.isFpsMode() || !this.dependencies.entityBillboards.shouldAnimateGlyphMoveTransitions()) {
      return;
    }
    this.beginOrRetargetEntityMoveTransition(
      "player",
      `${toX},${toY}`,
      durationMs,
      null,
      () =>
        this.createEntityMoveTransitionVisualFromTrackedEntityAppearance(
          0,
          `${fromX},${fromY}`,
        ) ??
        this.createEntityMoveTransitionVisualFromTileKey(`${fromX},${fromY}`),
    );
  }

  tryStartProvisionalPlayerSwapTransitions(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number,
  ): boolean {
    if (this.dependencies.movementInput.isFpsMode() || !this.dependencies.entityBillboards.shouldAnimateGlyphMoveTransitions()) {
      return false;
    }
    const sourceKey = `${fromX},${fromY}`;
    const destinationKey = `${toX},${toY}`;
    const destinationOccupantId =
      this.dependencies.runtimeEntityTracking.runtimeMonsterIdByTileKey.get(destinationKey) ?? null;
    if (destinationOccupantId === null || destinationOccupantId === 0) {
      return false;
    }

    const playerTransitionAlreadyActive =
      this.activeEntityMoveTransitions.has("player");
    let startedPlayerTransition = false;
    if (!playerTransitionAlreadyActive) {
      startedPlayerTransition = this.beginOrRetargetEntityMoveTransition(
        "player",
        destinationKey,
        durationMs,
        null,
        () =>
          this.createEntityMoveTransitionVisualFromTrackedEntityAppearance(
            0,
            sourceKey,
          ) ?? this.createEntityMoveTransitionVisualFromTileKey(sourceKey),
      );
    }

    const occupantTransitionId = this.dependencies.runtimeEntityTracking.getTrackedEntityMoveTransitionId(
      destinationOccupantId,
    );
    const occupantTransitionAlreadyActive =
      this.activeEntityMoveTransitions.has(occupantTransitionId);
    const startedOccupantTransition = this.beginOrRetargetEntityMoveTransition(
      occupantTransitionId,
      sourceKey,
      durationMs,
      null,
      () =>
        this.createEntityMoveTransitionVisualFromMonsterBillboardKey(
          destinationKey,
        ) ??
        this.createEntityMoveTransitionVisualFromTrackedEntityAppearance(
          destinationOccupantId,
          destinationKey,
        ) ??
        this.createEntityMoveTransitionVisualFromTileKey(destinationKey),
    );

    if (
      (playerTransitionAlreadyActive || startedPlayerTransition) &&
      (occupantTransitionAlreadyActive || startedOccupantTransition)
    ) {
      this.restoreTileVisualFromRememberedTerrain(fromX, fromY);
      this.restoreTileVisualFromRememberedTerrain(toX, toY);
    }

    return startedPlayerTransition || startedOccupantTransition;
  }

  startConfirmedBoulderPushTransition(
    data: Record<string, unknown>,
  ): void {
    if (!this.dependencies.entityBillboards.shouldAnimateGlyphMoveTransitions()) {
      return;
    }
    const rawFromX = Number(data.fromX);
    const rawFromY = Number(data.fromY);
    const rawToX = Number(data.toX);
    const rawToY = Number(data.toY);
    if (
      !Number.isFinite(rawFromX) ||
      !Number.isFinite(rawFromY) ||
      !Number.isFinite(rawToX) ||
      !Number.isFinite(rawToY)
    ) {
      return;
    }

    const fromX = Math.trunc(rawFromX);
    const fromY = Math.trunc(rawFromY);
    const toX = Math.trunc(rawToX);
    const toY = Math.trunc(rawToY);
    const moveDx = toX - fromX;
    const moveDy = toY - fromY;
    if (
      (moveDx === 0 && moveDy === 0) ||
      Math.abs(moveDx) > 1 ||
      Math.abs(moveDy) > 1
    ) {
      return;
    }

    const sourceKey = `${fromX},${fromY}`;
    const sourceUnderlayBillboardKey =
      this.dependencies.worldClassification.getPlayerUnderlayBillboardKey(sourceKey);
    const started = this.beginOrRetargetEntityMoveTransition(
      "confirmed-boulder-push",
      `${toX},${toY}`,
      this.dependencies.camera.getPreferredEntityMoveDurationMs(),
      null,
      () =>
        this.createEntityMoveTransitionVisualFromMonsterBillboardKey(
          sourceKey,
        ) ??
        this.createEntityMoveTransitionVisualFromMonsterBillboardKey(
          sourceUnderlayBillboardKey,
        ) ??
        this.createEntityMoveTransitionVisualFromTileKey(sourceKey),
    );
    if (!started) {
      return;
    }

    const fromTile = this.dependencies.levelTerrainCache.parseTileKey(sourceKey);
    if (fromTile) {
      this.restoreTileVisualFromRememberedTerrain(fromTile.x, fromTile.y);
    }
    const toTile = this.dependencies.levelTerrainCache.parseTileKey(`${toX},${toY}`);
    if (toTile) {
      this.restoreTileVisualFromRememberedTerrain(toTile.x, toTile.y);
    }
  }
}
