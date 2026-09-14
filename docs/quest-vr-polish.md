# Quest 0.3.9 polish checklist

The standalone APK keeps the original Three.js scene, game handlers, and single live HTML surface. Changes are reproduced by `prepare-gecko-runtime.mjs` and `patch-polish.mjs`; no new Gecko rebuild is required beyond the 0.3.8 runtime.

| Request | Implementation |
| --- | --- |
| No Wolvic startup splash or acceptance message | Skip native splash creation and browser legal dialogs; do not record consent. Android launch preview is black and has no branded icon. |
| Large flat window by default | Use Wolvic's own 2× resize preset on kiosk startup. |
| Black void instead of city panorama | Disable environment loading and use black for the immersive scene background. |
| Laser endpoint above UI | Separate native pointer root, drawn after all HTML panes with depth testing/writes disabled. |
| Separate right actions from minimap | Actions remain pane 2 beside the table; minimap is independent pane 5 farther back. |
| Right-button hover feedback | VR hover/focus states use the existing blue palette, border and highlight. |
| 150% render resolution with setting | Default XR framebuffer dimensions to 150%; increase native HTML surface density to 150%. VR settings expose a saved 50–200% framebuffer multiplier, applied on the next VR entry. |
| RT popup bottom on selected tile | Capture selected tile and surface height on press; transform its game-space anchor into tracking space each frame. Native modal geometry offsets its center upward by half its height. |
| Top UI pitch faces headset | Keep its bottom edge at the far table edge; adjust pitch only toward the viewer. |
| Two bottom table icons | Grid icon opens a visible-map-area slider; scale icon opens a world-and-UI slider. Area enlarges clip bounds and board without changing tile scale; scale enlarges the complete presentation without changing tile count. Both persist across launches. |
| Sprites face camera origin in VR | Sprite shader uses the shared headset center rather than each eye's screen-parallel plane. Raycasts use the same facing plane. Existing material hooks remain; normal facing is restored outside VR. |

`settings.ts` owns host-specific persisted settings. `TableControls.tsx` mounts once for the XR session and is removed on exit. The controls have their own pane 6. The transport now has a 24-float header (the prior anchor header plus area, scale, context-active, context X/Y/Z), at most seven panes, and a maximum of 571 floats.

Validation: 57 focused tests; TypeScript check; native C++ and APK builds; browser interaction checks for separate panes and both sliders; real WebGL pixel check for spherical sprite facing and unchanged flat rendering. Physical readability, sizing, cursor placement, and headset performance at the higher resolution still require sideload testing.

## 0.3.10 clarity corrections

- Sprite rendering and raycasts use fixed game-world Z-up, removing headset roll from billboard orientation.
- The action pane hangs below the tilt ring's full interaction radius, with an additional 8 cm gap at unit scale. Its top edge remains below the ring at any table pitch or pane height.
- Gecko's `XRWebGLLayer` clamps the requested scale to the host's advertised `nativeFramebufferScaleFactor`. Wolvic advertised 1.0, silently capping the previous 150% setting. `patch-resolution.mjs` advertises a ceiling up to 2.0, bounded by the OpenXR view/system and GL texture/renderbuffer limits, including Gecko's combined side-by-side texture width.
- Wolvic's previously empty `SetImmersiveSize` now matches the output eye swapchains to the actual WebXR framebuffer size. Flat-mode projection buffers also default to 150% of recommended dimensions.
- HTML surface density stays at 150% after recreation. Gecko density/DPI and screen overrides rise with it, preserving the logical viewport rather than shrinking the UI.
- VR settings report actual pixels per eye. Native logs expose `NH3D resolution limit`, `NH3D resolution: WebXR eye ... -> OpenXR eye ...`, and `NH3D HTML surface` dimensions. APK publication checks that the native resolution code is present.

Validation: 58 focused tests and browser/GPU checks. The connected old app reported DPR 1.25 with a 1920×1200 logical viewport and a 2400×1500 flat canvas; it was outside VR during inspection. Source tracing established both resolution caps. New headset dimensions and visual sharpness still require sideload validation.

## 0.3.11 first-person UI and facing

- The action strip lies parallel to the table at its bottom-right edge, starting below the pitch ring's interaction radius plus a gap. It rotates with the table again.
- Billboard facing uses the actual XR viewer position transformed into the original game scene. Three.js's stereo-union camera has a backward offset that rotates with the headset; it is retained for rendering/culling but no longer supplies sprite or standing-mesh facing positions. VR standing meshes also avoid orientation-dependent zero-distance fallbacks.
- Popups and modals have half their previous width and height. First-person HUD crops exclude the original modal rectangle, preventing a second full-size copy. Wired preview uses an equivalent CSS scale.
- First-person floating messages are centered in the HUD. Tabletop messages retain their left-side layout.
- `LaggingUiAnchor` holds the first-person frame until yaw exceeds 20 degrees or horizontal translation exceeds 20 cm. It then uses a critically damped exponential response (omega 9), with no pitch/roll or vertical following. Native rendering interpolates between transport updates. The existing native frame distance is retained.
- Snap turns increment a separate UI recenter revision, immediately centering horizontal position and heading and clearing both smoothing stages. Table anchoring remains independent. Exiting VR clears native follow state.

The transport header is now 29 floats: the prior 24 plus first-person UI anchor X/Y/Z, yaw, and recenter revision. HUD crop IDs 7–10 surround a separate modal ID 4; at most seven panes remain active. `patch-ui-follow.mjs` installs the native changes reproducibly.

Validation: TypeScript, 66 focused tests, native and APK builds, and browser/GPU checks. Tests cover fixed-position headset rotation versus the stereo-union camera, physical head movement, frame-rate-independent following, angle wraparound, horizontal deadzones, snap recentering, modal cutouts, and message centering. Headset comfort and visual placement still require testing.
