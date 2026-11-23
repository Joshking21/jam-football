<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 9. The fixed world

The world is identical in every save so that voices, portraits and press can name real (fictional) people. It is generated once by `npm run gen:world` from `WORLD_SEED` and committed as `src/core/world/world.snapshot.json`. After M1 it is **frozen**: never regenerate it (Claude generates portraits and name audio from it). If a change is unavoidable, write `BLOCKED:` in PROGRESS.md and wait.

### 9.1 The league
- Name: **The Meridian League**. Fictional country, not named. Season label "Season 1".
- 10 clubs, double round-robin, 18 matchdays. 3 points for a win, 1 for a draw.
- Tiebreakers in order: points, goal difference, goals for, head-to-head points, head-to-head goal difference, club name A→Z.

### 9.2 The ten clubs (exact data for `clubs.data.ts`)

| id | Name | Code | Nickname | City | Founded | Stadium | Capacity | Rep | Colors primary / secondary / text | Home kit | Away kit | Style: formation, mentality, passing, tempo, pressing, line, width | AI manager | Expectation target / acceptable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c01 | Port Calloway FC | PCF | The Mariners | Port Calloway | 1884 | The Lanternworks | 52,000 | 5 | #0B1F3A / #F2B705 / #FFFFFF | navy solid, gold trim, navy shorts, navy socks | white solid, navy shorts, white socks | 4-3-3, Attacking, Short, Normal, High, High, Wide | Edmund Harrow | 1 / 2 |
| c02 | Ironvale Athletic | IVA | The Forge | Ironvale | 1891 | Furnace Park | 41,000 | 4 | #2B2B2B / #FF6A13 / #FFFFFF | charcoal/orange stripes, black shorts, orange socks | orange solid, charcoal shorts, charcoal socks | 4-4-2, Balanced, Direct, Fast, High, Normal, Normal | Grete Lindqvist | 3 / 4 |
| c03 | Kestrel Bay FC | KBF | The Kestrels | Kestrel Bay | 1902 | Cliffside Ground | 38,500 | 4 | #0E8C8C / #FFFFFF / #FFFFFF | teal solid, white shorts, teal socks | white with teal sash, white shorts, white socks | 4-2-3-1, Balanced, Short, Slow, Mid, Normal, Normal | Oriol Benet | 3 / 4 |
| c04 | Saltmere Rovers | SAL | The Rovers | Saltmere | 1879 | Brinegate Road | 33,000 | 3 | #6D1A36 / #8FC5E8 / #FFFFFF | claret body sky sleeves (halves), white shorts, sky socks | sky solid, claret shorts, sky socks | 4-4-2, Balanced, Mixed, Normal, Mid, Normal, Wide | Declan Ashworth | 5 / 6 |
| c05 | Brightwater City | BWC | The Lamps | Brightwater | 1910 | Lamplight Stadium | 30,500 | 3 | #4FA3E0 / #FFFFFF / #0B1F3A | sky solid, white shorts, sky socks | dark navy solid, navy shorts, navy socks | 4-3-3, Attacking, Short, Fast, High, High, Normal | Amara Okonkwo-Hale | 5 / 6 |
| c06 | Northgate Albion | NGA | The Gate | Northgate | 1888 | The Gatehouse | 29,000 | 3 | #1E7B3C / #FFFFFF / #FFFFFF | green/white hoops, white shorts, green socks | yellow solid, green shorts, yellow socks | 4-1-4-1, Defensive, Mixed, Normal, Mid, Deep, Normal | Pieter Vos | 5 / 6 |
| c07 | Ashcombe United | ASU | The Ashes | Ashcombe | 1896 | Ember Lane | 27,500 | 3 | #C8102E / #111111 / #FFFFFF | red solid, black shorts, red socks | black solid, black shorts, red socks | 3-5-2, Balanced, Direct, Normal, Mid, Normal, Wide | Tomasz Wrona | 5 / 6 |
| c08 | Veldmoor Town | VDT | The Moorsmen | Veldmoor | 1899 | Heathside | 21,000 | 2 | #4B2A7B / #FFFFFF / #FFFFFF | purple solid, white shorts, purple socks | white with purple chevron, purple shorts, white socks | 5-3-2, Defensive, Direct, Slow, Low, Deep, Narrow | Bernard Quill | 8 / 9 |
| c09 | Lindenfield FC | LIN | The Lindens | Lindenfield | 1921 | Linden Meadow | 19,500 | 2 | #FFD100 / #111111 / #111111 | yellow solid, black shorts, black socks | black solid, yellow shorts, black socks | 4-4-2, Balanced, Mixed, Normal, Mid, Normal, Normal | Sade Adeyemi | 8 / 9 |
| c10 | Corvallen Wanderers | COR | The Crows | Corvallen | 1905 | Rookery Park | 18,000 | 2 | #111111 / #FFFFFF / #FFFFFF | black/white stripes, black shorts, black socks | white solid, black shorts, white socks | 3-4-3, Attacking, Direct, Fast, High, High, Wide | Ivo Marchetti | 8 / 9 |

