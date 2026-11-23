<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 11. Screens

### 11.0 Global shell and keyboard map
- **Top bar** (56 px, full width; there is no sidebar, v1.6): crest + club name (left); then the **navigation tabs** in two groups. On air: Hub, League, Fixtures. The office: Squad, Tactics, Training, Transfers (only enabled during windows; otherwise shows "Scouting" list read-only), Club (Finances + Board), Inbox (unread count as a badge on the tab). Right: status chip "MD 7/18 · 3rd · 14 pts", balance, settings gear, **Continue** button (accent, always visible, label changes: "Continue", "Go to Match", "Kick Off", "Next Round", "Finish Window"). Behaviour and widths in §19.6.
- **Club spaces (v1.7):** each tab is also a place in the club building. A tab click makes the coach walk to that room, and the screen opens there (§11.25).
- **Ticker** (36 px, bottom of on-air screens, §19.5).
- **Keyboard:** `Space` Continue / confirm primary; `Esc` close modal / back / pause match; `1`–`9` navigation tabs in order (outside the match); in match: `P` pause, `1` `2` `3` speed (Key highlights, Extended, Full), `T` tactics panel, `S` substitutions, `C` cycle camera, `R` replay last goal, `H` hide HUD, `F` fullscreen, `I` instant result (with confirm). Show key hints (KeyHint component) next to every primary button.
- Every list/table row is keyboard-focusable and opens with Enter.

### 11.1 Boot / loading
**Design reference: `docs/design/extras/` (loading panel).**
Plain HTML/CSS splash inside `index.html` (no JS needed): dark background, game logo text in the heading font, a thin progress bar. It MUST paint within 300 ms of navigation. React replaces it when ready. Then preload the title assets (logo, title background image, music) and prefetch the three.js chunk in idle time.

### 11.2 Title
**Load screen design reference: `docs/design/load/`.**
**Design reference: `docs/design/title/` (approved 23 Nov; it wins over the bullets below on layout and look).**
- Background: title image `images/ui/title_bg.webp` (fallback: CSS gradient + animated pitch lines). If three.js chunk is loaded and quality ≥ Medium, MAY show a slow 3D stadium flyover instead.
- Logo text: `GAME_TITLE` in Barlow Condensed 700, 96 px.
- Buttons: **Continue** (only if an autosave exists, shows club + matchday), **New Game**, **Load**, **Settings**, **Credits**.
- Music: `music/title_theme.mp3` loop (starts after the first user gesture, per browser autoplay rules: show "Click anywhere to start" overlay on first visit).

### 11.3 New Game
**Design reference: `docs/design/new-game/` (approved 23 Nov; it wins on layout and look).**
Step 1 — **Choose your club**: a carousel of 10 club cards (crest, name, nickname, stadium, stars for reputation, board expectation, transfer budget, "Difficulty: Easy/Normal/Hard/Very Hard" where rep 5 = Easy, 4 = Normal, 3 = Hard, 2 = Very Hard), plus a squad preview (best XI on a mini pitch with OVRs). Arrow keys/clicks change the club. Enter confirms.
Step 2 — **Your name** (text input, default "The Gaffer") and **Tutorial on/off** (default on).
Step 3 — Start: create the save (§20), go to BoardMeeting.

### 11.4 Board Meeting (once, at start)
**Design reference (M6b talk scene): `docs/design/boardroom/`.**
Full-screen card styled like a meeting room: chairman portrait (fictional, `images/people/chairman_{clubId}.webp`, fallback avatar), the expectation, transfer budget, wage budget, and three bullet "board notes" generated from club data (e.g. "We expect attacking football." from mentality; "Develop young players." if the club has ≥2 prospects with potential ≥ 75). Button: "Accept the job".
**v1.7:** this takes place in the **Boardroom** (§11.25). The owner sits at the head of the table with 2 directors, speaks the welcome and the expectation (voiced, `club.json`), and the card above slides in on the table.

### 11.5 Hub (home screen)
**M6b office version: `docs/design/hub-desk/` (23 Nov). The 2D Hub stays `docs/design/hub/` until then.**
Grid of cards:
- **Next match** (large): opponent crest, venue, matchday, kickoff, weather icon, opponent form (last 5), table positions, the assistant's one-line preview. Buttons: Go to match (Continue), Opponent report.
- **League snapshot**: top 3, your row, bottom 2, with movement arrows.
- **Inbox**: latest 4 unread.
- **Squad status**: counts of injured, suspended, tired (condition < 75), unhappy (morale < 40), with click-through filters to Squad.
- **Board & fans**: two Meters (0–100) with trend arrows and a one-line verdict ("The board is pleased with progress").
- **Latest news**: newspaper-style card with image and headline.
- **Assistant tip**: one actionable suggestion with an "Apply" button (§15.3).

