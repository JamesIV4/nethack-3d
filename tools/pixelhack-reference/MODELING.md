# PixelHack modeling workflow and baseline

For a new asset assignment, start with [the agent guide](AGENT-GUIDE.md).
This document is the implementation reference and ant baseline record.

The first asset is **giant ant**, source tiles **0 and 1**. Their source images
are identical, so they share a mesh and rig. The model, its Python source, and
the idle/walk/attack clips establish the first visual and technical baseline. The
statue variants are separate work.

## View and regenerate

```powershell
npm.cmd run pixelhack:reference
# http://127.0.0.1:5175/tools/pixelhack-reference/model.html?tile=0

npm.cmd run pixelhack:model -- --tile 0
npm.cmd run pixelhack:model:check
```

The first command opens a development server. The model page has orbit/zoom,
four camera presets, Rest/Idle/Walk/Attack, an Attack trigger, pause, light/dark backgrounds, wireframe,
and a visible skeleton overlay. It loads the actual GLB through Three.js.

The modeling command runs the saved Python script in a fresh background
Blender process, validates the exported GLB with Three.js, and generates a
comparison sheet. It saves compact metrics to the console and detailed Blender
output to `exports/model-run.log`. It does not build the game.

Requirements: Blender 5.1 (verified with 5.1.2), Python with Pillow, and the
repository's Node dependencies. The launcher detects the local Blender 5.1
installation. Set `BLENDER_PATH` to override the executable. A live Blender/MCP
connection is not required.

For faster geometry iteration:

```powershell
npm.cmd run pixelhack:model -- --tile 0 --views hero,side --resolution 512
```

The final pass should use all four views. Rebuilding overwrites the registered
asset's generated files, including `model.blend`. Keep intentional hand edits
in a separate Blender file or transfer them to the source recipe first.

## Files and ownership

| File | Purpose |
| --- | --- |
| `models.json` | Explicit tile IDs, recipe path, output directory, triangle budget |
| `scripts/tilesets/models/giant_ant.py` | Ant proportions, parts, skeleton bindings |
| `scripts/tilesets/pixelhack_blender.py` | Palette, closed meshes, framing, lighting, GLB export |
| `scripts/tilesets/pixelhack_rig.py` | Explicit skin weights, skeleton, procedural animation baking |
| `scripts/tilesets/pixelhack-model.py` | Registry lookup and Blender orchestration |
| `scripts/tilesets/model-pixelhack.mjs` | One-command launcher, validation and comparison |
| `scripts/tilesets/verify-pixelhack-model.mjs` | Actual exported skin/clip validation using Three.js |
| `scripts/tilesets/review-pixelhack-model.py` | Exact tile pixels, four renders, 32/64/128-pixel checks |

Generated baseline files live in `models/0000-giant-ant/`:

- `model.blend`: 37 separately named mesh parts, vertex colors, 28-bone rig,
  editable Idle/Walk/Attack actions, review camera and lighting. Idle is selected
  for timeline playback. Use the Action Editor to choose Walk or Attack.
- `model.glb`: one skinned mesh, one vertex-colored PBR material, the complete
  skeleton, and all three clips. No external textures, cameras, lights, or floor.
- `model.json`: measured geometry, palette, source IDs/hash, Blender version.
- `validation.json`: exported animation/weight checks and measured tolerances.
- `hero.png`, `side.png`, `front.png`, `top.png`: transparent review renders.
- `review.png`: source comparison and small-size readability sheet.

## Visual baseline

Use smooth normals and continuous color gradients on the body, legs, jaws, and
antenna shafts. Retain distinct angular joints, a restrained palette, and a few
clear accents. The ant
translates the sprite into full-volume geometry;
its unseen side is inferred from bilateral insect anatomy. Preserve six legs,
two separated elbowed antennae, red eyes, a distinct head, narrow waist, pear
abdomen, and paired biting jaws. Its attack-ready pose lifts the forebody and
front legs, spreads the jaws, and braces the middle/rear legs. This follows the
sprite's aggressive attitude rather than a neutral anatomical standing pose.
The long antenna tips are slightly exaggerated
in thickness so they survive reduction. Do not model the sprite's baked shadow.

Palette values are sRGB. The helper converts them to linear vertex colors,
exports `COLOR_0`, and uses a standard rough PBR material. Lighting will affect
the apparent colors. Avoid requiring custom Blender-only shader nodes for the
exported appearance. The saved comparison uses repeatable orthographic views.

