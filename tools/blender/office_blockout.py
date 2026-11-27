"""Office blockout (docs/design/office/): the agreed layout in simple shapes, lit, rendered from two cameras.
The render is the input for fal image-to-image (tools/fal/ref.py office-paint) and the plan for the real room.

Layout (the user, 27 Nov): desk centred; seated, the coach faces the TV; window on his left, door on his right.
Touchscreen tactics table between desk and TV. Guest chair across the desk (one-to-ones), visitor chair by the door.
Living-room pieces: folders and coffee cups on the desk, local paper, chairman's letter, phone, trophy cabinet,
results cork board, window onto the floodlit pitch, club cat on the folders, framed playing shirt and old photo,
radio on the shelf, leak bucket.

Room: x -4..4 (west..east), y -3.25..3.25 (south..north), z 0..3. Coach sits at y -2.0 facing +y (north).
Facing +y, his left is -x: window on the west wall; door on the east wall; TV on the north wall.

  blender -b --factory-startup -P tools/blender/office_blockout.py -- out_prefix
"""
import bpy
import math
import sys
from mathutils import Vector

prefix = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

MATS = {}


def mat(name, rgb, rough=0.6, emit=None, strength=0.0, metal=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m


def box(name, center, size, m, rot_z=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], size[2])
    o.rotation_euler = (0, 0, math.radians(rot_z))
    o.data.materials.append(m)
    return o


def cyl(name, center, r, h, m, axis='Z', verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=center)
    o = bpy.context.active_object
    o.name = name
    if axis == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        o.rotation_euler = (math.radians(90), 0, 0)
    o.data.materials.append(m)
    return o


def sphere(name, center, scale, m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=center)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


# --- Materials -----------------------------------------------------------------------------------
plaster = mat('Plaster', (0.55, 0.52, 0.48), 0.9)
brick = mat('Brick', (0.36, 0.17, 0.11), 0.95)
floorwood = mat('FloorWood', (0.22, 0.14, 0.08), 0.6)
rug = mat('Rug', (0.28, 0.08, 0.07), 1.0)
oak = mat('DarkOak', (0.16, 0.08, 0.04), 0.45)
leather = mat('Leather', (0.12, 0.06, 0.03), 0.4)
leather2 = mat('LeatherBrown', (0.25, 0.12, 0.05), 0.45)
steel = mat('Steel', (0.08, 0.08, 0.09), 0.35, metal=0.6)
paper = mat('Paper', (0.85, 0.82, 0.74), 0.9)
folder_cols = [mat(f'Folder{i}', c, 0.7) for i, c in enumerate(
    [(0.05, 0.12, 0.30), (0.45, 0.07, 0.05), (0.75, 0.65, 0.35), (0.12, 0.25, 0.12), (0.6, 0.6, 0.58)])]
screen_table = mat('TableScreen', (0.02, 0.05, 0.04), 0.2, emit=(0.15, 0.75, 0.55), strength=2.2)
tv_screen = mat('TVScreen', (0.02, 0.02, 0.03), 0.2, emit=(0.25, 0.55, 0.35), strength=1.6)
black = mat('Black', (0.02, 0.02, 0.02), 0.3)
glass = mat('Glass', (0.6, 0.7, 0.8), 0.05)
window_view = mat('WindowView', (0.1, 0.2, 0.12), 1.0, emit=(0.35, 0.55, 0.75), strength=1.8)
cork = mat('Cork', (0.55, 0.38, 0.22), 0.95)
mug = mat('Mug', (0.9, 0.9, 0.88), 0.3)
gold = mat('Gold', (0.8, 0.6, 0.2), 0.25, metal=1.0)
cat = mat('CatTabby', (0.45, 0.32, 0.18), 0.9)
shirt = mat('FramedShirt', (0.55, 0.08, 0.08), 0.8)
lamp_mat = mat('LampGreen', (0.05, 0.3, 0.15), 0.3, emit=(1.0, 0.75, 0.4), strength=0.0)
bulb = mat('Bulb', (1, 1, 1), 0.2, emit=(1.0, 0.8, 0.5), strength=8.0)
radio = mat('Radio', (0.4, 0.3, 0.2), 0.5)
bucket = mat('Bucket', (0.45, 0.47, 0.5), 0.3, metal=0.8)
stain = mat('Stain', (0.42, 0.36, 0.28), 1.0)
red_dot = mat('Win', (0.15, 0.6, 0.2), 0.6)
loss_dot = mat('Loss', (0.7, 0.1, 0.1), 0.6)
draw_dot = mat('Draw', (0.75, 0.75, 0.75), 0.6)

