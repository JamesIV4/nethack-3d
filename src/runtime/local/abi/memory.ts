// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimePointerContract } from "./pointer-contract";

export interface RuntimeMemoryDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "nethackModule"
    | "runtimeVersion"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "getRuntimePointerContract"
  >;
}

/** Validated WASM memory access, glyphinfo decoding and exported helper compatibility. */
export class RuntimeMemory {

  constructor(private readonly deps: RuntimeMemoryDependencies) {}

  normalizeWasmPointer(
    value,
    {
      allowZero = false,
      alignment = 1,
      minBytes = 1,
      enforceBounds = true,
      label = "pointer",
    } = {},
  ) {
    if (!this.deps.coordinator.nethackModule) {
      return null;
    }

    const asNumber =
      typeof value === "bigint"
        ? Number(value)
        : Number.isFinite(Number(value))
          ? Number(value)
          : NaN;
    if (!Number.isFinite(asNumber)) {
      return null;
    }
    const ptr = Math.trunc(asNumber);
    if (ptr === 0) {
      return allowZero ? 0 : null;
    }
    if (ptr < 0) {
      return null;
    }
    if (Number.isInteger(alignment) && alignment > 1 && ptr % alignment !== 0) {
      return null;
    }

    const heapSize =
      this.deps.coordinator.nethackModule.HEAPU8 && this.deps.coordinator.nethackModule.HEAPU8.length
        ? this.deps.coordinator.nethackModule.HEAPU8.length
        : 0;
    if (
      enforceBounds &&
      heapSize &&
      Number.isInteger(minBytes) &&
      minBytes > 0 &&
      ptr + minBytes > heapSize
    ) {
      return null;
    }
    return ptr;
  }

