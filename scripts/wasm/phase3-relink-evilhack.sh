#!/bin/bash
# Phase 3: Re-link EvilHack WASM with correct emcc flags
# This script performs the final linking step with proper Emscripten flags
# It bypasses Make's LFLAGS override by calling emcc directly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Determine EvilHack build tree location
EHBUILD="${EHBUILD:-$PROJECT_ROOT/imported/evilhack-wasm/build/EvilHack-0.9.2_wasm/EvilHack-0.9.2}"

if [ ! -d "$EHBUILD/src" ]; then
  echo "ERROR: EvilHack build tree not found at: $EHBUILD/src"
  echo ""
  echo "Expected location after LOCAL_build.wasm.sh:"
  echo "  PROJECT_ROOT/imported/evilhack-wasm/build/EvilHack-0.9.2_wasm/EvilHack-0.9.2/src/"
  echo ""
  echo "Set EHBUILD environment variable to override:"
  echo "  export EHBUILD=/path/to/build/tree"
  echo "  $0"
  exit 1
fi

if [ ! -d "$EHBUILD/wasm-data" ]; then
  echo "ERROR: wasm-data directory not found at: $EHBUILD/wasm-data"
  echo "Run LOCAL_build.wasm.sh first to create data archive."
  exit 1
fi

if [ ! -f "$EHBUILD/wasm-data/nhshare" ] && [ ! -f "$EHBUILD/wasm-data/nhdat" ]; then
  echo "WARNING: No nhshare or nhdat found in wasm-data"
  echo "Game may fail to find quest.dat and other data files."
  echo ""
  echo "Attempting to create nhshare from dat/ files..."
  
  DLB="$EHBUILD/util/dlb"
  if [ -x "$DLB" ]; then
    cd "$EHBUILD/dat"
    echo "Running: $DLB cf nhshare *.lev *.txt *.lua quest.dat oracles rumors epitaph"
    "$DLB" cf nhshare *.lev *.txt *.lua quest.dat oracles rumors epitaph 2>/dev/null || true
    
    if [ -f "nhshare" ]; then
      cp nhshare "$EHBUILD/wasm-data/nhshare"
      echo "✓ Created nhshare"
    else
      echo "⚠ Failed to create nhshare with dlb"
    fi
  else
    echo "⚠ dlb tool not found at: $DLB"
  fi
fi

SRC_DIR="$EHBUILD/src"
OUT_DIR="$PROJECT_ROOT/public"
OUT_BASE="evilhack"

mkdir -p "$OUT_DIR"

echo "=== Phase 3: Re-link EvilHack WASM ==="
echo "Build tree: $EHBUILD"
echo "Source dir: $SRC_DIR"
echo "Output dir: $OUT_DIR"
echo ""

# Verify emcc is available
if ! command -v emcc &> /dev/null; then
  echo "ERROR: emcc not found. Activate Emscripten SDK first:"
  echo "  source ~/emsdk/emsdk_env.sh"
  exit 1
fi

echo "Collecting .o files..."
O_FILES=()
for obj in "$SRC_DIR"/*.o; do
  if [ -f "$obj" ]; then
    # Skip files that cause duplicates
    basename=$(basename "$obj")
    case "$basename" in
      evilhack-wasm-shims.o)
        # Skip this—it contains duplicate symbols already in other .o files
        ;;
      *)
        # Include everything else (including winshim_evil.o which is needed for shim_procs)
        O_FILES+=("$obj")
        ;;
    esac
  fi
done

if [ ${#O_FILES[@]} -eq 0 ]; then
  echo "ERROR: No .o files found in $SRC_DIR"
  echo "Run LOCAL_build.wasm.sh first to compile object files."
  exit 1
fi

echo "Found ${#O_FILES[@]} object files"
echo ""

# Perform the re-link with correct flags
echo "Invoking emcc (this may take 30-60 seconds)..."
emcc \
  "${O_FILES[@]}" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=Module \
  -s ASYNCIFY=1 \
  -s ASYNCIFY_IMPORTS='["local_callback"]' \
  -s ALLOW_TABLE_GROWTH=1 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
  -s EXPORTED_FUNCTIONS='["_main","_malloc","_free","_shim_graphics_set_callback",
      "_nh3d_glyph_at","_nh_top_item_glyph_under_player","_recover_savefile",
      "_resume_checkpoint_save","_hack_save","_hack_restore","_nh_wasm_init"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","addFunction","removeFunction",
      "UTF8ToString","stringToUTF8","getValue","setValue","ENV","FS","IDBFS"]' \
  -lidbfs.js \
  --embed-file "$EHBUILD/wasm-data@/" \
  -o "$SRC_DIR/$OUT_BASE.js"

echo ""
echo "✓ Re-link complete!"
echo ""

# Copy outputs to public/
echo "Copying outputs..."
echo "  Source WASM: $(ls -lh $SRC_DIR/$OUT_BASE.wasm | awk '{print $5, $9}')"
echo "  Source JS:   $(ls -lh $SRC_DIR/$OUT_BASE.js | awk '{print $5, $9}')"

cp -v "$SRC_DIR/$OUT_BASE.js" "$OUT_DIR/$OUT_BASE.js" || {
  echo "ERROR: Failed to copy evilhack.js"
  exit 1
}
cp -v "$SRC_DIR/$OUT_BASE.wasm" "$OUT_DIR/$OUT_BASE.wasm" || {
  echo "ERROR: Failed to copy evilhack.wasm"
  exit 1
}

# Verify copy was successful
PUBLIC_WASM_SIZE=$(stat -c%s "$OUT_DIR/$OUT_BASE.wasm" 2>/dev/null || echo "0")
SRC_WASM_SIZE=$(stat -c%s "$SRC_DIR/$OUT_BASE.wasm" 2>/dev/null || echo "0")

if [ "$PUBLIC_WASM_SIZE" != "$SRC_WASM_SIZE" ]; then
  echo "ERROR: WASM file copy verification failed!"
  echo "  Source size: $SRC_WASM_SIZE bytes"
  echo "  Copied size: $PUBLIC_WASM_SIZE bytes"
  exit 1
fi

echo "✓ Outputs copied to:"
echo "  - $(ls -lh $OUT_DIR/$OUT_BASE.js | awk '{print $5, $9}')"
echo "  - $(ls -lh $OUT_DIR/$OUT_BASE.wasm | awk '{print $5, $9}')"
echo ""

# Verify exports
echo "Verifying exports..."
if command -v wasm-objdump &> /dev/null; then
  if wasm-objdump -j Export -x "$OUT_DIR/$OUT_BASE.wasm" | grep -q "func.*_main"; then
    echo "✓ _main export found"
  else
    echo "⚠ WARNING: _main export not found in WASM binary!"
  fi
else
  echo "⚠ wasm-objdump not found; skipping export verification"
fi

if tail -c 30 "$OUT_DIR/$OUT_BASE.js" | grep -q "export default"; then
  echo "✓ ES6 default export found in JS"
else
  echo "⚠ WARNING: ES6 default export not found in JS!"
fi

echo ""
echo "=== Phase 3 Complete ==="
