import type { PlayerStatsSnapshot } from "../../ui-types";
import { extractRuntimeNumberPadModeEnabled as extractNumberPadModeFromRuntimeSnapshot } from "../../../runtime/number-pad-mode";
import type { CorePlayerStatField } from "../shared/types";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { CombatAttribution } from "../world/combat-attribution";
import type { DamageNumbers } from "../effects/damage-numbers";
import type { DarkCorridorInference } from "../world/dark-corridor-inference";
import type { EngineState } from "../runtime/engine-state";
import type { ExtendedCommands } from "./extended-commands";
import type { InputCommands } from "../input/input-commands";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { PlayerMovement } from "../world/player-movement";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";

export interface PlayerStatusDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "messageSoundHooks"
    | "queueIncomingDamageRumble"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    "triggerDamageEffectsAtTile"
  >;
  readonly damageNumbers: Pick<
    DamageNumbers,
    "spawnPlayerHealNumberParticle"
  >;
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "requestInferredDarkCorridorWallReconcile"
  >;
  readonly engineState: Pick<
    EngineState,
    "characterCreationConfig"
    | "clientOptions"
    | "uiAdapter"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "extractNumberPadModeEnabledFromOptionTokens"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "setNumberPadModeEnabled"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "applyRuntimeLevelIdentity"
    | "currentLevelCacheName"
    | "extractDlevelFromLevelDescriptor"
    | "latestLevelDescriptorName"
    | "latestRuntimeLevelIdentity"
    | "maybeFinalizePendingLevelCacheTransition"
    | "normalizeBranchDisplayName"
    | "normalizeDungeonDisplayName"
    | "normalizeLevelCacheName"
    | "noteLevelIdentityStatusUpdate"
    | "pendingLevelCacheTransition"
    | "refreshOverviewStyleLocationLabel"
    | "resolvePreferredLevelCacheName"
    | "retagActiveLevelCacheEntryLevelName"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
    | "refreshTerminalRenderOptionStates"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "vultureTilesetTranslator"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "pendingPlayerTileRefreshOnNextPosition"
    | "refreshTilesFromStateCache"
    | "requestPlayerTileRefresh"
  >;
}

/** Status field decoding, HUD updates, status baselines and runtime snapshot decoding. */
export class PlayerStatus {
  constructor(private readonly dependencies: PlayerStatusDependencies) {}

  autoPickupEnabled: boolean = true;

  statusConditionMask: number = 0;

  statusDebugHistory: any[] = [];

  latestRuntimeGlobalsSnapshot: unknown = null;

  runtimeObjectTileIndexByObjectId: number[] | null = null;


  // Player stats tracking
  private readonly initialPlayerStats = {
    name: "Adventurer",
    hp: 10,
    maxHp: 10,
    power: 0,
    maxPower: 0,
    level: 1,
    experience: 0,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    armor: 10,
    dungeon: "Dungeons of Doom",
    dlevel: 1,
    locationLabel: "",
    gold: 0,
    alignment: "Neutral",
    hunger: "Not Hungry",
    encumbrance: "",
    conditionMask: 0,
    time: 1,
    score: 0,
  };

  playerStats = { ...this.initialPlayerStats };

  resetForNewGame(): void {
    this.playerStats = { ...this.initialPlayerStats };
    this.statusConditionMask = 0;
    this.statusDebugHistory = [];
    this.autoPickupEnabled = true;
    this.applyRuntimeGlobalsSnapshot(null);
    this.resetPlayerStatusDeltaTracking();
    this.updateStatsDisplay();
  }

  lastKnownPlayerHp: number | null = null;

  lastKnownPlayerExperience: number | null = null;

  lastKnownPlayerLevel: number | null = null;

  lastKnownPlayerCoreStats: Partial<
    Record<CorePlayerStatField, number>
  > = {};

  readonly playerCoreStatDisplayNameByField: Record<
    CorePlayerStatField,
    string
  > = {
    strength: "Strength",
    dexterity: "Dexterity",
    constitution: "Constitution",
    intelligence: "Intelligence",
    wisdom: "Wisdom",
    charisma: "Charisma",
    armor: "Armor Class",
  };

