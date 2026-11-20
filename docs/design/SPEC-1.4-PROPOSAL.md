# SPEC 1.4 proposal: Football-Manager-level depth

Status: **waiting for the user's approval.** Nothing here is in the SPEC yet. Once approved, Claude writes the chosen items into the SPEC (new sections, types, `balance.ts` keys, calibration checks, UI) and extends `docs/design/tactics/` and the other office references to show them.

## The goal and the constraint
- **Goal (the user, 20 Nov):** "almost every tactical detail" from Football Manager, and a club as detailed as FM.
- **Constraint (SPEC §1):** a full season plays in about 30 minutes. New depth must therefore be **optional**: every new setting starts on a neutral or club-style default, the assistant can set it with one Apply, and a player who ignores it still gets a good game.
- **Rules for every item:** no free lunch (each option has a gain and a cost, both shown in one line); neutral defaults change nothing, so the §13.16 calibration still holds; every engine rule gets a calibration check (§13.17.10 style); no single option moves the win rate between equal teams by more than ±6 points.
- Size estimates for Gemini: **S** (under half a day), **M** (about a day), **L** (2+ days).

## Already in the SPEC (no change needed)
Seven team instructions; roles with fit (§13.17.2); opposition orders (tight mark, double up, press, show inside/outside); transitions (counter-press, regroup, counter, keep it); goalkeeper distribution; corner routines for and against; 12 player instructions; key battles; captain and takers; condition, fatigue, injuries; training focus and intensity, individual focus; development; morale, personalities, team talks, player conversations and promises; finances; scouting knowledge; transfers and bids; shot map and xG timeline; board and fans; press conferences.

---

## Tier A: tactics and match depth (recommended, highest value)

| # | Item | Gain / cost | Size |
|---|---|---|---|
| A1 | **Mentality in 5 steps** (Very defensive, Defensive, Balanced, Attacking, Very attacking). The outer steps double the existing mentality modifiers. | Very attacking: more shots and counters for, far more counters against. Very defensive: the reverse. | S |
| A2 | **Final third: "Work it into the box" / "Shoot on sight" / Mixed** | Work it in: better shots, fewer of them, more turnovers in their box. Shoot on sight: more shots, lower xG each, possession lost. | S |
| A3 | **Crosses: Low / Whipped / Floated / Mixed** | Low: suits quick, small forwards, more blocks. Whipped: more headers on target, more keeper claims. Floated: favours a target man, easy for tall defences. | S |
| A4 | **Offside trap on/off** (team, works with Line) | On: more offsides won against them; a mistimed trap gives a one-on-one. | S |
| A5 | **Tackling: Stay on your feet / Get stuck in / Mixed** (team) | Get stuck in: more tackles won, more fouls and cards. Stay on feet: the reverse. (The same idea exists per player; this is the team default.) | S |
| A6 | **Force them: Inside / Outside / Mixed** (team, out of possession) | Inside: fewer crosses conceded, more central shots. Outside: the reverse. | S |
| A7 | **Time-wasting: Never / When ahead late / Mixed** | Fewer opponent possessions late on, yellows for time-wasting and a crowd mood dip. | S |
| A8 | **Set pieces, extended:** free kicks (shoot direct / cross / short, per zone), corners: in-swinger or out-swinger, and **men back on our corners (1 / 2 / 3)**; their corners: **men on posts (none / near / both)** | More men back: safer from counters, fewer bodies in their box. Men on posts: fewer goals at the posts, more space at the edge of the box. | M |
| A9 | **More player instructions:** Roam from position, Sit narrower, Cross from the byline / from deep, Play riskier passes / Play safe | Each has its own gain and cost line. Same rules as §13.17.11 (max 2 per player, clashing pairs blocked). | S |
| A10 | **Three tactics: Plan A, B, C.** Each is a full setup (formation, roles, instructions, orders). Switch in one click before or during a match (the switch is a normal command, §13.12). The assistant can suggest "Switch to Plan B" in-match. | Familiarity is per plan, so a rarely used plan plays worse. | M |
| A11 | **Familiarity per area, not just per formation:** formation, mentality, passing style and pressing, each 0–100, raised by using them and by Tactical training. | A new idea costs sharpness for a few weeks, so you can't swap everything every match for free. | M |
| A12 | **Match analysis** in Full-Time and Half-Time: heat map per player (from zone weights), pass network (who passed to whom, from events), where our chances came from (left / centre / right, crosses / through balls / set pieces), key battles won and lost. Data only; no engine change. | Pure insight, no cost. It shows why a change worked. | M |

