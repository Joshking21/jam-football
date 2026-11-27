"""
Renders preview images of a player.glb: front, side, back, and a posed run frame to check weights.
  blender -b --factory-startup -P tools/blender/preview_player.py -- in.glb out_prefix
"""
import bpy
import math
import sys
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
src, prefix = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

kit = {
    'Skin': (0.55, 0.36, 0.25, 1),
    'Shirt': (0.70, 0.08, 0.10, 1),
    'Shorts': (0.92, 0.92, 0.90, 1),
    'Socks': (0.70, 0.08, 0.10, 1),
    'Boots': (0.04, 0.04, 0.04, 1),
    'Hair': (0.05, 0.04, 0.03, 1),
}
for m in bpy.data.materials:
    base = m.name.split('.')[0]
    if base in kit and m.node_tree:
        b = m.node_tree.nodes.get('Principled BSDF')
        if b:
            b.inputs['Base Color'].default_value = kit[base]
            b.inputs['Roughness'].default_value = 0.65

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 520
scene.render.resolution_y = 720
scene.render.film_transparent = False
world = bpy.data.worlds.new('W')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.36, 0.40, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.6

sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = Euler((math.radians(50), 0, math.radians(-30)))
scene.collection.objects.link(sun)

bpy.ops.mesh.primitive_plane_add(size=6)
ground = bpy.context.active_object
gm = bpy.data.materials.new('G')
gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.12, 0.25, 0.10, 1)
ground.data.materials.append(gm)

cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.lens = 70
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(name, pos):
    cam.location = Vector(pos)
    d = Vector((0, 0, 0.95)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}_{name}.png'
    bpy.ops.render.render(write_still=True)


shoot('front', (0.6, -4.6, 1.15))
shoot('side', (4.6, -0.3, 1.15))
shoot('back', (-0.8, 4.6, 1.3))

# Pose: a running stride, to check deformation.
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
pb = arm.pose.bones
for b in pb:
    b.rotation_mode = 'XYZ'


def rot(name, x=0, y=0, z=0):
    if name in pb:
        pb[name].rotation_euler = Euler((math.radians(x), math.radians(y), math.radians(z)))


# glTF import gives bones Y along the bone; rotate about local X to swing forward/back.
rot('LeftUpLeg', 45)
rot('LeftLeg', -70)
rot('RightUpLeg', -25)
rot('RightLeg', -20)
rot('LeftArm', 0, 0, 70)
rot('RightArm', 0, 0, -70)
rot('LeftForeArm', 0, 0, 40)
rot('RightForeArm', 0, 0, -40)
rot('Spine1', 10)
bpy.context.view_layer.update()
shoot('pose', (3.2, -3.4, 1.2))
