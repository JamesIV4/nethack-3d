# Water nymph, female - tile 141

An icy-blue humanoid with an anatomical face, inset eyes, a continuous sea-silk
dress, sea-glass clasp, and separate layered hair locks. The neutral pose and
expression are retained.

The body adapts Blender Studio's CC0 stylized female base mesh. All 3,513 source
vertices and 4,138 polygons are retained, including the skin under the clothes.
The build checks that the body is one closed connected surface. Blended shoulder,
elbow, wrist, knee and ankle weights preserve the joints through animation.

The dress is one connected, closed mesh from neckline to asymmetric hem. Its
bodice is projected onto the body with clearance; skirt folds are formed in the
same surface. Solidify adds thickness and closes the neckline and hem rims.
The skirt blends torso, leg and cloth weights. No body geometry is removed to
hide garment intersections.

Hair remains separate editable locks. A thin fitted scalp cap sits beneath ten
overlapping short root locks, seven long back locks, three shorter back locks,
and the side/fringe layers. Flattened profiles, staggered tips and blended root
weights connect the crown visually to the longer hair without a fused curtain.
The top and rear renders are included specifically to inspect scalp coverage.

The anatomy source, license, archive hash and research links are documented in
[`scripts/tilesets/models/data/README.md`](../../../../scripts/tilesets/models/data/README.md).
The reproducible generator is
[`water_nymph_female.py`](../../../../scripts/tilesets/models/water_nymph_female.py).
No downloads or add-ons are needed to rebuild it.

Idle retains the neutral base pose and adds a four-second breathing cycle, with
subtle wrist movement and delayed hair/cloth follow-through. A separate spine
joint lets the chest counter the pelvis during the walk while keeping the head
steadier. Walk remains a complete left-right cycle in 0.5 seconds at 2 tiles/second.
It has 55% stance / 45% swing, brief double support, grounded heel contact and
toe-off, and a smooth swing arc with matching endpoint velocities. Attack leads
with the torso, reaches along an arc, closes the fingers at 0.117 seconds, braces
both feet, and eases back to Idle with delayed secondary motion. Explicit knee
poles prevent leg flipping. Motion is baked at 60 Hz; gameplay integration was
not performed.

The export contains 15,502 triangles, 21 bones, one mesh and one material. The
16,000-triangle budget accommodates the full body and layered scalp/back hair.
The 0.84-tile footprint keeps the narrower hairstyle at roughly two units tall.
The blend file retains individually editable parts and three editable actions.

Validation covers connected body/dress/cap topology, normalized weights, loop
seams, leg connections, planted attack feet, early grab motion, finger closure
and walking foot speed. Additional exported-motion assertions check hip/chest
counter-rotation, articulated feet, grounded stance soles and double support.
Front, side, top, rear and hero renders plus exported idle/attack/walk samples
were visually inspected. These checks do not substitute for reviewing the asset
in the game.

Regenerate the asset, five views, validation and comparison sheet:

```powershell
npm.cmd run pixelhack:model -- --tile 141 --views hero,side,front,top,back
```
