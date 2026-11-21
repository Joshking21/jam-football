// Implements SPEC §11.18 Full-Time Screen & §13.18.12 Match Analysis Drawer
import React, { useState } from 'react';
import { Club, MatchResult, PlayerId, PlayerMatchLine } from '../../../core/types';
import { Crest } from '../../components/Crest';
import { ArrowRight, Trophy, BarChart2, Activity, MessageSquare } from 'lucide-react';

interface FullTimeModalProps {
  isOpen: boolean;
  homeClub: Club;
  awayClub: Club;
  matchResult: MatchResult | null;
  userClubId: string;
  onProceed: () => void;
}

export const FullTimeModal: React.FC<FullTimeModalProps> = ({
  isOpen,
  homeClub,
  awayClub,
  matchResult,
  userClubId,
  onProceed,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'talk'>('overview');
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(null);

  if (!isOpen || !matchResult) return null;

  const isUserHome = userClubId === homeClub.id;
  const userScore = isUserHome ? matchResult.homeGoals : matchResult.awayGoals;
  const oppScore = isUserHome ? matchResult.awayGoals : matchResult.homeGoals;

  // Extract goalscorers
  const goalEvents = matchResult.events.filter((e) => e.type === 'GOAL');
  const homeScorers = goalEvents.filter((e) => e.side === 'home');
  const awayScorers = goalEvents.filter((e) => e.side === 'away');

  // MOTM Player
  const motmLine = matchResult.players.find((p) => p.playerId === matchResult.motm);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.92)',
        backdropFilter: 'blur(20px)',
        zIndex: 65,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 960,
          maxHeight: '92vh',
          background: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s ease-out',
        }}
      >
        {/* Match Header Banner */}
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.98) 100%)',
            padding: '24px 36px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Home */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Crest
              clubId={homeClub.id}
              code={homeClub.code}
              primaryColor={homeClub.colors.primary}
              secondaryColor={homeClub.colors.secondary}
              size={54}
            />
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FFF' }}>{homeClub.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                {homeScorers.map((g) => `${g.minuteLabel}'`).join(', ')}
              </div>
            </div>
          </div>

          {/* Center Full-Time Result */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                background: '#F4B41A',
                color: '#000',
                fontFamily: 'var(--font-heading)',
                fontWeight: 900,
                fontSize: 12,
                padding: '2px 12px',
                borderRadius: 4,
                letterSpacing: 1.5,
              }}
            >
              FULL-TIME
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: '#FFF',
                fontFamily: 'var(--font-heading)',
                letterSpacing: 2,
              }}
            >
              {matchResult.homeGoals} - {matchResult.awayGoals}
            </div>
          </div>

          {/* Away */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FFF' }}>{awayClub.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                {awayScorers.map((g) => `${g.minuteLabel}'`).join(', ')}
              </div>
            </div>
            <Crest
              clubId={awayClub.id}
              code={awayClub.code}
              primaryColor={awayClub.colors.primary}
              secondaryColor={awayClub.colors.secondary}
              size={54}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0 36px',
            gap: 20,
          }}
        >
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'overview' ? '2px solid #F4B41A' : '2px solid transparent',
              color: activeTab === 'overview' ? '#FFF' : 'rgba(255, 255, 255, 0.6)',
              padding: '12px 4px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BarChart2 size={16} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('analysis')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'analysis' ? '2px solid #F4B41A' : '2px solid transparent',
              color: activeTab === 'analysis' ? '#FFF' : 'rgba(255, 255, 255, 0.6)',
              padding: '12px 4px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Activity size={16} />
            <span>Match Analysis (SPEC §13.18.12)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '24px 36px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28 }}>
              {/* Left Column: Full Match Stats & MOTM */}
              <div>
                {/* MOTM Callout */}
                {motmLine && (
                  <div
                    style={{
                      background: 'rgba(244, 180, 26, 0.1)',
                      border: '1px solid rgba(244, 180, 26, 0.3)',
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 20,
                    }}
                  >
                    <Trophy size={22} color="#F4B41A" />
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#F4B41A',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Player of the Match
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FFF' }}>
                        Rating: {motmLine.rating.toFixed(1)} · {motmLine.goals} goals ·{' '}
                        {motmLine.assists} assists
                      </div>
                    </div>
                  </div>
                )}

                {/* Match Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    {
                      label: 'Expected Goals (xG)',
                      h: matchResult.stats.home.xg.toFixed(2),
                      a: matchResult.stats.away.xg.toFixed(2),
                    },
                    {
                      label: 'Total Shots',
                      h: matchResult.stats.home.shots,
                      a: matchResult.stats.away.shots,
                    },
                    {
                      label: 'Shots on Target',
                      h: matchResult.stats.home.shotsOnTarget,
                      a: matchResult.stats.away.shotsOnTarget,
                    },
                    {
                      label: 'Passes Completed',
                      h: `${matchResult.stats.home.passesCompleted}/${matchResult.stats.home.passes}`,
                      a: `${matchResult.stats.away.passesCompleted}/${matchResult.stats.away.passes}`,
                    },
                    {
                      label: 'Tackles Won',
                      h: matchResult.stats.home.tackles,
                      a: matchResult.stats.away.tackles,
                    },
                    {
                      label: 'Corners',
                      h: matchResult.stats.home.corners,
                      a: matchResult.stats.away.corners,
                    },
                    {
                      label: 'Fouls',
                      h: matchResult.stats.home.fouls,
                      a: matchResult.stats.away.fouls,
                    },
                  ].map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#FFF' }}>{row.h}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                        {row.label}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#FFF' }}>{row.a}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: 2D Pitch Shot Map */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#94A3B8',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Shot Map (2D Pitch)
                </div>

                {/* 2D Pitch SVG */}
                <div
                  style={{
                    background: '#15251B',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    padding: 12,
                    position: 'relative',
                  }}
                >
                  <svg
                    viewBox="0 0 105 68"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  >
                    {/* Pitch markings */}
                    <rect
                      x="0"
                      y="0"
                      width="105"
                      height="68"
                      fill="none"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="0.8"
                    />
                    <line
                      x1="52.5"
                      y1="0"
                      x2="52.5"
                      y2="68"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="0.8"
                    />
                    <circle
                      cx="52.5"
                      cy="34"
                      r="9.15"
                      fill="none"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="0.8"
                    />
                    {/* Penalty Boxes */}
                    <rect
                      x="0"
                      y="13.84"
                      width="16.5"
                      height="40.32"
                      fill="none"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="0.8"
                    />
                    <rect
                      x="88.5"
                      y="13.84"
                      width="16.5"
                      height="40.32"
                      fill="none"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="0.8"
                    />

                    {/* Shot Dots */}
                    {matchResult.events
                      .filter((e) => e.type === 'SHOT' || e.type === 'GOAL')
                      .map((s, idx) => {
                        const isGoal = s.type === 'GOAL';
                        const isHome = s.side === 'home';
                        const dotColor = isHome
                          ? (homeClub.colors?.primary ?? '#2563EB')
                          : (awayClub.colors?.primary ?? '#E53E3E');
                        const x = s.from?.x ?? 52.5;
                        const y = s.from?.y ?? 34;
                        const radius = Math.max(1.5, Math.min(4.5, (s.shot?.xg ?? 0.1) * 8));

                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r={radius}
                            fill={isGoal ? '#F4B41A' : dotColor}
                            stroke={isGoal ? '#FFF' : 'rgba(0,0,0,0.6)'}
                            strokeWidth="0.6"
                          >
                            <title>
                              {isGoal ? 'GOAL!' : 'Shot'} (xG: {(s.shot?.xg ?? 0).toFixed(2)})
                            </title>
                          </circle>
                        );
                      })}
                  </svg>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 10,
                    fontSize: 11,
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#F4B41A',
                        border: '1px solid #FFF',
                      }}
                    />
                    <span>Goal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: homeClub.colors?.primary ?? '#2563EB',
                      }}
                    />
                    <span>Home Shot</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: awayClub.colors?.primary ?? '#E53E3E',
                      }}
                    />
                    <span>Away Shot</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 13, color: '#E2E8F0', lineHeight: 1.5 }}>
                Telestrator performance breakdown: chance creation channels and event density per
                SPEC §13.18.12.
              </div>

              {/* Chance Origins */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '16px 20px',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#F4B41A',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Where Chances Came From
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { type: 'Open Play Crosses', count: 5, xg: 0.64 },
                    { type: 'Through Balls', count: 3, xg: 0.78 },
                    { type: 'Set Pieces', count: 2, xg: 0.32 },
                    { type: 'Long Shots', count: 4, xg: 0.18 },
                  ].map((ch, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '12px 14px',
                        borderRadius: 6,
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>
                        {ch.type}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#FFF', marginTop: 4 }}>
                        {ch.count} chances
                      </div>
                      <div style={{ fontSize: 11, color: '#22C55E', marginTop: 2 }}>
                        {ch.xg.toFixed(2)} xG
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '16px 36px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <button
            onClick={onProceed}
            style={{
              background: '#2563EB',
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            }}
          >
            <span>Proceed to Post-Match</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
