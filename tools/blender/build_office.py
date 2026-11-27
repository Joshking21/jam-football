"""Builds the manager's office (docs/design/office/README.md, final.jpg) -> public/assets/models/office/office.glb,
and renders previews for two times of day.

Layout (Blender units = metres; x west..east, y south..north, z up). Seated at the desk the coach faces north (+y)
toward the TV; the window is on his left (west wall), the door on his right (east wall).

Object naming contract for the game:
  screen_*      flat live surfaces with 0..1 UVs (the game draws on them): screen_table, screen_tv, screen_paper,
                screen_clock, window_view
  live_*        props that react to the season (folders, mugs, letter, phone light, trophies, stickers, bucket, ...)
  meshy_*       Blender stand-ins for models queued for Meshy (desk, chairs, cat); replaced later, same placement
  door          pivots at its hinge (origin on the hinge line)
  light_*       emissive fittings; the game puts real lights at their positions
Materials ClubPrimary / ClubSecondary are tinted to the club by the game.

  python tools/blender/office_textures.py      (once)
  blender -b --factory-startup -P tools/blender/build_office.py -- public/assets/models/office/office.glb [preview_prefix]
"""
import bmesh
import bpy
import math
import os
import pathlib
import random
import sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = pathlib.Path(argv[0]).resolve()
PREVIEW = argv[1] if len(argv) > 1 else None
TEX = pathlib.Path(__file__).resolve().parent / 'office_tex'
rnd = random.Random(27)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection

W, D, H = 8.0, 6.5, 3.0
X0, X1, Y0, Y1 = -W / 2, W / 2, -D / 2, D / 2

# ------------------------------------------------------------------------------------------------ materials
_mats = {}


def image(name):
    p = TEX / f'{name}.png'
    img = bpy.data.images.get(p.name) or bpy.data.images.load(str(p))
    return img


