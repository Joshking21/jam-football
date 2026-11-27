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
    for seed in r["seeds"]:
        body = {"prompt": r["prompt"], "image_size": {"width": w, "height": h}, "num_images": 1, "seed": seed,
                "num_inference_steps": 32, "guidance_scale": 3.5, "enable_safety_checker": True}
        status, data = http("POST", f"https://fal.run/{a.model}", {"Authorization": f"Key {key}"}, body, timeout=300)
        if status != 200:
            raise SystemExit(f"fal error {status}: {data[:300]!r}")
        url = json.loads(data)["images"][0]["url"]
        dest = out / f"{a.ref}_s{seed}.png"
        dest.write_bytes(urllib.request.urlopen(url, timeout=300).read())
        shutil.copy(dest, downloads / f"touchline-{a.ref}_s{seed}.png")
        print(f"  {dest.relative_to(ROOT)}")
