<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
### 13.17 Tactical depth: roles, opposition orders, transitions, set pieces
This section adds the decisions that let one change turn a match. Design rules (MUST):
- **No free lunch.** Every role, order and setting has a gain and a cost written into its numbers, and the UI shows both in one line each. Nothing is strictly better than the neutral choice.
- **Neutral defaults.** Every slot's default role and every new setting's `Mixed` value have zero modifiers, so the §13.16 calibration targets still hold with defaults.
- **Fit matters.** A role suits some players and not others. A badly suited player gets the role's risks in full but only part of its gains.
- All numbers below go in `balance.ts` (`K.roles.*`, `K.opp.*`, `K.trans.*`, `K.setp.*`, `K.pi.*`) or in the role table `src/config/roles.ts`.
- **Priority (the user's call, 19 Nov):** tactical depth outranks visual polish. If time runs short, cut or simplify visual and motion work (§14, §19.7) before any part of this section. Every rule here MUST work in the engine, even if its UI ends up plain.

#### 13.17.1 Modifier vocabulary
Each role or order is a list of modifiers of these kinds:
- **inv** (involvement, applied in §13.5 after the mentality step, in place of the old duty step, then renormalise): `X→Y n%` moves n% of the player's weight in group X to group Y. Groups: `DEF`, `MID`, `ATT` (thirds), `lane→C` (from his own lane to Centre in the same third), `C→lane` (the reverse).
- **recv** (receiver weight ×k): multiplies his weight when teammates pick a receiver (§13.5 selection), optionally limited to thirds.
- **use** (holder utilities, §13.6): added to an action's utility when he has the ball.
- **as A / as R / as D** (resolution ctx, §13.7–13.8): added to the ctx of rolls where he is the actor, the receiver, or the primary defender. `S_x +v` means add v to that skill term before weighting.
- **team** (a team-wide ctx term while he is on the pitch; if two players give the same team term, only the larger applies).
- **cost**: fatigue drain multiplier (§12.2), foul probability multiplier (§13.8).

**Fit**: `score = Σ w·attribute` over the role's key attributes; `fit = clamp((score − 50) / 30, 0, 1)`. Positive modifiers (gains) are multiplied by `0.4 + 0.6·fit`; negative modifiers (risks and costs) always apply in full. The UI shows fit as 1–5 stars: `1 + round(4·fit)`. Neutral roles have no modifiers, so fit does not matter for them.

#### 13.17.2 Roles (replace duties)
Every slot has a role. Slot groups and their roles (first one listed = neutral default):

| Role id | Name (UI) | Slots | Description (UI, exact) | Gains | Risks / costs | Key attributes |
|---|---|---|---|---|---|---|
| `gk` | Goalkeeper | GK | "Stays on his line." | none | none | none |
| `sweeper_keeper` | Sweeper keeper | GK | "Comes off his line to sweep behind the defence." | team: opponent through balls ctx −0.3, their `oneOnOne` probability ×0.75; Short distribution pass ctx +0.2 | opponent OUTSIDE_CENTRAL `xG_ref` +0.02 (he's off his line); 3% of opponent through balls become a GK foul outside the box (FREE_KICK) | oneOnOnes .4, decisions .3, passing .3 |
| `cb` | Centre-back | CB | "Defends his zone." | none | none | none |
| `stopper` | Stopper | CB | "Steps out to win it early." | as D: `S_tkl` +0.35, `S_press` +0.25, `S_airD` +0.2 | when he is D and loses a tackle or duel, the opponent's next step gets through ctx +0.3; fouls ×1.2 | tackling .4, strength .3, heading .3 |
| `covering_cb` | Covering centre-back | CB | "Drops off and sweeps up behind." | team: opponent through balls ctx −0.25 | as D: `S_tkl` −0.15, `S_press` −0.2 | positioning .4, pace .4, decisions .2 |
| `ball_playing_cb` | Ball-playing centre-back | CB | "Brings it out and starts attacks." | use in DEF: progress +0.3, switch +0.2, long +0.1; as A: pass ctx +0.15 | when the opponent's pressing is High, his failed passes are always interceptions in our DEF (no throw-in) and the opponent's next step gets shot utility +0.3 | passing .5, composure .3, decisions .2 |
| `fb` | Full-back | LB, RB, LWB, RWB | "Gets forward when it's on." | none | none | none |
| `fb_defensive` | Defensive full-back | LB, RB, LWB, RWB | "Stays home and guards the flank." | team: opponent actions in his lane in our DEF ctx −0.15 | inv `ATT→DEF 60%`, `MID→DEF 15%`; use: cross −0.3 | positioning .4, tackling .4, strength .2 |
| `fb_overlapping` | Overlapping full-back | LB, RB, LWB, RWB | "Bursts past the winger to cross." | inv `MID→ATT 25%`; use: cross +0.4; team: crosses from his lane delivery +0.1 | during an opponent Counter phase, their actions in his lane ctx +0.25; fatigue ×1.08 | crossing .4, pace .3, stamina .3 |
| `fb_inverted` | Inverted full-back | LB, RB, LWB, RWB | "Steps into midfield when we have it." | inv `lane→C 40%` in MID; team: our recycle and progress passes in MID ctx +0.1; use: progress +0.2 | use: cross −0.4; during an opponent Counter phase, their actions in his lane ctx +0.2 | passing .4, decisions .3, firstTouch .3 |
| `dm` | Holding midfielder | DM | "Shields the back line." | none | none | none |
| `anchor` | Anchor | DM | "Never leaves the space in front of the defence." | inv `MID→DEF 20%`, `ATT→MID 50%`; team: opponent actions in their ATT Centre ctx −0.15; use: recycle +0.3 | use: progress −0.2, through −0.2 | positioning .5, tackling .3, decisions .2 |
| `deep_playmaker` | Deep playmaker | DM, CM | "Dictates play from deep." | recv ×1.3 in DEF/MID; use: switch +0.3, long +0.2, through +0.2; as A: pass ctx +0.1 | when the opponent's pressing is High, his failed passes start an opponent Counter phase | passing .5, decisions .3, composure .2 |
| `ball_winner` | Ball-winner | DM, CM | "Hunts the ball down." | as D: `S_press` +0.4, `S_tkl` +0.3 | fouls ×1.5; fatigue ×1.1; use: through −0.2 | tackling .4, workRate .3, stamina .3 |
| `cm` | Central midfielder | CM | "Does a bit of everything." | none | none | none |
| `box_to_box` | Box-to-box | CM | "Covers every blade of grass." | inv `MID→ATT 10%`, `MID→DEF 10%`; as D in MID: `S_press` +0.2 | fatigue ×1.12 | stamina .4, workRate .3, passing .3 |
| `playmaker` | Playmaker | CM, AM | "Gets on the ball and picks the pass." | recv ×1.25; use: through +0.35, progress +0.1; as A: pass ctx +0.1 | as D: `S_press` −0.2, `S_tkl` −0.1 | passing .4, decisions .3, firstTouch .3 |
| `runner` | Late runner | CM | "Arrives late in the box." | inv `MID→ATT 25%` (into ATT Centre); use in box: shot +0.3; as R on through balls: `S_run` +0.2 | team: opponent progress passes through our MID ctx +0.1 | offTheBall .5, finishing .3, stamina .2 |
| `am` | Number 10 | AM | "Links midfield and attack." | none | none | none |
| `shadow_striker` | Shadow striker | AM | "Plays off the striker and gets in the box." | inv `MID→ATT 30%`; use in ATT Centre and box: shot +0.3; as R on through balls: `S_run` +0.2 | as D in MID: `S_press` −0.2, `S_tkl` −0.2 | offTheBall .4, finishing .4, composure .2 |
| `wm` | Wide midfielder | LM, RM | "Works the flank both ways." | none | none | none |
| `wm_defensive` | Defensive winger | LM, RM, LW, RW | "Tracks back to help his full-back." | inv `ATT→MID 30%`, `MID→DEF 15%`; team: opponent actions in his lane in our DEF ctx −0.15 | use: cross −0.1, dribble −0.1 | workRate .4, tackling .3, stamina .3 |
| `wide_playmaker` | Wide playmaker | LM, RM | "Drifts inside to make things happen." | inv `lane→C 25%` in MID; use: through +0.3, switch +0.2 | use: cross −0.3 | passing .4, decisions .3, dribbling .3 |
| `wf` | Wide forward | LW, RW | "Attacks his flank." | none | none | none |
| `winger` | Winger | LM, RM, LW, RW | "Hugs the line, beats his man, crosses." | inv `C→lane 25%`; use: cross +0.4, dribble +0.2 | use: shot −0.2 | crossing .4, dribbling .3, pace .3 |
| `inside_forward` | Inside forward | LM, RM, LW, RW | "Cuts inside to shoot." | inv `lane→C 30%` in ATT; use in ATT: shot +0.4, dribble +0.1; 50% of his shots from ATT wide use the central context instead (BOX_CENTRAL / OUTSIDE_CENTRAL); if the full-back behind him is Overlapping, that full-back's cross delivery +0.15 | use: cross −0.5; if the full-back behind him is Defensive or Inverted, nobody holds the width: team cross utility from that lane −0.3 | finishing .3, dribbling .3, longShots .2, pace .2 |
| `st` | Striker | ST | "Leads the line." | none | none | none |
| `target_man` | Target man | ST | "Wins headers and holds it up." | team: long utility +0.2; as R in aerial duels: `S_air` +0.35; cross header target weight ×1.4; after he wins an aerial duel, the next step's recycle and progress pass ctx +0.2 (knock-down to a runner) | use: dribble −0.3; as R on through balls: `S_run` −0.2 | heading .4, strength .4, firstTouch .2 |
| `poacher` | Poacher | ST | "Lives in the box." | inv `MID→ATT 50%`, `lane→C 20%` in ATT; use in box: shot +0.3; as A on SIX_YARD/BOX_CENTRAL shots: `S_fin` +0.15 | recv ×0.5 outside ATT; team: our pressing effect in the opponent's DEF third is 10% weaker | finishing .4, offTheBall .4, composure .2 |
| `pressing_forward` | Pressing forward | ST | "Leads the press from the front." | team: our `S_press` +0.3 against the opponent's DEF third; opponent passes in their DEF third ctx −0.2 | fatigue ×1.15; use: shot −0.1 | workRate .4, stamina .3, pace .3 |
| `false_nine` | False nine | ST | "Drops deep and drags defenders out." | inv `ATT→MID 35%` (ATT Centre → MID Centre); recv ×1.2 in MID; use: through +0.4, progress +0.2; team: teammates' `S_run` on through balls +0.25 | his cross header target weight ×0.5; team: header duels won from crosses −0.15 (fewer bodies in the box) | passing .3, decisions .3, firstTouch .2, dribbling .2 |
| `advanced_forward` | Advanced forward | ST | "Runs in behind the defence." | recv ×1.4 on through balls; as R: `S_run` +0.3; `oneOnOne` probability +0.05 on his runs | offside probability ×1.25 on his runs; recv ×0.7 in MID | pace .4, offTheBall .4, finishing .2 |

Slots LM/RM may use `wm`, `wm_defensive`, `wide_playmaker`, `winger`, `inside_forward`; LW/RW may use `wf`, `winger`, `inside_forward`, `wm_defensive`. The "full-back behind him" is the FB/WB slot on the same side.

#### 13.17.3 Opposition orders
`orders: OppOrder[]`, at most 3, one per target, targets must be on the pitch (an order on a substituted player lapses; on a sent-off player it is removed). The **marker** for a target = our defender with the highest weight in the target's mirrored zone at the moment the order starts (recomputed after any formation change or sub).

| Order | UI wording (exact; `{player}` = target) | Effect | Cost |
|---|---|---|---|
| `tightMark` | "Stay touch-tight on {player}. He'll see less of the ball, but his marker gets dragged about." | target recv ×0.75; in any roll where the target is A or R, the marker is D and gets `S_press` and `S_tkl` +0.3 | when the target is in MID, opponent through balls into the marker's usual zone get ctx +0.2; marker fouls ×1.2 |
| `doubleUp` | "Two on {player} whenever he has it. It leaves space on the other side." | when the target holds: dribble ctx −0.5, shot and cross ctx −0.2, pass ctx −0.1 | opponent actions in the lane opposite the target's lane ctx +0.2. Max one `doubleUp` |
| `pressOnBall` | "Close {player} down the moment he gets it. If he beats the press, we're open." | when the target holds in his DEF/MID: our `S_press` +0.4 on him, his pass ctx −0.3, his recycle utility +0.3 | if his pass succeeds, the opponent's next step gets progress +0.3 and through +0.2; fatigue ×1.05 for our player nearest him |
| `showInside` | "Force {player} inside. Fewer crosses, more shots." (wide players and full-backs only) | target cross utility −0.5, dribble −0.2 | target shot utility in ATT +0.2; 50% of his ATT-wide shots use central contexts |
| `showOutside` | "Force {player} down the line. Fewer shots, more crosses." (wide players and full-backs only) | target shot utility −0.4; his ATT-wide shots keep wide contexts | target cross utility +0.2, dribble +0.1 |

#### 13.17.4 Transitions and goalkeeper distribution (new instruction fields)
| Field | Options (UI wording, exact) | Effect | Cost |
|---|---|---|---|
| `onLoss` (when we lose it) | **Counter-press** "Win it back in seconds. Get it wrong and they're through." · **Regroup** "Get back into shape and let them have it." · **Mixed** "Read the moment." (default) | Counter-press: when we lose the ball in open play in our MID or ATT third, the opponent's first step is a press check: `p_regain = σ(−1.0 + 0.8·S̄_press − 0.6·S_pass(holder))` (S̄_press = mean `S_press` of our 3 players with the highest weight in that zone); success = `TACKLE` back to us at that point. Regroup: an opponent Counter phase (§13.9) can only start if our line is High (not from our mentality), and their first step gets recycle +0.3 | Counter-press: if the press check fails, the opponent gets a Counter phase for 2 steps with an extra ctx +0.2; team fatigue ×1.05. Regroup: we never win the ball back in their half on the first step; their next 2 steps' pass ctx +0.1 |
| `onWin` (when we win it) | **Counter** "Break at speed." · **Keep it** "Calm down and keep the ball." · **Mixed** "Read the moment." (default) | Counter: our Counter phase starts when we win the ball in DEF/MID if the §13.9 condition holds, or with probability 0.4 otherwise. Keep it: our first 2 steps after winning it get recycle +0.4 and pass ctx +0.1 | Counter: Counter-phase execution ctx −0.1 (rushed). Keep it: we never get a Counter phase |
| `distribution` (goalkeeper) | **Short** "Play out from the back." · **Long** "Go long to the front men." · **Wide** "Find the full-backs." · **Mixed** "Keeper's choice." (default, the old §13.8 goal-kick rule) | Short: goal kicks and held saves/claims go to a CB in DEF Centre, first action utilities as normal. Long: a long ball from the GK to MID/ATT Centre (aerial duel; target man bonus applies). Wide: to a FB/WB in his DEF lane, first action progress +0.2 | Short: against opponent pressing High, the first pass ctx −0.4 and a failed first pass gives the opponent the ball in our DEF Centre. Long: 45% of deliveries are contested (aerial duel instead of a clean catch). Wide: the first pass is forced to the touchline lane (switch and through not allowed on that step) |

#### 13.17.5 Set pieces (new instruction fields)
| Field | Options (UI wording, exact) | Effect | Cost |
|---|---|---|---|
| `cornersFor` (our corners) | **Near post** "Flick-ons at the near post." · **Far post** "Big men at the back stick." · **Short** "Work it short and keep the ball." · **Mixed** "Taker's choice." (default) | Near post: GK claim −0.04; header target weight favours pace (heading .5, pace .5); won headers use `xG_ref` 0.13. Far post: header target weight ×1.5 for the best header; header duel +0.2 for our target. Short: no cross; we keep the ball in ATT wide outside the box, next step cross utility +0.3 | Near post: delivery ctx −0.1. Far post: GK claim +0.03. Short: no immediate header chance |
| `cornersAgainst` (their corners) | **Zonal** "Defend the space." · **Man-mark** "Pick up a man each. Watch the wrestling." · **Mixed** "Bit of both." (default) | Zonal: their Near post deliveries ctx −0.15. Man-mark: our header defender is our best header matched to their target; header duel −0.15 for them | Zonal: their Far post header duel +0.1 for them. Man-mark: 4% of their corners become a foul in our box (penalty) |

#### 13.17.6 What the player sees (Tactics, §11.8)
- Click a magnet → its **role card** (a Sheet): the slot's roles as a list, each with the name, fit stars for this player, the description, and two short lines "Gives you: …" / "Costs you: …" generated from the modifier list (templates in `content/tactics.json`, one per modifier kind, e.g. "more crosses", "space behind him on the counter").
- The clipboard is grouped: **With the ball** (mentality, passing, tempo, width, focus), **Without the ball** (pressing, line), **Transitions** (when we lose it, when we win it, goalkeeper), **Set pieces** (our corners, their corners, takers). Each option shows its exact wording above.
- The role card also holds that player's **instructions** (§13.17.11): up to 2, as toggles with their gain and cost lines; conflicting ones are disabled with the reason.
- **Opposition** tab: the opponent's likely XI as red-marker magnets on a second board; click one → choose an order (only valid ones shown), with its wording and cost line. Shows "2 of 3 orders used".
- In Pre-Match step 2 and in the match Tactics overlay, the same controls in compact form.

#### 13.17.7 Key battles (Pre-Match opponent report and half-time)
Show up to 3 duels with an arrow to the side that has the edge: our FB vs their winger in each lane (pace + dribbling vs pace + tackling), our CBs vs their ST (heading + strength vs heading + strength; pace vs pace if their ST is an Advanced forward), our DM vs their AM/false nine (positioning + tackling vs decisions + passing). Edge = difference of the summed z-scores; label "big edge" when |diff| ≥ 1.0. Pure UI, computed from attributes and roles; the assistant uses it (§15.2).

#### 13.17.8 AI managers (§13.13 additions)
- Roles: for each slot pick the best-fit role in the slot's list; keep the neutral role unless the best fit ≥ 0.6. Club style overrides when the player's fit ≥ 0.5: Passing Direct → ST `target_man`; Pressing High → ST `pressing_forward`; Width Wide → wide slots `winger`; Passing Short → one CB `ball_playing_cb`; Mentality Defensive → DM `anchor` and FBs `fb_defensive`.
- Transitions: Pressing High + Mentality Attacking → `onLoss` Counter-press; Mentality Defensive → `onLoss` Regroup and `onWin` Counter; Passing Direct → `distribution` Long. Everything else Mixed.
- Orders: clubs with reputation ≥ 3 put `tightMark` on the user's highest-OVR attacker if his OVR ≥ their best defender's OVR + 5. In-match: `doubleUp` on a user player with ≥ 2 goals + assists in the match (once).

#### 13.17.9 Assistant rules (add to §15.2 and §15.4)
Pre-match (each with Apply):
- Their highest-OVR attacker ≥ our best defender + 5 → "Put {marker} touch-tight on {player}." (`tightMark`)
- Their slowest CB pace ≤ 60 and our best ST pace ≥ 75 → "Make {player} an advanced forward and go in behind." (role + Passing Direct)
- Their CB with passing ≤ 55 → "Press {player} when he has it. He'll panic." (`pressOnBall`)
- Their Inside forward with longShots or finishing ≥ 75 → "Show {player} outside. Make him cross." (`showOutside`)
- Their best header ≥ our best header + 8 → "Go zonal at their corners." (`cornersAgainst` Zonal)
- Their pressing High and our GK passing ≤ 50 → "Don't play out from the back today. Go long." (`distribution` Long)
In-match (last 15 minutes of events):
- An opponent with ≥ 2 shots or key passes → "{player} is running the show. Get two on him." (`doubleUp`)
- Our Counter-press failed ≥ 3 times and they had a Counter phase each time → "We're getting caught. Regroup when we lose it." (`onLoss` Regroup)
- Our far-post corners lost ≥ 3 header duels → "Their keeper's eating the back post. Try near post." (`cornersFor` Near post)
- Our full-back role Overlapping and they had ≥ 2 Counter-phase attacks down his lane → "{player} keeps getting caught upfield. Tell him to stay home." (role `fb_defensive`)

#### 13.17.10 Calibration additions (§13.16)
With all defaults (neutral roles, Mixed settings, no orders) every §13.16 target still holds. Add these sanity checks (equal teams, 2,000 matches each), all MUST hold:
- `tightMark` on the opponent's most-involved CM → his touches −20% to −35%.
- Counter-press vs Mixed → our ball wins in the opponent's MID/ATT third ≥ +25%, and Counter phases conceded higher.
- Target man + Passing Direct → aerial duels won by that striker ≥ +30%.
- Inside forward vs Winger (same player) → his shots ≥ +40%, his crosses ≤ −40%.
- Sweeper keeper with Line High → one-on-ones conceded ≥ −20% vs `gk`.
- **No dominant choice:** no single role, order, setting or player instruction moves the win rate between equal teams by more than ±6 percentage points.
- "Shoot more" on a player with longShots ≤ 50 → his xG per shot falls and his team's possession falls (shots from bad spots give the ball away).

#### 13.17.11 Player instructions
`playerInstructions: Record<slotIndex, PlayerInstruction[]>`, at most 2 per player, stacked on top of his role. Pairs that contradict each other (more/less of the same thing, Get forward + Hold position) cannot be combined. Instructions belong to the slot and move with a swap.

| Instruction | UI wording (exact) | Effect | Cost |
|---|---|---|---|
| `shootMore` | "Shoot more: try his luck from distance." | use: shot +0.35 (also allowed from MID Centre and ATT wide at OUTSIDE contexts) | more low-xG shots; a blocked or missed long shot gives up possession |
| `shootLess` | "Shoot less: work a better chance." | use: shot −0.35 outside the box, progress +0.15 | fewer shots; more passes in the final third (more chances to lose it) |
| `dribbleMore` | "Take players on." | use: dribble +0.35 | failed dribbles lose the ball higher up; fouls won +, ball lost + |
| `dribbleLess` | "Move it on quickly." | use: dribble −0.35, recycle +0.15 | fewer fouls won, fewer chances created alone |
| `crossMore` | "Get it in the box early." | use: cross +0.4 (also early crosses from MID wide) | more crosses claimed by the keeper |
| `crossLess` | "Keep it on the floor." | use: cross −0.4, progress +0.15 | fewer headers; wide play is easier to defend |
| `getForward` | "Get forward at every chance." | inv `MID→ATT 20%`, `DEF→MID 15%` | his zone is empty on opponent counters (their actions there ctx +0.15); fatigue ×1.06 |
| `holdPosition` | "Hold your position." | inv moves 50% of any weight outside his slot's main third back into it | less support in attack (recv ×0.9 for him outside his third) |
| `stayWider` | "Stay wide and stretch them." | inv `C→lane 25%` | fewer bodies centrally (team recycle in MID Centre ctx −0.05) |
| `closeDownMore` | "Close down more." | as D: `S_press` +0.3 | fatigue ×1.08; when beaten, the opponent's next step progress +0.2 |
| `stayOnFeet` | "Stay on your feet." | fouls ×0.5 (fewer cards, fewer penalties) | as D: `S_tkl` −0.25 |
| `longThrows` | "Take the long throws." (players with strength ≥ 70) | our throw-ins in the ATT third become a cross delivery into the box (delivery uses strength instead of crossing) | the throw takes longer (+6 s) and the opponent's GK claim chance +0.04 |

Player instructions are part of the `instructions` command (§13.12) and of the AI manager (§13.17.8: AI uses at most one per player, only `shootLess` for low-longShots midfielders, `stayOnFeet` for players on a yellow after 60', `getForward` when chasing a game at 75'+).

### 13.18 Depth pass 2 (SPEC 1.4, approved by the user 20 Nov)
Same design rules as §13.17: no free lunch, neutral defaults change nothing (the §13.16 targets hold), numbers in `balance.ts` under `K.d2.*`, UI wording exact as written here, and the assistant can set any of them with Apply. A season must still play in about 30 minutes, so every item has a sensible default and never needs touching.

#### 13.18.1 Mentality in five steps
`VeryDefensive` "Everyone behind the ball." · `Defensive` · `Balanced` · `Attacking` · `VeryAttacking` "Throw everything forward."
- The Very steps apply the §13.6 Defensive/Attacking utility rows × 1.6.
- VeryAttacking: inv `MID→ATT 15%` for every outfield player except CBs. Cost: the opponent's Counter phase (§13.9) also starts from wins in their DEF third, with their execution ctx +0.1; team fatigue × 1.04.
- VeryDefensive: inv `ATT→MID 15%` for every player except STs. Cost: our Counter phase can only start if `onWin` is Counter; our shot utility −0.1 everywhere.
- AI (§13.13): losing at 80'+ uses VeryAttacking instead of Attacking.

#### 13.18.2 Final third (`finalThird`)
**Work it into the box** "Walk it in. Only shoot from good spots." · **Shoot on sight** "Have a go whenever you can." · **Mixed** "Players decide." (default)
- Work it in: shot utility outside the box −0.4; in ATT: progress +0.2, dribble +0.1, in-box pass +0.2. Cost: pass ctx −0.1 in ATT (crowded), so more turnovers near their box.
- Shoot on sight: shot utility outside the box +0.4 (MID Centre +0.2), in the box +0.2. Cost: lower xG per shot; a blocked shot is a defenders' possession 65% of the time (not 50%).

#### 13.18.3 Crosses (`crossStyle`)
**Low** "Drill it across the six-yard box." · **Whipped** "Bend it in with pace." · **Floated** "Hang it up for the big men." · **Mixed** "Crosser's choice." (default)
- Low: 60% of won crosses become ground chances (BOX_CENTRAL or SIX_YARD 30/70) instead of 40%; the ground "duel" uses pace .5 and offTheBall .5; GK claim −0.04. Cost: 15% of low crosses are blocked (→ 40% CORNER, 60% CLEARANCE).
- Whipped: HEADER xG_ref 0.13 (not 0.11), on-target +0.05. Cost: delivery ctx −0.15.
- Floated: delivery ctx +0.15; both header skills (S_air and S_airD) × 1.3, so height decides more. Cost: GK claim +0.04.

#### 13.18.4 Offside trap (`offsideTrap`, on/off)
"Step up together and catch them offside." Default off.
- On: a failed through ball becomes offside with probability +0.20 (cap 0.7); 10% of the opponent's long balls into ATT are flagged offside.
- Cost: a through ball that beats the trap gives `oneOnOne` +0.08.

#### 13.18.5 Tackling (`tackling`, team)
**Get stuck in** "Win every fifty-fifty." · **Stay on your feet** "Stay up and stay on the pitch." · **Mixed** (default)
- Get stuck in: as D, `S_tkl` +0.25 for the whole team. Cost: fouls × 1.35, yellow chance per foul × 1.2.
- Stay on your feet: fouls × 0.6. Cost: `S_tkl` −0.2.
- A player's own `stayOnFeet` (§13.17.11) overrides the team setting for him.

#### 13.18.6 Force them (`forceOpp`, team, without the ball)
**Inside** "Show them inside. Fewer crosses." · **Outside** "Show them down the line. Fewer shots." · **Mixed** (default)
- Inside: every opponent wide holder's cross utility −0.3. Cost: his shot utility in ATT +0.15.
- Outside: every opponent wide holder's shot utility −0.25. Cost: his cross utility +0.2.
- An opposition order (§13.17.3) on a player replaces this for him.

#### 13.18.7 Time-wasting (`timeWasting`)
**Never** (default) · **When ahead late** "Take your time over everything when we're winning late on."
- When ahead late (only while leading at 70'+): restart durations (throw-in, goal kick, free kick, substitution) × 1.4, recycle +0.2.
- Cost: the referee adds 50% of the extra time to stoppage time; each restart has a 2% yellow for the taker; from 85' the opponent's attacking steps get ctx +0.1 (we sit too deep).

#### 13.18.8 Set pieces, extended
| Field | Options (UI wording, exact) | Effect | Cost |
|---|---|---|---|
| `freeKicks` (ours, ATT Centre within 30 m) | **Shoot** "Go for goal." · **Cross** "Put it in the box." · **Short** "Play it short and keep it." · **Mixed** (default, the §13.8 50/50) | Shoot: 85% DIRECT_FK. Cross: 85% cross delivery. Short: we keep the ball at the point, next step progress +0.3 | Shoot or Cross: the other option is mostly gone. Short: no immediate chance |
| `cornerSwing` (ours) | **Inswinger** "Bend it towards goal." · **Outswinger** "Bend it away from the keeper." · **Mixed** (default) | Inswinger: header duel +0.1 for our target, 15% of won headers use SIX_YARD. Outswinger: GK claim −0.03, second balls to our attackers 55% (not 40%) | Inswinger: GK claim +0.03. Outswinger: header duel −0.05 |
| `menBack` (our corners) | **1** "One back. Everyone else attacks." · **2** (default) · **3** "Three back. Safety first." | 1: header target weights × 1.15 | 1: when their clearance reaches them, 50% chance of a Counter phase. 3: header weights × 0.85, and no Counter phase from our corners |
| `postMen` (their corners) | **None** (default) · **Near post** "A man on the near post." · **Both posts** "A man on each post." | Near: their near-post headers xG_ref −0.03. Both: their header goals × 0.85 | Near: their second balls to attackers 50%. Both: 55% (fewer markers on the edge of the box) |

#### 13.18.9 More player instructions (same rules as §13.17.11: at most 2, clashing pairs blocked)
| Instruction | UI wording (exact) | Effect | Cost | Clashes with |
|---|---|---|---|---|
| `roam` | "Roam from position." | inv: 25% of his weight spread evenly over adjacent zones; recv × 1.15 | as D in his slot's zones, `S_press` −0.15 | holdPosition |
| `sitNarrower` | "Sit narrower." | inv `lane→C 25%` | his cross utility −0.3; opponent actions in his lane ctx +0.1 | stayWider |
| `crossFromByline` | "Get to the byline before crossing." | his crosses only from ATT wide: delivery ctx +0.1, 30% become cut-backs (in-box pass to BOX_CENTRAL) | no early crosses from MID wide; one extra step in ATT (more chances to lose it) | crossFromDeep, crossLess |
| `crossFromDeep` | "Cross early, from deep." | early-cross utility from MID wide +0.4 | delivery ctx −0.2, GK claim +0.03 | crossFromByline, crossLess |
| `riskyPasses` | "Try the killer pass." | use: through +0.3, progress +0.1 | his pass ctx −0.15 | playSafe |
| `playSafe` | "Play it safe." | use: recycle +0.3; his pass ctx +0.15 | through −0.3 | riskyPasses |

#### 13.18.10 Plans A, B and C
- Three `TacticPlan`s (§8.4), named by the user (default "Plan A", "Plan B", "Plan C"). A new game copies the club style into all three. The lineup, bench, captain, takers and opposition orders are shared; switching plans keeps players on the same slot indices (as in a formation change).
- Switching before a match is free. In a match it is one command `{ kind: 'plan'; side; plan: 0|1|2; issuedAtT }` that acts like a formation + instructions command (§13.12: takes effect after 30 s).
- Cost: familiarity is tracked per area (§13.18.11), so a rarely used plan plays with a sharpness penalty.
- Assistant (§15.4, in-match): losing at 60'+ and Plan B's mentality is more attacking than the active plan's → "Time for Plan B?" (Apply switches).
- AI managers don't use plans (their in-match rules in §13.13 already cover it).

#### 13.18.11 Familiarity per area
- Per club, `Familiarity` (§8.4), 0–100 for each formation, mentality, passing style and pressing level. Starting values: the club style's values 90, one step away 65, others 45. For a formation: the club's formation 90, formations sharing its back line 65, others 40.
- Match effect: for each of the 4 areas in use, if its familiarity is under 70, all execution ctx `−(70 − fam) / 400`. The total is capped at −0.25.
- Weekly: every area used in a match +6 (cap 100); Tactical training (§12.3) +6 more for the active plan's areas; unused values −2 (floor 40).
- This replaces the single formation familiarity of §12.3 (Tactical training now raises all four areas of the active plan).
- **Calibration runs with all familiarity at 100**, so §13.16 is unchanged.

#### 13.18.12 Match analysis (UI only, no engine change)
In Half-Time and Full-Time, an **Analysis** panel (on air, telestrator marker style as in `docs/design/hub/`):
- **Heat map** for any player: density of the event points where he was A, R or D, blurred over a 21×14 grid.
- **Pass network**: each player as a node at his average event position (size = touches); an edge for each pair with ≥ 3 completed passes (width ∝ count).
- **Where our chances came from**: shots grouped by the action before them (cross, through ball, dribble, set piece, long shot, rebound) and by lane, with xG totals, for both teams.
- **Key battles** (§13.17.7): duels won and lost by each pair this match, with an arrow to the winner.
- The assistant's half-time bullets (§15.5) may point at one of these ("Look where their chances are coming from").

#### 13.18.13 Calibration additions (equal teams, 2,000 matches each; all MUST hold)
Every check is a **band**, not a floor (v1.6): an effect far above its target is as wrong as one below it, because real football doesn't move that much from one instruction. Tune `K.d2.*` until each value sits inside its band.
- VeryAttacking vs Balanced: our shots +20% to +50%; Counter phases conceded +40% to +150%.
- ShootOnSight vs Mixed: shots +25% to +55%; xG per shot −20% to −40%.
- Offside trap on: offsides won +40% to +150%; one-on-ones conceded +15% to +45%.
- Get stuck in vs Stay on feet: tackles won +10% to +35%; fouls +25% to +70%.
- Floated crosses with a target man vs Low crosses with a pace forward: header shots +30% to +120%; ground chances from crosses −30% to −70%.
- menBack 1 vs 3: header shots from our corners +10% to +40%; Counter phases conceded after our corners +50% to +250%. With menBack 3 that count MUST still be at least 0.15 per match (a percentage from a near-zero base is meaningless).
- Familiarity 40 everywhere vs 100: win rate between equal teams falls by 6–14 points.
- **Absolute sanity, per team per match, at every setting tested above:** shots 6–22, fouls 6–18, tackles won 10–35, offsides 0.5–5, Counter phases 2–14. A setting that pushes any of these outside its range fails even if its band passes.
- The ±6-point "no dominant choice" rule of §13.17.10 covers every option in this section.
- The same rule applies to §13.17.10 and §13.19.7: an upper bound of 3× the stated floor unless a band is given there.

### 13.19 Attacking and defensive roles (SPEC 1.5, approved by the user 20 Nov)
Every player has **two roles**: an attacking role (what he does when we have the ball) and a defensive role (what he does when they have it). Instructions are split the same way and offered by role. This **replaces** the single role of §13.17.2 and the player-instruction rules of §13.17.11 / §13.18.9 where they differ. Same design rules: no free lunch, the first role in each list is neutral (zero modifiers), all numbers in `balance.ts` (`K.roles.*`, `K.droles.*`, `K.pi.*`), the UI matches `docs/design/tactics/`.

#### 13.19.1 Attacking roles: the §13.17.2 table split by phase
Rule for the split: an attacking role keeps only its **in-possession** modifiers (inv, recv, use, as A, as R) and its **transition** costs (what happens because of where he is when we lose the ball, e.g. the overlapping full-back's lane during an opponent Counter phase). Its **as D** and settled-defence team modifiers move to the defensive roles below.

| Slot | Attacking roles (first = neutral) |
|---|---|
| GK | `gk` Goalkeeper · `bp_keeper` Ball-playing keeper (the old sweeper keeper's Short-distribution bonus; cost: against a High press his short passes ctx −0.2) |
| CB | `cb` · `ball_playing_cb` |
| FB/WB | `fb` · `fb_defensive` renamed **Stays home** "Stays back when we attack." (inv as before, use cross −0.3; gain now: opponent Counter-phase actions in his lane ctx −0.2) · `fb_overlapping` · `fb_inverted` |
| DM | `dm` · `anchor` (keeps inv and recycle +0.3, costs progress/through −0.2; its team defence term moves to nothing, it was a defensive effect) · `deep_playmaker` |
| CM | `cm` · `box_to_box` (inv MID→ATT 10%, fatigue × 1.06; its press bonus moves to the defensive Press role) · `deep_playmaker` · `playmaker` · `runner` |
| AM | `am` · `playmaker` · `shadow_striker` |
| LM/RM | `wm` · `wide_playmaker` · `winger` · `inside_forward` |
| LW/RW | `wf` · `winger` · `inside_forward` |
| ST | `st` · `target_man` · `poacher` · `false_nine` · `advanced_forward` |

Moved out of the attacking lists: `stopper`, `covering_cb`, `sweeper_keeper` (defensive part), `ball_winner`, `wm_defensive`, `pressing_forward`. They become defensive roles below.
Two attacking roles lose a cost that was defensive and get an in-possession cost instead: `playmaker`: his failed passes in MID start an opponent Counter phase with probability 0.3; `shadow_striker`: recv × 0.7 in MID (less involved in the build-up).

#### 13.19.2 Defensive roles (new; key attributes in brackets give the fit, §13.17.1)
| Slot | Role | UI description | Gain | Cost |
|---|---|---|---|---|
| GK | `gk_line` **Stay on the line** | "Guards his goal." | none | none |
| GK | `gk_sweep` **Sweep behind** (oneOnOnes .5, decisions .5) | "Comes off his line to clear balls in behind." | opponent through balls ctx −0.3, their oneOnOne × 0.75 | opponent OUTSIDE_CENTRAL xG_ref +0.02; 3% of their through balls become a GK foul outside the box |
| CB | `cb_hold` **Hold the line** | "Defends his zone with the back line." | none | none |
| CB | `cb_step` **Step out** (tackling .4, strength .3, heading .3) | "Steps out to win it early." | as D: S_tkl +0.35, S_press +0.25, S_airD +0.2 | when beaten, the opponent's next step through ctx +0.3; fouls × 1.2 |
| CB | `cb_cover` **Cover behind** (positioning .4, pace .4, decisions .2) | "Drops off and sweeps up behind." | team: opponent through balls ctx −0.25 | as D: S_tkl −0.15, S_press −0.2 |
| FB/WB | `fb_track` **Track the winger** | "Stays with the man on his side." | none | none |
| FB/WB | `fb_press` **Press high** (workRate .4, pace .3, tackling .3) | "Closes their winger down early, high up." | as D in his lane in MID: S_press +0.3 | when beaten in his lane, the opponent's next step through ctx +0.25 |
| FB/WB | `fb_tuck` **Tuck in** (positioning .5, decisions .3, strength .2) | "Narrows to protect the middle." | opponent actions in our DEF Centre ctx −0.1 | opponent actions in his lane in our DEF ctx +0.15, their cross utility from his lane +0.2 |
| DM | `dm_screen` **Screen the defence** | "Sits in front of the back line." | none | none |
| DM | `dm_win` **Win it back** (tackling .4, workRate .3, stamina .3) | "Hunts the ball down." | as D: S_press +0.4, S_tkl +0.3 | fouls × 1.5, fatigue × 1.1 |
| DM | `dm_drop` **Drop between the centre-backs** (positioning .5, heading .3, strength .2) | "Becomes a third centre-back." | opponent through balls ctx −0.2; their header duels in our box −0.05 | opponent actions in our MID Centre ctx +0.15 |
| CM | `cm_hold` **Hold the zone** | "Keeps his place in the shape." | none | none |
| CM | `cm_press` **Press** (workRate .4, stamina .3, tackling .3) | "Closes down whoever comes into his zone." | as D in MID: S_press +0.3 | fatigue × 1.08; when beaten, the opponent's next progress +0.2 |
| CM | `cm_track` **Track runners** (stamina .4, workRate .3, positioning .3) | "Follows midfield runners into the box." | opponent late runs / through balls into our box from his side ctx −0.15 | fatigue × 1.05; opponent actions in our MID Centre ctx +0.1 |
| AM | `am_screen` **Screen their midfield** | "Blocks passes into their midfield." | none | none |
| AM | `am_press` **Press** (workRate .5, stamina .5) | "Closes down their holding midfielder." | as D on their DM/CM in their MID: S_press +0.3 | fatigue × 1.08; opponent progress past him +0.15 |
| Wide | `w_track` **Track back** | "Comes back to help his full-back." | none | none |
| Wide | `w_press` **Press their full-back** (workRate .4, pace .3, stamina .3) | "Closes their full-back down high." | as D on their FB in their DEF lane: S_press +0.3 | fatigue × 1.08; opponent actions in his lane in our DEF ctx +0.1 |
| Wide | `w_high` **Stay high** (pace .5, offTheBall .5) | "Stays up the pitch as an outlet." | our Counter phase starts with probability +0.15 when we win it in DEF/MID; its first step through +0.2 | opponent actions in his lane in our DEF ctx +0.2 |
| ST | `st_central` **Stay central** | "Waits between their centre-backs." | none | none |
| ST | `st_press` **Press the defenders** (workRate .4, stamina .3, pace .3) | "Leads the press from the front." | team: our S_press +0.3 against their DEF third; their passes in their DEF third ctx −0.2 | fatigue × 1.15 |
| ST | `st_shoulder` **Stay on the shoulder** (pace .5, offTheBall .5) | "Stays on the last defender, ready to run." | our long balls and through balls to him: S_run +0.2 | team: opponent recycle in their DEF ctx +0.2 (nobody presses them) |

Fit works as §13.17.1: gains × `(0.4 + 0.6·fit)`, costs in full.

#### 13.19.3 Instructions, split and offered by role
- Each player: up to **2 attacking** instructions and up to **1 defensive** instruction.
- **Attacking** = §13.17.11 + §13.18.9 except `closeDownMore` and `stayOnFeet` (they move to defensive).
- **Defensive** (new set, max 1, effects in `K.pi.*`):

| Instruction | UI wording (exact) | Gain | Cost | Clashes with |
|---|---|---|---|---|
| `closeDownMore` | "Close down more." | as D: S_press +0.3 | fatigue × 1.08; when beaten, the opponent's next progress +0.2 | standOff |
| `standOff` | "Stand off him." | opponent through balls in his zone ctx −0.1 | his opponent's pass and dribble ctx +0.15 | closeDownMore |
| `tackleHarder` | "Get stuck in." | as D: S_tkl +0.25 | fouls × 1.35, yellow chance × 1.2 | stayOnFeet |
| `stayOnFeet` | "Stay on your feet." | fouls × 0.5 | as D: S_tkl −0.25 | tackleHarder |
| `markTighter` | "Mark tighter." | recv × 0.85 for the opponent in his zone | through balls past him ctx +0.15 | none |
| `trackRuns` | "Track runners all the way." | opponent S_run −0.2 on runs from his zone | fatigue × 1.05; opponent actions in his zone ctx +0.1 | none |

- **Offered by role**: each attacking role and each defensive role lists which instructions it allows (the exact lists are the `ATT_ALLOW` and `DEF_ALLOW` tables in `docs/design/tactics/index.html`; copy them into `src/config/roles.ts`). Examples: an Inside forward can't take "Get to the byline"; a Target man can't take "Take players on"; "Stay high" and "Stay on the shoulder" take no defensive instruction. Changing a role drops instructions the new role doesn't allow.
- **Instruction fit**: every instruction has key attributes (also in that file), and fit uses the §13.17.1 formula: gains × `(0.4 + 0.6·fit)`, costs in full. So "Shoot more" on a poor long-shooter gives few extra goals and the full cost.

#### 13.19.4 Types (§8.4)
`Tactics` and `TacticPlan`: `roles` becomes `attRoles: RoleId[]` + `defRoles: DefRoleId[]`; `playerInstructions` becomes `attInstructions: PlayerInstruction[][]` (each 0–2) + `defInstructions: DefInstruction[][]` (each 0–1). Save migration: old roles map to their attacking role where one exists (`stopper`→`cb` + `cb_step`, `covering_cb`→`cb` + `cb_cover`, `sweeper_keeper`→`gk` + `gk_sweep`, `ball_winner`→`cm`/`dm` + `cm_press`/`dm_win`, `wm_defensive`→`wm`/`wf` + `w_track`, `pressing_forward`→`st` + `st_press`); everything else gets the neutral defensive role.

#### 13.19.5 AI managers and the assistant
- AI (§13.17.8): Pressing High → ST `st_press`, one CM `cm_press`; Mentality Defensive → FBs Stays home, DM `dm_drop` if fit ≥ 0.5; Width Wide → wide players `winger`; on the counter (Defensive + onWin Counter) → one wide player `w_high`. Fit ≥ 0.5 as before.
- Assistant (§13.17.9), re-pointed: "Put {player} on Step out" instead of the old stopper advice; in-match "They're getting in behind {player}. Tell him to stand off." when ≥ 2 through balls past him in 15 minutes.

#### 13.19.6 The board (UI)
The Tactics board has a **With ball / Without ball** switch. Without ball, the magnets slide (spring) into the defensive shape: each slot's x = `0.07 + (x − 0.05) × 0.62` plus the line offset (Deep −0.03, High +0.05), then per defensive role (Step out +0.04, Cover −0.03, Press high +0.10, Tuck in moves 30% toward the centre, Drop between the CBs x = 0.17, Press roles +0.06–0.08, Track runners −0.05, Track back −0.05, Stay high and Stay on the shoulder keep their attacking x). This is display only; the engine uses zones. Attacking marks show With ball; defensive role marks, the offside trap and "force them" show Without ball.

#### 13.19.7 Calibration (add to §13.18.13; equal teams, 2,000 matches each)
- `st_press` + `cm_press` vs neutral: ball wins in the opponent's DEF third ≥ +30%, our fatigue higher.
- `w_high` on both wingers vs neutral: our Counter phases ≥ +20%, opponent attacks down those lanes ≥ +15%.
- `dm_drop` vs neutral: opponent through balls completed ≤ −20%, opponent shots from outside the box ≥ +15%.
- `cb_step` vs `cb_cover` (same player): his tackles won ≥ +20%, through balls conceded ≥ +20%.
- All defaults neutral: §13.16 unchanged. The ±6-point rule covers every role and instruction here.

