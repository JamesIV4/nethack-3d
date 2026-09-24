"""PixelHack tile 141: an icy water nymph with a jeweled halter and flowing hair.

The tile supplies her aqua palette and flowing motion. The face, curls, halter,
water markings, hip wrap, and bare feet are an artistic interpretation informed
by the user's water-nymph reference image. The unseen back is inferred.
"""

import math

import bpy
from mathutils import Matrix, Quaternion, Vector

import pixelhack_blender as ph
from pixelhack_rig import bind, create_rig, envelope, set_bone_segment, solve_knee


PART_BONES = {}
ARM_POINTS = {}
LEG_POINTS = {}


def part(obj, bone):
    PART_BONES[obj.name] = bone
    return obj


def rounded(obj):
    return ph.smooth_surface(obj)


def blend(a, b, amount):
    amount = max(0, min(1, amount))
    return tuple(a[i] * (1 - amount) + b[i] * amount for i in range(4))


def paint(obj, shade):
    colors = obj.data.color_attributes["Palette"]
    for loop in obj.data.loops:
        vertex = obj.data.vertices[loop.vertex_index]
        colors.data[loop.index].color = shade(vertex.co, vertex.normal)
    return obj


def loft(name, rings, color, sides=20):
    """Closed oval loft with (z, x center, y center, x radius, y radius)."""
    vertices = []
    for z, x, y, rx, ry in rings:
        for index in range(sides):
            angle = math.tau * index / sides
            vertices.append((x + rx * math.cos(angle), y + ry * math.sin(angle), z))
    faces = [tuple(range(sides - 1, -1, -1))]
    for row in range(len(rings) - 1):
        for index in range(sides):
            a = row * sides + index
            b = row * sides + (index + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(rings) - 1) * sides + i for i in range(sides)))
    return rounded(ph.mesh(name, vertices, faces, color))


def ribbon(name, controls, color, thickness=.018):
    """Closed flowing strip, with (x, y, z, width) control sections."""
    controls = [Vector(section) for section in controls]
    sections = []
    for index in range(len(controls) - 1):
        a, b = controls[index], controls[index + 1]
        before = controls[index - 1] if index else 2 * a - b
        after = controls[index + 2] if index + 2 < len(controls) else 2 * b - a
        for step in range(4):
            t = step / 4
            sections.append(.5 * ((2 * a) + (-before + b) * t +
                            (2 * before - 5 * a + 4 * b - after) * t * t +
                            (-before + 3 * a - 3 * b + after) * t * t * t))
    sections.append(controls[-1])
    vertices = []
    for index, section in enumerate(sections):
        before = sections[max(0, index - 1)]
        after = sections[min(len(sections) - 1, index + 1)]
        tangent = Vector((after.x - before.x, after.z - before.z))
        tangent.normalize()
        normal = Vector((tangent.y, -tangent.x))
        half = max(.003, section.w / 2)
        for depth in (0, thickness):
            for sign in (-1, 1):
                vertices.append((section.x + normal.x * half * sign,
                                 section.y + depth,
                                 section.z + normal.y * half * sign))
    faces = []
    for index in range(len(sections) - 1):
        a, b = index * 4, (index + 1) * 4
        faces.extend(((a, b, b + 1, a + 1), (a + 2, a + 3, b + 3, b + 2),
                      (a, a + 2, b + 2, b), (a + 1, b + 1, b + 3, a + 3)))
    faces.extend(((0, 1, 3, 2),
                  tuple(4 * (len(sections) - 1) + i for i in (0, 2, 3, 1))))
    return rounded(ph.mesh(name, vertices, faces, color))


