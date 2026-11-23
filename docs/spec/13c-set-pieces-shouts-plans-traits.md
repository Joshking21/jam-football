<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
### 13.20 Set pieces in detail (v1.7, approved by the user 22 Nov; `core/match/setPieces.ts`)
This builds on §13.8, §13.17.5 and §13.18.8. The **defaults reproduce today's behaviour** (one Mixed routine, auto jobs, auto takers, Auto wall, 1 forward up), so §13.16 holds. Every option has a gain and a cost. All numbers go in `balance.ts → K.sp.*`. AI clubs use the defaults with auto jobs.

#### 13.20.1 Jobs on our corners
A corner routine places our outfield players in **jobs**. Players without a job stay in their open-play spots outside the box.

| Job | Max | What it does in the engine |
|---|---|---|
| `nearPost` | 2 | header candidate; weight ×2 when the routine targets the near post |
| `farPost` | 2 | header candidate; weight ×2 when it targets the far post |
| `penaltySpot` | 2 | header candidate; weight ×2 when it targets the spot. Won headers here use `BOX_CENTRAL` instead of `HEADER` 30% of the time |
| `keeperScreen` | 1 | stands on the keeper: GK claim −0.04. Header weight ×0.3 |
| `edge` | 2 | takes second balls. 0 edge players: second balls to us 25%; 1: 40% (default); 2: 50%. A second ball he wins goes to a `LONG_RANGE` shot (utility +0.3) or a recycle |
| `short` | 1 | the short option. Only used when the routine's target is Short |
| `stayBack` | 1–3 | replaces `menBack` (§13.18.8): the count of stay-back jobs is the men back |

- **Header candidates** use the §13.7 weights × the job weight. Attackers not in a box job can't win the header.
- **Auto jobs** (the default; also what "Reset to club style" and Assistant pick): the best 2 by `S_air` go to the target zone, the next best to the other post, the best long-range shooter to `edge`, the two slowest defenders to `stayBack` (2), and the rest stay in their spots. The old 13.8 "CBs and STs ×1.3" rule is replaced by these jobs.

#### 13.20.2 Routines (up to 3 per side)
- A routine is `{ name, target: 'Near'|'Far'|'Spot'|'Short'|'Mixed', swing: 'Auto'|'In'|'Out', jobs }`. Our left and right corners each have up to 3. They are named by the user; the defaults are "Near-post flick", "Big man far post" and "Short".
- `target` replaces `cornersFor` (§13.17.5) and keeps its effects: Near is the Near post row, Far is the Far post row, Short is the Short row, Spot is new (header duel −0.05 for our target, won headers on target +0.03, see 13.20.1), and Mixed is the default.
- **Use:** pick one routine per side, or **Rotate** (1 → 2 → 3 in turn).
- **Predictability:** in a match, the n-th use of the same routine gives the defenders header duel `+0.04 × (n − 1)`, capped at +0.12 ("They've read it"). Rotating keeps n low.
- **Sharpness:** each routine has familiarity 0–100. New routines start at 40 and the defaults at 70. Each Set-piece practice session in the training week (§12.18) adds **15 in total, split equally** across the routines in use (one routine +15; rotating three, +5 each). Routines not practised that week lose 5. Effect: delivery ctx `(familiarity − 70) / 300` (±0.1). Choice: one sharp routine that gets read, or three fresh ones that are blunter.

#### 13.20.3 Takers and swing
- **Takers:** left corner, right corner, direct free kick, wide free kick, penalty order 1, 2 and 3 (the first one on the pitch takes it), long throw. Each defaults to Auto (the §13.13 rule; for corners, the best setPieces with the right foot for an inswinger).
- **Swing from the foot:**
  - **Auto (default):** a Right-footed taker from the left corner, or a Left-footed taker from the right corner, takes an inswinger; the reverse is an outswinger; a Both-footed taker uses the routine's swing, or Mixed. Swing effects are the `cornerSwing` rows of §13.18.8.
  - **Forced swing:** if a routine forces In or Out against the taker's foot, delivery ctx −0.08.
- The `cornerSwing` team field becomes each routine's `swing`.

