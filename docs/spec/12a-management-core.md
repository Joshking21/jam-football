<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 12. Management systems and exact rules

All numbers below go into `balance.ts`.

### 12.1 Condition (0–100)
- In-match drain per minute on the pitch: `0.22 × staminaFactor × pressingFactor × tempoFactor`, where `staminaFactor = 1.25 − stamina/200`, pressing High 1.12 / Mid 1.0 / Low 0.92, tempo Fast 1.05 / Normal 1.0 / Slow 0.96. A 90-minute player loses ~15–25.
- Weekly recovery (between matchdays): `+ (18 + stamina/10) × intensityRecovery`, Light 1.2, Normal 1.0, Hard 0.8; Fitness focus +4. Players who did not play recover an extra +6. Cap 100.
- Match effect: if condition < 70: all of that player's skill scores get `−(70 − condition)/100` in z-units (§13.4).
- A player with condition < 40 MUST NOT be selected (the UI blocks it; AI never does it).

### 12.2 Fatigue (0–100)
- After each match: `+ minutes/9`. Weekly: −6 (Light −9, Hard −4).
- Fatigue > 60: injury hazard × 1.5 and weekly recovery × 0.85. Fatigue > 80: show a red warning and the assistant suggests rest.

### 12.3 Training
Team focus effects (applied for the next match only, as a "preparation" bonus, and to development):

| Focus | Next-match bonus (z-units on listed contests) | Development weighting (attributes that receive growth) |
|---|---|---|
| Balanced | none | all weighted attributes of the player's primary position |
| Attacking | +0.04 to pass/dribble/shot execution | finishing, passing, firstTouch, dribbling, offTheBall, crossing |
| Defending | +0.04 to tackle/interception/block | tackling, positioning, heading, strength, decisions |
| Fitness | condition recovery +4 | stamina, pace, strength (only stamina for 30+) |
| SetPieces | +0.08 on corners, free kicks, penalties | setPieces, heading, crossing |
| Tactical | current formation familiarity +10 (extra) | decisions, positioning, composure, workRate |

Intensity: Light (growth ×0.6, injury ×0.5, recovery ×1.2), Normal (×1, ×1, ×1), Hard (×1.3, ×2.0, ×0.8).
Training injury chance per player per week: `0.004 × intensityInjury × (fatigue > 60 ? 1.5 : 1)`. Severity per §12.5.
Individual focus: 40% of that player's growth goes to the chosen attribute; the rest follows the team focus.

### 12.4 Development (weekly, in `development.ts`)
- Base OVR growth per week by age: ≤20: +0.45, 21–23: +0.30, 24–27: +0.12, 28–30: 0, 31–33: −0.10, 34+: −0.25.
- Multipliers for positive growth: `headroomFactor = clamp((potential − OVR)/10, 0, 1)`, `minutesFactor = 0.6 + 0.4 × min(1, minutesLastMatch/90)` (players who did not play: 0.6), `intensity` (§12.3), `morale ≥ 60 ? 1.1 : morale < 30 ? 0.8 : 1`.
- Add the result to `player.growth` (it can be negative). While `growth ≥ 1`: subtract 1 from `growth` and add +1 to each of **3** attributes picked (without repeats) from the training-focus list (§12.3), weighted by each attribute's OVR weight at the player's primary position (attributes with weight 0 get weight 0.05). If the player has an individual focus, that attribute is always one of the 3. Never raise an attribute above 99, and stop raising once OVR reaches `potential`. Recompute OVR after each +1 round.
- While `growth ≤ −1`: add 1 to `growth` and subtract 1 from 3 attributes, physical ones first (pace, stamina, strength), then any weighted attribute. Never below 1.
- Show "+1 OVR" toasts in WeekSummary.

