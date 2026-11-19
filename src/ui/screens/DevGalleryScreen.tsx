// Implements SPEC M0.4 and M1 Dev inspection screens
import React, { useState } from 'react';
import { Crest } from '@/ui/components/Crest';
import { Portrait } from '@/ui/components/Portrait';
import { KitIcon } from '@/ui/components/KitIcon';
import { generateFlagSvg, NationCode } from '@/assets/procedural/flags';
import { KitPattern } from '@/assets/procedural/kit';
import snapshot from '@/core/world/world.snapshot.json';
import { formatMoney } from '@/core/math';
import { getPrimaryOvr } from '@/core/player/ratings';
import { valueOf } from '@/core/player/value';

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
  const [selectedClubId, setSelectedClubId] = useState('c01');
  const [viewMode, setViewMode] = useState<'assets' | 'squads'>('squads');

  const selectedClub = (snapshot.clubs as any)[selectedClubId];
  const squadPlayers = selectedClub
    ? selectedClub.squad.map((pid: string) => (snapshot.players as any)[pid])
    : [];

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
          <h1>Dev Inspection & World Explorer</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            Meridian League 10 Clubs · 280 Players · 90 Fixtures (SPEC M0.4 & M1)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-2)',
              padding: '4px',
              borderRadius: 'var(--radius-m)',
            }}
          >
            <button
              onClick={() => setViewMode('squads')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-s)',
                background: viewMode === 'squads' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'squads' ? 'var(--accent-ink)' : 'var(--text-dim)',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Squads & World (M1)
            </button>
            <button
              onClick={() => setViewMode('assets')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-s)',
                background: viewMode === 'assets' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'assets' ? 'var(--accent-ink)' : 'var(--text-dim)',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Procedural Assets (M0)
            </button>
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
      </div>

      {viewMode === 'squads' ? (
        <div>
          {/* Club selector chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {CLUBS.map((c) => {
              const isSel = c.id === selectedClubId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClubId(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-m)',
                    background: isSel ? 'var(--surface-3)' : 'var(--surface)',
                    border: isSel ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: isSel ? 'var(--accent)' : 'var(--text)',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  <Crest
                    clubId={c.id}
                    code={c.code}
                    primaryColor={c.p}
                    secondaryColor={c.s}
                    size={20}
                  />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Club Details Card */}
          {selectedClub && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-l)',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Crest
                    clubId={selectedClub.id}
                    code={selectedClub.code}
                    primaryColor={selectedClub.colors.primary}
                    secondaryColor={selectedClub.colors.secondary}
                    size={64}
                  />
                  <div>
                    <h2 style={{ fontSize: '28px' }}>{selectedClub.name}</h2>
                    <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
                      {selectedClub.nickname} · {selectedClub.city} · Stadium:{' '}
                      {selectedClub.stadium.name} ({selectedClub.stadium.capacity.toLocaleString()}{' '}
                      seats)
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Reputation
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)' }}>
                      {'★'.repeat(selectedClub.reputation)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Transfer Budget
                    </div>
                    <div
                      style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-head)' }}
                    >
                      {formatMoney(selectedClub.transferBudget)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Weekly Wage Budget
                    </div>
                    <div
                      style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-head)' }}
                    >
                      {formatMoney(selectedClub.wageBudget)}/wk
                    </div>
                  </div>
                </div>
              </div>

              {/* Squad Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--text-faint)',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '8px' }}>#</th>
                    <th style={{ padding: '8px' }}>Player</th>
                    <th style={{ padding: '8px' }}>Nat</th>
                    <th style={{ padding: '8px' }}>Pos</th>
                    <th style={{ padding: '8px' }}>Age</th>
                    <th style={{ padding: '8px' }}>OVR</th>
                    <th style={{ padding: '8px' }}>Pot</th>
                    <th style={{ padding: '8px' }}>Role</th>
                    <th style={{ padding: '8px' }}>Value</th>
                    <th style={{ padding: '8px' }}>Wage</th>
                  </tr>
                </thead>
                <tbody>
                  {squadPlayers.map((p: any) => {
                    const ovr = getPrimaryOvr(p);
                    const isKey = p.contract?.role === 'Star';
                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid rgba(38, 53, 87, 0.4)',
                          background: isKey ? 'rgba(0, 229, 143, 0.05)' : 'transparent',
                        }}
                      >
                        <td
                          style={{
                            padding: '8px',
                            color: 'var(--text-dim)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {p.squadNumber}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>
                          <span style={{ marginRight: '6px' }}>
                            {p.knownAs || `${p.firstName} ${p.lastName}`}
                          </span>
                          {isKey && (
                            <span
                              style={{
                                fontSize: '10px',
                                background: 'var(--accent)',
                                color: 'var(--accent-ink)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Key Player
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <span
                              dangerouslySetInnerHTML={{
                                __html: generateFlagSvg(p.nationality, 18, 12),
                              }}
                            />
                            <span>{p.nationality}</span>
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '8px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-head)',
                          }}
                        >
                          {p.positions[0].pos}
                        </td>
                        <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums' }}>
                          {p.age}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background:
                                ovr >= 75
                                  ? 'var(--win)'
                                  : ovr >= 65
                                    ? 'var(--accent)'
                                    : 'var(--warning)',
                              color: 'var(--accent-ink)',
                              fontWeight: 700,
                              fontFamily: 'var(--font-head)',
                            }}
                          >
                            {ovr}
                          </span>
                        </td>
                        <td
                          style={{ padding: '8px', color: 'var(--gold)', letterSpacing: '0.1em' }}
                        >
                          {'★'.repeat(
                            p.potential >= 85
                              ? 5
                              : p.potential >= 78
                                ? 4
                                : p.potential >= 71
                                  ? 3
                                  : p.potential >= 64
                                    ? 2
                                    : 1,
                          )}
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-dim)' }}>
                          {p.contract?.role}
                        </td>
                        <td
                          style={{
                            padding: '8px',
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-head)',
                          }}
                        >
                          {formatMoney(valueOf(p))}
                        </td>
                        <td
                          style={{
                            padding: '8px',
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-head)',
                          }}
                        >
                          {formatMoney(p.contract?.wagePerWeek || 0)}/wk
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Procedural Assets Gallery */}
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
                  <span
                    style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '15px' }}
                  >
                    {code}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
