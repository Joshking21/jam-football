<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 8. Data model (TypeScript types)

Put these in `src/core/types.ts`. Field names are exact.

### 8.1 Basics
```ts
export type ClubId = string;            // 'c01'..'c10'
export type PlayerId = string;          // 'p0001'..
export type FixtureId = string;         // 'f001'..
export type Side = 'home' | 'away';
export type Position = 'GK'|'CB'|'LB'|'RB'|'LWB'|'RWB'|'DM'|'CM'|'AM'|'LM'|'RM'|'LW'|'RW'|'ST';
export type PositionGroup = 'GK'|'DEF'|'MID'|'FWD';
export type Foot = 'Left'|'Right'|'Both';
export type Personality = 'Professional'|'Ambitious'|'Leader'|'Relaxed'|'Temperamental'|'Loyal';
export type SquadRole = 'Star'|'Starter'|'Rotation'|'Backup'|'Prospect';
export type NationCode = 'ENG'|'NGA'|'FRA'|'ESP'|'BRA'|'NED'|'GHA'|'POR'|'GER'|'IRL'|'SEN'|'SCO'|'ARG'|'DEN';
```

### 8.2 Attributes (all integers 1–99)
```ts
export interface Attributes {
  // technical
  finishing: number; longShots: number; passing: number; crossing: number;
  firstTouch: number; dribbling: number; tackling: number; heading: number; setPieces: number;
  // physical
  pace: number; stamina: number; strength: number;
  // mental
  offTheBall: number; positioning: number; decisions: number; composure: number; workRate: number;
  // goalkeeping (outfielders have 1–15 here)
  reflexes: number; handling: number; oneOnOnes: number; aerialCommand: number;
}
export type AttributeKey = keyof Attributes;
```

### 8.3 Player
```ts
export interface Injury { kind: string; matchdaysOut: number; severity: 'Minor'|'Moderate'|'Major'; }
export interface Contract { wagePerWeek: number; yearsLeft: 1|2|3|4; role: SquadRole; promisedRole?: SquadRole; }
export interface PlayerSeasonStats {
  apps: number; starts: number; minutes: number; goals: number; assists: number;
  yellow: number; red: number; ratingSum: number; ratedApps: number; motm: number;
  cleanSheets: number; shots: number; shotsOnTarget: number; keyPasses: number;
  tacklesWon: number; interceptions: number; saves: number; goalsConceded: number;
}
export interface Player {
  id: PlayerId; firstName: string; lastName: string; knownAs?: string;
  nationality: NationCode; age: number; heightCm: number; foot: Foot;
  positions: { pos: Position; familiarity: number }[];   // [0] is primary (100); others 70–95
  attributes: Attributes;
  potential: number;            // hidden OVR ceiling at primary position
  personality: Personality;
  clubId: ClubId | null;        // null = free agent
  squadNumber: number | null;
  contract: Contract | null;    // null for free agents
  condition: number;            // 0–100 match readiness
  fatigue: number;              // 0–100 accumulated load
  morale: number;               // 0–100
  injury: Injury | null;
  suspendedMatches: number;
  yellowAccumulation: number;   // resets after each ban
  form: number[];               // last 5 match ratings, newest last
  stats: PlayerSeasonStats;
  transferListed: boolean;
  notForSale: boolean;
  scoutedBy: ClubId[];          // clubs that have full knowledge
  growth: number;               // fractional OVR progress carried between weeks
  history: { matchday: number; event: string }[];  // e.g. 'Signed from Ironvale for €4.2M'
}
```

