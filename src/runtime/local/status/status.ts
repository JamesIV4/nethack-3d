// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import { STATUS_FIELD_MAP_367, STATUS_FIELD_MAP_5 } from "../../status-map";
import { isLoggingEnabled } from "../../../logging";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeGameOver } from "../lifecycle/game-over";
import type { RuntimeGlobalSnapshots } from "../world/global-snapshots";

export interface RuntimeStatusDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "nethackModule"
    | "runtimeVersion"
    | "protocol"
  >;
  readonly gameOver: Pick<
    RuntimeGameOver,
    "recordLastKnownGold"
  >;
  readonly globalSnapshots: Pick<
    RuntimeGlobalSnapshots,
    "resolveRuntimeLevelIdentity"
  >;
}

/** Runtime status-field constants, value decoding, ordered status flushing and reconnect status cache. */
export class RuntimeStatus {
  declare latestStatusUpdates: Map<any, any>;
  declare statusPending: Map<any, any>;

  constructor(private readonly deps: RuntimeStatusDependencies) {
    this.latestStatusUpdates = new Map();
    this.statusPending = new Map();
  }

  getRuntimeStatusFieldMap() {
    return this.deps.coordinator.runtimeVersion === "5.0"
      ? STATUS_FIELD_MAP_5
      : STATUS_FIELD_MAP_367;
  }

  seedRuntimeStatusFieldConstants() {
    const constants =
      globalThis.nethackGlobal &&
        globalThis.nethackGlobal.constants &&
        typeof globalThis.nethackGlobal.constants === "object"
        ? globalThis.nethackGlobal.constants
        : null;
    if (!constants) {
      return;
    }

    const existing =
      constants.STATUS_FIELD && typeof constants.STATUS_FIELD === "object"
        ? constants.STATUS_FIELD
        : {};
    const merged = { ...existing };
    const runtimeMap = this.getRuntimeStatusFieldMap();

    for (const [rawIndex, rawName] of Object.entries(runtimeMap || {})) {
      const index = Number(rawIndex);
      if (!Number.isFinite(index)) {
        continue;
      }
      const fieldName = String(rawName ?? "").trim();
      if (!fieldName) {
        continue;
      }
      merged[index] = fieldName;
      if (merged[fieldName] === undefined) {
        merged[fieldName] = index;
      }
    }

    merged[-1] = "BL_FLUSH";
    merged[-2] = "BL_RESET";
    merged[-3] = "BL_CHARACTERISTICS";
    if (merged.BL_FLUSH === undefined) {
      merged.BL_FLUSH = -1;
    }
    if (merged.BL_RESET === undefined) {
      merged.BL_RESET = -2;
    }
    if (merged.BL_CHARACTERISTICS === undefined) {
      merged.BL_CHARACTERISTICS = -3;
    }

    constants.STATUS_FIELD = merged;
  }

  resolveStatusFieldIndex(fieldName) {
    const normalizedFieldName = String(fieldName || "").trim();
    if (!normalizedFieldName) {
      return null;
    }

    const constants =
      globalThis.nethackGlobal && globalThis.nethackGlobal.constants
        ? globalThis.nethackGlobal.constants
        : null;
    const statusFieldConstants =
      constants &&
        constants.STATUS_FIELD &&
        typeof constants.STATUS_FIELD === "object"
        ? constants.STATUS_FIELD
        : null;
    if (statusFieldConstants) {
      const direct = Number(statusFieldConstants[normalizedFieldName]);
      if (Number.isFinite(direct)) {
        return Math.trunc(direct);
      }
    }

    const fallback = this.getRuntimeStatusFieldMap();
    for (const [rawIndex, rawFieldName] of Object.entries(fallback || {})) {
      if (String(rawFieldName || "").trim() !== normalizedFieldName) {
        continue;
      }
      const parsedIndex = Number(rawIndex);
      if (Number.isFinite(parsedIndex)) {
        return Math.trunc(parsedIndex);
      }
    }

    return null;
  }

