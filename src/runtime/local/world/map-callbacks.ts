// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import { isLoggingEnabled } from "../../../logging";
import type { RuntimePointerContract } from "../abi/pointer-contract";
import type { RuntimeGlyphs } from "./glyphs";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimeWindows } from "../messages/windows";
import type { RuntimeTileRefresh } from "./tile-refresh";
import type { RuntimePositionInput } from "../input/position-selection";
import type { RuntimeUnderPlayerItems } from "./under-player-items";
import type { RuntimePostActionRefresh } from "./post-action-refresh";

export interface RuntimeMapCallbacksDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "isClosed"
    | "runtimeVersion"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "decodeGlyphInfoPointer"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "getRuntimePointerContract"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "emitPositionCursor"
    | "isFarLookPositionRequest"
    | "positionInputActive"
  >;
  readonly postActionRefresh: Pick<
    RuntimePostActionRefresh,
    "armPendingPostActionPlayerTileRefreshByReason"
  >;
  readonly runtimeGlyphs: Pick<
    RuntimeGlyphs,
    "extractGlyphInfoGlyphFlags"
    | "extractGlyphInfoSymidx"
    | "extractGlyphInfoTileIndex"
    | "getTrackedMonsterIdFromRuntimeTile"
    | "isLootLikeRuntimeMapTile"
    | "isMonsterLikeRuntimeMapTile"
    | "isRenderableRuntimeMapTile"
    | "isUndiscoveredOrNothingGlyph"
    | "normalizeRuntimeAttackTargetId"
    | "normalizeRuntimeMonsterId"
    | "normalizeRuntimeTrackedEntityId"
  >;
  readonly tileRefresh: Pick<
    RuntimeTileRefresh,
    "decodeFloorUnderlayAtPosition"
  >;
  readonly underPlayerItems: Pick<
    RuntimeUnderPlayerItems,
    "emitUnderPlayerItemGlyphIfAvailableAt"
  >;
  readonly windows: Pick<
    RuntimeWindows,
    "isMapWindow"
  >;
}

/** Map glyph publication, tracked combat events and player-position callbacks. */
export class RuntimeMapCallbacks {
  declare gameMap: Map<any, any>;
  declare playerPosition: { x: number; y: number };
  declare playerPositionMovementSerial: number;

  constructor(private readonly deps: RuntimeMapCallbacksDependencies) {
    this.gameMap = new Map();
    this.playerPosition = { x: 0, y: 0 };
    this.playerPositionMovementSerial = 0;
  }

  queueMapGlyphUpdate(tile) {
    if (this.deps.coordinator.isClosed || !tile || !this.deps.coordinator.eventHandler) {
      return;
    }
    if (
      typeof tile.glyphFlags !== "number" &&
      typeof tile.x === "number" &&
      typeof tile.y === "number"
    ) {
      // Emit sites store decoded MG_* flags in gameMap before queueing; the
      // client (terminal display mode) needs them for tty-style highlighting.
      const storedTile = this.gameMap.get(`${tile.x},${tile.y}`);
      tile.glyphFlags =
        storedTile && typeof storedTile.glyphFlags === "number"
          ? storedTile.glyphFlags
          : null;
    }
    this.deps.coordinator.emit(tile);
  }

