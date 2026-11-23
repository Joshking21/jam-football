# Progress log

Newest entries at the bottom. Format: SPEC §23.0 (`docs/spec/23-milestones.md`).
Only the latest entries are kept here; older ones are in `docs/PROGRESS-archive.md` (open it only if you need an old detail).

## 2026-11-22 · M5.4 Player conversations, promises and office dialogue
- Changed: src/content/conversations.json, src/core/types.ts, src/core/player/conversations.ts, src/core/game/advance.ts, src/state/store.ts, src/ui/screens/ConversationModal.tsx, src/ui/screens/InboxScreen.tsx, src/ui/screens/HubScreen.tsx, src/ui/screens/WeekSummaryScreen.tsx, src/App.tsx, tests/core/player/conversations.test.ts
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 30 test files passed (193 tests passed in 32.99s) PASS
    - `vite build`: main chunk 1,262 kB / three.js chunk 490 kB, built in 21.32s PASS
- Notes:
  - Implemented SPEC §12.9, §14.11.3, §16.4 Player Conversations, Promises & Office Dialogue:
    - Authored `src/content/conversations.json` covering all 4 conversation types (`playing_time`, `contract`, `unhappy`, `praise`), each with >= 3 opening lines and 3 replies per opening (36 reply options total). Applied SPEC 1.7 content rules: every manager line and player line has a unique `id` and token-free `voText`. Coach reply lines that name a player utilize `nameSlot: "start"` or `"end"` with exactly one `{player}` token at the boundary. At least 1 of 3 alternatives per opening names a player.
    - Implemented pure module `src/core/player/conversations.ts`:
      - `checkConversationTriggers`: evaluated at WeekSummary (at most 1 conversation per week) covering playing time (<50% starts in completed fixtures while fit -> 60% chance), unhappy morale (<30 -> 40% chance), contract (yearsLeft === 1 and Ambitious or growth >= 3 -> 30% chance), and praise (last-3 avg rating >= 7.5 -> 20% chance). Deterministic token replacement and priority sorting.
      - `applyConversationReply`: resolves chosen manager replies, applying morale deltas clamped to [0, 100], transfer listing flags, contract extensions (+20% wage, yearsLeft = 3), and promise creation (`{ kind: 'Starter', matchesRemaining: 4, startsCount: 0, targetStarts: 2 }`).
      - `evaluatePromisesAfterMatch`: tracks starter status over a 4-match window in `applyMatchResults`. Fulfilling the promise awards +10 morale and sends thank-you dispatch; breaking the promise penalizes morale by -15, sets `transferListed = true`, and logs an urgent memo.
    - Built atmospheric `src/ui/screens/ConversationModal.tsx` office dialogue component featuring desk view, player dossier tab, portrait, dialogue bubbles, tone pills, predicted effects, and resolution feedback.
    - Wired global store, `advance.ts` week processing, and UI entry points in `InboxScreen` (Respond / Speak with Player button on memos), `HubScreen` (Knock at the Office Door banner), and `WeekSummaryScreen` (Player at the Door banner).
    - Added 13 unit tests in `tests/core/player/conversations.test.ts` covering content integrity, SPEC 1.7 voText/nameSlot rules, trigger conditions, reply resolution, and promise lifecycle.

## 2026-11-22 · M5.5 Board confidence, fans mood, and club finances
- Changed: src/config/balance.ts, src/core/types.ts, src/core/game/advance.ts, src/ui/screens/ClubScreen.tsx, tests/core/game/financesAndBoard.test.ts
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 31 test files passed (207 tests passed in 29.32s) PASS
    - `vite build`: main chunk 1,264 kB / three.js chunk 490 kB, built in 13.22s PASS
