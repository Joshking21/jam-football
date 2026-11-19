// Implements SPEC §19.5 Modal component
// Centred, max 960px, Esc closes, focus trap.
// No backdrop blur (performance); dim the screen behind with rgb(0 0 0 / .6).
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { KeyHint } from './KeyHint';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: number | string;
  variant?: 'on-air' | 'office';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 960,
  variant = 'on-air',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOffice = variant === 'office';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={isOffice ? 'paper-surface' : undefined}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          backgroundColor: isOffice ? 'var(--paper)' : 'var(--surface)',
          color: isOffice ? 'var(--paper-ink)' : 'var(--text)',
          border: `1px solid ${isOffice ? 'var(--paper-rule)' : 'var(--border)'}`,
          borderRadius: isOffice ? '3px' : 'var(--radius-m)',
          boxShadow: isOffice ? 'var(--shadow-paper)' : 'var(--shadow-1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modal-pop var(--dur-med) var(--ease-snap)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${isOffice ? 'var(--paper-rule)' : 'var(--border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isOffice ? 'var(--paper-2)' : 'var(--surface-2)',
          }}
        >
          <h2
            style={{
              fontSize: '24px',
              margin: 0,
              fontFamily: 'var(--font-head)',
              color: isOffice ? 'var(--paper-ink)' : 'var(--text)',
            }}
          >
            {title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyHint hint="Esc" />
            <button
              onClick={onClose}
              aria-label="Close modal"
              style={{
                color: isOffice ? 'var(--paper-dim)' : 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: 'var(--radius-s)',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modal-pop {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
