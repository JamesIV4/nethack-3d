# Logic Hotspots Steering

This is a living steering doc. Update it whenever hotspots, ownership, or edit playbooks change.

Use this file when deciding where to implement a change.
Start with the [engine task-to-owner map](../../src/game/engine/README.md#code-hotspots), [runtime task-to-owner map](../../src/runtime/local/README.md#code-hotspots), or [React UI task-to-owner map](../../src/ui/README.md#code-hotspots). This playbook records the invariants to preserve after locating the implementation. Detailed guides: [movement and cursor flow](movement-flow.md), [world/runtime flows](../../docs/engine-world-runtime.md), and [project structure](project-structure.md).

## If You Need To Change Engine Wiring Or Shared State

- `src/game/engine/create-engine-systems.ts` constructs state-owning classes and wires their dependencies. Each class declares a `NameDependencies` interface containing the exact peer members it uses through `Pick` contracts.
- `src/game/engine/engine-coordinator.ts` is the contract for root lifecycle operations. `src/game/Nethack3DEngine.ts` implements the public controller and preserves startup, event, frame, mode-change and disposal sequencing.
- `src/game/engine/runtime/engine-state.ts` owns session/configuration and lifecycle fields such as `session`, `clientOptions`, `playMode`, `disposed`, and `domEventAbortController`. Player position belongs to `src/game/engine/world/player-movement.ts`, not this shared state holder.
- `src/game/engine/shared/types.ts` and `src/game/engine/shared/constants.ts` contain internal shared definitions. UI/controller contracts stay in `src/game/ui-types.ts`; runtime envelopes stay in `src/runtime/types.ts`.
- Peer-class imports should be type-only. Dependency getters resolve peers after construction; an initializer that eagerly reads a peer still requires that peer and its eager dependencies to be constructed first.
- Keep subsystem constructors free of runtime startup, browser listener registration and independent frame loops. State ownership does not eliminate cross-domain ordering requirements.

## If You Need To Change Rendering

- Start in `src/game/engine/rendering/tile-rendering.ts` (`updateTile`), `tile-materials.ts` (`applyGlyphMaterial`), and `glyph-textures.ts` (`createGlyphTexture`, `ensureGlyphOverlay`). `Nethack3DEngine.ts` coordinates their setup, runtime events and frame ordering.
- Glyph resolution and classification should prioritize live runtime data and NetHack/WASM callback paths whenever possible. Use these files for mapping/orchestration:
  - `src/game/glyphs/index.ts`
  - `src/game/glyphs/registry.ts`
  - `src/game/glyphs/behavior.ts`
  - `src/game/glyphs/glyph-catalog.367.generated.ts` (generated fallback/reference; not authoritative for all variant item tiles)
  - `src/game/glyphs/glyph-catalog.5.generated.ts` and `src/game/glyphs/glyph-catalog.slashem.generated.ts` (generated fallback/reference; not authoritative for all variant item tiles)
- Generated glyph catalogs are fallback references, not the final source of truth.
  If live runtime payloads disagree with the catalog, especially for item-like
  top-of-pile results, prefer the runtime payload.
- Tileset selection and asset resolution live in `src/game/tilesets.ts`.
- User tileset persistence lives in `src/game/user-tileset-storage.ts`.
- Vulture projection helpers live in `src/game/vulture/translation.ts`.
- If tile appearance changes affect overlays or material reuse, check the glyph overlay and reveal-fade code paths near `ensureGlyphOverlay`, `createGlyphTexture`, `applyGlyphMaterial`, and the tile reveal timing fields.
- Additional owners: `src/game/engine/rendering/wall-geometry.ts` for chamfer/door geometry, `floor-occlusion.ts` for floor ambient occlusion, `wall-overlays.ts` for overlay resources, and `vulture-walls.ts` / `vulture-projection.ts` for Vulture walls and projection.
- Entity appearance and texture references live in `src/game/engine/rendering/entity-billboards.ts`; held-weapon animation/rendering lives in `held-weapon.ts`. Entity move interpolation belongs to `src/game/engine/world/entity-movement.ts`.

## If You Need To Change Resource Lifetimes Or Frame Work

- Read the engine README's performance-sensitive cache rules before changing blood uploads, billboard proxies, pointer alpha masks, controller binding parses or decoded tile signatures. Keep invalidation tied to the real source revision; do not cache live NetHack glyph behavior by glyph number. See `docs/performance-pass.md` for the baseline comparison fixture.

- Root `animate` in `src/game/Nethack3DEngine.ts` polls controllers and advances entity transitions before camera updates, then updates presentation/effects before rendering. Preserve the root sequence when adding frame work.
- Root `clearScene` handles scene/level resets; it is distinct from full engine `dispose`. Root `applyClientOptions` / `applyPlayMode` coordinate mode changes and cache invalidation.
- `src/game/engine/rendering/render-pipeline.ts` owns the renderer/composer, viewport changes, `initAntialiasingPipeline`, `disposeAntialiasingPipeline`, and WebGL context diagnostics. Terminal cells are owned by `terminal-rendering.ts`; the orthographic camera is owned by `src/game/engine/camera/camera.ts`.
- `src/game/engine/rendering/tileset-assets.ts` owns `tilesetTexture` and `invalidateTilesetDependentCaches`. Glyph texture references are owned by `glyph-textures.ts`; billboard textures by `entity-billboards.ts`. Update all dependent caches when changing an atlas or appearance source.
- `src/game/engine/effects/` owns effect resources and animation. `clearDamageEffects` in `src/game/engine/world/combat-attribution.ts` coordinates effect cleanup across those owners.
- Engine `dispose` marks the lifecycle disposed, cancels the frame and aborts DOM listeners, clears interaction work, resets UI/scene, disconnects runtime/audio, then removes DOM and releases renderer/material/texture/geometry resources. Add a resource to each relevant clear, invalidation and disposal path.
- DOM handlers must be bound to their owning subsystem; use the shared abort signal. Keep pending touch, minimap, cursor and dialog callbacks from outliving their state/resources.

## If You Need To Change Runtime Event Behavior

- `src/runtime/LocalNetHackRuntime.ts` keeps callback guards and ordered dispatch in `handleUICallback`; emit sites live in the responsible `src/runtime/local/` owners and route through the root's `emit`.
- Runtime dependencies are assembled in `src/runtime/local/create-runtime-systems.ts`. Each owner declares exact peer members with `Pick` contracts; `runtime-coordinator.ts` exposes the root operations they use. Preserve live owner reads when a selection map, queue, or position object is replaced.
- Do not introduce a Promise boundary into a synchronous callback. Existing asynchronous menu, question, text, and position callbacks must retain their waiter identity and return timing.
- Worker transport lives in `src/runtime/runtime-worker.ts` and `src/runtime/WorkerRuntimeBridge.ts`.
- Engine receive and dispatch is `handleRuntimeEvent` in `src/game/Nethack3DEngine.ts`.
- Add or update event payloads in runtime and engine in one commit.
- Keep `src/runtime/types.ts` in sync when the command or envelope surface changes.

### Under-Player Loot / Flat-Feature Refresh Is A Hot Path

- The "item shown under the player" is a runtime-to-engine contract between:
  - `src/runtime/local/world/post-action-refresh.ts` and `src/runtime/local/world/under-player-items.ts`
  - `src/game/Nethack3DEngine.ts`
  - `src/game/engine/world/tile-updates.ts` and `src/game/engine/world/world-classification.ts`
  - the WASM helper functions `topItemGlyphUnderPlayer` and `topItemTileIndexUnderPlayer`
- Those helper functions are authoritative for the visible top-of-pile item on the
  current player tile. After partial pickup, drop, or any other stack mutation,
  the helper result wins over cached snapshots.
- The runtime emits:
  - `under_player_item_glyph`
  - `under_player_item_glyph_cleared`
- For authoritative under-player item events, the runtime now also carries
  live item-classification hints such as runtime `kind` and `glyphFlags`.
  The engine should preserve and reuse those hints instead of re-deriving kind
  solely from the generated glyph catalog.
- The engine consumes those in `handleRuntimeEvent` and updates:
  - `flatFeatureUnderPlayerCache`
  - `suppressedLootLikeUnderPlayerCacheKeys`
  - the affected tile via `refreshTileVisualFromStateCache(...)`
- Cache and event methods belong to `src/game/engine/world/world-classification.ts`; refresh queuing belongs to `src/game/engine/world/tile-updates.ts`; remembered `lastKnownTerrain` belongs to `src/game/engine/world/level-terrain-cache.ts`. See the [world/runtime guide](../../docs/engine-world-runtime.md) for the complete path.

### Runtime Model

- The runtime now tracks three pieces of pending state:
  - `pendingPostActionPlayerTileRefreshReason`
  - `pendingPostActionPlayerTileRefreshTarget`
  - `pendingPostActionPlayerTileRefreshSnapshot`
- The reason is priority-based. High-confidence pickup/loot intents should not be stomped by lower-priority fallbacks like `monster-like-vacated-tile`.
- The target matters for multi-step travel. If the player has not reached the armed tile yet, `maybeRefreshPendingPostActionPlayerTile(...)` must wait instead of refreshing the current tile.
- The snapshot matters for "moved onto loot but did not pick it up" cases. The runtime can replay the remembered loot glyph from the clicked target tile even when helper queries would now see only `@`.

### How It Currently Works

- Intent arming happens before NetHack finishes the action:
  - Mouse left-click on a remote loot-like tile arms `move-onto-lootlike-tile`.
  - Keyboard movement onto an adjacent loot-like tile arms `move-onto-lootlike-tile`.
  - Clicking the current player tile or pressing `,` arms `pickup-current-player-tile`.
  - Menu/question-driven inventory mutations still arm the older action-specific reasons.
- Stack mutations on the current tile do not trust the old snapshot after success:
  - partial pickup from a pile must re-query `topItemGlyphUnderPlayer` so the next
    remaining item becomes visible under the player
  - dropping onto the current tile must also re-query `topItemGlyphUnderPlayer`
    so the newly dropped item can become the visible top item immediately
  - eating or any other player action that can remove, add, or reorder the
    current-tile stack should also end in an authoritative helper refresh rather
    than trusting the stale snapshot
- Consume points are:
  - `handleShimNhPoskey`
  - `shim_update_inventory`
- `maybeRefreshPendingPostActionPlayerTile(...)` behaves differently by reason:
  - `move-onto-lootlike-tile` with a stored snapshot replays that snapshot once the player reaches the armed target.
  - Other reasons query helpers and emit the real current top item or a clear event.
- Successful pickup/autopickup uses raw text as an authoritative success signal:
  - Modern/3.4.3-style inventory assignment text like `f - a tripe ration.` or `$ - 7 gold pieces.` clears the pending target/current tile immediately.
  - Slash'EM also needs a runtime-specific bare-gold case like `28 gold pieces.` because it does not always use the inventory-assignment format.
- Slash'EM legacy drop flows can route through a `yn_function` prompt followed by
  a questionless `WIN_INVEN` menu after `*`. In that case, the runtime must use
  the active Y/N prompt text (`lastQuestionText`) as the action context when
  `currentMenuQuestionText` is empty, or the drop refresh will never arm.
- This split is intentional:
  - intent arming decides when we should care about a tile
  - raw-print pickup success decides when the loot is definitely gone
  - helper queries/snapshots decide what should remain visible under the player

### Engine Model

- The engine keeps the shared feature and terrain caches:
  - `flatFeatureUnderPlayerCache`: cached flat features and runtime-confirmed under-player item results
  - `lastKnownTerrain`: remembered terrain/floor state
- Entries in `flatFeatureUnderPlayerCache` carry runtime-side item-kind
  hints (`kind`, `glyphFlags`) in addition to `glyph`, `char`, `color`,
  `tileIndex`, and `symidx`.
- `classifyTileBehavior(...)` / `resolveGlyph(...)` should treat those runtime
  hints as authoritative when present, especially for under-player item events.
- `suppressedLootLikeUnderPlayerCacheKeys` prevents generic loot fallback from resurrecting stale loot after the runtime has explicitly cleared it. A clear event removes the corresponding feature-cache entry.
- `getPlayerTileUnderlaySnapshotFromCache(...)` prefers the shared feature cache, then the runtime floor underlay, then remembered terrain.
- There is no separate authoritative-under-player snapshot map. `applyUnderPlayerItemGlyphEvent` updates the shared feature cache and removes suppression for a valid visible result.

### Common Break Patterns

- Multi-step travel onto loot hides the loot under the player:
  - The runtime armed no target/snapshot for `move-onto-lootlike-tile`, or consumed it before the player reached the target.
- Clicking the current player tile or pressing `,` does not clear picked-up loot:
  - `pickup-current-player-tile` was never armed, often because helpers were unavailable during an active `nh_poskey`.
- Pickup succeeds but the loot reappears immediately:
  - A raw-print pickup-success message was treated like a later recheck instead of an authoritative clear.
  - Or the engine kept using `flatFeatureUnderPlayerCache` because suppression was not set.
- Partial pickup from a stack leaves the old top item under the player, or clears
  the pile entirely:
  - the runtime reused a stale snapshot instead of re-querying `topItemGlyphUnderPlayer`
  - or the helper result was unavailable in the loaded runtime artifact
  - or the engine reclassified a live runtime item result through the generated
    glyph catalog and treated it as a non-item
- Dropping onto the current tile does not show the new top item until the player
  moves away:
  - the drop action never armed a post-action refresh
  - or a legacy questionless inventory menu lost its question context and failed
    to classify as `drop-question`
  - or a live top-of-pile item result was decoded from runtime tile metadata
    but then downgraded by static catalog classification
- A stale current-tile pickup arm affects later travel:
  - `pickup-current-player-tile` was not cleared when a new remote target was chosen.
- 3.6.7 helper behavior seems impossible or inconsistent with source:
  - `copy-wasm` only copies `packages/wasm-367/build/nethack.js`; it does not
    rebuild it
  - if WSL source changed but the build artifact did not, the checked-in public
    runtime can be stale and miss helper installs like `topItemGlyphUnderPlayer`

### First Places To Check

- Runtime arm/clear points in `src/runtime/local/world/post-action-refresh.ts`:
  - `armPendingPostActionPlayerTileRefreshByReason`
  - `clearPendingPostActionPlayerTileRefreshByReason`
  - `clearPendingPostActionPlayerTileRefresh`
  - `clearPendingCurrentPlayerPickupRefreshIfTargetDiffers`
  - `maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget`
  - `maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot`
  - `resolvePostActionPlayerTileRefreshQuestionContext`
- Runtime consume / result points across `src/runtime/local/world/post-action-refresh.ts`, `world/under-player-items.ts`, `input/position-selection.ts`, and `menus/menu-capture.ts`:
  - `maybeRefreshPendingPostActionPlayerTile`
  - `handleShimNhPoskey`
  - `shim_update_inventory`
  - `armPendingPostActionPlayerTileRefreshForAutopickupRawPrint`
  - `isAutopickupInventoryAssignmentRawPrint`
  - `emitUnderPlayerItemGlyphFromPendingSnapshot`
  - `emitUnderPlayerItemGlyphIfAvailableAt`
- Runtime artifact/source-of-truth checks:
  - `scripts/wasm/copy-wasm.mjs`
  - `public/nethack-367.js`
  - `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-367\build\nethack.js`
- Engine receive/cache in `src/game/engine/world/world-classification.ts`, reached through `Nethack3DEngine.handleRuntimeEvent`:
  - `applyUnderPlayerItemGlyphEvent`
  - `clearUnderPlayerItemGlyphEvent`
  - `getPlayerTileUnderlaySnapshotFromCache`
  - `shouldRenderFlatFeatureUnderPlayer`
- Visual refresh: `refreshTileVisualFromStateCache` in `src/game/engine/world/tile-updates.ts`, then `updateTile` in `src/game/engine/rendering/tile-rendering.ts`.
- Shared glyph resolution/classification:
  - `resolveGlyph`
  - `classifyTileBehavior`
- Runtime event decode helpers in `src/runtime/local/world/glyphs.ts`:
  - `extractGlyphInfoTileIndex`
  - `extractGlyphInfoSymidx`
  - `extractGlyphInfoGlyphFlags`

### Rules To Preserve

- Keep intent arming and pickup-success handling separate. Do not try to infer every pickup from raw text alone.
- If you add a new way to move onto loot, arm `move-onto-lootlike-tile` with both target and snapshot.
- If you add a new way to pick up loot on the current tile, arm `pickup-current-player-tile` even when helpers are temporarily unavailable.
- After any successful stack mutation on the current tile, prefer the authoritative
  helper result over the old snapshot. This includes partial pickup, drop, eat,
  and any other player action that can mutate the visible pile.
- When the runtime provides authoritative item metadata for an under-player item
  event, do not let the generated glyph catalog override it back to a non-item
  kind. The catalog is a fallback, not the arbiter, in that path.
- If you add a new pickup success text variant, teach `isAutopickupInventoryAssignmentRawPrint(...)` about it only for the runtime that needs it.
- If a legacy runtime shows a questionless inventory menu immediately after a Y/N
  prompt, preserve the prompt context by falling back to `lastQuestionText` when
  arming the post-action refresh reason.
- Do not let generic `flatFeatureUnderPlayerCache` reintroduce loot after a runtime clear. Preserve the suppression-key behavior.
- If you change under-player event names or payloads, update runtime emitters and engine consumers in the same commit.
- If you change `shouldRenderFlatFeatureUnderPlayer`, verify pickup/drop/eat/use/autopickup on the player tile in both FPS and overhead tiles modes.

## If You Need To Change Input Or Menus

- Browser key mapping and dialog gating: `src/game/engine/input/keyboard-input.ts` (`handleKeyDown`) and `movement-input.ts`.
- Shared command submission: `src/game/engine/input/input-commands.ts`; question selections and counts: `src/game/engine/ui/question-menus.ts`.
- `QuestionMenus` owns `isInQuestion`, selection counts, pagination and pickup state. `DirectionPrompts` in `src/game/engine/ui/direction-prompts.ts` owns `isInDirectionQuestion` and direction overlay state. `PromptDialogs` in `src/game/engine/ui/prompt-dialogs.ts` owns text, inventory and information dialog state, including `isTextInputActive`.
- `src/game/engine/ui/extended-commands.ts` owns the extended-command palette, while `input-commands.ts` submits the resulting command. `src/game/engine/ui/modal-navigation.ts` owns DOM keyboard focus/scroll behavior; `src/game/engine/input/pointer-lock.ts` owns pointer-lock UI gating.
- Runtime input broker implementation: `src/runtime/input/RuntimeInputBroker.ts`.
- Runtime key normalization and enqueue path: `handleClientInput` in `src/runtime/local/input/client-dispatch.ts`, supported by `input/keyboard.ts`.
- Runtime consume path: `requestInputCode`, `consumeInputResult`, `waitForQuestionInput` in `src/runtime/local/input/input-requests.ts`.
- Callback owners: `input/input-requests.ts` for event/key waits, `input/questions.ts` for Y/N prompts, `input/position-selection.ts` for position input, and `input/text-input.ts` for text prompts. Mouse-token pointer writes are in `input/mouse-poskey.ts`. These paths are under `src/runtime/local/`.
- Runtime callback-kind targeting (`targetKinds`) should be preserved for synthetic, meta, and menu key sequences.
- Key callbacks:
  - `handleShimGetNhEvent`: non-blocking NetHack event-pump hook; does not consume command input.
  - `handleShimNhGetch`: blocking "get one key" wait for general event input.
  - `handleShimYnFunction`: y/n (and direction-style) question handler that emits question events and waits for response.
  - `handleShimNhPoskey`: position/direction input wait (x, y, mod pointers) used for far-look and cursor targeting.
  - `handleShimGetlin`: free-text prompt handler that emits `text_request` and writes the response buffer.
- Menu callbacks:
  - Capture and finalization live in `src/runtime/local/menus/menu-capture.ts`; selection and WASM result writes live in `menus/selection.ts`.
  - `shim_start_menu`: begins menu capture for a window.
  - `shim_add_menu`: appends a selectable menu row/item to the active menu.
  - `shim_end_menu`: finalizes menu content and prompt text before selection.
  - `shim_select_menu`: waits for/collects menu picks and writes selected items back to NetHack.
- Menu waiter isolation state:
  - Owned by `src/runtime/local/menus/selection.ts`, except extended-command requests in `input/extended-commands.ts`.
  - `pendingMenuSelection`
  - `menuSelectionReadyCount`
  - `pendingExtendedCommandRequest`
- Position and far-look state:
  - Runtime owner: `src/runtime/local/input/position-selection.ts`.
  - `farLookMode` (`none | armed | active`)
  - `farLookOrigin`
  - `pendingLookMenuFarLookArm`
  - `positionInputModeActive` in `src/game/engine/input/position-selection.ts` on the engine side
  - `position_input_state` and `position_cursor` emit paths

## If You Need To Change Inventory UX

- React row/context/drop interactions live in `src/ui/app/inventory/`; item eligibility is in `actions.ts`, geometry in `position.ts`, and runtime tile metadata resolution in `src/ui/app/tilesets/menu-glyphs.ts`.
- React question choice and selection helpers live in `src/ui/app/menus/question-choices.ts`. Keep category rows nonselectable and preserve runtime-specific shortcut and explicit tile decisions.
- Preserve existing hook registration order, shared row refs, pointer/touch release handling, menu portal placement and focus restoration when changing these interactions.
- Runtime inventory updates and inventory-help menus are produced by `handleShimEndMenu` for window 4 in `src/runtime/local/menus/menu-capture.ts`; snapshot state lives in `menus/inventory-snapshots.ts`.
- Engine inventory handling:
  - event handling: `inventory_update` case in `handleRuntimeEvent`
  - UI display: `updateInventoryDisplay`, `showInventoryDialog` in `src/game/engine/ui/prompt-dialogs.ts`
- Contextual inventory actions in the runtime use `pendingInventoryContextSelection` to route follow-up menu picks.
- Multi-pickup uses `isInMultiPickup`, `menuSelections`, and `menuSelectionReadyCount`.

## If You Need To Change Stats Or HUD

- React condition badges and line severity live in `src/ui/app/status/conditions.ts`; stat baselines and character-field formatting live beside it. Condition bit meanings differ across runtimes.
- Runtime status decode and flush batching:
  - Owner: `src/runtime/local/status/status.ts`; reconnect replay reads its latest cache in `world/global-snapshots.ts`.
  - `shim_status_update`: receives status field/value updates and batches them until flush/reset markers.
  - `statusPending`
  - `latestStatusUpdates`
- Engine field mapping and parsing: `updatePlayerStats` in `src/game/engine/ui/player-status.ts`.
- Rendering HUD bars and labels: `updateStatsDisplay` in the same subsystem.
- If status changes affect reconnects, check `runtime_globals_snapshot` and the store hydration path in `src/state/gameStore.ts`.

## If You Need To Change Camera Or Controls

- Keyboard movement mappings and dialog-aware suppression: `src/game/engine/input/keyboard-input.ts` and `movement-input.ts`.
- Mouse zoom, rotate, pan, and click-look handlers: `src/game/engine/input/mouse-input.ts`; touch gestures: `touch-input.ts`.
- Camera transform calculation: `updateCamera` in `src/game/engine/camera/camera.ts`.
- Position cursor state and far-look lifecycle: `src/game/engine/input/position-selection.ts`.
- Controller sampling/gameplay and dialog navigation: `src/game/engine/input/controller-gameplay.ts` and `controller-dialogs.ts`.
- `ControllerGameplay` owns button snapshots, release/rearm latches and movement previews. `ControllerDialogs` owns slider interaction, dialog repeat, focus and virtual cursor state. Preserve neutral/release transitions when changing bindings or prompt routing.
- `src/game/engine/input/touch-input.ts` owns touch gesture and long-press timers, including the FPS run button. Mouse drag state belongs to `mouse-input.ts`; raycast/alpha-hit rules belong to `pointer-targeting.ts`.
- `src/game/engine/ui/tile-context-actions.ts` owns active tile context and glance probes; `ui/aim-highlights.ts` owns FPS aim resources. Keep action inference separate from raycast target resolution and direction prompt state.
- Controller bindings and action labels live in `src/game/controller-bindings.ts`; React capture/navigation/wheel helpers live in `src/ui/app/controller/`, and option descriptors live in `src/ui/app/settings/config.ts`.

## If You Need To Change Minimap, Sound Or Developer Panels

- `src/game/engine/ui/minimap.ts` owns cell updates, viewport overlay, visibility and drag state. Camera recenter/pan behavior belongs to `src/game/engine/camera/camera.ts`.
- `src/game/engine/audio/audio-haptics-platform.ts` owns sound/rumble dispatch and platform detection. Sound matching is in `src/game/message-sound-hooks.ts`; FMOD implementation remains in `src/audio/FmodRuntime.ts`.
- `src/game/engine/diagnostics/fps-diagnostics.ts`, `held-weapon-animation-debug.ts`, and `vulture-projection-debug.ts` own the respective developer panels. Keep their remove/reset paths connected to root disposal.
- Public browser debug helpers remain in `src/app.ts`. Root engine delegators/getters preserve tile refresh, globals snapshots, info-menu toggling and `statusDebugHistory`; status history storage is in `src/game/engine/ui/player-status.ts`.

## If You Need To Change Tiles, Glyphs, Or World Classification

- Tile behavior decisions live in `src/game/glyphs/behavior.ts` and are consumed by `updateTile`.
- Glyph resolution/version selection lives in `src/game/glyphs/registry.ts`.
- Glyph catalogs are versioned, checked-in generated fallback references. They are useful for static mapping and debugging, but can be wrong for some item-variation tiles; prefer proper live WASM NetHack calls whenever possible.
- World/terrain helpers and tile classification assumptions should be verified against `src/runtime/displayFileCatalog.ts` and the imported NetHack data under `imported/nethack-3.6.7` when behavior depends on canonical game text or object data.

## If You Need To Change Startup Options, Saves, Or Updates

- Startup init option schema, defaults, normalization, and serialization live in `src/runtime/startup-init-options.ts`.
- Client option schema/defaults/normalization live in `src/game/ui-types.ts`.
- Client option UI and draft/apply flow live in `src/ui/app/settings/`; option descriptors and tab grouping live in `settings/config.ts`.
- Persisted client options and localStorage-to-IndexedDB migration live in `src/storage/client-options-storage.ts`.
- Engine-side application of options at runtime lives in `src/game/Nethack3DEngine.ts` (`setClientOptions`, `applyClientOptions`).
- Save database naming and mount logic live in `src/runtime/save-storage.ts`.
- Runtime checkpoint recovery support is gated in `src/runtime/runtime-capabilities.ts`.
- GitHub release/version checking lives in `src/update/github-version-checker.ts` and `src/update/types.ts`, with UI in `src/ui/app/updates/`. Packaging helpers remain under `scripts/updates/`.
- Save discovery and presentation helpers live in `src/ui/app/startup/saved-games.ts` and `save-presentation.ts`; score formatting, filtering and timeline presentation live in `src/ui/app/scores/`.

## If You Need To Change Level Transition Behavior

- Runtime triggers clear on map window reset: `handleShimClearNhwindow` in `src/runtime/local/messages/window-text.ts` (window-clear callback; map clears should emit `clear_scene`). The callback resets text capture and emits the event; it does not erase the runtime map cache.
- Engine clear path: `clearScene` and the `clear_scene` event case in `handleRuntimeEvent`.
- Player movement reconciliation is handled by `recordPlayerMovement` in `src/game/engine/world/player-movement.ts` and the engine's player position event branch. Level snapshots belong to `world/level-terrain-cache.ts`; visual movement transitions belong to `world/entity-movement.ts`.

## Sanity Checklist For Agents

- If changing the worker protocol, verify `src/runtime/types.ts`, `src/runtime/runtime-worker.ts`, `src/runtime/WorkerRuntimeBridge.ts`, `src/runtime/LocalNetHackRuntime.ts`, the affected `src/runtime/local/` owner, and `src/game/Nethack3DEngine.ts` together.
- If changing runtime artifacts or glyph catalogs, make sure the generated files stay aligned with the loaded runtime version.
- If changing menus or input, confirm Esc and Enter flow, direction prompts, inventory selection, far-look transitions, and extended commands still work.
- If changing broker behavior, ensure no callback bypasses `requestInputCode(...)` for key-consuming waits.
- If changing tile logic, verify player tracking, map refresh, and tile reveal behavior.
- If changing status updates, verify flush-trigger ordering and reconnect snapshot consistency.
- Run `npm run check:tsc` and relevant tests. Engine regression coverage lives in `src/game/engine/input/input-lifecycle.test.ts`, `src/game/engine/world/world-state.test.ts`, and `src/game/engine/rendering/rendering-resources.test.ts`. Browser checks are still needed for visible rendering, device interaction and complete teardown/restart.
