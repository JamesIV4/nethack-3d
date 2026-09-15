# Performance pass: VR branch

Baseline: `vr-v2` at `1be3ffeae1ae02263c05fb627121c54ca6db4f8f`, September 15, 2026.

## Changes

| Area | Change | Preservation rule |
| --- | --- | --- |
| Combat blood | Skip noise calculations for saturated pixels; mark the pixels actually changed; recolor only dirty rows on ordinary updates, including the first deposit | Rasterization, random sequence, density accumulation, colors, particle counts and physics stay the same |
| Blood uploads | Restrict the Android CPU canvas copy to the dirty rectangle; retain desktop pending ranges until upload; retain a pending full upload until Three acknowledges it | Android keeps CanvasTexture, nearest filtering, no mipmaps, anisotropy 1, alpha guard and existing shader. Restore/recolor/clear paths still handle the full image |
| Three.js billboards and shatter | Render flat transparent planes in one pass; avoid invalidating proxy materials or color-only damage flashes every frame | DoubleSide still renders front and back. Opacity, color, depth state, movement and facing still update; source material/texture changes still invalidate shaders |
| Picking | Cache canvas alpha by texture/source revision, image and dimensions, with weak ownership | UV transforms, transparent edges and current alpha thresholds remain part of every hit test |
| Input | Bound and cache parsed controller binding strings | Live axes/buttons, remaps, press/release edges and existing command routing remain live |
| World presentation | Cache pure tile-signature decoding with a 2,048-entry limit; return independent copies | No cache of live glyph classification or WASM helper results; terrain/player-position fences and level snapshot ownership remain intact |
| UI | Retain unchanged HUD and ordered-list references; skip identical scalar notifications | Changed values still publish synchronously; prompt and menu lifecycles keep their ordering |
| Runtime and diagnostics | Avoid verbose callback/glyph/status formatting when logging is off; persist ordinary diagnostic bursts once per frame | Callback accounting/history, ABI guards, map helpers, status baselines and gameplay event transport retain their original order. Warnings/errors/assertions, reads, backgrounding and page exit flush diagnostics immediately |

## Measurements

Measured in desktop Edge using the local Vite server. These are bounded fixtures, not whole-game FPS measurements or physical Android/Quest measurements. The blood fixture uses the actual rasterizer, compatibility branches, vignette shader and WebGL renderer, with 120 simulation steps, 12 defeat deposits and 480 particle-impact deposits. Runs alternate baseline/current/current/baseline. CPU times below are totals per run.

| Measurement | Original | Updated |
| --- | ---: | ---: |
| Desktop, medium: blood rasterization | 37.9–39.6 ms | 21.8–25.4 ms |
| Desktop, medium: texture preparation | 13.9–23.9 ms | 1.6–2.1 ms |
| Android canvas path, medium: texture preparation | 103–130 ms | 2.4–4.6 ms |
| Android canvas path, medium: CPU canvas copy volume | 1,555.313 MiB | 0.780 MiB |
| Android canvas path, mobile default: CPU canvas copy volume | 97.207 MiB | 0.050 MiB |
| 100,000 map-signature decodes over 100 repeated signatures | 31.2–40.5 ms | 2.2–3.1 ms |

The final blood density and RGBA hashes match the original in every run: medium `1746707767` / `599110297`, mobile default `1850131156` / `3952048993`. Unit tests also preserve a separately recorded low-detail combat raster and its level restore, with hashes `1987085205` / `987416243`.

Operation-count regression checks verify:

- 120 unchanged billboard-proxy frames produce zero shader invalidations after initialization.
- Repeated transparent sprite picks read a canvas once per revision, with fresh reads after published changes.
- 100 identical HUD snapshots produce zero store notifications; actual damage/healing updates remain synchronous.
- 400 ordinary debug entries in one frame produce one persistence read/write and retain the latest 320 entries in order.

A WebGL readback check builds actual standing/flat billboard proxies and three shatter pieces, with overlapping transparency and an opaque occluder. Switching their planes from two passes to one reduces total draw calls from **11 to 6**. All 128×128 RGBA pixels match from front, back and two angled views (zero differing bytes; 1,152–2,651 visible pixels per view). Damage-flash tests preserve the red-to-white curve and cleanup without invalidating the sprite shader.

Render submission timings varied substantially, so they are not used to claim GPU speedups. Canvas copy volume counts the RGBA rectangle passed to `putImageData`; GPU upload volume in the fixture is inferred from texture dimensions/update ranges, not a hardware bus measurement. Android's full canvas GPU upload is deliberately retained and remains a potential cost during combat, especially at higher blood detail.

## Reproduce

```powershell
node scripts/performance/prepare-baseline.mjs 1be3ffeae1ae02263c05fb627121c54ca6db4f8f
npm.cmd run dev
```

Open `http://localhost:5173/scripts/performance/`. Choose a blood detail and run the desktop, Android canvas or map signature comparison. Keep the page in the foreground. Reference copies are generated only under the ignored `.wired-dev/performance/` directory; production source and WASM bundles are not overwritten. Blood comparisons fail visibly if their final hashes differ. The fixture has no game save or backend mutation controls.

The **Check planar effect rendering** button runs the GPU pixel/draw-count check and does not require a prepared baseline.

```powershell
npm.cmd run check:tsc
node node_modules/typescript/bin/tsc --project scripts/performance/tsconfig.json --noEmit --pretty false
npm.cmd test
```

## NetHack boundary and validation limits

The WSL reference checkout at `/home/james/Repos/forked/neth4ck-monorepo` was inspected read-only. `packages/wasm-367/NetHack/win/shim/winshim.c` confirms the tracked monster/attack IDs and mixed pointer/value status ABI; `src/mapglyph.c` confirms that tile position, object piles, hallucination and runtime display options participate in glyph presentation. Those live queries and callback contracts remain intact. No WSL or generated runtime changes are required by this pass.

The regression suite covers input and callback lifecycle, world/under-player refresh, status/reconnect ordering, resource ownership, blood snapshots, new cache invalidation cases and WebXR frame behavior. Build and package validation remain user-run under repository guidance.

Browser checks exercised NetHack 3.6.7, NetHack 5.0's tutorial and SLASH'EM startup, map/status updates, movement, inventory where populated, and return-to-menu teardown. Additional checks covered direction cancellation without consuming a turn, far-look cursor/cancel followed by movement, under-player pickup, legacy SLASH'EM stack drop/pickup, an observed monster death, and tiles → first-person → terminal → tiles transitions. Original display preferences were restored afterward.

The browser recorded the expected localhost FMOD copy-mode warning and one `WrongDocumentError` pointer-lock rejection during the automated mode/focus checks. Gameplay and subsequent mode transitions continued; the pointer-lock owner was not changed by this pass. This is a remaining browser/device validation caveat, not a claim of an error-free pointer-lock session.

Physical Android drivers, a headset and a physical controller still need device validation. In particular, verify sustained combat, texture restoration after switching display modes, alpha edges while aiming, controller neutral/release behavior and WebXR session exit/re-entry. A sudden process kill can lose the last unflushed frame of ordinary debug logs; warnings/errors and normal page lifecycle boundaries flush synchronously.
