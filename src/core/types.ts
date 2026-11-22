// Implements SPEC §8 and §13 TypeScript data models

// --- 8.1 Basics ---
export type ClubId = string; // 'c01'..'c10'
export type PlayerId = string; // 'p0001'..
export type FixtureId = string; // 'f001'..
export type Side = 'home' | 'away';
export type Position =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'DM'
  | 'CM'
  | 'AM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'ST';
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Foot = 'Left' | 'Right' | 'Both';
export type Personality =
  | 'Professional'
  | 'Ambitious'
  | 'Leader'
  | 'Relaxed'
  | 'Temperamental'
  | 'Loyal';
export type SquadRole = 'Star' | 'Starter' | 'Rotation' | 'Backup' | 'Prospect';
export type NationCode =
  | 'ENG'
  | 'NGA'
  | 'FRA'
  | 'ESP'
  | 'BRA'
  | 'NED'
  | 'GHA'
  | 'POR'
  | 'GER'
  | 'IRL'
  | 'SEN'
  | 'SCO'
  | 'ARG'
  | 'DEN';

// --- 8.2 Attributes (all integers 1–99) ---
export interface Attributes {
  // technical
  finishing: number;
  longShots: number;
  passing: number;
  crossing: number;
  firstTouch: number;
  dribbling: number;
  tackling: number;
  heading: number;
  setPieces: number;
  // physical
  pace: number;
  stamina: number;
  strength: number;
  // mental
  offTheBall: number;
  positioning: number;
  decisions: number;
  composure: number;
  workRate: number;
  // goalkeeping (outfielders have 1–15 here)
  reflexes: number;
  handling: number;
  oneOnOnes: number;
  aerialCommand: number;
}
export type AttributeKey = keyof Attributes;

// --- 8.3 Player ---
export interface Injury {
  kind: string;
  matchdaysOut: number;
  severity: 'Minor' | 'Moderate' | 'Major';
}

export interface Contract {
  wagePerWeek: number;
  yearsLeft: 1 | 2 | 3 | 4;
  role: SquadRole;
  promisedRole?: SquadRole;
}

export interface PlayerSeasonStats {
  apps: number;
  starts: number;
  minutes: number;
  minutesLastMatch?: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ratingSum: number;
  ratedApps: number;
  motm: number;
  cleanSheets: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tacklesWon: number;
  interceptions: number;
  saves: number;
  goalsConceded: number;
}

export interface Player {
  id: PlayerId;
  firstName: string;
  lastName: string;
  knownAs?: string;
  nationality: NationCode;
  age: number;
  heightCm: number;
  foot: Foot;
  positions: { pos: Position; familiarity: number }[]; // [0] is primary (100); others 70–95
  attributes: Attributes;
  potential: number; // hidden OVR ceiling at primary position
  personality: Personality;
  clubId: ClubId | null; // null = free agent
  squadNumber: number | null;
  contract: Contract | null; // null for free agents
  condition: number; // 0–100 match readiness
  fatigue: number; // 0–100 accumulated load
  morale: number; // 0–100
  injury: Injury | null;
  suspendedMatches: number;
  yellowAccumulation: number; // resets after each ban
  form: number[]; // last 5 match ratings, newest last
  stats: PlayerSeasonStats;
  transferListed: boolean;
  notForSale: boolean;
  scoutedBy: ClubId[]; // clubs that have full knowledge
  growth: number; // fractional OVR progress carried between weeks
  history: { matchday: number; event: string }[]; // e.g. 'Signed from Ironvale for €4.2M'
}

// --- 8.4 Tactics ---
export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2' | '4-1-4-1' | '3-4-3';
export type Mentality = 'VeryDefensive' | 'Defensive' | 'Balanced' | 'Attacking' | 'VeryAttacking';
export type PassingStyle = 'Short' | 'Mixed' | 'Direct';
export type Tempo = 'Slow' | 'Normal' | 'Fast';
export type Pressing = 'Low' | 'Mid' | 'High';
export type DefLine = 'Deep' | 'Normal' | 'High';
export type Width = 'Narrow' | 'Normal' | 'Wide';
export type Focus = 'Left' | 'Centre' | 'Right' | 'Mixed';
export type Duty = 'Defend' | 'Support' | 'Attack';

