import type {
  RuntimeMonsterBillboardAppearance,
  RuntimeMonsterLastSeenState
} from "../shared/types";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { EntityMovement } from "./entity-movement";
import type { LevelTerrainCache } from "./level-terrain-cache";
import type { Minimap } from "../ui/minimap";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "./player-movement";
import type { TileUpdates } from "./tile-updates";
import type { WorldClassification } from "./world-classification";

export interface RuntimeEntityTrackingDependencies {
  readonly entityBillboards: Pick<
    EntityBillboards,
    "shouldAnimateGlyphMoveTransitions"
    | "shouldAnimatePlayerBillboardsInFps"
    | "shouldShowPetHighlightHeart"
  >;
  readonly entityMovement: Pick<
    EntityMovement,
    "restoreTileVisualFromRememberedTerrain"
    | "startRuntimeMonsterMoveTransition"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "parseTileKey"
  >;
  readonly minimap: Pick<
    Minimap,
    "minimapTrackedPlayerTileKey"
    | "queueRuntimeTrackedPlayerMinimapTile"
    | "restoreMinimapTileFromRememberedTerrain"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "hasSeenPlayerPosition"
    | "playerPos"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "hasExplicitPlayerVisual"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "classifyTilePayload"
    | "isMonsterLikeBehavior"
  >;
}

/** Runtime entity identity, last seen appearance, vacated tile tracking and effect target resolution. */
export class RuntimeEntityTracking {
  constructor(private readonly dependencies: RuntimeEntityTrackingDependencies) {}

  runtimeMonsterTileKeyById: Map<number, string> = new Map();

  runtimeMonsterIdByTileKey: Map<string, number> = new Map();

  pendingRuntimeMonsterVacatedTileKeyById: Map<number, string> =
    new Map();

  runtimeMonsterLastSeenStateById: Map<
    number,
    RuntimeMonsterLastSeenState
  > = new Map();

  runtimeTrackedPlayerEntitySeen: boolean = false;

  normalizeRuntimeMonsterId(rawValue: unknown): number | null {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized > 0 ? normalized : null;
  }

  normalizeRuntimeTrackedEntityId(rawValue: unknown): number | null {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized >= 0 ? normalized : null;
  }

  isRuntimeTrackedPlayerEntityId(rawValue: unknown): boolean {
    return this.normalizeRuntimeTrackedEntityId(rawValue) === 0;
  }

  hasRuntimeTrackedPlayerEntitySupport(): boolean {
    return this.runtimeTrackedPlayerEntitySeen;
  }

  shouldAllowTrackedPlayerAppearance(): boolean {
    return !this.dependencies.movementInput.isFpsMode() || this.dependencies.entityBillboards.shouldAnimatePlayerBillboardsInFps();
  }

  getTrackedEntityMoveTransitionId(entityId: number): string {
    return entityId === 0 ? "player" : `monster:${entityId}`;
  }

  normalizeRuntimeTargetEntityId(rawValue: unknown): number | null {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized >= 0 ? normalized : null;
  }

  removeRuntimeMonsterTrackingById(rawValue: unknown): void {
    const monsterId = this.normalizeRuntimeTrackedEntityId(rawValue);
    if (monsterId === null) {
      return;
    }
    this.pendingRuntimeMonsterVacatedTileKeyById.delete(monsterId);
    const key = this.runtimeMonsterTileKeyById.get(monsterId);
    if (key && this.runtimeMonsterIdByTileKey.get(key) === monsterId) {
      this.runtimeMonsterIdByTileKey.delete(key);
    }
    this.runtimeMonsterTileKeyById.delete(monsterId);
  }

  finalizePendingRuntimeMonsterVacatedTracking(): void {
    for (const [monsterId, key] of Array.from(
      this.pendingRuntimeMonsterVacatedTileKeyById.entries(),
    )) {
      if (this.runtimeMonsterTileKeyById.get(monsterId) === key) {
        this.runtimeMonsterTileKeyById.delete(monsterId);
      }
      this.pendingRuntimeMonsterVacatedTileKeyById.delete(monsterId);
    }
  }

