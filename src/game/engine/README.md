# Engine subsystems

[Nethack3DEngine](../Nethack3DEngine.ts) is the composition root and public UI controller. It owns startup, runtime-event dispatch, frame sequencing, option application, scene clearing, and coordinated disposal. Its public methods delegate to the subsystem responsible for each operation; callers continue using `Nethack3DEngineController` from [ui-types.ts](../ui-types.ts).

## Finding an implementation

| Directory | Responsibility |
| --- | --- |
| `rendering/` | Renderer and postprocessing, tile materials/textures, geometry, billboards, held weapons, terminal and Vulture presentation |
| `effects/` | Ground blood, particles, damage flashes/numbers, billboard shattering |
| `world/` | Remembered terrain and level caches, tile updates/classification, player/entity tracking and movement, combat attribution, run telemetry |
| `input/` | Shared command submission, keyboard/mouse/touch/controller handling, position selection, raycasts and pointer lock |
| `camera/` | Perspective/terminal camera transforms, follow smoothing, step motion, far-look orbit and return |
| `ui/` | Questions, inventory/info/text dialogs, direction overlays, context actions, extended commands, minimap, status and game-over presentation |
| `audio/` | FMOD integration, message sounds, platform detection and haptics |
| `diagnostics/` | FPS display, held-weapon animation editor and Vulture projection editor |
| `runtime/` | Engine-side session configuration, bridge reference, UI adapter and lifecycle state |
| `shared/` | Types and constants used by multiple engine subsystems |

Search within this directory for the owning method before extending a feature. Runtime events still enter `Nethack3DEngine.handleRuntimeEvent`; frame work still enters its `animate` method.

## Code hotspots