#### 13.20.4 Our free kicks by area
| Area | Options (UI wording) | Effects and costs |
|---|---|---|
| **Central**, within 30 m (ax ≥ 75) | **Shoot** · **Cross near** · **Cross far** · **Short** · **Dummy and shoot** "One runs over, the other strikes." · **Mixed** (default) | Shoot, Short: the §13.18.8 `freeKicks` rows. Cross near and Cross far: crosses with that target's job weights. Dummy: DIRECT_FK xG_ref +0.02 and wall block −0.05, taken by the second-best setPieces player; cost: 20% of dummies are mistimed and become a recycle with no shot |
| **Wide**, left and right (ATT wide) | **Cross near** · **Cross far** · **To the spot** · **Short** · **Mixed** (default) | As the corner targets, with the same jobs (they reuse that side's active corner routine's jobs) |
| **Deep** (MID third and our half) | **Quick** "Take it quick before they set." · **Long into the box** · **Keep it** (default) | Quick: next step progress +0.3; 15% are rushed and lost. Long: a cross delivery from deep, delivery ctx −0.2, the target is the best `S_air` in a box job. Keep: today's "attacking side keeps the ball" |

#### 13.20.5 Defending corners
On top of `cornersAgainst` (Zonal / Man-mark / Mixed, §13.17.5):
- **Mark their main man:** one of our players is assigned to their best `S_air` (Auto: our best `S_air`). When their header target is that player, our D is this marker. Man-mark: the assignment also applies the −0.15.
- **Post men:** who stands on the posts (`postMen`, §13.18.8), now as named jobs.
- **Edge guard (0 or 1):** with 1, their second balls to attackers −10 points and their `LONG_RANGE` from second balls xG_ref −0.02. Cost: one fewer defender in the box, so their header duel +0.04.
- **Forwards up (0, 1 or 2; default 1):**
  - 0: their header duel −0.05, and our clearances never start a Counter.
  - 1: today's behaviour.
  - 2: their header duel +0.06, and 35% of our won clearances start a Counter phase (§13.9).

#### 13.20.6 Defending free kicks
- **Wall:**
  - **Auto** (default): 3–5 by distance, today's behaviour.
  - **Small**: 2 men. DIRECT_FK `blockProb` 0.12 (from 0.20) and xG_ref +0.01; their cross header duel −0.05 (more markers).
  - **Big**: +1 man. Block 0.26; their header duel +0.05.
- **Who's in the wall:** Auto picks the tallest. The block chance also gets `+0.02 × mean z(heading, strength)` of the wall players.
- **Line height on wide free kicks:**
  - **High:** 20% of their deliveries are caught offside (indirect free kick to us), but when a delivery beats the line, their header xG_ref +0.03.
  - **Normal** (default).
  - **Deep:** GK claim +0.04, their second balls to attackers +10 points.