  forgetRuntimeMonsterLastSeenStateById(rawValue: unknown): void {
    const monsterId = this.normalizeRuntimeTrackedEntityId(rawValue);
    if (monsterId === null) {
      return;
    }
    this.runtimeMonsterLastSeenStateById.delete(monsterId);
  }

  extractRuntimeMonsterBillboardAppearanceFromTile(
    tile: any,
  ): RuntimeMonsterBillboardAppearance | null {
    const behavior = this.dependencies.worldClassification.classifyTilePayload(tile);
    const hasTrackablePlayerAppearance =
      this.shouldAllowTrackedPlayerAppearance() &&
      behavior !== null &&
      this.dependencies.tileUpdates.hasExplicitPlayerVisual(
        behavior,
        typeof tile?.char === "string" ? tile.char : null,
      );
    if (
      !behavior ||
      (!this.dependencies.worldClassification.isMonsterLikeBehavior(behavior) && !hasTrackablePlayerAppearance)
    ) {
      return null;
    }
    return {
      glyphChar: behavior.glyphChar,
      textColor: behavior.textColor,
      tileIndex:
        typeof behavior.effective.tileIndex === "number" &&
        Number.isFinite(behavior.effective.tileIndex)
          ? Math.trunc(behavior.effective.tileIndex)
          : -1,
      sourceGlyph:
        typeof behavior.effective.glyph === "number" &&
        Number.isFinite(behavior.effective.glyph)
          ? Math.trunc(behavior.effective.glyph)
          : null,
      materialKind: behavior.materialKind,
      isWall: behavior.isWall,
      showPetHeart: this.dependencies.entityBillboards.shouldShowPetHighlightHeart(
        behavior,
        tile?.glyphFlags,
      ),
    };
  }

  rememberRuntimeMonsterLastSeenState(
    monsterId: number,
    tileKey: string,
    tile: any,
  ): void {
    const behavior = this.dependencies.worldClassification.classifyTilePayload(tile);
    const relationship =
      behavior?.effective.kind === "pet" ||
      behavior?.effective.kind === "ridden"
        ? "pet"
        : behavior && this.dependencies.worldClassification.isMonsterLikeBehavior(behavior)
          ? "monster"
          : "other";
    this.runtimeMonsterLastSeenStateById.set(monsterId, {
      tileKey,
      appearance: this.extractRuntimeMonsterBillboardAppearanceFromTile(tile),
      relationship,
    });
  }

  resolveRuntimeMonsterLastSeenStateById(
    rawMonsterId: unknown,
  ): RuntimeMonsterLastSeenState | null {
    const monsterId = this.normalizeRuntimeTrackedEntityId(rawMonsterId);
    if (monsterId === null) {
      return null;
    }
    return this.runtimeMonsterLastSeenStateById.get(monsterId) ?? null;
  }

