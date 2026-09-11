# Project Structure Steering

This is a living steering doc. Update it whenever architecture, file ownership, or runtime contracts change.

## Related Steering Docs

- [Engine architecture and code hotspots](../../src/game/engine/README.md)
- [React UI architecture and code hotspots](../../src/ui/README.md)
- [Input and player/cursor movement](movement-flow.md)
- [Change playbook](logic-hotspots.md)
- [World/runtime flow guide](../../docs/engine-world-runtime.md)

## Top-Level Layout

- `index.html`: Vite HTML entry point.
- `src/main.tsx`: React app bootstrap and engine mount.
- `src/app.ts`: debug helper registration.
- `src/ui/App.tsx`: React entry point and app composition.
- `src/ui/app/`: feature hooks, components and helpers, grouped into startup, settings, controller, menus, inventory, status, scores, tilesets, updates and shared presentation. See the [UI ownership map](../../src/ui/README.md#code-hotspots).
- `src/state/gameStore.ts`: Zustand store for live UI/game state.
- `src/state/engineUiAdapter.ts`: bridge from engine updates into the store.
- `src/game/Nethack3DEngine.ts`: main engine orchestration layer for rendering, input, camera, and runtime events.
- `src/game/engine/`: state-owning subsystems with explicit typed dependencies, grouped by responsibility. Public controller calls delegate from `Nethack3DEngine` to these classes.
- `src/game/index.ts`: public game barrel.
- `src/game/controller-bindings.ts`: controller action schema, defaults, parsing, and normalization.
- `src/game/tilesets.ts`: builtin, user, and Vulture tileset catalog and asset resolution.
- `src/game/user-tileset-storage.ts`: persistence for imported user tilesets.
- `src/game/helpers/startup-character-rulesets.ts`: runtime-specific startup role, race, gender, and alignment rulesets sourced from NetHack and Slash'EM reference tables.
- `src/game/helpers/startup-character-constraints.ts`: runtime-aware startup character selection normalization and option resolution.
- `src/game/glyphs/index.ts`: public glyph helper barrel.
- `src/game/glyphs/registry.ts`: glyph catalog lookup and runtime-version selection.
- `src/game/glyphs/behavior.ts`: tile classification and default terrain glyph helpers.
- `src/game/glyphs/overrides.ts`: runtime glyph override registry.
- `src/game/glyphs/glyph-catalog.367.generated.ts`: checked-in generated glyph fallback/reference for NetHack 3.6.7 (not authoritative for all item-variation tiles).
- `src/game/glyphs/glyph-catalog.5.generated.ts` and `src/game/glyphs/glyph-catalog.slashem.generated.ts`: generated fallbacks for NetHack 5.0 and Slash'EM, loaded by the registry for the active runtime.
- `src/game/vulture/translation.ts`: Vulture projection and tileset translation adapter.
- `src/game/vulture/nethack-object-tokens.ts`: Vulture object token bridge to imported NetHack data.
- `src/game/vulture/vulture-monster-keys.367.generated.ts`: generated Vulture monster lookup data.
- `src/audio/index.ts`: public audio barrel.
- `src/audio/FmodRuntime.ts`: FMOD runtime bootstrap and wrapper.
- `src/audio/sound-pack-storage.ts`: sound-pack persistence.
- `src/runtime/index.ts`: public runtime barrel.
- `src/runtime/LocalNetHackRuntime.ts`: NetHack callback adapter, input waits, menu/state logic, and runtime event emission.
- `src/runtime/runtime-worker.ts`: worker entry that hosts the runtime.
- `src/runtime/WorkerRuntimeBridge.ts`: main-thread worker bridge.
- `src/runtime/input/RuntimeInputBroker.ts`: broker for event, menu, and position input.
- `src/runtime/startup-init-options.ts`: startup option schema, normalization, serialization, and required token handling.
- `src/runtime/runtime-capabilities.ts`: runtime feature gates.
- `src/runtime/save-storage.ts`: save-path and database-name helpers.
- `src/runtime/displayFileCatalog.ts`: bundled help and display-file text catalog.
- `src/runtime/types.ts`: runtime commands, envelopes, and shared bridge types.
- `src/storage/client-options-storage.ts`: IndexedDB persistence plus localStorage migration for client options and startup preferences.
- `src/update/github-version-checker.ts`: GitHub release/version checks used by the UI.
- `src/update/types.ts`: update type definitions.
- `public/assets/*`: shipped images, UI icons, and Vulture asset roots.
- `public/nethack-367.js`, `public/nethack-367.wasm`, `public/nethack-5.js`, `public/nethack-5.wasm`, `public/slashem.js`, `public/slashem.wasm`: checked-in runtime artifacts consumed by the browser build.
- `imported/nethack-3.6.7/*`: A few imported NetHack 3.6.7 source code files needed to run the UI properly.
- `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo`: forked NetHack WASM monorepo reference in WSL.
- `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-367`: forked wasm-367 package reference in WSL.
- `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-367\NetHack`: forked NetHack source inside the wasm-367 package in WSL.
- `third_party/vulture/*`: vendored Vulture source reference.
- `scripts/glyphs/*`: glyph catalog generation and validation.
- `scripts/wasm/*`: WASM copy and packaging helpers.
- `scripts/updates/*`: update packaging helpers.
- `electron/*`: Electron entry points and packaging support.
- `android/*`: Capacitor Android project.
- `build/*`, `dist/*`, `release/*`: build and packaging outputs.

## Runtime Architecture

1. `src/main.tsx` mounts React and its `App` component.
2. The React app composition wires feature hooks and views; its engine lifecycle creates the engine controller and UI adapter. Hooks run in their established order so listener priority, prompt focus and layout measurement remain stable. The engine assembles its state-owning subsystems with `createEngineSystems` before starting rendering and runtime work.
3. `Nethack3DEngine` creates a `WorkerRuntimeBridge`.
4. `WorkerRuntimeBridge` starts `src/runtime/runtime-worker.ts` as a module worker.
5. The worker creates `LocalNetHackRuntime`.
6. `LocalNetHackRuntime` loads the NetHack runtime artifacts, applies startup init options, and routes shim callbacks through `handleUICallback`.
7. Runtime events flow back to `Nethack3DEngine.handleRuntimeEvent` for rendering and UI updates.

## Useful Commands

- Install dependencies: `npm i`
- Type-check only: `npm run check:tsc`
- Behavioral regressions: `npm test`
- Dev server: `npm run dev`
- Preview production build: `npm run preview`

## Reference Commands

- Build, packaging, and update commands live in `package.json`, including `npm run build`, `npm run build:electron`, `npm run update`, `npm run electron:*`, and `npm run android:*`.
- Agents should not run the build or packaging commands unless the user explicitly asks for that work.

## Runtime Logic Map

### `src/runtime/LocalNetHackRuntime.ts`

- Input intake from the engine: `sendInput`, `sendInputSequence`, `sendMouseInput`, `handleClientInput`.
- Input broker and wait flow: `requestInputCode`, `consumeInputResult`, `waitForQuestionInput`.
- NetHack callback switchboard: `handleUICallback`.
- Key callbacks: `handleShimGetNhEvent`, `handleShimNhGetch`, `handleShimYnFunction`, `handleShimNhPoskey`, `handleShimGetlin`.
- Menu callbacks: `shim_start_menu`, `shim_add_menu`, `shim_end_menu`, `shim_select_menu`.
- Map and position callbacks: `shim_print_glyph`, `shim_cliparound`, `shim_curs`, `shim_clear_nhwindow`.
- Status batching: `shim_status_update`, `statusPending`, `latestStatusUpdates`.
- Runtime bookkeeping: `pendingMenuSelection`, `menuSelectionReadyCount`, `pendingExtendedCommandRequest`, `pendingTextRequest`, `farLookMode`, `farLookOrigin`, `pendingLookMenuFarLookArm`.

### `src/game/Nethack3DEngine.ts`

- Engine setup: constructor, `initThreeJS`, and `connectToRuntime`.
- Runtime event dispatcher: `handleRuntimeEvent`.
- Frame sequencing and coordinated lifecycle: `animate`, `dispose`, `clearScene`.
- Runtime/application option orchestration: `applyClientOptions`, `setClientOptions`, `applyPlayMode`.
- Public controller API delegates to the responsible subsystem.

### `src/game/engine/`

- Camera transforms and smoothing: `camera/camera.ts`.
- Browser keyboard intake: `input/keyboard-input.ts`; directional mapping: `input/movement-input.ts`.
- Shared command submission: `input/input-commands.ts` (`sendInput`, `sendInputSequence`, `sendMouseInput`).
- Mouse/touch/controller devices: `input/mouse-input.ts`, `input/touch-input.ts`, `input/controller-gameplay.ts`, `input/controller-dialogs.ts`.
- Position and far-look cursor state: `input/position-selection.ts`; raycasts: `input/pointer-targeting.ts`; pointer lock: `input/pointer-lock.ts`.
- Question selections, counts and pagination: `ui/question-menus.ts`; inventory, information and text dialogs: `ui/prompt-dialogs.ts`.
- Direction overlays: `ui/direction-prompts.ts`; extended-command palette: `ui/extended-commands.ts`; context actions and glance probes: `ui/tile-context-actions.ts`.
- Tile presentation: `rendering/tile-rendering.ts`, `rendering/tile-materials.ts`, `rendering/glyph-textures.ts`; frame resources and postprocessing: `rendering/render-pipeline.ts`.
- World snapshots and tile updates: `world/level-terrain-cache.ts`, `world/tile-updates.ts`, `world/world-classification.ts`; player and entity motion: `world/player-movement.ts`, `world/entity-movement.ts`.
- Status/HUD: `ui/player-status.ts`; postmortem lifecycle: `ui/game-over.ts`; telemetry: `world/run-telemetry.ts`; minimap: `ui/minimap.ts`.
- Audio/haptics: `audio/audio-haptics-platform.ts`; developer panels: `diagnostics/`. Effects and specialized rendering have separate owners. Search for the owning method inside `src/game/engine/` before extending a feature.
- `create-engine-systems.ts` assembles dependencies; `shared/` contains engine types and constants used by multiple subsystems.
- `runtime/engine-state.ts` owns configuration and lifecycle state; `world/player-movement.ts` owns `playerPos` and player movement state.
- Each subsystem owns its fields and receives narrow `Pick` contracts for the other owners it accesses. Assembly initializes eager dependencies before consumers and preserves synchronous runtime/frame ordering. Gameplay subsystems still collaborate through these declared contracts.

## Runtime Event Contract

- Common map events: `map_glyph`, `map_glyph_batch`, `player_position`, `map_cursor`, `tile_not_found`, `area_refresh_complete`, `clear_scene`.
- Common UI events: `text`, `raw_print`, `question`, `direction_question`, `position_request`, `name_request`, `text_request`, `inventory_update`, `info_menu`, `extended_commands`.
- Common state events: `position_input_state`, `position_cursor`, `number_pad_mode`, `status_update`, `runtime_globals_snapshot`, `runtime_object_tile_map`, `damage_event`, `game_over_complete`, `inventory_updated_signal`.
- Entity/item events include `monster_attack`, `monster_killed`, `confirmed_boulder_push`, `under_player_item_glyph`, and `under_player_item_glyph_cleared`.
- Worker envelope `runtime_ready` is consumed by `WorkerRuntimeBridge`; engine runtime events include `runtime_error` and `runtime_terminated`.

## Runtime Command Contract

- `send_input`
- `send_input_sequence`
- `send_mouse_input`
- `request_tile_update`
- `request_area_update`
- `request_runtime_globals_snapshot`
- `set_logging`

## WASM Pointer Contract

- Decode and ABI validation remain in `src/runtime/LocalNetHackRuntime.ts`; engine decomposition does not change WASM pointers, callbacks or command identifiers.
- Current runtime choices are NetHack 3.6.7, NetHack 5.0 and Slash'EM, defined by `NethackRuntimeVersion` in `src/runtime/types.ts`. Older wasm-37 WSL locations in the steering reference are source references, not current public artifact names.
- Current pointer ABI tags are defined by `vite.config.ts`: `VITE_NH3D_WASM_367_POINTER_ABI_TAG`, `VITE_NH3D_WASM_5_POINTER_ABI_TAG` and `VITE_NH3D_WASM_SLASHEM_POINTER_ABI_TAG`.
- Use the active runtime's callback/struct layout contract and validate shapes before reading memory. Do not scan arbitrary heap memory or silently replace unresolved command identifiers with guessed indices.
- The tracked 3.6.7 map extension uses `monsterId=0` for the player; positive ids identify monsters. Preserve that identity through engine tile/entity presentation.
- See [pointer ABI troubleshooting](../../docs/pointer-abi-troubleshooting.md) for callback formats and command-table diagnostics, and [world/runtime flows](../../docs/engine-world-runtime.md) for the engine receivers.

## High-Risk Zones

- Async input state in runtime: `activeInputRequest`, `awaitingQuestionInput`, `pendingTextRequest`, `pendingExtendedCommandRequest`, `pendingMenuSelection`.
- Position state: `positionInputModeActive` in `src/game/engine/input/position-selection.ts`; runtime far-look state `farLookMode`, `farLookOrigin`, and `pendingLookMenuFarLookArm` stays in `src/runtime/LocalNetHackRuntime.ts`.
- Tile classification: `src/game/glyphs/behavior.ts`, `src/game/glyphs/registry.ts`, `src/game/engine/world/world-classification.ts`, and `updateTile` in `src/game/engine/rendering/tile-rendering.ts`.
- Generated runtime catalogs (fallback/reference data): `src/game/glyphs/glyph-catalog.367.generated.ts`, `src/game/glyphs/glyph-catalog.5.generated.ts`, `src/game/glyphs/glyph-catalog.slashem.generated.ts`, `src/game/tilesets.generated.ts`, `src/game/vulture/vulture-monster-keys.367.generated.ts`.
- Update flow: `src/update/*` plus the UI in `src/ui/app/updates/`.
- Startup options and checkpoint recovery: `src/runtime/startup-init-options.ts`, `src/runtime/runtime-capabilities.ts`, and `src/storage/client-options-storage.ts`.
