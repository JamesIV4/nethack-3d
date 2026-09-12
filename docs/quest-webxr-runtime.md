# Direct Three.js WebXR runtime proof

This supersedes the native scene-mirroring experiment for VR world rendering. The new path renders the **original game scene with Three.js WebXR**. It does not export meshes, translate materials, regenerate textures, or create a second native dungeon.

The implementation is a runtime proof, not a headset-validated release. The wired browser/UI smoke test and source tests pass. The standalone host and Chromium patches apply to their pinned upstream revisions, but their native compilation, simultaneous page/WebXR compositing, transparency, and headset performance still require validation.

## Test with a wired headset

1. Start Quest Link on Windows and connect the headset. An active OpenXR runtime must be available to the browser.
2. Run:

   ```powershell
   npm.cmd run quest:webxr:wired
   ```

3. Use the separate Chrome/Edge window that opens. Start or resume a game.
4. Choose **Enter VR** in the game action buttons or pause menu. VR controls are also under **Options → Display**.
5. Use the existing first-person option: off means a tabletop board; on means the surrounding first-person dungeon. Apply the option normally.
6. Use **Exit VR** to return to the ordinary game, or **Recenter world** in Display options.
7. Close the development browser or press Ctrl+C to stop the host.

The host selects installed Chrome or Edge. Set `QUEST_CHROME_PATH` if a different executable is needed. It uses an isolated profile under `.wired-dev/three-webxr`, not your ordinary browser profile. Its local origin is `http://127.0.0.1:5177`.

**This command is different from the old `quest:wired` UI-only preview.** The game and Three.js run in the actual WebXR browser. Only the HTML surface is captured at 10 Hz and uploaded to the floating UI plane. No world geometry or world screenshots are streamed. This screenshot-based UI transport is for PC development; the standalone host uses the browser's live GPU surface.

Leave **Mixed reality in VR** off for the first wired test. It requests an `immersive-ar` session when enabled; PC Link/browser combinations that do not support AR will report an error. It takes effect on the next VR entry.

Initial XR controls:

- Trigger/pinch: interact with the UI or select a game tile.
- Left stick: move; first-person movement follows tracked head direction.
- Left primary face button: inventory.
- Right primary/secondary face buttons: confirm/back.

Controller commands reuse the existing loading, dialog, inventory, direction, and position-selection gates. Wired UI pointer ownership prevents the same trigger from also selecting a tile. Native pane hit-testing currently owns the whole pane, including transparent areas; this still needs refinement during the headset proof.

The wired server captures only its own game tab. Capture/input endpoints require a per-run token; foreign origins and access to browser-profile files are rejected.

## Standalone APK host

The existing `quest:apk` still builds the earlier Meta Spatial experiment. Use the separate WebXR proof workflow:

```powershell
npm.cmd run quest:webxr:check
npm.cmd run quest:webxr:apk
```

The proof uses application ID `com.nethack3d.quest.webxrproof` so it can coexist with the earlier APK and its saves. It bundles the browser runtime and staged game assets. It does not launch an installed browser or fetch the game from a website.

The package serves its own APK assets through a fixed, loopback-only origin, `http://127.0.0.1:18973`. Workers, WASM, images, and saves use that origin. Internet connectivity is not needed to load the game. Validate cold launch and game creation in airplane mode after installing the built APK.

### Runtime prerequisites

These files are **not installed in this workspace**. The preflight command stops before cloning or building when they are missing.

- Android SDK; use `ANDROID_SDK_ROOT` or the normal Android Studio location.
- JDK 21 and the SDK/NDK/CMake versions selected by the pinned Wolvic project.
- Meta Platform SDK directory, supplied as `QUEST_OVR_PLATFORM_SDK`, containing `Include` and `Android/libs/arm64-v8a/libovrplatformloader.so`.
- A compatible **WebXR-enabled, transparency-patched Wolvic Chromium build**, supplied as `QUEST_CHROMIUM_DIR`.

The Chromium directory must contain:

```text
Content.aar
ChromiumUi.aar
snapshot_blob_64.bin
icudtl.dat
wolvic.pak
nh3d-runtime.json
```

