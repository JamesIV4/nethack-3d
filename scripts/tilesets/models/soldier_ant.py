"""PixelHack 4/5: olive soldier ant with a broad gaster, biting jaws, and sting."""

import math

import bpy
from mathutils import Matrix, Quaternion, Vector

import pixelhack_blender as ph
from pixelhack_rig import bind, create_rig, envelope, set_bone_segment, solve_knee


PART_BONES = {}
LEGS = {}
ANTENNAE = {}
JAWS = {}


def part(obj, bone):
    PART_BONES[obj.name] = bone
    return obj


def smooth(obj):
    return ph.smooth_surface(obj)


def mix(a, b, t):
    t = max(0, min(1, t))
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(4))


def paint(obj, color_at):
    colors = obj.data.color_attributes["Palette"]
    for loop in obj.data.loops:
        vertex = obj.data.vertices[loop.vertex_index]
        colors.data[loop.index].color = color_at(vertex.co, vertex.normal)
    return obj


def rotate_world(bone, axis, angle):
    local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
    bone.rotation_quaternion = Quaternion(local_axis, angle)


def build():
    # Tile 4 supplies color and pose; the hidden side is inferred bilaterally.
    ph.PALETTE.clear()
    ph.PALETTE.update({
        "ink": "191806", "joint": "30290e", "limb": "47391b",
        "shell": "514217", "shell_light": "755f2c", "tan": "9b804a",
        "abdomen": "4b3e16", "abdomen_light": "78632d", "edge": "28230c",
        "red": "aa142a", "red_light": "db8174", "sting": "29240f",
    })
    ph.palette_material().node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .78
    ink = ph.linear(ph.PALETTE["ink"])
    edge = ph.linear(ph.PALETTE["edge"])
    shell = ph.linear(ph.PALETTE["shell"])
    light = ph.linear(ph.PALETTE["shell_light"])
    tan = ph.linear(ph.PALETTE["tan"])
    abdomen = ph.linear(ph.PALETTE["abdomen"])
    abdomen_light = ph.linear(ph.PALETTE["abdomen_light"])
    limb = ph.linear(ph.PALETTE["limb"])

    head = ph.shell("Head | broad armored cranium", [
        (-1.16, .96, .065, .075), (-1.07, .99, .22, .22),
        (-.91, 1.02, .33, .32), (-.72, 1.00, .34, .32),
        (-.53, .96, .25, .23), (-.42, .92, .10, .12),
    ], sides=12, smooth=True)
    def head_color(p, n):
        base = mix(edge, shell, .48 + .35 * n.z)
        crown = max(0, min(1, (p.z - .98) * 4.5))
        front = max(0, min(1, (-p.y - .59) * 2.4))
        return mix(base, tan, crown * front * (.55 + .35 * max(0, n.z)))
    part(paint(head, head_color), "Head")

    neck = ph.shell("Neck | flexible dark collar", [
        (-.68, .93, .10, .11), (-.57, .92, .12, .13),
        (-.44, .89, .15, .16), (-.32, .87, .13, .14),
    ], sides=10, color="joint", smooth=True)
    part(neck, "Body")
    thorax = ph.shell("Thorax | low olive shoulder", [
        (-.41, .88, .09, .10), (-.28, .86, .21, .21),
        (-.09, .84, .24, .24), (.11, .82, .20, .20),
        (.27, .80, .10, .12),
    ], sides=12, smooth=True)
    part(paint(thorax, lambda p, n: mix(edge, mix(shell, light, .24 + .38 * max(0, n.z)),
                                        .58 + .29 * n.z)), "Body")
    part(smooth(ph.ellipsoid("Waist | first petiole node", (0, .24, .79),
                             (.12, .13, .13), "edge", 2)), "Body")
    part(ph.tube("Waist | narrow petiole", [(0, .24, .79), (0, .38, .78),
                                          (0, .47, .79)], [.095, .075, .12],
                 sides=10, color="joint"), "Body")

    gaster = ph.shell("Abdomen | broad soldier gaster", [
        (.39, .79, .08, .10), (.49, .79, .24, .24),
        (.66, .80, .38, .35), (.88, .78, .46, .41),
        (1.10, .74, .43, .37), (1.29, .71, .31, .27),
        (1.42, .69, .13, .14), (1.46, .68, .025, .035),
    ], sides=14, smooth=True)
    def abdomen_color(p, n):
        base = mix(ink, abdomen, .65 + .23 * n.z)
        dorsal = max(0, min(1, (n.z + .02) * 1.1))
        side_patch = max(0, min(1, (abs(n.x) - .25) * 2.0))
        side_patch *= max(0, min(1, (p.z - .56) * 5))
        side_patch *= max(0, min(1, 1.45 - abs(p.y - .84) * 2.1))
        highlight = max(dorsal * .37, side_patch * .98)
        return mix(base, mix(abdomen_light, tan, .90 * side_patch), highlight)
    part(paint(gaster, abdomen_color), "Abdomen")
    part(smooth(ph.ellipsoid("Abdomen | terminal dark plate", (0, 1.43, .68),
                             (.14, .09, .12), "edge", 2)), "Abdomen")
    part(ph.tube("Stinger | short downward barb", [(0, 1.43, .65),
                 (0, 1.52, .60), (0, 1.59, .47), (0, 1.61, .42)],
                 [.070, .050, .029, .004], sides=10, color="sting"), "Stinger")

    for sign, side in [(-1, "L"), (1, "R")]:
        # The lens is tiny in the tile, but needs a dark rim and glint in 3D.
        part(smooth(ph.ellipsoid(f"Eye socket {side}",
                    (sign * .326, -.90, 1.015), (.067, .115, .119), "ink", 2)), "Head")
        part(smooth(ph.ellipsoid(f"Eye {side} | scarlet lens",
                    (sign * .357, -.92, 1.025), (.044, .089, .088), "red", 2)), "Head")
        part(smooth(ph.ellipsoid(f"Eye {side} | pale glint",
                    (sign * .386, -.946, 1.061), (.013, .022, .025), "red_light", 1)), "Head")

        antenna = [Vector(p) for p in [
            (sign * .18, -1.08, 1.17), (sign * .27, -1.27, 1.24),
            (sign * .39, -1.46, 1.25), (sign * .46, -1.69, 1.13),
            (sign * .47, -1.80, 1.04),
        ]]
        if side == "L":
            antenna[2].z += .085
            antenna[3].z += .10
            antenna[4].z += .10
        ANTENNAE[side] = antenna
        part(ph.tube(f"Antenna {side} | basal shaft", antenna[:3],
                     [.044, .041, .035], sides=10, color="limb"), f"Antenna.{side}.base")
        part(smooth(ph.ellipsoid(f"Antenna {side} | elbow", antenna[2],
                    (.049, .049, .049), "joint", 1)), f"Antenna.{side}.base")
        part(ph.tube(f"Antenna {side} | tapered club", antenna[2:],
                     [.036, .032, .014], sides=10, color="limb"), f"Antenna.{side}.tip")
        part(smooth(ph.ellipsoid(f"Antenna {side} | socket", antenna[0],
                    (.060, .060, .060), "edge", 1)), "Head")

        jaw = [Vector(p) for p in [
            (sign * .17, -1.12, .78), (sign * .30, -1.25, .69),
            (sign * .31, -1.42, .65), (sign * .19, -1.50, .69),
            (sign * .08, -1.50, .77),
        ]]
        JAWS[side] = jaw
        part(ph.tube(f"Mandible {side} | hooked biting jaw", jaw,
                     [.083, .083, .064, .041, .006], sides=12,
                     color="edge"), f"Jaw.{side}")
        part(smooth(ph.ellipsoid(f"Mandible {side} | hinge", jaw[0],
                    (.093, .092, .082), "joint", 1)), "Head")

        raw_legs = [
            [(.21, -.29, .85), (.47, -.52, .78), (.73, -.78, .66),
             (.70, -1.13, .075), (.85, -1.33, .025)],
            [(.22, -.06, .81), (.47, .09, .75), (.71, .31, .66),
             (.79, .07, .075), (.91, -.07, .025)],
            [(.18, .16, .79), (.66, .56, .66), (1.10, 1.02, .45),
             (.75, 1.20, .075), (.91, 1.43, .025)],
        ]
        for number, raw in enumerate(raw_legs, 1):
            name = f"{side}{number}"
            far = .055 if side == "L" else 0
            points = [Vector((sign * x, y + far, z)) for x, y, z in raw]
            LEGS[name] = points
            hip, bend, knee, ankle, toe = points
            upper = ph.tube(f"Leg {name} | femur", [hip, bend, knee],
                            [.066, .063, .046], sides=10, color="limb")
            paint(upper, lambda p, n: mix(edge, limb, .42 + .34 * max(0, n.z)))
            part(upper, f"Leg.{name}.upper")
            lower_mid = knee.lerp(ankle, .56)
            lower = ph.tube(f"Leg {name} | tibia", [knee, lower_mid, ankle],
                            [.045, .034, .021], sides=10, color="joint")
            paint(lower, lambda p, n: mix(ink, limb, .24 + .42 * max(0, n.z)))
            part(lower, f"Leg.{name}.lower")
            part(ph.tube(f"Leg {name} | tarsus", [ankle, toe],
                         [.024, .009], sides=8, color="ink"), f"Leg.{name}.foot")
            part(smooth(ph.ellipsoid(f"Hip {name} | dark socket", hip,
                        (.083, .077, .080), "joint", 1)), "Body")
            part(smooth(ph.ellipsoid(f"Knee {name} | joint", knee,
                        (.055, .055, .055), "edge", 1)), f"Leg.{name}.upper")
            part(smooth(ph.ellipsoid(f"Ankle {name} | joint", ankle,
                        (.030, .031, .029), "joint", 1)), f"Leg.{name}.lower")


