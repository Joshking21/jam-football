# Training reference (approved by the user, 23 Nov)

`training.png` is the target; `index.html` is its static source. Build the Training screen (§11.9 v1.7, rules in §12.18) to match it. It's the office world, the same family as the Tactics v5 board and clipboard. Where this file and the SPEC differ, this file wins on layout and look; the SPEC wins on rules and numbers. In M6b the screen is framed on the training ground (§11.25), and the board and clipboard stay the same.

## Left: the week (a whiteboard)
- **Frame:** the same aluminium frame and board surface as Tactics.
- **Header:** "The week", then matchday · opponent (H/A) · kick-off slot. On the right: the template dropdown, and Light / Normal / Hard intensity.
- **Grid:** 7 columns, with weekday names under each day.
  - **Day 1:** Recovery, fixed, spanning both rows, with a hatched background and a "FIXED" tag.
  - **Days 2–5:** a morning and an afternoon slot each.
  - **Day 6:** one tall match-prep slot.
  - **Day 7:** the match block (opponent crest, "v COR", Home/Away, slot).
- **Session magnets:** a white magnet with a 9 px top band in the category colour, the category label, the name in Barlow Condensed 700, a "grows" line, and load pips (filled = load; recovery and rest use pale blue pips). A "THEO" tag shows on sessions Theo placed.
- **Category colours:** Attacking `#C42B2B`, Defending `#1F4FBF`, Fitness `#1E7B3C`, Tactical `#1E2A38`, Set pieces `#C98A12`, Balanced `#7A7062`, Recovery `#5F9FBF`.
- **Marker:** a red bracket under days 5–6, labelled "sharp for Saturday" (the real matchday), drawn on with stroke-dashoffset. It's the §12.18.3 sharpness window.
- **Theo's week:** a yellow sticky note with a pin. Each bullet is one §12.18.4 rule that fired, with its reason. It has **Apply** and the "Let Theo plan every week" toggle. It sits in the free strip under the grid and must never cover a slot.
- **Session library:** a tray along the bottom with every session as a chip (category edge plus load dots). Drag a chip onto a slot, or press Enter on a slot to pick from a list. Dropping onto a filled slot swaps the sessions.

## Under the board: the week in numbers
Four figures:
- **Week load** against 12 balanced, with a meter going green → amber → red and a tick at 12.
- **Average condition on matchday,** with its change.
- **Sharp for Saturday,** shown as category fractions.
- **The squad's average training rating,** with its change.

## Right: the clipboard
- **Tabs:** Players (default), One-to-one, Progress.
- **Players columns:** name with position and age; focus (a small type chip: Role, Attr, Pos, Trait, Mentor, then its value; positions and traits show progress %); workload L/N/H; extra sessions ✓; this week's rating (green ≥ 7.5, red ≤ 5.5) with a 6-week sparkline; injury risk with its reason.
- **Selecting a row** opens his file over the sheet (the Tactics v5 pattern), with attribute arrows and the coach's note (§12.18.8).
- **One-to-one box:** this week's suggestion from Theo, and "Take him aside", which starts the one-to-one scene (§12.18.6, §11.25.5).

## Motion
- Magnets snap with the Tactics spring.
- Applying Theo's week slides the changed magnets in, 60 ms apart.
- The load meter eases to its new value.
- The bracket redraws when day 5 or 6 changes.

Reduce motion: everything is placed instantly.

## Never
A list of radio buttons for the week. Generic cards. A page scroll at 1280×720 (shrink the magnets' "grows" line before anything else).
