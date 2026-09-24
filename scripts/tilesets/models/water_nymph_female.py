"""Water nymph: CC0 anatomical cage, fitted sea silk and flowing hair.

See data/README.md for source provenance and Blender Studio technique references.
The generation recipe retains the PixelHack vertex palette and animation contract.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

import pixelhack_blender as ph
from pixelhack_face import blink_lids
from pixelhack_rig import bind, create_rig, envelope, set_bone_segment, solve_knee

PART_BONES = {}
ARM_POINTS = {}
LEG_POINTS = {}
GRASP_POINTS = {}
CURL_POINTS = {}
THUMB_POINTS = {}
THUMB_AXIS = Vector((1,0,0))


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


def curl(name, controls, radii, color, bone, sides=11, scalp=False):
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
    flatness = .42 if name.startswith("Hair ") else 1
    if scalp:
        # Keep the wide axis tangent to the scalp. A world-aligned profile
        # rotates that width upright on the crown and produces two tall fins.
        vertices, faces = [], []
        for i,(point,width) in enumerate(zip(points,widths)):
            tangent = (points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
            outward = (point-Vector((0,-.015,1.46))).normalized()
            lateral = tangent.cross(outward).normalized()
            depth = tangent.cross(lateral).normalized()
            for j in range(sides):
                angle=math.tau*j/sides
                vertices.append(point+width*math.cos(angle)*lateral+
                                width*.25*math.sin(angle)*depth)
        for row in range(len(points)-1):
            for j in range(sides):
                a=row*sides+j; b=row*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces.extend((tuple(range(sides-1,-1,-1)),
                      tuple((len(points)-1)*sides+j for j in range(sides))))
        return part(rounded(ph.mesh(name,vertices,faces,color)),bone)
    return part(ph.swept_ellipse(name, points, widths,
                [max(.003, width * flatness) for width in widths],
                sides=sides, color=color), bone)



def clamp01(value):
    return max(0, min(1, value))


def smoothstep(a, b, value):
    t = clamp01((value - a) / (b - a))
    return t * t * (3 - 2 * t)


def anatomy_weights(p):
    """Anatomical regions in the symmetrical source pose, before posing.

    Preserve the face and joint loops of the CC0 cage instead of voxelizing it.
    Fingers retain their topology and have a separate collective grasp bone.
    """
    x, y, z = p
    side = 'L' if x < 0 else 'R'
    x = abs(x)
    if z > 1.28:
        head = smoothstep(1.28, 1.35, z)
        return {'Head': head, 'Body': 1 - head}
    if x > (.135 if z > 1.10 else .16 if z > .93 else .205) and z > .70:
        arm = smoothstep(.132, .19, x)
        if z > 1.08:
            return {f'Arm.{side}.upper': arm, 'Body': 1 - arm}
        lower = 1 - smoothstep(1.00, 1.10, z)
        hand = 1 - smoothstep(.835, .885, z)
        grasp = 1 - smoothstep(.785, .815, z)
        result = {'Body': 1 - arm, f'Arm.{side}.upper': arm * (1 - lower),
                f'Arm.{side}.lower': arm * lower * (1 - hand),
                f'Hand.{side}': arm * lower * hand * (1 - grasp),
                f'Grasp.{side}': arm * lower * hand * grasp}
        if side == 'R':
            distal = 1-smoothstep(.758,.785,z)
            result['Curl.R'] = result['Grasp.R'] * distal
            result['Grasp.R'] *= 1-distal
        return result
    if z < .94:
        leg = 1 - smoothstep(.77, .94, z)
        lower = 1 - smoothstep(.435, .525, z)
        foot = 1 - smoothstep(.08, .15, z)
        return {'Body': 1 - leg, f'Leg.{side}.upper': leg * (1 - lower),
                f'Leg.{side}.lower': leg * lower * (1 - foot),
                f'Foot.{side}': leg * lower * foot}
    return {'Body': 1}


def segment_map(start, end, target_start, target_end):
    start, end, target_start, target_end = map(Vector, (start, end, target_start, target_end))
    q = (end - start).rotation_difference(target_end - target_start)
    return Matrix.Translation(target_start) @ q.to_matrix().to_4x4() @ Matrix.Translation(-start)


def build():
    global THUMB_AXIS
    PART_BONES.clear()
    ARM_POINTS.clear()
    LEG_POINTS.clear()
    GRASP_POINTS.clear()
    CURL_POINTS.clear()
    THUMB_POINTS.clear()
    ph.VIEWS['hero'] = (2.1, -5, 1.25)
    ph.VIEWS['front'] = (0, -5, .35)
    ph.PALETTE.clear()
    ph.PALETTE.update({
        'shell': 'a5d4e2', 'ink': '153d55',
        'skin': 'a5cedf', 'skin_light': 'd0e9ed', 'skin_shadow': '77a1bd',
        'lip': '63889d', 'sclera': 'e1f5f2', 'iris': '2b8a9b', 'pupil': '123442',
        'hair': '24768e', 'hair_shadow': '174c69', 'hair_light': '399ab0',
        'hair_glint': '70c6d0', 'cloth': '238f98', 'cloth_dark': '156570',
        'cloth_light': '4fb6b8', 'cloth_glint': '9ce0d6', 'gem': 'c6f4ed',
        'gem_dark': '527b85', 'mark': 'd4f4ef',
    })
    source = json.loads((Path(__file__).parent / 'data/stylized-female-cc0.json').read_text())
    body = rounded(ph.mesh('Skin | continuous anatomical figure', source['vertices'], source['faces'], 'skin'))
    # Source hand placement and joint landmarks; all lengths stay anatomical.
    transforms = {'Body': Matrix.Translation((0, 0, -.018)), 'Head': Matrix.Translation((0, 0, -.018))}
    for sign, side in ((-1, 'L'), (1, 'R')):
        shoulder = (sign * .15, .0, 1.235)
        elbow = (sign * .255, -.005, 1.047)
        wrist = (sign * .333, -.022, .862)
        new_shoulder = (sign * .15, 0, 1.217)
        # Low, unequal arm arcs keep the hands outside the silhouette without
        # a horizontal presentation pose: one hand floats by the hip, the other
        # hangs a little lower and closer to the skirt.
        # R is positive mesh X (the character's left, viewer's right).
        if side == 'R':
            new_elbow = (.235, -.018, 1.022)
            direction = Vector((.14, -.07, -.09)).normalized()
        else:
            new_elbow = (-.205, .005, 1.009)
            direction = Vector((-.065, -.02, -.19)).normalized()
        new_wrist = Vector(new_elbow) + direction * (Vector(wrist) - Vector(elbow)).length
        ARM_POINTS[side] = (new_shoulder, new_elbow, new_wrist)
        transforms[f'Arm.{side}.upper'] = segment_map(shoulder, elbow, new_shoulder, new_elbow)
        lower = segment_map(elbow, wrist, new_elbow, new_wrist)
        transforms[f'Arm.{side}.lower'] = lower
        wrist_turn = (Matrix.Translation(new_wrist) @
                      Quaternion((0,1,0),-.12 if side == 'R' else .24).to_matrix().to_4x4() @
                      Matrix.Translation(-new_wrist) @ lower)
        knuckles = wrist_turn @ Vector((sign * .346, -.032, .803))
        fingers = (Matrix.Translation(knuckles) @
                   Quaternion((0,1,0),.26 if side == 'R' else -.23).to_matrix().to_4x4() @
                   Matrix.Translation(-knuckles) @ wrist_turn)
        transforms[f'Hand.{side}'] = wrist_turn
        transforms[f'Grasp.{side}'] = fingers
        if side == 'R':
            transforms['Curl.R'] = fingers
            CURL_POINTS['R'] = fingers @ Vector((.348,-.035,.776))
            transforms['Thumb.R'] = wrist_turn
            THUMB_POINTS['R'] = (wrist_turn @ Vector((.329,-.048,.844)),
                                  wrist_turn @ Vector((.318,-.079,.789)))
            THUMB_AXIS = (wrist_turn.to_3x3() @ Vector((1,0,0))).normalized()
        GRASP_POINTS[side] = (knuckles, fingers @ Vector((sign * .350, -.037, .754)))
        hip, knee, ankle = (sign * .083, .015, .84), (sign * .073, -.035, .475), (sign * .075, .008, .095)
        new_hip, new_knee, new_ankle = (sign * .083, .015, .822), (sign * .091, -.075, .468), (sign * .107, .008, .095)
        toe = (sign * .107, -.12, .035)
        LEG_POINTS[side] = (new_hip, new_knee, new_ankle, toe)
        transforms[f'Leg.{side}.upper'] = segment_map(hip, knee, new_hip, new_knee)
        transforms[f'Leg.{side}.lower'] = segment_map(knee, ankle, new_knee, new_ankle)
        transforms[f'Foot.{side}'] = Matrix.Translation(Vector(new_ankle) - Vector(ankle))
    # Below this knuckle plane the thumb is a separate connected branch of the
    # source cage. Follow topology so both sides of its surface receive the
    # same joint, then blend two edge rings into the palm at the thumb root.
    adjacency=[set() for _ in source['vertices']]
    for face in source['faces']:
        for a,b in zip(face,face[1:]+face[:1]):
            adjacency[a].add(b); adjacency[b].add(a)
    candidates={i for i,p in enumerate(source['vertices']) if p[0]>.29 and p[2]<.82}
    seed=min(candidates,key=lambda i:source['vertices'][i][1])
    branch={seed}; pending=[seed]
    while pending:
        fresh=(adjacency[pending.pop()] & candidates)-branch
        branch.update(fresh); pending.extend(fresh)
    thumb_weights={i:1 for i in branch}
    frontier=branch
    for amount in (.6,.2):
        frontier={j for i in frontier for j in adjacency[i] if j not in thumb_weights}
        thumb_weights.update({i:amount for i in frontier})
    weights = []
    for vertex in body.data.vertices:
        p = vertex.co.copy()
        w = {n: v for n, v in anatomy_weights(p).items() if v > .00001}
        thumb=thumb_weights.get(vertex.index,0)
        if thumb:
            w['Thumb.R']=0
            for name in ('Hand.R','Grasp.R','Curl.R'):
                amount=w.get(name,0)*thumb
                w['Thumb.R']+=amount
                if name in w: w[name]-=amount
        total = sum(w.values())
        w = {n: v / total for n, v in w.items()}
        weights.append(w)
        # Subtly reduce the cranium and cheeks, keeping the eyes in their sockets.
        head = smoothstep(1.30, 1.39, p.z)
        p.x *= 1 - .06 * head
        p.z = p.z * (1 - .05 * head) + 1.43 * .05 * head
        vertex.co = sum(((transforms[n] @ p) * v for n, v in w.items()), Vector())
        # Split the torso between pelvis and chest after posing the source cage.
        # This lets the shoulders counter the hips without deforming the hips.
        chest = smoothstep(.94,1.17,p.z)
        if w.get('Body',0) > 0:
            torso = w['Body']
            w['Body'] = torso * (1-chest)
            w['Spine'] = torso * chest
    body.data.update()
    if ph.mesh_topology(body) != {'components': 1, 'nonManifoldEdges': 0}:
        raise ValueError('Keep the entire connected, closed body under the clothes')
    PART_BONES[body.name] = weights
    skin, light = [ph.linear(ph.PALETTE[n]) for n in ('skin', 'skin_light')]
    def complexion(p, n):
        shade = blend(skin, light, .13 * max(0, -n.y))
        # Lips are colored on the anatomical surface, never glued-on ellipsoids.
        lip = math.exp(-((p.z - 1.352) / .010) ** 2 - (p.x / .034) ** 4)
        return blend(shade, ph.linear(ph.PALETTE['lip']), .62 * lip if p.y < -.12 else 0)
    paint(body, complexion)

    # One continuous quad garment: fitted neckline -> waist -> draped hem.
    # Projection is the same surface-fitting principle as Shrinkwrap. Only the
    # bodice is fitted tightly; the skirt keeps authored volume and sculpted folds.
    surface = BVHTree.FromPolygons([v.co for v in body.data.vertices], [list(p.vertices) for p in body.data.polygons])
    vertices, faces = [], []
    columns, skirt_rows, bodice_rows = 32, 8, 8
    def neckline(angle):
        front = max(0, -math.sin(angle))
        return 1.226 - .052 * front ** 4
    def hemline(angle):
        return .52 - .155 * math.cos(angle) + .015 * math.sin(2 * angle)
    def fit(angle, z):
        direction = Vector((math.cos(angle), math.sin(angle), 0))
        hit, _, _, _ = surface.ray_cast(Vector((0, 0, z)), direction)
        if hit is None:
            raise ValueError('Dress projection missed the torso')
        return hit + direction * .008
    def skirt_radius(z):
        sections = [(.30,.227,.156),(.64,.196,.165),(.78,.197,.164),(.86,.167,.132),(.96,.113,.083)]
        for a,b in zip(sections,sections[1:]):
            if z <= b[0]:
                t = smoothstep(a[0],b[0],z)
                return a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t
        return sections[-1][1:]
    for row in range(skirt_rows + bodice_rows + 1):
        for col in range(columns):
            angle = math.tau * col / columns
            if row <= skirt_rows:
                t = row / skirt_rows
                z = hemline(angle) + (.96 - hemline(angle)) * t
                rx, ry = skirt_radius(z)
                p = Vector((rx * math.cos(angle), -.010 + ry * math.sin(angle), z))
                if z > .86:
                    p = p.lerp(fit(angle,z), smoothstep(.86,.96,z))
                # Curved vertical folds grow gradually below the fitted hips.
                fold = .009 * (1 - smoothstep(.57,.94,z)) * math.sin(6*angle + (z-.5)*3)
                p += Vector((math.cos(angle),math.sin(angle),0)) * fold
            else:
                t = (row - skirt_rows) / bodice_rows
                z = .96 + (neckline(angle) - .96) * t
                p = fit(angle,z)
            vertices.append(p)
    for row in range(skirt_rows + bodice_rows):
        for col in range(columns):
            a = row * columns + col; b = row * columns + (col + 1) % columns
            faces.append((a,b,b+columns,a+columns))
    dress = rounded(ph.mesh('Dress | continuous sea silk',vertices,faces,'cloth'))
    # Solidify closes neckline and hem rims with a thin inner surface, preserving
    # the open neck/leg passages. The resulting garment is one manifold shell.
    bpy.context.view_layer.objects.active = dress
    thickness = dress.modifiers.new('Tailored fabric thickness','SOLIDIFY')
    thickness.thickness = .0025
    thickness.offset = 1
    bpy.ops.object.modifier_apply(modifier=thickness.name)
    topology = ph.mesh_topology(dress)
    if topology != {'components':1,'nonManifoldEdges':0}:
        raise ValueError(f'Dress must be one connected manifold garment: {topology}')
    dress['construction'] = 'Continuous fitted quad surface; sculpted folds; solidified rims'
    dress['topology_components'] = topology['components']
    dress['topology_nonmanifold_edges'] = topology['nonManifoldEdges']
    def fabric_color(p,n):
        angle = math.atan2(p.y+.01,p.x)
        base = blend(ph.linear(ph.PALETTE['cloth_dark']),ph.linear(ph.PALETTE['cloth']),.65+.25*max(0,-n.y))
        edge = max(1-smoothstep(.001,.013,abs(p.z-neckline(angle))),
                   1-smoothstep(.001,.012,abs(p.z-hemline(angle))))
        fold = .13 * (1-smoothstep(.65,.96,p.z)) * (.5+.5*math.sin(6*angle+(p.z-.5)*3))
        return blend(blend(base,ph.linear(ph.PALETTE['cloth_light']),fold),ph.linear(ph.PALETTE['cloth_glint']),.8*edge)
    paint(dress,fabric_color)
    dress_weights = []
    for v in dress.data.vertices:
        flow = .075 * (1 - smoothstep(.46,.86,v.co.z))
        legs = .90 * (1 - smoothstep(.78,.96,v.co.z))
        right = smoothstep(-.07,.07,v.co.x)
        chest = smoothstep(.94,1.17,v.co.z)
        torso = 1-flow-legs
        dress_weights.append({'Body':torso*(1-chest),'Spine':torso*chest,'Skirt.Front':flow,
                              'Leg.L.upper':legs*(1-right),'Leg.R.upper':legs*right})
    PART_BONES[dress.name] = dress_weights
    part(rounded(ph.ellipsoid('Jewelry | sea glass clasp',(0,-.108,1.182),(.019,.008,.026),'gem',2)),'Spine')


    # Small spherical eyes are seated inside the existing eyelid loops.
    for sign, side in ((-1, 'L'), (1, 'R')):
        eye = (sign * .04449, -.0804, 1.4436)
        sclera=part(rounded(ph.ellipsoid(f'Eye {side} | inset sclera', eye, (.036,.036,.036), 'sclera', 2)), 'Head')
        for lid in blink_lids(f'Eyelid {side}',eye,(.036,.036,.036),'skin',
                              eye=sclera,socket=body,front_margin=.008):
            part(lid,'Head')
        part(rounded(ph.ellipsoid(f'Eye {side} | teal iris', (eye[0], -.1152, eye[2]), (.015,.004,.018), 'iris', 2)), 'Head')
        part(rounded(ph.ellipsoid(f'Eye {side} | pupil', (eye[0], -.119, eye[2]), (.007,.002,.011), 'pupil', 1)), 'Head')
        part(rounded(ph.ellipsoid(f'Eye {side} | catchlight', (eye[0]-.004, -.121, eye[2]+.006), (.003,.001,.003), 'gem', 1)), 'Head')
        curl(f'Face {side} | calm brow', [(sign*.020,-.133,1.49),(sign*.045,-.134,1.498),(sign*.073,-.118,1.487)], [.002,.004,.001], 'hair_shadow','Head',6)

    # A fitted scalp cap hides root gaps; separate overlapping curve clumps
    # build the hairstyle in back, side and fringe layers. No fused hair curtain.
    # See data/README.md for the guide-curve and profile references.
    columns, cap_rows = 32, 6
    center = Vector((0,-.015,1.46))
    def scalp_extent(angle):
        # Recede above the forehead; the swept fringe defines the visible edge
        # instead of exposing a straight under-cap band across the brow.
        front=max(0,-math.sin(angle))
        return 1.55-.72*front**3-.05*max(0,math.sin(angle))
    def scalp_point(angle, theta):
        direction = Vector((math.sin(theta)*math.cos(angle),
                            math.sin(theta)*math.sin(angle), math.cos(theta)))
        hit, _, _, _ = surface.ray_cast(center,direction,.25)
        if hit is None:
            raise ValueError('Hair scalp projection missed the head')
        return hit + direction * .010
    cap_vertices = [scalp_point(0,0)]
    cap_faces = []
    for row in range(1,cap_rows+1):
        for col in range(columns):
            angle=math.tau*col/columns
            extent=scalp_extent(angle)
            cap_vertices.append(scalp_point(angle,extent*row/cap_rows))
    for col in range(columns):
        cap_faces.append((0,1+col,1+(col+1)%columns))
    for row in range(cap_rows-1):
        for col in range(columns):
            a=1+row*columns+col; b=1+row*columns+(col+1)%columns
            cap_faces.append((a,b,b+columns,a+columns))
    hair=rounded(ph.mesh('Hair | fitted scalp cap',cap_vertices,cap_faces,'hair'))
    bpy.context.view_layer.objects.active=hair
    solid=hair.modifiers.new('Closed hair volume','SOLIDIFY')
    solid.thickness=.003
    solid.offset=1
    bpy.ops.object.modifier_apply(modifier=solid.name)
    topology=ph.mesh_topology(hair)
    if topology != {'components':1,'nonManifoldEdges':0}:
        raise ValueError(f'Hair foundation must be closed and connected: {topology}')
    hair['topology_components']=topology['components']
    hair['topology_nonmanifold_edges']=topology['nonManifoldEdges']
    def hair_weights(p):
        loose=1-smoothstep(1.17,1.45,p.z)
        right=smoothstep(-.05,.05,p.x)
        return {'Head':1-loose,'Hair.L':loose*(1-right),'Hair.R':loose*right}
    PART_BONES[hair.name]='Head'
    paint(hair,lambda p,n: blend(ph.linear(ph.PALETTE['hair_shadow']),ph.linear(ph.PALETTE['hair']),
                                .55+.23*max(0,n.y)+.10*math.sin(8*math.atan2(p.y+.015,p.x))))
    # Dense short root locks follow the scalp itself. Their profiled surfaces
    # overlap across the whole crown, so the cap is only an underlay, never a
    # broad smooth bald-looking patch between the long guide clumps.
    for index in range(10):
        vertices, faces = [], []
        rows, across = 7, 4
        for row in range(rows):
            t = row / (rows - 1)
            for col in range(across):
                u = col / (across - 1)
                angle = math.tau * index / 10 + (u - .5) * .76 + .08 * math.sin(t * math.pi)
                extent = scalp_extent(angle)
                theta = .025 + (extent - .025) * t
                p = scalp_point(angle,theta)
                normal = (p-center).normalized()
                relief = .002 + .007 * math.sin(math.pi*u) * math.sin(math.pi*t) ** .5
                vertices.append(p + normal * relief)
        for row in range(rows-1):
            for col in range(across-1):
                a = row*across+col
                faces.append((a,a+1,a+1+across,a+across))
        lock = rounded(ph.mesh(f'Hair roots | scalp-following lock {index+1}',vertices,faces,'hair'))
        bpy.context.view_layer.objects.active=lock
        solid=lock.modifiers.new('Fine root-lock thickness','SOLIDIFY')
        solid.thickness=.0015
        solid.offset=1
        bpy.ops.object.modifier_apply(modifier=solid.name)
        part(lock,'Head')
        base=ph.linear(ph.PALETTE['hair'])
        bright=ph.linear(ph.PALETTE['hair_light'])
        paint(lock,lambda p,n: blend(base,bright,.20+.18*max(0,n.z)))
    # Bottom layer: seven independent S-curved locks cover the back. Their
    # widths overlap while their staggered, tapered tips stay visibly separate.
    for index in range(7):
        angle = math.pi * index / 6
        u = math.cos(angle)
        root = scalp_point(angle,.58)
        upper = scalp_point(angle,1.15) + Vector((0,.008,0))
        finish = .89 + .055 * math.cos(index * 1.9)
        x_tip = .30 * u + .018 * math.sin(index * 1.7)
        controls = [root, upper, (u*.145,.12+.06*math.sin(angle),1.30),
                    (u*.18+.015*math.sin(index),.15+.055*math.sin(angle),1.10),
                    (x_tip,.09+.07*math.sin(angle),finish),
                    (x_tip+.035*u,.065+.05*math.sin(angle),finish+.035)]
        lock = curl(f'Hair back | lower lock {index+1}',controls,
                    [.016,.043,.057,.058,.026,.0015],
                    'hair' if index%2==0 else 'hair_light',
                    'Hair.L' if u<0 else 'Hair.R',8)
        PART_BONES[lock.name] = [hair_weights(v.co) for v in lock.data.vertices]
    # Shorter top-layer clumps break up the long parallel channels without
    # turning the hairstyle into a single inflated silhouette.
    for index in range(3):
        u=(index-1)*.065
        root=scalp_point(math.pi/2 + (index-1)*.48,.34)
        lock=curl(f'Hair back | upper lock {index+1}',
            [root,(u,.117,1.49),(u+.014,.195,1.33),
             (u-.016,.226,1.16),(u+.024,.207,1.03),(u+.04,.184,1.06)],
            [.010,.037,.042,.037,.020,.001],
            'hair_light' if index==1 else 'hair','Hair.R',8)
        PART_BONES[lock.name]=[hair_weights(v.co) for v in lock.data.vertices]
    for sign,side in ((-1,'L'),(1,'R')):
        curl(f'Hair {side} | swept temple',[(sign*.012,-.054,1.605),(sign*.07,-.117,1.55),(sign*.112,-.079,1.49),(sign*.13,-.01,1.35)],[.008,.035,.029,.005],'hair_light','Head',10,scalp=True)
        wave=curl(f'Hair {side} | face framing wave',[(sign*.115,-.015,1.49),(sign*.143,-.012,1.34),(sign*.156,-.022,1.23),(sign*.21,.015,1.10),(sign*.26,.035,1.02)],[.030,.034,.030,.020,.002],'hair','Hair.'+side,10)
        PART_BONES[wave.name]=[hair_weights(v.co) for v in wave.data.vertices]
        glint=curl(f'Hair {side} | narrow reflected ribbon',[(sign*.045,-.122,1.575),(sign*.105,-.103,1.49),(sign*.141,-.04,1.34),(sign*.156,-.046,1.24)],[.002,.004,.003,.001],'hair_glint','Head',6)
        PART_BONES[glint.name]=[hair_weights(v.co) for v in glint.data.vertices]


def rig_model(objects, transform):
    specs = {
        "Root": ((0, 0, .06), (0, 0, .27), None),
        "Body": ((0, .01, .86), (0, 0, 1.23), "Root"),
        "Spine": ((0, .01, .96), (0, 0, 1.25), "Body"),
        "Head": ((0, 0, 1.30), (0, 0, 1.53), "Spine"),
        "Hair.L": ((-.10, .03, 1.53), (-.25, .10, 1.03), "Head"),
        "Hair.R": ((.10, .03, 1.53), (.25, .10, 1.03), "Head"),
        "Skirt.Front": ((-.10, -.09, .87), (.13, -.12, .50), "Body"),
    }
    for side, (shoulder, elbow, hand) in ARM_POINTS.items():
        specs[f"Arm.{side}.upper"] = (shoulder, elbow, "Spine")
        specs[f"Arm.{side}.lower"] = (elbow, hand, f"Arm.{side}.upper")
        grasp, tips = GRASP_POINTS[side]
        specs[f"Hand.{side}"] = (hand, grasp, f"Arm.{side}.lower")
        specs[f"Grasp.{side}"] = (grasp, CURL_POINTS.get(side,tips), f"Hand.{side}")
        if side == 'R':
            specs['Curl.R'] = (CURL_POINTS[side],tips,'Grasp.R')
            specs['Thumb.R'] = (*THUMB_POINTS['R'],'Hand.R')
    for side, (hip, knee, ankle, toe) in LEG_POINTS.items():
        specs[f"Leg.{side}.upper"] = (hip, knee, "Body")
        specs[f"Leg.{side}.lower"] = (knee, ankle, f"Leg.{side}.upper")
        specs[f"Foot.{side}"] = (ankle, toe, f"Leg.{side}.lower")
    rig = create_rig("Water nymph female | deform rig", specs, transform)
    for obj in objects:
        bind(obj, rig, PART_BONES[obj.name])
    skin = next(obj for obj in objects if obj.name.startswith('Skin |'))
    foot_support = {}
    for side in ('L','R'):
        ankle = transform @ Vector(LEG_POINTS[side][2])
        foot_support[side] = [v.co - ankle for v,w in zip(skin.data.vertices,PART_BONES[skin.name])
                              if w.get(f'Foot.{side}',0) > .99]
    animate(rig, transform, foot_support)
    return rig


def animate(rig, transform, foot_support):
    """Body mechanics and overlapping action, sampled into portable GLB clips.

    Walk has 55% stance / 45% swing and a short double-support period. Stance
    moves backward at controller speed; the Hermite swing matches its velocity
    at toe-off and contact. All secondary movement is bounded and periodic.
    """
    scene = bpy.context.scene
    scene.render.fps = 60
    rig.animation_data_create()
    scale = transform.to_scale().x
    legs = {side:[transform @ Vector(p) for p in raw] for side,raw in LEG_POINTS.items()}
    arms = {side:[transform @ Vector(p) for p in raw] for side,raw in ARM_POINTS.items()}
    body = rig.pose.bones['Body']
    spine = rig.pose.bones['Spine']
    pivot = body.bone.head_local.copy()
    def turn(name, pitch=0, roll=0, yaw=0):
        bone = rig.pose.bones[name]
        inverse = bone.bone.matrix_local.to_3x3().inverted()
        bone.rotation_quaternion = (Quaternion(inverse @ Vector((0,0,1)),yaw) @
                                    Quaternion(inverse @ Vector((0,1,0)),roll) @
                                    Quaternion(inverse @ Vector((1,0,0)),pitch))
    def wave(phase, lag=0):
        return math.sin(phase-lag) + math.sin(lag)
    for name, frames in (('Idle',241),('Walk',31),('Attack',31)):
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        previous_quaternions = {}
        for frame in range(frames):
            scene.frame_set(frame)
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
            t = frame/(frames-1)
            phase = math.tau*t
            strike = reach = settle = pluck = 0
            if name == 'Attack':
                strike = envelope(t,[(0,0),(1/30,.27),(4/30,.80),(7/30,1),
                                     (11/30,.60),(17/30,.20),(26/30,0),(1,0)])
                reach = envelope(t,[(0,0),(1/30,.24),(3/30,.42),(5/30,.78),(7/30,1),
                                    (15/30,1),(24/30,.18),(1,0)])
                pluck = envelope(t,[(0,0),(7/30,0),(11/30,1),
                                    (16/30,1),(23/30,.35),(1,0)])
                settle = envelope(t,[(0,0),(5/30,.12),(10/30,1),(17/30,.35),(25/30,-.12),(1,0)])
            if name == 'Walk':
                offset = Vector((.009*math.sin(phase),0,
                                 -.057+.011*(1-math.cos(2*phase-.4))))*scale
                pelvis_yaw = .035*math.sin(phase)
                pelvis_roll = .017*math.sin(phase)
                pelvis_pitch = .007*math.sin(2*phase)
                spine_yaw = -.065*math.sin(phase-.12)
                spine_roll = -.023*math.sin(phase-.10)
                spine_pitch = -.006*math.sin(2*phase-.25)
            elif name == 'Idle':
                offset = Vector((.002*math.sin(phase),0,.002*math.sin(phase)))*scale
                pelvis_yaw = pelvis_roll = pelvis_pitch = 0
                spine_yaw = .008*wave(phase,.15)
                spine_roll = 0
                spine_pitch = .006*math.sin(phase)
            else:
                offset = Vector((.006*strike,-.16/scale*strike,-.035*strike))*scale
                pelvis_yaw = -.012*strike
                pelvis_roll = 0
                pelvis_pitch = .007*strike
                spine_yaw = .035*strike
                spine_roll = 0
                spine_pitch = .023*strike
            rotation = (Quaternion((0,0,1),pelvis_yaw) @ Quaternion((0,1,0),pelvis_roll) @
                        Quaternion((1,0,0),pelvis_pitch)).to_matrix().to_4x4()
            body.matrix = (Matrix.Translation(pivot+offset) @ rotation @
                           Matrix.Translation(-pivot) @ body.bone.matrix_local)
            turn('Spine',spine_pitch,spine_roll,spine_yaw)
            # Small counter-motion keeps the gaze steadier than the torso.
            turn('Head',-.45*spine_pitch-.015*strike,-.4*spine_roll,-.5*spine_yaw)
            bpy.context.view_layer.update()
            body_delta = body.matrix @ body.bone.matrix_local.inverted()
            spine_delta = spine.matrix @ spine.bone.matrix_local.inverted()

            for side,sign in (('L',-1),('R',1)):
                if name == 'Walk':
                    drag = .033*math.sin(phase-.65+sign*.16)
                    turn(f'Hair.{side}',.016*math.sin(phase-.8),0,sign*drag)
                else:
                    drag = .022*wave(phase,.65+sign*.12) if name == 'Idle' else .065*settle
                    turn(f'Hair.{side}',.010*wave(phase,.8) if name=='Idle' else .023*settle,0,sign*drag)
            cloth = (.024*math.sin(phase-.55) if name=='Walk' else
                     .013*wave(phase,.7) if name=='Idle' else .045*settle)
            turn('Skirt.Front',.3*cloth,0,cloth)
            if name == 'Walk':
                turn('Arm.L.upper',.18*math.sin(phase-.08),.022*math.sin(phase),0)
                turn('Arm.L.lower',.055*(1-math.cos(phase-.28)),0,0)
                turn('Hand.L',.035*math.sin(phase-.55),0,0)
                turn('Arm.R.upper',-.075*math.sin(phase-.10),0,0)
                turn('Arm.R.lower',-.045*math.sin(phase-.35),0,0)
                turn('Hand.R',-.032*math.sin(phase-.60),0,0)
                turn('Grasp.R',.022*math.sin(phase-.75),0,0)
            elif name == 'Idle':
                # Different phases and arcs let the elbows lead each wrist in
                # turn, rather than lifting both forearms as a mirrored pair.
                turn('Arm.L.upper',.014*wave(phase,.2),.018*wave(phase,.1),0)
                turn('Arm.L.lower',.012*wave(phase,.5),.028*wave(phase,.5),0)
                turn('Hand.L',.012*wave(phase,.8),.045*wave(phase,1.0),0)
                turn('Arm.R.upper',-.010*wave(phase,.9),-.018*wave(phase,.95),0)
                turn('Arm.R.lower',.010*wave(phase,1.1),-.036*wave(phase,1.3),0)
                turn('Hand.R',.012*wave(phase,.7),-.055*wave(phase,1.55),0)
                turn('Grasp.R',0,.018*wave(phase,1.7),0)
                turn('Curl.R',0,.012*wave(phase,1.85),0)
            else:
                turn('Arm.L.upper',.065*strike,0,-.035*strike)
                turn('Arm.L.lower',.04*settle,0,0)
                turn('Hand.R',0,.12*reach-.20*pluck,0)
                grasp = envelope(t,[(0,0),(2/30,-.12),(5/30,-.16),(7/30,1.10),
                                    (17/30,1.10),(24/30,.25),(1,0)])
                # Flex toward the palm; the opposite sign extends the fingers
                # away from it. The distal joint completes the closed fist.
                turn('Grasp.R',0,grasp,0)
                turn('Curl.R',0,grasp*1.10,0)
                thumb = rig.pose.bones['Thumb.R']
                axis = thumb.bone.matrix_local.to_3x3().inverted() @ THUMB_AXIS
                thumb.rotation_quaternion = Quaternion(axis,.75*max(0,grasp)/1.10)
                shoulder0, elbow0, wrist0 = arms['R']
                shoulder = spine_delta @ shoulder0
                target = transform @ Vector((.21,-.315,1.205))
                clutch = transform @ Vector((.14,-.16,1.15))
                wrist = spine_delta @ wrist0.lerp(target,reach).lerp(clutch,pluck)
                # Dart out, close on impact, then pull the closed hand inward
                # before releasing it back into the open, sideways ready pose.
                wrist += Vector((.012,0,.015))*scale*math.sin(math.pi*reach)
                elbow = solve_knee(shoulder,wrist,spine_delta @ elbow0,
                                   (elbow0-shoulder0).length,(wrist0-elbow0).length)
                set_bone_segment(rig,'Arm.R.upper',shoulder,elbow)
                set_bone_segment(rig,'Arm.R.lower',elbow,wrist)

            for side,(hip0,knee0,ankle0,toe0) in legs.items():
                hip = body_delta @ hip0
                ankle = ankle0.copy()
                foot_rotation = Quaternion((1,0,0),0)
                if name == 'Walk':
                    cycle = (t+(0 if side=='L' else .5))%1
                    if cycle <= .55:
                        ankle.y += -.275+cycle
                        pitch = (-.12*(1-smoothstep(0,.12,cycle)) +
                                 .18*smoothstep(.40,.55,cycle))
                        clearance = 0
                    else:
                        step = (cycle-.55)/.45
                        h00=2*step**3-3*step**2+1
                        h10=step**3-2*step**2+step
                        h01=-2*step**3+3*step**2
                        h11=step**3-step**2
                        ankle.y += .275*h00+.45*h10-.275*h01+.45*h11
                        clearance = .095*math.sin(math.pi*step)**2
                        pitch = .18*(1-smoothstep(0,.55,step))-.12*smoothstep(.45,1,step)
                    foot_rotation = Quaternion((1,0,0),pitch)
                    # Ground the actual sole through heel contact and toe-off;
                    # keeping just the ankle at a fixed height causes clipping.
                    floor = min((ankle0+foot_rotation @ p).z for p in foot_support[side])
                    ankle.z += clearance-floor
                upper,lower=(knee0-hip0).length,(ankle0-knee0).length
                knee=solve_knee(hip,ankle,hip+Vector((0,-scale,0)),upper,lower)
                set_bone_segment(rig,f'Leg.{side}.upper',hip,knee)
                set_bone_segment(rig,f'Leg.{side}.lower',knee,ankle)
                set_bone_segment(rig,f'Foot.{side}',ankle,ankle+foot_rotation @ (toe0-ankle0))
            for bone in rig.pose.bones:
                previous=previous_quaternions.get(bone.name)
                if previous is not None and bone.rotation_quaternion.dot(previous)<0:
                    bone.rotation_quaternion.negate()
                previous_quaternions[bone.name]=bone.rotation_quaternion.copy()
                for channel in ('location','rotation_quaternion','scale'):
                    bone.keyframe_insert(channel,frame=frame,group=bone.name)
        # Smooth trajectories above are baked at 60 Hz. Linear interpolation
        # between dense samples is stable in Blender and the runtime GLB mixer.
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation='LINEAR'
    rig.animation_data.action=None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    scene.frame_set(0)
    bpy.context.view_layer.update()