W, D, H = 8.0, 6.5, 3.0
# --- Shell -----------------------------------------------------------------------------------------
box('Floor', (0, 0, -0.05), (W, D, 0.1), floorwood)
box('Ceiling', (0, 0, H + 0.05), (W, D, 0.1), plaster)
box('WallNorth', (0, D / 2 + 0.05, H / 2), (W, 0.1, H), plaster)
box('WallSouth', (0, -D / 2 - 0.05, H / 2), (W, 0.1, H), brick)  # behind the coach: old brick
# West wall with a big window (4 m wide, sill 0.9, head 2.6), centred at y = 0.
box('WallWestLow', (-W / 2 - 0.05, 0, 0.45), (0.1, D, 0.9), plaster)
box('WallWestHigh', (-W / 2 - 0.05, 0, 2.8), (0.1, D, 0.4), plaster)
box('WallWestN', (-W / 2 - 0.05, 2.625, 1.75), (0.1, 1.25, 1.7), plaster)
box('WallWestS', (-W / 2 - 0.05, -2.625, 1.75), (0.1, 1.25, 1.7), plaster)
box('WindowView', (-W / 2 - 1.2, 0, 1.75), (0.05, 4.4, 2.2), window_view)  # the floodlit pitch beyond
for y in (-2.0, -0.67, 0.67, 2.0):
    box('Mullion', (-W / 2 + 0.02, y, 1.75), (0.08, 0.06, 1.7), steel)
box('Sill', (-W / 2 + 0.12, 0, 0.92), (0.25, 4.0, 0.05), oak)
# East wall with the door (at y = -0.4).
box('WallEastA', (W / 2 + 0.05, -2.25, H / 2), (0.1, 2.0, H), plaster)
box('WallEastB', (W / 2 + 0.05, 1.95, H / 2), (0.1, 2.6, H), plaster)
box('WallEastTop', (W / 2 + 0.05, -0.4, 2.6), (0.1, 1.0, 0.8), plaster)
box('Door', (W / 2 + 0.02, -0.25, 1.05), (0.06, 0.95, 2.1), oak, rot_z=-12)  # ajar
cyl('DoorHandle', (W / 2 - 0.05, 0.15, 1.0), 0.02, 0.12, gold, axis='X')
box('Rug', (0, -1.0, 0.005), (3.6, 2.6, 0.01), rug)

# --- North wall: the TV ---------------------------------------------------------------------------
box('TVFrame', (0, D / 2 - 0.06, 1.75), (2.2, 0.06, 1.26), black)
box('TVScreen', (0, D / 2 - 0.095, 1.75), (2.1, 0.01, 1.18), tv_screen)
box('TVUnit', (0, D / 2 - 0.25, 0.25), (2.4, 0.45, 0.5), oak)

# --- Touchscreen tactics table (between the desk and the TV) --------------------------------------
box('TableBody', (0, 1.25, 0.42), (2.2, 1.3, 0.84), black)
box('TableScreen', (0, 1.25, 0.845), (2.1, 1.2, 0.01), screen_table)
box('TableBezel', (0, 1.25, 0.84), (2.24, 1.34, 0.02), steel)
# A few "magnets" glowing on it (player dots).
for i, (x, y) in enumerate([(-0.8, 1.0), (-0.5, 1.4), (-0.2, 0.95), (0.1, 1.55), (0.4, 1.2), (0.75, 1.0), (0.85, 1.5)]):
    cyl(f'Dot{i}', (x, y, 0.855), 0.035, 0.008, mat('DotGold', (1, 0.8, 0.3), 0.3, emit=(1, 0.8, 0.3), strength=4))

# --- Desk and the coach's corner -------------------------------------------------------------------
box('DeskTop', (0, -1.3, 0.74), (2.1, 0.95, 0.06), oak)
box('DeskPedL', (-0.78, -1.3, 0.36), (0.5, 0.85, 0.72), oak)
box('DeskPedR', (0.78, -1.3, 0.36), (0.5, 0.85, 0.72), oak)
box('DeskModesty', (0, -0.9, 0.42), (1.06, 0.04, 0.6), oak)
# Scattered folders, some stacked, some open.
import random
random.seed(7)
for i in range(11):
    x = random.uniform(-0.9, 0.9)
    y = random.uniform(-1.65, -0.95)
    stack = random.randint(1, 4)
    for k in range(stack):
        box(f'Folder{i}_{k}', (x + random.uniform(-0.03, 0.03), y, 0.78 + k * 0.025),
            (0.32, 0.24, 0.022), folder_cols[(i + k) % len(folder_cols)], rot_z=random.uniform(-35, 35))
