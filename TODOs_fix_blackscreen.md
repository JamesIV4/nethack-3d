# EvilHack Black Screen — Root Cause Analysis & Fix TODO

## Status: PHASE 1 FIXED, PHASE 2 — silent hang inside `_main` (June 2, 2026 update)

---

## UPDATE June 2, 2026 — Post-relink state

### What WORKS now (after `phase3-relink.sh`):
- `evilhack.wasm` is 11.6 MB and embeds the full `wasm-data/` (nhdat 2 MB, dungeon, quest.dat, data, rumors, oracles, license, sysconf, etc. — see `imported/evilhack-wasm/build/EvilHack-0.9.2_wasm/EvilHack-0.9.2/wasm-data/`).
- `phase3-relink.sh` includes `--embed-file "$EH_BUILD/wasm-data@/"` so files land at `/` inside the virtual FS.
- All required exports present (`_main`, `_shim_graphics_set_callback`, `_mapglyph`, `_nh_wasm_init`, …).
- Module factory returns ES6 default; runtime imports cleanly.
- `_main` is invoked. Startup proceeds: `shim_number_pad` → `shim_status_init` → 21× `shim_status_enablefield` → `shim_init_nhwindows` → 4× `shim_create_nhwindow` → `shim_display_nhwindow` × 3 (non-blocking) → `shim_player_selection` (auto-resolved from NETHACKOPTIONS) → `shim_update_inventory` → `shim_display_file "news"` (not bundled, returns 0).

### Where it BREAKS:
**Silence after `shim_display_file news`.** No further callback ever arrives — no `shim_cliparound`, no `shim_print_glyph`, no `shim_raw_print`, no `shim_askname`, no error, no `[WASM stderr]`, no `quit` hook.

### Slashem comparison (working reference, same code path):
After `shim_display_file news`, Slashem emits in order:
1. `shim_cliparound 76,10` (player position established)
2. `shim_clear_nhwindow 3` (map window)
3. **24× `shim_print_glyph`** — initial room render
4. Status flush (`BL_FLUSH`)
5. `shim_create_nhwindow 4` + many `shim_putstr` for the role lore ("It is written in the Book of Frost…")
6. `shim_display_nhwindow 4, true` ← blocking lore popup
7. After keypress: `shim_raw_print "Hello [name], welcome to SlashEM!"` + `shim_nh_poskey`

EvilHack should go through the same sequence (NetHack 3.6.x `moveloop()` init → `init_dungeons()` → first level placement → cliparound → glyphs). It executes **none** of these.

### What we ruled out:
- ❌ Missing data files — embed-file works, 11.6 MB binary, dat files included
- ❌ Silent `exit()` — no `quit` hook fired, no `[WASM stderr]`
- ❌ C-side panic to stderr — `printErr` is captured to `console.warn("[WASM stderr]")`, nothing appeared
- ❌ Helpers missing — `mapglyphHelper` was confirmed by Slashem run

### Working hypothesis:
EvilHack hangs **inside `_main`**, blocked on something asyncify-related. Most likely candidates:
1. **EvilHack-specific shim callback** invoked via the function-table but **not in `ASYNCIFY_IMPORTS`** → asyncify never unwinds and the call returns a sentinel that the C side treats as "wait forever". EvilHack added callbacks beyond stock 3.6.7 (e.g. `shim_status_update` with bonus fields, or new outrip variants).
2. **`stdin()` read inside `init_dungeons()`** — if EvilHack adds a `getchar()` somewhere on the dlb path, our `consumeStdinByte` returns `null` which Emscripten interprets as EOF, but if asyncify unwinds the read, it may never resume.
3. **An infinite loop in EvilHack's `init_dungeons()`** due to missing/empty `serverseed`, `vaults.dat`, or a parse error in `dungeon` file — but with no stderr it would have to be a pure busy loop (unlikely).

### Browser console FS dump came back all-`undefined`:
The user ran `globalThis.Module?.FS.readdir('/')` from the **main thread** console. The runtime runs in `runtime-worker.ts` so `Module`, `FS`, `calledMain`, `exitStatus` live in the worker's `globalThis`, not the page's. → We need a **worker-side** diagnostic (TODO 8 below).

---

---

## Root Cause: Wrong WASM Build (Minified Export Names)

