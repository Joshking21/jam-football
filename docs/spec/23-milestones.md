<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 23. Milestones, tasks and acceptance criteria

### 23.0 PROGRESS.md entry format
```
## 2026-11-20 · M1.3 World generation
- Changed: src/core/world/generateWorld.ts, names.data.ts, tests/core/world/generateWorld.test.ts
- Ran: npm test -- world → 6 passed, 0 failed
- Notes: …
- Open issues: …
```

### M0 — Foundation (19–20 Nov)
1. Scaffold Vite + React + TS with the exact versions (§4), scripts, configs, prettier, `.gitignore` (node_modules, dist, .env*, *.local, coverage).
2. `index.html` splash (§11.1), fonts via @fontsource imports, `tokens.css`, `global.css`.
3. Shell: Sidebar, TopBar, ContinueButton, routing by `phase`/screen in the store (no router library needed; a `screen` state with typed names).
4. Asset registry + empty manifest; procedural crest/avatar/kit/flag generators with a dev-only gallery screen (`?dev=gallery`, excluded from production UI).
5. Title screen + Settings modal (audio sliders saved; quality stored).
**Accept:** `npm run check` passes; title renders at 1280×720 and 2560×1440; splash paints < 300 ms; no console errors.

### M1 — Core data and world (20–23 Nov)
1. `types.ts`, `rng.ts`, `math.ts`, `ids.ts` with tests.
2. `clubs.data.ts` exactly per §9.2; formations (§14.3 anchors + slot positions).
3. Names + blocklist; `generateWorld.ts`; `scripts/gen-world.ts` writes the snapshot; generate and **commit** `world.snapshot.json` (freeze).
4. Ratings (§9.5), value/wage (§12.10), fixtures (§10.3, in the snapshot), table (§9.1).
5. `newGame.ts` (creates GameState from snapshot + seed + club + manager name), saves (§20) with tests.
**Accept:** all M1 tests pass; snapshot has 280 players, 90 fixtures; a dev page lists every club squad with OVRs and looks plausible (key players visible).

### M2 — Match engine (23–27 Nov)
1. Frames and zones (§13.1) with tests.
2. Engine state, involvement (§13.5), action selection (§13.6).
3. Action resolution (§13.7), shots/fouls/set pieces (§13.8), transitions (§13.9), clock/stoppage (§13.11).
4. Stats, ratings (§13.14), result.
5. AI manager (§13.13).
6. Commands + snapshots + rewind (§13.12); `match.worker.ts` protocol (§7.4); `season.worker.ts` (instant round).
7. Calibration script; tune to targets (§13.16).
**Accept:** determinism and legality tests pass; calibration report all PASS (record in PROGRESS); `simulateInstant` median < 30 ms.

### M3 — Playable season loop, text-first (27 Nov – 1 Dec)
0. **Tactical depth engine pass (§13.17), before anything else in M3**: new types (§8.4), `src/config/roles.ts`, role/instruction/order/transition/set-piece hooks in involvement, utilities and resolution, the new commands, AI defaults (§13.17.8), assistant rules (§13.17.9), save migration (duties → neutral roles, new fields → Mixed), unit tests per modifier kind, then re-run `npm run calibrate`: all §13.16 targets plus every §13.17.10 check MUST pass. Paste the report into PROGRESS.md.
1. Store actions for every phase (§10) and `advance.ts`.
2. **Wait gate:** do not start this task until Claude's animated references for the Hub and Tactics exist in `docs/design/` (check for `docs/design/hub/` and `docs/design/tactics/`). If they are missing when you reach it, write `BLOCKED: waiting for design references` in PROGRESS.md and continue with task 1 and any non-visual work in task 3 (store wiring, data selectors), then stop. Then rework the M0 shell to the §19 design system (v1.2): new `tokens.css`, `clubThemes.ts` applied at runtime, the top bar with navigation tabs (§19.6, v1.6; there is no sidebar), Ticker, ScreenTransition, CountUp, FlipList, Panel, Sheet, Stamp, Magnet, `src/ui/motion/spring.ts`, reduce-motion handling. Every screen below is built in its world (on air or office, §19.1).
3. Screens: New Game (§11.3), Board Meeting, Hub, Squad, Player Profile, Tactics (PitchBoard with drag/swap and keyboard), League, Fixtures, Club (finances/board basic), Inbox, Week Summary, Season End (basic), Sacked.
4. A temporary **text match view**: event feed with clock and score, speed control, subs/tactics overlays working through the worker with commands.
5. Autosave and Continue from title.
**Accept:** every screen change uses the §19.7 transitions and holds 60 fps; reduce motion turns them into crossfades; a complete 18-matchday season can be played start to finish via the text match view; save/reload mid-season works; season end shows table and grade; screenshots saved and the M3 design review (§19.8) is passed.

