# M4 design review

Reviewer: Claude · 22 Nov 2026 · Screens: `docs/screens/M4/` (captured 21 Nov) plus fresh captures from the live dev build (22 Nov, `?screen=match` and `?screen=preMatch`, at 1920×1080 and 1280×720) · Bar: SPEC §14, §14.10, §19.8, `docs/design/ART-DIRECTION.md` §3.

## Verdict: not passed. The 3D match can't be judged yet.
The HUD shell is a good start: the scoreboard bug, the control strip and the time-lapse radar are clean and on-theme. But **the pitch and the players render black**, so the realism pass (grade, haze, beams, grass, kits) can't be reviewed at all. Fix the blockers, recapture with the new capture rules, and write `REVIEW REQUESTED: M4 (second pass)` in PROGRESS.md.

**Order for Gemini:** fix B1–B3 as one small task now, between M5 tasks (B1 is about a one-line fix). Do M1–M4 after them. Don't let the rest of M5 wait on this.

---

## Blockers

**B1. The pitch and the players are black.**
- **Seen:** in every match capture (`match-*.png`, and fresh captures with SwiftShader WebGL on), everything below the stands is pure black. Only the name tags show. The stands and the beams render, because the beams glow on their own.
- **Cause (very likely):** `src/render3d/lights.ts` creates the floodlight `SpotLight`s with intensity `keyLight.intensity × 1.5` (= 1.5) and decay 1.2. In three r171, punctual lights use physical units (candela), so 1.5 cd at 60–100 m lights almost nothing.
- **Fix:**
  - Use `decay = 2` and set the intensity in candela from the throw distance: `I ≈ targetIlluminance × d²`. For d ≈ 70 m and a target of about 2.5, that's about 12,000 cd per bank.
  - Put it in `balance.ts → render.floodlight.candela` (and per time slot as a multiplier), not as a magic number.
  - Check the afternoon `DirectionalLight` too. Directional lights don't decay, so it should be fine, but confirm with an afternoon capture.
  - Then tune against ART-DIRECTION §3: a night frame should look like a TV broadcast, with grass about `#3E6B2F` under the lights, kits the brightest colours, and soft shadows.
- **Guard:** the capture script must fail a match capture if the mean brightness of the bottom 60% of the frame is below 35/255 (the pitch area). A black pitch must never pass again.

**B2. The match clock goes negative.** The fresh capture shows **"-39:-8"**. Derive the clock only from sim time (`t` in seconds → `MM:SS`, clamped at 0, stoppage time as `45+2`), never from wall-clock deltas. Add a unit test for the formatter: negative, 0, 59, 60, 2,700 and stoppage time.

**B3. The capture pipeline hides problems.** `scripts/capture-m4-screens.ts`:
1. **Skips any file that already exists,** so screenshots go stale after code changes. It must always overwrite.
2. **Runs with `--disable-gpu` and a 2.5 s budget.** Use `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` and at least 10 s, so WebGL actually draws.
3. **Fakes game states:** `seasonEnd` and `weekSummary` write fake results and awards (`store.ts`). As agreed after M3, capture states must come from **real played matches**: sim the rounds with the engine, then open the screen.
4. **Misses most of the match:** M4 is the match, but only one moment is captured. Add capture states (via `?screen=match&state=…`) for:
   - kick-off on the broadcast camera
   - a goal banner
   - the replay letterbox
   - the half-time modal
   - the full-time modal with the shot map
   - quick subs open
   - both drawers open
   - the tactical camera
   - the free camera close to a player
   - an afternoon match
   - a rain match
5. **Make it reusable:** one script, `scripts/capture-screens.ts <milestone>`, that writes to `docs/screens/<milestone>/`.

## Major

**M1. Name tags are unreadable.** At the broadcast distance they're about 6 px tall, so they read as noise. Do what TV does:
- No tags in general play.
- A tag only on the ball carrier and on the player named in the current commentary line.
- Tags show on every player only on the tactical camera, or while `Alt` is held.
- Tag text ≥ 12 px, in Barlow Condensed 600, on a kit-colour chip.

