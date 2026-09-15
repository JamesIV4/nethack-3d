# Quest 0.3.9 polish checklist

The standalone APK keeps the original Three.js scene, game handlers, and single live HTML surface. Changes are reproduced by `prepare-gecko-runtime.mjs` and `patch-polish.mjs`; no new Gecko rebuild is required beyond the 0.3.8 runtime.

| Request | Implementation |
| --- | --- |
| No Wolvic startup splash or acceptance message | Skip native splash creation and browser legal dialogs; do not record consent. Android launch preview is black and has no branded icon. |
| Large flat window by default | Use Wolvic's own 2× resize preset on kiosk startup. |
| Black void instead of city panorama | Disable environment loading and use black for the immersive scene background. |
| Laser endpoint above UI | Separate native pointer root, drawn after all HTML panes with depth testing/writes disabled. |
| Separate right actions from minimap | Actions remain pane 2 beside the table; minimap is independent pane 5 farther back. |
| Right-button hover feedback | VR hover/focus states use the existing blue palette, border and highlight. |
| 150% render resolution with setting | Default XR framebuffer dimensions to 150%; increase native HTML surface density to 150%. VR settings expose a saved 50–200% framebuffer multiplier, applied on the next VR entry. |
| RT popup bottom on selected tile | Capture selected tile and surface height on press; transform its game-space anchor into tracking space each frame. Native modal geometry offsets its center upward by half its height. |
| Top UI pitch faces headset | Keep its bottom edge at the far table edge; adjust pitch only toward the viewer. |
| Two bottom table icons | Grid icon opens a visible-map-area slider; scale icon opens a world-and-UI slider. Area enlarges clip bounds and board without changing tile scale; scale enlarges the complete presentation without changing tile count. Both persist across launches. |
| Sprites face camera origin in VR | Sprite shader uses the shared headset center rather than each eye's screen-parallel plane. Raycasts use the same facing plane. Existing material hooks remain; normal facing is restored outside VR. |

`settings.ts` owns host-specific persisted settings. `TableControls.tsx` mounts once for the XR session and is removed on exit. The controls have their own pane 6. The transport now has a 24-float header (the prior anchor header plus area, scale, context-active, context X/Y/Z), at most seven panes, and a maximum of 571 floats.

Validation: 57 focused tests; TypeScript check; native C++ and APK builds; browser interaction checks for separate panes and both sliders; real WebGL pixel check for spherical sprite facing and unchanged flat rendering. Physical readability, sizing, cursor placement, and headset performance at the higher resolution still require sideload testing.

## 0.3.10 clarity corrections

- Sprite rendering and raycasts use fixed game-world Z-up, removing headset roll from billboard orientation.
- The action pane hangs below the tilt ring's full interaction radius, with an additional 8 cm gap at unit scale. Its top edge remains below the ring at any table pitch or pane height.
- Gecko's `XRWebGLLayer` clamps the requested scale to the host's advertised `nativeFramebufferScaleFactor`. Wolvic advertised 1.0, silently capping the previous 150% setting. `patch-resolution.mjs` advertises a ceiling up to 2.0, bounded by the OpenXR view/system and GL texture/renderbuffer limits, including Gecko's combined side-by-side texture width.
- Wolvic's previously empty `SetImmersiveSize` now matches the output eye swapchains to the actual WebXR framebuffer size. Flat-mode projection buffers also default to 150% of recommended dimensions.
- HTML surface density stays at 150% after recreation. Gecko density/DPI and screen overrides rise with it, preserving the logical viewport rather than shrinking the UI.
- VR settings report actual pixels per eye. Native logs expose `NH3D resolution limit`, `NH3D resolution: WebXR eye ... -> OpenXR eye ...`, and `NH3D HTML surface` dimensions. APK publication checks that the native resolution code is present.

Validation: 58 focused tests and browser/GPU checks. The connected old app reported DPR 1.25 with a 1920×1200 logical viewport and a 2400×1500 flat canvas; it was outside VR during inspection. Source tracing established both resolution caps. New headset dimensions and visual sharpness still require sideload validation.

## 0.3.11 first-person UI and facing

