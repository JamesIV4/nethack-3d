import { isLoggingEnabled, logWithOriginal, setLoggingEnabled } from "../../../logging";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { CombatAttribution } from "../world/combat-attribution";
import type { DirectionPrompts } from "./direction-prompts";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { ExtendedCommands } from "./extended-commands";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TileUpdates } from "../world/tile-updates";
import type { WorldClassification } from "../world/world-classification";

export interface EngineMessagesDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "messageSoundHooks"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    "consumeFpsHeldWeaponMissedAttackMessageSoundSuppression"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly engineState: Pick<
    EngineState,
    "session"
    | "uiAdapter"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "monsterBillboards"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "metaCommandModeActive"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "parseTileStateSignature"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "showFloatingGameMessage"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "tileStateCache"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "getPlayerUnderlayBillboardKey"
  >;
}

/** Game message forwarding and name/click diagnostic traces. */
export class EngineMessages {
  constructor(private readonly dependencies: EngineMessagesDependencies) {}

  gameMessages: string[] = [];

  isLoggingEnabled(): boolean {
    return isLoggingEnabled();
  }

  setLoggingEnabled(enabled: boolean): boolean {
    const next = setLoggingEnabled(enabled);
    if (this.dependencies.engineState.session) {
      this.dependencies.engineState.session.setLoggingEnabled(next);
    }
    logWithOriginal(`[NetHack 3D] Logging ${next ? "enabled" : "disabled"}`);
    return next;
  }

  addGameMessage(message: string): void {
    if (!message || message.trim() === "") return;
    const suppressMissedAttackSound =
      this.dependencies.combatAttribution.consumeFpsHeldWeaponMissedAttackMessageSoundSuppression(message);
    this.dependencies.audioHapticsPlatform.messageSoundHooks.playMessageLogSoundEffects(message, {
      suppressKeys: suppressMissedAttackSound ? ["missed-attack"] : [],
    });

    this.gameMessages.unshift(message);
    if (this.gameMessages.length > 100) {
      this.gameMessages.pop();
    }

    this.dependencies.engineState.uiAdapter.setGameMessages([...this.gameMessages]);

    this.dependencies.promptDialogs.showFloatingGameMessage(message);
  }

  isLikelyNameInputForDebug(input: string): boolean {
    const trimmed = String(input || "").trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      return false;
    }
    if (trimmed.startsWith("__") || trimmed.includes(":")) {
      return false;
    }
    if (!/^[A-Za-z][A-Za-z0-9 _'-]*$/.test(trimmed)) {
      return false;
    }
    const nonNameTokens = new Set([
      "Enter",
      "Escape",
      "Space",
      "Spacebar",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Backspace",
      "Tab",
    ]);
    return !nonNameTokens.has(trimmed);
  }

  logNameInputTrace(input: string): void {
    if (!this.isLikelyNameInputForDebug(input)) {
      return;
    }

    const stackPreview = (new Error().stack || "")
      .split("\n")
      .slice(2, 7)
      .map((line) => line.trim());
    console.log("[NAME_DEBUG] Engine sendInput(name-like)", {
      input,
      isInQuestion: this.dependencies.questionMenus.isInQuestion,
      isInDirectionQuestion: this.dependencies.directionPrompts.isInDirectionQuestion,
      positionInputModeActive: this.dependencies.positionSelection.positionInputModeActive,
      metaCommandModeActive: this.dependencies.extendedCommands.metaCommandModeActive,
      hasSession: Boolean(this.dependencies.engineState.session),
      stackPreview,
    });
  }

  logClickLookTileDebug(source: string, x: number, y: number): void {
    const key = `${x},${y}`;
    const signature = this.dependencies.tileUpdates.tileStateCache.get(key);
    const parsed = signature ? this.dependencies.levelTerrainCache.parseTileStateSignature(signature) : null;
    const mesh = this.dependencies.tileRendering.tileMap.get(key) ?? null;
    const tileId =
      typeof mesh?.userData?.tileIndex === "number"
        ? mesh.userData.tileIndex
        : null;
    const billboardSprite = this.dependencies.entityBillboards.monsterBillboards.get(key) ?? null;
    const billboardTileId =
      typeof billboardSprite?.userData?.tileIndex === "number"
        ? Math.trunc(billboardSprite.userData.tileIndex)
        : null;
    const explicitUnderBillboardFloorTileId =
      typeof mesh?.userData?.floorUnderlayTileIndex === "number"
        ? Math.trunc(mesh.userData.floorUnderlayTileIndex)
        : null;
    const underlayFeatureBillboardKey = this.dependencies.worldClassification.getPlayerUnderlayBillboardKey(key);
    const underlayFeatureSprite =
      this.dependencies.entityBillboards.monsterBillboards.get(underlayFeatureBillboardKey) ?? null;
    const underlayFeatureBillboardTileId =
      typeof underlayFeatureSprite?.userData?.tileIndex === "number"
        ? Math.trunc(underlayFeatureSprite.userData.tileIndex)
        : null;
    const hasBillboardOnTile =
      billboardSprite !== null || underlayFeatureSprite !== null;
    const underBillboardFloorTileId =
      explicitUnderBillboardFloorTileId ??
      (hasBillboardOnTile && typeof tileId === "number"
        ? Math.trunc(tileId)
        : null);
    const glyph = parsed?.glyph ?? null;
    const glyphChar = parsed?.char ?? null;
    const symidx =
      typeof parsed?.symidx === "number" ? Math.trunc(parsed.symidx) : null;
    console.log(
      `[clicklook:${source}] tile=${key} glyph=${glyph ?? "unknown"} char=${glyphChar ?? "unknown"} symidx=${symidx ?? "unknown"} tileId=${tileId ?? "unknown"} billboardTileId=${billboardTileId ?? "unknown"} underBillboardFloorTileId=${underBillboardFloorTileId ?? "unknown"} underlayBillboardTileId=${underlayFeatureBillboardTileId ?? "unknown"}`,
    );
  }
}
