// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeInputRequests } from "../input/input-requests";
import type { RuntimeTextInput } from "../input/text-input";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeGlyphs } from "./glyphs";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeMapCallbacks } from "./map-callbacks";
import type { RuntimeWindows } from "../messages/windows";
import type { RuntimeUnderPlayerItems } from "./under-player-items";
import { RuntimeRefreshRequests } from "../../protocol/refresh-requests";
import { refreshAreaCells, resolveRuntimeMapDimensions, runtimeMapContains } from "../../protocol/map-bounds";

export interface RuntimeTileRefreshDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "isClosed"
    | "runtimeVersion"
    | "protocol"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "activeInputRequest"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "gameMap"
    | "playerPosition"
    | "queueMapGlyphUpdate"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "pendingMenuSelection"
  >;
  readonly runtimeGlyphs: Pick<
    RuntimeGlyphs,
    "extractGlyphInfoGlyphFlags"
    | "extractGlyphInfoSymidx"
    | "extractGlyphInfoTileIndex"
    | "getTrackedMonsterIdFromRuntimeTile"
    | "isRenderableRuntimeMapTile"
    | "isUndiscoveredOrNothingGlyph"
  >;
  readonly textInput: Pick<
    RuntimeTextInput,
    "pendingTextRequest"
  >;
  readonly underPlayerItems: Pick<
    RuntimeUnderPlayerItems,
    "emitUnderPlayerItemGlyphIfAvailableAt"
  >;
  readonly windows: Pick<
    RuntimeWindows,
    "getRuntimeWindowId"
  >;
}

/** Helper-safe deferred tile/area refresh queues, floor underlays and map update emission. */
export class RuntimeTileRefresh {
  readonly identifiedRequests: RuntimeRefreshRequests;
  declare deferredTileRefreshKeys: Set<string>;
  declare deferredAreaRefreshRequests: Map<any, any>;
  declare deferredTileRefreshFlushScheduled: boolean;

  constructor(private readonly deps: RuntimeTileRefreshDependencies) {
    this.identifiedRequests = new RuntimeRefreshRequests({
      scope: () => this.deps.coordinator.protocol.scope,
      canQuery: () => this.canQueryWasmHelpers(),
      query: (cell, includeUnderPlayer) => this.handleTileUpdateRequest(cell.x, cell.y, { defer: false, includeUnderPlayer }),
      emit: event => this.deps.coordinator.emit(event),
    });
    this.deferredTileRefreshKeys = new Set();
    this.deferredAreaRefreshRequests = new Map();
    this.deferredTileRefreshFlushScheduled = false;
  }

  canQueryWasmHelpers() {
    return (
      !this.deps.inputRequests.activeInputRequest &&
      !this.deps.textInput.pendingTextRequest &&
      !this.deps.menuSelection.pendingMenuSelection
    );
  }

  handleCellRefreshSet(requestId, cells, scope, includeUnderPlayer = false) {
    this.identifiedRequests.request(requestId, cells, scope, includeUnderPlayer);
  }

  cancelPendingRefreshSets() {
    this.identifiedRequests.cancelAll();
  }

  deferTileRefreshRequest(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    this.deferredTileRefreshKeys.add(`${x},${y}`);
  }

