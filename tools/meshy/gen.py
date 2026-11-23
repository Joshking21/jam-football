"""Meshy 3D model jobs (SPEC §18.2, §18.3, §18.6; ART-DIRECTION §4). Dry run by default.

  python tools/meshy/gen.py                    # list jobs and the rough credit cost
  python tools/meshy/gen.py --go --only person # one job by name (needs MESHY_API_KEY)

Flow per job: text-to-3D (or image-to-3D) preview -> refine (PBR) -> download GLB to tools/meshy/raw/<name>.glb.
Rigging/animation for people is a separate step (--rig) once the base model is approved.
Raw downloads stay in tools/meshy/raw (gitignored); the cleaned, reduced GLB goes to public/assets/models/ by hand or
with a later optimise step (gltf-transform), then: python tools/manifest.py

NOTE: endpoints and field names follow Meshy's public API as of late 2026. Check https://docs.meshy.ai on the first
real run; everything is in the CONFIG block below.
"""
import argparse
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from common import download, http, load_env, need_key  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / "raw"
CONFIG = {
    "base": "https://api.meshy.ai/openapi",
    "text_to_3d": "/v2/text-to-3d",
    "image_to_3d": "/v1/image-to-3d",
    "rigging": "/v1/rigging",
    "animations": "/v1/animations",
    "cost": {"preview": 20, "refine": 10, "image_to_3d": 30, "rig": 5, "animation": 3},
}


def poll(key, path, task_id, every=8, max_wait=900):
    t0 = time.time()
    while time.time() - t0 < max_wait:
        st, data = http("GET", f"{CONFIG['base']}{path}/{task_id}", {"Authorization": f"Bearer {key}"})
        if st == 200:
            d = json.loads(data)
            s = d.get("status")
            if s == "SUCCEEDED":
                return d
            if s in ("FAILED", "CANCELED", "EXPIRED"):
                raise SystemExit(f"Meshy task {task_id} {s}: {d.get('task_error')}")
            print(f"    {s} {d.get('progress', '')}%")
        time.sleep(every)
    raise SystemExit(f"Meshy task {task_id} timed out")


def run(job, key):
    name = job["name"]
    if job.get("image_url"):
        st, data = http("POST", CONFIG["base"] + CONFIG["image_to_3d"], {"Authorization": f"Bearer {key}"},
                        {"image_url": job["image_url"], "enable_pbr": True, "should_remesh": True, "target_polycount": job.get("tris", 10000)})
        tid = json.loads(data)["result"]
        res = poll(key, CONFIG["image_to_3d"], tid)
    else:
        st, data = http("POST", CONFIG["base"] + CONFIG["text_to_3d"], {"Authorization": f"Bearer {key}"},
                        {"mode": "preview", "prompt": job["prompt"], "art_style": "realistic", "should_remesh": True,
                         "topology": "triangle", "target_polycount": job.get("tris", 10000)})
        if st not in (200, 202):
            raise SystemExit(f"Meshy error {st}: {data[:200]!r}")
        prev = json.loads(data)["result"]
        poll(key, CONFIG["text_to_3d"], prev)
        st, data = http("POST", CONFIG["base"] + CONFIG["text_to_3d"], {"Authorization": f"Bearer {key}"},
                        {"mode": "refine", "preview_task_id": prev, "enable_pbr": True})
        res = poll(key, CONFIG["text_to_3d"], json.loads(data)["result"])
    url = res["model_urls"]["glb"]
    download(url, RAW / f"{name}.glb")
    (RAW / f"{name}.task.json").write_text(json.dumps(res, indent=2), encoding="utf-8")
    print(f"  raw/{name}.glb")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    jobs = json.loads((HERE / "jobs.json").read_text(encoding="utf-8"))["jobs"]
    if a.only:
        jobs = [j for j in jobs if j["name"] in a.only]
    c = CONFIG["cost"]
    est = sum(c["image_to_3d"] if j.get("image_url") else c["preview"] + c["refine"] for j in jobs) + sum(c["rig"] + c["animation"] * len(j.get("clips", [])) for j in jobs if j.get("rig"))
    print(f"{len(jobs)} model jobs, roughly {est} credits (estimate; check Meshy pricing)")
    for j in jobs:
        print(f"  {j['name']:18s} -> {j['out']:34s} {'RIG ' + str(len(j.get('clips', []))) + ' clips' if j.get('rig') else ''}")
    if a.go:
        key = need_key(load_env(), "MESHY_API_KEY")
        RAW.mkdir(parents=True, exist_ok=True)
        for j in jobs:
            if (RAW / f"{j['name']}.glb").exists():
                continue
            print(j["name"])
            run(j, key)
