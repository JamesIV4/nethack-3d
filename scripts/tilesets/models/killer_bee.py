"""PixelHack 2/3: a small hovering bee with raised wings and an underbody sting."""

import math

import bpy
from mathutils import Matrix, Quaternion, Vector

import pixelhack_blender as ph
from pixelhack_rig import bind, create_rig, envelope


PART_BONES = {}
LEG_POINTS = {}
WING_POINTS = {}


def part(obj, bone):
    PART_BONES[obj.name] = bone
    return obj


def smooth(obj):
    return ph.smooth_surface(obj)


def blend(a, b, t):
    t = max(0, min(1, t))
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(4))


def paint(obj, color_at):
    colors = obj.data.color_attributes["Palette"]
    for loop in obj.data.loops:
        vertex = obj.data.vertices[loop.vertex_index]
        colors.data[loop.index].color = color_at(vertex.co, vertex.normal)
    return obj


def wing(side, kind):
    """Closed, slightly thick membrane; its pale face stays visible from either side."""
    sign = 1 if side == "R" else -1
    fore = kind == "fore"
    root = Vector((sign * (.19 if fore else .17), -.12 if fore else .17, .92))
    tip = Vector((sign * (1.02 if fore else .69), -.24 if fore else .37,
                  1.63 if fore else 1.38))
    WING_POINTS[(side, kind)] = (root, tip)
    normal = Vector((-sign * .63, 0, .78))
    width_scale = 1 if fore else .65
    sections = [(0, .026), (.12, .065), (.30, .115), (.50, .13),
                (.70, .10), (.88, .055), (1, .009)]
    sections = [(t, width * width_scale) for t, width in sections]
    chords = [-1, -.5, 0, .5, 1]
    vertices = []
    for layer in (1, -1):
        for t, width in sections:
            center = root.lerp(tip, t) + Vector((0, .045 * math.sin(math.pi * t), 0))
            for chord in chords:
                bulge = .009 * math.sin(math.pi * t) * (1 - chord * chord)
                vertex = center + Vector((0, chord * width, 0)) + normal * layer * (.012 + bulge)
                vertices.append(tuple(vertex))
    count = len(sections) * len(chords)
    row = len(chords)
    faces = []
    for layer in range(2):
        base = layer * count
        for i in range(len(sections) - 1):
            for j in range(row - 1):
                a = base + i * row + j
                b = a + row
                faces.append((a, b, b + 1, a + 1) if layer == 0 else (a + 1, b + 1, b, a))
    for i in range(len(sections) - 1):
        for j in (0, row - 1):
            a, b = i * row + j, (i + 1) * row + j
            faces.append((a, a + count, b + count, b) if j == 0 else (b, b + count, a + count, a))
    for i in (0, len(sections) - 1):
        a = i * row
        faces.append(tuple(a + j for j in range(row)) + tuple(a + count + j for j in reversed(range(row))))
    name = f"Wing {side} {kind} | pale membrane"
    obj = smooth(ph.mesh(name, vertices, faces, "wing"))
    pale = ph.linear(ph.PALETTE["wing_pale"])
    muted = ph.linear(ph.PALETTE["wing"])
    paint(obj, lambda p, n: blend(muted, pale, .38 + .47 * max(0, n.z)))
    part(obj, f"Wing.{side}.{kind}")
    edge = [root.lerp(tip, t) + Vector((0, -.03 - width, 0))
            for t, width in (sections[0], sections[2], sections[4], sections[-1])]
    part(ph.tube(f"Wing {side} {kind} | dark leading vein", edge,
                 [.021, .018, .012, .004], sides=8, color="wing_vein"), f"Wing.{side}.{kind}")
    part(smooth(ph.ellipsoid(f"Wing {side} {kind} | hinge", root,
                                    (.058, .052, .047), "wing_vein", 1)), "Body")


