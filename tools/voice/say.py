"""Speak a line with Kokoro (local, free, Apache-2.0 model) and save it as a WAV.

Usage (from the repo root):
  tools/.venv/Scripts/python -I tools/voice/say.py --voice bm_george --out tests-ai/x.wav "Gaffer! A word."

Models live in tools/voice/models/ (gitignored): kokoro-v1.0.onnx, voices-v1.0.bin.
"""
import argparse
import pathlib

import soundfile as sf
from kokoro_onnx import Kokoro

MODELS = pathlib.Path(__file__).resolve().parent / "models"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("text")
    ap.add_argument("--voice", default="bm_george")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--lang", default="en-gb")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    samples, rate = kokoro.create(a.text, voice=a.voice, speed=a.speed, lang=a.lang)
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out, samples, rate)
    print(f"{out} ({len(samples) / rate:.1f} s)")


if __name__ == "__main__":
    main()