- Notes:
  - Implemented SPEC §12.7 Board Confidence, §12.10 Finances, and §12.14 Fan Mood:
    - Added comprehensive constants to `BALANCE` in `src/config/balance.ts`: `finances` (weekly TV income €300k, weekly sponsor income by reputation €100k-€400k, ticket price by reputation €26-€45, operating cost per reputation €50k, season-end prize money €20M down to €2M), `board` (match deltas based on opponent reputation and 3+ goal margin, position vs expectation checks from matchday 4, weekly wage and negative balance penalties, warning threshold < 25, praise threshold >= 80, sacking threshold < 12 from MD6), and `fans` (match deltas for home/away win/draw/loss, margin bonus, derby 2x multiplier, weekly drift to 60).
    - Updated `src/core/game/advance.ts`:
      - Calculated attendance using SPEC §12.10 capacity clamp and gate receipts using reputation-based ticket pricing.
      - Updated matchday board confidence adjustment for both home and away clubs factoring in opponent relative reputation and blowout margins.
      - Applied position vs expectation adjustments (+1 / -1 / -3) starting from matchday 4 across all clubs.
      - Integrated weekly financial ledger updates in `runWeeklyProcessing`: TV rights, sponsorship revenue, payroll deductions, and operating expenses.
      - Added board alerts: single warning inbox memo when confidence drops below 25 (`boardWarningSent`), single commendation inbox memo when confidence hits 80+ (`boardPraiseSent`), and sacking trigger (`next.phase = 'Sacked'`) when confidence drops below 12 from matchday 6 onwards.
      - Applied weekly fan mood drift (+/- 1 towards 60).
      - Added prize money disbursement at season end in `computeSeasonEnd`.
    - Updated `src/ui/screens/ClubScreen.tsx` to read exact sponsor and operating cost values from `BALANCE`.
    - Added 14 unit tests in `tests/core/game/financesAndBoard.test.ts` covering player value and wage calculations, weekly ledger and prize money, board confidence deltas and sacking rules, warning/commendation inbox dispatches, fan mood match deltas and derby doubling.

