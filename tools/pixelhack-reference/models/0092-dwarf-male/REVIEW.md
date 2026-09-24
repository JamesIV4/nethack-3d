# Tile 92: dwarf, male

The 32-pixel source shows a stocky red-clad dwarf beneath a wide blue-gray
horned helmet, with a long pale beard, a curved steel pick, and a bright red
rounded form interpreted here as a shield. The pick's sharp end points forward
in 3D; its head remains partly visible from the sprite's frontal angle.

The face beneath the brim, beard locks, helmet cheek plates, glove grip, shaped
boots, and rear of the tunic are inferred. [NetHack Wiki's dwarf entry](https://nethackwiki.com/wiki/Dwarf_(monster))
confirms the dwarf's humanoid build and that pick-axes and roundshields are
possible equipment. Tile 93 has identical source pixels but is reserved for a
separate female humanoid model.

## Visual review

- The horned helmet, pale beard, red clothing, raised pick, and red shield remain
  identifiable in the three-quarter 32, 64, and 128-pixel previews.
- Front and side renders show forward-bending humanoid knees and boots with toes
  pointing forward. The top view shows the sharp pick end projecting forward.
- The four default renders and source comparison are in `review.png`. No sprite
  scenery or baked ground shadow is in the GLB.

## Motion and export

- Idle holds a raised pick and planted boots. Walk is one alternating left/right
  gait cycle in 0.5 seconds: each step accompanies half of the controller's
  one-tile move, and each planted boot sweeps backward relative to travel.
- Attack starts on the first moving frame, chops down with the forward-facing
  pick, reaches impact at 0.133 seconds, keeps both boots planted, and returns
  exactly to the Idle start pose.
- Export validation passed: 5,342 triangles, 15 bones, one material, normalized
  skin weights, finite geometry, loop seams, foot contact, joint attachment,
  gait direction, pick orientation, and pick impact reach. See `validation.json`.
- The exported GLB was inspected in the standalone viewer. Gameplay integration
  was not performed.
