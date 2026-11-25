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

## 2026-11-23 · M5.7 Club depth: staff, match prep, rest days, dressing room, and injury risk
- Changed: src/config/balance.ts, src/core/club/clubDepth.ts, src/core/game/advance.ts, src/core/game/newGame.ts, src/core/match/engine.ts, src/core/types.ts, src/state/store.ts, src/ui/screens/ClubScreen.tsx, src/ui/screens/SquadScreen.tsx, src/ui/screens/TrainingScreen.tsx, tests/core/club/clubDepth.test.ts, tests/core/game/financesAndBoard.test.ts
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 36 test files passed (245 tests passed in 51.67s) PASS
    - `vite build`: main chunk 1,368.11 kB (gzip 298.82 kB <= 350 kB budget) / three.js chunk 489.80 kB, built in 23.66s PASS
- Notes:
  - Implemented Milestone M5 Task 7 (SPEC §12.17 Club Depth):
    - **Staff System (§12.17.1):** 4 technical staff members per club (assistant Theo Vance fixed at 3★, first-team coach, head of scouting, club physio). Starting stars scaled with reputation. Staff wages computed as `1,500 * stars^2` and deducted weekly in finances. Staff replacement flow active during transfer window rounds with candidate generation (3 options per role) and 4 weeks' severance pay to departing staff member.
    - **Match Preparation (§12.17.2):** `SetPieces`, `Press`, `Wingers`, `Shape` options in training schedule. Applies opposition-tailored tactical modifiers during match engine resolution (SetPieces duel modifier -0.12, Press passing bonus +0.15 against High/Mid press, Wingers containment -0.12, Shape formation familiarity +8). Active prep halves team focus bonus and reduces weekly development by 15%.
    - **Rest Days Regime (§12.17.3):** Per-player weekly rest toggle granting +8 condition and -6 fatigue with development paused. Tracks consecutive rest weeks; fit players (condition >= 90) rested 3 consecutive weeks receive morale -5 penalty ("Wants to train") and an inbox memo.
    - **Individual Training (§12.17.4):** Single focus selectable as Attribute (+focus growth), Role (40% development redirected to role key attributes), or Position retraining (familiarity gain per week scaled by coach stars, capped at 95, triggering inbox memo on reaching 85).
    - **Dressing Room Atmosphere & Hierarchy (§12.17.5):** Evaluates top 3 squad leaders by `leaderScore = (Leader ? 30 : 0) + (captain ? 20 : 0) + (Professional ? 8 : 0) + age * 0.8 + min(apps, 40) * 0.5`. Weekly cohesion (0-100, starting at 55 for user) clamped to `[-6, +6]` change, driven by leader morale drift `(mean - 55) / 10`, match results (win +1, loss -1), broken promises (-5), and new signings (-2). Weekly morale spread pulls non-leaders 10% toward leaders' mean morale. In-match execution modifier `(cohesion - 50) / 1000` scales tactical performance across all phases.
    - **Injury Risk Assessment (§12.17.6):** Display-only Low / Medium / High hazard calculation derived from condition deficit, fatigue load, and physio stars, displaying specific risk factors (Age 30+ load recovery, high fatigue, match conditioning deficit). Rendered as chips in Squad and Training screens.
    - **UI Screen Updates:**
      - `ClubScreen.tsx`: Added `DRESSING_ROOM` tab (cohesion meter, tactical execution modifier, 3 leaders cards, cohesion event history) and `STAFF` tab (4 staff cards with star ratings, wage breakdown, perks, and interactive replacement candidate modal). Included staff payroll in `FINANCES` tab ledger.
      - `TrainingScreen.tsx`: Integrated interactive Match Preparation selector with mechanic breakdown and cost warning, squad individual training table with rest day toggles, grouped focus select (Attribute, Role, Position with current familiarity), and injury risk chips.
      - `SquadScreen.tsx`: Added `LEADER` badge on top 3 squad leaders and dedicated `Risk` column with Low/Med/High chips and hover reasons.
    - Added comprehensive unit test suite in `tests/core/club/clubDepth.test.ts` (16 tests covering all pure logic, formulas, clamping, and edge cases).

## 2026-11-23 · M5.8 Detailed training system: planned week, session library, personal plans, ratings, and screen redesign
- Changed: src/config/balance.ts, src/content/conversations.json, src/core/game/advance.ts, src/core/people/training.ts, src/core/player/condition.ts, src/core/player/conversations.ts, src/core/player/development.ts, src/core/player/injuries.ts, src/core/types.ts, src/core/world/generateWorld.ts, src/state/store.ts, src/ui/screens/TrainingScreen.tsx, tests/core/training/trainingDetail.test.ts
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 37 test files passed (262 tests passed in 31.44s) PASS
    - `vite build`: main chunk 1,412.37 kB (gzip 309.77 kB <= 350 kB budget) / three.js chunk 489.80 kB, built in 20.95s PASS
