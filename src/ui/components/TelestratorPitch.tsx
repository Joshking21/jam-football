// Implements Telestrator Pitch Diagram (SPEC §11.5, §11.15, ART-DIRECTION §6.2, REVIEW-M4 M2)
// Visualises opponent attacking shape as red-marker Os with numbers and surnames,
// passing/width arrows, defender X, and cleanly backed key battle markers.
import React from 'react';
import { Club, Player } from '../../core/types';

interface TelestratorPitchProps {
  oppClub: Club;
  oppPlayers?: Player[];
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
  oppPlayers = [],
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

  const gkPlayer = oppPlayers[0];
  const outfieldPlayers = oppPlayers.slice(1);

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {showTitle && (
        <div
          className="broadcast-label"
          style={{
            fontSize: '11px',
            letterSpacing: '0.1em',
            color: 'var(--text-faint)',
          }}
        >
          TELESTRATOR · HOW {oppClub.name.toUpperCase()} ATTACK ({formation} ·{' '}
          {passing.toUpperCase()})
        </div>
      )}
      <svg
        viewBox="0 0 400 195"
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
          <rect x="10" y="10" width="380" height="175" />
          {/* Halfway line */}
          <line x1="200" y1="10" x2="200" y2="185" />
          {/* Centre circle */}
          <circle cx="200" cy="97" r="26" />
          <circle cx="200" cy="97" r="1.5" fill="var(--border)" />
          {/* Left Penalty Box (Our Box) */}
          <rect x="10" y="48" width="56" height="98" />
          <rect x="10" y="74" width="20" height="46" />
          {/* Right Penalty Box (Their Box) */}
          <rect x="334" y="48" width="56" height="98" />
          <rect x="370" y="74" width="20" height="46" />
        </g>

        {/* Tactical Style Movement Arrows */}
        {passing === 'Direct' ? (
          <>
            <path
              d={mArrow(362, 82, fwd[0] - 34, fwd[1] - 6, 0.16)}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Opaque Paper-Backed Label */}
            <g transform={`translate(245, ${fwd[1] - 44})`}>
              <rect
                x="0"
                y="0"
                width="76"
                height="18"
                rx="3"
                fill="#EFEBE3"
                stroke="#C42B2B"
                strokeWidth="1"
              />
              <text
                x="38"
                y="12"
                fill="#C42B2B"
                fontFamily="var(--font-head)"
                fontWeight="700"
                fontSize="10"
                letterSpacing="0.08em"
                textAnchor="middle"
              >
                LONG BALL
              </text>
            </g>
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
              stroke="var(--text-dim)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={mArrow(mids[0]![0] - 8, mids[0]![1] + 4, fwd[0] + 10, fwd[1] - 4, -0.1, 6)}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Opaque Paper-Backed Label placed clearly between lines */}
            <g transform="translate(198, 150)">
              <rect
                x="0"
                y="0"
                width="124"
                height="18"
                rx="3"
                fill="#EFEBE3"
                stroke="#C42B2B"
                strokeWidth="1"
              />
              <text
                x="62"
                y="12"
                fill="#C42B2B"
                fontFamily="var(--font-head)"
                fontWeight="700"
                fontSize="10"
                letterSpacing="0.08em"
                textAnchor="middle"
              >
                THROUGH THE MIDDLE
              </text>
            </g>
          </>
        ) : (
          <path
            d={mArrow(mids[0]![0] - 8, mids[0]![1], fwd[0] + 10, fwd[1] - 8, 0.2)}
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}

        {oppWidth === 'Wide' && (
          <>
            <path
              d={mArrow(mids[0]![0] - 10, mids[0]![1] - 4, 74, 40, -0.08)}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={mArrow(
                mids[mids.length - 1]![0] - 10,
                mids[mids.length - 1]![1] + 4,
                74,
                146,
                0.08,
              )}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={mArrow(70, 46, 44, 82, 0.2, 6)}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Opaque Paper-Backed Label */}
            <g transform="translate(74, 18)">
              <rect
                x="0"
                y="0"
                width="62"
                height="18"
                rx="3"
                fill="#EFEBE3"
                stroke="#C42B2B"
                strokeWidth="1"
              />
              <text
                x="31"
                y="12"
                fill="#C42B2B"
                fontFamily="var(--font-head)"
                fontWeight="700"
                fontSize="10"
                letterSpacing="0.08em"
                textAnchor="middle"
              >
                CROSSES
              </text>
            </g>
          </>
        )}

        {/* Opponent GK (Red Marker O + Number + Surname) */}
        <g transform="translate(372, 97)">
          <path
            d={mCircle(0, 0, 8.5, 59)}
            fill="#FFFFFF"
            stroke="#C42B2B"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <text
            x="0"
            y="3"
            fill="#C42B2B"
            fontFamily="var(--font-head)"
            fontWeight="700"
            fontSize="9"
            textAnchor="middle"
          >
            1
          </text>
          <text
            x="0"
            y="18"
            fill="var(--text)"
            fontFamily="var(--font-head)"
            fontWeight="600"
            fontSize="8"
            letterSpacing="0.02em"
            textAnchor="middle"
          >
            {(gkPlayer?.lastName ?? 'GK').toUpperCase()}
          </text>
        </g>

        {/* Opponent Outfield Players (Red Marker Os with number inside and surname underneath per M2) */}
        {pos.flat().map(([x, y], idx) => {
          const player = outfieldPlayers[idx];
          const shirtNum = idx + 2;
          const surname = player ? player.lastName.toUpperCase() : `P${shirtNum}`;

          return (
            <g key={`opp-p-${idx}`} transform={`translate(${x}, ${y})`}>
              <path
                d={mCircle(0, 0, 8.5, 60 + idx)}
                fill="#FFFFFF"
                stroke="#C42B2B"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <text
                x="0"
                y="3"
                fill="#C42B2B"
                fontFamily="var(--font-head)"
                fontWeight="700"
                fontSize="9"
                textAnchor="middle"
              >
                {shirtNum}
              </text>
              <text
                x="0"
                y="17"
                fill="var(--text)"
                fontFamily="var(--font-head)"
                fontWeight="600"
                fontSize="7.5"
                letterSpacing="0.02em"
                textAnchor="middle"
              >
                {surname}
              </text>
            </g>
          );
        })}

        {/* Our defender as 'X' and Key Battle circled in accent */}
        <g transform={`translate(${fwd[0] - 22}, ${fwd[1] + 8})`}>
          <path
            d={mX(0, 0, 6, 77)}
            fill="none"
            stroke="#F4B41A"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
        <path
          d={mCircle(fwd[0] - 11, fwd[1] + 4, 24, 78)}
          fill="none"
          stroke="#F4B41A"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="4 2"
        />

        {/* KEY BATTLE label with paper backing cleanly offset */}
        <g transform={`translate(${fwd[0] - 46}, ${fwd[1] + 32})`}>
          <rect
            x="0"
            y="0"
            width="78"
            height="18"
            rx="3"
            fill="#EFEBE3"
            stroke="#F4B41A"
            strokeWidth="1.2"
          />
          <text
            x="39"
            y="12"
            fill="#1E2A38"
            fontFamily="var(--font-head)"
            fontWeight="700"
            fontSize="10"
            letterSpacing="0.08em"
            textAnchor="middle"
          >
            KEY BATTLE
          </text>
        </g>
      </svg>
    </div>
  );
};
