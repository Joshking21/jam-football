// Implements SPEC §12.19.1 Knock Choice Card on Match Day
import React from 'react';
import { Player } from '../../../core/types';

interface KnockChoiceCardProps {
  player: Player;
  pct: number;
  isFirstHalf: boolean;
  onChoice: (decision: 'take_off' | 'play_on' | 'carry_to_ht') => void;
}

export const KnockChoiceCard: React.FC<KnockChoiceCardProps> = ({
  player,
  pct,
  isFirstHalf,
  onChoice,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        backgroundColor: '#FBF8F1',
        border: '2px solid #C42B2B',
        borderRadius: '8px',
        padding: '24px 32px',
        maxWidth: '520px',
        width: '90%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        fontFamily: "'Inter', sans-serif",
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
          ● Physio Assessment · In-Match Knock
        </span>
      </div>

      <h3
        style={{
          fontFamily: "'Source Serif 4', serif",
          fontSize: '22px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: '#1B1A17',
        }}
      >
        {player.firstName} {player.lastName} has taken a knock
      </h3>

      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#F3EFE6',
          borderLeft: '4px solid #1E7B3C',
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontStyle: 'italic', fontSize: '15px', color: '#1B1A17' }}>
          "He can carry on. About {pct}%."
        </div>
        <small style={{ color: '#5E574E', fontSize: '12px', marginTop: '4px', display: 'block' }}>
          Head Physio recommendation
        </small>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => onChoice('take_off')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '10px 14px',
            backgroundColor: '#1B1A17',
            color: '#FBF8F1',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '14px' }}>Take him off</span>
          <span style={{ fontSize: '12px', color: '#CFC6B6' }}>
            Immediate substitution at next dead ball · Condition −10 · No layoff
          </span>
        </button>

        <button
          onClick={() => onChoice('play_on')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '10px 14px',
            backgroundColor: '#EDE8DC',
            color: '#1B1A17',
            border: '1px solid #D6CEC0',
            borderRadius: '4px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '14px' }}>Let him carry on</span>
          <span style={{ fontSize: '12px', color: '#5E574E' }}>
            Skill scores −0.3 · Injury hazard ×4 · Severity rolls one level up if injured
          </span>
        </button>

        {isFirstHalf && (
          <button
            onClick={() => onChoice('carry_to_ht')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '10px 14px',
              backgroundColor: '#EDE8DC',
              color: '#1B1A17',
              border: '1px solid #D6CEC0',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Carry on until half-time</span>
            <span style={{ fontSize: '12px', color: '#5E574E' }}>
              Carry-on rules until 45' · Replaced at half-time without using a sub window
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