### M3b — Depth pass 2 (SPEC 1.4; starts when M3 is accepted, about 3 days; Gemini is ahead of schedule)
1. Engine: §13.18.1–13.18.11 and §13.19 (attacking and defensive roles, instructions by role, instruction fit; types §8.4, `K.d2.*`, the new `plan` command, AI and assistant additions, save migration with neutral defaults: Mixed / false / Never / 2 / None, plans copied from the current tactics, familiarity from §13.18.11 starting values).
2. Unit tests per new option, then `npm run calibrate`: all §13.16 targets, every §13.17.10 check, every §13.18.13 check and every §13.19.7 check MUST pass. Paste the report into PROGRESS.md.
3. Tactics screen rebuilt to the **v4 layout** in `docs/design/tactics/README.md` (top bar shell, three columns around a vertical board, no page scroll, RadarChart §19.5), with every object looking as it does in the v3 reference: the With ball / Without ball switch, the player's file with stats, role attribute bars and instruction fit, the swap comparison while dragging. Other office screens follow the same pattern (see that README).
**Accept:** calibration all pass; every new option changes the match in the direction its wording says (checked by the tests); old saves load.

### M4 — 3D match day (1–5 Dec)
1. Scene skeleton with fallbacks: pitch, lines, goals, boxes stadium, capsule players, ball, lights, quality presets, resize, disposal.
2. Choreographer (§14.3) and steering; ball flight.
3. Playback modes and highlight selection (§14.1, §14.6); time-lapse overlay with 2D radar.
4. Cameras (§14.4) incl. free orbit; goal replays (§14.7).
5. HUD (§11.16), half-time and full-time screens (§11.17–11.18), shot map, momentum chart, and the Analysis panel (§13.18.12).
6. Swap in real models automatically when present (registry), animations per §18.3.
7. Realism pass (§14.10): environment map, haze, grass material, post-processing chain, beams, wet pitch, wired to the quality presets (§21.2).
**Accept:** the realism pass is on at Medium and the frame budget (§21.1) still holds; a match at Key highlights takes 50–80 s real time; goals visibly match the events (the scorer is the one shooting, the ball ends in the net); 60 fps Medium on the dev laptop; 5 matches in a row without memory growth; every "game feel" detail in §19.8 is present; M4 design review passed.

### M5 — Systems depth (5–8 Dec)
1. Training (§12.3), development (§12.4), condition/fatigue (§12.1–12.2), injuries (§12.5), discipline (§12.6).
2. Morale and team talks (§12.8) in Pre-Match, Half-Time, Full-Time.
3. Press conferences (§12.6 triggers, §16.2).
4. Conversations (§12.9).
5. Board and fans (§12.7, §12.14), finances (§12.10).
6. Transfer windows complete (§12.13) with scouting (§12.12) and AI activity; news (§16.6).
7. Club depth (§12.17): staff and replacing them, match preparation, rest days, role and position training, dressing room (leaders, cohesion), injury risk column.
8. **Training in detail (§12.18, v1.7):** the planned week and session library, templates, Theo's week, personal plans (workload, extra sessions, mentoring), one-to-one sessions (screen flow now, the 3D scene in M6b), training ratings and the new conversation trigger, progress arrows and the OVR line, overload memos, `training.json`, the Training screen (§11.9 v1.7) as a 2D screen until M6b frames it. Run the §12.18.12 checks. §12.18.11 (coaches per area) only after M7 is on track.
9. **Set pieces in detail (§13.20, v1.7):** corner jobs and routines (Rotate, predictability, sharpness from training), takers and swing from the foot, free kicks by area, defending corners and free kicks, set-piece mode on the whiteboard, 3D placement, analysis, AI and assistant rules. Run the §13.20.10 checks.
10. **Touchline shouts, match plans and player traits (§13.21–13.23, v1.7):** the shout command and HUD wheel, the match-plan sheet and engine rules with "Ask me first", traits in the data, world gen, engine, clashes, learning in training, and UI. The touchline cut for shouts comes in M6b. Re-run the §13.16 and §13.18.13 calibration with traits on.
11. **Injury and discipline decisions (§12.19–12.20, v1.7):** knocks with the KNOCK event and command, rushing players back, warm-up scares, the Knocks setting, the injury log; discipline incidents, choices, the consistency rule, records; `club.json` physio and incident lines. Build them as choice cards on the current screens now; M6b turns them into talk scenes (§11.25.5).
**Accept:** every system visibly changes something the player can see within a season; transfer window rounds behave per the tests; content files meet minimum counts.

