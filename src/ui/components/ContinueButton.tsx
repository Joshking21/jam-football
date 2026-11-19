// Implements SPEC §11.0, §19.5 ContinueButton component
// Primary L with KeyHint "Space", subtle pulse every 6s when idle > 10s (off with reduce motion).
// When label changes, new label slides up into place (--dur-fast).
import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { KeyHint } from './KeyHint';
import { useSettings } from '../../state/store';

export interface ContinueButtonProps {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
}

export const ContinueButton: React.FC<ContinueButtonProps> = ({
  label = 'Continue',
  onClick,
  disabled = false,
  disabledReason,
  loading = false,
}) => {
  const [isIdle, setIsIdle] = useState(false);
  const { reduceMotion } = useSettings();

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;

    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      if (!reduceMotion) {
        idleTimer = setTimeout(() => {
          setIsIdle(true);
        }, 10000); // 10s idle
      }
    };

    resetIdle();
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [reduceMotion]);

  // Global Space key trigger (SPEC §11.0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          return;
        }
        if (target.isContentEditable) {
          return;
        }
        e.preventDefault();
        if (!disabled && !loading) {
          onClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClick, disabled, loading]);

  return (
    <Button
      variant="primary"
      size="l"
      onClick={onClick}
      disabled={disabled}
      disabledReason={disabledReason}
      loading={loading}
      style={{
        minWidth: '160px',
        animation:
          isIdle && !disabled && !reduceMotion ? 'continue-pulse 6s infinite ease-in-out' : 'none',
        overflow: 'hidden',
      }}
    >
      <span
        key={label}
        style={{
          marginRight: '8px',
          display: 'inline-block',
          animation: !reduceMotion ? 'label-slide-up var(--dur-fast) var(--ease-snap)' : 'none',
        }}
      >
        {label}
      </span>
      <KeyHint
        hint="Space"
        style={{
          background: 'rgba(0, 0, 0, 0.15)',
          borderColor: 'rgba(0, 0, 0, 0.3)',
          color: 'var(--accent-ink)',
        }}
      />

      <style>{`
        @keyframes label-slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </Button>
  );
};
