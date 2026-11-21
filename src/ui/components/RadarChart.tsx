// Implements SPEC §19.5 RadarChart component
// Inline SVG, 6 axes, scale 0–100, faint rings at 25/50/75 in pencil grey.
// Blue marker player shape, red dashed role need shape, pencil grey comparison shape.
import React, { useMemo } from 'react';
import { Player, RoleId, DefRoleId } from '../../core/types';
import {
  getPlayerRadarValues,
  isGoalkeeper,
  RADAR_AXES_OUTFIELD,
  RADAR_AXES_GK,
} from '../../core/player/roleShapes';

export interface RadarChartProps {
  player: Player;
  roleShape?: number[]; // Role need (from roleShapes.ts)
  comparePlayer?: Player | null; // For drag-over comparison
  size?: number; // Default 220
  unscoutedRange?: { min: number[]; max: number[] };
}

const AXIS_COUNT = 6;
const ANGLES = Array.from({ length: AXIS_COUNT }, (_, i) => -Math.PI / 2 + (i * Math.PI) / 3);

function getPoint(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function polygonPoints(cx: number, cy: number, maxRadius: number, values: number[]): string {
  return values
    .map((v, i) => {
      const clamped = Math.max(0, Math.min(100, v));
      const r = (clamped / 100) * maxRadius;
      const [x, y] = getPoint(cx, cy, r, ANGLES[i] ?? 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export const RadarChart: React.FC<RadarChartProps> = ({
  player,
  roleShape,
  comparePlayer,
  size = 220,
  unscoutedRange,
}) => {
  const isGk = isGoalkeeper(player);
  const axesInfo = isGk ? RADAR_AXES_GK : RADAR_AXES_OUTFIELD;

  const playerValues = useMemo(() => getPlayerRadarValues(player), [player]);
  const compareValues = useMemo(
    () => (comparePlayer ? getPlayerRadarValues(comparePlayer) : null),
    [comparePlayer],
  );

  // SVG dimensions
  const padding = 28;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = cx - padding;

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [25, 50, 75, 100];

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        userSelect: 'none',
      }}
      role="img"
      aria-label={`Tactical radar chart for ${player.lastName}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* Background grid rings */}
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={polygonPoints(cx, cy, maxRadius, Array(AXIS_COUNT).fill(ring))}
            fill="none"
            stroke="#D1D5DB"
            strokeWidth={ring === 100 ? 1 : 0.75}
            strokeDasharray={ring === 100 ? undefined : '2 2'}
            opacity={0.7}
          />
        ))}

        {/* Axis spokes from center to 100% ring */}
        {ANGLES.map((angle, i) => {
          const [x, y] = getPoint(cx, cy, maxRadius, angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#D1D5DB"
              strokeWidth={0.75}
              opacity={0.6}
            />
          );
        })}

        {/* Unscouted range band if present */}
        {unscoutedRange && (
          <polygon
            points={polygonPoints(cx, cy, maxRadius, unscoutedRange.max)}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* 1. Comparison player shape (pencil grey) */}
        {compareValues && (
          <polygon
            points={polygonPoints(cx, cy, maxRadius, compareValues)}
            fill="rgba(107, 114, 128, 0.15)"
            stroke="#6B7280"
            strokeWidth={1.5}
          />
        )}

        {/* 2. What the role needs: Red dashed stroke */}
        {roleShape && roleShape.length === 6 && (
          <polygon
            points={polygonPoints(cx, cy, maxRadius, roleShape)}
            fill="none"
            stroke="#DC2626"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            style={{
              transition: 'opacity 180ms ease',
            }}
          />
        )}

        {/* 3. His shape: Blue marker 2px with 15% fill */}
        <polygon
          points={polygonPoints(cx, cy, maxRadius, playerValues)}
          fill="rgba(29, 78, 216, 0.15)"
          stroke="#1D4ED8"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{
            transition: 'all 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />

        {/* Data points on vertices */}
        {playerValues.map((val, i) => {
          const clamped = Math.max(0, Math.min(100, val));
          const r = (clamped / 100) * maxRadius;
          const [px, py] = getPoint(cx, cy, r, ANGLES[i] ?? 0);
          return <circle key={i} cx={px} cy={py} r={2.5} fill="#1D4ED8" />;
        })}

        {/* Axis Labels & Values */}
        {axesInfo.map((axis, i) => {
          const angle = ANGLES[i] ?? 0;
          const labelDist = maxRadius + 14;
          const [lx, ly] = getPoint(cx, cy, labelDist, angle);

          const playerVal = playerValues[i] ?? 0;
          const roleVal = roleShape ? (roleShape[i] ?? 0) : null;
          // SPEC §19.5: "Where his value is more than 5 under the dashed one, that axis label turns --warn."
          const isWarning = roleVal !== null && playerVal < roleVal - 5;

          // Alignment adjustments based on angle
          let textAnchor: 'middle' | 'start' | 'end' = 'middle';
          if (Math.cos(angle) > 0.3) textAnchor = 'start';
          else if (Math.cos(angle) < -0.3) textAnchor = 'end';

          let dy = 4;
          if (Math.sin(angle) < -0.8)
            dy = -4; // top
          else if (Math.sin(angle) > 0.8) dy = 12; // bottom

          return (
            <g
              key={axis.name}
              tabIndex={0}
              style={{ cursor: 'help', outline: 'none' }}
              aria-label={`${axis.name}: ${playerVal}. Components: ${axis.description}`}
            >
              <title>{`${axis.name}: ${axis.description}`}</title>
              <text
                x={lx}
                y={ly + dy}
                textAnchor={textAnchor}
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: '11px',
                  fontWeight: 600,
                  fill: isWarning ? 'var(--warn, #EA580C)' : 'var(--paper-dim, #4B5563)',
                  letterSpacing: '0.02em',
                }}
              >
                {axis.name}{' '}
                <tspan
                  style={{
                    fontWeight: 700,
                    fill: isWarning ? 'var(--warn, #EA580C)' : 'var(--paper-ink, #111827)',
                  }}
                >
                  {playerVal}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
