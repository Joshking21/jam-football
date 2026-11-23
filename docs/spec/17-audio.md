<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 17. Audio (`src/audio/`)

### 17.1 Engine
Web Audio API. One `AudioContext` created on the first user gesture. Buses: master → [music, crowd, commentary, sfx], each a GainNode wired to settings. Decode buffers once and cache. Missing files (not in the manifest) are skipped silently.

### 17.2 Music
`music/title_theme.mp3` (title), `music/menu_loop.mp3` (all management screens, −6 dB), stop during matches; `music/season_end.mp3` on the season-end sequence. Crossfades 1.5 s.

### 17.3 Crowd and SFX (match)
- Loops: `crowd/ambience_calm.mp3`, `crowd/ambience_tense.mp3` crossfaded by `danger` = 0 (ball in own DEF third) → 1 (ball in the opponent box), smoothed over 1.5 s. Home-side bias: the crowd swells (+3 dB) on home attacks.
- One-shots: `crowd/goal_roar.mp3` (home goals full, away goals at −8 dB plus `crowd/away_cheer.mp3`), `crowd/groan_miss.mp3`, `crowd/ooh_save.mp3`, `crowd/boo_foul.mp3`, `crowd/chant_{1..4}.mp3` (random every 60–120 s), `sfx/whistle_short.mp3`, `sfx/whistle_long.mp3` (HT/FT ×3 pattern for FT), `sfx/kick_{1..4}.mp3` (pass/shot, shot louder), `sfx/net.mp3`, `sfx/post.mp3`, `sfx/header.mp3`, `sfx/ui_click.mp3`, `sfx/ui_confirm.mp3`, `sfx/ui_error.mp3`, `sfx/notification.mp3`, `sfx/camera_shutter.mp3` (press conference). UI motion sounds (§19.7): `sfx/ui_whoosh.mp3`, `sfx/ui_cut.mp3`, `sfx/ui_tick.mp3`, `sfx/ui_clack.mp3`, `sfx/ui_paper.mp3`, `sfx/ui_stamp.mp3`.
- Spatial: kicks panned by ball x relative to the camera (StereoPannerNode, ±0.6).

### 17.4 Voice
- Commentary queue with priorities (importance). If a line is still playing and a higher-importance event arrives, fade the current line out over 150 ms. Drop lines older than 3 sim seconds at the moment they would start. During time-lapse gaps, no PBP except goals in other games ("Meanwhile, at Furnace Park…" lines `OTHER_GOAL`, 6 lines, nameSlot none, club names spoken via `vo/clubs/{clubId}.mp3` appended after).
- Duck crowd by −6 dB and music by −10 dB while voice plays.
- Assistant stingers: `vo/assistant/stinger_{1..6}.mp3` ("Gaffer!", "Boss, a word.", …), and voiced fixed lines for greetings, half-time openers, post-match openers (ids in `assistant.json` with `"voiced": true`).
- Press: `vo/press/{questionId}.mp3` from `voText`.
- **v1.7, the coach is voiced:** `vo/coach/{lineId}.mp3` for team talks (§16.3), press answers (`press_{questionId}_{answerId}`), conversation replies (§16.4) and `club.json` coach lines. `vo/owner/{lineId}.mp3` covers the owner and directors, and `vo/assistant/{lineId}.mp3` covers Theo's `club.json` lines. `vo/players/{lineId}.mp3` (conversation lines, optional) uses 3 player voices, chosen by player id. `vo/coach_names/{playerId}.mp3` is each player's shirt name in the coach's voice (all 280, so it still works after transfers), chained before or after a line by `nameSlot` (§16.3). If a name file is missing, play the line alone; the caption still shows the name. Captions always show. A missing file falls back to the caption-rhythm mouth (§14.11.7), so every voice set is optional for the build.
- Each voice file passes through an `AnalyserNode` that feeds the speaker's mouth (§14.11.7). Voice ducking as above.

### 17.5 Room ambience (`ambience.ts`, v1.7)
One loop per room on the effects bus, crossfaded over 0.6 s as the coach walks. One-shots play on events. Loops sit at −18 dB against UI sounds (§19.7), so the UI still reads clearly.

| Room | Loop `ambience/{room}.mp3` | One-shots `sfx/` |
|---|---|---|
| exterior | Wind, distant traffic, a far-off gull | `car_door.mp3` |
| corridor | Building hum | `footstep_{1..4}.mp3` (synced to `Walk`), `door_open.mp3`, `door_close.mp3` |
| office | Clock tick; rain on the window in wet weeks (`ambience/office_rain.mp3`) | `phone_ring.mp3` (board messages), `door_knock.mp3`, `ui_paper.mp3` |
| boardroom | Quiet room tone, a ticking clock | `chair_creak.mp3` |
| dressing | Low chatter, a dripping shower | `studs_tile_{1..3}.mp3`, `locker_bang.mp3` |
| tunnel | Crowd heard through concrete, rising | `studs_concrete_{1..3}.mp3` |
| training | Wind, distant shouts, ball strikes | `whistle_short.mp3` (existing), `cone_hit.mp3` |
| press | Murmur, chairs | `camera_shutter.mp3` (existing), `mic_tap.mp3` |

---

