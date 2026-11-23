# Asset tools (Claude-owned; Gemini doesn't edit this folder)

All scripts run with the system Python from the repo root and do a **dry run by default**: they list the jobs and the cost, and spend nothing. Add `--go` to call the service. Keys are read from `.env.local` (`ELEVENLABS_API_KEY`, `FAL_KEY`, `MESHY_API_KEY`), never printed, never committed. Files that already exist are skipped, so runs can be resumed. After any run, `python tools/manifest.py` refreshes `public/asset-manifest.json` (the `--go` runs do it for you).

| Script | Makes | Notes |
|---|---|---|
| `content/build_*.py` | `src/content/commentary.json`, `assistant.json`, `club.json`, `training.json` | The source of the game's spoken and written lines. Edit the builder, run it, then `npx prettier --write` the JSON |
| `eleven/vo.py` | `audio/vo/**` | Every spoken line from the content files plus player and club names. The dry run writes `docs/design/VOICE-BUDGET.md`. Voices are set in `eleven/voices.json` |
| `eleven/sfx.py` | `audio/crowd`, `audio/sfx`, `audio/ambience` | The prompt list is `eleven/sfx.json` (every file named in SPEC §17) |
| `fal/gen.py` | `images/**` | Job list in `fal/jobs.json`; `--portraits` adds one programme-print portrait per player (halftone post-process, §18.5) |
| `meshy/gen.py` | `tools/meshy/raw/*.glb` | Job list in `meshy/jobs.json`. Test `person` first. Raw GLBs are cleaned, reduced and placed in `public/assets/models/` after review |
| `manifest.py` | `public/asset-manifest.json` | `{version, files: {path: {bytes}}}` (§18.1) |
| `voice/say.py` | local WAVs | The free Kokoro fallback voice (needs `tools/.venv`) |

**Order once keys arrive:** Meshy `person` test → ElevenLabs 5-line voice test per voice → fal exterior and portraits test → full batches. The plan and pass/fail rules are in `docs/design/AI-TESTS.md`.
