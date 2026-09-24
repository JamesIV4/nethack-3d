"""Render exported GLB animation samples with one fixed camera per view."""

import argparse
import math
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixelhack_blender as ph


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--animation", default="Attack")
    parser.add_argument("--samples", default="onset:0.033333,impact:0.1",
                        help="Comma-separated label:seconds pairs")
    parser.add_argument("--views", default="hero,side")
    parser.add_argument("--resolution", type=int, default=768)
    parser.add_argument("--zoom", type=float, default=1,
                        help="Camera scale multiplier after the rest-pose framing")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    samples = [(label, float(seconds)) for label, seconds in
               (sample.split(":", 1) for sample in args.samples.split(","))]
    views = args.views.split(",")
    ph.clean_scene()
    bpy.ops.import_scene.gltf(filepath=str(args.model.resolve()))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    action = next((item for item in bpy.data.actions
                   if item.name == args.animation or item.name.endswith("_" + args.animation)), None)
    if not objects or not rigs or not action:
        raise ValueError("Model needs a mesh, rig, and requested animation")

    def rest():
        for rig in rigs:
            rig.animation_data_create()
            rig.animation_data.action = None
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
        bpy.context.scene.frame_set(0)
        bpy.context.view_layer.update()

    rest()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    center, span = ph.setup_review(objects, args.resolution)
    for view in views:
        rest()
        ph.aim_view(objects, view, center, span)
        bpy.context.scene.camera.data.ortho_scale *= args.zoom
        # The framing stays fixed across every sample in this view.
        for label, seconds in samples:
            for rig in rigs:
                rig.animation_data.action = action
            frame = seconds * bpy.context.scene.render.fps
            whole = math.floor(frame)
            bpy.context.scene.frame_set(whole, subframe=frame - whole)
            bpy.context.scene.render.filepath = str((args.out_dir / f"{args.animation.lower()}-{label}-{view}.png").resolve())
            bpy.ops.render.render(write_still=True)
            print(bpy.context.scene.render.filepath)


if __name__ == "__main__":
    main()