export type RoleId = string; // attacking role ids from src/config/roles.ts (§13.17.2 & §13.19.1)

// SPEC 1.5 additions (§13.19)
export type DefRoleId =
  | 'gk_line'
  | 'gk_sweep'
  | 'cb_hold'
  | 'cb_step'
  | 'cb_cover'
  | 'fb_track'
  | 'fb_press'
  | 'fb_tuck'
  | 'dm_screen'
  | 'dm_win'
  | 'dm_drop'
  | 'cm_hold'
  | 'cm_press'
  | 'cm_track'
  | 'am_screen'
  | 'am_press'
  | 'w_track'
  | 'w_press'
  | 'w_high'
  | 'st_central'
  | 'st_press'
  | 'st_shoulder';

export type DefInstruction =
  | 'closeDownMore'
  | 'standOff'
  | 'tackleHarder'
  | 'stayOnFeet'
  | 'markTighter'
  | 'trackRuns'; // SPEC §13.19.3

export type OnLoss = 'CounterPress' | 'Regroup' | 'Mixed';
export type OnWin = 'Counter' | 'KeepIt' | 'Mixed';
export type Distribution = 'Short' | 'Long' | 'Wide' | 'Mixed';
export type CornersFor = 'NearPost' | 'FarPost' | 'Short' | 'Mixed';
export type CornersAgainst = 'Zonal' | 'ManMark' | 'Mixed';

// SPEC 1.4 additions (§13.18)
export type FinalThird = 'WorkIntoBox' | 'ShootOnSight' | 'Mixed';
export type CrossStyle = 'Low' | 'Whipped' | 'Floated' | 'Mixed';
export type Tackling = 'StayOnFeet' | 'GetStuckIn' | 'Mixed';
export type ForceOpp = 'Inside' | 'Outside' | 'Mixed';
export type TimeWasting = 'Never' | 'WhenAhead';
export type FreeKicks = 'Shoot' | 'Cross' | 'Short' | 'Mixed';
export type CornerSwing = 'Inswinger' | 'Outswinger' | 'Mixed';
export type PostMen = 'None' | 'Near' | 'Both';
export type MenBack = 1 | 2 | 3;

export interface TeamInstructions {
  mentality: Mentality;
  passing: PassingStyle;
  tempo: Tempo;
  pressing: Pressing;
  line: DefLine;
  width: Width;
  focus: Focus;
  onLoss: OnLoss;
  onWin: OnWin;
  distribution: Distribution;
  cornersFor: CornersFor;
  cornersAgainst: CornersAgainst;
  // SPEC 1.4 additions (§13.18)
  finalThird: FinalThird;
  crossStyle: CrossStyle;
  offsideTrap: boolean;
  tackling: Tackling;
  forceOpp: ForceOpp;
  timeWasting: TimeWasting;
  freeKicks: FreeKicks;
  cornerSwing: CornerSwing;
  menBack: MenBack;
  postMen: PostMen;
}

export type PlayerInstruction =
  | 'shootMore'
  | 'shootLess'
  | 'dribbleMore'
  | 'dribbleLess'
  | 'crossMore'
  | 'crossLess'
  | 'getForward'
  | 'holdPosition'
  | 'stayWider'
  | 'closeDownMore'
  | 'stayOnFeet'
  | 'longThrows'
  | 'roam'
  | 'sitNarrower'
  | 'crossFromByline'
  | 'crossFromDeep'
  | 'riskyPasses'
  | 'playSafe'; // §13.17.11 & §13.18.9

export interface OppOrder {
  kind: 'tightMark' | 'doubleUp' | 'pressOnBall' | 'showInside' | 'showOutside';
  target: PlayerId;
} // §13.17.3

export interface TacticPlan {
  // §13.18.10 & §13.19.4: Plan A/B/C
  name: string;
  formation: Formation;
  roles?: RoleId[]; // legacy fallback
  attRoles?: RoleId[]; // length 11 (§13.19.4)
  defRoles?: DefRoleId[]; // length 11 (§13.19.4)
  playerInstructions?: PlayerInstruction[][]; // legacy fallback
  attInstructions?: PlayerInstruction[][]; // length 11, each 0–2 (§13.19.4)
  defInstructions?: DefInstruction[][]; // length 11, each 0–1 (§13.19.4)
  instructions: TeamInstructions;
}

