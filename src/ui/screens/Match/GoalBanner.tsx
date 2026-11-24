// Implements SPEC §14.5 & §14.7 Goal Banner & Replay Letterbox Overlay
import React, { useEffect, useState } from 'react';
import { Club } from '../../../core/types';

interface GoalBannerProps {
  scorerName: string;
  minuteLabel: string;
  scoringClub: Club;
  onDismiss?: () => void;
  persistent?: boolean;
}

export const GoalBanner: React.FC<GoalBannerProps> = ({
  scorerName,
  minuteLabel,
  scoringClub,
  onDismiss,
  persistent = false,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (persistent) return;
    // 2.5s slide-in banner per SPEC §14.5
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 2500);

    return () => clearTimeout(timer);
  }, [persistent]);

  if (!visible) return null;

  const primaryColor = scoringClub.colors?.primary ?? '#2563EB';

  return (
    <div
      style={{
        position: 'absolute',
        top: '25%',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        pointerEvents: 'none',
        animation: 'slideInGoal 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
    >
      <div
        style={{
          background: primaryColor,
          padding: '12px 64px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
          borderTop: '2px solid rgba(255, 255, 255, 0.4)',
          borderBottom: '2px solid rgba(255, 255, 255, 0.4)',
          transform: 'skewX(-10deg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            transform: 'skewX(10deg)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 48,
            color: '#FFF',
            letterSpacing: 4,
            textShadow: '0 3px 6px rgba(0, 0, 0, 0.5)',
            textTransform: 'uppercase',
          }}
        >
          GOAL!
        </div>
        <div
          style={{
            transform: 'skewX(10deg)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 20,
            color: '#F8F9FA',
            letterSpacing: 1,
            marginTop: -4,
          }}
        >
          {scorerName} {minuteLabel}&apos;
        </div>
      </div>
    </div>
  );
};

interface ReplayOverlayProps {
  onSkip: () => void;
}

export const ReplayOverlay: React.FC<ReplayOverlayProps> = ({ onSkip }) => {
  return (
    <div
      onClick={onSkip}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        cursor: 'pointer',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Letterbox Bar */}
      <div
        style={{
          height: 56,
          background: '#000',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            background: '#F4B41A',
            color: '#000',
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 14,
            padding: '4px 12px',
            borderRadius: 3,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          REPLAY
        </div>
        <span
          style={{
            position: 'absolute',
            right: 24,
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 12,
          }}
        >
          Click or Space to skip
        </span>
      </div>

      {/* Bottom Letterbox Bar */}
      <div
        style={{
          height: 56,
          background: '#000',
          width: '100%',
        }}
      />
    </div>
  );
};