  readPointerSlotValue(
    ptr,
    label = "pointer_slot",
    normalizeValueAsPointer = false,
  ) {
    if (
      !this.deps.coordinator.nethackModule ||
      typeof this.deps.coordinator.nethackModule.getValue !== "function"
    ) {
      return null;
    }
    const slotPtr = this.normalizeWasmPointer(ptr, {
      label,
      minBytes: 4,
      alignment: 4,
    });
    if (!slotPtr) {
      return null;
    }
    const rawValue = this.readRuntimeValue(slotPtr, "*", {
      label: `${label}_raw`,
      minBytes: 4,
      alignment: 4,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    if (!normalizeValueAsPointer) {
      const normalizedValue =
        typeof rawValue === "bigint"
          ? Number(rawValue)
          : Number.isFinite(Number(rawValue))
            ? Number(rawValue)
            : NaN;
      return Number.isFinite(normalizedValue)
        ? Math.trunc(normalizedValue)
        : null;
    }
    return this.normalizeWasmPointer(rawValue, {
      allowZero: true,
      label: `${label}_value`,
    });
  }

  readRuntimeValue(
    ptr,
    valueType,
    { label = "runtime_value", minBytes = 1, alignment = 1 } = {},
  ) {
    if (
      !this.deps.coordinator.nethackModule ||
      typeof this.deps.coordinator.nethackModule.getValue !== "function"
    ) {
      return null;
    }
    const normalizedPtr = this.normalizeWasmPointer(ptr, {
      label,
      minBytes,
      alignment,
      // Some wasm bundles do not expose HEAP* arrays on the module object.
      // In that case we cannot do local bounds checks and must rely on getValue.
      enforceBounds: true,
    });
    if (!normalizedPtr) {
      return null;
    }
    try {
      return this.deps.coordinator.nethackModule.getValue(normalizedPtr, valueType);
    } catch (_error) {
      return null;
    }
  }

  readRuntimeI8(ptr, label = "i8", unsigned = false) {
    const rawValue = this.readRuntimeValue(ptr, "i8", {
      label,
      minBytes: 1,
      alignment: 1,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    const normalizedValue =
      typeof rawValue === "bigint"
        ? Number(rawValue)
        : Number.isFinite(Number(rawValue))
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(normalizedValue)) {
      return null;
    }
    const coerced = Math.trunc(normalizedValue);
    return unsigned ? (coerced & 0xff) : coerced;
  }

  readRuntimeI16(ptr, label = "i16", unsigned = false) {
    const rawValue = this.readRuntimeValue(ptr, "i16", {
      label,
      minBytes: 2,
      alignment: 1,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    const normalizedValue =
      typeof rawValue === "bigint"
        ? Number(rawValue)
        : Number.isFinite(Number(rawValue))
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(normalizedValue)) {
      return null;
    }
    const coerced = Math.trunc(normalizedValue);
    return unsigned ? (coerced & 0xffff) : coerced;
  }

  readRuntimeI32(ptr, label = "i32") {
    const rawValue = this.readRuntimeValue(ptr, "i32", {
      label,
      minBytes: 4,
      alignment: 1,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    const normalizedValue =
      typeof rawValue === "bigint"
        ? Number(rawValue)
        : Number.isFinite(Number(rawValue))
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(normalizedValue)) {
      return null;
    }
    return Math.trunc(normalizedValue);
  }

  decodeGlyphInfoPointer(ptr, contextLabel = "glyphinfo") {
    const contract = this.deps.pointerContract.getRuntimePointerContract();
    const glyphInfo = contract?.glyphInfo;
    if (!glyphInfo) {
      return null;
    }

    const pointer = this.normalizeWasmPointer(ptr, {
      label: `${contextLabel}_ptr`,
      minBytes: Number(glyphInfo.minBytes) || 1,
      alignment:
        Number.isInteger(glyphInfo.pointerAlignment) &&
          glyphInfo.pointerAlignment > 0
          ? glyphInfo.pointerAlignment
          : 1,
    });
    if (!pointer) {
      return null;
    }

    const glyphOffset = Number(glyphInfo.glyphOffset) || 0;
    const ttyCharOffset = Number(glyphInfo.ttyCharOffset);
    const colorOffset = Number(glyphInfo.colorOffset);
    const tileIndexOffset = Number(glyphInfo.tileIndexOffset);
    const tileIndexType =
      glyphInfo.tileIndexType === "i32" ? "i32" : "i16";

    const readI32At = (offset) => {
      if (!Number.isInteger(offset)) {
        return null;
      }
      const address = pointer + offset;
      return this.readRuntimeI32(address, `${contextLabel}_i32_${offset}`);
    };

    const glyph = readI32At(glyphOffset);
    if (!Number.isFinite(glyph)) {
      return null;
    }
    const glyphValue = Math.trunc(Number(glyph));
    if (glyphValue < 0 || glyphValue > 1000000) {
      return null;
    }

    const ttychar = readI32At(ttyCharOffset);
    const color = readI32At(colorOffset);
    let tileIndex = null;
    if (Number.isInteger(tileIndexOffset)) {
      const tileAddress = pointer + tileIndexOffset;
      if (tileIndexType === "i32") {
        const tile32 = readI32At(tileIndexOffset);
        if (Number.isFinite(tile32)) {
          tileIndex = tile32;
        }
      } else {
        const tile16 = this.readRuntimeI16(
          tileAddress,
          `${contextLabel}_tile_i16_${tileIndexOffset}`,
          true,
        );
        if (Number.isFinite(tile16)) {
          tileIndex = tile16;
        }
      }
    }

    return {
      pointer,
      glyph: glyphValue,
      ttychar: Number.isFinite(ttychar) ? Math.trunc(Number(ttychar)) : null,
      color: Number.isFinite(color) ? Math.trunc(Number(color)) : null,
      tileIndex:
        Number.isFinite(tileIndex) && Number(tileIndex) >= 0
          ? Math.trunc(Number(tileIndex))
          : null,
    };
  }

  readGlobalValue(path) {
    const globals =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals || typeof globals !== "object") {
      return null;
    }
    const globalsRoot =
      globals.g && typeof globals.g === "object" ? globals.g : globals;
    const readFrom = (root) => {
      if (!root || typeof root !== "object") {
        return null;
      }
      let current = root;
      for (const key of path) {
        if (!current || typeof current !== "object") {
          return null;
        }
        current = current[key];
      }
      return current;
    };
    const direct = readFrom(globals);
    if (direct !== null && direct !== undefined) {
      return direct;
    }
    if (globalsRoot !== globals) {
      const nested = readFrom(globalsRoot);
      if (nested !== null && nested !== undefined) {
        return nested;
      }
    }
    return null;
  }

  resolveRuntimeExportedPointer(name) {
    if (!name) {
      return null;
    }

    const pointers =
      globalThis.nethackGlobal &&
        globalThis.nethackGlobal.pointers &&
        typeof globalThis.nethackGlobal.pointers === "object"
        ? globalThis.nethackGlobal.pointers
        : null;
    if (!pointers) {
      return null;
    }

    const raw = pointers[name];
    return this.normalizeWasmPointer(raw, {
      label: `exported_pointer_${name}`,
      minBytes: 1,
      alignment: 1,
    });
  }

  readHeapCString(ptr, maxLength = 128) {
    if (
      !this.deps.coordinator.nethackModule ||
      !Number.isInteger(ptr) ||
      ptr <= 0
    ) {
      return "";
    }

    const normalizedPtr = this.normalizeWasmPointer(ptr, {
      label: "heap_cstring_ptr",
      minBytes: 1,
      alignment: 1,
      enforceBounds: true,
    });
    if (!normalizedPtr) {
      return "";
    }

    let text = "";
    if (typeof this.deps.coordinator.nethackModule.UTF8ToString === "function") {
      try {
        text = String(this.deps.coordinator.nethackModule.UTF8ToString(normalizedPtr, maxLength) || "");
      } catch (_error) {
        text = "";
      }
    }
    if (!text && this.deps.coordinator.nethackModule.HEAPU8) {
      const heap = this.deps.coordinator.nethackModule.HEAPU8;
      if (normalizedPtr < heap.length) {
        const end = Math.min(heap.length, normalizedPtr + maxLength);
        let fallbackText = "";
        for (let i = normalizedPtr; i < end; i++) {
          const code = heap[i];
          if (code === 0) {
            break;
          }
          fallbackText += String.fromCharCode(code);
        }
        text = fallbackText;
      }
    }
    if (!text) {
      return "";
    }

    const truncated = text.slice(0, maxLength);
    for (let i = 0; i < truncated.length; i += 1) {
      const code = truncated.charCodeAt(i);
      if (code < 32 || code > 126) {
        return "";
      }
    }
    return truncated;
  }

  decodeShimArgValue(name, ptrToArg, type) {
    if (
      !this.deps.coordinator.nethackModule ||
      typeof this.deps.coordinator.nethackModule.getValue !== "function" ||
      !globalThis.nethackGlobal ||
      !globalThis.nethackGlobal.helpers ||
      typeof globalThis.nethackGlobal.helpers.getPointerValue !== "function"
    ) {
      return null;
    }

    const argPtr = this.deps.coordinator.nethackModule.getValue(ptrToArg, "*");
    return globalThis.nethackGlobal.helpers.getPointerValue(name, argPtr, type);
  }

  normalizeRuntimeInteger(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    const clean = String(value ?? "").trim();
    if (!clean) {
      return null;
    }
    if (/^-?\d+$/.test(clean)) {
      const parsed = Number.parseInt(clean, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  installHelperCompatibilityShims() {
    if (
      !globalThis.nethackGlobal ||
      !globalThis.nethackGlobal.helpers ||
      typeof globalThis.nethackGlobal.helpers.getPointerValue !== "function"
    ) {
      return;
    }

    const helpers = globalThis.nethackGlobal.helpers;
    const existing = helpers.getPointerValue;
    if (existing && existing.__nh3dVoidCompatPatched) {
      return;
    }

    const wrapped = (name, ptr, type) => {
      if (type === "v") {
        return 0;
      }
      return existing(name, ptr, type);
    };
    wrapped.__nh3dVoidCompatPatched = true;
    helpers.getPointerValue = wrapped;
  }

  unpackGlyphArgs(args: number[]) {
    // Default (older runtimes): [win, x, y, glyph]
    const [win, x, y, a, b] = args;

    if (this.deps.coordinator.runtimeVersion !== "5.0") {
      return { win, x, y, glyph: a, mgflags: 0, extra: b };
    }

    // 5.0: callback often comes as [win, x, y, packed, extra]
    // packed: hi16 = flags, lo16 = glyph
    let glyph = a;
    let mgflags = 0;

    if (glyph > 0xffff) {
      mgflags = (glyph >>> 16) & 0xffff;
      glyph = glyph & 0xffff;
    }

    return { win, x, y, glyph, mgflags, extra: b };
  }
}