**M2. Pre-Match isn't finished.**
- **Matchday number:** it says **"Matchday 0"**, and the status chip says "Preseason · 8th · 0 pts". The first fixture is Matchday 1. Find where `matchday` is shown before it increments.
- **Overlaps on the telestrator:** "KEY BATTLE" is drawn across the players, and an O marker sits on top of "THROUGH THE MIDDLE". Labels need clear space (offset them, or add a paper-coloured backing), and must never overlap markers.
- **Opposition markers:** their Os have no numbers or surnames. Use the Opposition-tab style from the tactics reference: a red-marker O with a number, and the surname under it.
- **Key battles:** these are generic units ("Port Calloway FC Defence vs Kestrel Bay FC Attack"). §13.17.7 defines named duels: up to 3, player vs player, with an arrow to the side with the edge and "big edge" when it applies. For example: "Achebe (pace 71) vs Ilori (pace 84) → them, big edge".
- **Copy that reads like filler** (breaks §19.8):
  - "Winning early second balls and cutting out the delivery lanes will neutralise their offensive momentum."
  - "We should remain balanced and compact in the middle third."
  - Every line must come from the data: name a player, a number, a habit. For example: "Their 9 wins 64% of his headers. Put Whitlock on him." Theo's line must come from the §15.2 rules, with its reason.
- **Composition:** about a quarter of the screen below the panels is empty, and the right column stops halfway down. It's an on-air screen, so fill the height. Either the telestrator grows, or steps 2 and 3 are visible as the next panels, the way the Hub reference fills its rows.

**M3. The ticker is filler.** "Teams emerging from the tunnel / Match officials conducting pitch inspection / Atmosphere building inside the stadium" carries no information. §19.5 says other results, injuries, rumours and headlines. Before a matchday: the round's other fixtures with kick-off and form, the latest injury news, and one rumour. During the match: live scores from the other grounds.

**M4. The time-lapse radar may not follow play.** At 27' and 0–0, the radar ball sits on the centre spot. Confirm the radar reads the frame positions during gaps; if it does, ignore this. Add one capture mid-gap.

## Minor

- **N1. Code size:** the main chunk is 274 KB gzip against the 350 KB budget (§21.1), and content keeps growing. Keep content JSON that's only needed after the Title (talks, press, club, training) in lazy chunks. SPEC 1.7's `club3d/` must be its own lazy chunk too.
- **N2. Scoreboard:** the scoreboard bug's clock is gold on a dark panel. Good. Keep `45+2` in the same chip when stoppage time is added (§14.5).

## Not reviewed this pass
Everything that depends on lighting: the grade, haze, beams over the pitch, grass and stripes, the wet pitch, kits and skin, contact shadows, and the goal replays. They're reviewed in the second pass, from the B3 capture states.

The non-match screens changed after these captures (Tactics v5, M5 screens). They're covered by the M3 second pass and the M7 review, not here.

---

# Second pass (23 Nov)

Screens: the new `docs/screens/M4/` captures from 4a84c2f (13 match states plus all screens, at 1280 and 1920).

## Verdict: not passed yet, but big progress
**Fixed:**
- **B1 lighting:** the pitch is lit and players are visible.
- **B2 clock:** reads `00:00`, and has a formatter with tests.
- **B3 capture pipeline:** it overwrites, uses WebGL, has a brightness guard, and captures 2 sizes and the new match states.
- **M2 Pre-Match:** Matchday 1, named key battles with numbers, Os with numbers and surnames, Theo's line with a reason, and better composition.
- **M3 ticker:** now carries real fixtures, form and medical news.

**Order for Gemini:** fix S1–S4 as one task now (before M5.6 continues), then S5–S10. Recapture, then write `REVIEW REQUESTED: M4 (third pass)`.

