// Implements SPEC §11.16 Left Drawer: Live Match Stats & Rolling Momentum Chart
import React from 'react';
import { Club, TeamMatchStats } from '../../../core/types';
import { Crest } from '../../components/Crest';
import { X } from 'lucide-react';

interface LiveStatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  homeClub: Club;
  awayClub: Club;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  momentumHistory: { minute: number; homeXg: number; awayXg: number }[];
}

export const LiveStatsDrawer: React.FC<LiveStatsDrawerProps> = ({
  isOpen,
  onClose,
  homeClub,
  awayClub,
  homeStats,
  awayStats,
  momentumHistory,
}) => {
  if (!isOpen) return null;

  const totalPossession = Math.max(
    1,
    (homeStats.possessionSec ?? 0) + (awayStats.possessionSec ?? 0),
  );
  const homePossPct = Math.round(((homeStats.possessionSec ?? 0) / totalPossession) * 100);
  const awayPossPct = 100 - homePossPct;

  const StatRow = ({
    label,
    homeVal,
    awayVal,
  }: {
    label: string;
    homeVal: string | number;
    awayVal: string | number;
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13,
          fontWeight: 600,
          color: '#E2E8F0',
        }}
      >
        <span>{homeVal}</span>
        <span
          style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11, textTransform: 'uppercase' }}
        >
          {label}
        </span>
        <span>{awayVal}</span>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 340,
        background: 'rgba(10, 14, 20, 0.94)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '10px 0 40px rgba(0, 0, 0, 0.8)',
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInLeft 0.25s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crest
            clubId={homeClub.id}
            code={homeClub.code}
            primaryColor={homeClub.colors.primary}
            secondaryColor={homeClub.colors.secondary}
            size={22}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>Match Stats</span>
          <Crest
            clubId={awayClub.id}
            code={awayClub.code}
            primaryColor={awayClub.colors.primary}
            secondaryColor={awayClub.colors.secondary}
            size={22}
          />
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* Possession Bar */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 700,
              color: '#FFF',
              marginBottom: 6,
            }}
          >
            <span>{homePossPct}%</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
              Possession
            </span>
            <span>{awayPossPct}%</span>
          </div>
          <div
            style={{
              height: 8,
              background: '#334155',
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${homePossPct}%`,
                background: homeClub.colors?.primary ?? '#2563EB',
                transition: 'width 0.4s ease',
              }}
            />
            <div
              style={{
                width: `${awayPossPct}%`,
                background: awayClub.colors?.primary ?? '#E53E3E',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Stats Table */}
        <StatRow
          label="Expected Goals (xG)"
          homeVal={(homeStats.xg ?? 0).toFixed(2)}
          awayVal={(awayStats.xg ?? 0).toFixed(2)}
        />
        <StatRow
          label="Total Shots"
          homeVal={homeStats.shots ?? 0}
          awayVal={awayStats.shots ?? 0}
        />
        <StatRow
          label="Shots on Target"
          homeVal={homeStats.shotsOnTarget ?? 0}
          awayVal={awayStats.shotsOnTarget ?? 0}
        />
        <StatRow
          label="Corners"
          homeVal={homeStats.corners ?? 0}
          awayVal={awayStats.corners ?? 0}
        />
        <StatRow label="Fouls" homeVal={homeStats.fouls ?? 0} awayVal={awayStats.fouls ?? 0} />
        <StatRow
          label="Yellow Cards"
          homeVal={homeStats.yellow ?? 0}
          awayVal={awayStats.yellow ?? 0}
        />
        <StatRow label="Red Cards" homeVal={homeStats.red ?? 0} awayVal={awayStats.red ?? 0} />

        {/* Rolling Momentum Chart */}
        <div
          style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#F4B41A',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Rolling Momentum (xG / 5 min)
          </div>
          <div
            style={{
              height: 100,
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              gap: 4,
            }}
          >
            {momentumHistory.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.4)',
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                Building momentum data...
              </div>
            ) : (
              momentumHistory.map((m, idx) => {
                const maxVal = Math.max(0.1, m.homeXg + m.awayXg);
                const homeH = Math.min(45, (m.homeXg / maxVal) * 45);
                const awayH = Math.min(45, (m.awayXg / maxVal) * 45);
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {/* Home bar up */}
                    <div
                      style={{
                        width: '80%',
                        height: homeH,
                        background: homeClub.colors?.primary ?? '#2563EB',
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                    <div
                      style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.2)' }}
                    />
                    {/* Away bar down */}
                    <div
                      style={{
                        width: '80%',
                        height: awayH,
                        background: awayClub.colors?.primary ?? '#E53E3E',
                        borderRadius: '0 0 2px 2px',
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
