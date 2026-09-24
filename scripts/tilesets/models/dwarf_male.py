"""PixelHack tile 92: an armored male dwarf with horned helm and war pick."""

import math

import bpy
from mathutils import Matrix, Quaternion, Vector

import pixelhack_blender as ph
from pixelhack_face import blink_lids
from pixelhack_rig import bind, create_rig, envelope, set_bone_segment, solve_knee


PART_BONES = {}
LEG_POINTS = {}


def part(obj, bone):
    PART_BONES[obj.name] = bone
    return obj


def rounded(obj):
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


def loft_z(name, rings, color, sides=16):
    """Closed oval loft: (height, depth center, x radius, depth radius)."""
    vertices = []
    for z, y, rx, ry in rings:
        for index in range(sides):
            angle = math.tau * index / sides
            vertices.append((rx * math.cos(angle), y + ry * math.sin(angle), z))
    faces = [tuple(range(sides - 1, -1, -1))]
    for row in range(len(rings) - 1):
        for index in range(sides):
            a = row * sides + index
            b = row * sides + (index + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(rings) - 1) * sides + i for i in range(sides)))
    return rounded(ph.mesh(name, vertices, faces, color))


def beard_mesh():
    """An oval, tapering beard that remains distinct from the face and tunic."""
    rings = [
        (1.71, -.32, .15, .105),
        (1.65, -.36, .28, .155),
        (1.52, -.39, .30, .16),
        (1.39, -.40, .25, .13),
        (1.23, -.39, .19, .115),
        (1.10, -.38, .075, .06),
    ]
    obj = loft_z("Beard | broad ivory shape", rings, "beard")
    pale = ph.linear(ph.PALETTE["beard_light"])
    gray = ph.linear(ph.PALETTE["beard_shadow"])
    paint(obj, lambda p, n: blend(gray, pale, .30 + .43 * max(0, -n.y) + .13 * max(0, n.z)))
    return part(obj, "Head")


def pick_point(x, y, z):
    """Turn the mattock across the haft so its long pointed end faces -Y."""
    angle = math.radians(62)
    dx, dy = x + 1.04, y + .29
    return (-1.04 + math.cos(angle) * dx - math.sin(angle) * dy,
            -.29 + math.sin(angle) * dx + math.cos(angle) * dy, z)


def pick_blade():
    """A thin closed mattock blade with a broad upper arc and two hooked ends."""
    outline = [
        (-1.55, 1.55), (-1.51, 1.71), (-1.35, 1.84),
        (-1.10, 1.89), (-.89, 1.86), (-.70, 1.80),
        (-.62, 1.72), (-.73, 1.70), (-.92, 1.77),
        (-1.10, 1.78), (-1.32, 1.70),
    ]
    count = len(outline)
    vertices = [pick_point(x, -.365, z) for x, z in outline]
    vertices += [pick_point(x, -.255, z) for x, z in outline]
    faces = [tuple(range(count - 1, -1, -1)),
             tuple(count + i for i in range(count))]
    for i in range(count):
        next_i = (i + 1) % count
        faces.append((i, next_i, count + next_i, count + i))
    obj = ph.mesh("Pick | broad curved steel head", vertices, faces, "blade")
    dark = ph.linear(ph.PALETTE["blade"])
    light = ph.linear(ph.PALETTE["blade_light"])
    paint(obj, lambda p, n: blend(dark, light,
                                  .10 + .35 * max(0, (p.z - 1.72) / .18)))
    part(obj, "Weapon")
    edge = [
        (-1.51, -.38, 1.71), (-1.35, -.38, 1.84),
        (-1.10, -.38, 1.89), (-.89, -.38, 1.86),
        (-.70, -.38, 1.80), (-.62, -.38, 1.72)]
    part(ph.tube("Pick | bright sharpened upper edge", [pick_point(*p) for p in edge],
        [.006, .013, .015, .014, .011, .003], sides=7,
        color="blade_light"), "Weapon")


