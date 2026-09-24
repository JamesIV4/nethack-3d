# Giant ant baseline review

Source: PixelHack tiles 0/1; `monster:giant ant` in the prepared research catalog.

The user accepted the revised appearance and attack on **2026-09-24**; Walk
was subsequently retimed for half-second tile moves. Use this version as the
reference for the next assets, with the lessons in
[the agent guide](../../AGENT-GUIDE.md#animation-direction-and-timing).

## Art direction adopted

- Slate-gray carapace, dark limbs/joints, and red eyes from the source tile.
- Aggressive, rearing pose: high forebody, spread biting jaws, raised forelegs,
  and braced middle/rear legs. Avoid the first draft's neutral standing pose.
- Smooth normals and continuous color gradients on the head, thorax, abdomen,
  legs, jaws, and antenna shafts. Joints remain distinct and faceted.
- Antennae stay separated and slightly thicker than natural proportions so
  they remain visible at small sizes. Light/dark source previews retain the
  original pixels, without added outlines or shadows.

## Delivered

- Editable Blender file with named parts, a 28-bone rig, and Idle/Walk/Attack actions.
- GLB with one skinned mesh/material and no external textures.
- Idle: 3-second threatening stance; Walk: 0.5-second loop with two broad
  alternating tripod strides and the raised forelegs lowered to the floor.
  The intended controller motion is one tile per loop; the exported stance
  foot sweep measures about 1.72 tiles per second.
- Attack: immediate forward/upward pounce toward a human-size target, with
  raised head/forelegs and a sharp jaw snap, impacting at 0.1 seconds;
  complete action/recovery lasts 0.5 seconds. Plays once, then returns to Idle.
- Four orthographic renders and a source comparison sheet, including
  32/64/128-pixel reductions. Fine features are clearest at 64 pixels and above.

## Verification

The generator imports the GLB into Three.js and checks every vertex's skin
weights, finite animated positions, floor tolerance, both loop seams, and the
attack's idle transitions over 61 samples per clip. It checks all 12 knee/ankle
connections, movement on the first frame, upward/forward body displacement at
impact, and visible rotation of both mandibles. Exact results are in
`validation.json`. The baseline has
4,460 triangles; `model.json` records the exact current GLB size.

At impact the body moves approximately 0.183 units forward and 0.118 upward.
Each jaw swings approximately 40 degrees from open to closed. The full attack
lasts 0.5 seconds, with impact at 0.1 seconds and a clean return to Idle.

The model was visually reviewed in Blender renders and the standalone browser
viewer. The export/reimport review path also successfully rendered an animated
GLB pose in a clean Blender scene. The repository TypeScript check passed.

This baseline is not yet connected to game glyph rendering. Gameplay scale,
lighting, animation travel speed, and device performance still need an in-game
pass when that integration is implemented. Keep the source recipe as the
reproducible asset definition; regeneration overwrites the generated Blender file.