- The action strip lies parallel to the table at its bottom-right edge, starting below the pitch ring's interaction radius plus a gap. It rotates with the table again.
- Billboard facing uses the actual XR viewer position transformed into the original game scene. Three.js's stereo-union camera has a backward offset that rotates with the headset; it is retained for rendering/culling but no longer supplies sprite or standing-mesh facing positions. VR standing meshes also avoid orientation-dependent zero-distance fallbacks.
- Popups and modals have half their previous width and height. First-person HUD crops exclude the original modal rectangle, preventing a second full-size copy. Wired preview uses an equivalent CSS scale.
- First-person floating messages are centered in the HUD. Tabletop messages retain their left-side layout.
- `LaggingUiAnchor` holds the first-person frame until yaw exceeds 20 degrees or horizontal translation exceeds 20 cm. It then uses a critically damped exponential response (omega 9), with no pitch/roll or vertical following. Native rendering interpolates between transport updates. The existing native frame distance is retained.
- Snap turns increment a separate UI recenter revision, immediately centering horizontal position and heading and clearing both smoothing stages. Table anchoring remains independent. Exiting VR clears native follow state.

The transport header is now 29 floats: the prior 24 plus first-person UI anchor X/Y/Z, yaw, and recenter revision. HUD crop IDs 7–10 surround a separate modal ID 4; at most seven panes remain active. `patch-ui-follow.mjs` installs the native changes reproducibly.

Validation: TypeScript, 66 focused tests, native and APK builds, and browser/GPU checks. Tests cover fixed-position headset rotation versus the stereo-union camera, physical head movement, frame-rate-independent following, angle wraparound, horizontal deadzones, snap recentering, modal cutouts, and message centering. Headset comfort and visual placement still require testing.

## 0.3.12 bottom actions and independent UI dimensions

- VR action buttons use a single horizontal row at the bottom of the table, above the existing scale controls. The scale controls retain their edge offset. Flat layout is unchanged.
- World scale changes the board and game geometry; UI physical dimensions and native browser-popup scale are fixed independently. Panes still follow the table edges as it grows or shrinks. The control is now labelled **World scale**.
- The final requested modal limits are four times the previous maximum width and twice the maximum height: the source width increases from 36vw to 72vw and the old 0.5 presentation multiplier is removed. The source height limit remains 72vh, producing twice the previous world-space limit without stretching text.
- Wide modals are masked out of neighboring native UI panes. A pane is split into up to four textured pieces around the covered rectangle; its original pose and coordinate mapping remain intact. This prevents copies of modal content appearing in side or bottom panes.
- Sprite facing now accepts only a position vector, removing the remaining camera-transform fallback from its API. No headset orientation is supplied to the facing calculation.

`node scripts/quest/webxr/check-sprite-facing.mjs` compares GPU-rendered sprites against an explicitly oriented world-space mesh in both eyes, including the game's lighting hook, ordinary and scaled XR cameras, yaw, and roll. All eight cases match exactly (zero changed pixels); disabling world-space facing reproduces thousands of differing pixels. The installed headset materials also contain the intended shader. This establishes the tested rendering path, but the user's reported headset movement is not yet reproduced: the initial live capture retained a stationary segment, and a movement-triggered capture is pending. Do not treat the headset symptom as resolved based only on these tests.

Validation also covers the horizontal action row, unchanged scale-control position, latest modal limits, flat layout preservation, 66 focused tests, and the native/APK build.

## 0.3.13 pitch-only cards and movable first-person actions

- Modals use `fit-content`, a 54vw maximum width (the requested 3× original cap), and the existing 72vh height cap. Modal-local UI and log font-scale variables override to 0.5. Small content no longer stretches to the maximum width.
- Tabletop sprite facing locks its yaw to the board's centered direction. Only pitch responds to head position. VR tabletop cards are double-sided so their backs remain visible; original material sidedness returns on exit. Rendering and raycasts share the same pitch-only basis. First-person position-facing behavior remains unchanged.
- First-person following uses a 90° yaw deadzone. A trigger latches both horizontal position and heading as the new reference immediately, even while animation catches up. Subsequent small movements do not move that target or prevent settling. The existing 20 cm horizontal translation threshold remains; height stays fixed. Snap recenter still bypasses lag.
- The first-person action row is a separate pane below the upper HUD. Aim at it, hold either controller's grip, and move the hand vertically or push/pull to change depth. Release to leave it in place. Lateral placement remains centered. Position offsets last for the app session and are independent of the upper HUD.
- Grip ownership suppresses clicks and the owning hand's gameplay axes. It cannot start during an existing trigger/confirm press. Loss of tracking, a modal, or leaving first-person mode releases the grab. Releasing grip while a click button is still held keeps that click suppressed until release.

