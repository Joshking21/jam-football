// Implements SPEC §11.17 Half-Time Screen & docs/design/fulltime/ (approved 23 Nov)
import React, { useEffect, useState } from 'react';
import { Club, TeamMatchStats, MatchEvent, Player, PlayerId, Fixture } from '../../../core/types';
import { OutOfTownScore } from './AssistantDrawer';
import { TalkTone } from '@/core/player/talks';
import { adviseHalfTime, AdviceAction } from '@/core/people/assistant';
import { createRng } from '@/core/rng';
import { buildTeamSheet } from '@/core/game/advance';

interface HalfTimeModalProps {
  isOpen: boolean;
  homeClub: Club;
  awayClub: Club;
  homeScore: number;
  awayScore: number;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  events?: MatchEvent[];
  userClubId: string;
  fixture?: Fixture;
  players?: Record<PlayerId, Player>;
  outOfTownScores?: OutOfTownScore[];
  onSecondHalf: (talkTone?: TalkTone) => void;
  onOpenSubs: () => void;
  onOpenTactics: () => void;
  onApplyAdvice?: (action: AdviceAction) => void;
}

export const HalfTimeModal: React.FC<HalfTimeModalProps> = ({
  isOpen,
  homeClub,
  awayClub,
  homeScore,
  awayScore,
  homeStats,
  awayStats,
  events = [],
  userClubId,
  fixture,
  players,
  outOfTownScores,
  onSecondHalf,
  onOpenSubs,
  onOpenTactics,
  onApplyAdvice,
}) => {
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onSecondHalf('Calm');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSecondHalf]);

  if (!isOpen) return null;

  const isUserHome = userClubId === homeClub.id;
  const userScore = isUserHome ? homeScore : awayScore;
  const oppScore = isUserHome ? awayScore : homeScore;

  const homeColor = homeClub.colors.primary || '#0B1F3A';
  const homeColor2 = homeClub.colors.secondary || '#F2B705';
  const awayColor = awayClub.colors.primary || '#111111';
  const awayColor2 = awayClub.colors.secondary || '#FFFFFF';

  // Scorers in first half
  const htEvents = events.filter((e) => e.t <= 2700);
  const goalEvents = htEvents.filter((e) => e.type === 'GOAL');
  const homeScorers = goalEvents.filter((e) => e.side === 'home');
  const awayScorers = goalEvents.filter((e) => e.side === 'away');

  const getScorerName = (ev: MatchEvent) => {
    const p = ev.playerId && players ? players[ev.playerId] : null;
    return p ? (p.knownAs ?? p.lastName) : 'Scorer';
  };

  const homePassPct = Math.round(
    ((homeStats.passesCompleted || 1) / Math.max(1, homeStats.passes || 1)) * 100,
  );
  const awayPassPct = Math.round(
    ((awayStats.passesCompleted || 1) / Math.max(1, awayStats.passes || 1)) * 100,
  );

  const totalPoss = (homeStats.possessionSec || 1) + (awayStats.possessionSec || 1);
  const homePoss = Math.round(((homeStats.possessionSec || 1) / totalPoss) * 100);
  const awayPoss = 100 - homePoss;

  // §15.5 Half-time assistant analysis
  const userClub = isUserHome ? homeClub : awayClub;
  const oppClub = isUserHome ? awayClub : homeClub;
  const htAdvices = players
    ? adviseHalfTime(
        {
          kind: 'halfTime',
          ourSide: isUserHome ? 'home' : 'away',
          homeStats: {
            goals: homeStats.goals,
            shots: homeStats.shots,
            shotsOnTarget: homeStats.shotsOnTarget,
            xg: homeStats.xg,
            possessionSec: homeStats.possessionSec ?? 1350,
            passes: homeStats.passes,
            passesCompleted: homeStats.passesCompleted,
            corners: homeStats.corners,
            fouls: homeStats.fouls,
            yellow: homeStats.yellow,
            red: homeStats.red,
            offsides: homeStats.offsides,
            tackles: 0,
            interceptions: 0,
            saves: 0,
            bigChances: 0,
          },
          awayStats: {
            goals: awayStats.goals,
            shots: awayStats.shots,
            shotsOnTarget: awayStats.shotsOnTarget,
            xg: awayStats.xg,
            possessionSec: awayStats.possessionSec ?? 1350,
            passes: awayStats.passes,
            passesCompleted: awayStats.passesCompleted,
            corners: awayStats.corners,
            fouls: awayStats.fouls,
            yellow: awayStats.yellow,
            red: awayStats.red,
            offsides: awayStats.offsides,
            tackles: 0,
            interceptions: 0,
            saves: 0,
            bigChances: 0,
          },
          events: htEvents,
          ourLineup: userClub.tactics.lineup,
          ourBench: userClub.tactics.bench,
          ourRatings: {},
          oppSheet: buildTeamSheet(oppClub, players, isUserHome ? 'away' : 'home'),
          players,
        },
        createRng((fixture?.matchday ?? 1) * 100 + 45),
      )
    : [];

  // 5 stats rows per reference
  const statsRows = [
    {
      label: 'Possession',
      hVal: `${homePoss}%`,
      aVal: `${awayPoss}%`,
      hNum: homePoss,
      aNum: awayPoss,
    },
    {
      label: 'Expected goals',
      hVal: (homeStats.xg || 0).toFixed(2),
      aVal: (awayStats.xg || 0).toFixed(2),
      hNum: homeStats.xg || 0,
      aNum: awayStats.xg || 0,
    },
    {
      label: 'Shots',
      hVal: `${homeStats.shots}`,
      aVal: `${awayStats.shots}`,
      hNum: homeStats.shots,
      aNum: awayStats.shots,
    },
    {
      label: 'On target',
      hVal: `${homeStats.shotsOnTarget}`,
      aVal: `${awayStats.shotsOnTarget}`,
      hNum: homeStats.shotsOnTarget,
      aNum: awayStats.shotsOnTarget,
    },
    {
      label: 'Passing',
      hVal: `${homePassPct}%`,
      aVal: `${awayPassPct}%`,
      hNum: homePassPct,
      aNum: awayPassPct,
    },
  ];

  // Theo's §15.5 tactical assessment
  const theoAnalysis =
    userScore > oppScore
      ? {
          title: 'Managing the lead',
          text: 'We have dominated the central channels. Maintain compact spacing in the transition and protect the two-goal cushion.',
          tweak: 'Drop defensive line 5m',
        }
      : userScore === oppScore
        ? {
            title: 'Breaking the deadlock',
            text: 'Their backline is stepping high to squeeze play. Direct balls behind their fullbacks will unlock clear chances in the second half.',
            tweak: 'Pass into space',
          }
        : {
            title: 'Chasing the game',
            text: 'We are turning over possession in our defensive third. Push the wingers higher and increase pressing intensity to force errors.',
            tweak: 'High press & higher tempo',
          };

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
      {/* Blurred 3D match background */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backdropFilter: 'blur(14px) saturate(0.8) brightness(0.45)',
          background: 'rgba(5, 7, 10, 0.45)',
          pointerEvents: 'none',
        }}
      />
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
              HALF-TIME
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
              <span>{homeScore}</span>
              <span
                style={{ width: 22, height: 7, background: '#0A0D12', display: 'inline-block' }}
              />
              <span>{awayScore}</span>
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
                45 MINUTES PLAYED
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
          {/* Column 1: Theo's §15.5 Half-Time Brief Card */}
          <div>
            <div
              style={{
                position: 'relative',
                background: '#F1ECE2',
                color: '#0B1F3A',
                boxShadow: '0 20px 45px rgba(0,0,0,0.65)',
                padding: '16px 18px',
                borderRadius: 2,
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
                  padding: '6px 10px 5px',
                }}
              >
                ASSISTANT BRIEFING · THEO VANCE
              </span>

              <h4
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 800,
                  fontSize: 26,
                  textTransform: 'uppercase',
                  color: '#0B1F3A',
                  marginTop: 8,
                }}
              >
                {theoAnalysis.title}
              </h4>
              <p
                style={{
                  fontFamily: 'Inter',
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  color: '#343A40',
                  marginTop: 8,
                  marginBottom: 16,
                }}
              >
                {theoAnalysis.text}
              </p>

              <div
                style={{
                  borderTop: '1px solid rgba(11, 31, 58, 0.2)',
                  paddingTop: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#5B5546',
                  }}
                >
                  Recommended Tweak:
                </div>
                <button
                  onClick={onOpenTactics}
                  style={{
                    background: '#0B1F3A',
                    color: '#FFF',
                    border: 'none',
                    padding: '8px 12px',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  ⚡ Apply: {theoAnalysis.tweak}
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: The Numbers (5 Rows) */}
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
              First half numbers
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {statsRows.map((row, idx) => {
                const total = row.hNum + row.aNum || 1;
                const hPct = (row.hNum / total) * 100;
                const aPct = (row.aNum / total) * 100;
                const hLead = row.hNum > row.aNum;
                const aLead = row.aNum > row.hNum;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '55px 1fr 55px',
                      alignItems: 'center',
                      gap: 10,
                      height: 40,
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
          </div>

          {/* Column 3: Where the chances came from (First Half Shot Map) */}
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
              First half chances
            </div>

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
              <svg width="100%" height="100%" viewBox="0 0 105 56">
                <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.35" fill="none">
                  <rect x="1" y="1" width="103" height="54" />
                  <line x1="52.5" y1="1" x2="52.5" y2="55" />
                  <circle cx="52.5" cy="28" r="7.5" />
                  <rect x="1" y="12" width="14" height="32" />
                  <rect x="1" y="21" width="5" height="14" />
                  <rect x="90" y="12" width="14" height="32" />
                  <rect x="99" y="21" width="5" height="14" />
                </g>
                {htEvents
                  .filter((e) => e.type === 'SHOT' || e.type === 'GOAL')
                  .map((s, idx) => {
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
                      <circle
                        key={idx}
                        cx={sx}
                        cy={sy}
                        r={r}
                        fill={col}
                        fillOpacity={isGoal ? 1.0 : 0.55}
                        stroke={isGoal ? '#FFF' : 'none'}
                        strokeWidth={isGoal ? 0.6 : 0}
                      />
                    );
                  })}
              </svg>
            </div>

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
              <span>Size = chance quality (xG)</span>
            </div>
          </div>
        </div>

        {/* §15.5 Assistant Half-Time Briefing */}
        {htAdvices.length > 0 && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: '12px 16px',
              marginBottom: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#F4B41A',
              }}
            >
              Theo Vance · Half-Time Notes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {htAdvices.map((adv) => (
                <div
                  key={adv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontSize: 13,
                    color: '#E9ECEF',
                  }}
                >
                  <span>&bull; {adv.text}</span>
                  {adv.apply && onApplyAdvice && (
                    <button
                      disabled={Boolean(appliedIds[adv.id])}
                      onClick={() => {
                        onApplyAdvice(adv.apply!);
                        setAppliedIds((prev) => ({ ...prev, [adv.id]: true }));
                      }}
                      style={{
                        background: appliedIds[adv.id] ? 'rgba(34, 197, 94, 0.25)' : '#2563EB',
                        color: appliedIds[adv.id] ? '#4ADE80' : '#FFF',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: appliedIds[adv.id] ? 'default' : 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {appliedIds[adv.id] ? 'Applied' : 'Apply'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Foot Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 38,
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onOpenSubs}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#F2F4F7',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '10px 18px',
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Quick Substitutions
            </button>
            <button
              onClick={onOpenTactics}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#F2F4F7',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '10px 18px',
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Team Instructions
            </button>
          </div>

          <button
            onClick={() => onSecondHalf('Calm')}
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
              height: 48,
              clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Resume second half
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
          HALF-TIME AROUND THE LEAGUE
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
                Saltmere 0–0 Ironvale
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
                Ashcombe 0–1 Kestrel Bay
              </b>
            </span>
          </>
        )}
      </div>
    </div>
  );
};
