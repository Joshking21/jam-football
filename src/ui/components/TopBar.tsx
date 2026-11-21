// Implements SPEC §11.0, §19.6 Top bar (56 px, horizontal rundown navigation tabs, no sidebar)
import React, { useEffect } from 'react';
import { useStore, AppScreen } from '../../state/store';
import { Crest } from './Crest';
import { ContinueButton } from './ContinueButton';
import { formatMoney } from '../../core/math';
import { Settings } from 'lucide-react';
import { getScreenWorld } from './ScreenTransition';

interface NavTab {
  key: string;
  label: string;
  screen: AppScreen;
  badge?: number;
}

export const TopBar: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const currentScreen = useStore((state) => state.screen);
  const setScreen = useStore((state) => state.setScreen);
  const openSettings = useStore((state) => state.openSettings);
  const advanceGame = useStore((state) => state.advanceGame);

  const userClub = gameState ? gameState.clubs[gameState.userClubId] : null;
  const currentWorld = getScreenWorld(currentScreen);

  // Status chip: "MD 7/18 · 3rd · 14 pts"
  let rankLabel = '';
  if (gameState && userClub) {
    const tableIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
    const pos = tableIndex >= 0 ? tableIndex + 1 : 1;
    const pts =
      tableIndex >= 0 && gameState.table[tableIndex] ? gameState.table[tableIndex].pts : 0;
    const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
    const matchdayText = gameState.matchday === 0 ? 'Preseason' : `MD ${gameState.matchday}/18`;
    rankLabel = `${matchdayText} · ${pos}${suffix} · ${pts} pts`;
  }

  const unreadInboxCount = gameState ? gameState.inbox.filter((item) => !item.read).length : 0;

  const onAirTabs: NavTab[] = [
    { key: '1', label: 'Hub', screen: 'hub' },
    { key: '2', label: 'League', screen: 'league' },
    { key: '3', label: 'Fixtures', screen: 'fixtures' },
  ];

  const officeTabs: NavTab[] = [
    { key: '4', label: 'Squad', screen: 'squad' },
    { key: '5', label: 'Tactics', screen: 'tactics' },
    { key: '6', label: 'Training', screen: 'training' },
    {
      key: '7',
      label: gameState?.phase === 'TransferWindow' ? 'Transfers' : 'Scouting',
      screen: 'transfers',
    },
    { key: '8', label: 'Club', screen: 'club' },
    { key: '9', label: 'Inbox', screen: 'inbox', badge: unreadInboxCount },
  ];

  const allTabs = [...onAirTabs, ...officeTabs];

  // Number key navigation (1..9) per SPEC §11.0, §19.6
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const tab = allTabs[num - 1];
        if (tab) {
          e.preventDefault();
          setScreen(tab.screen);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allTabs, setScreen]);

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

  const isOffice = currentWorld === 'office';

  return (
    <header
      className="app-shell-topbar"
      style={{
        height: '56px',
        backgroundColor: isOffice ? 'var(--desk-2)' : 'var(--surface)',
        borderBottom: `1px solid ${isOffice ? 'var(--desk-border)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        userSelect: 'none',
        transition: 'background-color var(--dur-med) var(--ease-snap)',
      }}
    >
      {/* Left: Club Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
        {userClub ? (
          <>
            <Crest
              clubId={userClub.id}
              code={userClub.code}
              primaryColor={userClub.colors.primary}
              secondaryColor={userClub.colors.secondary}
              size={32}
            />
            <div className="topbar-club-name" style={{ lineHeight: 1.1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '17px',
                  fontFamily: 'var(--font-head)',
                  letterSpacing: '0.02em',
                  color: isOffice ? 'var(--paper-ink)' : 'var(--text)',
                }}
              >
                {userClub.name.toUpperCase()}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 700,
              fontSize: '18px',
              letterSpacing: '0.05em',
            }}
          >
            TOUCHLINE
          </div>
        )}
      </div>

      {/* Centre: Horizontal Navigation Tabs (The Rundown) */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '100%',
        }}
      >
        {/* On-air group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {onAirTabs.map((tab) => {
            const isActive = currentScreen === tab.screen;
            return (
              <button
                key={tab.key}
                onClick={() => setScreen(tab.screen)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: 'var(--radius-s)',
                  backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive
                    ? 'var(--accent-ink)'
                    : isOffice
                      ? 'var(--paper-dim)'
                      : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 600,
                  fontSize: '14px',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all var(--dur-fast) var(--ease-snap)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = isOffice ? 'var(--paper-ink)' : 'var(--text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = isOffice ? 'var(--paper-dim)' : 'var(--text-dim)';
                  }
                }}
              >
                <span style={{ fontSize: '11px', opacity: 0.6 }}>{tab.key}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Divider between On Air and Office */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: isOffice ? 'var(--desk-border)' : 'var(--border)',
            margin: '0 4px',
          }}
        />

        {/* Office group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {officeTabs.map((tab) => {
            const isActive = currentScreen === tab.screen;
            return (
              <button
                key={tab.key}
                onClick={() => setScreen(tab.screen)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: 'var(--radius-s)',
                  backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive
                    ? 'var(--accent-ink)'
                    : isOffice
                      ? 'var(--paper-dim)'
                      : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 600,
                  fontSize: '14px',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all var(--dur-fast) var(--ease-snap)',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = isOffice ? 'var(--paper-ink)' : 'var(--text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = isOffice ? 'var(--paper-dim)' : 'var(--text-dim)';
                  }
                }}
              >
                <span style={{ fontSize: '11px', opacity: 0.6 }}>{tab.key}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    style={{
                      backgroundColor: isActive ? 'var(--accent-ink)' : 'var(--accent)',
                      color: isActive ? 'var(--accent)' : 'var(--accent-ink)',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      marginLeft: '2px',
                    }}
                  >
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right: Status chip, Balance, Settings, Continue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {rankLabel && (
          <div
            className="broadcast-label"
            style={{
              fontSize: '13px',
              color: isOffice ? 'var(--paper-ink)' : 'var(--text)',
              letterSpacing: '0.04em',
              backgroundColor: isOffice ? 'var(--desk)' : 'var(--surface-2)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-s)',
              border: `1px solid ${isOffice ? 'var(--desk-border)' : 'var(--border)'}`,
              whiteSpace: 'nowrap',
            }}
          >
            {rankLabel}
          </div>
        )}

        {userClub && (
          <div className="topbar-balance" style={{ textAlign: 'right' }}>
            <div
              className="stat-number tabular-nums"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color:
                  userClub.balance >= 0
                    ? isOffice
                      ? 'var(--paper-ink)'
                      : 'var(--text)'
                    : 'var(--loss)',
              }}
            >
              {formatMoney(userClub.balance)}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: isOffice ? 'var(--paper-dim)' : 'var(--text-dim)',
                lineHeight: 1,
              }}
            >
              Balance
            </div>
          </div>
        )}

        {/* Settings gear */}
        <button
          onClick={openSettings}
          aria-label="Settings"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-s)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isOffice ? 'var(--paper-dim)' : 'var(--text-dim)',
            background: isOffice ? 'var(--desk)' : 'var(--surface-2)',
            border: `1px solid ${isOffice ? 'var(--desk-border)' : 'var(--border)'}`,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = isOffice ? 'var(--paper-ink)' : 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = isOffice ? 'var(--paper-dim)' : 'var(--text-dim)';
          }}
        >
          <Settings size={16} />
        </button>

        {/* Primary Continue button */}
        {gameState && <ContinueButton label={continueLabel} onClick={handleContinue} />}
      </div>
    </header>
  );
};
