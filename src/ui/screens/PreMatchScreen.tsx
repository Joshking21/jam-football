// Implements SPEC §11.15 Pre-Match screen (on-air broadcast world)
// Stepper: 1. Opponent Report, 2. Team Selection, 3. Team Talk.
// Advances to Match on Kick Off.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { TacticsScreen } from './TacticsScreen';
import { Ticker } from '../components/Ticker';
import { Check, Shield, AlertTriangle, ChevronRight, Zap } from 'lucide-react';

type PreMatchStep = 1 | 2 | 3;

export const PreMatchScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);
  const updateUserTactics = useStore((state) => state.updateUserTactics);
  const showToast = useStore((state) => state.showToast);

  const [currentStep, setCurrentStep] = useState<PreMatchStep>(1);
  const [selectedTone, setSelectedTone] = useState<string>('Assertive');

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const nextFix = gameState.fixtures.find(
    (f) =>
      f.matchday === gameState.matchday && (f.homeId === userClub.id || f.awayId === userClub.id),
  );

  const isHome = nextFix ? nextFix.homeId === userClub.id : true;
  const oppId = nextFix
    ? isHome
      ? nextFix.awayId
      : nextFix.homeId
    : (userClub.rivals[0] ?? 'c02');
  const oppClub = gameState.clubs[oppId] ?? Object.values(gameState.clubs)[0]!;

  const handleApplySuggestedApproach = () => {
    // If opponent plays wide or direct, counter with balanced/pressing
    updateUserTactics({
      instructions: {
        ...userClub.tactics.instructions,
        mentality: 'Balanced',
        pressing: 'Mid',
        line: 'Normal',
      },
    });
    showToast('Applied assistant tactical adjustment', 'success');
  };

  const handleKickOff = async () => {
    await advanceGame();
  };

  const tones = [
    {
      name: 'Passionate',
      desc: 'Rally the squad with emotional intensity.',
      reaction: 'Most players will respond well.',
    },
    {
      name: 'Assertive',
      desc: 'Demand tactical focus and high work-rate.',
      reaction: 'Leaders and ambitious players react positively.',
    },
    {
      name: 'Calm',
      desc: 'Remind players to trust the match plan.',
      reaction: 'Relieves pre-match pressure.',
    },
    {
      name: 'Demanding',
      desc: 'Nothing less than 3 points is acceptable.',
      reaction: 'High risk / high reward.',
    },
    {
      name: 'Encouraging',
      desc: 'Express total faith in their capabilities.',
      reaction: 'Boosts morale across young starters.',
    },
    {
      name: 'Cautious',
      desc: 'Stay compact and avoid early errors.',
      reaction: 'Strengthens defensive positioning.',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      <div className="app-content-area" style={{ flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '16px',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '32px',
                  fontFamily: 'var(--font-head)',
                  margin: 0,
                }}
              >
                PRE-MATCH PREPARATION · MATCHDAY {gameState.matchday}
              </h1>
              <div
                className="broadcast-label"
                style={{ color: 'var(--text-dim)', marginTop: '2px' }}
              >
                {userClub.name.toUpperCase()} vs {oppClub.name.toUpperCase()}
              </div>
            </div>

            {/* Step Indicators */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { s: 1, label: '1. OPPONENT REPORT' },
                { s: 2, label: '2. TEAM SELECTION' },
                { s: 3, label: '3. TEAM TALK' },
              ].map(({ s, label }) => (
                <button
                  key={s}
                  onClick={() => setCurrentStep(s as PreMatchStep)}
                  className="broadcast-label"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-s)',
                    backgroundColor: currentStep === s ? 'var(--accent)' : 'var(--surface-2)',
                    color: currentStep === s ? 'var(--accent-ink)' : 'var(--text-dim)',
                    border: `1px solid ${currentStep === s ? 'var(--accent)' : 'var(--border)'}`,
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 1: Opponent Report */}
          {currentStep === 1 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '24px',
              }}
            >
              <Panel dominant title={`OPPONENT SCOUTING: ${oppClub.name.toUpperCase()}`}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <Crest
                    clubId={oppClub.id}
                    code={oppClub.code}
                    primaryColor={oppClub.colors.primary}
                    secondaryColor={oppClub.colors.secondary}
                    size={64}
                  />
                  <div>
                    <h2
                      style={{
                        fontSize: '24px',
                        fontFamily: 'var(--font-head)',
                        margin: 0,
                      }}
                    >
                      {oppClub.name}
                    </h2>
                    <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
                      Manager: {oppClub.managerName} · Primary Formation: {oppClub.style.formation}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-s)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <strong style={{ color: 'var(--accent-text)' }}>Tactical Style:</strong>{' '}
                    {oppClub.name} typically set up in a {oppClub.style.formation} with{' '}
                    {oppClub.style.mentality.toLowerCase()} mentality,{' '}
                    {oppClub.style.passing.toLowerCase()} passing, and{' '}
                    {oppClub.style.pressing.toLowerCase()} pressing.
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-s)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <strong style={{ color: 'var(--warning)' }}>Identified Weakness:</strong> Their
                    backline can be exposed against swift transitions and direct balls through the
                    channels.
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '16px',
                  }}
                >
                  <Button
                    variant="secondary"
                    size="m"
                    icon={<Zap size={16} />}
                    onClick={handleApplySuggestedApproach}
                  >
                    Apply Suggested Counter-Tactic
                  </Button>
                  <Button variant="primary" size="m" onClick={() => setCurrentStep(2)}>
                    To Team Selection <ChevronRight size={16} />
                  </Button>
                </div>
              </Panel>

              {/* Match Factors */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <Panel title="MATCH CONDITIONS">
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <div>
                      <strong>Venue:</strong>{' '}
                      {isHome ? userClub.stadium.name : oppClub.stadium.name}
                    </div>
                    <div>
                      <strong>Weather:</strong> {nextFix?.weather ?? 'Clear'}
                    </div>
                    <div>
                      <strong>Kickoff:</strong> {nextFix?.kickoff ?? 'Night'}
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* Step 2: Team Selection */}
          {currentStep === 2 && (
            <div>
              <TacticsScreen />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '16px',
                }}
              >
                <Button variant="primary" size="l" onClick={() => setCurrentStep(3)}>
                  Proceed to Team Talk <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Team Talk */}
          {currentStep === 3 && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <Panel dominant title="DRESSING ROOM PRE-MATCH ADDRESS">
                <div style={{ fontSize: '15px', marginBottom: '20px' }}>
                  Select the tone to deliver to the squad before emerging from the tunnel:
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {tones.map((t) => {
                    const isSelected = selectedTone === t.name;
                    return (
                      <div
                        key={t.name}
                        onClick={() => setSelectedTone(t.name)}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-s)',
                          backgroundColor: isSelected ? 'var(--surface-3)' : 'var(--surface-2)',
                          border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontFamily: 'var(--font-head)',
                            fontSize: '18px',
                            color: isSelected ? 'var(--accent-text)' : 'var(--text)',
                          }}
                        >
                          {t.name}
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-dim)',
                            marginTop: '4px',
                          }}
                        >
                          {t.desc}
                        </div>
                        <div
                          className="broadcast-label"
                          style={{
                            fontSize: '11px',
                            color: 'var(--win)',
                            marginTop: '8px',
                          }}
                        >
                          {t.reaction}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '20px',
                  }}
                >
                  <Button variant="secondary" size="l" onClick={() => setCurrentStep(2)}>
                    Back to XI
                  </Button>
                  <Button
                    variant="primary"
                    size="l"
                    onClick={handleKickOff}
                    style={{ minWidth: '200px' }}
                  >
                    Kick Off
                  </Button>
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>

      <Ticker
        items={[
          'Teams emerging from the tunnel',
          'Match officials conducting pitch inspection',
          'Atmosphere building inside the stadium',
        ]}
      />
    </div>
  );
};
