"""Generates the office's image textures (system Python + Pillow). Each tiling texture covers 1 m x 1 m, so the
Blender build can cube-project UVs at 1 unit = 1 m. Output: tools/blender/office_tex/*.png (gitignored is fine;
the build embeds them in office.glb as JPEG).

  python tools/blender/office_textures.py
"""
import math
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path(__file__).resolve().parent / "office_tex"
OUT.mkdir(exist_ok=True)
R = random.Random(11)


def noise(size, amp, seed, blur=1.0):
    r = random.Random(seed)
    im = Image.new("L", (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            px[x, y] = 128 + int(r.uniform(-amp, amp))
    return im.filter(ImageFilter.GaussianBlur(blur))


def tint(base_rgb, n, k=0.35):
    """Multiply a flat colour by a noise layer (128 = no change)."""
    w, h = n.size
    im = Image.new("RGB", (w, h))
    src = n.load()
    dst = im.load()
    for y in range(h):
        for x in range(w):
            f = 1 + (src[x, y] - 128) / 128 * k
            dst[x, y] = tuple(max(0, min(255, int(c * f))) for c in base_rgb)
    return im


def brick(size=1024):
    """Old red brick, stretcher bond. Tile = 4 bricks (0.9 m) x 13 courses (~0.98 m) -> scaled to 1 m."""
    im = Image.new("RGB", (size, size), (150, 140, 128))
    d = ImageDraw.Draw(im)
    cols, rows = 4, 13
    bw, bh = size / cols, size / rows
    mortar = max(3, int(size * 0.009))
    for r in range(rows):
        off = (bw / 2) if r % 2 else 0
        for c in range(-1, cols + 1):
            x0 = c * bw + off + mortar / 2
            y0 = r * bh + mortar / 2
            base = R.choice([(132, 58, 40), (118, 50, 36), (146, 68, 46), (104, 46, 34), (126, 64, 48), (140, 54, 38)])
            j = R.uniform(-12, 12)
            col = tuple(int(max(0, min(255, v + j))) for v in base)
            d.rectangle([x0, y0, x0 + bw - mortar, y0 + bh - mortar], fill=col)
    n = noise(size, 34, 3, 0.8)
    im = Image.blend(im, tint((128, 128, 128), n, 0.9).convert("RGB"), 0.0)
    # Grain and soot.
    px = im.load()
    npx = n.load()
    for y in range(size):
        soot = 1 - 0.10 * (y / size)  # a little darker toward the top
        for x in range(size):
            f = (1 + (npx[x, y] - 128) / 128 * 0.22) * soot
            r_, g_, b_ = px[x, y]
            px[x, y] = (int(min(255, r_ * f)), int(min(255, g_ * f)), int(min(255, b_ * f)))
    return im.filter(ImageFilter.GaussianBlur(0.6))


def planks(size=1024):
    """Oak floorboards: 7 boards across 1 m, random butt joints, grain lines."""
    im = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(im)
    n = 7
    pw = size / n
    for i in range(n):
        x0 = int(i * pw)
        y = -R.uniform(0, size)
        while y < size:
            L = R.uniform(0.35, 0.8) * size
            base = R.choice([(124, 86, 52), (112, 76, 44), (134, 94, 58), (118, 82, 50)])
            d.rectangle([x0, int(y), int(x0 + pw), int(y + L)], fill=base)
            # grain
            for g in range(14):
                gx = x0 + R.uniform(3, pw - 3)
                shade = R.uniform(-22, 10)
                col = tuple(int(max(0, min(255, v + shade))) for v in base)
                pts = []
                for t in range(0, int(L), 18):
                    pts.append((gx + 3 * math.sin((t + g * 37) / 60.0), y + t))
                if len(pts) > 1:
                    d.line(pts, fill=col, width=1)
            d.line([(x0, int(y)), (x0 + pw, int(y))], fill=(60, 40, 24), width=2)
            y += L
        d.line([(x0, 0), (x0, size)], fill=(58, 38, 22), width=3)
    return im.filter(ImageFilter.GaussianBlur(0.7))


def plaster(size=512, rgb=(176, 168, 156)):
    return tint(rgb, noise(size, 26, 5, 2.2), 0.12)


def dark_oak(size=512):
    """Desk/cabinet wood: dark, long grain along X."""
    im = Image.new("RGB", (size, size), (54, 32, 18))
    d = ImageDraw.Draw(im)
    for g in range(160):
        y = R.uniform(0, size)
        shade = R.uniform(-14, 18)
        col = tuple(int(max(0, min(255, v + shade))) for v in (54, 32, 18))
        pts = [(x, y + 4 * math.sin((x + g * 23) / 47.0)) for x in range(0, size + 16, 16)]
        d.line(pts, fill=col, width=R.choice([1, 1, 2]))
    return im.filter(ImageFilter.GaussianBlur(0.8))


def leather(size=512, rgb=(78, 24, 22)):
    return tint(rgb, noise(size, 40, 9, 1.4), 0.25)


def rug(size=1024):
    """Worn Persian-style rug: faded red field, dark border, a medallion; no text."""
    im = Image.new("RGB", (size, size), (120, 32, 28))
    d = ImageDraw.Draw(im)
    b = int(size * 0.09)
    d.rectangle([0, 0, size, size], fill=(46, 22, 26))
    d.rectangle([b, b, size - b, size - b], fill=(128, 36, 30))
    d.rectangle([b + 14, b + 14, size - b - 14, size - b - 14], outline=(190, 150, 90), width=6)
    for i in range(0, size, 36):  # border motif
        for (x, y) in ((i, b // 2), (i, size - b // 2), (b // 2, i), (size - b // 2, i)):
            d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(170, 120, 70))
    c = size // 2
    for rr, col in ((260, (40, 28, 46)), (200, (170, 120, 70)), (150, (120, 36, 30)), (70, (40, 28, 46))):
        d.polygon([(c, c - rr), (c + rr, c), (c, c + rr), (c - rr, c)], fill=col)
    im = Image.blend(im, Image.new("RGB", im.size, (150, 120, 100)), 0.18)  # faded
    wear = noise(size, 60, 13, 6)
    return Image.composite(im, Image.blend(im, Image.new("RGB", im.size, (170, 140, 120)), 0.3), wear.point(lambda v: 255 if v > 120 else 0)).filter(ImageFilter.GaussianBlur(0.8))


def cork(size=512):
    im = tint((170, 120, 72), noise(size, 70, 17, 0.6), 0.35)
    px = im.load()
    for _ in range(size * 6):
        x, y = R.randrange(size), R.randrange(size)
        v = R.choice([-50, 40])
        r_, g_, b_ = px[x, y]
        px[x, y] = (max(0, min(255, r_ + v)), max(0, min(255, g_ + v)), max(0, min(255, b_ + v)))
    return im


def newspaper(w=768, h=1024):
    """Back page of the local paper: masthead bar, photo block, columns of grey lines (no readable text).
    The game draws the real headline on this surface; this is the fallback."""
    im = Image.new("RGB", (w, h), (226, 220, 204))
    d = ImageDraw.Draw(im)
    d.rectangle([30, 26, w - 30, 92], fill=(40, 38, 36))
    d.rectangle([30, 112, w - 30, 178], fill=(70, 68, 64))  # headline block
    d.rectangle([30, 200, w * 0.62, 470], fill=(120, 116, 108))  # photo
    for col in range(3):
        x0 = 30 + col * ((w - 60) / 3)
        y = 500 if col < 2 else 200
        while y < h - 40:
            ln = R.uniform(0.7, 1.0) * ((w - 60) / 3 - 20)
            d.line([(x0, y), (x0 + ln, y)], fill=(130, 126, 118), width=5)
            y += 14 if R.random() > 0.08 else 30
    return im.filter(ImageFilter.GaussianBlur(0.5))


def clock_face(size=512):
    im = Image.new("RGB", (size, size), (238, 234, 224))
    d = ImageDraw.Draw(im)
    c = size / 2
    d.ellipse([6, 6, size - 6, size - 6], outline=(30, 30, 30), width=10)
    for i in range(60):
        a = i / 60 * 2 * math.pi
        r0 = c * (0.78 if i % 5 == 0 else 0.86)
        d.line([(c + r0 * math.sin(a), c - r0 * math.cos(a)), (c + c * 0.92 * math.sin(a), c - c * 0.92 * math.cos(a))],
               fill=(30, 30, 30), width=12 if i % 5 == 0 else 4)
    return im


def team_photo(w=768, h=512):
    """A faded team photograph: two rows of figures, sepia, vignette. Shapes only, no faces in focus."""
    im = Image.new("RGB", (w, h), (176, 156, 120))
    d = ImageDraw.Draw(im)
    d.rectangle([0, h * 0.62, w, h], fill=(120, 110, 80))  # grass
    for row, (y, n, s) in enumerate(((h * 0.52, 9, 1.0), (h * 0.70, 8, 1.08))):
        for i in range(n):
            x = w * (0.1 + 0.8 * (i + (0.5 if row else 0)) / n)
            sh = (88, 62, 44) if row else (98, 70, 50)
            d.rectangle([x - 22 * s, y - 70 * s, x + 22 * s, y + 10 * s], fill=sh)
            d.ellipse([x - 14 * s, y - 104 * s, x + 14 * s, y - 72 * s], fill=(150, 120, 90))
    im = im.filter(ImageFilter.GaussianBlur(2.2))
    vig = Image.new("L", (w, h), 0)
    ImageDraw.Draw(vig).ellipse([-w * 0.2, -h * 0.25, w * 1.2, h * 1.25], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(60))
    return Image.composite(im, Image.new("RGB", (w, h), (70, 56, 40)), vig)


def tactics_fallback(w=1024, h=640):
    """The tactics table screen when the game isn't drawing on it: a dim pitch."""
    im = Image.new("RGB", (w, h), (18, 52, 40))
    d = ImageDraw.Draw(im)
    m = 30
    line = (120, 190, 160)
    d.rectangle([m, m, w - m, h - m], outline=line, width=4)
    d.line([(w / 2, m), (w / 2, h - m)], fill=line, width=4)
    d.ellipse([w / 2 - 80, h / 2 - 80, w / 2 + 80, h / 2 + 80], outline=line, width=4)
    for x in (m, w - m - 150):
        d.rectangle([x, h / 2 - 160, x + 150, h / 2 + 160], outline=line, width=4)
    return im


def tv_fallback(w=1024, h=576):
    im = Image.new("RGB", (w, h), (10, 12, 16))
    return im


def window_night(w=1600, h=900):
    """Placeholder view until the fal window image exists: dark stand, floodlit pitch, mist."""
    im = Image.new("RGB", (w, h), (12, 16, 26))
    d = ImageDraw.Draw(im)
    d.polygon([(0, h * 0.55), (w, h * 0.5), (w, h), (0, h)], fill=(40, 86, 44))
    for i in range(0, w, 90):
        d.line([(i, h * 0.55), (i + 60, h)], fill=(48, 98, 52), width=40)
    d.rectangle([0, h * 0.30, w, h * 0.5], fill=(34, 30, 34))
    for x in (w * 0.15, w * 0.85):
        d.ellipse([x - 40, h * 0.12 - 20, x + 40, h * 0.12 + 20], fill=(255, 250, 230))
    return im.filter(ImageFilter.GaussianBlur(3))


# ------------------------------------------------------------------------------------------------ detail pass
def to_normal(height, strength=2.0):
    """Height (L) -> tangent-space normal map (RGB), wrapping at the edges so tiles stay seamless."""
    h = height.convert("L")
    w, hh = h.size
    px = h.load()
    out = Image.new("RGB", (w, hh))
    op = out.load()
    for y in range(hh):
        for x in range(w):
            dx = (px[(x + 1) % w, y] - px[(x - 1) % w, y]) / 255.0 * strength
            dy = (px[x, (y + 1) % hh] - px[x, (y - 1) % hh]) / 255.0 * strength
            nx, ny, nz = -dx, dy, 1.0
            l = math.sqrt(nx * nx + ny * ny + nz * nz)
            op[x, y] = (int((nx / l * 0.5 + 0.5) * 255), int((ny / l * 0.5 + 0.5) * 255), int((nz / l * 0.5 + 0.5) * 255))
    return out


def brick_height(size=512):
    im = Image.new("L", (size, size), 70)  # mortar low
    d = ImageDraw.Draw(im)
    cols, rows = 4, 13
    bw, bh = size / cols, size / rows
    m = max(2, int(size * 0.009))
    for r in range(rows):
        off = (bw / 2) if r % 2 else 0
        for c in range(-1, cols + 1):
            x0 = c * bw + off + m / 2
            y0 = r * bh + m / 2
            d.rounded_rectangle([x0, y0, x0 + bw - m, y0 + bh - m], radius=2, fill=200 + R.randint(-15, 15))
    n = noise(size, 30, 41, 0.7)
    return Image.blend(im, n, 0.22).filter(ImageFilter.GaussianBlur(0.8))


def planks_height(size=512):
    im = Image.new("L", (size, size), 180)
    d = ImageDraw.Draw(im)
    n = 7
    pw = size / n
    for i in range(n):
        x0 = i * pw
        d.line([(x0, 0), (x0, size)], fill=60, width=2)
        y = R.uniform(0, size)
        while y < size * 2:
            d.line([(x0, y % size), (x0 + pw, y % size)], fill=80, width=2)
            y += R.uniform(0.35, 0.8) * size
        for g in range(10):
            gx = x0 + R.uniform(2, pw - 2)
            d.line([(gx + 2 * math.sin(t / 40.0 + g), t) for t in range(0, size + 8, 8)], fill=160, width=1)
    return im.filter(ImageFilter.GaussianBlur(0.6))


def leather_height(size=512):
    n = noise(size, 50, 51, 1.2)
    d = ImageDraw.Draw(n)
    for _ in range(40):  # creases
        x, y = R.uniform(0, size), R.uniform(0, size)
        a = R.uniform(0, math.pi)
        L = R.uniform(20, 90)
        d.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=60, width=2)
    return n.filter(ImageFilter.GaussianBlur(0.8))


def cloth_folds_height(size=512):
    """Hanging cloth: soft vertical folds with a few diagonal pulls from the hanger."""
    im = Image.new("L", (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            v = 0.0
            for k, (f, ph) in enumerate(((5.0, 0.3), (9.0, 1.7), (14.0, 4.1))):
                v += math.sin(x / size * 2 * math.pi * f + ph + 0.8 * math.sin(y / size * 2 * math.pi)) / (k + 1)
            v += 0.5 * math.sin((x + y * 0.6) / size * 2 * math.pi * 7)
            px[x, y] = int(128 + 50 * v / 2.2)
    return im.filter(ImageFilter.GaussianBlur(2.0))


def wool_height(size=512):
    return Image.blend(noise(size, 60, 61, 0.9), cloth_folds_height(size), 0.5)


def rug_height(size=512):
    return noise(size, 80, 71, 0.5)


def plaster_height(size=512):
    return noise(size, 40, 81, 3.0)


def dark_oak_worn(size=512):
    """dark_oak plus mug rings and scratches."""
    im = dark_oak(size)
    d = ImageDraw.Draw(im, "RGBA")
    for _ in range(5):
        x, y, r = R.uniform(40, size - 40), R.uniform(40, size - 40), R.uniform(20, 28)
        d.ellipse([x - r, y - r, x + r, y + r], outline=(20, 10, 4, 120), width=3)
        d.ellipse([x - r + 3, y - r + 3, x + r - 3, y + r - 3], outline=(80, 52, 30, 50), width=2)
    for _ in range(70):
        x, y = R.uniform(0, size), R.uniform(0, size)
        a = R.uniform(-0.4, 0.4)
        L = R.uniform(10, 60)
        d.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=(110, 80, 56, 70), width=1)
    return im


def rug_worn(size=1024):
    """rug with a worn path from the door to the desk chair."""
    im = rug(size)
    wear = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(wear)
    d.ellipse([size * 0.25, size * 0.55, size * 0.95, size * 1.1], fill=170)
    wear = wear.filter(ImageFilter.GaussianBlur(70))
    pale = Image.blend(im, Image.new("RGB", im.size, (176, 150, 128)), 0.45)
    return Image.composite(pale, im, wear)


def spines(cols=16, w=1024, h=512):
    """Binder and book spines, one per column (the last column is page edges). Bands, gilt lines, label patches,
    finger holes; no readable text."""
    im = Image.new("RGB", (w, h), (40, 40, 40))
    d = ImageDraw.Draw(im)
    cw = w / cols
    palette = [(28, 46, 92), (118, 26, 22), (190, 160, 90), (36, 74, 42), (150, 150, 146), (40, 40, 44), (96, 60, 34),
               (24, 70, 96), (140, 48, 40), (70, 30, 54), (180, 120, 40), (60, 90, 70), (210, 200, 180), (30, 30, 70),
               (120, 100, 70)]
    for c in range(cols - 1):
        x0, x1 = int(c * cw), int((c + 1) * cw)
        base = palette[c % len(palette)]
        d.rectangle([x0, 0, x1, h], fill=base)
        dark = tuple(max(0, v - 35) for v in base)
        light = tuple(min(255, v + 30) for v in base)
        d.line([(x0 + 2, 0), (x0 + 2, h)], fill=light, width=2)
        d.line([(x1 - 3, 0), (x1 - 3, h)], fill=dark, width=3)
        style = c % 3
        if style == 0:  # ring binder: label window and finger hole
            d.rectangle([x0 + cw * 0.18, h * 0.12, x1 - cw * 0.18, h * 0.42], fill=(226, 220, 200))
            for k in range(4):
                yy = h * 0.17 + k * h * 0.06
                d.line([(x0 + cw * 0.26, yy), (x1 - cw * 0.3, yy)], fill=(120, 116, 106), width=3)
            r = cw * 0.18
            cx, cy = (x0 + x1) / 2, h * 0.78
            d.ellipse([cx - r, cy - r * 1.6, cx + r, cy + r * 1.6], fill=dark)
        elif style == 1:  # cloth book: gilt bands
            for yy in (h * 0.08, h * 0.12, h * 0.86, h * 0.9):
                d.rectangle([x0 + 3, yy, x1 - 4, yy + 5], fill=(196, 160, 80))
            d.rectangle([x0 + cw * 0.2, h * 0.25, x1 - cw * 0.22, h * 0.32], fill=(196, 160, 80))
            d.rectangle([x0 + cw * 0.2, h * 0.36, x1 - cw * 0.22, h * 0.39], fill=(170, 140, 72))
        else:  # programme box: two-tone with a stripe
            d.rectangle([x0, h * 0.62, x1, h], fill=dark)
            d.rectangle([x0, h * 0.58, x1, h * 0.62], fill=(230, 226, 214))
            d.rectangle([x0 + cw * 0.25, h * 0.1, x1 - cw * 0.25, h * 0.45], fill=light)
    x0 = int((cols - 1) * cw)
    d.rectangle([x0, 0, w, h], fill=(226, 218, 196))
    for yy in range(0, h, 3):
        d.line([(x0, yy), (w, yy)], fill=(206, 198, 176) if yy % 6 else (236, 230, 210), width=1)
    n = noise(256, 30, 91, 0.6).resize((w, h))
    return Image.blend(im, Image.merge("RGB", (n, n, n)), 0.08)


if __name__ == "__main__":
    jobs = {
        "brick": brick, "planks": planks, "plaster": plaster, "dark_oak": dark_oak, "leather_oxblood": leather,
        "rug": rug, "cork": cork, "newspaper": newspaper, "clock_face": clock_face, "team_photo": team_photo,
        "tactics_fallback": tactics_fallback, "tv_fallback": tv_fallback, "window_night": window_night,
        "plaster_warm": lambda: plaster(512, (168, 154, 138)),
        "leather_brown": lambda: leather(512, (96, 52, 28)),
        # detail pass
        "dark_oak_worn": dark_oak_worn, "rug_worn": rug_worn, "spines": spines,
        "n_brick": lambda: to_normal(brick_height(), 3.0), "n_planks": lambda: to_normal(planks_height(), 2.5),
        "n_leather": lambda: to_normal(leather_height(), 2.0), "n_cloth": lambda: to_normal(cloth_folds_height(), 3.5),
        "n_wool": lambda: to_normal(wool_height(), 3.0), "n_rug": lambda: to_normal(rug_height(), 1.5),
        "n_plaster": lambda: to_normal(plaster_height(), 1.2),
    }
    import sys
    only = sys.argv[1:]
    for name, fn in jobs.items():
        if only and name not in only:
            continue
        fn().save(OUT / f"{name}.png")
        print("  ", name)