### 11.6 Squad
**Design reference: `docs/design/squad/` (23 Nov; it wins on layout and look).**
- Table columns: #, Name (portrait thumb), Pos, Age, OVR (badge), Pot (★ display only: own players show 1–5 stars from potential), Cond (bar), Morale (icon + word), Form (5 dots coloured by rating), Apps, Goals, Assists, Avg rating, Value, Wage, Contract years, Status icons (injury, suspension, transfer listed, promise).
- Filters: All / GK / DEF / MID / FWD / Injured / Unhappy. Sort by any column. Search by name.
- Row click → Player Profile.

### 11.7 Player Profile (modal-sized page, 960 px wide)
**Design reference: `docs/design/squad/` (23 Nov; it wins on layout and look).**
- Presented as a player file opened on the desk (Sheet "file" variant, §19.5; opening animation §19.7): manila tab with the name, the portrait clipped to the first sheet, status shown as Stamps (INJURED, SUSPENDED, TRANSFER LISTED, NOT FOR SALE, SCOUTED).
- Header: portrait (256²), name, number, positions with familiarity chips, age, nationality flag (simple CSS flag or emoji-free SVG; no flag assets needed: draw horizontal/vertical tri-bands per nation in `procedural/flags.ts`), height, foot, personality, OVR badge, potential stars, value, wage, contract, squad role.
- Tabs: **Attributes** (three columns Technical/Physical/Mental, plus Goalkeeping for GKs; each AttrBar coloured per §19.4; for unscouted other-club players show ranges e.g. "60–72", §12.12), **Stats** (season table + last 5 matches ratings sparkline), **Status** (condition, fatigue, morale with reasons list "Won last match +6", injury details, suspension), **History**.
- Actions (own players): Set as captain, Set as taker (penalty/free kick/corner), Transfer list / Remove, Not for sale, Individual training focus (dropdown of attributes, §12.3), Talk to player (opens conversation if allowed: max 1 per player per matchday).
- Actions (other players): Scout (in windows), Make offer (in windows), Shortlist toggle.

### 11.8 Tactics
- The whole screen is the office tactics wall (§19.1): the PitchBoard is a whiteboard (`--board`, pitch lines drawn in `--board-ink` at 35% like marker pen), the tokens are Magnets (§19.5), instructions sit on a clipboard Sheet beside it, and the bench is a row of magnets along the board's bottom edge.
- Left: **PitchBoard** (2D SVG pitch, sideways since v1.7: own goal on the left) with 11 draggable player tokens (shirt colour, number, surname, OVR at slot coloured by fit: green ≥ natural, amber 0.8–0.95, red < 0.8). Drag a token onto another to swap; drag from the bench list onto a token to replace.
- Right: formation dropdown (7), familiarity meter for the selected formation, the seven instructions as three-way segmented controls with a one-line description each (§13.10), roles and player instructions per slot (click token → role card, §13.17.6), transitions and set pieces, opposition orders, captain, takers (penalty, free kick, corner, long throw).
- Bench: up to 9 players, list with drag handles.
- Buttons: **Assistant picks best XI** (§13.13 algorithm), **Reset to club style**, Presets: "Park the bus" (Defensive, Direct, Slow, Low, Deep, Narrow, Centre), "Control" (Balanced, Short, Slow, Mid, Normal, Normal, Mixed), "Gegenpress" (Attacking, Short, Fast, High, High, Normal, Mixed), "Counter" (Defensive, Direct, Fast, Low, Deep, Wide, Mixed), "All-out attack" (Attacking, Mixed, Fast, High, High, Wide, Mixed).
- **Layout (v1.7, wins over the bullets above where they differ; the v1.6 three-column vertical layout is withdrawn):** two columns with no page scroll. **Left:** the whiteboard lying **sideways** (own goal on the left, attacking right), dominant, with the bench strip under it. **Right:** a tall panel that is the clipboard (plans, formation, familiarity, the five dividers, opposition orders) until a player is selected, when his file slides over it: header, a RadarChart that always stays in view, then Orders and Profile tabs. Full layout in `docs/design/tactics/README.md` "v5 layout".
- Validation (blocks Kick Off with a clear message): exactly 1 GK in the GK slot, 11 starters, no injured/suspended player in XI or bench, no duplicates.

