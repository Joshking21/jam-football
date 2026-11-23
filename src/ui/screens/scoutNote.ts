// Scout's note composer (REVIEW-M5 R7). Lines live in src/content/scouting.json.
import type { AttributeKey, Player, Position } from '../../core/types';
import raw from '../../content/scouting.json';

type Group = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'WIDE' | 'ST';

interface ScoutingContent {
  firstLook: string[];
  strength: Record<Group, Partial<Record<AttributeKey, string[]>>>;
  weakness: Partial<Record<AttributeKey, string[]>>;
  personality: Record<string, string[]>;
}
const content = raw as unknown as ScoutingContent;

const GROUP_OF: Record<Position, Group> = {
  GK: 'GK',
  CB: 'CB',
  LB: 'FB',
  RB: 'FB',
  LWB: 'FB',
  RWB: 'FB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  LM: 'WIDE',
  RM: 'WIDE',
  LW: 'WIDE',
  RW: 'WIDE',
  ST: 'ST',
};

/** Attributes a scout would judge for each group, used to find the best and worst. */
const RELEVANT: Record<Group, AttributeKey[]> = {
  GK: ['reflexes', 'handling', 'oneOnOnes', 'aerialCommand', 'passing', 'composure'],
  CB: ['tackling', 'heading', 'strength', 'positioning', 'pace', 'passing', 'composure'],
  FB: ['pace', 'crossing', 'tackling', 'stamina', 'positioning', 'dribbling', 'workRate'],
  DM: ['tackling', 'positioning', 'passing', 'workRate', 'strength', 'decisions'],
  CM: ['passing', 'stamina', 'workRate', 'decisions', 'longShots', 'firstTouch', 'tackling'],
  AM: ['passing', 'dribbling', 'firstTouch', 'decisions', 'longShots', 'offTheBall', 'composure'],
  WIDE: ['pace', 'dribbling', 'crossing', 'finishing', 'workRate', 'firstTouch'],
  ST: ['finishing', 'offTheBall', 'heading', 'pace', 'strength', 'composure', 'firstTouch'],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(lines: string[] | undefined, seed: number): string | null {
  if (!lines || lines.length === 0) return null;
  return lines[seed % lines.length] ?? null;
}

/** Composes a deterministic note for this player. `knowledgePct` < 40 adds a first-look caveat. */
export function composeScoutNote(player: Player, knowledgePct: number): string {
  const group = GROUP_OF[player.positions[0]?.pos ?? 'CM'];
  const keys = RELEVANT[group];
  const seed = hash(player.id);
  const a = player.attributes;

  let best = keys[0]!;
  let worst = keys[0]!;
  for (const k of keys) {
    if (a[k] > a[best]) best = k;
    if (a[k] < a[worst]) worst = k;
  }

  const foot = player.foot === 'Both' ? 'either' : player.foot.toLowerCase();
  const parts: string[] = [];

  if (knowledgePct < 40) {
    const first = pick(content.firstLook, seed);
    if (first) parts.push(first);
  }
  const strength = pick(content.strength[group]?.[best], seed >>> 3);
  if (strength) parts.push(strength);

  // Only flag a weakness when there is a real gap (otherwise he's simply solid).
  // Pairs that read as a contradiction side by side ("runs all day… picks when to work").
  const clash =
    (best === 'stamina' && worst === 'workRate') || (best === 'workRate' && worst === 'stamina');
  if (a[best] - a[worst] >= 8 && !clash) {
    const weak = pick(content.weakness[worst], seed >>> 5);
    if (weak) parts.push(weak);
  }
  if (seed % 3 === 0) {
    const pers = pick(content.personality[player.personality], seed >>> 7);
    if (pers) parts.push(pers);
  }
  if (parts.length === 0) return 'Solid. Nothing stands out either way.';
  return parts.join(' ').replace(/\{foot\}/g, foot);
}
