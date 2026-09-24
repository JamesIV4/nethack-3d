# Water nymph, female — tile 141

This is a stylized 3D interpretation of the requested visual reference. The
tile's water colors remain, while the supplied concept guides the pale skin,
bright flowing curls, large eyes, sea-glass halter, and diagonal hip wrap.
The unseen back and bare feet are inferred. Scenery and source shadows are
excluded.

The skin is voxel fused from editable anatomy parts, then given blended
shoulder and limb weights. The source remains in
`scripts/tilesets/models/water_nymph_female.py`; the generated `.blend` keeps
the rig, named costume and hair parts, and three editable actions.

Idle holds a raised hand ready to grab. Walk is one left-right cycle in 0.5
seconds for 2 tiles/second controller travel. Attack lunges and reaches with
the right hand, closes the fingers at 0.117 seconds, keeps both feet planted,
and returns to Idle. The viewer demonstrates the asset; gameplay integration
was not performed.

The final four-view export has 12,148 triangles, 20 bones, and one material.
Validation checks the connected skin surface, normalized weights, loop seams,
leg connections, planted attack feet, early grab motion, finger closure, and
walking foot speed. Review images are local output; run
`npm.cmd run pixelhack:model -- --tile 141` to regenerate them.
