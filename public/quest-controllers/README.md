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
