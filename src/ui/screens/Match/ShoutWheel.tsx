// SPEC §13.21 Touchline shouts in the match HUD: a Shout button (key Y) opens a wheel of the 7
// shouts with their gain and cost; the active shout shows as a chip with a 10-minute ring.
// Also the §13.22 "Ask me first" card when a match-plan rule fires.
import React, { useEffect } from 'react';
import type { ShoutId } from '../../../core/types';

export const SHOUTS: { id: ShoutId; words: string; gain: string; cost: string }[] = [
  {
    id: 'pushForward',
    words: 'Push forward!',
    gain: 'Everyone a step further up.',
    cost: 'Tires them faster; open to the counter.',
  },
  {
    id: 'keepTight',
    words: 'Keep it tight!',
    gain: 'A step deeper; fewer good chances against.',
    cost: 'We create less.',
  },
  {
    id: 'getStuckIn',
    words: 'Get stuck in!',
    gain: 'Harder in the tackle.',
    cost: 'More fouls; hotheads see cards.',
  },
  {
    id: 'calmDown',
    words: 'Calm down!',
    gain: 'Fewer fouls and cards.',
    cost: 'Softer in the tackle.',
  },
  {
    id: 'concentrate',
    words: 'Concentrate!',
    gain: 'Sharper passing, tighter at the back.',
    cost: "Only after 75' or just after conceding; once a half.",
  },
  {
    id: 'encourage',
    words: 'Well done, keep going!',
    gain: 'A lift for ten minutes; good performers get happier.',
    cost: 'Two goals up, they switch off a little.',
  },
  {
    id: 'demandMore',
    words: "That's not good enough!",
    gain: 'A real lift when level or behind, most of all leaders.',
    cost: 'Relaxed lads shrug; hotheads may sulk; if winning, it stings.',
  },
];

export interface ActiveShout {
  id: ShoutId;
  /** Presentation time it takes effect (issued + 10 s) and when it ends (+600 s). */
  startPt: number;
  endPt: number;
}

interface WheelProps {
  open: boolean;
  pt: number;
  active: ActiveShout | null;
  lastEnd: Partial<Record<ShoutId, number>>;
  concentrateAllowed: boolean;
  onPick: (id: ShoutId) => void;
  onClose: () => void;
}

export const ShoutWheel: React.FC<WheelProps> = ({
  open,
  pt,
  active,
  lastEnd,
  concentrateAllowed,
  onPick,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // While the wheel is open, number keys pick a shout (not playback modes).
      if (e.key === 'Escape' || e.key === 'y' || e.key === 'Y') {
        e.stopPropagation();
        onClose();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= SHOUTS.length) {
        e.stopPropagation();
        e.preventDefault();
        const s = SHOUTS[n - 1]!;
        if (s.id !== 'concentrate' || concentrateAllowed) onPick(s.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose, onPick, concentrateAllowed]);

  if (!open) return null;
  const R = 190;
  return (
    <div
      role="dialog"
      aria-label="Touchline shouts"
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,12,0.55)', zIndex: 40 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}
      >
        <div
          style={{
            position: 'absolute',
            left: -70,
            top: -26,
            width: 140,
            textAlign: 'center',
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#fff',
            fontSize: 13,
          }}
        >
          Shout
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              letterSpacing: 0,
              textTransform: 'none',
              fontSize: 11,
              opacity: 0.7,
              marginTop: 4,
            }}
          >
            1–7 or click · Esc closes
          </div>
        </div>
        {SHOUTS.map((s, i) => {
          const a = -Math.PI / 2 + (i / SHOUTS.length) * Math.PI * 2;
          const x = Math.cos(a) * R;
          const y = Math.sin(a) * R * 0.78;
          const disabled = s.id === 'concentrate' && !concentrateAllowed;
          const heard = lastEnd[s.id] !== undefined && pt - (lastEnd[s.id] ?? 0) < 900;
          const isActive = active?.id === s.id && pt < active.endPt;
          return (
            <button
              key={s.id}
              disabled={disabled}
              onClick={() => onPick(s.id)}
              style={{
                position: 'absolute',
                left: x - 120,
                top: y - 44,
                width: 240,
                minHeight: 88,
                textAlign: 'left',
                padding: '10px 12px',
                background: isActive ? '#F2B705' : 'rgba(16,20,28,0.96)',
                color: isActive ? '#111' : '#fff',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 4,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, opacity: 0.6 }}>
                  {i + 1}
                </span>
                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16 }}>
                  {s.words}
                </span>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>
                <span style={{ color: isActive ? '#1d4d1d' : '#7ED38E' }}>+ </span>
                {s.gain}
              </div>
              <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.35, opacity: 0.85 }}>
                <span style={{ color: isActive ? '#6b1d1d' : '#F28B82' }}>− </span>
                {heard ? 'Heard it already: half the effect. ' : ''}
                {s.cost}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** The active shout as a chip with a ring that empties over its 10 minutes. */
export const ShoutChip: React.FC<{ active: ActiveShout | null; pt: number }> = ({ active, pt }) => {
  if (!active || pt >= active.endPt) return null;
  const s = SHOUTS.find((x) => x.id === active.id)!;
  const pending = pt < active.startPt;
  const left = pending ? 1 : Math.max(0, (active.endPt - pt) / (active.endPt - active.startPt));
  const C = 2 * Math.PI * 9;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px 5px 6px',
        background: 'rgba(12,16,22,0.9)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        color: '#fff',
        fontSize: 12,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="none"
          stroke="#F2B705"
          strokeWidth="3"
          strokeDasharray={`${C * left} ${C}`}
          transform="rotate(-90 11 11)"
        />
      </svg>
      <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700 }}>{s.words}</span>
      {pending && <span style={{ opacity: 0.6 }}>shouting…</span>}
    </div>
  );
};

/** §13.22 "Ask me first": "Losing after 70'. Switch to Plan B?" with Apply / Skip and a 6 s countdown. */
export const PlanAskCard: React.FC<{
  text: string;
  secondsLeft: number;
  onApply: () => void;
  onSkip: () => void;
}> = ({ text, secondsLeft, onApply, onSkip }) => (
  <div
    role="alertdialog"
    aria-label="Match plan"
    style={{
      position: 'absolute',
      left: '50%',
      top: 96,
      transform: 'translateX(-50%) rotate(-0.4deg)',
      width: 420,
      background: '#EFEBE3',
      color: '#1B1A17',
      padding: '14px 16px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
      zIndex: 45,
    }}
  >
    <div
      style={{
        fontFamily: 'var(--font-head)',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        opacity: 0.6,
      }}
    >
      Match plan
    </div>
    <div
      style={{
        fontFamily: 'var(--font-head)',
        fontWeight: 700,
        fontSize: 20,
        margin: '4px 0 12px',
      }}
    >
      {text}
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        onClick={onApply}
        style={{
          fontFamily: 'var(--font-head)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '8px 14px',
          border: 'none',
          background: '#1B1A17',
          color: '#EFEBE3',
          cursor: 'pointer',
        }}
      >
        Apply
      </button>
      <button
        onClick={onSkip}
        style={{
          fontFamily: 'var(--font-head)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '8px 14px',
          border: '1.5px solid #1B1A17',
          background: 'transparent',
          color: '#1B1A17',
          cursor: 'pointer',
        }}
      >
        Skip
      </button>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 12, opacity: 0.7 }}>
        Applies in {Math.max(0, Math.ceil(secondsLeft))}s
      </span>
    </div>
  </div>
);
