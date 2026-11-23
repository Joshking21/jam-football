# Fixtures reference (approved by the user, 23 Nov)

`fixtures.png` is the target; `index.html` is its static source. Build Fixtures (§11.12) as a **season wallchart**. It's an on-air screen in the League and Week Summary family. Where this file and §11.12 differ, this file wins on layout and look.

- **Kicker:** a `THE SEASON` chip · club · "18 matchdays" · season.
- **Summary strip:**
  - points so far (and per game)
  - record (W D L)
  - home and away points
  - **The run-in:** a 10-segment bar of the next 10 fixtures, each segment coloured by difficulty
- **Difficulty** comes from the opponent's current position (1–3 very hard, 4–5 hard, 6–7 even, 8 fair, 9–10 easy), adjusted ±1 for home or away and their form.
- **Two rows of 9 tiles** (matchdays 1–9 and 10–18), with a dashed **"Midseason transfer window"** divider between them.
- **Every tile:** the matchday number (large), Home or Away (with a 6 px top edge: accent for home, light for away), the day and kick-off slot with a sun, dusk or moon icon, and the opponent's crest and name.
  - **Played:** a W/D/L badge (green, grey, red), the score, and the user's scorers.
  - **Upcoming:** the opponent's current position and form, and a 5-pip difficulty meter with its word.
  - **Tags:** `DERBY` (red) on derbies. `NEXT` on the next fixture, whose tile gets an accent outline and glow, plus one scouting line from §15.2 ("They're unbeaten in 4. Gil has 6 goals.").
- **Clicking** a played tile opens that match's full-time screen (`docs/design/fulltime/`) as a read-only replay of the result. Clicking an upcoming tile opens the opponent's club page.
- **Ticker:** derbies, the hardest runs, and fixture news.
