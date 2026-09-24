"""Small deform rigs with explicit weights and portable baked action clips."""

import math

import bpy
from mathutils import Matrix, Quaternion, Vector


def create_rig(name, specs, transform):
    data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone_name, (head, tail, parent) in specs.items():
        bone = data.edit_bones.new(bone_name)
        bone.head, bone.tail = transform @ Vector(head), transform @ Vector(tail)
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    data.display_type = "STICK"
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
    return rig


def bind(obj, rig, weights):
    """weights is one {bone: weight} mapping per vertex, or one rigid bone name."""
    if isinstance(weights, str):
        group = obj.vertex_groups.new(name=weights)
        group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    else:
        groups = {name: obj.vertex_groups.new(name=name) for w in weights for name in w if name not in obj.vertex_groups}
        for i, influences in enumerate(weights):
            for name, weight in influences.items():
                groups[name].add([i], weight, "REPLACE")
    modifier = obj.modifiers.new("PixelHack skeleton", "ARMATURE")
    modifier.object = rig
    obj.parent = rig


def set_bone_segment(rig, name, head, tail):
    bone = rig.pose.bones[name]
    rest = bone.bone
    rotation = (rest.tail_local - rest.head_local).rotation_difference(tail - head) @ rest.matrix_local.to_quaternion()
    bone.matrix = Matrix.LocRotScale(head, rotation, Vector((1, 1, 1)))
    bpy.context.view_layer.update()


def solve_knee(hip, foot, rest_knee, upper_length, lower_length):
    delta = foot - hip
    if delta.length > upper_length + lower_length + .000001:
        raise ValueError(f"Leg target is out of reach: {delta.length:.6f} > {upper_length + lower_length:.6f}")
    length = max(.0001, min(delta.length, upper_length + lower_length - .00001))
    direction = delta.normalized()
    along = (upper_length ** 2 - lower_length ** 2 + length ** 2) / (2 * length)
    height = math.sqrt(max(0, upper_length ** 2 - along ** 2))
    pole = rest_knee - hip
    perpendicular = (pole - direction * pole.dot(direction)).normalized()
    return hip + along * direction + height * perpendicular


def envelope(time, keys):
    """Interpolate an anticipation/strike/recovery curve without overshoot."""
    for (start, a), (end, b) in zip(keys, keys[1:]):
        if time <= end:
            t = max(0, min(1, (time - start) / (end - start)))
            return a + (b - a) * t * t * (3 - 2 * t)
    return keys[-1][1]