- Notes:
  - Implemented Milestone M5 Task 8 (SPEC §12.18 Training in detail, approved by the user 22 Nov) according to the approved design reference (`docs/design/training/`):
    - **Session Library & Week Schedule (§12.18.1, §12.18.2):** Created `src/core/people/training.ts` with 17 session definitions spanning 7 categories (Attacking, Defending, Fitness, Tactical, SetPieces, Balanced, Recovery). Structured weekly grid: Day 1 fixed recovery (for >= 60' players; others do small-sided game), Days 2–5 morning and afternoon (8 free slots), Day 6 single match prep slot (Opponent prep, Shape work, Set pieces, Video, Light), Day 7 matchday block.
    - **Week Load & Sharpness Mechanics (§12.18.3):**
      - `weekLoad` = Day 1 recovery (-2) + sum of 8 free slots + Day 6 (default Balanced week = 12).
      - Condition recovery between matchdays adjusted by `+ K.train.loadCond * (12 - weekLoad)` (+0.6 per point). Training injury probability scaled by `weekLoad / 12`.
      - Development volume factor `0.6 + 0.05 * trainingSessions` (where `trainingSessions` are free slots not Rest or Recovery). Attribute candidates derived from session Grows union weighted by position OVR weights.
      - Sharpness window (Days 5–6): Computes category fractions over the 3 slots, applying proportional next-match category bonuses.
    - **Templates & Theo's Recommendation (§12.18.3, §12.18.4):**
      - 8 pre-built templates: Balanced week (default), Tactical, Physical, Attacking, Defensive, Opponent, Recovery, and Custom.
      - `generateTheosWeek`: Auto-detects fatigued starters (> 50 fatigue) to swap load-3 drills for Recovery, boosts Shape work on Day 5 when familiarity is below 70, counters opponent set-piece aerial threats (heading >= 75), and plans Day 6 opponent prep from opponent tactical style. Supports "Let Theo plan every week" auto-advance toggle.
    - **Personal Training Plans & Mentoring (§12.18.5):**
      - Workload control: Light (growth x0.8, injury x0.6, condition +3/wk), Normal, Heavy (growth x1.15, injury x1.6, condition -3/wk, rating +0.2).
      - Extra sessions toggle: Growth x1.15, fatigue +4/wk, injury x1.3, rating +0.2, with a 30% weekly skip chance for Relaxed and Temperamental personalities (morale -3 penalty, "Didn't fancy it").
      - Mentoring pairs (up to 3 pairs): Senior mentor (Leader or age >= 28 Professional) drifts mentee's (age <= 21) morale 20% toward mentor's and grants x1.08 development; mentor development x0.9; mentee morale -6 if mentor loses place for 3 matches.
    - **One-to-One Sessions (§12.18.6):**
      - Weekly 1-on-1 session scene on the training ground with 4 session types: Technique work (growth x1.25 on individual focus), Confidence talk (+6 morale if < 50, +2 otherwise, scaled by personality), Fitness work (+6 condition, -4 fatigue), Video of last match (+0.05 decision-weighted contests ctx).
      - Favourites penalty: Picking the same player 3 weeks running reduces dressing room leaders' morale by -2 and triggers an inbox memo.
    - **Weekly Training Ratings & Conversation Trigger (§12.18.7):**
      - Weekly 1.0–10.0 player training rating based on personality, morale, condition, workload, extra sessions, and normal distribution noise. Ratings >= 7.5 grant development x1.05 and morale +1; ratings <= 5.5 reduce development to x0.95.
      - Added new conversation trigger `training_well` ("Training well, not playing"): Fires at 50% chance when a player sustains >= 7.5 rating for 3 consecutive weeks while starting < 50% of matches. Added 3 openings x 3 replies in `src/content/conversations.json`.
    - **Progress Tracking & Physio Overload Monitoring (§12.18.8, §12.18.9):**
      - Tracks 4-week attribute snapshots with ▲ / ▼ progress indicators, season OVR line, 6-week rating sparklines, and contextual coach's notes from `src/content/training.json`.
      - Identifies overloaded players (fatigue > 60 without Light workload, or extra sessions with fatigue > 50) and sends physio inbox memo with ease-off guidance.
    - **Training Screen Redesign (`src/ui/screens/TrainingScreen.tsx`):**
      - Rebuilt to match `docs/design/training/`: Aluminum frame whiteboard on left with interactive magnets, category color bands, load pips, "THEO" recommendation chips, drawn red "sharp for Saturday" bracket, yellow Theo sticky note with pin and one-click Apply, and bottom session library tray.
      - Load strip under board: Week load meter (green-amber-red with marker at 12), matchday condition forecast, sharpness category breakdown, and squad average rating.
      - Clipboard on right: Players tab (player table with workload L/N/H segmented controls, extra checkboxes, sparklines, risk badges, and one-to-one recommendation callout), One-to-one tab (interactive session dialogue scene), and Progress tab (4-week attribute delta arrows, coach's notes, mentoring pair assignments).
    - Added unit test suite in `tests/core/training/trainingDetail.test.ts` (17 tests covering all calculations, formulas, templates, Theo generation, and conversation triggers).

## 2026-11-23 · M5.9 Set pieces in detail: routines, jobs, takers, whiteboard, and tactical resolution
- Changed: src/config/balance.ts, src/core/game/advance.ts, src/core/game/migrations.ts, src/core/match/aiManager.ts, src/core/match/engine.ts, src/core/match/fouls.ts, src/core/match/setPieces.ts, src/core/match/shots.ts, src/core/match/state.ts, src/core/types.ts, src/core/world/generateWorld.ts, src/render3d/choreographer.ts, src/ui/screens/MatchScreen.tsx, src/ui/screens/PreMatchScreen.tsx, src/ui/screens/TacticsScreen.tsx, tests/core/match/setPiecesDetail.test.ts
- Ran:
  - `npm run check`:
    - `prettier --check .` PASS
    - `tsc --noEmit` PASS
    - `vitest run`: 38 test files passed (272 tests passed in 24.89s) PASS
    - `vite build`: main chunk 1,464.30 kB (gzip 321.36 kB <= 350 kB budget) / three.js chunk 489.80 kB, built in 13.21s PASS
- Notes:
  - Implemented Milestone M5 Task 9 (SPEC §13.20 Set pieces in detail, approved by user 22 Nov):
    - **Corner jobs & auto assignment (§13.20.1):** 7 job types (`nearPost`, `farPost`, `penaltySpot`, `keeperScreen`, `edge`, `short`, `stayBack`) with capacity limits. Aerial header candidates strictly drawn from box jobs (`nearPost`, `farPost`, `penaltySpot`). Auto-job generator assigns best 2 aerial threats by S_air to target zone, next best to other post, best long shooter to edge, and slowest defenders to stayBack.
    - **Routines, predictability & sharpness (§13.20.2):** Up to 3 routines per side (`leftCorners`, `rightCorners`) with targets (`Near`, `Far`, `Spot`, `Short`, `Mixed`), swing selection, user naming, and Pick/Rotate execution. Predictability penalty adds +0.04 * (n - 1) to defending header duel (capped at +0.12). Routine sharpness delivery context `(familiarity - 70) / 300` (range ±0.1). Weekly familiarity updates in `advance.ts` (+15 split equally across routines in use for each practice session; unpractised routines decay by 5 down to 40).
    - **Takers and swing (§13.20.3):** Left corner, right corner, direct free kick, wide free kick, penalty taker order (1, 2, 3), and long throw. Natural swing derived from footedness; forcing swing against natural foot incurs -0.08 delivery context penalty (`forcedPenaltyDeliveryCtx`).
    - **Free kicks by area (§13.20.4):** Central options within 30m (`Shoot` with 85% DIRECT_FK, `CrossNear`, `CrossFar`, `Short`, `Dummy` with xG +0.02 and 20% mistimed recycle, `Mixed`). Wide options (`CrossNear`, `CrossFar`, `ToTheSpot`, `Short`, `Mixed`) re-using box jobs. Deep options (`Quick` with +0.3 progress / 15% rushed turnover, `Long` cross from deep, `Keep`).
    - **Defending set pieces & walls (§13.20.5, §13.20.6):** Corners against marking options (`Zonal`, `ManMark`, `Mixed`), Mark their main man (`markMainMan`), Post men (`None`, `Near`, `Both`), Edge guard (reduces second ball by 10 pts), and Forwards up (0, 1, 2, scaling clearance counter chance up to 35%). Free kick wall options (`Auto`, `Small`, `Big`) with composition bonus from mean heading & strength. Line height on wide FK (`High` with 20% offside, `Normal`, `Deep`).
    - **Tactics screen whiteboard & clipboard sheet (§13.20.7):** Dedicated set-piece whiteboard camera zoom into attacking box or defending box. SVG chalk drawings for curved delivery arcs, run arrows to jobs, and edge shot arrows. Interactive job circles with click/swap player assignment. Clipboard sub-tabs for Our Corners, Their Corners, Our Free Kicks, Their Free Kicks, Takers, familiarity gauge bars, and Gain / Cost trade-offs on every option.
    - **Broadcast report & Assistant advice (§13.20.9):** Pre-Match screen card displaying opponent set-piece aerial threat, target zone, recommended marker & posts with 1-click apply. In-match assistant advice tracking read corner routines and box aerial dominance.
    - Added unit test suite in `tests/core/match/setPiecesDetail.test.ts` (10 tests covering auto-job generation, predictability caps, sharpness delivery context, swing and footedness penalties, free kick tactical branches, wall formulas, corner resolution, default creation, and weekly routine familiarity updating).







## 2026-11-24 · Calibration tuning pass 3, Commentary strip, Club & Squad rebuilds, M4/M5 review items
- Changed: src/config/balance.ts, src/core/match/{actions,engine,setPieces,shots,commentary}.ts, src/core/game/newGame.ts, src/state/store.ts, src/ui/screens/{ClubScreen,SquadScreen,InboxScreen,MatchScreen,PreMatchScreen,HubScreen,TrainingScreen,TacticsScreen}.tsx, src/ui/screens/Match/{GoalBanner,FullTimeModal}.tsx, src/ui/components/TopBar.tsx, scripts/capture-screens.ts
- Ran:
  - `npm run format:check`: All matched files use Prettier code style! PASS
  - `npm run typecheck`: 0 errors PASS
  - `npm run test`: 41 files / 288 tests PASS (0 failures)
  - `npm run build`: built in 25.59s, main chunk 373.73 kB gzip (physics chunk 1.65 MB gzip, lazy) PASS
  - `npm run calibrate`: Baseline (goals 2.48, home win 43.6%, draw 24.6%, away win 31.8%, 0-0 6.4%, sim 15.54 ms) ALL PASS; Depth 1 (max diff ±5.8% pts) ALL PASS; Depth 2 (menBack corners +20.2%, counters +106.4%, familiarity drop 7.6 pts) ALL PASS; Depth 3 (opp DEF 3rd ball wins +36.9%, fatigue PASS, w_high counters +37.3%, dm_drop opp through balls -34.3%, cb_step vs cb_cover tackles +31.4%, no dominant choice ±4.0% pts) ALL PASS
- Notes:
  - **Calibration Tuning:** Re-tuned engine balance in `src/config/balance.ts` and `src/core/match/engine.ts`. Baseline, Tactical Depth 1, Depth 2, and Depth 3 all pass every target. Draw rate 24.6% (target 24–28%), 0–0 rate 6.4% (target 6–10%), opp DEF third ball wins +36.9% (target +30% to +90%), dominant choice delta <= ±5.8% (target <= ±6.0%).
  - **Commentary Strip (T9):** Built `src/core/match/commentary.ts` resolving all 42+ match event types against `src/content/commentary.json`, with player name substitution, weather tokens, scoreline context, and importance weighting. Wired into `MatchScreen.tsx` commentary strip.
  - **Club Screen Rebuild (R4):** Rebuilt `src/ui/screens/ClubScreen.tsx` matching `docs/design/club/` (open ledger book with weekly balance, SVG bar chart, handwritten blue memo, facing page line items, stadium attendance bars, boardroom letter with sack line at 25%, 4 pinned photo staff cards with candidate hiring modal, dressing room cohesion meter with leaders and reasons). Single screen, no tabs, no vertical page scroll.
  - **Squad Screen Rebuild (R5):** Rebuilt `src/ui/screens/SquadScreen.tsx` matching `docs/design/squad/` (left team sheet grouped by GK/DEF/MID/FWD with filter tabs and sorting; right player dossier manila folder with portrait, meta, position chips, trait chips, big OVR + potential stars, RadarChart against role benchmark, season stats, condition/morale/risk, 3-column attribute bars with 4-week delta arrows, yellow coach memo, and action buttons).
  - **Review Items Batch (M4/M5):** T4 (stats & scorers filtered by `t <= currentT` and `t <= 2700` at half-time), T5/R2 (1-based matchday target lookup fixing preseason fixture display), T8 (replay badge on top letterbox bar during replay), T11 (fulltime modal compact fit at 1280), T12 (real out-of-town live scores from league schedule), T13 (rolling xG momentum chart), R1 (`&state=md8` simulated 8 matchdays for captures), R3 (opaque top bar, club name ellipsis at 1280), R6 (AI Best XI lineup initialization for all clubs), R8 (Inbox in-tray filter tabs, overlapping stack, sender badge borders, terms box), R9 (initial scout shortlist seeded from >= 4 clubs plus 1 free agent).

## 2026-11-24 · M5.11 Injury and discipline decisions
- Changed: src/config/balance.ts, src/core/club/clubDepth.ts, src/core/game/advance.ts, src/core/game/newGame.ts, src/core/match/commands.ts, src/core/match/engine.ts, src/core/match/state.ts, src/core/people/incidents.ts, src/core/player/injuries.ts, src/core/types.ts, src/state/store.ts, src/ui/components/DisciplineIncidentModal.tsx, src/ui/components/RushBackModal.tsx, src/ui/components/WarmupScareModal.tsx, src/ui/screens/Match/KnockChoiceCard.tsx, src/ui/screens/ClubScreen.tsx, src/ui/screens/HubScreen.tsx, src/ui/screens/InboxScreen.tsx, src/ui/screens/MatchScreen.tsx, src/ui/screens/PreMatchScreen.tsx, src/ui/screens/SettingsModal.tsx, src/ui/screens/SquadScreen.tsx, src/ui/screens/WeekSummaryScreen.tsx, tests/core/game/advance.test.ts, tests/core/people/decisions.test.ts
- Ran:
  - `npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"`: All matched files use Prettier code style! PASS
  - `npx tsc --noEmit`: 0 errors PASS
  - `npm test`: 42 files / 299 tests PASS (0 failures)
  - `npx vite build`: built in 14.40s, main chunk 381.90 kB gzip (physics chunk 1.65 MB gzip, lazy) PASS
  - `npx tsx scripts/calibrate.ts --matches 100`: All baseline metrics PASS (goals 2.46, home win 43.0%, draw 28.0%, away win 29.0%, 0-0 7.4%, sim 16.54 ms)
- Notes:
  - Implemented Milestone M5 Task 11 (SPEC §12.19 Injury Decisions & §12.20 Discipline Incidents, v1.7):
    - **In-Match Knocks (§12.19.1):** `KNOCK` dead-ball match event emitted with physio assessment percentage read (`70% + 5% * (physioStars - 1)`, clamped 70–90%). Interactive Choice Card (`KnockChoiceCard.tsx`) with 3 tactical choices:
      - *Take off:* Condition -10, immediate substitution, no matchday layoff.
      - *Play on:* Normalised skill scores -0.3 z-units (-7.5 attrs), in-match hazard ×4, severity roll stepped up one level if injured later.
      - *Carry to half-time:* In first half only, carry-on rules until 45:00, automatic substitution at half-time without consuming an in-play substitution window (`inPlayWindowsUsed` untouched).
      - Match command `KnockCommand` with rewind support. Settings support (`ask`, `always_off`, `play_on_if_late`).
    - **Rushing Players Back (§12.19.2):** Triggered when `p.injury.matchdaysOut === 1`. Manager choice modal (`RushBackModal.tsx`) with Theo Vance dialogue. 'Give him the week' heals naturally. 'Risk him' sets condition to 70 and 'Not fully fit' badge; next 2 matches hazard ×3 scaled by physio factor (`1.2 - 0.08 * stars`), skill -0.1 z-units (-2.5 attrs). Breakdown recurrence sets duration `ceil(original * 1.5)`, fan mood -1, and Theo memo in inbox.
    - **Warm-Up Scares (§12.19.3):** 3% starter chance, doubled if fatigue > 50, scaled by ×0.7 with 4–5★ physio. Choice card (`WarmupScareModal.tsx`) in Pre-Match: 'Start him anyway' (condition -5, match hazard ×2.5, skill -0.1 z-units) vs 'Leave him out' (lineup swap with bench, player morale -2).
    - **Discipline Incidents (§12.20):** Priority hierarchy: `sent_off` (100% on red cards) > `bust_up` (cohesion < 45, 10% chance with Temperamental player) > `press_mouth` (unhappy player, 30% chance) > `late_training` (1.5% base). Max 1 incident per week across squad. Continue flow blocked at WeekSummary until resolved.
    - **Choices & Consequences (§12.20.2):** Fine (1-2 weeks wages deducted from player and paid into club balance; repeat temperamental fine triggers transfer request; star player fine triggers press news article), Drop (dropped from squad, morale loss, cohesion +1), Warn (warning multiplier recorded for 4 weeks), Let Go (squad leader morale -3, cohesion -2).
    - **6-Week Consistency Rule (§12.20.2):** Tracks recent punishments over a 6-week window. Unequal punishment for the same incident type across squad members triggers cohesion -4 penalty and captain memo in inbox.
    - **Player Dossier & UI Updates:** Integrated 'Not fully fit' badge and Disciplinary & Injury Record into `SquadScreen.tsx` dossier; wired modals into `HubScreen.tsx`, `WeekSummaryScreen.tsx`, `PreMatchScreen.tsx`, and `MatchScreen.tsx`; knock response preference added to `SettingsModal.tsx`.
    - Added unit test suite `tests/core/people/decisions.test.ts` (11 tests covering all formulas, knock commands, half-time substitution rules, rush-back offers, warm-up scare probabilities, fines, consistency rule, and advance blocking).

## 2026-11-24 · M6.1 Assistant coach advice engine (Theo Vance)
- Changed: src/config/balance.ts, src/core/people/assistant.ts, src/state/store.ts, src/ui/screens/HubScreen.tsx, src/ui/screens/PreMatchScreen.tsx, src/ui/screens/MatchScreen.tsx, src/ui/screens/Match/AssistantDrawer.tsx, src/ui/screens/Match/HalfTimeModal.tsx, src/ui/screens/PostMatchScreen.tsx, tests/core/people/assistant.test.ts
- Ran:
  - `npx vitest run tests/core/people/assistant.test.ts`: 1 file / 8 tests PASS (0 failures)
  - `npx prettier --check`: All matched files use Prettier code style! PASS
  - `npx vite build`: built in 14.90s, main chunk 390.08 kB gzip PASS
- Notes:
  - Implemented Milestone M6 Task 1 (SPEC §15 The assistant coach):
    - **Advice Engine (`src/core/people/assistant.ts`):** Pure `advise(context, rng)` dispatcher supporting `preMatch`, `week`, `inMatch`, `halfTime`, and `postMatch` contexts, resolving variants and `{player}`, `{lane}`, `{opponent}` tokens from `src/content/assistant.json` with all thresholds in `BALANCE.assistant`.
    - **Pre-Match (§15.2) & Week Tips (§15.3):** Up to 3 priority-sorted pre-match recommendations (`pre_stay_compact`, `pre_take_game`, `pre_go_in_behind`, `pre_play_out_quick`, `pre_attack_weak_side`, `pre_cb_reassure`) with individual Apply + "Apply All" in `PreMatchScreen.tsx`. Weekly tips (`week_rest`, `week_train_tactical`, `week_light_training`, `week_talk_unhappy`, `week_give_minutes`, `week_positive`) wired into `HubScreen.tsx`.
    - **In-Match Rules (§15.4):** Evaluated every 5 match minutes over a 15-minute trailing event window (max 6 per match, 20-minute per-rule cooldown) covering flank exposure (`fb_defensive` / `Narrow`), pressing fatigue, crossing vs tall CBs, high line offsides, tired player sub (`<58` cond), second-yellow risk sub, 70'+ chasing goal, 80'+ see it out, and <35% direct possession. Wired into `MatchScreen.tsx` & `AssistantDrawer.tsx` with live `MatchCommand` Apply and Dismiss buttons.
    - **Half-Time & Post-Match (§15.5):** Half-time xG comparison, danger man press, and worst-starter sub bullets wired into `HalfTimeModal.tsx`; post-match expectation/MVP/deciding-stat summary and recommended next-week training focus Apply wired into `PostMatchScreen.tsx`.
    - **Store Action:** Added `applyAdviceAction(action)` in `src/state/store.ts`.
    - **Unit Tests:** Added `tests/core/people/assistant.test.ts` (8 tests verifying all rule families, cooldowns, caps, live match command application, half-time, and post-match analysis).

## 2026-11-25 · M6.2 Audio engine, buses, crowd danger mix, and procedural synthesis
- Changed: src/config/balance.ts, src/audio/{types,synth,ducking,ambience,engine,matchAudio,index}.ts, src/state/store.ts, src/App.tsx, src/ui/screens/MatchScreen.tsx, src/ui/screens/SettingsModal.tsx, tests/audio/audio.test.ts, tests/core/people/decisions.test.ts
- Ran:
  - `npx prettier --check`: All matched files use Prettier code style! PASS
  - `npx vitest run tests/audio/audio.test.ts`: 1 file / 16 tests PASS (0 failures)
  - `npx vitest run`: 44 test files / 323 tests PASS (0 failures)
  - `npx vite build`: built in 47.42s, main chunk 397.03 kB gzip (physics chunk 1.65 MB gzip, lazy) PASS
- Notes:
  - Implemented Milestone M6 Task 2 (SPEC §17 Audio):
    - **Audio Engine & Routing Buses (§17.1):** Single Web Audio `AudioContext` created and unlocked on user gesture. Hierarchical gain bus routing (`master` -> [`music`, `crowd`, `commentary`, `sfx`]). Dynamic volume sync with `settings.audio` (`master`, `music`, `crowd`, `commentary`, `effects`, `voice` mute toggle). AudioBuffer caching with silent skip on missing manifest files.
    - **Music System (§17.2):** 1.5s crossfading for `title_theme` (TitleScreen), `menu_loop` (-6 dB across all management screens), clean stop during matches, and `season_end`. Complete procedural chord pad/drone synthesizer fallback when mp3 assets are absent.
    - **Match Crowd & Danger Mix (§17.3):** Dynamic crossfading between calm and tense crowd loops derived from match ball coordinates: `danger = 0` (own DEF third) -> `1` (opponent penalty box), smoothed over 1.5s. Home-side attack swell (+3 dB). Random chant generator scheduled every 60–120s.
    - **Spatial Panning & SFX (§17.3, §19.7):** Ball kicks spatially panned relative to camera center via `StereoPannerNode` clamped strictly to `[-0.6, 0.6]`. Dedicated procedural synthesizers for all match cues (short/long/FT whistles, kick pass/shot, header thud, post ping, net rustle, goal roars with -8 dB away attenuation, groan on woodwork/miss, ooh on keeper save, boo on foul) and UI motion sounds (`ui_click`, `ui_confirm`, `ui_error`, `ui_whoosh`, `ui_tick`, `ui_clack`, `ui_paper`, `ui_stamp`, `notification`, `camera_shutter`).
    - **Voice Ducking (§17.4):** Pure gain ramping ducking crowd by -6 dB and music by -10 dB during spoken lines and assistant stingers.
    - **Room Ambience (§17.5):** 0.6s crossfades between room loops (`exterior`, `corridor`, `office`, `boardroom`, `dressing`, `tunnel`, `training`, `press`) balanced at -18 dB against UI sound effects.
    - **UI & Match Integration:** Wired into `App.tsx` (lifecycle & screen routing), `MatchScreen.tsx` (playback event hooks & real-time ball position danger tracking), `SettingsModal.tsx` (real-time volume slider adjustment), and store dispatch.
    - **Unit Tests:** Authored `tests/audio/audio.test.ts` (16 tests verifying bus routing, volume scaling, ducking attenuation, procedural sound synthesis, spatial pan clamping, danger progression from defensive third to penalty box, event dispatching, and offline fallback).


## 2026-11-25 · M6.3 Commentary voice queue, voice chaining, preemption and ducking
- Changed: src/audio/engine.ts, src/audio/voiceQueue.ts, src/audio/index.ts, src/core/match/commentary.ts, src/ui/screens/MatchScreen.tsx, src/ui/screens/Match/CommentaryStrip.tsx, tests/audio/audio.test.ts
- Ran:
  - `npx prettier --check "src/audio/**/*.{ts,tsx}" "src/core/match/commentary.ts" "src/ui/screens/MatchScreen.tsx" "src/ui/screens/Match/CommentaryStrip.tsx" "tests/audio/audio.test.ts"`: All matched files use Prettier code style! PASS
  - `npx vitest run tests/audio/audio.test.ts`: 1 file / 21 tests PASS (0 failures)
  - `npx vite build`: built in 49.54s, main chunk 398.21 kB gzip (physics chunk 1.65 MB gzip, lazy) PASS
- Notes:
  - Implemented Milestone M6 Task 3 (SPEC §17.4 Spoken commentary and voice queue):
    - **Voice Queue System (`src/audio/voiceQueue.ts`):** Priority queue with importance weighting (1: normal events, 2: key events/cards/saves, 3: goals/red cards, 4: urgent safety). 150ms gain fade-out preemption (`BALANCE.audio.voiceFadeOutMs`) when higher-importance line arrives.
    - **Staleness Drop Rule:** Automatically discards queued lines that are older than 3 sim seconds (`BALANCE.audio.voiceMaxDropAgeSimSec`) at the moment playback starts.
    - **Voice Chaining (§17.4, §16.3):** Handles `nameSlot: 'start'` and `'end'` by prepending/appending player name audio (`audio/vo/names/{playerId}.mp3`) with seamless buffer concatenation or sequential scheduling. Chains out-of-town goal (`OTHER_GOAL`) clips with club name audio (`audio/vo/clubs/{clubId}.mp3`).
    - **Caption Synchronization & Procedural Speech Fallback:** Subscribed caption state updater emits live caption lines matching exact spoken timing. When audio files are missing, generates procedural speech cadence (~5 syllables/second, comma 150ms pause, period 300ms pause) and feeds simulated mouth loudness to `AnalyserNode` for 3D face animation.
    - **Voice Ducking Automation:** Automatically ducks crowd bus by -6 dB and music bus by -10 dB over 100ms when speech starts, restoring original levels over 400ms when speech finishes.
    - **Commentary Resolution Integration:** Updated `src/core/match/commentary.ts` to expose full `ResolvedCommentary` payload including importance, nameSlot, voice actor, and player/club audio cues.
    - **Match Integration:** Wired `voiceQueue.speakCommentary()` and `voiceQueue.updateSimTime(ev.t)` into `MatchScreen.tsx` event playback; refactored `CommentaryStrip.tsx` to read synchronized captions directly from `voiceQueue.subscribe()`.
    - **Unit Tests:** Extended `tests/audio/audio.test.ts` to 21 tests covering preemption, stale line dropping, caption subscriber callbacks, assistant stinger, coach dialogue, and ducking lifecycle.

## 2026-11-25 · M6b Club spaces scene manager, unified floor coordinates, nav graph, and talk scenes
- Changed: src/club3d/{types,rooms,nav,walk,lookAround,mouth,faces,people,talkScenes,timeOfDay,ClubScene,ClubSpacesCanvas,index}.ts, src/config/balance.ts, src/App.tsx, tests/club3d/club3d.test.ts
- Ran:
  - `npx prettier --check`: All matched files use Prettier code style! PASS
  - `npx vitest run tests/audio/audio.test.ts tests/club3d/club3d.test.ts`: 2 files / 33 tests PASS (0 failures)
  - `npx vite build`: built in 28.24s, main chunk 408.09 kB gzip (physics chunk 1.65 MB gzip, lazy) PASS
- Notes:
  - Implemented Milestone M6b foundation (SPEC §11.25 Club spaces, §14.11 People & painted faces, §14.12.7 Physics & character controller):
    - **Unified Floor Coordinates & Rooms Geometry (`src/club3d/rooms.ts`):** Defined single connected coordinate space joining Exterior (stadium entrance, car park), Corridor spine (X: -20 to 40, Z: -1.5 to 1.5), Office (Hub, Tactics, Inbox, Club), Boardroom (meeting & reviews), Dressing Room (U of lockers, central tactics stand), Tunnel (leading to pitch light), Press Room (table, mics, backdrop), and outdoor path to Training Ground (two pitches, cones, touchline clipboard). Procedural fallback geometry with collision boxes and door frames.
    - **Navigation Graph & Timed Walks (`src/club3d/nav.ts`, `walk.ts`):** Dijkstra waypoint pathfinding connecting all rooms through corridor junctions. Walk durations strictly clamped to <= 2.5s (`BALANCE.club3d.walkMaxSeconds`). Rapier `KinematicCharacterController` integration (capsule r=0.28, h=1.78, maxStep=0.3, maxSlope=40°, groundSnap=0.2). Space/click instant skip support and setting toggle ("Coach walks between rooms").
    - **Look-Around Camera Controller (`src/club3d/lookAround.ts`):** Right-click drag yaw (±60°) and pitch (-20° to +15°), wheel lean (±1.5m), wall margin clamping (>= 0.3m), and 1.2m minimum distance constraint to character heads. 600ms spring ease-back on release. One-time 4s hint banner.
    - **Faces & Audio-Driven Mouths (`src/club3d/mouth.ts`, `faces.ts`, `people.ts`):** 5 emotional moods (neutral, happy, angry, worried, shocked), blinking scheduler (2–6s), 3–5° listening head tilt, gaze look-at towards speaker (±25° max). `AnalyserNode` RMS loudness mouth mapping with hysteresis and 70ms minimum hold time, with procedural caption-rhythm speech fallback.
    - **Talk Scenes & Team-Talk Reactions (`src/club3d/talkScenes.ts`):** Two-beat pattern (Speaking beat with Space skip -> Choice beat with choice card). Team-talk reaction formulas from real morale changes (morale >= +4 FistPump/SitClap, +1..+3 SitNod, 0 Listen, -1..-3 SitHeadDown, <= -4 ArmsFolded).
    - **Time of Day System (`src/club3d/timeOfDay.ts`):** 4 weekly beats (Monday morning, Wednesday afternoon, Friday evening, Matchday) with 1.2s lighting crossfades and TopBar chip status formatting.
    - **React & Three.js Shell (`src/club3d/ClubScene.ts`, `ClubSpacesCanvas.tsx`):** Wired `<ClubSpacesCanvas />` into `App.tsx` behind management screens with room ambience playback via `audioEngine`.
    - **Unit Tests:** Authored `tests/club3d/club3d.test.ts` (12 tests covering geometry bounds, screen-to-room mappings, nav paths, walk clamps, camera bounds, mouth hysteresis, caption rhythm, face moods, team talk reactions, talk scene state transitions, and time-of-day beats).
