# Humanoid modeling and animation: lessons from the water nymph

Read this before creating or substantially revising a PixelHack humanoid. It
records the techniques and visual corrections that improved tile 141 during the
September 2026 modeling session. The water nymph is the worked example.
Follow the [asset guide](AGENT-GUIDE.md) and [repository rules](../../.agents/rules/AGENTS.md).
Use the [general implementation reference](MODELING.md) for the shared pipeline.

The nymph is a worked example, not a universal body shape, costume, pose, or
triangle target. Preserve a new character's own identity. The principles below
are reusable; dimensions, facial proportions, joint landmarks, and weights need
to be fitted to the actual model.

The existing dwarf model was explicitly rejected by the user. Do not use it as
a reference for appearance, anatomy, construction, rigging, animation, or quality.
Its presence in the repository and passing technical checks do not endorse it.

## Start with the right references and owners

| Responsibility | Working implementation |
| --- | --- |
| Nymph anatomy, garment, layered hair, pose and motion | [water_nymph_female.py](../../scripts/tilesets/models/water_nymph_female.py) |
| Licensed anatomical cage and preparation history | [data/README.md](../../scripts/tilesets/models/data/README.md) |
| Geometry, palette, normalization and GLB export | [pixelhack_blender.py](../../scripts/tilesets/pixelhack_blender.py) |
| Rig binding, segment placement, knee solving and envelopes | [pixelhack_rig.py](../../scripts/tilesets/pixelhack_rig.py) |
| Socket-fitted eyelids and the `Blink` shape key | [pixelhack_face.py](../../scripts/tilesets/pixelhack_face.py) |
| Random blinking per model instance | [blink-controller.mjs](blink-controller.mjs) |
| Model-page and catalog-preview playback | [model.js](model.js), [catalog-model-preview.js](catalog-model-preview.js) |
| Model declarations and creature-specific contracts | [models.json](models.json) |
| Export orchestration | [pixelhack-model.py](../../scripts/tilesets/pixelhack-model.py) |
| Actual GLB deformation and animation checks | [verify-pixelhack-model.mjs](../../scripts/tilesets/verify-pixelhack-model.mjs) |
| Fixed-camera samples of exported motion | [review-pixelhack-motion.py](../../scripts/tilesets/review-pixelhack-motion.py) |
| Blink scheduling regressions | [blink-controller.test.mjs](../../scripts/tilesets/blink-controller.test.mjs) |

Inspect the selected sprite crop and the current model before changing them.
The sprite is inspiration, but recognizable gestures matter: the nymph's hands
belong out beside her body, not raised together at her chest. After iteration,
the preferred interpretation was **lower, unequal arm arcs**, with one hand by
the hip and the other lower and closer to the skirt. Do not restore the earlier
high, nearly symmetric forearms merely because they are easy to generate.

Treat later user corrections as the current art direction. The nymph's earlier
whole-body S-bend, tilted head, sideways gaze and altered expression were
rejected. The accepted direction retained the neutral face and added grace
through local arm posing and overlapping motion. This is not a prohibition on
contrapposto or expressive faces for other characters; it is a warning that a
generic deformation is not a substitute for a convincing pose.

## A practical order of work

1. Establish identity, silhouette, proportions and the intended resting gesture.
2. Build or adapt an anatomical body with usable face and joint topology.
3. Pose it with the eventual joint locations in mind. Inspect front and profile.
4. Fit a connected garment around that body and test its clearance.
5. Build hair coverage from the scalp outward in separate overlapping layers.
6. Bind skin, cloth and hair to appropriate joints. Test bends before detailing.
7. Author body mechanics, attack articulation and secondary motion separately.
8. Fit eyelids to the actual sockets and add independent randomized blinking.
9. Inspect the exported GLB, close-ups and motion samples; correct visible faults.
10. Update the recipe, metadata, checks and review notes together.

Iterate visually within these stages. Do not add ornamental detail to compensate
for a poor face, incorrect pose, missing scalp coverage, or broken elbows.

## Anatomy: a sound cage did more than extra smoothing

The original nymph combined lofted sections and small primitives into an angular
face, coarse limbs and an awkward crouch. Smooth shading and voxel union helped
seams, but did not supply convincing anatomy or facial edge flow.