Every club's GK kit: shirt `#2EE59D` (c01–c05) or `#FF8A00` (c06–c10), shorts and socks same as shirt, pattern solid.

Expectation labels: target 1 → "Win the league"; 3 → "Finish in the top three"; 5 → "Finish in the top half"; 8 → "Stay out of the bottom two".

Rivalries (derbies, both directions): c01–c03 "The Coast Derby"; c02–c07 "The Iron & Ember Derby"; c09–c10 "The Little Derby"; c04–c06 "The Old Road Derby".

Finances at season start by reputation:
| Rep | balance | transferBudget | wage budget |
|---|---|---|---|
| 5 | 70,000,000 | 40,000,000 | 108% of generated weekly wage bill, rounded up to 10,000 |
| 4 | 42,000,000 | 22,000,000 | same rule |
| 3 | 24,000,000 | 11,000,000 | same rule |
| 2 | 12,000,000 | 5,000,000 | same rule |

Board confidence starts at 65 and fan mood at 60 for every club.

Formation familiarity: the club's style formation 85; formations sharing its back line (4 at the back: 4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1; 3 at the back: 3-5-2, 3-4-3; 5 at the back: 5-3-2) 60; all others 40.

### 9.3 Squads
Each club has exactly **24 players**:

| Primary position | Count | Secondary positions |
|---|---|---|
| GK | 3 | — |
| CB | 5 | — |
| LB | 1 | LWB |
| RB | 1 | RWB |
| Full back (primary LB) | 1 | RB |
| DM | 2 | — |
| CM | 3 | — |
| AM | 1 | — |
| LM | 1 | LW |
| RM | 1 | RW |
| LW | 1 | — |
| RW | 1 | — |
| ST | 3 | — |
| **Total** | **24** | |
Free agents: **40 players** (positions: GK 4, CB 7, FB 5, DM 3, CM 6, AM 3, wide 6, ST 6), ages 21–33, OVR 52–68.
Total: 240 + 40 = **280 players**. IDs `p0001`–`p0280`, assigned club by club in club-id order, then free agents.

Squad numbers: give the standard numbers to the highest-OVR player of each role: GK = 1, RB = 2, LB = 3, CB (best) = 4, CB (second) = 5, DM = 6, RW = 7, CM = 8, ST = 9, AM = 10, LW = 11. Every other player, sorted by OVR descending, gets the lowest unused number from 12 to 35.

### 9.4 Player generation (in `generateWorld.ts`)
For each club, assign target OVRs:
1. Club mean `M` by reputation: rep 5 → 74, rep 4 → 70, rep 3 → 66, rep 2 → 62.
2. The best-XI candidates (the 11 primary-slot players of the style formation, picked as: 1 GK, back line, midfield and attack matching the formation) get target `M + normal(2, 3)`; pick two of them at random (not GK) as **key players**: +6 more.
3. 9 squad players get `M + normal(-3, 3)`.
4. 4 prospects (ages 17–20) get `M + normal(-9, 3)`.
5. Clamp targets to 45–90.

Ages: best-XI and squad players: 22–33 drawn with weights 22–24: 30%, 25–28: 40%, 29–31: 22%, 32–33: 8%. Prospects 17–20 uniform. Free agents 21–33 uniform.

Attributes for a player with primary position `P` and target OVR `T`:
1. For each attribute `a`: `w = weight of a in P's OVR table (§9.5)` (0 if absent).
   - if `w > 0`: `raw = T + 2 + 30·w + normal(0, 4)`
   - else if `a` is a goalkeeping attribute and `P ≠ GK`: `raw = rng.int(1, 15)`
   - else if `P = GK` and `a` is an outfield technical/physical attribute (finishing, longShots, crossing, dribbling, tackling, heading, setPieces, pace, offTheBall): `raw = rng.int(8, 35)`
   - else: `raw = T - 10 + normal(0, 6)`
2. Round and clamp each to 1–99.
3. Compute OVR at `P` (§9.5). Let `d = T - OVR`. Add `d` to every attribute with `w > 0`, clamp, recompute. Repeat up to 3 times until `|T - OVR| ≤ 1`.
4. Personal flavour: pick 1 "signature" attribute among P's weighted ones and add `rng.int(4, 9)` (clamp 99); pick 1 weighted attribute as a weakness and subtract `rng.int(4, 9)` (clamp 1). Recompute OVR (it may move by 1–2; that is fine).

