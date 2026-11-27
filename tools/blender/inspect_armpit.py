"""Close-up renders of a rigged character's armpit: rest pose and the frame of widest arm swing.
Also prints, for vertices in the underarm region, which bones carry their weight.
  blender -b --factory-startup -P tools/blender/inspect_armpit.py -- rigged_anim.glb out_prefix
"""
import bpy
import math
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, prefix = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
# The skinned body: the mesh with vertex groups (the importer also adds a bone-display sphere).
mesh = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: (len(o.vertex_groups) > 0, len(o.data.vertices)))


def bone(name):
    for b in arm.pose.bones:
        if b.name.endswith(name):
            return b
    raise KeyError(name)


def wpos(b, tail=False):
    return arm.matrix_world @ (b.tail if tail else b.head)


# Frame range of the action and the frame where the left upper arm is furthest from the body.
act = arm.animation_data.action if arm.animation_data else None
f0, f1 = (int(act.frame_range[0]), int(act.frame_range[1])) if act else (1, 1)
best, best_f = -1, f0
for f in range(f0, f1 + 1):
    scene.frame_set(f)
    la = bone('LeftArm')
    d = (wpos(la, True) - wpos(la)).normalized()
    ang = d.angle(Vector((0, 0, -1)))
    if ang > best:
        best, best_f = ang, f
print('FRAMES', f0, f1, 'widest left-arm swing at', best_f, 'angle %.0f deg' % math.degrees(best))

# Rest pose: weights in the underarm region (between shoulder and chest, just below the arm).
scene.frame_set(f0)
for pb in arm.pose.bones:
    pass
dg = bpy.context.evaluated_depsgraph_get()
sh = wpos(bone('LeftArm'))
groups = {g.index: g.name for g in mesh.vertex_groups}
counts = {}
n = 0
for v in mesh.data.vertices:
    p = mesh.matrix_world @ v.co
    # underarm box: a little inside the shoulder joint, below it
    if abs(p.x - sh.x) < 0.25 * abs(sh.x) + 0.05 and sh.z - 0.35 * sh.z / 1.4 < p.z < sh.z and abs(p.y - sh.y) < 0.12:
        n += 1
        ws = sorted(((g.weight, groups[g.group]) for g in v.groups), reverse=True)[:2]
        key = ' + '.join(f'{name.split(":")[-1]}' for w, name in ws if w > 0.15)
        counts[key] = counts.get(key, 0) + 1
print('UNDERARM verts', n)
for k, c in sorted(counts.items(), key=lambda kv: -kv[1])[:8]:
    print('  ', c, k)

# Renders.
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 700
scene.render.resolution_y = 700
world = bpy.data.worlds.new('W')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.52, 0.55, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.2
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 2.5
sun.rotation_euler = (math.radians(40), 0, math.radians(20))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.lens = 50
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(name, frame, eye_off):
    scene.frame_set(frame)
    target = wpos(bone('LeftArm')) + Vector((0.0, 0.0, -0.12 * sh.z / 1.4))
    s = sh.z / 1.4  # scale-aware distances
    cam.location = target + Vector(eye_off) * s
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}_{name}.png'
    bpy.ops.render.render(write_still=True)


# Front of glTF = -Y in Blender. Left side of the character = +X.
shoot('rest_front', f0, (0.25, -1.1, -0.05))
shoot('rest_side', f0, (1.1, -0.15, -0.1))
shoot('swing_front', best_f, (0.25, -1.1, -0.05))
shoot('swing_side', best_f, (1.1, -0.15, -0.1))
