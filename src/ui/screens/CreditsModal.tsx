// Implements SPEC §11.23 Credits Modal formatted as Today's Team Sheet
// Design Reference: docs/design/extras/index.html
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
      title="Credits · Team Sheet"
      maxWidth={680}
    >
      <div
        style={{
          background: '#EFEBE3',
          color: '#141414',
          padding: '28px 36px',
          borderRadius: '4px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <h2
          style={{
            margin: '0 0 4px',
            fontFamily: 'Georgia, serif',
            fontWeight: 900,
            fontSize: '32px',
            textAlign: 'center',
            color: '#070C18',
          }}
        >
          Today's Team Sheet
        </h2>
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#5E574E',
            borderBottom: '3px double #141414',
            paddingBottom: '12px',
            marginBottom: '18px',
          }}
        >
          {GAME_TITLE} {GAME_VERSION} · OpenGame Game Jam #1
        </div>

        {/* The Starting Eleven */}
        <h4
          style={{
            margin: '14px 0 10px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#141414',
            borderBottom: '1px solid rgba(0, 0, 0, 0.15)',
            paddingBottom: '4px',
          }}
        >
          The Starting Eleven
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 1fr',
            gap: '8px 12px',
            alignItems: 'center',
          }}
        >
          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            1
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            {CREDITS.developer}
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>Game direction & development</span>

          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            2
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            Gemini
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>Code & engine, from the spec</span>

          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            3
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            Claude
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>
            Design, 3D assets & art direction
          </span>
        </div>

        {/* On the Bench (Tools) */}
        <h4
          style={{
            margin: '22px 0 10px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#141414',
            borderBottom: '1px solid rgba(0, 0, 0, 0.15)',
            paddingBottom: '4px',
          }}
        >
          On The Bench (Jam Sponsors & Tools)
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 1fr',
            gap: '8px 12px',
            alignItems: 'center',
          }}
        >
          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            12
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            ElevenLabs
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>
            Voices, commentary & crowd audio
          </span>

          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            14
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            fal.ai
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>Portraits & press photography</span>

          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            16
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            Meshy
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>
            Stadium, players & 3D club spaces
          </span>

          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            18
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            Three.js & React
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>3D match renderer & UI (MIT)</span>

          <b
            style={{
              color: '#8E8578',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
            }}
          >
            20
          </b>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
            }}
          >
            Typefoundries
          </span>
          <span style={{ fontSize: '13px', color: '#5E574E' }}>
            Barlow Condensed, Inter, Playfair Display
          </span>
        </div>

        {/* Disclaimer / Acknowledgement */}
        <h4
          style={{
            margin: '22px 0 6px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#141414',
            borderBottom: '1px solid rgba(0, 0, 0, 0.15)',
            paddingBottom: '4px',
          }}
        >
          Notice
        </h4>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: '12.5px',
            lineHeight: 1.45,
            color: '#5E574E',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            textAlign: 'center',
          }}
        >
          Every club, player, newspaper and town in Touchline is fictional. Any resemblance to real
          persons or entities is purely coincidental.
        </p>
      </div>
    </Modal>
  );
};
