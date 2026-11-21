// Implements Telestrator Pitch Diagram (SPEC §11.5, §11.15, ART-DIRECTION §6.2)
// Visualises opponent attacking shape as Os, passing/width arrows, defender X, and key battle marker.
import React from 'react';
import { Club } from '../../core/types';

interface TelestratorPitchProps {
  oppClub: Club;
  width?: number | string;
  height?: number | string;
  showTitle?: boolean;
}

// Pseudo-random wobble helper for hand-drawn marker feel
function wob(pts: [number, number][], seed: number, amp = 1.2): string {
  let s = seed | 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const p = pts.map(([x, y]) => [x + (rng() - 0.5) * amp, y + (rng() - 0.5) * amp]);
  let d = `M${p[0]![0]!.toFixed(1)} ${p[0]![1]!.toFixed(1)}`;
  for (let i = 1; i < p.length; i++) {
    const [x0 = 0, y0 = 0] = p[i - 1] ?? [];
    const [x1 = 0, y1 = 0] = p[i] ?? [];
    const mx = (x0 + x1) / 2 + (rng() - 0.5) * amp;
    const my = (y0 + y1) / 2 + (rng() - 0.5) * amp;
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

function mCircle(cx: number, cy: number, rad: number, seed: number): string {
  let s = seed | 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const start = rng() * 6.28;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 15; i++) {
    const a = start + (i / 14) * 6.28 * 1.05;
    const rr = rad * (1 + (rng() - 0.5) * 0.1);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return wob(pts, seed + 1, 0.5);
}

function mX(cx: number, cy: number, size: number, seed: number): string {
  const line1: [number, number][] = [
    [cx - size, cy - size],
    [cx + size, cy + size],
  ];
  const line2: [number, number][] = [
    [cx + size, cy - size],
    [cx - size, cy + size],
  ];
  return wob(line1, seed, 0.6) + ' ' + wob(line2, seed + 2, 0.6);
}

function mArrow(x0: number, y0: number, x1: number, y1: number, bend = 0, head = 7): string {
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend;
  const my = (y0 + y1) / 2 + (x1 - x0) * bend;
  const a = Math.atan2(y1 - my, x1 - mx);
  const h = (s: number) =>
    `${(x1 - head * Math.cos(a + s)).toFixed(1)} ${(y1 - head * Math.sin(a + s)).toFixed(1)}`;
  return `M${x0} ${y0} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1} ${y1} M${h(-0.5)} L${x1} ${y1} L${h(0.5)}`;
}

export const TelestratorPitch: React.FC<TelestratorPitchProps> = ({
  oppClub,
  width = '100%',
  height = 'auto',
  showTitle = true,
}) => {
  const formation = oppClub.style?.formation || '4-3-3';
  const passing = oppClub.style?.passing || 'Mixed';
  const oppWidth = oppClub.style?.width || 'Normal';

  const lines = formation.split('-').map(Number);
  const n = lines.length;

  // Calculate coordinates for opponent team on right half attacking left
  const pos = lines.map((k, i) => {
    const x = 326 - i * (146 / Math.max(1, n - 1));
    const sp = k > 1 ? Math.min(34, 112 / (k - 1)) : 0;
    return Array.from(
      { length: k },
      (_, j) => [x, 90 + (j - (k - 1) / 2) * sp] as [number, number],
    );
  });

  const fwd = pos[n - 1]!.reduce((a, b) => (Math.abs(b[1] - 90) < Math.abs(a[1] - 90) ? b : a));
  const mids = pos[n - 2] || pos[0]!;

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {showTitle && (
        <div
          className="broadcast-label"
          style={{
            fontSize: '11px',
            letterSpacing: '0.1em',
            color: 'var(--text-faint)',
          }}
        >
          TELESTRATOR · HOW {oppClub.name.toUpperCase()} ATTACK
        </div>
      )}
      <svg
        viewBox="0 0 400 180"
        style={{
          width: '100%',
          height,
          backgroundColor: 'var(--bg)',
          borderRadius: 'var(--radius-s)',
          border: '1px solid var(--border)',
          overflow: 'visible',
        }}
        role="img"
        aria-label={`How ${oppClub.name} attack: ${formation}, ${passing} passing, ${oppWidth} width`}
      >
        {/* Pitch markings */}
        <g stroke="var(--border)" strokeWidth="1" fill="none">
          {/* Pitch outline */}
          <rect x="10" y="10" width="380" height="160" />
          {/* Halfway line */}
          <line x1="200" y1="10" x2="200" y2="170" />
          {/* Centre circle */}
          <circle cx="200" cy="90" r="24" />
          <circle cx="200" cy="90" r="1.5" fill="var(--border)" />
          {/* Left Penalty Box (Our Box) */}
          <rect x="10" y="46" width="54" height="88" />
          <rect x="10" y="70" width="18" height="40" />
          {/* Right Penalty Box (Their Box) */}
          <rect x="336" y="46" width="54" height="88" />
          <rect x="372" y="70" width="18" height="40" />
        </g>

        {/* Opponent GK */}
        <path
          d={mCircle(372, 90, 7, 59)}
          fill="none"
          stroke="var(--text)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Opponent Outfield Players (Os in marker) */}
        {pos.flat().map(([x, y], idx) => (
          <path
            key={`opp-p-${idx}`}
            d={mCircle(x, y, 7, 60 + idx)}
            fill="none"
            stroke="var(--text)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ))}

        {/* Tactical Style Movement Arrows */}
        {passing === 'Direct' ? (
          <>
            <path
              d={mArrow(362, 82, fwd[0] - 34, fwd[1] - 6, 0.16)}
              fill="none"
              stroke="var(--text)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <text
              x="260"
              y={fwd[1] - 32}
              fill="var(--text-dim)"
              fontFamily="var(--font-head)"
              fontWeight="600"
              fontSize="11"
              letterSpacing="0.08em"
            >
              LONG BALL
            </text>
          </>
        ) : passing === 'Short' ? (
          <>
            <path
              d={mArrow(
                pos[0]![0]![0] - 8,
                pos[0]![0]![1],
                mids[0]![0] + 10,
                mids[0]![1] + 4,
                0.1,
                6,
              )}
              fill="none"
              stroke="var(--text)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={mArrow(mids[0]![0] - 8, mids[0]![1] + 4, fwd[0] + 10, fwd[1] - 4, -0.1, 6)}
              fill="none"
              stroke="var(--text)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <text
              x="215"
              y="135"
              fill="var(--text-dim)"
              fontFamily="var(--font-head)"
              fontWeight="600"
              fontSize="11"
              letterSpacing="0.08em"
            >
              THROUGH THE MIDDLE
            </text>
          </>
        ) : (
          <path
            d={mArrow(mids[0]![0] - 8, mids[0]![1], fwd[0] + 10, fwd[1] - 8, 0.2)}
            fill="none"
            stroke="var(--text)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}

        {oppWidth === 'Wide' && (
          <>
            <path
              d={mArrow(mids[0]![0] - 10, mids[0]![1] - 4, 74, 40, -0.08)}
              fill="none"
              stroke="var(--text)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={mArrow(
                mids[mids.length - 1]![0] - 10,
                mids[mids.length - 1]![1] + 4,
                74,
                140,
                0.08,
              )}
              fill="none"
              stroke="var(--text)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={mArrow(70, 46, 44, 82, 0.2, 6)}
              fill="none"
              stroke="var(--text)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <text
              x="96"
              y="26"
              fill="var(--text-dim)"
              fontFamily="var(--font-head)"
              fontWeight="600"
              fontSize="11"
              letterSpacing="0.08em"
            >
              CROSSES
            </text>
          </>
        )}

        {/* Our defender as 'X' and Key Battle circled in accent */}
        <path
          d={mX(fwd[0] - 22, fwd[1] + 8, 5.5, 77)}
          fill="none"
          stroke="var(--accent-text)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d={mCircle(fwd[0] - 11, fwd[1] + 3, 22, 78)}
          fill="none"
          stroke="var(--accent-text)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <text
          x={fwd[0] - 38}
          y={fwd[1] + 44}
          fill="var(--accent-text)"
          fontFamily="var(--font-head)"
          fontWeight="700"
          fontSize="11"
          letterSpacing="0.08em"
        >
          KEY BATTLE
        </text>
      </svg>
    </div>
  );
};