def curl(name, controls, radii, color, bone, sides=11):
    """A smooth capped lock of hair or water mark, tapered through its bend."""
    controls = [Vector(point) for point in controls]
    points = []
    widths = []
    for index in range(len(controls) - 1):
        a, b = controls[index], controls[index + 1]
        before = controls[index - 1] if index else 2 * a - b
        after = controls[index + 2] if index + 2 < len(controls) else 2 * b - a
        for step in range(3):
            t = step / 3
            points.append(.5 * ((2 * a) + (-before + b) * t +
                          (2 * before - 5 * a + 4 * b - after) * t * t +
                          (-before + 3 * a - 3 * b + after) * t * t * t))
            widths.append(radii[index] * (1 - t) + radii[index + 1] * t)
    points.append(controls[-1])
    widths.append(radii[-1])
    flatness = .70 if bone.startswith("Hair.") else 1
    return part(ph.swept_ellipse(name, points, widths,
                [max(.003, width * flatness) for width in widths],
                sides=sides, color=color), bone)


def clamp01(value):
    return max(0, min(1, value))


def distance_to_segment(point, start, end):
    start, end = Vector(start), Vector(end)
    along = clamp01((point - start).dot(end - start) / (end - start).length_squared)
    return (point - start.lerp(end, along)).length


def skin_weights(point):
    """Weights for the voxel-fused body; keep shoulder and hip joins flexible."""
    point = Vector(point)
    for side, (shoulder, elbow, hand) in ARM_POINTS.items():
        upper = distance_to_segment(point, shoulder, elbow)
        lower = distance_to_segment(point, elbow, hand)
        if min(upper, lower) < .115 and (abs(point.x) > .18 or point.y < -.14):
            amount = clamp01((abs(point.x) - .17) / .10)
            if point.y < -.16:
                amount = max(amount, clamp01((-point.y - .13) / .09))
            upper_share = clamp01(.5 + (lower - upper) / .12)
            result = {f"Arm.{side}.upper": amount * upper_share,
                      f"Arm.{side}.lower": amount * (1 - upper_share),
                      "Body": 1 - amount}
            return {bone: value for bone, value in result.items() if value > .0001}
    if point.z < 1.12 and abs(point.x) > .075:
        side = "L" if point.x < 0 else "R"
        if point.z < .16:
            return {f"Foot.{side}": 1}
        if point.z < .24:
            foot = 1 - clamp01((point.z - .16) / .08)
            return {f"Foot.{side}": foot, f"Leg.{side}.lower": 1 - foot}
        if point.z < .53:
            return {f"Leg.{side}.lower": 1}
        if point.z < .64:
            upper = clamp01((point.z - .53) / .11)
            return {f"Leg.{side}.lower": 1 - upper, f"Leg.{side}.upper": upper}
        if point.z < .98:
            return {f"Leg.{side}.upper": 1}
        upper = 1 - clamp01((point.z - .98) / .14)
        return {f"Leg.{side}.upper": upper, "Body": 1 - upper}
    return {"Body": 1}


def skin_color(point, normal, shadow, skin, highlight, marking):
    base = blend(blend(shadow, skin, .82), highlight,
                 .18 + .25 * max(0, -normal.y))
    if .22 < point.z < .92 and abs(point.x) > .19 and normal.y < -.35:
        side = -1 if point.x < 0 else 1
        wave = side * (.29 + .045 * math.sin(point.z * 12.5))
        trace = clamp01((.037 - abs(point.x - wave)) / .023)
        return blend(base, marking, .72 * trace)
    return base


