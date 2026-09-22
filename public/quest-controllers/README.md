# Controller assets

`meta-quest-touch-plus/{profile.json,left.glb,right.glb}` are bundled from
`@webxr-input-profiles/assets@1.0.20` (MIT; see LICENSE-input-profiles.md).
Source: https://github.com/immersive-web/webxr-input-profiles
These are the offline articulated fallback. The APK first tries the GLB supplied
by the headset through XR_FB_render_model. No CDN is contacted at runtime.

The published left profile references three menu animation nodes absent from
its GLB. Missing visual responses are skipped; other responses are validated by
the asset test. Menu/system button state may also be reserved by the runtime.

`basis/` is copied from the installed Three.js distribution's
`examples/jsm/libs/basis/`. Its Apache-2.0 transcoder supports runtime KTX2
textures; the decoder is loaded only when needed. See basis/README.md and LICENSE.


## Offline ambient occlusion

The bundled GLBs include vertex AO baked by `npm run quest:controllers:bake`.
Original fallback geometry is retained in
`quest/webxr/controllers/meta-touch-plus/articulated-source/`.
Exact Meta runtime GLBs captured from the running Quest on September 17 are in
`quest/webxr/controllers/runtime-source/`. Their baked versions live in `runtime/`,
keyed by the original file's SHA-256 in `prebaked.json`.

The bake appends COLOR_0 data while retaining the original binary payload,
textures, materials, skinning, morph targets, node identities and animations.
Existing vertex colors are multiplied by AO. It never rebakes generated outputs.
No baking runs on the headset. Unrecognized future runtime models retain their
own geometry, source AO maps and normal lighting; they do not trigger a bake.
The baker is a development tool and is not imported by the application bundle.
