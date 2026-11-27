"""Meshy image-to-3D (and rig) from a local reference image, for AI-TESTS. Output: tests-ai/<dir>/ (gitignored).
API per docs.meshy.ai (checked 27 Nov 2026).

  python tools/meshy/image3d.py balance
  python tools/meshy/image3d.py model tests-ai/C1-coach-base/coach-base_s21.png coach --tris 15000
  python tools/meshy/image3d.py rig coach --height 1.80          # uses the image-to-3D task saved by 'model'
"""
import argparse
import base64
import json
import pathlib
import shutil
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from common import ROOT, download, http, load_env, need_key  # noqa: E402

API = "https://api.meshy.ai/openapi/v1"


def H(key):
    return {"Authorization": f"Bearer {key}"}


def balance(key) -> int:
    st, data = http("GET", f"{API}/balance", H(key))
    if st != 200:
        raise SystemExit(f"balance error {st}: {data[:200]!r}")
    return json.loads(data)["balance"]


def poll(key, path, tid, every=10, max_wait=1500):
    t0 = time.time()
    last = None
    while time.time() - t0 < max_wait:
        st, data = http("GET", f"{API}/{path}/{tid}", H(key))
        if st == 200:
            d = json.loads(data)
            s = d.get("status")
            if s == "SUCCEEDED":
                return d
            if s in ("FAILED", "CANCELED"):
                raise SystemExit(f"Meshy {path} {tid} {s}: {d.get('task_error')}")
            if (s, d.get("progress")) != last:
                print(f"    {s} {d.get('progress', '')}%", flush=True)
                last = (s, d.get("progress"))
        time.sleep(every)
    raise SystemExit(f"Meshy {path} {tid} timed out (task keeps running; poll again later)")


def out_dir(name):
    d = ROOT / "tests-ai" / f"M-{name}"
    d.mkdir(parents=True, exist_ok=True)
    return d


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["balance", "model", "rig"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--tris", type=int, default=15000)
    ap.add_argument("--height", type=float, default=1.8)
    a = ap.parse_args()
    key = need_key(load_env(), "MESHY_API_KEY")
    before = balance(key)
    print(f"balance: {before} credits")
    if a.cmd == "balance":
        raise SystemExit

    if a.cmd == "model":
        img, name = pathlib.Path(a.args[0]), a.args[1]
        mime = "image/png" if img.suffix.lower() == ".png" else "image/jpeg"
        uri = f"data:{mime};base64," + base64.b64encode(img.read_bytes()).decode()
        body = {
            "image_url": uri,
            "ai_model": "latest",
            "should_texture": True,
            "enable_pbr": True,
            "texture_resolution": "2k",
            "pose_mode": "a-pose",
            "should_remesh": True,
            "topology": "triangle",
            "target_polycount": a.tris,
            "target_formats": ["glb"],
        }
        st, data = http("POST", f"{API}/image-to-3d", H(key), body, timeout=300)
        if st not in (200, 202):
            raise SystemExit(f"image-to-3d error {st}: {data[:300]!r}")
        tid = json.loads(data)["result"]
        d = out_dir(name)
        (d / "task_id.txt").write_text(tid)
        print(f"  task {tid}")
        res = poll(key, "image-to-3d", tid)
        (d / "model.task.json").write_text(json.dumps(res, indent=2))
        download(res["model_urls"]["glb"], d / f"{name}.glb")
        for view, url in (res.get("thumbnail_urls") or {}).items():
            if url:
                download(url, d / f"thumb_{view}.png")
        if res.get("thumbnail_url"):
            download(res["thumbnail_url"], d / "thumb.png")
        print(f"  saved {d.relative_to(ROOT)}  (consumed {res.get('consumed_credits')})")

    if a.cmd == "rig":
        name = a.args[0]
        d = out_dir(name)
        tid = (d / "task_id.txt").read_text().strip()
        body = {"input_task_id": tid, "height_meters": a.height, "skeleton_template": "mixamo"}
        st, data = http("POST", f"{API}/rigging", H(key), body, timeout=300)
        if st not in (200, 202):
            raise SystemExit(f"rigging error {st}: {data[:300]!r}")
        rid = json.loads(data)["result"]
        print(f"  rig task {rid}")
        res = poll(key, "rigging", rid)
        (d / "rig.task.json").write_text(json.dumps(res, indent=2))
        r = res["result"]
        download(r["rigged_character_glb_url"], d / f"{name}_rigged.glb")
        for k, url in (r.get("basic_animations") or {}).items():
            if url and k.endswith("_glb_url") and "armature" not in k:
                download(url, d / f"{name}_{k.replace('_glb_url', '')}.glb")
        print(f"  saved rig to {d.relative_to(ROOT)}")

    after = balance(key)
    print(f"balance: {after} credits (spent {before - after})")
    dl = pathlib.Path.home() / "Downloads"
    for p in out_dir(a.args[-1] if a.cmd == "rig" else a.args[1]).glob("thumb*.png"):
        try:
            shutil.copy(p, dl / f"touchline-meshy-{p.parent.name}-{p.name}")
        except OSError as e:  # a preview open in another app; not worth failing the run
            print(f"  (could not copy {p.name} to Downloads: {e})")