def animate_ant(rig, legs, transform):
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start, scene.frame_end = 0, 30
    scale = transform.to_scale().x
    rig.animation_data_create()
    for clip_name, frames in [("Idle", 91), ("Walk", 31), ("Attack", 16)]:
        action = bpy.data.actions.new(clip_name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame in range(1, frames + 1):
            scene.frame_set(frame - 1)
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
            progress = (frame - 1) / (frames - 1)
            phase = 0 if clip_name == "Attack" else progress * math.tau
            strike = envelope(progress, [(0, 0), (1 / 15, .45), (3 / 15, 1),
                                        (4 / 15, .95), (7 / 15, .3), (1, 0)]) if clip_name == "Attack" else 0
            bob = (.013 * math.sin(phase) if clip_name != "Walk" else -.10 + .018 * (1 - math.cos(phase * 2))) * scale
            lean = -.024 * (1 - math.cos(phase)) * scale if clip_name == "Idle" else -.04 * scale
            if clip_name == "Attack":
                bob = .42 * strike * scale
                lean = -.65 * strike * scale
            body_offset = Vector((0, lean, bob))
            # Body's local basis is angled: use world-space translation explicitly.
            body = rig.pose.bones["Body"]
            body.matrix = Matrix.Translation(body_offset) @ body.bone.matrix_local
            bpy.context.view_layer.update()
            for name, axis, amplitude, shift in [
                ("Head", "X", .04, 0), ("Abdomen", "X", .012, .8),
                ("Antenna.L.base", "Z", .05, .5), ("Antenna.R.base", "Z", -.04, 1.8),
                ("Antenna.L.tip", "X", .065, 1.2), ("Antenna.R.tip", "X", .045, .3),
                ("Jaw.L", "Z", .105, .1), ("Jaw.R", "Z", -.105, .1),
            ]:
                rig.pose.bones[name].rotation_quaternion = Quaternion((1, 0, 0) if axis == "X" else (0, 0, 1), amplitude * math.sin(phase + shift))
            if clip_name == "Attack":
                rig.pose.bones["Head"].rotation_quaternion = Quaternion((1, 0, 0), -.18 * strike)
                # The bite has its own timing: visibly open, close in one frame,
                # hold contact briefly, then release during the body's recovery.
                jaw_snap = envelope(progress, [(0, 0), (1 / 15, -.42),
                    (2 / 15, -.38), (3 / 15, .27), (5 / 15, .27),
                    (8 / 15, .10), (12 / 15, 0), (1, 0)])
                for side, sign in [("L", 1), ("R", -1)]:
                    jaw = rig.pose.bones[f"Jaw.{side}"]
                    local_axis = jaw.bone.matrix_local.to_3x3().inverted() @ Vector((0, 0, 1))
                    jaw.rotation_quaternion = jaw.rotation_quaternion @ Quaternion(local_axis, sign * jaw_snap)
            bpy.context.view_layer.update()
            for name, raw_points in legs.items():
                points = [transform @ Vector(p) for p in raw_points]
                # Keep rest lengths immutable while translating the animated hip.
                hip, knee0, ankle0, toe0 = points[0].copy(), points[2], points[3], points[4]
                hip += body_offset
                ankle = ankle0.copy()
                toe_offset = toe0 - ankle0
                side, number = name[0], int(name[1])
                if number == 1:
                    if clip_name == "Walk":
                        # Lower the raised striking arms into the six-foot walking stance.
                        ankle = transform @ Vector((.60 if side == "R" else -.60, -.76, .095))
                        toe_offset = Vector((.10 if side == "R" else -.10, -.15, -.070)) * scale
                    else:
                        ankle.y -= .035 * scale * math.sin(phase + (0 if side == "R" else .45))
                        ankle.z += .025 * scale * math.sin(phase + (0 if side == "R" else .45))
                        if clip_name == "Attack":
                            ankle.y -= .75 * strike * scale
                            ankle.z += .47 * strike * scale
                elif clip_name == "Attack":
                    # Launch upward toward a taller target, then land in recovery.
                    # Feet follow the body to keep every limb within reach.
                    ankle.y -= .65 * strike * scale
                    ankle.z += (.40 * strike + .065 * math.sin(math.pi * strike)) * scale
                if clip_name == "Walk":
                    # Alternating tripod groups: L1/R2/L3 and R1/L2/R3.
                    offset = 0 if (side == "L") == (number % 2 == 1) else .5
                    cycle = ((frame - 1) / (frames - 1) + offset) % 1
                    stride = .20 * scale
                    if cycle < .5:
                        ankle.y += stride * (cycle * 2 - .5)
                    else:
                        t = (cycle - .5) * 2
                        ankle.y += stride * (.5 - t)
                        ankle.z += .13 * scale * math.sin(t * math.pi) ** 2
                upper = (points[2] - points[0]).length
                lower = (points[3] - points[2]).length
                knee = solve_knee(hip, ankle, knee0, upper, lower)
                set_bone_segment(rig, f"Leg.{name}.upper", hip, knee)
                set_bone_segment(rig, f"Leg.{name}.lower", knee, ankle)
                set_bone_segment(rig, f"Leg.{name}.foot", ankle, ankle + toe_offset)
            for bone in rig.pose.bones:
                for channel in ("location", "rotation_quaternion", "scale"):
                    bone.keyframe_insert(channel, frame=frame - 1, group=bone.name)
        # Linear keys preserve the explicit foot contact timing and loop seam.
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