### M5b — Physics and contact (SPEC 1.8, TOP PRIORITY, approved by the user 23 Nov)
**When:** start as soon as the M5 task in progress (task 10) is committed. M5 task 11 and everything after it wait until M5b is accepted. Read `spec/14c-physics.md` (§14.12) first.
0. **First, the M4 third-pass blockers T1–T5** (`docs/design/REVIEW-M4.md`) and the M5 screen blockers R1–R3 (`docs/design/REVIEW-M5.md`: MD8 capture state, matchday off by one, top bar), as one commit. Physics drives bodies from the choreographer's targets, so the players must really move with play first. Fix T6–T14 during M5b.
1. **Set-up:** the Rapier dependency, the lazy `physics` chunk, init during match load, the fixed-step world, the debug view (`?dev=physics`), the replay ring buffer, and the kinematic fallback (§14.12.1).
2. **Ball:** body, drag, Magnus, bounce and roll; the launch solver; the goal frame, net and boards colliders; the outcome contracts; the net ripple at the contact point (§14.12.2).
3. **Bodies and contact:** capsules driven by the §14.3 steering, mass from strength, shoulder charges, standing and sliding tackles, aerial duels, set-piece jostle, the keeper's body, the priority rule (§14.12.3).
4. **IK:** foot planting, the kick contact frame lined up with `event.t`, headers, head look-at (§14.12.5).
5. **Ragdolls:** active ragdoll falls, get-ups and injuries, with the Low fall-clip path (§14.12.4).
6. **Grass:** blades, physical stripes, wind, the trample map and its sheen, the wear map, turf and spray particles, all on the §21.2 presets (§14.12.6).
7. Tests (§14.12.8), a performance run on Medium, captures of every §14.12.8 state plus every M4 state in `docs/screens/M5b/`, then `REVIEW REQUESTED: M5b`. This is a Claude design gate.

**Accept:**
- Every §14.12.8 test passes.
- The §21.1 match frame budget still holds on Medium with physics on.
- Goals still visibly match the events (M4 accept).
- A match at Key highlights still takes 50–80 s.
- With Rapier blocked, the game plays on the §14.3 fallback.
- The M5b design review is passed.

**If time runs short, cut in this order** (record each in `DECISIONS.md`):
1. turf and spray particles
2. the wear map (keep the trample map)
3. grass blades on Medium (keep them on High)
4. set-piece jostle

The ball physics, body contact, foot IK and ragdoll falls stay.

**After M5b is accepted, before M6:** rebuild Club and Squad to their references (`docs/design/REVIEW-M5.md` R4–R5), then M5 task 11.

### M6 — Assistant and audio (8–10 Dec)
1. Advice engine (§15) with Apply actions in Pre-Match, Hub, match drawer, Half-Time, post-match.
2. Audio engine, buses, settings wiring, crowd danger mix, SFX hooks, music.
3. Commentary selection and caption strip; voice chaining (names + lines) with ducking.
**Accept:** in a test match, at least 3 assistant advices fire and Apply changes the engine (visible in the next events); audio works with and without asset files; commentary captions never overlap or lag more than 1 s.

