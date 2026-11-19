// Implements SPEC §19.5 Sheet (office):
// --paper, radius 3px, --shadow-paper, resting rotation between -0.6° and +0.6° (deterministic from id),
// paper text with ruled rows. Variants: memo, file, clipboard, ledger.
import React, { useMemo } from 'react';

export type SheetVariant = 'default' | 'memo' | 'file' | 'clipboard' | 'ledger';

interface SheetProps {
  id: string; // for deterministic resting rotation
  variant?: SheetVariant;
  tabLabel?: string; // for file variant manila tab
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Simple hash to deterministic angle between -0.6 and +0.6 deg
function getDeterministicRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 1200) / 1000 - 0.6; // -0.6 to +0.6
  return Math.round(normalized * 100) / 100;
}

export const Sheet: React.FC<SheetProps> = ({
  id,
  variant = 'default',
  tabLabel,
  children,
  className = '',
  style,
}) => {
  const rotation = useMemo(() => getDeterministicRotation(id), [id]);

  return (
    <div
      className={`sheet-wrapper sheet-variant-${variant} ${className}`}
      style={{
        position: 'relative',
        transform: `rotate(${rotation}deg)`,
        transition: 'transform var(--dur-med) var(--ease-snap)',
        ...style,
      }}
    >
      {/* File variant manila tab */}
      {variant === 'file' && (
        <div
          className="sheet-manila-tab broadcast-label"
          style={{
            position: 'absolute',
            top: '-26px',
            left: '24px',
            backgroundColor: '#D9C9A3',
            color: 'var(--paper-ink)',
            padding: '4px 16px',
            borderRadius: '4px 4px 0 0',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            boxShadow: '0 -1px 3px rgba(0,0,0,0.15)',
            zIndex: 1,
          }}
        >
          {tabLabel || 'FILE'}
        </div>
      )}

      {/* Clipboard variant dark clip at top */}
      {variant === 'clipboard' && (
        <div
          className="sheet-clip"
          style={{
            position: 'absolute',
            top: '-14px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '24px',
            backgroundColor: '#2A2927',
            border: '2px solid #4A4742',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            zIndex: 2,
          }}
        />
      )}

      {/* Main Paper Body */}
      <div
        className="sheet-paper paper-surface"
        style={{
          backgroundColor: 'var(--paper)',
          color: 'var(--paper-ink)',
          borderRadius: '3px',
          boxShadow: 'var(--shadow-paper)',
          padding: '24px',
          position: 'relative',
          border: '1px solid #D5CEBE',
        }}
      >
        {children}
      </div>
    </div>
  );
};
