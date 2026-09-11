// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeMemory } from "./memory";

export interface RuntimePointerContractDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "runtimeVersion"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "normalizeWasmPointer"
  >;
}

/** Runtime pointer layout and callback ABI validation. */
export class RuntimePointerContract {
  declare runtimePointerContract: any;
  declare runtimePointerContractValidated: boolean;
  declare pointerContractViolationKeys: Set<string>;

  constructor(private readonly deps: RuntimePointerContractDependencies) {
    this.runtimePointerContract = null;
    this.runtimePointerContractValidated = false;
    this.pointerContractViolationKeys = new Set();
  }

  normalizePointerAbiTag(value, fallback = "") {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  readConfiguredPointerAbiTag(runtimeVersion = this.deps.coordinator.runtimeVersion) {
    const fallback =
      runtimeVersion === "5.0"
        ? "nh5-pointer-v1"
        : runtimeVersion === "slashem"
          ? "slashem-pointer-v1"
          : "nh367-pointer-v1";
    const rawValue =
      runtimeVersion === "5.0"
        ? import.meta.env.VITE_NH3D_WASM_5_POINTER_ABI_TAG
        : runtimeVersion === "slashem"
          ? import.meta.env.VITE_NH3D_WASM_SLASHEM_POINTER_ABI_TAG
          : import.meta.env.VITE_NH3D_WASM_367_POINTER_ABI_TAG;
    return this.normalizePointerAbiTag(rawValue, fallback);
  }

  readRuntimeExportedPointerAbiTag() {
    const root =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal
        : null;
    if (!root) {
      return "";
    }

    const constants =
      root.constants && typeof root.constants === "object"
        ? root.constants
        : null;
    const nh3dConstants =
      constants &&
        constants.NH3D &&
        typeof constants.NH3D === "object"
        ? constants.NH3D
        : null;
    const rawValue =
      (nh3dConstants &&
        (nh3dConstants.POINTER_ABI_TAG ?? nh3dConstants.pointer_abi_tag)) ||
      root.pointerAbiTag ||
      root.pointerAbi ||
      "";
    return this.normalizePointerAbiTag(rawValue, "");
  }

  buildDefaultRuntimePointerContract(runtimeVersion = this.deps.coordinator.runtimeVersion) {
    const is5 = runtimeVersion === "5.0";
    const isSlashEm = runtimeVersion === "slashem";
    const addMenuArgCounts = is5 ? [9] : [8];
    const printGlyphArgCounts = is5 ? [5, 7] : isSlashEm ? [4, 6] : [4, 5, 7];
    return {
      abiTag: this.readConfiguredPointerAbiTag(runtimeVersion),
      callbackArgCounts: {
        shim_nh_poskey: [3],
        shim_getlin: [2],
        shim_select_menu: [3],
        shim_add_menu: addMenuArgCounts,
        // Forked wasm-367 emits [win, x, y, glyph, bkglyph] (5 args) and the
        // tracked build extends that to [win, x, y, glyph, bkglyph,
        // monsterId, attackingTargetId] (7 args), where monsterId is >0 for
        // tracked monsters and 0 for the player tile when supported.
        // Slash'EM emits [win, x, y, glyph] (4 args) and the tracked build
        // extends that to [win, x, y, glyph, monsterId, attackingTargetId]
        // (6 args), because this shim signature has no background glyph arg.
        // 5.0 emits [win, x, y, glyphinfo_ptr, bkglyphinfo_ptr] (5 args),
        // and the tracked build extends that to [win, x, y, glyphinfo_ptr,
        // bkglyphinfo_ptr, monsterId, attackingTargetId] (7 args), where
        // monsterId is >0 for tracked monsters and 0 for the player tile.
        // Keep 4-arg compatibility only for alternate 3.6.7 builds.
        shim_print_glyph: printGlyphArgCounts,
        shim_monster_attack: [4],
        shim_monster_killed: [4],
        shim_status_update: [6],
      },
      callbackPointers: {
        shim_nh_poskey: [
          { index: 0, label: "x_ptr", bytes: 4, alignment: 1, required: true },
          { index: 1, label: "y_ptr", bytes: 4, alignment: 1, required: true },
          {
            index: 2,
            label: "mod_ptr",
            bytes: 4,
            alignment: 1,
            required: true,
          },
        ],
        shim_getlin: [
          {
            index: 1,
            label: "text_buffer_ptr",
            bytes: 1,
            alignment: 1,
            required: true,
          },
        ],
        shim_select_menu: [
          {
            index: 2,
            label: "menu_list_ptr_ptr",
            bytes: 4,
            alignment: 4,
            required: true,
          },
        ],
        ...(is5
          ? {
            shim_add_menu: [
              {
                index: 1,
                label: "menu_glyphinfo_ptr",
                bytes: 36,
                alignment: 4,
                required: false,
              },
            ],
            shim_print_glyph: [
              {
                index: 3,
                label: "print_glyphinfo_ptr",
                bytes: 36,
                alignment: 4,
                required: true,
              },
            ],
          }
          : {
            shim_add_menu: [
              {
                index: 2,
                label: "menu_identifier_ptr",
                bytes: 4,
                alignment: 4,
                required: false,
              },
            ],
          }),
        shim_status_update: [
          {
            index: 1,
            label: "status_ptr_to_arg",
            bytes: 1,
            alignment: 1,
            required: false,
          },
        ],
      },
      callbackModes: {
        shim_nh_poskey: {
          pointerArgsAreDirect: true,
          coordArgType: is5 ? "i16" : "i32",
        },
        shim_getlin: {
          pointerArgsAreDirect: true,
        },
        shim_select_menu: {
          pointerArgsAreDirect: true,
          menuListMode: "pointer_to_pointer",
        },
        shim_add_menu: {
          identifierMode: is5 ? "value" : "pointer_slot",
          menuTextArgIndex: is5 ? 7 : 6,
          itemFlagsArgIndex: is5 ? 8 : 7,
          glyphArgMode: is5 ? "glyphinfo_ptr" : "glyph_value",
        },
        shim_print_glyph: {
          glyphArgMode: is5 ? "glyphinfo_ptr" : "glyph_value",
          trackedEntityArgIndex: is5 ? 5 : isSlashEm ? 4 : 5,
          attackingTargetArgIndex: is5 ? 6 : isSlashEm ? 5 : 6,
        },
      },
      extcmd: {
        exportedPointerName: "extcmdlist",
        exportedPointerMode: "direct_or_slot",
        stride: isSlashEm ? 16 : 24,
        textPtrOffset: isSlashEm ? 0 : 4,
        flagsOffset: isSlashEm ? 12 : 16,
        maxEntries: 512,
        minEntries: isSlashEm ? 20 : 10,
        requiredNames: isSlashEm ? ["2weapon", "pray"] : ["#", "pray"],
      },
      menuItem: {
        // NetHack 5.0's `anything` union includes int64/uint64 members, so
        // `struct mi` (menu_item) is widened versus 3.6.x on wasm32.
        // Layout used by select_menu() output in wasm-5:
        //   item @ +0, count @ +8, itemflags @ +12, sizeof(menu_item) == 16.
        stride: is5 ? 16 : 8,
        countOffset: is5 ? 8 : 4,
        itemFlagsOffset: is5 ? 12 : null,
      },
      glyphInfo: is5
        ? {
          minBytes: 36,
          glyphOffset: 0,
          ttyCharOffset: 4,
          colorOffset: 16,
          tileIndexOffset: 30,
          tileIndexType: "i16",
          pointerAlignment: 4,
        }
        : null,
    };
  }

  resolveRuntimePointerContract() {
    const defaults = this.buildDefaultRuntimePointerContract(this.deps.coordinator.runtimeVersion);
    return defaults;
  }

  getRuntimePointerContract() {
    if (!this.runtimePointerContract) {
      this.runtimePointerContract = this.resolveRuntimePointerContract();
    }
    return this.runtimePointerContract;
  }

  validateRuntimePointerContract() {
    if (this.runtimePointerContractValidated) {
      return true;
    }

    const contract = this.getRuntimePointerContract();
    if (!contract || typeof contract !== "object") {
      throw new Error("Missing runtime pointer contract.");
    }

    const configuredAbiTag = this.readConfiguredPointerAbiTag(this.deps.coordinator.runtimeVersion);
    const runtimeAbiTag = this.readRuntimeExportedPointerAbiTag();
    if (
      runtimeAbiTag &&
      configuredAbiTag &&
      runtimeAbiTag !== configuredAbiTag
    ) {
      throw new Error(
        `WASM pointer ABI tag mismatch (runtime=${runtimeAbiTag}, configured=${configuredAbiTag}).`,
      );
    }

    const extcmd = contract.extcmd || {};
    const extcmdStride = Number(extcmd.stride);
    const extcmdTextPtrOffset = Number(extcmd.textPtrOffset);
    const extcmdFlagsOffset = Number(extcmd.flagsOffset);
    if (
      !Number.isInteger(extcmdStride) ||
      extcmdStride < 8 ||
      !Number.isInteger(extcmdTextPtrOffset) ||
      extcmdTextPtrOffset < 0 ||
      extcmdTextPtrOffset + 4 > extcmdStride ||
      !Number.isInteger(extcmdFlagsOffset) ||
      extcmdFlagsOffset < 0 ||
      extcmdFlagsOffset + 4 > extcmdStride
    ) {
      throw new Error("Invalid extcmd layout in pointer contract.");
    }

    const menuItem = contract.menuItem || {};
    const menuStride = Number(menuItem.stride);
    const menuCountOffset = Number(menuItem.countOffset);
    const menuItemFlagsOffset =
      menuItem.itemFlagsOffset === null || menuItem.itemFlagsOffset === undefined
        ? null
        : Number(menuItem.itemFlagsOffset);
    if (
      !Number.isInteger(menuStride) ||
      menuStride < 8 ||
      !Number.isInteger(menuCountOffset) ||
      menuCountOffset < 0 ||
      menuCountOffset + 4 > menuStride ||
      (menuItemFlagsOffset !== null &&
        (!Number.isInteger(menuItemFlagsOffset) ||
          menuItemFlagsOffset < 0 ||
          menuItemFlagsOffset + 4 > menuStride))
    ) {
      throw new Error("Invalid menu_item layout in pointer contract.");
    }

    const poskeyMode = contract.callbackModes?.shim_nh_poskey || null;
    if (
      poskeyMode &&
      poskeyMode.coordArgType !== undefined &&
      poskeyMode.coordArgType !== "i8" &&
      poskeyMode.coordArgType !== "i16" &&
      poskeyMode.coordArgType !== "i32"
    ) {
      throw new Error("Invalid nh_poskey coord type in pointer contract.");
    }

    const glyphInfo = contract.glyphInfo;
    if (glyphInfo && typeof glyphInfo === "object") {
      const minBytes = Number(glyphInfo.minBytes);
      const glyphOffset = Number(glyphInfo.glyphOffset);
      const pointerAlignment =
        glyphInfo.pointerAlignment === undefined
          ? 1
          : Number(glyphInfo.pointerAlignment);
      if (
        !Number.isInteger(minBytes) ||
        minBytes < 8 ||
        !Number.isInteger(glyphOffset) ||
        glyphOffset < 0 ||
        glyphOffset + 4 > minBytes ||
        !Number.isInteger(pointerAlignment) ||
        pointerAlignment <= 0
      ) {
        throw new Error("Invalid glyphInfo layout in pointer contract.");
      }
    }

    this.runtimePointerContractValidated = true;
    console.log(
      `Pointer contract ready (runtime=${this.deps.coordinator.runtimeVersion}, abi=${contract.abiTag || configuredAbiTag})`,
    );
    return true;
  }

  notePointerContractViolation(key, message, details = null) {
    if (!key || this.pointerContractViolationKeys.has(key)) {
      return;
    }
    this.pointerContractViolationKeys.add(key);
    if (details) {
      console.warn(`[POINTER_CONTRACT] ${message}`, details);
      return;
    }
    console.warn(`[POINTER_CONTRACT] ${message}`);
  }

  validateCallbackPointerContract(name, args) {
    const contract = this.getRuntimePointerContract();
    if (!contract) {
      return true;
    }

    const expectedCounts = Array.isArray(contract.callbackArgCounts?.[name])
      ? contract.callbackArgCounts[name]
      : [];
    if (expectedCounts.length > 0 && !expectedCounts.includes(args.length)) {
      this.notePointerContractViolation(
        `arg-count-${name}`,
        `${name} received unexpected arg count ${args.length} (expected ${expectedCounts.join(", ")}).`,
      );
      return false;
    }

    const pointerSpecs = Array.isArray(contract.callbackPointers?.[name])
      ? contract.callbackPointers[name]
      : [];
    for (const pointerSpec of pointerSpecs) {
      const ptrValue = args[pointerSpec.index];
      const normalized = this.deps.memory.normalizeWasmPointer(ptrValue, {
        allowZero: !pointerSpec.required,
        alignment:
          Number.isInteger(pointerSpec.alignment) && pointerSpec.alignment > 0
            ? pointerSpec.alignment
            : 1,
        minBytes:
          Number.isInteger(pointerSpec.bytes) && pointerSpec.bytes > 0
            ? pointerSpec.bytes
            : 1,
        label: `${name}:${pointerSpec.label || pointerSpec.index}`,
      });
      if (pointerSpec.required && !normalized) {
        this.notePointerContractViolation(
          `arg-pointer-${name}-${pointerSpec.index}`,
          `${name} received invalid pointer at arg ${pointerSpec.index} (${pointerSpec.label || "pointer"}).`,
        );
        return false;
      }
    }

    return true;
  }

  getSafeCallbackDefaultReturn(name) {
    switch (name) {
      case "shim_get_ext_cmd":
        return -1;
      case "shim_nh_poskey":
      case "shim_nhgetch":
      case "shim_yn_function":
        return 27;
      default:
        return 0;
    }
  }
}
