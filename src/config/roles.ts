// Implements SPEC §13.17.2, §13.18, §13.19 Player Roles (Attacking & Defensive) and Instructions with Fit
import {
  Position,
  Attributes,
  RoleId,
  DefRoleId,
  PlayerInstruction,
  DefInstruction,
} from '../core/types';
import { clamp, roundTo } from '../core/math';

export interface RoleDefinition {
  id: RoleId;
  name: string;
  slots: Position[];
  description: string;
  keyAttributes: Partial<Record<keyof Attributes, number>>;
  isNeutral: boolean;
  gives: string;
  costs: string;
}

export interface DefRoleDefinition {
  id: DefRoleId;
  name: string;
  slots: Position[];
  description: string;
  keyAttributes: Partial<Record<keyof Attributes, number>>;
  isNeutral: boolean;
  gives: string;
  costs: string;
  anim?: string;
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  // --- Goalkeeper ---
  gk: {
    id: 'gk',
    name: 'Goalkeeper',
    slots: ['GK'],
    description: 'Stays on his line.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Neutral positioning on the goal line',
    costs: 'No active sweeping behind defence',
  },
  bp_keeper: {
    id: 'bp_keeper',
    name: 'Ball-playing keeper',
    slots: ['GK'],
    description: 'Brings it out from the back.',
    keyAttributes: { passing: 0.5, composure: 0.3, decisions: 0.2 },
    isNeutral: false,
    gives: 'Short distribution pass bonus from the back',
    costs: 'Against a High press his short passes ctx −0.2',
  },
  sweeper_keeper: {
    id: 'sweeper_keeper',
    name: 'Sweeper keeper',
    slots: ['GK'],
    description: 'Comes off his line to sweep behind the defence.',
    keyAttributes: { oneOnOnes: 0.4, decisions: 0.3, passing: 0.3 },
    isNeutral: false,
    gives: 'Suppresses opponent through balls and one-on-ones',
    costs: 'Vulnerable to long-range chips; risk of fouls outside box',
  },

  // --- Centre-Backs ---
  cb: {
    id: 'cb',
    name: 'Centre-back',
    slots: ['CB'],
    description: 'Defends his zone.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Disciplined zonal marking',
    costs: 'No proactive stepping or line-breaking passes',
  },
  stopper: {
    id: 'stopper',
    name: 'Stopper',
    slots: ['CB'],
    description: 'Steps out to win it early.',
    keyAttributes: { tackling: 0.4, strength: 0.3, heading: 0.3 },
    isNeutral: false,
    gives: 'Aggressive challenges, aerial dominance and press bonuses',
    costs: 'Space left in behind if beaten; more fouls',
  },
  covering_cb: {
    id: 'covering_cb',
    name: 'Covering centre-back',
    slots: ['CB'],
    description: 'Drops off and sweeps up behind.',
    keyAttributes: { positioning: 0.4, pace: 0.4, decisions: 0.2 },
    isNeutral: false,
    gives: 'Cuts out through balls and protects the depth',
    costs: 'Drops off early; reduced pressing and tackle pressure',
  },
  ball_playing_cb: {
    id: 'ball_playing_cb',
    name: 'Ball-playing centre-back',
    slots: ['CB'],
    description: 'Brings it out and starts attacks.',
    keyAttributes: { passing: 0.5, composure: 0.3, decisions: 0.2 },
    isNeutral: false,
    gives: 'Progressive passes and accurate switches from deep',
    costs: 'Turnovers in defensive third under high pressing',
  },

  // --- Full-Backs & Wing-Backs ---
  fb: {
    id: 'fb',
    name: 'Full-back',
    slots: ['LB', 'RB', 'LWB', 'RWB'],
    description: "Gets forward when it's on.",
    keyAttributes: {},
    isNeutral: true,
    gives: 'Balanced defensive and offensive contributions',
    costs: 'No specialist defensive cover or relentless overlapping',
  },
  fb_defensive: {
    id: 'fb_defensive',
    name: 'Defensive full-back',
    slots: ['LB', 'RB', 'LWB', 'RWB'],
    description: 'Stays home and guards the flank.',
    keyAttributes: { positioning: 0.4, tackling: 0.4, strength: 0.2 },
    isNeutral: false,
    gives: 'Solid flank lockdown; suppresses opponent wide actions',
    costs: 'Minimal attacking support; crosses reduced',
  },
  fb_overlapping: {
    id: 'fb_overlapping',
    name: 'Overlapping full-back',
    slots: ['LB', 'RB', 'LWB', 'RWB'],
    description: 'Bursts past the winger to cross.',
    keyAttributes: { crossing: 0.4, pace: 0.3, stamina: 0.3 },
    isNeutral: false,
    gives: 'Frequent high crosses and attacking width',
    costs: 'Exposes his flank to opponent counter-attacks; high fatigue',
  },
  fb_inverted: {
    id: 'fb_inverted',
    name: 'Inverted full-back',
    slots: ['LB', 'RB', 'LWB', 'RWB'],
    description: 'Steps into midfield when we have it.',
    keyAttributes: { passing: 0.4, decisions: 0.3, firstTouch: 0.3 },
    isNeutral: false,
    gives: 'Midfield control and numerical overload in buildup',
    costs: 'No natural width on the flank; vulnerable to wide counters',
  },

