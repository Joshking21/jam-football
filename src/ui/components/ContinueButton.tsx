// Implements SPEC §11.0, §19.5 ContinueButton component
import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { KeyHint } from './KeyHint';

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

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;

    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setIsIdle(true);
      }, 10000); // 10s idle
    };

    resetIdle();
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, []);

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
        animation: isIdle && !disabled ? 'continue-pulse 6s infinite ease-in-out' : 'none',
      }}
    >
      <span style={{ marginRight: '8px' }}>{label}</span>
      <KeyHint
        hint="Space"
        style={{
          background: 'rgba(3, 43, 28, 0.2)',
          borderColor: 'rgba(3, 43, 28, 0.4)',
          color: 'var(--accent-ink)',
        }}
      />
    </Button>
  );
};
