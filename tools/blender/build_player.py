"""
Builds the match player body (public/assets/models/player.glb), SPEC §18.3 contract:
Mixamo bone names, T-pose rest, 1.80 m, front faces +Z in glTF (-Y in Blender).

The body is a skin-modifier skeleton with athlete proportions, smoothed by subdivision,
then split into material slots by region so the game can colour it per kit:
  Skin, Shirt, Shorts, Socks, Boots, Hair.
Weights are automatic (bone heat). No animation clips: the game animates the rig itself
(procedural gait with planted feet, kicks, IK and ragdolls, SPEC §14.12).

Run:
  blender -b --factory-startup -P tools/blender/build_player.py -- public/assets/models/player.glb
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

H = 1.0  # global scale; numbers below are metres for a 1.80 m player


def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# --- Skeleton points (Blender: Z up, front = -Y) ------------------------------------------------
J = {
    'pelvis': (0, 0.0, 0.98),
    'waist': (0, 0.0, 1.10),
    'chest': (0, 0.0, 1.26),
    'upchest': (0, 0.0, 1.38),
    'neckb': (0, 0.0, 1.47),
    'neckt': (0, -0.01, 1.55),
    'head': (0, -0.01, 1.66),
    'headtop': (0, 0.0, 1.80),
    'hipL': (0.095, 0.0, 0.92),
    'kneeL': (0.10, -0.01, 0.51),
    'ankleL': (0.105, 0.02, 0.085),
    'ballL': (0.11, -0.10, 0.025),
    'toeL': (0.11, -0.17, 0.02),
    'clavL': (0.04, 0.0, 1.44),
    'shL': (0.185, 0.01, 1.44),
    'elbL': (0.46, 0.02, 1.44),
    'wristL': (0.70, 0.02, 1.44),
    'handL': (0.86, 0.02, 1.44),
}
for k in list(J.keys()):
    if k.endswith('L'):
        x, y, z = J[k]
        J[k[:-1] + 'R'] = (-x, y, z)


def V(name):
    x, y, z = J[name]
    return Vector((x * H, y * H, z * H))


# --- Body mesh via skin modifier ----------------------------------------------------------------
# (point, radius_x, radius_y): the skin modifier's radius is in the vertex's local frame,
# roughly x = side-to-side and y = front-to-back for the trunk.
# Subdivision shrinks a skin cross-section to ~0.75 of its radius; K compensates.
K = 1.0 / 0.75
BODY_PTS = [
    ('pelvis', 0.170 * K, 0.115 * K),
    ('waist', 0.145 * K, 0.100 * K),
    ('chest', 0.175 * K, 0.120 * K),
    ('upchest', 0.180 * K, 0.112 * K),
    ('neckb', 0.060 * K, 0.060 * K),
    ('neckt', 0.055 * K, 0.055 * K),
]


def lerp(a, b, t):
    return a + (b - a) * t


def build_body():
    me = bpy.data.meshes.new('PlayerBody')
    obj = bpy.data.objects.new('PlayerBody', me)
    bpy.context.collection.objects.link(obj)

    verts = []
    radii = []
    edges = []

    def add(p, rx, ry):
        verts.append(p.copy())
        radii.append((rx, ry))
        return len(verts) - 1

    def chain(points):
        idx = [add(p, rx, ry) for (p, rx, ry) in points]
        for a, b in zip(idx, idx[1:]):
            edges.append((a, b))
        return idx

    trunk = chain([(V(n), rx, ry) for (n, rx, ry) in BODY_PTS])
    i_pelvis, i_chest, i_upchest = trunk[0], trunk[2], trunk[3]

    def limb(start_idx, pts):
        idx = [add(p, rx, ry) for (p, rx, ry) in pts]
        edges.append((start_idx, idx[0]))
        for a, b in zip(idx, idx[1:]):
            edges.append((a, b))
        return idx

    for s in ('L', 'R'):
        hip, knee, ankle, ball, toe = V('hip' + s), V('knee' + s), V('ankle' + s), V('ball' + s), V('toe' + s)
        limb(
            i_pelvis,
            [
                (hip, 0.090 * K, 0.090 * K),
                (hip.lerp(knee, 0.35), 0.084 * K, 0.084 * K),
                (hip.lerp(knee, 0.72), 0.068 * K, 0.068 * K),
                (knee, 0.054 * K, 0.054 * K),
                (knee.lerp(ankle, 0.28), 0.058 * K, 0.058 * K),  # calf
                (knee.lerp(ankle, 0.62), 0.044 * K, 0.044 * K),
                (ankle, 0.034 * K, 0.034 * K),
                (ankle.lerp(ball, 0.55), 0.040 * K, 0.040 * K),
                (ball, 0.040 * K, 0.030 * K),
                (toe, 0.032 * K, 0.022 * K),
            ],
        )
        clav, sh, elb, wr, hand = V('clav' + s), V('sh' + s), V('elb' + s), V('wrist' + s), V('hand' + s)
        limb(
            i_upchest,
            [
                (clav.lerp(sh, 0.55), 0.068 * K, 0.068 * K),  # trapezius / deltoid mass
                (sh, 0.058 * K, 0.058 * K),
                (sh.lerp(elb, 0.45), 0.048 * K, 0.048 * K),
                (elb, 0.037 * K, 0.037 * K),
                (elb.lerp(wr, 0.35), 0.040 * K, 0.040 * K),
                (wr, 0.027 * K, 0.027 * K),
                (wr.lerp(hand, 0.5), 0.036 * K, 0.022 * K),
                (hand, 0.026 * K, 0.016 * K),
            ],
        )

    me.from_pydata([tuple(v) for v in verts], edges, [])
    me.update()

    mod = obj.modifiers.new('Skin', 'SKIN')
    mod.use_smooth_shade = True
    mod.branch_smoothing = 0.6
    sv = me.skin_vertices[0].data
    for i, (rx, ry) in enumerate(radii):
        sv[i].radius = (rx * H, ry * H)
    sv[i_pelvis].use_root = True

    sub = obj.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier='Skin')
    bpy.ops.object.modifier_apply(modifier='Sub')
    return obj


def build_head():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1.0, location=(0, 0, 0))
    head = bpy.context.active_object
    head.name = 'PlayerHead'
    bm = bmesh.new()
    bm.from_mesh(head.data)
    for v in bm.verts:
        x, y, z = v.co
        # skull ~ 0.155 w, 0.20 deep, 0.235 tall; narrower jaw, flatter face
        sx, sy, sz = 0.078, 0.098, 0.118
        jaw = max(0.0, -z)  # 0..1 in the lower half
        sx *= 1.0 - 0.28 * jaw * jaw
        sy *= 1.0 - 0.12 * jaw
        if y < 0:  # face side slightly flatter
            sy *= 0.92
        v.co = Vector((x * sx, y * sy, z * sz))
        # nose bump
        if y < -0.85 and abs(x) < 0.25 and -0.15 < z < 0.25:
            v.co.y -= 0.012
    bm.to_mesh(head.data)
    bm.free()
    head.location = V('head') + Vector((0, 0.005, 0.02))
    bpy.ops.object.shade_smooth()
    return head


def build_hair(head):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1.0)
    hair = bpy.context.active_object
    hair.name = 'PlayerHair'
    bm = bmesh.new()
    bm.from_mesh(hair.data)
    # Hairline: one tilted cut, high at the brow, low at the nape. Clean edge, no stair steps.
    bmesh.ops.bisect_plane(
        bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
        plane_co=Vector((0, 0, 0.05)), plane_no=Vector((0, -0.62, 1.0)).normalized(),
        clear_inner=True,
    )
    for v in bm.verts:
        x, y, z = v.co
        v.co = Vector((x * 0.083, y * 0.103, z * 0.124))
    bm.to_mesh(hair.data)
    bm.free()
    hair.location = head.location + Vector((0, 0.004, 0.006))
    bpy.ops.object.shade_smooth()
    return hair


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


MATS = {
    'Skin': (0.62, 0.42, 0.30, 1),
    'Shirt': (0.8, 0.1, 0.1, 1),
    'Shorts': (0.95, 0.95, 0.95, 1),
    'Socks': (0.8, 0.1, 0.1, 1),
    'Boots': (0.05, 0.05, 0.05, 1),
    'Hair': (0.08, 0.06, 0.05, 1),
}


def make_materials():
    out = {}
    for name, col in MATS.items():
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = col
        bsdf.inputs['Roughness'].default_value = 0.7
        out[name] = m
    return out


# Kit lines (metres). The body is cut along these planes so colour borders are straight.
NECK_Z = 1.49
SLEEVE_X = 0.33
WAIST_Z = 1.03
HEM_Z = 0.64
SOCK_Z = 0.47
BOOT_Z = 0.125


def cut_kit_lines(obj):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    planes = [((0, 0, z), (0, 0, 1)) for z in (NECK_Z, WAIST_Z, HEM_Z, SOCK_Z, BOOT_Z)]
    planes += [((SLEEVE_X, 0, 0), (1, 0, 0)), ((-SLEEVE_X, 0, 0), (1, 0, 0))]
    for co, no in planes:
        bmesh.ops.bisect_plane(
            bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
            plane_co=Vector(co), plane_no=Vector(no), dist=0.0005,
        )
    bm.to_mesh(me)
    bm.free()


def assign_regions(obj, slot):
    me = obj.data
    for f in me.polygons:
        x, y, z = f.center
        ax = abs(x)
        if z > NECK_Z:
            m = 'Skin'
        elif ax > SLEEVE_X and z > 1.30:
            m = 'Skin'  # forearm and hand: short sleeves end above the elbow
        elif z > WAIST_Z:
            m = 'Shirt'
        elif z > HEM_Z:
            m = 'Shorts'
        elif z > SOCK_Z:
            m = 'Skin'  # knee
        elif z > BOOT_Z:
            m = 'Socks'
        else:
            m = 'Boots'
        f.material_index = slot[m]


def build_armature():
    arm_data = bpy.data.armatures.new('Armature')
    arm = bpy.data.objects.new('Armature', arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    bone('Hips', V('pelvis'), V('waist'))
    bone('Spine', V('waist'), V('chest'), 'Hips', True)
    bone('Spine1', V('chest'), V('upchest'), 'Spine', True)
    bone('Spine2', V('upchest'), V('neckb'), 'Spine1', True)
    bone('Neck', V('neckb'), V('neckt'), 'Spine2', True)
    bone('Head', V('neckt'), V('headtop'), 'Neck', True)
    for s, side in (('L', 'Left'), ('R', 'Right')):
        bone(side + 'Shoulder', V('clav' + s), V('sh' + s), 'Spine2')
        bone(side + 'Arm', V('sh' + s), V('elb' + s), side + 'Shoulder', True)
        bone(side + 'ForeArm', V('elb' + s), V('wrist' + s), side + 'Arm', True)
        bone(side + 'Hand', V('wrist' + s), V('hand' + s), side + 'ForeArm', True)
        bone(side + 'UpLeg', V('hip' + s), V('knee' + s), 'Hips')
        bone(side + 'Leg', V('knee' + s), V('ankle' + s), side + 'UpLeg', True)
        bone(side + 'Foot', V('ankle' + s), V('ball' + s), side + 'Leg', True)
        bone(side + 'ToeBase', V('ball' + s), V('toe' + s), side + 'Foot', True)
    # Consistent rolls so the game's local axes are predictable: X is the hinge axis for
    # knees/elbows when the limb is bent forward.
    for b in eb:
        b.roll = 0.0
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def bake_clips(arm):
    """Idle and Run for the club rooms (people.ts plays them). The match animates the rig itself."""
    from mathutils import Quaternion
    pb = arm.pose.bones
    for b in pb:
        b.rotation_mode = 'QUATERNION'
    arm.animation_data_create()

    def world_rot(name, axis, deg):
        b = pb[name]
        r = b.bone.matrix_local.to_quaternion()
        q = Quaternion(Vector(axis), math.radians(deg))
        b.rotation_quaternion = r.inverted() @ q @ r

    def key(frame, names):
        for n in names:
            pb[n].keyframe_insert('rotation_quaternion', frame=frame)

    def reset():
        for b in pb:
            b.rotation_quaternion = (1, 0, 0, 0)

    ALL = [b.name for b in pb]

    def arms_down(swingL=0.0, swingR=0.0, elbow=12):
        world_rot('LeftArm', (0, 1, 0), 78)
        world_rot('RightArm', (0, 1, 0), -78)
        # swing forward/back about the side axis, applied after lowering
        if swingL:
            b = pb['LeftArm']
            b.rotation_quaternion = b.rotation_quaternion @ Quaternion((0, 0, 1), math.radians(-swingL))
        if swingR:
            b = pb['RightArm']
            b.rotation_quaternion = b.rotation_quaternion @ Quaternion((0, 0, 1), math.radians(swingR))
        world_rot('LeftForeArm', (0, 0, 1), elbow)
        world_rot('RightForeArm', (0, 0, 1), -elbow)

    idle = bpy.data.actions.new('Idle')
    arm.animation_data.action = idle
    for f, breath in ((1, 0.0), (30, 1.5), (60, 0.0)):
        reset()
        arms_down(elbow=14)
        world_rot('Spine1', (1, 0, 0), -breath)
        key(f, ALL)

    run = bpy.data.actions.new('Run')
    arm.animation_data.action = run
    for f, ph in ((1, 0.0), (5, 0.25), (9, 0.5), (13, 0.75), (17, 1.0)):
        reset()
        c = math.cos(ph * 2 * math.pi)
        sL = c * 38
        arms_down(swingL=-c * 35, swingR=c * 35, elbow=70)
        world_rot('LeftUpLeg', (1, 0, 0), -sL)
        world_rot('RightUpLeg', (1, 0, 0), sL)
        sn = math.sin(ph * 2 * math.pi)
        world_rot('LeftLeg', (1, 0, 0), 20 + max(0.0, sn) * 75)
        world_rot('RightLeg', (1, 0, 0), 20 + max(0.0, -sn) * 75)
        world_rot('Spine', (1, 0, 0), -8)
        key(f, ALL)

    reset()
    arm.animation_data.action = None
    for act in (idle, run):
        tr = arm.animation_data.nla_tracks.new()
        tr.name = act.name
        tr.strips.new(act.name, 1, act)


def main(out):
    clean()
    body = build_body()
    # Thin the body to a game budget, then cut the kit lines into it.
    dec = body.modifiers.new('Dec', 'DECIMATE')
    dec.ratio = 0.6
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier='Dec')
    cut_kit_lines(body)

    mats = make_materials()
    order = list(MATS.keys())
    slot = {n: i for i, n in enumerate(order)}
    head = build_head()
    hair = build_hair(head)
    for o in (body, head, hair):
        for n in order:
            o.data.materials.append(mats[n])
    assign_regions(body, slot)
    for p in head.data.polygons:
        p.material_index = slot['Skin']
    for p in hair.data.polygons:
        p.material_index = slot['Hair']

    obj = join([body, head, hair], 'Player')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_smooth()

    arm = build_armature()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # Head and hair follow the Head bone only (they are separate shells).
    head_vg = obj.vertex_groups.get('Head')
    rigid = set()
    for p in obj.data.polygons:
        if p.center.z > 1.565:
            rigid.update(p.vertices)
    for vi in rigid:
        for vg in obj.vertex_groups:
            vg.remove([vi])
        head_vg.add([vi], 1.0, 'REPLACE')

    bake_clips(arm)

    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    for z, lo, hi in ((0.3, 0.0, 0.3), (0.55, 0.0, 0.3), (0.8, 0.0, 0.3), (0.98, -0.3, 0.3),
                      (1.1, -0.3, 0.3), (1.26, -0.3, 0.3), (1.38, -0.3, 0.3)):
        sl = [v for v in vs if abs(v.z - z) < 0.025 and lo < v.x < hi]
        if sl:
            print('SLICE %.2f w %.3f d %.3f' % (z, max(v.x for v in sl) - min(v.x for v in sl),
                                               max(v.y for v in sl) - min(v.y for v in sl)))
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print('TRIS', tris, 'VERTS', len(obj.data.vertices))

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(out),
        export_format='GLB',
        export_animations=True,
        export_nla_strips=True,
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_def_bones=False,
        export_texcoords=False,
        export_normals=True,
    )
    print('WROTE', out, os.path.getsize(out))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    main(argv[0] if argv else 'public/assets/models/player.glb')
