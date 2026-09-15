import { classifyTileBehavior } from "../../glyphs/behavior";
import type { TerrainSnapshot } from "../../types";
import type {
  LevelCacheObservedTile,
  LevelTerrainCacheSnapshot,
  LevelTerrainCacheEntry,
  PendingLevelCacheTransition,
  RuntimeLevelIdentity
} from "../shared/types";
import type { BloodGround } from "../effects/blood-ground";
import type { DarkCorridorInference } from "./dark-corridor-inference";
import type { PlayerStatus } from "../ui/player-status";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TileUpdates } from "./tile-updates";
import type { VultureWalls } from "../rendering/vulture-walls";
import type { WorldClassification } from "./world-classification";

type ParsedTileState = {
  glyph: number;
  char?: string;
  color?: number;
  tileIndex?: number;
  symidx?: number;
  glyphFlags?: number;
};

export interface LevelTerrainCacheDependencies {
  readonly bloodGround: Pick<
    BloodGround,
    "captureActiveBloodGroundCacheSnapshot"
    | "clearActiveBloodGroundCanvas"
    | "cloneBloodGroundCacheSnapshot"
    | "disposeBloodGroundOverlayResources"
    | "restoreBloodGroundCacheSnapshot"
  >;
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "inferredDarkCorridorTileFlags"
    | "inferredDarkCorridorWallTiles"
  >;
  readonly playerStatus: Pick<
    PlayerStatus,
    "playerStats"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "updateTile"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "buildTileStateSignatureFromPayload"
    | "flushPendingTileUpdates"
    | "pendingTileFlushQueue"
    | "pendingTileFlushQueueIndex"
    | "pendingTileUpdates"
    | "refreshTilesFromStateCache"
    | "tileStateCache"
  >;
  readonly vultureWalls: Pick<
    VultureWalls,
    "flushPendingVultureWallMaterialRefreshes"
    | "pendingVultureWallMaterialRefreshKeys"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "flatFeatureUnderPlayerCache"
    | "suppressedLootLikeUnderPlayerCacheKeys"
  >;
}

/** Level identity, remembered terrain snapshots, and deterministic or sampled transition restoration. */
export class LevelTerrainCache {
  private readonly parsedTileSignatures = new Map<string, ParsedTileState | null>();
  constructor(private readonly dependencies: LevelTerrainCacheDependencies) {}

  lastKnownTerrain: Map<string, TerrainSnapshot> = new Map();

  levelTerrainCachesByName: Map<string, LevelTerrainCacheEntry[]> =
    new Map();

  activeLevelCacheRef: { levelName: string; entryId: string } | null =
    null;

  currentLevelCacheName: string | null = null;

  latestLevelDescriptorName: string | null = null;

  latestRuntimeLevelIdentity: RuntimeLevelIdentity | null = null;

  hasResolvedInitialDeterministicLevelThisSession: boolean = false;

  pendingLevelCacheTransition: PendingLevelCacheTransition | null =
    null;

  readonly levelCacheDisambiguationWallSampleMin: number = 6;

  readonly levelCacheWallComparisonMin: number = 10;

  readonly levelCacheWallMismatchToleranceRatio: number = 0.18;

  readonly levelCacheWallMismatchToleranceMin: number = 3;

  normalizeLevelCacheName(rawValue: unknown): string | null {
    const normalized = String(rawValue ?? "")
      .replace(/\s+/g, " ")
      .trim();
    return normalized.length > 0 ? normalized : null;
  }

  normalizeDungeonDisplayName(rawValue: unknown): string | null {
    const normalized = this.normalizeLevelCacheName(rawValue);
    if (!normalized) {
      return null;
    }
    return normalized.replace(/^the\s+/i, "").trim();
  }

  normalizeBranchDisplayName(rawValue: unknown): string | null {
    const normalized = this.normalizeLevelCacheName(rawValue);
    if (!normalized) {
      return null;
    }
    const byTag: Record<string, string> = {
      dungeons_of_doom: "Dungeons of Doom",
      mines: "Gnomish Mines",
      quest: "Quest",
      sokoban: "Sokoban",
      vlads_tower: "Vlad's Tower",
      endgame: "Endgame",
    };
    const key = normalized.toLowerCase();
    return byTag[key] ?? null;
  }

  isDepthOnlyLevelDescriptor(levelName: string): boolean {
    return /^dlvl:\s*-?\d+\s*$/i.test(String(levelName || "").trim());
  }

