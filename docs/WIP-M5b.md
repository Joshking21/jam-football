# Where Claude stopped: match view fixes and M5b physics (updated 24 Nov 2026, merged)

**Read this first when picking the work back up.** Claude is doing M5b and the M4 match blockers. The user stopped Gemini for this; Gemini's own unfinished M5 task 10 is still uncommitted in the main folder and is not part of any of this.

## Branches
- **Everything below is merged into `main`** (24 Nov), together with M5 task 10 (shouts, match plans, traits), which Claude finished after Gemini stopped. `claude/physics` can be deleted.

## Done on `claude/physics`
1. **Engine shot positions** (`0b258e0`): shots now come from their context's zone; sim bit-identical; median shot distance 29 m → 13.5 m.
2. **Director** (`src/render3d/choreographer.ts`):
   - a ball timeline built from the whole event list
   - real flight times, carries and short dribbles
   - shots wait for crosses, and passes before a shot go to the shooter
   - pressing, box runs, set-piece layouts and anticipation
   - celebrations from the moment the ball crosses the line
   - snaps after time jumps

   Tests: `tests/render3d/choreographer.test.ts`, including a real-match continuity test.
3. **Look:**
   - Stadium rebuilt: rakes with the crowd painted on, roofs, corner blocks; seats face the camera.
   - Animated crowd.
   - White goal posts and a net that bulges where the ball hits.
   - Even floodlighting. The beams were inverted, which painted cones on the grass; fixed (REVIEW-M4 T6).
   - Tighter TV camera (T7), replay camera behind the goal (T3), one name tag per cluster (T10).
   - Captures with the worker off, which fixes doubled events (T4/N4 in capture mode).
4. **Physics (M5b, `src/physics/`):**
   - `ballFlight.ts`: drag with a smooth drag crisis, Magnus, rolling, and a Newton launch solver. Tests hit 300 random kicks within 0.4 m.
   - `matchPhysics.ts`:
     - Rapier 0.21.0 in a lazy `physics` chunk.
     - The ball is a CCD body struck by the solver at each planned flight, with posts, crossbar, net and boards as colliders.
     - Players are capsules driven by the director, mass from strength, with real contact.
     - Fouls knock the victim over (the capsule tips, then gets up after 1.5 s).
     - Kinematic fallback if Rapier can't load.
     - Test: all goals end in the net; capsules never inside each other (≥ 0.4 m); 0.6 ms per step.
   - `trample.ts`: a trample map (fades with a half-life of 4 s dry, 9 s wet) and a permanent wear map, read by the pitch shader. Feet, the ball, slides and falls stamp it.

## Next steps, in order
1. **Check the latest captures** (`docs/screens/M5b/`, after the trample commit): the stands lit (seats were black before the winding fix), sponsor boards readable, trample visible but subtle, falls look right.
2. **The commentary strip** still shows raw event names ("KICKOFF - Minute 1"): T9 for Gemini, or wire `commentary.json`.
3. **Real ragdolls and IK** need a rigged `player.glb` with Mixamo bone names (§18.3 v1.8). Until Claude delivers Meshy models, falls use the tipping capsule.
4. **Grass blades** (instanced, near camera, Medium/High): not started.
5. **Coach physics in the club rooms** (§14.12.7): part of M6b, not started.
6. **Gemini's open items:** REVIEW-M4 T4 (live stats by time), T5, T8, T9, T11–T13, and REVIEW-M5 R1–R6, R8–R12.

## How to work on it
- The worktree is at `%TEMP%\claude\…\scratchpad\wt` on `claude/physics`, with `node_modules` as a junction to the main folder (Rapier is installed there too). If it's gone: `git worktree add <dir> claude/physics` and re-create the junction.
- **Don't run `prettier --write` on whole folders in the worktree:** it rewrites line endings on every file. Format only the files you changed.
- **Probes:**
  - `npx tsx scripts/probe-match.ts key|full` (motion)
  - `scripts/probe-goals.ts` (every goal ends in the net, with physics)
  - `scripts/probe-physics.ts`
  - `scripts/probe-trace.ts <t0> <t1>`
- **Captures:** `npx vite build`, then `npx tsx scripts/capture-screens.ts M5b "^match-(kickoff|goal)$"`. About 1–2 minutes per image.