The current `public/evilhack.wasm` was linked without the correct `EXPORTED_FUNCTIONS` flags.
All critical functions are exported under **minified single-letter names** instead of their proper C names:

| C function              | Expected export     | Actual export |
|-------------------------|---------------------|---------------|
| `main`                  | `_main`             | `"R"`         |
| `shim_graphics_set_callback` | `_shim_graphics_set_callback` | `"S"` |
| `nh_wasm_init`          | `_nh_wasm_init`     | `"T"`         |
| `mapglyph`              | `_mapglyph`         | `"Q"`         |

**Consequence chain:**
1. `LocalNetHackRuntime.ts` calls `this.nethackInstance._main(1, argvPtr)` → `_main` is undefined → TypeError at startup
2. `cwrap("shim_graphics_set_callback", ...)` → undefined → JS callback never registered
3. Game never starts → no `shim_print_glyph` calls → zero glyphs → black screen
4. All status at defaults = stale Slashem state from previous session (UI not reset)

**Verified with:**
```bash
wasm-objdump -j Export -x public/evilhack.wasm | grep -E "mapglyph|main|nh_wasm|shim_graphics"
# Output: exported as single letters Q, R, S, T — not as _main etc.
```

---

## Fix: Re-link with phase3-relink.sh

The script `imported/evilhack-wasm/phase3-relink.sh` already has the correct flags:
- `-s MODULARIZE=1 -s EXPORT_ES6=1 -s ASYNCIFY=1`
- `-s EXPORTED_FUNCTIONS=["_main","_shim_graphics_set_callback","_mapglyph","_glyph_to_tile","_nh_wasm_init",...]`

122 .o files and `wasm-data/` are in place.

### TODO 1 — [x] Run phase3-relink.sh and copy outputs (DONE)
```bash
cd /home/simon/repos/nethack-3d
source emsdk/emsdk_env.sh
cd imported/evilhack-wasm
bash phase3-relink.sh
# Then copy:
cp build/EvilHack-0.9.2_wasm/EvilHack-0.9.2/src/evilhack.js  ../../public/evilhack.js
cp build/EvilHack-0.9.2_wasm/EvilHack-0.9.2/src/evilhack.wasm ../../public/evilhack.wasm
```

### TODO 2 — [x] Verify after relink (DONE — exports good, ES6 footer present)
```bash
# Check _main is now exported by name:
wasm-objdump -j Export -x public/evilhack.wasm | grep "_main\|_shim_graphics\|_mapglyph"
# Expected: - func[...] -> "_main", etc.

# Check evilhack.js has ES6 default export:
tail -c 60 public/evilhack.js   # should end: export default Module;
```

---

## Secondary Issues (After Binary is Fixed)

### TODO 3 — [ ] Confirm contract is NOT changed (IMPORTANT: session summary was wrong)

The session summary incorrectly claimed EvilHack sends 4-arg `shim_print_glyph`. 
**This was wrong.** Analysis of `winshim_evil.c`:
- Format string: `"vi00iii"` with `A2P = &` in EMSCRIPTEN mode
- Args passed: `{ &w, &x, &y, &glyph, &monster_id, &attacking_target_id }` = **6 args**
- Type `"0"` = i8 (xchar), `"i"` = i32 — all 6 args arrive in JS
- Current `printGlyphArgCounts = isEvilHack ? [6]` is **CORRECT — do NOT change**

### TODO 4 — [ ] Verify mapglyphHelper works after relink (MEDIUM)
After relink, `_mapglyph` will be properly exported. Verify in browser console:
```javascript
globalThis.nethackGlobal?.helpers?.mapglyphHelper?.(100, 10, 10, 0)
// Should return: { ch: <number>, color: <number>, special: <number> }
// NOT undefined or throw
```

### TODO 5 — [ ] Check glyph constants are set for EvilHack (MEDIUM)
After game loads, verify in browser console:
```javascript
globalThis.nethackGlobal?.globals
// Look for: GLYPH_UNEXPLORED_OFF, GLYPH_NOTHING_OFF, MAX_GLYPH, NO_GLYPH
// If missing → isUndiscoveredOrNothingGlyph() will never filter properly
```
EvilHack uses 3.6.7 glyph catalog. Verify `GLYPH_UNEXPLORED` value matches.