  applyRuntimeGlobalsSnapshot(snapshot: unknown): void {
    this.latestRuntimeGlobalsSnapshot = snapshot ?? null;
    this.applyRuntimeObjectTileIndexByObjectId(
      this.extractRuntimeObjectTileIndexByObjectId(snapshot),
    );
    const runtimeNumberPadModeEnabled =
      this.extractRuntimeNumberPadModeEnabled(snapshot);
    if (typeof runtimeNumberPadModeEnabled === "boolean") {
      this.dependencies.inputCommands.setNumberPadModeEnabled(runtimeNumberPadModeEnabled, {
        announce: false,
      });
    }
    const terminalOptionStatesChanged = this.dependencies.terminalRendering.refreshTerminalRenderOptionStates();
    if (
      terminalOptionStatesChanged &&
      (this.dependencies.terminalRendering.isTerminalDisplayMode() ||
        (this.dependencies.engineState.clientOptions.tilesetMode === "ascii" &&
          this.dependencies.engineState.clientOptions.asciiColorMode !== "nethack-3d"))
    ) {
      // hilite_pet / hilite_pile / use_inverse / symset resolved differently
      // than assumed; re-render any view using the terminal presentation rules.
      this.dependencies.tileUpdates.refreshTilesFromStateCache();
    }
    if (typeof window !== "undefined") {
      (window as any).nethackRuntimeGlobals = this.latestRuntimeGlobalsSnapshot;
    }
  }

  extractRuntimeNumberPadModeEnabled(
    snapshot: unknown,
  ): boolean | null {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    const restoredRuntimeMode =
      extractNumberPadModeFromRuntimeSnapshot(snapshot);
    if (restoredRuntimeMode !== null) {
      return restoredRuntimeMode;
    }

    const configuredNethackOptions = (
      snapshot as { configuredNethackOptions?: unknown }
    ).configuredNethackOptions;
    if (typeof configuredNethackOptions === "string") {
      return this.dependencies.extendedCommands.extractNumberPadModeEnabledFromOptionTokens(
        configuredNethackOptions.split(","),
      );
    }

    return null;
  }

  applyRuntimeObjectTileIndexByObjectId(rawValue: unknown): void {
    const normalized = this.extractRuntimeObjectTileIndexByObjectId({
      objectTileIndexByObjectId: rawValue,
    });
    if (!normalized) {
      return;
    }
    this.runtimeObjectTileIndexByObjectId = normalized;
    this.dependencies.tilesetAssets.vultureTilesetTranslator?.setRuntimeObjectTileIndexByObjectId(
      this.runtimeObjectTileIndexByObjectId,
    );
  }

