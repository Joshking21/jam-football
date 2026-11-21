// Implements SPEC §7.1, §11.0 Global Shell and Router
import React, { useEffect } from 'react';
import { useStore } from './state/store';
import { TitleScreen } from './ui/screens/TitleScreen';
import { DevGalleryScreen } from './ui/screens/DevGalleryScreen';
import { NewGameScreen } from './ui/screens/NewGameScreen';
import { BoardMeetingScreen } from './ui/screens/BoardMeetingScreen';
import { HubScreen } from './ui/screens/HubScreen';
import { SquadScreen } from './ui/screens/SquadScreen';
import { TacticsScreen } from './ui/screens/TacticsScreen';
import { TrainingScreen } from './ui/screens/TrainingScreen';
import { TransfersScreen } from './ui/screens/TransfersScreen';
import { LeagueScreen } from './ui/screens/LeagueScreen';
import { FixturesScreen } from './ui/screens/FixturesScreen';
import { ClubScreen } from './ui/screens/ClubScreen';
import { InboxScreen } from './ui/screens/InboxScreen';
import { PreMatchScreen } from './ui/screens/PreMatchScreen';
import { TextMatchScreen } from './ui/screens/TextMatchScreen';
import { PostMatchScreen } from './ui/screens/PostMatchScreen';
import { WeekSummaryScreen } from './ui/screens/WeekSummaryScreen';
import { SeasonEndScreen } from './ui/screens/SeasonEndScreen';
import { SackedScreen } from './ui/screens/SackedScreen';
import { PlayerProfileModal } from './ui/screens/PlayerProfileModal';
import { SettingsModal } from './ui/screens/SettingsModal';
import { CreditsModal } from './ui/screens/CreditsModal';
import { TopBar } from './ui/components/TopBar';
import { Toast } from './ui/components/Toast';
import { ScreenTransition, getScreenWorld } from './ui/components/ScreenTransition';
import { applySettingsToDom } from './state/settings';

export const App: React.FC = () => {
  const screen = useStore((state) => state.screen);
  const setScreen = useStore((state) => state.setScreen);
  const isSettingsOpen = useStore((state) => state.isSettingsOpen);
  const isCreditsOpen = useStore((state) => state.isCreditsOpen);
  const closeModal = useStore((state) => state.closeModal);
  const selectedPlayerId = useStore((state) => state.selectedPlayerId);
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
        if (selectedPlayerId) {
          useStore.setState({ selectedPlayerId: null });
        } else if (isSettingsOpen || isCreditsOpen) {
          e.preventDefault();
          closeModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isCreditsOpen, selectedPlayerId, closeModal]);

  // 1. Standalone full-screen modes
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

  if (screen === 'newGame') {
    return (
      <>
        <NewGameScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </>
    );
  }

  if (screen === 'boardMeeting') {
    return (
      <>
        <BoardMeetingScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </>
    );
  }

  if (screen === 'match') {
    return (
      <>
        <TextMatchScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </>
    );
  }

  if (screen === 'seasonEnd') {
    return (
      <>
        <SeasonEndScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </>
    );
  }

  if (screen === 'sacked') {
    return (
      <>
        <SackedScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </>
    );
  }

  const currentWorld = getScreenWorld(screen);

  // 2. Management screens shell (TopBar tabs + ScreenTransition + Content)
  return (
    <div className={`app-shell ${currentWorld}`}>
      <TopBar />

      <main className={`app-shell-main ${currentWorld === 'office' ? 'office' : ''}`}>
        <ScreenTransition currentScreen={screen}>
          {screen === 'hub' && <HubScreen />}
          {screen === 'squad' && <SquadScreen />}
          {screen === 'tactics' && <TacticsScreen />}
          {screen === 'training' && <TrainingScreen />}
          {screen === 'transfers' && <TransfersScreen />}
          {screen === 'league' && <LeagueScreen />}
          {screen === 'fixtures' && <FixturesScreen />}
          {screen === 'club' && <ClubScreen />}
          {screen === 'inbox' && <InboxScreen />}
          {screen === 'preMatch' && <PreMatchScreen />}
          {screen === 'fullTime' && <PostMatchScreen />}
          {screen === 'weekSummary' && <WeekSummaryScreen />}
        </ScreenTransition>
      </main>

      {/* Player Profile Modal */}
      {selectedPlayerId && (
        <PlayerProfileModal
          playerId={selectedPlayerId}
          onClose={() => useStore.setState({ selectedPlayerId: null })}
        />
      )}

      {/* Global Modals */}
      <SettingsModal />
      <CreditsModal />
      <Toast />
    </div>
  );
};