### 11.9 Training
**Design reference: `docs/design/training/` (approved 23 Nov; it wins on layout and look).** **v1.7 (wins over the bullets below where they differ; rules in §12.18):** the screen lives on the training ground (§11.25), with no page scroll. The board on the left is the **week**: a grid of days × morning and afternoon with session cards (category colour, name, load pips). You drag cards from a library strip under it, or press Enter on a slot to pick one. Above it are the template dropdown, intensity, **Theo's week** (memo and Apply), "Let Theo plan every week", the week's load meter with its condition and injury forecast, and the team's average training rating. The panel on the right has tabs: **Players** (focus, workload, extra sessions, rest, mentor, this week's rating with a 6-week sparkline, injury risk, overload flag; selecting a row opens his file with the attribute arrows), **One-to-one** (the week's pick, the four types with their effects, Theo's suggestion, then the scene), and **Progress** (the selected player's season OVR line, attribute arrows and coach's note). The 3D drills on the training ground follow the category that dominates the week.

- Team focus (6 cards with icons and effect descriptions from §12.3), intensity (Light/Normal/Hard with injury-risk and recovery indicators).
- Individual focus table: players with a dropdown grouped as Attribute / Role / Position (or "None") (§12.17.4), a rest toggle (§12.17.3), and an injury-risk chip (§12.17.6).
- "Last week" panel: growth summary (players who improved, with +OVR), training injuries.

### 11.10 Transfers (only in windows)
**Design reference: `docs/design/scouting/` (23 Nov; it wins on layout and look).**
- Header: window name, "Day 1 of 3 / Day 2 of 3 / Deadline Day" stepper, transfer budget remaining, wage budget used/total, squad size N/26 (min 16, 2 GK).
- Tabs: **Search** (all non-own players + free agents; filters: position group, age range, OVR range (estimated for unscouted), max value, club; columns: name, club, pos, age, OVR (or range), value, wage, contract), **Shortlist**, **Offers** (my bids with status; incoming bids for my players with Accept/Reject/Counter), **Scouting** (queue up to 2 per day; results next day).
- Make Offer dialog: fee input with +/− steps (5% of value), shows "Asking price estimate: high/fair/low" only after scouting the player OR if the club's response was a counter; then on acceptance → Contract dialog: wage, years (1–4), role promise (Star/Starter/Rotation/Backup), signing on.
- "Advance day" button (Continue) resolves AI responses and AI activity (§12.13). After Deadline Day the window closes.

### 11.11 League
**Design reference: `docs/design/league/` (approved 23 Nov; it wins on layout and look).**
Tabs: **Table** (full table with form, positions coloured: 1st gold mark, 2–3 accent mark, bottom 2 red mark; rows reorder with FlipList after each matchday), **Results by matchday** (selector 1–18), **Stats** (top scorers, assists, average ratings (min 5 apps), clean sheets (GK), yellow/red cards), **Clubs** (club cards: click → club page with squad (estimated OVRs), stadium, manager, form).

### 11.12 Fixtures
**Design reference: `docs/design/fixtures/` (approved 23 Nov; it wins on layout and look).**
Your 18 fixtures with result, scorers, attendance, MOTM; upcoming ones show opponent position and form.

### 11.13 Club
**Design reference: `docs/design/club/` (23 Nov; it wins on layout and look).**
Tabs: **Finances** (balance, this season income/expense breakdown bars, weekly wage bill vs budget, projection to season end), **Board** (confidence meter, expectation, history of confidence per matchday as a line chart, messages), **Fans** (mood meter, attendance per home game chart, quotes from §16.6 fan reactions), **Stadium** (name, capacity, image `images/stadium/{clubId}.webp` fallback to a 3D thumbnail or gradient).

### 11.14 Inbox
**Design reference: `docs/design/inbox/` (23 Nov; it wins on layout and look).**
Two-pane: list (kind icon, title, matchday, unread dot) and reading pane (body, action buttons). Items requiring action are pinned to the top until handled.

