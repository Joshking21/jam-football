<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
### 12.17 Club depth (SPEC 1.4, approved by the user 20 Nov)
Same rules as §13.17: every option has a gain and a cost, defaults are neutral, all numbers in `balance.ts` under `K.club.*`. AI clubs use neutral values (3★ staff, no prep, no rest, cohesion fixed at 50), so they cost nothing to simulate.

**12.17.1 Staff.** Four people per club: the assistant (Theo Vance for the user, fixed at 3★, not replaceable), first-team coach, head of scouting and physio, each `{ id, role, name, stars: 1–5, wage }`. The user's club starts with stars `round(reputation × 0.6 + 1)` ± rng(0,1), clamped 1–5. Effects:
- Coach: positive development (§12.4) × `0.85 + 0.06·stars` (1★ 0.91 … 5★ 1.15).
- Physio: injury length (matchdays) × `1.2 − 0.08·stars`, rounded, min 1; in-match injury hazard (§12.5) × `1.1 − 0.04·stars`.
- Scout: knowledge gain (§12.12) × `0.6 + 0.15·stars`.
- Cost: weekly wage = `K.club.staffWage × stars²` (default 1,500 × stars²), paid from the wage budget like players.
- Replacing: during a transfer window round, the Club screen shows 3 generated candidates per replaceable role (stars 1–5, names from `names.data.ts`). Hiring one replaces the current person, who is paid 4 weeks' wages as compensation. At most one replacement per window round. Inbox memo on each change.

**12.17.2 Match preparation.** Training gets `prep: 'None'|'SetPieces'|'Press'|'Wingers'|'Shape'`, for the next match only:
- SetPieces: the opponent's corner and free-kick header duels −0.12 for them. Press: our passes in DEF/MID against their Mid or High press ctx +0.15. Wingers: their wide players' dribble and cross delivery ctx −0.12. Shape: +8 familiarity (§13.18.11) for the active plan's formation, this match only.
- Cost: that week the team focus's next-match bonus is halved and development × 0.85.
- The assistant's week tip (§15.3) suggests a prep from the next opponent's style (Direct → SetPieces, Pressing High → Press, Width Wide → Wingers).

**12.17.3 Rest days.** Per player, per week: `rest: boolean`. Rested: condition +8 and fatigue −6 on top of §12.1–12.2; no development that week. A fit player (condition ≥ 90) rested 3 weeks running gets morale −5 ("Wants to train"). A rested player can still be picked.

**12.17.4 Individual training: role or position** (approved by the user 20 Nov). A player's individual focus (§12.3) is one of: an attribute (as before), a **role**, or a **position**. Only one at a time.
- **Role:** 40% of his growth goes to that role's key attributes, split by their weights, so his fit stars for it rise (§13.17.1). Cost: that 40% no longer goes to anything else.
- **Position:** pick any position he isn't natural in (a GK can't learn outfield positions and vice versa). If it isn't listed yet, it's added at the §9.5 unlisted value × 100 (same group 80, adjacent group 65, otherwise 45). Each week its familiarity rises by `(3 + (age ≤ 23 ? 2 : age ≥ 30 ? −1 : 0) + (decisions ≥ 70 ? 1 : 0)) × (0.85 + 0.06 × coach stars)`, plus 2 more for each match he played there that week. The cap is 95 (only the primary position is 100). Cost: his development that week × 0.8 (time spent learning), and no attribute or role focus.
- An inbox memo when a trained position reaches 85 ("Achebe is comfortable at RWB now"). The player's file shows each position as a chip with a small progress bar while it's being trained.
- No engine change: `ovrAt` (§9.5) already uses position familiarity.