The current ant has **4,460 triangles**, **28 bones**, **one material**, and
approximately **0.3 MiB** of GLB data (exact bytes in `model.json`). The initial
recipe cap is 6,000 triangles;
it is a per-asset guard, not a performance target for every future creature.

## Scale and animation contract

- One game tile is one modeling unit. The ant's longest rest-pose footprint is
  0.92 units, including appendages; its origin is centered on the ground.
- Blender: **Z up, -Y forward**. Exported GLB/Three.js: **Y up, +Z forward**.
  The GLB is already converted; do not add a second corrective rotation.
- Root remains fixed. Idle lasts 3 seconds; Walk lasts 1 second at 30 fps.
  Both are baked to ordinary bone transforms with continuous loop endpoints.
- Attack lasts 0.5 seconds and plays once: immediate forward/upward pounce toward
  a human-size target, raised head and forelegs, jaw snap,
  short recovery. Its impact is at 0.1 seconds (frame 3); the first moving frame
  already reaches 45% of the lunge. Support feet lift with the pounce to keep the
  legs within reach. Mandibles open on frame 1, clamp shut between frames 2 and
  3, hold the bite briefly, and reopen during recovery. Its first and last poses
  match Idle's
  starting pose. `models.json` stores loop modes and impact time; `model.json`
  exports them as `animationContract`. The viewer returns to Idle on completion.
  Actual gameplay damage/event handling remains part of runtime integration.
- The leg rig has upper/lower/foot bones per leg. The head, abdomen, both jaws,
  and both antenna segments are independently posed. Explicit weights avoid
  automatic weighting leaking between nearby limbs.
- Idle retains the rearing attack pose; Walk lowers the forelegs to the floor.
  Walk uses alternating support tripods (L1/R2/L3 and R1/L2/R3). Stance feet
  travel backward at a constant rate relative to the body; swing feet lift.
  Travel is supplied by the game controller. At playback speed 1, the authored
  stride corresponds to about **0.113 tile units per second**. Match travel and
  playback speed to avoid sliding. It is a starter gait, not a locomotion system.
- The Blender file contains a deform/FK skeleton with editable baked actions.
  The recipe uses a two-link leg solver to generate those actions. It does not
  require Blender IK constraints or helper controls in the runtime asset.

## Review loop for each future model

1. Read only the selected subject's brief and variant notes. Inspect its raw
   crop plus light/dark previews before deciding geometry.
2. Author a recipe with named editable parts. Plan joint pivots and attachment
   geometry while modeling, then rig after the shape is stable.
3. Register the tile IDs, recipe, output directory, and budget in `models.json`.
   Keep different workers in separate Blender processes/output directories.
4. Run one command, inspect the actual renders, and patch only the relevant
   recipe/helper. Compare silhouette, palette, defining features, and small-size
   readability. Review unseen geometry from the other cameras.
5. Inspect the exported asset with its animations. The current baseline checker
   enforces a single primitive/material, normalized weights, Idle/Walk/Attack,
   continuous loop seams, attack-to-idle transitions, finite geometry, and a
   floor penetration tolerance of 0.008 units. The ant also checks 12 connected
   knee/ankle joints, immediate movement, forward/upward impact, and both jaw
   rotations. Adapt anatomy/contact assertions for other creatures while
   preserving the three required clips. See the [animation guidelines](AGENT-GUIDE.md#animation-direction-and-timing).
6. Save the recipe, editable `.blend`, GLB, evidence renders, and concise review
   notes together. A runtime integration/lighting pass is a separate acceptance
   step; the current proof of concept is verified in this standalone viewer.

Re-render an existing GLB in a clean Blender scene:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/tilesets/pixelhack-blender-review.py -- --model tools/pixelhack-reference/models/0000-giant-ant/model.glb --out-dir tools/pixelhack-reference/exports --prefix imported-ant --views hero
```

Add `--animation Walk --frame 8` to inspect an animated pose. For editable
Blender data, put the `.blend` path immediately after `--background` and omit
`--model`. The script clears the factory scene before importing GLB and replaces
lights/cameras with the shared review setup.

## Future breakup effects

The source file retains named closed parts. The GLB joins them for rendering
and does not currently expose stable debris groups. Preserve the source parts
and export deliberate groups or a debris variant when implementing death.
Freeze the deformed pose before detaching chunks. Continuous limbs need added
cuts/caps only if they must break into smaller sections. See the
[agent guide's death-effect guidance](AGENT-GUIDE.md#preserve-options-for-a-later-death-effect).
