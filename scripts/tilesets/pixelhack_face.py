"""Shared facial geometry contract: unkeyed Blink morph, driven independently."""

import math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import pixelhack_blender as ph


def blink_lids(name, center, radii, color, *, eye, socket, front_margin=.002):
    """Two thin skin surfaces that unfold over an eye; returns editable parts.

    Open lids tuck into the surrounding face. The closed surfaces meet at the
    eye center, in front of the sclera/iris, rather than scaling the eyeball.
    No action owns this shape key: runtime blink scheduling is per instance.
    """
    cx,cy,cz=center
    rx,ry,rz=radii
    def bvh(obj):
        return BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
                                   [list(p.vertices) for p in obj.data.polygons])
    eyeball,face=bvh(eye),bvh(socket)
    def hits(x,z):
        origin=Vector((x,cy-1,z)); direction=Vector((0,1,0))
        return eyeball.ray_cast(origin,direction,2)[0], face.ray_cast(origin,direction,2)[0]
    def visible(x,z):
        a,b=hits(x,z)
        return a is not None and (b is None or a.y < b.y-.00001)
    if not visible(cx,cz):
        raise ValueError(f'{name}: eye center is not visible through its socket')
    # Trace the actual eye/face intersection, rather than assuming a spherical
    # cap fits the aperture. This keeps each lid inside its own socket contour.
    contour=[]
    for i in range(64):
        angle=math.tau*i/64
        lo,hi=0,1.1
        for _ in range(18):
            radius=(lo+hi)*.5
            x=cx+rx*math.cos(angle)*radius; z=cz+rz*math.sin(angle)*radius
            if visible(x,z): lo=radius
            else: hi=radius
        x=cx+rx*math.cos(angle)*lo; z=cz+rz*math.sin(angle)*lo
        a,b=hits(x,z)
        contour.append(Vector((x,a.y if b is None else min(a.y,b.y),z)))
    left=min(p.x for p in contour)+.00005
    right=max(p.x for p in contour)-.00005
    def boundary(x):
        cuts=[]
        for a,b in zip(contour,contour[1:]+contour[:1]):
            if min(a.x,b.x)<=x<=max(a.x,b.x) and abs(a.x-b.x)>1e-9:
                cuts.append(a.lerp(b,(x-a.x)/(b.x-a.x)))
        return min(cuts,key=lambda p:p.z),max(cuts,key=lambda p:p.z)
    result=[]
    for sign,label in ((1,'upper'),(-1,'lower')):
        closed=[]; opened=[]
        rows,columns=4,12
        for row in range(rows+1):
            t=row/rows
            for col in range(columns+1):
                x=left+(right-left)*col/columns
                bottom,top=boundary(x)
                rim=top if sign>0 else bottom
                seam=(top.z+bottom.z)*.5-sign*.00015
                z=rim.z*(1-t)+seam*t
                eye_hit,_=hits(x,z)
                # Anchor the perimeter to the socket, then follow the eyeball's
                # actual curved surface. A flat front plane leaves open side
                # walls visible in profile even when it covers the frontal view.
                y=rim.y-.0006 if row==0 else (
                    (eye_hit.y if eye_hit is not None else rim.y)-.002
                    -front_margin*min(1,2*t))
                closed.append(Vector((x,y,z)))
                opened.append(Vector((x,rim.y+.0002,rim.z+sign*.00015+.008*(z-rim.z))))
        faces=[]
        stride=columns+1
        for row in range(rows):
            for col in range(columns):
                a=row*stride+col
                faces.append((a,a+1,a+1+stride,a+stride))
        obj=ph.smooth_surface(ph.mesh(f'{name} | {label} lid',opened,faces,color))
        obj.shape_key_add(name='Basis')
        key=obj.shape_key_add(name='Blink')
        for point,co in zip(key.data,closed):
            point.co=co
        key.value=0
        result.append(obj)
    return result
