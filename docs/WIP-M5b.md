# Where work stopped: M5b physics and match visuals (updated 24 Nov 2026)

**Read this first when picking the work back up.** Everything below is on `main`. The `claude/physics` branch can be deleted.

## What's done

### Physics (src/physics/)
- **Ball flight** (`ballFlight.ts`): drag with smooth drag crisis (Hermite around 12 m/s), Magnus curl, rolling resistance. Newton launch solver with finite-difference 3×3 Jacobian. 300 random kicks land within 0.4 m.
- **Match physics** (`matchPhysics.ts`): Rapier 0.21.0 lazy chunk (~1.65 MB gzip). Ball is a CCD body struck at each flight; posts, crossbar, net, boards as colliders. Players are capsules (mass from strength, 65–90 kg), driven toward director targets, real contact. Fouls tip the capsule and it recovers after 1.5 s. Kinematic fallback if Rapier fails.
- **Grass trample** (`trample.ts`): two render targets (trample fades at half-life 4 s dry / 9 s wet; wear is permanent). Feet, ball, slides and falls stamp it. Shader multiplies into the pitch colour.

### Stadium and lighting
- **Blender bake pipeline**: `scripts/export-stadium-geometry.ts` exports PLY + sidecar; `tools/blender/bake_stadium_ao.py` runs headless Cycles AO (96 samples, 4 m distance, skips plain boxes); `src/render3d/stadiumBake.ts` applies per-vertex AO with a 0.18 floor. Bakes in ~4 seconds.
- Stadium rebuilt with rakes, roofs, corner blocks, animated crowd. Beam cones fixed (inverted fade, world-height fade, shorter). Physical light units tuned.

### Director (src/render3d/choreographer.ts)
- Ball timeline from the full event list: real flight times, carries, dribbles, clearances as touches.
- Set-piece layouts, pressing, box runs, anticipation (only nearby players react).
- Celebrations from the moment the ball crosses the line; beaten keeper stays on the goal line.
- **Team blocks (v1.8 B)**: defensive line ~22 m off the ball (Deep/Normal/High), midfield 10–12 m ahead, compact and shifted to ball side. In possession: backs behind ball, forwards just onside. Support angles for the carrier.
- **Human steering**: jog (<6 m), run (6–16 m), sprint (>16 m or urgent). Speed-dependent turn rate; plant-and-turn at >2 rad change; backpedal facing ball. Body facing turns at faceRate rad/s.
- `ballOut` flag: teams hold shape when the ball is out of play; `refBall` clamped to pitch.

### Engine (Gemini + Claude fixes)
- M5 task 10 (§13.21–13.23): touchline shouts (7 shouts, gain/cost, 10 min duration), match plans (up to 4 when/after/then rules, Ask-me-first card), player traits (12 traits, per-player fixed seed, 55–65% coverage, clashes with instructions).
- UI: ShoutWheel, PlanAskCard, MatchPlanSheet (Tactics tab 6), TraitChips in player file / squad / pre-match.

### Engine & Polish (Gemini)
- **Calibration tuning (100% ALL PASS):** Baseline (goals 2.48, home win 43.6%, draw 24.6%, away win 31.8%, 0-0 6.4%, sim 15.54 ms), Depth 1 (max diff ±5.8% pts), Depth 2 (menBack corners +20.2%, counters +106.4%, familiarity drop 7.6 pts), Depth 3 (opp DEF 3rd ball wins +36.9%, fatigue PASS, w_high counters +37.3%, dm_drop opp through balls -34.3%, cb_step vs cb_cover tackles +31.4%, no dominant choice ±4.0% pts).
- **Commentary strip (T9):** `src/core/match/commentary.ts` resolving 42+ match event types against `src/content/commentary.json`, with substitution, weather tokens, scoreline context, and importance weighting. Wired into `MatchScreen.tsx`.
- **Club & Squad screens (R4, R5):** Rebuilt `ClubScreen.tsx` (ledger book, boardroom letter with 25% sack line, 4 staff cards with hiring modal, dressing room cohesion meter with leaders and reasons) and `SquadScreen.tsx` (left team sheet grouped by GK/DEF/MID/FWD, right player dossier with portrait, radar chart, season stats, condition/morale/risk, 3-column attribute bars with 4-week delta arrows, coach memo, action buttons).
- **Review Items Batch (M4 & M5):** T4 (stats & scorers filtered by `t <= currentT` and `t <= 2700`), T5/R2 (1-based matchday target lookup fixing preseason fixture display), T8 (replay badge on top letterbox bar), T11 (fulltime modal compact fit at 1280), T12 (real out-of-town live scores from league schedule), T13 (rolling xG momentum chart), R1 (`&state=md8` simulated 8 matchdays for captures), R3 (opaque top bar, club name ellipsis at 1280), R6 (AI Best XI lineup initialization for all clubs), R8 (Inbox in-tray filter tabs, overlapping stack, sender badge borders, terms box), R9 (initial scout shortlist seeded from >= 4 clubs plus 1 free agent).

### Probes and captures
- `scripts/probe-shape.ts`: back-line spread 0.7 m (was 5.3), def-mid gap 10.2 m (was 19.7), length 25 m (was 47), 0 frames behind goal (was 1384).
- `scripts/probe-goals.ts`: 25/25 goals end in the net across 6 matches.
- `scripts/probe-behind.ts`: nobody goes behind the goal line any more.
- Match captures in `docs/screens/M5b/` at 1280 and 1920.

## Open items, in order of priority

### 1. Real ragdolls and IK
Needs a rigged `player.glb` with Mixamo bone names (§18.3 v1.8). Until Meshy delivers the model, falls use the tipping capsule. **Blocked on Meshy keys.**

### 2. New animation clips (§18.3 v1.8)
Stumble, SlideTackle, Jump, Fall*, GetUp*, HoldLeg, Cross, Clear. Same Meshy dependency.

### 3. Grass blades
Instanced near-camera blades (Medium/High detail). Not started. Pure render work, no engine dependency.

### 4. Coach character controller (M6b task 3b, §14.12.7)
Rapier character controller with hand IK on doors, walls, desks. Part of M6b, not M5b.

### 5. Scout's-note lines (REVIEW-M5 R7)
Characterful scout lines for `src/content/scouting.json`. Content work, no code dependency.

## How to run things

- **Build**: `npx vite build` (use PowerShell on Windows; Git Bash has a drive-letter case bug)
- **Tests**: `npx vitest run` (288 tests, 41 files)
- **Probes**:
  - `npx tsx scripts/probe-shape.ts` (team shape metrics)
  - `npx tsx scripts/probe-goals.ts` (every goal in the net)
  - `npx tsx scripts/probe-behind.ts` (nobody behind the goal line)
- **Captures**: `npx tsx scripts/capture-screens.ts M5b "^match-(kickoff|goal)$"` (~1–2 min per image)
- **Blender bake**: `npx tsx scripts/export-stadium-geometry.ts tests-ai/bake` then `blender -b --factory-startup -P tools/blender/bake_stadium_ao.py -- tests-ai/bake/stadium.ply tests-ai/bake/stadium_meshes.json public/assets/bake`
- **Calibration**: `npm run calibrate`

## For DeepSeek / Gemini handoff
The spec is split: `docs/SPEC.md` is an index; real text is in `docs/spec/*.md`. Read the task-map row for the section numbers your task needs, not the whole spec. The PROGRESS log has the latest 3 entries; older ones are in `PROGRESS-archive.md`. Gemini's rules are in `GEMINI.md`. All 288 tests must pass before committing.