export interface Familiarity {
  formation: Record<Formation, number>;
  mentality: Record<string, number>;
  passing: Record<PassingStyle, number>;
  pressing: Record<Pressing, number>;
} // 0–100, per club (§13.18.11)

export interface Tactics {
  formation: Formation;
  lineup: (PlayerId | null)[]; // length 11, index = slot index in formations.ts
  roles?: RoleId[]; // legacy fallback (§13.17.2)
  attRoles?: RoleId[]; // length 11, attacking roles (§13.19.4)
  defRoles?: DefRoleId[]; // length 11, defensive roles (§13.19.4)
  duties?: Duty[]; // legacy fallback
  playerInstructions?: PlayerInstruction[][]; // legacy fallback
  attInstructions?: PlayerInstruction[][]; // length 11, each 0–2 (§13.19.4)
  defInstructions?: DefInstruction[][]; // length 11, each 0–1 (§13.19.4)
  bench: PlayerId[]; // 0–9
  captain: PlayerId | null;
  takers: {
    penalty: PlayerId | null;
    freeKick: PlayerId | null;
    corner: PlayerId | null;
    longThrow: PlayerId | null;
  };
  instructions: TeamInstructions;
  opposition: OppOrder[]; // 0–3, set per match (cleared after each match)
  // SPEC 1.4 additions (§13.18.10)
  plans?: [TacticPlan, TacticPlan, TacticPlan];
  activePlan?: 0 | 1 | 2;
}

// --- 8.5 Club ---
export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'halves' | 'sash' | 'chevron';

export interface Kit {
  shirt: string;
  shirt2: string;
  pattern: KitPattern;
  shorts: string;
  socks: string;
  text: string;
}

export type Intensity = 'Light' | 'Normal' | 'Hard';

export interface TrainingPlan {
  focus: 'Balanced' | 'Attacking' | 'Defending' | 'Fitness' | 'SetPieces' | 'Tactical';
  intensity: Intensity;
  individual: Record<PlayerId, AttributeKey | null>;
}

export interface Club {
  id: ClubId;
  name: string;
  shortName: string;
  code: string; // code = 3 letters
  nickname: string;
  city: string;
  founded: number;
  stadium: { name: string; capacity: number };
  colors: { primary: string; secondary: string; text: string };
  kits: { home: Kit; away: Kit; gk: Kit };
  reputation: 2 | 3 | 4 | 5;
  style: TeamInstructions & { formation: Formation };
  managerName: string; // AI manager (fictional)
  rivals: ClubId[];
  balance: number;
  transferBudget: number;
  wageBudget: number; // wageBudget = per week
  expectation: { target: number; acceptable: number; label: string };
  boardConfidence: number; // 0–100
  fanMood: number; // 0–100
  formationFamiliarity: Record<Formation, number>; // 0–100
  familiarity?: Familiarity; // 0–100, per club (§13.18.11)
  tactics: Tactics;
  squad: PlayerId[];
  trainingPlan: TrainingPlan;
  seasonStats: {
    gateIncome: number;
    tvIncome: number;
    sponsorIncome: number;
    prizeMoney: number;
    wagesPaid: number;
    transferIn: number;
    transferOut: number;
    operating: number;
  };
}

// --- 8.6 Fixtures, results, table ---
export interface Fixture {
  id: FixtureId;
  matchday: number;
  homeId: ClubId;
  awayId: ClubId;
  kickoff: 'Afternoon' | 'Evening' | 'Night';
  weather: 'Clear' | 'Overcast' | 'Rain';
  isDerby: boolean;
  result: MatchResultSummary | null;
}

export interface MatchResultSummary {
  homeGoals: number;
  awayGoals: number;
  scorers: {
    playerId: PlayerId;
    side: Side;
    minuteLabel: string;
    penalty: boolean;
    ownGoal: boolean;
  }[];
  attendance: number;
  motm: PlayerId;
  stats: { home: TeamMatchStats; away: TeamMatchStats };
}

export interface TableRow {
  clubId: ClubId;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: ('W' | 'D' | 'L')[];
}

