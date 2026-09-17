# World state and runtime presentation

This guide locates the code that turns NetHack runtime events into remembered world state and visible tiles. The [engine subsystem guide](../src/game/engine/README.md) describes construction, dependency interfaces, and ownership across the whole engine.

## Runtime boundary

[LocalNetHackRuntime](../src/runtime/LocalNetHackRuntime.ts) coordinates startup, callback guards and dispatch, public commands, and shutdown in the worker. Its [runtime subsystems](../src/runtime/local/README.md) own callback decoding, input waits, caches, ABI handling, and persistence; [create-runtime-systems.ts](../src/runtime/local/create-runtime-systems.ts) assembles their explicit dependencies before WASM starts. [runtime-worker.ts](../src/runtime/runtime-worker.ts), [WorkerRuntimeBridge](../src/runtime/WorkerRuntimeBridge.ts), and [protocol owners](../src/runtime/protocol/) transport versioned, ordered commands and observations. [Nethack3DEngine.handleRuntimeEvent](../src/game/Nethack3DEngine.ts) still receives each observation through its established handler in order; presentation implementations live under `src/game/engine/`.

The event and command envelope types are in [runtime/types.ts](../src/runtime/types.ts). Engine-side shared types, such as level snapshots and tracked entity appearances, are in [engine/shared/types.ts](../src/game/engine/shared/types.ts).

## Where to change behavior

| Concern | Owner and starting methods |
| --- | --- |
| Worker map/player callback decoding and runtime map cache | [local/world/map-callbacks.ts](../src/runtime/local/world/map-callbacks.ts): `handleShimPrintGlyph`, `handleShimCliparound`, `handleShimCurs` |
| Worker player-tile refresh intent and authoritative item results | [local/world/post-action-refresh.ts](../src/runtime/local/world/post-action-refresh.ts), [local/world/under-player-items.ts](../src/runtime/local/world/under-player-items.ts) |
| Worker status batching and reconnect replay | [local/status/status.ts](../src/runtime/local/status/status.ts), [local/world/global-snapshots.ts](../src/runtime/local/world/global-snapshots.ts) |
| Map event batching and refresh requests | [protocol/event-batches.ts](../src/runtime/protocol/event-batches.ts), [protocol/refresh-requests.ts](../src/runtime/protocol/refresh-requests.ts), and [world/tile-updates.ts](../src/game/engine/world/tile-updates.ts) |
| Glyph classification and features under the player | [world/world-classification.ts](../src/game/engine/world/world-classification.ts): `classifyTilePayload`, `shouldRenderFlatFeatureUnderPlayer`, `applyUnderPlayerItemGlyphEvent`, `clearUnderPlayerItemGlyphEvent` |
| Level identity, snapshots, and restoration | [world/level-terrain-cache.ts](../src/game/engine/world/level-terrain-cache.ts): `persistActiveLevelTerrainCache`, `beginPendingLevelCacheTransition`, `maybeFinalizePendingLevelCacheTransition`, `restoreLevelTerrainCacheEntry` |
| Dark corridor discovery and inferred walls | [world/dark-corridor-inference.ts](../src/game/engine/world/dark-corridor-inference.ts): `beginDarkCorridorDiscoveryWindowFromPlayerInput`, `requestInferredDarkCorridorWallReconcile` |
| Player position, prediction, and stale player glyphs | [world/player-movement.ts](../src/game/engine/world/player-movement.ts): `recordPlayerMovement`, `getFpsPlayerTileRelationFlags` |
| Runtime entity IDs and last-seen appearances | [world/runtime-entity-tracking.ts](../src/game/engine/world/runtime-entity-tracking.ts): `updateRuntimeMonsterTrackingFromTile`, `finalizePendingRuntimeMonsterVacatedTracking` |
| Entity motion and deferred visual updates | [world/entity-movement.ts](../src/game/engine/world/entity-movement.ts): `beginOrRetargetEntityMoveTransition`, `applyDeferredEntityVisualUpdateForKey`, `updateEntityMoveTransitions` |
| Tile meshes and overlays | [rendering/tile-rendering.ts](../src/game/engine/rendering/tile-rendering.ts): `updateTile`; see the rendering directory for material, texture, geometry, and billboard owners |
| Combat targeting and damage presentation requests | [world/combat-attribution.ts](../src/game/engine/world/combat-attribution.ts): `tryResolvePendingCharacterDamage`, `captureDamageFromMessage`, `triggerDamageEffectsAtTile` |
| Minimap cells and tracked player marker | [ui/minimap.ts](../src/game/engine/ui/minimap.ts): `queueMinimapTileUpdate`, `queueRuntimeTrackedPlayerMinimapTile`, `flushPendingMinimapTileUpdates` |
| Status fields and runtime snapshots | [ui/player-status.ts](../src/game/engine/ui/player-status.ts): `updatePlayerStats`, `applyRuntimeGlobalsSnapshot`, `updateStatsDisplay` |
| Run history and postmortem display | [world/run-telemetry.ts](../src/game/engine/world/run-telemetry.ts) records run events; [ui/game-over.ts](../src/game/engine/ui/game-over.ts) owns reports and deferred reveal state |

