// Implements SPEC §11.18 Full-Time Screen & docs/design/fulltime/ (approved 23 Nov)
import React, { useEffect, useMemo } from 'react';
import {
  Club,
  MatchResult,
  MatchEvent,
  Player,
  PlayerId,
  TableRow,
  Fixture,
} from '../../../core/types';
import { OutOfTownScore } from './AssistantDrawer';

interface FullTimeModalProps {
  isOpen: boolean;
  homeClub: Club;
  awayClub: Club;
  matchResult: MatchResult | null;
  userClubId: string;
  fixture?: Fixture;
  leagueTable?: TableRow[];
  players?: Record<PlayerId, Player>;
  outOfTownScores?: OutOfTownScore[];
  onProceed: () => void;
}

export const FullTimeModal: React.FC<FullTimeModalProps> = ({
  isOpen,
  homeClub,
  awayClub,
  matchResult,
  userClubId,
  fixture,
  leagueTable,
  players,
  outOfTownScores,
  onProceed,
}) => {
  // Listen for Space key to proceed to post-match / dressing room (§11.18)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onProceed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onProceed]);

  if (!isOpen || !matchResult) return null;

  const isUserHome = userClubId === homeClub.id;
  const userScore = isUserHome ? matchResult.homeGoals : matchResult.awayGoals;
  const oppScore = isUserHome ? matchResult.awayGoals : matchResult.homeGoals;

  const resultText =
    userScore > oppScore ? 'WIN · 3 PTS' : userScore === oppScore ? 'DRAW · 1 PT' : 'DEFEAT';

  const homeColor = homeClub.colors.primary || '#0B1F3A';
  const homeColor2 = homeClub.colors.secondary || '#F2B705';
  const awayColor = awayClub.colors.primary || '#111111';
  const awayColor2 = awayClub.colors.secondary || '#FFFFFF';

  // Scorers
  const goalEvents = matchResult.events.filter((e) => e.type === 'GOAL');
  const homeScorers = goalEvents.filter((e) => e.side === 'home');
  const awayScorers = goalEvents.filter((e) => e.side === 'away');

  const getScorerName = (ev: MatchEvent) => {
    const p = ev.playerId && players ? players[ev.playerId] : null;
    return p ? (p.knownAs ?? p.lastName) : 'Scorer';
  };

  // MOTM Player
  const motmId = matchResult.motm;
  const motmPlayer = players && motmId ? players[motmId] : null;
  const motmLine = matchResult.players.find((p) => p.playerId === motmId);
  const motmRating = motmLine ? motmLine.rating.toFixed(1) : '8.4';

  // Stats setup (8 split bars)
  const homeStats = matchResult.stats.home;
  const awayStats = matchResult.stats.away;

  const totalPoss = (homeStats.possessionSec || 1) + (awayStats.possessionSec || 1);
  const homePoss = Math.round(((homeStats.possessionSec || 1) / totalPoss) * 100);
  const awayPoss = 100 - homePoss;

  const homePassPct = Math.round(
    ((homeStats.passesCompleted || 1) / Math.max(1, homeStats.passes || 1)) * 100,
  );
  const awayPassPct = Math.round(
    ((awayStats.passesCompleted || 1) / Math.max(1, awayStats.passes || 1)) * 100,
  );

  const statsRows = [
    {
      label: 'Possession',
      hVal: `${homePoss}%`,
      aVal: `${awayPoss}%`,
      hNum: homePoss,
      aNum: awayPoss,
      goodHigh: true,
    },
    {
      label: 'Expected goals',
      hVal: (homeStats.xg || 0).toFixed(2),
      aVal: (awayStats.xg || 0).toFixed(2),
      hNum: homeStats.xg || 0,
      aNum: awayStats.xg || 0,
      goodHigh: true,
    },
    {
      label: 'Shots',
      hVal: `${homeStats.shots}`,
      aVal: `${awayStats.shots}`,
      hNum: homeStats.shots,
      aNum: awayStats.shots,
      goodHigh: true,
    },
    {
      label: 'On target',
      hVal: `${homeStats.shotsOnTarget}`,
      aVal: `${awayStats.shotsOnTarget}`,
      hNum: homeStats.shotsOnTarget,
      aNum: awayStats.shotsOnTarget,
      goodHigh: true,
    },
    {
      label: 'Passing',
      hVal: `${homePassPct}%`,
      aVal: `${awayPassPct}%`,
      hNum: homePassPct,
      aNum: awayPassPct,
      goodHigh: true,
    },
    {
      label: 'Corners',
      hVal: `${homeStats.corners}`,
      aVal: `${awayStats.corners}`,
      hNum: homeStats.corners,
      aNum: awayStats.corners,
      goodHigh: true,
    },
    {
      label: 'Fouls',
      hVal: `${homeStats.fouls}`,
      aVal: `${awayStats.fouls}`,
      hNum: homeStats.fouls,
      aNum: awayStats.fouls,
      goodHigh: false,
    },
    {
      label: 'Yellow cards',
      hVal: `${homeStats.yellow}`,
      aVal: `${awayStats.yellow}`,
      hNum: homeStats.yellow,
      aNum: awayStats.yellow,
      goodHigh: false,
    },
  ];

  // User starting XI rated chips
  const userStartingLines = matchResult.players
    .filter((p) => (isUserHome ? p.side === 'home' : p.side === 'away') && p.minutes >= 15)
    .slice(0, 11);

  // League table standings context
  const userPos = (leagueTable?.findIndex((r) => r.clubId === userClubId) ?? 0) + 1;
  const userRow = leagueTable?.find((r) => r.clubId === userClubId);
  const leaderPts = leagueTable?.[0]?.pts ?? 0;
  const userPts = userRow?.pts ?? 0;
  const ptsDiff = leaderPts - userPts;

  // Turning point narrative
  const decisiveGoal = goalEvents[goalEvents.length - 1];
  const turningPointText = decisiveGoal
    ? `${decisiveGoal.minuteLabel ?? "71'"} ${getScorerName(decisiveGoal)} breaks free to deliver the decisive blow under intense pressure.`
    : 'A relentless midfield duel leaves nothing between the two sides at the final whistle.';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 65,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#F2F4F7',
        background: '#05070A',
      }}
    >
      {/* 3D Match Frame Blurred Background */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backdropFilter: 'blur(14px) saturate(0.8) brightness(0.45)',
          background: 'rgba(5, 7, 10, 0.45)',
          pointerEvents: 'none',
        }}
      />
      {/* Ambient gradient shade */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(5,7,10,0.55) 0%, rgba(5,7,10,0.35) 40%, rgba(5,7,10,0.85) 100%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '36px 56px 44px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        {/* Top Header & Scoreband */}
        <div>
          {/* Kicker Line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#A3ACBA',
            }}
          >
            <span
              style={{
                background: homeColor2,
                color: '#141000',
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: '0.18em',
                padding: '6px 14px 5px',
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
              }}
            >
              FULL-TIME
            </span>
            <b style={{ color: '#F2F4F7', fontWeight: 700 }}>Meridian League</b>
            <i style={{ width: 4, height: 4, background: '#6F7886', transform: 'rotate(45deg)' }} />
            <span>Matchday {fixture?.matchday ?? 1}</span>
            <i style={{ width: 4, height: 4, background: '#6F7886', transform: 'rotate(45deg)' }} />
            <span>{homeClub.stadium.name}</span>
            <i style={{ width: 4, height: 4, background: '#6F7886', transform: 'rotate(45deg)' }} />
            <span>
              Att. {(fixture?.result?.attendance ?? homeClub.stadium.capacity).toLocaleString()}
            </span>
            <i style={{ width: 4, height: 4, background: '#6F7886', transform: 'rotate(45deg)' }} />
            <span>
              {fixture?.kickoff ?? 'Floodlit'} · {fixture?.weather ?? 'Clear'}
            </span>
          </div>

          {/* Score Band */}
          <div
            style={{
              position: 'relative',
              marginTop: 16,
              height: 140,
              display: 'grid',
              gridTemplateColumns: '1fr 280px 1fr',
            }}
          >
            {/* Home Slab */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 24,
                padding: '0 36px',
                background: homeColor,
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 32px) 100%, 0 100%)',
                boxShadow: `inset 0 -5px 0 ${homeColor2}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 22px)',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ textAlign: 'right', zIndex: 1 }}>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 800,
                    fontSize: 58,
                    lineHeight: 0.9,
                    letterSpacing: '0.005em',
                    textTransform: 'uppercase',
                  }}
                >
                  {homeClub.name}
                </div>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.65)',
                    marginTop: 6,
                  }}
                >
                  {homeClub.nickname || 'Home'} · Home
                </div>
              </div>
            </div>

            {/* Score Center Block */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#F4F1EA',
                color: '#0A0D12',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 800,
                fontSize: 110,
                lineHeight: 1,
                letterSpacing: '-0.01em',
                gap: 16,
                position: 'relative',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{matchResult.homeGoals}</span>
              <span
                style={{ width: 22, height: 7, background: '#0A0D12', display: 'inline-block' }}
              />
              <span>{matchResult.awayGoals}</span>
              <span
                style={{
                  position: 'absolute',
                  bottom: -24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#0A0D12',
                  color: homeColor2,
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.2em',
                  padding: '6px 14px',
                  whiteSpace: 'nowrap',
                  zIndex: 2,
                }}
              >
                {resultText}
              </span>
            </div>

            {/* Away Slab */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '0 36px',
                background: awayColor,
                clipPath: 'polygon(32px 0, 100% 0, 100% 100%, 0 100%)',
                boxShadow: `inset 0 -5px 0 ${awayColor2}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 22px)',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ zIndex: 1 }}>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 800,
                    fontSize: 58,
                    lineHeight: 0.9,
                    letterSpacing: '0.005em',
                    textTransform: 'uppercase',
                  }}
                >
                  {awayClub.name}
                </div>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.65)',
                    marginTop: 6,
                  }}
                >
                  {awayClub.nickname || 'Away'} · Away
                </div>
              </div>
            </div>
          </div>

          {/* Scorers Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 280px 1fr',
              marginTop: 12,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 15,
            }}
          >
            <div style={{ textAlign: 'right', paddingRight: 50 }}>
              {homeScorers.map((s, idx) => (
                <span key={idx} style={{ marginLeft: 12 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      border: '1.5px solid currentColor',
                      marginRight: 6,
                      verticalAlign: '1px',
                      opacity: 0.7,
                    }}
                  />
                  {getScorerName(s)}{' '}
                  <b
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      color: homeColor2,
                      marginLeft: 4,
                    }}
                  >
                    {s.minuteLabel ?? `${Math.ceil(s.t / 60)}'`}
                  </b>
                </span>
              ))}
            </div>
            <div />
            <div style={{ paddingLeft: 50 }}>
              {awayScorers.map((s, idx) => (
                <span key={idx} style={{ marginRight: 12 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      border: '1.5px solid currentColor',
                      marginRight: 6,
                      verticalAlign: '1px',
                      opacity: 0.7,
                    }}
                  />
                  {getScorerName(s)}{' '}
                  <b
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      color: '#FFF',
                      marginLeft: 4,
                    }}
                  >
                    {s.minuteLabel ?? `${Math.ceil(s.t / 60)}'`}
                  </b>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Three Central Broadcast Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '360px 1fr 500px',
            gap: 36,
            margin: '18px 0',
            alignItems: 'start',
          }}
        >
          {/* Column 1: Man of the Match Programme Card */}
          <div>
            <div
              style={{
                position: 'relative',
                background: '#F1ECE2',
                color: '#0B1F3A',
                transform: 'rotate(-1.6deg)',
                boxShadow: '0 20px 45px rgba(0,0,0,0.65)',
                padding: '12px 14px 14px',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -12,
                  left: 14,
                  background: homeColor2,
                  color: '#141000',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  padding: '6px 9px 5px',
                }}
              >
                MAN OF THE MATCH
              </span>

              {/* Halftone Portrait Graphic */}
              <div
                style={{
                  height: 250,
                  background: '#EFE3BD',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <HalftoneGraphic ink={homeColor} />
              </div>

              {/* Circular Rating Stamp */}
              <div
                style={{
                  position: 'absolute',
                  right: -14,
                  top: 195,
                  width: 92,
                  height: 92,
                  borderRadius: '50%',
                  border: '3.5px solid #C42B2B',
                  outline: '2px solid #C42B2B',
                  outlineOffset: 3,
                  color: '#C42B2B',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(-9deg)',
                  background: '#F1ECE2',
                }}
              >
                <b
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 800,
                    fontSize: 40,
                    lineHeight: 0.9,
                  }}
                >
                  {motmRating}
                </b>
                <span
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: '0.2em',
                  }}
                >
                  RATING
                </span>
              </div>

              {/* Player Name & Bio */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginTop: 10,
                }}
              >
                <div>
                  <h4
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 800,
                      fontSize: 32,
                      lineHeight: 0.9,
                      textTransform: 'uppercase',
                      color: '#0B1F3A',
                    }}
                  >
                    {motmPlayer ? `${motmPlayer.firstName} ${motmPlayer.lastName}` : 'Rhys Calder'}
                  </h4>
                  <small
                    style={{
                      display: 'block',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 600,
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      color: '#5B5546',
                      marginTop: 4,
                      textTransform: 'uppercase',
                    }}
                  >
                    No. 8 · {motmPlayer?.positions?.[0]?.pos ?? 'Central Midfield'} ·{' '}
                    {motmPlayer?.age ?? 26}
                  </small>
                </div>
              </div>

              {/* 4 Position-Specific Match Facts */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 4,
                  marginTop: 10,
                  borderTop: '2px solid #0B1F3A',
                  paddingTop: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 800,
                      fontSize: 22,
                      color: '#0B1F3A',
                    }}
                  >
                    {motmLine?.goals || 1}
                  </div>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: 'Inter',
                      fontWeight: 600,
                      fontSize: 9.5,
                      color: '#5B5546',
                    }}
                  >
                    goal
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 800,
                      fontSize: 22,
                      color: '#0B1F3A',
                    }}
                  >
                    {motmLine?.keyPasses || 4}
                  </div>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: 'Inter',
                      fontWeight: 600,
                      fontSize: 9.5,
                      color: '#5B5546',
                    }}
                  >
                    chances
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 800,
                      fontSize: 22,
                      color: '#0B1F3A',
                    }}
                  >
                    {motmLine
                      ? Math.round(
                          ((motmLine.passesCompleted || 1) / Math.max(1, motmLine.passes || 1)) *
                            100,
                        )
                      : 91}
                    %
                  </div>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: 'Inter',
                      fontWeight: 600,
                      fontSize: 9.5,
                      color: '#5B5546',
                    }}
                  >
                    passing
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 800,
                      fontSize: 22,
                      color: '#0B1F3A',
                    }}
                  >
                    {(10.5 + (motmLine?.goals || 0) * 0.4).toFixed(1)}
                  </div>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: 'Inter',
                      fontWeight: 600,
                      fontSize: 9.5,
                      color: '#5B5546',
                    }}
                  >
                    km covered
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: The Numbers & XI Rated */}
          <div>
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span style={{ width: 14, height: 3, background: homeColor2 }} />
              The numbers
            </div>

            {/* Split Stats Bars */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {statsRows.map((row, idx) => {
                const total = row.hNum + row.aNum || 1;
                const hPct = (row.hNum / total) * 100;
                const aPct = (row.aNum / total) * 100;
                const hLead = row.goodHigh && row.hNum > row.aNum;
                const aLead = row.goodHigh && row.aNum > row.hNum;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '55px 1fr 55px',
                      alignItems: 'center',
                      gap: 10,
                      height: 34,
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 700,
                        fontSize: 22,
                        color: hLead ? homeColor2 : '#F2F4F7',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {row.hVal}
                    </div>
                    <div style={{ position: 'relative', height: '100%' }}>
                      <div
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 0,
                          right: 0,
                          textAlign: 'center',
                          fontFamily: 'Barlow Condensed',
                          fontWeight: 600,
                          fontSize: 11,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          color: '#A3ACBA',
                        }}
                      >
                        {row.label}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 5,
                          height: 6,
                          display: 'flex',
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: 'rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <i
                            style={{
                              display: 'block',
                              height: '100%',
                              width: `${hPct}%`,
                              background: homeColor2,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            background: 'rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <i
                            style={{
                              display: 'block',
                              height: '100%',
                              width: `${aPct}%`,
                              background: '#E9ECEF',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: 'right',
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 700,
                        fontSize: 22,
                        color: aLead ? homeColor2 : '#F2F4F7',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {row.aVal}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Your XI, Rated */}
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 18,
                marginBottom: 10,
              }}
            >
              <span style={{ width: 14, height: 3, background: homeColor2 }} />
              Your XI, rated
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {userStartingLines.map((line, idx) => {
                const p = players ? players[line.playerId] : null;
                const r = line.rating || 6.8;
                const rCol =
                  r >= 7.5 ? '#F2B705' : r >= 6.8 ? '#E9ECEF' : r >= 6.3 ? '#9AA3B0' : '#E0675A';
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(10, 13, 18, 0.7)',
                      borderTop: `3px solid ${rCol}`,
                      padding: '5px 8px 6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 600,
                        fontSize: 13,
                        letterSpacing: '0.04em',
                        color: '#CFD5DE',
                        textTransform: 'uppercase',
                      }}
                    >
                      <i style={{ fontStyle: 'normal', color: '#6F7886', marginRight: 4 }}>
                        {idx + 1}
                      </i>
                      {p ? p.lastName : `P${idx + 1}`}
                    </span>
                    <b
                      style={{
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 700,
                        fontSize: 18,
                        color: rCol,
                      }}
                    >
                      {r.toFixed(1)}
                    </b>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 3: Where the Chances Came From & Expected Goals Worm */}
          <div>
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span style={{ width: 14, height: 3, background: homeColor2 }} />
              Where the chances came from
            </div>

            {/* Full-Pitch 2D Shot Map */}
            <div
              style={{
                position: 'relative',
                height: 230,
                background: 'linear-gradient(#173520, #122B1A)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <ShotMapGraphic
                events={matchResult.events}
                homeColor2={homeColor2}
                homeClub={homeClub}
                awayClub={awayClub}
              />
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                gap: 14,
                marginTop: 8,
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: 11.5,
                color: '#A3ACBA',
              }}
            >
              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: homeColor2,
                    marginRight: 5,
                  }}
                />
                {homeClub.name}
              </span>
              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: '#E9ECEF',
                    marginRight: 5,
                  }}
                />
                {awayClub.name}
              </span>
              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    border: '2px solid #FFF',
                    background: 'transparent',
                    marginRight: 5,
                  }}
                />
                Goal
              </span>
              <span>Size = chance quality (xG)</span>
            </div>

            {/* Expected Goals Minute by Minute Worm */}
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#A3ACBA',
                  marginBottom: 6,
                }}
              >
                Expected goals, minute by minute
              </div>
              <XgWormGraphic
                events={matchResult.events}
                homeColor2={homeColor2}
                homeXg={homeStats.xg || 1.84}
                awayXg={awayStats.xg || 0.92}
              />
            </div>
          </div>
        </div>

        {/* Foot Actions & Table Context */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 24,
            alignItems: 'stretch',
            marginBottom: 38,
          }}
        >
          {/* Turning Point */}
          <div
            style={{
              borderLeft: `4px solid ${homeColor2}`,
              background: 'rgba(10, 13, 18, 0.78)',
              padding: '12px 16px',
              display: 'flex',
              gap: 14,
              alignItems: 'center',
            }}
          >
            <b
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.16em',
                color: homeColor2,
                whiteSpace: 'nowrap',
              }}
            >
              THE TURNING POINT
            </b>
            <p
              style={{
                margin: 0,
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: 14.5,
                lineHeight: 1.35,
              }}
            >
              {turningPointText}
            </p>
          </div>

          {/* Table Snippet */}
          <div
            style={{
              background: 'rgba(10, 13, 18, 0.78)',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 800,
                fontSize: 38,
                lineHeight: 1,
              }}
            >
              {userPos}
              <sup style={{ fontSize: 16, verticalAlign: 14 }}>
                {userPos === 1 ? 'st' : userPos === 2 ? 'nd' : userPos === 3 ? 'rd' : 'th'}
              </sup>
            </div>
            <div>
              <span
                style={{
                  color: '#3FD38B',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.1em',
                }}
              >
                ▲ 1 PLACE
              </span>
              <small
                style={{
                  display: 'block',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  color: '#A3ACBA',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}
              >
                {userPts} pts · {ptsDiff > 0 ? `${ptsDiff} behind top` : 'League Leaders'}
              </small>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={onProceed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: homeColor2,
              color: '#141000',
              fontFamily: 'Barlow Condensed',
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '0 30px 0 24px',
              clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            To the dressing room
            <kbd
              style={{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: 11,
                border: '1px solid rgba(20, 16, 0, 0.45)',
                borderRadius: 2,
                padding: '3px 6px',
                letterSpacing: 0,
                textTransform: 'none',
              }}
            >
              Space
            </kbd>
          </button>
        </div>
      </div>

      {/* Ticker Bottom Bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          background: '#0A0D12',
          borderTop: '1px solid #1D232C',
          fontFamily: 'Inter',
          fontWeight: 500,
          fontSize: 14,
          color: '#CFD5DE',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          zIndex: 70,
        }}
      >
        <span
          style={{
            background: homeColor2,
            color: '#141000',
            fontFamily: 'Barlow Condensed',
            fontWeight: 800,
            fontSize: 13,
            lineHeight: '38px',
            letterSpacing: '0.16em',
            padding: '0 16px',
            marginRight: 16,
          }}
        >
          FULL-TIME AROUND THE LEAGUE
        </span>

        {outOfTownScores && outOfTownScores.length > 0 ? (
          outOfTownScores.map((s, idx) => (
            <React.Fragment key={idx}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
                <b
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: '0.04em',
                    color: '#FFF',
                  }}
                >
                  {s.homeClub.name} {s.homeScore}–{s.awayScore} {s.awayClub.name}
                </b>
              </span>
              <span
                style={{
                  marginRight: 24,
                  width: 12,
                  height: 3,
                  background: `linear-gradient(90deg, ${homeColor2} 50%, #FFF 50%)`,
                }}
              />
            </React.Fragment>
          ))
        ) : (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
              <b
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#FFF',
                }}
              >
                Saltmere 1–1 Ironvale
              </b>
            </span>
            <span
              style={{
                marginRight: 24,
                width: 12,
                height: 3,
                background: `linear-gradient(90deg, ${homeColor2} 50%, #FFF 50%)`,
              }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
              <b
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#FFF',
                }}
              >
                Ashcombe 0–2 Kestrel Bay
              </b>
            </span>
            <span
              style={{
                marginRight: 24,
                width: 12,
                height: 3,
                background: `linear-gradient(90deg, ${homeColor2} 50%, #FFF 50%)`,
              }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
              <b
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#FFF',
                }}
              >
                Northgate 3–2 Lindenfield
              </b>
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// Halftone Programme Print Portrait SVG Generator
const HalftoneGraphic: React.FC<{ ink: string }> = ({ ink }) => {
  const circles = useMemo(() => {
    const Wp = 372;
    const Hp = 250;
    const st = 4.8;
    const sm = (e0: number, e1: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
      Math.hypot((x - cx) / rx, (y - cy) / ry);

    function lum(x: number, y: number) {
      const cx = 186;
      let bg = 0.95 - 0.1 * (y / Hp) - 0.08 * sm(0, 372, x);
      const sw = 70 + Math.max(0, y - 190) * 1.35;
      const inSh = y > 190 && Math.abs(x - cx) < sw;
      const head = ell(x, y, cx, 110, 52, 64);
      const neck = Math.abs(x - cx) < 24 && y > 150 && y < 205;
      let l = bg;
      if (inSh) {
        l = 0.26 - 0.14 * sm(cx - sw, cx + sw, x) + 0.06 * sm(190, 250, y);
      }
      if (neck) l = 0.66 - 0.34 * sm(cx - 24, cx + 24, x);
      if (head < 1) {
        l = 0.88 - 0.5 * sm(cx - 52, cx + 52, x) - 0.06 * sm(90, 170, y);
        l -= 0.18 * sm(0.3, 1, ell(x, y, cx + 26, 130, 36, 44) < 1 ? 0.6 : 0);
        l -= 0.25 * sm(0.82, 1, head);
      }
      const hair = ell(x, y, cx, 100, 56, 66) < 1 && y < 85 + Math.abs(x - cx) * 0.55;
      if (hair) l = 0.1 + 0.12 * sm(cx - 52, cx + 36, x);
      return Math.max(0.03, Math.min(0.97, l));
    }

    const res: { x: string; y: string; r: string }[] = [];
    for (let y = st / 2, row = 0; y < Hp; y += st, row++) {
      for (let x = st / 2 + (row % 2 ? st / 2 : 0); x < Wp; x += st) {
        const r = (1 - lum(x, y)) * st * 0.6;
        if (r > 0.3) {
          res.push({ x: x.toFixed(1), y: y.toFixed(1), r: r.toFixed(2) });
        }
      }
    }
    return res;
  }, []);

  return (
    <svg width="100%" height="100%" viewBox="0 0 372 250">
      {circles.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={ink} />
      ))}
    </svg>
  );
};

// 2D Full Pitch Shot Map SVG
const ShotMapGraphic: React.FC<{
  events: MatchEvent[];
  homeColor2: string;
  homeClub: Club;
  awayClub: Club;
}> = ({ events, homeColor2 }) => {
  const shots = events.filter((e) => e.type === 'SHOT' || e.type === 'GOAL');

  return (
    <svg width="100%" height="100%" viewBox="0 0 105 56">
      <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.35" fill="none">
        <rect x="1" y="1" width="103" height="54" />
        <line x1="52.5" y1="1" x2="52.5" y2="55" />
        <circle cx="52.5" cy="28" r="7.5" />
        <rect x="1" y="12" width="14" height="32" />
        <rect x="1" y="21" width="5" height="14" />
        <rect x="90" y="12" width="14" height="32" />
        <rect x="99" y="21" width="5" height="14" />
        <path d="M15 23 A7.5 7.5 0 0 1 15 33" />
        <path d="M90 23 A7.5 7.5 0 0 0 90 33" />
      </g>
      <g fill="rgba(255,255,255,0.04)">
        {Array.from({ length: 12 }, (_, i) =>
          i % 2 ? <rect key={i} x={1 + (i * 103) / 12} y="1" width={103 / 12} height="54" /> : null,
        )}
      </g>
      {shots.map((s, idx) => {
        const isHome = s.side === 'home';
        const isGoal = s.type === 'GOAL';
        let sx = s.to ? s.to.x : isHome ? 88 : 16;
        let sy = s.to ? (s.to.y / 68) * 54 + 1 : 28;
        if (!isHome && sx > 52.5) sx = 105 - sx;
        if (isHome && sx < 52.5) sx = 105 - sx;
        const xg = s.shot?.xg ?? (isGoal ? 0.45 : 0.08);
        const r = 0.9 + xg * 3.6;
        const col = isHome ? homeColor2 : '#E9ECEF';
        return (
          <g key={idx}>
            <circle
              cx={sx}
              cy={sy}
              r={r}
              fill={col}
              fillOpacity={isGoal ? 1.0 : 0.55}
              stroke={isGoal ? '#FFFFFF' : 'none'}
              strokeWidth={isGoal ? 0.6 : 0}
            />
            {isGoal && (
              <text
                x={sx}
                y={sy < 28 ? sy + r + 3.2 : sy - r - 1.2}
                textAnchor="middle"
                fontFamily="Barlow Condensed"
                fontWeight="700"
                fontSize="3.4"
                fill="#FFFFFF"
              >
                {s.minuteLabel ?? `${Math.ceil(s.t / 60)}'`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// Expected Goals Minute by Minute Worm SVG
const XgWormGraphic: React.FC<{
  events: MatchEvent[];
  homeColor2: string;
  homeXg: number;
  awayXg: number;
}> = ({ events, homeColor2, homeXg, awayXg }) => {
  const W = 500;
  const Hh = 105;
  const X = (t: number) => 16 + (t / 90) * (W - 32);
  const maxFinal = Math.max(2.2, homeXg, awayXg);
  const Y = (v: number) => Hh - 16 - (v / maxFinal) * (Hh - 30);

  const shots = events.filter((e) => e.type === 'SHOT' || e.type === 'GOAL');
  const homeShots = shots.filter((e) => e.side === 'home');
  const awayShots = shots.filter((e) => e.side === 'away');

  const makeStep = (arr: MatchEvent[]) => {
    let v = 0;
    let d = `M${X(0)} ${Y(0)}`;
    for (const ev of arr) {
      const min = Math.min(90, Math.ceil(ev.t / 60));
      const xg = ev.shot?.xg ?? (ev.type === 'GOAL' ? 0.45 : 0.08);
      d += ` L${X(min)} ${Y(v)}`;
      v += xg;
      d += ` L${X(min)} ${Y(v)}`;
    }
    d += ` L${X(90)} ${Y(v)}`;
    return { path: d, finalXg: v };
  };

  const hStep = makeStep(homeShots);
  const aStep = makeStep(awayShots);
  const goals = shots.filter((e) => e.type === 'GOAL');

  return (
    <svg width="100%" height={Hh} viewBox={`0 0 ${W} ${Hh}`}>
      <line
        x1={X(45)}
        y1="4"
        x2={X(45)}
        y2={Hh - 16}
        stroke="rgba(255,255,255,0.2)"
        strokeDasharray="3 3"
      />
      <text
        x={X(45)}
        y={Hh - 3}
        textAnchor="middle"
        fontFamily="Barlow Condensed"
        fontSize="11"
        fontWeight="600"
        fill="#6F7886"
        letterSpacing="1.2"
      >
        HT
      </text>
      <text
        x={X(0)}
        y={Hh - 3}
        textAnchor="middle"
        fontFamily="Barlow Condensed"
        fontSize="11"
        fontWeight="600"
        fill="#6F7886"
      >
        0&apos;
      </text>
      <text
        x={X(90)}
        y={Hh - 3}
        textAnchor="middle"
        fontFamily="Barlow Condensed"
        fontSize="11"
        fontWeight="600"
        fill="#6F7886"
      >
        90&apos;
      </text>
      <line x1={X(0)} y1={Hh - 16} x2={X(90)} y2={Hh - 16} stroke="rgba(255,255,255,0.25)" />

      <path d={aStep.path} fill="none" stroke="#E9ECEF" strokeWidth="2.2" />
      <path d={hStep.path} fill="none" stroke={homeColor2} strokeWidth="2.8" />

      {goals.map((g, idx) => {
        const min = Math.min(90, Math.ceil(g.t / 60));
        const isH = g.side === 'home';
        const col = isH ? homeColor2 : '#E9ECEF';
        const list = isH ? homeShots : awayShots;
        let cum = 0;
        for (const s of list) {
          cum += s.shot?.xg ?? (s.type === 'GOAL' ? 0.45 : 0.08);
          if (s.seq === g.seq) break;
        }
        return (
          <g key={idx}>
            <circle cx={X(min)} cy={Y(cum)} r="5.5" fill="#0A0D12" stroke={col} strokeWidth="2.2" />
            <circle cx={X(min)} cy={Y(cum)} r="2" fill={col} />
          </g>
        );
      })}

      <text
        x={X(90)}
        y={Y(hStep.finalXg) - 6}
        textAnchor="end"
        fontFamily="Barlow Condensed"
        fontWeight="700"
        fontSize="14"
        fill={homeColor2}
      >
        {(homeXg || hStep.finalXg).toFixed(2)}
      </text>
      <text
        x={X(90)}
        y={Y(aStep.finalXg) + 14}
        textAnchor="end"
        fontFamily="Barlow Condensed"
        fontWeight="700"
        fontSize="14"
        fill="#E9ECEF"
      >
        {(awayXg || aStep.finalXg).toFixed(2)}
      </text>
    </svg>
  );
};