// --- 8.7 Inbox and news ---
export type InboxKind =
  | 'Board'
  | 'Assistant'
  | 'Medical'
  | 'Transfer'
  | 'Player'
  | 'League'
  | 'Press'
  | 'Fans';

export interface InboxItem {
  id: string;
  matchday: number;
  kind: InboxKind;
  title: string;
  body: string;
  read: boolean;
  requiresAction: boolean;
  action?: {
    type: 'conversation' | 'transferOffer' | 'contract' | 'board';
    refId: string;
  };
}

export interface NewsItem {
  id: string;
  matchday: number;
  headline: string;
  body: string;
  image?: string;
  clubIds: ClubId[];
  playerIds: PlayerId[];
}

// --- 8.8 Transfers ---
export interface TransferOffer {
  id: string;
  playerId: PlayerId;
  fromClubId: ClubId | null;
  toClubId: ClubId;
  fee: number;
  status:
    | 'Pending'
    | 'Accepted'
    | 'Rejected'
    | 'Countered'
    | 'Withdrawn'
    | 'Completed'
    | 'PlayerRefused';
  counterFee?: number;
  createdRound: number;
  bidsMade: number;
  contractOffer?: {
    wagePerWeek: number;
    years: 1 | 2 | 3 | 4;
    role: SquadRole;
  };
}

export interface TransferWindowState {
  kind: 'Preseason' | 'Midseason';
  round: 1 | 2 | 3;
  offers: TransferOffer[];
  scoutingQueue: PlayerId[];
  scoutingDoneThisRound: number;
  boardWageRequestUsed: boolean;
}

// --- 8.9 GameState (the save) ---
export type Phase =
  | 'BoardMeeting'
  | 'Preseason'
  | 'TransferWindow'
  | 'PreMatch'
  | 'Match'
  | 'PostMatch'
  | 'WeekSummary'
  | 'SeasonEnd'
  | 'Sacked';

export interface SeasonAwards {
  playerOfTheSeason: PlayerId;
  goldenBoot: PlayerId;
  playmaker: PlayerId;
  goldenGlove: PlayerId;
  youngPlayer: PlayerId;
  managerOfTheSeason: ClubId;
  teamOfTheSeason: PlayerId[];
}

export interface GameState {
  version: number; // SAVE_VERSION
  seed: number; // save seed
  createdAt: string; // ISO string from UI layer
  managerName: string;
  userClubId: ClubId;
  matchday: number; // 0 = preseason, 1..18
  phase: Phase;
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  freeAgents: PlayerId[];
  fixtures: Fixture[];
  table: TableRow[]; // always sorted
  window: TransferWindowState | null;
  inbox: InboxItem[];
  news: NewsItem[];
  pressHistory: string[]; // question ids already asked
  conversationsHistory: string[];
  tutorial: { step: number; done: boolean };
  pendingMatch: { fixtureId: FixtureId } | null;
  focusBoost?: number; // team-wide z-unit boost from pre-match team talk (§12.8)
  awards: SeasonAwards | null;
  score: number; // leaderboard score, computed at season end
  counters: { news: number; inbox: number; offer: number };
}

// --- 13. Match Engine Types ---
export type ShotContext =
  | 'PENALTY'
  | 'ONE_ON_ONE'
  | 'SIX_YARD'
  | 'BOX_CENTRAL'
  | 'BOX_WIDE'
  | 'HEADER'
  | 'REBOUND'
  | 'OUTSIDE_CENTRAL'
  | 'OUTSIDE_WIDE'
  | 'DIRECT_FK';

export interface TeamSheet {
  clubId: ClubId;
  side: Side;
  tactics: Tactics;
  familiarity: number; // 0–100 for tactics.formation
  areaFamiliarity?: Familiarity; // 0–100, per club (§13.18.11)
  players: Record<
    PlayerId,
    {
      attributes: Attributes;
      positions: Player['positions'];
      condition: number;
      fatigue: number;
      morale: number;
      personality: Personality;
      name: string;
      shirt: number;
    }
  >;
  trainingBonus: { attack: number; defence: number; setPieces: number }; // z-units, §12.3
  focusBoost: number; // from team talk, §12.8
}

export interface MatchInput {
  fixtureId: FixtureId;
  home: TeamSheet;
  away: TeamSheet;
  isDerby: boolean;
  weather: Fixture['weather'];
  userSide: Side | null;
  aiControls: Side[]; // sides run by aiManager
}

