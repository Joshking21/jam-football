// Implements SPEC §11.16 & §14.5 Scoreboard Bug
import React, { useEffect, useState } from 'react';
import { Club } from '../../../core/types';
import { Crest } from '../../components/Crest';
import { formatMatchClock } from './clock';

interface ScoreboardBugProps {
  homeClub: Club;
  awayClub: Club;
  homeScore: number;
  awayScore: number;
  pt: number; // presentation time in seconds
  half: 1 | 2;
  stoppageMinutes?: number;
  homeRedCards?: number;
  awayRedCards?: number;
}

export const ScoreboardBug: React.FC<ScoreboardBugProps> = ({
  homeClub,
  awayClub,
  homeScore,
  awayScore,
  pt,
  half,
  stoppageMinutes = 0,
  homeRedCards = 0,
  awayRedCards = 0,
}) => {
  const [pulseHome, setPulseHome] = useState(false);
  const [pulseAway, setPulseAway] = useState(false);

  // Trigger 600ms scale pulse on score change (§14.5)
  useEffect(() => {
    if (homeScore > 0) {
      setPulseHome(true);
      const timer = setTimeout(() => setPulseHome(false), 600);
      return () => clearTimeout(timer);
    }
  }, [homeScore]);

  useEffect(() => {
    if (awayScore > 0) {
      setPulseAway(true);
      const timer = setTimeout(() => setPulseAway(false), 600);
      return () => clearTimeout(timer);
    }
  }, [awayScore]);

  // Clock format: MM:SS or 45+X / 90+X during stoppage time (SPEC §14.5, REVIEW-M4 B2)
  const clockText = formatMatchClock(pt, half);

  const homeCode = homeClub.code ?? homeClub.name.substring(0, 3).toUpperCase();
  const awayCode = awayClub.code ?? awayClub.name.substring(0, 3).toUpperCase();

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 24,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(10, 14, 20, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
        zIndex: 50,
        userSelect: 'none',
        fontFamily: 'var(--font-heading)',
      }}
    >
      {/* Home Club Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Crest
          clubId={homeClub.id}
          code={homeCode}
          primaryColor={homeClub.colors.primary}
          secondaryColor={homeClub.colors.secondary}
          size={28}
        />
        <span style={{ fontWeight: 700, fontSize: 16, color: '#F8F9FA' }}>{homeCode}</span>
        {homeRedCards > 0 && (
          <div style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: homeRedCards }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 7,
                  height: 11,
                  background: '#E53E3E',
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Score Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <span
          style={{
            fontWeight: 800,
            fontSize: 22,
            color: '#FFF',
            display: 'inline-block',
            transform: pulseHome ? 'scale(1.4)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
        >
          {homeScore}
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, fontSize: 14 }}>-</span>
        <span
          style={{
            fontWeight: 800,
            fontSize: 22,
            color: '#FFF',
            display: 'inline-block',
            transform: pulseAway ? 'scale(1.4)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
        >
          {awayScore}
        </span>
      </div>

      {/* Away Club Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {awayRedCards > 0 && (
          <div style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: awayRedCards }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 7,
                  height: 11,
                  background: '#E53E3E',
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
        )}
        <span style={{ fontWeight: 700, fontSize: 16, color: '#F8F9FA' }}>{awayCode}</span>
        <Crest
          clubId={awayClub.id}
          code={awayCode}
          primaryColor={awayClub.colors.primary}
          secondaryColor={awayClub.colors.secondary}
          size={28}
        />
      </div>

      {/* Clock Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.6)',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: '#F4B41A',
            letterSpacing: 0.5,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clockText}
        </span>
        {stoppageMinutes > 0 && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#FF6B6B',
              background: 'rgba(255, 107, 107, 0.2)',
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            +{stoppageMinutes}
          </span>
        )}
      </div>
    </div>
  );
};
