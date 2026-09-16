import {
  classifyTileBehavior,
  getDefaultDarkWallGlyph,
  getDefaultFloorGlyph,
  isDarkCorridorCmapGlyph,
  isDoorwayCmapGlyph
} from "../../glyphs/behavior";
import { getGlyphCatalogEntry } from "../../glyphs/registry";
import type { TileBehaviorResult } from "../../glyphs";
import type { TerrainSnapshot } from "../../types";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { GlyphTextures } from "../rendering/glyph-textures";
import type { LevelTerrainCache } from "./level-terrain-cache";
import type { Lighting } from "../rendering/lighting";
import type { Minimap } from "../ui/minimap";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "./player-movement";
import type { PlayerStatus } from "../ui/player-status";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "./tile-updates";
import type { VultureWalls } from "../rendering/vulture-walls";
import type { WallGeometry } from "../rendering/wall-geometry";
import type { WallOverlays } from "../rendering/wall-overlays";
import type { WorldClassification } from "./world-classification";

export interface DarkCorridorInferenceDependencies {
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly engineState: Pick<
    EngineState,
    "characterCreationConfig"
    | "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "removeMonsterBillboard"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "disposeGlyphOverlay"
    | "glyphOverlayMap"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "getTileSnapshotFromStateCache"
    | "lastKnownTerrain"
    | "parseTileKey"
    | "parseTileStateSignature"
  >;
  readonly lighting: Pick<
    Lighting,
    "markLightingDirty"
  >;
  readonly minimap: Pick<
    Minimap,
    "isValidMinimapCoordinate"
    | "queueMinimapTileUpdate"
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
  readonly playerStatus: Pick<
    PlayerStatus,
    "statusConditionMask"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isTextInputActive"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "activeEffectTileKeys"
    | "tileMap"
    | "tileRevealStartMs"
    | "updateTile"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "isVultureTilesActive"
    | "resolveOverrideTileIndexForRuntime"
    | "resolveRuntimeVersion"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "collectPendingTileUpdates"
    | "hasPendingTileUpdateAtKey"
    | "tileStateCache"
  >;
  readonly vultureWalls: Pick<
    VultureWalls,
    "refreshVultureWallMaterialsNear"
  >;
  readonly wallGeometry: Pick<
    WallGeometry,
    "refreshFpsWallChamferGeometryNear"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "disposeIronBarsWallPlaneOverlay"
    | "disposeTransparentWallGroundPlaneOverlay"
    | "disposeVultureDoorPlaneOverlay"
    | "disposeVultureWallFaceOverlay"
    | "disposeVultureWallPlaneOverlay"
    | "disposeWallSideTileOverlay"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "classifyTilePayload"
    | "snapshotPersistentTerrainFromTile"
    | "flatFeatureUnderPlayerCache"
    | "isBoulderLikeBehavior"
    | "isUndiscoveredKind"
  >;
}

/** Dark corridor discovery windows, boulder-aware inference and inferred wall reconciliation. */
export class DarkCorridorInference {
  constructor(private readonly dependencies: DarkCorridorInferenceDependencies) {}

  private pendingInferenceTiles: ReadonlyMap<string, any> = new Map();
  private readonly pendingInferenceTerrain = new Map<string, TerrainSnapshot>();

  inferredDarkCorridorWallTiles: Map<string, { x: number; y: number }> =
    new Map();

  inferredDarkCorridorTileFlags: Set<string> = new Set();

  darkCorridorInputDiscoveryWindowActive: boolean = false;

  darkCorridorBlindSearchInferenceActive: boolean = false;

  darkCorridorBlindSearchInferenceUntilMs: number = 0;

  readonly darkCorridorBlindSearchInferenceWindowMs: number = 1600;

  newlyDiscoveredDarkCorridorTilesForCurrentInput: Map<
    string,
    { x: number; y: number }
  > = new Map();

  pendingBoulderPushDarkCorridorInference: {
    playerX: number;
    playerY: number;
    dx: number;
    dy: number;
  } | null = null;

  readonly darkCorridorDiscoveryDoorwayChars: ReadonlySet<string> =
    new Set([".", "-", "|"]);

  readonly darkCorridorInferenceRingInsetTiles: number = 1;

