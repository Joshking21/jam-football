// SPEC §13.23 player traits in the UI: chips, and a plain-language list for the player's file.
// The engine's effect strings are jargon; these are the words a coach would use.
import React from 'react';
import type { TraitId } from '../../core/types';
import { TRAIT_DEFINITIONS, isTraitClashing } from '../../core/player/traits';

export const TRAIT_PLAIN: Record<TraitId, { gain: string; cost: string }> = {
  cutsInside: { gain: 'Comes inside onto his stronger foot to shoot.', cost: 'Crosses far less.' },
  shootsFromDistance: {
    gain: 'Has a go from outside the box.',
    cost: 'Plenty of long shots that rarely go in.',
  },
  getsForward: {
    gain: 'Joins the attack from deep.',
    cost: 'Leaves space behind him on the break.',
  },
  staysBack: { gain: 'Holds his position when we attack.', cost: 'Rarely joins in up front.' },
  playsOneTwos: { gain: 'Gives and goes, wants it straight back.', cost: 'Dribbles less.' },
  killerBalls: {
    gain: 'Looks for the pass behind the defence.',
    cost: 'Gets more of his passes cut out.',
  },
  runsWithBall: { gain: 'Carries the ball through midfield.', cost: 'Loses it there more often.' },
  arrivesLate: {
    gain: 'Arrives late in the box for cut-backs.',
    cost: 'Less cover when we lose it.',
  },
  holdsUp: { gain: 'Holds the ball up and brings others in.', cost: 'Fewer runs in behind.' },
  comesDeep: { gain: 'Drops into midfield to get the ball.', cost: 'Fewer touches in the box.' },
  attacksAir: { gain: 'Attacks crosses and corners.', cost: 'Gives away more fouls in the air.' },
  divesIn: { gain: 'Wins it back with committed tackles.', cost: 'Gives away more fouls.' },
};

const INSTRUCTION_WORDS: Record<string, string> = {
  shootLess: '"Shoot less"',
  holdPosition: '"Hold position"',
  stayOnFeet: '"Stay on feet"',
};

interface Props {
  traits: TraitId[] | undefined;
  /** His current instructions, to show clashes (§13.23: the instruction wins). */
  instructions?: readonly string[];
  /** Chips only (tables) or the full list with gain and cost (player file). */
  variant?: 'chips' | 'list';
  tone?: 'paper' | 'dark';
}

export const TraitChips: React.FC<Props> = ({
  traits,
  instructions,
  variant = 'chips',
  tone = 'paper',
}) => {
  if (!traits || traits.length === 0) {
    return variant === 'list' ? (
      <div style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>No particular habits.</div>
    ) : null;
  }
  const ink = tone === 'paper' ? '#1F4FBF' : '#9EC1FF';
  if (variant === 'chips') {
    return (
      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
        {traits.map((t) => {
          const clash = isTraitClashing(t, instructions).clashes;
          return (
            <span
              key={t}
              title={`${TRAIT_DEFINITIONS[t].wording}. ${TRAIT_PLAIN[t].gain} ${TRAIT_PLAIN[t].cost}`}
              style={{
                fontFamily: 'var(--font-head)',
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '1px 5px',
                border: `1px solid ${ink}`,
                color: ink,
                opacity: clash ? 0.45 : 1,
                textDecoration: clash ? 'line-through' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {TRAIT_DEFINITIONS[t].name}
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {traits.map((t) => {
        const c = isTraitClashing(t, instructions);
        return (
          <div key={t} style={{ fontSize: 12, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700 }}>{TRAIT_DEFINITIONS[t].wording}</div>
            <div>
              <span style={{ color: '#2E7D32' }}>+ </span>
              {TRAIT_PLAIN[t].gain} <span style={{ color: '#B23A2E' }}>− </span>
              {TRAIT_PLAIN[t].cost}
            </div>
            {c.clashes && (
              <div style={{ color: '#B23A2E' }}>
                Off while he's told {INSTRUCTION_WORDS[c.opposingInstruction ?? ''] ?? 'otherwise'}.
                He doesn't like it.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