### TODO 6 — [ ] UI state reset between sessions (MEDIUM)
When switching from Slashem → EvilHack, React store retains stale Slashem player stats/name.
EvilHack shows "Test the Cooler" (Slashem Ice Mage class) which doesn't exist in EvilHack.
- Find where `game_start` / `runtime_ready` event is emitted in `LocalNetHackRuntime.ts`
- Emit a `clear_game_state` event before new runtime connects
- Or reset store fields on `runtime_version` change

### TODO 7 — [ ] NETHACKOPTIONS injection for faster testing (LOW)
To bypass the character creation menu during testing, inject player options in NETHACKOPTIONS.
Check `src/runtime/startup-init-options.ts` for the evilhack entry — add:
```
name:TestEv,role:Val,race:Hum,align:neu,gender:fem
```
This pre-selects character without needing the UI menus.

---

## Debug Logging Already in Place

These console logs are currently active and useful post-fix:
- `[GLYPH_DEBUG #N]` — logs first 5 glyph callbacks and every 200th
- `[MAPHELPER_DEBUG]` — logs mapglyphHelper availability on first glyph
- `[MAPHELPER_RESULT]` — logs first mapglyph result (glyph, tileIdx)
- `[CONTRACT_REJECT]` — logs if contract validation drops any callback
- `shim_cliparound` — logs `total glyphs: N` counter

After relink, these should confirm:
1. `[GLYPH_DEBUG #1]` appears with 6 args
2. `[MAPHELPER_DEBUG]` shows `mapglyphHelper=function` (not undefined)
3. `[MAPHELPER_RESULT]` shows a valid tileIdx
4. `shim_cliparound` shows `total glyphs: N` where N > 0

---

## Phase 2 — Silent hang inside `_main` (CURRENT FOCUS)

### TODO 8 — [x] Add worker-side post-`display_file news` FS + state diagnostic (DONE)
Patched `handleShimDisplayFile()` in `LocalNetHackRuntime.ts` to schedule a 1.5s diagnostic dump after EvilHack's optional "news" file is skipped. The dump runs in the worker context where `this.nethackInstance.FS` is reachable. It logs:
- `Module.calledMain`, `exitStatus`, `noExitRuntime`, remaining run dependencies
- `FS.readdir('/')` contents
- Presence/size of `nhdat`, `dungeon`, `quest.dat`, `data`, `rumors`, `oracles`, `license`, `sysconf`
- Count of UI callbacks received since startup (`this.uiCallbackCount`)
- Last 5 recent UI callbacks recorded by `recordRecentUICallback`

Look for the log line `[EVILHACK_HANG_DIAG]` in console.

### TODO 9 — [ ] Run EvilHack, capture `[EVILHACK_HANG_DIAG]` output (NEXT)
Reload EvilHack in the browser. ~1.5s after `DISPLAY FILE optional startup "news"` the diagnostic line appears. Three outcomes:

| `calledMain` | `exitStatus` | UI callback count growing? | Interpretation |
|---|---|---|---|
| `false` (or undef) | undef | no | **Hung inside `_main`** — asyncify or busy loop. Go to TODO 10. |
| `true` | `0` | n/a | `exit(0)` happened silently (no quit hook fire — extremely unlikely given printErr setup, but check). |
| `true` | non-zero | n/a | `exit(N)` — print which N. |
| `false` | undef | yes (growing) | Not hung, just chatty into a callback we don't notice. Inspect recent callbacks. |

Files-missing-from-FS would mean `--embed-file` didn't work; expected nhdat=2014399 etc.

### TODO 10 — [ ] If `_main` is hung: list asyncify imports and compare to EvilHack shim callbacks
EvilHack's shim may invoke a callback NOT in `ASYNCIFY_IMPORTS=["local_callback"]`. To verify:
```bash
# All callback names that EvilHack's winshim_evil.c registers / invokes
grep -nE 'callback|local_callback' imported/evilhack-wasm/evilhack/wasm-wasm/win/winshim_evil.c | head -50
# Check what's actually in ASYNCIFY_IMPORTS in the linker
grep -nE 'ASYNCIFY_IMPORTS|local_callback' imported/evilhack-wasm/phase3-relink.sh
```
If EvilHack uses a different import name (e.g. `evilhack_callback` or invokes JS via `EM_ASM`), the import must be added to `ASYNCIFY_IMPORTS`.

