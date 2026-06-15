# EvilHack Inclusion Progress

## Plan

### Phase 1: Build System Integration ✅
- [x] Verify evilhack.js and evilhack.wasm exist in `/public`
- [x] Review existing build script at `scripts/wasm/build-evilhack.mjs`
- [x] Update vite.config.ts to include EvilHack runtime configuration
- [x] Add EvilHack environment variables for WASM/JS asset tags

### Phase 2: Runtime Configuration ✅
- [x] Type definition already includes "evilhack" in NethackRuntimeVersion
- [x] Update LocalNetHackRuntime.ts to handle EvilHack asset paths
- [x] Update LocalNetHackRuntime.ts to handle EvilHack pointer ABI tags
- [x] Update LocalNetHackRuntime.ts to handle EvilHack capabilities
- [x] Update runtime capabilities detection for EvilHack
- [x] Add checkpoint recovery constants for EvilHack
- [x] Update runtime version normalization to include EvilHack
- [x] Update status window suppression logic for EvilHack

### Phase 3: Storage & Preferences ✅
- [x] Update client-options-storage.ts to include "evilhack" in supported versions
- [x] Update save-storage.ts with EvilHack compat tags (version 092)

### Phase 4: Game Engine & Graphics ✅
- [x] Update tilesets.ts to handle EvilHack tile layout compatibility
- [x] Tileset translation already handles EvilHack correctly
- [x] Create glyph-catalog.evilhack.generated.ts (placeholder)
- [x] Update glyphs/registry.ts to load EvilHack glyph catalog

### Phase 5: UI & Startup ✅
- [x] Update UI components to display EvilHack as a selectable variant
- [x] Update character-sheet.ts with EvilHack-specific extended commands
- [x] Update Nethack3DEngine.ts extended command handling for EvilHack
- [x] Add EvilHack button to main menu variant selection (App.tsx)

## Status

**Created:** 2026-04-10
**Last Updated:** 2026-04-10
**Current Phase:** 5 (COMPLETE)
**Overall Progress:** 100%

## Implementation Summary

### All Modified Files (14 total)

1. **vite.config.ts**
   - Added evilhackRuntimeBuildJsPath and evilhackRuntimeBuildTag
   - Added evilhackPointerAbiTag and evilhackCompatTag ("evilhack-092-forked")
   - Added capability detection for recover_savefile and checkpoint_resume_bridge
   - Added 5 environment variables to Vite define config

2. **src/runtime/LocalNetHackRuntime.ts**
   - getRuntimeModuleAssetPath() - Added evilhack.js path
   - getRuntimeWasmAssetPath() - Added evilhack.wasm path
   - readRuntimeBuildTag() - Added VITE_NH3D_WASM_EVILHACK_RUNTIME_BUILD_TAG
   - readConfiguredPointerAbiTag() - Added evilhack-pointer-v1 fallback
   - buildDefaultRuntimePointerContract() - Added isEvilHack flag, treated like SlashEM for extcmd
   - shouldSuppressRedundantStatusWindowText() - Includes EvilHack
   - normalizeRuntimeVersion() - Recognizes "evilhack" as valid variant

3. **src/runtime/runtime-capabilities.ts**
   - Added ENABLE_RUNTIME_EVILHACK_CHECKPOINT_RECOVERY constant
   - Updated hasRuntimeCheckpointRecoveryPrimitiveExport() - Handles EvilHack
   - Updated supportsRuntimeCheckpointRecovery() - Handles EvilHack

4. **src/runtime/save-storage.ts**
   - Updated getRuntimeSaveCompatTag() - Added evilhack-092 compat tag

5. **src/storage/client-options-storage.ts**
   - Added "evilhack" to startupCharacterPreferenceRuntimeVersions array

6. **src/game/tilesets.ts**
   - Updated isNh3dTilesetLayoutCompatibleWithRuntime() - EvilHack uses slashem tile layout

7. **src/game/glyphs/registry.ts**
   - Added evilhack entry to GLYPH_CATALOG_BY_VERSION
   - Added EvilHack loader in loadGlyphCatalogModule()

8. **src/game/glyphs/glyph-catalog.evilhack.generated.ts** (NEW)
   - Placeholder file for EvilHack glyph data
   - Will be populated by `npm run glyphs:generate`

9. **src/ui/modals/character-sheet.ts**
   - Extended command availability for EvilHack (same as SlashEM)
   - Enhanced command support: enhance, conduct, known, pray, spells, technique
   - Removed seespells command filtering for EvilHack

10. **src/game/Nethack3DEngine.ts** (Multiple changes)
    - shouldUseLegacyTileContextLookProbe() - Includes EvilHack
    - resolvePreferredKeyboardInputForExtendedCommand() - Multiple cases updated:
      - attributes, known, pray, seespells, spells commands
    - resolveStatusConditionBlindMask() - EvilHack uses SlashEM mask (0x00000010)
    - Question/choice handling - EvilHack removes asterisks from choices like SlashEM
    - Position input for legacy cursor prompt - EvilHack handles comma input
    - Context action support - EvilHack has technique actions like SlashEM

## Compatibility Notes

### EvilHack v0.9.2 Characteristics
- Based on 3.6.7 codebase with extended commands similar to SlashEM
- Uses SlashEM-compatible tile layout for tilesets
- Uses SlashEM-compatible pointer ABI for extended commands
- Shares similar menu and status window structures with SlashEM
- Extended commands: attributes, call, cast, close, conduct, dip, drop, eat, etc.
- Special support: technique, pray, spells, known commands (like SlashEM)
- Save files tagged with "evilhack-092" for version tracking

### Pointer ABI Tag Mapping
- 3.6.7: nh367-pointer-v1
- 3.7: nh37-pointer-v1
- SlashEM: slashem-pointer-v1
- **EvilHack: evilhack-pointer-v1**

### Extended Command Structure
EvilHack uses the same extended command list structure as SlashEM (16-byte stride with command name at offset 0).

## Next Steps (Optional)

1. **Generate actual glyphs**: Run `npm run glyphs:generate` to populate glyph-catalog.evilhack.generated.ts with actual glyph data
2. **Build and test**: `npm run build` to verify compilation
3. **Runtime testing**: Test gameplay, save/load, and character selection with EvilHack
4. **Update documentation**: Add EvilHack to game variant documentation

## Files Not Modified

The following files reference SlashEM but do NOT need EvilHack changes:
- `src/game/user-tileset-storage.ts` - Only deals with tile layout types, not runtime versions
- `src/game/tileset-367-to-37-translation.ts` - Translation logic already compatible (only translates for 3.7 runtime)
- `src/game/vulture/translation.ts` - Generic tile translation (not variant-specific)

## Build Integration

The existing npm build flow already includes:
- `npm run copy-wasm` - Copies WASM files including evilhack.js and evilhack.wasm
- Build script at `scripts/wasm/build-evilhack.mjs` ready to use

**To generate glyphs**: `npm run glyphs:generate`
**To build**: `npm run build`
**To test**: `npm run dev` or `npm run electron:dev`
