<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 13. Match engine (complete specification)

The engine is an **abstract possession-and-event simulation** over a 3×3 zone grid plus explicit box/set-piece contexts. It never picks the result first. Actions create chances, chances create shots, shots may create goals. The 3D view (§14) illustrates events; it never decides them.

### 13.1 Coordinate frames
- **Absolute frame** (used in `MatchEvent`): pitch 105 × 68 metres. `x ∈ [0,105]`, `y ∈ [0,68]`. `y = 0` is the touchline nearest the main camera. The home team attacks toward `x = 105` in the first half and toward `x = 0` in the second half.
- **Attacking frame** (used inside the engine for the team in possession): `ax ∈ [0,105]` where `ax = 105` is the goal being attacked; `ay ∈ [0,68]` where `ay = 0` is the attacking team's left touchline.
- `frames.ts` provides `toAbsolute(ax, ay, side, half)` and `toAttacking(x, y, side, half)` and their tests (round-trip, both halves, both sides).
- **Zones** (attacking frame): third `T = DEF (ax < 35) | MID (35 ≤ ax < 70) | ATT (ax ≥ 70)`; lane `L = Left (ay < 22.67) | Centre | Right (ay ≥ 45.33)`. **Box** = `ax ≥ 88.5 && 13.84 ≤ ay ≤ 54.16`. Six-yard = `ax ≥ 99.5 && 24.84 ≤ ay ≤ 43.16`.

### 13.2 Match input and output types
```ts
export interface TeamSheet {
  clubId: ClubId; side: Side; tactics: Tactics; familiarity: number;     // 0–100 for tactics.formation
  players: Record<PlayerId, { attributes: Attributes; positions: Player['positions'];
    condition: number; fatigue: number; morale: number; personality: Personality; name: string; shirt: number }>;
  trainingBonus: { attack: number; defence: number; setPieces: number }; // z-units, §12.3
  focusBoost: number;                                                   // from team talk, §12.8
}
export interface MatchInput {
  fixtureId: FixtureId; home: TeamSheet; away: TeamSheet; isDerby: boolean;
  weather: Fixture['weather']; userSide: Side | null; aiControls: Side[];   // sides run by aiManager
}
export type MatchEventType =
  | 'KICKOFF'|'PASS'|'PASS_FAIL'|'INTERCEPTION'|'LONG_BALL'|'AERIAL_DUEL'|'SWITCH'|'DRIBBLE'|'DRIBBLE_FAIL'
  | 'TACKLE'|'FOUL'|'FREE_KICK'|'CROSS'|'CLAIM'|'CLEARANCE'|'THROUGH_BALL'|'OFFSIDE'|'SHOT'|'BLOCK'|'SAVE'
  | 'MISS'|'POST'|'GOAL'|'CORNER'|'THROW_IN'|'GOAL_KICK'|'YELLOW'|'RED'|'INJURY'|'SUB'|'TACTIC_CHANGE'
  | 'PENALTY_AWARDED'|'ADDED_TIME'|'HALF_TIME'|'FULL_TIME';
export interface MatchEvent {
  seq: number; t: number;               // t = match clock seconds since kickoff of the match (first half 0..2700+stoppage, second half starts at 2700 regardless of first-half stoppage)
  minuteLabel: string;                  // '23', '45+2', '90+4'
  half: 1 | 2; type: MatchEventType; side: Side;    // side = team that performed the action
  playerId?: PlayerId; targetId?: PlayerId; opponentId?: PlayerId;
  from?: { x: number; y: number }; to?: { x: number; y: number };   // absolute frame
  duration: number;                     // sim seconds this event spans (for animation)
  height?: 'ground'|'lofted'|'high';   // ball flight
  shot?: { context: ShotContext; xg: number; onTarget: boolean; bodyPart: 'Foot'|'Head'; target?: { y: number; z: number } };
  importance: 0 | 1 | 2 | 3;           // 0 routine, 1 notable, 2 chance/card, 3 goal/red/penalty
  commentaryKey?: string;               // key into content/commentary.json
  scoreAfter: { home: number; away: number };
}
export interface TeamMatchStats {
  goals: number; shots: number; shotsOnTarget: number; xg: number; possessionSec: number;
  passes: number; passesCompleted: number; corners: number; fouls: number; offsides: number;
  yellow: number; red: number; tackles: number; interceptions: number; saves: number; bigChances: number;
}
export interface PlayerMatchLine {
  playerId: PlayerId; side: Side; minutes: number; rating: number; goals: number; assists: number;
  shots: number; shotsOnTarget: number; keyPasses: number; passes: number; passesCompleted: number;
  dribbles: number; tackles: number; interceptions: number; saves: number; yellow: number; red: number;
  injured: boolean; conditionEnd: number;
}
export interface MatchResult {
  fixtureId: FixtureId; homeGoals: number; awayGoals: number; events: MatchEvent[];
  stats: { home: TeamMatchStats; away: TeamMatchStats }; players: PlayerMatchLine[]; motm: PlayerId;
  injuries: { playerId: PlayerId; injury: Injury }[];
}
```

