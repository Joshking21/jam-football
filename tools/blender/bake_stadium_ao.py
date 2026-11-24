"""Bakes ambient occlusion for the procedural stadium, one value per vertex (SPEC §14.10).

Run inside Blender (headless), after `npx tsx scripts/export-stadium-geometry.ts tests-ai/bake`:

    blender -b --factory-startup -P tools/blender/bake_stadium_ao.py -- \
        tests-ai/bake/stadium.ply tests-ai/bake/stadium_meshes.json public/assets/bake

Writes <out>/stadium_ao.bin (uint8 per vertex, exporter order) and <out>/stadium_ao.json (the
mesh layout, which the game checks before applying), plus <out>/../../tests-ai/bake/preview.png is
not written: the in-game capture is the comparison. Then run `python tools/manifest.py`.

Meshes with fewer than MIN_VERTS vertices (plain boxes: roofs, walls, poles) get no AO: with only
corners to sample, per-vertex AO would smear gradients across whole faces.
"""
import json
import os
import shutil
import sys
import time

import bpy

MIN_VERTS = 200
AO_DISTANCE = 4.0  # metres: crease and under-roof shading, not whole-stand darkening
SAMPLES = 96

argv = sys.argv[sys.argv.index("--") + 1 :]
ply_path, meta_path, out_dir = argv[0], argv[1], argv[2]
os.makedirs(out_dir, exist_ok=True)
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.ply_import(filepath=os.path.abspath(ply_path), merge_verts=False)
obj = bpy.context.selected_objects[0]
mesh = obj.data
meta = json.load(open(meta_path))
assert len(mesh.vertices) == meta["totalVertices"], (len(mesh.vertices), meta["totalVertices"])

# The pitch occludes too (the bottom row of a stand is darker where it meets the ground).
bpy.ops.mesh.primitive_plane_add(size=320, location=(0, 0, -0.02))

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.world = bpy.data.worlds.new("World")
scene.world.light_settings.distance = AO_DISTANCE

if "AO" not in mesh.color_attributes:
    mesh.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
mesh.color_attributes.active_color = mesh.color_attributes["AO"]
mat = bpy.data.materials.new("Bake")
mat.use_nodes = True
mesh.materials.append(mat)

for o in scene.objects:
    o.select_set(o == obj)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", margin=0)

attr = mesh.color_attributes["AO"]
vals = bytearray(len(attr.data))
for i, d in enumerate(attr.data):
    vals[i] = int(round(max(0.0, min(1.0, d.color[0])) * 255))

# Plain boxes keep full brightness.
offset = 0
skipped = 0
for m in meta["meshes"]:
    n = m["vertices"]
    if n < MIN_VERTS:
        for i in range(offset, offset + n):
            vals[i] = 255
        skipped += 1
    offset += n

with open(os.path.join(out_dir, "stadium_ao.bin"), "wb") as f:
    f.write(bytes(vals))
shutil.copyfile(meta_path, os.path.join(out_dir, "stadium_ao.json"))
mean = sum(vals) / len(vals) / 255
print(
    f"AO baked: {len(vals)} vertices, mean {mean:.3f}, {skipped} plain meshes skipped, "
    f"{time.time() - t0:.0f}s -> {out_dir}"
)
