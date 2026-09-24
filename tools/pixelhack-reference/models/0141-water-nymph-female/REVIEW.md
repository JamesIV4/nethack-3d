# Water nymph, female - tile 141

For the full reusable workflow, failure diagnoses and authoring commands, see
[Humanoid modeling and animation](../../HUMANOID-MODELING.md).

An icy-blue humanoid with an anatomical face, inset eyes, a continuous sea-silk
dress, sea-glass clasp, and separate layered hair locks. The arms rest low and
asymmetrically, with one hand beside the hip and the other lower and closer to
the skirt. Elbow bends and wrist angles differ on each side; the neutral
expression is retained. The previous wrist ornaments have been removed.

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
The under-cap recedes above the forehead so the swept fringe defines the visible
hairline. Its wide profile follows the scalp tangent instead of rising into fins.

The anatomy source, license, archive hash and research links are documented in
[`scripts/tilesets/models/data/README.md`](../../../../scripts/tilesets/models/data/README.md).
The reproducible generator is
[`water_nymph_female.py`](../../../../scripts/tilesets/models/water_nymph_female.py).
No downloads or add-ons are needed to rebuild it.

Idle retains the low, asymmetric base pose and adds a four-second breathing
cycle. Separate arm arcs and phase delays let each elbow lead its wrist, with
soft finger motion and delayed hair/cloth follow-through. A separate spine
joint lets the chest counter the pelvis during the walk while keeping the head
steadier. Walk remains a complete left-right cycle in 0.5 seconds at 2 tiles/second.
It has 55% stance / 45% swing, brief double support, grounded heel contact and
toe-off, and a smooth swing arc with matching endpoint velocities. Attack darts
the character's left hand forward, bends the fingers at two joints at 0.117
seconds toward the palm, folds the separately controlled thumb across them,
and pulls the closed fist inward by 0.183 seconds before releasing it
back out to the side. Both feet brace throughout. Explicit knee
poles prevent leg flipping. Motion is baked at 60 Hz; gameplay integration was
not performed.

The export contains 15,726 triangles, 23 bones, one mesh and one material. The
16,000-triangle budget accommodates the full body and layered scalp/back hair.
The 1.04-tile footprint accommodates the lowered arms at roughly two units tall.
The blend file retains individually editable parts and three editable actions.

Both eyes have socket-fitted upper/lower lids with a `Blink` morph. Their closed
surfaces follow the curved eyeballs and anchor at the socket rims so profile
views are covered too. Blink remains outside the body clips; both reference
viewers schedule it independently per instance, including in Rest. The saved
blend exposes the shape key for authoring, while random playback belongs to the
shared viewer controller.

Validation covers connected body/dress/cap topology, normalized weights, loop
seams, leg connections, planted attack feet, early grab motion, finger closure
and walking foot speed. Additional exported-motion assertions check hip/chest
counter-rotation, articulated feet, grounded stance soles and double support.
The ready hands must sit outside the torso near hip height, with unequal heights
and lateral reaches; the snatch must pull back promptly
after contact while retaining its closed grip. Actual distal finger vertices
must draw closer to the palm at contact, and the thumb must fold independently.
Thumb weights follow its connected branch in the source mesh and blend into the
palm, avoiding finger-joint influence across the thumb. Contact and pullback
were checked in close-up renders from two angles. Internal `.R` bone names refer to
positive mesh X, which is the character's left and the viewer's right in front view.
Front, side, top, rear and hero renders plus exported idle/attack/walk samples
were visually inspected. These checks do not substitute for reviewing the asset
in the game.

Regenerate the asset, five views, validation and comparison sheet:

```powershell
npm.cmd run pixelhack:model -- --tile 141 --views hero,side,front,top,back
```