### 13.3 Engine state
`state.ts`: clock `t` (seconds), `half`, `periodEnd` (2700 + stoppage1 or 5400 + stoppage2, in "match clock" terms; second half clock restarts at 2700), possession side or `null` (dead ball), ball position (attacking frame of the possessing side, plus absolute), ball holder id, `phase` (`Open` | `Counter` (remaining steps) | `SetPiece`), pending restart, on-pitch players per side (ids by slot), bench, subs used and windows used, cards, score, per-player live condition and match line, team stats, RNG, event seq, command queue, current instructions per side, `focusBoost` expiry, momentum (rolling xG window).

### 13.4 Shared maths (`math.ts`)
- `z(a) = (a − 50) / 25`.
- Skill score `S(player, weights) = Σ w_i · z(attr_i)` with Σ w_i = 1, plus the player's **modifiers**: condition penalty (§12.1), morale `0.1 × (morale − 50)/50`, team `focusBoost` (if active), team familiarity `(familiarity − 70)/300`, home advantage `+0.06` for the home side (all contests), training bonus where it applies, weather Rain `−0.08` on passing/firstTouch-based contests.
- `σ(x) = 1/(1 + e^(−x))`. `logit(p) = ln(p/(1 − p))`.
- Softmax choice: `P(i) = exp((U_i − U_max)/τ) / Σ`, `τ = 0.35`.

### 13.5 Involvement (who gets the ball, who defends)
In possession, each on-pitch player has weights over the 9 zones (attacking frame, `D/M/A` × `L/C/R`). Table for left-side or central slots (mirror L↔R for right-side slots; central slots use their own row):

| Slot role | DL | DC | DR | ML | MC | MR | AL | AC | AR |
|---|---|---|---|---|---|---|---|---|---|
| GK | 0 | 1.0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| CB (left of pair) | .30 | .60 | 0 | 0 | .10 | 0 | 0 | 0 | 0 |
| CB (central of three) | 0 | .80 | 0 | 0 | .20 | 0 | 0 | 0 | 0 |
| LB | .45 | 0 | 0 | .40 | 0 | 0 | .15 | 0 | 0 |
| LWB | .30 | 0 | 0 | .40 | 0 | 0 | .30 | 0 | 0 |
| DM | 0 | .35 | 0 | .075 | .50 | .075 | 0 | 0 | 0 |
| CM (left) | 0 | .10 | 0 | .20 | .45 | 0 | .10 | .15 | 0 |
| CM (central) | 0 | .10 | 0 | .10 | .55 | .10 | 0 | .15 | 0 |
| AM | 0 | 0 | 0 | 0 | .25 | 0 | .125 | .50 | .125 |
| LM | .15 | 0 | 0 | .50 | 0 | 0 | .35 | 0 | 0 |
| LW | 0 | 0 | 0 | .30 | 0 | 0 | .55 | .15 | 0 |
| ST (left of pair) | 0 | 0 | 0 | 0 | .15 | 0 | .20 | .65 | 0 |
| ST (lone/central) | 0 | 0 | 0 | 0 | .15 | 0 | .10 | .65 | .10 |

