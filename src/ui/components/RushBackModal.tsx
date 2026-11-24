// Implements SPEC §12.19.2 Rushing a Player Back Choice Card
import React from 'react';
import { Player } from '../../core/types';

interface RushBackModalProps {
  player: Player;
  isDerbyOrTop3?: boolean;
  onChoice: (decision: 'wait' | 'risk') => void;
}

export const RushBackModal: React.FC<RushBackModalProps> = ({
  player,
  isDerbyOrTop3 = false,
  onChoice,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 20, 28, 0.75)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: '#FBF8F1',
          border: '2px solid #1E7B3C',
          borderRadius: '8px',
          padding: '28px 36px',
          maxWidth: '540px',
          width: '90%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.14em',
              color: '#1E7B3C',
              textTransform: 'uppercase',
            }}
          >
            ● Office Meeting · Physio
          </span>
        </div>

        <h2
          style={{
            fontFamily: "'Source Serif 4', serif",
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 12px 0',
            color: '#1B1A17',
          }}
        >
          Fitness Call: {player.firstName} {player.lastName}
        </h2>

        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#F3EFE6',
            borderLeft: '4px solid #1E7B3C',
            borderRadius: '4px',
            marginBottom: isDerbyOrTop3 ? '12px' : '22px',
          }}
        >
          <div style={{ fontStyle: 'italic', fontSize: '15px', color: '#1B1A17' }}>
            "He's close. One week from full fitness. We could risk him this week if you need him."
          </div>
          <small style={{ color: '#5E574E', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Head Physio assessment
          </small>
        </div>

        {isDerbyOrTop3 && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#EAF0FA',
              borderLeft: '4px solid #1F4FBF',
              borderRadius: '4px',
              marginBottom: '22px',
              fontSize: '13.5px',
              color: '#0B1F3A',
            }}
          >
            <b>Theo:</b> "Big one this weekend, gaffer. Your call."
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => onChoice('wait')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '12px 16px',
              backgroundColor: '#1B1A17',
              color: '#FBF8F1',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Wait (Recommended)</span>
            <span style={{ fontSize: '12.5px', color: '#CFC6B6' }}>
              Normal recovery · Returns fully fit next week without elevated re-injury risk
            </span>
          </button>

          <button
            onClick={() => onChoice('risk')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '12px 16px',
              backgroundColor: '#EDE8DC',
              color: '#1B1A17',
              border: '1px solid #D6CEC0',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Risk him</span>
            <span style={{ fontSize: '12.5px', color: '#5E574E' }}>
              Available at condition 70 ('Not fully fit') · Next 2 matches hazard ×3 & skill −0.1 ·
              Breakdown risks 1.5× layoff
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
