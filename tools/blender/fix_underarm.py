"""Fixes underarm "flaps" on auto-rigged characters (Meshy): jacket/torso vertices that the auto-rig let the
upper arm drag. For each side, a plane across the arm just past the shoulder joint splits body from arm; arm
weight on the body side moves to the chest (Spine2), with a soft band, then weights are smoothed.
Keeps the file's animations.

  blender -b --factory-startup -P tools/blender/fix_underarm.py -- in.glb out.glb [band_m=0.05] [offset_m=0.04]
"""
import bpy
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
BAND = float(argv[2]) if len(argv) > 2 else 0.05
OFFSET = float(argv[3]) if len(argv) > 3 else 0.04

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
# The skinned body: the mesh with vertex groups (the importer also adds a bone-display sphere).
mesh = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: (len(o.vertex_groups) > 0, len(o.data.vertices)))


def find(name):
    for b in arm.data.bones:
        if b.name.split(':')[-1] == name:
            return b
    raise KeyError(name)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# Rest-pose geometry, world space. Scale-aware: measure the upper-arm length.
mw = arm.matrix_world
chest_name = find('Spine2').name
chest = mesh.vertex_groups.get(chest_name) or mesh.vertex_groups.new(name=chest_name)
moved = 0
for side in ('Left', 'Right'):
    up = find(f'{side}Arm')
    head = mw @ up.head_local
    tail = mw @ up.tail_local
    d = (tail - head).normalized()
    L = (tail - head).length
    s = L / 0.28  # a real upper arm is ~0.28 m; scale the band and offset to the model's units
    plane = head + d * OFFSET * s
    arm_groups = [mesh.vertex_groups.get(find(f'{side}{n}').name) for n in ('Arm',)]
    arm_groups = [g for g in arm_groups if g]
    gidx = {g.index for g in arm_groups}
    for v in mesh.data.vertices:
        p = mesh.matrix_world @ v.co
        dist = (p - plane).dot(d)  # < 0: body side of the plane
        if dist > BAND * s:
            continue
        # How much of the arm weight to keep: 0 deep on the body side, 1 past the band.
        keep = smoothstep(-BAND * s, BAND * s, dist)
        for g in v.groups:
            if g.group in gidx and g.weight > 0:
                take = g.weight * (1 - keep)
                if take <= 1e-4:
                    continue
                grp = mesh.vertex_groups[g.group]
                grp.add([v.index], g.weight - take, 'REPLACE')
                chest.add([v.index], take, 'ADD')
                moved += 1

# No topology-based smoothing: Meshy meshes are split along UV seams, and smoothing per island gives
# coincident vertices different weights (the surface cracks open). The position-based band above is
# already smooth and identical for coincident vertices. Normalise per vertex only.
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')
print('MOVED', moved, 'vertex weights')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_yup=True)
print('WROTE', out)
