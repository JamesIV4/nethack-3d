"""Render existing Blender/glTF assets using the PixelHack review conventions."""

import argparse
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixelhack_blender as ph


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, help="Import .glb/.gltf into an empty scene")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--prefix", default="model")
    parser.add_argument("--views", default="front,side,three-quarter")
    parser.add_argument("--resolution", type=int, default=768)
    parser.add_argument("--animation", help="Action name; accepts an imported action name suffix")
    parser.add_argument("--frame", type=int, default=0)
    parser.add_argument("--demo-cube", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if args.model and args.demo_cube:
        parser.error("Choose --model or --demo-cube")
    if args.model or args.demo_cube:
        ph.clean_scene()
    if args.model:
        if args.model.suffix.lower() not in {".glb", ".gltf"}:
            parser.error("--model accepts .glb/.gltf; open .blend before --python")
        bpy.ops.import_scene.gltf(filepath=str(args.model.resolve()))
    if args.demo_cube:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, .5))
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]
    if not objects:
        raise ValueError("No renderable mesh objects")
    if args.animation:
        action = next((a for a in bpy.data.actions if a.name == args.animation or a.name.endswith("_" + args.animation)), None)
        if not action:
            raise ValueError(f"No action {args.animation}; available: {[a.name for a in bpy.data.actions]}")
        for rig in [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]:
            rig.animation_data_create()
            rig.animation_data.action = action
    else:
        for rig in [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]:
            if rig.animation_data:
                rig.animation_data.action = None
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
    bpy.context.scene.frame_set(args.frame)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    ph.render_views(objects, args.out_dir, args.views.split(","), args.resolution, f"{args.prefix}-")


if __name__ == "__main__":
    main()
