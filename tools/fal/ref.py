"""One-off reference images for Meshy image-to-3D tests (AI-TESTS). Output: tests-ai/<id>/ (gitignored).

  python tools/fal/ref.py coach-base            # dry run: shows the prompt and cost estimate
  python tools/fal/ref.py coach-base --go       # generate (needs FAL_KEY)
"""
import argparse
import json
import pathlib
import shutil
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from common import ROOT, http, load_env, need_key  # noqa: E402

# Meshy wants: one subject, whole body in frame, front view, limbs clear of the body,
# plain background, flat even light (shadows get baked into the texture otherwise).
MESHY_REF = ("Full-body character reference photo for 3D modelling. Front view, facing the camera, "
             "entire body in frame from the top of the head to the shoes with a margin all round. "
             "Standing straight in a relaxed A-pose, arms held slightly away from the body, palms facing the thighs, "
             "feet shoulder-width apart. Plain light grey seamless studio background, soft even front lighting, "
             "no harsh shadows, no props, no text, no logos. Photographic, realistic adult proportions. ")

REFS = {
    "coach-base": {
        "dir": "C1-coach-base",
        "size": [768, 1344],
        "seeds": [21, 22, 23],
        "prompt": MESHY_REF + (
            "A 45-year-old male football manager. Shaved head, completely bald, clean-shaven, no glasses. "
            "Ordinary, lived-in face, calm neutral expression, not a model. Average build. "
            "Wearing a plain dark navy two-piece suit with a single-breasted jacket buttoned, crisp white shirt, "
            "a solid bright green tie in one flat colour with no pattern, plain black leather shoes. "
            "No badge, no pocket square, no watch."
        ),
    },
    # Mood image for the office: not a Meshy reference, a look-and-light target for the room build.
    "office-mood": {
        "dir": "C2-office-mood",
        "size": [1344, 768],
        "seeds": [31, 32, 33],
        "prompt": (
            "Photograph of a football manager's office inside the old brick main stand of a small lower-league club "
            "in a British harbour town, Friday evening. A large window behind the desk looks down onto the empty "
            "floodlit pitch, floodlights on, light mist. Worn dark oak desk with drawers, an old leather swivel chair, "
            "a green banker's lamp casting warm light, a desk phone with a cord, scattered match reports and a "
            "clipboard. A whiteboard on the side wall with magnets, a small wall-mounted TV switched off, a plain "
            "visitor chair, a filing cabinet, a shelf of ring binders, a framed faded team photograph, a coat stand "
            "with a club scarf. Painted brick and plaster walls, an old radiator, half-open blinds, a worn rug. "
            "Lived-in, modest, a little cluttered, not corporate. Warm lamp light against the cool blue floodlight "
            "glow from the window. Eye level, wide view of the room, natural photographic look, muted grade. "
            "No people, no text, no logos, no readable signs."
        ),
    },
    # s32's layout, modernised: image-to-image keeps the composition (desk centred under the window).
    "office-modern": {
        "dir": "C3-office-modern",
        "size": [1344, 768],
        "seeds": [41, 42, 43],
        "init_image": "tests-ai/C2-office-mood/office-mood_s32.png",
        "strength": 0.82,
        "model": "fal-ai/flux/dev/image-to-image",
        "prompt": (
            "Photograph of a modern football manager's office in a recently renovated stadium main stand, evening. "
            "A wide window behind the desk looks down onto the floodlit pitch. A clean modern desk in pale oak and "
            "matte black steel sits centred in front of the window facing the room, with two slim monitors showing "
            "match data charts and heat maps, a tablet, a wireless keyboard, a slim desk lamp, a coffee cup. "
            "An ergonomic black mesh office chair. On the side wall a large wall-mounted touchscreen showing a "
            "tactics board with player dots, and a big flat display showing paused match footage. Smooth plaster walls "
            "in warm grey with one wall of exposed old brick, acoustic wood slat panel, recessed LED ceiling lights, "
            "a low sideboard with a small trophy, a framed club photograph, a plant. Tidy, focused, high-tech but "
            "warm, a club that invests in analysis. Cool screen glow and blue floodlight against warm interior "
            "light. Eye level, natural photographic look, muted grade. No people, no text, no logos, no readable words."
        ),
    },
    # Agreed layout (tools/blender/office_blockout.py), painted by image-to-image.
    "office-paint-hub": {
        "dir": "C5-office-paint",
        "size": [1344, 768],
        "seeds": [51, 52],
        "init_image": "tests-ai/C4-office-blockout/blockout_hub.png",
        "strength": 0.78,
        "model": "fal-ai/flux/dev/image-to-image",
        "prompt": (
    "Photograph of a football manager's office inside the main stand of a small lower-league club in a British "
    "harbour town, Friday evening. Traditional and lived-in: a large worn dark oak desk with drawers, covered in "
    "scattered card folders and match reports, coffee mugs, a green banker's lamp casting warm light, a corded desk "
    "phone with a small red light, a folded local newspaper, a sealed letter, and a tabby cat asleep on a pile of "
    "folders. A worn dark leather swivel chair behind the desk, a leather and wood guest chair across from it. "
    "In front of the desk a large modern touchscreen table glowing soft green with a tactics board and glowing "
    "player dots, the one piece of new technology in the room. A big window on one side looks onto the floodlit "
    "pitch, floodlights on, light mist. Old brick wall behind the desk with a framed red playing shirt and a faded "
    "team photograph, shelves of ring binders, a small radio, a coat stand with a scarf, a glass trophy cabinet that "
    "is nearly empty, a cork board of fixtures with coloured result stickers by the door, a wall clock, a bucket "
    "under a damp stain in the corner, a worn red rug, wooden floor. Warm lamp light against cool blue floodlight "
    "from the window and green glow from the table. Natural photographic look, muted grade, realistic materials. "
    "No people, no text, no logos, no readable words."
),
    },
    "office-paint-corner": {
        "dir": "C5-office-paint",
        "size": [1344, 768],
        "seeds": [53, 54],
        "init_image": "tests-ai/C4-office-blockout/blockout_corner.png",
        "strength": 0.78,
        "model": "fal-ai/flux/dev/image-to-image",
        "prompt": (
    "Photograph of a football manager's office inside the main stand of a small lower-league club in a British "
    "harbour town, Friday evening. Traditional and lived-in: a large worn dark oak desk with drawers, covered in "
    "scattered card folders and match reports, coffee mugs, a green banker's lamp casting warm light, a corded desk "
    "phone with a small red light, a folded local newspaper, a sealed letter, and a tabby cat asleep on a pile of "
    "folders. A worn dark leather swivel chair behind the desk, a leather and wood guest chair across from it. "
    "In front of the desk a large modern touchscreen table glowing soft green with a tactics board and glowing "
    "player dots, the one piece of new technology in the room. A big window on one side looks onto the floodlit "
    "pitch, floodlights on, light mist. Old brick wall behind the desk with a framed red playing shirt and a faded "
    "team photograph, shelves of ring binders, a small radio, a coat stand with a scarf, a glass trophy cabinet that "
    "is nearly empty, a cork board of fixtures with coloured result stickers by the door, a wall clock, a bucket "
    "under a damp stain in the corner, a worn red rug, wooden floor. Warm lamp light against cool blue floodlight "
    "from the window and green glow from the table. Natural photographic look, muted grade, realistic materials. "
    "No people, no text, no logos, no readable words."
),
    },
    # The combined office (the user, 27 Nov): s52's layout and window, s51's furniture, s54's shirts and trophies.
    "office-final": {
        "dir": "C6-office-final",
        "size": [1344, 768],
        "seeds": [61, 62],
        "init_image": "tests-ai/C5-office-paint/office-paint-hub_s52.png",
        "strength": 0.66,
        "model": "fal-ai/flux/dev/image-to-image",
        "prompt": (
            "Photograph of a football manager's office in the old main stand of a small lower-league club, evening. "
            "Exposed red brick back wall. In the middle a large worn dark oak pedestal desk with brass-handled "
            "drawers, piled with scattered card folders and match reports, coffee mugs, a green banker's lamp glowing "
            "warm, a corded phone, and a tabby cat asleep on the folders. Behind the desk a deep buttoned oxblood "
            "leather wingback chair. In the foreground a large glowing green touchscreen tactics table with player "
            "magnets. On the left the office door. On the right a big window looking out at the dark stadium at "
            "night with the floodlights on over the pitch. Against the back wall a tall wooden display unit of "
            "cubbies with old match shirts hung inside and a few trophies standing casually on the top and on the "
            "floor beside it, relaxed rather than showy, a framed red shirt and a wall clock. Wooden floor, worn "
            "red rug. Warm lamp light and soft wall lights against the cool floodlight glow from the window, gentle "
            "shadows. Natural photographic look, muted grade. No people, no text, no logos, no readable words."
        ),
    },
    # The office window (docs/design/office): what the coach sees outside, by time of day.
    "window-night": {
        "dir": "C8-window",
        "size": [1536, 768],
        "seeds": [71],
        "prompt": "View from a first-floor office window high in the main stand of a small lower-league football ground in a British harbour town, looking down across the whole pitch to the far stand. " + (
            "Friday night, the floodlights on over an empty pitch, light mist in the beams, fresh mowing stripes, "
            "rows of empty seats in the far stand, harbour cranes and a few town lights beyond the roof. Calm, quiet, "
            "atmospheric. Photographic, natural colour, no people, no text, no logos, no advertising, no readable signs."
        ),
    },
    "window-day": {
        "dir": "C8-window",
        "size": [1536, 768],
        "seeds": [72],
        "prompt": "View from a first-floor office window high in the main stand of a small lower-league football ground in a British harbour town, looking down across the whole pitch to the far stand. " + (
            "Monday morning, soft overcast daylight, a groundsman on a ride-on mower cutting stripes into the pitch, "
            "empty stands, wet grass, gulls, harbour cranes and terraced rooftops beyond the far stand. Quiet working "
            "morning. Photographic, natural colour, no text, no logos, no advertising, no readable signs."
        ),
    },
}