  extractRuntimeObjectTileIndexByObjectId(
    snapshot: unknown,
  ): number[] | null {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }
    const rawValue = (snapshot as { objectTileIndexByObjectId?: unknown })
      .objectTileIndexByObjectId;
    if (!Array.isArray(rawValue) || rawValue.length <= 0) {
      return null;
    }
    const normalized = rawValue.map((entry) =>
      typeof entry === "number" && Number.isFinite(entry) && entry >= 0
        ? Math.trunc(entry)
        : -1,
    );
    return normalized.length > 0 ? normalized : null;
  }

  captureAutopickupStateFromMessage(messageLike: unknown): void {
    if (typeof messageLike !== "string") {
      return;
    }
    const normalized = messageLike.trim().toLowerCase();
    if (!normalized.includes("autopickup")) {
      return;
    }
    if (/\b(off|disabled|deactivated)\b/.test(normalized)) {
      this.autoPickupEnabled = false;
      return;
    }
    if (/\b(on|enabled|activated)\b/.test(normalized)) {
      this.autoPickupEnabled = true;
    }
  }

  resetPlayerStatusDeltaTracking(): void {
    this.lastKnownPlayerHp = null;
    this.lastKnownPlayerExperience = null;
    this.lastKnownPlayerLevel = null;
    this.lastKnownPlayerCoreStats = {};
  }

  parseGoldStatusValue(rawValue: string): number | null {
    const clean = rawValue.trim();
    if (!clean) {
      return null;
    }

    // NetHack may encode gold as "\G....E:<amount>" for status rendering.
    // In this format, the leading digits are metadata and the value after
    // the trailing colon is the actual gold amount.
    if (clean.startsWith("\\G")) {
      const encodedAmountMatch = clean.match(/:(-?\d+)\s*$/);
      if (encodedAmountMatch) {
        return parseInt(encodedAmountMatch[1], 10);
      }
    }

    const numericMatch = clean.match(/-?\d+/);
    if (!numericMatch) {
      return null;
    }

    return parseInt(numericMatch[0], 10);
  }

  parseStatusConditionMaskValue(
    rawValue: string | number | null,
  ): number | null {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return Math.trunc(rawValue) >>> 0;
    }

    const clean = String(rawValue ?? "").trim();
    if (!clean) {
      return null;
    }

    if (/^0x[0-9a-f]+$/i.test(clean)) {
      const parsedHex = Number.parseInt(clean, 16);
      return Number.isFinite(parsedHex) ? parsedHex >>> 0 : null;
    }

    const decimalMatch = clean.match(/-?\d+/);
    if (!decimalMatch) {
      return null;
    }
    const parsedDecimal = Number.parseInt(decimalMatch[0], 10);
    return Number.isFinite(parsedDecimal) ? parsedDecimal >>> 0 : null;
  }

  isCorePlayerStatField(field: string): field is CorePlayerStatField {
    return (
      field === "strength" ||
      field === "dexterity" ||
      field === "constitution" ||
      field === "intelligence" ||
      field === "wisdom" ||
      field === "charisma" ||
      field === "armor"
    );
  }

  refreshLevelCacheNameFromStatusFields(
    rawFieldName: string | null,
    mappedField: string | null,
    rawValue: unknown,
  ): void {
    if (rawFieldName === "BL_LEVELDESC") {
      const normalizedLevelDescriptor = this.dependencies.levelTerrainCache.normalizeLevelCacheName(rawValue);
      if (normalizedLevelDescriptor) {
        this.dependencies.levelTerrainCache.latestLevelDescriptorName = normalizedLevelDescriptor;
      }
    }

    this.dependencies.levelTerrainCache.noteLevelIdentityStatusUpdate(rawFieldName);
    const pending = this.dependencies.levelTerrainCache.pendingLevelCacheTransition;
    if (
      pending &&
      (mappedField === "dungeon" ||
        mappedField === "dlevel" ||
        mappedField === "levelDescriptor")
    ) {
      pending.sawLevelIdentityStatusUpdate = true;
    }
    const allowFallback = !pending || pending.sawLevelIdentityStatusUpdate;
    const resolvedLevelName = this.dependencies.levelTerrainCache.resolvePreferredLevelCacheName({
      allowFallback,
    });
    if (resolvedLevelName) {
      this.dependencies.levelTerrainCache.retagActiveLevelCacheEntryLevelName(resolvedLevelName);
      this.dependencies.levelTerrainCache.currentLevelCacheName = resolvedLevelName;
    }
    this.dependencies.levelTerrainCache.maybeFinalizePendingLevelCacheTransition("status");
  }

  updatePlayerStats(
    field: number,
    value: string | number | null,
    data: any,
  ): void {
    const runtimeVersion =
      this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7";
    const legacyByIndex5: { [key: number]: string } = {
      0: "name",
      1: "strength",
      2: "dexterity",
      3: "constitution",
      4: "intelligence",
      5: "wisdom",
      6: "charisma",
      7: "alignment",
      8: "score",
      9: "hp",
      10: "maxhp",
      11: "power",
      12: "maxpower",
      13: "armor",
      14: "level",
      15: "experience",
      16: "time",
      17: "hunger",
      18: "encumbrance",
      19: "dungeon",
      20: "dlevel",
      21: "gold",
    };
    const legacyByIndex367: { [key: number]: string } = {
      0: "name",
      1: "strength",
      2: "dexterity",
      3: "constitution",
      4: "intelligence",
      5: "wisdom",
      6: "charisma",
      7: "alignment",
      8: "score",
      9: "encumbrance",
      10: "gold",
      11: "power",
      12: "maxpower",
      13: "level",
      14: "armor",
      16: "time",
      17: "hunger",
      18: "hp",
      19: "maxhp",
      20: "levelDescriptor",
      21: "experience",
    };
    const legacyByIndex =
      runtimeVersion === "5.0" ? legacyByIndex5 : legacyByIndex367;

    const byName: { [key: string]: string } = {
      BL_TITLE: "name",
      BL_STR: "strength",
      BL_DX: "dexterity",
      BL_CO: "constitution",
      BL_IN: "intelligence",
      BL_WI: "wisdom",
      BL_CH: "charisma",
      BL_ALIGN: "alignment",
      BL_SCORE: "score",
      BL_HP: "hp",
      BL_HPMAX: "maxhp",
      BL_ENE: "power",
      BL_ENEMAX: "maxpower",
      BL_AC: "armor",
      BL_XP: "level",
      BL_EXP: "experience",
      BL_TIME: "time",
      BL_HUNGER: "hunger",
      BL_CAP: "encumbrance",
      BL_LEVELDESC: "levelDescriptor",
      BL_DNUM: "dungeon",
      BL_DLEVEL: "dlevel",
      BL_GOLD: "gold",
    };

    const rawFieldName =
      typeof data?.fieldName === "string" ? data.fieldName : null;
    const isConditionMaskField =
      rawFieldName === "BL_CONDITION" || (!rawFieldName && field === 22);
    const mappedField =
      (rawFieldName && byName[rawFieldName]) || legacyByIndex[field] || null;

    // Keep a rolling debug history for runtime inspection from devtools.
    this.statusDebugHistory.unshift({
      ts: Date.now(),
      field,
      fieldName: rawFieldName,
      mappedField,
      value,
      valueType: data?.valueType,
      chg: data?.chg,
      percent: data?.percent,
      color: data?.color,
      colormask: data?.colormask,
    });
    if (this.statusDebugHistory.length > 200) {
      this.statusDebugHistory.pop();
    }

    if (isConditionMaskField) {
      const previousConditionMask = this.statusConditionMask;
      const parsedConditionMask = this.parseStatusConditionMaskValue(value);
      if (parsedConditionMask !== null) {
        this.statusConditionMask = parsedConditionMask;
      }
      this.playerStats.conditionMask = this.statusConditionMask;
      if (previousConditionMask !== this.statusConditionMask) {
        this.dependencies.darkCorridorInference.requestInferredDarkCorridorWallReconcile({ forceImmediate: true });
      }
      this.updateStatsDisplay();
      return;
    }

    if (!mappedField || value === null || value === undefined) {
      this.refreshLevelCacheNameFromStatusFields(
        rawFieldName,
        mappedField,
        value,
      );
      console.log(
        `Skipping status update: field=${field}, fieldName=${rawFieldName}, value=${value}`,
      );
      return;
    }

    const numericFields = new Set([
      "hp",
      "maxhp",
      "power",
      "maxpower",
      "level",
      "experience",
      "time",
      "armor",
      "score",
      "gold",
      "dlevel",
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]);

    let parsedValue: any = value;
    if (numericFields.has(mappedField)) {
      if (typeof value === "number") {
        parsedValue = value;
      } else {
        const clean = String(value).trim();
        if (mappedField === "gold") {
          const parsedGold = this.parseGoldStatusValue(clean);
          if (parsedGold === null) {
            console.log(`Could not parse gold status from "${value}"`);
            return;
          }
          parsedValue = parsedGold;
        } else {
          const match = clean.match(/-?\d+/);
          if (!match) {
            console.log(
              `Could not parse numeric status ${mappedField} from "${value}"`,
            );
            return;
          }
          parsedValue = parseInt(match[0], 10);
        }
      }
    } else {
      parsedValue = String(value).trim();
    }

    console.log(`Updating status ${mappedField}: ${parsedValue}`);
    const previousDlevel = this.playerStats.dlevel;
    const previousDungeon = this.playerStats.dungeon;
    this.dependencies.levelTerrainCache.applyRuntimeLevelIdentity(data?.levelIdentity);
    let playerDamageTaken: number | null = null;
    let playerDamageHpBefore: number | null = null;
    let playerHealingGained: number | null = null;
    let playerExperienceDelta: number | null = null;
    let playerLevelUpTo: number | null = null;
    let playerGoldIncreased = false;
    let playerCoreStatDeltaLabel: string | null = null;
    let playerCoreStatDeltaImproved: boolean | null = null;
    if (mappedField === "hp" && typeof parsedValue === "number") {
      const previousHp = this.lastKnownPlayerHp;
      if (typeof previousHp === "number" && Number.isFinite(previousHp)) {
        if (parsedValue < previousHp) {
          playerDamageTaken = Math.round(previousHp - parsedValue);
          playerDamageHpBefore = previousHp;
        } else if (parsedValue > previousHp) {
          playerHealingGained = Math.round(parsedValue - previousHp);
        }
      }
    }
    if (
      this.isCorePlayerStatField(mappedField) &&
      typeof parsedValue === "number"
    ) {
      const previousCoreStatValue = this.lastKnownPlayerCoreStats[mappedField];
      if (
        typeof previousCoreStatValue === "number" &&
        Number.isFinite(previousCoreStatValue)
      ) {
        const statDelta = Math.round(parsedValue - previousCoreStatValue);
        if (statDelta !== 0) {
          const signPrefix = statDelta > 0 ? "+" : "";
          playerCoreStatDeltaLabel = `${this.playerCoreStatDisplayNameByField[mappedField]} ${signPrefix}${statDelta}`;
          playerCoreStatDeltaImproved =
            mappedField === "armor" ? statDelta < 0 : statDelta > 0;
        }
      }
    }
    if (mappedField === "experience" && typeof parsedValue === "number") {
      const previousExperience = this.lastKnownPlayerExperience;
      if (
        typeof previousExperience === "number" &&
        Number.isFinite(previousExperience)
      ) {
        const delta = Math.round(parsedValue - previousExperience);
        if (delta !== 0) {
          playerExperienceDelta = delta;
        }
      }
    }
    if (mappedField === "level" && typeof parsedValue === "number") {
      const previousLevel = this.lastKnownPlayerLevel;
      if (
        typeof previousLevel === "number" &&
        Number.isFinite(previousLevel) &&
        parsedValue > previousLevel
      ) {
        playerLevelUpTo = parsedValue;
      }
    }
    if (mappedField === "gold" && typeof parsedValue === "number") {
      const previousGold = this.playerStats.gold;
      if (Number.isFinite(previousGold) && parsedValue > previousGold) {
        playerGoldIncreased = true;
      }
    }

    if (mappedField === "maxhp") {
      this.playerStats.maxHp = parsedValue;
    } else if (mappedField === "maxpower") {
      this.playerStats.maxPower = parsedValue;
    } else if (mappedField === "levelDescriptor") {
      const normalizedDescriptor = this.dependencies.levelTerrainCache.normalizeLevelCacheName(parsedValue);
      if (normalizedDescriptor) {
        this.dependencies.levelTerrainCache.latestLevelDescriptorName = normalizedDescriptor;

        const parsedDescriptorLevel =
          this.dependencies.levelTerrainCache.extractDlevelFromLevelDescriptor(normalizedDescriptor);
        if (parsedDescriptorLevel !== null) {
          this.playerStats.dlevel = parsedDescriptorLevel;
        }

        if (/^dlvl:/i.test(normalizedDescriptor)) {
          const identityDungeonName = this.dependencies.levelTerrainCache.normalizeDungeonDisplayName(
            this.dependencies.levelTerrainCache.latestRuntimeLevelIdentity?.dungeonName,
          );
          const identityBranchName = this.dependencies.levelTerrainCache.normalizeBranchDisplayName(
            this.dependencies.levelTerrainCache.latestRuntimeLevelIdentity?.branchTag,
          );
          this.playerStats.dungeon =
            identityDungeonName ??
            identityBranchName ??
            this.playerStats.dungeon ??
            "Dungeons of Doom";
        } else if (/^home\s+/i.test(normalizedDescriptor)) {
          const identityDungeonName = this.dependencies.levelTerrainCache.normalizeDungeonDisplayName(
            this.dependencies.levelTerrainCache.latestRuntimeLevelIdentity?.dungeonName,
          );
          this.playerStats.dungeon = identityDungeonName ?? "Quest";
        } else {
          const descriptorDungeonMatch = normalizedDescriptor.match(
            /^([^:]+):\s*-?\d+\s*$/i,
          );
          if (descriptorDungeonMatch && descriptorDungeonMatch[1]) {
            const normalizedDungeonLabel = this.dependencies.levelTerrainCache.normalizeDungeonDisplayName(
              descriptorDungeonMatch[1],
            );
            if (normalizedDungeonLabel) {
              this.playerStats.dungeon = normalizedDungeonLabel;
            }
          }
        }
      }
    } else if (mappedField === "dlevel") {
      this.playerStats.dlevel = parsedValue;
    } else {
      (this.playerStats as any)[mappedField] = parsedValue;
    }

    if (previousDlevel !== this.playerStats.dlevel) {
      this.dependencies.tileUpdates.pendingPlayerTileRefreshOnNextPosition = true;
      this.dependencies.tileUpdates.requestPlayerTileRefresh("dlevel-change");
    }
    if (String(previousDungeon) !== String(this.playerStats.dungeon)) {
      this.dependencies.tileUpdates.pendingPlayerTileRefreshOnNextPosition = true;
      this.dependencies.tileUpdates.requestPlayerTileRefresh("dungeon-change");
    }

    if (
      this.isCorePlayerStatField(mappedField) &&
      typeof parsedValue === "number"
    ) {
      this.lastKnownPlayerCoreStats[mappedField] = parsedValue;
    }
    if (mappedField === "experience" && typeof parsedValue === "number") {
      this.lastKnownPlayerExperience = parsedValue;
    }
    if (mappedField === "level" && typeof parsedValue === "number") {
      this.lastKnownPlayerLevel = parsedValue;
    }

    if (mappedField === "hp") {
      this.lastKnownPlayerHp = parsedValue;
      if (playerDamageTaken && playerDamageTaken > 0) {
        this.dependencies.audioHapticsPlatform.queueIncomingDamageRumble(
          playerDamageTaken,
          playerDamageHpBefore ?? playerDamageTaken,
        );
        this.dependencies.combatAttribution.triggerDamageEffectsAtTile(
          this.dependencies.playerMovement.playerPos.x,
          this.dependencies.playerMovement.playerPos.y,
          playerDamageTaken,
        );
      }
      if (playerHealingGained && playerHealingGained > 0) {
        if (this.dependencies.engineState.clientOptions.damageNumbers) {
          this.dependencies.damageNumbers.spawnPlayerHealNumberParticle(
            this.dependencies.playerMovement.playerPos.x,
            this.dependencies.playerMovement.playerPos.y,
            playerHealingGained,
          );
        }
      }
    }
    if (
      playerCoreStatDeltaLabel &&
      typeof playerCoreStatDeltaImproved === "boolean" &&
      this.dependencies.engineState.clientOptions.displayStatChangesAbovePlayer
    ) {
      this.dependencies.damageNumbers.spawnPlayerHealNumberParticle(
        this.dependencies.playerMovement.playerPos.x,
        this.dependencies.playerMovement.playerPos.y,
        1,
        {
          label: playerCoreStatDeltaLabel,
          fillStyle: playerCoreStatDeltaImproved ? "#79f2a6" : "#ff6b6b",
        },
      );
    }
    if (
      playerExperienceDelta &&
      playerExperienceDelta !== 0 &&
      this.dependencies.engineState.clientOptions.displayXpGainsAbovePlayer
    ) {
      const xpIncreased = playerExperienceDelta > 0;
      const signPrefix = xpIncreased ? "+" : "";
      this.dependencies.damageNumbers.spawnPlayerHealNumberParticle(
        this.dependencies.playerMovement.playerPos.x,
        this.dependencies.playerMovement.playerPos.y,
        1,
        {
          label: `XP ${signPrefix}${playerExperienceDelta}`,
          fillStyle: xpIncreased ? "#7ebfff" : "#ff6b6b",
          scaleMultiplier: 0.68,
        },
      );
    }
    if (
      playerLevelUpTo &&
      playerLevelUpTo > 0 &&
      this.dependencies.engineState.clientOptions.displayStatChangesAbovePlayer
    ) {
      this.dependencies.damageNumbers.spawnPlayerHealNumberParticle(
        this.dependencies.playerMovement.playerPos.x,
        this.dependencies.playerMovement.playerPos.y,
        1,
        {
          label: `Experience Level ${playerLevelUpTo}`,
          fillStyle: "#f2d06f",
        },
      );
    }
    if (playerGoldIncreased) {
      this.dependencies.audioHapticsPlatform.messageSoundHooks.playPickupGoldSound();
    }

    this.dependencies.levelTerrainCache.refreshOverviewStyleLocationLabel();
    this.updateStatsDisplay();
    this.refreshLevelCacheNameFromStatusFields(
      rawFieldName,
      mappedField,
      parsedValue,
    );
  }

  updateStatsDisplay(): void {
    const snapshot: PlayerStatsSnapshot = {
      ...this.playerStats,
    };
    this.dependencies.engineState.uiAdapter.setPlayerStats(snapshot);
  }
}