  readonly darkCorridorWallNeighborOffsets: ReadonlyArray<{
    dx: number;
    dy: number;
  }> = [
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
  ];

  addInferredDarkCorridorTile(key: string, x: number, y: number): void {
    this.inferredDarkCorridorWallTiles.set(key, { x, y });
    this.inferredDarkCorridorTileFlags.add(key);
  }

  removeInferredDarkCorridorTile(key: string): void {
    this.inferredDarkCorridorWallTiles.delete(key);
    this.inferredDarkCorridorTileFlags.delete(key);
  }

  hasAuthoritativeTileDataForDarkCorridorInference(
    key: string,
  ): boolean {
    return (
      this.dependencies.tileUpdates.tileStateCache.has(key) ||
      this.dependencies.levelTerrainCache.lastKnownTerrain.has(key) ||
      this.dependencies.worldClassification.flatFeatureUnderPlayerCache.has(key) ||
      this.dependencies.tileUpdates.hasPendingTileUpdateAtKey(key)
    );
  }

  isBoulderKnownAtKeyForDarkCorridorInference(key: string): boolean {
    const terrain = this.pendingInferenceTiles.get(key) ?? this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
    if (!terrain) {
      return false;
    }
    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: terrain.char ?? null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null,
    });
    if (behavior.effective.glyph === 2353) {
      return true;
    }
    return this.dependencies.worldClassification.isBoulderLikeBehavior(behavior);
  }

  isPetKnownAtKeyForDarkCorridorInference(key: string): boolean {
    const terrain = this.pendingInferenceTiles.get(key) ?? this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
    if (!terrain) {
      return false;
    }
    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: terrain.char ?? null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null,
    });
    return behavior.effective.kind === "pet";
  }

  isBoulderOrPetKnownAtKeyForDarkCorridorInference(
    key: string,
  ): boolean {
    return (
      this.isBoulderKnownAtKeyForDarkCorridorInference(key) ||
      this.isPetKnownAtKeyForDarkCorridorInference(key)
    );
  }

  buildBoulderPushDarkCorridorInferenceContext(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): { playerX: number; playerY: number; dx: number; dy: number } | null {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return null;
    }

    const destinationKey = `${toX},${toY}`;
    if (
      !this.isBoulderOrPetKnownAtKeyForDarkCorridorInference(destinationKey)
    ) {
      return null;
    }

    return {
      playerX: toX,
      playerY: toY,
      dx,
      dy,
    };
  }

  applyBoulderPushDarkCorridorWallOverride(
    nextInferred: Map<string, { x: number; y: number }>,
    context: {
      playerX: number;
      playerY: number;
      dx: number;
      dy: number;
    } | null,
  ): void {
    if (!context || this.isPlayerBlindForDarkCorridorInference()) {
      return;
    }
    if (
      this.dependencies.playerMovement.playerPos.x !== context.playerX ||
      this.dependencies.playerMovement.playerPos.y !== context.playerY
    ) {
      return;
    }

    const playerKey = `${context.playerX},${context.playerY}`;
    if (this.isBoulderOrPetKnownAtKeyForDarkCorridorInference(playerKey)) {
      return;
    }

    const leftDx = -context.dy;
    const leftDy = context.dx;
    const rightDx = context.dy;
    const rightDy = -context.dx;
    const lateralOffsets = [
      { dx: leftDx, dy: leftDy },
      { dx: rightDx, dy: rightDy },
    ];
    const forwardDiagonalOffsets = [
      { dx: context.dx + leftDx, dy: context.dy + leftDy },
      { dx: context.dx + rightDx, dy: context.dy + rightDy },
    ];

    for (const offset of lateralOffsets) {
      const neighborX = context.playerX + offset.dx;
      const neighborY = context.playerY + offset.dy;
      if (!this.dependencies.minimap.isValidMinimapCoordinate(neighborX, neighborY)) {
        continue;
      }

      const neighborKey = `${neighborX},${neighborY}`;
      if (this.hasAuthoritativeTileDataForDarkCorridorInference(neighborKey)) {
        continue;
      }
      if (!this.shouldInferDarkCorridorWallAt(neighborKey)) {
        continue;
      }
      nextInferred.set(neighborKey, { x: neighborX, y: neighborY });
    }

    for (const offset of forwardDiagonalOffsets) {
      const neighborX = context.playerX + offset.dx;
      const neighborY = context.playerY + offset.dy;
      if (!this.dependencies.minimap.isValidMinimapCoordinate(neighborX, neighborY)) {
        continue;
      }

      const neighborKey = `${neighborX},${neighborY}`;
      if (this.hasAuthoritativeTileDataForDarkCorridorInference(neighborKey)) {
        continue;
      }
      if (!this.shouldInferDarkCorridorWallAt(neighborKey)) {
        continue;
      }
      nextInferred.set(neighborKey, { x: neighborX, y: neighborY });
    }
  }

  beginDarkCorridorDiscoveryWindowFromPlayerInput(options?: {
    allowBlindSearchInference?: boolean;
  }): void {
    const wasBlindSearchInferenceActive =
      this.darkCorridorBlindSearchInferenceActive;
    this.darkCorridorInputDiscoveryWindowActive = true;
    this.darkCorridorBlindSearchInferenceActive =
      options?.allowBlindSearchInference === true;
    this.darkCorridorBlindSearchInferenceUntilMs = this
      .darkCorridorBlindSearchInferenceActive
      ? Date.now() + this.darkCorridorBlindSearchInferenceWindowMs
      : 0;
    this.newlyDiscoveredDarkCorridorTilesForCurrentInput.clear();

    if (
      wasBlindSearchInferenceActive &&
      !this.darkCorridorBlindSearchInferenceActive &&
      this.isPlayerBlindForDarkCorridorInference()
    ) {
      this.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
    }
  }

  shouldEnableBlindDarkCorridorInferenceForInput(
    input: string,
  ): boolean {
    return (
      input === "s" &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.positionSelection.positionInputModeActive &&
      !this.dependencies.promptDialogs.isTextInputActive
    );
  }

  isBlindSearchInferenceWindowActive(nowMs: number): boolean {
    return (
      this.darkCorridorBlindSearchInferenceActive &&
      nowMs <= this.darkCorridorBlindSearchInferenceUntilMs
    );
  }

  expireBlindSearchInferenceWindowIfNeeded(): void {
    if (!this.darkCorridorBlindSearchInferenceActive) {
      return;
    }
    const nowMs = Date.now();
    if (nowMs <= this.darkCorridorBlindSearchInferenceUntilMs) {
      return;
    }
    this.darkCorridorBlindSearchInferenceActive = false;
    this.darkCorridorBlindSearchInferenceUntilMs = 0;
    if (this.isPlayerBlindForDarkCorridorInference()) {
      this.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
    }
  }

  isLegacy343StyleDarkCorridorInferenceTile(
    tile:
      | Pick<
    TerrainSnapshot,
    "glyph"
    | "char"
    | "tileIndex"
  >
      | {
          glyph?: number;
          char?: string;
          tileIndex?: number;
        }
      | null
      | undefined,
  ): boolean {
    const runtimeVersion =
      this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7";
    if (runtimeVersion !== "slashem") {
      return false;
    }
    if (
      !tile ||
      typeof tile.glyph !== "number" ||
      !Number.isFinite(tile.glyph)
    ) {
      return false;
    }

    const glyph = Math.trunc(tile.glyph);
    // Slash'EM / NetHack 3.4.3-style runtimes expose discovered dark corridor
    // floors through glyph 3612 (`#`, tile 1195) rather than the cmap-index 21
    // signal used by the 3.6.x inference path.
    if (glyph === 3612) {
      return true;
    }

    const catalogEntry = getGlyphCatalogEntry(glyph);
    const runtimeChar =
      typeof tile.char === "string" && tile.char.length > 0
        ? tile.char.charAt(0)
        : null;
    const resolvedChar =
      runtimeChar ??
      (typeof catalogEntry?.asciiChar === "string" &&
      catalogEntry.asciiChar.length > 0
        ? catalogEntry.asciiChar.charAt(0)
        : null);
    const resolvedTileIndex =
      typeof tile.tileIndex === "number" && Number.isFinite(tile.tileIndex)
        ? Math.trunc(tile.tileIndex)
        : typeof catalogEntry?.tileIndex === "number" &&
            Number.isFinite(catalogEntry.tileIndex)
          ? Math.trunc(catalogEntry.tileIndex)
          : null;

    return resolvedChar === "#" && resolvedTileIndex === 1195;
  }

  isDarkCorridorInferenceTile(
    tile:
      | Pick<
    TerrainSnapshot,
    "glyph"
    | "char"
    | "tileIndex"
  >
      | {
          glyph?: number;
          char?: string;
          tileIndex?: number;
        }
      | null
      | undefined,
  ): boolean {
    if (
      !tile ||
      typeof tile.glyph !== "number" ||
      !Number.isFinite(tile.glyph)
    ) {
      return false;
    }
    if (this.isLegacy343StyleDarkCorridorInferenceTile(tile)) {
      return true;
    }
    return isDarkCorridorCmapGlyph(Math.trunc(tile.glyph));
  }

  isTileKnownAsDarkCorridorFromCaches(key: string): boolean {
    const terrain = this.getKnownTerrainSnapshotForInferenceAtKey(key);
    return this.isDarkCorridorInferenceTile(terrain);
  }

  recordNewlyDiscoveredDarkCorridorTileForCurrentInput(
    tile: any,
  ): void {
    if (
      !this.darkCorridorInputDiscoveryWindowActive ||
      !tile ||
      typeof tile.x !== "number" ||
      typeof tile.y !== "number" ||
      typeof tile.glyph !== "number"
    ) {
      return;
    }

    if (!this.dependencies.minimap.isValidMinimapCoordinate(tile.x, tile.y)) {
      return;
    }
    if (!this.isDarkCorridorInferenceTile(tile)) {
      return;
    }

    const key = `${tile.x},${tile.y}`;
    if (this.isTileKnownAsDarkCorridorFromCaches(key)) {
      return;
    }

    this.newlyDiscoveredDarkCorridorTilesForCurrentInput.set(key, {
      x: tile.x,
      y: tile.y,
    });
  }

  getKnownTerrainSnapshotForInferenceAtKey(
    key: string,
  ): TerrainSnapshot | null {
    const pendingTerrain = this.pendingInferenceTerrain.get(key);
    if (pendingTerrain) return pendingTerrain;
    const cachedTerrain = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key);
    if (cachedTerrain) {
      return cachedTerrain;
    }

    const cachedFlatFeature = this.dependencies.worldClassification.flatFeatureUnderPlayerCache.get(key);
    if (cachedFlatFeature) {
      return cachedFlatFeature;
    }

    return this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
  }

  getDoorwayActivationCharForInference(
    terrain: TerrainSnapshot,
  ): string | null {
    if (typeof terrain.char === "string" && terrain.char.length > 0) {
      return terrain.char.charAt(0);
    }

    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: terrain,
    });
    if (
      typeof behavior.glyphChar === "string" &&
      behavior.glyphChar.length > 0
    ) {
      return behavior.glyphChar.charAt(0);
    }
    return null;
  }

  shouldUsePlayerTileAsDarkCorridorInferenceOrigin(): boolean {
    const playerKey = `${this.dependencies.playerMovement.playerPos.x},${this.dependencies.playerMovement.playerPos.y}`;
    const terrain = this.getKnownTerrainSnapshotForInferenceAtKey(playerKey);
    if (!terrain || typeof terrain.glyph !== "number") {
      return false;
    }
    if (isDoorwayCmapGlyph(terrain.glyph)) {
      return true;
    }

    const activationChar = this.getDoorwayActivationCharForInference(terrain);
    return Boolean(
      activationChar &&
      this.darkCorridorDiscoveryDoorwayChars.has(activationChar),
    );
  }

  classifyAuthoritativeTileForDarkCorridorInference(
    key: string,
  ): TileBehaviorResult | null {
    const terrain = this.pendingInferenceTerrain.get(key) ?? this.dependencies.levelTerrainCache.lastKnownTerrain.get(key);
    if (terrain) {
      return classifyTileBehavior({
        glyph: terrain.glyph,
        runtimeChar: terrain.char ?? null,
        runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
        runtimeTileIndex:
          typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
        priorTerrain: terrain,
      });
    }

    const snapshot = this.pendingInferenceTiles.get(key) ?? this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
    if (!snapshot) {
      return null;
    }
    return classifyTileBehavior({
      glyph: snapshot.glyph,
      runtimeChar: snapshot.char ?? null,
      runtimeColor: typeof snapshot.color === "number" ? snapshot.color : null,
      runtimeTileIndex:
        typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
      priorTerrain: null,
    });
  }

  collectDiscoveredDarkCorridorTiles(): Map<
    string,
    { x: number; y: number }
  > {
    const discovered = new Map<string, { x: number; y: number }>();

    const tryAddKey = (
      key: string,
      tile:
        | Pick<
    TerrainSnapshot,
    "glyph"
    | "char"
    | "tileIndex"
  >
        | {
            glyph?: number;
            char?: string;
            tileIndex?: number;
          },
    ): void => {
      if (!this.isDarkCorridorInferenceTile(tile)) {
        return;
      }
      const parsedKey = this.dependencies.levelTerrainCache.parseTileKey(key);
      if (!parsedKey) {
        return;
      }
      if (!this.dependencies.minimap.isValidMinimapCoordinate(parsedKey.x, parsedKey.y)) {
        return;
      }
      discovered.set(key, parsedKey);
    };

    for (const [key, terrain] of this.dependencies.levelTerrainCache.lastKnownTerrain.entries()) {
      if (terrain && typeof terrain.glyph === "number") {
        tryAddKey(key, terrain);
      }
    }

    for (const [key, signature] of this.dependencies.tileUpdates.tileStateCache.entries()) {
      if (discovered.has(key)) {
        continue;
      }
      const parsed = this.dependencies.levelTerrainCache.parseTileStateSignature(signature);
      if (!parsed) {
        continue;
      }
      tryAddKey(key, parsed);
    }

    // Queued terrain is already authoritative even when its mesh is budgeted
    // for a later frame. Newer non-corridor terrain also supersedes old memory.
    for (const [key, terrain] of this.pendingInferenceTerrain) {
      discovered.delete(key);
      tryAddKey(key, terrain);
    }
    return discovered;
  }

  getGreatestCommonDivisor(a: number, b: number): number {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y !== 0) {
      const remainder = x % y;
      x = y;
      y = remainder;
    }
    return x;
  }

  isDarkCorridorWallInferenceEnabled(): boolean {
    if (this.dependencies.terminalRendering.isTerminalDisplayMode()) {
      // The terminal shows runtime output verbatim; inferred walls are a
      // 3D-mode presentation aid.
      return false;
    }
    const runtimeVersion =
      this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7";
    if (runtimeVersion === "5.0") {
      return false;
    }
    // Vulture mode relies on legacy 3.4.3/3.6.x dark corridor wall inference, so
    // the toggle is ignored and treated as enabled while Vulture tiles are active.
    if (this.dependencies.tilesetAssets.isVultureTilesActive(this.dependencies.engineState.clientOptions)) {
      return true;
    }
    return this.dependencies.engineState.clientOptions.darkCorridorWalls367;
  }

  isDarkCorridorWallSettingsSuppressedByVultureTiles(): boolean {
    return this.dependencies.tilesetAssets.isVultureTilesActive(this.dependencies.engineState.clientOptions);
  }

  resolveInferredDarkCorridorWallTileTextureIndex(
    fallbackTileIndex: number,
    isInferredDarkCorridorWall: boolean,
  ): number {
    if (!isInferredDarkCorridorWall) {
      return fallbackTileIndex;
    }
    if (this.isDarkCorridorWallSettingsSuppressedByVultureTiles()) {
      return fallbackTileIndex;
    }
    if (this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return fallbackTileIndex;
    }
    if (!this.dependencies.engineState.clientOptions.darkCorridorWallTileOverrideEnabled) {
      return fallbackTileIndex;
    }
    const overrideTileIndex = Math.trunc(
      this.dependencies.engineState.clientOptions.darkCorridorWallTileOverrideTileId,
    );
    if (!Number.isFinite(overrideTileIndex) || overrideTileIndex < 0) {
      return fallbackTileIndex;
    }
    return this.dependencies.tilesetAssets.resolveOverrideTileIndexForRuntime(overrideTileIndex);
  }

  resolveInferredDarkCorridorWallSolidColorHex(
    isInferredDarkCorridorWall: boolean,
  ): string | null {
    if (!isInferredDarkCorridorWall) {
      return null;
    }
    if (this.isDarkCorridorWallSettingsSuppressedByVultureTiles()) {
      return null;
    }
    if (!this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return null;
    }
    const preferredHex = this.dependencies.movementInput.isFpsMode()
      ? this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorHexFps
      : this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorHex;
    const fallbackHex = this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorHex;
    const normalized = String(preferredHex || fallbackHex || "").trim();
    const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) {
      return null;
    }
    return `#${match[1].toLowerCase()}`;
  }

  resolveInferredDarkCorridorWallSolidColorGridEnabled(
    isInferredDarkCorridorWall: boolean,
  ): boolean {
    if (!isInferredDarkCorridorWall) {
      return false;
    }
    if (this.isDarkCorridorWallSettingsSuppressedByVultureTiles()) {
      return false;
    }
    if (!this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return false;
    }
    return this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorGridEnabled === true;
  }

  resolveInferredDarkCorridorWallSolidColorGridDarknessPercent(
    isInferredDarkCorridorWall: boolean,
  ): number {
    if (!isInferredDarkCorridorWall) {
      return 15;
    }
    if (this.isDarkCorridorWallSettingsSuppressedByVultureTiles()) {
      return 15;
    }
    if (!this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorOverrideEnabled) {
      return 15;
    }
    const raw =
      this.dependencies.engineState.clientOptions.darkCorridorWallSolidColorGridDarknessPercent;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return 15;
    }
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  getDarkCorridorRayDepthFromPlayer(
    tileX: number,
    tileY: number,
  ): { rayKey: string; depth: number } | null {
    const dx = tileX - this.dependencies.playerMovement.playerPos.x;
    const dy = tileY - this.dependencies.playerMovement.playerPos.y;
    if (dx === 0 && dy === 0) {
      return null;
    }
    const gcd = this.getGreatestCommonDivisor(dx, dy);
    if (gcd <= 0) {
      return null;
    }
    return {
      rayKey: `${dx / gcd},${dy / gcd}`,
      depth: gcd,
    };
  }

  buildDarkCorridorFrontierDepthByRay(
    darkCorridorTiles: Map<string, { x: number; y: number }>,
  ): Map<string, number> {
    const maxDepthByRay = new Map<string, number>();
    for (const tile of darkCorridorTiles.values()) {
      const rayDepth = this.getDarkCorridorRayDepthFromPlayer(tile.x, tile.y);
      if (!rayDepth) {
        continue;
      }
      const currentMax = maxDepthByRay.get(rayDepth.rayKey) ?? 0;
      if (rayDepth.depth > currentMax) {
        maxDepthByRay.set(rayDepth.rayKey, rayDepth.depth);
      }
    }
    return maxDepthByRay;
  }

  canInferDarkCorridorWallsFromTile(
    tileX: number,
    tileY: number,
    frontierDepthByRay: Map<string, number>,
  ): boolean {
    if (tileX === this.dependencies.playerMovement.playerPos.x && tileY === this.dependencies.playerMovement.playerPos.y) {
      return true;
    }

    const rayDepth = this.getDarkCorridorRayDepthFromPlayer(tileX, tileY);
    if (!rayDepth) {
      return false;
    }
    const farthestDepthOnRay = frontierDepthByRay.get(rayDepth.rayKey);
    if (typeof farthestDepthOnRay !== "number") {
      return false;
    }

    // Frontier is computed per player-ray. We inset inference by one extra ring
    // so each ray keeps its outer bands as frontier.
    const inferenceDepthExclusive = Math.max(
      1,
      farthestDepthOnRay - this.darkCorridorInferenceRingInsetTiles,
    );
    return rayDepth.depth < inferenceDepthExclusive;
  }

  shouldInferDarkCorridorWallAt(key: string): boolean {
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (mesh && !mesh.userData?.isInferredDarkCorridorWall) {
      return false;
    }

    const knownBehavior =
      this.classifyAuthoritativeTileForDarkCorridorInference(key);
    if (!knownBehavior) {
      return true;
    }

    return this.dependencies.worldClassification.isUndiscoveredKind(knownBehavior.effective.kind);
  }

  clearInferredDarkCorridorWallMeshAt(
    key: string,
    tileX: number,
    tileY: number,
  ): void {
    this.removeInferredDarkCorridorTile(key);

    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (!mesh || !mesh.userData?.isInferredDarkCorridorWall) {
      return;
    }

    this.dependencies.wallOverlays.disposeWallSideTileOverlay(mesh);
    this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
    this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
    this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
    this.dependencies.wallOverlays.disposeTransparentWallGroundPlaneOverlay(mesh);
    this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
    this.dependencies.renderPipeline.scene.remove(mesh);
    this.dependencies.tileRendering.tileMap.delete(key);
    this.dependencies.tileRendering.tileRevealStartMs.delete(key);
    this.dependencies.tileRendering.activeEffectTileKeys.delete(key);
    this.dependencies.entityBillboards.removeMonsterBillboard(key);

    const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
    if (overlay) {
      this.dependencies.glyphTextures.disposeGlyphOverlay(overlay);
      this.dependencies.glyphTextures.glyphOverlayMap.delete(key);
    }

    const undiscoveredFallbackBehavior = classifyTileBehavior({
      glyph: getDefaultFloorGlyph(),
      runtimeChar: ".",
      runtimeColor: null,
      priorTerrain: null,
    });
    this.dependencies.minimap.queueMinimapTileUpdate(
      tileX,
      tileY,
      undiscoveredFallbackBehavior,
      true,
    );
    this.dependencies.wallGeometry.refreshFpsWallChamferGeometryNear(tileX, tileY);
    this.dependencies.vultureWalls.refreshVultureWallMaterialsNear(tileX, tileY);
    this.dependencies.lighting.markLightingDirty();
  }

  clearAllInferredDarkCorridorWallMeshes(): void {
    for (const [key, tile] of Array.from(
      this.inferredDarkCorridorWallTiles.entries(),
    )) {
      this.clearInferredDarkCorridorWallMeshAt(key, tile.x, tile.y);
    }

    for (const [key, mesh] of Array.from(this.dependencies.tileRendering.tileMap.entries())) {
      if (!mesh.userData?.isInferredDarkCorridorWall) {
        continue;
      }
      const parsedKey = this.dependencies.levelTerrainCache.parseTileKey(key);
      if (!parsedKey) {
        continue;
      }
      this.clearInferredDarkCorridorWallMeshAt(key, parsedKey.x, parsedKey.y);
    }
  }

  requestInferredDarkCorridorWallReconcile(options?: {
    forceImmediate?: boolean;
  }): void {
    if (options?.forceImmediate === true) {
      this.reconcileInferredDarkCorridorWalls();
      return;
    }
    this.reconcileInferredDarkCorridorWalls();
  }

  reconcileInferredDarkCorridorWalls(): void {
    if (!this.isDarkCorridorWallInferenceEnabled()) {
      this.pendingBoulderPushDarkCorridorInference = null;
      this.clearAllInferredDarkCorridorWallMeshes();
      return;
    }
    this.pendingInferenceTiles = this.dependencies.tileUpdates.collectPendingTileUpdates();
    try {
      for (const [key, tile] of this.pendingInferenceTiles) {
        const behavior = this.dependencies.worldClassification.classifyTilePayload(tile);
        if (!behavior || this.dependencies.worldClassification.isUndiscoveredKind(behavior.effective.kind)) continue;
        const terrain = this.dependencies.worldClassification.snapshotPersistentTerrainFromTile(tile, behavior);
        if (terrain) this.pendingInferenceTerrain.set(key, terrain);
      }
      this.reconcileInferredDarkCorridorWallsFromObservations();
    } finally {
      this.pendingInferenceTiles = new Map();
      this.pendingInferenceTerrain.clear();
    }
  }

  private reconcileInferredDarkCorridorWallsFromObservations(): void {
    const nowMs = Date.now();
    const pendingBoulderPushInference =
      this.pendingBoulderPushDarkCorridorInference;
    this.pendingBoulderPushDarkCorridorInference = null;

    if (!this.isDarkCorridorWallInferenceEnabled()) {
      this.clearAllInferredDarkCorridorWallMeshes();
      return;
    }

    if (
      this.isPlayerBlindForDarkCorridorInference() &&
      !this.isBlindSearchInferenceWindowActive(nowMs)
    ) {
      this.clearAllInferredDarkCorridorWallMeshes();
      return;
    }

    if (!this.dependencies.playerMovement.hasSeenPlayerPosition) {
      for (const [key, tile] of Array.from(
        this.inferredDarkCorridorWallTiles.entries(),
      )) {
        this.clearInferredDarkCorridorWallMeshAt(key, tile.x, tile.y);
      }
      return;
    }

    const darkCorridorTiles = this.collectDiscoveredDarkCorridorTiles();
    const frontierSeedDarkCorridorTiles = this
      .darkCorridorInputDiscoveryWindowActive
      ? this.newlyDiscoveredDarkCorridorTilesForCurrentInput
      : new Map<string, { x: number; y: number }>();
    const frontierDepthByRay = this.buildDarkCorridorFrontierDepthByRay(
      frontierSeedDarkCorridorTiles,
    );
    const inferenceSourceTiles = new Map(darkCorridorTiles);
    if (this.shouldUsePlayerTileAsDarkCorridorInferenceOrigin()) {
      const playerKey = `${this.dependencies.playerMovement.playerPos.x},${this.dependencies.playerMovement.playerPos.y}`;
      inferenceSourceTiles.set(playerKey, {
        x: this.dependencies.playerMovement.playerPos.x,
        y: this.dependencies.playerMovement.playerPos.y,
      });
    }
    const nextInferred = new Map<string, { x: number; y: number }>();

    for (const tile of inferenceSourceTiles.values()) {
      if (
        !this.canInferDarkCorridorWallsFromTile(
          tile.x,
          tile.y,
          frontierDepthByRay,
        )
      ) {
        continue;
      }

      for (const offset of this.darkCorridorWallNeighborOffsets) {
        const neighborX = tile.x + offset.dx;
        const neighborY = tile.y + offset.dy;
        if (!this.dependencies.minimap.isValidMinimapCoordinate(neighborX, neighborY)) {
          continue;
        }

        const neighborKey = `${neighborX},${neighborY}`;
        if (darkCorridorTiles.has(neighborKey)) {
          continue;
        }
        if (!this.shouldInferDarkCorridorWallAt(neighborKey)) {
          continue;
        }
        nextInferred.set(neighborKey, { x: neighborX, y: neighborY });
      }
    }
    this.applyBoulderPushDarkCorridorWallOverride(
      nextInferred,
      pendingBoulderPushInference,
    );

    const darkWallGlyph = getDefaultDarkWallGlyph();
    const newlyInferredKeys = new Set<string>();
    for (const [key, tile] of nextInferred.entries()) {
      if (!this.inferredDarkCorridorWallTiles.has(key)) {
        newlyInferredKeys.add(key);
      }
      this.addInferredDarkCorridorTile(key, tile.x, tile.y);
    }

    for (const [key, tile] of Array.from(
      this.inferredDarkCorridorWallTiles.entries(),
    )) {
      if (!this.shouldInferDarkCorridorWallAt(key)) {
        // A pending floor can invalidate an inferred wall before the floor's
        // mesh is built. Remove that wall now, not at the end of discovery.
        this.clearInferredDarkCorridorWallMeshAt(key, tile.x, tile.y);
        continue;
      }

      const mesh = this.dependencies.tileRendering.tileMap.get(key);
      if (mesh && !mesh.userData?.isInferredDarkCorridorWall) {
        continue;
      }

      this.dependencies.tileRendering.updateTile(tile.x, tile.y, darkWallGlyph, " ", undefined, {
        inferredDarkCorridorWall: true,
        restartRevealFade: newlyInferredKeys.has(key),
      });
    }
  }

  isPlayerBlindForDarkCorridorInference(): boolean {
    return (
      (this.dependencies.playerStatus.statusConditionMask & this.resolveStatusConditionBlindMask()) !== 0
    );
  }

  resolveStatusConditionBlindMask(): number {
    const runtimeVersion = this.dependencies.tilesetAssets.resolveRuntimeVersion();
    if (runtimeVersion === "5.0") {
      return 0x00000002;
    }
    if (runtimeVersion === "slashem") {
      return 0x00000010;
    }
    return 0x00000020;
  }
}
