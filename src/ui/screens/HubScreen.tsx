// Implements SPEC §11.5 Hub screen (on-air broadcast world)
// Dominant Next Match panel + League table (10 clubs) + Latest News (newspaper) + Inbox
// Squad status (2x2 compact counters) + Board & fans meters + Assistant tip with telestrator
// Layout and craft bar matching docs/design/hub/index.html & docs/design/REVIEW-M3.md
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { CountUp } from '../components/CountUp';
import { Ticker } from '../components/Ticker';
import { Modal } from '../components/Modal';
import { TelestratorPitch } from '../components/TelestratorPitch';
import { DisciplineIncidentModal } from '../components/DisciplineIncidentModal';
import { RushBackModal } from '../components/RushBackModal';
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
  Check,
  FileText,
  Award,
  MessageSquare,
} from 'lucide-react';
import { ClubId } from '../../core/types';

export const HubScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const setScreen = useStore((state) => state.setScreen);
  const showToast = useStore((state) => state.showToast);
  const updateUserTactics = useStore((state) => state.updateUserTactics);
  const openConversationModal = useStore((state) => state.openConversationModal);
  const resolveDisciplineDecision = useStore((state) => state.resolveDisciplineDecision);
  const resolveRushBackOffer = useStore((state) => state.resolveRushBackOffer);

  const [showOpponentReport, setShowOpponentReport] = useState(false);
  const [tipApplied, setTipApplied] = useState(false);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Next fixture determination
  const targetMD = gameState.matchday === 0 ? 1 : gameState.matchday;
  const nextFixture = gameState.fixtures.find(
    (f) => f.matchday === targetMD && (f.homeId === userClub.id || f.awayId === userClub.id),
  );

  const isHome = nextFixture ? nextFixture.homeId === userClub.id : true;
  const oppClubId: ClubId = nextFixture
    ? isHome
      ? nextFixture.awayId
      : nextFixture.homeId
    : (userClub.rivals[0] ?? 'c02');
  const oppClub = gameState.clubs[oppClubId] ?? Object.values(gameState.clubs)[0]!;

  const homeClub = isHome ? userClub : oppClub;
  const awayClub = isHome ? oppClub : userClub;

  // User table ranking & Opponent table ranking
  const userRankIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
  const oppRankIndex = gameState.table.findIndex((r) => r.clubId === oppClub.id);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 1;
  const oppRank = oppRankIndex >= 0 ? oppRankIndex + 1 : 2;
  const userRow = userRankIndex >= 0 ? gameState.table[userRankIndex] : null;

  const homeRank = isHome ? userRank : oppRank;
  const awayRank = isHome ? oppRank : userRank;

  const homeRow = gameState.table.find((r) => r.clubId === homeClub.id);
  const awayRow = gameState.table.find((r) => r.clubId === awayClub.id);

  // Squad status counters
  const squadPlayers = userClub.squad.map((id) => gameState.players[id]).filter((p) => p != null);
  const injuredCount = squadPlayers.filter((p) => p.injury !== null).length;
  const suspendedCount = squadPlayers.filter((p) => p.suspendedMatches > 0).length;
  const tiredCount = squadPlayers.filter((p) => p.condition < 75).length;
  const unhappyCount = squadPlayers.filter((p) => p.morale < 40).length;

  // Unread inbox items
  const latestInbox = gameState.inbox.filter((m) => !m.read).slice(0, 4);

  const weatherIcon =
    nextFixture?.weather === 'Rain' ? (
      <CloudRain size={16} />
    ) : nextFixture?.weather === 'Overcast' ? (
      <Cloud size={16} />
    ) : (
      <Sun size={16} />
    );

  // Theo's advice line based on opponent passing style
  const theoLine =
    oppClub.style?.passing === 'Direct'
      ? 'They go long early. Win the second balls and we’ll have the ball for most of the afternoon.'
      : oppClub.style?.passing === 'Short'
        ? 'They build slowly from the back. Press their centre-backs and they’ll give it away in good areas.'
        : 'They mix it up. Keep our shape for the first twenty minutes and let them show us what they want.';

  // Newspaper story headline & text
  const newsHeadline =
    userRank === 1
      ? `TOP OF THE PILE, AND ${oppClub.city.toUpperCase()} NEXT`
      : userRank <= 3
        ? `${userClub.city.toUpperCase()} CLOSE IN ON THE MERIDIAN SUMMIT`
        : `${userClub.city.toUpperCase()} SEEK DECISIVE RESPONSE AGAINST ${oppClub.city.toUpperCase()}`;

  const newsStandfirst = `${oppClub.name} ${
    isHome
      ? 'come to ' + userClub.stadium.name
      : 'host ' + userClub.name + ' at ' + oppClub.stadium.name
  } for Matchday ${gameState.matchday}. ${userClub.city} sit ${userRank}${
    userRank === 1 ? 'st' : userRank === 2 ? 'nd' : userRank === 3 ? 'rd' : 'th'
  } with ${userRow?.pts ?? 0} points, seeking a signature performance on air.`;

  // Ticker items without repeating on-screen panels (REVIEW Minor)
  const tickerItems = [
    `Meridian League · Matchday ${gameState.matchday} fixtures kick off Saturday 15:00`,
    `Injury Report: Veldmoor Town goalkeeper Ruud Brandt sidelined for three weeks with shoulder strain`,
    `Transfer Rumour: Corvallen Wanderers tracking Northgate Albion winger Ola Sandvik`,
    `Broadcast: Live cameras stationed at ${isHome ? userClub.stadium.name : oppClub.stadium.name} for ${userClub.name} vs ${oppClub.name}`,
    `Derby Notice: Lindenfield FC and Corvallen Wanderers prepare for upcoming Little Derby clash`,
  ];

  const handleApplyTip = () => {
    setTipApplied(true);
    updateUserTactics({
      instructions: {
        ...userClub.tactics.instructions,
        pressing: 'Mid',
        line: 'Normal',
      },
    });
    showToast('Applied assistant advice for upcoming fixture', 'success');
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
        {/* Knock at the Door Office Conversation Banner (§12.9, §14.11.3) */}
        {gameState.activeConversation && (
          <div
            style={{
              backgroundColor: 'var(--surface-elevated, #161b22)',
              border: '1px solid var(--border-subtle, #30363d)',
              borderLeft: '4px solid var(--accent, #3b82f6)',
              borderRadius: '4px',
              padding: '12px 18px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MessageSquare size={20} style={{ color: 'var(--accent, #3b82f6)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                  Knock at the Office Door ·{' '}
                  {gameState.players[gameState.activeConversation.playerId]?.knownAs ??
                    gameState.players[gameState.activeConversation.playerId]?.lastName}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  "{gameState.activeConversation.opening.text}"
                </div>
              </div>
            </div>
            <Button variant="primary" size="s" onClick={openConversationModal}>
              Speak with Player <ChevronRight size={14} />
            </Button>
          </div>
        )}

        <div className="hub-grid">
          {/* =========================================================================
              ROW 1: Dominant Next Match Graphic (Full Width 1/-1)
              ========================================================================= */}
          <section className="p-next next-match-card" aria-label="Next match">
            {/* Header tab */}
            <div className="nx-tab">
              <span className="nx-tab-badge">Next match</span>
              <span className="nx-tab-meta">
                Matchday {gameState.matchday} of 18 · Meridian League
              </span>
            </div>

            {/* Matchup Body with Skewed Kit Slabs */}
            <div
              className="vs-banner"
              style={
                {
                  '--h1': homeClub.colors.primary,
                  '--h2': homeClub.colors.secondary,
                  '--a1': awayClub.colors.primary,
                  '--a2': awayClub.colors.secondary,
                } as React.CSSProperties
              }
            >
              {/* Home Team */}
              <div className="side-team">
                <Crest
                  clubId={homeClub.id}
                  code={homeClub.code}
                  primaryColor={homeClub.colors.primary}
                  secondaryColor={homeClub.colors.secondary}
                  size={58}
                />
                <h2 className="side-team-name">{homeClub.name}</h2>
                <div className="side-team-sub">
                  <b>{homeRank}th Place</b> · {homeRow?.pts ?? 0} pts
                  {isHome && (
                    <span style={{ color: 'var(--accent-text)', marginLeft: '6px' }}>
                      · Your club
                    </span>
                  )}
                </div>
                <div className="form-strip" aria-label="Recent form">
                  {(homeRow?.form ?? []).length === 0 ? (
                    <span style={{ color: 'var(--text-faint)', fontSize: '13px' }}>—</span>
                  ) : (
                    (homeRow?.form ?? []).slice(-5).map((res, i) => (
                      <span key={i} className={`form-dot ${res}`}>
                        {res}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Middle Kickoff & Venue Info */}
              <div className="mid-match-info">
                <div className="mid-day">SATURDAY · MD {gameState.matchday}</div>
                <div className="mid-kickoff">
                  {nextFixture?.kickoff === 'Afternoon'
                    ? '15:00'
                    : nextFixture?.kickoff === 'Evening'
                      ? '17:30'
                      : '19:45'}
                </div>
                <div className="mid-venue">{homeClub.stadium.name}</div>
                <div className="mid-weather">
                  {weatherIcon}
                  <span>{nextFixture?.weather ?? 'Clear'} · 9°C</span>
                </div>
              </div>

              {/* Away Team */}
              <div className="side-team away">
                <Crest
                  clubId={awayClub.id}
                  code={awayClub.code}
                  primaryColor={awayClub.colors.primary}
                  secondaryColor={awayClub.colors.secondary}
                  size={58}
                />
                <h2 className="side-team-name">{awayClub.name}</h2>
                <div className="side-team-sub">
                  <b>{awayRank}th Place</b> · {awayRow?.pts ?? 0} pts
                  {!isHome && (
                    <span style={{ color: 'var(--accent-text)', marginLeft: '6px' }}>
                      · Your club
                    </span>
                  )}
                </div>
                <div className="form-strip" aria-label="Recent form">
                  {(awayRow?.form ?? []).length === 0 ? (
                    <span style={{ color: 'var(--text-faint)', fontSize: '13px' }}>—</span>
                  ) : (
                    (awayRow?.form ?? []).slice(-5).map((res, i) => (
                      <span key={i} className={`form-dot ${res}`}>
                        {res}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Foot Row: Theo Vance quote & Opponent report button */}
            <div className="nx-foot">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-s)',
                  backgroundColor: 'var(--surface-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-text)',
                  flexShrink: 0,
                  border: '1px solid var(--border)',
                }}
              >
                <Award size={22} />
              </div>
              <div className="theo-quote">
                <span className="theo-quote-who">Theo Vance · Assistant Manager</span>"{theoLine}"
              </div>
              <Button
                variant="secondary"
                size="m"
                icon={<FileText size={16} />}
                onClick={() => setShowOpponentReport(true)}
              >
                Opponent Report
              </Button>
            </div>
          </section>

          {/* =========================================================================
              ROW 2: League Table (4 cols), Latest News (5 cols), Inbox (3 cols)
              ========================================================================= */}
          {/* League Table (4 cols) */}
          <section className="p-table" style={{ display: 'flex', flexDirection: 'column' }}>
            <Panel
              title="MERIDIAN LEAGUE"
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
                    cursor: 'pointer',
                  }}
                >
                  Full Table <ChevronRight size={14} />
                </button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div
                  className="broadcast-label"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 14px minmax(0, 1fr) 28px 36px 32px',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 6px 6px',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text-faint)',
                    fontSize: '11px',
                  }}
                >
                  <span>#</span>
                  <span></span>
                  <span>CLUB</span>
                  <span style={{ textAlign: 'center' }}>P</span>
                  <span style={{ textAlign: 'center' }}>GD</span>
                  <span style={{ textAlign: 'right' }}>PTS</span>
                </div>

                {gameState.table.map((row, idx) => {
                  const club = gameState.clubs[row.clubId];
                  if (!club) return null;
                  const isUser = row.clubId === userClub.id;
                  const rank = idx + 1;

                  return (
                    <div
                      key={row.clubId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 14px minmax(0, 1fr) 28px 36px 32px',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 6px',
                        borderRadius: 'var(--radius-s)',
                        backgroundColor: isUser ? 'rgba(255, 91, 53, 0.12)' : 'transparent',
                        borderLeft: isUser ? '3px solid var(--accent)' : '3px solid transparent',
                        fontSize: '13px',
                      }}
                    >
                      <span
                        className="tabular-nums"
                        style={{
                          fontWeight: 700,
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

                      {/* Kit Stripe */}
                      <span
                        style={{
                          width: '8px',
                          height: '16px',
                          transform: 'skewX(-12deg)',
                          background: `linear-gradient(90deg, ${club.colors.primary} 0 55%, ${club.colors.secondary} 55% 100%)`,
                          display: 'inline-block',
                        }}
                      />

                      <span
                        style={{
                          fontWeight: isUser ? 700 : 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: isUser ? 'var(--text)' : 'var(--text-dim)',
                        }}
                      >
                        {club.shortName}
                      </span>

                      <span
                        className="tabular-nums"
                        style={{ textAlign: 'center', color: 'var(--text-faint)' }}
                      >
                        {row.p}
                      </span>

                      <span
                        className="tabular-nums"
                        style={{
                          textAlign: 'center',
                          fontWeight: 500,
                          color:
                            row.gd > 0
                              ? 'var(--win)'
                              : row.gd < 0
                                ? 'var(--loss)'
                                : 'var(--text-faint)',
                        }}
                      >
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </span>

                      <span
                        className="stat-number tabular-nums"
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isUser ? 'var(--accent-text)' : 'var(--text)',
                        }}
                      >
                        {row.pts}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </section>

          {/* Latest News (5 cols - Newspaper Panel §19.8) */}
          <section className="p-news" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="newspaper-panel" style={{ flex: 1 }}>
              <div className="newspaper-masthead">
                <span>The Saltmere Echo</span>
                <span style={{ fontSize: '11px', textTransform: 'none', color: '#555' }}>
                  Matchday {gameState.matchday} Edition
                </span>
              </div>

              {/* Halftoned Pitch Scene Canvas / Representation */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  backgroundColor: '#ded7c8',
                  borderRadius: '2px',
                  border: '1px solid #c7beab',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.25,
                    backgroundImage: 'radial-gradient(#141414 1.5px, transparent 1.5px)',
                    backgroundSize: '6px 6px',
                  }}
                />
                <div
                  style={{
                    zIndex: 1,
                    textAlign: 'center',
                    padding: '16px',
                    color: '#222',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '16px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isHome ? userClub.stadium.name : oppClub.stadium.name}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#444' }}>
                    Matchday {gameState.matchday} Focus · {userClub.name} vs {oppClub.name}
                  </div>
                </div>
              </div>

              <h3 className="newspaper-headline">{newsHeadline}</h3>
              <p className="newspaper-standfirst">{newsStandfirst}</p>
              <div className="newspaper-byline">
                Joe Kettering · Meridian Football Correspondent
              </div>
            </div>
          </section>

          {/* Inbox (3 cols) */}
          <section className="p-inbox" style={{ display: 'flex', flexDirection: 'column' }}>
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
                    cursor: 'pointer',
                  }}
                >
                  View All ({latestInbox.length}) <ChevronRight size={14} />
                </button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {latestInbox.length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-dim)',
                      textAlign: 'center',
                      padding: '24px 12px',
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
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        transition: 'background var(--dur-fast)',
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
                            fontSize: '10px',
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
          </section>

          {/* =========================================================================
              ROW 3: Squad Status (3 cols), Board & Fans (4 cols), Assistant Tip (5 cols)
              ========================================================================= */}
          {/* Squad Status (3 cols, M1: 2x2 compact counters, 0 dim) */}
          <section className="p-squad" style={{ display: 'flex', flexDirection: 'column' }}>
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
                    cursor: 'pointer',
                  }}
                >
                  Manage <ChevronRight size={14} />
                </button>
              }
            >
              <div className="squad-2x2-grid">
                <button
                  className={`sq-cell ${injuredCount > 0 ? 'bad' : 'zero'}`}
                  onClick={() => setScreen('squad')}
                >
                  <span className="sq-cell-val">{injuredCount > 0 ? injuredCount : 'None'}</span>
                  <span className="sq-cell-label">Injured</span>
                </button>

                <button
                  className={`sq-cell ${suspendedCount > 0 ? 'bad' : 'zero'}`}
                  onClick={() => setScreen('squad')}
                >
                  <span className="sq-cell-val">
                    {suspendedCount > 0 ? suspendedCount : 'None'}
                  </span>
                  <span className="sq-cell-label">Suspended</span>
                </button>

                <button
                  className={`sq-cell ${tiredCount > 0 ? 'warn' : 'zero'}`}
                  onClick={() => setScreen('squad')}
                >
                  <span className="sq-cell-val">{tiredCount > 0 ? tiredCount : 'None'}</span>
                  <span className="sq-cell-label">Tired (Below 75%)</span>
                </button>

                <button
                  className={`sq-cell ${unhappyCount > 0 ? 'warn' : 'zero'}`}
                  onClick={() => setScreen('squad')}
                >
                  <span className="sq-cell-val">{unhappyCount > 0 ? unhappyCount : 'None'}</span>
                  <span className="sq-cell-label">Low Morale</span>
                </button>
              </div>
            </Panel>
          </section>

          {/* Board & Fans (4 cols) */}
          <section className="p-board" style={{ display: 'flex', flexDirection: 'column' }}>
            <Panel title="BOARD AND FANS">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Board Confidence */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      className="broadcast-label"
                      style={{ color: 'var(--text-dim)', fontSize: '12px' }}
                    >
                      BOARD CONFIDENCE
                    </span>
                    <span
                      className="stat-number tabular-nums"
                      style={{
                        fontSize: '26px',
                        fontWeight: 700,
                        color: userClub.boardConfidence >= 60 ? 'var(--win)' : 'var(--warning)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <CountUp value={userClub.boardConfidence} />%
                      <span style={{ fontSize: '14px', color: 'var(--win)' }}>▲</span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--surface-3)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      position: 'relative',
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
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    {userClub.boardConfidence >= 60
                      ? 'The board is pleased with current progress and financial discipline.'
                      : 'The board expects improved consistency on the pitch.'}
                  </div>
                </div>

                {/* Fan Mood */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      className="broadcast-label"
                      style={{ color: 'var(--text-dim)', fontSize: '12px' }}
                    >
                      FAN MOOD
                    </span>
                    <span
                      className="stat-number tabular-nums"
                      style={{
                        fontSize: '26px',
                        fontWeight: 700,
                        color: userClub.fanMood >= 55 ? 'var(--win)' : 'var(--warning)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <CountUp value={userClub.fanMood} />%
                      <span style={{ fontSize: '14px', color: 'var(--text-faint)' }}>–</span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--surface-3)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${userClub.fanMood}%`,
                        height: '100%',
                        backgroundColor: userClub.fanMood >= 55 ? 'var(--win)' : 'var(--warning)',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    {userClub.fanMood >= 65
                      ? 'Supporters are optimistic and energised for the match ahead.'
                      : 'Fans want to see positive tactical intent from the opening whistle.'}
                  </div>
                </div>
              </div>
            </Panel>
          </section>

          {/* Assistant Tip (5 cols) */}
          <section className="p-tip" style={{ display: 'flex', flexDirection: 'column' }}>
            <Panel title="FROM THE ASSISTANT · THEO VANCE">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  gap: '14px',
                }}
              >
                <div style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text)' }}>
                  {oppClub.style?.passing === 'Direct' ? (
                    <>
                      {oppClub.name} deploy a direct passing approach and rely heavily on long
                      diagonals. Setting our pressing to <b>Mid Block</b> and maintaining compact
                      line distance will limit their second ball wins.
                    </>
                  ) : (
                    <>
                      {tiredCount > 2 ? (
                        <>
                          We have <b>{tiredCount} first-team regulars carrying fatigue</b>. Rotating
                          the squad slightly ahead of kickoff will prevent late-game dropoffs and
                          muscular injury risk.
                        </>
                      ) : (
                        <>
                          The squad is in peak physical readiness. Setting our line to <b>Normal</b>{' '}
                          with disciplined zonal responsibilities will stifle their forward
                          transitions.
                        </>
                      )}
                    </>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginTop: 'auto',
                  }}
                >
                  {tipApplied ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--win)',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      <Check size={16} /> Applied to match tactics
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="m"
                      icon={<Check size={16} />}
                      onClick={handleApplyTip}
                    >
                      Apply
                    </Button>
                  )}

                  <Button variant="ghost" size="m" onClick={() => setScreen('tactics')}>
                    See Tactics Board <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </Panel>
          </section>
        </div>
      </div>

      {/* Opponent Report Broadcast Modal */}
      {showOpponentReport && (
        <Modal
          title={`OPPONENT TACTICAL REPORT · ${oppClub.name.toUpperCase()}`}
          isOpen={showOpponentReport}
          onClose={() => setShowOpponentReport(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '14px',
              }}
            >
              <Crest
                clubId={oppClub.id}
                code={oppClub.code}
                primaryColor={oppClub.colors.primary}
                secondaryColor={oppClub.colors.secondary}
                size={54}
              />
              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-head)', margin: 0 }}>
                  {oppClub.name}
                </h2>
                <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                  Manager: {oppClub.managerName} · Shape: {oppClub.style.formation} · Passing:{' '}
                  {oppClub.style.passing}
                </div>
              </div>
            </div>

            {/* Telestrator diagram inside modal */}
            <TelestratorPitch oppClub={oppClub} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--surface-2)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--accent-text)', fontSize: '11px', marginBottom: '4px' }}
                >
                  IDENTIFIED THREAT
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                  Swift forward deliveries exploiting the flanks. Backline must maintain disciplined
                  communication on aerial crosses.
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--surface-2)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--win)', fontSize: '11px', marginBottom: '4px' }}
                >
                  KEY COUNTER-TACTIC
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                  Mid-block pressing to contest transitional second balls. Avoid over-committing the
                  defensive line too high.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button variant="primary" size="m" onClick={() => setShowOpponentReport(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Disciplinary Incident Modal (§12.20) */}
      {gameState.activeIncident && !gameState.activeIncident.resolved && (
        <DisciplineIncidentModal
          incident={gameState.activeIncident}
          players={gameState.players}
          onChoice={resolveDisciplineDecision}
        />
      )}

      {/* Rushing Player Back Modal (§12.19.2) */}
      {gameState.pendingRushBack &&
        !gameState.pendingRushBack.resolved &&
        gameState.players[gameState.pendingRushBack.playerId] && (
          <RushBackModal
            player={gameState.players[gameState.pendingRushBack.playerId]!}
            onChoice={resolveRushBackOffer}
          />
        )}

      {/* Broadcast Ticker Bar at bottom */}
      <Ticker items={tickerItems} />
    </div>
  );
};