The successful replacement starts from Blender Studio's **Human Base Meshes
v1.4.1**, object `GEO-body_female_stylized`, released under **CC0**. The prepared
cage is checked in as
[`stylized-female-cc0.json`](../../scripts/tilesets/models/data/stylized-female-cc0.json).
It contains 3,513 vertices, 4,138 polygons and 7,022 triangles. Preparation used
Blender 5.1.2's Decimate modifier in `UNSUBDIV` mode for two iterations, recovering
a smaller cage from the supplied subdivided mesh. The source README records
the exact download, archive hash, object name and conversion details.

Use that local data to reproduce the nymph; do not require a fresh download,
interactive add-on installation, or private asset library. For a different
anatomical source, document its license and preparation just as carefully.

- Preserve the cage's facial contours, eye sockets, mouth and joint loops.
- Put eyes into the sockets. Surface-mounted circles on an oval head read as
  pasted-on features even when the rest of the model is smooth.
- Color the existing lips and skin surface where possible. Separate facial
  beads, lip ellipsoids and bright cheek dots can read as lumps at small sizes.
- Keep the entire body under the clothes. **Do not delete body polygons to hide
  clothing intersections.** This caused the nymph's legs to disappear when she
  stepped beyond the skirt's resting silhouette.
- Use topology checks as a structural guard: the nymph's body is one connected
  closed surface, with zero nonmanifold edges. This does not prove that its
  proportions or skinning look good.

Voxel union remains useful for suitable blockouts and creatures. Do not throw
away a good humanoid cage's facial and joint topology simply to join parts.

Use the shared vertex-palette material and smooth normals for curved surfaces.
Palette hex values are sRGB; use `ph.linear(...)` when assigning custom vertex
colors so the exported `COLOR_0` data and Blender lighting agree. Smooth shading
does not repair a coarse silhouette, and bright glints do not repair a poorly
shaped face. Keep material and color decisions readable at game size as well as
in a large studio-lit render.

## Posing, coordinates and scale

Author in **Z up / -Y forward**. The exported GLB is **Y up / +Z forward**; do
not apply a second axis conversion in the viewer. Bind using the normalization
transform once, after the authored geometry has been normalized.

The nymph's internal `.R` labels mean positive source X. That is the
**character's left, on the viewer's right in a frontal view**. Identify an arm
by the visible anatomy and coordinate convention, not by assuming a bone suffix
uses anatomical handedness. Preserve established names unless deliberately
migrating every dependent check and animation.

For a relaxed pose, vary elbow bend, hand height, distance from the hip, wrist
angle and finger relaxation. Small local differences were more effective here
than a large torso warp. Keep enough clearance from the skirt and hair through
the whole idle cycle. Do not interpret graceful movement as raising both arms
to the same height or bending every joint by the same amount.

Normalization is footprint-based. Extending arms or widening hair changes the
largest horizontal dimension and therefore the entire model's scale. After a
silhouette change, inspect `model.json` dimensions and choose the footprint
deliberately so a posing correction does not accidentally shrink or enlarge
the character. Never fix an animation's displacement test by rescaling the
character without checking its intended size.

## Skin weights: joints must deform as connected anatomy

The body can be topologically closed and still look torn when neighboring
vertices follow unrelated bones. The early elbow failures came from a hard
spatial classification boundary: some inner-arm vertices followed the torso
while their neighbors followed the arm. Inspect both sides of each joint while
it bends, not only its resting silhouette.

The nymph's recipe assigns anatomical regions in the **source pose**, maps them
into the authored pose, and blends influences around shoulders, elbows, wrists,
hips, knees and ankles. A separate `Spine` control blends the upper torso into
the chest, with the arms and head parented appropriately. The pelvis can then
move against the shoulders without rotating the whole figure as a rigid block.

Keep rest coordinates and segment lengths immutable when calculating poses.
Reject unreachable IK targets; fix the target, pelvis height or support layout
instead of hiding the error by stretching a limb.

The knee solver needs a deliberate forward pole. Using the nearby resting knee
as the only pole let the preferred bend direction flip when a walking foot
crossed its line. The nymph uses a forward pole relative to the animated hip.
Check fractional frames as well as keyed poses: an IK flip can make a foot
penetrate the floor between otherwise plausible frame endpoints.

## Clothes: one connected garment, with volume and clearance

Three different meanings of "one mesh" must stay distinct:

