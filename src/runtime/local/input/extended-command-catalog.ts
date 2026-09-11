// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
const SLASHEM_META_EXTENDED_COMMAND_NAME_BY_KEY = Object.freeze({
  a: "adjust",
  b: "borrow",
  c: "chat",
  d: "dip",
  e: "enhance",
  f: "force",
  i: "invoke",
  j: "jump",
  l: "loot",
  m: "monster",
  n: "name",
  o: "offer",
  p: "pray",
  q: "quit",
  r: "rub",
  s: "sit",
  t: "technique",
  u: "untrap",
  v: "version",
  w: "wipe",
  y: "youpoly",
});
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimePointerContract } from "../abi/pointer-contract";
import type { RuntimeMemory } from "../abi/memory";

export interface RuntimeExtendedCommandCatalogDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "nethackModule"
    | "runtimeVersion"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "normalizeWasmPointer"
    | "readHeapCString"
    | "readPointerSlotValue"
    | "readRuntimeI32"
    | "readRuntimeI8"
    | "resolveRuntimeExportedPointer"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "getRuntimePointerContract"
    | "notePointerContractViolation"
  >;
}

/** Runtime extended command registry, meta bindings and pointer-contract-validated command table decoding. */
export class RuntimeExtendedCommandCatalog {
  declare extendedCommandEntries: any;

  constructor(private readonly deps: RuntimeExtendedCommandCatalogDependencies) {
    // CLICK_2 (right click)
    this.extendedCommandEntries = null;
  }

  resolveMetaBoundExtendedCommandName(metaKey) {
    if (typeof metaKey !== "string" || metaKey.length === 0) {
      return null;
    }

    const normalized = metaKey.charAt(0).toLowerCase();
    if (!/^[a-z]$/.test(normalized)) {
      return null;
    }

    const entries = this.getExtendedCommandEntries();
    if (this.deps.coordinator.runtimeVersion === "slashem") {
      // Slash'EM's extcmdlist does not store meta accelerators; those live in
      // the regular command table. Prefer the source-defined Alt bindings when
      // the corresponding extended command is available.
      const slashEmCommandName =
        SLASHEM_META_EXTENDED_COMMAND_NAME_BY_KEY[normalized];
      if (
        typeof slashEmCommandName === "string" &&
        entries.some((entry) => entry.name === slashEmCommandName)
      ) {
        return slashEmCommandName;
      }
    }

    const metaKeyCode = normalized.charCodeAt(0) | 0x80;
    const keyedEntries = entries.filter(
      (entry) => entry.keyCode === metaKeyCode,
    );
    if (keyedEntries.length === 0) {
      return null;
    }

    const preferred =
      keyedEntries.find((entry) => entry.name !== "#" && entry.name !== "?") ||
      keyedEntries[0];
    return preferred && typeof preferred.name === "string"
      ? preferred.name
      : null;
  }

  getExtendedCommandEntries() {
    if (
      Array.isArray(this.extendedCommandEntries) &&
      this.extendedCommandEntries.length > 0
    ) {
      return this.extendedCommandEntries;
    }

    const extracted = this.extractExtendedCommandEntriesFromMemory();
    if (extracted.length > 0) {
      this.extendedCommandEntries = extracted;
      return extracted;
    }

    // Fail closed instead of inventing an inferred/fallback table that can
    // misroute commands after a wasm update.
    this.extendedCommandEntries = [];
    return this.extendedCommandEntries;
  }

  emitExtendedCommands(source = "runtime") {
    if (!this.deps.coordinator.eventHandler) {
      return;
    }

    const entries = this.getExtendedCommandEntries();
    const uniqueNames = [];
    const seen = new Set();
    for (const entry of entries) {
      const name = String(entry?.name || "")
        .trim()
        .toLowerCase();
      if (!name || name === "#" || name === "?" || seen.has(name)) {
        continue;
      }
      seen.add(name);
      uniqueNames.push(name);
    }

    this.deps.coordinator.emit({
      type: "extended_commands",
      commands: uniqueNames,
      source,
    });
  }

