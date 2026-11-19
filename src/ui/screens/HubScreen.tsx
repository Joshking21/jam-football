// Implements SPEC §11.5 Hub screen (on-air broadcast world)
// Dominant Next Match panel + League snapshot + Squad status + Board/Fans meters + Latest News + Inbox
import React from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { CountUp } from '../components/CountUp';
import { Ticker } from '../components/Ticker';
import {
  Calendar,
  Cloud,
  Sun,
  CloudRain,
  AlertTriangle,
  HeartCrack,
  BatteryLow,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Mail,
  ChevronRight,
  Zap,
} from 'lucide-react';

export const HubScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const setScreen = useStore((state) => state.setScreen);
  const advanceGame = useStore((state) => state.advanceGame);
  const showToast = useStore((state) => state.showToast);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Next fixture determination
  const nextFixture = gameState.fixtures.find(
    (f) =>
      f.matchday === gameState.matchday && (f.homeId === userClub.id || f.awayId === userClub.id),
  );

  const isHome = nextFixture ? nextFixture.homeId === userClub.id : true;
  const oppClubId = nextFixture
    ? isHome
      ? nextFixture.awayId
      : nextFixture.homeId
    : (userClub.rivals[0] ?? 'c02');
  const oppClub = gameState.clubs[oppClubId] ?? Object.values(gameState.clubs)[0]!;

  // User table ranking & Opponent table ranking
  const userRankIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
  const oppRankIndex = gameState.table.findIndex((r) => r.clubId === oppClub.id);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 1;
  const oppRank = oppRankIndex >= 0 ? oppRankIndex + 1 : 2;

  // Squad status counters
  const squadPlayers = userClub.squad.map((id) => gameState.players[id]).filter((p) => p != null);
  const injuredCount = squadPlayers.filter((p) => p.injury !== null).length;
  const suspendedCount = squadPlayers.filter((p) => p.suspendedMatches > 0).length;
  const tiredCount = squadPlayers.filter((p) => p.condition < 75).length;
  const unhappyCount = squadPlayers.filter((p) => p.morale < 40).length;

  // Unread inbox items
  const latestInbox = gameState.inbox.filter((m) => !m.read).slice(0, 4);

  // League Snapshot: Top 3, user club (if not in top 3/bottom 2), bottom 2
  const top3 = gameState.table.slice(0, 3);
  const bottom2 = gameState.table.slice(-2);
  const userRow = gameState.table[userRankIndex];

  const snapshotRows = [...top3];
  if (userRank > 3 && userRank < gameState.table.length - 1 && userRow) {
    snapshotRows.push(userRow);
  }
  bottom2.forEach((r) => {
    if (!snapshotRows.find((sr) => sr.clubId === r.clubId)) {
      snapshotRows.push(r);
    }
  });

  const weatherIcon =
    nextFixture?.weather === 'Rain' ? (
      <CloudRain size={16} />
    ) : nextFixture?.weather === 'Overcast' ? (
      <Cloud size={16} />
    ) : (
      <Sun size={16} />
    );

  const tickerItems = [
    `Meridian League Matchday ${gameState.matchday}`,
    `${userClub.name} host ${oppClub.name} at ${isHome ? userClub.stadium.name : oppClub.stadium.name}`,
    `Board confidence stands at ${Math.round(userClub.boardConfidence)}%`,
    `Fan atmosphere rating: ${Math.round(userClub.fanMood)}%`,
    `${gameState.managerName} names matchday squad`,
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr',
            gap: '24px',
          }}
        >
          {/* Left Column: Dominant Next Match Panel + News */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Dominant Next Match Panel (SPEC §11.5 & §19.5) */}
            <Panel
              dominant
              title={`NEXT FIXTURE · MATCHDAY ${gameState.matchday}`}
              subtitle={isHome ? 'HOME TIE' : 'AWAY FIXTURE'}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  padding: '24px 0',
                }}
              >
                {/* Home Club */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    width: '180px',
                  }}
                >
                  <Crest
                    clubId={isHome ? userClub.id : oppClub.id}
                    code={isHome ? userClub.code : oppClub.code}
                    primaryColor={isHome ? userClub.colors.primary : oppClub.colors.primary}
                    secondaryColor={isHome ? userClub.colors.secondary : oppClub.colors.secondary}
                    size={68}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '20px',
                      }}
                    >
                      {isHome ? userClub.name : oppClub.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                      {isHome ? `${userRank}th Place` : `${oppRank}th Place`}
                    </div>
                  </div>
                </div>

                {/* VS Badge & Match Info */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    className="stat-number"
                    style={{
                      fontSize: '32px',
                      color: 'var(--accent-text)',
                      fontWeight: 700,
                    }}
                  >
                    VS
                  </div>
                  <div
                    className="broadcast-label"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text-dim)',
                      fontSize: '12px',
                    }}
                  >
                    {weatherIcon} {nextFixture?.weather ?? 'Clear'} ·{' '}
                    {nextFixture?.kickoff ?? 'Night'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                    {isHome ? userClub.stadium.name : oppClub.stadium.name}
                  </div>
                </div>

                {/* Away Club */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    width: '180px',
                  }}
                >
                  <Crest
                    clubId={isHome ? oppClub.id : userClub.id}
                    code={isHome ? oppClub.code : userClub.code}
                    primaryColor={isHome ? oppClub.colors.primary : userClub.colors.primary}
                    secondaryColor={isHome ? oppClub.colors.secondary : userClub.colors.secondary}
                    size={68}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '20px',
                      }}
                    >
                      {isHome ? oppClub.name : userClub.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                      {isHome ? `${oppRank}th Place` : `${userRank}th Place`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assistant Preview & Action Buttons */}
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '14px', color: 'var(--text-dim)' }}>
                  <strong style={{ color: 'var(--text)' }}>Assistant Report:</strong> {oppClub.name}{' '}
                  deploy a {oppClub.style.formation} with {oppClub.style.mentality.toLowerCase()}{' '}
                  mentality. Watch for their direct counters.
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button variant="secondary" size="m" onClick={() => setScreen('preMatch')}>
                    Opponent Report
                  </Button>
                  <Button variant="primary" size="m" onClick={() => setScreen('preMatch')}>
                    Go To Match
                  </Button>
                </div>
              </div>
            </Panel>

            {/* Assistant Tip Card */}
            <Panel title="ASSISTANT ADVICE" subtitle="THEO VANCE">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-m)',
                      backgroundColor: 'rgba(255, 91, 53, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-text)',
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={22} />
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                    {tiredCount > 2
                      ? `${tiredCount} first-team players are carrying fatigue. Consider rotation before kickoff.`
                      : 'The squad is well rested and in peak condition for the upcoming match.'}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="s"
                  onClick={() => {
                    setScreen('tactics');
                    showToast('Navigated to tactics board', 'info');
                  }}
                >
                  Inspect XI
                </Button>
              </div>
            </Panel>

            {/* Board & Fan Confidence Meters */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              <Panel title="BOARD CONFIDENCE">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    className="stat-number"
                    style={{
                      fontSize: '36px',
                      color: userClub.boardConfidence >= 60 ? 'var(--win)' : 'var(--warning)',
                    }}
                  >
                    <CountUp value={userClub.boardConfidence} />%
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <TrendingUp size={16} color="var(--win)" /> Stable
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'var(--surface-3)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${userClub.boardConfidence}%`,
                      height: '100%',
                      backgroundColor:
                        userClub.boardConfidence >= 60 ? 'var(--win)' : 'var(--warning)',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-dim)',
                    marginTop: '8px',
                  }}
                >
                  The board is pleased with current operational stability.
                </div>
              </Panel>

              <Panel title="FAN MOOD">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    className="stat-number"
                    style={{
                      fontSize: '36px',
                      color: userClub.fanMood >= 50 ? 'var(--win)' : 'var(--warning)',
                    }}
                  >
                    <CountUp value={userClub.fanMood} />%
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <TrendingUp size={16} color="var(--win)" /> Optimistic
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'var(--surface-3)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${userClub.fanMood}%`,
                      height: '100%',
                      backgroundColor: userClub.fanMood >= 50 ? 'var(--win)' : 'var(--warning)',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-dim)',
                    marginTop: '8px',
                  }}
                >
                  Supporters are eagerly anticipating the next fixture.
                </div>
              </Panel>
            </div>
          </div>

          {/* Right Column: League Snapshot & Squad Status & Inbox */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* League Snapshot Panel */}
            <Panel
              title="LEAGUE SNAPSHOT"
              headerAction={
                <button
                  onClick={() => setScreen('league')}
                  style={{
                    color: 'var(--accent-text)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  Full Table <ChevronRight size={14} />
                </button>
              }
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {snapshotRows.map((row) => {
                  const club = gameState.clubs[row.clubId];
                  if (!club) return null;
                  const isUser = row.clubId === userClub.id;
                  const rank = gameState.table.findIndex((r) => r.clubId === row.clubId) + 1;
                  return (
                    <div
                      key={row.clubId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-s)',
                        backgroundColor: isUser ? 'var(--surface-3)' : 'transparent',
                        borderLeft: isUser ? '3px solid var(--accent)' : '3px solid transparent',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span
                          className="tabular-nums"
                          style={{
                            fontWeight: 700,
                            width: '18px',
                            color:
                              rank === 1
                                ? 'var(--gold)'
                                : isUser
                                  ? 'var(--accent-text)'
                                  : 'var(--text-dim)',
                          }}
                        >
                          {rank}
                        </span>
                        <Crest
                          clubId={club.id}
                          code={club.code}
                          primaryColor={club.colors.primary}
                          secondaryColor={club.colors.secondary}
                          size={18}
                        />
                        <span
                          style={{
                            fontWeight: isUser ? 700 : 500,
                            fontSize: '13px',
                          }}
                        >
                          {club.shortName}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-dim)',
                          }}
                        >
                          {row.p}p
                        </span>
                        <span
                          className="stat-number tabular-nums"
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            width: '28px',
                            textAlign: 'right',
                          }}
                        >
                          {row.pts}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Squad Status Overview */}
            <Panel
              title="SQUAD STATUS"
              headerAction={
                <button
                  onClick={() => setScreen('squad')}
                  style={{
                    color: 'var(--accent-text)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  Manage Squad <ChevronRight size={14} />
                </button>
              }
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '12px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--danger)',
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span className="broadcast-label">Injuries</span>
                  </div>
                  <div className="stat-number" style={{ fontSize: '24px', marginTop: '4px' }}>
                    {injuredCount}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '12px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--warning)',
                    }}
                  >
                    <ShieldAlert size={16} />
                    <span className="broadcast-label">Banned</span>
                  </div>
                  <div className="stat-number" style={{ fontSize: '24px', marginTop: '4px' }}>
                    {suspendedCount}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '12px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <BatteryLow size={16} />
                    <span className="broadcast-label">Fatigued</span>
                  </div>
                  <div className="stat-number" style={{ fontSize: '24px', marginTop: '4px' }}>
                    {tiredCount}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    padding: '12px',
                    borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <HeartCrack size={16} />
                    <span className="broadcast-label">Unhappy</span>
                  </div>
                  <div className="stat-number" style={{ fontSize: '24px', marginTop: '4px' }}>
                    {unhappyCount}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Unread Inbox Snapshot */}
            <Panel
              title="INBOX DISPATCHES"
              headerAction={
                <button
                  onClick={() => setScreen('inbox')}
                  style={{
                    color: 'var(--accent-text)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  View All ({latestInbox.length}) <ChevronRight size={14} />
                </button>
              }
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {latestInbox.length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-dim)',
                      textAlign: 'center',
                      padding: '16px',
                    }}
                  >
                    No unread dispatches. All communications clear.
                  </div>
                ) : (
                  latestInbox.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => setScreen('inbox')}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--surface-2)',
                        borderRadius: 'var(--radius-s)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text)',
                          }}
                        >
                          {msg.title}
                        </span>
                        <span
                          className="broadcast-label"
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent-text)',
                          }}
                        >
                          MD {msg.matchday}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-dim)',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {msg.body}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* Broadcast Ticker Bar at bottom */}
      <Ticker items={tickerItems} />
    </div>
  );
};
