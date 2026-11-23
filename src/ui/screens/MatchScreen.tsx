// Implements SPEC §11.16–11.18 & §14 Complete 3D Match Day Screen
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../state/store';
import {
  MatchEvent,
  MatchResult,
  MatchCommand,
  MatchInput,
  Side,
  PlayerId,
  Player,
} from '../../core/types';
import { buildTeamSheet } from '../../core/game/advance';
import { deriveSeed } from '../../core/rng';
import { MatchScene } from '../../render3d/MatchScene';
import { CameraMode, QualityPreset, TimeSlot } from '../../render3d/types';
import { MatchPlayback, PlaybackMode, PlaybackState } from './Match/playback';
import { ScoreboardBug } from './Match/ScoreboardBug';
import { MatchControls } from './Match/MatchControls';
import { CommentaryStrip } from './Match/CommentaryStrip';
import { LiveStatsDrawer } from './Match/LiveStatsDrawer';
import { AssistantDrawer, AssistantAdviceItem, OutOfTownScore } from './Match/AssistantDrawer';
import { QuickSubsModal } from './Match/QuickSubsModal';
import { GoalBanner, ReplayOverlay } from './Match/GoalBanner';
import { RadarOverlay } from './Match/RadarOverlay';
import { HalfTimeModal } from './Match/HalfTimeModal';
import { FullTimeModal } from './Match/FullTimeModal';
import { TalkTone, getHalfTimeTalkContext } from '../../core/player/talks';
import { simulateInstant } from '../../core/match/engine';
import type { ClientToWorkerMessage, WorkerToClientMessage } from '../../workers/match.worker';

