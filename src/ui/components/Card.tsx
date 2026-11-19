// Implements SPEC §19.5 Card component
import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  clubStripe?: boolean;
  stripeColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  clubStripe = false,
  stripeColor,
  className = '',
  style,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`card ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-l)',
        boxShadow: 'var(--shadow-1)',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {clubStripe && (
        <div
          style={{
            height: '4px',
            width: '100%',
            background: stripeColor || 'var(--club-primary, var(--accent))',
          }}
        />
      )}
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
};
