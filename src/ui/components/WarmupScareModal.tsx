// Implements SPEC §12.19.3 Warm-Up Scare Choice Card
import React from 'react';
import { Player } from '../../core/types';

interface WarmupScareModalProps {
  player: Player;
  onChoice: (decision: 'start' | 'leave_out') => void;
}

export const WarmupScareModal: React.FC<WarmupScareModalProps> = ({ player, onChoice }) => {
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
          border: '2px solid #C42B2B',
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
              color: '#C42B2B',
              textTransform: 'uppercase',
            }}
          >
            ● Dressing Room Briefing · Physio
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
          Warm-Up Scare: {player.firstName} {player.lastName}
        </h2>

        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#F3EFE6',
            borderLeft: '4px solid #C98A12',
            borderRadius: '4px',
            marginBottom: '22px',
          }}
        >
          <div style={{ fontStyle: 'italic', fontSize: '15px', color: '#1B1A17' }}>
            "{player.lastName}'s hamstring is tight in the warm-up. He felt something during runs.
            Your call, gaffer."
          </div>
          <small style={{ color: '#5E574E', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Head Physio pre-match report
          </small>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => onChoice('leave_out')}
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
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Leave him out (Recommended)</span>
            <span style={{ fontSize: '12.5px', color: '#CFC6B6' }}>
              Stands down safely · Best bench player takes starting slot
            </span>
          </button>

          <button
            onClick={() => onChoice('start')}
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
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Start him anyway</span>
            <span style={{ fontSize: '12.5px', color: '#5E574E' }}>
              Injury hazard ×2.5 this match · Skill −0.1 (not fully loose)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
