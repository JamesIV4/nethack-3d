# EvilHack WASM Build Guide

## Quick Start

```bash
cd /home/simon/repos/nethack-3d
source ./emsdk/emsdk_env.sh
node ./scripts/wasm/build-evilhack.mjs
```

## What Gets Built

The build compiles all EvilHack source files + graphics shim to WASM:

- **Source**: `../EvilHack/src/*.c` (all EvilHack game code)
- **Headers**: `../EvilHack/include/*.h` (pre-built from `make`)
- **Utilities**: `../EvilHack/sys/share/posixregex.c` (regex support)
- **Shims**: 
  - `scripts/wasm/evilhack-wasm-shims.c` (Unix compatibility stubs)
  - `scripts/wasm/evilhack-graphics-shim.c` (NetHack 3D integration)

## Architecture

```
EvilHack WASM Module
├── Game Logic (from EvilHack src)
├── Tile System (built-in EvilHack support)
├── Graphics Shim (our bridge to NetHack 3D)
│   ├── shim_graphics_set_callback() - Register UI callback
│   ├── mapglyph() - Map glyphs to tiles
│   ├── glyph_to_tile() - Glyph → tile index
│   ├── nh3d_glyph_at() - Query map position
│   └── recover_savefile() / resume_checkpoint_save() - Save handling
└── Runtime (Emscripten + WASM)
```

## Expected Output

```
✓ Build successful!
Output:
  - public/evilhack.js   (glue code, ~11KB)
  - public/evilhack.wasm (compiled game, ~2-5MB)
```

## Troubleshooting

### Build fails: "EvilHack source not found"
- Ensure `../EvilHack/src/` exists
- Clone/copy EvilHack to: `/home/simon/repos/EvilHack`

### Build fails: "include directory not found"
- Headers need to be generated first:
  ```bash
  cd ../EvilHack
  make
  ```

### Build fails: "duplicate symbol" or "undefined symbol"
- The build script handles common issues automatically
- Check `/tmp/build.log` for details

## Files Modified

- `scripts/wasm/build-evilhack.mjs` - Main build script
- `scripts/wasm/evilhack-wasm-shims.c` - Unix function stubs
- `scripts/wasm/evilhack-graphics-shim.c` - NetHack 3D integration (NEW)

## TypeScript Integration

The TypeScript side is already configured for EvilHack (see `EVILHACK_INCLUSION_PROGRESS.md`):
- Runtime detection ✓
- Asset loading ✓
- Engine integration ✓
- UI setup ✓

Once the WASM builds successfully, the app will use it automatically.