### TODO 11 — [ ] If FS is missing dungeon/quest.dat at `/`: investigate `--embed-file` mapping
The flag `--embed-file "$EH_BUILD/wasm-data@/"` should map files into `/nhdat`, `/dungeon`, etc. If TODO 9 shows them MISSING, change to explicit per-file embeds or check Emscripten's path normalization (some Emscripten versions require `@/somedir/` instead of `@/`).

### TODO 12 — [ ] If startup runs but EvilHack hangs in `init_dungeons()`: try a static link with debug-quality output
Build a debug variant: add `-s ASSERTIONS=2 -s SAFE_HEAP=1 -g3` to `phase3-relink.sh` and re-link as `evilhack-debug.wasm`. This will print stack traces on bad reads (e.g. unread dungeon file) instead of hanging.

---

## Phase 3 — Upstream sync (NEW, June 2, 2026)

### TODO 13 — [ ] Sync nethack-3d with upstream NH3D branch (10 releases behind)
Local working tree is ~10 releases behind the upstream NH3D repo. Need to pull and merge:
```bash
cd /home/simon/repos/nethack-3d
git fetch origin
git log --oneline HEAD..origin/main | head -40   # inspect what's coming
# Decide rebase vs merge based on local WIP commits (the EvilHack work + the
# startup-init-options.ts player_selection:prompts fix). Likely cleanest:
git stash -u   # park any uncommitted WIP if needed
git pull --rebase origin main
git stash pop  # if stashed
```
After sync, re-run `npm install` and `npm run build` in case package.json / vite config changed. Re-verify EvilHack still loads (this work may need re-application if upstream touched LocalNetHackRuntime.ts).

### TODO 14 — [ ] Pull EvilHack 0.9.3 upstream and rebuild
Current vendored copy is `imported/evilhack-wasm/EvilHack-0.9.2`. Upstream has released **0.9.3**. Steps:
1. Fetch the 0.9.3 source tarball/branch into `imported/evilhack-wasm/EvilHack-0.9.3/` (preserve 0.9.2 alongside until 0.9.3 build is verified).
2. Re-apply the WASM patches (`linux-wasm` hints fragment, `windows.c` shim_procs entry, `nh_wasm_shim.c`, `winshim_evil.c`) against the 0.9.3 tree. Diff old-vs-new sys/share/ and src/ to spot conflicts.
3. Update `imported/evilhack-wasm/LOCAL_build.wasm.sh` and `scripts/wasm/phase3-relink-evilhack.sh` (+ `phase3-relink.sh`) to point at `EvilHack-0.9.3` paths.
4. Check 0.9.3 changelog for new `winshim_*` callbacks or shim_procs[] entries — any new callback names must be added to `handleUICallback`'s switch in `LocalNetHackRuntime.ts` AND to `ASYNCIFY_IMPORTS` in the link flags.
5. Run `LOCAL_build.wasm.sh` (phase 1+2), then `phase3-relink.sh` (phase 3), then copy outputs to `public/evilhack.js` + `public/evilhack.wasm`.
6. Verify with `wasm-objdump -j Export -x public/evilhack.wasm | grep _main` and visual smoke test.
7. Once 0.9.3 builds + runs, remove the 0.9.2 tree (or keep behind a `--legacy` build flag) and update `evilhack_2_Nethack3d.md` / `EVILHACK_BUILD_GUIDE.md` accordingly.


discused in 
chat /YTk5YTE1YjItODE3Yi00YzlhLTk5NDYtOWVkYzU1ODdlZjY2 , named # building evilhack shim for node app integration
---

## June 3, 2026 — Post-first-render TODOs

### Walls render as dark/black in FPS mode
- Game now reaches main loop and renders glyphs (milestone commit d755cb3).
- In FPS / first-person 3D mode, **walls appear dark / black** with two tilesets.
- Two tilesets do render correctly otherwise (top-down view is fine).
- Likely glyph→tile-index mapping issue specific to wall glyphs for EvilHack
  (EvilHack adds glyphs vs stock 3.6.7 — wall index range may have shifted).
- Investigation starting points:
  - `src/game/glyphs/registry.ts` — glyph→material/tile resolution
  - `src/game/Nethack3DEngine.ts` — FPS wall rendering pass
  - Compare wall-glyph numeric ranges: stock NH 3.6.7 vs EvilHack `display.h`
    `GLYPH_CMAP_OFF` + `S_vwall…S_trwall` offsets.

