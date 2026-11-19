// Implements SPEC §19.3 & §19.5 Stamp:
// Rubber stamp in 2px bordered box, rotated -2°, --marker-red or --paper-ink.
// Animated landing: scale 1.4 -> 1 in 160ms.
import React from 'react';
import { useSettings } from '../../state/store';

export type StampType =
  | 'INJURED'
  | 'SUSPENDED'
  | 'TRANSFER LISTED'
  | 'NOT FOR SALE'
  | 'SCOUTED'
  | 'SIGNED'
  | 'OFFER ACCEPTED'
  | 'REJECTED';

interface StampProps {
  label: StampType | string;
  variant?: 'red' | 'ink';
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Stamp: React.FC<StampProps> = ({
  label,
  variant = 'red',
  animated = false,
  className = '',
  style,
}) => {
  const { reduceMotion } = useSettings();
  const color = variant === 'red' ? 'var(--marker-red)' : 'var(--paper-ink)';

  return (
    <div
      className={`stamp-label ${animated && !reduceMotion ? 'stamp-landing' : ''} ${className}`}
      style={{
        display: 'inline-block',
        border: `2px solid ${color}`,
        color: color,
        padding: '2px 8px',
        fontFamily: 'var(--font-head)',
        fontWeight: 700,
        fontSize: '13px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        transform: 'rotate(-2deg)',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {label}

      <style>{`
        @keyframes stamp-land {
          0% {
            transform: scale(1.4) rotate(-4deg);
            opacity: 0.5;
          }
          100% {
            transform: scale(1) rotate(-2deg);
            opacity: 1;
          }
        }
        .stamp-landing {
          animation: stamp-land 160ms cubic-bezier(0.2, 0.9, 0.1, 1) forwards;
        }
      `}</style>
    </div>
  );
};