| Surface | Desired authoring structure |
| --- | --- |
| Exposed humanoid body | Complete, connected, weighted anatomical surface |
| Nymph's dress | One connected garment from neckline through waist to hem |
| Hair | Separate editable, overlapping locks over a fitted scalp underlay |
| Runtime export | One combined skinned mesh and one material; its constituent surfaces need not be welded together |

The first costume consisted of a bodice, skirt, ribbons and decorative folds
intersecting each other. Joining those objects would not make the cloth itself
continuous. The successful dress uses a regular quad surface fitted to the
torso, with the same surface extending into the skirt and asymmetric hem.

The recipe applies the same surface-fitting principle as Shrinkwrap: cast from
inside the torso toward the skin, then retain an outward clearance. Casting
from the torso also avoids accidentally fitting clothing to a nearby raised
hand. Reserve looser authored volume for the skirt; do not shrinkwrap every
fold tightly to the thighs.

Form folds in the garment's surface. Use gradual changes in radius and modest
fold amplitude. Apply Solidify to give the fabric thickness and connect its
inner and outer surfaces around the neckline and hem. Check one connected
component and zero nonmanifold edges after this step.

Blend garment weights from the torso into the relevant upper legs, with smaller
cloth-joint influence for follow-through. A rigid skirt attached only to the
pelvis intersected raised thighs; deleting the thighs made the defect worse.
Correct the garment's clearance, volume and deformation instead. Recheck the
highest step, forward contact, snatch and recovery after changing the gait.

## Hair: coverage and separate locks, not a fused curtain

The most useful approach combined a thin fitted underlay with layered curve
clumps. Several tempting alternatives failed:

| Symptom | Cause and useful correction |
| --- | --- |
| Huge tubes overwhelm the figure | Use flatter profiles, restrained width and tapered ends; establish the hair silhouette before adding glints |
| Bare back of the head | Add overlapping lower/back locks, then shorter upper locks; side strands do not provide rear coverage |
| Smooth scalp looks bald | Add short, overlapping scalp-following root locks rather than leaving the under-cap exposed |
| Hair reads as one inflated blob | Restore separate locks with distinct contours and staggered tips; keep continuity in the coverage, not in a fused back curtain |
| Head looks like a ball with hair attached below it | Start overlapping locks on the crown and carry them into the back layers; avoid a sharp cap-to-curtain join |
| Straight band looks like a cap across the forehead | Recede the under-cap above the forehead and let swept fringe define the visible hairline |
| Two crown strands stand upright like fins | Orient the profile's wide axis along the scalp tangent, not a fixed world-plane axis |
| Roots open gaps during motion | Keep root weights on `Head`, then blend into the hair bones farther down |

Build the root and back coverage first. Add larger flowing locks, shorter
overlapping layers and restrained highlight strips afterward. Vary lengths,
paths and tip positions while keeping a coherent direction of flow. Short root
locks can be projected along the head surface, whereas free-hanging locks need
their own curved paths. A flattened cross-section alone is insufficient if its
frame rotates that width upright on the crown; see `curl(..., scalp=True)`.

Inspect **top and back**, not just the attractive three-quarter view. Check the
hairline in front and the transition from crown to hanging locks in profile.
Keep the hair pieces editable in the `.blend`; only join export copies.

## Hands and snatching: inspect the actual closed geometry

A rotation test can pass while the fingers bend away from the palm. This
happened in the nymph's attack: the nominal grasp rotated visibly but looked
like an upward extension rather than a fist.

- Model and bind the resting palm, knuckles and fingertips deliberately.
- Bend across the palm using a suitable local/rest-space axis. Changing the
  resting arm direction can invalidate a hard-coded world-axis curl.
- Use proximal and distal finger bends so the fingertips return toward the
  palm, rather than rotating a straight fan of fingers as one plate.
- Give the thumb its own opposition control. Do not blindly apply the other
  fingers' height-based weights to it.
- In this cage, isolating the thumb's connected branch below a knuckle plane
  and blending two neighboring edge rings into the palm eliminated pinching
  and spikes. Re-find that branch for a different cage; the nymph's thresholds
  and joint coordinates are not generic anatomy constants.
- Inspect open, contact and pullback poses in close-up from two angles.
  Verify fingertip movement toward the palm, thumb placement and unwanted
  intersections, not merely quaternion magnitudes.