### Walls completely absent in FPS view (June 3 screenshot)
- Updated finding: walls are not rendered at all (not dark — invisible).
  Only floor tiles + player + monster visible. Confirmed across multiple tilesets.
- **Root cause hypothesis**: `src/game/glyphs/glyph-catalog.367.generated.ts`
  hard-codes stock NH 3.6.7 offsets (`GLYPH_CMAP_OFF: 2359, endExclusive: 2446`).
  EvilHack adds many monsters/objects → its actual `GLYPH_CMAP_OFF` is higher
  (likely 2700+). Wall glyphs land outside the stock cmap range, so
  `behavior.isWall` is false and the FPS pass never creates wall meshes.
- Verification:
  1. In browser console: `nethackGlobal.constants.GLYPH_CMAP_OFF` — compare to 2359
  2. Log a print_glyph call for a known wall tile, check the glyph number
- Fix options:
  a. Generate `glyph-catalog.evilhack.generated.ts` from `public/evilhack.js`
     (run `npm run glyphs:generate` with a runtime selector — check scripts/glyphs/)
  b. Make glyph classification range-driven from `nethackGlobal.constants.*OFF`
     instead of static catalog lookup, when runtimeVersion === 'evilhack'.
  c. Quick smoke test: in `glyph-catalog.367.generated.ts` temporarily bump
     `GLYPH_CMAP_OFF` to EvilHack's actual offset and see if walls appear.

### Re-enable vaults in WASM build (deferred)
- Currently bypassed via `fnam = NULL` under `__EMSCRIPTEN__` in mklev.c makerooms().
- Root cause: vault .lev `load_special()` silently produces 0 rooms in wasm32
  (not a long-size issue per se — wasm-lev_comp output is byte-correct).
- Likely a wasm32-vs-x86_64 struct-layout mismatch deeper in `sp_level_loader`
  or `sp_level_coder` opcode handlers (alignment / padding inside `sp_lev`).
- Workaround keeps `create_room()` path; vaults absent from generated levels.
- **June 3, 2026**: same bypass re-applied to EvilHack **0.9.3** `src/mklev.c`
  `makerooms()` (around the `rndvault_getname()` call) — without it the
  post-news startup hung in `[EVILHACK_FS_OPEN_SPIN]` on `vlt-*.lev`
  (`load_special()` silently fails, `rndvault_failed` never set, `makerooms`
  loops forever picking another random vault). Knox-kludge main-dungeon vault
  (`create_vault()` branch above) is on a different path and NOT affected.
- Trade-off: **all random vaults disabled** for the wasm build. Levels still
  generate via `create_room()` fallback; just no random vault inserts.
- Proper fix: instrument `load_special()` in wasm32 to log which opcode/struct
  read fails for a `vlt-*.lev` file; compare `sizeof(sp_lev)`, `sizeof(_opvar)`
  etc. between native x86_64 and wasm32 — likely a `long`/pointer field inside
  an opcode union that lev_comp serialises without explicit width.

### Generate `glyph-catalog.evilhack.generated.ts` (June 3 follow-up)
- After loading `assets/evilhack/Absurdly Evil 93.bmp` (which has EvilHack's
  actual tile order), tiles are *mostly* correct but with consistent shifts:
  player + pet have a small harp icon below them, floor tiles render as
  stairs in some places.
- Cause: runtime glyph→tile resolution still uses `glyph-catalog.367.generated.ts`
  (or implicit slashem catalog), which doesn't account for EvilHack's added
  monster/object glyphs (gives wrong tileIndex for every glyph past the
  first inserted EvilHack monster).
- Fix: extend `scripts/glyphs/` generator to extract glyph catalog from
  `public/evilhack.js` at build time and emit `glyph-catalog.evilhack.generated.ts`,
  then wire `LocalNetHackRuntime` / `Nethack3DEngine` to pick it when
  `runtimeVersion === "evilhack"`.
- Look at `src/game/glyphs/glyph-catalog.367.generated.ts` header for source
  metadata (`sourceJsPath`, sha256) — extract step probably runs the wasm
  in node and reads `nethackGlobal.constants` + tile array.

