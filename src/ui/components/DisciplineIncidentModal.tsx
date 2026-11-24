// Implements SPEC §12.20 Discipline Incidents Choice Card
import React from 'react';
import { DisciplineIncident, Player } from '../../core/types';
import { DisciplineChoice } from '../../core/people/incidents';

interface DisciplineIncidentModalProps {
  incident: DisciplineIncident;
  players: Record<string, Player>;
  onChoice: (choice: DisciplineChoice) => void;
}

export const DisciplineIncidentModal: React.FC<DisciplineIncidentModalProps> = ({
  incident,
  players,
  onChoice,
}) => {
  const p1 = incident.playerIds[0] ? players[incident.playerIds[0]] : null;
  const p2 = incident.playerIds[1] ? players[incident.playerIds[1]] : null;

  const isBustUp = incident.type === 'bust_up';
  const isPress = incident.type === 'press_mouth';

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
          maxWidth: '560px',
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
            ● Disciplinary Incident · Manager Action Required
          </span>
        </div>

        <h2
          style={{
            fontFamily: "'Source Serif 4', serif",
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 10px 0',
            color: '#1B1A17',
          }}
        >
          {incident.title}
        </h2>

        <p style={{ fontSize: '14.5px', lineHeight: 1.5, color: '#3E3831', margin: '0 0 14px 0' }}>
          {incident.description}
        </p>

        {incident.headline && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#1B1A17',
              color: '#FBF8F1',
              borderRadius: '4px',
              marginBottom: '20px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Local Gazette: "{incident.headline}"
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
          {/* Universal Options: Fine, Drop, Warn, Let it go */}
          <button
            onClick={() => onChoice('fine')}
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
            <span style={{ fontWeight: 700, fontSize: '14px' }}>
              Fine {isBustUp ? 'both players' : 'him'}
            </span>
            <span style={{ fontSize: '12px', color: '#CFC6B6' }}>
              1 week's wages to club balance · Morale −8 · Dressing room cohesion +2
            </span>
          </button>

          {!isBustUp && !isPress && (
            <button
              onClick={() => onChoice('drop')}
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
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Drop him next match</span>
              <span style={{ fontSize: '12px', color: '#5E574E' }}>
                Unavailable for selection · Morale −6 · Cohesion +1
              </span>
            </button>
          )}

          {isBustUp && (
            <>
              <button
                onClick={() => onChoice('side_senior')}
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
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Side with senior player</span>
                <span style={{ fontSize: '12px', color: '#5E574E' }}>
                  Younger player morale −8 · Senior player morale +3
                </span>
              </button>

              <button
                onClick={() => onChoice('team_meeting')}
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
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Call a team meeting</span>
                <span style={{ fontSize: '12px', color: '#5E574E' }}>
                  Both fined half a week's wages · Both morale −3 · Cohesion +3
                </span>
              </button>
            </>
          )}

          {isPress && (
            <>
              <button
                onClick={() => onChoice('answer_public')}
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
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Answer him in public</span>
                <span style={{ fontSize: '12px', color: '#5E574E' }}>
                  Rebuke in press · Morale −10 · Fans +2 · 40% asks to leave
                </span>
              </button>

              <button
                onClick={() => onChoice('talk_private')}
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
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Talk privately</span>
                <span style={{ fontSize: '12px', color: '#5E574E' }}>
                  Call into office to address concerns directly
                </span>
              </button>
            </>
          )}

          <button
            onClick={() => onChoice('warn')}
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
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Official Warning</span>
            <span style={{ fontSize: '12px', color: '#5E574E' }}>
              Morale −2 · Repeat incident chance ×1.5 for 4 weeks
            </span>
          </button>

          <button
            onClick={() => onChoice('let_go')}
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
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Let it go</span>
            <span style={{ fontSize: '12px', color: '#5E574E' }}>
              No player morale change · Leaders' morale −3 · Cohesion −2 · Repeat chance ×2
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