PRICE_PER_IMAGE = 0.025  # fal flux/dev, ~1 megapixel (check the dashboard after)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("ref", choices=sorted(REFS))
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--model", default="fal-ai/flux/dev")
    a = ap.parse_args()
    r = REFS[a.ref]
    out = ROOT / "tests-ai" / r["dir"]
    print(f"{a.ref}: {len(r['seeds'])} images, ~${PRICE_PER_IMAGE * len(r['seeds']):.2f}, model {a.model}")
    print(r["prompt"])
    if not a.go:
        raise SystemExit
    key = need_key(load_env(), "FAL_KEY")
    out.mkdir(parents=True, exist_ok=True)
    w, h = r["size"]
    downloads = pathlib.Path.home() / "Downloads"
    model = r.get("model", a.model)
    init = None
    if r.get("init_image"):
        import base64
        init = "data:image/png;base64," + base64.b64encode((ROOT / r["init_image"]).read_bytes()).decode()
    for seed in r["seeds"]:
        body = {"prompt": r["prompt"], "image_size": {"width": w, "height": h}, "num_images": 1, "seed": seed,
                "num_inference_steps": 32, "guidance_scale": 3.5, "enable_safety_checker": True}
        if init:
            body["image_url"] = init
            body["strength"] = r.get("strength", 0.8)
        status, data = http("POST", f"https://fal.run/{model}", {"Authorization": f"Key {key}"}, body, timeout=300)
        if status != 200:
            raise SystemExit(f"fal error {status}: {data[:300]!r}")
        url = json.loads(data)["images"][0]["url"]
        dest = out / f"{a.ref}_s{seed}.png"
        dest.write_bytes(urllib.request.urlopen(url, timeout=300).read())
        shutil.copy(dest, downloads / f"touchline-{a.ref}_s{seed}.png")
        print(f"  {dest.relative_to(ROOT)}")
