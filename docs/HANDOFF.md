# Where we stopped (20 Nov 2026)

## The user's verdict and next request
- The user **loves the Hub and Tactics designs** (the look, the motion, the marker on the whiteboard). Keep this design language. Don't redesign it.
- **New request:** "almost every tactical detail we put into football manager also shows up here… it should be like a football club… detailed just like Football Manager."
  - Meaning: the **depth** of a real management sim (Football Manager is the user's reference point), in every part of the club, not only Tactics. The UI stays ours; we never copy FM's screens or look (jam rule: original work only).
  - Don't re-render or republish the reference pages until the user asks.

## What exists now
| Item | Where | State |
|---|---|---|
| Hub reference | `docs/design/hub/` (index.html + README) | Done. Published at claude.ai/artifact/Pi1Equssdv9rgZnUX1FQPG (v2) |
| Tactics reference | `docs/design/tactics/` (index.html + README) | Done. Published at claude.ai/artifact/S41sfC1X7832svFuawrNmz (v1) |
| AI test plan (fal, Meshy, ElevenLabs) | `docs/design/AI-TESTS.md` | Written. Waiting on API keys in `.env.local` |
| Art direction | `docs/design/ART-DIRECTION.md` | Unchanged |
| Gemini | M3 tasks 1–5 committed; M3 task 0 (tactical depth engine, SPEC §13.17) in progress, uncommitted | It rebuilt the UI before the references existed, so it must rework the UI against them |

Nothing from this session is committed or pushed yet (ask the user first; the repo is public).

## Next steps, in order
1. **Depth audit (Claude, docs only, cheap).** Compare SPEC §11–§15 and §13.17 with the list below. Mark each item as already in the SPEC, missing but worth adding (with a gain and a cost, per the "no free lunch" rule), or too big for the jam. Write the result as a SPEC 1.4 proposal for the user to approve. Keep the engine rules testable by calibration (§13.16, §13.17.10).
2. Once approved, extend the **Tactics reference** to show the new controls, using the same clipboard, whiteboard and marker style. Do the same for any other office screen that gains depth (Squad, Training, Scouting, Club).
3. The user adds the sponsor keys, then run `AI-TESTS.md` in its stated order (M1 and F1 first, then the captain walk-in F5/F6).
4. Tell Gemini (via SPEC and PROGRESS notes) to rework its M3 UI against `docs/design/hub/` and `docs/design/tactics/` once task 0 is finished.

## Candidate depth list for the audit (check the SPEC first; much of this may already be there)
**Tactics**
- Separate line of engagement (where we start pressing) and defensive line; offside trap on/off; pressing trigger intensity.
- In possession: play out of the back vs bypass; work the ball into the box vs shoot on sight; low, whipped or floated crosses; overlap and underlap on each flank; play through the middle vs down the flanks (beyond Focus).
- Out of possession: force them wide or inside (team level), tackling style (stay on your feet vs get stuck in), mark tighter as a team, stop short goal kicks.
- Transition details: goalkeeper distribution target (centre-backs, full-backs, target man, wingers) and speed (slow it down vs quick release).
- More mentality steps (for example 5–7 instead of 3).
- Duty or "how far forward" per role (support/attack style) on top of the role, if it doesn't overload the UI.
- More player instructions: roam, sit narrower, cross from the byline or from deep, more risky passes, tackle harder, mark a specific player.
- Set piece designer: who goes where at corners and free kicks (near post, far post, edge of box, stays back), free kick routines, throw-in routines, defensive set piece assignments.
- Several saved tactics (plan A/B/C) and a quick in-match switch; shape familiarity per instruction, not only per formation.
- Match analysis: pass maps, heat maps, shot maps, xG timeline, where goals came from, so the user sees why a change worked.

**The club**
- Staff: assistant, coaches with ratings, scouts, physio, with hiring and their effect on training, scouting and injuries.
- Training: weekly schedule, unit training (defence, midfield, attack), match prep, individual role training, rest days.
- Squad dynamics: hierarchy (leaders), happiness, promises, social groups, player meetings.
- Medical: injury risk per player, rehab, fitness staff.
- Scouting: scout assignments, reports with knowledge %, a recommendation list.
- Contracts: negotiations with clauses (bonuses, release clause, playing time).
- Youth: academy intake and development.
- Board and media: board requests, press conferences (partly specced), rivalries.

Scope warning: the jam ends 18 Dec. Pick the items that most change matches and decisions. Tactics and match analysis come first, then club systems that feed into matches (training, dynamics, medical). Leave out anything that only adds screens.
