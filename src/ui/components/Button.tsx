// Implements SPEC §19.5 Button component
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 's' | 'm' | 'l';
  loading?: boolean;
  disabledReason?: string;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'm',
  loading = false,
  disabledReason,
  disabled = false,
  icon,
  style,
  className = '',
  ...rest
}) => {
  const isDisabled = disabled || loading;

  const sizeStyles: Record<string, React.CSSProperties> = {
    s: { padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--radius-s)', gap: '6px' },
    m: { padding: '10px 18px', fontSize: '15px', borderRadius: 'var(--radius-m)', gap: '8px' },
    l: {
      padding: '14px 26px',
      fontSize: '18px',
      borderRadius: 'var(--radius-m)',
      gap: '10px',
      fontWeight: 600,
    },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
      fontWeight: 700,
      fontFamily: 'var(--font-head)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      boxShadow: 'var(--shadow-1)',
    },
    secondary: {
      background: 'var(--surface-3)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-dim)',
    },
    danger: {
      background: 'var(--danger)',
      color: '#FFFFFF',
      fontWeight: 600,
    },
  };

  return (
    <button
      disabled={isDisabled}
      title={disabledReason}
      className={`btn btn-${variant} btn-${size} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--dur-fast) var(--ease)',
        opacity: isDisabled ? 0.45 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            animation: 'spin 1s infinite linear',
            marginRight: '6px',
          }}
        >
          ⟳
        </span>
      ) : icon ? (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
