"""ElevenLabs sound effects, room ambience and music cues (SPEC §17).

Reads tools/eleven/sfx.json: {"<relPath under public/assets/audio>": {"prompt": "...", "seconds": 2.0, "loop": false}}.
Dry run by default (lists the jobs and the total seconds). Existing files are skipped.

  python tools/eleven/sfx.py
  python tools/eleven/sfx.py --go --only crowd/ ambience/
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from common import ASSETS, http, load_env, need_key, write_manifest  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--only", nargs="*", help="path prefixes, e.g. sfx/ ambience/")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    items = json.loads((HERE / "sfx.json").read_text(encoding="utf-8"))
    items = {k: v for k, v in items.items() if not k.startswith("_")}
    todo = [(k, v) for k, v in items.items() if not a.only or any(k.startswith(p) for p in a.only)]
    print(f"{len(todo)} sounds, {sum(v.get('seconds', 0) for _, v in todo):.0f} s in total")
    if not a.go:
        for k, v in todo:
            print(f"  {k:36s} {v.get('seconds', 0):5.1f}s  {v['prompt'][:70]}")
        raise SystemExit
    key = need_key(load_env(), "ELEVENLABS_API_KEY")
    n = 0
    for rel, v in todo:
        dest = ASSETS / "audio" / rel
        if dest.exists():
            continue
        body = {"text": v["prompt"], "prompt_influence": v.get("influence", 0.5)}
        if v.get("seconds"):
            body["duration_seconds"] = v["seconds"]
        if v.get("loop"):
            body["loop"] = True
        status, data = http("POST", "https://api.elevenlabs.io/v1/sound-generation", {"xi-api-key": key, "Accept": "audio/mpeg"}, body)
        if status != 200:
            raise SystemExit(f"ElevenLabs error {status} on {rel}: {data[:200]!r}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        print(f"  {rel}")
        n += 1
        if a.limit and n >= a.limit:
            break
    print(f"generated {n}; manifest now {write_manifest()} files")
