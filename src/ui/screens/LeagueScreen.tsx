// Implements SPEC §11.11 League screen (on-air broadcast world)
// Tabs: Table (full table with FlipList, 1st gold mark, 2-3 accent, bottom 2 red),
// Results by matchday (selector 1-18), Stats (Top scorers, assists, ratings, clean sheets), Clubs.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Crest } from '../components/Crest';
import { FlipList } from '../components/FlipList';
import { Ticker } from '../components/Ticker';
import { Player, TableRow } from '../../core/types';
import { Trophy, ChevronLeft, ChevronRight, Award } from 'lucide-react';

type LeagueTab = 'TABLE' | 'RESULTS' | 'STATS' | 'CLUBS';

export const LeagueScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const [activeTab, setActiveTab] = useState<LeagueTab>('TABLE');
  const [selectedMatchday, setSelectedMatchday] = useState<number>(gameState?.matchday || 1);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  const table = gameState.table;

  // Filter fixtures for selected matchday
  const matchdayFixtures = gameState.fixtures.filter((f) => f.matchday === selectedMatchday);

  // Top players extraction
  const allPlayers: Player[] = Object.values(gameState.players);
  const topScorers = [...allPlayers]
    .filter((p) => p.stats.goals > 0)
    .sort((a, b) => b.stats.goals - a.stats.goals)
    .slice(0, 5);

  const topAssisters = [...allPlayers]
    .filter((p) => p.stats.assists > 0)
    .sort((a, b) => b.stats.assists - a.stats.assists)
    .slice(0, 5);

  const topRatings = [...allPlayers]
    .filter((p) => p.stats.apps >= 3)
    .sort((a, b) => {
      const avgA = a.stats.ratedApps > 0 ? a.stats.ratingSum / a.stats.ratedApps : 0;
      const avgB = b.stats.ratedApps > 0 ? b.stats.ratingSum / b.stats.ratedApps : 0;
      return avgB - avgA;
    })
    .slice(0, 5);

  const getFormDotColor = (res: 'W' | 'D' | 'L'): string => {
    if (res === 'W') return 'var(--win)';
    if (res === 'D') return 'var(--draw)';
    return 'var(--loss)';
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
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
                MERIDIAN LEAGUE TABLE & STANDINGS
              </h1>
              <div
                className="broadcast-label"
                style={{ color: 'var(--text-dim)', marginTop: '2px' }}
              >
                Season 2026/27 · 10 Clubs · 18 Matchdays
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '4px',
                backgroundColor: 'var(--surface-2)',
                padding: '4px',
                borderRadius: 'var(--radius-s)',
                border: '1px solid var(--border)',
              }}
            >
              {(['TABLE', 'RESULTS', 'STATS', 'CLUBS'] as LeagueTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="broadcast-label"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-s)',
                    backgroundColor: activeTab === tab ? 'var(--accent)' : 'transparent',
                    color: activeTab === tab ? 'var(--accent-ink)' : 'var(--text-dim)',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab 1: Full Table with FlipList */}
          {activeTab === 'TABLE' && (
            <Panel dominant title="OFFICIAL STANDINGS">
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '14px',
                  }}
                >
                  <thead>
                    <tr
                      className="broadcast-label"
                      style={{
                        borderBottom: '2px solid var(--border)',
                        color: 'var(--text-dim)',
                        fontSize: '12px',
                      }}
                    >
                      <th style={{ padding: '10px 12px', width: '40px' }}>POS</th>
                      <th style={{ padding: '10px 12px' }}>CLUB</th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '45px',
                          textAlign: 'center',
                        }}
                      >
                        P
                      </th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '45px',
                          textAlign: 'center',
                        }}
                      >
                        W
                      </th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '45px',
                          textAlign: 'center',
                        }}
                      >
                        D
                      </th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '45px',
                          textAlign: 'center',
                        }}
                      >
                        L
                      </th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '50px',
                          textAlign: 'center',
                        }}
                      >
                        GF
                      </th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '50px',
                          textAlign: 'center',
                        }}
                      >
                        GA
                      </th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '50px',
                          textAlign: 'center',
                        }}
                      >
                        GD
                      </th>
                      <th
                        style={{
                          padding: '10px 12px',
                          width: '60px',
                          textAlign: 'center',
                        }}
                      >
                        PTS
                      </th>
                      <th style={{ padding: '10px 12px', width: '120px' }}>FORM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((row, index) => {
                      const position = index + 1;
                      const club = gameState.clubs[row.clubId];
                      if (!club || !userClub) return null;
                      const isUser = row.clubId === userClub.id;
                      const isTop = position === 1;
                      const isPromotedZone = position >= 2 && position <= 3;
                      const isRelegation = position >= 9;

                      const rankBorderColor = isTop
                        ? 'var(--gold)'
                        : isPromotedZone
                          ? 'var(--accent)'
                          : isRelegation
                            ? 'var(--loss)'
                            : 'transparent';

                      return (
                        <tr
                          key={row.clubId}
                          data-flip-id={row.clubId}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            backgroundColor: isUser ? 'var(--surface-3)' : 'transparent',
                            borderLeft: `4px solid ${rankBorderColor}`,
                          }}
                        >
                          <td
                            className="tabular-nums"
                            style={{
                              padding: '12px',
                              fontWeight: 700,
                              color: isTop
                                ? 'var(--gold)'
                                : isUser
                                  ? 'var(--accent-text)'
                                  : 'var(--text)',
                            }}
                          >
                            {position}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                              }}
                            >
                              <Crest
                                clubId={club.id}
                                code={club.code}
                                primaryColor={club.colors.primary}
                                secondaryColor={club.colors.secondary}
                                size={24}
                              />
                              <span
                                style={{
                                  fontWeight: isUser ? 700 : 500,
                                  color: isUser ? 'var(--text)' : 'var(--text-dim)',
                                }}
                              >
                                {club.name}
                              </span>
                            </div>
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ padding: '12px', textAlign: 'center' }}
                          >
                            {row.p}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ padding: '12px', textAlign: 'center' }}
                          >
                            {row.w}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ padding: '12px', textAlign: 'center' }}
                          >
                            {row.d}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ padding: '12px', textAlign: 'center' }}
                          >
                            {row.l}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ padding: '12px', textAlign: 'center' }}
                          >
                            {row.gf}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ padding: '12px', textAlign: 'center' }}
                          >
                            {row.ga}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{
                              padding: '12px',
                              textAlign: 'center',
                              fontWeight: 600,
                              color:
                                row.gd > 0
                                  ? 'var(--win)'
                                  : row.gd < 0
                                    ? 'var(--loss)'
                                    : 'var(--text-dim)',
                            }}
                          >
                            {row.gd > 0 ? `+${row.gd}` : row.gd}
                          </td>
                          <td
                            className="stat-number tabular-nums"
                            style={{
                              padding: '12px',
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '16px',
                              color: 'var(--text)',
                            }}
                          >
                            {row.pts}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {row.form.length === 0 ? (
                              <span style={{ color: 'var(--text-faint)', fontSize: '14px' }}>
                                —
                              </span>
                            ) : (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {row.form.map((res, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '2px',
                                      backgroundColor: getFormDotColor(res),
                                      color: '#000000',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      fontFamily: 'var(--font-head)',
                                    }}
                                  >
                                    {res}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* Tab 2: Results By Matchday */}
          {activeTab === 'RESULTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Matchday Selector Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  backgroundColor: 'var(--surface)',
                  padding: '12px',
                  borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--border)',
                }}
              >
                <button
                  onClick={() => setSelectedMatchday((prev) => Math.max(1, prev - 1))}
                  disabled={selectedMatchday <= 1}
                  style={{
                    color: selectedMatchday <= 1 ? 'var(--text-faint)' : 'var(--text)',
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span
                  className="broadcast-label"
                  style={{ fontSize: '15px', minWidth: '160px', textAlign: 'center' }}
                >
                  MATCHDAY {selectedMatchday} OF 18
                </span>
                <button
                  onClick={() => setSelectedMatchday((prev) => Math.min(18, prev + 1))}
                  disabled={selectedMatchday >= 18}
                  style={{
                    color: selectedMatchday >= 18 ? 'var(--text-faint)' : 'var(--text)',
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Fixtures List for Matchday */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '12px',
                }}
              >
                {matchdayFixtures.map((fix) => {
                  const home = gameState.clubs[fix.homeId];
                  const away = gameState.clubs[fix.awayId];
                  if (!home || !away) return null;
                  const isCompleted = fix.result !== null;

                  return (
                    <Panel key={fix.id}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                        }}
                      >
                        {/* Home team */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flex: 1,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: '15px' }}>{home.name}</span>
                          <Crest
                            clubId={home.id}
                            code={home.code}
                            primaryColor={home.colors.primary}
                            secondaryColor={home.colors.secondary}
                            size={28}
                          />
                        </div>

                        {/* Score or Kickoff */}
                        <div
                          style={{
                            padding: '0 24px',
                            textAlign: 'center',
                            minWidth: '120px',
                          }}
                        >
                          {isCompleted ? (
                            <div
                              className="stat-number tabular-nums"
                              style={{
                                fontSize: '24px',
                                fontWeight: 700,
                                color: 'var(--text)',
                              }}
                            >
                              {fix.result?.homeGoals} - {fix.result?.awayGoals}
                            </div>
                          ) : (
                            <div
                              className="broadcast-label"
                              style={{
                                color: 'var(--text-dim)',
                                fontSize: '12px',
                              }}
                            >
                              {fix.kickoff}
                            </div>
                          )}
                        </div>

                        {/* Away team */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flex: 1,
                            justifyContent: 'flex-start',
                          }}
                        >
                          <Crest
                            clubId={away.id}
                            code={away.code}
                            primaryColor={away.colors.primary}
                            secondaryColor={away.colors.secondary}
                            size={28}
                          />
                          <span style={{ fontWeight: 600, fontSize: '15px' }}>{away.name}</span>
                        </div>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Stats */}
          {activeTab === 'STATS' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
              }}
            >
              <Panel title="TOP SCORERS">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {topScorers.length === 0 ? (
                    <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                      No goals recorded yet this season.
                    </div>
                  ) : (
                    topScorers.map((p, idx) => {
                      const club = gameState.clubs[p.clubId ?? ''];
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              className="tabular-nums"
                              style={{ fontWeight: 700, color: 'var(--text-dim)' }}
                            >
                              {idx + 1}.
                            </span>
                            <span style={{ fontWeight: 600 }}>
                              {p.knownAs ?? `${p.firstName} ${p.lastName}`}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-dim)',
                              }}
                            >
                              ({club?.shortName})
                            </span>
                          </div>
                          <span
                            className="stat-number tabular-nums"
                            style={{ fontWeight: 700, fontSize: '16px' }}
                          >
                            {p.stats.goals}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>

              <Panel title="MOST ASSISTS">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {topAssisters.length === 0 ? (
                    <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                      No assists recorded yet this season.
                    </div>
                  ) : (
                    topAssisters.map((p, idx) => {
                      const club = gameState.clubs[p.clubId ?? ''];
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              className="tabular-nums"
                              style={{ fontWeight: 700, color: 'var(--text-dim)' }}
                            >
                              {idx + 1}.
                            </span>
                            <span style={{ fontWeight: 600 }}>
                              {p.knownAs ?? `${p.firstName} ${p.lastName}`}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-dim)',
                              }}
                            >
                              ({club?.shortName})
                            </span>
                          </div>
                          <span
                            className="stat-number tabular-nums"
                            style={{ fontWeight: 700, fontSize: '16px' }}
                          >
                            {p.stats.assists}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>

              <Panel title="HIGHEST RATED">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {topRatings.length === 0 ? (
                    <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                      Minimum 3 appearances required.
                    </div>
                  ) : (
                    topRatings.map((p, idx) => {
                      const club = gameState.clubs[p.clubId ?? ''];
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              className="tabular-nums"
                              style={{ fontWeight: 700, color: 'var(--text-dim)' }}
                            >
                              {idx + 1}.
                            </span>
                            <span style={{ fontWeight: 600 }}>
                              {p.knownAs ?? `${p.firstName} ${p.lastName}`}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-dim)',
                              }}
                            >
                              ({club?.shortName})
                            </span>
                          </div>
                          <span
                            className="stat-number tabular-nums"
                            style={{
                              fontWeight: 700,
                              fontSize: '16px',
                              color: 'var(--win)',
                            }}
                          >
                            {(p.stats.ratedApps > 0
                              ? p.stats.ratingSum / p.stats.ratedApps
                              : 0
                            ).toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* Tab 4: Clubs */}
          {activeTab === 'CLUBS' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
              }}
            >
              {Object.values(gameState.clubs).map((club) => (
                <Panel key={club.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <Crest
                      clubId={club.id}
                      code={club.code}
                      primaryColor={club.colors.primary}
                      secondaryColor={club.colors.secondary}
                      size={48}
                    />
                    <div>
                      <h3
                        style={{
                          fontSize: '18px',
                          fontFamily: 'var(--font-head)',
                          margin: 0,
                        }}
                      >
                        {club.name}
                      </h3>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-dim)',
                          marginTop: '2px',
                        }}
                      >
                        {club.stadium.name} ({club.stadium.capacity.toLocaleString()}) · Manager:{' '}
                        {club.managerName}
                      </div>
                      <div
                        className="broadcast-label"
                        style={{
                          fontSize: '11px',
                          color: 'var(--accent-text)',
                          marginTop: '4px',
                        }}
                      >
                        Formation: {club.style.formation} · {club.style.mentality}
                      </div>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>

      <Ticker
        items={[
          'Meridian League Table Standings',
          'Championship race remains contested',
          'Golden boot chase continues',
        ]}
      />
    </div>
  );
};