A stock Android WebView or ordinary GeckoView Maven dependency does not provide this host integration. Wolvic documents the separate browser-runtime build in its [Chromium instructions](https://github.com/Igalia/wolvic/blob/main/CHROMIUM.md) and the limitations of ordinary GeckoView artifacts in its [README](https://github.com/Igalia/wolvic/blob/main/README.md).

### Preparing Chromium

This is a substantial browser build in a Linux build environment, not an npm dependency installation. Follow the upstream Chromium setup and Android toolchain instructions linked above. After the checkout is prepared:

1. Fetch and check out Wolvic Chromium revision `c45f7339cd6d087c9a9cb9130d2b42555a87f6cb`, then synchronize its dependencies with `gclient sync`.
2. Apply the game-specific transparency changes **before building**:

   ```text
   node /path/to/nethack-3d/scripts/quest/webxr/patch-chromium.mjs /path/to/chromium/src
   ```

3. Build `content_aar` and `ui_aar` for Android arm64 using the upstream GN configuration.
4. Run the upstream `fix_aar.sh` on both generated AARs.
5. Copy the fixed AARs and runtime resources into `QUEST_CHROMIUM_DIR`. Rename the generated `snapshot_blob.bin` to `snapshot_blob_64.bin`.
6. Copy the generated `nh3d-runtime.json` from the Chromium source root alongside those artifacts.

The two Chromium changes are deliberately small: the page surface uses RGBA instead of an explicitly opaque format, and new WebContents use a transparent page base color. The latter uses Chromium's `WebContents::SetPageBaseBackgroundColor`; CSS transparency alone is insufficient when the host supplies an opaque surface/background. The JSON file identifies the intended source revisions and patch; it is not proof that arbitrary supplied binaries contain those changes.

### Preparing and building the APK

Set the paths in the terminal that will run the build:

```powershell
$env:QUEST_CHROMIUM_DIR = 'S:\Path\To\PatchedChromiumArtifacts'
$env:QUEST_OVR_PLATFORM_SDK = 'S:\Path\To\OVRPlatformSDK'
npm.cmd run quest:webxr:check
npm.cmd run quest:webxr:apk
```

The wrapper prepares an owned checkout of Wolvic revision `5725712987a8f87eea3780834b5359cca4c5f5e1` under `quest/runtime/wolvic`, applies the host patch, initializes submodules, stages the complete game, and invokes:

```text
:app:assembleOculusvrArm64ChromiumGenericDebug
```

It prints the APK location under `quest/runtime/wolvic/app/build/outputs/apk`. Sideload that APK with Meta Quest Developer Hub. The preparation script refuses a mismatched or initially dirty runtime checkout. The runtime checkout, dependencies, and build outputs are ignored by Git; the reproducible patch logic and game integration are tracked here.

## Design and ownership

### World rendering

`WebXrPresentation` participates in the existing engine frame. The engine uses `renderer.setAnimationLoop`, so WebXR supplies the headset frame timing. Once immersive, it renders the original scene with Three's XR camera, bypassing the desktop postprocessing chain and the legacy native scene exporter.

The game world remains in its original +Z-up coordinates. An inverse tracking rig transforms the headset and controller cameras into those coordinates. This preserves the custom shaders' world-coordinate assumptions and leaves geometry/material identities intact.

- **Tabletop:** the player remains centered over a horizontal board in front of the recenter pose. Tiles have physical depth. Four GPU clipping planes bound the tabletop without CPU triangle clipping.
- **First-person:** the player is placed below the tracked head at floor level. The headset supplies stereo and room-scale view movement throughout the surrounding world.
- The existing first-person preference selects the view in both VR and the ordinary game. Entering VR does not force or rewrite it.
- Scene changes continue through the existing NetHack/Three.js systems. There is one authoritative runtime and one world renderer.

Three's built-in [WebXRManager](https://threejs.org/docs/pages/WebXRManager.html) supplies the eye cameras and XR render targets. There is no simulated stereo video panel or glTF translation in this path.

### Standalone HTML composition

The host patch changes Wolvic's immersive behavior:

1. Keep the focused page compositor running when WebXR starts.
2. Present the browser's normal WebXR eye images unchanged.
3. Composite the live page/keyboard surfaces over those images.
4. Continue native pointer interaction with the pane and suppress duplicate trigger/button input into WebXR.
5. Open only the bundled game in a frameless kiosk window with persistent storage.

The HTML canvas mount becomes transparent during XR, and the desktop WebGL canvas is hidden from the page surface. The same canvas still renders into WebXR's eye targets. React, dialogs, forms, inventory, and event handling remain mounted in the original page.

### Current proof limits

- Native host/Chromium compilation and physical headset rendering have not been validated.
- The desktop smoke test checks visible HTML capture, not XR presentation or GPU performance.
- The wired UI capture adds latency; it is not the intended standalone UI transport.
- Desktop postprocessing is bypassed in XR. The flat screen-space held weapon is hidden until a proper XR hand/controller presentation is implemented.
- Native pointer ownership of transparent pane areas and UI/world input transitions need headset validation.
- The world is recentered by the in-game command; final native pane repositioning and ergonomic tuning remain part of the proof.
- No performance improvement is claimed without headset measurements.

## Validation

Completed locally:

- TypeScript checks.
- Direct-renderer regressions: original geometry/material identity, tabletop scale/orientation, stereo eye separation, player following, clipping bounds, session denial, AR alpha, and disposal.
- Existing Quest scene-export/input regressions.
- Pinned Wolvic and Chromium patches applied in memory against their upstream source.
- Isolated Chrome smoke: visible game UI, authenticated 1600×1000 HTML capture, rejection of unauthenticated capture. The UI screenshot was visually inspected.

Useful commands:

```powershell
npm.cmd run check:tsc
npm.cmd test -- src/game/engine/rendering/webxr-
node --test scripts/quest/webxr/runtime-patch.test.mjs
node scripts/quest/webxr/prepare-runtime.mjs --verify-upstream
node scripts/quest/webxr/patch-chromium.mjs --verify-upstream
node scripts/quest/webxr/wired-host.mjs --smoke
```

The agent did not run a build, following the repository's validation rule. The next hardware acceptance pass should cover both views, movement/tile refresh, inventory and direction prompts, UI text/scroll controls, repeated enter/exit, recentering, and frame timing. The standalone pass must additionally cover alpha composition, focus/suspend/resume, and offline cold launch.