#### 13.20.7 What the player sees (Tactics, §11.8)
- The **Set pieces** divider opens **set-piece mode**: the whiteboard zooms to the attacking box (ours) or our box (theirs). The jobs are drawn as marker circles labelled Near, Far, Spot, Keeper, Edge, Short and Back.
- **Tabs on the board:** Our corners (Left and Right, routines 1–3, Rotate), Their corners, Our free kicks (Central, Wide, Deep), Their free kicks, Takers.
- **Assigning jobs:** drag a magnet onto a circle, or use the keyboard (Enter on a magnet, then Enter on a circle). A full circle swaps players.
- **Marker drawings:** the routine draws its delivery arc (curving in or out from the taker's foot), the runs to each job, and the edge player's shot line. Rename a routine by clicking its name.
- **Every option shows its gain and cost line,** as in §13.17.6.
- **The routine familiarity bar** shows on each routine, with "Practise it in training (Set-piece practice)" under 70.
- In Pre-Match step 2 and the in-match Tactics overlay, a compact version: pick the routine per side, Rotate, Forwards up, Wall.

#### 13.20.8 In the 3D match (§14.3)
At corners and free kicks, the choreographer places players at their job spots: Near (5 m out, near post), Far (far post), Spot (penalty spot), Keeper (on the six-yard line in front of the GK), Edge (the D), Short (5 m from the taker), Back (halfway line, or our box edge for 2+). The opponent sets up as its own jobs say. Delivery and runs follow the routine's target and swing.

#### 13.20.9 Analysis, AI and the assistant
- **Full-Time and Club analysis:**
  - corners and free kicks won
  - shots and goals from each routine
  - set-piece goals conceded
  - who won the most headers in each box
- **The opponent report** (§15.2) shows their set-piece threat (their best `S_air` and their usual target), and suggests a marker and the posts.
- **AI clubs:** auto jobs, one Mixed routine, Auto wall, 1 forward up. A rep ≥ 4 AI club with a strong header (`S_air` z ≥ 1.0) targets its best header's zone.
- **Assistant rules:**
  - "They've read our near-post routine. Rotate?" when n ≥ 3 and two headers were lost to the marker.
  - "Put [best header] on their [target man]" before matches.
  - "Drop a forward back, they're winning everything at corners" when they've won ≥ 3 headers in our box in 20 minutes.

#### 13.20.10 Calibration and tests (add to §13.18.13; equal teams, 2,000 matches each)
- **Defaults:** all §13.16 targets unchanged. Set-piece goals are 22–32% of all goals.
- **Predictability:** the same routine for every corner in a match. Its header goal rate from the 5th use onward is ≥ 20% lower than from the first two uses.
- **Practice:** one routine practised twice a week for 4 weeks vs the default. Corner goals rise by 10–30%, never more.
- **No dominant choice:** the ±6-point rule covers every routine, job layout, wall and forwards-up setting. The best "all headers in one zone" layout must not beat auto jobs by more than +4 points.
- **Unit tests:** job weights, Rotate order, the predictability cap, the familiarity split, swing from the foot, each free-kick area, the wall and line options, and the forwards-up counters.

### 13.21 Touchline shouts (v1.7, approved by the user 22 Nov)
Short instructions shouted from the touchline during a match. They use the §13.17.1 modifier vocabulary and last **10 match minutes**.
- **Command:** `{ kind: 'shout'; side; shout: ShoutId; issuedAtT }` takes effect at the first step at or after `issuedAtT + 10`. It is faster than other commands (30 s, §13.12) because it's a shout, not a tactics change.
- **One shout active at a time;** a new shout replaces the old one. The same shout again within 15 minutes of its last end has **half the effect** ("They've heard it").
- **In the HUD:** a Shout button and key `Y` open a wheel of the 7 shouts, each with its gain and cost line. The active shout shows as a chip with a 10-minute ring.
- **Presentation:** a touchline cut (§14.11.5) with `Shout` and a voiced line (`club.json`, ≥ 3 per shout, `nameSlot` none).

| Shout | Wording | Gain | Cost |
|---|---|---|---|
| `pushForward` | "Push forward!" | mentality one step up (§13.18.1) | fatigue drain ×1.1; their Counter phases +20% |
| `keepTight` | "Keep it tight!" | mentality one step down; their shot ctx −0.04 | our shot utility −0.2 |
| `getStuckIn` | "Get stuck in!" | as D tackle ctx +0.1 for all | fouls ×1.4; Temperamental players' card chance ×1.3 |
| `calmDown` | "Calm down!" | fouls ×0.7; Temperamental card chance ×0.7 | as D tackle ctx −0.05 |
| `concentrate` | "Concentrate!" | their shot ctx −0.03 and our pass ctx +0.02 | only after 75' or within 5' of conceding; once per half |
| `encourage` | "Well done, keep going!" | `focusBoost` +0.02 for the 10' (§12.8); morale +1 for anyone rated ≥ 7 | when winning by 2+: complacency, so `focusBoost` −0.01 instead |
| `demandMore` | "That's not good enough!" | `focusBoost` +0.03 when drawing or losing; Ambitious and Leader ×1.3 | Relaxed ×0.5; Temperamental: 40% chance it flips to −0.02; when winning: morale −1 for all |

- **AI managers:** `pushForward` when losing at 75'+, `keepTight` when winning by 1 at 80'+, `calmDown` when a player is on a yellow card and the foul rate is high. These are only for clubs rated reputation ≥ 3.
- **Assistant (§15.4):** suggests a shout when its rule fits, for example "Two of ours on yellows, calm them down?". Apply sends the shout.
- **Calibration:** no shout moves the equal-team win rate by more than ±3 points over a match. `pushForward` from 75' when losing raises our late goals ≥ +15% and their late goals ≥ +15%.

### 13.22 Match plans (v1.7, approved by the user 22 Nov)
Automatic changes set before the match, so your plans still work in Instant result and fast-forward.
- **Rules:** up to **4** per match, each `{ when, after, then }`:
  - `when`: Losing · Drawing · Winning by 1 · Winning by 2+ · We go down to 10 · They go down to 10
  - `after`: 0' · 45' · 60' · 70' · 75' · 80' · 85'
  - `then`: switch to Plan A, B or C (§13.18.10), or a shout (§13.21)
- **How they fire:** the engine checks the rules at every step. A rule fires the first time its condition holds after its minute, and then issues the command itself (`issuedAtT` = now), so it is deterministic. Each rule fires at most once per match. If two rules match at the same step, the higher one in the list wins. The others wait until their condition holds again.
- **"Ask me first" (on or off, default on):** in live playback, a firing rule pauses the match with a card: "Losing after 70'. Switch to Plan B?" (Apply or Skip, 6 s, then it applies). In Instant result, or when off, it applies silently and shows in the commentary and HUD feed ("Plan B on, as planned").
- **UI:** a **Match plan** sheet on the Tactics clipboard, with rows like "If [we're losing] after [70'], [switch to Plan B]". Theo proposes a default set (losing at 70' → the most attacking plan; winning by 1 at 80' → the most defensive plan) with Apply.
- **Cost:** no extra cost. The switched-to plan still pays its own familiarity (§13.18.11), so a rule that switches to a plan you never use is weaker than it looks.
- **AI managers** keep their own §13.13 rules.
- **Tests:** firing order, fire-once, determinism (the same seed and rules give the same events), the Instant result path, and the 10-men conditions.

### 13.23 Player traits (v1.7, approved by the user 22 Nov)
Habits that make players play differently. **0–3 per player**, as `Player.traits: TraitId[]`, using the §13.17.1 modifier vocabulary. Traits apply in full (not scaled by role fit). They stack with role and instructions, and don't count toward the 2-instruction cap.

| Trait | Wording | Who can have it (needs) | Effect | Cost |
|---|---|---|---|---|
| `cutsInside` | "Cuts inside from the wing" | wide players (dribbling ≥ 60) | inv ATT `lane→C` 20%; use shot +0.2 from ATT wide | his crosses −40% |
| `shootsFromDistance` | "Shoots from distance" | longShots ≥ 60 | use shot +0.3 outside the box | low-xG shots; possession lost on misses |
| `getsForward` | "Gets forward whenever possible" | DEF and MID (stamina ≥ 60) | inv DEF→ATT 10% | their Counter shot ctx +0.05 down his side |
| `staysBack` | "Stays back at all times" | DEF and DM | inv ATT→DEF 15%; their Counter ctx −0.04 | fewer attacking touches |
| `playsOneTwos` | "Plays one-twos" | passing ≥ 60 | after his short pass, the receiver's return pass to him recv ×1.4, pass ctx +0.05 | dribble use −0.2 |
| `killerBalls` | "Tries killer balls often" | passing ≥ 65 | use through +0.3 | interceptions +15% on his passes |
| `runsWithBall` | "Runs with the ball often" | dribbling ≥ 60 | use dribble +0.25 in MID | ball lost in MID +10% |
| `arrivesLate` | "Arrives late in the box" | CM and AM (offTheBall ≥ 60) | recv ×1.3 on cutbacks and `BOX_CENTRAL` | his DEF cover −10% |
| `holdsUp` | "Holds up the ball" | ST (strength ≥ 65) | as R firstTouch +0.15 on long balls; next step recycle +0.2 | through-ball receptions −20% |
| `comesDeep` | "Comes deep to get the ball" | ST and AM | inv ATT→MID 15% | box receptions −15% |
| `attacksAir` | "Attacks the ball in the air" | heading ≥ 65 | `S_air` +0.1 at corners and crosses | fouls in aerial duels ×1.2 |
| `divesIn` | "Dives into tackles" | any outfield | as D `S_tkl` +0.15 | fouls ×1.4 |

- **World generation (§9):** each eligible trait is rolled once, with chance `0.08 + 0.25 × clamp((keyAttr − needs) / 20, 0, 1)` (cap 3, the best-matching kept). About 55–65% of players get at least one. AI players' traits apply too; they're cheap to simulate.
- **Clashes:**
  - With an instruction that opposes a trait (`shootsFromDistance` + `shootLess`, `getsForward` + `holdPosition`, `divesIn` + `stayOnFeet`), the **instruction wins** and the trait's effect is off.
  - Each week he plays against his trait, morale −1 ("Doesn't like being told"), and a memo after 3 weeks.
  - A trait that matches his role (`cutsInside` on an inside forward) gives +0.05 to that role's gain modifiers.
- **Learning and unlearning (training):** a fourth individual focus type, **Trait** (§12.17.4, §12.18.5). You pick a trait to learn (he must meet its needs) or one to unlearn.
  - Progress per week: `8 + (age ≤ 23 ? 4 : age ≥ 30 ? −3 : 0) + (decisions ≥ 70 ? 2 : 0)`, times the coach factor (§12.17.1). It completes at 100.
  - **Cost:** his development that week × 0.8, the same as position training.
  - An inbox memo on completion: "Mensah now plays one-twos."
- **Where you see them:**
  - trait chips in the player's file (they also explain clashes)
  - in Squad, as a filter
  - in the opponent report ("Their 7 cuts inside, show him outside?")
  - in scouting, only once knowledge ≥ 50 (§12.12)
- **Calibration:** with world-gen traits on, every §13.16 target still holds. No single trait moves an equal-team win rate by more than ±2 points.


---

