# Quest 3 performance pass

Measured September 15, 2026, starting from `d70116e` on `vr-v2`.

## Result on the running headset

The explored NetHack 3.6.7 level had 503 tiles, 736 scene objects and seven billboards. The player stayed at `(20,16)` throughout. Tabletop VR used Nevanda tiles, lighting, ambient occlusion and existing ground blood. There were no active movement/reveal/effect animations or pending tile updates. The XR framebuffer was 4033 × 2112 across both eyes; resolution and foveation were unchanged.

| Measurement | Original | Final preview |
| --- | ---: | ---: |
| Stereo draw calls, median | 3,608–3,620 | 484 |
| Game frame interval, mean | 29.8–34.9 ms | 15.2–15.4 ms |
| Frame interval, p95 | 34–40 ms | 19 ms |
| World preparation and render submission, mean | 23.6–28.5 ms | 9.4–9.7 ms |
| Native HTML panel update, mean | 1.26–1.30 ms | 0.03–0.04 ms |
| Controller input, mean | 1.38–1.52 ms | 1.53–1.57 ms |
| Resident textures | 97 | 97 |

This is approximately **87% fewer draw calls and half the game frame time**. Controller CPU time is effectively unchanged in this view. The new ray-range rejection helps when a pointer misses the board.

These are six-second samples from the actual Quest application, using temporary, reversible previews of the changed TypeScript classes and methods. They measure application frame intervals and CPU submission, not GPU completion or the headset compositor's refresh rate. Timer precision, tracking and scheduling cause variation. Earlier cold/intermediate samples were slower. Repeated original-code samples after removing the preview measured 3,620 calls/34.9 ms and, with a slightly changed tracked view, 3,608 calls/29.8 ms.

The installed APK was `0.3.21-vr-options`. No APK was built or installed during this pass. The running session was restored after testing, including its original meshes/materials, renderer methods and resource counts. The source changes require the normal rebuild and sideload to become permanent.

## What was expensive

GPU clipping limited the tabletop image, but Three still submitted tiles outside the board. Each multi-material block submitted all six faces for each eye, including its underside and adjacent faces sharing one material. Solid inferred walls also submitted six identical materials. Ground tiles had separate draw calls despite sharing opaque texture content.

Clipping alone reduced the live view from 3,620 to 1,684 draws. The final reduction also uses terrain instances, fewer block-face groups and no underside submissions.

The ordinary controller poller resets its cursor while XR owns input. Gecko reports a mutation even when `classList.remove` removes an already absent class. This dirtied the native pointer bridge's entire DOM hit layout every frame. Guarding those redundant class/style writes removed the recurring layout scan without changing the cursor's reset behavior.

The idle sample did not implicate blood updates, the runtime worker, terrain inference, sprite-facing updates or minimap drawing as the primary bottleneck. Desktop postprocessing and shadow rendering were already absent from the XR path.

## Rendering changes and boundaries

- [World clipping](../src/game/engine/rendering/world-clip-culling.ts) rejects a mesh only when its transformed bounds lie wholly outside an existing clipping plane. Partial edge tiles stay on the GPU clipping path. Children are tested independently; tracking-space UI is excluded. Animated/deformed meshes and sprites keep their existing bounds behavior.
- [Terrain instances](../src/game/engine/rendering/xr-terrain-batches.ts) batch shared opaque solid-wall materials and ordinary floor/dark-ground tiles with matching material state. Ground alpha must be entirely opaque in the actual texture; unreadable or transparent textures fall back. Texture/source revisions and image identity/dimensions invalidate the alpha check. Fading tiles, special terrain and other unsupported material configurations retain their original draws.
- [Wall render geometry](../src/game/engine/rendering/terrain-render-geometry.ts) omits downward-facing triangles and combines adjacent groups using the same material. It preserves two-pass transparent group ordering. Source geometry, face indices and UVs remain intact for picking. Derived geometry is cached, invalidated on attribute changes and disposed with its source or XR owner.
- The existing vignette shader already handles `instanceMatrix`. Instances preserve that hook and the original scene scale. No texture atlas, lighting model, Android blood texture options or blood shader changed.
- Original tile meshes remain authoritative. Geometry/layer changes are scoped to the synchronous render call and restored in `finally`. Instance groups stay hidden between frames, so input targets the original tiles. This also covers render failures and mode/session cleanup.
- [World raycasting](../src/quest/webxr/world-raycast.ts) narrows each ray to the board's half-spaces before Three's existing geometry tests, retains exact hit-point clipping and restores near/far bounds. Hidden top-level objects are skipped. A more expensive per-object bounds filter was measured and discarded.

The regular solid-wall material assignment also uses one material instead of six identical entries. The additional instancing, face-group merging and underside omission are scoped to XR rendering. Camera lifecycle, input timing, terrain/under-player caches, blood effects and game/runtime event contracts retain their existing owners.

## Verification

- TypeScript and the complete Vitest suite pass: **591 tests in 83 files**. Focused cases cover partial clipping, transformed rectangular cells, child overlays, growing exploration, ray boundaries, hidden targets, fading/alpha fallback, texture revisions, instance capacity growth, moved tiles, level replacement, resource disposal and error restoration.
- On the Quest GPU, compared original and changed rendering into 384 × 384 targets for both eyes and two shifted viewpoints. Clipping, underside omission and face-group merging produced **zero differing RGBA bytes** across all four views.
- Solid-wall instancing produced small rasterization/shading differences: 6–150 differing bytes out of 589,824 per view in the final comparison; most differed by one, with a maximum channel difference of five. Adding ground instancing produced no additional differences in those views. The comparison images were visually inspected. This is not a claim of byte-identical instanced rendering.
- Compared 84 rays through the real level: 37 hits, **zero target or hit-position mismatches**. No gameplay commands were sent.
- Cleanup returned the live scene to 736 objects, 15 geometries, 97 textures and zero temporary instance roots.

The rendering changes operate on the shared client representation for NetHack 3.6.7, NetHack 5.0 and SLASH'EM. No game-source, WASM shim or transport changes were made. Live headset measurements covered the user's 3.6.7 tabletop session; packaged first-person play, fresh exploration/combat and the other two games still need headset acceptance testing. The measured frame times do not establish a locked 72/90 Hz application rate.

## Repeat the frame sample

List the headset's tabs first; the host can contain both an old startup page and the active game:

```powershell
node scripts/quest/webxr/device-rdp.mjs
$env:QUEST_BROWSER_ID = '<active game browserId>'
node scripts/quest/webxr/device-rdp.mjs --eval-file scripts/quest/webxr/profile-frame.js
# Keep the headset rendering for at least 30 seconds, then collect:
node scripts/quest/webxr/device-rdp.mjs --eval-file scripts/quest/webxr/profile-frame.js
```

The profiler restores its method wrappers automatically. The second invocation collects the report; another invocation starts a new sample. CPU timings are nested and should not be added together. Compare the same level, pose, settings and activity. `webXrPresentation.render` includes instancing/culling; `rendererSubmission` measures the inner Three call. The current profiler also measures the whole engine frame, all render passes, loading/menu/movement/idle phases, tile queues and runtime-event processing. Phase labels describe client animation/loading state, not an externally controlled benchmark. Release builds without the Gecko debugger can use the read-only native capture described in [the September 25 pass](performance-2026-09-25.md).