Distinguish a stray accessory from a skinning fault by inspecting named source
parts and their weights. The nymph's wrist ornaments were removed after they
read as meshes lodged in her hands. Later thumb spikes needed corrected joint
ownership, not deletion of anatomical geometry. Keep decorative pieces out of
the hand's articulation envelope unless they serve a clear visual purpose.

The final snatch separates **reach, closure, withdrawal and release**. The hand
darts toward the target, closes at approximately 0.117 seconds, retracts inward
with the grip held by approximately 0.183 seconds, then opens while returning
to the ready pose. A reach followed by a long hold read as offering or waving.
Both feet stay planted, and Attack begins and ends at the Idle starting pose.

Those times are the nymph's contract. Other attack types need their own impact
timing and articulation. Preserve the character's attack identity instead of
copying the nymph's hand motion onto every humanoid.

## Natural locomotion and idle motion

The largest improvement was giving different parts different jobs and timing:

- The pelvis carries weight; the chest counters its rotation; the head remains
  comparatively steady. Weight the visible torso to those controls.
- The walk uses 55% stance and 45% swing, including brief double support.
  The stance foot travels backward at the controller's forward speed.
- A cubic Hermite swing curve matches that stance velocity at its boundaries.
  A foot that abruptly stops and reverses at lift-off looks mechanical.
- Add heel contact and toe-off. Calculate floor clearance from the actual sole
  vertices; keeping only the ankle at a fixed height does not ground the foot.
- Use a moderate swing height and explicit knee poles. A large knee lift is not
  inherently a more readable or graceful step.
- Let forearms and wrists follow the upper arms with a delay. Give the two
  sides different resting poses and idle phases rather than mirrored motion.
- Delay hair and cloth behind the primary movement. Keep their amplitudes
  bounded and roots attached; secondary motion must not pull surfaces apart.

The current game-facing walk contract is one complete left/right cycle in
0.5 seconds at two tiles per second. Preserve that contract unless a task
explicitly changes it. The nymph's idle lasts four seconds and combines gentle
breathing with unequal, delayed arm and wrist arcs.

Continuous motion functions are sampled at 60 Hz into ordinary bone transforms.
Linear interpolation between these dense samples does not imply linear motion
through the whole action. Keep successive quaternion signs consistent to avoid
interpolation discontinuities. The GLB should not require runtime IK or a cloth
simulation cache to reproduce its main clips.

## Eyes and independent random blinking

All registered humanoids must declare `"humanoid": true` and provide an unkeyed
`Blink` morph. The nymph demonstrates this through `pixelhack_face.py`.
Bind the eyelid parts to the head, and leave the eyeball geometry intact.

The eyelid corrections taught two distinct lessons:

1. **Fit the opening.** Generic ellipsoid caps were oversized. Trace the actual
   visible eye/socket intersection from the eye mesh and surrounding skin.
   The helper uses ray casts to recover the contour rather than assuming the
   eye's nominal radius is the visible aperture.
2. **Wrap its depth.** A flat patch covered the front but left the eyeball's
   sides visible. Anchor the perimeter at the socket rim and follow the curved
   eyeball surface toward the closing seam. Allow for iris/pupil protrusion
   with a small, model-specific clearance.

Check `Blink` at **0, 0.5 and 1**, from front, three-quarter and side views.
Check the open face too: an eyelid that hides the eye correctly but leaves a
visible oversized plate when open is not finished. Do not enlarge the entire
lid indiscriminately to solve a side-view leak.

The shared controller owns the random schedule per instance. It is called
after body animation updates, using elapsed time independent of the body clip:

- A normal interval is randomized between 2.2 and 6 seconds.
- Closure takes 75 ms, a closed hold takes 35 ms, and reopening takes 140 ms.
- A 10% chance permits a second blink after a 120–240 ms gap.
- Changing Idle/Walk/Attack or the body's playback speed does not reset it.
- Rest poses blink too. In the standalone model page, pausing the body does not
  pause blinking. Hidden/offscreen preview behavior remains under its viewer.
- Large elapsed-time gaps reopen the eyes instead of replaying a blink backlog.
- Disposal clears weights and releases targets; there are no background timers.

Use one controller per displayed character. Do not share its clock or mutable
morph-influence array between instances. The GLB carries the morph; it cannot
randomly blink by itself without a playback owner. The `.blend` retains an
editable shape key, not a blink baked into every body action. Current playback
integration is in both reference viewers; it does not establish integration of
these creature models into the main game.

### Morph export pitfalls that actually occurred