box('OpenFolderL', (0.15, -1.45, 0.775), (0.3, 0.22, 0.005), paper, rot_z=8)
box('Newspaper', (-0.55, -1.15, 0.78), (0.42, 0.3, 0.012), paper, rot_z=-18)  # the local paper, back page
box('Letter', (0.35, -1.0, 0.776), (0.22, 0.11, 0.004), mat('Envelope', (0.9, 0.86, 0.75), 0.9), rot_z=10)
cyl('Seal', (0.35, -1.0, 0.781), 0.018, 0.004, mat('Wax', (0.5, 0.05, 0.05), 0.4))
for i, (x, y) in enumerate([(0.85, -1.55), (0.72, -1.05), (-0.95, -1.62)]):
    cyl(f'Mug{i}', (x, y, 0.82), 0.045, 0.1, mug)
box('Phone', (-0.85, -1.5, 0.8), (0.2, 0.18, 0.07), black, rot_z=15)
sphere('PhoneLight', (-0.78, -1.44, 0.84), (0.012, 0.012, 0.012), mat('Blink', (1, 0.2, 0.1), 0.3, emit=(1, 0.2, 0.1), strength=12))
# Green banker's lamp.
box('LampBase', (0.75, -1.65, 0.79), (0.14, 0.12, 0.03), gold)
cyl('LampStem', (0.75, -1.65, 0.92), 0.012, 0.25, gold)
cyl('LampShade', (0.75, -1.55, 1.04), 0.07, 0.36, lamp_mat, axis='X')
sphere('LampBulb', (0.75, -1.55, 1.01), (0.05, 0.05, 0.03), bulb)
# The club cat, asleep on a folder stack (stand-in: a curled tabby shape).
sphere('CatBody', (-0.3, -1.25, 0.9), (0.2, 0.15, 0.09), cat)
sphere('CatHead', (-0.12, -1.18, 0.91), (0.07, 0.065, 0.06), cat)
sphere('CatTail', (-0.45, -1.15, 0.86), (0.13, 0.03, 0.03), cat)

# Chairs. Coach's: leather swivel behind the desk, facing north.
def chair(name, x, y, face_deg, m, swivel=False):
    rz = math.radians(face_deg)
    fwd = Vector((math.sin(rz), math.cos(rz), 0))
    seat = box(name + 'Seat', (x, y, 0.48), (0.56, 0.52, 0.1), m)
    back = box(name + 'Back', (x - fwd.x * 0.26, y - fwd.y * 0.26, 0.85 if swivel else 0.78),
               (0.56, 0.1, 0.7 if swivel else 0.55), m)
    for o in (seat, back):
        o.rotation_euler = (0, 0, -rz)
    if swivel:
        cyl(name + 'Post', (x, y, 0.22), 0.03, 0.42, steel)
        cyl(name + 'Base', (x, y, 0.03), 0.3, 0.04, steel)
    else:
        for dx in (-0.24, 0.24):
            for dy in (-0.22, 0.22):
                box(name + 'Leg', (x + dx, y + dy, 0.21), (0.04, 0.04, 0.42), oak)
    for s in (-1, 1):  # arms
        side = Vector((math.cos(rz), -math.sin(rz), 0)) * 0.3 * s
        a = box(name + 'Arm', (x + side.x, y + side.y, 0.66), (0.06, 0.48, 0.05), m)
        a.rotation_euler = (0, 0, -rz)


chair('CoachChair', 0, -2.05, 0, leather, swivel=True)
chair('GuestChair', 0.1, -0.35, 180, leather2)  # across the desk, facing the coach
chair('VisitorChair', 3.35, 1.4, -90, leather2)  # by the door, facing into the room

# --- South wall (behind the coach): shirt, photo, trophy cabinet, shelves, coat stand, radio -------
box('ShirtFrame', (0, -D / 2 + 0.04, 1.85), (0.75, 0.04, 0.9), black)
box('Shirt', (0, -D / 2 + 0.07, 1.85), (0.55, 0.01, 0.62), shirt)
box('PhotoFrame', (1.0, -D / 2 + 0.04, 1.95), (0.5, 0.03, 0.38), black)
box('Photo', (1.0, -D / 2 + 0.06, 1.95), (0.42, 0.01, 0.3), mat('OldPhoto', (0.6, 0.55, 0.45), 0.9))
# Trophy cabinet (west end): glass, nearly empty: one small cup.
box('CabinetBody', (-2.6, -D / 2 + 0.25, 1.0), (1.2, 0.4, 2.0), oak)
box('CabinetGlass', (-2.6, -D / 2 + 0.46, 1.1), (1.1, 0.02, 1.6), glass)
for z in (0.7, 1.2, 1.7):
    box('CabShelf', (-2.6, -D / 2 + 0.25, z), (1.1, 0.36, 0.02), glass)