- **June 3, 2026 — fixed**: extended generator to a 4th target. Required
  changes:
  - `winshim_evil.c` `nh_wasm_init()` now also exposes all `GLYPH_*_OFF`,
    `MAX_GLYPH`, `NO_GLYPH`, `GLYPH_INVISIBLE` via `set_const("GLYPH", …)`.
  - Generator boots evilhack with `HACKDIR=/`, `NETHACKDIR=/`,
    `EVILHACKOPTIONS=…`, `HACKOPTIONS=…` (evilhack ignores `NETHACKOPTIONS`).
  - Generator calls `Module._nh_wasm_init()` directly after `_main()` suspends
    (EvilHack defers it until `shim_init_nhwindows`, which only fires after
    the first ASYNCIFY boundary).
  - Added `"peaceful"` to `GlyphKind` (EvilHack adds `GLYPH_PEACEFUL_OFF`
    between PET and INVIS — distinct from PET).
- **June 3, 2026 — user-facing gotcha**: after regenerating the catalog,
  cached state in `localStorage["nh3d-save-presentation-v1"]` (and the
  IDBFS save store) can pin a character to the stale catalog and prevent
  fresh boot. Workaround: DevTools → Application → Local Storage → delete
  `nh3d-save-presentation-v1`. Proper fix: invalidate the presentation
  entry when its catalog sha doesn't match the loaded runtime's
  `GLYPH_CATALOG_META.sourceWasmSha256`.

### Tile pack drift for non-meshed cmap glyphs (June 3, 2026)
- After fixing the glyph catalog drift, most tiles render correctly in 3D
  mode because walls/floors/doors are replaced by 3D meshes, hiding the
  underlying tile lookup.
- Non-meshed cmap glyphs still billboard the BMP tile: **lit corridor**
  (`#`, glyph 3969), stairs, fountains, etc. These render as wrong sprites
  — e.g. lit corridor shows as an ant tile, stairs show as a tombstone.
- Root cause: wasm's compiled-in `glyph2tile[]` (in EvilHack 0.9.3 `tile.c`)
  doesn't line up with `public/assets/evilhack/Absurdly Evil 93.bmp` —
  the BMP is identically sized to the 9.2 file (29,982,776 bytes) and was
  likely just renamed without re-authoring against 0.9.3 monster/object
  additions, shifting cmap tile indices by ~7 (one BMP row).
- Verified: walls/floors/doors *do* look correct because they bypass the
  BMP path entirely (3D mesh substitution).
- Fix options (deferred):
  - (preferred) Obtain the original `tile.txt` source for the Absurdly Evil
    pack; regenerate both `tile.c` (compile into wasm) and BMP together so
    they're consistent.
  - (workaround) Author a fresh `Absurdly Evil 93.bmp` from 0.9.3 sources
    using `tile2bmp` + the 0.9.3 `tile.txt` shipped in the EvilHack tree.
  - (hack) Add a TS-side cmap-section offset shim in the renderer that
    subtracts the row delta when looking up cmap glyphs — fragile, breaks
    if any other section drifts.
- Acceptable trade-off for now: in 3D mode, only ~10 cmap symbols are
  affected and they all look "wrong but plausible". Game is fully playable.

### Extended commands not registered in EvilHack runtime (June 3)
- `#kick`, `#options`, and the new EvilHack-specific `#telekinesis` are not
  autocompleted at the `#` prompt and are reported as unknown when typed.
- Stock NetHack 3.6 extcmd list is being used; EvilHack adds/renames extcmds
  in `src/cmd.c` (extcmdlist[]) that our bridge or completion UI doesn't see.
- Investigation: check whether our extcmd menu reads the catalog from the
  wasm runtime (via an exported helper) or from a hardcoded TS list. If
  hardcoded, add an EvilHack-specific catalog (or extract it from the wasm
  the same way as the glyph catalog).
- **June 3, 2026 — partial fix**: extcmd validator was discarding the whole
  list because `requiredNames` insisted on SlashEM's `"2weapon"` (EvilHack
  uses `"twoweapon"`). With that split, `#kick` / `#options` / `#pray` /
  `#telekinesis` etc. now dispatch correctly when typed in full.