**12.17.5 Dressing room.**
- Leaders: the top 3 players by `leaderScore = (personality Leader ? 30 : 0) + (captain ? 20 : 0) + (Professional ? 8 : 0) + age × 0.8 + min(apps, 40) × 0.5`, recomputed weekly.
- Cohesion 0–100, user club starts at 55. Weekly change, clamped to ±6 in total: `(mean leader morale − 55) / 10` (±3 max), win +1, loss −1, a leader sold −8, a promise broken −5, each new signing −2 (settling in).
- Morale spread: each week every non-leader's morale moves 10% toward the leaders' mean morale.
- Match effect: all execution ctx (passes, dribbles, shots, crosses) + `(cohesion − 50) / 1000` (±0.05).
- Cost: unhappy leaders drag the whole squad down; selling one hurts.
- UI: a leader badge in Squad and on magnets; a pinned "Dressing room" sheet in Club with the three leaders, the cohesion meter and the last 3 reasons it moved.

**12.17.6 Injury risk (display only).** Per player, Low / Medium / High from the §12.5 hazard terms (condition, fatigue) × physio, plus age ≥ 30 shown as a reason. Thresholds: hazard factor < 1.2 Low, < 1.6 Medium, otherwise High. It shows in a Squad column and in the player's file. It is not a new engine rule.

**12.17.7 Not in this jam** (SPEC-1.4 proposal Tier C, kept for later): a free-draw set-piece designer (the job-based version is §13.20), contract clauses, youth academy, social groups, multi-season careers.

### 12.18 Training in detail (v1.7, approved by the user 22 Nov; `core/people/training.ts`)
This replaces the single weekly team focus of §12.3 with a planned week. The §12.3 tables stay as the **category** numbers. The same rules apply as §13.17: every option has a gain and a cost; the **default week reproduces the old Balanced / Normal results**, so the §13.16 calibration still holds; Theo can set everything with one Apply; all numbers go in `balance.ts → K.train.*`. AI clubs don't simulate any of this: they use the default week's effects.

#### 12.18.1 The week
Each week between matchdays has these slots:

| Day | Slots |
|---|---|
| 1 | **Recovery** (fixed). Players who played ≥ 60' recover; everyone else does a Small-sided game. Not editable. |
| 2–5 | **Morning and afternoon**: 8 free slots |
| 6 | **Match prep**: 1 slot (Opponent prep, Shape work, Set-piece practice, Video analysis or Light session) |
| 7 | Matchday |

Every free slot holds one session from the library (§12.18.2) or **Rest**.

#### 12.18.2 Session library
Each session belongs to a category (the §12.3 focus rows). It lists the attributes it grows and has a **load** (how much it tires players). Goalkeepers always do goalkeeping work in parallel; their growth goes to reflexes, handling, oneOnOnes and aerialCommand, whatever the session.

| Session | Category | Grows | Load |
|---|---|---|---|
| Finishing | Attacking | finishing, composure, offTheBall | 2 |
| Crossing and delivery | Attacking | crossing, setPieces, passing | 2 |
| Combination play | Attacking | passing, firstTouch, offTheBall, decisions | 2 |
| 1v1 dribbling | Attacking | dribbling, firstTouch, pace | 2 |
| Defensive shape | Defending | positioning, decisions, workRate | 1 |
| Defending the box | Defending | heading, tackling, strength, positioning | 2 |
| Pressing | Defending | workRate, stamina, decisions | 3 |
| Endurance | Fitness | stamina | 3 |
| Speed and power | Fitness | pace, strength | 3 |
| Shape work | Tactical | positioning, decisions; formation familiarity +3 per session | 1 |
| Video analysis | Tactical | decisions, composure; all four familiarity areas +1 per session | 0 |
| Opponent prep (day 6 only) | Tactical | none; applies the §12.17.2 prep (SetPieces, Press, Wingers or Shape) | 1 |
| Set-piece practice | SetPieces | setPieces, heading, crossing | 1 |
| Small-sided game | Balanced | the player's primary-position weights; morale +1 | 2 |
| Recovery | Fitness | none; condition +3, fatigue −2 | −2 |
| Rest | none | none; condition +2 | −1 |
| Light session (day 6 only) | none | none | 0 |

