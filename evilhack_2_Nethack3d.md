# EvilHack to NetHack 3D Integration: Function Analysis

## Overview

This document maps the functions required by NetHack 3D's graphics and gameplay systems against what EvilHack provides, identifying gaps, signature mismatches, and integration opportunities.

**Document Version**: 1.0  
**Target Variants**: EvilHack (vs NetHack 3.6.7, NetHack 3.7, SLASH'EM)  
**Date**: April 10, 2026

---

## 1. Core Architecture Requirements

NetHack 3D requires a **graphics bridge layer** to connect the game engine to the 3D renderer. This bridge consists of:

| Component | Purpose | Status |
|-----------|---------|--------|
| **Glyph Mapping** | Convert internal glyphs to tile indices for rendering | ✅ Mostly Covered |
| **Callback Interface** | Register/invoke UI callbacks during gameplay | 🟡 Partially Covered |
| **Save/Restore** | Handle checkpoint saves and recovery | ❌ Missing |
| **Query Functions** | Get game state (glyphs at position, items, etc) | 🟡 Partially Covered |

---

## 2. Graphics Shim Functions

These functions form the NetHack 3D graphics interface that EVERY WASM variant must export.

### 2.1 Callback Registration

| Function | NetHack 3D Needs | EvilHack Has | Status | Notes |
|----------|-----------------|--------------|--------|-------|
| **`shim_graphics_set_callback(callback_name: string)`** | `void` | ❌ No | **NEW** | Register callback for UI events. NetHack 3D provides synchronous callback. |

**Implementation**: Stub in shim file - just store the callback name.

---

### 2.2 Glyph Mapping Functions

These are the CRITICAL functions for rendering. All NetHack variants export these.

| Function | Signature (EvilHack) | Signature (Expected) | Status | Notes |
|----------|---------------------|----------------------|--------|-------|
| **`mapglyph`** | `mapglyph(glyph, *ochar, *ocolor, *ospecial, x, y, mgflags)` | `(i32, i32*, i32*, i32*, i32, i32, i32) -> void` | ✅ Yes | Outputs glyph properties. Used for rendering. |
| **`glyph_to_tile`** | ❓ Unknown | `(i32) -> i32` | 🟡 Uncertain | Maps glyph number to tile index. |

**Key Issue**: EvilHack's `mapglyph` takes 7 parameters; it matches the pattern from 3.6.7 and works.

---

### 2.3 Query Functions (for game state access)

| Function | Purpose | EvilHack Signature | Status | Implementation |
|----------|---------|-------------------|--------|-----------------|
| **`nh3d_glyph_at(x, y)`** | Get glyph at map position | Must find or create | 🟡 Partial | Stub for now; full impl would scan game state |
| **`nh_top_item_glyph_under_player()`** | Get item under player | Must find or create | 🟡 Partial | Stub for now; full impl would check object list |

**These are NOT critical for initial launch** - they're for advanced features like item inspection.

---

### 2.4 Checkpoint Functions

| Function | Purpose | EvilHack Has | Status | Notes |
|----------|---------|--------------|--------|-------|
| **`recover_savefile()`** | Check for saved checkpoint | ❌ No | **MISSING** | Would scan for `.save` files. Stub is OK. |
| **`resume_checkpoint_save()`** | Restore checkpoint state | ❌ No | **MISSING** | Would load checkpoint into game state. Stub is OK. |

**These are currently STUBS** - OK for MVP but needed for full save/restore support.

---

## 3. Memory Management

| Function | EvilHack Status | Usage |
|----------|-----------------|-------|
| **`malloc(size)`** | ✅ Yes (libc) | Memory allocation for glyph structures |
| **`free(ptr)`** | ✅ Yes (libc) | Memory deallocation |

---

## 4. Initialization Chain

For the WASM binary to include all code (not perform dead-code elimination), we need to reference functions that pull in dependencies:

| Function | EvilHack Signature | Purpose | Status |
|----------|-------------------|---------|--------|
| **`decl_init()`** | `void decl_init(void)` | Initialize declarations | ✅ Yes |
| **`init_symbols()`** | `void init_symbols(void)` | Initialize symbol mapping | ✅ Yes |
| **`u_init()`** | `int u_init(void)` | Initialize player data | ✅ Yes |
| **`main(argc, argv)`** | `int main(int argc, char **argv)` | Entry point | ✅ Yes (in music.c) |

**These are called from `nh_wasm_init()` to force linker to include full code.**

---

## 5. Comparison with Other Variants

### NetHack 3.6.7

| Aspect | NH 3.6.7 | EvilHack | Notes |
|--------|----------|----------|-------|
| WASM Size | 4.9 MB | 7.3 KB ❌ | EvilHack still too small - linker not including full code |
| `mapglyph` sig | `(glyph, *char, *color, *special, x, y, flags)` | Same | ✅ Match |
| Graphics shims | 10+ functions | 6 functions | EvilHack has fewer query functions |
| Save/restore | Full support | Stubs only | EvilHack uses same format as NetHack |

### NetHack 3.7

| Aspect | NH 3.7 | EvilHack | Notes |
|--------|--------|----------|-------|
| WASM Size | 6.5 MB | 7.3 KB ❌ | EvilHack still too small |
| `mapglyph` sig | `(glyph, *glyphinfo, x, y, flags)` | Older format | ⚠️ Different - uses `glyphinfo` struct |
| Tile support | Enhanced | Basic | EvilHack has fewer tile features |

### SLASH'EM

| Aspect | SLASH'EM | EvilHack | Notes |
|--------|----------|----------|-------|
| WASM Size | 3.7 MB | 7.3 KB ❌ | EvilHack still too small |
| Complexity | Medium | Low | EvilHack is simpler variant |
| Graphics | Similar to 3.6.7 | Same | ✅ Should be compatible |

---

## 6. Current Build Issues

### Issue #1: WASM Binary Too Small

**Symptom**: `evilhack.wasm` is only 7.3 KB (should be 3-5 MB)

**Root Cause**: Emscripten's linker is performing aggressive dead-code elimination.

**Current Approach**:
- Added `main()` entry point in graphics shim
- Called `decl_init()`, `init_symbols()`, `u_init()` to force dependency pulling
- These functions aren't being called, but their references should force linking

**Alternative Solutions**:
- Use `-Wl,--gc-sections=0` to disable garbage collection (tried, caused other errors)
- Use `-Wl,--whole-archive` (tried, caused linker failures)
- Add more external function references to `nh_wasm_init()`
- Compile with `-O0` instead of `-O2` to disable optimizations

---

### Issue #2: Function Signature Mismatches

**Previous Issue** (Now Fixed): Our shims had different signatures than EvilHack's native functions.

| Function | Problem | Solution |
|----------|---------|----------|
| `error()` | EvilHack defines with specific signature | ❌ Removed from shim - use EvilHack's |
| `sethanguphandler()` | EvilHack defines with different params | ❌ Removed from shim |
| `sys_random_seed()` | EvilHack defines, signature differs | ❌ Removed from shim |
| `mapglyph()` | EvilHack has native, our stub conflicted | ❌ Don't call from shim - let linker use native |

**Status**: ✅ Resolved - removed all conflicting stubs

---

### Issue #3: Undefined Symbols at Link Time

**When it happened**: When we tried to call `init_dungeon()` which doesn't exist

**Solution**: Use functions we've verified exist:
- `decl_init()` - verified in source
- `init_symbols()` - verified in source  
- `u_init()` - verified in source

---

## 7. Function Inventory

### Functions EvilHack Definitely Has (for WASM export)

```c
/* Memory management */
void *malloc(size_t size)           // stdlib
void free(void *ptr)                // stdlib

/* Graphics/Glyph */
void mapglyph(int glyph, int *ochar, int *ocolor, unsigned *ospecial, int x, int y, unsigned mgflags)

/* Initialization (forced by nh_wasm_init) */
int u_init(void)
void init_symbols(void)
void decl_init(void)
int main(int argc, char **argv)    // in music.c

/* System stubs (our replacements) */
int check_user_string(const char *input)     // stub
int dosh(void)                               // stub  
int dosuspend(void)                          // stub
void more(void)                              // stub
```

### Functions EvilHack Likely Has (needs verification)

```c
glyph_to_tile(glyph)               // Maps glyph to tile index
/* Various query functions - would need game state inspection */
```

### Functions EvilHack Doesn't Have (NetHack 3D provides via shim)

```c
void shim_graphics_set_callback(const char *callback_name)  // NetHack 3D-specific
int nh3d_glyph_at(int x, int y)                             // Query (stub)
int nh_top_item_glyph_under_player(void)                    // Query (stub)
int recover_savefile(void)                                   // Checkpoint (stub)
int resume_checkpoint_save(void)                             // Checkpoint (stub)
int nh_wasm_init(void)                                       // Init wrapper
int main(int argc, char **argv)                              // Entry (wrapper in shim)
```

---

## 8. Next Steps & Recommendations

### Immediate (Fix Linking Issue)

- [ ] Investigate why `main()` isn't forcing full code inclusion
- [ ] Try adding more function calls to `nh_wasm_init()` - call functions that have lots of dependencies
- [ ] Check if `-O0` helps (less aggressive optimization)
- [ ] Verify `u_init()`, `init_symbols()`, `decl_init()` actually exist and are being linked

### Short-term (Get Basic WASM Working)

- [ ] Get WASM size to 3+ MB (all code included)
- [ ] Test graphics shim functions export correctly
- [ ] Load WASM in browser and verify game boots
- [ ] Run glyph catalog generation: `npm run glyphs:generate`
- [ ] Test game basic gameplay (move, attack, items)

### Medium-term (Full Feature Parity)

- [ ] Implement real `nh3d_glyph_at()` with game state queries
- [ ] Implement real `nh_top_item_glyph_under_player()`
- [ ] Add checkpoint save/restore support
- [ ] Implement proper tile index mapping

### Long-term (Documentation & Distribution)

- [ ] Create integration guide in `NH_NEW_VERSION_INTEGRATION.md`
- [ ] Document architecture for future variant integrations
- [ ] Add build instructions to main README
- [ ] Create troubleshooting guide for variant-specific issues

---

## 9. Technical Notes

### Why EvilHack's Signatures Matter

EvilHack is based on NetHack 3.6.7, so it shares the same **basic C API**:
- Same `mapglyph()` signature
- Same memory model
- Same initialization sequence

However, EvilHack has **custom features**:
- Additional roles and races
- Enhanced magic system
- Modified monster AI
- Different item interactions

These don't directly affect the graphics shim (which is just glyph→tile mapping), but they might affect:
- Save file format
- Monster/item glyph assignments
- Special effects rendering

### WASM Module Integration

The WASM module (created by Emscripten) needs to expose:

```javascript
// What NetHack 3D expects
Module._malloc              // Allocate memory
Module._free                // Free memory
Module._shim_graphics_set_callback  // Register callback
Module._nh3d_glyph_at       // Query glyph at position
Module._nh_top_item_glyph_under_player  // Query item
Module._recover_savefile    // Checkpoint recovery
Module._resume_checkpoint_save  // Checkpoint resume
Module._mapglyph            // Glyph properties (native EvilHack function)
Module._glyph_to_tile       // Glyph to tile mapping (native EvilHack function)
```

These are called from TypeScript via `cwrap()` and `ccall()`.

---

## 10. References

### Files Involved

| File | Purpose |
|------|---------|
| `scripts/wasm/build-evilhack.mjs` | Build script for WASM compilation |
| `scripts/wasm/evilhack-wasm-shims.c` | Unix function stubs (dosh, dosuspend, etc) |
| `scripts/wasm/evilhack-graphics-shim.c` | NetHack 3D graphics interface + init wrapper |
| `public/evilhack.js` | Generated WASM module loader |
| `public/evilhack.wasm` | Compiled EvilHack game engine (currently 7.3KB - TOO SMALL) |
| `src/runtime/LocalNetHackRuntime.ts` | Game state manager - uses exported functions |
| `src/game/glyphs/glyph-catalog.evilhack.generated.ts` | Glyph→tile mapping data |

### Related Documents

- `EVILHACK_INCLUSION_PROGRESS.md` - Status tracking
- `EVILHACK_BUILD_GUIDE.md` - Build instructions
- `EVILHACK_WASM_STATUS.md` - Technical status
- `NH_NEW_VERSION_INTEGRATION.md` - Future variant integration guide (TO BE UPDATED)

---

## Appendix A: Function Signature Details

### mapglyph()

**EvilHack Definition** (from `src/mapglyph.c:263`):
```c
int mapglyph(glyph, ochar, ocolor, ospecial, x, y, mgflags)
    int glyph, *ocolor, x, y;
    int *ochar;
    unsigned *ospecial;
    unsigned mgflags;
{
    /* Implementation: maps glyph to displayable properties */
}
```

**Expected by NetHack 3D**:
```wasm
(i32, i32, i32, i32, i32, i32, i32) -> i32
```

**Usage from JS**:
```javascript
let ochar = Module._malloc(4);
let ocolor = Module._malloc(4);  
let ospecial = Module._malloc(4);
Module._mapglyph(glyph, ochar, ocolor, ospecial, x, y, mgflags);
let ch = Module.getValue(ochar, "i32");
let color = Module.getValue(ocolor, "i32");
let special = Module.getValue(ospecial, "i32");
Module._free(ochar);
Module._free(ocolor);
Module._free(ospecial);
```

---

## Appendix B: Missing Pieces Analysis

### What's Still Needed for Full Integration

| Item | Status | Difficulty | Priority |
|------|--------|-----------|----------|
| Fix WASM size (get full code linked) | 🔴 Blocking | Medium | **CRITICAL** |
| Test in browser | 🟡 Pending | Low | High |
| Glyph catalog generation | 🟡 Ready | Low | High |
| Proper nh3d_glyph_at() impl | 🟡 Stubbed | Medium | Medium |
| Checkpoint save/restore | 🔴 Missing | High | Low |
| Performance optimization | 🟢 Not needed yet | Medium | Low |

---

**Document prepared for**: EvilHack WASM integration into NetHack 3D  
**Status**: Initial analysis complete, build debugging in progress