  extractExtendedCommandEntriesFromMemory() {
    if (
      !this.deps.coordinator.nethackModule ||
      typeof this.deps.coordinator.nethackModule.getValue !== "function"
    ) {
      return [];
    }

    const extcmdContract = this.deps.pointerContract.getRuntimePointerContract()?.extcmd || {};
    const exportedPointerName =
      typeof extcmdContract.exportedPointerName === "string" &&
        extcmdContract.exportedPointerName.trim()
        ? extcmdContract.exportedPointerName.trim()
        : "extcmdlist";
    const exportedPointerValue = this.deps.memory.resolveRuntimeExportedPointer(
      exportedPointerName,
    );
    if (!exportedPointerValue) {
      console.log(
        `Missing runtime pointer contract export "${exportedPointerName}"; extended commands are unavailable for this wasm build.`,
      );
      return [];
    }

    const exportedPointerMode =
      extcmdContract.exportedPointerMode === "slot"
        ? "slot"
        : extcmdContract.exportedPointerMode === "direct"
          ? "direct"
          : "direct_or_slot";
    const candidateBases = [];
    const pushCandidateBase = (value) => {
      const normalized = this.deps.memory.normalizeWasmPointer(value, {
        label: `${exportedPointerName}_candidate_base`,
        minBytes: 1,
        alignment: 4,
      });
      if (!normalized || candidateBases.includes(normalized)) {
        return;
      }
      candidateBases.push(normalized);
    };
    if (exportedPointerMode !== "slot") {
      pushCandidateBase(exportedPointerValue);
    }
    if (exportedPointerMode !== "direct") {
      const slotValue = this.deps.memory.readPointerSlotValue(
        exportedPointerValue,
        `${exportedPointerName}_slot`,
        true,
      );
      pushCandidateBase(slotValue);
    }
    if (candidateBases.length === 0) {
      console.log(
        `No valid extcmd table base candidates for exported pointer "${exportedPointerName}" (${exportedPointerValue})`,
      );
      return [];
    }

    const candidateResults = [];
    for (const basePtr of candidateBases) {
      const entries = this.readExtendedCommandEntriesFromBase(
        basePtr,
        extcmdContract,
      );
      const looksValid = this.validateExtendedCommandEntries(
        entries,
        extcmdContract,
      );
      candidateResults.push({
        basePtr,
        entriesLength: entries.length,
        looksValid,
      });
      if (!looksValid) {
        continue;
      }
      console.log(
        `Resolved extended command table from exported pointer "${exportedPointerName}"`,
        {
          entries: entries.length,
          base: basePtr,
          mode: exportedPointerMode,
          commands: entries.map((entry) => entry.name),
        },
      );
      return entries;
    }

    console.log(
      `Extcmd pointer contract validation failed for all bases derived from "${exportedPointerName}"`,
      candidateResults,
    );
    return [];
  }

  readExtendedCommandEntriesFromBase(extcmdlistPtr, extcmdContract = {}) {
    if (
      !this.deps.coordinator.nethackModule ||
      typeof this.deps.coordinator.nethackModule.getValue !== "function"
    ) {
      return [];
    }
    const stride = Number(extcmdContract.stride);
    const textPtrOffset = Number(extcmdContract.textPtrOffset);
    const flagsOffset = Number(extcmdContract.flagsOffset);
    const maxEntries = Number(extcmdContract.maxEntries) || 512;
    if (
      !Number.isInteger(stride) ||
      stride < 8 ||
      !Number.isInteger(textPtrOffset) ||
      textPtrOffset < 0 ||
      textPtrOffset + 4 > stride ||
      !Number.isInteger(flagsOffset) ||
      flagsOffset < 0 ||
      flagsOffset + 4 > stride
    ) {
      this.deps.pointerContract.notePointerContractViolation(
        "extcmd-layout-invalid",
        "Extended command layout is invalid in the runtime pointer contract.",
        { stride, textPtrOffset, flagsOffset },
      );
      return [];
    }

    const entries = [];
    for (let index = 0; index < maxEntries; index++) {
      const offset = extcmdlistPtr + index * stride;
      if (!Number.isFinite(offset) || offset <= 0) {
        break;
      }

      const keyCode = this.deps.memory.readRuntimeI8(
        offset,
        `extcmd_${index}_key`,
        true,
      );
      const textPtr = this.deps.memory.readRuntimeI32(
        offset + textPtrOffset,
        `extcmd_${index}_text_ptr`,
      );
      if (!Number.isInteger(textPtr) || textPtr <= 0) {
        // Sentinel row has ef_txt == NULL.
        break;
      }

      const name = this.deps.memory.readHeapCString(textPtr, 64);
      if (!this.isLikelyExtendedCommandName(name)) {
        if (index === 0) {
          return [];
        }
        break;
      }

      const flags = this.deps.memory.readRuntimeI32(
        offset + flagsOffset,
        `extcmd_${index}_flags`,
      );
      entries.push({
        index,
        name: name.toLowerCase(),
        keyCode: Number.isInteger(keyCode) ? keyCode : 0,
        flags: Number.isInteger(flags) ? flags : 0,
      });
    }

    return entries;
  }

  validateExtendedCommandEntries(entries, extcmdContract = {}) {
    const minEntries = Number(extcmdContract.minEntries) || 10;
    const requiredNames = Array.isArray(extcmdContract.requiredNames)
      ? extcmdContract.requiredNames
      : ["#", "pray"];
    const normalizedRequiredNames = requiredNames
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value.length > 0);
    const looksValid =
      entries.length >= minEntries &&
      normalizedRequiredNames.every((requiredName) =>
        entries.some((entry) => entry.name === requiredName),
      );
    return looksValid;
  }

  isLikelyExtendedCommandName(name) {
    return (
      typeof name === "string" &&
      name.length > 0 &&
      name.length <= 32 &&
      /^[A-Za-z0-9_?#-]+$/.test(name)
    );
  }
}
