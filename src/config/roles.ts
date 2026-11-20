// Implements SPEC §13.17.2 Player Roles with Fit
import { Position, Attributes, RoleId } from '../core/types';
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