### 12.5 Injuries
- In-match hazard per player per minute: `λ = 0.00012 × (1 + max(0, 70 − condition)/30) × (fatigue > 60 ? 1.5 : 1) × (opponent pressing High ? 1.15 : 1)`; probability over a step of `dt` minutes = `1 − exp(−λ·dt)`.
- Severity: Minor 55% (1–2 matchdays), Moderate 35% (3–5), Major 10% (6–12). Kind from `content/injuries.json` (at least 20 kinds with severity tags, e.g. "Hamstring strain", "Twisted ankle", "Knee ligament damage").
- An injured player on the pitch: if subs remain, the AI or user (prompted with a modal; auto after 10 s at Key/Extended speed) replaces them at the next stoppage; otherwise the team plays on with 10 (the player's skill scores −1.0 until then).
- Weekly: `matchdaysOut −1` each WeekSummary; at 0 → injury cleared, "Returned from injury" inbox item, condition set to 75.

### 12.6 Discipline and press triggers
- Yellow probability per foul `0.16 × foulerFactor` (Temperamental ×1.3, Professional ×0.85, tackling < 50 ×1.15). Direct red per foul `0.006` (Temperamental ×1.5). Second yellow → red.
- Bans: 5 yellows accumulated → 1-match ban (then reset); red (second yellow) → 1; direct red → 2.
- Press conference triggers after a match: derbies (always), matchday 1, results against a club ≥ 2 reputation higher (win or draw), losses by 3+, a winning/losing streak reaching 3, and otherwise 30% chance. Max one per matchday. Pre-match press (optional) before derbies only: shown as step 0 in Pre-Match.

### 12.7 Board confidence and sacking
- After each match: win +3 (opponent rep higher: +5), draw +1 if opponent rep higher else 0 (lower rep: −1), loss −3 (opponent rep lower: −5; by 3+ goals: −2 extra).
- After each matchday from matchday 4: if position ≤ target: +1; if position > acceptable: −1; if position ≥ acceptable + 3: −2 extra.
- Wage bill > wage budget at WeekSummary: −2. Balance < 0: −4.
- Clamp 0–100. At WeekSummary: if confidence < 25 and no warning yet → "Final warning" inbox item from the board. If confidence < 12 at any WeekSummary from matchday 6 → **Sacked**.

### 12.8 Team talks (`talks.ts` and `content/talks.json`)
Tones: **Calm**, **Motivate**, **Demand more**, **Praise**, **Disappointment**, **Focus**.
Contexts: `PRE_FAV` (our team avg OVR ≥ theirs + 3), `PRE_DOG` (≤ −3), `PRE_EVEN`, `HT_WIN`, `HT_DRAW`, `HT_LOSE`, `FT_WIN`, `FT_DRAW`, `FT_LOSE`.
Base morale effect per player (before personality): 

| Context \ Tone | Calm | Motivate | Demand | Praise | Disappoint | Focus |
|---|---|---|---|---|---|---|
| PRE_FAV | +2 | +1 | +3 | 0 | −3 | +3 |
| PRE_DOG | +3 | +4 | −2 | +1 | −4 | +2 |
| PRE_EVEN | +2 | +3 | +1 | +1 | −3 | +3 |
| HT_WIN | +2 | 0 | +2 | +3 | −4 | +3 |
| HT_DRAW | +1 | +3 | +2 | 0 | −1 | +2 |
| HT_LOSE | +1 | +3 | +2 | −2 | +1 | +1 |
| FT_WIN | +1 | 0 | −1 | +5 | −5 | +1 |
| FT_DRAW | +2 | +1 | 0 | +1 | −1 | +1 |
| FT_LOSE | +2 | +1 | +1 | −3 | +3 | 0 |

Personality multipliers on the base value: Professional ×1.0 (and never below 0 for Demand/Focus), Ambitious ×1.2 for Demand/Focus, ×0.8 for Calm, Leader ×1.3 for all positive, Relaxed: negative effects ×0.5, positive ×0.8, Temperamental: Demand and Disappointment flip sign with 40% chance (roll per player), all ×1.3, Loyal ×1.0 (Praise ×1.3).
In-match effect: pre-match and half-time talks also grant a team-wide `focusBoost` for the next 20 match minutes = average morale change / 100 in z-units (e.g. average +3 → +0.03).
UI shows each tone's predicted reaction as "Most will respond well / Mixed / Likely to backfire" from the sign and size of the expected average.

### 12.9 Player conversations (`conversations.ts`, `content/conversations.json`)
Triggers (checked at WeekSummary, at most 1 new conversation per week):
- **Playing time**: role Star/Starter or promisedRole Starter, started < 50% of the last 4 matches while fit → 60% chance.
- **New contract**: Ambitious or OVR rose by ≥ 3 this season and yearsLeft = 1 → 30% chance.
- **Unhappy morale**: morale < 30 → 40% chance.
- **Praise form**: avg rating ≥ 7.5 over last 3 → 20% chance (positive conversation).
Each conversation: the player's opening line and 3 replies with exact effects (morale, promise flags, a contract renewal flow that raises wage by 15–30%). A broken promise (promised Starter, started < 50% of the next 4 matches) → morale −15 and the player asks to be transfer listed.
Minimum content: 4 conversation types × 3 openings × 3 replies (with variation lines).

### 12.10 Finances
- `valueOf(player) = 1_200_000 × 1.16^(OVR − 60) × ageFactor × potentialFactor × contractFactor`, rounded to 2 significant figures (min 50,000). ageFactor: ≤21 1.4, 22–24 1.25, 25–28 1.0, 29–30 0.75, 31–32 0.5, 33+ 0.3. potentialFactor = `1 + max(0, potential − OVR)/40`. contractFactor: yearsLeft 1 → 0.75, else 1. Free agents: value shown, but no fee.
- `wageFor(value) = max(1_000, round to 500(value × 0.0016))` per week.
- Per matchday income: TV `600_000` each club; sponsor rep5 800k / rep4 600k / rep3 400k / rep2 250k; gate on home games = attendance × ticket price (rep5 €45, rep4 €38, rep3 €32, rep2 €26).
- Attendance = `capacity × clamp(0.55 + 0.4 × fanMood/100 + (derby ? 0.08 : 0) + (opponent rep 5 ? 0.04 : 0) + noise(±0.03), 0.4, 1.0)`.
- Expenses per week: wages (sum of squad wages), operating `100_000 × reputation`.
- Season-end prize money by final position: 1st 20M, then −2M per place (10th: 2M).
- Transfer fees move between balances; the buying club's transferBudget decreases by the fee; selling adds 50% of the fee to the transferBudget (and 100% to balance).

### 12.11 Inbox generation
At WeekSummary generate, in this order: medical (new injuries, returns), discipline (bans), board (warnings, praise when confidence ≥ 80 first time), assistant (one tip, §15.3), player (conversation requests), league (player of the month every 4 matchdays: best average rating with ≥ 3 apps in that span; manager of the month), transfer (incoming bids during windows; rumours outside windows: 1 per 3 weeks about a rival). Each item body is 1–3 sentences from templates in `content/news.json` (inbox section). No item may be generated twice for the same fact.

### 12.12 Knowledge and scouting
- Own players: exact attributes and OVR.
- Others unscouted: each attribute shown as a 12-point band containing the true value, offset deterministic per (playerId, viewer club) via `deriveSeed`: `low = clamp(true − rng.int(0, 11), 1, 88)`, `high = low + 11`. OVR shown as a band computed the same way with 8 points. Bands MUST be stable across reloads.
- Scouted (by user's club): exact values. Scouting a player takes until the next window round ("Day"); 2 players per round. Outside windows, the user may scout 1 player per matchday from the League → Clubs pages.
- Potential: never exact. Own and scouted players show stars: potential ≥ 85 ★★★★★, 78–84 ★★★★, 71–77 ★★★, 64–70 ★★, else ★.

### 12.13 Transfers (windows)
Window = 3 rounds (Day 1, Day 2, Deadline Day). On each **Advance day**:
1. Resolve the user's pending bids (in creation order).
2. Resolve scouting.
3. AI incoming bids for the user's players (§12.13.4).
4. AI–AI activity (§12.13.5).
5. Generate news for completed deals.

12.13.1 **Asking price** (selling AI club): `ask = value × importance × windowFactor × repFactor`, importance: player is in the club's top 3 by OVR ×1.6, rank 4–11 ×1.25, else ×1.0; windowFactor: Deadline Day ×1.1, else 1.0; repFactor: buyer rep > seller rep ×1.05 else 1.0. Players marked "not for sale" by AI: the club's top 1 by OVR at rep-5 clubs (reject all bids below 2.5× value).

12.13.2 **Response to a bid** `fee`: `fee ≥ ask` → Accepted; `fee ≥ 0.82 × ask` → Countered at `round(ask × rng(0.95,1.0))`; else Rejected. Max 2 bids per player per round. A counter can be accepted instantly by the user (then it is Accepted).

12.13.3 **Player decision** (after club acceptance): willing if `buyer rep ≥ seller rep − 1` OR offered wage ≥ 1.3 × current wage. Ambitious: requires buyer rep ≥ seller rep. Loyal: 30% refuse regardless (deterministic roll per (player, buyer)). Wage ask = `max(current × 1.15, wageFor(value))`, × 1.2 if promised role is lower than his current role. The user offers wage/years/role; the player accepts if wage ≥ ask × (role promise Star ×0.9, Starter ×0.95, others ×1.0); one counter allowed (player asks for the midpoint); then accept/refuse. Constraints: wage bill after signing ≤ wage budget, squad ≤ 26, fee ≤ transfer budget. Completion moves the player, adds history entries, news, fan mood +5 if the player's OVR ≥ club's best-XI average + 3.

12.13.4 **Incoming bids** for user players: each round, for each AI club with transferBudget > 0, 15% chance it bids for the user player that most improves its weakest starting slot (OVR ≥ that slot's current OVR + 2), ×3 chance if the player is transfer listed. Fee offered = `value × rng(0.85, 1.15)`. The user Accepts/Rejects/Counters (counter: AI accepts if counter ≤ 1.25 × value, else walks away). Selling a player whose morale ≥ 60, apps ≥ 5 and OVR in top 3 → fan mood −8.

12.13.5 **AI–AI**: each round each AI club has a 25% chance to make one move: sign a free agent if a starting slot OVR < club mean −6 (free agents with OVR above that), else buy from a lower-reputation AI club a player that improves its weakest slot by ≥ 3, paying ask. Budgets and squad caps apply. Each deal becomes a news item.

12.13.6 **Board wage request**: once per window, the user can ask for +10% wage budget: granted if board confidence ≥ 60, otherwise denied (confidence −2).

### 12.14 Fans
Fan mood after a match: home win +4, away win +3, draw −1, loss −4, margin ≥ 3 goals ±2 extra, derby result ×2. Press answers (±0–5). Signings (§12.13.3), sales (§12.13.4). Drift toward 60 by 1 per week. Fan mood affects attendance (§12.10) and is part of the season grade (§12.16).

### 12.15 Awards (season end)
Player of the Season (highest average rating, ≥ 12 rated apps), Golden Boot (goals; tiebreak assists, then fewer minutes), Playmaker (assists), Golden Glove (clean sheets, GK ≥ 12 apps), Young Player (≤ 21, best avg rating, ≥ 8 apps), Manager of the Season (club with the best (target − final position); tiebreak points), Team of the Season (4-3-3, best average rating per slot group with ≥ 10 apps, players placed by primary position group). Show portraits and stats.

### 12.16 Season grade and score
- Grade from `delta = target − finalPosition` (positive = better): ≥ 2 → A+, 1 → A, 0 → B, −1 → C, −2 → D, ≤ −3 → F. Sacked → F.
- If the final position is within `acceptable` but worse than target, grade B− instead of C.
- Score (for the OpenGame leaderboard, optional): `points × 10 + goalDifference × 2 + delta × 50 + (champion ? 300 : 0) + round(boardConfidence) + round(fanMood)`. Minimum 0.

