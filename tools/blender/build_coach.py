"""Builds the game coach (public/assets/models/coach.glb) from the Meshy test outputs in tests-ai/M-coach/:
  - coach_rigged.glb (A-pose, Mixamo skeleton), coach_walking.glb, coach_running.glb (Meshy basic animations)
Steps: underarm weight fix, strip the "mixamorig:" prefix (bones + clip paths), in-place Walk and Run (no root
drift: the room code moves him), Run arm swing capped (a suit jacket balloons past ~45 degrees), a breathing
Idle with the arms settled, textures down to 1024 px JPEG.

  blender -b --factory-startup -P tools/blender/build_coach.py -- tests-ai/M-coach public/assets/models/coach.glb
"""
import bpy
import math
import os
import pathlib
import sys
from mathutils import Quaternion, Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fix_underarm import fix_underarm, skinned_mesh  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
src_dir = pathlib.Path(argv[0]).resolve()
out = pathlib.Path(argv[1]).resolve()
TEX = int(argv[2]) if len(argv) > 2 else 1024
ARM_SWING_KEEP = 0.5  # Run: keep this much of each arm key's deviation from the mean pose

bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


# 1. The character.
objs = import_glb(src_dir / 'coach_rigged.glb')
arm = next(o for o in objs if o.type == 'ARMATURE')
mesh = skinned_mesh()
print('UNDERARM moved', fix_underarm(arm, mesh, 0.05, 0.04))

# 2. The clips: import each file, keep its action, delete its objects.
actions = {}
for name, fname in (('Walk', 'coach_walking.glb'), ('Run', 'coach_running.glb')):
    new = import_glb(src_dir / fname)
    a2 = next(o for o in new if o.type == 'ARMATURE')
    act = a2.animation_data.action if a2.animation_data and a2.animation_data.action else None
    if act is None:
        for tr in (a2.animation_data.nla_tracks if a2.animation_data else []):
            for st in tr.strips:
                act = st.action
    act.name = name
    act.use_fake_user = True
    actions[name] = act
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)


def all_fcurves(act):
    """Blender 5 layered actions keep F-curves in layers > strips > channelbags; older ones in act.fcurves."""
    if hasattr(act, 'layers') and len(act.layers):
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for bag in getattr(strip, 'channelbags', []):
                    out.extend(bag.fcurves)
        return out
    return list(getattr(act, 'fcurves', []))


# 3. Strip the prefix from bones, vertex groups and clip paths.
def strip(n):
    return n.split(':')[-1]


for b in arm.data.bones:
    b.name = strip(b.name)
for g in mesh.vertex_groups:
    g.name = strip(g.name)
for act in actions.values():
    for fc in all_fcurves(act):
        fc.data_path = fc.data_path.replace('mixamorig:', '')


def fcurves(act, bone, prop):
    return [fc for fc in all_fcurves(act) if fc.data_path == f'pose.bones["{bone}"].{prop}']


# 4. In place: flatten Hips horizontal travel (the channel that drifts), keep the vertical bob.
for act in actions.values():
    for fc in fcurves(act, 'Hips', 'location'):
        vals = [k.co[1] for k in fc.keyframe_points]
        if not vals:
            continue
        rng = max(vals) - min(vals)
        drift = abs(vals[-1] - vals[0])
        if rng > 0 and drift > 0.5 * rng:  # monotonic travel, not a bob
            for k in fc.keyframe_points:
                k.co[1] = vals[0]
                k.handle_left[1] = vals[0]
                k.handle_right[1] = vals[0]
            print('IN-PLACE', act.name, 'Hips location', fc.array_index)

# 5. Cap the Run arm swing: pull every arm key halfway toward the clip's mean arm pose.
run = actions['Run']
for bone in ('LeftArm', 'RightArm'):
    fcs = sorted(fcurves(run, bone, 'rotation_quaternion'), key=lambda f: f.array_index)
    if len(fcs) != 4:
        continue
    frames = sorted({k.co[0] for fc in fcs for k in fc.keyframe_points})
    qs = [Quaternion([fc.evaluate(f) for fc in fcs]).normalized() for f in frames]
    acc = Vector((0, 0, 0, 0))
    for q in qs:
        v = Vector(q)
        acc += v if v.dot(Vector(qs[0])) >= 0 else -v
    mean = Quaternion(acc).normalized()
    for f, q in zip(frames, qs):
        nq = mean.slerp(q, ARM_SWING_KEEP)
        for i, fc in enumerate(fcs):
            for k in fc.keyframe_points:
                if abs(k.co[0] - f) < 1e-3:
                    k.co[1] = nq[i]
                    k.handle_left[1] = nq[i]
                    k.handle_right[1] = nq[i]
    print('CAPPED', bone, len(frames), 'keys')

# 6. Idle: arms settle from the A-pose, slow breathing.
pb = arm.pose.bones
for b in pb:
    b.rotation_mode = 'QUATERNION'
arm.animation_data_create()
idle = bpy.data.actions.new('Idle')
idle.use_fake_user = True
arm.animation_data.action = idle


def world_rot(name, axis, deg):
    b = pb[name]
    r = b.bone.matrix_local.to_quaternion()
    q = Quaternion(Vector(axis), math.radians(deg))
    b.rotation_quaternion = r.inverted() @ q @ r


for f, breath in ((1, 0.0), (45, 1.2), (90, 0.0)):
    for b in pb:
        b.rotation_quaternion = (1, 0, 0, 0)
    world_rot('LeftArm', (0, 1, 0), 8)  # +X arm down a little more
    world_rot('RightArm', (0, 1, 0), -8)
    world_rot('LeftForeArm', (1, 0, 0), -10)
    world_rot('RightForeArm', (1, 0, 0), -10)
    world_rot('Spine1', (1, 0, 0), -breath)
    world_rot('Spine2', (1, 0, 0), -breath * 0.6)
    for b in pb:
        b.keyframe_insert('rotation_quaternion', frame=f)
actions['Idle'] = idle

# 7. One NLA track per clip, so the exporter writes all three.
arm.animation_data.action = None
for b in pb:
    b.rotation_quaternion = (1, 0, 0, 0)
    b.location = (0, 0, 0)
for name in ('Idle', 'Walk', 'Run'):
    tr = arm.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, int(actions[name].frame_range[0]), actions[name])

# 8. Textures: web size.
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)
mesh.name = 'Coach'
for m in mesh.data.materials:
    m.name = 'Coach'

out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
mesh.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(out),
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_nla_strips=True,
    export_yup=True,
    export_image_format='JPEG',
    export_jpeg_quality=85,
)
print('WROTE', out, os.path.getsize(out) // 1024, 'KB')
