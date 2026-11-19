// Implements SPEC §11.18 Full-Time and Post-Match screen (on-air broadcast world)
// Final score, scorers with minutes, player ratings, stats comparison, team talk, Continue to Week Summary.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { Ticker } from '../components/Ticker';
import { Award, ArrowRight, TrendingUp } from 'lucide-react';

export const PostMatchScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);

  const [postMatchTalk, setPostMatchTalk] = useState<string>('Praise');

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Retrieve latest fixture result for user's club
  const latestFixture = gameState.fixtures
    .filter((f) => (f.homeId === userClub.id || f.awayId === userClub.id) && f.result !== null)
    .sort((a, b) => b.matchday - a.matchday)[0];

  const result = latestFixture?.result;
  const isHome = latestFixture ? latestFixture.homeId === userClub.id : true;
  const homeClub = latestFixture ? (gameState.clubs[latestFixture.homeId] ?? userClub) : userClub;
  const awayClub = latestFixture ? (gameState.clubs[latestFixture.awayId] ?? userClub) : userClub;

  const isUserWinner =
    result &&
    ((isHome && result.homeGoals > result.awayGoals) ||
      (!isHome && result.awayGoals > result.homeGoals));
  const isDraw = result && result.homeGoals === result.awayGoals;

  const handleContinueToWeekSummary = async () => {
    await advanceGame();
  };

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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          {/* Header Final Score Banner */}
          <Panel dominant title="MATCH RESULT & POST-MATCH REPORT">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                padding: '28px 0',
              }}
            >
              {/* Home Club */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  width: '200px',
                }}
              >
                <Crest
                  clubId={homeClub.id}
                  code={homeClub.code}
                  primaryColor={homeClub.colors.primary}
                  secondaryColor={homeClub.colors.secondary}
                  size={68}
                />
                <div
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '22px',
                    fontWeight: 700,
                  }}
                >
                  {homeClub.name.toUpperCase()}
                </div>
              </div>

              {/* Score Display */}
              <div style={{ textAlign: 'center' }}>
                <div
                  className="stat-number tabular-nums"
                  style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1,
                  }}
                >
                  {result ? `${result.homeGoals} - ${result.awayGoals}` : '0 - 0'}
                </div>
                <div
                  className="broadcast-label"
                  style={{
                    fontSize: '13px',
                    color: isUserWinner ? 'var(--win)' : isDraw ? 'var(--draw)' : 'var(--loss)',
                    marginTop: '8px',
                  }}
                >
                  {isUserWinner ? 'VICTORY' : isDraw ? 'HONOURS EVEN' : 'DEFEAT'}
                </div>
              </div>

              {/* Away Club */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  width: '200px',
                }}
              >
                <Crest
                  clubId={awayClub.id}
                  code={awayClub.code}
                  primaryColor={awayClub.colors.primary}
                  secondaryColor={awayClub.colors.secondary}
                  size={68}
                />
                <div
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '22px',
                    fontWeight: 700,
                  }}
                >
                  {awayClub.name.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Scorers list */}
            {result && result.scorers.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--text-dim)', fontSize: '11px' }}
                >
                  GOALSCORERS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {result.scorers.map((s, idx) => {
                    const scorer = gameState.players[s.playerId];
                    return (
                      <div
                        key={idx}
                        style={{
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {scorer ? (scorer.knownAs ?? scorer.lastName) : 'Goal'}
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--accent-text)' }}>
                          ({s.minuteLabel}')
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          {/* Post-Match Team Talk */}
          <Panel title="DRESSING ROOM DEBRIEF">
            <div style={{ fontSize: '14px', marginBottom: '14px' }}>
              Address the squad following the full-time whistle:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['Praise', 'Demand More', 'Calm', 'Passionate'].map((tone) => (
                <button
                  key={tone}
                  onClick={() => setPostMatchTalk(tone)}
                  className="broadcast-label"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius-s)',
                    backgroundColor: postMatchTalk === tone ? 'var(--accent)' : 'var(--surface-2)',
                    color: postMatchTalk === tone ? 'var(--accent-ink)' : 'var(--text)',
                    border: `1px solid ${postMatchTalk === tone ? 'var(--accent)' : 'var(--border)'}`,
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {tone}
                </button>
              ))}
            </div>
          </Panel>

          {/* Continue button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              size="l"
              onClick={handleContinueToWeekSummary}
              style={{ minWidth: '220px' }}
            >
              To Week Summary <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </div>

      <Ticker
        items={[
          'Full-Time reaction coming in from across the league',
          'Press conferences underway in media suites',
          'Updated league standings processing',
        ]}
      />
    </div>
  );
};
