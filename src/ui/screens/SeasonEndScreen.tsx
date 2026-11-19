// Implements SPEC §11.20 Season End screen (on-air broadcast world)
// Final Table, Season Awards, Season in Numbers, Board Verdict with Grade (A+ to F), Buttons: New Game, Title.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { Trophy, Award, Star, ArrowRight, RotateCcw } from 'lucide-react';

export const SeasonEndScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const setScreen = useStore((state) => state.setScreen);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!gameState || !gameState.awards) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;
  const awards = gameState.awards;

  const userRankIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
  const userRow = gameState.table[userRankIndex];
  const userPosition = userRankIndex >= 0 ? userRankIndex + 1 : '-';

  const posDiff = typeof userPosition === 'number' ? userClub.expectation.target - userPosition : 0;
  const grade =
    posDiff >= 2
      ? 'A+'
      : posDiff === 1
        ? 'A'
        : posDiff === 0
          ? 'B'
          : posDiff === -1
            ? 'C'
            : posDiff === -2
              ? 'D'
              : 'F';

  // Helper to get player by id
  const getPlayer = (id: string | null) => {
    return id ? gameState.players[id] : null;
  };

  const goldenBootPlayer = getPlayer(awards.goldenBoot);
  const playmakerPlayer = getPlayer(awards.playmaker);
  const goldenGlovePlayer = getPlayer(awards.goldenGlove);
  const youngPlayer = getPlayer(awards.youngPlayer);
  const playerOfTheSeason = getPlayer(awards.playerOfTheSeason);
  const managerClub = gameState.clubs[awards.managerOfTheSeason];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg)',
        overflowY: 'auto',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            className="broadcast-label"
            style={{ color: 'var(--accent-text)', fontSize: '14px' }}
          >
            MERIDIAN LEAGUE · OFFICIAL CAMPAIGN CONCLUSION
          </div>
          <h1
            style={{
              fontSize: '44px',
              fontFamily: 'var(--font-head)',
              letterSpacing: '0.04em',
              margin: '4px 0 0',
            }}
          >
            SEASON 2026/27 COMPLETED
          </h1>
        </div>

        {/* Step 1: Final Standings & Board Grade */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Panel dominant title="BOARD VERDICT & CAMPAIGN GRADE">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  padding: '24px 0',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                    OVERALL GRADE
                  </div>
                  <div
                    className="stat-number"
                    style={{
                      fontSize: '72px',
                      fontWeight: 700,
                      color: grade.startsWith('A')
                        ? 'var(--gold)'
                        : grade.startsWith('B')
                          ? 'var(--win)'
                          : grade.startsWith('C')
                            ? 'var(--warning)'
                            : 'var(--loss)',
                      lineHeight: 1,
                    }}
                  >
                    {grade}
                  </div>
                </div>

                <div style={{ maxWidth: '400px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: '24px',
                      fontWeight: 700,
                      marginBottom: '6px',
                    }}
                  >
                    {userClub.name.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text)' }}>
                    Finished in <strong>{userPosition}th place</strong> with{' '}
                    <strong>{userRow?.pts ?? 0} points</strong>.
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-dim)',
                      marginTop: '4px',
                    }}
                  >
                    Board mandate was: "{userClub.expectation.label}". Score:{' '}
                    <strong>{gameState.score} pts</strong>.
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '16px',
                }}
              >
                <Button variant="primary" size="l" onClick={() => setStep(2)}>
                  View Season Awards <ArrowRight size={18} />
                </Button>
              </div>
            </Panel>
          </div>
        )}

        {/* Step 2: Season Awards */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Panel dominant title="OFFICIAL MERIDIAN LEAGUE INDIVIDUAL HONOURS">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px',
                  padding: '12px 0',
                }}
              >
                {/* Player of Season */}
                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '16px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--gold)', display: 'flex', gap: '6px' }}
                  >
                    <Award size={14} /> PLAYER OF THE SEASON
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                    {playerOfTheSeason
                      ? `${playerOfTheSeason.firstName} ${playerOfTheSeason.lastName}`
                      : 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Average Rating:{' '}
                    {playerOfTheSeason && playerOfTheSeason.stats.ratedApps > 0
                      ? (
                          playerOfTheSeason.stats.ratingSum / playerOfTheSeason.stats.ratedApps
                        ).toFixed(2)
                      : 'N/A'}
                  </div>
                </div>

                {/* Golden Boot */}
                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '16px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--gold)', display: 'flex', gap: '6px' }}
                  >
                    <Trophy size={14} /> GOLDEN BOOT
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                    {goldenBootPlayer
                      ? `${goldenBootPlayer.firstName} ${goldenBootPlayer.lastName}`
                      : 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Goals: {goldenBootPlayer?.stats.goals}
                  </div>
                </div>

                {/* Playmaker */}
                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '16px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--accent-text)', display: 'flex', gap: '6px' }}
                  >
                    <Star size={14} /> PLAYMAKER OF THE SEASON
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                    {playmakerPlayer
                      ? `${playmakerPlayer.firstName} ${playmakerPlayer.lastName}`
                      : 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Assists: {playmakerPlayer?.stats.assists}
                  </div>
                </div>

                {/* Golden Glove */}
                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '16px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--win)', display: 'flex', gap: '6px' }}
                  >
                    <Award size={14} /> GOLDEN GLOVE
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                    {goldenGlovePlayer
                      ? `${goldenGlovePlayer.firstName} ${goldenGlovePlayer.lastName}`
                      : 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Clean Sheets: {goldenGlovePlayer?.stats.cleanSheets}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '16px',
                }}
              >
                <Button variant="secondary" size="l" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button variant="primary" size="l" onClick={() => setStep(3)}>
                  Campaign Summary <ArrowRight size={18} />
                </Button>
              </div>
            </Panel>
          </div>
        )}

        {/* Step 3: Complete & New Game / Title */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Panel dominant title="END OF CAMPAIGN">
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '28px',
                    marginBottom: '8px',
                  }}
                >
                  CONGRATULATIONS ON COMPLETING THE SEASON
                </h2>
                <div style={{ fontSize: '15px', color: 'var(--text-dim)' }}>
                  You have guided {userClub.name} across all 18 matchdays of the Meridian League
                  campaign.
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  justifyContent: 'center',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '20px',
                }}
              >
                <Button variant="secondary" size="l" onClick={() => setScreen('title')}>
                  Return to Title
                </Button>
                <Button
                  variant="primary"
                  size="l"
                  icon={<RotateCcw size={18} />}
                  onClick={() => setScreen('newGame')}
                >
                  Start New Campaign
                </Button>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
};