cyl('Cup', (-2.75, -D / 2 + 0.25, 1.32), 0.06, 0.2, gold)
sphere('MatchBall', (-2.35, -D / 2 + 0.25, 0.8), (0.11, 0.11, 0.11), mug)
# Shelves with binders and the radio (east end).
for z in (0.9, 1.35, 1.8):
    box('Shelf', (2.4, -D / 2 + 0.18, z), (1.6, 0.3, 0.03), oak)
    for i in range(9):
        box('Binder', (1.75 + i * 0.15, -D / 2 + 0.18, z + 0.16), (0.07, 0.26, 0.3),
            folder_cols[(i + int(z * 10)) % len(folder_cols)])
box('Radio', (2.9, -D / 2 + 0.2, 2.03), (0.3, 0.14, 0.18), radio)
# Coat stand with a scarf.
cyl('CoatStand', (3.5, -2.7, 0.9), 0.025, 1.8, oak)
cyl('CoatStandBase', (3.5, -2.7, 0.03), 0.22, 0.04, oak)
box('Coat', (3.5, -2.7, 1.3), (0.4, 0.2, 0.8), mat('Coat', (0.05, 0.06, 0.09), 0.9))
box('Scarf', (3.55, -2.62, 1.45), (0.1, 0.05, 0.7), shirt)

# --- East wall by the door: results cork board, wall clock -----------------------------------------
box('CorkBoard', (W / 2 - 0.04, 2.0, 1.6), (0.03, 1.5, 1.0), cork)
for r in range(6):
    for c in range(4):
        m = [red_dot, red_dot, draw_dot, loss_dot, red_dot, loss_dot][(r + c) % 6]
        box('Result', (W / 2 - 0.06, 1.45 + c * 0.36, 1.95 - r * 0.14), (0.01, 0.28, 0.09), paper)
        box('Sticker', (W / 2 - 0.07, 1.6 + c * 0.36, 1.95 - r * 0.14), (0.01, 0.06, 0.06), m)
cyl('Clock', (W / 2 - 0.04, -0.4, 2.65), 0.18, 0.04, paper, axis='X')

# --- Lower-league honesty: the leak and its bucket, in the window corner ---------------------------
cyl('Bucket', (-3.4, -2.6, 0.15), 0.15, 0.3, bucket)
cyl('CeilingStain', (-3.4, -2.6, H - 0.005), 0.35, 0.01, stain)

# --- Lights -----------------------------------------------------------------------------------------
def light(name, kind, loc, energy, color, size=None, rot=None):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if size is not None and kind == 'AREA':
        d.size = size
    o = bpy.data.objects.new(name, d)
    o.location = loc
    if rot:
        o.rotation_euler = rot
    col.objects.link(o)
    return o


light('Lamp', 'POINT', (0.75, -1.5, 0.98), 60, (1.0, 0.72, 0.42))
light('WindowFill', 'AREA', (-3.6, 0, 1.8), 450, (0.55, 0.7, 1.0), size=4.0, rot=(0, math.radians(-90), 0))
light('Ceiling1', 'AREA', (0, -1.0, 2.95), 120, (1.0, 0.85, 0.7), size=1.5)
light('Ceiling2', 'AREA', (0, 1.5, 2.95), 80, (1.0, 0.9, 0.8), size=1.5)
light('TableGlow', 'AREA', (0, 1.25, 1.0), 40, (0.3, 0.9, 0.7), size=1.8, rot=(math.radians(180), 0, 0))

world = bpy.data.worlds.new('W')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.03, 0.05, 1)

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1344
scene.render.resolution_y = 768
scene.view_settings.view_transform = 'AgX'

cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
col.objects.link(cam)
scene.camera = cam


def shoot(name, loc, look, lens):
    cam.location = Vector(loc)
    cam.data.lens = lens
    cam.rotation_euler = (Vector(look) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}_{name}.png'
    bpy.ops.render.render(write_still=True)


# Hub shot: from in front of the TV, high, looking at the coach's desk over the tactics table.
shoot('hub', (0.0, 3.0, 2.35), (0.0, -1.6, 0.9), 18)
# Corner shot: from the door-side corner by the TV, showing window, desk, table and the door wall.
shoot('corner', (3.6, 2.9, 2.2), (-0.8, -1.0, 0.9), 16)
