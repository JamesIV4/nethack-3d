# Meta Quest Touch Plus controller assets

Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved.
These assets are supplied by Meta under the Oculus SDK License Agreement;
see [LICENSE.md](LICENSE.md). They are not covered by the game's source license.

## Source

- Official package: `com.meta.xr.sdk.core@205.0.0`
- Registry: https://npm.developer.oculus.com/com.meta.xr.sdk.core
- Archive: https://npm.developer.oculus.com/com.meta.xr.sdk.core/-/com.meta.xr.sdk.core-205.0.0.tgz
- Archive SHA-512 (base64): `Zva9QVzKXJ9JAi8sdz5uBkmQARhpwaE/u3rB90EzzKNlIAPUwAo01cb/gy+qzx5NCldyn6wyHHGAhCl+DOxtaQ==`
- Meshes: `package/Meshes/MetaQuestTouchPlus/MetaQuestTouchPlus_{Left,Right}.fbx`
- Textures: `package/Textures/MetaQuestTouchPlus/MetaQuestTouchPlus_{Left,Right}_BaseColor_AO_AlphaRoughness.png`
- Meta hardware art reference: https://developers.meta.com/horizon/downloads/package/oculus-controller-art/

`source/` retains the original model and base-colour inputs. `native/` contains
the corresponding static OBJ surfaces, MTL files and 512-square opaque KTX textures
for the existing native host loader. Each hand has 5,609 triangles, below the
loader's 16-bit vertex limit, with one material and one texture.

The converter exports bind geometry and normals, including the FBX's authored
centimetre-to-metre root transform. It does not mirror one hand to make the other,
invent a scale/rotation, or bake animated button poses. The separate SDK battery
indicator quad is excluded because the static host has no battery-display shader.
The original colour texture's alpha contains **roughness**, not transparency;
the host texture is therefore opaque RGBA, using the existing KTX reader and
an explicit `GL_RGBA` upload. The RGB PNG is retained as a preview/conversion
intermediate, not referenced by the native material. Metallic and normal maps are not used
by this host's diffuse material path.

Regenerate with `node scripts/quest/webxr/convert-controller-models.mjs` from the
repository root (requires Python with Pillow). `conversion.json` records the
source hashes, geometry counts and metre-space bounds.

`stageControllerModels` copies these assets and notices only into the Oculus
host source set. Existing Quest 3 asset names, controller selection, tracked grip
transforms, input bindings, lasers and weapon offsets are retained. No model
download is needed when playing. The native controller draw pass explicitly
restores depth testing, depth writes, the 0-to-1 depth range and a far-plane
depth clear after UI compositing.

The APK must be rebuilt and checked on the headset to validate physical fit,
texture appearance and occlusion in the final native renderer.