def rig_model(objects, transform):
    specs = {
        "Root": ((0, 0, 0), (0, 0, .20), None),
        "Body": ((0, -.01, .82), (0, -.16, .88), "Root"),
        "Head": ((0, -.46, .93), (0, -.91, 1.00), "Body"),
        "Abdomen": ((0, .39, .79), (0, 1.19, .73), "Body"),
        "Stinger": ((0, 1.43, .65), (0, 1.61, .42), "Abdomen"),
    }
    for side, points in ANTENNAE.items():
        specs[f"Antenna.{side}.base"] = (points[0], points[2], "Head")
        specs[f"Antenna.{side}.tip"] = (points[2], points[4], f"Antenna.{side}.base")
    for side, points in JAWS.items():
        specs[f"Jaw.{side}"] = (points[0], points[2], "Head")
    for name, points in LEGS.items():
        specs[f"Leg.{name}.upper"] = (points[0], points[2], "Body")
        specs[f"Leg.{name}.lower"] = (points[2], points[3], f"Leg.{name}.upper")
        specs[f"Leg.{name}.foot"] = (points[3], points[4], f"Leg.{name}.lower")
    rig = create_rig("Soldier ant | deform rig", specs, transform)
    for obj in objects:
        if obj.name.startswith("Neck | flexible"):
            front = min(vertex.co.y for vertex in obj.data.vertices)
            back = max(vertex.co.y for vertex in obj.data.vertices)
            weights = []
            for vertex in obj.data.vertices:
                t = max(0, min(1, (vertex.co.y - front) / (back - front)))
                head_weight = 1 - t * t * (3 - 2 * t)
                weights.append({"Head": head_weight, "Body": 1 - head_weight})
            bind(obj, rig, weights)
        else:
            bind(obj, rig, PART_BONES[obj.name])
    animate(rig, transform)
    return rig


