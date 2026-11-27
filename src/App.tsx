// Implements SPEC §7.1, §11.0 Global Shell and Router
import React, { Suspense, useEffect } from 'react';
import { useStore } from './state/store';
import { TitleScreen } from './ui/screens/TitleScreen';
import { TopBar } from './ui/components/TopBar';
import { Toast } from './ui/components/Toast';
import { ScreenTransition, getScreenWorld } from './ui/components/ScreenTransition';
import { TutorialCoachMark } from './ui/components/TutorialCoachMark';
import { applySettingsToDom } from './state/settings';
import { audioEngine } from './audio/engine';
import { ErrorBoundary } from './ui/components/ErrorBoundary';

const lazy = <M, K extends keyof M & string>(load: () => Promise<M>, key: K) =>
  React.lazy(() => load().then((m) => ({ default: m[key] as React.ComponentType<any> })));

const DevGalleryScreen = lazy(() => import('./ui/screens/DevGalleryScreen'), 'DevGalleryScreen');
const NewGameScreen = lazy(() => import('./ui/screens/NewGameScreen'), 'NewGameScreen');
const BoardMeetingScreen = lazy(() => import('./ui/screens/BoardMeetingScreen'), 'BoardMeetingScreen');
const HubScreen = lazy(() => import('./ui/screens/HubScreen'), 'HubScreen');
const SquadScreen = lazy(() => import('./ui/screens/SquadScreen'), 'SquadScreen');
const TacticsScreen = lazy(() => import('./ui/screens/TacticsScreen'), 'TacticsScreen');
const TrainingScreen = lazy(() => import('./ui/screens/TrainingScreen'), 'TrainingScreen');
const TransfersScreen = lazy(() => import('./ui/screens/TransfersScreen'), 'TransfersScreen');
const LeagueScreen = lazy(() => import('./ui/screens/LeagueScreen'), 'LeagueScreen');
const FixturesScreen = lazy(() => import('./ui/screens/FixturesScreen'), 'FixturesScreen');
const ClubScreen = lazy(() => import('./ui/screens/ClubScreen'), 'ClubScreen');
const InboxScreen = lazy(() => import('./ui/screens/InboxScreen'), 'InboxScreen');
const PreMatchScreen = lazy(() => import('./ui/screens/PreMatchScreen'), 'PreMatchScreen');
const MatchScreen = lazy(() => import('./ui/screens/MatchScreen'), 'MatchScreen');
const TextMatchScreen = lazy(() => import('./ui/screens/TextMatchScreen'), 'TextMatchScreen');
const PostMatchScreen = lazy(() => import('./ui/screens/PostMatchScreen'), 'PostMatchScreen');
const WeekSummaryScreen = lazy(() => import('./ui/screens/WeekSummaryScreen'), 'WeekSummaryScreen');
const SeasonEndScreen = lazy(() => import('./ui/screens/SeasonEndScreen'), 'SeasonEndScreen');
const SackedScreen = lazy(() => import('./ui/screens/SackedScreen'), 'SackedScreen');
const PlayerProfileModal = lazy(() => import('./ui/screens/PlayerProfileModal'), 'PlayerProfileModal');
const ConversationModal = lazy(() => import('./ui/screens/ConversationModal'), 'ConversationModal');
const SettingsModal = lazy(() => import('./ui/screens/SettingsModal'), 'SettingsModal');
const CreditsModal = lazy(() => import('./ui/screens/CreditsModal'), 'CreditsModal');
const LoadGameModal = lazy(() => import('./ui/screens/LoadGameModal'), 'LoadGameModal');
const ClubSpacesCanvas = lazy(() => import('./club3d/ClubSpacesCanvas'), 'ClubSpacesCanvas');

export const App: React.FC = () => {
  const screen = useStore((state) => state.screen);
  const setScreen = useStore((state) => state.setScreen);
  const isSettingsOpen = useStore((state) => state.isSettingsOpen);
  const isCreditsOpen = useStore((state) => state.isCreditsOpen);
  const isLoadGameOpen = useStore((state) => state.isLoadGameOpen);
  const closeModal = useStore((state) => state.closeModal);
  const closeLoadGame = useStore((state) => state.closeLoadGame);
  const selectedPlayerId = useStore((state) => state.selectedPlayerId);
  const settings = useStore((state) => state.settings);
  const gameState = useStore((state) => state.gameState);

  // Apply initial visual settings (contrast, motion, text size)
  useEffect(() => {
    applySettingsToDom(settings);
    audioEngine.ensureContext();
    audioEngine.updateSettings(settings);
  }, [settings]);

  // Global Audio & Music Lifecycle (SPEC §17.2)
  useEffect(() => {
    if (screen === 'title') {
      audioEngine.playMusic('title_theme');
    } else if (screen === 'match') {
      audioEngine.stopMusic();
    } else if (screen === 'seasonEnd') {
      audioEngine.playMusic('season_end');
    } else {
      audioEngine.playMusic('menu_loop');
    }
  }, [screen]);

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
        } else if (isLoadGameOpen) {
          e.preventDefault();
          closeLoadGame();
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
      <Suspense fallback={null}>
        <TitleScreen />
        <LoadGameModal />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </Suspense>
    );
  }

  if (screen === 'devGallery') {
    return (
      <Suspense fallback={null}>
        <DevGalleryScreen onBackToTitle={() => setScreen('title')} />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </Suspense>
    );
  }

  if (screen === 'newGame') {
    return (
      <Suspense fallback={null}>
        <NewGameScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </Suspense>
    );
  }

  if (screen === 'boardMeeting') {
    return (
      <Suspense fallback={null}>
        <BoardMeetingScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </Suspense>
    );
  }

  if (screen === 'match') {
    return (
      <Suspense fallback={null}>
        <MatchScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </Suspense>
    );
  }

  if (screen === 'seasonEnd') {
    return (
      <Suspense fallback={null}>
        <SeasonEndScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </Suspense>
    );
  }

  if (screen === 'sacked') {
    return (
      <Suspense fallback={null}>
        <SackedScreen />
        <SettingsModal />
        <CreditsModal />
        <Toast />
      </Suspense>
    );
  }

  const currentWorld = getScreenWorld(screen);

  // 2. Management screens shell (TopBar tabs + ScreenTransition + Content)
  return (
    <div className={`app-shell ${currentWorld}`}>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <ClubSpacesCanvas />
        </Suspense>
      </ErrorBoundary>
      <TopBar />

      <main className={`app-shell-main ${currentWorld === 'office' ? 'office' : ''}`}>
        <ScreenTransition currentScreen={screen}>
          <Suspense fallback={null}>
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
          </Suspense>
        </ScreenTransition>
      </main>

      <Suspense fallback={null}>
        {selectedPlayerId && (
          <PlayerProfileModal
            playerId={selectedPlayerId}
            onClose={() => useStore.setState({ selectedPlayerId: null })}
          />
        )}
        <TutorialCoachMark />
        <ConversationModal />
        <LoadGameModal />
        <SettingsModal />
        <CreditsModal />
      </Suspense>
      <Toast />
    </div>
  );
};
