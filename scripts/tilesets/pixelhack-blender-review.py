"""Render consistent orthographic review views of a .blend or glTF model.

Examples:
  blender -b model.blend --python pixelhack-blender-review.py -- --out-dir review
  blender -b --python pixelhack-blender-review.py -- --model model.glb --out-dir review
"""

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, help="Optional .glb or .gltf to import into a blank scene")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--prefix", default="model")
    parser.add_argument("--demo-cube", action="store_true", help="Create a temporary cube for tool verification")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(args)


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return (minimum + maximum) / 2, max((maximum - minimum).length, 0.1)


def make_light(name, location, target, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()


def main():
    args = parse_args()
    if args.model and args.demo_cube:
        raise ValueError("Choose --model or --demo-cube")
    if args.model:
        if args.model.suffix.lower() not in {".glb", ".gltf"}:
            raise ValueError("--model accepts .glb or .gltf; open a .blend before --python instead")
        bpy.ops.import_scene.gltf(filepath=str(args.model.resolve()))
    if args.demo_cube:
        bpy.ops.mesh.primitive_cube_add()
        cube = bpy.context.object
        cube.name = "Review demonstration cube"
        material = bpy.data.materials.new("PixelHack review sample")
        material.diffuse_color = (0.27, 0.39, 0.46, 1)
        material.use_nodes = True
        material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = material.diffuse_color
        cube.data.materials.append(material)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.hide_render]
    if not meshes:
        raise ValueError("No visible mesh objects found to render")
    center, diagonal = world_bounds(meshes)
    radius = diagonal * 1.8
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("PixelHack review world")
    scene.world.color = (0.12, 0.15, 0.16)

    make_light("PixelHack review key", center + Vector((radius, -radius, radius * 1.5)), center, 850, radius)
    make_light("PixelHack review fill", center + Vector((-radius, radius * 0.4, radius)), center, 450, radius * 1.4)
    camera_data = bpy.data.cameras.new("PixelHack review camera")
    camera = bpy.data.objects.new("PixelHack review camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = diagonal * 1.55

    views = {
        "front": Vector((0, -1, 0.15)),
        "side": Vector((1, 0, 0.15)),
        "three-quarter": Vector((1, -1, 0.5)),
    }
    for name, direction in views.items():
        camera.location = center + direction.normalized() * radius * 2
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(out_dir / f"{args.prefix}-{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {scene.render.filepath}")


if __name__ == "__main__":
    main()
