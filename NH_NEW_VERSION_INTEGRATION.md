# NetHack Version Integration in NetHack-3D

This document explains how the NetHack source code is integrated with the 3D GUI in the `nethack-3d` project, and how a new (4th) version could be added.

## Overview

The NetHack-3D project supports multiple NetHack versions/types, integrating their core logic (C code, compiled to WebAssembly) with a modern 3D GUI (TypeScript/React, Electron, Vite, etc.). The integration is achieved by compiling the NetHack C sources to WebAssembly (WASM) and providing a JavaScript interface for the GUI to interact with the game engine.

Currently, three types/versions are supported:
- NetHack 3.6.7
- NetHack 3.7
- SLASH'EM

## Integration Points

### 1. Source Code Location
- The imported NetHack sources are found in `imported/nethack-3.6.7/`, `imported/role-sources/3.7/`, and `imported/role-sources/slashem/`.
- These are not directly used by the GUI, but are compiled to WASM and JS glue code.

### 2. WASM/JS Artifacts
- The compiled WASM and JS interface files are in `public/`:
  - `nethack-367.js` / `nethack-367.wasm` (NetHack 3.6.7)
  - `nethack-37.js` / `nethack-37.wasm` (NetHack 3.7)
  - `slashem.js` / `slashem.wasm` (SLASH'EM)

### 3. GUI Integration
- The 3D GUI (React/TypeScript) loads the appropriate WASM/JS module at runtime, depending on the selected version.
- The main integration logic is in `src/app.ts` and related files in `src/game/`.
- The GUI communicates with the WASM module via exported JS functions, handling game state, rendering, and user input.

### 4. Version Selection
- The codebase supports switching between versions, likely via a configuration or runtime selection in the UI.
- The logic for selecting and loading the correct WASM/JS module is in the startup code (`src/app.ts`, possibly `src/game/constants.ts`).

## Adding a 4th Version/Type

To integrate a new NetHack version (e.g., NetHack 3.6.0, UnNetHack, or another variant):

1. **Import Source**: Place the new C source in `imported/role-sources/<new-version>/`.
2. **Generate Required Headers**: Many NetHack variants (including EvilHack) require certain header files (e.g., `pm.h`, `onames.h`) that are generated at build time. Before attempting to build the WASM/JS version, you must:
  - Run the setup script for your variant (e.g., `cd <variant>/sys/unix && ./setup.sh hints/linux`).
  - Run `make all` in the root of the variant source to build the native binary. This will generate all necessary headers in the `include` directory.
  - Confirm that files like `pm.h` exist in the `include` directory before proceeding.
3. **Build WASM/JS**: Create a build script (see `scripts/wasm/` or similar) to compile the new source to WASM and JS glue code. Output to `public/<newname>.js` and `public/<newname>.wasm`.
3. **Update GUI**:
   - Add the new version to the version selection logic (likely in `src/game/constants.ts` or similar).
   - Update the loader in `src/app.ts` to support loading the new WASM/JS files.
   - Ensure the GUI can handle any differences in the new version's API.
4. **Test**: Run and test the integration, updating UI and logic as needed.

## Key Files
- `imported/role-sources/` — Source code for each NetHack version
- `public/` — Compiled WASM/JS modules
- `src/app.ts` — Main app logic, WASM/JS loader
- `src/game/constants.ts` — Version/type definitions
- `scripts/wasm/` — Build scripts for WASM modules

## References
- See also: `README.MD`, `scripts/wasm/copy-wasm.mjs`, and build scripts for more details on the build process.
