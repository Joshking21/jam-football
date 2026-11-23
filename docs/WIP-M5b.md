# Where Claude stopped: match view fixes and M5b physics (23 Nov 2026)

**Read this first when picking the work back up.** Claude is doing M5b and the M4 match blockers. The user stopped Gemini for this; Gemini's own unfinished M5 task 10 is still uncommitted in the main folder and is not part of any of this.

## Branches
- **`main`** has the SPEC 1.8 docs, both reviews and the scout's notes (`src/content/scouting.json` + `src/ui/screens/scoutNote.ts`).
- **The engine shot-position fix (`0b258e0`) is only on `claude/physics`:** Gemini has uncommitted edits to `src/core/match/engine.ts` in the main folder, so it couldn't be fast-forwarded. Merge it after Gemini commits task 10 (it only touches `processShotResult` and adds `shotOrigin`).
- **`claude/physics`** also has the **work in progress** below (one WIP commit on top of `0b258e0`). It is **not merged to main** because `tests/render3d/choreographer.test.ts` still tests the old behaviour and will fail.

## Done and verified
1. **Scout's notes** (REVIEW-M5 R7): plain voice, from the player's real best and worst attributes, foot, personality and knowledge.
2. **Engine shot positions:** shots were reported from where the ball last was, so 45% came from over 30 m (headers off crosses). The reported position now comes from the shot context. The sim is bit-identical (same 406 shots in a 20-match check). The median distance went from 29 m to 13.5 m.

## Work in progress on `claude/physics` (typechecks; probes good; visuals partly checked)
- **`src/render3d/choreographer.ts` rewritten as a "director":**
  - It builds one ball timeline from the whole event list (`setEvents`), so seeks and replays are exact.
  - Flights have real speeds. The receiver carries the ball on to the next event's start; long holds become short dribbles.
  - A shot waits for the cross to land, and a pass before a shot is re-aimed at the shooter.
  - Saves are held by the keeper. The ball rolls into the net on a goal.
  - Pressing, runs into the box with markers, corner and free-kick layouts, and anticipation: the next event's player heads there early.
  - Celebrations start when the ball crosses the line. Then the walk back and the kick-off layout.
  - Players snap into place after time-lapse or replay jumps.
- **Probe results** (`scripts/probe-match.ts key`): carrier-to-ball median 1.9 m (p75 5.6). About 2.8 attackers in the box at goals (was 0.67). 84–92% of players moving.
- **`src/config/render3d.ts`:** new home for 3D tunables (director, cameras, floodlights). It's kept out of `balance.ts` on purpose.
- **`cameras.ts`:**
  - The broadcast shot is tighter (FOV 26/22, about a third of the pitch) and stops panning at the penalty areas.
  - The replay uses a behind-goal camera (`setReplay`).
- **`goals.ts`:** white non-metallic posts (they were rendering dark), a panelled net with a diamond texture, and a bulge at the real contact point (`hitNet`). `MatchScene` calls it when the ball crosses the line, and fires the crowd jump at the same moment.
- **`stadium.ts` + new `standLayout.ts`:**
  - Real stepped rakes with the crowd painted on the seats, front fascias and back walls, gable ends, and roofs with lit fascias.
  - Corner blocks with lit windows close the corner gaps. LED-ish ad boards, and a dark apron.
- **`crowd.ts`:** up to 2k/6k/12k instanced supporters seated on the rakes, animated in the shader (bob, and the goal jump by side).
- **`lights.ts`:** night and evening use 4 directional corner lights instead of spotlight cones (`FLOODLIT` in `render3d.ts`).
- **`MatchScreen.tsx`:**
  - Capture states no longer start the worker. It was adding every event twice: the doubled goals and stats in M4 T4/N4.
  - It feeds `scene.setEvents(playback.getEvents())` and `scene.setReplay(...)`.
- **`playback.ts`:** adds `getEvents()`.

## Next steps, in order
1. **Beams cause the hard light shapes** (M4 T6, still visible in `docs/screens/M5b/match-kickoff-1280.png`): the fan and polygon shapes on the grass and the black V above the far stand come from `beams.ts`, not the lights. Shorten the cones so they stop well above the pitch, or fade them by height, and cut the opacity. Recapture.
2. **The replay camera sits inside the end stand.** `CAMERA.replay.behindGoal` = 9 puts it at x = 61.5, but the stand starts at 59. Use about 3.5 (between the goal line at 52.5 and the boards at 56.5) and height about 3. Check that the replay looks at the right goal.
3. **Name tags overlap** in the goal capture (`11 B…` under `5 NEVES`): T10 in REVIEW-M4.
4. **Update `tests/render3d/choreographer.test.ts`** to the director's behaviour:
   - the cross apex comes from real flight time
   - the kicker is flagged at `kickT`
   - the keeper dives on a shot to the side
   - feed events through `setEvents`

   Then run `npm run check` and merge `claude/physics` into `main`.
5. **Check visually:** goal, replay, tactical, afternoon and rain at 1280/1920. Check that the stands, crowd and roofs look right from the broadcast camera and from free orbit. The broadcast camera barely shows the far stand now: consider a slightly higher camera, or a lower look target.
6. **Then M5b physics proper** (`docs/spec/14c-physics.md`):
   - add `@dimforge/rapier3d-compat@0.21.0` as a lazy chunk
   - ball body + launch solver, using the director's segments as targets
   - player capsules driven by the director's targets, with contact
   - falls (capsules tip over until a rigged model exists; real ragdoll and IK need Meshy rigs)
   - grass trample map
7. **Gemini's other open items** (REVIEW-M4 T4, T5, T8–T13 and REVIEW-M5 R1–R6, R8–R12) are untouched.

## How to work on it
- The worktree was at `%TEMP%\claude\…\scratchpad\wt`, on the branch `claude/physics`, with `node_modules` as a junction to the main folder. If it's gone, run `git worktree add <dir> claude/physics` and re-create the junction.
- **Probes:** `npx tsx scripts/probe-match.ts key|full` (motion quality), `scripts/probe-shots.ts` (shot distances), and `scripts/probe-trace.ts <t0> <t1>` (frame trace).
- **Captures:** `npx vite build`, then `npx tsx scripts/capture-screens.ts M5b "^match-(kickoff|goal)$"`. About 1–2 minutes per image with SwiftShader.
