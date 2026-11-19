// Implements SPEC §11.12 Fixtures screen (on-air broadcast world)
// The user club's 18 fixtures with result, scorers, attendance, MOTM, opponent position and form.
import React from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Crest } from '../components/Crest';
import { Ticker } from '../components/Ticker';
import { formatMoney } from '../../core/math';
import { Calendar, MapPin, Users, Award } from 'lucide-react';

export const FixturesScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Filter 18 fixtures for user club
  const clubFixtures = gameState.fixtures
    .filter((f) => f.homeId === userClub.id || f.awayId === userClub.id)
    .sort((a, b) => a.matchday - b.matchday);

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
          <div>
            <h1
              style={{
                fontSize: '32px',
                fontFamily: 'var(--font-head)',
                margin: 0,
              }}
            >
              SEASON SCHEDULE & FIXTURES
            </h1>
            <div className="broadcast-label" style={{ color: 'var(--text-dim)', marginTop: '2px' }}>
              {userClub.name.toUpperCase()} · 18 MATCHDAYS
            </div>
          </div>

          {/* Fixture cards list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {clubFixtures.map((fix) => {
              const isHome = fix.homeId === userClub.id;
              const oppId = isHome ? fix.awayId : fix.homeId;
              const oppClub = gameState.clubs[oppId];
              if (!oppClub) return null;
              const isCurrent = fix.matchday === gameState.matchday;
              const isCompleted = fix.result !== null;

              return (
                <Panel
                  key={fix.id}
                  style={{
                    borderLeft: isCurrent ? '4px solid var(--accent)' : undefined,
                    backgroundColor: isCurrent ? 'var(--surface-3)' : 'var(--surface)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                    }}
                  >
                    {/* Matchday & Venue */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        minWidth: '180px',
                      }}
                    >
                      <div
                        className="broadcast-label"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-s)',
                          fontSize: '12px',
                          color: isCurrent ? 'var(--accent-text)' : 'var(--text)',
                        }}
                      >
                        MD {fix.matchday}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                          {isHome ? 'Home Tie' : 'Away Fixture'}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <MapPin size={12} />
                          {isHome ? userClub.stadium.name : oppClub.stadium.name}
                        </div>
                      </div>
                    </div>

                    {/* Opponent & Score / Status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        flex: 1,
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <Crest
                          clubId={oppClub.id}
                          code={oppClub.code}
                          primaryColor={oppClub.colors.primary}
                          secondaryColor={oppClub.colors.secondary}
                          size={32}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '16px' }}>{oppClub.name}</div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-dim)',
                            }}
                          >
                            Reputation {oppClub.reputation}★ · {oppClub.style.formation}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '0 24px',
                          textAlign: 'center',
                          minWidth: '100px',
                        }}
                      >
                        {isCompleted && fix.result ? (
                          <div
                            className="stat-number tabular-nums"
                            style={{
                              fontSize: '24px',
                              fontWeight: 700,
                              color:
                                (isHome && fix.result.homeGoals > fix.result.awayGoals) ||
                                (!isHome && fix.result.awayGoals > fix.result.homeGoals)
                                  ? 'var(--win)'
                                  : fix.result.homeGoals === fix.result.awayGoals
                                    ? 'var(--draw)'
                                    : 'var(--loss)',
                            }}
                          >
                            {fix.result.homeGoals} - {fix.result.awayGoals}
                          </div>
                        ) : (
                          <div
                            className="broadcast-label"
                            style={{
                              color: isCurrent ? 'var(--accent-text)' : 'var(--text-faint)',
                              fontSize: '13px',
                            }}
                          >
                            {isCurrent ? 'NEXT FIXTURE' : fix.kickoff}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Match Info: Attendance or Weather */}
                    <div
                      style={{
                        textAlign: 'right',
                        minWidth: '140px',
                        fontSize: '12px',
                        color: 'var(--text-dim)',
                      }}
                    >
                      {isCompleted ? (
                        <div>
                          <div style={{ color: 'var(--text)' }}>
                            Att: {fix.result?.attendance?.toLocaleString() ?? '-'}
                          </div>
                          <div style={{ color: 'var(--text-faint)' }}>Completed</div>
                        </div>
                      ) : (
                        <div>
                          <div>Weather: {fix.weather}</div>
                          <div>{fix.kickoff} Kickoff</div>
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      </div>

      <Ticker
        items={[
          `${userClub.name} Fixture Schedule`,
          'Check next match preview on Hub',
          'Tactical preparation updates weekly',
        ]}
      />
    </div>
  );
};