### 11.15 Pre-Match
Three steps in a stepper bar, each skippable with Continue:
1. **Opponent report** (assistant): their likely XI on a mini pitch (estimated OVRs), formation and style words ("They press high and play direct"), key player card, a weakness ("Their left back is slow (pace 58)"), and "Suggested approach" with an **Apply** button that sets 1–3 instructions (§15.2).
2. **Team selection** (embedded Tactics with the assistant's suggestion highlighted; warnings for tired players).
3. **Team talk** (§12.8): 6 tone buttons with a short preview of likely reactions ("Most players will respond well").
Then **Kick Off**.

### 11.16 Match (live)
Full-window 3D view (§14) with HUD:
- Top-left: scoreboard bug (crests, codes, score, clock "67:12", added-time "+3" indicator, red-card markers).
- Top-right: speed selector, camera button, pause.
- Bottom: commentary caption strip (latest line, fades after 4 s), with a voice indicator.
- Left drawer (toggle): live stats (possession, shots, on target, xG, corners, fouls, cards), momentum chart (rolling xG per 5 min, both teams).
- Right drawer (toggle): **Assistant** feed (§15.4) with Apply buttons; **Around the league** ticker.
- Bottom-right buttons: **Tactics** (T) opens an overlay with the Tactics screen in compact mode; **Subs** (S) opens a substitution panel (on-pitch list with condition bars and ratings; bench list; pick out → pick in; remaining subs "3 of 5 · windows 2 of 3").
- Between highlights (Key/Extended modes) show a transparent overlay "time-lapse" with the clock ticking fast and a tiny 2D radar of the ball position; never a frozen screen.
- Goal: slow-motion replay (§14.7), score bug animation, crowd roar, commentary.
- Half-time and full-time screens (§11.17, §11.18).

### 11.17 Half-Time
**Design reference: `docs/design/fulltime/` README, "Half-time".**
Stats comparison, assistant's half-time analysis (2–3 bullets with Apply buttons), team talk (half-time contexts), quick substitutions and tactics changes, then "Second half" (Continue). Real-time budget: the user controls it; no timer.

### 11.18 Full-Time and Post-Match
**Design reference for the result screen and Half-Time: `docs/design/fulltime/` (approved 23 Nov; it wins on layout and look).**
1. **Result**: final score, scorers with minutes, MOTM card, player ratings for both teams (sortable), full stats, shot map (2D pitch with shot dots sized by xG, filled for goals), xG timeline.
2. **Team talk** (full-time contexts).
3. **Press conference** if triggered (§12.6): journalist portrait, voiced question, 3 answers. Design reference: `docs/design/press/`.
4. **Back page**: newspaper-style headline for the match (§16.6) with image.
5. Continue → WeekSummary.

### 11.19 Week Summary
**Design reference: `docs/design/week-summary/` (approved 23 Nov; it wins on layout and look). Its "Local papers" table also applies to the Hub newspaper and the match back page.**
One screen: other results of the round, updated table excerpt, injuries/returns, training growth highlights, finance line (wages paid, gate income), board/fan changes with reasons, inbox items that need action. Continue → next PreMatch.

### 11.20 Season End
**Design reference: `docs/design/season-end/` (approved 23 Nov; it wins on layout and look).**
Sequence of full-screen cards (each Continue): Final table → Awards (§12.15) → Your season in numbers (W/D/L, goals, best win, top scorer, signings) → Board verdict with grade (§12.16) and score → "Share card" (a 1200×630 canvas image the user can download as PNG, with club crest, final position, grade, top scorer) → buttons: New Game, Title.

### 11.21 Sacked
**Design reference: `docs/design/sacked/` (23 Nov; it wins on layout and look).**
Dramatic card: "You have been relieved of your duties." Reason, record, grade F, score. Buttons: Load last save, New Game.
**v1.7:** the coach is called to the **Boardroom**. The owner tells him to his face (voiced, `club.json`, mood angry or worried by the reason), then the card.

### 11.22 Settings (modal)
**Design reference: `docs/design/settings/`.**
Audio: master, music, crowd, commentary, effects (sliders 0–100), commentary voice on/off (captions stay). Gameplay: default match speed, auto-continue after highlights (on/off), confirm before Instant Result, **coach walks between rooms (on/off, §11.25.2)**. Graphics: Quality Auto/Low/Medium/High, show FPS. Accessibility: reduce motion, larger UI text (+12.5%), colour-blind-friendly attribute colours (blue→orange scale). Data: export save (JSON download), import save, delete saves.

### 11.23 Credits
**Design reference: `docs/design/extras/` (credits panel).**
Game by [entrant name] — leave a placeholder constant `CREDITS` in `constants.ts` that the user fills in. Lists collaborators, "Voices: ElevenLabs", "Images: fal", "3D models: Meshy", fonts (Barlow Condensed, Inter — SIL OFL), three.js (MIT), React (MIT). Show license notices.

### 11.24 Tutorial (first season, can be turned off)
**Design reference: `docs/design/extras/` (tutorial hint).**
Seven coach-marks shown by the assistant in a speech-bubble component, each once: (1) Hub overview, (2) Continue button, (3) Tactics: drag a player, (4) Assistant Apply button in Pre-Match, (5) Team talk, (6) Match HUD controls (speed, subs, camera), (7) Week summary and board meter. "Skip tutorial" always visible.

