// Implements SPEC §11.19 Week Summary screen (on-air broadcast world)
// Round match results, updated table excerpt, medical updates, training growth, finance line, Continue.
import React from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { Ticker } from '../components/Ticker';
import { formatMoney } from '../../core/math';
import { Player } from '../../core/types';
import { Calendar, DollarSign, TrendingUp, Activity, ArrowRight, CheckCircle2 } from 'lucide-react';

export const WeekSummaryScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Round results
  const completedMatchday = Math.max(1, gameState.matchday);
  const roundFixtures = gameState.fixtures.filter(
    (f) => f.matchday === completedMatchday && f.result !== null,
  );

  // Table excerpt (top 3 + user)
  const top3 = gameState.table.slice(0, 3);
  const userRankIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
  const userRow = gameState.table[userRankIndex];
  const userPosition = userRankIndex >= 0 ? userRankIndex + 1 : 1;

  // Injured squad players
  const injuredPlayers = userClub.squad
    .map((id) => gameState.players[id])
    .filter((p): p is Player => p != null && p.injury !== null);

  const handleNextMatchday = async () => {
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
            maxWidth: '1100px',
            margin: '0 auto',
          }}
        >
          {/* Header */}
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
                WEEK {completedMatchday} SUMMARY & DIGEST
              </h1>
              <div
                className="broadcast-label"
                style={{ color: 'var(--text-dim)', marginTop: '2px' }}
              >
                Matchday {completedMatchday} of 18 Complete · Weekly Review
              </div>
            </div>

            <Button
              variant="primary"
              size="l"
              onClick={handleNextMatchday}
              style={{ minWidth: '180px' }}
            >
              Advance Week <ArrowRight size={18} />
            </Button>
          </div>

          {/* Grid: Round Results + Table Excerpt */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '24px',
            }}
          >
            {/* Round Fixtures Results */}
            <Panel title={`MATCHDAY ${completedMatchday} RESULTS`}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {roundFixtures.map((fix) => {
                  const home = gameState.clubs[fix.homeId];
                  const away = gameState.clubs[fix.awayId];
                  if (!home || !away) return null;
                  const isUser = home.id === userClub.id || away.id === userClub.id;

                  return (
                    <div
                      key={fix.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: isUser ? 'var(--surface-3)' : 'var(--surface-2)',
                        borderRadius: 'var(--radius-s)',
                        borderLeft: isUser ? '3px solid var(--accent)' : '3px solid transparent',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flex: 1,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{home.shortName}</span>
                        <Crest
                          clubId={home.id}
                          code={home.code}
                          primaryColor={home.colors.primary}
                          secondaryColor={home.colors.secondary}
                          size={18}
                        />
                      </div>

                      <div
                        className="stat-number tabular-nums"
                        style={{
                          padding: '0 16px',
                          fontWeight: 700,
                          fontSize: '15px',
                        }}
                      >
                        {fix.result?.homeGoals} - {fix.result?.awayGoals}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flex: 1,
                          justifyContent: 'flex-start',
                        }}
                      >
                        <Crest
                          clubId={away.id}
                          code={away.code}
                          primaryColor={away.colors.primary}
                          secondaryColor={away.colors.secondary}
                          size={18}
                        />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{away.shortName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Table Excerpt */}
            <Panel title="UPDATED TABLE STANDINGS">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {top3.map((row, index) => {
                  const club = gameState.clubs[row.clubId];
                  if (!club) return null;
                  const isUser = row.clubId === userClub.id;
                  const pos = index + 1;
                  return (
                    <div
                      key={row.clubId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        backgroundColor: isUser ? 'var(--surface-3)' : 'transparent',
                        borderRadius: 'var(--radius-s)',
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
                          style={{
                            fontWeight: 700,
                            color: pos === 1 ? 'var(--gold)' : 'var(--text-dim)',
                          }}
                        >
                          {pos}.
                        </span>
                        <Crest
                          clubId={club.id}
                          code={club.code}
                          primaryColor={club.colors.primary}
                          secondaryColor={club.colors.secondary}
                          size={18}
                        />
                        <span style={{ fontWeight: isUser ? 700 : 500 }}>{club.name}</span>
                      </div>
                      <span className="stat-number tabular-nums" style={{ fontWeight: 700 }}>
                        {row.pts} pts
                      </span>
                    </div>
                  );
                })}

                {userRow && userPosition > 3 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      backgroundColor: 'var(--surface-3)',
                      borderRadius: 'var(--radius-s)',
                      borderTop: '1px dashed var(--border)',
                      marginTop: '4px',
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
                        style={{
                          fontWeight: 700,
                          color: 'var(--accent-text)',
                        }}
                      >
                        {userPosition}.
                      </span>
                      <Crest
                        clubId={userClub.id}
                        code={userClub.code}
                        primaryColor={userClub.colors.primary}
                        secondaryColor={userClub.colors.secondary}
                        size={18}
                      />
                      <span style={{ fontWeight: 700 }}>{userClub.name}</span>
                    </div>
                    <span className="stat-number tabular-nums" style={{ fontWeight: 700 }}>
                      {userRow.pts} pts
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Medical & Finances Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
            }}
          >
            {/* Medical / Injuries */}
            <Panel title="PHYSIO & INJURY REPORT">
              <div style={{ fontSize: '14px' }}>
                {injuredPlayers.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--win)',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Full squad fit and available. No active injuries.</span>
                  </div>
                ) : (
                  injuredPlayers.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <strong style={{ color: 'var(--loss)' }}>{p.knownAs ?? p.lastName}:</strong>{' '}
                      {p.injury?.kind} ({p.injury?.matchdaysOut} matchdays remaining)
                    </div>
                  ))
                )}
              </div>
            </Panel>

            {/* Financial Ledger Update */}
            <Panel title="FINANCE SUMMARY">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-dim)' }}>TV / League Distribution:</span>
                  <strong className="tabular-nums" style={{ color: 'var(--win)' }}>
                    +€600,000
                  </strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-dim)' }}>Commercial / Gate Revenue:</span>
                  <strong className="tabular-nums" style={{ color: 'var(--win)' }}>
                    +{formatMoney(userClub.reputation * 150000)}
                  </strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '6px',
                  }}
                >
                  <span style={{ color: 'var(--text-dim)' }}>Closing Bank Balance:</span>
                  <strong
                    className="stat-number tabular-nums"
                    style={{
                      color: userClub.balance >= 0 ? 'var(--text)' : 'var(--loss)',
                    }}
                  >
                    {formatMoney(userClub.balance)}
                  </strong>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <Ticker
        items={[
          `Week ${completedMatchday} summary finalized`,
          'Recovery sessions completed on training pitches',
          'Focus shifts toward next competitive matchday',
        ]}
      />
    </div>
  );
};
