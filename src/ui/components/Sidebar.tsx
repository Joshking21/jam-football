// Implements SPEC §11.0 Sidebar (232 px, collapsible to 72 px icons)
import React, { useEffect } from 'react';
import { useStore, AppScreen } from '@/state/store';
import {
  LayoutDashboard,
  Users,
  Sliders,
  Dumbbell,
  ArrowLeftRight,
  Trophy,
  Calendar,
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

  const navItems: NavItem[] = [
    { key: 'hub', index: 1, label: 'Hub', screen: 'hub', icon: <LayoutDashboard size={18} /> },
    { key: 'squad', index: 2, label: 'Squad', screen: 'squad', icon: <Users size={18} /> },
    { key: 'tactics', index: 3, label: 'Tactics', screen: 'tactics', icon: <Sliders size={18} /> },
    {
      key: 'training',
      index: 4,
      label: 'Training',
      screen: 'training',
      icon: <Dumbbell size={18} />,
    },
    {
      key: 'transfers',
      index: 5,
      label: isWindowActive ? 'Transfers' : 'Scouting',
      screen: 'transfers',
      icon: <ArrowLeftRight size={18} />,
    },
    { key: 'league', index: 6, label: 'League', screen: 'league', icon: <Trophy size={18} /> },
    {
      key: 'fixtures',
      index: 7,
      label: 'Fixtures',
      screen: 'fixtures',
      icon: <Calendar size={18} />,
    },
    { key: 'club', index: 8, label: 'Club', screen: 'club', icon: <Building2 size={18} /> },
    { key: 'inbox', index: 9, label: 'Inbox', screen: 'inbox', icon: <Mail size={18} /> },
  ];

  // Number key shortcuts 1..9 (SPEC §11.0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (currentScreen === 'match') return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const item = navItems[num - 1];
        if (item) {
          e.preventDefault();
          setScreen(item.screen);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen, setScreen, navItems]);

  return (
    <aside
      style={{
        width: collapsed ? '72px' : '232px',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--dur-med) var(--ease)',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <nav style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = currentScreen === item.screen;
          return (
            <button
              key={item.key}
              onClick={() => setScreen(item.screen)}
              title={`${item.label} (${item.index})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-m)',
                background: isActive ? 'var(--surface-3)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '14px',
                transition: 'all var(--dur-fast) var(--ease)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: isActive ? 'var(--accent)' : 'inherit' }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </div>
              {!collapsed && <KeyHint hint={String(item.index)} />}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle at bottom */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px',
            padding: '8px',
            color: 'var(--text-faint)',
            fontSize: '12px',
            borderRadius: 'var(--radius-s)',
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};
