# Shared loading and movement performance pass

The subsequent [NetHack 5 Perfetto movement analysis](quest-perfetto-movement-2026-09-25.md) uses the user's 17:38 trace and documents additional changes and their validation.

The runtime already runs in a worker. Rendering does not await tile requests, but processing their results and constructing Three.js resources happens on the UI thread. The changes below reduce those synchronous bursts across browser, Electron, Android and Quest clients, with shared behavior for NetHack 3.6.7, NetHack 5 and SLASH'EM.

## Changes

- Distant ordinary terrain updates, including explored terrain, keep their existing meshes until the visual queue processes them. The two-cell neighborhood of movement endpoints, actors, features, actor/feature removal and explicit undiscovered clears keep their existing immediate reconciliation boundaries.
- New observations replace superseded queued updates before rendering; intermediate terrain caching is preserved.
- XR drains visual work once through the engine frame, with a cooperative 1.5 ms / 12-cell budget. Document animation callbacks cannot drain a second XR batch. Flat clients retain their 5 ms / 72-cell budget. Neighbor geometry is flushed inside the measured loop, rather than accumulated in an unmeasured end-of-batch tail. Pending XR work resumes through document RAF after exiting XR.
- Asset completion and option changes queue cached-cell rebuilds instead of synchronously rebuilding an entire explored level. Each rebuild reads the current cell state, preserves glyph flags and skips cells removed in the meantime. Scene clearing discards the refresh queue.
- Image decoding completes asynchronously before drawing an atlas. Legacy-to-NetHack-5 atlas compilation yields to browser tasks after at most 64 cells or 1.5 ms. Stale compilations stop when superseded; incomplete atlases are never installed. This conversion is specifically for legacy packs used with NetHack 5; the visual queues benefit all three runtimes.
- XR camera updates avoid writing an unchanged DOM class, which otherwise dirties native pane layout in Gecko.
- Fresh XR settings default to **130%** resolution. Existing saved choices are preserved.

These budgets are cooperative, not hard real-time guarantees. An individual tile update, urgent movement reconciliation, inference, Vulture maintenance, GPU upload or driver operation can still exceed a frame budget. Rendering retains the last available scene while work remains queued; this does not move WebGL rendering to a separate thread.

## Incorrect tiles reported during profiling

The running headset was still on the original release, versionCode **1006001**. Its screenshot showed weapon artwork covering dungeon surfaces before any modified APK was installed.

A reproducible source bug was found in the retained menu renderer: changing runtime while keeping the same tileset path did not reload the atlas. In particular, a 3.6.7 sheet compiled for NetHack 5 could survive a switch back to 3.6.7, causing incompatible tile indices to select artwork. Starting a game now verifies the atlas runtime, reloads when it changes, and invalidates older load requests. Tests exercise actual asynchronous compilation followed by switching back to the original sheet. This is a plausible explanation for the screenshot; the exact headset sequence remains unconfirmed.

## Headset baseline

A read-only 30-second capture on the connected Quest 3 collected 30 native VrApi samples from app PID 21480, version 1.6.0 / versionCode 1006001. Activity was not controlled, and the scene was subsequently observed to be visually incorrect.

| Metric | Recorded result |
| --- | --- |
| Display target | 90 Hz |
| Native reported FPS | Mean 79.3; range 78–80 |
| Native `App` time | Mean 11.32 ms; p95 11.98 ms |
| Native `CPU&GPU` time | Mean 13.22 ms; p95 14.96 ms |
| Stale frames per sample | Mean 15.07; range 10–20 |
| GPU utilization | 97–99% |

Raw evidence and JSON are in the local ignored `quest/build/diagnostics/performance-2026-09-25-before.{log,json}` files. These are native compositor statistics, **not proof of delivered WebXR frame rate**, and cannot establish a movement-only bottleneck or an improvement from these changes. Reprojection is present in the native log. The shipping build has no Gecko debugger socket, so JavaScript CPU attribution could not be collected from that live session.

## Repeat profiling

For a release APK, this collects native telemetry without restarting the app, sending input, changing refresh settings or clearing logs:

```powershell
node scripts/quest/webxr/capture-native-performance.mjs 30 quest/build/diagnostics/performance-idle
```

Repeat with controlled movement and loading labels. Keep the headset awake and maintain the same runtime, level, pose and resolution for comparisons. Use MQDH to validate application performance at the requested refresh rate; the game's JavaScript callback rate alone is insufficient.

For a development build with Gecko remote debugging enabled:

```powershell
node scripts/quest/webxr/device-rdp.mjs
$env:QUEST_BROWSER_ID = '<active game browserId>'
node scripts/quest/webxr/device-rdp.mjs --eval-file scripts/quest/webxr/profile-frame.js
# Play for 30 seconds, then collect:
node scripts/quest/webxr/device-rdp.mjs --eval-file scripts/quest/webxr/profile-frame.js
```

The same script can be evaluated in a desktop/browser development console. It restores its wrappers automatically and separates menu, loading, movement and idle samples. Reports include p95/p99/max frame intervals, CPU timings, complete-frame draw counts, pending visual work and long tasks when supported. Timings are nested and instrumentation adds overhead. The script sends no gameplay input.

Validation: TypeScript passed, **938 Vitest tests in 140 files passed**, the profiler harness passed, and final browser, Electron, Android client and Quest builds passed. The signed APK is `release/NetHack 3D 1.6.0 Quest.apk`, versionCode **1006004**, SHA-256 `6ebf748a34c3435c5a81180e7d7c5a4353c6243966bcd9b06ced8c667dfc49ca`.

The modified APK has not been installed over the active game. A rebuilt headset comparison covering save loading, new characters, movement, all three runtimes and correct tiles is still required before claiming steady frame rate or store compliance.