def build():
    PART_BONES.clear()
    ARM_POINTS.clear()
    LEG_POINTS.clear()
    ph.VIEWS["hero"] = (2.1, -5, 1.9)
    ph.PALETTE.clear()
    ph.PALETTE.update({
        "shell": "a9e1f4", "ink": "264b77",
        "skin_shadow": "729ac5", "skin": "a8d6f0", "skin_light": "d8f0fa",
        "mark": "e9ffff", "socket": "6576a0", "sclera": "e2eefa",
        "iris": "95a9d0", "pupil": "293f70", "lip": "8296b7",
        "hair_shadow": "278bb7", "hair": "64c8e6",
        "hair_light": "b1f0fa", "hair_glint": "d7fbff",
        "cloth_dark": "1b7097", "cloth": "38a8ce",
        "cloth_light": "77d9ec", "cloth_glint": "b4f2f6",
        "gem_dark": "276a92", "gem": "a6eaf6",
    })

    # The exposed torso and tapered waist establish the figure before costume.
    body = loft("Body | sculpted icy skin", [
        (1.00, 0, .035, .18, .13), (1.12, 0, .025, .14, .115),
        (1.28, 0, .015, .15, .125), (1.40, 0, 0, .185, .14),
        (1.52, 0, 0, .205, .15), (1.59, 0, .005, .205, .13),
        (1.64, 0, .005, .09, .08),
    ], "skin")
    light = ph.linear(ph.PALETTE["skin_light"])
    blue = ph.linear(ph.PALETTE["skin"])
    shade = ph.linear(ph.PALETTE["skin_shadow"])
    paint(body, lambda p, n: blend(blend(shade, blue, .83), light,
                                   .17 + .25 * max(0, -n.y) + .06 * max(0, n.z)))
    part(body, "Body")
    for sign, side in ((-1, "L"), (1, "R")):
        part(rounded(ph.ellipsoid(f"Chest {side} | soft natural contour",
             (sign * .094, -.105, 1.435), (.099, .077, .091),
             "skin", 2)), "Body")
    part(rounded(ph.ellipsoid("Neck | pale blue throat", (0, -.012, 1.66),
         (.073, .076, .125), "skin", 2)), "Body")

    # Two turquoise cloth wings meet at a circular sea-glass clasp.
    for sign, side in ((-1, "L"), (1, "R")):
        part(ribbon(f"Halter {side} | curved turquoise cup", [
            (sign * .20, -.115, 1.39, .045),
            (sign * .135, -.181, 1.44, .14),
            (sign * .055, -.212, 1.50, .115),
            (0, -.225, 1.54, .025)], "cloth", .022), "Body")
        curl(f"Halter {side} | slim neck strap", [
            (0, -.221, 1.55), (sign * .075, -.158, 1.63),
            (sign * .10, -.015, 1.70)], [.013, .015, .009],
            "cloth_dark", "Body", sides=8)
        curl(f"Halter {side} | bright lower piping", [
            (0, -.223, 1.49), (sign * .11, -.190, 1.39),
            (sign * .20, -.109, 1.37)], [.007, .011, .003],
            "cloth_light", "Body", sides=7)
    part(rounded(ph.ellipsoid("Halter | sea-glass clasp setting",
         (0, -.241, 1.535), (.069, .028, .066),
         "gem_dark", 2)), "Body")
    part(rounded(ph.ellipsoid("Halter | luminous spiral gem",
         (0, -.268, 1.538), (.043, .018, .043),
         "gem", 2)), "Body")
    part(rounded(ph.ellipsoid("Halter | tiny gem light",
         (-.012, -.286, 1.552), (.011, .006, .011),
         "hair_glint", 1)), "Body")

    # A short fitted wrap supports a diagonal flowing panel over one thigh.
    hips = loft("Hip wrap | fitted blue fabric", [
        (.83, -.01, .045, .235, .17), (.92, 0, .04, .265, .195),
        (1.02, 0, .035, .24, .18), (1.105, 0, .03, .16, .13),
    ], "cloth_dark")
    deep = ph.linear(ph.PALETTE["cloth_dark"])
    mid = ph.linear(ph.PALETTE["cloth"])
    paint(hips, lambda p, n: blend(deep, mid, .54 + .27 * max(0, -n.y)))
    part(hips, "Body")
    part(ribbon("Hip wrap | sweeping front panel", [
        (-.20, -.145, 1.07, .11), (-.04, -.205, .94, .30),
        (.17, -.221, .73, .39), (.33, -.16, .50, .21),
        (.40, -.07, .42, .015)], "cloth", .027), "Skirt.Front")
    part(ribbon("Hip wrap | bright flowing inner fold", [
        (-.01, -.232, .94, .025), (.19, -.250, .73, .15),
        (.35, -.177, .49, .06)], "cloth_light", .015), "Skirt.Front")
    curl("Hip wrap | pale sash along the waist", [
        (-.22, -.084, 1.07), (-.10, -.156, 1.035),
        (.09, -.155, 1.02), (.22, -.08, 1.05)],
        [.009, .013, .013, .006], "cloth_glint", "Body", sides=8)

    # Blue-white scrolls are raised just enough to read in a small 3D view.
    for sign, side in ((-1, "L"), (1, "R")):
        curl(f"Body {side} | pale shoulder current", [
            (sign * .20, -.061, 1.59), (sign * .15, -.12, 1.55),
            (sign * .12, -.147, 1.49)], [.005, .007, .003],
            "mark", "Body", sides=6)
    curl("Body | winding waist current", [
        (-.10, -.112, 1.28), (-.04, -.13, 1.20),
        (.03, -.128, 1.18), (.08, -.109, 1.26)],
        [.004, .008, .008, .003], "mark", "Body", sides=7)

    # A tapered jaw, luminous eyes, and a center-parted hairline replace the
    # earlier blank oval face and dark helmet-like hair mass.
    face = loft("Face | fine pale blue jaw", [
        (1.66, 0, -.115, .064, .063), (1.73, 0, -.125, .12, .108),
        (1.84, 0, -.13, .168, .145), (1.95, 0, -.115, .165, .14),
        (2.035, 0, -.10, .119, .11),
    ], "skin", sides=20)
    paint(face, lambda p, n: blend(blue, light, .24 + .27 * max(0, -n.y)))
    part(face, "Head")
    part(rounded(ph.ellipsoid("Face | delicate nose", (0, -.263, 1.812),
         (.016, .010, .026), "skin", 2)), "Head")
    for sign, side in ((-1, "L"), (1, "R")):
        part(rounded(ph.ellipsoid(f"Ear {side} | small pointed ear",
             (sign * .165, -.072, 1.83), (.025, .041, .045),
             "skin", 2)), "Head")
        part(rounded(ph.ellipsoid(f"Eye {side} | violet blue socket",
             (sign * .072, -.259, 1.87), (.051, .004, .033),
             "socket", 2)), "Head")
        part(rounded(ph.ellipsoid(f"Eye {side} | clear white",
             (sign * .072, -.264, 1.87), (.043, .003, .026),
             "sclera", 2)), "Head")
        part(rounded(ph.ellipsoid(f"Eye {side} | icy iris",
             (sign * .072, -.268, 1.87), (.024, .002, .025),
             "iris", 2)), "Head")
        part(rounded(ph.ellipsoid(f"Eye {side} | focused pupil",
             (sign * .072, -.271, 1.87), (.011, .001, .017),
             "pupil", 1)), "Head")
        curl(f"Eye {side} | lowered upper lid", [
            (sign * .029, -.268, 1.895), (sign * .072, -.275, 1.898),
            (sign * .118, -.260, 1.894)], [.004, .010, .003],
            "skin_shadow", "Head", sides=7)
        curl(f"Face {side} | arched eyebrow", [
            (sign * .028, -.254, 1.943), (sign * .075, -.266, 1.943),
            (sign * .125, -.243, 1.939)], [.004, .006, .003],
            "hair_shadow", "Head", sides=6)
        for dot in range(2):
            part(rounded(ph.ellipsoid(f"Face {side} | pearly cheek dot {dot}",
                 (sign * (.102 + dot * .027), -.232 + dot * .013,
                  1.785 - dot * .027), (.007, .006, .007),
                 "mark", 1)), "Head")
    part(rounded(ph.ellipsoid("Face | closed blue lips", (0, -.231, 1.733),
         (.039, .006, .009), "lip", 2)), "Head")
    part(rounded(ph.ellipsoid("Face | lower lip sheen", (0, -.234, 1.727),
         (.026, .004, .004), "skin_light", 1)), "Head")

    part(rounded(ph.ellipsoid("Hair | luminous crown", (0, .042, 1.91),
         (.216, .201, .236), "hair", 2)), "Head")
    for sign, side in ((-1, "L"), (1, "R")):
        mass = loft(f"Hair {side} | layered flowing volume", [
            (1.055, sign * .50, .17, .025, .045),
            (1.18, sign * .46, .16, .095, .105),
            (1.39, sign * .39, .17, .127, .125),
            (1.62, sign * .31, .13, .13, .135),
            (1.83, sign * .245, .095, .11, .12),
            (2.005, sign * .18, .05, .045, .075),
        ], "hair", sides=16)
        part(mass, f"Hair.{side}")
        part(ribbon(f"Hair {side} | parted bright fringe", [
            (0, -.158, 2.095, .045),
            (sign * .115, -.211, 2.038, .135),
            (sign * .205, -.169, 1.947, .040)],
            "hair_light", .032), "Head")
        curl(f"Hair {side} | principal cascading lock", [
            (sign * .17, .055, 2.02), (sign * .32, .035, 1.78),
            (sign * .38, .07, 1.47), (sign * .53, .01, 1.16),
            (sign * .58, -.04, 1.00), (sign * .57, -.11, .955),
            (sign * .48, -.10, 1.02)],
            [.070, .075, .073, .062, .043, .028, .004],
            "hair", f"Hair.{side}", sides=13)
        curl(f"Hair {side} | bright outer curl", [
            (sign * .19, .135, 1.96), (sign * .36, .18, 1.73),
            (sign * .40, .21, 1.43), (sign * .61, .23, 1.19),
            (sign * .71, .16, 1.05), (sign * .65, .08, .98),
            (sign * .59, .06, 1.08)],
            [.053, .062, .062, .052, .035, .024, .004],
            "hair_light", f"Hair.{side}", sides=12)
        curl(f"Hair {side} | cool inner wave", [
            (sign * .20, -.018, 1.96), (sign * .29, -.075, 1.73),
            (sign * .30, -.105, 1.44), (sign * .40, -.12, 1.16),
            (sign * .46, -.08, 1.03)],
            [.048, .051, .045, .037, .004],
            "hair_shadow", f"Hair.{side}", sides=11)
        curl(f"Hair {side} | glint through upper curls", [
            (sign * .21, -.034, 2.01), (sign * .32, -.025, 1.77),
            (sign * .40, -.004, 1.48), (sign * .51, -.04, 1.17)],
            [.010, .014, .011, .003], "hair_glint", f"Hair.{side}", sides=7)

    ARM_POINTS.update({
        "L": ((-.205, -.005, 1.55), (-.305, -.06, 1.25), (-.33, -.16, 1.045)),
        "R": ((.205, -.005, 1.55), (.405, -.17, 1.37), (.19, -.35, 1.56)),
    })
    for side, (shoulder, elbow, hand) in ARM_POINTS.items():
        part(ph.tube(f"Arm {side} | smooth upper arm", [shoulder,
             Vector(shoulder).lerp(Vector(elbow), .53), elbow],
             [.079, .074, .06], sides=14, color="skin"), f"Arm.{side}.upper")
        part(rounded(ph.ellipsoid(f"Arm {side} | soft elbow", elbow,
             (.063, .063, .065), "skin", 2)), f"Arm.{side}.upper")
        part(ph.tube(f"Arm {side} | slender forearm", [elbow,
             Vector(elbow).lerp(Vector(hand), .53), hand],
             [.061, .054, .043], sides=14, color="skin"), f"Arm.{side}.lower")
        part(rounded(ph.ellipsoid(f"Hand {side} | palm", hand,
             (.068, .047, .043), "skin_light", 2)), f"Hand.{side}")
        for finger in range(3):
            shift = (finger - 1) * .032
            sign = -1 if side == "L" else 1
            part(ph.tube(f"Hand {side} | curved finger {finger + 1}", [
                 (hand[0] + sign * .035, hand[1] -.02, hand[2] + shift),
                 (hand[0] + sign * .087, hand[1] -.07, hand[2] + shift - .015),
                 (hand[0] + sign * .074, hand[1] -.09, hand[2] + shift - .05)],
                 [.015, .012, .003], sides=7, color="skin_light"),
                 f"Grasp.{side}")
        if side == "R":
            curl("Arm R | pale tidal curl", [
                (.245, -.09, 1.53), (.29, -.15, 1.47),
                (.34, -.196, 1.42)], [.005, .007, .003],
                "mark", "Arm.R.upper", sides=6)

    for sign, side in ((-1, "L"), (1, "R")):
        hip = (sign * .15, .035, 1.045)
        knee = (sign * .35, -.29, .58)
        ankle = (sign * .38, -.07, .15)
        toe = (sign * .38, -.31, .10)
        LEG_POINTS[side] = (hip, knee, ankle, toe)
        part(ph.tube(f"Leg {side} | curved thigh", [hip,
             Vector(hip).lerp(Vector(knee), .52), knee],
             [.106, .101, .079], sides=14, color="skin"),
             f"Leg.{side}.upper")
        part(rounded(ph.ellipsoid(f"Leg {side} | round knee", knee,
             (.079, .071, .079), "skin", 2)), f"Leg.{side}.upper")
        part(ph.tube(f"Leg {side} | long tapered calf", [knee,
             Vector(knee).lerp(Vector(ankle), .53), ankle],
             [.079, .068, .05], sides=14, color="skin"),
             f"Leg.{side}.lower")
        part(rounded(ph.ellipsoid(f"Foot {side} | bare instep",
             (sign * .38, -.20, .085), (.079, .143, .064),
             "skin", 2)), f"Foot.{side}")
        part(rounded(ph.ellipsoid(f"Foot {side} | shaded sole",
             (sign * .38, -.21, .021), (.081, .144, .021),
             "skin_shadow", 2)), f"Foot.{side}")
        part(rounded(ph.ellipsoid(f"Foot {side} | pale toes",
             (sign * .38, -.333, .065), (.067, .044, .026),
             "skin_light", 1)), f"Foot.{side}")

    # Fuse the skin after constructing editable anatomical source parts. This
    # removes the toy-like seams at shoulders, elbows, hips, knees, and ankles.
    skin_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and (
        obj.name.startswith(("Body | sculpted", "Chest ", "Neck |", "Foot ")) or
        (obj.name.startswith("Arm ") and "tidal curl" not in obj.name) or
        obj.name.startswith("Hand ") and "| palm" in obj.name or
        (obj.name.startswith("Leg ") and "water scroll" not in obj.name))]
    skin = ph.voxel_union("Skin | continuous figure", skin_objects,
                          voxel_size=.04, smooth_iterations=2)
    topology = ph.mesh_topology(skin)
    if topology != {"components": 1, "nonManifoldEdges": 0}:
        raise ValueError(f"Skin needs one closed connected surface: {topology}")
    marking = ph.linear(ph.PALETTE["mark"])
    paint(skin, lambda p, n: skin_color(p, n, shade, blue, light, marking))
    PART_BONES[skin.name] = [skin_weights(vertex.co) for vertex in skin.data.vertices]