| Change or symptom | Start here | Key implementation or state |
| --- | --- | --- |
| Startup, runtime event ordering, frame order, option changes, shutdown | [Nethack3DEngine](../Nethack3DEngine.ts) | `connectToRuntime`, `handleRuntimeEvent`, `animate`, `applyClientOptions`, `applyPlayMode`, `clearScene`, `dispose` |
| New subsystem or cross-owner dependency | [assembly](create-engine-systems.ts), [coordinator contract](engine-coordinator.ts), [engine state](runtime/engine-state.ts) | `createEngineSystems`, `EngineCoordinator`; configuration and session in `EngineState` |
| Missing/stale tiles or refresh retries | [tile updates](world/tile-updates.ts) | `enqueueTileUpdate`, `flushPendingTileUpdates`, `requestTileUpdate`, `tileStateCache`, `pendingTileUpdates` |
| Item shown under the player or incorrect terrain classification | [world classification](world/world-classification.ts), [glyph behavior](../glyphs/behavior.ts) | `applyUnderPlayerItemGlyphEvent`, `clearUnderPlayerItemGlyphEvent`, `flatFeatureUnderPlayerCache`, `suppressedLootLikeUnderPlayerCacheKeys` |
| Wrong floor restored after stairs/branch transition | [level terrain cache](world/level-terrain-cache.ts), [dark corridor inference](world/dark-corridor-inference.ts) | `lastKnownTerrain`, `levelTerrainCachesByName`, `pendingLevelCacheTransition`; corridor discovery and reconciliation |
| Player position, predicted step or stale player trail | [player movement](world/player-movement.ts) | `recordPlayerMovement`, `playerPos`, `fpsPredictedPlayerTile` |
| Monster identity, swaps or movement interpolation | [runtime entity tracking](world/runtime-entity-tracking.ts), [entity movement](world/entity-movement.ts) | `runtimeMonsterTileKeyById`; `activeEntityMoveTransitions`, `deferredEntityVisualUpdatesByKey` |
| Tile mesh, material, glyph texture or reveal | [tile rendering](rendering/tile-rendering.ts), [tile materials](rendering/tile-materials.ts), [glyph textures](rendering/glyph-textures.ts) | `updateTile`, `tileMap`; `applyGlyphMaterial`; `createGlyphTexture`, `ensureGlyphOverlay` |
| Atlas change, sampling, background removal or stale texture | [tileset assets](rendering/tileset-assets.ts), [glyph textures](rendering/glyph-textures.ts) | `loadTilesetTexture`, `invalidateTilesetDependentCaches`, `tilesetTexture`; `glyphTextureCache` |
| Regular tileset block-face rotation defaults or localhost calibration | [face rotation data](diagnostics/tile-face-texture-rotation-data.ts), [face rotation debug](diagnostics/tile-face-texture-rotation-debug.ts), [pointer targeting](input/pointer-targeting.ts) | `defaultTileFaceTextureRotationOverrides`, `NH3D_INTERNAL_TILE_FACE_TEXTURE_ROTATION_DEBUG_ENABLED`, clicked world-face resolution and shared rotated geometry |
| Wall shape, ambient occlusion or Vulture faces/doors | [wall geometry](rendering/wall-geometry.ts), [floor occlusion](rendering/floor-occlusion.ts), [wall overlays](rendering/wall-overlays.ts), [Vulture walls](rendering/vulture-walls.ts), [projection](rendering/vulture-projection.ts) | Geometry, occlusion, overlay resource lifetimes and projection lookup |
| Billboard/pet appearance or FPS held weapon | [entity billboards](rendering/entity-billboards.ts), [held weapon](rendering/held-weapon.ts) | `ensureMonsterBillboard`, `monsterBillboardTextures`; `syncFpsHeldWeaponSprite`, `fpsHeldWeaponMesh` |
| Quest native stereo scene, windowed/immersive mode or stale native resources | [Quest scene export](rendering/quest-scene-export.ts), [engine integration](rendering/quest-scene-export-system.ts) | Resolved geometry/material/texture deltas, native acknowledgements, temporary immersive FPS geometry, native renderer handoff |
| Resize, postprocessing, lighting or WebGL diagnostics | [render pipeline](rendering/render-pipeline.ts), [lighting](rendering/lighting.ts) | `onWindowResize`, `initAntialiasingPipeline`, `disposeAntialiasingPipeline`; lighting resources |
| Terminal cell appearance, scaling or mode entry/exit | [terminal rendering](rendering/terminal-rendering.ts), [camera](camera/camera.ts) | `updateTerminalCell`, `disposeAllTerminalCellVisuals`; `updateTerminalCamera`, `terminalCamera` |
| Blood, shatter, damage flashes or floating numbers | [ground blood](effects/blood-ground.ts), [blood particles](effects/blood-particles.ts), [shatter](effects/billboard-shatter.ts), [flashes](effects/damage-flashes.ts), [numbers](effects/damage-numbers.ts), [combat attribution](world/combat-attribution.ts) | Effect resources and animation; `CombatAttribution.clearDamageEffects` coordinates effect cleanup |
| Keyboard mapping, repeated command, synthetic sequence or inventory action | [keyboard](input/keyboard-input.ts), [movement mapping](input/movement-input.ts), [commands](input/input-commands.ts) | `handleKeyDown`; directional mapping; `sendInput`, `sendInputSequence`, `sendMouseInput` |
| Mouse click targeting, rotation, touch swipe, pinch or long press | [mouse](input/mouse-input.ts), [touch](input/touch-input.ts), [raycasts](input/pointer-targeting.ts) | Mouse/touch handlers; `fpsTouchMoveGesture`; `getTileTargetFromPointerNdc` |
| Controller bindings, movement preview, dialog focus or sliders | [gameplay controller](input/controller-gameplay.ts), [dialog controller](input/controller-dialogs.ts), [bindings](../controller-bindings.ts) | `updateControllerInput`, `controllerPreviousActionState`; dialog navigation and virtual cursor |
| Camera follow, pan, FPS look or far-look camera return | [camera](camera/camera.ts), [position selection](input/position-selection.ts) | `updateCamera`, `cameraPanX`; `setPositionInputMode`, `setPositionCursorPosition`, `positionInputModeActive` |
| Prompt gating, selection counts, pickup pages or text/inventory dialog | [question menus](ui/question-menus.ts), [prompt dialogs](ui/prompt-dialogs.ts), [modal navigation](ui/modal-navigation.ts) | `activeQuestionText`, `activePickupSelectionCounts`; `isTextInputActive`, `showInventoryDialog` |
| Direction overlay or pointer lock after closing UI | [direction prompts](ui/direction-prompts.ts), [pointer lock](input/pointer-lock.ts) | `isInDirectionQuestion`, `showDirectionQuestion`; `syncFpsPointerLockForUiState` |
| Context actions, glance text, extended command palette or preview image | [context actions](ui/tile-context-actions.ts), [extended commands](ui/extended-commands.ts), [menu previews](ui/menu-previews.ts), [aim highlights](ui/aim-highlights.ts) | `activeContextActionTile`, `fpsCrosshairGlancePending`; command palette, previews and aim visuals |
| Minimap cells, viewport rectangle or drag-to-pan | [minimap](ui/minimap.ts) | `queueMinimapTileUpdate`, `renderMinimapViewportOverlay`, `minimapCells` |
| Stats, messages, death reports or run counters | [player status](ui/player-status.ts), [engine messages](ui/engine-messages.ts), [game over](ui/game-over.ts), [telemetry](world/run-telemetry.ts) | `playerStats`, `statusDebugHistory`; messages; `gameOverState`; `runTelemetry` |
| Missing sounds, damage rumble or platform differences | [audio and haptics](audio/audio-haptics-platform.ts), [message sound hooks](../message-sound-hooks.ts), [FMOD runtime](../../audio/FmodRuntime.ts) | Sound/rumble dispatch and platform detection; FMOD remains outside the engine directory |
| FPS/debug panel, held-weapon editor or Vulture projection editor | [FPS diagnostics](diagnostics/fps-diagnostics.ts), [weapon editor](diagnostics/held-weapon-animation-debug.ts), [projection editor](diagnostics/vulture-projection-debug.ts) | Developer UI state and its matching remove/dispose paths |