  shouldDisambiguateSingleLevelCacheCandidate(
    levelName: string,
    identity: RuntimeLevelIdentity | null = this.latestRuntimeLevelIdentity,
  ): boolean {
    if (this.buildLevelCacheIdentifierFromRuntimeLevelIdentity(identity)) {
      return false;
    }
    return this.isDepthOnlyLevelDescriptor(levelName);
  }

  parseRuntimeLevelIdentity(
    rawIdentity: unknown,
  ): RuntimeLevelIdentity | null {
    if (!rawIdentity || typeof rawIdentity !== "object") {
      return null;
    }

    const parseInteger = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      const normalized = String(value ?? "").trim();
      if (!normalized || !/^-?\d+$/.test(normalized)) {
        return null;
      }
      const parsed = Number.parseInt(normalized, 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const identity = rawIdentity as Record<string, unknown>;
    const dnum = parseInteger(identity.dnum);
    const dlevel = parseInteger(identity.dlevel);
    if (dnum === null || dlevel === null) {
      return null;
    }

    return {
      dnum,
      dlevel,
      ledgerNo: parseInteger(identity.ledgerNo),
      depth: parseInteger(identity.depth),
      dungeonName: this.normalizeLevelCacheName(identity.dungeonName),
      branchTag: this.normalizeLevelCacheName(identity.branchTag),
    };
  }

  buildLevelCacheIdentifierFromRuntimeLevelIdentity(
    identity: RuntimeLevelIdentity | null = this.latestRuntimeLevelIdentity,
  ): string | null {
    if (!identity) {
      return null;
    }
    if (
      typeof identity.ledgerNo === "number" &&
      Number.isFinite(identity.ledgerNo)
    ) {
      return `ledger:${Math.trunc(identity.ledgerNo)}`;
    }
    if (
      typeof identity.branchTag === "string" &&
      identity.branchTag.trim().length > 0 &&
      Number.isFinite(identity.dlevel)
    ) {
      return `branch:${identity.branchTag.trim().toLowerCase()};dlevel:${Math.trunc(identity.dlevel)}`;
    }
    if (Number.isFinite(identity.dnum) && Number.isFinite(identity.dlevel)) {
      return `dnum:${Math.trunc(identity.dnum)};dlevel:${Math.trunc(identity.dlevel)}`;
    }
    return null;
  }

  applyRuntimeLevelIdentity(rawIdentity: unknown): void {
    const identity = this.parseRuntimeLevelIdentity(rawIdentity);
    if (!identity) {
      return;
    }

    this.latestRuntimeLevelIdentity = identity;

    if (Number.isFinite(identity.dlevel)) {
      this.dependencies.playerStatus.playerStats.dlevel = Math.trunc(identity.dlevel);
    }
    const identityDungeonName = this.normalizeDungeonDisplayName(
      identity.dungeonName,
    );
    if (identityDungeonName) {
      this.dependencies.playerStatus.playerStats.dungeon = identityDungeonName;
      return;
    }

    const branchDisplayName = this.normalizeBranchDisplayName(
      identity.branchTag,
    );
    if (branchDisplayName) {
      this.dependencies.playerStatus.playerStats.dungeon = branchDisplayName;
    }
  }

  handleDeterministicLevelCacheResolution(levelName: string): void {
    const normalizedLevelName = this.normalizeLevelCacheName(levelName);
    if (!normalizedLevelName) {
      return;
    }
    if (/^unresolved level\s+\d+$/i.test(normalizedLevelName)) {
      return;
    }

    if (!this.hasResolvedInitialDeterministicLevelThisSession) {
      this.hasResolvedInitialDeterministicLevelThisSession = true;
      return;
    }
  }

  extractDlevelFromLevelDescriptor(
    levelDescriptor: string,
  ): number | null {
    const clean = String(levelDescriptor || "").trim();
    if (!clean) {
      return null;
    }

    const patterns = [
      /^dlvl:\s*(-?\d+)\s*$/i,
      /^home\s+(-?\d+)\s*$/i,
      /^[^:]+:\s*(-?\d+)\s*$/i,
    ];
    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (!match || !match[1]) {
        continue;
      }
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  formatOverviewStyleLocationFromDescriptor(
    descriptor: string | null,
    identity: RuntimeLevelIdentity | null = this.latestRuntimeLevelIdentity,
  ): string | null {
    const normalizedDescriptor = this.normalizeLevelCacheName(descriptor);
    if (!normalizedDescriptor) {
      return null;
    }

    const normalizedLower = normalizedDescriptor.toLowerCase();
    const endgameElementByDescriptor: Record<string, string> = {
      earth: "Plane of Earth",
      air: "Plane of Air",
      fire: "Plane of Fire",
      water: "Plane of Water",
      astral: "Astral Plane",
    };
    if (endgameElementByDescriptor[normalizedLower]) {
      return endgameElementByDescriptor[normalizedLower];
    }

    const dungeonNameFromIdentity = this.normalizeDungeonDisplayName(
      identity?.dungeonName,
    );
    const dungeonLabel =
      dungeonNameFromIdentity ??
      this.normalizeDungeonDisplayName(this.dependencies.playerStatus.playerStats.dungeon);
    const parsedLevel =
      this.extractDlevelFromLevelDescriptor(normalizedDescriptor);
    if (parsedLevel !== null) {
      if (dungeonLabel) {
        return `${dungeonLabel} ${parsedLevel}`;
      }
      return String(parsedLevel);
    }

    return normalizedDescriptor;
  }

  refreshOverviewStyleLocationLabel(): void {
    const labelFromDescriptor = this.formatOverviewStyleLocationFromDescriptor(
      this.latestLevelDescriptorName,
    );
    if (labelFromDescriptor) {
      this.dependencies.playerStatus.playerStats.locationLabel = labelFromDescriptor;
      return;
    }

    const identity = this.latestRuntimeLevelIdentity;
    if (
      identity &&
      typeof identity.depth === "number" &&
      Number.isFinite(identity.depth)
    ) {
      const dungeonLabel = this.normalizeDungeonDisplayName(
        identity.dungeonName,
      );
      const levelLabel = String(Math.trunc(identity.depth));
      this.dependencies.playerStatus.playerStats.locationLabel = dungeonLabel
        ? `${dungeonLabel} ${levelLabel}`
        : levelLabel;
      return;
    }

    this.dependencies.playerStatus.playerStats.locationLabel = "";
  }

  buildFallbackLevelCacheName(): string | null {
    const runtimeLevelIdentifier =
      this.buildLevelCacheIdentifierFromRuntimeLevelIdentity();
    if (runtimeLevelIdentifier) {
      return runtimeLevelIdentifier;
    }

    const dungeonName = this.normalizeLevelCacheName(this.dependencies.playerStatus.playerStats.dungeon);
    const numericDlevel = Number.isFinite(this.dependencies.playerStatus.playerStats.dlevel)
      ? Math.trunc(this.dependencies.playerStatus.playerStats.dlevel)
      : NaN;
    const dlevelPart = Number.isFinite(numericDlevel)
      ? `Dlvl ${numericDlevel}`
      : null;
    if (!dungeonName && !dlevelPart) {
      return null;
    }
    if (dungeonName && dlevelPart) {
      return `${dungeonName} - ${dlevelPart}`;
    }
    return dungeonName ?? dlevelPart;
  }

  resolvePreferredLevelCacheName(options?: {
    allowFallback?: boolean;
  }): string | null {
    const runtimeLevelIdentifier =
      this.buildLevelCacheIdentifierFromRuntimeLevelIdentity();
    if (runtimeLevelIdentifier) {
      return runtimeLevelIdentifier;
    }
    if (this.latestLevelDescriptorName) {
      return this.latestLevelDescriptorName;
    }
    if (options?.allowFallback === false) {
      return null;
    }
    return this.buildFallbackLevelCacheName();
  }

  createLevelCacheEntryId(levelName: string): string {
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${levelName.length}`;
  }

  cloneTerrainSnapshotMap(
    source: Map<string, TerrainSnapshot>,
  ): Map<string, TerrainSnapshot> {
    const clone = new Map<string, TerrainSnapshot>();
    for (const [key, value] of source.entries()) {
      clone.set(key, { ...value });
    }
    return clone;
  }

  cloneCoordinateMap(
    source: Map<string, { x: number; y: number }>,
  ): Map<string, { x: number; y: number }> {
    const clone = new Map<string, { x: number; y: number }>();
    for (const [key, value] of source.entries()) {
      clone.set(key, { x: value.x, y: value.y });
    }
    return clone;
  }

  cloneStringSet(source: Set<string>): Set<string> {
    return new Set(source);
  }

  captureCurrentLevelTerrainCacheSnapshot(): LevelTerrainCacheSnapshot {
    const inferredDarkFlags = this.cloneStringSet(
      this.dependencies.darkCorridorInference.inferredDarkCorridorTileFlags,
    );
    for (const key of this.dependencies.darkCorridorInference.inferredDarkCorridorWallTiles.keys()) {
      inferredDarkFlags.add(key);
    }

    return {
      tileStateCache: new Map(this.dependencies.tileUpdates.tileStateCache),
      lastKnownTerrain: this.cloneTerrainSnapshotMap(this.lastKnownTerrain),
      flatFeatureUnderPlayerCache: this.cloneTerrainSnapshotMap(
        this.dependencies.worldClassification.flatFeatureUnderPlayerCache,
      ),
      suppressedLootLikeUnderPlayerCacheKeys: this.cloneStringSet(
        this.dependencies.worldClassification.suppressedLootLikeUnderPlayerCacheKeys,
      ),
      inferredDarkCorridorWallTiles: this.cloneCoordinateMap(
        this.dependencies.darkCorridorInference.inferredDarkCorridorWallTiles,
      ),
      inferredDarkCorridorTileFlags: inferredDarkFlags,
      bloodGround: this.dependencies.bloodGround.captureActiveBloodGroundCacheSnapshot(),
    };
  }

  upsertLevelTerrainCacheEntry(
    levelName: string,
    entryId: string,
    snapshot: LevelTerrainCacheSnapshot,
  ): void {
    const existingEntries = this.levelTerrainCachesByName.get(levelName) ?? [];
    const nowMs = Date.now();
    const nextEntry: LevelTerrainCacheEntry = {
      id: entryId,
      levelName,
      updatedAtMs: nowMs,
      tileStateCache: new Map(snapshot.tileStateCache),
      lastKnownTerrain: this.cloneTerrainSnapshotMap(snapshot.lastKnownTerrain),
      flatFeatureUnderPlayerCache: this.cloneTerrainSnapshotMap(
        snapshot.flatFeatureUnderPlayerCache,
      ),
      suppressedLootLikeUnderPlayerCacheKeys: this.cloneStringSet(
        snapshot.suppressedLootLikeUnderPlayerCacheKeys,
      ),
      inferredDarkCorridorWallTiles: this.cloneCoordinateMap(
        snapshot.inferredDarkCorridorWallTiles,
      ),
      inferredDarkCorridorTileFlags: this.cloneStringSet(
        snapshot.inferredDarkCorridorTileFlags,
      ),
      bloodGround: this.dependencies.bloodGround.cloneBloodGroundCacheSnapshot(snapshot.bloodGround),
    };

    const existingIndex = existingEntries.findIndex(
      (entry) => entry.id === entryId,
    );
    if (existingIndex >= 0) {
      existingEntries[existingIndex] = nextEntry;
    } else {
      existingEntries.push(nextEntry);
    }
    this.levelTerrainCachesByName.set(levelName, existingEntries);
  }

  retagActiveLevelCacheEntryLevelName(nextLevelName: string): void {
    const active = this.activeLevelCacheRef;
    if (!active || active.levelName === nextLevelName) {
      return;
    }

    const sourceEntries =
      this.levelTerrainCachesByName.get(active.levelName) ?? [];
    const sourceIndex = sourceEntries.findIndex(
      (entry) => entry.id === active.entryId,
    );
    if (sourceIndex >= 0) {
      const sourceEntry = sourceEntries[sourceIndex];
      const movedEntry: LevelTerrainCacheEntry = {
        ...sourceEntry,
        levelName: nextLevelName,
      };
      sourceEntries.splice(sourceIndex, 1);
      if (sourceEntries.length > 0) {
        this.levelTerrainCachesByName.set(active.levelName, sourceEntries);
      } else {
        this.levelTerrainCachesByName.delete(active.levelName);
      }

      const targetEntries =
        this.levelTerrainCachesByName.get(nextLevelName) ?? [];
      const targetIndex = targetEntries.findIndex(
        (entry) => entry.id === movedEntry.id,
      );
      if (targetIndex >= 0) {
        targetEntries[targetIndex] = movedEntry;
      } else {
        targetEntries.push(movedEntry);
      }
      this.levelTerrainCachesByName.set(nextLevelName, targetEntries);
    }

    this.activeLevelCacheRef = {
      levelName: nextLevelName,
      entryId: active.entryId,
    };
  }

  persistActiveLevelTerrainCache(): void {
    let forceDrainPass = 0;
    while (
      forceDrainPass < 8 &&
      (this.dependencies.tileUpdates.pendingTileUpdates.size > 0 ||
        this.dependencies.tileUpdates.pendingTileFlushQueueIndex < this.dependencies.tileUpdates.pendingTileFlushQueue.length)
    ) {
      this.dependencies.tileUpdates.flushPendingTileUpdates(true);
      forceDrainPass += 1;
    }
    if (this.dependencies.vultureWalls.pendingVultureWallMaterialRefreshKeys.size > 0) {
      this.dependencies.vultureWalls.flushPendingVultureWallMaterialRefreshes(true);
    }

    const activeLevelName =
      this.activeLevelCacheRef?.levelName ??
      this.currentLevelCacheName ??
      this.resolvePreferredLevelCacheName();
    if (!activeLevelName) {
      return;
    }

    const snapshot = this.captureCurrentLevelTerrainCacheSnapshot();
    if (
      snapshot.tileStateCache.size === 0 &&
      snapshot.lastKnownTerrain.size === 0 &&
      snapshot.flatFeatureUnderPlayerCache.size === 0 &&
      snapshot.suppressedLootLikeUnderPlayerCacheKeys.size === 0 &&
      snapshot.inferredDarkCorridorWallTiles.size === 0 &&
      snapshot.inferredDarkCorridorTileFlags.size === 0 &&
      !snapshot.bloodGround
    ) {
      return;
    }

    const entryId =
      this.activeLevelCacheRef?.entryId ??
      this.createLevelCacheEntryId(activeLevelName);
    this.upsertLevelTerrainCacheEntry(activeLevelName, entryId, snapshot);
    this.activeLevelCacheRef = { levelName: activeLevelName, entryId };
    this.currentLevelCacheName = activeLevelName;
  }

  resetLevelTerrainCacheTracking(): void {
    this.levelTerrainCachesByName.clear();
    this.activeLevelCacheRef = null;
    this.currentLevelCacheName = null;
    this.latestLevelDescriptorName = null;
    this.latestRuntimeLevelIdentity = null;
    this.hasResolvedInitialDeterministicLevelThisSession = false;
    this.pendingLevelCacheTransition = null;
    this.dependencies.bloodGround.disposeBloodGroundOverlayResources();
  }

  beginPendingLevelCacheTransition(): void {
    const preTransitionFallbackLevelName = this.buildFallbackLevelCacheName();
    this.activeLevelCacheRef = null;
    this.currentLevelCacheName = null;
    this.latestLevelDescriptorName = null;
    this.latestRuntimeLevelIdentity = null;
    this.pendingLevelCacheTransition = {
      startedAtMs: Date.now(),
      observedTiles: new Map(),
      firstPassComplete: false,
      sawLevelIdentityStatusUpdate: false,
      initialPlayerPosition: null,
      preTransitionFallbackLevelName,
    };
  }

  capturePendingLevelTransitionTile(tile: any): void {
    const pending = this.pendingLevelCacheTransition;
    if (!pending || pending.firstPassComplete) {
      return;
    }
    if (
      !tile ||
      typeof tile.x !== "number" ||
      typeof tile.y !== "number" ||
      typeof tile.glyph !== "number"
    ) {
      return;
    }

    const key = `${tile.x},${tile.y}`;
    pending.observedTiles.set(key, {
      x: tile.x,
      y: tile.y,
      glyph: tile.glyph,
      char: typeof tile.char === "string" ? tile.char : undefined,
      color: typeof tile.color === "number" ? tile.color : undefined,
      tileIndex:
        typeof tile.tileIndex === "number"
          ? Math.trunc(tile.tileIndex)
          : undefined,
      symidx:
        typeof tile.symidx === "number" ? Math.trunc(tile.symidx) : undefined,
    });
  }

  capturePendingLevelTransitionTiles(tiles: any[]): void {
    for (const tile of tiles) {
      this.capturePendingLevelTransitionTile(tile);
    }
  }

  parseTileStateSignature(signature: string): ParsedTileState | null {
    const key = String(signature || "");
    let parsed = this.parsedTileSignatures.get(key);
    if (parsed === undefined) {
      parsed = this.decodeTileStateSignature(key);
      // This caches only pure string decoding, never runtime glyph behavior.
      // Copies keep callers and saved level snapshots independently mutable.
      if (this.parsedTileSignatures.size >= 2048) this.parsedTileSignatures.clear();
      this.parsedTileSignatures.set(key, parsed);
    }
    return parsed ? { ...parsed } : null;
  }

  private decodeTileStateSignature(signature: string): ParsedTileState | null {
    const parts = String(signature || "").split("|");
    if (parts.length < 3) {
      return null;
    }

    const [glyphToken, charToken, colorToken, ...encodedTokens] = parts;
    if (!glyphToken) {
      return null;
    }

    const glyph = Number.parseInt(glyphToken, 10);
    if (!Number.isFinite(glyph)) {
      return null;
    }

    const readEncodedInteger = (tokenKey: string): number | undefined => {
      const token = encodedTokens.find((value) =>
        value.startsWith(`${tokenKey}:`),
      );
      if (!token) {
        return undefined;
      }
      const rawValue = token.slice(tokenKey.length + 1).trim();
      if (!rawValue) {
        return undefined;
      }
      const parsed = Number.parseInt(rawValue, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const decodeSignatureToken = (rawValue: string | undefined): string => {
      const normalizedValue = typeof rawValue === "string" ? rawValue : "";
      if (!normalizedValue) {
        return "";
      }
      try {
        return decodeURIComponent(normalizedValue);
      } catch {
        return normalizedValue;
      }
    };
    const decodedChar = decodeSignatureToken(charToken);
    const normalizedChar = decodedChar.length > 0 ? decodedChar : undefined;
    const parsedColor = Number.parseInt(String(colorToken ?? "").trim(), 10);
    const tileIndex = readEncodedInteger("ti");
    const symidx = readEncodedInteger("si");
    const glyphFlags = readEncodedInteger("gf");
    return {
      glyph,
      char: normalizedChar,
      color: Number.isFinite(parsedColor) ? parsedColor : undefined,
      tileIndex,
      symidx,
      glyphFlags,
    };
  }

  parseTileKey(key: string): { x: number; y: number } | null {
    const normalizedKey = String(key || "");
    const separatorIndex = normalizedKey.indexOf(",");
    if (separatorIndex <= 0 || separatorIndex >= normalizedKey.length - 1) {
      return null;
    }
    const x = Number.parseInt(normalizedKey.slice(0, separatorIndex), 10);
    const y = Number.parseInt(normalizedKey.slice(separatorIndex + 1), 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  getTileSnapshotFromStateCache(key: string): TerrainSnapshot | null {
    const signature = this.dependencies.tileUpdates.tileStateCache.get(key);
    if (!signature) {
      return null;
    }
    const parsed = this.parseTileStateSignature(signature);
    if (!parsed) {
      return null;
    }
    return {
      glyph: parsed.glyph,
      char: parsed.char,
      color: parsed.color,
      tileIndex: parsed.tileIndex,
      symidx: parsed.symidx,
    };
  }

  isWallTerrainSnapshot(snapshot: TerrainSnapshot): boolean {
    const behavior = classifyTileBehavior({
      glyph: snapshot.glyph,
      runtimeChar: snapshot.char ?? null,
      runtimeColor: typeof snapshot.color === "number" ? snapshot.color : null,
      runtimeTileIndex:
        typeof snapshot.tileIndex === "number" ? snapshot.tileIndex : null,
      runtimeSymidx:
        typeof snapshot.symidx === "number" ? snapshot.symidx : null,
      priorTerrain: snapshot,
    });
    return behavior.isWall;
  }

  countObservedWallTilesForPendingTransition(
    observedTiles: Map<string, LevelCacheObservedTile>,
  ): number {
    let wallCount = 0;
    for (const observed of observedTiles.values()) {
      if (this.isWallTerrainSnapshot(observed)) {
        wallCount += 1;
      }
    }
    return wallCount;
  }

  selectMatchingLevelTerrainCacheEntryByWalls(
    candidates: LevelTerrainCacheEntry[],
    observedTiles: Map<string, LevelCacheObservedTile>,
  ): LevelTerrainCacheEntry | null {
    type WallMatchScore = {
      entry: LevelTerrainCacheEntry;
      comparisons: number;
      matches: number;
      mismatches: number;
      matchRatio: number;
    };

    const scores: WallMatchScore[] = [];
    for (const entry of candidates) {
      let comparisons = 0;
      let matches = 0;
      let mismatches = 0;
      for (const [key, observed] of observedTiles.entries()) {
        const observedIsWall = this.isWallTerrainSnapshot(observed);
        const candidateSignature = entry.tileStateCache.get(key);
        if (!candidateSignature) {
          if (observedIsWall) {
            comparisons += 1;
            mismatches += 1;
          }
          continue;
        }

        const parsedCandidate =
          this.parseTileStateSignature(candidateSignature);
        if (!parsedCandidate) {
          continue;
        }
        const candidateIsWall = this.isWallTerrainSnapshot(parsedCandidate);
        if (!observedIsWall && !candidateIsWall) {
          continue;
        }
        comparisons += 1;
        if (observedIsWall === candidateIsWall) {
          matches += 1;
        } else {
          mismatches += 1;
        }
      }

      const matchRatio = comparisons > 0 ? matches / comparisons : 0;
      scores.push({
        entry,
        comparisons,
        matches,
        mismatches,
        matchRatio,
      });
    }

    if (scores.length === 0) {
      return null;
    }

    scores.sort((a, b) => {
      if (b.matchRatio !== a.matchRatio) {
        return b.matchRatio - a.matchRatio;
      }
      if (a.mismatches !== b.mismatches) {
        return a.mismatches - b.mismatches;
      }
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return b.comparisons - a.comparisons;
    });

    const best = scores[0];
    if (!best) {
      return null;
    }

    const minComparisons = Math.min(
      this.levelCacheWallComparisonMin,
      Math.max(4, observedTiles.size),
    );
    if (best.comparisons < minComparisons) {
      return null;
    }
    const allowedMismatchCount = Math.max(
      this.levelCacheWallMismatchToleranceMin,
      Math.floor(best.comparisons * this.levelCacheWallMismatchToleranceRatio),
    );
    if (best.mismatches > allowedMismatchCount) {
      return null;
    }
    if (best.matches <= best.mismatches) {
      return null;
    }

    const second = scores[1];
    if (
      second &&
      second.comparisons >= minComparisons &&
      Math.abs(best.matchRatio - second.matchRatio) <= 0.03 &&
      Math.abs(best.mismatches - second.mismatches) <= 1
    ) {
      return null;
    }

    return best.entry;
  }

  restoreLevelTerrainCacheEntry(
    levelName: string,
    entry: LevelTerrainCacheEntry,
    observedTiles: Map<string, LevelCacheObservedTile>,
  ): void {
    this.dependencies.tileUpdates.tileStateCache = new Map(entry.tileStateCache);
    this.lastKnownTerrain = this.cloneTerrainSnapshotMap(
      entry.lastKnownTerrain,
    );
    this.dependencies.worldClassification.flatFeatureUnderPlayerCache = this.cloneTerrainSnapshotMap(
      entry.flatFeatureUnderPlayerCache,
    );
    this.dependencies.worldClassification.suppressedLootLikeUnderPlayerCacheKeys = this.cloneStringSet(
      entry.suppressedLootLikeUnderPlayerCacheKeys,
    );
    this.dependencies.darkCorridorInference.inferredDarkCorridorWallTiles = this.cloneCoordinateMap(
      entry.inferredDarkCorridorWallTiles,
    );
    this.dependencies.darkCorridorInference.inferredDarkCorridorTileFlags = this.cloneStringSet(
      entry.inferredDarkCorridorTileFlags,
    );
    for (const key of this.dependencies.darkCorridorInference.inferredDarkCorridorTileFlags.values()) {
      if (this.dependencies.darkCorridorInference.inferredDarkCorridorWallTiles.has(key)) {
        continue;
      }
      const parsed = this.parseTileKey(key);
      if (!parsed) {
        continue;
      }
      this.dependencies.darkCorridorInference.inferredDarkCorridorWallTiles.set(key, parsed);
    }
    this.dependencies.tileUpdates.refreshTilesFromStateCache();

    for (const observed of observedTiles.values()) {
      const key = `${observed.x},${observed.y}`;
      this.dependencies.tileUpdates.tileStateCache.set(
        key,
        this.dependencies.tileUpdates.buildTileStateSignatureFromPayload(observed),
      );
      this.dependencies.tileRendering.updateTile(
        observed.x,
        observed.y,
        observed.glyph,
        observed.char,
        observed.color,
        {
          runtimeTileIndex:
            typeof observed.tileIndex === "number"
              ? observed.tileIndex
              : undefined,
        },
      );
    }

    this.dependencies.bloodGround.restoreBloodGroundCacheSnapshot(entry.bloodGround);
    this.activeLevelCacheRef = { levelName, entryId: entry.id };
    this.currentLevelCacheName = levelName;
  }

  activateNewLevelTerrainCacheEntry(levelName: string): void {
    const entryId = this.createLevelCacheEntryId(levelName);
    this.dependencies.bloodGround.clearActiveBloodGroundCanvas();
    const snapshot = this.captureCurrentLevelTerrainCacheSnapshot();
    snapshot.bloodGround = null;
    this.upsertLevelTerrainCacheEntry(levelName, entryId, snapshot);
    this.activeLevelCacheRef = { levelName, entryId };
    this.currentLevelCacheName = levelName;
  }

  completePendingLevelCacheTransition(levelName: string): void {
    this.handleDeterministicLevelCacheResolution(levelName);
    this.pendingLevelCacheTransition = null;
  }

  resolveLevelNameForPendingTransition(
    forceFallback: boolean,
  ): string | null {
    const pending = this.pendingLevelCacheTransition;
    if (!pending) {
      return null;
    }
    const runtimeLevelIdentifier =
      this.buildLevelCacheIdentifierFromRuntimeLevelIdentity();
    if (runtimeLevelIdentifier) {
      return runtimeLevelIdentifier;
    }
    if (this.latestLevelDescriptorName) {
      return this.latestLevelDescriptorName;
    }

    const allowFallback = forceFallback || pending.sawLevelIdentityStatusUpdate;
    if (!allowFallback) {
      return null;
    }

    const fallbackLevelName = this.buildFallbackLevelCacheName();
    if (!fallbackLevelName) {
      return forceFallback ? `Unresolved Level ${pending.startedAtMs}` : null;
    }

    if (
      !pending.sawLevelIdentityStatusUpdate &&
      fallbackLevelName === pending.preTransitionFallbackLevelName
    ) {
      return forceFallback ? `Unresolved Level ${pending.startedAtMs}` : null;
    }

    return fallbackLevelName;
  }

  maybeFinalizePendingLevelCacheTransition(
    trigger: "tile" | "status" | "player_position" | "player_move",
    forceFallback: boolean = false,
  ): void {
    const pending = this.pendingLevelCacheTransition;
    if (!pending) {
      return;
    }

    const levelName = this.resolveLevelNameForPendingTransition(forceFallback);
    if (!levelName) {
      return;
    }

    const candidates = this.levelTerrainCachesByName.get(levelName) ?? [];
    if (candidates.length === 0) {
      this.activateNewLevelTerrainCacheEntry(levelName);
      this.completePendingLevelCacheTransition(levelName);
      return;
    }

    if (candidates.length === 1) {
      const shouldDisambiguateSingleCandidate =
        this.shouldDisambiguateSingleLevelCacheCandidate(levelName);
      if (!shouldDisambiguateSingleCandidate) {
        this.restoreLevelTerrainCacheEntry(
          levelName,
          candidates[0],
          pending.observedTiles,
        );
        this.completePendingLevelCacheTransition(levelName);
        return;
      }

      const observedWallCount = this.countObservedWallTilesForPendingTransition(
        pending.observedTiles,
      );
      const shouldAttemptWallDisambiguation =
        observedWallCount >= this.levelCacheDisambiguationWallSampleMin ||
        pending.firstPassComplete ||
        trigger === "player_move";
      if (!shouldAttemptWallDisambiguation) {
        return;
      }

      const matchedEntry = this.selectMatchingLevelTerrainCacheEntryByWalls(
        candidates,
        pending.observedTiles,
      );
      if (matchedEntry) {
        this.restoreLevelTerrainCacheEntry(
          levelName,
          matchedEntry,
          pending.observedTiles,
        );
      } else {
        this.activateNewLevelTerrainCacheEntry(levelName);
      }
      this.completePendingLevelCacheTransition(levelName);
      return;
    }

    const observedWallCount = this.countObservedWallTilesForPendingTransition(
      pending.observedTiles,
    );
    const shouldAttemptWallDisambiguation =
      observedWallCount >= this.levelCacheDisambiguationWallSampleMin ||
      pending.firstPassComplete ||
      trigger === "player_move";
    if (!shouldAttemptWallDisambiguation) {
      return;
    }

    const matchedEntry = this.selectMatchingLevelTerrainCacheEntryByWalls(
      candidates,
      pending.observedTiles,
    );
    if (matchedEntry) {
      this.restoreLevelTerrainCacheEntry(
        levelName,
        matchedEntry,
        pending.observedTiles,
      );
    } else {
      this.activateNewLevelTerrainCacheEntry(levelName);
    }
    this.completePendingLevelCacheTransition(levelName);
  }

  handlePendingLevelTransitionPlayerPosition(
    x: number,
    y: number,
  ): void {
    const pending = this.pendingLevelCacheTransition;
    if (!pending) {
      return;
    }

    if (!pending.firstPassComplete) {
      pending.firstPassComplete = true;
    }
    if (!pending.initialPlayerPosition) {
      pending.initialPlayerPosition = { x, y };
      this.maybeFinalizePendingLevelCacheTransition("player_position");
      return;
    }

    const movedWithinLevel =
      pending.initialPlayerPosition.x !== x ||
      pending.initialPlayerPosition.y !== y;
    if (movedWithinLevel) {
      this.maybeFinalizePendingLevelCacheTransition("player_move", true);
      return;
    }
    this.maybeFinalizePendingLevelCacheTransition("player_position");
  }

  noteLevelIdentityStatusUpdate(rawFieldName: string | null): void {
    const pending = this.pendingLevelCacheTransition;
    if (!pending || !rawFieldName) {
      return;
    }
    if (
      rawFieldName === "BL_LEVELDESC" ||
      rawFieldName === "BL_DNUM" ||
      rawFieldName === "BL_DLEVEL"
    ) {
      pending.sawLevelIdentityStatusUpdate = true;
    }
  }
}