  handleShimPrintGlyph(args) {
    {
      // Runtime-specific shapes are validated against the pointer contract
      // before we get here; do not infer layout from arg count.
      const [printWin, x, y, a, b] = args as number[];

      let printGlyph = a;
      // Use local names to avoid colliding with existing glyphChar/glyphColor in your file
      let decodedChar: string | null = null;
      let decodedColor: number | null = null;
      let decodedTileIndex: number | null = null;
      let decodedSymidx: number | null = null;
      let shouldLogPrintGlyph = true;

      const printGlyphMode =
        this.deps.pointerContract.getRuntimePointerContract()?.callbackModes?.shim_print_glyph || {};
      const glyphArgMode =
        printGlyphMode.glyphArgMode === "glyphinfo_ptr"
          ? "glyphinfo_ptr"
          : "glyph_value";
      const trackedEntityArgIndex = Number.isInteger(
        printGlyphMode.trackedEntityArgIndex,
      )
        ? printGlyphMode.trackedEntityArgIndex
        : null;
      const attackingTargetArgIndex = Number.isInteger(
        printGlyphMode.attackingTargetArgIndex,
      )
        ? printGlyphMode.attackingTargetArgIndex
        : null;
      const rawMonsterId =
        trackedEntityArgIndex !== null ? args[trackedEntityArgIndex] : null;
      const rawAttackingTargetId =
        attackingTargetArgIndex !== null
          ? args[attackingTargetArgIndex]
          : null;
      const monsterId = this.deps.runtimeGlyphs.normalizeRuntimeTrackedEntityId(rawMonsterId);
      const attackingTargetId =
        this.deps.runtimeGlyphs.normalizeRuntimeAttackTargetId(rawAttackingTargetId);
      const loggingEnabled = isLoggingEnabled();
      const glyphDebugSuffix = loggingEnabled ? [
        monsterId !== null ? `monsterId=${monsterId}` : "",
        attackingTargetId !== null
          ? `attackingTargetId=${attackingTargetId}`
          : "",
      ]
        .filter(Boolean)
        .join(" ") : "";
      if (glyphArgMode === "glyphinfo_ptr" && args.length >= 5) {
        const extra = b;
        const decodedGlyphInfo = this.deps.memory.decodeGlyphInfoPointer(
          a,
          "shim_print_glyph",
        );
        if (decodedGlyphInfo) {
          printGlyph = decodedGlyphInfo.glyph;
          if (
            Number.isFinite(decodedGlyphInfo.ttychar) &&
            decodedGlyphInfo.ttychar !== null
          ) {
            decodedChar = String.fromCharCode(decodedGlyphInfo.ttychar & 0xff);
          }
          if (
            Number.isFinite(decodedGlyphInfo.color) &&
            decodedGlyphInfo.color !== null
          ) {
            decodedColor = decodedGlyphInfo.color;
          }
          if (decodedGlyphInfo.tileIndex !== null) {
            decodedTileIndex = decodedGlyphInfo.tileIndex;
          }
          shouldLogPrintGlyph = loggingEnabled && !this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(printGlyph);
          if (shouldLogPrintGlyph) console.log(
            `🎨 GLYPH [Win ${printWin}] at (${x},${y}): ptr=0x${decodedGlyphInfo.pointer.toString(
              16,
            )} glyph=${printGlyph} extra=0x${Number(extra || 0).toString(16)}`,
          );
        } else {
          console.log(
            `🎨 GLYPH [Win ${printWin}] at (${x},${y}): ptr=${a} [pointer decode failed]`,
          );
        }
      } else {
        shouldLogPrintGlyph = loggingEnabled && !this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(printGlyph);
        if (shouldLogPrintGlyph) console.log(
          `🎨 GLYPH [Win ${printWin}] at (${x},${y}): ${printGlyph}`,
        );
      }

      if (false && shouldLogPrintGlyph && glyphDebugSuffix) {
        console.log(
          `ðŸŽ¨ GLYPH [Win ${printWin}] at (${x},${y}): ${glyphDebugSuffix}`,
        );
      }

      if (shouldLogPrintGlyph && glyphDebugSuffix) {
        console.log(
          `[GLYPH DEBUG] [Win ${printWin}] at (${x},${y}): ${glyphDebugSuffix}`,
        );
      }

      if (this.deps.windows.isMapWindow(printWin)) {
        const key = `${x},${y}`;
        const previousTileData = this.gameMap.get(key);
        const previousMonsterId =
          this.deps.runtimeGlyphs.getTrackedMonsterIdFromRuntimeTile(previousTileData);
        if (this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(printGlyph)) {
          const hadRenderableTile =
            this.deps.runtimeGlyphs.isRenderableRuntimeMapTile(previousTileData);
          this.gameMap.delete(key);
          if (hadRenderableTile && this.deps.coordinator.eventHandler) {
            this.queueMapGlyphUpdate({
              type: "map_glyph",
              x,
              y,
              glyph: printGlyph,
              char: decodedChar,
              color: decodedColor,
              tileIndex: decodedTileIndex,
              symidx: decodedSymidx,
              floorUnderlayGlyph: null,
              floorUnderlayChar: null,
              floorUnderlayColor: null,
              floorUnderlayTileIndex: null,
              floorUnderlaySymidx: null,
              monsterId: previousMonsterId,
              attackingTargetId: null,
              window: printWin,
              isRuntimeUndiscoveredClear: true,
            });
          }
          return 0;
        }

        const helpers = (globalThis as any).nethackGlobal?.helpers;
        const mapHelper =
          this.deps.coordinator.runtimeVersion === "5.0"
            ? helpers?.mapGlyphInfoHelper
            : helpers?.mapglyphHelper;
        let decodedGlyphFlags = null;
        let floorUnderlay = null;

        if (mapHelper) {
          try {
            // IMPORTANT: for 5.0 we now pass the decoded glyph (not the pointer)
            const glyphInfo = mapHelper(
              printGlyph,
              x,
              y,
              0,
            );

            if (glyphInfo) {
              if (glyphInfo.ch !== undefined) {
                // Depending on build, glyphInfo.ch might already be a string char.
                // Handle both.
                if (typeof glyphInfo.ch === "number") {
                  decodedChar = String.fromCharCode(glyphInfo.ch);
                } else {
                  decodedChar = String(glyphInfo.ch);
                }
              }
              if (
                typeof glyphInfo.color === "number" &&
                Number.isFinite(glyphInfo.color)
              ) {
                decodedColor = glyphInfo.color;
              }
              decodedTileIndex = this.deps.runtimeGlyphs.extractGlyphInfoTileIndex(glyphInfo);
              decodedSymidx = this.deps.runtimeGlyphs.extractGlyphInfoSymidx(glyphInfo);
              decodedGlyphFlags = this.deps.runtimeGlyphs.extractGlyphInfoGlyphFlags(glyphInfo);
            }
          } catch (error) {
            console.log(
              `⚠️ Error getting glyph info for ${printGlyph}:`,
              error,
            );
          }
        }

        floorUnderlay = this.deps.tileRefresh.decodeFloorUnderlayAtPosition(
          x,
          y,
          helpers,
          mapHelper,
          true,
        );

        const isUndiscoveredOrNothingGlyph =
          this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(printGlyph, decodedGlyphFlags);
        if (isUndiscoveredOrNothingGlyph) {
          const hadRenderableTile =
            this.deps.runtimeGlyphs.isRenderableRuntimeMapTile(previousTileData);
          this.gameMap.delete(key);
          if (hadRenderableTile && this.deps.coordinator.eventHandler) {
            this.queueMapGlyphUpdate({
              type: "map_glyph",
              x,
              y,
              glyph: printGlyph,
              char: decodedChar,
              color: decodedColor,
              tileIndex: decodedTileIndex,
              symidx: decodedSymidx,
              floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
              floorUnderlayChar: floorUnderlay?.char ?? null,
              floorUnderlayColor: floorUnderlay?.color ?? null,
              floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
              floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
              monsterId: previousMonsterId,
              attackingTargetId: null,
              window: printWin,
              isRuntimeUndiscoveredClear: true,
            });
          }
          return 0;
        }

        this.gameMap.set(key, {
          x,
          y,
          glyph: printGlyph, // decoded glyph for 5.0
          glyphFlags: decodedGlyphFlags,
          char: decodedChar,
          color: decodedColor,
          tileIndex: decodedTileIndex,
          symidx: decodedSymidx,
          floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
          floorUnderlayChar: floorUnderlay?.char ?? null,
          floorUnderlayColor: floorUnderlay?.color ?? null,
          floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
          floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
          monsterId,
          timestamp: Date.now(),
        });

        // keep your original repaint/event flow
        if (this.deps.coordinator.eventHandler) {
          this.queueMapGlyphUpdate({
            type: "map_glyph",
            x,
            y,
            glyph: printGlyph, // decoded glyph for 5.0
            char: decodedChar,
            color: decodedColor,
            tileIndex: decodedTileIndex,
            symidx: decodedSymidx,
            floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
            floorUnderlayChar: floorUnderlay?.char ?? null,
            floorUnderlayColor: floorUnderlay?.color ?? null,
            floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
            floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
            monsterId,
            attackingTargetId,
            window: printWin,
          });
        }
      }

      return 0;
    }
  }