The [world/runtime flow guide](../../../docs/engine-world-runtime.md) traces map, loot, level, entity and status updates across these owners. [Movement/input steering](../../../.agents/rules/movement-flow.md) covers key consumption, prompts and far-look; the [hotspot playbook](../../../.agents/rules/logic-hotspots.md) records change-specific invariants.

## Ownership and dependencies

`WebXrPresentation` owns both the startup rain scene and gameplay XR presentation. The startup-only engine frame renders `MenuRain` and the existing HTML/native pointer bridge without gameplay updates. Starting a character moves the same tracking rig back into the game scene. `NativePointerBridge` sends menu logo/dialog/footer crops through the normal pane protocol; `GameUiPanels.h` owns their native placement.

Atlas cell width remains `TilesetAssets.tileSourceSize`; height is
`tileSourceHeight`. Rectangle-aware sampling, background masks, and legacy
layout conversion must use both. Square tiles retain identical dimensions.
Non-Vulture tile sprites preserve the source aspect ratio while the logical
dungeon grid and movement coordinates remain unchanged.

`tilesetUseTileAspectRatio` defaults on. `RenderPipeline.syncWorldTileScale`
scales presentation X by `tileSourceSize / tileSourceHeight`, creating rectangular
floor cells without changing wall height or logical tile coordinates. Camera
smoothing continues on the logical camera; `getActiveCamera` supplies a separate
orthonormal presentation camera. World-point picking converts back to logical
coordinates. Sprites, camera-attached artwork, direction labels and lighting
compensate at this boundary. XR rigs cancel the parent transform with a full
matrix; native scene frames carry optional `worldScaleX` (default 1) for picking
and lighting. Keep runtime input and tile-cache ordering independent of this scale.

