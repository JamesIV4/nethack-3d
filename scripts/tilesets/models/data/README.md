# Human anatomy source

For the complete workflow and the lessons from revising the nymph, read
[Humanoid modeling and animation](../../../../tools/pixelhack-reference/HUMANOID-MODELING.md).
This file records the anatomical source and its preparation.

`stylized-female-cc0.json` is the local, reproducible control mesh used by the
water nymph generator. It contains vertices and polygon indices only.

- Source: Blender Studio and community contributors, **Human Base Meshes v1.4.1**.
- License: **CC0 1.0 Universal** (public domain dedication).
- Official listing: https://www.blender.org/download/demo-files/#assets
- Download: https://mirror.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip
- Archive SHA-256: `811f43accbb31a88266d932f8f5563b2d13586fca0ba2693aad1f5fe582b3515`
- Object: `GEO-body_female_stylized` from `human_base_meshes_bundle.blend`.
- Preparation: Blender 5.1.2 Decimate modifier, `UNSUBDIV`, two iterations;
  local coordinates rounded to seven decimal places. 3,513 vertices, 4,138
  polygons, 7,022 triangles. No materials, rigs, or external images included.

The generator adapts proportions, poses and weights this mesh, adds its own
costume, hair, eyes and vertex colors. Rebuilding needs no download or add-on.

`stylized-male-cc0.json` is the local control mesh for tile 90, the male hobbit.
It comes from the same CC0 v1.4.1 archive and SHA-256 above, object
`GEO-body_male_stylized`. Blender 5.1.2's Decimate modifier in `UNSUBDIV` mode
with two iterations produced 3,513 vertices, 4,138 polygons and 7,022
triangles. Coordinates were rounded to seven decimal places. The male and
female cages have matching polygon and vertex order; the hobbit recipe uses
the female cage solely to locate anatomical weight regions while the male
cage supplies every visible body vertex. Rebuilding tile 90 needs neither the
source archive nor an add-on.

Technique references:

- [Blender Studio: primitive body and proportion workflow](https://studio.blender.org/training/stylized-character-workflow/5d7f7cf055ccaf1a4a78102d/)
- [Blender Studio: generic retopology and anatomical landmarks](https://studio.blender.org/training/realistic-human-research/retopology/)
- [Blender Studio: facial edge flow and clean retopology](https://studio.blender.org/training/stylized-character-workflow/chapter/5d384edea5b8f5c2c32c8507/)
- [Blender Studio: creating clothing base meshes](https://studio.blender.org/training/stylized-character-workflow/5d7f7fc5db37a94301d88ff9/)
- [Blender Manual: Shrinkwrap surface fitting and offset](https://docs.blender.org/manual/en/5.0/modeling/modifiers/deform/shrinkwrap.html)
- [Blender Manual: Solidify thickness and boundary rims](https://docs.blender.org/manual/en/5.3/modeling/modifiers/generate/solidify.html)
- [Bran Sculpts: Modeling Hair with Curves](https://www.youtube.com/watch?v=IH3ThN_bUnM)
- [Blender Manual: guide clumps, root-to-tip shape and tip spread](https://docs.blender.org/manual/en/5.1/modeling/geometry_nodes/hair/guides/clump_hair_curves.html)
- [Hair Tool author documentation: flat and custom curve profiles](https://joseconseco.github.io/HairToolDocs_28/editing_profile/)
- [Hair Tool author documentation: projecting roots onto the scalp](https://joseconseco.github.io/HairTool_3_Documentation/curve_tool#project-roots)
- [Blender Manual: guide interpolation and root density](https://docs.blender.org/manual/fi/5.1/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html)

Applied here: establish anatomy and silhouette first; preserve existing facial
and joint loops; fit costume to the body surface; use broad tapered hair masses;
inspect front, profile and three-quarter renders as well as exported animation.

The dress uses one continuous quad surface, projected onto the torso with an
offset, then extended into a skirt with sculpted folds and an asymmetric hem.
Blender's Solidify modifier adds fabric thickness and joins the inner and outer
surfaces at the neckline and hem. A build assertion requires one connected
component and zero nonmanifold edges. Folds and edge colors belong to that
surface; there are no overlapping clothing panels. Cloth movement uses blended
rig weights so it exports reproducibly to GLB without a cloth simulation cache.

Hair uses a thin, head-fitted scalp cap beneath independent overlapping curve
clumps. Separate lower, upper, side, fringe and crown layers follow the tutorial's
layered construction; flattened elliptical profiles and tapered, staggered tips
keep them distinct. The cap covers the roots and closes the crown without a fused
back curtain. Each lock remains separately editable in the generated blend file,
with weights transitioning from Head at the roots to the two hair bones below.
Ten overlapping, individually closed short root locks are projected along the
scalp surface to cover the smooth cap between the long clumps. This applies the
root projection and increased coverage principles with ordinary exportable
meshes; no particle hair or runtime Geometry Nodes system is required.

The entire body is retained, including skin under the dress. Both body and dress
must each be one closed connected component. Clothing has its own thickness,
clearance and blended leg weights; body polygons are never removed to hide
clipping. Rear views are part of the water-nymph review command.

Animation references:

- [Blender Studio: Animation Fundamentals, walking and body mechanics](https://studio.blender.org/training/animation-fundamentals/chapter/5d7103e7b27563d4c15b0874/)
- [Blender Studio: weight shift and overlapping action](https://studio.blender.org/training/animation-fundamentals/5d69b398c4769bb8cceb0709/)
- [Mark Masters: layered weight-shift and full-body animation workflow](https://www.youtube.com/watch?v=W7GeNxrDOnY)

Applied principles: separate pelvis/chest control with counter-rotation,
grounded support and heel-to-toe roll, curved swing and reach paths, and delayed
secondary movement. The walk has 55% stance and 45% swing with brief double
support. Cubic Hermite interpolation matches the swing-foot velocity to the
constant-speed stance at its boundaries. Sole vertices determine floor clearance.
The motion functions are sampled at 60 Hz for deterministic Blender/GLB playback;
runtime interpolation does not require IK constraints or physics simulation.