### M6b — Club spaces (SPEC 1.7; starts when M6 is accepted, about 6–7 days; Gemini is ahead of schedule)
Build everything with fallbacks first (box rooms, capsule people, no faces, caption-rhythm mouths), then switch to real assets as they appear in the manifest.
1. `ClubScene` and scene manager, corridor, camera rails, the coach's walk with skip, **built so free walking (§24, top extra) can be added later without rework:** all rooms sit on one connected floor plan in one coordinate space, joined by the corridor (no teleports between unrelated spaces). Walk paths run on a nav graph of the floor. Every wall and prop has a simple box or capsule collider, built as a Rapier collider (v1.8, §14.12.7). The coach walks with the Rapier character controller fed by the nav graph, and doors are hinged bodies. Every interactive thing (desk, whiteboard, locker, TV, door, person) is a data-defined **hotspot** `{ id, position, radius, opens: screen | scene }`. Clicking a hotspot does the same thing a future `E` key will do. tab and Continue routing through rooms, the walks setting, and look-around in every room (§11.25.1–11.25.2, §11.25.4).
2. Room shells in code, and every screen re-framed in its room (§11.25.3). Frame cap and the Low-preset still frame (§21).
3. People: shared rig loader, clip mixer with fallbacks, marks and paths, sitting (§14.11.1).
3b. **The coach touches the world (v1.8, §14.12.7):** hotspot `touch` points, hand IK on door handles, walls, the desk, the board table and the whiteboard (following the magnet drag), locker doors, chairs, loose props, feet IK on steps and slopes, head look-at, coat and tie spring bones, and camera sphere casts. Capture the `door`, `corridor-brush`, `desk-rest` and `board-reach` states for the M6b review.
4. Faces and mouths: `Face` shader, moods, blink, head tilt and gaze, audio-driven and caption-rhythm mouths (§14.11.6–14.11.7).
5. **Talk scenes (§11.25.5), used by every scene where people talk: speaking beats with Skip only, choice beats with the choice card.** Dressing room (the U of lockers, §11.25.1): Squad lockers, the pre-match briefing, team-talk reactions from real §12.8 results; Pre-Match, Half-Time and Full-Time here (§14.11.2). Boardroom: Board Meeting, reviews, Sacked.
6. Players at the door: §12.9 conversations as office scenes, and "Talk to player" at the locker (§14.11.3).
7. Theo in the office, at the whiteboard and in the dressing room (§14.11.4).
8. Press room: reporters, the voiced question, raised hands, flashes (§14.11.4).
9. Tunnel walk-out into the M4 match intro.
10. Touchline cuts in the match with Theo and the bench (§14.11.5).
11. Training ground drills by focus (§14.11.4).
12. Room ambience and one-shots (§17.5), and the coach, owner and Theo voices wired (§17.4).
12b. **Time of day** (§11.25.6): the four weekly beats, the top-bar chip, events scheduled into beats, lighting presets and crossfades, who's where, and ambience by beat. The training ground sits beside the stadium (§11.25.1 site).
13. Capture `docs/screens/M6b/` (every room, at 1280×720 and 1920×1080, with assets and without) and a performance run. `REVIEW REQUESTED: M6b`: this is a Claude design gate.

**Accept:**
- Every screen is reachable by mouse and keyboard, and plays offline with no assets.
- Budgets in §21.1 are met.
- Walks add ≤ 3 min to a full season at default settings, measured in a scripted season.
- A test shows each player's team-talk reaction matches the sign and size of his morale change.
- No room ever delays the Title.

**If time runs short, cut in this order** (record each in `DECISIONS.md`):
1. training drills (players hold a still drill pose)
2. press-room reporter animation (they stay seated; the question is still voiced)
3. Theo in the match (his tips stay as HUD cards)
4. the bench in touchline cuts
5. the coach's walk (becomes a camera glide)
6. faces on everyone but the coach

Team-talk reactions, players at the door and room sound stay.

### M7 — Onboarding, polish, season end (10–12 Dec)
1. Tutorial (§11.24). 2. Season End sequence complete with awards and share card (§11.20, §12.15–12.16). 3. Save slots, export/import, Load screen. 4. Credits. 5. Visual polish pass on every screen against §19 (spacing, empty states, loading states). 6. Run QA checklist §22.4 and fix.
**Accept:** QA checklist all pass except items blocked by missing final assets; a new player can finish a season without reading any docs; M7 design review passed.

### M8 — Asset integration and performance (12–15 Dec)
1. Integrate Claude's delivered assets (they appear in the manifest; verify every path is consumed), including the portrait tint (§18.5) if not already done. 2. Performance pass against §21 (profile, fix). 3. Offline test, no 404s. 4. Final content proofreading. 5. Feature freeze on 15 Dec.
**Accept:** budgets §21.1 met and recorded; QA checklist all pass.

### M9 — Ship (15–17 Dec)
1. `npm run check` clean; `npm run build`; `vite preview` smoke test.
2. Hand over to Claude Code for `opengame check --build` and deploy (Gemini is not a supported OpenGame agent). Fix any findings it reports.
3. Optional: OpenGame SDK leaderboard for the season score (only if the SDK docs from `opengame setup` describe it; must not require sign-in and must work offline by failing silently).
**Accept:** the published entry plays from a fresh browser; submitted before 17 Dec 23:59 PT (one day of margin).

---