def build():
    ph.VIEWS["hero"] = (2.5, -5, 2.8)
    ph.PALETTE.clear()
    ph.PALETTE.update({
        "ink": "211d25", "shell": "ba3c2d", "skin": "d8bc96", "skin_shadow": "9d795f",
        "eye": "29252a", "beard": "c9cabb", "beard_light": "f0ecd5",
        "beard_shadow": "929da0", "beard_mid": "d8d8c7",
        "helm": "526776", "helm_dark": "283948",
        "helm_light": "a8b8b3", "horn": "536373", "tunic": "ba3c2d",
        "tunic_light": "ef7044", "tunic_dark": "6e211d", "trim": "f2ad37",
        "pants": "4f241b", "boot": "704018", "boot_light": "b97739",
        "sole": "42300f", "wood": "6f3820", "wood_light": "a56b3a",
        "blade": "415968", "blade_light": "91a9a5", "shield": "bb3d2e",
        "shield_edge": "6d291e", "shield_highlight": "ef7646",
    })

    torso = loft_z("Tunic | tailored stocky torso", [
        (.65, .08, .43, .25), (.76, .09, .53, .33),
        (.93, .07, .47, .31), (1.14, .06, .48, .32),
        (1.36, .04, .53, .31), (1.49, .03, .39, .25),
        (1.58, .02, .21, .19),
    ], "tunic", sides=20)
    red = ph.linear(ph.PALETTE["tunic"])
    red_light = ph.linear(ph.PALETTE["tunic_light"])
    red_dark = ph.linear(ph.PALETTE["tunic_dark"])
    paint(torso, lambda p, n: blend(blend(red_dark, red, .72 + .22 * max(0, n.z)),
                                     red_light, .26 * max(0, -n.y)))
    part(torso, "Body")
    part(loft_z("Tunic | red flared lower panels", [
        (.69, .07, .49, .31), (.76, .08, .54, .34),
        (.85, .08, .49, .31), (.93, .08, .45, .30),
    ], "tunic_dark"), "Body")
    part(rounded(ph.ellipsoid("Belt | dark leather", (0, -.005, .86),
                              (.53, .345, .075), "wood", 2)), "Body")
    part(rounded(ph.ellipsoid("Belt | brass buckle", (0, -.35, .88),
                              (.10, .027, .075), "trim", 1)), "Body")
    part(rounded(ph.ellipsoid("Collar | dark opening", (0, -.03, 1.52),
                              (.37, .27, .105), "tunic_dark", 2)), "Body")
    part(ph.tube("Tunic | golden collar seam", [(-.35, -.25, 1.47),
                 (-.21, -.34, 1.49), (0, -.36, 1.51),
                 (.21, -.34, 1.49), (.35, -.25, 1.47)],
                 [.015] * 5, sides=7, color="trim"), "Body")
    for sign, side in ((-1, "L"), (1, "R")):
        part(ph.tube(f"Tunic {side} | folded hem seam", [
            (sign * .09, -.29, .76), (sign * .29, -.27, .73),
            (sign * .46, -.22, .76)], [.012, .017, .012], sides=7,
            color="tunic"), "Body")
    for sign, side in ((-1, "L"), (1, "R")):
        part(rounded(ph.ellipsoid(f"Shoulder {side} | red padded cap",
                       (sign * .46, -.03, 1.38), (.22, .28, .22), "tunic_dark", 2)), "Body")
        part(rounded(ph.ellipsoid(f"Shoulder {side} | orange upper fold",
                       (sign * .48, -.18, 1.42), (.16, .14, .10), "tunic", 1)), "Body")
        part(ph.tube(f"Shoulder {side} | raised leather seam", [
            (sign * .31, -.18, 1.51), (sign * .45, -.26, 1.47),
            (sign * .59, -.20, 1.39)], [.018, .023, .013], sides=7,
            color="tunic_light"), "Body")

    # Only a sliver of warm face shows under the oversized helmet and beard.
    part(rounded(ph.ellipsoid("Head | ruddy face", (0, -.09, 1.70),
                              (.35, .30, .32), "skin_shadow", 2)), "Head")
    part(rounded(ph.ellipsoid("Face | nose", (0, -.41, 1.70),
                              (.085, .13, .105), "skin", 1)), "Head")
    for sign, side in ((-1, "L"), (1, "R")):
        socket=part(rounded(ph.ellipsoid(f"Eye {side} | warm socket",
                     (sign * .15, -.392, 1.78), (.064, .021, .033), "skin", 1)), "Head")
        pupil=part(rounded(ph.ellipsoid(f"Eye {side} | dark pupil",
                     (sign * .15, -.417, 1.78), (.018, .014, .018), "eye", 1)), "Head")
        for lid in blink_lids(f'Eyelid {side}',(sign*.15,-.417,1.78),(.018,.014,.018),'skin',
                              eye=pupil,socket=socket):
            part(lid,'Head')
        part(ph.tube(f"Brow {side} | stern ridge", [
            (sign * .065, -.414, 1.818), (sign * .155, -.425, 1.827),
            (sign * .255, -.394, 1.84)], [.025, .03, .014], sides=8,
            color="skin_shadow"), "Head")
    beard_mesh()
    for sign, side in ((-1, "L"), (1, "R")):
        part(ph.tube(f"Beard {side} | pale side lock", [
            (sign * .22, -.39, 1.65), (sign * .27, -.45, 1.49),
            (sign * .20, -.48, 1.29), (sign * .13, -.43, 1.16)],
            [.075, .074, .056, .008], sides=9, color="beard_light"), "Head")
        part(ph.tube(f"Moustache {side} | curled over beard", [
            (sign * .035, -.44, 1.655), (sign * .13, -.515, 1.625),
            (sign * .25, -.52, 1.605), (sign * .31, -.47, 1.65)],
            [.038, .059, .047, .007], sides=10, color="beard_mid"), "Head")
        part(ph.tube(f"Beard {side} | combed front ridge", [
            (sign * .105, -.54, 1.55), (sign * .155, -.56, 1.42),
            (sign * .13, -.52, 1.27), (sign * .085, -.45, 1.15)],
            [.032, .037, .029, .006], sides=8, color="beard_light"), "Head")
    part(ph.tube("Beard | central combed ridge", [(0, -.55, 1.55),
                 (0, -.575, 1.42), (0, -.53, 1.25), (0, -.46, 1.12)],
                 [.032, .039, .032, .005], sides=8, color="beard_mid"), "Head")
    part(rounded(ph.ellipsoid("Helmet | blue gray dome", (0, -.015, 1.94),
                              (.49, .37, .29), "helm", 2)), "Head")
    part(rounded(ph.ellipsoid("Helmet | dark rolled brow", (0, -.235, 1.88),
                              (.52, .15, .075), "helm_dark", 2)), "Head")
    part(ph.tube("Helmet | dark raised brow trim", [
        (-.47, -.26, 1.87), (-.30, -.36, 1.88),
        (0, -.40, 1.88), (.30, -.36, 1.88), (.47, -.26, 1.87)],
        [.025] * 5, sides=9, color="helm"), "Head")
    part(ph.tube("Helmet | pale central ridge", [(0, -.34, 1.79),
                 (0, -.35, 1.93), (0, -.22, 2.17)],
                 [.045, .056, .01], sides=8, color="helm_light"), "Head")
    for sign, side in ((-1, "L"), (1, "R")):
        part(ph.tube(f"Helmet horn {side} | outward hooked tip", [
            (sign * .39, -.10, 1.95), (sign * .53, -.08, 2.05),
            (sign * .70, -.02, 2.14), (sign * .78, .02, 2.28)],
            [.13, .10, .06, .005], sides=10, color="horn"), "Head")
        part(rounded(ph.ellipsoid(f"Helmet horn {side} | collar",
                     (sign * .43, -.10, 1.96), (.14, .12, .11), "helm_dark", 1)), "Head")
        part(ph.tube(f"Helmet {side} | cheek plate", [
            (sign * .40, -.23, 1.87), (sign * .40, -.28, 1.74),
            (sign * .34, -.25, 1.62)], [.095, .075, .014], sides=9,
            color="helm"), "Head")
        part(rounded(ph.ellipsoid(f"Helmet {side} | brass rivet",
                     (sign * .43, -.31, 1.85), (.034, .023, .034),
                     "trim", 1)), "Head")

    arms = {
        "L": ((-.44, -.05, 1.38), (-.69, -.18, 1.17), (-.80, -.34, 1.04)),
        "R": ((.44, -.05, 1.38), (.71, -.17, 1.16), (.56, -.38, 1.04)),
    }
    for side, (shoulder, elbow, hand) in arms.items():
        part(ph.tube(f"Arm {side} | upper red sleeve", [shoulder,
                     Vector(shoulder).lerp(Vector(elbow), .6), elbow],
                     [.17, .16, .12], sides=12, color="tunic"), f"Arm.{side}.upper")
        part(rounded(ph.ellipsoid(f"Arm {side} | elbow guard", elbow,
                     (.14, .13, .14), "tunic_dark", 1)), f"Arm.{side}.upper")
        part(ph.tube(f"Arm {side} | leather forearm", [elbow, hand],
                     [.13, .12], sides=12, color="boot_light"), f"Arm.{side}.lower")
        part(rounded(ph.ellipsoid(f"Hand {side} | leather glove", hand,
                     (.13, .13, .12), "wood", 1)), f"Arm.{side}.lower")
    for index in range(3):
        height = 1.08 - .036 * index
        part(ph.tube(f"Left glove | gripping finger {index + 1}", [
            (-.72, -.42, height), (-.79, -.47, height + .01),
            (-.86, -.42, height + .02)], [.026, .025, .014], sides=7,
            color="wood_light"), "Arm.L.lower")
    part(ph.tube("Left glove | thumb on haft", [(-.73, -.36, .99),
                 (-.80, -.44, 1.04), (-.86, -.40, 1.08)],
                 [.035, .032, .009], sides=8, color="wood"), "Arm.L.lower")

    # The sprite's upturned steel crescent and diagonal shaft read as a war pick.
    part(ph.tube("Pick | wooden diagonal haft", [(-.79, -.34, .96),
                 (-.90, -.33, 1.30), (-1.04, -.29, 1.75)],
                 [.055, .05, .037], sides=10, color="wood"), "Weapon")
    part(ph.tube("Pick | copper grip band", [(-.87, -.33, 1.19),
                 (-.90, -.33, 1.28)], [.061, .061], sides=10,
                 color="wood_light"), "Weapon")
    pick_blade()
    part(rounded(ph.ellipsoid("Pick | forged eye at haft", (-1.04, -.29, 1.77),
                              (.085, .085, .12), "blade", 1)), "Weapon")

    shield = rounded(ph.ellipsoid("Shield | broad red buckler",
                                  (.56, -.51, 1.08), (.40, .105, .49), "shield", 2))
    shield_base = ph.linear(ph.PALETTE["shield"])
    shield_bright = ph.linear(ph.PALETTE["shield_highlight"])
    shield_dark = ph.linear(ph.PALETTE["shield_edge"])
    paint(shield, lambda p, n: blend(blend(shield_dark, shield_base, .70 +
                                           .24 * max(0, -n.y)), shield_bright,
                                     .12 + .20 * max(0, (p.z - .85) / .7)))
    part(shield, "Shield")
    part(ph.tube("Shield | dark closed rim", [
        (.56 + .385 * math.cos(math.tau * i / 24), -.53,
         1.08 + .475 * math.sin(math.tau * i / 24)) for i in range(25)],
        [.034] * 25, sides=7, color="shield_edge"), "Shield")
    part(ph.tube("Shield | bright curled highlight", [
        (.47, -.625, .72), (.66, -.635, .77), (.81, -.63, .94),
        (.83, -.625, 1.18), (.72, -.62, 1.34)],
        [.037, .045, .049, .045, .006], sides=9,
        color="shield_highlight"), "Shield")
    part(rounded(ph.ellipsoid("Shield | brass central boss", (.55, -.628, 1.14),
                              (.085, .04, .08), "trim", 1)), "Shield")
    for x, z in ((.56, 1.49), (.56, .67), (.25, 1.08), (.87, 1.08)):
        part(rounded(ph.ellipsoid(f"Shield rivet | {x:.2f} {z:.2f}",
                     (x, -.575, z), (.025, .015, .025), "trim", 1)), "Shield")

    for sign, side in ((-1, "L"), (1, "R")):
        hip = (sign * .30, .065, .88)
        knee = (sign * .42, -.34, .49)
        ankle = (sign * .34, -.07, .18)
        toe = (sign * .34, -.36, .12)
        LEG_POINTS[side] = (hip, knee, ankle, toe)
        part(ph.tube(f"Leg {side} | broad dark trouser", [hip,
                     Vector(hip).lerp(Vector(knee), .45), knee],
                     [.23, .245, .18], sides=12, color="pants"), f"Leg.{side}.upper")
        part(rounded(ph.ellipsoid(f"Leg {side} | round knee", knee,
                     (.19, .18, .15), "pants", 1)), f"Leg.{side}.upper")
        part(ph.tube(f"Leg {side} | leather shin", [knee, ankle],
                     [.19, .16], sides=12, color="boot",), f"Leg.{side}.lower")
        part(rounded(ph.ellipsoid(f"Leg {side} | leather knee guard",
                     (sign * .42, -.45, .49), (.16, .055, .125),
                     "boot_light", 1)), f"Leg.{side}.upper")
        part(ph.tube(f"Boot {side} | cuff seam", [
            (sign * .19, -.24, .31), (sign * .34, -.275, .32),
            (sign * .49, -.24, .31)], [.018, .022, .018], sides=7,
            color="boot_light"), f"Leg.{side}.lower")
        boot = ph.shell(f"Boot {side} | shaped leather toe", [
            (.045, .13, .14, .09), (-.10, .13, .20, .115),
            (-.28, .115, .23, .11), (-.43, .095, .18, .075),
            (-.49, .09, .06, .045)], sides=10, color="boot", smooth=True)
        for vertex in boot.data.vertices:
            vertex.co.x += sign * .34
        boot.data.update()
        part(boot, f"Foot.{side}")
        part(rounded(ph.ellipsoid(f"Boot {side} | ochre toe cap",
                     (sign * .34, -.39, .125), (.17, .10, .038),
                     "boot_light", 1)), f"Foot.{side}")
        part(rounded(ph.ellipsoid(f"Boot {side} | dark sole", (sign * .34, -.23, .035),
                     (.24, .27, .035), "sole", 1)), f"Foot.{side}")


