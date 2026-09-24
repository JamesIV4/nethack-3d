"""PixelHack 0/1: slate carapace, red eyes, angular six-legged silhouette."""

import math

import bpy
from mathutils import Matrix, Vector

from pixelhack_blender import ellipsoid, shell, smooth_surface, tube

LEGS = {}
ANTENNAE = {}
HEAD_PIVOT = Vector((0, -.37, 1.13))
HEAD_POSE = Matrix.Translation(HEAD_PIVOT) @ Matrix.Rotation(math.radians(-12), 4, 'X') @ Matrix.Rotation(math.radians(-5), 4, 'Z') @ Matrix.Translation(Vector((0, .37, -.92)))


def carapace(poly):
    if poly.normal.z > .72:
        return "light"
    if poly.normal.z < -.25:
        return "ink"
    if poly.normal.z < .12:
        return "edge"
    return "shell"


def limb(poly):
    return "edge" if poly.normal.z > .65 else "joint" if poly.normal.z > -.25 else "ink"


def build():
    # Broad head lifted above a braced abdomen: rearing to bite, rather than standing at rest.
    shell("Head | shield carapace", [
        (-1.08, .91, .16, .19), (-.98, 1.00, .30, .32),
        (-.76, 1.05, .405, .405), (-.55, 1.035, .35, .355),
        (-.36, .96, .16, .20),
    ], shade=carapace, smooth=True)
    shell("Neck | dark flexible collar", [(-.46, 1.09, .13, .15), (-.20, 1.02, .14, .13)], color="ink", smooth=True)
    shell("Thorax | raised shoulder", [(-.30, 1.07, .13, .15), (-.17, 1.05, .23, .24),
          (.04, .91, .22, .22), (.22, .76, .15, .16)], sides=10, shade=carapace, smooth=True)
    shell("Waist | petiole", [(.15, .73, .10, .12), (.29, .77, .11, .16),
          (.42, .71, .09, .10)], sides=8, shade=limb, smooth=True)
    shell("Abdomen | pear shaped gaster", [
        (.34, .75, .09, .12), (.47, .78, .26, .29),
        (.72, .75, .40, .36), (1.02, .67, .43, .33),
        (1.23, .62, .31, .24), (1.35, .61, .12, .11), (1.39, .61, .025, .04),
    ], shade=carapace, smooth=True)
    for sign, side in [(1, "R"), (-1, "L")]:
        # Dark sockets keep the small red lenses readable on the gray head.
        smooth_surface(ellipsoid(f"Eye socket {side}", (sign * .377, -.83, 1.055), (.068, .168, .147), "ink", 2))
        smooth_surface(ellipsoid(f"Eye {side} | red lens", (sign * .417, -.857, 1.071), (.039, .123, .108), "red", 2))
        smooth_surface(ellipsoid(f"Eye {side} | pixel glint", (sign * .447, -.899, 1.118), (.012, .035, .032), "red_light", 2))
        # Slanted upper socket edges create a hard stare without adding human eyebrows.
        tube(f"Eye rim {side} | aggressive angle", [(sign * .415, -1.00, 1.102),
             (sign * .456, -.90, 1.12), (sign * .430, -.73, 1.188)], [.013, .031, .018], color="edge")
        # Two separated, elbowed feelers. Tips are intentionally thicker than life.
        antenna = ([(.18, -1.00, 1.19), (.32, -1.24, 1.26),
                    (.52, -1.43, 1.26), (.57, -1.72, 1.13), (.55, -1.88, 1.01)]
                   if side == "R" else [(-.18, -1.00, 1.19), (-.28, -1.18, 1.35),
                    (-.43, -1.34, 1.44), (-.56, -1.66, 1.27), (-.57, -1.82, 1.14)])
        ANTENNAE[side] = antenna
        tube(f"Antenna {side}", antenna, [.060, .052, .045, .039, .022], shade=limb)
        smooth_surface(ellipsoid(f"Antenna socket {side}", (sign * .18, -1.005, 1.19), (.067, .072, .072), "edge", 2))
        tube(f"Mandible {side} | hooked jaw", [(sign * .16, -1.015, .79),
             (sign * .30, -1.20, .71), (sign * .30, -1.43, .70),
             (sign * .13, -1.55, .81)], [.102, .104, .070, .008], sides=12, shade=limb)
        # Every leg attaches to the thorax; the rear pair sweeps beside the abdomen.
        leg_paths = [
            [( .16, -.20, 1.04), (.38, -.43, 1.17), (.62, -.73, 1.19), (.65, -1.05, .78), (.57, -1.16, .65)],
            [( .20, -.02, .87), (.43, .02, .72), (.74, .14, .48), (.80, -.01, .085), (.93, -.12, .025)],
            [( .14, .15, .72), (.40, .41, .66), (.63, .77, .49), (.69, 1.06, .09), (.82, 1.25, .025)],
        ]
        for number, path in enumerate(leg_paths, 1):
            # Subtle stance asymmetry separates far-side legs in silhouette.
            points = [(sign * x, y + (-.065 if sign < 0 else 0), z) for x, y, z in path]
            LEGS[f"{side}{number}"] = points
            tube(f"Leg {side}{number} | articulated", points, [.076, .07, .048, .03, .011], shade=limb)
            ellipsoid(f"Hip {side}{number}", points[0], (.085, .085, .095), "joint", 1)
            ellipsoid(f"Knee {side}{number}", points[2], (.056, .060, .061), "edge", 1)

    # Pose the entire face as one anatomical group, including its rig attachment points.
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.name.startswith(("Head", "Eye", "Antenna", "Mandible")):
            for vertex in obj.data.vertices:
                vertex.co = HEAD_POSE @ vertex.co
    for side, points in ANTENNAE.items():
        ANTENNAE[side] = [HEAD_POSE @ Vector(p) for p in points]


