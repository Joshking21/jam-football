"""ElevenLabs voice lines for every spoken line in the game (SPEC §17.4, §18.2).

Default is a DRY RUN: it builds the full job list from src/content/*.json and the world snapshot,
counts characters per group, and writes docs/design/VOICE-BUDGET.md. Nothing is sent.

  python tools/eleven/vo.py                      # count only, write the budget report
  python tools/eleven/vo.py --go --only coach    # generate one group (needs ELEVENLABS_API_KEY)
  python tools/eleven/vo.py --go --limit 5       # try 5 lines first
  python tools/eleven/vo.py --go --model eleven_flash_v2_5

Voices are mapped in tools/eleven/voices.json (fill in voice ids after auditioning).
Existing files are skipped, so a run can be resumed. Output: public/assets/audio/vo/...
Afterwards run: python tools/manifest.py
"""
import argparse
import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from common import ASSETS, CONTENT, ROOT, http, load_env, need_key, write_manifest  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
VO = ASSETS / "audio" / "vo"


def j(name):
    p = CONTENT / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def pick(key: str, n: int) -> int:
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % n + 1


def jobs():
    """Yields (group, voiceKey, relPath, text)."""
    # commentary (§16.1): line audio without the name; names are separate files
    c = j("commentary.json")
    if c:
        for l in c["lines"]:
            yield "commentary", l["voice"], f"commentary/{l['id']}.mp3", l.get("voText") or l["text"]
    world = json.loads((ROOT / "src/core/world/world.snapshot.json").read_text(encoding="utf-8"))
    players = list(world["players"].values())  # freeAgents is a list of ids into players
    for p in players:
        shirt = p.get("knownAs") or p["lastName"]
        yield "names", "PBP", f"names/{p['id']}.mp3", shirt
        yield "coach_names", "coach", f"coach_names/{p['id']}.mp3", shirt
    for cid, club in (world["clubs"].items() if isinstance(world["clubs"], dict) else ((c["id"], c) for c in world["clubs"])):
        yield "clubs", "PBP", f"clubs/{cid}.mp3", club.get("shortName") or club["name"]
    # coach: team talks, press answers, conversation replies, club.json, training one-to-ones
    t = j("talks.json")
    if t:
        for ctx in t.values():
            for tone in ctx.values():
                for l in tone.get("managerLines", []):
                    yield "coach", "coach", f"coach/{l['id']}.mp3", l.get("voText") or l["text"]
    pr = j("press.json")
    if pr:
        for q in pr["questions"]:
            yield "press_questions", f"journalist{pick(q['id'], 3)}", f"press/{q['id']}.mp3", q.get("voText") or q["text"]
            for a in q["answers"]:
                yield "coach", "coach", f"coach/press_{q['id']}_{a['id']}.mp3", a.get("voText") or a["text"]
    cv = j("conversations.json")
    if cv:
        for kind in cv.values():
            for o in kind.get("openings", []):
                yield "players", f"player{pick(o['id'], 3)}", f"players/{o['id']}.mp3", o.get("voText") or o["text"]
                for r in o.get("replies", []):
                    yield "coach", "coach", f"coach/{r['id']}.mp3", r.get("voText") or r["text"]
                    if r.get("playerReaction"):
                        yield "players", f"player{pick(o['id'], 3)}", f"players/{r['id']}_reaction.mp3", r["playerReaction"]
    for fname, key in (("club.json", "lines"),):
        cl = j(fname)
        if cl:
            for l in cl[key]:
                sp = l["speaker"]
                folder = {"coach": "coach", "assistant": "assistant", "owner": "owner", "director": "owner", "physio": "physio", "player": "players"}[sp]
                voice = f"player{pick(l['id'], 3)}" if sp == "player" else sp
                yield ("players" if sp == "player" else sp if sp != "director" else "owner"), voice, f"{folder}/{l['id']}.mp3", l["voText"]
    tr = j("training.json")
    if tr:
        for l in tr["oneToOne"]:
            sp = l["speaker"]
            yield ("coach" if sp == "coach" else "players"), ("coach" if sp == "coach" else f"player{pick(l['id'], 3)}"), f"{'coach' if sp == 'coach' else 'players'}/{l['id']}.mp3", l["voText"]
    a = j("assistant.json")
    if a:
        for k in ("stingers", "greetings", "halfTimeOpeners", "postMatchOpeners"):
            for l in a.get(k, []):
                yield "assistant", "assistant", f"assistant/{l['id']}.mp3", l["text"]


