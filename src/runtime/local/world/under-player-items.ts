// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeGlyphs } from "./glyphs";
import type { RuntimeMapCallbacks } from "./map-callbacks";
import type { RuntimePostActionRefresh } from "./post-action-refresh";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeTileRefresh } from "./tile-refresh";

export interface RuntimeUnderPlayerItemsDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "runtimeVersion"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "gameMap"
    | "playerPosition"
  >;
  readonly postActionRefresh: Pick<
    RuntimePostActionRefresh,
    "clearPendingPostActionPlayerTileRefresh"
    | "pendingPostActionPlayerTileRefreshReason"
    | "pendingPostActionPlayerTileRefreshSnapshot"
    | "pendingPostActionPlayerTileRefreshTarget"
  >;
  readonly runtimeGlyphs: Pick<
    RuntimeGlyphs,
    "extractGlyphInfoGlyphFlags"
    | "extractGlyphInfoSymidx"
    | "extractGlyphInfoTileIndex"
    | "isLootLikeGlyph"
  >;
  readonly tileRefresh: Pick<
    RuntimeTileRefresh,
    "canQueryWasmHelpers"
  >;
}

/** Under-player item snapshots, confirmed boulder pushes and live glyph recovery or clearing. */
export class RuntimeUnderPlayerItems {

  constructor(private readonly deps: RuntimeUnderPlayerItemsDependencies) {}

  buildUnderPlayerItemSnapshotFromRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return null;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null || !this.deps.runtimeGlyphs.isLootLikeGlyph(glyph)) {
      return null;
    }
    return {
      glyph,
      char:
        typeof tileData.char === "string" && tileData.char.length > 0
          ? tileData.char
          : null,
      color:
        typeof tileData.color === "number" && Number.isFinite(tileData.color)
          ? Math.trunc(tileData.color)
          : null,
      tileIndex:
        typeof tileData.tileIndex === "number" && Number.isFinite(tileData.tileIndex)
          ? Math.trunc(tileData.tileIndex)
          : null,
      symidx:
        typeof tileData.symidx === "number" && Number.isFinite(tileData.symidx)
          ? Math.trunc(tileData.symidx)
          : null,
    };
  }

  doesRuntimeMapTileMatchUnderPlayerSnapshot(tileData, snapshot) {
    if (
      !tileData ||
      typeof tileData !== "object" ||
      !snapshot ||
      typeof snapshot !== "object"
    ) {
      return false;
    }
    const tileGlyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    const snapshotGlyph =
      typeof snapshot.glyph === "number" && Number.isFinite(snapshot.glyph)
        ? Math.trunc(snapshot.glyph)
        : null;
    if (tileGlyph === null || snapshotGlyph === null || tileGlyph !== snapshotGlyph) {
      return false;
    }

    const tileTileIndex =
      typeof tileData.tileIndex === "number" && Number.isFinite(tileData.tileIndex)
        ? Math.trunc(tileData.tileIndex)
        : null;
    const snapshotTileIndex =
      typeof snapshot.tileIndex === "number" && Number.isFinite(snapshot.tileIndex)
        ? Math.trunc(snapshot.tileIndex)
        : null;
    if (
      tileTileIndex !== null &&
      snapshotTileIndex !== null &&
      tileTileIndex !== snapshotTileIndex
    ) {
      return false;
    }

    const tileSymidx =
      typeof tileData.symidx === "number" && Number.isFinite(tileData.symidx)
        ? Math.trunc(tileData.symidx)
        : null;
    const snapshotSymidx =
      typeof snapshot.symidx === "number" && Number.isFinite(snapshot.symidx)
        ? Math.trunc(snapshot.symidx)
        : null;
    if (tileSymidx !== null && snapshotSymidx !== null && tileSymidx !== snapshotSymidx) {
      return false;
    }

    return true;
  }

  findAdjacentRuntimeMapTileMatchingUnderPlayerSnapshot(target, snapshot) {
    if (
      !target ||
      typeof target !== "object" ||
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y) ||
      !snapshot ||
      typeof snapshot !== "object"
    ) {
      return null;
    }

    const originX = Math.trunc(Number(target.x));
    const originY = Math.trunc(Number(target.y));
    const matches = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const tileX = originX + dx;
        const tileY = originY + dy;
        const tileData = this.deps.mapCallbacks.gameMap.get(`${tileX},${tileY}`) ?? null;
        if (!this.doesRuntimeMapTileMatchUnderPlayerSnapshot(tileData, snapshot)) {
          continue;
        }
        matches.push({ x: tileX, y: tileY });
      }
    }

    if (matches.length !== 1) {
      return null;
    }
    return matches[0];
  }

  maybeEmitConfirmedBoulderPushEventFromRuntimeMap(trigger = "unknown") {
    const pendingReason =
      typeof this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshReason === "string" &&
        this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshReason.trim().length > 0
        ? this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (pendingReason !== "move-onto-lootlike-tile") {
      return false;
    }

    const pendingTarget =
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget &&
        Number.isFinite(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.x) &&
        Number.isFinite(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
          x: Math.trunc(Number(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.x)),
          y: Math.trunc(Number(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.y)),
        }
        : null;
    const snapshot =
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot &&
        typeof this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot === "object"
        ? this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot
        : null;
    if (!pendingTarget || !snapshot) {
      return false;
    }

    const shiftedTarget = this.findAdjacentRuntimeMapTileMatchingUnderPlayerSnapshot(
      pendingTarget,
      snapshot,
    );
    if (!shiftedTarget) {
      return false;
    }

    const moveDx = shiftedTarget.x - pendingTarget.x;
    const moveDy = shiftedTarget.y - pendingTarget.y;
    if (
      (moveDx === 0 && moveDy === 0) ||
      Math.abs(moveDx) > 1 ||
      Math.abs(moveDy) > 1
    ) {
      return false;
    }

    const targetKey = `${pendingTarget.x},${pendingTarget.y}`;
    const targetTileData = this.deps.mapCallbacks.gameMap.get(targetKey) ?? null;
    const targetStillMatchesSnapshot = this.doesRuntimeMapTileMatchUnderPlayerSnapshot(
      targetTileData,
      snapshot,
    );
    if (targetStillMatchesSnapshot) {
      return false;
    }

    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "confirmed_boulder_push",
        fromX: pendingTarget.x,
        fromY: pendingTarget.y,
        toX: shiftedTarget.x,
        toY: shiftedTarget.y,
        glyph:
          Number.isFinite(snapshot.glyph) ? Math.trunc(Number(snapshot.glyph)) : null,
        char:
          typeof snapshot.char === "string" && snapshot.char.length > 0
            ? snapshot.char
            : null,
        color:
          typeof snapshot.color === "number" && Number.isFinite(snapshot.color)
            ? Math.trunc(Number(snapshot.color))
            : null,
        tileIndex:
          typeof snapshot.tileIndex === "number" &&
            Number.isFinite(snapshot.tileIndex)
            ? Math.trunc(Number(snapshot.tileIndex))
            : null,
        symidx:
          typeof snapshot.symidx === "number" && Number.isFinite(snapshot.symidx)
            ? Math.trunc(Number(snapshot.symidx))
            : null,
      });
    }

    const didRefreshLiveUnderPlayerGlyph = this.deps.tileRefresh.canQueryWasmHelpers()
      ? this.emitUnderPlayerItemGlyphIfAvailableAt(
        pendingTarget.x,
        pendingTarget.y,
        null,
        null,
        true,
        `confirmed-boulder-push-runtime-map:${trigger}`,
      )
      : false;
    if (!didRefreshLiveUnderPlayerGlyph) {
      this.emitUnderPlayerItemGlyphClearedForPendingTarget(
        `confirmed-boulder-push-runtime-map:${trigger}`,
      );
    }
    this.deps.postActionRefresh.clearPendingPostActionPlayerTileRefresh(
      `confirmed boulder push runtime-map [trigger=${trigger}]`,
    );
    return true;
  }

  emitUnderPlayerItemGlyphFromPendingSnapshot(trigger = "unknown") {
    if (!this.deps.coordinator.eventHandler) {
      return false;
    }
    const target =
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget &&
        Number.isFinite(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.x) &&
        Number.isFinite(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
          x: Math.trunc(Number(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.x)),
          y: Math.trunc(Number(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.y)),
        }
        : null;
    const snapshot =
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot &&
        typeof this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot === "object"
        ? this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot
        : null;
    if (!target || !snapshot || !Number.isFinite(snapshot.glyph)) {
      return false;
    }
    console.log(
      `Applying pending under-player item snapshot at (${target.x}, ${target.y}) [trigger=${trigger}] glyph=${snapshot.glyph}`,
    );
    this.deps.coordinator.emit({
      type: "under_player_item_glyph",
      x: target.x,
      y: target.y,
      glyph: Math.trunc(Number(snapshot.glyph)),
      char:
        typeof snapshot.char === "string" && snapshot.char.length > 0
          ? snapshot.char
          : null,
      color:
        typeof snapshot.color === "number" && Number.isFinite(snapshot.color)
          ? Math.trunc(snapshot.color)
          : null,
      tileIndex:
        typeof snapshot.tileIndex === "number" &&
          Number.isFinite(snapshot.tileIndex)
          ? Math.trunc(snapshot.tileIndex)
          : null,
      symidx:
        typeof snapshot.symidx === "number" && Number.isFinite(snapshot.symidx)
          ? Math.trunc(snapshot.symidx)
          : null,
    });
    return true;
  }

  emitUnderPlayerItemGlyphClearedForPendingTarget(trigger = "unknown") {
    if (!this.deps.coordinator.eventHandler) {
      return false;
    }
    const target =
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget &&
        Number.isFinite(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.x) &&
        Number.isFinite(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
          x: Math.trunc(Number(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.x)),
          y: Math.trunc(Number(this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget.y)),
        }
        : null;
    if (!target) {
      return false;
    }
    console.log(
      `Clearing pending under-player item target at (${target.x}, ${target.y}) [trigger=${trigger}]`,
    );
    this.deps.coordinator.emit({
      type: "under_player_item_glyph_cleared",
      x: target.x,
      y: target.y,
    });
    return true;
  }

  emitUnderPlayerItemGlyphClearedForTarget(
    x,
    y,
    trigger = "unknown",
  ) {
    if (!this.deps.coordinator.eventHandler || !Number.isFinite(x) || !Number.isFinite(y)) {
      return false;
    }
    const tileX = Math.trunc(Number(x));
    const tileY = Math.trunc(Number(y));
    console.log(
      `Clearing under-player item target at (${tileX}, ${tileY}) [trigger=${trigger}]`,
    );
    this.deps.coordinator.emit({
      type: "under_player_item_glyph_cleared",
      x: tileX,
      y: tileY,
    });
    return true;
  }

  emitUnderPlayerItemGlyphIfAvailableAt(
    x,
    y,
    helpers = null,
    mapHelper = null,
    canQueryWasmHelpers = true,
    trigger = "unknown",
  ) {
    if (
      !this.deps.coordinator.eventHandler ||
      !canQueryWasmHelpers ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return false;
    }

    const tileX = Math.trunc(Number(x));
    const tileY = Math.trunc(Number(y));
    const isPlayerTile =
      this.deps.mapCallbacks.playerPosition &&
      tileX === this.deps.mapCallbacks.playerPosition.x &&
      tileY === this.deps.mapCallbacks.playerPosition.y;
    if (!isPlayerTile) {
      return false;
    }

    const resolvedHelpers =
      helpers ||
      (globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null);
    const topItemGlyphUnderPlayer =
      resolvedHelpers &&
        typeof resolvedHelpers.topItemGlyphUnderPlayer === "function"
        ? resolvedHelpers.topItemGlyphUnderPlayer
        : null;
    if (!topItemGlyphUnderPlayer) {
      return false;
    }

    const topItemTileIndexUnderPlayer =
      resolvedHelpers &&
        typeof resolvedHelpers.topItemTileIndexUnderPlayer === "function"
        ? resolvedHelpers.topItemTileIndexUnderPlayer
        : null;
    const resolvedMapHelper =
      mapHelper ||
      (resolvedHelpers
        ? this.deps.coordinator.runtimeVersion === "5.0"
          ? typeof resolvedHelpers.mapGlyphInfoHelper === "function"
            ? resolvedHelpers.mapGlyphInfoHelper
            : null
          : typeof resolvedHelpers.mapglyphHelper === "function"
            ? resolvedHelpers.mapglyphHelper
            : null
        : null);

    try {
      const topGlyphRaw = topItemGlyphUnderPlayer();
      const topGlyph = Number(topGlyphRaw);
      if (!Number.isFinite(topGlyph) || topGlyph < 0) {
        console.log(
          `🧹 Under-player top item glyph cleared at (${tileX}, ${tileY}) [trigger=${trigger}]`,
        );
        this.deps.coordinator.emit({
          type: "under_player_item_glyph_cleared",
          x: tileX,
          y: tileY,
        });
        return true;
      }

      const normalizedGlyph = Math.trunc(topGlyph);
      let decodedChar = null;
      let decodedColor = null;
      let decodedTileIndex = null;
      let decodedSymidx = null;
      let decodedGlyphFlags = null;

      if (topItemTileIndexUnderPlayer) {
        try {
          const tileIndexRaw = topItemTileIndexUnderPlayer();
          const tileIndex = Number(tileIndexRaw);
          if (Number.isFinite(tileIndex) && tileIndex >= 0) {
            decodedTileIndex = Math.trunc(tileIndex);
          }
        } catch (error) {
          console.log("[WARN] topItemTileIndexUnderPlayer failed:", error);
        }
      }

      if (resolvedMapHelper) {
        try {
          const glyphInfo = resolvedMapHelper(normalizedGlyph, tileX, tileY, 0);
          if (glyphInfo) {
            if (glyphInfo.ch !== undefined) {
              decodedChar =
                typeof glyphInfo.ch === "number"
                  ? String.fromCharCode(glyphInfo.ch)
                  : String(glyphInfo.ch);
            }
            if (
              typeof glyphInfo.color === "number" &&
              Number.isFinite(glyphInfo.color)
            ) {
              decodedColor = Math.trunc(glyphInfo.color);
            }
            if (decodedTileIndex === null) {
              const resolvedTileIndex =
                this.deps.runtimeGlyphs.extractGlyphInfoTileIndex(glyphInfo);
              if (resolvedTileIndex !== null) {
                decodedTileIndex = resolvedTileIndex;
              }
            }
            decodedSymidx = this.deps.runtimeGlyphs.extractGlyphInfoSymidx(glyphInfo);
            decodedGlyphFlags = this.deps.runtimeGlyphs.extractGlyphInfoGlyphFlags(glyphInfo);
          }
        } catch (error) {
          console.log("[WARN] Error decoding under-player item glyph:", error);
        }
      }

      console.log(
        `🎒 Under-player top item glyph at (${tileX}, ${tileY}) => ${normalizedGlyph} (tileIndex=${decodedTileIndex ?? "n/a"}) [trigger=${trigger}]`,
      );
      this.deps.coordinator.emit({
        type: "under_player_item_glyph",
        x: tileX,
        y: tileY,
        glyph: normalizedGlyph,
        char: decodedChar,
        color: decodedColor,
        tileIndex: decodedTileIndex,
        symidx: decodedSymidx,
        glyphFlags: decodedGlyphFlags,
        kind: "obj",
      });
      return true;
    } catch (error) {
      console.log("[WARN] topItemGlyphUnderPlayer failed:", error);
      return false;
    }
  }
}
