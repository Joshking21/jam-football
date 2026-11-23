"""Shared helpers for Claude's asset tools. Standard library only (plus Pillow where noted).

Keys come from .env.local at the repo root and are never printed or written anywhere else.
"""
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
CONTENT = ROOT / "src" / "content"


def load_env() -> dict:
    env = {}
    path = ROOT / ".env.local"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("ELEVENLABS_API_KEY", "FAL_KEY", "MESHY_API_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


def need_key(env: dict, name: str) -> str:
    key = env.get(name)
    if not key:
        raise SystemExit(f"{name} is missing. Add it to .env.local (never commit that file).")
    return key


def http(method: str, url: str, headers: dict, body=None, timeout=120, retries=3):
    """Returns (status, bytes). JSON bodies are encoded automatically. Retries on 429/5xx."""
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers = {**headers, "Content-Type": "application/json"}
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < retries - 1:
                time.sleep(4 * (attempt + 1))
                continue
            return e.code, e.read()
    return 0, b""


def download(url: str, dest: pathlib.Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r:
        dest.write_bytes(r.read())


def write_manifest() -> int:
    """Regenerates public/asset-manifest.json from public/assets (SPEC §18.1): {version, files: {path: {bytes}}}."""
    files = {}
    if ASSETS.exists():
        for p in sorted(ASSETS.rglob("*")):
            if p.is_file() and not p.name.startswith("."):
                files[p.relative_to(ASSETS).as_posix()] = {"bytes": p.stat().st_size}
    out = ROOT / "public" / "asset-manifest.json"
    out.write_text(json.dumps({"version": 1, "files": files}, indent=2) + "\n", encoding="utf-8")
    return len(files)
