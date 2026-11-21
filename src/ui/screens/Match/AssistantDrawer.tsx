// Implements SPEC §11.16 & §15.4 Right Drawer: Assistant Live Advice & Around The League Ticker
import React from 'react';
import { Club, Fixture } from '../../../core/types';
import { X, CheckCircle, ShieldAlert, Radio } from 'lucide-react';

export interface AssistantAdviceItem {
  id: string;
  text: string;
  reason?: string;
  applied?: boolean;
  onApply?: () => void;
}

export interface OutOfTownScore {
  fixtureId: string;
  homeClub: Club;
  awayClub: Club;
  homeScore: number;
  awayScore: number;
  minute: number;
}

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  adviceList: AssistantAdviceItem[];
  outOfTownScores: OutOfTownScore[];
}

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({
  isOpen,
  onClose,
  adviceList,
  outOfTownScores,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 360,
        background: 'rgba(10, 14, 20, 0.94)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.25s ease-out',
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
          <ShieldAlert size={18} color="#F4B41A" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>
            Touchline Intelligence
          </span>
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

      <div
        style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Assistant Feed */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Theo Vance (Assistant Coach)
          </div>

          {adviceList.length === 0 ? (
            <div
              style={{
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 6,
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.5)',
                textAlign: 'center',
              }}
            >
              Lads are following the game plan. No pressing adjustments needed right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {adviceList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F8F9FA', marginBottom: 4 }}>
                    &ldquo;{item.text}&rdquo;
                  </div>
                  {item.reason && (
                    <div
                      style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 10 }}
                    >
                      {item.reason}
                    </div>
                  )}

                  {item.onApply && (
                    <button
                      onClick={item.onApply}
                      disabled={item.applied}
                      style={{
                        background: item.applied ? 'rgba(34, 197, 94, 0.2)' : '#2563EB',
                        color: item.applied ? '#22C55E' : '#FFF',
                        border: 'none',
                        borderRadius: 4,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: item.applied ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {item.applied ? <CheckCircle size={13} /> : null}
                      <span>{item.applied ? 'Applied' : 'Apply Suggestion'}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Around the League Ticker */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: '#F4B41A',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            <Radio size={13} />
            <span>Around The League</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {outOfTownScores.length === 0 ? (
              <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)' }}>
                No other fixtures today.
              </div>
            ) : (
              outOfTownScores.map((score) => (
                <div
                  key={score.fixtureId}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: '#E2E8F0', width: 45 }}>
                      {score.homeClub.code ?? score.homeClub.name.substring(0, 3).toUpperCase()}
                    </span>
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontWeight: 700,
                        color: '#FFF',
                      }}
                    >
                      {score.homeScore} - {score.awayScore}
                    </span>
                    <span style={{ fontWeight: 600, color: '#E2E8F0', width: 45 }}>
                      {score.awayClub.code ?? score.awayClub.name.substring(0, 3).toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: '#F4B41A', fontWeight: 600 }}>
                    {score.minute}&apos;
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
