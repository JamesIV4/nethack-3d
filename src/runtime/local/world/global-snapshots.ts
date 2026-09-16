// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeStartupConfiguration } from "../startup/startup-configuration";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeGlyphs } from "./glyphs";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimeExtendedCommandCatalog } from "../input/extended-command-catalog";
import type { RuntimeMapCallbacks } from "./map-callbacks";
import type { RuntimeStatus } from "../status/status";
import type { RuntimeInventorySnapshots } from "../menus/inventory-snapshots";
import type { RuntimeMessages } from "../messages/message-callbacks";

export interface RuntimeGlobalSnapshotsDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "runtimeVersion"
    | "protocol"
  >;
  readonly extendedCommandCatalog: Pick<
    RuntimeExtendedCommandCatalog,
    "emitExtendedCommands"
  >;
  readonly inventorySnapshots: Pick<
    RuntimeInventorySnapshots,
    "latestInventoryItems"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "gameMap"
    | "playerPosition"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "normalizeRuntimeInteger"
  >;
  readonly messages: Pick<
    RuntimeMessages,
    "gameMessages"
  >;
  readonly runtimeGlyphs: Pick<
    RuntimeGlyphs,
    "normalizeNonNegativeInteger"
  >;
  readonly startupOptions: Pick<
    RuntimeStartupConfiguration,
    "lastConfiguredNethackOptions"
  >;
  readonly status: Pick<
    RuntimeStatus,
    "latestStatusUpdates"
  >;
}

/** Serializable runtime globals, object tile indexes and dungeon/level identity. */
export class RuntimeGlobalSnapshots {
  declare didLogMissingLevelIdentityGlobals: boolean;

  constructor(private readonly deps: RuntimeGlobalSnapshotsDependencies) {
    this.didLogMissingLevelIdentityGlobals = false;
  }

  cloneRuntimeValueForSnapshot(value, depth = 0, seen = new WeakSet()) {
    if (value === null || value === undefined) {
      return value ?? null;
    }

    const valueType = typeof value;
    if (
      valueType === "string" ||
      valueType === "number" ||
      valueType === "boolean"
    ) {
      return value;
    }
    if (valueType === "bigint") {
      return String(value);
    }
    if (valueType === "function") {
      const fnName =
        typeof value.name === "string" && value.name.trim()
          ? value.name.trim()
          : "anonymous";
      return `[Function ${fnName}]`;
    }
    if (valueType !== "object") {
      return String(value);
    }
    if (seen.has(value)) {
      return "[Circular]";
    }
    if (depth >= 6) {
      return "[MaxDepth]";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      const maxItems = 300;
      const clonedItems = value
        .slice(0, maxItems)
        .map((item) =>
          this.cloneRuntimeValueForSnapshot(item, depth + 1, seen),
        );
      if (value.length > maxItems) {
        clonedItems.push(`[Truncated ${value.length - maxItems} items]`);
      }
      return clonedItems;
    }

    const output = {};
    const keys = Object.keys(value);
    const maxEntries = 400;
    for (let i = 0; i < keys.length && i < maxEntries; i += 1) {
      const key = keys[i];
      try {
        output[key] = this.cloneRuntimeValueForSnapshot(
          value[key],
          depth + 1,
          seen,
        );
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : String(error);
        output[key] = `[ReadError: ${message}]`;
      }
    }
    if (keys.length > maxEntries) {
      output.__truncatedKeys = keys.length - maxEntries;
    }
    return output;
  }

  buildRuntimeGlobalsSnapshot() {
    const root =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal
        : null;

    if (!root) {
      return {
        capturedAtMs: Date.now(),
        configuredNethackOptions: this.deps.startupOptions.lastConfiguredNethackOptions,
        runtimeVersion: this.deps.coordinator.runtimeVersion,
        nethackGlobal: null,
      };
    }

    const helperKeys =
      root.helpers && typeof root.helpers === "object"
        ? Object.keys(root.helpers).sort()
        : [];

    const objectTileIndexByObjectId =
      this.buildObjectTileIndexByObjectIdSnapshot();

    return {
      capturedAtMs: Date.now(),
      configuredNethackOptions: this.deps.startupOptions.lastConfiguredNethackOptions,
      runtimeVersion: this.deps.coordinator.runtimeVersion,
      objectTileIndexByObjectId,
      nethackGlobal: {
        keys: Object.keys(root).sort(),
        globals: this.cloneRuntimeValueForSnapshot(root.globals),
        constants: this.cloneRuntimeValueForSnapshot(root.constants),
        pointers: this.cloneRuntimeValueForSnapshot(root.pointers),
        helperKeys,
      },
    };
  }

