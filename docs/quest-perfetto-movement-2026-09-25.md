# NetHack 5 immersive movement: Perfetto analysis

Source: `com.nethack_Meta Quest 3_2026-9-25_17-38-10.pftrace`, 139,744,681 bytes, captured on Quest 3. The user confirmed NetHack 5, immersive VR, with frequent movement.

- Trace UUID: `ffdf9d69-d9a5-ea47-b442-95f4276ca777`, matching the supplied Perfetto viewer link.
- SHA-256: `c3356cd341ff175f8a7f6a4f62bfde5de9b0f8838e06413fcd6d6f392854b696`.
- Duration: 56.894 seconds.
- Analyzed locally with Perfetto Trace Processor v58.2 using its [SQL interface](https://perfetto.dev/docs/analysis/trace-processor).

## What the trace establishes

The dominant game thread is the browser content thread, PID 23251 / TID 23308 (`Isolated Web Co`). It accumulated **40.360 seconds executing**, **10.640 seconds runnable but waiting for a CPU**, and 5.840 seconds sleeping. Its blocked/uninterruptible time was only 0.054 seconds. The principal DOM worker used 0.944 CPU-seconds over the entire trace. The game is therefore spending much more CPU on the browser side than on the worker running NetHack.

Long gaps occur in both the browser canvas and native VR GPU submissions. These are **submission gaps**, not a direct application FPS measurement. The native VR submission timeline has the following large gaps; time is relative to trace start:

| Start | Submission gap | Content thread executing | Waiting for CPU | Sleeping |
| --- | ---: | ---: | ---: | ---: |
| 17.025 s | 554.5 ms | 358.4 ms | 196.0 ms | 0.1 ms |
| 50.258 s | 249.7 ms | 207.1 ms | 18.3 ms | 24.3 ms |
| 34.599 s | 171.5 ms | 67.7 ms | 54.6 ms | 2.4 ms |
| 48.790 s | 145.1 ms | 110.7 ms | 19.3 ms | 15.1 ms |
| 25.315 s | 122.4 ms | 34.3 ms | 88.1 ms | 0.0 ms |

The columns do not always sum to the complete gap because other thread states are omitted. The longest gap has almost no sleeping time: this is not evidence of a render loop waiting for an asynchronous tile fetch.

The capture also includes substantial **external collection overhead**:

- 4,617 `getprop` processes, including 2,406 recorded invocations of `getprop debug.vr.gpuprofilingservice` parented by `quest-perf-service`.
- 1,313 `dumpsys` processes, with repeated package queries and ADB ancestry.
- Across all their threads, `getprop` consumed 24.62 CPU-seconds and `dumpsys` 26.59 CPU-seconds. Shell, `cmd`, `grep`, ADB, and the performance service consumed additional CPU.
- Bursts of collection activity recur roughly every ten seconds. At seconds 25–26, the content thread spent approximately 543 ms of a second runnable but unscheduled.

These processes are not part of NetHack. They materially affect this measurement, but do not explain all of the app's CPU work. The trace supports reducing game-side work **and** using a less intrusive capture for the next comparison; it does not support dismissing the game's stalls as solely a profiler problem.

The content process's anonymous resident memory ranges from 460 to 564 MiB, with repeated growth and drops. That is consistent with allocation pressure, but the trace has **zero JavaScript stack samples, zero perf stack samples, and zero Android log records**. It cannot identify a particular garbage-collection pause or JavaScript function as the cause of the 554 ms stall. No GPU utilization counter is present in this trace either.

## Code changes

### NetHack 5 and the shared engine

- **Share neighbor rebuilding across small tile groups.** The previous time-budget loop flushed chamfers and ambient occlusion after every cell, repeatedly rebuilding overlapping neighbors. It now flushes groups of up to four cells, or earlier when the time budget is reached. Actor/feature snapshot boundaries and final batch cleanup remain intact. This applies to all three runtimes and flat clients as well as XR.
- **Reuse unchanged XR batch descriptors.** Each frame previously allocated descriptor arrays and strings for every eligible terrain material and mesh. Weak caches now reuse these descriptors. Direct material color, depth, texture, shader, layer and ordering changes invalidate the appropriate descriptor; transforms and clipping are still evaluated each frame. This applies to all runtimes in XR.
- **Avoid identical FPS minimap redraws.** Rewriting an unchanged canvas can cause another browser document composite. FPS minimap rendering now skips an identical position/facing/FOV/aspect/context state. Movement, head turns, resize and reset immediately redraw it; the overhead pulsing marker retains its animation. There is no new minimap frame cap.

### Additional 3.6.7 / SLASH'EM correction

Inferred corridor walls were rebuilt on every reconciliation even when their geometry and appearance were already current. Existing inferred meshes are now reused; missing/replaced meshes and explicit graphics/asset invalidation still rebuild. Authoritative floor observations still remove inferred walls immediately. **This inference path is disabled in NetHack 5 and was not responsible for the user's captured NetHack 5 dip.**

## Local validation and limits

The checked-in headless Chrome fixtures use the actual scene-update classes with synthetic terrain and a synthetic atlas. They measure CPU work, not GPU completion, full gameplay or Quest performance. The XR frame fixture uses a no-op render submission to isolate preparation costs.

| Fixture | Before | After |
| --- | ---: | ---: |
| NH5: 24 movement/update steps, neighbor occlusion calls | 3,120 | 2,460 |
| NH5: same steps, neighbor chamfer calls | 3,120 | 2,460 |
| NH5: 1,482 tiles, 3,000 XR preparation frames, mean CPU | 0.510 ms | 0.422 ms |
| 3.6.7: 328 inferred walls, 24 steps, tile rebuild calls | 7,866 | 4 |
| 3.6.7: same reconciliation fixture, total CPU | 99.6 ms | 2.2 ms |

The NH5 neighbor-call reduction is 21%; the recorded XR mean preparation reduction is about 17%. Whole-step timings fluctuate and are not presented as a demonstrated FPS improvement. The XR fixture's maximum frame time did not improve in the recorded pair. Results must not be extrapolated to a locked headset rate or VRC compliance.

The movement fixtures produced identical final geometry hashes before and after their respective changes:

- NH5: `ce76ffcb8f723b1502e106cb939982d0c14efe5ab7606594711f9727846806f6`.
- 3.6.7 corridor: `83628dbed69a1713eb4520ebe35d22be7447a53c4f218f4ea042dcfe4d0b00cd`.

This validates the fixture geometry, not pixel equality on a headset. Regression tests cover material changes, changed/replaced inferred walls, authoritative terrain, minimap resets and movement, and batching deadlines. **947 tests in 141 files and TypeScript pass.** Browser production and signed Quest builds passed. The resulting `release/NetHack 3D 1.6.1 Quest.apk` has versionCode **1006008**, SHA-256 `e1d0381aa50f6657899eb5caf56ceb4525e1388068f83586ccafd746cb4a473d`. No APK was installed or run during this pass.

## Reproduce

Trace queries are in [movement-trace.sql](../scripts/performance/movement-trace.sql). They discover app thread identities from the trace instead of relying on this capture's process IDs. With the official Trace Processor launcher:

```powershell
python trace_processor query -f scripts/performance/movement-trace.sql '<trace.pftrace>'
```

Local CPU fixtures:

```powershell
node scripts/performance/check-movement-work.mjs nh5-movement
node scripts/performance/check-movement-work.mjs nh5-frame-preparation
node scripts/performance/check-movement-work.mjs corridor-movement
```

The runner uses an isolated headless Chrome profile; `QUEST_CHROME` can override the executable path. It sends no gameplay commands and does not connect to the headset. Output reports go under the ignored `quest/build/diagnostics/perfetto` directory. The original local analysis is saved there as `movement-summary.csv` and the before/after fixture JSON files.

A follow-up trace should use the same game, scene, resolution and movement pattern, with collection overhead checked again. Browser CPU samples or the existing `profile-frame.js` method timings are needed to attribute the remaining long stalls to specific JavaScript work.