#### 12.18.3 What the week does
- **Development** (§12.4): the 3 attributes picked per growth point come from the union of the week's "Grows" lists. Each attribute is weighted by how many sessions include it × its OVR weight at the player's position (weight-0 attributes count 0.05). An individual focus (§12.17.4) still always takes its 40%.
- **Volume:** positive growth × `0.6 + 0.05 × trainingSessions`, where `trainingSessions` = free slots that aren't Rest or Recovery (8 → ×1.0, 4 → ×0.8).
- **Next-match bonus (sharpness):** only day 5 (both slots) and day 6 count. Each category's §12.3 bonus × (its sessions in those 3 slots ÷ 3). For example, Finishing + Combination play + Light = Attacking bonus × ⅔.
- **Load and condition:** `weekLoad` = the sum of the 8 free slots' loads plus day 6. Weekly recovery (§12.1) gets `+ K.train.loadCond × (12 − weekLoad)` (default 0.6 per point). Training injury chance (§12.3) × `weekLoad / 12`. Team intensity (Light / Normal / Hard, §12.3) still multiplies growth, injury and recovery on top.
- **The default week ("Balanced week"):**
  - Day 2: Combination play, Defensive shape
  - Day 3: Endurance, Finishing
  - Day 4: Small-sided game, Defending the box
  - Day 5: Shape work, Set-piece practice
  - Day 6: Light session

  `weekLoad` = 12. Its sharpness and familiarity are the baseline the §13.16 calibration is measured with.
- **Templates:**

  | Template | Use |
  |---|---|
  | Balanced week | the default |
  | Tactical week | more Shape work and Video analysis; low load |
  | Physical week | Endurance, Speed and power; high load; best early in the season |
  | Attacking week | |
  | Defensive week | |
  | Opponent week | Theo fills day 5–6 against the next opponent |
  | Recovery week | for congested or tired squads; low growth |

  The user can save one custom week.

#### 12.18.4 Theo's week (one click)
Theo builds a suggested week from the Balanced week:
- If ≥ 4 starters have fatigue > 50: swap the two load-3 sessions for Recovery.
- If any familiarity area is < 70: add Shape work or Video analysis on day 5.
- Day 6: Opponent prep with the prep §12.17.2 suggests from the opponent's style.
- If the next opponent's set-piece threat (their best header ≥ 75) is high: Set-piece practice on day 5.

He shows it as a memo with the reasons (one line each) and **Apply**. A setting on the Training screen, **"Let Theo plan every week"**, applies it automatically each week.

#### 12.18.5 Each player's plan (personal training)
In the Players tab of Training, and in the player's file:
- **Individual focus:** attribute, role or position (§12.17.4, unchanged).
- **Workload:**

  | Workload | Growth | Injury chance | Condition | Training rating |
  |---|---|---|---|---|
  | Light | ×0.8 | ×0.6 | +3 per week | |
  | Normal | (default) | | | |
  | Heavy | ×1.15 | ×1.6 | −3 per week | +0.2 |

- **Extra sessions** (on or off): he stays after training. Growth ×1.15, fatigue +4 per week, injury ×1.3, training rating +0.2. A Relaxed or Temperamental player has a 30% chance each week to skip them ("Didn't fancy it"), with morale −3 and no gain.
- **Rest** (§12.17.3, unchanged).
- **Mentoring:** up to 3 pairs. The mentor must be a leader (§12.17.5) or aged ≥ 28 and Professional or Leader; the mentee must be aged ≤ 21.
  - **Gain:** each week the mentee's morale moves 20% toward the mentor's (on top of §12.17.5), and his positive development is ×1.08.
  - **Cost:** the mentor's own development ×0.9. If the mentor is sold or loses his place for 3 matches running, the mentee's morale −6.

