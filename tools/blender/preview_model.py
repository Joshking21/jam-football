"""Renders any GLB from front, 3/4, side and back with its own textures, plus prints mesh stats.
  blender -b --factory-startup -P tools/blender/preview_model.py -- in.glb out_prefix [height_m]
"""
import bpy
import math
import sys
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
src, prefix = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
size = hi - lo
print('STATS meshes', len(meshes), 'tris', tris, 'size %.3f %.3f %.3f' % tuple(size),
      'materials', [m.name for m in bpy.data.materials], 'armatures', [o.name for o in bpy.data.objects if o.type == 'ARMATURE'])

# Scale to the asked height (Meshy models are normalised) and stand on the ground at the origin.
target_h = float(argv[2]) if len(argv) > 2 else 1.8
s = target_h / max(size.z, 1e-6)
root = bpy.data.objects.new('Root', None)
bpy.context.scene.collection.objects.link(root)
for o in bpy.data.objects:
    if o.parent is None and o is not root:
        o.parent = root
root.scale = (s, s, s)
c = (lo + hi) / 2
root.location = (-c.x * s, -c.y * s, -lo.z * s)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 600
scene.render.resolution_y = 900
world = bpy.data.worlds.new('W')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.36, 0.38, 0.42, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.0
sun.rotation_euler = Euler((math.radians(45), 0, math.radians(-35)))
scene.collection.objects.link(sun)
bpy.ops.mesh.primitive_plane_add(size=8)
g = bpy.context.active_object
gm = bpy.data.materials.new('G')
gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.25, 0.24, 0.22, 1)
g.data.materials.append(gm)

cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.lens = 60
scene.collection.objects.link(cam)
scene.camera = cam
look = Vector((0, 0, target_h * 0.52))
for name, ang in (('front', 0), ('q34', 35), ('side', 90), ('back', 180)):
    # Front of a glTF model is +Z in glTF = -Y in Blender.
    a = math.radians(ang)
    d = target_h * 2.9
    cam.location = Vector((math.sin(a) * d, -math.cos(a) * d, target_h * 0.6))
    cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}_{name}.png'
    bpy.ops.render.render(write_still=True)
