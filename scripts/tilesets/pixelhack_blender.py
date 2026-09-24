"""Shared Blender geometry, palette, review, and export contract for PixelHack."""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

PALETTE = {
    "ink": "161d27", "joint": "283449", "edge": "424e5c",
    "shell": "586366", "light": "869596", "glint": "a6b1aa",
    "red": "b51d35", "red_light": "ee746c", "red_dark": "671b31",
}
VIEWS = {
    "hero": (4, -5, 3.1), "side": (5, 0, 1.45),
    "front": (0, -5, 1.9), "top": (0, -0.001, 5),
    "three-quarter": (4, -5, 3.1),
}


def linear(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1,)


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)
    bpy.context.scene.world = bpy.data.worlds.new("Review world")


def palette_material():
    name = "PixelHack | matte vertex palette"
    material = bpy.data.materials.get(name)
    if material:
        return material
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = .48
    bsdf.inputs["Metallic"].default_value = 0
    vertex = material.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = "Palette"
    material.node_tree.links.new(vertex.outputs["Color"], bsdf.inputs["Base Color"])
    material.diffuse_color = linear(PALETTE["shell"])
    return material


def mesh(name, vertices, faces, color="shell", shade=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(palette_material())
    colors = data.color_attributes.new(name="Palette", type="BYTE_COLOR", domain="CORNER")
    for polygon in data.polygons:
        key = shade(polygon) if shade else color
        rgba = linear(PALETTE[key])
        for index in polygon.loop_indices:
            colors.data[index].color = rgba
    obj["pixelhack_part"] = name
    return obj


def smooth_surface(obj, tonal=False):
    """Smooth curved surfaces; interpolate palette shading instead of face bands."""
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.update()
    if tonal:
        keys = ("ink", "joint", "edge") if tonal == "limb" else ("edge", "shell", "light")
        stops = [(z, linear(PALETTE[key])) for z, key in zip((-1, .1, 1), keys)]
        colors = obj.data.color_attributes["Palette"]
        for loop in obj.data.loops:
            z = obj.data.vertices[loop.vertex_index].normal.z
            a, b = (stops[0], stops[1]) if z < .1 else (stops[1], stops[2])
            t = max(0, min(1, (z - a[0]) / (b[0] - a[0])))
            colors.data[loop.index].color = tuple(a[1][i] * (1 - t) + b[1][i] * t for i in range(4))
    return obj


def shell(name, rings, sides=12, phase=0, shade=None, color="shell", smooth=False):
    """Loft cross sections (y, z-center, x-radius, z-radius) along the body."""
    if smooth:
        # Cardinal interpolation preserves the authored silhouette without shrinking it.
        source = [Vector(r) for r in rings]
        interpolated = []
        for i in range(len(source) - 1):
            a, b = source[i], source[i + 1]
            before = source[i - 1] if i else 2 * a - b
            after = source[i + 2] if i + 2 < len(source) else 2 * b - a
            for step in range(3):
                t = step / 3
                r = .5 * ((2 * a) + (-before + b) * t + (2 * before - 5 * a + 4 * b - after) * t ** 2 + (-before + 3 * a - 3 * b + after) * t ** 3)
                r[2], r[3] = max(.004, r[2]), max(.004, r[3])
                interpolated.append(r)
        rings = interpolated + [source[-1]]
        sides *= 2
    vertices = [(math.sin(a) * rx, y, z + math.cos(a) * rz)
                for y, z, rx, rz in rings
                for a in [2 * math.pi * j / sides + phase for j in range(sides)]]
    faces = [tuple(range(sides - 1, -1, -1))]
    for i in range(len(rings) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(rings) - 1) * sides + j for j in range(sides)))
    obj = mesh(name, vertices, faces, color, None if smooth else shade)
    return smooth_surface(obj, tonal=bool(shade)) if smooth else obj


def tube(name, points, radii, sides=12, color="joint", shade=None, smooth=True):
    """Closed tapered polygon sweep, preserving the designed limb bends."""
    points = [Vector(p) for p in points]
    vertices = []
    for i, (point, radius) in enumerate(zip(points, radii)):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        helper = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((0, 1, 0))
        axis = tangent.cross(helper).normalized()
        other = tangent.cross(axis).normalized()
        for j in range(sides):
            a = j * math.tau / sides
            vertices.append(point + radius * (math.cos(a) * axis + math.sin(a) * other))
    faces = [tuple(range(sides - 1, -1, -1))]
    for i in range(len(points) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(points) - 1) * sides + j for j in range(sides)))
    obj = mesh(name, vertices, faces, color, None if smooth else shade)
    return smooth_surface(obj, tonal="limb" if shade else False) if smooth else obj


