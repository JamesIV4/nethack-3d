# Soldier ant model review

Source: PixelHack tiles 4 and 5. Their atlas pixels were checked directly and
are identical, so both use this model. The sprite shows an olive-brown ant with
a broad abdomen, tan highlights, long angular legs, a red eye, and dark jaws.
The model adds a short stinger for the NetHack soldier ant's poisonous attack.
The unseen side is inferred bilaterally. The source ground and shadow are not
part of the mesh.

The editable [Blender file](model.blend) keeps 62 named, closed parts. The
[GLB](model.glb) has 5,436 triangles, one vertex-colored PBR material, 29 bones,
and no external textures. Its rest footprint is 0.92 tile units. The [review
sheet](review.png) compares the source and model at 32, 64, and 128 pixels;
the separate [hero](hero.png), [side](side.png), [front](front.png), and
[top](top.png) renders show its complete shape.

- **Idle:** 1.5-second loop. Open jaws and probing antennae hold an attack-ready
  stance, which is also the start and end of Attack.
- **Walk:** 0.5-second loop with two broad alternating tripod strides. It is
  authored for one tile of controller travel per loop (2 tiles per second).
  The exported support-foot sweep measures about 1.73 tiles per second; swing
  feet rise about 0.05 tile units. See the fixed-camera [stance](walk-stance-side.png)
  and [swing](walk-swing-side.png) views.
- **Attack:** 0.5-second single play with impact at 0.1 seconds. The body and
  head move in the first frames, the front and middle legs rise, and both jaws
  snap as the stinger flicks. Both hind feet stay grounded through the entire
  clip. The [onset](attack-onset-side.png) and [impact](attack-impact-side.png)
  frames use one fixed camera.

The exported [validation report](validation.json) checks normalized skin
weights, finite geometry, 12 knee/ankle connections, all three clips, loop
seams, Attack-to-Idle endpoints, floor clearance, jaw/stinger motion, and hind
foot contact across 61 samples. A weighted neck section remains joined to the
head during its thrust. The final four-view export passed its 6,500-triangle
budget.

The standalone model viewer serves tiles 4 and 5. Gameplay glyph rendering and
damage timing were not integrated here.
