# Direct Three.js WebXR runtime proof

The Quest path renders the original game scene with Three.js WebXR. The native host supplies headset tracking and composites the live HTML UI over the stereo eye images. It does not export world meshes or recreate the dungeon in another renderer.

Version `0.3.2-live-ui` rendered the world and live HTML on Quest 3. Version `0.3.3-ui-controls` adds transparent compositor clearing, a larger eye-level pane, controller lasers and hit circles, DOM-based UI/world routing, and a draggable board-pitch ring. The APK builds and browser interaction checks pass; the new placement, transparency, and controller feel still need headset validation.

## Build the standalone APK

After the patched browser runtime has been built once:

```powershell
npm.cmd run quest:webxr:check
npm.cmd run quest:webxr:apk
```

Sideload `quest/build/outputs/apk/nethack3d-webxr-proof-debug.apk` with Meta Quest Developer Hub. The build verifies its package ID, version, bundled NetHack runtimes, required Gecko permissions, and the custom HTML painting code and preference before copying it to that location. `quest:apk` still builds the earlier Meta Spatial experiment.

The current versioned copy is `quest/build/outputs/apk/nethack3d-webxr-0.3.3-ui-controls-debug.apk`. The publisher verifies that `libxul.so` matches the staged custom Gecko binary byte for byte and prints the APK's SHA256 on every build. Sideload this copy with Meta Quest Developer Hub.

The package ID is `com.nethack3d.quest.webxrproof`, separate from the earlier app and its saves. The host serves only its bundled assets at `http://127.0.0.1:18973`. It does not depend on Quest Browser or a remote game server. A cold launch and game creation in airplane mode remain acceptance checks.

The app defaults to VR after starting or resuming a game. It uses that normal user gesture; if startup outlasts the browser's transient activation, the next ordinary game interaction enters VR. Explicit Exit VR is respected. Enter/Exit VR is available in the mobile game actions, desktop actions, pause menu, and Display options.

### Prerequisites

- Android SDK, normally `%LOCALAPPDATA%\Android\Sdk`; `ANDROID_SDK_ROOT` overrides it.
- Android Studio's bundled JDK 21, or `JAVA_HOME`.
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

The older Chromium preparation scripts remain an alternative experiment. They are not used by `BuildQuestWebXrApk.bat`.

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

- Trigger/pinch: click UI, grab the tilt ring, or select a game tile through transparent UI space.
- Left stick: move; first-person movement follows tracked head direction.
- Left primary face button: inventory.
- Right A: click the pointed UI control or grab the tilt ring; otherwise confirm.
- Right B: back.
- Board ring: hold trigger or A and drag vertically to adjust pitch from 0 to 81 degrees. The default is 45 degrees, with the far edge raised. The ring is 80% transparent when idle.

Controller commands reuse the game's loading, dialog, inventory, direction, and position-selection gates. The page hit-tests controls and modal bodies against its live DOM; the rest of the pane passes through to the world. The flat controller poller is suspended during XR to prevent duplicate button actions. Controller loss cancels captured UI/tilt interactions.

## Design and ownership

`WebXrPresentation` participates in the engine's existing `renderer.setAnimationLoop`. It renders the original scene through Three's [WebXRManager](https://threejs.org/docs/pages/WebXRManager.html), bypassing desktop postprocessing and the legacy native scene exporter while in XR.

The world stays in its original +Z-up coordinates. An inverse tracking rig transforms headset and controller poses into game coordinates, preserving world-coordinate shader assumptions and geometry identities.

- Tabletop centers the player over a board in front of the recenter pose. Its pitch defaults to 45 degrees. Four GPU clipping planes bound the dungeon; tracking-space overlays bypass those planes. The support surface stays 2 mm below the game floor along the board normal.
- First-person places the player below the tracked head, with stereo and room-scale viewing throughout the dungeon.
- The existing first-person preference selects the view in both VR and the ordinary game. VR entry does not rewrite it.
- `ScaledCameraSprites` extends existing sprite shader hooks to include the camera's uniform view scale, so sprites and mesh tiles keep the same physical proportions.
- `gameFrameTime` uses the page performance clock in XR because this Gecko revision [timestamps XR frames relative to session creation](https://github.com/mozilla-firefox/firefox/blob/dc6d11938934f4490158a1334dda9d143dffab46/dom/vr/XRSession.cpp). Effects continue to use the same clock as their creation timestamps.

The native host keeps the page compositor running, presents WebXR eye images, then composites the live page. Gecko's compositor clear color is explicitly transparent. `HtmlUiPanel` defines a 3 by 1.875 metre pane, 1.45 metres ahead and 5 cm below the recentered head. It sends its tracking-space matrix and width through the same-origin, bounded `/__xr/pane` endpoint. The host reads this immutable pose through JNI and applies it while drawing the page, restoring its ordinary window transform afterward.

`controller-input.ts` owns both controllers' rays, surface-normal hit rings, and trigger/A capture. `dom-pointer.ts` dispatches pointer/click events into the existing DOM and supports range dragging. UI hit circles are drawn in the DOM so opaque controls cannot cover them. World circles and lasers render with Three.js. `BoardTilt` owns ring picking and drag state. `HtmlUiPanel` also retains the wired capture transport; there is no separate wired input implementation.

During XR, the HTML canvas mount is transparent and the desktop WebGL canvas is hidden from page composition. That same canvas renders into the XR eye targets. React, forms, dialogs, inventory, and game event handling remain mounted in the original page.

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

The current pass has 21 focused regression tests plus a Chrome interaction check covering React button clicks via trigger/A, range dragging, transparent pass-through, world and empty-board laser endpoints, controller disconnection, and tilt dragging. A real WebGL check confirms that dungeon clipping preserves the support, lasers and hit circles. The host Java/C++ integration and APK compile successfully. Headset testing must still confirm alpha composition, pose alignment, native form/keyboard behavior, and drag ergonomics.

Performance is not yet established. Desktop postprocessing is bypassed in XR, and the flat held-weapon overlay is hidden pending a proper XR presentation. Standalone MR remains unfinished.
