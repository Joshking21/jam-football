"""fal image jobs (SPEC §18.2, ART-DIRECTION). Dry run by default.

  python tools/fal/gen.py                          # list jobs from tools/fal/jobs.json
  python tools/fal/gen.py --portraits              # also add one portrait job per player (world snapshot)
  python tools/fal/gen.py --go --only images/club/ # generate (needs FAL_KEY)

Each job: {"out": "images/club/exterior.webp", "prompt": "...", "size": [1920,1080], "post": "none|halftone|grey", "seed": 7}
Output goes to public/assets/<out>. Post-processing needs Pillow (system python has it).
"""
import argparse
import io
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from common import ASSETS, ROOT, http, load_env, need_key, write_manifest  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
STYLE = ("Photographic, natural light you can name, realistic materials, muted grade, no lens flare, no teal-orange, "
         "no text, no logos, no readable signage, fictional place. ")


def portrait_jobs():
    world = json.loads((ROOT / "src/core/world/world.snapshot.json").read_text(encoding="utf-8"))
    for p in world["players"].values():
        yield {"out": f"images/portraits/{p['id']}.webp", "size": [512, 512], "post": "halftone", "seed": int(p["id"][1:]),
               "prompt": (f"Head-and-shoulders portrait of a {p['age']}-year-old male professional footballer from {p['nationality']}, "
                          "plain training top, neutral expression, plain light background, soft daylight from the left, "
                          "ordinary face, not a model, matchday programme photo")}


def post(img_bytes, mode, size):
    from PIL import Image, ImageOps, ImageDraw
    im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    im = ImageOps.fit(im, tuple(size))
    if mode in ("grey", "halftone"):
        g = ImageOps.autocontrast(im.convert("L"))
        if mode == "grey":
            return g
        # black dots on white, 45-degree screen feel via offset rows (SPEC §18.5)
        cell = max(4, size[0] // 110)
        out = Image.new("L", g.size, 255)
        d = ImageDraw.Draw(out)
        for y in range(0, g.height, cell):
            off = cell // 2 if (y // cell) % 2 else 0
            for x in range(off, g.width, cell):
                v = g.getpixel((min(x, g.width - 1), min(y, g.height - 1)))
                r = (1 - v / 255) * cell * 0.62
                if r > 0.3:
                    d.ellipse([x - r, y - r, x + r, y + r], fill=0)
        return out
    return im


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--only", nargs="*", help="output path prefixes")
    ap.add_argument("--portraits", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--model", default="fal-ai/flux/dev")
    a = ap.parse_args()
    jobs = json.loads((HERE / "jobs.json").read_text(encoding="utf-8"))["jobs"]
    if a.portraits:
        jobs += list(portrait_jobs())
    if a.only:
        jobs = [j for j in jobs if any(j["out"].startswith(p) for p in a.only)]
    print(f"{len(jobs)} image jobs")
    if not a.go:
        for j in jobs[:40]:
            print(f"  {j['out']:44s} {j['size']}  {j['prompt'][:60]}")
        raise SystemExit
    key = need_key(load_env(), "FAL_KEY")
    n = 0
    for j in jobs:
        dest = ASSETS / j["out"]
        if dest.exists():
            continue
        w, h = j["size"]
        body = {"prompt": STYLE + j["prompt"], "image_size": {"width": w, "height": h}, "num_images": 1, "seed": j.get("seed", 1),
                "enable_safety_checker": True}
        status, data = http("POST", f"https://fal.run/{j.get('model', a.model)}", {"Authorization": f"Key {key}"}, body, timeout=300)
        if status != 200:
            raise SystemExit(f"fal error {status} on {j['out']}: {data[:200]!r}")
        url = json.loads(data)["images"][0]["url"]
        import urllib.request
        raw = urllib.request.urlopen(url, timeout=300).read()
        img = post(raw, j.get("post", "none"), j["size"])
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, "WEBP", quality=82)
        print(f"  {j['out']}")
        n += 1
        if a.limit and n >= a.limit:
            break
    print(f"generated {n}; manifest now {write_manifest()} files")
