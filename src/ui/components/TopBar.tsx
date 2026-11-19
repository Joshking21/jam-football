// Implements SPEC §11.0 Top bar (64 px)
import React from 'react';
import { useStore } from '@/state/store';
import { Crest } from './Crest';
import { ContinueButton } from './ContinueButton';
import { formatMoney } from '@/core/math';
import { Settings, Mail } from 'lucide-react';

export const TopBar: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const openSettings = useStore((state) => state.openSettings);
  const setScreen = useStore((state) => state.setScreen);

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

  const handleContinue = () => {
    if (!gameState) return;
    if (gameState.phase === 'PreMatch') {
      setScreen('match');
    } else if (gameState.phase === 'Preseason') {
      setScreen('hub');
    } else {
      setScreen('preMatch');
    }
  };

  const continueLabel =
    gameState?.phase === 'PreMatch'
      ? 'Kick Off'
      : gameState?.phase === 'TransferWindow'
        ? 'Next Round'
        : gameState?.pendingMatch
          ? 'Go to Match'
          : 'Continue';

  return (
    <header
      style={{
        height: '64px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Club Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                }}
              >
                {userClub.name.toUpperCase()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
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

      {/* Centre: Matchday & Standing */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text-dim)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rankLabel}
      </div>

      {/* Right: Balance, Inbox, Settings, Continue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {userClub && (
          <div
            style={{
              padding: '6px 12px',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-s)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Balance
            </span>
            <span style={{ fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-head)' }}>
              {formatMoney(userClub.balance)}
            </span>
          </div>
        )}

        {/* Inbox button with badge */}
        <button
          onClick={() => setScreen('inbox')}
          title="Inbox"
          aria-label="Open inbox"
          style={{
            position: 'relative',
            color: 'var(--text-dim)',
            padding: '8px',
            borderRadius: 'var(--radius-m)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mail size={20} />
          {unreadInboxCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                fontSize: '10px',
                fontWeight: 700,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadInboxCount}
            </span>
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={openSettings}
          title="Settings"
          aria-label="Open settings"
          style={{
            color: 'var(--text-dim)',
            padding: '8px',
            borderRadius: 'var(--radius-m)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Settings size={20} />
        </button>

        {/* Continue action button */}
        <ContinueButton label={continueLabel} onClick={handleContinue} />
      </div>
    </header>
  );
};
