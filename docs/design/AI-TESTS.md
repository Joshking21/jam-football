# AI test batch

> **Budget plan (20 Nov, the user's call): $1 total.** The jam's free fal and ElevenLabs entrant offers are all claimed; Meshy Pro for $1 (1,000 credits plus API keys) is still open.
> - **fal: on hold, no spend.** Replacements: captain walk-in = Meshy player model with its walk clip, rendered and halftoned in-game; news photos = frames from the actual match printed as newsprint; portraits = procedural programme-print faces from player data; crests = drawn by code; stadium and title images = our own 3D scene, graded. If money turns up later, spend it on one fal showcase piece (the title loop F8 or captain clip F6).
> - **Meshy: $1 Pro.** M1 first. Budget the 1,000 credits: player model and rig first, then ball, goal, floodlight, one stand; props only if credits remain.
> - **Kokoro (local, free, Apache-2.0):** `tools/voice/say.py` (env in `tools/.venv`, models in `tools/voice/models`, both gitignored). It voices Theo, the 3 journalists and any names ElevenLabs can't cover. Test K1 (20 Nov): Theo in bm_george / bm_lewis / bm_daniel, in `tests-ai/E3-kokoro/` and Downloads, waiting for the user's pick.
> - **ElevenLabs: free plan for tests only** (about 10k characters a month); only the two commentators. **The Free plan has no commercial licence; Starter does** (pricing page, 20 Nov). The jam pays cash prizes, so final shipped ElevenLabs audio is generated in one month on Starter (monthly billing, about $5–6), then cancelled. If that can't be paid by early December, ship Kokoro voices only (Apache-2.0). Priority: player names (about 3.5k characters), then key commentary lines (goal, save, full time), then Theo's stingers. Check the free plan's terms for attribution and use before shipping. Captions cover any line without audio.

One list of everything we try with the sponsor AIs before making any full set. Owner: Claude (runs the tools). The user approves each result or sends it back.

**How it works**
1. Keys go in `.env.local` (never printed, never in the build): `ELEVENLABS_API_KEY`, `FAL_KEY`, `MESHY_API_KEY`.
2. Check the credit balance before each provider's batch. Note it under Credits below.
3. Run one test, save the output to `tests-ai/<id>/` (gitignored), copy previews to `C:\Users\Joshking\Downloads`.
4. The user marks it **OK**, **Redo** (with a note) or **Drop**. Only an OK test becomes a full set in `public/assets/` (SPEC §18).
5. Look rules: `ART-DIRECTION.md`. Anything that breaks §2 there is a Redo, never "fine for now".

Status: `todo` · `running` · `review` · `ok` · `redo` · `drop`

---

## fal (images, video)

| ID | Test | Output | Pass when | Status |
|---|---|---|---|---|
| F1 | 4 portraits: different ages and nations, then printed in two club inks by `tools/print.ts` | 4 × 512² webp | 4 clearly different, ordinary people; reads as a programme print at 48 px and at 256 px (ART-DIRECTION §5) | todo |
| F2 | 1 crest (c07 Ashcombe, flame) | 512² webp, transparent | Looks like an old lower-league badge; flat, 2–3 colours; no letters from the model (§6.1) | todo |
| F3 | 1 stadium at night (c01 The Lanternworks) | 1280×720 webp | Real floodlit ground, harbour cranes behind, no readable text, graded per §3.4 | todo |
| F4 | 1 news photo, printed as single-ink newsprint | 1024×576 webp | Back-page action shot; faces small or turned; coarse halftone reads well in the Hub news panel | todo |
| F5 | **Captain walk-in (still):** one captain full length, in kit, plain background, arms down | 768×1344 png | Same person as his F1 portrait; kit in club colours, no logos | todo |
| F6 | **Captain walk-in (video):** F5 → image-to-video, walks toward camera, stops, folds arms, looks into the lens | 2–3 s clip → WebM with transparent background, about 0.5 MB | Hands and folded arms hold together in every frame; face doesn't drift; loops cleanly on the last frame. Fallback if it fails: F5 still slides in. | todo |
| F7 | **Desk objects:** 2 training cones, whistle, stopwatch, marker pens, coffee mug, top-down under a warm desk lamp | 1 webp each, transparent | Lit like the office desk (one warm lamp, top-left); real materials; sit on `--desk` without halos | todo |
| F8 | **Title loop:** stadium from high in the stand, floodlights on, slow push-in | 4–6 s WebM loop, ≤ 3 MB | No warping in the stands or the floodlight towers; the loop seam doesn't show | todo |
| F9 | Board room and press room backgrounds | 1920×1080 webp | Dark enough for white UI text on top; no faces in focus; no readable text (§6.4) | todo |

## Meshy (3D)

| ID | Test | Output | Pass when | Status |
|---|---|---|---|---|
| M1 | **Player:** fal concept with flat ID colours → image-to-3D → reduced to 10k triangles | `player.glb` | Material split works (Shirt, Shorts, Socks, Skin, Hair, Boots tint separately); face is simplified, never uncanny at 3 m (§4.1). **Test this first.** | todo |
| M2 | Player rigged and animated: Idle, Jog, Run, Kick, Celebrate | clips in the glb | No foot sliding at Jog and Run speed; no broken wrists or elbows | todo |
| M3 | Ball | `ball.glb`, 1.5k tris | Original panel graphic, no brand; round at close range | todo |
| M4 | Goal with a separate `Net` mesh (40×16 grid) | `goal.glb`, 3k tris | Net is its own mesh so the engine can ripple it | todo |
| M5 | Floodlight tower | `floodlight.glb`, 4k tris | Silhouette reads at broadcast distance; lamp bank is a separate emissive material | todo |
| M6 | Modern stand (side) | `stand_side.glb`, 8k tris | Seats tint per club; baked light under the roof. Brick and timber versions come last, only if credits allow | todo |

## ElevenLabs (voice, sound, music)

| ID | Test | Output | Pass when | Status |
|---|---|---|---|---|
| E1 | **Commentary voices:** PBP "Callum" and COL "Nadia", 6 lines each (calm, chance, goal, save, foul, full time) | 12 mp3 | Sound like a real broadcast pair; a goal line actually lifts; no American sports cadence | todo |
| E2 | **Name chaining:** 5 player names + 3 lines with `nameSlot: start`, played back to back | 8 mp3 | Name + line sounds like one sentence (no gap or jump in pitch) (SPEC §16, §17.4) | todo |
| E3 | **Theo Vance (assistant):** 6 stingers ("Gaffer!", "Boss, a word.", …) + 2 half-time openers | 8 mp3 | Warm, dry, a coach rather than an announcer; the same voice in every line | todo |
| E4 | **Press:** one question each from the 3 journalists (Meridian Sport, The Saltmere Echo, Coastline Radio) | 3 mp3 | Three clearly different people and outlets | todo |
| E5 | **UI sounds:** ui_whoosh, ui_cut, ui_tick, ui_clack, ui_paper, ui_stamp, ui_click, ui_confirm, ui_error, notification | 10 mp3 | Short and quiet; whoosh matches the 440 ms stinger; clack sounds like a real magnet on a whiteboard | todo |
| E6 | **Match sounds:** whistle short/long, kick ×2, net, post, header | 7 mp3 | Real, close-miked, no music in them | todo |
| E7 | **Crowd:** ambience calm/tense loops, goal roar, groan, ooh, 1 original chant | 6 mp3 | Loops have no audible seam; the chant is original, with no real club's song or words | todo |
| E8 | **Music:** title theme + menu loop, 30 s each | 2 mp3 | Fits "floodlit coastal town", not stock "epic"; the menu loop sits under speech at −6 dB | todo |

---

## Credits

| Provider | Before tests | After tests | Notes |
|---|---|---|---|
| fal | – | – | |
| Meshy | – | – | |
| ElevenLabs | – | – | |

## Order
1. **M1** (the material split decides how all players are made) and **F1** (portraits decide the 2D look).
2. F5 + F6 (captain walk-in): one captain only, before anything else on the Hub.
3. E1 + E3 (voices), then the rest in any order.
4. After all tests are OK: full sets, per ART-DIRECTION §7.
