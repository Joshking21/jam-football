// Implements SPEC §11.6 Squad screen (office world)
// Detailed squad table with portrait thumb, position, age, OVR badge, potential stars, condition bar,
// morale icon, form dots, stats (Apps, Goals, Assists, Avg rating), Value, Wage, Contract, Status chips.
// Filters: All / GK / DEF / MID / FWD / Injured / Unhappy. Sortable. Row click opens Player Profile.
import React, { useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import { Player, Position } from '../../core/types';
import { Portrait } from '../components/Portrait';
import { formatMoney } from '../../core/math';
import { Stamp } from '../components/Stamp';
import { Star, AlertTriangle, ShieldAlert, HeartCrack, Search } from 'lucide-react';

type SquadFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD' | 'INJURED' | 'UNHAPPY';

export const SquadScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const openPlayerProfile = useStore((state) => state.openPlayerProfile);

  const [activeFilter, setActiveFilter] = useState<SquadFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('ovr');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const squadPlayers: Player[] = userClub.squad
    .map((id) => gameState.players[id])
    .filter((p): p is Player => p != null);

  // Helper for potential stars (SPEC §12.12)
  const getPotentialStars = (pot: number): number => {
    if (pot >= 85) return 5;
    if (pot >= 78) return 4;
    if (pot >= 71) return 3;
    if (pot >= 64) return 2;
    return 1;
  };

  // Helper for OVR color (SPEC §19.4)
  const getOvrColor = (ovr: number): string => {
    if (ovr >= 85) return 'var(--attr-elite)';
    if (ovr >= 75) return 'var(--attr-great)';
    if (ovr >= 65) return 'var(--attr-good)';
    if (ovr >= 55) return 'var(--attr-avg)';
    if (ovr >= 40) return 'var(--attr-subpar)';
    return 'var(--attr-poor)';
  };

  // Helper for form dot color (SPEC §19.4)
  const getFormColor = (rating: number): string => {
    if (rating >= 8.0) return 'var(--gold)';
    if (rating >= 7.0) return 'var(--win)';
    if (rating >= 6.0) return 'var(--text-dim)';
    return 'var(--loss)';
  };

  // Filtered & sorted squad
  const displayedPlayers = useMemo(() => {
    return squadPlayers
      .filter((p) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
          if (!fullName.includes(q)) return false;
        }

        // Category filter
        const primaryPos = p.positions[0]?.pos ?? '';
        switch (activeFilter) {
          case 'GK':
            return primaryPos === 'GK';
          case 'DEF':
            return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(primaryPos);
          case 'MID':
            return ['DM', 'CM', 'AM', 'LM', 'RM'].includes(primaryPos);
          case 'FWD':
            return ['LW', 'RW', 'ST'].includes(primaryPos);
          case 'INJURED':
            return p.injury !== null;
          case 'UNHAPPY':
            return p.morale < 40;
          case 'ALL':
          default:
            return true;
        }
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        switch (sortField) {
          case 'name':
            valA = a.lastName;
            valB = b.lastName;
            break;
          case 'pos':
            valA = a.positions[0]?.pos ?? '';
            valB = b.positions[0]?.pos ?? '';
            break;
          case 'age':
            valA = a.age;
            valB = b.age;
            break;
          case 'ovr':
            // Approximate OVR by primary attributes
            valA = Math.round(
              (a.attributes.passing +
                a.attributes.finishing +
                a.attributes.tackling +
                a.attributes.pace) /
                4,
            );
            valB = Math.round(
              (b.attributes.passing +
                b.attributes.finishing +
                b.attributes.tackling +
                b.attributes.pace) /
                4,
            );
            break;
          case 'pot':
            valA = a.potential;
            valB = b.potential;
            break;
          case 'cond':
            valA = a.condition;
            valB = b.condition;
            break;
          case 'apps':
            valA = a.stats.apps;
            valB = b.stats.apps;
            break;
          case 'goals':
            valA = a.stats.goals;
            valB = b.stats.goals;
            break;
          case 'assists':
            valA = a.stats.assists;
            valB = b.stats.assists;
            break;
          case 'rating':
            valA = a.stats.ratedApps > 0 ? a.stats.ratingSum / a.stats.ratedApps : 0;
            valB = b.stats.ratedApps > 0 ? b.stats.ratingSum / b.stats.ratedApps : 0;
            break;
          default:
            valA = a.squadNumber ?? 99;
            valB = b.squadNumber ?? 99;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [squadPlayers, activeFilter, searchQuery, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="app-content-area office-surface" style={{ height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          height: '100%',
        }}
      >
        {/* Controls Bar: Filters & Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Category Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              backgroundColor: 'var(--surface)',
              padding: '4px',
              borderRadius: 'var(--radius-m)',
              border: '1px solid var(--border)',
            }}
          >
            {(['ALL', 'GK', 'DEF', 'MID', 'FWD', 'INJURED', 'UNHAPPY'] as SquadFilter[]).map(
              (filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className="broadcast-label"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-s)',
                    backgroundColor: activeFilter === filter ? 'var(--accent)' : 'transparent',
                    color: activeFilter === filter ? 'var(--accent-ink)' : 'var(--text-dim)',
                    fontWeight: 700,
                    fontSize: '12px',
                    transition: 'all var(--dur-fast)',
                  }}
                >
                  {filter}
                </button>
              ),
            )}
          </div>

          {/* Search box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-m)',
              padding: '6px 12px',
              minWidth: '240px',
            }}
          >
            <Search size={16} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Search squad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '14px',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Squad Table Container */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-s)',
            overflow: 'auto',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead
              style={{
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--surface-2)',
                borderBottom: '2px solid var(--border)',
                zIndex: 10,
              }}
            >
              <tr className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                <th
                  onClick={() => handleSort('number')}
                  style={{ padding: '12px 14px', width: '40px', cursor: 'pointer' }}
                >
                  #
                </th>
                <th
                  onClick={() => handleSort('name')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  Player
                </th>
                <th
                  onClick={() => handleSort('pos')}
                  style={{ padding: '12px 14px', width: '60px', cursor: 'pointer' }}
                >
                  Pos
                </th>
                <th
                  onClick={() => handleSort('age')}
                  style={{ padding: '12px 14px', width: '50px', cursor: 'pointer' }}
                >
                  Age
                </th>
                <th
                  onClick={() => handleSort('ovr')}
                  style={{ padding: '12px 14px', width: '50px', cursor: 'pointer' }}
                >
                  OVR
                </th>
                <th
                  onClick={() => handleSort('pot')}
                  style={{ padding: '12px 14px', width: '80px', cursor: 'pointer' }}
                >
                  Pot
                </th>
                <th
                  onClick={() => handleSort('cond')}
                  style={{ padding: '12px 14px', width: '100px', cursor: 'pointer' }}
                >
                  Cond
                </th>
                <th style={{ padding: '12px 14px', width: '70px' }}>Morale</th>
                <th style={{ padding: '12px 14px', width: '90px' }}>Form</th>
                <th
                  onClick={() => handleSort('apps')}
                  style={{
                    padding: '12px 14px',
                    width: '50px',
                    textAlign: 'right',
                    cursor: 'pointer',
                  }}
                >
                  Apps
                </th>
                <th
                  onClick={() => handleSort('goals')}
                  style={{
                    padding: '12px 14px',
                    width: '50px',
                    textAlign: 'right',
                    cursor: 'pointer',
                  }}
                >
                  Gls
                </th>
                <th
                  onClick={() => handleSort('assists')}
                  style={{
                    padding: '12px 14px',
                    width: '50px',
                    textAlign: 'right',
                    cursor: 'pointer',
                  }}
                >
                  Ast
                </th>
                <th
                  onClick={() => handleSort('rating')}
                  style={{
                    padding: '12px 14px',
                    width: '60px',
                    textAlign: 'right',
                    cursor: 'pointer',
                  }}
                >
                  Avg
                </th>
                <th style={{ padding: '12px 14px', width: '90px', textAlign: 'right' }}>Wage</th>
                <th style={{ padding: '12px 14px', width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedPlayers.map((player) => {
                const ovr = Math.round(
                  (player.attributes.passing +
                    player.attributes.finishing +
                    player.attributes.tackling +
                    player.attributes.pace) /
                    4,
                );
                const potStars = getPotentialStars(player.potential);

                return (
                  <tr
                    key={player.id}
                    onClick={() => openPlayerProfile(player.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openPlayerProfile(player.id);
                    }}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background-color var(--dur-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface-3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Squad Number */}
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 14px',
                        color: 'var(--text-faint)',
                        fontWeight: 600,
                      }}
                    >
                      {player.squadNumber ?? '-'}
                    </td>

                    {/* Name + Portrait Thumbnail */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Portrait
                          playerId={player.id}
                          initials={`${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`}
                          primaryColor={userClub.colors.primary}
                          secondaryColor={userClub.colors.secondary}
                          size={32}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {player.knownAs ?? `${player.firstName} ${player.lastName}`}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            {player.nationality} · {player.foot} footed
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Primary Position */}
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        className="broadcast-label"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-s)',
                          color: 'var(--text)',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        {player.positions[0]?.pos}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="tabular-nums" style={{ padding: '10px 14px' }}>
                      {player.age}
                    </td>

                    {/* OVR Badge */}
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        className="tabular-nums"
                        style={{
                          backgroundColor: getOvrColor(ovr),
                          color: '#000000',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}
                      >
                        {ovr}
                      </span>
                    </td>

                    {/* Potential Stars */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            fill={s <= potStars ? 'var(--gold)' : 'transparent'}
                            color={s <= potStars ? 'var(--gold)' : 'var(--text-faint)'}
                          />
                        ))}
                      </div>
                    </td>

                    {/* Condition Bar */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '45px',
                            height: '6px',
                            backgroundColor: 'var(--surface-3)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${player.condition}%`,
                              height: '100%',
                              backgroundColor:
                                player.condition >= 75
                                  ? 'var(--win)'
                                  : player.condition >= 50
                                    ? 'var(--warning)'
                                    : 'var(--loss)',
                            }}
                          />
                        </div>
                        <span
                          className="tabular-nums"
                          style={{ fontSize: '11px', color: 'var(--text-dim)' }}
                        >
                          {player.condition}%
                        </span>
                      </div>
                    </td>

                    {/* Morale */}
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color:
                            player.morale >= 70
                              ? 'var(--win)'
                              : player.morale >= 40
                                ? 'var(--text-dim)'
                                : 'var(--loss)',
                        }}
                      >
                        {player.morale >= 75
                          ? 'Superb'
                          : player.morale >= 60
                            ? 'Good'
                            : player.morale >= 40
                              ? 'Fair'
                              : 'Unhappy'}
                      </span>
                    </td>

                    {/* Form Dots (Last 5) */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {player.form.length === 0 ? (
                          <span style={{ color: 'var(--text-faint)', fontSize: '11px' }}>-</span>
                        ) : (
                          player.form.slice(-5).map((rating, idx) => (
                            <span
                              key={idx}
                              title={`Rating: ${rating.toFixed(1)}`}
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: getFormColor(rating),
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>

                    {/* Apps */}
                    <td
                      className="tabular-nums"
                      style={{ padding: '10px 14px', textAlign: 'right' }}
                    >
                      {player.stats.apps}
                    </td>

                    {/* Goals */}
                    <td
                      className="tabular-nums"
                      style={{ padding: '10px 14px', textAlign: 'right' }}
                    >
                      {player.stats.goals}
                    </td>

                    {/* Assists */}
                    <td
                      className="tabular-nums"
                      style={{ padding: '10px 14px', textAlign: 'right' }}
                    >
                      {player.stats.assists}
                    </td>

                    {/* Average Rating */}
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color:
                          player.stats.ratedApps > 0
                            ? getFormColor(player.stats.ratingSum / player.stats.ratedApps)
                            : 'var(--text-dim)',
                      }}
                    >
                      {player.stats.ratedApps > 0
                        ? (player.stats.ratingSum / player.stats.ratedApps).toFixed(2)
                        : '-'}
                    </td>

                    {/* Wage */}
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontSize: '12px',
                        color: 'var(--text-dim)',
                      }}
                    >
                      {player.contract ? `${formatMoney(player.contract.wagePerWeek)}/w` : '-'}
                    </td>

                    {/* Status Icons / Chips */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {player.injury && (
                          <span
                            title={player.injury.kind}
                            style={{
                              backgroundColor: 'rgba(255, 77, 94, 0.2)',
                              color: 'var(--loss)',
                              padding: '2px 5px',
                              borderRadius: '2px',
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-head)',
                            }}
                          >
                            INJ ({player.injury.matchdaysOut}m)
                          </span>
                        )}
                        {player.suspendedMatches > 0 && (
                          <span
                            style={{
                              backgroundColor: 'rgba(255, 176, 32, 0.2)',
                              color: 'var(--warning)',
                              padding: '2px 5px',
                              borderRadius: '2px',
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-head)',
                            }}
                          >
                            BAN ({player.suspendedMatches}m)
                          </span>
                        )}
                        {player.transferListed && (
                          <span
                            style={{
                              backgroundColor: 'rgba(61, 165, 255, 0.2)',
                              color: 'var(--info)',
                              padding: '2px 5px',
                              borderRadius: '2px',
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-head)',
                            }}
                          >
                            LISTED
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