Each class owns its fields and resources. For example, `PlayerMovement` owns `playerPos`, `QuestionMenus` owns question selections and counts, and `EngineState` owns client options and lifecycle state. Cross-subsystem state remains shared by reference through declared dependencies; extraction does not make the gameplay domains independent.

`shared/types.ts` describes internal state shapes and `shared/constants.ts` contains shared values/helpers. The external UI/controller contract remains in `src/game/ui-types.ts`; worker command/event envelopes remain in `src/runtime/types.ts`. Changing one contract does not implicitly update the others.

[create-engine-systems.ts](create-engine-systems.ts) constructs and wires the classes. Each `NameDependencies` interface exposes only the members used by that class, generally as `Pick<OtherClass, "member" | ...>`. Peer-class imports are type-only; the assembly imports the concrete classes. Dependencies on root orchestration use [EngineCoordinator](engine-coordinator.ts).

Dependency getters allow mutually dependent subsystems to refer to each other after construction. They do **not** make constructor-time access safe automatically. A field initializer or constructor that reads another subsystem requires that owner, and any eagerly used transitive dependencies, to be constructed first. Keep initialization order explicit in the assembly. Constructors must not start runtime work or register browser callbacks; root startup runs after assembly and option assignment.

When extending a subsystem:

1. Put state and its behavior in the same owner.
2. Add only the required peer members to its dependency contract and wire the peer in the assembly.
3. Prefer type-only imports between peers; keep shared definitions free of imports from concrete subsystems.
4. Preserve the root controller API and the order of observable operations.

## Events and cleanup

Worker commands and event payloads are unchanged. `InputCommands` is the shared submission path for device and UI commands; input selection, prompt cleanup, tile refresh and pointer-lock transitions remain synchronous. Preserve their ordering, including cursor updates received before position-mode activation and menu completion before prompt reset.

Browser handlers must use their owning subsystem as `this`. Listener registration uses the engine's abort signal. Root disposal first stops frame/listener intake and clears scheduled interaction work, then resets prompts and coordinates runtime, audio, DOM and graphics cleanup. Keep owner resource cleanup connected to this lifecycle, including scene clears and option-driven cache invalidation.

Resource ownership has three lifecycle boundaries:

- **Scene clear:** root `clearScene` coordinates transient visuals, tile queues, entity transitions and remembered-level behavior. It is not a full engine shutdown.
- **Option/asset changes:** root `applyClientOptions` and `applyPlayMode` coordinate texture/material invalidation, rebuilding and mode-specific resources. Include dependent caches when changing an asset owner.
- **Engine disposal:** root `dispose` aborts listeners, cancels the frame, clears interaction timers, resets UI, clears the scene, disposes the session/audio, removes owned DOM, and releases postprocessing, renderer, textures, materials and geometry. A new resource must participate in the appropriate boundaries; ownership alone does not free it.

Within a frame, controller polling and entity transitions run before camera updates; UI/aim/lighting and visual effects update before rendering. Terminal mode renders directly with the orthographic camera; other modes use the configured composer or the perspective renderer. Keep this sequencing in the root rather than starting independent subsystem loops.

For the standalone Quest APK, `QuestSceneExport` runs before rendering in that same frame. It sends only resolved rendering resources and transforms through the origin-restricted native bridge; native stereo does not own game rules. Native acknowledgements commit resource deltas, a failed/reset receiver causes a complete snapshot, and disposal cancels outstanding transfer before clearing its session. Immersive mode uses the existing FPS geometry path while preserving the user's windowed play-mode preference. Once native rendering is ready, the browser WebGL pass is skipped while scene/UI animation continues.

This directory contains the browser engine's state and presentation logic. It does not implement a second NetHack simulation or change WASM rules. The worker bridge, input broker, callback adapter and authoritative game state remain under [src/runtime](../../runtime/); imported/generated runtime artifacts retain their existing roles.

## Performance-sensitive caches and uploads