def animate(rig, transform):
    scene = bpy.context.scene
    scene.render.fps = 60
    rig.animation_data_create()
    scale = transform.to_scale().x
    for clip_name, frames in (("Idle", 91), ("Walk", 31), ("Attack", 31)):
        action = bpy.data.actions.new(clip_name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame in range(frames):
            scene.frame_set(frame)
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
            t = frame / (frames - 1)
            phase = math.tau * (2 if clip_name == "Walk" else 1) * t
            strike = envelope(t, [(0, 0), (1 / 15, .48), (3 / 15, 1),
                                  (5 / 15, .92), (8 / 15, .25), (12 / 15, 0),
                                  (1, 0)]) if clip_name == "Attack" else 0
            sting = envelope(t, [(0, 0), (1 / 15, 0), (2 / 15, .14),
                                 (3 / 15, 1), (5 / 15, .78), (8 / 15, 0),
                                 (1, 0)]) if clip_name == "Attack" else 0
            jaw_snap = envelope(t, [(0, 0), (1 / 15, -.48), (2 / 15, -.42),
                                    (3 / 15, .29), (5 / 15, .29),
                                    (8 / 15, .08), (12 / 15, 0),
                                    (1, 0)]) if clip_name == "Attack" else 0
            if clip_name == "Idle":
                body_offset = Vector((0, -.016 * (1 - math.cos(phase)),
                                      .012 * math.sin(phase))) * scale
            elif clip_name == "Walk":
                body_offset = Vector((0, -.035 * math.sin(phase),
                                      .030 * (1 - math.cos(2 * phase)))) * scale
            else:
                body_offset = Vector((0, -.32 * strike, .25 * strike)) * scale
            body = rig.pose.bones["Body"]
            body.matrix = Matrix.Translation(body_offset) @ body.bone.matrix_local
            bpy.context.view_layer.update()
            head = rig.pose.bones["Head"]
            if clip_name == "Attack":
                # The head supplies the final reach while the hind feet brace.
                head.location = head.bone.matrix_local.to_3x3().inverted() @ (
                    Vector((0, -.27 * strike, .14 * strike)) * scale)
            rotate_world(rig.pose.bones["Head"], (1, 0, 0),
                         -.16 * strike + (.05 if clip_name == "Walk" else .024) * math.sin(phase))
            rotate_world(rig.pose.bones["Abdomen"], (1, 0, 0),
                         -.19 * sting + .018 * math.sin(phase))
            rotate_world(rig.pose.bones["Stinger"], (1, 0, 0), -.44 * sting)
            for side, sign in (("L", -1), ("R", 1)):
                rotate_world(rig.pose.bones[f"Jaw.{side}"], (0, 0, 1),
                             sign * (jaw_snap + .045 * math.sin(phase)))
                rotate_world(rig.pose.bones[f"Antenna.{side}.base"],
                             (0, 0, 1), sign * .045 * math.sin(phase + (0 if side == "L" else .7)))
                rotate_world(rig.pose.bones[f"Antenna.{side}.tip"],
                             (1, 0, 0), .065 * math.sin(phase + (1 if side == "L" else .3))
                             + .11 * strike)
            bpy.context.view_layer.update()
            for name, rest in LEGS.items():
                points = [transform @ p for p in rest]
                hip = points[0] + body_offset
                knee_rest, ankle_rest, toe_rest = points[2:]
                ankle = ankle_rest.copy()
                toe_offset = toe_rest - ankle_rest
                side, number = name[0], int(name[1])
                if clip_name == "Walk":
                    if number == 1:
                        ankle.y += .23 * scale
                    elif number == 3:
                        ankle.y -= .20 * scale
                    # L1/R2/L3 and R1/L2/R3 alternate their support phases.
                    offset = 0 if (side == "L") == (number % 2 == 1) else .5
                    # Two broad stride cycles per half-second. Each stance moves
                    # ~0.23 tile in ~0.125 seconds as the controller crosses a tile.
                    cycle = (2 * t + offset) % 1
                    stride = .86 * scale
                    if cycle < .5:
                        ankle.y += stride * (cycle * 2 - .5)
                    else:
                        swing = (cycle - .5) * 2
                        ankle.y += stride * (.5 - swing)
                        ankle.z += .20 * scale * math.sin(math.pi * swing) ** 2
                elif clip_name == "Attack":
                    if number == 1:
                        # Forelegs strike with the head while the rear pair braces.
                        ankle.y -= .38 * strike * scale
                        ankle.z += .25 * strike * scale
                    elif number == 2:
                        ankle.y -= .30 * strike * scale
                        ankle.z += .20 * strike * scale
                upper_length = (points[2] - points[0]).length
                lower_length = (points[3] - points[2]).length
                try:
                    knee = solve_knee(hip, ankle, knee_rest, upper_length, lower_length)
                except ValueError as error:
                    raise ValueError(f"{clip_name} frame {frame}, leg {name}: {error}") from error
                set_bone_segment(rig, f"Leg.{name}.upper", hip, knee)
                set_bone_segment(rig, f"Leg.{name}.lower", knee, ankle)
                set_bone_segment(rig, f"Leg.{name}.foot", ankle, ankle + toe_offset)
            for bone in rig.pose.bones:
                for channel in ("location", "rotation_quaternion", "scale"):
                    bone.keyframe_insert(channel, frame=frame, group=bone.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = "LINEAR"
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    scene.frame_set(0)
    bpy.context.view_layer.update()
