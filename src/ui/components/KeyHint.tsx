// Implements SPEC §11.0, §19.5 KeyHint component
import React from 'react';

export interface KeyHintProps {
  hint: string;
  style?: React.CSSProperties;
}

export const KeyHint: React.FC<KeyHintProps> = ({ hint, style }) => {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        color: 'var(--text-dim)',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        textTransform: 'none',
        lineHeight: 1,
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {hint}
    </kbd>
  );
};