  buildObjectTileIndexByObjectIdSnapshot() {
    const root =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal
        : null;
    if (!root) {
      return null;
    }

    const constants =
      root.constants && typeof root.constants === "object"
        ? root.constants
        : null;
    const glyphConstants =
      constants && constants.GLYPH && typeof constants.GLYPH === "object"
        ? constants.GLYPH
        : null;
    if (!glyphConstants) {
      return null;
    }

    const glyphObjOffset = this.deps.runtimeGlyphs.normalizeNonNegativeInteger(
      glyphConstants.GLYPH_OBJ_OFF,
    );
    const glyphCmapOffset = this.deps.runtimeGlyphs.normalizeNonNegativeInteger(
      glyphConstants.GLYPH_CMAP_OFF,
    );
    if (
      glyphObjOffset === null ||
      glyphCmapOffset === null ||
      glyphCmapOffset <= glyphObjOffset
    ) {
      return null;
    }

    const objectCount = glyphCmapOffset - glyphObjOffset;
    if (objectCount <= 0 || objectCount > 8192) {
      return null;
    }

    const helpers =
      root.helpers && typeof root.helpers === "object" ? root.helpers : null;
    const tileIndexForGlyph =
      helpers && typeof helpers.tileIndexForGlyph === "function"
        ? helpers.tileIndexForGlyph
        : null;
    if (!tileIndexForGlyph) {
      return null;
    }

    const tileIndexes = new Array(objectCount).fill(-1);
    for (let objectId = 0; objectId < objectCount; objectId += 1) {
      const glyph = glyphObjOffset + objectId;
      try {
        const rawTileIndex = tileIndexForGlyph(glyph);
        if (
          typeof rawTileIndex === "number" &&
          Number.isFinite(rawTileIndex) &&
          rawTileIndex >= 0
        ) {
          tileIndexes[objectId] = Math.trunc(rawTileIndex);
        }
      } catch {
        tileIndexes[objectId] = -1;
      }
    }

    return tileIndexes;
  }

  resolveDungeonByIndex(dungeons, dnum) {
    if (Array.isArray(dungeons)) {
      return dungeons[dnum] ?? null;
    }
    if (dungeons && typeof dungeons === "object") {
      if (Object.prototype.hasOwnProperty.call(dungeons, dnum)) {
        return dungeons[dnum];
      }
      const key = String(dnum);
      if (Object.prototype.hasOwnProperty.call(dungeons, key)) {
        return dungeons[key];
      }
    }
    return null;
  }

  resolveRuntimeBranchTag(dnum, topology) {
    if (!topology || typeof topology !== "object") {
      return null;
    }
    const minesDnum = this.deps.memory.normalizeRuntimeInteger(topology.d_mines_dnum);
    const questDnum = this.deps.memory.normalizeRuntimeInteger(topology.d_quest_dnum);
    const sokobanDnum = this.deps.memory.normalizeRuntimeInteger(topology.d_sokoban_dnum);
    const towerDnum = this.deps.memory.normalizeRuntimeInteger(topology.d_tower_dnum);
    const astralDnum = this.deps.memory.normalizeRuntimeInteger(
      topology.d_astral_level?.dnum,
    );

    if (dnum === 0) {
      return "dungeons_of_doom";
    }
    if (dnum === minesDnum) {
      return "mines";
    }
    if (dnum === questDnum) {
      return "quest";
    }
    if (dnum === sokobanDnum) {
      return "sokoban";
    }
    if (dnum === towerDnum) {
      return "vlads_tower";
    }
    if (dnum === astralDnum) {
      return "endgame";
    }
    return null;
  }

  resolveRuntimeLevelIdentity() {
    const globals =
      globalThis.nethackGlobal &&
        globalThis.nethackGlobal.globals &&
        typeof globalThis.nethackGlobal.globals === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals) {
      return null;
    }