def ellipsoid(name, center, scale, color="joint", subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=center)
    temp = bpy.context.object
    vertices = [tuple(Vector(center) + Vector(tuple(v.co[i] * scale[i] for i in range(3)))) for v in temp.data.vertices]
    faces = [tuple(p.vertices) for p in temp.data.polygons]
    bpy.data.objects.remove(temp, do_unlink=True)
    return mesh(name, vertices, faces, color)


def bounds(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector([min(p[a] for p in points) for a in range(3)])
    high = Vector([max(p[a] for p in points) for a in range(3)])
    return low, high


def normalize(objects, footprint=.92, ground_clearance=0):
    low, high = bounds(objects)
    scale = footprint / max(high.x - low.x, high.y - low.y)
    offset = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    lift = Vector((0, 0, ground_clearance))
    for obj in objects:
        for v in obj.data.vertices:
            v.co = (obj.matrix_world @ v.co - offset) * scale + lift
        obj.matrix_world.identity()
    bpy.context.view_layer.update()
    return Matrix.Translation(lift) @ Matrix.Scale(scale, 4) @ Matrix.Translation(-offset)


def setup_review(objects, resolution=768):
    scene = bpy.context.scene
    for obj in list(scene.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast" if "Medium High Contrast" in [x.name for x in scene.view_settings.bl_rna.properties["look"].enum_items] else "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    world = scene.world or bpy.data.worlds.new("Review world")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.65, .72, .8, 1)
    world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .5
    low, high = bounds(objects)
    center = (low + high) * .5
    span = max(high - low)
    for name, xyz, power, size in [
        ("Key", (2, -3, 5), 280, 3),
        ("Fill", (-3, -1, 2), 100, 3),
        ("Rim", (1, 3, 4), 340, 2),
    ]:
        data = bpy.data.lights.new("Review | " + name, "AREA")
        data.energy, data.shape, data.size = power * span ** 2, "DISK", size * span
        light = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(light)
        light.location = center + Vector(xyz) * span
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("Review | orthographic")
    camera = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    data.type = "ORTHO"
    return center, span


def aim_view(objects, name, center, span):
    camera = bpy.context.scene.camera
    camera.location = center + Vector(VIEWS[name]).normalized() * span * 4
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = [obj.evaluated_get(depsgraph) for obj in objects]
    points = [inverse @ (o.matrix_world @ v.co) for o in evaluated for v in o.data.vertices]
    width = max(p.x for p in points) - min(p.x for p in points)
    height = max(p.y for p in points) - min(p.y for p in points)
    camera.data.ortho_scale = max(width, height) * 1.18
    # Center projected geometry rather than the enclosing 3D bounding box.
    local_offset = Vector(((max(p.x for p in points) + min(p.x for p in points)) / 2,
                           (max(p.y for p in points) + min(p.y for p in points)) / 2, 0))
    camera.location += camera.rotation_euler.to_matrix() @ local_offset


def render_views(objects, out_dir, views, resolution=768, prefix=""):
    center, span = setup_review(objects, resolution)
    paths = {}
    for name in views:
        if name not in VIEWS:
            raise ValueError(f"Unknown view: {name}")
        aim_view(objects, name, center, span)
        path = Path(out_dir) / f"{prefix}{name}.png"
        bpy.context.scene.render.filepath = str(path.resolve())
        bpy.ops.render.render(write_still=True)
        paths[name] = str(path)
    aim_view(objects, "hero", center, span)
    return paths


def export_glb(objects, path, name, rig=None, tile_ids=None):
    """Join temporary copies into one vertex-colored primitive; keep authoring parts."""
    bpy.ops.object.select_all(action="DESELECT")
    copies = []
    for obj in objects:
        copy = obj.copy()
        copy.data = obj.data.copy()
        bpy.context.collection.objects.link(copy)
        copy.select_set(True)
        copies.append(copy)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    joined["tile_ids"] = tile_ids or []
    if rig:
        rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path.resolve()), export_format="GLB", use_selection=True,
                              export_yup=True, export_animations=bool(rig), export_animation_mode="ACTIONS",
                              export_force_sampling=True, export_cameras=False,
                              export_lights=False, export_extras=True, export_texcoords=False,
                              export_normals=True, export_materials="EXPORT")
    bpy.data.objects.remove(joined, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")


def inspect(objects):
    low, high = bounds(objects)
    triangles = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    return {"parts": len(objects), "triangles": triangles,
            "materials": len({m.name for o in objects for m in o.data.materials}),
            "boundsBlender": {"min": list(low), "max": list(high)},
            "dimensionsBlender": list(high - low)}
