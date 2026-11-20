# Hub reference

`index.html` is an animated, clickable reference for the Hub and the shell around it (top bar, rundown, ticker, transitions). Open it in a browser. Plain HTML/CSS/JS, no build. Build the real screens to match how it looks and moves. Where this file and SPEC §11.5/§19 differ, this file wins. The differences are listed below.

The bar above the game frame is only for the reference: switch club themes, turn on reduce motion, replay the build-in.

## What to copy exactly
- **Tokens:** the `:root` block is SPEC §19.2. Added: `--newsprint` and `--news-ink` (ART-DIRECTION §6.3) for the newspaper panel.
- **Hub composition (12 columns):** Next match runs the full width and is the dominant graphic. Second row: League table (4), Latest news (5), Inbox (3). Third row: Squad status (3), Board and fans (4), Assistant tip (5). At 900 px and under, 6 columns; at 560 px and under, 1 column. Use container queries on the content area, not viewport media queries.
- **Next match card:** a broadcast tab, home on the left and away on the right. Each club has a skewed two-colour slab at the edge in its kit colours. The kick-off time is the big number in the middle. Under it, Theo's line with his printed portrait. After a match, the same card becomes **Result**: score in the middle, scorers under each club.
- **The captains walk in:** each club's captain walks in from his side of the card (1.25 s, easing out), stops beside the slab, folds his arms (0.42 s) and holds, facing the camera. This plays once per matchday; later visits show them already standing. Reduce motion shows them standing straight away. They're hidden when the card is narrower than 780 px. **The figures in this file are stand-ins.** The real ones are rendered from the Meshy player model (`docs/design/AI-TESTS.md`, M1/M2) with its walk and idle clips, tinted to each club's kit and halftoned by a shader at runtime so they match the programme-print look. If arm-folding isn't in Meshy's animation library, they stop and stand in the idle pose with arms down. fal is on hold (budget), so no fal clip.
- **Telestrator marks:** marker strokes that draw themselves, like a pundit's pen. The opponent report has a small pitch showing how they attack (their shape as Os, long-ball or cross arrows from their style, our defender as an X, the key battle circled). The assistant tip has a small sketch of its advice, plus a tick when you press Apply. Strokes are SVG paths with a little seeded wobble, drawn on with `stroke-dashoffset` (300 ms each, 90 ms apart). Ours use `--accent-text`, theirs `--text`.
- **Idle hop:** after 10 s without input, the Continue button gives one small hop (6 px, then 2 px) every 6 s. Nothing else on any screen ever moves to get attention. Off with reduce motion and while a modal is open.
- **Motion:** every timing, easing and order is in the script (`stinger`, `cameraCut`, `acrossDesk`, `buildIn`, `settle`, `moveBlock`, `afterMatchday`, `dropMail`, `setLabel`). Port these into `ScreenTransition`, `FlipList`, `CountUp` and `spring.ts`.
- **After a matchday (the signature moment), in this order:** full-height stinger back to the Hub. At 160 ms the table reorders (700 ms, 30 ms stagger, green/red row flash) while the points count up. At 500 ms each club's new form dot pops in. At 520 ms the new inbox item drops onto the list and the badge pops. At 700 ms the board and fan meters count and their bars grow. The ticker switches to the new results.
- **Continue label:** "Go to match" before the match, "Continue" after it. The label slides up when it changes.
- **Printed images:** the news photo and portraits are halftoned on a canvas (45° screen, dot size from darkness). The canvas scenes are placeholders. The real news photo is a frame from the actual match, printed as newsprint; portraits are procedural programme-print faces (fal is on hold). The look of the panels around them is final.

## Differences from SPEC (these win)
1. ~~The sidebar collapses at 1100 px.~~ **Withdrawn in SPEC 1.6: there is no sidebar.** Navigation is tabs in the top bar (§19.6); the Hub grid below keeps its layout and uses the freed width.
2. **The Hub shows the full 10-row table, not top 3 / your row / bottom 2.** With 10 clubs it fits, and the after-matchday reorder only reads when every row is there.
3. **One primary button.** The top-bar Continue ("Go to match") is the only primary. The Next match card has only "Opponent report" (secondary). Two primaries for the same action broke the "one primary per screen" rule in §19.8.
4. **Rundown hover:** no height growth, because animating height breaks the performance rule in §19.7. Hover shows a background, nudges the label 2 px, and shows the item's number key.
5. **Opponent report opens as an on-air modal** (it wipes in from the left) straight from the Hub.
6. **Marker strokes may animate `stroke-dashoffset`.** It's an exception to the transform/opacity rule in §19.7, allowed only on small SVG marker paths (under 40 on screen at once). It's cheap paint work and nothing else gives the hand-drawn look.

## Not in this reference
Office screens here are placeholder memos that only show the camera cut and how the paper settles. League and Fixtures are simple versions. The Tactics wall gets its own reference in `docs/design/tactics/`. Sound hooks (§19.7) are not wired up.

**Currency:** the reference shows £ by mistake. The game uses € (SPEC §5).