def rotate_world_axis(bone, axis, angle):
    local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
    bone.rotation_quaternion = Quaternion(local_axis, angle)


def rotate_world_axes(bone, first_axis, first_angle, second_axis, second_angle):
    inverse = bone.bone.matrix_local.to_3x3().inverted()
    bone.rotation_quaternion = (Quaternion(inverse @ Vector(first_axis), first_angle) @
                                Quaternion(inverse @ Vector(second_axis), second_angle))


def rig_model(objects, transform):
    specs = {
        "Root": ((0, 0, .06), (0, 0, .27), None),
        "Body": ((0, .025, 1.10), (0, 0, 1.50), "Root"),
        "Head": ((0, -.012, 1.66), (0, -.012, 1.96), "Body"),
        "Hair.L": ((-.18, .055, 2.02), (-.45, .08, 1.39), "Head"),
        "Hair.R": ((.18, .055, 2.02), (.45, .08, 1.39), "Head"),
        "Skirt.Front": ((-.20, -.145, 1.07), (.25, -.18, .66), "Body"),
    }
    for side, (shoulder, elbow, hand) in ARM_POINTS.items():
        specs[f"Arm.{side}.upper"] = (shoulder, elbow, "Body")
        specs[f"Arm.{side}.lower"] = (elbow, hand, f"Arm.{side}.upper")
        sign = -1 if side == "L" else 1
        specs[f"Hand.{side}"] = (hand, (hand[0] + sign * .095,
                                         hand[1] -.06, hand[2]), f"Arm.{side}.lower")
        specs[f"Grasp.{side}"] = (hand, (hand[0] + sign * .10,
                                          hand[1] -.08, hand[2] -.04), f"Hand.{side}")
    for side, (hip, knee, ankle, toe) in LEG_POINTS.items():
        specs[f"Leg.{side}.upper"] = (hip, knee, "Body")
        specs[f"Leg.{side}.lower"] = (knee, ankle, f"Leg.{side}.upper")
        specs[f"Foot.{side}"] = (ankle, toe, f"Leg.{side}.lower")
    rig = create_rig("Water nymph female | deform rig", specs, transform)
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
            strike = envelope(t, [(0, 0), (1 / 30, .30), (4 / 30, .82),
                                  (7 / 30, 1), (11 / 30, .82),
                                  (20 / 30, .16), (27 / 30, 0), (1, 0)]) if name == "Attack" else 0
            grasp = envelope(t, [(0, 0), (2 / 30, -.25), (5 / 30, -.32),
                                 (7 / 30, .75), (11 / 30, .75),
                                 (21 / 30, .09), (27 / 30, 0), (1, 0)]) if name == "Attack" else 0
            bob = (.009 * math.sin(phase) if name == "Idle" else
                   .012 * (1 - math.cos(phase * 2)) if name == "Walk" else .020 * strike)
            body_offset = Vector((0, -.30 * strike if name == "Attack" else 0,
                                  bob)) * scale
            body = rig.pose.bones["Body"]
            body.matrix = Matrix.Translation(body_offset) @ body.bone.matrix_local
            bpy.context.view_layer.update()
            rotate_world_axis(rig.pose.bones["Head"], (1, 0, 0),
                              .018 * math.sin(phase) - .055 * strike)
            for side, sign in (("L", -1), ("R", 1)):
                rotate_world_axis(rig.pose.bones[f"Hair.{side}"], (0, 0, 1),
                                  sign * (.055 * math.sin(phase + sign * .6) + .14 * strike))
            rotate_world_axis(rig.pose.bones["Skirt.Front"], (0, 0, 1),
                              .04 * math.sin(phase + .8) + .10 * strike)
            swing = .22 * math.sin(phase) if name == "Walk" else 0
            rotate_world_axis(rig.pose.bones["Arm.R.upper"], (1, 0, 0),
                              -.65 * strike - swing)
            rotate_world_axes(rig.pose.bones["Arm.R.lower"],
                              (0, 0, 1), .65 * strike,
                              (1, 0, 0), .72 * strike)
            rotate_world_axis(rig.pose.bones["Hand.R"], (1, 0, 0),
                              -.14 * strike)
            rotate_world_axis(rig.pose.bones["Grasp.R"], (1, 0, 0), grasp)
            rotate_world_axis(rig.pose.bones["Arm.L.upper"], (1, 0, 0),
                              .10 * strike + swing)
            bpy.context.view_layer.update()
            for side, raw in LEG_POINTS.items():
                hip0, knee0, ankle0, toe0 = [transform @ Vector(p) for p in raw]
                hip = hip0 + body_offset
                ankle = ankle0.copy()
                toe_offset = toe0 - ankle0
                if name == "Walk":
                    cycle = (t + (0 if side == "L" else .5)) % 1
                    if cycle < .5:
                        ankle.y += (-.39 + 1.56 * cycle) * scale
                    else:
                        step = (cycle - .5) * 2
                        ankle.y += (.39 - .78 * step) * scale
                        ankle.z += .20 * math.sin(math.pi * step) ** 2 * scale
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
