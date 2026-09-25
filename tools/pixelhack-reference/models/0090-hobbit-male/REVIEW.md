# Hobbit, male — tile 90

The tile's dark hat, green shirt, brown vest and breeches, small blade, and
reddish broad feet informed this short male traveler. The unseen back of the
hat, layered curls, waistcoat, and bare soles are 3D interpretations. The
[NetHack hobbit entry](https://nethackwiki.com/wiki/Hobbit) informed the
barefoot anatomy and choice of a dagger as the visible weapon.

The complete body comes from Blender Studio's CC0 stylized male base mesh;
[`data/README.md`](../../../../scripts/tilesets/models/data/README.md) records
the source archive, hash, and preparation. The water nymph supplied the
humanoid techniques and matching cage topology for anatomical joint weights.
No dwarf geometry, rigging, animation, or visual design was used.

The shirt is one connected body-derived surface that includes both sleeves.
The open waistcoat is one loose, closed garment. The breeches branch from one
waist loop into two leg loops with a shared crotch seam. The hat has one
connected crown and centered brim. The full anatomical body remains beneath
the clothes, including its original toes; no extra toe meshes are present.
Eighteen overlapping scalp-tangent locks sit over a projected underlay, with
front fringe and back coverage checked from top and rear. These construction
choices follow the repository's humanoid guide and Blender Studio's
[clothing base mesh](https://studio.blender.org/training/stylized-character-workflow/5d7f7fc5db37a94301d88ff9/)
and [outfit topology](https://studio.blender.org/training/stylized-character-workflow/11-outfit-retopology/)
workflow.

Idle lasts three seconds and adds a curious head turn, weight shift, and dagger
gesture. The low wrist keeps its natural pose; the whole dagger points upward
from a handle centered in the thumb-index web, with the guard beyond the
fingers. The thumb tip is corrected toward the hilt without moving its root.
Walk lasts 0.5 seconds for one left/right cycle, with a wide foot sweep, lift,
torso twist, and arm swing. The measured planted-foot sweep is 2.01 tiles per
second against a two-tile-per-second controller target. Attack draws the hand
back, steps and leans forward, then rotates the wrist and arm to aim the blade
nearly straight at the target at 0.183 seconds before recovering to the exact
ready pose at 0.6 seconds.
Both feet stay in contact during the cut. The unkeyed `Blink` morph is driven
independently per displayed character.

The exported GLB has 17,430 triangles, 21 bones, one primitive and one vertex
palette material. The model check sampled 61 frames per clip and checked
finite vertices, normalized weights, joint attachment, grounded contact,
seam continuity, attack-to-idle alignment, an upright ready blade, a forward
impact blade, finger and thumb ownership, a measured 0.020-unit distance
between the grip web and handle surface, and
blink independence. The shirt, waistcoat, breeches, hat, body, and hair
underlay are each checked as connected, closed surfaces in the recipe.
Five static views, 32/64/128-pixel reductions, exported action poses from
front/hero/side, and eye states at 0/0.5/1 from front/hero/side were visually
reviewed. The standalone viewer was checked at normal playback speed for
Idle, Walk, and the one-shot Attack. Gameplay integration was not performed.

Regenerate the editable Blender file, GLB, validation, five review views and
comparison sheet from the repository root:

```powershell
npm.cmd run pixelhack:model -- --tile 90 --views hero,side,front,top,back --resolution 768
```

The model viewer is `http://127.0.0.1:5175/tools/pixelhack-reference/model.html?tile=90`
when port 5175 is free. Review PNGs are local, ignored outputs and should be
regenerated after a fresh checkout.