#### 12.18.6 One-to-one sessions
Design reference: `docs/design/one-to-one/`.
Once per week the coach takes **one player** for a personal session on the training ground. It is a scene with that player, with faces and voices (§11.25, §14.11), and the coach's lines come from `training.json`. Pick one type:

| Type | Effect | When it's offered |
|---|---|---|
| Technique work | his positive growth this week ×1.25 (it lands on his individual focus first) | always |
| Confidence talk | morale +6 if his morale < 50, else +2 (Relaxed ×0.5, Leader ×1.2) | always |
| Fitness work | condition +6, fatigue −4 | always |
| Video of his last match | next match: his decision-weighted contests ctx +0.05 | only if he played the last match |

- **Cost: favourites.** Picking the same player 3 weeks running gives every other leader morale −2, with an inbox memo ("The lads think you've got a favourite").
- The session is optional; skipping it costs nothing.
- Theo suggests one each week from the clearest need: lowest morale among starters, a fatigue > 60 starter, or a young player with an individual focus.

#### 12.18.7 Training ratings
- Every player gets a weekly **training rating** from 1.0 to 10.0 (one decimal):
  `6.4 + (Professional +0.6, Ambitious +0.3, Relaxed −0.4) + 0.6·(morale − 50)/50 + (condition < 80 ? (condition − 80)/50 : 0) + workload and extra-session bonuses + rng.normal(0, Temperamental ? 1.0 : 0.6)`, clamped.
- **Effects:**
  - **≥ 7.5:** development ×1.05 and morale +1.
  - **≤ 5.5:** development ×0.95.
  - **3 weeks running ≥ 7.5 while he started < 50% of those matches:** a new §12.9 trigger, **"Training well, not playing"**, at 50% chance (content: its own `conversations.json` type `training_well`, ≥ 3 openings × 3 replies).
