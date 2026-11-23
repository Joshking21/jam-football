# Squad and the player file reference (made 23 Nov at the user's request)

`squad.png` is the target; `index.html` is its static source (it uses the shared `base.css` and `base.js`). Build §11.6 Squad and §11.7 Player Profile to match it. Where this file and the SPEC differ, this file wins on layout and look; the SPEC wins on rules and numbers.

- **Left: the squad list** as a typed team sheet on a clipboard, grouped GOALKEEPERS / DEFENDERS / MIDFIELDERS / FORWARDS under ruled headings.
  - Filter tabs: All, GK, DEF, MID, FWD, Injured n, Unhappy n, Contracts n (1 year left).
  - Columns: number, name + nation code, position chips (primary filled, others outlined), age, OVR badge (colour by band), condition bar (red under 70), morale word (coloured), last-5 form dots (or "no games"), training rating (§12.18.7), contract (1 year in red), value, and status icons (injury +, leader L, captain C, mentor M, overload !, unhappy face).
  - The selected row has a blue left bar and tint. Columns sort on click.
- **Right: the player's file** (manila tab "Surname · No."), which is §11.7, the same component as Tactics and Training:
  - **Header:** printed portrait, name, age · nation · foot · height · personality · leader; position chips with familiarity; trait chips (blue); value · wage · contract · role; big OVR at his best position; potential stars.
  - **Middle:** a RadarChart against his current role, season facts, and condition, morale, training and injury risk.
  - **Attributes:** Technical / Mental / Physical columns with bars. The current role's key attributes are blue and bold, with 4-week up/down arrows (§12.18.8).
  - **Coach's note:** a yellow memo.
  - **Actions:** Talk to him (a talk scene), Training focus, Offer new contract, Make captain, Transfer list.
- In M6b, Squad sits in the dressing room: clicking a locker opens this same file.

All names, numbers and colours in the image are **sample data**. Always use the game's real data.
