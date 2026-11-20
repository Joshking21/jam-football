# M3 design review

Reviewer: Claude · 20 Nov 2026 · Screens: `docs/screens/M3/` (17 screens × 3 widths) · Bar: SPEC §19.8, and the references in `docs/design/hub/` and `docs/design/tactics/` (their READMEs list where they override the SPEC).

## Verdict: not passed yet. M3b engine work may start now.
The engine side of M3 is excellent: task 0 is in, all calibration passes, and there are 80 tests. The screens are a clean, consistent start, and **Tactics already matches its reference well**. To pass, fix the blockers and the Hub rework below, then recapture the screenshots.

**Order for Gemini:**
1. M3b tasks 1–2 (engine + calibration) can run now; they don't touch the UI.
2. Then fix B1–B5 and M1–M8 below, and recapture `docs/screens/M3/`.
3. Then M3b task 3 (new tactics controls) against the updated tactics reference.

Write `REVIEW REQUESTED: M3 (second pass)` in PROGRESS.md when done.

---

## Blockers (must fix to pass)

**B1. Match and Season End screenshots are completely black** (every pixel is the same value at all three widths). Either capture fails on those routes or the screens render nothing. Fix it, and make the capture script fail if an image is a single colour.

**B2. The Hub's hierarchy is upside down.** The League table is the biggest panel and Next match is a small card, which breaks §19.8 ("one dominant card: Next match") and the Hub reference. Rebuild the composition from `docs/design/hub/index.html`:
- Next match spans the full width: home and away sides, the skewed kit-colour slabs, the kick-off time as the big number, date and venue, weather, the last-five form strips, and a foot row with Theo's printed portrait, his line and "Opponent report".
- Row 2: League table (4 columns), Latest news (5, newspaper panel), Inbox (3). Row 3: Squad status (3), Board and fans (4), Assistant tip (5).
- The captains walk in (stand-ins for now; the README explains how). Telestrator marks in the opponent report and on the tip.

**B3. Week Summary: "Matchday 1 results" is an empty panel.** Either the screenshot was taken before a round was played (then capture it after one) or the results aren't wired. Every list needs a designed empty state anyway (§19.8).

**B4. Scouting: every player in the list is from Ironvale Athletic.** Likely a data or filter bug; the list should cover the whole league and free agents (§12.12).

**B5. Fixtures: Veldmoor Town on MD9 and again on MD10.** Check the schedule generator: in a double round-robin a club shouldn't meet the same opponent in consecutive rounds. If it's intended, it needs a test that proves it.

## Major (rework to the references)

**M1. Squad status tiles at 0 waste the most space on the Hub.** Four big boxes saying 0. Make them the compact 2×2 counters from the reference, with zero shown dim ("None").

**M2. Pre-Match: one small panel in the top-left, the rest of the screen empty.** It's an on-air screen: give it one dominant graphic (the opponent report as a broadcast panel with the telestrator pitch from the Hub's opponent report: their shape as Os, their style's arrows, the key battles), with the counter-tactic Apply and the steps (report → selection → talk) as a clear sequence. No empty half-screens.

**M3. Club: the page title is dark on dark** ("PORT CALLOWAY FC CLUB OVERVIEW" is nearly invisible), and the tabs (Finances / Board / Fans / Stadium) are tiny. Fix the contrast (≥ 4.5:1), make the title the H1, and make the tabs paper index tabs like the clipboard dividers in the Tactics reference.

**M4. Inbox: the left pile is a tall empty paper column.** In the office world the inbox is a pile of memos on the desk: stack the items as overlapping memo sheets (slight rotation, the newest on top, it drops onto the pile with `ui_paper`, §19.7), and open the selected memo beside it as a larger sheet.

**M5. Tactics: very close to the reference, three gaps.**
- Instruction choices are filled black buttons. Use the reference's marker style: plain words, the chosen one circled in blue marker, its exact SPEC wording under the row.
- Role movement in marker on the board (overlap runs, cut-ins, pass lines; faint for all, bold for the selected player). I can't see them in the capture; check that they render.
- Add the marker tray under the board and the readiness line on the clipboard (the green banner on top can stay).

**M6. Training: six identical focus cards in a grid.** On a clipboard, make the focus a list of rows with the chosen one circled (as in Tactics), and leave room for the M5 additions (match prep, rest days, role and position training, injury risk; §12.17).

**M7. New Game: the club picker is a strip of tiny tabs.** The club choice is the first impression of the whole game: make the selected club a big broadcast card (crest, name, stadium, reputation, board expectation, budget) and the others a row of crests you can arrow through, with the stinger wipe between clubs.

**M8. Text size at 1920 and 2560.** Content is fixed-size, so at 2560 the screens look empty and small. Let the content grow to the 1600 px max-width (§19.6) and scale type one step up at ≥ 2200 px wide.

## Minor
- Title: hide the "See Asset Gallery (Dev Gallery)" link in production builds.
- League: the Form column is empty pre-season; show a dash, not nothing.
- Hub ticker items repeat the panels ("Board confidence stands at 65%"). Use league news, other results and rumours (§19.5); never repeat what's already on screen.
- Currency: € is correct (SPEC §5). The Hub reference uses £ by mistake; ignore that.

## What's good (keep it)
- One coherent system: tokens, club theming, sidebar rundown with key numbers, top bar.
- Board Meeting as a paper directive: exactly the office feel.
- Squad table: dense, aligned, tabular numbers, filters.
- Tactics: sideways whiteboard, magnets with OVR-at-slot tags, opposition tab, clipboard dividers, presets. Best screen in the build.
- Sacked: clear and well judged.