  // --- Defensive Midfielders ---
  dm: {
    id: 'dm',
    name: 'Holding midfielder',
    slots: ['DM'],
    description: 'Shields the back line.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Central screen in front of central defenders',
    costs: 'No specialist playmaking or roaming ball-winning',
  },
  anchor: {
    id: 'anchor',
    name: 'Anchor',
    slots: ['DM'],
    description: 'Never leaves the space in front of the defence.',
    keyAttributes: { positioning: 0.5, tackling: 0.3, decisions: 0.2 },
    isNeutral: false,
    gives: 'Denies opponent central play; reliable recycling',
    costs: 'Rarely supports attacks; zero forward penetration',
  },
  deep_playmaker: {
    id: 'deep_playmaker',
    name: 'Deep playmaker',
    slots: ['DM', 'CM'],
    description: 'Dictates play from deep.',
    keyAttributes: { passing: 0.5, decisions: 0.3, composure: 0.2 },
    isNeutral: false,
    gives: 'Quarterbacks play with long switches and through balls',
    costs: 'Vulnerable to opponent high pressing and turnovers deep',
  },
  ball_winner: {
    id: 'ball_winner',
    name: 'Ball-winner',
    slots: ['DM', 'CM'],
    description: 'Hunts the ball down.',
    keyAttributes: { tackling: 0.4, workRate: 0.3, stamina: 0.3 },
    isNeutral: false,
    gives: 'Fierce pressing and tackling in midfield',
    costs: 'Higher foul counts, cards, and rapid fatigue drain',
  },

  // --- Central Midfielders ---
  cm: {
    id: 'cm',
    name: 'Central midfielder',
    slots: ['CM'],
    description: 'Does a bit of everything.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Reliable all-around engine in the center of the pitch',
    costs: 'Jack of all trades, master of none',
  },
  box_to_box: {
    id: 'box_to_box',
    name: 'Box-to-box',
    slots: ['CM'],
    description: 'Covers every blade of grass.',
    keyAttributes: { stamina: 0.4, workRate: 0.3, passing: 0.3 },
    isNeutral: false,
    gives: 'Dual presence in both boxes; extra press intensity',
    costs: 'Severe fatigue drain across 90 minutes',
  },
  playmaker: {
    id: 'playmaker',
    name: 'Playmaker',
    slots: ['CM', 'AM'],
    description: 'Gets on the ball and picks the pass.',
    keyAttributes: { passing: 0.4, decisions: 0.3, firstTouch: 0.3 },
    isNeutral: false,
    gives: 'High ball involvement and defense-splitting passes',
    costs: 'Weak defensive contribution and press resistance',
  },
  runner: {
    id: 'runner',
    name: 'Late runner',
    slots: ['CM'],
    description: 'Arrives late in the box.',
    keyAttributes: { offTheBall: 0.5, finishing: 0.3, stamina: 0.2 },
    isNeutral: false,
    gives: 'Surprise runs into the penalty area to finish chances',
    costs: 'Vacates midfield, allowing opponent progressive passing',
  },

  // --- Attacking Midfielders ---
  am: {
    id: 'am',
    name: 'Number 10',
    slots: ['AM'],
    description: 'Links midfield and attack.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Fluid connection between midfield and forward line',
    costs: 'No specialist scoring instinct or deep roaming',
  },
  shadow_striker: {
    id: 'shadow_striker',
    name: 'Shadow striker',
    slots: ['AM'],
    description: 'Plays off the striker and gets in the box.',
    keyAttributes: { offTheBall: 0.4, finishing: 0.4, composure: 0.2 },
    isNeutral: false,
    gives: 'Second goalscorer running onto through balls in the box',
    costs: 'Neglects defensive pressing and midfield recovery',
  },

  // --- Wide Midfielders ---
  wm: {
    id: 'wm',
    name: 'Wide midfielder',
    slots: ['LM', 'RM'],
    description: 'Works the flank both ways.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Flank stability and balanced tracking',
    costs: 'No high-volume crosses or inside shooting threat',
  },
  wm_defensive: {
    id: 'wm_defensive',
    name: 'Defensive winger',
    slots: ['LM', 'RM', 'LW', 'RW'],
    description: 'Tracks back to help his full-back.',
    keyAttributes: { workRate: 0.4, tackling: 0.3, stamina: 0.3 },
    isNeutral: false,
    gives: 'Double-teams opponent wide attackers; defensive third help',
    costs: 'Muted individual attacking threat and crossing',
  },
  wide_playmaker: {
    id: 'wide_playmaker',
    name: 'Wide playmaker',
    slots: ['LM', 'RM'],
    description: 'Drifts inside to make things happen.',
    keyAttributes: { passing: 0.4, decisions: 0.3, dribbling: 0.3 },
    isNeutral: false,
    gives: 'Central overload and incisive interior passing',
    costs: 'Gives up wide touchline width; fewer traditional crosses',
  },