export type MatchEventType =
  | 'KICKOFF'
  | 'PASS'
  | 'PASS_FAIL'
  | 'INTERCEPTION'
  | 'LONG_BALL'
  | 'AERIAL_DUEL'
  | 'SWITCH'
  | 'DRIBBLE'
  | 'DRIBBLE_FAIL'
  | 'TACKLE'
  | 'FOUL'
  | 'FREE_KICK'
  | 'CROSS'
  | 'CLAIM'
  | 'CLEARANCE'
  | 'THROUGH_BALL'
  | 'OFFSIDE'
  | 'SHOT'
  | 'BLOCK'
  | 'SAVE'
  | 'MISS'
  | 'POST'
  | 'GOAL'
  | 'CORNER'
  | 'THROW_IN'
  | 'GOAL_KICK'
  | 'YELLOW'
  | 'RED'
  | 'INJURY'
  | 'SUB'
  | 'TACTIC_CHANGE'
  | 'PENALTY_AWARDED'
  | 'ADDED_TIME'
  | 'HALF_TIME'
  | 'FULL_TIME';

export interface MatchEvent {
  seq: number;
  t: number; // match clock seconds since kickoff
  minuteLabel: string; // '23', '45+2', '90+4'
  half: 1 | 2;
  type: MatchEventType;
  side: Side;
  playerId?: PlayerId;
  targetId?: PlayerId;
  opponentId?: PlayerId;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  duration: number; // sim seconds this event spans
  height?: 'ground' | 'lofted' | 'high';
  shot?: {
    context: ShotContext;
    xg: number;
    onTarget: boolean;
    bodyPart: 'Foot' | 'Head';
    target?: { y: number; z: number };
  };
  importance: 0 | 1 | 2 | 3; // 0 routine, 1 notable, 2 chance/card, 3 goal/red/penalty
  commentaryKey?: string;
  scoreAfter: { home: number; away: number };
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  possessionSec: number;
  passes: number;
  passesCompleted: number;
  corners: number;
  fouls: number;
  offsides: number;
  yellow: number;
  red: number;
  tackles: number;
  interceptions: number;
  saves: number;
  bigChances: number;
  countersStarted?: number;
  countersConceded?: number;
  countersConcededAfterCorner?: number;
  ballWinsMidAtt?: number;
  ballWinsOppDefThird?: number;
}

export interface PlayerMatchLine {
  playerId: PlayerId;
  side: Side;
  minutes: number;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  passes: number;
  passesCompleted: number;
  dribbles: number;
  tackles: number;
  interceptions: number;
  saves: number;
  yellow: number;
  red: number;
  injured: boolean;
  conditionEnd: number;
  aerialDuelsWon?: number;
  throughBallsConceded?: number;
}

export interface MatchResult {
  fixtureId: FixtureId;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: { home: TeamMatchStats; away: TeamMatchStats };
  players: PlayerMatchLine[];
  motm: PlayerId;
  injuries: { playerId: PlayerId; injury: Injury }[];
}

export type MatchCommand =
  | {
      kind: 'instructions';
      side: Side;
      instructions: TeamInstructions;
      playerInstructions?: PlayerInstruction[][];
      attInstructions?: PlayerInstruction[][];
      defInstructions?: DefInstruction[][];
      issuedAtT: number;
    }
  | {
      kind: 'formation';
      side: Side;
      formation: Formation;
      lineup: (PlayerId | null)[];
      roles?: RoleId[];
      attRoles?: RoleId[];
      defRoles?: DefRoleId[];
      playerInstructions?: PlayerInstruction[][];
      attInstructions?: PlayerInstruction[][];
      defInstructions?: DefInstruction[][];
      duties?: Duty[];
      issuedAtT: number;
    }
  | {
      kind: 'opposition';
      side: Side;
      orders: OppOrder[];
      issuedAtT: number;
    }
  | {
      kind: 'sub';
      side: Side;
      outId: PlayerId;
      inId: PlayerId;
      slot: number;
      issuedAtT: number;
    }
  | {
      kind: 'plan';
      side: Side;
      plan: 0 | 1 | 2;
      issuedAtT: number;
    };