Validation: 70 focused tests, TypeScript, native/APK compilation, content-driven modal browser checks, and 32 stereo GPU comparisons against explicit pitch-only card meshes, including lateral lean and back views. `check-tabletop-facing.mjs` reproduces the GPU comparison. Native grip input and physical comfort still need headset validation. The wired HTML preview retains its single captured panel; the split movable action row uses the native Quest compositor.


## 0.3.14 UI and pointer corrections

- Action-pane crops include CSS box/text shadows, keeping the shadow with the movable bar and excluding it from the first-person upper HUD. The phone safe-area extension is disabled in XR.
- VR modal roots now halve the entire layout with CSS zoom, including fixed-size text, controls, and icons. Menu/Actions, wizard commands, expanded logs, and semantic dialogs share this rule. Content-driven width and the painted 54vw by 72vh caps remain.
- Quest flat and immersive modes use an in-document select chooser. It retains the original select and React change handlers, supports disabled options/groups, keyboard navigation, cancellation, focus restoration, and multiple selection. Other browser hosts retain their existing controls.
- Tabletop logs use a front-facing message crop rather than the table's left edge. Both modes center and halve the floating/collapsed log; desktop log markup also uses the front crop.
- Native game-window input uses consistent mouse events and primary-button state. Hover acquires focus before pressing; game clicks no longer emit artificial hover exit/enter pairs or another controller's hover exit. Non-game native widgets retain touch routing.
- Hidden DOM ancestors are excluded from UI hit regions. Immersive rendering and picking exclude legacy flat browser windows, leaving the composited game panes as the browser UI geometry.
- Wolvic pointer inner and outer radii are halved.

Transport retains the 29-float header, now accepts up to eight panes and 581 floats, and reserves pane 11 for tabletop front messages. `patch-pointer-input.mjs` owns the native input and legacy-window corrections; `form-controls.ts`, `paint-bounds.ts`, and `visibility.ts` own their respective document behavior.

Validation: 72 focused tests, TypeScript, complete APK compilation, original Java event-generator sequence checks, browser checks for controlled React selects and whole-modal geometry, shadow crop exclusion, invisible hit regions, and centered half-size logs. Native patch preparation is idempotent. APK publication verifies package/version, bundled game runtimes, matched patched Gecko, and native resolution markers. Physical first-click activation, placement, and readability still require headset testing; no APK was installed automatically.

Artifact: `quest/build/outputs/apk/nethack3d-webxr-0.3.14-ui-input-debug.apk`.
SHA256: `65d4d30b372ab10dae6c6ee8246b858ee984fdafecc884a9412a8a1b2746335b`.


## 0.3.15 frame lifecycle and pane isolation

- Keep the normal `Camera.updateCamera` call in the shared frame sequence, then apply the tracked XR view. The camera lifecycle completes first-person steps and releases pending tile updates; skipping it can leave items, enemies, their floor underlays, and other queued visuals absent until flat mode resumes. No world meshes, materials, or render ordering were replaced for this fix.
- Native UI source layout reserves separate vertical regions for modals, the action bar, and scale controls. Modal crops cannot carry chunks of the bar. Unassigned hit rectangles no longer create upright fallback panes; only explicit dialog/context surfaces create modal crops.
- All dialog/context roots receive whole-layout scaling, including conditionally mounted inventory Drop submenus without an `is-visible` class. The content-driven maximum remains 54vw by 72vh. Native source placement differs from world placement.
- Modals render in a foreground native pass and take hit priority over table UI. The table status bar cannot draw through them.
- Scale controls fit their icons; opening a slider supplies a minimum usable width.
- The independent first-person action pane pitches toward the viewer position while preserving its horizontal frame orientation and grip offsets. Hovering it no longer masks controller axes; grip still owns input while repositioning.
- Bundled-host flat presses and drags use touchscreen events; hover remains mouse-style for feedback. Immersive pane clicks retain mouse events. FPS pointer lock and mouse-look handlers are disabled for this host so the existing touch controls own flat camera dragging.

Validation: 73 focused tests and TypeScript passed; the real engine-frame/Camera regression fails with the old skipped-camera path and passes with the shared lifecycle restored. Native Java input tests cover immersive clicks, flat touch dragging, and non-host behavior. Browser isolation checks pass at 1600x1000, 1280x800, and 800x600, including maximum-height inventory, Drop submenu scaling, and content-sized scale controls. Native/APK builds and repeatable patch preparation pass.

