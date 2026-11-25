"""
Generates player.glb and 3D club props according to SPEC §18.2 & §18.3 using Blender 5.3.
"""
import bpy
import math
import os

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def export_glb(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(filepath),
        export_format='GLB',
        export_animations=True,
        export_nla_strips=True,
        export_def_bones=True,
        export_yup=True,
        export_apply=False
    )
    print(f"Exported {filepath} ({os.path.getsize(filepath)} bytes)")

def create_player():
    clean_scene()
    # Materials
    materials = {}
    mat_configs = {
        'Shirt': (0.95, 0.95, 0.95, 1.0),
        'Shorts': (0.15, 0.18, 0.25, 1.0),
        'Socks': (0.95, 0.95, 0.95, 1.0),
        'Boots': (0.10, 0.10, 0.10, 1.0),
        'Skin': (0.75, 0.52, 0.38, 1.0),
        'Hair': (0.15, 0.12, 0.10, 1.0),
    }
    for name, color in mat_configs.items():
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Roughness'].default_value = 0.5
        materials[name] = mat

    # Armature (1.80m height)
    arm_data = bpy.data.armatures.new("Armature")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    hips = eb.new("Hips")
    hips.head = (0, 0, 0.98)
    hips.tail = (0, 0, 1.10)

    spine = eb.new("Spine")
    spine.head = (0, 0, 1.10)
    spine.tail = (0, 0, 1.28)
    spine.parent = hips

    spine1 = eb.new("Spine1")
    spine1.head = (0, 0, 1.28)
    spine1.tail = (0, 0, 1.42)
    spine1.parent = spine

    spine2 = eb.new("Spine2")
    spine2.head = (0, 0, 1.42)
    spine2.tail = (0, 0, 1.50)
    spine2.parent = spine1

    neck = eb.new("Neck")
    neck.head = (0, 0, 1.50)
    neck.tail = (0, 0, 1.58)
    neck.parent = spine2

    head = eb.new("Head")
    head.head = (0, 0, 1.58)
    head.tail = (0, 0, 1.80)
    head.parent = neck

    # Left Arm
    l_sh = eb.new("LeftShoulder")
    l_sh.head = (0.06, 0, 1.48)
    l_sh.tail = (0.18, 0, 1.48)
    l_sh.parent = spine2

    l_arm = eb.new("LeftArm")
    l_arm.head = (0.18, 0, 1.48)
    l_arm.tail = (0.40, 0, 1.48)
    l_arm.parent = l_sh

    l_forearm = eb.new("LeftForeArm")
    l_forearm.head = (0.40, 0, 1.48)
    l_forearm.tail = (0.60, 0, 1.48)
    l_forearm.parent = l_arm

    l_hand = eb.new("LeftHand")
    l_hand.head = (0.60, 0, 1.48)
    l_hand.tail = (0.70, 0, 1.48)
    l_hand.parent = l_forearm

    # Right Arm
    r_sh = eb.new("RightShoulder")
    r_sh.head = (-0.06, 0, 1.48)
    r_sh.tail = (-0.18, 0, 1.48)
    r_sh.parent = spine2

    r_arm = eb.new("RightArm")
    r_arm.head = (-0.18, 0, 1.48)
    r_arm.tail = (-0.40, 0, 1.48)
    r_arm.parent = r_sh

    r_forearm = eb.new("RightForeArm")
    r_forearm.head = (-0.40, 0, 1.48)
    r_forearm.tail = (-0.60, 0, 1.48)
    r_forearm.parent = r_arm

    r_hand = eb.new("RightHand")
    r_hand.head = (-0.60, 0, 1.48)
    r_hand.tail = (-0.70, 0, 1.48)
    r_hand.parent = r_forearm

    # Left Leg
    l_upleg = eb.new("LeftUpLeg")
    l_upleg.head = (0.12, 0, 0.98)
    l_upleg.tail = (0.12, 0, 0.52)
    l_upleg.parent = hips

    l_leg = eb.new("LeftLeg")
    l_leg.head = (0.12, 0, 0.52)
    l_leg.tail = (0.12, 0, 0.12)
    l_leg.parent = l_upleg

    l_foot = eb.new("LeftFoot")
    l_foot.head = (0.12, 0, 0.12)
    l_foot.tail = (0.12, 0.14, 0.02)
    l_foot.parent = l_leg

    l_toe = eb.new("LeftToeBase")
    l_toe.head = (0.12, 0.14, 0.02)
    l_toe.tail = (0.12, 0.20, 0.02)
    l_toe.parent = l_foot

    # Right Leg
    r_upleg = eb.new("RightUpLeg")
    r_upleg.head = (-0.12, 0, 0.98)
    r_upleg.tail = (-0.12, 0, 0.52)
    r_upleg.parent = hips

    r_leg = eb.new("RightLeg")
    r_leg.head = (-0.12, 0, 0.52)
    r_leg.tail = (-0.12, 0, 0.12)
    r_leg.parent = r_upleg

    r_foot = eb.new("RightFoot")
    r_foot.head = (-0.12, 0, 0.12)
    r_foot.tail = (-0.12, 0.14, 0.02)
    r_foot.parent = r_leg

    r_toe = eb.new("RightToeBase")
    r_toe.head = (-0.12, 0.14, 0.02)
    r_toe.tail = (-0.12, 0.20, 0.02)
    r_toe.parent = r_foot

    bpy.ops.object.mode_set(mode='OBJECT')

    # Player Meshes (Shirt, Shorts, Socks, Boots, Skin)
    parts = []
    # Shirt Torso
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.28), scale=(0.36, 0.20, 0.46))
    shirt = bpy.context.active_object
    shirt.data.materials.append(materials['Shirt'])
    parts.append(shirt)

    # Shorts
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.94), scale=(0.34, 0.22, 0.24))
    shorts = bpy.context.active_object
    shorts.data.materials.append(materials['Shorts'])
    parts.append(shorts)

    # Head
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0, 1.68))
    head_m = bpy.context.active_object
    head_m.data.materials.append(materials['Skin'])
    head_m.data.materials.append(materials['Hair'])
    parts.append(head_m)

    # Legs (Shorts top, Skin knees, Socks lower)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.075, depth=0.88, location=(0.12, 0, 0.54))
    l_leg_m = bpy.context.active_object
    l_leg_m.data.materials.append(materials['Socks'])
    l_leg_m.data.materials.append(materials['Skin'])
    parts.append(l_leg_m)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.075, depth=0.88, location=(-0.12, 0, 0.54))
    r_leg_m = bpy.context.active_object
    r_leg_m.data.materials.append(materials['Socks'])
    r_leg_m.data.materials.append(materials['Skin'])
    parts.append(r_leg_m)

    # Boots
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.12, 0.05, 0.05), scale=(0.09, 0.22, 0.08))
    l_boot = bpy.context.active_object
    l_boot.data.materials.append(materials['Boots'])
    parts.append(l_boot)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.12, 0.05, 0.05), scale=(0.09, 0.22, 0.08))
    r_boot = bpy.context.active_object
    r_boot.data.materials.append(materials['Boots'])
    parts.append(r_boot)

    # Arms
    bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=0.48, location=(0.30, 0, 1.48))
    l_arm_m = bpy.context.active_object
    l_arm_m.rotation_euler = (0, math.radians(90), 0)
    l_arm_m.data.materials.append(materials['Skin'])
    parts.append(l_arm_m)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=0.48, location=(-0.30, 0, 1.48))
    r_arm_m = bpy.context.active_object
    r_arm_m.rotation_euler = (0, math.radians(90), 0)
    r_arm_m.data.materials.append(materials['Skin'])
    parts.append(r_arm_m)

    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = shirt
    bpy.ops.object.join()
    player_mesh = bpy.context.active_object
    player_mesh.name = "PlayerMesh"

    arm_obj.select_set(True)
    player_mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # Basic Run & Sprint Animations
    arm_obj.animation_data_create()
    pb = arm_obj.pose.bones

    idle = bpy.data.actions.new("Idle")
    arm_obj.animation_data.action = idle
    bpy.context.scene.frame_set(1)
    pb["Spine1"].keyframe_insert(data_path="rotation_euler", frame=1)

    run = bpy.data.actions.new("Run")
    arm_obj.animation_data.action = run
    bpy.context.scene.frame_set(1)
    pb["LeftUpLeg"].rotation_euler = (math.radians(-35), 0, 0)
    pb["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pb["RightUpLeg"].rotation_euler = (math.radians(35), 0, 0)
    pb["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    bpy.context.scene.frame_set(10)
    pb["LeftUpLeg"].rotation_euler = (math.radians(35), 0, 0)
    pb["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=10)
    pb["RightUpLeg"].rotation_euler = (math.radians(-35), 0, 0)
    pb["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=10)
    bpy.context.scene.frame_set(20)
    pb["LeftUpLeg"].rotation_euler = (math.radians(-35), 0, 0)
    pb["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=20)
    pb["RightUpLeg"].rotation_euler = (math.radians(35), 0, 0)
    pb["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=20)

    for act in [idle, run]:
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = act.name
        track.strips.new(act.name, 1, act)

    export_glb("public/assets/models/player.glb")

def create_props():
    # Desk
    clean_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.37), scale=(2.2, 1.2, 0.74))
    export_glb("public/assets/models/club/desk.glb")

    # Whiteboard
    clean_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.6), scale=(2.0, 0.05, 1.2))
    export_glb("public/assets/models/club/whiteboard.glb")

    # TV
    clean_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5), scale=(1.6, 0.06, 1.0))
    export_glb("public/assets/models/club/tv.glb")

    # Board Table
    clean_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.37), scale=(2.0, 5.0, 0.74))
    export_glb("public/assets/models/club/board_table.glb")

    # Locker
    clean_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.0), scale=(0.8, 0.6, 2.0))
    export_glb("public/assets/models/club/locker.glb")

    # Bench
    clean_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.22), scale=(3.0, 0.5, 0.45))
    export_glb("public/assets/models/club/bench.glb")

if __name__ == '__main__':
    create_player()
    create_props()