def budget(all_jobs, out_md):
    groups = {}
    for g, v, path, text in all_jobs:
        n, ch = groups.get(g, (0, 0))
        groups[g] = (n + 1, ch + len(text))
    total = sum(ch for _, ch in groups.values())
    order = ["commentary", "names", "clubs", "coach", "coach_names", "assistant", "owner", "physio", "press_questions", "players"]
    rows = "\n".join(f"| {g} | {groups[g][0]} | {groups[g][1]:,} |" for g in order if g in groups)
    must = sum(groups.get(g, (0, 0))[1] for g in ("commentary", "names", "clubs", "press_questions", "assistant"))
    md = f"""# Voice budget (generated by tools/eleven/vo.py)

Every spoken line in the content files today, counted by character. ElevenLabs bills by character (credits).
Model cost: `eleven_multilingual_v2` = 1 credit per character; `eleven_flash_v2_5` = 0.5 (check the current pricing page before buying).

| Group | Lines | Characters |
|---|---|---|
{rows}
| **Total** | **{sum(n for n, _ in groups.values())}** | **{total:,}** |

- **With multilingual v2:** about **{total:,} credits** for one clean take of everything.
- **With flash v2.5:** about **{total // 2:,} credits**.
- **Add about 30% for retakes** (bad reads, wrong emphasis): multilingual ≈ {int(total * 1.3):,}, flash ≈ {int(total * 0.65):,}.
- **The "must have" set** (commentary, names, club names, press questions, Theo's stingers): {must:,} characters.
- Sound effects, room ambience and music are billed separately; see the SFX list in `tools/eleven/sfx.json`.

**Fallback:** the local Kokoro voice in `tools/voice/` is free. Any group that doesn't fit the plan (players' replies first, then the physio) can use it, while the headline voices stay ElevenLabs for the sponsor track.
"""
    out_md.write_text(md, encoding="utf-8")
    return groups, total


def generate(all_jobs, voices, key, model, only, limit):
    done = 0
    for g, vkey, rel, text in all_jobs:
        if only and g not in only:
            continue
        dest = VO / rel
        if dest.exists():
            continue
        vid = voices.get(vkey, "")
        if not vid or vid.startswith("TODO"):
            raise SystemExit(f"No voice id for '{vkey}' in tools/eleven/voices.json")
        status, body = http("POST", f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_96",
                            {"xi-api-key": key, "Accept": "audio/mpeg"},
                            {"text": text, "model_id": model, "voice_settings": voices.get("_settings", {}).get(vkey, {"stability": 0.45, "similarity_boost": 0.8})})
        if status != 200:
            raise SystemExit(f"ElevenLabs error {status} on {rel}: {body[:200]!r}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        done += 1
        print(f"  {rel}")
        if limit and done >= limit:
            break
    return done


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true", help="actually call ElevenLabs (default: count only)")
    ap.add_argument("--only", nargs="*", help="groups to generate, e.g. commentary coach")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--model", default="eleven_multilingual_v2")
    a = ap.parse_args()
    all_jobs = list(jobs())
    groups, total = budget(all_jobs, ROOT / "docs" / "design" / "VOICE-BUDGET.md")
    for g, (n, ch) in groups.items():
        print(f"{g:16s} {n:5d} lines {ch:8,d} chars")
    print(f"{'TOTAL':16s} {sum(n for n, _ in groups.values()):5d} lines {total:8,d} chars  -> docs/design/VOICE-BUDGET.md")
    if a.go:
        voices = json.loads((HERE / "voices.json").read_text(encoding="utf-8"))
        key = need_key(load_env(), "ELEVENLABS_API_KEY")
        n = generate(all_jobs, voices, key, a.model, set(a.only or []), a.limit)
        print(f"generated {n} files; manifest now {write_manifest()} files")
