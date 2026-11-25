// Implements SPEC §11.24 Tutorial Coach-Marks & design/extras/
import React, { useEffect } from 'react';
import { useStore } from '@/state/store';
import { KeyHint } from './KeyHint';

interface TutorialStepConfig {
  step: number;
  expectedScreen: string;
  targetQuery?: string;
  headline: string;
  text: string;
  bubblePosition: {
    top?: string | number;
    bottom?: string | number;
    left?: string | number;
    right?: string | number;
  };
}

const TUTORIAL_STEPS: TutorialStepConfig[] = [
  {
    step: 1,
    expectedScreen: 'hub',
    headline: 'Hub Overview',
    text: 'Welcome to your office, boss. Here is your week at a glance: your next fixture, the league table, and team news. Keep an eye on board confidence and fan mood.',
    bubblePosition: { bottom: 120, left: '50%' },
  },
  {
    step: 2,
    expectedScreen: 'hub',
    headline: 'Advancing the Week',
    text: "When you're ready, press Space or click Continue in the top bar to advance the club's week towards matchday.",
    bubblePosition: { top: 76, right: 32 },
  },
  {
    step: 3,
    expectedScreen: 'tactics',
    headline: 'Tactics & Formation',
    text: 'Drag a magnet onto another player to swap them. Click one to open his file and change his attacking or defensive role.',
    bubblePosition: { top: 180, left: 380 },
  },
  {
    step: 4,
    expectedScreen: 'preMatch',
    headline: 'Pre-Match Briefing',
    text: "I've scouted our opponent and prepared key recommendations. Click Apply to enact any tactical tip, or Apply All.",
    bubblePosition: { top: 160, right: 60 },
  },
  {
    step: 5,
    expectedScreen: 'preMatch',
    headline: 'Team Talk',
    text: 'Speak to the squad before kick-off. Choose your tone wisely — confidence and morale decide close games.',
    bubblePosition: { bottom: 100, left: '50%' },
  },
  {
    step: 6,
    expectedScreen: 'match',
    headline: 'Match HUD Controls',
    text: 'Use the speed controls (1x, 2x, Key) to adjust pace. You can make tactical tweaks, touchline shouts, and substitutions live.',
    bubblePosition: { bottom: 110, left: '50%' },
  },
  {
    step: 7,
    expectedScreen: 'weekSummary',
    headline: 'Week Summary & Board Review',
    text: "After each match, review the round's results, finances, and training growth. Your board will let you know how you're performing.",
    bubblePosition: { bottom: 120, left: '50%' },
  },
];

export const TutorialCoachMark: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const currentScreen = useStore((state) => state.screen);
  const advanceTutorial = useStore((state) => state.advanceTutorial);
  const skipTutorial = useStore((state) => state.skipTutorial);

  const tutorial = gameState?.tutorial;

  // Active step config
  const currentConfig =
    tutorial && !tutorial.done ? TUTORIAL_STEPS.find((s) => s.step === tutorial.step) : null;

  const isVisible = currentConfig && currentConfig.expectedScreen === currentScreen;

  // Global Enter and Escape listener
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        advanceTutorial();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        skipTutorial();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isVisible, advanceTutorial, skipTutorial]);

  if (!isVisible || !currentConfig) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Semi-transparent spotlight backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 7, 11, 0.45)',
          pointerEvents: 'auto',
        }}
        onClick={advanceTutorial}
      />

      {/* Speech Bubble (paper look per docs/design/extras/index.html) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          ...currentConfig.bubblePosition,
          transform: currentConfig.bubblePosition.left === '50%' ? 'translateX(-50%)' : undefined,
          width: '390px',
          maxWidth: '92vw',
          backgroundColor: '#EFEBE3',
          color: '#070C18',
          padding: '16px 20px 14px',
          borderRadius: '2px',
          boxShadow: '0 14px 34px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 0, 0, 0.1)',
          pointerEvents: 'auto',
          userSelect: 'none',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header with Theo portrait */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              width: '44px',
              height: '52px',
              backgroundColor: '#0B1F3A',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F2B705',
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: '22px',
              letterSpacing: '0.04em',
              boxShadow: 'inset 0 0 8px rgba(0,0,0,0.4)',
              flexShrink: 0,
            }}
          >
            TH
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#070C18',
                lineHeight: 1.1,
              }}
            >
              Theo
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: '11px',
                color: '#5C6470',
                marginTop: '3px',
                letterSpacing: '0.02em',
              }}
            >
              Assistant Manager · Tip {currentConfig.step} of 7
            </div>
          </div>
        </div>

        {/* Coach tip text */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: '14.5px',
            lineHeight: 1.45,
            color: '#1A202C',
            marginTop: '12px',
            marginBottom: '14px',
          }}
        >
          {currentConfig.text}
        </p>

        {/* Footer actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            paddingTop: '10px',
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          <button
            onClick={skipTutorial}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '4px 2px',
              fontSize: '12px',
              fontFamily: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
            }}
          >
            Skip Tutorial
          </button>

          <button
            onClick={advanceTutorial}
            style={{
              background: '#070C18',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '2px',
              padding: '6px 14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '12px',
              fontFamily: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            Got it <KeyHint hint="Enter" />
          </button>
        </div>
      </div>
    </div>
  );
};