## Blockers
**S1. Kits aren't the clubs' colours.** In every capture, both teams wear white or grey, so you can't tell them apart. Apply §9.2 club kits through §14.2 (recolour `Shirt`, `Shorts`, `Socks`; pattern and number canvas). Port Calloway is navy and gold. Use the away kit when the colours clash (§9.2). The capsule/procedural fallback must use the same colours (ART-DIRECTION §3.6). Add a check that the two teams' shirt colours differ by ΔE ≥ 25.

**S2. Players are in the wrong places, and never move.**
- At kick-off, both teams are mixed across both halves. They must stand in their own halves in formation (§14.3 kick-off).
- The 22 players are in **exactly the same spots** in kick-off, goal, replay, afternoon, rain and time-lapse. Either the capture freezes the first frame, or the choreographer isn't driving positions. Check it in live play.
- Captures must show the moment they're named for: players in shape at kick-off, a goalmouth scramble for a goal, and so on.

**S3. Capture states still don't show what they claim.**
- **"goal":** the score is 0–0 and there's no goal banner.
- **"replay":** no letterbox and no replay badge.
- **Half-time:** 1–0, but 0 shots and 0.00 xG.
- **Full-time:** 6–3, 29 shots, man of the match rated 10.0.

These are faked or mismatched states. As asked twice before: **play a real seeded match with the engine, then jump to the event** (the first goal's event time for "goal", its replay for "replay", HT and FT from the same match). The banner, letterbox and stats must come from that match.

**S4. SPEC references are printed in the game's text.** Full-time shows "Match Analysis (SPEC §13.18.12)", and Pre-Match shows "DECISIVE MATCHUPS (SPEC §13.17.7)". Never show spec references, task ids or dev labels to the player ("SHOT MAP (2D PITCH)" too). `grep -rn "SPEC" src/ui` must return only code comments.

## Major
**S5. The floodlight pools show as hard shapes.** The cones draw visible geometric edges and dark wedges on the grass.
- Soften: penumbra 0.35 → about 0.85, widen the angle so the four pools overlap, and raise the hemisphere fill a little.
- The target is even TV lighting, brightest in the middle and slightly darker in the corners (ART-DIRECTION §3.3).
- At night, **a black triangle sits in the middle of the far stand** (between the two blocks under the roof line). Close the gap with stand or roof geometry, or a back wall.

**S6. Grass colour.** It's light lime at night and minty-cyan in the afternoon. ART-DIRECTION §3.5 wants a deep pitch averaging `#3E6B2F` dry, with visible mowing stripes (±6%).
- Check whether the grade gain or saturation is applied twice (the composer plus ACES on the renderer, §14.10), and whether the grass albedo is sRGB-tagged.
- Measure the mean pitch colour in a capture and log it.

**S7. Rain washes out the whole frame.** Grey haze covers everything. Rain adds only `+0.0008` haze density (ART-DIRECTION §3.2). Keep the far stand visible, and the floodlights should streak on the wet grass (§14.10), not fog the air.

**S8. Half-time and full-time are small cards in a big empty dark screen.** **Build them to the new reference `docs/design/fulltime/` (approved by the user 23 Nov); it replaces the description below.**
- They're on-air moments. Make them full-height broadcast panels: a score band with scorers and minutes, the stats in large type, the shot map and the xG timeline side by side, and a man-of-the-match card with his printed portrait.
- Don't over-build: in M6b these move into the dressing room as the panel that sits in the scene (§11.25), so build them as one reusable panel component.

**S9. Name tags on the tactical camera are still unreadable,** about 6 px. Minimum 12 px (Barlow Condensed 600) on a kit-colour chip; on the tactical camera, all players show tags.

**S10. Labels and names:**
- On Pre-Match, "THROUGH THE MIDDLE" still covers a red O (#5): move it into clear space.
- The right drawer is titled "Touchline Intelligence". Call it what it is: **"Theo"**, with his portrait and role.

## Minor
- **N3. Ratings:** a 10.0 rating should be almost impossible (§13.14). Check the rating cap and its spread over a calibration run: the max should be about 9.5, and a 10 very rare.
