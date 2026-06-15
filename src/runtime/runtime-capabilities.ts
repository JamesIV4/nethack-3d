import type { NethackRuntimeVersion } from "./types";

// Temporary kill-switch for EvilHack checkpoint autosave resume. The EvilHack
// IDBFS save path still has rough edges (see save-storage.ts notes), so we
// hide checkpoint-based recovery from the loadable-save UI for that runtime
// until it stabilises. NetHack 5 and SlashEM checkpoint recovery is enabled
// unconditionally (upstream wired them up in 1.3.3+).
const ENABLE_RUNTIME_EVILHACK_CHECKPOINT_RECOVERY = false;

function readDefinedBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}

export function hasRuntimeCheckpointRecoveryPrimitiveExport(
  runtimeVersion: NethackRuntimeVersion,
): boolean {
  if (runtimeVersion === "5.0") {
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_5_HAS_RECOVER_SAVEFILE,
    );
  }
  if (runtimeVersion === "slashem") {
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_SLASHEM_HAS_RECOVER_SAVEFILE,
    );
  }
  if (runtimeVersion === "evilhack") {
    if (!ENABLE_RUNTIME_EVILHACK_CHECKPOINT_RECOVERY) {
      return false;
    }
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_EVILHACK_HAS_RECOVER_SAVEFILE,
    );
  }
  if (runtimeVersion === "3.6.7") {
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_367_HAS_RECOVER_SAVEFILE,
    );
  }
  return false;
}

export function supportsRuntimeCheckpointRecovery(
  runtimeVersion: NethackRuntimeVersion,
): boolean {
  if (runtimeVersion === "5.0") {
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_5_HAS_CHECKPOINT_RESUME_BRIDGE,
    );
  }
  if (runtimeVersion === "slashem") {
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_SLASHEM_HAS_CHECKPOINT_RESUME_BRIDGE,
    );
  }
  if (runtimeVersion === "evilhack") {
    if (!ENABLE_RUNTIME_EVILHACK_CHECKPOINT_RECOVERY) {
      return false;
    }
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_EVILHACK_HAS_CHECKPOINT_RESUME_BRIDGE,
    );
  }
  if (runtimeVersion === "3.6.7") {
    // recover_savefile() by itself is only the low-level converter from
    // checkpoint shards to a real save file. Browser hosts also need an explicit
    // pre-main bridge that can prepare lock state and invoke recovery before the
    // normal 3.6.7 startup path reaches unixunix.c/getlock().
    return readDefinedBoolean(
      import.meta.env.VITE_NH3D_WASM_367_HAS_CHECKPOINT_RESUME_BRIDGE,
    );
  }
  return false;
}