    try {
      const globalsRoot =
        globals.g && typeof globals.g === "object" ? globals.g : null;
      const u = globals.u ?? globalsRoot?.u;
      const uz = u && typeof u === "object" ? u.uz : null;
      const dnum =
        uz && typeof uz === "object"
          ? this.deps.memory.normalizeRuntimeInteger(uz.dnum)
          : null;
      const dlevel =
        uz && typeof uz === "object"
          ? this.deps.memory.normalizeRuntimeInteger(uz.dlevel)
          : null;
      if (dnum === null || dlevel === null) {
        this.logMissingRuntimeLevelIdentityGlobals(globals);
        return null;
      }

      const dungeons = globals.dungeons ?? globalsRoot?.dungeons;
      const dungeonEntry = this.resolveDungeonByIndex(dungeons, dnum);
      const dungeonName =
        dungeonEntry &&
          typeof dungeonEntry === "object" &&
          typeof dungeonEntry.dname === "string"
          ? dungeonEntry.dname.trim() || null
          : null;
      const ledgerStart =
        dungeonEntry && typeof dungeonEntry === "object"
          ? this.deps.memory.normalizeRuntimeInteger(dungeonEntry.ledger_start)
          : null;
      const depthStart =
        dungeonEntry && typeof dungeonEntry === "object"
          ? this.deps.memory.normalizeRuntimeInteger(dungeonEntry.depth_start)
          : null;

      const ledgerNo =
        ledgerStart !== null ? Math.trunc(dlevel + ledgerStart) : null;
      const depth =
        depthStart !== null ? Math.trunc(depthStart + dlevel - 1) : null;

      const topology =
        globals.dungeon_topology && typeof globals.dungeon_topology === "object"
          ? globals.dungeon_topology
          : globalsRoot?.dungeon_topology &&
            typeof globalsRoot.dungeon_topology === "object"
            ? globalsRoot.dungeon_topology
            : null;
      const branchTag = this.resolveRuntimeBranchTag(dnum, topology);
      return {
        dnum,
        dlevel,
        ledgerNo,
        depth,
        dungeonName,
        branchTag,
      };
    } catch (error) {
      console.log("Failed to resolve runtime level identity:", error);
      return null;
    }
  }

  logMissingRuntimeLevelIdentityGlobals(globals) {
    if (this.didLogMissingLevelIdentityGlobals) {
      return;
    }
    this.didLogMissingLevelIdentityGlobals = true;
    const topLevelKeys =
      globals && typeof globals === "object" ? Object.keys(globals).sort() : [];
    const nestedKeys =
      globals &&
        typeof globals === "object" &&
        globals.g &&
        typeof globals.g === "object"
        ? Object.keys(globals.g).sort()
        : [];
    console.warn(
      "[LEVEL_IDENTITY_DEBUG] Runtime globals missing exported level identity fields (expected u.uz/dungeons/dungeon_topology).",
      {
        topLevelKeys,
        nestedGKeys: nestedKeys,
      },
    );
  }

  sendReconnectSnapshot() {
    if (!this.deps.coordinator.eventHandler) {
      return;
    }

    // Start from a clean client scene before replaying cached state.
    this.deps.coordinator.emit({
      type: "clear_scene",
      // message: "Reconnected - restoring game state",
    });
    this.deps.extendedCommandCatalog.emitExtendedCommands("snapshot");

    const tiles = Array.from(this.deps.mapCallbacks.gameMap.values());
    const chunkSize = 500;
    for (let i = 0; i < tiles.length; i += chunkSize) {
      this.deps.coordinator.emit({
        type: "map_glyph_batch",
        tiles: tiles.slice(i, i + chunkSize),
      });
    }

    this.deps.coordinator.emit({
      type: "player_position",
      x: this.deps.mapCallbacks.playerPosition.x,
      y: this.deps.mapCallbacks.playerPosition.y,
    });

    for (const payload of this.deps.status.latestStatusUpdates.values()) {
      this.deps.coordinator.emit(payload);
    }

    this.deps.coordinator.emit({
      type: "inventory_update",
      items: this.deps.inventorySnapshots.latestInventoryItems.map((item) => ({ ...item })),
      window: 4,
    });

    const recentMessages = this.deps.messages.gameMessages.slice(-30);
    for (const msg of recentMessages) {
      this.deps.coordinator.emit({
        type: "text",
        text: msg.text,
        window: msg.window,
        attr: msg.attr,
      });
    }
    this.deps.coordinator.protocol.boundary("snapshot-complete");
  }

  emitStartupObjectTileMap() {
    const objectTileIndexByObjectId =
      this.buildObjectTileIndexByObjectIdSnapshot();
    if (!Array.isArray(objectTileIndexByObjectId)) {
      return;
    }
    this.deps.coordinator.emit({
      type: "runtime_object_tile_map",
      objectTileIndexByObjectId,
    });
  }
}