export const MatchScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);
  const performTeamTalk = useStore((state) => state.performTeamTalk);
  const showToast = useStore((state) => state.showToast);
  const settings = useStore((state) => state.settings);

  // Scene & Playback Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MatchScene | null>(null);
  const playbackRef = useRef<MatchPlayback | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const isAltHeldRef = useRef<boolean>(false);

  // UI Reactive States
  const [hudVisible, setHudVisible] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('broadcast');
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    pt: 0,
    half: 1,
    paused: false,
    mode: 'key',
    fullSpeed: 4,
    speedMultiplier: 1.0,
    isTimeLapse: false,
    timeLapseProgress: 0,
    isInsideHighlight: true,
    isReplay: false,
    currentEvent: null,
    score: { home: 0, away: 0 },
    lastGoalEvent: null,
  });

  // Overlays & Drawers
  const [statsOpen, setStatsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [isHalfTime, setIsHalfTime] = useState(false);
  const [isFullTime, setIsFullTime] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  // Goal banner
  const [currentGoalBanner, setCurrentGoalBanner] = useState<{
    scorerName: string;
    minuteLabel: string;
    side: Side;
  } | null>(null);

  // Out of town scores & Assistant advices
  const [outOfTownScores, setOutOfTownScores] = useState<OutOfTownScore[]>([]);
  const [adviceList, setAdviceList] = useState<AssistantAdviceItem[]>([]);

  // Substitution tracking
  const [subsUsed, setSubsUsed] = useState(0);
  const [windowsUsed, setWindowsUsed] = useState(0);

  if (!gameState || !gameState.pendingMatch) return null;

  const pending = gameState.pendingMatch;
  const fixture = gameState.fixtures.find((f) => f.id === pending.fixtureId);
  if (!fixture) return null;

  const homeClub = gameState.clubs[fixture.homeId];
  const awayClub = gameState.clubs[fixture.awayId];
  const userClub = gameState.clubs[gameState.userClubId];
  if (!homeClub || !awayClub || !userClub) return null;

  const userSide: Side = fixture.homeId === gameState.userClubId ? 'home' : 'away';

  // 1. Initialize Worker & Scene & Playback
  useEffect(() => {
    if (!containerRef.current) return;

    // A. Create Playback controller
    const playback = new MatchPlayback({
      onGoal: (ev) => {
        const scorer = ev.playerId ? gameState.players[ev.playerId] : null;
        const scorerName = scorer
          ? (scorer.knownAs ?? `${scorer.firstName} ${scorer.lastName}`)
          : 'Unknown Scorer';
        setCurrentGoalBanner({
          scorerName,
          minuteLabel: ev.minuteLabel,
          side: ev.side,
        });
      },
      onHalfTime: () => {
        setIsHalfTime(true);
      },
      onFullTime: () => {
        setIsFullTime(true);
      },
      onEventStarted: (ev) => {
        // Evaluate assistant in-match rules (§15.4)
        if (ev.type === 'YELLOW' && ev.side === userSide) {
          const p = ev.playerId ? gameState.players[ev.playerId] : null;
          if (p) {
            const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
            setAdviceList((prev) => [
              {
                id: `card-${ev.seq}`,
                text: `${pName} is on a booking. Keep him on his feet.`,
                reason: 'Prevent reckless tackles and avoid a second yellow.',
              },
              ...prev.slice(0, 4),
            ]);
          }
        }
      },
    });
    playbackRef.current = playback;

    // B. Build Match3DContext
    const homeSheet = buildTeamSheet(homeClub, gameState.players, 'home');
    const awaySheet = buildTeamSheet(awayClub, gameState.players, 'away');

    const homePlayers = homeClub.tactics.lineup
      .map((id) => (id ? gameState.players[id] : null))
      .filter((p): p is Player => Boolean(p));
    const awayPlayers = awayClub.tactics.lineup
      .map((id) => (id ? gameState.players[id] : null))
      .filter((p): p is Player => Boolean(p));

    const captureState =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('state')
        : null;

    const quality: QualityPreset = settings.quality === 'Auto' ? 'Medium' : settings.quality;
    const timeSlot: TimeSlot =
      captureState === 'afternoon'
        ? 'afternoon'
        : ((fixture.kickoff?.toLowerCase() ?? 'evening') as TimeSlot);
    const weather = captureState === 'rain' ? 'rain' : fixture.weather === 'Rain' ? 'rain' : 'dry';

    // C. Initialize 3D Scene
    const scene = new MatchScene({
      container: containerRef.current,
      homeClub,
      awayClub,
      homePlayers,
      awayPlayers,
      weather,
      timeSlot,
      quality,
    });
    sceneRef.current = scene;

    // Apply capture states if specified in URL query (?state=...)
    if (captureState === 'goal') {
      const scorer = homePlayers[9] ?? homePlayers[0];
      setCurrentGoalBanner({
        scorerName: scorer
          ? (scorer.knownAs ?? `${scorer.firstName} ${scorer.lastName}`)
          : 'Whitlock',
        minuteLabel: "34'",
        side: 'home',
      });
    } else if (captureState === 'replay') {
      playback.isReplay = true;
      setPlaybackState((prev) => ({ ...prev, isReplay: true }));
    } else if (captureState === 'halftime') {
      setIsHalfTime(true);
      playback.score = { home: 1, away: 0 };
      setPlaybackState((prev) => ({ ...prev, score: { home: 1, away: 0 }, half: 1, pt: 2700 }));
    } else if (captureState === 'subs') {
      setSubsOpen(true);
    } else if (captureState === 'drawers') {
      setStatsOpen(true);
      setAssistantOpen(true);
    } else if (captureState === 'tactical') {
      scene.setCameraMode('tactical');
      setCameraMode('tactical');
    } else if (captureState === 'freecam') {
      scene.setCameraMode('player');
      setCameraMode('player');
    } else if (captureState === 'timelapse') {
      playback.pt = 1620;
      playback.isTimeLapse = true;
      playback.timeLapseProgress = 0.55;
      setPlaybackState((prev) => ({
        ...prev,
        pt: 1620,
        isTimeLapse: true,
        timeLapseProgress: 0.55,
        speedMultiplier: 60,
      }));
    }

    // D. Initialize Match Worker
    const worker = new Worker(new URL('../../workers/match.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerToClientMessage>) => {
      const msg = e.data;
      if (msg.type === 'events') {
        playback.addEvents(msg.events);
      } else if (msg.type === 'result') {
        setMatchResult(msg.result);
      } else if (msg.type === 'error') {
        console.error('Match worker error:', msg.message);
      }
    };

    const input: MatchInput = {
      fixtureId: fixture.id,
      home: homeSheet,
      away: awaySheet,
      isDerby: homeClub.rivals.includes(awayClub.id),
      weather: fixture.weather,
      userSide,
      aiControls: userSide === 'home' ? ['away'] : ['home'],
    };

    const matchSeed = deriveSeed(gameState.seed, 'match-sim', fixture.id);

    if (captureState === 'fulltime') {
      const instantRes = simulateInstant(input, matchSeed);
      setMatchResult(instantRes);
      setIsFullTime(true);
      playback.score = { home: instantRes.homeGoals, away: instantRes.awayGoals };
      setPlaybackState((prev) => ({
        ...prev,
        score: { home: instantRes.homeGoals, away: instantRes.awayGoals },
        half: 2,
        pt: 5400,
      }));
    }

    worker.postMessage({
      type: 'start',
      input,
      seed: matchSeed,
      lookaheadSec: 300,
    } satisfies ClientToWorkerMessage);

    // E. Initialize simulated out-of-town scores
    const otherFixtures = gameState.fixtures
      .filter((f) => f.matchday === fixture.matchday && f.id !== fixture.id)
      .slice(0, 4);

    const initialScores: OutOfTownScore[] = otherFixtures.map((f) => ({
      fixtureId: f.id,
      homeClub: gameState.clubs[f.homeId]!,
      awayClub: gameState.clubs[f.awayId]!,
      homeScore: 0,
      awayScore: 0,
      minute: 1,
    }));
    setOutOfTownScores(initialScores);

    // F. Main Render & Playback Loop
    let lastT = performance.now();
    const frameLoop = (now: number) => {
      const realDelta = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;

      // Update Playback Clock
      const state = playback.update(realDelta);
      setPlaybackState(state);

      // Update 3D Scene
      scene.updatePlayback(state.pt, state.currentEvent, state.half);

      // Update name tags visibility (SPEC §14, M1)
      const ballCarrierId = state.currentEvent?.playerId ?? null;
      const commentaryPlayerId =
        state.currentEvent?.targetId ??
        state.currentEvent?.opponentId ??
        state.currentEvent?.playerId ??
        null;
      const showAllTags = scene.getCameraMode() === 'tactical' || isAltHeldRef.current;
      scene.updateNameTags(ballCarrierId, commentaryPlayerId, showAllTags);

      // Update 3D ball position during time-lapse (M4)
      if (state.isTimeLapse) {
        const interpBall = playback.getBallPosition(state.pt);
        const sceneX = interpBall.x - 52.5;
        const sceneZ = interpBall.y - 34;
        scene.setBallPosition(sceneX, 0.11, sceneZ);
      }

      // Update Out of Town Scores progress
      if (state.pt > 0 && Math.random() < 0.005) {
        setOutOfTownScores((prev) =>
          prev.map((s) => {
            const min = Math.min(90, Math.floor(state.pt / 60));
            const addGoal = Math.random() < 0.05;
            return {
              ...s,
              minute: min,
              homeScore: addGoal && Math.random() > 0.5 ? s.homeScore + 1 : s.homeScore,
              awayScore: addGoal && Math.random() <= 0.5 ? s.awayScore + 1 : s.awayScore,
            };
          }),
        );
      }

      // Request next events chunk if worker queue is getting low
      if (workerRef.current && state.pt > 0 && Math.floor(state.pt) % 60 === 0) {
        workerRef.current.postMessage({
          type: 'need',
          untilT: state.pt + 300,
        } satisfies ClientToWorkerMessage);
      }

      animFrameRef.current = requestAnimationFrame(frameLoop);
    };

    animFrameRef.current = requestAnimationFrame(frameLoop);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      scene.dispose();
      worker.terminate();
    };
  }, []);

  // Keyboard Shortcuts per SPEC §11.0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltHeldRef.current = true;
      }
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const playback = playbackRef.current;
      const scene = sceneRef.current;
      if (!playback) return;

      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        playback.togglePause();
      } else if (e.key === '1') {
        playback.setMode('key');
      } else if (e.key === '2') {
        playback.setMode('extended');
      } else if (e.key === '3') {
        playback.setMode('full');
      } else if (e.key === '+' || e.key === '=') {
        const next = playback.fullSpeed === 2 ? 4 : playback.fullSpeed === 4 ? 8 : 2;
        playback.setFullSpeed(next);
      } else if (e.key === 'c' || e.key === 'C') {
        if (scene) {
          scene.cameras.cycleMode();
          setCameraMode(scene.getCameraMode());
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (playback.lastGoalEvent) {
          playback.triggerGoalReplay(playback.lastGoalEvent);
        }
      } else if (e.key === 's' || e.key === 'S') {
        setSubsOpen((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H') {
        setHudVisible((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === 'i' || e.key === 'I') {
        handleFinishInstant();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleFinishInstant = () => {
    if (!workerRef.current || !playbackRef.current) return;
    workerRef.current.postMessage({
      type: 'finishInstant',
    } satisfies ClientToWorkerMessage);

    playbackRef.current.pause();
    showToast('Simulating instantly to full-time...', 'info');

    setTimeout(() => {
      setIsFullTime(true);
    }, 200);
  };

  const handleConfirmSub = (outId: PlayerId, inId: PlayerId) => {
    if (!workerRef.current || !playbackRef.current) return;
    const slot = userClub.tactics.lineup.findIndex((id) => id === outId);
    if (slot < 0) return;

    const command: MatchCommand = {
      kind: 'sub',
      side: userSide,
      outId,
      inId,
      slot,
      issuedAtT: playbackRef.current.pt,
    };

    workerRef.current.postMessage({
      type: 'command',
      command,
    } satisfies ClientToWorkerMessage);

    setSubsUsed((prev) => prev + 1);
    setWindowsUsed((prev) => prev + 1);
    showToast('Tactical substitution submitted', 'info');
  };

  const handleResumeSecondHalf = (talkTone?: TalkTone) => {
    setIsHalfTime(false);
    if (talkTone && gameState) {
      const isHome = gameState.userClubId === homeClub.id;
      const userGoals = isHome ? playbackState.score.home : playbackState.score.away;
      const oppGoals = isHome ? playbackState.score.away : playbackState.score.home;
      const htContext = getHalfTimeTalkContext(userGoals, oppGoals);
      const res = performTeamTalk(htContext, talkTone);
      if (res) {
        showToast(`Team Talk (${talkTone}): ${res.squadReaction}`, 'success');
      }
    }
    if (playbackRef.current) {
      playbackRef.current.resumeSecondHalf();
    }
  };

  const handleProceedToPostMatch = async () => {
    await advanceGame({ matchResult });
  };

  const starters = userClub.tactics.lineup
    .map((id) => (id ? gameState.players[id] : null))
    .filter((p): p is Player => p !== null);
  const bench = userClub.tactics.bench
    .map((id) => (id ? gameState.players[id] : null))
    .filter((p): p is Player => p !== null);

  const ballPos = sceneRef.current?.ball.getPosition() ?? { x: 0, y: 0.11, z: 0 };
  const absBallX = ballPos.x + 52.5;
  const absBallY = ballPos.z + 34;

  const mockStats = {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    possessionSec: 0,
    passes: 0,
    passesCompleted: 0,
    corners: 0,
    fouls: 0,
    offsides: 0,
    yellow: 0,
    red: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    bigChances: 0,
  };

  const homeStats = matchResult ? matchResult.stats.home : mockStats;
  const awayStats = matchResult ? matchResult.stats.away : mockStats;

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0A0E14',
      }}
    >
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* Broadcast HUD Overlays */}
      {hudVisible && (
        <>
          {/* Top Left Scoreboard Bug */}
          <ScoreboardBug
            homeClub={homeClub}
            awayClub={awayClub}
            homeScore={playbackState.score.home}
            awayScore={playbackState.score.away}
            pt={playbackState.pt}
            half={playbackState.half}
          />

          {/* Top Right Match Controls */}
          <MatchControls
            paused={playbackState.paused}
            mode={playbackState.mode}
            fullSpeed={playbackState.fullSpeed}
            cameraMode={cameraMode}
            statsOpen={statsOpen}
            assistantOpen={assistantOpen}
            onTogglePause={() => playbackRef.current?.togglePause()}
            onSelectMode={(m) => playbackRef.current?.setMode(m)}
            onCycleFullSpeed={() => {
              const cur = playbackRef.current?.fullSpeed ?? 4;
              const next = cur === 2 ? 4 : cur === 4 ? 8 : 2;
              playbackRef.current?.setFullSpeed(next);
            }}
            onCycleCamera={() => {
              if (sceneRef.current) {
                sceneRef.current.cameras.cycleMode();
                setCameraMode(sceneRef.current.getCameraMode());
              }
            }}
            onToggleStats={() => setStatsOpen((prev) => !prev)}
            onToggleAssistant={() => setAssistantOpen((prev) => !prev)}
            onInstantResult={handleFinishInstant}
            onToggleFullscreen={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
          />

          {/* Bottom Commentary Caption Strip */}
          <CommentaryStrip
            text={
              playbackState.currentEvent
                ? `${playbackState.currentEvent.type} - Minute ${playbackState.currentEvent.minuteLabel}`
                : ''
            }
            importance={playbackState.currentEvent?.importance ?? 0}
          />

          {/* 2D Radar Time-Lapse Overlay during highlights gaps (M4) */}
          {playbackState.isTimeLapse && (
            <RadarOverlay
              ballX={playbackRef.current?.getBallPosition(playbackState.pt).x ?? absBallX}
              ballY={playbackRef.current?.getBallPosition(playbackState.pt).y ?? absBallY}
              speedMultiplier={playbackState.speedMultiplier}
              timeLapseProgress={playbackState.timeLapseProgress}
            />
          )}

          {/* Left Live Stats & Momentum Drawer */}
          <LiveStatsDrawer
            isOpen={statsOpen}
            onClose={() => setStatsOpen(false)}
            homeClub={homeClub}
            awayClub={awayClub}
            homeStats={homeStats}
            awayStats={awayStats}
            momentumHistory={[
              { minute: 15, homeXg: 0.12, awayXg: 0.05 },
              { minute: 30, homeXg: 0.35, awayXg: 0.22 },
              { minute: 45, homeXg: 0.48, awayXg: 0.31 },
            ]}
          />

          {/* Right Assistant Advice & Around the League Drawer */}
          <AssistantDrawer
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            adviceList={adviceList}
            outOfTownScores={outOfTownScores}
          />

          {/* Quick Substitutions Modal */}
          <QuickSubsModal
            isOpen={subsOpen}
            onClose={() => setSubsOpen(false)}
            starters={starters}
            bench={bench}
            subsUsed={subsUsed}
            subsAllowed={5}
            windowsUsed={windowsUsed}
            windowsAllowed={3}
            onConfirmSub={handleConfirmSub}
          />

          {/* Goal Banner */}
          {currentGoalBanner && (
            <GoalBanner
              scorerName={currentGoalBanner.scorerName}
              minuteLabel={currentGoalBanner.minuteLabel}
              scoringClub={currentGoalBanner.side === 'home' ? homeClub : awayClub}
              onDismiss={() => setCurrentGoalBanner(null)}
            />
          )}

          {/* Goal Replay Overlay */}
          {playbackState.isReplay && (
            <ReplayOverlay onSkip={() => playbackRef.current?.cancelReplay()} />
          )}
        </>
      )}

      {/* Half-Time Screen */}
      <HalfTimeModal
        isOpen={isHalfTime}
        homeClub={homeClub}
        awayClub={awayClub}
        homeScore={playbackState.score.home}
        awayScore={playbackState.score.away}
        homeStats={homeStats}
        awayStats={awayStats}
        userClubId={gameState.userClubId}
        onSecondHalf={handleResumeSecondHalf}
        onOpenSubs={() => setSubsOpen(true)}
        onOpenTactics={() => showToast('Adjust tactics in the drawer or pause', 'info')}
      />

      {/* Full-Time Screen */}
      <FullTimeModal
        isOpen={isFullTime}
        homeClub={homeClub}
        awayClub={awayClub}
        matchResult={matchResult}
        userClubId={gameState.userClubId}
        onProceed={handleProceedToPostMatch}
      />
    </div>
  );
};