  // --- Wide Forwards ---
  wf: {
    id: 'wf',
    name: 'Wide forward',
    slots: ['LW', 'RW'],
    description: 'Attacks his flank.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Standard winger attacking duties',
    costs: 'No specialised cut-inside finishing or pure line-hugging',
  },
  winger: {
    id: 'winger',
    name: 'Winger',
    slots: ['LM', 'RM', 'LW', 'RW'],
    description: 'Hugs the line, beats his man, crosses.',
    keyAttributes: { crossing: 0.4, dribbling: 0.3, pace: 0.3 },
    isNeutral: false,
    gives: 'Maximum width, one-on-one take-ons and high volume crossing',
    costs: 'Rarely gets into central scoring positions',
  },
  inside_forward: {
    id: 'inside_forward',
    name: 'Inside forward',
    slots: ['LM', 'RM', 'LW', 'RW'],
    description: 'Cuts inside to shoot.',
    keyAttributes: { finishing: 0.3, dribbling: 0.3, longShots: 0.2, pace: 0.2 },
    isNeutral: false,
    gives: 'Cuts inside onto stronger foot to score; central xG threat',
    costs: 'Neglects crossing; needs an overlapping full-back for width',
  },

  // --- Strikers ---
  st: {
    id: 'st',
    name: 'Striker',
    slots: ['ST'],
    description: 'Leads the line.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Standard focal point attack',
    costs: 'No specialist hold-up, deep dropping or line running',
  },
  target_man: {
    id: 'target_man',
    name: 'Target man',
    slots: ['ST'],
    description: 'Wins headers and holds it up.',
    keyAttributes: { heading: 0.4, strength: 0.4, firstTouch: 0.2 },
    isNeutral: false,
    gives: 'Aerial dominance, long-ball outlet, knockdowns for runners',
    costs: 'Lacks pace and dribbling agility; poor on through balls',
  },
  poacher: {
    id: 'poacher',
    name: 'Poacher',
    slots: ['ST'],
    description: 'Lives in the box.',
    keyAttributes: { finishing: 0.4, offTheBall: 0.4, composure: 0.2 },
    isNeutral: false,
    gives: 'Deadly predatory finishing from six-yard and central box',
    costs: 'Zero involvement in buildup play; weakens frontline pressing',
  },
  pressing_forward: {
    id: 'pressing_forward',
    name: 'Pressing forward',
    slots: ['ST'],
    description: 'Leads the press from the front.',
    keyAttributes: { workRate: 0.4, stamina: 0.3, pace: 0.3 },
    isNeutral: false,
    gives: 'Disrupts opponent defensive buildup and forces errors',
    costs: 'Fatigues quickly; lower personal scoring output',
  },
  false_nine: {
    id: 'false_nine',
    name: 'False nine',
    slots: ['ST'],
    description: 'Drops deep and drags defenders out.',
    keyAttributes: { passing: 0.3, decisions: 0.3, firstTouch: 0.2, dribbling: 0.2 },
    isNeutral: false,
    gives: 'Drags center-backs out of position; assists runners',
    costs: 'Fewer bodies in the box; weakens cross conversion',
  },
  advanced_forward: {
    id: 'advanced_forward',
    name: 'Advanced forward',
    slots: ['ST'],
    description: 'Runs in behind the defence.',
    keyAttributes: { pace: 0.4, offTheBall: 0.4, finishing: 0.2 },
    isNeutral: false,
    gives: 'Breaks defensive lines onto through balls; one-on-ones',
    costs: 'Frequent offsides; minimal involvement in midfield buildup',
  },
};

/**
 * Computes player fit for a given role (SPEC §13.17.1):
 * score = Σ w · attribute
 * fit = clamp((score - 50) / 30, 0, 1)
 * stars = 1 + round(4 · fit)
 */
