// Implements SPEC §19.6 Sidebar ("the rundown"):
// Two groups: On air (Hub 1, League 2, Fixtures 3), The office (Squad 4, Tactics 5, Training 6, Transfers 7, Club 8, Inbox 9).
// Keys 1-9 follow this order.
// Current page: 64px block filled with --accent, Barlow Condensed 700 22px in --accent-ink, plus one context line.
// Other items: compact 36px row (18px icon + 14px label in --text-dim).
// 72px rail under 1440w (or when collapsed).
import React, { useEffect, useState } from 'react';
import { useStore, AppScreen } from '../../state/store';
import { getScreenWorld } from './ScreenTransition';
import {
  LayoutDashboard,
  Trophy,
  Calendar,
  Users,
  Sliders,
  Dumbbell,
  ArrowLeftRight,
  Building2,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { KeyHint } from './KeyHint';

interface NavItem {
  key: string;
  index: number;
  label: string;
  screen: AppScreen;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const currentScreen = useStore((state) => state.screen);
  const setScreen = useStore((state) => state.setScreen);
  const collapsed = useStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const gameState = useStore((state) => state.gameState);

  const isWindowActive = gameState?.phase === 'TransferWindow';
  const world = getScreenWorld(currentScreen);

  // Group 1: On air (1..3)
  const onAirItems: NavItem[] = [
    {
      key: 'hub',
      index: 1,
      label: 'Hub',
      screen: 'hub',
      icon: <LayoutDashboard size={18} />,
    },
    {
      key: 'league',
      index: 2,
      label: 'League',
      screen: 'league',
      icon: <Trophy size={18} />,
    },
    {
      key: 'fixtures',
      index: 3,
      label: 'Fixtures',
      screen: 'fixtures',
      icon: <Calendar size={18} />,
    },
  ];

  // Group 2: The office (4..9)
  const officeItems: NavItem[] = [
    {
      key: 'squad',
      index: 4,
      label: 'Squad',
      screen: 'squad',
      icon: <Users size={18} />,
    },
    {
      key: 'tactics',
      index: 5,
      label: 'Tactics',
      screen: 'tactics',
      icon: <Sliders size={18} />,
    },
    {
      key: 'training',
      index: 6,
      label: 'Training',
      screen: 'training',
      icon: <Dumbbell size={18} />,
    },
    {
      key: 'transfers',
      index: 7,
      label: isWindowActive ? 'Transfers' : 'Scouting',
      screen: 'transfers',
      icon: <ArrowLeftRight size={18} />,
    },
    {
      key: 'club',
      index: 8,
      label: 'Club',
      screen: 'club',
      icon: <Building2 size={18} />,
    },
    {
      key: 'inbox',
      index: 9,
      label: 'Inbox',
      screen: 'inbox',
      icon: <Mail size={18} />,
    },
  ];

  const allItems = [...onAirItems, ...officeItems];

  // Context lines generator (SPEC §19.6)
  const getContextLine = (screen: AppScreen): string => {
    if (!gameState) return '';
    const userClub = gameState.clubs[gameState.userClubId];
    if (!userClub) return '';

    switch (screen) {
      case 'hub': {
        const nextFix = gameState.fixtures.find(
          (f) =>
            f.matchday === gameState.matchday &&
            (f.homeId === userClub.id || f.awayId === userClub.id),
        );
        if (!nextFix) return `Matchday ${gameState.matchday}`;
        const oppId = nextFix.homeId === userClub.id ? nextFix.awayId : nextFix.homeId;
        const opp = gameState.clubs[oppId];
        return `Matchday ${gameState.matchday} · v ${opp?.shortName ?? 'Opponent'}`;
      }
      case 'league': {
        const tableIndex = gameState.table.findIndex((r) => r.clubId === userClub.id);
        const row = tableIndex >= 0 ? gameState.table[tableIndex] : null;
        return row ? `Rank ${tableIndex + 1} · ${row.pts} pts` : 'Meridian League';
      }
      case 'fixtures':
        return '18 matchdays';
      case 'squad':
        return `${userClub.squad.length} players registered`;
      case 'tactics':
        return `${userClub.tactics.formation} · ${userClub.tactics.instructions.mentality}`;
      case 'training':
        return `${userClub.trainingPlan?.focus ?? 'Balanced'} · ${userClub.trainingPlan?.intensity ?? 'Normal'}`;
      case 'transfers':
        return isWindowActive ? 'Window open' : 'Scouting network';
      case 'club':
        return `Confidence ${Math.round(userClub.boardConfidence)}%`;
      case 'inbox': {
        const unread = gameState.inbox.filter((m) => !m.read).length;
        return `${unread} unread`;
      }
      default:
        return '';
    }
  };

  // Flag indicator for 72px rail mode
  const [showRailFlag, setShowRailFlag] = useState(false);
  useEffect(() => {
    setShowRailFlag(true);
    const timer = setTimeout(() => setShowRailFlag(false), 1200);
    return () => clearTimeout(timer);
  }, [currentScreen]);

  // Shortcut keys 1..9 (SPEC §11.0 & §19.6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (currentScreen === 'match') return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const item = allItems[num - 1];
        if (item) {
          e.preventDefault();
          setScreen(item.screen);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen, setScreen, allItems]);

  const renderNavGroup = (header: string, items: NavItem[]) => (
    <div style={{ marginBottom: '16px' }}>
      {!collapsed && (
        <div
          className="broadcast-label"
          style={{
            padding: '8px 16px 4px',
            color: 'var(--text-faint)',
            fontSize: '11px',
            letterSpacing: '0.08em',
          }}
        >
          {header}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map((item) => {
          const isActive = currentScreen === item.screen;
          const contextLine = getContextLine(item.screen);

          if (isActive) {
            return (
              <div
                key={item.key}
                style={{
                  position: 'relative',
                  height: collapsed ? '44px' : '64px',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: collapsed ? '0 14px' : '0 16px',
                  borderRadius: 'var(--radius-s)',
                  margin: '0 4px',
                  boxShadow: 'var(--shadow-1)',
                  transition: 'all var(--dur-med) var(--ease-snap)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-head)',
                          fontWeight: 700,
                          fontSize: '22px',
                          lineHeight: '1.1',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--accent-ink)',
                          opacity: 0.85,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          marginTop: '2px',
                          animation: 'fade-in 120ms ease-out',
                        }}
                      >
                        {contextLine}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rail flag popup on screen change for collapsed mode */}
                {collapsed && showRailFlag && (
                  <div
                    className="broadcast-label"
                    style={{
                      position: 'absolute',
                      left: '68px',
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-ink)',
                      padding: '6px 12px',
                      borderRadius: '0 4px 4px 0',
                      boxShadow: 'var(--shadow-1)',
                      whiteSpace: 'nowrap',
                      zIndex: 100,
                      animation: 'flag-pop 1200ms ease-out',
                    }}
                  >
                    {item.label}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.key}
              onClick={() => setScreen(item.screen)}
              className="sidebar-row"
              style={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                padding: collapsed ? '0 14px' : '0 16px',
                margin: '0 4px',
                borderRadius: 'var(--radius-s)',
                color: 'var(--text-dim)',
                background: 'transparent',
                transition:
                  'height var(--dur-fast), color var(--dur-fast), background var(--dur-fast)',
                gap: '12px',
                width: 'calc(100% - 8px)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.height = '40px';
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.height = '36px';
                e.currentTarget.style.color = 'var(--text-dim)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              {!collapsed && (
                <span
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              )}
              {!collapsed && <KeyHint hint={String(item.index)} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside
      className={`sidebar-rundown ${world === 'office' ? 'office-mode' : 'onair-mode'}`}
      style={{
        width: collapsed ? '72px' : '232px',
        backgroundColor: world === 'office' ? 'var(--desk-2)' : 'var(--surface)',
        borderRight: `1px solid ${world === 'office' ? 'var(--desk-border)' : 'var(--border)'}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--dur-med) var(--ease-snap), background-color var(--dur-med)',
        userSelect: 'none',
        flexShrink: 0,
        height: '100%',
        padding: '12px 0',
      }}
    >
      <div>
        {renderNavGroup('ON AIR', onAirItems)}
        {renderNavGroup('THE OFFICE', officeItems)}
      </div>

      {/* Collapse toggle at bottom */}
      <div style={{ padding: '0 12px' }}>
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px',
            color: 'var(--text-faint)',
            padding: '0 8px',
            borderRadius: 'var(--radius-s)',
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span style={{ fontSize: '12px' }}>Collapse [ / ]</span>}
        </button>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 0.85; }
        }
        @keyframes flag-pop {
          0% { opacity: 0; transform: translateX(-8px); }
          15% { opacity: 1; transform: translateX(0); }
          80% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(4px); }
        }
      `}</style>
    </aside>
  );
};
