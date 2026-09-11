# Movement And Position Flow

This is a living steering doc. Update it whenever movement, input broker behavior, or position-mode flows change.

This document describes movement and position input across the engine subsystems and worker runtime. Use the [engine ownership map](../../src/game/engine/README.md#code-hotspots) to locate implementations and the [world/runtime guide](../../docs/engine-world-runtime.md) for player, map and item presentation.

It focuses on:

- Browser key intake and movement mapping.
- Runtime single-consume input broker flow.
- Shared callback consumption path for event, position, and question input.
- Far-look position FSM behavior.
- Player and cursor update emission.

## Main Files

- `src/game/Nethack3DEngine.ts`
  - `handleRuntimeEvent`
  - coordinates runtime events and frame updates; preserves the public controller API
- `src/game/engine/input/keyboard-input.ts`
  - `handleKeyDown`
- `src/game/engine/input/input-commands.ts`
  - `sendInput`, `sendInputSequence`, `sendMouseInput`
- `src/game/engine/input/movement-input.ts`
  - direction mapping and movement input gates
- `src/game/engine/input/position-selection.ts`
  - `setPositionInputMode`, `setPositionCursorPosition`, far-look selection
- `src/game/engine/ui/question-menus.ts`
  - question selection counts, pickup toggles, pagination and prompt state
- `src/game/engine/camera/camera.ts`
  - `updateCamera`
- `src/game/engine/world/player-movement.ts`
  - `recordPlayerMovement`
- `src/game/engine/rendering/tile-rendering.ts`
  - `updateTile`
- `src/game/engine/input/controller-gameplay.ts` and `controller-dialogs.ts`
  - controller sampling/gameplay and dialog navigation, respectively
- `src/game/engine/input/mouse-input.ts`, `touch-input.ts`, and `pointer-targeting.ts`
  - device events/gesture state and tile raycast targeting
- `src/game/engine/ui/direction-prompts.ts`, `prompt-dialogs.ts`, and `tile-context-actions.ts`
  - direction overlay, text/inventory/info UI, and context/glance state
- `src/game/engine/audio/audio-haptics-platform.ts`
  - movement footstep arming and cliparound sound dispatch
- `src/runtime/WorkerRuntimeBridge.ts`
  - `sendInput`
  - `sendInputSequence`
  - `sendMouseInput`
- `src/runtime/runtime-worker.ts`
  - command forwarding for `send_input`, `send_input_sequence`, and `send_mouse_input`
- `src/runtime/LocalNetHackRuntime.ts`
  - `handleClientInput`
  - `requestInputCode`
  - `consumeInputResult`
  - `handleShimGetNhEvent`
  - `handleShimNhGetch`
  - `handleShimYnFunction`
  - `handleShimNhPoskey`
  - `shim_cliparound`
  - `shim_curs`
- `src/runtime/input/RuntimeInputBroker.ts`
  - broker queue and waiter coordination

## Runtime Movement Assumptions

Runtime boot config includes:

- `number_pad:1`: can be changed by the user mid-game.
- `pickup_types:$`

`number_pad:1` is still required because both engine and runtime translate directional input using numpad semantics.

## Engine State Owners

| State | Owner under `src/game/engine/` |
| --- | --- |
| `playerPos`, `hasPlayerMovedOnce`, predicted and recent player tiles | `world/player-movement.ts` |
| `cameraYaw`, `cameraPitch`, `cameraPanX`, `cameraPanY`, step/far-look camera state | `camera/camera.ts` |
| `positionInputModeActive`, `positionInputOrigin`, `positionCursor`, `hasRuntimePositionCursor` | `input/position-selection.ts` |
| `isInQuestion`, active question text/items, pickup selections/counts/pages | `ui/question-menus.ts` |
| `isInDirectionQuestion`, direction overlay pointer state | `ui/direction-prompts.ts` |
| `isTextInputActive`, inventory/info dialog visibility and refresh state | `ui/prompt-dialogs.ts` |
| `numberPadModeEnabled`, repeat action and command prefixes | `input/input-commands.ts` |
| `controllerPreviousActionState`, movement previews, confirm/cancel rearm latches | `input/controller-gameplay.ts` |
| Controller dialog focus/repeat/slider and virtual cursor state | `input/controller-dialogs.ts` |
| Mouse button/drag state; touch gestures/long-press/run-button state | `input/mouse-input.ts`; `input/touch-input.ts` |
| `fpsCrosshairGlancePending`, context target and action selection | `ui/tile-context-actions.ts` |

Runtime waiters and far-look FSM state remain in `src/runtime/LocalNetHackRuntime.ts`. These engine state holders control presentation and routing; they do not replace the input broker or NetHack state.

## End-To-End Flow (Normal Movement Key)

1. Browser keydown enters `KeyboardInput.handleKeyDown`, registered by the engine with the keyboard subsystem as its receiver.
2. Engine applies input gates and remaps for dialogs, direction prompts, movement remaps, command shortcuts, and meta handling.
3. Engine sends input via `sendInput`, or `sendInputSequence` for synthetic multi-key flows, or `sendMouseInput` for click-based actions.
4. `WorkerRuntimeBridge` posts `send_input`, `send_input_sequence`, or `send_mouse_input` to the worker.
5. `runtime-worker.ts` forwards the command to `LocalNetHackRuntime`.
6. `LocalNetHackRuntime.handleClientInput` normalizes the key and enqueues it into `RuntimeInputBroker` as an `InputToken`.
7. NetHack callback waits request input through `requestInputCode(kind)`.
8. The broker returns exactly one token for exactly one request, in FIFO order, when the token matches the request kind.
9. Runtime converts the key with `processKey` and returns one keycode to NetHack.
10. NetHack advances state and emits updates such as `shim_cliparound`, `shim_print_glyph`, status updates, menus, and text callbacks.
11. Runtime emits worker events like `player_position`, `map_glyph_batch`, `position_cursor`, and `status_update`.
12. Engine consumes runtime events in `handleRuntimeEvent`.

## Runtime Input Broker Model

### Core Types

- `InputToken`: `{ key, source, createdAt, targetKinds?, mouseX?, mouseY?, mouseMod? }`
- `InputRequestKind`: `event`, `position`, or `menu`
- `InputConsumeResult`: request outcome or cancel code

### Invariants

- Single consume: one token is consumed by one waiter only.
- FIFO ordering: input order is stable across callbacks.
- Kind-aware routing: tokens can be tagged for specific callback kinds using `targetKinds`.
- No replay: there is no cooldown-based latest-input reuse.
- Shared path: event, position, and question waits all consume through the broker.
- Queue bound: the broker drops overflow once the queue reaches its max size.

### API

- `enqueueTokens(tokens)`
- `requestNext(requestKind)`
- `cancelAll(cancelCode)`
- `drain()`
- `dequeueToken()` and `prependToken()` for extended-command parsing

## Callback Consumption Rules

### `shim_get_nh_event`

- This callback is a non-blocking event pump hook.
- It should not consume command input.
- It is used to keep NetHack's event loop moving while other waits own the actual input requests.

### `shim_nhgetch`

- Uses `handleShimNhGetch` and calls `requestInputCode("event")`.
- This is one of the main event-key waits.

### `shim_yn_function`

- Uses `handleShimYnFunction`.
- For direction questions and normal y/n prompts, waits through `waitForQuestionInput()`, which internally uses `requestInputCode("event")`.
- Some prompts are auto-answered in runtime before the broker wait, such as container-related and checkpoint recovery flows.

### `shim_nh_poskey`

- Uses `handleShimNhPoskey` and calls `requestInputCode("position")`.
- Integrates with the explicit far-look FSM below.
- No duplicate consumption from queue and cached input mix.

## Far-Look Position FSM

`farLookMode` values:

- `none`
- `armed`
- `active`

Transitions:

1. `none -> armed` when `;` is consumed.
2. `armed -> active` when the next `shim_nh_poskey` begins.
3. `active -> none` on far-look exit input such as `Escape` or `Enter`, or when the runtime resolves the follow-up position request.

Related state and events:

- `farLookOrigin` tracks whether the far-look request came from a direct action or a look-menu path.
- `pendingLookMenuFarLookArm` preserves the arm state across look-menu routing.
- `position_input_state` is emitted when entering or exiting active position mode.
- `position_cursor` is emitted from `shim_curs` and cliparound-in-position context.

## Menu Input Isolation

Menu selection state is isolated from the general broker path:

- `pendingMenuSelection` tracks only the active menu completion wait.
- `menuSelectionReadyCount` stores the completion result until `shim_select_menu` consumes it.
- Multi-pickup toggle keys are handled in menu mode without leaking into unrelated event waits.
- `pendingInventoryContextSelection` tracks contextual inventory actions such as drop/wear/use follow-ups.

`shim_select_menu` still writes `menu_item` structs via pointer arguments, but waiting and resolution are centralized to menu-specific state.

## Meta And Extended Commands

- Meta input remains encoded as deterministic token expansion.
- Standard meta behavior: enqueue `Escape` then the primary key token.
- Bound meta extended commands enqueue `#`, command text, then `Enter`.
- Extended command parsing consumes from the broker queue and pushes back non-command tokens using `prependToken()`.

## Status Updates And Player Tracking

- `shim_status_update` accumulates updates in `statusPending`.
- On flush or reset pseudo-fields, runtime emits batched `status_update` events in stable field order.
- `latestStatusUpdates` remains the reconnect snapshot source.
- `player_position` comes from `shim_cliparound`.
- `recordPlayerMovement` keeps the engine movement-dependent UX aligned with the runtime consume model.
- `positionInputModeActive` on the engine controls whether movement keys are routed as player movement or position selection.
- When tracked wasm-367 map glyph payloads include `monsterId=0` for the player tile, the engine should prefer that tracked entity move path for player step lerps and must not start a duplicate fallback player transition for the same move.
- In that tracked-player path, the source tile may already have been repainted with another occupant before the destination player glyph arrives, so movement visuals must prefer the cached player appearance over the live source tile state.

## Under-Player Loot Flow

- This flow is shared between runtime input handling, runtime callback handling, and engine under-player rendering.
- The runtime-side pending state is:
  - `pendingPostActionPlayerTileRefreshReason`
  - `pendingPostActionPlayerTileRefreshTarget`
  - `pendingPostActionPlayerTileRefreshSnapshot`
- The engine-side render state is:
  - `flatFeatureUnderPlayerCache`
  - `suppressedLootLikeUnderPlayerCacheKeys`
  - `lastKnownTerrain`
- The feature cache and suppression keys belong to `src/game/engine/world/world-classification.ts`; remembered terrain belongs to `world/level-terrain-cache.ts`. Tile refresh methods belong to `world/tile-updates.ts`.
- The authoritative source of "what is visibly on top of the pile under the
  player right now" is the WASM helper `topItemGlyphUnderPlayer`
  (and `topItemTileIndexUnderPlayer` when available for tile decode).
- In that path, the generated glyph catalog is only a fallback. If the runtime
  provides authoritative item metadata for the current top-of-pile result, that
  runtime metadata should win over static catalog classification.

### Move Onto Loot

- Mouse left-click on a remote tile and keyboard movement both try to arm `move-onto-lootlike-tile` before the input is consumed.
- That arm stores:
  - the destination tile as `pendingPostActionPlayerTileRefreshTarget`
  - a loot snapshot from the runtime map as `pendingPostActionPlayerTileRefreshSnapshot`
- This is required for multi-step travel. If the player clicks loot two or more tiles away, intermediate `cliparound` / `nh_poskey` callbacks must not refresh the old current tile.
- `maybeRefreshPendingPostActionPlayerTile(...)` waits until the player actually reaches the armed target.
- Once the player reaches the target:
  - if the loot was not picked up, the runtime replays the stored snapshot with `under_player_item_glyph`
  - if pickup already succeeded, the runtime should have emitted a clear instead

### Stack Mutation On Current Tile

- Partial pickup from a pile is not a simple clear case.
- If the player removes only the top item from a stack, the runtime must refresh
  from `topItemGlyphUnderPlayer` so the next visible item becomes the new
  under-player item.
- Dropping an item onto the current tile also requires a helper refresh, because
  the dropped item may become the new visible top-of-pile item immediately.
- Eating or any other player action that removes, adds, consumes, or reorders
  items on the current tile should be treated the same way: refresh from the
  helper instead of trusting the previous snapshot.
- Do not reuse the old `move-onto-lootlike-tile` snapshot after a successful
  current-tile inventory mutation. The snapshot is only for "moved onto loot but
  it was not picked up yet".

### Pick Up Loot On Current Tile

- Clicking the current player tile or pressing `,` arms `pickup-current-player-tile`.
- If helper queries are available, the runtime confirms that the current top item is loot-like before arming.
- If helpers are temporarily unavailable during `nh_poskey`, the runtime still arms optimistically. This is required for current-tile pickup from mouse input.
- If a later remote movement target is chosen, stale `pickup-current-player-tile` state must be cleared so it does not leak into travel decisions.

### Pickup Success And Autopickup

- Pickup success is not inferred only from movement. The runtime also looks for authoritative pickup-success text.
- Modern inventory-assignment raw prints such as `f - a tripe ration.` and `$ - 7 gold pieces.` mean the item is gone and should clear the pending target/current player tile immediately.
- Slash'EM also needs a runtime-specific bare-gold case like `28 gold pieces.` because that runtime does not always emit the assignment format for autopickup.
- After a pickup-success signal, the runtime should not blindly clear if the
  player is standing on a stack. It should refresh from the helper when a new
  top item might remain visible under the player.

### Legacy Slash'EM Drop Flow

- Slash'EM can route drop through:
  1. `shim_yn_function("What do you want to drop? ...")`
  2. auto-answer with `*`
  3. a questionless `WIN_INVEN` menu
- In that path, `currentMenuQuestionText` may be empty even though the action is
  still logically a drop question.
- When arming the post-action refresh from the selection, the runtime must fall
  back to `lastQuestionText` if the current menu question is empty.
- If this fallback is missing, the item dropped onto the current tile will not
  appear under the player until they step off the tile.

### Runtime Artifact Caveat

- `scripts/wasm/copy-wasm.mjs` only copies built artifacts from the WSL build
  directories into `public/`.
- If the WSL source changed but `packages/wasm-367/build/nethack.js` was not
  rebuilt, the checked-in/public 3.6.7 runtime can be stale and miss helper
  installs even when the source-side `libnhmain.c` is correct.

### Engine Expectations

- `under_player_item_glyph` is authoritative when the runtime says an item should still be visible under the player.
- `under_player_item_glyph_cleared` is authoritative when the runtime says it is gone.
- `under_player_item_glyph` may now include runtime-side item hints such as
  `kind` and `glyphFlags`. Preserve those through the under-player snapshot path
  so later re-renders do not depend solely on the generated glyph catalog.
- `applyUnderPlayerItemGlyphEvent` stores the runtime result and its metadata in `flatFeatureUnderPlayerCache`, then refreshes that tile.
- `clearUnderPlayerItemGlyphEvent` removes the cached feature and records the key in `suppressedLootLikeUnderPlayerCacheKeys` so generic loot fallback cannot undo an explicit clear.
- `getPlayerTileUnderlaySnapshotFromCache` resolves the shared feature cache and remembered terrain. There is no separate authoritative-under-player snapshot map.

## Camera Follow Behavior

Camera behavior is implemented in `src/game/engine/camera/camera.ts`:

- follows `playerPos` each frame with smoothing
- pan offsets remain additive
- overhead follow can target the active far-look cursor; FPS far-look owns its orbit and return transition
- a cursor event received before the position-mode activation event is preserved

## Subsystem Lifecycle

- Engine event dispatch remains synchronous; moving input and camera methods into classes does not introduce a queue or change worker messages.
- The command subsystem is the single submission path for keyboard, controller, touch and UI commands.
- Question state belongs to `QuestionMenus`; position state belongs to `PositionSelection`; their reset operations must finish before pointer-lock reacquisition or the next runtime event observes them.
- DOM event listeners are bound to the subsystem that owns the handler and retain the engine's abort signal. Engine disposal aborts listeners and clears gesture/prompt timers before disposing runtime and rendering resources.
- Device dispatch converges in `InputCommands`; preserve atomic synthetic sequences and the distinction between movement, direction answers and position selection. A position/direction input must not arm player-movement prediction as though the player had moved.
- `ControllerGameplay.updateControllerInput` runs from the root frame before camera updates. Touch timers and pointer-lock transitions remain part of input lifecycle, not independent polling loops.
- Automated regressions in `src/game/engine/input/input-lifecycle.test.ts` cover early cursor publication, position exit cleanup, pickup confirmation/reset ordering, movement suppression in prompt modes, atomic forced-direction submission and cancel precedence. Use the manual checks below for visible/device behavior.

## Invariants To Preserve

- Keep public worker command names stable: `send_input`, `send_input_sequence`, `send_mouse_input`.
- Keep runtime event payload shapes stable for engine consumers.
- Keep all key-consuming callbacks routed through broker request flow.
- Do not reintroduce cooldown or latest-input replay logic.
- Keep menu waiters isolated from non-menu input waiters.
- Keep far-look state transitions deterministic and observable.
- Keep under-player loot flow aligned across runtime and engine:
  - move-intent arming for remote loot tiles
  - current-tile pickup arming for mouse-on-player-tile and `,`
  - target-gated refresh for multi-step travel
  - pickup-success raw-print clearing
  - runtime events `under_player_item_glyph` / `under_player_item_glyph_cleared`
  - engine suppression of stale generic loot fallback after an explicit clear
  - runtime item-kind hints surviving snapshot storage and later tile
    classification, rather than being overwritten by static catalog entries

## Manual Validation Checklist

1. Cardinal movement with `hjkl`, arrows, and numpad.
2. Diagonal movement with `yubn`, numpad, `Home`, `PageUp`, `End`, and `PageDown`.
3. Hold-to-repeat movement without an extra step on release.
4. Wait behavior with `.` and Space.
5. Direction prompts and closure behavior.
6. Far-look `;` flow, cursor motion, and clean exit.
7. Multi-pickup toggles, confirm, and cancel.
8. Inventory and single-select question flows.
9. Meta, Alt, and extended command entry.
10. Escape across menus, questions, and position mode.
11. Single-step move onto non-autopicked loot still showing that loot under the player.
12. Multi-step move onto non-autopicked loot still showing that loot under the player only after the player reaches the target tile.
13. Clicking the current player tile to pick up loot clears the loot under the player.
14. Pressing `,` to pick up loot clears the loot under the player.
15. Autopickup gold/items clearing the under-player loot in 3.6.7-style runtimes.
16. Slash'EM bare-gold autopickup text also clearing the under-player loot.
17. Partial pickup from a stack replaces the old top item with the remaining top item under the player.
18. Dropping an item onto the current tile immediately shows the dropped item or new top-of-pile item under the player.
19. Slash'EM `drop` through legacy `yn_function` plus `*` still updates the under-player top item without requiring movement.
20. Pickup, drop, eat, and other inventory mutations keep the item shown under the player in sync in both FPS and overhead views.
21. In runtimes that return odd high glyph numbers for top-of-pile items, the
    under-player item still renders correctly when the runtime tile metadata says
    it is an item.