- Transform every shape-key block during normalization, not only base vertices.
- Before joining export copies, give each copy the same named morph keys; parts
  that do not blink receive unchanged coordinates for `Blink`.
- Explicitly set joined shape-key values to zero before exporting. A joined
  export loaded with `Blink = 1` even though the authored lids began open.
- Preserve morph targets but keep `export_morph_animation=False` so Idle, Walk
  and Attack do not acquire tracks that overwrite procedural blinking.
- Assert that a newly loaded GLB has `Blink = 0` before comparing open and closed
  vertices. An unchanged comparison can mean both samples were already closed.
- Filter imported objects by capability when inspecting shape keys. Not every
  mesh in a Blender scene necessarily has `data.shape_keys`.

## Validation: visual evidence and numerical checks need each other

Render and inspect the **exported GLB**, not just the Python source or authoring
scene. A successful export, normalized weights, or a closed surface does not
prove a good character. Keep the camera fixed across motion samples and include
a stable ground reference in the live viewer.

| Inspect | What it caught in this session |
| --- | --- |
| Front, profile and three-quarter rest views | Poor proportions, rigid mirrored arms, cap-like hairline |
| Top and rear views | Bare scalp, missing back hair, raised fins, sharp crown joins |
| Sideways and bent elbow poses | Inner-arm vertices incorrectly following the torso |
| Highest stride and contact poses | Removed legs, skirt intersections, foot penetration |
| Fractional animation times | Knee flips and interpolation defects missed at selected keys |
| Open/contact/pullback hand close-ups | Reversed finger curl, straight-finger fan, thumb spikes |
| Blink 0/0.5/1 from multiple angles | Oversized lids, flat covers and exposed eye sides |
| 32/64/128-pixel views | Features that vanish or merge into visual clutter |

Preserve structural assertions, then add tests that distinguish the requested
behavior: unequal low hands, snatch withdrawal while holding the grip, compact
distal-finger positions near the palm, independent thumb opposition, opposing
hip/chest rotation, grounded rolling soles, double support, and blink continuity
across clip transitions. Check that named joints and sample vertex sets actually
exist; an empty selection must not pass silently.

Do not loosen thresholds merely to turn a failing check green. Diagnose the
geometry or timing first. If a requested new resting pose genuinely increases
the necessary reach, update its contract deliberately and inspect the entire
action. Numerical tolerances are asset-specific; visual acceptance remains a
separate requirement.

When using `AnimationMixer` for tests, account for action lifecycle. A one-shot
action can disable itself at its endpoint; subsequently seeking backward without
reactivating it can accidentally test the rest pose. This initially produced a
false failure of the chest/pelvis counter-rotation check.

## Reproduce the work

Run from the repository root in PowerShell. The modeling command invokes
Blender; it is not the prohibited application/package build.

```powershell
# Selected sprite and generated assets
py scripts/tilesets/export-pixelhack-reference.py --tile 141
npm.cmd run pixelhack:model -- --tile 141 --views hero,side,front,top,back

# Check actual exports and shared reference/blink behavior
npm.cmd run pixelhack:model:check -- tools/pixelhack-reference/models/0141-water-nymph-female
npm.cmd run pixelhack:reference:check

# Live reference viewer
npm.cmd run pixelhack:reference
```

The direct preview URL is
`http://127.0.0.1:5175/tools/pixelhack-reference/model.html?tile=141`.

For motion close-ups, use the checked-in review script and absolute paths.
Blender's working directory did not reliably match the shell's working directory
in this session; passing a repository-relative library path resolved under `C:`.

```powershell
$repoRoot = (Get-Location).Path
$blender = 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe'
& $blender --background --factory-startup --python-exit-code 1 `
  --python (Join-Path $repoRoot 'scripts/tilesets/review-pixelhack-motion.py') -- `
  --model (Join-Path $repoRoot 'tools/pixelhack-reference/models/0141-water-nymph-female/model.glb') `
  --out-dir (Join-Path $repoRoot 'tools/pixelhack-reference/exports/nymph-motion') `
  --animation Attack `
  --samples 'ready:0,open:0.0833333,contact:0.1166667,pull:0.1833333,return:0.5' `
  --views hero,side --resolution 768
```

For blink review, import the GLB into a clean Blender scene, find the meshes with
a `Blink` shape key, set that key to 0, 0.5 and 1, and render the head from the
three required angles. For example, the capability check is:

