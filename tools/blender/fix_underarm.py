"""Fixes underarm "flaps" on auto-rigged characters (Meshy): jacket/torso vertices that the auto-rig let the
upper arm drag. For each side, a plane across the arm just past the shoulder joint splits body from arm; arm
weight on the body side moves to the chest (Spine2), with a soft band. Keeps the file's animations.

  blender -b --factory-startup -P tools/blender/fix_underarm.py -- in.glb out.glb [band_m=0.05] [offset_m=0.04]

Also importable: from fix_underarm import fix_underarm (used by build_coach.py).
"""
import bpy
import sys


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def find_bone(arm, name):
    for b in arm.data.bones:
        if b.name.split(':')[-1] == name:
            return b
    raise KeyError(name)


def skinned_mesh():
    # The importer also adds a bone-display sphere: the body is the mesh with vertex groups.
    return max((o for o in bpy.data.objects if o.type == 'MESH'),
               key=lambda o: (len(o.vertex_groups) > 0, len(o.data.vertices)))


def fix_underarm(arm, mesh, band=0.05, offset=0.04) -> int:
    mw = arm.matrix_world
    chest_name = find_bone(arm, 'Spine2').name
    chest = mesh.vertex_groups.get(chest_name) or mesh.vertex_groups.new(name=chest_name)
    moved = 0
    for side in ('Left', 'Right'):
        up = find_bone(arm, f'{side}Arm')
        head = mw @ up.head_local
        tail = mw @ up.tail_local
        d = (tail - head).normalized()
        s = (tail - head).length / 0.28  # a real upper arm is ~0.28 m: scale to the model's units
        plane = head + d * offset * s
        grp = mesh.vertex_groups.get(up.name)
        if not grp:
            continue
        for v in mesh.data.vertices:
            dist = ((mesh.matrix_world @ v.co) - plane).dot(d)  # < 0: body side of the plane
            if dist > band * s:
                continue
            keep = smoothstep(-band * s, band * s, dist)
            for g in v.groups:
                if g.group == grp.index and g.weight > 0:
                    take = g.weight * (1 - keep)
                    if take > 1e-4:
                        grp.add([v.index], g.weight - take, 'REPLACE')
                        chest.add([v.index], take, 'ADD')
                        moved += 1
    # No topology-based smoothing: Meshy meshes are split along UV seams, and smoothing per island gives
    # coincident vertices different weights (the surface cracks open). The position-based band is already
    # smooth and identical for coincident vertices. Normalise per vertex only.
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return moved


if __name__ == '__main__' and '--' in sys.argv:
    argv = sys.argv[sys.argv.index('--') + 1:]
    src, out = argv[0], argv[1]
    band = float(argv[2]) if len(argv) > 2 else 0.05
    offset = float(argv[3]) if len(argv) > 3 else 0.04
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    print('MOVED', fix_underarm(arm, skinned_mesh(), band, offset), 'vertex weights')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_yup=True)
    print('WROTE', out)
