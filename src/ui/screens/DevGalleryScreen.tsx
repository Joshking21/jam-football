// Implements SPEC M0.4 Dev-only asset & procedural gallery screen (?dev=gallery)
import React from 'react';
import { Crest } from '@/ui/components/Crest';
import { Portrait } from '@/ui/components/Portrait';
import { KitIcon } from '@/ui/components/KitIcon';
import { generateFlagSvg, NationCode } from '@/assets/procedural/flags';
import { KitPattern } from '@/assets/procedural/kit';

const CLUBS = [
  { id: 'c01', name: 'Port Calloway FC', code: 'PCF', p: '#0B1F3A', s: '#F2B705' },
  { id: 'c02', name: 'Ironvale Athletic', code: 'IVA', p: '#2B2B2B', s: '#FF6A13' },
  { id: 'c03', name: 'Kestrel Bay FC', code: 'KBF', p: '#0E8C8C', s: '#FFFFFF' },
  { id: 'c04', name: 'Saltmere Rovers', code: 'SAL', p: '#6D1A36', s: '#8FC5E8' },
  { id: 'c05', name: 'Brightwater City', code: 'BWC', p: '#4FA3E0', s: '#FFFFFF' },
  { id: 'c06', name: 'Northgate Albion', code: 'NGA', p: '#1E7B3C', s: '#FFFFFF' },
  { id: 'c07', name: 'Ashcombe United', code: 'ASU', p: '#C8102E', s: '#111111' },
  { id: 'c08', name: 'Veldmoor Town', code: 'VDT', p: '#4B2A7B', s: '#FFFFFF' },
  { id: 'c09', name: 'Lindenfield FC', code: 'LIN', p: '#FFD100', s: '#111111' },
  { id: 'c10', name: 'Corvallen Wanderers', code: 'COR', p: '#111111', s: '#FFFFFF' },
];

const NATIONS: NationCode[] = [
  'ENG',
  'NGA',
  'FRA',
  'ESP',
  'BRA',
  'NED',
  'GHA',
  'POR',
  'GER',
  'IRL',
  'SEN',
  'SCO',
  'ARG',
  'DEN',
];

const PATTERNS: KitPattern[] = ['solid', 'stripes', 'hoops', 'halves', 'sash', 'chevron'];

export const DevGalleryScreen: React.FC<{ onBackToTitle: () => void }> = ({ onBackToTitle }) => {
  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <div>
          <h1>Procedural Asset Gallery</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            Dev-only inspection view (SPEC M0.4)
          </p>
        </div>
        <button
          onClick={onBackToTitle}
          style={{
            padding: '10px 20px',
            background: 'var(--surface-3)',
            color: 'var(--text)',
            borderRadius: 'var(--radius-m)',
            fontWeight: 600,
          }}
        >
          Back to Game
        </button>
      </div>

      {/* Crests */}
      <section style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '24px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '8px',
          }}
        >
          Procedural Club Crests (10 Clubs)
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {CLUBS.map((c) => (
            <div
              key={c.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-l)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Crest
                clubId={c.id}
                code={c.code}
                primaryColor={c.p}
                secondaryColor={c.s}
                size={64}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{c.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                  {c.code} · {c.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Avatars */}
      <section style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '24px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '8px',
          }}
        >
          Procedural Player Avatars
        </h2>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {CLUBS.slice(0, 6).map((c, i) => (
            <div
              key={c.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-m)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Portrait
                playerId={`p000${i + 1}`}
                initials={c.code.slice(0, 2)}
                primaryColor={c.p}
                secondaryColor={c.s}
                size={56}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Player {i + 1}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Kit Patterns */}
      <section style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '24px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '8px',
          }}
        >
          Kit Patterns
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {PATTERNS.map((pattern, idx) => (
            <div
              key={pattern}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-m)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <KitIcon
                kit={{
                  shirt: '#0B1F3A',
                  shirt2: '#F2B705',
                  pattern,
                  shorts: '#FFFFFF',
                  socks: '#0B1F3A',
                  text: '#FFFFFF',
                }}
                size={64}
                squadNumber={idx + 7}
              />
              <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '14px' }}>
                {pattern}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Flags */}
      <section style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '24px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '8px',
          }}
        >
          National Flags (14 Nations)
        </h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {NATIONS.map((code) => (
            <div
              key={code}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-s)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: generateFlagSvg(code, 28, 19) }} />
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '15px' }}>
                {code}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
