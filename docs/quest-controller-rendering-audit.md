# Quest controller rendering audit

Status: runtime GLB path implemented and source-validated; headset visibility and alignment remain unverified.

## Runtime-supplied models are available as an API

Meta documents loading controller models from the headset through
`XR_FB_render_model`: enumerate paths, obtain a model key, and load its GLB.
Controller paths are `/model_fb/controller/left` and `/model_fb/controller/right`.
Support and non-null model keys must be checked on the actual runtime; a missing
model is a supported outcome. Loading belongs outside the time-sensitive frame loop.

This supplies model data, not a system compositor layer that automatically draws
Quest Home's controllers. The application still owns rendering and animation.
Meta's `OVRRuntimeController.cs` in XR Core SDK 205.0.0 loads animation nodes and
updates buttons, triggers, grip and thumbstick from live input. Its accompanying
`OVRGLTFAnimatinonNode.cs` supports translation, rotation, scale and morph weights.
The SDK implementation is a reference, not a Unity dependency we can drop into C++.

Sources:

- [Meta: Render Controllers at Runtime](https://developers.meta.com/horizon/documentation/unity/unity-runtime-controller/)
- [Meta: Controller Animations](https://developers.meta.com/horizon/documentation/unity/controller-animations/)
- [Khronos: xrLoadRenderModelFB](https://registry.khronos.org/OpenXR/specs/1.0/man/html/xrLoadRenderModelFB.html)
- [Khronos: render-model capability levels](https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrRenderModelFlagBitsFB.html)

## What our host currently supports

The pinned Wolvic checkout under `quest/runtime/wolvic` shows:

- `OpenXRExtensions.cpp` already loads the three `XR_FB_render_model` functions.
- `OpenXRInput.cpp::LoadKeyboardModel` filters the available model paths to keyboards.
- Controller selection instead resolves static filenames through
  `OpenXRInputSource.cpp::ControllerModelName` and `OpenXRInputMappings.h`.
- `ControllerContainer.cpp` attaches the loaded model group to the tracked
  controller transform and toggles it with tracking/device state.
- `vrb::ParserObj`/`NodeFactoryObj` support OBJ positions, normals, UVs, faces and
  MTL materials. This path has no controller articulation or morph animation.
- `TrackedKeyboardRenderer.cpp` already parses GLB and transcodes KTX2 through
  libktx. It explicitly selects mesh 0 / primitive 0 and must not be treated as a
  complete animated controller renderer.
- `BrowserWorld.cpp` draws native controllers after the HTML panes. Model
  visibility depends on the loaded group, tracking toggles, coordinate space,
  eye matrices and GPU state, not just the asset format.

The converted OBJ meshes are structurally compatible with the static loader and
their assets were observed in the installed APK. Those checks do **not** establish
that a controller reaches the eye framebuffer. Converting FBX to static OBJ also
removes the rig/animations, so it cannot satisfy interactive buttons and sticks.
The texture and depth changes made so far have not been validated as a fix for
the reported absence. Further blind file-format swaps are not an adequate test.

## Recommended implementation and validation order

1. Establish native rendering: draw a small solid diagnostic shape at each valid
   tracked grip, with independent left/right colours. Check both eyes, menu,
   tabletop and first-person. Record profile, visibility toggles, loaded node and
   triangle counts, model bounds, matrices, shader/upload failures and framebuffer
   state. This distinguishes loading, pose/culling and draw-state failures.
2. Verify the actual headset supports controller render-model paths and returns
   model keys. Keep this capability result distinct from keyboard support.
3. Load runtime GLBs asynchronously, caching by model key/version. Handle device
   changes, temporary unavailability and session/context teardown explicitly.
4. Implement the returned glTF features: node hierarchy, all required primitives,
   materials and KTX2/Basis textures. Request only capability levels the renderer
   really supports. Validate bind coordinates against OpenXR grip space; do not
   transplant Unity-specific pose offsets blindly.
5. Retain animation targets and bind live trigger/grip values, face/menu buttons,
   stick axes/clicks and supported touch states. Apply only changed animation
   values per frame. Do not alter the existing game input routing.
6. Validate press/release, stick return to neutral, reconnection, both eyes and
   native UI occlusion on the headset. Remove the temporary diagnostic shapes.

If runtime models are unavailable, use a bundled articulated GLB with an explicit
controller profile/input mapping as fallback. OBJ remains suitable only for a
static fallback, not for interactive controller models.

This audit did not build or install an APK and does not establish runtime support
on the connected headset. A source-level GLB loader or a passing asset test alone
is not an on-device rendering result.

## Implemented runtime GLB path (September 17)

The native host now enumerates controller model paths and loads GLBs on a worker,
with model-key/version caching. Completed bytes are published on the native frame
thread through JNI to the local asset server. GET/HEAD endpoints report model
availability and ETags. Session destruction joins outstanding OpenXR work before
the session handle is destroyed and clears published models.

Three.js renders controllers in a separate tracked-grip overlay after the world,
with fresh depth and without dungeon clipping or artificial stereo-depth changes.
It loads hierarchy, skinned/morph geometry and KTX2 textures through GLTFLoader,
and uses unlit textured materials for consistent visibility. Runtime animation
channels support the recognized Meta node names and pose layouts; unsupported
layouts use the bundled articulated Touch Plus fallback. Optional missing fallback
menu-button nodes are skipped. System-reserved buttons cannot animate without
input state exposed by the runtime. Tracking loss hides the corresponding model.

Both menu and game share this owner. Reconnection, late loads, cancellation and
GPU resource cleanup are handled. Native OBJ device models are hidden only while
immersive WebXR presents; pointers and hand tracking retain their native owners.
The existing game input and weapon transforms are unchanged.

Diagnostics are available through `WebXrPresentation.controllerModels.diagnostics`:
source, state, tracking, mesh/triangle/channel counts, model tag and load error.
Loading and failed models stay hidden. A ready model and its laser fade in over
250 ms; laser opacity travels in the existing UI request header without changing
the map/UI array contract or adding requests. Native UI
is composed after the WebXR projection and can cover these models.

Validation: TypeScript, controller/input/weapon/frame-lifecycle tests, targeted
menu/session tests, GLB profile checks, JVM HTTP endpoint tests, compiled native
loader tests, and Android NDK syntax checks for all three patched C++ units.
The full presentation suite has existing failures beginning with its minimap
clipping assertion; the same failures were reproduced against HEAD source.
No APK was built or installed for this change. Both-eye visibility, grip alignment,
physical animation, native UI occlusion, suspend/resume and reconnection still
need headset validation after rebuilding.
