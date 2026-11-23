// Implements SPEC §11.13 Club screen (office world)
// Tabs: Finances (balance, income/expense breakdown, weekly wages),
// Board (confidence meter, expectations), Fans (mood meter, attendance),
// Dressing Room (leaders, cohesion, morale spread), Staff (assistant, coach, scout, physio & replacement),
// Stadium (name, capacity).
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { CountUp } from '../components/CountUp';
import { formatMoney } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { Crest } from '../components/Crest';
import { Portrait } from '../components/Portrait';
import { StaffRole, StaffMember } from '../../core/types';
import {
  getClubLeaders,
  calculateLeaderScore,
  generateStaffCandidates,
} from '../../core/club/clubDepth';
import {
  DollarSign,
  TrendingUp,
  Building,
  Users,
  Target,
  ShieldCheck,
  Star,
  Shield,
  Award,
  RefreshCw,
  X,
  AlertCircle,
  HeartHandshake,
} from 'lucide-react';

type ClubTab = 'FINANCES' | 'BOARD' | 'FANS' | 'DRESSING_ROOM' | 'STAFF' | 'STADIUM';

export const ClubScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const hireStaffMember = useStore((state) => state.hireStaffMember);
  const showToast = useStore((state) => state.showToast);
  const [activeTab, setActiveTab] = useState<ClubTab>('FINANCES');
  const [replacingRole, setReplacingRole] = useState<StaffRole | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Compute total weekly squad wages & staff wages
  const squadPlayers = userClub.squad.map((id) => gameState.players[id]).filter((p) => p != null);
  const currentWeeklyWage = squadPlayers.reduce(
    (sum, p) => sum + (p.contract?.wagePerWeek ?? 0),
    0,
  );
  const staffWages = userClub.staff
    ? userClub.staff.assistant.wage +
      userClub.staff.coach.wage +
      userClub.staff.scout.wage +
      userClub.staff.physio.wage
    : 0;

  const isWindowActive = gameState.window !== null;
  const dressingRoomLeaders = getClubLeaders(userClub, gameState.players);
  const meanLeaderMorale =
    dressingRoomLeaders.length > 0
      ? Math.round(
          dressingRoomLeaders.reduce((sum, l) => sum + l.morale, 0) / dressingRoomLeaders.length,
        )
      : 55;

  const currentCohesion = userClub.cohesion ?? BALANCE.club.cohesionInitial;
  const cohesionModifier = (
    (currentCohesion - 50) *
    BALANCE.club.cohesionMatchExecutionFactor *
    100
  ).toFixed(1);

  return (
    <div className="app-content-area office-surface" style={{ height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        {/* Header with Club Crest & Tab Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--desk-border)',
            paddingBottom: '0',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '12px' }}
          >
            <Crest
              clubId={userClub.id}
              code={userClub.code}
              primaryColor={userClub.colors.primary}
              secondaryColor={userClub.colors.secondary}
              size={52}
            />
            <div>
              <h1
                style={{
                  fontSize: '32px',
                  fontFamily: 'var(--font-head)',
                  color: 'var(--text)',
                  margin: 0,
                  letterSpacing: '0.04em',
                }}
              >
                {userClub.name.toUpperCase()} CLUB OVERVIEW
              </h1>
              <div
                className="broadcast-label"
                style={{ color: 'var(--text-dim)', marginTop: '4px', fontSize: '13px' }}
              >
                Founded {userClub.founded} · {userClub.city}
              </div>
            </div>
          </div>

          {/* Paper index tabs */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {(['FINANCES', 'BOARD', 'FANS', 'DRESSING_ROOM', 'STAFF', 'STADIUM'] as ClubTab[]).map(
              (tab) => {
                const isActive = activeTab === tab;
                const label =
                  tab === 'DRESSING_ROOM' ? 'DRESSING ROOM' : tab === 'STAFF' ? 'STAFF' : tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="broadcast-label"
                    style={{
                      padding: '10px 16px 8px',
                      borderRadius: '6px 6px 0 0',
                      backgroundColor: isActive ? 'var(--paper)' : 'var(--desk-2)',
                      color: isActive ? 'var(--paper-ink)' : 'var(--text-dim)',
                      border: isActive
                        ? '1px solid var(--paper-rule)'
                        : '1px solid var(--desk-border)',
                      borderBottom: isActive ? '2px solid var(--paper)' : 'none',
                      marginBottom: isActive ? '-2px' : '0',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      boxShadow: isActive ? '0 -2px 6px rgba(0,0,0,0.25)' : 'none',
                      transition: 'background-color 150ms ease, color 150ms ease',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Tab 1: Finances */}
        {activeTab === 'FINANCES' && (
          <Sheet id="club-finances-ledger" variant="ledger">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--paper-dim)',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '8px',
                }}
              >
                FINANCIAL LEDGER & PROJECTIONS
              </div>

              {/* Main Balance Display */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  backgroundColor: 'var(--paper-2)',
                  padding: '16px',
                  borderRadius: '4px',
                  border: '1px solid var(--paper-rule)',
                }}
              >
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    OVERALL BALANCE
                  </div>
                  <div
                    className="stat-number tabular-nums"
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: userClub.balance >= 0 ? 'var(--paper-ink)' : 'var(--marker-red)',
                    }}
                  >
                    <CountUp value={userClub.balance} format={formatMoney} />
                  </div>
                </div>

                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    TRANSFER BUDGET
                  </div>
                  <div
                    className="stat-number tabular-nums"
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: 'var(--paper-ink)',
                    }}
                  >
                    <CountUp value={userClub.transferBudget} format={formatMoney} />
                  </div>
                </div>

                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    WEEKLY WAGE BUDGET
                  </div>
                  <div
                    className="stat-number tabular-nums"
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: 'var(--paper-ink)',
                    }}
                  >
                    {formatMoney(userClub.wageBudget)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                    Payroll: {formatMoney(currentWeeklyWage + staffWages)}/wk
                  </div>
                </div>
              </div>

              {/* Income / Expense Table */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
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
                    <th style={{ padding: '8px 0', textAlign: 'left' }}>CATEGORY</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>ESTIMATED PER MATCHDAY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--paper-rule)' }}>
                    <td style={{ padding: '10px 0' }}>TV Broadcast Rights</td>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--marker-green)',
                      }}
                    >
                      +€600,000
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--paper-rule)' }}>
                    <td style={{ padding: '10px 0' }}>Commercial Sponsorship</td>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--marker-green)',
                      }}
                    >
                      +
                      {formatMoney(
                        BALANCE.finances.sponsorIncomeWeekly[userClub.reputation] ?? 400_000,
                      )}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--paper-rule)' }}>
                    <td style={{ padding: '10px 0' }}>Squad Wages & Payroll</td>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--marker-red)',
                      }}
                    >
                      -{formatMoney(currentWeeklyWage)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--paper-rule)' }}>
                    <td style={{ padding: '10px 0' }}>Technical & Backroom Staff Payroll</td>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--marker-red)',
                      }}
                    >
                      -{formatMoney(staffWages)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--paper-rule)' }}>
                    <td style={{ padding: '10px 0' }}>Stadium Operations</td>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--marker-red)',
                      }}
                    >
                      -
                      {formatMoney(
                        userClub.reputation * BALANCE.finances.operatingCostPerReputation,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Sheet>
        )}

        {/* Tab 2: Board */}
        {activeTab === 'BOARD' && (
          <Sheet id="club-board-review" variant="memo">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--paper-dim)',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '8px',
                }}
              >
                BOARD DIRECTORS REPORT
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  backgroundColor: 'var(--paper-2)',
                  padding: '20px',
                  borderRadius: '4px',
                  border: '1px solid var(--paper-rule)',
                }}
              >
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    CURRENT CONFIDENCE
                  </div>
                  <div
                    className="stat-number tabular-nums"
                    style={{
                      fontSize: '40px',
                      fontWeight: 700,
                      color:
                        userClub.boardConfidence >= 60
                          ? 'var(--marker-green)'
                          : 'var(--marker-red)',
                    }}
                  >
                    {Math.round(userClub.boardConfidence)}%
                  </div>
                </div>

                <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                    Mandate: {userClub.expectation.label}
                  </div>
                  <div>
                    The board monitors match performance, table standing, and wage discipline.
                    Maintain results to ensure full boardroom backing.
                  </div>
                </div>
              </div>
            </div>
          </Sheet>
        )}

        {/* Tab 3: Fans */}
        {activeTab === 'FANS' && (
          <Sheet id="club-fans-overview" variant="memo">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--paper-dim)',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '8px',
                }}
              >
                SUPPORTERS TRUST & FAN MOOD
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  backgroundColor: 'var(--paper-2)',
                  padding: '20px',
                  borderRadius: '4px',
                  border: '1px solid var(--paper-rule)',
                }}
              >
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    FAN MOOD
                  </div>
                  <div
                    className="stat-number tabular-nums"
                    style={{
                      fontSize: '40px',
                      fontWeight: 700,
                      color: userClub.fanMood >= 50 ? 'var(--marker-green)' : 'var(--marker-red)',
                    }}
                  >
                    {Math.round(userClub.fanMood)}%
                  </div>
                </div>

                <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                    Supporters Sentiment: Optimistic
                  </div>
                  <div>
                    Attendances track team results, exciting attacking play, and derby performances.
                    Wins boost matchday gate revenues.
                  </div>
                </div>
              </div>
            </div>
          </Sheet>
        )}

        {/* Tab 4: Dressing Room */}
        {activeTab === 'DRESSING_ROOM' && (
          <Sheet id="club-dressing-room" variant="memo">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--paper-dim)',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '8px',
                }}
              >
                DRESSING ROOM ATMOSPHERE & COHESION
              </div>

              {/* Cohesion Meter & Tactical Execution Impact */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 2fr',
                  gap: '20px',
                  backgroundColor: 'var(--paper-2)',
                  padding: '20px',
                  borderRadius: '4px',
                  border: '1px solid var(--paper-rule)',
                }}
              >
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    TEAM COHESION
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span
                      className="stat-number tabular-nums"
                      style={{
                        fontSize: '44px',
                        fontWeight: 700,
                        color:
                          currentCohesion >= 65
                            ? 'var(--marker-green)'
                            : currentCohesion >= 45
                              ? 'var(--marker-blue)'
                              : 'var(--marker-red)',
                      }}
                    >
                      {currentCohesion}
                    </span>
                    <span style={{ fontSize: '18px', color: 'var(--paper-dim)' }}>/ 100</span>
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: '6px',
                      padding: '3px 8px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor:
                        currentCohesion >= 65
                          ? 'rgba(46, 125, 50, 0.15)'
                          : currentCohesion >= 45
                            ? 'rgba(31, 79, 191, 0.15)'
                            : 'rgba(211, 47, 47, 0.15)',
                      color:
                        currentCohesion >= 65
                          ? 'var(--marker-green)'
                          : currentCohesion >= 45
                            ? 'var(--marker-blue)'
                            : 'var(--marker-red)',
                    }}
                  >
                    {currentCohesion >= 65
                      ? 'Harmonious & Unified'
                      : currentCohesion >= 45
                        ? 'Stable Dressing Room'
                        : 'Divided & Fractured'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--paper-ink)' }}>
                    Tactical Execution Modifier:{' '}
                    <span
                      className="tabular-nums"
                      style={{
                        color:
                          Number(cohesionModifier) >= 0
                            ? 'var(--marker-green)'
                            : 'var(--marker-red)',
                      }}
                    >
                      {Number(cohesionModifier) >= 0
                        ? `+${cohesionModifier}%`
                        : `${cohesionModifier}%`}
                    </span>
                  </div>
                  <div style={{ color: 'var(--paper-dim)' }}>
                    Cohesion dynamically scales execution across all match moments: passing duels,
                    pressing triggers, marking discipline and finishing consistency ((cohesion - 50)
                    / 1000).
                  </div>
                  <div style={{ color: 'var(--paper-dim)', fontSize: '12px' }}>
                    Weekly drift: Leader morale mean ({meanLeaderMorale}%) pulls squad morale by 10%
                    each week. Match victories grant +1, defeats -1, broken promises -5, and new
                    signings -2 while settling in.
                  </div>
                </div>
              </div>

              {/* Dressing Room Leaders */}
              <div>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', marginBottom: '12px', fontSize: '12px' }}
                >
                  HIERARCHY & SQUAD LEADERS (TOP 3 BY INFLUENCE SCORE)
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {dressingRoomLeaders.map((leader, idx) => {
                    const isCaptain = userClub.tactics.captain === leader.id;
                    const leaderScore = calculateLeaderScore(leader, isCaptain);
                    return (
                      <div
                        key={leader.id}
                        style={{
                          backgroundColor: 'var(--paper-2)',
                          padding: '16px',
                          borderRadius: '4px',
                          border: '1px solid var(--paper-rule)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Portrait
                            playerId={leader.id}
                            initials={`${leader.firstName[0] ?? ''}${leader.lastName[0] ?? ''}`}
                            primaryColor={userClub.colors.primary}
                            secondaryColor={userClub.colors.secondary}
                            size={42}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: '15px',
                                  color: 'var(--paper-ink)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {leader.knownAs ?? `${leader.firstName} ${leader.lastName}`}
                              </span>
                              {isCaptain && (
                                <span
                                  title="Club Captain"
                                  style={{
                                    backgroundColor: 'var(--gold)',
                                    color: '#000',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '2px',
                                  }}
                                >
                                  C
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                              #{leader.squadNumber ?? '-'} · {leader.positions[0]?.pos} · Age{' '}
                              {leader.age} · {leader.stats.apps} apps
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid var(--paper-rule)',
                            paddingTop: '8px',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--paper-dim)' }}>Influence Score: </span>
                            <span className="tabular-nums" style={{ fontWeight: 700 }}>
                              {leaderScore.toFixed(1)}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--paper-dim)' }}>Morale: </span>
                            <span
                              className="tabular-nums"
                              style={{
                                fontWeight: 700,
                                color:
                                  leader.morale >= 65 ? 'var(--marker-green)' : 'var(--marker-red)',
                              }}
                            >
                              {leader.morale}%
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '2px',
                              backgroundColor: 'rgba(31, 79, 191, 0.1)',
                              color: 'var(--marker-blue)',
                              fontWeight: 600,
                            }}
                          >
                            Personality: {leader.personality}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '2px',
                              backgroundColor: 'rgba(0, 0, 0, 0.05)',
                              color: 'var(--paper-dim)',
                            }}
                          >
                            Rank #{idx + 1} Leader
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cohesion Event History */}
              {userClub.cohesionHistory && userClub.cohesionHistory.length > 0 && (
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', marginBottom: '8px', fontSize: '12px' }}
                  >
                    RECENT DRESSING ROOM DEVELOPMENTS
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      backgroundColor: 'var(--paper-2)',
                      padding: '12px 16px',
                      borderRadius: '4px',
                      border: '1px solid var(--paper-rule)',
                    }}
                  >
                    {userClub.cohesionHistory
                      .slice(-5)
                      .reverse()
                      .map((entry, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px',
                            borderBottom: idx < 4 ? '1px solid var(--paper-rule)' : 'none',
                            paddingBottom: '4px',
                          }}
                        >
                          <span style={{ color: 'var(--paper-ink)' }}>
                            MD {entry.matchday}: {entry.reason || 'Weekly morale balance'}
                          </span>
                          <span
                            className="tabular-nums"
                            style={{
                              fontWeight: 700,
                              color:
                                entry.delta > 0
                                  ? 'var(--marker-green)'
                                  : entry.delta < 0
                                    ? 'var(--marker-red)'
                                    : 'var(--paper-dim)',
                            }}
                          >
                            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </Sheet>
        )}

        {/* Tab 5: Staff */}
        {activeTab === 'STAFF' && (
          <Sheet id="club-staff-overview" variant="memo">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '8px',
                }}
              >
                <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                  BACKROOM & TECHNICAL STAFF
                </div>
                {!isWindowActive && (
                  <span style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                    Staff replacements available during transfer windows
                  </span>
                )}
                {isWindowActive && userClub.staffReplacedThisRound && (
                  <span style={{ fontSize: '12px', color: 'var(--marker-red)' }}>
                    Staff replacement limit reached for this window round (1 max)
                  </span>
                )}
              </div>

              {/* 4 Staff Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* Assistant: Theo Vance */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div
                      className="broadcast-label"
                      style={{ color: 'var(--marker-blue)', fontSize: '11px' }}
                    >
                      ASSISTANT MANAGER
                    </div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--paper-ink)',
                        marginTop: '4px',
                      }}
                    >
                      {userClub.staff?.assistant.name ?? 'Theo Vance'}
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '6px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          fill={
                            s <= (userClub.staff?.assistant.stars ?? 3)
                              ? 'var(--gold)'
                              : 'transparent'
                          }
                          color={
                            s <= (userClub.staff?.assistant.stars ?? 3)
                              ? 'var(--gold)'
                              : 'var(--paper-rule)'
                          }
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--paper-dim)', marginTop: '8px' }}>
                      Wage: {formatMoney(userClub.staff?.assistant.wage ?? 13500)}/week
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--paper-ink)',
                        marginTop: '8px',
                        lineHeight: '1.4',
                      }}
                    >
                      Key tactical confidant. Mentors youth players, conducts team talks, and
                      assists match prep.
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        backgroundColor: 'rgba(0,0,0,0.06)',
                        color: 'var(--paper-dim)',
                        borderRadius: '3px',
                      }}
                    >
                      Permanent Appointment
                    </span>
                  </div>
                </div>

                {/* First-Team Coach */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div
                      className="broadcast-label"
                      style={{ color: 'var(--marker-green)', fontSize: '11px' }}
                    >
                      FIRST-TEAM COACH
                    </div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--paper-ink)',
                        marginTop: '4px',
                      }}
                    >
                      {userClub.staff?.coach.name ?? 'Technical Coach'}
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '6px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          fill={
                            s <= (userClub.staff?.coach.stars ?? 3) ? 'var(--gold)' : 'transparent'
                          }
                          color={
                            s <= (userClub.staff?.coach.stars ?? 3)
                              ? 'var(--gold)'
                              : 'var(--paper-rule)'
                          }
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--paper-dim)', marginTop: '8px' }}>
                      Wage: {formatMoney(userClub.staff?.coach.wage ?? 13500)}/week
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--paper-ink)',
                        marginTop: '8px',
                        lineHeight: '1.4',
                      }}
                    >
                      Player development multiplier:{' '}
                      <strong>
                        x
                        {(
                          BALANCE.club.coachDevBase +
                          BALANCE.club.coachDevPerStar * (userClub.staff?.coach.stars ?? 3)
                        ).toFixed(2)}
                      </strong>{' '}
                      growth rate across all training sessions.
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setReplacingRole('coach')}
                      disabled={!isWindowActive || !!userClub.staffReplacedThisRound}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        backgroundColor:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'var(--paper-ink)'
                            : 'var(--paper-rule)',
                        color:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'var(--paper)'
                            : 'var(--paper-dim)',
                        border: 'none',
                        borderRadius: '3px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'pointer'
                            : 'not-allowed',
                      }}
                    >
                      Replace Coach
                    </button>
                  </div>
                </div>

                {/* Head of Scouting */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div
                      className="broadcast-label"
                      style={{ color: 'var(--marker-purple, #6a1b9a)', fontSize: '11px' }}
                    >
                      HEAD OF SCOUTING
                    </div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--paper-ink)',
                        marginTop: '4px',
                      }}
                    >
                      {userClub.staff?.scout.name ?? 'Chief Scout'}
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '6px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          fill={
                            s <= (userClub.staff?.scout.stars ?? 3) ? 'var(--gold)' : 'transparent'
                          }
                          color={
                            s <= (userClub.staff?.scout.stars ?? 3)
                              ? 'var(--gold)'
                              : 'var(--paper-rule)'
                          }
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--paper-dim)', marginTop: '8px' }}>
                      Wage: {formatMoney(userClub.staff?.scout.wage ?? 13500)}/week
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--paper-ink)',
                        marginTop: '8px',
                        lineHeight: '1.4',
                      }}
                    >
                      Scouting report accuracy:{' '}
                      <strong>
                        {Math.round(
                          (BALANCE.club.scoutKnowledgeBase +
                            BALANCE.club.scoutKnowledgePerStar *
                              (userClub.staff?.scout.stars ?? 3)) *
                            100,
                        )}
                        %
                      </strong>{' '}
                      knowledge revealed per scouting assignment.
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setReplacingRole('scout')}
                      disabled={!isWindowActive || !!userClub.staffReplacedThisRound}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        backgroundColor:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'var(--paper-ink)'
                            : 'var(--paper-rule)',
                        color:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'var(--paper)'
                            : 'var(--paper-dim)',
                        border: 'none',
                        borderRadius: '3px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'pointer'
                            : 'not-allowed',
                      }}
                    >
                      Replace Scout
                    </button>
                  </div>
                </div>

                {/* Club Physio */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div
                      className="broadcast-label"
                      style={{ color: 'var(--marker-red)', fontSize: '11px' }}
                    >
                      CLUB PHYSIO
                    </div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--paper-ink)',
                        marginTop: '4px',
                      }}
                    >
                      {userClub.staff?.physio.name ?? 'Lead Physio'}
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '6px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          fill={
                            s <= (userClub.staff?.physio.stars ?? 3) ? 'var(--gold)' : 'transparent'
                          }
                          color={
                            s <= (userClub.staff?.physio.stars ?? 3)
                              ? 'var(--gold)'
                              : 'var(--paper-rule)'
                          }
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--paper-dim)', marginTop: '8px' }}>
                      Wage: {formatMoney(userClub.staff?.physio.wage ?? 13500)}/week
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--paper-ink)',
                        marginTop: '8px',
                        lineHeight: '1.4',
                      }}
                    >
                      Injury length:{' '}
                      <strong>
                        x
                        {(
                          BALANCE.club.physioInjuryLenBase -
                          BALANCE.club.physioInjuryLenPerStar * (userClub.staff?.physio.stars ?? 3)
                        ).toFixed(2)}
                      </strong>
                      {' · '}
                      Match hazard:{' '}
                      <strong>
                        x
                        {(
                          BALANCE.club.physioHazardBase -
                          BALANCE.club.physioHazardPerStar * (userClub.staff?.physio.stars ?? 3)
                        ).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setReplacingRole('physio')}
                      disabled={!isWindowActive || !!userClub.staffReplacedThisRound}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        backgroundColor:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'var(--paper-ink)'
                            : 'var(--paper-rule)',
                        color:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'var(--paper)'
                            : 'var(--paper-dim)',
                        border: 'none',
                        borderRadius: '3px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor:
                          isWindowActive && !userClub.staffReplacedThisRound
                            ? 'pointer'
                            : 'not-allowed',
                      }}
                    >
                      Replace Physio
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Sheet>
        )}

        {/* Tab 6: Stadium */}
        {activeTab === 'STADIUM' && (
          <Sheet id="club-stadium-card" variant="default">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--paper-dim)',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '8px',
                }}
              >
                FACILITIES & GROUNDS
              </div>

              <div>
                <h2
                  style={{
                    fontSize: '28px',
                    fontFamily: 'var(--font-head)',
                    color: 'var(--paper-ink)',
                    margin: 0,
                  }}
                >
                  {userClub.stadium.name.toUpperCase()}
                </h2>
                <div
                  style={{
                    fontSize: '15px',
                    color: 'var(--paper-dim)',
                    marginTop: '4px',
                  }}
                >
                  Capacity: {userClub.stadium.capacity.toLocaleString()} seats
                </div>
              </div>

              <div
                style={{
                  height: '240px',
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--paper-rule)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--paper-dim)',
                  fontSize: '14px',
                }}
              >
                {userClub.stadium.name} · Coastal Ground at Night
              </div>
            </div>
          </Sheet>
        )}

        {/* Candidate Replacement Modal */}
        {replacingRole && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--paper)',
                color: 'var(--paper-ink)',
                borderRadius: '6px',
                maxWidth: '640px',
                width: '100%',
                padding: '24px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                border: '2px solid var(--paper-rule)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-head)',
                      fontSize: '20px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Replace{' '}
                    {replacingRole === 'coach'
                      ? 'First-Team Coach'
                      : replacingRole === 'scout'
                        ? 'Head of Scouting'
                        : 'Club Physio'}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--paper-dim)', marginTop: '2px' }}>
                    Current staff severance:{' '}
                    {formatMoney((userClub.staff?.[replacingRole]?.wage ?? 13500) * 4)} (4 weeks'
                    wages)
                  </div>
                </div>
                <button
                  onClick={() => setReplacingRole(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--paper-ink)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {generateStaffCandidates(
                  replacingRole,
                  gameState.matchday * 137 + gameState.seed,
                ).map((cand) => (
                  <div
                    key={cand.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--paper-2)',
                      padding: '12px 16px',
                      borderRadius: '4px',
                      border: '1px solid var(--paper-rule)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{cand.name}</div>
                      <div style={{ display: 'flex', gap: '2px', margin: '4px 0' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            fill={s <= cand.stars ? 'var(--gold)' : 'transparent'}
                            color={s <= cand.stars ? 'var(--gold)' : 'var(--paper-rule)'}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                        Wage: {formatMoney(cand.wage)}/week
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const res = hireStaffMember(cand);
                        if (res.success) {
                          showToast(`Appointed ${cand.name} as new ${cand.role}`, 'success');
                          setReplacingRole(null);
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--paper-ink)',
                        color: 'var(--paper)',
                        border: 'none',
                        borderRadius: '3px',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Hire Candidate
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  onClick={() => setReplacingRole(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--paper-rule)',
                    color: 'var(--paper-ink)',
                    borderRadius: '3px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