## Map updates and player movement

A single `map_glyph` event updates runtime entity tracking, captures level-transition observations, attempts transition resolution, resolves pending character damage, and enqueues the tile. A `map_glyph_batch` first captures its complete set of transition observations and attempts transition resolution, then tracks entities, resolves damage, and enqueues each tile. Keep these paths' existing order when changing dispatch.

`TileUpdates` owns `pendingTileUpdates`, the frame-budgeted flush queue, and `tileStateCache`. Before replacing a pending update for the player tile, it lets `WorldClassification` preserve terrain or a flat feature from the superseded payload. Flushes update visual state and finish vacated entity tracking when the flush queue drains, then flush minimap and Vulture reconciliation work. Neighbor-dependent wall, door and floor-occlusion updates deduplicate within each chunk.

Duplicate-signature billboard reconciliation must match `TileRendering.updateTile`:
overhead 3D ASCII entities use raised billboards too. An unchanged player glyph
after pickup or a terrain change must preserve its existing billboard; the FPS
player suppression and deferred movement checks still apply.

`player_position` is the authoritative position update. The dispatcher ignores it while position-input mode is active, since a selection cursor must not move the player. It resolves any pending level transition, records movement using the old position, assigns `PlayerMovement.playerPos`, and immediately reconciles only the old/new player neighborhoods. Remaining discovery visuals keep the normal per-frame budget. `map_cursor` supplies prediction hints; it does not replace that authoritative position flow.

Dark corridor observations are recorded when they enter the queue. Inference evaluates every authoritative player step and again on `map_update_complete`, which the bridge delivers after the runtime's ordered map-display or snapshot-complete boundary. It reads a temporary view of pending terrain, with newer arrivals overriding the unfinished visual queue; render caches stay untouched until their tiles are processed. Queued floors suppress inferred walls immediately. Camera/player motion and distant mesh rebuilding do not delay this evaluation. The shared frame also checks dirty observations for legacy delivery paths.

Inferred walls must bypass FPS player-floor suppression, including predicted and animated step destinations. Otherwise a reconciliation during movement can leave a tile flagged as inferred but rendered as a passable floor, enabling the movement glow until another action redraws it. Real runtime player/floor observations still replace inferred walls normally. `inferred-wall-prediction.test.ts` checks wall geometry, passability, highlight visibility and subsequent authoritative replacement.

## Features and loot under the player

Three pieces of state have different roles:

- `LevelTerrainCache.lastKnownTerrain` remembers persistent terrain beneath transient entities.
- `WorldClassification.flatFeatureUnderPlayerCache` remembers visible flat features and loot, including runtime item metadata when supplied.
- `WorldClassification.suppressedLootLikeUnderPlayerCacheKeys` blocks generic cache seeding from restoring loot after a runtime clear.

The worker emits `under_player_item_glyph` or `under_player_item_glyph_cleared`; the root routes these to `WorldClassification`. Item updates preserve runtime `kind`, `glyphFlags`, character, color, atlas tile index, and symbol index. A partial event can reuse metadata from a remembered item with the same glyph. A clear removes the cached feature and adds the suppression key. A fresh accepted item update clears suppression and refreshes that tile's visual.

These handlers are active in FPS mode and in overhead tiles mode when under-player features are enabled. Shared classification in [glyphs/behavior.ts](../src/game/glyphs/behavior.ts) and [glyphs/registry.ts](../src/game/glyphs/registry.ts) must preserve live runtime classification hints. Generated glyph catalogs remain fallback data; a runtime object must not become a monster merely because its number falls in a static catalog's monster range.

For pickup, partial pickup, drop, eat, or travel onto loot, inspect both ends: the runtime's pending post-action refresh and helper result, then the engine's feature cache and suppression behavior. A rendering fix alone cannot recover a missing runtime item event.

Vulture keeps cached doorway terrain beneath actors and loot so the doorway's
rough floor, door planes, and adjacent wall faces survive occupancy. Do not apply
the atlas-only canonical room-floor substitution to Vulture. Wall corners and
junctions use cmap semantics to retain faces bordering known cardinal floors;
their ASCII `-` or `|` does not imply a straight wall. Inferred corridor walls
use the explicit inferred-wall flag because their stone glyph carries no bend
orientation. Diagonal floor decor must not create cardinal faces against walls
or void, and does not add diagonal refresh dependencies. Vulture asset identities follow NetHack 3.6, so
NetHack 5 glyph offsets must be normalized through semantic symbols and tile
translation before selecting those assets.

