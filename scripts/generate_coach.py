"""
Generates the rigged 3D coach model (manager.glb) according to SPEC §18.3 using Blender 5.3.
Outputs to public/assets/models/manager.glb.
"""
import bpy
import math
import os
import sys

def build_manager_model(output_path):
    # 1. Clean scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # 2. Materials
    materials = {}
    mat_configs = {
        'Coat': (0.12, 0.14, 0.18, 1.0),
        'Shirt': (0.92, 0.92, 0.90, 1.0),
        'Tie': (0.85, 0.65, 0.05, 1.0), # Club accent gold
        'Trousers': (0.10, 0.11, 0.14, 1.0),
        'Shoes': (0.05, 0.05, 0.06, 1.0),
        'Skin': (0.78, 0.55, 0.40, 1.0),
        'Hair': (0.15, 0.10, 0.08, 1.0),
    }

    for name, color in mat_configs.items():
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Roughness'].default_value = 0.6
        materials[name] = mat

    # 3. Create Armature
    arm_data = bpy.data.armatures.new("Armature")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    eb = arm_data.edit_bones

    # Bone positions (1.78m height)
    hips = eb.new("Hips")
    hips.head = (0, 0, 0.95)
    hips.tail = (0, 0, 1.08)

    spine = eb.new("Spine")
    spine.head = (0, 0, 1.08)
    spine.tail = (0, 0, 1.25)
    spine.parent = hips

    spine1 = eb.new("Spine1")
    spine1.head = (0, 0, 1.25)
    spine1.tail = (0, 0, 1.38)
    spine1.parent = spine

    spine2 = eb.new("Spine2")
    spine2.head = (0, 0, 1.38)
    spine2.tail = (0, 0, 1.48)
    spine2.parent = spine1

    neck = eb.new("Neck")
    neck.head = (0, 0, 1.48)
    neck.tail = (0, 0, 1.55)
    neck.parent = spine2

    head = eb.new("Head")
    head.head = (0, 0, 1.55)
    head.tail = (0, 0, 1.76)
    head.parent = neck

    # Left Arm
    l_sh = eb.new("LeftShoulder")
    l_sh.head = (0.06, 0, 1.45)
    l_sh.tail = (0.16, 0, 1.45)
    l_sh.parent = spine2

    l_arm = eb.new("LeftArm")
    l_arm.head = (0.16, 0, 1.45)
    l_arm.tail = (0.38, 0, 1.45)
    l_arm.parent = l_sh

    l_forearm = eb.new("LeftForeArm")
    l_forearm.head = (0.38, 0, 1.45)
    l_forearm.tail = (0.58, 0, 1.45)
    l_forearm.parent = l_arm

    l_hand = eb.new("LeftHand")
    l_hand.head = (0.58, 0, 1.45)
    l_hand.tail = (0.68, 0, 1.45)
    l_hand.parent = l_forearm

    # Right Arm
    r_sh = eb.new("RightShoulder")
    r_sh.head = (-0.06, 0, 1.45)
    r_sh.tail = (-0.16, 0, 1.45)
    r_sh.parent = spine2

    r_arm = eb.new("RightArm")
    r_arm.head = (-0.16, 0, 1.45)
    r_arm.tail = (-0.38, 0, 1.45)
    r_arm.parent = r_sh

    r_forearm = eb.new("RightForeArm")
    r_forearm.head = (-0.38, 0, 1.45)
    r_forearm.tail = (-0.58, 0, 1.45)
    r_forearm.parent = r_arm

    r_hand = eb.new("RightHand")
    r_hand.head = (-0.58, 0, 1.45)
    r_hand.tail = (-0.68, 0, 1.45)
    r_hand.parent = r_forearm

    # Left Leg
    l_upleg = eb.new("LeftUpLeg")
    l_upleg.head = (0.11, 0, 0.95)
    l_upleg.tail = (0.11, 0, 0.50)
    l_upleg.parent = hips

    l_leg = eb.new("LeftLeg")
    l_leg.head = (0.11, 0, 0.50)
    l_leg.tail = (0.11, 0, 0.10)
    l_leg.parent = l_upleg

    l_foot = eb.new("LeftFoot")
    l_foot.head = (0.11, 0, 0.10)
    l_foot.tail = (0.11, 0.12, 0.02)
    l_foot.parent = l_leg

    l_toe = eb.new("LeftToeBase")
    l_toe.head = (0.11, 0.12, 0.02)
    l_toe.tail = (0.11, 0.18, 0.02)
    l_toe.parent = l_foot

    # Right Leg
    r_upleg = eb.new("RightUpLeg")
    r_upleg.head = (-0.11, 0, 0.95)
    r_upleg.tail = (-0.11, 0, 0.50)
    r_upleg.parent = hips

    r_leg = eb.new("RightLeg")
    r_leg.head = (-0.11, 0, 0.50)
    r_leg.tail = (-0.11, 0, 0.10)
    r_leg.parent = r_upleg

    r_foot = eb.new("RightFoot")
    r_foot.head = (-0.11, 0, 0.10)
    r_foot.tail = (-0.11, 0.12, 0.02)
    r_foot.parent = r_leg

    r_toe = eb.new("RightToeBase")
    r_toe.head = (-0.11, 0.12, 0.02)
    r_toe.tail = (-0.11, 0.18, 0.02)
    r_toe.parent = r_foot

    bpy.ops.object.mode_set(mode='OBJECT')

    # 4. Create Body Mesh Components
    mesh_parts = []

    # Torso (Coat & Shirt)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.25), scale=(0.38, 0.22, 0.52))
    torso = bpy.context.active_object
    torso.name = "Torso"
    torso.data.materials.append(materials['Coat'])
    torso.data.materials.append(materials['Shirt'])
    torso.data.materials.append(materials['Tie'])
    mesh_parts.append(torso)

    # Head (Skin & Hair)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0, 1.65))
    head_m = bpy.context.active_object
    head_m.name = "HeadMesh"
    head_m.data.materials.append(materials['Skin'])
    head_m.data.materials.append(materials['Hair'])
    mesh_parts.append(head_m)

    # Legs (Trousers)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.85, location=(0.11, 0, 0.52))
    l_leg_m = bpy.context.active_object
    l_leg_m.data.materials.append(materials['Trousers'])
    mesh_parts.append(l_leg_m)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.85, location=(-0.11, 0, 0.52))
    r_leg_m = bpy.context.active_object
    r_leg_m.data.materials.append(materials['Trousers'])
    mesh_parts.append(r_leg_m)

    # Shoes
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.11, 0.04, 0.05), scale=(0.10, 0.22, 0.08))
    l_shoe_m = bpy.context.active_object
    l_shoe_m.data.materials.append(materials['Shoes'])
    mesh_parts.append(l_shoe_m)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.11, 0.04, 0.05), scale=(0.10, 0.22, 0.08))
    r_shoe_m = bpy.context.active_object
    r_shoe_m.data.materials.append(materials['Shoes'])
    mesh_parts.append(r_shoe_m)

    # Arms (Coat & Skin hands)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.45, location=(0.28, 0, 1.45))
    l_arm_m = bpy.context.active_object
    l_arm_m.rotation_euler = (0, math.radians(90), 0)
    l_arm_m.data.materials.append(materials['Coat'])
    mesh_parts.append(l_arm_m)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.45, location=(-0.28, 0, 1.45))
    r_arm_m = bpy.context.active_object
    r_arm_m.rotation_euler = (0, math.radians(90), 0)
    r_arm_m.data.materials.append(materials['Coat'])
    mesh_parts.append(r_arm_m)

    # Join meshes into one manager mesh
    for p in mesh_parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = torso
    bpy.ops.object.join()
    manager_mesh = bpy.context.active_object
    manager_mesh.name = "ManagerMesh"

    # Parent mesh to Armature with automatic weights
    arm_obj.select_set(True)
    manager_mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # 5. Build Animation Actions
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()

    pose_bones = arm_obj.pose.bones

    # ACTION 1: Idle (breathing cycle, 30 frames)
    idle_action = bpy.data.actions.new("Idle")
    arm_obj.animation_data.action = idle_action

    bpy.context.scene.frame_set(1)
    pose_bones["Spine1"].rotation_euler = (0, 0, 0)
    pose_bones["Spine1"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["LeftArm"].rotation_euler = (0, 0, math.radians(-70))
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightArm"].rotation_euler = (0, 0, math.radians(70))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=1)

    bpy.context.scene.frame_set(15)
    pose_bones["Spine1"].rotation_euler = (math.radians(2), 0, 0)
    pose_bones["Spine1"].keyframe_insert(data_path="rotation_euler", frame=15)

    bpy.context.scene.frame_set(30)
    pose_bones["Spine1"].rotation_euler = (0, 0, 0)
    pose_bones["Spine1"].keyframe_insert(data_path="rotation_euler", frame=30)
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=30)
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=30)

    # ACTION 2: Walk (24 frame cycle)
    walk_action = bpy.data.actions.new("Walk")
    arm_obj.animation_data.action = walk_action

    # Frame 1: Left leg forward, right leg back
    bpy.context.scene.frame_set(1)
    pose_bones["LeftUpLeg"].rotation_euler = (math.radians(-25), 0, 0)
    pose_bones["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightUpLeg"].rotation_euler = (math.radians(25), 0, 0)
    pose_bones["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["LeftArm"].rotation_euler = (math.radians(20), 0, math.radians(-70))
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightArm"].rotation_euler = (math.radians(-20), 0, math.radians(70))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=1)

    # Frame 12: Right leg forward, left leg back
    bpy.context.scene.frame_set(12)
    pose_bones["LeftUpLeg"].rotation_euler = (math.radians(25), 0, 0)
    pose_bones["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=12)
    pose_bones["RightUpLeg"].rotation_euler = (math.radians(-25), 0, 0)
    pose_bones["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=12)
    pose_bones["LeftArm"].rotation_euler = (math.radians(-20), 0, math.radians(-70))
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=12)
    pose_bones["RightArm"].rotation_euler = (math.radians(20), 0, math.radians(70))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=12)

    # Frame 24: Loop back
    bpy.context.scene.frame_set(24)
    pose_bones["LeftUpLeg"].rotation_euler = (math.radians(-25), 0, 0)
    pose_bones["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=24)
    pose_bones["RightUpLeg"].rotation_euler = (math.radians(25), 0, 0)
    pose_bones["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=24)
    pose_bones["LeftArm"].rotation_euler = (math.radians(20), 0, math.radians(-70))
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=24)
    pose_bones["RightArm"].rotation_euler = (math.radians(-20), 0, math.radians(70))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=24)

    # ACTION 3: Run (16 frame cycle)
    run_action = bpy.data.actions.new("Run")
    arm_obj.animation_data.action = run_action

    bpy.context.scene.frame_set(1)
    pose_bones["LeftUpLeg"].rotation_euler = (math.radians(-40), 0, 0)
    pose_bones["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightUpLeg"].rotation_euler = (math.radians(40), 0, 0)
    pose_bones["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["LeftArm"].rotation_euler = (math.radians(35), 0, math.radians(-65))
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightArm"].rotation_euler = (math.radians(-35), 0, math.radians(65))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=1)

    bpy.context.scene.frame_set(8)
    pose_bones["LeftUpLeg"].rotation_euler = (math.radians(40), 0, 0)
    pose_bones["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=8)
    pose_bones["RightUpLeg"].rotation_euler = (math.radians(-40), 0, 0)
    pose_bones["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=8)
    pose_bones["LeftArm"].rotation_euler = (math.radians(-35), 0, math.radians(-65))
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=8)
    pose_bones["RightArm"].rotation_euler = (math.radians(35), 0, math.radians(65))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=8)

    bpy.context.scene.frame_set(16)
    pose_bones["LeftUpLeg"].rotation_euler = (math.radians(-40), 0, 0)
    pose_bones["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=16)
    pose_bones["RightUpLeg"].rotation_euler = (math.radians(40), 0, 0)
    pose_bones["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=16)
    pose_bones["LeftArm"].rotation_euler = (math.radians(35), 0, math.radians(-65))
    pose_bones["LeftArm"].keyframe_insert(data_path="rotation_euler", frame=16)
    pose_bones["RightArm"].rotation_euler = (math.radians(-35), 0, math.radians(65))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=16)

    # ACTION 4: Point (at board)
    point_action = bpy.data.actions.new("Point")
    arm_obj.animation_data.action = point_action
    bpy.context.scene.frame_set(1)
    pose_bones["RightArm"].rotation_euler = (math.radians(-75), math.radians(15), math.radians(10))
    pose_bones["RightArm"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightForeArm"].rotation_euler = (math.radians(-10), 0, 0)
    pose_bones["RightForeArm"].keyframe_insert(data_path="rotation_euler", frame=1)

    # ACTION 5: SitIdle
    sit_action = bpy.data.actions.new("SitIdle")
    arm_obj.animation_data.action = sit_action
    bpy.context.scene.frame_set(1)
    pose_bones["LeftUpLeg"].rotation_euler = (math.radians(-85), 0, 0)
    pose_bones["LeftUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightUpLeg"].rotation_euler = (math.radians(-85), 0, 0)
    pose_bones["RightUpLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["LeftLeg"].rotation_euler = (math.radians(85), 0, 0)
    pose_bones["LeftLeg"].keyframe_insert(data_path="rotation_euler", frame=1)
    pose_bones["RightLeg"].rotation_euler = (math.radians(85), 0, 0)
    pose_bones["RightLeg"].keyframe_insert(data_path="rotation_euler", frame=1)

    # Push all actions to NLA tracks so glTF exporter embeds all clips
    for act in [idle_action, walk_action, run_action, point_action, sit_action]:
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = act.name
        track.strips.new(act.name, 1, act)

    # 6. Export glTF 2.0 Binary (.glb)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Select objects to export
    for obj in bpy.context.scene.objects:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(output_path),
        export_format='GLB',
        export_animations=True,
        export_nla_strips=True,
        export_def_bones=True,
        export_yup=True,
        export_apply=False
    )
    print(f"Successfully generated {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == '__main__':
    out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'public/assets/models/manager.glb'
    build_manager_model(out)