def build():
    # Local sRGB palette; the shared ant palette is left intact in its own process.
    ph.VIEWS["hero"] = (2, -5, 3.1)
    ph.PALETTE.clear()
    ph.PALETTE.update({
        "ink": "211b10", "joint": "302713", "edge": "65451d",
        "shell": "b47729", "light": "edb748", "glint": "fff8e7",
        "head": "b66b28", "face": "d9913b", "face_light": "f9ce87",
        "abdomen": "674316", "abdomen_band": "bd802d", "abdomen_dark": "352711",
        "wing": "a9c3b6", "wing_pale": "d8dec7", "wing_vein": "61491f",
        "eye": "11120e", "stinger": "171710",
    })
    dark = ph.linear(ph.PALETTE["abdomen"])
    amber = ph.linear(ph.PALETTE["abdomen_band"])
    black = ph.linear(ph.PALETTE["abdomen_dark"])
    head = ph.linear(ph.PALETTE["head"])
    face = ph.linear(ph.PALETTE["face"])
    light = ph.linear(ph.PALETTE["face_light"])
    honey = ph.linear(ph.PALETTE["shell"])
    gold = ph.linear(ph.PALETTE["light"])

    thorax = ph.shell("Thorax | compact golden body", [
        (-.43, .62, .13, .17), (-.31, .67, .29, .29),
        (-.10, .68, .37, .34), (.13, .65, .32, .30),
        (.30, .60, .19, .20),
    ], sides=12, smooth=True)
    paint(thorax, lambda p, n: blend(honey, gold, .20 + .48 * max(0, n.z)))
    part(thorax, "Body")

    neck = smooth(ph.ellipsoid("Neck | dark collar", (0, -.43, .65),
                              (.22, .13, .22), "edge", 2))
    part(neck, "Body")
    head_mesh = ph.shell("Head | copper face", [
        (-1.04, .63, .045, .07), (-.94, .66, .23, .24),
        (-.73, .68, .31, .28), (-.52, .68, .29, .26),
        (-.36, .65, .17, .18),
    ], sides=12, smooth=True)
    paint(head_mesh, lambda p, n: blend(head, blend(face, light,
        .18 + .55 * max(0, n.z)), max(0, min(1, (-p.y - .38) / .60))))
    part(head_mesh, "Head")
    face_plate = smooth(ph.ellipsoid("Face | bright muzzle", (0, -.97, .60),
                                    (.23, .078, .17), "face", 2))
    part(face_plate, "Head")
    for sign, side in [(-1, "L"), (1, "R")]:
        part(smooth(ph.ellipsoid(f"Eye socket {side}",
                    (sign * .278, -.78, .72), (.063, .13, .125), "ink", 2)), "Head")
        part(smooth(ph.ellipsoid(f"Eye {side} | black lens",
                    (sign * .316, -.795, .73), (.045, .105, .093), "eye", 2)), "Head")
        part(smooth(ph.ellipsoid(f"Eye {side} | white glint",
                    (sign * .348, -.827, .774), (.013, .024, .029), "glint", 1)), "Head")
        antenna = [(sign * .125, -.98, .80), (sign * .17, -1.11, .91),
                   (sign * .20, -1.24, .88), (sign * .21, -1.29, .83)]
        part(ph.tube(f"Antenna {side} | curved feeler", antenna,
                     [.027, .024, .017, .006], sides=8, color="ink"), f"Antenna.{side}")
        part(ph.tube(f"Mouth {side} | short dark palp", [
            (sign * .10, -1.03, .51), (sign * .15, -1.15, .46),
            (sign * .12, -1.19, .42)], [.037, .028, .005], sides=8,
            color="ink"), "Head")

    abdomen = ph.shell("Abdomen | striped tapered gaster", [
        (.16, .59, .13, .15), (.31, .57, .26, .25),
        (.53, .54, .34, .29), (.77, .51, .32, .26),
        (1.00, .47, .25, .21), (1.17, .43, .13, .13),
        (1.23, .41, .025, .035),
    ], sides=12, smooth=True)
    def abdomen_color(p, n):
        stripe = (math.sin((p.y - .32) * math.pi * 6.1) + 1) / 2
        stripe = stripe * stripe * (3 - 2 * stripe)
        base = blend(dark, amber, .12 + .69 * stripe)
        base = blend(base, black, .34 * max(0, -n.z))
        return blend(base, amber, .16 * max(0, n.z))
    paint(abdomen, abdomen_color)
    part(abdomen, "Abdomen")
    part(smooth(ph.ellipsoid("Abdomen | dark terminal plate", (0, 1.17, .40),
                            (.145, .09, .125), "abdomen_dark", 2)), "Abdomen")
    part(ph.tube("Stinger | curved black barb", [(0, 1.16, .39),
                   (0, 1.28, .34), (0, 1.43, .25), (0, 1.54, .18)],
                 [.073, .059, .037, .003], sides=10, color="stinger"), "Stinger")

    for side in ("L", "R"):
        for kind in ("hind", "fore"):
            wing(side, kind)
    for sign, side in [(-1, "L"), (1, "R")]:
        for number, raw in enumerate([
            [(.25, -.29, .49), (.41, -.48, .31), (.51, -.72, .12)],
            [(.32, .04, .43), (.50, -.02, .24), (.56, -.07, .09)],
            [(.27, .35, .42), (.47, .55, .22), (.54, .84, .10)],
        ], 1):
            points = [Vector((sign * x, y, z)) for x, y, z in raw]
            name = f"{side}{number}"
            LEG_POINTS[name] = points
            hip, knee, toe = points
            midpoint = hip.lerp(knee, .53) + Vector((sign * .025, 0, 0))
            part(ph.tube(f"Leg {name} | upper", [hip, midpoint, knee],
                         [.058, .047, .035], sides=8, color="joint"), f"Leg.{name}.upper")
            part(ph.tube(f"Leg {name} | lower", [knee, knee.lerp(toe, .55), toe],
                         [.036, .025, .009], sides=8, color="joint"), f"Leg.{name}.lower")
            part(smooth(ph.ellipsoid(f"Leg {name} | knee", knee,
                        (.045, .045, .045), "edge", 1)), f"Leg.{name}.upper")
            part(smooth(ph.ellipsoid(f"Leg {name} | hip", hip,
                        (.060, .062, .060), "edge", 1)), "Body")


