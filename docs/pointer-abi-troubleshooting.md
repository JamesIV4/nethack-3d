# NetHack WASM Pointer ABI Troubleshooting

This document explains the current first-class pointer path for `3.6.7`, `5.0`, and `slashem`, what can break across WASM updates, and how to fix it quickly.

## Current First-Class Path (3.6.7 + 5.0 + Slash'EM)

The runtime resolves extended commands from the WASM-exported extcmd table.

1. Read table base from `globalThis.nethackGlobal.pointers.extcmdlist`.
2. Resolve base pointer mode from contract (`direct_or_slot` by default).
3. Decode rows with extcmd ABI layout (`stride`, `textPtrOffset`, `flagsOffset`).
4. Validate decoded entries (`minEntries`, required command names).
5. Resolve typed `#command` by exact name, then unique prefix.

If validation fails, command resolution fails closed (`-1`), never guessed indices.

## What Is Hard-Coded vs Runtime-Driven

Runtime-driven:
- Pointer values (`nethackGlobal.pointers.*`).
- Actual command names and order (decoded from WASM memory).

Hard-coded ABI profile (current design):
- extcmd ABI layout defaults:
  - `3.6.7` / `5.0`: `stride=24`, `textPtrOffset=4`, `flagsOffset=16`, `exportedPointerMode=direct_or_slot`
  - `slashem`: `stride=16`, `textPtrOffset=0`, `flagsOffset=12`, `exportedPointerMode=direct_or_slot`
- Callback arg shape defaults:
  - `3.6.7`: `shim_add_menu: [8]`, `shim_print_glyph: [4, 5, 7]`.
  - `slashem`: `shim_add_menu: [8]`, `shim_print_glyph: [4, 6]`.
  - `5.0`: `shim_add_menu: [9]` (`vipi00iisi`), `shim_print_glyph: [5, 7]` (`vi11pp`, tracked build appends `monsterId` and `attackingTargetId`).
- Callback mode defaults:
  - `3.6.7`: `shim_nh_poskey.coordArgType=i32`.
  - `5.0`: `shim_nh_poskey.coordArgType=i16` (`coordxy` widened from 8-bit-era assumptions to `int16_t` in 5.0).
  - `3.6.7`: `shim_add_menu.identifierMode=pointer_slot`.
  - `5.0`: `shim_add_menu.identifierMode=value`, `menuTextArgIndex=7`, `itemFlagsArgIndex=8`.
- `menu_item` ABI defaults:
  - `3.6.7`: `stride=8`, `countOffset=4`.
  - `5.0`: `stride=16`, `countOffset=8`, `itemFlagsOffset=12`.
    (`anything` in 5.0 includes `int64/uint64`, widening `struct mi` on wasm32.)

So this is not hard-coded command data, but it is a hard-coded ABI profile.

## Expected Healthy Logs

At startup:
- `Pointer contract ready (runtime=..., abi=nh...-pointer-v1)`.
- `Resolved extended command table from exported pointer "extcmdlist" (entries=..., base=..., mode=...)`.

During command execution:
- `shim_get_ext_cmd [undefined]` is expected for format `iv`.
- `Resolved extended command "<name>" to index <n>`.

## Fast Diagnostics

In DevTools:
- Run `dumpRuntimeGlobals()`.
- Confirm:
  - `nethackGlobal.pointers.extcmdlist` exists and is non-zero.
  - `runtimeVersion` is correct.

In logs, look for:
- `Unknown extended command "<name>"`.
- `Extcmd pointer contract validation failed for all bases...`.
- `No valid extcmd table base candidates...`.
- `shim_print_glyph received unexpected arg count ...`.

## Failure Modes and Fixes

### Symptom: Unknown extended commands for valid names
Likely cause:
- extcmd layout mismatch for the new build.

How to confirm:
- You see extcmd validation failure logs.
- You do not see the `Resolved extended command table...` log.

Fix:
- Update extcmd layout in `src/runtime/LocalNetHackRuntime.ts` under `buildDefaultRuntimePointerContract().extcmd`.

### Symptom: Map/tiles stop rendering or render erratically
Likely cause:
- callback arg shape changed (common: `shim_print_glyph`).

How to confirm:
- `arg-count` pointer-contract warnings in logs.

Fix:
- Update `callbackArgCounts` / `callbackModes` defaults in `buildDefaultRuntimePointerContract()`.
- For `3.6.7` fork, `shim_print_glyph` may be 5 args or 7 args on tracked builds.
- For `slashem`, `shim_print_glyph` is 4 args, or 6 args on tracked builds.
- For `5.0`, `shim_add_menu` expects 9 args and `shim_print_glyph` may be 5 args or 7 args on tracked builds.

### Symptom: Menus/select actions break
Likely cause:
- `menu_item` layout mismatch.

How to confirm:
- pointer-contract warnings around menu item layout/write.

Fix:
- Update `menuItem` layout defaults (`stride`, `countOffset`, `itemFlagsOffset`).

### Symptom: Works in one build, breaks after WASM update
Likely cause:
- ABI/profile drift while app still uses the built-in defaults.

How to confirm:
- New failures begin immediately after WASM swap and extcmd/map/menu decode logs start failing.

Fix:
- Re-baseline contract defaults for that build.
- Keep pointer ABI tag aligned with build config.

## Quick Fix Procedure (When a New WASM Breaks)

1. Capture startup logs and one failed command log.
2. Run `dumpRuntimeGlobals()` and confirm `pointers.extcmdlist`.
3. Check whether extcmd table successfully resolves at startup.
4. If not, patch contract defaults in `buildDefaultRuntimePointerContract()`:
   - extcmd layout and pointer mode first
   - callback arg counts next
   - menu item layout if selection issues persist
5. Re-test:
   - `#dip`, `#wield`, one wizard command, one menu flow.

## Stability Guidance

Most `3.6.7` forks that keep `struct ext_func_tab` layout stable will work with this path without changes. Slash'EM is intentionally on its own profile because its extcmd layout and tracked `shim_print_glyph` shape differ.

It can break when:
- struct packing/field layout changes
- pointer indirection/export mode changes
- callback signatures change
- target ABI changes (for example, pointer width/alignment model)
