# Killer bee model review

Source: PixelHack tiles 2 and 3. Their pixels are identical, so they share this
model despite the atlas's male/female slot labels. The source shows a small bee
hovering above a separate ground shadow. The shadow is excluded from the mesh.

The model keeps the warm copper face, black eyes, golden thorax, striped brown
abdomen, pale raised wings, six dangling dark legs, and pointed rear stinger.
The unseen side is inferred as bilateral; the smaller hindwing pair follows bee
anatomy while the two dominant forewings carry the source silhouette. Thin
features are widened enough to remain visible in the 32/64/128-pixel review.

The editable Blender file has 53 named closed parts and a 23-bone rig. The GLB
has one skinned mesh, one vertex-colored material, 4,664 triangles, and no
external textures. The body hovers with 0.155 tile units of rest clearance.

- **Idle:** two-second loop with wingbeats, body bob, and dangling legs.
- **Walk:** one-second in-place flight loop with quicker wingbeats. A game
  controller would supply travel.
- **Attack:** half-second single play. Movement begins in the first frame; the
  abdomen curls **under** the bee and the stinger thrusts forward from below at
  0.133 seconds, then the pose returns to Idle.

The exported GLB passed 61 sampled poses per clip: finite skinned positions,
normalized weights, six connected leg joints, zero loop seam error, matching
Attack/Idle endpoints, forward sting reach, and floor clearance. The lowest
attack vertex stayed 0.025 tile units above the floor. The onset and impact
were also reviewed in fixed-camera [hero](attack-impact-hero.png) and
[side](attack-impact-side.png) renders. The four rest renders
and `review.png` compare the tile and model at full and reduced sizes.

The standalone catalog and viewer load this asset for tiles 2 and 3. Gameplay
glyph rendering and damage timing were not integrated in this assignment.