Potential: `potential = min(95, OVR + headroom)` where headroom by age: 17–20 → `rng.int(8, 22)`, 21–23 → `rng.int(4, 14)`, 24–27 → `rng.int(0, 8)`, 28–30 → `rng.int(0, 3)`, 31+ → 0.

Secondary positions: as listed in §9.3, plus with 35% chance one natural neighbour from this map: CB↔DM, LB↔LWB↔LM, RB↔RWB↔RM, DM↔CM, CM↔AM, AM↔ST, LM↔LW, RM↔RW, LW↔ST, RW↔ST. Familiarity for secondaries: `rng.int(78, 92)`.

Other fields: heightCm: GK 186–198, CB 183–196, ST 175–193, others 168–188 (uniform). Foot: left-sided positions 70% Left, right-sided 85% Right, central 80% Right / 12% Left / 8% Both. Personality weights: Professional 25, Ambitious 20, Leader 10, Relaxed 20, Temperamental 15, Loyal 10. Condition 95–100, fatigue 0–10, morale 55–70.

Contract: role by squad rank by OVR within club: top 2 = Star, 3–11 = Starter, 12–17 = Rotation, rest = Backup, but prospects = Prospect. `yearsLeft` 1–4 (weights 20/35/30/15). Wage = `wageFor(value)` (§12.10).

Nationality weights: ENG 30, NGA 10, FRA 8, ESP 7, BRA 7, NED 5, GHA 5, POR 5, GER 5, IRL 4, SEN 4, SCO 4, ARG 3, DEN 3.

### 9.5 OVR weight tables (`ratings.ts`)
OVR at position = round(Σ w·attribute). Weights per position group (each row sums to 1.00):

| Group (positions) | Weights |
|---|---|
| GK | reflexes .30, handling .20, oneOnOnes .20, aerialCommand .15, decisions .05, composure .05, passing .05 |
| CB | tackling .22, positioning .25, heading .18, strength .12, pace .08, decisions .08, composure .07 |
| FB (LB, RB, LWB, RWB) | tackling .16, positioning .16, pace .18, stamina .12, crossing .14, passing .10, workRate .08, dribbling .06 |
| DM | tackling .18, positioning .20, passing .18, decisions .14, stamina .10, strength .10, workRate .10 |
| CM | passing .24, decisions .16, firstTouch .12, stamina .12, workRate .10, tackling .08, positioning .06, longShots .06, composure .06 |
| AM | passing .20, dribbling .16, firstTouch .14, decisions .14, offTheBall .12, longShots .10, composure .08, finishing .06 |
| WIDE (LM, RM, LW, RW) | pace .18, dribbling .20, crossing .16, firstTouch .10, offTheBall .12, finishing .08, stamina .08, passing .08 |
| ST | finishing .26, offTheBall .18, composure .14, firstTouch .10, heading .10, pace .10, strength .06, dribbling .06 |

`ovrAt(player, pos) = round(rawOvr(pos) × fam)` where `fam` = familiarity/100 for a listed position; for an unlisted position: same group 0.80, adjacent group (DEF↔MID, MID↔FWD) 0.65, otherwise 0.45; GK slot for an outfielder 0.20; outfield slot for a GK 0.30.

Position groups: GK = GK; DEF = CB, LB, RB, LWB, RWB; MID = DM, CM, AM, LM, RM; FWD = LW, RW, ST.

### 9.6 Names (`names.data.ts`)
- One pool per nation code: at least 40 first names and 60 surnames, culturally plausible and common (not famous).
- Full names MUST be unique across all 280 players and 10 AI managers.
- `blocklist.data.ts`: at least 300 full names of famous current and historic footballers and managers. A generated full name matching (case-insensitive) a blocklisted name, or a surname matching one of the 60 most famous surnames you list in `FAMOUS_SURNAMES`, MUST be re-rolled.
- 15% of BRA and 10% of POR players get a one-word `knownAs` built from a first-name pool (e.g. "Tiago"). Display name = `knownAs ?? lastName` in compact views, `firstName lastName` in profiles.
- Test: uniqueness and blocklist checks run in `tests/core/world/generateWorld.test.ts`.

### 9.7 The manager (the player)
The player types a manager name at new game (default "Alex Morgan" is a real person, so use default **"The Gaffer"**). Max 24 chars, letters, spaces, apostrophes, hyphens. Shown in press and news.

---