def rotate_world_axis(bone, xyz, angle):
    local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(xyz)
    bone.rotation_quaternion = Quaternion(local_axis, angle)


def rig_model(objects, transform):
    specs = {
        "Root": ((0, 0, 0), (0, 0, .2), None),
        "Body": ((0, -.06, .61), (0, .15, .66), "Root"),
        "Head": ((0, -.43, .67), (0, -.84, .68), "Body"),
        "Abdomen": ((0, .20, .60), (0, .96, .48), "Body"),
        "Stinger": ((0, 1.16, .39), (0, 1.48, .22), "Abdomen"),
    }
    for (side, kind), (root, tip) in WING_POINTS.items():
        specs[f"Wing.{side}.{kind}"] = (root, tip, "Body")
    for name, points in LEG_POINTS.items():
        hip, knee, toe = points
        specs[f"Leg.{name}.upper"] = (hip, knee, "Body")
        specs[f"Leg.{name}.lower"] = (knee, toe, f"Leg.{name}.upper")
    for sign, side in [(-1, "L"), (1, "R")]:
        specs[f"Antenna.{side}"] = ((sign * .125, -.98, .80),
                                      (sign * .20, -1.24, .88), "Head")
    rig = create_rig("Killer bee | deform rig", specs, transform)
    for obj in objects:
        bind(obj, rig, PART_BONES[obj.name])
    animate(rig, transform)
    return rig


def animate(rig, transform):
    scene = bpy.context.scene
    scene.render.fps = 30
    rig.animation_data_create()
    scale = transform.to_scale().x
    for name, frames, cycles in (("Idle", 61, 16), ("Walk", 31, 10), ("Attack", 16, 4)):
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame in range(frames):
            scene.frame_set(frame)
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
            t = frame / (frames - 1)
            phase = math.tau * cycles * t
            strike = envelope(t, [(0, 0), (1 / 15, .55), (4 / 15, 1),
                                  (5 / 15, .94), (8 / 15, .35), (13 / 15, 0), (1, 0)]) if name == "Attack" else 0
            thrust = envelope(t, [(0, 0), (2 / 15, 0), (3 / 15, .46),
                                  (4 / 15, 1), (5 / 15, .84), (9 / 15, 0), (1, 0)]) if name == "Attack" else 0
            bob = (.045 * math.sin(math.tau * 2 * t) if name == "Idle" else
                   .065 * math.sin(math.tau * 2 * t) if name == "Walk" else .76 * strike)
            forward = (.022 * math.sin(math.tau * t) if name == "Walk" else 0) - .62 * strike
            body = rig.pose.bones["Body"]
            body.matrix = Matrix.Translation(Vector((0, forward, bob)) * scale) @ body.bone.matrix_local
            bpy.context.view_layer.update()
            rotate_world_axis(rig.pose.bones["Head"], (1, 0, 0), -.16 * strike + .025 * math.sin(math.tau * t))
            rotate_world_axis(rig.pose.bones["Abdomen"], (1, 0, 0),
                              -2.15 * strike + .035 * math.sin(math.tau * t))
            rotate_world_axis(rig.pose.bones["Stinger"], (1, 0, 0), -.43 * thrust)
            for side, sign in (("L", -1), ("R", 1)):
                for kind in ("fore", "hind"):
                    offset = .15 if kind == "hind" else 0
                    amplitude = (.42 if name == "Walk" else .33) + .14 * strike
                    rotate_world_axis(rig.pose.bones[f"Wing.{side}.{kind}"],
                                      (0, 1, 0), sign * amplitude * math.sin(phase - offset))
                rotate_world_axis(rig.pose.bones[f"Antenna.{side}"], (1, 0, 0),
                                  .055 * math.sin(math.tau * t + (0 if side == "L" else .7)) + .12 * strike)
                for number in (1, 2, 3):
                    upper = rig.pose.bones[f"Leg.{side}{number}.upper"]
                    lower = rig.pose.bones[f"Leg.{side}{number}.lower"]
                    leg_phase = math.tau * t + (number - 1) * 1.1 + (0 if side == "L" else math.pi)
                    rotate_world_axis(upper, (1, 0, 0),
                                      .09 * math.sin(leg_phase) - .35 * strike)
                    rotate_world_axis(lower, (1, 0, 0),
                                      .11 * math.sin(leg_phase + .5) + .25 * strike)
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