### 8.4 Tactics
```ts
export type Formation = '4-4-2'|'4-3-3'|'4-2-3-1'|'3-5-2'|'5-3-2'|'4-1-4-1'|'3-4-3';
export type Mentality = 'Defensive'|'Balanced'|'Attacking';
export type PassingStyle = 'Short'|'Mixed'|'Direct';
export type Tempo = 'Slow'|'Normal'|'Fast';
export type Pressing = 'Low'|'Mid'|'High';
export type DefLine = 'Deep'|'Normal'|'High';
export type Width = 'Narrow'|'Normal'|'Wide';
export type Focus = 'Left'|'Centre'|'Right'|'Mixed';
export type RoleId = string;        // ids from src/config/roles.ts (§13.17.2)
export type OnLoss = 'CounterPress'|'Regroup'|'Mixed';
export type OnWin = 'Counter'|'KeepIt'|'Mixed';
export type Distribution = 'Short'|'Long'|'Wide'|'Mixed';
export type CornersFor = 'NearPost'|'FarPost'|'Short'|'Mixed';
export type CornersAgainst = 'Zonal'|'ManMark'|'Mixed';
export interface TeamInstructions {
  mentality: Mentality; passing: PassingStyle; tempo: Tempo; pressing: Pressing;
  line: DefLine; width: Width; focus: Focus;
  onLoss: OnLoss; onWin: OnWin; distribution: Distribution;           // §13.17.4
  cornersFor: CornersFor; cornersAgainst: CornersAgainst;             // §13.17.5
}
export type PlayerInstruction = 'shootMore'|'shootLess'|'dribbleMore'|'dribbleLess'|'crossMore'|'crossLess'
  |'getForward'|'holdPosition'|'stayWider'|'closeDownMore'|'stayOnFeet'|'longThrows'; // §13.17.11
export interface OppOrder { kind: 'tightMark'|'doubleUp'|'pressOnBall'|'showInside'|'showOutside'; target: PlayerId } // §13.17.3
export interface Tactics {
  formation: Formation;
  lineup: (PlayerId | null)[];      // length 11, index = slot index in formations.ts
  roles: RoleId[];                  // length 11, replaces the old duties (§13.17.2)
  playerInstructions: PlayerInstruction[][]; // length 11, each 0–2
  bench: PlayerId[];                // 0–9
  captain: PlayerId | null;
  takers: { penalty: PlayerId|null; freeKick: PlayerId|null; corner: PlayerId|null; longThrow: PlayerId|null };
  instructions: TeamInstructions;
  opposition: OppOrder[];           // 0–3, set per match (cleared after each match)
}
// ---- SPEC 1.4 additions (§13.18). Mentality gains two outer steps:
//   export type Mentality = 'VeryDefensive'|'Defensive'|'Balanced'|'Attacking'|'VeryAttacking';
export type FinalThird = 'WorkIntoBox'|'ShootOnSight'|'Mixed';
export type CrossStyle = 'Low'|'Whipped'|'Floated'|'Mixed';
export type Tackling = 'StayOnFeet'|'GetStuckIn'|'Mixed';
export type ForceOpp = 'Inside'|'Outside'|'Mixed';
export type TimeWasting = 'Never'|'WhenAhead';
export type FreeKicks = 'Shoot'|'Cross'|'Short'|'Mixed';
export type CornerSwing = 'Inswinger'|'Outswinger'|'Mixed';
export type PostMen = 'None'|'Near'|'Both';
// TeamInstructions gains: finalThird, crossStyle, offsideTrap: boolean, tackling, forceOpp, timeWasting,
//   freeKicks, cornerSwing, menBack: 1|2|3, postMen.  Defaults (all neutral): Mixed / false / Never / 2 / None.
// PlayerInstruction gains: 'roam'|'sitNarrower'|'crossFromByline'|'crossFromDeep'|'riskyPasses'|'playSafe'.
export interface TacticPlan {      // §13.18.10: Plan A/B/C
  name: string; formation: Formation; roles: RoleId[]; playerInstructions: PlayerInstruction[][]; instructions: TeamInstructions;
}
// Tactics: formation/roles/playerInstructions/instructions move into plans: [TacticPlan, TacticPlan, TacticPlan] + activePlan: 0|1|2.
//   lineup, bench, captain, takers and opposition stay on Tactics (shared by all plans).
export interface Familiarity { formation: Record<Formation, number>; mentality: Record<string, number>; passing: Record<PassingStyle, number>; pressing: Record<Pressing, number> } // 0–100, per club (§13.18.11)
```