Vulture sprite images warm one at a time after 750 ms without input or runtime
events, using browser idle callbacks with spare time. Keyboard, pointer, touch,
wheel, controller and submitted game input pause the queue; input cancels a
background image unless a visible sprite has already adopted that request.
Background completion does not rebuild scene textures or show the compilation
indicator. Visible asset requests retain the existing refresh path. Pending
billboards are transparent instead of showing grey placeholder squares.
Translator disposal cancels idle callbacks and removes input listeners. Browsers
without idle callbacks retain on-demand loading.

Vulture treats `S_darkroom` as loss of visibility for a previously observed room,
not as a terrain replacement. Keep room membership and each coordinate's last
resolved floor/decor lookup so rugs and neighboring wall styles do not change
when the room leaves sight. Genuine terrain changes invalidate that remembered
floor artwork; clearing the runtime map resets it with the other decor state.

On the worker side, `RuntimePostActionRefresh` owns pending refresh reasons, targets and snapshots; `RuntimeUnderPlayerItems` queries and emits authoritative item results. `RuntimeMapCallbacks` owns `gameMap` and player position, and `RuntimeTileRefresh` owns legacy refreshes plus identified cell sets. Cached responses do not satisfy a fresh-data obligation: identified sets complete only after helper-safe querying or an explicit unavailable/failed/cancelled outcome. These owners read live peer state through declared dependencies so a replaced position or collection is visible immediately.

## Level transitions and snapshots

The worker's `handleShimClearNhwindow` in [local/messages/window-text.ts](../src/runtime/local/messages/window-text.ts) resets window text and emits `clear_scene` for the map window. It retains the worker map cache. `RuntimeGlobalSnapshots.sendReconnectSnapshot` also starts with `clear_scene`, then replays commands, map chunks, player position, latest status, inventory and recent text in order.

The `clear_scene` event follows this order:

1. `persistActiveLevelTerrainCache()` drains pending map updates and saves the outgoing level.
2. `beginPendingLevelCacheTransition()` starts collecting identity and tile observations for the incoming level.
3. The root's `clearScene()` clears active visuals and transient world state.

The level cache owns deterministic runtime identity and fallback identity resolution, including wall-sample comparisons where a descriptor is ambiguous. Restoration copies saved maps, sets, and terrain records into their current subsystem owners, refreshes cached visuals, then overlays newly observed tiles. Ground blood is captured and restored through [effects/blood-ground.ts](../src/game/engine/effects/blood-ground.ts).

Keep saved snapshots isolated from active state: changing a terrain record after returning to a level must not mutate its saved entry. Dependencies must read the owning subsystem's current map, because restoration can replace a map object rather than only modify its entries.

## Tracked entities and effects

Runtime entity ID `0` is the player; positive IDs are monsters. `RuntimeEntityTracking` owns ID-to-tile and tile-to-ID indexes plus last-seen appearance state. A vacated tile can remain a pending movement source until a later tile in the batch supplies its destination. Finalizing vacated tracking too early loses that source and can break movement animation or effect placement.

`EntityMovement` owns movement transitions and deferred visual payloads. `CombatAttribution` resolves hit and defeat presentation using current or last-seen entity positions and dispatches effects to the rendering/effects subsystems. Keep identity tracking separate from deleting an entity's last-seen appearance; defeat effects may still need that appearance after the entity leaves the map.

The minimap follows the tracked player ID and restores the previous player's minimap cell from remembered terrain when the tracked tile changes.

## Status, debugging, and validation

The worker's `RuntimeStatus` decodes callback values, updates its latest-value cache, and batches pending fields until a flush marker. Flushes sort numeric field indices and clear pending state before emitting. Keep that ordering and the reconnect snapshot's live cache reads stable when changing runtime dependencies.

`PlayerStatus` decodes status fields, stores runtime globals and object-to-tile mappings, and sends HUD state through the UI adapter. It also notifies level-identity tracking when relevant status fields arrive. Status baselines survive `clearScene()` so damage and stat deltas remain meaningful across redraws; `connectToRuntime()` resets them for a new session.

[src/app.ts](../src/app.ts) registers the browser helpers `refreshTile`, `refreshArea`, `refreshPlayerArea`, `requestRuntimeGlobalsSnapshot`, `dumpRuntimeGlobals`, and `dumpStatusDebug`. They continue to use the root facade. `requestRuntimeGlobalsSnapshot()` requests fresh worker state asynchronously; `dumpRuntimeGlobals()` reads the most recently received snapshot. For callback decode or pointer-layout failures, use [Pointer ABI troubleshooting](pointer-abi-troubleshooting.md).

[world-state.test.ts](../src/game/engine/world/world-state.test.ts) exercises live item metadata, stale-loot suppression, snapshot isolation and restore ordering, monster vacate/arrival batches, and tracked-player minimap updates. Run it with:

```sh
npm test -- src/game/engine/world/world-state.test.ts
npm run check:tsc
```

For rendering or movement changes, also check player movement, level changes, item refreshes, and direction/inventory prompts in the affected display modes. Unit tests cover state coordination; visual presentation still needs a running client.
