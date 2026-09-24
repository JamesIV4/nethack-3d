# PixelHack: one-assignment modeling guide

Use this guide to take one requested tile from reference to a finished 3D asset,
including the required animations, in one assignment. Include render inspection and corrections
before delivery. Aim to make the first user-visible result a convincing model.

## Start here

1. Read the repository's [agent rules](../../.agents/rules/AGENTS.md).
2. Read this guide and identify the requested asset's visual and technical requirements.
3. Load only your tile's catalog entry, research brief, variant notes, and source
   crop. Use [MODELING.md](MODELING.md) for implementation details as needed.
4. Reuse saved Blender Python recipes, the CLI launcher, and the existing review
   tools. Work in this standalone utility. Game integration is a separate task.

### Visual requirements

- **Pose carries personality.** Determine what the sprite is doing before
  drawing its anatomy. Express aggression, weight, alertness, movement, or other
  visible intent through the silhouette and stance. Establish body orientation,
  balance, support points, and expressive gestures from the selected tile.
- **Smooth curved surfaces.** Use smooth normals on the body, legs, jaws,
  antennae, and comparable organic forms. Distinct joints and genuinely sharp
  edges can retain harder shading. Keep smooth surfaces free of abrupt
  per-face color bands as well as faceted normals.
- **Preserve PixelHack identity.** Keep the silhouette, proportions, palette,
  defining features, and readable dark separations. Translate these into full
  3D volume. Use the wiki to resolve identity/anatomy and the actual tile to
  establish appearance. Record inferred unseen details briefly.
- **Plan for animation immediately.** Choose joints and movable parts during
  modeling. Rig after the primary shape is settled, before final export.
  Every creature requires **Idle**, **Walk**, and **Attack** clips. Idle and Walk
  loop; Attack plays once with immediate, unmistakable movement, impact, and a
  short recovery. Make the strike snappy and forceful, with visible action in
  the first few frames and very brief anticipation. For a flying
  or slithering creature, Walk is the locomotion slot with suitable motion.
  Animate the attacking feature explicitly: biting jaws should open and snap
  closed sharply, synchronized with impact. Body translation alone is insufficient.
  Aim the strike at the intended target's height and position. Choose movement
  direction from the attacker's anatomy, relative size, and attack mechanism.
- **Protect fine features.** Separate antennae, claws, blades, and limbs in
  silhouette. Slightly exaggerate their thickness when needed at gameplay size.
  Inspect exact source pixels on both light and dark backgrounds; retain the
  original crop as the authority for separating subject and scenery.

Choose polygon, material, and bone budgets according to the subject's silhouette,
deformation needs, expected screen size, and runtime constraints.

## 1. Assemble a small reference packet

Run commands from the repository root. Set the ID to the requested tile;
the commands below use 2 as an illustrative value.

```powershell
$pixelhackTileId = 2
@'
import { readFileSync } from 'node:fs';
const read = (file) => JSON.parse(readFileSync(`tools/pixelhack-reference/${file}`, 'utf8'));
const id = Number(process.argv[2]);
const catalog = read('catalog.json');
const research = read('research.json');
const art = read('art-analysis.json');
const tile = catalog.tiles[id];
if (!tile) throw new Error(`No tile ${id}`);
const pair = art.variantPairs.find(p => p.maleTileId === id || p.femaleTileId === id);
const related = catalog.tiles.filter(t => t.researchKey && t.researchKey === tile.researchKey);
console.log(JSON.stringify({
  tile, brief: research.subjects[tile.researchKey] ?? null,
  variant: research.tiles[String(id)] ?? null, pair,
  related: related.map(t => ({id: t.id, label: t.label, category: t.category,
    variant: research.tiles[String(t.id)] ?? null}))
}, null, 2));
'@ | node --input-type=module - $pixelhackTileId
py scripts/tilesets/export-pixelhack-reference.py --tile $pixelhackTileId
```

Open the exported PNG with the available image-viewing tool. Read the pictures
before writing geometry. Use relevant completed assets to check consistency
when available. The prepared briefs already contain wiki sources;
research a specific gap when the tile or identity requires it.

For variants, use `identicalPixels` and per-tile notes to decide reuse. A shared
research key alone does not prove identical artwork. Source male/female labels
can be placeholders. Statue tiles require their own stone treatment. For
randomized objects, model the visible appearance and preserve its tile mapping.

Write these six short decisions in the recipe header or asset review note:

```text
Identity and variants:
Silhouette / relative proportions:
Pose and personality, with visible evidence:
Palette and materials:
Features that must survive at 32/64 pixels:
Movable parts, clips, target height, impact timing, contacts, and any inference:
```

Make these decisions before detailing. Describe the relative positions of the
main masses and expressive parts, then encode them in the geometry. Establish
character through the stance and silhouette before adding small accents.

