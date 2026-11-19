// Implements SPEC §19.5 Button component
// Variants: primary, secondary, ghost, danger. Sizes: s, m, l.
// Primary L has angled corner (--cut, bottom-right). Pressed state moves down 2px.
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

  const isAngled = variant === 'primary' && size === 'l';

  const sizeStyles: Record<string, React.CSSProperties> = {
    s: {
      padding: '6px 12px',
      fontSize: '13px',
      borderRadius: 'var(--radius-s)',
      gap: '6px',
    },
    m: {
      padding: '10px 18px',
      fontSize: '15px',
      borderRadius: 'var(--radius-m)',
      gap: '8px',
    },
    l: {
      padding: '14px 26px',
      fontSize: '18px',
      borderRadius: isAngled ? 0 : 'var(--radius-m)',
      gap: '10px',
      fontWeight: 700,
    },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent)',
      color: 'var(--accent-ink)',
      fontWeight: 700,
      fontFamily: 'var(--font-head)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      boxShadow: 'var(--shadow-1)',
      clipPath: isAngled
        ? 'polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%)'
        : undefined,
    },
    secondary: {
      backgroundColor: 'var(--surface-3)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-dim)',
    },
    danger: {
      backgroundColor: 'var(--danger)',
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
        transition:
          'transform var(--dur-micro), opacity var(--dur-fast), background-color var(--dur-fast)',
        opacity: isDisabled ? 0.45 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      onMouseDown={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'translateY(2px)';
        }
      }}
      onMouseUp={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'translateY(0)';
        }
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
