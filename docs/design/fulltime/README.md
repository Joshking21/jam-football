# Full-time reference (approved by the user, 23 Nov)

`fulltime.png` is the target; `index.html` is the static source it was rendered from (open it in a browser). Build the Full-Time result screen (§11.18 step 1) to match it. It replaces the small centred card in the M4 captures (REVIEW-M4 S8). Where this file and the SPEC differ, this file wins on layout and look; the SPEC wins on rules and numbers.

## The layout (1920×1080; scale down to 1280×720 with no scroll)
- **Background:** the live 3D match frame behind it, blurred (about 14 px), darkened to about 45%, with a dark gradient toward the bottom. It's a broadcast graphic over the picture, not a page.
- **Kicker line:** a `FULL-TIME` chip (accent, angled right edge), then league · matchday · stadium · attendance · kick-off slot and weather, all real data.
- **Score band:** a home slab in the home primary colour with a secondary-colour bottom rule, angled right edge, crest, club name in Barlow Condensed 800, and nickname · Home. A centre block on warm off-white with the score in 128 px numerals and a result chip under it (`WIN · 3 PTS` / `DRAW · 1 PT` / `DEFEAT`, from the user's point of view). The away slab mirrors it. Faint diagonal stripes on the slabs. Scorers under each slab with minutes (pens marked `(pen)`, own goals `(og)`).
- **Three columns:**
  1. **Man of the match:** a programme-print card (paper colour, tilted −1.6°). The portrait is printed in the club's ink (§18.5; the procedural avatar until fal portraits arrive), with a red circular rating stamp crossing the photo's edge and 4 facts from the match (goals or saves, chances created, passing %, distance). The facts are chosen by position: a GK shows saves and claims, a CB shows tackles and headers won.
  2. **The numbers:** 8 rows of broadcast split bars (home bar in the home accent, away bar in light grey), with the label centred above each bar. Only the better side's number is highlighted, and for fouls and cards, fewer is better (no highlight on those rows). Under it, **"Your XI, rated"**: chips in a 4-column grid with number, surname and rating. The chip colour is gold ≥ 7.5, light ≥ 6.8, grey ≥ 6.3, red below.
  3. **Where the chances came from:** a full-pitch shot map (home attacking right). Dot size is xG, goals have a white ring and their minute, and labels never overlap (nudge them). Under it, **"Expected goals, minute by minute"**: two step-lines with goal markers, an HT divider and the final xG values.
- **Foot:**
  - **The turning point:** one line from real events that ties the result to a decision the user made (a routine, a sub, a shout, a talk), from `content/club.json` templates. If none applies, the most decisive event.
  - **The table:** position, the change, and points.
  - **The primary button:** "To the dressing room" (`Space`). It leads to the full-time talk scene (§11.25.5), then press, then the back page.
- **Ticker:** "FULL-TIME AROUND THE LEAGUE" with the round's other results and one news item.

## Motion (§19.7)
1. The band wipes in from both sides, 440 ms.
2. The score counts up.
3. Scorers tick in 120 ms apart.
4. The stat bars grow from the centre.
5. The xG lines draw left to right.
6. The stamp lands last (scale 1.3 → 1 with `ui_stamp`).

Reduce motion: everything appears at rest.

## Half-time
Same components, lighter:
- the band with `HALF-TIME`
- the numbers (5 rows)
- the shot map and xG so far
- Theo's §15.5 analysis with Apply buttons in place of the MOTM card

The team talk is its own scene (§11.25.5), not a panel here.

## Never
SPEC references or dev labels in the UI ("SPEC §…", "2D pitch"). Fake numbers. A small card in an empty screen.

All names, numbers and colours in the image are **sample data**. Always use the game's real data (club colours from `clubs.data.ts`, targets from the board, and so on).