```python
blink_meshes = [obj for obj in bpy.context.scene.objects
               if obj.type == 'MESH' and obj.data.shape_keys
               and 'Blink' in obj.data.shape_keys.key_blocks]
assert blink_meshes, 'Imported GLB lost its Blink morph'
for obj in blink_meshes:
    obj.data.shape_keys.key_blocks['Blink'].value = 1.0
bpy.context.view_layer.update()
```

Keep temporary diagnostics under `tools/pixelhack-reference/exports/`. Its logs,
scratch scripts and close-ups are ignored and are not dependencies for a fresh
checkout. Persist useful logic in the recipes/helpers and lessons in these docs.
The one-command model launcher shares `exports/model-run.log`: run it serially.
If separate rendering processes are appropriate, give them distinct output
directories and logs. Do not launch visible background windows on Windows.

Generated `.blend` files are overwritten by regeneration. Preserve deliberate
manual edits separately or translate them into the recipe. Review PNGs are
ignored by Git, so fresh contributors must regenerate them. The shared JSON
freshness checks normalize Windows CRLF line endings; identical JSON should not
be mistaken for stale content because of checkout line endings.

## Current worked example and handoff

Snapshot of the checked-in metadata when this guide was written; regenerate
`model.json` and `validation.json` for authoritative later measurements:

| Asset | Triangles | Bones | Authored parts | Runtime |
| --- | ---: | ---: | ---: | --- |
| Water nymph, tile 141 | 15,726 | 23 | 44 | One mesh/material; Idle, Walk, Attack; independent Blink |

The nymph's 16,000-triangle budget accommodates retained body geometry, a
connected dress, layered hair and fitted eyelids. It is not a target for all
humanoids. Do not strip useful anatomy or hair coverage merely to match an
earlier, lower-detail version's count.

Before handing off, save the recipe, registry, editable blend, GLB, current
metadata, validation report, source comparison and concise asset notes. Say
which views and actions were actually checked, and distinguish unit/export
tests, browser preview and gameplay validation. Never describe a planned check
as completed. These models remain standalone studies until explicitly wired
into the game.

A useful task prompt for the next agent:

> Create or revise tile `<ID>` using the asset guide and humanoid modeling guide.
> Inspect its sprite and current model first. Preserve its defining pose and
> identity. Keep the full anatomical body, fit continuous clothing, layer
> separate hair locks with complete root/back coverage, and build a joint-aware
> rig with an independently scheduled Blink morph. Complete the required clips,
> inspect the exported model and close-ups, correct visible defects, and deliver
> the reproducible source, assets, current checks and review notes. Use the
> nymph as a technique reference, not as a universal character design.

## Research that informed the implementation

These are technique references, not dependencies or a claim that every technique
in each course was applied. The full source and license record lives in the
[anatomy README](../../scripts/tilesets/models/data/README.md).

- [Blender Studio: primitive body and proportion workflow](https://studio.blender.org/training/stylized-character-workflow/5d7f7cf055ccaf1a4a78102d/)
- [Blender Studio: anatomical landmarks and retopology](https://studio.blender.org/training/realistic-human-research/retopology/)
- [Blender Studio: clothing base meshes](https://studio.blender.org/training/stylized-character-workflow/5d7f7fc5db37a94301d88ff9/)
- [Blender Manual: Shrinkwrap](https://docs.blender.org/manual/en/5.0/modeling/modifiers/deform/shrinkwrap.html) and [Solidify](https://docs.blender.org/manual/en/5.3/modeling/modifiers/generate/solidify.html)
- [Bran Sculpts: layered hair made with curves](https://www.youtube.com/watch?v=IH3ThN_bUnM)
- [Blender Manual: clump guides and tip variation](https://docs.blender.org/manual/en/5.1/modeling/geometry_nodes/hair/guides/clump_hair_curves.html)
- [Hair Tool author: flat/custom profiles](https://joseconseco.github.io/HairToolDocs_28/editing_profile/) and [root projection](https://joseconseco.github.io/HairTool_3_Documentation/curve_tool#project-roots)
- [Blender Studio: weight shifts and overlapping action](https://studio.blender.org/training/animation-fundamentals/5d69b398c4769bb8cceb0709/)
- [Mark Masters: layered body-mechanics workflow](https://www.youtube.com/watch?v=W7GeNxrDOnY)