- **Still TODO — autocomplete UI parity with SlashEM**: typing `#telek<Tab>`
  (or the partial-match popup we have for SlashEM) does not complete to
  `#telekinesis` for evilhack. The extcmd menu/autocomplete UI is wired up
  for slashem but not evilhack. Likely the UI is filtered by runtimeVersion
  and just needs the evilhack branch added; check the extcmd autocomplete
  code path that feeds `getExtendedCommandEntries()` into the prompt
  suggestion list.

### evilhack-wasm-shims.c is a stub (June 3)
- Today `scripts/wasm/evilhack-wasm-shims.c` provides empty/zero/no-op
  implementations of TTY-ish symbols (`tty_get_ext_cmd`, `tty_getlin`,
  `tty_doprev_message`, `tty_getmsghistory`, `cl_end`, `cmov`, `home`,
  `standoutbeg`, `standoutend`, `term_*`, `graph_on/off`, `addtopl`,
  `remember_topl`, `more`, `error`, ...) plus `dosh`/`dosuspend`/`regularize`.
- Turn it into a **real gateway** that forwards meaningful calls into the
  JS/runtime layer (via EM_JS or via the existing `shim_*` win-port hooks).
  In particular:
  - `tty_get_ext_cmd` -> route to our extcmd menu (would fix `#kick`,
    `#options`, `#telekinesis` autocompletion regression).
  - `tty_getlin` -> route to our prompt UI (currently any tty-side getlin
    call returns empty string).
  - `tty_doprev_message` / `tty_getmsghistory` -> route to the JS message
    log so scrollback works on tty-side message popups.
  - `more` / `addtopl` -> forward to status/topline JS bridge.
- The shim should remain build-time only; the runtime should never *need*
  it once SHIM_GRAPHICS is the primary window-port, but EvilHack 0.9.x
  still calls some tty helpers directly from non-window code paths.

### EvilHack 0.9.3 new races / role-race compat (June 3)
- 0.9.3 introduces new player races beyond 0.9.2: **aasimar** (`MH_AASIMAR`),
  **tortle**, **drow**, **illithid** (see `src/role.c` racemask additions in
  `roles[]`).
- Verified Priest+dwarf+neutral still valid in 0.9.3, so the current default
  character (`role:Priest,race:dwarf,gender:male,align:neutral`) parses
  cleanly through `EVILHACKOPTIONS` / `HACKOPTIONS`.
- TODO: surface the new races in our character-creation UI:
  - Add aasimar/tortle/drow/illithid to the race picker for evilhack runtime
    only (not vanilla/slashem).
  - Map role x race compatibility from `roles[].allow` racemasks in
    `imported/evilhack-wasm/build/EvilHack-0.9.3_wasm/EvilHack-0.9.3/src/role.c`
    so the UI greys out illegal combinations (e.g. illithid Samurai).
  - Extend any role-specific quest/altar/sound metadata in
    `src/game/` and `src/i18n/` that currently assumes the 0.9.2 race set.
- Sanity-check that defaulting to `race:human` if the user picks a role that
  no longer accepts their previously-saved race doesn't get rejected by
  `pl_race`'s stricter 0.9.3 validation.

### Support saving in EvilHack (June 3)
- IDBFS is already mounted for the evilhack runtime (`getRuntimeSaveMountDir`
  / `getRuntimeSaveDbName` in `LocalNetHackRuntime.ts`), so on-disk persistence
  framework is in place; what's missing is end-to-end verification of
  `#save` → reload → resume for the 0.9.3 build.
- TODO:
  - Try `S` / `#save` in a running evilhack session, confirm the save file
    lands under the IDBFS mount and `syncfs` is triggered before the wasm
    exits.
  - Reload the page and check that startup finds the save and offers the
    "Restore game?" prompt (or auto-restores if our auto-resume path is
    enabled for evilhack).
  - Wire `recover_savefile` / `hack_save` / `hack_restore` exports for
    evilhack: they're in the phase3-relink.sh `EXPORTED_FUNCTIONS` list but
    `updateCheckpointRecoverySupport()` may still gate them behind a
    runtime-version check (see `supportsRuntimeCheckpointRecovery`).
  - If saves work but restore corrupts state: likely the same wasm32 vs
    x86_64 struct-layout class of bug as the vault `.lev` files (sp_lev /
    long fields). Add a `sizeof()` audit pass on the save record structs.
  - Update `EVILHACK_BUILD_GUIDE.md` once verified.