Modifiers (apply then renormalise each player's row to sum 1):
- Mentality Attacking: move 15% of each outfielder's DEF weight to MID and 15% of MID to ATT (CB: half of that). Defensive: the reverse.
- Role and player-instruction involvement modifiers (§13.17.2, §13.17.11) replace the old duty step here.
- Width Wide: wide slots (FB, WB, LM/RM, LW/RW) move 20% of their Centre weight to their lane; Narrow: move 20% of lane weight to Centre.

Out of possession, defenders for a zone are chosen with the same table using the **mirrored** zone (attacker's `(T, L)` → defender's `(opposite third, mirrored lane)`: ATT↔DEF, MID↔MID, Left↔Right).

**Selection:** the receiver of a pass to zone Z = weighted pick among teammates (not the passer, not sent-off) by their weight in Z. If all weights are 0, pick by distance in the slot table order (fallback, test it). The **primary defender** in zone Z = weighted pick among defenders by their weight in the mirrored zone; GK only eligible in the box.

### 13.6 Possession step: candidate actions and base utilities
The holder chooses an action. Legal actions by ball location (attacking frame):

| Location | recycle | progress | long | switch | dribble | through | cross | shot | clear |
|---|---|---|---|---|---|---|---|---|---|
| DEF any lane | 1.2 | 1.4 | 0.6 | 0.4 | 0.4 | — | — | — | 0.2* |
| MID Centre | 1.0 | 1.5 | 0.5 | 0.5 | 0.8 | 0.6 | — | 0.15 | — |
| MID wide | 1.0 | 1.5 | 0.5 | 0.5 | 0.8 | 0.4 | 0.2 | — | — |
| ATT Centre (outside box) | 0.9 | 1.0 | — | 0.4 | 1.0 | 0.8 | — | 0.7 | — |
| ATT wide (outside box) | 0.9 | 1.0 | — | 0.4 | 1.0 | 0.5 | 1.2 | 0.2 | — |
| In box | 0.3 | 0.9 (cut-back/square) | — | — | 0.8 | — | — | 2.2 | — |

`*` clear is legal only in DEF when the step is under pressure (the opponent's pressing is High, or the previous step was a won tackle by the opponent's press).

Tactic modifiers added to utilities:
| Instruction | Effect |
|---|---|
| Mentality Defensive | recycle +0.3, progress −0.2, shot −0.2, long +0.1 |
| Mentality Attacking | progress +0.3, through +0.2, shot +0.2, recycle −0.3 |
| Passing Short | recycle +0.3, progress +0.1, long −0.5, through −0.1 |
| Passing Direct | long +0.6, through +0.3, recycle −0.3 |
| Tempo Slow | recycle +0.3 (and durations ×1.2, execution +0.15) |
| Tempo Fast | progress +0.2, dribble +0.1 (durations ×0.82, execution −0.2) |
| Width Narrow | cross −0.4, switch −0.2 |
| Width Wide | cross +0.4, switch +0.3 |
| Focus Left/Centre/Right | any action whose destination lane is the focus lane +0.3 |
| Counter phase (§13.9) | progress +0.5, through +0.5, recycle −0.5 |
| Score state (≥ 75' and losing) | progress +0.2, shot +0.2, long +0.2 (players naturally push; not a rescue bonus) |
| Opponent line Deep | shot from ATT Centre outside box +0.2 |

### 13.7 Resolving each action
Notation: `A` = actor (holder), `R` = receiver, `D` = primary defender. "ctx" = sum of context terms. All base constants go in `balance.ts` as `K.*`.

**Destinations.** recycle: stay in the same third (60%) or go back one third (40%), lane any (weighted toward Centre 50%). progress: forward one third (or into the box from ATT: 45%), same lane 60% / adjacent 40%. long: forward one or two thirds (DEF→ATT 50%). switch: same third, lane Left↔Right (from Centre: either). dribble: forward within the third (stays, 50%) or into the next third/box. through: to ATT Centre or box (box 60%). cross: into the box. Pick the exact point uniformly inside the destination zone (box: inside the box; avoid the six-yard area except cut-backs: 20% of in-box passes go to six-yard).

**Short passes (recycle, progress, switch, in-box pass):**
`p = σ(K.passBase + 0.9·S_pass(A) + 0.3·z(R.firstTouch) − 0.7·S_press(D) + ctx)`
- `K.passBase`: recycle 2.6, progress 2.2, switch 1.8, in-box pass 1.2.
- `S_pass` = passing .6, decisions .2, composure .2. `S_press` = positioning .5, workRate .3, tackling .2.
- ctx: zone ATT −0.6, MID −0.2; opponent pressing High −0.35 in our DEF/MID (Low +0.2); tempo Fast −0.2, Slow +0.15; Rain −0.08; trainingBonus.attack.
- Success → `PASS`, R becomes holder at destination; counts pass completed. If it was the pass before a shot in the next step, A gets a key pass (and assist if goal).
- Failure → 75% `INTERCEPTION` by D (possession changes at the destination point mirrored), 25% out of play → `THROW_IN` to the opponent at the nearest touchline point.

**Long ball:** delivery `p_d = σ(0.6 + 0.8·z(A.passing) + ctx)`; if delivered, `AERIAL_DUEL`: `p_win = σ(−0.3 + 0.7·S_air(R) − 0.7·S_airD(D) + (opponent line High ? +0.3 : 0))` with `S_air` = heading .6, strength .4 and `S_airD` = heading .5, strength .3, positioning .2. Win → R holds at destination. Lose or undelivered → opponent possession at destination (mirrored); 10% of lost duels are a `FOUL` by the loser (§13.8).

**Dribble:** `p = σ(0.2 + 0.9·S_drib(A) − 0.9·S_tkl(D) + 0.3·(z(A.pace) − z(D.pace)) + ctx)` with `S_drib` = dribbling .5, pace .25, firstTouch .25 and `S_tkl` = tackling .5, positioning .3, strength .2. Success → `DRIBBLE` to destination. Failure → 75% `TACKLE` (D wins the ball), 25% `FOUL` by D (§13.8).

**Through ball:** `p = σ(−0.2 + 0.8·S_tp(A) + 0.6·S_run(R) − 0.8·S_cover(D) + lineCtx + ctx)` with `S_tp` = passing .6, decisions .4; `S_run` = offTheBall .5, pace .5; `S_cover` = positioning .6, pace .4; `lineCtx` = defending line High +0.4, Deep −0.4.
- Success → R holds; with probability `oneOnOne` = High line 0.35, Normal 0.20, Deep 0.10 the next step is a forced `ONE_ON_ONE` shot; else R holds in the box (next step normal).
- Failure → offside with probability High 0.45, Normal 0.25, Deep 0.10 (`OFFSIDE`, indirect free kick to the opponent at the point); otherwise `INTERCEPTION`.

**Cross** (from ATT wide, MID wide (early cross), corners, wide free kicks): taker = A (or set-piece taker).
1. GK claim: `p_claim = 0.12 + 0.06·z(GK.aerialCommand)` → `CLAIM`, opponent possession (GK holds).
2. Delivery: `p_d = σ(−0.3 + 0.8·z(A.crossing) + ctx)` (corners/free kicks use setPieces instead of crossing, + trainingBonus.setPieces). Failure → `CLEARANCE` (25% of failures become a `CORNER` for the attacking side).
3. Header duel: target R = weighted pick among attackers in the box by heading×involvement; D = weighted pick among defenders by heading. `p_win = σ(−0.1 + 0.8·S_air(R) − 0.8·S_airD(D))`. Win → `SHOT` with context `HEADER` (40% of won crosses on the ground instead: `BOX_CENTRAL`). Lose → `CLEARANCE`: 40% second ball to the attackers in MID Centre, 60% to defenders.

**Clearance:** ball goes to MID (60%) or ATT (40%) of the clearing team's frame; possession: 50/50 aerial duel there.

**Shot:** see §13.8.

**Durations (seconds):** recycle 5–9, progress 6–11, long 4–6, switch 5–8, dribble 4–8, through 4–7, cross 4–6, shot 2–3, then restarts: throw-in 12, goal kick 22, corner 30, free kick 25, goal (celebration + kickoff) 60, injury stoppage 45, substitution 30, offside 20. Multiply open-play durations by tempo (Slow 1.2, Normal 1.0, Fast 0.82). Use `rng.int` for ranges. **Possession time** accrues to the side that has the ball for the duration of each step.

### 13.8 Shots, fouls, set pieces
**Shot contexts and reference xG:**

| ShotContext | When | xG_ref | Block prob | Skill weights (S_fin) |
|---|---|---|---|---|
| PENALTY | penalty kick | 0.76 | 0 | setPieces .4, finishing .3, composure .3 |
| ONE_ON_ONE | through ball (§13.7) | 0.38 | 0.05 | finishing .5, composure .5 |
| SIX_YARD | shot from six-yard area | 0.35 | 0.08 | finishing .7, composure .3 |
| BOX_CENTRAL | box, central lane | 0.16 | 0.18 | finishing .6, composure .4 |
| BOX_WIDE | box, wide | 0.07 | 0.18 | finishing .6, composure .4 |
| HEADER | won cross | 0.11 | 0.10 | heading .7, composure .3 |
| REBOUND | after a parried save | 0.25 | 0.10 | finishing .6, composure .4 |
| OUTSIDE_CENTRAL | ATT Centre outside box, MID Centre | 0.035 | 0.28 | longShots .7, composure .3 |
| OUTSIDE_WIDE | ATT wide outside box | 0.02 | 0.28 | longShots .7, composure .3 |
| DIRECT_FK | direct free kick | 0.06 | 0.20 (wall) | setPieces .8, composure .2 |

Keeper skill `S_gk`: ONE_ON_ONE and PENALTY: oneOnOnes .6, reflexes .4; HEADER: reflexes .6, aerialCommand .4; others: reflexes .6, handling .2, oneOnOnes .2.

Resolution:
1. `p_goal = σ(logit(xG_ref) + 0.55·S_fin(A) − 0.55·S_gk(GK) + ctx)` where ctx includes trainingBonus.attack for open play / setPieces for PENALTY and DIRECT_FK, and the defender `D` cover term `−0.15·z(D.positioning)` (not for PENALTY).
2. Block: with `p_block = blockProb + 0.05·z(D.positioning)` (min 0) → `BLOCK`: 30% `CORNER`, 20% the attacking side keeps the ball (MID/ATT Centre outside box), 50% defenders' possession.
3. Otherwise goal with `min(0.95, p_goal / (1 − p_block))` → `GOAL`.
4. Otherwise on target with `p_ot = clamp(0.42 + 0.1·S_fin(A), 0.25, 0.6)` → `SAVE`: catch with `σ(0.0 + 0.8·z(GK.handling))` (defenders' possession, GK), else parry: 40% `CORNER`, 25% `REBOUND` shot by the nearest attacker (weighted by box involvement) in the next step, 35% defenders clear.
5. Otherwise `MISS` (6% of misses hit the post or bar: `POST`, then 50% rebound chance → REBOUND, else goal kick). Miss → `GOAL_KICK`.
- **xG** recorded on the event is always `xG_ref` (public, comparable). Big chance = xG_ref ≥ 0.3.
- Shot target for the animation: `target.y` in [−3.66, 3.66] metres across the goal mouth and `target.z` in [0, 2.44] for on-target/goals; outside those for misses (by up to 4 m wide or 2 m high); posts at ±3.66 or z = 2.44.

**Fouls.** Sources: failed dribble (25%), lost aerial duel (10%), pressing tackles: when the opponent's pressing is High, each opponent possession step in its DEF/MID third has a 2.5% foul chance (Mid 1.2%, Low 0.5%). Foul location = current ball point. Cards per §12.6.
- Foul by the defending team inside its own box (attacking frame box) → `PENALTY_AWARDED`, then PENALTY shot by the penalty taker (or best S_fin on the pitch).
- Foul in ATT Centre within 30 m of goal (ax ≥ 75) → `FREE_KICK`: 50% DIRECT_FK shot by the free-kick taker, 50% cross delivery.
- Foul in ATT wide → `FREE_KICK` cross delivery.
- Elsewhere → `FREE_KICK`, attacking side keeps the ball at the point.

**Corners** → cross resolution with the corner taker using setPieces, header target weighting ×1.3 for CBs and STs (they go up for corners).

**Throw-ins** → the side keeps possession at that point (next step from there with recycle +0.4).
**Goal kicks** → defenders' possession in DEF Centre (Passing Direct: 60% long instead). This is the `Mixed` distribution; other settings in §13.17.4. Corners: `cornersFor`/`cornersAgainst` in §13.17.5.
**Kick-off** → MID Centre, holder = a central midfielder or striker; first action is recycle.

### 13.9 Transitions and counters
When possession changes in open play (interception, tackle, clearance won, claim), set the new holder at the mirrored point. If the ball was won in the winner's DEF or MID third **and** the losing side had Mentality Attacking or its line High, set `phase = Counter` for the next 2 steps (utilities §13.6; the defending side gets ctx −0.3 on its press/cover terms during those steps).

### 13.10 Tactical instructions (descriptions for the UI, exact wording)
- Mentality — Defensive: "Keep men behind the ball." Balanced: "Pick the right moments." Attacking: "Commit players forward."
- Passing — Short: "Keep it on the floor, patient." Mixed: "Mix it up." Direct: "Get it forward quickly, go long."
- Tempo — Slow: "Control the rhythm." Normal: "Natural pace." Fast: "Play at speed; more mistakes."
- Pressing — Low: "Hold shape, save energy." Mid: "Press in midfield." High: "Hunt the ball high; tiring and risky."
- Line — Deep: "Protect the space behind." Normal: "Standard line." High: "Squeeze the pitch; vulnerable to balls in behind."
- Width — Narrow: "Crowd the middle." Normal: "Balanced width." Wide: "Stretch the pitch, cross more."
- Focus — Left / Centre / Right: "Attack through the left / middle / right." Mixed: "No preference."

### 13.11 Stoppage time, halves, and the clock
- First half ends at 2700 + stoppage1, stoppage1 = `clamp(60·(1 + goals1H·0.5 + subs1H·0.5 + injuries1H·1) + rng.int(0,60), 60, 300)` seconds, announced at 45:00 (`ADDED_TIME`). Second half: `clamp(60·(2 + goals2H·0.5 + subs2H·0.5 + injuries2H·1 + cards2H·0.25) + rng.int(0,90), 180, 540)`.
- A step that would cross `periodEnd` finishes; then `HALF_TIME`/`FULL_TIME` (don't cut an attack mid-shot).
- Second-half kickoff by the side that did not kick off first. Teams swap ends (absolute frame).

### 13.12 Commands (user changes mid-match)
```ts
export type MatchCommand =
  | { kind: 'instructions'; side: Side; instructions: TeamInstructions; issuedAtT: number }
  | { kind: 'formation'; side: Side; formation: Formation; lineup: (PlayerId|null)[]; roles: RoleId[]; playerInstructions: PlayerInstruction[][]; issuedAtT: number }
  | { kind: 'opposition'; side: Side; orders: OppOrder[]; issuedAtT: number }
  | { kind: 'sub'; side: Side; outId: PlayerId; inId: PlayerId; slot: number; issuedAtT: number };
```
- Instructions/formation/roles/player instructions/opposition orders take effect at the first step starting at or after `issuedAtT + 30` (a touchline shout).
- Subs take effect at the first dead ball (THROW_IN, GOAL_KICK, CORNER, FREE_KICK, FOUL, OFFSIDE, GOAL, INJURY, HALF_TIME) at or after `issuedAtT`. Limits: 5 subs, 3 in-play windows (half-time changes do not use a window), no re-entry, a sent-off player cannot be replaced.
- The worker, on receiving a command: find the effective step (above). If events beyond it were already produced, restore the snapshot taken at that step (snapshots stored every step in a ring buffer of the last 400 steps), emit `{type:'rewind', fromSeq}`, apply the command, continue. Everything before the effective step stays byte-identical.

### 13.13 AI manager (`aiManager.ts`)
**Lineup:** formation = club style formation (if 2+ of its slots would have fit < 0.8, choose the formation among its familiarity ≥ 60 list with the highest total). Fill slots in this order: GK, CBs, FBs/WBs, DM, CM, AM, wide mids/wingers, STs. For each slot pick the available player maximising `ovrAt(player, slotPos) × (0.7 + 0.3·condition/100) × (morale < 30 ? 0.97 : 1)`, excluding injured, suspended and condition < 60 if any alternative ≥ 0.85 of the best score exists. Bench: best remaining by OVR, ensure 1 GK, then fill to 9.
Captain = highest OVR Leader in the XI, else highest OVR. Takers: penalty = best `S_fin(PENALTY)`, free kick = best setPieces, corner = best setPieces among wide/central mids.
**In-match** (evaluated every 5 match minutes after kickoff):
- At 60', 70', 78': substitute the player with the lowest `condition` if < 65, or lowest rating if < 5.8 (like-for-like position). Max 5 subs, 3 windows.
- Losing at 65'+: Mentality Attacking; at 80'+ losing: also Tempo Fast, Line High, and swap a DM/CB for a forward if subs remain.
- Winning by 1 at 80'+: Mentality Defensive, Tempo Slow.
- Down to 10 men: drop one forward → 4-4-1 equivalent (use 4-4-2 with ST slot empty; involvement renormalised).
- The user's side is never automated except when the user enables "Assistant manages the match" (setting).
The same lineup function powers "Assistant picks best XI".

### 13.14 Match ratings (`ratings.ts`)
Start 6.0. Adjust: goal +1.0 (+0.3 if the winning goal), assist +0.6, key pass +0.15, shot on target +0.1, successful dribble +0.05, tackle/interception won +0.08, pass completion `+(pc − 0.80) × 2` (only with ≥ 10 passes), failed dribble −0.04, foul −0.05, yellow −0.3, red −1.0, error leading directly to a goal (the failed action that started the opponent's scoring possession within 2 steps) −0.6, GK save +0.25, goal conceded −0.25 (GK), −0.10 (on-pitch DEF), clean sheet (60+ minutes) +0.5 for GK and DEF, team win +0.2, loss −0.2. Clamp 3.0–10.0, round to 1 decimal. Players with < 10 minutes get no rating. MOTM = highest rating (tie: more goals, then the winning team, then lower id).

### 13.15 MatchSim API (`engine.ts`)
```ts
export interface MatchSim {
  step(): MatchEvent[];                 // one action and any immediate consequences
  runUntil(t: number): MatchEvent[];
  runToEnd(): MatchEvent[];
  applyCommand(c: MatchCommand): void;  // queues; effect per §13.12
  snapshot(): MatchSnapshot;            // JSON-serialisable, includes rng state
  isFinished(): boolean;
  result(): MatchResult;                // only after FULL_TIME
}
export function createMatch(input: MatchInput, seed: number): MatchSim;
export function restoreMatch(snapshot: MatchSnapshot): MatchSim;
export function simulateInstant(input: MatchInput, seed: number): MatchResult;  // AI-vs-AI and Instant Result
```
`simulateInstant` MUST take < 30 ms per match on a mid laptop (benchmark in the calibration script).

### 13.16 Calibration targets (equal teams, both OVR 68, all Balanced/Mixed/Normal/Mid/Normal/Normal/Mixed, 4-4-2 vs 4-4-2, 5,000 matches)
| Metric | Target |
|---|---|
| Goals per match | 2.5–2.9 |
| Home win / draw / away win | 43–47% / 24–28% / 27–31% |
| Shots per team | 11–14 |
| Shots on target per team | 3.8–5.0 |
| xG per team | 1.2–1.5 |
| Pass completion | 78–86% |
| Passes per team | 300–480 |
| Corners per team | 4.5–6 |
| Fouls per team | 10–13 |
| Yellows per match | 3.0–4.5 |
| Matches with a red card | 5–12% |
| Penalties per match | 0.20–0.32 |
| Offsides per team | 1.5–3 |
| Injuries per match | 0.15–0.35 |
| 0–0 draws | 6–10% |
| Possession std-dev across matches | 4–9 percentage points |

Strength response (same setup, 5,000 matches each):
| Gap (home OVR − away OVR) | Home win % |
|---|---|
| +5 | 55–65 |
| +10 | 68–78 |
| −10 | 15–25 |

Tactic sanity (must hold in the report): Pressing High vs Low (equal teams) → more opponent turnovers in their DEF/MID third and more fouls, and the pressing side's average condition at FT ≥ 4 lower; Width Wide → more crosses (≥ +30%); Passing Direct → fewer passes (≥ −20%) and more aerial duels; Line High → more offsides and more one-on-ones conceded; Mentality Attacking → more shots for and more counter-attacks against.

**Tuning procedure:** only change `K.*` constants in `balance.ts`, in this order: shot utility base (goals and shots), `K.passBase` (pass %), durations (pass counts), cross/delivery constants (corners), foul rates (fouls/cards), skill coefficients 0.55/0.9 (strength response). After each change re-run `npm run calibrate`. Record the final report in `docs/PROGRESS.md`.