### 8.5 Club
```ts
export type KitPattern = 'solid'|'stripes'|'hoops'|'halves'|'sash'|'chevron';
export interface Kit { shirt: string; shirt2: string; pattern: KitPattern; shorts: string; socks: string; text: string; }
export interface Club {
  id: ClubId; name: string; shortName: string; code: string;   // code = 3 letters
  nickname: string; city: string; founded: number;
  stadium: { name: string; capacity: number };
  colors: { primary: string; secondary: string; text: string };
  kits: { home: Kit; away: Kit; gk: Kit };
  reputation: 2|3|4|5;
  style: TeamInstructions & { formation: Formation };
  managerName: string;                 // AI manager (fictional)
  rivals: ClubId[];
  balance: number; transferBudget: number; wageBudget: number;   // wageBudget = per week
  expectation: { target: number; acceptable: number; label: string };
  boardConfidence: number;             // 0–100
  fanMood: number;                     // 0–100
  formationFamiliarity: Record<Formation, number>;  // 0–100
  tactics: Tactics;
  squad: PlayerId[];
  trainingPlan: TrainingPlan;
  seasonStats: { gateIncome: number; tvIncome: number; sponsorIncome: number; prizeMoney: number;
                 wagesPaid: number; transferIn: number; transferOut: number; operating: number };
}
export interface TrainingPlan { focus: 'Balanced'|'Attacking'|'Defending'|'Fitness'|'SetPieces'|'Tactical';
  intensity: 'Light'|'Normal'|'Hard'; individual: Record<PlayerId, AttributeKey | null>; }
```

### 8.6 Fixtures, results, table
```ts
export interface Fixture {
  id: FixtureId; matchday: number; homeId: ClubId; awayId: ClubId;
  kickoff: 'Afternoon'|'Evening'|'Night'; weather: 'Clear'|'Overcast'|'Rain';
  isDerby: boolean; result: MatchResultSummary | null;
}
export interface MatchResultSummary {
  homeGoals: number; awayGoals: number;
  scorers: { playerId: PlayerId; side: Side; minuteLabel: string; penalty: boolean; ownGoal: boolean }[];
  attendance: number; motm: PlayerId;
  stats: { home: TeamMatchStats; away: TeamMatchStats };
}
export interface TableRow { clubId: ClubId; p: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number; form: ('W'|'D'|'L')[]; }
```

### 8.7 Inbox and news
```ts
export type InboxKind = 'Board'|'Assistant'|'Medical'|'Transfer'|'Player'|'League'|'Press'|'Fans';
export interface InboxItem {
  id: string; matchday: number; kind: InboxKind; title: string; body: string;
  read: boolean; requiresAction: boolean;
  action?: { type: 'conversation'|'transferOffer'|'contract'|'board'; refId: string };
}
export interface NewsItem { id: string; matchday: number; headline: string; body: string;
  image?: string; clubIds: ClubId[]; playerIds: PlayerId[]; }
```

### 8.8 Transfers
```ts
export interface TransferOffer {
  id: string; playerId: PlayerId; fromClubId: ClubId | null; toClubId: ClubId;
  fee: number; status: 'Pending'|'Accepted'|'Rejected'|'Countered'|'Withdrawn'|'Completed'|'PlayerRefused';
  counterFee?: number; createdRound: number; bidsMade: number;
  contractOffer?: { wagePerWeek: number; years: 1|2|3|4; role: SquadRole };
}
export interface TransferWindowState { kind: 'Preseason'|'Midseason'; round: 1|2|3; offers: TransferOffer[];
  scoutingQueue: PlayerId[]; scoutingDoneThisRound: number; boardWageRequestUsed: boolean; }
```

### 8.9 GameState (the save)
```ts
export type Phase = 'BoardMeeting'|'Preseason'|'TransferWindow'|'PreMatch'|'Match'|'PostMatch'
                  | 'WeekSummary'|'SeasonEnd'|'Sacked';
export interface GameState {
  version: number;                 // SAVE_VERSION, see §20.2
  seed: number;                    // save seed
  createdAt: string;               // ISO string from UI layer
  managerName: string;
  userClubId: ClubId;
  matchday: number;                // 0 = preseason, 1..18
  phase: Phase;
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  freeAgents: PlayerId[];
  fixtures: Fixture[];
  table: TableRow[];               // always sorted
  window: TransferWindowState | null;
  inbox: InboxItem[];
  news: NewsItem[];
  pressHistory: string[];          // question ids already asked (avoid repeats)
  conversationsHistory: string[];
  tutorial: { step: number; done: boolean };
  pendingMatch: { fixtureId: FixtureId } | null;
  awards: SeasonAwards | null;
  score: number;                   // leaderboard score, computed at season end
  counters: { news: number; inbox: number; offer: number };
}
```
`TeamMatchStats`, `SeasonAwards`, `MatchInput`, `MatchEvent`, `MatchCommand`, `MatchResult` are defined in §13.

---