- Ground blood tracks the pixels actually changed by rasterization. Saturated pixels skip noise/shading work. Android retains its CanvasTexture, nearest filtering, alpha guard and shader; only the CPU canvas copy uses the dirty rectangle. Desktop texture ranges accumulate until Three consumes them, and a pending full upload stays full until `texture.onUpdate`. Full snapshot restoration and recoloring still rebuild every pixel.
- Billboard proxies copy color, opacity and depth state each frame. Shader invalidation follows source material/texture changes, including an explicit source `needsUpdate`; movement and color-only damage flashes do not invalidate the material. Flat proxy/shatter planes use `forceSinglePass` with `DoubleSide`; the browser fixture compares front/back/angled pixels against two-pass rendering.
- Pointer alpha masks use weak texture ownership and invalidate on texture/source version, image identity and dimensions. Published canvas changes must set `texture.needsUpdate`, as required for rendering. UV transforms and alpha thresholds are evaluated on every hit.
- `LevelTerrainCache` bounds its cache of pure signature decoding and returns independent copies. Runtime glyph classification, map coalescing, terrain preservation and player-position fences keep their existing live paths.
- Controller binding parses are cached by their exact string with a bounded history. Button/axis values and press/release edges are still sampled each frame.

The [performance pass notes](../../../docs/performance-pass.md) describe the repeatable browser fixture and the limits of its measurements.

## Validation

- `npm run check:tsc` checks contracts and public API compatibility.
- `npm test` runs the regression suite, including input/prompt lifecycle, world-state transitions and rendering-resource tests under this directory.
- For behavior changes, exercise the affected browser flow: movement and player rendering, inventory/direction prompts, far-look enter/exit, relevant display modes, and cleanup/restart.

Follow the repository's [agent guidance](../../../.agents/rules/AGENTS.md); agents do not run build or packaging validation unless explicitly requested.


## Direct WebXR runtime proof

The engine frame is scheduled through Three.js `renderer.setAnimationLoop`, with `null` on disposal. In normal play it runs at the browser cadence; in WebXR it uses headset frame timing. `WebXrPresentation` starts after engine/UI initialization. It transforms tracked cameras into the original game coordinate system, supplies the tracked pose to existing billboard/aim/light systems, and supplies the XR camera to the original engine render dispatch. It does not invoke the native scene exporter.

The first-person option remains authoritative. Tabletop bounds use GPU clipping planes, while first-person rendering surrounds the player. The subsystem owns its tracking rig, board surface, controllers, session cleanup and restoration of flat camera/clear state. Its scene additions are separate from tile-owned resources cleared on level changes.

The tabletop defaults to a 45-degree pitch controlled by `src/quest/webxr/board-tilt.ts`. Its support sits below the floor to avoid coplanar fighting. Tracking-space pointers, UI and the support bypass dungeon clipping. The flat controller handler receives `enabled=false` during XR and clears its interaction state; WebXR exclusively owns controller actions.

`ScaledCameraSprites` preserves existing sprite material hooks and includes the camera's view scale so sprites match mesh tiles in tabletop and first-person VR. `gameFrameTime` normalizes session-relative XR timestamps onto the performance clock used by game effects.

FPS world scale is `XrSettings.fpsScale`, separate from tabletop `scale`. Its 100% rig matches the original calibrated FPS mapping. Scale changes use the common tracking rig around the calibrated eye; all world, controller and held-weapon passes use the headset's actual stereo eye poses. Do not scale eye separation or apply different view transforms to the world and controller passes. Legacy `depth` settings are dropped on normalization.

`VisibleSpriteHits` is shared by screen/Info targeting and XR world rays. Both standing/flat entity proxies and Sprites use their texture alpha, UV transform, material opacity and alpha-test threshold; transparent pixels let the ray continue to the next surface. Pixel reads are cached by texture and source revision. Screen targeting includes visible proxy meshes even when their source sprite is hidden, and maps the hit back to its owning tile.

