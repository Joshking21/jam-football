// Implements SPEC §7.1, §11.0 Global Shell and Router
import React, { useEffect } from 'react';
import { useStore } from '@/state/store';
import { TitleScreen } from '@/ui/screens/TitleScreen';
import { DevGalleryScreen } from '@/ui/screens/DevGalleryScreen';
import { SettingsModal } from '@/ui/screens/SettingsModal';
import { CreditsModal } from '@/ui/screens/CreditsModal';
import { TopBar } from '@/ui/components/TopBar';
import { Sidebar } from '@/ui/components/Sidebar';
import { Toast } from '@/ui/components/Toast';
import { Card } from '@/ui/components/Card';
import { applySettingsToDom } from '@/state/settings';

export const App: React.FC = () => {
  const screen = useStore((state) => state.screen);
  const setScreen = useStore((state) => state.setScreen);
  const isSettingsOpen = useStore((state) => state.isSettingsOpen);
  const isCreditsOpen = useStore((state) => state.isCreditsOpen);
  const closeModal = useStore((state) => state.closeModal);
  const settings = useStore((state) => state.settings);
  const gameState = useStore((state) => state.gameState);

  // Apply initial visual settings (contrast, motion, text size)
  useEffect(() => {
    applySettingsToDom(settings);
  }, [settings]);

  // Global Keyboard Navigation (SPEC §11.0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a form input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (isSettingsOpen || isCreditsOpen) {
          e.preventDefault();
          closeModal();
        }
      }

      if (e.code === 'Space') {
        // Space continues primary action when modals are closed
        if (!isSettingsOpen && !isCreditsOpen) {
          const continueBtn = document.querySelector<HTMLButtonElement>('.btn-primary');
          if (continueBtn && !continueBtn.disabled) {
            e.preventDefault();
            continueBtn.click();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isCreditsOpen, closeModal]);

  // Standalone full-screen modes
  if (screen === 'title') {
    return (
      <>
        <TitleScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </>
    );
  }

  if (screen === 'devGallery') {
    return (
      <>
        <DevGalleryScreen onBackToTitle={() => setScreen('title')} />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </>
    );
  }

  // Management screens shell (TopBar + Sidebar + Content area)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <TopBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            maxWidth: '1600px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Active Screen View */}
          <div style={{ animation: 'screen-fade var(--dur-med) var(--ease)' }}>
            <Card>
              <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>{screen.toUpperCase()}</h1>
              <p style={{ color: 'var(--text-dim)', fontSize: '15px' }}>
                Screen view for {screen}. Will be connected in milestone M1–M3.
              </p>
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={() => setScreen('title')}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--surface-3)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-s)',
                  }}
                >
                  Return to Title Screen
                </button>
              </div>
            </Card>
          </div>
        </main>
      </div>

      <SettingsModal />
      <CreditsModal />
      <Toast />
    </div>
  );
};
