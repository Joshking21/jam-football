"""Regenerate public/asset-manifest.json from public/assets (SPEC §18.1). Run after adding or removing assets.

  python tools/manifest.py
"""
from common import write_manifest

if __name__ == "__main__":
    print(f"asset-manifest.json: {write_manifest()} files")
