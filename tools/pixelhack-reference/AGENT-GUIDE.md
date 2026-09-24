# PixelHack asset guide

Complete one requested asset, including your own visual corrections and export
checks. Follow the [repo rules](../../.agents/rules/AGENTS.md). Read implementation
details in [MODELING.md](MODELING.md) only when needed.

## Reference and appearance

- Load only the selected tile from `catalog.json`, its brief and variant notes
  from `research.json`, and relevant comparisons from `art-analysis.json`.
  Inspect the original crop and light/dark previews before modeling. Research
  only unresolved identity or anatomy questions.
- Treat the tile as visual inspiration, not a blueprint to reproduce exactly.
  Keep enough defining cues, palette relationships, and personality for the
  character to be recognizable, then adjust silhouette, proportions, pose,
  materials, and details where a stronger 3D design calls for it. Add fitting
  features that the pixels cannot show. Establish the pose before detail; use
  wiki sources for identity/anatomy and briefly note interpreted unseen features.
- Smooth curved bodies and appendages, including jaws and antennae. Use smooth
  normals and continuous colors; keep distinct joints and genuinely sharp edges.
  Make thin features readable at small sizes through separation and thickness.
- Verify pixel identity before sharing models across variants. Shared names or
  sex labels alone are insufficient. For humanoid characters, make distinct male
  and female models when NetHack has both genders, even if their source pixels
  are identical. Share a humanoid model across gender labels only when NetHack
  has no other gender for that character. Model randomized items by visible
  appearance; give statues their own material treatment. Exclude source scenery
  and baked shadows.

## Authoring

- Reuse saved Blender Python and the CLI. Create a recipe in
  `scripts/tilesets/models/` and register its IDs, paths, budget, and animation
  contract in [models.json](models.json). Preserve existing entries.
- Implement `build()` for named mesh parts and, for creatures,
  `rig_model(objects, transform)` for binding and baked clips. Plan joints while
  modeling; rig after the main shape is settled. Apply the supplied normalization
  transform to skeleton coordinates exactly once.
- One tile equals one unit. Author **Z up / -Y forward**; GLB uses
  **Y up / +Z forward**. The helper defaults to a grounded 0.92-unit footprint;
  choose relative size, hovering, and origin deliberately.
- Reuse [geometry](../../scripts/tilesets/pixelhack_blender.py) and
  [rig](../../scripts/tilesets/pixelhack_rig.py) helpers selectively. Set palettes
  locally. Prefer compact vertex colors and standard PBR materials; allocate
  geometry to silhouette and deformation. Keep source parts editable.
- For visible humanoid skin, favor a continuous weighted surface across the
  torso and limbs. Fuse editable source parts when useful, then repaint and
  assign smooth weights on the new topology. Inspect elbows, knees, shoulders,
  and hips in motion; a joined mesh alone does not guarantee good deformation.
- Check tooling defaults: palettes, anatomy, material count, grounded contact,
  clip duration, movement limits, and viewer captions must suit the asset.
  Static objects and flying or transparent subjects require appropriate
  validation contracts. Preserve meaningful checks when adapting defaults.

## Animation direction and timing

Creatures require **Idle**, **Walk**, and **Attack**. Idle and Walk loop; Walk
represents suitable locomotion, including flight. Attack plays once and returns
cleanly to Idle.

- Make Idle visibly poised to attack. This is the stance the player sees just
  before the creature strikes; keep the first and last Attack poses aligned with
  it rather than settling into an unrelated neutral pose.
- For grounded, legged creatures, time Walk for one tile of travel in **0.5
  seconds** at normal playback speed. Use about **two broad, readable strides**
  in that loop. Give the legs enough forward/backward sweep to suit the travel
  speed without frantic tiny steps; lift swing feet while support feet stay
  near the ground. Record the expected controller speed in the model contract.
- For humanoids, use one complete left/right gait cycle over that tile: the first
  step accompanies travel halfway to the next tile, and the second finishes at
  its center. Keep the planted foot moving backward relative to forward travel.
- During a grounded creature's Attack, keep an anatomy-appropriate support set
  in contact with the ground unless the attack is deliberately a full jump.
  For the soldier ant, the hind pair braces while the front and middle legs
  lift for the bite.
- Start visibly in the first moving frames. Use a forceful body/head/limb action,
  minimal anticipation, clear impact, and short recovery.
- Aim at the target's height and position using the creature's anatomy and reach.
- Animate the attacking feature distinctly: jaws snap, a stinger thrusts, or a
  weapon strikes. Give it a separate timing curve synchronized with impact.
- Record loop modes and `Attack.hitTime` in seconds. Keep the root fixed unless
  root motion is explicitly required; document locomotion speed expectations.
- Keep rest coordinates immutable and compute segment lengths from them.
  Reject unreachable joint targets; move support limbs appropriately during
  launches and landings. Apply pose changes to attached parts and bones together.

## Generate and review

Run from the repo root; replace the example ID with the requested tile.

```powershell
$pixelhackTileId = 2
py scripts/tilesets/export-pixelhack-reference.py --tile $pixelhackTileId
# After authoring and registration:
npm.cmd run pixelhack:model -- --tile $pixelhackTileId
npm.cmd run pixelhack:reference
```

Preview: `http://127.0.0.1:5175/tools/pixelhack-reference/model.html?tile=2`.
Use the requested ID. The launcher generates assets, validates GLB, and makes
`review.png`. For focused corrections, add `--views hero,side --resolution 512`;
finish with a default run for four current views.

- Inspect actual images: judge character identity and the quality of the 3D
  design first, then surfaces, palette, and defining features at 32/64/128
  pixels. Pixel-perfect agreement with the source is not the goal. Watch
  exported animations at normal
  speed; inspect launch and impact separately from multiple views.
- Check normalized weights, finite geometry, connected joints, contact,
  loop seams, attack transitions, early movement, direction, and articulation.
  Match preserved bone names with `bone.userData.name ?? bone.name` and assert
  expected joint counts so checks cannot silently match nothing.
- Frame evaluated vertices across the movement, then keep the preview camera
  fixed with a stable ground/spatial reference. Code checks complement visual review.
- Use compact results and logs on disk. Patch the responsible recipe/helper.
  Read additional files only for the current decision. Run shared-log launchers
  serially; isolate outputs/processes/logs for authorized parallel work.
- Regeneration overwrites generated `.blend` files. Preserve hand edits separately;
  test shared-helper changes on affected assets using scratch `--out-dir` paths.
  Run focused checks for changed code/data; follow the repo's no-build rule.

## Preserve options for a later death effect

Keep named, closed parts and meaningful debris groups; attached details should
follow their parent part. Whole parts can detach later. Internal fractures need
cuts and capped surfaces. Merged GLB geometry islands do not reliably identify
body parts: preserve group IDs or export a debris variant, freeze the evaluated
skin pose, then move chunks independently. Defer death implementation until requested.

## Deliver

Save the recipe, registry entry, editable `.blend`, GLB, metadata, validation
report, four renders, comparison sheet, and a short review note. Provide asset
links, preview URL, regeneration command, and verification results. State whether
gameplay integration was performed; the standalone viewer does not establish it.
Review PNGs are generated locally and ignored by Git; regenerate them from the
recipe before opening a fresh checkout's model viewer.

Task prompt: **Create tile `<ID>` following this guide. Complete modeling,
required animations, visual correction, export validation, and delivery in this assignment.**
