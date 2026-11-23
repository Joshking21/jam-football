# League reference (approved by the user, 23 Nov)

`league.png` is the target; `index.html` is its static source. Build League (§11.11) to match it. It's an on-air screen in the same family as Week Summary (`docs/design/week-summary/`). Where this file and §11.11 differ, this file wins on layout and look.

- **Kicker:** a `MERIDIAN LEAGUE` chip · "The table" · "after N of 18" · season. Sub-tabs on the right: **Table** (default), **Home / away**, **Form** (the table of the last 5), **Leaders**, **Clubs**.
- **The table** (left, about 1040 px wide):
  - **Each row (66 px):** position (large), movement (▲n / ▼n / –), the club with a 6 px colour bar, name and nickname, P W D L GF GA GD, **Pts** (largest), last-5 form squares with the letters, and **Next** ("v / @ Opponent", day and home or away).
  - **The user's row:** an accent gradient and a 5 px left bar.
  - **Zones:** dashed rules with labels, **TARGET · TOP N** (from the board expectation) in accent and **DANGER · BOTTOM 2** in red.
  - Rows slide on change (FlipList).
- **The race** (right): a bump chart of every club's position after each matchday so far. The user's club is a 5 px accent line with dots; the others are 2.5 px lines in their club colour at 45%. Names are at the line ends, faint target and danger bands are drawn in, and there's one auto annotation on the user's line (the best run: "4 wins in 5", or the worst: "5 without a win").
- **Leaders:** Golden Boot, Assists and Clean sheets, top 3 each, with a club colour tick and code. The user's players get accent numbers.
- **Next round:** all fixtures of the next matchday with the kick-off slot. The user's fixture is in accent; the biggest game gets a note ("top-of-table", "derby", "relegation six-pointer").
- **Ticker:** as on other on-air screens.