## 2. Reuse the implementation, adapt the subject

Add a recipe under `scripts/tilesets/models/` and an entry in
[models.json](models.json). Follow the existing entry's exact schema:

```json
{
  "id": "subject-slug",
  "title": "Subject name",
  "tileIds": [2, 3],
  "directory": "tools/pixelhack-reference/models/0002-subject-slug",
  "script": "scripts/tilesets/models/subject_slug.py",
  "triangleBudget": 6000,
  "animations": {
    "Idle": { "loop": true },
    "Walk": { "loop": true },
    "Attack": { "loop": false, "hitTime": 0.1, "maxDisplacement": 0.35 }
  }
}
```

Replace every example value, including verified tile IDs, the chosen budget,
and the attack's actual impact time in seconds.
Preserve existing registry entries. Implement the driver's recipe interface:

```python
def build():
    # Create named mesh parts in authoring coordinates. Define the subject's
    # palette before constructing materials or vertex colors.
    ...

def rig_model(objects, transform):
    # The driver has normalized the meshes. Apply this same transform to
    # skeleton coordinates, bind the parts, create/bake clips, return the rig.
    ...
```

Use the shared [geometry helpers](../../scripts/tilesets/pixelhack_blender.py)
and [rig helpers](../../scripts/tilesets/pixelhack_rig.py) selectively:

| Need | Existing helper / rule |
| --- | --- |
| Rounded body volume | `shell(..., smooth=True)`; inspect end caps and silhouette |
| Limbs, jaws, antennae | `tube(...)` is smooth by default; author meaningful bends |
| Rounded ellipsoid | `smooth_surface(ellipsoid(...))`; bare ellipsoids are faceted |
| Smooth color transitions | `smooth_surface(..., tonal=True)` or `tonal="limb"` |
| Explicit geometry | `mesh(...)`, followed by smoothing where appropriate |
| Skeleton and skinning | `create_rig(...)`, `bind(...)` in `pixelhack_rig.py` |
| Export and review | Let `pixelhack-model.py` call the shared helpers |

The current shell helper treats a supplied `shade` callback as a request for
the standard continuous gradient when `smooth=True`. Supply a custom gradient
when the subject needs a different distribution. Smooth normals need enough
geometry for the outer contour too; spend triangles on visible contours and
deformation before surface decoration.

Keep named parts editable in `.blend`. The exporter joins temporary copies
for GLB. Prefer a small palette in `COLOR_0` and a standard PBR material when
that represents the subject. Transparent wings or glass can need a different
material contract. Derive color choices from the selected tile.

### Match the tooling to the asset

The launcher supports registered recipes. Check its defaults against the asset
contract before the first run:

| Current behavior | Required decision for the new subject |
| --- | --- |
| Shared palette values | Set colors in the recipe's fresh process and preserve other recipes' appearance. Metadata must record the colors actually used. |
| Existing procedural animation functions target particular rigs | Reuse `create_rig`/`bind`; author motion for the required anatomy and bone layout. |
| Validator expects a skinned creature, one material, required clips, ground contact, and bounded displacement | Define asset-specific material, contact, motion, and joint checks. Keep Idle/Walk/Attack for creatures. Static objects, flying creatures, and transparent surfaces need appropriate validation contracts. |
| `normalize(...)` sets the longest footprint to 0.92 units and grounds the lowest point | Check intended relative size, hovering, and origin; make any different policy explicit for that asset. |
| Saved `Idle` timeline is fixed to frames 0-90 | Match it to the new action's actual duration. |
| Viewer text, source links, and comparison captions can contain example-specific content | Populate them from the selected asset's data before presenting it. |

Resolve the applicable assumptions as part of the asset task. A static object
can omit `rig_model`, but the current validator will still reject it until the
static-asset contract is implemented. Keep real geometry/weight/export checks
when adapting the expected clips or contact rules.

## 3. Complete geometry, pose, and rig in one coherent pass

1. Establish the body's main volumes and action line, then place support limbs
   and expressive limbs. Check the silhouette against the crop.
2. Add the defining features with enough separation to read from the matching
   camera and the three-quarter camera. Preserve the sprite's visual emphasis.
3. Set smooth shading and continuous colors on every intended smooth part,
   including appendages. Keep joints distinct where that helps articulation.
4. Apply pose transforms consistently to attached geometry and skeleton
   anchors. A moved head must carry its eyes, jaws, antenna roots, and bones.
5. Bind rigid parts explicitly; blend weights only where deformation needs it.
   Derive ring sizes from the generated mesh when weighting swept geometry.
6. Bake **Idle**, **Walk**, and **Attack** for creatures. Keep root motion and
   playback/travel expectations explicit. Inspect support contacts, limb
   clearance, both loop seams, and the attack's entry/exit transitions. Record
   `Attack.hitTime` in seconds in the registry's animation contract. Match the
   attack to the subject's bite, sting, weapon, touch, or casting behavior.

