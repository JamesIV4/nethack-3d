# Direct Three.js WebXR runtime proof

The Quest path renders the original game scene with Three.js WebXR. The native host supplies headset tracking and composites the live HTML UI over the stereo eye images. It does not export world meshes or recreate the dungeon in another renderer.

Version `0.3.6-table-ui` splits the live HTML surface into tabletop edge panes: status at the far edge, left/right UI outside the matching edges, and bottom actions near the player. All panes share one browser texture, DOM and game instance. Modal dialogs use a center pane; first-person mode retains one anchored pane. First-person right-stick deflections snap-turn 45 degrees, LT + left stick uses the existing run mechanic, and holding RT opens the existing right-click/context action.

The Quest launcher icon and system launch splash use the same `NetHack3D-splash.png` as the native app splash, staged as `assets/vr_splash.png` with `com.oculus.ossplash` enabled, following [Meta system splash instructions](https://developers.meta.com/horizon/documentation/native/android/mobile-splash/).

## Build the standalone APK

The APK orchestration uses Node on Windows, macOS, and Linux. The separate patched-Gecko source build still uses Linux/WSL; stage its artifacts before building the APK. After those artifacts have been built once:

```sh
npm run quest:webxr:apk -- --check
npm run quest:webxr:apk
```

Sideload `quest/build/outputs/apk/nethack3d-vr.apk` with Meta Quest Developer Hub. The build verifies its package ID, version, bundled NetHack runtimes, required Gecko permissions, and the custom HTML painting code and preference before copying it to that location. `quest:apk` still builds the earlier Meta Spatial experiment. Both commands use `scripts/quest/build-apk.mjs`; the `.bat` files are optional Windows shortcuts with no build logic. The Node runner invokes the pinned Gradle wrapper through Java directly, without a platform-specific shell.

The build also produces a versioned copy in `quest/build/outputs/apk/`. The publisher verifies that `libxul.so` matches the staged custom Gecko binary byte for byte and prints the APK's SHA256 on every build. Sideload this copy with Meta Quest Developer Hub.

The launcher name is **NetHack 3D VR**, including debug builds. The package ID is `com.nethack3d.quest.vr`; its private data directory is separate from the old WebXR Proof package, with no save migration. `package.json` supplies `versionName`; `versionCode` is `major * 1000000 + minor * 1000 + patch`. The publisher verifies both. The host serves only its bundled assets at `http://127.0.0.1:18973`. It does not depend on Quest Browser or a remote game server. A cold launch and game creation in airplane mode remain acceptance checks.

The app opens its main menu in VR. The dedicated offline Gecko host disables `dom.vr.require-gesture` so launch can request the session immediately; other hosts retain a normal Enter VR button. The front end creates the renderer without starting a NetHack worker, and starting/resuming a game or returning to the menu keeps that renderer and XR session. Explicit Exit VR is respected.

The menu uses the same live HTML compositor and native pointer path as gameplay. Separate crops place the ASCII logo above the menu, with build information and Enter/Exit VR below. All VR dialogs use full-size content (`zoom: 1`). Native modal panes sit farther away (about 1.4 metres at the default table placement, 15 cm in front of the upright board plane), rather than shrinking their HTML controls. A single instanced draw surrounds the player with letters out to 48 metres and 45 metres above/below. The world background matches the page's `#000011`. Display settings expose letter count (default 1,000, maximum 12,000), fall speed (default 1.5 m/s), and glyph change rate (default 0.3 changes/s). The letters are four times their original size and crossfade between glyphs. Their faint blue cores and two soft glow widths match the desktop rain; the glow is baked into a padded atlas and still uses one instanced draw. Births, recycling at the bottom, and count reductions fade over two seconds. Previously saved rain counts are reduced to one-third once for this revision, in addition to the earlier halving migration.

Flat view uses a 1920 by 1080 logical viewport; immersive HTML UI uses 2560 by 1440. At DPR 1.5 their native surfaces are 2880 by 1620 and 3840 by 2160 respectively. The native immersive-mode callback and wired preview switch dimensions on entry/exit. World-window resizing preserves the dimensions for the current mode. Pane dimensions preserve the existing pixels-to-metres ratio. Immersive gameplay centers the status-bar content within two-thirds of the viewport width, collapses the location stretch, and doubles HP/Pw minimum widths; flat view retains its existing styling. All modal controls retain their authored size; world context actions in both immersive views place their bottom edge just above the exact laser press point in screen space, at the normal 1.4 m modal viewing distance. This radial projection also works when pointing straight down or away from the HUD. FPS context actions use a right-side HTML source slot. The FPS status/minimap pair sits 25 cm lower, and status crops exclude minimap pixels. The minimap is centered above the status bar in both immersive views; new Quest settings default to 200% scale, while saved choices are retained. Run `node scripts/quest/webxr/wired-host.mjs --menu-smoke` for front-end lifecycle, unclipped logo/menu crops, and real GPU rain checks in six viewing directions. APK compilation, automatic entry, and physical pane readability still require headset validation.

### Prerequisites

- Android SDK: `ANDROID_SDK_ROOT` or `ANDROID_HOME`, then the runtime checkout's `local.properties`. Default discovery checks `%LOCALAPPDATA%/Android/Sdk` on Windows, `~/Library/Android/sdk` on macOS, and `~/Android/Sdk` or `~/Android/sdk` on Linux.
- A compatible JDK (JDK 21 for this runtime). Set `JAVA_HOME`, use Android Studio's bundled JDK at a conventional install location, or supply `java` on PATH. Configure Gradle JVM options in `gradle.properties`.
- Meta Platform SDK at `quest/runtime/OVRPlatformSDK`, or `QUEST_OVR_PLATFORM_SDK`. It must contain `Include/OVR_Platform.h` and `Android/libs/arm64-v8a/libovrplatformloader.so`.
- Patched GeckoView at `quest/runtime/gecko`, or `QUEST_GECKO_DIR`. A stock Maven AAR stops HTML painting during immersive VR and cannot be substituted.

The wrapper prepares Wolvic revision `5725712987a8f87eea3780834b5359cca4c5f5e1` under `quest/runtime/wolvic`, stages the complete game, and builds `:app:assembleOculusvrArm64GeckoGenericDebug`. The checkout, SDKs, and generated artifacts are ignored by Git. The build scripts and patches are tracked.

### Build the browser runtime once

Use Linux or WSL on its Linux filesystem, following Mozilla's [Linux setup](https://firefox-source-docs.mozilla.org/setup/linux_build.html). A first browser build downloads substantial toolchains and compiles Gecko; subsequent game-only APK builds reuse the resulting Maven module.

On Ubuntu, install the host prerequisites:

```bash
sudo apt-get update
sudo apt-get install -y curl python3 python3-venv git make build-essential pkg-config unzip zip
```

From this Windows checkout:

```powershell
wsl.exe -d Ubuntu -- bash /mnt/s/Repos/nethack-3d/scripts/quest/webxr/build-gecko-runtime.sh
```

The script fetches pinned Firefox revision `dc6d11938934f4490158a1334dda9d143dffab46`, bootstraps its Android toolchain, applies the painting patch, builds arm64 GeckoView, and stages its Maven module and receipt into `quest/runtime/gecko`. The source defaults to `$HOME/.cache/nethack-quest-gecko/firefox`; override with `QUEST_GECKO_SOURCE`. `QUEST_GECKO_JOBS` defaults to 4. The source revision corresponds to the published GeckoView 153.0.20260615093007 and external VR ABI 19.

Build and packaging logs are in the source's `artifacts/nh3d-build.log` and `artifacts/nh3d-package.log`. The staged `.pom` and `.module` preserve Gecko's transitive dependencies and its bundled Glean capability. The host substitutes this exact local coordinate and has no stock-runtime fallback.

`patch-gecko-paint.py` changes the [refresh driver's immersive paint guard](https://github.com/mozilla-firefox/firefox/blob/dc6d11938934f4490158a1334dda9d143dffab46/layout/base/nsRefreshDriver.cpp#L2628) to honor `dom.vr.webxr.paint-document`. The preference defaults to false in Gecko and is enabled only in this dedicated host's configuration. The host also keeps its page compositor active and retains the wake-lock and foreground-service permissions required by Gecko's lifecycle callbacks.

The older Chromium preparation scripts remain an alternative experiment. They are not used by `npm run quest:webxr:apk`.

## Test with a wired headset

1. Start Quest Link on Windows and connect the headset, with an active OpenXR runtime.
2. Run `npm.cmd run quest:webxr:wired`.
3. Start or resume a game in the separate Chrome/Edge window, then choose Enter VR.
4. Apply the existing first-person option: off selects tabletop; on selects the surrounding first-person dungeon.
5. Use Exit VR to return to the ordinary game, or Recenter world in Display options.
6. Close the development browser or press Ctrl+C to stop the host.

The host chooses installed Chrome or Edge; `QUEST_CHROME_PATH` overrides that choice. It uses an isolated profile under `.wired-dev/three-webxr` and origin `http://127.0.0.1:5177`.

This is separate from the old `quest:wired` UI-only preview. Three.js renders directly through WebXR. Only HTML is captured at 10 Hz into the floating pane. That screenshot transport is for wired development; the APK uses the live browser GPU surface. Capture and input endpoints require a per-run token, and access to browser-profile files is rejected.

Leave Mixed reality in VR off for initial tests. That option requests `immersive-ar` at the next entry. The current Gecko ABI integration supports opaque VR; standalone MR remains unfinished. Browser/Link combinations without AR support report an error.

Initial XR controls:

- RT: tap to select a world tile; hold for 450 ms to invoke the existing right-click/context action without an extra primary click. UI clicks and drags remain native. RT on the pitch ring grabs it.
- Left stick: move; hold LT while moving to run through the existing run-command path. First-person movement follows the tracked head and snap-turn direction.
- Left primary face button: inventory.
- Right A: left-click the pointed UI control/world tile or grab the tilt ring. It never falls back to Enter/Space, and holding A does not open context actions.
- Grip: UI panes claim the grip first and move at normal hand speed. Over the tabletop world, drag to pan the map with heavy smoothing; releasing without crossing the deadzone opens context actions. Tracking loss cancels the gesture.
- Minimap: click or drag to move the tabletop view using the desktop camera pan offsets and the same 500 ms half-life smoothing as world panning.
- Left Y: search once per press, subject to the normal gameplay/prompt gates.
- Cyan capsule: grab the horizontal handle between the table edge and scale controls to translate the entire table freely at 2x hand movement. This gain applies only to this handle. The table faces the viewer while keeping the chosen pitch.
- Recenter: clear map pan and handle placement, put the table in front of the current head position/yaw, and reset UI-pane placements.
- Right B: back.
- First-person right stick: 45-degree snap turns, with neutral rearming between turns. Turns pivot around the current head position.
- Board ring: hold trigger or A and rotate around the ring on the board side to adjust pitch from 0 to 81 degrees. The default is 60 degrees, with the far edge raised. The ring radius is 18 cm, lies in the side plane around the pitch axis, and is 80% transparent when idle.

Controller commands reuse the game's loading, dialog, inventory, direction, and position-selection gates. The page publishes normalized hit regions for controls, modal bodies, and UI canvases. Wolvic hit-tests them and sends its normal native touch/scroll events to Gecko. In flat FPS play only, a world target outside the HTML regions uses one latched native mouse gesture through release; only the Three.js renderer canvas is excluded, while minimap and other HTML canvases remain touch controls. Native popups and the keyboard retain Wolvic input handling. The flat controller poller is suspended during XR to prevent duplicate button actions. Controller loss cancels captured UI/tilt interactions.

## Design and ownership

`WebXrPresentation` participates in the engine's existing `renderer.setAnimationLoop`. It supplies the XR camera to the original engine render dispatch, which draws the same scene through Three's [WebXRManager](https://threejs.org/docs/pages/WebXRManager.html), bypassing desktop postprocessing and the legacy native scene exporter while in XR.

The world stays in its original +Z-up coordinates. An inverse tracking rig transforms headset and controller poses into game coordinates, preserving world-coordinate shader assumptions and geometry identities.

- Tabletop centers the player over a board in front of the recenter pose. Its pitch defaults to 60 degrees. Four GPU clipping planes bound the dungeon, inset by 0.001 tiles on all sides to avoid exact block-edge intersections; tracking-space overlays bypass those planes. The support surface stays 2 mm below the game floor along the board normal.
- First-person places the player below the tracked head, with stereo and room-scale viewing throughout the dungeon.
- The existing first-person preference selects the view in both VR and the ordinary game. VR entry does not rewrite it.
- `ScaledCameraSprites` extends existing sprite shader hooks to include the camera's uniform view scale, so sprites and mesh tiles keep the same physical proportions.
- `gameFrameTime` uses the page performance clock in XR because this Gecko revision [timestamps XR frames relative to session creation](https://github.com/mozilla-firefox/firefox/blob/dc6d11938934f4490158a1334dda9d143dffab46/dom/vr/XRSession.cpp). Effects continue to use the same clock as their creation timestamps.

The native host keeps the page compositor running and composites it over the original WebXR eye images. Gecko's document canvas background and paint backstop honor `dom.vr.webxr.transparent-document`; setting only the compositor clear color was insufficient. Both transparency and continued HTML painting are opt-in preferences enabled by this host.

`NativePointerBridge` sends a bounded snapshot through `/__xr/table-ui`: an explicit recenter revision, normalized UI rectangles, and each hand's hit distance and aim-relative normal. It sends no game geometry or images. There is at most one request in flight, capped at 30 Hz; unchanged state is not resent. Wolvic uses its current tracked aim to draw one native beam and pointer for both UI and world hits. The APK creates no Three.js laser or DOM cursor and does not synthesize UI clicks.

Wolvic anchors the central UI frame once on entry or explicit recenter, 1.45 metres ahead and 20 cm below the head, aligned with yaw. It applies the same transform to page and native UI widgets and uses it for hit testing. Looking around does not move the anchor. UI-captured trigger/A presses are masked from the WebXR gamepad; world drags stay captured through release. Back and non-click buttons remain available to the game. Grip/aim transforms agree between the native pointer and WebXR raycast. The wired Chrome path retains its own HTML capture/pointer transport.

The existing world canvas is removed from HTML composition before requesting XR and restored only after the renderer finishes its session-end handlers. Cleanup is scoped to its session so an older callback cannot alter a new session. Native exit does not resume/recreate a page surface that entry kept alive. During XR, the HTML canvas mount is transparent. That same canvas renders into the XR eye targets. React, forms, dialogs, inventory, and game event handling remain mounted in the original page.

## Validation and remaining work

Completed checks include TypeScript, renderer/session regressions, sprite scale and effect-clock regressions, host patch tests, and an isolated Chrome smoke test with visible authenticated 1600 by 1000 HTML capture. A real WebGL 2 pixel check confirmed matching sprite/mesh widths at scales 0.11, 1, and 2: 8, 74, and 148 pixels respectively. The old sprite shader produced 74 pixels at every scale. Earlier APKs built and loaded the textured stereo world on Quest 3. Live debugging confirmed that the frozen pane's DOM had advanced beyond the loading screen while its displayed pixels had not.

Useful commands:

```powershell
npm.cmd run check:tsc
npm.cmd test -- src/game/engine/rendering/scaled-camera-sprites.test.ts src/game/engine/rendering/webxr-
node --test scripts/quest/webxr/runtime-patch.test.mjs
node scripts/quest/webxr/wired-host.mjs --smoke
node scripts/quest/webxr/device-rdp.mjs
```

The hardware acceptance pass should cover both views, movement and tile refresh, inventory and direction prompts, UI scrolling/text input, repeated enter/exit, recentering, suspend/resume, and offline cold launch. The custom runtime must demonstrate changing HTML pixels throughout an immersive session before the frozen-pane fix is considered proven.

The current pass has 52 focused regression tests, including run/prompt routing, tap-versus-hold behavior, context-menu reuse, snap-turn latching and room-scale pivot preservation. A Chrome integration fixture verifies native-only pointer ownership, absence of synthetic native UI clicks or Three.js laser geometry, UI hit regions, world hit metadata, original game actions, bounded transport, and stable anchoring until explicit recenter. A real WebGL check also reproduces the old marker disappearing under a transparent floor and verifies the corrected draw ordering. The host Java/C++ integration and APK compile successfully. Headset testing must still confirm alpha composition, pose alignment, native form/keyboard behavior, and drag ergonomics.

The [Quest 3 performance pass](quest-vr-performance.md) measures the explored-level bottleneck and documents XR terrain instancing, clipping and reduced wall-face submissions. Its live previews substantially improved one explored tabletop level; packaged hardware acceptance remains necessary. Desktop postprocessing is bypassed in XR, and the flat held-weapon overlay is hidden pending a proper XR presentation. Standalone MR remains unfinished.

## Tabletop UI panes

`table-ui-layout.ts` groups existing visible HUD components into normalized source crops. Messages remain in the left source region. Context actions and dialogs add a fifth floating crop while all four edge crops retain their positions. Unfamiliar controls expand only that floating crop; they no longer replace the HUD with a full-page pane. VR modal CSS reserves the central source region, and `AnimatedDialog` disables its transitions through its existing lifecycle so closing still unmounts the dialog. The UI remains mounted once.

`GameUiPanels.h`, installed by `patch-table-ui.mjs`, creates at most five native quads sharing the focused window's live texture. Texture coordinates and geometry update only when crop bounds or texture size changes. Pane transforms follow the same board height and pitch as the game. Native ray picking maps a cropped pane hit back into the original full-page pixel coordinates, preserving Wolvic's UI input and drag capture. The original full-window quad is hidden while those crops draw.

The 0.3.7 correction initializes the surface-texture shader missing in 0.3.6. Headset testing confirmed that panes became visible, but their pixels remained stale. The 0.3.8 Gecko patch also opens the Android `CompositorVsyncScheduler` VR gate with the opt-in atomic preference `dom.vr.webxr.composite-document`. Allowing `nsRefreshDriver` to paint was insufficient while Android still suppressed composition. Both preferences must be enabled, and the artifact receipt and APK checks require the newly rebuilt runtime.

`patch-live-ui.mjs` gives the pane compositor the same fixed anchor as the game. In this bundled host, Gecko's local-floor origin and the native compositor share the measured floor offset without the stock randomized floor-height and initial-head-position offsets. Pane placement never samples the current headset transform. Native eye cameras look up the pose identified by the completed WebXR image's `inputFrameId`; using the newer predicted pose made native overlays shift relative to the older world image. A bounded 32-pose history preserves frame prediction. The modal pane sits above and in front of the table center.

Controller integration tests exercise LT + stick through the run command and RT tap/hold through tile/context commands. `window.nethackGame.systems.webXrPresentation.input.diagnostics` keeps the last 16 attempted commands and their acceptance/rejection results for wired debugging.

The snapshot has an 18-float header: recenter revision, hit-region count, two per-hand hit distance/normal tuples, view mode, board pitch/height, pane count, and the fixed local-floor anchor X/Y/Z/yaw. Hit regions and source crops follow. The receiver bounds counts, coordinates and payload size. No world geometry is transferred.

The new layout and controller feel still require headset validation. The source tests and browser layout checks do not establish physical readability or comfort. Wired Chrome currently retains its full-page UI preview; the edge-pane compositor is in the standalone native host.

The 0.3.8 APK builds and passes packaged-library hash and preference checks. Browser integration checks cover a separate quick-action crop, unchanged edge panes, the exact game anchor in the bridge, real modal CSS, and closing without animation events. Headset confirmation of live composition and frame alignment is still pending.

## 0.3.9 presentation controls

See [the eleven-item polish checklist](quest-vr-polish.md) for current startup, pane placement, resolution, table sizing, sprite-facing behavior, and validation. This revision extends the transport to a 24-float header and seven panes, with the minimap and table controls independent of the action strip. It reuses the 0.3.8 Gecko runtime.

## ASCII logo wave

`StartupLogo` splits the existing ASCII artwork into rows on every platform. A twelve-second perspective animation cycle sweeps a band one-third of the logo height from top to bottom, moving the rows forward and back at the same speed, with a six-second pause between sweeps. VR uses the desktop line spacing and centers the visible ASCII columns rather than the trailing blank columns. Reduced-motion preference disables the wave. The logo includes padding for the maximum projection, and its VR crop uses that stable padded box.

## Immersive movement and text entry

FPS VR uses the standard cubic step animation by default. Display/VR options include **Instant movement** to switch to tile snapping. The XR rig samples the camera-owned ground step without including headset offset or eye height; the normal camera update still owns animation completion and tile flushing. The FPS HUD follows after a 46-degree turn, snaps to 45-degree dungeon-grid headings, and recenters when the player changes tiles or snap-turns. Fast-movement turns snap the view itself to the new grid direction. Entering immersive FPS and recentering reset headset X/Y offset to the current player grid; an active step is finished without losing the normal tile-flush lifecycle. Roomscale translation retains its 20 cm follow threshold.

The Quest host reuses Wolvic's existing keyboard and Gecko InputConnection whenever an HTML input requests soft input. Gecko's viewless `restartInput` callback refreshes the connection before the visibility request. In immersive mode the host detaches the keyboard from the transformed game-pane root, renders its GPU surface at one-quarter of Wolvic's original physical width and height, and aligns it to the current game UI heading. The same detached transform drives eye rendering and controller ray tests, so it cannot inherit the pane scale or rotation. Hover focuses the native controller and delivers key highlights; RT or A delivers Android touch down/up. B dismisses a visible keyboard before the host handles Exit VR, even when the laser points elsewhere. The keyboard wins hits over a foreground modal; its move bar accepts trigger or squeeze gestures without passing a world/context grip through. A move changes the detached pose for the active session. Recenter, exit, and removal end an active move; exit restores the normal Wolvic placement only while the widget is still registered.

## Anchored select lists

Select menus begin at the actual HTML input (flipping upward only when needed). The parent dialog crop stays fixed; native pane 15 shares its parent pane 4/13 transform and grip group, with a source-pixel-derived offset. The list renders in front and masks duplicate pixels in the parent.

The current control/keyboard/table changes have TypeScript, browser/GPU, gesture, and source-patch validation. Rebuilding and checking the APK on Quest remains necessary for physical touch, keyboard and grab acceptance.

## Quest resume and laser selection

Quest remembers the requested flat/immersive mode independently of XR session lifetime. Visibility, focus/page restore and resumed frame activity restore immersive mode after idle; explicit Exit VR stays flat. Hidden, inert, exiting, fully clipped and effectively transparent HTML controls are excluded from hits, and removed native panes lose capture. Native widgets use logical placement visibility rather than temporary compositor hiding.

During direction prompts, laser clicks on arrows or world targets (tiles, items, monsters and blocks) submit the matching direction. FPS void clicks resolve a ground target or horizontal ray direction and reuse fast directional movement. Repeat appears above the action bar when the existing repeat-action eligibility allows it.

The keyboard uses a GPU texture surface in the game host. Its prior native compositor layer was submitted behind the opaque WebXR projection. The host draws its detached quad after HTML modals; keyboard ray tests use that exact rendered quad transform, accept both sides, and ignore temporary composition visibility. Its world position stays fixed while yaw/pitch face the headset position without inheriting headset roll. Dragging the move bar preserves the ray's grabbed distance, allowing movement in all three dimensions, and releases Android's touch capture on completion.

`patch-keyboard.mjs` keeps immersive button transitions owned by `UpdateGameControls`; the earlier `CheckBackButton` pass is limited to the loading interstitial. Content-change input restarts do not reset pressed keys or reopen a dismissed keyboard. `patch-keyboard-dialogs.mjs` makes Close/B dismiss the native overlay directly and places speech/permission dialogs on detached GPU surfaces above the keyboard, with matching ray priority and WebXR button masking. Dictation continues to use Wolvic's Vosk recognizer and normal microphone permission flow; a missing language model follows Wolvic's download flow.

Keyboard changes require a rebuilt APK. Check alphabet/symbol/number entry, Shift, Backspace, Enter, stationary RT/A clicks, Close/B, microphone permission/dictation/cancel, and typing after moving the keyboard toward/away from the user. Compiler and patch tests do not replace this headset acceptance pass.