Live evidence: the gold tile at 67,16 was absent from both the tile mesh and billboard collections during the reported VR failure. It appeared after exiting to flat mode; the user confirmed it remained visible upon re-entering VR. Document animation callbacks continued running during the subsequent capture, ruling out a general rAF pause in that capture. The skipped first-person camera lifecycle is reproduced by the regression test. Physical validation of the complete new APK is still required.

Artifact: `quest/build/outputs/apk/nethack3d-webxr-0.3.15-frame-ui-debug.apk`.
SHA256: `fcfc12510dee8d80f06d1e0b6f31ebf4cdf9b32ba007eb02525910dd5f91eaa7`.


## 0.3.16 pane controls and settled corridor inference

- Painted pane crops include a four-CSS-pixel gutter. First-person HUD cutouts use the expanded action crop, preventing bilinear sampling and antialiased blue borders from leaking into the stationary HUD.
- Dialog hit regions cover their controls without repeatedly measuring every descendant. Clipped paint bounds use the container and its own shadows rather than walking descendants that cannot paint outside it. The browser stress fixture with 600 option rows records 71 computed-style reads for a complete pane/hit snapshot.
- Grip positioning now covers native panes in both tabletop and first-person VR, including dialogs and non-clickable message panes. Height/depth offsets persist for the app session, separately by view mode and logical pane. The four source slices of the first-person upper HUD share one placement and one pitch transform. All pane orientations pitch toward the viewer position, with no viewer-driven roll or lateral facing rotation. Tile-anchored context menus keep their bottom pivot.
- Ordinary laser hits remain restricted to interactive regions. Grip can also select padding and non-clickable standalone panes; that does not add new invisible trigger-blocking regions. Release, lost tracking, vanished panes, mode changes, and held-click suppression retain the existing grip lifecycle.
- The player-position tile fence now includes new arrivals behind a partially processed batch. Newer payloads supersede older payloads while preserving their terrain information.
- Late corridor data receives a reconciliation at the shared settled-frame boundary, after the tile queues and player transitions finish. This removes the need to wait for another player-position event without inferring walls halfway through a move or partial tile batch. The same ordering applies in flat and XR rendering.

Validation: 75 focused tests, TypeScript, native Java event checks, browser crop/isolation and modal measurement checks at three viewport sizes, and the complete native/APK build passed. New scheduling tests cover partial batches, newer payloads, and deferred reconciliation across step/player transitions. Physical pane comfort, final glow removal, options frame time, and corridor presentation still require testing on the new APK.

Artifact: `quest/build/outputs/apk/nethack3d-webxr-0.3.16-pane-controls-debug.apk`.
SHA256: `9babb7f024324e0716530956a7e55db0d8cbf51983489d4900a65759e8e157e5`.


## 0.3.17 inventory popup anchor

Restrict the native tile-anchor flag to visible world-action menus (`nh3d-tile-context-menu` and `nh3d-fps-crosshair-context`), and suppress it while a regular modal is visible. Inventory context menus previously matched the generic context-menu selector and reused a stored world hit, moving the entire shared inventory crop to the floor. Inventory popups now retain their floating pane and grip offsets. Standalone world menus retain their selected-tile anchor.

Validation: four anchor regression cases, TypeScript, APK build, and package verification passed. Physical headset placement remains to be checked after sideloading.
Artifact: `quest/build/outputs/apk/nethack3d-webxr-0.3.17-inventory-anchor-debug.apk`.
SHA256: `1ca16369d2808bcfed3946b36acfc109c69e5c24ba54dc7b7898d3cb5e08d0f8`.


## 0.3.18 laser movement audio

Quest tile activation now resumes the existing audio systems, matching mouse/touch gesture handling. Laser movement explicitly opts into first-person pointer-movement feedback through `InputCommands.sendMouseInput`; ordinary first-person mouse attack clicks retain their previous behavior. The existing audio service arms the footstep and movement cooldown, and the normal runtime player-position event decides whether a step actually occurred. No speculative sound is played on click.

Validation: eight Quest input/audio tests and TypeScript passed. Coverage includes runtime-confirmed movement, blocked movement, self-tile actions, secondary clicks, prompt gates, sound disabled, and audio-resume routing. Physical audio playback still needs headset verification.
Artifact: `quest/build/outputs/apk/nethack3d-webxr-0.3.18-ray-audio-debug.apk`.