Coordinate contract: author with **Z up / -Y forward**; export to
**Y up / +Z forward**. One tile is one unit. Use the transform passed into
`rig_model` exactly once. Retain a repeatable rest pose for geometry review and
make the default idle carry the subject's intended attitude.

### Animation direction and timing

Deliver exactly named **Idle**, **Walk**, and **Attack** slots for creatures.
Idle and Walk loop; Attack plays once and recovers to Idle. Walk can represent
flight or another suitable locomotion style. Express the subject's attack with
its actual attacking feature: jaws, stinger, claws, weapon, or casting gesture.

Apply these priorities to each attack:

1. **Start visibly on the first moving frame.** Give the attack a decisive
   launch. Keep any anticipation short enough that it does not delay the strike.
2. **Commit the whole pose.** Move the body, head, and appropriate limbs enough
   that the action reads clearly at normal playback speed and gameplay size.
3. **Aim at the target.** Account for relative height, reach, and position.
   Smaller attackers may strike upward; taller attackers may reach downward.
   The head, limbs, and attacking feature should support the same direction.
4. **Give the striking part its own timing.** A bite closes the jaws sharply;
   a sting thrusts the stinger; a weapon follows a clear strike path. Synchronize
   that action with impact using a separate curve from the body's movement.
5. **Recover promptly.** Retain a readable impact, then return to the ready pose
   without a long settling motion. Preserve clean transitions into Idle.

Define the phases before adding secondary motion:

| Phase | Requirement |
| --- | --- |
| Entry | Start from a pose that transitions cleanly from Idle. |
| Launch | Show decisive movement in the first few frames; minimize anticipation. |
| Impact | Complete the bite, sting, strike, or cast at a recorded time. |
| Recovery | Return promptly to a ready pose with a clean transition to Idle. |

Choose clip duration and movement amplitude for the creature's proportions and
attack type. Verify the result at normal playback speed and small display sizes.
Use sharper timing for the attacking feature than for supporting body motion
when the action needs a visible snap.

Store playback mode and `Attack.hitTime` in the registry. Keep the model's root
fixed unless root motion is explicitly part of the asset contract. The game
controller will eventually synchronize the impact event and movement; the
standalone viewer currently demonstrates the animation only.

### Rigging and validation

- **Keep rest coordinates immutable.** Copy a rest vector before translating
  an animated joint. Calculate segment lengths from unchanged rest coordinates
  so motion does not change the solver's assumed proportions.
- **Keep targets within reach.** The solver must reject unreachable foot
  targets. During a pounce, move support feet with the launch and landing as
  needed. Check upper/lower/foot connections throughout the motion, including
  the strongest pose.
- **Validate the names the loader preserves.** Three.js sanitizes bone names:
  `Limb.L.lower` becomes `LimbLlower`. Use `bone.userData.name ?? bone.name` when
  matching the original name, and assert the expected number of checked joints.
  A check that matches no joints provides no coverage.
- **Check actual motion, not just clip presence.** Verify movement on the first
  frame, impact direction and amplitude, mandible/weapon articulation, contacts,
  and entry/exit poses. Assert the expected joint count and sample the entire
  clip, including rapid transitions and extreme poses. Keep general export and
  weight checks alongside anatomy-specific assertions.
- **Frame the whole action.** Use evaluated, skinned vertices for posed renders.
  In the live preview, sample the rest, launch, impact, and recovery extents once
  and keep the camera fixed during playback. Fit actual vertices to keep the
  model large enough for inspection while leaving room for the full movement.

These checks support visual review. Watch the attack at normal speed, then
inspect the launch and impact poses separately. Keep a stable ground or spatial
reference visible to judge movement direction. Review from the side as well as
three-quarter;
an attractive still image alone cannot establish attack timing or direction.

## 4. Run, look, correct, finish

After registering the recipe and adapting its contract:

```powershell
# First complete asset pass: geometry, rig, export, all views, checks, sheet.
npm.cmd run pixelhack:model -- --tile $pixelhackTileId

# Use only when a specific visual correction is needed.
npm.cmd run pixelhack:model -- --tile $pixelhackTileId --views hero,side --resolution 512

# Finish with current renders of every view.
npm.cmd run pixelhack:model -- --tile $pixelhackTileId
```

Open the generated `review.png` with the image tool. Inspect a full-size view
or close-up only where the sheet cannot settle a detail. Review in this order:

1. **Pose and identity:** the silhouette and attitude match the tile's intent.
2. **Forms and shading:** rounded surfaces look smooth, joints readable, and
   geometry remains convincing from the front, side, and top.
