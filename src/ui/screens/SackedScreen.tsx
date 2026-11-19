// Implements SPEC §11.21 Sacked screen (on-air broadcast world)
// Dramatic card: "You have been relieved of your duties", reason, record, grade F, score, New Game / Title.
import React from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export const SackedScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const setScreen = useStore((state) => state.setScreen);
  const continueAutosave = useStore((state) => state.continueAutosave);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const userRankIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
  const userRow = gameState.table[userRankIndex];
  const userPosition = userRankIndex >= 0 ? userRankIndex + 1 : '-';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#07090D',
        padding: '32px 24px',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <Panel dominant title="OFFICIAL CLUB STATEMENT">
          <div
            style={{
              padding: '24px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 77, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--loss)',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <div>
              <div className="broadcast-label" style={{ color: 'var(--loss)', fontSize: '13px' }}>
                MANAGERIAL TERMINATION
              </div>
              <h1
                style={{
                  fontSize: '32px',
                  fontFamily: 'var(--font-head)',
                  margin: '4px 0 0',
                }}
              >
                RELIEVED OF YOUR DUTIES
              </h1>
            </div>

            <p
              style={{
                fontSize: '15px',
                color: 'var(--text-dim)',
                lineHeight: '1.6',
              }}
            >
              Following a review of recent competitive results and board confidence falling below
              sustainable thresholds, <strong>{userClub.name}</strong> has announced the immediate
              termination of your managerial contract.
            </p>

            {/* Campaign Record */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                width: '100%',
                backgroundColor: 'var(--surface-2)',
                padding: '16px',
                borderRadius: 'var(--radius-s)',
                border: '1px solid var(--border)',
                marginTop: '8px',
              }}
            >
              <div>
                <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                  LEAGUE POSITION
                </div>
                <div
                  className="stat-number tabular-nums"
                  style={{ fontSize: '24px', fontWeight: 700 }}
                >
                  {userPosition}th
                </div>
              </div>
              <div>
                <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                  POINTS
                </div>
                <div
                  className="stat-number tabular-nums"
                  style={{ fontSize: '24px', fontWeight: 700 }}
                >
                  {userRow?.pts ?? 0}
                </div>
              </div>
              <div>
                <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                  SEASON GRADE
                </div>
                <div
                  className="stat-number"
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--loss)',
                  }}
                >
                  F
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginTop: '16px',
                width: '100%',
              }}
            >
              <Button
                variant="secondary"
                size="l"
                icon={<Home size={18} />}
                onClick={() => setScreen('title')}
                style={{ flex: 1 }}
              >
                Title Screen
              </Button>
              <Button
                variant="primary"
                size="l"
                icon={<RotateCcw size={18} />}
                onClick={() => setScreen('newGame')}
                style={{ flex: 1 }}
              >
                Try Again
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
