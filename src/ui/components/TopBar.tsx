// Implements SPEC §11.0 Top bar (64 px)
import React from 'react';
import { useStore } from '../../state/store';
import { Crest } from './Crest';
import { ContinueButton } from './ContinueButton';
import { formatMoney } from '../../core/math';
import { Settings, Mail } from 'lucide-react';

export const TopBar: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const openSettings = useStore((state) => state.openSettings);
  const setScreen = useStore((state) => state.setScreen);
  const advanceGame = useStore((state) => state.advanceGame);

  const userClub = gameState ? gameState.clubs[gameState.userClubId] : null;

  // Determine ranking & points
  let rankLabel = '';
  if (gameState && userClub) {
    const tableIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
    const pos = tableIndex >= 0 ? tableIndex + 1 : 1;
    const pts =
      tableIndex >= 0 && gameState.table[tableIndex] ? gameState.table[tableIndex].pts : 0;
    const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
    const matchdayText =
      gameState.matchday === 0 ? 'Preseason' : `Matchday ${gameState.matchday} of 18`;
    rankLabel = `${matchdayText} · ${pos}${suffix} place · ${pts} pts`;
  }

  const unreadInboxCount = gameState ? gameState.inbox.filter((item) => !item.read).length : 0;

  const handleContinue = async () => {
    if (!gameState) return;
    await advanceGame();
  };

  const continueLabel =
    gameState?.phase === 'PreMatch'
      ? 'Kick Off'
      : gameState?.phase === 'TransferWindow'
        ? 'Next Round'
        : gameState?.phase === 'Preseason'
          ? 'Go to Hub'
          : gameState?.phase === 'Match'
            ? 'Resume Match'
            : gameState?.phase === 'PostMatch'
              ? 'To Summary'
              : gameState?.phase === 'WeekSummary'
                ? 'Next Match'
                : 'Continue';

  return (
    <header
      className="app-shell-topbar"
      style={{
        height: '64px',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        userSelect: 'none',
      }}
    >
      {/* Left: Club Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {userClub ? (
          <>
            <Crest
              clubId={userClub.id}
              code={userClub.code}
              primaryColor={userClub.colors.primary}
              secondaryColor={userClub.colors.secondary}
              size={36}
            />
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '18px',
                  fontFamily: 'var(--font-head)',
                  letterSpacing: '0.02em',
                  lineHeight: '1.1',
                }}
              >
                {userClub.name.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-dim)',
                  marginTop: '1px',
                }}
              >
                {userClub.nickname} · {userClub.stadium.name}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 700,
              fontSize: '20px',
              letterSpacing: '0.05em',
            }}
          >
            TOUCHLINE
          </div>
        )}
      </div>

      {/* Centre: Matchday & League Snapshot */}
      {rankLabel && (
        <div
          className="broadcast-label"
          style={{
            fontSize: '14px',
            color: 'var(--text)',
            letterSpacing: '0.06em',
            backgroundColor: 'var(--surface-2)',
            padding: '6px 16px',
            borderRadius: 'var(--radius-s)',
            border: '1px solid var(--border)',
          }}
        >
          {rankLabel}
        </div>
      )}

      {/* Right: Balance, Inbox, Settings, Continue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {userClub && (
          <div style={{ textAlign: 'right' }}>
            <div
              className="stat-number tabular-nums"
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: userClub.balance >= 0 ? 'var(--text)' : 'var(--loss)',
              }}
            >
              {formatMoney(userClub.balance)}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-dim)',
                marginTop: '1px',
              }}
            >
              Balance
            </div>
          </div>
        )}

        {/* Inbox icon with unread badge */}
        <button
          onClick={() => setScreen('inbox')}
          aria-label={`Inbox, ${unreadInboxCount} unread`}
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-m)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)';
            e.currentTarget.style.borderColor = 'var(--text-dim)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <Mail size={18} />
          {unreadInboxCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-ink)',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-head)',
              }}
            >
              {unreadInboxCount > 9 ? '9+' : unreadInboxCount}
            </span>
          )}
        </button>

        {/* Settings gear */}
        <button
          onClick={openSettings}
          aria-label="Settings"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-m)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)';
            e.currentTarget.style.borderColor = 'var(--text-dim)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <Settings size={18} />
        </button>

        {/* Primary Continue button */}
        {gameState && <ContinueButton label={continueLabel} onClick={handleContinue} />}
      </div>
    </header>
  );
};