  getStatusFieldName(field) {
    if (typeof field !== "number") return String(field);
    if (field === -1) {
      return "BL_FLUSH";
    }
    if (field === -2) {
      return "BL_RESET";
    }
    if (field === -3) {
      return "BL_CHARACTERISTICS";
    }
    if (field === 23) {
      return "BL_FLUSH";
    }
    if (field === 24) {
      return "BL_RESET";
    }
    if (field === 25) {
      return "BL_CHARACTERISTICS";
    }

    const constants =
      globalThis.nethackGlobal && globalThis.nethackGlobal.constants
        ? globalThis.nethackGlobal.constants
        : null;
    if (
      constants &&
      constants.STATUS_FIELD &&
      constants.STATUS_FIELD[field] !== undefined
    ) {
      return String(constants.STATUS_FIELD[field]);
    }

    const fallback = this.getRuntimeStatusFieldMap();
    if (fallback && fallback[field] !== undefined) {
      return String(fallback[field]);
    }

    return `FIELD_${field}`;
  }

  decodeStatusValue(fieldName, ptrToArg) {
    // These are signals, ptrToArg value is not used.
    const signalFields = new Set([
      "BL_RESET",
      "BL_FLUSH",
      "BL_CHARACTERISTICS",
    ]);
    if (signalFields.has(fieldName)) {
      return { value: 0, valueType: "i" };
    }

    if (fieldName === "BL_CONDITION") {
      // This is a pointer to the bitmask value
      try {
        const value = this.deps.coordinator.nethackModule.getValue(ptrToArg, "i32");
        return { value: value, valueType: "i" };
      } catch (e) {
        console.log(
          `Status int decode failed for ${fieldName} at ptr ${ptrToArg}`,
          e,
        );
        return { value: 0, valueType: "i" };
      }
    }

    // For all other fields, NetHack provides a pre-formatted string.
    try {
      return {
        value: this.deps.coordinator.nethackModule.UTF8ToString(ptrToArg),
        valueType: "s",
      };
    } catch (e) {
      return { value: "", valueType: "s" };
    }
  }

  flushPendingStatusUpdates(reason = "flush") {
    if (this.statusPending.size === 0) {
      this.deps.coordinator.protocol.boundary("status-flush");
      return;
    }

    const orderedUpdates = Array.from(this.statusPending.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, payload]) => payload);
    this.statusPending.clear();

    if (isLoggingEnabled()) console.log(
      `Flushing ${orderedUpdates.length} pending status updates (reason=${reason})`,
    );

    for (const payload of orderedUpdates) {
      if (payload && typeof payload.field === "number") {
        this.latestStatusUpdates.set(payload.field, payload);
      }
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit(payload);
      }
    }
    this.deps.coordinator.protocol.boundary("status-flush");
  }

  readLatestStatusInteger(fieldName) {
    const target = String(fieldName || "").trim();
    if (!target) {
      return null;
    }
    let latestPayload = null;
    for (const payload of this.latestStatusUpdates.values()) {
      if (payload && payload.fieldName === target) {
        latestPayload = payload;
      }
    }
    if (!latestPayload) {
      return null;
    }
    const parsed = Number.parseInt(String(latestPayload.value ?? "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  handleShimStatusUpdate(args) {
    const [field, ptrToArg, chg, percent, color, colormask] = args;
    const fieldName = this.getStatusFieldName(field);
    const isFlushSignal =
      fieldName === "BL_FLUSH" ||
      fieldName === "BL_RESET" ||
      fieldName === "BL_CHARACTERISTICS";
    if (isFlushSignal) {
      this.flushPendingStatusUpdates(fieldName);
      return 0;
    }

    const decoded = this.decodeStatusValue(fieldName, ptrToArg);
    this.deps.gameOver.recordLastKnownGold(fieldName, decoded.value);
    const statusPayload = {
      type: "status_update",
      field: field,
      fieldName: fieldName,
      value: decoded.value,
      valueType: decoded.valueType,
      ptrToArg: ptrToArg,
      usedFallback: decoded.usedFallback,
      chg: chg,
      percent: percent,
      color: color,
      colormask: colormask,
      levelIdentity: this.deps.globalSnapshots.resolveRuntimeLevelIdentity(),
    };
    this.statusPending.set(field, statusPayload);
    this.latestStatusUpdates.set(field, statusPayload);
    if (isLoggingEnabled()) console.log(
      `Queued status update ${fieldName} (${field}) => ${decoded.value} [type=${decoded.valueType}, fallback=${decoded.usedFallback}]`,
    );
    return 0;
  }

  handleShimStatusEnablefield(args) {
    const [
      enabledFieldIndex,
      enabledFieldName,
      enabledFieldFormat,
      enabled,
    ] = args;
    console.log(
      "Status field enable callback:",
      enabledFieldIndex,
      enabledFieldName,
      enabledFieldFormat,
      enabled,
    );
    return 0;
  }
}