- **Shown in:** a Training Players-tab column (this week's rating and a 6-week sparkline), the player's file, and an assistant remark when a player is "flying in training" (≥ 8.0) or "going through the motions" (≤ 5.0). The team average shows on the Week tab.

#### 12.18.8 Progress you can see
- Store for the user's club only:
  - weekly OVR for the season (`ovrHistory: number[]`)
  - a 4-week attribute snapshot ring (`attrHistory`)
  - the last 8 training ratings
- **The player's file and the Training Progress tab show:**
  - an arrow beside each attribute: ▲ if it's +1 or more over 4 weeks, ▼ if −1 or less, nothing otherwise
  - the season's OVR line
  - a coach's note, one line chosen from `training.json` by the strongest signal (rating trend, growth, condition, workload): "Sharper on the ball this month.", "Struggling with the pace of training.", "Ready for more minutes."
- **Week Summary** lists the top 3 improvers and anyone whose rating dropped 2+ points.

#### 12.18.9 Workload and the physio
- Day 1 Recovery is automatic for players who played ≥ 60'.
- A player is **overloaded** if his fatigue > 60 and his workload isn't Light, or he does Extra sessions with fatigue > 50. The physio raises it in an inbox memo ("Overloaded: Calder, Mensah. Ease them off?") with a one-click "Set workload Light". His injury-risk chip (§12.17.6) adds "overloaded" as a reason.

#### 12.18.10 Content (`training.json`, new)
- Coach's notes: ≥ 24, by signal.
- One-to-one coach lines: ≥ 3 per type, voiced (`vo/coach/`), `nameSlot` allowed (§16.3).
- Player replies per type: ≥ 3, with mood.
- Theo's week memo reasons: ≥ 1 per rule.

#### 12.18.11 Coaches per area (only if time allows, after everything above is accepted)
- **New staff (§12.17.1):** attacking coach, defending coach, fitness coach and goalkeeping coach, each 1–5 stars.
- **Gain:** sessions of that coach's category grow × `0.85 + 0.06·stars`, replacing the first-team coach's multiplier for that category. The fitness coach also scales the Recovery and Rest condition gains by the same factor. The goalkeeping coach drives goalkeeper growth.
- **Cost:** wages as §12.17.1.
- They are replaced the same way as other staff. Without these coaches, the first-team coach covers every category.

#### 12.18.12 Calibration and tests
- **Default-week check:** the default week, Normal intensity and default player plans reproduce the M5.1 development numbers within ±3% over a 2,000-season-week sample.
- **No-dominant-choice check:** no template beats the Balanced week on total OVR growth by more than 15% without paying for it in injuries or condition.
- **Unit tests:** every session's growth list, sharpness, `weekLoad`, workload, extra sessions, mentoring, one-to-one effects and costs, training ratings, and the new conversation trigger.

### 12.19 Injury decisions (v1.7, approved by the user 22 Nov; `core/player/injuries.ts`)
The physio (staff, §12.17.1) brings the manager real calls to make. All decisions are scenes (§11.25.5), with the physio speaking (`club.json`, speaker `physio`, voiced; `person.glb`). Until M6b they show as a choice card on the current screen. All numbers go in `K.inj.*`. AI clubs always take the cautious option.

#### 12.19.1 Knocks in a match
- **What a knock is:** a separate event from §12.5 injuries, with hazard `0.6 × λ` (§12.5) and event `KNOCK`. The player goes down, and play stops at the next dead ball.
- **The physio's read:** "He can carry on. About {pct}%." `pct` = 70–90, higher with better physio stars.
- **Choices:**

  | Choice | Effect |
  |---|---|
  | **Take him off** | substitution at that dead ball; no layoff, condition −10 |
  | **Let him carry on** | his skill scores −0.3 while on the pitch; his §12.5 injury hazard ×4 for the rest of the match. If he gets injured, the severity rolls one level up (Minor → Moderate, Moderate → Major) |
  | **Carry on until half-time** | only offered in the first half. Carry-on rules until 45', then he's replaced at half-time without using a window |

- **Deciding:** live playback pauses on the choice. In Instant result, or if no subs remain, the default from the setting **"Knocks": Ask me (default) / Always take off / Play on if under 15' left** applies; when asking isn't possible, Ask me uses Always take off. The decision is a match command (`{ kind: 'knock'; side; playerId; decision; issuedAtT }`) with the usual rewind rules (§13.12), so it stays deterministic.
- **In 3D:** the player sits on the grass, the physio jogs on (`person.glb`), and there's a touchline cut of the coach waiting.

#### 12.19.2 Rushing a player back
- **When it's offered:** a player with `matchdaysOut = 1` (one week from fit). At WeekSummary the physio knocks: "He's close. We could risk him this week."
- **Choices:**
  - **Wait** (default): normal recovery (§12.5).
  - **Risk him:** he's available this matchday with condition 70 and a **"Not fully fit"** chip. For his next 2 matches: §12.5 hazard ×3 (× physio factor `1.2 − 0.08·stars`), and skill scores −0.1. If he breaks down, the same injury kind returns at `ceil(original matchdaysOut × 1.5)`, with an inbox memo and fans −1.
- Theo comments when it's a derby or a top-3 opponent: "Big one. Your call, gaffer."

#### 12.19.3 Warm-up scare
- **When:** before each match, one starter has a "tight" muscle with chance 3% (×2 if his fatigue > 50, ×0.7 with a 4–5★ physio). It is a speaking beat in the dressing room before the team talk, then a choice.
- **Choices:**
  - **Start him:** his §12.5 hazard ×2.5 this match, skill −0.1.
  - **Leave him out:** the best bench player for the slot (§13.13 rule) starts; he goes to the bench, or stands down if the bench is full.
- Instant result uses Leave him out.

#### 12.19.4 What shows up
- An injury log on the player's file: kind, matchdays out, re-injuries, and whether he was rushed.
- The squad injury-risk chip (§12.17.6) adds "rushed back" and "carried a knock" as reasons for 2 weeks.
- Week Summary lists the decisions and how they turned out ("Risked Calder: came through 90 minutes").
- **Calibration:** with Ask me answered cautiously, §13.16 targets and the season's injury count stay within ±10%. Knocks add ≤ 0.3 forced subs per team per match.
- **Tests:** every choice's effect, the severity step-up, the re-injury length, the warm-up chance, the deterministic knock command, and the Instant defaults.

### 12.20 Discipline decisions (v1.7, approved by the user 22 Nov; `core/people/incidents.ts`; bans stay in `core/player/discipline.ts`)
Incidents the manager must deal with. Each is a scene (§11.25.5): the player is called to the office (or knocks), there are speaking beats, then the choice card. Theo may add one line of advice. Until M6b, it's a choice card on the current screen. All numbers go in `K.disc.*`. AI clubs don't simulate this.

#### 12.20.1 Incidents
| Incident | When | Chance |
|---|---|---|
| **Late for training** | WeekSummary, per player | 1.5% base; Relaxed ×2, Professional ×0.2, morale < 30 ×2, Extra sessions ×0.5 |
| **Sent off** | after a match with our direct red or second yellow | always (one per red) |
| **Mouthing off in the press** | WeekSummary, a player with morale < 30 and a broken promise or an "unhappy" conversation in the last 4 weeks | 30%; a back-page headline is generated (§16.6) |
| **Training-ground bust-up** | WeekSummary when cohesion (§12.17.5) < 45; two players, at least one Temperamental | 10%; the incident involves both |

At most one new incident per week (priority: sent off, bust-up, press, late). An incident must be dealt with before Continue (the Continue rule of §10.1).

#### 12.20.2 Choices and effects
Morale numbers are scaled by personality: Professional ×0.5 on negatives, Temperamental ×1.5, Leader ×0.8. Fines go to the club's balance.

| Choice | Player | Dressing room | Other |
|---|---|---|---|
| **Fine him** (a week's wages; two for a repeat within 8 weeks) | morale −8 | cohesion +2 if the offence was clear (late, sent off, bust-up) | a repeat fine of a Temperamental player: 30% he asks to be transfer listed |
| **Drop him** for the next match | morale −6, unavailable for selection | cohesion +1 | — |
| **Warn him** | morale −2 | — | his chance of the same incident ×1.5 for 4 weeks |
| **Let it go** | no change | leaders' morale −3, cohesion −2 | his chance of the same incident ×2 for 4 weeks |
| *Press only:* **Answer him in public** | morale −10; 40% he asks to leave | — | fans +2 |
| *Press only:* **Talk privately** | opens his §12.9 conversation now (with its own replies and effects) | — | — |
| *Bust-up only:* **Side with the senior player** | the younger player's morale −8, the senior's +3 | — | — |
| *Bust-up only:* **Team meeting** (both fined half a week) | both −3 | cohesion +3 | — |

- **Consistency:** the game keeps a 6-week record of offences and punishments. If two players commit the same kind of offence and get different punishment levels (Let it go < Warn < Fine or Drop), cohesion −4 and a memo: "The lads think there's one rule for him and another for them." Leaders are exempt from nothing.
- **Records:** a discipline record shows in the player's file. The inbox keeps each incident and its outcome, and the news covers fines of Star players.
- **Tests:** incident chances, the one-per-week priority, each choice's effects, the personality scaling, the consistency rule, the fine to the balance, and the Continue block.

#### 12.20.3 Content (`club.json` additions)
- **Physio:** knock reads, rush-back offers, warm-up scares, outcomes. 1–2 short lines each, voiced.
- **Incidents:** the opener, per kind, 1 line each.
- **Coach lines** for every choice, voiced, `nameSlot` allowed.
- **Player replies** per choice × personality group (calm, hot-headed): 1 each.
- **Theo's advice** per incident: 1 each.

---

