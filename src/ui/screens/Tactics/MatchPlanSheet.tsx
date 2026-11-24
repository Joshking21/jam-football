// SPEC §13.22 Match plans: the "Match plan" sheet on the Tactics clipboard.
// Up to 4 rules "If [we're losing] after [70'], [switch to Plan B]", the "Ask me first" switch,
// and Theo's suggested set with Apply.
import React from 'react';
import type {
  MatchPlanAfter,
  MatchPlanRule,
  MatchPlanThen,
  MatchPlanWhen,
  Mentality,
  Tactics,
} from '../../../core/types';

const WHEN: { id: MatchPlanWhen; label: string }[] = [
  { id: 'Losing', label: "we're losing" },
  { id: 'Drawing', label: "it's level" },
  { id: 'Winning1', label: "we're winning by one" },
  { id: 'Winning2Plus', label: "we're two or more up" },
  { id: 'DownTo10', label: "we're down to ten" },
  { id: 'OppDownTo10', label: "they're down to ten" },
];
const AFTER: MatchPlanAfter[] = [0, 45, 60, 70, 75, 80, 85];
const SHOUT_LABEL: Record<string, string> = {
  pushForward: 'shout "Push forward!"',
  keepTight: 'shout "Keep it tight!"',
  getStuckIn: 'shout "Get stuck in!"',
  calmDown: 'shout "Calm down!"',
  concentrate: 'shout "Concentrate!"',
  encourage: 'shout "Well done, keep going!"',
  demandMore: 'shout "That\'s not good enough!"',
};
const MENTALITY_RANK: Record<Mentality, number> = {
  VeryDefensive: 0,
  Defensive: 1,
  Balanced: 2,
  Attacking: 3,
  VeryAttacking: 4,
};

let ruleSeq = 0;
const newId = () => `mp-${Date.now().toString(36)}-${(ruleSeq++).toString(36)}`;

/** Theo's default set (§13.22): losing at 70' → the most attacking plan; winning by 1 at 80' → the most defensive. */
export function theosMatchPlan(tactics: Tactics): MatchPlanRule[] {
  const plans = tactics.plans;
  if (!plans) {
    return [
      { id: newId(), when: 'Losing', after: 70, then: 'pushForward' },
      { id: newId(), when: 'Winning1', after: 80, then: 'keepTight' },
    ];
  }
  const ranked = plans
    .map((p, i) => ({ i, m: MENTALITY_RANK[p.instructions.mentality] ?? 2 }))
    .sort((a, b) => a.m - b.m);
  const toThen = (i: number): MatchPlanThen => (['PlanA', 'PlanB', 'PlanC'] as const)[i]!;
  const most = ranked[ranked.length - 1]!;
  const least = ranked[0]!;
  return [
    { id: newId(), when: 'Losing', after: 70, then: most.m > 2 ? toThen(most.i) : 'pushForward' },
    { id: newId(), when: 'Winning1', after: 80, then: least.m < 2 ? toThen(least.i) : 'keepTight' },
  ];
}

interface Props {
  tactics: Tactics;
  onChange: (partial: Partial<Tactics>) => void;
}

const selectStyle: React.CSSProperties = {
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--paper-ink)',
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid var(--paper-ink)',
  padding: '1px 2px',
  cursor: 'pointer',
};

export const MatchPlanSheet: React.FC<Props> = ({ tactics, onChange }) => {
  const rules = tactics.matchPlans ?? [];
  const ask = tactics.askMeFirst ?? true;
  const planNames = (tactics.plans ?? []).map((p, i) => p.name || `Plan ${'ABC'[i]}`);
  const thenOptions: { id: MatchPlanThen; label: string }[] = [
    ...(['PlanA', 'PlanB', 'PlanC'] as const).map((id, i) => ({
      id,
      label: `switch to ${planNames[i] ?? `Plan ${'ABC'[i]}`}`,
    })),
    ...Object.entries(SHOUT_LABEL).map(([id, label]) => ({ id: id as MatchPlanThen, label })),
  ];

  const setRules = (next: MatchPlanRule[]) => onChange({ matchPlans: next.slice(0, 4) });
  const update = (id: string, patch: Partial<MatchPlanRule>) =>
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const theo = theosMatchPlan(tactics);
  const theoText = theo
    .map(
      (r) =>
        `If ${WHEN.find((w) => w.id === r.when)!.label} after ${r.after}', ${thenOptions.find((t) => t.id === r.then)!.label}.`,
    )
    .join(' ');

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, fontSize: 13 }}
    >
      <div style={{ color: 'var(--paper-dim)', fontSize: 12, lineHeight: 1.4 }}>
        Changes made for you during the match, even on Instant result. Each rule fires once, the
        first time it holds after its minute; the higher rule wins a tie.
      </div>

      {rules.length === 0 && (
        <div style={{ color: 'var(--paper-dim)', fontStyle: 'italic' }}>No rules yet.</div>
      )}

      {rules.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 6,
            padding: '6px 0',
            borderBottom: '1px dashed var(--paper-2)',
            color: 'var(--paper-ink)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, width: 16 }}>
            {i + 1}
          </span>
          <span>If</span>
          <select
            aria-label="When"
            value={r.when}
            onChange={(e) => update(r.id, { when: e.target.value as MatchPlanWhen })}
            style={selectStyle}
          >
            {WHEN.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
          <span>after</span>
          <select
            aria-label="After minute"
            value={r.after}
            onChange={(e) => update(r.id, { after: Number(e.target.value) as MatchPlanAfter })}
            style={selectStyle}
          >
            {AFTER.map((a) => (
              <option key={a} value={a}>
                {a}'
              </option>
            ))}
          </select>
          <span>,</span>
          <select
            aria-label="Then"
            value={r.then}
            onChange={(e) => update(r.id, { then: e.target.value as MatchPlanThen })}
            style={selectStyle}
          >
            {thenOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setRules(rules.filter((x) => x.id !== r.id))}
            aria-label={`Remove rule ${i + 1}`}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--paper-dim)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          disabled={rules.length >= 4}
          onClick={() =>
            setRules([...rules, { id: newId(), when: 'Losing', after: 70, then: 'PlanB' }])
          }
          style={{
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            border: '1.5px solid var(--paper-ink)',
            background: 'transparent',
            color: 'var(--paper-ink)',
            cursor: rules.length >= 4 ? 'default' : 'pointer',
            opacity: rules.length >= 4 ? 0.4 : 1,
          }}
        >
          Add a rule
        </button>
        <span style={{ color: 'var(--paper-dim)', fontSize: 12 }}>{rules.length} of 4</span>
        <span style={{ flex: 1 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ask}
            onChange={(e) => onChange({ askMeFirst: e.target.checked })}
          />
          <span>Ask me first</span>
        </label>
      </div>

      <div
        style={{
          background: '#F6E9A8',
          color: '#2B2616',
          padding: '10px 12px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          transform: 'rotate(-0.4deg)',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Theo
          </div>
          <div style={{ lineHeight: 1.4 }}>{theoText}</div>
        </div>
        <button
          onClick={() => setRules(theo)}
          style={{
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            border: 'none',
            background: '#1B1A17',
            color: '#F6E9A8',
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
};