def rig_model(objects, transform):
    from pixelhack_rig import animate_ant, bind, create_rig
    specs = {
        "Root": ((0, 0, 0), (0, 0, .20), None),
        "Body": ((0, .12, .82), (0, -.20, 1.05), "Root"),
        "Head": (HEAD_PIVOT, HEAD_POSE @ Vector((0, -.84, 1.03)), "Body"),
        "Abdomen": ((0, .31, .73), (0, 1.08, .66), "Body"),
    }
    for side, points in ANTENNAE.items():
        specs[f"Antenna.{side}.base"] = (points[0], points[2], "Head")
        specs[f"Antenna.{side}.tip"] = (points[2], points[4], f"Antenna.{side}.base")
        sign = 1 if side == "R" else -1
        specs[f"Jaw.{side}"] = (HEAD_POSE @ Vector((sign * .16, -1.015, .79)), HEAD_POSE @ Vector((sign * .30, -1.43, .70)), "Head")
    for name, points in LEGS.items():
        specs[f"Leg.{name}.upper"] = (points[0], points[2], "Body")
        specs[f"Leg.{name}.lower"] = (points[2], points[3], f"Leg.{name}.upper")
        specs[f"Leg.{name}.foot"] = (points[3], points[4], f"Leg.{name}.lower")
    rig = create_rig("Giant ant | deform rig", specs, transform)
    for obj in objects:
        name = obj.name
        if name.startswith("Leg "):
            leg = name.split()[1]
            a, b, c = [f"Leg.{leg}.{part}" for part in ("upper", "lower", "foot")]
            rings = [{a: 1}, {a: 1}, {a: .5, b: .5}, {b: .5, c: .5}, {c: 1}]
            ring_size = len(obj.data.vertices) // len(rings)
            bind(obj, rig, [rings[i // ring_size] for i in range(len(obj.data.vertices))])
        elif name.startswith("Antenna ") and "socket" not in name:
            side = name.split()[1]
            a, b = f"Antenna.{side}.base", f"Antenna.{side}.tip"
            rings = [{a: 1}, {a: 1}, {a: .5, b: .5}, {b: 1}, {b: 1}]
            ring_size = len(obj.data.vertices) // len(rings)
            bind(obj, rig, [rings[i // ring_size] for i in range(len(obj.data.vertices))])
        elif name.startswith("Hip "):
            bind(obj, rig, "Body")
        elif name.startswith("Knee "):
            bind(obj, rig, f"Leg.{name.split()[1]}.lower")
        elif name.startswith("Mandible "):
            bind(obj, rig, f"Jaw.{name.split()[1]}")
        elif name.startswith("Abdomen"):
            bind(obj, rig, "Abdomen")
        elif name.startswith(("Head", "Eye", "Antenna socket")):
            bind(obj, rig, "Head")
        else:
            bind(obj, rig, "Body")
    animate_ant(rig, LEGS, transform)
    return rig
