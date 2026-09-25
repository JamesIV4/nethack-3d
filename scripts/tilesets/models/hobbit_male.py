"""Tile 90: a quick, barefoot hobbit with a held dagger.

The closed CC0 male cage has the same vertex order as the nymph's CC0 cage.
The latter supplies anatomical weight regions only; all visible anatomy is male.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import pixelhack_blender as ph
from pixelhack_face import blink_lids
from pixelhack_rig import bind, create_rig, envelope, set_bone_segment, solve_knee

PARTS = {}
ARMS = {}
LEGS = {}
GRIPS = {}
CURLS = {}
THUMBS = {}
WEAPON_GRIP = Vector((0,0,0))
# The complete dagger leaves the thumb-index web diagonally forward and
# inward toward the raised arm, roughly 45 degrees from vertical in front.
# The arm stays within its original source segment lengths.
DAGGER_AXIS = Vector((.700,-.500,.700)).normalized()
FINGER_HINGE = Vector((0,1,0))


def part(obj, bone):
    PARTS[obj.name] = bone
    return obj


def smooth(obj):
    return ph.smooth_surface(obj)


def mix(a, b, t):
    t = max(0, min(1, t))
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(4))


def ease(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def paint(obj, shade):
    colors = obj.data.color_attributes['Palette']
    for loop in obj.data.loops:
        vertex = obj.data.vertices[loop.vertex_index]
        colors.data[loop.index].color = shade(vertex.co, vertex.normal)
    return obj


def segment_map(start, end, target_start, target_end):
    a, b, c, d = map(Vector, (start, end, target_start, target_end))
    return Matrix.Translation(c) @ (b-a).rotation_difference(d-c).to_matrix().to_4x4() @ Matrix.Translation(-a)


def short_form(p):
    """Shorten the legs, keep a roomy torso and enlarge the head/feet."""
    x, y, z = p
    if z < .90:
        height = z * .70
    elif z < 1.43:
        height = .63 + (z - .90) * .76
    else:
        height = 1.0328 + (z - 1.43) * 1.04
    head = ease(1.43, 1.57, z)
    foot = 1 - ease(.08, .19, z)
    x *= .90 * (1 + .07 * head + .34 * foot)
    y *= 1 + .045 * head + .33 * foot
    # Give the trousers a comfortable belly without distorting the face.
    belly = math.exp(-((z - 1.05) / .21) ** 2) * max(0, -y)
    y -= .11 * belly
    return Vector((x, y, height))


def source_weights(p):
    """Regions in the topology-matched female cage, before the male is posed."""
    x, y, z = p
    side = 'L' if x < 0 else 'R'
    x = abs(x)
    if z > 1.28:
        head = ease(1.28, 1.35, z)
        return {'Head': head, 'Body': 1-head}
    if x > (.135 if z > 1.10 else .16 if z > .93 else .205) and z > .70:
        arm = ease(.132, .19, x)
        if z > 1.08:
            return {f'Arm.{side}.upper': arm, 'Body': 1-arm}
        lower = 1-ease(1.00,1.10,z)
        hand = 1-ease(.835,.885,z)
        grasp = 1-ease(.785,.815,z)
        result={'Body': 1-arm, f'Arm.{side}.upper': arm*(1-lower),
                f'Arm.{side}.lower': arm*lower*(1-hand),
                f'Hand.{side}': arm*lower*hand*(1-grasp),
                f'Grasp.{side}': arm*lower*hand*grasp}
        if side=='L':
            distal=1-ease(.758,.785,z)
            result['Curl.L']=result['Grasp.L']*distal
            result['Grasp.L']*=1-distal
        return result
    if z < .94:
        leg = 1-ease(.77,.94,z)
        lower = 1-ease(.435,.525,z)
        foot = 1-ease(.08,.15,z)
        return {'Body': 1-leg, f'Leg.{side}.upper': leg*(1-lower),
                f'Leg.{side}.lower': leg*lower*(1-foot),
                f'Foot.{side}': leg*lower*foot}
    return {'Body': 1}


def thick_surface(obj, thickness=.003):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Fabric thickness and closed rims','SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    topology = ph.mesh_topology(obj)
    if topology != {'components': 1, 'nonManifoldEdges': 0}:
        raise ValueError(f'{obj.name} must be a connected, closed shell: {topology}')
    obj['topology_components'] = 1
    obj['topology_nonmanifold_edges'] = 0
    return smooth(obj)


def cloth_tube(name, rings, color, bone, sides=28, angle_start=0, angle_span=math.tau):
    """A single continuous, closed garment surface with authored ring shape."""
    vertices = []
    for z, rx, ry, cy in rings:
        for j in range(sides+1 if angle_span < math.tau else sides):
            angle = angle_start + angle_span*j/sides
            vertices.append((rx*math.cos(angle), cy+ry*math.sin(angle), z))
    stride = sides+1 if angle_span < math.tau else sides
    faces = []
    for row in range(len(rings)-1):
        for col in range(sides):
            nxt = col+1 if stride == sides+1 else (col+1)%sides
            a = row*stride+col
            b = row*stride+nxt
            faces.append((a,b,b+stride,a+stride))
    obj = thick_surface(ph.mesh(name, vertices, faces, color))
    return part(obj,bone)


def tapered_blade(name, base, tip, width, color, bone):
    """Double-beveled steel with a clear cutting silhouette at small sizes."""
    a,b=Vector(base),Vector(tip)
    along=(b-a).normalized()
    # The bevel's wide axis follows the authored blade angle so the cutting
    # edge leads the forward attack. Its cross-section is fixed across clips.
    across=(Vector((0,0,1))-along*along.z).normalized()
    normal=along.cross(across).normalized()
    centers=[a,a.lerp(b,.18),a.lerp(b,.72),b]
    radii=[.008,width,width*.55,.001]
    verts=[]
    for c,r in zip(centers,radii):
        verts.extend((c+across*r,c+normal*r*.22,c-across*r,c-normal*r*.22))
    faces=[]
    for row in range(3):
        for col in range(4):
            i=row*4+col
            faces.append((i,row*4+(col+1)%4,row*4+(col+1)%4+4,i+4))
    faces.extend(((3,2,1,0),(12,13,14,15)))
    return part(ph.mesh(name,verts,faces,color),bone)


def scalp_lock(name, controls, widths, color):
    """Flatten a hair lock against the local scalp tangent all around the head."""
    controls=[Vector(p) for p in controls]
    points=[];radii=[];sides=8
    for index in range(len(controls)-1):
        a,b=controls[index:index+2]
        before=controls[index-1] if index else 2*a-b
        after=controls[index+2] if index+2<len(controls) else 2*b-a
        for step in range(2):
            t=step/2
            points.append(.5*((2*a)+(-before+b)*t+
                               (2*before-5*a+4*b-after)*t*t+
                               (-before+3*a-3*b+after)*t*t*t))
            radii.append(widths[index]*(1-t)+widths[index+1]*t)
    points.append(controls[-1]);radii.append(widths[-1])
    vertices=[];faces=[]
    for i,(p,width) in enumerate(zip(points,radii)):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        outward=Vector((p.x/.165,(p.y+.015)/.13,(p.z-1.255)/.135)).normalized()
        lateral=tangent.cross(outward).normalized()
        depth=tangent.cross(lateral).normalized()
        for j in range(sides):
            angle=math.tau*j/sides
            vertices.append(p+width*math.cos(angle)*lateral+
                            width*.35*math.sin(angle)*depth)
    for row in range(len(points)-1):
        for j in range(sides):
            a=row*sides+j;b=row*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend((tuple(range(sides-1,-1,-1)),
                  tuple((len(points)-1)*sides+j for j in range(sides))))
    return smooth(ph.mesh(name,vertices,faces,color))


def build():
    global FINGER_HINGE, WEAPON_GRIP
    PARTS.clear(); ARMS.clear(); LEGS.clear(); GRIPS.clear(); CURLS.clear(); THUMBS.clear()
    ph.VIEWS['hero']=(2.6,-5,2.1)
    ph.VIEWS['front']=(0,-5,1.4)
    ph.PALETTE.clear()
    ph.PALETTE.update({
        'shell':'70472f','ink':'211a1b',
        'skin':'b96e4d','skin_light':'eeac71','skin_shadow':'824630','lip':'99533b',
        'sclera':'f2e9ce','iris':'615237','pupil':'241e1b',
        'hair':'352420','hair_light':'5c3525','hat':'382821','hat_light':'714025',
        'shirt':'668a24','shirt_light':'a3ac38','shirt_dark':'344a18',
        'vest':'70422e','vest_light':'9e5a38','vest_dark':'3d261e',
        'trousers':'7b4a35','trousers_light':'a36543',
        'belt':'30251c','brass':'d7a748','blade':'aeb9b6','blade_light':'e5e4c8',
    })
    data=Path(__file__).parent/'data'
    male=json.loads((data/'stylized-male-cc0.json').read_text())
    female=json.loads((data/'stylized-female-cc0.json').read_text())
    assert male['faces']==female['faces'], 'Anatomical weight correspondence changed'
    body=smooth(ph.mesh('Skin | complete male anatomical cage',
                        male['vertices'],male['faces'],'skin'))
    # Source landmarks are found by corresponding vertices; the body remains
    # the male cage, with the female nymph topology used only for joint regions.
    def landmark(co, sign=1):
        target=Vector((co[0]*sign,co[1],co[2]))
        index=min(range(len(female['vertices'])),
                  key=lambda i:(Vector(female['vertices'][i])-target).length_squared)
        return short_form(male['vertices'][index])
    matrices={'Body':Matrix.Identity(4),'Head':Matrix.Identity(4)}
    for sign,side in ((-1,'L'),(1,'R')):
        shoulder=landmark((.15,0,1.235),sign)
        elbow=landmark((.255,-.005,1.047),sign)
        wrist=landmark((.333,-.022,.862),sign)
        aim_shoulder=shoulder.copy()
        if side=='L':
            aim_elbow=Vector((-.330,-.120,.850))
            aim_wrist=Vector((-.470,-.180,.900))
        else:
            aim_elbow=Vector((.270,-.005,.76))
            aim_wrist=Vector((.345,-.105,.62))
        ARMS[side]=(aim_shoulder,aim_elbow,aim_wrist)
        matrices[f'Arm.{side}.upper']=segment_map(shoulder,elbow,aim_shoulder,aim_elbow)
        matrices[f'Arm.{side}.lower']=segment_map(elbow,wrist,aim_elbow,aim_wrist)
        knuckle=landmark((.346,-.032,.803),sign)
        tip=landmark((.350,-.037,.754),sign)
        if side=='L':
            hand_rotation=Quaternion((0,1,0),.14)
            hinge=Vector((0,1,0))
            FINGER_HINGE=hinge
        else:
            hand_rotation=Quaternion((0,1,0),-.12)
            hinge=Vector((0,1,0))
        turned=(Matrix.Translation(aim_wrist) @
                hand_rotation.to_matrix().to_4x4() @
                Matrix.Translation(-aim_wrist) @ matrices[f'Arm.{side}.lower'])
        matrices[f'Hand.{side}']=turned
        grip=turned @ knuckle
        grip_mat=(Matrix.Translation(grip) @
                  Quaternion(hinge,(-.60 if side=='L' else .15)).to_matrix().to_4x4() @
                  Matrix.Translation(-grip) @ turned)
        matrices[f'Grasp.{side}']=grip_mat
        GRIPS[side]=(grip,grip_mat @ tip)
        if side=='L':
            distal=grip_mat @ landmark((.348,-.035,.776),sign)
            matrices['Curl.L']=(Matrix.Translation(distal) @
                                 Quaternion(hinge,-.70).to_matrix().to_4x4() @
                                 Matrix.Translation(-distal) @ grip_mat)
            CURLS['L']=(distal,matrices['Curl.L'] @ tip)
            GRIPS['L']=(grip,distal)
            thumb_root=turned @ landmark((.329,-.048,.844),sign)
            thumb_tip=landmark((.318,-.079,.789),sign)
            thumb_axis=(turned.to_3x3() @ Vector((-1,0,0))).normalized()
            matrices['Thumb.L']=(Matrix.Translation(thumb_root) @
                                  Quaternion(thumb_axis,.55).to_matrix().to_4x4() @
                                  Matrix.Translation(-thumb_root) @ turned)
            THUMBS['L']=(thumb_root,matrices['Thumb.L'] @ thumb_tip+
                         Vector((-.038,.028,-.004)),thumb_axis)
        hip=landmark((.083,.015,.84),sign)
        knee=landmark((.073,-.035,.475),sign)
        ankle=landmark((.075,.008,.095),sign)
        target_hip=Vector((sign*.10,.018,.60))
        target_knee=Vector((sign*.115,-.065,.345))
        target_ankle=Vector((sign*.135,.035,.075))
        toe=Vector((sign*.145,-.15,.030))
        LEGS[side]=(target_hip,target_knee,target_ankle,toe)
        matrices[f'Leg.{side}.upper']=segment_map(hip,knee,target_hip,target_knee)
        matrices[f'Leg.{side}.lower']=segment_map(knee,ankle,target_knee,target_ankle)
        matrices[f'Foot.{side}']=Matrix.Translation(target_ankle-ankle)

    # Give the thumb its own topological branch. Spatial cutoffs alone put
    # some thumb vertices on the finger joint and create spikes in a grip.
    adjacency=[set() for _ in female['vertices']]
    for face in female['faces']:
        for a,b in zip(face,face[1:]+face[:1]):
            adjacency[a].add(b);adjacency[b].add(a)
    candidates={i for i,p in enumerate(female['vertices']) if p[0]<-.29 and p[2]<.82}
    seed=min(candidates,key=lambda i:female['vertices'][i][1])
    branch={seed};pending=[seed]
    while pending:
        fresh=(adjacency[pending.pop()] & candidates)-branch
        branch.update(fresh);pending.extend(fresh)
    assert len(branch)>8, 'Thumb branch must include the whole digit'
    thumb_weights={i:1 for i in branch};frontier=branch
    for amount in (.6,.2):
        frontier={j for i in frontier for j in adjacency[i] if j not in thumb_weights}
        thumb_weights.update({i:amount for i in frontier})
    weights=[]
    for v in body.data.vertices:
        female_p=Vector(female['vertices'][v.index])
        w={k:a for k,a in source_weights(female_p).items() if a>.00001}
        thumb=thumb_weights.get(v.index,0)
        if thumb:
            w['Thumb.L']=0
            for name in ('Hand.L','Grasp.L','Curl.L'):
                amount=w.get(name,0)*thumb
                w['Thumb.L']+=amount
                if name in w:w[name]-=amount
        total=sum(w.values())
        w={k:a/total for k,a in w.items()}
        p=short_form(v.co)
        v.co=sum(((matrices[k] @ p)*a for k,a in w.items()),Vector())
        if thumb>.01:
            # A small rest-pose correction bends the male cage's long thumb
            # toward the hilt without pulling its connected root out of the palm.
            tip_fold=(1-ease(.78,.85,female_p.z))*thumb
            v.co+=Vector((-.038,.028,-.004))*tip_fold
        chest=ease(.72,.99,p.z)
        if w.get('Body',0):
            torso=w['Body'];w['Body']=torso*(1-chest);w['Spine']=torso*chest
        weights.append(w)
    body.data.update()
    if ph.mesh_topology(body)!={'components':1,'nonManifoldEdges':0}:
        raise ValueError('The entire male body must remain closed under its clothing')
    PARTS[body.name]=weights
    skin,light=ph.linear(ph.PALETTE['skin']),ph.linear(ph.PALETTE['skin_light'])
    def complexion(p,n):
        face=ease(1.08,1.16,p.z)
        lip=math.exp(-((p.z-1.14)/.011)**2-(p.x/.035)**4)
        base=mix(skin,light,.18+.14*max(0,-n.y)+.16*face)
        return mix(base,ph.linear(ph.PALETTE['lip']),.45*lip if p.y<-.11 else 0)
    paint(body,complexion)
    surface=BVHTree.FromPolygons([v.co for v in body.data.vertices],
                                  [list(p.vertices) for p in body.data.polygons])
    def body_hit(angle,z,clearance=.008):
        direction=Vector((math.cos(angle),math.sin(angle),0))
        hit,_,_,_=surface.ray_cast(Vector((0,0,z)),direction)
        if hit is None: raise ValueError(f'Clothing missed body at {z}')
        return hit+direction*clearance
    def garment(name, color, bottom, top, neckline, clearance, gap=0):
        sides=32
        span=math.tau-gap
        start=-math.pi/2+gap/2
        stride=sides+1 if gap else sides
        verts=[];faces=[]
        for row in range(11):
            t=row/10
            for col in range(stride):
                angle=start+span*col/sides
                front=max(0,-math.sin(angle))
                z=bottom+(top-neckline*front-bottom)*t
                p=body_hit(angle,z,clearance)
                direction=Vector((math.cos(angle),math.sin(angle),0))
                # Keep the waistcoat's sides straight and its hem loose. A
                # body-tight inward curve made the earlier vest read as a corset.
                radial=math.hypot(p.x,p.y)
                target=math.hypot(.187*math.cos(angle),.171*math.sin(angle))
                p+=direction*(max(0,target-radial)*(.75-.35*t)+
                              .006*(1-t)+.002*math.sin(5*angle+z*8)*(1-t))
                verts.append(p)
        for row in range(10):
            for col in range(sides):
                nxt=col+1 if gap else (col+1)%sides
                a=row*stride+col;b=row*stride+nxt
                faces.append((a,b,b+stride,a+stride))
        obj=thick_surface(ph.mesh(name,verts,faces,color),.003)
        obj['construction']='Continuous fitted torso garment with closed neckline, hem and opening rims'
        bind_weights=[]
        for v in obj.data.vertices:
            ch=ease(.72,.98,v.co.z)
            bind_weights.append({'Body':1-ch,'Spine':ch})
        PARTS[obj.name]=bind_weights
        return obj
    # A torso plus two separately intersecting sleeve tubes would not be a
    # connected shirt. Extract one continuous patch of the anatomical cage,
    # offset it for cloth clearance, and close all of its neckline, hem and
    # sleeve rims. The complete skin stays underneath.
    covered=[]
    for source_p in female['vertices']:
        x,_,z=source_p
        covered.append(.80<=z<=1.30 and
                       (abs(x)<.212 or (z>=1.020 and abs(x)<.340)))
    selected=sorted({i for face in body.data.polygons
                     if all(covered[i] for i in face.vertices)
                     for i in face.vertices})
    indices={old:new for new,old in enumerate(selected)}
    shirt_faces=[tuple(indices[i] for i in face.vertices)
                 for face in body.data.polygons
                 if all(i in indices for i in face.vertices)]
    shirt_points=[body.data.vertices[i].co + body.data.vertices[i].normal*.018
                  for i in selected]
    shirt=thick_surface(ph.mesh('Shirt | continuous torso and sleeves',
                                shirt_points,shirt_faces,'shirt'),.003)
    shirt['construction']='One body-derived quad surface with connected sleeves and solidified rims'
    tree=KDTree(len(shirt_points))
    for i,p in enumerate(shirt_points):tree.insert(p,i)
    tree.balance()
    PARTS[shirt.name]=[weights[selected[tree.find(v.co)[1]]].copy()
                       for v in shirt.data.vertices]
    paint(shirt,lambda p,n:mix(ph.linear(ph.PALETTE['shirt_dark']),
                               ph.linear(ph.PALETTE['shirt_light']),.45+.28*max(0,-n.y)))
    vest=garment('Vest | loose open-front waistcoat','vest',.620,.925,.045,.030,.90)
    paint(vest,lambda p,n:mix(ph.linear(ph.PALETTE['vest_dark']),
                              ph.linear(ph.PALETTE['vest_light']),.35+.26*max(0,-n.y)))
    # The CC0 anatomical cage already contains five toes per bare foot.
    # A real pair-of-pants topology: one waist loop branches into two leg
    # loops across a shared inside seam. Every source edge has two incident
    # faces except the waist/cuffs, which Solidify closes. No genital-shaped
    # copy of the skin and no intersecting short-pant primitives are needed.
    pants_points=[];pants_faces=[];count=32
    outer=[]
    for z,rx,ry,cy in ((.678,.166,.139,.003),(.580,.180,.146,.003),
                       (.488,.198,.154,.003)):
        loop=[]
        for j in range(count):
            a=-math.pi/2+math.tau*j/count
            loop.append(len(pants_points))
            pants_points.append(Vector((rx*math.cos(a),cy+ry*math.sin(a),z)))
        outer.append(loop)
    for above,below in zip(outer,outer[1:]):
        for j in range(count):
            nxt=(j+1)%count
            pants_faces.append((above[j],below[j],below[nxt],above[nxt]))
    # The two inside leg surfaces share this seam instead of overlapping.
    inside=[]
    for j in range(1,16):
        u=j/16
        inside.append(len(pants_points))
        pants_points.append(Vector((0,.003+.154*(1-2*u),
                                    .475-.024*math.sin(math.pi*u))))
    right_top=outer[-1][:17]+inside
    left_top=outer[-1][16:]+outer[-1][:1]+inside[::-1]
    assert len(right_top)==len(left_top)==32
    for side,top,phase in (('R',right_top,-math.pi/2),
                           ('L',left_top,math.pi/2)):
        previous=top
        sign=1 if side=='R' else -1
        for z,rx,ry in ((.420,.108,.115),(.330,.100,.102)):
            loop=[]
            for j in range(count):
                a=phase+math.tau*j/count
                loop.append(len(pants_points))
                pants_points.append(Vector((sign*.100+rx*math.cos(a),
                                            -.006+ry*math.sin(a),z)))
            for j in range(count):
                nxt=(j+1)%count
                pants_faces.append((previous[j],loop[j],loop[nxt],previous[nxt]))
            previous=loop
    # Let the two front legs clear the anatomical thighs without widening the
    # waist or making the whole garment balloon outward.
    for p in pants_points:
        if p.y<-.035:
            p.y-=.046*ease(.035,.13,-p.y)*math.exp(-((p.z-.49)/.115)**2)
    pants=thick_surface(ph.mesh('Trousers | continuous joined breeches',
                                pants_points,pants_faces,'trousers'),.004)
    pants['construction']='One branching quad garment with shared crotch seam and closed waist and cuffs'
    def trouser_color(p,n):
        base=mix(ph.linear(ph.PALETTE['trousers']),
                 ph.linear(ph.PALETTE['trousers_light']),
                 .14+.20*max(0,-n.y)+.06*math.sin(7*p.z+9*p.x))
        return mix(base,ph.linear(ph.PALETTE['vest_dark']),
                   .55*(1-ease(.38,.44,p.z)))
    paint(pants,trouser_color)
    pants_weights=[]
    for vertex in pants.data.vertices:
        p=vertex.co
        leg=1-ease(.425,.625,p.z)
        right=ease(-.045,.045,p.x)
        pants_weights.append({'Body':1-leg,'Leg.L.upper':leg*(1-right),
                              'Leg.R.upper':leg*right})
    PARTS[pants.name]=pants_weights
    cloth_tube('Belt | fitted dark leather',[(.640,.179,.150,.003),(.665,.178,.149,.003)],
               'belt','Body')
    part(smooth(ph.ellipsoid('Belt | brass buckle',(0,-.150,.652),(.022,.009,.021),'brass',1)),'Body')

    # Inset male-cage eyes, curved socket lids and an unkeyed Blink morph.
    for sign,side in ((-1,'L'),(1,'R')):
        eye=(sign*.039,-.088,short_form((0,-.0843,1.6300)).z)
        sclera=part(smooth(ph.ellipsoid(f'Eye {side} | sclera',eye,(.037,.037,.037),'sclera',2)),'Head')
        for lid in blink_lids(f'Eyelid {side}',eye,(.037,.037,.037),'skin',
                              eye=sclera,socket=body,front_margin=.007):
            part(lid,'Head')
        part(smooth(ph.ellipsoid(f'Eye {side} | iris',(eye[0],eye[1]-.034,eye[2]),
                                 (.014,.004,.017),'iris',2)),'Head')
        part(smooth(ph.ellipsoid(f'Eye {side} | pupil',(eye[0],eye[1]-.038,eye[2]),
                                 (.007,.002,.009),'pupil',1)),'Head')
    # Project a fitted underlay onto the head, receding above the forehead.
    # Overlapping locks then turn their flat profiles with the scalp tangent;
    # a fixed world profile left large gaps around the temples and back.
    scalp_center=Vector((0,-.015,1.255))
    def scalp_extent(angle):
        front=max(0,-math.sin(angle))
        return 1.68-.75*front**3-.05*max(0,math.sin(angle))
    def scalp_point(angle,theta):
        direction=Vector((math.sin(theta)*math.cos(angle),
                          math.sin(theta)*math.sin(angle),math.cos(theta)))
        hit,_,_,_=surface.ray_cast(scalp_center,direction,.35)
        if hit is None:raise ValueError('Hair underlay missed the anatomical head')
        return hit+direction*.008
    cap_columns=36;cap_rows=7
    cap_vertices=[scalp_point(0,0)];cap_faces=[]
    for row in range(1,cap_rows+1):
        for col in range(cap_columns):
            a=math.tau*col/cap_columns
            cap_vertices.append(scalp_point(a,scalp_extent(a)*row/cap_rows))
    for col in range(cap_columns):
        cap_faces.append((0,1+col,1+(col+1)%cap_columns))
    for row in range(cap_rows-1):
        for col in range(cap_columns):
            a=1+row*cap_columns+col;b=1+row*cap_columns+(col+1)%cap_columns
            cap_faces.append((a,b,b+cap_columns,a+cap_columns))
    cap=thick_surface(ph.mesh('Hair | fitted scalp underlay',
                              cap_vertices,cap_faces,'hair'),.0025)
    part(cap,'Head')
    for i in range(18):
        a=math.tau*i/18
        front=max(0,-math.sin(a))
        root=scalp_point(a,.42)
        upper=scalp_point(a,min(scalp_extent(a)-.03,.94))
        fall=Vector((.165*math.cos(a)+.008*math.sin(3*a),
                     -.015+.141*math.sin(a),1.18+.10*front+.012*math.sin(i*1.7)))
        tip=fall+Vector((-.014*math.sin(a),.014*math.cos(a),.022))
        curl=scalp_lock(f'Hair | turning lock {i+1}',
            [root,upper,Vector((.160*math.cos(a),-.015+.136*math.sin(a),
                                1.265+.06*front)),fall,tip],
            [.012,.034,.036,.020,.002],
            'hair_light' if i%5==0 else 'hair')
        part(curl,'Head')
    # Center the near-circular brim on the head's front/back axis. The earlier
    # wide-X oval and sideways tilt made the hat read as turned on his head.
    hat_vertices=[];hat_faces=[];segments=40
    hat_rings=((1.486,.012,.012),(1.493,.076,.075),(1.478,.135,.125),
               (1.435,.162,.147),(1.388,.170,.150),(1.352,.171,.149),
               (1.344,.190,.169),(1.337,.264,.251),(1.327,.262,.249),
               (1.330,.140,.125))
    for z,rx,ry in hat_rings:
        for j in range(segments):
            a=math.tau*j/segments
            front=max(0,-math.sin(a))
            hat_vertices.append((rx*math.cos(a),-.015+ry*math.sin(a),
                                 z-.004*front))
    for row in range(len(hat_rings)-1):
        for j in range(segments):
            a=row*segments+j;b=row*segments+(j+1)%segments
            hat_faces.append((a,b,b+segments,a+segments))
    hat_faces.extend((tuple(range(segments-1,-1,-1)),
                      tuple((len(hat_rings)-1)*segments+j for j in range(segments))))
    hat=smooth(ph.mesh('Hat | continuous slouched crown and brim',
                       hat_vertices,hat_faces,'hat'))
    if ph.mesh_topology(hat)!={'components':1,'nonManifoldEdges':0}:
        raise ValueError('Hat crown and brim must be one connected surface')
    def hat_color(p,n):
        base=mix(ph.linear(ph.PALETTE['hat']),ph.linear(ph.PALETTE['hat_light']),
                 .14+.13*max(0,-n.y))
        band=math.exp(-((p.z-1.365)/.016)**4)
        return mix(base,ph.linear(ph.PALETTE['vest_light']),.43*band)
    paint(hat,hat_color)
    part(hat,'Head')

    # The left hand holds a compact steel dagger. A separate Weapon bone lets
    # the blade snap independently of the arm at impact.
    hand=ARMS['L'][2]
    # The hilt starts in the palm, continues between the curled fingers, and
    # only then reaches the guard. The blade follows the posed finger axis.
    # Center the hilt in the anatomical web between index knuckle and thumb
    # root, then run it through the palm before the guard clears the fingers.
    web=(GRIPS['L'][0]+THUMBS['L'][0])*.5
    WEAPON_GRIP=web.copy()
    handle_origin=web-DAGGER_AXIS*.125
    hilt=handle_origin+DAGGER_AXIS*.055
    guard=handle_origin+DAGGER_AXIS*.192
    point=guard+DAGGER_AXIS*.240
    blade_axis=DAGGER_AXIS
    crossguard=(Vector((0,0,1))-blade_axis*blade_axis.z).normalized()
    part(smooth(ph.tube('Dagger | wrapped grip',[hilt,web,guard],
                         [.016,.018,.017],12,'belt')),'Weapon')
    part(smooth(ph.tube('Dagger | brass guard',
                         [guard-crossguard*.032,guard+crossguard*.032],
                         [.012,.012],10,'brass')),'Weapon')
    tapered_blade('Dagger | double-edged steel',guard,point,.050,'blade','Weapon')
    tapered_blade('Dagger | bright center ridge',guard+Vector((0,-.002,0)),point,
                  .007,'blade_light','Weapon')


def rig_model(objects,transform):
    specs={
        'Root':((0,0,.05),(0,0,.24),None),
        'Body':((0,.02,.62),(0,0,.96),'Root'),
        'Spine':((0,0,.76),(0,0,1.025),'Body'),
        'Head':((0,0,1.045),(0,0,1.28),'Spine'),
    }
    for side,(shoulder,elbow,wrist) in ARMS.items():
        specs[f'Arm.{side}.upper']=(shoulder,elbow,'Spine')
        specs[f'Arm.{side}.lower']=(elbow,wrist,f'Arm.{side}.upper')
        knuckle,tip=GRIPS[side]
        specs[f'Hand.{side}']=(wrist,knuckle,f'Arm.{side}.lower')
        specs[f'Grasp.{side}']=(knuckle,tip,f'Hand.{side}')
        if side=='L':
            specs['Curl.L']=(*CURLS['L'],'Grasp.L')
            specs['Thumb.L']=(THUMBS['L'][0],THUMBS['L'][1],'Hand.L')
    for side,(hip,knee,ankle,toe) in LEGS.items():
        specs[f'Leg.{side}.upper']=(hip,knee,'Body')
        specs[f'Leg.{side}.lower']=(knee,ankle,f'Leg.{side}.upper')
        specs[f'Foot.{side}']=(ankle,toe,f'Leg.{side}.lower')
    hand=ARMS['L'][2]
    # Weapon rotation pivots at the grip web, not the wrist. The hilt remains
    # seated between thumb and index as the separate blade snap plays.
    specs['Weapon']=(WEAPON_GRIP,WEAPON_GRIP+DAGGER_AXIS*.24,'Hand.L')
    rig=create_rig('Hobbit male | expressive deform rig',specs,transform)
    for obj in objects: bind(obj,rig,PARTS[obj.name])
    skin=next(obj for obj in objects if obj.name.startswith('Skin |'))
    soles={}
    for side in ('L','R'):
        ankle=transform @ LEGS[side][2]
        soles[side]=[v.co-ankle for v,w in zip(skin.data.vertices,PARTS[skin.name])
                     if w.get(f'Foot.{side}',0)>.98]
        assert len(soles[side])>20, 'Bare sole needs enough vertices for contact'
    animate(rig,transform,soles)
    return rig


def animate(rig,transform,soles):
    scene=bpy.context.scene;scene.render.fps=60
    scale=transform.to_scale().x
    legs={side:[transform @ p for p in points] for side,points in LEGS.items()}
    arms={side:[transform @ p for p in points] for side,points in ARMS.items()}
    body=rig.pose.bones['Body'];spine=rig.pose.bones['Spine']
    pivot=body.bone.head_local.copy()
    rig.animation_data_create()
    def turn(name,pitch=0,roll=0,yaw=0):
        bone=rig.pose.bones[name]
        inv=bone.bone.matrix_local.to_3x3().inverted()
        bone.rotation_quaternion=(Quaternion(inv @ Vector((0,0,1)),yaw) @
                                  Quaternion(inv @ Vector((0,1,0)),roll) @
                                  Quaternion(inv @ Vector((1,0,0)),pitch))
    def flex(name,angle):
        bone=rig.pose.bones[name]
        axis=bone.bone.matrix_local.to_3x3().inverted() @ FINGER_HINGE
        bone.rotation_quaternion=Quaternion(axis,angle)
    def wave(phase,lag=0):
        return math.sin(phase-lag)+math.sin(lag)
    for name,frames in (('Idle',181),('Walk',31),('Attack',37)):
        action=bpy.data.actions.new(name);action.use_fake_user=True
        rig.animation_data.action=action
        previous={}
        for frame in range(frames):
            scene.frame_set(frame)
            for bone in rig.pose.bones:bone.matrix_basis.identity()
            t=frame/(frames-1);phase=math.tau*t
            dash=slash=recoil=prep=0
            if name=='Attack':
                prep=envelope(t,[(0,0),(1/36,.50),(3/36,1),(6/36,.92),
                                  (10/36,0),(1,0)])
                dash=envelope(t,[(0,0),(1/36,.10),(4/36,.15),(7/36,.55),(11/36,1),
                                 (14/36,.95),(23/36,.32),(32/36,0),(1,0)])
                slash=envelope(t,[(0,0),(1/36,-.34),(4/36,-.70),(8/36,-.18),
                                  (11/36,1.15),(15/36,1.18),(23/36,.45),(1,0)])
                recoil=envelope(t,[(0,0),(10/36,0),(16/36,1),(25/36,.35),
                                   (31/36,-.13),(1,0)])
            if name=='Walk':
                offset=Vector((.028*math.sin(phase),-.025,
                               -.067+.026*(1-math.cos(2*phase))))*scale
                yaw=.14*math.sin(phase);roll=.06*math.sin(phase)
                pitch=.10+.050*math.sin(2*phase-.4)
                spine_yaw=-.24*math.sin(phase-.15)
                spine_roll=-.068*math.sin(phase-.10)
                spine_pitch=-.055+.027*math.sin(2*phase+.1)
            elif name=='Idle':
                # Breathing, shifting weight and a brief curious glance.
                glance=envelope(t,[(0,0),(.20,0),(.36,1),(.57,1),(.76,0),(1,0)])
                offset=Vector((.015*math.sin(phase)+.017*glance,-.010*math.sin(phase),
                               .007*wave(phase,.4)))*scale
                yaw=.022*math.sin(phase);roll=.018*math.sin(phase)
                pitch=.025*wave(phase,.3)
                spine_yaw=-.035*math.sin(phase)+.035*glance
                spine_roll=-.014*math.sin(phase)
                spine_pitch=.018*wave(phase,.45)
            else:
                offset=Vector((-.023*dash,-.165*dash,-.055*dash))*scale
                yaw=.30*dash-.61*slash
                roll=-.055*dash
                pitch=.22*dash-.06*recoil
                spine_yaw=-.18*dash+.46*slash
                spine_roll=.08*slash
                spine_pitch=.14*dash-.10*recoil
            rotation=(Quaternion((0,0,1),yaw) @ Quaternion((0,1,0),roll) @
                      Quaternion((1,0,0),pitch)).to_matrix().to_4x4()
            body.matrix=(Matrix.Translation(pivot+offset) @ rotation @
                         Matrix.Translation(-pivot) @ body.bone.matrix_local)
            turn('Spine',spine_pitch,spine_roll,spine_yaw)
            if name=='Idle':turn('Head',-.32*spine_pitch,-.04*glance,.24*glance-.5*spine_yaw)
            elif name=='Walk':turn('Head',-.30*spine_pitch,-.25*spine_roll,-.42*spine_yaw)
            else:turn('Head',-.12*dash+.14*recoil,0,-.18*slash)
            bpy.context.view_layer.update()
            body_delta=body.matrix @ body.bone.matrix_local.inverted()
            spine_delta=spine.matrix @ spine.bone.matrix_local.inverted()
            if name=='Idle':
                turn('Arm.L.upper',.035*wave(phase,.3)-.34*glance,0,-.015*math.sin(phase))
                turn('Arm.L.lower',.030*wave(phase,.65)-.14*glance,0,0)
                turn('Hand.L',.04*wave(phase,1),0,0)
                turn('Arm.R.upper',-.055*wave(phase,.8)-.10*glance,0,0)
                turn('Arm.R.lower',.045*wave(phase,1.1),0,0)
                turn('Hand.R',-.04*wave(phase,1.4),0,0)
                turn('Weapon',.045*wave(phase,1.4)-.20*glance,0,
                     .025*wave(phase,1.7)+.18*glance)
            elif name=='Walk':
                turn('Arm.L.upper',-.32*math.sin(phase-.15),0,0)
                turn('Arm.L.lower',-.10*math.sin(phase-.4),0,0)
                turn('Hand.L',-.055*math.sin(phase-.65),0,0)
                turn('Arm.R.upper',.50*math.sin(phase+.08),0,0)
                turn('Arm.R.lower',.16*math.sin(phase-.30),0,0)
                turn('Hand.R',.09*math.sin(phase-.55),0,0)
                turn('Weapon',-.12*math.sin(phase-.6),0,.05*math.sin(phase-.85))
            else:
                # The elbow leads the strike, then the wrist and blade whip
                # forward separately at impact. The other arm braces the torso.
                turn('Arm.R.upper',-.20*dash,0,-.10*dash)
                turn('Arm.R.lower',-.28*dash,0,0)
                turn('Hand.R',.13*recoil,0,0)
                turn('Hand.L',.30*slash,0,-.96*slash)
                flex('Grasp.L',-.14*slash)
                flex('Curl.L',-.18*slash)
                turn('Weapon',.25*slash,0,-.08*slash)
                shoulder0,elbow0,wrist0=arms['L']
                shoulder=spine_delta @ shoulder0
                target=transform @ Vector((-.30,-.37,1.03))
                back=transform @ Vector((-.34,.035,1.105))
                wrist=spine_delta @ wrist0.lerp(back,prep).lerp(target,dash)
                try:
                    elbow=solve_knee(shoulder,wrist,spine_delta @ elbow0,
                                     (elbow0-shoulder0).length,(wrist0-elbow0).length)
                except ValueError as error:
                    raise ValueError(f'{name} frame {frame}: striking hand target is out of reach '
                                     f'(shoulder={tuple(shoulder)}, wrist={tuple(wrist)})') from error
                set_bone_segment(rig,'Arm.L.upper',shoulder,elbow)
                set_bone_segment(rig,'Arm.L.lower',elbow,wrist)
            for side,(hip0,knee0,ankle0,toe0) in legs.items():
                hip=body_delta @ hip0
                ankle=ankle0.copy();foot_rotation=Quaternion((1,0,0),0)
                if name=='Walk':
                    cycle=(t+(0 if side=='L' else .5))%1
                    stride=.55*scale
                    if cycle<=.54:
                        ankle.y+=stride*(-.5+cycle/.54)
                        pitch=-.17*(1-ease(0,.12,cycle))+.28*ease(.40,.54,cycle)
                        lift=0
                    else:
                        u=(cycle-.54)/.46
                        h00=2*u**3-3*u**2+1;h10=u**3-2*u**2+u
                        h01=-2*u**3+3*u**2;h11=u**3-u**2
                        ankle.y+=stride*(.5*h00+.46*h10-.5*h01+.46*h11)
                        pitch=.28*(1-ease(0,.50,u))-.17*ease(.45,1,u)
                        lift=.125*scale*math.sin(math.pi*u)**2
                    foot_rotation=Quaternion((1,0,0),pitch)
                    floor=min((ankle0+foot_rotation @ p).z for p in soles[side])
                    ankle.z+=lift-floor
                elif name=='Attack':
                    if side=='L':
                        ankle.y-=.120*dash*scale
                        ankle.x-=.030*dash*scale
                    else:
                        ankle.y+=.048*dash*scale
                    # Both support feet stay planted during the sweeping cut.
                upper=(knee0-hip0).length;lower=(ankle0-knee0).length
                knee=solve_knee(hip,ankle,hip+Vector((0,-scale,0)),upper,lower)
                set_bone_segment(rig,f'Leg.{side}.upper',hip,knee)
                set_bone_segment(rig,f'Leg.{side}.lower',knee,ankle)
                set_bone_segment(rig,f'Foot.{side}',ankle,ankle+foot_rotation @ (toe0-ankle0))
            for bone in rig.pose.bones:
                prev=previous.get(bone.name)
                if prev is not None and bone.rotation_quaternion.dot(prev)<0:
                    bone.rotation_quaternion.negate()
                previous[bone.name]=bone.rotation_quaternion.copy()
                for channel in ('location','rotation_quaternion','scale'):
                    bone.keyframe_insert(channel,frame=frame,group=bone.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:key.interpolation='LINEAR'
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.matrix_basis.identity()
    scene.frame_set(0);bpy.context.view_layer.update()