def mat(name, rgb=(0.5, 0.5, 0.5), rough=0.6, metal=0.0, tex=None, emit=None, emit_tex=None, strength=1.0,
        alpha=1.0, normal=None, normal_strength=1.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if tex:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = image(tex)
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if emit or emit_tex:
        b.inputs['Emission Strength'].default_value = strength
        if emit_tex:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(emit_tex)
            nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
            nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        else:
            b.inputs['Emission Color'].default_value = (*emit, 1)
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = image(normal)
        t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except AttributeError:
            m.blend_method = 'BLEND'
    _mats[name] = m
    return m


M = {
    'planks': mat('FloorOak', tex='planks', rough=0.55, normal='n_planks', normal_strength=0.8),
    'brick': mat('Brick', tex='brick', rough=0.92, normal='n_brick', normal_strength=1.0),
    'plaster': mat('Plaster', tex='plaster', rough=0.9, normal='n_plaster', normal_strength=0.6),
    'plaster_warm': mat('PlasterWarm', tex='plaster_warm', rough=0.9, normal='n_plaster', normal_strength=0.6),
    'desk_oak': mat('DeskOak', tex='dark_oak_worn', rough=0.4),
    'spines': mat('Spines', tex='spines', rough=0.6),
    'ceiling': mat('Ceiling', (0.82, 0.8, 0.76), rough=0.95),
    'paint_dark': mat('PaintDark', (0.07, 0.09, 0.12), rough=0.7),  # door-side wall, as final.jpg
    'trim': mat('TrimWhite', (0.85, 0.84, 0.8), rough=0.5),
    'oak': mat('DarkOak', tex='dark_oak', rough=0.45),
    'oak_light': mat('MidOak', (0.36, 0.22, 0.12), rough=0.5),
    'leather': mat('LeatherOxblood', tex='leather_oxblood', rough=0.38, normal='n_leather', normal_strength=0.9),
    'leather2': mat('LeatherBrown', tex='leather_brown', rough=0.42, normal='n_leather', normal_strength=0.9),
    'brass': mat('Brass', (0.78, 0.6, 0.3), rough=0.28, metal=1.0),
    'steel': mat('SteelBlack', (0.05, 0.05, 0.06), rough=0.35, metal=0.7),
    'chrome': mat('Chrome', (0.8, 0.8, 0.82), rough=0.15, metal=1.0),
    'black': mat('BlackPlastic', (0.02, 0.02, 0.025), rough=0.4),
    'glass': mat('Glass', (0.7, 0.8, 0.85), rough=0.05, alpha=0.12),
    'rug': mat('Rug', tex='rug_worn', rough=1.0, normal='n_rug', normal_strength=0.7),
    'cork': mat('Cork', tex='cork', rough=0.95),
    'paper': mat('Paper', (0.88, 0.85, 0.77), rough=0.9),
    'card': mat('CardBuff', (0.78, 0.66, 0.42), rough=0.85),
    'ceramic': mat('Ceramic', (0.92, 0.91, 0.88), rough=0.25),
    'gold': mat('TrophyGold', (0.85, 0.66, 0.28), rough=0.22, metal=1.0),
    'silver': mat('TrophySilver', (0.85, 0.86, 0.88), rough=0.2, metal=1.0),
    'club1': mat('ClubPrimary', (0.6, 0.06, 0.07), rough=0.75, normal='n_cloth', normal_strength=1.1),
    'club2': mat('ClubSecondary', (0.92, 0.9, 0.86), rough=0.75, normal='n_cloth', normal_strength=1.1),
    'coat': mat('CoatWool', (0.05, 0.06, 0.09), rough=0.95, normal='n_wool', normal_strength=1.2),
    'radiator': mat('RadiatorPaint', (0.84, 0.83, 0.79), rough=0.45),
    'tabby': mat('CatTabby', (0.42, 0.3, 0.17), rough=0.95),
    'win': mat('StickerWin', (0.13, 0.55, 0.22), rough=0.6),
    'draw': mat('StickerDraw', (0.75, 0.74, 0.7), rough=0.6),
    'loss': mat('StickerLoss', (0.68, 0.1, 0.1), rough=0.6),
    'wax': mat('WaxSeal', (0.5, 0.05, 0.05), rough=0.4),
    'stain': mat('DampStain', (0.48, 0.42, 0.33), rough=1.0, alpha=0.7),
    'lampshade': mat('LampGreenGlass', (0.04, 0.32, 0.14), rough=0.15),
    'bulb': mat('WarmBulb', emit=(1.0, 0.78, 0.5), strength=12.0),
    'downlight': mat('Downlight', emit=(1.0, 0.92, 0.82), strength=6.0),
    'sconce': mat('SconceGlow', emit=(1.0, 0.75, 0.45), strength=5.0),
    'phone_light': mat('PhoneLight', emit=(1.0, 0.18, 0.08), strength=14.0),
    'screen_table': mat('ScreenTable', emit_tex='tactics_fallback', strength=1.6, rough=0.15),
    'screen_tv': mat('ScreenTV', emit_tex='tv_fallback', strength=1.0, rough=0.1),
    'screen_paper': mat('ScreenPaper', tex='newspaper', rough=0.9),
    'screen_clock': mat('ScreenClock', tex='clock_face', rough=0.5),
    'photo': mat('OldPhoto', tex='team_photo', rough=0.6),
    'window_view': mat('WindowView', emit_tex='window_night', strength=1.4),
}
FOLDERS = [mat(f'Folder{i}', c, rough=0.75) for i, c in enumerate(
    [(0.06, 0.13, 0.32), (0.48, 0.08, 0.06), (0.78, 0.66, 0.36), (0.13, 0.27, 0.14), (0.62, 0.62, 0.6), (0.2, 0.2, 0.22)])]

# ------------------------------------------------------------------------------------------------ helpers


def _finish(o, m, uv=True, bevel=0.0):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if m:
        o.data.materials.append(m)
    if uv:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.cube_project(cube_size=1.0)
        bpy.ops.object.mode_set(mode='OBJECT')
    if bevel > 0:
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    o.select_set(False)
    return o


def box(name, c, s, m, rz=0.0, uv=True, bevel=0.0, rx=0.0, ry=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.active_object
    o.name = name
    o.scale = s
    o.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    return _finish(o, m, uv, bevel)


def cyl(name, c, r, h, m, axis='Z', v=24, uv=True, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=h, location=c)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2, depth=h, location=c)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = {'Z': (0, 0, 0), 'X': (0, math.radians(90), 0), 'Y': (math.radians(90), 0, 0)}[axis]
    bpy.ops.object.shade_smooth()
    return _finish(o, m, uv, bevel)


def ball(name, c, s, m, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(8, seg // 2), radius=1, location=c)
    o = bpy.context.active_object
    o.name = name
    o.scale = s
    bpy.ops.object.shade_smooth()
    return _finish(o, m, True)


def plane(name, c, w, h, m, rot=(90, 0, 0)):
    """A 0..1-UV quad (live surfaces): w x h metres, rotated by Euler degrees."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=c)
    o = bpy.context.active_object
    o.name = name
    o.scale = (w, h, 1)
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    return _finish(o, m, uv=False)


def lathe(name, profile, c, m, steps=32):
    """Solid of revolution around Z from a list of (radius, z) points."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    for a, b in zip(verts, verts[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], angle=math.radians(360), steps=steps, axis=(0, 0, 1),
                   cent=(0, 0, 0))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = c
    for p in me.polygons:
        p.use_smooth = True
    return _finish(o, m, True)


def extrude_outline(name, pts, depth, c, m, rot=(90, 0, 0)):
    """A flat shape from a 2D outline (x, y) in metres, extruded `depth`; stood up by `rot`."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0)) for x, y in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = c
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    return _finish(o, m, True)


SPINE_COLS = 16


def spine_uv(o, col, facing=Vector((0, 1, 0))):
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    xs = [v.co.x for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    cw = 1.0 / SPINE_COLS
    for f in bm.faces:
        c = col if f.normal.dot(facing) > 0.7 else SPINE_COLS - 1
        for loop in f.loops:
            p = loop.vert.co
            u = (p.x - x0) / max(1e-6, x1 - x0)
            v = (p.z - z0) / max(1e-6, z1 - z0)
            if abs(f.normal.z) > 0.7:  # top/bottom: page edges run along y
                v = (p.y - min(q.co.y for q in bm.verts)) / max(1e-6, max(q.co.y for q in bm.verts) - min(q.co.y for q in bm.verts))
            loop[uv].uv = (c * cw + (0.06 + 0.88 * u) * cw, v)
    bm.to_mesh(me)
    bm.free()


def parent(children, name):
    e = bpy.data.objects.new(name, None)
    coll.objects.link(e)
    for ch in children:
        ch.parent = e
    return e


# ------------------------------------------------------------------------------------------------ shell
box('floor', (0, 0, -0.05), (W, D, 0.1), M['planks'])
box('ceiling', (0, 0, H + 0.05), (W, D, 0.1), M['ceiling'])
box('wall_north', (0, Y1 + 0.05, H / 2), (W, 0.1, H), M['plaster_warm'])
box('wall_south_brick', (0, Y0 - 0.05, H / 2), (W, 0.1, H), M['brick'])
# West: window 4.2 m wide, sill 0.85, head 2.65.
WX = X0 - 0.05
box('wall_west_low', (WX, 0, 0.425), (0.3, D, 0.85), M['plaster'])
box('wall_west_high', (WX, 0, 2.825), (0.3, D, 0.35), M['plaster'])
box('wall_west_n', (WX, 2.675, 1.75), (0.3, 1.15, 1.8), M['plaster'])
box('wall_west_s', (WX, -2.675, 1.75), (0.3, 1.15, 1.8), M['plaster'])
for i, y in enumerate((-2.1, -0.7, 0.7, 2.1)):
    box(f'window_mullion_{i}', (X0 + 0.02, y, 1.75), (0.1, 0.08, 1.8), M['steel'], bevel=0.005)
box('window_transom', (X0 + 0.02, 0, 2.2), (0.1, 4.2, 0.07), M['steel'])
box('window_frame_top', (X0 + 0.02, 0, 2.66), (0.12, 4.3, 0.06), M['steel'])
box('window_frame_bottom', (X0 + 0.02, 0, 0.84), (0.12, 4.3, 0.06), M['steel'])
box('window_glass', (X0 - 0.01, 0, 1.75), (0.01, 4.2, 1.8), M['glass'], uv=False)
box('window_sill', (X0 + 0.16, 0, 0.86), (0.3, 4.4, 0.04), M['oak_light'], bevel=0.006)
plane('window_view', (X0 - 2.0, 0, 1.6), 9.0, 4.4, M['window_view'], rot=(90, 0, 90))
# East: the door at y = -0.5 (on the coach's right), 1.0 m wide, 2.15 high; a dark painted wall like final.jpg.
EX = X1 + 0.05
DOOR_Y, DOOR_W, DOOR_H = -0.5, 1.0, 2.15
box('wall_east_s', (EX, (Y0 + DOOR_Y - DOOR_W / 2) / 2, H / 2), (0.1, (DOOR_Y - DOOR_W / 2) - Y0, H), M['paint_dark'])
box('wall_east_n', (EX, (Y1 + DOOR_Y + DOOR_W / 2) / 2, H / 2), (0.1, Y1 - (DOOR_Y + DOOR_W / 2), H), M['paint_dark'])
box('wall_east_head', (EX, DOOR_Y, (H + DOOR_H) / 2), (0.1, DOOR_W, H - DOOR_H), M['paint_dark'])
for s in (-1, 1):
    box(f'door_architrave_{s}', (X1 - 0.01, DOOR_Y + s * (DOOR_W / 2 + 0.04), DOOR_H / 2), (0.03, 0.09, DOOR_H),
        M['trim'], bevel=0.004)
box('door_architrave_top', (X1 - 0.01, DOOR_Y, DOOR_H + 0.045), (0.03, DOOR_W + 0.17, 0.09), M['trim'], bevel=0.004)
# Door: hinge on the south jamb, opened 18 degrees into the room.
door = box('door', (0, DOOR_W / 2, DOOR_H / 2), (0.045, DOOR_W - 0.02, DOOR_H - 0.01), M['trim'], bevel=0.004)
for i, (zz, hh) in enumerate(((1.55, 0.7), (0.6, 0.85))):
    box(f'door_panel_{i}', (-0.026, DOOR_W / 2, zz), (0.01, DOOR_W - 0.24, hh), M['trim'], bevel=0.006)
handle = cyl('door_handle', (-0.07, DOOR_W - 0.12, 1.02), 0.012, 0.12, M['brass'], axis='X')
for ch in [o for o in bpy.data.objects if o.name.startswith('door_panel_')] + [handle]:
    ch.parent = door
door.location = (X1 - 0.04, DOOR_Y - DOOR_W / 2, 0)
door.rotation_euler = (0, 0, math.radians(-18))

# Skirting and cornice.
for name, c, s in (('skirting_n', (0, Y1 - 0.01, 0.07), (W, 0.02, 0.14)), ('skirting_s', (0, Y0 + 0.01, 0.07), (W, 0.02, 0.14)),
                   ('skirting_w', (X0 + 0.01, 0, 0.07), (0.02, D, 0.14))):
    box(name, c, s, M['trim'])
for name, c, s in (('cornice_n', (0, Y1 - 0.03, H - 0.04), (W, 0.06, 0.08)), ('cornice_s', (0, Y0 + 0.03, H - 0.04), (W, 0.06, 0.08)),
                   ('cornice_w', (X0 + 0.03, 0, H - 0.04), (0.06, D, 0.08)), ('cornice_e', (X1 - 0.03, 0, H - 0.04), (0.06, D, 0.08))):
    box(name, c, s, M['trim'])

# Recessed downlights (final.jpg) and two brass wall sconces on the brick wall.
for i, (x, y) in enumerate(((-2.2, -1.6), (2.2, -1.6), (-2.2, 1.4), (2.2, 1.4), (0, 0.2))):
    cyl(f'light_downlight_{i}', (x, y, H - 0.005), 0.07, 0.01, M['downlight'], uv=False)
for i, x in enumerate((-1.6, 1.6)):
    box(f'light_sconce_plate_{i}', (x, Y0 + 0.015, 1.95), (0.08, 0.03, 0.14), M['brass'])
    cyl(f'light_sconce_{i}', (x, Y0 + 0.11, 2.02), 0.07, 0.12, M['sconce'], r2=0.04, uv=False)

# Radiator under the window.
fins = [box(f'radiator_fin_{i}', (X0 + 0.12, -1.2 + i * 0.075, 0.48), (0.08, 0.05, 0.62), M['radiator'], bevel=0.01, uv=False)
        for i in range(32)]
parent(fins, 'radiator')

# Rug under the desk zone.
box('rug', (0, -1.15, 0.006), (3.8, 2.8, 0.012), M['rug'], uv=False)
rug = bpy.data.objects['rug']
for poly in rug.data.polygons:  # 0..1 on top
    pass
bpy.context.view_layer.objects.active = rug
rug.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.project_from_view(scale_to_bounds=True) if False else bpy.ops.uv.cube_project(cube_size=3.8, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
rug.select_set(False)

# ------------------------------------------------------------------------------------------------ the TV wall
box('tv_frame', (0, Y1 - 0.06, 1.75), (2.3, 0.06, 1.32), M['black'], bevel=0.008)
plane('screen_tv', (0, Y1 - 0.095, 1.75), 2.2, 1.24, M['screen_tv'], rot=(90, 0, 180))
sb = [box('tv_sideboard', (0, Y1 - 0.28, 0.32), (2.6, 0.48, 0.64), M['oak'], bevel=0.01)]
for i in range(4):
    sb.append(box(f'tv_sideboard_door_{i}', (-0.975 + i * 0.65, Y1 - 0.525, 0.34), (0.62, 0.015, 0.56), M['oak'], bevel=0.004))
    sb.append(cyl(f'tv_sideboard_knob_{i}', (-0.75 + i * 0.65, Y1 - 0.54, 0.4), 0.012, 0.03, M['brass'], axis='Y'))

# ------------------------------------------------------------------------------------------------ tactics table
TY = 1.3
box('tactics_table_body', (0, TY, 0.42), (2.3, 1.4, 0.8), M['steel'], bevel=0.02)
box('tactics_table_bezel', (0, TY, 0.835), (2.34, 1.44, 0.03), M['black'], bevel=0.006)
plane('screen_table', (0, TY, 0.852), 2.2, 1.3, M['screen_table'], rot=(0, 0, 180))
box('tactics_table_kick', (0, TY, 0.03), (2.1, 1.2, 0.06), M['black'])

# ------------------------------------------------------------------------------------------------ the desk (Meshy stand-in)
DY = -1.3
desk = [box('meshy_desk_top', (0, DY, 0.755), (2.1, 1.0, 0.05), M['desk_oak'], bevel=0.012)]
for s in (-1, 1):
    desk.append(box(f'meshy_desk_ped_{s}', (s * 0.76, DY, 0.37), (0.56, 0.92, 0.72), M['oak'], bevel=0.01))
    for k in range(3):  # drawer fronts on the guest's side (north face) and handles
        desk.append(box(f'meshy_desk_drawer_{s}_{k}', (s * 0.76, DY + 0.465, 0.6 - k * 0.22), (0.5, 0.02, 0.19), M['oak'], bevel=0.005))
        desk.append(box(f'meshy_desk_handle_{s}_{k}', (s * 0.76, DY + 0.49, 0.62 - k * 0.22), (0.12, 0.015, 0.02), M['brass']))
desk.append(box('meshy_desk_modesty', (0, DY + 0.38, 0.45), (0.98, 0.03, 0.56), M['oak'], bevel=0.004))
desk.append(box('meshy_desk_leather_inlay', (0, DY - 0.08, 0.781), (1.3, 0.62, 0.003), M['leather'], uv=True))
parent(desk, 'meshy_desk')


def wingback(name, x, y, face_deg, m):
    """Buttoned wingback (final.jpg); faces `face_deg` (0 = north)."""
    parts = []
    parts.append(box(name + '_seat', (0, 0, 0.47), (0.62, 0.56, 0.14), m, bevel=0.03))
    parts.append(box(name + '_back', (0, -0.3, 0.92), (0.66, 0.16, 0.78), m, bevel=0.04))
    for s in (-1, 1):
        parts.append(box(name + f'_wing_{s}', (s * 0.34, -0.17, 0.98), (0.1, 0.32, 0.5), m, bevel=0.03))
        parts.append(box(name + f'_arm_{s}', (s * 0.35, 0.02, 0.66), (0.12, 0.56, 0.22), m, bevel=0.035))
        for t in (-1, 1):
            parts.append(cyl(name + f'_leg_{s}_{t}', (s * 0.27, t * 0.22, 0.2), 0.025, 0.4, M['oak'], r2=0.018))
    for i in range(4):  # buttons on the back
        for j in range(3):
            parts.append(ball(name + f'_button_{i}_{j}', (-0.21 + i * 0.14, -0.215, 0.75 + j * 0.17), (0.012, 0.008, 0.012), m, 8))
    e = parent(parts, name)
    e.location = (x, y, 0)
    e.rotation_euler = (0, 0, math.radians(-face_deg))
    return e


def armchair(name, x, y, face_deg, m):
    parts = [box(name + '_seat', (0, 0, 0.46), (0.54, 0.5, 0.1), m, bevel=0.025),
             box(name + '_back', (0, -0.24, 0.76), (0.54, 0.07, 0.5), m, bevel=0.025)]
    for s in (-1, 1):
        parts.append(box(name + f'_arm_{s}', (s * 0.29, 0.0, 0.64), (0.05, 0.48, 0.04), M['oak'], bevel=0.008))
        parts.append(box(name + f'_armpost_{s}', (s * 0.29, 0.2, 0.55), (0.04, 0.04, 0.18), M['oak']))
        for t in (-1, 1):
            parts.append(box(name + f'_leg_{s}_{t}', (s * 0.24, t * 0.21, 0.21), (0.045, 0.045, 0.42), M['oak'], bevel=0.006))
    e = parent(parts, name)
    e.location = (x, y, 0)
    e.rotation_euler = (0, 0, math.radians(-face_deg))
    return e


wingback('meshy_chair_coach', 0, -2.1, 0, M['leather'])
armchair('meshy_chair_guest', 0.15, -0.35, 180, M['leather2'])
armchair('meshy_chair_visitor', X1 - 0.6, 1.5, 270, M['leather2'])

# ------------------------------------------------------------------------------------------------ on the desk
TOP = 0.782
folders = []
for i in range(14):
    x = rnd.uniform(-0.92, 0.92)
    y = DY + rnd.uniform(-0.38, 0.32)
    if abs(x) < 0.45 and DY - 0.32 < y < DY + 0.15 and i % 3:
        x += 0.5 * (1 if x > 0 else -1)  # keep the writing space mostly clear
    for k in range(rnd.randint(1, 4)):
        folders.append(box(f'live_folder_{i}_{k}', (x + rnd.uniform(-0.03, 0.03), y + rnd.uniform(-0.02, 0.02), TOP + 0.011 + k * 0.022),
                           (0.33, 0.245, 0.02), FOLDERS[(i + k) % len(FOLDERS)], rz=rnd.uniform(-40, 40), bevel=0.003))
box('live_folder_open', (0.18, DY - 0.15, TOP + 0.003), (0.46, 0.3, 0.004), M['paper'], rz=6)
for i in range(4):
    box(f'live_report_{i}', (rnd.uniform(-0.7, 0.7), DY + rnd.uniform(-0.3, 0.3), TOP + 0.002 + i * 0.001), (0.21, 0.297, 0.002), M['paper'], rz=rnd.uniform(-60, 60), uv=False)
plane('screen_paper', (-0.55, DY + 0.1, TOP + 0.006), 0.3, 0.4, M['screen_paper'], rot=(0, 0, -18))
box('live_letter', (0.38, DY + 0.28, TOP + 0.003), (0.22, 0.11, 0.004), M['paper'], rz=12)
cyl('live_letter_seal', (0.38, DY + 0.28, TOP + 0.007), 0.017, 0.004, M['wax'])
for i, (x, y) in enumerate(((0.86, DY - 0.3), (0.7, DY + 0.25), (-0.95, DY - 0.36), (-0.3, DY + 0.36), (0.5, DY - 0.38))):
    lathe(f'live_mug_{i}', [(0.0, 0.0), (0.04, 0.0), (0.045, 0.01), (0.046, 0.1), (0.04, 0.1), (0.039, 0.012), (0.0, 0.012)],
          (x, y, TOP), M['ceramic'], 20)
    box(f'live_mug_{i}_handle', (x + 0.055, y, TOP + 0.055), (0.02, 0.012, 0.06), M['ceramic'], bevel=0.005)
phone = [box('live_phone', (-0.82, DY - 0.18, TOP + 0.035), (0.22, 0.19, 0.07), M['black'], rz=14, bevel=0.012),
         box('live_phone_handset', (-0.82, DY - 0.18, TOP + 0.085), (0.22, 0.06, 0.035), M['black'], rz=14, bevel=0.012)]
ball('live_phone_light', (-0.75, DY - 0.1, TOP + 0.072), (0.01, 0.01, 0.01), M['phone_light'], 8)
# Green banker's lamp.
lathe('lamp_base', [(0, 0), (0.08, 0), (0.08, 0.015), (0.05, 0.03), (0, 0.03)], (0.78, DY - 0.32, TOP), M['brass'])
cyl('lamp_stem', (0.78, DY - 0.32, TOP + 0.16), 0.01, 0.3, M['brass'])
shade = cyl('lamp_shade', (0.78, DY - 0.22, TOP + 0.33), 0.075, 0.38, M['lampshade'], axis='X', r2=None)
ball('lamp_bulb', (0.78, DY - 0.22, TOP + 0.3), (0.06, 0.06, 0.03), M['bulb'], 12)
# The club cat, asleep on a folder pile (Meshy stand-in: a curled tabby).
cat = [ball('meshy_cat_body', (0, 0, 0.08), (0.21, 0.15, 0.085), M['tabby']),
       ball('meshy_cat_head', (0.17, 0.08, 0.09), (0.075, 0.07, 0.062), M['tabby']),
       ball('meshy_cat_tail', (-0.12, 0.12, 0.04), (0.16, 0.035, 0.03), M['tabby'])]
for s in (-1, 1):
    cyl(f'meshy_cat_ear_{s}', (0.2, 0.08 + s * 0.035, 0.16), 0.022, 0.05, M['tabby'], r2=0.0, v=8)
    cat.append(bpy.data.objects[f'meshy_cat_ear_{s}'])
c = parent(cat, 'meshy_cat')
c.location = (-0.32, DY + 0.05, TOP + 0.06)
c.rotation_euler = (0, 0, math.radians(25))

# ------------------------------------------------------------------------------------------------ brick wall (behind the coach)
# Framed club shirt (centre) and the old team photo.
box('framed_shirt_frame', (0, Y0 + 0.035, 1.9), (0.8, 0.05, 0.95), M['black'], bevel=0.006)
box('framed_shirt_mount', (0, Y0 + 0.062, 1.9), (0.7, 0.006, 0.85), M['club2'])
SHIRT = [(-0.26, 0.28), (-0.1, 0.33), (0.1, 0.33), (0.26, 0.28), (0.34, 0.12), (0.22, 0.06), (0.2, -0.33), (-0.2, -0.33),
         (-0.22, 0.06), (-0.34, 0.12)]
extrude_outline('framed_shirt', SHIRT, 0.012, (0, Y0 + 0.07, 1.9), M['club1'], rot=(90, 0, 0))
box('framed_shirt_glass', (0, Y0 + 0.085, 1.9), (0.74, 0.004, 0.89), M['glass'], uv=False)
box('framed_photo_frame', (1.05, Y0 + 0.03, 1.95), (0.56, 0.04, 0.42), M['oak'], bevel=0.006)
plane('framed_photo', (1.05, Y0 + 0.052, 1.95), 0.48, 0.32, M['photo'], rot=(90, 0, 0))
# Wall clock above the photo side.
cyl('clock_rim', (-1.05, Y0 + 0.04, 2.25), 0.19, 0.05, M['black'], axis='Y')
plane('screen_clock', (-1.05, Y0 + 0.067, 2.25), 0.34, 0.34, M['screen_clock'], rot=(90, 0, 0))
box('live_clock_hour', (-1.05, Y0 + 0.075, 2.25 + 0.045), (0.012, 0.004, 0.09), M['black'])
box('live_clock_minute', (-1.05, Y0 + 0.078, 2.25 + 0.065), (0.008, 0.004, 0.13), M['black'])

# The cubby display unit (s54): 3 x 4 cubbies, old shirts hung inside, a trophy standing casually on top.
CX, CW, CH = -2.7, 1.3, 2.0
unit = [box('cubby_back', (CX, Y0 + 0.02, CH / 2), (CW, 0.02, CH), M['oak'])]
for side in (-1, 1):
    unit.append(box(f'cubby_side_{side}', (CX + side * CW / 2, Y0 + 0.2, CH / 2), (0.03, 0.4, CH), M['oak'], bevel=0.004))
for r in range(5):
    unit.append(box(f'cubby_shelf_{r}', (CX, Y0 + 0.2, 0.02 + r * (CH - 0.04) / 4), (CW, 0.4, 0.03), M['oak'], bevel=0.004))
for k in range(1, 3):
    unit.append(box(f'cubby_div_{k}', (CX - CW / 2 + k * CW / 3, Y0 + 0.2, CH / 2), (0.025, 0.4, CH), M['oak']))
parent(unit, 'cubby_unit')
HANG = [(-0.16, 0.2), (-0.06, 0.24), (0.06, 0.24), (0.16, 0.2), (0.21, 0.09), (0.13, 0.05), (0.12, -0.2), (-0.12, -0.2),
        (-0.13, 0.05), (-0.21, 0.09)]
for r in range(4):
    for k in range(3):
        if (r, k) in ((0, 1), (3, 0)):
            continue  # a couple of cubbies hold binders instead
        z = 0.02 + r * (CH - 0.04) / 4 + 0.27
        x = CX - CW / 2 + (k + 0.5) * CW / 3
        extrude_outline(f'cubby_shirt_{r}_{k}', HANG, 0.01, (x, Y0 + 0.1, z), M['club1'] if (r + k) % 3 else M['club2'], rot=(90, 0, 0))
for i in range(6):
    o = box(f'cubby_binder_{i}', (CX - CW / 3 - 0.14 + i * 0.058, Y0 + 0.2, 0.02 + 3 * (CH - 0.04) / 4 + 0.165),
            (0.052, 0.3, 0.29), M['spines'], uv=False)
    spine_uv(o, rnd.randrange(SPINE_COLS - 1))
# Trophies, laid back: a cup on top of the unit, a shield leaning on the floor beside it.
lathe('live_trophy_cup', [(0, 0), (0.07, 0), (0.07, 0.03), (0.035, 0.05), (0.02, 0.12), (0.02, 0.15), (0.09, 0.22),
                          (0.1, 0.32), (0.095, 0.33), (0.0, 0.33)], (CX + 0.35, Y0 + 0.2, CH + 0.015), M['gold'])
for s in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.05, minor_radius=0.008, location=(CX + 0.35 + s * 0.1, Y0 + 0.2, CH + 0.28))
    t = bpy.context.active_object
    t.name = f'live_trophy_cup_handle_{s}'
    t.rotation_euler = (math.radians(90), 0, 0)
    _finish(t, M['gold'], False)
box('live_trophy_shield', (CX + 0.85, Y0 + 0.16, 0.24), (0.32, 0.03, 0.42), M['oak'], rx=-12, bevel=0.01)
cyl('live_trophy_shield_plate', (CX + 0.85, Y0 + 0.19, 0.27), 0.11, 0.01, M['silver'], axis='Y')
ball('live_match_ball', (CX + 0.55, Y0 + 0.5, 0.11), (0.11, 0.11, 0.11), M['ceramic'], 20)

# Shelves of binders and the radio (east end of the brick wall).
for zi, z in enumerate((0.95, 1.4, 1.85)):
    box(f'shelf_{zi}', (2.45, Y0 + 0.16, z), (1.5, 0.28, 0.03), M['oak'], bevel=0.004)
    x = 1.74
    i = 0
    while x < 3.15 - (0.45 if zi == 2 else 0):
        wdt = rnd.choice([0.045, 0.06, 0.065, 0.07, 0.035])
        hgt = rnd.choice([0.3, 0.3, 0.28, 0.24, 0.22])
        o = box(f'shelf_binder_{zi}_{i}', (x + wdt / 2, Y0 + 0.16, z + 0.015 + hgt / 2), (wdt, 0.24, hgt), M['spines'],
                rz=rnd.uniform(-1.5, 1.5), uv=False)
        spine_uv(o, rnd.randrange(SPINE_COLS - 1))
        x += wdt + rnd.choice([0.002, 0.004, 0.0])
        i += 1
        if rnd.random() < 0.08:
            x += 0.08  # a gap, a book leaning into it
            lean = box(f'shelf_binder_{zi}_{i}', (x - 0.03, Y0 + 0.16, z + 0.015 + 0.12), (0.04, 0.22, 0.26), M['spines'],
                       ry=-16, uv=False)
            spine_uv(lean, rnd.randrange(SPINE_COLS - 1))
            i += 1
box('live_radio', (3.0, Y0 + 0.17, 2.0), (0.32, 0.15, 0.2), M['oak_light'], bevel=0.015)
cyl('live_radio_dial', (2.93, Y0 + 0.25, 2.0), 0.04, 0.01, M['brass'], axis='Y')

# Coat stand with the coach's coat and a club scarf (south-east corner).
cyl('coat_stand_pole', (3.45, -2.7, 0.92), 0.02, 1.84, M['oak'])
cyl('coat_stand_base', (3.45, -2.7, 0.02), 0.22, 0.04, M['oak'], r2=0.16)
for k in range(4):  # hooks
    a = k * math.pi / 2
    cyl(f'coat_stand_hook_{k}', (3.45 + 0.08 * math.cos(a), -2.7 + 0.08 * math.sin(a), 1.8), 0.008, 0.16, M['oak'])
# The coat hangs from a hook: narrow shoulders, widening to the hem, slightly flattened.
coat = lathe('coat_stand_coat', [(0.0, 0.0), (0.24, 0.0), (0.22, 0.4), (0.19, 0.7), (0.17, 0.86), (0.08, 0.92), (0.0, 0.93)],
             (3.45, -2.6, 0.84), M['coat'], 20)
coat.scale = (1.0, 0.55, 1.0)
bpy.context.view_layer.objects.active = coat
coat.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
coat.select_set(False)
# Scarf over the coat's shoulders: two hanging tails with club bars.
for side in (-1, 1):
    for i in range(7):
        box(f'coat_stand_scarf_{side}_{i}', (3.45 + side * 0.07, -2.46, 1.7 - i * 0.075), (0.09, 0.025, 0.075),
            M['club1'] if (i // 2) % 2 == 0 else M['club2'], bevel=0.004)
box('coat_stand_scarf_neck', (3.45, -2.5, 1.76), (0.24, 0.07, 0.05), M['club1'], bevel=0.01)

# ------------------------------------------------------------------------------------------------ by the door: results cork board
box('cork_board_frame', (X1 - 0.03, 2.1, 1.6), (0.04, 1.6, 1.05), M['oak'], bevel=0.006)
box('cork_board', (X1 - 0.055, 2.1, 1.6), (0.01, 1.5, 0.95), M['cork'])
kinds = [M['win'], M['win'], M['draw'], M['loss'], M['win'], M['loss'], M['draw']]
for r in range(6):
    for k in range(4):
        y = 1.55 + k * 0.37
        z = 1.95 - r * 0.15
        box(f'live_result_{r}_{k}', (X1 - 0.063, y, z), (0.004, 0.3, 0.1), M['paper'], uv=False)
        if r * 4 + k < 14:  # played so far; later fixtures have no sticker yet
            cyl(f'live_sticker_{r}_{k}', (X1 - 0.066, y + 0.12, z), 0.025, 0.004, kinds[(r * 4 + k) % len(kinds)], axis='X')

# ------------------------------------------------------------------------------------------------ lower-league honesty
lathe('live_bucket', [(0, 0), (0.13, 0), (0.16, 0.3), (0.155, 0.3), (0.125, 0.012), (0, 0.012)], (X0 + 0.55, Y0 + 0.6, 0), M['chrome'])
cyl('live_leak_stain', (X0 + 0.55, Y0 + 0.6, H - 0.004), 0.4, 0.004, M['stain'], uv=False)

# ------------------------------------------------------------------------------------------------ merge static
# Everything that never changes is joined into one mesh per material (draw calls: ~340 objects -> ~60).
# live_*, screen_*, meshy_*, door, light_*, window_view and the clock hands stay separate for the game.
KEEP = ('live_', 'screen_', 'meshy_', 'door', 'light_', 'window_view')


def keep(o):
    while o is not None:
        if o.name.startswith(KEEP):
            return True
        o = o.parent
    return False


static = [o for o in bpy.data.objects if o.type == 'MESH' and not keep(o)]
bpy.ops.object.select_all(action='DESELECT')
for o in static:  # bake modifiers (bevels) and parent transforms in, so the join is exact
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.select_set(False)
by_mat = {}
for o in static:
    key = o.data.materials[0].name if o.data.materials else 'none'
    by_mat.setdefault(key, []).append(o)
for key, objs in by_mat.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    bpy.context.active_object.name = f'static_{key}'
# Meshy stand-ins: fuse each group's parts into one mesh per material, under the group's empty (the game
# swaps the whole group for the Meshy model later).
for grp in [o for o in bpy.data.objects if o.type == 'EMPTY' and o.name.startswith('meshy_')]:
    parts = [c for c in grp.children_recursive if c.type == 'MESH']
    groups_by_mat = {}
    for c in parts:
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = c
        c.select_set(True)
        for m in list(c.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
        groups_by_mat.setdefault(c.data.materials[0].name if c.data.materials else 'none', []).append(c)
    for key, objs in groups_by_mat.items():
        bpy.ops.object.select_all(action='DESELECT')
        for c in objs:
            c.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        bpy.context.active_object.name = f'{grp.name}__{key}'
for e in [o for o in bpy.data.objects if o.type == 'EMPTY' and not o.children and not keep(o)]:
    bpy.data.objects.remove(e, do_unlink=True)

# ------------------------------------------------------------------------------------------------ export
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.name = o.name
OUT.parent.mkdir(parents=True, exist_ok=True)
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, max(1, int(img.size[1] * 1024 / img.size[0])))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_apply=True, export_yup=True,
                          export_image_format='JPEG', export_jpeg_quality=86, export_lights=False)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print('WROTE', OUT, os.path.getsize(OUT) // 1024, 'KB', 'mesh objects', sum(1 for o in bpy.data.objects if o.type == 'MESH'), 'tris', tris)

# ------------------------------------------------------------------------------------------------ previews
if PREVIEW:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1344
    scene.render.resolution_y = 768
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.eevee.use_shadows = True
        scene.eevee.use_raytracing = True
    except AttributeError:
        pass
    world = bpy.data.worlds.new('W')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']

    def L(name, kind, loc, energy, color, size=None, rot=None, spot=None):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if size and kind == 'AREA':
            d.size = size
        if spot and kind == 'SPOT':
            d.spot_size = math.radians(spot)
            d.spot_blend = 0.6
        o = bpy.data.objects.new(name, d)
        o.location = loc
        if rot:
            o.rotation_euler = rot
        coll.objects.link(o)
        return o

    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    coll.objects.link(cam)
    scene.camera = cam

    def shoot(tag, loc, look, lens):
        cam.location = Vector(loc)
        cam.data.lens = lens
        cam.rotation_euler = (Vector(look) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{PREVIEW}_{tag}.png'
        bpy.ops.render.render(write_still=True)

    def setup(beat):
        for o in [o for o in bpy.data.objects if o.type == 'LIGHT']:
            bpy.data.objects.remove(o, do_unlink=True)
        if beat == 'monday':
            bg.inputs[0].default_value = (0.55, 0.62, 0.72, 1)
            bg.inputs[1].default_value = 0.35
            M['window_view'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 3.0
            L('window', 'AREA', (X0 + 0.3, 0, 1.75), 900, (0.8, 0.88, 1.0), size=4.0, rot=(0, math.radians(-90), 0))
            L('sun_patch', 'SUN', (0, 0, 5), 2.5, (1.0, 0.96, 0.9), rot=(math.radians(55), math.radians(-30), math.radians(-90)))
            for i, (x, y) in enumerate(((-2.2, -1.6), (2.2, -1.6), (-2.2, 1.4), (2.2, 1.4))):
                L(f'down{i}', 'SPOT', (x, y, H - 0.05), 120, (1, 0.95, 0.88), spot=90)
            M['bulb'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0
            M['sconce'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0
        else:  # friday evening
            bg.inputs[0].default_value = (0.02, 0.03, 0.06, 1)
            bg.inputs[1].default_value = 0.4
            M['window_view'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 1.4
            L('floodlight_glow', 'AREA', (X0 + 0.3, 0, 1.9), 260, (0.55, 0.7, 1.0), size=4.0, rot=(0, math.radians(-90), 0))
            L('desk_lamp', 'POINT', (0.78, DY - 0.2, TOP + 0.25), 55, (1.0, 0.72, 0.42))
            for i, x in enumerate((-1.6, 1.6)):
                L(f'sconce{i}', 'POINT', (x, Y0 + 0.2, 2.05), 30, (1.0, 0.7, 0.4))
            L('table_glow', 'AREA', (0, TY, 1.0), 18, (0.45, 0.9, 0.75), size=2.0, rot=(math.radians(180), 0, 0))
            L('tv_spill', 'AREA', (0, Y1 - 0.3, 1.7), 20, (0.6, 0.7, 1.0), size=2.0, rot=(math.radians(90), 0, 0))
            L('fill', 'AREA', (0, 0, H - 0.1), 70, (1, 0.85, 0.7), size=4.0)
            M['bulb'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 12.0
            M['sconce'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 5.0

    for beat in ('monday', 'friday'):
        setup(beat)
        shoot(f'{beat}_hub', (0.0, 3.05, 2.3), (0.0, -1.7, 0.9), 17)
        shoot(f'{beat}_corner', (3.5, 2.85, 2.15), (-0.9, -1.0, 0.9), 15)
