# Quest stereo VR

The user confirmed that the standalone APK UI test works on the headset. The next APK adds native stereo dungeon geometry while retaining that same WebView UI and authoritative NetHack worker. The stereo implementation is new and still needs an APK build and headset validation.

## Rendering repair (0.2.1)

The first stereo APK was reported to show a black view with untextured block sides and degraded performance. Comparing `vr` at `1a3400e` showed that its immersive world uses a fixed player-centered rig and lets the headset own the view; it renders directly through WebXR, so that implementation cannot simply replace the native APK shell.

Corrections in this revision:

- Native UI transparency now overrides the engine mount's inline `#000011` background. Previously the supposedly transparent UI pane could obscure the entire stereo volume.
- Sprite/unlit material state is applied after roughness. SDK 0.13.2 uses a shared native roughness/metallic/unlit vector, and the previous setter order cleared the unlit bit.
- Immersive world orientation comes from the recenter anchor, independently of the hidden page camera. Player translation moves the surrounding world; it is not a larger UI pane.
- Standing sprite proxies face the tracked headset. Windowed sprites remain aligned to the source view and are no longer remeshed on every head movement.
- Unchanged scenes are not retransmitted, and retained native poses are not rewritten when the world root is unchanged.
- **Flat (original)** restores the original Three.js view and releases native scene resources. Export/serialization is disabled in Flat; returning to stereo sends a complete fresh snapshot.

These fixes have not yet been checked in a rebuilt APK. Debug logs now identify native object/texture counts and the computed background of the UI pane to make the next headset check concrete.

## Modes and controls

- **Flat (original)** runs the established Three.js renderer inside the panel, with the native mirror disabled.
- **Windowed** is the default stereo option. It places a bounded 1.6 m × 1.0 m stereo world in front of you, with real depth behind the opening. Geometry is clipped on all six sides of the volume, so passthrough remains visible around it. Your normal game camera/FPS preference controls the view inside the window.
- **Immersive VR** places the dungeon around your physical viewpoint. It uses the existing game's first-person geometry, centers the world on the NetHack player and calibrates scale to your eye height. Head tracking supplies the stereo view and physical look direction. Passthrough is disabled while immersed.
- Both modes retain the same floating UI, inventory, prompts and settings. The source canvas becomes transparent only after native scene delivery succeeds. Selecting a mode does not reload the WebView or restart the game.
- **Recenter** places the window/UI in front of your current yaw and recalibrates eye height. The window stays spatially anchored until you recenter; it does not chase every head movement.
- The native controls beneath the UI provide eight compass directions, Wait, Inventory, Back and Confirm. Commands use the existing prompt and gameplay paths. Tracked controller clicks on exposed native world geometry resolve through the game's tile-targeting path. Use the compass controls when the UI panel intercepts the ray.

The windowed surroundings use Quest passthrough, which the Spatial SDK exposes directly. Quest Home's system-owned virtual backdrop and other Home app windows are not imported into this immersive activity. This is a bounded MR view inside the app, rather than a Home panel activity. [Passthrough](https://developers.meta.com/horizon/documentation/spatial-sdk/spatial-sdk-passthrough/), [activity contexts](https://developers.meta.com/horizon/documentation/spatial-sdk/hybrid-apps-overview/).

## Build and test

From the repository root on Windows:

```powershell
npm.cmd run quest:apk
```

Sideload `quest/app/build/outputs/apk/debug/app-debug.apk` using Meta Quest Developer Hub. Launch **NetHack 3D VR**. The package remains `com.nethack3d.quest.uiproof`, so it updates the tested UI APK and retains its app data. Native version is now `0.2.1-rendering-fix` / version code 3. The game opens first; **UI test** remains available from the toolbar. Save before navigating between Game and UI test.

Start a game in Tiles or 3D ASCII mode, then verify:

