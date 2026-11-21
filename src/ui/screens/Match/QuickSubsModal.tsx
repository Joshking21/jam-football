// Implements SPEC §11.16 Quick In-Match Substitutions Modal (Key S)
import React, { useState } from 'react';
import { Player, PlayerId } from '../../../core/types';
import { rawOvr } from '../../../core/player/ratings';
import { X, ArrowRightLeft, Check, AlertCircle } from 'lucide-react';

interface QuickSubsModalProps {
  isOpen: boolean;
  onClose: () => void;
  starters: Player[];
  bench: Player[];
  subsUsed: number;
  subsAllowed: number;
  windowsUsed: number;
  windowsAllowed: number;
  onConfirmSub: (outId: PlayerId, inId: PlayerId) => void;
}

export const QuickSubsModal: React.FC<QuickSubsModalProps> = ({
  isOpen,
  onClose,
  starters,
  bench,
  subsUsed,
  subsAllowed = 5,
  windowsUsed,
  windowsAllowed = 3,
  onConfirmSub,
}) => {
  const [selectedOut, setSelectedOut] = useState<PlayerId | null>(null);
  const [selectedIn, setSelectedIn] = useState<PlayerId | null>(null);

  if (!isOpen) return null;

  const canSub = subsUsed < subsAllowed && windowsUsed < windowsAllowed;

  const handleApply = () => {
    if (!selectedOut || !selectedIn) return;
    onConfirmSub(selectedOut, selectedIn);
    setSelectedOut(null);
    setSelectedIn(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 720,
          maxHeight: '85vh',
          background: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowRightLeft size={20} color="#F4B41A" />
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#FFF',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Tactical Substitutions
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              Subs:{' '}
              <strong style={{ color: '#FFF' }}>
                {subsUsed} of {subsAllowed}
              </strong>{' '}
              · Windows:{' '}
              <strong style={{ color: '#FFF' }}>
                {windowsUsed} of {windowsAllowed}
              </strong>
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content: Two Lists (Pitch vs Bench) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* On Pitch */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              1. Select Player to Come Off
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {starters.map((p) => {
                const isSelected = selectedOut === p.id;
                const pos = p.positions[0]?.pos ?? 'CM';
                const displayName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
                const ovr = rawOvr(p.attributes, pos);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedOut(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: isSelected
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: isSelected
                        ? '1px solid #EF4444'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 6,
                      color: '#FFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.1)',
                          padding: '2px 5px',
                          borderRadius: 3,
                          width: 24,
                          textAlign: 'center',
                        }}
                      >
                        {p.squadNumber ?? pos}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Cond: {p.condition}%</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#F4B41A',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}
                      >
                        {ovr}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Available on Bench */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              2. Select Player to Come On
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bench.map((p) => {
                const isSelected = selectedIn === p.id;
                const pos = p.positions[0]?.pos ?? 'CM';
                const displayName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
                const ovr = rawOvr(p.attributes, pos);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedIn(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: isSelected
                        ? 'rgba(34, 197, 94, 0.25)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: isSelected
                        ? '1px solid #22C55E'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 6,
                      color: '#FFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.1)',
                          padding: '2px 5px',
                          borderRadius: 3,
                          width: 24,
                          textAlign: 'center',
                        }}
                      >
                        {p.squadNumber ?? pos}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Cond: {p.condition}%</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#22C55E',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}
                      >
                        {ovr}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          {!canSub ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#EF4444',
                fontSize: 12,
              }}
            >
              <AlertCircle size={15} />
              <span>No substitutions or windows remaining in this match.</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              {selectedOut && selectedIn
                ? 'Ready to make substitution at next match stoppage.'
                : 'Select one off-pitch and one on-bench player to proceed.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#FFF',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              disabled={!canSub || !selectedOut || !selectedIn}
              onClick={handleApply}
              style={{
                background:
                  canSub && selectedOut && selectedIn ? '#2563EB' : 'rgba(255, 255, 255, 0.15)',
                color: canSub && selectedOut && selectedIn ? '#FFF' : 'rgba(255, 255, 255, 0.4)',
                border: 'none',
                borderRadius: 6,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: canSub && selectedOut && selectedIn ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={16} />
              <span>Confirm Substitution</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