3. **Palette and features:** colors remain recognizable; small eyes, antennae,
   jaws, and similar accents stay visible at 32/64/128 pixels.
4. **Motion and export:** the actual GLB loads, Idle/Walk loop, and Attack starts
   immediately, strikes toward the intended target, clearly articulates its
   attacking feature, and returns to Idle. Limbs remain attached and contacts
   match the motion.

Use the standalone preview for the exported asset:

```powershell
npm.cmd run pixelhack:reference
# http://127.0.0.1:5175/tools/pixelhack-reference/model.html?tile=2
```

Use the requested ID in the URL, and reuse the running server if available.
Follow the available browser skill for UI inspection. Inspect Idle/locomotion,
Attack (including recovery to Idle), camera presets, smooth normals, and both
backgrounds. Mathematical checks do not establish the visual quality of a pose
or the appeal of an animation.

The launcher already runs GLB validation. To check an existing asset, pass its
directory explicitly; the check command without an argument uses its configured
default asset:

```powershell
npm.cmd run pixelhack:model:check -- tools/pixelhack-reference/models/0002-subject-slug
```

Replace the example directory with the actual output directory. Run focused
repository checks when their inputs changed: `pixelhack:reference:check` for
catalog/research changes and `check:tsc` for TS/TSX changes. Follow the repo's
no-build rule. Finish once the concrete visual and export checks pass.

## 5. Keep the work efficient

- Load one subject and its variants. Fetch a specific wiki gap only as needed.
- Batch geometry creation, skinning, and keyframes in saved Python loops.
  Return compact counts, paths, and errors; full logs stay on disk.
- Patch recipe parameters and the responsible helper. Prefer a focused rerun
  over recreating the workflow, browser page, or scene from scratch in chat.
- Use the existing CLI by default. Adopt a persistent MCP session only when a
  concrete task benefits from keeping Blender live; reuse the same helpers.
- Keep palette changes local to the new recipe. If a shared helper changes,
  check representative affected assets in scratch output directories using
  `--out-dir` before replacing their artifacts. Save intentional hand edits
  separately; regeneration
  overwrites the generated `.blend`.
- The launcher currently shares `exports/model-run.log`. Run it serially.
  If parallel asset work is authorized, isolate processes, output directories,
  and logs, and coordinate shared registry/helper edits.
- Solve specific defects internally and deliver a finished asset. Ask for
  missing task information only when it materially blocks a sound decision.

## Delivery contract

Save the recipe, registry mapping, editable `.blend`, `.glb`, `model.json`,
`validation.json`, four current renders, `review.png`, and a short `REVIEW.md`.
The review note should state visual decisions, variants, inferred details,
animation behavior, and the checks actually performed.

### Preserve options for a later death effect

For a stylized burst into head/body/limb chunks, retain named, separately
modeled parts in the authoring file and group small attached details with the
body part they should follow. Eyes should normally stay with the head. Existing
closed parts can become debris later without pre-fracturing every surface.

An efficient runtime export may join authored parts into one skinned mesh.
Normals, colors, and other rendering boundaries can create extra geometry
islands, so raw connectivity alone does not identify meaningful debris groups.
Before implementing runtime breakup, export stable part/group IDs or a dedicated
debris variant from the source parts. At death, capture the evaluated skin pose
and use those posed chunks for independent motion. Simply moving bones can
stretch vertices shared across weighted joints.

Whole authored limbs are straightforward to detach. Breaking inside a continuous
limb or shell requires cuts and closed cut surfaces; plan those sections when
that effect is requested. Use a modest set of meaningful chunks rather than a
physics object for each eye glint or individual polygon. The death runtime and
debris export are future work; the three required animations remain Idle, Walk,
and Attack.

Provide the preview URL and asset links, the regenerate command, and a brief
summary of the result. State whether gameplay integration was performed.

## Copyable task prompt

```text
Create PixelHack tile <ID> as a finished 3D asset in this repository.
Follow tools/pixelhack-reference/AGENT-GUIDE.md and the repo agent rules.
Inspect the exact tile and its prepared research/variant notes before modeling.
Convey the sprite's pose and personality. Use smooth
normals and continuous colors on curved surfaces and limbs, with distinct joints
where appropriate. For creatures, plan an anatomy-appropriate rig during modeling
and deliver looping Idle and Walk plus a one-shot Attack with recorded impact timing.
Make Attack immediately visible, forceful, and directed at the target's height;
animate the bite/sting/weapon strike distinctly and keep recovery short.
Preserve named body parts for possible later debris generation.
Reuse the saved Blender Python pipeline; match validation and viewer content to
the asset's requirements. Perform your own
render inspection, corrections, and exported GLB validation in this assignment.
Save the recipe, editable Blender file, GLB, current comparison renders, metadata,
and review note. Finish with preview/download links and the regenerate command.
```