`src/quest/webxr/` owns in-game VR controls, laser/capture routing and the shared `HtmlUiPanel`. Normalized DOM hit regions let Wolvic pass transparent UI space through to the world. Wolvic owns the native pointer and native HTML mouse/touch/scroll delivery; the APK creates no second Three.js pointer. The standalone host uses pinned Wolvic and Gecko patches under `scripts/quest/webxr/` and `quest/webxr/`, including continued HTML painting, retained page surfaces across entry/exit, and the world-anchored native UI. The checkout/build dependencies under `quest/runtime/` are ignored. Read [the runtime proof guide](../../../docs/quest-webxr-runtime.md) before changing rendering or compositor ownership. The legacy Meta Spatial exporter remains an earlier experiment.

XR canvas ownership lives in `rendering/xr-canvas-presentation.ts`. Hide the existing world canvas before session entry and restore it after renderer cleanup; never start another game renderer for the HTML pane. Session cleanup must ignore stale end events. The pitch ring is side-mounted and uses angular dragging; controller polling also observes raw trigger release to recover from missed selectend events.

VR input adds 45-degree snap turns about the current head position, LT-modified running through `InputCommands.sendForcedDirectionalInput`, and RT tap/hold dispatch through the existing mouse/context owners. `controller-gestures.ts` owns neutral rearming and tap/hold timing. Tabletop UI crops come from `table-ui-layout.ts` and are rendered by Wolvic's `GameUiPanels` against the single live HTML surface.

FPS laser context activation passes an explicit tile to `TileContextActions.openFpsCrosshairContextMenu`. That target stays pinned through probes and action selection; ordinary desktop opens retain crosshair targeting. Billboard proxy meshes carry their source sprite's tile coordinates so hits on wide artwork still select the owning tile. Rays without a target must not synthesize a click at tile zero.

### XR camera lifecycle

XR world submission uses `XrTerrainBatches` and `WorldClipCulling`. They reject geometry outside the tabletop's existing clip planes, instance eligible opaque terrain, and use cached wall geometry without undersides or redundant material groups. Original tile meshes and materials remain authoritative for runtime updates, effects and picking; temporary draw masks/geometry are restored in `finally`. Instance materials borrow textures and preserve the lighting shader hook. Derived geometry, instance buffers and owned materials belong to the XR owner and are disposed on exit. Ground batching requires verified opaque texture content and matching material state; fades and unsupported cases use the existing tile draws. See [Quest performance measurements](../../../docs/quest-vr-performance.md).

The shared animation frame always runs `Camera.updateCamera` before applying the final tracked XR pose. This call also completes first-person step transitions and schedules pending tile updates. Do not skip it merely because a headset supplies the view. Billboard, lighting, and remaining scene updates retain their normal order; `WebXrPresentation.prepareRender` applies final XR presentation changes before the original scene is rendered.

FPS far-look in XR uses the shared `Camera` cursor target and return animation. `XrFarLook` snaps the entry orbit to the nearest cardinal heading opposite the player's view, fixes the pullback elevation, and applies the pullback to the tracking rig without pitch or roll. RS turns yaw around the selected column; live head tracking remains independent. The dungeon stays level. Keep updates idempotent: the frame updates XR both before input and after the camera lifecycle. Through selection and return, sprites face the virtual camera position before headset offsets, bypassing standing FPS proxies. Normal immersive FPS sprites face the player grid with vertical pitch; standing loot retains the flat FPS last-move nudge. Tabletop facing is unchanged. Shader and raycast facing must use the same origin and mode.

Contextual glance and Info still use runtime position input, but `PositionSelection` suppresses their camera/column presentation for the full input lifetime. Info arms suppression before submitting the command; glance is identified by its existing pending probe. Their completion must not arm a camera return. Overhead and terminal follow targets also ignore these synthetic cursors. The runtime auto-selected map route must arm far-look before `getpos` calls `cliparound`; verbose `:` remains a continuation until Escape, so inspection coordinates never become player movement.

