// Implements SPEC §11.17 Half-Time Screen
import React, { useState } from 'react';
import { Club, TeamMatchStats } from '../../../core/types';
import { Crest } from '../../components/Crest';
import { ArrowRight, MessageSquare, Play, Sparkles } from 'lucide-react';
import { TalkTone, predictTalkReaction, TALKS_DATA, TalkContext } from '@/core/player/talks';

interface HalfTimeModalProps {
  isOpen: boolean;
  homeClub: Club;
  awayClub: Club;
  homeScore: number;
  awayScore: number;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  userClubId: string;
  onSecondHalf: (talkTone?: TalkTone) => void;
  onOpenSubs: () => void;
  onOpenTactics: () => void;
}

export const HalfTimeModal: React.FC<HalfTimeModalProps> = ({
  isOpen,
  homeClub,
  awayClub,
  homeScore,
  awayScore,
  homeStats,
  awayStats,
  userClubId,
  onSecondHalf,
  onOpenSubs,
  onOpenTactics,
}) => {
  const [selectedTone, setSelectedTone] = useState<TalkTone>('Calm');

  if (!isOpen) return null;

  const isUserHome = userClubId === homeClub.id;
  const userScore = isUserHome ? homeScore : awayScore;
  const oppScore = isUserHome ? awayScore : homeScore;

  // Context: HT_WIN, HT_DRAW, HT_LOSE
  const htContext: TalkContext =
    userScore > oppScore ? 'HT_WIN' : userScore === oppScore ? 'HT_DRAW' : 'HT_LOSE';

  const tones: { id: TalkTone; label: string; desc: string; reaction: string; quote: string }[] = [
    {
      id: 'Calm',
      label: 'Calm',
      desc: 'Keep our heads. Stay disciplined.',
      reaction: predictTalkReaction(htContext, 'Calm'),
      quote: TALKS_DATA[htContext].Calm.managerLines[0]!,
    },
    {
      id: 'Motivate',
      label: 'Motivate',
      desc: 'Step up the tempo and win every duel.',
      reaction: predictTalkReaction(htContext, 'Motivate'),
      quote: TALKS_DATA[htContext].Motivate.managerLines[0]!,
    },
    {
      id: 'Demand',
      label: 'Demand More',
      desc: 'Demand urgency and complete ruthlessness.',
      reaction: predictTalkReaction(htContext, 'Demand'),
      quote: TALKS_DATA[htContext].Demand.managerLines[0]!,
    },
    {
      id: 'Praise',
      label: 'Praise',
      desc: 'Praise the graft and build confidence.',
      reaction: predictTalkReaction(htContext, 'Praise'),
      quote: TALKS_DATA[htContext].Praise.managerLines[0]!,
    },
    {
      id: 'Disappoint',
      label: 'Disappointment',
      desc: 'Call out sub-par standards bluntly.',
      reaction: predictTalkReaction(htContext, 'Disappoint'),
      quote: TALKS_DATA[htContext].Disappoint.managerLines[0]!,
    },
    {
      id: 'Focus',
      label: 'Focus',
      desc: 'Pinpoint tactical tweaks and game management.',
      reaction: predictTalkReaction(htContext, 'Focus'),
      quote: TALKS_DATA[htContext].Focus.managerLines[0]!,
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 65,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 840,
          maxHeight: '90vh',
          background: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s ease-out',
        }}
      >
        {/* Header: Scoreboard */}
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
            padding: '24px 32px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Home */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Crest
              clubId={homeClub.id}
              code={homeClub.code}
              primaryColor={homeClub.colors.primary}
              secondaryColor={homeClub.colors.secondary}
              size={48}
            />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FFF' }}>{homeClub.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>Home</div>
            </div>
          </div>

          {/* Center Score & Badge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                background: '#F4B41A',
                color: '#000',
                fontFamily: 'var(--font-heading)',
                fontWeight: 900,
                fontSize: 12,
                padding: '2px 10px',
                borderRadius: 4,
                letterSpacing: 1,
              }}
            >
              HALF-TIME
            </div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 900,
                color: '#FFF',
                fontFamily: 'var(--font-heading)',
                letterSpacing: 2,
              }}
            >
              {homeScore} - {awayScore}
            </div>
          </div>

          {/* Away */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FFF' }}>{awayClub.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>Away</div>
            </div>
            <Crest
              clubId={awayClub.id}
              code={awayClub.code}
              primaryColor={awayClub.colors.primary}
              secondaryColor={awayClub.colors.secondary}
              size={48}
            />
          </div>
        </div>

        {/* Body: Stats + Team Talk */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 24,
            padding: '24px 32px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Stats Overview */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#94A3B8',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              First Half Match Summary
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  label: 'Expected Goals (xG)',
                  h: homeStats.xg.toFixed(2),
                  a: awayStats.xg.toFixed(2),
                },
                { label: 'Total Shots', h: homeStats.shots, a: awayStats.shots },
                {
                  label: 'Shots on Target',
                  h: homeStats.shotsOnTarget,
                  a: awayStats.shotsOnTarget,
                },
                { label: 'Corners', h: homeStats.corners, a: awayStats.corners },
                { label: 'Fouls', h: homeStats.fouls, a: awayStats.fouls },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
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

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={onOpenSubs}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Substitutions
              </button>
              <button
                onClick={onOpenTactics}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Tactics Adjustment
              </button>
            </div>
          </div>

          {/* Half-Time Team Talk */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: '#F4B41A',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              <MessageSquare size={14} />
              <span>Dressing Room Team Talk</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tones.map((t) => {
                const isSelected = selectedTone === t.id;
                const reactionColor =
                  t.reaction === 'Most will respond well'
                    ? '#10B981'
                    : t.reaction === 'Mixed'
                      ? '#94A3B8'
                      : '#EF4444';
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTone(t.id)}
                    style={{
                      background: isSelected
                        ? 'rgba(37, 99, 235, 0.25)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: isSelected
                        ? '1px solid #2563EB'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      color: '#FFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
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
                          fontSize: 13,
                          fontWeight: 700,
                          color: isSelected ? '#60A5FA' : '#FFF',
                        }}
                      >
                        {t.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: reactionColor }}>
                        {t.reaction}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
                      {t.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Speech Bubble */}
            {selectedTone && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.06)',
                  borderLeft: '3px solid #2563EB',
                  fontSize: 12,
                  fontStyle: 'italic',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                "{tones.find((t) => t.id === selectedTone)?.quote}"
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 32px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
            Selected team talk will boost focus for the first 20 minutes of the second half.
          </span>

          <button
            onClick={() => onSecondHalf(selectedTone)}
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
            <span>Start Second Half</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
