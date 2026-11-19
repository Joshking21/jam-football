// Implements SPEC §11.23 Credits Modal
import React from 'react';
import { useStore } from '@/state/store';
import { Modal } from '@/ui/components/Modal';
import { CREDITS, GAME_TITLE, GAME_VERSION } from '@/config/constants';

export const CreditsModal: React.FC = () => {
  const isCreditsOpen = useStore((state) => state.isCreditsOpen);
  const closeCredits = useStore((state) => state.closeCredits);

  return (
    <Modal
      isOpen={isCreditsOpen}
      onClose={closeCredits}
      title="Credits & Acknowledgements"
      maxWidth={700}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          style={{
            textAlign: 'center',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h1 style={{ fontSize: '36px', color: 'var(--accent)', marginBottom: '4px' }}>
            {GAME_TITLE}
          </h1>
          <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            Version {GAME_VERSION} · OpenGame Game Jam #1
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>
            Created By
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '15px' }}>{CREDITS.developer}</p>
        </div>

        <div>
          <h3 style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>
            Design & Asset Production
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '15px' }}>{CREDITS.collaborators}</p>
        </div>

        <div>
          <h3 style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>
            OpenGame Jam Sponsor Tools
          </h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {CREDITS.sponsors.map((s) => (
              <li key={s} style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
                • {s}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>
            Open Source Libraries & Fonts
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {CREDITS.libraries.map((lib) => (
              <div
                key={lib.name}
                style={{
                  background: 'var(--surface-2)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-s)',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{lib.name}</span>
                <span style={{ color: 'var(--text-faint)' }}>{lib.license}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