def rotate_world_axis(bone, xyz, angle):
    local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(xyz)
    bone.rotation_quaternion = Quaternion(local_axis, angle)


def rig_model(objects, transform):
    specs = {
        "Root": ((0, 0, .05), (0, 0, .28), None),
        "Body": ((0, .06, .88), (0, .06, 1.31), "Root"),
        "Head": ((0, -.08, 1.54), (0, -.08, 1.91), "Body"),
    }
    arms = {
        "L": ((-.44, -.05, 1.38), (-.69, -.18, 1.17), (-.80, -.34, 1.04)),
        "R": ((.44, -.05, 1.38), (.71, -.17, 1.16), (.56, -.38, 1.04)),
    }
    for side, (shoulder, elbow, hand) in arms.items():
        specs[f"Arm.{side}.upper"] = (shoulder, elbow, "Body")
        specs[f"Arm.{side}.lower"] = (elbow, hand, f"Arm.{side}.upper")
    specs["Weapon"] = (arms["L"][2], (-1.04, -.29, 1.75), "Arm.L.lower")
    specs["Shield"] = (arms["R"][2], (.56, -.51, 1.08), "Arm.R.lower")
    for side, (hip, knee, ankle, toe) in LEG_POINTS.items():
        specs[f"Leg.{side}.upper"] = (hip, knee, "Body")
        specs[f"Leg.{side}.lower"] = (knee, ankle, f"Leg.{side}.upper")
        specs[f"Foot.{side}"] = (ankle, toe, f"Leg.{side}.lower")
    rig = create_rig("Dwarf male | deform rig", specs, transform)
    for obj in objects:
        bind(obj, rig, PART_BONES[obj.name])
    animate(rig, transform)
    return rig


