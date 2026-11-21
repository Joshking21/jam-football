// Implements SPEC §11.10 Transfers & Scouting screen (office world)
// Outside windows: Scouting network and player database search.
// In windows: Day 1/2/Deadline Day rounds, bids, contract offers.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { Player } from '../../core/types';
import { formatMoney } from '../../core/math';
import { getPrimaryOvr } from '../../core/player/ratings';
import { ArrowLeftRight, Search, Binoculars, DollarSign } from 'lucide-react';

export const TransfersScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const openPlayerProfile = useStore((state) => state.openPlayerProfile);

  const [searchQuery, setSearchQuery] = useState('');
  const [clubFilter, setClubFilter] = useState<string>('all');
  const [posFilter, setPosFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT'>('ALL');

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const isWindowOpen = gameState.phase === 'TransferWindow';

  // Filter other clubs players & free agents (§12.12)
  const otherPlayers = Object.values(gameState.players).filter((p) => {
    if (p.clubId === userClub.id) return false;
    if (clubFilter === 'free_agents') return p.clubId === null;
    if (clubFilter !== 'all') return p.clubId === clubFilter;
    return true;
  });

  const filteredPlayers = otherPlayers
    .filter((p) => {
      if (posFilter !== 'ALL') {
        const prim = p.positions[0]?.pos;
        if (posFilter === 'GK' && prim !== 'GK') return false;
        if (posFilter === 'DEF' && (!prim || !['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(prim)))
          return false;
        if (posFilter === 'MID' && (!prim || !['DM', 'CM', 'AM', 'LM', 'RM'].includes(prim)))
          return false;
        if (posFilter === 'ATT' && (!prim || !['CF', 'ST', 'LW', 'RW'].includes(prim)))
          return false;
      }
      if (!searchQuery.trim()) return true;
      const name = `${p.firstName} ${p.lastName}`.toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));

  return (
    <div className="app-content-area office-surface" style={{ height: '100%' }}>
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <Sheet id="transfers-overview" variant="memo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--paper-rule)',
                paddingBottom: '16px',
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '28px',
                    fontFamily: 'var(--font-head)',
                    color: 'var(--paper-ink)',
                    margin: 0,
                  }}
                >
                  {isWindowOpen ? 'TRANSFER MARKET WINDOW' : 'SCOUTING & PLAYER RECRUITMENT'}
                </h1>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', marginTop: '2px' }}
                >
                  {isWindowOpen
                    ? 'Window Active · Submit bids and contract terms'
                    : 'Window Closed · Scouting Network Active (Opens Matchday 9)'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                  TRANSFER BUDGET
                </div>
                <div
                  className="stat-number tabular-nums"
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: 'var(--paper-ink)',
                  }}
                >
                  {formatMoney(userClub.transferBudget)}
                </div>
              </div>
            </div>

            {/* Search & Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--paper-rule)',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  minWidth: '260px',
                }}
              >
                <Search size={16} color="var(--paper-dim)" />
                <input
                  type="text"
                  placeholder="Search player name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--paper-ink)',
                    fontSize: '14px',
                    width: '100%',
                  }}
                />
              </div>

              {/* Club Filter */}
              <select
                value={clubFilter}
                onChange={(e) => setClubFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--paper-2)',
                  color: 'var(--paper-ink)',
                  border: '1px solid var(--paper-rule)',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Clubs</option>
                <option value="free_agents">Free Agents</option>
                {Object.values(gameState.clubs)
                  .filter((c) => c.id !== userClub.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>

              {/* Position Filter */}
              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value as any)}
                style={{
                  backgroundColor: 'var(--paper-2)',
                  color: 'var(--paper-ink)',
                  border: '1px solid var(--paper-rule)',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Positions</option>
                <option value="GK">Goalkeepers</option>
                <option value="DEF">Defenders</option>
                <option value="MID">Midfielders</option>
                <option value="ATT">Attackers</option>
              </select>
            </div>

            {/* Players List Table */}
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}
              >
                <thead>
                  <tr
                    className="broadcast-label"
                    style={{
                      borderBottom: '2px solid var(--paper-rule)',
                      color: 'var(--paper-dim)',
                    }}
                  >
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>PLAYER</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>CLUB</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>POS</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>AGE</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>WAGE</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.slice(0, 25).map((p) => {
                    const pClub = p.clubId ? gameState.clubs[p.clubId] : null;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => openPlayerProfile(p.id)}
                        style={{
                          borderBottom: '1px solid var(--paper-rule)',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '10px' }}>
                          <strong>{p.knownAs ?? `${p.firstName} ${p.lastName}`}</strong>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--paper-dim)',
                            }}
                          >
                            {p.nationality}
                          </div>
                        </td>
                        <td style={{ padding: '10px' }}>{pClub ? pClub.name : 'Free Agent'}</td>
                        <td style={{ padding: '10px' }}>
                          <span
                            className="broadcast-label"
                            style={{
                              backgroundColor: 'var(--paper-2)',
                              padding: '2px 6px',
                              borderRadius: '2px',
                              border: '1px solid var(--paper-rule)',
                            }}
                          >
                            {p.positions[0]?.pos}
                          </span>
                        </td>
                        <td className="tabular-nums" style={{ padding: '10px' }}>
                          {p.age}
                        </td>
                        <td
                          className="tabular-nums"
                          style={{ padding: '10px', textAlign: 'right' }}
                        >
                          {p.contract ? `${formatMoney(p.contract.wagePerWeek)}/w` : '-'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <Button
                            variant="secondary"
                            size="s"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPlayerProfile(p.id);
                            }}
                          >
                            Inspect Report
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  );
};
