// Implements SPEC §19.5 Ticker:
// 36px bar along bottom of on-air screens. Accent label block, scrolling items at 60px/s.
// Pauses on hover and focus. Separated by two-colour band mark.
import React from 'react';
import { useSettings } from '../../state/store';

interface TickerProps {
  label?: string;
  items: string[];
}

export const Ticker: React.FC<TickerProps> = ({ label = 'AROUND THE LEAGUE', items }) => {
  const { reduceMotion } = useSettings();

  if (!items || items.length === 0) return null;

  return (
    <div
      className="ticker-container"
      role="region"
      aria-label="League ticker"
      style={{
        height: '36px',
        backgroundColor: 'var(--surface-2)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 25,
      }}
    >
      {/* Label block */}
      <div
        className="broadcast-label"
        style={{
          height: '100%',
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-ink)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.08em',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        {label}
      </div>

      {/* Marquee track */}
      <div
        className="ticker-track"
        tabIndex={0}
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          className={`ticker-content ${reduceMotion ? 'ticker-static' : 'ticker-anim'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            paddingLeft: '24px',
          }}
        >
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <span
                style={{
                  fontSize: '13px',
                  color: 'var(--text)',
                  fontWeight: 500,
                }}
              >
                {item}
              </span>
              <span
                className="ticker-band-mark"
                style={{
                  display: 'inline-flex',
                  width: '8px',
                  height: '12px',
                  transform: 'skewX(-12deg)',
                  overflow: 'hidden',
                  margin: '0 8px',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: '4px',
                    height: '100%',
                    backgroundColor: 'var(--band-1)',
                  }}
                />
                <span
                  style={{
                    width: '4px',
                    height: '100%',
                    backgroundColor: 'var(--band-2)',
                  }}
                />
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .ticker-anim {
          animation: ticker-scroll 35s linear infinite;
        }
        .ticker-container:hover .ticker-anim,
        .ticker-track:focus-visible .ticker-anim {
          animation-play-state: paused;
        }
        .ticker-static {
          animation: none;
        }
      `}</style>
    </div>
  );
};