  deferAreaRefreshRequest(centerX, centerY, radius) {
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
      return;
    }
    const normalizedRadius =
      Number.isFinite(radius) && Number(radius) >= 0
        ? Math.trunc(Number(radius))
        : 0;
    const key = `${centerX},${centerY},${normalizedRadius}`;
    this.deferredAreaRefreshRequests.set(key, {
      centerX,
      centerY,
      radius: normalizedRadius,
    });
  }

  maybeFlushDeferredTileRefreshes() {
    if (this.deferredTileRefreshFlushScheduled) {
      return;
    }
    if (!this.canQueryWasmHelpers()) {
      return;
    }
    if (
      this.deferredTileRefreshKeys.size === 0 &&
      this.deferredAreaRefreshRequests.size === 0 && !this.identifiedRequests.hasPending
    ) {
      return;
    }

    this.deferredTileRefreshFlushScheduled = true;
    const schedule =
      typeof setTimeout === "function"
        ? setTimeout
        : (callback) => callback();

    schedule(() => {
      this.deferredTileRefreshFlushScheduled = false;
      this.flushDeferredTileRefreshesNow();
    }, 0);
  }

  flushDeferredTileRefreshesNow() {
    if (!this.canQueryWasmHelpers()) {
      return;
    }
    if (
      this.deferredTileRefreshKeys.size === 0 &&
      this.deferredAreaRefreshRequests.size === 0 && !this.identifiedRequests.hasPending
    ) {
      return;
    }

    const pendingAreas = Array.from(this.deferredAreaRefreshRequests.values());
    const pendingTiles = Array.from(this.deferredTileRefreshKeys);
    this.deferredAreaRefreshRequests.clear();
    this.deferredTileRefreshKeys.clear();

    for (const area of pendingAreas) {
      this.handleAreaUpdateRequest(area.centerX, area.centerY, area.radius);
    }

    for (const key of pendingTiles) {
      const [xRaw, yRaw] = key.split(",");
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      this.handleTileUpdateRequest(x, y);
    }
    this.identifiedRequests.flush();
  }

  decodeFloorUnderlayAtPosition(
    x,
    y,
    helpers,
    mapHelper,
    canQueryWasmHelpers = true,
  ) {
    if (!canQueryWasmHelpers) {
      return null;
    }
    if (
      !helpers ||
      typeof helpers.floorGlyphAtHelper !== "function" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null;
    }

    let floorGlyph = -1;
    try {
      const raw = helpers.floorGlyphAtHelper(Math.trunc(x), Math.trunc(y));
      floorGlyph = Number(raw);
    } catch (error) {
      console.log("[WARN] floorGlyphAtHelper failed:", error);
      return null;
    }

    if (!Number.isFinite(floorGlyph) || floorGlyph < 0) {
      return null;
    }

    const normalizedFloorGlyph = Math.trunc(floorGlyph);
    let floorChar = null;
    let floorColor = null;
    let floorTileIndex = null;
    let floorSymidx = null;

    if (mapHelper) {
      try {
        const glyphInfo = mapHelper(normalizedFloorGlyph, x, y, 0);
        if (glyphInfo) {
          if (glyphInfo.ch !== undefined) {
            floorChar =
              typeof glyphInfo.ch === "number"
                ? String.fromCharCode(glyphInfo.ch)
                : String(glyphInfo.ch);
          }
          if (
            typeof glyphInfo.color === "number" &&
            Number.isFinite(glyphInfo.color)
          ) {
            floorColor = Math.trunc(glyphInfo.color);
          }
          floorTileIndex = this.deps.runtimeGlyphs.extractGlyphInfoTileIndex(glyphInfo);
          floorSymidx = this.deps.runtimeGlyphs.extractGlyphInfoSymidx(glyphInfo);
        }
      } catch (error) {
        console.log("[WARN] floor underlay mapGlyph decode failed:", error);
      }
    }

    if (
      floorTileIndex === null &&
      typeof helpers.tileIndexForGlyph === "function"
    ) {
      try {
        const fallbackTileIndex = Number(
          helpers.tileIndexForGlyph(normalizedFloorGlyph),
        );
        if (Number.isFinite(fallbackTileIndex) && fallbackTileIndex >= 0) {
          floorTileIndex = Math.trunc(fallbackTileIndex);
        }
      } catch (error) {
        console.log("[WARN] floor underlay tileIndexForGlyph failed:", error);
      }
    }

    return {
      glyph: normalizedFloorGlyph,
      char: floorChar,
      color: floorColor,
      tileIndex: floorTileIndex,
      symidx: floorSymidx,
    };
  }

  // Handle request for tile update from client
  handleTileUpdateRequest(x, y, options = {}) {
    if (this.deps.coordinator.isClosed) {
      return "cancelled";
    }
    const constants = globalThis.nethackGlobal?.constants;
    const dimensions = resolveRuntimeMapDimensions({ columns: constants?.COLNO, rows: constants?.ROWNO });
    // glyph_at returns a room glyph outside the map in all three games.
    // Such a query is unavailable, not a newly discovered floor tile.
    if (!runtimeMapContains(x, y, dimensions)) return "unavailable";
    console.log(`🔄 Client requested tile update for (${x}, ${y})`);

    const canQueryWasmHelpers = this.canQueryWasmHelpers();
    if (!canQueryWasmHelpers && options.defer !== false) {
      this.deferTileRefreshRequest(x, y);
    }
    let queryFailed = false;
    const key = `${x},${y}`;
    const tileData = this.deps.mapCallbacks.gameMap.get(key);
    const isPlayerTile =
      this.deps.mapCallbacks.playerPosition &&
      x === this.deps.mapCallbacks.playerPosition.x &&
      y === this.deps.mapCallbacks.playerPosition.y;
    const helpers =
      globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null;
    const glyphAtHelper =
      canQueryWasmHelpers && helpers && typeof helpers.glyphAtHelper === "function"
        ? helpers.glyphAtHelper
        : null;
    const topItemGlyphUnderPlayer =
      canQueryWasmHelpers &&
        helpers &&
        typeof helpers.topItemGlyphUnderPlayer === "function"
        ? helpers.topItemGlyphUnderPlayer
        : null;
    const topItemTileIndexUnderPlayer =
      canQueryWasmHelpers &&
        helpers &&
        typeof helpers.topItemTileIndexUnderPlayer === "function"
        ? helpers.topItemTileIndexUnderPlayer
        : null;
    const mapHelper = helpers
      ? this.deps.coordinator.runtimeVersion === "5.0"
        ? typeof helpers.mapGlyphInfoHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapGlyphInfoHelper
            : null
          : null
        : typeof helpers.mapglyphHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapglyphHelper
            : null
          : null
      : null;

    const updateTileFromGlyph = (glyph) => {
      if (!Number.isFinite(glyph)) {
        return false;
      }
      const normalizedGlyph = Math.trunc(Number(glyph));
      let decodedChar = tileData ? tileData.char : "";
      let decodedColor = tileData ? tileData.color : null;
      let decodedTileIndex = tileData ? tileData.tileIndex : null;
      let decodedSymidx =
        tileData && Number.isFinite(Number(tileData.symidx))
          ? Math.trunc(Number(tileData.symidx))
          : null;
      const trackedMonsterId = this.deps.runtimeGlyphs.getTrackedMonsterIdFromRuntimeTile(tileData);
      let decodedGlyphFlags = null;
      let floorUnderlay = null;
      if (this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(normalizedGlyph)) {
        const hadRenderableTile = this.deps.runtimeGlyphs.isRenderableRuntimeMapTile(tileData);
        this.deps.mapCallbacks.gameMap.delete(key);
        if (hadRenderableTile && this.deps.coordinator.eventHandler) {
          this.deps.mapCallbacks.queueMapGlyphUpdate({
            type: "map_glyph",
            x,
            y,
            glyph: normalizedGlyph,
            char: decodedChar,
            color: decodedColor,
            tileIndex: decodedTileIndex,
            symidx: decodedSymidx,
            floorUnderlayGlyph: null,
            floorUnderlayChar: null,
            floorUnderlayColor: null,
            floorUnderlayTileIndex: null,
            floorUnderlaySymidx: null,
            monsterId: trackedMonsterId,
            attackingTargetId: null,
            window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
            isRefresh: true,
            isRuntimeUndiscoveredClear: true,
          });
        }
        return true;
      }

      if (mapHelper) {
        try {
          const mgflags = 0;
          const glyphInfo = mapHelper(glyph, x, y, mgflags);
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
              decodedColor = glyphInfo.color;
            }
            decodedTileIndex = this.deps.runtimeGlyphs.extractGlyphInfoTileIndex(glyphInfo);
            decodedSymidx = this.deps.runtimeGlyphs.extractGlyphInfoSymidx(glyphInfo);
            decodedGlyphFlags = this.deps.runtimeGlyphs.extractGlyphInfoGlyphFlags(glyphInfo);
          } else {
            queryFailed = true;
          }
        } catch (error) {
          queryFailed = true;
          console.log("⚠️ Error decoding glyph for refresh:", error);
        }
      }

      floorUnderlay = this.decodeFloorUnderlayAtPosition(
        x,
        y,
        helpers,
        mapHelper,
        canQueryWasmHelpers,
      );

      const isUndiscoveredOrNothingGlyph = this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(
        normalizedGlyph,
        decodedGlyphFlags,
      );
      if (isUndiscoveredOrNothingGlyph) {
        const hadRenderableTile = this.deps.runtimeGlyphs.isRenderableRuntimeMapTile(tileData);
        this.deps.mapCallbacks.gameMap.delete(key);
        if (hadRenderableTile && this.deps.coordinator.eventHandler) {
          this.deps.mapCallbacks.queueMapGlyphUpdate({
            type: "map_glyph",
            x,
            y,
            glyph: normalizedGlyph,
            char: decodedChar,
            color: decodedColor,
            tileIndex: decodedTileIndex,
            symidx: decodedSymidx,
            floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
            floorUnderlayChar: floorUnderlay?.char ?? null,
            floorUnderlayColor: floorUnderlay?.color ?? null,
            floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
            floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
            monsterId: trackedMonsterId,
            attackingTargetId: null,
            window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
            isRefresh: true,
            isRuntimeUndiscoveredClear: true,
          });
        }
        return true;
      }

      this.deps.mapCallbacks.gameMap.set(key, {
        x,
        y,
        glyph: normalizedGlyph,
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
        monsterId: trackedMonsterId,
        timestamp: Date.now(),
      });

      if (this.deps.coordinator.eventHandler) {
        this.deps.mapCallbacks.queueMapGlyphUpdate({
          type: "map_glyph",
          x,
          y,
          glyph: normalizedGlyph,
          char: decodedChar,
          color: decodedColor,
          tileIndex: decodedTileIndex,
          symidx: decodedSymidx,
          floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
          floorUnderlayChar: floorUnderlay?.char ?? null,
          floorUnderlayColor: floorUnderlay?.color ?? null,
          floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
          floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
          monsterId: trackedMonsterId,
          attackingTargetId: null,
          window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
          isRefresh: true,
        });
      }
      return true;
    };

    const emitUnderPlayerItemGlyphIfAvailable = () => {
      // Area/map-only refreshes did not query under-player items. Preserve
      // that boundary: a negative legacy item sentinel can also mean unseen.
      if (options.includeUnderPlayer === false) return;
      this.deps.underPlayerItems.emitUnderPlayerItemGlyphIfAvailableAt(
        x,
        y,
        helpers,
        mapHelper,
        canQueryWasmHelpers &&
        Boolean(isPlayerTile && topItemGlyphUnderPlayer && this.deps.coordinator.eventHandler),
        "tile-update",
      );
    };

    if (glyphAtHelper) {
      try {
        const glyph = glyphAtHelper(x, y);
        if (updateTileFromGlyph(glyph)) {
          emitUnderPlayerItemGlyphIfAvailable();
          return queryFailed ? "failed" : "fresh";
        }
        queryFailed = true;
      } catch (error) {
        queryFailed = true;
        console.log("[WARN] glyphAtHelper refresh failed:", error);
      }
    }

    emitUnderPlayerItemGlyphIfAvailable();

    if (tileData) {
      console.log(`📤 Resending tile data for (${x}, ${y}):`, tileData);

      if (this.deps.coordinator.eventHandler) {
        this.deps.mapCallbacks.queueMapGlyphUpdate({
          type: "map_glyph",
          x: tileData.x,
          y: tileData.y,
          glyph: tileData.glyph,
          char: tileData.char,
          color: tileData.color,
          tileIndex: tileData.tileIndex,
          symidx: tileData.symidx,
          floorUnderlayGlyph: tileData.floorUnderlayGlyph ?? null,
          floorUnderlayChar: tileData.floorUnderlayChar ?? null,
          floorUnderlayColor: tileData.floorUnderlayColor ?? null,
          floorUnderlayTileIndex: tileData.floorUnderlayTileIndex ?? null,
          floorUnderlaySymidx: tileData.floorUnderlaySymidx ?? null,
          monsterId: this.deps.runtimeGlyphs.getTrackedMonsterIdFromRuntimeTile(tileData),
          attackingTargetId: null,
          window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
          isRefresh: true, // Mark this as a refresh to distinguish from new data
        });
      }
    } else {
      console.log(
        `⚠️ No tile data found for (${x}, ${y}) - tile may not be explored yet`,
      );

      // Optionally, we could send a "blank" tile or request NetHack to redraw the area
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "tile_not_found",
          x: x,
          y: y,
          message: "Tile data not available - may not be explored yet",
        });
      }
    }
    return queryFailed ? "failed" : tileData ? "cached" : "unavailable";
  }

  // Handle request for area update from client
  handleAreaUpdateRequest(centerX, centerY, radius = 3) {
    if (this.deps.coordinator.isClosed) {
      return;
    }
    console.log(
      `🔄 Client requested area update centered at (${centerX}, ${centerY}) with radius ${radius}`,
    );

    const canQueryWasmHelpers = this.canQueryWasmHelpers();
    if (!canQueryWasmHelpers) {
      this.deferAreaRefreshRequest(centerX, centerY, radius);
    }
    let tilesRefreshed = 0;
    const helpers =
      globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null;
    const glyphAtHelper =
      canQueryWasmHelpers && helpers && typeof helpers.glyphAtHelper === "function"
        ? helpers.glyphAtHelper
        : null;
    const mapHelper = helpers
      ? this.deps.coordinator.runtimeVersion === "5.0"
        ? typeof helpers.mapGlyphInfoHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapGlyphInfoHelper
            : null
          : null
        : typeof helpers.mapglyphHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapglyphHelper
            : null
          : null
      : null;

    const constants = globalThis.nethackGlobal?.constants;
    const dimensions = resolveRuntimeMapDimensions({ columns: constants?.COLNO, rows: constants?.ROWNO });
    for (const { x, y } of refreshAreaCells(centerX, centerY, radius, dimensions)) {
        const key = `${x},${y}`;
        const tileData = this.deps.mapCallbacks.gameMap.get(key);

        if (glyphAtHelper) {
          try {
            const glyph = glyphAtHelper(x, y);
            if (Number.isFinite(glyph)) {
              const normalizedGlyph = Math.trunc(Number(glyph));
              let decodedChar = tileData ? tileData.char : "";
              let decodedColor = tileData ? tileData.color : null;
              let decodedTileIndex = tileData ? tileData.tileIndex : null;
              let decodedSymidx =
                tileData && Number.isFinite(Number(tileData.symidx))
                  ? Math.trunc(Number(tileData.symidx))
                  : null;
              const trackedMonsterId =
                this.deps.runtimeGlyphs.getTrackedMonsterIdFromRuntimeTile(tileData);
              let decodedGlyphFlags = null;
              let floorUnderlay = null;
              if (this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(normalizedGlyph)) {
                const hadRenderableTile =
                  this.deps.runtimeGlyphs.isRenderableRuntimeMapTile(tileData);
                this.deps.mapCallbacks.gameMap.delete(key);
                if (hadRenderableTile && this.deps.coordinator.eventHandler) {
                  this.deps.mapCallbacks.queueMapGlyphUpdate({
                    type: "map_glyph",
                    x,
                    y,
                    glyph: normalizedGlyph,
                    char: decodedChar,
                    color: decodedColor,
                    tileIndex: decodedTileIndex,
                    symidx: decodedSymidx,
                    floorUnderlayGlyph: null,
                    floorUnderlayChar: null,
                    floorUnderlayColor: null,
                    floorUnderlayTileIndex: null,
                    floorUnderlaySymidx: null,
                    monsterId: trackedMonsterId,
                    attackingTargetId: null,
                    window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
                    isRefresh: true,
                    isAreaRefresh: true,
                    isRuntimeUndiscoveredClear: true,
                  });
                }
                tilesRefreshed++;
                continue;
              }

              if (mapHelper) {
                try {
                  const mgflags = 0;
                  const glyphInfo = mapHelper(glyph, x, y, mgflags);
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
                      decodedColor = glyphInfo.color;
                    }
                    decodedTileIndex = this.deps.runtimeGlyphs.extractGlyphInfoTileIndex(glyphInfo);
                    decodedSymidx = this.deps.runtimeGlyphs.extractGlyphInfoSymidx(glyphInfo);
                    decodedGlyphFlags = this.deps.runtimeGlyphs.extractGlyphInfoGlyphFlags(glyphInfo);
                  }
                } catch (error) {
                  console.log(
                    "⚠️ Error decoding glyph for area refresh:",
                    error,
                  );
                }
              }

              floorUnderlay = this.decodeFloorUnderlayAtPosition(
                x,
                y,
                helpers,
                mapHelper,
                canQueryWasmHelpers,
              );

              const isUndiscoveredOrNothingGlyph =
                this.deps.runtimeGlyphs.isUndiscoveredOrNothingGlyph(
                  normalizedGlyph,
                  decodedGlyphFlags,
                );
              if (isUndiscoveredOrNothingGlyph) {
                const hadRenderableTile =
                  this.deps.runtimeGlyphs.isRenderableRuntimeMapTile(tileData);
                this.deps.mapCallbacks.gameMap.delete(key);
                if (hadRenderableTile && this.deps.coordinator.eventHandler) {
                  this.deps.mapCallbacks.queueMapGlyphUpdate({
                    type: "map_glyph",
                    x,
                    y,
                    glyph: normalizedGlyph,
                    char: decodedChar,
                    color: decodedColor,
                    tileIndex: decodedTileIndex,
                    symidx: decodedSymidx,
                    floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
                    floorUnderlayChar: floorUnderlay?.char ?? null,
                    floorUnderlayColor: floorUnderlay?.color ?? null,
                    floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
                    floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
                    monsterId: trackedMonsterId,
                    attackingTargetId: null,
                    window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
                    isRefresh: true,
                    isAreaRefresh: true,
                    isRuntimeUndiscoveredClear: true,
                  });
                }
                tilesRefreshed++;
                continue;
              }

              this.deps.mapCallbacks.gameMap.set(key, {
                x,
                y,
                glyph: normalizedGlyph,
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
                monsterId: trackedMonsterId,
                timestamp: Date.now(),
              });

              if (this.deps.coordinator.eventHandler) {
                this.deps.mapCallbacks.queueMapGlyphUpdate({
                  type: "map_glyph",
                  x,
                  y,
                  glyph: normalizedGlyph,
                  char: decodedChar,
                  color: decodedColor,
                  tileIndex: decodedTileIndex,
                  symidx: decodedSymidx,
                  floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
                  floorUnderlayChar: floorUnderlay?.char ?? null,
                  floorUnderlayColor: floorUnderlay?.color ?? null,
                  floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
                  floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
                  monsterId: trackedMonsterId,
                  attackingTargetId: null,
                  window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
                  isRefresh: true,
                  isAreaRefresh: true,
                });
              }
              tilesRefreshed++;
              continue;
            }
          } catch (error) {
            console.log("⚠️ glyphAtHelper area refresh failed:", error);
          }
        }

        if (tileData) {
          if (this.deps.coordinator.eventHandler) {
            this.deps.mapCallbacks.queueMapGlyphUpdate({
              type: "map_glyph",
              x: tileData.x,
              y: tileData.y,
              glyph: tileData.glyph,
              char: tileData.char,
              color: tileData.color,
              tileIndex: tileData.tileIndex,
              symidx: tileData.symidx,
              floorUnderlayGlyph: tileData.floorUnderlayGlyph ?? null,
              floorUnderlayChar: tileData.floorUnderlayChar ?? null,
              floorUnderlayColor: tileData.floorUnderlayColor ?? null,
              floorUnderlayTileIndex: tileData.floorUnderlayTileIndex ?? null,
              floorUnderlaySymidx: tileData.floorUnderlaySymidx ?? null,
              monsterId: this.deps.runtimeGlyphs.getTrackedMonsterIdFromRuntimeTile(tileData),
              attackingTargetId: null,
              window: this.deps.windows.getRuntimeWindowId("WIN_MAP"),
              isRefresh: true,
              isAreaRefresh: true,
            });
          }
          tilesRefreshed++;
        }
    }

    console.log(
      `📤 Refreshed ${tilesRefreshed} tiles in area around (${centerX}, ${centerY})`,
    );

    // Send completion message
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "area_refresh_complete",
        centerX: centerX,
        centerY: centerY,
        radius: radius,
        tilesRefreshed: tilesRefreshed,
      });
    }
  }
}