  handleShimMonsterAttack(args) {
    {
      const [rawAttackerId, rawTargetId, rawTargetX, rawTargetY] =
        args as number[];
      const attackerId = this.deps.runtimeGlyphs.normalizeRuntimeMonsterId(rawAttackerId);
      const targetId = this.deps.runtimeGlyphs.normalizeRuntimeAttackTargetId(rawTargetId);
      const targetX =
        typeof rawTargetX === "number" && Number.isFinite(rawTargetX)
          ? Math.trunc(rawTargetX)
          : null;
      const targetY =
        typeof rawTargetY === "number" && Number.isFinite(rawTargetY)
          ? Math.trunc(rawTargetY)
          : null;
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "monster_attack",
          attackerId,
          targetId,
          targetX,
          targetY,
        });
      }
      return 0;
    }
  }

  handleShimMonsterKilled(args) {
    {
      const [rawMonsterId, rawKillerId, rawX, rawY] = args as number[];
      const monsterId = this.deps.runtimeGlyphs.normalizeRuntimeMonsterId(rawMonsterId);
      const killerId = this.deps.runtimeGlyphs.normalizeRuntimeAttackTargetId(rawKillerId);
      const x =
        typeof rawX === "number" && Number.isFinite(rawX)
          ? Math.trunc(rawX)
          : null;
      const y =
        typeof rawY === "number" && Number.isFinite(rawY)
          ? Math.trunc(rawY)
          : null;
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "monster_killed",
          monsterId,
          killerId,
          x,
          y,
        });
      }
      return 0;
    }
  }

  handleShimCliparound(args) {
    const [clipX, clipY] = args;
    console.log(
      `🎯 Cliparound request for position (${clipX}, ${clipY}) - updating player position`,
    );

    if (this.deps.positionInput.positionInputActive || this.deps.positionInput.isFarLookPositionRequest()) {
      console.log(
        `🎯 Cliparound in position-input mode; routing to cursor at (${clipX}, ${clipY})`,
      );
      this.deps.positionInput.emitPositionCursor(null, clipX, clipY, "cliparound");
      return 0;
    }

    // Update player position when NetHack requests clipping around a position
    const oldPlayerPos = { ...this.playerPosition };
    const didMove =
      oldPlayerPos.x !== clipX || oldPlayerPos.y !== clipY;
    const destinationTileData = this.gameMap.get(`${clipX},${clipY}`);
    const movedOntoMonsterLikeOccupant =
      didMove && this.deps.runtimeGlyphs.isMonsterLikeRuntimeMapTile(destinationTileData);
    const movedOntoLootLikeTile =
      didMove && this.deps.runtimeGlyphs.isLootLikeRuntimeMapTile(destinationTileData);
    this.playerPosition = { x: clipX, y: clipY };
    if (didMove) {
      this.playerPositionMovementSerial += 1;
    }

    // Send updated player position to client
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "player_position",
        x: clipX,
        y: clipY,
      });
    }
    if (movedOntoLootLikeTile) {
      this.deps.underPlayerItems.emitUnderPlayerItemGlyphIfAvailableAt(
        clipX,
        clipY,
        null,
        null,
        true,
        "cliparound-move-onto-loot",
      );
    }
    if (movedOntoMonsterLikeOccupant) {
      this.deps.postActionRefresh.armPendingPostActionPlayerTileRefreshByReason(
        "monster-like-vacated-tile",
        `after moving onto monster-like occupied tile at (${clipX}, ${clipY}) in case loot was underneath`,
      );
    }
    return 0;
  }

  handleShimCurs(args) {
    const [cursWin, cursX, cursY] = args;
    console.log(
      `🖱️ Setting cursor for window ${cursWin} to (${cursX}, ${cursY})`,
    );
    if (this.deps.positionInput.positionInputActive || this.deps.positionInput.isFarLookPositionRequest()) {
      this.deps.positionInput.emitPositionCursor(cursWin, cursX, cursY, "curs");
    } else if (
      this.deps.coordinator.eventHandler &&
      Number.isFinite(cursX) &&
      Number.isFinite(cursY) &&
      this.deps.windows.isMapWindow(cursWin)
    ) {
      this.deps.coordinator.emit({
        type: "map_cursor",
        x: cursX,
        y: cursY,
        window: cursWin,
        source: "curs",
      });
    }
    return 0;
  }
}