## Tier B: club systems that feed matches (recommended, a smaller set)

| # | Item | Gain / cost | Size |
|---|---|---|---|
| B1 | **Staff:** four roles (assistant Theo, first-team coach, head of scouting, physio), each rated 1–5 stars. In the Club screen you can replace one per window from a short list, at a wage. Coach: development ×0.9–1.15. Physio: injury length ×1.15–0.8 and fatigue hazard. Scout: knowledge gain speed. Assistant: how many tips he gives and how good they are. | Better staff cost wages from the same budget as players. | M |
| B2 | **Match preparation in training:** one slot per week, "Prepare for {opponent}", with options: their set pieces, their press, their wingers. Gives a small bonus against that style for the next match only. | The slot replaces part of the team focus, so growth that week is slower. | S |
| B3 | **Rest days per player** (training screen toggle): +condition, −fatigue | No growth that week; a player rested too often grumbles (morale). | S |
| B4 | **Role training:** individual focus can be a role (it grows the role's key attributes and his fit for it). | Slower general growth. | S |
| B5 | **Dressing room:** a squad hierarchy (2–3 team leaders, picked from personality Leader, age, apps, captaincy) and a team-cohesion meter. Leaders' morale spreads to the squad each week; selling a leader or breaking a promise costs cohesion; cohesion gives a small team-wide decision bonus. | Strong leaders can also turn the dressing room against you. | M |
| B6 | **Injury risk shown per player** (low / medium / high, from condition, fatigue, age and the physio). This is a UI view of numbers the engine already has. | None; it is information. | S |
| B7 | **Scouting assignments:** send the scout to watch a club, a position or a single player for N weeks; reports show knowledge %, strengths, weaknesses and a recommendation. Builds on §12.12. | One assignment at a time; the scout's stars set the speed. | M |

## Tier C: not for this jam (record as stretch only)
- A full drag-and-drop set-piece designer (placing each player for every routine).
- Contract negotiations with clauses (bonuses, release clauses, minutes promises beyond §12.9).
- A youth academy and yearly intake (the game is a single 18-matchday season).
- Social groups, agents, a data hub with custom charts, more competitions, multi-season careers.

---

## What the user decides
1. Approve **Tier A** as a whole, or name the items to drop.
2. Approve **Tier B** as a whole, or name the items to drop.
3. Confirm that Tier C stays out.

Recommendation: take all of Tier A, and B1, B2, B3, B5 and B6 from Tier B. Together that is about 8–10 Gemini days, from about 4 Dec (after M3/M4). Visual polish gives way first if time runs short, as already agreed in §13.17.

## Where each item shows up
- **Tactics wall:** A1–A11 on the clipboard dividers (a new "Final third" row under With ball; offside trap and tackling under Without ball). The set piece divider gets the new rows, and a Plan A/B/C switch sits on top of the clipboard as three paper tabs. New lines get marker on the board (offside trap as a zig-zag on the Line marker; "men back" as Xs at our half).
- **Match:** the A10 plan switch in the tactics overlay; A12 in Half-Time and Full-Time.
- **Training (office):** B2–B4 on the training clipboard.
- **Club (office):** B1 staff as small file cards, B5 hierarchy and cohesion as a pinned sheet.
- **Squad:** B6 as an injury-risk column, plus a leader badge (B5).
