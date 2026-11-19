// Implements SPEC §11.4 Board Meeting screen (office setting)
// Chairman portrait / fallback avatar, expectations, budgets, 3 board notes.
// "Accept the job" button advances to Hub.
import React from 'react';
import { useStore } from '../../state/store';
import { Crest } from '../components/Crest';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { formatMoney } from '../../core/math';
import { Briefcase, DollarSign, Target, CheckCircle2 } from 'lucide-react';

export const BoardMeetingScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Generate 3 board notes based on club characteristics
  const boardNotes: string[] = [];
  if (userClub.style.mentality === 'Attacking') {
    boardNotes.push('We expect attacking, expansive football that excites the supporters.');
  } else if (userClub.style.mentality === 'Defensive') {
    boardNotes.push('We prize defensive discipline and an unyielding backline.');
  } else {
    boardNotes.push('Maintain tactical balance and game control across both halves.');
  }

  // Prospect note check
  const prospects = userClub.squad
    .map((id) => gameState.players[id])
    .filter((p) => p && p.age <= 21 && p.potential >= 75);
  if (prospects.length >= 2) {
    boardNotes.push(
      'Develop our promising academy talent and give young players first-team minutes.',
    );
  } else {
    boardNotes.push('Operate responsibly within our financial limits and protect club stability.');
  }

  // Reputation note
  if (userClub.reputation >= 4) {
    boardNotes.push('Compete aggressively at the top end of the table and secure silverware.');
  } else {
    boardNotes.push('Consolidate our league standing and outperform media predictions.');
  }

  const handleAcceptJob = async () => {
    await advanceGame();
  };

  return (
    <div
      className="office-surface"
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--desk)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <Sheet id="board-meeting-minute" variant="memo">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* Header: Crest and Meeting Title */}
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
                  size={52}
                />
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    BOARDROOM DIRECTIVE · CONFIDENTIAL
                  </div>
                  <h1
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: '32px',
                      color: 'var(--paper-ink)',
                      margin: 0,
                    }}
                  >
                    WELCOME TO {userClub.name.toUpperCase()}
                  </h1>
                </div>
              </div>
              <div
                className="broadcast-label"
                style={{
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--paper-rule)',
                  padding: '6px 12px',
                  borderRadius: '3px',
                  color: 'var(--paper-ink)',
                }}
              >
                MINUTES #01
              </div>
            </div>

            {/* Introductory text */}
            <div style={{ fontSize: '15px', lineHeight: '1.6' }}>
              Welcome, <strong>{gameState.managerName}</strong>. The board has unanimously agreed on
              your appointment as first-team manager. We place our complete confidence in your
              leadership for the season ahead.
            </div>

            {/* Mandate & Budgets summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                borderTop: '1px solid var(--paper-rule)',
                borderBottom: '1px solid var(--paper-rule)',
                padding: '16px 0',
              }}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <Target size={24} color="var(--paper-dim)" />
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    SEASON EXPECTATION
                  </div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      marginTop: '2px',
                    }}
                  >
                    {userClub.expectation.label}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <DollarSign size={24} color="var(--paper-dim)" />
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    TRANSFER BUDGET
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      marginTop: '2px',
                    }}
                  >
                    {formatMoney(userClub.transferBudget)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <Briefcase size={24} color="var(--paper-dim)" />
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    WAGE BUDGET
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      marginTop: '2px',
                    }}
                  >
                    {formatMoney(userClub.wageBudget)} / week
                  </div>
                </div>
              </div>
            </div>

            {/* Board Notes */}
            <div>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', marginBottom: '10px' }}
              >
                BOARD OBJECTIVES & EXPECTATIONS
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {boardNotes.map((note, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                    }}
                  >
                    <CheckCircle2
                      size={18}
                      color="var(--marker-green)"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Sign-off & Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid var(--paper-rule)',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--paper-dim)' }}>
                Signed on behalf of the Board of Directors
              </div>
              <Button variant="primary" size="l" onClick={handleAcceptJob}>
                Accept The Job
              </Button>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  );
};