## 2026-11-23 · M4 Design Review Blockers & Second Pass Captures
- Changed: src/config/balance.ts, src/render3d/lights.ts, src/render3d/stadium.ts, src/render3d/players.ts, src/render3d/MatchScene.ts, src/ui/screens/Match/clock.ts, src/ui/screens/Match/ScoreboardBug.tsx, src/ui/screens/Match/playback.ts, src/ui/screens/MatchScreen.tsx, src/ui/screens/PreMatchScreen.tsx, src/ui/components/TelestratorPitch.tsx, scripts/capture-screens.ts, tests/ui/match/clock.test.ts, docs/screens/M4/*
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 33 test files passed (221 tests passed in 21.08s) PASS
    - `vite build`: main chunk 1,321.55 kB (gzip 291.33 kB <= 350 kB budget) / three.js chunk 489.80 kB, built in 10.82s PASS
- Notes:
  - Addressed all blockers and major items from Claude's M4 design review (`docs/design/REVIEW-M4.md`):
    - **B1 (Pitch and players black):**
      - Resolved geometry occlusion in `src/render3d/stadium.ts`: removed the near-stand roof (`hasRoof = false`), eliminating the 118m wide canopy that blocked the broadcast camera gantry sightline (`x = 0, y = 22, z = -62`) to the pitch plane.
      - Tuned physical lighting in `src/config/balance.ts` and `src/render3d/lights.ts`: set `decay = 2` and tuned `candela = 10000` cd per floodlight bank (yielding mean pitch brightness ~120-130/255 across match captures, matching target grass `#3E6B2F`). Confirmed afternoon directional lighting (`brightness: 143.7/255`).
      - Implemented automated pitch luminance guard in `scripts/capture-screens.ts` failing captures if pitch area luminance is below 35/255 (allowing dimmed overlay for modal dialogs).
    - **B2 (Match clock negative values):**
      - Created pure `src/ui/screens/Match/clock.ts` with `formatMatchClock(t, half)`, strictly deriving time from sim seconds (`t >= 0`), clamping at 0, and rendering stoppage time as `45+X` / `90+X`.
      - Added 8 unit tests in `tests/ui/match/clock.test.ts` covering negative clamp, 0, 59, 60, 2700, and stoppage time. Integrated into `ScoreboardBug.tsx`.
    - **B3 (Capture pipeline overhaul):**
      - Built reusable `scripts/capture-screens.ts <milestone> [filter]` using SwiftShader WebGL flags (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`), virtual time budget, and per-run isolated user data directories.
      - Overwrites existing screenshots on every run.
      - Added query param state routing (`?screen=match&state=...`) in `src/ui/screens/MatchScreen.tsx` for all required match moments: `kickoff`, `goal`, `replay`, `halftime`, `fulltime`, `subs`, `drawers`, `tactical`, `freecam`, `afternoon`, `rain`, `timelapse`.
      - Recaptured all 16 core game screens and all 12 match states at 1280x720 and 1920x1080 (75 total screenshots in `docs/screens/M4/`), with every match frame passing the luminance guard.
    - **M1 (Player name tags):**
      - Overhauled `src/render3d/players.ts` name tags: tags are hidden in normal play, appearing only on the active ball carrier or the commentary player (or all players in tactical view / when `Alt` is held). Formatted in Barlow Condensed 600, >= 12px, on kit-colored chips.
    - **M2 (Pre-Match cleanup):**
      - Fixed Matchday 1 display before incrementing in `src/ui/screens/PreMatchScreen.tsx`.
      - Updated `src/ui/components/TelestratorPitch.tsx` with named duels (player vs player with edge indicator per §13.17.7), opposition markers with kit numbers/surnames, and separated label layout.
    - **M4 (Time-lapse radar tracking):**
      - Added gap interpolation in `src/ui/screens/Match/playback.ts` so the radar tracker smoothly follows play during highlight gaps.

REVIEW REQUESTED: M4 (second pass)

## 2026-11-23 · M4 Design Review Third Pass (S1–S10) and Full-Time Redesign
- Changed: docs/screens/M4/*, scripts/capture-screens.ts, src/config/balance.ts, src/core/match/kits.ts, src/core/match/ratings.ts, src/core/math.ts, src/render3d/choreographer.ts, src/render3d/lights.ts, src/render3d/pitch.ts, src/render3d/players.ts, src/render3d/stadium.ts, src/ui/components/TelestratorPitch.tsx, src/ui/screens/DevGalleryScreen.tsx, src/ui/screens/Match/AssistantDrawer.tsx, src/ui/screens/Match/FullTimeModal.tsx, src/ui/screens/Match/GoalBanner.tsx, src/ui/screens/Match/HalfTimeModal.tsx, src/ui/screens/Match/playback.ts, src/ui/screens/MatchScreen.tsx, src/ui/screens/PreMatchScreen.tsx, src/ui/screens/TacticsScreen.tsx, tests/core/match/kits.test.ts
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 35 test files passed (227 tests passed in 22.64s) PASS
    - `vite build`: main chunk 1,301.31 kB (gzip 281.65 kB <= 350 kB budget) / three.js chunk 489.80 kB, built in 12.11s PASS
- Notes:
  - Addressed all items from Claude's second-pass M4 design review (`docs/design/REVIEW-M4.md`):
    - **S1 (Kit Clash & Colours):** Implemented pure kit contrast resolver `resolveMatchKits` in `src/core/match/kits.ts` with CIELAB Delta E >= 25 check in `src/core/math.ts`. Applied outfield shirt sleeves, collar, side trim, sock cuff trim, and tagged shirt canvas texture with `THREE.SRGBColorSpace` for accurate color rendering. Added 4 unit tests in `tests/core/match/kits.test.ts`.
    - **S2 (Kickoff Formation & Player Positions):** Anchored all outfield players strictly inside their own halves (x <= 51.0 in own frame) in `src/render3d/choreographer.ts`, with kickoff taker at (52.0, 34.0) facing opponent.
    - **S3 (Real Seeded Matches for Capture States):** In `src/ui/screens/MatchScreen.tsx`, synchronously simulate match and preload events when `captureState` query param is present. Goal banner persists on goal frame; replay frame shows real goal replay sequence; halftime and fulltime frames render seeded match moments.
    - **S4 & S10 (SPEC Labels & Telestrator Clearance):** Removed all user-facing SPEC labels from modals and screen components. Moved "THROUGH THE MIDDLE" telestrator annotation in `src/ui/components/TelestratorPitch.tsx` to (138, 170), clearing player #5. Replaced assistant drawer header with Theo Vance portrait and title.
    - **S5, S6, S7 (Lighting, Stand Geometry & Grass Albedo):** Softened spotlight penumbra (0.85) and widened cone angle (pi / 3.0), reduced rain opacity to 0.15, added back wall geometry in `src/render3d/stadium.ts` to occlude sky gap under canopy, and set `pitchTexture.colorSpace = THREE.SRGBColorSpace` to restore rich turf hue.
    - **S8 (Full-Time & Half-Time Broadcast Panels):** Rebuilt `FullTimeModal.tsx` and `HalfTimeModal.tsx` to match approved `docs/design/fulltime/` design reference: split-pane broadcast layout, club badges, 128px tabular scoreline, MOTM print card with halftone portrait and rating stamp, 8 split stat comparison bars, player rating grid ("Your XI, rated"), 2D SVG shot map with xG dot scaling, cumulative xG worm chart, and turning point narrative.
    - **S9 (Tactical Camera Name Tags):** Enlarged name tag sprite scale in `src/render3d/players.ts` (>= 12px tall on broadcast and tactical cameras).
    - **N3 (Ratings Calibration):** Softened extreme player match ratings in `src/core/match/ratings.ts` with compression above 9.0 (`9.0 + (r - 9.0) * 0.35`).
    - Recaptured all 13 match states plus `preMatch` at 1280x720 and 1920x1080 via `scripts/capture-screens.ts`, with all frames passing luminance and geometry guards.

REVIEW REQUESTED: M4 (third pass)

## 2026-11-23 · M5.6 Complete transfer windows, scouting, and recruitment suite
- Changed: src/core/types.ts, src/core/game/newGame.ts, src/core/transfers/scouting.ts, src/state/store.ts, src/ui/screens/TransfersScreen.tsx, tests/core/transfers/transfers.test.ts
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 35 test files passed (229 tests passed in 19.85s) PASS
    - `vite build`: main chunk 1,335.81 kB (gzip 290.10 kB <= 350 kB budget) / three.js chunk 489.80 kB, built in 9.61s PASS
- Notes:
  - Implemented SPEC §11.10 Transfers & Scouting, §12.12 Knowledge & Scouting, and §12.13 Transfer Windows according to approved design reference (`docs/design/scouting/`):
    - **Card Index Drawer (Wooden Box):** Left drawer (`.drawer`) with stacked tactile player cards (`.card`), tabbed by position and club code (`.tab`), name, club, age, OVR band (`.o`), and animated knowledge progress gauge (`.kn`). Filterable by Shortlist, Search (real-time name filter), By Position (ALL/GK/DEF/MID/ATT), Free Agents, and Window Offers. Selected card pulls out with blue outline (`#1F4FBF`) and slight translation.
    - **Scout's Report Sheet (Paper Dossier):** Middle paper document (`.pg.paper`) with authentic letterhead ("Scout's report", file number, user club), procedurally-generated SVG halftone portrait (`<HalftonePortrait />`), complete bio data (age, nationality, foot, height, personality, club, season stats, contract duration), position chips with familiarity, trait chips (unlocked at >= 50% knowledge), large OVR band, and potential stars.
    - **Attributes Grid with Hatched Bands:** Two-column attribute display (Technical and Mental/Physical) showing solid base fill plus hatched unknown range for unscouted players, and exact values when fully scouted.
    - **Tactical Verdict & Scout's Notes:** 3-column verdict box evaluating "Would he start?" (against user's starter in that slot), "Asking price (estimate)" (with club valuation context), and "Would he come?" (evaluating reputation, ambition, and loyalty per §12.13.3). Generates characterful scout quotes based on positional playstyle and attributes.
    - **Starter Comparison:** 6 comparative attribute bars (`.cmp`) measuring the target player against the user's starter in that primary slot in blue (`#1F4FBF`) and navy (`#0B1F3A`).
    - **Interactive Modals & Negotiation Flow:**
      - Make an Offer Modal: Stepper fee input (-/+ 5% steps), asking price guide indicator, and budget headroom validation.
      - Contract Negotiation Modal: Weekly wage stepper, contract duration (1-4 years), and promised squad role (Star, Starter, Rotation, Backup). Validates against wage budget headroom and 26-man squad limit.
      - Offers View: Integrated review and resolution for outgoing bids and incoming AI proposals (Accept, Counter, Reject).
    - **Right Rail & Board Requests:** Live window status panel (Closed / Day 1-2 / Deadline Day), advance day action, board wage budget request button (+10% wage budget per §12.13.6), budget meters, active scout assignments with free slot dispatch, and Theo Vance's contextual advice.
    - Added unit tests in `tests/core/transfers/transfers.test.ts` verifying knowledge percentage calculation, new game shortlist initialization, and board wage budget request behavior.