  updateRuntimeMonsterTrackingFromTile(tile: any): void {
    if (
      !tile ||
      typeof tile.x !== "number" ||
      !Number.isFinite(tile.x) ||
      typeof tile.y !== "number" ||
      !Number.isFinite(tile.y)
    ) {
      return;
    }

    const key = `${Math.trunc(tile.x)},${Math.trunc(tile.y)}`;
    const eventMonsterId = this.normalizeRuntimeTrackedEntityId(tile.monsterId);
    if (eventMonsterId === 0) {
      this.runtimeTrackedPlayerEntitySeen = true;
    }
    const shouldAnimateTrackedEntity =
      this.dependencies.entityBillboards.shouldAnimateGlyphMoveTransitions() &&
      (eventMonsterId !== 0 || this.shouldAllowTrackedPlayerAppearance());
    const previousMonsterId = this.runtimeMonsterIdByTileKey.get(key) ?? null;
    const isRuntimeClear = Boolean(tile.isRuntimeUndiscoveredClear);

    if (
      previousMonsterId !== null &&
      (isRuntimeClear || previousMonsterId !== eventMonsterId)
    ) {
      if (this.runtimeMonsterTileKeyById.get(previousMonsterId) === key) {
        this.pendingRuntimeMonsterVacatedTileKeyById.set(
          previousMonsterId,
          key,
        );
      }
      this.runtimeMonsterIdByTileKey.delete(key);
    }

    if (isRuntimeClear || eventMonsterId === null) {
      if (eventMonsterId !== null) {
        this.removeRuntimeMonsterTrackingById(eventMonsterId);
      }
      return;
    }

    this.rememberRuntimeMonsterLastSeenState(eventMonsterId, key, tile);
    const previousKeyForMonster =
      this.runtimeMonsterTileKeyById.get(eventMonsterId) ??
      this.pendingRuntimeMonsterVacatedTileKeyById.get(eventMonsterId) ??
      null;
    if (previousKeyForMonster && previousKeyForMonster !== key) {
      if (shouldAnimateTrackedEntity) {
        this.dependencies.entityMovement.startRuntimeMonsterMoveTransition(
          eventMonsterId,
          previousKeyForMonster,
          key,
          tile,
        );
      } else {
        const previousTile = this.dependencies.levelTerrainCache.parseTileKey(previousKeyForMonster);
        if (previousTile) {
          this.dependencies.entityMovement.restoreTileVisualFromRememberedTerrain(
            previousTile.x,
            previousTile.y,
          );
        }
      }
    }
    if (
      previousKeyForMonster &&
      previousKeyForMonster !== key &&
      this.runtimeMonsterIdByTileKey.get(previousKeyForMonster) ===
        eventMonsterId
    ) {
      this.runtimeMonsterIdByTileKey.delete(previousKeyForMonster);
    }

    this.pendingRuntimeMonsterVacatedTileKeyById.delete(eventMonsterId);
    this.runtimeMonsterTileKeyById.set(eventMonsterId, key);
    this.runtimeMonsterIdByTileKey.set(key, eventMonsterId);
    if (eventMonsterId === 0) {
      const previousMinimapPlayerKey = this.dependencies.minimap.minimapTrackedPlayerTileKey;
      if (previousMinimapPlayerKey && previousMinimapPlayerKey !== key) {
        this.dependencies.minimap.restoreMinimapTileFromRememberedTerrain(previousMinimapPlayerKey);
      }
      this.dependencies.minimap.minimapTrackedPlayerTileKey = key;
      this.dependencies.minimap.queueRuntimeTrackedPlayerMinimapTile(tile);
    }
  }

  resolveRuntimeMonsterLastSeenTileById(
    rawMonsterId: unknown,
  ): { x: number; y: number } | null {
    const state = this.resolveRuntimeMonsterLastSeenStateById(rawMonsterId);
    return state ? this.dependencies.levelTerrainCache.parseTileKey(state.tileKey) : null;
  }

  resolveRuntimeMonsterBillboardAppearanceById(
    rawMonsterId: unknown,
  ): RuntimeMonsterBillboardAppearance | null {
    return (
      this.resolveRuntimeMonsterLastSeenStateById(rawMonsterId)?.appearance ??
      null
    );
  }

  resolveRuntimeMonsterEffectTileById(
    rawMonsterId: unknown,
  ): { x: number; y: number } | null {
    return (
      this.resolveRuntimeMonsterTileById(rawMonsterId) ??
      this.resolveRuntimeMonsterLastSeenTileById(rawMonsterId)
    );
  }

  resolveRuntimeMonsterTileById(
    rawMonsterId: unknown,
  ): { x: number; y: number } | null {
    const monsterId = this.normalizeRuntimeTrackedEntityId(rawMonsterId);
    if (monsterId === null) {
      return null;
    }
    const key = this.runtimeMonsterTileKeyById.get(monsterId);
    return key ? this.dependencies.levelTerrainCache.parseTileKey(key) : null;
  }

  resolveRuntimeEffectOriginTileByEntityId(
    rawEntityId: unknown,
  ): { x: number; y: number } | null {
    const entityId = this.normalizeRuntimeTargetEntityId(rawEntityId);
    if (entityId === null) {
      return null;
    }
    if (entityId === 0) {
      return this.dependencies.playerMovement.hasSeenPlayerPosition
        ? { x: this.dependencies.playerMovement.playerPos.x, y: this.dependencies.playerMovement.playerPos.y }
        : null;
    }
    return this.resolveRuntimeMonsterEffectTileById(entityId);
  }
}