export function computeRoleFit(
  arg1: RoleId | Attributes,
  arg2: Attributes | RoleId,
): { score: number; fit: number; stars: number } {
  const roleId = (typeof arg1 === 'string' ? arg1 : arg2) as RoleId;
  const attributes = (typeof arg1 === 'string' ? arg2 : arg1) as Attributes;
  const role = ROLES[roleId];
  if (!role || role.isNeutral || Object.keys(role.keyAttributes).length === 0) {
    return { score: 70, fit: 1, stars: 5 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [attr, weight] of Object.entries(role.keyAttributes)) {
    const val = attributes[attr as keyof Attributes] ?? 50;
    weightedSum += (weight as number) * val;
    totalWeight += weight as number;
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 50;
  const fit = clamp((score - 50) / 30, 0, 1);
  const stars = 1 + Math.round(4 * fit);

  return {
    score: roundTo(score, 1),
    fit: roundTo(fit, 3),
    stars: clamp(stars, 1, 5),
  };
}

/**
 * Returns default neutral role for position
 */
export function getDefaultRoleForPos(pos: Position): RoleId {
  switch (pos) {
    case 'GK':
      return 'gk';
    case 'CB':
      return 'cb';
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
      return 'fb';
    case 'DM':
      return 'dm';
    case 'CM':
      return 'cm';
    case 'AM':
      return 'am';
    case 'LM':
    case 'RM':
      return 'wm';
    case 'LW':
    case 'RW':
      return 'wf';
    case 'ST':
      return 'st';
    default:
      return 'cm';
  }
}

/**
 * Returns all valid roles for a given slot position
 */
export function getAvailableRolesForSlot(pos: Position): RoleDefinition[] {
  return Object.values(ROLES).filter((r) => r.slots.includes(pos));
}

export function getAvailableAttRolesForSlot(pos: Position): RoleDefinition[] {
  const allowedIds = ATT_SLOT[pos] || [];
  return allowedIds.map((id) => ROLES[id]).filter((r): r is RoleDefinition => Boolean(r));
}

/* =====================================================================
   DEFENSIVE ROLES (SPEC §13.19.2)
   First in each slot list is the neutral default
   ===================================================================== */

export const DEF_ROLES: Record<DefRoleId, DefRoleDefinition> = {
  gk_line: {
    id: 'gk_line',
    name: 'Stay on the line',
    slots: ['GK'],
    description: 'Guards his goal.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Neutral positioning on the line',
    costs: 'No aggressive sweeping',
  },
  gk_sweep: {
    id: 'gk_sweep',
    name: 'Sweep behind',
    slots: ['GK'],
    description: 'Comes off his line to clear balls in behind.',
    keyAttributes: { oneOnOnes: 0.5, decisions: 0.5 },
    isNeutral: false,
    gives: 'Cuts out through balls and one-on-ones',
    costs: 'Exposed to shots from distance; risks fouls outside the box',
    anim: 'fwd',
  },
  cb_hold: {
    id: 'cb_hold',
    name: 'Hold the line',
    slots: ['CB'],
    description: 'Defends his zone with the back line.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Disciplined zonal marking',
    costs: 'No proactive stepping or cover sweep',
  },
  cb_step: {
    id: 'cb_step',
    name: 'Step out',
    slots: ['CB'],
    description: 'Steps out to win it early.',
    keyAttributes: { tackling: 0.4, strength: 0.3, heading: 0.3 },
    isNeutral: false,
    gives: 'Wins tackles and headers early',
    costs: 'Space behind him if he’s beaten; more fouls',
    anim: 'fwd',
  },
  cb_cover: {
    id: 'cb_cover',
    name: 'Cover behind',
    slots: ['CB'],
    description: 'Drops off and sweeps up behind.',
    keyAttributes: { positioning: 0.4, pace: 0.4, decisions: 0.2 },
    isNeutral: false,
    gives: 'Fewer balls in behind',
    costs: 'Softer in the tackle; gives the striker room to turn',
    anim: 'back',
  },
  fb_track: {
    id: 'fb_track',
    name: 'Track the winger',
    slots: ['LB', 'RB', 'LWB', 'RWB'],
    description: 'Stays with the man on his side.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Standard flank tracking',
    costs: 'No high pressing or central tucking',
  },
  fb_press: {
    id: 'fb_press',
    name: 'Press high',
    slots: ['LB', 'RB', 'LWB', 'RWB'],
    description: 'Closes their winger down early, high up.',
    keyAttributes: { workRate: 0.4, pace: 0.3, tackling: 0.3 },
    isNeutral: false,
    gives: 'Wins it back high on his side',
    costs: 'Space behind him if the press is beaten',
    anim: 'press',
  },
  fb_tuck: {
    id: 'fb_tuck',
    name: 'Tuck in',
    slots: ['LB', 'RB', 'LWB', 'RWB'],
    description: 'Narrows to protect the middle.',
    keyAttributes: { positioning: 0.5, decisions: 0.3, strength: 0.2 },
    isNeutral: false,
    gives: 'Fewer chances through the middle',
    costs: 'Their winger has room; more crosses against us',
    anim: 'in',
  },
  dm_screen: {
    id: 'dm_screen',
    name: 'Screen the defence',
    slots: ['DM'],
    description: 'Sits in front of the back line.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Central shield',
    costs: 'No aggressive ball-hunting or third-CB dropping',
  },
  dm_win: {
    id: 'dm_win',
    name: 'Win it back',
    slots: ['DM'],
    description: 'Hunts the ball down.',
    keyAttributes: { tackling: 0.4, workRate: 0.3, stamina: 0.3 },
    isNeutral: false,
    gives: 'Presses and tackles hard',
    costs: 'More fouls; tires faster',
    anim: 'press',
  },
  dm_drop: {
    id: 'dm_drop',
    name: 'Drop between the centre-backs',
    slots: ['DM'],
    description: 'Becomes a third centre-back.',
    keyAttributes: { positioning: 0.5, heading: 0.3, strength: 0.2 },
    isNeutral: false,
    gives: 'Fewer through balls; stronger in the air',
    costs: 'Space in front of our defence',
    anim: 'hold',
  },
  cm_hold: {
    id: 'cm_hold',
    name: 'Hold the zone',
    slots: ['CM'],
    description: 'Keeps his place in the shape.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Positioning in midfield shape',
    costs: 'No aggressive press or box-tracking',
  },
  cm_press: {
    id: 'cm_press',
    name: 'Press',
    slots: ['CM'],
    description: 'Closes down whoever comes into his zone.',
    keyAttributes: { workRate: 0.4, stamina: 0.3, tackling: 0.3 },
    isNeutral: false,
    gives: 'Wins the ball higher',
    costs: 'Tires faster; open when he’s beaten',
    anim: 'press',
  },
  cm_track: {
    id: 'cm_track',
    name: 'Track runners',
    slots: ['CM'],
    description: 'Follows midfield runners into the box.',
    keyAttributes: { stamina: 0.4, workRate: 0.3, positioning: 0.3 },
    isNeutral: false,
    gives: 'Late runners don’t get free in our box',
    costs: 'Tires faster; the middle can open up',
    anim: 'track',
  },
  am_screen: {
    id: 'am_screen',
    name: 'Screen their midfield',
    slots: ['AM'],
    description: 'Blocks passes into their midfield.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Blocks central pass lane',
    costs: 'No high pressing on their holding midfielder',
  },
  am_press: {
    id: 'am_press',
    name: 'Press',
    slots: ['AM'],
    description: 'Closes down their holding midfielder.',
    keyAttributes: { workRate: 0.5, stamina: 0.5 },
    isNeutral: false,
    gives: 'Their build-up is rushed',
    costs: 'Tires faster; space behind him',
    anim: 'press',
  },
  w_track: {
    id: 'w_track',
    name: 'Track back',
    slots: ['LM', 'RM', 'LW', 'RW'],
    description: 'Comes back to help his full-back.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Double-teams opponent wide attacks',
    costs: 'No counter outlet or high FB pressing',
  },
  w_press: {
    id: 'w_press',
    name: 'Press their full-back',
    slots: ['LM', 'RM', 'LW', 'RW'],
    description: 'Closes their full-back down high.',
    keyAttributes: { workRate: 0.4, pace: 0.3, stamina: 0.3 },
    isNeutral: false,
    gives: 'Their build-up down that side is rushed',
    costs: 'Tires faster; our full-back can be left two-on-one',
    anim: 'press',
  },
  w_high: {
    id: 'w_high',
    name: 'Stay high',
    slots: ['LM', 'RM', 'LW', 'RW'],
    description: 'Stays up the pitch as an outlet.',
    keyAttributes: { pace: 0.5, offTheBall: 0.5 },
    isNeutral: false,
    gives: 'Faster, better counter-attacks',
    costs: 'His full-back is left alone',
    anim: 'outlet',
  },
  st_central: {
    id: 'st_central',
    name: 'Stay central',
    slots: ['ST'],
    description: 'Waits between their centre-backs.',
    keyAttributes: {},
    isNeutral: true,
    gives: 'Central attacking position',
    costs: 'No forward line press or shoulder breaks',
  },
  st_press: {
    id: 'st_press',
    name: 'Press the defenders',
    slots: ['ST'],
    description: 'Leads the press from the front.',
    keyAttributes: { workRate: 0.4, stamina: 0.3, pace: 0.3 },
    isNeutral: false,
    gives: 'Presses their defenders into mistakes',
    costs: 'Tires faster',
    anim: 'press',
  },
  st_shoulder: {
    id: 'st_shoulder',
    name: 'Stay on the shoulder',
    slots: ['ST'],
    description: 'Stays on the last defender, ready to run.',
    keyAttributes: { pace: 0.5, offTheBall: 0.5 },
    isNeutral: false,
    gives: 'Always ready for a ball in behind',
    costs: 'Their defenders have time on the ball',
    anim: 'shoulder',
  },
};

const FB_A = ['fb', 'fb_defensive', 'fb_overlapping', 'fb_inverted'];
const FB_D: DefRoleId[] = ['fb_track', 'fb_press', 'fb_tuck'];
const W_D: DefRoleId[] = ['w_track', 'w_press', 'w_high'];

export const ATT_SLOT: Record<Position, RoleId[]> = {
  GK: ['gk', 'bp_keeper'],
  CB: ['cb', 'ball_playing_cb'],
  LB: FB_A,
  RB: FB_A,
  LWB: FB_A,
  RWB: FB_A,
  DM: ['dm', 'anchor', 'deep_playmaker'],
  CM: ['cm', 'box_to_box', 'deep_playmaker', 'playmaker', 'runner'],
  AM: ['am', 'playmaker', 'shadow_striker'],
  LM: ['wm', 'wide_playmaker', 'winger', 'inside_forward'],
  RM: ['wm', 'wide_playmaker', 'winger', 'inside_forward'],
  LW: ['wf', 'winger', 'inside_forward'],
  RW: ['wf', 'winger', 'inside_forward'],
  ST: ['st', 'target_man', 'poacher', 'false_nine', 'advanced_forward'],
};

export const DEF_SLOT: Record<Position, DefRoleId[]> = {
  GK: ['gk_line', 'gk_sweep'],
  CB: ['cb_hold', 'cb_step', 'cb_cover'],
  LB: FB_D,
  RB: FB_D,
  LWB: FB_D,
  RWB: FB_D,
  DM: ['dm_screen', 'dm_win', 'dm_drop'],
  CM: ['cm_hold', 'cm_press', 'cm_track'],
  AM: ['am_screen', 'am_press'],
  LM: W_D,
  RM: W_D,
  LW: W_D,
  RW: W_D,
  ST: ['st_central', 'st_press', 'st_shoulder'],
};

export function getDefaultDefRoleForPos(pos: Position): DefRoleId {
  return DEF_SLOT[pos]?.[0] ?? 'cb_hold';
}

export function getAvailableDefRolesForSlot(pos: Position): DefRoleDefinition[] {
  const allowed = DEF_SLOT[pos] || [];
  return allowed.map((id) => DEF_ROLES[id]).filter(Boolean);
}

export function computeDefRoleFit(
  attributes: Attributes,
  defRoleId: DefRoleId,
): { score: number; fit: number; stars: number } {
  const role = DEF_ROLES[defRoleId];
  if (!role || role.isNeutral || Object.keys(role.keyAttributes).length === 0) {
    return { score: 70, fit: 1, stars: 5 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [attr, weight] of Object.entries(role.keyAttributes)) {
    const val = attributes[attr as keyof Attributes] ?? 50;
    weightedSum += (weight as number) * val;
    totalWeight += weight as number;
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 50;
  const fit = clamp((score - 50) / 30, 0, 1);
  const stars = 1 + Math.round(4 * fit);

  return {
    score: roundTo(score, 1),
    fit: roundTo(fit, 3),
    stars: clamp(stars, 1, 5),
  };
}

/* =====================================================================
   INSTRUCTIONS (SPEC §13.17.11, §13.18.9, §13.19.3)
   ===================================================================== */

export interface InstructionInfo {
  wording: string;
  gives: string;
  costs: string;
  clashesWith?: string[];
  keyAttributes: Partial<Record<keyof Attributes, number>>;
}

export const ATT_PIS: Record<PlayerInstruction, InstructionInfo> = {
  shootMore: {
    wording: 'Shoot more: try his luck from distance.',
    gives: 'More shots from range',
    costs: 'Low-chance shots give the ball away',
    clashesWith: ['shootLess'],
    keyAttributes: { longShots: 0.6, composure: 0.4 },
  },
  shootLess: {
    wording: 'Shoot less: work a better chance.',
    gives: 'Waits for a better chance',
    costs: 'More passes in the final third to lose',
    clashesWith: ['shootMore'],
    keyAttributes: { decisions: 0.6, passing: 0.4 },
  },
  dribbleMore: {
    wording: 'Take players on.',
    gives: 'Beats men and wins fouls',
    costs: 'Loses it higher up the pitch',
    clashesWith: ['dribbleLess'],
    keyAttributes: { dribbling: 0.6, pace: 0.2, firstTouch: 0.2 },
  },
  dribbleLess: {
    wording: 'Move it on quickly.',
    gives: 'Keeps the ball moving',
    costs: 'Creates less on his own',
    clashesWith: ['dribbleMore'],
    keyAttributes: { passing: 0.5, decisions: 0.5 },
  },
  crossMore: {
    wording: 'Get it in the box early.',
    gives: 'More crosses',
    costs: 'The keeper claims more of them',
    clashesWith: ['crossLess'],
    keyAttributes: { crossing: 1 },
  },
  crossLess: {
    wording: 'Keep it on the floor.',
    gives: 'More passes into feet',
    costs: 'Fewer headers; easier to defend',
    clashesWith: ['crossMore', 'crossFromByline', 'crossFromDeep'],
    keyAttributes: { passing: 0.6, firstTouch: 0.4 },
  },
  crossFromByline: {
    wording: 'Get to the byline before crossing.',
    gives: 'Better crosses and cut-backs',
    costs: 'No early crosses; slower attacks',
    clashesWith: ['crossFromDeep', 'crossLess'],
    keyAttributes: { pace: 0.4, dribbling: 0.3, crossing: 0.3 },
  },
  crossFromDeep: {
    wording: 'Cross early, from deep.',
    gives: 'Gets it in before they’re set',
    costs: 'Worse deliveries; the keeper claims more',
    clashesWith: ['crossFromByline', 'crossLess'],
    keyAttributes: { crossing: 0.7, passing: 0.3 },
  },
  getForward: {
    wording: 'Get forward at every chance.',
    gives: 'An extra man in attack',
    costs: 'His zone is empty on the counter; tires faster',
    clashesWith: ['holdPosition'],
    keyAttributes: { stamina: 0.5, offTheBall: 0.5 },
  },
  holdPosition: {
    wording: 'Hold your position.',
    gives: 'Keeps the shape',
    costs: 'Less support in attack',
    clashesWith: ['getForward', 'roam'],
    keyAttributes: { positioning: 0.6, decisions: 0.4 },
  },
  roam: {
    wording: 'Roam from position.',
    gives: 'Turns up where they don’t expect him',
    costs: 'Leaves gaps in his own zone',
    clashesWith: ['holdPosition'],
    keyAttributes: { offTheBall: 0.4, decisions: 0.3, firstTouch: 0.3 },
  },
  stayWider: {
    wording: 'Stay wide and stretch them.',
    gives: 'Stretches their back line',
    costs: 'Fewer bodies in the middle',
    clashesWith: ['sitNarrower'],
    keyAttributes: { pace: 0.5, crossing: 0.5 },
  },
  sitNarrower: {
    wording: 'Sit narrower.',
    gives: 'More bodies in the middle',
    costs: 'Fewer crosses; his flank is open',
    clashesWith: ['stayWider'],
    keyAttributes: { passing: 0.5, positioning: 0.5 },
  },
  riskyPasses: {
    wording: 'Try the killer pass.',
    gives: 'More through balls',
    costs: 'Gives the ball away more',
    clashesWith: ['playSafe'],
    keyAttributes: { passing: 0.6, decisions: 0.4 },
  },
  playSafe: {
    wording: 'Play it safe.',
    gives: 'Keeps the ball',
    costs: 'Fewer through balls',
    clashesWith: ['riskyPasses'],
    keyAttributes: { composure: 0.5, passing: 0.5 },
  },
  longThrows: {
    wording: 'Take the long throws.',
    gives: 'Throw-ins in their third become crosses',
    costs: 'Slower restarts; the keeper claims more',
    keyAttributes: { strength: 1 },
  },
  closeDownMore: {
    wording: 'Close down more.',
    gives: 'Presses harder',
    costs: 'Tires faster; open when he’s beaten',
    clashesWith: ['standOff'],
    keyAttributes: { workRate: 0.4, stamina: 0.3, pace: 0.3 },
  },
  stayOnFeet: {
    wording: 'Stay on your feet.',
    gives: 'Half the fouls and cards',
    costs: 'Wins fewer tackles',
    clashesWith: ['tackleHarder'],
    keyAttributes: { positioning: 0.5, tackling: 0.5 },
  },
};

export const DEF_PIS: Record<DefInstruction, InstructionInfo> = {
  closeDownMore: {
    wording: 'Close down more.',
    gives: 'Presses harder',
    costs: 'Tires faster; open when he’s beaten',
    clashesWith: ['standOff'],
    keyAttributes: { workRate: 0.4, stamina: 0.3, pace: 0.3 },
  },
  standOff: {
    wording: 'Stand off him.',
    gives: 'Keeps his position; fewer balls in behind him',
    costs: 'The man in front has more time on the ball',
    clashesWith: ['closeDownMore'],
    keyAttributes: { positioning: 0.6, decisions: 0.4 },
  },
  tackleHarder: {
    wording: 'Get stuck in.',
    gives: 'Wins more tackles',
    costs: 'More fouls and cards',
    clashesWith: ['stayOnFeet'],
    keyAttributes: { tackling: 0.6, strength: 0.4 },
  },
  stayOnFeet: {
    wording: 'Stay on your feet.',
    gives: 'Half the fouls and cards',
    costs: 'Wins fewer tackles',
    clashesWith: ['tackleHarder'],
    keyAttributes: { positioning: 0.5, tackling: 0.5 },
  },
  markTighter: {
    wording: 'Mark tighter.',
    gives: 'His man sees less of the ball',
    costs: 'Gets turned and beaten in behind more',
    keyAttributes: { positioning: 0.4, strength: 0.3, pace: 0.3 },
  },
  trackRuns: {
    wording: 'Track runners all the way.',
    gives: 'Follows runners into the box',
    costs: 'Tires faster; leaves his own zone empty',
    keyAttributes: { stamina: 0.5, workRate: 0.3, pace: 0.2 },
  },
};

const PI_FB: PlayerInstruction[] = [
  'crossMore',
  'crossLess',
  'crossFromByline',
  'crossFromDeep',
  'getForward',
  'holdPosition',
  'stayWider',
  'sitNarrower',
  'dribbleMore',
  'longThrows',
];
const PI_MID: PlayerInstruction[] = [
  'shootMore',
  'shootLess',
  'dribbleMore',
  'dribbleLess',
  'riskyPasses',
  'playSafe',
  'getForward',
  'holdPosition',
  'roam',
];
const PI_WIDE: PlayerInstruction[] = [
  'shootMore',
  'shootLess',
  'dribbleMore',
  'dribbleLess',
  'crossMore',
  'crossLess',
  'crossFromByline',
  'crossFromDeep',
  'stayWider',
  'sitNarrower',
  'roam',
];
const PI_ST: PlayerInstruction[] = [
  'shootMore',
  'shootLess',
  'dribbleMore',
  'dribbleLess',
  'roam',
  'holdPosition',
  'riskyPasses',
  'playSafe',
];

export const ATT_ALLOW: Record<string, PlayerInstruction[]> = {
  gk: ['playSafe', 'riskyPasses'],
  bp_keeper: ['playSafe', 'riskyPasses'],
  cb: ['playSafe', 'riskyPasses', 'longThrows'],
  ball_playing_cb: ['riskyPasses', 'getForward', 'longThrows'],
  fb: PI_FB,
  fb_defensive: ['crossFromDeep', 'crossLess', 'playSafe', 'sitNarrower', 'longThrows'],
  fb_overlapping: [
    'crossMore',
    'crossFromByline',
    'crossFromDeep',
    'dribbleMore',
    'stayWider',
    'longThrows',
  ],
  fb_inverted: ['playSafe', 'riskyPasses', 'shootLess', 'holdPosition', 'dribbleLess'],
  dm: ['playSafe', 'riskyPasses', 'shootLess', 'holdPosition'],
  anchor: ['playSafe', 'shootLess'],
  deep_playmaker: ['riskyPasses', 'playSafe', 'shootLess', 'holdPosition'],
  cm: PI_MID,
  box_to_box: PI_MID,
  playmaker: ['riskyPasses', 'shootMore', 'shootLess', 'dribbleMore', 'dribbleLess', 'roam'],
  runner: ['shootMore', 'shootLess', 'dribbleMore', 'riskyPasses', 'roam'],
  am: PI_MID,
  shadow_striker: ['shootMore', 'shootLess', 'dribbleMore', 'dribbleLess', 'roam'],
  wm: PI_WIDE,
  wf: PI_WIDE,
  wide_playmaker: [
    'riskyPasses',
    'playSafe',
    'dribbleMore',
    'sitNarrower',
    'roam',
    'crossFromDeep',
  ],
  winger: [
    'crossMore',
    'crossFromByline',
    'crossFromDeep',
    'dribbleMore',
    'dribbleLess',
    'shootLess',
  ],
  inside_forward: [
    'shootMore',
    'shootLess',
    'dribbleMore',
    'dribbleLess',
    'sitNarrower',
    'riskyPasses',
  ],
  st: PI_ST,
  target_man: ['shootMore', 'shootLess', 'holdPosition', 'playSafe'],
  poacher: ['shootMore', 'shootLess', 'dribbleLess', 'holdPosition'],
  false_nine: ['riskyPasses', 'playSafe', 'dribbleMore', 'roam', 'shootLess'],
  advanced_forward: ['shootMore', 'shootLess', 'dribbleMore', 'dribbleLess', 'roam'],
};

const DEF_ALL_LIST: DefInstruction[] = [
  'closeDownMore',
  'standOff',
  'tackleHarder',
  'stayOnFeet',
  'markTighter',
  'trackRuns',
];

export const DEF_ALLOW: Record<DefRoleId, DefInstruction[]> = {
  gk_line: [],
  gk_sweep: [],
  cb_hold: ['standOff', 'tackleHarder', 'stayOnFeet', 'markTighter'],
  cb_step: ['stayOnFeet', 'markTighter'],
  cb_cover: ['standOff', 'stayOnFeet'],
  fb_track: DEF_ALL_LIST,
  fb_press: ['stayOnFeet', 'tackleHarder'],
  fb_tuck: ['standOff', 'markTighter', 'stayOnFeet'],
  dm_screen: ['closeDownMore', 'standOff', 'tackleHarder', 'stayOnFeet', 'trackRuns'],
  dm_win: ['stayOnFeet'],
  dm_drop: ['standOff', 'markTighter', 'stayOnFeet'],
  cm_hold: DEF_ALL_LIST,
  cm_press: ['stayOnFeet', 'tackleHarder'],
  cm_track: ['tackleHarder', 'stayOnFeet', 'markTighter'],
  am_screen: ['closeDownMore', 'standOff', 'trackRuns'],
  am_press: ['stayOnFeet', 'tackleHarder'],
  w_track: ['closeDownMore', 'standOff', 'tackleHarder', 'stayOnFeet', 'trackRuns'],
  w_press: ['stayOnFeet', 'tackleHarder'],
  w_high: [],
  st_central: ['closeDownMore', 'standOff'],
  st_press: ['stayOnFeet', 'tackleHarder'],
  st_shoulder: [],
};

export function computeInstructionFit(
  attributes: Attributes,
  instruction: PlayerInstruction | DefInstruction,
  isDef = false,
): { score: number; fit: number; stars: number } {
  const info = isDef
    ? DEF_PIS[instruction as DefInstruction]
    : ATT_PIS[instruction as PlayerInstruction];
  if (!info || Object.keys(info.keyAttributes).length === 0) {
    return { score: 70, fit: 1, stars: 5 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [attr, weight] of Object.entries(info.keyAttributes)) {
    const val = attributes[attr as keyof Attributes] ?? 50;
    weightedSum += (weight as number) * val;
    totalWeight += weight as number;
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 50;
  const fit = clamp((score - 50) / 30, 0, 1);
  const stars = 1 + Math.round(4 * fit);

  return {
    score: roundTo(score, 1),
    fit: roundTo(fit, 3),
    stars: clamp(stars, 1, 5),
  };
}

/**
 * Migration helper from old single role (§13.17.2) to attacking + defensive roles (§13.19.4)
 */
export function migrateRoleToAttAndDef(
  roleId: RoleId,
  pos: Position,
): { attRole: RoleId; defRole: DefRoleId } {
  switch (roleId) {
    case 'stopper':
      return { attRole: 'cb', defRole: 'cb_step' };
    case 'covering_cb':
      return { attRole: 'cb', defRole: 'cb_cover' };
    case 'sweeper_keeper':
      return { attRole: 'gk', defRole: 'gk_sweep' };
    case 'ball_winner':
      return {
        attRole: pos === 'DM' ? 'dm' : 'cm',
        defRole: pos === 'DM' ? 'dm_win' : 'cm_press',
      };
    case 'wm_defensive':
      return {
        attRole: pos === 'LW' || pos === 'RW' ? 'wf' : 'wm',
        defRole: 'w_track',
      };
    case 'pressing_forward':
      return { attRole: 'pressing_forward', defRole: 'st_press' };
    default:
      return {
        attRole: roleId,
        defRole: getDefaultDefRoleForPos(pos),
      };
  }
}
