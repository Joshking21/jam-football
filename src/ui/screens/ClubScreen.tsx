// Implements SPEC §11.13 Club screen (office world)
// Tabs: Finances (balance, income/expense breakdown, weekly wages),
// Board (confidence meter, expectations), Fans (mood meter, attendance), Stadium (name, capacity).
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { CountUp } from '../components/CountUp';
import { formatMoney } from '../../core/math';
import { Crest } from '../components/Crest';
import { DollarSign, TrendingUp, Building, Users, Target, ShieldCheck } from 'lucide-react';

type ClubTab = 'FINANCES' | 'BOARD' | 'FANS' | 'STADIUM';

export const ClubScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const [activeTab, setActiveTab] = useState<ClubTab>('FINANCES');

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Compute total weekly squad wages
  const squadPlayers = userClub.squad.map((id) => gameState.players[id]).filter((p) => p != null);
  const currentWeeklyWage = squadPlayers.reduce(
    (sum, p) => sum + (p.contract?.wagePerWeek ?? 0),
    0,
  );

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
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--paper-rule)',
            paddingBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Crest
              clubId={userClub.id}
              code={userClub.code}
              primaryColor={userClub.colors.primary}
              secondaryColor={userClub.colors.secondary}
              size={48}
            />
            <div>
              <h1
                style={{
                  fontSize: '28px',
                  fontFamily: 'var(--font-head)',
                  color: 'var(--paper-ink)',
                  margin: 0,
                }}
              >
                {userClub.name.toUpperCase()} CLUB OVERVIEW
              </h1>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', marginTop: '2px' }}
              >
                Founded {userClub.founded} · {userClub.city}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['FINANCES', 'BOARD', 'FANS', 'STADIUM'] as ClubTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="broadcast-label"
                style={{
                  padding: '6px 12px',
                  borderRadius: '3px',
                  backgroundColor: activeTab === tab ? 'var(--paper-ink)' : 'var(--paper-2)',
                  color: activeTab === tab ? 'var(--paper)' : 'var(--paper-ink)',
                  border: '1px solid var(--paper-rule)',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Finances (Sheet ledger variant) */}
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
                    Current payroll: {formatMoney(currentWeeklyWage)}/wk
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
                      +{formatMoney(userClub.reputation * 150000)}
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
                      -{formatMoney(userClub.reputation * 100000)}
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

        {/* Tab 4: Stadium */}
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
      </div>
    </div>
  );
};