def animate(rig, transform):
    scene = bpy.context.scene
    scene.render.fps = 60
    rig.animation_data_create()
    scale = transform.to_scale().x
    for name, frames in (("Idle", 121), ("Walk", 31), ("Attack", 31)):
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame in range(frames):
            scene.frame_set(frame)
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
            t = frame / (frames - 1)
            phase = math.tau * t
            strike = envelope(t, [(0, 0), (1 / 30, .22), (5 / 30, .8),
                                  (8 / 30, 1), (10 / 30, .86),
                                  (18 / 30, .22), (25 / 30, 0), (1, 0)]) if name == "Attack" else 0
            chop = envelope(t, [(0, 0), (1 / 30, .22), (4 / 30, .42),
                                (8 / 30, 1.02), (10 / 30, .90),
                                (20 / 30, .08), (1, 0)]) if name == "Attack" else 0
            weapon_snap = envelope(t, [(0, 0), (2 / 30, .03), (5 / 30, .10), (8 / 30, .45),
                                       (10 / 30, .32), (18 / 30, 0), (1, 0)]) if name == "Attack" else 0
            forward = (-.16 * strike if name == "Attack" else 0)
            bob = (.018 * math.sin(phase) if name == "Idle" else
                   .018 * (1 - math.cos(phase * 2)) if name == "Walk" else .026 * strike)
            body_offset = Vector((0, forward, bob)) * scale
            body = rig.pose.bones["Body"]
            body.matrix = Matrix.Translation(body_offset) @ body.bone.matrix_local
            bpy.context.view_layer.update()
            rotate_world_axis(rig.pose.bones["Head"], (1, 0, 0),
                              .025 * math.sin(phase) + .12 * strike)
            rotate_world_axis(rig.pose.bones["Arm.L.upper"], (1, 0, 0),
                              chop + (.14 * math.sin(phase) if name == "Walk" else 0))
            rotate_world_axis(rig.pose.bones["Arm.L.lower"], (1, 0, 0),
                              .10 * chop)
            rotate_world_axis(rig.pose.bones["Weapon"], (1, 0, 0), weapon_snap)
            rotate_world_axis(rig.pose.bones["Arm.R.upper"], (1, 0, 0),
                              -.24 * strike + (-.14 * math.sin(phase) if name == "Walk" else 0))
            rotate_world_axis(rig.pose.bones["Shield"], (0, 0, 1), .11 * strike)
            bpy.context.view_layer.update()
            for side, raw in LEG_POINTS.items():
                hip0, knee0, ankle0, toe0 = [transform @ Vector(p) for p in raw]
                hip = hip0 + body_offset
                ankle = ankle0.copy()
                toe_offset = toe0 - ankle0
                if name == "Walk":
                    cycle = (t + (0 if side == "L" else .5)) % 1
                    if cycle < .5:
                        # A planted boot travels rearward relative to forward (-Y) travel.
                        ankle.y += (-.52 + 2.08 * cycle) * scale
                    else:
                        swing = (cycle - .5) * 2
                        ankle.y += (.52 - 1.04 * swing) * scale
                        ankle.z += .21 * math.sin(math.pi * swing) ** 2 * scale
                upper = (knee0 - hip0).length
                lower = (ankle0 - knee0).length
                knee = solve_knee(hip, ankle, knee0, upper, lower)
                set_bone_segment(rig, f"Leg.{side}.upper", hip, knee)
                set_bone_segment(rig, f"Leg.{side}.lower", knee, ankle)
                set_bone_segment(rig, f"Foot.{side}", ankle, ankle + toe_offset)
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
