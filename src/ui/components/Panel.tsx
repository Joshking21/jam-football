// Implements SPEC §19.5 Panel (on air):
// --surface, --radius-s, a 3px top stripe in --band-1 (with a 1/3-width segment of --band-2 at its right end),
// header row in broadcast labels.
import React from 'react';

interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  dominant?: boolean; // dominant graphic vs supporting panel
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
  style,
  dominant = false,
}) => {
  return (
    <div
      className={`panel-container ${dominant ? 'panel-dominant' : ''} ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius-s)',
        border: '1px solid var(--border)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: dominant ? '0 8px 32px rgba(0, 0, 0, 0.4)' : 'var(--shadow-1)',
        ...style,
      }}
    >
      {/* 3px Top Stripe: --band-1 with 1/3 --band-2 at right */}
      <div
        className="panel-stripe"
        style={{
          height: '3px',
          width: '100%',
          display: 'flex',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 2, backgroundColor: 'var(--band-1)' }} />
        <div style={{ flex: 1, backgroundColor: 'var(--band-2)' }} />
      </div>

      {/* Header row */}
      {(title || headerAction) && (
        <div
          className="panel-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            {typeof title === 'string' ? (
              <h3
                className="broadcast-label"
                style={{
                  color: 'var(--text)',
                  fontSize: dominant ? '16px' : '13px',
                  margin: 0,
                }}
              >
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-dim)',
                  marginTop: '2px',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}

      {/* Content */}
      <div
        className="panel-body"
        style={{
          padding: '16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
};
