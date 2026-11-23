# M5 screens review

Reviewer: Claude · 23 Nov 2026 · Screens: `docs/screens/M5/` (Claude's captures of a64e7b5, M5.9, built from the committed code with `scripts/capture-screens.ts`; 9 screens at 1280 and 1920) · Bar: the 23 Nov design references in `docs/design/<screen>/`, which win on layout and look (§11), and SPEC §19.8.

This isn't a milestone gate. It checks the screens M5.6–M5.9 touched against their references while they're fresh, so the fixes don't pile up for M7.

## Verdict
- **Training (M5.8) and Scouting (M5.6) are close to their references.** The whiteboard, magnets, Theo's sticky note, the load strip, the clipboard, the card-index drawer and the scout's report all read as designed. Good work.
- **Club and Squad were touched in M5.7 but not built to their references.** They are still the old generic table and tabbed card, which is the "AI dashboard" look the user rejected.

**Order for Gemini:** fix R1–R3 together with the M4 T1–T5 fixes, before M5b (they share the capture states and the matchday bug). Then do R4–R5 as one task **after M5b and before M6**. Do R6–R12 whenever their screen is next touched, and by M7 at the latest.

## Blockers
**R1. Every capture is preseason, so every screen shows empty data.**
- Matchday 0, 0 apps, every training rating 7.0 with flat lines, every risk Low, every focus "None", a blank newspaper on the Hub, 2 memos.
- The references are all drawn at **MD 8**. A preseason capture can't show whether the screens work.
- **Fix:** add `&state=md8` (or make it the default for screen captures): start a new game with the capture seed, **play 8 real matchdays with the engine** (the user's matches simmed instantly with default tactics), then open the screen. Keep a preseason capture only for Hub and Inbox.

**R2. The matchday is off by one everywhere (with M4 T5).**
- The Hub says "Matchday 0 of 18" and "Saturday · MD 0", Training says "Matchday 0 · v Kestrel Bay (A)", and Scouting says "Matchday 0".
- The match itself is played against Corvallen.
- Matchday is 1-based for the player: the first match is Matchday 1. Fix the one source of truth, then check the Hub, Pre-Match, Training, Scouting and the Inbox, which all show it.

**R3. The top bar fades out on every screen except the Hub.**
- On Training, Scouting, Squad, Club, Tactics and Inbox, the club name, the status chip ("PRESEASON · 8TH · 0 PTS") and the balance are almost invisible.
- If the capture catches a screen transition halfway, wait for it to end before capturing. If the dimming is deliberate, remove it: the top bar is always full strength (§19.6).
- **At 1280,** the club name wraps onto two lines and the Continue button's `Space` chip is cut off (also in the Hub). Fit it on one line: shorten to the club's short name below 1440 wide.

## Major
**R4. Club isn't built to `docs/design/club/`.**
- What's there: a heading, six tabs and one ledger card, with two thirds of the screen empty.
- The reference has the ledger book with the income/outgoings chart, "This week" on the facing page, the boardroom note with confidence and expectation, the pinned staff cards, the dressing-room card, the fans' letters and the stadium attendance.
- Build it to the reference, on one screen with no tabs and no page scroll (§19.6). Every M5.7 feature already has a home in it: staff, the dressing room, cohesion and leaders.

**R5. Squad isn't built to `docs/design/squad/`.**
- What's there: a dark generic table, 0s in every stat column, and a **trophy icon as every player's avatar**.
- The reference is a paper squad sheet grouped by position, with the player's file beside it: printed portrait, radar, season numbers, condition, morale and training, attributes with arrows, coach's note, and actions.
- Keep the M5.7 Leader badge and Risk column, styled like the reference's chips.

**R6. Tactics opens with players out of position.**
- In a 4-3-3: Jaeger (CM) at centre-back, Ingle (RB) as the holding midfielder, and Muoka (RM) at left-back. Their fit badges are red (49–52).
- A new game must start with the AI's best XI for the club's formation (§13.13), with every slot filled by a natural or near-natural player.
- Also: the plan cards read "Plan A / Plan A" (give each a real name, or drop the second line), and the orders column has a large empty gap above "Assistant picks best XI".

**R7. Scout's notes read like generated text.**
- `TransfersScreen.tsx:107–127` hard-codes 8 notes, for example "Intelligent metronome with exquisite passing range… spots penetrative line-breaking passes".
- This is exactly the voice the user rejects. The reference voice is plain and specific: "Quick, direct, and hungry. He drifts inside onto his left and he'll shoot from anywhere. His work rate dips late in games, so don't build your press around him."
- Move the notes to a content file (`src/content/scouting.json`), with lines keyed on position and attribute shape, a `{player}` slot, and the player's real facts (foot, a weak attribute, a trait). **Claude will write the lines**; Gemini wires them up.

**R8. Inbox is part-way to `docs/design/inbox/`.**
- Missing: "The in-tray" title with the count, the filter chips, the letterhead and signature on the open memo, the term box and action buttons (an "Action required" stamp with no action), Theo's margin note, and the desk surface.
- The second memo's header is hidden under the first. Overlap the stack so each memo's kicker and title stay readable, as in the reference.

**R9. The Scouting shortlist starts with 7 players from one club** (all Ironvale). Seed the opening shortlist from at least 4 clubs plus one free agent, with a spread of positions led by the squad's weakest slot.

## Minor
- **R10. Training:** the session library is clipped. Its third row (Recovery, Rest) is cut off and leaves stray chip fragments under the second row, beside an inner scrollbar. Let the tray grow, or wrap it into two full rows as in the reference. The Theo tag is missing on the slots his plan placed.
- **R11. Theo's portrait:** a trophy icon stands in for him on the Hub, the drawers and the inbox. Use the Portrait component everywhere (procedural fallback until the image exists), and the title **assistant coach** (§15).
- **R12. Club ledger figures** mix formats: "+€600,000" next to "+€800K". Use one money format everywhere (`€0.60M` or `€600K`, as in the reference).

## Not reviewed
League, Fixtures, Week Summary, Pre-Match (see M4 T5), the Hub's animated reference, and the set-piece board mode (no capture state reaches it: add `?screen=tactics&mode=setpieces`).