Quest far-look primary clicks use `PositionSelection.handleFarLookPositionTileSelection`: selecting a different cell moves the column with the existing input sequence, and selecting the current cell confirms. Route bounded floor-plane hits through this handler before mesh checks, even for unrendered cells. Selection gestures cannot become void-run commands, long-press context actions, or gameplay clicks after cancellation. Travel retains its separate selection semantics.

FPS prediction/step suppression still hides player glyphs, but preserves an authoritative loot billboard when flattening is disabled. Do not replace that loot with a cached flat tile while waiting for the player-position update. Current-player underlay reconciliation remains authoritative after arrival.

The Quest movement trace confirmed that a destination player glyph can precede `player_position` by several frames. Both `TileRendering.updateTile` and `TileUpdates`' unchanged-signature path must preserve cached standing loot for that predicted/step destination when the payload is explicitly a player visual. Use the cached loot glyph, never the incoming player glyph. This presentation allowance does not promote the destination to the authoritative player tile for hotbar foreground priority.

`TileUpdates.flushPendingDarkCorridorInference` runs on every authoritative player step and on `map_update_complete`, emitted by the bridge after ordered map-display or snapshot-complete boundaries. The shared frame provides a fallback for late legacy observations. Inference reads the latest pending terrain without committing render caches or draining the visual queue; it must not wait for camera/player animation to finish. Preserve superseded-payload terrain when coalescing arrivals, and evaluate after complete map delivery rather than per glyph.

### VR controller weapons

`quest/webxr/controller-weapons.ts` owns target-ray-mounted voxel weapons and their resource disposal; `HeldWeapon` remains the equipment and texture source. The grip pose still supplies gesture motion. `quest/webxr/weapon-gesture.ts` owns strike/recovery recognition. Accepted gestures use the guarded `MouseInput.attackQuestDirection` entry and the existing `InputCommands.sendInputSequence` force-fight path. Attack sequences must not create movement prediction or footsteps. The native host controls controller-model/UI compositing order.

`rendering/held-weapon-flips.ts` resolves the shared flat FPS/VR sprite base: authored per-sprite flips from `held-weapon-flip-defaults.ts` override the built-in per-tile table, then tileset defaults provide the fallback. Existing session edits in the flat FPS debug editor retain highest priority. The standalone utility edits Flip X/Y/Diagonal for each sprite, displays a corrected flat thumbnail, and saves shared defaults independently of the VR pose library.

Controller weapon visuals run in first-person VR. `WEBXR_WEAPON_ATTACKS_ENABLED` in `quest/webxr/settings.ts` is currently false, disabling gesture attacks and hiding their options while preserving held weapons and saved gesture preferences. Run `npm run weapon:calibrate` for the separate desktop calibration utility at `http://127.0.0.1:5174/tools/weapon-calibrator/`. Its atlas browser and 3D preview live under `src/tools/weapon-calibrator/`; the loopback server lives under `scripts/weapon-calibrator/`. It shares the game's atlas background removal, weapon flips, voxel renderer, ray origin and pose math. The visible pixel bounds are centered automatically; attachment offsets are measured in pixels from that center. Global, tileset and sprite rotations add per axis, snap to 15 degrees and pivot around the attachment point. Flat FPS held-weapon translation and tilt are not applied. Save writes the complete library directly to `quest/webxr/weapon-pose-defaults.ts` for the next Quest package. Runtime reads that source table without browser-storage overrides. See [utility instructions](../../../tools/weapon-calibrator/README.md).

`WebXrControllerInput` selects the shared `AimHighlights` source in XR. LS intent selects the existing headset aim; `MovementPreview` transfers to the laser when its player-relative tile offset changes or an RT movement is accepted. Laser ownership then persists until LS crosses 5% again or physical head direction changes by 30 degrees from laser activation. Moving between grid cells and transient camera-follow lag must not simulate a laser aim change. There is no timer-based handoff. XR movement highlights extend one cell into void alongside known passable terrain. Glance RS turns belong to `XrFarLook.turn`, not the ordinary player-pivot snap turn.