1. Close one eye and then the other: walls, floor and sprites show different eye perspectives. Move your head sideways to verify positional parallax.
2. In Windowed, inspect the volume's edges and corners: no dungeon geometry should extend outside its boundary, and the room remains visible around it.
3. Switch to Immersive VR while the game is running. Look around and behind you, confirm floor height and wall scale, take a turn, and verify that the dungeon follows the game player's position rather than drifting with head movement.
4. Open inventory, a direction prompt and a text prompt, switch modes, and confirm the same run and pending prompt remain usable. Test compass movement, Wait, Back and Confirm. Finish the active prompt before ordinary movement.
5. Recenter standing and seated. Open the Universal Menu, remove/re-wear the headset, then continue. Test stairs/level changes, save/load and a second game so old scene resources are removed.
6. Check busy levels for frame time and thermal behavior. Test each intended tileset/runtime and compare textures, sprite orientation and lighting with the normal game.

Native geometry tests are included under `quest/app/src/test/java/com/nethack3d/quest/stereo/`. With the Android SDK configured in your shell or `quest/local.properties`, run `./android/gradlew.bat -p quest :app:testDebugUnitTest` to test clipping, interpolated texture coordinates, transforms and normals.

## Implementation

The game retains a single worker/runtime. `QuestSceneExport` participates in the existing engine frame after geometry, entity movement, lighting and effects update. It mirrors resolved Three BufferGeometry, material groups, normalized vertex colors, texture pixels/UV transforms, object transforms, visibility and picking metadata. It does not re-interpret NetHack glyph IDs or rules in Kotlin.

Scene updates are capped at 15 Hz, with one acknowledged frame in flight. Resources are transferred only when changed and removed when no longer used. UTF-8 messages are split into packets of at most 128 KiB, with a 32 MiB assembled scene cap and origin/main-frame checks. A failed transfer invalidates the cache and retries a full snapshot. The browser renderer remains available until native readiness is confirmed.

`QuestStereoScene` owns retained native mesh/material/texture objects, coordinate conversion and window clipping. Headset eye rendering and reprojection stay in Spatial SDK. Immersive player movement changes the native root pose, while headset tracking remains native. The source's saved FPS preference is preserved around the temporary immersive override.

Ownership:

| Path | Responsibility |
| --- | --- |
| `src/game/engine/rendering/quest-scene-export*.ts` | Resolved scene serialization, resource deltas, frame/lifecycle integration and camera-mode override |
| `src/quest/native/` | WebView transport, native input routing and transparent UI handoff |
| `QuestWebBridge.kt` | Trusted origin checks, packet assembly, acknowledgements and native-to-game commands |
| `quest/.../stereo/` | Native meshes, materials, textures, clipping, transforms and tracked picking |
| `QuestUiProofActivity.kt` | Shared UI window, mode/compass controls, passthrough and lifecycle composition |

## Current limits and validation

This renderer reuses original geometry and texture data, but maps materials to Spatial SDK's stock PBR/unlit shaders. Arbitrary Three shader modifications, postprocessing, shadows and exact alpha-test thresholds are not identical; radial dungeon lighting is approximated at vertices. Terminal presentation remains inherently flat. The PC wired preview continues to test the HTML panel; it does not emulate this Android native stereo renderer.

Window clipping currently rebuilds affected native meshes on source-camera changes. Large or heavily animated levels may need native batching or background mesh preparation after measurement. Texture dimensions and transfer sizes are bounded; overly large custom textures produce an explicit stereo error and retain the flat browser view.

Local validation for the rendering repair: TypeScript and 44 focused scene/transport/input regressions passed. Five Android XML files parsed and 25 native resource ID references resolved. Six native geometry JUnit tests were authored but not run. Native API signatures were inspected against the installed SDK 0.13.2, including threading, material limits and bitmap upload behavior. The new Kotlin sources, native math tests, alpha panel composition and stereo performance still require compilation/device checks; the repository reserves APK builds for the user.
